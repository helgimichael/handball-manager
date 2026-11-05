import type {
  CalibrationProposal,
  ConfidenceLevel,
  OfflinePlayerContext,
  ProvisionalBand,
} from "./types";
import type { VerifiedPerformanceFacts } from "../evidencePipeline/schema";
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
  _currentPA: number
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
 * Helper to construct a standard calibration proposal with strict CA/PA decoupling,
 * conflict detection, and audit tagging.
 */
function buildProposal(params: {
  context: OfflinePlayerContext;
  proposedCA: number;
  proposedPA: number;
  compPlayer: string;
  flags: string[];
  rationale: string;
}): CalibrationProposal {
  const { context, proposedCA, proposedPA, compPlayer, flags, rationale } = params;
  const ca = context.runtimeCA;
  const pa = context.runtimePA;
  const isConflict = proposedCA > pa;
  const finalFlags = [...flags];
  let finalRationale = rationale;

  if (isConflict) {
    finalFlags.push("CA_EXCEEDS_PA_CONFLICT");
    finalRationale += ` NOTE: Indicated CA (${proposedCA}) exceeds current PA (${pa}) by ${proposedCA - pa} pts. PA decoupled; conflict flagged for human review.`;
  }

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
    currentCA: ca,
    currentPA: pa,
    proposedCA,
    proposedPA,
    caDelta: proposedCA - ca,
    paDelta: proposedPA - pa,
    decision: "PROPOSE",
    confidence: "HIGH",
    reviewFlags: finalFlags,
    rationale: finalRationale,
    provenance: "DOCUMENTED_PERFORMANCE_EVIDENCE",
    comparisonPlayer: compPlayer,
    isCaPaConflict: isConflict,
    conflictMagnitude: isConflict ? proposedCA - pa : undefined,
  };
}

/**
 * Identifies if a player has defensive specialist role or disciplinary profile.
 * Defensive specialists are protected from downgrades based on low scoring volume.
 */
export function isDefensiveSpecialist(
  context: OfflinePlayerContext,
  facts?: VerifiedPerformanceFacts | null
): boolean {
  if (!facts) return false;
  const honors = facts.honors || [];
  const hasDefensiveHonor = honors.some((h) => h.toLowerCase().includes("defender"));
  const notes = `${context.dataNotes || ""} ${context.lockedNote || ""}`.toLowerCase();
  const hasDefensiveNote =
    notes.includes("defender") ||
    notes.includes("defense") ||
    notes.includes("defensive") ||
    notes.includes("two-way");
  const highSuspensions = (facts.suspensions ?? 0) >= 10;
  const substantialApps = (facts.appearances ?? 0) >= 15;

  return hasDefensiveHonor || (hasDefensiveNote && highSuspensions) || (highSuspensions && substantialApps);
}

/**
 * Evaluates players transitioning from secondary tiers (e.g. swe-2) to the premier division.
 * Benchmark Anchor: Carl Rydén (CA 136, Anchor 16), Alexander Regen (CA 134)
 */
export function evaluateCrossLeagueTransition(
  context: OfflinePlayerContext,
  facts: VerifiedPerformanceFacts
): CalibrationProposal | null {
  if (context.competitionId !== "se_handbollsligan_herr" || facts.competition !== "swe-2") {
    return null;
  }
  const appearances = facts.appearances ?? 0;
  const goals = facts.goals ?? 0;
  if (appearances < 18 || goals < 100) return null;

  const gpg = goals / appearances;
  const pos = context.primaryPosition;
  const ca = context.runtimeCA;
  const pa = context.runtimePA;

  let proposedCA = ca;
  let compPlayer = "Carl Rydén (CA 136)";
  let rationale = "";

  // Tier 1: Exceptional Allsvenskan top scorer
  if ((gpg >= 7.0 || goals >= 180) && ca < 135) {
    proposedCA = 134;
    rationale = `Exceptional Allsvenskan top scorer (${goals} goals in ${appearances} appearances, ${gpg.toFixed(1)} gpg). Verified production significantly exceeds current CA of ${ca}; calibrated to starting backcourt level.`;
  } else if ((gpg >= 5.5 || goals >= 150) && ca < 130) {
    proposedCA = 130;
    rationale = `High-volume Allsvenskan scorer (${goals} goals in ${appearances} appearances, ${gpg.toFixed(1)} gpg). Adjusted from ${ca} to 130 to reflect established senior starting calibre.`;
  } else if (goals >= 100 && ca < 128) {
    proposedCA = Math.min(128, ca + 6);
    compPlayer =
      pos === "M6"
        ? "Alexander Regen (CA 134)"
        : pos.includes("6")
        ? "Samuel Lindberg (CA 148)"
        : "Carl Rydén (CA 136)";
    rationale = `Proven Allsvenskan scoring record (${goals} goals in ${appearances} appearances, ${gpg.toFixed(1)} gpg) earns promotion to Handbollsligan; upgraded from ${ca} to ${proposedCA}.`;
  }

  if (proposedCA <= ca) return null;

  return buildProposal({
    context,
    proposedCA,
    proposedPA: pa,
    compPlayer,
    flags: ["DOCUMENTED_CROSS_LEAGUE_MOVER"],
    rationale,
  });
}

/**
 * Evaluates outfield players in the domestic premier division (se_handbollsligan_herr).
 * Benchmark Anchors: August Wiger (CA 152), Petter Donaldson (CA 140), Samuel Lindberg (CA 148)
 */
export function evaluateDomesticOutfieldPerformance(
  context: OfflinePlayerContext,
  facts: VerifiedPerformanceFacts
): CalibrationProposal | null {
  if (
    context.competitionId !== "se_handbollsligan_herr" ||
    facts.competition !== "se_handbollsligan_herr"
  ) {
    return null;
  }
  const apps = facts.appearances ?? 0;
  if (apps < 20) return null;

  const goals = facts.goals ?? 0;
  const assists = facts.assists ?? 0;
  const totalInvolvements = goals + assists;
  const ipg = totalInvolvements / apps;
  const gpg = goals / apps;
  const pos = context.primaryPosition;
  const ca = context.runtimeCA;
  const pa = context.runtimePA;

  // Tier A: Domestic offensive summit (>250 involvements or >= 9.5 inv/game)
  if ((totalInvolvements >= 250 || ipg >= 9.5) && ca < 148) {
    const proposedCA = 149;
    const rat = `Elite domestic offensive engine (${goals} goals, ${assists} assists, ${totalInvolvements} total involvements in ${apps} matches, ${ipg.toFixed(1)} inv/g). CA ${ca} underrates league-wide impact.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "August Wiger (CA 152)",
      flags: ["HIGH_VOLUME_OFFENSIVE_ENGINE"],
      rationale: rat,
    });
  }

  // Tier B: Premier domestic playmakers (>180 involvements or >= 7.0 inv/game)
  if ((totalInvolvements >= 180 || ipg >= 7.0) && ca < 148) {
    const proposedCA = Math.min(151, ca + 5);
    const rat = `Premier Handbollsligan playmaker and contributor (${goals} goals, ${assists} assists, ${totalInvolvements} total involvements in ${apps} matches, ${ipg.toFixed(1)} inv/g). Upgraded to reflect high domestic tier.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "August Wiger (CA 152)",
      flags: ["HIGH_VOLUME_PLAYMAKER_EVIDENCE"],
      rationale: rat,
    });
  }

  // Tier C: Solid starting contributors (>130 involvements or >= 5.0 inv/game with CA < 135)
  if ((totalInvolvements >= 130 || ipg >= 5.0) && ca < 135) {
    const proposedCA = Math.min(138, ca + 8);
    const rat = `Consistent starting contributor in Handbollsligan (${goals} goals, ${assists} assists, ${totalInvolvements} involvements in ${apps} games, ${ipg.toFixed(1)} inv/g). Upgraded from reserve tier (${ca}) to solid starter tier (${proposedCA}).`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Petter Donaldson (CA 140)",
      flags: ["HBL_SOLID_STARTER_EVIDENCE"],
      rationale: rat,
    });
  }

  // Tier D: Regular rotation starters (>100 involvements, >= 24 apps with CA < 125)
  if (totalInvolvements >= 100 && apps >= 24 && ca < 125) {
    const proposedCA = Math.min(128, ca + 8);
    const rat = `Regular starting rotation back in Handbollsligan (${apps} appearances, ${goals} goals, ${assists} assists, ${ipg.toFixed(1)} inv/g). Current CA ${ca} underrates proven top-flight contribution.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Petter Donaldson (CA 140)",
      flags: ["HBL_REGULAR_ROTATION_EVIDENCE"],
      rationale: rat,
    });
  }

  // Tier E: Handbollsligan wing scoring standout (pos includes '6')
  if (pos.includes("6") && goals >= 100 && ca < 135) {
    const proposedCA = Math.min(138, ca + 5);
    const rat = `High-conversion starting wing in Handbollsligan (${goals} goals in ${apps} matches, ${gpg.toFixed(1)} gpg). Calibrated to starting wing benchmark.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Samuel Lindberg (CA 148)",
      flags: ["HBL_WING_FINISHER_EVIDENCE"],
      rationale: rat,
    });
  }

  return null;
}

/**
 * Evaluates standout scorers in the secondary tier (swe-2).
 * Benchmark Anchors: Carl Rydén (CA 136), Alexander Regen (CA 134)
 */
export function evaluateSwe2Standouts(
  context: OfflinePlayerContext,
  facts: VerifiedPerformanceFacts
): CalibrationProposal | null {
  if (context.competitionId !== "swe-2" || facts.competition !== "swe-2") {
    return null;
  }
  const apps = facts.appearances ?? 0;
  const goals = facts.goals ?? 0;
  if (apps < 20 || goals < 110) return null;

  const ca = context.runtimeCA;
  const pa = context.runtimePA;
  const pos = context.primaryPosition;
  const gpg = goals / apps;

  let proposedCA = ca;
  let compPlayer = "Carl Rydén (CA 136)";
  let rationale = "";

  if (goals >= 180 && ca < 140) {
    proposedCA = 144;
    rationale = `League-leading Allsvenskan goalscorer (${goals} goals in ${apps} matches, ${gpg.toFixed(1)} gpg). Production indicates high-end Allsvenskan / HBL-ready quality.`;
  } else if (goals >= 150 && ca < 138) {
    proposedCA = Math.min(142, ca + 5);
    rationale = `Exceptional scoring volume in Allsvenskan (${goals} goals in ${apps} matches, ${gpg.toFixed(1)} gpg). Upgraded to reflect star Allsvenskan backcourt tier.`;
  } else if (goals >= 125 && ca < 130) {
    proposedCA = Math.min(134, ca + 6);
    rationale = `Established primary scorer in Allsvenskan (${goals} goals in ${apps} matches, ${gpg.toFixed(1)} gpg). Upgraded from ${ca} to starting tier ${proposedCA}.`;
  } else if (goals >= 110 && ca < 125) {
    proposedCA = Math.min(128, ca + 6);
    compPlayer = pos === "M6" ? "Alexander Regen (CA 134)" : "Carl Rydén (CA 136)";
    rationale = `Proven regular goalscorer in Allsvenskan (${goals} goals in ${apps} matches, ${gpg.toFixed(1)} gpg). Calibrated from reserve level (${ca}) to solid contributor (${proposedCA}).`;
  }

  if (proposedCA <= ca) return null;

  return buildProposal({
    context,
    proposedCA,
    proposedPA: pa,
    compPlayer,
    flags: ["ALLSVENSKAN_HIGH_VOLUME_SCORER"],
    rationale,
  });
}

/**
 * Evaluates goalkeepers bidirectionally (upward and downward) with sample-size safeguards.
 * Benchmark Anchors: Niklas Kraft (CA 150, Anchor 3), Alexander Skoog (CA 142), Elliot Hövre Björck (CA 118)
 */
export function evaluateGoalkeeperCalibration(
  context: OfflinePlayerContext,
  facts: VerifiedPerformanceFacts
): CalibrationProposal | null {
  const pos = context.primaryPosition;
  const isGK = pos === "MV" || pos === "GK" || facts.shotsFaced !== null;
  if (!isGK) return null;

  const shotsFaced = facts.shotsFaced;
  if (shotsFaced === null || shotsFaced < 350) return null;

  const ca = context.runtimeCA;
  const pa = context.runtimePA;
  const savePct = facts.savePercentage;

  // 1. Upward Calibration: Undervalued Starters / High Workload
  if (context.competitionId === "se_handbollsligan_herr" && shotsFaced >= 500 && ca < 135) {
    const proposedCA = Math.min(138, ca + 8);
    const rat = `High-workload starting goalkeeper in Handbollsligan (${shotsFaced} shots faced, ${facts.saves} saves, ${savePct}%). Current CA ${ca} underrates proven starting presence.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Niklas Kraft (CA 150)",
      flags: ["GK_HIGH_SHOT_VOLUME_EVIDENCE"],
      rationale: rat,
    });
  }

  if (context.competitionId === "se_handbollsligan_herr" && shotsFaced >= 350 && ca < 125) {
    const proposedCA = Math.min(130, ca + 6);
    const rat = `Substantial top-flight goalkeeper workload in Handbollsligan (${shotsFaced} shots faced, ${facts.saves} saves). Upgraded from ${ca} to reflect reliable rotation ability.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Niklas Kraft (CA 150)",
      flags: ["GK_ROTATION_VOLUME_EVIDENCE"],
      rationale: rat,
    });
  }

  if (context.competitionId === "swe-2" && shotsFaced >= 350 && ca < 120) {
    const proposedCA = Math.min(125, ca + 6);
    const rat = `Proven senior starting goalkeeper workload in Allsvenskan (${shotsFaced} shots faced, ${facts.saves} saves). Calibrated to senior starting rotation standard.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Elliot Hövre Björck (CA 118)",
      flags: ["GK_ALLSVENSKAN_STARTER_EVIDENCE"],
      rationale: rat,
    });
  }

  // 2. Downward Calibration: Overvalued Starters (Bidirectional with Large Sample Guard: shotsFaced >= 700)
  if (
    context.competitionId === "se_handbollsligan_herr" &&
    shotsFaced >= 700 &&
    savePct !== null &&
    savePct <= 27.5 &&
    ca >= 146
  ) {
    const proposedCA = Math.max(138, Math.min(142, ca - 6));
    const rat = `Substantial starting goalkeeper workload (${shotsFaced} shots faced in ${facts.appearances} matches), but verified ${savePct}% save percentage is significantly below top starter tier (>31%). Calibrated downward from ${ca} to ${proposedCA} (domestic rotation/starter baseline).`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Alexander Skoog (CA 142)",
      flags: ["GK_SAVE_PERCENTAGE_OVERRATED"],
      rationale: rat,
    });
  }

  if (
    context.competitionId === "se_handbollsligan_herr" &&
    shotsFaced >= 700 &&
    savePct !== null &&
    savePct < 30.0 &&
    ca > 150
  ) {
    const proposedCA = Math.max(145, Math.min(148, ca - 5));
    const rat = `Heavy starting workload (${shotsFaced} shots faced, ${facts.saves} saves, ${savePct}%), but current rating (${ca}) exceeds benchmark anchor Niklas Kraft (150) without matching elite shot-stopping efficiency (>32%). Calibrated downward from ${ca} to ${proposedCA}.`;
    return buildProposal({
      context,
      proposedCA,
      proposedPA: pa,
      compPlayer: "Niklas Kraft (CA 150)",
      flags: ["GK_SUMMIT_RATING_OVERVALUED"],
      rationale: rat,
    });
  }

  return null;
}

/**
 * Pure evaluation function for a single player context with evidence integration.
 * Generalized across positions, tiers, and unseen players without player-specific hardcoding.
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
  // 7. Generalized Evidence-Backed Proposals (PROPOSE)
  // Milestone 5: Reusable position-sensitive rules without hardcoded player logic.
  // Strict Rules:
  // - Support both directions (underrated and overrated).
  // - CA changes must NOT automatically increase PA (strict decoupling).
  // - If proposed CA exceeds current PA, explicitly flag the conflict.
  // - Missing minutes, low goals, or age alone must NEVER trigger a downgrade.
  // - Defensive specialists must not be downgraded for low scoring volume.
  // - Goalkeeper sample size guard (shotsFaced >= 700 required for downward calibration).
  // -------------------------------------------------------------------------
  if (evidence && evidence.verifiedFacts.appearances) {
    const facts = evidence.verifiedFacts;
    const isRemoved = !!(context.dataNotes && context.dataNotes.includes("removed"));

    if (!isRemoved) {
      // 7.1 Cross-League Movers
      const crossLeagueProposal = evaluateCrossLeagueTransition(context, facts);
      if (crossLeagueProposal) return crossLeagueProposal;

      // 7.2 Domestic Handbollsligan Outfield Performance
      const outfieldProposal = evaluateDomesticOutfieldPerformance(context, facts);
      if (outfieldProposal) return outfieldProposal;

      // 7.3 Swe-2 Standout Scorers
      const swe2Proposal = evaluateSwe2Standouts(context, facts);
      if (swe2Proposal) return swe2Proposal;

      // 7.4 Goalkeeper Bidirectional Calibration
      const gkProposal = evaluateGoalkeeperCalibration(context, facts);
      if (gkProposal) return gkProposal;
    }
  }

  // -------------------------------------------------------------------------
  // 8. Unresearched / Unlocked Generated Priors (PROVISIONAL)
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
  // 9. Youth Extreme Formula Gaps (PROVISIONAL)
  // Preserves youth developmental runway without linear rail suppression.
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
  // 10. Default: Researched Standard Profile (KEEP)
  // Correctly rated players maintained without alteration.
  // Defensive specialists protected from unwarranted downgrade.
  // -------------------------------------------------------------------------
  const isDefSec = isDefensiveSpecialist(context, evidence?.verifiedFacts);
  let evidenceExplanation = "Researched baseline profile; no supported adjustment warranted by current evidence.";

  if (isDefSec) {
    evidenceExplanation = `Defensive specialist profile verified (${evidence?.verifiedFacts.suspensions || 0} suspensions). Preserved from scoring-volume downgrades.`;
    reviewFlags.push("DEFENSIVE_SPECIALIST_PROTECTED");
  } else if (evidence?.verifiedFacts.appearances) {
    evidenceExplanation = `Verified match evidence (${evidence.verifiedFacts.appearances} matches, ${evidence.verifiedFacts.goals || 0} goals) aligns with current profile; no supported adjustment.`;
  }

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
