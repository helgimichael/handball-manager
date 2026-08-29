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
import type { CareerState } from "./types";

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
 * gap even when the headcount looks adequate. Bumps need up exactly one
 * level (never invents a HIGH out of nothing -- NONE stays NONE).
 */
function qualityAdjustedLevel(state: CareerState, clubId: string, squad: readonly PlayerMock[], positionPlayers: readonly PlayerMock[], level: NeedLevel): { level: NeedLevel; weak: boolean } {
  const clubAvg = averageCA(state, clubId, squad);
  const positionAvg = averageCA(state, clubId, positionPlayers);
  if (clubAvg === null || positionAvg === null || clubAvg <= 0) return { level, weak: false };
  const weak = positionAvg < clubAvg * 0.85;
  return { level: weak ? bumpNeed(level) : level, weak };
}

export function assessPositionNeed(state: CareerState, clubId: string, position: HandballPosition, squad: readonly PlayerMock[]): PositionNeedAssessment {
  const positionPlayers = squad.filter((p) => p.position === position && isUsableForSquadPlanning(state, p));
  const count = positionPlayers.length;
  const label = positionLabel(position);
  const reasons: string[] = [];

  let level = levelForCount(count);
  if (count === 0) reasons.push(`Klubben saknar helt tillgänglig spelare på ${label}.`);
  else if (count === 1) reasons.push(`Endast en tillgänglig spelare på ${label} -- uppenbar lucka.`);
  else reasons.push(`${count} tillgängliga spelare på ${label}.`);

  const riskAdjusted = contractRiskAdjustedLevel(state, positionPlayers, level);
  if (riskAdjusted.level !== level) {
    level = riskAdjusted.level;
    reasons.push(`${riskAdjusted.atRiskCount} av dem har utgående kontrakt.`);
  }

  const qualityAdjusted = qualityAdjustedLevel(state, clubId, squad, positionPlayers, level);
  if (qualityAdjusted.weak) {
    level = qualityAdjusted.level;
    reasons.push("Nivån på positionen ligger klart under klubbens eget snitt.");
  }

  return { position, level, usableCount: count, reason: reasons.join(" ") };
}

export function assessSquadNeeds(state: CareerState, clubId: string, date: string): SquadNeedAssessment {
  const squad = state.worldSquads[clubId] ?? [];
  const positions = CPU_TRACKED_POSITIONS.map((position) => assessPositionNeed(state, clubId, position, squad));
  return { clubId, date, positions };
}

/** HIGH needs first, then MEDIUM -- Part: "en uppenbar lucka ... ska prioriteras före lyxvärvningar". LOW/NONE are never pursued (Part: "Balanced squad ska kunna ge NO ACTION"). */
export function priorityNeeds(assessment: SquadNeedAssessment): readonly PositionNeedAssessment[] {
  return assessment.positions.filter((p) => p.level === "HIGH" || p.level === "MEDIUM").sort((a, b) => NEED_RANK[a.level] - NEED_RANK[b.level]);
}
