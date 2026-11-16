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

/** The continuous 2D court is the Match Center's "Plan" view (MDY-02l): a tab in the "Matchvy" tablist, after the
 *  four review views. Specs that inspect the court open it the way a user does. The Match Center returns to
 *  'Översikt' by itself at half-time, timeouts and full time, so call this again after those transitions. */
export async function showCourt2D(page: Page) {
  const match = page.locator('.mc-match');
  await expect(match).toBeVisible({ timeout: 60000 });
  const plan = match.getByRole('tablist', { name: 'Matchvy', exact: true }).getByRole('tab', { name: 'Plan', exact: true });
  // Retry: a click made before hydration finishes is lost.
  await expect(async () => {
    if ((await plan.getAttribute('aria-selected')) !== 'true') await plan.click();
    await expect(match.locator('.mc-plan .game-court-stage')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60000 });
}

/** MDY-02b: the live speed is a radio group ("Matchhastighet"); each radio is named "<label> <value>×", e.g.
 *  "Turbo 64×". Pass the number (matched as "… 64×") or the full radio name. On narrow layouts the group sits
 *  behind the "Hastighet" toggle, which is opened first. */
export async function setMatchSpeed(page: Page, speed: number | string) {
  const group = page.getByRole('radiogroup', { name: 'Matchhastighet', exact: true });
  const toggle = page.locator('.mc-speed-toggle');
  if (await toggle.isVisible() && (await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const radio = typeof speed === 'number'
    ? group.getByRole('radio', { name: new RegExp(` ${speed}×$`) })
    : group.getByRole('radio', { name: speed, exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
}

/** "Spela till slut" lives in the transport's "Mer" menu and asks for confirmation ("Ja, spela till slut"). */
export async function playToEnd(page: Page) {
  const more = page.locator('.mc-transport-more').getByRole('button', { name: 'Mer', exact: true });
  if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
  await page.getByRole('group', { name: 'Fler matchval', exact: true }).getByRole('button', { name: 'Spela till slut', exact: true }).click();
  await page.getByRole('group', { name: 'Bekräfta spela till slut', exact: true }).getByRole('button', { name: 'Ja, spela till slut', exact: true }).click();
}

/** ANL-01/MDY-04: the archived replay lives behind the match report's "Repris" tab (no separate /match-day page).
 *  Opens the tab, waits for the archived Match Center and switches it to the 2D "Plan" view, where the replay
 *  scoreboard ("Repris"), "Reprishastighet", "Spela"/"Pausa" and "Position i reprisen" are. Returns the panel. */
export async function openReplay(page: Page) {
  await expect(page).toHaveURL(/\/career\/match-report\//);
  await page.getByRole('tablist', { name: 'Rapportens delar', exact: true }).getByRole('tab', { name: 'Repris', exact: true }).click();
  await expect(page).toHaveURL(/\/career\/match-report\/[^#]+#repris$/);
  const panel = page.locator('#rp-panel-REPRIS');
  await expect(panel.locator('.mc-match')).toBeVisible({ timeout: 60000 });
  await showCourt2D(page);
  await expect(panel.locator('.mc-plan .game-scoreboard-top').getByText('Repris', { exact: true })).toBeVisible({ timeout: 60000 });
  return panel;
}

const careerHandover = new WeakSet<Page>();
/** ENT-12: when a career takes longer than three seconds to open, the handover screen waits for
 *  "Gå in på kontoret →" instead of jumping in. Enters the way a manager does and waits for the career shell.
 *  It also registers a locator handler so later full loads of a /career route (goto/reload) are entered too. */
export async function enterCareerAfterLoad(page: Page, timeout = 120000) {
  const enter = page.getByRole('button', { name: 'Gå in på kontoret →', exact: true });
  if (!careerHandover.has(page)) {
    careerHandover.add(page);
    await page.addLocatorHandler(enter, async (button) => { await button.click(); });
  }
  const shell = page.locator('.hm-shell');
  await expect(async () => {
    if (await enter.isVisible()) await enter.click();
    await expect(shell).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout });
}

/** ENT-03 C: New Game opens on the club wall (step 1 of 3, Tumba preselected in the default world); one
 *  "Nästa →" reaches the manager's accreditation pass. Call on /new-game after choosing a club, if any. */
export async function newGameToManagerStep(page: Page) {
  await expect(page.getByRole('heading', { name: 'Välj din hemmaplan.', exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vem är du?', exact: true })).toBeVisible();
}

/** Live clock / score text. Replays still render the classic scoreboard; the live match shows them in the Match
 *  Center's sticky bar (since c3d4ad4). Prefer the scoreboard when it is on the page. */
export async function scoreboardClock(page: Page): Promise<string> {
  const classic = page.locator('.game-scoreboard-top');
  return (await classic.count()) ? classic.first().innerText() : page.locator('.mc-workspace-nav .mc-compact-identity > small').innerText();
}
export async function scoreboardScore(page: Page): Promise<string> {
  const classic = page.locator('.game-live-score');
  return (await classic.count()) ? classic.first().innerText() : page.locator('.mc-workspace-nav .mc-score-figure').innerText();
}
