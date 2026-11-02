// HM-ALPHA3-M08 (8E): national-team windows, simplified. The calendar is
// the real one, verified 2026-11-02 against the federations:
// - Men's EHF EURO 2028 Qualifiers, group 8 (Sweden, North Macedonia,
//   Greece, Luxembourg): rounds 1–2 on 4–5 and 7–8 November 2026, 3–4 on
//   10–11 and 13–14 March 2027, 5–6 on 5–6 and 9 May 2027
//   (eurohandball.com, draw of the qualifiers; fixture order per the
//   published group schedule).
// - 30th IHF Men's World Championship, Germany, 13–31 January 2027; Sweden
//   in group E in Kiel with Norway, Greece and Qatar (ihf.info, draw in
//   Munich 10 June 2026).
// - Men's EHF EURO 2028, Spain/Portugal/Switzerland, 13–30 January 2028
//   (ehfeuro.eurohandball.com) -- Sweden must qualify.
// Later windows are not yet published and are not invented. The results
// are the game's own simulation, labelled as such; the squad is called
// from the Swedish players in the game world (the rest of the real squad
// plays abroad and is not modelled). Effects reach only the manager's own
// players: a morale lift on selection, tiredness and a match-like injury
// risk on return.
import type { CareerEvent } from "../career/careerEvents";
import { buildClubEvent } from "../career/careerEvents";
import { getCareerClubSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import { applyMatchInjuryResolution, type MatchExposureForInjury } from "../medical/injuryIntegration";
import { addMoraleShock } from "../players/morale";
import { addDaysIso, caOf, hash } from "../players/dynamicsState";
import { publish } from "../media/newsEngine";
import { CLUB_MEDIA } from "../media/registry";

type Emit = (e: CareerEvent) => void;

export const SWEDEN = "Sverige";

export interface NationalMatch { date: string; dateLabel: string; home: string; away: string; venue?: string }
export interface NationalWindow {
  id: string;
  kind: "QUALIFIER" | "TOURNAMENT";
  title: string;
  competition: string;
  /** The break in the club calendar: the squad gathers on `start`, is released after `end`. */
  start: string;
  end: string;
  /** Qualifiers: every match in the group in this window (Sweden's and the others'). */
  matches?: NationalMatch[];
  /** Tournaments: Sweden's preliminary group, when drawn. */
  group?: { name: string; venue: string; opponents: string[] };
  tournament?: { start: string; end: string };
  /** A tournament Sweden has to qualify for first. */
  requires?: string;
  source: string;
}

const EC28Q_SOURCE = "EHF: Men's EHF EURO 2028 Qualifiers, grupp 8";
export const NATIONAL_WINDOWS: readonly NationalWindow[] = [
  { id: "ec28q-r12", kind: "QUALIFIER", title: "EM-kval, omgång 1–2", competition: "EHF EURO 2028-kvalet, grupp 8", start: "2026-11-02", end: "2026-11-08", source: EC28Q_SOURCE, matches: [
    { date: "2026-11-04", dateLabel: "4 nov", home: "Nordmakedonien", away: "Luxemburg", venue: "Skopje" },
    { date: "2026-11-05", dateLabel: "5 nov", home: SWEDEN, away: "Grekland", venue: "Växjö" },
    { date: "2026-11-08", dateLabel: "8 nov", home: "Luxemburg", away: SWEDEN, venue: "Luxemburg" },
    { date: "2026-11-08", dateLabel: "8 nov", home: "Grekland", away: "Nordmakedonien", venue: "Chalkida" },
  ] },
  { id: "wc27", kind: "TOURNAMENT", title: "VM 2027 i Tyskland", competition: "IHF:s VM för herrar 2027", start: "2027-01-02", end: "2027-01-31", source: "IHF: 2027 IHF Men's World Championship, lottning 10 juni 2026", group: { name: "Grupp E", venue: "Kiel", opponents: ["Norge", "Grekland", "Qatar"] }, tournament: { start: "2027-01-13", end: "2027-01-31" } },
  { id: "ec28q-r34", kind: "QUALIFIER", title: "EM-kval, omgång 3–4", competition: "EHF EURO 2028-kvalet, grupp 8", start: "2027-03-08", end: "2027-03-14", source: EC28Q_SOURCE, matches: [
    { date: "2027-03-10", dateLabel: "10–11 mars", home: "Nordmakedonien", away: SWEDEN },
    { date: "2027-03-10", dateLabel: "10–11 mars", home: "Luxemburg", away: "Grekland" },
    { date: "2027-03-13", dateLabel: "13–14 mars", home: SWEDEN, away: "Nordmakedonien" },
    { date: "2027-03-13", dateLabel: "13–14 mars", home: "Grekland", away: "Luxemburg" },
  ] },
  { id: "ec28q-r56", kind: "QUALIFIER", title: "EM-kval, omgång 5–6", competition: "EHF EURO 2028-kvalet, grupp 8", start: "2027-05-03", end: "2027-05-09", source: EC28Q_SOURCE, matches: [
    { date: "2027-05-05", dateLabel: "5–6 maj", home: "Grekland", away: SWEDEN },
    { date: "2027-05-05", dateLabel: "5–6 maj", home: "Luxemburg", away: "Nordmakedonien" },
    { date: "2027-05-09", dateLabel: "9 maj", home: SWEDEN, away: "Luxemburg" },
    { date: "2027-05-09", dateLabel: "9 maj", home: "Nordmakedonien", away: "Grekland" },
  ] },
  { id: "ec28", kind: "TOURNAMENT", title: "EM 2028", competition: "EHF EURO 2028 (Spanien, Portugal, Schweiz)", start: "2028-01-02", end: "2028-01-30", source: "EHF: Men's EHF EURO 2028, 13–30 januari 2028", tournament: { start: "2028-01-13", end: "2028-01-30" }, requires: "ec28q" },
];

/** The game's assumption of each team's level -- only used to simulate results. */
const STRENGTH: Record<string, number> = { [SWEDEN]: 90, Norge: 89, Nordmakedonien: 74, Grekland: 68, Qatar: 72, Luxemburg: 52 };

/**
 * HM-ALPHA3-M10: other nations whose players exist in the game world (by
 * `nationality`). `strength` is the same kind of game assumption as STRENGTH
 * above; it sets how good a player must be to be called up.
 */
export const FOREIGN_TEAMS: Readonly<Record<string, { name: string; strength: number; europe: boolean }>> = {
  DEN: { name: "Danmark", strength: 94, europe: true }, NOR: { name: "Norge", strength: 89, europe: true }, ISL: { name: "Island", strength: 83, europe: true },
  GER: { name: "Tyskland", strength: 91, europe: true }, FRA: { name: "Frankrike", strength: 92, europe: true }, ESP: { name: "Spanien", strength: 86, europe: true },
  HRV: { name: "Kroatien", strength: 85, europe: true }, SRB: { name: "Serbien", strength: 73, europe: true }, BIH: { name: "Bosnien och Hercegovina", strength: 68, europe: true },
  FIN: { name: "Finland", strength: 55, europe: true }, FRO: { name: "Färöarna", strength: 66, europe: true }, KOS: { name: "Kosovo", strength: 52, europe: true },
  EST: { name: "Estland", strength: 54, europe: true }, GBR: { name: "Storbritannien", strength: 40, europe: true }, IRL: { name: "Irland", strength: 35, europe: true },
  CHL: { name: "Chile", strength: 62, europe: false },
};

/**
 * Which nations' teams gather in each window. Qualifier windows are EHF
 * national-team weeks, which every European federation keeps free, so every
 * European team is assumed to gather. Tournament fields list the nations the
 * sources confirm (`verified`) and the game's own assumption for the rest of
 * the field (`assumed`, shown as an assumption). Unlisted nations stay home.
 */
export const TOURNAMENT_PARTICIPANTS: Readonly<Record<string, { verified: string[]; assumed: string[]; note: string }>> = {
  wc27: { verified: ["Norge", "Grekland", "Qatar", "Tyskland"], assumed: ["Danmark", "Frankrike", "Spanien", "Kroatien", "Island"], note: "Grupp E enligt IHF:s lottning och värdlandet Tyskland; övriga deltagare är spelets antagande." },
  ec28: { verified: ["Spanien", "Portugal", "Schweiz"], assumed: ["Danmark", "Norge", "Tyskland", "Frankrike", "Island", "Kroatien"], note: "Värdländerna enligt EHF; övriga kvalificerade lag är spelets antagande." },
};

function nationGathers(w: NationalWindow, nation: { name: string; europe: boolean }): boolean {
  if (w.kind === "QUALIFIER") return nation.europe;
  const field = TOURNAMENT_PARTICIPANTS[w.id];
  return !!field && (field.verified.includes(nation.name) || field.assumed.includes(nation.name));
}

export interface NationalResult { home: string; away: string; hg: number; ag: number; dateLabel: string }
export interface NationalWindowState {
  status: "CALLED" | "DONE" | "NOT_QUALIFIED";
  /** Players called from clubs in the game, strongest first. */
  squad: { playerId: string; clubId: string }[];
  /** HM-ALPHA3-M10: players called up by other nations (FOREIGN_TEAMS). */
  foreign?: { playerId: string; clubId: string; nation: string }[];
  /** HM-ALPHA3-M10: true while the called players are away; their clubs play without them. */
  away?: boolean;
  results: NationalResult[];
  /** Tournaments: Sweden's final placing. */
  placing?: number;
  summary?: string;
}
export interface NationalTeamState { windows: Record<string, NationalWindowState> }

export function nationalTeamOf(state: CareerState): NationalTeamState {
  return state.nationalTeam ?? { windows: {} };
}

/** The window the date falls in, if any. */
export function windowOn(date: string): NationalWindow | undefined {
  return NATIONAL_WINDOWS.find((w) => date >= w.start && date <= w.end);
}

/** The club calendar breaks for these windows (used when a season's league is generated). */
export function nationalBreaks(): { start: string; end: string }[] {
  return NATIONAL_WINDOWS.map((w) => ({ start: w.start, end: w.end }));
}

export function upcomingWindows(state: CareerState, limit = 3): NationalWindow[] {
  return NATIONAL_WINDOWS.filter((w) => w.end >= state.gameDate).slice(0, limit);
}

/** The manager's players in a window's squad. */
export function ownCallUps(state: CareerState, windowId: string): string[] {
  const ws = nationalTeamOf(state).windows[windowId];
  return [...(ws?.squad ?? []), ...(ws?.foreign ?? [])].filter((s) => s.clubId === state.playerClubId).map((s) => s.playerId);
}

function score(seed: string, home: string, away: string, neutral = false): NationalResult & { dateLabel: string } {
  const diff = ((STRENGTH[home] ?? 70) - (STRENGTH[away] ?? 70)) * 0.32 + (neutral ? 0 : 1.5);
  const hg = Math.max(14, Math.round(29 + diff / 2 + (hash(`${seed}:h`) - 0.5) * 7));
  const ag = Math.max(14, Math.round(29 - diff / 2 + (hash(`${seed}:a`) - 0.5) * 7));
  return { home, away, hg, ag, dateLabel: "" };
}

function callUp(state: CareerState, w: NationalWindow): { playerId: string; clubId: string }[] {
  const size = w.kind === "TOURNAMENT" ? 6 : 7;
  const pool: { playerId: string; clubId: string; ca: number }[] = [];
  for (const clubId of Object.keys(state.worldSquads)) for (const p of getCareerClubSquad(state, clubId)) if (p.nationality === "SWE") pool.push({ playerId: p.id, clubId, ca: caOf(state, p.id) });
  return pool.sort((a, b) => b.ca - a.ca || a.playerId.localeCompare(b.playerId)).slice(0, size).map(({ playerId, clubId }) => ({ playerId, clubId }));
}

/**
 * HM-ALPHA3-M10: the game world holds only part of each foreign pool, so a
 * player is called up when he is at least as good as Sweden's weakest
 * selection, scaled by his nation's strength -- a Faroese starter is called
 * where a Danish one of the same level is not. At most four per nation.
 */
const FOREIGN_PER_NATION = 4;
function foreignCallUps(state: CareerState, w: NationalWindow, swedishBar: number): { playerId: string; clubId: string; nation: string }[] {
  const byNation = new Map<string, { playerId: string; clubId: string; ca: number }[]>();
  for (const clubId of Object.keys(state.worldSquads)) for (const p of getCareerClubSquad(state, clubId)) {
    const nation = FOREIGN_TEAMS[p.nationality ?? ""];
    if (!nation || !nationGathers(w, nation)) continue;
    const ca = caOf(state, p.id);
    if (ca < swedishBar * (nation.strength / STRENGTH[SWEDEN]!)) continue;
    byNation.set(nation.name, [...(byNation.get(nation.name) ?? []), { playerId: p.id, clubId, ca }]);
  }
  return [...byNation.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([nation, pool]) => pool.sort((a, b) => b.ca - a.ca || a.playerId.localeCompare(b.playerId)).slice(0, FOREIGN_PER_NATION).map(({ playerId, clubId }) => ({ playerId, clubId, nation })));
}

/** The bar for foreign call-ups: the weakest player Sweden would pick for this window. */
function swedishBar(state: CareerState, w: NationalWindow): number {
  const squad = callUp(state, w);
  return squad.length ? Math.min(...squad.map((s) => caOf(state, s.playerId))) : Infinity;
}

/** Own players leave: unavailable to the club until the day after the window, with a lift from the call-up. */
function depart(state: CareerState, w: NationalWindow, playerIds: string[]): CareerState {
  let next = state;
  for (const id of playerIds) {
    next = addMoraleShock(next, id, 4, `Uttagen till landslaget (${w.title})`, 14);
    const current = next.playerStatuses[id];
    if (current && current.availability !== "AVAILABLE" && current.availability !== "LIMITED") continue; // injured or suspended players stay as they are
    next = { ...next, playerStatuses: { ...next.playerStatuses, [id]: { playerId: id, availability: "NATIONAL_TEAM", returnDate: addDaysIso(w.end, 1) } } };
  }
  return next;
}

function groupTable(state: CareerState): { team: string; points: number; diff: number }[] {
  const rows: Record<string, { team: string; points: number; diff: number }> = {};
  for (const w of NATIONAL_WINDOWS.filter((x) => x.id.startsWith("ec28q-"))) for (const r of nationalTeamOf(state).windows[w.id]?.results ?? []) {
    for (const t of [r.home, r.away]) rows[t] ??= { team: t, points: 0, diff: 0 };
    rows[r.home]!.diff += r.hg - r.ag; rows[r.away]!.diff += r.ag - r.hg;
    if (r.hg > r.ag) rows[r.home]!.points += 2; else if (r.hg < r.ag) rows[r.away]!.points += 2; else { rows[r.home]!.points += 1; rows[r.away]!.points += 1; }
  }
  return Object.values(rows).sort((a, b) => b.points - a.points || b.diff - a.diff || a.team.localeCompare(b.team));
}

/** EURO 2028: the top two of each group go through, and four of the eight third-placed teams. */
function qualified(state: CareerState): boolean {
  const pos = groupTable(state).findIndex((r) => r.team === SWEDEN) + 1;
  return pos > 0 && (pos <= 2 || (pos === 3 && hash(`${state.saveSeed}:ec28q:third`) < 0.5));
}

function placing(seed: string, groupPos: number): number {
  if (groupPos >= 4) return 25 + Math.floor(hash(`${seed}:pc`) * 8);
  const r = hash(`${seed}:place`);
  return r < 0.07 ? 1 : r < 0.16 ? 2 : r < 0.28 ? 3 : r < 0.42 ? 4 : r < 0.62 ? 5 + Math.floor(hash(`${seed}:58`) * 4) : r < 0.85 ? 9 + Math.floor(hash(`${seed}:912`) * 4) : 13 + Math.floor(hash(`${seed}:1316`) * 4);
}

const NATIONAL_OUTLETS = ["svt-sport", "aftonbladet", "handbollskanalen"];
function outletsWith(state: CareerState, ownPlayers: number): string[] {
  const local = ownPlayers ? (CLUB_MEDIA[state.playerClubId]?.outlets.slice(0, 1) ?? []) : [];
  return [...local, ...NATIONAL_OUTLETS];
}

function names(state: CareerState, ids: string[]): string {
  const all = ids.map((id) => { for (const clubId of Object.keys(state.worldSquads)) { const p = getCareerClubSquad(state, clubId).find((x) => x.id === id); if (p) return `${p.firstName} ${p.lastName}`; } return ""; }).filter(Boolean);
  return all.length <= 1 ? all.join("") : `${all.slice(0, -1).join(", ")} och ${all.at(-1)}`;
}

/** Daily: the squad is called on the window's first day; results and the return come on its last. */
export function progressNationalTeam(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const w of NATIONAL_WINDOWS) {
    const st = nationalTeamOf(next).windows[w.id];
    // An older save that is already past a window does not get it retroactively.
    if (!st && date === w.start) next = open(next, w, date, emit);
    else if (st && (st.status === "CALLED" || st.away) && date >= w.end) next = close(next, w, date, emit);
  }
  return next;
}

function withWindow(state: CareerState, id: string, ws: NationalWindowState): CareerState {
  const nt = nationalTeamOf(state);
  return { ...state, nationalTeam: { ...nt, windows: { ...nt.windows, [id]: ws } } };
}

function open(state: CareerState, w: NationalWindow, date: string, emit: Emit): CareerState {
  const foreign = foreignCallUps(state, w, swedishBar(state, w));
  const ownForeign = foreign.filter((s) => s.clubId === state.playerClubId);
  const foreignLine = ownForeign.length ? ` ${ownForeign.map((s) => `${names(state, [s.playerId])} (${s.nation})`).join(", ")} är uttagna av sina landslag.` : "";
  if (w.requires && !qualified(state)) {
    let next = withWindow(state, w.id, { status: "NOT_QUALIFIED", squad: [], foreign, away: foreign.length > 0, results: [], summary: "Sverige tog sig inte till mästerskapet." });
    next = depart(next, w, ownForeign.map((s) => s.playerId));
    if (ownForeign.length) emit(buildClubEvent("MEDIA", `nt:${w.id}:callup`, date, "IMPORTANT", `Landslagsuppehåll: ${w.title}`, `${foreignLine.trim()} Ligan står still ${w.start}–${w.end}.`, [{ route: "CLUB_HQ" }]));
    return publish(next, { key: `nt:${w.id}:missed`, kind: "NATIONAL_TEAM", date, importance: 4, clubIds: [], onlyOutlets: NATIONAL_OUTLETS, topFlight: true, facts: { headline: `Sverige missar ${w.title}`, standfirst: `Landslaget tog sig inte vidare från kvalet. Ligan står ändå still under mästerskapet.`, body: "Spelets simulering av kvalet." }, destinations: [{ route: "CLUB_HQ" }] });
  }
  const squad = callUp(state, w);
  const own = squad.filter((s) => s.clubId === state.playerClubId).map((s) => s.playerId);
  let next = withWindow(state, w.id, { status: "CALLED", squad, foreign, away: true, results: [] });
  next = depart(next, w, [...own, ...ownForeign.map((s) => s.playerId)]);
  const ownLine = (own.length ? `${names(next, own)} från din klubb är med.` : ownForeign.length ? "Ingen spelare från din klubb är uttagen till Sverige." : "Ingen spelare från din klubb är uttagen.") + foreignLine;
  next = publish(next, { key: `nt:${w.id}:squad`, kind: "NATIONAL_TEAM", date, importance: 4, clubIds: own.length ? [state.playerClubId] : [], playerIds: own, onlyOutlets: outletsWith(state, own.length), topFlight: true, facts: { headline: own.length ? `${names(next, own.slice(0, 1))} uttagen till landslaget` : `Truppen inför ${w.title}`, standfirst: `Förbundskaptenen har tagit ut truppen till ${w.competition}. Från klubbarna i Sverige: ${names(next, squad.map((s) => s.playerId))}.`, body: `${ownLine} Ligan gör uppehåll ${w.start}–${w.end}.` }, destinations: [{ route: "CLUB_HQ" }] });
  emit(buildClubEvent("MEDIA", `nt:${w.id}:callup`, date, own.length || ownForeign.length ? "IMPORTANT" : "INFORMATION", `Landslagsuppehåll: ${w.title}`, `${ownLine} Ligan står still ${w.start}–${w.end}. Uttagna spelare tränar med landslaget och kommer tillbaka med ett tröttare ben och en viss skaderisk.`, [{ route: "CLUB_HQ" }]));
  return next;
}

/**
 * HM-ALPHA3-M10: everyone called up comes back tired -- the energy cap reaches
 * CPU squads too, through their tracked condition. Injury risk is applied to
 * the manager's players, the only squad whose injuries the game tracks.
 * Foreign players are assumed to play two matches in a qualifier week and
 * six in a tournament.
 */
function returnPlayers(state: CareerState, w: NationalWindow, st: NationalWindowState, date: string, swedenMatches: number): { state: CareerState; own: string[]; injured: string[] } {
  let next = state;
  const own = [...st.squad, ...(st.foreign ?? [])].filter((s) => s.clubId === state.playerClubId).map((s) => s.playerId);
  const matchesFor = (id: string) => (st.foreign?.some((f) => f.playerId === id) ? (w.kind === "TOURNAMENT" ? 6 : 2) : swedenMatches);
  const injured: string[] = [];
  const rounds = Math.max(0, ...own.map(matchesFor));
  for (let i = 0; i < rounds; i++) {
    const playing = own.filter((id) => matchesFor(id) > i && !injured.includes(id));
    if (!playing.length) continue;
    const exposure = new Map<string, MatchExposureForInjury>(playing.map((id) => [id, { attackExposure: 0.45, defenceExposure: 0.45, goalkeeperExposure: 0 }]));
    const r = applyMatchInjuryResolution(next, date, `nt:${w.id}:${i}`, exposure);
    next = r.state; injured.push(...r.newlyInjuredPlayerIds);
  }
  const cap = w.kind === "TOURNAMENT" ? 70 : 82;
  for (const { playerId: id } of [...st.squad, ...(st.foreign ?? [])]) { const ps = next.playerPhysicalState[id] ?? { playerId: id, currentEnergy: 100, lastUpdatedDate: date, recentLoad: 0 }; if (ps.currentEnergy > cap) next = { ...next, playerPhysicalState: { ...next.playerPhysicalState, [id]: { ...ps, currentEnergy: cap, lastUpdatedDate: date } } }; }
  return { state: next, own, injured };
}

function close(state: CareerState, w: NationalWindow, date: string, emit: Emit): CareerState {
  const st = nationalTeamOf(state).windows[w.id]!;
  if (st.status === "NOT_QUALIFIED") {
    const back = returnPlayers(state, w, st, date, 0);
    const next = withWindow(back.state, w.id, { ...st, away: false });
    if (back.own.length) emit(buildClubEvent("MEDIA", `nt:${w.id}:return`, date, back.injured.length ? "IMPORTANT" : "INFORMATION", `Landslagsspelarna är tillbaka`, `${names(next, back.own)} är tillbaka efter ${w.title.toLowerCase()} och behöver återhämtning.${back.injured.length ? ` ${names(next, back.injured)} skadade sig med landslaget.` : ""}`, [{ route: "SQUAD" }]));
    return next;
  }
  const seed = `${state.saveSeed}:nt:${w.id}`;
  let results: NationalResult[] = [];
  let swedenMatches = 0, placingNo: number | undefined, summary = "";
  if (w.matches) {
    results = w.matches.map((m, i) => ({ ...score(`${seed}:${i}`, m.home, m.away), dateLabel: m.dateLabel }));
    swedenMatches = results.filter((r) => r.home === SWEDEN || r.away === SWEDEN).length;
    summary = results.filter((r) => r.home === SWEDEN || r.away === SWEDEN).map((r) => `${r.home}–${r.away} ${r.hg}–${r.ag}`).join(", ");
  } else {
    const opponents = w.group?.opponents ?? ["motståndare 1", "motståndare 2", "motståndare 3"];
    if (w.group) results = opponents.map((o, i) => ({ ...score(`${seed}:g${i}`, SWEDEN, o, true), dateLabel: `${w.group!.name}, ${w.group!.venue}` }));
    const pts = results.reduce((a, r) => a + (r.hg > r.ag ? 2 : r.hg === r.ag ? 1 : 0), 0);
    const groupPos = !w.group ? (hash(`${seed}:gp`) < 0.8 ? 1 : 3) : pts >= 5 ? 1 : pts >= 3 ? 2 : pts >= 2 ? 3 : 4;
    placingNo = placing(seed, groupPos);
    swedenMatches = groupPos >= 4 ? 5 : placingNo <= 4 ? 9 : 7;
    summary = `${w.group ? `${w.group.name} i ${w.group.venue}: ${results.map((r) => `${r.home}–${r.away} ${r.hg}–${r.ag}`).join(", ")}. ` : ""}Sverige slutade ${ordinal(placingNo)}.`;
  }
  let next = withWindow(state, w.id, { ...st, status: "DONE", away: false, results, ...(placingNo !== undefined ? { placing: placingNo } : {}), summary });
  // Everyone comes back: tired legs, and for the manager's players the risk of the matches they played.
  const back = returnPlayers(next, w, st, date, swedenMatches);
  next = back.state;
  const own = back.own, injured = back.injured;
  const medal = placingNo !== undefined && placingNo <= 3;
  const headline = placingNo !== undefined ? (placingNo === 1 ? `Sverige vann ${w.title}!` : medal ? `Medalj för Sverige i ${w.title}` : `Sverige slutade ${ordinal(placingNo)} i ${w.title}`) : `Landslaget efter ${w.title.toLowerCase()}`;
  next = publish(next, { key: `nt:${w.id}:result`, kind: "NATIONAL_TEAM", date, importance: placingNo !== undefined ? (medal ? 5 : 4) : 3, clubIds: own.length ? [state.playerClubId] : [], playerIds: own, onlyOutlets: outletsWith(state, own.length), topFlight: true, facts: { headline, standfirst: summary, body: "Resultaten är spelets egen simulering, inte verkliga matcher." }, destinations: [{ route: "CLUB_HQ" }] });
  if (own.length) emit(buildClubEvent("MEDIA", `nt:${w.id}:return`, date, injured.length ? "IMPORTANT" : "INFORMATION", `Landslagsspelarna är tillbaka`, `${names(next, own)} är tillbaka efter ${w.title.toLowerCase()} och behöver återhämtning.${injured.length ? ` ${names(next, injured)} skadade sig med landslaget.` : ""}`, [{ route: "SQUAD" }]));
  return next;
}

/** Generated league rounds that would fall in a national-team break move to the first day after it. */
export function avoidNationalBreaks<T extends { date: string; round: number }>(fixtures: T[]): T[] {
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
  const firstDate = new Map(rounds.map((r) => [r, fixtures.filter((f) => f.round === r).map((f) => f.date).sort()[0]!]));
  const shift = new Map<number, number>();
  let offset = 0;
  for (const r of rounds) {
    let d = addDaysIso(firstDate.get(r)!, offset);
    for (const b of nationalBreaks()) if (d >= b.start && d <= b.end) { const extra = daysBetween(d, b.end) + 1; offset += extra; d = addDaysIso(d, extra); }
    shift.set(r, offset);
  }
  return fixtures.map((f) => (shift.get(f.round) ? { ...f, date: addDaysIso(f.date, shift.get(f.round)!) } : f));
}

/** Swedish ordinals: 1:a, 2:a, 3:e … 11:e, 12:e, 21:a. */
function ordinal(n: number): string {
  return `${n}:${(n % 10 === 1 || n % 10 === 2) && n % 100 !== 11 && n % 100 !== 12 ? "a" : "e"}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}
