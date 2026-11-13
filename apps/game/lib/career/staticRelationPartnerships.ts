// Club Identity C4: real-world club relations -> career agreements.
//
// Layer 1 (static, game-data `Club.relations`) says which teams are second
// teams, U teams or partner associations of which clubs, per season. Layer 2
// (this career's `clubPartnerships`) holds the agreements the cooperation rule
// reads. This module is the ONLY bridge between them, and it never changes
// the cooperation logic (competition/transition/cooperationEligibility.ts,
// locked L9) or the five canonical rows (PERMANENT_B_TEAM_PAIRS, MS §6.2):
//
// - It only ADDS rows (idempotent, same `bteam-<parent>-<child>` id pattern),
//   of the existing AFFILIATED_B_TEAM type the cooperation rule already caps.
// - New careers: rows start at career start. Existing careers (and any career
//   meeting a relation added by a later build): rows start at the NEXT season
//   start, so the season in progress -- including its own end-of-season
//   transition -- is never changed retroactively (D9).
// - A relation that ends in reality (`validTo`) ends the seeded row at the end
//   of that season: the row becomes a dated, non-permanent agreement that the
//   daily tick expires through the existing path. History is kept, never deleted.
// - Rows the seeder did not create (the five permanent rows, development
//   partnerships, loans) are never touched.
import { CLUBS, COOPERATION_RELATION_KINDS, getClub, type ClubRelation } from "../game-data";
import { PERMANENT_B_TEAM_PAIRS, type ClubPartnership } from "./clubPartnerships";
import type { CareerState } from "./types";

/** Evidence prefix that marks a row as seeded from a static relation (the only rows this module may later end). */
export const STATIC_RELATION_EVIDENCE_PREFIX = "Club Identity static relation:";

export interface StaticRelation extends ClubRelation { childClubId: string }

/** Every static cooperation relation in the club records, in CLUBS order. */
export function staticCooperationRelations(): StaticRelation[] {
  return CLUBS.flatMap((c) => (c.relations ?? []).filter((r) => COOPERATION_RELATION_KINDS.includes(r.relation)).map((r) => ({ ...r, childClubId: c.id })));
}

/**
 * Club Identity C4 (owner decision "the A-team always has priority, the B-team must
 * adapt"): the 11 Division 2 relations are active career agreements. The deadlock the
 * first C4 attempt found (a B-team promoted into, or left in, its parent's tier) is
 * resolved in the season transition by competition/transition/parentPriority.ts.
 */
export const DIVISION2_RELATION_AGREEMENTS_ENABLED = true;

/** The relations that become career agreements: none of the static set while the gate above is closed. */
export function careerAgreementRelations(): StaticRelation[] {
  return DIVISION2_RELATION_AGREEMENTS_ENABLED ? staticCooperationRelations() : [];
}

const PERMANENT_IDS = new Set(PERMANENT_B_TEAM_PAIRS.map((p) => `bteam-${p.clubAId}-${p.clubBId}`));

export function staticRelationPartnershipId(r: Pick<StaticRelation, "parentClubId" | "childClubId">): string {
  return `bteam-${r.parentClubId}-${r.childClubId}`;
}

const seasonStartYear = (seasonId: string) => Number(seasonId.slice(0, 4));
/** 1 July opens a Swedish season (cooperationEligibility.ts uses the same boundary). */
export const seasonStartDate = (seasonId: string) => `${seasonStartYear(seasonId)}-07-01`;
/** 30 June closes it. */
export const seasonEndDate = (seasonId: string) => `${seasonStartYear(seasonId) + 1}-06-30`;
export const nextSeasonStartDate = (seasonId: string) => `${seasonStartYear(seasonId) + 1}-07-01`;

export type SeedMode = "CAREER_START" | "NEXT_SEASON";

/**
 * Idempotent: adds the missing static-relation rows, never modifies an
 * existing row. `CAREER_START` (createNewCareerState) uses `careerStartDate`;
 * `NEXT_SEASON` (every load, via migrateCareerState) uses the start of the
 * season after `state.seasonId`.
 */
export function seedStaticRelationPartnerships(state: CareerState, mode: SeedMode, careerStartDate?: string, relations: readonly StaticRelation[] = careerAgreementRelations()): CareerState {
  const existing = state.clubPartnerships ?? {};
  const floor = mode === "CAREER_START" ? (careerStartDate ?? state.gameDate) : nextSeasonStartDate(state.seasonId);
  const added: Record<string, ClubPartnership> = {};
  for (const r of relations) {
    const id = staticRelationPartnershipId(r);
    if (PERMANENT_IDS.has(id) || existing[id] || added[id]) continue;
    if (!getClub(r.parentClubId) || !getClub(r.childClubId)) continue;
    const startDate = [floor, seasonStartDate(r.validFrom)].sort().at(-1)!;
    // A relation that has already ended before the row could start is history only: no agreement.
    if (r.validTo && seasonEndDate(r.validTo) < startDate) continue;
    added[id] = {
      id, type: "AFFILIATED_B_TEAM", clubAId: r.parentClubId, clubBId: r.childClubId, status: "ACTIVE",
      startDate, endDate: r.validTo ? seasonEndDate(r.validTo) : null, permanent: !r.validTo, monthlyCostEur: 0, lastBilledDate: null,
      competitionRestriction: { origin: "OFFICIAL_RECORD", evidence: `${STATIC_RELATION_EVIDENCE_PREFIX} ${r.relation} (${r.relationConfidence}) -- ${r.evidence}`, effectiveFrom: startDate, effectiveUntil: r.validTo ? seasonEndDate(r.validTo) : null, applyParentDivisionRule: true },
    };
  }
  return Object.keys(added).length ? { ...state, clubPartnerships: { ...existing, ...added } } : state;
}

/**
 * When the static data says a relation ended (`validTo`), the seeded row ends
 * at the close of that season: dated, non-permanent, still ACTIVE until the
 * daily tick expires it (progressPartnershipExpiry). Rows not seeded from a
 * static relation, and rows already ended, are never touched.
 */
export function reconcileStaticRelationPartnerships(state: CareerState, relations: readonly StaticRelation[] = careerAgreementRelations()): CareerState {
  const rows = state.clubPartnerships ?? {};
  let next: Record<string, ClubPartnership> | undefined;
  for (const r of relations) {
    if (!r.validTo) continue;
    const row = rows[staticRelationPartnershipId(r)];
    if (!row || !row.competitionRestriction?.evidence.startsWith(STATIC_RELATION_EVIDENCE_PREFIX) || row.status !== "ACTIVE" || row.endDate) continue;
    const endDate = [seasonEndDate(r.validTo), row.startDate].sort().at(-1)!;
    next ??= { ...rows };
    next[row.id] = { ...row, permanent: false, endDate, competitionRestriction: { ...row.competitionRestriction, effectiveUntil: endDate } };
  }
  return next ? { ...state, clubPartnerships: next } : state;
}
