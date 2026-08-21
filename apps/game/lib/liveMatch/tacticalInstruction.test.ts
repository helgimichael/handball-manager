import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTeamTacticalProfile } from "../career/teamTacticalProfile";
import {
  TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES,
  TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES,
  instructionAdoptionMinute,
  resolveInstructionStatus,
  type InstructionDeliveryMode,
  type TacticalInstruction,
} from "./tacticalInstruction";

function instructionAt(issuedMinute: number, deliveryMode: InstructionDeliveryMode = "SIDELINE"): TacticalInstruction {
  return { issuedMinute, profile: defaultTeamTacticalProfile(), deliveryMode };
}

test("instruction delay works: PENDING before the adoption minute, ADOPTED from it onward", () => {
  const instruction = instructionAt(10);
  const adoptionMinute = instructionAdoptionMinute(instruction);
  assert.equal(adoptionMinute, 10 + TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES);

  assert.equal(resolveInstructionStatus(instruction, 10), "PENDING");
  assert.equal(resolveInstructionStatus(instruction, adoptionMinute - 1), "PENDING");
  assert.equal(resolveInstructionStatus(instruction, adoptionMinute), "ADOPTED");
  assert.equal(resolveInstructionStatus(instruction, adoptionMinute + 5), "ADOPTED");
});

test("the delay is deterministic and explicitly provisional: a pure function of issuedMinute only", () => {
  const a = instructionAdoptionMinute(instructionAt(22));
  const b = instructionAdoptionMinute(instructionAt(22));
  assert.equal(a, b);
});

test("adoption minute never exceeds 60 (full time), even for a very late instruction", () => {
  const instruction = instructionAt(59);
  assert.equal(instructionAdoptionMinute(instruction), 60);
});

test("pause/speed does not change tactical outcome: status is purely a function of the SIMULATED clock minute, with no speed/wall-clock parameter to influence it", () => {
  const instruction = instructionAt(15);
  const adoptionMinute = instructionAdoptionMinute(instruction);
  // Whether the manager paused for a long real-world time or fast-forwarded
  // through this stretch, resolveInstructionStatus only ever looks at
  // clockMinute -- there is no other input it could react to.
  assert.equal(resolveInstructionStatus(instruction, adoptionMinute - 1), "PENDING");
  assert.equal(resolveInstructionStatus(instruction, adoptionMinute - 1), "PENDING");
  assert.equal(resolveInstructionStatus(instruction, adoptionMinute), "ADOPTED");
  assert.equal(resolveInstructionStatus(instruction, adoptionMinute), "ADOPTED");
});

test("HM-COACHING-0.1: a TIMEOUT-delivered instruction adopts faster than an identical SIDELINE one issued at the same minute", () => {
  const sideline = instructionAt(20, "SIDELINE");
  const timeout = instructionAt(20, "TIMEOUT");

  const sidelineAdoption = instructionAdoptionMinute(sideline);
  const timeoutAdoption = instructionAdoptionMinute(timeout);

  assert.equal(sidelineAdoption, 20 + TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES);
  assert.equal(timeoutAdoption, 20 + TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES);
  assert.ok(timeoutAdoption < sidelineAdoption, "timeout delivery must adopt strictly faster than sideline delivery");
});

test("HM-COACHING-0.1: the timeout delay is still deterministic, provisional, and never exceeds full time", () => {
  const a = instructionAdoptionMinute(instructionAt(58, "TIMEOUT"));
  const b = instructionAdoptionMinute(instructionAt(58, "TIMEOUT"));
  assert.equal(a, b);
  assert.ok(a <= 60);

  assert.equal(instructionAdoptionMinute(instructionAt(59, "TIMEOUT")), 60);
});
