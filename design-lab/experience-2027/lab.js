/* HM Experience 2027 — Design Lab application (static, no dependencies). */
(function () {
  const D = window.LAB_DATA;
  const SURF = D.surfaces;
  const byId = new Map(SURF.map((s) => [s.id, s]));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IDN = { a: 'A · Tactical Clarity', b: 'B · Arena Nights', c: 'C · Paper & Floodlight' };
  const DEV = { desktop: [1440, 900], tablet: [1024, 1180], mobile: [390, 844] };
  const KEY = 'hm-exp27-lab-v1';
  const VIEWS = [['overview', 'Start'], ['surfaces', 'Surfaces'], ['compare', 'Compare'], ['identities', 'Identities'], ['journeys', 'Journeys & flows'], ['system', 'Design system'], ['decisions', 'Decisions']];

  /* ---------------- state (localStorage is a per-viewer convenience; export is the durable record) ---------------- */
  const def = { view: 'overview', identity: 'c', device: 'desktop', density: '', surface: 'DSH-01', alt: null, filter: 'all', q: '', notes: {}, global: {}, globalNotes: {}, journey: 'c', step: 0, flow: 0, flowStep: 0, cmpMode: 'alts' };
  let st = Object.assign({}, def);
  try { const raw = localStorage.getItem(KEY); if (raw) st = Object.assign({}, def, JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const set = (patch, rerender = true) => { Object.assign(st, patch); save(); if (rerender) render(); };
  const note = (id) => (st.notes[id] = st.notes[id] || { choice: '', works: '', not: '', changes: '', ideas: '', status: '' });
  const toast = (m) => { const t = document.getElementById('lab-toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1600); };

  /* ---------------- helpers ---------------- */
  const altsOf = (s) => s.alternatives || [];
  const altOf = (s, k) => altsOf(s).find((a) => a.key === k) || altsOf(s)[0];
  function frameUrl(surfaceOrKey, alt, theme, opts = {}) {
    const s = typeof surfaceOrKey === 'string' && byId.get(surfaceOrKey);
    const p = new URLSearchParams();
    if (s && s.protoKey) p.set('s', s.protoKey);
    else if (s) { p.set('s', '__wire'); p.set('surface', s.id); }
    else p.set('s', surfaceOrKey);
    p.set('alt', alt); p.set('theme', theme || st.identity);
    if (st.density) p.set('density', st.density);
    if (opts.shell === false) p.set('shell', '0');
    return 'frame.html#' + p.toString();
  }
  function preview(url, device, maxW, label) {
    const [w, h] = DEV[device || st.device];
    const scale = Math.min(1, (maxW || 900) / w);
    return `<div class="pv" style="width:${w * scale}px;height:${h * scale}px">${label ? `<span class="pv-cap">${esc(label)}</span>` : ''}<div class="pv-in ${device || st.device}" style="width:${w}px;height:${h}px;transform:scale(${scale})"><iframe src="${url}" width="${w}" height="${h}" title="${esc(label || 'Prototype preview')}" loading="lazy"></iframe></div></div>`;
  }
  const surfStageWidth = () => { const w = window.innerWidth; return (w > 1280 ? w - 290 - 360 : w > 800 ? w - 250 : w) - 36; };
  // Direction C is the hybrid: it deliberately adopts A-style "workbench" layouts for deep tasks.
  const fits = (alt, ident) => !alt || !alt.directions || !alt.directions.length || alt.directions.includes(ident) || (ident === 'c' && alt.directions.includes('a'));
  const fitNote = (alt, ident) => (ident === 'c' && alt && alt.directions && !alt.directions.includes('c') && alt.directions.includes('a') ? ' — as an A-style workbench inside the hybrid' : '');
  const decided = (s) => !!(st.notes[s.id] && st.notes[s.id].choice);

  /* ---------------- top bar ---------------- */
  function renderTop() {
    document.getElementById('views').innerHTML = VIEWS.map(([k, l]) => `<button class="${st.view === k ? 'on' : ''}" data-view="${k}">${l}</button>`).join('');
    document.getElementById('identity').value = st.identity;
    document.querySelectorAll('#device button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.device));
    document.querySelectorAll('#density button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.density));
  }

  /* ---------------- OVERVIEW ---------------- */
  function vOverview() {
    const pages = SURF.filter((s) => s.kind === 'page').length;
    const hifi = SURF.filter((s) => s.protoKey).length;
    const dec = SURF.filter(decided).length;
    const gdec = D.global.filter((g) => st.global[g.id]).length;
    const nAlts = SURF.reduce((n, s) => n + altsOf(s).length, 0);
    return `<div class="page-l"><h1>Handball Manager — Experience 2027 Design Lab</h1><p class="lede-l">An isolated, interactive lab for choosing the future presentation of Handball Manager. Nothing here touches the production game. Every surface of the current app (${SURF.length} inventoried, ${pages} pages) has 2–3 alternative concepts; the ${hifi} most important surfaces have interactive high-fidelity prototypes with realistic sample data, the rest render as concept boards. All prototypes can be shown in any of the three design identities, at desktop, tablet or mobile size.</p>
      <div class="cards" style="margin-top:18px">
        <div class="card-l"><h3>Surfaces inventoried</h3><div class="stat-l">${SURF.length}</div><div class="hint">${pages} pages · ${SURF.length - pages} tabs, panels, states, modals & nav</div></div>
        <div class="card-l"><h3>Alternatives</h3><div class="stat-l">${nAlts}</div><div class="hint">${hifi} surfaces with hi-fi A/B/C prototypes (${hifi * 3} screens)</div></div>
        <div class="card-l"><h3>Your surface decisions</h3><div class="stat-l">${dec} / ${SURF.length}</div><div class="progress"><i style="width:${(dec / SURF.length) * 100}%"></i></div></div>
        <div class="card-l"><h3>Global decisions</h3><div class="stat-l">${gdec} / ${D.global.length}</div><div class="hint">Decide these first — they constrain every surface.</div></div>
      </div>
      <h2>How to review</h2>
      <div class="cards">
        <div class="card-l"><h3>1 · Pick a temperament</h3><p class="hint">Open <b>Identities</b>: the same screens in A, B and C side by side. Switch identity any time with the selector top-right.</p><button class="btn-l pri" data-go="identities">Compare identities</button></div>
        <div class="card-l"><h3>2 · Walk the journeys</h3><p class="hint"><b>Journeys & flows</b> shows the nine-step player journey as three complete concepts, plus five cross-surface flows (recruitment, training→match, news→consequence…).</p><button class="btn-l pri" data-go="journeys">Walk a journey</button></div>
        <div class="card-l"><h3>3 · Decide surface by surface</h3><p class="hint"><b>Surfaces</b>: browse all ${SURF.length} surfaces, flip between A/B/C, read the rationale and record your choice and notes. <b>Compare</b> shows A/B/C side by side.</p><button class="btn-l pri" data-go="surfaces">Browse surfaces</button></div>
        <div class="card-l"><h3>4 · Export decisions</h3><p class="hint"><b>Decisions</b> lists everything with recommendations. Export Markdown for <code>HM-EXPERIENCE-2027-OWNER-DECISIONS.md</code> or JSON to share/restore. Notes are saved in this browser only until exported.</p><button class="btn-l pri" data-go="decisions">Open decisions</button></div>
      </div>
      <h2>Decide first</h2><table class="tbl-l"><thead><tr><th>ID</th><th>Global decision</th><th>Recommendation</th><th>Your choice</th></tr></thead><tbody>${D.global.map((g) => `<tr><td><b>${g.id}</b></td><td>${esc(g.title)}</td><td><span class="pill">${g.rec}</span> <span class="hint">${esc(g.why)}</span></td><td>${st.global[g.id] ? `<b>${esc(st.global[g.id])}</b>` : '<span class="hint">—</span>'}</td></tr>`).join('')}</tbody></table>
      <h2>Hi-fi prototypes</h2><div class="cards">${SURF.filter((s) => s.protoKey && !(s.id === 'ENT-04')).map((s) => `<button class="card-l" style="text-align:left" data-open="${s.id}"><span class="tag hifi">HI-FI</span> <b>${esc(s.id)}</b><h3 style="margin-top:6px">${esc(s.name)}</h3><div class="hint">${altsOf(s).map((a) => `${a.key}: ${esc(a.name)}`).join(' · ')}</div></button>`).join('')}</div>
    </div>`;
  }

  /* ---------------- SURFACES ---------------- */
  function listItems() {
    const q = st.q.trim().toLowerCase();
    return SURF.filter((s) => {
      if (q && !(s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || String(s.route).toLowerCase().includes(q))) return false;
      if (st.filter === 'hifi') return !!s.protoKey;
      if (st.filter === 'p0') return s.priority === 'P0';
      if (st.filter === 'pages') return s.kind === 'page';
      if (st.filter === 'open') return !decided(s);
      if (st.filter === 'done') return decided(s);
      return true;
    });
  }
  function vSurfaces() {
    const s = byId.get(st.surface) || SURF[0];
    const altKey = st.alt && altOf(s, st.alt) ? st.alt : (s.recommendation || 'A');
    const a = altOf(s, altKey);
    const n = note(s.id);
    const items = listItems();
    const groups = {};
    items.forEach((x) => (groups[x.id.slice(0, 3)] = groups[x.id.slice(0, 3)] || []).push(x));
    const list = Object.entries(groups).map(([d, l]) => `<div class="sv-dom"><span>${d} · ${esc(D.domains[d] || '')}</span><span>${l.filter(decided).length}/${l.length}</span></div>${l.map((x) => `<button class="sv-it ${x.parent ? 'sub' : ''} ${x.id === s.id ? 'on' : ''}" data-surface="${x.id}"><span class="id">${x.id}</span><span class="nm" title="${esc(x.name)}">${esc(x.name)}</span><span>${x.protoKey ? '<span class="tag hifi">HI-FI</span>' : ''}${x.priority === 'P0' ? ' <span class="tag p0">P0</span>' : ''}${decided(x) ? ` <span class="tag dec">${esc(st.notes[x.id].choice)}</span>` : ''}</span></button>`).join('')}`).join('');
    const ident = st.identity;
    const fit = fits(a, ident);
    return `<div class="sv">
      <aside class="sv-list"><div class="sv-filters"><input id="q" placeholder="Search ID, name or route…" value="${esc(st.q)}" aria-label="Search surfaces"><div class="chips">${[['all', 'All'], ['pages', 'Pages'], ['hifi', 'Hi-fi'], ['p0', 'P0'], ['open', 'Undecided'], ['done', 'Decided']].map(([k, l]) => `<button class="${st.filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div><div class="hint">${items.length} of ${SURF.length} surfaces</div></div><div class="sv-items">${list || '<div class="hint" style="padding:12px">No surfaces match.</div>'}</div></aside>
      <section class="sv-mid"><div class="sv-head"><div class="meta"><b>${s.id}</b><span>${esc(s.domainName)}</span><span>${s.kind}</span><span>${s.importance}</span>${s.priority ? `<span class="tag p0" style="${s.priority === 'P0' ? '' : 'background:var(--l-bg);color:var(--l-muted)'}">${s.priority}</span>` : ''}${s.parent ? `<span>parent <a href="#" data-surface="${s.parent}">${s.parent}</a></span>` : ''}</div><h1>${esc(s.name)}</h1><div class="meta"><code>${esc(s.route)}</code>${s.protoKey ? '<span class="tag hifi">HI-FI prototype</span>' : '<span class="pill">Concept board</span>'}<span>Shown in ${IDN[ident]}</span></div>
        <div class="alts">${altsOf(s).map((x) => `<button class="alt-btn ${x.key === altKey ? 'on' : ''}" data-alt="${x.key}">${s.recommendation === x.key ? '<span class="rec">RECOMMENDED</span>' : ''}${n.choice === x.key ? '<span class="mine">YOUR CHOICE</span>' : ''}<b>${x.key} · ${esc(x.name)}</b><small>${esc((x.directions || []).map((d) => d.toUpperCase()).join(' / ') || '—')} · ${x.complexity || '?'} effort · ${x.perf || '?'} perf</small></button>`).join('')}<button class="btn-l" data-go="compare" style="align-self:center">Side by side →</button></div></div>
        <div class="stage" id="stage">${preview(frameUrl(s.id, altKey, ident), st.device, Math.max(300, surfStageWidth()), '')}</div></section>
      <aside class="sv-side">
        ${fit ? `<div class="okbox">Fits identity ${ident.toUpperCase()}${fitNote(a, ident)}</div>` : `<div class="warnbox">Designed for ${(a.directions || []).map((d) => d.toUpperCase()).join('/')} — in ${ident.toUpperCase()} it may feel inconsistent.</div>`}
        <h3>Alternative ${a.key} — ${esc(a.name)}</h3><dl class="kv">${[['Concept', a.concept], ['Layout', a.layout], ['Hierarchy', a.hierarchy], ['Interactions', a.interactions], ['Navigation', a.navigation], ['Desktop', a.desktop], ['Mobile', a.mobile], ['Complexity', `${a.complexity || '—'} · perf impact ${a.perf || '—'}`], ['Works with', (a.worksWith || []).map((w) => byId.has(w) ? `<a href="#" data-surface="${w}">${w}</a>` : esc(w)).join(', ')], ['Patterns', (a.patterns || []).join('; ')]].map(([k, v]) => v ? `<dt>${k}</dt><dd>${k === 'Works with' ? v : esc(v)}</dd>` : '').join('')}</dl>
        <div class="pc" style="margin-top:8px"><div><b style="color:var(--l-ok)">Advantages</b><ul>${(a.pros || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div><div><b style="color:var(--l-bad)">Disadvantages</b><ul>${(a.cons || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></div>
        <h3>Recommendation</h3><p style="margin:0"><b>${s.recommendation || '—'}</b> — ${esc(s.reason)}</p><p class="hint">Dependencies: ${esc((s.dependencies || []).join(', ') || '—')}</p>
        <h3>Current implementation</h3><p class="hint" style="margin:0">${esc(s.current)}</p>${(s.weaknesses || []).length ? `<ul class="hint" style="padding-left:16px">${s.weaknesses.slice(0, 4).map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        <h3>Your decision <span class="saved" id="saved"></span></h3>
        <div class="form" data-note="${s.id}"><div class="radios">${altsOf(s).map((x) => `<label><input type="radio" name="choice" value="${x.key}" ${n.choice === x.key ? 'checked' : ''}><span>${x.key}</span></label>`).join('')}<label><input type="radio" name="choice" value="Keep current" ${n.choice === 'Keep current' ? 'checked' : ''}><span>Keep current</span></label><label><input type="radio" name="choice" value="" ${!n.choice ? 'checked' : ''}><span>Undecided</span></label></div>
          ${[['works', 'What works'], ['not', 'What does not work'], ['changes', 'Required changes'], ['ideas', 'Additional ideas']].map(([k, l]) => `<label for="n-${k}">${l}</label><textarea id="n-${k}" data-k="${k}">${esc(n[k])}</textarea>`).join('')}
        </div></aside></div>`;
  }

  /* ---------------- COMPARE ---------------- */
  function vCompare() {
    const s = byId.get(st.surface) || SURF[0];
    const w = Math.max(300, (document.getElementById('app').clientWidth - 90) / 3);
    const cols = st.cmpMode === 'idents'
      ? ['a', 'b', 'c'].map((t) => ({ url: frameUrl(s.id, st.alt || s.recommendation || 'A', t), title: `Identity ${IDN[t]}`, alt: altOf(s, st.alt || s.recommendation || 'A'), t }))
      : altsOf(s).map((a) => ({ url: frameUrl(s.id, a.key, st.identity), title: `${a.key} · ${a.name}`, alt: a, t: st.identity }));
    return `<div class="page-l"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end"><div><div class="hint">${s.id} · ${esc(s.domainName)}</div><h1>${esc(s.name)}</h1></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="lab-field"><span>Surface</span><select id="cmp-surface">${SURF.filter((x) => x.kind === 'page' || x.protoKey).map((x) => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${x.id} · ${esc(x.name)}</option>`).join('')}</select></label><div class="lab-seg" id="cmp-mode"><button data-v="alts" class="${st.cmpMode !== 'idents' ? 'on' : ''}">A / B / C alternatives</button><button data-v="idents" class="${st.cmpMode === 'idents' ? 'on' : ''}">One alternative × 3 identities</button></div></div></div>
      <div class="grid3" style="margin-top:28px">${cols.map((c) => `<div class="cmp-col"><h3>${esc(c.title)} ${s.recommendation === c.alt?.key && st.cmpMode !== 'idents' ? '<span class="tag dec">REC</span>' : ''}</h3>${preview(c.url, st.device, w, '')}<p class="hint">${esc(c.alt?.concept || '')}</p>${st.cmpMode !== 'idents' ? `<button class="btn-l ${note(s.id).choice === c.alt.key ? 'pri' : ''}" data-choose="${c.alt.key}">${note(s.id).choice === c.alt.key ? '✓ Chosen' : 'Choose ' + c.alt.key}</button>` : ''}</div>`).join('')}</div></div>`;
  }

  /* ---------------- IDENTITIES ---------------- */
  const IDENT = [
    { k: 'a', name: 'Tactical Clarity', sub: 'Modern Manager', bg: 'linear-gradient(135deg,#2257f5,#0e1726)', sw: ['#f5f6f8', '#ffffff', '#0e1726', '#2257f5', '#12a150', '#e5484d'], type: 'Inter · JetBrains Mono', nav: '6-hub rail + Ctrl-K palette + hover cards', motion: 'Functional, 120–180 ms', img: 'Minimal — crests, monograms, data as image' },
    { k: 'b', name: 'Arena Nights', sub: 'Premium Sports World', bg: 'linear-gradient(135deg,#ff4d2e,#070b12 70%)', sw: ['#070b12', '#111a2b', '#f4f6fa', '#ff4d2e', '#ffc531', '#2bd98a'], type: 'Barlow Condensed · Barlow', nav: 'Top hub bar + full-bleed hub pages', motion: 'Expressive, camera-like 300–450 ms', img: 'Maximal — portraits & environments' },
    { k: 'c', name: 'Paper & Floodlight', sub: 'Hybrid (recommended)', bg: 'linear-gradient(135deg,#c84320,#0f1b2d 70%)', sw: ['#f3f1ea', '#fbfaf6', '#131b26', '#c84320', '#c99218', '#0b1220'], type: 'Saira Condensed · IBM Plex · Source Serif 4', nav: 'Week Spine + hub rail + Peek drawer', motion: 'Calm on paper, expressive in floodlight', img: 'Curated — hubs, stories, moments' },
  ];
  function vIdentities() {
    const w = Math.max(300, (document.getElementById('app').clientWidth - 90) / 3);
    const scr = st.identScreen || 'dashboard';
    return `<div class="page-l"><h1>Three design identities</h1><p class="lede-l">Each identity is a token set + navigation shell + imagery & motion policy. The same prototype renders in all three — the differences are temperament, not data. Full rationale: <code>HM-EXPERIENCE-2027-DESIGN-DIRECTIONS.md</code>.</p>
      <div class="grid3" style="margin-top:16px">${IDENT.map((i) => `<div class="ident-card"><div class="hd" style="background:${i.bg}"><span class="hint" style="color:#fff;opacity:.8">Direction ${i.k.toUpperCase()} · ${i.sub}</span><b>${i.name}</b></div><div class="bd"><div class="sw-l">${i.sw.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div><dl class="kv"><dt>Type</dt><dd>${i.type}</dd><dt>Navigation</dt><dd>${i.nav}</dd><dt>Motion</dt><dd>${i.motion}</dd><dt>Imagery</dt><dd>${i.img}</dd></dl><div style="margin-top:10px;display:flex;gap:6px"><button class="btn-l ${st.identity === i.k ? 'pri' : ''}" data-ident="${i.k}">${st.identity === i.k ? '✓ Active in lab' : 'Use in lab'}</button><button class="btn-l" data-gchoose="G1:${i.k.toUpperCase()}">${st.global.G1 === i.k.toUpperCase() ? '✓ My G1 choice' : 'Choose as G1'}</button></div></div></div>`).join('')}</div>
      <h2>Same screen, three identities</h2><div class="chips" style="margin-bottom:10px">${['entry', 'dashboard', 'player', 'squad', 'matchday', 'analysis', 'inbox', 'system'].map((k) => `<button class="${scr === k ? 'on' : ''}" data-iscreen="${k}">${k}</button>`).join('')}</div>
      <p class="hint">Each column shows that identity's own native alternative (A in A, B in B, C in C) — i.e. what the product would feel like if fully committed to that direction.</p>
      <div class="grid3" style="margin-top:22px">${['a', 'b', 'c'].map((t) => `<div>${preview(frameUrl(scr, t.toUpperCase(), t), st.device, w, IDN[t])}</div>`).join('')}</div></div>`;
  }

  /* ---------------- JOURNEYS & FLOWS ---------------- */
  const JOURNEY = [['Opening the game', 'entry', 'Career selection & re-entry'], ['Entering the club', 'club', 'Club home'], ['Viewing the dashboard', 'dashboard', 'Today'], ['Opening a player', 'player', 'Player profile'], ['Managing staff or training', 'training', 'Weekly training'], ['Reviewing recruitment', 'scouting', 'Scouting'], ['Approaching matchday', 'matchday', 'Live match'], ['Viewing a match result', 'analysis', 'Match report'], ['Returning to the club', 'returning', 'The day after']];
  const PROTO_SURF = { entry: 'ENT-02', club: 'CLB-02', dashboard: 'DSH-01', player: 'SQD-02', training: 'TRN-01', scouting: 'REC-01', matchday: 'MDY-02', analysis: 'ANL-01', returning: null };
  const FLOWS = [
    ['Recruitment chain', 'Player profile → Scouting → Shortlist → Negotiation → Contract → Squad', ['SQD-02', 'REC-01', 'REC-03', 'REC-04', 'SQD-01']],
    ['Development loop', 'Training plan → Workload → Development → Performance → Match', ['TRN-01', 'MED-01', 'SQD-02', 'ANL-01', 'MDY-02']],
    ['Match cycle', 'Matchday → Report → Analysis → Training priorities → Next match', ['MDY-02', 'ANL-01', 'CMP-01', 'TRN-01', 'DSH-01']],
    ['Career turn', 'Resignation → New club → New staff → Responsibilities → New season', ['MGR-01', 'CLB-02', 'STF-01', 'MGR-03', 'DSH-01']],
    ['Story chain', 'News → Event → Decision → Consequence → Career history', ['WLD-02', 'WLD-01', 'CLB-05', 'MGR-01', 'MGR-02']],
  ].map(([t, d, ids]) => [t, d, ids.filter((i) => byId.has(i))]);
  function journeyCols(j) {
    if (j === 'mine') {
      const ident = (st.global.G1 || st.identity.toUpperCase()).toLowerCase();
      return JOURNEY.map(([t, k]) => { const sid = PROTO_SURF[k]; const ch = sid && st.notes[sid] && /^[ABC]$/.test(st.notes[sid].choice) ? st.notes[sid].choice : (sid ? byId.get(sid).recommendation : ident.toUpperCase()) || 'C'; return { t, url: frameUrl(k, ch, ident), alt: ch, sid, ident }; });
    }
    return JOURNEY.map(([t, k]) => ({ t, url: frameUrl(k, j.toUpperCase(), j), alt: j.toUpperCase(), sid: PROTO_SURF[k], ident: j }));
  }
  function vJourneys() {
    const steps = journeyCols(st.journey);
    const i = Math.min(st.step, steps.length - 1);
    const cur = steps[i];
    const mw = Math.max(320, document.getElementById('app').clientWidth - 360);
    let warn = '';
    if (st.journey === 'mine') {
      const bad = steps.filter((x) => x.sid && !fits(altOf(byId.get(x.sid), x.alt), x.ident));
      warn = bad.length ? `<div class="warnbox">Consistency: ${bad.length} chosen alternative(s) were designed for other identities — ${bad.map((x) => esc(x.t)).join(', ')}.</div>` : '<div class="okbox">Consistency: all chosen alternatives fit the chosen identity.</div>';
    }
    const fl = FLOWS[st.flow] || FLOWS[0];
    const fsid = fl[2][Math.min(st.flowStep, fl[2].length - 1)];
    const fs = byId.get(fsid);
    const fch = (st.notes[fsid] && /^[ABC]$/.test(st.notes[fsid].choice) && st.notes[fsid].choice) || fs.recommendation || 'A';
    return `<div class="page-l"><h1>Journeys & flows</h1><p class="lede-l">Three complete experience concepts walk the same nine steps — from opening the game to returning to the club after a match. "My selection" assembles your chosen alternatives in your chosen identity and checks they hang together.</p>
      <div class="chips" style="margin:14px 0">${[['a', 'Concept A · Tactical Clarity'], ['b', 'Concept B · Arena Nights'], ['c', 'Concept C · Paper & Floodlight'], ['mine', 'My selection']].map(([k, l]) => `<button class="${st.journey === k ? 'on' : ''}" data-journey="${k}">${l}</button>`).join('')}</div>${warn}
      <div class="jr"><div class="jr-steps">${steps.map((x, n) => `<button class="${n === i ? 'on' : ''}" data-step="${n}"><span class="n">${n + 1}</span><span><b>${esc(x.t)}</b><small>${x.sid || 'journey screen'} · alt ${x.alt} · identity ${x.ident.toUpperCase()}</small></span></button>`).join('')}<div style="display:flex;gap:6px;margin-top:6px"><button class="btn-l" data-step="${Math.max(0, i - 1)}">← Prev</button><button class="btn-l pri" data-step="${Math.min(steps.length - 1, i + 1)}">Next →</button></div><p class="hint">Keys: ← → step through</p></div>
      <div>${preview(cur.url, st.device, mw, `${i + 1} · ${cur.t}`)}</div></div>
      <h2>Cross-surface flows</h2><p class="lede-l" style="font-size:13px">The connections between surfaces matter as much as the surfaces. Each flow is shown with your chosen (or recommended) alternative per step; the prototypes link entities through the Peek drawer and Ctrl-K palette so the world stays connected.</p>
      <div class="chips" style="margin:10px 0">${FLOWS.map((f, n) => `<button class="${st.flow === n ? 'on' : ''}" data-flow="${n}">${esc(f[0])}</button>`).join('')}</div><div class="hint">${esc(fl[1])}</div>
      <div class="flow">${fl[2].map((id, n) => `${n ? '<span class="arr">→</span>' : ''}<button class="${n === st.flowStep ? 'on' : ''}" data-fstep="${n}"><small>${id}</small>${esc(byId.get(id).name)}</button>`).join('')}</div>
      ${preview(frameUrl(fsid, fch, st.identity), st.device, mw + 260, `${fsid} · alt ${fch}${fs.protoKey ? '' : ' (concept board)'}`)}</div>`;
  }

  /* ---------------- SYSTEM ---------------- */
  function vSystem() {
    const mw = Math.max(320, document.getElementById('app').clientWidth - 70);
    return `<div class="page-l"><h1>Design system</h1><p class="lede-l">One component library, three token sets. Switch identity (top-right) to re-theme the gallery. Tokens: <code>proto/themes.css</code> · components: <code>proto/kit.css</code> · proposal: <code>HM-EXPERIENCE-2027-VISION.md §6</code>.</p><div style="margin-top:18px">${preview(frameUrl('system', 'A', st.identity, { shell: false }), st.device, mw, `Component gallery · ${IDN[st.identity]}`)}</div></div>`;
  }

  /* ---------------- DECISIONS ---------------- */
  function vDecisions() {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const rows = [...SURF].sort((a, b) => (order[a.priority] ?? 4) - (order[b.priority] ?? 4) || a.id.localeCompare(b.id));
    const g1 = (st.global.G1 || '').toLowerCase();
    const chosen = SURF.filter((s) => /^[ABC]$/.test(st.notes[s.id]?.choice || ''));
    const misfit = g1 ? chosen.filter((s) => !fits(altOf(s, st.notes[s.id].choice), g1)) : [];
    return `<div class="page-l"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end"><div><h1>Decisions</h1><p class="lede-l" style="margin:0">Record the global decisions first, then each surface. Saved in this browser; export to keep a durable record.</p></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-l pri" data-export="md">Export Markdown</button><button class="btn-l" data-export="json">Export JSON</button><label class="btn-l" style="cursor:pointer">Import JSON<input type="file" id="imp" accept="application/json" hidden></label><button class="btn-l" data-reset="1">Reset…</button></div></div>
      <h2>Global decisions — decide first</h2><table class="tbl-l"><thead><tr><th>ID</th><th>Decision</th><th>Options</th><th>Rec.</th><th>Your choice</th><th>Comment</th></tr></thead><tbody>${D.global.map((g) => `<tr><td><b>${g.id}</b></td><td>${esc(g.title)}<div class="hint">${esc(g.why)}</div></td><td class="hint">${g.options.map(esc).join('<br>')}</td><td><span class="pill">${g.rec}</span></td><td><select data-global="${g.id}"><option value="">—</option>${g.options.map((o) => { const k = o.split(' ')[0]; return `<option value="${k}" ${st.global[g.id] === k ? 'selected' : ''}>${esc(o)}</option>`; }).join('')}</select></td><td><textarea data-gnote="${g.id}" style="width:100%;min-height:34px;border-radius:6px;border:1px solid var(--l-line);background:var(--l-bg)">${esc(st.globalNotes[g.id] || '')}</textarea></td></tr>`).join('')}</tbody></table>
      <h2>Cross-surface consistency</h2>${g1 ? (misfit.length ? `<div class="warnbox">${misfit.length} of ${chosen.length} chosen alternatives were designed for identities other than ${g1.toUpperCase()}: ${misfit.map((s) => s.id).join(', ')}</div>` : `<div class="okbox">${chosen.length} chosen alternatives — all fit identity ${g1.toUpperCase()}.</div>`) : '<p class="hint">Choose G1 (identity) to check consistency of your surface choices.</p>'}
      <h2>Surfaces (${SURF.filter(decided).length}/${SURF.length} decided)</h2><table class="tbl-l"><thead><tr><th>ID</th><th>Surface</th><th>Pri</th><th>A</th><th>B</th><th>C</th><th>Rec.</th><th>Your choice</th><th>Notes</th></tr></thead><tbody>${rows.map((s) => { const n = st.notes[s.id] || {}; const nm = (k) => esc((altOf(s, k) && altOf(s, k).key === k ? altOf(s, k).name : '—')); return `<tr><td><a href="#" data-surface="${s.id}"><b>${s.id}</b></a> ${s.protoKey ? '<span class="tag hifi">HI-FI</span>' : ''}</td><td>${esc(s.name)}</td><td>${s.priority || ''}</td><td>${nm('A')}</td><td>${nm('B')}</td><td>${nm('C')}</td><td><span class="pill">${s.recommendation || '—'}</span></td><td><select data-choice="${s.id}"><option value="">—</option>${altsOf(s).map((a) => `<option ${n.choice === a.key ? 'selected' : ''}>${a.key}</option>`).join('')}<option ${n.choice === 'Keep current' ? 'selected' : ''}>Keep current</option></select></td><td class="hint">${esc([n.works, n.not, n.changes, n.ideas].filter(Boolean).join(' · ').slice(0, 120))}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function exportMd() {
    let md = `# HM Experience 2027 — Owner decisions (exported from Design Lab)\n\nExported: ${new Date().toISOString()}\n\n## Global decisions\n\n| ID | Decision | Recommendation | Choice | Comment |\n|---|---|---|---|---|\n`;
    D.global.forEach((g) => (md += `| ${g.id} | ${g.title} | ${g.rec} | ${st.global[g.id] || ''} | ${(st.globalNotes[g.id] || '').replace(/\n/g, ' ')} |\n`));
    md += `\n## Surface decisions\n\n| ID | Surface | Recommendation | Choice | What works | What does not | Required changes | Ideas |\n|---|---|---|---|---|---|---|---|\n`;
    SURF.forEach((s) => { const n = st.notes[s.id] || {}; const c = (t) => String(t || '').replace(/\|/g, '/').replace(/\n/g, ' '); md += `| ${s.id} | ${c(s.name)} | ${s.recommendation || ''} | ${c(n.choice)} | ${c(n.works)} | ${c(n.not)} | ${c(n.changes)} | ${c(n.ideas)} |\n`; });
    return md;
  }
  function download(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ---------------- render & events ---------------- */
  function render() {
    renderTop();
    const v = { overview: vOverview, surfaces: vSurfaces, compare: vCompare, identities: vIdentities, journeys: vJourneys, system: vSystem, decisions: vDecisions }[st.view] || vOverview;
    document.getElementById('app').innerHTML = v();
    if (st.view === 'surfaces') {
      const box = document.querySelector('.sv-items'), it = document.querySelector('.sv-it.on');
      if (box && it) { const top = it.offsetTop; if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 40) box.scrollTop = top - box.clientHeight / 3; }
      window.scrollTo(0, 0);
    }
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [data-surface]'); if (!t) return;
    const d = t.dataset;
    if (d.view) return set({ view: d.view });
    if (d.go) return set({ view: d.go });
    if (d.open) return set({ view: 'surfaces', surface: d.open, alt: null });
    if (d.surface) { e.preventDefault(); return set({ surface: d.surface, alt: null, view: st.view === 'decisions' || st.view === 'overview' ? 'surfaces' : st.view }); }
    if (d.alt) return set({ alt: d.alt });
    if (d.filter) return set({ filter: d.filter });
    if (d.ident) return set({ identity: d.ident });
    if (d.iscreen) return set({ identScreen: d.iscreen });
    if (d.journey) return set({ journey: d.journey, step: 0 });
    if (d.step !== undefined) return set({ step: Number(d.step) });
    if (d.flow !== undefined) return set({ flow: Number(d.flow), flowStep: 0 });
    if (d.fstep !== undefined) return set({ flowStep: Number(d.fstep) });
    if (d.choose) { note(st.surface).choice = d.choose; save(); toast(`${st.surface}: chose ${d.choose}`); return render(); }
    if (d.gchoose) { const [g, v] = d.gchoose.split(':'); st.global[g] = v; save(); toast(`${g} = ${v}`); return render(); }
    if (d.export === 'md') return download('HM-EXPERIENCE-2027-OWNER-DECISIONS-export.md', exportMd(), 'text/markdown');
    if (d.export === 'json') return download('hm-exp27-decisions.json', JSON.stringify({ version: 1, global: st.global, globalNotes: st.globalNotes, notes: st.notes }, null, 2), 'application/json');
    if (d.reset) { if (confirm('Clear all decisions and notes stored in this browser? Export first if you want to keep them.')) { st = Object.assign({}, def); save(); render(); toast('Lab reset'); } return; }
    if (t.closest('#device') && d.v) return set({ device: d.v });
    if (t.closest('#density') && d.v !== undefined) return set({ density: d.v });
    if (t.closest('#cmp-mode') && d.v) return set({ cmpMode: d.v });
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'identity') return set({ identity: t.value });
    if (t.id === 'cmp-surface') return set({ surface: t.value, alt: null });
    if (t.name === 'choice') { const id = t.closest('[data-note]').dataset.note; note(id).choice = t.value; save(); toast(t.value ? `${id}: ${t.value}` : `${id}: undecided`); return render(); }
    if (t.dataset.global) { st.global[t.dataset.global] = t.value; save(); return render(); }
    if (t.dataset.choice) { note(t.dataset.choice).choice = t.value; save(); toast(`${t.dataset.choice}: ${t.value || 'undecided'}`); return; }
    if (t.id === 'imp' && t.files[0]) { const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); st.global = j.global || {}; st.globalNotes = j.globalNotes || {}; st.notes = j.notes || {}; save(); render(); toast('Decisions imported'); } catch (err) { toast('Could not read that file'); } }; r.readAsText(t.files[0]); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'q') { st.q = t.value; save(); const pos = t.selectionStart; render(); const q = document.getElementById('q'); q.focus(); q.setSelectionRange(pos, pos); return; }
    if (t.dataset.k) { const id = t.closest('[data-note]').dataset.note; note(id)[t.dataset.k] = t.value; save(); const s = document.getElementById('saved'); if (s) s.textContent = 'saved'; }
    if (t.dataset.gnote) { st.globalNotes[t.dataset.gnote] = t.value; save(); }
  });
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (st.view === 'journeys' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { set({ step: Math.max(0, Math.min(8, st.step + (e.key === 'ArrowRight' ? 1 : -1))) }); }
    if (st.view === 'surfaces' && ['1', '2', '3'].includes(e.key)) { const s = byId.get(st.surface); const a = altsOf(s)[Number(e.key) - 1]; if (a) set({ alt: a.key }); }
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 200); });
  render();
})();
