// HM-PLAYTEST-01 4.1: opponent scouting before a match.
//
// Two kinds of content, kept apart:
//
//   OBSERVED   what the opponent's played matches show (results and team
//              stats already in the career). Public, always accurate, and
//              only as rich as the number of games played.
//   SCOUTED    how the opponent will actually set up -- the very plan the
//              match engine will give them (defence system, aggression,
//              tempo, attacking identity, likely starting seven). Hidden
//              until someone scouts it. Each claim is right with a
//              probability set by the assigned staff member's suitability
//              and the amount of evidence; a weak scout produces a less
//              certain, sometimes wrong, report and says so.
//
// Deterministic: the same request in the same save always yields the same
// report. Nothing here consumes the career's RNG or touches the match.
import type { CareerFixture, CareerState } from "../career/types";
import { getCareerClubSquad } from "../career/careerWorld";
import { withoutNationalDuty } from "../nationalTeam/duty";
import { resolveClubMatchPlanForFixture } from "../career/playerMatchStrength";
import { engineDefenceSystem } from "../matchPlan/defenceFormation";
import { engineDefensiveAggression } from "../matchPlan/defensiveAggression";
import { engineOffensiveTempo } from "../matchPlan/offensiveTempo";
import { computeRoleSuitability } from "../staff/roleSuitability";
import type { ResolvedStaffMember, StaffRole } from "../staff/types";
import { getClub } from "../game-data";

export type ScoutingConfidence = "HIGH" | "MEDIUM" | "LOW";
export const CONFIDENCE_LABEL: Record<ScoutingConfidence, string> = { HIGH: "Hög", MEDIUM: "Medel", LOW: "Låg" };

export type ScoutedClaim = { readonly topic: string; readonly text: string; readonly confidence: ScoutingConfidence };

export type OpponentScoutReport = {
  readonly fixtureId: string;
  readonly opponentClubId: string;
  readonly staffId: string;
  readonly staffName: string;
  readonly createdOn: string;
  readonly reliability: number;
  readonly reliabilityLabel: string;
  readonly evidenceMatches: number;
  readonly observed: readonly string[];
  readonly scouted: readonly ScoutedClaim[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly recommendations: readonly string[];
};

export type OpponentScoutingRequest = { readonly fixtureId: string; readonly staffId: string; readonly requestedOn: string; readonly readyOn: string };

export type OpponentScoutingState = {
  /** Delegated: the chosen staff member scouts every upcoming opponent automatically. */
  readonly delegateStaffId?: string;
  readonly requests: Readonly<Record<string, OpponentScoutingRequest>>;
  readonly reports: Readonly<Record<string, OpponentScoutReport>>;
};

export const SCOUTING_ROLES: readonly StaffRole[] = ["ANALYST", "SCOUT", "ASSISTANT_COACH", "HEAD_COACH"];
/** Days a report takes; a stronger analyst is a little quicker. */
export const SCOUTING_DAYS = 3;

export function emptyOpponentScouting(): OpponentScoutingState {
  return { requests: {}, reports: {} };
}

/** Staff of the manager's club who can be sent to scout an opponent. */
export function opponentScoutingCandidates(state: CareerState): ResolvedStaffMember[] {
  return (state.staffRoster?.[state.playerClubId] ?? []).filter((m) => m.roles.some((r) => SCOUTING_ROLES.includes(r)));
}

/** 1-20: how good this person is at opponent analysis (best of their scouting-relevant roles). */
export function scoutingAbility(member: ResolvedStaffMember): number {
  const roles = member.roles.filter((r) => SCOUTING_ROLES.includes(r));
  return Math.max(...(roles.length ? roles : (["ANALYST"] as StaffRole[])).map((r) => computeRoleSuitability(member, r === "HEAD_COACH" ? "ANALYST" : r)));
}

/** 0.35-0.95. Ability carries most of it; each observed match adds a little, up to five. */
export function scoutingReliability(ability: number, evidenceMatches: number): number {
  return Math.max(0.35, Math.min(0.95, 0.3 + (Math.max(1, Math.min(20, ability)) / 20) * 0.45 + Math.min(5, evidenceMatches) * 0.04));
}

function confidenceOf(reliability: number): ScoutingConfidence {
  return reliability >= 0.78 ? "HIGH" : reliability >= 0.58 ? "MEDIUM" : "LOW";
}

/** Deterministic unit value from a string (FNV-1a). */
function unit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

type TeamLine = { goals: number; conceded: number; shots: number; shootingPct: number; turnovers: number; savesPct: number; suspensions: number; sevenAtt: number; sevenGoals: number };

function teamLines(state: CareerState, clubId: string): TeamLine[] {
  const out: TeamLine[] = [];
  for (const [id, r] of Object.entries(state.results)) {
    const f = state.fixtures.find((x) => x.id === id);
    if (!f || f.type === "FRIENDLY" || (f.homeClubId !== clubId && f.awayClubId !== clubId)) continue;
    const home = f.homeClubId === clubId;
    const own = home ? r.homeStats : r.awayStats, opp = home ? r.awayStats : r.homeStats;
    if (!own || !opp) continue;
    out.push({ goals: own.goals, conceded: opp.goals, shots: own.shots, shootingPct: own.shootingPct, turnovers: own.turnovers, savesPct: own.shotsFaced ? (own.saves / own.shotsFaced) * 100 : 0, suspensions: own.twoMinuteSuspensions, sevenAtt: own.sevenMetreAttempts, sevenGoals: own.sevenMetreGoals });
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function leagueAverages(state: CareerState): TeamLine | null {
  const lines = Object.entries(state.results).flatMap(([id, r]) => {
    const f = state.fixtures.find((x) => x.id === id);
    if (!f || f.competitionId !== state.competitionId || !r.homeStats || !r.awayStats) return [];
    return [r.homeStats, r.awayStats].map((s, i) => ({ goals: s.goals, conceded: (i === 0 ? r.awayStats : r.homeStats).goals, shots: s.shots, shootingPct: s.shootingPct, turnovers: s.turnovers, savesPct: s.shotsFaced ? (s.saves / s.shotsFaced) * 100 : 0, suspensions: s.twoMinuteSuspensions, sevenAtt: s.sevenMetreAttempts, sevenGoals: s.sevenMetreGoals }));
  });
  if (lines.length < 6) return null;
  const k = <K extends keyof TeamLine>(key: K) => avg(lines.map((l) => l[key]));
  return { goals: k("goals"), conceded: k("conceded"), shots: k("shots"), shootingPct: k("shootingPct"), turnovers: k("turnovers"), savesPct: k("savesPct"), suspensions: k("suspensions"), sevenAtt: k("sevenAtt"), sevenGoals: k("sevenGoals") };
}

const DEFENCE_ALTERNATIVE: Record<string, string> = { "6:0": "5:1", "5:1": "6:0" };
const TEMPO_LABEL: Record<string, string> = { SLOW: "lugnt, tålmodigt", BALANCED: "balanserat", QUICK: "högt, gärna kontringar" };
const AGGRESSION_LABEL: Record<string, string> = { LOW: "avvaktande och zonbundet", BALANCED: "balanserat", HIGH: "aggressivt och utflyttat" };
const IDENTITY_LABEL: Record<string, string> = { BALANCED: "balanserat anfall", COMBINATION: "inövade kombinationer", WIDTH: "brett spel med kanterna", DIRECT: "direkta genombrott från niometer" };
const POSITION_NAME: Record<string, string> = { V6: "vänstersexa", V9: "vänsternia", M9: "mittnia", H9: "högernia", H6: "högersexa", M6: "mittsexa", GK: "målvakt" };

export function buildOpponentScoutReport(state: CareerState, fixture: CareerFixture, staff: ResolvedStaffMember, createdOn: string): OpponentScoutReport {
  const opponentId = fixture.homeClubId === state.playerClubId ? fixture.awayClubId : fixture.homeClubId;
  const lines = teamLines(state, opponentId);
  const reliability = scoutingReliability(scoutingAbility(staff), lines.length);
  const seed = `${state.saveSeed}:${fixture.id}:${staff.id}:scout`;
  const right = (topic: string) => unit(`${seed}:${topic}`) < reliability;
  const hedge = (topic: string): ScoutingConfidence => confidenceOf(Math.min(0.95, reliability + (unit(`${seed}:${topic}:c`) - 0.5) * 0.1));

  // The truth: exactly what the engine will hand this opponent at kickoff.
  const squad = withoutNationalDuty(state, getCareerClubSquad(state, opponentId));
  const plan = resolveClubMatchPlanForFixture(opponentId, fixture.id, squad, undefined, state.tactics[opponentId], state.playerMatchDefaults);
  const scouted: ScoutedClaim[] = [];
  if (plan) {
    const defence = engineDefenceSystem(plan.defencePlan.baseFormation);
    scouted.push({ topic: "Försvarsstruktur", text: `Spelar troligen ${(right("defence") ? defence : DEFENCE_ALTERNATIVE[defence] ?? defence).replace(":", "–")}-försvar, ${AGGRESSION_LABEL[right("aggression") ? engineDefensiveAggression(plan.defencePlan) : "BALANCED"]}.`, confidence: hedge("defence") });
    const tempo = engineOffensiveTempo(plan.attackPlan);
    scouted.push({ topic: "Tempo", text: `Anfallstempot är ${TEMPO_LABEL[right("tempo") ? tempo : tempo === "QUICK" ? "BALANCED" : "QUICK"]}.`, confidence: hedge("tempo") });
    const identity = plan.attackPlan.ballCirculation === "DIRECT" ? "DIRECT" : plan.attackPlan.wingUsage === "HIGH" ? "WIDTH" : plan.attackPlan.structureFreedom === "STRUCTURED" ? "COMBINATION" : "BALANCED";
    scouted.push({ topic: "Anfallsmönster", text: `Bygger på ${IDENTITY_LABEL[right("identity") ? identity : identity === "BALANCED" ? "COMBINATION" : "BALANCED"]}.`, confidence: hedge("identity") });
    // Likely starters: the scout gets each name right with the same probability; misses are left out, never invented.
    const byId = new Map(squad.map((p) => [p.id, p]));
    const known = plan.attackStartingUnit.slots.filter((s) => s.playerId && right(`starter:${s.playerId}`)).map((s) => `${POSITION_NAME[s.position] ?? s.position} ${byId.get(s.playerId)?.lastName ?? "?"}`);
    if (known.length) scouted.push({ topic: "Trolig startsju", text: `${known.join(", ")}${known.length < 7 ? ` (${7 - known.length} positioner osäkra)` : ""}.`, confidence: hedge("starters") });
  }
  const scorers = squad.map((p) => ({ p, s: state.playerSeasonStats[p.id] })).filter((x) => x.s && x.s.appearances > 0 && x.s.goals > 0).sort((a, b) => b.s!.goals - a.s!.goals).slice(0, 3);
  if (scorers.length) scouted.push({ topic: "Nyckelspelare", text: scorers.map(({ p, s }) => `${p.firstName} ${p.lastName} (${p.position}, ${s!.goals} mål på ${s!.appearances} matcher)`).join("; ") + ".", confidence: "HIGH" });
  const coach = (state.staffRoster?.[opponentId] ?? []).find((m) => m.roles.includes("HEAD_COACH"));
  if (coach) scouted.push({ topic: "Motståndartränaren", text: `${coach.displayName}: ${engineDefenceSystem(plan?.defencePlan.baseFormation) === "5:1" ? "vågar flytta ut försvaret" : "håller fast vid en stabil grundformation"} och byter sällan system under match.`, confidence: hedge("coach") });

  // Observed: public facts and comparison with the league.
  const observed: string[] = [], strengths: string[] = [], weaknesses: string[] = [];
  const league = leagueAverages(state);
  if (lines.length === 0) observed.push("Inga spelade tävlingsmatcher att analysera ännu – rapporten bygger enbart på scouting.");
  else {
    const g = avg(lines.map((l) => l.goals)), c = avg(lines.map((l) => l.conceded)), t = avg(lines.map((l) => l.turnovers)), s = avg(lines.map((l) => l.shootingPct)), sv = avg(lines.map((l) => l.savesPct)), su = avg(lines.map((l) => l.suspensions));
    observed.push(`${lines.length} matcher: ${g.toFixed(1)} gjorda och ${c.toFixed(1)} insläppta mål per match, ${s.toFixed(0)} % skotteffektivitet, ${t.toFixed(1)} bollförluster och ${su.toFixed(1)} utvisningar per match.`);
    if (league) {
      if (s > league.shootingPct + 4) strengths.push("Effektiva avslut – högre skotteffektivitet än seriesnittet.");
      if (s < league.shootingPct - 4) weaknesses.push("Svag avslutning – lägre skotteffektivitet än seriesnittet.");
      if (sv > league.savesPct + 4) strengths.push("Målvakterna räddar över seriesnittet.");
      if (sv < league.savesPct - 4) weaknesses.push("Målvaktsspelet räddar under seriesnittet – skjut tidigt och ofta.");
      if (t > league.turnovers + 2) weaknesses.push("Många bollförluster – hög press kan ge kontringslägen.");
      if (t < league.turnovers - 2) strengths.push("Få bollförluster – tålmodigt bollinnehav.");
      if (su > league.suspensions + 1) weaknesses.push("Många utvisningar – förbered spel i numerärt överläge (6 mot 5).");
      if (c < league.conceded - 2) strengths.push("Släpper in få mål – stabilt försvar.");
    } else observed.push("För få seriematcher spelade för att jämföra med seriesnittet.");
  }
  const recommendations: string[] = [];
  const defenceClaim = scouted.find((c) => c.topic === "Försvarsstruktur");
  if (defenceClaim?.text.includes("5–1")) recommendations.push("Mot 5–1 öppnar linjespel och snabba förflyttningar ytan bakom den framskjutna försvararen.");
  if (defenceClaim?.text.includes("6–0")) recommendations.push("Mot 6–0 ger skott från distans och spel i bredd med kanterna bäst lägen.");
  if (weaknesses.some((w) => w.includes("utvisningar"))) recommendations.push("Spara en uppställning för 6 mot 5 under Matchplan → Specialsituationer.");
  if (weaknesses.some((w) => w.includes("bollförluster"))) recommendations.push("Ett aggressivare försvar kan tvinga fram fler bollvinster.");
  const confidence = confidenceOf(reliability);
  return {
    fixtureId: fixture.id,
    opponentClubId: opponentId,
    staffId: staff.id,
    staffName: staff.displayName,
    createdOn,
    reliability,
    reliabilityLabel: CONFIDENCE_LABEL[confidence],
    evidenceMatches: lines.length,
    observed,
    scouted: confidence === "LOW" ? scouted.filter((c) => c.topic !== "Motståndartränaren") : scouted,
    strengths,
    weaknesses,
    recommendations,
  };
}

export function requestOpponentScouting(state: CareerState, fixtureId: string, staffId: string): CareerState {
  const fixture = state.fixtures.find((f) => f.id === fixtureId);
  const staff = opponentScoutingCandidates(state).find((m) => m.id === staffId);
  if (!fixture || !staff || state.results[fixtureId]) return state;
  const scouting = state.opponentScouting ?? emptyOpponentScouting();
  const days = Math.max(1, SCOUTING_DAYS - (scoutingAbility(staff) >= 15 ? 1 : 0));
  const readyOn = addDays(state.gameDate, days) > fixture.date ? fixture.date : addDays(state.gameDate, days);
  return { ...state, opponentScouting: { ...scouting, requests: { ...scouting.requests, [fixtureId]: { fixtureId, staffId, requestedOn: state.gameDate, readyOn } } } };
}

export function setScoutingDelegate(state: CareerState, staffId: string | null): CareerState {
  const scouting = state.opponentScouting ?? emptyOpponentScouting();
  return { ...state, opponentScouting: { ...scouting, delegateStaffId: staffId ?? undefined } };
}

/**
 * One day: a delegated analyst picks up the next opponent; any request due
 * today becomes a report. Returns the fixtures whose reports were completed.
 */
export function progressOpponentScouting(state: CareerState, date: string, nextFixture: CareerFixture | null): { state: CareerState; completed: OpponentScoutReport[] } {
  let next = state;
  const scouting = () => next.opponentScouting ?? emptyOpponentScouting();
  const delegate = scouting().delegateStaffId;
  if (delegate && nextFixture && !scouting().requests[nextFixture.id] && !scouting().reports[nextFixture.id]) next = requestOpponentScouting(next, nextFixture.id, delegate);
  const completed: OpponentScoutReport[] = [];
  for (const request of Object.values(scouting().requests)) {
    if (request.readyOn > date || scouting().reports[request.fixtureId]) continue;
    const fixture = next.fixtures.find((f) => f.id === request.fixtureId);
    const staff = opponentScoutingCandidates(next).find((m) => m.id === request.staffId);
    if (!fixture || !staff) continue;
    const report = buildOpponentScoutReport(next, fixture, staff, date);
    const s = scouting();
    const { [request.fixtureId]: _done, ...requests } = s.requests;
    void _done;
    next = { ...next, opponentScouting: { ...s, requests, reports: { ...s.reports, [request.fixtureId]: report } } };
    completed.push(report);
  }
  // Played fixtures' reports are history; keep only the last few.
  const reports = Object.values(scouting().reports).sort((a, b) => b.createdOn.localeCompare(a.createdOn)).slice(0, 12);
  if (reports.length < Object.keys(scouting().reports).length) next = { ...next, opponentScouting: { ...scouting(), reports: Object.fromEntries(reports.map((r) => [r.fixtureId, r])) } };
  return { state: next, completed };
}

export function opponentName(clubId: string): string {
  return getClub(clubId)?.name ?? clubId;
}
