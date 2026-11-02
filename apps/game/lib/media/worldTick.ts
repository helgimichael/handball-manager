// HM-ALPHA3-M08: the living world, once a day. Every story comes from
// something that actually happened in the career: today's results, the
// tables, coaching changes, transfers, the board, the manager's players,
// season outcomes, records. Big matches get a preview, a rival coach may
// speak up, and the manager is asked about it. Ordinary days stay quiet.
import type { CareerEvent } from "../career/careerEvents";
import type { CareerFixture, CareerState } from "../career/types";
import { getCareerClubSquad } from "../career/careerWorld";
import { clubCompetitionId } from "../career/competitionMembership";
import { competitionTable } from "../competition/tables";
import { HANDBOLLSLIGAN } from "../competition/rules";
import { formatEur } from "../economy/currency";
import { getClub } from "../game-data";
import { addDaysIso, managerMatchesPlayed, managerSquadIds } from "../players/dynamicsState";
import { addMoraleShock } from "../players/morale";
import type { Consequence } from "./types";
import { matchWinnerClubId } from "@handball-manager/game-simulation";
import { adjustRelation, coachPersona, derbyName, hash, headCoachOf, mediaOf, relationOf, rivalryBetween, withMedia } from "./people";
import { clubShort, playerName, publish, type WorldEvent } from "./newsEngine";
import { apologise, progressDiscipline } from "./discipline";
import { openPress, progressPress } from "./press";
import { geographicTie } from "./registry";
import { predictedPositionOf } from "../board/board";
import { tieWins } from "../competition/season";
import { progressNationalTeam } from "../nationalTeam/nationalTeam";

type Emit = (e: CareerEvent) => void;

const topFlight = (state: CareerState, clubId: string) => (clubCompetitionId(state, clubId) ?? getClub(clubId)?.competitionId) === HANDBOLLSLIGAN;

function tablePos(state: CareerState, clubId: string): number | null {
  const comp = clubCompetitionId(state, clubId) ?? getClub(clubId)?.competitionId;
  if (!comp) return null;
  const t = competitionTable(state, comp);
  const i = t.findIndex((r) => r.clubId === clubId);
  return i >= 0 ? i + 1 : null;
}

export interface MatchStakes { level: number; labels: string[]; derby: string | null; rival?: { staffId: string; name: string; relation: number }; formerClub: boolean }

/** Why a fixture matters: derby, top clash, relegation battle, knockout, a feud, a return to a former club. Shared with the matchday (M09). */
export function matchStakes(state: CareerState, f: CareerFixture): MatchStakes {
  const me = state.playerClubId;
  const opp = f.homeClubId === me ? f.awayClubId : f.homeClubId;
  const labels: string[] = [];
  let level = 1;
  const derby = derbyName(me, opp);
  if (derby) { labels.push(derby); level = Math.max(level, geographicTie(me, opp) === 3 ? 4 : 3); }
  if (f.type !== "LEAGUE" && f.type !== "FRIENDLY") {
    const tieStage = f.stage ? state.competitionTies?.[f.stage.tieId]?.stage : undefined;
    const final = tieStage === "F" || tieStage === "CUP_F";
    labels.push(final ? (tieStage === "F" ? "SM-final" : "Cupfinal") : tieStage === "SF" ? "SM-semifinal" : f.type === "PLAYOFF" ? "SM-slutspel" : f.type === "QUALIFIER" ? "Kval" : "Svenska cupen");
    level = Math.max(level, final ? 5 : tieStage === "SF" || tieStage === "CUP_SF" || f.type === "QUALIFIER" ? 4 : f.type === "PLAYOFF" || tieStage === "CUP_QF" ? 3 : 2);
  }
  const pm = tablePos(state, me), po = tablePos(state, opp);
  const rows = competitionTable(state, f.competitionId).length || 14;
  // Table stakes only once the table means something (six rounds in).
  const played = competitionTable(state, f.competitionId).find((r) => r.clubId === me)?.played ?? 0;
  if (f.type === "LEAGUE" && played >= 6 && pm && po && pm <= 3 && po <= 3) { labels.push("Toppmöte"); level = Math.max(level, 3); }
  if (f.type === "LEAGUE" && played >= 6 && pm && po && pm > rows - 3 && po > rows - 3) { labels.push("Bottenstrid"); level = Math.max(level, 3); }
  const coach = headCoachOf(state, opp);
  let rival: MatchStakes["rival"];
  if (coach) {
    const rel = relationOf(state, "manager", coach.staffId).score;
    rival = { staffId: coach.staffId, name: coach.name, relation: rel };
    if (rel <= -15) { labels.push(`Fejd med ${coach.name}`); level = Math.max(level, 3); }
  }
  const formerClub = (state.managerCareer?.stints ?? []).some((s) => s.clubId === opp && s.to);
  if (formerClub) { labels.push("Återkomst till din gamla klubb"); level = Math.max(level, 3); }
  return { level, labels, derby, rival, formerClub };
}

export function progressMedia(state: CareerState, date: string, dayEvents: CareerEvent[], emit: Emit): CareerState {
  let next = state.media ? state : { ...state, media: mediaOf(state) };
  next = progressPress(next, date, emit);
  next = progressDiscipline(next, date, emit);
  next = disciplinePress(next, date, emit);
  next = results(next, date, emit);
  next = previews(next, date, emit);
  next = fromEvents(next, date, dayEvents, emit);
  next = coachChanges(next, date);
  next = transfers(next, date);
  next = seasonStories(next, date);
  next = progressNationalTeam(next, date, emit);
  if (new Date(`${date}T00:00:00Z`).getUTCDay() === 1) next = weekly(next, date);
  // Supporters remember, but not for ever: a tenth of the feeling fades each week,
  // while a table that keeps telling a different story from the expectations is felt every week.
  if (new Date(`${date}T00:00:00Z`).getUTCDay() === 1) next = withMedia(next, (m) => ({ ...m, supporters: Math.max(-50, Math.min(50, m.supporters - Math.round(m.supporters * 0.1) + tableMood(next))) }));
  if (date.endsWith("-01")) next = withMedia(next, (m) => ({ ...m, boardMood: m.boardMood > 0 ? m.boardMood - 1 : m.boardMood < 0 ? m.boardMood + 1 : 0 }));
  return next;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function results(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  const me = state.playerClubId;
  // The manager plays his match after the day's tick, so results are read up to yesterday.
  const from = mediaOf(state).lastResultsDate ?? addDaysIso(date, -2);
  const until = addDaysIso(date, -1);
  const todays = state.fixtures.filter((f) => f.date > from && f.date <= until && state.results[f.id]);
  next = withMedia(next, (m) => ({ ...m, lastResultsDate: until }));
  for (const f of todays) {
    const r = state.results[f.id]!;
    const own = f.homeClubId === me || f.awayClubId === me;
    if (own) next = ownResult(next, f, date, emit);
    else if (f.type === "LEAGUE" && f.competitionId === state.competitionId) {
      const winner = matchWinnerClubId(r);
      if (!winner) continue;
      const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId;
      const wp = tablePos(next, winner), lp = tablePos(next, loser);
      if (wp && lp && wp >= lp + 6) next = publish(next, { key: `upset:${f.id}`, kind: "UPSET", date, importance: 2, clubIds: [winner, loser], fixtureId: f.id, topFlight: topFlight(next, winner), facts: { winner, loser, score: `${r.homeGoals}–${r.awayGoals}`, winnerPos: wp, loserPos: lp }, destinations: [{ route: "COMPETITION", competitionId: f.competitionId }] });
    }
  }
  return next;
}

function ownResult(state: CareerState, f: CareerFixture, date: string, emit: Emit): CareerState {
  const me = state.playerClubId;
  const r = state.results[f.id]!;
  const ownHome = f.homeClubId === me;
  const opp = ownHome ? f.awayClubId : f.homeClubId;
  const ownG = ownHome ? r.homeGoals : r.awayGoals, oppG = ownHome ? r.awayGoals : r.homeGoals;
  const won = matchWinnerClubId(r) === me, lost = matchWinnerClubId(r) === opp;
  const contribs = [...(ownHome ? r.homePlayerContributions : r.awayPlayerContributions)].sort((a, b) => b.goals - a.goals);
  const top = contribs[0];
  const stakes = matchStakes(state, f);
  const ownSusp = (ownHome ? r.homeStats : r.awayStats).twoMinuteSuspensions, oppSusp = (ownHome ? r.awayStats : r.homeStats).twoMinuteSuspensions;
  const controversy = lost && ownSusp - oppSusp >= 3 && oppG - ownG <= 3;
  let next = publish(state, { key: `result:${f.id}`, kind: "MATCH_REPORT", date, importance: Math.min(5, 1 + stakes.level), clubIds: [me, opp], fixtureId: f.id, topFlight: topFlight(state, me), playerIds: top ? [top.playerId] : [], facts: { home: f.homeClubId, away: f.awayClubId, hg: r.homeGoals, ag: r.awayGoals, ownSide: ownHome ? "home" : "away", topScorer: top && top.goals > 0 ? playerName(state, top.playerId) : undefined, topGoals: top?.goals, suspensions: ownSusp + oppSusp, derby: !!stakes.derby, tablePos: f.type === "LEAGUE" ? tablePos(state, me) ?? undefined : undefined }, destinations: [{ route: "MATCH_REPORT", fixtureId: f.id }] });
  if (controversy) next = publish(next, { key: `controversy:${f.id}`, kind: "CONTROVERSY", date, importance: 3, clubIds: [me, opp], fixtureId: f.id, topFlight: topFlight(state, me), facts: { home: f.homeClubId, away: f.awayClubId, detail: `${clubShort(me)} fick ${ownSusp} utvisningar mot ${oppSusp} för ${clubShort(opp)} i en match som avgjordes med ${oppG - ownG} mål.` }, destinations: [{ route: "MATCH_REPORT", fixtureId: f.id }] });
  // A post-match interview only when there is something to talk about.
  const oppPos = tablePos(state, opp), myPos = tablePos(state, me);
  const upsetWin = won && oppPos && myPos && myPos >= oppPos + 5;
  const heavy = lost && oppG - ownG >= 8;
  const topics = [] as Parameters<typeof openPress>[2]["topics"];
  if (controversy) topics.push({ topic: "REFEREE", opponentId: opp, detail: `${ownSusp} utvisningar mot ${oppSusp}.` });
  // Mid-series games speak through the match report; the press gathers after the opener and the games that decide.
  const seriesMoment = seriesTalkGame(state, f) || !!state.competitionTies?.[f.stage?.tieId ?? ""]?.winnerClubId;
  if ((seriesMoment && (stakes.level >= 4 || (stakes.level >= 3 && (stakes.derby || stakes.formerClub)))) || upsetWin || heavy || controversy) topics.push({ topic: won ? "AFTER_WIN" : "AFTER_DEFEAT", opponentId: opp, derby: !!stakes.derby });
  if (topics.length) next = openPress(next, date, { key: `post:${f.id}`, kind: "POST_MATCH", title: `Efter ${clubShort(f.homeClubId)}–${clubShort(f.awayClubId)}`, context: `${r.homeGoals}–${r.awayGoals}.${stakes.labels.length ? ` ${stakes.labels.join(" · ")}.` : ""}`, fixtureId: f.id, expiresOn: addDaysIso(date, 2), topics }, emit);
  next = aftermath(next, f, stakes, won, lost);
  // The rival coach has his say.
  if (stakes.rival) next = rivalAfter(next, f, date, won, lost, Math.abs(ownG - oppG), stakes.rival.staffId);
  // Form: three defeats in a row.
  const last = managerMatchesPlayed(next).slice(-3);
  if (last.length === 3 && last.every((x) => x.points === 0) && last.at(-1)!.date === f.date) {
    next = publish(next, { key: `form:${me}:${date}`, kind: "FORM", date, importance: 3, clubIds: [me], topFlight: topFlight(next, me), facts: { club: me, detail: `Tre raka förluster för ${clubShort(me)}.` }, destinations: [{ route: "BOARDROOM" }] });
    next = openPress(next, date, { key: `form:${date}`, kind: "INTERVIEW", title: "Tre raka förluster", context: "Lokalpressen vill prata om formen.", expiresOn: addDaysIso(date, 4), topics: [{ topic: "POOR_FORM" }] }, emit);
  }
  return next;
}

function rivalAfter(state: CareerState, f: CareerFixture, date: string, won: boolean, lost: boolean, margin: number, staffId: string): CareerState {
  const coach = coachPersona(state, staffId);
  if (!coach) return state;
  const rel = relationOf(state, "manager", staffId).score;
  let line: string | null = null;
  let delta = 0;
  if (!seriesTalkGame(state, f) && !state.competitionTies?.[f.stage?.tieId ?? ""]?.winnerClubId) return state;
  const pick = (pool: string[]) => freshLine(state, staffId, pool, `${f.id}:after`);
  if (lost && margin >= 5 && (coach.style === "FIERY" || coach.style === "PROUD" || rel <= -15)) { line = pick(["Vi visade vilka som är bäst. Det var inte ens nära.", "Det där var en lektion. Hoppas de lyssnade."]); delta = -4; }
  else if (won && coach.style === "PROUD" && rel <= -10) { line = pick(["De hade tur med domarna i dag.", "Vi förlorade mot visslan, inte mot dem."]); delta = -5; }
  else if (won && (coach.style === "DIPLOMAT" || rel >= 15)) { line = pick(["Stort grattis. De förtjänade segern.", "De var bättre i dag, det ska vi erkänna.", "Bra jobbat av dem. Vi får ta revansch."]); delta = 3; }
  if (!line) return state;
  const next = withMedia(state, (m) => adjustRelation(m, "manager", staffId, delta, date, `${coach.name} efter matchen: ”${line}”`));
  return publish(next, { key: `rival-after:${f.id}`, kind: "RIVAL_COMMENT", date, importance: delta < 0 ? 3 : 2, clubIds: [coach.clubId, state.playerClubId], personIds: [staffId], fixtureId: f.id, topFlight: topFlight(state, coach.clubId), facts: { coach: coach.name, club: coach.clubId, target: state.playerClubId, after: true, headline: `${coach.name}: ”${line}”` }, quote: { who: `${coach.name}, ${getClub(coach.clubId)?.shortName ?? ""}`, text: line }, destinations: [{ route: "MEDIA" }] });
}

// ---------------------------------------------------------------------------
// Previews: two days before a match that matters
// ---------------------------------------------------------------------------

/** In a play-off series the talk belongs to the opener and to the games that can decide it -- not to every game in between. */
export function seriesTalkGame(state: CareerState, f: CareerFixture): boolean {
  const tie = f.stage ? state.competitionTies?.[f.stage.tieId] : undefined;
  if (!tie || tie.format.kind !== "SERIES" || f.stage!.game <= 1) return true;
  const need = Math.ceil(tie.format.series.bestOf / 2);
  return Object.values(tieWins(state, tie)).some((w) => w >= need - 1);
}

/** A line the coach has not just used: the most recent quote from him is left out of the draw. */
function freshLine(state: CareerState, staffId: string, pool: readonly string[], seed: string): string {
  const last = Object.values(mediaOf(state).stories).filter((x) => x.kind === "RIVAL_COMMENT" && x.personIds?.includes(staffId)).sort((a, b) => b.date.localeCompare(a.date))[0]?.quote?.text;
  const options = pool.filter((l) => l !== last);
  return (options.length ? options : pool)[Math.floor(hash(seed) * (options.length || pool.length))]!;
}

const PROVOCATIONS = ["De pratar mycket i {opp}. Vi får se vem som pratar efter matchen.", "Jag har sett deras matcher. Det finns inget där som skrämmer oss.", "{mgr} har haft tur hittills. Turen tar slut någon gång."];
const PRAISE = ["{opp} har gjort ett fantastiskt jobb. Det blir en riktig kamp.", "Jag har stor respekt för {mgr} och hans lag.", "Två lag som vill spela handboll. Det kan bli en fin match."];

function previews(state: CareerState, date: string, emit: Emit): CareerState {
  const me = state.playerClubId;
  const f = state.fixtures.find((x) => x.date === addDaysIso(date, 2) && !state.results[x.id] && (x.homeClubId === me || x.awayClubId === me));
  if (!f) return state;
  const stakes = matchStakes(state, f);
  if (stakes.level < 3 || !seriesTalkGame(state, f)) return state;
  const opp = f.homeClubId === me ? f.awayClubId : f.homeClubId;
  const rivalry = rivalryBetween(state, me, opp);
  const lastMeeting = rivalry.meetings.at(-1);
  let next = publish(state, { key: `preview:${f.id}`, kind: stakes.derby ? "DERBY_PREVIEW" : "BIG_MATCH_PREVIEW", date, importance: stakes.level, clubIds: [me, opp], fixtureId: f.id, topFlight: topFlight(state, me), facts: { home: f.homeClubId, away: f.awayClubId, homePos: tablePos(state, f.homeClubId) ?? "-", awayPos: tablePos(state, f.awayClubId) ?? "-", when: `på ${f.date}`, angle: stakes.labels.join(" · "), history: lastMeeting ? `${clubShort(lastMeeting.homeClubId)} hemma, ${lastMeeting.homeGoals}–${lastMeeting.awayGoals}` : undefined }, destinations: [{ route: "MATCH_PREVIEW" }] });
  const topics = [{ topic: "PREVIEW" as const, opponentId: opp, derby: !!stakes.derby, rivalStaffId: stakes.rival?.staffId }];
  // The opposing coach may speak first -- his personality and your history decide how.
  if (stakes.rival) {
    const coach = coachPersona(next, stakes.rival.staffId)!;
    const provoke = coach.style === "FIERY" || coach.style === "PROUD" || stakes.rival.relation <= -15 || (coach.style === "JOKER" && hash(`${f.id}:joke`) < 0.5);
    const praise = !provoke && (coach.style === "DIPLOMAT" || stakes.rival.relation >= 15);
    if (provoke || praise) {
      const mgr = "deras tränare";
      const line = freshLine(next, coach.staffId, (provoke ? PROVOCATIONS : PRAISE).map((l) => l.replace("{opp}", clubShort(me)).replace("{mgr}", "deras tränare")), `${f.id}:line`).replace("{opp}", clubShort(me)).replace("{mgr}", mgr);
      next = withMedia(next, (m) => adjustRelation(m, "manager", coach.staffId, provoke ? -4 : 2, date, `${coach.name} före matchen: ”${line}”`));
      next = publish(next, { key: `rival-pre:${f.id}`, kind: "RIVAL_COMMENT", date, importance: provoke ? 3 : 2, clubIds: [coach.clubId, me], personIds: [coach.staffId], fixtureId: f.id, topFlight: topFlight(next, coach.clubId), facts: { coach: coach.name, club: coach.clubId, target: me, headline: `${coach.name} ${provoke ? "laddar" : "hyllar"} inför mötet: ”${line}”` }, quote: { who: `${coach.name}, ${getClub(coach.clubId)?.shortName ?? ""}`, text: line }, destinations: [{ route: "MATCH_PREVIEW" }] });
      if (provoke) topics.push({ topic: "RIVAL_RESPONSE", opponentId: opp, rivalStaffId: coach.staffId } as never);
    }
  }
  // One press conference a day: after a match the post-match questions come first.
  if (Object.values(mediaOf(next).press).some((p) => p.date === date && p.kind === "POST_MATCH")) return next;
  return openPress(next, date, { key: `pre:${f.id}`, kind: "PRE_MATCH", title: `Presskonferens inför ${clubShort(f.homeClubId)}–${clubShort(f.awayClubId)}`, context: stakes.labels.join(" · "), fixtureId: f.id, expiresOn: f.date, topics }, emit);
}

// ---------------------------------------------------------------------------
// The day's own events (career, board, players, sales)
// ---------------------------------------------------------------------------

function fromEvents(state: CareerState, date: string, events: CareerEvent[], emit: Emit): CareerState {
  let next = state;
  const me = state.playerClubId;
  for (const e of events) {
    if (e.type === "MANAGER_CAREER" && e.id.startsWith("MANAGER_CAREER:dismissed:")) {
      const club = e.id.split(":")[2]!;
      next = publish(next, { key: e.id, kind: "MANAGER_DISMISSED", date, importance: topFlight(next, club) ? 4 : 3, clubIds: [club], personIds: ["manager"], topFlight: topFlight(next, club), facts: { club, manager: "huvudtränaren", reason: e.summary.split(" Du leder")[0] }, destinations: [{ route: "MANAGER" }] });
    } else if (e.type === "MANAGER_CAREER" && e.id.startsWith("MANAGER_CAREER:appointed:")) {
      const club = e.id.split(":")[2]!;
      const from = next.managerCareer?.stints.at(-2)?.clubId;
      next = publish(next, { key: e.id, kind: "MANAGER_APPOINTED", date, importance: topFlight(next, club) ? 4 : 3, clubIds: [club], personIds: ["manager"], topFlight: topFlight(next, club), facts: { club, manager: "Den nya tränaren", from }, destinations: [{ route: "MANAGER" }] });
      next = openPress(next, date, { key: `appointed:${club}:${date}`, kind: "INTERVIEW", title: "Presentationen som ny huvudtränare", context: `Lokalmedia och Handbollskanalen är på plats.`, expiresOn: addDaysIso(date, 5), topics: [{ topic: "APPOINTMENT" }] }, emit);
    } else if (e.type === "BOARD_UPDATE" && /:(warning|final)$/.test(e.id.split("meeting:")[1] ?? "")) {
      next = publish(next, { key: e.id, kind: "BOARD_PRESSURE", date, importance: e.id.endsWith(":final") ? 4 : 3, clubIds: [me], personIds: ["manager"], topFlight: topFlight(next, me), facts: { club: me, confidence: next.board?.confidence ?? 0, detail: e.subject }, destinations: [{ route: "BOARDROOM" }] });
      next = openPress(next, date, { key: `board:${e.id}`, kind: "INTERVIEW", title: "Frågor om styrelsens förtroende", context: e.subject, expiresOn: addDaysIso(date, 5), topics: [{ topic: "BOARD_PRESSURE" }] }, emit);
    } else if (e.type === "PLAYER_DYNAMICS" && e.id.includes(":request:")) {
      const playerId = e.primaryEntity?.entityId ?? e.id.split(":request:")[1]?.split(":")[0];
      if (!playerId) continue;
      next = publish(next, { key: e.id, kind: "PLAYER_UNHAPPY", date, importance: 2, clubIds: [me], playerIds: [playerId], topFlight: topFlight(next, me), facts: { club: me, reason: e.summary }, destinations: [{ route: "PLAYER_PROFILE", playerId }] });
      next = openPress(next, date, { key: `unhappy:${playerId}:${date}`, kind: "INTERVIEW", title: `Frågor om ${playerName(next, playerId)}`, context: "Nyheten om transferbegäran har läckt.", expiresOn: addDaysIso(date, 4), topics: [{ topic: "PLAYER_UNHAPPY", playerId }] }, emit);
    } else if (e.type === "TRANSFER_OFFER" && e.id.endsWith(":completed")) {
      const offerId = e.id.replace("TRANSFER_OFFER:offer:", "").replace(":completed", "");
      const o = next.incomingOffers?.[offerId];
      if (!o) continue;
      next = publish(next, { key: e.id, kind: "SALE", date, importance: o.feeEur >= 60000 ? 3 : 2, clubIds: [me, o.fromClubId], playerIds: [o.playerId], topFlight: topFlight(next, me), facts: { from: me, to: o.fromClubId, fee: formatEur(o.feeEur), foreign: o.foreign }, destinations: [{ route: "TRANSFER_OFFER", offerId }] });
      if (o.feeEur >= 60000) next = openPress(next, date, { key: `sale:${offerId}`, kind: "INTERVIEW", title: `Försäljningen av ${playerName(next, o.playerId)}`, context: `${formatEur(o.feeEur)} till ${clubShort(o.fromClubId)}.`, expiresOn: addDaysIso(date, 4), topics: [{ topic: "TRANSFER", playerId: o.playerId }] }, emit);
    } else if (e.type === "CLUB_FINANCE" && e.id.endsWith(":CRISIS")) {
      next = publish(next, { key: e.id, kind: "CRISIS", date, importance: 4, clubIds: [me], topFlight: topFlight(next, me), facts: { club: me }, destinations: [{ route: "FINANCE" }] });
    }
  }
  return next;
}

/** CPU head-coach changes, from the staff-appointment record. */
function coachChanges(state: CareerState, date: string): CareerState {
  let next = state;
  for (const a of state.staffAppointments ?? []) {
    if (a.date !== date || a.role !== "HEAD_COACH" || a.clubId === state.playerClubId) continue;
    const name = Object.values(state.staffRoster).flat().find((m) => m.id === a.staffId)?.displayName ?? state.staffMarket?.freeAgents[a.staffId]?.displayName ?? "tränaren";
    const change = a.kind === "APPOINTED" ? "APPOINTED" : "DISMISSED";
    next = publish(next, { key: `coach:${a.clubId}:${a.staffId}:${a.kind}:${date}`, kind: "COACH_CHANGE", date, importance: topFlight(next, a.clubId) ? 3 : 2, clubIds: [a.clubId], personIds: [a.staffId], topFlight: topFlight(next, a.clubId), facts: { club: a.clubId, coach: name, change, reason: a.kind === "DISMISSED" ? "Resultaten har inte räckt." : undefined }, destinations: [{ route: "CLUB" }] });
  }
  return next;
}

/** Significant transfers anywhere in the Swedish game: big fees, moves abroad, top-flight signings. */
function transfers(state: CareerState, date: string): CareerState {
  let next = state;
  for (const o of Object.values(state.transferOffers ?? {})) {
    if (o.status !== "COMPLETED" || (o.scheduledCompletionDate ?? o.resolvedDate ?? o.offeredDate) !== date || !o.toClubId || o.dealType !== "PERMANENT") continue;
    const foreign = !getClub(o.toClubId)?.competitionId?.startsWith("se") && !getClub(o.toClubId)?.competitionId?.startsWith("swe");
    if (o.transferFeeEur < 25000 && !foreign && !topFlight(next, o.toClubId)) continue;
    next = publish(next, { key: `transfer:${o.id}`, kind: "TRANSFER", date, importance: o.transferFeeEur >= 80000 ? 3 : 2, clubIds: [o.toClubId, o.fromClubId].filter(Boolean), playerIds: [o.playerId], topFlight: topFlight(next, o.toClubId), facts: { from: o.fromClubId, to: o.toClubId, fee: o.transferFeeEur ? formatEur(o.transferFeeEur) : undefined, foreign }, destinations: [{ route: "PLAYER_PROFILE", playerId: o.playerId }] });
  }
  return next;
}

/** Champions, promotion, relegation, awards -- once each, when the season's outcome is known. */
function seasonStories(state: CareerState, date: string): CareerState {
  const o = state.seasonOutcome;
  if (!o) return state;
  let next = state;
  if (o.champion) next = publish(next, { key: `title:${o.seasonId}`, kind: "TITLE", date, importance: 5, clubIds: [o.champion], topFlight: true, facts: { club: o.champion, season: o.seasonId }, destinations: [{ route: "SEASON" }] });
  for (const c of o.promoted) next = publish(next, { key: `promoted:${o.seasonId}:${c}`, kind: "PROMOTION", date, importance: c === state.playerClubId ? 4 : 3, clubIds: [c], topFlight: true, facts: { club: c }, destinations: [{ route: "SEASON" }] });
  for (const c of o.relegated) next = publish(next, { key: `relegated:${o.seasonId}:${c}`, kind: "RELEGATION", date, importance: c === state.playerClubId ? 4 : 3, clubIds: [c], topFlight: true, facts: { club: c }, destinations: [{ route: "SEASON" }] });
  next = seasonMood(next, o);
  for (const a of o.awards.filter((x) => x.id === "MVP" || x.id === "TOP_SCORER")) next = publish(next, { key: `award:${o.seasonId}:${a.id}:${a.competitionId}`, kind: "AWARD", date, importance: 3, clubIds: [a.clubId], playerIds: [a.playerId], topFlight: a.competitionId === HANDBOLLSLIGAN, facts: { award: a.label, detail: `${a.value} för ${clubShort(a.clubId)}.`, name: playerName(next, a.playerId) }, destinations: [{ route: "SEASON" }] });
  return next;
}

/** The season verdict in the stands: titles and promotion lift, relegation and missing expectations hurt. Once per season. */
function seasonMood(state: CareerState, o: NonNullable<CareerState["seasonOutcome"]>): CareerState {
  const me = state.playerClubId;
  const mark = `${o.seasonId}:${me}`;
  if (mediaOf(state).moodMarks?.includes(mark)) return state;
  const comp = clubCompetitionId(state, me);
  const final = comp ? competitionTable(state, comp).findIndex((r) => r.clubId === me) + 1 : 0;
  const predicted = comp ? predictedPositionOf(state, me, comp) : 0;
  let delta = 0;
  if (o.champion === me) delta += 8;
  if (o.promoted.includes(me)) delta += 8;
  if (o.relegated.includes(me)) delta -= 10;
  if (final > 0 && predicted > 0) delta += final <= predicted - 3 ? 3 : final >= predicted + 3 ? -4 : 0;
  return withMedia(state, (m) => ({ ...m, supporters: Math.max(-50, Math.min(50, m.supporters + delta)), moodMarks: [...(m.moodMarks ?? []), mark].slice(-20) }));
}

// ---------------------------------------------------------------------------
// Weekly: rumours, talent, records
// ---------------------------------------------------------------------------

function weekly(state: CareerState, date: string): CareerState {
  let next = withMedia(state, (m) => ({ ...m, lastWeekly: date }));
  const me = state.playerClubId;
  next = roundUp(next, date);
  // One rumour a week about an open bid for the manager's players.
  const bid = Object.values(state.incomingOffers ?? {}).find((o) => o.status === "OPEN" || o.status === "COUNTERED");
  if (bid) next = publish(next, { key: `rumour:${bid.id}`, kind: "TRANSFER_RUMOUR", date, importance: 2, clubIds: [me, bid.fromClubId], playerIds: [bid.playerId], topFlight: topFlight(next, me), facts: { club: me, buyer: bid.fromClubId }, destinations: [{ route: "TRANSFER_OFFER", offerId: bid.id }] });
  // Records and milestones from the career's own archive (seasonHistory + this season).
  const squad = getCareerClubSquad(next, me);
  for (const p of squad) {
    const now = next.playerSeasonStats[p.id]?.goals ?? 0;
    const past = (next.seasonHistory ?? []).map((h) => h.stats[p.id]?.goals ?? 0);
    const clubBest = Math.max(0, ...(next.seasonHistory ?? []).flatMap((h) => Object.values(h.stats).map((s) => s.goals)));
    const career = past.reduce((a, b) => a + b, 0) + now;
    for (const milestone of [100, 250, 500]) if (career >= milestone && career - now < milestone + 0 && past.reduce((a, b) => a + b, 0) < milestone) next = publish(next, { key: `record:${p.id}:${milestone}`, kind: "RECORD", date, importance: milestone >= 250 ? 3 : 2, clubIds: [me], playerIds: [p.id], topFlight: topFlight(next, me), facts: { detail: `${p.firstName} ${p.lastName} har passerat ${milestone} mål under din tid i klubben.` }, destinations: [{ route: "PLAYER_PROFILE", playerId: p.id }] });
    if (clubBest > 0 && now > clubBest && (next.seasonHistory?.length ?? 0) > 0) next = publish(next, { key: `record-season:${next.seasonId}:${p.id}`, kind: "RECORD", date, importance: 3, clubIds: [me], playerIds: [p.id], topFlight: topFlight(next, me), facts: { detail: `${now} mål den här säsongen – fler än någon spelare gjort under en säsong i karriären (${clubBest}).` }, destinations: [{ route: "PLAYER_PROFILE", playerId: p.id }] });
    // Talent: a young player who has broken into the team.
    const age = p.birthYear ? Number(date.slice(0, 4)) - p.birthYear : null;
    const st = next.playerSeasonStats[p.id];
    if (age !== null && age <= 20 && st && st.starts >= 8 && st.goals >= 15) next = publish(next, { key: `talent:${next.seasonId}:${p.id}`, kind: "TALENT", date, importance: 2, clubIds: [me], playerIds: [p.id], topFlight: topFlight(next, me), facts: { club: me, age, goals: st.goals }, destinations: [{ route: "PLAYER_PROFILE", playerId: p.id }] });
  }
  return next;
}

/** A reported statement: the press want an answer -- and an apology can soften the decision. */
function disciplinePress(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const c of Object.values(mediaOf(state).discipline)) {
    if (c.status !== "REPORTED") continue;
    const pid = `press:dn-${c.id}`;
    const press = mediaOf(next).press[pid];
    if (!press) {
      next = publish(next, { key: `reported:${c.id}`, kind: "DISCIPLINE", date, importance: 3, clubIds: [next.playerClubId], personIds: ["manager"], topFlight: topFlight(next, next.playerClubId), facts: { headline: `${clubShort(next.playerClubId)}-tränaren anmäld till disciplinnämnden`, detail: `Efter uttalandet: ”${c.statement}”`, provision: `Anmäld enligt ${c.provision}.` }, destinations: [{ route: "MEDIA" }] });
      next = openPress(next, date, { key: `dn-${c.id}`, kind: "INTERVIEW", title: "Frågor om anmälan", context: `Du är anmäld till SHF:s disciplinnämnd. Beslut väntas ${c.decisionOn}.`, expiresOn: addDaysIso(c.decisionOn, -1), topics: [{ topic: "DISCIPLINE" }] }, emit);
    } else if (press.status === "ANSWERED" && press.answers?.q0 === "DIPLOMATIC" && !c.apologised) next = apologise(next, c.id);
  }
  return next;
}

/** Handbollskanalen's weekly round-up of the top flight: the leader and the week's biggest win, plus a change at the top. */
function roundUp(state: CareerState, date: string): CareerState {
  const comp = HANDBOLLSLIGAN;
  const week = state.fixtures.filter((f) => f.competitionId === comp && f.type === "LEAGUE" && f.date >= addDaysIso(date, -7) && f.date < date && state.results[f.id]);
  if (week.length < 4) return state;
  const table = competitionTable(state, comp);
  const leader = table[0];
  if (!leader) return state;
  const margin = (id: string) => Math.abs(state.results[id]!.homeGoals - state.results[id]!.awayGoals);
  const biggest = [...week].sort((a, b) => margin(b.id) - margin(a.id))[0]!;
  const br = state.results[biggest.id]!;
  const prevLeader = mediaOf(state).seen.filter((k) => k.startsWith(`leader:${state.seasonId}:`)).at(-1)?.split(":")[2];
  let next = state;
  if (leader.clubId !== prevLeader && leader.played >= 4) next = publish(next, { key: `leader:${state.seasonId}:${leader.clubId}:${date}`, kind: "FORM", date, importance: 3, clubIds: [leader.clubId], topFlight: true, facts: { club: leader.clubId, leaderChange: true, detail: `${clubShort(leader.clubId)} leder serien med ${leader.points} poäng efter ${leader.played} omgångar.` }, destinations: [{ route: "COMPETITION", competitionId: comp }] });
  return publish(next, { key: `roundup:${date}`, kind: "MATCH_REPORT", date, importance: 2, onlyOutlets: ["handbollskanalen"], clubIds: [biggest.homeClubId, biggest.awayClubId], topFlight: true, fixtureId: biggest.id, facts: { home: biggest.homeClubId, away: biggest.awayClubId, hg: br.homeGoals, ag: br.awayGoals, ownSide: "home", roundup: true, leader: leader.clubId, leaderPoints: leader.points }, destinations: [{ route: "COMPETITION", competitionId: comp }] });
}


/** Weekly: the league table against the board's predicted position (once six rounds are played). */
function tableMood(state: CareerState): number {
  const me = state.playerClubId, comp = clubCompetitionId(state, me);
  if (!comp) return 0;
  const row = competitionTable(state, comp).find((r) => r.clubId === me);
  if (!row || row.played < 6) return 0;
  const pos = competitionTable(state, comp).indexOf(row) + 1, predicted = predictedPositionOf(state, me, comp);
  return pos <= predicted - 3 ? 1 : pos >= predicted + 3 ? -1 : 0;
}

/** How the stands take a result, given who was expected to win: favourites are expected to win, underdogs are cheered for trying. */
function expectationMood(state: CareerState, f: CareerFixture, won: boolean, lost: boolean): { delta: number; text: string } | null {
  const me = state.playerClubId, opp = f.homeClubId === me ? f.awayClubId : f.homeClubId;
  const r = state.results[f.id];
  const margin = r ? Math.abs(r.homeGoals - r.awayGoals) : 0;
  const comp = clubCompetitionId(state, me), oppComp = clubCompetitionId(state, opp);
  let gap = 0;
  if (comp && comp === oppComp) gap = predictedPositionOf(state, opp, comp) - predictedPositionOf(state, me, comp);
  else if (comp && oppComp) gap = comp === HANDBOLLSLIGAN ? 6 : oppComp === HANDBOLLSLIGAN ? -6 : 0;
  const role = gap >= 4 ? "FAVOURITE" : gap <= -4 ? "UNDERDOG" : "EVEN";
  let delta = role === "FAVOURITE" ? (won ? 0 : lost ? -2 : -1) : role === "UNDERDOG" ? (won ? 2 : lost ? 0 : 1) : (won ? 1 : lost ? -1 : 0);
  if (lost && margin >= 8) delta -= 1;
  if (won && margin >= 8 && role !== "FAVOURITE") delta += 1;
  if (!delta) return null;
  const text = role === "FAVOURITE" ? (lost ? (margin >= 8 ? "Utklassade som favoriter – publiken buade" : "Förlust som favorit – supportrarna är besvikna") : "Bara oavgjort som favorit")
    : role === "UNDERDOG" ? (won ? "Skräll! Supportrarna jublar" : "Ett starkt kryss mot ett bättre lag")
    : won ? (margin >= 8 ? "En storseger som minns" : "En välkommen seger") : (margin >= 8 ? "En storförlust som svider" : "En förlust i en jämn match");
  return { delta, text };
}

/** What a result means beyond the table: words before the match are judged, derbies and finals are felt. Bounded and recorded. */
function aftermath(state: CareerState, f: CareerFixture, stakes: MatchStakes, won: boolean, lost: boolean): CareerState {
  const out: Consequence[] = [];
  const pressure = mediaOf(state).pressure[f.id];
  let supporters = 0, board = 0, team = 0;
  // Every result is judged against what was expected of it.
  const mood = expectationMood(state, f, won, lost);
  if (mood) { supporters += mood.delta; out.push({ area: "SUPPORTERS", delta: mood.delta, text: mood.text }); }
  if (pressure && pressure.level >= 2) {
    if (lost) { supporters -= 2; board -= 1; out.push({ area: "SUPPORTERS", delta: -2, text: "Du lovade mer före matchen" }, { area: "BOARD", delta: -1, text: "Styrelsen noterade de stora orden" }); }
    else if (won) { supporters += 1; out.push({ area: "SUPPORTERS", delta: 1, text: "Orden före matchen höll" }); }
  }
  if (stakes.derby) {
    if (won) { supporters += 3; team += 2; out.push({ area: "SUPPORTERS", delta: 3, text: "Derbysegern firades" }, { area: "TEAM", delta: 2, text: "Truppen bär derbysegern med sig" }); }
    else if (lost) { supporters -= 3; team -= 1; out.push({ area: "SUPPORTERS", delta: -3, text: "Derbyförlusten svider" }, { area: "TEAM", delta: -1, text: "Tungt i omklädningsrummet efter derbyt" }); }
  }
  if (stakes.level >= 5 && won) { board += 2; out.push({ area: "BOARD", delta: 2, text: "En final vunnen" }); }
  if (stakes.formerClub && won) out.push({ area: "REPUTATION", delta: 0, text: "Segern mot din gamla klubb noterades" });
  if (!out.length) return state;
  let next = withMedia(state, (m) => ({ ...m, supporters: Math.max(-50, Math.min(50, m.supporters + supporters)), boardMood: Math.max(-6, Math.min(6, m.boardMood + board)), aftermath: { ...(m.aftermath ?? {}), [f.id]: out } }));
  if (team) for (const id of managerSquadIds(next)) next = addMoraleShock(next, id, team, team > 0 ? "Derbysegern" : "Derbyförlusten", 10);
  return next;
}
