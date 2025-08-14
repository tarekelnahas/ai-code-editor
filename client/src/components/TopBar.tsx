import React, { useState, useEffect } from "react";

export default function TopBar({ onRun }: { onRun?: () => void }) {
  const [currentModel, setCurrentModel] = useState('TinyLLaMA');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    // Fetch current AI model
    fetch('http://127.0.0.1:8000/ai/meta')
      .then(res => res.json())
      .then(data => {
        if (data.available && data.available.length > 0) {
          setCurrentModel(data.available[0]);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{
      display: "flex", 
      alignItems: "center", 
      height: "48px",
      padding: "0 20px", 
      borderBottom: "1px solid #3c3c3c", 
      background: "linear-gradient(90deg, #2d2d30 0%, #252526 100%)",
      gap: "16px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
    }}>
      {/* Left side - Logo and Search */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "16px",
        flex: 1 
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#007acc",
          fontWeight: 600,
          fontSize: "14px"
        }}>
          <span style={{fontSize: "18px"}}>⚡</span>
          AI Code Editor
        </div>
        
        <input 
          placeholder="🔍 Search files, commands... (Ctrl+P)" 
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          style={{ 
            flex: 1, 
            maxWidth: '340px',
            height: '32px',
            fontSize: '13px',
            background: "#1e1e1e",
            border: "1px solid #484848",
            borderRadius: "6px",
            padding: "0 12px",
            color: "#cccccc",
            outline: "none",
            transition: "all 0.15s ease"
          }}
          onFocus={(e) => e.target.style.borderColor = "#007acc"}
          onBlur={(e) => e.target.style.borderColor = "#484848"}
        />
      </div>
      
      {/* Right side - Controls */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "12px" 
      }}>
        <select 
          title="Current AI Model" 
          value={currentModel}
          onChange={(e) => setCurrentModel(e.target.value)}
          style={{ 
            minWidth: '160px',
            height: '32px',
            fontSize: '13px',
            background: "#1e1e1e",
            border: "1px solid #484848",
            borderRadius: "6px",
            color: "#cccccc",
            padding: "0 8px"
          }}
        >
          <option value="tinyllama:latest">TinyLLaMA (Local)</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
          <option value="llama-3.2">Llama 3.2</option>
        </select>
        
        <button 
          onClick={onRun}
          style={{ 
            height: '32px',
            padding: '0 16px',
            fontSize: '13px',
            fontWeight: 600,
            background: "linear-gradient(135deg, #007acc, #005a9e)",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: "0 2px 4px rgba(0, 122, 204, 0.3)"
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
        >
          ▶ Run Project
        </button>
        
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px",
          background: "rgba(76, 175, 80, 0.1)",
          border: "1px solid rgba(76, 175, 80, 0.3)",
          borderRadius: "4px",
          fontSize: "11px"
        }}>
          <span style={{ color: '#888' }}>Status:</span> 
          <span style={{ color: '#4caf50', fontWeight: 600 }}>● Online</span>
        </div>
        
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          background: "rgba(0, 122, 204, 0.1)",
          border: "1px solid rgba(0, 122, 204, 0.3)",
          borderRadius: "4px",
          fontSize: "11px",
          color: "#007acc"
        }}>
          <span>🤖</span>
          <span>AI Ready</span>
        </div>
      </div>
    </div>
  );
}