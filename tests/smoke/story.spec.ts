import { expect, test } from '@playwright/test';
import { RUNGS, formatCycles } from '../../src/ui/ladderModel';

/**
 * Headless Chromium renders WebGL on a software rasteriser, so every action on the 3D page takes a second or
 * two. Tests that drive many of them get more than the 60 s default rather than flaking on a slow runner.
 */
const SLOW_TEST_MS = 150_000;

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

test('camera modes switch freely; dragging takes the camera and Resume hands it back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/?lowq&debug');
  await expect(page.locator('#canvas-host canvas')).toBeVisible();
  const mode = () => page.evaluate(() => (window as unknown as { __cpu: { view(): { cameraMode: string } } }).__cpu.view().cameraMode);
  expect(await mode()).toBe('cinematic');

  for (const [label, expected] of [
    ['Free', 'free'],
    ['Follow', 'follow'],
    ['Cinematic', 'cinematic'],
  ] as const) {
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(await mode()).toBe(expected);
  }

  // Learner drags the view: scripted camera stops and Resume appears (directed modes only).
  const box = (await page.locator('#canvas-host canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 20);
  await page.mouse.up();
  const resume = page.getByRole('button', { name: /Resume camera/ });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(resume).toBeHidden();

  expect(errors).toEqual([]);
});

test('Worker view: enter, look around, leave with Esc and the previous camera mode returns', async ({ page }) => {
  test.setTimeout(SLOW_TEST_MS);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/?lowq&debug&cam=follow');
  await expect(page.locator('#canvas-host canvas')).toBeVisible();
  const view = () =>
    page.evaluate(
      () => (window as unknown as { __cpu: { view(): { cameraMode: string; workerView: boolean } } }).__cpu.view(),
    );
  expect(await view()).toMatchObject({ cameraMode: 'follow', workerView: false });

  await page.getByRole('button', { name: /Worker view/ }).click();
  expect(await view()).toMatchObject({ workerView: true });
  await expect(page.getByText(/arrow keys to look around/)).toBeVisible();

  // Looking around (drag) must not count as taking the camera, so Resume stays hidden.
  const box = (await page.locator('#canvas-host canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy - 30);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /Resume camera/ })).toBeHidden();

  await page.keyboard.press('Escape');
  expect(await view()).toMatchObject({ cameraMode: 'follow', workerView: false });

  // The seat works at every quality tier too.
  await page.getByRole('button', { name: /Worker view/ }).click();
  await page.getByRole('button', { name: /quality/i }).click();
  await page.getByRole('button', { name: /Exit Worker view/ }).click();
  expect(await view()).toMatchObject({ workerView: false });

  expect(errors).toEqual([]);
});

test('X-ray: switches on and off in several chapters and at low quality, labelling floors and listing the five latencies', async ({ page }) => {
  test.setTimeout(SLOW_TEST_MS);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const xrayState = () =>
    page.evaluate(() => (window as unknown as { __cpu: { view(): { xray: boolean } } }).__cpu.view().xray);
  // The expected figures come from the same table the app reads, formatted the way the page shows them.
  const expected = RUNGS.map((r) => formatCycles(r.cycles));

  await page.goto('/?lowq&debug#chapter-3');
  await expect(page.locator('#canvas-host canvas')).toBeVisible();
  const toggle = page.getByRole('button', { name: /X-ray/ });

  for (const chapter of [3, 6, 7]) {
    // Jump by address, the way a learner would; every reload of the 3D page costs seconds on a software GPU.
    if (chapter !== 3) await page.evaluate((c) => (location.hash = `#chapter-${c}`), chapter);
    await expect(page.locator('.chapter-title').last()).toContainText(`Chapter ${chapter}`);
    await expect(page.locator('#scale-host')).toBeHidden();

    await toggle.click();
    expect(await xrayState()).toBe(true);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#scale-host')).toBeVisible();
    await expect(page.locator('.ladder-rungs .rung-cycles')).toHaveText(expected);

    await toggle.click();
    expect(await xrayState()).toBe(false);
    await expect(page.locator('#scale-host')).toBeHidden();
  }

  // Straight in via the URL, and alongside Worker view.
  await page.goto('/?lowq&debug&xray');
  await expect(page.locator('#scale-host')).toBeVisible();
  await page.getByRole('button', { name: /Worker view/ }).click();
  await expect(page.locator('#scale-host')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('live aids: the cycle meter ends chapter 6 on exactly the RAM latency, with the ladder showing the misses', async ({ page }) => {
  test.setTimeout(SLOW_TEST_MS);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const ram = RUNGS.find((r) => r.id === 'ram')!;
  type Ledger = { current: { served: string | null; done: boolean; cycles: number } | null };
  const ledger = () =>
    page.evaluate(() => (window as unknown as { __cpu: { ledger(): Ledger } }).__cpu.ledger().current);

  await page.goto('/?lowq&debug#chapter-6');
  await expect(page.locator('#canvas-host canvas')).toBeVisible();
  await expect(page.locator('#aids .aids')).toBeVisible();

  // Fast-forward the chapter with Next until the RAM access has been delivered.
  const next = page.locator('#btn-next');
  await expect
    .poll(
      async () => {
        await next.click();
        const j = await ledger();
        return j?.served === 'ram' && j.done;
      },
      { timeout: 60_000, intervals: [250] },
    )
    .toBe(true);

  expect((await ledger())!.cycles).toBe(ram.cycles);
  await expect(page.locator('.meter-value')).toHaveText(formatCycles(ram.cycles));
  await expect(page.locator('.meter')).toHaveAttribute('data-state', 'done');

  // The ladder shows the levels that missed, in the order they were checked, and RAM as the one that served.
  await page.getByRole('button', { name: /Aids/ }).click();
  const state = (rung: string) => page.locator(`.aids .ladder-rungs li[data-rung="${rung}"]`).getAttribute('data-state');
  expect(await state('l1')).toBe('checked-miss');
  expect(await state('l2')).toBe('checked-miss');
  expect(await state('ram')).toBe('served');
  expect(await state('disk')).toBe('idle');

  expect(errors).toEqual([]);
});
