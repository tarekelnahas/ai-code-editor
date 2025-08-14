import { contextBridge, ipcRenderer } from 'electron';

/**
 * The preload script runs before the renderer process is loaded. It has
 * access to Node.js and Electron APIs. Here we expose a small surface of
 * functionality to the renderer via the contextBridge. Avoid exposing
 * dangerous primitives like fs or child_process directly to keep the
 * renderer sandboxed.
 */

const electronAPI = {
  /**
   * Invoke an IPC handler in the main process. Returns a promise that
   * resolves with the handler's return value.
   */
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  /**
   * Listen for messages sent from the main process. Returns a function
   * that can be called to unsubscribe.
   */
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...data) => listener(...data));
    return () => ipcRenderer.removeAllListeners(channel);
  }
};

const platformAPI = {
  platform: process.platform,
  env: process.env.NODE_ENV
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('platform', platformAPI);

// Expose typed interfaces to TypeScript via declaration merging. The
// corresponding declarations live in client/src/types/exposed.ts.
export { };