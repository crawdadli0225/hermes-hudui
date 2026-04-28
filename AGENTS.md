# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What This Is

Hermes HUD Web UI — a browser-based dashboard for monitoring the Hermes AI agent. It reads agent data from `~/.hermes/` and displays identity, memory, skills, sessions, cron jobs, projects, costs, activity patterns, corrections, sudo governance, and live chat across 14 tabs.

## Commands

### Development Setup (one-time)
```bash
./install.sh        # Builds frontend, installs Python package
```

### Full-Stack Dev
```bash
hermes-hudui --dev          # Terminal 1: backend on :3001 (auto-reload)
cd frontend && npm run dev  # Terminal 2: frontend on :5173 (proxies /api → :3001)
```

### Frontend
```bash
cd frontend
npm run dev      # Dev server on :5173
npm run build    # Production build (runs tsc first)
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Backend CLI
```bash
hermes-hudui                         # Serve on :3001
hermes-hudui --port 8080             # Custom port
hermes-hudui --hermes-dir /path      # Override ~/.hermes/ location
```

### Release Workflow
```bash
# 1. Bump version in: pyproject.toml, App.tsx, BootScreen.tsx, CHANGELOG.md
# 2. Build + deploy static assets:
cd frontend && npm run build && cd ..
rm -rf backend/static/assets/* && cp -r frontend/dist/* backend/static/
# 3. Commit, tag, push:
git add -f backend/static/assets/ && git commit && git tag v0.X.Y && git push --tags
# 4. GitHub release:
gh release create v0.X.Y --title "v0.X.Y" --notes "..."
```

## Architecture

```
React Frontend (Vite + Tailwind)
    ↓ /api/* (proxied in dev)
FastAPI Backend (Python)
    ↓ collectors/*.py        ↓ chat/engine.py
~/.hermes/ (agent data)     hermes CLI (subprocess)
```

### Backend (`backend/`)

- **`main.py`** — FastAPI app + CLI entry point. Sets `HERMES_HOME`, starts Uvicorn.
- **`collectors/`** — One module per data domain (memory, skills, sessions, cron, projects, patterns, sudo). Each reads `~/.hermes/` and returns dataclasses from `models.py`.
- **`models.py`** — All dataclasses (`HUDState`, `MemoryState`, `SkillsState`, etc.). `@property` fields are included in serialization.
- **`serialize.py`** — `to_dict()` recursively converts dataclasses to JSON-safe dicts.
- **`routes/`** — FastAPI route handlers that call collectors and return serialized data.
- **`api/memory.py`** — CRUD endpoints for memory editing. Uses `fcntl.flock` + atomic writes (`tempfile.mkstemp` → `os.replace`) matching hermes-agent's `MemoryStore` locking pattern.
- **`api/sessions.py`** — Session search (title + FTS). Filters `source != 'tool'` to exclude HUD-generated sessions.
- **`api/chat.py`** — Chat session CRUD, SSE streaming endpoint, cancel endpoint.
- **`chat/engine.py`** — Singleton `ChatEngine` spawning `hermes chat -q <msg> -Q --source tool` per message. Captures `hermes_session_id` from stdout, queries `state.db` post-completion for tool calls and reasoning.
- **`chat/streamer.py`** — SSE event emitter (`emit_token`, `emit_tool_start`, `emit_tool_end`, `emit_reasoning`, `emit_done`).
- **`cache.py`** — Mtime-based cache invalidation (sessions 30s, skills 60s, patterns 60s, profiles 45s). Endpoints: `GET /api/cache/stats`, `POST /api/cache/clear`.
- **`websocket.py`** — Watches `~/.hermes/` via `watchfiles`, broadcasts `data_changed` events. Frontend auto-refreshes via SWR mutation.

### Frontend (`frontend/src/`)

- **`App.tsx`** — Root: tab manager, theme provider, command palette. Chat tab uses fixed-height container; other tabs scroll normally.
- **`hooks/useApi.ts`** — SWR wrapper with auto-refresh, 5s dedup, 3 retries.
- **`hooks/useChat.ts`** — Chat state: SSE streaming, session CRUD, per-session message cache (in-memory `Map` + localStorage persistence). Restores messages on session switch and page refresh.
- **`components/Panel.tsx`** — Shared panel wrapper (title, border, glow). Exports `CapacityBar`, `Sparkline`. `noPadding` prop for ChatPanel.
- **`components/chat/`** — `SessionSidebar`, `MessageThread`, `MessageBubble`, `Composer`, `ToolCallCard`, `ReasoningBlock`.
- **`components/MemoryPanel.tsx`** — Inline editing with hover-reveal controls, two-click delete, expandable add form.
- **`lib/utils.ts`** — `timeAgo()`, `formatDur()`, `formatTokens()`, `formatSize()`, `truncate()`.

## Key Conventions

**Adding a tab:** Create collector in `backend/collectors/`, dataclass in `models.py`, route in `backend/routes/`, panel component with `useApi`, register in `TopBar.tsx` TABS + `App.tsx` TabContent/GRID_CLASS.

**Chat engine:** Stateless per-message subprocess. No backend message persistence — history lives in localStorage. On server restart, ChatPanel re-creates backend sessions and migrates localStorage keys to new IDs.

**Memory editing:** Sync `def` endpoints (not `async`) so FastAPI auto-threads blocking I/O. File locking via `fcntl.flock` on `.lock` files. Atomic writes via `tempfile.mkstemp` + `os.replace`. Entries delimited by `\n§\n`.

**Styling:** Tailwind for layout, CSS variables (`var(--hud-*)`) for theming. Funnel Sans font. Four themes: `ai`, `blade-runner`, `fsociety`, `anime`.

**TypeScript:** Use `any` for API response types — schema owned by backend.

**Version strings:** Must stay in sync across `pyproject.toml`, `App.tsx` status bar, `BootScreen.tsx`, and `CHANGELOG.md`.

**Token costs:** Hardcoded `MODEL_PRICING` in `backend/api/token_costs.py`. Falls back to Codex Opus pricing for unknown models.

**Sudo collector:** `backend/collectors/sudo.py` mines `state.db` tool-output messages via FTS for sudo command executions, parses `config.yaml` for approval/security settings, and tails `logs/gateway.log` for explicitly approved commands. Outcome classification: `exit_code=-1` + "approval" in error = blocked; password error in output = failed; `exit_code=0` = success.

**Shared YAML loader:** `backend/collectors/utils.py` exports `load_yaml(text)` — tries `yaml.safe_load`, falls back to a minimal line parser. Used by `config.py` and `sudo.py`.

## Vast Monitor Integration

### Overview

Vast Monitor is a remote agent deployed on Vast.ai compute instances to provide real-time GPU metrics, system health, and recovery management. The HUD dashboard connects to this agent via HTTP to display status and control recovery workflows.

### Architecture

```
HUDUI Frontend (React)
    ↓ /api/vast/* endpoints
HUDUI Backend (FastAPI)
    ↓ backend/collectors/vast.py + backend/api/vast.py
Remote Vast Monitor Agent (FastAPI, port 8005)
    ↓ GPU metrics (nvidia-smi)
    ↓ System metrics (psutil)
    ↓ Recovery workflows (background tasks)
Vast.ai GPU Container
```

### Remote Agent Deployment

The vast-monitor-agent is a standalone Python service that must be deployed on the remote Vast.ai instance.

**Files:**
- `/root/vast-monitor-agent/main.py` — FastAPI server with recovery endpoints
- `/root/vast-monitor-agent/requirements.txt` — Dependencies (fastapi, uvicorn, sse-starlette, psutil, requests)
- `/etc/systemd/system/vast-monitor.service` — Systemd service file (may not work in container; use manual startup)

**Setup:**
1. SSH to remote: `ssh -p 54647 root@61.71.33.195`
2. Clone/upload agent code to `/root/vast-monitor-agent/`
3. Install dependencies: `cd /root/vast-monitor-agent && pip install -r requirements.txt`
4. Start agent: `python3 main.py` (or configure systemd if available)
5. Verify: `curl http://localhost:8005/status`

**Manual startup (if systemd unavailable):**
```bash
nohup python3 /root/vast-monitor-agent/main.py > /root/vast-monitor-agent/agent.log 2>&1 &
```

### Backend Integration

**Models** (`backend/collectors/models.py`):
- `VastGPUStatus` — VRAM used/total, temp, utilization
- `VastSystemStatus` — CPU load, memory used, disk free
- `VastServiceStatus` — Slot occupancy, health status
- `TokenMetrics`, `TokenCumulative`, `TokenRealtime`, `TokenRequest` — Token usage stats
- `RecoveryState` — Recovery workflow state

**Collector** (`backend/collectors/vast.py`):
- `fetch_vast_status()` — Cached server status (5s TTL)
- `fetch_token_metrics()` — Real-time token metrics
- `send_recovery_command()` — Proxy recovery requests to remote agent
- `get_remote_url()` — Construct remote agent URLs

Configuration via environment variables:
- `VAST_REMOTE_IP` (default: "127.0.0.1")
- `VAST_REMOTE_PORT` (default: "8005")

**API Routes** (`backend/api/vast.py`):
- `GET /api/vast/status` — Server status (cached)
- `GET /api/vast/tokens` — Token metrics
- `POST /api/vast/recovery` — Trigger recovery action (full or step)
- `GET /api/vast/events` — SSE stream of recovery step events

### Remote Agent Endpoints

All endpoints are on the remote agent (port 8005) and proxied through the HUD backend:

**Status & Metrics:**
- `GET /status` — GPU, system, service status
- `GET /metrics/tokens` — Cumulative & realtime token usage

**Recovery:**
- `POST /recovery/full` — Start full 5-step recovery workflow
- `POST /recovery/step` — Execute single step
- `GET /events` — SSE stream of recovery events

**Recovery Steps:**
1. **Cleanup** — Kill lingering llama processes
2. **Socket** — Clear SSH socket and reset master connection
3. **Hard Reset** — Relaunch llama-server with clean state
4. **Verify** — Health check llama-server API
5. **Tunnel** — Rebuild SSH tunnel connection

### Frontend Integration

**Panel** (`frontend/src/components/VastPanel.tsx`):
- Real-time GPU/system metrics display
- Token usage sparklines
- Recovery button with step-by-step progress
- SSE event stream rendering

**Hooks** (`frontend/src/hooks/useVast.ts`):
- `useVastStatus()` — Fetch server status (auto-refresh)
- `useTokenMetrics()` — Fetch token metrics
- `useRecovery()` — Trigger recovery, stream events

### E2E Testing

**Verify service is running:**
```bash
ssh -p 54647 root@61.71.33.195 "ps aux | grep vast-monitor"
curl http://192.168.88.123:8005/status  # LAN IP of remote
```

**Test recovery workflow:**
```bash
# Trigger full recovery
curl -X POST http://localhost:3001/api/vast/recovery \
  -H "Content-Type: application/json" \
  -d '{"action": "full"}'

# Stream events (in another terminal)
curl -N http://localhost:3001/api/vast/events
```

**Expected SSE event sequence:**
```
event: message
data: {"step": 1, "msg": "Cleanup..."}

event: message
data: {"step": 2, "msg": "Socket reset..."}

event: message
data: {"step": 3, "msg": "Llama relaunched..."}

event: message
data: {"step": 4, "msg": "Health check passed"}

event: message
data: {"step": 5, "msg": "Tunnel rebuilt"}
```

### Troubleshooting

**Agent not responding:**
- Check SSH connection: `ssh -p 54647 root@61.71.33.195 "curl http://localhost:8005/status"`
- Restart agent manually: `ssh -p 54647 root@61.71.33.195 "pkill -f vast-monitor; python3 /root/vast-monitor-agent/main.py &"`

**Recovery stuck on a step:**
- Check remote logs: `ssh -p 54647 root@61.71.33.195 "tail -20 /root/vast-monitor-agent/agent.log"`
- Verify llama-server is running: `ssh -p 54647 root@61.71.33.195 "curl -s http://localhost:8080/v1/models | head -20"`

**Events not streaming:**
- Ensure remote agent is on v0.2+ with SSE support
- Test with: `curl -N http://localhost:8005/events &` and trigger recovery

### Configuration for Production

**Environment Setup:**
```bash
export VAST_REMOTE_IP="61.71.33.195"
export VAST_REMOTE_PORT="8005"
# Or set in .env file for HUDUI backend
```

**Firewall/Network:**
- Remote agent listens on 0.0.0.0:8005 (container internal)
- Access via SSH port 54647 (Vast.ai provided)
- No direct port 8005 access from external networks by default

**SSL/TLS:**
- For production: wrap HUDUI in nginx/reverse proxy with SSL
- Remote agent uses HTTP (internal container, SSH tunnel security is sufficient)
