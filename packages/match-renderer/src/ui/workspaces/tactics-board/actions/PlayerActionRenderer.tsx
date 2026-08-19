"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { TacticsBoardScene } from "../scene/TacticsBoardScene.ts";
import { defaultSpatialEngine } from "../spatial/SpatialEngine.ts";
import type { PlayerAction } from "./PlayerActionTypes.ts";

type PlayerActionRendererProps = {
  action: PlayerAction;
  scene: TacticsBoardScene;
  onScreenPointerDown?: (event: ReactPointerEvent<SVGGElement>, action: PlayerAction) => void;
};

export default function PlayerActionRenderer({ action, scene, onScreenPointerDown }: PlayerActionRendererProps) {
  const resolvedPlayer = defaultSpatialEngine.resolveAnchorPoint(action.playerAnchor, { scene });
  const resolvedScreen = defaultSpatialEngine.resolveAnchorPoint(action.screenAnchor, { scene });
  const start = resolvedPlayer.position;
  const end = resolvedScreen.position;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 };
  const perpendicular = { x: -direction.y, y: direction.x };
  const halfBar = action.style.symbolWidth / 2;
  const symbolDepth = action.style.symbolDepth;
  const barStart = {
    x: end.x - perpendicular.x * halfBar,
    y: end.y - perpendicular.y * halfBar,
  };
  const barEnd = {
    x: end.x + perpendicular.x * halfBar,
    y: end.y + perpendicular.y * halfBar,
  };
  const symbolBack = {
    x: end.x - direction.x * symbolDepth,
    y: end.y - direction.y * symbolDepth,
  };
  const wingBack = symbolDepth * 0.9;
  const leftWing = {
    x: end.x - direction.x * wingBack - perpendicular.x * halfBar,
    y: end.y - direction.y * wingBack - perpendicular.y * halfBar,
  };
  const rightWing = {
    x: end.x - direction.x * wingBack + perpendicular.x * halfBar,
    y: end.y - direction.y * wingBack + perpendicular.y * halfBar,
  };
  const style = {
    "--player-action-stroke": action.style.stroke,
    "--player-action-stroke-width": action.style.strokeWidth,
    "--player-action-opacity": action.style.opacity,
  } as CSSProperties;

  if (action.type !== "SCREEN" && action.type !== "GOALKEEPER_LUNGE") {
    return null;
  }

  return (
    <g
      aria-label={action.type === "SCREEN" ? "Screen" : "Goalkeeper Lunge"}
      style={style}
      fill="none"
      stroke="var(--player-action-stroke)"
      strokeWidth="var(--player-action-stroke-width)"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="var(--player-action-opacity)"
      pointerEvents="none"
    >
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      {action.type === "SCREEN" ? (
        <g pointerEvents={onScreenPointerDown ? "visibleStroke" : "none"} onPointerDown={(event) => onScreenPointerDown?.(event, action)}>
          <line x1={barStart.x} y1={barStart.y} x2={barEnd.x} y2={barEnd.y} />
          <line x1={symbolBack.x} y1={symbolBack.y} x2={end.x} y2={end.y} />
        </g>
      ) : (
        <g pointerEvents={onScreenPointerDown ? "visibleStroke" : "none"} onPointerDown={(event) => onScreenPointerDown?.(event, action)}>
          <line x1={leftWing.x} y1={leftWing.y} x2={end.x} y2={end.y} />
          <line x1={rightWing.x} y1={rightWing.y} x2={end.x} y2={end.y} />
          <line x1={symbolBack.x} y1={symbolBack.y} x2={end.x} y2={end.y} />
        </g>
      )}
    </g>
  );
}
