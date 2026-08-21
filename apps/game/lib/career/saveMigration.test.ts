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

test("HM-GAME-0.4: a pre-schema-v5 InboxMessage (old Swedish category, no archived/resolved) migrates safely", () => {
  const fresh = createNewCareerState("seed-inbox-migration", TUMBA_CLUB_ID);
  const legacyMessage = {
    id: "msg:legacy-1",
    category: "Match",
    sender: "Assisterande tränare",
    subject: "Gammalt meddelande",
    preview: "x",
    body: ["x"],
    date: "2026-08-19",
    read: true,
    important: false,
    careerEventId: "MATCH_COMPLETED:fx-legacy",
  } as unknown as CareerState["inbox"][number];
  const legacyEvent = {
    id: "MATCH_COMPLETED:fx-legacy",
    type: "MATCH_COMPLETED" as const,
    date: "2026-08-19",
    priority: "IMPORTANT" as const,
    subject: "x",
    summary: "x",
    relatedEntities: [],
    destinations: [],
    requiresAction: false,
    resolved: true,
    read: true,
    createdAtGameDate: "2026-08-19",
  };
  const v4: CareerState = { ...fresh, inbox: [legacyMessage], careerEvents: [legacyEvent] };

  const migrated = migrateCareerState(v4);
  const migratedMessage = migrated.inbox[0];

  assert.equal(migratedMessage.category, "MATCH", "legacy Swedish category maps onto the new English category model");
  assert.equal(migratedMessage.archived, false, "archived defaults to false");
  assert.equal(migratedMessage.resolved, true, "resolved is backfilled from the linked CareerEvent's own resolved state");
  assert.equal(migratedMessage.read, true, "existing read state is preserved exactly");
  assert.equal(migrated.inbox.length, 1, "migration never duplicates messages");
});

test("HM-GAME-0.4: a legacy unresolved ACTION_REQUIRED message backfills resolved:false from its linked event, not a default true", () => {
  const fresh = createNewCareerState("seed-inbox-migration-2", TUMBA_CLUB_ID);
  const legacyMessage = {
    id: "msg:legacy-action",
    category: "Match",
    sender: "Assisterande tränare",
    subject: "Matchdag",
    preview: "x",
    body: ["x"],
    date: "2026-08-19",
    read: false,
    important: true,
    actionRequired: true,
    careerEventId: "MATCHDAY_READY:fx-legacy",
  } as unknown as CareerState["inbox"][number];
  const legacyEvent = {
    id: "MATCHDAY_READY:fx-legacy",
    type: "MATCHDAY_READY" as const,
    date: "2026-08-19",
    priority: "ACTION_REQUIRED" as const,
    subject: "x",
    summary: "x",
    relatedEntities: [],
    destinations: [],
    requiresAction: true,
    resolved: false,
    read: false,
    createdAtGameDate: "2026-08-19",
  };
  const v4: CareerState = { ...fresh, inbox: [legacyMessage], careerEvents: [legacyEvent] };

  const migrated = migrateCareerState(v4);
  assert.equal(migrated.inbox[0].resolved, false);
});
