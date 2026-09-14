import { expect, test } from '@playwright/test';

test('loads the page and the model appears', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();

  // main.js logs the canonical bone table once the rig is normalised and
  // added to the scene — its presence is our "the model appears" signal
  // without pixel-diffing WebGL output (PLAN.md §7).
  const rigLog = page.waitForEvent('console', (msg) => msg.text().includes('[rig] canonical bone table'));
  await page.reload();
  await rigLog;

  expect(errors).toEqual([]);
});
