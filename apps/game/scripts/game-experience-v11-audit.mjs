import { chromium, expect } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Capture the actual UI before/after changes without reading or modifying saves.
const base = process.env.HM_QA_URL ?? 'http://localhost:3006';
const phase = process.env.HM_VISUAL_PHASE ?? 'before';
const resume = process.env.HM_AUDIT_RESUME === '1';
const output = path.resolve('../../docs/game-experience/v1.1', phase);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.setDefaultTimeout(30000);
const errors = [], captures = [];
page.on('pageerror', error => errors.push(error.message));

async function capture(name) {
  for (const width of [1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    const dir = path.join(output, String(width)); mkdirSync(dir, { recursive: true });
    const filename = path.join(dir, `${name}.png`);
    if (!(phase === 'before' && existsSync(filename))) await page.screenshot({ path: filename, animations: 'disabled' });
    const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    captures.push({ name, route: new URL(page.url()).pathname, ...layout });
    console.log(`${name} ${width}: ${layout.documentWidth}px`);
  }
}
async function wizard(captureSteps, firstMatch) {
  await page.goto(`${base}/new-game`);
  for (let step = 0; step < 4; step++) {
    if (captureSteps) await capture(['new-game', 'leagues', 'database', 'club-selection'][step]);
    await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  }
  await page.getByPlaceholder('För- och efternamn').fill('Game Experience QA');
  if (captureSteps) await capture('manager');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: firstMatch ? 'Vid första tävlingsmatchen' : '8 veckor före seriestart', exact: true }).check();
  if (captureSteps) await capture('start-career');
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await page.waitForURL('**/career', { timeout: 90000 });
  await expect(page.locator('.game-home')).toBeVisible({ timeout: 90000 });
}
try {
  if (!resume) {
    await page.goto(base); await capture('title');
    await page.goto(`${base}/load-game`); await expect(page.getByRole('heading').first()).toBeVisible(); await capture('load-game-empty');
  }
  await wizard(!resume, false);
  const routes = [
    ['home',''], ['squad','squad'], ['tactics','tactics'], ['inbox','inbox'], ['contracts','contracts'],
    ['training','training'], ['calendar','calendar'], ['schedule','schedule'], ['matches','matches'],
    ['analysis','analysis'], ['analysis-opponent','analysis/opponent'], ['analysis-team','analysis/our-team'], ['analysis-last-match','analysis/last-match'],
    ['players','players'], ['scouting','scouting'], ['recruitment','recruitment'], ['transfers','transfers'],
    ['staff','staff'], ['staff-recruitment','staff/recruitment'], ['medical','medical'], ['club','club'],
    ['partnerships','club/partnerships'], ['competition','competitions'], ['statistics','statistics'], ['history','history'], ['preview','match-preview'],
  ];
  for (const [name, route] of routes) {
    if (resume && existsSync(path.join(output, '1920', `${name}.png`)) && existsSync(path.join(output, '2560', `${name}.png`))) continue;
    await page.goto(`${base}/career${route ? `/${route}` : ''}`);
    await expect(page.locator('.hm-shell')).toBeVisible({ timeout: 90000 });
    await expect(page.locator('.hm-club-name')).toContainText('Tumba', { timeout: 90000 });
    if (name === 'inbox') await page.getByRole('button', { name: /Kontraktsplanering:/ }).first().click();
    await capture(name);
  }
  await page.goto(`${base}/load-game`); await expect(page.getByRole('heading').first()).toBeVisible(); await capture('load-game');
  await page.goto(`${base}/career`); await expect(page.locator('.game-home')).toBeVisible({ timeout: 90000 });
  // Hold only the UI reveal timers so both viewport captures show the same
  // already-generated Continue outcome. No career state is injected.
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.getByRole('button', { name: 'Fortsätt »', exact: true }).click();
  const advance = phase === 'before' ? page.getByText('Bearbetar säsongen…', { exact: true }) : page.locator('.game-world-advance');
  await expect(advance).toBeVisible();
  await capture('world-advance');
  const skip = page.getByRole('button', { name: /HOPPA ÖVER|Visa händelsen|Gå till händelsen/i }).first();
  if (await skip.isVisible()) await skip.click();
  await page.clock.resume();
  await expect(advance).toHaveCount(0, { timeout: 30000 });
  await capture('continue-destination');
  await wizard(false, true);
  await page.goto(`${base}/career/match-preview`);
  for (let step = 0; step < 30 && !(await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).isVisible()); step++) {
    await page.getByRole('button', { name: 'Fortsätt »', exact: true }).click();
    const skip = page.getByRole('button', { name: /HOPPA ÖVER|Visa händelsen|Gå till händelsen/i }).first();
    if (await skip.isVisible()) await skip.click();
    await expect(page.getByRole('button', { name: 'Fortsätt »', exact: true })).toBeEnabled({ timeout: 30000 });
    await page.goto(`${base}/career/match-preview`);
  }
  await capture('matchday-preview');
  await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).click();
  await page.waitForURL('**/career/match-day/**');
  await expect(page.getByRole('button', { name: 'Spela', exact: true })).toBeVisible();
  await capture('live-controls');
  await page.getByRole('button', { name: 'Spela till slut', exact: true }).click();
  await page.waitForURL('**/career/match-report/**', { timeout: 180000 });
  await expect(page.getByText('Speltid och belastning', { exact: true })).toBeVisible({ timeout: 30000 });
  await capture('post-match');
  await page.goto(`${base}/career/analysis/last-match`);
  await expect(page.locator('main h1, main .hm-panel-title').first()).toBeVisible({ timeout: 30000 });
  await capture('analysis-played-match');
  writeFileSync(path.join(output, 'capture.json'), JSON.stringify({ base, phase, captures, errors }, null, 2));
  console.log(`Captured ${captures.length} rendered states; ${errors.length} page errors.`);
} finally {
  writeFileSync(path.join(output, 'capture.json'), JSON.stringify({ base, phase, resume, captures, errors }, null, 2));
  await browser.close();
}
