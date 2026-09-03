// HM-PLAYER-CONTRACT-LIFECYCLE-1.0: the canonical contract-expiry ->
// free-agency world rule. Closes the exact gap the CPU market audits
// found: a contract could report ContractStatus "FREE_AGENT" (pure date
// math, contractLifecycle.ts) without the player ever actually LEAVING
// their old club's worldSquads array -- a ghost-ownership state where
// the world claims "unattached" but every other system still sees them
// as that club's player.
//
// CANONICAL FREE-AGENT REPRESENTATION (Part 2, audited first): the
// codebase already has exactly ONE generic mechanism for "which club is
// this player at" -- `PlayerMock.clubId` + the club-keyed
// `worldSquads`/`gameplayRatings` Records, both plain `Record<string, T>`
// with NO constraint that keys must be real catalog Club ids (confirmed:
// `getCareerPlayer` already scans every key in `worldSquads` generically,
// `getCareerPlayerRating` already falls back to a full scan when its
// `clubId` argument is falsy). Reusing "" (FREE_AGENT_CLUB_ID) as a
// reserved, non-catalog key is therefore a genuine REUSE of existing
// architecture, not a new store: no new CareerState field, no cloned
// player entity, and -- because "" is never a `Club.id` in the game-data
// catalog and `getClub("")` always resolves to `undefined` -- never a
// "fake club" either (nothing anywhere can mistake it for a real,
// selectable club; `getClubsByCompetition`/`getExternalCandidateClubs`
// never surface it, since they only ever enumerate the real catalog).
// Movement reuses transferExecution.ts's `transferPlayerPermanently`
// completely unmodified (Part 1: "Återanvänd existing ownership/movement
// helpers") -- a release is simply "a permanent move to clubId=''", and a
// free-agent signing is simply "a permanent move FROM clubId=''" -- both
// already fall through the SAME canonical ownership guard 1.0B built.
import { getCareerPlayer } from "./careerWorld";
import { getPlayerContract, getPlayerContractStatus } from "../economy/contractIntegration";
import { transferPlayerPermanently } from "../transfers/transferExecution";
import { endActivePlacementForPlayer } from "./playerPlacements";
import type { PlayerMock } from "../game-data";
import type { CareerState } from "./types";

/** The reserved, non-catalog worldSquads/gameplayRatings key for "no club" -- see this module's own header doc for why this is a genuine reuse, not a new store. */
export const FREE_AGENT_CLUB_ID = "";

export function isFreeAgentClubId(clubId: string): boolean {
  return clubId === FREE_AGENT_CLUB_ID;
}

/**
 * The reserved, non-catalog worldSquads/gameplayRatings key for "retired" --
 * the sibling of FREE_AGENT_CLUB_ID above, and the reason both live here:
 * this module's own contract-expiry sweep has to be able to tell the two
 * apart, and importing it from playerLifecycle.ts (which already imports this
 * module) would be a cycle. playerLifecycle.ts re-exports both names, so
 * every existing importer is unaffected.
 */
export const RETIRED_CLUB_ID = "retired";

export function isRetiredClubId(clubId: string): boolean {
  return clubId === RETIRED_CLUB_ID;
}

/** Every player currently unattached -- the free-agent pool, for recruitment/UI candidate scanning. */
export function getFreeAgents(state: CareerState): readonly PlayerMock[] {
  return state.worldSquads[FREE_AGENT_CLUB_ID] ?? [];
}

/**
 * Part 1/2/9/10: the ONE function that actually enacts an expired
 * contract. Idempotent (a no-op if the player is already a free agent --
 * checked BEFORE calling `transferPlayerPermanently`, whose own
 * ownership guard would otherwise silently no-op anyway, but this makes
 * the idempotency explicit and cheap). Reuses `transferPlayerPermanently`
 * with `toClubId=FREE_AGENT_CLUB_ID`, `newWageEurPerMonth=0` (no
 * employer, no wage), and the contract's OWN already-past
 * `contractEndDate` left unchanged (the real historical fact of when
 * they left -- `getContractStatus` keeps reporting FREE_AGENT correctly
 * forever after with zero new status vocabulary). This one call already
 * correctly handles an on-loan player too: `player.clubId` resolves to
 * wherever they PHYSICALLY are right now (the borrowing club during an
 * active loan, per `loanPlayerOut`'s own reassignment), so the release
 * removes them from THAT squad -- exactly right, since the loan's own
 * authority came from the now-expired parent contract.
 */
export function releasePlayerToFreeAgency(state: CareerState, playerId: string, date: string): CareerState {
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player || !contract || isFreeAgentClubId(player.clubId)) return state;

  const departingClubId = player.clubId;
  let next = transferPlayerPermanently(state, playerId, departingClubId, FREE_AGENT_CLUB_ID, 0, contract.contractEndDate);
  if (next === state) return state; // defensive -- the ownership guard declined (shouldn't happen given the check above).

  // Part 9: the contract that authorized any active loan no longer
  // exists -- deactivate it deterministically rather than leave a stale
  // `active: true` record pointing at a parent club that no longer owns
  // this player. Ownership itself was already resolved correctly above
  // (the player left whichever squad they were PHYSICALLY in).
  for (const loan of Object.values(next.loans)) {
    if (loan.active && loan.playerId === playerId) {
      next = { ...next, loans: { ...next.loans, [loan.id]: { ...loan, active: false } } };
    }
  }

  // Part 10: a placement is not an ownership transfer -- the parent club
  // losing the player entirely means the placement can't continue
  // either. Reuses the exact same "EXPIRED" outcome playerPlacements.ts
  // already uses when the underlying relationship (there: the
  // ClubPartnership) ends -- here the underlying relationship is the
  // employment contract itself.
  next = endActivePlacementForPlayer(next, playerId, date, "EXPIRED");

  return next;
}

export interface ContractDeparture {
  playerId: string;
  fromClubId: string;
}

/**
 * dailyTick.ts step-5 hook, called BEFORE progressDailyTransfers (Part 8:
 * "kontrollera aktiva transfer states" -- if a PERMANENT offer is still
 * AGREED_AWAITING_WINDOW for a player whose contract expires today, this
 * ordering makes progressDailyTransfers see the ALREADY-updated
 * ownership (clubId="") on the very same day, so its own 1.0B stale-
 * offer guard correctly cancels the offer as CANCELLED_STALE instead of
 * ever executing a move for a club that no longer owns the player --
 * zero new merge logic needed, the existing canonical guard already
 * covers this case for free).
 *
 * Part 5: this is a WORLD RULE, not a CPU action -- iterates every club
 * currently present in `worldSquads` (the manager's own club included,
 * every CPU rival, Division 1, World Pool -- whichever this career
 * actually populated), never gated by `cpuRecruiterClubIds`. A cheap
 * per-player status check (pure date math, no lookups) makes a full
 * daily sweep safe at real-world player counts.
 */
export function progressContractExpiry(state: CareerState, date: string): { state: CareerState; departures: ContractDeparture[] } {
  let next = state;
  const departures: ContractDeparture[] = [];

  for (const clubId of Object.keys(next.worldSquads)) {
    if (isFreeAgentClubId(clubId)) continue; // the free-agent pool itself has no "expiry" to process.
    // HM-PLAYER-DEVELOPMENT-2.0 PHASE 1A: retirement is TERMINAL. retirePlayer
    // deliberately sets contractEndDate to the retirement date so no reader
    // still reports a retired player as UNDER_CONTRACT -- which also makes
    // their contract read as expired here. Without this guard the sweep
    // released them to free agency, CPU recruitment re-signed them, and
    // retirement never removed anyone from the world: a 5-season trace showed
    // 43 executed retirements and 0 permanent exits. The retired sentinel is
    // not a club with expiring contracts; it is the exit.
    if (isRetiredClubId(clubId)) continue;
    const squad = next.worldSquads[clubId] ?? [];
    for (const player of squad) {
      if (getPlayerContractStatus(next, player.id) !== "FREE_AGENT") continue;
      const before = next;
      next = releasePlayerToFreeAgency(next, player.id, date);
      if (next !== before) departures.push({ playerId: player.id, fromClubId: clubId });
    }
  }

  return { state: next, departures };
}
