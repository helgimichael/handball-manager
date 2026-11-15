// Stabilization (tactical autosave, P0): tactics board edits survive a reload, a reload during an unfinished
// write is held by the browser's leave-page guard instead of silently dropping the edit, the match preview uses
// the same saved lineup, rapid edits keep the newest state, and a failed write keeps the edits, says so and
// retries. Real career, real UI and the real IndexedDB save; the only injected fault is a failing IDB put.
import { test, expect as baseExpect, type Page } from '@playwright/test';
import { chooseStartingSeven } from './matchPrep';

const expect = baseExpect.configure({ timeout: 30000 });
const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const saveState = (page: Page) => page.locator('.tb-save-state');
async function board(page: Page) { await expect(page.locator('.coach-preparation')).toBeVisible({ timeout: 90000 }); }
async function saved(page: Page) { await expect(saveState(page)).toHaveAttribute('data-state', 'SAVED', { timeout: 60000 }); }
async function v6Name(page: Page) {
  await page.getByRole('button', { name: 'Välj startposition V6', exact: true }).click();
  return (await page.locator('.coach-current-player .game-player-cell a').first().innerText()).trim();
}

test('tactics board edits persist across reloads, preview and failures', async ({ page }) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/new-game`);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByPlaceholder('För- och efternamn').fill('Autosave Check');
  await page.getByRole('combobox', { name: 'Nationalitet', exact: true }).selectOption('SWE');
  await page.getByRole('textbox', { name: 'Födelsedatum', exact: true }).fill('1985-04-12');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: 'Vid första tävlingsmatchen', exact: true }).check();
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await page.waitForURL('**/career', { timeout: 120000 });

  // 1-3. Starting seven, then an immediate reload.
  await page.goto(`${base}/career/tactics`);
  await chooseStartingSeven(page, base);
  const before = await v6Name(page);
  const reserve = page.locator('.coach-candidate-list button').filter({ has: page.locator('small', { hasText: 'Bänk' }) }).first();
  const replacement = (await reserve.locator('strong').innerText()).trim();
  await reserve.click();
  // Immediately reload: either the write has committed, or the leave-page guard holds the reload.
  let guarded = false;
  page.once('dialog', (dialog) => { guarded = dialog.type() === 'beforeunload'; void dialog.dismiss(); });
  await page.reload({ timeout: 8000 }).catch(() => undefined);
  if (guarded) { await saved(page); await page.reload(); }
  test.info().annotations.push({ type: 'immediate-reload', description: guarded ? 'held by the leave-page guard until the write committed' : 'write had already committed' });
  await board(page);
  expect(await v6Name(page), `V6 after reload (was ${before})`).toBe(replacement);
  await expect(page.locator('.coach-lineup-status strong')).toContainText('Startsju 7/7');

  // 4-6. Formation.
  await page.getByRole('button', { name: /Försvar 6 mot 6/ }).first().click();
  await page.getByRole('button', { name: '5–1 Försvar', exact: true }).click();
  await saved(page);
  await page.reload();
  await board(page);
  await page.getByRole('button', { name: /Försvar 6 mot 6/ }).first().click();
  await expect(page.getByRole('button', { name: '5–1 Försvar', exact: true })).toHaveClass(/hm-btn-primary/);

  // 7-9. Tactical instructions.
  await page.getByRole('button', { name: 'Tempo Snabbt', exact: true }).click();
  await page.getByRole('button', { name: 'Anfall Bredd', exact: true }).click();
  await saved(page);
  await page.reload();
  await board(page);
  await expect(page.getByRole('button', { name: 'Tempo Snabbt', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Anfall Bredd', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 10-11. To the match preview and back: the preview shows the board's starting seven.
  await page.getByRole('link', { name: 'Till matchen →' }).first().click();
  await page.waitForURL('**/career/match-preview');
  await expect(page.locator('.md-court-spots li')).toHaveCount(7);
  const lastName = replacement.split(' ').pop()!;
  await expect(page.locator('.md-court-spots')).toContainText(lastName);
  await page.goto(`${base}/career/tactics`);
  await board(page);
  expect(await v6Name(page)).toBe(replacement);
  await expect(page.getByRole('button', { name: 'Tempo Snabbt', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 12. Rapid successive changes: the last one wins after reload.
  for (const label of ['Tempo Lugnt', 'Tempo Balanserat', 'Tempo Snabbt', 'Tempo Lugnt']) await page.getByRole('button', { name: label, exact: true }).click();
  await saved(page);
  await page.reload();
  await board(page);
  await expect(page.getByRole('button', { name: 'Tempo Lugnt', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 13. Save failure: the edit stays on screen, the failure is announced with a retry, the retry commits it.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (window as unknown as { __restorePut: () => void }).__restorePut = () => { IDBObjectStore.prototype.put = put; };
    IDBObjectStore.prototype.put = function () { throw new DOMException('Injected failure', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: 'Anfall Kombinationer', exact: true }).click();
  await expect(saveState(page)).toHaveAttribute('data-state', 'FAILED');
  await expect(page.getByRole('alert').filter({ hasText: 'Ändringarna är inte sparade' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anfall Kombinationer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => (window as unknown as { __restorePut: () => void }).__restorePut());
  await saveState(page).getByRole('button', { name: 'Försök igen', exact: true }).click();
  await saved(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Ändringarna är inte sparade' })).toHaveCount(0);
  await page.reload();
  await board(page);
  await expect(page.getByRole('button', { name: 'Anfall Kombinationer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await v6Name(page)).toBe(replacement);
  expect(errors).toEqual([]);
});
