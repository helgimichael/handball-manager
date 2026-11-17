// HM-M9A: the MANAGER-MODE competition rule package.
//
// The official Swedish package (sweden2026.ts) is an evidence-gated planner for
// real federation rules: it carries permanent limitations (administrative
// review, unverified qualification calendar, terminal decider, next-season
// profile) and needs licensing, district entrants and group allocations the
// game never produces, so it can never complete a career rollover. That is
// correct for an official package and is left untouched.
//
// In manager mode the GAME is the organizer, and its own simulated season is
// the sporting evidence. This package says exactly that, explicitly
// (`authority: "MANAGER_MODE"`), and nothing else is relaxed: the planner, its
// validation and the atomic transition run unchanged.
//
// Owner decisions (M9, locked):
//   D1  Handbollsligan <-> Allsvenskan is fully operational with the verified
//       interchange: HBL 14 down and Allsvenskan 1 up directly; HBL 11-13 meet
//       Allsvenskan 4-2 in best-of-five kval (THB 3:3, the same stages and home
//       order as the official package). Allsvenskan <-> Division 1 is CLOSED
//       until Division 1 is a properly simulated league: Allsvenskan 11-14 keep
//       their place and Division 1 membership is not touched. No squad-strength
//       selection exists anywhere in this package.
//   D3  Every active club is licensed (careerTransitionEvidence.ts supplies the
//       eligibility decisions through an extensible licence hook).
//
// Legacy careers (M9F) may have played fewer leagues than this package
// models. `frozen` keeps every club where it is when a tier's season was not
// simulated (no movement can be evidenced), and `closedLeagues` admits a
// league that WAS played but sits outside the interchange (a manager who was
// relegated into a Division 1 group by the pre-M1.2D rollover) as a closed,
// fully retained league.
import { SWEDISH_2026_RULES, SWEDISH_FAMILIES as F, SWEDISH_LEAGUES as L } from "./sweden2026";
import type { CompetitionRules, EntryRule, Evidence, FamilyDefinition, LeagueDefinition } from "./types";

export const MANAGER_MODE_AUTHORITY = "MANAGER_MODE" as const;

const CLOSED_LOWER_BOUNDARY: Evidence = {
  url: "manager-mode:closed-lower-boundary",
  section: "Owner decision D1 (M9): Allsvenskan <-> Division 1 is closed until Division 1 is a simulated league; Allsvenskan 11-14 retain.",
};
const CLOSED_LEAGUE: Evidence = {
  url: "manager-mode:closed-league",
  section: "Owner decision D1 (M9): a played league outside the HBL/Allsvenskan interchange keeps every club.",
};
const FROZEN_SEASON: Evidence = {
  url: "manager-mode:frozen-season",
  section: "M9F: a legacy season without both simulated tiers carries no evidence for movement; every club keeps its league.",
};

export interface ManagerModePackageOptions {
  /** Legacy seasons only: no movement, every listed league is retained as-is. */
  readonly frozen?: boolean;
  /** Leagues of the interchange that were actually played this season (default both). */
  readonly interchangeLeagues?: readonly string[];
  /** A played league outside the interchange (e.g. a Division 1 group), retained in full. */
  readonly closedLeagues?: readonly { readonly id: string; readonly size: number }[];
}

function seasonLabel(startYear: number): string {
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

/** The manager-mode package governing the season that starts in `startYear`. */
export function managerModeRules(startYear: number, options: ManagerModePackageOptions = {}): CompetitionRules {
  const official = SWEDISH_2026_RULES;
  const interchange: string[] = (options.interchangeLeagues ?? [L.hbl, L.allsvenskan]).filter((id) => id === L.hbl || id === L.allsvenskan);
  const frozen = options.frozen === true || interchange.length < 2;
  const closed = options.closedLeagues ?? [];

  const familyIds = new Set<string>(interchange.map((id) => (id === L.hbl ? F.hbl : F.allsvenskan)));
  if (closed.length > 0) familyIds.add(F.division1);
  const families: FamilyDefinition[] = official.families.filter((f) => familyIds.has(f.id)).map((f) => ({ ...f, boundary: false }));

  const leagues: LeagueDefinition[] = [
    ...official.leagues.filter((l) => interchange.includes(l.id)),
    ...closed.map((c) => ({ id: c.id, familyId: F.division1, size: c.size, legs: 2 })),
  ];

  const officialEntry = (competitionId: string, rank: number): EntryRule => official.entries.find((e) => e.selector.kind === "RANK" && e.selector.competitionId === competitionId && e.selector.rank === rank)!;
  const retain = (competitionId: string, rank: number, familyId: string, source: Evidence): EntryRule => ({ id: `${competitionId}:rank:${rank}`, selector: { kind: "RANK", competitionId, rank }, purpose: "RETAIN", targetFamilyId: familyId, eligibility: false, replacement: "NONE", source });

  const entries: EntryRule[] = [];
  for (const league of leagues) {
    for (let rank = 1; rank <= league.size; rank++) {
      if (closed.some((c) => c.id === league.id)) entries.push(retain(league.id, rank, league.familyId, CLOSED_LEAGUE));
      else if (frozen) entries.push(retain(league.id, rank, league.familyId, FROZEN_SEASON));
      else if (league.id === L.allsvenskan && rank >= 11) entries.push(retain(league.id, rank, F.allsvenskan, CLOSED_LOWER_BOUNDARY));
      else entries.push(officialEntry(league.id, rank));
    }
  }

  return {
    ...official,
    id: `manager-mode-se-men-${frozen ? "frozen" : "hbl-allsvenskan"}${closed.length ? "-closed-div1" : ""}-${seasonLabel(startYear)}`,
    authority: MANAGER_MODE_AUTHORITY,
    seasonId: seasonLabel(startYear),
    nextSeasonId: seasonLabel(startYear + 1),
    families,
    leagues,
    entries,
    stages: frozen ? [] : official.stages.filter((s) => s.id.startsWith("hbl-")),
    limitations: [],
  };
}
