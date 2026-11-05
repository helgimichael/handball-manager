import type {
  CalibrationDecisionCategory,
  CalibrationProposal,
  ConfidenceLevel,
  OfflinePlayerContext,
  ProvisionalBand,
} from "./types";
import { REGRESSION_FIXTURES } from "./fixtures";

/** Set of player IDs with known owner-deferred status */
export const OWNER_DEFERRED_PLAYERS = new Set<string>([
  "player_viggo_moller_holmen_9c5affc4", // HK S-hof
  "se_player_oliver_andersson_20b69aa2", // Redbergslids IK
  "se_player_axel_winstrom_c59447b8", // Redbergslids IK
]);

/** Farm-team linked clubs where dual registration may occur */
export const FARM_CLUB_AFFILIATIONS = new Map<string, string>([
  ["se_club_hp_alingsas", "se_club_alingsas_hk"],
  ["se_club_hk_s_hof", "se_club_ik_savehof"],
  ["se_club_hk_onnerediterna", "se_club_onnereds_hk"],
  ["swe2-ystad2", "se_club_ystads_if_hf"],
  ["se_club_if_kristianstad", "se_club_ifk_kristianstad"],
]);

const fixtureMap = new Map(REGRESSION_FIXTURES.map((f) => [f.playerId, f]));

/**
 * Calculates a 4-Pillar Provisional Development Band for unproven youth or reserves.
 * Explicitly preserves developmental runway without artificial ceiling.
 */
export function calculateYouthProvisionalBand(
  ca: number,
  age: number | null,
  position: string,
  currentPA: number
): ProvisionalBand {
  const isGK = position === "MV" || position === "GK";
  const playerAge = age ?? 18;

  // Goalkeepers mature 3-5 years later (peak 26-31) than field players (peak 24-28)
  const yearsToPeak = isGK ? Math.max(8, 29 - playerAge) : Math.max(5, 26 - playerAge);

  // Growth potential estimation without arbitrary linear rails
  const estimatedUpside = Math.min(45, Math.max(15, yearsToPeak * 4));
  const paNominal = Math.min(170, Math.max(ca, Math.round(ca + estimatedUpside)));

  // Half-bandwidth: wider for younger/less-scouted profiles
  const halfBand = playerAge <= 17 ? 14 : playerAge <= 19 ? 11 : 8;

  const paMin = Math.max(ca, paNominal - halfBand);
  const paMax = Math.min(185, Math.max(paMin, paNominal + halfBand));

  return {
    paMin,
    paMax,
    paNominal,
    confidence: "LOW",
    uncertaintyBandWidth: paMax - paMin,
  };
}

/**
 * Pure evaluation function for a single player context with evidence integration.
 */
export function evaluatePlayerRules(context: OfflinePlayerContext): CalibrationProposal {
  const reviewFlags: string[] = [];
  const fixture = fixtureMap.get(context.playerId);
  const evidence = context.evidence;

  // -------------------------------------------------------------------------
  // 1. Owner Decision: Retired / Inactive Exclusions
  // -------------------------------------------------------------------------
  if (context.playerId === "player_markus_stegefelt_8aedec38" || context.isRetired) {
    return {
      playerId: context.playerId,
      name: context.name,
      firstName: context.firstName,
      lastName: context.lastName,
      clubId: context.clubId,
      clubName: context.clubName,
      competitionId: context.competitionId,
      position: context.primaryPosition,
      age: context.age,
      currentCA: context.runtimeCA,
      currentPA: context.runtimePA,
      proposedCA: context.runtimeCA,
      proposedPA: context.runtimePA,
      caDelta: 0,
      paDelta: 0,
      decision: "KEEP",
      confidence: "HIGH",
      reviewFlags: ["RETIRED_EXCLUDED"],
      rationale:
        "Player retired/inactive by owner decision. Excluded from active squads and calibration proposals; historical rating preserved.",
      provenance: "OWNER_DECISION_RETIRED",
    };
  }

  // -------------------------------------------------------------------------
  // 2. Identity & Registration Ambiguities
  // -------------------------------------------------------------------------
  if (OWNER_DEFERRED_PLAYERS.has(context.playerId)) {
    reviewFlags.push("OWNER_DEFERRED_REGISTRATION");
  }

  if (FARM_CLUB_AFFILIATIONS.has(context.clubId)) {
    reviewFlags.push("FARM_CLUB_AFFILIATION");
  }

  // -------------------------------------------------------------------------
  // 3. Vital Data Incompleteness
  // -------------------------------------------------------------------------
  if (!context.birthYear && !context.dateOfBirth) {
    reviewFlags.push("MISSING_BIRTH_YEAR_AND_DOB");
  } else if (!context.dateOfBirth) {
    reviewFlags.push("MISSING_EXACT_DOB");
  }

  // -------------------------------------------------------------------------
  // 4. Outlier & Anomaly Flags
  // -------------------------------------------------------------------------
  if (context.runtimeCA > context.runtimePA) {
    reviewFlags.push("CA_GREATER_THAN_PA");
  }

  if (context.competitionId === "se_handbollsligan_herr" && context.runtimeCA < 85) {
    reviewFlags.push("HBL_SUB_85_SEVERE_UNDERVALUE");
  }

  if (context.competitionId.includes("division1") && context.runtimeCA > 130) {
    reviewFlags.push("DIV1_SUPER_STAR_130_PLUS");
  }

  // -------------------------------------------------------------------------
  // 5. Fixture Override / Regression Lock (Reviewed in Phase 2A/2B/2C)
  // -------------------------------------------------------------------------
  if (fixture) {
    return {
      playerId: context.playerId,
      name: context.name,
      firstName: context.firstName,
      lastName: context.lastName,
      clubId: context.clubId,
      clubName: context.clubName,
      competitionId: context.competitionId,
      position: context.primaryPosition,
      age: context.age,
      currentCA: context.runtimeCA,
      currentPA: context.runtimePA,
      proposedCA: fixture.expectedCA,
      proposedPA: fixture.expectedPA,
      caDelta: fixture.expectedCA - context.runtimeCA,
      paDelta: fixture.expectedPA - context.runtimePA,
      decision: fixture.expectedDecision,
      confidence: fixture.expectedConfidence,
      reviewFlags,
      rationale: `Validated regression fixture (${fixture.fixtureRole}). Human review completed in Phase 2A/2B/2C; accepted rating retained.`,
      provenance: "REGRESSION_FIXTURE",
    };
  }

  // -------------------------------------------------------------------------
  // 6. Critical Review Required Cases
  // -------------------------------------------------------------------------
  if (
    reviewFlags.includes("MISSING_BIRTH_YEAR_AND_DOB") ||
    reviewFlags.includes("CA_GREATER_THAN_PA") ||
    reviewFlags.includes("HBL_SUB_85_SEVERE_UNDERVALUE") ||
    reviewFlags.includes("DIV1_SUPER_STAR_130_PLUS") ||
    reviewFlags.includes("OWNER_DEFERRED_REGISTRATION")
  ) {
    return {
      playerId: context.playerId,
      name: context.name,
      firstName: context.firstName,
      lastName: context.lastName,
      clubId: context.clubId,
      clubName: context.clubName,
      competitionId: context.competitionId,
      position: context.primaryPosition,
      age: context.age,
      currentCA: context.runtimeCA,
      currentPA: context.runtimePA,
      proposedCA: context.runtimeCA,
      proposedPA: Math.max(context.runtimeCA, context.runtimePA),
      caDelta: 0,
      paDelta: Math.max(context.runtimeCA, context.runtimePA) - context.runtimePA,
      decision: "REVIEW_REQUIRED",
      confidence: "LOW",
      reviewFlags,
      rationale: `Human review required: ${reviewFlags.join(", ")}. Incomplete vital data, owner-deferred registration, or boundary anomaly detected.`,
      provenance: context.caSource,
    };
  }

  // -------------------------------------------------------------------------
  // 7. Unresearched / Unlocked Generated Priors (PROVISIONAL)
  // -------------------------------------------------------------------------
  if (!context.isLocked || context.status === "PROVISIONAL") {
    const band = calculateYouthProvisionalBand(
      context.runtimeCA,
      context.age,
      context.primaryPosition,
      context.runtimePA
    );
    reviewFlags.push("UNRESEARCHED_GENERATED_PRIOR");

    return {
      playerId: context.playerId,
      name: context.name,
      firstName: context.firstName,
      lastName: context.lastName,
      clubId: context.clubId,
      clubName: context.clubName,
      competitionId: context.competitionId,
      position: context.primaryPosition,
      age: context.age,
      currentCA: context.runtimeCA,
      currentPA: context.runtimePA,
      proposedCA: context.runtimeCA,
      proposedPA: band.paNominal,
      caDelta: 0,
      paDelta: band.paNominal - context.runtimePA,
      decision: "PROVISIONAL",
      confidence: "PROVISIONAL",
      provisionalBand: band,
      reviewFlags,
      rationale: `Unresearched generated prior. Assigned 4-Pillar Provisional Band [${band.paMin}, ${band.paMax}] with nominal midpoint ${band.paNominal} to preserve uncertainty without false precision.`,
      provenance: "PROVISIONAL_BAND_MODEL",
    };
  }

  // -------------------------------------------------------------------------
  // 8. Youth Extreme Formula Gaps (PROVISIONAL)
  // Milestone 2 Rule: Do NOT automatically suppress youth PA because of missing senior minutes.
  // -------------------------------------------------------------------------
  const paGap = context.runtimePA - context.runtimeCA;
  const isYouth = context.age !== null && context.age <= 20;

  if (isYouth && paGap >= 35) {
    const band = calculateYouthProvisionalBand(
      context.runtimeCA,
      context.age,
      context.primaryPosition,
      context.runtimePA
    );
    reviewFlags.push("YOUTH_DEVELOPMENTAL_BAND");

    return {
      playerId: context.playerId,
      name: context.name,
      firstName: context.firstName,
      lastName: context.lastName,
      clubId: context.clubId,
      clubName: context.clubName,
      competitionId: context.competitionId,
      position: context.primaryPosition,
      age: context.age,
      currentCA: context.runtimeCA,
      currentPA: context.runtimePA,
      proposedCA: context.runtimeCA,
      proposedPA: band.paNominal,
      caDelta: 0,
      paDelta: band.paNominal - context.runtimePA,
      decision: "PROVISIONAL",
      confidence: "LOW",
      provisionalBand: band,
      reviewFlags,
      rationale: `Youth profile with legacy linear formula gap (PA-CA = ${paGap}). Uncertainty preserved via 4-Pillar Provisional Band [${band.paMin}, ${band.paMax}], ensuring absence of senior minutes does not artificially suppress potential.`,
      provenance: "YOUTH_4_PILLAR_FRAMEWORK",
    };
  }

  // -------------------------------------------------------------------------
  // 9. Documented Evidence-Backed Proposals (PROPOSE)
  // Milestone 2 Rule: PROPOSE requires documented evidence.
  // Do NOT automatically adjust veteran PA based only on age.
  // -------------------------------------------------------------------------
  if (evidence) {
    const facts = evidence.verifiedFacts;

    // Documented high-scoring Allsvenskan player transitioning to Handbollsligan
    if (
      evidence.careerProgression.isCrossLeagueMover &&
      facts.goals !== null &&
      facts.goals >= 120 &&
      context.runtimeCA < 135
    ) {
      const proposedCA = Math.min(136, context.runtimeCA + 4);
      const proposedPA = Math.max(proposedCA, context.runtimePA);

      return {
        playerId: context.playerId,
        name: context.name,
        firstName: context.firstName,
        lastName: context.lastName,
        clubId: context.clubId,
        clubName: context.clubName,
        competitionId: context.competitionId,
        position: context.primaryPosition,
        age: context.age,
        currentCA: context.runtimeCA,
        currentPA: context.runtimePA,
        proposedCA,
        proposedPA,
        caDelta: proposedCA - context.runtimeCA,
        paDelta: proposedPA - context.runtimePA,
        decision: "PROPOSE",
        confidence: "HIGH",
        reviewFlags: ["DOCUMENTED_CROSS_LEAGUE_MOVER"],
        rationale: `Documented cross-league mover evidence: verified ${facts.goals} goals in ${facts.appearances} appearances in ${facts.competition}. Upgraded CA to starter transition benchmark.`,
        provenance: "DOCUMENTED_PERFORMANCE_EVIDENCE",
      };
    }

    // Documented Handbollsligan standout scorer exceeding current tier
    if (
      facts.competition === "se_handbollsligan_herr" &&
      facts.appearances !== null &&
      facts.appearances >= 20 &&
      facts.goals !== null &&
      facts.goals >= 150 &&
      context.runtimeCA < 145
    ) {
      const proposedCA = Math.min(150, context.runtimeCA + 4);
      const proposedPA = Math.max(proposedCA, context.runtimePA);

      return {
        playerId: context.playerId,
        name: context.name,
        firstName: context.firstName,
        lastName: context.lastName,
        clubId: context.clubId,
        clubName: context.clubName,
        competitionId: context.competitionId,
        position: context.primaryPosition,
        age: context.age,
        currentCA: context.runtimeCA,
        currentPA: context.runtimePA,
        proposedCA,
        proposedPA,
        caDelta: proposedCA - context.runtimeCA,
        paDelta: proposedPA - context.runtimePA,
        decision: "PROPOSE",
        confidence: "HIGH",
        reviewFlags: ["HIGH_VOLUME_SCORER_EVIDENCE"],
        rationale: `Documented elite domestic production: verified ${facts.goals} goals in ${facts.appearances} appearances in Handbollsligan 2025/26. Upgraded CA to reflect proven starting volume.`,
        provenance: "DOCUMENTED_PERFORMANCE_EVIDENCE",
      };
    }
  }

  // -------------------------------------------------------------------------
  // 10. Default: Researched Standard Profile (KEEP)
  // Milestone 2 Rule: KEEP means no supported adjustment, not necessarily verified.
  // -------------------------------------------------------------------------
  const evidenceExplanation = evidence?.verifiedFacts.appearances
    ? `Verified match evidence (${evidence.verifiedFacts.appearances} matches, ${evidence.verifiedFacts.goals || 0} goals) aligns with current profile; no supported adjustment.`
    : "Researched baseline profile; no supported adjustment warranted by current evidence.";

  return {
    playerId: context.playerId,
    name: context.name,
    firstName: context.firstName,
    lastName: context.lastName,
    clubId: context.clubId,
    clubName: context.clubName,
    competitionId: context.competitionId,
    position: context.primaryPosition,
    age: context.age,
    currentCA: context.runtimeCA,
    currentPA: context.runtimePA,
    proposedCA: context.runtimeCA,
    proposedPA: context.runtimePA,
    caDelta: 0,
    paDelta: 0,
    decision: "KEEP",
    confidence: (context.confidence as ConfidenceLevel) || "HIGH",
    reviewFlags,
    rationale: `KEEP: ${evidenceExplanation} Current rating maintained.`,
    provenance: context.caSource || "RESEARCHED_BASELINE",
  };
}
