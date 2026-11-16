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
//
// Arena Nights SYS-02e (A) "Canvas + inspector": court canvas (9) + inspector (3) with mode,
// coordinates and the snap point (cell centre); arrow keys nudge the inspected cell. UI only --
// the grid and calibration data are read, never changed.
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { createInitialScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import MasterCourtDisplay from "@/components/matchPlan/MasterCourtDisplay";
import CourtGridOverlay from "@/components/court/CourtGridOverlay";
import { DevPageHead } from "@/components/dev/DevShell";
import { cellBounds, cellCenter, COURT_GRID_DEFINITION, type GridCell } from "@/lib/court/courtGrid";
import { isNudgeKey, nudgeCell } from "@/lib/editor/courtGridNudge";
import {
  DEFENCE_FORMATION_IDS,
  getAttackPositionCalibration,
  getDefenceFormationCalibration,
  getPositionsForCell,
  type CalibrationContext,
  type PositionCalibration,
} from "@/lib/court/tacticalPositionCalibration";
import "./court-grid.css";

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

function modeLabel(mode: Mode): string {
  return mode === "GRID" ? "GRID" : mode === "ATTACK" ? "ANFALL" : getDefenceFormationCalibration(mode).label;
}

export default function CourtGridCalibrationPage() {
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true);
  const [mode, setMode] = useState<Mode>("GRID");
  const [inspected, setInspected] = useState<GridCell | null>(null);

  const calibrationContext: CalibrationContext | null = mode === "GRID" ? null : mode;
  const tablePositions = positionsForMode(mode);
  const inspectedPositions = inspected && calibrationContext ? getPositionsForCell(calibrationContext, inspected.cellNumber) : [];
  const bounds = inspected ? cellBounds(inspected.row, inspected.column) : null;
  const center = inspected ? cellCenter(inspected.row, inspected.column) : null;

  function onCourtKey(e: KeyboardEvent<HTMLDivElement>) {
    if (isNudgeKey(e.key)) {
      e.preventDefault();
      setInspected(nudgeCell(inspected?.cellNumber ?? null, e.key));
    } else if (e.key === "Escape") {
      setInspected(null);
    }
  }

  return (
    <>
      <DevPageHead
        eyebrow="Data · Court grid"
        title="Kanonisk handbollsplan"
        note={
          <span className="hm-dev-num">
            {COURT_GRID_DEFINITION.courtLengthMeters} m × {COURT_GRID_DEFINITION.courtWidthMeters} m · {COURT_GRID_DEFINITION.columns} × {COURT_GRID_DEFINITION.rows} celler ·{" "}
            {COURT_GRID_DEFINITION.cellLengthMeters} m × {COURT_GRID_DEFINITION.cellWidthMeters} m
          </span>
        }
      />
      <div className="hm-dev-split">
        <section className="hm-dev-panel">
          <div className="hm-dev-panel-head">
            <span className="hm-dev-panel-title">Plan · {modeLabel(mode)}</span>
            <span className="hm-dev-muted">
              Klicka/hovra en cell · <span className="hm-dev-kbd">←</span> <span className="hm-dev-kbd">↑</span> <span className="hm-dev-kbd">↓</span>{" "}
              <span className="hm-dev-kbd">→</span> flyttar · <span className="hm-dev-kbd">Esc</span> rensar
            </span>
          </div>
          <div className="hm-dev-panel-body">
            <div
              className="cg-court"
              tabIndex={0}
              role="group"
              aria-label="Planen. Piltangenter flyttar inspekterad cell."
              onKeyDown={onCourtKey}
              style={
                {
                  // Both `width` and `height` must stay derived (never both definite at once) -- see
                  // HM-COURT-GRID-0.1: `aspect-ratio` stays the single source of truth for height.
                  width: "min(100%, 40vh)",
                  aspectRatio: `${COURT_GRID_DEFINITION.courtWidthMeters} / ${COURT_GRID_DEFINITION.courtLengthMeters}`,
                } as CSSProperties
              }
            >
              <div className="cg-label cg-label--top">
                TOP GOAL (rad 1)
                <br />
                ANFALL — ÖVRE PLANHALVA
              </div>
              <div className="cg-label cg-label--bottom">
                FÖRSVAR — NEDRE PLANHALVA
                <br />
                BOTTOM GOAL (rad 20)
              </div>
              <div className="cg-label cg-label--left">COACH VIEW VÄNSTER (kolumn 1)</div>
              <div className="cg-label cg-label--right">COACH VIEW HÖGER (kolumn 10)</div>

              <MasterCourtDisplay scene={FULL_COURT_SCENE} />
              <CourtGridOverlay
                showGrid={showGrid}
                showNumbers={showNumbers}
                calibrationContext={calibrationContext}
                inspectedCellNumber={inspected?.cellNumber ?? null}
                hideInspector
                onInspect={(cell) => setInspected(cell)}
              />
            </div>
            {!showGrid ? <p className="hm-dev-muted" style={{ textAlign: "center" }}>Rutnätet är dolt -- slå på GRID i inspektören för att inspektera celler.</p> : null}
          </div>
        </section>

        <aside className="hm-dev-sticky">
          <div className="hm-dev-panel">
            <div className="hm-dev-panel-head">
              <span className="hm-dev-panel-title">Läge</span>
            </div>
            <div className="hm-dev-panel-body">
              <div className="hm-dev-chips" role="group" aria-label="Kalibreringsläge">
                {MODES.map(({ mode: m, label }) => (
                  <button key={m} type="button" className="hm-dev-chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="cg-toggles">
                <label>
                  <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> GRID
                </label>
                <label title={!showGrid ? "Kräver att GRID är på" : undefined}>
                  <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} disabled={!showGrid} /> Cellnummer
                </label>
              </div>
            </div>
          </div>

          <div className="hm-dev-panel">
            <div className="hm-dev-panel-head">
              <span className="hm-dev-panel-title">Koordinater</span>
              {inspected ? <span className="hm-dev-num">{inspected.cellId}</span> : null}
            </div>
            <div className="hm-dev-panel-body">
              {inspected && bounds && center ? (
                <dl className="cg-dl hm-dev-num">
                  <dt>Cell</dt>
                  <dd>{inspected.cellNumber}</dd>
                  <dt>Rad / kolumn</dt>
                  <dd>
                    {inspected.row} / {inspected.column}
                  </dd>
                  <dt>x</dt>
                  <dd>
                    {bounds.minXMeters.toFixed(1)}–{bounds.maxXMeters.toFixed(1)} m
                  </dd>
                  <dt>y</dt>
                  <dd>
                    {bounds.minYMeters.toFixed(1)}–{bounds.maxYMeters.toFixed(1)} m
                  </dd>
                  <dt>Snap (cellcentrum)</dt>
                  <dd>
                    {center.xMeters.toFixed(1)}, {center.yMeters.toFixed(1)} m
                  </dd>
                </dl>
              ) : (
                <p className="hm-dev-muted" style={{ margin: 0 }}>
                  Ingen cell inspekterad. Klicka på planen, eller fokusera planen och tryck en piltangent för att börja i cell 1.
                </p>
              )}
              {inspected && calibrationContext ? (
                <div className="cg-cell-positions">
                  {inspectedPositions.length > 0 ? (
                    inspectedPositions.map((p) => (
                      <div key={p.id}>
                        <strong>{p.label}</strong> <span className="hm-dev-muted">({p.id})</span> -- accepterade celler: <span className="hm-dev-num">{p.acceptedCells.join(", ")}</span>
                      </div>
                    ))
                  ) : (
                    <div className="hm-dev-muted">Ingen kalibrerad position på denna cell i {modeLabel(mode)}.</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="hm-dev-panel">
            <div className="hm-dev-panel-head">
              <span className="hm-dev-panel-title">Kalibrerade positioner · {modeLabel(mode)}</span>
            </div>
            {mode === "GRID" ? (
              <p className="hm-dev-panel-body hm-dev-muted" style={{ margin: 0 }}>Välj ANFALL eller ett försvarssystem för att se den manuellt kalibrerade positionsmappningen.</p>
            ) : (
              <table className="hm-dev-table">
                <tbody>
                  {tablePositions.map((p) => {
                    const active = inspectedPositions.some((ip) => ip.id === p.id);
                    return (
                      <tr key={p.id} className={active ? "hm-dev-dirty" : undefined}>
                        <td>{p.label}</td>
                        <td className="hm-dev-num">{p.acceptedCells.join(" / ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
