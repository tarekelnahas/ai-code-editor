import React, { useState, useEffect, useRef } from "react";
import { colors, spacing, typography, borderRadius, shadows } from '../design/theme';
import { buttonStyles, inputStyles } from '../design/components';

interface TopBarProps {
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onToggleRightPanel: () => void;
  openFiles: string[];
  activeFile: string | null;
  unsavedChanges: Set<string>;
  onSwitchFile: (filePath: string) => void;
}

/**
 * Context 7 Rebuilt TopBar Component
 * 
 * Features:
 * - Responsive layout with collapsible sections
 * - Keyboard navigation support
 * - File tabs with unsaved indicators
 * - Command palette integration
 * - AI model status and controls
 * - Accessibility compliant
 */
export default function TopBar({
  onToggleSidebar,
  onToggleTerminal,
  onToggleRightPanel,
  openFiles,
  activeFile,
  unsavedChanges,
  onSwitchFile
}: TopBarProps) {
  const [currentModel, setCurrentModel] = useState('TinyLLaMA');
  const [searchValue, setSearchValue] = useState('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch AI model and status
  useEffect(() => {
    const fetchAIStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/ai/meta');
        if (response.ok) {
          const data = await response.json();
          if (data.available && data.available.length > 0) {
            setCurrentModel(data.available[0]);
            setAiStatus('online');
          }
        } else {
          setAiStatus('offline');
        }
      } catch (error) {
        setAiStatus('offline');
      }
    };

    fetchAIStatus();
    const interval = setInterval(fetchAIStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        searchInputRef.current?.focus();
      }
      
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
        setSearchValue('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  // Main TopBar container styles
  const topBarStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: '56px',
    padding: `0 ${spacing[6]}`,
    borderBottom: `1px solid ${colors.dark.border}`,
    background: `linear-gradient(135deg, ${colors.dark.surface} 0%, ${colors.dark.elevated} 100%)`,
    backdropFilter: 'blur(10px)',
    gap: spacing[4],
    position: 'relative',
    zIndex: 100
  };

  // File tabs container
  const fileTabsStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
    flex: 1,
    minWidth: 0,
    overflow: 'hidden'
  };

  // Individual file tab styles
  const getFileTabStyles = (filePath: string, isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    borderRadius: borderRadius.md,
    fontSize: typography.sizes.sm,
    fontWeight: isActive ? typography.weights.semibold : typography.weights.normal,
    background: isActive ? colors.primary[500] : 'transparent',
    color: isActive ? colors.neutral[0] : colors.dark.textSecondary,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    border: `1px solid ${isActive ? colors.primary[500] : 'transparent'}`,
    maxWidth: '200px',
    position: 'relative',

    ':hover': {
      background: isActive ? colors.primary[600] : colors.dark.elevated,
      color: colors.dark.text
    }
  });

  // Control buttons section
  const controlsStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3]
  };

  // Status indicator styles
  const getStatusStyles = (status: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[1]} ${spacing[3]}`,
    borderRadius: borderRadius.full,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    background: status === 'online' 
      ? `${colors.success}20` 
      : status === 'offline' 
        ? `${colors.error}20` 
        : `${colors.warning}20`,
    color: status === 'online' 
      ? colors.success 
      : status === 'offline' 
        ? colors.error 
        : colors.warning,
    border: `1px solid ${status === 'online' 
      ? `${colors.success}40` 
      : status === 'offline' 
        ? `${colors.error}40` 
        : `${colors.warning}40`}`
  });

  return (
    <header 
      style={topBarStyles}
      role="banner"
      aria-label="Application header"
    >
      {/* Left Section: Logo and Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[4] }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          color: colors.primary[400],
          fontWeight: typography.weights.bold,
          fontSize: typography.sizes.lg,
          fontFamily: typography.fonts.display
        }}>
          <span style={{ fontSize: '24px' }}>⚡</span>
          <span>AI Code Editor</span>
        </div>

        {/* Layout Toggle Buttons */}
        <div style={{ display: 'flex', gap: spacing[1] }}>
          <button
            onClick={onToggleSidebar}
            style={{
              ...buttonStyles.base,
              ...buttonStyles.ghost,
              padding: spacing[2],
              width: '32px',
              height: '32px'
            }}
            title="Toggle Sidebar (Ctrl+B)"
            aria-label="Toggle file explorer sidebar"
          >
            📁
          </button>
          <button
            onClick={onToggleTerminal}
            style={{
              ...buttonStyles.base,
              ...buttonStyles.ghost,
              padding: spacing[2],
              width: '32px',
              height: '32px'
            }}
            title="Toggle Terminal (Ctrl+J)"
            aria-label="Toggle terminal panel"
          >
            💻
          </button>
          <button
            onClick={onToggleRightPanel}
            style={{
              ...buttonStyles.base,
              ...buttonStyles.ghost,
              padding: spacing[2],
              width: '32px',
              height: '32px'
            }}
            title="Toggle AI Panel (Ctrl+\\)"
            aria-label="Toggle AI tools panel"
          >
            🤖
          </button>
        </div>
      </div>

      {/* Center Section: File Tabs */}
      <div style={fileTabsStyles}>
        {openFiles.map((filePath) => (
          <div
            key={filePath}
            style={getFileTabStyles(filePath, filePath === activeFile)}
            onClick={() => onSwitchFile(filePath)}
            role="tab"
            aria-selected={filePath === activeFile}
            tabIndex={0}
          >
            <span style={{ fontSize: '14px' }}>
              {getFileIcon(filePath)}
            </span>
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {filePath.split('/').pop()}
            </span>
            {unsavedChanges.has(filePath) && (
              <span style={{
                color: colors.warning,
                fontSize: '12px',
                fontWeight: typography.weights.bold
              }}>
                ●
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Right Section: Search, Controls, and Status */}
      <div style={controlsStyles}>
        {/* Command Palette / Search */}
        <div style={{ position: 'relative' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search files, commands... (Ctrl+P)"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{
              ...inputStyles.base,
              width: '280px',
              fontSize: typography.sizes.sm,
              padding: `${spacing[2]} ${spacing[10]} ${spacing[2]} ${spacing[4]}`
            }}
            onFocus={() => setIsCommandPaletteOpen(true)}
            aria-label="Search files and commands"
          />
          <span style={{
            position: 'absolute',
            right: spacing[3],
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.dark.textMuted,
            fontSize: typography.sizes.xs,
            background: colors.dark.elevated,
            padding: `${spacing[1]} ${spacing[2]}`,
            borderRadius: borderRadius.sm,
            border: `1px solid ${colors.dark.border}`
          }}>
            ⌘P
          </span>
        </div>

        {/* AI Model Selector */}
        <select
          value={currentModel}
          onChange={(e) => setCurrentModel(e.target.value)}
          style={{
            ...inputStyles.base,
            width: '180px',
            fontSize: typography.sizes.sm
          }}
          aria-label="Select AI model"
        >
          <option value="tinyllama:latest">TinyLLaMA (Local)</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
          <option value="llama-3.2">Llama 3.2</option>
        </select>

        {/* AI Status Indicator */}
        <div style={getStatusStyles(aiStatus)}>
          <span>
            {aiStatus === 'online' ? '●' : aiStatus === 'offline' ? '○' : '◐'}
          </span>
          <span>
            {aiStatus === 'online' ? 'AI Ready' : aiStatus === 'offline' ? 'AI Offline' : 'Connecting...'}
          </span>
        </div>

        {/* Run Project Button */}
        <button
          style={{
            ...buttonStyles.base,
            ...buttonStyles.primary,
            gap: spacing[2]
          }}
          aria-label="Run project"
        >
          <span>▶</span>
          <span>Run</span>
        </button>
      </div>
    </header>
  );
}

// Helper function for file icons
function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': return '🟨';
    case 'ts': case 'tsx': return '🔷';
    case 'css': case 'scss': case 'less': return '🎨';
    case 'html': case 'htm': return '🌐';
    case 'json': return '📋';
    case 'md': case 'mdx': return '📝';
    case 'py': return '🐍';
    case 'rs': return '🦀';
    case 'go': return '🐹';
    case 'java': return '☕';
    case 'cpp': case 'c': case 'h': return '⚙️';
    case 'php': return '🐘';
    case 'rb': return '💎';
    case 'swift': return '🦉';
    case 'kt': return '🎯';
    default: return '📄';
  }
}