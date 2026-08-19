import { COURT_BOUNDS_METERS } from "./court";
import {
  ATTACK_GAP_CALIBRATION_IDS,
  buildDefaultAttackGapCalibration,
  resolveAttackGapCalibration,
  type AttackGapResolvedCalibration,
  type AttackGapSourceCalibration
} from "./attackGapCalibration";
import { isPointWithinBounds, type MeterPoint } from "./coordinates";

export type AttackGapId = "V1_V2" | "V2_V3" | "V3_H3" | "H3_H2" | "H2_H1";

export type AttackGap = {
  id: AttackGapId;
  label: "V1/V2" | "V2/V3" | "V3/H3" | "H3/H2" | "H2/H1";
  betweenZones: readonly [string, string];
  base: MeterPoint;
  position: MeterPoint;
};

const ATTACK_GAP_META: Readonly<Record<AttackGapId, Omit<AttackGap, "base" | "position">>> = Object.freeze({
  V1_V2: Object.freeze({
    id: "V1_V2",
    label: "V1/V2",
    betweenZones: Object.freeze(["V1", "V2"] as const)
  }),
  V2_V3: Object.freeze({
    id: "V2_V3",
    label: "V2/V3",
    betweenZones: Object.freeze(["V2", "V3"] as const)
  }),
  V3_H3: Object.freeze({
    id: "V3_H3",
    label: "V3/H3",
    betweenZones: Object.freeze(["V3", "H3"] as const)
  }),
  H3_H2: Object.freeze({
    id: "H3_H2",
    label: "H3/H2",
    betweenZones: Object.freeze(["H3", "H2"] as const)
  }),
  H2_H1: Object.freeze({
    id: "H2_H1",
    label: "H2/H1",
    betweenZones: Object.freeze(["H2", "H1"] as const)
  })
});

function buildAttackGaps(calibration: AttackGapResolvedCalibration): readonly AttackGap[] {
  return Object.freeze(
    ATTACK_GAP_CALIBRATION_IDS.map((id) =>
      Object.freeze({
        ...ATTACK_GAP_META[id],
        base: Object.freeze({ ...calibration[id].base }),
        position: Object.freeze({ ...calibration[id].target })
      })
    )
  );
}

const ATTACK_GAPS: readonly AttackGap[] = buildAttackGaps(resolveAttackGapCalibration(buildDefaultAttackGapCalibration()));

export function getDefensiveAttackGaps(): readonly AttackGap[] {
  return ATTACK_GAPS;
}

export function buildDefensiveAttackGaps(calibration: AttackGapSourceCalibration): readonly AttackGap[] {
  return buildAttackGaps(resolveAttackGapCalibration(calibration));
}

export function getAttackGap(gapId: string): AttackGap | null {
  return ATTACK_GAPS.find((gap) => gap.id === gapId) ?? null;
}

export function isValidAttackGapTarget(gap: AttackGap): boolean {
  return isPointWithinBounds(gap.position, COURT_BOUNDS_METERS);
}
