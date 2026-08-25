"use client";

// HM-COURT-GRID-0.1 Part D: developer/editor-only calibration view for the
// canonical 40x20m / 20x10 / 2x2m handball court grid. Automatically
// inherits the /editor/* layout's Editor Mode gate (see
// app/editor/layout.tsx) -- no gating logic needed here.
//
// HM-COURT-GRID-0.2 Part E: extended with a calibration-mode selector
// (GRID / ANFALL / one defence formation at a time) that overlays the
// manually supplied tactical-position calibration. This view is STILL
// only for calibrating/visualizing the mapping (Part L: not connected to
// attackZones.ts/courtLayout.ts/StartingUnitEditor/MatchPlan) -- it must
// never appear in normal gameplay UI.
import { useState, type CSSProperties } from "react";
import { createInitialScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import MasterCourtDisplay from "@/components/matchPlan/MasterCourtDisplay";
import CourtGridOverlay from "@/components/court/CourtGridOverlay";
import { COURT_GRID_DEFINITION, type GridCell } from "@/lib/court/courtGrid";
import {
  DEFENCE_FORMATION_IDS,
  getAttackPositionCalibration,
  getDefenceFormationCalibration,
  type CalibrationContext,
  type PositionCalibration,
} from "@/lib/court/tacticalPositionCalibration";

const FULL_COURT_SCENE = createInitialScene({ courtView: "FULL_COURT", objects: [] });

type Mode = "GRID" | CalibrationContext;
const MODES: readonly { mode: Mode; label: string }[] = [
  { mode: "GRID", label: "GRID" },
  { mode: "ATTACK", label: "ANFALL" },
  ...DEFENCE_FORMATION_IDS.map((f) => ({ mode: f as Mode, label: getDefenceFormationCalibration(f).label })),
];

function positionsForMode(mode: Mode): readonly PositionCalibration[] {
  if (mode === "GRID") return [];
  if (mode === "ATTACK") return getAttackPositionCalibration();
  return getDefenceFormationCalibration(mode).positions;
}

export default function CourtGridCalibrationPage() {
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true);
  const [mode, setMode] = useState<Mode>("GRID");
  const [inspected, setInspected] = useState<{ cell: GridCell; positions: readonly PositionCalibration[] } | null>(null);

  const calibrationContext: CalibrationContext | null = mode === "GRID" ? null : mode;
  const tablePositions = positionsForMode(mode);

  return (
    <div style={{ maxWidth: 1200, margin: "32px auto", padding: "0 20px", display: "flex", gap: 24, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 480px", minWidth: 320 }}>
        <div className="hm-panel-header" style={{ marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontSize: "var(--hm-text-lg)" }}>CANONICAL HANDBALL COURT GRID</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.75, fontSize: "var(--hm-text-sm)" }}>
            {COURT_GRID_DEFINITION.courtLengthMeters}m x {COURT_GRID_DEFINITION.courtWidthMeters}m ·{" "}
            {COURT_GRID_DEFINITION.columns} x {COURT_GRID_DEFINITION.rows} · {COURT_GRID_DEFINITION.cellLengthMeters}m x{" "}
            {COURT_GRID_DEFINITION.cellWidthMeters}m cells
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {MODES.map(({ mode: m, label }) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                padding: "4px 10px",
                fontSize: "var(--hm-text-2xs)",
                fontWeight: 600,
                borderRadius: "var(--hm-radius-sm)",
                border: mode === m ? "1px solid var(--hm-accent)" : "1px solid var(--hm-border)",
                background: mode === m ? "var(--hm-accent)" : "var(--hm-surface-2)",
                color: mode === m ? "#fff" : "var(--hm-text-primary)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: "var(--hm-text-sm)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            GRID
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} disabled={!showGrid} />
            CELL NUMBERS
          </label>
        </div>

        <div
          style={
            {
              position: "relative",
              // Both `width` and `height` must stay derived (never both
              // definite at once), or a competing maxHeight clamp can win
              // without the browser recomputing width -- breaking the
              // required 2:1 court aspect ratio at some viewport sizes.
              // Bounding width by both maxWidth (900px) and 40vh (= 80vh
              // worth of height, since height is always 2x width for this
              // court) keeps `aspect-ratio` the single source of truth for
              // the other dimension in every case.
              width: `min(860px, 40vh)`,
              aspectRatio: `${COURT_GRID_DEFINITION.courtWidthMeters} / ${COURT_GRID_DEFINITION.courtLengthMeters}`,
              margin: "0 auto",
              borderRadius: "var(--hm-radius-sm)",
              overflow: "hidden",
              "--ds-color-surface": "#0e2e27",
              "--ds-color-text": "rgba(226, 245, 238, 0.82)",
            } as CSSProperties
          }
        >
          <div
            style={{
              position: "absolute",
              top: 4,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
              fontSize: "var(--hm-text-2xs)",
              color: "rgba(226, 245, 238, 0.7)",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            TOP GOAL (row 1)
            <br />
            ANFALL — ÖVRE PLANHALVA
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 4,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
              fontSize: "var(--hm-text-2xs)",
              color: "rgba(226, 245, 238, 0.7)",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            FÖRSVAR — NEDRE PLANHALVA
            <br />
            BOTTOM GOAL (row 20)
          </div>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 4,
              transform: "translateY(-50%) rotate(-90deg)",
              transformOrigin: "left center",
              zIndex: 2,
              fontSize: "var(--hm-text-2xs)",
              color: "rgba(226, 245, 238, 0.7)",
              fontWeight: 600,
            }}
          >
            COACH VIEW LEFT (column 1)
          </div>
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: 4,
              transform: "translateY(-50%) rotate(90deg)",
              transformOrigin: "right center",
              zIndex: 2,
              fontSize: "var(--hm-text-2xs)",
              color: "rgba(226, 245, 238, 0.7)",
              fontWeight: 600,
            }}
          >
            COACH VIEW RIGHT (column 10)
          </div>

          <MasterCourtDisplay scene={FULL_COURT_SCENE} />
          <CourtGridOverlay
            showGrid={showGrid}
            showNumbers={showNumbers}
            calibrationContext={calibrationContext}
            onInspect={(cell, positions) => setInspected({ cell, positions })}
          />
        </div>
      </div>

      <div style={{ flex: "0 1 280px", minWidth: 220 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">{mode === "GRID" ? "GRID" : mode === "ATTACK" ? "ANFALL" : getDefenceFormationCalibration(mode).label}</span>
          </div>
          <div className="hm-panel-body" style={{ fontSize: "var(--hm-text-xs)" }}>
            {mode === "GRID" ? (
              <p className="hm-text-muted">Välj ANFALL eller ett försvarssystem ovan för att se den manuellt kalibrerade positionsmappningen.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {tablePositions.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--hm-border)" }}>
                      <td style={{ padding: "4px 6px 4px 0", fontWeight: 600 }}>{p.label}</td>
                      <td style={{ padding: "4px 0", textAlign: "right", opacity: 0.85 }}>{p.acceptedCells.join(" / ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {inspected && (
          <div className="hm-panel" style={{ marginTop: 12 }}>
            <div className="hm-panel-header">
              <span className="hm-panel-title">INSPEKTERAD CELL</span>
            </div>
            <div className="hm-panel-body" style={{ fontSize: "var(--hm-text-xs)" }}>
              <div>Cell {inspected.cell.cellNumber} (Row {inspected.cell.row} / Col {inspected.cell.column})</div>
              {calibrationContext &&
                (inspected.positions.length > 0 ? (
                  inspected.positions.map((p) => (
                    <div key={p.id} style={{ marginTop: 4 }}>
                      {p.label} ({p.id}) — accepterade celler: {p.acceptedCells.join(", ")}
                    </div>
                  ))
                ) : (
                  <div className="hm-text-muted" style={{ marginTop: 4 }}>
                    Ingen kalibrerad position på denna cell i {mode === "ATTACK" ? "ANFALL" : mode}.
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
