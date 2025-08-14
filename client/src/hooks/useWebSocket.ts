import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A small React hook for interacting with WebSocket servers. It connects
 * automatically when mounted and attempts to reconnect on drop. Messages
 * received are parsed as JSON and accumulated in state. Callers can
 * optionally send typed payloads.
 */
export function useWebSocket<TOut = any, TIn = any>(url: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<TOut[]>([]);

  const connect = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.CONNECTING) {
      return; // Prevent multiple connection attempts
    }
    
    const ws = new WebSocket(url);
    socketRef.current = ws;
    
    ws.onopen = () => setReady(true);
    ws.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data) as TOut;
        setMessages(prev => [...prev, parsed]);
      } catch (e) {
        // For non‑JSON messages just push the raw string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMessages(prev => [...prev, event.data as any]);
      }
    };
    ws.onclose = (event) => {
      setReady(false);
      // Only attempt to reconnect if not closed intentionally
      if (!event.wasClean) {
        setTimeout(connect, 2000);
      }
    };
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Don't immediately close on error - let onclose handle it
    };
  };

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting');
      }
    };
    // We intentionally omit url from dependencies because reconnection
    // logic relies on stale closure values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    (message: TIn) => {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    []
  );

  return { ready, send, messages };
}