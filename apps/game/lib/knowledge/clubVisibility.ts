// HM-DATA-ALLSVENSKAN-1.1B Part 13: TRUE WORLD STATE (a real
// ClubIdentityProfile/CoachIdentityProfile) -> MANAGER KNOWLEDGE
// (knowledgePct) -> PLAYER-FACING VIEW (ClubVisibleView). Pure,
// client-safe -- never mutates or reads back into the canonical profile.
//
// Public/floor-level facts (club name, city, arena, live table position,
// fixtures/results, squad player names) are NEVER gated here -- they
// already come from game-data/CareerState directly and stay visible
// regardless of ClubKnowledge, matching this milestone's own spec
// ("vid låg familiarity kan man känna till: offentlig grundinfo, tabell,
// arena, truppnamn, resultat"). This resolver only gates the DEEPER
// qualitative signals: tactical heritage, coach philosophy, internal
// strengths/weaknesses, financial-strategic identity, and similar.
import { CLUB_IDENTITY_CLAIM_FIELDS, COACH_IDENTITY_CLAIM_FIELDS, type ClubIdentityProfile, type CoachIdentityProfile, type IdentityClaim } from "../identity/types";
import { knowledgeTier, type KnowledgeTier } from "./types";

/** Total claims revealed across the WHOLE club+coach profile at each tier -- deliberately a shared budget, not a fixed count per domain, so a club with few claims in one domain doesn't waste "slots" there. MINIMAL sees nothing beyond the always-public facts; HIGH sees everything (the same full reveal today's own-club/fully-scouted view already gets). */
const CLAIM_BUDGET_BY_TIER: Record<KnowledgeTier, number> = {
  MINIMAL: 0,
  LOW: 3,
  MEDIUM: 8,
  HIGH: Number.POSITIVE_INFINITY,
};

/** Coach philosophy is explicitly "djupare information" -- never shown before MEDIUM, even if the shared claim budget would technically allow it at LOW. */
const COACH_CLAIMS_MIN_TIER: KnowledgeTier = "MEDIUM";
const TIER_ORDER: Record<KnowledgeTier, number> = { MINIMAL: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

export type ClubIdentityVisible = Pick<ClubIdentityProfile, "clubId" | "seasonReference" | (typeof CLUB_IDENTITY_CLAIM_FIELDS)[number]>;
export type CoachIdentityVisible = Pick<CoachIdentityProfile, "personId" | (typeof COACH_IDENTITY_CLAIM_FIELDS)[number]>;

export interface ClubVisibleView {
  tier: KnowledgeTier;
  clubIdentity: ClubIdentityVisible | null;
  coachIdentity: CoachIdentityVisible | null;
  /** How many real claims exist but are not shown at this knowledge level -- lets the UI honestly say "X till, kräver bättre kännedom" instead of silently looking sparse. */
  hiddenClubClaimCount: number;
  hiddenCoachClaimCount: number;
}

function takeClaimsWithinBudget(fields: readonly string[], profile: Record<string, IdentityClaim[]>, budgetRemaining: { value: number }): { visible: Record<string, IdentityClaim[]>; hiddenCount: number } {
  const visible: Record<string, IdentityClaim[]> = {};
  let hiddenCount = 0;
  for (const field of fields) {
    const claims = profile[field] ?? [];
    const take = Math.max(0, Math.min(claims.length, budgetRemaining.value));
    visible[field] = claims.slice(0, take);
    hiddenCount += claims.length - take;
    budgetRemaining.value -= take;
  }
  return { visible, hiddenCount };
}

/**
 * Resolves what the manager should actually see of a club's (and its
 * current coach's) identity, given ClubKnowledge. `clubIdentity`/
 * `coachIdentity` inputs are `null` when no real data was ever imported
 * for this club/coach (an honest absence, unrelated to knowledge) --
 * the resolver passes that through unchanged; knowledge only redacts
 * real data that DOES exist, never fabricates data that doesn't.
 */
export function resolveClubVisibility(clubIdentity: ClubIdentityProfile | null, coachIdentity: CoachIdentityProfile | null, knowledgePct: number): ClubVisibleView {
  const tier = knowledgeTier(knowledgePct);
  // Club and coach each get their OWN claim budget at this tier -- they are
  // independent knowledge domains (you can know a club's tactical heritage
  // without having profiled its current coach's philosophy at all), so one
  // must never starve the other by sharing a single counter.
  const clubBudget = { value: CLAIM_BUDGET_BY_TIER[tier] };
  const coachBudget = { value: CLAIM_BUDGET_BY_TIER[tier] };

  let visibleClubIdentity: ClubIdentityVisible | null = null;
  let hiddenClubClaimCount = 0;
  if (clubIdentity) {
    const { visible, hiddenCount } = takeClaimsWithinBudget(CLUB_IDENTITY_CLAIM_FIELDS, clubIdentity as unknown as Record<string, IdentityClaim[]>, clubBudget);
    visibleClubIdentity = { clubId: clubIdentity.clubId, seasonReference: clubIdentity.seasonReference, ...visible } as unknown as ClubIdentityVisible;
    hiddenClubClaimCount = hiddenCount;
  }

  let visibleCoachIdentity: CoachIdentityVisible | null = null;
  let hiddenCoachClaimCount = 0;
  if (coachIdentity) {
    const coachTotalClaims = COACH_IDENTITY_CLAIM_FIELDS.reduce((sum, field) => sum + coachIdentity[field].length, 0);
    if (TIER_ORDER[tier] < TIER_ORDER[COACH_CLAIMS_MIN_TIER]) {
      visibleCoachIdentity = { personId: coachIdentity.personId, ...Object.fromEntries(COACH_IDENTITY_CLAIM_FIELDS.map((f) => [f, []])) } as unknown as CoachIdentityVisible;
      hiddenCoachClaimCount = coachTotalClaims;
    } else {
      const { visible, hiddenCount } = takeClaimsWithinBudget(COACH_IDENTITY_CLAIM_FIELDS, coachIdentity as unknown as Record<string, IdentityClaim[]>, coachBudget);
      visibleCoachIdentity = { personId: coachIdentity.personId, ...visible } as unknown as CoachIdentityVisible;
      hiddenCoachClaimCount = hiddenCount;
    }
  }

  return { tier, clubIdentity: visibleClubIdentity, coachIdentity: visibleCoachIdentity, hiddenClubClaimCount, hiddenCoachClaimCount };
}
