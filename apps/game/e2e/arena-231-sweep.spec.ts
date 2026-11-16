// Arena 231 sweep: automated visual/functional verification of the 231 redesigned surfaces
// (design-lab/experience-2027/club-identity/arena-231-status.json). Real career, no mocks:
//   1. a fresh Swedish career (Tumba, starts at the first competitive match) -- entry surfaces on the way;
//   2. pre-match surfaces (front page on matchday, tactics guard, match preview);
//   3. one league match played live: walk-out, live views, timeout huddle, half-time briefing, final whistle, report;
//   4. every player-facing route at 1440x900, 900x1000 and 375x812: no pageerror, no horizontal overflow, the
//      recommended structure of every surface hosted there (selectors read from the component source) and one
//      cheap real interaction per surface where possible; a desktop and a phone screenshot per route;
//   5. states reachable within minutes (Continue overlay, empty/locked contexts, a pre-season career, resigning).
// Internal tools (/editor, /scenario-lab, /match-qa, cpu-recruitment) must be gated off (404) in this build.
// Every check is named with its surface ID; results go to <HM_QA_SCREENSHOT_DIR>/sweep-results.json.
// Surfaces whose state cannot be reached are recorded passed:false with reason "state not reachable in sweep".
//
// Iteration aids (optional): HM_SWEEP_SAVE_STATE=<file> stores the post-match browser state;
// HM_SWEEP_STATE=<file> resumes from it (skips creation + live match); HM_SWEEP_ONLY=<regex> limits the route sweep.
import { test, expect as baseExpect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chooseStartingSeven, enterCareerAfterLoad, newGameToManagerStep, openReplay, readyStartMatch, setMatchSpeed, showCourt2D } from './matchPrep';

const expect = baseExpect.configure({ timeout: 15000 });
const base = process.env.HM_QA_URL ?? 'http://localhost:3001';
const shots = process.env.HM_QA_SCREENSHOT_DIR ?? 'C:/DEV/QA/reports/arena-231/sweep';
const code = process.env.HM_QA_ALPHA_ACCESS_CODE?.trim() || 'HBL-ALPHA-2026';
const ONLY = process.env.HM_SWEEP_ONLY ? new RegExp(process.env.HM_SWEEP_ONLY) : null;
const RESUME = process.env.HM_SWEEP_STATE && existsSync(process.env.HM_SWEEP_STATE) ? process.env.HM_SWEEP_STATE : null;
const NOT_REACHABLE = 'state not reachable in sweep';

type VP = { name: 'desktop' | 'tablet' | 'phone'; width: number; height: number };
const VPS: VP[] = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'tablet', width: 900, height: 1000 }, { name: 'phone', width: 375, height: 812 }];
const DESKTOP = VPS[0]!;
const isPhone = (vp: VP) => vp.width <= 760;

// ---------------------------------------------------------------------------------------------------------------
// Result bookkeeping
type Check = { name: string; viewport?: string; passed: boolean; error?: string };
type Result = { route: string; checks: Check[]; passed: boolean; viewports: string[]; reason?: string };
const results: Record<string, Result> = {};
const routeHealth: Record<string, Record<string, { overflow: number; pageErrors: string[]; ok: boolean }>> = {};
const pageErrors: { url: string; message: string }[] = [];

function rec(id: string, route: string): Result {
  const r = (results[id] ??= { route, checks: [], passed: true, viewports: [] });
  if (!r.route.split(' | ').includes(route)) r.route = `${r.route} | ${route}`;
  return r;
}
function short(e: unknown) {
  const lines = String((e as Error)?.message ?? e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const why = [...new Set(lines.filter((l) => /intercepts pointer|not visible|not stable|not enabled|outside of the viewport|detached/.test(l)))].slice(0, 2);
  return [...lines.slice(0, 5), ...why].join(' ⏎ ').slice(0, 800);
}
async function check(id: string, route: string, name: string, vp: VP | null, fn: () => Promise<void>) {
  const r = rec(id, route);
  const label = `${id} ${name}${vp ? ` @${vp.name}` : ''}`;
  try {
    await test.step(label, fn);
    r.checks.push({ name, viewport: vp?.name, passed: true });
  } catch (e) {
    const msg = short(e);
    const m = /UNREACHABLE: ([^⏎]*)/.exec(msg);
    if (m) { r.passed = false; r.reason = `${NOT_REACHABLE}: ${m[1]!.trim()}`; r.checks.push({ name, viewport: vp?.name, passed: false, error: `not reachable: ${m[1]!.trim()}` }); }
    else { r.checks.push({ name, viewport: vp?.name, passed: false, error: msg }); r.passed = false; }
  }
  if (vp && !r.viewports.includes(vp.name)) r.viewports.push(vp.name);
}
/** A surface whose required game state was not reached: recorded as not passed, with the reason. Never a pass. */
function notReachable(id: string, route: string, why: string) {
  const r = rec(id, route);
  r.passed = false;
  r.reason = `${NOT_REACHABLE}: ${why}`;
}
function writeResults() {
  mkdirSync(shots, { recursive: true });
  const ordered = Object.fromEntries(Object.keys(results).sort().map((k) => [k, results[k]]));
  writeFileSync(`${shots}/sweep-results.json`, JSON.stringify(ordered, null, 1));
  writeFileSync(`${shots}/sweep-routes.json`, JSON.stringify({ routeHealth, pageErrors }, null, 1));
}

// ---------------------------------------------------------------------------------------------------------------
// Page helpers
const V = (p: Page, sel: string) => expect(p.locator(sel).first()).toBeVisible();
const A = (p: Page, sel: string) => expect(p.locator(sel).first()).toBeAttached();
const H = (p: Page, sel: string) => expect(p.locator(sel).first()).toBeHidden();
async function shellReady(p: Page) { await expect(p.locator('.hm-shell #manager-content')).toBeVisible({ timeout: 90000 }); }
async function settle(p: Page) { await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(700); }
async function overflow(p: Page) { return p.evaluate(() => document.documentElement.scrollWidth - innerWidth); }
const slug = (s: string) => s.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'title';
const seg = (href: string | null) => (href ?? '').split('?')[0]!.split('#')[0]!.split('/').filter(Boolean).pop() ?? '';

type Surface = {
  id: string;
  /** Recommended structure present (run at every viewport). */
  present: (p: Page, vp: VP) => Promise<void>;
  /** One real interaction (fresh load of the route first). */
  act?: (p: Page, vp: VP) => Promise<void>;
  actName?: string;
  actAt?: 'desktop' | 'phone' | 'all';
  /** Data/state precondition: returns a reason when the state the surface needs does not exist in this career. */
  unreachableIf?: (p: Page) => Promise<string | null>;
};
type RouteDef = { route: string; url: () => string; shell?: boolean; surfaces: Surface[]; ready?: (p: Page) => Promise<void>;
  /** Returns a reason when the dynamic id the route needs could not be collected from the UI. */
  needs?: () => string | null };

async function load(p: Page, def: RouteDef) {
  await p.goto(`${base}${def.url()}`);
  if (def.shell !== false) await shellReady(p);
  await settle(p);
  if (def.ready) await def.ready(p);
}

async function sweepRoute(p: Page, def: RouteDef, vps: VP[] = VPS) {
  if (ONLY && !ONLY.test(def.route)) return;
  const missing = def.needs?.();
  if (missing) { for (const s of def.surfaces) notReachable(s.id, def.route, missing); return; }
  let surfaces = def.surfaces;
  await test.step(`route ${def.route}`, async () => {
    for (const [vi, vp] of vps.entries()) {
      await p.setViewportSize({ width: vp.width, height: vp.height });
      const errBefore = pageErrors.length;
      let loaded = true;
      try { await load(p, def); } catch (e) {
        loaded = false;
        for (const s of def.surfaces) await check(s.id, def.route, 'route loads', vp, async () => { throw e; });
      }
      if (!loaded) continue;
      if (vi === 0) {
        const keep: Surface[] = [];
        for (const s of surfaces) {
          const why = s.unreachableIf ? await s.unreachableIf(p).catch(() => null) : null;
          if (why) notReachable(s.id, def.route, why); else keep.push(s);
        }
        surfaces = keep;
      }
      for (const s of surfaces) await check(s.id, def.route, 'recommended structure present', vp, () => s.present(p, vp));
      const ov = await overflow(p);
      const errs = pageErrors.slice(errBefore).map((e) => e.message);
      const ok = ov <= 1 && errs.length === 0;
      (routeHealth[def.route] ??= {})[vp.name] = { overflow: ov, pageErrors: errs, ok };
      for (const s of surfaces) {
        await check(s.id, def.route, 'no pageerror, no horizontal overflow', vp, async () => {
          expect(errs, `pageerror on ${def.route} @${vp.name}`).toEqual([]);
          expect(ov, `horizontal overflow on ${def.route} @${vp.name}`).toBeLessThanOrEqual(1);
        });
      }
      if (vp.name !== 'tablet') await p.screenshot({ path: `${shots}/${slug(def.route)}-${vp.name}.png`, fullPage: vp.name === 'desktop' }).catch(() => {});
      for (const s of surfaces) {
        if (!s.act) continue;
        const at = s.actAt ?? 'desktop';
        if (at !== 'all' && at !== vp.name) continue;
        const before = pageErrors.length;
        await check(s.id, def.route, s.actName ?? 'interaction', vp, async () => {
          await load(p, def);
          await s.act!(p, vp);
          expect(pageErrors.slice(before).map((e) => e.message), 'pageerror during interaction').toEqual([]);
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Dynamic ids collected from the UI
const ctx = {
  ownPlayers: [] as string[], extPlayer: '', clubId: '', staffId: '', extStaffId: '', storyId: '', pressId: '',
  reportSeg: '', otherReportHref: '', upcomingFixture: '', messageId: '', playedPlayer: '',
};

async function newCareerContext(browser: Browser, storage?: string): Promise<BrowserContext> {
  const origin = new URL(base).origin;
  const context = await browser.newContext(storage
    ? { storageState: storage }
    : { storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'hm_alpha_authorized', value: 'true' }, { name: 'hm_alpha_access_code', value: code }] }] } });
  return context;
}
function watch(page: Page) {
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', (e) => pageErrors.push({ url: page.url(), message: e.message }));
}

async function createCareer(page: Page, opts: { start: string; name: string; record: boolean }) {
  const R = '/new-game (creation)';
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await page.goto(`${base}/new-game`);
  await expect(page.getByRole('heading', { name: 'Välj din hemmaplan.', exact: true })).toBeVisible({ timeout: 60000 });
  if (opts.record) {
    await check('ENT-03', R, 'three-step wizard Klubb · Manager · Kontrakt', DESKTOP, async () => {
      await expect(page.getByRole('navigation', { name: 'Karriärens steg' }).locator('ol.ce-steps li')).toHaveCount(3);
      await expect(page.locator('.ce-steps li[data-active="true"]')).toContainText('Klubb');
      await V(page, '.ce-journal');
    });
    await check('ENT-03d', R, 'club wall: compare a club', DESKTOP, async () => {
      await V(page, '.ce-wall-grid .ce-tile');
      await expect(page.getByRole('group', { name: 'Utmaning' })).toBeVisible();
      await page.locator('.ce-tile').first().locator('button.ce-tile-compare').click();
      await expect(page.locator('.ce-compare .ce-kicker')).toContainText('Jämför · 1 av 3');
      await page.locator('.ce-tile').first().locator('button.ce-tile-compare').click();
    });
    await check('ENT-03a', R, 'Världen drawer opens from the chip', DESKTOP, async () => {
      await page.locator('button.ce-world-chip').click();
      await expect(page.getByRole('dialog', { name: 'Världen' })).toBeVisible();
      await V(page, '.ce-drawer .ce-toggle-list .ce-toggle-row');
    });
    await check('ENT-03b', R, 'league pyramid with kval + Återställ standard', DESKTOP, async () => {
      await expect(page.getByRole('region', { name: 'Ligor i Sverige' })).toBeVisible();
      await A(page, '.ce-pyramid .ce-kval');
      await expect(page.getByRole('button', { name: 'Återställ standard' })).toBeDisabled();
    });
    await check('ENT-03c', R, 'database summary in drawer footer, Klar closes', DESKTOP, async () => {
      await V(page, '.ce-drawer footer.ce-drawer-foot p.ce-num');
      await page.locator('.ce-drawer-foot').getByRole('button', { name: 'Klar' }).click();
      await expect(page.locator('dialog.ce-drawer')).not.toBeVisible();
    });
  }
  await newGameToManagerStep(page);
  await page.getByPlaceholder('För- och efternamn').fill(opts.name);
  if (opts.record) {
    await check('ENT-03e', R, 'accreditation pass updates from inputs', DESKTOP, async () => {
      await expect(page.getByRole('region', { name: 'Tränarpass' })).toBeVisible();
      await expect(page.locator('.ce-byline strong')).toHaveText(opts.name);
      await V(page, 'label.ce-pass-philosophy select');
    });
  }
  await page.getByRole('combobox', { name: 'Nationalitet', exact: true }).selectOption('SWE');
  await page.getByRole('textbox', { name: 'Födelsedatum', exact: true }).fill('1985-04-12');
  await page.getByRole('button', { name: 'Nästa →', exact: true }).click();
  await page.getByRole('radio', { name: opts.start, exact: true }).check();
  if (opts.record) {
    await check('ENT-03f', R, 'contract card with clause chips and signature line', DESKTOP, async () => {
      await V(page, 'section.ce-contract article.ce-contract-doc');
      await V(page, 'footer.ce-signature .ce-signature-line');
      await expect(page.locator('label.ce-chip[data-selected="true"]')).toContainText('Avkast');
      await expect(page.locator('.ce-clause-note')).toContainText('första tävlingsmatchen');
    });
  }
  await page.getByRole('button', { name: 'STARTA KARRIÄR', exact: true }).click();
  if (opts.record) {
    const seen = await page.locator('main.career-initialization.ce-handover').waitFor({ state: 'attached', timeout: 20000 }).then(() => true, () => false);
    if (seen) {
      await check('ENT-12', '/career (layout) & /new-game', 'handover loading screen with club crest and tips', DESKTOP, async () => {
        await A(page, 'aside.career-initialization-club .ce-handover-crest');
        await expect(page.getByRole('complementary', { name: 'Handbollstips' })).toBeAttached();
      });
    } else notReachable('ENT-12', '/career (layout) & /new-game', 'handover screen not observed (career opened too quickly)');
  }
  await page.waitForURL('**/career', { timeout: 120000 });
  await enterCareerAfterLoad(page);
  await shellReady(page);
}

// ---------------------------------------------------------------------------------------------------------------
// Route definitions

const FRONT_PRE: RouteDef = {
  route: '/career', url: () => '/career', surfaces: [
    { id: 'ENT-07', present: async (p, vp) => { if (isPhone(vp)) { await expect(p.locator('nav.hm-rail')).not.toBeInViewport(); await expect(p.locator('aside#hm-sidebar')).not.toHaveAttribute('data-open', 'true'); } else { await expect(p.getByRole('navigation', { name: 'Hubbar', exact: true })).toBeVisible(); await expect(p.locator('nav.hm-rail .hm-rail-link')).toHaveCount(6); } },
      actName: 'key 2 jumps to Laget', act: async (p) => { await p.locator('body').click({ position: { x: 700, y: 5 } }); await p.keyboard.press('2'); await expect(p).toHaveURL(/\/career\/squad$/); await expect(p.getByRole('navigation', { name: 'Laget: flikar' })).toBeVisible(); } },
    { id: 'ENT-07a', present: async (p, vp) => { if (isPhone(vp)) { await expect(p.getByRole('navigation', { name: 'Hubbar (mobil)' })).toBeVisible(); await V(p, '.hm-mobile-dock button.hm-continue-dock'); } else await H(p, '.hm-mobile-dock'); },
      actAt: 'phone', actName: 'Mer opens the hub map', act: async (p) => { await p.getByRole('navigation', { name: 'Hubbar (mobil)' }).getByRole('button', { name: /Mer/ }).click(); await expect(p.locator('aside#hm-sidebar')).toHaveAttribute('data-open', 'true'); } },
    { id: 'ENT-08', present: async (p, vp) => { await V(p, 'section.hm-spine .hm-spine-clock'); await expect(p.locator('.hm-spine-countdown b')).toHaveText('Matchdag'); if (!isPhone(vp)) await V(p, 'header.hm-header button.hm-palette-trigger'); } },
    { id: 'ENT-08a', present: async (p, vp) => { if (!isPhone(vp)) await V(p, 'header.hm-header button.hm-palette-trigger'); else await A(p, 'button.hm-palette-trigger'); },
      actName: 'Ctrl+K → Taktik → Enter', act: async (p) => { await p.keyboard.press('Control+k'); await expect(p.getByRole('dialog', { name: 'Sök och gå till' })).toBeVisible(); await p.keyboard.type('Taktik'); await p.keyboard.press('Enter'); await expect(p).toHaveURL(/\/career\/tactics$/); await expect(p.locator('.hm-palette')).toHaveCount(0); } },
    { id: 'ENT-08b', present: async (p, vp) => { if (isPhone(vp)) await A(p, '.game-save-indicator'); else { await V(p, 'header.hm-header .game-save-indicator[role=status]'); await V(p, 'header.hm-header details.game-save-more'); } },
      actName: '⋯ → Spara nu shows Sparat', act: async (p) => { await p.locator('header.hm-header details.game-save-more summary').click(); await p.locator('header.hm-header .game-save-more-menu').getByRole('button', { name: /Spara nu/ }).click(); await expect(p.locator('header.hm-header .game-save-indicator')).toHaveAttribute('data-phase', 'SAVED'); await expect(p.locator('header.hm-header .game-save-indicator')).toContainText('Sparat'); } },
    { id: 'ENT-10', present: async (p) => { await expect(p.locator('.hm-spine-day')).toHaveCount(7); await expect(p.locator('.hm-spine-day[data-today="true"]')).toHaveCount(1); await expect(p.getByLabel('Härnäst').locator('ol li a').first()).toBeAttached(); } },
    { id: 'ENT-06', present: async (p, vp) => { if (isPhone(vp)) await H(p, 'button.sv-corner-pill'); else await V(p, '.sv-corner[data-scope="career"] button.sv-corner-pill'); },
      actName: 'corner pill reveals Tillbaka till Apps; Escape closes', act: async (p) => { await p.locator('button.sv-corner-pill').click(); await expect(p.locator('[data-starkvis-shell]')).toHaveAttribute('data-revealed', 'true'); await expect(p.locator('a.sv-return')).toHaveText('← Tillbaka till Apps'); await p.keyboard.press('Escape'); await expect(p.locator('[data-starkvis-shell]')).not.toHaveAttribute('data-revealed', 'true'); } },
    { id: 'ENT-11', present: async (p) => { await expect(p.locator('button.alpha-feedback-trigger:visible')).toHaveCount(0); },
      actName: 'F8 opens feedback with Kopiera uppgifterna', act: async (p) => { await p.keyboard.press('F8'); await expect(p.locator('dialog.alpha-feedback-dialog')).toBeVisible(); await expect(p.getByRole('button', { name: 'Kopiera uppgifterna' })).toBeVisible(); await p.locator('dialog.alpha-feedback-dialog').getByRole('button', { name: 'Stäng' }).click(); await expect(p.locator('dialog.alpha-feedback-dialog')).not.toBeVisible(); } },
    { id: 'DSH-01', present: async (p) => { await V(p, 'div.game-home.hm-front article.hm-front-lead'); await expect(p.locator('.hm-front-lead h2')).not.toBeEmpty(); await expect(p.getByRole('heading', { name: 'Att avgöra', exact: true })).toBeVisible(); await expect(p.locator('.hm-front-lead')).toHaveAttribute('data-kind', 'MATCHDAY'); } },
    { id: 'DSH-01a', present: async (p) => { await V(p, 'header.hm-front-masthead .hm-front-nameplate h1'); await expect(p.locator('.hm-front-masthead .game-overline')).toContainText(/vecka/i); } },
    { id: 'DSH-01b', present: async (p) => { await V(p, 'section.hm-mbox[data-matchday="true"]'); await V(p, '.hm-mbox-bug .hm-mbox-side[data-own]'); },
      actName: 'Motståndaren → opens club Peek', act: async (p) => { await p.locator('.hm-mbox-actions').getByRole('button', { name: 'Motståndaren →' }).click(); await expect(p.locator('aside.hm-peek.cc-club-peek[role=dialog]')).toBeVisible(); await p.getByRole('button', { name: 'Stäng snabbtitten' }).click(); await expect(p.locator('aside.cc-club-peek')).toHaveCount(0); } },
    { id: 'DSH-01e', present: async (p) => { await expect(p.locator('.hm-court button.hm-court-spot')).toHaveCount(7); await expect(p.getByRole('group', { name: 'Positionstäckning på planen' })).toBeVisible(); },
      actName: 'tap a position node opens the depth Peek', act: async (p) => { await p.locator('button.hm-court-spot').first().click(); await expect(p.locator('aside.hm-peek.hm-court-peek[role=dialog]')).toBeVisible(); } },
    { id: 'DSH-01f', present: async (p) => { await V(p, 'aside.hm-front-decisions'); await expect(p.locator('.hm-front-decisions ol li .hm-front-num, .hm-front-decisions .hm-front-clear').first()).toBeVisible(); } },
    { id: 'DSH-01h', present: async (p) => { await expect(p.getByRole('heading', { name: 'Från klubben' })).toBeVisible(); await V(p, 'ul.hm-front-ranked li[data-priority] .hm-brief-emblem'); },
      actName: 'brief opens the inbox thread', act: async (p) => { await p.locator('ul.hm-front-ranked li a').first().click(); await expect(p).toHaveURL(/\/career\/inbox/); } },
    { id: 'DSH-01i', present: async (p, vp) => { await A(p, 'section.hm-spine[data-expanded="true"]'); if (!isPhone(vp)) await V(p, '.hm-spine-detail h3'); },
      actName: 'select another day', act: async (p) => { await p.locator('.hm-spine-day button').nth(1).click(); await expect(p.locator('.hm-spine-day').nth(1).locator('button')).toHaveAttribute('aria-pressed', 'true'); } },
    { id: 'DSH-01j', present: async (p) => { await expect(p.locator('header.hm-front-masthead a.hm-front-ear')).toHaveCount(2); await V(p, '.hm-front-ear svg .hm-front-ring'); },
      actName: 'board ear opens the board', act: async (p) => { await p.locator('a.hm-front-ear').first().click(); await expect(p).toHaveURL(/\/career\/(board|manager)/); } },
  ],
};

const TACTICS_PRE: RouteDef = {
  route: '/career/tactics', url: () => '/career/tactics', ready: async (p) => { await expect(p.locator('.coach-preparation')).toBeVisible({ timeout: 90000 }); }, surfaces: [
    { id: 'TRN-02', present: async (p) => { await expect(p.getByRole('list', { name: 'Matchplanens status' }).locator('.tb-ready-chip')).toHaveCount(9); await V(p, '.tb-board-bar'); },
      actName: 'readiness chip Försvar jumps to defence', act: async (p) => { await p.locator('.tb-ready-chip button', { hasText: 'Försvar' }).first().click(); await expect(p.locator('.tb-board-bar')).toHaveAttribute('data-phase', 'DEFENCE'); } },
    { id: 'TRN-02a', present: async (p) => { await V(p, 'section.tb-guard[data-state="warning"]'); await expect(p.getByRole('button', { name: 'Åtgärda – visa förslag' })).toBeVisible(); },
      actName: 'preview the assistant fix as a diff, then Avbryt', act: async (p) => { await p.getByRole('button', { name: 'Åtgärda – visa förslag' }).click(); await V(p, '.tb-guard[data-state="preview"] .tb-guard-slots li'); await p.locator('.tb-guard').getByRole('button', { name: 'Avbryt' }).click(); await V(p, '.tb-guard[data-state="warning"]'); } },
    { id: 'TRN-02b', present: async (p) => { await expect(p.getByRole('grid', { name: /Fas och numerär/ })).toBeVisible(); await expect(p.locator('.tb-matrix .tb-cell[data-static="true"]')).toHaveCount(3); },
      actName: 'switch to Försvar 6 mot 6', act: async (p) => { const c = p.locator('button.tb-cell', { hasText: 'Försvar 6 mot 6' }); await c.click(); await expect(c).toHaveAttribute('aria-pressed', 'true'); await expect(p.locator('.coach-lineup h2')).toContainText('Försvar 6 mot 6'); } },
    { id: 'TRN-02c', present: async (p) => { await expect(p.locator('.tb-matrix .tb-dot[data-state]')).toHaveCount(8); },
      actName: 'open Anfall 6 mot 5', act: async (p) => { await p.locator('button.tb-cell', { hasText: 'Anfall 6 mot 5' }).click(); await expect(p.locator('.coach-lineup h2')).toContainText('Anfall 6 mot 5'); } },
    { id: 'TRN-02d', present: async (p) => { await expect(p.locator('.coach-anchor-pills').getByRole('button', { name: 'Byten & Diff' })).toBeAttached(); },
      actName: 'Byten & Diff shows the pairing court', act: async (p) => { await p.locator('.coach-anchor-pills').getByRole('button', { name: 'Byten & Diff' }).click(); await expect(p.locator('.tb-board-bar')).toHaveAttribute('data-phase', 'EXCHANGES'); await V(p, 'figure.tb-pairing'); await expect(p.locator('.tb-pairing figcaption')).toContainText('par'); } },
    { id: 'TRN-02e', present: async (p) => { await expect(p.getByRole('radiogroup', { name: 'Taktikvisning' })).toBeVisible(); await V(p, '.tb-overlay .tb-legend'); },
      actName: 'Lämplighet overlay legend', act: async (p) => { await p.getByRole('radiogroup', { name: 'Taktikvisning' }).getByRole('radio', { name: 'Lämplighet', exact: true }).click(); await expect(p.locator('.tb-legend')).toContainText('Naturlig roll'); } },
    { id: 'TRN-02f', present: async (p) => { await expect(p.locator('.coach-choice-tradeoff')).toHaveCount(6); await expect(p.locator('.coach-choice-tradeoff').first()).not.toBeEmpty(); } },
    { id: 'TRN-02g', present: async (p) => { await expect(p.locator('#plan-setpieces h2')).toHaveText('Fasta situationer · 7-meter'); await expect(p.locator('#plan-setpieces .tb-penalty-order, #plan-setpieces .hm-plan-note').first()).toBeAttached(); } },
    { id: 'TRN-02h', present: async (p) => { await expect(p.locator('#plan-leadership h2')).toHaveText('Ledarskap & roller'); await expect(p.locator('#plan-leadership .tb-role-effects li')).toHaveCount(3); } },
    { id: 'TRN-02i', present: async (p) => { await expect(p.locator('.tb-strip-slots li')).toHaveCount(16); await V(p, 'section.tb-strip .tb-strip-count'); },
      actName: 'open Ej uttagna drawer', act: async (p) => { await p.locator('.tb-strip details.tb-drawer > summary').click(); await expect(p.locator('.tb-strip details.tb-drawer')).toHaveAttribute('open', ''); } },
  ],
};

const TRAINING_PRE: RouteDef = {
  route: '/career/training (proposal)', url: () => '/career/training', surfaces: [
      { id: 'TRN-01a', present: async (p) => { await expect(p.getByRole('button', { name: 'Be om veckoförslag' }).or(p.locator('.trn-viewswitch'))).toBeAttached(); },
        actName: 'ask for a week proposal → diff grid, then Avböj', act: async (p) => {
          const ask = p.getByRole('button', { name: 'Be om veckoförslag' });
          if (await ask.isVisible()) {
            if (await ask.isDisabled()) throw new Error('UNREACHABLE: no responsible training coach, so no week proposal can be requested');
            await ask.click();
            if (await p.getByText('Veckan är redan genomförd').isVisible().catch(() => false)) throw new Error('UNREACHABLE: the current training week is already completed');
          }
          await V(p, 'section.trn-planner[data-mode="diff"]'); await expect(p.locator('.trn-planner[data-mode="diff"] .trn-legend li')).toHaveCount(4); await V(p, '.trn-day-accept');
          await p.getByRole('button', { name: /Avböj/ }).first().click(); await expect(p.locator('section.trn-planner[data-mode="diff"]')).toHaveCount(0);
        } },
  ],
};

const PREVIEW: RouteDef = {
  route: '/career/match-preview', url: () => '/career/match-preview', surfaces: [
    { id: 'MDY-01', present: async (p) => { await expect(p.locator('nav.md-ritual[aria-label="Matchförberedelse"] li')).toHaveCount(3); await V(p, '#md-step-1.md-step'); await expect(p.getByRole('button', { name: 'STARTA MATCH →', exact: true })).toBeVisible(); },
      actName: 'ritual step 3 link', act: async (p) => { await p.locator('.md-ritual a[href="#md-step-3"]').click(); await expect(p).toHaveURL(/#md-step-3$/); } },
    { id: 'MDY-01a', present: async (p) => { await expect(p.getByRole('region', { name: 'Matchdagen' })).toBeVisible(); await V(p, '.mday-strip-stakes'); },
      actName: 'open table/form expander', act: async (p) => { await p.locator('details.mday-strip-more > summary').click(); await expect(p.locator('details.mday-strip-more')).toHaveAttribute('open', ''); } },
    { id: 'MDY-01c', present: async (p) => { await expect(p.locator('.md-ritual li[data-state]')).toHaveCount(3); await expect(p.locator('.md-ritual li[data-state="block"]')).toHaveCount(0); } },
    { id: 'MDY-01d', present: async (p) => { await expect(p.locator('#md-step-3 h3.md-subhead', { hasText: 'Hot och vårt svar' })).toBeAttached(); await expect(p.locator('#md-step-3').locator('ul.an-threats, div.an-empty').first()).toBeAttached(); } },
    { id: 'MDY-01e', present: async (p) => { await expect(p.locator('figure.md-court .md-court-spots li')).toHaveCount(7); await V(p, '.md-bench'); },
      actName: 'line-up name opens the dossier', act: async (p) => { await p.locator('.md-court-spots a.md-spot-name').first().click(); await expect(p).toHaveURL(/\/career\/squad\//); } },
  ],
};

function postMatchRoutes(): RouteDef[] {
  const own = () => ctx.ownPlayers[0]!;
  const tabBtn = (p: Page, name: string) => p.locator('nav.hm-dossier-tabs').getByRole('button', { name, exact: true });
  return [
    // ---- Entry
    { route: '/', url: () => '/', shell: false, surfaces: [
      { id: 'ENT-02', present: async (p, vp) => { await V(p, 'main.ce-cover .ce-cover-mast .ce-cover-issue'); await V(p, 'button.ce-cover-cta'); await expect(p.locator('button.ce-cover-cta')).toContainText('FORTSÄTT'); await A(p, 'section.ce-cover-briefs'); if (isPhone(vp)) expect(await p.locator('button.ce-cover-cta').evaluate((e) => getComputedStyle(e).position)).toBe('fixed'); await V(p, '.ce-cover-briefs strong.ce-num[data-outcome]'); },
        actName: 'FORTSÄTT opens the career', act: async (p) => { await p.locator('button.ce-cover-cta').click(); await expect(p).toHaveURL(/\/career$/, { timeout: 120000 }); await enterCareerAfterLoad(p); } },
    ] },
    { route: '/new-game', url: () => '/new-game', shell: false, ready: async (p) => { await expect(p.locator('#career-entry-heading')).toHaveText('Välj din hemmaplan.', { timeout: 60000 }); }, surfaces: [
      { id: 'ENT-03', present: async (p, vp) => { await expect(p.locator('ol.ce-steps li')).toHaveCount(3); await V(p, 'button.career-entry-next'); if (!isPhone(vp) && vp.width > 1100) await V(p, '.ce-journal'); } },
      { id: 'ENT-03a', present: async (p) => { await V(p, 'button.ce-world-chip'); },
        actAt: 'all', actName: 'open Världen drawer (sheet on phone)', act: async (p) => { await p.locator('button.ce-world-chip').click(); await expect(p.getByRole('dialog', { name: 'Världen' })).toBeVisible(); await V(p, '.ce-toggle-row'); expect(await overflow(p)).toBeLessThanOrEqual(1); await p.getByRole('button', { name: 'Stäng Världen' }).click(); } },
      { id: 'ENT-03b', present: async (p) => { await A(p, '.ce-drawer section.ce-pyramid'); },
        actAt: 'all', actName: 'pyramid visible in drawer', act: async (p) => { await p.locator('button.ce-world-chip').click(); await expect(p.getByRole('region', { name: 'Ligor i Sverige' })).toBeVisible(); await A(p, '.ce-pyramid .ce-tier'); } },
      { id: 'ENT-03c', present: async (p) => { await A(p, '.ce-drawer footer.ce-drawer-foot'); },
        actAt: 'all', actName: 'footer summary + Klar', act: async (p) => { await p.locator('button.ce-world-chip').click(); await V(p, '.ce-drawer-foot p.ce-num'); await p.locator('.ce-drawer-foot').getByRole('button', { name: 'Klar' }).click(); await expect(p.locator('dialog.ce-drawer')).not.toBeVisible(); } },
      { id: 'ENT-03d', present: async (p) => { await V(p, '.ce-wall-grid .ce-tile'); await V(p, '.ce-tile .ce-meters'); await expect(p.getByRole('group', { name: 'Utmaning' })).toBeVisible(); },
        actAt: 'phone', actName: 'compare a club', act: async (p) => { await p.locator('.ce-tile').first().locator('button.ce-tile-compare').click(); await expect(p.getByRole('region', { name: 'Jämförelse' })).toBeVisible(); } },
      { id: 'ENT-03e', present: async (p) => { await V(p, 'button.career-entry-next'); },
        actAt: 'all', actName: 'step 2 accreditation pass', act: async (p) => { await newGameToManagerStep(p); await expect(p.getByRole('region', { name: 'Tränarpass' })).toBeVisible(); await p.getByPlaceholder('För- och efternamn').fill('Sweep Viewer'); await expect(p.locator('.ce-byline strong')).toHaveText('Sweep Viewer'); expect(await overflow(p)).toBeLessThanOrEqual(1); } },
      { id: 'ENT-03f', present: async (p) => { await V(p, 'button.career-entry-next'); },
        actAt: 'all', actName: 'step 3 contract (not signed)', act: async (p) => { await newGameToManagerStep(p); await p.getByPlaceholder('För- och efternamn').fill('Sweep Viewer'); await p.getByRole('combobox', { name: 'Nationalitet', exact: true }).selectOption('SWE'); await p.getByRole('textbox', { name: 'Födelsedatum', exact: true }).fill('1985-04-12'); await p.getByRole('button', { name: 'Nästa →', exact: true }).click(); await V(p, 'section.ce-contract article.ce-contract-doc'); await V(p, 'footer.ce-signature .ce-signature-line'); expect(await overflow(p)).toBeLessThanOrEqual(1); } },
    ] },
    { route: '/load-game', url: () => '/load-game', shell: false, ready: async (p) => { await expect(p.locator('li.ce-shelf-cover').first()).toBeVisible({ timeout: 60000 }); }, surfaces: [
      { id: 'ENT-04', present: async (p) => { await expect(p.getByRole('list', { name: 'Sparade karriärer' })).toBeVisible(); await V(p, 'a.ce-shelf-cover.ce-shelf-new'); },
        actAt: 'all', actName: 'select a career card shows detail', act: async (p, vp) => { await p.locator('button.ce-shelf-pick').first().click(); await expect(p.locator('button.ce-shelf-pick').first()).toHaveAttribute('aria-pressed', 'true'); await V(p, vp.width > 1100 ? '.ce-spread .ce-spread-cta' : '.ce-shelf-spread-inline'); } },
      { id: 'ENT-04a', present: async (p) => { await A(p, 'li.ce-shelf-cover .ce-danger-ghost'); },
        actAt: 'all', actName: 'delete dialog → Behåll karriären', act: async (p) => { await p.locator('button.ce-shelf-pick').first().click(); await p.locator('li.ce-shelf-cover .ce-danger-ghost').first().click(); await expect(p.locator('dialog.ce-dialog .ce-dialog-warn')).toContainText('Kan inte ångras'); await p.getByRole('button', { name: 'Behåll karriären' }).click(); await expect(p.locator('dialog.ce-dialog')).not.toBeVisible(); } },
    ] },
    { route: '/settings', url: () => '/settings', shell: false, surfaces: [
      { id: 'ENT-05', present: async (p, vp) => { await V(p, 'main.hm-settings-entry.hm-us-page'); if (!isPhone(vp)) { await expect(p.getByRole('radiogroup', { name: 'Täthet' })).toBeVisible(); await expect(p.getByRole('radiogroup', { name: 'Textstorlek' })).toBeVisible(); } else await expect(p.getByRole('navigation', { name: 'Inställningar: avsnitt' })).toBeVisible(); },
        actName: 'Täthet Kompakt applies instantly (restored)', act: async (p) => { await p.getByRole('radiogroup', { name: 'Täthet' }).getByText('Kompakt').click(); await expect(p.locator('html')).toHaveAttribute('data-density', 'compact'); await p.getByRole('radiogroup', { name: 'Täthet' }).getByText('Bekväm').click(); await expect(p.locator('html')).not.toHaveAttribute('data-density', 'compact'); } },
    ] },
    // ---- Front page after the match
    { route: '/career (after match)', url: () => '/career', surfaces: [
      { id: 'DSH-01g', present: async (p) => { await V(p, '.hm-mbox-form ol.hm-formstrip li a[data-outcome]'); },
        actName: 'form tile opens the report', act: async (p) => { await p.locator('ol.hm-formstrip li a').first().click(); await expect(p).toHaveURL(/\/career\/(match-report|fixtures)\//); } },
      { id: 'DSH-01k', present: async (p) => { expect(await p.locator('.hm-mbox-ladder ol li').count()).toBeGreaterThanOrEqual(3); await A(p, '.hm-mbox-ladder li[data-own]'); await expect(p.getByRole('heading', { name: 'Runt ligan' })).toBeVisible(); await A(p, '.hm-front-briefs section[aria-labelledby="hm-front-league-h"] ul li a'); } },
      { id: 'DSH-01', present: async (p) => { await expect(p.locator('.hm-front-lead')).toHaveAttribute('data-kind', /RESULT|PREVIEW|MATCHDAY|BOARD|INJURIES|DEADLINE/); } },
    ] },
    { route: '/career/settings', url: () => '/career/settings', surfaces: [
      { id: 'SYS-01', present: async (p) => { await V(p, 'div.hm-settings.hm-us-page header.hm-us-head h1'); await A(p, 'dl.hm-us-money dt.hm-us-money-club'); },
        actName: 'Rörelse: Minska rörelse (restored)', act: async (p) => { await p.getByRole('radiogroup', { name: 'Rörelse' }).getByText('Minska rörelse').click(); await expect(p.locator('html')).toHaveAttribute('data-motion', 'reduced'); await p.getByRole('radiogroup', { name: 'Rörelse' }).getByText('Följ systemet').click(); } },
    ] },
    // ---- Club
    { route: '/career/klubbhuset → /career/club', url: () => '/career/klubbhuset', surfaces: [
      { id: 'CLB-01', present: async (p, vp) => { await expect(p).toHaveURL(/\/career\/club$/); await V(p, 'header.ch-header'); if (vp.width > 680) await expect(p.locator('.ch-map-toggle')).toBeVisible(); else { await H(p, '.ch-map-toggle'); await V(p, '.ch-chips .ch-chip'); } },
        actAt: 'desktop', actName: 'Visa som karta', act: async (p) => { await p.locator('.ch-map-toggle').click(); await expect(p.locator('.ch-header')).toHaveAttribute('data-map', 'true'); await expect(p.locator('.ch-map-toggle')).toHaveText('Stäng kartan'); } },
      { id: 'CLB-01a', present: async (p, vp) => { if (vp.width > 680) { await V(p, '.ch-pins[role=group] .ch-pin'); await V(p, '.ch-legend'); } else await V(p, '.ch-chips .ch-chip'); },
        actName: 'arrow keys + Enter open the room Peek', act: async (p) => { await p.locator('.ch-pin').first().focus(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); const peek = p.getByRole('dialog'); await expect(peek.locator('.ch-peek-metrics')).toBeVisible(); await expect(peek.getByRole('link', { name: 'Öppna rummet →' })).toBeVisible(); } },
      { id: 'CLB-01b', present: async (p, vp) => { if (vp.width > 680) await V(p, '.ch-pins .ch-pin'); else await V(p, '.ch-chips .ch-chip'); await expect(p.locator('.kh-gallery, .klubbhuset-gallery, .kh-room-card')).toHaveCount(0); },
        actAt: 'phone', actName: 'department chip opens the room', act: async (p) => { await p.locator('.ch-chips .ch-chip').first().click(); await expect(p.getByRole('dialog').locator('.ch-peek-purpose')).toBeVisible(); } },
      { id: 'CLB-01c', present: async (p) => { await V(p, 'section.ca-almanac'); await expect(p.locator('.ca-timeline li[data-current] strong')).toHaveText('Pågår nu'); await expect(p.getByRole('meter', { name: 'Stämningen bland supportrarna' })).toBeAttached(); } },
      { id: 'CLB-02', present: async (p) => { await V(p, '.cj-journal'); await expect(p.locator('figure.cj-history li')).toHaveCount(1); expect(await p.locator('.cj-briefs li').count()).toBeGreaterThanOrEqual(5); await expect(p.locator('.cj-spot')).toHaveCount(7); },
        actName: 'depth court MV', act: async (p) => { await p.locator('.cj-spot').filter({ hasText: 'MV' }).first().click(); await expect(p.locator('.cj-spot[aria-pressed="true"]')).toHaveCount(1); } },
      { id: 'CLB-02a', present: async (p) => { await V(p, 'section.cs-story'); await V(p, '.cs-chips[role=group] button'); },
        actName: 'Matcher chip filters story (?story=)', act: async (p) => { await p.locator('.cs-chips').getByRole('button', { name: 'Matcher' }).click(); await expect(p).toHaveURL(/story=match/); await V(p, '.cs-item[data-kind="match"]'); } },
      { id: 'CLB-02b', present: async (p) => { await V(p, 'section.cj-kpis'); await expect(p.locator('.cj-kpis')).toContainText('Transferbudget'); await A(p, '.cj-kpis figure.cj-mix'); },
        actName: 'Finanscentralen link', act: async (p) => { await p.locator('.cj-kpis').getByRole('link', { name: /Finanscentralen/ }).click(); await expect(p).toHaveURL(/\/career\/finance/); } },
    ] },
    { route: '/career/club/partnerships', url: () => '/career/club/partnerships', surfaces: [
      { id: 'CLB-03', present: async (p) => { await expect(p.locator('.pt-page h1', { hasText: 'Klubbpartnerskap' })).toBeVisible(); await V(p, 'li.pt-card-new'); await V(p, 'details.pt-history'); },
        actName: 'history accordion opens', act: async (p) => { await p.locator('details.pt-history summary').click(); await expect(p.locator('details.pt-history')).toHaveAttribute('open', ''); } },
      { id: 'CLB-03b', unreachableIf: async (p) => (await p.locator('section.pt-placements').count()) ? null : 'no B-team or active development partnership', present: async (p) => { await V(p, 'section.pt-placements h2.pt-h'); await expect(p.locator('section.pt-placements h3.pt-sub')).toContainText('Kan placeras'); await expect(p.locator('section.pt-placements .pt-rows li, section.pt-placements .pt-note').first()).toBeVisible(); } },
      { id: 'CLB-03a', present: async (p) => { await V(p, '.pt-card-new button.hm-btn-primary'); },
        actAt: 'all', actName: 'three-step drawer opens at Sök', act: async (p) => { await p.locator('.pt-card-new').getByRole('button', { name: 'Hitta samarbetsklubb' }).click(); const d = p.getByRole('dialog', { name: 'Ny samarbetsklubb' }); await expect(d.locator('ol.pt-steps li')).toHaveCount(3); await expect(d.locator('.pt-steps li[data-state="current"]')).toHaveText('Sök'); expect(await overflow(p)).toBeLessThanOrEqual(1); } },
    ] },
    { route: '/career/clubs/[clubId]', url: () => `/career/clubs/${ctx.clubId}`, needs: () => ctx.clubId ? null : 'no other club link found on the schedule', surfaces: [
      { id: 'CLB-04', present: async (p) => { await V(p, 'header.cp-portrait'); await V(p, '.cp-headline'); await A(p, 'aside.cp-scout .cp-h2h'); await expect(p.getByRole('meter', { name: 'Kännedom' })).toBeAttached(); await expect(p.locator('.cp-scout').getByRole('button', { name: /Scouta klubben/ })).toBeAttached(); } },
      { id: 'CLB-04a', present: async (p) => { await V(p, 'section.cp-words'); await expect(p.locator('.cp-words .cp-muted', { hasText: 'Läser in' })).toHaveCount(0, { timeout: 30000 }); await expect(p.locator('.cp-words').locator('.cp-lines, .cp-quote, .cp-fog, .cp-muted').first()).toBeVisible(); } },
      { id: 'CLB-02a', present: async (p) => { await V(p, 'section.cs-story'); },
        actName: 'story chips on the other club page', act: async (p) => { await p.locator('.cs-chips button').last().click(); await expect(p).toHaveURL(/story=/); } },
    ] },
    { route: '/career/board', url: () => '/career/board', surfaces: [
      { id: 'CLB-05', present: async (p) => { await V(p, '.bm-page header.bm-band'); await V(p, 'section.bm-strip .bm-meter[role=meter]'); await V(p, '.bm-stage'); await A(p, 'ol.bm-objectives'); await expect(p.locator('#bm-minutes h2', { hasText: 'Protokollet' })).toBeVisible(); },
        actName: "expand a minute shows 'Läget då'", act: async (p) => { await p.locator('#bm-minutes .bm-expand').first().click(); await V(p, '#bm-minutes .bm-then'); } },
    ] },
    { route: '/career/finance', url: () => '/career/finance', surfaces: [
      { id: 'CLB-06', present: async (p) => { await expect(p.locator('.fx-page h1', { hasText: 'Finanscentralen' })).toBeVisible(); await expect(p.locator('section.fx-kpis .fx-kpi')).toHaveCount(3); await A(p, 'details.fx-detail summary'); },
        actName: '?section=wages deep link opens the section', act: async (p) => { await p.goto(`${base}/career/finance?section=wages`); await shellReady(p); await expect(p.locator('details#fx-wages')).toHaveAttribute('open', ''); await V(p, '#fx-wages .fx-wages'); } },
      { id: 'CLB-06a', present: async (p) => { await V(p, 'section.fx-chart figure.fc-chart svg[role=img]'); await A(p, '.fx-chart .fc-limit'); await V(p, 'section.fx-actions'); await expect(p.locator('.fx-chart .fc-legend span[data-kind="limit"]')).toContainText('Kreditgräns'); } },
    ] },
    { route: '/career/finance?tab=flows', url: () => '/career/finance?tab=flows', surfaces: [
      { id: 'CLB-06b', unreachableIf: async (p) => (await p.locator('#fx-flows .fx-flows').count()) ? null : 'flows need a closed monthly statement (first month not yet booked)', present: async (p) => { await A(p, 'details#fx-flows[open]'); await V(p, '#fx-flows .fx-flows'); },
        actName: 'collapse section', act: async (p) => { await p.locator('#fx-flows summary').click(); await expect(p.locator('details#fx-flows')).not.toHaveAttribute('open', ''); } },
    ] },
    { route: '/career/finance?tab=budget', url: () => '/career/finance?tab=budget', surfaces: [
      { id: 'CLB-06c', present: async (p, vp) => { await V(p, 'section#fx-budget.fx-budget'); if (isPhone(vp)) { await H(p, '.fx-track input[type=range]'); await expect(p.getByRole('button', { name: 'Mer till transfers' })).toBeVisible(); } else await expect(p.getByRole('slider', { name: 'Flytta budget mellan löner och transfers' })).toBeVisible(); await expect(p.locator('.fx-steppers')).toBeVisible(); await A(p, 'aside.fx-margin'); },
        actName: 'stepper previews a plan (not confirmed)', act: async (p) => { await p.getByRole('button', { name: 'Mer till transfers' }).click(); await expect(p.locator('.fx-margin').getByRole('button', { name: 'Bekräfta plan' })).toBeEnabled(); await V(p, '.fx-preview'); } },
    ] },
    { route: '/career/finance?tab=ledger', url: () => '/career/finance?tab=ledger', surfaces: [
      { id: 'CLB-06d', unreachableIf: async (p) => (await p.locator('#fx-ledger ol.fx-ledger').count()) ? null : 'ledger needs a closed month', present: async (p) => { await A(p, 'details#fx-ledger[open]'); await V(p, '#fx-ledger ol.fx-ledger'); } },
    ] },
    { route: '/career/finance?tab=wages', url: () => '/career/finance?tab=wages', surfaces: [
      { id: 'CLB-06e', present: async (p) => { await V(p, '#fx-wages .fx-wages'); await A(p, '#fx-wages .fx-links a[href="/career/contracts"]'); },
        actName: 'link to Kontrakt', act: async (p) => { await p.locator('#fx-wages .fx-links a[href="/career/contracts"]').first().click(); await expect(p).toHaveURL(/\/career\/contracts/); } },
    ] },
    { route: '/career/finance?tab=forecast', url: () => '/career/finance?tab=forecast', surfaces: [
      { id: 'CLB-06f', present: async (p) => { await V(p, '#fx-forecast .fx-forecast'); await V(p, '#fx-forecast ul.fx-assume'); await A(p, '#fx-forecast details.fx-subdetail'); },
        actName: 'unfold month table', act: async (p) => { await p.locator('#fx-forecast .fx-subdetail summary').click(); await expect(p.locator('#fx-forecast .fx-subdetail')).toHaveAttribute('open', ''); } },
    ] },
    // ---- Manager
    { route: '/career/manager', url: () => '/career/manager', surfaces: [
      { id: 'MGR-01', present: async (p) => { await V(p, 'header.kr-head .kr-monogram'); await V(p, 'dl.kr-head-stats'); await expect(p.getByRole('tablist', { name: 'Karriär' })).toBeVisible(); await A(p, 'ol.kr-chapters li.kr-chapter'); await A(p, 'footer.kr-resign'); },
        actName: 'Jobbmarknaden tab', act: async (p) => { await p.getByRole('tab', { name: /^Jobbmarknaden/ }).click(); await expect(p).toHaveURL(/tab=jobs/); await V(p, 'section.kr-pipe'); } },
      { id: 'MGR-01a', present: async (p) => { await V(p, 'section.kr-arc'); await expect(p.locator('section.kr-arc[data-sparse="true"] h2', { hasText: 'Ditt första kapitel' }).or(p.locator('.kr-arc-chart, .kr-arc-list').first())).toBeVisible(); },
        actName: 'first-chapter link to the board objectives', act: async (p) => { await p.locator('.kr-arc').getByRole('link', { name: /Styrelsens mål/ }).click(); await expect(p).toHaveURL(/\/career\/board/); } },
    ] },
    { route: '/career/manager?tab=jobs', url: () => '/career/manager?tab=jobs', surfaces: [
      { id: 'MGR-01b', present: async (p, vp) => { await V(p, 'section.kr-pipe'); await expect(p.locator('.kr-pipe-board .kr-pipe-col[role=group]')).toHaveCount(5); if (isPhone(vp)) await V(p, '.kr-pipe-tabs'); },
        actAt: 'phone', actName: 'phone stage segment Avgjort', act: async (p) => { await p.locator('.kr-pipe-tabs').getByRole('tab', { name: /Avgjort/ }).click(); await expect(p.locator('.kr-pipe-col[data-stage="DECIDED"]')).toHaveAttribute('data-active', 'true'); } },
    ] },
    { route: '/career/history', url: () => '/career/history', surfaces: [
      { id: 'MGR-02', unreachableIf: async (p) => (await p.locator('article.sb-cover').count()) ? null : 'Season Book cover needs a completed season (first season shows the empty state)', present: async (p) => { await V(p, '.sb-page .sb-hubtabs[role=tablist]'); await V(p, 'article.sb-cover'); } },
      { id: 'MGR-02a', present: async (p) => { await V(p, 'nav.sb-shelf li.sb-spine[data-current="true"]'); },
        actName: 'running season spine', act: async (p) => { await p.locator('.sb-shelf .sb-spine[data-current="true"] a').first().click(); await expect(p).toHaveURL(/\/career\/(season|history)/); } },
    ] },
    { route: '/career/season', url: () => '/career/season', surfaces: [
      { id: 'MGR-03', present: async (p) => { await expect(p.locator('section.pg-path h2', { hasText: 'Vägen till guld' })).toBeVisible(); expect(await p.locator('.pg-lanes .pg-lane').count()).toBeGreaterThanOrEqual(3); await expect(p.getByRole('tablist', { name: 'Säsongens tävlingar' })).toBeVisible(); },
        actName: 'Regler tab', act: async (p) => { await p.getByRole('tab', { name: 'Regler' }).click(); await expect(p.getByRole('tab', { name: 'Regler' })).toHaveAttribute('aria-selected', 'true'); } },
    ] },
    { route: '/career/moments → /career', url: () => '/career/moments', surfaces: [
      { id: 'MGR-04', present: async (p) => { await expect(p).toHaveURL(/\/career$/); await V(p, '.hm-front-lead'); } },
    ] },
    // ---- World
    { route: '/career/inbox', url: () => '/career/inbox', surfaces: [
      { id: 'WLD-01', present: async (p, vp) => { await expect(p.locator('section.nw-todo.ib-tray h2', { hasText: 'Att göra' })).toBeVisible(); if (!isPhone(vp)) await V(p, '.ib-threads button.ib-thread .ib-emblem'); else await A(p, '.ib-thread .ib-emblem'); },
        actName: 'open thread, j moves', act: async (p) => { await p.locator('.ib-thread').first().click(); await expect(p.locator('.ib-thread[data-active="true"]')).toHaveCount(1); await p.keyboard.press('j'); await expect(p.locator('.ib-thread[data-active="true"]')).toHaveCount(1); } },
      { id: 'WLD-01a', present: async (p) => { await V(p, 'nav.ib-segment a'); await A(p, '.ib-chips[role=group] button'); },
        actName: 'Att göra segment in URL', act: async (p) => { await p.locator('.ib-segment').getByRole('link', { name: /^Att göra/ }).click(); await expect(p).toHaveURL(/view=todo/); await expect(p.locator('.ib-segment a[aria-current="page"]')).toContainText('Att göra'); } },
    ] },
    { route: '/career/inbox?message=', url: () => `/career/inbox?message=${ctx.messageId}`, needs: () => ctx.messageId ? null : 'no inbox thread to open', surfaces: [
      { id: 'WLD-01b', present: async (p) => { await V(p, '.ib-reader article.ib-letter'); await A(p, 'footer.game-news-tools'); },
        actAt: 'phone', actName: 'phone full-screen reader ← Trådarna', act: async (p) => { await p.locator('.ib-back').click(); await V(p, '.ib-feed'); } },
    ] },
    { route: '/career/media', url: () => '/career/media', surfaces: [
      { id: 'WLD-02', present: async (p) => { await expect(p.getByRole('tablist', { name: 'Mediecentret' })).toBeVisible(); await A(p, 'section.md-stand .md-press-slot'); await A(p, '.md-fronts article.md-front'); await V(p, '.md-latest-head h2'); },
        actName: 'Presskonferenser tab', act: async (p) => { await p.getByRole('tab', { name: /^Presskonferenser/ }).click(); await expect(p).toHaveURL(/tab=press/); await V(p, 'section.md-press'); } },
      { id: 'WLD-02a', present: async (p) => { await V(p, 'article.md-lead[aria-label="Huvudnyheten"]'); await A(p, 'ol.md-dated'); await expect(p.getByRole('radiogroup', { name: 'Bevakning' })).toBeAttached(); await A(p, '.md-search input[type=search]'); },
        actName: 'scope filter Din klubb in URL', act: async (p) => { await p.getByRole('radiogroup', { name: 'Bevakning' }).getByRole('radio', { name: 'Din klubb' }).click(); await expect(p).toHaveURL(/scope=OWN/); } },
    ] },
    { route: '/career/media?tab=press', url: () => '/career/media?tab=press', surfaces: [
      { id: 'WLD-02b', unreachableIf: async (p) => (await p.locator('ul.md-press-list li, ul.md-quotes li').count()) ? null : 'no open or past press conference', present: async (p) => { await V(p, 'section.md-press'); await expect(p.locator('ul.md-press-list li[data-open], ul.md-quotes li').first()).toBeVisible(); },
        actName: 'conference opens transcript', act: async (p) => { await p.locator('.md-press a[href^="/career/media/press/"]').first().click(); await V(p, '.md-live'); } },
    ] },
    { route: '/career/media?tab=rivals', url: () => '/career/media?tab=rivals', surfaces: [
      { id: 'WLD-02c', unreachableIf: async (p) => (await p.locator('li.md-rival').count()) ? null : 'no rivalry data yet', present: async (p) => { await V(p, 'section.md-rivals'); await V(p, 'li.md-rival'); },
        actName: 'rival club link', act: async (p) => { await p.locator('.md-rival a.hm-club-link').first().click(); await expect(p).toHaveURL(/\/career\/clubs\//); } },
    ] },
    { route: '/career/media?tab=discipline', url: () => '/career/media?tab=discipline', surfaces: [
      { id: 'WLD-02d', present: async (p) => { await A(p, 'details#disciplin.md-discipline-archive[open]'); await expect(p.getByRole('tab', { name: /^Medierna/ })).toHaveAttribute('aria-selected', 'true'); } },
    ] },
    { route: '/career/media?tab=outlets', url: () => '/career/media?tab=outlets', surfaces: [
      { id: 'WLD-02e', present: async (p) => { await V(p, 'section.md-outlets'); await V(p, 'ul.md-favour-list li.md-favour .md-favour-head'); } },
    ] },
    { route: '/career/media/press/[pressId]', url: () => `/career/media/press/${ctx.pressId}`, needs: () => ctx.pressId ? null : 'no press conference was created after the match', surfaces: [
      { id: 'WLD-03', present: async (p) => { await V(p, '.md-press-page.md-live'); await V(p, 'section.md-transcript'); await A(p, 'aside.md-react'); await expect(p.locator('fieldset.md-tones').or(p.locator('section.md-recap'))).toBeVisible(); },
        actName: 'tone key 1 answers, Ångra enabled', act: async (p) => { if (!(await p.locator('fieldset.md-tones').count())) { await V(p, 'section.md-recap'); return; } await p.locator('fieldset.md-tones').scrollIntoViewIfNeeded(); await p.locator('body').click({ position: { x: 700, y: 5 } }); await p.keyboard.press('1'); await expect(p.locator('.md-transcript li[data-state="answered"]')).toHaveCount(1); await expect(p.getByRole('button', { name: 'Ångra senaste svaret' })).toBeEnabled(); } },
    ] },
    { route: '/career/media/story/[storyId]', url: () => `/career/media/story/${ctx.storyId}`, needs: () => ctx.storyId ? null : 'no media story has been written yet', surfaces: [
      { id: 'WLD-04', present: async (p) => { await V(p, 'article.md-article.md-skinned'); await expect(p.locator('.md-article')).toHaveAttribute('data-skin', /.+/); await expect(p.locator('section.md-coverage h2', { hasText: 'Så skrev andra' })).toBeAttached(); } },
    ] },
    { route: '/career/calendar', url: () => '/career/calendar', surfaces: [
      { id: 'WLD-05', present: async (p) => { await expect(p.getByRole('tablist', { name: 'Kalendervy' })).toBeVisible(); await A(p, 'nav.hm-season-strip li[data-current="true"]'); },
        actAt: 'all', actName: 'click a week in the season strip', act: async (p) => { const last = p.locator('.hm-season-strip li button').last(); await last.scrollIntoViewIfNeeded(); await last.click(); await expect(p.locator('.hm-season-strip li').last()).toHaveAttribute('data-selected', 'true'); } },
    ] },
    { route: '/career/schedule', url: () => '/career/schedule', surfaces: [
      { id: 'WLD-06', present: async (p) => { await expect(p.locator('.hm-cal-views [role=tab][aria-selected="true"]', { hasText: 'Lista' })).toBeVisible(); await V(p, 'section.sc-next'); await V(p, 'ol.sc-agenda .sc-fixture'); await A(p, '.sc-fixture[data-outcome]'); },
        actName: 'Vecka switches to the calendar', act: async (p) => { await p.getByRole('tab', { name: 'Vecka' }).click(); await expect(p).toHaveURL(/\/career\/calendar/); } },
      { id: 'WLD-06b', present: async (p) => { await A(p, '.sc-chips[role=group]'); await expect(p.getByRole('radiogroup', { name: 'Tid' })).toBeAttached(); },
        actAt: 'all', actName: 'Resultat chip in URL', act: async (p) => { await p.getByRole('radiogroup', { name: 'Tid' }).getByRole('radio', { name: 'Resultat' }).click(); await expect(p).toHaveURL(/when=RESULTS/); await A(p, '.sc-fixture[data-outcome]'); } },
    ] },
    { route: '/career/medical', url: () => '/career/medical', surfaces: [
      { id: 'MED-01', present: async (p) => { await V(p, 'figure.md-quote'); await V(p, 'section.md-next'); await expect(p.locator('.md-tl').or(p.locator('.game-scene-empty', { hasText: 'Hela truppen är tillgänglig' })).first()).toBeVisible(); },
        actName: 'next match link', act: async (p) => { await p.locator('.md-next').getByRole('link', { name: /Matchen/ }).first().click(); await expect(p).toHaveURL(/\/career\/(fixtures|match-preview)/); } },
    ] },
    // ---- Squad
    { route: '/career/squad', url: () => '/career/squad', surfaces: [
      { id: 'SQD-01', present: async (p, vp) => { await V(p, '.hm-matrix-controls'); await expect(p.locator('.hm-matrix-views [role=tab]')).toHaveCount(5); await V(p, '.hm-matrix-count'); if (isPhone(vp)) await V(p, 'ol.hm-matrix-cards, .sq-overview-cards'); },
        actName: 'Detaljerad density', act: async (p) => { await p.locator('.hm-matrix-density').getByRole('button', { name: 'Detaljerad' }).click(); await expect(p.locator('.hm-matrix-screen')).toHaveAttribute('data-density', 'DETAILED'); expect(await overflow(p)).toBeLessThanOrEqual(1); } },
      { id: 'SQD-01a', present: async (p, vp) => { if (isPhone(vp)) await V(p, 'ol.sq-overview-cards'); else await V(p, 'table.sq-overview .sq-mini-strip'); },
        actName: 'expand a row (chevron)', act: async (p) => { await p.locator('.sq-overview tbody .sq-chevron').first().click(); await expect(p.locator('.sq-overview tbody .sq-chevron').first()).toHaveAttribute('aria-expanded', 'true'); await V(p, '.sq-band-row .sq-band'); } },
      { id: 'SQD-01b', present: async (p) => { await expect(p.locator('.hm-matrix-views').getByRole('tab', { name: 'Prestation' })).toBeAttached(); },
        actAt: 'all', actName: 'Prestation view: outfield + keeper tables', act: async (p, vp) => { await p.locator('.hm-matrix-views').getByRole('tab', { name: 'Prestation' }).click(); await V(p, '.sq-perf'); await A(p, '#sq-perf-out'); await A(p, '#sq-perf-gk'); if (!isPhone(vp)) { await p.locator('.sq-perf-table').first().getByRole('button', { name: /^Skott %/ }).click(); await expect(p.locator('.sq-perf-table').first().locator('th[aria-sort]')).toHaveCount(1); } } },
      { id: 'SQD-01c', present: async (p) => { await expect(p.locator('.hm-matrix-views').getByRole('tab', { name: 'Fysisk status' })).toBeAttached(); },
        actAt: 'all', actName: 'Fysisk status heat-strip, risk sort', act: async (p, vp) => { await p.locator('.hm-matrix-views').getByRole('tab', { name: 'Fysisk status' }).click(); await V(p, 'section.sq-legend'); if (!isPhone(vp)) { await A(p, '.sq-strip-table td.sq-heat[data-key=fitness] .sq-fe-mark'); } else await V(p, 'ol.sq-strip-cards'); await p.locator('.sq-strip-tools').getByRole('button', { name: 'Sortera på risk' }).click(); await expect(p.locator('.sq-strip-tools button').first()).toHaveAttribute('aria-pressed', 'true'); } },
      { id: 'SQD-01d', present: async (p) => { await expect(p.locator('.hm-matrix-views').getByRole('tab', { name: 'Kontraktsrisk' })).toBeAttached(); },
        actName: 'Kontraktsrisk → Förläng opens the renewal drawer', act: async (p) => { await p.locator('.hm-matrix-views').getByRole('tab', { name: 'Kontraktsrisk' }).click(); await V(p, 'td[data-col=daysLeft] .sq-countdown'); await p.locator('td[data-col=contractAction]').first().getByRole('button', { name: 'Förläng' }).click(); await expect(p.getByRole('dialog', { name: /^Kontraktsbeslut:/ })).toBeVisible(); await V(p, '.hm-renew'); } },
      { id: 'SQD-01e', present: async (p, vp) => { if (!isPhone(vp)) await A(p, '.sq-overview tbody .hm-matrix-select input'); else await A(p, '.hm-matrix-select input'); },
        actName: 'select two players → tray with compare', act: async (p) => { const cb = p.locator('.sq-overview tbody .hm-matrix-select input'); await cb.nth(0).check(); await cb.nth(1).check(); await expect(p.locator('.hm-matrix-tray strong')).toHaveText('2 valda'); await expect(p.locator('.hm-matrix-tray').getByRole('link', { name: 'Jämför valda spelare →' })).toBeVisible(); } },
      { id: 'SQD-01f', present: async (p) => { await V(p, 'section.cj-squad-depth'); await expect(p.locator('.cj-squad-depth button.cj-spot')).toHaveCount(7); },
        actAt: 'all', actName: 'tap MV spot filters the matrix', act: async (p) => { await p.locator('.cj-squad-depth .cj-spot').filter({ hasText: 'MV' }).first().click(); await expect(p.locator('.hm-matrix-positions button[aria-pressed="true"]')).toHaveText('MV'); } },
      { id: 'SQD-01g', present: async (p) => { await A(p, '.hm-matrix-search input'); },
        actAt: 'all', actName: 'no-match search shows explaining empty state; Rensa filter', act: async (p) => { await p.locator('.hm-matrix-search input').fill('zzzqqq'); await V(p, '.sq-empty[role=status]'); await p.locator('.sq-empty').getByRole('button', { name: 'Rensa filter' }).click(); await expect(p.locator('.sq-empty')).toHaveCount(0); await expect(p.locator('.hm-matrix-search input')).toHaveValue(''); } },
    ] },
    { route: '/career/squad/[playerId] (own)', url: () => `/career/squad/${own()}`, surfaces: [
      { id: 'SQD-02', present: async (p) => { await V(p, '.hm-dossier'); await expect(p.locator('nav.hm-dossier-tabs button')).toHaveCount(5); await V(p, '.hm-dossier-bar'); },
        actName: 'Karriär chapter', act: async (p) => { await tabBtn(p, 'Karriär').click(); await expect(p.getByRole('heading', { name: 'Karriären', exact: true })).toBeVisible(); } },
      { id: 'SQD-02a', present: async (p) => { await V(p, 'section.hm-dossier-ratings'); await V(p, '.hm-dossier-families li'); await expect(p.locator('.hm-dossier-gauges .hm-dossier-gauge')).toHaveCount(3); await A(p, 'dl.hm-dossier-season'); } },
      { id: 'SQD-02g', present: async (p) => { await V(p, '.hm-dossier-bar[data-own=true] .hm-dossier-bar-name'); await V(p, '.hm-dossier-bar-actions'); },
        actName: 'Jämför spelare action', act: async (p) => { await p.locator('.hm-dossier-bar-actions').getByRole('link', { name: 'Jämför spelare' }).click(); await expect(p).toHaveURL(/\/career\/compare\?left=/); } },
      { id: 'SQD-02h', present: async (p) => { await V(p, 'section.pv-condition'); expect(await p.locator('.pv-gauges button.pv-gauge').count()).toBeGreaterThanOrEqual(3); },
        actAt: 'all', actName: 'tap gauge explains', act: async (p) => { await p.locator('.pv-gauge[data-gauge=fitness]').click(); await expect(p.locator('.pv-gauge[data-gauge=fitness]')).toHaveAttribute('aria-expanded', 'true'); await expect(p.locator('.pv-gauge-help')).toContainText('Matchträning'); } },
      { id: 'SQD-02i', present: async (p) => { await V(p, 'section.pd-hub[aria-label="Spelaren som person"]'); await A(p, '.pd-danger'); },
        actName: 'release behind an alertdialog, Avbryt', act: async (p) => { await p.locator('.pd-danger').getByRole('button', { name: 'Bryt avtalet…' }).click(); await expect(p.getByRole('alertdialog')).toBeVisible(); await p.getByRole('alertdialog').getByRole('button', { name: 'Avbryt' }).click(); await expect(p.getByRole('alertdialog')).toHaveCount(0); } },
      { id: 'SQD-02p', present: async (p) => { await V(p, 'section.pv-rehab'); },
        actName: 'Medicinska avdelningen link', act: async (p) => { await p.locator('.pv-rehab').getByRole('link', { name: 'Medicinska avdelningen →' }).click(); await expect(p).toHaveURL(/\/career\/medical$/); } },
      { id: 'ENT-09', present: async (p, vp) => { await expect(p.getByRole('navigation', { name: 'Brödsmulor' })).toBeAttached(); expect(await p.locator('nav.hm-crumbs ol li').count()).toBeGreaterThanOrEqual(2); await A(p, 'nav.hm-crumbs [aria-current=page]'); if (isPhone(vp)) await V(p, 'a.hm-crumbs-back'); },
        actName: 'crumb back to Trupp', act: async (p) => { await p.locator('nav.hm-crumbs ol a').last().click(); await expect(p).toHaveURL(/\/career(\/squad)?$/); } },
    ] },
    { route: '/career/squad/[playerId]?tab=matches', url: () => `/career/squad/${ctx.playedPlayer || own()}?tab=matches`, surfaces: [
      { id: 'SQD-02b', present: async (p) => { await expect(p.getByRole('heading', { name: 'Matchlogg' })).toBeVisible(); await V(p, '.pv-chart'); await V(p, 'ol.pv-log li'); await expect(p.getByRole('heading', { name: 'Säsongshistorik' })).toBeAttached(); },
        actName: 'chart point focuses the log row', act: async (p) => { const pt = p.locator('.pv-points button').first(); await pt.click(); await expect(pt).toHaveAttribute('aria-pressed', 'true'); await expect(p.locator('ol.pv-log li[data-focus=true]')).toHaveCount(1); } },
    ] },
    { route: '/career/squad/[playerId]?tab=development', url: () => `/career/squad/${own()}?tab=development`, ready: async (p) => { await expect(p.locator('.pv-skeleton')).toHaveCount(0, { timeout: 30000 }); }, surfaces: [
      { id: 'SQD-02c', present: async (p) => { await V(p, '.pv-workspace'); await A(p, 'section.gp-matrix'); await A(p, 'section.pv-history'); await expect(p.getByRole('heading', { name: 'Kroppsprofil' })).toBeAttached(); },
        actName: 'tile opens its history', act: async (p) => { await p.locator('.gp-matrix button.gp-tile').first().click(); await expect(p.locator('#pv-hist-h')).toHaveText(/^Historik: /); } },
      { id: 'SQD-02d', present: async (p) => { await V(p, 'section.pv-curve'); await expect(p.locator('section.pv-focus [role=radiogroup][aria-label="Individuellt utvecklingsfokus"]')).toBeVisible(); },
        actName: 'individual focus Mentalt', act: async (p) => { const r = p.locator('.pv-seg').getByRole('radio', { name: 'Mentalt' }); await r.click(); await expect(r).toHaveAttribute('aria-checked', 'true'); } },
      { id: 'SQD-02j', present: async (p, vp) => { await A(p, 'section.gp-matrix .gp-heat'); await A(p, '.gp-matrix-legend .gp-tier-chip'); if (isPhone(vp)) await A(p, '.gp-heat-family'); },
        actName: 'compare overlay (lagsnitt)', act: async (p) => { await p.locator('label.gp-compare select').selectOption('avg'); await V(p, '.gp-matrix .gp-cmp'); } },
      { id: 'SQD-02k', present: async (p) => { await V(p, 'section.gp-ability .gp-court'); await A(p, '.gp-court button.gp-spot'); },
        actName: 'tap a court spot lists roles', act: async (p) => { const s = p.locator('.gp-court button.gp-spot').nth(1); await s.click(); await expect(s).toHaveAttribute('aria-pressed', 'true'); await V(p, '.gp-spot-note'); } },
    ] },
    { route: '/career/squad/[playerId]?tab=career', url: () => `/career/squad/${own()}?tab=career`, surfaces: [
      { id: 'SQD-02f', present: async (p) => { await V(p, 'ol.pv-ribbon li'); await expect(p.getByRole('heading', { name: 'Utbildningsersättning' })).toBeAttached(); },
        actName: 'ribbon club opens profile', act: async (p) => { await p.locator('ol.pv-ribbon li a').first().click(); await expect(p).toHaveURL(/\/career\/(clubs\/|club$)/); } },
    ] },
    { route: '/career/squad/[playerId]?tab=contract', url: () => `/career/squad/${own()}?tab=contract`, surfaces: [
      { id: 'SQD-02e', present: async (p) => { await V(p, '.pv-deal'); await V(p, 'dl.pv-deal-facts'); await V(p, 'section.pv-budget .pv-budget-bar'); },
        actName: 'Alla kontrakt link', act: async (p) => { await p.locator('.pv-budget').getByRole('link', { name: 'Alla kontrakt →' }).click(); await expect(p).toHaveURL(/\/career\/contracts$/); } },
      { id: 'SQD-02n', present: async (p) => { await V(p, '.pd-renewal.hm-renew'); } },
      { id: 'SQD-02o', present: async (p) => { await V(p, 'section.ptc'); await V(p, '.ptc .ptc-chip'); } },
    ] },
    { route: '/career/squad/[playerId] (external)', url: () => `/career/squad/${ctx.extPlayer}`, ready: async (p) => { await expect(p.locator('.pv-skeleton')).toHaveCount(0, { timeout: 30000 }); }, surfaces: [
      { id: 'SQD-02l', present: async (p) => { await V(p, 'section.kg-panel[aria-label="Bedömd förmåga"] .hm-range'); await expect(p.locator('.hm-dossier-bar')).toHaveAttribute('data-own', 'false'); },
        actName: 'Scouta nu / hint', act: async (p) => { const cta = p.locator('.kg-panel a.kg-cta').first(); if (await cta.count()) { await cta.click(); await expect(p).toHaveURL(/\/career\/scouting\?target=/); } else await V(p, '.kg-panel .kg-hint'); } },
      { id: 'SQD-02m', present: async (p) => { await V(p, 'section.sr-timeline[aria-label="Scoutingrapport"]'); await A(p, '.sr-timeline .game-report-stamp, .sr-timeline .sr-empty'); } },
    ] },
    { route: '/career/squad/[playerId]?tab=contract (external)', url: () => `/career/squad/${ctx.extPlayer}?tab=contract`, surfaces: [
      { id: 'SQD-02o', present: async (p) => { await V(p, 'section.ptc'); await V(p, '.ptc a.ptc-cta'); },
        actName: 'negotiation CTA', act: async (p) => { await p.locator('.ptc a.ptc-cta').click(); await expect(p).toHaveURL(/\/career\/transfers\//); } },
    ] },
    { route: '/career/squad/[unknown]', url: () => '/career/squad/no-such-player', surfaces: [
      { id: 'SQD-02q', present: async (p) => { await V(p, 'section.pv-notfound'); await expect(p.getByRole('heading', { name: 'Spelaren hittades inte' })).toBeVisible(); },
        actName: 'back to the squad', act: async (p) => { await p.locator('.pv-nf-actions').getByRole('link', { name: '← Till truppen' }).click(); await expect(p).toHaveURL(/\/career\/squad$/); } },
    ] },
    { route: '/career/players', url: () => '/career/players', surfaces: [
      { id: 'SQD-03', present: async (p, vp) => { await V(p, '.hm-market'); if (isPhone(vp)) await V(p, 'ol.hm-market-cards li'); else { await V(p, 'table.hm-market-table tbody tr'); await A(p, '.hm-market-table td.hm-market-band .hm-range'); } await A(p, 'ul.hm-market-presets'); },
        actName: 'select row → bulk Kortlista tray', act: async (p) => { await p.locator('.hm-market-table tbody .hm-market-select input').first().check(); await expect(p.getByRole('region', { name: 'Valda spelare' })).toBeVisible(); } },
      { id: 'SQD-03a', present: async (p) => { await A(p, '.hm-market'); },
        actName: 'Peek drawer, Nästa spelare', act: async (p) => { await p.locator('.hm-market-table tbody').getByRole('button', { name: /^Visa dossier för / }).first().click(); const d = p.getByRole('dialog', { name: /^Spelardossier: / }); await expect(d).toBeVisible(); await d.getByRole('button', { name: 'Nästa spelare' }).click(); await expect(p.getByRole('dialog').locator('.hm-drawer-title .hm-eyebrow')).toContainText('2 av'); } },
    ] },
    { route: '/career/compare', url: () => `/career/compare?left=${ctx.ownPlayers[0]}&right=${ctx.ownPlayers[1]}`, surfaces: [
      { id: 'SQD-04', present: async (p) => { await expect(p.locator('.hm-compare-pickers input[role=combobox]')).toHaveCount(2); await V(p, 'section.hm-compare-group'); await A(p, '.hm-compare-axis[role=img]'); },
        actName: 'delta sort', act: async (p) => { await p.getByRole('button', { name: 'Sortera på skillnad' }).click(); await expect(p).toHaveURL(/sort=delta/); await expect(p.getByRole('button', { name: 'Standardordning' })).toHaveAttribute('aria-pressed', 'true'); } },
    ] },
    { route: '/career/contracts', url: () => '/career/contracts', surfaces: [
      { id: 'SQD-05', present: async (p, vp) => { await V(p, 'section.hm-payroll .hm-payroll-bar'); if (isPhone(vp)) await V(p, '.hm-gantt-list'); else { await V(p, '.hm-gantt[role=table]'); await V(p, '.hm-gantt-row'); } },
        actName: 'group by position', act: async (p) => { await p.locator('.hm-gantt-controls').getByLabel('Gruppera per position').check(); await V(p, '.hm-gantt .hm-gantt-group'); } },
      { id: 'SQD-05a', present: async (p) => { await A(p, 'button.hm-gantt-name'); },
        actName: '?player= side drawer', act: async (p) => { await p.locator('.hm-gantt button.hm-gantt-name').first().click(); await expect(p).toHaveURL(/[?&]player=/); await V(p, '[role=dialog] .hm-renew'); } },
    ] },
    // ---- Staff
    { route: '/career/staff', url: () => '/career/staff', surfaces: [
      { id: 'STF-01', present: async (p) => { await V(p, 'section.sf-head .sf-cost-bar[role=meter]'); await A(p, '.sf-matrix details.sf-dept'); await A(p, '.sf-matrix li.sf-row'); await A(p, '.sf-needs'); },
        actName: 'holder Peek', act: async (p) => { await p.locator('.sf-row .sf-linkish').first().click(); await V(p, 'aside.sf-peek'); await expect(p.locator('.sf-peek').getByRole('link', { name: 'Öppna profilen →' })).toBeVisible(); } },
      { id: 'STF-01a', present: async (p) => { await expect(p.getByRole('navigation', { name: 'Personal' }).getByRole('link', { name: /^Organisation/ })).toBeVisible(); },
        actName: 'Ansvar tab', act: async (p) => { await p.getByRole('navigation', { name: 'Personal' }).getByRole('link', { name: /^Ansvar/ }).click(); await expect(p).toHaveURL(/\/career\/staff\/responsibilities$/); } },
      { id: 'STF-01b', present: async (p) => { await expect(p.locator('.sf-toggle').getByRole('tab', { name: 'Träd' })).toBeVisible(); },
        actAt: 'all', actName: 'Träd lens', act: async (p) => { await p.locator('.sf-toggle').getByRole('tab', { name: 'Träd' }).click(); await V(p, 'section.sf-tree .sf-tree-root'); expect(await overflow(p)).toBeLessThanOrEqual(1); } },
      { id: 'STF-01c', present: async (p) => { await expect(p.locator('.sf-toggle').getByRole('tab', { name: 'Lista' })).toBeVisible(); },
        actName: 'Lista lens sort by name', act: async (p) => { await p.locator('.sf-toggle').getByRole('tab', { name: 'Lista' }).click(); await p.locator('.sf-list').getByRole('button', { name: /^Namn/ }).click(); await expect(p.locator('.sf-list th').first()).toHaveAttribute('aria-sort', /ascending|descending/); } },
      { id: 'STF-01d', present: async (p) => { await V(p, 'section.sf-week'); await expect(p.locator('.sf-week ol > li')).toHaveCount(7); },
        actName: 'day links to training', act: async (p) => { await p.locator('.sf-week ol > li a').first().click(); await expect(p).toHaveURL(/\/career\/training/); } },
    ] },
    { route: '/career/staff/[staffId]', url: () => `/career/staff/${ctx.staffId}`, needs: () => ctx.staffId ? null : 'no own staff member to open', surfaces: [
      { id: 'STF-02', present: async (p, vp) => { await V(p, '.sf-dossier aside.sf-id h1'); await V(p, '.sf-dossier .sf-work'); await A(p, '#sf-fit-title'); if (isPhone(vp)) await V(p, '.sf-sticky'); },
        actName: '← Tillbaka', act: async (p) => { await p.locator('.sf-id').getByRole('button', { name: '← Tillbaka' }).click(); await expect(p).toHaveURL(/\/career\/staff(\/recruitment)?$/); } },
      { id: 'STF-02a', present: async (p) => { await V(p, 'section.si-fit button.si-fit-row'); await A(p, 'section.si-attrs'); },
        actName: 'Pröva en annan roll', act: async (p) => { await p.locator('label.si-fit-try select').selectOption({ index: 1 }); await expect(p.locator('.si-fit-row .si-fit-role small').first()).toContainText('prövas'); } },
    ] },
    { route: '/career/staff/[staffId] (market candidate)', url: () => `/career/staff/${ctx.extStaffId}?from=recruitment`, needs: () => ctx.extStaffId ? null : 'no staff candidate on the recruitment market', surfaces: [
      { id: 'STF-02b', present: async (p) => { await V(p, '#sf-deal section.st-deal'); await A(p, '.st-deal .sf-budget .sf-budget-bar[role=img]'); } },
    ] },
    { route: '/career/staff/recruitment', url: () => '/career/staff/recruitment', surfaces: [
      { id: 'STF-03', present: async (p) => { await V(p, 'section.sf-market'); await expect(p.getByRole('tablist', { name: 'Rekrytering' })).toBeVisible(); },
        actName: 'role filter ?role=', act: async (p) => { await p.locator('.st-market-filters').getByLabel('Roll').selectOption({ index: 1 }); await expect(p).toHaveURL(/[?&]role=/); await expect(p.locator('#market-title')).toHaveText(/^Kandidater: /); } },
      { id: 'STF-03a', present: async (p) => { await V(p, 'section.sf-vac button.sf-vac-card[data-all]'); } },
      { id: 'STF-03c', present: async (p, vp) => { if (isPhone(vp)) await A(p, 'table.sf-market-table tbody tr'); else { await V(p, 'table.sf-market-table tbody tr'); await A(p, '.sf-market-table td[data-label="Mot i dag"] .sf-delta'); } },
        actName: 'column chooser', act: async (p) => { await p.locator('details.sf-cols > summary').click(); await V(p, 'details.sf-cols input[type=checkbox]'); } },
      { id: 'STF-03d', present: async (p) => { await expect(p.getByText('Fria scouter')).toHaveCount(0); await expect(p.getByText('Rekrytering — Personal')).toHaveCount(0); } },
    ] },
    { route: '/career/staff/recruitment?view=negotiations', url: () => '/career/staff/recruitment?view=negotiations', surfaces: [
      { id: 'STF-03b', unreachableIf: async (p) => (await p.locator('section.sf-board').count()) ? null : 'negotiation board needs at least one staff negotiation (none open)', present: async (p) => { await expect(p.getByRole('tab', { name: /^Förhandlingar/ })).toHaveAttribute('aria-selected', 'true'); await V(p, 'section.sf-board'); } },
    ] },
    { route: '/career/staff/responsibilities', url: () => '/career/staff/responsibilities', surfaces: [
      { id: 'STF-04', present: async (p) => { await V(p, 'section.sf-queue'); await A(p, 'aside.sf-modes-summary li[data-mode]'); await expect(p.getByRole('heading', { name: 'Vad staben har gjort' })).toBeAttached(); },
        actName: 'log area filter', act: async (p) => { await p.locator('.sf-log-filters').getByLabel('Område').selectOption({ index: 1 }); await expect(p.locator('.sf-log-filters').getByLabel('Område')).not.toHaveValue(''); } },
    ] },
    // ---- Training & tactics (post-match)
    { route: '/career/training', url: () => '/career/training', surfaces: [
      { id: 'TRN-01', present: async (p) => { await V(p, '.trn-screen'); await expect(p.getByRole('heading', { name: 'Träning & Återhämtning' })).toBeVisible(); await A(p, 'aside.trn-forecast h2'); await V(p, 'section.trn-assistant'); } },
      { id: 'TRN-01b', present: async (p, vp) => { await V(p, 'section.trn-planner'); await A(p, '.trn-palette[role=toolbar] .trn-chip'); await A(p, '.trn-week .trn-day'); if (isPhone(vp)) await V(p, '.trn-day-nav'); },
        actName: 'palette chip selects a block type', act: async (p) => { await p.locator('.trn-palette .trn-chip').first().click(); await expect(p.locator('.trn-palette .trn-chip').first()).toHaveAttribute('aria-pressed', 'true'); } },
      { id: 'TRN-01c', present: async (p) => { await A(p, 'section#trn-readiness.trn-readiness'); await A(p, '.trn-rs-row .trn-strip .trn-cell[data-key]'); },
        actName: 'pick a player activates bulk bar', act: async (p) => { await p.locator('.trn-rs-row .trn-rs-pick input').first().check(); await expect(p.locator('.trn-bulk')).toHaveAttribute('data-active', 'true'); } },
      { id: 'TRN-01d', present: async (p) => { await A(p, 'section.trn-dev h2#trn-dev-title'); await A(p, '.trn-dev-list li a.trn-dev-row'); } },
      { id: 'TRN-01e', unreachableIf: async (p) => (await p.locator('.trn-week button.trn-outcome').count()) ? null : 'no executed training day in the shown week', present: async (p) => { await A(p, '.trn-week button.trn-outcome'); },
        actName: 'outcome chip opens per-player table', act: async (p) => { await p.locator('button.trn-outcome').first().click(); await V(p, '.trn-inspector'); } },
    ] },
    { route: '/career/tactics (after match)', url: () => '/career/tactics', ready: async (p) => { await expect(p.locator('.coach-preparation')).toBeVisible({ timeout: 90000 }); }, surfaces: [
      { id: 'TRN-02d', present: async (p) => { await A(p, '.coach-anchor-pills'); },
        actName: 'pair: tap attacker on the pairing court', act: async (p) => { await p.locator('.coach-anchor-pills').getByRole('button', { name: 'Byten & Diff' }).click(); await p.locator('.tb-pairing-attack button').first().click(); await expect(p.locator('.tb-pairing-attack button').first()).toHaveAttribute('aria-pressed', 'true'); } },
    ] },
    // ---- Scouting / recruitment / transfers
    { route: '/career/scouting', url: () => '/career/scouting', surfaces: [
      { id: 'REC-01', present: async (p, vp) => { await V(p, '.sd-page'); expect(await p.getByRole('region', { name: 'Scoutingkedjan' }).locator('.sd-stages li').count()).toBe(4); if (isPhone(vp)) await expect(p.getByRole('tablist', { name: 'Scoutingdesken' })).toBeVisible(); },
        actAt: 'phone', actName: 'phone tab Kortlista', act: async (p) => { await p.getByRole('tablist', { name: 'Scoutingdesken' }).getByRole('tab', { name: /Kortlista/ }).click(); await expect(p.locator('.sd-grid')).toHaveAttribute('data-tab', 'SHORTLIST'); } },
      { id: 'REC-01a', unreachableIf: async (p) => (await p.locator('.sd-need-cards > li[data-level]').count()) ? null : 'no high/medium squad need with known candidates', present: async (p) => { await expect(p.locator('#sd-needs-title')).toHaveText('Rekommendationer'); await V(p, '.sd-need-cards > li[data-level]'); } },
      { id: 'REC-01b', present: async (p) => { await expect(p.getByRole('list', { name: 'Scouterna' })).toBeAttached(); await expect(p.locator('.sd-scout-ghost')).toContainText('Rekrytera scout'); } },
      { id: 'REC-01d', present: async (p) => { await A(p, '.sd-cov .sd-tiles .sd-tile'); },
        actName: 'coverage tile configures a sweep (not started)', act: async (p) => { const t = p.locator('.sd-cov .sd-tile').first(); await t.scrollIntoViewIfNeeded(); await t.click(); await expect(t).toHaveAttribute('aria-pressed', 'true'); await V(p, '.sd-cov-config .sd-assign-target'); } },
      { id: 'REC-01e', present: async (p) => { await expect(p.locator('#sd-pipeline > details > summary')).toHaveCount(3); } },
      { id: 'REC-01f', unreachableIf: async (p) => (await p.locator('.sd-disc table tbody tr, .sd-disc .sd-card').count()) ? null : 'no discoveries yet (needs a completed scouting sweep)', present: async (p) => { await A(p, '.sd-disc .sd-filters'); await A(p, '.sd-disc table tbody tr, .sd-disc .sd-card'); },
        actName: 'sort newest', act: async (p) => { await p.locator('.sd-disc .sd-sort select').selectOption('NEWEST'); await expect(p.locator('.sd-disc .sd-sort select')).toHaveValue('NEWEST'); } },
    ] },
    { route: '/career/scouting?target=', url: () => `/career/scouting?target=${ctx.extPlayer}`, surfaces: [
      { id: 'REC-01c', present: async (p) => { await V(p, 'section.sd-sheet[role=dialog]'); await expect(p.locator('#sd-sheet-title')).toContainText('Scouta'); },
        actAt: 'all', actName: 'Escape closes without starting', act: async (p) => { await V(p, '.sd-sheet[role=dialog]'); await p.keyboard.press('Escape'); await expect(p.locator('.sd-sheet[role=dialog]')).toHaveCount(0); } },
    ] },
    { route: '/career/recruitment', url: () => '/career/recruitment', surfaces: [
      { id: 'REC-02', present: async (p) => { await expect(p.getByRole('region', { name: 'Rekryteringskedjan' })).toBeVisible(); await expect(p.locator('.rp-lane')).toHaveCount(6); await expect(p.locator('.rp-budget')).toContainText('Transferbudget'); },
        actName: 'Lista & filter ⇄ Kedjan', act: async (p) => { await p.getByRole('button', { name: 'Lista & filter' }).click(); await expect(p.locator('.rp-board')).toHaveCount(0); await p.getByRole('button', { name: 'Kedjan' }).click(); await expect(p.locator('.rp-lane')).toHaveCount(6); } },
      { id: 'REC-02a', unreachableIf: async (p) => (await p.locator('.rp-lane li button').count()) ? null : 'no candidate in any recruitment lane', present: async (p) => { await A(p, '.rp-lane li button'); },
        actAt: 'all', actName: 'card opens the recruitment Peek', act: async (p) => { await p.locator('.rp-lane li button').first().click(); await V(p, 'aside.rk-peek'); await expect(p.getByRole('radiogroup', { name: 'Prioritet' })).toBeVisible(); await p.locator('.rk-head').getByRole('button', { name: 'Stäng' }).click(); await expect(p.locator('.rk-peek')).toHaveCount(0); } },
    ] },
    { route: '/career/transfers', url: () => '/career/transfers', surfaces: [
      { id: 'REC-03', present: async (p) => { await V(p, '.tx-desk'); await expect(p.getByRole('tablist', { name: 'Läge' }).getByRole('tab')).toHaveCount(3); await V(p, '.tx-budget .tx-budget-bar[role=img]'); },
        actName: 'Affärer mode', act: async (p) => { await p.getByRole('tablist', { name: 'Läge' }).getByRole('tab', { name: /Affärer/ }).click(); await expect(p.getByRole('region', { name: 'Pågående förhandlingar' })).toBeVisible(); await expect(p).toHaveURL(/mode=affarer/); } },
      { id: 'REC-03b', present: async (p, vp) => { if (isPhone(vp)) { await V(p, '.tx-view-select select'); await V(p, 'ol.tx-cards li'); } else { expect(await p.getByRole('tablist', { name: 'Vy' }).getByRole('tab').count()).toBeGreaterThanOrEqual(3); await V(p, '.tx-table tr[data-row]'); } },
        actAt: 'all', actName: 'saved view Hela marknaden (chips; dropdown on phone)', act: async (p, vp) => {
          if (isPhone(vp)) { const sel = p.locator('.tx-view-select select'); const v = await sel.locator('option', { hasText: 'Hela marknaden' }).getAttribute('value'); await sel.selectOption(v!); await expect(p).toHaveURL(/view=/); return; }
          const t = p.getByRole('tablist', { name: 'Vy' }).getByRole('tab', { name: /Hela marknaden/ }); await t.click(); await expect(t).toHaveAttribute('aria-selected', 'true'); await expect(p).toHaveURL(/view=/); } },
      { id: 'REC-03c', present: async (p, vp) => { if (vp.width >= 1200) await V(p, 'aside.tx-drawer'); else await A(p, 'aside.tx-drawer'); },
        actAt: 'all', actName: 'row opens the deal drawer', act: async (p, vp) => { await p.locator(isPhone(vp) ? '.tx-cards .tx-card-main' : '.tx-table tr[data-row]').first().click(); await V(p, 'aside.tx-drawer:not(.tx-drawer-idle)'); await expect(p.getByRole('region', { name: 'Scouternas bedömning' })).toBeVisible(); await A(p, 'aside.tx-drawer .tx-ready'); } },
      { id: 'REC-03d', present: async (p, vp) => { await V(p, isPhone(vp) ? '.tx-court-chips .tx-court-chip' : '.tx-court .tx-court-spot'); },
        actName: 'need court filters the market', act: async (p) => { await p.locator('.tx-court .tx-court-spot').first().click(); await expect(p.locator('.tx-court .tx-court-spot').first()).toHaveAttribute('aria-pressed', 'true'); } },
    ] },
    { route: '/career/transfers?mode=salj', url: () => '/career/transfers?mode=salj', surfaces: [
      { id: 'REC-03a', present: async (p) => { await expect(p.getByRole('region', { name: 'Försäljning' })).toBeVisible(); await V(p, '.tx-sell-head h2'); await expect(p.locator('.tx-sell-lists details > summary')).toHaveCount(4); },
        actAt: 'all', actName: 'open a departure list', act: async (p) => { const s = p.locator('.tx-sell-lists details').first(); const was = await s.evaluate((d) => (d as HTMLDetailsElement).open); await s.locator('summary').click(); await expect.poll(() => s.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(!was); } },
    ] },
    { route: '/career/transfers/[playerId] (before negotiation)', url: () => `/career/transfers/${ctx.extPlayer}`, surfaces: [
      { id: 'REC-04a', present: async (p) => { await expect(p.getByRole('region', { name: 'Inled förhandling' })).toBeVisible(); await expect(p.getByRole('radiogroup', { name: 'Typ av affär' }).getByRole('radio')).toHaveCount(2); },
        actAt: 'all', actName: 'choose Permanent', act: async (p) => { const r = p.getByRole('radiogroup', { name: 'Typ av affär' }).getByRole('radio', { name: /Permanent/ }); await r.click(); await expect(r).toHaveAttribute('aria-checked', 'true'); } },
    ] },
    // ---- Competition
    { route: '/career/competitions', url: () => '/career/competitions', surfaces: [
      { id: 'CMP-01', present: async (p) => { await V(p, '.cc-page .cc-card-grid .cc-card[data-own]'); await expect(p.getByRole('heading', { name: 'Dina tävlingar', exact: true })).toBeVisible(); },
        actName: 'own competition opens the shell', act: async (p) => { await p.locator('.cc-card[data-own]').first().click(); await expect(p).toHaveURL(/\/career\/competitions\/[^/?]+/); await V(p, 'nav.cc-tabs'); } },
    ] },
    { route: '/career/competitions/swe-2?tab=table', url: () => '/career/competitions/swe-2?tab=table', surfaces: [
      { id: 'CMP-01a', present: async (p, vp) => { await V(p, 'table.cc-table'); await A(p, 'tr.cc-pinned-row'); await expect(p.locator('.cz-legend li')).toHaveCount(4); if (!isPhone(vp)) await expect(p.locator('.cz-zone').first()).toHaveText('Uppflyttning'); },
        actName: 'Hemma table view', act: async (p) => { const b = p.getByRole('group', { name: 'Tabellvy', exact: true }).getByRole('button', { name: 'Hemma', exact: true }); await b.click(); await expect(b).toHaveAttribute('aria-pressed', 'true'); await expect(p.locator('.cc-view-note')).toContainText('Hemmatabell'); } },
    ] },
    { route: '/career/competitions/swe-2?tab=fixtures', url: () => '/career/competitions/swe-2?tab=fixtures', surfaces: [
      { id: 'CMP-01b', present: async (p) => { await V(p, '.cc-rounds .cc-round'); await A(p, '.cc-round li[data-own] .cc-fx-prep'); },
        actName: 'Resultat tab in URL', act: async (p) => { await p.locator('nav.cc-tabs').getByRole('link', { name: 'Resultat', exact: true }).click(); await expect(p).toHaveURL(/\?tab=results$/); } },
    ] },
    { route: '/career/competitions/swe-2?tab=results', url: () => '/career/competitions/swe-2?tab=results', surfaces: [
      { id: 'CMP-01c', present: async (p) => { await V(p, '.cc-round li[data-own] a.cc-fx-score'); },
        actName: 'own result opens the report', act: async (p) => { await p.locator('.cc-round li[data-own] a.cc-fx-score').first().click(); await expect(p).toHaveURL(/\/career\/match-report\//); } },
    ] },
    { route: '/career/competitions/swe-2?tab=statistics', url: () => '/career/competitions/swe-2?tab=statistics', surfaces: [
      { id: 'CMP-01d', present: async (p, vp) => { await expect(p.getByRole('region', { name: 'Ledare per position' })).toBeVisible(); await V(p, '.cc-leader-card'); if (!isPhone(vp)) expect(await p.locator('.cc-leader-card:visible').count()).toBe(7); },
        actAt: 'phone', actName: 'position filter tab', act: async (p) => { const t = p.locator('.cc-leader-tabs [role=tab]').nth(1); await t.click(); await expect(t).toHaveAttribute('aria-selected', 'true'); } },
    ] },
    { route: '/career/competitions/swe-2?tab=clubs', url: () => '/career/competitions/swe-2?tab=clubs', surfaces: [
      { id: 'CMP-01e', present: async (p) => { await V(p, 'ul.cc-club-grid button.cc-club-tile'); },
        actAt: 'all', actName: 'crest opens club Peek with Scouta klubben', act: async (p) => { await p.locator('button.cc-club-tile:not([data-own])').first().click(); const peek = p.locator('.cc-club-peek[role=dialog]'); await expect(peek).toHaveAttribute('aria-label', /^Snabbtitt: /); await expect(peek.getByRole('button', { name: /^Scouta klubben/ })).toBeVisible(); await p.keyboard.press('Escape'); await expect(peek).toHaveCount(0); } },
    ] },
    { route: '/career/competitions/swe-2?tab=history', url: () => '/career/competitions/swe-2?tab=history', surfaces: [
      { id: 'CMP-01f', unreachableIf: async (p) => (await p.locator('ol.cc-honours').count()) ? null : 'roll of honour needs an archived season', present: async (p) => { await V(p, 'ol.cc-honours li'); } },
    ] },
    { route: '/career/competitions/se-svenska-cupen-herr', url: () => '/career/competitions/se-svenska-cupen-herr?tab=groups', surfaces: [
      { id: 'CMP-01g', present: async (p) => { await expect(p.getByRole('heading', { name: 'Svenska Cupen', level: 1 })).toBeVisible(); await A(p, '#cc-cup-own-h'); await expect(p.getByRole('navigation', { name: 'Cupens vyer' })).toBeVisible(); await A(p, 'ol.cc-stepper'); },
        actName: 'Matcher view', act: async (p) => { await p.getByRole('navigation', { name: 'Cupens vyer' }).getByRole('link', { name: 'Matcher', exact: true }).click(); await expect(p).toHaveURL(/se-svenska-cupen-herr\?tab=fixtures$/); } },
    ] },
    { route: '/career/competitions/[non-simulated]', url: () => '/career/competitions/den-1', surfaces: [
      { id: 'CMP-01h', present: async (p) => { await expect(p.locator('.cc-notice h2', { hasText: 'spelas inte i din karriär' })).toBeVisible(); await expect(p.locator('.cc-notice').getByRole('button', { name: /^Starta bevakning i ligan/ })).toBeVisible(); },
        actName: 'unknown id links to the overview', act: async (p) => { await p.goto(`${base}/career/competitions/finns-inte`); await shellReady(p); await V(p, '.hm-empty'); await p.getByRole('link', { name: 'Se alla tävlingar →' }).click(); await expect(p).toHaveURL(/\/career\/competitions$/); } },
    ] },
    { route: '/career/fixtures/[fixtureId]', url: () => `/career/fixtures/${ctx.upcomingFixture}`, needs: () => ctx.upcomingFixture ? null : 'no upcoming own fixture link found', surfaces: [
      { id: 'CMP-02', present: async (p) => { await V(p, '.cc-h2h-head'); await expect(p.getByRole('region', { name: 'Jämförelse' })).toBeVisible(); await expect(p.getByRole('region', { name: 'Tidigare möten' })).toBeAttached(); },
        actName: 'crest opens club Peek', act: async (p) => { await p.locator('button.cc-h2h-club').first().click(); await V(p, '.cc-club-peek[role=dialog]'); } },
    ] },
    { route: '/career/matches → /career/schedule', url: () => '/career/matches', surfaces: [
      { id: 'CMP-03', present: async (p) => { await expect(p).toHaveURL(/\/career\/schedule$/); await V(p, 'ol.sc-agenda'); } },
    ] },
    { route: '/career/statistics', url: () => '/career/statistics', surfaces: [
      { id: 'CMP-04', present: async (p) => { await A(p, '.hm-statistics-screen .cc-stat-switch select'); await expect(p.getByRole('region', { name: 'Ledare per position' })).toBeVisible(); await A(p, 'table.cc-stats-table'); },
        actAt: 'phone', actName: 'position leaderboard tab', act: async (p) => { const t = p.locator('.cc-leader-tabs [role=tab]').nth(2); await t.click(); await expect(t).toHaveAttribute('aria-selected', 'true'); } },
    ] },
    // ---- Matchday redirects and states
    { route: '/career/match-center → /career/schedule', url: () => '/career/match-center', surfaces: [
      { id: 'MDY-03', present: async (p) => { await expect(p).toHaveURL(/\/career\/schedule$/); } },
    ] },
    { route: '/career/match-2d → /career/schedule', url: () => '/career/match-2d', shell: false, surfaces: [
      { id: 'MDY-04', present: async (p) => { await expect(p).toHaveURL(/\/career\/schedule$/, { timeout: 30000 }); await shellReady(p); } },
    ] },
    { route: '/career/match-day/[upcoming fixture]', url: () => `/career/match-day/${ctx.upcomingFixture}`, needs: () => ctx.upcomingFixture ? null : 'no upcoming own fixture link found', surfaces: [
      { id: 'MDY-02m', present: async (p) => { await expect(p.locator('section.mc-state-card h2', { hasText: 'Matchen har inte startat' })).toBeVisible({ timeout: 30000 }); },
        actName: 'Öppna match → preview', act: async (p) => { await p.locator('.mc-state-actions').getByRole('link', { name: 'Öppna match' }).click(); await expect(p).toHaveURL(/\/career\/match-preview$/); } },
    ] },
    // ---- Analysis
    { route: '/career/match-report/[fixtureId]', url: () => `/career/match-report/${ctx.reportSeg}`, ready: async (p) => { await V(p, '.rp-head'); }, surfaces: [
      { id: 'ANL-01', present: async (p) => { await V(p, 'header.rp-head .rp-score .rp-num'); await expect(p.getByRole('tablist', { name: 'Rapportens delar', exact: true })).toBeVisible(); await expect(p.locator('.rp-continue').getByRole('button', { name: /Fortsätt/ })).toBeVisible(); },
        actName: 'Statistik tab (#statistik)', act: async (p) => { await p.getByRole('tablist', { name: 'Rapportens delar', exact: true }).getByRole('tab', { name: 'Statistik', exact: true }).click(); await expect(p).toHaveURL(/#statistik$/); await V(p, '#rp-panel-STATISTIK .rp-sheet'); } },
      { id: 'ANL-01a', present: async (p) => { await expect(p.getByRole('tablist', { name: 'Rapportens delar', exact: true }).getByRole('tab', { name: 'Repris', exact: true })).toBeVisible(); },
        actName: 'Repris tab: archived match center without Översikt', act: async (p) => { const panel = await openReplay(p); await expect(panel.getByRole('tablist', { name: 'Matchvy', exact: true }).getByRole('tab', { name: 'Översikt', exact: true })).toHaveCount(0); await expect(panel.locator('.mc-coach')).toHaveCount(0); } },
      { id: 'ANL-01b', present: async (p) => { await V(p, 'figure.rp-momentum svg[role=img]'); await A(p, 'ol.rp-turns > li'); await expect(p.getByRole('region', { name: 'Efter matchen' })).toBeAttached(); },
        actName: 'turning point selects', act: async (p) => { const b = p.locator('button.rp-turn-head').first(); await b.click(); await expect(b).toHaveAttribute('aria-pressed', 'true'); } },
      { id: 'ANL-01c', present: async (p) => { await A(p, 'section.rp-load'); await expect(p.getByRole('table', { name: 'Speltid och belastning per spelare' })).toBeAttached(); await expect(p.locator('.rp-load-bulk').getByRole('button', { name: /^Vila alla >50 min/ })).toBeAttached(); },
        actName: 'inline load selector', act: async (p) => { const s = p.locator('.rp-load-table select').first(); await s.scrollIntoViewIfNeeded(); await s.selectOption('REST'); await expect(s).toHaveValue('REST'); } },
      { id: 'ANL-01f', present: async (p) => { await expect(p.getByRole('region', { name: 'Pressen' })).toBeAttached(); await expect(p.locator('.rp-press-actions').getByRole('link', { name: 'Möt pressen →' })).toBeAttached(); } },
    ] },
    { route: '/career/match-report/[other club fixture]', url: () => ctx.otherReportHref, needs: () => ctx.otherReportHref ? null : 'no other club result in the played round', ready: async (p) => { await V(p, '.rp-head'); }, surfaces: [
      { id: 'ANL-01d', present: async (p) => { await expect(p.locator('#rp-tab-REPRIS')).toContainText('saknas'); await expect(p.locator('.rp-after .rp-empty', { hasText: 'Ditt lag spelade inte den här matchen.' })).toBeAttached(); },
        actName: 'Repris degrades to Ingen detaljdata', act: async (p) => { await p.getByRole('tablist', { name: 'Rapportens delar', exact: true }).getByRole('tab', { name: /^Repris/ }).click(); await expect(p.locator('#rp-panel-REPRIS .rp-empty-card h2')).toHaveText('Ingen detaljdata för den här matchen'); } },
    ] },
    { route: '/career/match-report/[unknown]', url: () => '/career/match-report/finns-inte', surfaces: [
      { id: 'ANL-01e', present: async (p) => { await expect(p.locator('section.rp-empty-card h2')).toHaveText(/saknar en rapport|kunde inte läsas/); await expect(p.locator('.rp-empty-card .rp-actions').getByRole('link', { name: '← Schema' })).toBeVisible(); },
        actName: 'route to Schema', act: async (p) => { await p.locator('.rp-empty-card').getByRole('link', { name: '← Schema' }).click(); await expect(p).toHaveURL(/\/career\/schedule$/); } },
    ] },
    { route: '/career/analysis', url: () => '/career/analysis', surfaces: [
      { id: 'ANL-02', present: async (p) => { await A(p, 'ul.an-kpis[aria-label="Nyckeltal, senaste fem mot säsongen"] li'); await V(p, 'figure.an-trend'); await expect(p.getByRole('navigation', { name: 'Vidare' })).toBeAttached(); },
        actName: 'KPI tile selects the metric', act: async (p) => { const b = p.locator('.an-kpis li button').nth(1); await b.click(); await expect(b).toHaveAttribute('aria-pressed', 'true'); } },
      { id: 'ANL-02a', present: async (p) => { await expect(p.getByRole('navigation', { name: 'Analysvyer' }).getByRole('link')).toHaveCount(4); },
        actName: 'Matcher page lists played matches', act: async (p) => { await p.getByRole('navigation', { name: 'Analysvyer' }).getByRole('link', { name: 'Matcher', exact: true }).click(); await expect(p).toHaveURL(/\/career\/analysis\/matches$/); await V(p, 'ol.an-matchlist li'); } },
    ] },
    { route: '/career/analysis/opponent', url: () => '/career/analysis/opponent', surfaces: [
      { id: 'ANL-03', present: async (p) => { await A(p, '.an-mirror-grid'); await A(p, '.an-mirror[role=table]'); await A(p, '#an-threat-h'); },
        actName: 'window toggle Hela säsongen', act: async (p) => { const b = p.getByRole('group', { name: 'Period', exact: true }).getByRole('button', { name: 'Hela säsongen', exact: true }); await b.click(); await expect(b).toHaveAttribute('aria-pressed', 'true'); } },
    ] },
    { route: '/career/analysis/our-team', url: () => '/career/analysis/our-team', surfaces: [
      { id: 'ANL-04', present: async (p) => { await V(p, '#an-team-h'); await A(p, '.an-kpis'); await expect(p.getByRole('group', { name: 'Period för hela sidan' })).toBeVisible(); },
        actName: 'window toggle drives the page', act: async (p) => { await p.getByRole('group', { name: 'Period för hela sidan' }).getByRole('button', { name: 'Hela säsongen', exact: true }).click(); await expect(p.locator('#an-team-h')).toContainText('hela säsongen'); } },
    ] },
    { route: '/career/analysis/last-match → report', url: () => '/career/analysis/last-match', surfaces: [
      { id: 'ANL-05', present: async (p) => { await p.waitForURL('**/career/match-report/**', { timeout: 30000 }); await V(p, '.rp-head'); } },
    ] },
  ];
}

// Dev tools must be gated off in this production build: 404 and no dev shell.
const GATED: { id: string; path: string }[] = [
  { id: 'SYS-02', path: '/editor' }, { id: 'SYS-02a', path: '/editor/players' }, { id: 'SYS-02b', path: '/editor/players/any-player' },
  { id: 'SYS-02c', path: '/editor/ratings' }, { id: 'SYS-02d', path: '/editor/ratings/any-player' }, { id: 'SYS-02e', path: '/editor/court-grid' },
  { id: 'SYS-03', path: '/scenario-lab' }, { id: 'SYS-03a', path: '/scenario-lab/core' }, { id: 'SYS-03b', path: '/scenario-lab/match' },
  { id: 'SYS-04', path: '/match-qa' }, { id: 'SYS-05', path: '/career/club/cpu-recruitment' }, { id: 'SYS-05', path: '/editor/cpu-recruitment' },
];

// ---------------------------------------------------------------------------------------------------------------
// Live match choreography (MDY-02*, ENT-13, DSH-01d LIVE). Played at the desktop size.
const tab = (p: Page, n: string) => p.getByRole('tablist', { name: 'Matchvy', exact: true }).getByRole('tab', { name: n, exact: true });
async function resumeIfStopped(p: Page) {
  const back = p.getByRole('button', { name: 'Återgå till match', exact: true });
  if (await back.isVisible().catch(() => false)) { await back.click().catch(() => {}); return true; }
  const resume = p.getByRole('button', { name: 'Återuppta efter timeout', exact: true });
  if (await resume.isVisible().catch(() => false)) { await resume.click().catch(() => {}); return true; }
  return false;
}

/** Persist the in-memory career before a full page load (autosave is deferred): the header's Spara button. */
async function saveNow(page: Page) {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  const btn = page.locator('header.hm-header button.game-save-quick');
  await expect(btn).toBeEnabled({ timeout: 60000 });
  await btn.click();
  await expect(page.locator('header.hm-header .game-save-indicator')).toHaveAttribute('data-phase', 'SAVED', { timeout: 60000 });
}

/** Cup ties on the way: the assistant takes the post-match press conference (the report's real Delegera action). */
async function delegatePress(page: Page) {
  const del = page.locator('.rp-press-actions').getByRole('button', { name: 'Delegera', exact: true });
  if (await del.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false)) {
    await del.click();
    await expect(page.locator('.rp-press [role=status]')).toBeVisible();
  }
}

/** Advance (Continue) to the first LEAGUE matchday. Cup ties on the way are played with SNABBRESULTAT, the real
 *  quick path (its progress card is MDY-02m). Leaves the page on the match preview with STARTA MATCH enabled. */
async function toLeagueMatchday(page: Page) {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  const start = page.getByRole('button', { name: 'STARTA MATCH →', exact: true });
  for (let n = 0; n < 40; n++) {
    await page.goto(`${base}/career/match-preview`); await shellReady(page); await settle(page);
    if (await start.isVisible()) {
      if (await start.isDisabled()) { await chooseStartingSeven(page, base); continue; }
      const stage = await page.getByRole('region', { name: 'Matchdagen' }).innerText().catch(() => '');
      console.log(`[league-matchday] ${n} start visible; stage: ${stage.replace(/\s+/g, ' ').slice(0, 160)}`);
      if (!/cup/i.test(stage)) return;
      // Cup tie: quick result.
      await page.getByRole('button', { name: 'SNABBRESULTAT', exact: true }).click();
      const confirm = page.getByRole('button', { name: 'Spela snabbresultat', exact: true });
      if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();
      await page.waitForURL(/\/career\/(match-day|match-report)\//, { timeout: 60000 });
      const card = page.getByRole('status', { name: 'Matchen spelas färdigt' });
      const seen = await card.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
      if (seen && !results['MDY-02m']?.checks.some((c) => c.name.startsWith('quick-finish'))) {
        await check('MDY-02m', '/career/match-day/[fixtureId]?finish=1', 'quick-finish progress card with 0–60 bar', DESKTOP, async () => {
          await A(page, 'section.mc-simulation');
          await expect(page.getByRole('progressbar').first()).toBeAttached();
          await page.screenshot({ path: `${shots}/career-match-day-quick-finish-desktop.png` });
        });
      }
      await page.waitForURL('**/career/match-report/**', { timeout: 180000 });
      await expect(page.locator('.rp-head')).toBeVisible({ timeout: 60000 });
      await delegatePress(page);
      await saveNow(page);
      continue;
    }
    if (/PRESS/i.test(await page.locator('.hm-continue-header').innerText().catch(() => ''))) {
      // A pre-match press conference on the way to the league match: the assistant takes it (or it is declined).
      await page.locator('.hm-continue-header').click();
      await page.waitForURL(/\/career\/(media\/press|match-report)\//, { timeout: 30000 });
      if (/match-report/.test(page.url())) await delegatePress(page);
      else {
        const del = page.getByRole('button', { name: /\(Delegera\)$/ });
        await (await del.count() ? del : page.getByRole('button', { name: 'Avböj / Hoppa över' })).first().click();
        await page.waitForTimeout(500);
      }
      await saveNow(page);
      continue;
    }
    console.log(`[league-matchday] ${n} continue at ${page.url()} from ${await page.locator('.hm-header-sub').innerText({ timeout: 2000 }).catch(() => '?')}`);
    console.log(`[league-matchday] label: ${(await page.locator('.hm-continue-header').innerText().catch(() => '?')).replace(/\s+/g, ' ')}`);
    if (process.env.HM_SWEEP_DEBUG && n >= 9 && n < 11) await page.screenshot({ path: `${process.env.HM_SWEEP_DEBUG}/adv-${n}.png` });
    await page.locator('.hm-continue-header').click();
    await expect(page.locator('.game-world-advance')).toHaveCount(0, { timeout: 90000 });
    if (/\/career\/tactics/.test(page.url())) await chooseStartingSeven(page, base);
    await saveNow(page);
  }
  throw new Error('no league matchday reached within 40 Continue presses');
}

async function playLiveMatch(page: Page) {
  const L = '/career/match-day/[fixtureId]';
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await page.goto(`${base}/career/match-preview`);
  await shellReady(page);
  await readyStartMatch(page, base);
  await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).click();
  // MDY-01b: fix-it confirm dialog appears only when the squad check raises warnings.
  const dialog = page.locator('dialog.hm-dialog[data-tone="warning"]');
  const warned = await dialog.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
  if (warned) {
    await check('MDY-01b', '/career/match-preview', 'fix-it dialog lists warnings; Avbryt closes', DESKTOP, async () => {
      await V(page, 'dialog.hm-dialog ul.md-fixes li');
      await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click();
      await expect(dialog).toHaveCount(0);
    });
    await page.getByRole('button', { name: 'STARTA MATCH →', exact: true }).click();
    await page.getByRole('button', { name: 'Starta matchen', exact: true }).click();
  } else if (!/match-day/.test(page.url())) {
    const confirm = page.getByRole('button', { name: 'Starta matchen', exact: true });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
  }
  if (!warned) notReachable('MDY-01b', '/career/match-preview', 'squad check raised no warnings, so the fix-it dialog is not shown');
  await page.waitForURL('**/career/match-day/**', { timeout: 60000 });
  await expect(page.locator('.mc-match')).toBeVisible({ timeout: 60000 });

  await check('MDY-02', L, 'walk-out phase with both sevens and phase chip', DESKTOP, async () => {
    await expect(page.locator('.mc-match[data-match-mode="MATCH_CENTER"]')).toBeVisible();
    await V(page, '.mc-match[data-flow-phase="walkout"] section.mc-walkout');
    await V(page, '.mc-phase-chip');
  });
  await check('MDY-02a', L, 'score bug: half, manpower and timeout pips', DESKTOP, async () => {
    const bug = page.locator('.mc-workspace-nav .mc-scorebug-meta');
    await expect(bug.locator('.mc-scorebug-half')).toHaveText('1:a halvlek');
    await expect(bug.locator('.mc-pips')).toHaveCount(4);
    await expect(bug.getByRole('img', { name: /utespelare på plan/ })).toHaveCount(2);
    await V(page, '.mc-workspace-nav .mc-score-figure');
  });
  await check('MDY-02b', L, 'transport: primary, 7-step speed radiogroup, next event, Mer', DESKTOP, async () => {
    await V(page, '.mc-transport .mc-transport-primary');
    await expect(page.getByRole('radiogroup', { name: 'Matchhastighet', exact: true }).getByRole('radio')).toHaveCount(7);
    await expect(page.getByRole('button', { name: 'Nästa viktiga händelse', exact: true })).toBeVisible();
    await expect(page.locator('.mc-transport-more').getByRole('button', { name: 'Mer', exact: true })).toBeVisible();
    await setMatchSpeed(page, 20);
  });
  await check('MDY-02g', L, 'bench dock with timeout and subs sections; collapse subs', DESKTOP, async () => {
    await V(page, 'aside.mc-dock[aria-label="Dina matchbeslut"]');
    await A(page, '.mc-dock-section[data-section="timeout"]');
    await A(page, '.mc-dock-section[data-section="subs"]');
    const fold = page.getByRole('button', { name: 'Fäll ihop byten', exact: true });
    if (await fold.isVisible()) { await fold.click(); await expect(page.getByRole('button', { name: 'Visa byten', exact: true })).toHaveAttribute('aria-expanded', 'false'); await page.getByRole('button', { name: 'Visa byten', exact: true }).click(); }
  });
  await check('MDY-02', L, 'Spela moves walk-out to live', DESKTOP, async () => {
    await page.getByRole('button', { name: 'Spela', exact: true }).click();
    await expect(page.locator('.mc-match')).toHaveAttribute('data-flow-phase', /live|huddle/);
  });
  await check('MDY-02c', L, 'live overview: commentary, key moment inspect + Följ live, numbers', DESKTOP, async () => {
    await expect(page.locator('.mc-live-now .mc-commentary li').first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('region', { name: 'Matchen i siffror' })).toBeVisible();
    // Key plays (goals, saves, breakthroughs) carry a replay reference and become tappable in the feed.
    await expect(page.locator('.mc-live-now .mc-commentary li button').first()).toBeVisible({ timeout: 120000 });
    await page.getByRole('button', { name: 'Pausa', exact: true }).click().catch(() => {});
    await page.locator('.mc-live-now .mc-commentary li button').first().click();
    await V(page, '.mc-follow-live');
    await page.locator('.mc-follow-live').click();
    await expect(page.locator('.mc-follow-live')).toHaveCount(0);
  });
  await resumeIfStopped(page);
  const pause = page.getByRole('button', { name: 'Pausa', exact: true });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  await check('MDY-02e', L, 'energy-forward player table; Byt opens the dock', DESKTOP, async () => {
    await tab(page, 'Spelare').click();
    await V(page, 'table.mc-energy-table tbody tr');
    await expect(page.getByRole('combobox', { name: 'Sortera' })).toBeVisible();
    await page.getByRole('button', { name: /^Förbered byte: / }).first().click();
    await V(page, '.mc-dock .coach-live-in');
  });
  await check('MDY-02f', L, 'Avslut shot-map board with outcome filter', DESKTOP, async () => {
    await tab(page, 'Statistik').click();
    await page.locator('.mc-analysis-nav').getByRole('button', { name: 'Avslut', exact: true }).click();
    await expect(page.locator('.mc-stat-workspace')).toHaveAttribute('data-section', 'shots');
    await V(page, 'section.mc-shot-board svg.mc-shot-map');
    await page.getByLabel('Utfall', { exact: true }).selectOption('GOAL');
  });
  await check('MDY-02d', L, 'timeline scrubber markers select a moment', DESKTOP, async () => {
    await tab(page, 'Nyckelögonblick').click();
    await V(page, 'figure.mc-timeline .mc-timeline-track');
    await page.locator('.mc-timeline-marker').first().click();
    await expect(page.locator('.mc-timeline-marker[aria-current="true"]')).toHaveCount(1);
  });
  await check('MDY-02l', L, 'Plan view with trails toggle and manpower overlay', DESKTOP, async () => {
    await showCourt2D(page);
    await A(page, '.mc-plan-overlay');
    const t = page.locator('button.mc-plan-trails-toggle');
    const before = await t.getAttribute('aria-pressed');
    await t.click();
    await expect(t).not.toHaveAttribute('aria-pressed', before ?? 'x');
  });
  await tab(page, 'Översikt').click().catch(() => {});

  // Timeout huddle (MDY-02h): needs own possession; play until the dock's Timeout is enabled.
  await setMatchSpeed(page, 10);
  let huddled = false;
  await check('MDY-02h', L, 'own timeout opens the huddle; directive card; Återgå till match', DESKTOP, async () => {
    const play = page.getByRole('button', { name: 'Spela', exact: true });
    if (await play.isVisible()) await play.click();
    const to = page.getByRole('button', { name: 'Timeout', exact: true });
    await expect(to).toBeEnabled({ timeout: 90000 });
    await to.click();
    huddled = true;
    await expect(page.getByRole('dialog', { name: 'Lagtimeout' })).toBeVisible({ timeout: 30000 });
    await V(page, '.mc-huddle-cards .mc-huddle-card');
    await page.locator('.mc-huddle-card').first().click();
    await expect(page.locator('.mc-huddle-card').first()).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Återgå till match', exact: true }).click();
    await expect(page.locator('.mc-huddle')).toHaveCount(0);
  });
  if (!huddled) await resumeIfStopped(page);

  // Half-time briefing (MDY-02i).
  await setMatchSpeed(page, 86);
  const play = page.getByRole('button', { name: 'Spela', exact: true });
  if (await play.isVisible().catch(() => false)) await play.click();
  const secondHalf = page.getByRole('button', { name: 'Starta andra halvlek', exact: true });
  await expect(async () => {
    await resumeIfStopped(page);
    if (await page.getByRole('button', { name: 'Spela', exact: true }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Spela', exact: true }).click().catch(() => {});
    await expect(secondHalf.first()).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 300000 });
  await check('MDY-02i', L, 'half-time briefing with numbers and Starta andra halvlek', DESKTOP, async () => {
    await expect(page.getByRole('region', { name: 'Halvtidsgenomgång' })).toBeVisible();
    await V(page, '.mc-ht-panel[data-panel="numbers"]');
    await expect(page.locator('.mc-scorebug-half')).toHaveText('Halvtid');
  });
  // Live route health at the three viewports (half-time is a stable frame).
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(600);
    const ov = await overflow(page);
    (routeHealth[L] ??= {})[vp.name] = { overflow: ov, pageErrors: pageErrors.filter((e) => /match-day/.test(e.url)).map((e) => e.message), ok: ov <= 1 };
    for (const id of ['MDY-02', 'MDY-02a', 'MDY-02b', 'MDY-02i']) {
      await check(id, L, 'no horizontal overflow (live, half-time)', vp, async () => { expect(ov).toBeLessThanOrEqual(1); });
    }
    await check('MDY-02b', L, 'transport at this viewport (primary action moved into the half-time card)', vp, async () => {
      await V(page, '.mc-transport-more'); await V(page, '.mc-halftime-start button');
      if (vp.width > 900) { await V(page, '.mc-transport-next'); await expect(page.locator('.mc-transport-next')).toBeDisabled(); await expect(page.getByRole('radiogroup', { name: 'Matchhastighet', exact: true })).toBeVisible(); }
      else { expect(await page.locator('.mc-match .mc-transport').evaluate((e) => getComputedStyle(e).position)).toBe('fixed'); await V(page, '.mc-speed-toggle'); }
    });
    if (vp.name !== 'tablet') await page.screenshot({ path: `${shots}/career-match-day-live-${vp.name}.png`, fullPage: vp.name === 'desktop' });
  }
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });

  // Leave the live match in-app: live pill (ENT-13) and the LIVE front page (DSH-01d), then back via the pill.
  await page.locator('nav.hm-rail').getByRole('link', { name: 'Idag', exact: true }).click();
  await page.waitForURL(/\/career$/);
  await check('ENT-13', '/career/* (away from live match)', 'live score pill in the top bar; click returns to the match', DESKTOP, async () => {
    await V(page, 'header.hm-header a.hm-live-pill.hm-live-pill-header');
    await A(page, '.hm-live-pill .hm-live-dot');
    await page.locator('a.hm-live-pill-header').click();
    await expect(page).toHaveURL(/\/career\/match-day\//);
  });
  if (/match-day/.test(page.url())) {
    await page.locator('nav.hm-rail').getByRole('link', { name: 'Idag', exact: true }).click();
    await page.waitForURL(/\/career$/);
  }
  await check('DSH-01d', '/career', "state front page: lead 'Matchen pågår' while live", DESKTOP, async () => {
    await expect(page.locator('.hm-front-lead[data-kind="LIVE"] h2')).toHaveText('Matchen pågår');
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await check('ENT-13', '/career/* (away from live match)', 'phone pill under the spine', VPS[2]!, async () => { await V(page, '.hm-spine-row .hm-live-pill-row a.hm-live-pill'); });
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  if (!/match-day/.test(page.url())) await page.locator('a.hm-live-pill-header').click();
  await page.waitForURL('**/career/match-day/**');
  await expect(page.locator('.mc-match')).toBeVisible({ timeout: 60000 });

  await check('MDY-02i', L, 'Starta andra halvlek resumes in the 2nd half', DESKTOP, async () => {
    await secondHalf.first().click();
    await expect(page.locator('.mc-scorebug-half')).toHaveText('2:a halvlek');
    await expect(page.locator('.mc-halftime')).toHaveCount(0);
  });
  // Play the second half manually so the final whistle card renders (playToEnd skips it).
  await setMatchSpeed(page, 86);
  const finalCard = page.getByRole('region', { name: 'Slutsignal' });
  await expect(async () => {
    await resumeIfStopped(page);
    if (await page.getByRole('button', { name: 'Spela', exact: true }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Spela', exact: true }).click().catch(() => {});
    await expect(finalCard).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 400000 });
  await check('MDY-02j', L, 'final whistle card with verdict, score and next step', DESKTOP, async () => {
    await V(page, '.mc-final-tag');
    await V(page, '.mc-final-score strong');
    await page.screenshot({ path: `${shots}/career-match-day-final-whistle-desktop.png` });
    await page.locator('.mc-final-action').getByRole('button', { name: 'Slutför match och öppna rapport', exact: true }).click();
    await page.waitForURL('**/career/match-report/**', { timeout: 90000 });
    await V(page, '.md-report-head h2, .rp-head');
  });
  if (!/match-report/.test(page.url())) {
    const fin = page.getByRole('button', { name: 'Slutför match och öppna rapport', exact: true });
    if (await fin.isVisible().catch(() => false)) await fin.click();
    await page.waitForURL('**/career/match-report/**', { timeout: 90000 });
  }
  await expect(page.locator('.rp-head')).toBeVisible({ timeout: 60000 });
  await saveNow(page);
  notReachable('MDY-02k', L, 'assistant dock renders only while the manager is suspended by Disciplinnämnden');
}

// ---------------------------------------------------------------------------------------------------------------
async function collectIds(page: Page) {
  await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
  await page.goto(`${base}/career/squad`); await shellReady(page);
  const links = page.locator('.hm-matrix-table tbody .hm-chip-name a');
  await expect(links.first()).toBeVisible();
  ctx.ownPlayers = (await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')))).map(seg).filter(Boolean).slice(0, 2);

  await page.goto(`${base}/career/players`); await shellReady(page);
  ctx.extPlayer = seg(await page.locator('.hm-market-table tbody .game-player-cell a').first().getAttribute('href'));

  await page.goto(`${base}/career/schedule`); await shellReady(page);
  ctx.clubId = seg(await page.locator('.sc-opp a.hm-club-link').first().getAttribute('href'));

  await page.goto(`${base}/career/staff`); await shellReady(page);
  await page.locator('.sf-row .sf-linkish').first().click();
  ctx.staffId = seg(await page.locator('.sf-peek').getByRole('link', { name: 'Öppna profilen →' }).getAttribute('href'));
  await page.goto(`${base}/career/staff/recruitment`); await shellReady(page);
  ctx.extStaffId = seg(await page.locator('.sf-market-table tbody td[data-label="Namn"] a').first().getAttribute('href').catch(() => null));

  await page.goto(`${base}/career/media`); await shellReady(page);
  ctx.storyId = seg(await page.locator('a[href^="/career/media/story/"]').first().getAttribute('href').catch(() => null));
  ctx.pressId = seg(await page.locator('a[href^="/career/media/press/"]').first().getAttribute('href').catch(() => null));

  await page.goto(`${base}/career/analysis/last-match`);
  await page.waitForURL('**/career/match-report/**', { timeout: 60000 });
  ctx.reportSeg = seg(page.url());
  await expect(page.locator('.rp-head')).toBeVisible({ timeout: 60000 });
  ctx.playedPlayer = seg(await page.locator('section.rp-load a[href^="/career/squad/"]').first().getAttribute('href', { timeout: 30000 }).catch(() => null));
  if (!ctx.pressId) ctx.pressId = seg(await page.locator('a[href^="/career/media/press/"]').first().getAttribute('href', { timeout: 15000 }).catch(() => null));

  await page.goto(`${base}/career/competitions/swe-2?tab=results`); await shellReady(page);
  ctx.otherReportHref = (await page.locator('.cc-round li:not([data-own]) a.cc-fx-score').first().getAttribute('href').catch(() => null)) ?? '';
  await page.goto(`${base}/career/competitions/swe-2`); await shellReady(page);
  ctx.upcomingFixture = seg(await page.locator('.cc-own-next a[href*="/career/fixtures/"]').first().getAttribute('href').catch(() => null))
    || seg(await page.locator('a[href*="/career/fixtures/"]').first().getAttribute('href').catch(() => null));

  // Thread deep links (?message=) as the front page's ranked briefs link them (DSH-01h).
  await page.goto(`${base}/career`); await shellReady(page);
  const brief = await page.locator('a[href*="/career/inbox?message="]').first().getAttribute('href').catch(() => null);
  ctx.messageId = brief ? new URL(brief, base).searchParams.get('message') ?? '' : '';
  writeFileSync(`${shots}/sweep-ids.json`, JSON.stringify(ctx, null, 1));
}

// ---------------------------------------------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' });

test('arena 231 sweep: fresh career, one live match, every player-facing route at three sizes', async ({ browser }) => {
  test.setTimeout(4 * 60 * 60 * 1000);
  mkdirSync(shots, { recursive: true });
  const context = await newCareerContext(browser, RESUME ?? undefined);
  const page = await context.newPage();
  watch(page);
  try {
    if (!RESUME) {
      await test.step('1. fresh career (entry surfaces on the way)', async () => {
        await createCareer(page, { start: 'Vid första tävlingsmatchen', name: 'Arena Sweep', record: true });
      });
      await test.step('2. pre-match surfaces', async () => {
        await sweepRoute(page, FRONT_PRE);
        await sweepRoute(page, TACTICS_PRE);
        await sweepRoute(page, TRAINING_PRE);
        // MDY-01c blocked tile (before a starting seven exists): reason + 'Rätta i Taktik →'.
        await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
        await page.goto(`${base}/career/match-preview`); await shellReady(page); await settle(page);
        const blocked = page.locator('.md-ritual li[data-state="block"]');
        if (await blocked.count()) {
          await check('MDY-01c', '/career/match-preview', "blocked ritual tile with reason and 'Rätta i Taktik →'", DESKTOP, async () => {
            await V(page, '.md-ritual li[data-state="block"] .md-tile-fix');
            await page.locator('.md-ritual li[data-state="block"] .md-tile-fix').first().click();
            await expect(page).toHaveURL(/\/career\/tactics/);
          });
        }
        await chooseStartingSeven(page, base);
        await toLeagueMatchday(page);
        await sweepRoute(page, PREVIEW);
      });
      await test.step('3. one league match played live', async () => { await playLiveMatch(page); });
      if (process.env.HM_SWEEP_SAVE_STATE) await context.storageState({ path: process.env.HM_SWEEP_SAVE_STATE, indexedDB: true }).catch((e) => console.warn(`state not saved: ${short(e)}`));
    }
    await enterCareerAfterLoad(page).catch(() => {});
    await test.step('4a. collect ids', async () => { await page.goto(`${base}/career`); await enterCareerAfterLoad(page); await collectIds(page); });

    await test.step('4b. every player-facing route', async () => {
      for (const def of postMatchRoutes()) {
        await sweepRoute(page, def);
      }
    });

    await test.step('4c. dev tools gated off', async () => {
      if (ONLY && !ONLY.test('gated')) return;
      for (const g of GATED) {
        await check(g.id, g.path, 'gated: 404, no dev shell', DESKTOP, async () => {
          const r = await page.goto(`${base}${g.path}`);
          // notFound() in a streamed layout may answer 200 with the not-found page; either way the tool is gated off.
          console.log(`[gated] ${g.path} -> HTTP ${r!.status()}`);
          expect([200, 404]).toContain(r!.status());
          await expect(page.locator('h1.next-error-h1')).toHaveText('404');
          await expect(page.getByText('This page could not be found.')).toBeVisible();
          await expect(page.locator('.hm-dev, .hm-dev-ribbon')).toHaveCount(0);
        });
      }
      await check('SYS-06', '* (root layout)', 'DEV corner absent; editor status disabled', DESKTOP, async () => {
        const s = await page.request.get(`${base}/api/editor/status`);
        expect(await s.json()).toEqual({ enabled: false });
        await page.goto(`${base}/career`); await shellReady(page);
        await expect(page.locator('.hm-dev-corner')).toHaveCount(0);
        await expect(page.getByRole('menu', { name: 'Utvecklarmeny' })).toHaveCount(0);
      });
    });

    await test.step('4d. negotiation room after START (state-changing, run late)', async () => {
      if (ONLY && !ONLY.test('/career/transfers/[playerId]')) return;
      const R = '/career/transfers/[playerId] (negotiation)';
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await page.goto(`${base}/career/transfers/${ctx.extPlayer}`); await shellReady(page); await settle(page);
      const permanent = page.getByRole('radiogroup', { name: 'Typ av affär' }).getByRole('radio', { name: /Permanent/ });
      if (await permanent.isVisible().catch(() => false)) await permanent.click();
      await check('REC-04', R, "START: 'Öppna förhandlingen →' opens the term sheet", DESKTOP, async () => {
        await page.getByRole('button', { name: 'Öppna förhandlingen →' }).click();
        await V(page, '.tx-room');
        await expect(page.getByRole('table', { name: 'Villkoren, vårt bud mot deras krav' })).toBeVisible({ timeout: 30000 });
        await saveNow(page);
      });
      await sweepRoute(page, { route: R, url: () => `/career/transfers/${ctx.extPlayer}`, surfaces: [
        { id: 'REC-04', present: async (p) => { await V(p, '.tx-room'); await expect(p.getByRole('region', { name: 'Nästa beslut' })).toBeAttached(); await expect(p.getByRole('complementary', { name: 'Budgetpåverkan' })).toBeAttached(); await A(p, '.tx-sticky'); } },
        { id: 'REC-04b', present: async (p) => { await A(p, '.tx-sheet .tc-band'); await expect(p.locator('.tc-band input[type=range]')).toBeAttached(); },
          actName: 'fee slider moves our bid on the band', act: async (p) => { const s = p.locator('.tc-band input[type=range]').first(); await s.focus(); const v0 = await s.inputValue(); await p.keyboard.press('ArrowRight'); await expect(s).not.toHaveValue(v0); await expect(p.locator('.tc-band-legend li[data-k="bid"]')).toContainText('Ert bud'); } },
      ] });
      // REC-04d: submitting the bid (a real offer in this throwaway career) shows the waiting card.
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await page.goto(`${base}/career/transfers/${ctx.extPlayer}`); await shellReady(page); await settle(page);
      await check('REC-04d', R, 'submit bid → waiting card with answer date', DESKTOP, async () => {
        const fee = page.getByLabel(/^Övergångssumma \(/);
        if (await fee.count()) {
          const left = Number((await page.getByRole('complementary', { name: 'Budgetpåverkan' }).innerText().catch(() => '')).match(/TRANSFERRAM\s*([\d\s\u00a0]+)/i)?.[1]?.replace(/\D/g, '') || 0);
          if (left > 0) { await fee.fill(String(Math.floor(left * 0.8))); await fee.press('Tab'); }
        }
        await page.getByRole('button', { name: /^(Lägg budet|Lägg fram villkoren)/ }).first().click();
        await expect(page.getByRole('region', { name: 'Väntar på svar' })).toBeVisible({ timeout: 30000 });
        await V(page, '.tx-wait-card h3');
        await expect(page.getByRole('button', { name: /Spela fram till svaret|Fortsätt fram till svaret/ }).or(page.locator('.tx-wait-actions .tx-blocked')).first()).toBeVisible();
        await saveNow(page);
      });
      await sweepRoute(page, { route: `${R} waiting`, url: () => `/career/transfers/${ctx.extPlayer}`, surfaces: [
        { id: 'REC-04d', present: async (p) => { await expect(p.getByRole('region', { name: 'Väntar på svar' })).toBeVisible(); } },
      ] });
      // REC-04c package builder: a free agent goes straight to the player stage.
      await page.goto(`${base}/career/transfers?view=marknad`); await shellReady(page); await settle(page);
      const freeRow = page.locator('.tx-table tr[data-row]', { hasText: 'Kontraktslös' }).first();
      if (await freeRow.count()) {
        await freeRow.click();
        const href = await page.locator('.tx-drawer-actions a[href^="/career/squad/"]').first().getAttribute('href');
        const fa = seg(href);
        await page.goto(`${base}/career/transfers/${fa}`); await shellReady(page); await settle(page);
        await check('REC-04c', R, 'free agent START → package builder', DESKTOP, async () => {
          await page.getByRole('button', { name: 'Öppna förhandlingen →' }).click();
          const years = page.getByRole('radiogroup', { name: 'Kontraktslängd' });
          await expect(years).toBeVisible({ timeout: 30000 });
          await expect(page.getByRole('combobox', { name: 'Utlovad roll' })).toBeVisible();
          await years.getByRole('radio', { name: '4', exact: true }).click();
          await expect(years.getByRole('radio', { name: '4', exact: true })).toHaveAttribute('aria-checked', 'true');
          await A(page, '.tx-impact .tx-total [data-k="total"]');
          await saveNow(page);
        });
        await sweepRoute(page, { route: '/career/transfers/[freeAgentId]', url: () => `/career/transfers/${fa}`, surfaces: [
          { id: 'REC-04c', present: async (p) => { await expect(p.getByRole('radiogroup', { name: 'Kontraktslängd' })).toBeVisible(); } },
        ] });
      } else notReachable('REC-04c', R, "no 'Kontraktslös' free agent in the market; a contracted player only reaches the package stage after the club accepts (days of play)");
      notReachable('REC-04e', R, 'floodlight signing moment needs a completed deal (club and player acceptance over several game days)');
      notReachable('REC-05', '/career/transfers/offers/[offerId]', 'no incoming bid was generated for an own player during the sweep');
      notReachable('REC-05a', '/career/transfers/offers/[offerId]', 'farewell needs a completed sale');
    });

    await test.step('5a. Continue: overlay and progression stops', async () => {
      if (ONLY && !ONLY.test('continue')) return;
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await page.goto(`${base}/career`); await shellReady(page); await settle(page);
      let overlay = false;
      for (let n = 0; n < 8 && !overlay; n++) {
        if (/PRESS/i.test(await page.locator('.hm-continue-header').innerText().catch(() => ''))) {
          await page.locator('.hm-continue-header').click();
          await page.waitForURL(/\/career\/(media\/press|match-report)\//, { timeout: 30000 });
          if (/match-report/.test(page.url())) await delegatePress(page);
          else { const del = page.getByRole('button', { name: /\(Delegera\)$/ }); await (await del.count() ? del : page.getByRole('button', { name: 'Avböj / Hoppa över' })).first().click(); await page.waitForTimeout(500); }
          await saveNow(page);
          await page.locator('nav.hm-rail').getByRole('link', { name: 'Idag', exact: true }).click(); await page.waitForURL(/\/career$/);
          continue;
        }
        await page.locator('button.game-continue.hm-continue-header').click();
        overlay = await page.locator('dialog.game-world-advance.hm-advance').waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
        if (overlay) {
          await check('ENT-10a', '/career/*', 'Continue overlay: calendar flip then stop/floodlight card', DESKTOP, async () => {
            await A(page, '.hm-advance .hm-advance-calendar .hm-advance-page');
            await expect(page.locator('dialog.hm-advance')).toHaveAttribute('data-stage', /stop|floodlight/, { timeout: 20000 });
            await page.screenshot({ path: `${shots}/continue-overlay-desktop.png` });
          });
          await page.keyboard.press('Escape').catch(() => {});
        }
        await expect(page.locator('.game-world-advance')).toHaveCount(0, { timeout: 90000 }).catch(async () => { await page.locator('.hm-advance').getByRole('button').last().click().catch(() => {}); });
        await saveNow(page);
        if (!/\/career$/.test(page.url()) && !overlay) { await page.locator('nav.hm-rail').getByRole('link', { name: 'Idag', exact: true }).click(); await page.waitForURL(/\/career$/); }
      }
      if (!overlay) notReachable('ENT-10a', '/career/*', 'Continue never advanced more than one day');
      await settle(page);
      if (await page.locator('button.hm-stop-pin').count()) {
        await check('ENT-09a', '/career/*', 'numbered stop pins with one expanded event card; close', DESKTOP, async () => {
          await expect(page.getByRole('group', { name: 'Därför stannade tiden' }).locator('button.hm-stop-pin').first()).toBeVisible();
          await V(page, 'aside.game-progression-notice.hm-event-card');
          await page.locator('aside.hm-event-card button.hm-event-close').click();
          await expect(page.locator('aside.hm-event-card')).toHaveCount(0);
        });
      } else notReachable('ENT-09a', '/career/*', 'Continue did not stop on events after the match');
    });

    await test.step('5b. hard-to-reach states (checked, recorded honestly)', async () => {
      if (ONLY && !ONLY.test('states')) return;
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await page.goto(`${base}/career`); await shellReady(page); await settle(page);
      if (await page.locator('.hm-curtain').count()) {
        await check('DSH-01c', '/career (seasonComplete)', 'season curtain skippable', DESKTOP, async () => { await page.locator('.hm-curtain').getByRole('button', { name: 'Hoppa över' }).click(); await expect(page.locator('.hm-curtain')).toHaveCount(0); });
      } else notReachable('DSH-01c', '/career (seasonComplete)', 'season is not complete after one league match');
      await page.goto(`${base}/career/board`); await shellReady(page); await settle(page);
      if (await page.locator('.bm-verdict').count()) await check('CLB-05a', '/career/board', 'verdict stamp overlay', DESKTOP, async () => { await V(page, '.bm-verdict'); });
      else notReachable('CLB-05a', '/career/board', 'no board verdict dated today');
      if (await page.locator('.bm-meeting[role=dialog], section.bm-pinned').count()) await check('CLB-05b', '/career/board', 'meeting modal with option cards', DESKTOP, async () => { await A(page, '.bm-options .bm-option'); });
      else notReachable('CLB-05b', '/career/board', 'no open board decision (recovery plan or contract offer)');
      await page.goto(`${base}/career/season`); await shellReady(page); await settle(page);
      const sm = page.getByRole('tab', { name: /^SM-slutspel/ });
      if (await sm.count()) {
        await sweepRoute(page, { route: '/career/season (ghost bracket)', url: () => '/career/season', surfaces: [
          { id: 'MGR-03a', present: async (p) => { await expect(p.getByRole('tab', { name: /^SM-slutspel/ })).toBeVisible(); },
            actAt: 'all', actName: 'SM-slutspel tab shows the ghost bracket', act: async (p) => { await p.getByRole('tab', { name: /^SM-slutspel/ }).click(); await V(p, 'ol.pg-bracket'); await A(p, 'article.pg-ghost'); expect(await overflow(p)).toBeLessThanOrEqual(1); } },
        ] });
      } else notReachable('MGR-03a', '/career/season', 'no ghost bracket: the career tables do not include Handbollsligan / SM ties');
      if (await page.locator('.pg-gala-launch').count()) await check('MGR-03b', '/career/season', 'gala launch', DESKTOP, async () => { await V(page, '.pg-gala-launch'); });
      else notReachable('MGR-03b', '/career/season', 'gala needs a completed season with awards');
      await page.goto(`${base}/career/medical`); await shellReady(page); await settle(page);
      if (await page.locator('ul.md-cards li.md-card').count()) {
        await sweepRoute(page, { route: '/career/medical (injuries)', url: () => '/career/medical', surfaces: [
          { id: 'MED-01a', present: async (p) => { await V(p, 'ul.md-cards li.md-card .md-steps'); await expect(p.getByRole('progressbar', { name: /Rehabilitering/ }).first()).toBeAttached(); } },
          { id: 'MED-01', present: async (p, vp) => { await A(p, '.md-tl .md-tl-rows'); if (!isPhone(vp)) await V(p, '.md-tl-fixtures'); } },
        ] });
      } else notReachable('MED-01a', '/career/medical', 'no injured player in the squad');
      // External dossier rehab timeline: only when an own player is injured.
      notReachable('TRN-01f', '/career/training', 'skeleton is a transient Suspense fallback, not observable once the page is hydrated');
      notReachable('MDY-01f', '/career/match-preview', 'needs a completed season or no remaining fixture');
    });

    await test.step('5c. locked / empty contexts (ENT-01, ENT-04b, ENT-02 welcome)', async () => {
      if (ONLY && !ONLY.test('empty')) return;
      const locked = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const lp = await locked.newPage(); watch(lp);
      for (const vp of [DESKTOP, VPS[2]!]) {
        await lp.setViewportSize({ width: vp.width, height: vp.height });
        await lp.goto(`${base}/`);
        await check('ENT-01', '* (alpha gate)', 'ticket gate over the backdrop; wrong code shows the message', vp, async () => {
          await V(lp, 'main.alpha-gate.ce-turnstile section.ce-ticket');
          await lp.getByLabel('Accesskod', { exact: true }).fill('fel-kod');
          await lp.getByRole('button', { name: 'Lås upp', exact: true }).click();
          await expect(lp.locator('#alpha-error.alpha-error')).toHaveText('Ogiltig testkod. Kontrollera koden och försök igen.');
          expect(await overflow(lp)).toBeLessThanOrEqual(1);
        });
        await lp.screenshot({ path: `${shots}/alpha-gate-${vp.name}.png` });
      }
      await locked.close();
      const empty = await newCareerContext(browser);
      const ep = await empty.newPage(); watch(ep);
      for (const vp of VPS) {
        await ep.setViewportSize({ width: vp.width, height: vp.height });
        await ep.goto(`${base}/load-game`); await settle(ep);
        await check('ENT-04b', '/load-game', 'invitation empty state without saves', vp, async () => {
          await expect(ep.locator('section.ce-state-card.ce-invite').getByRole('link', { name: 'Skapa en karriär →' })).toBeVisible({ timeout: 30000 });
          expect(await overflow(ep)).toBeLessThanOrEqual(1);
        });
        await ep.goto(`${base}/`); await settle(ep);
        await check('ENT-02', '/', 'welcome cover without saves (NYTT SPEL)', vp, async () => {
          await V(ep, 'main.ce-cover');
          await expect(ep.getByText('NYTT SPEL').first()).toBeVisible();
          expect(await overflow(ep)).toBeLessThanOrEqual(1);
        });
      }
      await empty.close();
    });

    await test.step('5d. pre-season career (WLD-06a) and resigning (MGR-01c, DSH-01d)', async () => {
      if (ONLY && !ONLY.test('preseason')) return;
      await createCareer(page, { start: '2 veckor före seriestart', name: 'Preseason Sweep', record: false });
      await sweepRoute(page, { route: '/career/schedule (pre-season)', url: () => '/career/schedule', surfaces: [
        { id: 'WLD-06a', present: async (p) => { await expect(p.locator('section.sc-preseason h2', { hasText: 'Försäsongen' })).toBeVisible(); await A(p, 'ol.sc-days button'); },
          actAt: 'all', actName: 'free day opens the planner', act: async (p) => { await p.locator('.sc-days button').first().click(); await V(p, 'aside.sc-drawer'); expect(await overflow(p)).toBeLessThanOrEqual(1); } },
      ] });
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await page.goto(`${base}/career/manager`); await shellReady(page); await settle(page);
      await check('MGR-01c', '/career/manager', 'resign → clubless identity and front-page lead', DESKTOP, async () => {
        await page.getByRole('button', { name: 'Avgå som huvudtränare…' }).click();
        await page.getByRole('button', { name: 'Ja, jag avgår' }).click();
        await saveNow(page);
        await page.locator('nav.hm-rail').getByRole('link', { name: 'Idag', exact: true }).click();
        await page.waitForURL(/\/career$/); await shellReady(page);
        await expect(page.locator('.hm-front-lead[data-kind="SEEKING_JOB"]')).toContainText('Du står utan klubb');
        await A(page, '.hm-clubless-mark');
        await page.screenshot({ path: `${shots}/unemployed-front-desktop.png` });
      });
      await check('DSH-01d', '/career', "state front page: 'Du står utan klubb'", DESKTOP, async () => {
        await expect(page.locator('.hm-front-lead[data-kind="SEEKING_JOB"] h2')).toBeVisible();
      });
      await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(500);
      await check('MGR-01c', '/career', 'clubless front page on phone, no overflow', VPS[2]!, async () => { await V(page, '.hm-front-lead[data-kind="SEEKING_JOB"]'); expect(await overflow(page)).toBeLessThanOrEqual(1); });
    });
  } finally {
    writeResults();
    await context.close().catch(() => {});
  }

  const failed = Object.entries(results).filter(([, r]) => !r.passed && !r.reason).map(([id, r]) => `${id}: ${r.checks.filter((c) => !c.passed).map((c) => `${c.name}@${c.viewport}: ${c.error}`).join(' | ')}`);
  expect(failed, 'surfaces with failed checks (see sweep-results.json)').toEqual([]);
});
