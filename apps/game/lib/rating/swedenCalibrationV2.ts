// HM-RATINGS-0.2: the FIRST numerical calibration set for Swedish
// Handbollsligan players -- calibration of the RATING SCALE, not a mass
// rating pass. Every CA/PA/attribute number below is a calibration
// HYPOTHESIS (Rating Model §1: "Numerical player examples in this
// document are calibration hypotheses unless explicitly marked as
// source anchors"), placed by hand against the qualitative evidence in
// docs/design/HANDBALL_MANAGER_SWEDEN_2026-27_PLAYER_RATING_ANCHORS_v0.1.docx
// and the working numeric hypotheses already published in
// docs/design/HANDBALL_MANAGER_PLAYER_RATING_MODEL_v0.1.docx §17-18 --
// never derived from an automated weighting engine (that is later work,
// Rating Model §21 steps 3-4, explicitly out of scope here).
//
// Builds on top of (never modifies) the qualitative-only profiles in
// swedenCalibrationFixtures.ts (HM-RATINGS-0.1) -- this file reuses
// their real evidence claims and adds numeric ca/pa/attributes/roles.
//
// Scope: exactly the 12 named anchor players this milestone was asked
// to calibrate. See this milestone's own report for the audit of the
// resulting hierarchy, and for the two model fixes calibration exposed
// (PA_PRIOR_BANDS.NORMAL_OR_UNCERTAIN_POTENTIAL, paRatingFromPotentialAnchors).
import { paRatingFromPotentialAnchor, paRatingFromPotentialAnchors, unassessedAbilityRating } from "./validators";
import { CA_MAX, CA_MIN, PA_MAX, PA_MIN, type AbilityRating, type PlayerRatingClaim, type PlayerRatingProfile, type Position } from "./types";
import {
  ANDERS_WIK_RYDBERG_ID,
  ANDREAS_NILSSON_ID,
  BALDUR_FRITZ_BJARNASON_ID,
  GUSTAV_DAVIDSSON_ID,
  LIAM_HULTBERG_ID,
  MALTE_HAGLUND_ID,
  NICLAS_EKBERG_ID,
  ROBIN_JARLING_ID,
  andersWikRydbergProfile,
  andreasNilssonProfile,
  baldurFritzBjarnasonProfile,
  gustavDavidssonProfile,
  liamHultbergProfile,
  malteHaglundProfile,
  niclasEkbergProfile,
  robinJarlingProfile,
} from "./swedenCalibrationFixtures";

function claim(overrides: Pick<PlayerRatingClaim, "id" | "playerId" | "evidenceClass" | "domain" | "key" | "value"> & Partial<PlayerRatingClaim>): PlayerRatingClaim {
  return { sourceRefs: ["ev-sweden-2026-27-anchors"], ...overrides };
}

/** A calibration note is itself evidence-tracked (USER_EXPERT_PLAYER_ANCHOR + a "CALIBRATION" domain) -- the reasoning behind a CA/PA placement is never silent. */
function calibrationNote(playerId: string, id: string, key: string, note: string): PlayerRatingClaim {
  return { id, playerId, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "CALIBRATION", key, value: note, sourceRefs: ["ev-hm-ratings-0.2-calibration"], confidence: "UNCERTAIN" };
}

function calibrate(
  base: PlayerRatingProfile,
  overlay: {
    ca: AbilityRating;
    pa: AbilityRating;
    outcourtAttributes?: PlayerRatingProfile["outcourtAttributes"];
    goalkeeperAttributes?: PlayerRatingProfile["goalkeeperAttributes"];
    attackRoleProficiencies?: PlayerRatingProfile["attackRoleProficiencies"];
    defenceRoleProficiencies?: PlayerRatingProfile["defenceRoleProficiencies"];
    extraClaims?: PlayerRatingClaim[];
  },
): PlayerRatingProfile {
  const next: PlayerRatingProfile = {
    ...base,
    ca: overlay.ca,
    pa: overlay.pa,
    attackRoleProficiencies: overlay.attackRoleProficiencies ?? base.attackRoleProficiencies,
    defenceRoleProficiencies: overlay.defenceRoleProficiencies ?? base.defenceRoleProficiencies,
    claims: [...base.claims, ...(overlay.extraClaims ?? [])],
  };
  // Only set the attribute-branch keys when actually provided -- an
  // explicitly-undefined key is not the same as an absent one under
  // JSON serialization, and "absence, not fabrication" should hold for
  // the key itself, not just its value.
  if (overlay.outcourtAttributes !== undefined) next.outcourtAttributes = overlay.outcourtAttributes;
  if (overlay.goalkeeperAttributes !== undefined) next.goalkeeperAttributes = overlay.goalkeeperAttributes;
  return next;
}

function freshProfile(playerId: string, position: Position): PlayerRatingProfile {
  return {
    playerId,
    position,
    physicalProfile: {},
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [],
  };
}

// ---------------------------------------------------------------------------
// 1. Gustav Davidsson (Hammarby, M9) -- league-best expert playmaker
// anchor. Source hypothesis (Rating Model §18): CA ~166. Strong,
// multi-signal VERIFIED_CAREER_SIGNAL (senior international, foreign
// pro experience) + an unhedged "best playmaker in the league" expert
// claim -> HIGH CA confidence. He reads as an established, at-peak
// veteran star, not a development case -- PA sits close to CA with only
// modest headroom (MEDIUM confidence: not directly evidenced, an
// inference from "established veteran" rather than a stated anchor).
// ---------------------------------------------------------------------------

export const gustavDavidssonProfileV2: PlayerRatingProfile = calibrate(gustavDavidssonProfile, {
  ca: { value: 166, confidence: "HIGH", plausibleRange: { min: 160, max: 172 } },
  pa: { value: 170, confidence: "MEDIUM", plausibleRange: { min: 165, max: 176 } },
  outcourtAttributes: {
    // "Passing EXCEPTIONAL" + the source's own preserved '20+' qualitative language.
    PASSING: 20,
    // "Playmaking LEAGUE-BEST EXPERT ASSESSMENT".
    PLAYMAKING: 20,
    // "Own scoring threat STRONG" -- clearly strong, not elite; kept modest and distinct from his elite passing/playmaking.
    SHOOTING_PLACEMENT: 15,
  },
  attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }],
  extraClaims: [
    calibrationNote(
      GUSTAV_DAVIDSSON_ID,
      "gd-cal-1",
      "caPlacement",
      "CA 166 matches the Rating Model's own §18 worked hypothesis exactly. PA set close to CA (170): an established, senior-international, at-peak veteran star reads as having only modest remaining ceiling, not a development case -- this is an inference, not a stated anchor, hence MEDIUM (not HIGH) PA confidence.",
    ),
  ],
});

// ---------------------------------------------------------------------------
// 2. Niclas Ekberg (Ystads IF, H6) -- club icon/star, league-best H6
// benchmark. No explicit CA hypothesis exists in Rating Model §18; this
// milestone calibrates independently, keeping him close to Andreas
// Nilsson's given 168 (a comparable-stature decorated veteran icon)
// rather than inventing a higher figure ungrounded in the source's own
// worked examples. Veteran at/past peak -> PA = CA (no further ceiling
// expected), MEDIUM confidence (an inference, not directly evidenced).
// ---------------------------------------------------------------------------

export const niclasEkbergProfileV2: PlayerRatingProfile = calibrate(niclasEkbergProfile, {
  ca: { value: 167, confidence: "HIGH", plausibleRange: { min: 161, max: 173 } },
  pa: { value: 167, confidence: "MEDIUM", plausibleRange: { min: 163, max: 172 } },
  outcourtAttributes: {
    // "H6 positional standing LEAGUE_BEST".
    WING_FINISHING: 20,
  },
  attackRoleProficiencies: [{ role: "ELITE_FINISHER" }],
  extraClaims: [
    calibrationNote(
      NICLAS_EKBERG_ID,
      "ne-cal-1",
      "caPlacement",
      "No explicit CA hypothesis exists in the source for Ekberg. Calibrated near Andreas Nilsson's given ~168 as a comparable-stature decorated veteran icon (extensive international/European pedigree, unhedged 'league-best' positional claim), rather than inventing an ungrounded higher figure. PA = CA: an at/past-peak veteran, no further ceiling expected (inference, MEDIUM confidence).",
    ),
  ],
});

// ---------------------------------------------------------------------------
// 3. Andreas Nilsson (Önnereds HK, M6) -- offensive M6 + weaker defence
// specialism. Source hypothesis (Rating Model §18): CA ~168. The
// specialist asymmetry is preserved explicitly: an elite offensive
// attribute alongside an intentionally LOW defensive attribute (never
// averaged toward a "balanced" middle value), and NO defensive role
// proficiency is claimed at all.
// ---------------------------------------------------------------------------

export const andreasNilssonProfileV2: PlayerRatingProfile = calibrate(andreasNilssonProfile, {
  ca: { value: 168, confidence: "HIGH", plausibleRange: { min: 162, max: 174 } },
  pa: { value: 168, confidence: "MEDIUM", plausibleRange: { min: 163, max: 173 } },
  outcourtAttributes: {
    // "M6 positional standing LEAGUE_BEST" + "Offensive impact ELITE".
    PIVOT_PLAY: 20,
    FINISHING: 18,
    // "Defensive ability BELOW_PROFILE_EXPECTATION / NOT_STRONG" -- the specialist's genuinely weak phase, preserved honestly.
    DEFENSIVE_POSITIONING: 8,
  },
  attackRoleProficiencies: [{ role: "OFFENSIVE_PIVOT" }],
  defenceRoleProficiencies: [], // deliberately empty -- no defensive role is claimed for this specialist
  extraClaims: [
    calibrationNote(
      ANDREAS_NILSSON_ID,
      "an-cal-1",
      "caPlacement",
      "CA 168 matches the Rating Model's own §18 worked hypothesis exactly. PIVOT_PLAY=20/FINISHING=18 vs DEFENSIVE_POSITIONING=8 preserved as an intentional asymmetric specialist profile -- the two phases are never averaged toward each other, and no defenceRoleProficiency is assigned at all. PA = CA: decorated, long-tenured veteran near end of prime, no further ceiling expected.",
    ),
  ],
});

// ---------------------------------------------------------------------------
// 4. Peter Johannesson (IK Sävehof, GK) -- goalkeeper branch. Verified
// evidence is exceptionally strong (28 senior caps, WC silver, EC gold,
// long Bundesliga career), but the expert anchor is explicitly HEDGED
// ("CAN be the best goalkeeper in Handbollsligan", not an unhedged
// "IS the best" claim like Ekberg/Nilsson/Grøtta receive elsewhere in
// the source) -- calibrated a tier below the unhedged league-best
// cohort to honor that genuine qualitative distinction, not treated as
// equivalent just because the underlying CV is comparably decorated.
// ---------------------------------------------------------------------------

export const PETER_JOHANNESSON_ID = "se_player_peter_johannesson";

export const peterJohannessonProfile: PlayerRatingProfile = (() => {
  const base = freshProfile(PETER_JOHANNESSON_ID, "GK");
  base.claims = [
    claim({ id: "pj-cs-1", playerId: PETER_JOHANNESSON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "seniorInternational", value: "28 Swedish senior internationals reported; World Championship silver 2021; European Championship gold 2022" }),
    claim({ id: "pj-cs-2", playerId: PETER_JOHANNESSON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "foreignClubExperience", value: "Long foreign career including TBV Lemgo and GOG; German Cup winner; Champions League/European experience" }),
    claim({ id: "pj-an-1", playerId: PETER_JOHANNESSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" }),
    claim({
      id: "pj-fa-1",
      playerId: PETER_JOHANNESSON_ID,
      evidenceClass: "USER_EXPERT_PLAYER_ANCHOR",
      domain: "FUNCTIONAL_ATTRIBUTE",
      key: "GOALKEEPER_POSITIONAL_STANDING",
      value: "POTENTIAL_LEAGUE_BEST",
      notes: "Explicitly hedged ('can be the best'), distinct from the unhedged LEAGUE_BEST claims given to Ekberg/Nilsson/Grøtta elsewhere in the source.",
    }),
  ];
  return calibrate(base, {
    ca: { value: 162, confidence: "HIGH", plausibleRange: { min: 155, max: 168 } },
    pa: { value: 162, confidence: "MEDIUM", plausibleRange: { min: 157, max: 168 } },
    goalkeeperAttributes: {
      GK_POSITIONING: 18,
    },
    extraClaims: [
      calibrationNote(
        PETER_JOHANNESSON_ID,
        "pj-cal-1",
        "caPlacement",
        "Verified pedigree (28 caps, WC silver, EC gold, Bundesliga) is comparable to Andreas Nilsson's decorated career, but the expert anchor is explicitly hedged ('can be the best', not 'is the best') -- calibrated one tier below the unhedged league-best cohort (168) to honor that genuine distinction, at 162. This is the clearest test in this calibration set that CA tracks the STRENGTH of the actual claim, not just the length of the CV.",
      ),
    ],
  });
})();

// ---------------------------------------------------------------------------
// 5. Liam Hultberg (Ystads IF, M6) -- high current ability + very high
// potential coexisting. Source hypothesis (Rating Model §18): CA ~161 /
// PA ~188. The anchors source calls his ceiling "VERY_HIGH_TO_EXTREME",
// straddling two PA_PRIOR_BANDS -- calibrated with the new
// paRatingFromPotentialAnchors merge helper rather than forcing a
// single-band choice. No attribute values are assigned: the qualitative
// evidence ("physical qualities, quick feet, shooting, unusual
// style") is descriptive but not precise enough to responsibly place a
// specific 1-20 number without overreach.
// ---------------------------------------------------------------------------

const liamHultbergPaRange = paRatingFromPotentialAnchors(["VERY_HIGH_POTENTIAL", "EXTREME_POTENTIAL"], "MEDIUM").plausibleRange;

export const liamHultbergProfileV2: PlayerRatingProfile = calibrate(liamHultbergProfile, {
  ca: { value: 161, confidence: "MEDIUM", plausibleRange: { min: 150, max: 169 } },
  // The merged VERY_HIGH_POTENTIAL/EXTREME_POTENTIAL band ([160,195], from
  // the source's own "VERY_HIGH_TO_EXTREME" ceiling anchor) independently
  // supports the Rating Model's own §18 worked hypothesis of PA ~188 --
  // the explicit point value is taken from that hypothesis, the range
  // from the merged bands, rather than either being invented alone.
  pa: { value: 188, confidence: "MEDIUM", plausibleRange: liamHultbergPaRange },
  extraClaims: [
    calibrationNote(
      LIAM_HULTBERG_ID,
      "lh-cal-1",
      "caPlacement",
      `CA 161 and PA 188 both match the Rating Model's own §18 worked hypothesis. PA's plausibleRange [${liamHultbergPaRange.min},${liamHultbergPaRange.max}] comes from paRatingFromPotentialAnchors(['VERY_HIGH_POTENTIAL','EXTREME_POTENTIAL']), because the source anchor is explicitly 'VERY_HIGH_TO_EXTREME', not cleanly one band -- the merged range honestly represents that straddling claim rather than forcing a single-band choice, while still anchoring the point value to the source's own hypothesis. No numeric attributes assigned: the qualitative description (quick feet, shooting, unusual style) is real but too imprecise to responsibly place a 1-20 number.`,
    ),
  ],
});

// ---------------------------------------------------------------------------
// 6. Alexander Morsten (Hammarby, M6) -- genuine two-way M6, contrasting
// case to Andreas Nilsson's one-way offensive specialism. No verified
// external career signal exists ("no larger external career signal
// verified in first pass") -- CA confidence is MEDIUM despite a strong
// internal club anchor, wider range than the internationally-verified
// players. No potential anchor exists at all -- PA stays fully
// unassessed rather than invented.
// ---------------------------------------------------------------------------

export const ALEXANDER_MORSTEN_ID = "se_player_alexander_morsten";

export const alexanderMorstenProfile: PlayerRatingProfile = (() => {
  const base = freshProfile(ALEXANDER_MORSTEN_ID, "M6");
  base.claims = [
    claim({ id: "am-an-1", playerId: ALEXANDER_MORSTEN_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" }),
    claim({ id: "am-an-2", playerId: ALEXANDER_MORSTEN_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "TWO_WAY_M6" }),
    claim({
      id: "am-cs-1",
      playerId: ALEXANDER_MORSTEN_ID,
      evidenceClass: "UNASSESSED",
      domain: "CAREER_SIGNAL",
      key: "externalCareer",
      value: "No larger external career signal verified in first pass",
      sourceRefs: [],
    }),
    claim({ id: "am-fa-1", playerId: ALEXANDER_MORSTEN_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "M6_ATTACKING_IMPACT", value: "ELITE_CLUB_LEVEL_SIGNAL" }),
    claim({ id: "am-fa-2", playerId: ALEXANDER_MORSTEN_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "DEFENSIVE_IMPACT", value: "VERY_STRONG" }),
  ];
  return calibrate(base, {
    ca: { value: 155, confidence: "MEDIUM", plausibleRange: { min: 144, max: 164 } },
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    outcourtAttributes: {
      PIVOT_PLAY: 17, // "M6 attacking impact ELITE_CLUB_LEVEL_SIGNAL"
      DEFENSIVE_POSITIONING: 16, // "Defensive impact VERY_STRONG" -- genuinely two-way, contrasts with Andreas Nilsson's one-way profile
    },
    attackRoleProficiencies: [{ role: "TWO_WAY_M6" }],
    defenceRoleProficiencies: [{ role: "CENTRAL_ANCHOR" }],
    extraClaims: [
      calibrationNote(
        ALEXANDER_MORSTEN_ID,
        "am-cal-1",
        "caPlacement",
        "CA 155 (very good Handbollsligan / key-player territory), MEDIUM confidence -- no VERIFIED_CAREER_SIGNAL exists at all, only a strong internal club anchor, so the range is wider than the internationally-verified players. PA left fully unassessed: no potential anchor exists in the source at all, and none is invented. PIVOT_PLAY=17/DEFENSIVE_POSITIONING=16 is the deliberate contrast case to Andreas Nilsson's one-way specialism -- a genuine two-way profile, not a specialist.",
      ),
    ],
  });
})();

// ---------------------------------------------------------------------------
// 7. Anders Wik Rydberg (Hammarby, M6) -- defensive specialist. Source
// hypothesis (Rating Model §18): CA ~153. No functional-attribute
// anchor exists in the source at all (only the role-level
// ROLE_SPECIALIST/DEFENSIVE_SPECIALIST anchors + a club-continuity
// signal) -- outcourtAttributes stays entirely UNASSESSED rather than
// inferring numbers from the role label alone. His specialism is
// represented purely through CA + the defenceRoleProficiency, exactly
// the separation of concerns Role Ability exists for.
// ---------------------------------------------------------------------------

export const andersWikRydbergProfileV2: PlayerRatingProfile = calibrate(andersWikRydbergProfile, {
  ca: { value: 153, confidence: "HIGH", plausibleRange: { min: 147, max: 159 } },
  pa: { value: 153, confidence: "MEDIUM", plausibleRange: { min: 148, max: 158 } },
  extraClaims: [
    calibrationNote(
      ANDERS_WIK_RYDBERG_ID,
      "awr-cal-1",
      "caPlacement",
      "CA 153 matches the Rating Model's own §18 worked hypothesis exactly. No outcourt attribute values are assigned: the source gives only role-level anchors (ROLE_SPECIALIST/DEFENSIVE_SPECIALIST) and a club-continuity signal, no functional-attribute claim -- inventing attribute numbers from the role label alone would violate 'unknown stays unknown'. His specialism is represented entirely through CA + defenceRoleProficiencies, exactly the separation Role Ability exists for. PA = CA: 16th-season veteran, no further development ceiling expected.",
    ),
  ],
});

// ---------------------------------------------------------------------------
// 8. Leonard Gegaj (LUGI) -- scoring specialist stepping up a
// competition tier. Verified production (188 goals) was achieved in
// Herrallsvenskan (tier 2), the season LUGI were PROMOTED INTO
// Handbollsligan -- Country & Competition Layer §23's anti-double-
// counting rule applies directly: strong lower-tier production is
// real evidence, but it is NOT equivalent-strength evidence to the
// same tally in Handbollsligan itself, so CA is calibrated toward the
// lower end of the "ordinary established Handbollsligan" zone rather
// than the elite tiers his raw goal count alone might suggest. Exact
// playing position is not stated in the source -- flagged explicitly
// as an inferred, not verified, field.
// ---------------------------------------------------------------------------

export const LEONARD_GEGAJ_ID = "se_player_leonard_gegaj";

export const leonardGegajProfile: PlayerRatingProfile = (() => {
  const base = freshProfile(LEONARD_GEGAJ_ID, "V6");
  base.claims = [
    claim({ id: "lg-cs-1", playerId: LEONARD_GEGAJ_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "lowerTierProduction", value: "188 goals in Herrallsvenskan 2025/26 and LUGI's leading scorer in the promotion season", contextRef: "competition:se_allsvenskan_herr_2025_26" }),
    claim({ id: "lg-an-1", playerId: LEONARD_GEGAJ_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "KEY_PLAYER" }),
    claim({ id: "lg-an-2", playerId: LEONARD_GEGAJ_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "SCORING_SPECIALIST" }),
    claim({ id: "lg-fa-1", playerId: LEONARD_GEGAJ_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "GOAL_SCORING", value: "VERY_HIGH" }),
    claim({ id: "lg-fa-2", playerId: LEONARD_GEGAJ_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "SHOOTING", value: "VERY_STRONG" }),
    claim({ id: "lg-fa-3", playerId: LEONARD_GEGAJ_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "HEIGHT_SIZE", value: "NOT_ESPECIALLY_TALL" }),
    claim({
      id: "lg-pos-1",
      playerId: LEONARD_GEGAJ_ID,
      evidenceClass: "USER_EXPERT_PLAYER_ANCHOR",
      domain: "FUNCTIONAL_ATTRIBUTE",
      key: "inferredPosition",
      value: "V6",
      confidence: "UNCERTAIN",
      notes: "The source does not state an explicit playing position. V6 (wing) is inferred from the 'not especially tall, prolific scorer' profile -- wings commonly finish via placement/angle rather than the size/power backs often rely on. This inference should be verified against real squad/roster data before HM-RATINGS-0.3.",
    }),
  ];
  return calibrate(base, {
    ca: { value: 130, confidence: "MEDIUM", plausibleRange: { min: 116, max: 145 } },
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    outcourtAttributes: {
      FINISHING: 17, // "Goal scoring VERY_HIGH"
      SHOOTING_POWER: 16, // "Shooting VERY_STRONG"
    },
    extraClaims: [
      calibrationNote(
        LEONARD_GEGAJ_ID,
        "lg-cal-1",
        "caPlacement",
        "CA 130 -- calibrated toward the lower end of the 'ordinary established Handbollsligan' zone (§10: ~128-143), NOT toward an elite tier his raw 188-goal tally alone might suggest. His production was achieved in Herrallsvenskan (tier 2), the promotion season -- Country & Competition Layer §23's rule applies: strong lower-tier evidence calibrates the estimate, it does not multiply into an equivalent Handbollsligan-tier CA. This is the clearest anti-reputation test in this calibration set: raw production numbers alone did not drive CA upward. PA left fully unassessed: no potential anchor exists in the source.",
      ),
    ],
  });
})();

// ---------------------------------------------------------------------------
// 9. Albert Månsson (LUGI) -- primary playmaker whose value is creation,
// not personal scoring. Same promotion-tier caveat as Gegaj, but with
// even thinner verified evidence (captaincy + established role only, no
// production statistic). Explicitly does NOT receive a finishing/
// shooting attribute boost despite being a "primary playmaker" --
// "personal scoring NOT_PRIMARY_VALUE" is honored by leaving those
// attributes unassessed rather than guessing.
// ---------------------------------------------------------------------------

export const ALBERT_MANSSON_ID = "se_player_albert_mansson";

export const albertManssonProfile: PlayerRatingProfile = (() => {
  const base = freshProfile(ALBERT_MANSSON_ID, "M9");
  base.claims = [
    claim({ id: "am2-cs-1", playerId: ALBERT_MANSSON_ID, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "captaincy", value: "Team captain together with Calle Lindqvist; established central player in the side promoted to Handbollsligan", contextRef: "competition:se_allsvenskan_herr_2025_26" }),
    claim({ id: "am2-an-1", playerId: ALBERT_MANSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" }),
    claim({ id: "am2-an-2", playerId: ALBERT_MANSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "role", value: "PRIMARY_PLAYMAKER" }),
    claim({ id: "am2-fa-1", playerId: ALBERT_MANSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "PLAYMAKING", value: "VERY_HIGH" }),
    claim({ id: "am2-fa-2", playerId: ALBERT_MANSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "CHANCE_CREATION", value: "VERY_HIGH" }),
    claim({ id: "am2-fa-3", playerId: ALBERT_MANSSON_ID, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "PERSONAL_SCORING_IMPORTANCE", value: "NOT_PRIMARY_VALUE" }),
  ];
  return calibrate(base, {
    ca: { value: 132, confidence: "MEDIUM", plausibleRange: { min: 118, max: 148 } },
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    outcourtAttributes: {
      PLAYMAKING: 16, // "Playmaking VERY_HIGH" + "Chance creation for teammates VERY_HIGH"
      // FINISHING/SHOOTING_POWER deliberately absent: "personal scoring NOT_PRIMARY_VALUE" is honored by omission, not by an artificially low number.
    },
    attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }],
    extraClaims: [
      calibrationNote(
        ALBERT_MANSSON_ID,
        "am2-cal-1",
        "caPlacement",
        "CA 132 -- comparable promotion-tier calibration to Leonard Gegaj, slightly higher given the explicit captaincy/leadership signal, but with even thinner verified evidence (no production statistic at all) -- wider plausible range. PLAYMAKING=16 reflects the VERY_HIGH creation anchors; no scoring-related attribute is assigned at all, honoring 'personal scoring NOT_PRIMARY_VALUE' by omission rather than an invented low number. PA left fully unassessed.",
      ),
    ],
  });
})();

// ---------------------------------------------------------------------------
// 10. Baldur Fritz Bjarnason -- large CA/PA development gap. Source
// hypothesis (Rating Model §18): CA ~138 / PA ~183-185. His scoring-
// champion production was in the Icelandic top league (foreign, not
// Handbollsligan), so it calibrates his CA context rather than proving
// Handbollsligan-level ability outright.
// ---------------------------------------------------------------------------

export const baldurFritzBjarnasonProfileV2: PlayerRatingProfile = calibrate(baldurFritzBjarnasonProfile, {
  ca: { value: 138, confidence: "MEDIUM", plausibleRange: { min: 124, max: 152 } },
  pa: { value: 184, confidence: "MEDIUM", plausibleRange: { min: 172, max: 195 } },
  outcourtAttributes: {
    SHOOTING_POWER: 15, // scoring-champion signal, kept moderate: foreign top-league evidence, not Handbollsligan-verified
  },
  extraClaims: [
    calibrationNote(
      BALDUR_FRITZ_BJARNASON_ID,
      "bfb-cal-1",
      "caPlacement",
      "CA 138 and PA 184 both sit within the Rating Model's own §18 worked hypothesis (CA ~138 / PA ~183-185). The development gap (+46) is large but not unbounded -- PA confidence stays MEDIUM (a projection for a young player, not a stated certainty). CA context-calibrated from his Icelandic top-league scoring-champion production, not treated as automatic Handbollsligan-level proof.",
    ),
  ],
});

// ---------------------------------------------------------------------------
// 11. Malte Haglund -- anti-bias PA case. NORMAL_OR_UNCERTAIN_POTENTIAL
// uses the new PA_PRIOR_BANDS entry added by this milestone (see
// types.ts). CA is left FULLY UNASSESSED: beyond the Gummersbach
// pathway itself, no importance/production/functional-attribute anchor
// exists in the source at all -- this is the cleanest possible proof
// that a prestigious pathway alone produces neither an inflated CA nor
// an inflated PA.
// ---------------------------------------------------------------------------

export const malteHaglundProfileV2: PlayerRatingProfile = calibrate(malteHaglundProfile, {
  ca: unassessedAbilityRating(CA_MIN, CA_MAX),
  pa: paRatingFromPotentialAnchor("NORMAL_OR_UNCERTAIN_POTENTIAL"),
  extraClaims: [
    calibrationNote(
      MALTE_HAGLUND_ID,
      "mh-cal-1",
      "caPlacement",
      "CA left fully unassessed: beyond the Gummersbach pathway itself, no importance/production/functional-attribute anchor exists in the source at all. PA uses the new NORMAL_OR_UNCERTAIN_POTENTIAL band [90,145] -- this milestone's own model fix, added specifically because this case needed it. Together this is the cleanest anti-bias proof in the set: a prestigious foreign academy pathway alone produces neither an inflated CA nor an inflated PA.",
    ),
  ],
});

// ---------------------------------------------------------------------------
// 12. Robin Järling -- potential separate from injury risk AND from
// current unknown CA. No verified career signal exists beyond squad
// membership -- CA stays fully unassessed. HIGH_POTENTIAL is honored
// via the PA prior band despite CA being unknown and despite the
// (separately-tracked, unverified) major injury history -- three
// independent axes, never collapsed into one.
// ---------------------------------------------------------------------------

export const robinJarlingProfileV2: PlayerRatingProfile = calibrate(robinJarlingProfile, {
  ca: unassessedAbilityRating(CA_MIN, CA_MAX),
  pa: paRatingFromPotentialAnchor("HIGH_POTENTIAL"),
  extraClaims: [
    calibrationNote(
      ROBIN_JARLING_ID,
      "rj-cal-1",
      "caPlacement",
      "CA left fully unassessed: no verified career signal exists beyond squad membership. PA uses the HIGH_POTENTIAL band [140,165] from the stated anchor, independent of both the unknown CA and the separately-tracked (unverified) major knee-injury history -- three genuinely independent axes (current ability, future ceiling, durability), never collapsed into one figure.",
    ),
  ],
});

export const SWEDEN_CALIBRATION_V2_PROFILES: readonly PlayerRatingProfile[] = [
  gustavDavidssonProfileV2,
  niclasEkbergProfileV2,
  andreasNilssonProfileV2,
  peterJohannessonProfile,
  liamHultbergProfileV2,
  alexanderMorstenProfile,
  andersWikRydbergProfileV2,
  leonardGegajProfile,
  albertManssonProfile,
  baldurFritzBjarnasonProfileV2,
  malteHaglundProfileV2,
  robinJarlingProfileV2,
];
