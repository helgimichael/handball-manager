// Builds the Club Identity Registry from: the extracted game club list (clubs-extracted.json),
// kit research (research/results-*.json) and manual overrides (overrides.json).
// Outputs: registry.json (full), ../data/club-registry.js (lab), and three audit documents.
// Usage (repo root): node design-lab/experience-2027/club-identity/build-registry.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const N = require('./neon.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, '..', '..', '..', 'docs', 'experience-2027');
const read = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : d);

// One standard palette for documented colour NAMES (used only when no exact hex is documented).
export const STANDARD = {
  white: '#FFFFFF', black: '#111111', grey: '#8A8D91', silver: '#A7A9AC', red: '#C8102E', 'dark-red': '#9B1B30', wine: '#722F37', maroon: '#6D2333',
  orange: '#F57C00', yellow: '#FFD100', gold: '#C99A2E', green: '#00843D', 'dark-green': '#0B5D3B', 'light-green': '#6CC24A',
  blue: '#0057B8', 'royal-blue': '#1F4FB4', 'light-blue': '#5BB5E8', 'sky-blue': '#4FA3DC', navy: '#14284B', turquoise: '#00A3AD', teal: '#007C80', purple: '#5B2C8F', pink: '#E4007C',
};
const norm = (n) => (n ? String(n).toLowerCase().trim().replace(/\s+/g, '-') : null);
function colour(name, hex) {
  if (hex && /^#?[0-9a-f]{6}$/i.test(hex)) return { hex: ('#' + hex.replace('#', '')).toUpperCase(), name: norm(name), hexSource: 'documented' };
  const k = norm(name);
  if (k && STANDARD[k]) return { hex: STANDARD[k], name: k, hexSource: 'standard-palette' };
  if (k) return { hex: null, name: k, hexSource: 'unmapped-name' };
  return { hex: null, name: null, hexSource: null };
}

// Phase 2: a colour measured from an evidence photo is used as the original HEX when it is consistent with the
// documented colour name (same hue family / achromatic class). Otherwise the palette value is kept and the club is flagged.
function colourM(name, docHex, measured, flags, label) {
  const base = colour(name, docHex);
  if (!measured || !/^#?[0-9a-f]{6}$/i.test(measured) || !base.name) return base;
  const m = ('#' + measured.replace('#', '')).toUpperCase();
  const [mL, mC, mH] = N.hexToOklch(m);
  const ref = base.hex ? N.hexToOklch(base.hex) : null;
  let ok = true;
  if (ref) {
    const [rL, rC, rH] = ref;
    const refChromatic = rC >= 0.045, mChromatic = mC >= 0.035;
    if (refChromatic && !mChromatic) ok = false;
    else if (!refChromatic && mC > 0.09) ok = false;
    else if (refChromatic && mChromatic) { const d = Math.abs(rH - mH); if (Math.min(d, 360 - d) > 40) ok = false; }
    if (!refChromatic && ((rL > 0.8 && mL < 0.55) || (rL < 0.3 && mL > 0.5))) ok = false;
  }
  if (!ok) { flags.push(`${label}: measured ${m} inconsistent with documented "${base.name}" → palette value kept`); return { ...base, measured: m, measurementRejected: true }; }
  return { hex: m, name: base.name, hexSource: 'measured-photo', paletteHex: base.hex, measured: m, neonRef: N.nudgedReference(base.hex, m, 10) };
}
const RANK = { VERIFIED: 4, PROBABLE: 3, UNCERTAIN: 2, UNKNOWN: 1, NOT_RESEARCHED: 0 };
const VISUAL_TYPES = new Set(['official-match-photo', 'official-team-photo', 'league-photo', 'press-photo', 'official-social', 'visual-check', 'shop-product']);

const clubs = read(path.join(here, 'clubs-extracted.json'), []);
const research = new Map();
for (const f of fs.existsSync(path.join(here, 'research')) ? fs.readdirSync(path.join(here, 'research')) : []) {
  if (/^results-\d+\.json$/.test(f)) read(path.join(here, 'research', f), []).forEach((r) => research.set(r.id, { ...r, _file: f }));
}
// Verification passes (official evidence) supersede the first pass for the same club.
for (const f of fs.existsSync(path.join(here, 'research')) ? fs.readdirSync(path.join(here, 'research')).sort() : []) {
  if (/^results-\d+v(-[a-z])?\.json$/.test(f)) read(path.join(here, 'research', f), []).forEach((r) => research.set(r.id, { ...r, _file: f }));
}
// Visual checks: Claude viewed official home-shirt imagery in a browser and recorded what it showed.
const visual = new Map(read(path.join(here, 'visual-checks.json'), []).map((v) => [v.id, v]));
for (const v of visual.values()) {
  const r = research.get(v.id) || {};
  const agrees = v.primary === r.primary;
  research.set(v.id, { ...r, ...(v.primary ? { primary: v.primary, primaryHex: null } : {}), ...(v.secondary !== undefined ? { secondary: v.secondary, secondaryHex: null } : {}), ...(v.trim !== undefined ? { trim: v.trim, trimHex: null } : {}), description: v.description || r.description, season: v.season || r.season,
    status: v.status || 'VERIFIED', confidence: v.confidence ?? 0.95,
    sources: [{ url: v.url, type: 'visual-check', evidence: v.evidence }, ...(r.sources || [])],
    notes: `${r.notes ? r.notes + ' ' : ''}Visual check ${v.date}: ${v.evidence}${agrees ? '' : ` (changed from ${r.primary || 'none'} → ${v.primary})`}`, reviewReason: v.reviewReason !== undefined ? v.reviewReason : (v.status === 'VERIFIED' || !v.status ? null : r.reviewReason), _file: 'visual-checks.json' });
}
// Phase 2 (visual verification of every club). A phase-2 record supersedes earlier evidence unless it is weaker
// (e.g. phase 2 found no image for a club Claude had already verified visually); ties go to phase 2.
const p2dir = path.join(here, 'research', 'phase2');
const phase2 = new Map();
for (const f of fs.existsSync(p2dir) ? fs.readdirSync(p2dir).sort() : []) {
  if (!/^results-[a-z0-9]+\.json$/.test(f)) continue;
  for (const q of read(path.join(p2dir, f), [])) {
    const rec = { primary: q.primary, secondary: q.secondary, trim: q.accent ?? q.trim ?? null, primaryHex: null, secondaryHex: null, trimHex: null,
      primaryMeasured: q.primaryMeasured, secondaryMeasured: q.secondaryMeasured, trimMeasured: q.accentMeasured,
      pattern: q.pattern, description: q.description, season: q.season, status: q.status, confidence: q.confidence,
      sources: (q.evidence || []).map((e) => ({ url: e.url, type: e.type, evidence: e.observation, date: e.date, screenshot: e.screenshot ? 'research/phase2/' + e.screenshot.replace(/^.*?evidence\//, 'evidence/') : null })),
      notes: q.notes, reviewReason: q.reviewReason, crest: q.crest || null, team: q.team || null, homeKit: q.homeKit ?? null, photoDate: q.photoDate || null, womenDiffer: q.womenDiffer ?? null, phase: 2, _file: 'phase2/' + f };
    phase2.set(q.id, rec);
  }
}
for (const [id, rec] of phase2) {
  const prev = research.get(id);
  // Keep an earlier record only if it was itself image-backed (Claude's visual checks) AND stronger; text-only claims never outrank Phase 2.
  const prevVisual = prev && (prev.sources || []).some((x) => VISUAL_TYPES.has(x.type));
  if (prev && prevVisual && (RANK[prev.status] || 0) > (RANK[rec.status] || 0)) { research.set(id, { ...prev, phase2Attempt: { status: rec.status, sources: rec.sources, notes: rec.notes, crest: rec.crest } }); continue; }
  research.set(id, { ...rec, sources: [...rec.sources, ...((prev && prev.sources) || []).filter((s) => !rec.sources.some((x) => x.url === s.url))] });
}
const overrides = new Map(read(path.join(here, 'overrides.json'), []).map((o) => [o.id, o]));

const registry = clubs.map((c) => {
  const r = research.get(c.id);
  const o = overrides.get(c.id) || {};
  let status = o.status || (r ? r.status : 'NOT_RESEARCHED');
  // QA rule (Phase 2 standard): evidence must show the MEN'S A-TEAM. If the best image shows a youth or women's team,
  // the status is capped at UNCERTAIN ("unclear which team the image shows" for this club's first team).
  const qa = [];
  if (!o.status && r?.team && ['youth', 'women'].includes(r.team) && ['VERIFIED', 'PROBABLE'].includes(status)) { qa.push(`QA: best evidence shows the ${r.team} team, not the men's A-team → capped at UNCERTAIN (was ${status})`); status = 'UNCERTAIN'; }
  const mflags = [];
  const primary = colourM(o.primary || r?.primary, o.primaryHex || r?.primaryHex, o.primary ? null : r?.primaryMeasured, mflags, 'primary');
  const secondary = colourM(o.secondary || r?.secondary, o.secondaryHex || r?.secondaryHex, o.secondary ? null : r?.secondaryMeasured, mflags, 'secondary');
  const trim = colourM(o.trim || r?.trim, o.trimHex || r?.trimHex, o.trim ? null : r?.trimMeasured, mflags, 'accent');
  const crestSrc = r?.crest || (r?.phase2Attempt && r.phase2Attempt.crest) || null;
  const crest = crestSrc ? { primary: colour(crestSrc.primary, null), secondary: colour(crestSrc.secondary, null), note: crestSrc.note || null } : null;
  const sourcesAll = r?.sources || [];
  const evidenceBasis = sourcesAll.some((x) => VISUAL_TYPES.has(x.type)) ? 'visual' : sourcesAll.length ? 'text' : 'none';
  // Neon reference = documented colour (nudged ≤10° toward a measured photo hue). The measured HEX itself is kept as the original colour.
  const ref = (x) => x.neonRef || x.hex;
  const neonInfo = N.neonForKit({ primary: status === 'UNKNOWN' || status === 'NOT_RESEARCHED' ? null : ref(primary), secondary: ref(secondary), trim: ref(trim), status, override: o.neonOverride || null });
  const reviewReasons = [];
  if (status === 'UNCERTAIN' || status === 'UNKNOWN' || status === 'NOT_RESEARCHED') reviewReasons.push(r?.reviewReason || `status ${status}`);
  if (neonInfo.rule.startsWith('monochrome')) reviewReasons.push('monochrome shirt without documented accent colour → ice-silver neon');
  // For white/black shirts the accent must be ON the home kit. If the evidence says it is a club colour, away-kit
  // colour, text colour or dated trim, the colour is still documented (not invented) but needs an owner decision.
  let accentBasis = null;
  if (/^(secondary|trim)/.test(neonInfo.rule)) {
    const txt = `${r?.notes || ''} ${r?.description || ''}`;
    const visualHome = !!(visual.get(c.id) && visual.get(c.id).accentOnHomeShirt); // a visual check confirmed the accent is on the home shirt
    const weak = !visualHome && /\b(away|borta|club colou?rs?|colour2|klubbf[äa]rg|infobox|text ?colou?r|textf[äa]rg|not confirmed|not a documented|outdated|20(0|1)\d-\d\d|parent[- ]club|training wear)\b/i.test(txt);
    accentBasis = weak ? 'club-or-away-colour' : 'home-kit';
    if (weak) reviewReasons.push('white/black home shirt: neon accent is documented as a club, away or dated colour — not confirmed as a home-shirt detail (owner decision)');
  }
  [primary, secondary, trim].forEach((x, i) => { if (x.hexSource === 'unmapped-name') reviewReasons.push(`${['primary', 'secondary', 'trim'][i]} colour name "${x.name}" not in standard palette`); });
  if (r?.reviewReason && !reviewReasons.includes(r.reviewReason)) reviewReasons.push(r.reviewReason);
  mflags.forEach((m) => reviewReasons.push(m));
  qa.forEach((m) => reviewReasons.push(m));
  if (['VERIFIED', 'PROBABLE'].includes(status) && evidenceBasis !== 'visual' && c.tier.startsWith('SE')) reviewReasons.push('no image evidence seen (text sources only)');
  return {
    id: c.id, name: c.name, shortName: c.shortName, city: c.city || null, tier: c.tier, competitionId: c.competitionId, playable: !!c.playable,
    kit: { primary, secondary, trim, pattern: r?.pattern || 'unknown', description: r?.description || null, season: r?.season || null },
    neon: neonInfo.neon, neonRule: neonInfo.rule, neonSourceHex: neonInfo.source, accentBasis,
    contrast: { neonOnNight: +N.contrast(neonInfo.neon, N.BG).toFixed(2), inkOnNeon: +N.contrast(N.INK, neonInfo.neon).toFixed(2) },
    status, confidence: r?.confidence ?? null, crestDiffers: r?.crestDiffers ?? (crest && primary.name && crest.primary.name ? crest.primary.name !== primary.name : null),
    crest, evidenceBasis, team: r?.team || null, homeKit: r?.homeKit ?? null, photoDate: r?.photoDate || null, womenDiffer: r?.womenDiffer ?? null, phase: r?.phase || 1, phase2Attempt: r?.phase2Attempt || null,
    sources: r?.sources || [], notes: r?.notes || null,
    override: o.id ? { reason: o.reason, by: o.by, date: o.date, fields: Object.keys(o).filter((k) => !['id', 'reason', 'by', 'date'].includes(k)) } : null,
    gamePlaceholder: { primary: c.placeholderPrimary || null, secondary: c.placeholderSecondary || null },
    reviewReasons,
  };
});

fs.writeFileSync(path.join(here, 'registry.json'), JSON.stringify({ generated: new Date().toISOString(), method: 'see HM-EXPERIENCE-2027-CLUB-KIT-AUDIT.md', standardPalette: STANDARD, clubless: N.CLUBLESS, pending: N.PENDING, monochrome: N.MONOCHROME, clubs: registry }, null, 1));
const slim = registry.map((x) => ({ id: x.id, name: x.name, short: x.shortName, tier: x.tier, playable: x.playable, p: x.kit.primary.hex, pn: x.kit.primary.name, s: x.kit.secondary.hex, sn: x.kit.secondary.name, t: x.kit.trim.hex, tn: x.kit.trim.name, pattern: x.kit.pattern, desc: x.kit.description, season: x.kit.season, neon: x.neon, rule: x.neonRule, basis: x.accentBasis, status: x.status, conf: x.confidence, src: (x.sources[0] || {}).url || null, srcType: (x.sources[0] || {}).type || null, nsrc: x.sources.length, review: x.reviewReasons, ph: x.gamePlaceholder.primary, phs: x.gamePlaceholder.secondary, pm: x.kit.primary.hexSource === 'measured-photo', cp: x.crest ? x.crest.primary.hex : null, cpn: x.crest ? x.crest.primary.name : null, cs: x.crest ? x.crest.secondary.hex : null, csn: x.crest ? x.crest.secondary.name : null, shot: (x.sources.find((y) => y.screenshot) || {}).screenshot || null, ev: x.evidenceBasis, team: x.team, date: x.photoDate, wd: x.womenDiffer, phase: x.phase }));
fs.writeFileSync(path.join(here, '..', 'data', 'club-registry.js'), '/* generated by club-identity/build-registry.mjs — do not edit */\nwindow.HM_CLUB_REGISTRY = ' + JSON.stringify({ clubless: N.CLUBLESS, pending: N.PENDING, monochrome: N.MONOCHROME, clubs: slim }) + ';\n');

// ---------- documents ----------
const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const sw = (h) => (h ? `\`${h}\`` : '—');
const count = (f) => registry.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const TIERS = ['SE-1 Handbollsligan', 'SE-2 Allsvenskan', 'SE-3 Division 1', 'SE-4 Division 2', 'International / world pool'];
const st = count((x) => x.status), rules = count((x) => x.neonRule);
const statusByTier = TIERS.map((t) => { const l = registry.filter((x) => x.tier === t); const c = l.reduce((m, x) => ((m[x.status] = (m[x.status] || 0) + 1), m), {}); return `| ${t} | ${l.length} | ${c.VERIFIED || 0} | ${c.PROBABLE || 0} | ${c.UNCERTAIN || 0} | ${c.UNKNOWN || 0} | ${c.NOT_RESEARCHED || 0} |`; }).join('\n');

let audit = `# HM Experience 2027 — Complete Club Kit Colour Audit\n\n> Generated by \`design-lab/experience-2027/club-identity/build-registry.mjs\` (${new Date().toISOString().slice(0, 10)}). Design principle (owner, 2026-11-13): **every club's neon identity originates from the dominant colour of its actual first-choice home shirt.**\n> Scope: **all ${registry.length} clubs** in the game database (read-only extraction from \`apps/game/lib/game-data/clubs.ts\` and the Division 2 registrations in \`lib/competition/transition/sweden2026Data.json\`). No game data was changed. The game's current \`primaryColor\` values are documented in source as unverified crest placeholders and were **not** used as evidence.\n\n`;
audit += `## Coverage\n\n| Tier | Clubs | Verified | Probable | Uncertain | Unknown | Not researched |\n|---|---|---|---|---|---|---|\n${statusByTier}\n| **Total** | **${registry.length}** | **${st.VERIFIED || 0}** | **${st.PROBABLE || 0}** | **${st.UNCERTAIN || 0}** | **${st.UNKNOWN || 0}** | **${st.NOT_RESEARCHED || 0}** |\n\n`;
audit += `Neon rule applied: ${Object.entries(rules).map(([k, v]) => `${k} ${v}`).join(' · ')}.\n\n`;
audit += `## Method\n\n1. **Evidence.** Researchers looked for text that states the current home-shirt colour, in this priority order: official club shop listings, official club or social posts, kit manufacturers, match reports, Wikipedia kit templates. They read pages as text and **did not measure colours in photographs**; they recorded documented colour names and any documented exact hex.\n2. **Colour value.** A documented hex is used as-is (\`hexSource: documented\`). Otherwise the documented colour *name* maps to one shared standard palette (\`hexSource: standard-palette\`), so the same name always gives the same value:\n\n${Object.entries(STANDARD).map(([k, v]) => `\`${k}\` ${v}`).join(' · ')}\n\n3. **Neon** (\`club-identity/neon.js\`, shared by the lab and this build):\n   - Source colour: the chromatic home-shirt colour; for white, black or grey shirts, the documented secondary, then the trim colour.\n   - Conversion: OKLCH, keeping the hue, with fixed lightness and chroma targets per hue family (yellows lighter so they stay yellow), clipped to the sRGB gamut.\n   - Accessibility gate: neon on the Arena night background \`${N.BG}\` and dark ink \`${N.INK}\` on neon must both be at least 4.5:1.\n   - Shirts that are white, black or grey with no documented accent get **monochrome ice-silver** \`${N.MONOCHROME}\`. No hue is invented.\n   - Unknown or unverified kits get **pending steel** \`${N.PENDING}\`. A clubless manager uses **neon orange** \`${N.CLUBLESS}\` (owner decision).\n4. **Overrides** live only in \`club-identity/overrides.json\`, with a reason, owner and date. None are applied unless listed there.\n\n`;
for (const t of TIERS) {
  const l = registry.filter((x) => x.tier === t);
  audit += `## ${t} (${l.length})\n\n| ID | Club | Home shirt | Primary | Secondary | Trim | Neon | Rule | Status | Conf. | Season |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const x of l) audit += `| \`${x.id}\` | ${esc(x.name)} | ${esc(x.kit.description || '—')} | ${x.kit.primary.name || '—'} ${sw(x.kit.primary.hex)}${x.kit.primary.hexSource === 'documented' ? ' (doc.)' : ''} | ${x.kit.secondary.name || '—'} ${sw(x.kit.secondary.hex)} | ${x.kit.trim.name || '—'} ${sw(x.kit.trim.hex)} | ${sw(x.neon)} | ${x.neonRule}${x.accentBasis === 'club-or-away-colour' ? ' ⚠ club/away colour' : ''} | ${x.status} | ${x.confidence ?? '—'} | ${x.kit.season || '—'} |\n`;
  audit += '\n';
}
fs.writeFileSync(path.join(docs, 'HM-EXPERIENCE-2027-CLUB-KIT-AUDIT.md'), audit);

let srcDoc = `# HM Experience 2027 — Club Kit Source & Confidence Register\n\n> Every source behind every kit colour (generated). Status definitions: VERIFIED = official club/shop/manufacturer text states the current home-shirt colour · PROBABLE = consistent reliable non-official evidence or older official evidence · UNCERTAIN = conflicting/weak · UNKNOWN = no usable evidence · NOT_RESEARCHED = not yet covered.\n\n`;
for (const x of registry) {
  srcDoc += `### ${x.name} — \`${x.id}\`\n\n${x.tier} · **${x.status}**${x.confidence != null ? ` (confidence ${x.confidence})` : ''} · crest differs from shirt: ${x.crestDiffers == null ? 'unknown' : x.crestDiffers ? 'yes' : 'no'}${x.kit.season ? ` · season ${x.kit.season}` : ''}\n\n`;
  srcDoc += x.sources.length ? x.sources.map((s, i) => `${i + 1}. [${esc(s.type)}]${s.date ? ` (${esc(s.date)})` : ''} ${s.url} — ${esc(s.evidence || '')}${s.screenshot ? ` · screenshot: [${s.screenshot}](../../design-lab/experience-2027/club-identity/${s.screenshot})` : ''}`).join('\n') + '\n' : '- no source found\n';
  if (x.phase2Attempt) srcDoc += `\n_Phase 2 attempt (${x.phase2Attempt.status}, weaker than retained evidence):_ ${(x.phase2Attempt.sources || []).map((s) => s.url).join(', ') || 'no source'} ${esc(x.phase2Attempt.notes || '')}\n`;
  if (x.notes) srcDoc += `\n_Notes:_ ${esc(x.notes)}\n`;
  srcDoc += '\n';
}
fs.writeFileSync(path.join(docs, 'HM-EXPERIENCE-2027-CLUB-SOURCE-REGISTER.md'), srcDoc);

// ---------- Swedish club kit audit (Phase 2) ----------
const SE = registry.filter((x) => x.tier.startsWith('SE'));
const seTiers = TIERS.filter((t) => t.startsWith('SE'));
const cntBy = (l, f) => l.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const seSt = cntBy(SE, (x) => x.status);
let sv = `# HM Experience 2027 — Swedish Club Kit Audit (Phase 2)\n\n> Generated by \`club-identity/build-registry.mjs\` (${new Date().toISOString().slice(0, 10)}). All **${SE.length} Swedish clubs** in the game database (Handbollsligan, Allsvenskan, Division 1, Division 2). Phase 2 standard (owner): VERIFIED = official match photo or official source where the men's A-team home shirt is identifiable and the colour can be judged with high confidence; a shop product image alone is never enough. PROBABLE = clear visual evidence short of that (older photos, unconfirmed season, press). UNCERTAIN = conflicting / several possible shirts / unclear team or kit. UNKNOWN = no reliable evidence. **No colour is guessed.**\n> "Measured" = the original HEX was measured from the evidence photo (median of plain shirt fabric, \`club-identity/sample_colour.py\`); otherwise the documented colour name maps to the shared palette. Crests keep their own colours.\n\n`;
sv += `## Status\n\n| Tier | Clubs | Verified | Probable | Uncertain | Unknown |\n|---|---|---|---|---|---|\n`;
for (const t of seTiers) { const l = SE.filter((x) => x.tier === t); const c = cntBy(l, (x) => x.status); sv += `| ${t} | ${l.length} | ${c.VERIFIED || 0} | ${c.PROBABLE || 0} | ${c.UNCERTAIN || 0} | ${c.UNKNOWN || 0} |\n`; }
sv += `| **Sweden total** | **${SE.length}** | **${seSt.VERIFIED || 0}** | **${seSt.PROBABLE || 0}** | **${seSt.UNCERTAIN || 0}** | **${seSt.UNKNOWN || 0}** |\n\n`;
const evc = cntBy(SE, (x) => x.evidenceBasis);
sv += `Evidence basis: image seen ${evc.visual || 0} · text only ${evc.text || 0} · none ${evc.none || 0}. Original HEX measured from a photo: ${SE.filter((x) => x.kit.primary.hexSource === 'measured-photo').length}. Evidence screenshots archived: ${SE.filter((x) => x.sources.some((y) => y.screenshot)).length} clubs.\n\n`;
for (const t of seTiers) {
  sv += `## ${t}\n\n| Club | Status | Home shirt (men's A-team) | Primary (HEX) | Secondary / accent | Neon | Crest | Evidence |\n|---|---|---|---|---|---|---|---|\n`;
  for (const x of SE.filter((y) => y.tier === t)) {
    const shot = x.sources.find((y) => y.screenshot);
    const ev = x.sources[0];
    sv += `| **${esc(x.name)}**<br>\`${x.id}\` | ${x.status}${x.confidence != null ? ` (${x.confidence})` : ''} | ${esc(x.kit.description || '—')}${x.team ? `<br>team: ${x.team}` : ''}${x.photoDate ? ` · ${x.photoDate}` : ''}${x.womenDiffer === true ? '<br>women\'s kit differs' : ''} | ${x.kit.primary.name || '—'} ${sw(x.kit.primary.hex)}${x.kit.primary.hexSource === 'measured-photo' ? ' measured' : ''} | ${x.kit.secondary.name || '—'} ${sw(x.kit.secondary.hex)}${x.kit.trim.name ? ` / ${x.kit.trim.name}` : ''} | ${sw(x.neon)} ${x.neonRule === 'primary' ? '' : `(${x.neonRule})`} | ${x.crest ? `${x.crest.primary.name || '?'}/${x.crest.secondary.name || '?'}` : 'game data'} | ${ev ? `[${esc(ev.type)}](${ev.url})` : '—'}${shot ? ` · [screenshot](../../design-lab/experience-2027/club-identity/${shot.screenshot})` : ''} |\n`;
  }
  sv += '\n';
}
fs.writeFileSync(path.join(docs, 'HM-EXPERIENCE-2027-CLUB-KIT-AUDIT-SWEDEN.md'), sv);

const rev = registry.filter((x) => x.reviewReasons.length);
let revDoc = `# HM Experience 2027 — Clubs with Missing or Ambiguous Shirt Colours\n\n> ${rev.length} of ${registry.length} clubs need owner review (generated). Until resolved they use the documented rule: unknown/not-researched → pending steel \`${N.PENDING}\`; monochrome without accent → ice silver \`${N.MONOCHROME}\`; uncertain → derived from the best evidence, flagged. No colour has been invented to fill a gap. To resolve: add evidence to \`club-identity/research/results-*.json\` or an entry with reason/owner/date to \`club-identity/overrides.json\`, then rebuild.\n\n| ID | Club | Tier | Status | Current neon | Reason |\n|---|---|---|---|---|---|\n`;
for (const x of rev) revDoc += `| \`${x.id}\` | ${esc(x.name)} | ${x.tier} | ${x.status} | ${sw(x.neon)} | ${esc(x.reviewReasons.join('; '))} |\n`;
fs.writeFileSync(path.join(docs, 'HM-EXPERIENCE-2027-CLUB-KIT-REVIEW-LIST.md'), revDoc);

console.log(`registry: ${registry.length} clubs`, st, rules, `review: ${rev.length}`);
