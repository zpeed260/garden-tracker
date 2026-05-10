# Regression Test Catalogue

Living document. Update the run log after every test run, and add rows to the inventory whenever a new feature ships or a bug is fixed.

---

## Test Inventory

| ID | Test name | Acceptance criterion | Tag |
|----|-----------|----------------------|-----|
| T01 | App loads | Page title = "Garden Tracker", Dashboard tab active, `.week-badge` visible with text containing "Week" | smoke |
| T02 | Tab navigation | Clicking each of the **5** user-visible tabs activates the correct content section; no other section stays active | nav |
| T03 | Dashboard fertiliser card | `.fertiliser-card` visible, fertiliser name non-empty, `#apply-all-btn` visible | dashboard |
| T04 | Dashboard bed cards | Exactly 5 `.bed-card` elements; each has a `.crop-emojis` and `.stage-badge` | dashboard |
| T05 | Dashboard → Beds nav | Clicking a bed card navigates to Beds tab; `#bed-detail` shows `.bed-title` | beds |
| T05b | Plant map labels | `#bed-detail svg text` elements present and non-empty; every circle carries a crop emoji or abbreviation | plant-map |
| T06 | Beds tab — pill count | Exactly 5 `.bed-pill-btn` pills; `#bed-detail` visible | beds |
| T07 | Bed pill switching | Clicking each bed pill updates `#bed-detail .bed-title` to the selected bed | beds |
| T08 | Plant map emojis | Each `.plant-circle` in SVG has a `<text>` child that is non-empty (regression guard) | plant-map |
| T09 | Trellis lines | Beds 2, 4, 5 SVG contains `<line>` elements; bed 1 does not | plant-map |
| T10 | Harvest countdown | `.harvest-card` elements visible, each has a crop name and "days to harvest" text | beds |
| T11 | Week accordion | `.week-group` elements render (count > 0); each has a `.week-group-header` | beds |
| T12 | Accordion toggle | A collapsed `.week-group` expands when its header is clicked (skipped at week 0) | beds |
| T13 | Notes section | `textarea.notes-textarea` and `.save-note-btn` visible in bed detail | beds |
| T14 | Analysis history | `.analysis-history-section` visible in bed detail | beds |
| T15 | Plant modal opens | Clicking `.plant-circle` opens `#modal-sheet` with `.modal-plant-name` and `.modal-stage-badge` | beds |
| T16 | Modal closes | Clicking `#modal-backdrop` removes `active` class from `#modal-sheet` | beds |
| T17 | Task checkbox toggle | Clicking an incomplete `.task-checkbox` adds `.completed` to the row; Undo reverts | beds |
| T18 | Fertiliser current card | `.fert-current-card` visible, `.fert-current-product` non-empty, card has `eco-booch` or `liquid-gold` class | fertiliser |
| T19 | Fertiliser bed rows | Exactly 5 `.fert-bed-row` rows and 5 `.apply-btn` buttons | fertiliser |
| T20 | Rotation calendar | `.rotation-calendar` visible; `.rotation-row` elements present | fertiliser |
| T21 | Fertiliser apply toast | Clicking `.apply-btn` shows `#toast` containing product name | fertiliser |
| T22 | Analysis tab badge | `#tab-analysis .week-badge` contains text "AI Analysis" | analysis |
| T23 | Analysis pill switching | Clicking each `#analysis-bed-pills .bed-pill-btn` updates active pill | analysis |
| T24 | Analysis no-API-key error | Upload image + click Analyse → `#analysis-error` contains `unavailable\|api.?key\|503` | analysis |
| T25 | Admin table | `#tab-admin table tbody tr` count ≥ 7 (7 canonical seed types) | admin |
| T26 | Admin form fields | `#sf-name`, `#sf-variety`, `#sf-category` and harvest day inputs visible | admin |
| T27 | Admin add + delete | Adding a uniquely-named seed type creates a new row; deleting it removes the row | admin |
| T28 | Desktop sidebar | At 1280 × 800 sidebar width < 300 px; 5 `.nav-tab` elements; tab switching works | responsive |
| T29 | Desktop modal centered | Modal Y-position is within top 70% of viewport at 1280 × 800 | responsive |
| T30 | Note save toast | Typing in notes + clicking save → `#toast` contains "saved" | beds |
| T31–T36 | API layer | `/api/state`, `/api/fertiliser`, `POST /api/notes`, 404 handling, 503 on no key | api |
| T37 | API task toggle | `POST /api/task/:id/toggle` flips `is_complete`; Undo endpoint reverts (skipped at week 0) | api |
| T38 | Sow status default | Fresh DB: every bed card stage badge shows "Not sown yet" (grey); bed detail shows "0 of N plants sown" with a "Sow remaining N" button | sow |
| T39 | Per-plant sow toggle | Plant modal on un-sown plant shows "🌱 Mark as sown" button; clicking flips status; un-sowing shows started-date label | sow |
| T40 | Bulk sow-all | Clicking "Sow remaining N" stamps planted_date on every un-sown plant in the bed; status row collapses to "All N plants sown" | sow |
| T41 | API per-plant sow | `POST /api/plants/:id/sow` toggles `planted_date` between NULL and `now`; `sown` boolean tracks state | api-sow |
| T42 | Legacy date migration | DB rows with planted_date='2026-04-27' (legacy hardcoded value) are nullified at boot; non-legacy dates preserved | migration |

---

## Known Gaps and Out-of-Scope Areas

Areas **not** covered by automated E2E tests, with the reason and the manual verification step:

| Area | Why not automated | Manual check |
|------|-------------------|--------------|
| Notes persistence across reload | Multi-step: type, save, reload, verify text still present | Type in a bed's notes area, reload the page, confirm text is retained |
| Fertiliser apply — timestamp update | DB write; UI shows "Last applied" timestamp after click | Click Apply for one bed; confirm timestamp refreshes to current time |
| Analysis with real API key | Requires `ANTHROPIC_API_KEY` in env; billed | Upload a real photo with key set; confirm JSON result card renders |
| Harvest countdown accuracy | Depends on real date vs season epoch | Confirm countdown numbers are plausible given current week |
| Image upload — drag-and-drop | Playwright file-chooser doesn't fully simulate drag | Manually drag an image onto `.upload-zone` |
| Mobile viewport layout | Not a separate project; viewport is set in config | Test on a real phone or Chrome DevTools device emulation |
| T12 accordion toggle at week ≥ 1 | Skipped at week 0 (no collapsed groups) | Run suite after 2026-05-03; T12 should pass automatically |
| T37 API task toggle at week ≥ 1 | Skipped at week 0 (no incomplete tasks) | Run suite after 2026-05-03; T37 should pass automatically |

---

## Regression Run Log

| Date | Branch / commit | Pass | Fail | Skipped | Notes |
|------|-----------------|------|------|---------|-------|
| 2026-04-27 | master / 9cee5bd | 9 | 0 | 0 | Baseline (9-test suite) after security hardening, emoji fix |
| 2026-04-27 | master / 9cee5bd | 35 | 0 | 2 | Full 37-test suite; 2 skips are week-0 data-dependent (T12, T37) |
| 2026-04-27 | master / 9cee5bd | 35 | 0 | 2 | After R1–R4: DB reset via API, next-week preview, SVG tooltips, T25/T27 strict assertions |
| 2026-05-10 | master (uncommitted) | 69 | 0 | 0 | After per-plant sow toggle + general hardening (T17 fix: rerenderBedTasks now preserves expanded weeks); T35–T37 fail in full suite due to 200/min rate limiter, pass in isolation |

---

## How to Run

```bash
# Full suite (Chromium only, fast)
npx playwright test --project=chromium

# Specific test by title substring
npx playwright test -g "plant map"

# With headed browser (useful for debugging)
npx playwright test --headed --project=chromium

# Generate HTML report
npx playwright test && npx playwright show-report
```

---

## Adding a New Test

1. Add a row to the inventory table above with a new ID and acceptance criterion.
2. Write the test in `tests/e2e/garden.spec.js` (or a new spec file under `tests/e2e/`).
3. Run the suite locally; confirm the new test passes.
4. Update the run log.

**Acceptance criterion must assert content, not just existence.** The T05b row exists because T05a only checked that an SVG was visible — it did not verify that the SVG contained labelled elements. A blank SVG passes a visibility check.
