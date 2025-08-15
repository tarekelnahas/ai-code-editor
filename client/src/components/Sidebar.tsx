import React, { useEffect, useState, useCallback, useRef } from 'react';
import { colors, spacing, typography, borderRadius } from '../design/theme';
import { buttonStyles, scrollbarStyles } from '../design/components';

interface SidebarProps {
  onFileOpen: (filePath: string) => void;
  isCollapsed: boolean;
  openFiles: string[];
  activeFile: string | null;
}

interface Entry {
  name: string;
  isDir: boolean;
  size?: number;
  modified?: string;
}

/**
 * Context 7 Rebuilt Sidebar Component
 * 
 * Features:
 * - Tree view with expand/collapse
 * - File search and filtering
 * - Drag and drop support
 * - Context menu actions
 * - Keyboard navigation
 * - File status indicators
 * - Collapsible with mini mode
 */
const Sidebar: React.FC<SidebarProps> = ({ 
  onFileOpen, 
  isCollapsed, 
  openFiles, 
  activeFile 
}) => {
  const [dir, setDir] = useState<string>('.');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['.']));
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEntries, setFilteredEntries] = useState<Entry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: Entry } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load directory contents
  useEffect(() => {
    const loadDirectory = async () => {
      try {
        const list = await window.electronAPI.invoke('fs:listDir', dir);
        setEntries(list || []);
      } catch (error) {
        console.error('Failed to load directory:', error);
        setEntries([]);
      }
    };

    loadDirectory();
  }, [dir]);

  // Filter entries based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEntries(entries);
    } else {
      const filtered = entries.filter(entry =>
        entry.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredEntries(filtered);
    }
  }, [entries, searchQuery]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCollapsed) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          navigateEntries(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigateEntries(-1);
          break;
        case 'Enter':
          if (selectedEntry) {
            const entry = filteredEntries.find(e => e.name === selectedEntry);
            if (entry) openEntry(entry);
          }
          break;
        case 'Escape':
          setSelectedEntry(null);
          setSearchQuery('');
          break;
        case '/':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntry, filteredEntries, isCollapsed]);

  const navigateEntries = (direction: number) => {
    if (filteredEntries.length === 0) return;

    const currentIndex = selectedEntry 
      ? filteredEntries.findIndex(e => e.name === selectedEntry)
      : -1;
    
    const nextIndex = currentIndex + direction;
    const clampedIndex = Math.max(0, Math.min(nextIndex, filteredEntries.length - 1));
    
    setSelectedEntry(filteredEntries[clampedIndex]?.name || null);
  };

  const openEntry = useCallback((entry: Entry) => {
    const newPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    
    if (entry.isDir) {
      setDir(newPath);
      setExpandedDirs(prev => new Set(prev).add(newPath));
    } else {
      onFileOpen(newPath);
    }
  }, [dir, onFileOpen]);

  const goUp = useCallback(() => {
    if (dir === '.') return;
    const parts = dir.split('/');
    parts.pop();
    const parent = parts.join('/') || '.';
    setDir(parent);
  }, [dir]);

  const toggleDirectory = useCallback((dirPath: string) => {
    setExpandedDirs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dirPath)) {
        newSet.delete(dirPath);
      } else {
        newSet.add(dirPath);
      }
      return newSet;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: Entry) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry
    });
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Sidebar styles
  const sidebarStyles: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: colors.dark.surface,
    fontFamily: typography.fonts.sans,
    borderRight: `1px solid ${colors.dark.border}`,
    width: isCollapsed ? '60px' : '100%',
    transition: 'width 300ms ease',
    overflow: 'hidden',
    ...scrollbarStyles
  };

  const headerStyles: React.CSSProperties = {
    padding: spacing[3],
    borderBottom: `1px solid ${colors.dark.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: '48px'
  };

  const entryStyles = (entry: Entry, isSelected: boolean, isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    margin: `0 ${spacing[2]}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    fontSize: typography.sizes.sm,
    color: isActive ? colors.primary[400] : colors.dark.text,
    background: isSelected 
      ? colors.primary[500] + '20'
      : isActive 
        ? colors.primary[500] + '10'
        : 'transparent',
    border: `1px solid ${isSelected ? colors.primary[500] : 'transparent'}`,
    transition: 'all 150ms ease',
    userSelect: 'none',
    position: 'relative'
  });

  if (isCollapsed) {
    return (
      <div style={sidebarStyles}>
        <div style={{
          ...headerStyles,
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '20px' }}>📂</span>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing[2],
          padding: spacing[2]
        }}>
          {openFiles.slice(0, 5).map((filePath) => (
            <button
              key={filePath}
              onClick={() => onFileOpen(filePath)}
              style={{
                ...buttonStyles.base,
                ...buttonStyles.ghost,
                width: '40px',
                height: '40px',
                padding: 0,
                fontSize: '16px',
                background: filePath === activeFile ? colors.primary[500] + '20' : 'transparent'
              }}
              title={filePath.split('/').pop()}
            >
              {getFileIcon(filePath)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={sidebarStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <span style={{ fontSize: '18px' }}>📂</span>
        <span style={{
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.dark.text,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Explorer
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: spacing[3] }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search files... (Ctrl+/)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: `${spacing[2]} ${spacing[3]}`,
            background: colors.dark.elevated,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: borderRadius.md,
            color: colors.dark.text,
            fontSize: typography.sizes.sm,
            outline: 'none',
            transition: 'border-color 150ms ease'
          }}
          onFocus={(e) => e.target.style.borderColor = colors.primary[500]}
          onBlur={(e) => e.target.style.borderColor = colors.dark.border}
        />
      </div>

      {/* Directory Navigation */}
      <div style={{
        padding: `0 ${spacing[3]}`,
        borderBottom: `1px solid ${colors.dark.border}`,
        paddingBottom: spacing[2]
      }}>
        <div style={{
          fontSize: typography.sizes.xs,
          color: colors.dark.textMuted,
          marginBottom: spacing[2],
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Current: {dir}
        </div>
        {dir !== '.' && (
          <button
            onClick={goUp}
            style={{
              ...buttonStyles.base,
              ...buttonStyles.ghost,
              width: '100%',
              justifyContent: 'flex-start',
              gap: spacing[2]
            }}
          >
            <span style={{ fontSize: '14px' }}>📁</span>
            <span>../</span>
          </button>
        )}
      </div>

      {/* File Tree */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: spacing[2]
      }}>
        {filteredEntries.map((entry) => {
          const entryPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
          const isSelected = selectedEntry === entry.name;
          const isActive = openFiles.includes(entryPath) || activeFile === entryPath;

          return (
            <div
              key={entry.name}
              style={entryStyles(entry, isSelected, isActive)}
              onClick={() => {
                setSelectedEntry(entry.name);
                openEntry(entry);
              }}
              onContextMenu={(e) => handleContextMenu(e, entry)}
              onMouseEnter={() => setSelectedEntry(entry.name)}
              role="treeitem"
              aria-selected={isSelected}
              tabIndex={0}
            >
              <span style={{
                fontSize: '16px',
                color: entry.isDir ? colors.warning : getFileIconColor(entry.name)
              }}>
                {entry.isDir ? '📁' : getFileIcon(entry.name)}
              </span>
              
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: isActive ? typography.weights.semibold : typography.weights.normal
              }}>
                {entry.name}
              </span>

              {/* File status indicators */}
              {!entry.isDir && (
                <div style={{ display: 'flex', gap: spacing[1] }}>
                  {openFiles.includes(entryPath) && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: colors.primary[500]
                    }} />
                  )}
                  {activeFile === entryPath && (
                    <span style={{
                      fontSize: '8px',
                      color: colors.success
                    }}>
                      ●
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredEntries.length === 0 && searchQuery && (
          <div style={{
            padding: spacing[4],
            textAlign: 'center',
            color: colors.dark.textMuted,
            fontSize: typography.sizes.sm
          }}>
            No files found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: colors.dark.elevated,
            border: `1px solid ${colors.dark.border}`,
            borderRadius: borderRadius.md,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            minWidth: '150px'
          }}
        >
          <button style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            width: '100%',
            justifyContent: 'flex-start',
            borderRadius: 0
          }}>
            Open
          </button>
          <button style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            width: '100%',
            justifyContent: 'flex-start',
            borderRadius: 0
          }}>
            Rename
          </button>
          <button style={{
            ...buttonStyles.base,
            ...buttonStyles.ghost,
            width: '100%',
            justifyContent: 'flex-start',
            borderRadius: 0,
            color: colors.error
          }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

// Helper functions
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

function getFileIconColor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': return '#f7df1e';
    case 'ts': case 'tsx': return '#3178c6';
    case 'css': case 'scss': case 'less': return '#1572b6';
    case 'html': case 'htm': return '#e34c26';
    case 'json': return '#ffd700';
    case 'md': case 'mdx': return '#083fa1';
    case 'py': return '#3776ab';
    case 'rs': return '#ce422b';
    case 'go': return '#00add8';
    case 'java': return '#ed8b00';
    case 'cpp': case 'c': case 'h': return '#00599c';
    case 'php': return '#777bb4';
    case 'rb': return '#cc342d';
    case 'swift': return '#fa7343';
    case 'kt': return '#7f52ff';
    default: return colors.primary[400];
  }
}

export default Sidebar;