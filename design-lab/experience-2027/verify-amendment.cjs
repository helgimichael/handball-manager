// Verifies the 2026-11-13 amendment (Arena Nights + Club Identity System, recommendations retained).
// Usage (repo root, lab served on 127.0.0.1:3790): node design-lab/experience-2027/verify-amendment.cjs
// Uses the main checkout's existing Playwright install (no new dependencies).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require(process.env.PW_PATH || 'C:/DEV/PROJECTS/handball-manager/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs', 'experience-2027');
const BASE = process.env.LAB_BASE || 'http://127.0.0.1:3790/design-lab/experience-2027/';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------- 1. data-level checks against the ORIGINAL proposal sources ----------
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'data', 'surfaces.js'), 'utf8'), ctx);
const LAB = ctx.window.LAB_DATA;
const original = ['part-a1', 'part-a2', 'part-b1', 'part-b2'].flatMap((f) => read(path.join(DOCS, 'proposals', f + '.json')));
const origById = new Map(original.map((p) => [p.id, p]));
const ids = new Set(LAB.surfaces.map((s) => s.id));
const FIELDS = ['concept', 'layout', 'hierarchy', 'interactions', 'navigation', 'desktop', 'mobile', 'pros', 'cons', 'complexity', 'perf', 'worksWith', 'directions'];
const dataIssues = [];
let altCount = 0;
for (const s of LAB.surfaces) {
  const o = origById.get(s.id);
  const bad = (m) => dataIssues.push(`${s.id}: ${m}`);
  if (!o) { bad('no original proposal'); continue; }
  if (s.recommendation !== o.recommendation) bad(`recommendation changed ${o.recommendation} → ${s.recommendation}`);
  if (s.reason !== o.reason) bad('reason changed');
  if (s.priority !== o.priority) bad('priority changed');
  if (JSON.stringify(s.dependencies) !== JSON.stringify(o.dependencies)) bad('dependencies changed');
  if (s.alternatives.length !== o.alternatives.length) bad('alternative count changed');
  o.alternatives.forEach((oa) => {
    altCount++;
    const la = s.alternatives.find((a) => a.key === oa.key);
    if (!la) return bad(`alternative ${oa.key} missing`);
    if (oa.name && la.name !== oa.name) bad(`alt ${oa.key} name changed`);
    FIELDS.forEach((f) => { if (JSON.stringify(la[f]) !== JSON.stringify(oa[f])) bad(`alt ${oa.key}.${f} changed`); });
    (la.worksWith || []).forEach((w) => { if (!ids.has(w)) bad(`alt ${oa.key} worksWith unknown id ${w}`); });
  });
  if (!s.alternatives.some((a) => a.key === s.recommendation)) bad('recommended alternative not present');
  if (!s.arena || !['native', 'token', 'adapt', 'internal'].includes(s.arena.status)) bad('missing arena status');
  if (s.arena && s.arena.status === 'adapt' && !(s.arena.conflict && s.arena.adaptation && s.arena.preserved && s.arena.adaptedName)) bad('adaptation record incomplete');
}
const arenaCount = LAB.surfaces.reduce((m, s) => ((m[s.arena.status] = (m[s.arena.status] || 0) + 1), m), {});

(async () => {
  const browser = await chromium.launch();
  const uiIssues = [];
  // ---------- 2. lab UI: every surface shows its recommendation, rationale and arena section ----------
  const lab = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await lab.goto(BASE + 'index.html?verify=1');
  await lab.evaluate(() => { localStorage.setItem('hm-exp27-lab-v1', JSON.stringify({ amend20261113: true, view: 'surfaces', identity: 'b', club: 'tum', nav: 'rec', pres: 'arena', filter: 'all' })); });
  await lab.reload();
  await lab.waitForSelector('.sv-it');
  const labRes = await lab.evaluate(async (expected) => {
    const out = [];
    for (const e of expected) {
      document.querySelector(`.sv-it[data-surface="${e.id}"]`).click();
      await new Promise((r) => setTimeout(r, 5));
      const side = document.querySelector('.sv-side').innerText;
      const recBtn = document.querySelector('.alt-btn .rec');
      const recAlt = recBtn ? recBtn.closest('.alt-btn').dataset.alt : null;
      const altKeys = [...document.querySelectorAll('.alt-btn')].map((b) => b.dataset.alt).join('');
      const src = document.querySelector('.pv iframe').getAttribute('src');
      out.push({ id: e.id, recOk: recAlt === e.rec, altsOk: altKeys === e.alts, reasonOk: side.includes(e.reason.slice(0, 40)), arenaOk: /Arena Nights/.test(side), srcOk: src.includes('theme=b') && src.includes('alt=' + e.rec) && (e.adapt ? src.includes('adapt=1') : !src.includes('adapt=1')) });
    }
    return out;
  }, LAB.surfaces.map((s) => ({ id: s.id, rec: s.recommendation, alts: s.alternatives.map((a) => a.key).join(''), reason: s.reason, adapt: s.arena.status === 'adapt' && s.recommendation === s.recommendation })));
  labRes.forEach((r) => ['recOk', 'altsOk', 'reasonOk', 'arenaOk', 'srcOk'].forEach((k) => { if (!r[k]) uiIssues.push(`${r.id}: lab ${k} failed`); }));

  // ---------- 3. every surface's recommended alternative renders in Arena Nights (adapted where applicable) ----------
  const fr = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await fr.goto(BASE + 'frame.html?verify=1#s=dashboard&alt=C&theme=b');
  const renderIssues = [];
  for (const s of LAB.surfaces) {
    const p = new URLSearchParams({ s: s.protoKey || '__wire', alt: s.recommendation, theme: 'b', club: 'tum', nav: 'c' });
    if (!s.protoKey) p.set('surface', s.id);
    if (s.arena.status === 'adapt') p.set('adapt', '1');
    await fr.evaluate((h) => { location.hash = h; }, p.toString());
    await fr.waitForTimeout(15);
    const r = await fr.evaluate((info) => {
      const t = document.getElementById('root').innerText;
      const err = /Renderingsfel|Ingen prototyp|Okänd yta|Inga alternativ|undefined|NaN/.test(t);
      const wireOk = info.proto ? true : new RegExp('Konceptskiss ' + info.alt, 'i').test(t);
      const adaptNote = !info.proto && info.adapt ? /Arena Nights-anpassning/i.test(t) : true;
      const adaptLayer = info.proto && info.adapt ? !!document.querySelector('.arena-adapt') : true;
      return { err, wireOk, adaptNote, adaptLayer };
    }, { proto: !!s.protoKey, alt: s.recommendation, adapt: s.arena.status === 'adapt' });
    if (r.err) renderIssues.push(`${s.id}: render error`);
    if (!r.wireOk) renderIssues.push(`${s.id}: concept board does not show recommended alt`);
    if (!r.adaptNote) renderIssues.push(`${s.id}: adaptation note missing on concept board`);
    if (!r.adaptLayer) renderIssues.push(`${s.id}: adapted hi-fi layer missing`);
  }

  // ---------- 4. club accent across all major prototypes × clubs × devices ----------
  // Expected accents come from the Club Identity Registry (home-shirt derived), never from hard-coded values.
  const REGJ = JSON.parse(fs.readFileSync(path.join(__dirname, 'club-identity', 'registry.json'), 'utf8'));
  const rgbOf = (h) => 'rgb(' + [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';
  const EXPECT = { tum: rgbOf(REGJ.clubs.find((c) => c.id === 'swe2-tumba').neon), ham: rgbOf(REGJ.clubs.find((c) => c.id === 'se_club_hammarby_if_hf').neon), none: rgbOf(REGJ.clubless) };
  const KEYS = [...new Set(LAB.surfaces.filter((s) => s.protoKey).map((s) => s.protoKey)), 'clubless', 'returning', 'system'];
  const DEVICES = { desktop: [1440, 900], tablet: [1024, 1180], mobile: [390, 844] };
  const accentIssues = []; let accentChecks = 0;
  for (const [dev, [w, h]] of Object.entries(DEVICES)) {
    const pg = await browser.newPage({ viewport: { width: w, height: h }, isMobile: dev === 'mobile', deviceScaleFactor: 1 });
    await pg.goto(BASE + 'frame.html?verify=2#s=dashboard&alt=C&theme=b');
    for (const k of KEYS) {
      const s = LAB.surfaces.find((x) => x.protoKey === k);
      const alt = s ? s.recommendation : 'B';
      for (const club of Object.keys(EXPECT)) {
        const p = new URLSearchParams({ s: k, alt, theme: 'b', club, nav: 'c' });
        if (s && s.arena.status === 'adapt') p.set('adapt', '1');
        if (k === 'system') p.set('shell', '0');
        await pg.evaluate((hh) => { location.hash = hh; }, p.toString());
        await pg.waitForTimeout(20);
        const r = await pg.evaluate(() => {
          const probe = document.createElement('i'); probe.style.color = 'var(--accent)'; document.body.appendChild(probe);
          const accent = getComputedStyle(probe).color; probe.remove();
          const btn = document.querySelector('.btn.primary, .cont-c, .cont-b, .chip.solid, .pin');
          const btnBg = btn ? getComputedStyle(btn).backgroundColor + ' ' + getComputedStyle(btn).backgroundImage : '';
          const overflow = document.documentElement.scrollWidth - window.innerWidth;
          const club = document.documentElement.dataset.club;
          const theme = document.documentElement.dataset.theme;
          return { accent, btnBg, overflow, club, theme, err: /Renderingsfel/.test(document.body.innerText) };
        });
        accentChecks++;
        const want = EXPECT[club];
        if (r.accent !== want) accentIssues.push(`${dev} ${k} ${club}: accent ${r.accent} ≠ ${want}`);
        if (r.btnBg && !r.btnBg.includes(want.slice(4, -1).split(', ').join(', '))) { /* gradients mix the neon; check containment of the neon rgb */ if (!r.btnBg.includes(want)) accentIssues.push(`${dev} ${k} ${club}: primary/highlight not in club neon (${r.btnBg.slice(0, 80)})`); }
        if (r.theme !== 'b') accentIssues.push(`${dev} ${k} ${club}: theme ${r.theme}`);
        if (r.overflow > 2) accentIssues.push(`${dev} ${k} ${club}: horizontal overflow ${r.overflow}px`);
        if (r.err) accentIssues.push(`${dev} ${k} ${club}: render error`);
      }
    }
    await pg.close();
  }
  await browser.close();

  const all = [...dataIssues, ...uiIssues, ...renderIssues, ...accentIssues];
  const md = `# HM Experience 2027 — Amendment Verification (2026-11-13)\n\nGenerated by \`design-lab/experience-2027/verify-amendment.cjs\` on ${new Date().toISOString()}.\n\n| Check | Scope | Result |\n|---|---|---|\n| Recommendations, rationale, priority, dependencies unchanged vs original proposal JSON | ${LAB.surfaces.length} surfaces | ${dataIssues.filter((x) => /recommendation|reason|priority|dependencies/.test(x)).length ? 'FAIL' : 'PASS'} |\n| All A/B/C alternatives present with identical fields (${FIELDS.join(', ')}) | ${altCount} alternatives | ${dataIssues.filter((x) => /alt|alternative/.test(x)).length ? 'FAIL' : 'PASS'} |\n| Works-with relationships resolve to existing surfaces | all alternatives | ${dataIssues.filter((x) => /worksWith/.test(x)).length ? 'FAIL' : 'PASS'} |\n| Every surface has an Arena status; every adaptation has conflict + adaptation + preserved + name | ${LAB.surfaces.length} surfaces (${Object.entries(arenaCount).map(([k, v]) => `${k} ${v}`).join(', ')}) | ${dataIssues.filter((x) => /arena|adaptation/.test(x)).length ? 'FAIL' : 'PASS'} |\n| Lab shows RECOMMENDED label on the recommended alternative, all alternative buttons, the rationale, and the Arena section; preview loads the recommendation in Arena (adapted where applicable) | ${labRes.length} surfaces | ${uiIssues.length ? 'FAIL' : 'PASS'} |\n| Recommended alternative renders in Arena Nights without errors (concept boards show the recommended alternative + adaptation note) | ${LAB.surfaces.length} surfaces | ${renderIssues.length ? 'FAIL' : 'PASS'} |\n| Club accent resolves to the club neon; theme stays Arena; no horizontal overflow | ${accentChecks} renders (${KEYS.length} prototypes × 3 clubs × desktop/tablet/mobile) | ${accentIssues.length ? 'FAIL' : 'PASS'} |\n\n**Total issues: ${all.length}**\n\n${all.length ? '## Issues\n\n' + all.map((x) => '- ' + x).join('\n') + '\n' : ''}`;
  fs.writeFileSync(path.join(DOCS, 'HM-EXPERIENCE-2027-AMENDMENT-VERIFICATION.md'), md);
  console.log(md);
  process.exit(all.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
