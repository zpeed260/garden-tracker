# Regression Test Catalogue

Living document. Update the run log after every test run, and add rows to the inventory whenever a new feature ships or a bug is fixed.

---

## Test Inventory

| ID | Test name | Acceptance criterion | Tag |
|----|-----------|----------------------|-----|
| T01 | App loads | Page title = "Garden Tracker", Dashboard tab active, `.week-badge` visible with text containing "Week" | smoke |
| T02 | Tab navigation | Clicking each of the 4 user-visible tabs activates the correct content section; no other section stays active | nav |
| T03 | Dashboard render | `.fertiliser-card` visible, fertiliser name non-empty, `#apply-all-btn` visible, at least one of `.current-section` / `.overdue-section` is present | dashboard |
| T04 | Beds tab — pill count | Exactly 5 `.bed-pill-btn` pills render; `#bed-detail` is visible | beds |
| T05a | Bed detail — structure | Clicking a bed card on the dashboard navigates to Beds tab; `#bed-detail` shows an SVG and a `textarea.notes-textarea` | beds |
| T05b | Bed detail — plant map labels | `#bed-detail svg text` elements are present and non-empty; every planted circle carries a crop emoji or abbreviation | plant-map |
| T05c | Bed detail — week accordion | `#bed-detail .week-group` elements render (count > 0) | beds |
| T06 | Fertiliser tab | `.fert-current-card` visible, product name non-empty, exactly 5 `.fert-bed-row` rows, exactly 5 `.apply-btn` buttons | fertiliser |
| T07 | Analysis tab — UI | `.upload-zone` visible, 5 `#analysis-bed-pills .bed-pill-btn` pills, exactly 1 active pill, `#file-input` attached | analysis |
| T08 | Analysis — no API key | Uploading an image and clicking Analyse with no API key configured shows `#analysis-error` with text matching `unavailable\|api.?key\|503\|error` | analysis |
| T09 | Desktop sidebar | At 1280 × 800 `#bottom-nav` renders with width < 300 px (sidebar, not bottom bar), 5 `.nav-tab` elements present, tab switching still works | responsive |

---

## Known Gaps and Out-of-Scope Areas

Areas **not** covered by automated E2E tests, with the reason and the manual verification step:

| Area | Why not automated | Manual check |
|------|-------------------|--------------|
| Task toggle (marking a task done) | Requires a live DB write + UI state change; added to backlog | Click a task checkbox in Dashboard; verify it gains a "done" style |
| Notes save and persist | Multi-step: type, blur/submit, reload, verify persistence | Type in a bed's notes area, reload the page, confirm text is still there |
| Fertiliser "Apply" button | DB write; row state changes after click | Click Apply on one bed in Fertiliser tab; confirm button state or timestamp updates |
| Analysis with real API key | Requires `ANTHROPIC_API_KEY` in env; billed | Upload a real photo with key set; confirm JSON result card renders |
| Harvest countdown accuracy | Depends on real date vs season epoch | Confirm countdown numbers are plausible given current week |
| Admin tab content | Contents unknown at time of writing | Visit Admin tab; confirm intended controls are present |
| Image upload — drag-and-drop | Playwright file-chooser doesn't fully simulate drag | Manually drag an image onto `.upload-zone` |
| Mobile viewport layout | Not a separate project; viewport is set in config | Test on a real phone or Chrome DevTools device emulation |

---

## Regression Run Log

| Date | Branch / commit | Pass | Fail | Skipped | Notes |
|------|-----------------|------|------|---------|-------|
| 2026-04-27 | master / 9cee5bd | 9 | 0 | 0 | Baseline after security hardening, emoji fix |
| _(next run)_ | | | | | |

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
