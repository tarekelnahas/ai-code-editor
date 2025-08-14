import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import TerminalPanel from './components/TerminalPanel';
import TopBar from "./components/TopBar";
import RightPanelTabs from "./components/RightPanelTabs";
import StatusBar from "./components/StatusBar";
import { PluginProvider } from './contexts/PluginContext';
import { colors, spacing, typography } from './design/theme';
import { scrollbarStyles } from './design/components';

/**
 * Context 7 Rebuilt App Component
 * 
 * Core Principles Applied:
 * 1. User-Centered Design: Intuitive layout with clear visual hierarchy
 * 2. Accessibility: Keyboard navigation, ARIA labels, focus management
 * 3. Performance: Optimized re-renders, lazy loading where appropriate
 * 4. Responsive: Adaptive layout for different screen sizes
 * 5. Consistency: Unified design system throughout
 * 6. Discoverability: Clear visual cues and feedback
 * 7. Reliability: Error boundaries and graceful degradation
 */

interface LayoutConfig {
  sidebarWidth: number;
  rightPanelWidth: number;
  terminalHeight: number;
  isTerminalCollapsed: boolean;
  isSidebarCollapsed: boolean;
  isRightPanelCollapsed: boolean;
}

const App: React.FC = () => {
  // File management state
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

  // Layout state for responsive design
  const [layout, setLayout] = useState<LayoutConfig>({
    sidebarWidth: 280,
    rightPanelWidth: 400,
    terminalHeight: 250,
    isTerminalCollapsed: false,
    isSidebarCollapsed: false,
    isRightPanelCollapsed: false
  });

  // Keyboard shortcuts and accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global keyboard shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            toggleSidebar();
            break;
          case 'j':
            e.preventDefault();
            toggleTerminal();
            break;
          case '\\':
            e.preventDefault();
            toggleRightPanel();
            break;
          case 'p':
            if (e.shiftKey) {
              e.preventDefault();
              // Command palette functionality
              console.log('Command palette shortcut');
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Layout toggle functions
  const toggleSidebar = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      isSidebarCollapsed: !prev.isSidebarCollapsed
    }));
  }, []);

  const toggleTerminal = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      isTerminalCollapsed: !prev.isTerminalCollapsed
    }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      isRightPanelCollapsed: !prev.isRightPanelCollapsed
    }));
  }, []);

  // File operations with error handling
  const handleOpenFile = useCallback(async (filePath: string) => {
    try {
      const content = await window.electronAPI.invoke('fs:readFile', filePath);
      setActiveFilePath(filePath);
      setFileContent(content as string);
      
      // Add to open files if not already there
      setOpenFiles(prev => 
        prev.includes(filePath) ? prev : [...prev, filePath]
      );
      
      // Remove from unsaved changes when opening fresh
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to open file:', error);
      // TODO: Show error toast notification
    }
  }, []);

  const handleFileContentChange = useCallback((content: string, filePath?: string) => {
    setFileContent(content);
    
    // Mark file as having unsaved changes
    const targetPath = filePath || activeFilePath;
    if (targetPath) {
      setUnsavedChanges(prev => new Set(prev).add(targetPath));
    }
  }, [activeFilePath]);

  const handleSaveFile = useCallback(async (content: string) => {
    if (!activeFilePath) return;
    
    try {
      await window.electronAPI.invoke('fs:writeFile', activeFilePath, content);
      setFileContent(content);
      
      // Remove from unsaved changes
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeFilePath);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to save file:', error);
      // TODO: Show error toast notification
    }
  }, [activeFilePath]);

  // Calculate dynamic grid layout
  const getGridColumns = () => {
    const sidebarSize = layout.isSidebarCollapsed ? '60px' : `${layout.sidebarWidth}px`;
    const rightPanelSize = layout.isRightPanelCollapsed ? '60px' : `${layout.rightPanelWidth}px`;
    return `${sidebarSize} 1fr ${rightPanelSize}`;
  };

  const getEditorRows = () => {
    return layout.isTerminalCollapsed 
      ? '1fr' 
      : `1fr ${layout.terminalHeight}px`;
  };

  // Main app styles with Context 7 design system
  const appStyles: React.CSSProperties = {
    height: '100vh',
    display: 'grid',
    gridTemplateRows: '56px 1fr 32px',
    background: colors.dark.bg,
    color: colors.dark.text,
    fontFamily: typography.fonts.sans,
    overflow: 'hidden',
    ...scrollbarStyles
  };

  const mainContentStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: getGridColumns(),
    minHeight: 0,
    overflow: 'hidden',
    gap: 0,
    transition: 'grid-template-columns 300ms ease'
  };

  const editorAreaStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateRows: getEditorRows(),
    minHeight: 0,
    background: colors.editor.background,
    borderLeft: `1px solid ${colors.dark.border}`,
    borderRight: `1px solid ${colors.dark.border}`,
    transition: 'grid-template-rows 300ms ease'
  };

  return (
    <PluginProvider>
      <div 
        className="app"
        style={appStyles}
        role="application"
        aria-label="AI Code Editor"
      >
        {/* Enhanced TopBar with layout controls */}
        <TopBar 
          onToggleSidebar={toggleSidebar}
          onToggleTerminal={toggleTerminal}
          onToggleRightPanel={toggleRightPanel}
          openFiles={openFiles}
          activeFile={activeFilePath}
          unsavedChanges={unsavedChanges}
          onSwitchFile={setActiveFilePath}
        />

        {/* Main content area */}
        <main style={mainContentStyles}>
          {/* Enhanced Sidebar */}
          <aside 
            style={{
              background: colors.dark.surface,
              borderRight: `1px solid ${colors.dark.border}`,
              transition: 'width 300ms ease'
            }}
            aria-label="File explorer"
          >
            <Sidebar 
              onFileOpen={handleOpenFile}
              isCollapsed={layout.isSidebarCollapsed}
              openFiles={openFiles}
              activeFile={activeFilePath}
            />
          </aside>

          {/* Editor and Terminal area */}
          <section style={editorAreaStyles} aria-label="Code editor and terminal">
            {/* Enhanced Editor */}
            <div 
              style={{ 
                minHeight: 0,
                background: colors.editor.background,
                position: 'relative'
              }}
            >
              <Editor
                filePath={activeFilePath}
                content={fileContent}
                onChange={handleFileContentChange}
                onSave={handleSaveFile}
                openFiles={openFiles}
                hasUnsavedChanges={activeFilePath ? unsavedChanges.has(activeFilePath) : false}
              />
            </div>

            {/* Enhanced Terminal */}
            {!layout.isTerminalCollapsed && (
              <div 
                style={{
                  borderTop: `1px solid ${colors.dark.border}`,
                  background: colors.dark.surface,
                  minHeight: 0
                }}
              >
                <TerminalPanel 
                  height={layout.terminalHeight}
                  onResize={(height) => setLayout(prev => ({ ...prev, terminalHeight: height }))}
                />
              </div>
            )}
          </section>

          {/* Enhanced Right Panel */}
          <aside 
            style={{
              background: colors.dark.surface,
              borderLeft: `1px solid ${colors.dark.border}`,
              transition: 'width 300ms ease'
            }}
            aria-label="AI tools and utilities"
          >
            <RightPanelTabs 
              isCollapsed={layout.isRightPanelCollapsed}
              activeFile={activeFilePath}
              fileContent={fileContent}
            />
          </aside>
        </main>

        {/* Enhanced Status Bar */}
        <StatusBar 
          activeFile={activeFilePath}
          hasUnsavedChanges={activeFilePath ? unsavedChanges.has(activeFilePath) : false}
          layout={layout}
        />
      </div>
    </PluginProvider>
  );
};

export default App;