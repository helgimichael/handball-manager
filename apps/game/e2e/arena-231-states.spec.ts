// Arena 231 states: the 19 surfaces the sweep (arena-231-sweep.spec.ts) could not reach in a fresh career,
// verified in states reached through real game progression.
//
// Where the states come from:
//   * e2e/arena-231-states.prep.ts plays a Tumba career headlessly with the functions the UI buttons call
//     (Continue, the matchday action, inbox decisions, press answers) and writes portable backups (the format
//     Inställningar → Data → Exportera writes) at the moments a state appears: an own player injured, an
//     incoming bid, a board verdict dated today, an open board decision, a suspended manager's matchday, and
//     the completed season. HM_STATES_SAVES points at its output (states.json manifest + one .json per state).
//   * Each backup is imported here through Inställningar → Data → Importera sparfil, in a fresh browser context.
//   * From there the UI drives the rest: the season transition ("Börja säsong …"), a staff contract offer, a
//     scouting sweep and Continue until it reports, a free-agent signing, accepting an incoming bid, the match
//     squad trimmed in Taktik, the suspended manager's match started live.
// Every check is named "<ID> …"; per surface: the recommended structure at 1440×900, 900×1000 and 375×812, no
// pageerror and no horizontal overflow at each, and the spec's one real interaction where it defines one.
// A state that is not reached is recorded passed:false with the reason; it is never a pass.
// Results: <HM_QA_SCREENSHOT_DIR>/states-results.json (same shape as sweep-results.json + reachedBy), screenshots alongside.
import { test, expect as baseExpect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chooseStartingSeven, enterCareerAfterLoad } from './matchPrep';

const expect = baseExpect.configure({ timeout: 15000 });
const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const shots = process.env.HM_QA_SCREENSHOT_DIR ?? 'C:/DEV/QA/reports/arena-231/states';
const saves = process.env.HM_STATES_SAVES ?? `${shots}/saves`;
const code = process.env.HM_QA_ALPHA_ACCESS_CODE?.trim() || 'HBL-ALPHA-2026';
const ONLY = process.env.HM_STATES_ONLY ? new RegExp(process.env.HM_STATES_ONLY) : null;
const NOT_REACHABLE = 'state not reachable';

type VP = { name: 'desktop' | 'tablet' | 'phone'; width: number; height: number };
const VPS: VP[] = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'tablet', width: 900, height: 1000 }, { name: 'phone', width: 375, height: 812 }];
const DESKTOP = VPS[0]!;
const isPhone = (vp: VP) => vp.width <= 760;

// ---------------------------------------------------------------------------------------------------------------
// Results (same shape as the sweep's, plus how the state was reached)
type Check = { name: string; viewport?: string; passed: boolean; error?: string };
type Result = { route: string; checks: Check[]; passed: boolean; viewports: string[]; reason?: string; reachedBy?: string };
const results: Record<string, Result> = {};
const pageErrors: { url: string; message: string }[] = [];

function rec(id: string, route: string): Result {
  const r = (results[id] ??= { route, checks: [], passed: true, viewports: [] });
  if (!r.route.split(' | ').includes(route)) r.route = `${r.route} | ${route}`;
  return r;
}
function reached(id: string, route: string, how: string) {
  const r = rec(id, route);
  r.reachedBy = r.reachedBy ? `${r.reachedBy}; ${how}` : how;
}
function short(e: unknown) {
  const lines = String((e as Error)?.message ?? e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, 6).join(' ⏎ ').slice(0, 800);
}
async function check(id: string, route: string, name: string, vp: VP | null, fn: () => Promise<void>) {
  const r = rec(id, route);
  try {
    await test.step(`${id} ${name}${vp ? ` @${vp.name}` : ''}`, fn);
    r.checks.push({ name, viewport: vp?.name, passed: true });
  } catch (e) {
    r.checks.push({ name, viewport: vp?.name, passed: false, error: short(e) });
    r.passed = false;
  }
  if (vp && !r.viewports.includes(vp.name)) r.viewports.push(vp.name);
}
function notReachable(id: string, route: string, why: string) {
  const r = rec(id, route);
  r.passed = false;
  r.reason = `${NOT_REACHABLE}: ${why}`;
}
function writeResults() {
  mkdirSync(shots, { recursive: true });
  for (const r of Object.values(results)) if (!r.checks.length && !r.reason) { r.passed = false; r.reason = `${NOT_REACHABLE}: no check ran`; }
  const ordered = Object.fromEntries(Object.keys(results).sort().map((k) => [k, results[k]]));
  writeFileSync(`${shots}/states-results.json`, JSON.stringify(ordered, null, 1));
  writeFileSync(`${shots}/states-pageerrors.json`, JSON.stringify(pageErrors, null, 1));
}

// ---------------------------------------------------------------------------------------------------------------
// Page helpers
const V = (p: Page, sel: string) => expect(p.locator(sel).first()).toBeVisible();
const A = (p: Page, sel: string) => expect(p.locator(sel).first()).toBeAttached();
async function shellReady(p: Page) { await enterCareerAfterLoad(p, 120000); await expect(p.locator('.hm-shell #manager-content')).toBeVisible({ timeout: 90000 }); }
async function settle(p: Page) { await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(700); }
async function overflow(p: Page) { return p.evaluate(() => document.documentElement.scrollWidth - innerWidth); }

/** Once-per-viewer moments (season curtain, gala, verdict stamp, meeting, floodlight) are forgotten before each
 *  viewport so every size sees the state a manager sees on first arrival. Only those flags are removed. */
async function forgetMoments(p: Page) {
  await p.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/^hm-season-curtain:|^hm:gala-seen:/.test(k)) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (/^hm-board-|^hm-tx-moment:/.test(k)) sessionStorage.removeItem(k);
  }).catch(() => {});
}

type Surface = {
  id: string; route: string; url: string;
  present: (p: Page, vp: VP) => Promise<void>;
  act?: (p: Page, vp: VP) => Promise<void>; actName?: string; actAt?: 'desktop' | 'phone' | 'all';
  /** Run after each load (default: forget once-per-viewer moments and reload). */
  fresh?: boolean;
};

async function load(p: Page, url: string, fresh = true) {
  await p.goto(`${base}${url}`);
  await shellReady(p);
  if (fresh) { await forgetMoments(p); await p.reload(); await shellReady(p); }
  await settle(p);
}

/** Structure at three sizes, health at each, one interaction (fresh load) where the spec defines one. */
async function verify(p: Page, s: Surface) {
  if (ONLY && !ONLY.test(s.id)) return;
  await test.step(`${s.id} ${s.route}`, async () => {
    for (const vp of VPS) {
      await p.setViewportSize({ width: vp.width, height: vp.height });
      const before = pageErrors.length;
      try { await load(p, s.url, s.fresh !== false); } catch (e) { await check(s.id, s.route, 'route loads', vp, async () => { throw e; }); continue; }
      await check(s.id, s.route, 'recommended structure present', vp, () => s.present(p, vp));
      const ov = await overflow(p);
      const errs = pageErrors.slice(before).map((e) => e.message);
      await check(s.id, s.route, 'no pageerror, no horizontal overflow', vp, async () => {
        expect(errs, `pageerror on ${s.url} @${vp.name}`).toEqual([]);
        expect(ov, `horizontal overflow on ${s.url} @${vp.name}`).toBeLessThanOrEqual(1);
      });
      await p.screenshot({ path: `${shots}/${s.id}-${vp.name}.png`, fullPage: vp.name !== 'phone' }).catch(() => {});
      const at = s.actAt ?? 'desktop';
      if (s.act && (at === 'all' || at === vp.name)) {
        const b2 = pageErrors.length;
        await check(s.id, s.route, s.actName ?? 'interaction', vp, async () => {
          await load(p, s.url, s.fresh !== false);
          await s.act!(p, vp);
          expect(pageErrors.slice(b2).map((e) => e.message), 'pageerror during interaction').toEqual([]);
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Career plumbing: import a prepared backup, save before full loads, Continue
type Manifest = Record<string, { file: string; gameDate: string; seasonId: string; why: string; facts: Record<string, unknown> }>;
const manifest: Manifest = existsSync(`${saves}/states.json`) ? JSON.parse(readFileSync(`${saves}/states.json`, 'utf8')) : {};

function watch(page: Page) {
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => pageErrors.push({ url: page.url(), message: e.message }));
}
async function newContext(browser: Browser): Promise<BrowserContext> {
  const origin = new URL(base).origin;
  return browser.newContext({ storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'hm_alpha_authorized', value: 'true' }, { name: 'hm_alpha_access_code', value: code }] }] } });
}
/** Inställningar → Data → Importera sparfil (the real import; it opens the career). */
async function importState(browser: Browser, name: string): Promise<{ context: BrowserContext; page: Page } | null> {
  const st = manifest[name];
  if (!st || !existsSync(st.file)) return null;
  const context = await newContext(browser);
  const page = await context.newPage();
  watch(page);
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await page.goto(`${base}/settings`);
  await expect(page.getByRole('button', { name: 'Välj sparfil…' })).toBeVisible({ timeout: 60000 });
  await page.locator('input[type=file][aria-label="Importera sparfil från inställningar"]').setInputFiles(st.file);
  await page.waitForURL(/\/career$/, { timeout: 600000 });
  await shellReady(page);
  await expect(page.locator('.hm-header-sub, .hm-header').first()).toBeVisible();
  return { context, page };
}
async function saveNow(page: Page) {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  const btn = page.locator('header.hm-header button.game-save-quick');
  if (await btn.isEnabled({ timeout: 60000 }).catch(() => false)) {
    // A floodlight moment can cover the header; the save control's own Ctrl+S then saves the same way.
    if (await btn.click({ timeout: 5000 }).then(() => false, () => true)) await page.keyboard.press('Control+s');
    await expect(page.locator('header.hm-header .game-save-indicator')).toHaveAttribute('data-phase', 'SAVED', { timeout: 120000 });
  }
  if (vp) await page.setViewportSize(vp);
}
async function delegatePressOnReport(page: Page) {
  const del = page.locator('.rp-press-actions').getByRole('button', { name: 'Delegera', exact: true });
  if (await del.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) await del.click();
}
/** A matchday on the way: SNABBRESULTAT (the quick path), starting seven from the assistant when needed. */
async function quickResult(page: Page) {
  await page.goto(`${base}/career/match-preview`); await shellReady(page); await settle(page);
  const start = page.getByRole('button', { name: 'STARTA MATCH →', exact: true });
  if (!(await start.isVisible().catch(() => false))) return false;
  if (await start.isDisabled()) { await chooseStartingSeven(page, base); await page.goto(`${base}/career/match-preview`); await shellReady(page); await settle(page); }
  await page.getByRole('button', { name: 'SNABBRESULTAT', exact: true }).click();
  const dialog = page.locator('dialog.hm-dialog[data-tone="warning"]');
  if (await dialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false)) await dialog.getByRole('button', { name: /^Spela/ }).click();
  await page.waitForURL(/\/career\/(match-day|match-report)\//, { timeout: 60000 });
  await page.waitForURL('**/career/match-report/**', { timeout: 300000 });
  await expect(page.locator('.rp-head')).toBeVisible({ timeout: 60000 });
  await delegatePressOnReport(page);
  await saveNow(page);
  return true;
}
/** Press Continue (from the front page) once, handling what stops it the way a manager does. Returns a log line. */
async function continueOnce(page: Page, opts: { playMatches?: boolean } = {}): Promise<string> {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  if (!/\/career$/.test(page.url())) { await page.goto(`${base}/career`); await shellReady(page); }
  await settle(page);
  const header = page.locator('button.game-continue.hm-continue-header');
  const label = (await header.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const date0 = await page.locator('.hm-header-sub').innerText().catch(() => '');
  if (await header.isDisabled().catch(() => false)) return `continue disabled (${label})`;
  await header.click();
  await page.locator('dialog.game-world-advance').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  await expect(page.locator('.game-world-advance')).toHaveCount(0, { timeout: 180000 }).catch(async () => { await page.keyboard.press('Escape').catch(() => {}); });
  await settle(page);
  const url = page.url();
  let did = '';
  if (/\/career\/media\/press\//.test(url)) {
    const del = page.getByRole('button', { name: /\(Delegera\)$/ });
    await (await del.count() ? del : page.getByRole('button', { name: 'Avböj / Hoppa över' })).first().click();
    did = 'press delegated';
  } else if (/\/career\/(match-preview|tactics|match-day)/.test(url) || /MATCH/i.test(label)) {
    did = opts.playMatches === false ? 'stopped at the matchday' : (await quickResult(page)) ? 'match quick result' : 'matchday (no start)';
  } else if (/\/career\/inbox/.test(url)) {
    const opt = page.locator('.ib-reader .ib-decision button.ib-option').first();
    if (await opt.isVisible().catch(() => false)) { await opt.click(); did = 'inbox decision answered (first option)'; }
  } else if (/\/career\/match-report\//.test(url)) { await delegatePressOnReport(page); did = 'report press delegated'; }
  await saveNow(page);
  const date1 = await page.locator('.hm-header-sub').innerText().catch(() => '');
  return `[${label}] ${date0.replace(/\s+/g, ' ')} → ${date1.replace(/\s+/g, ' ')} @${new URL(page.url()).pathname} ${did}`;
}
async function continueUntil(page: Page, done: () => Promise<boolean>, max: number, tag: string, opts: { playMatches?: boolean } = {}) {
  for (let n = 0; n < max; n++) {
    if (await done()) return true;
    const line = await continueOnce(page, opts);
    console.log(`[${tag}] ${n} ${line}`);
    if (/continue disabled/.test(line)) return done();
  }
  return done();
}

// ---------------------------------------------------------------------------------------------------------------
// TRN-01f -- the training page's Suspense fallback.
// In the running app it cannot be observed: CareerProvider renders the career-loading screen until the save is read,
// so the training route never server-renders, and on the client useSearchParams does not suspend, so the boundary
// resolves synchronously. It is verified as a component render: the prep script renders TrainingWeekSkeleton with
// react-dom/server (trn-01f-skeleton.html) and the markup is mounted here with the stylesheets the real
// /career/training document loads, at the three sizes, with and without reduced motion.
async function verifyTrainingSkeleton(page: Page) {
  const R = '/career/training (Suspense fallback, component render)';
  const file = `${saves}/trn-01f-skeleton.html`;
  if (!existsSync(file)) { notReachable('TRN-01f', R, 'skeleton markup not rendered by the prep script'); return; }
  const markup = readFileSync(file, 'utf8');
  reached('TRN-01f', R, 'component render: react-dom/server renderToStaticMarkup(<TrainingWeekSkeleton/>) mounted under the app stylesheets of /career/training (the fallback is not observable in the live app; see spec comment)');
  await page.goto(`${base}/career/training`); await shellReady(page);
  const links = await page.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => (l as HTMLLinkElement).href));
  const theme = await page.evaluate(() => [...document.documentElement.attributes].map((a) => `${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join(' '));
  const html = `<!doctype html><html ${theme}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links.map((h) => `<link rel="stylesheet" href="${h}">`).join('')}</head><body><div class="hm-shell"><main id="manager-content" class="hm-main">${markup}</main></div></body></html>`;
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.setContent(html, { waitUntil: 'load' });
    await check('TRN-01f', R, 'skeleton grid: role=status, screen-reader text, 7 day columns, forecast', vp, async () => {
      const s = page.getByRole('status');
      await expect(s).toHaveClass(/trn-skeleton/);
      await expect(s).toHaveAttribute('aria-live', 'polite');
      await expect(s.locator('.trn-sr')).toHaveText('Förbereder träningsveckan…');
      await expect(s.locator('.trn-week .trn-day')).toHaveCount(7);
      await V(page, '.trn-skeleton .trn-planner .trn-day');
      await A(page, '.trn-skeleton .trn-forecast .trn-sk');
      const box = await page.locator('.trn-skeleton .trn-sk-banner').boundingBox();
      expect(box?.height ?? 0, 'banner placeholder has height').toBeGreaterThan(8);
    });
    await check('TRN-01f', R, 'no horizontal overflow', vp, async () => { expect(await overflow(page)).toBeLessThanOrEqual(1); });
    await page.screenshot({ path: `${shots}/TRN-01f-${vp.name}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent(html, { waitUntil: 'load' });
  await check('TRN-01f', R, 'reduced motion: placeholders do not pulse', DESKTOP, async () => {
    const anim = await page.locator('.trn-skeleton .trn-sk').first().evaluate((e) => { const cs = getComputedStyle(e); return { name: cs.animationName, dur: cs.animationDuration }; });
    expect(anim.name === 'none' || /^0s/.test(anim.dur), `animation ${anim.name} ${anim.dur}`).toBeTruthy();
  });
  await page.emulateMedia({ reducedMotion: null });
}

// ---------------------------------------------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' });

test('arena 231 states: the 19 surfaces in states reached by real progression', async ({ browser }) => {
  test.setTimeout(6 * 60 * 60 * 1000);
  mkdirSync(shots, { recursive: true });
  const t0 = Date.now();
  const opened: BrowserContext[] = [];
  const open = async (name: string) => { const c = await importState(browser, name); if (c) opened.push(c.context); return c; };
  const why = (name: string) => manifest[name] ? `${manifest[name]!.why} -- prep snapshot "${name}" @${manifest[name]!.gameDate} (e2e/arena-231-states.prep.ts), imported via Inställningar → Data → Importera sparfil` : '';
  try {
    // ---------------- TRN-01f
    await test.step('TRN-01f skeleton', async () => {
      if (ONLY && !ONLY.test('TRN-01f')) return;
      const any = Object.keys(manifest)[0];
      const c = any ? await open(any) : null;
      if (!c) { notReachable('TRN-01f', '/career/training', 'no prepared career to load the app stylesheets from'); return; }
      await verifyTrainingSkeleton(c.page);
      await c.context.close();
    });

    // ---------------- Season complete (A) and the next season (B)
    await test.step('season complete', async () => {
      if (ONLY && !ONLY.test('DSH-01c|MGR-03b|MDY-01f|CLB-06|CLB-05|MGR-02|CMP-01f|REC-04|REC-01f|STF-03b|MED-01a')) return;
      const c = await open('season-complete');
      const ids = ['DSH-01c', 'MGR-03b', 'MDY-01f', 'CLB-06b', 'CLB-06d', 'MGR-02', 'CMP-01f'];
      if (!c) { for (const id of ids) notReachable(id, '-', 'prep snapshot "season-complete" missing (run e2e/arena-231-states.prep.ts)'); return; }
      const p = c.page;
      const facts = manifest['season-complete']!.facts;

      reached('DSH-01c', '/career (seasonComplete)', why('season-complete'));
      await verify(p, { id: 'DSH-01c', route: '/career (seasonComplete)', url: '/career',
        present: async (pg) => {
          const cur = pg.getByRole('dialog', { name: /^Säsongen .* är slut$/ });
          await expect(cur).toBeVisible({ timeout: 20000 });
          await V(pg, '.hm-curtain .hm-curtain-stage .hm-curtain-kicker');
          await expect(pg.locator('.hm-curtain-top').getByRole('button', { name: 'Hoppa över' })).toBeVisible();
          await expect(pg.locator('.hm-curtain-steps li')).toHaveCount(5);
        },
        actAt: 'all', actName: 'advance through the stages (Space), then Hoppa över closes; hand-off checklist under it',
        act: async (pg) => {
          const cur = pg.locator('.hm-curtain');
          await expect(cur).toBeVisible({ timeout: 20000 });
          await expect(cur.locator('.hm-curtain-kicker').first()).toHaveText('Slutplacering');
          await cur.focus(); await pg.keyboard.press('Space');
          await expect(cur.locator('.hm-curtain-kicker').first()).toHaveText('Utmärkelser');
          await cur.locator('.hm-curtain-top').getByRole('button', { name: 'Hoppa över' }).click();
          await expect(pg.locator('.hm-curtain')).toHaveCount(0);
          await expect(pg.getByRole('button', { name: 'Visa säsongen igen' })).toBeVisible();
          await A(pg, '.hm-handoff-n');
          expect(await overflow(pg)).toBeLessThanOrEqual(1);
        } });

      reached('MGR-03b', '/career/season', why('season-complete'));
      await verify(p, { id: 'MGR-03b', route: '/career/season', url: '/career/season',
        present: async (pg) => {
          // Opens by itself once per season and viewer: the first award in the floodlight overlay.
          await expect(pg.locator('.pg-gala[role=dialog]')).toBeVisible({ timeout: 15000 });
          await V(pg, '.pg-gala-stage .pg-gala-reveal h2#pg-gala-title');
          await expect(pg.locator('.pg-gala-stage header .pg-num')).toHaveText(/^1 \/ \d+$/);
          await expect(pg.locator('.pg-gala-stage footer').getByRole('button', { name: 'Hoppa över' })).toBeVisible();
          await A(pg, '.pg-gala-launch');
          await expect(pg.locator('.pg-gala-launch')).toContainText(/Galan \d{4}\/\d{2} · \d+ utmärkelser/);
        },
        actAt: 'all', actName: 'Nästa pris → advances; Escape closes; Se galan replays',
        act: async (pg) => {
          await expect(pg.locator('.pg-gala[role=dialog]')).toBeVisible({ timeout: 15000 });
          const n0 = await pg.locator('.pg-gala-stage header .pg-num').innerText();
          await pg.locator('.pg-gala-stage footer').getByRole('button', { name: /Nästa pris →|Sammanfattning →/ }).click();
          await expect(pg.locator('.pg-gala-stage header .pg-num')).not.toHaveText(n0);
          expect(await overflow(pg)).toBeLessThanOrEqual(1);
          await pg.keyboard.press('Escape');
          await expect(pg.locator('.pg-gala')).toHaveCount(0);
          await pg.locator('.pg-gala-launch').getByRole('button', { name: 'Se galan' }).click();
          await expect(pg.locator('.pg-gala[role=dialog]')).toBeVisible();
        } });

      reached('MDY-01f', '/career/match-preview', why('season-complete'));
      await verify(p, { id: 'MDY-01f', route: '/career/match-preview (season complete)', url: '/career/match-preview',
        present: async (pg) => { await V(pg, 'section.md-empty-card'); await expect(pg.locator('.md-empty-card h2')).toHaveText('Säsongen är avslutad'); await expect(pg.locator('.md-empty-card').getByRole('link', { name: 'Säsongsavslut →' })).toBeVisible(); await expect(pg.locator('.md-empty-card').getByRole('link', { name: 'Matchprogrammet' })).toBeVisible(); },
        actName: 'Säsongsavslut → opens the season page', act: async (pg) => { await pg.locator('.md-empty-card').getByRole('link', { name: 'Säsongsavslut →' }).click(); await expect(pg).toHaveURL(/\/career\/season$/); } });

      reached('CLB-06b', '/career/finance?tab=flows', `${why('season-complete')} (months Aug–May closed)`);
      await verify(p, { id: 'CLB-06b', route: '/career/finance?tab=flows', url: '/career/finance?tab=flows',
        present: async (pg) => { await A(pg, 'details#fx-flows[open]'); await V(pg, '#fx-flows .fx-flows'); await A(pg, '#fx-flows .fx-flows svg, #fx-flows .fx-flows [role=img], #fx-flows .fx-flows table, #fx-flows .fx-flows ol, #fx-flows .fx-flows ul'); await expect(pg.locator('#fx-flows')).not.toContainText('Första månadsbokslutet kommer'); },
        actName: 'collapse section', act: async (pg) => { await pg.locator('#fx-flows summary').click(); await expect(pg.locator('details#fx-flows')).not.toHaveAttribute('open', ''); } });

      reached('CLB-06d', '/career/finance?tab=ledger', `${why('season-complete')} (months Aug–May closed)`);
      await verify(p, { id: 'CLB-06d', route: '/career/finance?tab=ledger', url: '/career/finance?tab=ledger',
        present: async (pg) => { await A(pg, 'details#fx-ledger[open]'); await V(pg, '#fx-ledger ol.fx-ledger'); expect(await pg.locator('#fx-ledger ol.fx-ledger > li').count()).toBeGreaterThanOrEqual(2); },
        actName: 'open a month in the accordion', act: async (pg) => {
          const month = pg.locator('#fx-ledger ol.fx-ledger > li details, #fx-ledger ol.fx-ledger > li button[aria-expanded]').first();
          if (await month.evaluate((e) => e.tagName === 'DETAILS')) { const was = await month.evaluate((d) => (d as HTMLDetailsElement).open); await month.locator('summary').click(); await expect.poll(() => month.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(!was); }
          else { const was = await month.getAttribute('aria-expanded'); await month.click(); await expect(month).not.toHaveAttribute('aria-expanded', was ?? ''); }
        } });

      // Board on the day the season completes: the season review is dated today (verdict) and may carry a contract offer.
      if (facts.verdictToday) {
        reached('CLB-05a', '/career/board', `${why('season-complete')}: season review ${String(facts.verdictToday)} dated the last matchday`);
        await verifyVerdict(p);
      }
      if (facts.decision) {
        reached('CLB-05b', '/career/board', `${why('season-complete')}: open ${String(facts.decision)} decision after the season review`);
        await verifyMeeting(p);
      }
      if (Array.isArray(facts.injured) && facts.injured.length && !results['MED-01a']) {
        reached('MED-01a', '/career/medical', `${why('season-complete')}: ${facts.injured.length} own player(s) injured`);
        await verifyMedical(p);
      }

      // ---- The season transition (UI): "Börja säsong …" on the front page.
      await p.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await p.goto(`${base}/career`); await shellReady(p); await settle(p);
      if (await p.locator('.hm-curtain').count()) await p.locator('.hm-curtain-top').getByRole('button', { name: 'Hoppa över' }).click();
      const startBtn = p.getByRole('button', { name: /^Börja säsong \d{4}\/\d{2}/ }).or(p.getByRole('button', { name: /Börja nästa säsong/ })).first();
      let transitioned = false;
      await check('MGR-02', '/career (season transition)', 'season transition via the front page button', DESKTOP, async () => {
        await expect(startBtn).toBeVisible({ timeout: 30000 });
        await startBtn.click();
        const y = Number(manifest['season-complete']!.seasonId.slice(0, 4)) + 1;
        const next = `${y}/${String(y + 1).slice(-2)}`;
        transitioned = await expect(p.locator('header.hm-header')).toContainText(next, { timeout: 180000 }).then(() => true, () => false);
        if (!transitioned) throw new Error(`season transition did not apply: ${(await p.locator('[role=alert]').allInnerTexts()).join(' | ').slice(0, 400)}`);
        await saveNow(p);
      });
      if (!transitioned) {
        for (const id of ['MGR-02', 'CMP-01f']) notReachable(id, '-', 'the season transition did not apply in the UI (see MGR-02 check error)');
      } else {
        reached('MGR-02', '/career/history', `${why('season-complete')}, then "Börja säsong" on the front page (attemptSeasonTransition), saved`);
        await verify(p, { id: 'MGR-02', route: '/career/history', url: '/career/history',
          present: async (pg) => { await V(pg, '.sb-page .sb-hubtabs[role=tablist]'); await V(pg, 'article.sb-cover'); await expect(pg.locator('#sb-cover-title')).toHaveText(/\d{4}\/\d{2}/); await A(pg, '.sb-cover .sb-cover-pos'); },
          actName: 'Season Book part Matcher (tab)', act: async (pg) => { const t = pg.getByRole('tablist', { name: 'Säsongsbokens delar' }).getByRole('tab', { name: 'Matcher' }); await t.click(); await expect(t).toHaveAttribute('aria-selected', 'true'); await expect(pg.locator('.sb-inside').getByRole('button', { name: /^Säsongen \d{4}\/\d{2}$/ })).toBeVisible(); } });
        const league = 'swe-2'; // the archived season was played in Allsvenskan (the prepared career's league)
        reached('CMP-01f', `/career/competitions/${league}?tab=history`, `${why('season-complete')}, then "Börja säsong" (season archived)`);
        await verify(p, { id: 'CMP-01f', route: `/career/competitions/${league}?tab=history`, url: `/career/competitions/${league}?tab=history`,
          present: async (pg) => { await V(pg, 'ol.cc-honours li'); await expect(pg.locator('ol.cc-honours li').first()).toContainText(/\d{4}\/\d{2}/); },
          actName: "'Säsongen →' opens that season's book", act: async (pg) => { await pg.locator('ol.cc-honours li a.cc-honour-link').first().click(); await expect(pg).toHaveURL(/\/career\/history\?season=/); await expect(pg.locator('article.sb-cover')).toBeVisible(); } });

        await nextSeasonFlows(p);
      }
      await c.context.close();
    });

    // ---------------- Mid-season snapshots
    await test.step('injury', async () => {
      if (results['MED-01a']?.checks.length || (ONLY && !ONLY.test('MED-01a|MDY-01b'))) return;
      const c = await open('injury');
      if (!c) { notReachable('MED-01a', '/career/medical', 'no own player was injured during the prepared season'); return; }
      reached('MED-01a', '/career/medical', why('injury'));
      await verifyMedical(c.page);
      await c.context.close();
    });
    await test.step('incoming bid', async () => {
      if (ONLY && !ONLY.test('REC-05')) return;
      const c = await open('incoming-bid');
      if (!c) { notReachable('REC-05', '/career/transfers/offers/[offerId]', 'no incoming bid for an own player arrived during the prepared season'); notReachable('REC-05a', '/career/transfers/offers/[offerId]', 'no incoming bid, so no sale'); return; }
      await incomingBidFlows(c.page);
      await c.context.close();
    });
    for (const name of Object.keys(manifest).filter((n) => n.startsWith('verdict-'))) {
      if (results['CLB-05a']?.checks.some((x) => x.passed)) break;
      await test.step(`verdict ${name}`, async () => {
        if (ONLY && !ONLY.test('CLB-05a')) return;
        const c = await open(name); if (!c) return;
        reached('CLB-05a', '/career/board', why(name));
        await verifyVerdict(c.page);
        await c.context.close();
      });
    }
    await test.step('board decision', async () => {
      if (results['CLB-05b']?.checks.some((x) => x.passed) || (ONLY && !ONLY.test('CLB-05b'))) return;
      const c = await open('board-decision');
      if (!c) { if (!results['CLB-05b']) notReachable('CLB-05b', '/career/board', 'no board warning or contract offer was open during the prepared season'); return; }
      reached('CLB-05b', '/career/board', why('board-decision'));
      await verifyMeeting(c.page);
      await c.context.close();
    });
    await test.step('suspended matchday', async () => {
      if (ONLY && !ONLY.test('MDY-02k|MDY-01b')) return;
      const c = await open('suspended-matchday');
      if (!c) { notReachable('MDY-02k', '/career/match-day/[fixtureId]', 'the manager was not suspended during the prepared season'); return; }
      await squadWarningFlow(c.page, 'suspended-matchday');
      await suspendedMatch(c.page);
      await c.context.close();
    });
    if (!results['MDY-01b']?.checks.length) {
      await test.step('matchday squad warnings (fallback state)', async () => {
        if (ONLY && !ONLY.test('MDY-01b')) return;
        const name = ['injury', 'incoming-bid', ...Object.keys(manifest)].find((n) => manifest[n] && !/season-complete/.test(n));
        const c = name ? await open(name) : null;
        if (!c) { notReachable('MDY-01b', '/career/match-preview', 'no prepared mid-season career'); return; }
        await continueUntil(c.page, async () => { await c.page.goto(`${base}/career/match-preview`); await shellReady(c.page); return c.page.getByRole('button', { name: 'STARTA MATCH →' }).isVisible(); }, 12, 'to-matchday', { playMatches: false });
        await squadWarningFlow(c.page, name!);
        await c.context.close();
      });
    }
  } finally {
    for (const c of opened) await c.close().catch(() => {});
    console.log(`[states] total ${Math.round((Date.now() - t0) / 1000)} s`);
    writeResults();
  }
  const failed = Object.entries(results).filter(([, r]) => !r.passed && !r.reason).map(([id, r]) => `${id}: ${r.checks.filter((x) => !x.passed).map((x) => `${x.name}@${x.viewport}: ${x.error}`).join(' | ')}`);
  expect(failed, 'surfaces with failed checks (see states-results.json)').toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
/** An open decision's meeting takes precedence on arrival; the verdict moment plays once it is closed. */
async function closeMeetingFirst(pg: Page) {
  await pg.waitForTimeout(500);
  if (await pg.locator('.bm-meeting').isVisible().catch(() => false)) { await pg.getByRole('button', { name: 'Stäng mötet' }).click(); await expect(pg.locator('.bm-meeting')).toHaveCount(0); }
}
async function verifyVerdict(p: Page) {
  await verify(p, { id: 'CLB-05a', route: '/career/board', url: '/career/board',
    present: async (pg) => {
      await closeMeetingFirst(pg);
      await V(pg, '.bm-verdict');
      await A(pg, '.bm-verdict .bm-stamp');
      await expect(pg.locator('.bm-verdict .bm-stamp')).toHaveText(/Nöjd|Godkänt|Oroad|Varning|Avsked/);
      await A(pg, '.bm-verdict-actions button');
    },
    actAt: 'all', actName: 'close the verdict moment → the stamp stays as the band', act: async (pg) => {
      await closeMeetingFirst(pg);
      await V(pg, '.bm-verdict');
      await pg.locator('.bm-verdict-actions button').last().click();
      await expect(pg.locator('.bm-verdict')).toHaveCount(0);
      await V(pg, 'header.bm-band .bm-stamp');
      expect(await overflow(pg)).toBeLessThanOrEqual(1);
    } });
}
async function verifyMeeting(p: Page) {
  await verify(p, { id: 'CLB-05b', route: '/career/board', url: '/career/board',
    present: async (pg) => {
      // The meeting opens once per session on arrival; the pinned decision reopens it.
      const meeting = pg.locator('.bm-meeting');
      if (!(await meeting.isVisible().catch(() => false))) await pg.locator('section.bm-pinned button').first().click();
      await expect(meeting).toBeVisible();
      await A(pg, '.bm-meeting .bm-statement');
      expect(await pg.locator('.bm-options .bm-option').count()).toBeGreaterThanOrEqual(1);
      await A(pg, '.bm-options .bm-option .bm-delta, .bm-options .bm-option ul, .bm-options .bm-option p');
    },
    actAt: 'all', actName: 'choose an option → confirm step (not confirmed), then close', act: async (pg) => {
      const meeting = pg.locator('.bm-meeting');
      if (!(await meeting.isVisible().catch(() => false))) await pg.locator('section.bm-pinned button').first().click();
      await pg.locator('.bm-options .bm-option').first().click();
      await V(pg, '.bm-confirm');
      await A(pg, '.bm-confirm-actions button');
      expect(await overflow(pg)).toBeLessThanOrEqual(1);
      await pg.keyboard.press('Escape');
    } });
}
async function verifyMedical(p: Page) {
  await verify(p, { id: 'MED-01a', route: '/career/medical', url: '/career/medical', fresh: false,
    present: async (pg, vp) => {
      await V(pg, 'ul.md-cards li.md-card');
      await V(pg, 'ul.md-cards li.md-card .md-steps');
      await expect(pg.getByRole('progressbar', { name: /Rehabilitering/ }).first()).toBeAttached();
      await expect(pg.locator('ul.md-cards li.md-card table')).toHaveCount(0);
      if (!isPhone(vp)) await A(pg, '.md-card .md-steps li');
    },
    actName: 'player name opens the dossier', act: async (pg) => { await pg.locator('ul.md-cards li.md-card a[href*="/career/squad/"]').first().click(); await expect(pg).toHaveURL(/\/career\/squad\//); } });
}

/** MDY-01b: trim the match squad in Taktik (the manager's own selection), then STARTA MATCH asks to confirm. */
async function squadWarningFlow(p: Page, state: string) {
  const R = '/career/match-preview';
  await p.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await p.goto(`${base}/career/match-preview`); await shellReady(p); await settle(p);
  const start = p.getByRole('button', { name: 'STARTA MATCH →', exact: true });
  if (!(await start.isVisible().catch(() => false))) { notReachable('MDY-01b', R, `no matchday in prep snapshot "${state}"`); return; }
  if (await start.isDisabled()) { await chooseStartingSeven(p, base); }
  // Taktik: take every substitute out of the match squad (the 'Ej uttagna' strip), which leaves a legal but risky squad.
  await p.goto(`${base}/career/tactics`); await expect(p.locator('.coach-preparation')).toBeVisible({ timeout: 90000 });
  const removed = await trimBench(p);
  await saveNow(p);
  await p.goto(`${base}/career/match-preview`); await shellReady(p); await settle(p);
  const dialogFor = async (pg: Page) => { await pg.getByRole('button', { name: 'STARTA MATCH →', exact: true }).click(); const d = pg.locator('dialog.hm-dialog[data-tone="warning"]'); await expect(d).toBeVisible({ timeout: 10000 }); return d; };
  const probe = await dialogFor(p).then(() => true, () => false);
  if (!probe) { notReachable('MDY-01b', R, `squad check raised no warnings after trimming the bench (${removed} removed)`); return; }
  reached('MDY-01b', R, `${state ? `prep snapshot "${state}" (matchday)` : ''}; in Taktik the manager took ${removed} substitute(s) out of the match squad (real selection), saved; STARTA MATCH → raises the squad check`);
  await verify(p, { id: 'MDY-01b', route: R, url: '/career/match-preview', fresh: false,
    present: async (pg) => {
      const d = await dialogFor(pg);
      await expect(d.locator('ul.md-fixes li').first()).toBeVisible();
      await A(pg, 'dialog.hm-dialog ul.md-fixes li a[href*="/career/tactics"]');
      await expect(d.getByRole('button', { name: 'Avbryt', exact: true })).toBeVisible();
    },
    actAt: 'all', actName: 'Avbryt closes without starting', act: async (pg) => {
      const d = await dialogFor(pg);
      expect(await overflow(pg)).toBeLessThanOrEqual(1);
      await d.getByRole('button', { name: 'Avbryt', exact: true }).click();
      await expect(d).toHaveCount(0);
      await expect(pg).toHaveURL(/\/career\/match-preview/);
    } });
}
async function trimBench(p: Page): Promise<number> {
  // The squad strip lists the 16 registered players; bench players have a remove control.
  let removed = 0;
  for (let i = 0; i < 12; i++) {
    const rm = p.locator('.tb-strip .tb-strip-slots li button[aria-label^="Ta bort"], .tb-strip .tb-strip-slots li button[aria-label*="ur matchtruppen"]').first();
    if (!(await rm.isVisible().catch(() => false))) break;
    await rm.click(); removed++;
    await p.waitForTimeout(150);
  }
  return removed;
}

/** MDY-02k: the suspended manager's matchday, the match started live; the assistant leads. */
async function suspendedMatch(p: Page) {
  const L = '/career/match-day/[fixtureId] (manager suspended)';
  await p.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await p.goto(`${base}/career/match-preview`); await shellReady(p); await settle(p);
  const start = p.getByRole('button', { name: /STARTA MATCH →|FORTSÄTT MATCH →/ });
  if (!(await start.isVisible().catch(() => false))) { notReachable('MDY-02k', L, 'no match to start on the suspended matchday'); return; }
  if (await start.isDisabled()) { await chooseStartingSeven(p, base); await p.goto(`${base}/career/match-preview`); await shellReady(p); }
  await start.click();
  const d = p.locator('dialog.hm-dialog[data-tone="warning"]');
  if (await d.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)) await d.getByRole('button', { name: 'Starta matchen', exact: true }).click();
  else { const confirm = p.getByRole('button', { name: 'Starta matchen', exact: true }); if (await confirm.isVisible().catch(() => false)) await confirm.click(); }
  await p.waitForURL('**/career/match-day/**', { timeout: 60000 });
  await expect(p.locator('.mc-match')).toBeVisible({ timeout: 60000 });
  const url = new URL(p.url()).pathname;
  await saveNow(p);
  reached('MDY-02k', L, `${why2('suspended-matchday')}; STARTA MATCH → (live)`);
  await verify(p, { id: 'MDY-02k', route: L, url, fresh: false,
    present: async (pg) => {
      await expect(pg.locator('.mc-match')).toBeVisible({ timeout: 60000 });
      const dock = pg.getByRole('status', { name: 'Vem leder laget' });
      await expect(dock).toBeAttached({ timeout: 30000 });
      if (await dock.isHidden()) { const t = pg.getByRole('button', { name: /Bänken|Dina matchbeslut|Visa bänken/ }).first(); if (await t.isVisible().catch(() => false)) await t.click(); }
      await expect(dock).toHaveAttribute('data-readonly', 'true');
      await expect(dock.locator('.mc-assistant-head b')).toContainText('leder laget');
      await expect(dock).toContainText('avstängd av Disciplinnämnden');
      for (const k of ['Försvar', 'Aggressivitet', 'Tempo', 'Anfall', 'Rotation']) await expect(dock.locator('dl.mc-assistant-tactics dt', { hasText: k })).toHaveCount(1);
      await expect(pg.locator('aside.mc-dock[aria-label="Dina matchbeslut"]')).toHaveCount(0);
      // The banner above the match says who leads from the bench; it must be legible (WCAG AA 4.5:1).
      const banner = pg.locator('p.mday-banner');
      await expect(banner).toContainText('leder laget från bänken');
      const ratio = await banner.evaluate((el) => {
        const rgb = (c: string) => (/rgba?\((\d+), (\d+), (\d+)/.exec(c) ?? []).slice(1, 4).map(Number);
        const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
        const cs = getComputedStyle(el); const a = lum(rgb(cs.color)), b = lum(rgb(cs.backgroundColor));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(ratio, 'assistant banner text/background contrast').toBeGreaterThanOrEqual(4.5);
    },
    actName: 'Spela: the match runs while the dock stays read-only (no timeout or substitution command)', act: async (pg) => {
      await expect(pg.locator('.mc-match')).toBeVisible({ timeout: 60000 });
      const play = pg.getByRole('button', { name: 'Spela', exact: true });
      if (await play.isVisible().catch(() => false)) await play.click();
      await expect(pg.locator('.mc-match')).toHaveAttribute('data-flow-phase', /live|huddle|halftime/, { timeout: 30000 });
      const dock = pg.getByRole('status', { name: 'Vem leder laget' });
      await expect(dock.getByRole('button')).toHaveCount(0);
      await expect(pg.getByRole('button', { name: 'Timeout', exact: true })).toHaveCount(0);
    } });
}
const why2 = (name: string) => manifest[name] ? `${manifest[name]!.why} -- prep snapshot "${name}" @${manifest[name]!.gameDate}, imported via Inställningar → Data` : '';

/** REC-05 / REC-05a: the incoming bid, then accept → the player decides → confirm → farewell. */
async function incomingBidFlows(p: Page) {
  const st = manifest['incoming-bid']!;
  const offers = (st.facts.offers ?? []) as { id: string; playerId: string }[];
  const offerId = offers[0]!.id;
  const R = '/career/transfers/offers/[offerId]';
  const url = `/career/transfers/offers/${encodeURIComponent(offerId)}`;
  reached('REC-05', R, why2('incoming-bid'));
  await verify(p, { id: 'REC-05', route: R, url, fresh: false,
    present: async (pg, vp) => {
      await V(pg, '.tx-offer');
      await expect(pg.getByRole('region', { name: 'Pengarna' })).toBeVisible();
      // Money and squad side by side; on the phone one at a time behind the Pengar / Truppen tabs.
      if (isPhone(vp)) { const tabs = pg.getByRole('tablist', { name: 'Vad en försäljning innebär' }); await expect(tabs).toBeVisible(); await expect(tabs.getByRole('tab', { name: 'Pengar' })).toHaveAttribute('aria-selected', 'true'); }
      else { await expect(pg.getByRole('region', { name: 'Truppen' })).toBeVisible(); await A(pg, '.tx-sell-depth .tx-depth-pair'); }
      await V(pg, '.tx-sell-decision');
      await expect(pg.getByRole('button', { name: /Acceptera budet/ })).toBeVisible();
    },
    actAt: 'all', actName: 'Acceptera budet asks to confirm (Ja, acceptera); not confirmed (phone: Truppen tab first)', act: async (pg, vp) => {
      if (isPhone(vp)) { await pg.getByRole('tablist', { name: 'Vad en försäljning innebär' }).getByRole('tab', { name: 'Truppen' }).click(); await expect(pg.getByRole('region', { name: 'Truppen' })).toBeVisible(); await A(pg, '.tx-sell-depth .tx-depth-pair'); }
      await pg.getByRole('button', { name: /Acceptera budet/ }).click();
      await expect(pg.getByRole('button', { name: 'Ja, acceptera' })).toBeVisible();
      expect(await overflow(pg)).toBeLessThanOrEqual(1);
    } });
  // Accept for real, then Continue until the player has decided and the sale can be confirmed / completes.
  await p.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await p.goto(`${base}${url}`); await shellReady(p); await settle(p);
  await p.getByRole('button', { name: /Acceptera budet/ }).click();
  await p.getByRole('button', { name: 'Ja, acceptera' }).click();
  await saveNow(p);
  const status = async () => { await p.goto(`${base}${url}`); await shellReady(p); await settle(p); return (await p.locator('.tx-offer, .pd-offer-page').first().innerText().catch(() => '')).replace(/\s+/g, ' '); };
  let sold = false;
  for (let n = 0; n < 40 && !sold; n++) {
    const s = await status();
    if (/Såld|Tack,/.test(s) || await p.locator('.tx-farewell-next').count()) { sold = true; break; }
    if (/Gick ut|Spelaren sa nej|Avvisat|Avbruten/.test(s)) { console.log(`[sale] ended: ${s.slice(0, 200)}`); break; }
    const confirm = p.getByRole('button', { name: /Bekräfta försäljning/ }).first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
      const yes = p.getByRole('button', { name: 'Ja, sälj', exact: true });
      if (await yes.isVisible({ timeout: 3000 }).catch(() => false)) await yes.click();
      await saveNow(p); continue;
    }
    console.log(`[sale] ${n} ${(await continueOnce(p))}`);
  }
  if (!sold) { notReachable('REC-05a', R, 'the accepted sale did not complete within 40 Continue presses (player refused, window closed or buyer withdrew)'); return; }
  reached('REC-05a', R, `${why2('incoming-bid')}; "Acceptera budet" → "Ja, acceptera" in the offer room (the player accepted his terms the same day), then "Bekräfta försäljning" → "Ja, sälj"`);
  await verify(p, { id: 'REC-05a', route: R, url, fresh: true,
    present: async (pg) => {
      await expect(pg.locator('.tx-moment').or(pg.locator('.tx-farewell-next')).first()).toBeVisible();
      if (await pg.locator('.tx-moment').isVisible().catch(() => false)) { await expect(pg.locator('.tx-moment-headline')).toContainText(/Tack/); await expect(pg.locator('.tx-moment-actions').getByRole('link', { name: /Fyll luckan/ })).toBeVisible(); }
      else await expect(pg.locator('.tx-farewell-next').getByRole('link', { name: /Fyll luckan/ })).toBeVisible();
    },
    actAt: 'all', actName: 'Fyll luckan opens the market filtered to his position', act: async (pg) => {
      const link = pg.locator('.tx-moment-actions, .tx-farewell-next').getByRole('link', { name: /Fyll luckan/ }).first();
      await link.click();
      await expect(pg).toHaveURL(/\/career\/(transfers|players)/);
    } });
}

/** Next season (B): staff negotiation, a scouting sweep reported, a free agent signed. */
async function nextSeasonFlows(p: Page) {
  // ---- STF-03b: offer a contract to a staff candidate on the market.
  const RS = '/career/staff/recruitment?view=negotiations';
  await p.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  // One Continue first: the new season's staff free-agent pool is built on its first processed day. (An offer made
  // to last season's pool on the transition day completes as "Klart" but nobody joins -- see the report.)
  console.log(`[new-season] ${await continueOnce(p)}`);
  // A scout: the scouting desk (REC-01f) needs one, and Tumba starts without.
  await p.goto(`${base}/career/staff/recruitment?role=SCOUT`); await shellReady(p); await settle(p);
  const cand = await p.locator('.sf-market-table tbody td[data-label="Namn"] a').first().getAttribute('href').catch(() => null);
  if (!cand) notReachable('STF-03b', RS, 'no staff candidate on the recruitment market');
  else {
    await p.goto(`${base}${cand}${cand.includes('?') ? '&' : '?'}from=recruitment`); await shellReady(p); await settle(p);
    const offer = p.locator('#sf-deal .st-deal').getByRole('button', { name: /Erbjud kontrakt|Lägg bud på ersättning/ });
    let made = false;
    await check('STF-03b', RS, 'offer a contract from the candidate dossier (real negotiation)', DESKTOP, async () => {
      await expect(offer).toBeVisible({ timeout: 30000 });
      await offer.click();
      await expect(p.locator('#sf-deal .tc-wait, #sf-deal [role=status]').first()).toBeVisible({ timeout: 15000 });
      made = true;
      await saveNow(p);
    });
    if (made) {
      reached('STF-03b', RS, `${why2('season-complete')}, season transition in the UI, then "Erbjud kontrakt" on a market candidate's dossier`);
      await verify(p, { id: 'STF-03b', route: RS, url: '/career/staff/recruitment?view=negotiations', fresh: false,
        present: async (pg, vp) => {
          await expect(pg.getByRole('tab', { name: /^Förhandlingar/ })).toHaveAttribute('aria-selected', 'true');
          await V(pg, 'section.sf-board');
          if (!isPhone(vp)) expect(await pg.locator('section.sf-board .sf-board-col').count()).toBe(3);
          await A(pg, 'section.sf-board .sf-board-col li a');
        },
        actAt: 'all', actName: 'negotiation opens the profile', act: async (pg) => { await pg.locator('section.sf-board .sf-board-col li a').first().click(); await expect(pg).toHaveURL(/\/career\/staff\//); } });
    }
  }

  // ---- REC-01f: start a scouting sweep and Continue until it reports discoveries.
  const RC = '/career/scouting';
  const hasDisc = async () => { await p.goto(`${base}/career/scouting`); await shellReady(p); await settle(p); return (await p.locator('.sd-disc table tbody tr, .sd-disc .sd-card').count()) > 0; };
  const scouts = async () => { await p.goto(`${base}/career/scouting`); await shellReady(p); await settle(p); return p.locator('ul.sd-scouts > li:not(.sd-scout-ghost)').count(); };
  let sweepNote = '';
  if (!(await hasDisc())) {
    // The scout offered a contract above (STF-03b) answers the next day. A counter comes back pre-filled in his
    // dossier's deal panel: meet it with the same "Erbjud kontrakt" / "Lägg bud på ersättning". Continue until he joins.
    for (let n = 0; n < 25 && cand && (await scouts()) === 0; n++) {
      await p.goto(`${base}${cand}${cand.includes('?') ? '&' : '?'}from=recruitment`); await shellReady(p); await settle(p);
      const deal = p.locator('#sf-deal .st-deal');
      const again = deal.getByRole('button', { name: /Erbjud kontrakt|Lägg bud på ersättning/ });
      if (await deal.locator('.tc-wait').isVisible().catch(() => false)) console.log(`[scout-hire] ${n} ${await continueOnce(p)}`);
      else if (await again.isVisible().catch(() => false)) {
        console.log(`[scout-hire] ${n} answer: ${(await deal.locator('.tc-stance').innerText().catch(() => '-')).replace(/\s+/g, ' ').slice(0, 160)} -> offer again (pre-filled)`);
        await again.click(); await saveNow(p);
      } else { console.log(`[scout-hire] ${n} no open negotiation: ${(await deal.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(-200)}`); console.log(`[scout-hire] ${n} ${await continueOnce(p)}`); }
    }
    if ((await scouts()) === 0) sweepNote = 'no scout joined the club within 25 rounds of answering his negotiation and Continue, so no sweep could be started';
    else {
      // STF-03b again, now with the hire in "Klar": the closed column names the person and links to his profile.
      if (results['STF-03b']?.checks.some((x) => x.passed)) {
        await p.goto(`${base}/career/staff/recruitment?view=negotiations`); await shellReady(p); await settle(p);
        await check('STF-03b', RS, 'completed hire in Klar names the person and opens his profile', DESKTOP, async () => {
          const done = p.locator('section.sf-board .sf-board-col[data-col="DONE"] li a').first();
          await expect(done).toBeVisible();
          await expect(done.locator('b')).not.toHaveText(/^fa-staff:/);
          await done.click();
          await expect(p.locator('.sf-dossier aside.sf-id h1')).toBeVisible();
        });
        await p.screenshot({ path: `${shots}/STF-03b-done-desktop.png` }).catch(() => {});
      }
      await p.goto(`${base}/career/scouting`); await shellReady(p); await settle(p);
      const tile = p.locator('.sd-cov .sd-tile').first();
      await tile.scrollIntoViewIfNeeded(); await tile.click();
      const go = p.locator('.sd-cov-config').getByRole('button', { name: 'Starta svep' });
      if (await go.isEnabled({ timeout: 10000 }).catch(() => false)) {
        await go.click(); await saveNow(p);
        console.log('[scouting] sweep started');
        await continueUntil(p, hasDisc, 40, 'scouting');
      } else sweepNote = `'Starta svep' disabled: ${(await p.locator('.sd-cov-config').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}`;
    }
  }
  if (!(await hasDisc())) notReachable('REC-01f', RC, sweepNote || 'the coverage sweep reported no discoveries within 40 Continue presses');
  else {
    reached('REC-01f', RC, `${why2('season-complete')}, season transition; a scout hired from the staff market (Erbjud kontrakt, Continue until he joined), a coverage sweep started on the scouting desk (tile → Starta svep) and Continue until its discoveries arrived`);
    await verify(p, { id: 'REC-01f', route: RC, url: '/career/scouting', fresh: false,
      present: async (pg) => { await A(pg, '.sd-disc .sd-filters'); await A(pg, '.sd-disc table.sd-table tbody tr'); await A(pg, '.sd-disc tbody tr .sd-rank'); await A(pg, '.sd-disc .sd-sort select'); },
      actName: 'sort newest', act: async (pg) => { await pg.locator('.sd-disc .sd-sort select').selectOption('NEWEST'); await expect(pg.locator('.sd-disc .sd-sort select')).toHaveValue('NEWEST'); } });
  }
  // ---- REC-04c / REC-04e: a free agent ('Kontraktslös') signed.
  const RT = '/career/transfers/[freeAgentId]';
  let faSource = '';
  const findFreeAgent = async (): Promise<string> => {
    await p.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await p.goto(`${base}/career/transfers?view=marknad`); await shellReady(p); await settle(p);
    const freeRow = p.locator('.tx-table tr[data-row]', { hasText: 'Kontraktslös' }).first();
    if (await freeRow.count()) {
      await freeRow.click();
      const href = await p.locator('.tx-drawer-actions a[href^="/career/squad/"]').first().getAttribute('href').catch(() => null);
      const id = (href ?? '').split('?')[0]!.split('/').filter(Boolean).pop() ?? '';
      if (id) { faSource = "a 'Kontraktslös' row in Transfers → Hela marknaden"; return id; }
    }
    // Spelarmarknaden's own preset "Fria agenter" (no club, no fee).
    await p.goto(`${base}/career/players`); await shellReady(p); await settle(p);
    const preset = p.locator('.hm-market-presets').getByRole('button', { name: /^Fria agenter/ });
    if (!(await preset.isVisible().catch(() => false))) return '';
    await preset.click();
    await p.waitForTimeout(800);
    const link = await p.locator('.hm-market-table tbody .game-player-cell a').first().getAttribute('href').catch(() => null);
    faSource = "Spelarmarknaden → preset 'Fria agenter'";
    return (link ?? '').split('?')[0]!.split('/').filter(Boolean).pop() ?? '';
  };
  // Contracts that run out on 31 May make the summer's free agents: Continue past that day if none exist yet.
  let fa = await findFreeAgent();
  if (!fa) await continueUntil(p, async () => !!(fa = await findFreeAgent()), 20, 'free-agents');
  console.log(`[free-agent] ${fa || 'none'} via ${faSource}`);
  if (!fa) { notReachable('REC-04c', RT, "no free agent ('Kontraktslös' / Fria agenter) in the market within 20 Continue presses after the season transition"); notReachable('REC-04e', RT, 'no free agent to sign'); }
  else {
    await p.goto(`${base}/career/transfers/${fa}`); await shellReady(p); await settle(p);
    let opened = false;
    await check('REC-04c', RT, "free agent: 'Öppna förhandlingen →' opens the package builder", DESKTOP, async () => {
      await p.getByRole('button', { name: 'Öppna förhandlingen →' }).click();
      await expect(p.getByRole('radiogroup', { name: 'Kontraktslängd' })).toBeVisible({ timeout: 30000 });
      opened = true;
      await saveNow(p);
    });
    if (opened) {
      reached('REC-04c', RT, `${why2('season-complete')}, season transition in the UI; ${faSource}, 'Öppna förhandlingen →'`);
      await verify(p, { id: 'REC-04c', route: RT, url: `/career/transfers/${fa}`, fresh: false,
        present: async (pg) => {
          await expect(pg.getByRole('radiogroup', { name: 'Kontraktslängd' })).toBeVisible();
          await expect(pg.getByRole('radiogroup', { name: 'Kontraktslängd' }).getByRole('radio')).toHaveCount(5);
          await expect(pg.getByRole('combobox', { name: 'Utlovad roll' })).toBeVisible();
          await A(pg, '.tx-impact .tx-total [data-k="total"]');
        },
        actAt: 'all', actName: 'years 4 updates the total over the contract', act: async (pg) => {
          const years = pg.getByRole('radiogroup', { name: 'Kontraktslängd' });
          const total0 = await pg.locator('.tx-impact .tx-total [data-k="total"]').first().innerText();
          const target = (await years.getByRole('radio', { name: '4', exact: true }).getAttribute('aria-checked')) === 'true' ? '2' : '4';
          await years.getByRole('radio', { name: target, exact: true }).click();
          await expect(years.getByRole('radio', { name: target, exact: true })).toHaveAttribute('aria-checked', 'true');
          await expect(pg.locator('.tx-impact .tx-total [data-k="total"]').first()).not.toHaveText(total0);
          expect(await overflow(pg)).toBeLessThanOrEqual(1);
        } });
      // Submit the terms and Continue until the player answers; a signed deal shows the floodlight moment once.
      await p.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await p.goto(`${base}/career/transfers/${fa}`); await shellReady(p); await settle(p);
      // A free agent has no current wage, so the package builder starts at 0 €/mån (reported). The manager's offer:
      // a tenth of the wage room the budget panel shows (Lönerum), rounded to 50 €.
      const room = Number(((await p.locator('.tx-impact').first().innerText().catch(() => '')).match(/LÖNERUM\s*([\d\s  ]+)/i)?.[1] ?? '').replace(/\D/g, '')) || 0;
      const offerWage = Math.max(500, Math.round(room / 10 / 50) * 50);
      const wageInput = p.getByLabel(/^Lön \(.*\/mån\)$/).first();
      if (await wageInput.isVisible().catch(() => false)) { await wageInput.fill(String(offerWage)); await wageInput.press('Tab'); }
      console.log(`[signing] wage room ${room} → offer ${offerWage}/mån`);
      const submit = p.getByRole('button', { name: /^(Lägg fram villkoren|Lägg budet|Skicka)/ }).first();
      if (await submit.isVisible().catch(() => false)) { await submit.click(); await saveNow(p); }
      let signed = false;
      for (let n = 0; n < 25 && !signed; n++) {
        await p.goto(`${base}/career/transfers/${fa}`); await shellReady(p); await settle(p);
        if (await p.locator('.tx-moment').count()) { signed = true; break; }
        const roomText = (await p.locator('.tx-room').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
        if (/Avbruten|sa nej|tackade nej|Gick ut|tappat intresset/i.test(roomText) || await p.getByRole('button', { name: 'Öppna förhandlingen →' }).isVisible().catch(() => false)) { console.log(`[signing] ended without a deal: ${roomText.slice(0, 300)}`); break; }
        // A counter from the player: meet it (the room's own "Möt lönekravet" action), else resubmit the terms.
        const meet = p.locator('button.tx-meet').first();
        if (await meet.isVisible().catch(() => false)) { console.log(`[signing] meet: ${(await meet.innerText()).replace(/\s+/g, ' ')}`); await meet.click(); await saveNow(p); continue; }
        const again = p.getByRole('button', { name: /^Lägg fram villkoren/ }).first();
        if (await again.isVisible().catch(() => false)) { await again.click(); await saveNow(p); continue; }
        console.log(`[signing] ${n} ${(await continueOnce(p))}`);
      }
      if (!signed) notReachable('REC-04e', RT, 'the free agent did not sign within 25 Continue presses');
      else {
        reached('REC-04e', RT, `${why2('season-complete')}, season transition; free agent terms submitted in the package builder, Continue until he signed`);
        await verify(p, { id: 'REC-04e', route: `${RT} (signed)`, url: `/career/transfers/${fa}`, fresh: true,
          present: async (pg) => { await V(pg, '.tx-moment'); await expect(pg.locator('.tx-moment-headline')).not.toBeEmpty(); await V(pg, '.tx-moment-skip'); await A(pg, '.tx-moment-actions a, .tx-moment-actions button'); },
          actAt: 'all', actName: 'Hoppa över (Esc) closes; deal completion stays underneath', act: async (pg) => {
            await V(pg, '.tx-moment'); expect(await overflow(pg)).toBeLessThanOrEqual(1);
            await pg.keyboard.press('Escape');
            await expect(pg.locator('.tx-moment')).toHaveCount(0);
            await expect(pg.locator('.tx-room, .tx-done, main').first()).toBeVisible();
          } });
      }
    }
  }

}
