/* Concept-board renderer: turns proposal `wire` specs into lo-fi layouts in the active identity. */
(function () {
  const K = window.K;
  const HUB = { ENT: 'today', DSH: 'today', WLD: 'today', CLB: 'club', STF: 'club', SQD: 'team', TRN: 'team', MED: 'team', REC: 'recruit', CMP: 'comp', MDY: 'comp', ANL: 'comp', MGR: 'career', SYS: 'career' };
  const data = () => (window.LAB_DATA && window.LAB_DATA.surfaces) || [];
  const find = (id) => data().find((s) => s.id === id);
  const parse = (b) => { const [label, a, c] = String(b).split('|'); const span = Number(a); return Number.isFinite(span) && span > 0 ? { label, span: Math.min(12, span), kind: c || 'panel' } : { label, span: 12, kind: a || 'panel' }; };
  const block = (b, mobile) => `<div class="wire k-${b.kind}" style="grid-column:span ${mobile ? 12 : b.span}"><span class="wf-kind">${K.esc(b.kind)}</span><b>${K.esc(b.label)}</b></div>`;
  function render(id, alt, opts = {}) {
    const s = find(id);
    if (!s) return `<div class="note-box">Okänd yta ${K.esc(id)}</div>`;
    const a = (s.alternatives || []).find((x) => x.key === alt) || (s.alternatives || [])[0];
    if (!a) return `<div class="note-box">Inga alternativ för ${K.esc(id)} ännu.</div>`;
    const d = (a.wire && a.wire.d) || [];
    const m = (a.wire && a.wire.m) || d.flat();
    return `<div class="wf"><div class="wf-head"><div><div class="kicker acc">${K.esc(s.id)} · Konceptskiss ${a.key}</div><h1 class="h2" style="margin-top:4px">${K.esc(a.name)}</h1><div class="muted small" style="max-width:760px;margin-top:6px">${K.esc(a.concept || '')}</div></div><span class="chip">${K.esc(s.name)}</span></div>
      <div class="hide-m wf">${d.map((row) => `<div class="wf-row">${row.map((b) => block(parse(b))).join('')}</div>`).join('')}</div>
      <div class="only-m wf"><div class="wf-row">${m.map((b) => block(parse(b), true)).join('')}</div></div>
      <div class="note-box mt"><b>Interaktion:</b> ${K.esc(a.interactions || '')}</div>
      ${opts.adapt && s.arena && a.key === s.recommendation && s.arena.status === 'adapt' ? `<div class="note-box mt" style="border-left-color:var(--accent)"><b>Arena Nights-anpassning — ${K.esc(s.arena.adaptedName || '')}:</b> ${K.esc(s.arena.adaptation)}<br><span class="muted"><b>Bevaras:</b> ${K.esc(s.arena.preserved || '')}</span></div>` : ''}</div>`;
  }
  window.WIRE = { render, hubFor: (id) => HUB[String(id).slice(0, 3)] || 'today', title: (id) => (find(id) || {}).name || id };
})();
