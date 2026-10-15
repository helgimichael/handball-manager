import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const baseline = process.env.HM_LOADING_BASELINE === '1';
const base = process.env.HM_QA_URL ?? 'http://127.0.0.1:3019';
const root = path.resolve('../../docs/career-loading-screen-v1');
const raw = path.join(root, 'verification');
const shots = path.join(root, 'screenshots');
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { mkdirSync(raw, { recursive: true }); mkdirSync(shots, { recursive: true }); });

async function setup(page: Page, club = 'Alingsås HK') {
  await page.goto(`${base}/new-game`);
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: club, exact: true }).check();
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nästa →', exact: true })).toBeDisabled();
  await page.getByPlaceholder('För- och efternamn').fill('Loading QA');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
}

async function saves(page: Page): Promise<any[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('hm-game');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('saves').objectStore('saves').getAll();
      read.onsuccess = () => { resolve(read.result); db.close(); };
      read.onerror = () => { reject(read.error); db.close(); };
    };
  }));
}

function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex'); }

test('real New Game: immediate feedback, duplicate guard, canonical save, success and refresh', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const NativeDate = Date;
    const instant = NativeDate.parse('2026-10-15T10:00:00.000Z');
    window.Date = new Proxy(NativeDate, {
      construct(target, args) { return Reflect.construct(target, args.length ? args : [instant]); },
      apply() { return new NativeDate(instant).toString(); },
      get(target, key) { return key === 'now' ? () => instant : Reflect.get(target, key); },
    });
    crypto.randomUUID = () => 'c2190000-0000-4000-8000-000000000001';
    (window as any).__careerNavigations = 0;
    const push = history.pushState;
    history.pushState = function(...args) {
      if (args[2] && new URL(String(args[2]), location.href).pathname === '/career') (window as any).__careerNavigations++;
      return push.apply(this, args);
    };
    const frames = { started: false, loading: 0, blank: 0 };
    (window as any).__initializationFrames = frames;
    function inspectFrame() {
      const loading = document.querySelector('.career-initialization');
      const ready = document.querySelector('.hm-shell');
      if (loading) { frames.started = true; frames.loading++; }
      if (frames.started && !loading && !ready) frames.blank++;
      if (!ready) requestAnimationFrame(inspectFrame);
    }
    requestAnimationFrame(inspectFrame);
  });
  const snapshots: Record<string, unknown> = baseline ? {} : JSON.parse(readFileSync(path.join(raw, 'baseline-snapshots.json'), 'utf8'));
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  let holding = !baseline;
  let firstSnapshot = true;
  await page.route('**/api/game-world/**', async route => {
    const key = new URL(route.request().url()).pathname + new URL(route.request().url()).search;
    if (holding && firstSnapshot) { firstSnapshot = false; await hold; }
    if (baseline) {
      const response = await route.fetch();
      snapshots[key] = await response.json();
      await route.fulfill({ response });
    } else {
      expect(snapshots).toHaveProperty(key);
      await route.fulfill({ json: snapshots[key] });
    }
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await setup(page);
  if (!baseline) {
    // Retain the actual button and invoke it repeatedly in one task: React state alone
    // cannot protect this boundary. Enter/Space also cannot submit the replaced setup.
    const immediate = await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).evaluate(button => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
      return document.querySelector('.career-initialization')?.textContent;
    });
    expect(immediate).toContain('BYGGER DIN HANDBOLLSVÄRLD…');
    expect(immediate).toContain('Alingsås HK');
    await expect(page.locator('.career-initialization')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Förbereder din nya karriär.');
    await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    await expect(page.getByRole('heading', { name: 'BYGGER DIN HANDBOLLSVÄRLD…', exact: true })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Din valda klubb' })).toContainText('Alingsås HK');
    await page.keyboard.press('Enter'); await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true })).toHaveCount(0);
    await page.waitForURL('**/career');
    await expect(page.locator('.career-initialization-club')).toContainText('Alingsås HK');
    const widths = [];
    for (const width of [1366, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1080 });
      await expect(page.locator('.career-initialization')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/\d+%/);
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await page.screenshot({ path: path.join(shots, `initialization-${width}.png`) });
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
        background: getComputedStyle(document.querySelector('.career-initialization')!).backgroundColor,
        scene: document.querySelector('.career-initialization-scene')!.getBoundingClientRect().toJSON() }));
      expect(geometry.document).toBeLessThanOrEqual(width); widths.push(geometry);
    }
    expect(await page.locator('.career-initialization-activity').evaluate(el => getComputedStyle(el).animationName)).toBe('career-initialization-turn');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('.career-initialization-activity').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await expect(page.getByRole('status')).toContainText('Förbereder din nya karriär.');
    await page.screenshot({ path: path.join(shots, 'reduced-motion.png') });
    writeFileSync(path.join(root, 'browser-layouts.json'), JSON.stringify(widths, null, 2));
    holding = false; release();
  } else await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();

  await page.waitForURL('**/career', { timeout: 90000 });
  await expect(page.locator('.hm-shell')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('main')).toContainText('Alingsås');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sparat' })).toBeVisible();
  const beforeRefresh = await saves(page);
  expect(beforeRefresh).toHaveLength(1);
  expect(beforeRefresh[0].clubId).toBe('se_club_alingsas_hk');
  expect(beforeRefresh[0].careerState.seasonId).toBe('2026/27');
  expect(beforeRefresh[0].careerState.fixtures.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__careerNavigations)).toBe(1);
  const name = baseline ? 'baseline' : 'after';
  writeFileSync(path.join(raw, `${name}-save.json`), JSON.stringify(beforeRefresh[0]));
  if (baseline) writeFileSync(path.join(raw, 'baseline-snapshots.json'), JSON.stringify(snapshots));
  else {
    const original = JSON.parse(readFileSync(path.join(raw, 'baseline-save.json'), 'utf8'));
    expect(beforeRefresh[0]).toEqual(original);
    const state = beforeRefresh[0].careerState;
    const proof = { baseline: '2f9fceb / isolated production server 3018', setup: { club: beforeRefresh[0].clubId, manager: beforeRefresh[0].manager, preseason: beforeRefresh[0].preseasonStart },
      seed: beforeRefresh[0].saveId, fixedClock: beforeRefresh[0].createdAt, snapshotRequests: Object.keys(snapshots).length,
      fullSaveSha256Before: digest(original), fullSaveSha256After: digest(beforeRefresh[0]), byteIdentical: JSON.stringify(original) === JSON.stringify(beforeRefresh[0]),
      schemaVersion: beforeRefresh[0].schemaVersion, fields: Object.fromEntries(['playerClubId','seasonId','worldSquads','gameplayRatings','fixtures','inbox','playerContracts','staffRoster'].map(key => [key, { before: digest(original.careerState[key]), after: digest(state[key]) }])) };
    writeFileSync(path.join(root, 'canonical-proof.json'), JSON.stringify(proof, null, 2));
    const frames = await page.evaluate(() => (window as any).__initializationFrames);
    expect(frames.loading).toBeGreaterThan(0);
    expect(frames.blank).toBe(0);
    writeFileSync(path.join(root, 'browser-flow.json'), JSON.stringify({ frames, saveCount: beforeRefresh.length, careerNavigations: 1, club: beforeRefresh[0].clubId, errors }, null, 2));
    await page.screenshot({ path: path.join(shots, 'career-success.png') });
  }
  await page.reload();
  await expect(page.locator('.hm-shell')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('main')).toContainText('Alingsås');
  const afterRefresh = await saves(page);
  expect(afterRefresh).toEqual(beforeRefresh);
  expect(errors).toEqual([]);
});

test('storage failure: safe focused recovery, no raw diagnostics and no resubmission', async ({ page }) => {
  test.skip(baseline);
  await page.addInitScript(() => { indexedDB.open = () => { throw new Error('PRIVATE-STACK-DO-NOT-SHOW'); }; });
  await setup(page, 'IFK Tumba HK');
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Något gick fel');
  await expect(page.getByRole('heading', { name: 'KUNDE INTE ÖPPNA KARRIÄREN', exact: true })).toBeFocused();
  await expect(page.locator('body')).not.toContainText('PRIVATE-STACK');
  await expect(page.locator('body')).not.toContainText('SavePersistenceError');
  await expect(page.getByRole('button', { name: /Försök igen|STARTA KARRIÄR/ })).toHaveCount(0);
  await page.screenshot({ path: path.join(shots, 'creation-failure.png') });
  await page.getByRole('button', { name: 'Till huvudmenyn →' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(base + '/');
});

test('provider failure after setup persisted: keep one save, recover through main menu', async ({ page }) => {
  test.skip(baseline);
  test.setTimeout(180000);
  // Fail only the initial world-state write, never user data. This context is disposable.
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value: any, key?: IDBValidKey) {
      if (this.name === 'saves' && value.careerState && !sessionStorage.getItem('hm-loading-fault-injected')) {
        sessionStorage.setItem('hm-loading-fault-injected', '1');
        throw new Error('PRIVATE-PROVIDER-FAILURE');
      }
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  });
  await setup(page, 'IFK Tumba HK');
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await page.waitForURL('**/career');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Något gick fel', { timeout: 120000 });
  await expect(page.locator('body')).not.toContainText('PRIVATE-PROVIDER-FAILURE');
  await expect(page.getByRole('heading', { name: 'KUNDE INTE ÖPPNA KARRIÄREN', exact: true })).toBeFocused();
  const records = await saves(page);
  expect(records).toHaveLength(1);
  expect(records[0].careerState).toBeUndefined();
  await page.screenshot({ path: path.join(shots, 'provider-failure.png') });
  await page.getByRole('button', { name: 'Till huvudmenyn →' }).click();
  await page.waitForURL(base + '/');
  expect(await saves(page)).toHaveLength(1);
  await page.getByRole('button', { name: /^FORTSÄTT/ }).click();
  await expect(page.locator('.hm-shell')).toBeVisible({ timeout: 120000 });
  const resumed = await saves(page);
  expect(resumed).toHaveLength(1);
  expect(resumed[0].saveId).toBe(records[0].saveId);
  expect(resumed[0].careerState.fixtures.length).toBeGreaterThan(0);
});

test('normal live New Game: no snapshot, clock or ID overrides; save and refresh work', async ({ page }) => {
  test.skip(baseline);
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 900 });
  await setup(page, 'IFK Tumba HK');
  const immediate = await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).evaluate(button => {
    (button as HTMLButtonElement).click();
    return document.querySelector('.career-initialization')?.textContent;
  });
  expect(immediate).toContain('BYGGER DIN HANDBOLLSVÄRLD…');
  expect(immediate).toContain('IFK Tumba HK');
  await expect(page.locator('.hm-shell')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('main')).toContainText('Tumba');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sparat' })).toBeVisible();
  const original = await saves(page);
  expect(original).toHaveLength(1);
  expect(original[0].careerState.fixtures.length).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(shots, 'career-live-success.png') });
  await page.reload();
  await expect(page.locator('.hm-shell')).toBeVisible({ timeout: 120000 });
  expect(await saves(page)).toEqual(original);
  expect(errors).toEqual([]);
  writeFileSync(path.join(root, 'browser-live-flow.json'), JSON.stringify({ liveSnapshots: true, clockOrIdOverrides: false,
    immediateAcknowledgement: true, saveCount: original.length, club: original[0].clubId,
    season: original[0].careerState.seasonId, schemaVersion: original[0].schemaVersion, savedAndRefreshedIdentically: true, errors }, null, 2));
});
