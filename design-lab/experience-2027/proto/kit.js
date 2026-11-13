/* HM Experience 2027 — prototype kit: icons, avatars, crests, charts, shells, interactions. */
(function () {
  const H = window.HM;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' mkr' : Math.round(v / 1000) + ' tkr');

  /* ---------------- icons (Lucide-style 24 grid, stroke) ---------------- */
  const P = {
    today: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
    club: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/>',
    recruit: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    comp: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9.5 17h5"/>',
    career: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    match: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c2.5 2.5 2.5 14.5 0 17M3.6 10.5c5 1.5 11.8 1.5 16.8 0"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9z"/>',
    train: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    hand: '<path d="M7 11l3-3 3 1 3-3 4 4-6 6-2-1-3 2-4-4z"/><path d="M3 12l3 3M21 10l-3 3"/>',
    money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 16h3"/>',
    staff: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c0-4 3.1-7 7-7s7 3 7 7"/><path d="m12 14 1.5 3-1.5 4-1.5-4z"/>',
    med: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
    tactics: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M12 4v16"/><circle cx="7" cy="9" r="1.2"/><circle cx="7" cy="15" r="1.2"/><path d="m15 9 3 3-3 3"/>',
    whistle: '<circle cx="9" cy="14" r="5"/><path d="M12.5 10.5 21 6v4l-6 3"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M12 13v4M8 21h8"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    flame: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-4.3 4.3-6.2 4.3-10.7 3.4 2 7.7 5.6 7.7 10.7 0 3.6-2.5 6.3-5.5 6.3z"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
  };
  const icon = (n, size = 18, sw = 1.8) => `<span class="ico" style="width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.more}</svg></span>`;

  /* ---------------- crest (procedural shield) ---------------- */
  function crest(c, size = 32) {
    if (!c) return '';
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    const ab = esc((c.abbr || c.short || '?').slice(0, 4));
    const fs = ab.length > 3 ? 7.5 : ab.length > 2 ? 9 : 11;
    return `<span class="crest" style="width:${size}px;height:${size * 1.15}px" title="${esc(c.name)}"><svg viewBox="0 0 40 46"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.c1}"/><stop offset="1" stop-color="${shade(c.c1, -25)}"/></linearGradient></defs><path d="M20 1.5 37.5 7v15.5C37.5 34 29.5 41.5 20 44.5 10.5 41.5 2.5 34 2.5 22.5V7z" fill="url(#${id})" stroke="${c.c2}" stroke-width="2"/><path d="M6 13h28" stroke="${c.c2}" stroke-width="1.2" opacity=".7"/><text x="20" y="30" text-anchor="middle" font-family="Barlow Condensed, Bahnschrift, Arial Narrow, sans-serif" font-weight="800" font-size="${fs}" fill="${c.c2}" letter-spacing=".3">${ab}</text></svg></span>`;
  }
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v + (255 * pct) / 100)));
    return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
  }

  /* ---------------- avatar (stylised non-likeness bust) ---------------- */
  const SKIN = ['#f1c9a5', '#d9a77e', '#a86f4c', '#6e4630'];
  const HAIR = ['#2b1d14', '#5a3a22', '#c9a063', '#1a1a1a', '#8a5a2b', '#b9b2a6', '#3b2a1e', '#d8b36a', '#2f2420'];
  function avatar(p, size = 40, opts = {}) {
    const skin = SKIN[p.skin ?? 0], hair = HAIR[p.hair ?? 0];
    const jersey = opts.jersey || (p.club ? p.club.c1 : H.me.c1);
    const trim = opts.trim || (p.club ? p.club.c2 : H.me.c2);
    const bg = opts.bg || 'var(--chip-bg)';
    const long = p.female;
    const hairPath = long
      ? '<path d="M14 26c-2-11 4-17 10-17s12 6 10 17l2 12h-4l-2-10H18l-2 10h-4z" fill="HAIR"/>'
      : ['<path d="M15 21c0-8 4-11 9-11s9 3 9 11c-2-4-5-5-9-5s-7 1-9 5z" fill="HAIR"/>', '<path d="M15 22c-1-9 4-13 9-13s10 4 9 13c-1-3-3-6-9-6s-8 3-9 6z" fill="HAIR"/>', '<path d="M15.5 19c1-6 4.5-8 8.5-8s7.5 2 8.5 8c-2-2-5-3-8.5-3s-6.5 1-8.5 3z" fill="HAIR"/>', '<path d="M15 23c-1.5-10 3.5-14 9-14 6 0 10.5 4 9 14l-1-4c-3-3-13-3-16 0z" fill="HAIR"/>', '<path d="M16 18c2-5 5-6 8-6s6 1 8 6c-3-1-5-1.5-8-1.5s-5 .5-8 1.5z" fill="HAIR"/>', '<path d="M15.5 20c.5-6 4-8.5 8.5-8.5s8 2.5 8.5 8.5c-1-1.5-3.5-3-8.5-3s-7.5 1.5-8.5 3z" fill="HAIR" opacity=".55"/>'][(p.hair ?? 0) % 6];
    const num = opts.num ? `<text x="24" y="44" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="7" fill="${trim}">${p.no ?? ''}</text>` : '';
    const svg = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="${bg}"/>${long ? hairPath.replace('HAIR', hair) : ''}<path d="M7 48c1-9 7-13.5 17-13.5S40 39 41 48z" fill="${jersey}"/><path d="M19 34.8 24 40l5-5.2" fill="none" stroke="${trim}" stroke-width="1.6"/><rect x="20.5" y="27" width="7" height="8" rx="3" fill="${skin}"/><ellipse cx="24" cy="21" rx="8.3" ry="9.6" fill="${skin}"/>${long ? '' : hairPath.replace('HAIR', hair)}${num}</svg>`;
    const cls = 'av' + (opts.square ? ' sq' : '');
    return `<span class="${cls}" style="width:${size}px;height:${size}px">${svg}</span>`;
  }
  function bust(p, h = 160, opts = {}) {
    // larger "athlete card" bust, transparent bg
    return avatar(p, h, Object.assign({ bg: 'transparent', num: true }, opts)).replace('class="av"', 'class="av" style="background:transparent;border-radius:0;width:' + h + 'px;height:' + h + 'px"');
  }

  /* ---------------- data viz ---------------- */
  const attrCls = (v) => (v >= 17 ? 'a5' : v >= 14 ? 'a4' : v >= 11 ? 'a3' : v >= 8 ? 'a2' : 'a1');
  function spark(vals, w = 90, h = 26, color = 'var(--accent)', fill = true) {
    if (!vals || vals.length < 2) return '';
    const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 4) + 2, h - 3 - ((v - mn) / r) * (h - 6)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${fill ? `<path d="${d} L${w - 2} ${h} L2 ${h}Z" fill="${color}" opacity=".12"/>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${color}"/></svg>`;
  }
  function bar(v, max = 100, cls = '', pot) {
    const p = Math.max(0, Math.min(100, (v / max) * 100));
    const potEl = pot ? `<span class="pot" style="left:${p}%;width:${Math.max(0, (pot / max) * 100 - p)}%"></span>` : '';
    return `<div class="bar ${cls}"><i style="width:${p}%"></i>${potEl}</div>`;
  }
  function ring(v, size = 64, color = 'var(--accent)', label) {
    const r = size / 2 - 5, c = 2 * Math.PI * r;
    return `<span class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--chip-bg)" stroke-width="6"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span class="rv" style="font-size:${size / 3.3}px">${label ?? v}</span></span>`;
  }
  function radar(vals, labels, size = 220, color = 'var(--accent)', comp) {
    const n = vals.length, cx = size / 2, cy = size / 2, R = size / 2 - 30;
    const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
    let g = '';
    [0.25, 0.5, 0.75, 1].forEach((s) => { g += `<polygon points="${vals.map((_, i) => pt(i, s).join(',')).join(' ')}" fill="none" stroke="var(--line)" />`; });
    labels.forEach((l, i) => { const [x, y] = pt(i, 1.2); g += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10.5" font-weight="600" fill="var(--muted)">${esc(l)}</text>`; });
    const poly = (vs, col, op) => `<polygon points="${vs.map((v, i) => pt(i, v / 20).join(',')).join(' ')}" fill="${col}" fill-opacity="${op}" stroke="${col}" stroke-width="2"/>`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="max-width:100%;overflow:visible">${g}${comp ? poly(comp, 'var(--muted)', 0.08) : ''}${poly(vals, color, 0.2)}</svg>`;
  }
  function form(str) { return `<span class="form">${[...str].map((c) => `<i class="${c}">${c === 'W' ? 'V' : c === 'L' ? 'F' : 'O'}</i>`).join('')}</span>`; }
  function lineChart(series, w = 520, h = 160, labels) {
    const all = series.flatMap((s) => s.v); const mn = Math.min(...all) * 0.95, mx = Math.max(...all) * 1.03;
    const X = (i, n) => 30 + (i / (n - 1)) * (w - 44), Y = (v) => h - 22 - ((v - mn) / (mx - mn)) * (h - 36);
    let g = '';
    for (let k = 0; k <= 3; k++) { const y = 12 + (k * (h - 34)) / 3; g += `<line x1="30" x2="${w - 10}" y1="${y}" y2="${y}" stroke="var(--line)"/>`; }
    if (labels) labels.forEach((l, i) => { g += `<text x="${X(i, labels.length)}" y="${h - 4}" text-anchor="middle" font-size="10" fill="var(--muted)">${l}</text>`; });
    series.forEach((s) => { g += `<path d="${s.v.map((v, i) => (i ? 'L' : 'M') + X(i, s.v.length) + ' ' + Y(v)).join(' ')}" fill="none" stroke="${s.c}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="4 4"' : ''}/>`; });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px">${g}</svg>`;
  }
  function momentum(vals, w = 600, h = 90) {
    const mid = h / 2, step = (w - 8) / (vals.length - 1);
    const d = vals.map((v, i) => (i ? 'L' : 'M') + (4 + i * step) + ' ' + (mid - v * (mid - 8) / 4)).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="height:${h}px"><line x1="0" x2="${w}" y1="${mid}" y2="${mid}" stroke="var(--line-strong)" stroke-dasharray="3 4"/><path d="${d} L${w - 4} ${mid} L4 ${mid}Z" fill="var(--accent)" opacity=".18"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.4"/><line x1="${w / 2}" x2="${w / 2}" y1="4" y2="${h - 4}" stroke="var(--muted)" stroke-dasharray="2 3"/><text x="${w / 2 + 6}" y="14" font-size="10" fill="var(--muted)">HT</text></svg>`;
  }
  /* handball court (40x20) with positions */
  function court(opts = {}) {
    const w = opts.w || 400, h = w / 2, s = w / 40;
    const pos = opts.players || [];
    const dots = pos.map((p) => `<g transform="translate(${p.x * s} ${p.y * s})"><circle r="${opts.r || 11}" fill="${p.c || 'var(--accent)'}" stroke="#fff" stroke-width="1.5"/><text y="4" text-anchor="middle" font-size="${opts.fs || 10}" font-weight="800" fill="#fff" font-family="Barlow Condensed, Arial Narrow, sans-serif">${esc(p.l)}</text></g>`).join('');
    // D-shaped zone: quarter circles of radius R around posts (y=8.5, 11.5) joined by a straight segment
    const zone = (R, left, dashed) => {
      const x0 = left ? 0 : w, sg = left ? 1 : -1, sw = left ? 1 : 0;
      const d = `M${x0} ${(8.5 - R) * s} A ${R * s} ${R * s} 0 0 ${sw} ${x0 + sg * R * s} ${8.5 * s} L${x0 + sg * R * s} ${11.5 * s} A ${R * s} ${R * s} 0 0 ${sw} ${x0} ${(11.5 + R) * s}`;
      return dashed ? `<path d="${d}" fill="none" stroke="var(--court-line)" stroke-width="1.2" stroke-dasharray="5 4"/>` : `<path d="${d}Z" fill="var(--court-zone)" stroke="var(--court-line)" stroke-width="1.5"/>`;
    };
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;display:block" role="img" aria-label="Handbollsplan"><rect width="${w}" height="${h}" fill="var(--court-floor)" rx="4"/>${zone(6, true)}${zone(6, false)}${zone(9, true, true)}${zone(9, false, true)}<line x1="${w / 2}" x2="${w / 2}" y1="0" y2="${h}" stroke="var(--court-line)" stroke-width="1.5"/><line x1="${7 * s}" x2="${7 * s}" y1="${9.5 * s}" y2="${10.5 * s}" stroke="var(--court-line)" stroke-width="2"/><line x1="${33 * s}" x2="${33 * s}" y1="${9.5 * s}" y2="${10.5 * s}" stroke="var(--court-line)" stroke-width="2"/><rect x="0" y="${8.5 * s}" width="${0.6 * s}" height="${3 * s}" fill="var(--court-line)"/><rect x="${w - 0.6 * s}" y="${8.5 * s}" width="${0.6 * s}" height="${3 * s}" fill="var(--court-line)"/>${dots}</svg>`;
  }
  const lineup = (c = 'var(--accent)') => [
    { x: 1.6, y: 10, l: 'MV', c }, { x: 9.5, y: 2.5, l: 'VS', c }, { x: 9.8, y: 6.8, l: 'VN', c }, { x: 11, y: 10, l: 'MN', c }, { x: 9.8, y: 13.2, l: 'HN', c }, { x: 9.5, y: 17.5, l: 'HS', c }, { x: 7, y: 11.8, l: 'M', c },
  ];

  /* ---------------- entity chips ---------------- */
  const pchip = (p, size = 30, sub) => `<span class="ent ent-link" data-peek="player:${p.id}">${avatar(p, size)}<span style="min-width:0"><span class="nm ell" style="display:block">${esc(p.name)}</span>${sub !== false ? `<span class="sub">${sub || esc(p.posLabel || H.POS[p.pos])}</span>` : ''}</span></span>`;
  const cchip = (c, size = 20, label) => `<span class="ent">${crest(c, size)}<span class="nm">${esc(label || c.short || c.name)}</span></span>`;
  const schip = (s, size = 30) => `<span class="ent ent-link" data-peek="staff:${s.id}">${avatar(Object.assign({ club: H.me }, s), size)}<span><span class="nm" style="display:block">${esc(s.name)}</span><span class="sub">${esc(s.role)}</span></span></span>`;
  const stars = (n, max = 5) => `<span class="gold" aria-label="${n} av ${max}">${'★'.repeat(Math.round(n))}<span class="faint">${'★'.repeat(max - Math.round(n))}</span></span>`;
  const status = (p) => (p.status === 'injured' ? '<span class="chip neg">Skadad</span>' : p.status === 'tired' ? '<span class="chip warn">Trött</span>' : p.status === 'unhappy' ? '<span class="chip warn">Missnöjd</span>' : '<span class="chip pos">Tillgänglig</span>');

  /* ---------------- shells ---------------- */
  const HUBS = [
    ['today', 'Idag', 'today'], ['team', 'Laget', 'team'], ['club', 'Klubben', 'club'], ['recruit', 'Rekrytering', 'recruit'], ['comp', 'Tävling', 'comp'], ['career', 'Karriär', 'career'],
  ];
  const SUB = {
    today: ['Översikt', 'Inkorg', 'Nyheter', 'Kalender'], team: ['Trupp', 'Taktik', 'Träning', 'Medicinskt', 'Kontrakt'], club: ['Klubbhuset', 'Personal', 'Ekonomi', 'Styrelsen', 'Historik'],
    recruit: ['Scouting', 'Spelarsök', 'Bevakning', 'Transfers'], comp: ['Ligan', 'Cupen', 'Matcher', 'Statistik'], career: ['Manager', 'Rykte', 'Jobb', 'Milstolpar'],
  };
  // Marks a temporary fallback identity so it is never mistaken for verified club colours.
  const idMark = () => (H.activeClub && H.activeClub.kind === 'fallback' ? '<span class="idfb" title="Tröjfärgen är inte verifierad – tillfällig standardfärg (orange). Status: UNKNOWN.">Klubbfärg ej verifierad</span>' : '');
  // `theme` = visual language (tokens); `opts.nav` = navigation structure (a: hub rail + palette, b: top hub bar, c: Week Spine + rail + Peek).
  function shell(theme, hub, content, opts = {}) {
    const nav = opts.nav || theme;
    const unread = 3;
    const sub = opts.sub ?? SUB[hub]?.[0];
    const mbar = `<nav class="mbar" aria-label="Mobilnavigering">${[['today', 'Idag'], ['team', 'Laget'], nav === 'b' ? ['__fab', 'Fortsätt'] : ['comp', 'Match'], ['recruit', 'Marknad'], ['club', 'Klubb']].map(([k, l]) => k === '__fab' ? `<a href="#" class="fab" data-act="continue">${icon('play', 20)}<span>${l}</span></a>` : `<a href="#" class="${k === hub ? 'on' : ''}" data-hub="${k}">${icon(HUBS.find((h) => h[0] === k)?.[2] || k, 21)}<span>${l}</span></a>`).join('')}</nav>`;
    const palette = `<div class="palette" role="dialog" aria-label="Kommandopalett"><input placeholder="Sök spelare, klubb, match eller kommando…" aria-label="Sök"/><div class="opts"></div></div><div class="toast" role="status"></div><div class="scrim"></div><aside class="drawer" aria-label="Snabbvy"></aside>`;
    if (nav === 'a') {
      return `<div class="app shell-a"><aside class="rail"><div class="brand">${crest(H.me, 26)}<b>Handball Manager</b></div>${HUBS.map(([k, l, ic]) => `<a href="#" class="hub ${k === hub ? 'on' : ''}" data-hub="${k}">${icon(ic)}<span class="lbl">${l}</span>${k === 'today' ? `<span class="pin">${unread}</span>` : ''}</a>`).join('')}<div class="club">${avatar(H.manager, 28)}<span class="t"><b>${H.manager.name}</b><br><span class="muted">${H.me.short} · ${H.season}</span></span></div></aside><div class="main"><header class="topbar"><span class="crumb">${HUBS.find((h) => h[0] === hub)?.[1] || ''} / <b>${esc(opts.title || sub || '')}</b></span><span class="search" data-act="palette">${icon('search', 16)}<span class="grow">Sök eller kör kommando</span><span class="kbd">Ctrl K</span></span><button class="btn primary continue-a" data-act="continue">${icon('play', 14)} Fortsätt <small>· 2 att göra</small></button></header>${SUB[hub] && opts.tabs !== false ? `<div class="subtabs subtabs-d"><nav class="tabs">${SUB[hub].map((s) => `<a href="#" class="${s === sub ? 'on' : ''}">${s}</a>`).join('')}</nav></div>` : ''}<main class="page">${content}</main></div>${mbar}${palette}</div>`;
    }
    if (nav === 'b') {
      return `<div class="app shell-b"><header class="hubbar"><span class="club">${crest(H.me, 30)}<b>${H.me.short}</b>${idMark()}</span>${HUBS.map(([k, l]) => `<a href="#" class="hub ${k === hub ? 'on' : ''}" data-hub="${k}">${l}</a>`).join('')}<button class="cont-b" data-act="continue">${icon('play', 16)}<span>Fortsätt<small>Matchdag om 2 dagar</small></span></button><span class="only-m" style="margin-left:auto">${icon('bell', 20)}</span></header><main class="page">${content}</main>${mbar}${palette}</div>`;
    }
    // C
    const clubless = H.me && H.me.id === 'none';
    const week = clubless ? [{ d: 'Mån 11', e: 'Ledig', past: true }, { d: 'Tis 12', e: 'Läs jobbannonser', today: true }, { d: 'Ons 13', e: 'Intervju: Alingsås', kind: 'match' }, { d: 'Tor 14', e: 'Bevaka Tumba – Kristianstad' }, { d: 'Fre 15', e: 'Ansökan OV stänger' }, { d: 'Lör 16', e: 'Ledig' }, { d: 'Sön 17', e: 'Svar från Alingsås?' }] : H.week;
    const ahead = clubless ? '<span><b>20 nov</b> Aranäs styrelsemöte</span><span><b>1 dec</b> Transferfönster stänger</span>' : '<span><b>20 nov</b> Cupen · OV Helsingborg</span><span><b>1 dec</b> Transferfönster stänger</span>';
    const spine = `<div class="spine" role="navigation" aria-label="Veckans tidslinje">${week.map((d) => `<div class="day ${d.today ? 'today' : ''} ${d.kind === 'match' ? 'match' : ''} ${d.past ? 'past' : ''}" tabindex="0"><div class="d">${d.d}${d.today ? ' · idag' : ''}</div><div class="e">${d.e}</div></div>`).join('')}<div class="ahead"><span class="kicker">Framåt</span>${ahead}</div></div>`;
    return `<div class="app shell-c"><header class="masthead"><span class="wm">${crest(H.me, 24)} ${H.me.short}${idMark()} <small>${H.date}</small></span><span class="search" data-act="palette">${icon('search', 15)}<span class="grow">Sök…</span><span class="kbd" style="color:#c9cfd8;border-color:#56627a">Ctrl K</span></span><button class="cont-c" data-act="continue">${icon('play', 16)}<span>Fortsätt<small>Till onsdag</small></span></button></header>${spine}<div class="body"><nav class="rail" aria-label="Huvudnavigering">${HUBS.map(([k, l, ic]) => `<a href="#" class="hub ${k === hub ? 'on' : ''}" data-hub="${k}">${icon(ic, 20)}<span>${l}</span></a>`).join('')}</nav><main class="page">${content}</main></div>${mbar}${palette}</div>`;
  }

  /* ---------------- interactions (all real, no inert buttons) ---------------- */
  function peekHtml(kind, id) {
    if (kind === 'player') {
      const p = H.player(id) || H.targets.find((t) => t.id === id);
      if (!p) return '';
      const top = Object.entries(p.attrs || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return `<div class="row between"><span class="kicker acc">Snabbvy · Spelare</span><button class="btn sm ghost" data-act="close">${icon('x', 14)} Stäng</button></div><div class="row mt">${avatar(p, 72)}<div><div class="h3">${esc(p.name)}</div><div class="muted small">${esc(H.POS[p.pos])} · ${p.age} år · #${p.no ?? '–'}</div><div class="mt" style="margin-top:6px">${p.status ? status(p) : ''}</div></div></div><div class="cols-3 mt"><div class="tile"><span class="lbl">Nivå</span><span class="val">${p.ca}</span></div><div class="tile"><span class="lbl">Potential</span><span class="val">${p.pa}</span></div><div class="tile"><span class="lbl">Betyg</span><span class="val">${p.rating ?? '–'}</span></div></div><div class="mt"><div class="kicker">Främsta egenskaper</div>${top.map(([k, v]) => `<div class="attr"><span>${k}</span><span class="v ${attrCls(v)}">${v}</span></div>`).join('')}</div>${p.form ? `<div class="mt"><div class="kicker">Form (senaste)</div>${spark(p.form, 300, 46)}</div>` : ''}<div class="row mt wrap"><button class="btn primary" data-act="toast" data-msg="Öppnar full profil">Öppna profil</button><button class="btn" data-act="toast" data-msg="${esc(p.name)} tillagd i jämförelse">Jämför</button></div>`;
    }
    if (kind === 'staff') {
      const s = H.staff.find((x) => x.id === id);
      return `<div class="row between"><span class="kicker acc">Snabbvy · Personal</span><button class="btn sm ghost" data-act="close">${icon('x', 14)} Stäng</button></div><div class="row mt">${avatar(Object.assign({ club: H.me }, s), 72)}<div><div class="h3">${esc(s.name)}</div><div class="muted small">${esc(s.role)} · ${esc(s.area)}</div></div></div><div class="mt">${stars(s.rep)}</div><div class="mt"><div class="kicker">Ansvar</div>${s.resp.map((r) => `<div class="li">${icon('check', 16)} ${r}</div>`).join('')}</div><div class="note-box mt">Humör: <b>${s.mood}</b> · Fokus: ${s.focus}</div><div class="row mt"><button class="btn primary" data-act="toast" data-msg="Samtal med ${esc(s.name)} bokat">Prata med ${esc(s.name.split(' ')[0])}</button></div>`;
    }
    return '';
  }
  function toast(msg) {
    const t = document.querySelector('.toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function openPalette() {
    const pal = document.querySelector('.palette'); if (!pal) return;
    pal.classList.add('open'); const inp = pal.querySelector('input'); inp.value = ''; renderOpts(''); inp.focus();
  }
  const CMD = () => [
    ...H.players.map((p) => ({ t: p.name, s: H.POS[p.pos] + ' · ' + (H.activeClub && H.activeClub.short || H.me.short), k: 'player', id: p.id, i: avatar(p, 22) })),
    ...H.targets.map((p) => ({ t: p.name, s: H.POS[p.pos] + ' · ' + p.club.short + ' · bevakad', k: 'player', id: p.id, i: avatar(p, 22) })),
    ...H.clubs.map((c) => ({ t: c.name, s: 'Klubb', k: 'club', i: crest(c, 18) })),
    { t: 'Erbjud kontrakt…', s: 'Kommando', k: 'cmd', i: icon('hand', 18) }, { t: 'Välj startsju', s: 'Kommando · nästa match', k: 'cmd', i: icon('tactics', 18) }, { t: 'Gå till tabellen', s: 'Kommando', k: 'cmd', i: icon('comp', 18) },
  ];
  function renderOpts(q) {
    const box = document.querySelector('.palette .opts'); const ql = q.toLowerCase();
    const res = CMD().filter((o) => !ql || o.t.toLowerCase().includes(ql) || o.s.toLowerCase().includes(ql)).slice(0, 8);
    box.innerHTML = res.map((o, i) => `<div class="opt ${i === 0 ? 'on' : ''}" data-k="${o.k}" data-id="${o.id || ''}" data-t="${esc(o.t)}">${o.i}<span class="grow"><b>${esc(o.t)}</b> <span class="muted small">${esc(o.s)}</span></span><span class="kbd">↵</span></div>`).join('') || '<div class="opt muted">Inga träffar</div>';
  }
  function openPeek(kind, id) {
    const d = document.querySelector('.drawer'), s = document.querySelector('.scrim'); if (!d) return;
    d.innerHTML = peekHtml(kind, id); d.classList.add('open'); s.classList.add('open');
  }
  function closeAll() {
    document.querySelectorAll('.drawer.open, .scrim.open, .palette.open').forEach((e) => e.classList.remove('open'));
  }
  function wire(root = document) {
    root.addEventListener('click', (e) => {
      const peek = e.target.closest('[data-peek]');
      if (peek) { e.preventDefault(); const [k, id] = peek.dataset.peek.split(':'); openPeek(k, id); return; }
      const a = e.target.closest('[data-act]');
      if (a) {
        e.preventDefault();
        const act = a.dataset.act;
        if (act === 'palette') openPalette();
        else if (act === 'close') closeAll();
        else if (act === 'toast') toast(a.dataset.msg || 'Klart');
        else if (act === 'continue') toast('Fortsätt → nästa händelse (simulerad i prototypen)');
        else if (act === 'tab') { const g = a.closest('[data-tabs]'); g.querySelectorAll('[data-act="tab"]').forEach((b) => b.classList.toggle('on', b === a)); const host = document.querySelector(g.dataset.tabs); if (host) host.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== a.dataset.pane)); }
        else if (act === 'toggle') { const t = document.querySelector(a.dataset.target); if (t) t.hidden = !t.hidden; a.classList.toggle('on'); }
        else if (act === 'select') { const g = a.closest('[data-group]'); g.querySelectorAll('[data-act="select"]').forEach((b) => b.classList.toggle('on', b === a)); if (a.dataset.msg) toast(a.dataset.msg); }
        else if (act === 'flood') { document.documentElement.dataset.mode = document.documentElement.dataset.mode === 'flood' ? '' : 'flood'; }
        else if (act === 'check') { a.classList.toggle('done'); const ic = a.querySelector('.ck'); if (ic) ic.innerHTML = a.classList.contains('done') ? icon('check', 16) : ''; }
        return;
      }
      if (e.target.closest('.scrim')) closeAll();
      const opt = e.target.closest('.palette .opt[data-k]');
      if (opt) { closeAll(); if (opt.dataset.k === 'player') openPeek('player', opt.dataset.id); else toast(opt.dataset.t); return; }
      const hubLink = e.target.closest('[data-hub], .tabs a');
      if (hubLink) { e.preventDefault(); toast('Navigering: ' + hubLink.textContent.trim() + ' (byt yta i labbets ytlista)'); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      if (e.key === 'Escape') closeAll();
      const pal = document.querySelector('.palette.open');
      if (pal && e.key === 'Enter') { const o = pal.querySelector('.opt.on'); if (o) o.click(); }
      if (pal && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const os = [...pal.querySelectorAll('.opt[data-k]')]; const i = os.findIndex((o) => o.classList.contains('on')); os.forEach((o) => o.classList.remove('on')); const n = os[(i + (e.key === 'ArrowDown' ? 1 : -1) + os.length) % os.length]; if (n) n.classList.add('on'); }
    });
    document.addEventListener('input', (e) => { if (e.target.matches('.palette input')) renderOpts(e.target.value); });
  }

  /* ---------------- CLUB IDENTITY SYSTEM (registry-driven) ----------------
     Single source: window.HM_CLUB_REGISTRY (generated from club-identity/registry.json — home-shirt colours + neon).
     The active club changes ONLY CSS custom properties; components, layouts and the token contract are identical. */
  const REGDATA = window.HM_CLUB_REGISTRY || { clubs: [], clubless: '#ff7a1a', pending: '#9fb0c6' };
  const REGBY = new Map(REGDATA.clubs.map((r) => [r.id, r]));
  const NEON_CLUBLESS = REGDATA.clubless;
  const STOP = new Set(['HK', 'IF', 'IK', 'HF', 'SK', 'BK', 'HB', 'HC', 'AIK', 'IFK', 'GIF', 'Handboll', 'Handbollsklubb', 'Håndbold', 'Håndball', 'Elite', 'Herr', 'herr', 'U', 'TV', 'SG', 'SC', 'TSV', 'VfL', 'HSG', 'THW', 'TBV', 'GWD', 'MT', 'TTH', 'GOG', 'HØJ', 'TMS', 'ØIF']);
  const abbrOf = (name) => { const w = String(name).split(/[\s-]+/).filter(Boolean); const core = w.filter((x) => !STOP.has(x)); const pick = (core.length ? core : w); return (pick.length === 1 ? pick[0].slice(0, 3) : pick.map((x) => x[0]).join('').slice(0, 3)).toUpperCase(); };
  const sampleOf = (regId) => H.clubs.find((c) => c.regId === regId);
  function registryFor(id) { if (!id || id === 'none') return null; const s = H.club(id); return REGBY.get(s ? s.regId : id) || null; }
  function neonFor(clubOrId) {
    if (!clubOrId || clubOrId === 'none' || clubOrId.id === 'none') return NEON_CLUBLESS;
    const r = typeof clubOrId === 'string' ? registryFor(clubOrId) : REGBY.get(clubOrId.regId || clubOrId.id);
    return r ? r.neon : REGDATA.pending;
  }
  const PRISTINE = {};
  const VISUAL = ['name', 'short', 'abbr', 'c1', 'c2', 'arena', 'cap'];
  const NO_CLUB = { id: 'none', name: 'Utan klubb', short: 'Fri agent', abbr: 'HM', c1: '#1a2233', c2: NEON_CLUBLESS };
  let SWAP = null; // text swap plan for the current career club
  function snapshot() { if (!PRISTINE.done) { H.clubs.forEach((c) => (PRISTINE[c.id] = Object.fromEntries(VISUAL.map((k) => [k, c[k]])))); PRISTINE.done = true; } }
  function restore() { H.clubs.forEach((c) => Object.assign(c, PRISTINE[c.id])); H.me = H.club('tum'); H.activeClub = H.me; SWAP = null; }
  // Crest colours: documented crest → game crest → neutral. Never the neon, never the shirt (owner rule).
  const kitCrest = (r) => { const s = sampleOf(r.id); if (s) return { c1: PRISTINE[s.id].c1, c2: PRISTINE[s.id].c2 }; if (r.cp) return { c1: r.cp, c2: r.cs || (r.cp.toUpperCase() === '#FFFFFF' ? '#111111' : '#FFFFFF') }; if (r.ph) return { c1: r.ph, c2: r.phs || '#FFFFFF' }; return { c1: '#3a4250', c2: '#c9d1dc' }; };
  /** Apply a club identity: 'none' (clubless), a sample id ('tum', 'ham', …) or ANY registry club id (202 clubs). */
  function applyClub(id) {
    snapshot(); restore();
    const root = document.documentElement;
    let active;
    if (id === 'none') { H.me = NO_CLUB; H.activeClub = NO_CLUB; active = { id: 'none', name: NO_CLUB.name, c1: NO_CLUB.c1, c2: NO_CLUB.c2, neon: NEON_CLUBLESS }; }
    else {
      const r = registryFor(id) || REGBY.get(H.club('tum').regId);
      const tum = H.club('tum'), pt = PRISTINE.tum;
      const s = sampleOf(r.id);
      const crestCols = kitCrest(r);
      if (s && s.id !== 'tum') {
        // The chosen club exists in the sample league: it becomes the career club and Tumba becomes an opponent.
        const ps = PRISTINE[s.id];
        Object.assign(tum, { c1: ps.c1, c2: ps.c2, abbr: ps.abbr }); Object.assign(s, { c1: pt.c1, c2: pt.c2, abbr: pt.abbr });
        SWAP = { two: [[pt.name, ps.name], [pt.short, ps.short]], arena: null, bug: ps.short.slice(0, 3).toUpperCase() };
      } else if (!s) {
        // A club outside the sample league: it replaces Tumba in the sample career (prototype content only).
        Object.assign(tum, { c1: crestCols.c1, c2: crestCols.c2, abbr: abbrOf(r.name) });
        SWAP = { one: [[pt.name, r.name], ['Tumba Sporthall', 'hemmaarenan'], [pt.short, r.short]], bug: abbrOf(r.short || r.name) };
      }
      // Identity kind (owner decisions 2026-11-14): 'club' = colour from the verified/documented shirt, 'ice' = Ice Silver
      // for black/white shirts, 'fallback' = default orange for an UNKNOWN kit (temporary, not verified club data).
      H.activeClub = { short: s ? s.short : r.short, name: r.name, kind: r.fb ? 'fallback' : String(r.rule || '').startsWith('ice') ? 'ice' : 'club', status: r.status };
      // --club-primary follows the home SHIRT (match-day cells, score bug); crests keep crest colours.
      active = { id: r.id, name: r.name, c1: r.p && ['VERIFIED', 'PROBABLE', 'UNCERTAIN'].includes(r.status) ? r.p : '#1a2233', c2: r.s || crestCols.c2, neon: r.neon, status: r.status };
    }
    root.dataset.club = active.id;
    root.dataset.identity = (H.activeClub && H.activeClub.kind) || (active.id === 'none' ? 'clubless' : 'club');
    root.style.setProperty('--club-neon', active.neon);
    root.style.setProperty('--club-primary', active.c1);
    root.style.setProperty('--club-secondary', active.c2);
    return active;
  }
  const mark = (i, k) => '\u0001' + i + k + '\u0002';
  // Placeholder-safe name swap for prototype copy (sample content is written for the Tumba career).
  function swapCareerText(html) {
    if (!SWAP) return html;
    let out = html;
    const bugPair = [' TUM</span>', ' ' + SWAP.bug + '</span>'];
    if (SWAP.two) {
      const pairs = [...SWAP.two, bugPair];
      pairs.forEach(([a, b], i) => { out = out.split(a).join(mark(i, 'a')).split(b).join(mark(i, 'b')); });
      pairs.forEach(([a, b], i) => { out = out.split(mark(i, 'a')).join(b).split(mark(i, 'b')).join(a); });
      return out;
    }
    [...SWAP.one, bugPair].forEach(([a, b]) => { out = out.split(a).join(b); });
    return out;
  }

  window.K = { esc, money, icon, crest, avatar, bust, attrCls, spark, bar, ring, radar, form, lineChart, momentum, court, lineup, pchip, cchip, schip, stars, status, shell, wire, toast, shade, HUBS, applyClub, neonFor, registryFor, abbrOf, swapCareerText, NO_CLUB, REGISTRY: REGDATA };
})();
