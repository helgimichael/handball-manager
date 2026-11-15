// Arena Nights C5: per-recommendation traceability for all 231 Experience 2027 surfaces.
// Reads the canonical lab data (data/surfaces.js) read-only; never changes a recommendation or alternative.
// Every surface gets exactly one disposition: Implemented / Already satisfied / Intentionally deferred / Blocked.
// A theme-only change never counts as Implemented (owner rule).
// Usage (repo root): node design-lab/experience-2027/club-identity/arena-traceability.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(here, "..", "data", "surfaces.js"), "utf8"), ctx);
const surfaces = ctx.window.LAB_DATA.surfaces;

const T = "apps/game/lib/career/arenaShell.test.ts";
/** Structure built in production (C4/C5 of this branch and the earlier Club Identity phases). */
const IMPLEMENTED = {
  "ENT-07": ["Six-hub rail (Idag, Laget, Klubben, Rekrytering, Tävling, Karriär) over all 27 destinations, keys 1-6, 64/220 px rail; contextual hub tab row; persistent Week Spine; Peek drawer (squad players). Peek for clubs/staff/fixtures not yet wired.", `lib/career/hubs.ts, components/GameShell.tsx, components/shell/WeekSpine.tsx, components/shell/PlayerPeek.tsx; ${T}`],
  "ENT-07a": ["Phone bottom bar Idag · Laget · Tävling · Marknad · Mer with docked full-width Continue; Mer opens the full hub map with save controls. Long-press-to-last-sub-page and swipe-to-close not implemented.", "components/GameShell.tsx (.hm-mobile-dock), components/shell/shell.css; ARENA-NIGHTS-RESPONSIVE-QA.md"],
  "ENT-08": ["Matchday clock (day tile + countdown to the next match, floodlit on matchday) heads the Week Spine directly under the top bar; ⌘K field in the header; labelled Continue; save files in a ⋯ overflow.", "components/shell/WeekSpine.tsx (.hm-spine-clock), components/CareerSaveControl.tsx (compact)"],
  "ENT-08a": ["Ctrl/Cmd+K command palette: Sidor, Åtgärder (navigate-only), Spelare, Klubbar, Tävlingar; @ # > prefixes; recents; arrows/Enter/Tab-cycles-groups/Escape; full-screen sheet on phones. Shift+Enter-to-Peek not implemented.", `lib/career/commandPalette.ts, components/shell/CommandPalette.tsx; ${T}`],
  "ENT-10": ["Up-next queue: the next three pinned things from real state with a Continue stop marker on the Spine (next own match, or today while decisions are pending); full day detail on Idag.", `lib/career/weekSpine.ts (upNext, continueStop); ${T}`],
  "DSH-01": ["Matchweek Front Page: masthead with two ring ears (board confidence | reputation, delta + reason), lead story chosen from game state (live, season complete, unemployed, matchday, result, board warning, deadline, injuries, preview), numbered 'Att avgöra', ladder ±2, Runt ligan + Från klubben briefs; Week Spine above.", `lib/career/frontPage.ts, app/career/page.tsx; ${T}`],
  "DSH-01a": ["Journal masthead (Arena broadcast strap) with nameplate, week number and the two ears.", "app/career/page.tsx (.hm-front-masthead)"],
  "DSH-01d": ["State front pages: the lead story switches to 'Du står utan klubb' / 'Säsongen är i mål' / 'Matchen pågår' from career state.", `lib/career/frontPage.ts (lead); ${T}`],
  "DSH-01f": ["Contracts and board offers fold into the numbered decisions column (the detailed 'Utanför planen' section remains below as depth).", "lib/career/frontPage.ts (decisions)"],
  "DSH-01i": ["Week Spine embedded on Idag, expanded with selectable day detail (sessions, pins, links).", "components/shell/WeekSpine.tsx (expanded)"],
  "DSH-01j": ["Dual meter (board confidence | manager reputation) in the masthead; the board card with objectives is kept.", "app/career/page.tsx (FrontEar)"],
  "DSH-01k": ["Ladder slice ±2 around the own club + round list of other results.", "lib/career/frontPage.ts (ladder, leagueBriefs)"],
  "SQD-01": ["Squad Matrix: player chips, four saved views (8 columns each, Detailed up to 12), sortable incl. Skott%/Räddn%, control panel, sticky chip column, multi-select tray, Peek, phone ranked cards; fits 1280 px without horizontal scroll.", `lib/career/squadMatrix.ts, app/career/squad/page.tsx; ${T}`],
  "SQD-01d": ["Kontraktsrisk saved view (end date, days left, wage, status, action). Renewal drawer not built (links to the profile renewal).", "lib/career/squadMatrix.ts (CONTRACT_RISK)"],
  "SQD-01e": ["Floating selection tray: compare (2), bulk squad role, rest/full load, captain/vice, 7 m via tactics, transfer list (confirmed), skipped players explained.", `lib/career/squadMatrix.ts (applyTrayAction); ${T}`],
  "WLD-05": ["Week Spine Calendar: Vecka (current week expanded) · Månad · Lista (= Schema) over a season strip of every week (W/D/L, upcoming, transfer windows, national breaks, current week), click a week to jump.", `lib/career/weekSpine.ts (buildSeasonStrip), app/career/calendar/page.tsx; ${T}`],
  // ---- Phase 2 (player experience, matchday, tactical board)
  "SQD-02": ["Player dossier: identity hero + sticky identity bar, chapters Översikt / Utveckling / Matcher / Karriär / Kontrakt & framtid / Egenskaper; strengths & weaknesses, attribute-family bars, ability/potential band, person/career timeline (club history, transfers, loans, departures, renewals, seasons, archive milestones); Peek from the Squad Matrix. Own-player rating data only; external players keep the knowledge-gated scouting views.", "lib/players/playerDossier.ts, components/players/PlayerDossier.tsx, app/career/squad/[playerId]/page.tsx; apps/game/lib/players/playerDossier.test.ts; apps/game/e2e/arena-journey.spec.ts"],
  "SQD-02a": ["Key-ratings summary on one screen: ability/potential band, family bars, top strengths and weaknesses, readiness gauges (energy, match fitness, morale) and the season strip with archive playing time.", "components/players/PlayerDossier.tsx (KeyRatings, Readiness, SeasonLine); apps/game/lib/players/playerDossier.test.ts"],
  "SQD-02g": ["Sticky identity bar (crest, shirt, name, position, availability, squad role, K/VK/7m) with one state-chosen primary action (Till förlängning when under a year remains, Svara på oro on an open concern; external players: Förhandla) followed by the existing real actions.", "components/players/PlayerDossier.tsx (DossierBar), app/career/squad/[playerId]/page.tsx"],
  "MDY-01": ["Three-step matchday ritual on the preview: 1 Före avkast (attention checklist, blocking first, each item linked), 2 Laget (court line-up + bench + unavailable), 3 Motståndaren (earlier meetings, match context, opponent scouting); start logic and buttons unchanged.", "lib/matchday/preMatch.ts, components/matchday/PreMatch.tsx, app/career/match-preview/page.tsx; apps/game/lib/matchday/preMatch.test.ts; apps/game/e2e/arena-journey.spec.ts"],
  "MDY-01e": ["Half-court line-up with the starting seven in handball positions (wings, backs, centre back beyond 9 m, pivot at 6 m, goalkeeper), readiness rings, K and 7m badges, bench grouped by position with readiness bars. Ring = readiness (energy); match fitness is shown on the player dossier.", "lib/matchday/preMatch.ts (lineupBoard), components/matchday/PreMatch.tsx (LineupCourt, Bench); apps/game/lib/matchday/preMatch.test.ts"],
  "MDY-02j": ["Final-whistle card: verdict for the manager's side, both crests and the final score, the match profiles, and the next step (the existing 'Slutför match och öppna rapport').", "components/matchCenter/MatchCenter.tsx (FinalWhistle); apps/game/e2e/arena-journey.spec.ts"],
  "TRN-02": ["Tactics board readiness header (Trupp n/16 · MV · Startsju · Försvar · 7 m · Kapten · 6v5 · 5v6 · 7v6) jumping to the existing court mode or section, above the existing court with its overlay modes; attack/defence colour identity.", "lib/matchPlan/boardReadiness.ts, components/tactics/TacticsBoardHeader.tsx, app/career/tactics/page.tsx; apps/game/e2e/arena-journey.spec.ts"],
  "TRN-02b": ["2×4 phase × manpower switcher (Anfall/Försvar × 6v6, 6v5, 5v6, 7v6) with completion dots; only court modes the tactical domain supports are interactive, the other cells state 'följer 6 mot 6'.", "components/tactics/TacticsBoardHeader.tsx (PhaseMatrix)"],
  "TRN-02c": ["Special situations live in the phase × manpower grid with dots (klar / ofullständig / standard).", "lib/matchPlan/boardReadiness.ts (phaseMatrix)"],
  "MGR-01c": ["Unemployed state: orange clubless identity across shell + front-page lead 'Du står utan klubb' with the former club and a route to the job market.", "lib/career/activeClubIdentity.ts, lib/career/frontPage.ts (SEEKING_JOB)"],
};
/** Recommendations the production surface already met before this work (verified, with evidence). */
const SATISFIED = {};
/** Touched but not complete: deferred with what is done and what remains. */
const PARTIAL = {
  "ENT-03": "Arena adaptation shipped (the wizard takes on the chosen club's identity, CareerEntryFrame clubId); the 'club first, contract last' step order is not rebuilt -- it changes the New Game flow that the B-team rule (C4.1) just hardened; needs its own pass.",
  "ENT-03d": "Club cards carry identity, relation label (D7) and verified/fallback colour marker; B-teams are filtered (C4.1). Grouping the wall by ambition is not built.",
  "ENT-08b": "Overflow for save-and-quit / export / import shipped with ENT-08; a persistent autosave indicator needs a save-state signal that CareerContext does not expose yet.",
  "ENT-09": "Breadcrumb Kontoret › hub › tab ships in the hub header; the entity level (player/club/fixture name) is not resolved yet ('Detalj').",
  "DSH-01b": "Next-match hero (MatchHero) kept as the match box and a ±2 ladder added; the score-bug restyle of the match box is not done.",
  "DSH-01h": "Från klubben briefs ship latest-first; ranking by importance is not done.",
  "SQD-01a": "The default saved view (Matchberedskap) replaces the old Översikt tab; the curated summary with expandable rows is not built.",
  "SQD-01b": "Prestation view shows Skott% and Räddn% for everyone; position-aware tables (goalkeeper vs outcourt) are not split.",
  "MDY-02": "Phase 2: dedicated live-route environment (rail steps back, floodlight floor, sticky neon score/clock bar, score pop, phase colouring) and the final-whistle card; separate walk-out, timeout-huddle and half-time layouts are not built.",
  "MDY-02a": "Phase 2: the score re-animates on every change and the existing header keeps manpower and suspension chips; timeout pips per half and the compact score-bug layout are not built.",
  "ANL-01": "Phase 2: editorial headline + kicker (competition, round, venue), best-rated player, previous/next match navigation and earlier meetings; momentum hero chart, turning points with court snapshots and the workload box are not built.",
};
const DOMAIN_REASON = {
  ENT: "Entry and shell sub-surfaces: the shell structure (hub rail, Spine, palette, dock) shipped first; this surface keeps its current structure in the Arena theme until its own pass.",
  DSH: "Front-page sub-block: the Matchweek Front Page structure shipped; this block keeps its current layout in the Arena theme.",
  CLB: "Klubbhuset / club surfaces: Arena theme applied; structural rebuild queued after the shell, front page and squad (largest daily-use surfaces first).",
  MGR: "Manager career surfaces: Arena theme applied; the C4.1 B-team rule changed the job-market data underneath, so the layout rebuild waits for owner review of that rule.",
  WLD: "World surfaces (inbox, news, world clubs): Arena theme applied; the inbox/correspondence rebuild needs the event model's thread links, which are not modelled yet.",
  MED: "Media surfaces: Arena theme applied; structural rebuild deferred to a media pass (press flows were not in scope for C5).",
  SYS: "System / settings surfaces: Arena theme applied; low daily use, rebuilt last by priority.",
  SQD: "Squad / player-profile sub-surfaces: the Squad Matrix and Peek shipped; the player dossier (SQD-02 family) rebuild is the next squad pass.",
  STF: "Staff surfaces: Arena theme applied; the M6C/M6D assistant-proposal flows must stay byte-for-byte in behaviour, so the rebuild needs a dedicated staff regression pass.",
  TRN: "Training / tactics surfaces: Arena theme applied; assistant training proposals (M6C/M6D) preserved unchanged; the tactics board rebuild touches match plans and needs match-flow QA.",
  REC: "Recruitment / transfer surfaces: Arena theme applied; the deal-room rebuild changes negotiation inputs and needs transfer-flow regression first.",
  CMP: "Competition surfaces: Arena theme applied; the League Centre rebuild depends on the C4/C4.1 competition transitions settling with the owner.",
  MDY: "Matchday / live surfaces: Arena theme and intensity layer applied; live-session UI shares state with the match session -- rebuilding it without touching engine logic needs a dedicated live-match QA pass (match engine changes are prohibited).",
  ANL: "Analysis / report surfaces: Arena theme applied; editorial report rebuild queued with the matchday family.",
};
// "/career/club, /career/clubs/[clubId]" -> first route; optional "[/segment]" and "[?q=]" groups, "*" wildcards and trailing notes dropped.
const routePath = (route) => String(route || "").split(",")[0].replace(/\s.*$/, "").replace(/\[\/[^\]]*\]/g, "").replace(/\[\?.*$/, "").replace(/\?.*$/, "").replace(/\/?\*.*$/, "").replace(/\[[^\]]*\]/g, "[x]").replace(/\/$/, "");
function routeServed(route) {
  const r = routePath(route);
  if (!r || r.startsWith("*") || !r.startsWith("/")) return { served: true, note: "shell / global" };
  const segs = r.split("/").filter(Boolean);
  let dir = path.join(root, "apps", "game", "app");
  for (const seg of segs) {
    const plain = path.join(dir, seg);
    if (fs.existsSync(plain)) { dir = plain; continue; }
    const dyn = fs.existsSync(dir) ? fs.readdirSync(dir).find((d) => /^\[.*\]$/.test(d)) : undefined;
    if (seg === "[x]" && dyn) { dir = path.join(dir, dyn); continue; }
    if (dyn) { dir = path.join(dir, dyn); continue; }
    return { served: false, note: `no app route for ${r} (checked apps/game/app${r})` };
  }
  return { served: true, note: path.relative(root, dir).replace(/\\/g, "/") };
}

const rows = surfaces.map((s) => {
  const alt = (s.alternatives || []).find((a) => a.key === s.recommendation || a.id === s.recommendation) || {};
  const rec = `${s.recommendation} ${alt.name || alt.title || ""}`.trim();
  const arena = s.arena?.status || "";
  const domain = s.id.split("-")[0];
  const served = routeServed(s.route);
  const existing = arena === "internal" ? "Internal/dev tool (unthemed by design)" : served.served ? "Arena Nights theme applied (language only)" : "Route not in production";
  let disposition, implemented, evidence;
  if (IMPLEMENTED[s.id]) { disposition = "Implemented"; [implemented, evidence] = IMPLEMENTED[s.id]; }
  else if (SATISFIED[s.id]) { disposition = "Already satisfied"; [implemented, evidence] = SATISFIED[s.id]; }
  else if (arena === "internal") { disposition = "Intentionally deferred"; implemented = "Internal developer tool: the lab marks it internal; it is not part of the player experience and stays unthemed by design."; evidence = `lab arena.status=internal; route ${served.note}`; }
  else if (!served.served) { disposition = "Blocked"; implemented = "The recommended surface has no production route to build on; it needs a product decision to add the route first."; evidence = served.note; }
  else if (PARTIAL[s.id]) { disposition = "Intentionally deferred"; implemented = PARTIAL[s.id]; evidence = `route ${served.note}`; }
  else { disposition = "Intentionally deferred"; implemented = DOMAIN_REASON[domain] || "Structural rebuild not started in this pass; Arena theme applied."; evidence = `route ${served.note}`; }
  return { id: s.id, name: s.name, route: s.route, priority: s.priority, rec, existing, disposition, implemented, evidence };
});

const count = (f) => rows.filter(f).length;
const by = (d) => count((r) => r.disposition === d);
const esc = (t) => String(t ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const prio = ["P0", "P1", "P2", "P3"];
let md = `# Arena Nights — Surface Traceability (all ${rows.length} recommendations)

Generated by \`design-lab/experience-2027/club-identity/arena-traceability.mjs\` from the canonical Design Lab data (\`data/surfaces.js\`). Recommendations and alternatives are read only; none was changed or removed. Rule applied: **a theme-only change never counts as Implemented**.

| Disposition | All | ${prio.join(" | ")} |
|---|---|${prio.map(() => "---").join("|")}|
${["Implemented", "Already satisfied", "Intentionally deferred", "Blocked"].map((d) => `| ${d} | ${by(d)} | ${prio.map((p) => count((r) => r.disposition === d && r.priority === p)).join(" | ")} |`).join("\n")}
| **Total** | **${rows.length}** | ${prio.map((p) => `**${count((r) => r.priority === p)}**`).join(" | ")} |

Columns: *Existing state* is what production had before structural work (every served surface already rendered in the Arena Nights theme from the previous phase); *Implemented state* is what is true now, or why it is deferred / blocked; *Evidence* names the files, tests or route checks. Paths are relative to \`apps/game/\` unless they start with \`apps/\` or \`docs/\`.

| Recommendation | Surface | Priority | Existing state | Implemented state | Evidence | Disposition |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.id} · ${esc(r.rec)} | ${esc(r.name)} (\`${esc(r.route)}\`) | ${r.priority} | ${esc(r.existing)} | ${esc(r.implemented)} | ${esc(r.evidence)} | **${r.disposition}** |`).join("\n")}
`;
const out = path.join(root, "docs", "club-identity", "ARENA-NIGHTS-SURFACE-TRACEABILITY.md");
fs.writeFileSync(out, md);
console.log(JSON.stringify({ total: rows.length, Implemented: by("Implemented"), "Already satisfied": by("Already satisfied"), "Intentionally deferred": by("Intentionally deferred"), Blocked: by("Blocked"), p0Implemented: count((r) => r.priority === "P0" && r.disposition === "Implemented") }));
