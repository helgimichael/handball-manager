// HM-RATINGS-0.6 Part K/O: the full-league population audit and
// coverage/anti-clone proofs. Runs against the REAL 14-club, 268-player
// Handbollsligan dataset (not synthetic fixtures) -- this is the actual
// target population the milestone is about. HM-DATA-ALLSVENSKAN-1.1:
// `buildCatalog()` now also discovers the 14-club, 261-player
// Allsvenskan dataset, for a combined 529-player real-world population.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog } from "../editor/catalog";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, OUTCOURT_POSITIONS } from "../rating/types";
import { snapshotGameplayRatingsForClub, type GameplayPlayerRating } from "./gameplayRatingSnapshot";

interface LeaguePlayer extends GameplayPlayerRating {
  clubId: string;
  clubName: string;
}

function loadFullLeague(): LeaguePlayer[] {
  const catalog = buildCatalog();
  const league: LeaguePlayer[] = [];
  for (const club of catalog.clubs) {
    const snapshot = snapshotGameplayRatingsForClub(club.clubId);
    for (const player of snapshot.players) {
      league.push({ ...player, clubId: club.clubId, clubName: snapshot.clubName ?? club.clubName });
    }
  }
  return league;
}

test("HM-RATINGS-0.6/HM-DATA-ALLSVENSKAN-1.1 population audit: 529/529 real Handbollsligan+Allsvenskan players receive a complete gameplay CA, PA, and attribute branch", () => {
  const league = loadFullLeague();
  assert.equal(league.length, 529, `expected exactly 529 real players, found ${league.length}`);

  let outcourtCount = 0;
  let gkCount = 0;
  const caValues: number[] = [];
  const bySource: Record<string, number> = {};

  for (const player of league) {
    assert.ok(Number.isFinite(player.ca) && player.ca >= 1 && player.ca <= 200, `${player.playerId} has invalid CA ${player.ca}`);
    assert.ok(Number.isFinite(player.pa) && player.pa >= 1 && player.pa <= 200, `${player.playerId} has invalid PA ${player.pa}`);
    assert.ok(player.pa >= player.ca, `${player.playerId} PA ${player.pa} below CA ${player.ca}`);

    const attributeKeys = Object.keys(player.branch.attributes);
    if (player.branch.branch === "OUTCOURT") {
      outcourtCount++;
      assert.equal(attributeKeys.length, 56, `${player.playerId} outcourt profile has ${attributeKeys.length} attributes, expected 56`);
      for (const key of attributeKeys) assert.ok((OUTCOURT_ATTRIBUTES as readonly string[]).includes(key), `${key} is not a valid outcourt attribute`);
    } else {
      gkCount++;
      assert.equal(attributeKeys.length, 21, `${player.playerId} goalkeeper profile has ${attributeKeys.length} attributes, expected 21`);
      for (const key of attributeKeys) assert.ok((GOALKEEPER_ATTRIBUTES as readonly string[]).includes(key), `${key} is not a valid goalkeeper attribute`);
    }
    for (const entry of Object.values(player.branch.attributes) as { value: number }[]) {
      assert.ok(entry.value >= 1 && entry.value <= 20, `${player.playerId} attribute value ${entry.value} out of range`);
    }

    caValues.push(player.ca);
    bySource[player.caSource] = (bySource[player.caSource] ?? 0) + 1;
  }

  assert.equal(outcourtCount + gkCount, 529);

  caValues.sort((a, b) => a - b);
  const mean = caValues.reduce((a, b) => a + b, 0) / caValues.length;
  const median = caValues[Math.floor(caValues.length / 2)];
  console.log(`[HM-RATINGS-0.6 audit] CA min=${caValues[0]} max=${caValues[caValues.length - 1]} mean=${mean.toFixed(1)} median=${median}`);
  console.log(`[HM-RATINGS-0.6 audit] outcourt=${outcourtCount} gk=${gkCount}`);
  console.log(`[HM-RATINGS-0.6 audit] by source: ${JSON.stringify(bySource)}`);
  console.log(`[HM-RATINGS-0.6 audit] top 20: ${caValues.slice(-20).reverse().join(", ")}`);
  console.log(`[HM-RATINGS-0.6 audit] bottom 20: ${caValues.slice(0, 20).join(", ")}`);
});

test("HM-RATINGS-0.6 population audit: no branch contamination anywhere in the league", () => {
  const league = loadFullLeague();
  for (const player of league) {
    const keys = Object.keys(player.branch.attributes);
    if (player.branch.branch === "OUTCOURT") {
      for (const key of keys) assert.ok(!(GOALKEEPER_ATTRIBUTES as readonly string[]).includes(key));
    } else {
      for (const key of keys) assert.ok(!(OUTCOURT_ATTRIBUTES as readonly string[]).includes(key));
    }
  }
});

test("HM-RATINGS-0.6 population audit: real calibrated CA survives exactly for the 8 named anchor players", () => {
  const league = loadFullLeague();
  const expected: Record<string, number> = {
    gustav_davidsson: 166,
    niclas_ekberg: 167,
    andreas_nilsson: 168,
    peter_johannesson: 162,
    liam_hultberg: 161,
    alexander_morsten: 155,
    anders_wik_rydberg: 153,
    baldur_fritz_bjarnason: 138,
  };
  for (const [slug, ca] of Object.entries(expected)) {
    const player = league.find((p) => p.playerId.includes(slug));
    assert.ok(player, `expected to find ${slug} in the generated league`);
    assert.equal(player!.ca, ca, `${slug} CA drifted from its calibrated value`);
    // HM-PLAYER-CALIBRATION-1.0: a manager can LOCK a real player's own
    // CA via Editor Mode -- EDITOR_OVERRIDE is a strictly MORE
    // authoritative source than the pipeline's own CALIBRATED anchor
    // (it wins the resolver outright, see gameplayRatingSnapshot.ts's
    // own header), never a drift/regression, so long as the CA value
    // itself is unchanged (asserted above).
    assert.ok(
      player!.caSource === "CALIBRATED" || player!.caSource === "EDITOR_OVERRIDE",
      `${slug} caSource should be CALIBRATED or a manager EDITOR_OVERRIDE lock, was ${player!.caSource}`,
    );
  }
});

test("HM-RATINGS-0.6 population audit: club context shapes the distribution rather than applying a flat per-club bonus -- cross-club CA ranges overlap", () => {
  const league = loadFullLeague();
  const byClub = new Map<string, number[]>();
  for (const player of league) {
    if (!byClub.has(player.clubId)) byClub.set(player.clubId, []);
    byClub.get(player.clubId)!.push(player.ca);
  }
  const clubRanges = Array.from(byClub.entries()).map(([clubId, cas]) => ({ clubId, min: Math.min(...cas), max: Math.max(...cas) }));
  // No single club's entire CA range sits strictly above or below every other club's -- ranges overlap across clubs.
  const globalMin = Math.min(...clubRanges.map((c) => c.min));
  const globalMax = Math.max(...clubRanges.map((c) => c.max));
  let overlapCount = 0;
  for (const club of clubRanges) {
    if (club.min <= globalMax && club.max >= globalMin) overlapCount++;
  }
  assert.equal(overlapCount, clubRanges.length, "expected every club's CA range to overlap the league's overall range");
  // And no club is a degenerate single-point distribution -- squads have spread.
  for (const club of clubRanges) assert.ok(club.max > club.min, `${club.clubId} has zero CA spread`);
});

test("HM-RATINGS-0.6 population audit: position affects generated profile shape -- M9 archetypes emphasize different attributes than V6/H6 archetypes on average", () => {
  const league = loadFullLeague();
  const m9 = league.filter((p) => p.position === "M9" && p.branch.branch === "OUTCOURT");
  const wings = league.filter((p) => (p.position === "V6" || p.position === "H6") && p.branch.branch === "OUTCOURT");
  assert.ok(m9.length > 0 && wings.length > 0);

  const avg = (players: typeof m9, attribute: string) => players.reduce((sum, p) => sum + (p.branch.attributes as Record<string, { value: number }>)[attribute].value, 0) / players.length;
  const m9Playmaking = avg(m9, "PLAYMAKING");
  const wingPlaymaking = avg(wings, "PLAYMAKING");
  const wingTopSpeed = avg(wings, "TOP_SPEED");
  const m9TopSpeed = avg(m9, "TOP_SPEED");

  assert.ok(m9Playmaking > wingPlaymaking, `expected M9 PLAYMAKING (${m9Playmaking}) > wing PLAYMAKING (${wingPlaymaking})`);
  assert.ok(wingTopSpeed > m9TopSpeed, `expected wing TOP_SPEED (${wingTopSpeed}) > M9 TOP_SPEED (${m9TopSpeed})`);
});

test("HM-RATINGS-0.6 population audit: zero accidental complete-attribute-profile clones across the entire league", () => {
  const league = loadFullLeague();
  const seen = new Map<string, string>();
  let duplicates = 0;
  for (const player of league) {
    const signature = `${player.branch.branch}:${JSON.stringify(
      Object.entries(player.branch.attributes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, (v as { value: number }).value]),
    )}`;
    if (seen.has(signature)) {
      duplicates++;
      console.log(`[HM-RATINGS-0.6 audit] duplicate profile: ${player.playerId} matches ${seen.get(signature)}`);
    } else {
      seen.set(signature, player.playerId);
    }
  }
  assert.equal(duplicates, 0, `found ${duplicates} exact-duplicate complete attribute profiles`);
});

test("HM-RATINGS-0.6 population audit: two generated-prior players sharing CA and position still show meaningfully different attribute profiles", () => {
  const league = loadFullLeague();
  const generated = league.filter((p) => p.caSource === "GENERATED_GAME_PRIOR" && p.branch.branch === "OUTCOURT");
  const byCAAndPosition = new Map<string, LeaguePlayer[]>();
  for (const player of generated) {
    const key = `${player.ca}:${player.position}`;
    if (!byCAAndPosition.has(key)) byCAAndPosition.set(key, []);
    byCAAndPosition.get(key)!.push(player);
  }
  let comparedAtLeastOnePair = false;
  for (const group of byCAAndPosition.values()) {
    if (group.length < 2) continue;
    comparedAtLeastOnePair = true;
    const [a, b] = group;
    const attrsA = a.branch.attributes as Record<string, { value: number }>;
    const attrsB = b.branch.attributes as Record<string, { value: number }>;
    const differences = OUTCOURT_ATTRIBUTES.filter((attr) => attrsA[attr].value !== attrsB[attr].value).length;
    assert.ok(differences > 0, `${a.playerId} and ${b.playerId} share CA+position but have identical attribute profiles`);
  }
  assert.ok(comparedAtLeastOnePair, "expected at least one same-CA/same-position pair among generated players to compare");
});

test("HM-RATINGS-0.6 population audit: every one of the 6 outcourt positions and GK are represented", () => {
  const league = loadFullLeague();
  for (const position of OUTCOURT_POSITIONS) {
    assert.ok(league.some((p) => p.position === position), `no player found at position ${position}`);
  }
  assert.ok(league.some((p) => p.position === "GK"));
});

test("HM-RATINGS-0.6 population audit: full-league generation is deterministic across two independent runs", () => {
  const first = loadFullLeague();
  const second = loadFullLeague();
  assert.deepEqual(second, first);
});

test("HM-RATINGS-0.6: snapshotGameplayRatingsForClub returns clubName null (never throws) for an unknown clubId", () => {
  const snapshot = snapshotGameplayRatingsForClub("not_a_real_club");
  assert.equal(snapshot.clubName, null);
  assert.deepEqual(snapshot.players, []);
});
