import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as http from 'http';

// Lower Electron memory cap to 3072MB
app.commandLine.appendSwitch('js-flags','--max-old-space-size=3072');

/**
 * This file boots the Electron application. It creates the main browser window,
 * spawns the local FastAPI server via bootstrap.ps1, and wires up a few IPC methods for
 * performing privileged operations from the renderer. The goal is to keep
 * blocking, long‑running work in this process while exposing a safe API
 * surface via the preload script.
 */

let mainWindow: BrowserWindow | undefined;
let pythonProcess: ChildProcess | undefined;

// Determine whether we are running in development mode by looking for
// the presence of an environment variable. Vite sets NODE_ENV to
// 'development' when running `npm run dev:client`.
const isDev = process.env.NODE_ENV === 'development';

function waitForHealth(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get('http://127.0.0.1:8000/health', (res) => {
        if (res.statusCode === 200) { resolve(); } else { next(); }
      });
      req.on('error', next);
      function next() {
        if (Date.now() > deadline) return reject(new Error('backend-health-timeout'));
        setTimeout(tick, 400);
      }
    };
    tick();
  });
}

/**
 * Spawn the Python FastAPI backend via bootstrap.ps1. In development we skip.
 */
function startPythonServer() {
  if (isDev) {
    console.log('Development mode: Python server managed separately');
    return Promise.resolve();
  }

  const bootstrapPath = path.join(process.resourcesPath || process.cwd(), 'server', 'bootstrap.ps1');
  
  return new Promise<void>((resolve, reject) => {
    pythonProcess = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-File', bootstrapPath
    ], {
      detached: false,
      windowsHide: true
    });

    pythonProcess?.on('error', (err) => {
      console.error('Failed to start Python server', err);
      reject(err);
    });

    // Wait for server to be ready
    setTimeout(() => {
      waitForHealth(20000).then(resolve).catch(reject);
    }, 1000);
  });
}

/**
 * Gracefully kill the Python server when the app quits.
 */
function stopPythonServer() {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill();
  }
}

/**
 * Create the browser window and load either the dev server or the built
 * renderer index file. WebPreferences are locked down: Node integration is
 * disabled and context isolation is enabled. The preload script is used to
 * expose a limited API to the renderer.
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false
  });

  // Once the window is ready to show, reveal it. This prevents a white
  // flash on startup.
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
  });

  // Open external links in the user's default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const rendererURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../client/dist/index.html')}`;

  await mainWindow.loadURL(rendererURL);

  // When the window is closed, dereference it.
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

/**
 * Setup IPC handlers for privileged operations. The renderer invokes these
 * via the exposed API in preload.ts. Each handler should validate input
 * carefully because messages are crossing an untrusted boundary.
 */
function registerIpcHandlers() {
  // Example: list files in a directory. The renderer passes an absolute
  // filesystem path and we return an array of filenames. In a real editor
  // you'd want to perform additional validation and error handling here.
  ipcMain.handle('fs:listDir', async (_event, dir: string) => {
    const fs = await import('fs/promises');
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.map(e => ({ name: e.name, isDir: e.isDirectory() }));
    } catch (err) {
      console.error('Error listing directory', err);
      return [];
    }
  });

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return data;
    } catch (err) {
      console.error('Error reading file', err);
      return '';
    }
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    const fs = await import('fs/promises');
    try {
      await fs.writeFile(filePath, content, 'utf8');
      return { success: true };
    } catch (err) {
      console.error('Error writing file', err);
      return { success: false };
    }
  });

    /**
     * Simple terminal integration. Spawn a shell on demand and stream its
     * stdout/stderr back to the renderer. The renderer can send input
     * through IPC. Only a single terminal is supported for now.
     */
    let termProc: ChildProcess | null = null;
    ipcMain.handle('term:start', async (event) => {
      if (termProc) return;
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      termProc = spawn(shell, [], { cwd: process.cwd(), env: process.env });
      termProc.stdout?.on('data', (data: Buffer) => {
        event.sender.send('term:data', data.toString());
      });
      termProc.stderr?.on('data', (data: Buffer) => {
        event.sender.send('term:data', data.toString());
      });
      termProc.on('close', () => {
        event.sender.send('term:data', '\n[process exited]\n');
        termProc = null;
      });
    });
    ipcMain.handle('term:input', async (_event, input: string) => {
      termProc?.stdin?.write(input);
    });
    ipcMain.handle('term:dispose', async () => {
      termProc?.kill();
      termProc = null;
    });

    /**
     * Editor tools IPC handlers for creating portable workspace and exporting logs
     */
    
    // Create portable workspace
    ipcMain.handle('tools:createPortable', async (_event, outputPath?: string) => {
      const { spawn } = require('child_process');
      const path = require('path');
      
      return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'create-portable.ps1');
        const args = ['-ExecutionPolicy', 'Bypass', '-File', scriptPath];
        
        if (outputPath) {
          args.push('-OutputPath', outputPath);
        }
        
        const process = spawn('powershell.exe', args, {
          cwd: path.dirname(__dirname),
          windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        process.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        process.on('close', (code: number) => {
          if (code === 0) {
            resolve({ success: true, output: stdout, error: stderr });
          } else {
            reject(new Error(`Script failed with code ${code}: ${stderr}`));
          }
        });

        process.on('error', (err: Error) => {
          reject(err);
        });
      });
    });

    // Export logs
    ipcMain.handle('tools:exportLogs', async (_event, options?: { outputPath?: string; includeModels?: boolean; days?: number }) => {
      const { spawn } = require('child_process');
      const path = require('path');
      
      return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'export-logs.ps1');
        const args = ['-ExecutionPolicy', 'Bypass', '-File', scriptPath];
        
        if (options?.outputPath) {
          args.push('-OutputPath', options.outputPath);
        }
        if (options?.includeModels) {
          args.push('-IncludeModels');
        }
        if (options?.days) {
          args.push('-Days', options.days.toString());
        }
        
        const process = spawn('powershell.exe', args, {
          cwd: path.dirname(__dirname),
          windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        process.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        process.on('close', (code: number) => {
          if (code === 0) {
            resolve({ success: true, output: stdout, error: stderr });
          } else {
            reject(new Error(`Script failed with code ${code}: ${stderr}`));
          }
        });

        process.on('error', (err: Error) => {
          reject(err);
        });
      });
    });
  }

// App lifecycle hooks
app.whenReady().then(() => {
  registerIpcHandlers();
  startPythonServer().then(() => {
    createWindow();
  }).catch((err) => {
    console.error('Failed to start backend:', err);
    createWindow(); // show window anyway
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS it's common for applications to stay open until the user
  // explicitly quits. We'll follow the default Electron behaviour.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPythonServer();
});