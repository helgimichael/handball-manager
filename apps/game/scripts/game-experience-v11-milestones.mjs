import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Recorded-fixture UI QA, independent of the full season simulation regression.
// Each phase gets a fresh, nonpersistent Chromium context and a career created
// through the ordinary wizard. Only that context's single QA save is seeded.
// The source is the existing canonical season-end recording, used verbatim.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixturePath = path.resolve(repo, process.env.HM_SEASON_FIXTURE ?? 'docs/game-experience/regression/season-end-state.json');
const fixtureBytes = readFileSync(fixturePath);
const recorded = JSON.parse(fixtureBytes.toString('utf8'));
const fixtureHash = createHash('sha256').update(fixtureBytes).digest('hex');
const archiveIds = Object.keys(recorded.matchArchives ?? {});
if (!recorded.seasonComplete || recorded.seasonId !== '2026/27' || recorded.playerClubId !== 'swe2-tumba' || archiveIds.length !== 26) throw new Error('The canonical season-end recording does not match this QA scenario.');
const before = process.env.HM_QA_BEFORE_URL ?? 'http://localhost:3006';
const after = process.env.HM_QA_URL ?? 'http://localhost:3007';
const output = path.join(repo, 'docs/game-experience/v1.1');
const proof = { kind: 'recorded-fixture-ui-qa', source: path.relative(repo, fixturePath).replaceAll('\\', '/'), sourceSha256: fixtureHash, isolatedContexts: true, fabricatedCareerFacts: false, independentFullSeasonRegression: true, phases: [], errors: [] };
const browser = await chromium.launch({ headless: true });

async function createCareer(page, base, phase) {
  await page.goto(`${base}/new-game`);
  for (let step = 0; step < 4; step++) {
    if (step === 3) {
      if (phase === 'after') await page.getByRole('radio', { name: /IFK Tumba HK/ }).check();
      else await page.locator('table tbody tr').filter({ hasText: 'IFK Tumba HK' }).click();
    }
    await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  }
  await page.getByPlaceholder('För- och efternamn').fill(`Recorded Milestone QA ${phase}`);
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: 'Vid första tävlingsmatchen', exact: true }).check();
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await page.waitForURL('**/career', { timeout: 90000 });
  await expect(page.locator('.hm-club-name')).toContainText('Tumba', { timeout: 90000 });
  // Leave the career through its normal save action before seeding, so no
  // mounted CareerProvider or pending autosave can overwrite the recording.
  await page.getByRole('button', { name: 'Spara och avsluta', exact: true }).click();
  await expect(page.locator('.game-title')).toBeVisible({ timeout: 90000 });
}

async function seedSingleFreshSave(page) {
  return page.evaluate(async state => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('hm-game', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('saves', 'readwrite');
        const store = tx.objectStore('saves');
        const request = store.getAll();
        let metadata;
        request.onsuccess = () => {
          const records = request.result;
          if (records.length !== 1 || records[0].clubId !== state.playerClubId || !records[0].manager.name.startsWith('Recorded Milestone QA ')) {
            tx.abort(); reject(new Error('Refusing to seed anything except the single fresh QA career.')); return;
          }
          const envelope = records[0];
          store.put({ ...envelope, gameDate: state.gameDate, careerState: state });
          metadata = { saveId: envelope.saveId, manager: envelope.manager.name, schemaVersion: envelope.schemaVersion, saveRecords: records.length, seededSeason: state.seasonId, seededDate: state.gameDate };
        };
        tx.oncomplete = () => resolve(metadata);
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('The QA recording write was aborted.'));
      });
    } finally { db.close(); }
  }, recorded);
}

async function savedMetadata(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('hm-game', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const saves = await new Promise((resolve, reject) => {
        const request = db.transaction('saves', 'readonly').objectStore('saves').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (saves.length !== 1) throw new Error('The QA context no longer has exactly one save.');
      const state = saves[0].careerState;
      const historical = state.seasonHistory?.find(s => s.seasonId === '2026/27');
      return { saveRecords: saves.length, season: state.seasonId, complete: state.seasonComplete, date: state.gameDate, archiveIds: state.matchArchiveIds ?? Object.keys(state.matchArchives ?? {}), historicalSeason: historical?.seasonId, historicalClubPlayed: historical?.table.map(r => r.played), historicalPlayerStatistics: historical?.stats };
    } finally { db.close(); }
  });
}

async function capture(page, phase, name, phaseProof) {
  for (const width of [1920, 2560]) {
    await page.setViewportSize({ width, height: 1080 });
    const directory = path.join(output, phase, String(width));
    mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, `${name}-recorded.png`);
    await page.screenshot({ path: filename, animations: 'disabled' });
    const dimensions = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(width);
    phaseProof.captures.push({ name, source: 'canonical-recorded-fixture', path: path.relative(repo, filename).replaceAll('\\', '/'), route: new URL(page.url()).pathname, ...dimensions });
    console.log(`${phase} ${name} ${width}: ${dimensions.documentWidth}px`);
  }
}

try {
  for (const [phase, base] of [['before', before], ['after', after]]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => proof.errors.push({ phase, message: error.message }));
    const phaseProof = { phase, base, captures: [] };
    proof.phases.push(phaseProof);
    try {
      await createCareer(page, base, phase);
      phaseProof.freshSave = await seedSingleFreshSave(page);
      await page.goto(`${base}/career`);
      await expect(page.getByRole('button', { name: 'Börja nästa säsong →', exact: true })).toBeVisible({ timeout: 90000 });
      await expect(page.locator('.hm-header-title')).toContainText('2026/27');
      await capture(page, phase, 'season-complete', phaseProof);
      if (phase === 'after') {
        await page.getByRole('button', { name: 'Börja nästa säsong →', exact: true }).click();
        await expect(page.locator('.hm-header-title')).toContainText('2027/28');
        await expect(page.locator('.game-new-season-note')).toContainText('2026/27');
        await expect(page.getByRole('button', { name: 'Börja nästa säsong →', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Spara', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Sparat' })).toBeVisible({ timeout: 90000 });
        await page.reload();
        await expect(page.locator('.hm-header-title')).toContainText('2027/28', { timeout: 90000 });
        await expect(page.locator('.game-new-season-note')).toContainText('2026/27');
        await capture(page, phase, 'season-start', phaseProof);
        const stored = await savedMetadata(page);
        expect(stored.season).toBe('2027/28');
        expect(stored.complete).toBe(false);
        expect(stored.archiveIds.sort()).toEqual([...archiveIds].sort());
        expect(stored.historicalSeason).toBe('2026/27');
        expect(stored.historicalClubPlayed).toHaveLength(14);
        expect(stored.historicalClubPlayed.every(n => n === 26)).toBe(true);
        expect(stored.historicalPlayerStatistics).toEqual(recorded.playerSeasonStats);
        phaseProof.rollover = { season: stored.season, date: stored.date, archiveCount: stored.archiveIds.length, historicalSeason: stored.historicalSeason, historicalClubs: stored.historicalClubPlayed.length, eachHistoricalClubPlayed: 26, historicalPlayerStatisticsUnchanged: true, saveReloadPassed: true };
        await page.goto(`${base}/career/history?season=2026%2F27`);
        await expect(page.getByRole('heading', { name: 'Historik', exact: true })).toBeVisible({ timeout: 90000 });
        await expect(page.locator('main table').first().locator('tbody tr')).toHaveCount(14);
        const archivesSection = page.locator('section.hm-panel').filter({ has: page.getByRole('heading', { name: 'Spelade matcharkiv · hela karriären', exact: true }) });
        await expect(archivesSection.locator('tbody tr')).toHaveCount(26);
        await capture(page, phase, 'history-season', phaseProof);
      }
      phaseProof.complete = true;
    } finally { await context.close(); }
  }
  expect(proof.errors).toEqual([]);
  proof.complete = true;
  console.log('Recorded-fixture milestone UI QA passed; no user browser profiles or saves were used.');
} catch (cause) {
  proof.complete = false;
  proof.failure = cause instanceof Error ? cause.message : String(cause);
  throw cause;
} finally {
  mkdirSync(path.join(output, 'recorded-fixture'), { recursive: true });
  writeFileSync(path.join(output, 'recorded-fixture', 'milestones.json'), JSON.stringify(proof, null, 2));
  await browser.close();
}
