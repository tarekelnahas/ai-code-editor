$ErrorActionPreference='SilentlyContinue'
$root = 'F:\ai_code_editor'
cd $root
Write-Host "PWD:" (Get-Location)

function ApiTags { try { Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 5 } catch { $null } }
$tags = ApiTags
$avail = @()
if ($tags -and $tags.models) { $avail = $tags.models | ForEach-Object { $_.name } }
Write-Host ("AVAILABLE_MODELS: " + ($avail -join ", "))

function Has([string]$n){ return $avail -contains $n }
$completion = if (Has 'deepseek-coder:latest') { 'deepseek-coder:latest' } elseif (Has 'codegemma:2b') { 'codegemma:2b' } else { ($avail | Select-Object -First 1) }
$general    = if (Has 'dolphin-phi:latest') { 'dolphin-phi:latest' } elseif (Has 'smollm:1.7b') { 'smollm:1.7b' } else { $completion }
$planner    = if (Has 'smollm:1.7b') { 'smollm:1.7b' } elseif (Has 'dolphin-phi:latest') { 'dolphin-phi:latest' } else { $general }

$cfgPath = Join-Path $env:LOCALAPPDATA 'AIEditor\config.json'
if (Test-Path $cfgPath) { Copy-Item $cfgPath ($cfgPath + '.bak') -Force }
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
if (-not $cfg.ai) { $cfg | Add-Member -NotePropertyName ai -NotePropertyValue (@{}) }
if (-not $cfg.ai.roles) { $cfg.ai.roles = @{} }
$cfg.ai.roles.completion = $completion
$cfg.ai.roles.general    = $general
$cfg.ai.roles.planner    = $planner
$cfg.ai.maxContextTokens = 2048
$cfg.ai.temperature = 0.15
$cfg.limits.aiConcurrency = 1
$cfg | ConvertTo-Json -Depth 6 | Out-File -FilePath $cfgPath -Encoding UTF8
Write-Host ("CONFIG_ROLES_UPDATED -> completion="+$completion+" | general="+$general+" | planner="+$planner)

$agent = Get-ChildItem -Path "$root\client" -Recurse -Include AgentPanel.tsx,*.tsx | Where-Object {
  Select-String -Path $_.FullName -Pattern "Ask the agent" -Quiet
} | Select-Object -First 1

if (-not $agent) { Write-Host "AGENT_PANEL_NOT_FOUND"; exit 0 }
Copy-Item $agent.FullName ($agent.FullName + ".metrics.bak") -Force
$code = Get-Content $agent.FullName -Raw

if ($code -notmatch "/* AI_METRICS_START */") {
  $metrics = @'
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

async function aiCompleteRest(prompt, role="general"){
  const res = await fetch("http://127.0.0.1:8000/ai/complete", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ prompt, role })
  });
  if(!res.ok) throw new Error("AI REST failed: "+res.status);
  return await res.json();
}

function openAiWs(prompt, role="general", onDelta, onStart, onEnd, onError){
  try{
    if(__ai_ws){ try{__ai_ws.close();}catch(e){} __ai_ws=null; }
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/ai");
    __ai_ws = ws;
    ws.onopen = ()=>{ onStart && onStart(); ws.send(JSON.stringify({ prompt, role })); };
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
'@
  $code = $metrics + "`n" + $code
}

if ($code -notmatch "id=`"agent-status`"") {
  $addon = @'
(function ensureAgentUI(){
  if(document.getElementById("agent-status")) return;
  const root = document.createElement("div");
  root.id = "agent-metrics";
  root.style="margin-top:8px;padding:8px;border:1px solid #333;border-radius:8px;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#111;color:#ddd";
  root.innerHTML = `
    <div id="agent-status" style="font-size:12px;opacity:.9;margin-bottom:6px;">Model: — | TTFT: — | Rate: — | Total: 0</div>
    <div id="agent-output" style="white-space:pre-wrap;min-height:88px;line-height:1.45;border:1px dashed #444;padding:8px;border-radius:6px;background:#0b0b0b;"></div>
    <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
      <button id="btn-ws" style="padding:6px 10px;border-radius:6px;">WS</button>
      <button id="btn-cancel" style="padding:6px 10px;border-radius:6px;">Cancel</button>
      <button id="btn-copy" style="padding:6px 10px;border-radius:6px;">Copy</button>
      <button id="btn-save" style="padding:6px 10px;border-radius:6px;">Save</button>
      <button id="btn-clear" style="padding:6px 10px;border-radius:6px;">Clear</button>
    </div>
  `;
  const host = document.body || document.documentElement;
  host.appendChild(root);

  const out = root.querySelector("#agent-output");
  const input = document.querySelector("input[placeholder*=Ask the agent]") || document.querySelector("textarea[placeholder*=Ask the agent]");
  const btnWs = root.querySelector("#btn-ws");
  const btnCancel = root.querySelector("#btn-cancel");
  const btnCopy = root.querySelector("#btn-copy");
  const btnSave = root.querySelector("#btn-save");
  const btnClear = root.querySelector("#btn-clear");

  function append(txt){ out.textContent = (out.textContent||"") + txt; }

  btnWs.addEventListener("click", async ()=> {
    if(!input) return alert("Agent input not found");
    const prompt = input.value.trim(); if(!prompt) return;
    out.textContent = ""; aiResetMetrics();
    openAiWs(prompt, "general",
      (tok)=>{ aiOnDelta(tok); append(tok); },
      (model)=>{ aiOnStart(model); },
      ()=>{ aiOnEnd(); },
      (err)=>{ alert("WS error: "+err); }
    );
  });
  btnCancel.addEventListener("click", ()=> { cancelAiWs(); aiOnEnd(); });
  btnCopy.addEventListener("click", ()=> { navigator.clipboard.writeText(out.textContent||""); });
  btnSave.addEventListener("click", ()=> {
    try{
      const key="agentHistory";
      const prev = JSON.parse(localStorage.getItem(key)||"[]");
      prev.push({ ts: new Date().toISOString(), model: __ai_model, ttft_ms: __ai_ttft, text: out.textContent||"" });
      localStorage.setItem(key, JSON.stringify(prev).slice(0, 1_000_000));
      alert("Saved to localStorage (agentHistory)");
    }catch(e){ alert("Save failed: "+e); }
  });
  btnClear.addEventListener("click", ()=> { out.textContent=""; aiResetMetrics(); });
})();
'@
  $code = $code + "`n" + $addon
}

$code | Set-Content -Path $agent.FullName -Encoding UTF8
Write-Host ("AGENT_PANEL_PATCHED -> " + $agent.FullName)