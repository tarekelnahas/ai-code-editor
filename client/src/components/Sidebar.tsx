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
    <div className="sidebar" style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--sidebar)'
    }}>
      <div style={{ 
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        Explorer
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {dir !== '.' && (
          <div
            onClick={goUp}
            className="sidebar-item"
            style={{ 
              fontWeight: 500,
              paddingLeft: '16px'
            }}
          >
            <span style={{ marginRight: '6px', color: 'var(--text-muted)' }}>📁</span>
            ../
          </div>
        )}
        {entries.map(entry => (
          <div
            key={entry.name}
            onClick={() => openEntry(entry)}
            className="sidebar-item"
            style={{ 
              paddingLeft: entry.isDir ? '16px' : '20px'
            }}
          >
            <span style={{ 
              marginRight: '6px', 
              color: entry.isDir ? '#dcb67a' : '#75beff',
              fontSize: '14px'
            }}>
              {entry.isDir ? '📁' : getFileIcon(entry.name)}
            </span>
            {entry.name}
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

export default Sidebar;