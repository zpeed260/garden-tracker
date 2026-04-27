'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

const SS = (name) =>
  path.join('tests', 'e2e', 'screenshots', `${name}.png`);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wait until the app has fully initialised — appState is set and the Dashboard
 * tab has rendered its week-badge element.
 */
async function waitForAppReady(page) {
  await page.waitForSelector('.week-badge', { state: 'visible', timeout: 12_000 });
}

// ─── Test suite ─────────────────────────────────────────────────────────────

test.describe('Garden Tracker — critical user journeys', () => {

  // ── 1. App loads ─────────────────────────────────────────────────────────

  test('app loads: page title, Dashboard active, week badge visible', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Page title
    await expect(page).toHaveTitle('Garden Tracker');

    // Dashboard tab is active
    const dashTab = page.locator('.nav-tab[data-tab="dashboard"]');
    await expect(dashTab).toHaveClass(/active/);

    // Dashboard tab-content is visible
    const dashContent = page.locator('#tab-dashboard');
    await expect(dashContent).toHaveClass(/active/);

    // Week badge rendered
    const weekBadge = page.locator('.week-badge');
    await expect(weekBadge).toBeVisible();
    await expect(weekBadge).toContainText('Week');

    await page.screenshot({ path: SS('01-app-loads'), fullPage: false });
  });

  // ── 2. Tab navigation ────────────────────────────────────────────────────

  test('tab navigation: each tab activates and shows its content', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForAppReady(page);

    const tabs = [
      { name: 'beds',       contentId: '#tab-beds' },
      { name: 'fertiliser', contentId: '#tab-fertiliser' },
      { name: 'analysis',   contentId: '#tab-analysis' },
      { name: 'dashboard',  contentId: '#tab-dashboard' },
    ];

    for (const { name, contentId } of tabs) {
      await page.locator(`.nav-tab[data-tab="${name}"]`).click();

      // Nav tab gains active class
      await expect(page.locator(`.nav-tab[data-tab="${name}"]`)).toHaveClass(/active/);

      // Correct content section becomes active
      await expect(page.locator(contentId)).toHaveClass(/active/);

      // Other content sections are not active
      for (const other of tabs.filter(t => t.name !== name)) {
        await expect(page.locator(other.contentId)).not.toHaveClass(/active/);
      }
    }

    await page.screenshot({ path: SS('02-tab-navigation'), fullPage: false });
  });

  // ── 3. Dashboard ──────────────────────────────────────────────────────────

  test('dashboard: fertiliser card visible and task sections render', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Fertiliser card is present
    const fertCard = page.locator('.fertiliser-card');
    await expect(fertCard).toBeVisible();

    // Fertiliser name text is non-empty
    const fertName = page.locator('.fert-name');
    await expect(fertName).toBeVisible();
    const fertText = await fertName.textContent();
    expect(fertText.trim().length).toBeGreaterThan(0);

    // Apply-all button exists
    await expect(page.locator('#apply-all-btn')).toBeVisible();

    // At least one task section rendered (overdue OR current)
    const hasCurrent = await page.locator('.current-section').isVisible();
    const hasOverdue = await page.locator('.overdue-section').isVisible();
    expect(hasCurrent || hasOverdue).toBe(true);

    // Current-section label contains week number
    if (hasCurrent) {
      const sectionLabel = page.locator('.current-section .section-label');
      await expect(sectionLabel).toContainText('Week');
    }

    await page.screenshot({ path: SS('03-dashboard'), fullPage: false });
  });

  // ── 4. Beds tab — 5 cards ────────────────────────────────────────────────

  test('beds tab: 5 bed cards render in the grid', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('.nav-tab[data-tab="beds"]').click();

    // Wait for bed cards to appear
    await page.waitForSelector('.bed-pill-btn', { timeout: 8_000 });

    // There should be exactly 5 bed selector pills
    const pills = page.locator('.bed-pill-btn');
    await expect(pills).toHaveCount(5);

    // And a bed-detail section rendered
    await expect(page.locator('#bed-detail')).toBeVisible();

    await page.screenshot({ path: SS('04-beds-tab'), fullPage: false });
  });

  // ── 5. Bed detail — clicking a bed card navigates to detail ──────────────

  test('bed detail: clicking a bed card shows plant map and notes textarea', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to beds tab by clicking the first bed card on the dashboard
    const firstBedCard = page.locator('.bed-card').first();
    await expect(firstBedCard).toBeVisible();
    await firstBedCard.click();

    // Should now be on beds tab
    await expect(page.locator('#tab-beds')).toHaveClass(/active/);

    // Wait for the detail to render
    await page.waitForSelector('#bed-detail', { timeout: 8_000 });
    const detail = page.locator('#bed-detail');
    await expect(detail).toBeVisible();

    // Plant map SVG should be present
    const plantMapSvg = detail.locator('svg').first();
    await expect(plantMapSvg).toBeVisible();

    // Notes textarea should exist
    const textarea = detail.locator('textarea.notes-textarea');
    await expect(textarea).toBeVisible();

    await page.screenshot({ path: SS('05-bed-detail'), fullPage: false });
  });

  // ── 5b. Bed detail — week accordion ──────────────────────────────────────

  test('bed detail: week accordion is present', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('.nav-tab[data-tab="beds"]').click();
    await page.waitForSelector('#bed-detail', { timeout: 8_000 });

    // Week groups (accordion items) should be visible in the detail
    const weekGroups = page.locator('#bed-detail .week-group');
    const weekGroupCount = await weekGroups.count();
    expect(weekGroupCount).toBeGreaterThan(0);

    await page.screenshot({ path: SS('05b-bed-detail-accordion'), fullPage: false });
  });

  // ── 6. Fertiliser tab ────────────────────────────────────────────────────

  test('fertiliser tab: current product card and all 5 beds in apply list', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('.nav-tab[data-tab="fertiliser"]').click();

    // Wait for the fertiliser tab content to render
    await page.waitForSelector('.fert-current-card', { timeout: 8_000 });

    // Current fertiliser card
    const fertCurrentCard = page.locator('.fert-current-card');
    await expect(fertCurrentCard).toBeVisible();

    const fertProduct = page.locator('.fert-current-product');
    await expect(fertProduct).toBeVisible();
    const productText = await fertProduct.textContent();
    expect(productText.trim().length).toBeGreaterThan(0);

    // All 5 beds should appear as rows in the apply list
    const fertBedRows = page.locator('.fert-bed-row');
    await expect(fertBedRows).toHaveCount(5);

    // Each row has an apply button
    const applyBtns = page.locator('.apply-btn');
    await expect(applyBtns).toHaveCount(5);

    await page.screenshot({ path: SS('06-fertiliser-tab'), fullPage: false });
  });

  // ── 7. AI Analysis tab — UI elements present ─────────────────────────────

  test('AI Analysis tab: bed selector pills and upload zone visible', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('.nav-tab[data-tab="analysis"]').click();

    // Wait for analysis tab to render
    await page.waitForSelector('.upload-zone', { timeout: 8_000 });

    // Upload zone is visible
    await expect(page.locator('.upload-zone')).toBeVisible();

    // Bed selector pills render (5 beds)
    const analysisPills = page.locator('#analysis-bed-pills .bed-pill-btn');
    await expect(analysisPills).toHaveCount(5);

    // One pill is active by default
    const activePill = page.locator('#analysis-bed-pills .bed-pill-btn.active');
    await expect(activePill).toHaveCount(1);

    // File input exists (hidden)
    await expect(page.locator('#file-input')).toBeAttached();

    await page.screenshot({ path: SS('07-analysis-tab'), fullPage: false });
  });

  // ── 8. AI Analysis disabled state — 503 error message ───────────────────

  test('AI Analysis: analysing without API key shows 503 error in UI', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.locator('.nav-tab[data-tab="analysis"]').click();
    await page.waitForSelector('.upload-zone', { timeout: 8_000 });

    // Create a tiny fake PNG in memory to satisfy the file input
    const fakeImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // Use Playwright's file chooser API to inject the fake file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.upload-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: fakeImageBuffer,
    });

    // Wait for the preview section to appear (file accepted)
    await page.waitForSelector('.preview-section', { state: 'visible', timeout: 6_000 });

    // Click analyse
    const analyseBtn = page.locator('#btn-analyse');
    await expect(analyseBtn).toBeVisible();
    await analyseBtn.click();

    // Wait for the error element to become visible (server returns 503)
    const errorEl = page.locator('#analysis-error');
    await expect(errorEl).toBeVisible({ timeout: 12_000 });

    // Error text should reference the API key or unavailability
    const errorText = await errorEl.textContent();
    expect(errorText.toLowerCase()).toMatch(/unavailable|api.?key|503|error/);

    await page.screenshot({ path: SS('08-analysis-disabled-state'), fullPage: false });
  });

  // ── 9. Desktop: sidebar nav renders ─────────────────────────────────────

  test('desktop: sidebar nav renders at 1280x800', async ({ page, browserName }) => {
    // This test is meaningful only when running with a wide viewport;
    // the project-level viewport for desktop-chrome sets 1280x800.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await waitForAppReady(page);

    const nav = page.locator('#bottom-nav');
    await expect(nav).toBeVisible();

    // On desktop the nav should have sidebar styles — check it's not at the bottom
    const navBox = await nav.boundingBox();
    // Sidebar: left edge at or near 0, not stretching full width
    expect(navBox.width).toBeLessThan(300);

    // All 5 nav tabs visible in sidebar (Dashboard, Beds, Fertiliser, AI Analysis, Admin)
    const navTabs = page.locator('.nav-tab');
    await expect(navTabs).toHaveCount(5);

    // Verify switching still works on desktop
    await page.locator('.nav-tab[data-tab="beds"]').click();
    await expect(page.locator('#tab-beds')).toHaveClass(/active/);

    await page.screenshot({ path: SS('09-desktop-sidebar'), fullPage: false });
  });

});
