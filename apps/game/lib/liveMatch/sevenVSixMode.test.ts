import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSevenVSixInstructionStatus,
  sevenVSixAdoptionMinute,
  type SevenVSixInstruction,
} from "./sevenVSixMode";
import { TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES, TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES } from "./tacticalInstruction";

function instructionAt(issuedMinute: number, target: SevenVSixInstruction["target"] = "ON", deliveryMode: SevenVSixInstruction["deliveryMode"] = "SIDELINE"): SevenVSixInstruction {
  return { target, issuedMinute, deliveryMode };
}

test("ON/OFF lifecycle: PENDING before the adoption minute, ADOPTED from it onward, for both ON and OFF targets", () => {
  for (const target of ["ON", "OFF"] as const) {
    const instruction = instructionAt(20, target);
    const adoptionMinute = sevenVSixAdoptionMinute(instruction);
    assert.equal(adoptionMinute, 20 + TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES);

    assert.equal(resolveSevenVSixInstructionStatus(instruction, 20), "PENDING");
    assert.equal(resolveSevenVSixInstructionStatus(instruction, adoptionMinute - 1), "PENDING");
    assert.equal(resolveSevenVSixInstructionStatus(instruction, adoptionMinute), "ADOPTED");
    assert.equal(resolveSevenVSixInstructionStatus(instruction, adoptionMinute + 3), "ADOPTED");
  }
});

test("timeout delivery adopts strictly faster than sideline delivery, for the same issued minute", () => {
  const sideline = instructionAt(30, "ON", "SIDELINE");
  const timeout = instructionAt(30, "ON", "TIMEOUT");

  const sidelineAdoption = sevenVSixAdoptionMinute(sideline);
  const timeoutAdoption = sevenVSixAdoptionMinute(timeout);

  assert.equal(sidelineAdoption, 30 + TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES);
  assert.equal(timeoutAdoption, 30 + TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES);
  assert.ok(timeoutAdoption < sidelineAdoption, "a 7v6 switch delivered during a timeout must adopt strictly faster than a sideline switch");
});

test("determinism: identical inputs always resolve identically", () => {
  const a = instructionAt(12, "OFF", "TIMEOUT");
  const b = instructionAt(12, "OFF", "TIMEOUT");
  assert.equal(sevenVSixAdoptionMinute(a), sevenVSixAdoptionMinute(b));
  assert.equal(resolveSevenVSixInstructionStatus(a, 15), resolveSevenVSixInstructionStatus(b, 15));
});

test("adoption minute never exceeds 60 (full time), even for a very late switch", () => {
  const instruction = instructionAt(59, "ON", "SIDELINE");
  assert.equal(sevenVSixAdoptionMinute(instruction), 60);
});

test("pause/speed independence: status is a pure function of clockMinute only, with no other input to react to", () => {
  const instruction = instructionAt(18, "ON", "SIDELINE");
  const adoptionMinute = sevenVSixAdoptionMinute(instruction);
  assert.equal(resolveSevenVSixInstructionStatus(instruction, adoptionMinute - 1), "PENDING");
  assert.equal(resolveSevenVSixInstructionStatus(instruction, adoptionMinute - 1), "PENDING");
  assert.equal(resolveSevenVSixInstructionStatus(instruction, adoptionMinute), "ADOPTED");
  assert.equal(resolveSevenVSixInstructionStatus(instruction, adoptionMinute), "ADOPTED");
});

test("HM-TACTICS-0.9: a HALFTIME-delivered 7v6 switch adopts immediately (zero extra delay), same as a halftime tactical instruction", () => {
  const halftime = instructionAt(30, "ON", "HALFTIME");
  assert.equal(sevenVSixAdoptionMinute(halftime), 30);
  assert.equal(resolveSevenVSixInstructionStatus(halftime, 30), "ADOPTED");
});
