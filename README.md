# AI Code Editor

AI Code Editor is a next‑generation, offline‑first development environment built with
Electron, React and FastAPI. It combines a rich, modern UI with local AI
capabilities to provide code completion, explanation, refactoring and more
without sending your code to the cloud. The application is designed to be
modular, extensible and efficient enough to run on Windows 11 with 8 GB of
RAM.

## Features

- **Split architecture** – The Electron main process boots a Python
  [FastAPI](https://fastapi.tiangolo.com/) server in a sandboxed subprocess and
  serves the React renderer through Vite. This separation keeps AI
  workloads off the UI thread and enables language‑agnostic model integration.
- **Plugin system** – Extensions can register commands and panels via a
  simple API. See `client/src/plugins/examplePlugin.tsx` for a basic example.
- **Editor** – The core of the UI is powered by Monaco, the code editor that
  underpins VS Code. Files can be opened from the built‑in explorer and saved
  back to disk. Ctrl+S triggers a save.
- **Terminal** – A lightweight pseudo‑terminal spawns your system shell and
  streams output into the bottom panel. Input is forwarded via IPC.
- **Agent panel** – Connects to the local AI backend over WebSockets and
  displays streaming messages. Send prompts to the agent directly from the
  panel.
- **FastAPI backend** – Exposes a `/ws/ai` WebSocket for streaming
  interactions with the AI. The current implementation simply echoes
  the user's input but is structured for easy extension with local
  LLMs like Llama.cpp or Ollama. Agents can collaborate by returning
  multiple responses per input.

## Project structure

```
ai_code_editor/
├── client/              # React + Vite renderer
│   ├── index.html       # Entry HTML
│   ├── package.json     # Client dependencies
│   ├── src/
│   │   ├── App.tsx      # Top‑level UI layout
│   │   ├── components/  # Sidebar, Editor, Terminal and Agent panels
│   │   ├── contexts/    # Plugin provider
│   │   ├── hooks/       # Shared hooks (e.g. WebSocket helper)
│   │   ├── plugins/     # Example plugin
│   │   ├── types/       # Shared type definitions
│   │   └── ...
│   └── vite.config.ts   # Vite configuration
├── server/              # FastAPI backend
│   ├── main.py          # API and WebSocket implementation
│   └── requirements.txt # Python dependencies
├── main.ts              # Electron main process
├── preload.ts           # Preload script exposing IPC API
├── package.json         # Root package and Electron builder config
├── tsconfig.json        # TypeScript configuration for Electron
└── README.md            # This file
```

## Getting started

1. **Install prerequisites**
   - [Node.js](https://nodejs.org/) ≥ 18
   - [Python](https://www.python.org/) ≥ 3.9 (matching your local environment)
   - Git (optional if you wish to clone this repository)

2. **Install JavaScript dependencies**

   ```bash
   cd ai_code_editor
   npm install
   # Install client dependencies
   cd client && npm install
   ```

3. **Install Python dependencies**

   ```bash
   cd ai_code_editor/server
   python -m venv .venv
   source .venv/bin/activate  # On Windows use .venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Run in development mode**

   From the project root run:

   ```bash
   npm run dev
   ```

   - Vite will start the React dev server on [http://localhost:5173](http://localhost:5173).
   - Uvicorn will start the FastAPI server on [http://localhost:8000](http://localhost:8000).
   - Electron will launch and load the renderer from Vite.

5. **Build for production**

   ```bash
   npm run build
   # Package the app into a distributable installer (Windows by default)
   npm run build:electron
   ```

   The compiled application and installer will be placed under the `release`
   directory. See `package.json` for build configuration options.

## Extending the editor

- **Add a plugin** by creating a new file under `client/src/plugins`. Export a
  default object implementing the `Plugin` interface defined in
  `client/src/types/plugin.ts`. During startup the PluginProvider will
  automatically import and activate your plugin.
- **Integrate your own AI model** by replacing the `AgentManager`
  implementation in `server/main.py`. Call into your local LLM via
  `llama_cpp`, `ollama` or another runner and stream responses back
  through the WebSocket. You can also implement retrieval‑augmented
  generation by indexing your codebase and retrieving relevant chunks.
- **Improve the UI/UX** by modifying the React components. Tailwind
  utilities are available for rapid iteration and dark/light themes are
  supported out of the box.

## Notes

- The current implementation is deliberately conservative in its memory
  usage. Heavy modules like Monaco and XTerm are loaded lazily and
  unnecessary data is not retained in state.
- Auto‑updates are not enabled by default but can be configured via
  electron‑builder. See their documentation for details.
- This project provides a solid foundation for a production editor but
  leaves room for innovation. Feel free to redesign the layout,
  implement additional panels, support multiple terminals and more.

Enjoy building with your new AI‑powered editor!