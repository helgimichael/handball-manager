/* Core surfaces: Entry, Dashboard, Club home */
(function () {
  const H = window.HM, K = window.K;
  const S = (window.SCREENS = window.SCREENS || {});
  const { icon, crest, avatar, esc, money, spark, bar, ring, form, pchip, cchip, schip } = K;
  const nm = H.nextMatch, me = H.me;

  /* =============================== ENTRY =============================== */
  S.entry = {
    hub: 'today', title: 'Karriärer', fullscreen: ['A', 'B', 'C'],
    mode: { C: () => '' },
    A: () => `<div class="ent-a">
      <header class="row between ent-a-top"><span class="row">${crest(me, 26)}<b style="font-size:15px;letter-spacing:-.02em">Handball Manager</b><span class="chip">2027</span></span><span class="row"><button class="btn sm" data-act="toast" data-msg="Inställningar öppnas">${icon('more', 14)} Inställningar</button></span></header>
      <div class="ent-a-grid">
        <section>
          <div class="kicker">Fortsätt där du slutade</div>
          <div class="card mt ent-a-hero">
            <div class="row top">${crest(me, 56)}<div class="grow"><div class="h2">${me.name}</div><div class="muted">${H.manager.name} · ${H.saves[0].season} · ${H.saves[0].when}</div><div class="row wrap mt" style="margin-top:10px"><span class="chip acc">${H.saves[0].pos}</span><span class="chip">${H.saves[0].next}</span><span class="chip">Sparad ${H.saves[0].last.toLowerCase()}</span></div></div></div>
            <div class="cols-4 mt">
              <div class="tile"><span class="lbl">Tabell</span><span class="val">4<span class="muted" style="font-size:14px">/14</span></span><span class="delta pos">▲ 2 senaste veckan</span></div>
              <div class="tile"><span class="lbl">Form</span><span class="val" style="font-size:16px;margin-top:6px">${form('WWDWL')}</span></div>
              <div class="tile"><span class="lbl">Styrelsens förtroende</span><span class="val">71%</span><span class="delta pos">▲ 4</span></div>
              <div class="tile"><span class="lbl">Väntar på dig</span><span class="val">4</span><span class="delta muted">beslut</span></div>
            </div>
            <div class="row mt"><button class="btn primary lg" data-act="toast" data-msg="Laddar karriären…">${icon('play', 16)} Fortsätt karriär</button><span class="muted small">Enter</span></div>
          </div>
          <div class="kicker mt2">Alla karriärer</div>
          <table class="tbl mt"><thead><tr><th>Klubb</th><th>Manager</th><th>Säsong</th><th class="hide-m">Läge</th><th class="r">Senast</th></tr></thead><tbody>
            ${H.saves.map((s, i) => `<tr class="${i === 0 ? 'me' : ''}"><td>${cchip(s.club, 18, s.club.name)}</td><td>${s.mgr}</td><td class="num">${s.season}</td><td class="hide-m">${s.pos}</td><td class="r muted">${s.last}</td></tr>`).join('')}
          </tbody></table>
          <div class="row mt"><button class="btn" data-act="toast" data-msg="Ny karriär: välj land, liga och klubb">+ Ny karriär</button><button class="btn ghost" data-act="toast" data-msg="Importera sparfil">Importera</button></div>
        </section>
        <aside class="card">
          <div class="card-h"><span class="t">Sedan du spelade senast</span></div>
          <div class="list">
            <div class="li">${icon('match')}<span class="grow"><b>Vinst 29–27 mot Alingsås</b><div class="meta">Sahlin 9 mål · matchens lirare</div></span></div>
            <div class="li">${icon('med')}<span class="grow"><b>Nyberg skadad</b><div class="meta">Fotled · 2–3 veckor</div></span></div>
            <div class="li">${icon('recruit')}<span class="grow"><b>Ny scoutrapport</b><div class="meta">Rasmus Öberg, Lugi</div></span></div>
            <div class="li">${icon('inbox')}<span class="grow"><b>3 olästa meddelanden</b><div class="meta">Träningsförslag, spelarsamtal</div></span></div>
          </div>
        </aside>
      </div></div>`,
    B: () => `<div class="ent-b">
      <div class="ent-b-bg" style="background-image:url(${H.env('arena-matchday')})"></div><span class="beam" style="left:10%"></span><span class="beam" style="left:55%;animation-delay:-4s"></span>
      <div class="ent-b-in rise">
        <div class="kicker" style="color:var(--club-2)">Säsongen 2026/27 · Vecka 46</div>
        <div class="ent-b-title">HANDBALL<br><span>MANAGER</span></div>
        <div class="ent-b-card">
          ${crest(me, 74)}
          <div class="grow"><div class="kicker">Din karriär</div><div class="disp it" style="font-size:38px">${me.name}</div><div class="muted">${H.manager.name} · 4:a i Handbollsligan · nästa: Kristianstad (tor)</div></div>
          <button class="cont-b big" data-act="toast" data-msg="Ljuset tänds… laddar Tumba">${icon('play', 22)}<span>Fortsätt<small>Matchdag om 2 dagar</small></span></button>
        </div>
        <div class="ent-b-saves">
          ${H.saves.slice(1).map((s) => `<button class="ent-b-save" data-act="toast" data-msg="Laddar ${esc(s.club.name)}">${crest(s.club, 30)}<span><b>${esc(s.club.short)}</b><small>${s.season} · ${s.pos}</small></span></button>`).join('')}
          <button class="ent-b-save new" data-act="toast" data-msg="Ny karriär">${icon('star', 22)}<span><b>Ny karriär</b><small>Välj din klubb</small></span></button>
        </div>
      </div></div>`,
    C: () => `<div class="ent-c">
      <div class="ent-c-cover">
        <div class="ent-c-mast"><span>HANDBALL MANAGER</span><span class="muted small">Nr 46 · ${H.date}</span></div>
        <div class="ent-c-photo" style="background-image:url(${H.env('arena-club')})"><div class="ent-c-cl">${crest(me, 64)}</div></div>
        <div class="ent-c-copy">
          <div class="kicker acc">Omgång 13 · Handbollsligan</div>
          <h1 class="ent-c-h">Tumba tar emot Kristianstad – kan fyran utmana toppen?</h1>
          <p class="lede">Efter fyra vinster på fem matcher står ${H.manager.name}s lag inför höstens största prov. Nyberg saknas, Sahlin är het.</p>
          <div class="row mt wrap"><button class="btn primary lg" data-act="toast" data-msg="Öppnar dagens tidning…">${icon('play', 16)} Fortsätt karriären</button><span class="muted small">Sparad för 2 timmar sedan</span></div>
        </div>
      </div>
      <aside class="ent-c-back">
        <div class="kicker">Tidigare nummer · dina karriärer</div>
        ${H.saves.map((s, i) => `<button class="ent-c-issue ${i === 0 ? 'on' : ''}" data-act="toast" data-msg="Laddar ${esc(s.club.name)}">${crest(s.club, 34)}<span class="grow"><b>${esc(s.club.name)}</b><span class="muted small" style="display:block">${s.season} · ${s.pos}</span></span><span class="small muted">${s.last}</span></button>`).join('')}
        <button class="btn mt" data-act="toast" data-msg="Ny karriär: välj land, division, klubb">+ Starta ny karriär</button>
        <div class="card mt"><div class="card-h"><span class="t">I detta nummer</span></div><div class="small"><div class="li">Sahlin: "Jag vill spela landslag"</div><div class="li">Ekonomin – 2,3 mkr i kassan</div><div class="li">Scouting: Öberg nära beslut</div></div></div>
      </aside></div>`,
  };

  /* =============================== DASHBOARD =============================== */
  const nextCard = (compact) => `<div class="card nm-card">
    <div class="row between"><span class="kicker">${nm.comp}</span><span class="chip">${nm.date} ${nm.time}</span></div>
    <div class="nm-vs"><div class="side">${crest(nm.home, compact ? 40 : 56)}<b>${nm.home.short}</b><span class="muted small">4:a · ${form('WWDWL')}</span></div><div class="vs">VS</div><div class="side">${crest(nm.away, compact ? 40 : 56)}<b>${nm.away.short}</b><span class="muted small">2:a · ${form('WWLWW')}</span></div></div>
    <div class="row between wrap"><span class="small muted">${nm.venue} · ${nm.att}</span><span class="row"><button class="btn sm" data-act="toast" data-msg="Motståndaranalys: Kristianstad">Motståndare</button><button class="btn sm primary" data-act="toast" data-msg="Matchförberedelse öppnas">Förbered</button></span></div></div>`;
  const tableSnippet = (n = 6) => `<table class="tbl"><thead><tr><th>#</th><th>Lag</th><th class="c hide-m">M</th><th class="c">+/-</th><th class="c">P</th></tr></thead><tbody>${H.table.slice(0, n).map((r) => `<tr class="${r.club.id === 'tum' ? 'me' : ''}"><td class="num">${r.pos}</td><td>${cchip(r.club, 16)}</td><td class="c num hide-m">${r.p}</td><td class="c num">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="c num b">${r.pts}</td></tr>`).join('')}</tbody></table>`;

  S.dashboard = {
    hub: 'today', sub: 'Översikt', title: 'Idag',
    A: () => `<div class="row between wrap mb"><div><div class="kicker">Tisdag 12 nov · vecka 46</div><h1 class="h2" style="margin-top:4px">God morgon, Erik. 4 saker behöver dig.</h1></div><div class="seg" data-group="dens"><button class="on" data-act="select" data-msg="Bekväm densitet">Bekväm</button><button data-act="select" data-msg="Kompakt densitet">Kompakt</button></div></div>
      <div class="cols-4 mb kpis">
        <div class="card tile"><span class="lbl">Tabellplacering</span><span class="val">4 <span class="muted" style="font-size:13px">/ 14</span></span><span class="row between"><span class="delta pos">▲ 2</span>${spark([8, 7, 6, 6, 5, 4], 80, 22)}</span></div>
        <div class="card tile"><span class="lbl">Truppens energi</span><span class="val">84%</span><span class="row between"><span class="delta warn">2 trötta</span>${spark([90, 88, 82, 86, 84], 80, 22, 'var(--warn)')}</span></div>
        <div class="card tile"><span class="lbl">Styrelsen</span><span class="val">71%</span><span class="row between"><span class="delta pos">▲ 4 Nöjd</span>${spark([60, 62, 65, 67, 71], 80, 22, 'var(--pos)')}</span></div>
        <div class="card tile"><span class="lbl">Lönebudget kvar</span><span class="val">420 tkr</span><span class="row between"><span class="delta muted">92 % använt</span>${spark([70, 78, 84, 90, 92], 80, 22, 'var(--muted)')}</span></div>
      </div>
      <div class="grid">
        <section class="card c8"><div class="card-h"><span class="t">Beslutskö</span><span class="more">Sortera: brådskande</span></div>
          ${H.decisions.map((d) => `<div class="decision dq"><span class="n">${d.n}</span><span><span class="t">${d.t}</span> ${d.urgent ? '<span class="chip neg">Före torsdag</span>' : ''}<div class="d">${d.d} · <span class="chip">${d.area}</span></div></span><span class="row"><button class="btn sm ghost" data-act="toast" data-msg="Delegerat till assistenten">Delegera</button><button class="btn sm primary" data-act="toast" data-msg="${esc(d.act)}">${d.act}</button></span></div>`).join('')}
          <div class="note-box mt">${icon('staff', 15)} Petra (ass. tränare) kan hantera punkt 4 automatiskt. <a class="acc b" href="#" data-act="toast" data-msg="Delegeringsregler öppnas">Ställ in delegering →</a></div>
        </section>
        <aside class="c4 stack">${nextCard(true)}<div class="card"><div class="card-h"><span class="t">Tabell</span><span class="more">Hela →</span></div>${tableSnippet(6)}</div></aside>
        <section class="card c6"><div class="card-h"><span class="t">Senaste resultat</span></div>${H.results.map((r) => `<div class="li"><span class="dot ${r.r === 'W' ? 'pos' : r.r === 'L' ? 'neg' : ''}"></span><span class="muted small" style="width:48px">${r.d}</span>${cchip(r.o, 16)}<span class="muted small">${r.h ? 'H' : 'B'}</span><span class="grow"></span><b class="num">${r.s}</b></div>`).join('')}</section>
        <section class="card c6"><div class="card-h"><span class="t">Spelare att hålla koll på</span></div>${[['p6', 'Form 8,5 · 3 raka MVP-nomineringar', 'pos'], ['p4', 'Energi 76 % · risk för överbelastning', 'warn'], ['p10', 'Moral låg · vill ha speltid', 'neg']].map(([id, t, c]) => `<div class="li">${pchip(H.player(id), 28)}<span class="grow"></span><span class="chip ${c}">${t}</span></div>`).join('')}</section>
      </div>`,
    B: () => `<section class="hero dsh-b-hero"><div class="photo-bg" style="background-image:url(${H.env('arena-matchday')})"></div><span class="beam" style="left:30%"></span><div class="in">
        <div class="kicker" style="color:var(--club-2)">Matchvecka · ${nm.comp}</div>
        <div class="dsh-b-vs"><div class="tm">${crest(nm.home, 92)}<span>${nm.home.short}</span></div><div class="mid"><div class="cd num">2<small>d</small> 06<small>h</small> 41<small>m</small></div><div class="muted">${nm.date} · ${nm.time} · ${nm.venue}</div><div class="chip solid" style="margin-top:8px">${nm.att}</div></div><div class="tm">${crest(nm.away, 92)}<span>${nm.away.short}</span></div></div>
        <div class="row wrap" style="justify-content:center"><button class="btn primary lg" data-act="toast" data-msg="Till omklädningsrummet: matchförberedelse">${icon('tactics', 16)} Förbered match</button><button class="btn lg" data-act="toast" data-msg="Scouting av Kristianstad">Motståndarrapport</button></div></div></section>
      <div class="ticker mt"><span><b>LIGAN</b>Sävehof vann tionde raka</span><span><b>SKADA</b>Nyberg borta 2–3 veckor</span><span><b>TRANSFER</b>Lugi avvisar bud på Öberg</span><span><b>TABELL</b>Tumba upp till 4:e plats</span><span><b>CUPEN</b>Lottning: OV Helsingborg hemma</span></div>
      <div class="kicker mt2">Storylines denna vecka</div>
      <div class="cols-3 mt dsh-b-stories rise">
        ${[[H.news[0], 'p6', 'I FORM'], [H.news[3], 'p7', 'SKADEORO'], [H.news[1], null, 'STYRELSEN']].map(([n, pid, tag]) => `<article class="card flush story-b"><div class="photo" style="height:150px;background-image:url(${n.img})"><span class="cap"><span class="chip solid">${tag}</span></span></div><div style="padding:14px"><div class="ed-h" style="font-size:20px">${esc(n.h)}</div><p class="muted small mt" style="margin-top:6px">${esc(n.lede)}</p>${pid ? `<div class="mt">${pchip(H.player(pid), 26)}</div>` : ''}</div></article>`).join('')}
      </div>
      <div class="grid mt2">
        <section class="c8"><div class="kicker">Dina beslut</div><div class="hscroll mt">${H.decisions.map((d) => `<div class="card dec-b"><div class="disp it acc" style="font-size:36px">0${d.n}</div><div class="b mt" style="margin-top:4px">${d.t}</div><div class="muted small" style="margin-top:4px">${d.d}</div><button class="btn sm primary mt" data-act="toast" data-msg="${esc(d.act)}">${d.act}</button></div>`).join('')}</div></section>
        <section class="card c4"><div class="card-h"><span class="t">Tabellen</span></div>${tableSnippet(5)}</section>
      </div>`,
    C: () => `<div class="paper-head"><span class="kicker">Tumba-bladet · Tisdag 12 november 2026</span><span class="kicker">Vecka 46 · Säsongen 2026/27</span></div>
      <div class="grid paper">
        <article class="c8 lead-c">
          <div class="photo" style="aspect-ratio:16/8;background-image:url(${H.news[0].img})"><span class="cap">Foto: Tumba Sporthall</span></div>
          <div class="kicker acc mt">${H.news[0].k}</div>
          <h1 class="ed-lead">${esc(H.news[0].h)}</h1>
          <p class="lede">${esc(H.news[0].lede)}</p>
          <div class="row mt wrap">${pchip(H.player('p6'), 30, 'Matchens lirare · 9 mål')}<span class="grow"></span><a class="acc b small" href="#" data-act="toast" data-msg="Matchrapport öppnas">Läs matchrapporten →</a></div>
        </article>
        <aside class="c4 stack">
          <div class="card"><div class="card-h"><span class="t">Ditt bord idag</span><span class="more">4</span></div>${H.decisions.map((d) => `<div class="decision"><span class="n">${d.n}</span><span><span class="t">${d.t}</span><div class="d">${d.d}</div></span><button class="btn sm" data-act="toast" data-msg="${esc(d.act)}">${d.act}</button></div>`).join('')}</div>
        </aside>
        <section class="c4 card"><div class="card-h"><span class="t">Nästa match</span></div><div class="row">${crest(nm.home, 36)}<span class="disp" style="font-size:22px">${nm.home.short} – ${nm.away.short}</span>${crest(nm.away, 36)}</div><div class="muted small mt" style="margin-top:6px">${nm.date} ${nm.time} · ${nm.venue}</div><div class="small mt" style="margin-top:6px">Kristianstad har gjort <b>38 %</b> av sina mål från nio meter. Petra föreslår 6-0.</div><button class="btn primary mt" data-act="toast" data-msg="Floodlight: matchförberedelse">Förbered matchen →</button></section>
        <section class="c4 card"><div class="card-h"><span class="t">Tabellen</span><span class="more">Ligan →</span></div>${tableSnippet(6)}</section>
        <section class="c4 card"><div class="card-h"><span class="t">Runt ligan</span></div>${H.news.slice(2).map((n) => `<div class="li" style="align-items:flex-start"><span class="grow"><span class="kicker">${n.k}</span><div class="ed b" style="font-size:15px;margin-top:2px">${esc(n.h)}</div></span></div>`).join('')}</section>
      </div>`,
  };

  /* =============================== CLUB HOME =============================== */
  const depts = [
    ['Truppen', 'team', 'Stark · 14 spelare', 'pos', 's1', 0.78], ['Personal', 'staff', '8 av 9 roller tillsatta', 'warn', 's8', 0.7], ['Ekonomi', 'money', '2,3 mkr · balanserad', 'pos', 's8', 0.66],
    ['Styrelsen', 'club', 'Förtroende 71 %', 'pos', null, 0.71], ['Anläggning', 'building', 'Tumba Sporthall · 1 800', '', null, 0.45], ['Akademi', 'star', '2 juniorer i A-truppen', 'pos', 's7', 0.6],
  ];
  S.club = {
    hub: 'club', sub: 'Klubbhuset', title: 'Klubben',
    A: () => `<div class="row between wrap mb"><div class="row">${crest(me, 48)}<div><h1 class="h2">${me.name}</h1><div class="muted small">Grundad 1957 · Tumba Sporthall · Handbollsligan · Rykte: Nationell</div></div></div><button class="btn" data-act="toast" data-msg="Klubbinställningar">Klubbprofil</button></div>
      <div class="cols-3 dept-a">${depts.map(([t, ic, s, c, st, v]) => `<button class="card dept" data-act="toast" data-msg="Öppnar ${t}"><div class="row between"><span class="row">${icon(ic)}<b>${t}</b></span><span class="dot ${c}"></span></div><div class="muted small mt" style="margin-top:6px">${s}</div><div class="mt" style="margin-top:10px">${K.bar(v * 100, 100, c)}</div><div class="row between mt" style="margin-top:10px"><span class="small muted">Ansvarig</span>${st ? schip(H.staff.find((x) => x.id === st), 22) : '<span class="small">Du</span>'}</div></button>`).join('')}</div>
      <div class="grid mt">
        <section class="card c7"><div class="card-h"><span class="t">Intäkter och kostnader (tkr / mån)</span><span class="legend"><span><i style="background:var(--data-1)"></i>Intäkter</span><span><i style="background:var(--data-5)"></i>Kostnader</span></span></div>${K.lineChart([{ v: H.finance.revenue, c: 'var(--data-1)' }, { v: H.finance.cost, c: 'var(--data-5)', dash: true }], 560, 170, ['Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov'])}</section>
        <section class="card c5"><div class="card-h"><span class="t">Styrelsens mål</span><span class="chip pos">Nöjd · 71 %</span></div>${H.board.objectives.map((o) => `<div class="li"><span class="grow"><b class="small">${o.t}</b><div style="margin-top:6px">${K.bar(o.v * 100, 100, o.v >= 1 ? 'pos' : '')}</div></span><span class="chip ${o.v >= 1 ? 'pos' : ''}">${o.s}</span></div>`).join('')}</section>
      </div>`,
    B: () => `<section class="hero club-b-hero"><div class="photo-bg" style="background-image:url(${H.env('arena-club')})"></div><div class="in"><div class="row">${crest(me, 84)}<div><div class="kicker" style="color:var(--club-2)">Sedan 1957 · Tumba</div><div class="h1">${me.name}</div><div class="row wrap mt"><span class="chip solid">Handbollsligan</span><span class="chip">${me.arena} · ${me.cap} platser</span><span class="chip">Styrelsen: Nöjd</span></div></div></div></div></section>
      <div class="kicker mt2">Klubbhuset · välj ett rum</div>
      <div class="rooms-b mt rise">${[['dressing-room', 'Omklädningsrummet', 'Truppen · moral hög', 'p5'], ['tactical-room', 'Taktikrummet', 'Petra: förslag 6-0', 's1'], ['training-hall', 'Träningshallen', 'Pass: försvar 15:00', 's3'], ['medical-room', 'Medicinskt', '1 skadad · 2 trötta', 's4'], ['scouting-office', 'Scoutkontoret', 'Ny rapport: Öberg', 's5'], ['boardroom', 'Styrelserummet', 'Halvårsavstämning', null], ['press-room', 'Presskonferens', 'Inför Kristianstad', null], ['manager-office', 'Ditt kontor', '3 olästa', null]].map(([env, t, s, who], i) => `<button class="room ${i === 0 ? 'big' : ''}" data-act="toast" data-msg="Går in i ${t}"><span class="photo-bg" style="background-image:url(${H.env(env)})"></span><span class="room-in"><span class="disp it" style="font-size:${i === 0 ? 30 : 20}px">${t}</span><span class="small">${s}</span>${who ? `<span class="room-who">${who.startsWith('s') ? avatar(Object.assign({ club: me }, H.staff.find((x) => x.id === who)), 30) : avatar(H.player(who), 30)}</span>` : ''}</span></button>`).join('')}</div>`,
    C: () => `<div class="club-c-head"><div class="club-c-stripe" style="background:linear-gradient(90deg, ${me.c1} 0 70%, ${me.c2} 70%)"></div><div class="row top wrap" style="gap:24px">${crest(me, 96)}<div class="grow"><div class="kicker acc">Klubben</div><h1 class="h1">${me.name}</h1><p class="lede" style="max-width:640px">En Stockholmsklubb byggd på egna juniorer och snabb handboll. Tillbaka i Handbollsligan efter avancemanget 2025 – nu fyra i tabellen.</p></div><div class="club-c-facts"><div><span class="kicker">Grundad</span><b>1957</b></div><div><span class="kicker">Arena</span><b>${me.arena}</b></div><div><span class="kicker">Kapacitet</span><b>${me.cap}</b></div><div><span class="kicker">Rykte</span><b>Nationell</b></div></div></div></div>
      <div class="kicker mt2">Klubbens historia</div>
      <div class="hist-strip mt">${[['1957', 'Grundas i Tumba'], ['1994', 'Första säsongen i högsta serien'], ['2011', 'Nedflyttning'], ['2023', 'Erik Sandell tar över'], ['2025', 'Vinner Allsvenskan', 1], ['2026', 'Tillbaka i Handbollsligan', 1]].map(([y, t, g]) => `<div class="hs ${g ? 'gold' : ''}"><span class="disp">${y}</span><span class="small">${t}</span></div>`).join('')}</div>
      <div class="grid mt2">
        <section class="c4 card"><div class="card-h"><span class="t">Styrelsen</span><span class="chip pos">Nöjd</span></div><div class="quote">"Vi ligger före plan, både sportsligt och ekonomiskt. Nu vill vi se en cupkvartsfinal."</div><div class="small muted mt">— Lena Wik, ordförande</div>${ring(71, 70, 'var(--pos)', '71%')}</section>
        <section class="c4 card"><div class="card-h"><span class="t">Avdelningarna</span></div>${depts.map(([t, ic, s, c]) => `<div class="li">${icon(ic, 16)}<span class="grow"><b class="small">${t}</b><div class="meta">${s}</div></span><span class="dot ${c}"></span></div>`).join('')}</section>
        <section class="c4 card"><div class="card-h"><span class="t">Klubbens personer</span></div>${H.staff.slice(0, 5).map((s) => `<div class="li">${schip(s, 30)}</div>`).join('')}<a class="acc small b" href="#" data-act="toast" data-msg="Organisationsschema">Hela organisationen →</a></section>
        <section class="c12 card"><div class="card-h"><span class="t">Publik & ekonomi denna säsong</span></div><div class="cols-3"><div class="tile"><span class="lbl">Snittpublik</span><span class="val">1 663</span><span class="delta pos">▲ 22 % mot förra säsongen</span>${spark(H.finance.attendance, 200, 34, 'var(--pos)')}</div><div class="tile"><span class="lbl">Kassa</span><span class="val">2,3 mkr</span><span class="delta muted">Budget 9,8 mkr</span></div><div class="tile"><span class="lbl">Lönebudget använd</span><span class="val">92 %</span>${K.bar(92, 100, 'warn')}</div></div></section>
      </div>`,
  };
})();
