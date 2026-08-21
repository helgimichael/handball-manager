// Manager-fixture matchday action (HM-GAME-0.3, Spec S13/S23).
//
// The ONLY place the manager's own fixture is simulated. Career Rhythm's
// Daily World Tick (dailyTick.ts) deliberately skips it and emits
// MATCHDAY_READY instead (Spec S11.2/S37.8) -- this function is what the
// existing match-preview screen calls once the manager chooses to
// play/simulate. It reuses the exact same Fast Match Engine call and
// bookkeeping AI fixtures use (matchResultApplication.ts) -- Career
// Rhythm does not recreate match-result logic (Spec S37.15).

import { simulateFixture, type FastMatchResult } from "@handball-manager/game-simulation";
import { getClubStrength } from "../game-data/clubStrength";
import { checkSeasonComplete, getPlayerFixtureOn } from "./calendar";
import { buildMatchCompletedEvent } from "./careerEvents";
import { getCareerSquad } from "./careerWorld";
import { careerEventToInboxMessage } from "./inboxBridge";
import { applyMatchResultBookkeeping } from "./matchResultApplication";
import { buildMatchRoster } from "./tumbaRoster";
import type { CareerState, ClubFormEntry, PlayerSeasonStats } from "./types";

export interface PlayManagerFixtureResult {
  state: CareerState;
  result: FastMatchResult | null;
}

/**
 * Resolves the manager's own fixture for `state.gameDate` (the date
 * Continue stopped on with an unresolved MATCHDAY_READY). Requires an
 * actual unresolved MATCHDAY_READY event for that fixture -- not merely
 * a date match -- so this can never resolve a fixture the Daily World
 * Tick has not actually reached yet (e.g. before the very first
 * CONTINUE press, when `gameDate` still equals the un-ticked season
 * start date). No-ops (returns `result: null`, state unchanged) if that
 * precondition is not met; a safe, idempotent no-op rather than throwing.
 */
export function playManagerFixture(state: CareerState): PlayManagerFixtureResult {
  const fixture = getPlayerFixtureOn(state, state.gameDate);
  if (!fixture) {
    return { state, result: null };
  }
  const matchdayEventId = `MATCHDAY_READY:${fixture.id}`;
  const pendingMatchday = state.careerEvents.find((e) => e.id === matchdayEventId && !e.resolved);
  if (!pendingMatchday) {
    return { state, result: null };
  }

  const roster = buildMatchRoster(getCareerSquad(state), state.playerStatuses);
  const result = simulateFixture(fixture, state.saveSeed, (clubId) => getClubStrength(clubId), (clubId) =>
    clubId === state.playerClubId ? roster : undefined,
  );

  const results: Record<string, FastMatchResult> = { ...state.results, [fixture.id]: result };
  const clubForm: Record<string, ClubFormEntry[]> = { ...state.clubForm };
  const playerSeasonStats: Record<string, PlayerSeasonStats> = { ...state.playerSeasonStats };
  applyMatchResultBookkeeping(result, clubForm, playerSeasonStats, state.playerClubId);

  const careerEvents = state.careerEvents.map((e) => (e.id === matchdayEventId ? { ...e, resolved: true, read: true } : e));
  const matchdayMessageId = `msg:${matchdayEventId}`;
  // The MATCHDAY_READY message's underlying action is genuinely done now
  // (the fixture was actually played/simulated) -- `resolved` flips
  // alongside `actionRequired`, never merely because the message was
  // read (Spec §23/§24: opening Match Preview =/= completing the match).
  const inbox = state.inbox.map((m) => (m.id === matchdayMessageId ? { ...m, read: true, actionRequired: false, resolved: true } : m));

  let next: CareerState = { ...state, results, clubForm, playerSeasonStats, careerEvents, inbox };

  const completedEvent = buildMatchCompletedEvent(fixture.id, fixture.competitionId, state.gameDate);
  if (!next.careerEvents.some((e) => e.id === completedEvent.id)) {
    next = {
      ...next,
      careerEvents: [...next.careerEvents, completedEvent],
      inbox: [...next.inbox, careerEventToInboxMessage(completedEvent, next)],
    };
  }

  next = checkSeasonComplete(next);

  return { state: next, result };
}
