/**
 * MATCH-EXPERIENCE-2.0 M11: deciding when to make a substitution.
 *
 * This is deliberately the SMALLEST autonomous user of the substitution
 * mechanism that proves it works, not a rotation strategy. It has no fatigue
 * model, no tactical attack/defence specialists and no opinion about matchups;
 * those are later milestones. What it does have is three reasons a handball
 * bench actually moves, each read from real match state:
 *
 *   ROTATION           a player has been on for a long stretch, and there is
 *                      somebody fresher of the same kind waiting.
 *   GOALKEEPER_CHANGE  the keeper is changed, and only at a restart, so the
 *                      goal is never left open while somebody jogs on.
 *   AFTER_SUSPENSION   the side is a man down, so the player who has been on
 *                      longest is spelled rather than made to cover for two
 *                      minutes.
 *
 * Substitutions in handball are rolling: they do not need a stoppage. These are
 * therefore taken at a segment boundary and play simply continues -- the
 * incoming man runs on from the substitution area into whatever is happening.
 */
import { outfieldEntitlement, teamOf, type GameFlowState, type MatchTeamId, type SubstitutionRequest } from "./gameFlow";
import type { Player } from "../domain/handball/player";
import type { PossessionRng } from "./possessionRng";

export type SubstitutionReason = "ROTATION" | "GOALKEEPER_CHANGE" | "AFTER_SUSPENSION";

export const SUBSTITUTION_POLICY = Object.freeze({
  /** A player is a rotation candidate after this long on court, in official seconds. */
  rotationAfterSeconds: 420,
  /** At most one change per side per segment, so a team never empties its bench at once. */
  maxPerTeamPerSegment: 1,
  /** How often a keeper change is even considered, in official seconds. */
  goalkeeperChangeAfterSeconds: 900,
  /** Chance of taking an available rotation at any given boundary. */
  rotationChance: 0.35,
});

function squadPlayersOnCourt(flow: GameFlowState, team: MatchTeamId): readonly Player[] {
  return flow.match.handball.players.filter((p) => teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === team);
}

/** The man who has been on longest, of a given kind. Deterministic: ties break on id. */
function longestServing(flow: GameFlowState, team: MatchTeamId, kind: Player["kind"]): Player | undefined {
  return [...squadPlayersOnCourt(flow, team)]
    .filter((p) => p.kind === kind)
    .sort((a, b) => (flow.onCourtSince[a.id] ?? 0) - (flow.onCourtSince[b.id] ?? 0) || a.id.localeCompare(b.id))[0];
}

/** The freshest eligible replacement of a given kind. */
function freshestSubstitute(flow: GameFlowState, team: MatchTeamId, kind: Player["kind"]): Player | undefined {
  return [...flow.bench[team]].filter((p) => p.kind === kind).sort((a, b) => a.id.localeCompare(b.id))[0];
}

export type SubstitutionDecisionContext = {
  /** True when play is restarting from the centre, i.e. the ball is dead and far away. */
  readonly atRestart: boolean;
  /** Which side is about to attack. */
  readonly possessionTeam: MatchTeamId;
};

/**
 * What this side does with its bench at this boundary. Returns at most
 * `maxPerTeamPerSegment` requests, each of which the flow layer still validates
 * before applying -- this layer proposes, it does not mutate.
 */
export function decideSubstitutions(
  flow: GameFlowState,
  team: MatchTeamId,
  context: SubstitutionDecisionContext,
  rng: PossessionRng,
): SubstitutionRequest[] {
  const requests: SubstitutionRequest[] = [];
  if (flow.bench[team].length === 0) return requests;
  // One exchange at a time: while somebody is still walking to the line, this
  // side has nothing more to decide.
  if (flow.pendingSubstitutions.some((pending) => pending.team === team)) return requests;

  // A goalkeeper change is only ever made at a restart: swapping keepers while
  // the ball is live would leave the goal open while he runs on, and empty-goal
  // play is explicitly not part of this milestone.
  // ... and only by the side that is about to attack, so the keeper walking to
  // the line has the length of the court between him and the ball while he
  // goes. His replacement is not on until he is off, so the exchange must not
  // be started with a shot about to arrive.
  if (context.atRestart && team === context.possessionTeam) {
    const keeper = longestServing(flow, team, "GOALKEEPER");
    const reserve = freshestSubstitute(flow, team, "GOALKEEPER");
    if (keeper && reserve && flow.matchSeconds - (flow.onCourtSince[keeper.id] ?? 0) >= SUBSTITUTION_POLICY.goalkeeperChangeAfterSeconds) {
      requests.push({
        team,
        outgoingPlayerId: keeper.id,
        incomingPlayerId: reserve.id,
        reason: "GOALKEEPER_CHANGE",
      });
      return requests;
    }
  }

  const outgoing = longestServing(flow, team, "FIELD_PLAYER");
  const incoming = freshestSubstitute(flow, team, "FIELD_PLAYER");
  if (!outgoing || !incoming) return requests;
  const servedSeconds = flow.matchSeconds - (flow.onCourtSince[outgoing.id] ?? 0);

  // A side that is a man down spells whoever has been out there longest as soon
  // as it can, rather than making him cover the whole two minutes.
  const aManDown = outfieldEntitlement(flow, team) < 6;
  const dueRotation = servedSeconds >= SUBSTITUTION_POLICY.rotationAfterSeconds;
  if (!aManDown && !dueRotation) return requests;
  if (!rng.chance(SUBSTITUTION_POLICY.rotationChance)) return requests;

  requests.push({
    team,
    outgoingPlayerId: outgoing.id,
    incomingPlayerId: incoming.id,
    reason: aManDown ? "AFTER_SUSPENSION" : "ROTATION",
  });
  return requests;
}

/** `home-sub-1 on for defense-defence-6-0-3 (ROTATION)` -- for traces and the dev HUD. */
export function describeSubstitution(record: { incomingPlayerId: string; outgoingPlayerId: string; reason: string; kind: string }): string {
  const what = record.kind === "GOALKEEPER" ? "in goal" : "on";
  return `${record.incomingPlayerId} ${what} for ${record.outgoingPlayerId} (${record.reason})`;
}
