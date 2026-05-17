# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run locally (requires .env with ANTHROPIC_API_KEY)
npm start

# Docker (primary deployment target — Proxmox)
docker compose up --build -d
docker compose logs -f

# Single-container run without compose
docker build -t garden-tracker .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=... -v garden-data:/app/data garden-tracker
```

No lint or test scripts are configured yet. There is no build step — the frontend is plain HTML/JS/CSS served statically.

## Architecture

**Single-process, single-file backend.** `server.js` is the entire server: it initialises the SQLite database, seeds it on first run, declares all prepared statements, and registers all Express routes. There is no framework, ORM, or module separation.

**Single-page frontend.** `public/index.html` contains all HTML, CSS, and JS in one file. It is a vanilla JS SPA with four tabs (Dashboard, Beds, Fertiliser, AI Analysis) rendered by string-template functions. There is no bundler, no framework, and no npm dependency on the client side.

**Database.** `better-sqlite3` is used synchronously throughout. The DB file lives at `/app/data/garden.db` (Docker volume) or the `DB_PATH` env var. On first boot (when `beds` table is empty) the server auto-seeds 5 beds, all plants, and a full 21-week task schedule — changing seed data requires either deleting the DB file or writing a migration by hand.

**Week / fertiliser logic.** There are two distinct week clocks:

1. **Global season week** — `SEASON_START = new Date('2026-04-26')`. `getCurrentWeek()` computes weeks elapsed since that date. Used for: fertiliser rotation, dashboard global tasks (bed_id = NULL).
   - Fertiliser alternates by week parity: odd → "Vasili's Liquid Gold", even → "Vasili's Eco Booch".

2. **Per-bed sow week** — each bed computes its own current week from `MIN(planted_date)` across its plants.
   - `sow_date = MIN(planted_date)` across a bed's plants (null if none sowed yet)
   - `bed_week = Math.max(1, Math.floor((now - sow_date) / WEEK_MS) + 1)` — equals 1 on the sow day itself
   - Exposed on every bed object as `sow_date` and `bed_week`
   - Bed-specific tasks (`bed_id IS NOT NULL`) use `bed_week` for current/overdue/future classification
   - Global tasks (`bed_id IS NULL`) continue to use the global season week on the dashboard; when shown inside a bed's task list they are classified against the global season week

**Sow date correction.** `PUT /api/beds/:bedId/sow-date` with body `{ date: 'YYYY-MM-DD' }` updates `planted_date` for every plant in the bed. Validates ISO date format and rejects future dates. The frontend shows an "Edit date" button in `buildSowStatusRow()` once all plants are sowed; `saveSowDate()` calls this endpoint and refreshes `appState.beds` from `/api/state`.

**Task classification.** In the Beds tab, `buildBedTaskGroups(tasks, bedWeek, globalWeek)` separates tasks:
- `task.bed_id !== null` → classified using `bedWeek` (current when `week_number === bedWeek`, overdue when `week_number < bedWeek && !is_complete`)
- `task.bed_id === null` → classified using `globalWeek`
- When `bedWeek` is null (bed not yet sowed) the task list shows a "not yet sowed" placeholder instead of task groups.

**Plant stage computation.** Each plant row stores a `stage_thresholds` JSON column (e.g. `{"GERMINATING":7,"SEEDLING":21,...}`). `computeStage()` in `server.js` walks a fixed priority list (`OVERDUE → HARVEST_READY → ... → SEEDED`) and returns the first stage whose threshold the plant's age meets. Stage is recomputed on every request — it is never persisted.

**AI image analysis.** `POST /api/analyse` accepts a multipart upload, builds a structured prompt including crop list, planting date, current week, and expected stage, then calls `claude-sonnet-4-20250514` with the image. The response must be a JSON object with a fixed schema (health_score, issues_detected, recommendations, etc.) — the prompt instructs the model to return only JSON. Results are stored in `analysis_log` (up to 3 per bed are surfaced in the UI; all are retained in DB).

**Notes cap.** The server trims each bed's notes to the most recent 10 after every insert.

## Key env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `ANTHROPIC_API_KEY` | — | Required for AI analysis |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `/app/data/garden.db` | SQLite file location |
