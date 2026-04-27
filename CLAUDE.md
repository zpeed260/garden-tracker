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

**Week / fertiliser logic.** The season epoch is hardcoded as `SEASON_START = new Date('2026-04-26')`. `getCurrentWeek()` computes weeks elapsed since that date. Fertiliser alternates by week parity: odd weeks → "Vasili's Liquid Gold", even → "Vasili's Eco Booch".

**Plant stage computation.** Each plant row stores a `stage_thresholds` JSON column (e.g. `{"GERMINATING":7,"SEEDLING":21,...}`). `computeStage()` in `server.js` walks a fixed priority list (`OVERDUE → HARVEST_READY → ... → SEEDED`) and returns the first stage whose threshold the plant's age meets. Stage is recomputed on every request — it is never persisted.

**AI image analysis.** `POST /api/analyse` accepts a multipart upload, builds a structured prompt including crop list, planting date, current week, and expected stage, then calls `claude-sonnet-4-20250514` with the image. The response must be a JSON object with a fixed schema (health_score, issues_detected, recommendations, etc.) — the prompt instructs the model to return only JSON. Results are stored in `analysis_log` (up to 3 per bed are surfaced in the UI; all are retained in DB).

**Notes cap.** The server trims each bed's notes to the most recent 10 after every insert.

## Key env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `ANTHROPIC_API_KEY` | — | Required for AI analysis |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `/app/data/garden.db` | SQLite file location |
