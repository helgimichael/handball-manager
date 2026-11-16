import { test, expect } from '@playwright/test';
import { enterCareerAfterLoad, newGameToManagerStep, playToEnd, readyStartMatch, setMatchSpeed } from './matchPrep';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.env.HM_QA_URL ?? 'http://127.0.0.1:3015';
const evidence = resolve('../../docs/match-center-v21/verification');
test.use({ storageState: process.env.HM_QA_STORAGE });
test('normal career: live decisions, halftime, save/load and four match review views', async ({ page }) => {
    test.setTimeout(600000);
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(120000);
    mkdirSync(`${evidence}/screenshots`, { recursive: true });
    const errors: string[] = [], measurements: unknown[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    // The Match Center's own views. On the match report they sit inside the Repris tab, next to the report's
    // own tablist ("Rapportens delar", which also has a "Statistik" tab), so the lookup is scoped to "Matchvy".
    const tab = (name: string) => page.getByRole('tablist', { name: 'Matchvy', exact: true }).getByRole('tab', { name, exact: true });
    if (process.env.HM_QA_REVIEW) {
        await page.goto(JSON.parse(readFileSync(`${evidence}/review-resume.json`, 'utf8')).url);
    } else {
    await page.goto(`${base}/new-game`);
    await newGameToManagerStep(page);
    await page.getByPlaceholder('För- och efternamn').fill('Match Center v21 QA');
    await page.getByRole('combobox', { name: 'Nationalitet', exact: true }).selectOption('SWE');
    await page.getByRole('textbox', { name: 'Födelsedatum', exact: true }).fill('1985-04-12');
    await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
    await page.getByRole('radio', { name: 'Vid första tävlingsmatchen', exact: true }).check();
    await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
    await page.waitForURL('**/career', { timeout: 90000 });
    await enterCareerAfterLoad(page);
    await expect(page.locator('.game-home')).toBeVisible({ timeout: 120000 });
    await page.goto(`${base}/career/match-preview`);
    for (let i = 0; i < 30; i++) {
        if (await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).isVisible()) break;
        await page.locator('.hm-continue-header').click();
        await expect(page.locator('.game-world-advance')).toHaveCount(0);
        await page.goto(`${base}/career/match-preview`);
    }
    await readyStartMatch(page, base);
    await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).click();
    await page.waitForURL('**/career/match-day/**');
    await expect(tab('Översikt')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.mc-shot-map')).toHaveCount(0);
    await expect(page.locator('.mc-coach')).toBeVisible();
    await setMatchSpeed(page, 'Turbo 64×');
    await page.getByRole('button', { name: 'Spela', exact: true }).click();
    // Live overview (MDY-02c): the commentary feed fills as the match is played.
    await expect(page.locator('.mc-commentary li').first()).toBeVisible({ timeout: 60000 });
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
    await setMatchSpeed(page, 'Turbo 64×');
    await page.getByRole('button', { name: 'Återuppta efter timeout', exact: true }).click();
    // Play stops at every team time-out (the opponent's too) until the manager resumes it -- the product's rule.
    await expect(async () => {
      const resume = page.getByRole('button', { name: 'Återuppta efter timeout', exact: true });
      if (await resume.isVisible()) await resume.click();
      await expect(page.getByRole('button', { name: 'Starta andra halvlek', exact: true })).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 180000 });
    await expect(tab('Översikt')).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `${evidence}/screenshots/halftime-1920.png`, fullPage: true });
    await page.getByRole('button', { name: 'Starta andra halvlek', exact: true }).click();
    await playToEnd(page);
    await page.waitForURL('**/career/match-report/**', { timeout: 180000 });
    // Optional resume aid for HM_QA_REVIEW. With full match archives in IndexedDB the dump can exceed Node's
    // maximum string length (RangeError); that is a harness limit, not a product failure, so it is best-effort.
    await page.context().storageState({ path: `${evidence}/review-storage.json`, indexedDB: true }).catch((e: Error) => console.warn(`resume dump skipped: ${e.message}`));
    writeFileSync(`${evidence}/review-resume.json`, JSON.stringify({ url: page.url(), normalCareer: true, liveDecisions: true, saveLoadTimeout: true, halftime: true }));
    }
    // ANL-01/MDY-04: the report no longer embeds the archived Match Center's 'Översikt'; the report header is the
    // match summary and the Match Center's review views live behind its Repris tab (without 'Översikt').
    await page.getByRole('tablist', { name: 'Rapportens delar', exact: true }).getByRole('tab', { name: 'Repris', exact: true }).click();
    await expect(page).toHaveURL(/#repris$/);
    await expect(page.locator('#rp-panel-REPRIS .mc-workspace')).toBeVisible({ timeout: 60000 });
    await expect(tab('Översikt')).toHaveCount(0);
    await expect(tab('Nyckelögonblick')).toHaveAttribute('aria-selected', 'true');
    const score = await page.locator('.rp-score .rp-num').innerText();
    const overview = await page.locator('.rp-head').innerText();
    await expect(page.locator('.mc-coach')).toHaveCount(0);
    for (const width of [1366, 1440, 1920, 2560]) {
        await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
        await tab('Nyckelögonblick').click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const bounds = await page.locator('.mc-workspace').boundingBox();
        measurements.push({ width, workspaceHeight: bounds?.height, viewportHeight: width === 1366 ? 768 : 1080 });
        await page.screenshot({ path: `${evidence}/screenshots/fulltime-overview-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    // The overview's "Händelser att återvända till" previews are gone with 'Översikt'; the same key moments are
    // opened from the Nyckelögonblick list.
    const firstPreview = page.locator('.mc-moment-list li button').first();
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
    await expect(page.locator('.mc-moment-list li').first()).toContainText(/mål/i); // goals include 7 m goals ('7m-mål')
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
        for (const label of ['Nyckelögonblick', 'Spelare', 'Statistik', 'Plan']) {
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
    await expect(tab('Nyckelögonblick')).toBeFocused();
    await tab('Nyckelögonblick').press('ArrowRight');
    await expect(tab('Spelare')).toBeFocused();
    await expect(tab('Spelare')).toHaveAttribute('aria-selected', 'true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('.mc-view-panel').evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0s');
    await page.getByRole('button', { name: 'Spara', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sparat' })).toBeVisible();
    await page.reload();
    await expect(page.locator('.rp-score .rp-num')).toHaveText(score);
    await expect(page.locator('.rp-head')).toHaveText(overview, { useInnerText: true });
    await expect(page.locator('#rp-panel-REPRIS .mc-workspace')).toBeVisible({ timeout: 60000 });
    expect(errors).toEqual([]);
    writeFileSync(`${evidence}/BROWSER-QA.json`, JSON.stringify({ url: base, normalCareer: true, liveDecisions: true, halftime: true, saveLoad: true, keyboard: true, reducedMotion: true, score, overview, widths: measurements, switchSamples: switches, pageErrors: errors, humanQA: 'PENDING', reviewResumedFromOwnNormalCareer: !!process.env.HM_QA_REVIEW }, null, 2));
});
