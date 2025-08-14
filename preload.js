/**
 * Preload script for the AI Code Editor.
 * This script runs in the renderer process and exposes a safe API
 * to interact with the main process via IPC.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  fs: {
    listDir: (dir: string) => ipcRenderer.invoke('fs:listDir', dir),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  },

  // Terminal integration
  term: {
    start: () => ipcRenderer.invoke('term:start'),
    input: (input: string) => ipcRenderer.invoke('term:input', input),
    dispose: () => ipcRenderer.invoke('term:dispose'),
    onData: (callback: (data: string) => void) => {
      ipcRenderer.on('term:data', (_event, data) => callback(data));
    },
  },

  // Editor tools
  editorTools: {
    createPortable: (outputPath?: string) => ipcRenderer.invoke('tools:createPortable', outputPath),
    exportLogs: (options?: { outputPath?: string; includeModels?: boolean; days?: number }) => 
      ipcRenderer.invoke('tools:exportLogs', options),
  },

  // Environment info
  isDev: process.env.NODE_ENV === 'development',
});