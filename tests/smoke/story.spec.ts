import { expect, test } from '@playwright/test';

test('page loads, canvas renders, story begins', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#canvas-host canvas')).toBeVisible();
  await expect(page.locator('#loading')).toHaveClass(/hidden/);
  await expect(page.locator('.chapter-title').first()).toContainText('Welcome to the building');
  await expect(page.locator('#narration .para')).toHaveCount(1);
});

test('Next advances the narration without overlap', async ({ page }) => {
  await page.goto('/?lowq');
  await expect(page.locator('#narration .para')).toHaveCount(1);
  const next = page.locator('#btn-next');
  await next.click(); // fast-forwards the auto-played step
  await next.click(); // starts step 2
  await expect(page.locator('#narration .para')).toHaveCount(2);
  // Previous paragraph dims.
  await expect(page.locator('#narration .para').first()).toHaveClass(/dimmed/);
});

test('deep link opens the right chapter; invalid hash falls back to 1', async ({ page }) => {
  await page.goto('/?lowq#chapter-6');
  await expect(page.locator('.chapter-title').first()).toContainText('miss cascade');

  await page.goto('/?lowq#chapter-99');
  await expect(page.locator('.chapter-title').first()).toContainText('Welcome to the building');
});

test('pause control appears during playback', async ({ page }) => {
  await page.goto('/?lowq');
  // Auto-played first step: while playing, pause is visible and Next says Skip.
  const pause = page.locator('#btn-pause');
  const next = page.locator('#btn-next');
  const status = await next.textContent();
  if (status?.includes('Skip')) {
    await expect(pause).toBeVisible();
  } else {
    // Step already finished (fast machine) — Next pulses instead.
    await expect(next).toHaveClass(/pulsing/);
  }
});
