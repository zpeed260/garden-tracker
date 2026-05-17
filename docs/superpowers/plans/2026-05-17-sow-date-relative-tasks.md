# Sow-Date-Relative Task Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global-season week counter used in per-bed task lists with a per-bed clock that starts at Week 1 on the day the bed is first sowed, so overdue tasks accumulate from the actual sow date rather than a fixed epoch.

**Architecture:** `enrichBed()` gains two new properties (`sow_date`, `bed_week`) computed from `MIN(planted_date)` across a bed's plants. The frontend `buildBedTaskGroups()` receives both a per-bed week and the global week, classifying bed-specific tasks against the former and global (null bed_id) tasks against the latter. When `bed_week` is null the task list renders a placeholder instead of task groups.

**Tech Stack:** Node.js + better-sqlite3 (server), vanilla JS (frontend), Playwright (E2E)

---

## File Map

| File | Change |
|------|--------|
| `server.js` | Add `sow_date`/`bed_week` to `enrichBed()`; Bed 1 & Bed 5 migrations; `PUT /api/beds/:id/sow-date` endpoint |
| `public/index.html` | Update `buildBedTaskGroups()`, `loadBedDetail()`, `rerenderBedTasks()`; unsowed placeholder; sow date editor |
| `tests/e2e/garden.spec.js` | T38–T43 covering migrations, bed_week shape, unsowed state, accordion, harvest date, sow date edit |
| `CLAUDE.md` | Already updated |
| `PRODUCT.md` | Already updated |

---

## Task 0: Bed 1 beetroot sow-date migration

Bed 1 cauliflower plants have a `planted_date` set from when they were sowed; the beetroot plants still have `NULL` because the bulk-sow wasn't re-run after the legacy migration cleared the original dates. The user confirms they were all sowed the same day. This migration syncs the beetroot dates to the cauliflower dates.

**Files:**
- Modify: `server.js` (add after the Bed 5 migration block)

- [ ] **Step 1: Add the migration IIFE in server.js**

Add immediately after the closing `})();` of `migrateBed5Lettuce`:

```javascript
// ─── Migration: Bed 1 — sync beetroot sow date to cauliflower date ───────────
(function migrateBed1BeetrootSowDate() {
  const unsowed = db.prepare(
    "SELECT COUNT(*) as c FROM plants WHERE bed_id='bed1' AND planted_date IS NULL"
  ).get();
  if (unsowed.c === 0) return; // already done

  const ref = db.prepare(
    "SELECT planted_date FROM plants WHERE bed_id='bed1' AND planted_date IS NOT NULL LIMIT 1"
  ).get();
  if (!ref) return; // no sowed plant to reference yet — will re-run on next boot

  db.prepare(
    "UPDATE plants SET planted_date = ? WHERE bed_id = 'bed1' AND planted_date IS NULL"
  ).run(ref.planted_date);
  console.log('[migration] Bed 1 beetroot sow date synced to:', ref.planted_date);
})();
```

- [ ] **Step 2: Restart the server and verify**

```bash
npm start
```
Check the console for `[migration] Bed 1 beetroot sow date synced to: 2026-05-XX`. Open `http://localhost:3000` → Beds tab → Bed 1 should now show "All 12 plants sown" with no sow button.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "fix: sync Bed 1 beetroot sow date to cauliflower planted_date"
```

---

## Task 1: Bed 5 data migration (plants + tasks)

Replace Bed 5's Spinach/Silverbeet/Kale plants with Lettuce sowed 2026-05-17 and refresh its task list.

**Files:**
- Modify: `server.js` (after the closing `}` of the `if (bedCount === 0)` seed block, ~line 343)

- [ ] **Step 1: Write the failing test**

Add inside `describe('11. API Contracts')` in `tests/e2e/garden.spec.js`:

```javascript
test('T38-pre bed5 has lettuce plants sowed 2026-05-17', async ({ request }) => {
  const res = await request.get('/api/beds');
  const beds = await res.json();
  const bed5 = beds.find(b => b.id === 'bed5');
  expect(bed5).toBeDefined();
  expect(bed5.name).toMatch(/[Ll]ettuce/);
  expect(bed5.plants.every(p => p.name === 'Lettuce')).toBe(true);
  expect(bed5.plants[0].planted_date).toBe('2026-05-17');
  expect(bed5.sown_count).toBe(bed5.total_count);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx playwright test --grep "T38-pre" -p desktop-chrome
```
Expected: FAIL — bed5 currently has Spinach/Silverbeet/Kale with null planted_dates.

- [ ] **Step 3: Add the migration block in server.js**

Add immediately after the closing `}` of the `if (bedCount === 0)` block (around line 343):

```javascript
// ─── Migration: Bed 5 → Lettuce (sowed 2026-05-17) ──────────────────────────
(function migrateBed5Lettuce() {
  const existing = db.prepare(
    "SELECT COUNT(*) as c FROM plants WHERE bed_id='bed5' AND name='Lettuce'"
  ).get();
  if (existing.c > 0) return; // already migrated

  db.prepare("DELETE FROM plants WHERE bed_id = 'bed5'").run();
  db.prepare("UPDATE beds SET name = 'Bed 5 — Lettuce' WHERE id = 'bed5'").run();
  db.prepare("DELETE FROM tasks WHERE bed_id = 'bed5'").run();

  const lettuce_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 14, GROWING: 30, HARVEST_READY: 55, OVERDUE: 200,
  });
  const insertPlant = db.prepare(
    `INSERT INTO plants
       (bed_id, name, variety, grid_col, grid_row, planted_date,
        harvest_start_day, harvest_end_day, stage_thresholds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // 2 cols x 8 rows = 16 plants, all sowed 2026-05-17
  for (let col = 0; col <= 1; col++) {
    for (let row = 0; row <= 7; row++) {
      insertPlant.run(
        'bed5', 'Lettuce', 'All Year', col, row,
        '2026-05-17', 56, 9999, lettuce_thresholds
      );
    }
  }

  const insertTask = db.prepare(
    `INSERT INTO tasks (week_number, bed_id, title, is_complete, completed_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const TODAY = '2026-05-17T00:00:00.000Z';
  insertTask.run(1, 'bed5', 'Sow lettuce in 2 rows, 20cm spacing', 1, TODAY);
  insertTask.run(2, 'bed5', 'Check germination — resow any bare patches', 0, null);
  insertTask.run(3, 'bed5', 'Thin lettuce seedlings to 20cm apart', 0, null);
  insertTask.run(5, 'bed5', 'Apply snail bait around Bed 5', 0, null);
  insertTask.run(6, 'bed5', 'Begin harvesting outer leaves — cut-and-come-again', 0, null);
  for (let w = 7; w <= 20; w++) {
    insertTask.run(w, 'bed5', 'Ongoing cut-and-come-again lettuce harvest', 0, null);
  }
  console.log('[migration] Bed 5 replanted with Lettuce (sowed 2026-05-17)');
})();
```

- [ ] **Step 4: Run test to verify it passes**

```
npx playwright test --grep "T38-pre" -p desktop-chrome
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/e2e/garden.spec.js
git commit -m "feat: migrate Bed 5 to Lettuce — sowed 2026-05-17, 2x8 grid"
```

---

## Task 2: Add sow_date and bed_week to enrichBed()

**Files:**
- Modify: `server.js` — `enrichBed()` function (the `return` statement, ~line 532)

- [ ] **Step 1: Write the failing test**

Add inside `describe('11. API Contracts')` in `tests/e2e/garden.spec.js`:

```javascript
test('T39 GET /api/beds — each bed exposes sow_date and bed_week', async ({ request }) => {
  const res = await request.get('/api/beds');
  const beds = await res.json();
  for (const bed of beds) {
    expect('sow_date' in bed).toBe(true);  // null or ISO date string
    expect('bed_week' in bed).toBe(true);  // null or positive integer
  }
  const bed5 = beds.find(b => b.id === 'bed5');
  expect(bed5.sow_date).toBe('2026-05-17');
  expect(typeof bed5.bed_week).toBe('number');
  expect(bed5.bed_week).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx playwright test --grep "T39" -p desktop-chrome
```
Expected: FAIL — `sow_date` and `bed_week` do not exist yet on bed objects.

- [ ] **Step 3: Update the return statement in enrichBed()**

Find the section in `enrichBed()` that starts with `const sown_count = ...` and replace through the end of the function (the entire `return` statement):

```javascript
  const sown_count = plants.filter((p) => p.sown).length;

  // sow_date: earliest planted_date across all plants in this bed
  const sownDates = plants
    .filter(p => p.planted_date)
    .map(p => p.planted_date.split('T')[0]);
  const sow_date = sownDates.length
    ? sownDates.reduce((min, d) => (d < min ? d : min), sownDates[0])
    : null;

  // bed_week: 1-indexed, equals 1 on the sow day itself
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const bed_week = sow_date
    ? Math.max(1, Math.floor((Date.now() - new Date(sow_date).getTime()) / WEEK_MS) + 1)
    : null;

  return {
    id: bed.id,
    name: bed.name,
    width_cm: bed.width_cm,
    height_cm: bed.height_cm,
    plants,
    sown_count,
    total_count: plants.length,
    sow_date,
    bed_week,
  };
```

- [ ] **Step 4: Run test to verify it passes**

```
npx playwright test --grep "T39" -p desktop-chrome
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/e2e/garden.spec.js
git commit -m "feat: add sow_date and bed_week to enrichBed — per-bed week clock"
```

---

## Task 3: Update frontend buildBedTaskGroups to use bed_week

**Files:**
- Modify: `public/index.html`
  - `buildBedTaskGroups()` function (~line 1009)
  - `loadBedDetail()` (~line 692)
  - `rerenderBedTasks()` (~line 1055)
  - CSS block (~line 135)

- [ ] **Step 1: Write the failing tests**

Add to `tests/e2e/garden.spec.js`:

```javascript
test('T40 unsowed bed shows not-sowed placeholder, zero week groups', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await goToBeds(page);
  // Bed 1 has no planted_date after a test reset
  const placeholder = page.locator('#bed-tasks-list .not-sowed-placeholder');
  await expect(placeholder).toBeVisible();
  const weekGroups = page.locator('#bed-tasks-list .week-group');
  await expect(weekGroups).toHaveCount(0);
});

test('T41 bed5 task accordion shows week 1 as current-week (sowed today)', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await goToBeds(page);
  await page.locator('.bed-pill-btn[data-bed-id="bed5"]').click();
  await page.waitForSelector('#bed-tasks-list .week-group', { timeout: 8_000 });
  const wg1 = page.locator('#wg-1');
  await expect(wg1).toBeVisible();
  await expect(wg1).toHaveClass(/current-week/);
  await expect(wg1).toHaveClass(/expanded/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx playwright test --grep "T40|T41" -p desktop-chrome
```
Expected: FAIL.

- [ ] **Step 3: Replace buildBedTaskGroups in public/index.html**

Find `function buildBedTaskGroups(tasks, currentWeek, forceExpandedWeeks)` (~line 1009) and replace the entire function with:

```javascript
function buildBedTaskGroups(tasks, bedWeek, globalWeek, forceExpandedWeeks) {
  if (bedWeek === null || bedWeek === undefined) {
    return '<div class="not-sowed-placeholder empty-state">Sow this bed to activate the task schedule</div>';
  }
  if (!tasks.length) return '<div class="empty-state">No tasks for this bed</div>';

  const grouped = {};
  for (const t of tasks) {
    const w = t.week_number;
    if (!grouped[w]) grouped[w] = [];
    grouped[w].push(t);
  }

  const weeks = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return weeks.map(w => {
    const wTasks = grouped[w];
    const done = wTasks.filter(t => t.is_complete).length;

    // Mixed groups: bed-specific tasks use bedWeek; pure global tasks use globalWeek
    const hasBedSpecific = wTasks.some(t => t.bed_id !== null);
    const effectiveWeek = hasBedSpecific ? bedWeek : globalWeek;

    const isCurrent = w === effectiveWeek;
    const isOverdue = w < effectiveWeek && done < wTasks.length;

    const defaultExpanded = isCurrent || isOverdue || w >= effectiveWeek;
    const isExpanded = forceExpandedWeeks ? forceExpandedWeeks.has(w) : defaultExpanded;

    const overdueClass = isOverdue ? ' overdue-week' : '';

    return `<div class="week-group ${isExpanded ? 'expanded' : 'collapsed'} ${isCurrent ? 'current-week' : ''}${overdueClass}" id="wg-${w}">
      <button class="week-group-header" onclick="toggleWeekGroup(${w})">
        <span class="week-label">Week ${w}${isOverdue ? ' ⚠' : ''}</span>
        <span class="week-progress">${done}/${wTasks.length} done</span>
        <span class="chevron">${isExpanded ? '▼' : '▶'}</span>
      </button>
      <div class="week-group-body" style="padding:0 12px">
        ${wTasks.map(t => buildTaskRow(t)).join('')}
      </div>
    </div>`;
  }).join('');
}
```

- [ ] **Step 4: Update loadBedDetail() to pass bed_week and globalWeek**

Inside `loadBedDetail()`, find the line `const week = appState.currentWeek;` (~line 704) and:
1. Replace it with:
   ```javascript
   const bedWeek = bed.bed_week ?? null;
   const globalWeek = appState.currentWeek;
   ```
2. Find the call `buildBedTaskGroups(tasks, week)` in the template string and change it to:
   ```javascript
   buildBedTaskGroups(tasks, bedWeek, globalWeek)
   ```
   (Note: the template literal string contains this call — no `isFrostLocked` is used for the task groups themselves; the existing `isFrostLocked` variable is only passed to `buildPlantMap()` and can remain.)

- [ ] **Step 5: Update rerenderBedTasks()**

Replace the body of `function rerenderBedTasks()` with:

```javascript
function rerenderBedTasks() {
  const list = document.getElementById('bed-tasks-list');
  if (!list) return;
  const expandedWeeks = new Set();
  list.querySelectorAll('.week-group.expanded').forEach((el) => {
    const m = el.id && el.id.match(/^wg-(-?\d+)$/);
    if (m) expandedWeeks.add(parseInt(m[1], 10));
  });
  const tasks = bedTasksCache[currentBedId] || [];
  const bed = appState.beds.find(b => b.id === currentBedId);
  const bedWeek = bed ? (bed.bed_week ?? null) : null;
  const taskListHtml = buildBedTaskGroups(tasks, bedWeek, appState.currentWeek, expandedWeeks);
  list.textContent = '';
  list.insertAdjacentHTML('beforeend', taskListHtml);
}
```

- [ ] **Step 6: Add overdue-week CSS**

Find `.week-group.current-week .week-group-header{background:var(--cream-dark)}` in the CSS block and add immediately after:

```css
.week-group.overdue-week .week-group-header{background:rgba(212,134,10,0.08)}
.week-group.overdue-week .week-label{color:var(--amber)}
```

- [ ] **Step 7: Run T40 and T41 to verify they pass**

```
npx playwright test --grep "T40|T41" -p desktop-chrome
```
Expected: PASS.

- [ ] **Step 8: Run the full suite to catch regressions**

```
npx playwright test -p desktop-chrome
```
Expected: all tests pass. Fix any regressions before committing.

- [ ] **Step 9: Commit**

```bash
git add public/index.html tests/e2e/garden.spec.js
git commit -m "feat: per-bed week clock drives task accordion in Beds tab"
```

---

## Task 4: Update API contract test T32 for new bed shape

**Files:**
- Modify: `tests/e2e/garden.spec.js` — T32 test (~line 826)

- [ ] **Step 1: Add bed shape assertion to T32**

Inside the T32 test, after the existing `state.beds` assertions, add:

```javascript
for (const bed of state.beds) {
  expect('sow_date' in bed).toBe(true);
  expect('bed_week' in bed).toBe(true);
}
```

- [ ] **Step 2: Run T32 to verify it passes**

```
npx playwright test --grep "T32" -p desktop-chrome
```
Expected: PASS — `enrichBed()` already returns these fields after Task 2.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/garden.spec.js
git commit -m "test: assert sow_date and bed_week on state.beds API contract"
```

---

## Task 5: Fix test reset — deterministic sow state

**Context:** The E2E reset endpoint does not clear `planted_date`. T40 needs Bed 1 unsowed; T41 needs Bed 5 sowed. Without resetting sow dates the tests are non-deterministic.

**Note on Bed 1 in production:** If you see a May `planted_date` on some Bed 1 plants but the "Sow remaining" button still appears, only some plants were sowed (e.g. the 4 cauliflower were tapped individually but the 8 beetroot weren't). The button is correct — just tap it to complete the sow.

**Files:**
- Modify: `server.js` — prepared-statements block and `/api/test/reset` handler (~line 620)

- [ ] **Step 1: Add two prepared statements near the existing reset statements (~line 624)**

```javascript
const resetPlantedDates = db.prepare(
  "UPDATE plants SET planted_date = NULL WHERE bed_id IN ('bed1','bed2','bed3','bed4')"
);
const restoreBed5SowDate = db.prepare(
  "UPDATE plants SET planted_date = '2026-05-17' WHERE bed_id = 'bed5'"
);
```

- [ ] **Step 2: Update the reset handler to call both new statements**

Replace the existing `app.post('/api/test/reset', ...)` handler body with:

```javascript
app.post('/api/test/reset', (_req, res) => {
  db.prepare('DELETE FROM fertiliser_log').run();
  db.prepare('DELETE FROM notes').run();
  deleteExtraSeedTypes.run();
  resetTasks.run();
  resetPlantedDates.run();
  restoreBed5SowDate.run();
  res.json({ ok: true });
});
```

- [ ] **Step 3: Run T40 and T41 to confirm they pass**

```
npx playwright test --grep "T40|T41" -p desktop-chrome
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "fix: test reset clears planted_dates for deterministic E2E sow state"
```

---

## Task 6: Harvest countdown — show calendar harvest date

Add the estimated calendar date (e.g. "15 Jul") alongside the day count so the user can see at a glance when to expect harvest.

**Files:**
- Modify: `public/index.html` — `buildHarvestCountdown()` function (~line 939)

- [ ] **Step 1: Write the failing test**

Add inside `describe('3. Beds Tab')`:

```javascript
test('T42 harvest countdown — sowed crop shows a month name in the countdown', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await goToBeds(page);
  await page.locator('.bed-pill-btn[data-bed-id="bed5"]').click();
  await page.waitForSelector('.harvest-countdown', { timeout: 8_000 });
  const card = page.locator('.harvest-card').first();
  await expect(card).toContainText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx playwright test --grep "T42" -p desktop-chrome
```
Expected: FAIL — currently only day counts appear, no month names.

- [ ] **Step 3: Update buildHarvestCountdown() in public/index.html**

Inside the `crops.map(p => {` callback, add a helper before the `let msg` block, then update the "days" message lines:

After the existing `const soon = ...` line, insert:

```javascript
    // Harvest-ready calendar date — shown alongside day count for context
    let harvestDateLabel = '';
    if (p.planted_date && p.days_to_harvest > 0) {
      const harvestTs = new Date(p.planted_date).getTime() + p.harvest_start_day * 86400000;
      harvestDateLabel = ' · ' + new Date(harvestTs).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short',
      });
    }
```

Then update these two `msg =` lines (leaving every other branch unchanged):

```javascript
    } else if (soon) {
      cls += ' soon-card';
      msg = `<span class="soon-label">~${p.days_to_harvest} days${harvestDateLabel}</span>`;
    } else if (p.days_to_harvest > 0) {
      msg = `<span class="days-label">~${p.days_to_harvest} days${harvestDateLabel}</span>`;
```

- [ ] **Step 4: Run test to verify it passes**

```
npx playwright test --grep "T42" -p desktop-chrome
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/index.html tests/e2e/garden.spec.js
git commit -m "feat: harvest countdown shows calendar date alongside day count"
```

---

## Task 6b: Sow date editing — let users correct a missed or wrong sow date

If a user sowed a bed but didn't open the app that day, or recorded the wrong date, they need to be able to adjust the sow date retroactively. This adds a per-bed "Edit sow date" control that appears once a bed is fully sowed.

### Backend

**Files:**
- Modify: `server.js` — add `PUT /api/beds/:bedId/sow-date` endpoint

- [ ] **Step 1: Write the failing API test**

```javascript
// tests/e2e/garden.spec.js — inside describe('11. API Contracts')
test('T43 PUT /api/beds/bed5/sow-date — updates all plant planted_dates', async ({ request }) => {
  const res = await request.put('/api/beds/bed5/sow-date', {
    data: { date: '2026-05-10' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.sow_date).toBe('2026-05-10');

  // Verify beds endpoint reflects the change
  const bedsRes = await request.get('/api/beds');
  const beds = await bedsRes.json();
  const bed5 = beds.find(b => b.id === 'bed5');
  expect(bed5.sow_date).toBe('2026-05-10');
  expect(bed5.plants.every(p => p.planted_date === '2026-05-10')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx playwright test --grep "T43" -p desktop-chrome
```
Expected: FAIL — 404, endpoint doesn't exist.

- [ ] **Step 3: Add the endpoint in server.js**

Add after the `POST /api/plants/:id/sow` handler (~line 700):

```javascript
// PUT /api/beds/:bedId/sow-date — retroactively set the sow date for all plants in a bed.
// Accepts { date: 'YYYY-MM-DD' }. Validates format; updates all plants in the bed.
const updateBedSowDate = db.prepare(
  'UPDATE plants SET planted_date = ? WHERE bed_id = ?'
);
app.put('/api/beds/:bedId/sow-date', (req, res) => {
  const { bedId } = req.params;
  if (!isValidBedId(bedId)) {
    return res.status(400).json({ error: 'Invalid bed id' });
  }
  const { date } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime()) || parsed > new Date()) {
    return res.status(400).json({ error: 'date must be a valid past date' });
  }
  updateBedSowDate.run(date, bedId);
  res.json({ ok: true, sow_date: date });
});
```

- [ ] **Step 4: Run test to verify it passes**

```
npx playwright test --grep "T43" -p desktop-chrome
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/e2e/garden.spec.js
git commit -m "feat: PUT /api/beds/:id/sow-date — retroactive sow date correction"
```

### Frontend

**Files:**
- Modify: `public/index.html` — `buildSowStatusRow()` (~line 991)

- [ ] **Step 6: Update buildSowStatusRow() to show an editable date when all plants are sowed**

Find `function buildSowStatusRow(bed)` (~line 991). Replace the "all sown" branch:

```javascript
function buildSowStatusRow(bed) {
  if (!bed.total_count) return '';
  const remaining = bed.total_count - bed.sown_count;

  if (remaining === 0) {
    // All sown — show sow date with an edit affordance
    const sowLabel = bed.sow_date
      ? new Date(bed.sow_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'date unknown';
    return `<div class="sow-status-row">
      <span class="sow-text all-sown">🌱 All ${bed.total_count} plants sown — ${sowLabel}</span>
      <button class="sow-all-btn" onclick="showSowDateEditor('${escHtml(bed.id)}', '${escHtml(bed.sow_date || '')}')">Edit date</button>
    </div>`;
  }

  return `<div class="sow-status-row">
    <span class="sow-text">🌱 ${bed.sown_count} of ${bed.total_count} plants sown</span>
    <button class="sow-all-btn" onclick="sowAllInBed('${escHtml(bed.id)}')">Sow remaining ${remaining}</button>
  </div>`;
}
```

- [ ] **Step 7: Add showSowDateEditor() and saveSowDate() functions**

Add after `sowAllInBed()` (~line 920):

```javascript
function showSowDateEditor(bedId, currentDate) {
  const row = document.querySelector('.sow-status-row');
  if (!row) return;
  const today = new Date().toISOString().split('T')[0];
  row.innerHTML = `
    <span class="sow-text">📅 Sow date:</span>
    <input type="date" id="sow-date-input" value="${escHtml(currentDate)}" max="${today}"
           style="font:inherit;padding:4px 8px;border:1px solid #ccc;border-radius:6px;font-size:13px">
    <button class="sow-all-btn" onclick="saveSowDate('${escHtml(bedId)}')">Save</button>
    <button class="sow-all-btn unsow" onclick="reloadBedDetail('${escHtml(bedId)}')">Cancel</button>`;
}

async function saveSowDate(bedId) {
  const input = document.getElementById('sow-date-input');
  if (!input) return;
  const date = input.value;
  if (!date) return;
  try {
    const res = await fetch('/api/beds/' + bedId + '/sow-date', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast('Failed: ' + (err.error || res.status), true);
      return;
    }
    // Refresh bed state and re-render
    const stateRes = await fetchJSON('/api/state');
    appState.beds = stateRes.beds;
    appState.currentWeek = stateRes.currentWeek;
    bedTasksCache = {};
    loadBedDetail(bedId);
    showToast('Sow date updated');
  } catch (e) {
    showToast('Error: ' + e.message, true);
  }
}

function reloadBedDetail(bedId) {
  bedTasksCache[bedId] = null;
  loadBedDetail(bedId);
}
```

- [ ] **Step 8: Run the full suite**

```
npx playwright test -p desktop-chrome
```
Expected: all tests pass (T43 is an API-only test so no browser interaction needed beyond that).

- [ ] **Step 9: Commit**

```bash
git add public/index.html
git commit -m "feat: sow date editor — users can correct a missed or backdated sow date"
```

---

## Task 7: Manual smoke test + push

- [ ] **Step 1: Start the server locally**

```bash
npm start
```

- [ ] **Step 2: Verify in the browser (manual checklist)**

Open `http://localhost:3000`:
1. Beds tab → Bed 5 shows "Bed 5 — Lettuce", Week 1 as current (cream-tinted header), "Sow lettuce" task already ticked
2. Harvest countdown for Bed 5 shows "~42 days · 23 Jun" style text (exact dates will vary)
3. Beds tab → Bed 1 (after clicking "Sow All") shows Week 1 as current and expanded
4. Before sowing Bed 1: task list shows "Sow this bed to activate the task schedule"
5. Simulate overdue: open browser console, run `appState.beds.find(b=>b.id==='bed5').bed_week = 4` — Week 1–3 accordion headers should turn amber with ⚠
6. Dashboard tasks / fertiliser tab unchanged

- [ ] **Step 3: Run the full E2E suite**

```bash
npx playwright test
```
Expected: all tests pass on both desktop-chrome and mobile-chrome.

- [ ] **Step 4: Push and monitor CI**

```bash
git push origin master
```
Monitor "E2E Tests" and "Build and publish Docker image" on GitHub Actions. Both must be green before considering this feature done.

---

## Self-review against spec

| Spec requirement | Task covering it |
|------------------|-----------------|
| Weeks align with sow date | Task 2 (`bed_week` in `enrichBed`) |
| Task clock starts only after sowing | Task 3 (`null` guard → placeholder) |
| Overdue tasks shown week by week | Task 3 (`isOverdue` + amber header + ⚠ label) |
| Overdue persist until marked done | Task 3 (no auto-clear; `is_complete` toggle is the only resolution) |
| Bed 5 → Lettuce, sowed 2026-05-17, 2 rows | Task 1 (migration IIFE) |
| Global tasks stay on season calendar | Task 3 (`hasBedSpecific` guard — null-bed_id tasks use `globalWeek`) |
| Dashboard unaffected | Tasks 2 & 4 (`enrichBed` is additive; dashboard reads global week) |
| Deterministic E2E sow state | Task 5 (test reset clears planted_dates) |
| Harvest countdown shows calendar date | Task 6 (`harvestDateLabel` in `buildHarvestCountdown`) |
