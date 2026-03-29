# PipeJob — Personal Career Agent

PipeJob is an automated job-application agent that discovers job listings from StepStone and Indeed, uses Claude AI to analyse each JD against your master CV, generates tailored CV and cover-letter DOCX files, and—when enabled in production—fills and submits application forms via Playwright.

---

## Prerequisites

- Node.js 20+
- `npx playwright install chromium` (Playwright browser)

---

## Setup

```bash
# 1. Copy env config
cp server/.env.example server/.env
cp client/.env.example client/.env

# 2. Fill in the required values
# - server/.env: ANTHROPIC_API_KEY
# - master-cv.json: replace the sample profile with your own CV data
# - client/.env is optional for local dev; keep the default unless your API runs elsewhere

# 3. Install server deps + Playwright browsers
cd server && npm install
npx playwright install chromium

# 4. Install client deps
cd ../client && npm install
```

## Environment Variables

### Server

`server/.env` is the runtime config file used by the API server.

- Required
  - `ANTHROPIC_API_KEY`
- Usually keep defaults
  - `MASTER_CV_PATH`
  - `OUTPUT_DIR`
  - `LOG_DIR`
  - `DB_PATH`
  - `SCRAPE_DELAY_MIN_MS`
  - `SCRAPE_DELAY_MAX_MS`
  - `MAX_JOBS_PER_RUN`
  - `MAX_APPLICATIONS_PER_DAY`
  - `PORT`
  - `NODE_ENV`
- Optional
  - `TELEGRAM_TOKEN`
  - `TELEGRAM_CHAT_ID`
  - `GOOGLE_SHEET_ID`

### Client

`client/.env` is optional in local development.

- Optional
  - `VITE_API_URL`

If `VITE_API_URL` is unset, the client defaults to `http://localhost:3001`.

### .env.example vs .env

- `.env.example` is a safe, committed template that shows which keys exist.
- `.env` contains your real local values and should stay uncommitted.
- In this repo, the important runtime file is `server/.env`.

---

## Running

```bash
# Terminal 1 — API server (port 3001)
cd server && npm run dev

# Terminal 2 — React dashboard (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Architecture

```
Client (React + react-query)
  └─► API Layer (Express — /api/jobs, /api/cv)
        └─► Services
              ├── Scraper      (Playwright-Extra + Stealth plugin)
              ├── Analyser     (Claude claude-sonnet-4-20250514)
              ├── Generator    (docx library → DOCX files)
              └── Submission   (Playwright form-filler)
        └─► Persistence (SQLite via better-sqlite3)
        └─► Notifications (SSE stream → LiveFeed component)
```

---

## Ethics & Safety

- **Dry-run mode**: In `NODE_ENV=development` (the default), the submission engine never clicks the final submit button. It logs `DRY RUN: would have submitted` and takes a before-submit screenshot instead.
- **Rate limits**: Configurable via `MAX_APPLICATIONS_PER_DAY` and `SCRAPE_DELAY_*_MS`. The default cap is 5 applications per 24-hour window.
- **Human-like delays**: Every Playwright interaction is preceded by a randomised delay and mouse movement to avoid triggering bot-detection systems.
- **No hardcoded secrets**: All API keys and credentials are loaded from `.env` at startup and never committed to the repository.
