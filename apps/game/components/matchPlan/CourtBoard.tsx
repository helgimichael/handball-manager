"use client";

// HM-TACTICS-1.2 Part 3 / HM-MATCH-1.3B Part E/F/G, redesigned by
// HM-TACTICS-BOARD-1.0 into a compact FM-style marker, and by
// HM-TACTICS-BOARD-1.0A into a full-CELL drop target: the players on
// the court are the primary, clickable AND draggable representation of
// a starting unit -- MasterCourt itself stays a pure visual backdrop
// (unchanged, no FIELD internals touched), and this component overlays
// small circular markers (shirt number + short tactical-position badge)
// on top of it at each slot's canonical grid position.
//
// HM-TACTICS-BOARD-1.0A Part 5/6/8: VISUAL marker and DROP TARGET are
// now separate concerns for every calibrated cell (chip.isCalibratedCell
// / ghost, the default) -- the small circle/number is purely decorative
// content INSIDE a button sized to the entire 2m x 2m canonical cell
// (10% x 5% of the full 20x40m court, a constant derived directly from
// COURT_GRID_DEFINITION, never a hand-tuned CSS hitbox). Dropping
// ANYWHERE inside that rectangle resolves to the SAME cellNumber the
// small circle represents -- "one cell = one target" (Part 8), and the
// player always ends up rendered at the cell's own CENTER regardless of
// where inside the cell the drop happened (Part 9), since the caller
// always re-derives xPct/yPct from the canonical cell center, never from
// the drop's own pointer position. The goalkeeper anchor is the one
// exception (isCalibratedCell: false) -- it has no canonical calibration
// cell (tacticalPositionCalibration.ts explicitly keeps GK out of scope),
// so it keeps the older small circular hit area.
//
// Two interactions, both supported (Part G: "do not remove the current
// useful click interaction"):
//   CLICK a chip -> selects that slot (the caller renders the detailed
//     swap/instruction panel for whichever chip is selected).
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
import { COURT_GRID_DEFINITION } from "@/lib/court/courtGrid";
import MasterCourtDisplay from "./MasterCourtDisplay";

const PLAYER_ID_MIME = "application/x-hm-player-id";

/** Every canonical cell is exactly 2m x 2m -- a constant fraction of the full 20m x 40m court, never re-derived per cell (HM-TACTICS-BOARD-1.0A Part 8). */
const CELL_WIDTH_PCT = (COURT_GRID_DEFINITION.cellWidthMeters / COURT_GRID_DEFINITION.courtWidthMeters) * 100;
const CELL_HEIGHT_PCT = (COURT_GRID_DEFINITION.cellLengthMeters / COURT_GRID_DEFINITION.courtLengthMeters) * 100;

export interface CourtChip {
  key: string;
  xPct: number;
  yPct: number;
  shortLabel: string;
  playerName: string;
  playerId: string;
  shirtNumber: number | null;
  /** HM-TACTICS-BOARD-1.0 Part 3/8: which unified-board half this marker belongs to -- purely a styling hint (border tint) so ATTACK and DEFENCE markers, now shown simultaneously on the one court, stay visually distinguishable at a glance. */
  role: "ATTACK" | "DEFENCE";
  /** Part M: whether this chip's player is currently active in the LIVE match (only meaningful when a live board is shown -- undefined/omitted in the pre-match Tactics workspace, where every starter is simply "assigned"). */
  isLiveActive?: boolean;
  /** HM-TACTICS-BOARD-1.0A Part 5/8: true for every chip positioned at a real canonical calibration cell (the drop hit area expands to the full 2x2m cell) -- false only for the goalkeeper's fixed anchor, which has no calibration cell and keeps the smaller circular hit area. Defaults to true. */
  isCalibratedCell?: boolean;
}

/** HM-COURT-GRID-0.3 Part H: an approved calibrated snap cell with no player currently on it -- rendered as a subtle affordance ("there's another legal position here"), not a full chip. Still a valid drop target (Part F: board player -> empty cell = move), now expanded to the full cell (HM-TACTICS-BOARD-1.0A). */
export interface CourtGhostCell {
  key: string;
  xPct: number;
  yPct: number;
}

const ROLE_ACCENT: Record<CourtChip["role"], string> = {
  ATTACK: "rgba(255, 196, 0, 0.9)",
  DEFENCE: "rgba(94, 180, 255, 0.9)",
};

export default function CourtBoard({
  scene,
  chips,
  ghostCells,
  selectedKey,
  onSelectChip,
  onDropOnSlot,
}: {
  scene: TacticsBoardScene;
  chips: readonly CourtChip[];
  /** Part H: subtle empty-but-legal snap cells, rendered underneath the chips. */
  ghostCells?: readonly CourtGhostCell[];
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
        // HM-COURT-GRID-0.3.1 Part A/K (root cause): MasterCourt's own
        // <svg> uses preserveAspectRatio="xMidYMid meet", which
        // letterboxes whenever this wrapper's REAL rendered aspect
        // ratio doesn't exactly match the scene's viewBox ratio (20:40
        // for FULL_COURT). Locking width+aspect-ratio together (same
        // technique proven correct in /editor/court-grid) makes the
        // wrapper's own box exactly 20:40, so MasterCourt fills it
        // edge-to-edge with zero letterboxing, and chip percentages
        // align perfectly. HM-TACTICS-BOARD-1.0 Part 7: widened from
        // 360px to 460px (more usable desktop workspace) -- the ratio
        // itself, and therefore every projected coordinate, is
        // unaffected by this size change.
        width: "min(460px, 46vh)",
        aspectRatio: "20 / 40",
        margin: "0 auto",
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
        {(ghostCells ?? []).map((ghost) => {
          const dragTarget = ghost.key === dragOverKey;
          return (
            <button
              key={ghost.key}
              type="button"
              aria-label="Ledig godkänd position"
              style={{
                position: "absolute",
                left: `${ghost.xPct}%`,
                top: `${ghost.yPct}%`,
                transform: "translate(-50%, -50%)",
                width: `${CELL_WIDTH_PCT}%`,
                height: `${CELL_HEIGHT_PCT}%`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: dragTarget ? "1px solid var(--hm-accent)" : "none",
                background: dragTarget ? "rgba(255, 196, 0, 0.16)" : "transparent",
                padding: 0,
                cursor: "default",
                transition: "background 100ms ease",
              }}
              onDragOver={(e) => handleDragOver(e, ghost.key)}
              onDragLeave={() => handleDragLeave(ghost.key)}
              onDrop={(e) => handleDrop(e, ghost.key)}
            >
              <span
                style={{
                  width: dragTarget ? 12 : 7,
                  height: dragTarget ? 12 : 7,
                  borderRadius: "50%",
                  border: dragTarget ? "2px solid var(--hm-accent)" : "1px dashed rgba(226, 245, 238, 0.4)",
                  background: dragTarget ? "rgba(255,255,255,0.18)" : "rgba(226, 245, 238, 0.06)",
                  pointerEvents: "none",
                  transition: "all 100ms ease",
                }}
              />
            </button>
          );
        })}
        {chips.map((chip) => {
          const selected = chip.key === selectedKey;
          const dragTarget = chip.key === dragOverKey;
          const inactive = chip.isLiveActive === false;
          const accent = ROLE_ACCENT[chip.role];
          const fullCell = chip.isCalibratedCell !== false;
          const outerStyle: CSSProperties = {
            position: "absolute",
            left: `${chip.xPct}%`,
            top: `${chip.yPct}%`,
            transform: "translate(-50%, -50%)",
            width: fullCell ? `${CELL_WIDTH_PCT}%` : 28,
            height: fullCell ? `${CELL_HEIGHT_PCT}%` : 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: fullCell ? (dragTarget ? "1px solid var(--hm-accent)" : "none") : undefined,
            background: fullCell ? (dragTarget ? "rgba(255, 196, 0, 0.16)" : "transparent") : undefined,
            padding: 0,
            cursor: "grab",
            transition: "background 100ms ease",
          };
          const markerStyle: CSSProperties = {
            position: "relative",
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: selected ? "var(--hm-accent)" : dragTarget ? "var(--hm-surface-3, var(--hm-surface-2))" : "var(--hm-surface-2)",
            color: selected ? "#fff" : "var(--hm-text-primary)",
            border: `2px solid ${selected ? "#fff" : dragTarget ? "var(--hm-accent)" : accent}`,
            fontSize: 11,
            fontWeight: 700,
            boxShadow: selected ? "0 0 0 3px rgba(255,255,255,0.2), 0 1px 4px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.4)",
            opacity: inactive ? 0.45 : 1,
            transform: dragTarget ? "scale(1.15)" : undefined,
            transition: "transform 100ms ease, background 100ms ease",
            pointerEvents: "none",
          };
          return (
            <button key={chip.key} type="button" style={outerStyle} draggable title={`${chip.playerName} · ${chip.shortLabel}`} onDragStart={(e) => handleDragStart(e, chip)} onDragOver={(e) => handleDragOver(e, chip.key)} onDragLeave={() => handleDragLeave(chip.key)} onDrop={(e) => handleDrop(e, chip.key)} onClick={() => onSelectChip(chip.key)}>
              <span style={markerStyle}>
                {chip.shirtNumber ?? "?"}
                <span
                  style={{
                    position: "absolute",
                    bottom: -6,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 8,
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: "1px 3px",
                    borderRadius: 4,
                    background: accent,
                    color: "#0e2e27",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {chip.shortLabel}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Part E: the drag-source MIME type MatchSquadPanel's bench rows must use so a drop onto CourtBoard resolves the right player -- exported so both sides share one literal, never two independently-typed strings that could silently drift apart. */
export { PLAYER_ID_MIME };
