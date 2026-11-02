import { GAME_CURRENT_DATE, getClub, getClubsByCompetition, type PlayerMock } from '../game-data';
import { ALLSVENSKAN, HANDBOLLSLIGAN } from '../competition/rules';
import { createSave, saveCareerState, type CareerSave } from '../save/saveRepository';
import { createNewCareerState } from './newCareer';
import { migrateCareerState } from './saveMigration';
import type { CareerState } from './types';
import type { TeamTacticalProfile } from './teamTacticalProfile';
import type { GameplayPlayerRating } from '../gameWorld/gameplayRatingSnapshot';
import type { RawClubStaffIdentityLike } from '../staff/staffRosterResolution';
import { ensureCareerCompetitionStaffRoster, recalibrateStaffEmploymentWages } from '../staff/staffCareerIntegration';
import { ensureDivision1PlayerEconomicIdentity } from './division1Integration';
import { ensureWorldPoolPlayerEconomicIdentity } from './worldPoolIntegration';
import { WORLD_POOL_COMPETITION_IDS } from './careerWorld';
import { ensureCareerAllClubEconomies } from '../economy/clubEconomyIntegration';
import { fetchWorldSquads } from './squadSnapshot';

// HM-DATA-DIV1-1.0: Division 1 Norra/Södra clubs/players must exist in
// world state regardless of which competition the manager actually
// plays in ("Division 1-klubbar/spelare ska finnas i world state") --
// unlike every other snapshot on this page, this is never scoped to the
// manager's own competition. Fetched unconditionally (both real-world,
// so this always succeeds once the data exists) and merged into
// worldSquads/gameplayRatings alongside the manager's own competition's
// data. This never triggers a full ClubEconomyBaseline or staff roster
// for these clubs (ensureCareerAllClubEconomies/staff resolution stay
// scoped to getClubsByCompetition(state.competitionId), the manager's
// own competition) -- but division1Integration.ts's
// ensureDivision1PlayerEconomicIdentity DOES give every Division 1
// player a contract (required for Transfers to treat them as a valid
// target), reusing the SAME canonical rating this snapshot fetches.
const DIVISION_1_COMPETITION_IDS = ["se_division1_norra", "se_division1_sodra"] as const;

async function fetchDivision1WorldSquads(): Promise<Record<string, PlayerMock[]>> {
  const snapshots = await Promise.all(DIVISION_1_COMPETITION_IDS.map(fetchWorldSquads));
  return Object.assign({}, ...snapshots);
}

async function fetchDivision1GameplayRatings(): Promise<Record<string, GameplayPlayerRating[]>> {
  const snapshots = await Promise.all(DIVISION_1_COMPETITION_IDS.map(fetchGameplayRatings));
  return Object.assign({}, ...snapshots);
}

// HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: Allsvenskan must be a real
// world participant regardless of which Swedish tier the manager
// actually plays -- the SAME unconditional "always fetch, always merge"
// treatment Division 1 already had (see fetchDivision1WorldSquads
// above). Before this milestone, Allsvenskan's own worldSquads were only
// ever populated when it happened to BE the manager's own competition
// (`club.competitionId === ALLSVENSKAN_COMPETITION_ID`) -- an HBL career
// got zero real Allsvenskan players/economy/recruitment at all.
const ALLSVENSKAN_COMPETITION_ID = "swe-2";
const HANDBOLLSLIGAN_COMPETITION_ID = "se_handbollsligan_herr";

async function fetchAllsvenskanWorldSquads(): Promise<Record<string, PlayerMock[]>> {
  return fetchWorldSquads(ALLSVENSKAN_COMPETITION_ID);
}

async function fetchAllsvenskanGameplayRatings(): Promise<Record<string, GameplayPlayerRating[]>> {
  return fetchGameplayRatings(ALLSVENSKAN_COMPETITION_ID);
}

async function fetchHandbollsliganWorldSquads(): Promise<Record<string, PlayerMock[]>> {
  return fetchWorldSquads(HANDBOLLSLIGAN_COMPETITION_ID);
}

async function fetchHandbollsliganGameplayRatings(): Promise<Record<string, GameplayPlayerRating[]>> {
  return fetchGameplayRatings(HANDBOLLSLIGAN_COMPETITION_ID);
}

// HM-WORLD-PLAYER-POOL-1.0: the 100-player international pool's clubs
// must exist in world state regardless of which competition the manager
// plays -- same unconditional "always fetch, always merge" treatment as
// Division 1 above, across the pool's 16 competitions.
async function fetchWorldPoolWorldSquads(): Promise<Record<string, PlayerMock[]>> {
  const snapshots = await Promise.all(WORLD_POOL_COMPETITION_IDS.map(fetchWorldSquads));
  return Object.assign({}, ...snapshots);
}

async function fetchWorldPoolGameplayRatings(): Promise<Record<string, GameplayPlayerRating[]>> {
  const snapshots = await Promise.all(WORLD_POOL_COMPETITION_IDS.map(fetchGameplayRatings));
  return Object.assign({}, ...snapshots);
}

/**
 * HM-IDENTITY-0.3: mirrors fetchWorldSquads exactly, for the same reason
 * -- the AI-derived TeamTacticalProfile snapshot is resolved server-side
 * (identity data touches the filesystem) and fetched once at career
 * creation. A fetch failure just means no AI-derived tactical
 * preferences for this career, which matchdayAction.ts's existing
 * NEUTRAL-opponent fallback already handles safely.
 */
async function fetchAiTacticalPreferences(competitionId: string, season: string, seasonStartDate: string): Promise<Record<string, TeamTacticalProfile>> {
  try {
    const params = new URLSearchParams({ competitionId, season, seasonStartDate });
    const res = await fetch(`/api/game-world/ai-tactical-preferences-snapshot?${params.toString()}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.aiTacticalPreferences ?? {};
  } catch {
    return {};
  }
}

/**
 * HM-MATCH-RATINGS-0.1: mirrors fetchWorldSquads/fetchAiTacticalPreferences
 * exactly -- the canonical gameplay-ratings snapshot is resolved
 * server-side (the rating pipeline touches the filesystem) and fetched
 * once at career creation. A fetch failure just means no canonical
 * ratings for this career, which playerMatchStrength.ts's own
 * neutral-value fallback already handles safely.
 */
async function fetchGameplayRatings(competitionId: string): Promise<Record<string, GameplayPlayerRating[]>> {
  try {
    const res = await fetch(`/api/game-world/gameplay-ratings-snapshot?competitionId=${encodeURIComponent(competitionId)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.gameplayRatings ?? {};
  } catch {
    return {};
  }
}

/**
 * HM-STAFF-1.0/HM-STAFF-CAREER-1.0: mirrors fetchWorldSquads exactly --
 * the real staff identity snapshot (HM-STAFF-DATA-0.1) is resolved
 * server-side (touches the filesystem) and fetched once, for EVERY
 * REAL_WORLD club in the competition (Part 1: "All staff i alla klubbar
 * ska vara klickbar" -- browsing/recruiting from another club needs its
 * staff too, not only the manager's own). A fetch failure or a club with
 * no identity file just means that club is missing from the result,
 * which resolveClubStaffRoster already treats as "generate the whole
 * roster fictionally" for a non-real-world club, or "genuinely no staff"
 * for a real one (Part 19/20/4) -- never a crash.
 */
async function fetchAllClubsStaffIdentity(competitionId: string): Promise<Record<string, RawClubStaffIdentityLike | null>> {
  try {
    const res = await fetch(`/api/game-world/staff-snapshot?competitionId=${encodeURIComponent(competitionId)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.clubs ?? {};
  } catch {
    return {};
  }
}

export async function getOrCreateCareerState(save: CareerSave, persist = true): Promise<CareerState> {
  if (save.careerState) {
    let migrated = migrateCareerState(save.careerState);
    // HM-STAFF-CAREER-1.0: an existing save may predate this milestone's
    // whole-competition staff resolution (it only ever had its own
    // club's roster) -- migrateCareerState itself can't fetch (it must
    // stay synchronous/fs-free for its own tests), so the top-up happens
    // here, exactly once, the same way career creation itself fetches.
    // ensureCareerCompetitionStaffRoster is a true no-op once every
    // competition club is already present, so this is cheap on every
    // subsequent load.
    // HM-ALPHA3-M10: both playable leagues, not only the manager's own -- a job offer can come from
    // either, and a club taken over mid-session had no staff at all (no assistant, scouts or physio).
    const club = getClub(migrated.playerClubId);
    if (club?.dataSource === "REAL_WORLD") {
      for (const competitionId of [...new Set([migrated.competitionId, HANDBOLLSLIGAN, ALLSVENSKAN])]) {
        if (!getClubsByCompetition(competitionId).some((c) => migrated.staffRoster[c.id] === undefined)) continue;
        const staffIdentityByClub = await fetchAllClubsStaffIdentity(competitionId);
        const fallbackYear = Number(migrated.gameDate.slice(0, 4)) + 2;
        migrated = ensureCareerCompetitionStaffRoster(migrated, competitionId, staffIdentityByClub, fallbackYear);
      }
    }
    migrated = recalibrateStaffEmploymentWages(migrated);
    // HM-DATA-DIV1-1.0: an existing save may predate Division 1 entirely
    // -- top it up exactly once, the same pattern the staff top-up above
    // already uses. Any one known Division 1 clubId is enough to detect
    // whether the whole backfill is still missing.
    if (migrated.worldSquads["se_club_bodens_bk_hf"] === undefined) {
      const div1WorldSquads = await fetchDivision1WorldSquads();
      if (Object.keys(div1WorldSquads).length > 0) {
        const div1GameplayRatings = await fetchDivision1GameplayRatings();
        migrated = {
          ...migrated,
          worldSquads: { ...migrated.worldSquads, ...div1WorldSquads },
          gameplayRatings: { ...migrated.gameplayRatings, ...div1GameplayRatings },
        };
        migrated = ensureDivision1PlayerEconomicIdentity(migrated);
      }
    }
    // HM-WORLD-PLAYER-POOL-1.0: same top-up pattern, for the international
    // pool -- any one known pool clubId is enough to detect a missing backfill.
    if (migrated.worldSquads["ger1-kiel"] === undefined) {
      const worldPoolWorldSquads = await fetchWorldPoolWorldSquads();
      if (Object.keys(worldPoolWorldSquads).length > 0) {
        const worldPoolGameplayRatings = await fetchWorldPoolGameplayRatings();
        migrated = {
          ...migrated,
          worldSquads: { ...migrated.worldSquads, ...worldPoolWorldSquads },
          gameplayRatings: { ...migrated.gameplayRatings, ...worldPoolGameplayRatings },
        };
        migrated = ensureWorldPoolPlayerEconomicIdentity(migrated);
      }
    }
    // HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: an existing save may
    // predate Allsvenskan being an unconditional world participant --
    // same top-up pattern as Division 1 above. A known non-Tumba
    // Allsvenskan clubId is enough to detect whether the backfill is
    // still missing (a Tumba/Allsvenskan career already has every
    // Allsvenskan club from its own original `isRealWorld` fetch).
    if (migrated.worldSquads["swe2-aranas"] === undefined) {
      const [allsvenskanWorldSquads, allsvenskanGameplayRatings] = await Promise.all([
        fetchAllsvenskanWorldSquads(),
        fetchAllsvenskanGameplayRatings(),
      ]);
      if (Object.keys(allsvenskanWorldSquads).length > 0) {
        migrated = {
          ...migrated,
          worldSquads: { ...migrated.worldSquads, ...allsvenskanWorldSquads },
          gameplayRatings: { ...migrated.gameplayRatings, ...allsvenskanGameplayRatings },
        };
      }
    }
    if (migrated.worldSquads["se_club_alingsas_hk"] === undefined) {
      const [hblWorldSquads, hblGameplayRatings] = await Promise.all([
        fetchHandbollsliganWorldSquads(),
        fetchHandbollsliganGameplayRatings(),
      ]);
      if (Object.keys(hblWorldSquads).length > 0) {
        migrated = {
          ...migrated,
          worldSquads: { ...migrated.worldSquads, ...hblWorldSquads },
          gameplayRatings: { ...migrated.gameplayRatings, ...hblGameplayRatings },
        };
      }
    }
    // HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: backfills a
    // ClubEconomyBaseline (Part 14) for any world-active club still
    // missing one -- covers Division 1 clubs from an existing save whose
    // own D1 top-up above ran under the PRE-foundation code (contracts/
    // ratings only, no club economy), and any newly-added Allsvenskan
    // clubs from the top-up just above. Idempotent/fill-only, so this is
    // a cheap no-op on every subsequent load once nothing is missing.
    migrated = ensureCareerAllClubEconomies(migrated);
    if (persist && migrated !== save.careerState) {
      await saveCareerState(save.saveId, migrated);
    }
    return migrated;
  }
  const club = getClub(save.clubId);
  const isRealWorld = club?.dataSource === "REAL_WORLD";
  const [
    worldSquads,
    div1WorldSquads,
    worldPoolWorldSquads,
    allsvenskanWorldSquads,
    allsvenskanGameplayRatings,
    hblWorldSquads,
    hblGameplayRatings,
    aiTacticalPreferences,
    gameplayRatings,
    div1GameplayRatings,
    worldPoolGameplayRatings,
    staffIdentityByClub,
  ] = await Promise.all([
    isRealWorld ? fetchWorldSquads(club.competitionId) : Promise.resolve({}),
    fetchDivision1WorldSquads(),
    fetchWorldPoolWorldSquads(),
    club?.competitionId === ALLSVENSKAN_COMPETITION_ID ? Promise.resolve({}) : fetchAllsvenskanWorldSquads(),
    club?.competitionId === ALLSVENSKAN_COMPETITION_ID ? Promise.resolve({}) : fetchAllsvenskanGameplayRatings(),
    club?.competitionId === HANDBOLLSLIGAN_COMPETITION_ID ? Promise.resolve({}) : fetchHandbollsliganWorldSquads(),
    club?.competitionId === HANDBOLLSLIGAN_COMPETITION_ID ? Promise.resolve({}) : fetchHandbollsliganGameplayRatings(),
    isRealWorld ? fetchAiTacticalPreferences(club.competitionId, "2026/27", GAME_CURRENT_DATE) : Promise.resolve({}),
    isRealWorld ? fetchGameplayRatings(club.competitionId) : Promise.resolve({}),
    fetchDivision1GameplayRatings(),
    fetchWorldPoolGameplayRatings(),
    isRealWorld ? fetchAllClubsStaffIdentity(club.competitionId) : Promise.resolve({}),
  ]);
  const fresh = createNewCareerState(
    save.saveId,
    save.clubId,
    { ...worldSquads, ...hblWorldSquads, ...allsvenskanWorldSquads, ...div1WorldSquads, ...worldPoolWorldSquads },
    aiTacticalPreferences,
    { ...gameplayRatings, ...hblGameplayRatings, ...allsvenskanGameplayRatings, ...div1GameplayRatings, ...worldPoolGameplayRatings },
    staffIdentityByClub,
    save.preseasonStart,
  );
  if (persist) await saveCareerState(save.saveId, fresh);
  return fresh;
}

export function createNewCareerSave(input: Parameters<typeof createSave>[0]): Promise<CareerSave> {
  return createSave(input, draft => getOrCreateCareerState(draft, false));
}
