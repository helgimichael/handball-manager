// HM-TACTICS-1.1: bridges the CAREER layer's older `PlayerMock`/
// `HandballPosition` squad data into HM-TACTICS-1.0's own `Position`
// vocabulary. Deliberately its own module, not a change to
// lib/rating/pipeline/evidenceCollection.ts's `mapPrimaryPosition`
// (that function serves the rating pipeline for a different real-world
// data source and its own documented 1:1 behavior must stay intact).
//
// `Position` (lib/rating/types.ts) has no separate pivot code -- pivot
// play is represented via the M6 ("Mittsexa") position plus attack
// roles like OFFENSIVE_PIVOT, not a 7th position value. The older
// `HandballPosition` vocabulary's "PV" is therefore mapped onto "M6" --
// a deliberate, documented, provisional choice (the same kind of
// one-off rename `mapPrimaryPosition` already makes for "MV" -> "GK"),
// not a claim that the two concepts are identical.
import type { HandballPosition, PlayerMock } from "../game-data/types";
import type { MatchSquad, Position } from "./types";
import { MATCH_SQUAD_MAX_PLAYERS } from "./types";

const HANDBALL_POSITION_MAP: Record<HandballPosition, Position> = {
  MV: "GK",
  V9: "V9",
  V6: "V6",
  M9: "M9",
  M6: "M6",
  H9: "H9",
  H6: "H6",
  PV: "M6",
};

export function mapHandballPositionToMatchPlanPosition(position: HandballPosition): Position {
  return HANDBALL_POSITION_MAP[position];
}

export interface SelectablePlayer {
  playerId: string;
  fullName: string;
  shirtNumber: number | null;
  position: Position;
  /** The player's own original HandballPosition label, for display (e.g. "PV" reads as "Pivot" even though it maps onto M6 for MatchPlan purposes). */
  handballPosition: HandballPosition;
}

/** Maps the manager's full club squad (PlayerMock[]) into the shape the Tactics workspace needs to offer for selection -- every player, not just current starters/Förstaval, so the manager can freely build a 16-player MatchSquad. */
export function toSelectablePlayers(squad: readonly PlayerMock[]): SelectablePlayer[] {
  return squad.map((p) => ({
    playerId: p.id,
    fullName: `${p.firstName} ${p.lastName}`,
    shirtNumber: p.shirtNumber,
    position: mapHandballPositionToMatchPlanPosition(p.position),
    handballPosition: p.position,
  }));
}

const SQUAD_STATUS_PRIORITY: Record<PlayerMock["squadStatus"], number> = {
  Förstaval: 0,
  Rotation: 1,
  Ungdom: 2,
  Skadad: 3,
  Avstängd: 3,
};

/**
 * Deterministic initial 16-player selection for a fixture that has no
 * saved MatchSquad yet -- prefers Förstaval, then Rotation, then
 * everyone else, in the squad's own existing array order (never CA,
 * never random). Always includes a goalkeeper first when one exists.
 * Purely a starting point for the Tactics workspace; the manager can
 * freely change every player afterwards.
 */
export function buildInitialMatchSquad(squad: readonly PlayerMock[], fixtureId: string, clubId: string): MatchSquad {
  const sorted = [...squad].sort((a, b) => SQUAD_STATUS_PRIORITY[a.squadStatus] - SQUAD_STATUS_PRIORITY[b.squadStatus]);
  const goalkeeper = sorted.find((p) => p.position === "MV");
  const rest = sorted.filter((p) => p !== goalkeeper);
  const chosen = (goalkeeper ? [goalkeeper, ...rest] : rest).slice(0, MATCH_SQUAD_MAX_PLAYERS);
  return { fixtureId, clubId, players: chosen.map((p) => ({ playerId: p.id, position: mapHandballPositionToMatchPlanPosition(p.position) })) };
}
