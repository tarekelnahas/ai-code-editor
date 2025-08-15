import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import 'xterm/css/xterm.css';
import { colors, spacing, typography, borderRadius } from '../design/theme';
import { buttonStyles } from '../design/components';

interface TerminalPanelProps {
  height: number;
  onResize: (height: number) => void;
}

/**
 * Context 7 Rebuilt Terminal Component
 * 
 * Features:
 * - Multiple terminal tabs support
 * - Enhanced xterm.js with addons
 * - Resizable terminal panel
 * - Command history and search
 * - Terminal themes and customization
 * - Copy/paste with keyboard shortcuts
 * - Link detection and clicking
 * - Unicode support for international text
 * - Performance optimizations
 */
const TerminalPanel: React.FC<TerminalPanelProps> = ({ height, onResize }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal>();
  const fitAddonRef = useRef<FitAddon>();
  const searchAddonRef = useRef<SearchAddon>();

  const [terminals, setTerminals] = useState<Array<{
    id: string;
    name: string;
    terminal: Terminal;
    isActive: boolean;
  }>>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('');
  const [isResizing, setIsResizing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [terminalTheme, setTerminalTheme] = useState<'dark' | 'light' | 'custom'>('dark');

  // Enhanced terminal themes
  const themes = {
    dark: {
      background: colors.editor.background,
      foreground: colors.dark.text,
      cursor: colors.primary[500],
      selection: colors.editor.selection,
      black: '#000000',
      red: '#ff6b6b',
      green: '#51cf66',
      yellow: '#ffd43b',
      blue: '#339af0',
      magenta: '#e599f7',
      cyan: '#3bc9db',
      white: '#ffffff',
      brightBlack: '#495057',
      brightRed: '#ff8787',
      brightGreen: '#69db7c',
      brightYellow: '#ffec99',
      brightBlue: '#74c0fc',
      brightMagenta: '#f3d2ff',
      brightCyan: '#66d9ef',
      brightWhite: '#ffffff'
    },
    light: {
      background: '#ffffff',
      foreground: '#24292e',
      cursor: '#044289',
      selection: 'rgba(4, 66, 137, 0.3)',
      black: '#24292e',
      red: '#d73a49',
      green: '#28a745',
      yellow: '#ffd33d',
      blue: '#0366d6',
      magenta: '#ea4aaa',
      cyan: '#17a2b8',
      white: '#ffffff',
      brightBlack: '#959da5',
      brightRed: '#cb2431',
      brightGreen: '#22863a',
      brightYellow: '#f9c513',
      brightBlue: '#0366d6',
      brightMagenta: '#ea4aaa',
      brightCyan: '#17a2b8',
      brightWhite: '#ffffff'
    }
  };

  // Create new terminal instance
  const createTerminal = useCallback((name: string = 'Terminal') => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: typography.fonts.mono,
      lineHeight: 1.4,
      letterSpacing: 0.5,
      theme: themes[terminalTheme],
      allowTransparency: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      fastScrollModifier: 'ctrl',
      scrollback: 10000,
      convertEol: true
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const unicodeAddon = new Unicode11Addon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(unicodeAddon);
    
    // Activate unicode support
    terminal.unicode.activeVersion = '11';

    const terminalId = Math.random().toString(36).substr(2, 9);
    
    setTerminals(prev => [...prev, {
      id: terminalId,
      name,
      terminal,
      isActive: prev.length === 0
    }]);

    if (terminals.length === 0) {
      setActiveTerminalId(terminalId);
      termRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;
    }

    return { terminal, terminalId, fitAddon, searchAddon };
  }, [terminalTheme, terminals.length]);

  // Initialize first terminal
  useEffect(() => {
    if (terminals.length === 0) {
      createTerminal('Terminal 1');
    }
  }, [createTerminal, terminals.length]);

  // Setup terminal when active terminal changes
  useEffect(() => {
    const activeTerminal = terminals.find(t => t.id === activeTerminalId);
    if (!activeTerminal || !containerRef.current) return;

    const terminal = activeTerminal.terminal;
    termRef.current = terminal;

    // Open terminal in container
    const terminalContainer = containerRef.current.querySelector('.terminal-content');
    if (terminalContainer) {
      terminal.open(terminalContainer as HTMLElement);

      // Fit terminal to container
      setTimeout(() => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch (error) {
            console.warn('Failed to fit terminal:', error);
          }
        }
      }, 100);

      // Setup terminal event handlers
      setupTerminalHandlers(terminal);
    }

    return () => {
      // Clean up when switching terminals
      terminal.dispose();
    };
  }, [activeTerminalId, terminals]);

  // Setup terminal event handlers
  const setupTerminalHandlers = useCallback((terminal: Terminal) => {
    // Electron API integration
    if (window.electronAPI) {
      window.electronAPI.invoke('term:start');

      const unsubscribe = window.electronAPI.on('term:data', (data: string) => {
        terminal.write(data);
      });

      terminal.onData(data => {
        window.electronAPI.invoke('term:input', data);
      });

      return () => {
        unsubscribe();
        window.electronAPI.invoke('term:dispose');
      };
    }

    // Fallback for non-Electron environments
    terminal.writeln('Welcome to AI Code Editor Terminal');
    terminal.writeln('This is a simulated terminal environment.');
    terminal.write('$ ');

    terminal.onData(data => {
      if (data === '\r') {
        terminal.writeln('');
        terminal.write('$ ');
      } else if (data === '\u007f') { // Backspace
        terminal.write('\b \b');
      } else {
        terminal.write(data);
      }
    });
  }, []);

  // Resize handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
      onResize(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, onResize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            createTerminal(`Terminal ${terminals.length + 1}`);
            break;
          case 'w':
            if (terminals.length > 1) {
              e.preventDefault();
              closeTerminal(activeTerminalId);
            }
            break;
          case 'f':
            if (e.shiftKey) {
              e.preventDefault();
              setShowSearch(!showSearch);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTerminalId, terminals.length, showSearch, createTerminal]);

  // Close terminal
  const closeTerminal = useCallback((terminalId: string) => {
    setTerminals(prev => {
      const filtered = prev.filter(t => t.id !== terminalId);
      if (filtered.length > 0 && terminalId === activeTerminalId) {
        setActiveTerminalId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeTerminalId]);

  // Switch terminal
  const switchTerminal = useCallback((terminalId: string) => {
    setActiveTerminalId(terminalId);
  }, []);

  // Search in terminal
  const handleSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next') => {
    if (searchAddonRef.current && query) {
      if (direction === 'next') {
        searchAddonRef.current.findNext(query);
      } else {
        searchAddonRef.current.findPrevious(query);
      }
    }
  }, []);

  // Render terminal header
  const renderHeader = () => (
    <div style={{
      height: '48px',
      background: colors.dark.elevated,
      borderBottom: `1px solid ${colors.dark.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${spacing[4]}`
    }}>
      {/* Terminal tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
        {terminals.map((term) => (
          <button
            key={term.id}
            onClick={() => switchTerminal(term.id)}
            style={{
              ...buttonStyles.base,
              ...(term.id === activeTerminalId ? buttonStyles.primary : buttonStyles.ghost),
              padding: `${spacing[2]} ${spacing[3]}`,
              fontSize: typography.sizes.sm,
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2]
            }}
          >
            <span>💻</span>
            <span>{term.name}</span>
            {terminals.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(term.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '2px',
                  marginLeft: spacing[1]
                }}
              >
                ×
              </button>
            )}
          </button>
        ))}

        <button
          onClick={() => createTerminal(`Terminal ${terminals.length + 1}`)}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            padding: spacing[2],
            fontSize: typography.sizes.lg
          }}
          title="New Terminal (Ctrl+T)"
        >
          +
        </button>
      </div>

      {/* Terminal controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <button
          onClick={() => setShowSearch(!showSearch)}
          style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            padding: spacing[2]
          }}
          title="Search (Ctrl+Shift+F)"
        >
          🔍
        </button>

        <select
          value={terminalTheme}
          onChange={(e) => setTerminalTheme(e.target.value as any)}
          style={{
            background: colors.dark.surface,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: borderRadius.md,
            color: colors.dark.text,
            fontSize: typography.sizes.sm,
            padding: `${spacing[1]} ${spacing[2]}`
          }}
        >
          <option value="dark">Dark Theme</option>
          <option value="light">Light Theme</option>
        </select>

        <button
          style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            padding: spacing[2],
            fontSize: '12px'
          }}
          title="Terminal is running"
        >
          <span style={{ color: colors.success }}>● Active</span>
        </button>
      </div>
    </div>
  );

  // Render search bar
  const renderSearchBar = () => showSearch && (
    <div style={{
      height: '40px',
      background: colors.dark.surface,
      borderBottom: `1px solid ${colors.dark.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${spacing[4]}`,
      gap: spacing[2]
    }}>
      <input
        type="text"
        placeholder="Search in terminal..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSearch(searchQuery, e.shiftKey ? 'prev' : 'next');
          }
        }}
        style={{
          flex: 1,
          background: colors.dark.elevated,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: borderRadius.md,
          color: colors.dark.text,
          fontSize: typography.sizes.sm,
          padding: `${spacing[2]} ${spacing[3]}`,
          outline: 'none'
        }}
        autoFocus
      />
      
      <button
        onClick={() => handleSearch(searchQuery, 'prev')}
        style={{
          ...buttonStyles.base,
          ...buttonStyles.ghost,
          padding: spacing[2]
        }}
        title="Previous (Shift+Enter)"
      >
        ↑
      </button>
      
      <button
        onClick={() => handleSearch(searchQuery, 'next')}
        style={{
          ...buttonStyles.base,
          ...buttonStyles.ghost,
          padding: spacing[2]
        }}
        title="Next (Enter)"
      >
        ↓
      </button>
      
      <button
        onClick={() => setShowSearch(false)}
        style={{
          ...buttonStyles.base,
          ...buttonStyles.ghost,
          padding: spacing[2]
        }}
      >
        ×
      </button>
    </div>
  );

  return (
    <div style={{
      height: `${height}px`,
      display: 'flex',
      flexDirection: 'column',
      background: colors.dark.surface,
      position: 'relative'
    }}>
      {/* Resize handle */}
      <div
        ref={resizerRef}
        onMouseDown={handleMouseDown}
        style={{
          height: '4px',
          background: isResizing ? colors.primary[500] : colors.dark.border,
          cursor: 'ns-resize',
          transition: 'background 150ms ease',
          position: 'relative'
        }}
      >
        <div style={{
          position: 'absolute',
          top: '-2px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40px',
          height: '8px',
          background: colors.dark.textMuted,
          borderRadius: borderRadius.full,
          opacity: isResizing ? 1 : 0.5
        }} />
      </div>

      {renderHeader()}
      {renderSearchBar()}

      {/* Terminal content */}
      <div 
        className="terminal-content"
        style={{
          flex: 1,
          background: themes[terminalTheme].background,
          position: 'relative'
        }}
      />
    </div>
  );
};

export default TerminalPanel;