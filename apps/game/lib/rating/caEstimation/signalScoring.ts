// HM-RATINGS-0.5 Part D: the signal hierarchy, derived from
// docs/design/HANDBALL_MANAGER_PLAYER_RATING_MODEL_v0.1.docx §3/§4 and
// docs/design/HANDBALL_MANAGER_COUNTRY_COMPETITION_LAYER_v0.1.docx
// §5-6/§23-25.
//
// Turns ONE PlayerRatingClaim into a small evidence-strength score.
// This is deliberately NOT a "label -> CA" lookup table (Part D: "Do
// NOT implement... senior international = CA 165 as a universal lookup
// rule") -- it only produces a relative weight; anchorTable.ts is what
// turns a total score into an actual CA number, by interpolating
// against real calibrated players who score under this exact same
// function (Part E: "reason RELATIVE TO anchors, not independently
// invent a new scale").
//
// Signals this module treats as CA-relevant (Part A audit, "which
// signals may legitimately inform CURRENT ABILITY"): VERIFIED_CAREER_SIGNAL
// evidence describing senior/adult-level competition, and
// USER_EXPERT_PLAYER_ANCHOR evidence that is genuinely player-specific
// (a named importance/role anchor, or a functional-attribute anchor).
// Signals this module deliberately scores at or near zero (Part A
// audit, "which signals must NOT affect CA directly" / "which may only
// inform POTENTIAL"): youth-only career signals, PA-prior anchors
// (HIGH_POTENTIAL etc.), INJURY_AVAILABILITY claims (Rating Model §2:
// "Injury/availability evidence never touches CA/PA fields directly"),
// PROJECTION_EXPECTATION claims, and the structural POSITION/CONTEXT/
// CALIBRATION claims every player already gets (position, birth year,
// pipeline rationale -- never ability evidence).
import type { PlayerRatingClaim } from "../types";

// ---------------------------------------------------------------------------
// USER_EXPERT_PLAYER_ANCHOR (domain "ANCHOR") tiers. Weights are ordinal,
// not a CA formula -- they only rank one anchor's evidence strength
// against another's within THIS estimator; anchorTable.ts is what turns
// a total score into a CA number.
// ---------------------------------------------------------------------------

const ANCHOR_TIER_WEIGHTS: Record<string, number> = {
  // Tier 1: unambiguous top-of-club status.
  CLUB_ICON: 5,
  CLUB_LEGEND: 5,
  SUPER_CLUB_STAR: 5,
  // Tier 2: clear, named star status.
  CLUB_STAR: 4,
  ELITE_M6: 4,
  ELITE_H6: 4,
  // Tier 3: established importance short of "star".
  KEY_PLAYER: 3.5,
  EMERGING_KEY_PLAYER: 3,
  PRIMARY_PLAYMAKER: 3,
  ATTACK_ORGANIZER: 2.5,
  // Tier 4: named specialist/role value -- real, but narrower than a star anchor.
  ROLE_SPECIALIST: 2.5,
  DEFENSIVE_SPECIALIST: 2.5,
  OFFENSIVE_SPECIALIST: 2.5,
  PHYSICAL_SPECIALIST: 2,
  TWO_WAY_M6: 2,
  TWO_WAY_PLAYER: 2,
  TWO_WAY_WING: 2,
  VETERAN_LEADER: 2,
  VETERAN_EXPERIENCE: 1.5,
  SCORING_PROFILE: 1.5,
  DEFENSIVE_PROFILE: 1.5,
  LEADERSHIP_PROFILE: 1,
  TWO_WAY_PROFILE: 1.5,
  MOMENTUM_GOALKEEPER: 2,
  FOREIGN_ELITE_ENVIRONMENT: 1.5,
  // Explicitly PA-leaning anchors (Rating Model §13 PA priors) -- zero
  // CA weight. A prestigious pathway or high ceiling is not current
  // ability (Part B: "PA != player CA").
  HIGH_POTENTIAL: 0,
  DEVELOPMENT_SIGNAL: 0,
  DEVELOPMENT_POTENTIAL: 0,
  VERY_HIGH_POTENTIAL: 0,
  EXTREME_POTENTIAL: 0,
  NORMAL_OR_UNCERTAIN_POTENTIAL: 0,
};

/** An anchor value not in the table above still counts as SOME genuine expert-assessment evidence -- never scored as zero just because it isn't individually enumerated (the anchor vocabulary is deliberately open, see CANONICAL_PLAYER_ANCHORS). */
const DEFAULT_ANCHOR_WEIGHT = 1.5;

// ---------------------------------------------------------------------------
// VERIFIED_CAREER_SIGNAL (domain "CAREER_SIGNAL") keyword tiers. A
// keyword search over the claim's free-text value -- not a machine-
// readable structured field (the source data is prose, transcribed
// verbatim; see extendedPlayerEvidence.ts). Senior/adult, foreign-
// professional and major-competition language scores highest per the
// Player Rating Model's own hierarchy ("meaningful foreign top-league
// experience", "major European competition experience", "established
// high-level domestic performance"); youth-only language is
// deliberately near-zero for CA (PA-leaning per Part D).
// ---------------------------------------------------------------------------

/** Unambiguously senior/adult-level -- can never describe a youth competition, so these always score HIGH regardless of what else the text mentions. */
const UNAMBIGUOUS_HIGH_VALUE_KEYWORDS = ["senior international", "senior caps", "champions league", "bundesliga", "asobal", "sm champion", "sm-final", "national team", "foreign professional", "professional experience"];

/** "World Championship"/"European Championship" are HIGH VALUE only when NOT qualified by a youth marker elsewhere in the same text (a "U20 European Championship" selection is a youth signal, not a senior one -- see YOUTH_ONLY_KEYWORDS below). */
const AMBIGUOUS_MAJOR_COMPETITION_KEYWORDS = ["world championship", "european championship"];

/** A bare "foreign" club-experience mention (without a named top league above) is still meaningful evidence per the Rating Model's "foreign-league experience" signal, but weighted below the explicit high-value keywords. */
const MEDIUM_VALUE_KEYWORDS = [
  "foreign",
  "handbollsligan",
  "established",
  "all star",
  "leading league scorer",
  "top scorer",
  "captain",
];

const YOUTH_ONLY_KEYWORDS = ["youth international", "riksläger", "u18", "u20", "u17", "usm", "youth-developed", "development pathway", "apprentice"];

function scoreCareerSignalText(text: string): number {
  const lower = text.toLowerCase();
  const hasYouthMarker = YOUTH_ONLY_KEYWORDS.some((kw) => lower.includes(kw));

  if (UNAMBIGUOUS_HIGH_VALUE_KEYWORDS.some((kw) => lower.includes(kw))) return 3;
  if (!hasYouthMarker && AMBIGUOUS_MAJOR_COMPETITION_KEYWORDS.some((kw) => lower.includes(kw))) return 3;
  if (MEDIUM_VALUE_KEYWORDS.some((kw) => lower.includes(kw))) return 1.5;
  if (hasYouthMarker) return 0.3;
  // Verified evidence that doesn't match a known keyword is still real,
  // verified evidence -- score it modestly rather than zero, but well
  // below a matched high-value signal.
  return 1;
}

// ---------------------------------------------------------------------------
// USER_EXPERT_PLAYER_ANCHOR (domain "FUNCTIONAL_ATTRIBUTE") tiers --
// qualitative, non-numerical functional judgments (Gustav Davidsson's
// PASSING=EXCEPTIONAL is the canonical example). These feed CA modestly
// (they are genuinely player-specific expert evidence) but are not
// treated as strongly as a named importance/role anchor, since they
// describe one functional dimension, not overall standing.
// ---------------------------------------------------------------------------

function scoreFunctionalAttributeValue(value: string): number {
  const upper = value.toUpperCase();
  if (upper.includes("EXCEPTIONAL") || upper.includes("LEAGUE_BEST") || upper.includes("ELITE")) return 1.5;
  if (upper.includes("STRONG") || upper.includes("POTENTIAL_LEAGUE_BEST")) return 1;
  if (upper.includes("LIMITED") || upper.includes("BELOW")) return -0.5;
  return 0.5;
}

/**
 * Scores exactly one claim's contribution to CA evidence. Returns 0 for
 * every claim class the design docs say must never touch CA directly:
 * INJURY_AVAILABILITY, PROJECTION_EXPECTATION, and the pipeline's own
 * structural POSITION/CONTEXT/CALIBRATION claims.
 */
export function scoreClaimForCA(claim: PlayerRatingClaim): number {
  if (claim.evidenceClass === "USER_EXPERT_PLAYER_ANCHOR" && claim.domain === "ANCHOR") {
    const key = String(claim.value).toUpperCase();
    return key in ANCHOR_TIER_WEIGHTS ? ANCHOR_TIER_WEIGHTS[key] : DEFAULT_ANCHOR_WEIGHT;
  }
  if (claim.evidenceClass === "VERIFIED_CAREER_SIGNAL" && claim.domain === "CAREER_SIGNAL") {
    return scoreCareerSignalText(String(claim.value));
  }
  if (claim.evidenceClass === "USER_EXPERT_PLAYER_ANCHOR" && claim.domain === "FUNCTIONAL_ATTRIBUTE") {
    return scoreFunctionalAttributeValue(String(claim.value));
  }
  // INJURY_AVAILABILITY, PROJECTION_EXPECTATION, POSITION, CONTEXT,
  // CALIBRATION -- never CA evidence (Part A/B).
  return 0;
}

export interface CAEvidenceScore {
  totalScore: number;
  contributingClaims: PlayerRatingClaim[];
  anchorClaimCount: number;
  careerSignalClaimCount: number;
}

/** Scores an entire claim set for CA-estimation purposes -- pure, order-independent, deterministic. */
export function scoreClaimsForCA(claims: readonly PlayerRatingClaim[]): CAEvidenceScore {
  let totalScore = 0;
  let anchorClaimCount = 0;
  let careerSignalClaimCount = 0;
  const contributingClaims: PlayerRatingClaim[] = [];

  for (const claim of claims) {
    const score = scoreClaimForCA(claim);
    if (score === 0) continue;
    totalScore += score;
    contributingClaims.push(claim);
    if (claim.evidenceClass === "USER_EXPERT_PLAYER_ANCHOR" && claim.domain === "ANCHOR") anchorClaimCount++;
    if (claim.evidenceClass === "VERIFIED_CAREER_SIGNAL" && claim.domain === "CAREER_SIGNAL") careerSignalClaimCount++;
  }

  return { totalScore, contributingClaims, anchorClaimCount, careerSignalClaimCount };
}
