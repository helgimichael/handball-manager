export type StandingRow = {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

// Mock Allsvenskan (swe-2) table, consistent with IFK Tumba's fictional
// fixtures.ts results (W7 D2 L0 through round 9). Other clubs' rows are
// authored to be plausible, not simulated.
export const ALLSVENSKAN_TABLE: readonly StandingRow[] = [
  { clubId: "swe2-tumba", played: 9, won: 7, drawn: 2, lost: 0, goalsFor: 252, goalsAgainst: 214, points: 16 },
  { clubId: "swe2-aranas", played: 9, won: 6, drawn: 1, lost: 2, goalsFor: 241, goalsAgainst: 220, points: 13 },
  { clubId: "swe2-lugi", played: 9, won: 6, drawn: 0, lost: 3, goalsFor: 238, goalsAgainst: 225, points: 12 },
  { clubId: "swe2-drott", played: 9, won: 5, drawn: 2, lost: 2, goalsFor: 233, goalsAgainst: 221, points: 12 },
  { clubId: "swe2-karlskrona2", played: 9, won: 5, drawn: 1, lost: 3, goalsFor: 229, goalsAgainst: 219, points: 11 },
  { clubId: "swe2-ystad2", played: 9, won: 4, drawn: 2, lost: 3, goalsFor: 224, goalsAgainst: 218, points: 10 },
  { clubId: "swe2-torslanda", played: 9, won: 4, drawn: 1, lost: 4, goalsFor: 219, goalsAgainst: 223, points: 9 },
  { clubId: "swe2-varberg", played: 9, won: 3, drawn: 2, lost: 4, goalsFor: 214, goalsAgainst: 224, points: 8 },
  { clubId: "swe2-kungalv", played: 9, won: 3, drawn: 1, lost: 5, goalsFor: 210, goalsAgainst: 228, points: 7 },
  { clubId: "swe2-tyreso", played: 9, won: 2, drawn: 3, lost: 4, goalsFor: 205, goalsAgainst: 222, points: 7 },
  { clubId: "swe2-lagan", played: 9, won: 2, drawn: 1, lost: 6, goalsFor: 201, goalsAgainst: 231, points: 5 },
  { clubId: "swe2-anderstorp", played: 9, won: 1, drawn: 2, lost: 6, goalsFor: 196, goalsAgainst: 233, points: 4 },
  { clubId: "swe2-vinslov", played: 9, won: 1, drawn: 1, lost: 7, goalsFor: 192, goalsAgainst: 238, points: 3 },
  { clubId: "swe2-skanela", played: 9, won: 1, drawn: 1, lost: 7, goalsFor: 190, goalsAgainst: 240, points: 3 },
];

export function getStandingsFor(competitionId: string): readonly StandingRow[] {
  if (competitionId === "swe-2") {
    return ALLSVENSKAN_TABLE;
  }
  return [];
}
