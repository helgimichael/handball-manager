// Club Identity C1: the canonical identity resolvers (MIGRATION-STRATEGY §1).
//
// The storage id (`Club.id`) is the only key -- in saves, in the Club
// Identity Registry and in tools. Names are never keys. Every resolver here is
// pure, deterministic and reads only the static club records.
//
// Career-dependent questions (which league is this club in, in THIS career and
// THIS season) are answered by career/competitionMembership.ts, which uses
// `realWorldCompetitionForSeason` below as one of its inputs.
import { CLUBS, getClub } from "./clubs";
import { getCompetition } from "./competitions";
import type { Club, ClubRelation, ClubRelationKind, NationCode, SeasonLabel } from "./types";

/** Lower-cased, accent-folded, whitespace-collapsed comparison key for name matching. */
export function clubNameKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const BY_CANONICAL_ID: ReadonlyMap<string, string> = new Map(CLUBS.map((c) => [c.canonicalId ?? c.id, c.id]));

/**
 * Storage id for an id or canonical id, or undefined. Never matches names:
 * a display name is not an identity (use `findClubsByName` for search).
 */
export function resolveClubId(idOrCanonicalId: string): string | undefined {
  if (getClub(idOrCanonicalId)) return idOrCanonicalId;
  return BY_CANONICAL_ID.get(idOrCanonicalId);
}

export function canonicalClubId(clubId: string): string | undefined {
  const club = getClub(clubId);
  return club ? (club.canonicalId ?? club.id) : undefined;
}

export function isRetiredClub(clubId: string): boolean {
  return getClub(clubId)?.status === "retired";
}

/** Nation of the club's federation (from its legacy-baseline competition; clubs never change federation). */
export function clubNation(clubId: string): NationCode | undefined {
  const club = getClub(clubId);
  return club ? getCompetition(club.competitionId)?.nation : undefined;
}

export function isSwedishClub(clubId: string): boolean {
  return clubNation(clubId) === "SWE";
}

function seasonWithin(seasonId: SeasonLabel, from?: SeasonLabel, to?: SeasonLabel): boolean {
  return (!from || seasonId >= from) && (!to || seasonId <= to);
}

/**
 * The club's name as it was in `seasonId` (T8). Without a season, or when no
 * historical name covers the season, the current name. History views pass the
 * archived season; every other surface omits it.
 */
export function clubDisplayName(clubId: string, seasonId?: SeasonLabel): string {
  const club = getClub(clubId);
  if (!club) return clubId;
  if (seasonId) {
    const past = club.historicalNames?.find((h) => (h.validFrom || h.validTo) && seasonWithin(seasonId, h.validFrom, h.validTo));
    if (past) return past.name;
  }
  return club.name;
}

export function clubDisplayShortName(clubId: string, seasonId?: SeasonLabel): string {
  const club = getClub(clubId);
  if (!club) return clubId;
  if (seasonId) {
    const past = club.historicalNames?.find((h) => (h.validFrom || h.validTo) && seasonWithin(seasonId, h.validFrom, h.validTo));
    if (past) return past.shortName ?? past.name;
  }
  return club.shortName;
}

/**
 * Every club whose current name, short name, alias or historical name equals
 * `name` (accent- and case-insensitive), in CLUBS order. An exact current name
 * match ranks first. Never fuzzy: "Tumba HK" does not match "IFK Tumba HK".
 */
export function findClubsByName(name: string): Club[] {
  const key = clubNameKey(name);
  if (!key) return [];
  const exact = CLUBS.filter((c) => clubNameKey(c.name) === key);
  const other = CLUBS.filter((c) => !exact.includes(c) && [c.shortName, ...(c.aliases ?? []), ...(c.historicalNames ?? []).flatMap((h) => [h.name, h.shortName ?? ""])]
    .some((n) => n && clubNameKey(n) === key));
  return [...exact, ...other];
}

/** The single club a name identifies, or undefined when it is unknown OR ambiguous (never a silent wrong pick). */
export function resolveClubByName(name: string): Club | undefined {
  const exact = CLUBS.filter((c) => clubNameKey(c.name) === clubNameKey(name));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const all = findClubsByName(name);
  return all.length === 1 ? all[0] : undefined;
}

/** The real-world relation valid in `seasonId` (default: the current one), or undefined for an independent club. */
export function clubRelationForSeason(clubId: string, seasonId?: SeasonLabel, kinds?: readonly ClubRelationKind[]): ClubRelation | undefined {
  const relations = getClub(clubId)?.relations ?? [];
  return relations.find((r) => (!kinds || kinds.includes(r.relation)) && (seasonId ? seasonWithin(seasonId, r.validFrom, r.validTo) : !r.validTo));
}

/** The parent club of a second/U/academy team (YOUTH_LINK is informational and never a parent). */
export function parentClubOf(clubId: string, seasonId?: SeasonLabel): string | undefined {
  const r = clubRelationForSeason(clubId, seasonId);
  return r && r.relation !== "YOUTH_LINK" ? r.parentClubId : undefined;
}

export type ClubTeamType = "FIRST_TEAM" | "SECOND_TEAM" | "U_TEAM" | "ACADEMY" | "PARTNER_ASSOCIATION";

export function clubTeamType(clubId: string, seasonId?: SeasonLabel): ClubTeamType {
  const r = clubRelationForSeason(clubId, seasonId);
  switch (r?.relation) {
    case "SECOND_TEAM": case "SAME_CLUB_SECOND_TEAM": case "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION": return "SECOND_TEAM";
    case "U_TEAM": case "U_TEAM_UNDER_PARTNER_LICENCE": return "U_TEAM";
    case "ACADEMY": return "ACADEMY";
    case "PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS": return "PARTNER_ASSOCIATION";
    default: return "FIRST_TEAM";
  }
}

/**
 * The club's REAL-WORLD league in `seasonId` from its append-only history,
 * carrying the last known season forward. Undefined when the record is a
 * tombstone past `validTo`, or when the history starts after `seasonId`.
 * Without history, the frozen legacy `competitionId`.
 */
export function realWorldCompetitionForSeason(club: Club, seasonId: SeasonLabel): string | undefined {
  if (club.validTo && seasonId > club.validTo) return undefined;
  const history = club.competitionHistory;
  if (!history?.length) return club.competitionId;
  const hit = history.find((h) => seasonWithin(seasonId, h.validFrom, h.validTo));
  if (hit) return hit.competitionId;
  const known = [...history].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const last = known[known.length - 1]!;
  if (seasonId > last.validFrom) return last.competitionId; // carried forward
  return seasonId < known[0]!.validFrom ? (club.addedInWorld ? undefined : club.competitionId) : club.competitionId;
}

/** Club Identity C4: relation kinds that are a cooperation in SHF terms (second teams, U teams, partner associations). ACADEMY (foreign) and YOUTH_LINK (informational) never are. */
export const COOPERATION_RELATION_KINDS: readonly ClubRelationKind[] = [
  "SECOND_TEAM", "SAME_CLUB_SECOND_TEAM", "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", "U_TEAM", "U_TEAM_UNDER_PARTNER_LICENCE", "PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS",
];

/** True when `clubId` is (or, per the static data, will be) a cooperation team of another club in `seasonId` (any season when omitted). */
export function hasStaticCooperationRelation(clubId: string, seasonId?: SeasonLabel): boolean {
  return (getClub(clubId)?.relations ?? []).some((r) => COOPERATION_RELATION_KINDS.includes(r.relation) && (!r.validTo || !seasonId || r.validTo >= seasonId));
}

/** Swedish genitive: "Sävehof" -> "Sävehofs", "Alingsås" -> "Alingsås", "H43" -> "H43:s". */
export function swedishGenitive(name: string): string {
  if (/[sxz]$/i.test(name)) return name;
  if (/[0-9A-ZÅÄÖ]$/.test(name)) return `${name}:s`;
  return `${name}s`;
}

/**
 * Club Identity C4 (D7): the relation shown as TEXT next to a club's own name
 * (never as a colour, never instead of the name). Undefined for independent
 * clubs and informational links.
 */
export function clubRelationLabel(clubId: string, seasonId?: SeasonLabel): string | undefined {
  const r = clubRelationForSeason(clubId, seasonId);
  if (!r || r.relation === "YOUTH_LINK") return undefined;
  const parent = getClub(r.parentClubId);
  if (!parent) return undefined;
  const p = parent.shortName;
  switch (r.relation) {
    case "U_TEAM_UNDER_PARTNER_LICENCE": {
      const licence = getClub(clubId)?.licenceHolderAssociation?.name;
      return licence ? `${p} U · ${swedishGenitive(licence)} licens` : `${p} U`;
    }
    case "U_TEAM": return `${p} U`;
    case "SAME_CLUB_SECOND_TEAM": case "SECOND_TEAM": case "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION": return `${swedishGenitive(p)} andralag`;
    // The full parent name: "Kristianstad" alone would not tell IF and IFK Kristianstad apart.
    case "PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS": return `Samarbetsklubb till ${parent.name}`;
    case "ACADEMY": return `${swedishGenitive(p)} akademi`;
  }
}

/**
 * Owner decision 2026-11-14: A HUMAN PLAYER CAN NEVER MANAGE OR SELECT A B-TEAM.
 * A B-team is a club's second team (andralag / reservlag): SECOND_TEAM,
 * SAME_CLUB_SECOND_TEAM, SECOND_TEAM_UNDER_PARTNER_ASSOCIATION. It is NOT a farm
 * club / partner association (IF Kristianstad, D8), NOT a U-team (HK Cliff stays
 * selectable under D7), NOT an independent club and NOT a historical cooperation.
 * B-teams exist and play normally under CPU management.
 */
export const B_TEAM_RELATION_KINDS: readonly ClubRelationKind[] = ["SECOND_TEAM", "SAME_CLUB_SECOND_TEAM", "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION"];

/** True for a B-team in `seasonId` (any current relation when omitted). */
export function isBTeam(clubId: string, seasonId?: SeasonLabel): boolean {
  return (getClub(clubId)?.relations ?? []).some((r) => B_TEAM_RELATION_KINDS.includes(r.relation) && (seasonId ? seasonWithin(seasonId, r.validFrom, r.validTo) : !r.validTo));
}

/** Whether a human manager may select, apply to, be offered or lead this club. */
export function isHumanManageable(clubId: string, seasonId?: SeasonLabel): boolean {
  return !!getClub(clubId) && !isBTeam(clubId, seasonId);
}
