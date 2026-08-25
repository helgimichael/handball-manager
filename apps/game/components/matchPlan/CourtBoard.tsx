"use client";

// HM-TACTICS-1.2 Part 3 / HM-MATCH-1.3B Part E/F/G: the players on the
// court are the primary, clickable AND draggable representation of a
// starting unit -- MasterCourt itself stays a pure visual backdrop
// (unchanged, no FIELD internals touched), and this component overlays
// simple absolutely-positioned chips (see courtLayout.ts) on top of it
// at each slot's approximate handball position.
//
// Two interactions, both supported (Part G: "do not remove the current
// useful click interaction"):
//   CLICK a chip -> selects that slot (StartingUnitEditor renders the
//     detailed swap/instruction panel for whichever chip is selected).
//   DRAG a chip onto another slot (or drag a bench row from
//     MatchSquadPanel onto a slot) -> `onDropOnSlot` fires with the
//     target slot's key and the dragged player's id; the caller
//     resolves the actual swap/replace via the SAME pure
//     matchPlanEdits.ts functions the dropdown already used (Part F:
//     those functions already implement "swap if both assigned,
//     replace-and-bench if not" -- no new domain logic here).
//
// Native HTML5 drag/drop (no new dependency -- confirmed none exists in
// this workspace) works across the CourtBoard/MatchSquadPanel component
// boundary for free: `dataTransfer` carries the dragged playerId, so a
// bench row in a sibling component can be a valid drag source without
// any shared React state.
import { useState, type CSSProperties, type DragEvent } from "react";
import type { TacticsBoardScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import MasterCourtDisplay from "./MasterCourtDisplay";

const PLAYER_ID_MIME = "application/x-hm-player-id";

export interface CourtChip {
  key: string;
  xPct: number;
  yPct: number;
  shortLabel: string;
  playerName: string;
  playerId: string;
  /** Part M: whether this chip's player is currently active in the LIVE match (only meaningful when a live board is shown -- undefined/omitted in the pre-match Tactics workspace, where every starter is simply "assigned"). */
  isLiveActive?: boolean;
}

export default function CourtBoard({
  scene,
  chips,
  selectedKey,
  onSelectChip,
  onDropOnSlot,
}: {
  scene: TacticsBoardScene;
  chips: readonly CourtChip[];
  selectedKey: string | null;
  onSelectChip: (key: string) => void;
  /** Part E/F: fires on a completed drag/drop -- `targetKey` is the slot dropped onto, `draggedPlayerId` is whoever was dragged (from another slot, or from the MatchSquad bench). Omit to make the board click-only. */
  onDropOnSlot?: (targetKey: string, draggedPlayerId: string) => void;
}) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function handleDragStart(e: DragEvent<HTMLButtonElement>, chip: CourtChip) {
    e.dataTransfer.setData(PLAYER_ID_MIME, chip.playerId);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: DragEvent<HTMLButtonElement>, key: string) {
    if (!onDropOnSlot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== key) setDragOverKey(key);
  }
  function handleDragLeave(key: string) {
    if (dragOverKey === key) setDragOverKey(null);
  }
  function handleDrop(e: DragEvent<HTMLButtonElement>, key: string) {
    if (!onDropOnSlot) return;
    e.preventDefault();
    setDragOverKey(null);
    const draggedPlayerId = e.dataTransfer.getData(PLAYER_ID_MIME);
    if (draggedPlayerId) onDropOnSlot(key, draggedPlayerId);
  }

  return (
    <div
      className="hm-court-backdrop"
      style={{
        position: "relative",
        height: 520,
        borderRadius: "var(--hm-radius-sm)",
        overflow: "hidden",
        // HM-MATCH-1.3B2 Part 9 (root cause, confirmed via computed
        // styles): MasterCourt's own CSS module paints the floor/goal-
        // area/court-boundary-and-arc lines entirely from two CSS custom
        // properties -- `--ds-color-surface` (floor fill) and
        // `--ds-color-text` (every line's stroke) -- that this app never
        // defined anywhere in the render tree. With both undefined, fill
        // resolved to black and stroke resolved to `none`, i.e. a
        // genuinely invisible court, not merely low-contrast. FIELD's own
        // reference consumers (apps/field-smoke-test, apps/match-demo)
        // supply these by spreading their `designSystemTheme` object; HM
        // instead sets its OWN dark green/teal values directly here
        // (Part 9: "dark HM styling, but clearly visible... not a bright
        // arcade style") -- no FIELD internals touched, this is a plain
        // CSS custom-property handoff on the wrapper element.
        "--ds-color-surface": "#0e2e27",
        "--ds-color-text": "rgba(226, 245, 238, 0.82)",
      } as CSSProperties}
    >
      <MasterCourtDisplay scene={scene} />
      <div style={{ position: "absolute", inset: 0 }}>
        {chips.map((chip) => {
          const selected = chip.key === selectedKey;
          const dragTarget = chip.key === dragOverKey;
          const inactive = chip.isLiveActive === false;
          const style: CSSProperties = {
            position: "absolute",
            left: `${chip.xPct}%`,
            top: `${chip.yPct}%`,
            transform: `translate(-50%, -50%) scale(${dragTarget ? 1.1 : 1})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            lineHeight: 1.1,
            background: selected ? "var(--hm-accent)" : dragTarget ? "var(--hm-surface-3, var(--hm-surface-2))" : "var(--hm-surface-2)",
            color: selected ? "#fff" : "var(--hm-text-primary)",
            border: dragTarget ? "2px solid var(--hm-accent)" : "1px solid var(--hm-border)",
            borderRadius: 999,
            padding: "3px 8px",
            fontSize: "var(--hm-text-2xs)",
            cursor: "grab",
            whiteSpace: "nowrap",
            boxShadow: selected ? "0 0 0 3px rgba(255,255,255,0.15), 0 1px 4px rgba(0,0,0,0.35)" : "0 1px 4px rgba(0,0,0,0.35)",
            opacity: inactive ? 0.45 : 1,
            transition: "transform 100ms ease, background 100ms ease",
          };
          return (
            <button
              key={chip.key}
              type="button"
              style={style}
              draggable
              onDragStart={(e) => handleDragStart(e, chip)}
              onDragOver={(e) => handleDragOver(e, chip.key)}
              onDragLeave={() => handleDragLeave(chip.key)}
              onDrop={(e) => handleDrop(e, chip.key)}
              onClick={() => onSelectChip(chip.key)}
            >
              <span style={{ opacity: 0.75, fontSize: 9 }}>{chip.shortLabel}</span>
              <span style={{ fontWeight: 600 }}>{chip.playerName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Part E: the drag-source MIME type MatchSquadPanel's bench rows must use so a drop onto CourtBoard resolves the right player -- exported so both sides share one literal, never two independently-typed strings that could silently drift apart. */
export { PLAYER_ID_MIME };
