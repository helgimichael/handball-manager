// Arena Nights -- ANL-01 C "Editorial Match Report": the post-match story read from what the match
// stored (goal events, contributions, the match archive's load record and the workload ledger).
// Pure and read-only: nothing here simulates, re-rates or changes a result; it only orders and
// phrases facts the engine already wrote down.
import type { FastMatchResult, MatchEvent } from "@handball-manager/game-simulation";
import { HALF_TIME_MINUTE } from "./calibration";
import { detectScoringRuns } from "./scoringRuns";

export type Side = "home" | "away";
export interface Score { home: number; away: number }
/** Goal difference after each goal, from the report's own side (positive = own side leads). */
export interface FlowPoint { minute: number; diff: number; side: Side; score: Score }
export interface StoryRun { side: Side; own: boolean; startMinute: number; endMinute: number; goals: number; scoreAfter: Score }
export type TurningKind = "DECISIVE" | "EQUALISER" | "COMEBACK" | "RUN" | "LATE" | "BIGGEST_LEAD" | "HALF_TIME";
export interface TurningPoint { kind: TurningKind; minute: number; title: string; text: string; score: Score; side: Side | null; tone: "for" | "against" | "neutral" }
export interface MatchStory {
  ownSide: Side;
  outcome: "W" | "D" | "L";
  halfTime: Score | null;
  flow: FlowPoint[];
  runs: StoryRun[];
  turningPoints: TurningPoint[];
  leadChanges: number;
  /** Largest lead each side held, from the report's own side. */
  maxLead: { own: number; opp: number };
  kicker: string;
  headline: string;
}

const other = (s: Side): Side => (s === "home" ? "away" : "home");
const fmt = (s: Score) => `${s.home}–${s.away}`;
const min = (m: number) => `${Math.max(1, Math.round(m))}′`;

/** The match's goals in time order, each with the running score after it (only events that carry one). */
export function goalTimeline(result: Pick<FastMatchResult, "events">): MatchEvent[] {
  return result.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.type === "GOAL" && e.homeScoreAfter !== undefined && e.awayScoreAfter !== undefined)
    .sort((a, b) => a.e.minute - b.e.minute || a.i - b.i)
    .map(({ e }) => e);
}

export function buildMatchStory(
  result: Pick<FastMatchResult, "events" | "homeGoals" | "awayGoals">,
  ownSide: Side,
  names: Record<Side, string>,
  city?: string,
): MatchStory {
  const goals = goalTimeline(result);
  const sign = ownSide === "home" ? 1 : -1;
  const flow: FlowPoint[] = goals.map((g) => ({ minute: g.minute, diff: (g.homeScoreAfter! - g.awayScoreAfter!) * sign, side: g.side, score: { home: g.homeScoreAfter!, away: g.awayScoreAfter! } }));
  const finalHome = result.homeGoals, finalAway = result.awayGoals;
  const winner: Side | null = finalHome === finalAway ? null : finalHome > finalAway ? "home" : "away";
  const ownDiff = (finalHome - finalAway) * sign;
  const outcome = ownDiff > 0 ? "W" : ownDiff < 0 ? "L" : "D";

  const firstHalf = goals.filter((g) => g.minute <= HALF_TIME_MINUTE).at(-1);
  const halfTime: Score | null = goals.length ? (firstHalf ? { home: firstHalf.homeScoreAfter!, away: firstHalf.awayScoreAfter! } : { home: 0, away: 0 }) : null;

  // Leaders and lead changes, from the home side (diff = home - away).
  let leader: Side | null = null, leadChanges = 0, maxHome = 0, maxAway = 0;
  for (const g of goals) {
    const d = g.homeScoreAfter! - g.awayScoreAfter!;
    maxHome = Math.max(maxHome, d); maxAway = Math.max(maxAway, -d);
    const now: Side | null = d > 0 ? "home" : d < 0 ? "away" : null;
    if (now && leader && now !== leader) leadChanges++;
    if (now) leader = now;
  }
  const maxLead = ownSide === "home" ? { own: maxHome, opp: maxAway } : { own: maxAway, opp: maxHome };
  const tone = (side: Side | null): TurningPoint["tone"] => (side === null ? "neutral" : side === ownSide ? "for" : "against");

  const candidates: TurningPoint[] = [];
  // 1) The winner's decisive goal: the one after which they led to the end.
  let decisiveIndex = -1, deficit = 0, deficitAt = -1;
  if (winner) {
    const ws = winner === "home" ? 1 : -1;
    for (let i = 0; i < goals.length; i++) {
      const d = (goals[i].homeScoreAfter! - goals[i].awayScoreAfter!) * ws;
      if (d > 0 && (i === 0 || (goals[i - 1].homeScoreAfter! - goals[i - 1].awayScoreAfter!) * ws <= 0)) decisiveIndex = i;
    }
    for (let i = 0; i < Math.max(0, decisiveIndex); i++) {
      const d = (goals[i].homeScoreAfter! - goals[i].awayScoreAfter!) * ws;
      if (-d > deficit) { deficit = -d; deficitAt = i; }
    }
    const g = goals[decisiveIndex];
    if (g) {
      const s = { home: g.homeScoreAfter!, away: g.awayScoreAfter! };
      candidates.push(decisiveIndex === 0
        ? { kind: "DECISIVE", minute: g.minute, title: "Ledning från start", text: `${names[winner]} gjorde matchens första mål och släppte aldrig ledningen.`, score: s, side: winner, tone: tone(winner) }
        : { kind: "DECISIVE", minute: g.minute, title: "Det avgörande målet", text: `${min(g.minute)}: ${names[winner]} tar ledningen med ${fmt(s)} och släpper den inte igen.`, score: s, side: winner, tone: tone(winner) });
    }
    if (deficit >= 3 && deficitAt >= 0) {
      const d = goals[deficitAt];
      const s = { home: d.homeScoreAfter!, away: d.awayScoreAfter! };
      candidates.push({ kind: "COMEBACK", minute: d.minute, title: "Vändningen börjar", text: `${names[winner]} låg under med ${deficit} mål (${fmt(s)}) men vände matchen.`, score: s, side: other(winner), tone: tone(other(winner)) });
    }
  } else {
    const eq = goals.filter((g) => g.homeScoreAfter === g.awayScoreAfter && g.homeScoreAfter! > 0).at(-1);
    if (eq) candidates.push({ kind: "EQUALISER", minute: eq.minute, title: "Sista kvitteringen", text: `${min(eq.minute)}: ${names[eq.side]} kvitterar till ${fmt({ home: eq.homeScoreAfter!, away: eq.awayScoreAfter! })}.`, score: { home: eq.homeScoreAfter!, away: eq.awayScoreAfter! }, side: eq.side, tone: tone(eq.side) });
  }
  // 2) The longest scoring run.
  const runs: StoryRun[] = detectScoringRuns(goals).map((r) => ({ side: r.side, own: r.side === ownSide, startMinute: r.startMinute, endMinute: r.endMinute, goals: r.goals, scoreAfter: r.scoreAfter }));
  const best = [...runs].sort((a, b) => b.goals - a.goals || a.startMinute - b.startMinute)[0];
  if (best) candidates.push({ kind: "RUN", minute: best.endMinute, title: `${best.goals}–0-ryck`, text: `${names[best.side]} gjorde ${best.goals} mål i rad mellan ${min(best.startMinute)} och ${min(best.endMinute)} och ställde om matchen till ${fmt(best.scoreAfter)}.`, score: best.scoreAfter, side: best.side, tone: tone(best.side) });
  // 3) A late goal in a close game.
  const late = goals.filter((g) => g.minute >= 55 && Math.abs(g.homeScoreAfter! - g.awayScoreAfter!) <= 1).at(-1);
  if (late) candidates.push({ kind: "LATE", minute: late.minute, title: "Slutminuterna", text: `${min(late.minute)}: ${names[late.side]} gör ${fmt({ home: late.homeScoreAfter!, away: late.awayScoreAfter! })} i en jämn slutfas.`, score: { home: late.homeScoreAfter!, away: late.awayScoreAfter! }, side: late.side, tone: tone(late.side) });
  // 4) The biggest lead of the match.
  const big = goals.reduce<MatchEvent | null>((b, g) => (!b || Math.abs(g.homeScoreAfter! - g.awayScoreAfter!) > Math.abs(b.homeScoreAfter! - b.awayScoreAfter!) ? g : b), null);
  if (big && Math.abs(big.homeScoreAfter! - big.awayScoreAfter!) >= 3) {
    const lead: Side = big.homeScoreAfter! > big.awayScoreAfter! ? "home" : "away";
    candidates.push({ kind: "BIGGEST_LEAD", minute: big.minute, title: "Största ledningen", text: `${min(big.minute)}: ${names[lead]} leder med ${Math.abs(big.homeScoreAfter! - big.awayScoreAfter!)} mål, ${fmt({ home: big.homeScoreAfter!, away: big.awayScoreAfter! })}.`, score: { home: big.homeScoreAfter!, away: big.awayScoreAfter! }, side: lead, tone: tone(lead) });
  }
  // 5) Half-time, as a last filler.
  if (halfTime && goals.length) {
    const htLead: Side | null = halfTime.home === halfTime.away ? null : halfTime.home > halfTime.away ? "home" : "away";
    candidates.push({ kind: "HALF_TIME", minute: HALF_TIME_MINUTE, title: "Halvtid", text: htLead ? `${names[htLead]} gick till pausen med ledningen ${fmt(halfTime)}.` : `Jämnt i paus, ${fmt(halfTime)}.`, score: halfTime, side: htLead, tone: tone(htLead) });
  }
  const seen = new Set<string>();
  const turningPoints = candidates.filter((c) => { const k = c.kind === "HALF_TIME" ? `ht:${fmt(c.score)}` : fmt(c.score); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 3).sort((a, b) => a.minute - b.minute);

  // Kicker and headline: the same deterministic reading every time the report opens.
  const margin = Math.abs(finalHome - finalAway);
  const trailedLate = winner ? goals.some((g) => g.minute > 45 && (g.homeScoreAfter! - g.awayScoreAfter!) * (winner === "home" ? 1 : -1) < 0) : false;
  const ledThroughout = winner ? decisiveIndex === 0 : false;
  const kind = !winner ? "Delad poäng" : trailedLate ? "Sen vändning" : deficit >= 3 ? "Vändning" : margin >= 8 ? "Utklassning" : margin <= 1 ? "Rysare" : ledThroughout ? "Ledning från start" : "Klar seger";
  const kicker = city ? `${kind} i ${city}` : kind;
  const score = `${finalHome}–${finalAway}`;
  const headline = !winner
    ? `${names.home} och ${names.away} delade på poängen, ${score}`
    : trailedLate || deficit >= 3
      ? `${names[winner]} vände och vann mot ${names[other(winner)]}, ${score}`
      : `${names[winner]} ${margin >= 6 ? "körde över" : margin <= 1 ? "vann knappt mot" : "besegrade"} ${names[other(winner)]}, ${score}`;
  return { ownSide, outcome, halfTime, flow, runs, turningPoints, leadChanges, maxLead, kicker, headline };
}

// ---------------------------------------------------------------- ratings column
export interface RatingRow { playerId: string; side: Side; rating: number; goals: number; shots: number; saves?: number; shotsFaced?: number; started: boolean }

/** Every rated contribution the match stored (both sides when present), best first. */
export function ratingsColumn(result: Pick<FastMatchResult, "homePlayerContributions" | "awayPlayerContributions">, limit = 10): RatingRow[] {
  const rows: RatingRow[] = [
    ...result.homePlayerContributions.map((c) => ({ ...c, side: "home" as const })),
    ...result.awayPlayerContributions.map((c) => ({ ...c, side: "away" as const })),
  ].map((c) => ({ playerId: c.playerId, side: c.side, rating: c.rating, goals: c.goals, shots: c.shots, saves: c.saves, shotsFaced: c.shotsFaced, started: c.started }));
  return rows.sort((a, b) => b.rating - a.rating || b.goals - a.goals || a.playerId.localeCompare(b.playerId)).slice(0, limit);
}

// ---------------------------------------------------------------- workload box (ANL-01c)
export type LoadSetting = "FULL" | "REDUCED" | "RECOVERY_ONLY" | "REST";
export const LOAD_SETTINGS: readonly LoadSetting[] = ["FULL", "REDUCED", "RECOVERY_ONLY", "REST"];
export const LOAD_SETTING_LABEL: Record<LoadSetting, string> = { FULL: "Full", REDUCED: "Reducerad", RECOVERY_ONLY: "Endast återhämtning", REST: "Vila" };
export interface WorkloadInput {
  id: string;
  name: string;
  minutes: number;
  energy: number;
  workload?: number;
  estimated: boolean;
  /** Match + training in the 7 days up to the match, when the whole window is recorded. */
  week: number | null;
  /** The player's typical week: the 28-day total divided by four, when recorded. */
  typical: number | null;
  setting: LoadSetting;
}
export interface WorkloadRow extends WorkloadInput { risk: "HIGH" | "MID" | "LOW"; reasons: string[]; ratio: number | null }

/** ANL-01c: the players who played, highest risk first: low energy after the match, a week well above the player's typical week, heavy minutes. */
export function workloadRows(inputs: readonly WorkloadInput[]): WorkloadRow[] {
  const rows = inputs.filter((p) => p.minutes > 0).map((p) => {
    const ratio = p.week !== null && p.typical !== null && p.typical > 0 ? p.week / p.typical : null;
    const reasons: string[] = [];
    if (p.energy < 60) reasons.push(`energi ${Math.round(p.energy)} %`);
    if (ratio !== null && ratio >= 1.3) reasons.push(`veckan ${Math.round((ratio - 1) * 100)} % över det normala`);
    if (p.minutes >= 50) reasons.push(`${Math.round(p.minutes)} minuter`);
    const risk: WorkloadRow["risk"] = p.energy < 60 || (ratio !== null && ratio >= 1.3) ? "HIGH" : p.minutes >= 50 || p.energy < 75 ? "MID" : "LOW";
    return { ...p, ratio, risk, reasons };
  });
  const order = { HIGH: 0, MID: 1, LOW: 2 };
  return rows.sort((a, b) => order[a.risk] - order[b.risk] || (b.workload ?? b.minutes) - (a.workload ?? a.minutes) || a.name.localeCompare(b.name, "sv"));
}

/** Bulk action "Vila alla >50 min": the players it would change (already resting players are skipped). */
export function restCandidates(rows: readonly WorkloadRow[], minMinutes = 50): string[] {
  return rows.filter((r) => r.minutes > minMinutes && r.setting !== "REST").map((r) => r.id);
}

// ---------------------------------------------------------------- "Vad vi tar med oss"
export interface Lesson { id: string; text: string; href: string; cta: string }

/** Up to three things to take into the week, each from a stored team stat where we clearly lost the comparison. */
export function matchLessons(result: Pick<FastMatchResult, "homeStats" | "awayStats" | "events">, ownSide: Side): Lesson[] {
  const us = ownSide === "home" ? result.homeStats : result.awayStats, them = ownSide === "home" ? result.awayStats : result.homeStats;
  const out: Lesson[] = [];
  const pct = (a: number, b: number) => (b > 0 ? a / b : null);
  if (us.turnovers >= them.turnovers + 3) out.push({ id: "turnovers", text: `${us.turnovers} bollförluster mot ${them.turnovers}. Bollbehandling och tålamod i anfallet.`, href: "/career/training", cta: "Planera träningen" });
  const ourShot = pct(us.goals, us.shots), theirShot = pct(them.goals, them.shots);
  if (ourShot !== null && theirShot !== null && ourShot + 0.08 <= theirShot) out.push({ id: "finishing", text: `Skotteffektivitet ${Math.round(ourShot * 100)} % mot ${Math.round(theirShot * 100)} %. Avsluten behöver bli bättre.`, href: "/career/training", cta: "Avslutsträning" });
  const ourSave = pct(us.saves, us.shotsFaced), theirSave = pct(them.saves, them.shotsFaced);
  if (ourSave !== null && theirSave !== null && ourSave + 0.08 <= theirSave) out.push({ id: "keeping", text: `Räddningsprocent ${Math.round(ourSave * 100)} % mot ${Math.round(theirSave * 100)} %. Se över målvaktsvalet och försvarets skottlägen.`, href: "/career/tactics#plan-squad", cta: "Matchtruppen" });
  if (us.twoMinuteSuspensions >= them.twoMinuteSuspensions + 2) out.push({ id: "discipline", text: `${us.twoMinuteSuspensions} utvisningar mot ${them.twoMinuteSuspensions}. Ett mindre aggressivt försvar ger färre minuter i undertal.`, href: "/career/tactics#plan-attack", cta: "Försvarsplanen" });
  const against = detectScoringRuns(goalTimeline(result)).filter((r) => r.side !== ownSide).sort((a, b) => b.goals - a.goals)[0];
  if (against && against.goals >= 4) out.push({ id: "run", text: `Motståndarna gjorde ${against.goals} mål i rad (${min(against.startMinute)}–${min(against.endMinute)}). Bryt ryck tidigare med timeout eller byte.`, href: "/career/tactics#plan-attack", cta: "Matchplanen" });
  return out.slice(0, 3);
}
