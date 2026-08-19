import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";

test("migrateCareerState backfills a pre-Career-Rhythm (schema v2) save without crashing", () => {
  const fresh = createNewCareerState("seed-1", TUMBA_CLUB_ID);
  // Simulate a real HM-GAME-0.2A save: no Career Rhythm fields at all,
  // gameDate already advanced past season start (as the old jump model would leave it).
  const v2 = { ...fresh, gameDate: "2026-09-02" } as Partial<CareerState> as CareerState;
  delete (v2 as { processedThroughDate?: unknown }).processedThroughDate;
  delete (v2 as { careerEvents?: unknown }).careerEvents;
  delete (v2 as { playerStatuses?: unknown }).playerStatuses;
  delete (v2 as { tasks?: unknown }).tasks;
  delete (v2 as { seasonStartDate?: unknown }).seasonStartDate;

  const migrated = migrateCareerState(v2);

  assert.equal(migrated.processedThroughDate, "2026-09-02", "a v2 save's gameDate was already fully processed under the old jump model");
  assert.deepEqual(migrated.careerEvents, []);
  assert.ok(migrated.playerStatuses);
  assert.ok(Object.keys(migrated.playerStatuses).length > 0);
  assert.ok(Array.isArray(migrated.tasks));
  // No real seasonStartDate exists on a v2 save -- best-effort backfill
  // falls back to gameDate itself (documented in saveMigration.ts).
  assert.equal(migrated.seasonStartDate, "2026-09-02");
});

test("migrateCareerState is idempotent and a no-op (same reference) for an already-migrated state", () => {
  const fresh = createNewCareerState("seed-1", TUMBA_CLUB_ID);
  const once = migrateCareerState(fresh);
  assert.equal(once, fresh, "a fresh HM-GAME-0.3 state should not need migration at all");
  const twice = migrateCareerState(once);
  assert.equal(twice, once);
});
