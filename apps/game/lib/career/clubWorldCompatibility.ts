// Club Identity C3 (T7): forward-compatibility guard for the club world.
//
// The IndexedDB loader does not reject a newer save (saveRepository.ts), so a
// build must recognise club-world data it cannot interpret instead of silently
// re-stamping it. Pure and side-effect free; getOrCreateCareerState calls it
// before migrating a stored career.
import { CLUB_WORLD_EPOCH, getClub } from "../game-data";
import type { CareerState } from "./types";

/** Club-world epochs this build can interpret. Absent marker = legacy v8 world (always readable). */
export const KNOWN_CLUB_WORLD_BASELINES: readonly string[] = [CLUB_WORLD_EPOCH];

/** Every club id a career stores as a value or a map key (MIGRATION-STRATEGY §2). Embedded ids (youth-/generated-/bteam-) are covered by their owning maps. */
export function storedClubIds(s: Partial<CareerState>): Set<string> {
  const ids = new Set<string>();
  if (s.playerClubId) ids.add(s.playerClubId);
  for (const f of s.fixtures ?? []) { ids.add(f.homeClubId); ids.add(f.awayClubId); }
  for (const key of ["worldSquads", "gameplayRatings", "clubEconomies", "competitionMembership", "clubKnowledge", "staffRoster", "clubForm", "aiTacticalPreferences"] as const) {
    for (const id of Object.keys((s[key] as Record<string, unknown> | undefined) ?? {})) ids.add(id);
  }
  for (const p of Object.values(s.clubPartnerships ?? {})) { ids.add(p.clubAId); ids.add(p.clubBId); }
  for (const h of s.seasonHistory ?? []) {
    for (const rows of [h.table, ...Object.values(h.tables ?? {})]) for (const r of rows ?? []) ids.add(r.clubId);
    for (const f of h.fixtures ?? []) { ids.add(f.homeClubId); ids.add(f.awayClubId); }
  }
  return ids;
}

export interface ClubWorldCompatibility {
  /** False only for a club world this build cannot interpret (a save from a newer build). */
  compatible: boolean;
  unknownBaseline?: string;
  /** Stored ids that do not resolve in this build. The manager's own club is fatal (getCareerClub throws); others render as their raw id. */
  unresolvedClubIds: string[];
  managerClubResolves: boolean;
}

export function assessClubWorldCompatibility(state: Partial<CareerState>): ClubWorldCompatibility {
  const unknownBaseline = state.clubWorldBaseline && !KNOWN_CLUB_WORLD_BASELINES.includes(state.clubWorldBaseline) ? state.clubWorldBaseline : undefined;
  const unresolvedClubIds = [...storedClubIds(state)].filter((id) => !getClub(id)).sort();
  const managerClubResolves = !state.playerClubId || !!getClub(state.playerClubId);
  return { compatible: !unknownBaseline && managerClubResolves, unknownBaseline, unresolvedClubIds, managerClubResolves };
}

export class ClubWorldCompatibilityError extends Error {
  constructor(readonly report: ClubWorldCompatibility) {
    super(report.unknownBaseline
      ? `Karriären skapades i en nyare version av spelet (klubbvärld ${report.unknownBaseline}). Uppdatera spelet eller exportera karriären innan du fortsätter.`
      : `Karriärens klubb (${report.unresolvedClubIds.join(", ")}) finns inte i den här versionen av spelet. Exportera karriären innan du fortsätter.`);
    this.name = "ClubWorldCompatibilityError";
  }
}

/** Throws (refuses to continue, nothing is written) for an incompatible club world; warns for stray unresolved ids. */
export function assertClubWorldCompatible(state: Partial<CareerState>): ClubWorldCompatibility {
  const report = assessClubWorldCompatibility(state);
  if (!report.compatible) throw new ClubWorldCompatibilityError(report);
  if (report.unresolvedClubIds.length) console.warn(`[club-identity] ${report.unresolvedClubIds.length} stored club id(s) do not resolve: ${report.unresolvedClubIds.slice(0, 10).join(", ")}`);
  return report;
}
