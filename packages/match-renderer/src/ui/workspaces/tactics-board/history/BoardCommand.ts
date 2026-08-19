import type { Dispatch, SetStateAction } from "react";
import type { MeterPoint } from "../geometry/CourtTransform.ts";
import type { TacticsBoardScene } from "../scene/TacticsBoardScene.ts";

export type CommandOrigin = "USER" | "AI" | "IMPORT" | "TEMPLATE" | "REMOTE";

export type CommandMetadata = {
  id: string;
  label: string;
  timestamp: number;
  origin: CommandOrigin;
};

export type BoardContext = {
  getScene: () => TacticsBoardScene;
  setScene: Dispatch<SetStateAction<TacticsBoardScene>>;
  getActiveFormationId: () => string | null;
  setActiveFormationId: Dispatch<SetStateAction<string | null>>;
  getPathDraftAnchors: () => readonly MeterPoint[] | null;
  setPathDraftAnchors: Dispatch<SetStateAction<readonly MeterPoint[] | null>>;
};

export interface BoardCommand {
  readonly metadata: CommandMetadata;
  execute(context: BoardContext): void;
  undo(context: BoardContext): void;
  redo(context: BoardContext): void;
}

let commandCounter = 0;

export function createCommandMetadata(label: string, origin: CommandOrigin = "USER"): CommandMetadata {
  commandCounter += 1;
  return {
    id: `board-command-${commandCounter}`,
    label,
    timestamp: Date.now(),
    origin,
  };
}
