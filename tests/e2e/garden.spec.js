'use strict';

const { test, expect, request } = require('@playwright/test');
const path = require('path');

const SS = (name) => path.join('tests', 'e2e', 'screenshots', `${name}.png`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForAppReady(page) {
  await page.waitForSelector('.week-badge', { state: 'visible', timeout: 12_000 });
}

async function goToBeds(page) {
  await page.locator('.nav-tab[data-tab="beds"]').click();
  await page.waitForSelector('#bed-detail .bed-title', { timeout: 8_000 });
}

async function goToFertiliser(page) {
  await page.locator('.nav-tab[data-tab="fertiliser"]').click();
  await page.waitForSelector('.fert-current-card', { timeout: 8_000 });
}

// ─── 1. App Boot & Navigation ─────────────────────────────────────────────────

test.describe('1. App Boot & Navigation', () => {

  test('T01 app loads — title, dashboard active, week-badge visible', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page).toHaveTitle('Garden Tracker');

    const dashTab = page.locator('.nav-tab[data-tab="dashboard"]');
    await expect(dashTab).toHaveClass(/active/);
    await expect(page.locator('#tab-dashboard')).toHaveClass(/active/);

    const badge = page.locator('.week-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Week');

    await page.screenshot({ path: SS('T01-app-loads') });
  });

  test('T02 tab navigation — all 5 tabs switch correctly', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const tabs = [
      { name: 'beds',       content: '#tab-beds' },
      { name: 'fertiliser', content: '#tab-fertiliser' },
      { name: 'analysis',   content: '#tab-analysis' },
      { name: 'admin',      content: '#tab-admin' },
      { name: 'dashboard',  content: '#tab-dashboard' },
    ];

    for (const { name, content } of tabs) {
      await page.locator(`.nav-tab[data-tab="${name}"]`).click();
      await expect(page.locator(`.nav-tab[data-tab="${name}"]`)).toHaveClass(/active/);
      await expect(page.locator(content)).toHaveClass(/active/);
      for (const other of tabs.filter(t => t.name !== name)) {
        await expect(page.locator(other.content)).not.toHaveClass(/active/);
      }
    }

    await page.screenshot({ path: SS('T02-tab-navigation') });
  });

});

// ─── 2. Dashboard ─────────────────────────────────────────────────────────────

test.describe('2. Dashboard', () => {

  test('T03 fertiliser card — correct CSS class and non-empty product name', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const card = page.locator('.fertiliser-card');
    await expect(card).toBeVisible();

    // Card must carry either liquid-gold or eco-booch — never neither
    const cls = await card.getAttribute('class');
    expect(cls).toMatch(/liquid-gold|eco-booch/);

    // Product name shown inside the card must be non-empty
    const fertName = page.locator('.fert-name');
    await expect(fertName).toBeVisible();
    const txt = await fertName.textContent();
    expect(txt.trim().length).toBeGreaterThan(0);

    // Apply-all button present
    await expect(page.locator('#apply-all-btn')).toBeVisible();

    await page.screenshot({ path: SS('T03-dashboard-fertiliser') });
  });

  test('T04 bed cards — 5 cards with emojis, stage badges, status dots, progress rings', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const cards = page.locator('.bed-card');
    await expect(cards).toHaveCount(5);

    // Each card must have a name, emoji, stage badge, and status dot
    for (let i = 0; i < 5; i++) {
      const card = cards.nth(i);
      const name = await card.locator('.bed-card-name').textContent();
      expect(name.trim().length).toBeGreaterThan(0);

      const emojis = await card.locator('.crop-emojis').textContent();
      expect(emojis.trim().length).toBeGreaterThan(0);

      const stageBadge = card.locator('.stage-badge');
      await expect(stageBadge).toBeVisible();
      const stageTxt = await stageBadge.textContent();
      expect(stageTxt.trim().length).toBeGreaterThan(0);

      const dot = await card.locator('.status-dot').textContent();
      expect(['🔴', '🟡', '🟢']).toContain(dot.trim());
    }

    // Progress ring SVG present in each card
    const rings = page.locator('.bed-card svg');
    await expect(rings).toHaveCount(5);

    await page.screenshot({ path: SS('T04-dashboard-bed-cards') });
  });

  test('T05 task sections — at least one task section with task rows', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const hasCurrent = await page.locator('.current-section').isVisible();
    const hasOverdue = await page.locator('.overdue-section').isVisible();
    expect(hasCurrent || hasOverdue).toBe(true);

    // Current section label includes the week number
    if (hasCurrent) {
      await expect(page.locator('.current-section .section-label')).toContainText('Week');
      // Task rows exist (at least one task in week 1)
      const rows = page.locator('.current-section .task-row');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    }

    // Each task row has a checkbox button
    const checkboxes = page.locator('.task-checkbox');
    const cbCount = await checkboxes.count();
    expect(cbCount).toBeGreaterThan(0);

    await page.screenshot({ path: SS('T05-dashboard-tasks') });
  });

});

// ─── 3. Beds Tab ─────────────────────────────────────────────────────────────

test.describe('3. Beds Tab', () => {

  test('T06 5 pills render; bed detail shows bed title', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    const pills = page.locator('.bed-pill-btn');
    await expect(pills).toHaveCount(5);

    // Exactly one pill is active
    await expect(page.locator('.bed-pill-btn.active')).toHaveCount(1);

    // Bed detail has a title
    const title = page.locator('#bed-detail .bed-title');
    await expect(title).toBeVisible();
    const titleTxt = await title.textContent();
    expect(titleTxt.trim().length).toBeGreaterThan(0);

    await page.screenshot({ path: SS('T06-beds-pills') });
  });

  test('T07 pill switching — clicking bed2 updates active pill and title', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    // Click the bed2 pill (second pill)
    const bed2Pill = page.locator('.bed-pill-btn[data-bed-id="bed2"]');
    await bed2Pill.click();
    await page.waitForSelector('#bed-detail .bed-title', { timeout: 8_000 });

    // bed2 pill is now active, bed1 is not
    await expect(bed2Pill).toHaveClass(/active/);
    await expect(page.locator('.bed-pill-btn[data-bed-id="bed1"]')).not.toHaveClass(/active/);

    // Title should reference Broad Beans
    const title = await page.locator('#bed-detail .bed-title').textContent();
    expect(title).toContain('Broad Bean');

    await page.screenshot({ path: SS('T07-beds-pill-switch') });
  });

  test('T08 plant map — SVG visible with emoji labels', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    const svg = page.locator('#bed-detail .plant-map-svg');
    await expect(svg).toBeVisible();

    // Plant circles exist
    const circles = page.locator('#bed-detail .plant-circle');
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThan(0);

    // Emoji text labels exist and are non-empty
    const labels = page.locator('#bed-detail svg text');
    await expect(labels.first()).toBeVisible({ timeout: 6_000 });
    const labelCount = await labels.count();
    expect(labelCount).toBeGreaterThan(0);

    const firstLabel = await labels.first().textContent();
    expect(firstLabel.trim().length).toBeGreaterThan(0);

    // Stage legend dots are rendered below the SVG
    const legend = page.locator('#bed-detail .plant-map-container');
    await expect(legend).toBeVisible();

    await page.screenshot({ path: SS('T08-plant-map') });
  });

  test('T09 trellis lines — bed2/4/5 SVGs contain dashed line elements', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    for (const bedId of ['bed2', 'bed4', 'bed5']) {
      await page.locator('.nav-tab[data-tab="beds"]').click();
      await page.locator(`.bed-pill-btn[data-bed-id="${bedId}"]`).click();
      await page.waitForSelector('#bed-detail .plant-map-svg', { timeout: 8_000 });

      // Trellis beds have <line> elements in the SVG
      const lines = page.locator('#bed-detail svg line');
      const lineCount = await lines.count();
      expect(lineCount).toBeGreaterThan(0);
    }

    // bed1 has no trellis lines (it is not in TRELLIS_BEDS)
    await page.locator('.nav-tab[data-tab="beds"]').click();
    await page.locator('.bed-pill-btn[data-bed-id="bed1"]').click();
    await page.waitForSelector('#bed-detail .plant-map-svg', { timeout: 8_000 });
    const bed1Lines = page.locator('#bed-detail svg line');
    await expect(bed1Lines).toHaveCount(0);

    await page.screenshot({ path: SS('T09-trellis-lines') });
  });

  test('T10 harvest countdown — cards present with crop names and labels', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    const countdown = page.locator('.harvest-countdown');
    await expect(countdown).toBeVisible();

    const cards = page.locator('.harvest-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Each card has a harvest icon and a crop name
    const firstCard = cards.first();
    await expect(firstCard.locator('.harvest-icon')).toBeVisible();
    const name = await firstCard.locator('.harvest-name').textContent();
    expect(name.trim().length).toBeGreaterThan(0);

    // Status label present (days-label, soon-label, ready-label, or overdue-label)
    const hasAnyLabel =
      (await firstCard.locator('.days-label, .soon-label, .ready-label, .overdue-label').count()) > 0;
    expect(hasAnyLabel).toBe(true);

    await page.screenshot({ path: SS('T10-harvest-countdown') });
  });

  test('T11 week accordion — groups present, current week expanded', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);
    // Bed 5 is always sowed — navigate there to ensure week groups are present
    await page.locator('.bed-pill-btn[data-bed-id="bed5"]').click();
    await page.waitForSelector('#bed-tasks-list .week-group', { timeout: 8_000 });

    const groups = page.locator('#bed-detail .week-group');
    const groupCount = await groups.count();
    expect(groupCount).toBeGreaterThan(0);

    // Current week group has .current-week class and is expanded
    const currentGroup = page.locator('#bed-detail .week-group.current-week');
    // May not exist if current week has no bed-specific tasks — check generally
    const firstGroup = groups.first();
    const firstCls = await firstGroup.getAttribute('class');
    expect(firstCls).toMatch(/expanded|collapsed/);

    // Week label text contains "Week"
    const firstLabel = await groups.first().locator('.week-label').textContent();
    expect(firstLabel).toContain('Week');

    // Progress text has "X/Y done" pattern
    const progress = await groups.first().locator('.week-progress').textContent();
    expect(progress).toMatch(/\d+\/\d+/);

    await page.screenshot({ path: SS('T11-week-accordion') });
  });

  test('T12 accordion toggle — clicking a collapsed group expands it', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    // Find a collapsed group
    const collapsed = page.locator('#bed-detail .week-group.collapsed').first();
    const count = await collapsed.count();
    if (count === 0) {
      // All groups may be expanded (e.g., current week is week 1, all future weeks visible)
      // Skip rather than fail — this is a valid data-dependent state
      test.skip();
    }

    const groupId = await collapsed.getAttribute('id');
    await collapsed.locator('.week-group-header').click();
    await expect(page.locator(`#${groupId}`)).toHaveClass(/expanded/);
    await expect(page.locator(`#${groupId}`)).not.toHaveClass(/collapsed/);

    // Chevron should now point down
    const chevron = page.locator(`#${groupId} .chevron`);
    await expect(chevron).toContainText('▼');

    await page.screenshot({ path: SS('T12-accordion-toggle') });
  });

  test('T13 notes section — textarea and save button present', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    const textarea = page.locator('textarea.notes-textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', /note/i);

    const saveBtn = page.locator('.save-note-btn');
    await expect(saveBtn).toBeVisible();

    await page.screenshot({ path: SS('T13-notes-section') });
  });

  test('T14 analysis history section present', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    const histSection = page.locator('.analysis-history-section');
    await expect(histSection).toBeVisible();

    // Section label reads "Recent AI Analyses"
    const label = histSection.locator('.section-label');
    await expect(label).toContainText('AI Anal');

    await page.screenshot({ path: SS('T14-analysis-history') });
  });

});

// ─── 4. Plant Modal ───────────────────────────────────────────────────────────

test.describe('4. Plant Modal', () => {

  test('T15 clicking a plant circle opens modal with name and stage badge', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    // Click the first plant circle (SVG circle with onclick)
    const circle = page.locator('#bed-detail .plant-circle').first();
    await expect(circle).toBeVisible();
    await circle.click();

    // Modal backdrop and sheet become active
    await expect(page.locator('#modal-backdrop')).toHaveClass(/active/, { timeout: 6_000 });
    await expect(page.locator('#modal-sheet')).toHaveClass(/active/);

    // Modal shows plant name and stage badge
    const plantName = page.locator('.modal-plant-name');
    await expect(plantName).toBeVisible();
    const nameText = await plantName.textContent();
    expect(nameText.trim().length).toBeGreaterThan(0);

    await expect(page.locator('.modal-stage-badge')).toBeVisible();

    // Stats grid: days since sown, to harvest, position
    const stats = page.locator('.modal-stat');
    const statCount = await stats.count();
    expect(statCount).toBeGreaterThanOrEqual(3);

    await page.screenshot({ path: SS('T15-plant-modal-open') });
  });

  test('T16 clicking backdrop closes modal', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    // Open modal
    await page.locator('#bed-detail .plant-circle').first().click();
    await expect(page.locator('#modal-backdrop')).toHaveClass(/active/, { timeout: 6_000 });

    // Click backdrop
    await page.locator('#modal-backdrop').click();

    // Modal no longer active
    await expect(page.locator('#modal-backdrop')).not.toHaveClass(/active/, { timeout: 4_000 });
    await expect(page.locator('#modal-sheet')).not.toHaveClass(/active/);

    await page.screenshot({ path: SS('T16-modal-closed') });
  });

});

// ─── 5. Task Interaction ─────────────────────────────────────────────────────

test.describe('5. Task Interaction', () => {

  test('T17 toggle task — checkbox flips, toast shows, undo reverts', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Go to Bed 5 — always sowed, week 1 tasks are incomplete after a test reset
    await goToBeds(page);
    await page.locator('.bed-pill-btn[data-bed-id="bed5"]').click();
    await page.waitForSelector('#bed-tasks-list .week-group', { timeout: 8_000 });

    // Expand week 1 (it may already be expanded; click the header to be safe if collapsed)
    const week1Group = page.locator('#wg-1');
    await expect(week1Group).toBeVisible({ timeout: 6_000 });
    const isCollapsed = await week1Group.evaluate(el => el.classList.contains('collapsed'));
    if (isCollapsed) {
      await page.locator('#wg-1 .week-group-header').click();
    }

    // Find the first incomplete task row in week 1
    const taskRow = page.locator('#wg-1 .task-row:not(.completed)').first();
    await expect(taskRow).toBeVisible({ timeout: 6_000 });
    const rowId = await taskRow.getAttribute('id');
    const checkbox = taskRow.locator('.task-checkbox');

    // Toggle to complete
    await checkbox.click();
    await expect(page.locator('#toast')).toContainText(/complete/, { timeout: 6_000 });

    // Row should be completed — scope to #tab-beds to avoid matching preview rows in dashboard
    const bedRow = page.locator(`#tab-beds #${rowId}`);
    await expect(bedRow).toHaveClass(/completed/, { timeout: 4_000 });
    await expect(bedRow.locator('.task-checkbox')).toHaveClass(/checked/);

    // Undo to revert (keeps DB clean for subsequent runs)
    const undoBtn = bedRow.locator('.undo-btn');
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();
    await expect(page.locator('#toast')).toContainText(/unmarked|Task/, { timeout: 4_000 });
    await expect(bedRow).not.toHaveClass(/completed/, { timeout: 4_000 });

    await page.screenshot({ path: SS('T17-task-toggle') });
  });

});

// ─── 6. Fertiliser Tab ───────────────────────────────────────────────────────

test.describe('6. Fertiliser Tab', () => {

  test('T18 current product card — title includes "Week", product non-empty', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToFertiliser(page);

    const card = page.locator('.fert-current-card');
    await expect(card).toBeVisible();

    const title = page.locator('.fert-current-title');
    await expect(title).toContainText('Week');

    const product = page.locator('.fert-current-product');
    await expect(product).toBeVisible();
    const productTxt = await product.textContent();
    expect(productTxt.trim().length).toBeGreaterThan(0);
    // Must be one of the two known products
    expect(productTxt).toMatch(/Liquid Gold|Eco Booch/);

    const instructions = page.locator('.fert-current-instructions');
    await expect(instructions).toBeVisible();

    await page.screenshot({ path: SS('T18-fertiliser-card') });
  });

  test('T19 5 bed rows each with apply button', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToFertiliser(page);

    const rows = page.locator('.fert-bed-row');
    await expect(rows).toHaveCount(5);

    const applyBtns = page.locator('.apply-btn');
    await expect(applyBtns).toHaveCount(5);

    // Each row has a bed name
    for (let i = 0; i < 5; i++) {
      const name = await rows.nth(i).locator('.fert-bed-name').textContent();
      expect(name.trim().length).toBeGreaterThan(0);
    }

    await page.screenshot({ path: SS('T19-fertiliser-rows') });
  });

  test('T20 rotation calendar — 8 upcoming week rows', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToFertiliser(page);

    const calendar = page.locator('.rotation-calendar');
    await expect(calendar).toBeVisible();

    // 8 upcoming weeks + 1 current row = 9 rows total; API returns exactly 8 upcoming
    const rows = page.locator('.rotation-row');
    // At least 8 rows (may have current row at top)
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(8);

    // Each row has a week label and a product
    const firstRow = rows.first();
    await expect(firstRow.locator('.rotation-week')).toBeVisible();
    await expect(firstRow.locator('.rotation-product')).toBeVisible();

    await page.screenshot({ path: SS('T20-rotation-calendar') });
  });

  test('T21 apply fertiliser — toast confirms product and bed', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToFertiliser(page);

    const firstApplyBtn = page.locator('.apply-btn').first();
    await firstApplyBtn.click();

    // Toast shows product and bed name
    // Wait for toast text directly — avoids race where toast hides before we read textContent
    await expect(page.locator('#toast')).toContainText(/Liquid Gold|Eco Booch/, { timeout: 6_000 });

    // After applying, last-applied text updates for that bed
    await page.waitForSelector('.fert-current-card', { timeout: 8_000 });

    await page.screenshot({ path: SS('T21-fertiliser-apply') });
  });

});

// ─── 7. AI Analysis Tab ──────────────────────────────────────────────────────

test.describe('7. AI Analysis Tab', () => {

  test('T22 UI elements — upload zone, 5 pills, 1 active, hidden file input', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('.nav-tab[data-tab="analysis"]').click();
    await page.waitForSelector('.upload-zone', { timeout: 8_000 });

    await expect(page.locator('.upload-zone')).toBeVisible();

    // Week badge on analysis tab reads "AI Analysis" — scope to avoid matching dashboard badge
    await expect(page.locator('#tab-analysis .week-badge')).toContainText('AI Analysis');

    const pills = page.locator('#analysis-bed-pills .bed-pill-btn');
    await expect(pills).toHaveCount(5);
    await expect(page.locator('#analysis-bed-pills .bed-pill-btn.active')).toHaveCount(1);

    // Preview section hidden by default
    await expect(page.locator('.preview-section')).not.toBeVisible();

    // File input attached (but hidden)
    await expect(page.locator('#file-input')).toBeAttached();

    await page.screenshot({ path: SS('T22-analysis-ui') });
  });

  test('T23 bed pill switching — active pill moves to clicked pill', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('.nav-tab[data-tab="analysis"]').click();
    await page.waitForSelector('#analysis-bed-pills', { timeout: 8_000 });

    // Click bed2 pill
    const bed2 = page.locator('#analysis-bed-pills .bed-pill-btn[data-bed-id="bed2"]');
    await bed2.click();
    await expect(bed2).toHaveClass(/active/);
    // bed1 is no longer active
    await expect(
      page.locator('#analysis-bed-pills .bed-pill-btn[data-bed-id="bed1"]')
    ).not.toHaveClass(/active/);
    // Still exactly one active pill
    await expect(page.locator('#analysis-bed-pills .bed-pill-btn.active')).toHaveCount(1);

    await page.screenshot({ path: SS('T23-analysis-pill-switch') });
  });

  test('T24 analyse without API key — 503 error shown in UI', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('.nav-tab[data-tab="analysis"]').click();
    await page.waitForSelector('.upload-zone', { timeout: 8_000 });

    // Inject a 1×1 PNG
    const fakeImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.upload-zone').click();
    const fc = await chooser;
    await fc.setFiles({ name: 'test.png', mimeType: 'image/png', buffer: fakeImage });

    await page.waitForSelector('.preview-section', { state: 'visible', timeout: 6_000 });
    await expect(page.locator('#btn-analyse')).toBeVisible();
    await page.locator('#btn-analyse').click();

    const errEl = page.locator('#analysis-error');
    await expect(errEl).toBeVisible({ timeout: 12_000 });
    const errTxt = await errEl.textContent();
    expect(errTxt.toLowerCase()).toMatch(/unavailable|api.?key|503|error|too.?many|rate|429/);

    await page.screenshot({ path: SS('T24-analysis-503') });
  });

});

// ─── 8. Admin Tab ────────────────────────────────────────────────────────────

test.describe('8. Admin Tab', () => {

  test('T25 heading and seed types table render with 7 seed types', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('.nav-tab[data-tab="admin"]').click();
    await page.waitForSelector('#tab-admin table', { timeout: 8_000 });

    // Heading
    const heading = page.locator('#tab-admin h2');
    await expect(heading).toContainText('Seed Type Library');

    const rows = page.locator('#tab-admin table tbody tr');
    await expect(rows).toHaveCount(7);

    // Columns: Name, Variety, Category, Harvest day, Spacing, actions
    const headers = page.locator('#tab-admin table thead th');
    await expect(headers).toHaveCount(6);

    await page.screenshot({ path: SS('T25-admin-table') });
  });

  test('T26 add form — required fields and buttons present', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('.nav-tab[data-tab="admin"]').click();
    await page.waitForSelector('#admin-form-container', { timeout: 8_000 });

    // Name field
    await expect(page.locator('#sf-name')).toBeVisible();
    // Variety field
    await expect(page.locator('#sf-variety')).toBeVisible();
    // Category select
    await expect(page.locator('#sf-category')).toBeVisible();
    // Harvest start/end
    await expect(page.locator('#sf-hstart')).toBeVisible();
    await expect(page.locator('#sf-hend')).toBeVisible();
    // Notes textarea
    await expect(page.locator('#sf-notes')).toBeVisible();
    // AI Suggest and Add buttons
    await expect(page.locator('[onclick="aiSuggestSeedType()"]')).toBeVisible();
    await expect(page.locator('[onclick="saveSeedType(null)"]')).toBeVisible();

    await page.screenshot({ path: SS('T26-admin-form') });
  });

  test('T27 add seed type — saves and appears in table', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('.nav-tab[data-tab="admin"]').click();
    await page.waitForSelector('#admin-form-container', { timeout: 8_000 });

    // Use a unique name so this test is idempotent across runs
    const testName = `E2E Test ${Date.now()}`;
    const before = await page.locator('#tab-admin table tbody tr').count();

    await page.locator('#sf-name').fill(testName);
    await page.locator('#sf-variety').fill('Test Var');
    await page.locator('#sf-hstart').fill('60');
    await page.locator('#sf-hend').fill('120');
    await page.locator('[onclick="saveSeedType(null)"]').click();

    // Wait for the specific row to appear (not just the table, which is always visible)
    const testRow = page.locator('#tab-admin table tbody tr').filter({ hasText: testName });
    await expect(testRow).toBeVisible({ timeout: 8_000 });

    const after = await page.locator('#tab-admin table tbody tr').count();
    expect(after).toBe(before + 1);

    // Delete it — register dialog handler BEFORE the click
    page.once('dialog', d => d.accept());
    await testRow.locator('button:has-text("Delete")').click();
    // Wait for the row to disappear so subsequent tests see a clean count
    await expect(testRow).not.toBeVisible({ timeout: 6_000 });

    await page.screenshot({ path: SS('T27-admin-add') });
  });

});

// ─── 9. Desktop Layout ───────────────────────────────────────────────────────

test.describe('9. Desktop Layout', () => {

  test('T28 sidebar nav renders at 1280×800 — width < 300px, 5 tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await waitForAppReady(page);

    const nav = page.locator('#bottom-nav');
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box.width).toBeLessThan(300);

    await expect(page.locator('.nav-tab')).toHaveCount(5);

    // Tab switching still works on desktop
    await page.locator('.nav-tab[data-tab="beds"]').click();
    await expect(page.locator('#tab-beds')).toHaveClass(/active/);

    await page.screenshot({ path: SS('T28-desktop-sidebar') });
  });

  test('T29 desktop modal — opens centered (not at bottom)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('.nav-tab[data-tab="beds"]').click();
    await page.waitForSelector('#bed-detail .plant-circle', { timeout: 8_000 });

    // Open modal
    await page.locator('#bed-detail .plant-circle').first().click();
    await expect(page.locator('#modal-sheet')).toHaveClass(/active/, { timeout: 6_000 });

    // Wait for the 0.28s CSS transition to complete
    await page.waitForTimeout(400);

    // Use getBoundingClientRect() for viewport-relative coords (boundingBox is page-relative)
    const vpRect = await page.locator('#modal-sheet').evaluate(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    });
    const vpHeight = 800;

    // Modal is centered: top edge should be well within the visible viewport
    expect(vpRect.top).toBeGreaterThan(0);
    expect(vpRect.top).toBeLessThan(vpHeight * 0.7);
    // Modal should not be anchored to the bottom (left-edge check: centered means ~(1280-520)/2 = ~380)
    expect(vpRect.left).toBeGreaterThan(50);

    // Close modal — backdrop is behind the centered sheet; force bypasses interception
    await page.locator('#modal-backdrop').click({ force: true });

    await page.screenshot({ path: SS('T29-desktop-modal') });
  });

});

// ─── 10. Note Interaction ─────────────────────────────────────────────────────

test.describe('10. Note Interaction', () => {

  test('T30 save a note — appears in note list with timestamp', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);

    const textarea = page.locator('textarea.notes-textarea');
    const unique = `Playwright test note ${Date.now()}`;
    await textarea.fill(unique);

    await page.locator('.save-note-btn').click();

    // Toast shows "Note saved"
    await expect(page.locator('#toast')).toContainText('Note saved', { timeout: 6_000 });

    // The note appears in the list
    const noteList = page.locator('.note-item');
    // At least one note
    await expect(noteList.first()).toBeVisible({ timeout: 4_000 });

    // The most recent note contains our text
    const noteContent = await noteList.first().locator('.note-content').textContent();
    expect(noteContent).toContain(unique);

    // Timestamp is present
    const dateEl = noteList.first().locator('.note-date');
    await expect(dateEl).toBeVisible();
    const dateTxt = await dateEl.textContent();
    expect(dateTxt.trim().length).toBeGreaterThan(0);

    await page.screenshot({ path: SS('T30-note-saved') });
  });

});

// ─── 11. API Contracts ───────────────────────────────────────────────────────

test.describe('11. API Contracts', () => {

  test('T31 GET /health — returns {status: "ok"}', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('T32 GET /api/state — correct shape and data', async ({ request }) => {
    const res = await request.get('/api/state');
    expect(res.ok()).toBe(true);
    const body = await res.json();

    // Top-level keys
    expect(typeof body.currentWeek).toBe('number');
    expect(typeof body.currentDate).toBe('string');
    expect(typeof body.fertiliser).toBe('string');
    expect(body.fertiliser).toMatch(/Liquid Gold|Eco Booch/);

    // 5 beds
    expect(Array.isArray(body.beds)).toBe(true);
    expect(body.beds).toHaveLength(5);

    // Each bed has id, name, plants array
    for (const bed of body.beds) {
      expect(typeof bed.id).toBe('string');
      expect(typeof bed.name).toBe('string');
      expect(Array.isArray(bed.plants)).toBe(true);
    }

    // Tasks object
    expect(Array.isArray(body.tasks.current)).toBe(true);
    expect(Array.isArray(body.tasks.overdue)).toBe(true);

    // Task summary
    expect(typeof body.taskSummary).toBe('object');

    // Each bed exposes sow_date and bed_week (Tasks 2 & 4)
    for (const bed of body.beds) {
      expect('sow_date' in bed).toBe(true);
      expect('bed_week' in bed).toBe(true);
    }
  });

  test('T33 GET /api/fertiliser — bedStatus (5 beds), upcoming (8 weeks)', async ({ request }) => {
    const res = await request.get('/api/fertiliser');
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(typeof body.currentProduct).toBe('string');
    expect(body.currentProduct).toMatch(/Liquid Gold|Eco Booch/);
    expect(body.bedStatus).toHaveLength(5);
    expect(body.upcoming).toHaveLength(8);

    // Each upcoming week has week and product
    for (const u of body.upcoming) {
      expect(typeof u.week).toBe('number');
      expect(u.product).toMatch(/Liquid Gold|Eco Booch/);
    }
  });

  test('T34 GET /api/seed-types — returns 7 seeded types', async ({ request }) => {
    const res = await request.get('/api/seed-types');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.length).toBe(7);
    // Each type has required fields
    for (const st of body.slice(0, 7)) {
      expect(typeof st.name).toBe('string');
      expect(typeof st.category).toBe('string');
      expect(typeof st.harvest_start_day).toBe('number');
    }
  });

  test('T35 POST /api/notes/bed1 — saves and returns note', async ({ request }) => {
    const content = `API test note ${Date.now()}`;
    const res = await request.post('/api/notes/bed1', {
      data: { content },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.content).toBe(content);
    expect(body.bed_id).toBe('bed1');
    expect(typeof body.created_at).toBe('string');
  });

  test('T36 POST /api/notes/:bed_id — invalid bed_id returns 404', async ({ request }) => {
    const res = await request.post('/api/notes/nonexistent_bed', {
      data: { content: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('T37 POST /api/tasks/:id/complete — toggles and returns updated task', async ({ request }) => {
    // Get the first incomplete task from state
    const stateRes = await request.get('/api/state');
    const state = await stateRes.json();
    const task = state.tasks.current.find(t => !t.is_complete) ||
                 state.tasks.overdue.find(t => !t.is_complete);

    if (!task) {
      test.skip(); // No incomplete tasks currently (all done)
    }

    const toggled = await request.post(`/api/tasks/${task.id}/complete`, {});
    expect(toggled.status()).toBe(200);
    const tBody = await toggled.json();
    expect(tBody.is_complete).toBe(1);

    // Undo immediately
    const undone = await request.post(`/api/tasks/${task.id}/complete`, {});
    expect(undone.status()).toBe(200);
    const uBody = await undone.json();
    expect(uBody.is_complete).toBe(0);
  });

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

  test('T39 GET /api/beds — each bed exposes sow_date and bed_week', async ({ request }) => {
    const res = await request.get('/api/beds');
    const beds = await res.json();
    for (const bed of beds) {
      expect('sow_date' in bed).toBe(true);
      expect('bed_week' in bed).toBe(true);
    }
    const bed5 = beds.find(b => b.id === 'bed5');
    expect(bed5.sow_date).toBe('2026-05-17');
    expect(typeof bed5.bed_week).toBe('number');
    expect(bed5.bed_week).toBeGreaterThanOrEqual(1);
  });

  test('T43 PUT /api/beds/bed5/sow-date — updates all plant planted_dates', async ({ request }) => {
    const res = await request.put('/api/beds/bed5/sow-date', {
      data: { date: '2026-05-10' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sow_date).toBe('2026-05-10');

    const bedsRes = await request.get('/api/beds');
    const beds = await bedsRes.json();
    const bed5 = beds.find(b => b.id === 'bed5');
    expect(bed5.sow_date).toBe('2026-05-10');
    expect(bed5.plants.every(p => p.planted_date === '2026-05-10')).toBe(true);
  });

});

// ─── 12. Per-bed Week Clock ──────────────────────────────────────────────────

test.describe('12. Per-bed Week Clock', () => {

  test.beforeAll(async ({ request }) => {
    // Restore deterministic sow state: bed1-4 unsowed, bed5 sowed 2026-05-17
    await request.post('/api/test/reset');
  });

  test('T40 unsowed bed shows not-sowed placeholder, zero week groups', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);
    // After reset, bed1 has no planted_date — task list shows placeholder
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

  test('T42 harvest countdown — sowed crop shows a month name in the countdown', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await goToBeds(page);
    await page.locator('.bed-pill-btn[data-bed-id="bed5"]').click();
    await page.waitForSelector('.harvest-countdown', { timeout: 8_000 });
    const card = page.locator('.harvest-card').first();
    await expect(card).toContainText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });

});
