// Club Identity: career-level identity invariants (ROADMAP §3.1 I1, area 11 save/load).
import { test } from "node:test";
import assert from "node:assert/strict";
import { getClub, TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import type { CareerState } from "./types";

const asSaved = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const roundTrip = (s: CareerState) => migrateCareerState(asSaved(s));

/** Every club id a career stores as a value or a map key (MIGRATION-STRATEGY §2). */
export function storedClubIds(s: CareerState): Set<string> {
  const ids = new Set<string>([s.playerClubId]);
  for (const f of s.fixtures) { ids.add(f.homeClubId); ids.add(f.awayClubId); }
  for (const key of ["worldSquads", "gameplayRatings", "clubEconomies", "competitionMembership", "clubKnowledge", "staffRoster", "clubForm", "aiTacticalPreferences"] as const) {
    for (const id of Object.keys((s[key] as Record<string, unknown> | undefined) ?? {})) ids.add(id);
  }
  for (const p of Object.values(s.clubPartnerships ?? {})) { ids.add(p.clubAId); ids.add(p.clubBId); }
  for (const h of s.seasonHistory ?? []) for (const rows of [h.table, ...Object.values(h.tables ?? {})]) for (const r of rows) ids.add(r.clubId);
  return ids;
}

test("I1 + save/load: a career's stored club ids all resolve and survive a JSON round trip unchanged", () => {
  const s = migrateCareerState(createNewCareerState("club-identity-c1", TUMBA_CLUB_ID));
  const ids = storedClubIds(s);
  for (const id of ids) assert.ok(getClub(id), `${id} resolves`);
  const loaded = roundTrip(s);
  assert.equal(loaded.playerClubId, s.playerClubId);
  assert.deepEqual([...storedClubIds(loaded)].sort(), [...ids].sort());
  assert.deepEqual(asSaved(roundTrip(loaded)), asSaved(loaded), "load twice = load once");
});
