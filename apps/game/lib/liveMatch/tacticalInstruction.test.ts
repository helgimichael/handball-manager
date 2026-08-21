import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTeamTacticalProfile } from "../career/teamTacticalProfile";
import {
  TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES,
  instructionAdoptionMinute,
  resolveInstructionStatus,
  type TacticalInstruction,
} from "./tacticalInstruction";

function instructionAt(issuedMinute: number): TacticalInstruction {
  return { issuedMinute, profile: defaultTeamTacticalProfile() };
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
