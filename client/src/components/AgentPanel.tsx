/* AI_METRICS_START */
let __ai_ws = (typeof __ai_ws !== "undefined") ? __ai_ws : null;
let __ai_ttft = null, __ai_start = null, __ai_chars = 0, __ai_model = "";
let __ai_timer = null;

function aiResetMetrics(){ __ai_ttft=null; __ai_start=null; __ai_chars=0; __ai_model=""; if(__ai_timer){clearInterval(__ai_timer); __ai_timer=null;} }
function aiStartMetrics(){ __ai_start = performance.now(); __ai_chars = 0; __ai_ttft = null; if(__ai_timer){clearInterval(__ai_timer);} __ai_timer=setInterval(updateStatus,500); }
function aiOnDelta(tok){ if(__ai_ttft===null) __ai_ttft = performance.now() - __ai_start; __ai_chars += (tok||"").length; updateStatus(); }
function aiOnStart(model){ __ai_model = model || __ai_model; aiStartMetrics(); }
function aiOnEnd(){ updateStatus(); if(__ai_timer){clearInterval(__ai_timer); __ai_timer=null;} }

function fmt(n){ if(n==null) return "—"; return Math.round(n); }
function updateStatus(){
  const durSec = __ai_start ? (performance.now()-__ai_start)/1000 : 0;
  const cps = durSec>0 ? (__ai_chars/durSec).toFixed(1) : "0.0";
  const el = document.querySelector("#agent-status");
  if(el){
    el.textContent = `Model: ${__ai_model||"?"} | TTFT: ${__ai_ttft?fmt(__ai_ttft)+' ms':'—'} | Rate: ${cps} chars/s | Total: ${__ai_chars}`;
  }
}

async function aiCompleteRest(prompt, role="general", model){
  const res = await fetch("http://127.0.0.1:8000/ai/complete", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ prompt, role, model })
  });
  if(!res.ok) throw new Error("AI REST failed: "+res.status);
  return await res.json();
}

function openAiWs(prompt, role="general", model, onDelta, onStart, onEnd, onError){
  try{
    if(__ai_ws){ try{__ai_ws.close();}catch(e){} __ai_ws=null; }
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/ai");
    __ai_ws = ws;
    ws.onopen = ()=>{ onStart && onStart(); ws.send(JSON.stringify({ prompt, role, model })); };
    ws.onmessage = (ev)=>{
      try{
        const obj = JSON.parse(ev.data);
        if(obj.type==="start"){ onStart && onStart(obj.model); }
        else if(obj.type==="delta"){ onDelta && onDelta(obj.token||""); }
        else if(obj.type==="end"){ onEnd && onEnd(); try{ws.close();}catch{} __ai_ws=null; }
        else if(obj.type==="error"){ onError && onError(obj.message||"error"); }
      }catch(e){ console.error(e); }
    };
    ws.onerror = ()=> onError && onError("ws error");
    ws.onclose = ()=>{};
    return ws;
  }catch(e){ onError && onError(String(e)); }
}

function cancelAiWs(){ if(__ai_ws){ try{__ai_ws.close();}catch(e){} __ai_ws=null; } }
/* AI_METRICS_END */
import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface AiMessage {
  type: string;
  content: string;
}

interface MetaData {
  roles: Record<string, string>;
  available: string[];
}

// AI completion function using REST API
async function aiComplete(prompt: string, role = "general", model?: string) {
  const res = await fetch("http://127.0.0.1:8000/ai/complete", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ prompt, role, model })
  });
  if (!res.ok) { 
    throw new Error(`AI request failed: ${res.status} - ${res.statusText}`); 
  }
  return await res.json(); // { model, content }
}

/**
 * AgentPanel displays streaming output from the AI backend and allows the
 * user to submit prompts. Multiple agents could be supported in the
 * future by extending the message format. Messages are assumed to be
 * JSON objects with type and content fields.
 */
const AgentPanel: React.FC = () => {
  const { ready, send, messages } = useWebSocket<AiMessage>('ws://localhost:8000/ws/ai');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [wsStreaming, setWsStreaming] = useState(false);
  const [wsOutput, setWsOutput] = useState('');
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [selectedRole, setSelectedRole] = useState('general');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/ai/meta')
      .then(res => res.json())
      .then(setMeta)
      .catch(console.error);
  }, []);

  const handleSubmit = () => {
    if (!input.trim()) return;
    send({ type: 'user', content: input });
    setInput('');
  };

  const handleAiComplete = async () => {
    if (!input.trim() || isLoading) return;
    
    const userInput = input.trim();
    setInput('');
    setIsLoading(true);
    
    // Add user message to AI messages
    const userMessage: AiMessage = { type: 'user', content: userInput };
    setAiMessages(prev => [...prev, userMessage]);
    
    try {
      const result = await aiComplete(userInput, selectedRole, selectedModel || undefined);
      const aiMessage: AiMessage = { 
        type: 'assistant', 
        content: `[${result.model}] ${result.content}` 
      };
      setAiMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: AiMessage = { 
        type: 'error', 
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWsStream = () => {
    if (!input.trim() || wsStreaming) return;
    
    const prompt = input.trim();
    setInput('');
    setWsStreaming(true);
    setWsOutput('');
    
    // Close any existing connection
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
    }
    
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/ai');
    wsRef.current = ws;
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ prompt, role: selectedRole, model: selectedModel || undefined }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'start') {
          // Model started
        } else if (data.type === 'delta') {
          setWsOutput(prev => prev + (data.token || ''));
        } else if (data.type === 'end') {
          setWsStreaming(false);
          ws.close();
          wsRef.current = null;
        } else if (data.type === 'error') {
          setWsOutput(prev => prev + `\n[Error: ${data.message}]`);
          setWsStreaming(false);
          ws.close();
          wsRef.current = null;
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };
    
    ws.onerror = (error) => {
      setWsOutput(prev => prev + '\n[WebSocket Error]');
      setWsStreaming(false);
      wsRef.current = null;
    };
    
    ws.onclose = () => {
      setWsStreaming(false);
      wsRef.current = null;
    };
  };

  const handleCancelWs = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    setWsStreaming(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <div className="text-xs text-gray-500 mb-2">WebSocket Messages:</div>
        {messages.map((msg, idx) => (
          <div key={`ws-${idx}`} className="text-sm whitespace-pre-wrap">
            <strong className="capitalize">{msg.type}: </strong>
            <span>{msg.content}</span>
          </div>
        ))}
        
        <div className="text-xs text-gray-500 mb-2 border-t pt-2">AI REST API Messages:</div>
        {aiMessages.map((msg, idx) => (
          <div key={`ai-${idx}`} className="text-sm whitespace-pre-wrap">
            <strong className={`capitalize ${msg.type === 'error' ? 'text-red-500' : 'text-blue-500'}`}>
              {msg.type}: 
            </strong>
            <span>{msg.content}</span>
          </div>
        ))}
        
        <div className="text-xs text-gray-500 mb-2 border-t pt-2">WS Streaming Output:</div>
        {wsOutput && (
          <div className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <strong>AI: </strong>
            <span>{wsOutput}</span>
          </div>
        )}
        
        {isLoading && (
          <div className="text-sm text-gray-500 italic">
            <strong>AI: </strong>Thinking...
          </div>
        )}
      </div>
      <div className="border-t dark:border-gray-700 border-gray-200 p-2 space-y-2">
        {meta && (
          <div className="flex gap-2 text-sm">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Role:</label>
              <select 
                value={selectedRole} 
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full bg-transparent outline-none px-1 py-0.5 rounded border dark:border-gray-700 border-gray-300 text-sm"
              >
                {Object.keys(meta.roles).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Model:</label>
              <select 
                value={selectedModel} 
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full bg-transparent outline-none px-1 py-0.5 rounded border dark:border-gray-700 border-gray-300 text-sm"
              >
                <option value="">Auto-select</option>
                {meta.available.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <input
          type="text"
          className="flex-1 bg-transparent outline-none px-2 py-1 rounded border dark:border-gray-700 border-gray-300"
          placeholder={ready ? 'Ask the agent…' : 'Connecting…'}
          value={input}
          disabled={isLoading || wsStreaming}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) {
                handleSubmit(); // WebSocket
              } else {
                handleAiComplete(); // REST API
              }
            }
          }}
        />
          <button
            className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50 text-xs"
            disabled={!input.trim() || isLoading}
            onClick={handleAiComplete}
          >
            {isLoading ? 'AI...' : 'AI'}
          </button>
          <button
            className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50 text-xs"
            disabled={!input.trim() || wsStreaming}
            onClick={handleWsStream}
          >
            {wsStreaming ? 'Streaming...' : 'WS'}
          </button>
          <button
            className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50 text-xs"
            disabled={!wsStreaming}
            onClick={handleCancelWs}
          >
            Cancel
          </button>
        </div>
        
        {/* Editor Tools */}
        <div className="border-t dark:border-gray-700 border-gray-200 pt-2 mt-2">
          <div className="flex gap-2">
            <button
              className="bg-purple-600 text-white px-3 py-1 rounded text-xs"
              onClick={async () => {
                try {
                  const result = await (window as any).electronAPI?.editorTools?.createPortable();
                  if (result?.success) {
                    alert('Portable workspace created successfully!\n\n' + result.output);
                  }
                } catch (error) {
                  console.error('Failed to create portable workspace:', error);
                  alert('Failed to create portable workspace: ' + (error as Error).message);
                }
              }}
              title="Create a portable workspace that can be moved to any Windows machine"
            >
              Create Portable
            </button>
            <button
              className="bg-orange-600 text-white px-3 py-1 rounded text-xs"
              onClick={async () => {
                try {
                  const result = await (window as any).electronAPI?.editorTools?.exportLogs();
                  if (result?.success) {
                    alert('Logs exported successfully!\n\n' + result.output);
                  }
                } catch (error) {
                  console.error('Failed to export logs:', error);
                  alert('Failed to export logs: ' + (error as Error).message);
                }
              }}
              title="Export logs and diagnostic information for troubleshooting"
            >
              Export Logs
            </button>
          </div>
        </div>
        
        {/* RAG Pro Tools */}
        <div className="border-t dark:border-gray-700 border-gray-200 pt-2 mt-2">
          <div className="flex gap-2">
            <button
              className="bg-indigo-600 text-white px-3 py-1 rounded text-xs"
              onClick={async () => {
                try {
                  const res = await fetch('http://127.0.0.1:8000/ragpro/index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clean: false })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    alert(`Indexed ${data.updated} files, skipped ${data.skipped} in ${data.took_ms}ms`);
                  }
                } catch (e) {
                  alert('Index failed: ' + e);
                }
              }}
              title="Index project files for RAG Pro context"
            >
              Index Project
            </button>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" id="use-ctx-pro" className="mr-1" />
              Use Code Context (Pro)
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// RAG Pro integration
(async function ensureRagProUI(){
  // Add RAG Pro functions
  (window as any).ragProIndex = async function(clean=false){
    const r = await fetch("http://127.0.0.1:8000/ragpro/index",{method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ clean })});
    if(!r.ok) throw new Error("index failed"); return await r.json();
  };
  (window as any).ragProComplete = async function(prompt, role="general", k=6){
    const r = await fetch("http://127.0.0.1:8000/ai/complete_with_context_pro",{method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ prompt, role, k })});
    if(!r.ok) throw new Error("complete_with_context_pro failed"); return await r.json();
  };
  
  // Hook into existing AI completion
  const originalHandleAiComplete = (window as any).handleAiComplete;
  const originalHandleWsStream = (window as any).handleWsStream;
  
  // Override REST completion
  (window as any).handleAiComplete = async () => {
    const usePro = (document.getElementById('use-ctx-pro') as HTMLInputElement)?.checked;
    if (!usePro) return originalHandleAiComplete?.();
    
    const input = document.querySelector('input[placeholder*=Ask the agent]') as HTMLInputElement;
    if (!input?.value.trim()) return;
    
    try {
      const res = await (window as any).ragProComplete(input.value, 'general', 6);
      const output = document.querySelector('#agent-output');
      if (output) output.textContent = res.content;
    } catch (e) {
      alert('RAG Pro failed: ' + e);
    }
  };
  
  // Override WebSocket completion
  (window as any).handleWsStream = () => {
    const usePro = (document.getElementById('use-ctx-pro') as HTMLInputElement)?.checked;
    if (!usePro) return originalHandleWsStream?.();
    
    const input = document.querySelector('input[placeholder*=Ask the agent]') as HTMLInputElement;
    if (!input?.value.trim()) return;
    
    (window as any).ragProComplete(input.value, 'general', 6).then((res: any) => {
      const output = document.querySelector('#agent-output');
      if (output) output.textContent = res.content;
    }).catch((e: any) => alert('RAG Pro failed: ' + e));
  };
})();

// Multi-Agent Studio integration
(function ensureAgentsUI(){
  if(document.getElementById("agents-studio")) return;
  const host = document.querySelector("#agent-metrics") || document.body;
  const wrap = document.createElement("div");
  wrap.id="agents-studio";
  wrap.style="margin-top:8px;padding:8px;border:1px solid #333;border-radius:8px;background:#0f0f0f;color:#ddd";
  wrap.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <label style="font-size:12px">Preset:
        <select id="ag-preset" style="margin-left:6px;padding:4px 6px;border-radius:6px">
          <option value="Implement-Feature">Implement-Feature</option>
          <option value="Fix-Bug">Fix-Bug</option>
        </select>
      </label>
      <button id="ag-run" style="padding:6px 10px;border-radius:6px;">Run Flow</button>
    </div>
    <textarea id="ag-instr" placeholder="Instructions / task description..." style="margin-top:6px;width:100%;min-height:80px;padding:8px;border-radius:6px;border:1px solid #444;background:#111;color:#eee"></textarea>
    <div id="ag-out" style="margin-top:6px;white-space:pre-wrap;min-height:80px;border:1px dashed #444;padding:6px;border-radius:6px;background:#0b0b0b"></div>
  `;
  host.appendChild(wrap);
  const run= wrap.querySelector("#ag-run");
  run.addEventListener("click", async ()=>{
    const preset = wrap.querySelector("#ag-preset").value;
    const instr = wrap.querySelector("#ag-instr").value.trim();
    if(!instr) return alert("Write some instructions");
    const out = wrap.querySelector("#ag-out"); out.textContent="Running...";
    try{
      const r = await fetch("http://127.0.0.1:8000/agents/run_flow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({preset, instructions:instr})});
      if(!r.ok) throw new Error("agents/run_flow failed");
      const j = await r.json();
      out.textContent = "Model: "+j.model+"\n\n" + j.transcript.map(t=>`[${t.role}]\n${t.content}`).join("\n\n");
    }catch(e){ out.textContent="Error: "+e; }
  });
})();

// Automation UI integration
(function ensureAutomationUI(){
  if(document.getElementById("sys-run")) return;
  const host=document.querySelector("#agent-metrics")||document.body;
  const wrap=document.createElement("div");
  wrap.style="margin-top:8px;padding:8px;border:1px solid #333;border-radius:8px;background:#0f0f0f;color:#ddd";
  wrap.innerHTML=`
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="sys-cmd" placeholder="git" style="padding:6px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;width:120px"/>
      <input id="sys-args" placeholder="--version" style="padding:6px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;flex:1;min-width:160px"/>
      <button id="sys-run" style="padding:6px 10px;border-radius:6px;">Run</button>
      <input id="br-url" placeholder="https://example.com" style="padding:6px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;flex:1;min-width:180px"/>
      <button id="br-open" style="padding:6px 10px;border-radius:6px;">Open URL</button>
    </div>
    <div id="auto-out" style="margin-top:6px;white-space:pre-wrap;min-height:60px;border:1px dashed #444;padding:6px;border-radius:6px;background:#0b0b0b"></div>
  `;
  host.appendChild(wrap);
  const out=wrap.querySelector("#auto-out");
  wrap.querySelector("#sys-run").addEventListener("click", async ()=>{
    const cmd = wrap.querySelector("#sys-cmd").value||"git";
    const args = (wrap.querySelector("#sys-args").value||"--version").split(" ").filter(Boolean);
    try{
      const r = await fetch("http://127.0.0.1:8000/system/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cmd, args, dry:false})});
      const j = await r.json();
      out.textContent = (j.ok? "OK":"ERR")+" ("+j.code+")\n"+(j.out||"");
    }catch(e){ out.textContent="Error: "+e; }
  });
  wrap.querySelector("#br-open").addEventListener("click", async ()=>{
    const url = wrap.querySelector("#br-url").value||"https://example.com";
    try{
      const r = await fetch("http://127.0.0.1:8000/browser/open",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
      const j = await r.json();
      out.textContent = "Browser title: " + (j.title||"");
    }catch(e){ out.textContent="Browser error: "+e; }
  });
})();

// Providers panel integration
async function getProvidersMeta(){
  const r=await fetch("http://127.0.0.1:8000/providers/meta"); if(!r.ok) throw new Error("meta failed"); return await r.json();
}
async function setProviderKey(provider, apiKey){
  const r=await fetch("http://127.0.0.1:8000/providers/set_key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider, apiKey})});
  if(!r.ok) throw new Error("set_key failed"); return await r.json();
}
async function setProvidersConfig(cfg){
  const r=await fetch("http://127.0.0.1:8000/providers/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg)});
  if(!r.ok) throw new Error("config failed"); return await r.json();
}
(function ensureProvidersPanel(){
  if(document.getElementById("providers-panel")) return;
  const host = document.querySelector("#agent-metrics") || document.body;
  const box = document.createElement("div");
  box.id="providers-panel";
  box.style="margin-top:8px;padding:10px;border:1px solid #333;border-radius:8px;background:#0f0f0f;color:#ddd";
  box.innerHTML = `
    <details>
      <summary style="cursor:pointer">Providers & API Keys</summary>
      <div style="display:grid;grid-template-columns:160px 1fr; gap:8px; margin-top:8px">
        <label>Offline only</label>
        <div><input id="pf-offline" type="checkbox"/></div>

        <label>Allow external AI</label>
        <div><input id="pf-external" type="checkbox"/></div>

        <label>Timeout (sec)</label>
        <div><input id="pf-timeout" type="number" value="60" min="5" max="180" style="width:80px"/></div>

        <label>OpenAI key</label>
        <div><input id="pf-openai" type="password" placeholder="sk-..." style="width:100%"/></div>

        <label>Anthropic key</label>
        <div><input id="pf-anth" type="password" placeholder="anthropic-key" style="width:100%"/></div>

        <label>Moonshot/OpenAI-compat key</label>
        <div><input id="pf-compat" type="password" placeholder="token" style="width:100%"/></div>

        <label>Priority</label>
        <div><input id="pf-priority" placeholder="ollama,openai,anthropic,openai_compat" style="width:100%"/></div>

        <label>Roles → models (local)</label>
        <div><input id="pf-roles" placeholder='{"completion":"deepseek-coder:latest","general":"dolphin-phi:latest","planner":"smollm:1.7b"}' style="width:100%"/></div>

        <div></div>
        <div><button id="pf-save" style="padding:6px 10px;border-radius:6px;">Save</button></div>
      </div>
      <div id="pf-meta" style="margin-top:8px;font-size:12px;opacity:.85"></div>
    </details>
  `;
  host.appendChild(box);

  async function refresh(){
    try{
      const m = await getProvidersMeta();
      document.getElementById("pf-offline").checked = m.offlineOnly;
      document.getElementById("pf-external").checked = !!m.allowExternalAI;
      document.getElementById("pf-timeout").value = m.timeoutSec || 60;
      document.getElementById("pf-priority").value = m.priority.join(",");
      document.getElementById("pf-roles").value = JSON.stringify(m.roles);
      document.getElementById("pf-meta").textContent = "Local models: " + (m.available||[]).join(", ");
    }catch(e){
      document.getElementById("pf-meta").textContent = "Meta error: "+e;
    }
  }
  refresh();

  document.getElementById("pf-save").addEventListener("click", async ()=>{
    try{
      const offline = document.getElementById("pf-offline").checked;
      const external = document.getElementById("pf-external").checked;
      const timeout = parseInt(document.getElementById("pf-timeout").value||"60");
      const pri = (document.getElementById("pf-priority").value||"").split(",").map(s=>s.trim()).filter(Boolean);
      const roles = JSON.parse(document.getElementById("pf-roles").value||"{}");
      // keys (optional)
      const k1 = document.getElementById("pf-openai").value.trim();
      const k2 = document.getElementById("pf-anth").value.trim();
      const k3 = document.getElementById("pf-compat").value.trim();
      if(k1) await setProviderKey("openai", k1);
      if(k2) await setProviderKey("anthropic", k2);
      if(k3) await setProviderKey("openai_compat", k3);
      await setProvidersConfig({offlineOnly:offline, priority:pri, roles, allowExternalAI:external, timeoutSec:timeout});
      alert("Saved.");
      refresh();
    }catch(e){ alert("Save error: "+e); }
  });
})();

// Git Sync panel integration
(function ensureGitPanel(){
  if(document.getElementById("git-panel")) return;
  const host=document.querySelector("#agent-metrics")||document.body;
  const box=document.createElement("div");
  box.id="git-panel";
  box.style="margin-top:8px;padding:10px;border:1px solid #333;border-radius:8px;background:#0f0f0f;color:#ddd";
  box.innerHTML = `
    <details>
      <summary style="cursor:pointer">Git Sync</summary>
      <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;margin-top:8px">
        <label>Repo Path</label><input id="git-repo" placeholder="C:\\Users\\Midooo\\Projects\\myrepo" />
        <label>Branch</label><input id="git-branch" value="main" />
        <label>Commit Message</label><input id="git-msg" value="chore: auto-sync" />
        <label>GitHub Username</label><input id="git-user" placeholder="username" />
        <label>GitHub PAT</label><input id="git-token" type="password" placeholder="ghp_..." />
        <div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="git-save">Save Config</button>
          <button id="git-settoken">Save Token</button>
          <button id="git-status">Status</button>
          <button id="git-push">Commit + Push</button>
          <label style="margin-left:12px;font-size:12px"><input id="git-watch" type="checkbox"/> Auto-Sync</label>
        </div>
      </div>
      <div id="git-out" style="margin-top:8px;font-size:12px;white-space:pre-wrap;border:1px dashed #444;padding:6px;border-radius:6px;background:#0b0b0b"></div>
    </details>`;
  host.appendChild(box);
  const $ = sel => box.querySelector(sel);
  async function POST(url, body){ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const j=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j)); return j; }
  async function GET(url){ const r=await fetch(url); const j=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j)); return j; }

  $("#git-save").onclick = async ()=>{
    try{ const j = await POST("http://127.0.0.1:8000/git/config", {repoPath:$("#git-repo").value, branch:$("#git-branch").value}); $("#git-out").textContent = "Saved.\n"+JSON.stringify(j.git,null,2); }
    catch(e){ $("#git-out").textContent="Err: "+e; }
  };
  $("#git-settoken").onclick = async ()=>{
    try{ const j = await POST("http://127.0.0.1:8000/git/set_token", {token:$("#git-token").value, user:$("#git-user").value||"mido"}); $("#git-out").textContent="Token saved."; }
    catch(e){ $("#git-out").textContent="Err: "+e; }
  };
  $("#git-status").onclick = async ()=>{
    try{ const j = await GET("http://127.0.0.1:8000/git/status"); $("#git-out").textContent = JSON.stringify(j,null,2); }
    catch(e){ $("#git-out").textContent="Err: "+e; }
  };
  $("#git-push").onclick = async ()=>{
    try{ const j = await POST("http://127.0.0.1:8000/git/push", {repoPath:$("#git-repo").value, branch:$("#git-branch").value, message:$("#git-msg").value}); $("#git-out").textContent = j.out || "OK"; }
    catch(e){ $("#git-out").textContent="Err: "+e; }
  };
  $("#git-watch").onchange = async (ev)=>{
    try{ const j = await POST("http://127.0.0.1:8000/git/watch", {enable:ev.target.checked}); $("#git-out").textContent = "Auto-Sync: "+j.watching; }
    catch(e){ $("#git-out").textContent="Err: "+e; ev.target.checked=false; }
  };
})();

/*** Command Palette + Status Bar + Tasks ***/
(function enhanceUX(){
  // ===== Status Bar =====
  if(!document.getElementById("status-bar")){
    const bar=document.createElement("div");
    bar.id="status-bar";
    bar.style="position:fixed;bottom:0;left:0;right:0;height:26px;background:#0b0b0b;border-top:1px solid #333;color:#cfcfcf;display:flex;align-items:center;gap:14px;padding:0 10px;font-size:12px;z-index:9999";
    bar.innerHTML=`<span id="sb-cpu">CPU: --%</span><span id="sb-mem">RAM: --%</span><span id="sb-prov"></span>`;
    document.body.appendChild(bar);
    async function tick(){
      try{
        const r = await fetch("http://127.0.0.1:8000/sys/metrics"); const j = await r.json();
        document.getElementById("sb-cpu").textContent = "CPU: "+(j.cpu_percent||0)+"%";
        document.getElementById("sb-mem").textContent = "RAM: "+(j.mem_percent||0)+"%";
        const pr = j.provider_hint||{};
        document.getElementById("sb-prov").textContent = (pr.offlineOnly? "[Offline] ":"") + "Models: " + ((pr.available||[]).slice(0,3).join(", ") || "-");
      }catch(e){}
    }
    setInterval(tick, 2000); tick();
  }

  // ===== Tasks mini UI =====
  if(!document.getElementById("tasks-panel")){
    const host=document.querySelector("#agent-metrics")||document.body;
    const box=document.createElement("div");
    box.id="tasks-panel";
    box.style="margin-top:8px;padding:10px;border:1px solid #333;border-radius:8px;background:#0f0f0f;color:#ddd";
    box.innerHTML=`
      <details>
        <summary style="cursor:pointer">Tasks Runner</summary>
        <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;margin-top:8px">
          <label>Name</label><input id="tk-name" placeholder="build-client"/>
          <label>Cmd</label><input id="tk-cmd" placeholder="npm"/>
          <label>Args</label><input id="tk-args" placeholder="run build"/>
          <label>CWD</label><input id="tk-cwd" placeholder="F:\\ai_code_editor\\client"/>
          <div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="tk-save">Save</button>
            <button id="tk-run">Run</button>
            <button id="tk-list">List</button>
          </div>
        </div>
        <div id="tk-out" style="margin-top:8px;white-space:pre-wrap;border:1px dashed #444;padding:6px;border-radius:6px;background:#0b0b0b"></div>
      </details>`;
    host.appendChild(box);
    const $ = s=>box.querySelector(s);
    async function POST(u,b){const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});const j=await r.json();if(!r.ok) throw new Error(JSON.stringify(j));return j;}
    async function GET(u){const r=await fetch(u);const j=await r.json();if(!r.ok) throw new Error(JSON.stringify(j));return j;}
    $("#tk-save").onclick=async()=>{try{$("#tk-out").textContent="Saving...";const j=await POST("http://127.0.0.1:8000/tasks/save",{name:$("#tk-name").value,cmd:$("#tk-cmd").value,args:($("#tk-args").value||"").split(" ").filter(Boolean),cwd:$("#tk-cwd").value});$("#tk-out").textContent="Saved ("+j.count+").";}catch(e){$("#tk-out").textContent="Err: "+e;}};
    $("#tk-run").onclick=async()=>{try{$("#tk-out").textContent="Running...";const j=await POST("http://127.0.0.1:8000/tasks/run",{name:$("#tk-name").value});$("#tk-out").textContent=(j.ok? "OK":"ERR")+" ("+j.code+")\n"+(j.out||"");}catch(e){$("#tk-out").textContent="Err: "+e;}};
    $("#tk-list").onclick=async()=>{try{const j=await GET("http://127.0.0.1:8000/tasks/list");$("#tk-out").textContent=JSON.stringify(j.tasks,null,2);}catch(e){$("#tk-out").textContent="Err: "+e;}};
  }

  // ===== Command Palette =====
  if(!document.getElementById("cmd-palette")){
    const pal=document.createElement("div");
    pal.id="cmd-palette";
    pal.style="position:fixed;inset:0;display:none;align-items:start;justify-content:center;background:rgba(0,0,0,.55);z-index:10000;padding-top:10vh";
    pal.innerHTML=`
      <div style="width:min(800px,92vw);background:#111;border:1px solid #333;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)">
        <input id="cp-input" placeholder="Type a command..." style="width:100%;padding:12px 14px;border:0;border-bottom:1px solid #333;background:#121212;color:#eee;font-size:14px;border-top-left-radius:10px;border-top-right-radius:10px;outline:none"/>
        <div id="cp-list" style="max-height:50vh;overflow:auto;padding:6px 8px"></div>
      </div>`;
    document.body.appendChild(pal);

    const cmds = [
      {k:"Index Project", run: async()=>{await fetch("http://127.0.0.1:8000/ragpro/index",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}); alert("Indexed.");}},
      {k:"Search 'fastapi' (RAG)", run: async()=>{await fetch("http://127.0.0.1:8000/ragpro/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q:"fastapi",k:5})}); alert("Searched.");}},
      {k:"Git: Commit+Push", run: async()=>{const j=await fetch("http://127.0.0.1:8000/git/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"chore: palette push"})}); alert((await j.json()).ok? "Pushed":"Push error");}},
      {k:"Agents: Implement-Feature", run: async()=>{await fetch("http://127.0.0.1:8000/agents/run_flow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({preset:"Implement-Feature",instructions:"Add a hello world route"})}); alert("Agents flow started");}},
      {k:"System: git --version", run: async()=>{const r=await fetch("http://127.0.0.1:8000/system/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cmd:"git",args:["--version"]})}); const j=await r.json(); alert(j.out||"OK");}},
      {k:"Providers: Open panel", run: async()=>{document.querySelector("#providers-panel details")?.setAttribute("open","true");}},
      {k:"Tasks: List", run: async()=>{const r=await fetch("http://127.0.0.1:8000/tasks/list"); alert(JSON.stringify(await r.json()));}},
    ];

    const input = pal.querySelector("#cp-input");
    const list  = pal.querySelector("#cp-list");
    function render(q=""){
      const L = cmds.filter(c => c.k.toLowerCase().includes(q.toLowerCase()));
      list.innerHTML = L.map((c,i)=>`<div data-i="${i}" style="padding:8px;border-bottom:1px solid #222;cursor:pointer">${c.k}</div>`).join("") || `<div style="padding:10px;opacity:.7">No matches</div>`;
      list.querySelectorAll("div[data-i]").forEach(el=> el.onclick = async ()=>{ await cmds[parseInt(el.dataset.i)].run(); hide(); });
    }
    function show(){ pal.style.display="flex"; input.value=""; render(""); setTimeout(()=>input.focus(),10); }
    function hide(){ pal.style.display="none"; }

    document.addEventListener("keydown", (e)=>{
      if(e.ctrlKey && e.key.toLowerCase()==="k"){ e.preventDefault(); show(); }
      if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==="i"){ e.preventDefault(); fetch("http://127.0.0.1:8000/ragpro/index",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}); }
      if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==="g"){ e.preventDefault(); document.querySelector("#git-panel details")?.setAttribute("open","true"); document.getElementById("git-panel")?.scrollIntoView({behavior:"smooth"}); }
      if(e.key==="F1"){ e.preventDefault(); document.querySelector("#providers-panel details")?.setAttribute("open","true"); }
      if(e.ctrlKey && e.key==='`'){ e.preventDefault(); document.getElementById("terminal-panel")?.classList.toggle("hidden"); }
      if(e.key==="Escape"){ hide(); }
    });
    input.addEventListener("input", ()=>render(input.value));
  }
})();

export default AgentPanel