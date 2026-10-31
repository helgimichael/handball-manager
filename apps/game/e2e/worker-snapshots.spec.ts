import { test, expect } from '@playwright/test';

const base = process.env.HM_QA_URL ?? 'http://127.0.0.1:8787';
const code = process.env.HM_QA_ALPHA_ACCESS_CODE ?? 'HBL-ALPHA-2026';

test('workerd serves complete canonical squads and ratings', async ({ request }) => {
  const squadsResponse = await request.get(`${base}/api/game-world/squad-snapshot?competitionId=se_handbollsligan_herr`);
  expect(squadsResponse.status()).toBe(200);
  const { worldSquads } = await squadsResponse.json();
  const ratingsResponse = await request.get(`${base}/api/game-world/gameplay-ratings-snapshot?competitionId=se_handbollsligan_herr`);
  expect(ratingsResponse.status()).toBe(200);
  const { gameplayRatings } = await ratingsResponse.json();
  expect(Object.keys(worldSquads)).toHaveLength(14);
  expect(Object.values(worldSquads).flat()).toHaveLength(265);
  expect(Object.values(gameplayRatings).flat()).toHaveLength(265);
  for (const [clubId, players] of Object.entries(worldSquads)) {
    expect(gameplayRatings[clubId].map((p: { playerId: string }) => p.playerId).sort())
      .toEqual((players as { id: string }[]).map(p => p.id).sort());
  }
});

test('New Game initializes and persists a real Handbollsligan career under workerd', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/new-game`);
  await page.getByLabel('Accesskod', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Lås upp', exact: true }).click();
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: 'Alingsås HK', exact: true }).check();
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByPlaceholder('För- och efternamn').fill('Worker Alphatestare');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: 'Vid första tävlingsmatchen', exact: true }).check();
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  await page.waitForURL('**/career', { timeout: 120_000 });
  await expect(page.getByRole('link', { name: 'Trupp', exact: true })).toBeVisible({ timeout: 60_000 });
  const saved = await page.evaluate(async () => {
    const id = localStorage.getItem('hm-game:active-save:v1');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('hm-game');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const save = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = db.transaction('saves').objectStore('saves').get(id!);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return save;
  });
  expect(saved.clubId).toBe('se_club_alingsas_hk');
  const career = saved.careerState as { competitionId: string; worldSquads: Record<string, unknown[]>; gameplayRatings: Record<string, unknown[]> };
  expect(career.competitionId).toBe('se_handbollsligan_herr');
  expect(career.worldSquads.se_club_alingsas_hk.length).toBeGreaterThan(7);
  expect(career.gameplayRatings.se_club_alingsas_hk).toHaveLength(career.worldSquads.se_club_alingsas_hk.length);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Trupp', exact: true })).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});
