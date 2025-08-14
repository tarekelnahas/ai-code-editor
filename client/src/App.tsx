import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import TerminalPanel from './components/TerminalPanel';
import AgentPanel from './components/AgentPanel';
import TopBar from "./components/TopBar";
import RightPanelTabs from "./components/RightPanelTabs";
import StatusBar from "./components/StatusBar";
import { PluginProvider } from './contexts/PluginContext';

/**
 * Top‑level React component. It orchestrates the layout of the sidebar,
 * editor, agent panel and terminal. The PluginProvider loads and
 * activates available plugins so they can contribute commands and
 * UI components.
 */
const App: React.FC = () => {
  // Track the currently open file path and its contents. These are passed
  // down to the editor when a file is opened from the sidebar. When the
  // user saves the file the contents are written back to disk via IPC.
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  const handleOpenFile = async (filePath: string) => {
    const content = await window.electronAPI.invoke('fs:readFile', filePath);
    setActiveFilePath(filePath);
    setFileContent(content as string);
  };

  const handleSaveFile = async (content: string) => {
    if (activeFilePath) {
      await window.electronAPI.invoke('fs:writeFile', activeFilePath, content);
      setFileContent(content);
    }
  };

  return (
    <PluginProvider>
      <div className="app" style={{ 
        height: "100vh", 
        display: "grid", 
        gridTemplateRows: "35px 1fr 22px",
        background: "var(--bg)"
      }}>
        <TopBar />
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "240px 1fr 360px", 
          minHeight: 0,
          overflow: "hidden"
        }}>
          {/* Sidebar */}
          <div style={{ minHeight: 0, borderRight: "1px solid var(--border)" }}>
            <Sidebar onFileOpen={handleOpenFile} />
          </div>
          
          {/* Main editor area */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            minHeight: 0,
            background: "var(--editor-bg)"
          }}>
            <div style={{ 
              flex: 1, 
              minHeight: 0,
              borderBottom: "1px solid var(--border)"
            }}>
              <Editor
                filePath={activeFilePath}
                content={fileContent}
                onChange={setFileContent}
                onSave={handleSaveFile}
              />
            </div>
            <div style={{ 
              height: "180px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-secondary)"
            }}>
              <TerminalPanel />
            </div>
          </div>
          
          {/* Right panel */}
          <div style={{ 
            minHeight: 0,
            borderLeft: "1px solid var(--border)"
          }}>
            <RightPanelTabs />
          </div>
        </div>
        <StatusBar />
      </div>
    </PluginProvider>
  );
};

export default App;