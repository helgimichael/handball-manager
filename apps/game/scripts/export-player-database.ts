// HM-PLAYER-DATABASE-EXPORT-1.0: a deterministic, read-only export of the
// canonical player database for external rating/evidence research.
//
// Reuses the EXACT SAME canonical player-data path a fresh career
// actually uses -- snapshotWorldSquads/snapshotGameplayRatings
// (gameWorld/serverSnapshot.ts), the same functions CareerContext.tsx's
// own fetch* helpers call server-side. No parallel loader, no CA/PA
// generation, no calibration, no correction. This script only READS
// data/real-world/* (via the existing loader) and WRITES to exports/
// player-rating-research/ -- it never touches any canonical game-data or
// career file.
//
// SCOPE (Part 1): "the whole canonical player population" is read from
// EVERY competition in game-data's own COMPETITIONS registry that has at
// least one REAL_WORLD club -- not just the 20 competitions a fresh
// career's own CareerContext.tsx actually fetches (Handbollsligan +
// Allsvenskan + Division 1 Norra/Södra + the 16 World Player Pool
// competitions). The audit found 8 additional real-world-backed
// competitions (den-2, nor-2, ger-2, esp-2, hun-2, svn-1, svn-2, isl-2 --
// second-tier leagues for nations already partly represented, plus
// Slovenia entirely) that exist as real imported data but are NEVER
// loaded by any fresh career today (CareerContext.tsx has no fetch call
// referencing them). Rather than silently drop this real data or
// silently include it as if it were "what the game uses", every row
// carries an explicit `isFreshCareerSource` flag so the export is both
// genuinely complete (Part 1) AND honestly distinguishes what a fresh
// career would actually load (Part 4) -- exactly the same reconciliation
// Part 16 asks for.
import * as fs from "node:fs";
import * as path from "node:path";
import { CLUBS, getClub, getCompetition, type Club, type Competition, type PlayerMock } from "../lib/game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../lib/gameWorld/serverSnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../lib/career/worldCompetitions";
import { WORLD_POOL_COMPETITION_IDS } from "../lib/career/careerWorld";
import type { GameplayPlayerRating } from "../lib/gameWorld/gameplayRatingSnapshot";

const SNAPSHOT_DATE = "2026-08-30";
const OUT_DIR = path.resolve(__dirname, "../../../exports/player-rating-research");

const FRESH_CAREER_COMPETITION_IDS = new Set<string>([...SWEDISH_WORLD_COMPETITION_IDS, ...WORLD_POOL_COMPETITION_IDS]);

/** Every competition in the static registry that has at least one REAL_WORLD-sourced club -- the true "whole canonical player population" scope (Part 1), a superset of what any fresh career actually fetches. */
function realWorldCompetitionIds(): string[] {
  const ids = new Set<string>();
  for (const club of CLUBS) {
    if (club.dataSource === "REAL_WORLD") ids.add(club.competitionId);
  }
  return [...ids].sort();
}

// ---------------------------------------------------------------------------
// Part 3: age from a fixed snapshot date, DOB primary.
// ---------------------------------------------------------------------------
function ageAtSnapshot(dateOfBirth: string | null, birthYear: number | null | undefined): number | null {
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const asOf = new Date(SNAPSHOT_DATE);
    let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
    const monthDiff = asOf.getUTCMonth() - dob.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < dob.getUTCDate())) age--;
    return age;
  }
  if (birthYear) return Number(SNAPSHOT_DATE.slice(0, 4)) - birthYear;
  return null;
}

// ---------------------------------------------------------------------------
// Row shape (Part 2/6/7/8/9).
// ---------------------------------------------------------------------------
interface PlayerRow {
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  birthYear: string;
  ageAtSnapshot: string;
  nationality: string;
  secondaryNationality: string;
  position: string;
  positionLabel: string;
  secondaryPosition: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  competitionName: string;
  country: string;
  tier: string;
  squadStatus: string;
  shirtNumber: string;
  currentCA: string;
  currentPA: string;
  sourceType: string;
  sourceFile: string;
  isGenerated: string;
  isWorldPool: string;
  isDivision1: string;
  isAllsvenskan: string;
  isHandbollsligan: string;
  isFreshCareerSource: string;
  preferredHand: string;
  heightCm: string;
  weightKg: string;
  contractEndSeason: string;
  wageSekPerMonth: string;
  playerTags: string;
  archetype: string;
  isGoalkeeper: string;
  isCaptain: string;
  prospectMarker: string;
  internationalMarker: string;
  // Part 8: research-priority helper columns, deliberately empty.
  verifiedDOB: string;
  verifiedPosition: string;
  verifiedClub: string;
  verifiedNationality: string;
  seniorNationalTeam: string;
  youthNationalTeam: string;
  nationalTeamLevel: string;
  internationalClubExperience: string;
  europeanCompetitionExperience: string;
  mediaProfileLevel: string;
  prospectEvidenceLevel: string;
  worldProfileClass: string;
  researchConfidence: string;
  researchNotes: string;
  researchSources: string;
  suggestedCA: string;
  suggestedPA: string;
  ratingConfidence: string;
  ratingReason: string;
}

const PLAYER_COLUMNS: (keyof PlayerRow)[] = [
  "playerId", "name", "firstName", "lastName", "dateOfBirth", "birthYear", "ageAtSnapshot",
  "nationality", "secondaryNationality", "position", "positionLabel", "secondaryPosition",
  "clubId", "clubName", "competitionId", "competitionName", "country", "tier", "squadStatus",
  "shirtNumber", "currentCA", "currentPA", "sourceType", "sourceFile", "isGenerated",
  "isWorldPool", "isDivision1", "isAllsvenskan", "isHandbollsligan", "isFreshCareerSource",
  "preferredHand", "heightCm", "weightKg", "contractEndSeason", "wageSekPerMonth",
  "playerTags", "archetype", "isGoalkeeper", "isCaptain", "prospectMarker", "internationalMarker",
  "verifiedDOB", "verifiedPosition", "verifiedClub", "verifiedNationality",
  "seniorNationalTeam", "youthNationalTeam", "nationalTeamLevel",
  "internationalClubExperience", "europeanCompetitionExperience",
  "mediaProfileLevel", "prospectEvidenceLevel", "worldProfileClass",
  "researchConfidence", "researchNotes", "researchSources",
  "suggestedCA", "suggestedPA", "ratingConfidence", "ratingReason",
];

/** Part 7: Sweden's own three tiers use the export's own explicit tier labels (Division 1 = 3, distinct from the production Competition.tier=2 workaround documented in competitions.ts -- production data is NEVER changed, this is an export-only display value). Every other competition uses its own registry tier verbatim, never invented. */
function exportTier(competition: Competition): string {
  if (competition.id === "se_handbollsligan_herr") return "1";
  if (competition.id === "swe-2") return "2";
  if (competition.id === "se_division1_norra" || competition.id === "se_division1_sodra") return "3";
  return String(competition.tier);
}

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function writeCsv(filePath: string, columns: string[], rows: Record<string, string>[]): void {
  const lines: string[] = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvEscape(row[c] ?? "")).join(","));
  fs.writeFileSync(filePath, lines.join("\r\n") + "\r\n", "utf8");
}

// ---------------------------------------------------------------------------
// Part 5: identity integrity audit structures.
// ---------------------------------------------------------------------------
interface CollisionReport {
  duplicatePlayerIds: string[];
  nameAndDobCollisions: { key: string; playerIds: string[] }[];
  nameOnlyCollisions: { key: string; playerIds: string[] }[];
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const competitionIds = realWorldCompetitionIds();
  console.log(`Real-world-backed competitions found: ${competitionIds.length}`);
  const notInFreshCareer = competitionIds.filter((id) => !FRESH_CAREER_COMPETITION_IDS.has(id));
  console.log(`  of which NOT loaded by any fresh career today: ${notInFreshCareer.length} -> ${JSON.stringify(notInFreshCareer)}`);

  interface Entry {
    player: PlayerMock;
    rating: GameplayPlayerRating | undefined;
    clubId: string;
    competitionId: string;
  }
  const entries: Entry[] = [];
  const seenPlayerIds = new Map<string, string[]>(); // playerId -> [clubId, ...] every time seen.

  for (const competitionId of competitionIds) {
    const worldSquads = snapshotWorldSquads(competitionId);
    const gameplayRatings = snapshotGameplayRatings(competitionId);
    for (const clubId of Object.keys(worldSquads)) {
      const ratingsByPlayerId = new Map((gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
      for (const player of worldSquads[clubId]) {
        entries.push({ player, rating: ratingsByPlayerId.get(player.id), clubId, competitionId });
        const seenAt = seenPlayerIds.get(player.id) ?? [];
        seenAt.push(clubId);
        seenPlayerIds.set(player.id, seenAt);
      }
    }
  }

  // Part 5: identity integrity. A "name+DOB collision" requires a REAL,
  // KNOWN date-of-birth (or birth year) shared by both players -- two
  // players who merely both have an UNKNOWN DOB must never be bucketed
  // together as if that were a real match (that's just missing data,
  // already counted separately above).
  const duplicatePlayerIds = [...seenPlayerIds.entries()].filter(([, clubIds]) => clubIds.length > 1).map(([id]) => id);
  const byNameDob = new Map<string, string[]>();
  const byNameOnly = new Map<string, string[]>();
  for (const e of entries) {
    const nameKey = `${e.player.firstName.trim().toLowerCase()}|${e.player.lastName.trim().toLowerCase()}`;
    const knownDob = e.player.dateOfBirth ?? (e.player.birthYear != null ? String(e.player.birthYear) : null);
    if (knownDob !== null) {
      const nameDobKey = `${nameKey}|${knownDob}`;
      if (!byNameDob.has(nameDobKey)) byNameDob.set(nameDobKey, []);
      byNameDob.get(nameDobKey)!.push(e.player.id);
    }
    if (!byNameOnly.has(nameKey)) byNameOnly.set(nameKey, []);
    byNameOnly.get(nameKey)!.push(e.player.id);
  }
  const nameAndDobCollisions = [...byNameDob.entries()].filter(([, ids]) => new Set(ids).size > 1).map(([key, ids]) => ({ key, playerIds: [...new Set(ids)] }));
  // Name-only collisions exclude anyone already counted as a genuine name+DOB collision above, so the two reports don't double-count the same pair.
  const nameAndDobCollisionIds = new Set(nameAndDobCollisions.flatMap((c) => c.playerIds));
  const nameOnlyCollisions = [...byNameOnly.entries()]
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([key, ids]) => ({ key, playerIds: [...new Set(ids)] }))
    .filter((c) => !c.playerIds.every((id) => nameAndDobCollisionIds.has(id)));
  const collisionReport: CollisionReport = { duplicatePlayerIds, nameAndDobCollisions, nameOnlyCollisions };

  // Part 2/6/7/8/9: build rows.
  const rows: PlayerRow[] = entries.map((e) => {
    const club = getClub(e.clubId) as Club | undefined;
    const competition = getCompetition(e.competitionId);
    const age = ageAtSnapshot(e.player.dateOfBirth, e.player.birthYear);
    const isWorldPool = (WORLD_POOL_COMPETITION_IDS as readonly string[]).includes(e.competitionId);
    const isDivision1 = e.competitionId === "se_division1_norra" || e.competitionId === "se_division1_sodra";
    const isAllsvenskan = e.competitionId === "swe-2";
    const isHandbollsligan = e.competitionId === "se_handbollsligan_herr";
    const tags = e.player.specialTags ?? [];
    const archetypeSource = e.rating?.attackRoleProficiencies?.[0]?.role ?? e.rating?.defenceRoleProficiencies?.[0]?.role ?? "";

    return {
      playerId: e.player.id,
      name: `${e.player.firstName} ${e.player.lastName}`,
      firstName: e.player.firstName,
      lastName: e.player.lastName,
      dateOfBirth: e.player.dateOfBirth ?? "",
      birthYear: e.player.birthYear != null ? String(e.player.birthYear) : "",
      ageAtSnapshot: age != null ? String(age) : "",
      nationality: e.player.nationality,
      secondaryNationality: (e.player.nationalities ?? []).filter((n) => n !== e.player.nationality)[0] ?? "",
      position: e.player.position,
      positionLabel: e.player.position,
      secondaryPosition: e.player.secondaryPosition ?? (e.player.secondaryPositions ?? [])[0] ?? "",
      clubId: e.clubId,
      clubName: club?.name ?? "",
      competitionId: e.competitionId,
      competitionName: competition?.name ?? "",
      country: competition?.nation ?? "",
      tier: competition ? exportTier(competition) : "",
      squadStatus: e.player.squadStatus,
      shirtNumber: e.player.shirtNumber != null ? String(e.player.shirtNumber) : "",
      currentCA: e.rating ? String(e.rating.ca) : (e.player.currentAbility != null ? String(e.player.currentAbility) : ""),
      currentPA: e.rating ? String(e.rating.pa) : (e.player.potentialAbility != null ? String(e.player.potentialAbility) : ""),
      sourceType: e.rating?.caSource ?? "",
      sourceFile: e.player.dataSource ?? "",
      isGenerated: e.player.id.startsWith("youth-") ? "true" : "false",
      isWorldPool: String(isWorldPool),
      isDivision1: String(isDivision1),
      isAllsvenskan: String(isAllsvenskan),
      isHandbollsligan: String(isHandbollsligan),
      isFreshCareerSource: String(FRESH_CAREER_COMPETITION_IDS.has(e.competitionId)),
      preferredHand: e.player.foot ?? "",
      heightCm: e.player.heightCm != null ? String(e.player.heightCm) : "",
      weightKg: e.player.weightKg != null ? String(e.player.weightKg) : "",
      contractEndSeason: e.player.contractEndSeason ?? "",
      wageSekPerMonth: e.player.wageSekPerMonth != null ? String(e.player.wageSekPerMonth) : "",
      playerTags: tags.join("|"),
      archetype: archetypeSource,
      isGoalkeeper: String(e.player.position === "MV"),
      isCaptain: String(tags.includes("CAPTAIN")),
      prospectMarker: e.player.calibratedSquadStatusTier === "TALENT" ? "TALENT" : "",
      internationalMarker: "",
      verifiedDOB: "", verifiedPosition: "", verifiedClub: "", verifiedNationality: "",
      seniorNationalTeam: "", youthNationalTeam: "", nationalTeamLevel: "",
      internationalClubExperience: "", europeanCompetitionExperience: "",
      mediaProfileLevel: "", prospectEvidenceLevel: "", worldProfileClass: "",
      researchConfidence: "", researchNotes: "", researchSources: "",
      suggestedCA: "", suggestedPA: "", ratingConfidence: "", ratingReason: "",
    };
  });

  // Part 15: stable, documented sort -- country, competition, club, player name, playerId.
  rows.sort((a, b) =>
    a.country.localeCompare(b.country) ||
    a.competitionId.localeCompare(b.competitionId) ||
    a.clubId.localeCompare(b.clubId) ||
    a.name.localeCompare(b.name) ||
    a.playerId.localeCompare(b.playerId),
  );

  writeCsv(path.join(OUT_DIR, "player_database_full.csv"), PLAYER_COLUMNS, rows as unknown as Record<string, string>[]);

  // ---------------------------------------------------------------------------
  // Part 10: league summary.
  // ---------------------------------------------------------------------------
  function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return NaN;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  }
  function stats(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : NaN;
    return {
      mean, median: percentile(sorted, 50), min: sorted[0] ?? NaN, max: sorted[sorted.length - 1] ?? NaN,
      p10: percentile(sorted, 10), p25: percentile(sorted, 25), p75: percentile(sorted, 75), p90: percentile(sorted, 90), p95: percentile(sorted, 95),
    };
  }

  const leagueRows: Record<string, string>[] = [];
  for (const competitionId of competitionIds) {
    const competition = getCompetition(competitionId)!;
    const leaguePlayers = rows.filter((r) => r.competitionId === competitionId);
    const caValues = leaguePlayers.map((r) => Number(r.currentCA)).filter((v) => !Number.isNaN(v));
    const paValues = leaguePlayers.map((r) => Number(r.currentPA)).filter((v) => !Number.isNaN(v));
    const ageValues = leaguePlayers.map((r) => Number(r.ageAtSnapshot)).filter((v) => !Number.isNaN(v));
    const caStats = stats(caValues);
    const paStats = stats(paValues);
    leagueRows.push({
      competitionId, competitionName: competition.name, country: competition.nation,
      playerCount: String(leaguePlayers.length),
      knownDOBCount: String(leaguePlayers.filter((r) => r.dateOfBirth !== "").length),
      knownPositionCount: String(leaguePlayers.filter((r) => r.position !== "" && r.position !== "UNKNOWN").length),
      meanCA: caStats.mean.toFixed(1), medianCA: String(caStats.median), minCA: String(caStats.min), maxCA: String(caStats.max),
      p10CA: String(caStats.p10), p25CA: String(caStats.p25), p75CA: String(caStats.p75), p90CA: String(caStats.p90), p95CA: String(caStats.p95),
      meanPA: paStats.mean.toFixed(1), medianPA: String(paStats.median), minPA: String(paStats.min), maxPA: String(paStats.max),
      meanAge: ageValues.length ? (ageValues.reduce((a, b) => a + b, 0) / ageValues.length).toFixed(1) : "",
      medianAge: ageValues.length ? String(percentile([...ageValues].sort((a, b) => a - b), 50)) : "",
    });
  }
  const leagueColumns = ["competitionId", "competitionName", "country", "playerCount", "knownDOBCount", "knownPositionCount", "meanCA", "medianCA", "minCA", "maxCA", "p10CA", "p25CA", "p75CA", "p90CA", "p95CA", "meanPA", "medianPA", "minPA", "maxPA", "meanAge", "medianAge"];
  writeCsv(path.join(OUT_DIR, "player_database_league_summary.csv"), leagueColumns, leagueRows);

  // ---------------------------------------------------------------------------
  // Part 11: club summary.
  // ---------------------------------------------------------------------------
  const clubIds = [...new Set(rows.map((r) => r.clubId))].sort();
  const clubRows: Record<string, string>[] = [];
  for (const clubId of clubIds) {
    const club = getClub(clubId);
    const clubPlayers = rows.filter((r) => r.clubId === clubId);
    const caValues = clubPlayers.map((r) => Number(r.currentCA)).filter((v) => !Number.isNaN(v));
    const paValues = clubPlayers.map((r) => Number(r.currentPA)).filter((v) => !Number.isNaN(v));
    const ageValues = clubPlayers.map((r) => Number(r.ageAtSnapshot)).filter((v) => !Number.isNaN(v));
    const caStats = stats(caValues);
    const paStats = stats(paValues);
    clubRows.push({
      clubId, clubName: club?.name ?? "", competition: club?.competitionId ?? "",
      playerCount: String(clubPlayers.length),
      meanCA: caStats.mean.toFixed(1), medianCA: String(caStats.median), minCA: String(caStats.min), maxCA: String(caStats.max),
      meanPA: paStats.mean.toFixed(1), medianPA: String(paStats.median),
      meanAge: ageValues.length ? (ageValues.reduce((a, b) => a + b, 0) / ageValues.length).toFixed(1) : "",
    });
  }
  const clubColumns = ["clubId", "clubName", "competition", "playerCount", "meanCA", "medianCA", "minCA", "maxCA", "meanPA", "medianPA", "meanAge"];
  writeCsv(path.join(OUT_DIR, "player_database_club_summary.csv"), clubColumns, clubRows);

  // ---------------------------------------------------------------------------
  // Part 12: rating outliers.
  // ---------------------------------------------------------------------------
  const outlierColumns = ["playerId", "name", "clubId", "competitionId", "currentCA", "currentPA", "reason"];
  const outlierRows: Record<string, string>[] = [];
  for (const competitionId of competitionIds) {
    const leaguePlayers = rows.filter((r) => r.competitionId === competitionId && r.currentCA !== "");
    if (leaguePlayers.length === 0) continue;
    const byCa = [...leaguePlayers].sort((a, b) => Number(a.currentCA) - Number(b.currentCA));
    const caValues = byCa.map((r) => Number(r.currentCA));
    const median = percentile([...caValues].sort((a, b) => a - b), 50);
    for (const r of byCa.slice(0, 10)) outlierRows.push({ playerId: r.playerId, name: r.name, clubId: r.clubId, competitionId, currentCA: r.currentCA, currentPA: r.currentPA, reason: "league bottom 10 CA" });
    for (const r of byCa.slice(-10)) outlierRows.push({ playerId: r.playerId, name: r.name, clubId: r.clubId, competitionId, currentCA: r.currentCA, currentPA: r.currentPA, reason: "league top 10 CA" });
    for (const r of leaguePlayers) {
      const ca = Number(r.currentCA);
      const pa = r.currentPA !== "" ? Number(r.currentPA) : NaN;
      if (!Number.isNaN(pa) && pa < ca) outlierRows.push({ playerId: r.playerId, name: r.name, clubId: r.clubId, competitionId, currentCA: r.currentCA, currentPA: r.currentPA, reason: "PA < CA" });
      if (!Number.isNaN(pa) && pa - ca >= 20) outlierRows.push({ playerId: r.playerId, name: r.name, clubId: r.clubId, competitionId, currentCA: r.currentCA, currentPA: r.currentPA, reason: "extreme PA-CA gap (>=20)" });
      if (median > 0 && ca < median * 0.6) outlierRows.push({ playerId: r.playerId, name: r.name, clubId: r.clubId, competitionId, currentCA: r.currentCA, currentPA: r.currentPA, reason: "substantially below league median (<60%)" });
      if (median > 0 && ca > median * 1.4) outlierRows.push({ playerId: r.playerId, name: r.name, clubId: r.clubId, competitionId, currentCA: r.currentCA, currentPA: r.currentPA, reason: "substantially above league distribution (>140% of median)" });
    }
  }
  writeCsv(path.join(OUT_DIR, "player_database_rating_outliers.csv"), outlierColumns, outlierRows);

  // ---------------------------------------------------------------------------
  // Report (Part 16).
  // ---------------------------------------------------------------------------
  const byCountry = new Map<string, number>();
  for (const r of rows) byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
  const byCompetition = new Map<string, number>();
  for (const r of rows) byCompetition.set(r.competitionId, (byCompetition.get(r.competitionId) ?? 0) + 1);

  console.log(`\n=== Export report ===`);
  console.log(`Total players exported: ${rows.length}`);
  console.log(`Fresh-career-source players: ${rows.filter((r) => r.isFreshCareerSource === "true").length}`);
  console.log(`By country: ${JSON.stringify(Object.fromEntries(byCountry))}`);
  console.log(`By competition: ${JSON.stringify(Object.fromEntries(byCompetition))}`);
  console.log(`Missing DOB: ${rows.filter((r) => r.dateOfBirth === "").length}`);
  console.log(`Missing position: ${rows.filter((r) => r.position === "" || r.position === "UNKNOWN").length}`);
  console.log(`Missing club: ${rows.filter((r) => r.clubName === "").length}`);
  console.log(`Missing CA: ${rows.filter((r) => r.currentCA === "").length}`);
  console.log(`Missing PA: ${rows.filter((r) => r.currentPA === "").length}`);
  console.log(`PA < CA count: ${rows.filter((r) => r.currentPA !== "" && Number(r.currentPA) < Number(r.currentCA)).length}`);
  console.log(`Duplicate playerIds: ${collisionReport.duplicatePlayerIds.length} -> ${JSON.stringify(collisionReport.duplicatePlayerIds)}`);
  console.log(`Name+DOB collisions (different playerIds, same name+DOB): ${collisionReport.nameAndDobCollisions.length}`);
  for (const c of collisionReport.nameAndDobCollisions) console.log(`  ${c.key}: ${JSON.stringify(c.playerIds)}`);
  console.log(`Name-only collisions (different playerIds, same name, different DOB or unknown): ${collisionReport.nameOnlyCollisions.length}`);
  for (const c of collisionReport.nameOnlyCollisions.slice(0, 30)) console.log(`  ${c.key}: ${JSON.stringify(c.playerIds)}`);
  if (collisionReport.nameOnlyCollisions.length > 30) console.log(`  ... and ${collisionReport.nameOnlyCollisions.length - 30} more`);

  console.log(`\nFiles written to: ${OUT_DIR}`);
  console.log(`  player_database_full.csv (${rows.length} rows)`);
  console.log(`  player_database_league_summary.csv (${leagueRows.length} rows)`);
  console.log(`  player_database_club_summary.csv (${clubRows.length} rows)`);
  console.log(`  player_database_rating_outliers.csv (${outlierRows.length} rows)`);
}

main();
