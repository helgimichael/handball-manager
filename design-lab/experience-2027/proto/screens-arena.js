/* Arena Nights adaptations (owner decision 2026-11-13).
   Each adaptation keeps the RECOMMENDED alternative's structure, hierarchy and interactions and only changes the
   visual presentation where the original depended on the Paper & Floodlight language (paper, serif, journal, desk,
   letters, books, the paper→floodlight mode switch). The original alternatives remain untouched in SCREENS[k][alt]. */
(function () {
  const H = window.HM, K = window.K;
  const S = window.SCREENS;
  const { icon, crest, avatar, ring, pchip, cchip, form } = K;

  // Generic adaptation layer: original markup + Arena adaptation CSS (proto/arena.css, scoped by .arena-adapt.ad-<key>).
  const layer = (k, alt) => () => `<div class="arena-adapt ad-${k}">${S[k][alt]()}</div>`;

  /* ---------- DSH-01 Today's Paper → "Matchweek Front Page" (explicit markup, same structure) ---------- */
  const dashboardC = () => {
    const nm = H.nextMatch, lead = H.news[0];
    const ear = (lbl, v, d, why) => `<div class="ad-ear"><span class="kicker">${lbl}</span><span class="ad-ear-v">${ring(v, 46, 'var(--accent)', v)}<span><b class="pos">${d}</b><span class="xs muted" style="display:block">${why}</span></span></span></div>`;
    return `<div class="arena-adapt ad-dashboard">
      <header class="ad-strap">${ear('Förtroende · styrelsen', 71, '▲ 4', 'Vinst i Alingsås')}<div class="ad-plate"><span class="kicker" style="color:var(--club-2)">Klubbjournalen · ${H.me.name}</span><span class="disp it">Matchveckan</span><span class="xs muted">Vecka 46 · tisdag 12 november · Handbollsligan omg 13</span></div>${ear('Rykte · manager', 62, '▲ 1', 'Tre raka segrar')}</header>
      <div class="grid">
        <article class="c8 ad-lead"><div class="photo-bg" style="background-image:url(${lead.img})"></div><span class="beam" style="left:40%"></span><div class="ad-lead-in"><span class="chip solid">${lead.k}</span><h1 class="h1" style="margin:10px 0 8px">${K.esc(lead.h)}</h1><p class="lede" style="color:#d5dbe6;max-width:640px">${K.esc(lead.lede)}</p><div class="row mt wrap">${pchip(H.player('p6'), 34, 'Matchens lirare · 9 mål')}<span class="grow"></span><button class="btn primary" data-act="toast" data-msg="Matchrapport öppnas">Läs matchrapporten</button></div></div></article>
        <aside class="c4 card ad-decide"><div class="card-h"><span class="t">Att avgöra</span><span class="pin">${H.decisions.length}</span></div>${H.decisions.map((d) => `<div class="decision"><span class="n">0${d.n}</span><span><span class="t">${d.t}</span><div class="d">${d.d}</div></span><button class="btn sm ${d.urgent ? 'primary' : ''}" data-act="toast" data-msg="${K.esc(d.act)}">${d.act}</button></div>`).join('')}</aside>
        <section class="c4 card ad-matchbox"><div class="card-h"><span class="t">Matchrutan</span><span class="chip">${nm.date} ${nm.time}</span></div><div class="ad-bug"><span>${crest(nm.home, 34)}<b>${nm.home.short}</b></span><span class="disp it acc">VS</span><span><b>${nm.away.short}</b>${crest(nm.away, 34)}</span></div><div class="small mt">13 spelbara · 1 skadad · Axelsson 76 %</div><div class="row between mt"><span class="small muted">Kristianstad ${form('WWLWW')}</span><button class="btn sm primary" data-act="toast" data-msg="Matchförberedelse">Förbered</button></div></section>
        <section class="c4 card"><div class="card-h"><span class="t">Tabellen ±2</span><span class="more">Ligan →</span></div>${H.table.slice(1, 6).map((r) => `<div class="li ${r.club.id === 'tum' ? 'ad-me' : ''}"><span class="num b" style="width:18px">${r.pos}</span>${cchip(r.club, 16)}<span class="grow"></span><b class="num">${r.pts}</b></div>`).join('')}</section>
        <section class="c4 card"><div class="card-h"><span class="t">Runt ligan</span></div>${H.news.slice(2).map((n) => `<div class="li" style="align-items:flex-start"><span class="ad-dot"></span><span><span class="kicker">${n.k}</span><div class="b" style="font-size:14px;margin-top:2px">${K.esc(n.h)}</div></span></div>`).join('')}</section>
      </div></div>`;
  };

  /* ---------- MGR-01c / clubless state (B-native screen used for the clubless identity demo) ---------- */
  S.clubless = {
    hub: 'career', sub: 'Jobb', title: 'Utan klubb', native: 'B',
    B: () => `<section class="hero" style="min-height:300px;display:flex;align-items:flex-end"><div class="photo-bg" style="background-image:url(${H.env('manager-office')})"></div><div class="in row" style="gap:24px;flex-wrap:wrap">${avatar(H.manager, 120, { bg: 'transparent', jersey: '#1a2233', trim: 'var(--club-neon)' })}<div><div class="kicker" style="color:var(--club-2)">Fri agent · sedan 3 nov 2026</div><div class="h1">${H.manager.name}</div><div class="muted">Rykte: Nationell · senast IFK Tumba HK (2023–2026)</div><div class="row mt wrap"><span class="chip solid">${icon('career', 12)} Söker jobb</span><span class="chip">2 klubbar intresserade</span></div></div></div></section>
      <div class="kicker mt2">Nästa kapitel · lediga jobb</div>
      <div class="cols-3 mt rise">${[['ali', 'Alingsås HK', 'Handbollsligan', 'Topp 6', 74, 'Intervju bokad'], ['ovh', 'OV Helsingborg', 'Handbollsligan', 'Undvik kval', 58, 'Ansök'], ['ara', 'HK Aranäs', 'Allsvenskan', 'Avancera', 81, 'Ansök']].map(([id, n, l, goal, fit, act]) => `<article class="card"><div class="row">${crest(H.club(id), 40)}<span class="grow"><b class="disp it" style="font-size:20px">${n}</b><span class="xs muted" style="display:block">${l} · mål: ${goal}</span></span>${ring(fit, 48, 'var(--accent)', fit)}</div><div class="small muted mt">Passform med ditt rykte och din spelstil</div><button class="btn ${act === 'Intervju bokad' ? '' : 'primary'} mt" data-act="toast" data-msg="${act}: ${n}">${act}</button></article>`).join('')}</div>
      <div class="note-box mt2">Utan klubb används den neutrala neonorange accenten. När du skriver på för en ny klubb byter hela gränssnittet accent automatiskt – designsystemet är oförändrat.</div>`,
  };

  /* ---------- register adaptations for the recommended alternatives that conflict with Arena Nights ---------- */
  const ADAPT = { entry: 'C', club: 'C', manager: 'C', inbox: 'C', player: 'C', scouting: 'C', matchday: 'C', analysis: 'C' };
  Object.entries(ADAPT).forEach(([k, alt]) => { S[k].arena = S[k].arena || {}; S[k].arena[alt] = layer(k, alt); });
  S.dashboard.arena = { C: dashboardC };
})();
