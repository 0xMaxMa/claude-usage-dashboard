# Claude Code Usage Dashboard

A real-time utilization monitor for Claude Code (claude.ai) subscriptions. Tracks token usage, cost, and session limits via Anthropic's internal API, with a dark-themed web dashboard and an optional retro pixel theme.

![Dashboard](https://img.shields.io/badge/stack-Node.js%20%7C%20SQLite%20%7C%20Express-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Real-time usage tracking** — Session (5h window), Weekly All Models, Sonnet-only utilization
- **Auto-refresh** every 30 seconds (dashboard) + configurable fetch interval (default 5 min)
- **SQLite storage** — 7-day snapshot history with burn rate & prediction
- **Claude API Status** — full-width banner from `status.claude.com` (live component health)
- **History chart** — 24h bar chart with hover tooltips
- **Theme switcher** — 🌙 Default dark theme ↔ 🎮 Retro pixel theme (persisted via localStorage)
- **24-hour time format** throughout
- **Docker ready** — `Dockerfile` + `docker-compose.yml` with Caddy network support

---

## Prerequisites

- Node.js 22+
- A valid `claude.ai` session cookie (`SESSION_KEY`)
- Your Anthropic Org UUID (`ORG_ID`)

### Getting your credentials

1. Open [claude.ai](https://claude.ai) → DevTools → Application → Cookies
2. Copy the value of `sessionKey` → this is your `SESSION_KEY`
3. Run the org lookup:
```bash
curl -s "https://api.anthropic.com/api/organizations" \
  -H "Cookie: sessionKey=<YOUR_SESSION_KEY>" | python3 -m json.tool
```
4. Copy the `id` field → this is your `ORG_ID`

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd claude-usage-dashboard
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your values
```

`.env` format:
```env
SESSION_KEY=sk-ant-sid02-...
ORG_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PORT=3737
SCRAPE_INTERVAL_MIN=5
```

### 3. Run

```bash
npm start
# Dashboard available at http://localhost:3737
```

---

## Docker

### Using Make

```bash
make build    # docker compose down → rebuild → up -d
make up       # docker compose up -d
make down     # docker compose down
make logs     # tail logs
```

### Manual

```bash
docker compose up -d --build
```

> **Note:** Requires `caddy_net` Docker network. Create it if it doesn't exist:
> ```bash
> docker network create caddy_net
> ```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_KEY` | *(required)* | Claude.ai session cookie value |
| `ORG_ID` | *(required)* | Anthropic organization UUID |
| `PORT` | `3737` | HTTP server port |
| `SCRAPE_INTERVAL_MIN` | `5` | Usage fetch interval (minutes) |

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard UI |
| `GET /api/usage` | Latest usage snapshot (JSON) |
| `GET /api/history` | 24h snapshot history |
| `GET /api/health` | Health check + Claude API status |

---

## Project Structure

```
claude-usage-dashboard/
├── server.mjs          # Express server + scraper loop
├── scraper.mjs         # Anthropic API fetch logic
├── db.mjs              # SQLite operations (better-sqlite3)
├── config.mjs          # Environment config
├── public/
│   └── index.html      # Dashboard UI (Tailwind CSS + vanilla JS)
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── usage.db            # SQLite database (auto-created)
```

---

## Themes

Toggle between themes using the button in the top-right corner of the dashboard. The selected theme is saved to `localStorage` and persists across sessions.

| Theme | Description |
|-------|-------------|
| 🌙 **Default** | Dark Material Design theme |
| 🎮 **Retro** | Pixel art style — cream cards, brown diamond background |

---

## Public Access (optional)

Expose the dashboard publicly using [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/):

```bash
cloudflared tunnel --protocol http2 --url http://localhost:3737
```

For a persistent URL, configure a named Cloudflare tunnel or use Caddy as a reverse proxy.

---

## License

MIT
