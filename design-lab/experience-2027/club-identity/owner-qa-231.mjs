// Arena Nights 231 — Owner QA pack. Builds the owner's walkthrough and checklist for all 231 canonical
// Experience 2027 surfaces from the same sources as the implementation status (read only):
//   * design-lab/experience-2027/data/surfaces.js   — the canonical surfaces, recommendations and alternatives
//   * design-lab/experience-2027/club-identity/arena-231-status.json — milestone, delivered summary, verification
// Nothing here changes a status: every surface stays technically VERIFIED and owner status NOT REVIEWED until the
// owner records a verdict. Re-running the generator keeps the owner's verdicts already entered in the checklist CSV.
// Writes docs/club-identity/owner-qa/{OWNER-QA-231-WALKTHROUGH.md, OWNER-QA-231-CHECKLIST.csv}.
// Usage (repo root): node design-lab/experience-2027/club-identity/owner-qa-231.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(here, "..", "data", "surfaces.js"), "utf8"), ctx);
const surfaces = ctx.window.LAB_DATA.surfaces;
const status = JSON.parse(fs.readFileSync(path.join(here, "arena-231-status.json"), "utf8"));
const outDir = path.join(root, "docs", "club-identity", "owner-qa");
fs.mkdirSync(outDir, { recursive: true });

const altCount = surfaces.reduce((n, s) => n + s.alternatives.length, 0);
if (surfaces.length !== 231 || altCount !== 551) throw new Error(`canonical data changed: ${surfaces.length} surfaces, ${altCount} alternatives`);
for (const s of surfaces) if (!status[s.id]) throw new Error(`${s.id}: no status record`);

const MILESTONES = {
  "M1-transfers": "M1 · Transfers",
  "M2-training": "M2 · Training & tactics",
  "M3-live-match": "M3 · Live match",
  "M4-inbox-world": "M4 · Inbox & world",
  "M5-entry-shell": "M5 · Entry & shell",
  "M6-squad-players": "M6 · Squad & players",
  "M7-matchprep-analysis": "M7 · Match prep & analysis",
  "M8-dashboard-competition": "M8 · Dashboard & competition",
  "M9-club": "M9 · Club",
  "M10-staff-medical-scouting": "M10 · Staff, medical & scouting",
  "M11-manager-season": "M11 · Manager & season",
  "M12-internal-tools": "M12 · Internal tools",
};
const msOrder = Object.keys(MILESTONES);
// The 40 surfaces delivered in earlier phases (status milestone "M0-prior-phases") are walked through inside the
// twelve milestones: with their family (same base ID, e.g. SQD-02 for SQD-02b), else with their domain.
const DOMAIN_MS = { ENT: "M5-entry-shell", SYS: "M12-internal-tools", DSH: "M8-dashboard-competition", CMP: "M8-dashboard-competition", CLB: "M9-club", MGR: "M11-manager-season", WLD: "M4-inbox-world", SQD: "M6-squad-players", TRN: "M2-training", ANL: "M7-matchprep-analysis", STF: "M10-staff-medical-scouting", MED: "M10-staff-medical-scouting" };
const family = (id) => id.match(/^[A-Z]+-\d+/)[0];
function qaMilestone(id) {
  const own = status[id].milestone;
  if (own !== "M0-prior-phases") return own;
  const sib = Object.entries(status).find(([k, r]) => k !== id && family(k) === family(id) && r.milestone !== "M0-prior-phases");
  if (sib) return sib[1].milestone;
  if (id.startsWith("MDY-02")) return "M3-live-match";
  if (id.startsWith("MDY")) return "M7-matchprep-analysis";
  if (/^REC-0[345]/.test(id)) return "M1-transfers";
  if (id.startsWith("REC")) return "M10-staff-medical-scouting";
  return DOMAIN_MS[id.split("-")[0]];
}
const msKey = (m) => (msOrder.includes(m) ? msOrder.indexOf(m) : 99);
const PRIORITY_PASS = { P0: "Pass 1 — P0 (all 55)", P1: "Pass 2 — P1 high priority", P2: "Pass 3 — P2 medium priority", P3: "Pass 4 — P3 remaining" };

// Where the delivered surface was verified (the route the checks ran on), from the verification record.
function deliveredRoute(id) {
  const v = status[id].verification;
  const m = v.match(/checks? on (.+?) at (?:desktop|tablet|phone)/);
  return m ? m[1].trim() : "";
}
// Game-path hint for a route: hub › tab, as the rail shows it.
const NAV = [
  ["/career/match-day", "Idag › Schema → a fixture → Spela (live match)"], ["/career/match-preview", "Idag › Schema → next fixture → Förbered match"],
  ["/career/match-report", "Idag › Schema → a played fixture → Matchrapport"], ["/career/match-2d", "Live match → 2D-vy"],
  ["/career/fixtures", "Idag › Schema → a fixture"], ["/career/schedule", "Idag › Schema"], ["/career/calendar", "Idag › Kalender"], ["/career/inbox", "Idag › Inkorg"],
  ["/career/squad/", "Laget › Trupp → a player"], ["/career/squad", "Laget › Trupp"], ["/career/tactics", "Laget › Taktik"], ["/career/training", "Laget › Träning"],
  ["/career/medical", "Laget › Medicinskt"], ["/career/contracts", "Laget › Kontrakt"], ["/career/compare", "Laget › Kontrakt → Jämför spelare"],
  ["/career/klubbhuset", "Klubben › Klubb (Klubbhuset redirects here)"], ["/career/club/partnerships", "Klubben › Klubb → Samarbeten"], ["/career/clubs/", "Any club name/crest → club portrait"],
  ["/career/club", "Klubben › Klubb"], ["/career/board", "Klubben › Styrelsen"], ["/career/finance", "Klubben › Ekonomi"], ["/career/staff", "Klubben › Personal"],
  ["/career/recruitment", "Rekrytering › Rekrytering"], ["/career/players", "Rekrytering › Spelarsök"], ["/career/scouting", "Rekrytering › Scouting"],
  ["/career/transfers/offers", "Rekrytering › Transfers → an incoming bid"], ["/career/transfers/", "Rekrytering › Transfers → a player deal"], ["/career/transfers", "Rekrytering › Transfers"],
  ["/career/season", "Tävling › Säsongen"], ["/career/competitions", "Tävling › Tävlingar"], ["/career/statistics", "Tävling › Statistik"], ["/career/analysis", "Tävling › Analys"],
  ["/career/manager", "Karriär › Karriär"], ["/career/history", "Karriär › Historik"], ["/career/media", "Karriär › Media"], ["/career/settings", "Inställningar (rail foot)"],
  ["/career/moments", "/career/moments (redirect)"], ["/career/match-center", "/career/match-center (redirect)"], ["/career", "Idag › Hem"],
  ["/new-game", "Title screen → Ny karriär"], ["/load-game", "Title screen → Alla karriärer"], ["/settings", "Title screen → Inställningar"],
  ["/editor", "DEV corner tab (dev flag only)"], ["/scenario-lab", "DEV corner tab (dev flag only)"], ["/match-qa", "DEV corner tab (dev flag only)"], ["/", "Title screen"],
];
function navHint(route) {
  const first = route.split(/\s*(?:→|\|)\s*/).map((r) => r.trim()).find((r) => r.startsWith("/")) ?? route;
  const hit = NAV.find(([p]) => first === p || first.startsWith(p));
  return hit ? hit[1] : route === "*" ? "Everywhere (global)" : "";
}

// The game state each surface needs, and the test career that provides it.
const SAVES = {
  "season-complete": "QA-C Season complete",
  "verdict-mid_season": "QA-D Board verdict (mid-season)",
  "verdict-season_review": "QA-E Board verdict (season review)",
  injury: "QA-F Injured player",
  "incoming-bid": "QA-G Incoming bid",
  "suspended-matchday": "QA-H Suspended manager on matchday",
};
function prerequisite(id, route) {
  const v = status[id].verification;
  const snap = v.match(/prep snapshot "([^"]+)"/);
  if (snap && SAVES[snap[1]]) return `${SAVES[snap[1]]} (import save)`;
  if (/season complete, not rolled over/.test(v)) return `${SAVES["season-complete"]} (import save)`;
  if (/component render/.test(v)) return "Not observable in normal play (transient loading state) — see known deviations";
  if (/\/match-day|live match|half-time|walk-out|final whistle/i.test(route + " " + v)) return "QA-A on a matchday: play a match live";
  if (/match-report/.test(route)) return "QA-A after one played match";
  if (/^\/(new-game|load-game|settings)|^\/$|^\* \(alpha/.test(route)) return "Title screen (QA environment)";
  if (/pre-season|preseason/i.test(route + v)) return "QA-B Pre-season career";
  if (/manager-suspended|unemployed|resign/i.test(v)) return "QA-A (resigning ends the career — do it last) or QA-I";
  if (/^\/(editor|scenario-lab|match-qa)/.test(route)) return "Dev server with the editor flag on (not the QA build)";
  return "QA-A Fresh career";
}

const esc = (t) => String(t ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
const csvCell = (v) => { const t = String(v ?? ""); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

const rows = surfaces.map((s) => {
  const alt = s.alternatives.find((a) => a.key === s.recommendation);
  const r = status[s.id];
  const route = deliveredRoute(s.id);
  const arena = s.arena && s.arena.status === "adapt" ? s.arena : null;
  return {
    id: s.id, name: s.name, kind: s.kind, priority: s.priority, milestone: qaMilestone(s.id), statusMilestone: r.milestone, milestoneName: MILESTONES[qaMilestone(s.id)],
    labRoute: s.route, route, where: navHint(route || s.route), recommendation: `${s.recommendation} · ${alt.name}${arena ? ` (Arena: ${arena.adaptedName})` : ""}`,
    intended: alt.concept, arenaAdaptation: arena ? arena.adaptation : "", interact: alt.interactions, lookFor: alt.hierarchy,
    mobile: alt.mobile, expected: r.summary, prerequisite: prerequisite(s.id, route), dependencies: (s.dependencies || []).join("; "),
    technical: r.status, verification: r.verification.split(". Screenshots")[0],
  };
});

// Known deviations and found defects the owner should judge (from the delivered summaries and the QA record).
const KNOWN = [
  { id: "ENT-03f", kind: "Intentional deviation", what: "Click-to-sign instead of the recommended press-and-hold.", why: "Keeps the immediate hand-over to the loading screen.", fix: "If press-and-hold is wanted: a 600 ms hold on the signature line before 'Starta karriär' fires (UI only)." },
  { id: "ENT-07", kind: "Partly delivered", what: "Peek drawer exists for squad players only; Peek for clubs, staff and fixtures is not wired.", why: "Recorded as not yet wired in the delivered summary.", fix: "Reuse the existing Peek drawer for club, staff and fixture links in the shell (UI only)." },
  { id: "ENT-07a", kind: "Partly delivered", what: "Long-press to last sub-page and swipe-to-close on the phone bar are not implemented.", why: "Recorded as not implemented.", fix: "Add long-press on a hub tab (opens its last tab) and swipe-down on the Mer sheet." },
  { id: "ENT-08a", kind: "Partly delivered", what: "Shift+Enter to open a result in Peek is not implemented.", why: "Depends on the wider Peek (ENT-07).", fix: "After ENT-07: Shift+Enter opens the selected player/club in Peek." },
  { id: "CMP-01a", kind: "Partly delivered", what: "Annotated standings: the Hemma/Borta table toggle is not built.", why: "Recorded as not built.", fix: "Add a Hemma/Borta/Alla toggle computed from existing results (display only)." },
  { id: "CLB-06c", kind: "Intentional deviation", what: "Only wages ⇄ transfers can be reallocated; staff, academy and facility budgets are read-only.", why: "The game has no rule to reallocate those budgets; inventing one would change the economy (out of scope).", fix: "Owner decision: accept, or approve a separate economy change (outside the 231)." },
  { id: "REC-01", kind: "Intentional deviation", what: "Kortlista reorders by the existing priority levels, not free drag order.", why: "Free order needs new saved data (save architecture is protected).", fix: "Owner decision: accept, or approve a new saved order field (save change)." },
  { id: "STF-04", kind: "Intentional deviation", what: "Approving assistant training plans stays in the protected training flow, linked from the queue.", why: "The M6D training approval is a protected system.", fix: "Accept, or approve moving the approval into the queue." },
  { id: "TRN-02b", kind: "Intentional deviation", what: "Only manpower states the tactical domain supports are interactive; the others read 'följer 6 mot 6'.", why: "No tactical model exists for the other states (tactical engine protected).", fix: "Accept." },
  { id: "MGR-04", kind: "Partly delivered", what: "The moment library left the player product (redirect), but the Design Lab specimen gallery was not built.", why: "Design Lab files were read-only during implementation.", fix: "Add a specimen page in the Design Lab (no game change)." },
  { id: "TRN-01f", kind: "Verification note", what: "The training skeleton (Suspense fallback) is never visible in the running game; it was verified by rendering the component.", why: "The page resolves synchronously.", fix: "None needed unless the owner wants it shown on slow devices." },
  { id: "MDY-02k", kind: "Verification note", what: "The suspended-manager dock was reached with a second discipline case opened by the game's own function.", why: "Only one case arose naturally in the prepared season.", fix: "None; QA-H reproduces it." },
  { id: "MDY-02", kind: "Defect (found in QA)", what: "At 375 px, long club names can overlap the live score in the scoreboard.", why: "Found during the 231 verification; not fixed (UI change pending owner).", fix: "Truncate the club name with an ellipsis / use shortName below 420 px in the live scoreboard (CSS only)." },
  { id: "REC-04", kind: "Defect (found in QA)", what: "The free-agent term sheet opens at 0 €/mån.", why: "A sensible default would reveal hidden ability; left as is.", fix: "Default to the player's asking wage band from public data (no hidden attributes)." },
];

// Test careers.
const CAREERS = [
  ["QA-A", "Owner QA · Tumba", "Fresh career created in the QA environment (IFK Tumba HK, Allsvenskan, default start). Already created and active.", "Most surfaces: title screen with a real save, Idag, Laget, Klubben, Rekrytering, Tävling, Karriär, match prep, one live match, match report. Resign only at the very end."],
  ["QA-B", "Pre-season · created by you", "Create during the M5 walkthrough: Ny karriär → any club → Kontrakt → choose '8 v' or '6 v' före seriestart.", "ENT-03 wizard itself, WLD-06/06a pre-season planner, ENT-03f signing ceremony."],
  ["QA-C", "Season complete", "Import C:/DEV/QA/reports/arena-231/states/saves/season-complete.json (Inställningar → Data → Importera sparfil). Season 2026/27 finished, not rolled over.", "DSH-01c, MGR-02, MGR-03b, MDY-01f, CLB-06b, CLB-06d, CMP-01f, REC-01f, REC-04c, REC-04e, STF-03b."],
  ["QA-D", "Board verdict (mid-season)", "Import verdict-mid_season.json (2027-01-02).", "CLB-05a (verdict stamp on the day), CLB-05 board minutes."],
  ["QA-E", "Board verdict (season review)", "Import verdict-season_review.json (2027-05-13).", "CLB-05a/05b at the season review."],
  ["QA-F", "Injured player", "Import injury.json (2026-09-17).", "MED-01a rehab cards, MED-01 with a real injury."],
  ["QA-G", "Incoming bid", "Import incoming-bid.json (2026-09-14).", "REC-05 bid desk, REC-05a farewell after accepting."],
  ["QA-H", "Suspended manager on matchday", "Import suspended-matchday.json.", "MDY-01b fix-it dialog, MDY-02k assistant dock."],
  ["QA-I", "Unemployed (optional)", "In any career you no longer need: Karriär → Avgå som huvudtränare… → Ja, jag avgår.", "MGR-01c clubless identity, DSH-01d 'Du står utan klubb' (Employment States, accepted)."],
];

// ---------------------------------------------------------------- CSV checklist (keeps owner verdicts on re-run)
const csvFile = path.join(outDir, "OWNER-QA-231-CHECKLIST.csv");
const previous = new Map();
if (fs.existsSync(csvFile)) {
  const lines = fs.readFileSync(csvFile, "utf8").split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  for (const line of lines.slice(1)) { const cells = parseCsvLine(line); const rec = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])); previous.set(rec.id, rec); }
}
function parseCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur); return out;
}
const ordered = [...rows].sort((a, b) => a.priority.localeCompare(b.priority) || msKey(a.milestone) - msKey(b.milestone) || a.route.localeCompare(b.route) || a.id.localeCompare(b.id, "en", { numeric: true }));
ordered.forEach((r, i) => { r.order = i + 1; });
const known = new Map(KNOWN.map((k) => [k.id, k]));
const cols = ["order", "id", "priority", "milestone", "statusMilestone", "name", "kind", "where", "route", "prerequisite", "recommendation", "intended", "arenaAdaptation", "interact", "lookFor", "mobile", "expected", "knownDeviation", "dependencies", "technical", "verification", "owner_status", "owner_reviewed_on", "owner_notes", "defect_ref"];
const csv = [cols.join(","), ...ordered.map((r) => {
  const prev = previous.get(r.id) ?? {};
  const rec = { ...r, knownDeviation: known.get(r.id) ? `${known.get(r.id).kind}: ${known.get(r.id).what}` : "", owner_status: prev.owner_status || "NOT REVIEWED", owner_reviewed_on: prev.owner_reviewed_on ?? "", owner_notes: prev.owner_notes ?? "", defect_ref: prev.defect_ref ?? "" };
  return cols.map((c) => csvCell(rec[c])).join(",");
})].join("\n") + "\n";
fs.writeFileSync(csvFile, csv);

// ---------------------------------------------------------------- Walkthrough
const count = (f) => rows.filter(f).length;
const P = ["P0", "P1", "P2", "P3"];
let md = `# Arena Nights 231 — Owner QA Walkthrough

Generated by \`design-lab/experience-2027/club-identity/owner-qa-231.mjs\` from the canonical Design Lab data (\`design-lab/experience-2027/data/surfaces.js\`: 231 surfaces, 551 alternatives) and \`arena-231-status.json\`. Re-run it to refresh; owner verdicts already entered in \`OWNER-QA-231-CHECKLIST.csv\` are kept.

## Technically verified ≠ owner-approved

| | Meaning | Now |
|---|---|---|
| **Technical status** | Implemented and checked by automated tests (Playwright sweep / states spec, unit tests) on a production build. | **VERIFIED: ${count((r) => r.technical === "VERIFIED")} / 231** (P0 ${count((r) => r.priority === "P0" && r.technical === "VERIFIED")} / 55) |
| **Owner status** | Your verdict after looking at the surface in the game: \`APPROVED\`, \`APPROVED WITH NOTES\`, \`DEFECT\`, \`DEVIATION ACCEPTED\`, \`DEVIATION REJECTED\`. | **NOT REVIEWED: 231 / 231** — nothing is owner-approved until you record it. |

Record verdicts in \`OWNER-QA-231-CHECKLIST.csv\` (columns \`owner_status\`, \`owner_reviewed_on\`, \`owner_notes\`, \`defect_ref\`) and defects with \`OWNER-QA-DEFECT-TEMPLATE.md\`.

## Coverage

| Milestone | ${P.join(" | ")} | All |
|---|${P.map(() => "---:").join("|")}|---:|
${[...new Set(rows.map((r) => r.milestone))].sort((a, b) => msKey(a) - msKey(b)).map((m) => `| ${MILESTONES[m] ?? m} | ${P.map((p) => count((r) => r.milestone === m && r.priority === p) || "–").join(" | ")} | ${count((r) => r.milestone === m)} |`).join("\n")}
| **Total** | ${P.map((p) => `**${count((r) => r.priority === p)}**`).join(" | ")} | **231** |

## Environment and starting point

- **QA environment:** production build of \`feat/club-identity-arena\`, served on its own port: **http://localhost:3770**. Its browser storage is separate from every other port, so existing careers and QA saves elsewhere are untouched. Arena Nights is the only theme.
- **Start / restart:** Claude Code launch configuration \`hm-owner-qa-231\`, or in a terminal: \`npm --prefix C:/DEV/WORKTREES/handball-manager/club-identity-arena/apps/game run start -- --port 3770\` (after a fresh \`npm run build\` if the code changed).
- **Alpha access code:** HBL-ALPHA-2026.
- **Begin here:** open http://localhost:3770 → the alpha gate (ENT-01) is the first surface: enter the code → the title screen (ENT-02 Season Cover) shows QA-A with Fortsätt. Follow **Pass 1** below in order; each block starts with the screen and where it sits in the game.
- **Order of play inside a pass:** milestone by milestone; within a milestone, screen by screen. Surfaces that need a live match are grouped under the match-day screen — play QA-A's first matchday once and review them together. Resign (QA-I) only at the very end.

## Test careers

| Career | Name | How to get it | Use for |
|---|---|---|---|
${CAREERS.map((c) => `| ${c.map(esc).join(" | ")} |`).join("\n")}

Imported saves are large (46–291 MB); import takes up to a minute. Importing adds a career; it never overwrites another.

## Known deviations and found defects to judge

These are recorded openly so you can accept or reject them. Each names the smallest correction; nothing has been changed during this preparation.

| Surface | Type | What | Why | Smallest correction |
|---|---|---|---|---|
${KNOWN.map((k) => `| ${k.id} | ${k.kind} | ${esc(k.what)} | ${esc(k.why)} | ${esc(k.fix)} |`).join("\n")}

## How to read each entry

**Recommendation** = the alternative chosen in the Design Lab (with its Arena Nights adaptation). **Intended** = the recommendation's concept. **Interact** = what to try. **Look for** = the intended hierarchy. **Delivered** = what was built (technical record). **Needs** = the test career / state.

`;
for (const p of P) {
  const inPass = ordered.filter((r) => r.priority === p);
  md += `\n---\n\n# ${PRIORITY_PASS[p]} — ${inPass.length} surfaces\n`;
  for (const m of [...new Set(inPass.map((r) => r.milestone))].sort((a, b) => msKey(a) - msKey(b))) {
    const inMs = inPass.filter((r) => r.milestone === m);
    md += `\n## ${p} · ${MILESTONES[m] ?? m} (${inMs.length})\n`;
    const screens = [...new Set(inMs.map((r) => r.route))];
    for (const scr of screens) {
      const here = inMs.filter((r) => r.route === scr);
      md += `\n### Screen: \`${scr || here[0].labRoute}\`${here[0].where ? ` — ${here[0].where}` : ""}\n`;
      for (const r of here) {
        const k = known.get(r.id);
        md += `\n#### ☐ ${r.id} · ${r.name} \`${r.priority}\` \`${r.kind}\`${r.statusMilestone === "M0-prior-phases" ? " `earlier phase`" : ""}\n`;
        md += `- **Recommendation:** ${esc(r.recommendation)}\n`;
        md += `- **Intended:** ${esc(r.intended)}${r.arenaAdaptation ? `\n- **Arena Nights adaptation:** ${esc(r.arenaAdaptation)}` : ""}\n`;
        md += `- **Interact:** ${esc(r.interact)}\n`;
        md += `- **Look for:** ${esc(r.lookFor)}${r.mobile ? ` Phone: ${esc(r.mobile)}` : ""}\n`;
        md += `- **Delivered (expected result):** ${esc(r.expected)}\n`;
        md += `- **Needs:** ${esc(r.prerequisite)}${r.dependencies ? ` · Lab dependencies: ${esc(r.dependencies)}` : ""}\n`;
        if (k) md += `- **⚠ ${k.kind}:** ${esc(k.what)}\n`;
        md += `- **Technical:** ${r.technical} · **Owner:** NOT REVIEWED\n`;
      }
    }
  }
}
md += `\n---\n\n## All 231 IDs by milestone\n\n${[...new Set(rows.map((r) => r.milestone))].sort((a, b) => msKey(a) - msKey(b)).map((m) => `- **${MILESTONES[m] ?? m}** (${count((r) => r.milestone === m)}): ${rows.filter((r) => r.milestone === m).map((r) => r.id).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).join(", ")}`).join("\n")}\n`;
fs.writeFileSync(path.join(outDir, "OWNER-QA-231-WALKTHROUGH.md"), md);
console.log(JSON.stringify({ surfaces: rows.length, alternatives: altCount, p0: count((r) => r.priority === "P0"), verified: count((r) => r.technical === "VERIFIED"), ownerReviewed: [...previous.values()].filter((p) => p.owner_status && p.owner_status !== "NOT REVIEWED").length, known: KNOWN.length, noRoute: rows.filter((r) => !r.where).map((r) => `${r.id}:${r.route}`) }));
