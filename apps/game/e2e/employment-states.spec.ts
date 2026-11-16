// Career employment states & club access control, end to end in the real UI (no mocks): a fresh career,
// a resignation through the Karriär page, and then everything a manager without a club can and cannot reach --
// hub rail, phone bar, direct URLs, browser history (stale routes), the command palette, keyboard hub keys,
// player profiles of the former squad, the former club's public portrait, a reload, and the phone layout.
import { test, expect as baseExpect, type Page } from '@playwright/test';
import { enterCareerAfterLoad, newGameToManagerStep } from './matchPrep';

const expect = baseExpect.configure({ timeout: 20000 });
const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const code = process.env.HM_QA_ALPHA_ACCESS_CODE?.trim() || 'HBL-ALPHA-2026';
const FORMER = 'swe2-tumba';

const CLUB_INTERNAL = ['/career/squad', '/career/tactics', '/career/training', '/career/medical', '/career/contracts', '/career/club',
  '/career/klubbhuset', '/career/board', '/career/finance?section=ledger', '/career/staff', '/career/staff/recruitment', '/career/recruitment',
  '/career/scouting', '/career/transfers', '/career/analysis/our-team', '/career/schedule', '/career/match-preview'];
const PUBLIC = ['/career', '/career/inbox', '/career/calendar', '/career/players', '/career/season', '/career/competitions', '/career/statistics',
  '/career/manager', '/career/history', '/career/media', '/career/settings'];

async function shellReady(p: Page) { await expect(p.locator('.hm-shell #manager-content')).toBeVisible({ timeout: 120000 }); }
const blocked = (p: Page) => p.getByTestId('no-club-access');

async function createCareer(page: Page) {
  await page.goto(`${base}/new-game`);
  await newGameToManagerStep(page);
  await page.getByPlaceholder('För- och efternamn').fill('Employment E2E');
  await page.getByRole('combobox', { name: 'Nationalitet', exact: true }).selectOption('SWE');
  await page.getByRole('textbox', { name: 'Födelsedatum', exact: true }).fill('1984-03-03');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await enterCareerAfterLoad(page);
  await shellReady(page);
}

async function formerPlayerId(page: Page): Promise<string> {
  return page.evaluate(async (club) => {
    const active = localStorage.getItem('hm-game:active-save:v1')!;
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('hm-game'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const save = await new Promise<{ careerState: { worldSquads: Record<string, { id: string }[]> } }>((res) => { const q = db.transaction('saves').objectStore('saves').get(active); q.onsuccess = () => res(q.result); });
    db.close();
    return save.careerState.worldSquads[club]![0]!.id;
  }, FORMER);
}

test('a manager without a club loses the former club\'s workspace, keeps the world and his career', async ({ browser }) => {
  test.setTimeout(30 * 60 * 1000);
  const origin = new URL(base).origin;
  const context = await browser.newContext({ storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'hm_alpha_authorized', value: 'true' }, { name: 'hm_alpha_access_code', value: code }] }] } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  await page.setViewportSize({ width: 1440, height: 900 });

  await test.step('employed: own club fully accessible, navigation unchanged', async () => {
    await createCareer(page);
    await expect(page.locator('[data-testid^="hub-locked-"]')).toHaveCount(0);
    await expect(page.locator('nav.hm-rail .hm-rail-link')).toHaveCount(6);
    await page.goto(`${base}/career/squad`); await shellReady(page);
    await expect(blocked(page)).toHaveCount(0);
    await expect(page.locator('.hm-main')).not.toContainText('Den här delen hör till en klubb');
  });

  await test.step('resigning removes club access immediately (no reload)', async () => {
    await page.goto(`${base}/career/manager`); await shellReady(page);
    await page.getByRole('button', { name: 'Avgå som huvudtränare…' }).click();
    await page.getByRole('button', { name: 'Ja, jag avgår' }).click();
    await expect(page.getByTestId('hub-locked-laget')).toBeVisible();
    await expect(page.getByTestId('hub-locked-klubben')).toBeVisible();
    await expect(page.locator('.hm-header-title-text')).toContainText('Utan klubb');
    await page.getByRole('button', { name: 'Spara', exact: true }).click();
  });

  await test.step('stale routes from history do not bypass the guard', async () => {
    await page.goBack(); // back to /career/squad, opened while employed
    await expect(page).toHaveURL(/\/career\/squad$/);
    await expect(blocked(page)).toBeVisible();
    await expect(page.locator('.hm-main table')).toHaveCount(0);
  });

  await test.step('direct URLs to the former club\'s internals are refused; public pages stay open', async () => {
    for (const route of CLUB_INTERNAL) {
      await page.goto(`${base}${route}`); await shellReady(page);
      await expect(blocked(page), route).toBeVisible();
      await expect(page.locator('.hm-noclub-former'), route).toContainText('egen organisation');
    }
    for (const route of PUBLIC) {
      await page.goto(`${base}${route}`); await shellReady(page);
      await expect(blocked(page), route).toHaveCount(0);
    }
  });

  await test.step('Idag is the career\'s own front page: no former crest, squad, board or club shortcuts', async () => {
    await page.goto(`${base}/career`); await shellReady(page);
    const front = page.locator('.hm-front[data-employment="UNEMPLOYED"]');
    await expect(front).toBeVisible();
    await expect(page.locator('.hm-front-lead[data-kind="SEEKING_JOB"]')).toContainText('Du står utan klubb');
    await expect(front.locator('h1')).toHaveText('Utan klubb');
    await expect(front.locator('a[href="/career/tactics"], a[href="/career/club"], a[href="/career/board"], a[href="/career/training"]')).toHaveCount(0);
    await expect(page.locator('.hm-spine-row a[href="/career/training"], .hm-spine-row a[href="/career/board"]')).toHaveCount(0);
    await expect(front.locator('a[href="/career/manager?tab=jobs"]').first()).toBeVisible();
  });

  await test.step('the former club stays visible as a public club; its players are seen from the outside', async () => {
    await page.goto(`${base}/career/clubs/${FORMER}`); await shellReady(page);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(new RegExp(`/career/clubs/${FORMER}$`)); // no redirect into the (refused) own-club page
    await expect(blocked(page)).toHaveCount(0);
    const playerId = await formerPlayerId(page);
    await page.goto(`${base}/career/squad/${encodeURIComponent(playerId)}`); await shellReady(page);
    await expect(blocked(page)).toHaveCount(0);
    await expect(page.getByTestId('player-actions-no-club')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Matchtrupp & startsju' })).toHaveCount(0);
  });

  await test.step('command palette and hub keys offer nothing club-internal', async () => {
    await page.goto(`${base}/career/history`); await shellReady(page);
    await page.keyboard.press('2'); // Laget
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/career\/history$/);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.type('taktik');
    await page.waitForTimeout(400);
    await expect(dialog).not.toContainText('Laget'); // neither the hub nor its pages (Taktik lives under Laget)
    await expect(dialog).not.toContainText('Sätt matchtruppen');
    await page.keyboard.press('Escape');
  });

  await test.step('a reload keeps the employment state', async () => {
    await page.reload(); await shellReady(page);
    await expect(page.getByTestId('hub-locked-laget')).toBeVisible();
    await page.goto(`${base}/career/finance`); await shellReady(page);
    await expect(blocked(page)).toBeVisible();
  });

  await test.step('phone: coherent unemployed front page, locked tab, no overflow', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${base}/career`); await shellReady(page);
    await expect(page.locator('.hm-front[data-employment="UNEMPLOYED"]')).toBeVisible();
    await expect(page.locator('.hm-mobile-tabs [aria-disabled="true"]')).toHaveCount(1); // Laget (Klubben lives in Mer)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.goto(`${base}/career/tactics`); await shellReady(page);
    await expect(blocked(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  expect(errors, 'no page errors').toEqual([]);
  await context.close();
});
