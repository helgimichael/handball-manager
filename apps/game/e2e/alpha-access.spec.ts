import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { CareerSave } from '../lib/save/saveRepository';

// Run against a built app: HM_QA_URL=http://localhost:3001 npx playwright test e2e/alpha-access.spec.ts
// Set HM_QA_ALPHA_ACCESS_CODE to match NEXT_PUBLIC_ALPHA_ACCESS_CODE if customized at build time.
const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const code = process.env.HM_QA_ALPHA_ACCESS_CODE?.trim() || 'HBL-ALPHA-2026';

async function unlock(page: Page) {
  await page.getByLabel('Accesskod', { exact: true }).fill(`  ${code.toLowerCase()}  `);
  await page.getByRole('button', { name: 'Lås upp', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rapportera bugg / Feedback', exact: true })).toBeVisible();
}

test('unauthorized direct route is blocked and incorrect codes explain how to retry', async ({ page }) => {
  await page.goto(`${base}/new-game`);
  await expect(page.getByRole('heading', { name: 'Handball Manager Alpha' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rapportera bugg / Feedback' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Nästa/ })).toHaveCount(0);
  await page.getByLabel('Accesskod', { exact: true }).fill('fel-kod');
  await page.getByRole('button', { name: 'Lås upp', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Ogiltig testkod. Kontrollera koden och försök igen.');
  expect(await page.evaluate(() => localStorage.getItem('hm_alpha_authorized'))).toBeNull();
});

test('valid trimmed case-insensitive code unlocks immediately and persists across reload and navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await unlock(page);
  expect(await page.evaluate(() => localStorage.getItem('hm_alpha_authorized'))).toBe('true');
  expect(await page.evaluate(() => localStorage.getItem('hm_alpha_access_code'))).toBe(code.toLowerCase());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rapportera bugg / Feedback' })).toBeVisible();
  await expect(page.getByLabel('Accesskod', { exact: true })).toHaveCount(0);
  await page.goto(`${base}/new-game`);
  await expect(page.getByRole('button', { name: /Nästa/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a stale stored code does not grant access just because the flag is true', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hm_alpha_authorized', 'true');
    localStorage.setItem('hm_alpha_access_code', 'retired-code');
  });
  await page.goto(base);
  await expect(page.getByLabel('Accesskod', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rapportera bugg / Feedback' })).toHaveCount(0);
});

test('blocked local storage surfaces a Swedish recovery instruction', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage disabled', 'SecurityError'); };
  });
  await page.goto(base);
  await page.getByLabel('Accesskod', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Lås upp', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Tillåt lokal lagring i webbläsaren');
  await expect(page.getByRole('button', { name: 'Rapportera bugg / Feedback' })).toHaveCount(0);
});

test('feedback exports the currently active save through the real JSON repository download', async ({ page }) => {
  await page.goto(base);
  await unlock(page);
  const save: CareerSave = {
    saveId: 'alpha-feedback-current', schemaVersion: 8,
    selectedNations: ['SE'], selectedCompetitionIds: ['handbollsligan'], clubId: 'alpha-club',
    manager: { name: 'Alphatestare', nationality: 'SE', dateOfBirth: '1990-01-01' },
    gameDate: '2026-10-19', createdAt: '2026-10-19T10:00:00.000Z', lastPlayedAt: '2026-10-19T10:00:00.000Z',
  };
  await page.evaluate(async record => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('hm-game', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put({ ...record, saveId: 'alpha-feedback-other', clubId: 'other-club' });
      tx.objectStore('saves').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem('hm-game:active-save:v1', record.saveId);
  }, save);
  const trigger = page.getByRole('button', { name: 'Rapportera bugg / Feedback' });
  await trigger.click();
  const modal = page.getByRole('dialog', { name: 'Rapportera feedback eller bugg' });
  await expect(modal).toBeVisible();
  const pendingDownload = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Ladda ner sparafil (.json)', exact: true }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toMatch(/^alpha-club_2026-10-19_.*\.json$/);
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.backupVersion).toBe(1);
  expect(backup.save).toEqual(save);
  expect(backup.archives).toEqual({});
  await expect(modal.getByRole('status')).toContainText('Sparafilen har laddats ner');
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Stäng', exact: true }).click();
  await expect(modal).toHaveCount(0);
});

test('feedback explains missing and unreadable active saves without a download', async ({ page }) => {
  await page.goto(base);
  await unlock(page);
  await page.getByRole('button', { name: 'Rapportera bugg / Feedback' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Ladda ner sparafil (.json)', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Ingen aktiv karriär');
  await page.evaluate(() => localStorage.setItem('hm-game:active-save:v1', 'missing-save'));
  await modal.getByRole('button', { name: 'Ladda ner sparafil (.json)', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('Kontrollera att karriären är sparad');
  await expect(modal.getByRole('button', { name: 'Ladda ner sparafil (.json)', exact: true })).toBeEnabled();
});
