# Mido AI Editor - Quick Start Guide

## Installation

### Option 1: NSIS Installer (Recommended)
1. Run `release/Mido AI Editor-0.1.0-x64.exe`
2. Follow the installation wizard
3. Launch from Start Menu or Desktop shortcut

### Option 2: Portable Version
1. Extract `release/win-unpacked/` to any location
2. Run `Mido AI Editor.exe` directly
3. No installation required - runs from USB, network drives, etc.

## First Launch

1. **Server Startup**: The editor automatically starts the Python FastAPI backend
2. **Health Check**: A built-in health check ensures the backend is ready
3. **Model Selection**: Use the role-based dropdown to select AI models
4. **Workspace**: Default workspace opens in your Documents folder

## Key Features

### AI Integration
- **Role-based Model Selection**: Choose from completion, general, or planner roles
- **Dynamic Fallback**: Automatically switches to available models if primary unavailable
- **WebSocket & REST**: Real-time streaming and REST API endpoints

### Tools & Utilities
- **Create Portable Workspace**: Menu → Tools → Create Portable Workspace
- **Export Logs**: Menu → Tools → Export Logs & Diagnostics
- **Terminal Integration**: Built-in terminal with PowerShell/bash support

### Search & RAG
- **Code Search**: Fast ripgrep-powered file search
- **RAG Context**: AI completions with relevant code context
- **Multi-language Support**: TypeScript, Python, JavaScript, and more

## Troubleshooting

### Server Won't Start
- Check if port 8000 is free
- Verify Python and dependencies in `server/.venv/`
- Check logs with Tools → Export Logs

### Model Issues
- Ensure Ollama is running on port 11434
- Verify models are available: `ollama list`
- Check /ai/meta endpoint for available models

### Build Issues
- Clear `node_modules` and run `npm install`
- Check TypeScript compilation: `npm run build:electron`
- Verify electron-builder configuration in package.json

## Development

### Run in Development Mode
```bash
npm run dev
```

### Build from Source
```bash
npm run build:client
npm run build:electron
npm run dist:win
```

### Manual Server Start
```bash
cd server
. .venv/Scripts/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Configuration

- **Config Path**: `%LOCALAPPDATA%\AIEditor\config.json`
- **Logs**: `%LOCALAPPDATA%\AIEditor\logs\`
- **Models**: Configurable via role-based selection in UI

## Support

For issues and feature requests, check the exported logs first using Tools → Export Logs.