import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.env.HM_QA_URL ?? 'http://127.0.0.1:3016';
const evidence = resolve('../../docs/post-intelligence-reconciliation/verification/browser');
const instruments: { errors: string[]; console: string[]; failedRequests: string[]; badResponses: string[] } = { errors: [], console: [], failedRequests: [], badResponses: [] };
test.afterEach(async ({ page }, info) => {
    writeFileSync(`${evidence}/INSTRUMENTS.json`, JSON.stringify({ status: info.status, url: page.url(), ...instruments }, null, 2));
    if (info.status !== info.expectedStatus) {
        await page.context().storageState({ path: `${evidence}/failed-own-career.json`, indexedDB: true });
        await page.screenshot({ path: `${evidence}/failed.png`, fullPage: true });
    }
});
test.use({ storageState: process.env.HM_QA_STORAGE });
test('normal career: live decisions, halftime, save/load and four match review views', async ({ page }) => {
    test.setTimeout(600000);
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(120000);
    mkdirSync(`${evidence}/screenshots`, { recursive: true });
    const errors: string[] = [], measurements: unknown[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('pageerror', e => instruments.errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') instruments.console.push(e.text()); });
    page.on('requestfailed', r => instruments.failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) instruments.badResponses.push(`${r.status()} ${r.url()}`); });
    await page.setViewportSize({ width: 1920, height: 1080 });
    const tab = (name: string) => page.getByRole('tab', { name, exact: true });
    if (process.env.HM_QA_REVIEW) {
        await page.goto(JSON.parse(readFileSync(`${evidence}/review-resume.json`, 'utf8')).url);
    } else {
    await page.goto(`${base}/new-game`);
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
    await page.getByPlaceholder('För- och efternamn').fill('Reconciliation QA');
    await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
    await page.getByRole('radio', { name: 'Vid första tävlingsmatchen', exact: true }).check();
    await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
    await page.waitForURL('**/career', { timeout: 90000 });
    await expect(page.locator('.game-home')).toBeVisible({ timeout: 120000 });
    await page.goto(`${base}/career/match-preview`);
    for (let i = 0; i < 30; i++) {
        if (await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).isVisible()) break;
        await page.getByRole('button', { name: 'Fortsätt »', exact: true }).click();
        await expect(page.locator('.game-world-advance')).toHaveCount(0);
        await page.goto(`${base}/career/match-preview`);
    }
    await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).click();
    await page.waitForURL('**/career/match-day/**');
    await expect(tab('Översikt')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.mc-shot-map')).toHaveCount(0);
    await expect(page.locator('.mc-coach')).toBeVisible();
    await page.getByLabel('Matchhastighet').selectOption('64');
    await page.getByRole('button', { name: 'Spela', exact: true }).click();
    await expect(page.locator('.mc-preview>div>button').first()).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Pausa', exact: true }).click();
    await tab('Spelare').click();
    await expect(page.locator('.mc-performance tbody tr').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anfall Bredd', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Anfall Bredd', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Anfall Bredd', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /^Byt ut / }).first().click();
    await page.getByRole('button', { name: /^Byt in / }).first().click();
    await page.getByRole('button', { name: 'Genomför byte', exact: true }).click();
    await expect(page.locator('.coach-pending-exchange')).toBeVisible();
    await page.getByRole('button', { name: 'Spela', exact: true }).click();
    const timeout = page.getByRole('button', { name: 'Timeout', exact: true });
    await expect(timeout).toBeEnabled({ timeout: 60000 });
    await timeout.click();
    await expect(page.locator('.coach-timeout[data-active="true"]')).toBeVisible();
    await expect(tab('Översikt')).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `${evidence}/screenshots/live-timeout-1920.png`, fullPage: true });
    await page.getByRole('button', { name: 'Spara', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sparat' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Återuppta efter timeout', exact: true })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('button', { name: 'Anfall Bredd', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Matchhastighet').selectOption('64');
    await page.getByRole('button', { name: 'Återuppta efter timeout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Starta andra halvlek', exact: true })).toBeVisible({ timeout: 180000 });
    await expect(tab('Översikt')).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `${evidence}/screenshots/halftime-1920.png`, fullPage: true });
    await page.getByRole('button', { name: 'Starta andra halvlek', exact: true }).click();
    await page.getByRole('button', { name: 'Spela till slut', exact: true }).click();
    await page.waitForURL('**/career/match-report/**', { timeout: 180000 });
    writeFileSync(`${evidence}/review-resume.json`, JSON.stringify({ url: page.url(), normalCareer: true, liveDecisions: true, saveLoadTimeout: true, halftime: true }));
    }
    await expect(tab('Översikt')).toHaveAttribute('aria-selected', 'true');
    const score = await page.locator('.mc-score>strong').innerText();
    const overview = await page.locator('.mc-summary').innerText();
    await expect(page.locator('.mc-coach')).toHaveCount(0);
    for (const width of [1366, 1440, 1920, 2560]) {
        await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
        await tab('Översikt').click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const bounds = await page.locator('.mc-workspace').boundingBox();
        measurements.push({ width, workspaceHeight: bounds?.height, viewportHeight: width === 1366 ? 768 : 1080 });
        await page.screenshot({ path: `${evidence}/screenshots/fulltime-overview-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    const firstPreview = page.locator('.mc-preview>div>button').first();
    const selectedHeadline = await firstPreview.locator('strong').innerText();
    await firstPreview.click();
    await expect(tab('Nyckelögonblick')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.mc-key-moment h2')).toHaveText(selectedHeadline);
    await expect(page.locator('.mc-tactical svg')).toBeVisible();
    await page.locator('.mc-step-controls button').last().click();
    await page.screenshot({ path: `${evidence}/screenshots/key-moment-1920.png`, fullPage: true });
    await page.getByRole('button', { name: 'Visa helplan', exact: true }).click();
    await expect(page.locator('.mc-tactical svg')).toHaveAttribute('viewBox', '-1 -1 42 22');
    await page.screenshot({ path: `${evidence}/screenshots/key-moment-full-court-1920.png`, fullPage: true });
    await page.getByRole('button', { name: 'Mål', exact: true }).click();
    await expect(page.locator('.mc-moment-list li').first()).toContainText('Mål');
    await page.locator('.mc-event-review summary').click();
    await expect(page.locator('.mc-commentary')).toBeVisible();
    await tab('Spelare').click();
    await page.getByLabel('Sortera').selectOption('RATING');
    await page.locator('.mc-performance tbody th button').first().click();
    await expect(page.locator('.mc-dossier h2')).not.toHaveText('Välj en spelare');
    await page.screenshot({ path: `${evidence}/screenshots/players-1920.png`, fullPage: true });
    await page.getByRole('button', { name: 'Borta', exact: true }).click();
    await page.getByLabel('Sortera').selectOption('POSITION');
    await page.locator('.mc-performance tbody th button').first().click();
    await expect(page.locator('.mc-dossier')).toContainText('Målvaktens match');
    await page.screenshot({ path: `${evidence}/screenshots/keeper-detail-1920.png`, fullPage: true });
    await tab('Statistik').click();
    await page.getByRole('button', { name: 'Avslut', exact: true }).click();
    await page.getByLabel('Lag', { exact: true }).selectOption('AWAY');
    await page.getByLabel('Utfall', { exact: true }).selectOption('GOAL');
    await expect(page.locator('.mc-shot-map')).toBeVisible();
    await page.screenshot({ path: `${evidence}/screenshots/statistics-shots-1920.png`, fullPage: true });
    await page.getByRole('button', { name: 'Målvakter', exact: true }).click();
    await expect(page.locator('.mc-keepers article').first()).toBeVisible();
    for (const width of [1366, 1440, 2560]) {
        await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
        for (const name of ['Nyckelögonblick', 'Spelare', 'Statistik']) {
            await tab(name).click();
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await page.screenshot({ path: `${evidence}/screenshots/view-${width}-${name === 'Spelare' ? 'players' : name === 'Statistik' ? 'stats' : 'moments'}.png`, fullPage: true });
        }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    const switches = await page.evaluate(async () => {
        const samples = [];
        for (const label of ['Översikt', 'Nyckelögonblick', 'Spelare', 'Statistik']) {
            const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.mc-workspace-nav [role="tab"]')).find(b => b.textContent === label)!;
            const start = performance.now(); button.click();
            await new Promise(requestAnimationFrame);
            const selected = document.querySelector('.mc-workspace-nav [aria-selected="true"]')?.textContent;
            if (selected !== label) throw Error(`View did not update: ${label}`);
            samples.push({ view: label, selected, clickToNextFrameMs: performance.now() - start });
        }
        return samples;
    });
    await tab('Statistik').focus();
    await tab('Statistik').press('Home');
    await expect(tab('Översikt')).toBeFocused();
    await tab('Översikt').press('ArrowRight');
    await expect(tab('Nyckelögonblick')).toBeFocused();
    await expect(tab('Nyckelögonblick')).toHaveAttribute('aria-selected', 'true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('.mc-view-panel').evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0s');
    await page.getByRole('button', { name: 'Spara', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sparat' })).toBeVisible();
    await page.reload();
    await expect(page.locator('.mc-score>strong')).toHaveText(score);
    await expect(page.locator('.mc-summary')).toHaveText(overview, { useInnerText: true });
    expect(errors).toEqual([]);
    // Export only after the archived report and its persisted save have settled.
    // Review continuations reuse their own completed match without exporting it again.
    if (!process.env.HM_QA_REVIEW) await page.context().storageState({ path: `${evidence}/review-storage.json`, indexedDB: true });
    writeFileSync(`${evidence}/BROWSER-QA.json`, JSON.stringify({ url: base, normalCareer: true, liveDecisions: true, halftime: true, saveLoad: true, keyboard: true, reducedMotion: true, score, overview, widths: measurements, switchSamples: switches, pageErrors: errors, humanQA: 'PENDING', reviewResumedFromOwnNormalCareer: !!process.env.HM_QA_REVIEW }, null, 2));
});
