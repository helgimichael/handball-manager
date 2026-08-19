import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureOpponentAnalysisTask, progressCareerTasks, seedCareerTasks } from "./careerTasks";

test("seedCareerTasks seeds exactly one IN_PROGRESS SCOUTING task with a deterministic completion date", () => {
  const tasks = seedCareerTasks("2026-08-19");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].type, "SCOUTING");
  assert.equal(tasks[0].status, "IN_PROGRESS");
  assert.equal(tasks[0].completionDate, "2026-08-29");
});

test("progressCareerTasks completes a task exactly on its completion date and never before", () => {
  const tasks = seedCareerTasks("2026-08-19");
  const before = progressCareerTasks(tasks, "2026-08-28");
  assert.equal(before.completed.length, 0);
  assert.equal(before.tasks[0].status, "IN_PROGRESS");

  const onDate = progressCareerTasks(before.tasks, "2026-08-29");
  assert.equal(onDate.completed.length, 1);
  assert.equal(onDate.tasks[0].status, "COMPLETED");
});

test("progressCareerTasks does not re-complete an already-completed task (idempotent)", () => {
  const tasks = seedCareerTasks("2026-08-19");
  const first = progressCareerTasks(tasks, "2026-08-29");
  const second = progressCareerTasks(first.tasks, "2026-08-30");
  assert.equal(second.completed.length, 0);
});

test("ensureOpponentAnalysisTask creates exactly one task per fixture and never duplicates it", () => {
  const created = ensureOpponentAnalysisTask([], "fx-1", "club-x", "2026-08-25", "2026-08-19");
  assert.equal(created.length, 1);
  assert.equal(created[0].type, "OPPONENT_ANALYSIS");
  assert.equal(created[0].targetEntity.entityId, "club-x");

  const again = ensureOpponentAnalysisTask(created, "fx-1", "club-x", "2026-08-25", "2026-08-20");
  assert.equal(again.length, 1, "must not duplicate the task for the same fixture");
});

test("ensureOpponentAnalysisTask clamps a completion date that would fall in the past to today", () => {
  const created = ensureOpponentAnalysisTask([], "fx-1", "club-x", "2026-08-20", "2026-08-19");
  // fixtureDate - lead days < today -> clamped to today.
  assert.equal(created[0].completionDate, "2026-08-19");
});
