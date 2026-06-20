# BlenderMCP Monorepo — Control Blender with AI

Welcome to the **BlenderMCP** monorepo! This repository contains a complete suite of tools to connect Blender to Large Language Models (LLMs) via the Model Context Protocol (MCP), enabling AI-assisted 3D modeling, scene creation, and viewport-driven workflows.

This workspace consists of two main components:
1. **BlenderMCP Core (`blender-mcp/`)**: The MCP server package and Blender addon (`addon.py`) that exposes Blender's internal state and execution API as MCP tools.
2. **BlenderMCP Studio (`blendermcp-studio/`)**: A native desktop application (built with Tauri 2.0, React, and a Python sidecar) that replaces default chat clients, providing a dedicated interface to control Blender with any LLM.

---

## Architecture Overview

BlenderMCP Studio communicates with Blender through a unified 3-layer architecture:

```
┌─────────────────────────────────────────────────────────┐
│  TAURI 2.0 DESKTOP SHELL  (Rust + WebView)              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  React 18 + TypeScript + Tailwind + shadcn/ui    │   │
│  │  Chat UI  │  Session Manager  │  Settings Panel  │   │
│  └────────────┬─────────────────────────────────────┘   │
│               │  Tauri IPC (invoke / emit)               │
│  ┌────────────▼─────────────────────────────────────┐   │
│  │  Rust Core  (src-tauri/)                         │   │
│  │  • BlenderManager — direct TCP to addon.py       │   │
│  │  • SidecarManager — spawns Python sidecar        │   │
│  │  • SQLite chat history & Stronghold key store    │   │
│  └────────────┬─────────────────────────────────────┘   │
└───────────────┼─────────────────────────────────────────┘
                │  stdio / WebSocket  (localhost only)
┌───────────────▼─────────────────────────────────────────┐
│  Python Sidecar  (PyInstaller bundle)                    │
│  • FastAPI + WebSocket server on localhost:8765          │
│  • LiteLLM — unified LLM calls (streaming & tools)      │
│  • python-mcp ClientSession — talks to blender-mcp      │
│  • Spawns: uvx blender-mcp (one per Blender instance)   │
└───────────────┬─────────────────────────────────────────┘
                │  MCP stdio protocol
┌───────────────▼─────────────────────────────────────────┐
│  server.py  (blender-mcp package, uvx blender-mcp)      │
│  20+ MCP tools exposed via FastMCP                      │
└───────────────┬─────────────────────────────────────────┘
                │  TCP JSON  localhost:9876
┌───────────────▼─────────────────────────────────────────┐
│  addon.py  (runs inside Blender)                         │
│  BlenderMCPServer — bpy API execution                    │
└─────────────────────────────────────────────────────────┘
```

---

## Key Features

- **Multi-LLM Connection**: Connect directly to Anthropic, OpenAI, Gemini, Ollama, LM Studio, Groq, or custom endpoints using API keys or local configurations.
- **Rich Chat Interface**: Dedicated workspace UI displaying conversational text, tool executions, and viewport screenshot previews.
- **Blender Control**:
  - Manipulate 3D objects, geometries, and scene parameters.
  - Apply, adjust, and edit materials and lighting.
  - Run arbitrary Blender Python (`bpy`) code dynamically.
- **Asset Integrations**: Search and import models, textures, and HDRIs from Poly Haven, Sketchfab, and AI-generated assets via Hyper3D or Hunyuan3D.
- **Session & Prompts**: Track chat histories locally using SQLite, manage multiple concurrent Blender instances, and construct prompt "Skills."

---

## Folder Structure

```
.
├── blender-mcp/                 # Core FastMCP Server package & addon
│   ├── addon.py                 # Blender addon (runs TCP socket server in Blender)
│   ├── src/blender_mcp/         # FastMCP tools definitions
│   └── README.md                # Detailed guide for core MCP server
│
├── blendermcp-studio/           # Desktop Client Monorepo (Tauri 2.0)
│   ├── apps/
│   │   └── desktop/             # Tauri & React frontend/desktop build
│   └── packages/
│       └── sidecar/             # Python agent sidecar (LiteLLM & WebSocket broker)
│
└── final_plan.md                # System build and implementation plans
```

---

## Getting Started

### Prerequisites

To build and run the monorepo locally, ensure you have the following installed:
- **Node.js** (v20+ LTS recommended)
- **pnpm** (`npm install -g pnpm`)
- **Rust + Cargo** (stable version)
- **Python 3.11**
- **uv** (Astral's Python package manager: `pip install uv` or official installers)
- **Blender** (v3.6 to v4.x)

---

### Step 1: Install & Set Up the Blender Addon

1. Open Blender.
2. Go to **Edit > Preferences > Add-ons**.
3. Click **Install...** and select `blender-mcp/addon.py`.
4. Check the box to enable **Interface: Blender MCP**.
5. In the 3D viewport sidebar (press `N` to toggle), locate the **BlenderMCP** tab and click **Connect to Claude** (starts the local TCP socket server on port `9876`).

---

### Step 2: Running BlenderMCP Studio

1. Navigate to the desktop client directory:
   ```bash
   cd blendermcp-studio
   ```
2. Install the workspaces dependencies:
   ```bash
   pnpm install
   ```
3. Set up the Python sidecar virtual environment and install requirements:
   ```bash
   cd packages/sidecar
   uv venv .venv
   source .venv/bin/activate # (Or .venv\Scripts\activate on Windows)
   uv pip install -r requirements.txt
   ```
4. Start the application in development mode:
   ```bash
   cd ../../apps/desktop
   pnpm tauri dev
   ```

Tauri will compile the Rust core, initialize the Python WebSocket sidecar, and launch the desktop window. You can then configure your LLM settings, establish the session port (`9876`), and start communicating with Blender!

---

## Security Considerations

The `execute_blender_code` tool allows LLMs to run arbitrary Python code (`bpy` API) inside your active Blender instance. This grants the model vast control over your project. Always save your active files before initiating complex generation runs.

---

## License

This project is licensed under the MIT License. See [blender-mcp/LICENSE](file:///home/rw/RW-dev-projects/blender-mcp-claude/blender-mcp/LICENSE) for details.
