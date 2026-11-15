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
