import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

/**
 * TerminalPanel integrates a simple pseudo‑terminal into the application.
 * The main process spawns a shell on demand and streams stdout/stderr
 * back to this component via IPC. Keyboard input is forwarded to the
 * shell. Only one terminal session is supported at a time.
 */
const TerminalPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal>();
  const fitAddonRef = useRef<FitAddon>();

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
      theme: {
        background: '#181818',
        foreground: '#cccccc',
        cursor: '#007acc',
        selection: 'rgba(0, 122, 204, 0.3)',
        black: '#000000',
        red: '#f44336',
        green: '#4caf50',
        yellow: '#ff9800',
        blue: '#2196f3',
        magenta: '#9c27b0',
        cyan: '#00bcd4',
        white: '#ffffff',
        brightBlack: '#666666',
        brightRed: '#ff5722',
        brightGreen: '#8bc34a',
        brightYellow: '#ffc107',
        brightBlue: '#03a9f4',
        brightMagenta: '#e91e63',
        brightCyan: '#00e5ff',
        brightWhite: '#ffffff'
      }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    
    // Wait for the terminal to be properly rendered before fitting
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          try {
            fitAddon.fit();
          } catch (error) {
            console.warn('Initial fit failed:', error);
          }
        }
      }, 100); // Slightly longer delay to ensure layout is stable
    });
    
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // When the component mounts, start the terminal session in the main
    // process. If it fails the UI will remain empty.
    window.electronAPI.invoke('term:start');

    // Listen for data from the main process and write it into xterm.
    const unsubscribe = window.electronAPI.on('term:data', (data: string) => {
      term.write(data);
    });

    // Forward user input to the shell. Without this the user cannot type.
    term.onData(data => {
      window.electronAPI.invoke('term:input', data);
    });

    // Resize the terminal when the container changes size. We debounce
    // resizing a little to avoid jitter. A ResizeObserver handles the
    // measurement. Note: older browsers may need a polyfill.
    const ro = new ResizeObserver(() => {
      // Debounce resize events
      clearTimeout(window.resizeTimer);
      window.resizeTimer = setTimeout(() => {
        if (fitAddon && containerRef.current && containerRef.current.offsetWidth > 0 && containerRef.current.offsetHeight > 0) {
          try {
            fitAddon.fit();
          } catch (error) {
            console.warn('Failed to fit terminal:', error);
          }
        }
      }, 50);
    });
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    return () => {
      unsubscribe();
      window.electronAPI.invoke('term:dispose');
      ro.disconnect();
      clearTimeout(window.resizeTimer);
      term.dispose();
    };
  }, []);

  return (
    <div style={{
      height: '100%',
      width: '100%',
      background: '#181818',
      position: 'relative'
    }}>
      <div style={{
        height: '32px',
        borderBottom: '1px solid #3c3c3c',
        background: '#2d2d30',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: '13px',
        color: '#cccccc',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        gap: '8px'
      }}>
        <span style={{ fontSize: '14px' }}>💻</span>
        <span style={{ fontWeight: 500 }}>Terminal</span>
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            fontSize: '10px',
            background: 'rgba(76, 175, 80, 0.2)',
            color: '#4caf50',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            ● Active
          </div>
        </div>
      </div>
      <div 
        ref={containerRef} 
        style={{
          height: 'calc(100% - 32px)',
          width: '100%',
          background: '#181818'
        }}
      />
    </div>
  );
};

export default TerminalPanel;