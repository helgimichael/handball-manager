/* HM Experience 2027 — realistic sample data for prototypes (fictional players & staff). */
(function () {
  const ENV = '../../apps/game/components/clubhq/assets/environments/';
  const env = (id) => ENV + 'env-' + id + '-960.webp';

  const clubs = [
    { id: 'tum', name: 'IFK Tumba HK', short: 'Tumba', abbr: 'IT', c1: '#14284b', c2: '#cfe3ff', arena: 'Tumba Sporthall', cap: 1800 },
    { id: 'sav', name: 'IK Sävehof', short: 'Sävehof', abbr: 'IKS', c1: '#111111', c2: '#f2c200' },
    { id: 'kri', name: 'IFK Kristianstad', short: 'Kristianstad', abbr: 'IFK', c1: '#0d3c8c', c2: '#ffffff' },
    { id: 'yst', name: 'Ystads IF HF', short: 'Ystads IF', abbr: 'YIF', c1: '#c4161c', c2: '#ffffff' },
    { id: 'mal', name: 'HK Malmö', short: 'Malmö', abbr: 'HKM', c1: '#5bb5e8', c2: '#ffffff' },
    { id: 'ali', name: 'Alingsås HK', short: 'Alingsås', abbr: 'AHK', c1: '#e30613', c2: '#1d1d1b' },
    { id: 'lug', name: 'Lugi HF', short: 'Lugi', abbr: 'LUG', c1: '#0a7a3d', c2: '#ffffff' },
    { id: 'sko', name: 'IFK Skövde HK', short: 'Skövde', abbr: 'SKÖ', c1: '#0b2a5b', c2: '#e2e2e2' },
    { id: 'red', name: 'Redbergslids IK', short: 'Redbergslid', abbr: 'RIK', c1: '#8b0d1a', c2: '#ffffff' },
    { id: 'ham', name: 'Hammarby IF HF', short: 'Hammarby', abbr: 'HIF', c1: '#00843d', c2: '#ffffff' },
    { id: 'guif', name: 'Eskilstuna Guif', short: 'Guif', abbr: 'GUIF', c1: '#e2001a', c2: '#ffffff' },
    { id: 'ifky', name: 'IFK Ystad HK', short: 'IFK Ystad', abbr: 'IFKY', c1: '#00398a', c2: '#ffd400' },
    { id: 'ovh', name: 'OV Helsingborg', short: 'OV Helsingborg', abbr: 'OVH', c1: '#d40f14', c2: '#0c2340' },
    { id: 'ara', name: 'HK Aranäs', short: 'Aranäs', abbr: 'ARA', c1: '#1a5fa8', c2: '#ffffff' },
  ];
  // Sample club ids → game registry ids (Club Identity Registry; the game's real club ids are preserved there).
  const REG = { tum: 'swe2-tumba', sav: 'se_club_ik_savehof', kri: 'se_club_ifk_kristianstad', yst: 'se_club_ystads_if_hf', mal: 'se_club_hk_malmo', ali: 'se_club_alingsas_hk', lug: 'se_club_lugi_hf', sko: 'se_club_ifk_skovde_hk', red: 'swe2-redbergslid', ham: 'se_club_hammarby_if_hf', guif: 'swe2-guif', ifky: 'swe2-ystad2', ovh: 'se_club_ov_helsingborg', ara: 'swe2-aranas' };
  // Crest colours come ONLY from the registry's home-shirt colours (single source). Clubs whose kit is not
  // verified keep a neutral placeholder crest so no colour is invented.
  const R = (window.HM_CLUB_REGISTRY && window.HM_CLUB_REGISTRY.clubs) || [];
  const NEUTRAL = { c1: '#3a4250', c2: '#c9d1dc' };
  const hasKit = (r) => r && r.p && ['VERIFIED', 'PROBABLE', 'UNCERTAIN'].includes(r.status);
  const trimFor = (r) => { const cands = [r.s, r.t].filter(Boolean).filter((h) => h.toUpperCase() !== r.p.toUpperCase()); return cands[0] || (r.p.toUpperCase() === '#FFFFFF' ? '#111111' : '#FFFFFF'); };
  clubs.forEach((c) => {
    c.regId = REG[c.id];
    const r = R.find((x) => x.id === c.regId);
    if (hasKit(r)) Object.assign(c, { c1: r.p, c2: trimFor(r), kitStatus: r.status }); else Object.assign(c, NEUTRAL, { kitStatus: r ? r.status : 'NOT_RESEARCHED' });
  });
  const club = (id) => clubs.find((c) => c.id === id);

  // standings: [clubId, P, W, D, L, GF, GA, form]
  const table = [
    ['sav', 12, 10, 1, 1, 398, 331, 'WWWDW'], ['kri', 12, 9, 1, 2, 387, 339, 'WWLWW'], ['yst', 12, 8, 1, 3, 372, 348, 'WLWWW'],
    ['tum', 12, 7, 2, 3, 361, 344, 'WWDWL'], ['ali', 12, 7, 0, 5, 350, 341, 'LWWLW'], ['mal', 12, 6, 2, 4, 344, 337, 'DWLWW'],
    ['lug', 12, 6, 1, 5, 339, 340, 'WLLWD'], ['sko', 12, 5, 2, 5, 331, 333, 'LDWWL'], ['red', 12, 5, 0, 7, 329, 352, 'LLWLW'],
    ['ham', 12, 4, 2, 6, 322, 340, 'DLLWL'], ['guif', 12, 4, 1, 7, 318, 347, 'WLLLD'], ['ifky', 12, 3, 2, 7, 315, 349, 'LDLWL'],
    ['ovh', 12, 2, 2, 8, 309, 361, 'LLDLL'], ['ara', 12, 1, 1, 10, 298, 371, 'LLLLD'],
  ].map(([id, p, w, d, l, gf, ga, form], i) => ({ pos: i + 1, club: club(id), p, w, d, l, gf, ga, gd: gf - ga, pts: w * 2 + d, form }));

  const POS = { MV: 'Målvakt', VS: 'Vänstersexa', VN: 'Vänsternio', MN: 'Mittnia', HN: 'Högernio', HS: 'Högersexa', M: 'Mittsexa' };
  // attrs order: Teknik(avslut, skott, passning, bollkontroll, genombrott) Spelförst(spelläsning, beslut, överblick)
  // Fysik(snabbhet, explosivitet, uthållighet, styrka) Mental(arbetsvilja, ledarskap, nerver) Försvar(markering, blockering, positionering)
  const players = [
    { id: 'p1', no: 1, first: 'Viktor', last: 'Holmqvist', pos: 'MV', age: 29, ca: 76, pa: 78, val: 520000, wage: 34000, until: '2028', form: [7.1, 7.6, 6.8, 8.2, 7.4], energy: 92, morale: 'Hög', skin: 1, hair: 2, status: 'ok', goals: 0, apps: 12, rating: 7.4, saves: 38 },
    { id: 'p2', no: 16, first: 'Albin', last: 'Ek', pos: 'MV', age: 21, ca: 61, pa: 79, val: 210000, wage: 14000, until: '2027', form: [6.4, 6.9, 7.0], energy: 100, morale: 'Bra', skin: 0, hair: 4, status: 'ok', goals: 0, apps: 5, rating: 6.8, saves: 33 },
    { id: 'p3', no: 7, first: 'Oskar', last: 'Lindqvist', pos: 'VS', age: 24, ca: 71, pa: 80, val: 410000, wage: 24000, until: '2027', form: [7.8, 8.1, 7.2, 7.9, 8.4], energy: 81, morale: 'Hög', skin: 0, hair: 1, status: 'ok', goals: 58, apps: 12, rating: 7.6 },
    { id: 'p4', no: 23, first: 'Simon', last: 'Axelsson', pos: 'HS', age: 28, ca: 73, pa: 74, val: 380000, wage: 28000, until: '2027', form: [7.0, 6.6, 7.3, 7.1, 6.9], energy: 76, morale: 'Bra', skin: 1, hair: 0, status: 'tired', goals: 47, apps: 12, rating: 7.1 },
    { id: 'p5', no: 10, first: 'Elias', last: 'Bergström', pos: 'MN', age: 26, ca: 78, pa: 81, val: 690000, wage: 41000, until: '2029', form: [8.2, 7.9, 8.6, 7.4, 8.0], energy: 88, morale: 'Mycket hög', skin: 2, hair: 3, status: 'ok', goals: 51, apps: 12, rating: 8.0, captain: true },
    { id: 'p6', no: 33, first: 'Jonathan', last: 'Sahlin', pos: 'VN', age: 22, ca: 69, pa: 84, val: 460000, wage: 19000, until: '2028', form: [7.5, 7.9, 8.3, 7.7, 8.5], energy: 90, morale: 'Hög', skin: 0, hair: 2, status: 'ok', goals: 63, apps: 12, rating: 7.9, wonderkid: true },
    { id: 'p7', no: 19, first: 'Marcus', last: 'Nyberg', pos: 'HN', age: 31, ca: 74, pa: 74, val: 290000, wage: 33000, until: '2027', form: [6.8, 7.2, 6.4, 7.0, 6.6], energy: 64, morale: 'Neutral', skin: 1, hair: 5, status: 'injured', injury: 'Fotledsstukning · 2–3 v', goals: 39, apps: 10, rating: 6.9 },
    { id: 'p8', no: 4, first: 'Karl', last: 'Wallin', pos: 'M', age: 27, ca: 72, pa: 75, val: 330000, wage: 26000, until: '2028', form: [7.3, 7.0, 7.7, 7.2, 7.5], energy: 84, morale: 'Bra', skin: 3, hair: 0, status: 'ok', goals: 34, apps: 12, rating: 7.3 },
    { id: 'p9', no: 11, first: 'Hugo', last: 'Strand', pos: 'HS', age: 19, ca: 58, pa: 82, val: 180000, wage: 9000, until: '2029', form: [6.9, 7.4], energy: 100, morale: 'Hög', skin: 0, hair: 1, status: 'ok', goals: 9, apps: 6, rating: 7.0, youth: true },
    { id: 'p10', no: 25, first: 'Anton', last: 'Kjellberg', pos: 'VN', age: 30, ca: 70, pa: 70, val: 240000, wage: 27000, until: '2027', form: [6.7, 6.9, 7.1], energy: 87, morale: 'Låg', skin: 1, hair: 3, status: 'unhappy', goals: 21, apps: 9, rating: 6.8 },
    { id: 'p11', no: 8, first: 'Noah', last: 'Pettersson', pos: 'M', age: 23, ca: 66, pa: 76, val: 220000, wage: 15000, until: '2028', form: [7.0, 6.7, 7.2], energy: 95, morale: 'Bra', skin: 2, hair: 4, status: 'ok', goals: 18, apps: 11, rating: 7.0 },
    { id: 'p12', no: 3, first: 'Filip', last: 'Westberg', pos: 'VS', age: 33, ca: 65, pa: 65, val: 90000, wage: 21000, until: '2027', form: [6.5, 6.8], energy: 70, morale: 'Bra', skin: 0, hair: 5, status: 'ok', goals: 14, apps: 8, rating: 6.7 },
    { id: 'p13', no: 21, first: 'Leo', last: 'Mårtensson', pos: 'MN', age: 20, ca: 60, pa: 78, val: 150000, wage: 8000, until: '2028', form: [6.8], energy: 100, morale: 'Hög', skin: 1, hair: 2, status: 'ok', goals: 7, apps: 7, rating: 6.9, youth: true },
    { id: 'p14', no: 14, first: 'Isak', last: 'Dahlgren', pos: 'HN', age: 25, ca: 67, pa: 72, val: 200000, wage: 18000, until: '2027', form: [7.1, 7.4, 6.9], energy: 91, morale: 'Bra', skin: 0, hair: 0, status: 'ok', goals: 26, apps: 12, rating: 7.1 },
  ];
  const ATTR_GROUPS = [
    { g: 'Teknik', k: ['Avslut', 'Skottstyrka', 'Passning', 'Bollkontroll', 'Genombrott', 'Finter'] },
    { g: 'Spelförståelse', k: ['Spelläsning', 'Beslutsfattande', 'Överblick', 'Tempokontroll'] },
    { g: 'Fysik', k: ['Snabbhet', 'Explosivitet', 'Uthållighet', 'Styrka', 'Hopp'] },
    { g: 'Mentalt', k: ['Arbetsvilja', 'Ledarskap', 'Nerver', 'Koncentration'] },
    { g: 'Försvar', k: ['Markering', 'Blockering', 'Positionering', 'Duellspel'] },
  ];
  // deterministic attribute generator
  function seeded(s) { let x = 0; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
  players.forEach((p) => {
    const r = seeded(p.id + p.last); const base = p.ca / 5.2;
    p.attrs = {}; p.potentialAttrs = {}; p.delta = {};
    ATTR_GROUPS.forEach((g) => g.k.forEach((k) => {
      let v = Math.round(base + (r() - 0.45) * 7);
      if (p.pos === 'MV' && g.g === 'Teknik') v -= 3;
      if ((p.pos === 'VS' || p.pos === 'HS') && (k === 'Snabbhet' || k === 'Explosivitet')) v += 3;
      if (p.pos === 'M' && (k === 'Styrka' || k === 'Blockering')) v += 3;
      if (p.pos === 'MN' && (k === 'Överblick' || k === 'Passning')) v += 3;
      v = Math.max(4, Math.min(20, v));
      p.attrs[k] = v;
      p.potentialAttrs[k] = Math.min(20, v + Math.round((p.pa - p.ca) / 5 * r() * 1.4));
      const d = r(); p.delta[k] = d > 0.86 ? 1 : d < 0.06 ? -1 : 0;
    }));
    p.name = p.first + ' ' + p.last;
    p.posLabel = POS[p.pos];
    p.history = [
      { s: '2026/27', club: 'Tumba', apps: p.apps, g: p.goals, r: p.rating },
      { s: '2025/26', club: p.age < 21 ? 'Tumba U19' : 'Tumba', apps: 26, g: Math.round(p.goals * 1.8), r: +(p.rating - 0.2).toFixed(1) },
      { s: '2024/25', club: p.age < 22 ? 'Tumba U19' : 'Hammarby', apps: 22, g: Math.round(p.goals * 1.4), r: +(p.rating - 0.4).toFixed(1) },
    ];
    p.dev = [p.ca - 9, p.ca - 6, p.ca - 4, p.ca - 2, p.ca].map((v) => Math.max(40, v));
  });
  const player = (id) => players.find((p) => p.id === id);

  const staff = [
    { id: 's1', name: 'Petra Lundgren', role: 'Assisterande tränare', area: 'Taktik & träning', rep: 4, skin: 0, hair: 6, female: true, rating: 15, focus: 'Anfallsspel', mood: 'Engagerad', resp: ['Veckoplan', 'Motståndaranalys'] },
    { id: 's2', name: 'Johan Ekdahl', role: 'Målvaktstränare', area: 'Målvakter', rep: 3, skin: 1, hair: 5, rating: 14, focus: 'Reaktion', mood: 'Nöjd', resp: ['Målvaktsträning'] },
    { id: 's3', name: 'Sara Holm', role: 'Fystränare', area: 'Fysik & belastning', rep: 3, skin: 0, hair: 7, female: true, rating: 16, focus: 'Återhämtning', mood: 'Orolig', resp: ['Belastningsstyrning', 'Rehab-plan'] },
    { id: 's4', name: 'Ali Rahimi', role: 'Fysioterapeut', area: 'Medicinskt', rep: 3, skin: 2, hair: 0, rating: 15, focus: 'Skadeprevention', mood: 'Nöjd', resp: ['Skadebehandling'] },
    { id: 's5', name: 'Mattias Berg', role: 'Chefsscout', area: 'Scouting', rep: 3, skin: 1, hair: 3, rating: 13, focus: 'Norden U23', mood: 'Engagerad', resp: ['Scoutuppdrag', 'Bevakningslista'] },
    { id: 's6', name: 'Linnea Sjö', role: 'Analytiker', area: 'Video & data', rep: 2, skin: 0, hair: 8, female: true, rating: 14, focus: 'Motståndare', mood: 'Nöjd', resp: ['Matchrapport'] },
    { id: 's7', name: 'Per-Olof Åkesson', role: 'Ungdomsansvarig', area: 'Akademi', rep: 3, skin: 1, hair: 5, rating: 12, focus: 'U19', mood: 'Neutral', resp: ['Akademi'] },
    { id: 's8', name: 'Kristina Falk', role: 'Sportchef', area: 'Ledning', rep: 4, skin: 0, hair: 6, female: true, rating: 15, focus: 'Kontrakt', mood: 'Nöjd', resp: ['Kontraktsförhandling'] },
  ];

  const manager = { name: 'Erik Sandell', age: 41, rep: 'Nationell', repScore: 62, style: 'Offensiv · snabba omställningar', seasons: 3, record: { w: 61, d: 9, l: 32 }, trophies: ['Allsvenskan 2024/25', 'Avancemang till Handbollsligan'], conf: 71, skin: 1, hair: 3 };

  const nextMatch = { id: 'f13', date: 'Tor 14 nov', time: '19:00', home: club('tum'), away: club('kri'), comp: 'Handbollsligan · Omg 13', venue: 'Tumba Sporthall', att: 'Slutsålt · 1 800', odds: 'Kristianstad favorit' };
  const lastMatch = {
    id: 'f12', date: 'Sön 10 nov', home: club('ali'), away: club('tum'), hs: 27, as: 29, comp: 'Handbollsligan · Omg 12',
    motm: 'p6', events: [
      { m: 3, t: 'goal', side: 'a', txt: 'Sahlin, 9 m' }, { m: 11, t: 'save', side: 'a', txt: 'Holmqvist räddar straff' }, { m: 19, t: 'susp', side: 'a', txt: 'Wallin 2 min' },
      { m: 30, t: 'ht', txt: 'Halvtid 13–14' }, { m: 41, t: 'to', side: 'a', txt: 'Timeout Tumba' }, { m: 52, t: 'goal', side: 'a', txt: 'Lindqvist, kontring' }, { m: 59, t: 'goal', side: 'a', txt: 'Bergström 27–29' },
    ],
    stats: [['Skott', 49, 51], ['Skotteffektivitet %', 55, 57], ['Räddningar', 11, 14], ['Tekniska fel', 9, 7], ['Utvisningar', 3, 2], ['Kontringsmål', 4, 7], ['7 m-mål', '4/5', '3/4']],
    momentum: [0, 1, 2, 1, -1, -2, -1, 0, 1, 2, 3, 2, 1, 0, -1, -1, 0, 1, 2, 3, 2, 3, 4, 3, 2],
    ratings: [['p6', 8.5], ['p1', 8.2], ['p3', 8.4], ['p5', 8.0], ['p8', 7.5], ['p4', 6.9], ['p14', 6.8]],
  };
  const fixtures = [
    { d: 'Tor 14 nov', o: club('kri'), h: true, comp: 'Liga', note: 'Omg 13' },
    { d: 'Sön 17 nov', o: club('ham'), h: false, comp: 'Liga', note: 'Omg 14' },
    { d: 'Ons 20 nov', o: club('ovh'), h: true, comp: 'Cupen', note: 'Åttondel' },
    { d: 'Sön 24 nov', o: club('sav'), h: false, comp: 'Liga', note: 'Omg 15' },
    { d: 'Tor 28 nov', o: club('lug'), h: true, comp: 'Liga', note: 'Omg 16' },
  ];
  const results = [
    { d: '10 nov', o: club('ali'), h: false, s: '29–27', r: 'W' }, { d: '6 nov', o: club('red'), h: true, s: '31–26', r: 'W' },
    { d: '2 nov', o: club('mal'), h: false, s: '28–28', r: 'D' }, { d: '29 okt', o: club('guif'), h: true, s: '33–25', r: 'W' }, { d: '25 okt', o: club('yst'), h: false, s: '24–27', r: 'L' },
  ];
  const week = [
    { d: 'Mån 11', e: 'Återhämtning', kind: 'rest', past: true },
    { d: 'Tis 12', e: 'Taktik · försvar 6-0', kind: 'train', today: true },
    { d: 'Ons 13', e: 'Matchförberedelse', kind: 'train' },
    { d: 'Tor 14', e: 'Tumba – Kristianstad', kind: 'match' },
    { d: 'Fre 15', e: 'Vila', kind: 'rest' },
    { d: 'Lör 16', e: 'Lätt pass · resa', kind: 'travel' },
    { d: 'Sön 17', e: 'Hammarby – Tumba', kind: 'match' },
  ];
  const decisions = [
    { n: 1, t: 'Välj startsju mot Kristianstad', d: 'Nyberg (HN) skadad · Axelsson trött 76 %', act: 'Matchtrupp', urgent: true, area: 'Match' },
    { n: 2, t: 'Kjellberg vill prata om speltid', d: 'Moral låg · har bett om möte', act: 'Svara', area: 'Spelare' },
    { n: 3, t: 'Scoutrapport: Rasmus Öberg (VN, 20)', d: 'Lugi · bedömd potential ★★★★', act: 'Läs rapport', area: 'Scouting' },
    { n: 4, t: 'Petra föreslår veckoplan', d: 'Fokus 6-0-försvar · belastning medel', act: 'Godkänn', area: 'Träning' },
  ];
  const news = [
    { k: 'Matchrapport', h: 'Sahlin sänkte Alingsås – Tumba klättrar till fjärde plats', lede: 'Tjugotvååringen gjorde nio mål och styrde anfallet när Tumba vände 13–14 till 29–27 i Alingsås.', img: env('arena-matchday'), t: '10 nov' },
    { k: 'Klubben', h: 'Styrelsen nöjd efter höstens start', lede: 'Ordförande Lena Wik: "Vi ligger före plan, både sportsligt och ekonomiskt."', img: env('boardroom'), t: '9 nov' },
    { k: 'Ligan', h: 'Sävehof fortsätter dominera – tionde segern', lede: 'Serieledarna är obesegrade på hemmaplan.', img: env('arena-club'), t: '10 nov' },
    { k: 'Medicinskt', h: 'Nyberg borta två till tre veckor', lede: 'Högernian stukade fotleden i söndagens match.', img: env('medical-room'), t: '11 nov' },
    { k: 'Transfer', h: 'Lugi avvisar bud på unga Öberg', lede: 'Enligt uppgifter har två klubbar visat intresse för vänsternian.', img: env('scouting-office'), t: '11 nov' },
  ];
  const inbox = [
    { id: 'm1', from: 'Petra Lundgren', role: 'Ass. tränare', cat: 'Träning', subj: 'Förslag: veckoplan v.46', body: 'Jag föreslår att vi lägger tisdagen på 6-0-försvaret – Kristianstad har gjort 38 % av sina mål från nio meter. Belastningen hålls på medel inför dubbelmatchen.', t: '08:12', unread: true, action: 'Godkänn plan', staff: 's1' },
    { id: 'm2', from: 'Anton Kjellberg', role: 'Spelare', cat: 'Spelare', subj: 'Kan vi prata om min roll?', body: 'Jag har fått mindre speltid än jag hoppades. Jag vill gärna förstå hur du ser på mig resten av säsongen.', t: 'igår', unread: true, action: 'Boka samtal', player: 'p10' },
    { id: 'm3', from: 'Mattias Berg', role: 'Chefsscout', cat: 'Scouting', subj: 'Rapport klar: Rasmus Öberg', body: 'Explosiv vänsternia med bra skott från distans. Försvarsspelet behöver utvecklas. Lugi kräver troligen 350–450 tkr.', t: 'igår', unread: true, action: 'Öppna rapport', staff: 's5' },
    { id: 'm4', from: 'Styrelsen', role: 'Ordförande', cat: 'Styrelse', subj: 'Halvårsavstämning', body: 'Styrelsen är nöjd med placeringen. Målet om topp sex står kvar.', t: '9 nov', unread: false },
    { id: 'm5', from: 'Handbollsligan', role: 'Liga', cat: 'Tävling', subj: 'Matchtid ändrad: Hammarby – Tumba', body: 'Matchen flyttas till 15:00 på grund av TV-sändning.', t: '8 nov', unread: false },
  ];
  const targets = [
    { id: 't1', name: 'Rasmus Öberg', pos: 'VN', age: 20, club: club('lug'), ca: 66, pa: 83, val: 400000, know: 82, scout: 's5', fit: 88, wage: 16000, status: 'Rapport klar', skin: 0, hair: 1 },
    { id: 't2', name: 'Daniel Fors', pos: 'HN', age: 26, club: club('ham'), ca: 72, pa: 75, val: 350000, know: 64, scout: 's5', fit: 81, wage: 25000, status: 'Bevakas', skin: 1, hair: 3 },
    { id: 't3', name: 'Mikkel Sørensen', pos: 'M', age: 24, club: { name: 'Ribe-Esbjerg HH', short: 'Ribe-Esbjerg', abbr: 'REH', c1: '#003a70', c2: '#ffffff' }, ca: 70, pa: 78, val: 520000, know: 41, scout: 's5', fit: 74, wage: 30000, status: 'Scout utsänd', skin: 0, hair: 2 },
    { id: 't4', name: 'Theo Andersson', pos: 'HS', age: 18, club: club('ifky'), ca: 55, pa: 81, val: 120000, know: 55, scout: 's5', fit: 70, wage: 7000, status: 'Bevakas', skin: 1, hair: 0 },
    { id: 't5', name: 'Gustav Blom', pos: 'MV', age: 27, club: club('ovh'), ca: 71, pa: 72, val: 260000, know: 90, scout: 's5', fit: 66, wage: 24000, status: 'Kontrakt löper ut', skin: 0, hair: 4 },
    { id: 't6', name: 'Emil Hult', pos: 'VS', age: 23, club: club('guif'), ca: 67, pa: 74, val: 180000, know: 73, scout: 's5', fit: 69, wage: 15000, status: 'Bevakas', skin: 2, hair: 5 },
  ];
  const finance = { balance: 2340000, budget: 9800000, wageBudget: 5600000, wageUsed: 5180000, transferBudget: 450000, revenue: [610, 590, 720, 680, 810, 760], cost: [640, 600, 650, 690, 700, 710], attendance: [1420, 1510, 1800, 1650, 1800, 1800] };
  const board = { conf: 71, mood: 'Nöjd', objectives: [{ t: 'Sluta topp sex i ligan', s: 'På väg', v: 0.8 }, { t: 'Gå till kvartsfinal i Svenska Cupen', s: 'Pågår', v: 0.5 }, { t: 'Lönekostnad under budget', s: 'På väg', v: 0.92 }, { t: 'Två egna juniorer i A-truppen', s: 'Uppnått', v: 1 }] };
  const career = [
    { y: '2021', t: 'Tränare, Tumba U19', k: 'start' },
    { y: '2023', t: 'Huvudtränare, IFK Tumba HK (Allsvenskan)', k: 'job' },
    { y: '2025', t: 'Vann Allsvenskan · avancemang', k: 'trophy' },
    { y: '2026', t: 'Debut i Handbollsligan', k: 'milestone' },
  ];
  const saves = [
    { club: club('tum'), mgr: 'Erik Sandell', season: '2026/27', when: 'Vecka 46 · tis 12 nov', pos: '4:a i Handbollsligan', last: 'Spelat för 2 timmar sedan', next: 'Tumba – Kristianstad (tor)' },
    { club: club('red'), mgr: 'Erik Sandell', season: '2028/29', when: 'Vecka 7 · lör 15 feb', pos: '2:a i Handbollsligan', last: '3 dagar sedan', next: 'Cupsemifinal' },
    { club: club('ara'), mgr: 'Anna Rask', season: '2026/27', when: 'Vecka 38', pos: '11:a i Allsvenskan', last: '2 veckor sedan', next: 'Ny säsong' },
  ];
  const training = {
    focus: 'Försvar 6-0', load: 'Medel', proposal: 's1',
    plan: [
      { d: 'Mån', s: ['Återhämtning', 'Video'], l: 1 }, { d: 'Tis', s: ['6-0 försvar', 'Kontringar'], l: 3 }, { d: 'Ons', s: ['Matchförberedelse', 'Fasta situationer'], l: 2 },
      { d: 'Tor', s: ['MATCH: Kristianstad'], l: 4, match: true }, { d: 'Fre', s: ['Vila'], l: 0 }, { d: 'Lör', s: ['Lätt pass', 'Resa'], l: 1 }, { d: 'Sön', s: ['MATCH: Hammarby'], l: 4, match: true },
    ],
    groups: [['Målvakter', 's2', 'Reaktion & positionering'], ['Kanter', 's1', 'Kontringsavslut'], ['Nior', 's1', 'Distansskott'], ['Mittsexor', 's3', 'Styrka & blockering']],
  };
  const comps = [
    { id: 'hbl', name: 'Handbollsligan', kind: 'Liga', pos: 4, of: 14, round: '12 / 26', c: '#0f1b2d' },
    { id: 'cup', name: 'Svenska Cupen', kind: 'Cup', stage: 'Åttondelsfinal', c: '#c84320' },
  ];
  const cupBracket = [
    ['Tumba', 'OV Helsingborg'], ['Sävehof', 'Aranäs'], ['Kristianstad', 'Guif'], ['Ystads IF', 'Hammarby'],
    ['Malmö', 'Skövde'], ['Lugi', 'Redbergslid'], ['Alingsås', 'IFK Ystad'], ['Önnered', 'Vinslöv'],
  ];

  window.HM = { clubs, club, table, players, player, ATTR_GROUPS, POS, staff, manager, nextMatch, lastMatch, fixtures, results, week, decisions, news, inbox, targets, finance, board, career, saves, training, comps, cupBracket, env, me: club('tum'), date: 'Tisdag 12 november 2026', season: '2026/27', weekNo: 46 };
})();
