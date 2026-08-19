"use client";

import type { CSSProperties } from "react";
import type { TacticsBoardScene } from "../scene/TacticsBoardScene.ts";
import type { PlayerState } from "./PlayerStateTypes.ts";

type PlayerStateRendererProps = {
  state: PlayerState;
  scene: TacticsBoardScene;
};

export default function PlayerStateRenderer({ state, scene }: PlayerStateRendererProps) {
  const player = scene.objects.find((object) => object.id === state.playerId);
  if (!player || state.type !== "DEFENSIVE_STANCE") {
    return null;
  }

  const { x, y } = player.position;
  const style = {
    "--player-state-stroke": state.style.stroke,
    "--player-state-stroke-width": state.style.strokeWidth,
    "--player-state-opacity": state.style.opacity,
  } as CSSProperties;
  const leftStart = x - state.style.armGap - state.style.armLength;
  const leftEnd = x - state.style.armGap;
  const rightStart = x + state.style.armGap;
  const rightEnd = x + state.style.armGap + state.style.armLength;

  return (
    <g
      aria-label="Defensive Stance"
      style={style}
      fill="none"
      stroke="var(--player-state-stroke)"
      strokeWidth="var(--player-state-stroke-width)"
      strokeLinecap="round"
      opacity="var(--player-state-opacity)"
      pointerEvents="none"
      transform={`rotate(${player.rotation} ${x} ${y})`}
    >
      <line x1={leftStart} y1={y} x2={leftEnd} y2={y} />
      <line x1={rightStart} y1={y} x2={rightEnd} y2={y} />
    </g>
  );
}
