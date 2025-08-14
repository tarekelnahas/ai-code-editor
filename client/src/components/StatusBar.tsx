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
    <div className="flex gap-4 justify-between py-1.5 px-2.5 border-t border-gray-800 bg-gray-950 text-xs">
      <div>Branch: <b className="font-bold">{branch}</b></div>
      <div>AI: <b className="font-bold">{provider}</b> | Device: <b className="font-bold">{status.device.toUpperCase()}</b> | Seed: <b className="font-bold">{status.seed}</b></div>
      <div>CPU: <b className="font-bold">{cpu}</b> | RAM: <b className="font-bold">{mem}</b></div>
      <div>Logs ▸</div>
    </div>
  );
}