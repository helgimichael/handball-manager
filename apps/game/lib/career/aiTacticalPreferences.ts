// HM-IDENTITY-0.3: deterministic, explainable adapter converting a
// resolved CurrentTeamIdentity into AI tactical preferences for a
// non-manager (AI-controlled) club.
//
//   ResolvedCurrentTeamIdentity  ->  TeamTacticalProfile (+ full provenance)
//
// This module consumes ONLY resolved TEAM claims (resolver.ts's own
// output) -- never raw ClubIdentityProfile/CoachIdentityProfile/
// SquadIdentityContext/SeasonClubContext source files directly, so it
// automatically inherits the resolver's own provenance/conflict/
// projection guarantees rather than re-implementing them.
//
// Audit result (this milestone's report): TeamTacticalProfile has
// exactly THREE approved-vocabulary fields --  ati001UsageTendency,
// h2ResponsePreference, tacticalFamiliarity -- and no others. Neither a
// 7v6 usage-tendency field nor a defensive-formation (6:0/5:1/3:3)
// field exists anywhere in TeamTacticalProfile or
// @handball-manager/tactical-domain, even though several clubs'
// identity data narrates both (e.g. sevenVSixWillingness,
// primaryFormation). Those dimensions are deliberately NOT mapped here
// -- inventing a new field to carry them would be exactly the kind of
// new Tactical Domain concept this milestone is scoped to avoid; see
// the milestone report for the full list of rejected mappings.
//
// Every mapped dimension below is driven by a small, explicit,
// hand-authored (domain, key) -> effect whitelist -- never generic
// string-intensity parsing of arbitrary free-form claim values. A
// claim not on a whitelist has zero effect, by construction: "map ONLY
// identity dimensions that have an honest existing gameplay
// representation" and "never invent a tactical variable because
// identity data mentions something unsupported."
import type { IdentityClaim } from "../identity/types";
import type { ResolvedCurrentTeamIdentity, ResolvedTeamClaim } from "../identity/resolver";
import type { ATI001UsageTendency, CapabilityLevel, H2Response, TeamTacticalProfile } from "./teamTacticalProfile";

/** One mapped TeamTacticalProfile dimension, with full provenance -- the literal source IdentityClaim(s) that produced it (empty when a documented default was used instead). */
export interface MappedTacticalDimension<T> {
  value: T;
  /** Human-readable explanation of why this value was chosen -- always present, even for the "no evidence, using the neutral default" case. */
  explanation: string;
  /** The original, unmodified source IdentityClaims (never the synthetic TEAM claim) this value was derived from. Empty array = a documented default, not fabricated evidence. */
  contributingClaims: IdentityClaim[];
}

export interface AiTacticalPreferences {
  clubId: string;
  /** Ready to plumb straight into computeTacticalMatchAdjustment's existing TeamTacticalProfile-shaped parameter -- no new shape introduced. */
  profile: TeamTacticalProfile;
  ati001UsageTendency: MappedTacticalDimension<ATI001UsageTendency>;
  h2ResponsePreference: MappedTacticalDimension<H2Response>;
  tacticalFamiliarity: MappedTacticalDimension<CapabilityLevel>;
}

/**
 * A resolved claim is usable evidence for an AI tactical preference only
 * when it is NOT conflicting (Spec: "conflicting evidence must not
 * produce confident preferences"), NOT a USER_PROJECTION/PROJECTED claim
 * (Spec: "USER_PROJECTION must not become established AI behaviour" --
 * a projection is what a coach/club HOPES becomes true, not what IS
 * true yet), NOT UNKNOWN_NOT_ASSESSED (an explicit "we looked and found
 * nothing", never treated as a signal either way), NOT
 * USER_EXPERT_REQUIRES_VERIFICATION (an explicitly unconfirmed claim),
 * and NOT HISTORICAL (a past pattern is not this club's CURRENT
 * tactical tendency).
 */
function isUsableForAiPreference(claim: ResolvedTeamClaim): boolean {
  if (claim.conflicting) return false;
  if (claim.evidenceClass === "USER_PROJECTION") return false;
  if (claim.evidenceClass === "UNKNOWN_NOT_ASSESSED") return false;
  if (claim.evidenceClass === "USER_EXPERT_REQUIRES_VERIFICATION") return false;
  if (claim.temporalScope === "PROJECTED" || claim.temporalScope === "HISTORICAL") return false;
  return true;
}

function valueString(claim: ResolvedTeamClaim): string {
  return typeof claim.value === "string" ? claim.value : String(claim.value);
}

// ---------------------------------------------------------------------------
// ati001UsageTendency: Bible S60's "team-level tendency to attempt the
// V9/M6 provoke-H2/H3 interaction at all". The only identity claims that
// honestly describe this (rather than attacking quality/style in
// general) are ones naming central/pivot-oriented, duel-seeking,
// physical attacking play -- exactly the V9/M6 pattern ATI-001 models.
// ---------------------------------------------------------------------------

const ATI001_SIGNAL_KEYS = new Set(["m6Involvement", "duelOrientedAttack", "hardFirstAttack", "physicalAttackingProfile", "physicalAttack", "centralShootingThreat"]);
const HIGH_INTENSITY_VALUES = new Set(["HIGH", "VERY_HIGH", "STRONG", "VERY_STRONG", "IMPORTANT", "CORE"]);

function deriveAti001UsageTendency(claims: ResolvedTeamClaim[]): MappedTacticalDimension<ATI001UsageTendency> {
  const contributing = claims.filter(
    (c) => c.domain === "ATTACK" && ATI001_SIGNAL_KEYS.has(c.key) && isUsableForAiPreference(c) && HIGH_INTENSITY_VALUES.has(valueString(c)),
  );
  if (contributing.length > 0) {
    return {
      value: "HIGH",
      explanation: `Club identity documents strong central/pivot-oriented, duel-seeking attacking play (${contributing.map((c) => c.key).join(", ")}) -- the honest identity signal for ATI-001 (V9/M6 provoke-H2) usage tendency.`,
      contributingClaims: contributing.flatMap((c) => c.contributingClaims),
    };
  }
  return {
    value: "MEDIUM",
    explanation: "No identity evidence found for central/pivot-provoking attacking intensity -- defaulting to the neutral MEDIUM tendency, the same baseline a fresh TeamTacticalProfile itself uses.",
    contributingClaims: [],
  };
}

// ---------------------------------------------------------------------------
// h2ResponsePreference: TI-001's H2 Working Rule response vocabulary.
// Only two identity patterns map honestly here: a club whose defence is
// explicitly described as "steering" (H2_STEERS is literally named
// "styr"/steer), and a club whose defence is explicitly described as
// aggressive/contact-seeking/tough (closest honest match: H2_STOPS, the
// most committed/aggressive response). No identity claim in the imported
// data describes a passive-holding or delaying defensive posture, so
// H2_HOLDS/H2_DELAYS are never produced by this adapter -- absence of
// evidence, never a fabricated negative.
// ---------------------------------------------------------------------------

const H2_STEERS_KEYS = new Set(["defensiveSteering"]);

const H2_STOPS_SIGNALS: ReadonlyArray<{ key: string; values: ReadonlySet<string> }> = [
  { key: "contactSeeking", values: new Set(["STRONG", "VERY_STRONG"]) },
  { key: "ballWinningIntent", values: new Set(["HIGH", "VERY_HIGH"]) },
  { key: "defensiveToughness", values: new Set(["STRONG", "VERY_STRONG"]) },
  { key: "clubStatedDirection", values: new Set(["DEFENCE_TOUGHNESS_DISCIPLINE_FIGHT"]) },
];

/** TI-001's own central Working Rule response (teamTacticalProfile.ts's defaultTeamTacticalProfile) -- the honest "no signal" fallback, never an arbitrary pick. */
const H2_NEUTRAL_DEFAULT: H2Response = "H2_STEPS";

function deriveH2ResponsePreference(claims: ResolvedTeamClaim[]): MappedTacticalDimension<H2Response> {
  const defenceClaims = claims.filter((c) => c.domain === "DEFENCE" && isUsableForAiPreference(c));
  const steersClaims = defenceClaims.filter((c) => H2_STEERS_KEYS.has(c.key));
  const stopsClaims = defenceClaims.filter((c) => H2_STOPS_SIGNALS.some((s) => s.key === c.key && s.values.has(valueString(c))));

  if (steersClaims.length > 0 && stopsClaims.length > 0) {
    return {
      value: H2_NEUTRAL_DEFAULT,
      explanation:
        "Identity evidence points to both a steering-oriented and a stopping/contact-seeking defensive posture -- conflicting signals never produce a confident preference, falling back to TI-001's own neutral H2_STEPS default.",
      contributingClaims: [...steersClaims, ...stopsClaims].flatMap((c) => c.contributingClaims),
    };
  }
  if (steersClaims.length > 0) {
    return {
      value: "H2_STEERS",
      explanation: `Club identity explicitly documents a steering defensive posture (${steersClaims.map((c) => c.key).join(", ")}).`,
      contributingClaims: steersClaims.flatMap((c) => c.contributingClaims),
    };
  }
  if (stopsClaims.length > 0) {
    return {
      value: "H2_STOPS",
      explanation: `Club identity documents an aggressive, contact-seeking/toughness-oriented defence (${stopsClaims.map((c) => c.key).join(", ")}).`,
      contributingClaims: stopsClaims.flatMap((c) => c.contributingClaims),
    };
  }
  return {
    value: H2_NEUTRAL_DEFAULT,
    explanation: "No identity evidence found for a specific H2 defensive response style -- defaulting to TI-001's own neutral H2_STEPS default.",
    contributingClaims: [],
  };
}

// ---------------------------------------------------------------------------
// tacticalFamiliarity: Bible S63's "consistency between tactical intent,
// player interpretation, and the collective response". Only genuinely
// honest signals: a season context that literally names tactical
// certainty; a club identity that literally says its current attacking/
// defensive identity is "not yet established"; a head-coach change this
// season (a new coach has not yet built familiarity with the squad); or
// low squad continuity (the collective has not settled). No identity
// claim ever asserts a positive/HIGH familiarity, so this adapter never
// produces HIGH -- again, absence of evidence, never fabricated.
// ---------------------------------------------------------------------------

function deriveTacticalFamiliarity(claims: ResolvedTeamClaim[]): MappedTacticalDimension<CapabilityLevel> {
  const usable = claims.filter(isUsableForAiPreference);

  const literal = usable.find((c) => c.domain === "COMPETITIVE" && c.key === "tacticalCertainty" && ["LOW", "MEDIUM", "HIGH"].includes(valueString(c)));
  if (literal) {
    return {
      value: valueString(literal) as CapabilityLevel,
      explanation: `Season context explicitly documents tactical certainty as ${valueString(literal)} for this club's current era.`,
      contributingClaims: literal.contributingClaims,
    };
  }

  const lowSignals = usable.filter(
    (c) =>
      (c.domain === "ATTACK" && c.key === "currentAttackingIdentity" && valueString(c) === "NOT_YET_ESTABLISHED") ||
      (c.domain === "DEFENCE" && c.key === "currentDefensiveIdentity" && valueString(c) === "NOT_YET_ESTABLISHED") ||
      (c.domain === "ORGANISATIONAL_TRANSITION" && c.key === "headCoachTransition") ||
      (c.domain === "SQUAD_TRANSITION" && c.key === "squadContinuity" && valueString(c) === "LOW_TRANSITION"),
  );
  if (lowSignals.length > 0) {
    return {
      value: "LOW",
      explanation: `Identity evidence documents an unsettled current tactical picture (${lowSignals.map((c) => c.key).join(", ")}) -- a new head coach, a not-yet-established current identity, or low squad continuity all honestly lower tactical familiarity.`,
      contributingClaims: lowSignals.flatMap((c) => c.contributingClaims),
    };
  }

  return {
    value: "MEDIUM",
    explanation: "No identity evidence found for unsettled tactical familiarity -- defaulting to the neutral MEDIUM baseline, the same baseline a fresh TeamTacticalProfile itself uses.",
    contributingClaims: [],
  };
}

/**
 * Pure, deterministic. Same resolved identity always produces a
 * byte-identical AiTacticalPreferences (no randomness, no I/O) -- the
 * resolver's own determinism guarantee carries straight through.
 */
export function deriveAiTacticalPreferences(identity: ResolvedCurrentTeamIdentity): AiTacticalPreferences {
  const ati001UsageTendency = deriveAti001UsageTendency(identity.claims);
  const h2ResponsePreference = deriveH2ResponsePreference(identity.claims);
  const tacticalFamiliarity = deriveTacticalFamiliarity(identity.claims);

  return {
    clubId: identity.clubId,
    profile: {
      ati001UsageTendency: ati001UsageTendency.value,
      h2ResponsePreference: h2ResponsePreference.value,
      tacticalFamiliarity: tacticalFamiliarity.value,
    },
    ati001UsageTendency,
    h2ResponsePreference,
    tacticalFamiliarity,
  };
}
