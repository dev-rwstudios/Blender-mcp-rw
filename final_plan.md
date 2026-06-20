# BlenderMCP Studio — Complete Implementation Plan

> **Portability note**: This document is fully self-contained. Clone `Gopikrish-30/blender-mcp-realworks` into the project folder before starting Phase 1. All paths are relative to the monorepo root `blendermcp-studio/`.

---

## 0. What We Are Building

**BlenderMCP Studio** is a standalone native desktop application (Windows/macOS/Linux) that replaces Claude Desktop as the AI client for controlling Blender. Instead of being locked into one provider, it lets users:

- Connect any LLM (OpenAI, Anthropic, Gemini, Groq, LM Studio, Ollama, custom endpoints) via API keys or local runners
- Chat with the AI in a rich UI that renders tool call cards, viewport screenshots, and asset previews
- Control Blender via the existing `blender-mcp` addon over MCP protocol
- Save conversation history, manage multiple Blender sessions, and build a library of reusable prompts ("Skills")

### Architecture (3 layers)

```
┌─────────────────────────────────────────────────────────┐
│  TAURI 2.0 DESKTOP SHELL  (Rust + WebView)              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  React 18 + TypeScript + Tailwind + shadcn/ui    │   │
│  │  Zustand state  │  Chat UI  │  Settings Panel    │   │
│  └────────────┬─────────────────────────────────────┘   │
│               │  Tauri IPC (invoke / emit)               │
│  ┌────────────▼─────────────────────────────────────┐   │
│  │  Rust Core  (src-tauri/)                         │   │
│  │  • BlenderManager — direct TCP to addon.py       │   │
│  │  • SidecarManager — spawns Python sidecar        │   │
│  │  • tauri-plugin-sql (SQLite chat history)        │   │
│  │  • tauri-plugin-stronghold (encrypted key store) │   │
│  └────────────┬─────────────────────────────────────┘   │
└───────────────┼─────────────────────────────────────────┘
                │  stdio / WebSocket  (localhost only)
┌───────────────▼─────────────────────────────────────────┐
│  Python Sidecar  (PyInstaller bundle)                    │
│  • FastAPI + WebSocket server on localhost:8765          │
│  • LiteLLM — unified LLM calls (streaming)              │
│  • python-mcp ClientSession — talks to blender-mcp      │
│  • Spawns: uvx blender-mcp (one per Blender instance)   │
└───────────────┬─────────────────────────────────────────┘
                │  MCP stdio protocol
┌───────────────▼─────────────────────────────────────────┐
│  server.py  (blender-mcp package, uvx blender-mcp)      │
│  22 MCP tools exposed via FastMCP                        │
└───────────────┬─────────────────────────────────────────┘
                │  TCP JSON  localhost:9876
┌───────────────▼─────────────────────────────────────────┐
│  addon.py  (runs inside Blender)                         │
│  BlenderMCPServer — bpy API execution                    │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Prerequisites

### On the build machine

| Tool | Version | Install |
|------|---------|---------|
| Rust + Cargo | stable (≥1.77) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm` |
| Python | 3.11 | https://www.python.org |
| uv | latest | `pip install uv` |
| Tauri CLI | 2.x | `cargo install tauri-cli --version "^2"` |
| Blender | 3.6–4.x | https://blender.org |

### Windows extras
```powershell
# Visual C++ Build Tools (required by Rust)
winget install Microsoft.VisualStudio.2022.BuildTools

# WebView2 Runtime (usually pre-installed on Win11)
winget install Microsoft.EdgeWebView2Runtime
```

### macOS extras
```bash
xcode-select --install
```

---

## 2. Monorepo Structure

```
blendermcp-studio/
├── apps/
│   └── desktop/                    # Tauri application
│       ├── src/                    # React frontend
│       │   ├── components/
│       │   │   ├── chat/
│       │   │   │   ├── ChatWindow.tsx
│       │   │   │   ├── MessageBubble.tsx
│       │   │   │   ├── ToolCallCard.tsx
│       │   │   │   ├── ScreenshotViewer.tsx
│       │   │   │   └── TypingIndicator.tsx
│       │   │   ├── sidebar/
│       │   │   │   ├── ConversationList.tsx
│       │   │   │   └── BlenderSessionList.tsx
│       │   │   ├── settings/
│       │   │   │   ├── ProviderSettings.tsx
│       │   │   │   ├── BlenderSettings.tsx
│       │   │   │   └── SkillsLibrary.tsx
│       │   │   └── ui/             # shadcn/ui components
│       │   ├── stores/
│       │   │   ├── chatStore.ts
│       │   │   ├── blenderStore.ts
│       │   │   ├── settingsStore.ts
│       │   │   └── sidecarStore.ts
│       │   ├── hooks/
│       │   │   ├── useWebSocket.ts
│       │   │   ├── useBlender.ts
│       │   │   └── useChat.ts
│       │   ├── lib/
│       │   │   ├── ipc.ts          # typed Tauri invoke wrappers
│       │   │   └── utils.ts
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── src-tauri/
│           ├── src/
│           │   ├── main.rs
│           │   ├── blender/
│           │   │   ├── mod.rs
│           │   │   ├── manager.rs  # TCP connection pool
│           │   │   └── protocol.rs # JSON types
│           │   ├── sidecar/
│           │   │   ├── mod.rs
│           │   │   └── manager.rs  # spawn/kill Python
│           │   ├── commands/
│           │   │   ├── mod.rs
│           │   │   ├── blender.rs  # #[tauri::command] handlers
│           │   │   ├── sidecar.rs
│           │   │   └── settings.rs
│           │   └── db/
│           │       ├── mod.rs
│           │       └── migrations/ # SQL migration files
│           ├── Cargo.toml
│           └── tauri.conf.json
├── packages/
│   └── sidecar/                    # Python sidecar
│       ├── main.py                 # FastAPI entry point
│       ├── llm_bridge.py           # LiteLLM wrapper
│       ├── mcp_client.py           # python-mcp ClientSession
│       ├── models.py               # Pydantic request/response models
│       ├── requirements.txt
│       └── build.py                # PyInstaller build script
├── addons/
│   └── blender-mcp-realworks/      # the upstream repo (git clone here)
│       ├── addon.py
│       └── src/blender_mcp/
│           └── server.py
├── package.json                    # pnpm workspace root
└── pnpm-workspace.yaml
```

---

## 3. Phase 1 — Scaffold & Skeleton (Week 1)

### 3.1 Create monorepo

```bash
mkdir blendermcp-studio && cd blendermcp-studio

# pnpm workspace
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

cat > package.json << 'EOF'
{
  "name": "blendermcp-studio",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter desktop dev",
    "build": "pnpm --filter desktop build"
  }
}
EOF
```

### 3.2 Create Tauri app

```bash
mkdir -p apps/desktop
cd apps/desktop

# Scaffold Tauri 2 with React + TypeScript + Vite
pnpm create tauri-app@latest . \
  --template react-ts \
  --manager pnpm \
  --yes

# Install frontend deps
pnpm add @tauri-apps/api @tauri-apps/plugin-shell \
  @tauri-apps/plugin-sql @tauri-apps/plugin-stronghold \
  zustand @tanstack/react-query \
  tailwindcss @tailwindcss/vite \
  class-variance-authority clsx tailwind-merge \
  lucide-react

pnpm add -D @types/node vite-plugin-svgr
```

### 3.3 Cargo.toml (src-tauri/Cargo.toml)

```toml
[package]
name = "blendermcp-studio"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-shell = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-stronghold = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tokio-util = "0.7"
thiserror = "1"
log = "0.4"
tauri-plugin-log = "2"
anyhow = "1"
uuid = { version = "1", features = ["v4"] }
dashmap = "5"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

### 3.4 tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "BlenderMCP Studio",
  "version": "0.1.0",
  "identifier": "com.blendermcp.studio",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "BlenderMCP Studio",
        "width": 1400,
        "height": 900,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "decorations": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:8765 http://localhost:8765"
    }
  },
  "bundle": {
    "active": true,
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "resources": ["../../../packages/sidecar/dist/sidecar*"]
  },
  "plugins": {
    "shell": {
      "open": false,
      "sidecar": true
    },
    "sql": {
      "preloadBindings": false
    }
  }
}
```

### 3.5 Clone upstream repo

```bash
# From monorepo root
mkdir -p addons
git clone https://github.com/Gopikrish-30/blender-mcp-realworks.git addons/blender-mcp-realworks
```

### 3.6 Setup shadcn/ui

```bash
cd apps/desktop
npx shadcn@latest init
# Choose: TypeScript, tailwind, default style, slate base
# Components dir: src/components/ui

# Add components we need
npx shadcn@latest add button input textarea scroll-area separator \
  dialog dropdown-menu tooltip badge avatar card tabs
```

### 3.7 Tailwind config (tailwind.config.ts)

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blender: {
          orange: "#EA7600",
          dark: "#1A1A1A",
          gray: "#2A2A2A",
          panel: "#3A3A3A",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**Phase 1 checkpoint**: `pnpm dev` opens a window with React hot reload. No functionality yet.

---

## 4. Phase 2 — Rust Core: Blender TCP & IPC (Week 2)

### 4.1 Blender protocol types (src-tauri/src/blender/protocol.rs)

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug)]
pub struct BlenderRequest {
    #[serde(rename = "type")]
    pub cmd_type: String,
    pub params: serde_json::Value,
}

#[derive(Deserialize, Debug)]
pub struct BlenderResponse {
    pub status: String,         // "success" | "error"
    pub result: Option<serde_json::Value>,
    pub message: Option<String>,
}

// Tauri IPC command payloads
#[derive(Serialize, Deserialize, Debug)]
pub struct BlenderSessionInfo {
    pub id: String,
    pub port: u16,
    pub connected: bool,
    pub label: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SendCommandPayload {
    pub session_id: String,
    pub command: String,
    pub params: serde_json::Value,
}
```

### 4.2 BlenderManager (src-tauri/src/blender/manager.rs)

```rust
use crate::blender::protocol::{BlenderRequest, BlenderResponse};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct BlenderSession {
    pub id: String,
    pub port: u16,
    pub label: String,
    stream: Arc<Mutex<TcpStream>>,
}

pub struct BlenderManager {
    sessions: DashMap<String, BlenderSession>,
}

impl BlenderManager {
    pub fn new() -> Self {
        Self { sessions: DashMap::new() }
    }

    pub async fn connect(&self, port: u16, label: String) -> Result<String, String> {
        let addr = format!("127.0.0.1:{}", port);
        let stream = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("TCP connect failed: {}", e))?;

        let id = uuid::Uuid::new_v4().to_string();
        let session = BlenderSession {
            id: id.clone(),
            port,
            label,
            stream: Arc::new(Mutex::new(stream)),
        };

        // Health check
        self.send_command_to_session(&session, "get_scene_info", serde_json::json!({}))
            .await
            .map_err(|e| format!("Health check failed: {}", e))?;

        self.sessions.insert(id.clone(), session);
        Ok(id)
    }

    pub async fn disconnect(&self, session_id: &str) {
        self.sessions.remove(session_id);
    }

    pub async fn send_command(
        &self,
        session_id: &str,
        command: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let session = self.sessions.get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        self.send_command_to_session(&session, command, params).await
    }

    async fn send_command_to_session(
        &self,
        session: &BlenderSession,
        command: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let request = BlenderRequest {
            cmd_type: command.to_string(),
            params,
        };
        let payload = serde_json::to_vec(&request)
            .map_err(|e| e.to_string())?;

        let mut stream = session.stream.lock().await;

        // Send length-prefixed JSON (addon.py uses raw recv until newline/buffer)
        // addon.py actually reads with recv(8192) in a loop until json parses
        stream.write_all(&payload)
            .await
            .map_err(|e| format!("Write failed: {}", e))?;
        stream.write_all(b"\n")
            .await
            .map_err(|e| format!("Write newline failed: {}", e))?;

        // Read response (addon.py sends complete JSON in one send)
        let mut buf = Vec::with_capacity(65536);
        let mut tmp = [0u8; 8192];
        loop {
            let n = stream.read(&mut tmp)
                .await
                .map_err(|e| format!("Read failed: {}", e))?;
            if n == 0 { break; }
            buf.extend_from_slice(&tmp[..n]);
            // Try to parse — if valid JSON, we're done
            if serde_json::from_slice::<BlenderResponse>(&buf).is_ok() {
                break;
            }
        }

        let resp: BlenderResponse = serde_json::from_slice(&buf)
            .map_err(|e| format!("Parse failed: {}", e))?;

        if resp.status == "success" {
            Ok(resp.result.unwrap_or(serde_json::Value::Null))
        } else {
            Err(resp.message.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    pub fn list_sessions(&self) -> Vec<(String, u16, String)> {
        self.sessions
            .iter()
            .map(|e| (e.id.clone(), e.port, e.label.clone()))
            .collect()
    }
}
```

### 4.3 Tauri commands (src-tauri/src/commands/blender.rs)

```rust
use crate::blender::manager::BlenderManager;
use tauri::State;

type BM = State<'_, std::sync::Arc<BlenderManager>>;

#[tauri::command]
pub async fn blender_connect(
    manager: BM,
    port: u16,
    label: String,
) -> Result<String, String> {
    manager.connect(port, label).await
}

#[tauri::command]
pub async fn blender_disconnect(manager: BM, session_id: String) {
    manager.disconnect(&session_id).await;
}

#[tauri::command]
pub async fn blender_send_command(
    manager: BM,
    session_id: String,
    command: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    manager.send_command(&session_id, &command, params).await
}

#[tauri::command]
pub async fn blender_list_sessions(
    manager: BM,
) -> Vec<serde_json::Value> {
    manager.list_sessions()
        .into_iter()
        .map(|(id, port, label)| {
            serde_json::json!({ "id": id, "port": port, "label": label })
        })
        .collect()
}
```

### 4.4 main.rs

```rust
mod blender;
mod commands;
mod sidecar;
mod db;

use std::sync::Arc;
use blender::manager::BlenderManager;
use sidecar::manager::SidecarManager;

fn main() {
    let blender_manager = Arc::new(BlenderManager::new());
    let sidecar_manager = Arc::new(SidecarManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:blendermcp.db", db::get_migrations())
            .build())
        .plugin(tauri_plugin_stronghold::Builder::new(|_| vec![]).build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .manage(blender_manager)
        .manage(sidecar_manager)
        .invoke_handler(tauri::generate_handler![
            commands::blender::blender_connect,
            commands::blender::blender_disconnect,
            commands::blender::blender_send_command,
            commands::blender::blender_list_sessions,
            commands::sidecar::sidecar_start,
            commands::sidecar::sidecar_stop,
            commands::sidecar::sidecar_status,
            commands::settings::settings_save_key,
            commands::settings::settings_get_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4.5 SQLite schema (src-tauri/src/db/migrations/001_initial.sql)

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    model       TEXT,
    provider    TEXT,
    blender_session_id TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK(role IN ('user','assistant','tool','system')),
    content         TEXT NOT NULL,          -- JSON (text or tool_use blocks)
    tool_name       TEXT,                   -- populated for role='tool'
    tool_call_id    TEXT,
    screenshot_path TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    prompt      TEXT NOT NULL,
    tags        TEXT,                       -- JSON array of strings
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
```

**Phase 2 checkpoint**: `cargo build` compiles cleanly. `blender_connect` IPC call succeeds when Blender is open with addon enabled.

---

## 5. Phase 3 — Python Sidecar (Week 3)

### 5.1 requirements.txt (packages/sidecar/)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
websockets==13.0
litellm==1.50.0
mcp>=1.3.0
httpx>=0.27.0
pydantic>=2.0
python-dotenv==1.0.0
```

### 5.2 Pydantic models (packages/sidecar/models.py)

```python
from pydantic import BaseModel
from typing import Any, Optional, Literal

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "tool", "system"]
    content: str | list[dict]
    tool_call_id: Optional[str] = None
    name: Optional[str] = None

class StreamRequest(BaseModel):
    conversation_id: str
    messages: list[ChatMessage]
    provider: str               # "anthropic" | "openai" | "litellm_proxy" | "ollama" | "lmstudio"
    model: str                  # e.g. "claude-sonnet-4-6", "gpt-4o", "llama3.2"
    api_key: Optional[str] = None
    api_base: Optional[str] = None   # for Ollama / LM Studio
    blender_session_port: Optional[int] = 9876
    temperature: float = 0.7
    max_tokens: int = 4096

# WebSocket events emitted to frontend
class WSEvent(BaseModel):
    type: str
    # text_delta: {"type": "text_delta", "delta": "..."}
    # tool_start: {"type": "tool_start", "tool_name": "...", "tool_use_id": "..."}
    # tool_input: {"type": "tool_input", "tool_use_id": "...", "delta": {...}}
    # tool_result: {"type": "tool_result", "tool_use_id": "...", "result": {...}, "is_error": false}
    # message_end: {"type": "message_end", "stop_reason": "end_turn", "usage": {...}}
    # error: {"type": "error", "message": "..."}
    data: dict[str, Any] = {}
```

### 5.3 MCP client (packages/sidecar/mcp_client.py)

```python
import asyncio
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# One MCP session per Blender port
_sessions: dict[int, tuple] = {}   # port → (session, context_stack)

async def get_mcp_session(port: int = 9876) -> ClientSession:
    if port not in _sessions:
        await _connect(port)
    return _sessions[port][0]

async def _connect(port: int):
    env = {
        **os.environ,
        "BLENDER_PORT": str(port),
        "DISABLE_TELEMETRY": "true",
    }
    server_params = StdioServerParameters(
        command="uvx",
        args=["blender-mcp"],
        env=env,
    )
    # We keep the context managers open for the process lifetime
    cm = stdio_client(server_params)
    read, write = await cm.__aenter__()
    session_cm = ClientSession(read, write)
    session = await session_cm.__aenter__()
    await session.initialize()
    _sessions[port] = (session, [cm, session_cm])

async def disconnect_mcp(port: int):
    if port in _sessions:
        session, cms = _sessions.pop(port)
        for cm in reversed(cms):
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass

async def list_mcp_tools(port: int = 9876) -> list[dict]:
    session = await get_mcp_session(port)
    result = await session.list_tools()
    return [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.inputSchema,
        }
        for t in result.tools
    ]

async def call_mcp_tool(port: int, tool_name: str, arguments: dict) -> dict:
    session = await get_mcp_session(port)
    result = await session.call_tool(tool_name, arguments)
    # result.content is list[TextContent | ImageContent | EmbeddedResource]
    parts = []
    for c in result.content:
        if hasattr(c, "text"):
            parts.append({"type": "text", "text": c.text})
        elif hasattr(c, "data"):
            parts.append({"type": "image", "data": c.data, "mimeType": c.mimeType})
    return {
        "content": parts,
        "isError": result.isError,
    }
```

### 5.4 LLM bridge (packages/sidecar/llm_bridge.py)

```python
import asyncio
import json
from typing import AsyncIterator
import litellm
from mcp_client import list_mcp_tools, call_mcp_tool
from models import StreamRequest, ChatMessage

litellm.set_verbose = False

def _provider_model(req: StreamRequest) -> tuple[str, dict]:
    """Return (litellm model string, extra kwargs)."""
    extras: dict = {}
    if req.provider == "anthropic":
        model = f"anthropic/{req.model}"
        extras["api_key"] = req.api_key
    elif req.provider == "openai":
        model = f"openai/{req.model}"
        extras["api_key"] = req.api_key
    elif req.provider == "ollama":
        model = f"ollama/{req.model}"
        extras["api_base"] = req.api_base or "http://localhost:11434"
    elif req.provider == "lmstudio":
        model = f"openai/{req.model}"
        extras["api_base"] = req.api_base or "http://localhost:1234/v1"
        extras["api_key"] = "lm-studio"
    elif req.provider == "litellm_proxy":
        model = req.model
        extras["api_base"] = req.api_base
        extras["api_key"] = req.api_key
    elif req.provider == "gemini":
        model = f"gemini/{req.model}"
        extras["api_key"] = req.api_key
    elif req.provider == "groq":
        model = f"groq/{req.model}"
        extras["api_key"] = req.api_key
    else:
        model = req.model
    return model, extras

async def stream_chat(req: StreamRequest) -> AsyncIterator[dict]:
    """
    Agentic loop: stream LLM tokens, execute tool calls via MCP, yield WS events.
    Yields dicts that match WSEvent shape.
    """
    port = req.blender_session_port or 9876
    mcp_tools = await list_mcp_tools(port)
    
    # Convert MCP tool schemas to LiteLLM tool format
    litellm_tools = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["inputSchema"],
            }
        }
        for t in mcp_tools
    ]

    messages = [m.model_dump(exclude_none=True) for m in req.messages]
    model, extras = _provider_model(req)

    while True:
        pending_tool_calls: dict[str, dict] = {}   # id → {name, args_buffer}

        response = await litellm.acompletion(
            model=model,
            messages=messages,
            tools=litellm_tools,
            tool_choice="auto",
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            stream=True,
            **extras,
        )

        assistant_content = []
        stop_reason = None

        async for chunk in response:
            choice = chunk.choices[0]
            delta = choice.delta

            # Text tokens
            if delta.content:
                yield {"type": "text_delta", "delta": delta.content}
                assistant_content.append({"type": "text", "text": delta.content})

            # Tool call streaming
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    tid = tc.id or list(pending_tool_calls.keys())[-1] if pending_tool_calls else None
                    if tc.id:
                        pending_tool_calls[tc.id] = {
                            "name": tc.function.name or "",
                            "args_buffer": tc.function.arguments or "",
                            "id": tc.id,
                        }
                        yield {"type": "tool_start", "tool_name": tc.function.name, "tool_use_id": tc.id}
                    elif tid:
                        pending_tool_calls[tid]["args_buffer"] += tc.function.arguments or ""
                        if tc.function.name:
                            pending_tool_calls[tid]["name"] = tc.function.name

            if choice.finish_reason:
                stop_reason = choice.finish_reason

        # If tool calls, execute them
        if pending_tool_calls and stop_reason == "tool_calls":
            # Build assistant message with tool_calls
            tool_calls_block = [
                {
                    "id": v["id"],
                    "type": "function",
                    "function": {"name": v["name"], "arguments": v["args_buffer"]},
                }
                for v in pending_tool_calls.values()
            ]
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": tool_calls_block,
            })

            # Execute each tool via MCP
            for tc_id, tc in pending_tool_calls.items():
                try:
                    args = json.loads(tc["args_buffer"] or "{}")
                except json.JSONDecodeError:
                    args = {}

                yield {"type": "tool_input", "tool_use_id": tc_id, "input": args}

                try:
                    result = await call_mcp_tool(port, tc["name"], args)
                    is_error = result.get("isError", False)
                    content_text = json.dumps(result["content"])
                    yield {
                        "type": "tool_result",
                        "tool_use_id": tc_id,
                        "tool_name": tc["name"],
                        "result": result["content"],
                        "is_error": is_error,
                    }
                except Exception as e:
                    content_text = str(e)
                    is_error = True
                    yield {"type": "tool_result", "tool_use_id": tc_id, "result": str(e), "is_error": True}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc_id,
                    "content": content_text,
                })

            # Continue loop (re-enter LLM with tool results)
            continue

        # No tool calls — we're done
        yield {
            "type": "message_end",
            "stop_reason": stop_reason,
        }
        break
```

### 5.5 FastAPI main (packages/sidecar/main.py)

```python
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from mcp_client import list_mcp_tools, disconnect_mcp
from llm_bridge import stream_chat
from models import StreamRequest

app = FastAPI(title="BlenderMCP Studio Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["tauri://localhost", "http://localhost:1420"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/tools/{port}")
async def get_tools(port: int = 9876):
    tools = await list_mcp_tools(port)
    return {"tools": tools}

@app.delete("/session/{port}")
async def delete_session(port: int):
    await disconnect_mcp(port)
    return {"status": "disconnected"}

@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            req = StreamRequest.model_validate_json(data)
            async for event in stream_chat(req):
                await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
```

### 5.6 PyInstaller build (packages/sidecar/build.py)

```python
"""Run: python build.py"""
import PyInstaller.__main__
import sys

args = [
    "main.py",
    "--name=sidecar",
    "--onefile",
    "--hidden-import=litellm",
    "--hidden-import=mcp",
    "--hidden-import=fastapi",
    "--hidden-import=uvicorn",
    "--hidden-import=websockets",
    "--collect-all=litellm",
    "--collect-all=mcp",
    "--noconfirm",
    "--distpath=dist",
]

if sys.platform == "win32":
    args.append("--console")  # Keep console for debugging; remove for release

PyInstaller.__main__.run(args)
```

### 5.7 Rust sidecar manager (src-tauri/src/sidecar/manager.rs)

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri_plugin_shell::ShellExt;

pub struct SidecarManager {
    running: AtomicBool,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self { running: AtomicBool::new(false) }
    }

    pub async fn start(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Ok(());
        }
        let sidecar = app_handle
            .shell()
            .sidecar("sidecar")
            .map_err(|e| e.to_string())?;

        let (_rx, _child) = sidecar
            .spawn()
            .map_err(|e| e.to_string())?;

        self.running.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}
```

**Phase 3 checkpoint**: `python main.py` starts on port 8765. WebSocket chat returns streaming events when a Blender instance is open on port 9876.

---

## 6. Phase 4 — React UI (Week 4)

### 6.1 Zustand stores

#### chatStore.ts
```typescript
import { create } from "zustand";

export type MessageRole = "user" | "assistant" | "tool" | "system";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  screenshotPath?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model?: string;
  provider?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  activeToolCallId: string | null;

  setActiveConversation: (id: string) => void;
  addMessage: (convId: string, msg: Message) => void;
  appendStreamDelta: (delta: string) => void;
  setStreaming: (val: boolean) => void;
  finalizeStreamingMessage: (convId: string) => void;
  updateToolCallResult: (convId: string, toolUseId: string, result: unknown, isError: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  streamingContent: "",
  activeToolCallId: null,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (convId, msg) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, messages: [...c.messages, msg] } : c
      ),
    })),

  appendStreamDelta: (delta) =>
    set((s) => ({ streamingContent: s.streamingContent + delta })),

  setStreaming: (val) => set({ isStreaming: val, streamingContent: val ? "" : get().streamingContent }),

  finalizeStreamingMessage: (convId) => {
    const content = get().streamingContent;
    if (!content) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt: Date.now(),
    };
    get().addMessage(convId, msg);
    set({ streamingContent: "", isStreaming: false });
  },

  updateToolCallResult: (convId, toolUseId, result, isError) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) => ({
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.id === toolUseId ? { ...tc, result, isError } : tc
                ),
              })),
            }
          : c
      ),
    })),
}));
```

#### blenderStore.ts
```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface BlenderSession {
  id: string;
  port: number;
  label: string;
  connected: boolean;
}

interface BlenderState {
  sessions: BlenderSession[];
  activeSessionId: string | null;
  connect: (port: number, label: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useBlenderStore = create<BlenderState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  connect: async (port, label) => {
    const id = await invoke<string>("blender_connect", { port, label });
    await get().refresh();
    set({ activeSessionId: id });
  },

  disconnect: async (id) => {
    await invoke("blender_disconnect", { sessionId: id });
    await get().refresh();
  },

  refresh: async () => {
    const raw = await invoke<Array<{id:string;port:number;label:string}>>("blender_list_sessions");
    set({
      sessions: raw.map((s) => ({ ...s, connected: true })),
    });
  },
}));
```

#### settingsStore.ts
```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type Provider = "anthropic" | "openai" | "gemini" | "groq" | "ollama" | "lmstudio" | "litellm_proxy";

export interface ProviderConfig {
  provider: Provider;
  apiKey?: string;
  apiBase?: string;
  model: string;
}

interface SettingsState {
  activeProvider: ProviderConfig;
  setProvider: (cfg: ProviderConfig) => void;
  saveApiKey: (provider: string, key: string) => Promise<void>;
  loadApiKey: (provider: string) => Promise<string | null>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeProvider: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  },

  setProvider: (cfg) => set({ activeProvider: cfg }),

  saveApiKey: async (provider, key) => {
    await invoke("settings_save_key", { provider, key });
  },

  loadApiKey: async (provider) => {
    return invoke<string | null>("settings_get_key", { provider });
  },
}));
```

### 6.2 useWebSocket hook (src/hooks/useWebSocket.ts)

```typescript
import { useRef, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";

const WS_URL = "ws://127.0.0.1:8765/ws/chat";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const store = useChatStore();

  const sendChat = useCallback(
    (payload: object, conversationId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      store.setStreaming(true);

      ws.onopen = () => ws.send(JSON.stringify(payload));

      ws.onmessage = (ev) => {
        const event = JSON.parse(ev.data) as {
          type: string;
          delta?: string;
          tool_name?: string;
          tool_use_id?: string;
          input?: Record<string, unknown>;
          result?: unknown;
          is_error?: boolean;
          stop_reason?: string;
          message?: string;
        };

        switch (event.type) {
          case "text_delta":
            store.appendStreamDelta(event.delta ?? "");
            break;
          case "tool_start":
            // Add tool call placeholder to current streaming message
            break;
          case "tool_result":
            store.updateToolCallResult(
              conversationId,
              event.tool_use_id ?? "",
              event.result,
              event.is_error ?? false
            );
            break;
          case "message_end":
            store.finalizeStreamingMessage(conversationId);
            ws.close();
            break;
          case "error":
            console.error("Sidecar error:", event.message);
            store.setStreaming(false);
            ws.close();
            break;
        }
      };

      ws.onerror = () => store.setStreaming(false);
      ws.onclose = () => {
        if (store.isStreaming) store.finalizeStreamingMessage(conversationId);
      };
    },
    [store]
  );

  const abort = useCallback(() => {
    wsRef.current?.close();
    store.setStreaming(false);
  }, [store]);

  return { sendChat, abort };
}
```

### 6.3 ChatWindow component (src/components/chat/ChatWindow.tsx)

```tsx
import { useRef, useEffect, useState } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBlenderStore } from "../../stores/blenderStore";
import { useWebSocket } from "../../hooks/useWebSocket";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Send, Square } from "lucide-react";

export default function ChatWindow() {
  const store = useChatStore();
  const settings = useSettingsStore();
  const blender = useBlenderStore();
  const { sendChat, abort } = useWebSocket();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = store.conversations.find(
    (c) => c.id === store.activeConversationId
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, store.streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || store.isStreaming || !store.activeConversationId) return;
    const convId = store.activeConversationId;
    const userMsg = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: input.trim(),
      createdAt: Date.now(),
    };
    store.addMessage(convId, userMsg);
    setInput("");

    const messages = [
      ...(activeConv?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userMsg.content },
    ];

    const cfg = settings.activeProvider;
    const apiKey = await settings.loadApiKey(cfg.provider);
    const activeSession = blender.sessions.find((s) => s.id === blender.activeSessionId);

    sendChat(
      {
        conversation_id: convId,
        messages,
        provider: cfg.provider,
        model: cfg.model,
        api_key: apiKey,
        api_base: cfg.apiBase,
        blender_session_port: activeSession?.port ?? 9876,
      },
      convId
    );
  };

  return (
    <div className="flex flex-col h-full bg-blender-dark">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeConv?.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {store.isStreaming && (
          <>
            {store.streamingContent && (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: store.streamingContent,
                  createdAt: Date.now(),
                }}
                isStreaming
              />
            )}
            <TypingIndicator />
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-blender-panel p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask BlenderMCP Studio..."
            className="bg-blender-gray border-blender-panel text-white resize-none"
            rows={3}
            disabled={store.isStreaming}
          />
          <div className="flex flex-col gap-2">
            {store.isStreaming ? (
              <Button onClick={abort} variant="destructive" size="sm">
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSend} size="sm" disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 6.4 ToolCallCard component (src/components/chat/ToolCallCard.tsx)

```tsx
import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, AlertCircle, CheckCircle } from "lucide-react";

interface ToolCallCardProps {
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
}

export default function ToolCallCard({ name, input, result, isError }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-blender-panel bg-blender-gray text-sm my-1">
      <button
        className="flex items-center gap-2 w-full p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {isError ? (
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : result !== undefined ? (
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <Wrench className="w-4 h-4 text-blender-orange shrink-0 animate-pulse" />
        )}
        <span className="text-blender-orange font-mono font-medium">{name}</span>
        <span className="ml-auto text-gray-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-blender-panel p-3 space-y-2">
          <div>
            <p className="text-xs text-gray-400 mb-1">Input</p>
            <pre className="text-xs text-gray-200 overflow-auto max-h-40">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Result</p>
              <pre className={`text-xs overflow-auto max-h-40 ${isError ? "text-red-300" : "text-gray-200"}`}>
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Phase 4 checkpoint**: Full chat flow works end-to-end. User can type a prompt, see streaming tokens appear, tool calls show as cards, and Blender executes operations.

---

## 7. Phase 5 — Settings, Skills, and Polish (Week 5)

### 7.1 Rust commands for secure key storage (src-tauri/src/commands/settings.rs)

```rust
use tauri_plugin_stronghold::StrongholdExt;
use tauri::State;

#[tauri::command]
pub async fn settings_save_key(
    app: tauri::AppHandle,
    provider: String,
    key: String,
) -> Result<(), String> {
    // Use tauri-plugin-stronghold vault or fallback to sqlite
    // Simple approach: store in SQLite (encrypted column) for v1
    // TODO: upgrade to stronghold for production
    Ok(())
}

#[tauri::command]
pub async fn settings_get_key(
    app: tauri::AppHandle,
    provider: String,
) -> Result<Option<String>, String> {
    Ok(None)
}
```

> **Note**: For v1, store API keys in SQLite with a separate `api_keys` table. Migrate to `tauri-plugin-stronghold` in v2 for OS keychain integration.

SQLite `api_keys` table to add to `001_initial.sql`:
```sql
CREATE TABLE IF NOT EXISTS api_keys (
    provider    TEXT PRIMARY KEY,
    api_key     TEXT,
    api_base    TEXT,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 7.2 Provider Settings panel (src/components/settings/ProviderSettings.tsx)

```tsx
import { useState, useEffect } from "react";
import { useSettingsStore, Provider } from "../../stores/settingsStore";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

const PROVIDERS: Array<{ id: Provider; label: string; models: string[] }> = [
  { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"] },
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "gemini", label: "Google Gemini", models: ["gemini-2.0-flash", "gemini-1.5-pro"] },
  { id: "groq", label: "Groq", models: ["llama-3.1-70b-versatile", "mixtral-8x7b-32768"] },
  { id: "ollama", label: "Ollama (local)", models: ["llama3.2", "mistral", "gemma2"] },
  { id: "lmstudio", label: "LM Studio (local)", models: ["local-model"] },
];

export default function ProviderSettings() {
  const settings = useSettingsStore();
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");

  const isLocal = selectedProvider === "ollama" || selectedProvider === "lmstudio";

  const handleSave = async () => {
    if (apiKey) await settings.saveApiKey(selectedProvider, apiKey);
    settings.setProvider({
      provider: selectedProvider,
      model: selectedModel,
      apiKey: isLocal ? undefined : apiKey,
      apiBase: isLocal ? (apiBase || undefined) : undefined,
    });
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold text-white">LLM Provider</h2>
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelectedProvider(p.id); setSelectedModel(p.models[0]); }}
            className={`p-2 rounded border text-sm ${
              selectedProvider === p.id
                ? "border-blender-orange text-blender-orange"
                : "border-blender-panel text-gray-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!isLocal && (
        <div>
          <Label className="text-gray-300">API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="bg-blender-gray border-blender-panel text-white mt-1"
          />
        </div>
      )}

      {isLocal && (
        <div>
          <Label className="text-gray-300">API Base URL (optional)</Label>
          <Input
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder={selectedProvider === "ollama" ? "http://localhost:11434" : "http://localhost:1234/v1"}
            className="bg-blender-gray border-blender-panel text-white mt-1"
          />
        </div>
      )}

      <div>
        <Label className="text-gray-300">Model</Label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full p-2 rounded bg-blender-gray border border-blender-panel text-white mt-1"
        >
          {PROVIDERS.find((p) => p.id === selectedProvider)?.models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <Button onClick={handleSave} className="bg-blender-orange hover:bg-orange-600 text-white">
        Save Settings
      </Button>
    </div>
  );
}
```

### 7.3 Blender connection panel (src/components/settings/BlenderSettings.tsx)

```tsx
import { useState } from "react";
import { useBlenderStore } from "../../stores/blenderStore";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Plug, Unplug } from "lucide-react";

export default function BlenderSettings() {
  const blender = useBlenderStore();
  const [port, setPort] = useState(9876);
  const [label, setLabel] = useState("Blender 1");

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold text-white">Blender Connections</h2>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-gray-300">Port</Label>
          <Input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="bg-blender-gray border-blender-panel text-white mt-1"
          />
        </div>
        <div className="flex-1">
          <Label className="text-gray-300">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-blender-gray border-blender-panel text-white mt-1"
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => blender.connect(port, label)}
            className="bg-green-700 hover:bg-green-600"
          >
            <Plug className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {blender.sessions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center justify-between p-3 rounded border ${
              s.id === blender.activeSessionId ? "border-blender-orange" : "border-blender-panel"
            } bg-blender-gray cursor-pointer`}
            onClick={() => blender.activeSessionId !== s.id && useBlenderStore.setState({ activeSessionId: s.id })}
          >
            <div>
              <p className="text-white text-sm font-medium">{s.label}</p>
              <p className="text-gray-400 text-xs">localhost:{s.port}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); blender.disconnect(s.id); }}
            >
              <Unplug className="w-4 h-4 text-red-400" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Phase 5 checkpoint**: Full UI is functional. Provider can be switched at runtime. Multiple Blender sessions work simultaneously.

---

## 8. Build & Packaging

### 8.1 Build Python sidecar

```bash
cd packages/sidecar
pip install -r requirements.txt pyinstaller
python build.py
# Output: packages/sidecar/dist/sidecar (or sidecar.exe on Windows)
```

### 8.2 Copy sidecar to Tauri resources

The `tauri.conf.json` `bundle.resources` entry copies `packages/sidecar/dist/sidecar*` automatically during `tauri build`. During dev, set `TAURI_SIDECAR_PATH` env var or configure a Vite plugin to copy it to `src-tauri/binaries/`.

For Tauri's sidecar to find the binary, it must be named with the target triple:
```bash
# Windows
cp dist/sidecar.exe ../apps/desktop/src-tauri/binaries/sidecar-x86_64-pc-windows-msvc.exe

# macOS arm64
cp dist/sidecar ../apps/desktop/src-tauri/binaries/sidecar-aarch64-apple-darwin

# Linux
cp dist/sidecar ../apps/desktop/src-tauri/binaries/sidecar-x86_64-unknown-linux-gnu
```

### 8.3 Build desktop app

```bash
cd apps/desktop
pnpm tauri build
# Outputs:
# Windows: src-tauri/target/release/bundle/nsis/BlenderMCP Studio_0.1.0_x64-setup.exe
# macOS:   src-tauri/target/release/bundle/dmg/BlenderMCP Studio_0.1.0_x64.dmg
# Linux:   src-tauri/target/release/bundle/appimage/blendermcp-studio_0.1.0_amd64.AppImage
```

### 8.4 Development workflow

```bash
# Terminal 1: Sidecar dev server (skip PyInstaller, run directly)
cd packages/sidecar
python main.py

# Terminal 2: Tauri dev (hot reload)
cd apps/desktop
pnpm tauri dev
```

---

## 9. IPC API Reference

### Tauri Commands (frontend → Rust via `invoke`)

| Command | Parameters | Returns |
|---------|-----------|---------|
| `blender_connect` | `port: number, label: string` | `session_id: string` |
| `blender_disconnect` | `session_id: string` | `void` |
| `blender_send_command` | `session_id: string, command: string, params: object` | `object` |
| `blender_list_sessions` | — | `Array<{id, port, label}>` |
| `sidecar_start` | — | `void` |
| `sidecar_stop` | — | `void` |
| `sidecar_status` | — | `{running: boolean}` |
| `settings_save_key` | `provider: string, key: string` | `void` |
| `settings_get_key` | `provider: string` | `string \| null` |

### WebSocket Events (`ws://127.0.0.1:8765/ws/chat`)

Send one `StreamRequest` JSON payload per connection. Receive events:

```typescript
// Token delta
{ type: "text_delta", delta: string }

// Tool invocation starting
{ type: "tool_start", tool_name: string, tool_use_id: string }

// Parsed tool input
{ type: "tool_input", tool_use_id: string, input: object }

// Tool execution result (from MCP)
{ type: "tool_result", tool_use_id: string, tool_name: string, result: unknown, is_error: boolean }

// Stream finished
{ type: "message_end", stop_reason: "end_turn" | "max_tokens" | "tool_calls" }

// Fatal error
{ type: "error", message: string }
```

---

## 10. MCP Tool Reference

All tools are called via `call_mcp_tool(port, tool_name, arguments)` in `mcp_client.py`. The python-mcp SDK manages the `uvx blender-mcp` subprocess.

### Core tools (always available)
| Tool | Key args | Description |
|------|----------|-------------|
| `get_scene_info` | — | Scene name, object list, counts |
| `get_object_info` | `object_name` | Full object data + AABB |
| `get_viewport_screenshot` | `max_size=800` | Returns PNG as base64 Image |
| `execute_blender_code` | `code` | Execute arbitrary bpy Python |

### PolyHaven tools
| Tool | Key args |
|------|----------|
| `get_polyhaven_categories` | `asset_type` |
| `search_polyhaven_assets` | `asset_type, query, categories` |
| `download_polyhaven_asset` | `asset_id, asset_type, resolution, file_format` |
| `set_texture` | `object_name, asset_id` |

### Hyper3D / Rodin tools
| Tool | Key args |
|------|----------|
| `generate_hyper3d_model_via_text` | `text_prompt, hyper3d_mode` |
| `generate_hyper3d_model_via_images` | `input_image_paths or input_image_urls` |
| `poll_rodin_job_status` | `task_uuid` |
| `import_generated_asset` | `task_uuid, name` |

### Sketchfab tools
| Tool | Key args |
|------|----------|
| `search_sketchfab_models` | `query, count` |
| `get_sketchfab_model_preview` | `uid` |
| `download_sketchfab_model` | `uid, name` |

### Hunyuan3D tools
| Tool | Key args |
|------|----------|
| `generate_hunyuan3d_model` | `input_image_url, hunyuan3d_mode` |
| `poll_hunyuan_job_status` | `task_id` |
| `import_generated_asset_hunyuan` | `task_id, name, zip_file_url` |

---

## 11. Critical Implementation Notes

1. **addon.py health check on every tool call**: `server.py` sends `get_polyhaven_status` on every `get_blender_connection()` call. Our Rust BlenderManager should send a lightweight ping (`get_scene_info`) when establishing a session and periodically (every 30s) to detect disconnection.

2. **Screenshot is file-based**: The `get_viewport_screenshot` MCP tool returns an Image content type. The underlying addon saves to a temp file; server.py reads it back. In our UI, receive the base64 image data in the `tool_result` event and render with `<img src="data:image/png;base64,...">`.

3. **All object manipulation via `execute_blender_code`**: There is no `create_object` or `set_material` MCP tool. Everything goes through `execute_blender_code` with bpy API calls. The LLM must write Python code.

4. **Free Hyper3D key**: `RODIN_FREE_TRIAL_KEY = "vibecoding"` — hardcoded in addon.py. Users can use this without their own key for testing.

5. **Multi-Blender**: Spawn one `uvx blender-mcp` per port. Pass `BLENDER_PORT=<port>` env var. Manage separate `ClientSession` instances in `mcp_client.py`'s `_sessions` dict.

6. **LM Studio + Ollama auth**: Pass `api_key="lm-studio"` (any non-empty string) for LM Studio. Ollama needs no API key but needs `api_base`.

7. **Tauri CSP**: The Content Security Policy in `tauri.conf.json` must allow `ws://localhost:8765` and `http://localhost:8765` for sidecar communication.

8. **PyInstaller and litellm**: LiteLLM has many optional provider SDKs. Use `--collect-all=litellm` to bundle all provider stubs. If bundle size is too large, use `--hidden-import` selectively.

9. **Sidecar port conflict**: If port 8765 is taken, add port auto-discovery: try 8765–8775 in sequence, communicate the actual port to Tauri via stdout on startup.

10. **Windows antivirus**: PyInstaller bundles are frequently flagged. For distribution, code-sign the sidecar `.exe` with a certificate, or instruct users to add the app to antivirus exceptions.

---

## 12. Testing Checkpoints

| Phase | Checkpoint |
|-------|-----------|
| 1 | `pnpm tauri dev` opens window; React renders; hot reload works |
| 2 | `invoke("blender_connect", {port: 9876, label: "test"})` returns session ID when Blender is open with addon |
| 2 | `invoke("blender_send_command", {..., command: "get_scene_info", params: {}})` returns scene JSON |
| 3 | `python main.py` starts; GET /health returns `{"status":"ok"}` |
| 3 | GET /tools/9876 returns list of 22 tools |
| 3 | WebSocket chat to `/ws/chat` with provider=ollama returns streaming events |
| 4 | Full chat loop: user types → tokens stream → tool cards appear → Blender executes |
| 4 | Provider switch at runtime works (Anthropic → Ollama) |
| 5 | `pnpm tauri build` produces installer |
| 5 | Installed app: sidecar auto-starts on launch; Blender connection persists across sessions |

---

## 13. Files to Copy from This Device

When porting to Antigravity's terminal, these files must be available or re-cloned:

| Source | Destination in new repo |
|--------|------------------------|
| `addons/blender-mcp-realworks/addon.py` | Copy to `addons/blender-mcp-realworks/addon.py` (or re-clone) |
| This `final_plan.md` | Reference document during implementation |

The upstream `blender-mcp-realworks` repo is public — re-clone it:
```bash
git clone https://github.com/Gopikrish-30/blender-mcp-realworks.git addons/blender-mcp-realworks
```

The Python sidecar uses `uvx blender-mcp` which installs from PyPI — no local source needed.

---

## 14. Estimated Timeline

| Phase | Work | Duration |
|-------|------|----------|
| 1 | Monorepo scaffold, Tauri app, shadcn setup | 2 days |
| 2 | Rust TCP manager, IPC commands, SQLite schema | 3 days |
| 3 | Python sidecar: LiteLLM + MCP client + FastAPI WS | 3 days |
| 4 | React UI: chat, streaming, tool cards, stores | 4 days |
| 5 | Settings panels, Skills library, packaging | 3 days |
| — | Polish, bug fixes, cross-platform testing | 2 days |
| **Total** | | **~17 days** |

---

*Generated: 2026-06-20. Stack: Tauri 2.0 + React 18 + TypeScript + Tailwind + shadcn/ui + Zustand (frontend); Python 3.11 + FastAPI + LiteLLM + python-mcp (sidecar); Rust tokio (backend). Upstream: Gopikrish-30/blender-mcp-realworks v1.6.0.*
