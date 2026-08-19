import type { Fixture } from "./types";
import { TUMBA_CLUB_ID } from "./clubs";

// Fictional season schedule/results for IFK Tumba in Allsvenskan
// (swe-2), against the real opponent clubs from clubs.ts. Game "today"
// is 2026-08-19 -- everything before that is a mock played result,
// everything after is upcoming.
export const TUMBA_FIXTURES: readonly Fixture[] = [
  { id: "f-01", competitionId: "swe-2", round: 1, date: "2026-06-20", homeClubId: TUMBA_CLUB_ID, awayClubId: "swe2-lugi", status: "Spelad", homeScore: 29, awayScore: 24 },
  { id: "f-02", competitionId: "swe-2", round: 2, date: "2026-06-27", homeClubId: "swe2-varberg", awayClubId: TUMBA_CLUB_ID, status: "Spelad", homeScore: 22, awayScore: 27 },
  { id: "f-03", competitionId: "swe-2", round: 3, date: "2026-07-04", homeClubId: TUMBA_CLUB_ID, awayClubId: "swe2-kungalv", status: "Spelad", homeScore: 31, awayScore: 26 },
  { id: "f-04", competitionId: "swe-2", round: 4, date: "2026-07-11", homeClubId: "swe2-drott", awayClubId: TUMBA_CLUB_ID, status: "Spelad", homeScore: 25, awayScore: 25 },
  { id: "f-05", competitionId: "swe-2", round: 5, date: "2026-07-18", homeClubId: TUMBA_CLUB_ID, awayClubId: "swe2-tyreso", status: "Spelad", homeScore: 33, awayScore: 21 },
  { id: "f-06", competitionId: "swe-2", round: 6, date: "2026-07-25", homeClubId: "swe2-aranas", awayClubId: TUMBA_CLUB_ID, status: "Spelad", homeScore: 28, awayScore: 30 },
  { id: "f-07", competitionId: "swe-2", round: 7, date: "2026-08-01", homeClubId: TUMBA_CLUB_ID, awayClubId: "swe2-vinslov", status: "Spelad", homeScore: 27, awayScore: 22 },
  { id: "f-08", competitionId: "swe-2", round: 8, date: "2026-08-08", homeClubId: "swe2-anderstorp", awayClubId: TUMBA_CLUB_ID, status: "Spelad", homeScore: 24, awayScore: 24 },
  { id: "f-09", competitionId: "swe-2", round: 9, date: "2026-08-15", homeClubId: TUMBA_CLUB_ID, awayClubId: "swe2-torslanda", status: "Spelad", homeScore: 26, awayScore: 20 },
  { id: "f-10", competitionId: "swe-2", round: 10, date: "2026-08-23", homeClubId: TUMBA_CLUB_ID, awayClubId: "swe2-karlskrona2", status: "Kommande" },
  { id: "f-11", competitionId: "swe-2", round: 11, date: "2026-08-30", homeClubId: "swe2-ystad2", awayClubId: TUMBA_CLUB_ID, status: "Kommande" },
  { id: "f-12", competitionId: "swe-2", round: 12, date: "2026-09-06", homeClubId: TUMBA_CLUB_ID, awayClubId: "swe2-lagan", status: "Kommande" },
  { id: "f-13", competitionId: "swe-2", round: 13, date: "2026-09-13", homeClubId: "swe2-skanela", awayClubId: TUMBA_CLUB_ID, status: "Kommande" },
];

export function getNextFixture(): Fixture | undefined {
  return TUMBA_FIXTURES.find((f) => f.status === "Kommande");
}

export function getPlayedFixtures(): readonly Fixture[] {
  return TUMBA_FIXTURES.filter((f) => f.status === "Spelad");
}

export function getUpcomingFixtures(): readonly Fixture[] {
  return TUMBA_FIXTURES.filter((f) => f.status === "Kommande");
}

export function getFixture(id: string): Fixture | undefined {
  return TUMBA_FIXTURES.find((f) => f.id === id);
}
