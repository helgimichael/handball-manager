/**
 * MATCH-EXPERIENCE-2.0 M14: the coach's existing plan -> M12's instruction
 * dials.
 *
 * The career already asks the manager the questions M12 answers with numbers.
 * "Tempo: FAST", "Pivot usage: HIGH", "Ball circulation: PATIENT" are the same
 * intentions as `tempo`, `pivotUsage` and `gapAppetite`, so this module is a
 * translation and nothing more -- no plan field is invented, and no dial is set
 * from anything other than a plan field the manager actually chose.
 *
 * A side with no MatchPlan gets neutral instructions, which is exactly the
 * M6/M7 behaviour. That is the honest default: the manager said nothing, so his
 * team is told nothing.
 */
import type { AttackPlanConfig, DefencePlanConfig, IntensityLevel, MatchPlan } from "../../matchPlan/types";

/** The engine's instruction shape, structurally, so no engine import is needed here. */
export type SpatialTeamInstructions = {
  readonly attack?: {
    readonly width?: number;
    readonly tempo?: number;
    readonly side?: number;
    readonly pivotUsage?: number;
    readonly gapAppetite?: number;
  };
  readonly defence?: {
    readonly aggression?: number;
    readonly compactness?: number;
    readonly helpEmphasis?: number;
    readonly pivotProtection?: number;
  };
};

/** LOW / MEDIUM / HIGH is a three-point scale; so is a bias of -0.4 / 0 / +0.4. */
export function intensityBias(level: IntensityLevel): number {
  return level === "HIGH" ? 0.4 : level === "LOW" ? -0.4 : 0;
}

function tempoBias(tempo: AttackPlanConfig["tempo"]): number {
  return tempo === "FAST" ? 0.5 : tempo === "SLOW" ? -0.5 : 0;
}

function circulationBias(circulation: AttackPlanConfig["ballCirculation"]): number {
  // DIRECT means go at them; PATIENT means work it again. That is gapAppetite.
  return circulation === "DIRECT" ? 0.4 : circulation === "PATIENT" ? -0.4 : 0;
}

function depthBias(depth: DefencePlanConfig["defensiveDepth"]): number {
  // A HIGH defence meets the ball early, a DEEP one waits on the line.
  return depth === "HIGH" ? 0.4 : depth === "DEEP" ? -0.4 : 0;
}

function clampBias(value: number): number {
  return Math.max(-1, Math.min(1, Math.round(value * 100) / 100));
}

/**
 * The instructions a plan amounts to.
 *
 * Where two plan fields plainly speak to the same dial they are averaged rather
 * than summed, so a coach cannot accidentally saturate an instruction by
 * answering two related questions the same way.
 */
export function instructionsFromMatchPlan(plan: MatchPlan | null): SpatialTeamInstructions {
  if (!plan) return {};
  const a = plan.attackPlan;
  const d = plan.defencePlan;
  return {
    attack: {
      tempo: clampBias(tempoBias(a.tempo)),
      pivotUsage: clampBias(intensityBias(a.pivotUsage)),
      width: clampBias(intensityBias(a.wingUsage)),
      gapAppetite: clampBias((circulationBias(a.ballCirculation) + intensityBias(a.breakthroughEmphasis)) / 2),
      // Nothing in the plan expresses a left/right preference, so the engine is
      // told nothing rather than being given a made-up one.
      side: 0,
    },
    defence: {
      aggression: clampBias((depthBias(d.defensiveDepth) + intensityBias(d.ballOrientedPressure) + intensityBias(d.contactIntent)) / 3),
      helpEmphasis: clampBias(intensityBias(d.coverBlockingEmphasis)),
      // riskLevel is how far the line is willing to be pulled apart, which is
      // the opposite of squeezing it toward the middle.
      compactness: clampBias(-intensityBias(d.riskLevel)),
      // No plan field describes pivot marking specifically. It stays neutral
      // rather than being borrowed from a field that means something else.
      pivotProtection: 0,
    },
  };
}
