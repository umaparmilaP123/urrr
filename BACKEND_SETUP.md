# UrbanGuard — Backend Setup Guide

UrbanGuard now has a real **Express + SQLite** backend. The frontend polls
the API every 8 seconds for live data instead of using fake `setInterval`
generators.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 (tested on 25.x) |
| npm | ≥ 9 |

---

## 1. Environment Files

### Frontend (root `.env`)
```
VITE_API_BASE_URL=
```
Leave `VITE_API_BASE_URL` **empty** in development — the Vite dev proxy
(`/api → http://localhost:5000`) handles forwarding automatically.
Only set it if you deploy the frontend separately from the backend.

Copy the example:
```bash
cp .env.example .env
```

### Backend (`server/.env`)
```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
SESSION_SECRET=change_me_to_a_long_random_secret_in_production
```

Copy the example and fill in your Gemini key:
```bash
cp server/.env.example server/.env
```

> **Note:** If `GEMINI_API_KEY` is missing or left as the placeholder, the
> vision endpoint returns `{ code: "NO_KEY" }` and `CameraModal` falls back to
> the simulated AI analysis — the rest of the app works normally.

---

## 2. Install Dependencies

```bash
# Root — installs frontend deps + concurrently
npm install

# Server — installs Express, sql.js, bcryptjs, etc.
cd server && npm install && cd ..
```

---

## 3. Seed the Database

Run once to create `server/urbanguard.db` with the 4 seed complaints,
4 IoT sensors, and the seeded authority account:

```bash
npm run seed
```

The script is **idempotent** — if the complaints table already has rows it
exits immediately, so you can safely re-run it without wiping real data.

**Seeded authority credentials:**
| Field | Value |
|---|---|
| Badge ID | `GHMC-ENG-2026` |
| Password | `admin` |

The password is stored as a bcrypt hash — `admin` never appears in the source
or database in plaintext.

---

## 4. Start Both Servers

```bash
npm run dev:all
```

This uses `concurrently` to start:
- **API** — `node --watch server/index.js` → `http://localhost:5000`
- **UI** — `vite` → `http://localhost:3000`

Or start them separately in two terminals:
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

---

## 5. Architecture Overview

```
Browser (port 3000)
  │
  ├── /api/*  ──── Vite proxy ────► Express (port 5000)
  │                                   │
  │                                   ├── GET  /api/complaints
  │                                   ├── POST /api/complaints
  │                                   ├── POST /api/complaints/:id/upvote
  │                                   ├── POST /api/complaints/:id/dispatch  [AUTHORITY]
  │                                   ├── POST /api/complaints/:id/escalate  [AUTHORITY]
  │                                   ├── POST /api/complaints/:id/resolve   [AUTHORITY]
  │                                   ├── GET  /api/iot-sensors
  │                                   ├── GET  /api/notifications
  │                                   ├── POST /api/auth/login
  │                                   ├── POST /api/auth/authority-login
  │                                   ├── POST /api/auth/logout
  │                                   └── POST /api/vision/analyze-hazard   [rate-limited 5/min]
  │                                         │
  │                                         └── Gemini Vision API (server-side only)
  │
  └── Static assets served by Vite
```

### Key design decisions

| Decision | Rationale |
|---|---|
| **sql.js (WASM SQLite)** | No native compilation — works on any platform without Visual Studio / build tools |
| **Vite proxy** | `/api/*` proxied to Express in dev → no CORS config needed, cookies are same-origin |
| **express-session + memorystore** | Simple httpOnly cookie sessions; sessions are ephemeral (reset on server restart) which is fine for dev |
| **bcryptjs (pure JS)** | No native deps; bcrypt hashes the authority password at seed time |
| **Polling every 8 s** | Replaces the fake `setInterval` WebSocket — real data, no Socket.io complexity |
| **Gemini proxy** | API key stays server-side; client never sees it; rate-limited at 5 req/min |

---

## 6. Quick API Test (PowerShell)

```powershell
# Health
Invoke-RestMethod http://localhost:5000/api/health

# Complaints
Invoke-RestMethod http://localhost:5000/api/complaints

# Authority login (returns a Set-Cookie header)
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/authority-login `
  -ContentType application/json `
  -Body '{"badge_id":"GHMC-ENG-2026","password":"admin"}'

# Duplicate upvote — first call succeeds, second returns 409
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/complaints/101/upvote `
  -Headers @{"X-Client-Id"="test-client-001"}
```
