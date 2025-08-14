import React from "react";
export default function TopBar({ onRun }: { onRun?: () => void }) {
  return (
    <div style={{
      display: "flex", 
      alignItems: "center", 
      height: "35px",
      padding: "0 16px", 
      borderBottom: "1px solid var(--border)", 
      background: "var(--bg-secondary)",
      gap: "12px"
    }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px",
        flex: 1 
      }}>
        <input 
          placeholder="Search files (Ctrl+P)" 
          style={{ 
            flex: 1, 
            maxWidth: '280px',
            height: '24px',
            fontSize: '13px'
          }} 
        />
      </div>
      
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px" 
      }}>
        <select 
          title="AI Model" 
          style={{ 
            minWidth: '140px',
            height: '24px',
            fontSize: '12px'
          }}
        >
          <option>GPT-4o Mini</option>
          <option>Claude 3.5</option>
          <option>Llama 3</option>
        </select>
        
        <button 
          className="btn" 
          onClick={onRun}
          style={{ 
            height: '24px',
            padding: '0 12px',
            fontSize: '12px'
          }}
        >
          ▶ Run
        </button>
        
        <div className="badge">
          <span style={{ color: 'var(--text-muted)' }}>WS:</span> 
          <span id="ws-state" style={{ color: 'var(--success)', fontWeight: 600 }}>●</span>
        </div>
      </div>
    </div>
  );
}