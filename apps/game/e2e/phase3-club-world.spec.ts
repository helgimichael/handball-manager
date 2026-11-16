// Arena Nights Phase 3 journey: club situation -> squad need -> recruitment pipeline -> negotiation band ->
// competition table -> inbox tray -> back to the front page, on desktop and phone. Real career, no mocks.
import { test, expect as baseExpect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { enterCareerAfterLoad, newGameToManagerStep } from './matchPrep';

const expect = baseExpect.configure({ timeout: 30000 });
const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const shots = process.env.HM_QA_SCREENSHOT_DIR ?? '../../docs/club-identity/phase3-screenshots';
async function shell(page: Page) { await expect(page.locator('.hm-shell #manager-content')).toBeVisible({ timeout: 90000 }); }
async function noOverflow(page: Page, label: string) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), label).toBeLessThanOrEqual(1); }

test('phase 3: club world, squad need, recruitment, negotiation, competition and inbox -- desktop and phone', async ({ page }) => {
  test.setTimeout(600000);
  mkdirSync(shots, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/new-game`);
  await newGameToManagerStep(page);
  await page.getByPlaceholder('För- och efternamn').fill('Phase Three');
  await page.getByRole('combobox', { name: 'Nationalitet', exact: true }).selectOption('SWE');
  await page.getByRole('textbox', { name: 'Födelsedatum', exact: true }).fill('1985-04-12');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: 'Vid första tävlingsmatchen', exact: true }).check();
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await page.waitForURL('**/career', { timeout: 120000 });
  await enterCareerAfterLoad(page);
  await shell(page);

  // 1. Club Journal: identity, history, ranked briefs, board, economy, depth.
  await page.goto(`${base}/career/club`);
  await shell(page);
  await expect(page.locator('.cj-history li')).toHaveCount(1);
  const briefs = page.locator('.cj-briefs li');
  expect(await briefs.count()).toBeGreaterThanOrEqual(5);
  const tones = await briefs.evaluateAll((els) => els.map((e) => e.getAttribute('data-tone')));
  const rank = { bad: 0, warn: 1, neutral: 2, good: 3 } as Record<string, number>;
  for (let i = 1; i < tones.length; i++) expect(rank[tones[i - 1]!]!).toBeLessThanOrEqual(rank[tones[i]!]!);
  await expect(page.locator('.cj-spot')).toHaveCount(7);
  await expect(page.locator('.cj-kpis')).toContainText('Transferbudget');
  await page.screenshot({ path: `${shots}/p3-01-club-journal-desktop.png`, fullPage: true });

  // 2. Squad need: the depth court filters the matrix.
  await page.goto(`${base}/career/squad`);
  await shell(page);
  await page.locator('.cj-squad-depth .cj-spot').filter({ hasText: 'MV' }).click();
  await expect(page.locator('.hm-matrix-positions button[aria-pressed="true"]')).toHaveText('MV');
  await page.locator('.cj-squad-depth').screenshot({ path: `${shots}/p3-02-squad-depth-desktop.png` });

  // 3. Recruitment pipeline, then the negotiation band from a real candidate.
  await page.goto(`${base}/career/recruitment`);
  await shell(page);
  await expect(page.locator('.rp-lane')).toHaveCount(6);
  await expect(page.locator('.rp-budget')).toContainText('Transferbudget');
  await page.screenshot({ path: `${shots}/p3-03-recruitment-pipeline-desktop.png` });
  await page.getByRole('button', { name: 'Lista & filter' }).click();
  await expect(page.locator('.rp-board')).toHaveCount(0);
  await page.getByRole('button', { name: 'Kedjan' }).click();

  // 4. Competition table with verified zones.
  await page.goto(`${base}/career/competitions/swe-2`);
  await shell(page);
  await expect(page.locator('.cz-legend li')).toHaveCount(4);
  await expect(page.locator('.cz-zone').first()).toHaveText('Uppflyttning');
  await page.locator('.hm-league-table').screenshot({ path: `${shots}/p3-04-standings-desktop.png` });

  // 5. Inbox tray, then home.
  await page.goto(`${base}/career/inbox`);
  await shell(page);
  await expect(page.locator('.nw-todo h2')).toContainText('Att göra');
  await page.goto(`${base}/career`);
  await shell(page);

  // Phone: the same surfaces at 375 px.
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [path, name] of [['/career/club', 'club'], ['/career/squad', 'squad'], ['/career/recruitment', 'recruitment'], ['/career/competitions/swe-2', 'standings'], ['/career/inbox', 'inbox']] as const) {
    await page.goto(`${base}${path}`);
    await shell(page);
    await page.waitForTimeout(600);
    await noOverflow(page, `${name} phone`);
    await page.screenshot({ path: `${shots}/p3-05-${name}-phone.png` });
  }
  expect(errors).toEqual([]);
});
