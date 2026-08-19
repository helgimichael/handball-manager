import { COURT_BOUNDS_METERS, COURT_WIDTH_METERS } from "./court";
import type { AttackGapId } from "./attackGaps";
import type { MeterPoint } from "./coordinates";

export type AttackGapMasterId = "V1_V2" | "V2_V3" | "V3_H3";

export type AttackGapSegment = {
  base: MeterPoint;
  target: MeterPoint;
};

export type AttackGapSourceCalibration = Readonly<{
  mirrorRight: boolean;
} & Record<AttackGapMasterId, AttackGapSegment>>;

export type AttackGapResolvedCalibration = Readonly<Record<AttackGapId, AttackGapSegment>>;

export const ATTACK_GAP_CALIBRATION_IDS: readonly AttackGapId[] = Object.freeze(["V1_V2", "V2_V3", "V3_H3", "H3_H2", "H2_H1"]);
export const ATTACK_GAP_MASTER_IDS: readonly AttackGapMasterId[] = Object.freeze(["V1_V2", "V2_V3", "V3_H3"]);

export const APPROVED_ATTACK_GAP_SOURCE_CALIBRATION: AttackGapSourceCalibration = Object.freeze({
  mirrorRight: true,
  V1_V2: Object.freeze({
    base: Object.freeze({ x: 3.252, y: 2.877 }),
    target: Object.freeze({ x: 0.735, y: 4.666 })
  }),
  V2_V3: Object.freeze({
    base: Object.freeze({ x: 7.468, y: 5.879 }),
    target: Object.freeze({ x: 7.468, y: 9.003 })
  }),
  V3_H3: Object.freeze({
    base: Object.freeze({ x: 9.924, y: 5.97 }),
    target: Object.freeze({ x: 9.985, y: 9.003 })
  })
});

function roundMeters(value: number): number {
  return Number(value.toFixed(3));
}

function clampGapPoint(point: MeterPoint): MeterPoint {
  return Object.freeze({
    x: roundMeters(Math.min(COURT_BOUNDS_METERS.maxX, Math.max(COURT_BOUNDS_METERS.minX, point.x))),
    y: roundMeters(Math.min(COURT_BOUNDS_METERS.maxY, Math.max(COURT_BOUNDS_METERS.minY, point.y)))
  });
}

function freezeSegment(segment: AttackGapSegment): AttackGapSegment {
  return Object.freeze({
    base: clampGapPoint(segment.base),
    target: clampGapPoint(segment.target)
  });
}

export function mirrorPoint(point: MeterPoint): MeterPoint {
  return clampGapPoint({
    x: COURT_WIDTH_METERS - point.x,
    y: point.y
  });
}

export function mirrorSegment(segment: AttackGapSegment): AttackGapSegment {
  return freezeSegment({
    base: mirrorPoint(segment.base),
    target: mirrorPoint(segment.target)
  });
}

export function buildDefaultAttackGapCalibration(): AttackGapSourceCalibration {
  return Object.freeze({
    mirrorRight: true,
    V1_V2: freezeSegment(APPROVED_ATTACK_GAP_SOURCE_CALIBRATION.V1_V2),
    V2_V3: freezeSegment(APPROVED_ATTACK_GAP_SOURCE_CALIBRATION.V2_V3),
    V3_H3: freezeSegment(APPROVED_ATTACK_GAP_SOURCE_CALIBRATION.V3_H3)
  });
}

function readSegment(input: unknown, fallback: AttackGapSegment): AttackGapSegment {
  if (typeof input !== "object" || input === null) {
    return fallback;
  }

  const candidate = input as Partial<AttackGapSegment & MeterPoint>;
  if (candidate.base && candidate.target) {
    return freezeSegment({ base: candidate.base, target: candidate.target });
  }
  if (typeof candidate.x === "number" && typeof candidate.y === "number") {
    return freezeSegment({
      base: fallback.base,
      target: { x: candidate.x, y: candidate.y }
    });
  }
  return fallback;
}

export function sanitizeAttackGapCalibration(input: unknown): AttackGapSourceCalibration {
  const defaults = APPROVED_ATTACK_GAP_SOURCE_CALIBRATION;
  const candidate = typeof input === "object" && input !== null ? (input as Partial<Record<AttackGapMasterId, unknown>> & { mirrorRight?: unknown }) : {};

  return Object.freeze({
    mirrorRight: true,
    V1_V2: readSegment(candidate.V1_V2, defaults.V1_V2),
    V2_V3: readSegment(candidate.V2_V3, defaults.V2_V3),
    V3_H3: readSegment(candidate.V3_H3, defaults.V3_H3)
  });
}

export function resolveAttackGapCalibration(source: AttackGapSourceCalibration): AttackGapResolvedCalibration {
  const sanitized = sanitizeAttackGapCalibration(source);
  return Object.freeze({
    V1_V2: sanitized.V1_V2,
    V2_V3: sanitized.V2_V3,
    V3_H3: sanitized.V3_H3,
    H3_H2: mirrorSegment(sanitized.V2_V3),
    H2_H1: mirrorSegment(sanitized.V1_V2)
  });
}

function orderedSource(calibration: AttackGapSourceCalibration): AttackGapSourceCalibration {
  const sanitized = sanitizeAttackGapCalibration(calibration);
  return Object.freeze({
    mirrorRight: sanitized.mirrorRight,
    V1_V2: sanitized.V1_V2,
    V2_V3: sanitized.V2_V3,
    V3_H3: sanitized.V3_H3
  });
}

function orderedResolved(calibration: AttackGapResolvedCalibration): AttackGapResolvedCalibration {
  return Object.freeze({
    V1_V2: calibration.V1_V2,
    V2_V3: calibration.V2_V3,
    V3_H3: calibration.V3_H3,
    H3_H2: calibration.H3_H2,
    H2_H1: calibration.H2_H1
  });
}

export function serializeAttackGapCalibration(calibration: AttackGapSourceCalibration): string {
  const source = orderedSource(calibration);
  return JSON.stringify(
    {
      source,
      resolved: orderedResolved(resolveAttackGapCalibration(source))
    },
    null,
    2
  );
}
