// Shared e2e step: choose a valid starting seven the way a manager does (no bypass of the real requirement).
// Careers require a selected starting seven before "STARTA MATCH →" is enabled. On the tactics board the
// assistant's proposal is previewed (TRN-02a) and applied explicitly; the board must then report 7/7.
import { expect, type Page } from '@playwright/test';

export async function chooseStartingSeven(page: Page, base: string) {
  if (!/\/career\/tactics/.test(page.url())) await page.goto(`${base}/career/tactics`);
  await expect(page.locator('.coach-preparation')).toBeVisible({ timeout: 90000 });
  const status = page.locator('.coach-lineup-status strong');
  if (await status.count() && /Startsju 7\/7/.test(await status.innerText())) return;
  await page.getByRole('button', { name: 'Assistentens förslag', exact: true }).click();
  await expect(page.locator('.tb-guard[data-state="preview"]')).toBeVisible();
  await page.getByRole('button', { name: 'Tillämpa förslaget', exact: true }).click();
  await expect(page.locator('.coach-lineup-status strong')).toContainText('Startsju 7/7');
}

/** On the match preview: if "STARTA MATCH →" is disabled because no valid starting seven exists, choose one on the
 *  tactics board (the manager's real path) and return to the preview. Asserts the button is then enabled. */
export async function readyStartMatch(page: Page, base: string) {
  const start = page.getByRole('button', { name: 'STARTA MATCH →', exact: true });
  await expect(start).toBeVisible({ timeout: 90000 });
  if (await start.isDisabled()) {
    await chooseStartingSeven(page, base);
    // In-app navigation, as a manager does: a full reload here would drop the just-applied plan before autosave.
    await page.getByRole('link', { name: 'Till matchen →' }).first().click();
    await page.waitForURL('**/career/match-preview');
  }
  const why = await page.locator('.md-attention').innerText().catch(() => '');
  await expect(start, `STARTA MATCH → disabled; preview says: ${why}`).toBeEnabled({ timeout: 90000 });
}

/** The continuous 2D court has been an opt-in "Experimental 2D" disclosure in the Match Center since c3d4ad4
 *  (manager-first Match Center). Specs that inspect the court open it the way a user does. */
export async function showCourt2D(page: Page) {
  await expect(page.locator('.mc-match')).toBeVisible({ timeout: 60000 });
  const details = page.locator('details.mc-experimental');
  if (!(await details.count())) return;
  // Retry: a toggle made before hydration finishes is reset by React's controlled `open`.
  await expect(async () => {
    if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await details.locator('summary').click();
    await expect(details.locator('.game-court-stage')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60000 });
}
