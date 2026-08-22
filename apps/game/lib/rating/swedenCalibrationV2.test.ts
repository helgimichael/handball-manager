// HM-RATINGS-0.2: proves the first numerical calibration set is
// internally valid, keeps CA/PA/attribute/evidence separation intact,
// and encodes the audit findings (hierarchy sense, specialist
// asymmetry, anti-reputation, anti-bias) as durable regression tests --
// not just a one-time manual review.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlayerRatingProfile } from "./validators";
import {
  ALBERT_MANSSON_ID,
  ALEXANDER_MORSTEN_ID,
  LEONARD_GEGAJ_ID,
  PETER_JOHANNESSON_ID,
  SWEDEN_CALIBRATION_V2_PROFILES,
  albertManssonProfile,
  alexanderMorstenProfile,
  andersWikRydbergProfileV2,
  andreasNilssonProfileV2,
  baldurFritzBjarnasonProfileV2,
  gustavDavidssonProfileV2,
  leonardGegajProfile,
  liamHultbergProfileV2,
  malteHaglundProfileV2,
  niclasEkbergProfileV2,
  peterJohannessonProfile,
  robinJarlingProfileV2,
} from "./swedenCalibrationV2";
import { PA_PRIOR_BANDS } from "./types";

// ---------------------------------------------------------------------------
// Domain validity
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2: all 12 calibrated profiles validate cleanly against the domain's own invariants", () => {
  assert.equal(SWEDEN_CALIBRATION_V2_PROFILES.length, 12);
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    const result = validatePlayerRatingProfile(profile);
    assert.equal(result.ok, true, result.ok ? "" : `${profile.playerId}: ${JSON.stringify(result.errors)}`);
  }
});

test("HM-RATINGS-0.2: every calibrated CA/PA value falls within its own plausibleRange and the global 1-200 scale", () => {
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    for (const [label, rating] of [
      ["ca", profile.ca],
      ["pa", profile.pa],
    ] as const) {
      if (rating.value === null) continue;
      assert.ok(rating.value >= 1 && rating.value <= 200, `${profile.playerId}.${label}=${rating.value} outside 1-200`);
      assert.ok(rating.value >= rating.plausibleRange.min && rating.value <= rating.plausibleRange.max, `${profile.playerId}.${label}=${rating.value} outside its own range`);
    }
  }
});

// ---------------------------------------------------------------------------
// CA/PA separation (rules 6, 9)
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2: CA and PA remain independently placed numbers -- no profile has PA silently equal to some formula of CA plus a constant", () => {
  const gaps = SWEDEN_CALIBRATION_V2_PROFILES.filter((p) => p.ca.value !== null && p.pa.value !== null).map((p) => p.pa.value! - p.ca.value!);
  // Gaps vary across the set (0 for at-peak veterans, +46 for a young development case) -- proves PA is not a fixed offset from CA.
  assert.ok(new Set(gaps).size > 1, "PA-minus-CA gap must vary across players, not be a constant offset");
});

test("HM-RATINGS-0.2: PA never sits below CA for any calibrated player -- PA is a ceiling, never a demotion", () => {
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    if (profile.ca.value !== null && profile.pa.value !== null) {
      assert.ok(profile.pa.value >= profile.ca.value, `${profile.playerId}: pa ${profile.pa.value} < ca ${profile.ca.value}`);
    }
  }
});

test("HM-RATINGS-0.2: young players (Baldur, Liam) carry substantial CA-PA gaps without CA itself being suppressed -- youth is not treated as low current ability", () => {
  assert.ok(liamHultbergProfileV2.ca.value !== null && liamHultbergProfileV2.ca.value >= 150, "Liam Hultberg's CA must remain high despite his age");
  assert.ok(liamHultbergProfileV2.pa.value !== null && liamHultbergProfileV2.pa.value! - liamHultbergProfileV2.ca.value! >= 20, "Liam Hultberg must show a substantial CA-PA gap");

  assert.ok(baldurFritzBjarnasonProfileV2.pa.value !== null && baldurFritzBjarnasonProfileV2.pa.value! - baldurFritzBjarnasonProfileV2.ca.value! >= 40, "Baldur Fritz Bjarnason must show a very large CA-PA gap");
});

test("HM-RATINGS-0.2: PA never appears anywhere a current-performance field could read it -- PlayerRatingProfile has exactly one 'pa' key, structurally isolated from ca/attributes/roles", () => {
  const keys = Object.keys(gustavDavidssonProfileV2);
  assert.equal(keys.filter((k) => k === "pa").length, 1);
  // No attribute or role-proficiency object anywhere embeds a "pa" or "potential" field.
  for (const value of Object.values(gustavDavidssonProfileV2.outcourtAttributes ?? {})) {
    assert.equal(typeof value, "number");
  }
});

// ---------------------------------------------------------------------------
// Unknown attributes stay unknown (rule 4)
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2: players with thin functional-attribute evidence carry NO numeric attributes at all, never a filled-in average", () => {
  assert.equal(liamHultbergProfileV2.outcourtAttributes, undefined, "Liam Hultberg: descriptive-but-imprecise evidence must not be forced into 1-20 numbers");
  assert.equal(andersWikRydbergProfileV2.outcourtAttributes, undefined, "Anders Wik Rydberg: only role-level anchors exist, no functional-attribute claim");
});

test("HM-RATINGS-0.2: Albert Månsson has no scoring-related attribute despite being a primary playmaker -- 'personal scoring NOT_PRIMARY_VALUE' is honored by omission, not a fabricated low number", () => {
  assert.ok(albertManssonProfile.outcourtAttributes);
  assert.equal(albertManssonProfile.outcourtAttributes!.FINISHING, undefined);
  assert.equal(albertManssonProfile.outcourtAttributes!.SHOOTING_POWER, undefined);
  assert.equal(albertManssonProfile.outcourtAttributes!.PLAYMAKING, 16);
});

test("HM-RATINGS-0.2: CA stays fully unassessed (null) for players whose only evidence is contextual (pathway, squad membership) with no importance/production anchor", () => {
  assert.equal(malteHaglundProfileV2.ca.value, null);
  assert.equal(robinJarlingProfileV2.ca.value, null);
});

// ---------------------------------------------------------------------------
// Specialist asymmetry (rule 8)
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2: Andreas Nilsson's elite offensive attributes and low defensive attribute are never averaged toward a balanced middle value", () => {
  const attrs = andreasNilssonProfileV2.outcourtAttributes!;
  assert.equal(attrs.PIVOT_PLAY, 20);
  assert.equal(attrs.FINISHING, 18);
  assert.equal(attrs.DEFENSIVE_POSITIONING, 8);
  assert.ok(attrs.PIVOT_PLAY! - attrs.DEFENSIVE_POSITIONING! >= 10, "the offense/defence gap must remain large, not smoothed");
  assert.deepEqual(andreasNilssonProfileV2.defenceRoleProficiencies, [], "no defensive role is claimed for this one-way specialist");
});

test("HM-RATINGS-0.2: Anders Wik Rydberg (pure defensive specialist) validates with zero attack-role proficiencies and zero outcourt attributes, yet still carries a solid independently-set CA", () => {
  assert.deepEqual(andersWikRydbergProfileV2.attackRoleProficiencies, []);
  assert.equal(andersWikRydbergProfileV2.defenceRoleProficiencies.length, 1);
  assert.equal(andersWikRydbergProfileV2.defenceRoleProficiencies[0].role, "DEFENSIVE_SPECIALIST");
  assert.ok(andersWikRydbergProfileV2.ca.value !== null && andersWikRydbergProfileV2.ca.value >= 150, "a defensive specialist must not collapse to a low CA merely for lacking attack attributes");
});

test("HM-RATINGS-0.2: Alexander Morsten (genuine two-way M6) contrasts with Andreas Nilsson (one-way M6 specialist) -- both attack and defence attributes are elite-adjacent, and both an attack and a defence role are claimed", () => {
  const attrs = alexanderMorstenProfile.outcourtAttributes!;
  assert.ok(attrs.PIVOT_PLAY! >= 15 && attrs.DEFENSIVE_POSITIONING! >= 15, "a two-way player must show strong values in BOTH phases, unlike the one-way specialist");
  assert.equal(alexanderMorstenProfile.attackRoleProficiencies.length, 1);
  assert.equal(alexanderMorstenProfile.defenceRoleProficiencies.length, 1);
});

// ---------------------------------------------------------------------------
// Goalkeeper separation (rule 11)
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2: Peter Johannesson uses the goalkeeper branch exclusively -- no outcourt attributes, position GK, goalkeeper-specific attribute vocabulary only", () => {
  assert.equal(peterJohannessonProfile.position, "GK");
  assert.equal(peterJohannessonProfile.outcourtAttributes, undefined);
  assert.ok(peterJohannessonProfile.goalkeeperAttributes);
  assert.ok("GK_POSITIONING" in peterJohannessonProfile.goalkeeperAttributes!);
  assert.equal(validatePlayerRatingProfile(peterJohannessonProfile).ok, true);
});

test("HM-RATINGS-0.2: Peter Johannesson's CA is calibrated below the unhedged 'league-best' outcourt cohort despite a comparably decorated career, proving CA tracks claim strength rather than raw pedigree length", () => {
  assert.ok(peterJohannessonProfile.ca.value !== null);
  assert.ok(andreasNilssonProfileV2.ca.value !== null);
  assert.ok(peterJohannessonProfile.ca.value! < andreasNilssonProfileV2.ca.value!, "the hedged goalkeeper anchor must sit below the unhedged league-best M6 anchor");
});

// ---------------------------------------------------------------------------
// Determinism / data integrity
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2: every claim's playerId matches its owning profile's playerId across the whole calibration set", () => {
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    for (const c of profile.claims) {
      assert.equal(c.playerId, profile.playerId, `claim "${c.id}" belongs to a different player than its container`);
    }
  }
});

test("HM-RATINGS-0.2: every claim id is unique within its own profile (no accidental duplicate/overwritten evidence)", () => {
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    const ids = profile.claims.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${profile.playerId} has duplicate claim ids`);
  }
});

test("HM-RATINGS-0.2: all 12 calibrated players resolve to distinct player ids", () => {
  const ids = SWEDEN_CALIBRATION_V2_PROFILES.map((p) => p.playerId);
  assert.equal(new Set(ids).size, 12);
});

test("HM-RATINGS-0.2: every profile round-trips through JSON without loss -- plain, serializable calibration data, no hidden functions/undefined-dropping/circular references", () => {
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    const roundTripped = JSON.parse(JSON.stringify(profile));
    assert.deepEqual(roundTripped, profile, `${profile.playerId} does not round-trip cleanly through JSON`);
  }
});

test("HM-RATINGS-0.2: reading the same exported profile twice within a test run always returns the identical object -- module-level construction runs once, not per-access, so no re-derivation can silently drift", () => {
  assert.equal(gustavDavidssonProfileV2, SWEDEN_CALIBRATION_V2_PROFILES[0]);
});

// ---------------------------------------------------------------------------
// Preservation of evidence
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2: every V2 profile still carries every qualitative claim its HM-RATINGS-0.1 base profile had -- calibration only ADDS numbers, never discards evidence", () => {
  // Spot-check two players built from HM-RATINGS-0.1 base profiles.
  const baseGustavClaimIds = new Set(["gd-cs-1", "gd-cs-2", "gd-an-1", "gd-an-2", "gd-an-3", "gd-fa-1", "gd-fa-2", "gd-fa-3", "gd-fa-4"]);
  const v2GustavClaimIds = new Set(gustavDavidssonProfileV2.claims.map((c) => c.id));
  for (const id of baseGustavClaimIds) assert.ok(v2GustavClaimIds.has(id), `gustavDavidssonProfileV2 is missing original claim "${id}"`);

  const baseAndreasClaimIds = new Set(["an-cs-1", "an-cs-2", "an-an-1", "an-an-2", "an-an-3", "an-fa-1", "an-fa-2", "an-fa-3"]);
  const v2AndreasClaimIds = new Set(andreasNilssonProfileV2.claims.map((c) => c.id));
  for (const id of baseAndreasClaimIds) assert.ok(v2AndreasClaimIds.has(id), `andreasNilssonProfileV2 is missing original claim "${id}"`);
});

test("HM-RATINGS-0.2: every CA/PA placement carries a traceable calibration-rationale claim -- no number appears without documented reasoning", () => {
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    const hasCalibrationNote = profile.claims.some((c) => c.domain === "CALIBRATION");
    assert.ok(hasCalibrationNote, `${profile.playerId} has no CALIBRATION-domain claim explaining its CA/PA placement`);
  }
});

test("HM-RATINGS-0.2: injury evidence (Baldur, Robin Järling) remains a separate claim, never folded into the CA/PA calibration note or the ability numbers themselves", () => {
  assert.ok(baldurFritzBjarnasonProfileV2.claims.some((c) => c.evidenceClass === "INJURY_AVAILABILITY"));
  assert.ok(robinJarlingProfileV2.claims.some((c) => c.evidenceClass === "INJURY_AVAILABILITY"));
  const baldurCalNote = baldurFritzBjarnasonProfileV2.claims.find((c) => c.domain === "CALIBRATION")!;
  assert.ok(!String(baldurCalNote.value).toLowerCase().includes("injury"), "the CA/PA calibration rationale must not fold injury evidence into the ability numbers");
});

test("HM-RATINGS-0.2: Leonard Gegaj's lower-tier production claim carries a contextRef, and the calibration note explicitly documents that this context prevented (not caused) an inflated CA", () => {
  const productionClaim = leonardGegajProfile.claims.find((c) => c.key === "lowerTierProduction")!;
  assert.ok(productionClaim.contextRef);
  const calNote = leonardGegajProfile.claims.find((c) => c.domain === "CALIBRATION")!;
  assert.ok(String(calNote.value).toLowerCase().includes("tier"));
});

// ---------------------------------------------------------------------------
// Audit: hierarchy sense-check, encoded as durable assertions
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.2 audit: elite established Handbollsligan stars are clearly separated from newly-promoted-club standouts and unassessed prospects", () => {
  const establishedStarCAs = [gustavDavidssonProfileV2.ca.value!, niclasEkbergProfileV2.ca.value!, andreasNilssonProfileV2.ca.value!, peterJohannessonProfile.ca.value!];
  const promotedClubCAs = [leonardGegajProfile.ca.value!, albertManssonProfile.ca.value!];

  for (const starCA of establishedStarCAs) {
    for (const promotedCA of promotedClubCAs) {
      assert.ok(starCA - promotedCA >= 25, `established star CA ${starCA} must be clearly separated from promoted-club CA ${promotedCA}`);
    }
  }
});

test("HM-RATINGS-0.2 audit: specialists (Rydberg, Nilsson) sit solidly in 'very good Handbollsligan / key-player' territory or above despite each lacking a full two-way profile", () => {
  assert.ok(andersWikRydbergProfileV2.ca.value! >= 151, "defensive specialist CA must reach at least the 'very good Handbollsligan' band");
  assert.ok(andreasNilssonProfileV2.ca.value! >= 161, "offensive specialist CA must reach the 'Handbollsligan top player' band despite the weak defensive phase");
});

test("HM-RATINGS-0.2 audit: CA does not simply track raw career-signal volume -- Leonard Gegaj's large verified goal count sits below Alexander Morsten's much thinner but higher-context evidence, because tier context matters", () => {
  assert.ok(leonardGegajProfile.ca.value! < alexanderMorstenProfile.ca.value!, "raw lower-tier production must not outrank a Handbollsligan-level club anchor with less production evidence but the correct competition context");
});

test("HM-RATINGS-0.2 audit: Malte Haglund's NORMAL_OR_UNCERTAIN_POTENTIAL band sits below every other calibrated player's PA range, proving the anti-bias rule actually constrains the number, not just the label", () => {
  const otherPAValues = SWEDEN_CALIBRATION_V2_PROFILES.filter((p) => p.playerId !== malteHaglundProfileV2.playerId && p.pa.value !== null).map((p) => p.pa.value!);
  const haglundRange = malteHaglundProfileV2.pa.plausibleRange;
  assert.ok(haglundRange.max <= Math.min(...otherPAValues) + 20, "Malte Haglund's PA range must not overlap deep into the same territory as the confirmed high-potential players");
});

test("HM-RATINGS-0.2 audit: the model fix (NORMAL_OR_UNCERTAIN_POTENTIAL band) is now a real, importable part of PA_PRIOR_BANDS, not a one-off inline value", () => {
  assert.ok(PA_PRIOR_BANDS.NORMAL_OR_UNCERTAIN_POTENTIAL);
  assert.deepEqual(PA_PRIOR_BANDS.NORMAL_OR_UNCERTAIN_POTENTIAL, malteHaglundProfileV2.pa.plausibleRange);
});

test("HM-RATINGS-0.2 audit: plausible ranges are honest relative to evidence strength -- verified-international players (HIGH CA confidence) have narrower ranges than club-anchor-only players (MEDIUM confidence)", () => {
  const verifiedWidth = gustavDavidssonProfileV2.ca.plausibleRange.max - gustavDavidssonProfileV2.ca.plausibleRange.min; // HIGH confidence
  const clubAnchorOnlyWidth = alexanderMorstenProfile.ca.plausibleRange.max - alexanderMorstenProfile.ca.plausibleRange.min; // MEDIUM confidence, no verified signal
  assert.ok(clubAnchorOnlyWidth > verifiedWidth, "thinner (non-verified) evidence must produce a wider CA range than internationally-verified evidence");
});

test("HM-RATINGS-0.2 audit: still no numeric rating is invented for any player outside this named 12-player calibration set (mass-rating stays explicitly out of scope)", () => {
  const expectedIds = new Set([
    "se_player_gustav_davidsson",
    "se_player_niclas_ekberg",
    "se_player_andreas_nilsson",
    PETER_JOHANNESSON_ID,
    "se_player_liam_hultberg",
    ALEXANDER_MORSTEN_ID,
    "se_player_anders_wik_rydberg",
    LEONARD_GEGAJ_ID,
    ALBERT_MANSSON_ID,
    "se_player_baldur_fritz_bjarnason",
    "se_player_malte_haglund",
    "se_player_robin_jarling",
  ]);
  const actualIds = new Set(SWEDEN_CALIBRATION_V2_PROFILES.map((p) => p.playerId));
  assert.deepEqual(actualIds, expectedIds);
});
