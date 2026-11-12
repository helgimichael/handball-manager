// Build script: merges inventory + proposals into the Design Lab data file and generates
// the inventory / proposals / owner-decisions markdown documents from the same source.
// Usage (from repo root): node design-lab/experience-2027/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const docs = path.join(root, 'docs', 'experience-2027');
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);

const inventory = [...readJson(path.join(docs, 'inventory', 'part-a.json')), ...readJson(path.join(docs, 'inventory', 'part-b.json'))];
const proposals = ['part-a1', 'part-a2', 'part-b1', 'part-b2'].flatMap((f) => readJson(path.join(docs, 'proposals', f + '.json')));
const propById = new Map(proposals.map((p) => [p.id, p]));

export const DOMAINS = {
  ENT: 'Entry & global shell', DSH: 'Dashboard', CLB: 'Club & organisation', SQD: 'Squad & players', STF: 'Staff',
  TRN: 'Training & tactics', REC: 'Scouting & transfers', CMP: 'Competition', MDY: 'Matchday', ANL: 'Match analysis',
  MGR: 'Manager career', WLD: 'World & communication', MED: 'Medical', SYS: 'Settings & internal tools',
};
const PROTO = {
  entry: ['Career Library', 'Arena Title', 'Journal Cover'], dashboard: ['Decision Briefing', 'Matchweek Show', "Today's Paper"],
  club: ['Executive Office', 'Clubhouse Rooms', 'Club Journal'], player: ['Dossier', 'Athlete Spotlight', 'Feature Profile + Peek'],
  squad: ['Squad Matrix', 'Locker Room', 'Depth Chart'], staff: ['Org & Responsibility Matrix', 'Staff Room', 'Department Journal'],
  training: ['Weekly Planner Grid', 'Training Hall', 'Assistant Proposal'], scouting: ['Search Workbench', 'Scouting Board', 'Shortlist & Reports'],
  transfers: ['Market Table + Deal Panel', 'Deal Room', 'Transfer Desk Pipeline'], competition: ['League Centre', 'Broadcast League Hub', 'Competition Almanac'],
  matchday: ['Bench Tablet', 'Broadcast', 'Floodlight Sequence'], analysis: ['Stats Sheet', 'Highlight Show', 'Editorial Match Report'],
  inbox: ['Task Inbox', 'Messenger Feed', 'Correspondence Desk'], calendar: ['Planner Grid', 'Season Road', 'Week Spine Calendar'],
  manager: ['Career Ledger', 'Legacy Wall', 'Manager Biography'],
};
const GLOBAL = [
  { id: 'G1', title: 'Base identity / temperament', options: ['A — Tactical Clarity', 'B — Arena Nights', 'C — Paper & Floodlight'], rec: 'C', why: 'Best balance of depth and atmosphere; evolves the current paper/navy/signal identity; spectacle budget concentrated on moments.' },
  { id: 'G2', title: 'Navigation model', options: ['A — 6-hub rail + Ctrl-K palette + hover cards', 'B — Top hub bar + full-bleed hub pages', 'C — Week Spine + hub rail + Peek drawer'], rec: 'C', why: 'Replaces the flat 27-item sidebar; makes time (the core loop) visible; Peek keeps context. Palette from A should be included in any choice.' },
  { id: 'G3', title: 'Imagery policy', options: ['A — Minimal: crests, monograms, data as image', 'B — Maximal: portraits and environments everywhere', 'C — Curated: imagery on hubs, stories and moments'], rec: 'C', why: 'The repo already owns 10 environment photos; curated use gives atmosphere without a large asset pipeline.' },
  { id: 'G4', title: 'Portrait strategy', options: ['A — Initials / monogram', 'B — Stylised procedural SVG busts (non-likeness)', 'C — Photographic / AI likeness'], rec: 'B', why: 'Real Swedish player names exist in data — likeness portraits carry legal risk; procedural busts scale to every player at ~1 KB each.' },
  { id: 'G5', title: 'Motion budget', options: ['A — Functional only (≤180 ms)', 'B — Expressive everywhere', 'C — Calm by default, expressive on moments'], rec: 'C', why: 'Keeps long management sessions calm and performant while giving matchday, signings and milestones a signature.' },
  { id: 'G6', title: 'Density modes', options: ['A — Single density', 'B — Comfortable + Compact toggle'], rec: 'B', why: 'Power users want FM-level density; newcomers need breathing room. Implemented as tokens (--pad, --row, --fs).' },
  { id: 'G7', title: 'Mobile role', options: ['A — Full parity, responsive', 'B — Companion: Today, inbox, decisions, match', 'C — Full parity but mobile-first layouts for daily loop'], rec: 'C', why: 'Desktop remains primary; the daily loop (Today, inbox, decisions, matchday) gets purpose-built mobile layouts, deep editors adapt to single column.' },
  { id: 'G8', title: 'Typography pairing', options: ['A — Inter + JetBrains Mono', 'B — Barlow Condensed + Barlow', 'C — Saira Condensed + IBM Plex Sans/Mono + Source Serif 4'], rec: 'C', why: 'Follows G1. All are open-licence web fonts — replaces Windows-only Bahnschrift/Segoe which degrade on Mac/mobile.' },
];

const surfaces = inventory.map((s) => {
  const p = propById.get(s.id) || {};
  let alts = p.alternatives || [];
  if (p.protoKey && PROTO[p.protoKey]) alts = alts.map((a, i) => ({ ...a, name: a.name || PROTO[p.protoKey][i] }));
  return {
    ...s,
    domainName: DOMAINS[s.id.slice(0, 3)] || s.domain,
    protoKey: p.protoKey || null,
    current: p.current || s.structure || '',
    recommendation: p.recommendation || null,
    reason: p.reason || '',
    dependencies: p.dependencies || [],
    priority: p.priority || (s.importance === 'internal' ? 'P3' : null),
    alternatives: alts,
    hasProposal: !!p.id,
  };
});
const missing = surfaces.filter((s) => !s.hasProposal).map((s) => s.id);

// ---------- lab data ----------
const outDir = path.join(here, 'data');
fs.mkdirSync(outDir, { recursive: true });
const lab = { generated: new Date().toISOString(), domains: DOMAINS, proto: PROTO, global: GLOBAL, surfaces, missing };
fs.writeFileSync(path.join(outDir, 'surfaces.js'), '/* generated by build-data.mjs — do not edit */\nwindow.LAB_DATA = ' + JSON.stringify(lab) + ';\n');

// ---------- markdown ----------
const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const list = (a) => (a && a.length ? a.map((x) => `- ${x}`).join('\n') : '- —');
const byDomain = Object.keys(DOMAINS).map((d) => [d, surfaces.filter((s) => s.id.startsWith(d + '-'))]).filter(([, l]) => l.length);

// Inventory
let inv = `# HM Experience 2027 — Surface Inventory\n\n> Generated from \`docs/experience-2027/inventory/part-a.json\` + \`part-b.json\` by \`design-lab/experience-2027/build-data.mjs\`.\n> Source of truth: the application source in \`apps/game\` (branch \`feat/m6-0-state-hygiene\`, commit ca0e85b), inspected read-only.\n> Narrative findings, global observations and the "unexamined" lists live in [inventory/part-a.md](inventory/part-a.md) and [inventory/part-b.md](inventory/part-b.md).\n\n`;
inv += `**${surfaces.length} surfaces** — ${surfaces.filter((s) => s.kind === 'page').length} pages, ${surfaces.filter((s) => s.kind === 'tab').length} tabs, ${surfaces.filter((s) => s.kind === 'panel').length} panels, ${surfaces.filter((s) => ['state'].includes(s.kind)).length} states, ${surfaces.filter((s) => ['modal', 'drawer', 'overlay'].includes(s.kind)).length} modals/drawers/overlays, ${surfaces.filter((s) => s.kind === 'nav').length} navigation surfaces.\n\n`;
inv += `## Index\n\n| ID | Name | Route | Kind | Importance | Parent |\n|---|---|---|---|---|---|\n` + surfaces.map((s) => `| ${s.id} | ${esc(s.name)} | \`${esc(s.route)}\` | ${s.kind} | ${s.importance} | ${s.parent || ''} |`).join('\n') + '\n\n';
for (const [d, l] of byDomain) {
  inv += `## ${d} — ${DOMAINS[d]}\n\n`;
  for (const s of l) {
    inv += `### ${s.id} · ${s.name}\n\n- **Route:** \`${s.route}\` · **Kind:** ${s.kind} · **Importance:** ${s.importance}${s.parent ? ` · **Parent:** ${s.parent}` : ''}\n- **Components:** ${(s.components || []).map((c) => '`' + c + '`').join(', ') || '—'}\n- **Purpose:** ${s.purpose}\n- **Main actions:** ${(s.actions || []).join('; ') || '—'}\n- **Current visual structure:** ${s.structure}\n- **Navigation relationships:** ${(s.links || []).join(', ') || '—'}\n- **Desktop:** ${s.desktop}\n- **Mobile:** ${s.mobile}\n\n**Strengths**\n${list(s.strengths)}\n\n**Weaknesses**\n${list(s.weaknesses)}\n\n**Redesign opportunities**\n${list(s.opportunities)}\n\n`;
  }
}
fs.writeFileSync(path.join(docs, 'HM-EXPERIENCE-2027-SURFACE-INVENTORY.md'), inv);

// Proposals
let pr = `# HM Experience 2027 — Surface Proposals\n\n> 2–3 alternatives for every inventoried surface. Generated from \`docs/experience-2027/proposals/*.json\` by \`design-lab/experience-2027/build-data.mjs\`.\n> Surfaces marked **HI-FI** have interactive high-fidelity prototypes in the Design Lab; all others render as concept boards (lo-fi wireframes) in every identity.\n> Recommendations are advice only — the owner decides (see HM-EXPERIENCE-2027-OWNER-DECISIONS.md).\n\n`;
pr += `## Summary\n\n| ID | Surface | Priority | A | B | C | Rec. |\n|---|---|---|---|---|---|---|\n` + surfaces.map((s) => { const n = (k) => esc((s.alternatives.find((a) => a.key === k) || {}).name || '—'); return `| ${s.id}${s.protoKey ? ' **HI-FI**' : ''} | ${esc(s.name)} | ${s.priority || '—'} | ${n('A')} | ${n('B')} | ${n('C')} | ${s.recommendation || '—'} |`; }).join('\n') + '\n\n';
if (missing.length) pr += `> ⚠ Surfaces without proposals at build time: ${missing.join(', ')}\n\n`;
for (const [d, l] of byDomain) {
  pr += `## ${d} — ${DOMAINS[d]}\n\n`;
  for (const s of l) {
    pr += `### ${s.id} · ${s.name}${s.protoKey ? ` — HI-FI prototype \`${s.protoKey}\`` : ''}\n\n**Current:** ${s.current}\n\n**Recommendation:** ${s.recommendation || '—'} — ${s.reason}\n\n**Priority:** ${s.priority || '—'} · **Dependencies:** ${(s.dependencies || []).join(', ') || '—'}\n\n`;
    for (const a of s.alternatives) {
      pr += `#### ${a.key} — ${a.name}\n\n| | |\n|---|---|\n| Visual concept | ${esc(a.concept)} |\n| Layout | ${esc(a.layout)} |\n| Information hierarchy | ${esc(a.hierarchy)} |\n| Interactions | ${esc(a.interactions)} |\n| Navigation | ${esc(a.navigation)} |\n| Desktop | ${esc(a.desktop)} |\n| Mobile | ${esc(a.mobile)} |\n| Advantages | ${esc((a.pros || []).join('; '))} |\n| Disadvantages | ${esc((a.cons || []).join('; '))} |\n| Complexity / perf | ${a.complexity || '—'} / ${a.perf || '—'} |\n| Works with | ${esc((a.worksWith || []).join(', '))} |\n| Fits identities | ${(a.directions || []).join(', ').toUpperCase()} |\n${a.patterns && a.patterns.length ? `| Patterns | ${esc(a.patterns.join('; '))} |\n` : ''}\n`;
    }
  }
}
fs.writeFileSync(path.join(docs, 'HM-EXPERIENCE-2027-SURFACE-PROPOSALS.md'), pr);

// Owner decisions
let od = `# HM Experience 2027 — Owner Decisions\n\n> Every design decision that needs product-owner approval. Fill in **Decision** and **Comments** here, or record them in the Design Lab (*Decisions* view → *Export Markdown*) and paste the export below.\n> Recommendations are advice. Different surfaces may use different alternatives as long as they stay within one identity.\n\n## 1. Decide first — global decisions (affect the whole design system)\n\nThese constrain every surface. Recommended order: G1 → G2 → G3/G4 → G5–G8.\n\n`;
for (const g of GLOBAL) od += `### ${g.id} · ${g.title}\n\n${g.options.map((o) => `- [ ] ${o}`).join('\n')}\n\n**Recommendation:** ${g.rec} — ${g.why}\n\n**Decision:** ______  \n**Comments:** \n\n`;
od += `## 2. Surface decisions\n\nPriority P0 = redesign first. HI-FI = interactive prototype available in the lab.\n\n| ID | Surface | Pri | A | B | C | Rec. | Decision | Comments |\n|---|---|---|---|---|---|---|---|---|\n`;
const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
for (const s of [...surfaces].sort((a, b) => (order[a.priority] ?? 4) - (order[b.priority] ?? 4) || a.id.localeCompare(b.id))) {
  const n = (k) => esc((s.alternatives.find((a) => a.key === k) || {}).name || '—');
  od += `| ${s.id}${s.protoKey ? ' HI-FI' : ''} | ${esc(s.name)} | ${s.priority || '—'} | ${n('A')} | ${n('B')} | ${n('C')} | ${s.recommendation || '—'} | | |\n`;
}
fs.writeFileSync(path.join(docs, 'HM-EXPERIENCE-2027-OWNER-DECISIONS.md'), od);

console.log(`surfaces: ${surfaces.length}, with proposals: ${surfaces.length - missing.length}, missing: ${missing.length}`);
