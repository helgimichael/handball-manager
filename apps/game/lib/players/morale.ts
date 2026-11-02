// HM-ALPHA3-M05: morale. Each week every player at the manager's club gets
// a target morale from explained factors -- playing time against his
// role, results, contract situation, promises, the club's status and the
// staff around him -- and moves a few points toward it. No random swings:
// the same circumstances always give the same morale.
import { SQUAD_STATUS_TIER_LABEL_SV } from "../career/squadStatus";
import type { CareerState } from "../career/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { departmentQuality } from "../staff/organisation";
import { EXPECTED_START_SHARE, addDaysIso, caOf, dynamicsOf, managerMatchesPlayed, managerSquadIds, personalityOf, startsOf, tierOf } from "./dynamicsState";
import type { MoraleFactor, PlayerMoraleState } from "./types";

export const NEUTRAL_MORALE = 70;
export const UNHAPPY_MORALE = 40;
/** At most this many points of change per weekly update. */
const WEEKLY_STEP = 6;
/** Morale changes match performance by at most ±3 % (attribute scale on the manager's own players). */
export const MORALE_MATCH_EFFECT = 0.03;

export function moraleOf(state: CareerState, playerId: string): number {
  return dynamicsOf(state).morale[playerId]?.moralePct ?? NEUTRAL_MORALE;
}

export function moraleLabel(pct: number): string {
  if (pct >= 85) return "Mycket nöjd";
  if (pct >= 70) return "Nöjd";
  if (pct >= 55) return "Okej";
  if (pct >= UNHAPPY_MORALE) return "Missnöjd";
  return "Mycket missnöjd";
}

/** The explained factors behind one player's target morale this week. */
export function moraleFactors(state: CareerState, playerId: string): MoraleFactor[] {
  const out: MoraleFactor[] = [];
  const p = personalityOf(state, playerId);
  const tier = tierOf(state, playerId);
  const played = managerMatchesPlayed(state);

  // Playing time against the role (needs a few matches before it counts).
  if (played.length >= 4) {
    const { starts } = startsOf(state, playerId);
    const share = starts / played.length;
    const expected = EXPECTED_START_SHARE[tier];
    const gap = share - expected;
    if (gap < -0.15) out.push({ key: "PLAYING_TIME", label: `Startar ${Math.round(share * 100)} % av matcherna, ${SQUAD_STATUS_TIER_LABEL_SV[tier].toLowerCase()} borde starta runt ${Math.round(expected * 100)} %`, points: Math.round(Math.max(-18, gap * 40) * (0.7 + p.ambition / 40)) });
    else if (gap > 0.15) out.push({ key: "PLAYING_TIME", label: `Får mer speltid än rollen lovar (${Math.round(share * 100)} % starter)`, points: 4 });
  }

  // Results: points per game in the last five matches.
  const recent = played.slice(-5);
  if (recent.length >= 3) {
    const ppg = recent.reduce((s, r) => s + r.points, 0) / recent.length;
    if (ppg >= 1.5) out.push({ key: "RESULTS", label: "Laget vinner -- stämningen är god", points: 5 });
    else if (ppg <= 0.6) out.push({ key: "RESULTS", label: "Laget förlorar -- tung stämning", points: -5 });
  }

  // Contract situation.
  const contract = state.playerContracts[playerId];
  if (contract) {
    const monthsLeft = (new Date(`${contract.contractEndDate}T00:00:00Z`).getTime() - new Date(`${state.gameDate}T00:00:00Z`).getTime()) / (30.4 * 86_400_000);
    const talks = Object.values(state.renewalTalks ?? {}).some((t) => t.playerId === playerId && t.status === "OPEN");
    if (monthsLeft <= 7 && !talks && !state.preContracts?.[playerId]) out.push({ key: "CONTRACT", label: "Avtalet går ut snart och ingen har pratat förlängning", points: -Math.round(3 + p.ambition / 4) });
    const renewed = Object.values(state.renewalTalks ?? {}).some((t) => t.playerId === playerId && t.status === "AGREED" && t.closedOn && addDaysIso(t.closedOn, 60) >= state.gameDate);
    if (renewed) out.push({ key: "CONTRACT", label: "Nytt avtal -- känner sig uppskattad", points: 6 });
  }

  // Promises.
  const promises = Object.values(dynamicsOf(state).promises).filter((x) => x.playerId === playerId);
  const active = promises.filter((x) => x.status === "ACTIVE").length;
  const broken = promises.filter((x) => x.status === "BROKEN" && x.evaluatedOn && addDaysIso(x.evaluatedOn, 120) >= state.gameDate).length;
  if (active > 0) out.push({ key: "PROMISES", label: `Väntar på ${active === 1 ? "ett löfte" : `${active} löften`} från dig`, points: 2 });
  if (broken > 0) out.push({ key: "PROMISES", label: broken === 1 ? "Ett löfte har brutits" : `${broken} löften har brutits`, points: -Math.min(16, broken * 8) });

  // The club's status: relegation hurts ambitious players, success lifts everyone.
  const last = state.seasonHistory?.at(-1)?.outcome;
  if (last && state.seasonHistory!.at(-1)!.seasonId !== state.seasonId) {
    const me = state.playerClubId;
    if (last.relegated?.includes(me)) out.push({ key: "CLUB_STATUS", label: "Klubben åkte ur förra säsongen", points: -Math.round(2 + p.ambition / 3) });
    if (last.champion === me || last.cupWinner === me || last.promoted?.includes(me)) out.push({ key: "CLUB_STATUS", label: "Förra säsongens framgång", points: 5 });
  }

  // Sporting ambition: a clearly better player than the squad around him.
  const squad = managerSquadIds(state).map((id) => caOf(state, id)).sort((a, b) => b - a);
  const level = squad.slice(0, 7).reduce((s, v) => s + v, 0) / Math.max(1, Math.min(7, squad.length));
  if (caOf(state, playerId) > level + 12 && p.ambition >= 13) out.push({ key: "CLUB_STATUS", label: "Känner sig bättre än nivån omkring sig", points: -4 });

  // Transfer situation.
  const listing = dynamicsOf(state).listings[playerId];
  const request = dynamicsOf(state).requests[playerId];
  if (listing?.reason === "MANAGER" && request?.status !== "OPEN") out.push({ key: "TRANSFER", label: "Transferlistad mot sin vilja", points: -8 });
  if (request?.status === "REFUSED" && request.decidedOn && addDaysIso(request.decidedOn, 90) >= state.gameDate) out.push({ key: "TRANSFER", label: "Fick nej på sin flyttbegäran", points: -10 });
  if (request?.status === "ACCEPTED") out.push({ key: "TRANSFER", label: "Klubben lyssnar på bud", points: 4 });

  // Staff: the people who handle the group (assistant's motivation, team manager's environment).
  const staffQ = (departmentQuality(state, state.playerClubId, "ASSISTANT_COACH") + departmentQuality(state, state.playerClubId, "TEAM_MANAGER")) / 2;
  const staffPoints = Math.round((staffQ - 1) * 12);
  if (staffPoints !== 0) out.push({ key: "STAFF", label: staffPoints > 0 ? "Bra stämning i staben" : "Staben når inte fram till gruppen", points: staffPoints });

  // Talk outcomes and other one-off effects that fade by date.
  for (const shock of dynamicsOf(state).morale[playerId]?.shocks ?? []) if (shock.until >= state.gameDate) out.push({ key: "TALK", label: shock.label, points: shock.points });

  return out;
}

/** Weekly update for the manager's squad: target from factors, a bounded step toward it. */
export function updateMoraleWeekly(state: CareerState, date: string): CareerState {
  const d = dynamicsOf(state);
  const morale: Record<string, PlayerMoraleState> = {};
  for (const id of managerSquadIds(state)) {
    const prev = d.morale[id];
    const factors = moraleFactors(state, id);
    const target = Math.max(5, Math.min(98, NEUTRAL_MORALE + factors.reduce((s, f) => s + f.points, 0)));
    const current = prev?.moralePct ?? NEUTRAL_MORALE;
    const step = Math.max(-WEEKLY_STEP, Math.min(WEEKLY_STEP, target - current));
    const next = Math.round(current + step);
    morale[id] = {
      moralePct: next,
      targetPct: Math.round(target),
      factors,
      updatedOn: date,
      unhappyWeeks: next < UNHAPPY_MORALE ? (prev?.unhappyWeeks ?? 0) + 1 : 0,
      shocks: (prev?.shocks ?? []).filter((s) => s.until >= date),
    };
  }
  return { ...state, playerDynamics: { ...d, morale, lastWeeklyUpdate: date } };
}

/** Adds a one-off morale effect that fades on `until` (talk outcomes, decisions). */
export function addMoraleShock(state: CareerState, playerId: string, points: number, label: string, days: number): CareerState {
  const d = dynamicsOf(state);
  const prev = d.morale[playerId] ?? { moralePct: NEUTRAL_MORALE, targetPct: NEUTRAL_MORALE, factors: [], updatedOn: state.gameDate, unhappyWeeks: 0 };
  // An immediate, smaller part of the effect lands now; the rest through the weekly target.
  const immediate = Math.round(points / 2);
  const moralePct = Math.max(5, Math.min(98, prev.moralePct + immediate));
  return { ...state, playerDynamics: { ...d, morale: { ...d.morale, [playerId]: { ...prev, moralePct, shocks: [...(prev.shocks ?? []), { points, label, until: addDaysIso(state.gameDate, days) }] } } } };
}

/** The bounded match multiplier for a player's morale: 0.97 at rock bottom, 1.03 at the top, 1.0 when settled. */
export function moraleMatchFactor(moralePct: number): number {
  const x = Math.max(-1, Math.min(1, (moralePct - NEUTRAL_MORALE) / 30));
  return 1 + x * MORALE_MATCH_EFFECT;
}

/**
 * The manager's own players' gameplay ratings with morale applied: every
 * attribute scaled by the player's morale factor (±3 % at most). Other
 * clubs and players without a morale record are returned unchanged.
 */
export function applyMoraleToRatings(state: CareerState, clubId: string, ratings: readonly GameplayPlayerRating[]): GameplayPlayerRating[] {
  const morale = state.playerDynamics?.morale;
  if (clubId !== state.playerClubId || !morale) return ratings as GameplayPlayerRating[];
  return ratings.map((r) => {
    const m = morale[r.playerId];
    if (!m) return r;
    const f = moraleMatchFactor(m.moralePct);
    if (f === 1) return r;
    const attributes = Object.fromEntries(Object.entries(r.branch.attributes).map(([k, v]) => [k, { ...v, value: v.value * f }]));
    return { ...r, branch: { ...r.branch, attributes } as GameplayPlayerRating["branch"] };
  });
}
