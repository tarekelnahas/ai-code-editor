import React, { useState, useEffect } from "react";

export default function StatusBar({ mem="~1.2GB", cpu="18%", branch="main", provider="local" }) {
  const [status, setStatus] = useState({ device: 'cpu', seed: 0 });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/system/status');
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch system status:', error);
      }
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: "28px",
      padding: "0 16px",
      borderTop: "1px solid #3c3c3c",
      background: "#007acc",
      color: "#ffffff",
      fontSize: "11px",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontWeight: 500
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>🌿</span>
          <span>Branch: <strong>{branch}</strong></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>🤖</span>
          <span>AI: <strong>{provider}</strong></span>
          <span style={{ opacity: 0.8 }}>|</span>
          <span>Device: <strong>{status.device.toUpperCase()}</strong></span>
          <span style={{ opacity: 0.8 }}>|</span>
          <span>Seed: <strong>{status.seed}</strong></span>
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>📊</span>
          <span>CPU: <strong>{cpu}</strong></span>
          <span style={{ opacity: 0.8 }}>|</span>
          <span>RAM: <strong>{mem}</strong></span>
        </div>
        <div style={{ 
          cursor: "pointer",
          padding: "2px 8px",
          borderRadius: "4px",
          background: "rgba(255, 255, 255, 0.1)",
          transition: "background 0.15s ease"
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}>
          📋 Logs ▸
        </div>
      </div>
    </div>
  );
}