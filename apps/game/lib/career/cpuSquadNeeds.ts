// HM-CPU-SQUAD-BUILDING-1.0: pure squad-need assessment for a CPU club --
// "does this club have an obvious gap at this position, and why". Reads
// CareerState but never writes it (glue/mutation lives in
// cpuRecruitment.ts/cpuContractDecisions.ts). Deliberately reuses
// existing, real signals only (worldSquads, gameplayRatings,
// playerContracts, playerStatuses, squadStatus.ts's own
// deriveDefaultSquadStatusTier) -- never a separate CPU-only squad
// database, per the milestone's own "Ingen separat CPU-databas" rule.
import { positionLabel, type HandballPosition, type PlayerMock } from "../game-data";
import { getPlayerContractStatus } from "../economy/contractIntegration";
import { getCareerPlayer } from "./careerWorld";
import type { CareerState } from "./types";

/** Headcount (current + projected incoming) at or above this is "adequate depth" -- matches levelForCount's own LOW cutoff. Adequate depth blocks the quality rule from independently escalating need (HM-CPU-SQUAD-BUILDING-1.0B Part 5). */
const ADEQUATE_DEPTH_COUNT = 3;

/**
 * HM-CPU-SQUAD-BUILDING-1.0C Part 2: "saturated" -- a position with this
 * much projected depth or more is explicitly full, never merely "low
 * need". Same threshold for goalkeeper and outfield positions (the
 * spec's own example table: 1=real need, 2=normal, 3=strong depth,
 * 4+=saturated). Doesn't change pursuit eligibility on its own (LOW/NONE
 * were already never pursued) -- exposed so the recruitment-cycle layer
 * (successful-signing cooldown, outlier reporting) can reason about "is
 * this position actually full" explicitly rather than re-deriving it.
 */
const SATURATED_DEPTH_COUNT = 4;

/** Every outfield/goalkeeper slot the milestone tracks -- the exact 7-position vocabulary the spec itself lists. */
export const CPU_TRACKED_POSITIONS: readonly HandballPosition[] = ["MV", "V6", "H6", "V9", "M9", "H9", "M6"];

export const NEED_LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH"] as const;
export type NeedLevel = (typeof NEED_LEVELS)[number];

/** Lower rank = more urgent -- HIGH sorts before MEDIUM before LOW/NONE. */
const NEED_RANK: Record<NeedLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

export interface PositionNeedAssessment {
  position: HandballPosition;
  level: NeedLevel;
  /** Count of currently-usable (not ON_PLACEMENT) squad players at this position -- the honest, explainable headline number. */
  usableCount: number;
  /** Players already agreed (AGREED_AWAITING_WINDOW) to arrive at this position but not yet physically in the squad -- counted toward projected depth so the club doesn't sign a second player for a gap it has already solved. */
  pendingIncoming: number;
  /** usableCount + pendingIncoming -- the number every leveling/gating decision actually uses. */
  projectedDepth: number;
  /** Part 2: projectedDepth >= 4 -- the position is explicitly full, not merely "not urgent". */
  saturated: boolean;
  reason: string;
}

export interface SquadNeedAssessment {
  clubId: string;
  date: string;
  positions: readonly PositionNeedAssessment[];
}

/** A player ON_PLACEMENT is functionally not at this club right now (HM-CLUB-PARTNERSHIPS-1.1) -- excluded from depth counting. Everyone else (including injured/suspended, a temporary state) still counts as a real squad member for roster-construction purposes. */
function isUsableForSquadPlanning(state: CareerState, player: PlayerMock): boolean {
  return state.playerStatuses[player.id]?.availability !== "ON_PLACEMENT";
}

function levelForCount(count: number): NeedLevel {
  if (count === 0) return "HIGH";
  if (count === 1) return "HIGH"; // Part: "en uppenbar lucka, exempelvis endast en målvakt, ska prioriteras"
  if (count === 2) return "MEDIUM";
  return "LOW";
}

function bumpNeed(level: NeedLevel): NeedLevel {
  if (level === "LOW") return "MEDIUM";
  if (level === "MEDIUM") return "HIGH";
  return level;
}

function averageCA(state: CareerState, clubId: string, players: readonly PlayerMock[]): number | null {
  const ratings = state.gameplayRatings[clubId];
  if (!ratings || players.length === 0) return null;
  const ratingById = new Map(ratings.map((r) => [r.playerId, r.ca]));
  const cas = players.map((p) => ratingById.get(p.id)).filter((v): v is number => v !== undefined);
  if (cas.length === 0) return null;
  return cas.reduce((sum, v) => sum + v, 0) / cas.length;
}

/**
 * Part: "kontrakt som snart löper ut" -- a position that LOOKS fine on
 * raw headcount but whose players are mostly about to leave is really a
 * near-term gap. Re-levels using the count of players NOT at contract
 * risk (EXPIRING/FREE_AGENT) if that's worse than the raw headcount
 * level, never better (contract risk can only raise urgency, not hide a
 * real gap by ignoring it).
 */
function contractRiskAdjustedLevel(state: CareerState, players: readonly PlayerMock[], rawLevel: NeedLevel): { level: NeedLevel; atRiskCount: number } {
  const atRiskCount = players.filter((p) => {
    const status = getPlayerContractStatus(state, p.id);
    return status === "EXPIRING" || status === "FREE_AGENT";
  }).length;
  if (atRiskCount === 0) return { level: rawLevel, atRiskCount };
  const safeLevel = levelForCount(players.length - atRiskCount);
  const level = NEED_RANK[safeLevel] < NEED_RANK[rawLevel] ? safeLevel : rawLevel;
  return { level, atRiskCount };
}

/**
 * Part: "spelarens nivå relativt klubben" -- a position staffed only by
 * players clearly below the club's own overall level is a real quality
 * gap. Bumps need up exactly one level (never invents a HIGH out of
 * nothing -- NONE stays NONE).
 *
 * HM-CPU-SQUAD-BUILDING-1.0B Part 5: "QUALITY MAY ONLY ELEVATE NEED IF
 * HEADCOUNT/USABLE DEPTH IS NOT ALREADY ADEQUATE". The 1.0A audit found
 * this rule creating a real feedback loop -- buying another cheap depth
 * player at a weak position drags that position's own average CA down
 * further, which kept re-triggering the SAME rule indefinitely (clubs
 * ending up with 7-11 goalkeepers). `effectiveCount` (current usable +
 * pending incoming, Part 6/7) already reaching adequate depth now hard-
 * gates this bump off entirely -- once a position has enough bodies, a
 * weak average can no longer manufacture a pursuit on its own; it can
 * still elevate a genuinely thin position (1-2 players), which is the
 * case that actually matters.
 */
function qualityAdjustedLevel(state: CareerState, clubId: string, squad: readonly PlayerMock[], positionPlayers: readonly PlayerMock[], effectiveCount: number, level: NeedLevel): { level: NeedLevel; weak: boolean } {
  if (effectiveCount >= ADEQUATE_DEPTH_COUNT) return { level, weak: false };
  const clubAvg = averageCA(state, clubId, squad);
  const positionAvg = averageCA(state, clubId, positionPlayers);
  if (clubAvg === null || positionAvg === null || clubAvg <= 0) return { level, weak: false };
  const weak = positionAvg < clubAvg * 0.85;
  return { level: weak ? bumpNeed(level) : level, weak };
}

/**
 * HM-CPU-SQUAD-BUILDING-1.0B Part 6/7: players already agreed
 * (AGREED_AWAITING_WINDOW) to join this club at this position but not
 * yet physically moved -- counted as projected depth so the club
 * doesn't keep signing for a gap it has already solved while the deal
 * waits for the transfer window. `getCareerPlayer` still resolves the
 * incoming player at their CURRENT (pre-move) club, so their real
 * `position` is available before the move executes.
 */
function pendingIncomingCount(state: CareerState, clubId: string, position: HandballPosition): number {
  let count = 0;
  for (const offer of Object.values(state.transferOffers)) {
    if (offer.toClubId !== clubId || offer.status !== "AGREED_AWAITING_WINDOW") continue;
    if (getCareerPlayer(state, offer.playerId)?.position === position) count += 1;
  }
  return count;
}

export function assessPositionNeed(state: CareerState, clubId: string, position: HandballPosition, squad: readonly PlayerMock[]): PositionNeedAssessment {
  const positionPlayers = squad.filter((p) => p.position === position && isUsableForSquadPlanning(state, p));
  const count = positionPlayers.length;
  const incoming = pendingIncomingCount(state, clubId, position);
  const effectiveCount = count + incoming;
  const label = positionLabel(position);
  const reasons: string[] = [];

  let level = levelForCount(effectiveCount);
  if (count === 0) reasons.push(`Klubben saknar helt tillgänglig spelare på ${label}.`);
  else if (count === 1) reasons.push(`Endast en tillgänglig spelare på ${label} -- uppenbar lucka.`);
  else reasons.push(`${count} tillgängliga spelare på ${label}.`);
  if (incoming > 0) reasons.push(`${incoming} spelare är redan på väg in (överenskommet, väntar på transferfönster).`);

  const riskAdjusted = contractRiskAdjustedLevel(state, positionPlayers, level);
  if (riskAdjusted.level !== level) {
    level = riskAdjusted.level;
    reasons.push(`${riskAdjusted.atRiskCount} av dem har utgående kontrakt.`);
  }

  const qualityAdjusted = qualityAdjustedLevel(state, clubId, squad, positionPlayers, effectiveCount, level);
  if (qualityAdjusted.weak) {
    level = qualityAdjusted.level;
    reasons.push("Nivån på positionen ligger klart under klubbens eget snitt.");
  }

  return { position, level, usableCount: count, pendingIncoming: incoming, projectedDepth: effectiveCount, saturated: effectiveCount >= SATURATED_DEPTH_COUNT, reason: reasons.join(" ") };
}

export function assessSquadNeeds(state: CareerState, clubId: string, date: string): SquadNeedAssessment {
  const squad = state.worldSquads[clubId] ?? [];
  const positions = CPU_TRACKED_POSITIONS.map((position) => assessPositionNeed(state, clubId, position, squad));
  return { clubId, date, positions };
}

/**
 * HM-CPU-SQUAD-BUILDING-1.0C Part 1: total projected squad size (current
 * usable squad + every pending incoming PERMANENT signing across all
 * positions, not just the one position assessPositionNeed looks at) --
 * the input the squad-size recruitment brake reasons about. LOAN
 * arrivals are deliberately excluded (a loan is a temporary, easily
 * reversed depth boost, not a permanent roster commitment the brake
 * should react to).
 */
export function projectedSquadSize(state: CareerState, clubId: string): number {
  const squad = (state.worldSquads[clubId] ?? []).filter((p) => isUsableForSquadPlanning(state, p));
  const pendingIncoming = Object.values(state.transferOffers).filter((o) => o.toClubId === clubId && o.status === "AGREED_AWAITING_WINDOW" && o.dealType === "PERMANENT").length;
  return squad.length + pendingIncoming;
}

/** HIGH needs first, then MEDIUM -- Part: "en uppenbar lucka ... ska prioriteras före lyxvärvningar". LOW/NONE are never pursued (Part: "Balanced squad ska kunna ge NO ACTION"). */
export function priorityNeeds(assessment: SquadNeedAssessment): readonly PositionNeedAssessment[] {
  return assessment.positions.filter((p) => p.level === "HIGH" || p.level === "MEDIUM").sort((a, b) => NEED_RANK[a.level] - NEED_RANK[b.level]);
}

// ---------------------------------------------------------------------------
// HM-CPU-SQUAD-RESILIENCE-1.0: emergency classification -- a genuine acute
// hole, strictly narrower than plain HIGH need (HIGH already covers count
// 0 or 1 via levelForCount; emergency singles out only the most severe end
// of that same bucket, purely to drive RETRY CADENCE in cpuRecruitment.ts,
// never a new scoring/saturation rule). Reuses `projectedDepth`
// (assessPositionNeed's own current-usable + pending-incoming number)
// exactly as-is -- Part: "Do not create a second squad-depth truth".
// ---------------------------------------------------------------------------

export const EMERGENCY_LEVELS = ["NONE", "EMERGENCY", "SEVERE"] as const;
export type EmergencyLevel = (typeof EMERGENCY_LEVELS)[number];

/**
 * Goalkeeper gets an extra severity split -- a club with zero fit
 * keepers cannot field a team at all (SEVERE), one keeper is a real but
 * slightly less acute hole (EMERGENCY, Part 6's own "0 -> severe, 1 ->
 * emergency, 2 -> normal healthy minimum"). Every other tracked field
 * position only qualifies at zero (an outright missing position, Part 2's
 * own examples never ask for a field "1 -> emergency" tier). A pending
 * AGREED_AWAITING_WINDOW signee already raises `projectedDepth` before
 * this is ever called (Part 6: "Pending incoming counts"), so 1 current +
 * 1 agreed incoming reads as projectedDepth 2 -> NONE, exactly Part 2's
 * own worked example.
 */
export function positionEmergencyLevel(position: HandballPosition, projectedDepth: number): EmergencyLevel {
  if (position === "MV") {
    if (projectedDepth <= 0) return "SEVERE";
    if (projectedDepth === 1) return "EMERGENCY";
    return "NONE";
  }
  return projectedDepth <= 0 ? "EMERGENCY" : "NONE";
}

/** Part 7: whole-squad floor -- only fires when the club's OWN total projected size (the exact same number projectedSquadSize already computes, current usable + pending incoming permanent signings) is critically small, independent of any single position. Deliberately narrow (<=12, not 13-14 -- Part 7's own "13-14 -> strong HIGH need but not necessarily emergency"). */
export const SQUAD_FLOOR_EMERGENCY_COUNT = 12;
export function isSquadFloorEmergency(projectedTotalSize: number): boolean {
  return projectedTotalSize <= SQUAD_FLOOR_EMERGENCY_COUNT;
}
