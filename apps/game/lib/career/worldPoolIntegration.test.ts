// HM-WORLD-PLAYER-POOL-1.0: focused proofs for the 100-player
// international pool's career-world integration -- club/competition
// registration, worldSquads/gameplayRatings availability, economic
// identity (Transfers readiness), scouting candidacy, and migration
// idempotency. Mirrors division1Integration's own test style.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getExternalCandidateClubs, getCareerClubSquad, WORLD_POOL_COMPETITION_IDS } from "./careerWorld";
import { ensureWorldPoolPlayerEconomicIdentity } from "./worldPoolIntegration";
import { getPlayerContract } from "../economy/contractIntegration";
import { CLUBS, TUMBA_CLUB_ID, getClub, getClubsByCompetition, getCompetition } from "../game-data";
import { loadRealWorldClubSquad } from "../gameWorld/realWorldLoader";
import { toPlayerMocks } from "../gameWorld/gameWorldAdapter";
import type { CareerState } from "./types";

function baseState(): CareerState {
  return createNewCareerState("worldpool-test-seed", TUMBA_CLUB_ID);
}

test("all 16 international-pool competitions resolve to a registered Competition", () => {
  for (const id of WORLD_POOL_COMPETITION_IDS) {
    assert.ok(getCompetition(id), `expected a registered competition for ${id}`);
  }
});

test("every international-pool club (i.e. one actually backed by pool player data) is non-playable, REAL_WORLD, and belongs to one of the 16 pool competitions", () => {
  // Some pool competitions (e.g. ger-1/Bundesliga) also register other,
  // still-mock clubs that host no pool player -- scope this check to
  // clubs the pool's own real-world data actually backs, not every club
  // that merely shares a competitionId.
  const clubs = WORLD_POOL_COMPETITION_IDS.flatMap((id) => getClubsByCompetition(id)).filter((club) => loadRealWorldClubSquad(club.id) !== null);
  assert.ok(clubs.length >= 31, `expected at least 31 pool-backed clubs across the pool competitions, found ${clubs.length}`);
  for (const club of clubs) {
    assert.equal(club.playable, false, `${club.id} must not be playable`);
    assert.equal(club.dataSource, "REAL_WORLD", `${club.id} must be REAL_WORLD`);
  }
});

test("no duplicate club ids anywhere in the CLUBS registry after the international pool addition", () => {
  const ids = CLUBS.map((c) => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(dupes)], []);
});

test("exactly 100 players are loadable across the pool's clubs, with zero dropped for an unmappable position", () => {
  const clubs = WORLD_POOL_COMPETITION_IDS.flatMap((id) => getClubsByCompetition(id));
  let total = 0;
  for (const club of clubs) {
    const squad = loadRealWorldClubSquad(club.id);
    if (squad) total += squad.players.length;
  }
  assert.equal(total, 100);
});

test("getExternalCandidateClubs includes international-pool clubs for a Swedish career", () => {
  const state = baseState();
  const candidates = getExternalCandidateClubs(state);
  const candidateIds = new Set(candidates.map((c) => c.id));
  assert.ok(candidateIds.has("ger1-kiel"), "THW Kiel must be a scouting/transfer candidate club");
  assert.ok(candidateIds.has("int-h71"), "H71 (Faroe Islands) must be a scouting/transfer candidate club");
});

test("Reused clubs (e.g. THW Kiel) keep their pre-existing identity metadata (name/city) -- only dataSource changed", () => {
  const kiel = getClub("ger1-kiel");
  assert.ok(kiel);
  assert.equal(kiel!.name, "THW Kiel");
  assert.equal(kiel!.city, "Kiel");
  assert.equal(kiel!.competitionId, "ger-1");
});

test("ensureWorldPoolPlayerEconomicIdentity gives every international-pool player a contract, once worldSquads is populated (Transfers readiness)", () => {
  let state = baseState();
  const kielSquad = loadRealWorldClubSquad("ger1-kiel")!;
  const mocks = toPlayerMocks(kielSquad.players);
  state = { ...state, worldSquads: { ...state.worldSquads, "ger1-kiel": mocks } };

  const withEconomy = ensureWorldPoolPlayerEconomicIdentity(state);
  const squad = getCareerClubSquad(withEconomy, "ger1-kiel");
  assert.ok(squad.length > 0);
  for (const player of squad) {
    const contract = getPlayerContract(withEconomy, player.id);
    assert.ok(contract, `expected a contract for ${player.id}`);
  }
});

test("ensureWorldPoolPlayerEconomicIdentity is idempotent -- calling it twice never duplicates or overwrites an existing contract", () => {
  let state = baseState();
  const kielSquad = loadRealWorldClubSquad("ger1-kiel")!;
  const mocks = toPlayerMocks(kielSquad.players);
  state = { ...state, worldSquads: { ...state.worldSquads, "ger1-kiel": mocks } };

  const once = ensureWorldPoolPlayerEconomicIdentity(state);
  const twice = ensureWorldPoolPlayerEconomicIdentity(once);
  assert.deepEqual(twice.playerContracts, once.playerContracts);
});

test("a real German player (THW Kiel) carries worldPoolMetadata with hmLevel/prospect/wonderkidCandidate/confidence preserved", () => {
  const kielSquad = loadRealWorldClubSquad("ger1-kiel")!;
  const player = kielSquad.players.find((p) => p.worldPoolMetadata !== null && p.worldPoolMetadata !== undefined);
  assert.ok(player, "expected at least one THW Kiel player to carry worldPoolMetadata");
  const meta = player!.worldPoolMetadata!;
  assert.ok(meta.workbookId.startsWith("INT-"));
  assert.equal(meta.leagueCountry, "Germany");
  assert.ok(["Elite", "Top", "Established", "Pro", "Development", "Youth"].includes(meta.hmLevel));
  assert.equal(typeof meta.prospect, "boolean");
  assert.equal(typeof meta.wonderkidCandidate, "boolean");
});
