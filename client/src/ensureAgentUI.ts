// Ensure standalone agent UI exists (for non-React fallback)
(function ensureAgentUI(){
  if(document.getElementById("agent-status")) return;
  const root = document.createElement("div");
  root.id = "agent-metrics";
  root.style="margin-top:8px;padding:8px;border:1px solid #333;border-radius:8px;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#111;color:#ddd";
  root.innerHTML = `
    <div id="agent-status" style="font-size:12px;opacity:.9;margin-bottom:6px;">Model: — | TTFT: — | Rate: — | Total: 0</div>
    <div style="margin-bottom:6px;display:flex;gap:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:80px">
        <label style="font-size:10px;color:#aaa">Role:</label>
        <select id="agent-role" style="width:100%;padding:2px;font-size:10px;border-radius:3px;background:#222;color:#ddd">
          <option>general</option><option>completion</option><option>planner</option>
        </select>
      </div>
      <div style="flex:1;min-width:80px">
        <label style="font-size:10px;color:#aaa">Model:</label>
        <select id="agent-model" style="width:100%;padding:2px;font-size:10px;border-radius:3px;background:#222;color:#ddd">
          <option value="">Auto-select</option>
          <option>deepseek-coder:latest</option>
          <option>dolphin-phi:latest</option>
          <option>smollm:1.7b</option>
        </select>
      </div>
    </div>
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
    const role = (document.querySelector('#agent-role') as HTMLSelectElement)?.value || 'general';
    const model = (document.querySelector('#agent-model') as HTMLSelectElement)?.value || undefined;
    out.textContent = ""; aiResetMetrics();
    openAiWs(prompt, role, model,
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