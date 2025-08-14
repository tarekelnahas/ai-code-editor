import React, { useEffect, useState } from 'react';

interface SidebarProps {
  onFileOpen: (filePath: string) => void;
}

interface Entry {
  name: string;
  isDir: boolean;
}

/**
 * Sidebar component renders a simple file explorer. Users can navigate
 * directories and open files. When a file is clicked the onFileOpen
 * callback is invoked to load it into the editor.
 */
const Sidebar: React.FC<SidebarProps> = ({ onFileOpen }) => {
  const [dir, setDir] = useState<string>('.');
  const [entries, setEntries] = useState<Entry[]>([]);

  // Load directory contents whenever the path changes
  useEffect(() => {
    window.electronAPI.invoke('fs:listDir', dir).then((list: Entry[]) => {
      setEntries(list);
    });
  }, [dir]);

  // Open a file or change into a directory. For directories we update
  // internal state; for files we pass the full path to the parent
  // component. Paths are constructed relative to the current dir.
  const openEntry = (entry: Entry) => {
    const newPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDir) {
      setDir(newPath);
    } else {
      onFileOpen(newPath);
    }
  };

  const goUp = () => {
    if (dir === '.') return;
    const parts = dir.split('/');
    parts.pop();
    const parent = parts.join('/') || '.';
    setDir(parent);
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#252526',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <div style={{ 
        padding: '12px 16px',
        borderBottom: '1px solid #3c3c3c',
        fontSize: '11px',
        fontWeight: 600,
        color: '#cccccc',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '14px' }}>📂</span>
        Explorer
      </div>
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '8px 0'
      }}>
        {dir !== '.' && (
          <div
            onClick={goUp}
            style={{ 
              padding: '6px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: '13px',
              color: '#cccccc',
              fontWeight: 500,
              transition: 'background 0.15s ease',
              borderRadius: '4px',
              margin: '0 8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ marginRight: '8px', fontSize: '16px' }}>📁</span>
            ../
          </div>
        )}
        {entries.map(entry => (
          <div
            key={entry.name}
            onClick={() => openEntry(entry)}
            style={{ 
              padding: '6px 16px',
              paddingLeft: entry.isDir ? '16px' : '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: '13px',
              color: '#cccccc',
              transition: 'all 0.15s ease',
              borderRadius: '4px',
              margin: '0 8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = entry.isDir ? 'rgba(220, 182, 122, 0.15)' : 'rgba(117, 190, 255, 0.15)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#cccccc';
            }}
          >
            <span style={{ 
              marginRight: '8px', 
              fontSize: '16px',
              color: entry.isDir ? '#dcb67a' : getFileIconColor(entry.name)
            }}>
              {entry.isDir ? '📁' : getFileIcon(entry.name)}
            </span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to get file type icons
function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': return '🟨';
    case 'ts': case 'tsx': return '🔷';
    case 'css': return '🎨';
    case 'html': return '🌐';
    case 'json': return '📋';
    case 'md': return '📝';
    case 'py': return '🐍';
    default: return '📄';
  }
}

// Helper function to get file type colors
function getFileIconColor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js': case 'jsx': return '#f7df1e';
    case 'ts': case 'tsx': return '#3178c6';
    case 'css': return '#1572b6';
    case 'html': return '#e34c26';
    case 'json': return '#ffd700';
    case 'md': return '#083fa1';
    case 'py': return '#3776ab';
    default: return '#75beff';
  }
}

export default Sidebar;