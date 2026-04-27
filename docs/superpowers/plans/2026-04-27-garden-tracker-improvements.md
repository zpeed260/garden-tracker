# Garden Tracker Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs, correct inaccurate garden domain data (stage thresholds, task schedule), and harden the AI analysis prompt so the app accurately reflects a Melbourne/Eltham cool-climate vegetable garden.

**Architecture:** Single-file Express server (`server.js`) + single-file vanilla JS SPA (`public/index.html`). SQLite via `better-sqlite3` (synchronous). Seed data only runs on first boot when `beds` table is empty — domain data fixes require a DB reset. Frontend has no build step.

**Tech Stack:** Node.js, Express 4, better-sqlite3, multer, @anthropic-ai/sdk, vanilla JS, Docker/docker-compose.

---

## Task 1: Fix Critical Server Bugs

**Files:**
- Modify: `server.js` (lines ~10–15 constants, ~380 static, ~383–387 multer, ~593–618 analyse route)

These four bugs can cause crashes or security issues.

- [ ] **Step 1: Fix `express.static` to use an absolute path**

At `server.js` line ~380, change:
```js
app.use(express.static('public'));
```
to:
```js
app.use(express.static(path.join(__dirname, 'public')));
```

- [ ] **Step 2: Move Anthropic client to module level and validate API key at startup**

Remove `const client = new Anthropic(...)` from inside the `/api/analyse` route handler (~line 593).

After the `const PORT = ...` / `DB_PATH` / `SEASON_START` block (around line 16), add:
```js
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}
const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

Inside the `/api/analyse` handler replace `const client = new Anthropic(...)` with nothing (it's gone), and replace `client.messages.create` with `anthropicClient.messages.create`.

- [ ] **Step 3: Guard `JSON.parse` on the Claude API response**

In the `/api/analyse` handler, replace:
```js
const resultText = response.content[0].text;
const result = JSON.parse(resultText);
```
with:
```js
const resultText = response.content[0].text;
let result;
try {
  result = JSON.parse(resultText);
} catch (_) {
  return res.status(500).json({ error: 'Model returned non-JSON response', raw: resultText.slice(0, 300) });
}
```

- [ ] **Step 4: Add MIME type filter to multer**

Replace the multer setup block (~line 383):
```js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('image');
```
with:
```js
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${file.mimetype}". Allowed: jpeg, png, gif, webp, heic`));
    }
  },
}).single('image');
```

- [ ] **Step 5: Protect `computeStage` from bad JSON**

Replace the `computeStage` function body opening:
```js
function computeStage(plantedDate, thresholdsJson) {
  const thresholds = JSON.parse(thresholdsJson);
```
with:
```js
function computeStage(plantedDate, thresholdsJson) {
  let thresholds;
  try {
    thresholds = JSON.parse(thresholdsJson);
  } catch (_) {
    return 'SEEDED';
  }
```

- [ ] **Step 6: Clamp `getCurrentWeek()` to a minimum of 0**

Replace:
```js
function getCurrentWeek() {
  return Math.floor((Date.now() - SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000));
}
```
with:
```js
function getCurrentWeek() {
  return Math.max(0, Math.floor((Date.now() - SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}
```

- [ ] **Step 7: Verify server starts and health check passes**

```bash
npm start
curl http://localhost:3000/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 8: Commit**

```bash
git add server.js
git commit -m "fix: critical server bugs — static path, API key validation, JSON parse guard, MIME filter, computeStage safety"
```

---

## Task 2: Fix Minor Server Issues

**Files:**
- Modify: `server.js` (lines ~501–529 notes routes, ~532 analysis route)

- [ ] **Step 1: Add bed existence check to `GET /api/notes/:bed_id`**

Replace:
```js
app.get('/api/notes/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  const notes = getNotesByBed.all(bed_id);
  res.json(notes);
});
```
with:
```js
app.get('/api/notes/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  const bed = getBedById.get(bed_id);
  if (!bed) return res.status(404).json({ error: 'Bed not found' });
  const notes = getNotesByBed.all(bed_id);
  res.json(notes);
});
```

- [ ] **Step 2: Add bed existence check to `GET /api/analysis/:bed_id`**

Replace:
```js
app.get('/api/analysis/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  const analyses = getAnalysisByBed.all(bed_id);
  res.json(analyses);
});
```
with:
```js
app.get('/api/analysis/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  const bed = getBedById.get(bed_id);
  if (!bed) return res.status(404).json({ error: 'Bed not found' });
  const analyses = getAnalysisByBed.all(bed_id);
  res.json(analyses);
});
```

- [ ] **Step 3: Cap note content length at 2000 characters**

In `POST /api/notes/:bed_id`, after the existing content validation (`if (!content || ...)`) add:
```js
if (content.length > 2000) {
  return res.status(400).json({ error: 'content must be 2000 characters or fewer' });
}
```

- [ ] **Step 4: Verify with curl**

```bash
curl http://localhost:3000/api/notes/bed99
```
Expected: `{"error":"Bed not found"}` with status 404.

```bash
curl http://localhost:3000/api/analysis/notabed
```
Expected: `{"error":"Bed not found"}` with status 404.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "fix: 404 on invalid bed IDs for notes/analysis routes, cap note length at 2000 chars"
```

---

## Task 3: Fix Frontend HTML Injection and Cleanup

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Escape `task.title` in `buildTaskRow`**

Find in `buildTaskRow` (around line 539):
```js
      <div class="task-title">${task.title}</div>
```
Replace with:
```js
      <div class="task-title">${escHtml(task.title)}</div>
```

- [ ] **Step 2: Delete the duplicate `fmtDateTimeShort` function**

Find and delete the entire `fmtDateTimeShort` function (lines ~400–405):
```js
function fmtDateTimeShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}
```

Replace all calls to `fmtDateTimeShort(` with `fmtDateTime(` — there are two in `buildNotesSection` and `saveNote`. The output is identical.

- [ ] **Step 3: Revoke blob URL when a new file is selected**

In the STATE block at the top of the script, find:
```js
let analysisFile = null;
```
Add after it:
```js
let analysisBlobUrl = null;
```

In `onFileSelected`, after `analysisFile = file;`, add:
```js
  if (analysisBlobUrl) {
    URL.revokeObjectURL(analysisBlobUrl);
  }
  analysisBlobUrl = URL.createObjectURL(file);
```

Then replace `const url = URL.createObjectURL(file);` and `img.src = url;` with:
```js
  img.src = analysisBlobUrl;
```

In `renderAnalysisTab()`, at the top of the function, add:
```js
  if (analysisBlobUrl) {
    URL.revokeObjectURL(analysisBlobUrl);
    analysisBlobUrl = null;
  }
```

- [ ] **Step 4: Replace fragile `onclick` attribute matching with `data-bed-id` attributes**

In `renderBeds()`, change the pill button HTML from:
```js
return `<button class="bed-pill-btn ${bed.id === currentBedId ? 'active' : ''}"
      onclick="selectBed('${bed.id}')">${shortName} — ...</button>`;
```
to:
```js
return `<button class="bed-pill-btn ${bed.id === currentBedId ? 'active' : ''}"
      data-bed-id="${bed.id}"
      onclick="selectBed('${bed.id}')">${shortName} — ...</button>`;
```

In `selectBed`, replace:
```js
    b.classList.toggle('active', b.getAttribute('onclick').includes(`'${bedId}'`));
```
with:
```js
    b.classList.toggle('active', b.dataset.bedId === bedId);
```

In `renderAnalysisTab()`, change the analysis pill buttons to also have `data-bed-id`:
```js
return `<button class="bed-pill-btn ${bed.id === analysisBedId ? 'active' : ''}"
      data-bed-id="${bed.id}"
      onclick="selectAnalysisBed('${bed.id}')">${short}</button>`;
```

In `selectAnalysisBed`, replace:
```js
    b.classList.toggle('active', b.getAttribute('onclick').includes(`'${bedId}'`));
```
with:
```js
    b.classList.toggle('active', b.dataset.bedId === bedId);
```

- [ ] **Step 5: Verify in browser**

Start server, open `http://localhost:3000`, check:
- Beds tab: clicking bed pills switches correctly
- Analysis tab: clicking bed pills switches correctly
- No JS errors in console

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "fix: escape task title HTML, remove duplicate format function, revoke blob URLs, fix fragile bed selector"
```

---

## Task 4: Fix Stage Thresholds and Harvest Windows

**Files:**
- Modify: `server.js` (seed data block, lines ~119–183)

These fixes correct the inconsistencies found by the garden expert. Because seed data only runs on first boot, a DB reset is required after this task (see Task 6).

- [ ] **Step 1: Fix cauliflower thresholds**

Replace:
```js
const cauli_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 21, GROWING: 60, FLOWERING: 90,
    HARVEST_READY: 120, OVERDUE: 150,
  });
```
with:
```js
const cauli_thresholds = JSON.stringify({
    SEEDLING: 14, GROWING: 60, HEADING: 100,
    HARVEST_READY: 140, OVERDUE: 180,
  });
```
Note: GERMINATING removed (transplants don't germinate). FLOWERING renamed to HEADING. HARVEST_READY moved from 120→140 (Eltham cool winter slows heading). OVERDUE 150→180.

- [ ] **Step 2: Update stageOrder and stage display for the new HEADING stage**

In `server.js`, find the `stageOrder` array in `computeStage`:
```js
  const stageOrder = [
    'OVERDUE', 'HARVEST_READY', 'FLOWERING', 'GROWING', 'SEEDLING', 'GERMINATING', 'SEEDED',
  ];
```
Replace with:
```js
  const stageOrder = [
    'OVERDUE', 'HARVEST_READY', 'HEADING', 'FLOWERING', 'GROWING', 'SEEDLING', 'GERMINATING', 'SEEDED',
  ];
```

In `public/index.html`, find `STAGE_COLORS`:
```js
const STAGE_COLORS = {
  SEEDED: '#d4cfc4',
  GERMINATING: '#f5c842',
  SEEDLING: '#a8d878',
  GROWING: '#5a8f4a',
  FLOWERING: '#c080c0',
  HARVEST_READY: '#e06020',
  OVERDUE: '#8b1a1a'
};
```
Add `HEADING` (use a distinctive warm purple to distinguish from FLOWERING):
```js
const STAGE_COLORS = {
  SEEDED: '#d4cfc4',
  GERMINATING: '#f5c842',
  SEEDLING: '#a8d878',
  GROWING: '#5a8f4a',
  HEADING: '#9b59b6',
  FLOWERING: '#c080c0',
  HARVEST_READY: '#e06020',
  OVERDUE: '#8b1a1a'
};
```

Find `STAGE_LABELS` and add:
```js
const STAGE_LABELS = {
  SEEDED: 'Seeded',
  GERMINATING: 'Germinating',
  SEEDLING: 'Seedling',
  GROWING: 'Growing',
  HEADING: 'Heading',
  FLOWERING: 'Flowering',
  HARVEST_READY: 'Harvest Ready',
  OVERDUE: 'Overdue'
};
```

- [ ] **Step 3: Fix beetroot thresholds**

Replace:
```js
const beetroot_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 21, GROWING: 60, FLOWERING: 90,
    HARVEST_READY: 120, OVERDUE: 150,
  });
```
with:
```js
const beetroot_thresholds = JSON.stringify({
    GERMINATING: 14, SEEDLING: 28, GROWING: 60,
    HARVEST_READY: 120, OVERDUE: 170,
  });
```
Changes: GERMINATING 7→14 (cool April soil), SEEDLING 21→28, FLOWERING removed (beetroot doesn't flower in season 1), OVERDUE 150→170 (beetroot holds well in cool soil).

Also update beetroot harvest window in `insertPlant` calls:
```js
// Before
insertPlant.run('bed1', 'Beetroot', 'Detroit', col, row, PLANTED, 119, 140, beetroot_thresholds);
// After
insertPlant.run('bed1', 'Beetroot', 'Detroit', col, row, PLANTED, 119, 170, beetroot_thresholds);
```

- [ ] **Step 4: Fix broad bean thresholds and harvest window**

Replace:
```js
const broadbean_thresholds = JSON.stringify({
    GERMINATING: 10, SEEDLING: 25, GROWING: 70, FLOWERING: 100,
    HARVEST_READY: 120, OVERDUE: 145,
  });
```
with:
```js
const broadbean_thresholds = JSON.stringify({
    GERMINATING: 10, SEEDLING: 25, GROWING: 70, FLOWERING: 100,
    HARVEST_READY: 130, OVERDUE: 165,
  });
```
Changes: HARVEST_READY 120→130 (Eltham winter slows maturity), OVERDUE 145→165.

Also update broad bean harvest window:
```js
// Before
insertPlant.run('bed2', 'Broad Bean', 'Coles Early', col, row, PLANTED, 112, 140, broadbean_thresholds);
// After
insertPlant.run('bed2', 'Broad Bean', 'Coles Early', col, row, PLANTED, 130, 165, broadbean_thresholds);
```

- [ ] **Step 5: Fix carrot thresholds (critical inconsistency)**

Replace:
```js
const carrot_thresholds = JSON.stringify({
    GERMINATING: 14, SEEDLING: 30, GROWING: 80, HARVEST_READY: 110, OVERDUE: 140,
  });
```
with:
```js
const carrot_thresholds = JSON.stringify({
    GERMINATING: 14, SEEDLING: 30, GROWING: 80, HARVEST_READY: 140, OVERDUE: 200,
  });
```
Changes: HARVEST_READY 110→140 (matches harvest_start_day of 147; cool winter Every Season variety). OVERDUE 140→200 (carrots improve in flavour in cold soil and hold very well).

- [ ] **Step 6: Fix lettuce thresholds**

Replace:
```js
const lettuce_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 14, HARVEST_READY: 45,
  });
```
with:
```js
const lettuce_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 14, GROWING: 30, HARVEST_READY: 55, OVERDUE: 200,
  });
```
Changes: Added GROWING stage (no sudden jump from SEEDLING to HARVEST_READY). HARVEST_READY 45→55 (cool Eltham winter slows growth; aligns with harvest_start_day 56). OVERDUE 200 is a spring-bolt signal.

- [ ] **Step 7: Fix sugar pea thresholds (critical inconsistency)**

Replace:
```js
const sugarpea_thresholds = JSON.stringify({
    GERMINATING: 8, SEEDLING: 20, GROWING: 55, FLOWERING: 75,
    HARVEST_READY: 90, OVERDUE: 130,
  });
```
with:
```js
const sugarpea_thresholds = JSON.stringify({
    GERMINATING: 12, SEEDLING: 20, GROWING: 55, FLOWERING: 75,
    HARVEST_READY: 77, OVERDUE: 120,
  });
```
Changes: GERMINATING 8→12 (cool April soil). HARVEST_READY 90→77 (matches harvest_start_day 77; pods swell before full maturity). OVERDUE 130→120.

- [ ] **Step 8: Fix winter greens thresholds and harvest_start_day**

Replace:
```js
const wintergreens_thresholds = JSON.stringify({
    GERMINATING: 7, HARVEST_READY: 40,
  });
```
with:
```js
const wintergreens_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 14, GROWING: 25, HARVEST_READY: 50, OVERDUE: 300,
  });
```
Changes: Added SEEDLING and GROWING stages (no instant jump). HARVEST_READY 40→50 (kale takes 60–70 days; 50 is a compromise for the mixed bed). OVERDUE 300 (cut-and-come-again continues indefinitely through winter).

Update the winter greens `insertPlant` harvest_start_day from 28 to 45:
```js
// Before
insertPlant.run('bed5', 'Spinach/Silverbeet/Kale', 'Mix', col, row, PLANTED, 28, 9999, wintergreens_thresholds);
// After
insertPlant.run('bed5', 'Spinach/Silverbeet/Kale', 'Mix', col, row, PLANTED, 45, 9999, wintergreens_thresholds);
```

- [ ] **Step 9: Fix cauliflower harvest window**

Update cauliflower `insertPlant` calls, changing `harvest_end_day` from 140 to 160:
```js
// Before
insertPlant.run('bed1', 'Cauliflower', 'Tasty', col, row, PLANTED, 119, 140, cauli_thresholds);
// After
insertPlant.run('bed1', 'Cauliflower', 'Tasty', col, row, PLANTED, 140, 168, cauli_thresholds);
```
Note: harvest_start_day moved from 119→140 to align with the corrected HARVEST_READY threshold.

- [ ] **Step 10: Commit (before DB reset)**

```bash
git add server.js public/index.html
git commit -m "fix: correct stage thresholds for all crops — align with Eltham cool climate, fix carrot/sugar-pea harvest inconsistencies, add HEADING stage"
```

---

## Task 5: Fix Task Schedule

**Files:**
- Modify: `server.js` (seed task block, lines ~186–297)

- [ ] **Step 1: Fix week 1 broad bean task — stakes not netting**

Find and replace:
```js
  insertTask.run(1, 'bed2','Attach and secure trellis netting to Bed 2', 0, null);
```
with:
```js
  insertTask.run(1, 'bed2','Drive in 1.2m bamboo canes along Bed 2 for broad beans — one per plant pair', 0, null);
```

- [ ] **Step 2: Move "tie broad bean shoots" from week 3 to week 6**

Find:
```js
  insertTask.run(3, 'bed2','Tie broad bean shoots loosely to trellis as they emerge', 0, null);
```
Change to week 6:
```js
  insertTask.run(6, 'bed2','Tie broad bean shoots loosely to canes — plants should be 20–30cm now', 0, null);
```

- [ ] **Step 3: Fix monthly cauliflower side-dress appearing every week in loop**

In the weeks 9–12 loop, find:
```js
    insertTask.run(w, 'bed1','Side-dress cauliflower with Blood & Bone monthly', 0, null);
```
Replace the loop body so that task only inserts at week 9 and week 13:
```js
  for (let w = 9; w <= 12; w++) {
    insertTask.run(w, null,  'Alternate Liquid Gold / Eco Booch every 2 weeks (fortnightly)', 0, null);
    if (w === 9) {
      insertTask.run(w, 'bed1','Side-dress cauliflower with Blood & Bone around each plant', 0, null);
    }
    insertTask.run(w, 'bed2','Stake and tie broad beans as they reach 90–120cm', 0, null);
    insertTask.run(w, 'bed3','Ongoing cut-and-come-again harvest of lettuce', 0, null);
    insertTask.run(w, 'bed5','Ongoing cut-and-come-again harvest of winter greens', 0, null);
    insertTask.run(w, null,  'Check for slugs after rain — reapply bait', 0, null);
  }
```
Add the second cauliflower Blood & Bone task at week 13 (before the weeks 13–16 loop):
```js
  insertTask.run(13, 'bed1','Side-dress cauliflower with Blood & Bone around each plant (monthly)', 0, null);
```

- [ ] **Step 4: Add cauliflower blanching task at week 10**

After the weeks 9–12 loop, add:
```js
  insertTask.run(10, 'bed1','Tie outer leaves over cauliflower curds as heads begin to form — protects from frost and sun discolouration', 0, null);
```

- [ ] **Step 5: Move climbing bean sow task from week 21 to week 24**

Find:
```js
  insertTask.run(21, 'bed5','Sow Climbing Bean Vitalis after mid-October frost risk clears', 0, null);
```
Replace with:
```js
  insertTask.run(24, 'bed5','Sow Climbing Bean Vitalis — mid-October frost risk now past in Eltham', 0, null);
```

- [ ] **Step 6: Fix weeks 17–20 fertiliser — keep fortnightly rotation**

Find in the weeks 17–20 loop:
```js
    insertTask.run(w, null,  'Apply Eco Booch to remaining crops', 0, null);
```
Replace with:
```js
    if (w % 2 === 0) {
      insertTask.run(w, null, "Apply Vasili's Eco Booch to remaining crops", 0, null);
    } else {
      insertTask.run(w, null, "Apply Vasili's Liquid Gold to remaining crops", 0, null);
    }
```

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "fix: task schedule — correct broad bean support, monthly side-dress loop bug, climbing bean frost date, fortnightly fertiliser in weeks 17-20"
```

---

## Task 6: Improve AI Analysis Prompt

**Files:**
- Modify: `server.js` (lines ~570–589 in POST /api/analyse)

- [ ] **Step 1: Add climate context to the system prompt**

Replace:
```js
      const systemPrompt =
        'You are an expert vegetable gardener assistant. Analyse this garden bed photo.';
```
with:
```js
      const systemPrompt =
        'You are an expert vegetable gardener assistant specialising in cool-climate home growing in Melbourne, Australia (outer suburbs, Eltham — USDA zone 10a, mild frosts June–July, cold but not severe winters). Analyse this garden bed photo.';
```

- [ ] **Step 2: Build per-crop stage list for mixed beds**

Replace the single-stage `expectedStage` computation:
```js
      const primaryPlant = plants[0] || null;
      const plantedDate = primaryPlant ? primaryPlant.planted_date : 'unknown';
      const expectedStage = primaryPlant
        ? computeStage(primaryPlant.planted_date, primaryPlant.stage_thresholds)
        : 'unknown';
```
with:
```js
      const primaryPlant = plants[0] || null;
      const plantedDate = primaryPlant ? primaryPlant.planted_date : 'unknown';

      const stagesByCrop = {};
      for (const p of plants) {
        if (!stagesByCrop[p.name]) {
          stagesByCrop[p.name] = computeStage(p.planted_date, p.stage_thresholds);
        }
      }
      const expectedStageText = Object.entries(stagesByCrop)
        .map(([name, stage]) => `${name}: ${stage}`)
        .join(', ');
```

- [ ] **Step 3: Update the user prompt to use per-crop stages and add non-garden guard**

Replace the `userPrompt` string:
```js
      const userPrompt = `The bed contains: ${cropList}.
Planted on: ${plantedDate}.
Current week: ${currentWeek}.
Expected growth stage: ${expectedStage}.
Return a JSON object with these exact keys:
{
  "health_score": 1-10,
  "health_summary": "string (1 sentence)",
  "observed_stage": "one of SEEDED|GERMINATING|SEEDLING|GROWING|HEADING|FLOWERING|HARVEST_READY|OVERDUE",
  "stage_matches_expected": true/false,
  "issues_detected": ["string array, empty if none"],
  "harvest_estimate": "string e.g. '3-4 weeks' or 'Ready now' or 'Not applicable'",
  "recommendations": ["max 3 actionable items"],
  "urgent": true/false
}
Return ONLY the JSON object. No preamble, no markdown.`;
```
with:
```js
      const userPrompt = `The bed contains: ${cropList}.
Planted on: ${plantedDate}.
Current week of season: ${currentWeek}.
Expected growth stages: ${expectedStageText}.
If the image does not appear to show a garden bed or plants, return: {"health_score":0,"health_summary":"Image does not show a garden bed.","observed_stage":"SEEDED","stage_matches_expected":false,"issues_detected":[],"harvest_estimate":"Not applicable","recommendations":[],"urgent":false}
Otherwise return a JSON object with these exact keys:
{
  "health_score": 1-10,
  "health_summary": "string (1 sentence)",
  "observed_stage": "one of SEEDED|GERMINATING|SEEDLING|GROWING|HEADING|FLOWERING|HARVEST_READY|OVERDUE",
  "stage_matches_expected": true/false,
  "issues_detected": ["string array, empty if none"],
  "harvest_estimate": "string e.g. '3-4 weeks' or 'Ready now' or 'Not applicable'",
  "recommendations": ["max 3 actionable items"],
  "urgent": true/false
}
Return ONLY the JSON object. No preamble, no markdown.`;
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "fix: AI analysis prompt — add Eltham climate context, per-crop stages for mixed beds, non-garden image guard, HEADING stage"
```

---

## Task 7: Reset the Database and Verify

The seed data changes in Tasks 4 and 5 only apply on first boot. The existing DB must be cleared.

- [ ] **Step 1: Stop the running app**

```bash
# If running locally:
# Ctrl+C to stop npm start

# If running via Docker:
docker compose down
```

- [ ] **Step 2: Delete the SQLite file to force re-seed**

Local dev:
```bash
rm -f /app/data/garden.db
# Or wherever DB_PATH points — check .env
# Default is /app/data/garden.db so for local dev it may be relative
```

Docker volume reset:
```bash
docker volume rm garden-tracker_garden-data
```

- [ ] **Step 3: Restart and verify seeding**

```bash
# Local:
npm start

# Docker:
docker compose up --build -d
docker compose logs -f
```
Expected in logs: `Garden Tracker running on port 3000` with no errors.

- [ ] **Step 4: Verify stage thresholds are applied**

```bash
curl http://localhost:3000/api/beds | python3 -m json.tool | grep -A5 '"stage"'
```
Expected: All plants showing `"stage": "SEEDED"` (day 0).

```bash
curl http://localhost:3000/api/state | python3 -m json.tool | grep '"fertiliser"'
```
Expected: Current fertiliser matches week parity.

- [ ] **Step 5: Verify task schedule in UI**

Open `http://localhost:3000` in a browser.
- Dashboard should show Week 0 task pre-completed ("Sprayed Liquid Gold + Eco Booch…")
- Week 1 tasks should show "Drive in 1.2m bamboo canes…" (not trellis netting) for Bed 2
- Navigate to Beds tab, select Bed 2, expand week groups — confirm week 1 has cane task

- [ ] **Step 6: Re-mark Week 0 task as complete**

The DB reset loses the pre-completed Week 0 task state. Find the task ID from the dashboard and tick it manually in the UI.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: all improvements applied — DB reset required for seed data changes"
```

---

## Self-Review

**Spec coverage check:**
- ✅ express.static relative path — Task 1
- ✅ Anthropic client per-request + missing API key — Task 1
- ✅ Unguarded JSON.parse on Claude response — Task 1
- ✅ Multer MIME filter — Task 1
- ✅ computeStage crash on bad JSON — Task 1
- ✅ Week clamp to 0 — Task 1
- ✅ bed_id validation on GET routes — Task 2
- ✅ Note length cap — Task 2
- ✅ task.title XSS — Task 3
- ✅ Duplicate fmtDateTimeShort — Task 3
- ✅ Blob URL leak — Task 3
- ✅ Fragile onclick matching — Task 3
- ✅ All 7 crop threshold corrections — Task 4
- ✅ Harvest window corrections — Task 4
- ✅ HEADING stage added to stageOrder + colours + labels — Task 4
- ✅ Broad bean stakes vs netting — Task 5
- ✅ Monthly side-dress loop bug — Task 5
- ✅ Climbing bean frost date — Task 5
- ✅ Fortnightly fertiliser weeks 17–20 — Task 5
- ✅ AI prompt climate context — Task 6
- ✅ AI prompt per-crop stages — Task 6
- ✅ AI prompt non-garden guard — Task 6
- ✅ DB reset procedure — Task 7
