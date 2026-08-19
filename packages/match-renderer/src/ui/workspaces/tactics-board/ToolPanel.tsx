"use client";

import { useState } from "react";
import ObjectTypePreview from "./ObjectTypePreview.tsx";
import ToolPanelSection from "./ToolPanelSection.tsx";
import type { BoardObjectType } from "./scene/BoardObject.ts";
import {
  getPlacementObjectInput,
  isAreaTool,
  isDrawingTool,
  isPlacementTool,
  type AreaToolId,
  type PlacementToolId,
} from "./pointerInteraction.ts";
import { DRAWING_PRESETS } from "./drawing/drawingPresets.ts";
import type { DrawingIntent } from "./drawing/DrawingObject.ts";
import type { ToolId } from "./MasterCourt";
import styles from "./ToolPanel.module.css";

// One button per registry entry -- adding a future drawing tool (Passning,
// Skott, ...) to DRAWING_PRESETS is the ONLY change needed here; no new
// JSX per tool.
const DRAWING_TOOLS = Object.keys(DRAWING_PRESETS) as DrawingIntent[];

type ObjectToolDefinition = {
  toolId: PlacementToolId;
  type: BoardObjectType;
  label: string;
  shortcutKey: string;
};

// Labels only -- shape and color are read directly from
// BOARD_OBJECT_DEFINITIONS (the same registry MasterCourt/
// BoardObjectRenderer use), so the tool panel's swatches can never drift
// out of sync with what actually gets placed on the court. shortcutKey
// matches the keyboard shortcut wired in TacticsBoardWorkspace.tsx (and
// documented in the Kortkommandon section below).
const OBJECT_TOOLS: readonly ObjectToolDefinition[] = [
  { toolId: "ATTACKER", type: "ATTACKER", label: "Anfallare", shortcutKey: "A" },
  { toolId: "DEFENDER", type: "DEFENDER", label: "Försvarare", shortcutKey: "F" },
  { toolId: "GOALKEEPER", type: "GOALKEEPER", label: "Målvakt", shortcutKey: "M" },
  { toolId: "BALL", type: "BALL", label: "Boll", shortcutKey: "B" },
  { toolId: "CONE_ORANGE", type: "CONE", label: "Orange Cone", shortcutKey: "-" },
  { toolId: "CONE_YELLOW", type: "CONE", label: "Yellow Cone", shortcutKey: "-" },
];

const OBJECT_TOOL_LABELS: Record<PlacementToolId, string> = OBJECT_TOOLS.reduce(
  (labels, tool) => ({ ...labels, [tool.toolId]: tool.label }),
  {} as Record<PlacementToolId, string>,
);
// Drawing Engine UX Refactor -- exactly one glyph per tactical meaning
// now (was one per straight/curved pair), shared by BOTH the Ritverktyg
// button and ActiveToolSummary (a single source of truth, never two
// separate icon choices for the same tool). "Ikonerna ska tydligt visa:
// spelarrörelse / bollpassning / skott" -- a squiggly motion arrow for
// Rörelse (geometry-neutral: reads the same whether the coach ends up
// drawing it straight or curved), a lighter/dashed-reading arrow for
// Passning, a bold arrowhead for Skott. Color additionally distinguishes
// the three (see drawingPresets.ts).
const DRAWING_TOOL_ICONS: Record<DrawingIntent, string> = {
  PLAYER_MOVEMENT: "↝",
  PASS: "⇢",
  SHOT: "➤",
};

// Spatial Engine Epic I, Del 2 -- one entry per Area tool, same
// label+icon shape as OBJECT_TOOLS/DRAWING_TOOL_ICONS above. Exactly two
// tools today (Rectangle Area, Polygon Area), so a small local array
// (not a registry file like drawingPresets.ts) is proportionate -- see
// area/AreaObject.ts's DEFAULT_RECTANGLE_AREA_STYLE/
// DEFAULT_POLYGON_AREA_STYLE doc comment for the per-kind default colors --
// still no full per-tool style registry, just a two-way pick on
// geometry.kind.
type AreaToolDefinition = { type: AreaToolId; label: string; icon: string };
const AREA_TOOLS: readonly AreaToolDefinition[] = [
  { type: "AREA_RECTANGLE", label: "Rektangel", icon: "▭" },
  { type: "AREA_POLYGON", label: "Polygon", icon: "⬠" },
];

const AREA_TOOL_LABELS: Record<AreaToolId, string> = AREA_TOOLS.reduce(
  (labels, tool) => ({ ...labels, [tool.type]: tool.label }),
  {} as Record<AreaToolId, string>,
);
const AREA_TOOL_ICONS: Record<AreaToolId, string> = AREA_TOOLS.reduce(
  (icons, tool) => ({ ...icons, [tool.type]: tool.icon }),
  {} as Record<AreaToolId, string>,
);

type ShortcutRow = { keys: readonly string[]; description: string };

const TOOL_SHORTCUTS: readonly ShortcutRow[] = [
  { keys: ["V"], description: "Markera" },
  { keys: ["A"], description: "Anfallare" },
  { keys: ["F"], description: "Försvarare" },
  { keys: ["M"], description: "Målvakt" },
  { keys: ["B"], description: "Boll" },
  { keys: ["Delete", "Backspace"], description: "Radera markerat" },
  { keys: ["Esc"], description: "Avmarkera och återgå till Markera" },
];

const ROTATION_SHORTCUTS: readonly ShortcutRow[] = [
  { keys: ["Q"], description: "Rotera markerat objekt åt vänster" },
  { keys: ["E"], description: "Rotera markerat objekt åt höger" },
  { keys: ["Dra rotationshandtaget"], description: "Fri rotation med musen" },
];

const CAMERA_SHORTCUTS: readonly ShortcutRow[] = [
  { keys: ["Mushjul över planen"], description: "Zooma mot muspekaren" },
  { keys: ["Vänsterdrag på tom plan"], description: "Panorera (Markera-läge)" },
  { keys: ["Mellanknapp", "+ dra"], description: "Panorera vid zoom över 100 %" },
  { keys: ["0"], description: "Återställ kameran till 100 % och centrerad vy" },
];

function ShortcutList({ title, rows }: { title: string; rows: readonly ShortcutRow[] }) {
  return (
    <div className={styles.shortcutGroup}>
      <span className={styles.shortcutGroupTitle}>{title}</span>
      <ul className={styles.shortcutList}>
        {rows.map((row) => (
          <li key={row.description} className={styles.shortcutRow}>
            <span className={styles.shortcutKeys}>
              {row.keys.map((key) => (
                <kbd key={key} className={styles.kbd}>
                  {key}
                </kbd>
              ))}
            </span>
            <span className={styles.shortcutDescription}>{row.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Diskret sammanfattning av vad nästa planklick gör -- läser samma
// registry/preview-komponent som verktygslistan nedan, så den kan aldrig
// visa fel form/färg jämfört med vad som faktiskt placeras.
function ActiveToolSummary({ activeTool }: { activeTool: ToolId }) {
  if (isPlacementTool(activeTool)) {
    const objectInput = getPlacementObjectInput(activeTool);
    return (
      <div className={styles.activeToolSummary}>
        <ObjectTypePreview
          type={objectInput.type}
          coneColor={objectInput.coneColor}
          className={styles.activeToolPreview}
        />
        <span>{OBJECT_TOOL_LABELS[activeTool]}</span>
      </div>
    );
  }
  if (isDrawingTool(activeTool)) {
    return (
      <div className={styles.activeToolSummary}>
        <span className={styles.activeToolIcon} aria-hidden="true">
          {DRAWING_TOOL_ICONS[activeTool]}
        </span>
        <span>{DRAWING_PRESETS[activeTool].label}</span>
      </div>
    );
  }
  if (isAreaTool(activeTool)) {
    return (
      <div className={styles.activeToolSummary}>
        <span className={styles.activeToolIcon} aria-hidden="true">
          {AREA_TOOL_ICONS[activeTool]}
        </span>
        <span>{AREA_TOOL_LABELS[activeTool]}</span>
      </div>
    );
  }
  const icon = activeTool === "SELECT" ? "↖" : "✕";
  const label = activeTool === "SELECT" ? "Markera" : "Radera";
  return (
    <div className={styles.activeToolSummary}>
      <span className={styles.activeToolIcon} aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}

type ToolPanelProps = {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  // Whether ANYTHING deletable is currently selected -- a board object, a
  // drawing, OR an area (mutual exclusivity means at most one of the
  // three is ever true, see TacticsBoardScene.ts's selectObject/
  // selectDrawing/selectArea). Drives
  // only the "Radera markerat" button's disabled state; the actual
  // delete call (onDeleteSelected) already handles both cases via the
  // same handleDeleteSelected/Undo path Delete/Backspace uses.
  hasSelection: boolean;
  onDeleteSelected: () => void;
};

// UX polish sprint: every disclosure section starts CLOSED so the left
// panel is visually light on first open -- "Aktivt verktyg" above (not a
// ToolPanelSection) and the zoom controls elsewhere in the workspace stay
// visible regardless. The coach opens whichever section they need.
const DEFAULT_OPEN_SECTIONS: readonly string[] = [];

// Left tool panel -- object placement tools + Markera/Radera. Purely a UI
// concern: it owns no scene/geometry logic itself, only which tool is
// currently active (communicated back to TacticsBoardWorkspace, which owns
// the actual scene state). v0.4: every collapsible section (Verktyg,
// Objekt, Rotation, Kortkommandon) uses the SAME ToolPanelSection
// disclosure component -- no section implements its own chevron/toggle.
export default function ToolPanel({
  activeTool,
  onSelectTool,
  hasSelection,
  onDeleteSelected,
}: ToolPanelProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(DEFAULT_OPEN_SECTIONS));

  function toggleSection(id: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className={styles.panel} role="toolbar" aria-label="Ritverktyg" aria-orientation="vertical">
      <div className={styles.group}>
        <span className={styles.groupLabel}>Aktivt verktyg</span>
        <ActiveToolSummary activeTool={activeTool} />
      </div>

      <ToolPanelSection id="tools" title="Verktyg" icon="⚙" isOpen={openSections.has("tools")} onToggle={toggleSection}>
        <button
          type="button"
          className={styles.toolButton}
          data-active={activeTool === "SELECT" ? "true" : "false"}
          aria-label="Markera"
          aria-pressed={activeTool === "SELECT"}
          title="Markera (V)"
          onClick={() => onSelectTool("SELECT")}
        >
          <span className={styles.icon} aria-hidden="true">
            ↖
          </span>
          Markera
        </button>
        <button
          type="button"
          className={styles.toolButton}
          data-active={activeTool === "DELETE" ? "true" : "false"}
          aria-label="Radera"
          aria-pressed={activeTool === "DELETE"}
          title="Radera"
          onClick={() => onSelectTool("DELETE")}
        >
          <span className={styles.icon} aria-hidden="true">
            ✕
          </span>
          Radera
        </button>
        <button
          type="button"
          className={styles.deleteSelectedButton}
          aria-label="Radera markerat objekt"
          title="Radera markerat objekt (Delete)"
          disabled={!hasSelection}
          onClick={onDeleteSelected}
        >
          Radera markerat
        </button>
      </ToolPanelSection>

      <ToolPanelSection id="objects" title="Objekt" icon="◆" isOpen={openSections.has("objects")} onToggle={toggleSection}>
        {OBJECT_TOOLS.map((tool) => (
          <button
            key={tool.toolId}
            type="button"
            className={styles.toolButton}
            data-active={activeTool === tool.toolId ? "true" : "false"}
            aria-label={tool.label}
            aria-pressed={activeTool === tool.toolId}
            title={`${tool.label} (${tool.shortcutKey})`}
            onClick={() => onSelectTool(tool.toolId)}
          >
            <ObjectTypePreview type={tool.type} coneColor={getPlacementObjectInput(tool.toolId).coneColor} />
            {tool.label}
          </button>
        ))}
      </ToolPanelSection>

      {/* Spatial Engine Epic I, Del 1: every drawing tool now gets its own
          icon (DRAWING_TOOL_ICONS), same .icon span/class the
          Markera/Radera buttons above already use -- still one generic
          .map over DRAWING_PRESETS' own keys, so a future drawing tool
          needs only a new preset entry + one new icon glyph, never new
          JSX here. */}
      <ToolPanelSection id="drawing" title="Ritverktyg" icon="✏" isOpen={openSections.has("drawing")} onToggle={toggleSection}>
        {DRAWING_TOOLS.map((intent) => (
          <button
            key={intent}
            type="button"
            className={styles.toolButton}
            data-active={activeTool === intent ? "true" : "false"}
            aria-label={DRAWING_PRESETS[intent].label}
            aria-pressed={activeTool === intent}
            onClick={() => onSelectTool(intent)}
          >
            <span className={styles.icon} aria-hidden="true">
              {DRAWING_TOOL_ICONS[intent]}
            </span>
            {DRAWING_PRESETS[intent].label}
          </button>
        ))}
      </ToolPanelSection>

      {/* Area Engine v1 -- same generic .map-over-registry pattern as
          Ritverktyg above (one entry, one button, no per-tool JSX). */}
      <ToolPanelSection id="areas" title="Ytor" icon="▦" isOpen={openSections.has("areas")} onToggle={toggleSection}>
        {AREA_TOOLS.map((tool) => (
          <button
            key={tool.type}
            type="button"
            className={styles.toolButton}
            data-active={activeTool === tool.type ? "true" : "false"}
            aria-label={tool.label}
            aria-pressed={activeTool === tool.type}
            onClick={() => onSelectTool(tool.type)}
          >
            <span className={styles.icon} aria-hidden="true">
              {tool.icon}
            </span>
            {tool.label}
          </button>
        ))}
      </ToolPanelSection>

      {/* Interaction Polish v1: the separate "Rotation" section (a single
          documentation-only hint, conditionally shown when the selected
          object supports rotation) is gone -- its explanation already
          lives in Kortkommandon's own "Rotation" ShortcutList below
          (Q/E + drag-the-handle), so this was a duplicate. Rotation
          FUNCTIONALITY itself (Q/E, the drag handle, setObjectRotation)
          is completely untouched -- UI only. */}
      <ToolPanelSection
        id="shortcuts"
        title="Kortkommandon"
        icon="⌨"
        isOpen={openSections.has("shortcuts")}
        onToggle={toggleSection}
      >
        <ShortcutList title="Verktyg" rows={TOOL_SHORTCUTS} />
        <ShortcutList title="Rotation" rows={ROTATION_SHORTCUTS} />
        <ShortcutList title="Kamera" rows={CAMERA_SHORTCUTS} />
      </ToolPanelSection>
    </div>
  );
}
