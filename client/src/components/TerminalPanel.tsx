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
      fontSize: 12,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9'
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

  return <div ref={containerRef} className="h-full w-full bg-black text-white" />;
};

export default TerminalPanel;