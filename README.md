# ☤ Hermes HUD — Web UI

Web consciousness monitor for [Hermes](https://github.com/nousresearch/hermes-agent), the AI agent with persistent memory.

The browser version of [hermes-hud](https://github.com/joeynyc/hermes-hud) (TUI). Same data, same soul, rendered for the web.

## What It Shows

Everything your agent knows about itself — sessions, memory capacity, skills, tool usage patterns, cron jobs, projects, health checks, agent profiles, prompt pattern analytics. All pulled live from `~/.hermes/`.

## Quick Start

Requires Python 3.11+ and Node.js 18+.

```bash
git clone https://github.com/joeynyc/hermes-hudui.git
cd hermes-hudui
./install.sh
hermes-hudui
```

Then open http://localhost:3001

## Manual Install

```bash
# Backend
pip install -e path/to/hermes-hud    # the TUI package (for collectors)
pip install -e .                      # this package

# Frontend
cd frontend
npm install
npm run build
cp -r dist/* ../backend/static/

# Run
hermes-hudui                          # starts on :3001
hermes-hudui --port 8080              # custom port
hermes-hudui --dev                    # auto-reload for development
```

## Development

```bash
# Terminal 1: backend with auto-reload
hermes-hudui --dev

# Terminal 2: frontend dev server (hot reload, proxies /api to :3001)
cd frontend && npm run dev
```

Frontend dev server runs on :5173 and proxies API calls to the backend on :3001.

## Themes

Four color themes, switchable with `t` or the theme picker:

- **Neural Awakening** — cyan/blue on deep navy (default)
- **Blade Runner** — amber/orange on warm black
- **fsociety** — green on pure black
- **Anime** — purple/violet on indigo

Optional CRT scanline overlay (toggleable).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`-`9` | Switch tabs |
| `t` | Toggle theme picker |
| `r` | Refresh page |

## Architecture

```
backend/          FastAPI server — imports hermes-hud collectors directly
  api/            One endpoint per data source (memory, sessions, skills, etc.)
  static/         Built frontend files (served by FastAPI)
frontend/         React + Vite + TypeScript + Tailwind CSS
  src/components/ One panel per data domain
  src/hooks/      Theme system, SWR data fetching
```

The backend is a thin JSON wrapper around hermes-hud's existing Python collectors. No data logic is duplicated. The frontend fetches from `/api/*` endpoints and renders panels.

## Requirements

- Python 3.11+
- Node.js 18+ (for building frontend)
- [hermes-hud](https://github.com/joeynyc/hermes-hud) (pip installable)
- A running Hermes agent with data in `~/.hermes/`

## License

MIT
