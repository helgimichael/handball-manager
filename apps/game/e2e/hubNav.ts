// Arena Nights C5.1 (ENT-07): the career's destinations live in six hubs. Specs reach a page the way a
// manager does: hub in the rail, then the tab in that hub's tab row.
import type { Page } from '@playwright/test';

const HUB_OF: Record<string, string> = {
  Hem: 'Idag', Inkorg: 'Idag', Kalender: 'Idag', Schema: 'Idag',
  Trupp: 'Laget', Taktik: 'Laget', 'Träning': 'Laget', Medicinskt: 'Laget', Kontrakt: 'Laget',
  Klubbhuset: 'Klubben', Klubb: 'Klubben', Styrelsen: 'Klubben', Ekonomi: 'Klubben', Personal: 'Klubben',
  Rekrytering: 'Rekrytering', 'Spelarsök': 'Rekrytering', Scouting: 'Rekrytering', Transfers: 'Rekrytering',
  'Säsongen': 'Tävling', 'Tävlingar': 'Tävling', 'Svenska Cupen': 'Tävling', Statistik: 'Tävling', Analys: 'Tävling',
  'Karriär': 'Karriär', Historik: 'Karriär', Media: 'Karriär',
};

export async function navTo(page: Page, tab: string) {
  const hub = HUB_OF[tab];
  if (!hub) throw new Error(`No hub for ${tab}`);
  await page.getByRole('navigation', { name: 'Hubbar', exact: true }).getByRole('link', { name: hub, exact: true }).click();
  await page.getByRole('navigation', { name: `${hub}: flikar`, exact: true }).getByRole('link', { name: tab, exact: true }).click();
}
