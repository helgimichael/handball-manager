// Arena Nights Phase 2 -- the complete manager journey through the new experience, on a real career with a
// real native V2 match (no mocked result): existing career -> six hubs -> palette -> Week Spine -> front page ->
// squad -> player dossier -> tactical board -> matchday ritual -> live match -> final whistle -> report ->
// back home; then the same surfaces at phone width. Screenshots and match evidence go to HM_QA_SCREENSHOT_DIR.
import { test, expect as baseExpect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const expect = baseExpect.configure({ timeout: 30000 });
const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const shots = process.env.HM_QA_SCREENSHOT_DIR ?? '../../docs/club-identity/phase2-screenshots';
mkdirSync(shots, { recursive: true });

const HUBS: [string, RegExp][] = [['Idag', /\/career$/], ['Laget', /\/career\/squad$/], ['Klubben', /\/career\/klubbhuset$/], ['Rekrytering', /\/career\/recruitment$/], ['Tävling', /\/career\/season$/], ['Karriär', /\/career\/manager$/]];
const rail = (page: Page) => page.getByRole('navigation', { name: 'Hubbar', exact: true });
async function noOverflow(page: Page, label: string) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, overlay: !!document.querySelector('nextjs-portal')?.shadowRoot?.querySelector('[data-nextjs-dialog]') }));
  expect(r.sw, `${label}: no horizontal overflow`).toBeLessThanOrEqual(r.w);
  expect(r.overlay, `${label}: no error overlay`).toBe(false);
}
async function shell(page: Page) { await expect(page.locator('.hm-shell #manager-content')).toBeVisible({ timeout: 90000 }); }

test('arena journey: existing career to a completed native V2 match and back, desktop and phone', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });

  // Setup: a fresh career (starts at the first competitive match), then re-entered from the title screen.
  await page.goto(`${base}/new-game`);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByPlaceholder('För- och efternamn').fill('Arena Journey');
  await page.getByRole('combobox', { name: 'Nationalitet', exact: true }).selectOption('SWE');
  await page.getByRole('textbox', { name: 'Födelsedatum', exact: true }).fill('1985-04-12');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: 'Vid första tävlingsmatchen', exact: true }).check();
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await page.waitForURL('**/career', { timeout: 120000 });
  await shell(page);

  // 1. Opening an existing career.
  await page.goto(`${base}/`);
  await page.getByRole('link', { name: /FORTSÄTT/ }).or(page.getByRole('button', { name: /FORTSÄTT/ })).first().click();
  await page.waitForURL('**/career', { timeout: 90000 });
  await shell(page);

  // 2. All six hubs, each with its contextual tab row.
  for (const [hub, url] of HUBS) {
    await rail(page).getByRole('link', { name: hub, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('navigation', { name: `${hub}: flikar`, exact: true })).toBeVisible();
    await expect(rail(page).getByRole('link', { name: hub, exact: true })).toHaveAttribute('aria-current', 'page');
  }

  // 3. Command palette (Ctrl+K), keyboard to a page.
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Sök och gå till' });
  await expect(palette).toBeVisible();
  await page.keyboard.type('Taktik');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/career\/tactics$/);
  await expect(palette).toHaveCount(0);

  // 4-5. Week Spine and the Matchweek Front Page.
  await rail(page).getByRole('link', { name: 'Idag', exact: true }).click();
  await expect(page.locator('.hm-spine-day')).toHaveCount(7);
  await expect(page.locator('.hm-spine-day[data-today="true"]')).toHaveCount(1);
  await expect(page.locator('.hm-front-lead h2')).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Att avgöra', exact: true })).toBeVisible();
  await page.screenshot({ path: `${shots}/01-front-page-desktop.png` });

  // 6-7. Squad Matrix -> player dossier and its history chapters.
  await rail(page).getByRole('link', { name: 'Laget', exact: true }).click();
  await page.locator('.hm-matrix-table tbody .hm-chip-name a').first().click();
  await expect(page.locator('.hm-dossier-bar')).toBeVisible();
  await page.screenshot({ path: `${shots}/02-player-overview-desktop.png` });
  for (const [tab, heading] of [['Utveckling', 'Utveckling över tid'], ['Matcher', 'Prestationskurva'], ['Karriär', 'Karriären'], ['Kontrakt & framtid', 'Kontrakt & framtid']] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
  }
  await page.screenshot({ path: `${shots}/03-player-career-desktop.png` });

  // 8-9. Tactical board and its views.
  await page.getByRole('navigation', { name: 'Laget: flikar', exact: true }).getByRole('link', { name: 'Taktik', exact: true }).click();
  await expect(page.getByRole('grid', { name: /Fas och numerär/ })).toBeVisible();
  if (await page.getByRole('button', { name: 'Assistentens förslag', exact: true }).isVisible()) await page.getByRole('button', { name: 'Assistentens förslag', exact: true }).click();
  await page.locator('button.tb-cell', { hasText: 'Försvar 6 mot 6' }).click();
  await expect(page.locator('.coach-lineup h2')).toContainText('Försvar 6 mot 6');
  await expect(page.locator('.tb-board-bar')).toHaveAttribute('data-phase', 'DEFENCE');
  await page.screenshot({ path: `${shots}/04-tactics-defence-desktop.png` });
  await page.locator('button.tb-cell', { hasText: 'Anfall 6 mot 6' }).click();
  await expect(page.locator('.tb-board-bar')).toHaveAttribute('data-phase', 'ATTACK');

  // 10. Matchday preview: advance with Continue until the match can start.
  const start = page.getByRole('button', { name: 'STARTA MATCH →', exact: true });
  for (let n = 0; n < 40; n++) {
    await page.goto(`${base}/career/match-preview`);
    await shell(page);
    if (await start.isVisible() && await start.isEnabled()) break;
    await page.locator('.hm-continue-header').click();
    await expect(page.locator('.game-world-advance')).toHaveCount(0, { timeout: 60000 });
    if (/\/career\/tactics/.test(page.url()) && await page.getByRole('button', { name: 'Assistentens förslag', exact: true }).isVisible()) await page.getByRole('button', { name: 'Assistentens förslag', exact: true }).click();
  }
  await expect(page.locator('.md-ritual li')).toHaveCount(3);
  await expect(page.locator('.md-court-spots li')).toHaveCount(7);
  await page.screenshot({ path: `${shots}/05-matchday-preview-desktop.png`, fullPage: true });
  const startState = await page.evaluate(() => ({ date: document.querySelector('.hm-header-sub')?.textContent, headline: document.querySelector('.mday-stage h2')?.textContent }));

  // 11-13. Live native V2 match to full time.
  await start.click();
  const confirm = page.getByRole('button', { name: 'Starta matchen', exact: true });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForURL('**/career/match-day/**');
  await expect(page.locator('.hm-shell')).toHaveAttribute('data-route', 'live-match');
  await expect(page.locator('.hm-spine')).toHaveCount(0);
  await expect(page.locator('.hm-continue-header')).toBeDisabled();
  await page.screenshot({ path: `${shots}/06-live-match-desktop.png` });
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect(page.locator('.mc-match')).toHaveAttribute('data-phase', /live|paused|halftime|timeout/);
  const finishBtn = page.getByRole('button', { name: 'Slutför match och öppna rapport', exact: true });
  // "Spela till slut" plays the rest of the native V2 match (both halves) and finalises it, landing on the report;
  // a manually played match ends on the live page with the final-whistle card and the finish button instead.
  await page.getByRole('button', { name: 'Spela till slut', exact: true }).click();
  await Promise.race([finishBtn.waitFor({ timeout: 900000 }), page.waitForURL('**/career/match-report/**', { timeout: 900000 })]);
  await expect(page.locator('.mc-final-whistle')).toBeVisible({ timeout: 90000 });
  const finalScore = (await page.locator('.mc-final-score strong').first().innerText()).replace(/\s/g, '');
  await page.screenshot({ path: `${shots}/07-final-whistle-desktop.png` });
  const finalTag = await page.locator('.mc-final-tag').first().innerText();
  if (await finishBtn.isVisible()) await finishBtn.click();

  // 14. Match report, and save/load integrity of the result.
  await page.waitForURL('**/career/match-report/**', { timeout: 60000 });
  await expect(page.locator('.md-report-head h2')).toBeVisible();
  const reportHeadline = (await page.locator('.md-report-head h2').textContent()) ?? '';
  expect(reportHeadline.replace(/\s/g, '')).toContain(finalScore);
  await page.screenshot({ path: `${shots}/08-match-report-desktop.png` });
  const reportUrl = page.url();
  await page.reload();
  await expect(page.locator('.md-report-head h2')).toHaveText(reportHeadline, { timeout: 90000 });

  // 15. Back to the manager home: the result leads the front page.
  await rail(page).getByRole('link', { name: 'Idag', exact: true }).click();
  await expect(page.locator('.hm-front-lead')).toHaveAttribute('data-kind', 'RESULT');
  await expect(page.locator('.hm-front-lead h2')).toContainText(finalScore);
  // The final-whistle verdict (manager's side) must agree with the front page's verdict, computed from the career.
  const kicker = await page.locator('.hm-front-kicker').innerText();
  expect(finalTag.toLowerCase()).toContain(kicker.split('·')[0]!.trim().toLowerCase());
  writeFileSync(`${shots}/live-match-evidence.json`, JSON.stringify({ startState, finalScore, finalTag, reportHeadline, reportUrl, frontLead: await page.locator('.hm-front-lead h2').innerText(), errors }, null, 2));

  // Desktop pages checked for overflow during the journey.
  await noOverflow(page, 'front page desktop');

  // Phone: the same surfaces at 375 px.
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [path, name] of [['/career', 'front'], ['/career/squad', 'squad'], ['/career/tactics', 'tactics'], [new URL(reportUrl).pathname, 'report']] as const) {
    await page.goto(`${base}${path}`);
    await shell(page);
    await page.waitForTimeout(800);
    await noOverflow(page, `${name} phone`);
    await expect(page.locator('.hm-mobile-dock')).toBeVisible();
    await page.screenshot({ path: `${shots}/09-${name}-phone.png` });
  }
  await page.locator('.hm-matrix-cards li a').first().click().catch(async () => { await page.goto(`${base}/career/squad`); await page.locator('.hm-matrix-cards li a').first().click(); });
  await expect(page.locator('.hm-dossier-bar')).toBeVisible();
  await noOverflow(page, 'player phone');
  await page.screenshot({ path: `${shots}/10-player-phone.png` });
  await page.getByRole('button', { name: 'Mer', exact: true }).click();
  await expect(page.locator('#hm-sidebar')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#hm-sidebar .hm-rail-sub a')).toHaveCount(26);
  expect(errors, 'no page errors').toEqual([]);
});
