// Verifies the Club Identity Registry and its Design Lab integration.
// Usage (repo root, lab served on 127.0.0.1:3790): node design-lab/experience-2027/club-identity/verify-club-identity.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const N = require('./neon.js');
const { chromium } = require(process.env.PW_PATH || 'C:/DEV/PROJECTS/handball-manager/node_modules/playwright');

const here = __dirname;
const ROOT = path.resolve(here, '..', '..', '..');
const DOCS = path.join(ROOT, 'docs', 'experience-2027');
const BASE = 'http://127.0.0.1:3790/design-lab/experience-2027/';
const reg = JSON.parse(fs.readFileSync(path.join(here, 'registry.json'), 'utf8'));
const issues = [];
const res = {};

// 1. completeness vs the game database (fresh extraction)
execFileSync(process.execPath, [path.join(here, 'extract-clubs.mjs')], { cwd: ROOT });
const game = JSON.parse(fs.readFileSync(path.join(here, 'clubs-extracted.json'), 'utf8'));
const regIds = reg.clubs.map((c) => c.id);
const missing = game.filter((g) => !regIds.includes(g.id)).map((g) => g.id);
const extra = regIds.filter((id) => !game.some((g) => g.id === id));
const dup = regIds.length - new Set(regIds).size;
res.completeness = { game: game.length, registry: regIds.length, missing: missing.length, extra: extra.length, duplicates: dup };
if (missing.length || extra.length || dup) issues.push(`registry completeness: missing ${missing.join(',')} extra ${extra.join(',')} dup ${dup}`);
// game data untouched (git)
const gitDiff = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'apps', 'packages'], { cwd: ROOT }).toString().trim();
res.gameDataUnchanged = !gitDiff;
if (gitDiff) issues.push('apps/packages changed: ' + gitDiff);

// 2. per-club rules
let det = 0, contrastOk = 0;
for (const c of reg.clubs) {
  const kit = { primary: ['UNKNOWN', 'NOT_RESEARCHED'].includes(c.status) ? null : c.kit.primary.hex, secondary: c.kit.secondary.hex, trim: c.kit.trim.hex, status: c.status };
  const again = N.neonForKit(kit).neon;
  if (!c.override && again !== c.neon) issues.push(`${c.id}: neon not reproducible (${c.neon} vs ${again})`); else det++;
  const a = N.contrast(c.neon, N.BG), b = N.contrast(N.INK, c.neon);
  if (a < 4.5 || b < 4.5) issues.push(`${c.id}: contrast ${a.toFixed(2)}/${b.toFixed(2)}`); else contrastOk++;
  if (['UNKNOWN', 'NOT_RESEARCHED'].includes(c.status) && c.neon !== N.PENDING) issues.push(`${c.id}: unknown kit but non-pending neon (invented?)`);
  if (['VERIFIED', 'PROBABLE'].includes(c.status) && !c.sources.length) issues.push(`${c.id}: ${c.status} without sources`);
  if (c.kit.primary.hex && !c.sources.length && !c.override) issues.push(`${c.id}: colour without source`);
  if (c.reviewReasons.length === 0 && !['VERIFIED', 'PROBABLE'].includes(c.status)) issues.push(`${c.id}: ${c.status} not on review list`);
}
res.deterministic = det; res.contrastPass = contrastOk;
const byStatus = reg.clubs.reduce((m, c) => ((m[c.status] = (m[c.status] || 0) + 1), m), {});
res.byStatus = byStatus;

// 3. no hard-coded club colours outside the registry
const kitSrc = fs.readFileSync(path.join(here, '..', 'proto', 'kit.js'), 'utf8');
if (/NEON_OVERRIDE|#2e9bff|#1ff28a/.test(kitSrc)) issues.push('kit.js still contains hard-coded club neon overrides');
const labSrc = fs.readFileSync(path.join(here, '..', 'lab.js'), 'utf8');
if (/#2e9bff|#1ff28a/.test(labSrc)) issues.push('lab.js still contains hard-coded club neons');

(async () => {
  const browser = await chromium.launch();
  // 4. sample crest colours == registry kit colours (or neutral when no kit evidence)
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.goto(BASE + 'frame.html?verify=club#s=dashboard&alt=C&theme=b&nav=c');
  const crestCheck = await pg.evaluate(() => window.HM.clubs.map((c) => { const r = window.HM_CLUB_REGISTRY.clubs.find((x) => x.id === c.regId); return { id: c.id, regId: c.regId, c1: c.c1, p: r && r.p, status: r && r.status }; }));
  crestCheck.forEach((x) => { const hasKit = x.p && ['VERIFIED', 'PROBABLE', 'UNCERTAIN'].includes(x.status); if (hasKit ? x.c1.toUpperCase() !== x.p.toUpperCase() : x.c1 !== '#3a4250') issues.push(`sample crest ${x.id} not from registry`); });
  res.sampleCrests = crestCheck.length;

  // 5. accent across screens × clubs × devices
  const KEYS = [['dashboard', 'C', 1], ['player', 'C', 1], ['squad', 'A', 0], ['scouting', 'C', 1], ['matchday', 'C', 1], ['analysis', 'C', 1]];
  const se = reg.clubs.filter((c) => c.tier.startsWith('SE-1') || c.tier.startsWith('SE-2'));
  const others = reg.clubs.filter((c) => !se.includes(c)).filter((_, i) => i % 9 === 0);
  const CLUBS = [...se, ...others].map((c) => c.id).concat(['none']);
  let renders = 0;
  for (const [dev, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, isMobile: dev === 'mobile' });
    await p.goto(BASE + 'frame.html?verify=club2#s=dashboard&alt=C&theme=b&nav=c');
    for (const club of CLUBS) {
      const want = club === 'none' ? reg.clubless : reg.clubs.find((c) => c.id === club).neon;
      const short = club === 'none' ? 'Fri agent' : (reg.clubs.find((c) => c.id === club).shortName || '');
      for (const [k, alt, adapt] of KEYS) {
        const q = new URLSearchParams({ s: k, alt, theme: 'b', nav: 'c', club }); if (adapt) q.set('adapt', '1');
        await p.evaluate((hh) => { location.hash = hh; }, q.toString());
        await p.waitForTimeout(8);
        const r = await p.evaluate(() => {
          const probe = document.createElement('i'); probe.style.color = 'var(--accent)'; document.body.appendChild(probe);
          const accent = getComputedStyle(probe).color; probe.remove();
          const wm = (document.querySelector('.masthead .wm') || {}).textContent || '';
          return { accent, wm, overflow: document.documentElement.scrollWidth - innerWidth, err: /Renderingsfel|undefined|NaN/.test(document.getElementById('root').innerText) };
        });
        renders++;
        const rgb = 'rgb(' + [1, 3, 5].map((i) => parseInt(want.slice(i, i + 2), 16)).join(', ') + ')';
        if (r.accent !== rgb) issues.push(`${dev} ${k} ${club}: accent ${r.accent} ≠ ${want}`);
        const long = short.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const words = long.length ? long : [short.toLowerCase()];
        if (k !== 'matchday' && short && !words.some((w) => r.wm.toLowerCase().includes(w.slice(0, 5)))) issues.push(`${dev} ${k} ${club}: shell shows "${r.wm.slice(0, 30)}" not "${short}"`);
        if (r.overflow > 2) issues.push(`${dev} ${k} ${club}: overflow ${r.overflow}px`);
        if (r.err) issues.push(`${dev} ${k} ${club}: render error`);
      }
    }
    await p.close();
  }
  res.accentRenders = renders; res.clubsTested = CLUBS.length;
  // determinism across reloads
  await pg.evaluate(() => { location.hash = 's=dashboard&alt=C&theme=b&club=se_club_hammarby_if_hf'; });
  await pg.waitForTimeout(150);
  const d1 = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--club-neon').trim());
  await pg.reload(); await pg.waitForTimeout(200);
  const d2 = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--club-neon').trim());
  if (d1 !== d2) issues.push(`same club produced different identity across reloads (${d1} vs ${d2})`);
  // 6. lab club view
  const lab = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await lab.goto(BASE + 'index.html?verify=club');
  await lab.evaluate(() => localStorage.setItem('hm-exp27-lab-v1', JSON.stringify({ amend20261113: true, view: 'clubid', identity: 'b', club: 'swe2-tumba', clubPick: 'se_club_hammarby_if_hf' })));
  await lab.reload(); await lab.waitForSelector('.ci-card');
  const lv = await lab.evaluate(() => ({ items: document.querySelectorAll('.ci-it').length, options: document.querySelectorAll('#club option').length, strip: document.querySelectorAll('.ci-strip button').length, card: document.querySelector('.ci-card').innerText }));
  if (lv.items !== reg.clubs.length || lv.options !== reg.clubs.length + 1 || lv.strip !== reg.clubs.length) issues.push(`lab club view lists ${lv.items}/${lv.options}/${lv.strip}`);
  if (!/Hammarby/.test(lv.card)) issues.push('lab kit card does not show the picked club');
  res.labClubView = { items: lv.items, selectorOptions: lv.options, neonStrip: lv.strip };
  await browser.close();

  const md = `# HM Experience 2027 — Club Identity Verification\n\nGenerated by \`design-lab/experience-2027/club-identity/verify-club-identity.cjs\` on ${new Date().toISOString()}.\n\n| Check | Result |\n|---|---|\n| Registry covers the full game database (fresh read-only extraction) | ${res.completeness.registry}/${res.completeness.game} clubs · missing ${res.completeness.missing} · extra ${res.completeness.extra} · duplicates ${res.completeness.duplicates} |\n| Game data (apps/, packages/) unchanged | ${res.gameDataUnchanged ? 'yes' : 'NO'} |\n| Neon reproducible from kit colours by the shared generator (same club → same identity) | ${res.deterministic}/${reg.clubs.length} |\n| Contrast ≥ 4.5 (neon on night bg and dark ink on neon) | ${res.contrastPass}/${reg.clubs.length} |\n| Unknown / not researched kits use the pending neon (nothing invented) | checked |\n| Verified/probable kits have sources; every colour has a source or a logged override | checked |\n| Uncertain/unknown clubs are on the review list | checked |\n| No hard-coded club neons in kit.js / lab.js | checked |\n| Sample crest colours come from the registry (neutral when no kit evidence) | ${res.sampleCrests} sample clubs |\n| Accent = registry neon, shell shows the club, no overflow, no render error | ${res.accentRenders} renders (${res.clubsTested} clubs incl. clubless × 6 screens × desktop/mobile) |\n| Identity stable across reloads | checked |\n| Lab Club identity view lists every club (picker, selector, neon strip) | ${res.labClubView.items} / ${res.labClubView.selectorOptions} / ${res.labClubView.neonStrip} |\n\nStatus distribution: ${Object.entries(res.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}\n\n**Total issues: ${issues.length}**\n\n${issues.length ? '## Issues\n\n' + issues.map((x) => '- ' + x).join('\n') + '\n' : ''}`;
  fs.writeFileSync(path.join(DOCS, 'HM-EXPERIENCE-2027-CLUB-IDENTITY-VERIFICATION.md'), md);
  console.log(md);
  process.exit(issues.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
