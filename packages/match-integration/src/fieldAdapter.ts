/**
 * Renderer adapter (MatchRenderSnapshot -> FIELD scene representation).
 *
 * The only file in this package allowed to import
 * @handball-manager/match-renderer. It must never import
 * @handball-manager/handball-engine -- see simAdapter.ts for the mirror
 * restriction. FIELD components (MasterCourt, BoardObjectRenderer, etc.)
 * are never taught about HandballState; they only ever see the
 * BoardObject[]/TacticsBoardScene shapes they already understood before
 * this bridge existed.
 */

import {
  createBoardObject,
  type BoardObject,
  type BoardObjectType,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/BoardObject.ts";
import {
  createInitialScene,
  type TacticsBoardScene,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import type {
  MatchBallRenderState,
  MatchPlayerRenderState,
  MatchRenderSnapshot,
} from "@handball-manager/match-contract";

/**
 * FIELD's BoardObjectType is a closed union of five values ("ATTACKER" |
 * "DEFENDER" | "GOALKEEPER" | "BALL" | "CONE"). The neutral contract
 * only ever produces "FIELD_PLAYER" (see simAdapter.ts's mapKind -- SIM
 * has no goalkeeper entity) for both sides, so this function's
 * GOALKEEPER branch exists for forward compatibility with a future
 * snapshot producer that DOES emit kind "GOALKEEPER" (per
 * ADAPTER_BOUNDARY.md), not because today's bridge exercises it. CONE is
 * a FIELD-only training-diagram concept with no equivalent anywhere in
 * the contract and is intentionally unreachable from this function.
 */
function boardObjectTypeForPlayer(player: MatchPlayerRenderState): BoardObjectType {
  if (player.kind === "GOALKEEPER") {
    return "GOALKEEPER";
  }
  return player.side === "ATTACK" ? "ATTACKER" : "DEFENDER";
}

function playerToBoardObject(player: MatchPlayerRenderState): BoardObject {
  return createBoardObject({
    id: player.id,
    type: boardObjectTypeForPlayer(player),
    position: { x: player.x, y: player.y },
    rotation: player.orientationDegrees ?? 0,
    ...(player.roleLabel !== undefined ? { label: player.roleLabel } : {}),
  });
}

function ballToBoardObject(ball: MatchBallRenderState): BoardObject {
  return createBoardObject({
    id: "ball",
    type: "BALL",
    position: { x: ball.x, y: ball.y },
    rotation: 0,
  });
}

/**
 * Converts one MatchRenderSnapshot into the BoardObject[] FIELD's
 * MasterCourt/BoardObjectRenderer already know how to draw.
 */
export function snapshotToBoardObjects(snapshot: MatchRenderSnapshot): BoardObject[] {
  return [...snapshot.players.map(playerToBoardObject), ballToBoardObject(snapshot.ball)];
}

/**
 * Convenience wrapper building a full TacticsBoardScene (via FIELD's own
 * verbatim-ported createInitialScene) from one snapshot, for callers
 * that want a ready-to-render scene rather than a bare object list.
 */
export function snapshotToScene(snapshot: MatchRenderSnapshot): TacticsBoardScene {
  // The snapshot's own court view must reach the scene: createInitialScene
  // defaults to HALF_COURT, which is right for a tactics-board exercise but
  // wrong for a match. A full-court match rendered on a half-court viewport
  // would simply hide everything happening at the far goal.
  return createInitialScene({ objects: snapshotToBoardObjects(snapshot), courtView: snapshot.court.view });
}
