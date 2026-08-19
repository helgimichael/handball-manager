import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTACK_GAP_CALIBRATION_IDS,
  ATTACK_GAP_MASTER_IDS,
  APPROVED_ATTACK_GAP_SOURCE_CALIBRATION,
  buildDefaultAttackGapCalibration,
  mirrorPoint,
  mirrorSegment,
  resolveAttackGapCalibration,
  sanitizeAttackGapCalibration,
  serializeAttackGapCalibration
} from "./attackGapCalibration";

test("attack gap calibration exposes five resolved ids and three source master ids", () => {
  assert.deepEqual(ATTACK_GAP_CALIBRATION_IDS, ["V1_V2", "V2_V3", "V3_H3", "H3_H2", "H2_H1"]);
  assert.deepEqual(ATTACK_GAP_MASTER_IDS, ["V1_V2", "V2_V3", "V3_H3"]);
});

test("mirror point reflects around the court center axis and preserves depth", () => {
  assert.deepEqual(mirrorPoint({ x: 3.25, y: 7.75 }), { x: 16.75, y: 7.75 });
});

test("mirror segment preserves base target semantics and mirrors angle", () => {
  const mirrored = mirrorSegment({
    base: { x: 3, y: 5 },
    target: { x: 5, y: 8 }
  });

  assert.deepEqual(mirrored, {
    base: { x: 17, y: 5 },
    target: { x: 15, y: 8 }
  });
});

test("approved source calibration is the canonical default", () => {
  const defaults = buildDefaultAttackGapCalibration();

  assert.deepEqual(defaults, APPROVED_ATTACK_GAP_SOURCE_CALIBRATION);
});

test("resolved calibration mirrors approved right-side gaps exactly", () => {
  const resolved = resolveAttackGapCalibration(buildDefaultAttackGapCalibration());

  assert.deepEqual(resolved, {
    V1_V2: { base: { x: 3.252, y: 2.877 }, target: { x: 0.735, y: 4.666 } },
    V2_V3: { base: { x: 7.468, y: 5.879 }, target: { x: 7.468, y: 9.003 } },
    V3_H3: { base: { x: 9.924, y: 5.97 }, target: { x: 9.985, y: 9.003 } },
    H3_H2: { base: { x: 12.532, y: 5.879 }, target: { x: 12.532, y: 9.003 } },
    H2_H1: { base: { x: 16.748, y: 2.877 }, target: { x: 19.265, y: 4.666 } }
  });
});

test("central V3/H3 remains independent", () => {
  const source = sanitizeAttackGapCalibration({
    mirrorRight: true,
    V3_H3: { base: { x: 9.4, y: 6.6 }, target: { x: 10.2, y: 8.3 } }
  });
  const resolved = resolveAttackGapCalibration(source);

  assert.deepEqual(resolved.V3_H3, { base: { x: 9.4, y: 6.6 }, target: { x: 10.2, y: 8.3 } });
  assert.notDeepEqual(resolved.V3_H3, resolved.H3_H2);
});

test("resolved calibration always contains exactly five gaps", () => {
  assert.deepEqual(Object.keys(resolveAttackGapCalibration(buildDefaultAttackGapCalibration())), ["V1_V2", "V2_V3", "V3_H3", "H3_H2", "H2_H1"]);
});

test("calibration serialization exports deterministic source and resolved data", () => {
  const serialized = serializeAttackGapCalibration(buildDefaultAttackGapCalibration());
  const parsed = JSON.parse(serialized) as { source: Record<string, unknown>; resolved: Record<string, unknown> };

  assert.deepEqual(Object.keys(parsed.source), ["mirrorRight", "V1_V2", "V2_V3", "V3_H3"]);
  assert.deepEqual(Object.keys(parsed.resolved), ["V1_V2", "V2_V3", "V3_H3", "H3_H2", "H2_H1"]);
  assert.equal(serialized, serializeAttackGapCalibration(buildDefaultAttackGapCalibration()));
});

test("target derivation is deterministic from segment target", () => {
  const resolved = resolveAttackGapCalibration(
    sanitizeAttackGapCalibration({
      V1_V2: { base: { x: 3, y: 5 }, target: { x: 4, y: 8.4 } }
    })
  );

  assert.deepEqual(resolved.V1_V2.target, { x: 4, y: 8.4 });
});

test("endpoint bounds validation clamps base and target", () => {
  const sanitized = sanitizeAttackGapCalibration({
    V1_V2: { base: { x: -10, y: -2 }, target: { x: 30, y: 50 } }
  });

  assert.deepEqual(sanitized.V1_V2, { base: { x: 0, y: 0 }, target: { x: 20, y: 40 } });
});

test("reset defaults return approved calibration", () => {
  assert.deepEqual(sanitizeAttackGapCalibration({}), buildDefaultAttackGapCalibration());
});

test("right-side mirroring remains locked on for v0.1 calibration", () => {
  assert.equal(sanitizeAttackGapCalibration({ mirrorRight: false }).mirrorRight, true);
});
