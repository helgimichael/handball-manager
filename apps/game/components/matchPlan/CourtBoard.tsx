"use client";

// HM-TACTICS-1.2 Part 3: the players on the court are now the primary,
// clickable representation of a starting unit -- MasterCourt itself
// stays a pure visual backdrop (unchanged, no FIELD internals touched),
// and this component overlays simple absolutely-positioned chips (see
// courtLayout.ts) on top of it at each slot's approximate handball
// position. Clicking a chip is the "select this slot" action; the
// caller (StartingUnitEditor) renders the actual swap/instruction
// controls for whichever chip is selected.
import type { CSSProperties } from "react";
import type { TacticsBoardScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import MasterCourtDisplay from "./MasterCourtDisplay";

export interface CourtChip {
  key: string;
  xPct: number;
  yPct: number;
  shortLabel: string;
  playerName: string;
}

export default function CourtBoard({ scene, chips, selectedKey, onSelectChip }: { scene: TacticsBoardScene; chips: readonly CourtChip[]; selectedKey: string | null; onSelectChip: (key: string) => void }) {
  return (
    <div style={{ position: "relative", height: 440, borderRadius: "var(--hm-radius-sm)", overflow: "hidden" }}>
      <MasterCourtDisplay scene={scene} />
      <div style={{ position: "absolute", inset: 0 }}>
        {chips.map((chip) => {
          const selected = chip.key === selectedKey;
          const style: CSSProperties = {
            position: "absolute",
            left: `${chip.xPct}%`,
            top: `${chip.yPct}%`,
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            lineHeight: 1.1,
            background: selected ? "var(--hm-accent)" : "var(--hm-surface-2)",
            color: selected ? "#fff" : "var(--hm-text-primary)",
            border: "1px solid var(--hm-border)",
            borderRadius: 999,
            padding: "3px 8px",
            fontSize: "var(--hm-text-2xs)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
          };
          return (
            <button key={chip.key} type="button" style={style} onClick={() => onSelectChip(chip.key)}>
              <span style={{ opacity: 0.75, fontSize: 9 }}>{chip.shortLabel}</span>
              <span style={{ fontWeight: 600 }}>{chip.playerName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
