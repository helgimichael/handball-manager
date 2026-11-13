// Club Identity: career-level identity invariants (ROADMAP §3.1 I1, area 11 save/load).
import { test } from "node:test";
import assert from "node:assert/strict";
import { getClub, TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import type { CareerState } from "./types";
import { storedClubIds } from "./clubWorldCompatibility";

const asSaved = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const roundTrip = (s: CareerState) => migrateCareerState(asSaved(s));

test("I1 + save/load: a career's stored club ids all resolve and survive a JSON round trip unchanged", () => {
  const s = migrateCareerState(createNewCareerState("club-identity-c1", TUMBA_CLUB_ID));
  const ids = storedClubIds(s);
  for (const id of ids) assert.ok(getClub(id), `${id} resolves`);
  const loaded = roundTrip(s);
  assert.equal(loaded.playerClubId, s.playerClubId);
  assert.deepEqual([...storedClubIds(loaded)].sort(), [...ids].sort());
  assert.deepEqual(asSaved(roundTrip(loaded)), asSaved(loaded), "load twice = load once");
});
