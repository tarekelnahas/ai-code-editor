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
        gridTemplateRows: "48px 1fr 28px",
        background: "#1e1e1e",
        color: "#cccccc",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
      }}>
        <TopBar />
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "280px 1fr 400px", 
          minHeight: 0,
          overflow: "hidden",
          gap: 0
        }}>
          {/* Sidebar */}
          <div style={{ 
            minHeight: 0, 
            borderRight: "1px solid #3c3c3c",
            background: "#252526"
          }}>
            <Sidebar onFileOpen={handleOpenFile} />
          </div>
          
          {/* Main editor area */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            minHeight: 0,
            background: "#1e1e1e"
          }}>
            <div style={{ 
              flex: 1, 
              minHeight: 0,
              borderBottom: "1px solid #3c3c3c",
              background: "#1e1e1e"
            }}>
              <Editor
                filePath={activeFilePath}
                content={fileContent}
                onChange={setFileContent}
                onSave={handleSaveFile}
              />
            </div>
            <div style={{ 
              height: "200px",
              borderTop: "1px solid #3c3c3c",
              background: "#181818"
            }}>
              <TerminalPanel />
            </div>
          </div>
          
          {/* Right panel */}
          <div style={{ 
            minHeight: 0,
            borderLeft: "1px solid #3c3c3c"
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