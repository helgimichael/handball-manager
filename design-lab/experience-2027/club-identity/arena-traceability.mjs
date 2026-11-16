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

// Statuses come from the single authoritative source, arena-231-status.json (see arena-231.mjs).
const STATUS = JSON.parse(fs.readFileSync(path.join(here, "arena-231-status.json"), "utf8"));
const IMPLEMENTED = Object.fromEntries(Object.entries(STATUS).filter(([, r]) => r.status === "IMPLEMENTED" || r.status === "VERIFIED").map(([id, r]) => [id, [r.summary, r.evidence]]));
const SATISFIED = {};
const PARTIAL = Object.fromEntries(Object.entries(STATUS).filter(([, r]) => r.status === "IN_PROGRESS").map(([id, r]) => [id, r.summary]));
const BLOCKED = Object.fromEntries(Object.entries(STATUS).filter(([, r]) => r.status === "BLOCKED" || r.status === "OWNER_DECISION_REQUIRED").map(([id, r]) => [id, r.summary]));
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
  else if (BLOCKED[s.id]) { disposition = "Blocked"; implemented = BLOCKED[s.id]; evidence = STATUS[s.id].evidence || ""; }
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
