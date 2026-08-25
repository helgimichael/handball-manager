"use client";

// HM-COURT-GRID-0.1 Part D: developer/editor-only calibration view for the
// canonical 40x20m / 20x10 / 2x2m handball court grid. Automatically
// inherits the /editor/* layout's Editor Mode gate (see
// app/editor/layout.tsx) -- no gating logic needed here.
//
// This view is ONLY for calibrating the coordinate system itself (Part J:
// no V6/M9/6:0/7v6/player chips/drag-drop/MatchPlan concepts belong on
// this screen). It must never appear in normal gameplay UI.
import { useState, type CSSProperties } from "react";
import { createInitialScene } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/scene/TacticsBoardScene.ts";
import MasterCourtDisplay from "@/components/matchPlan/MasterCourtDisplay";
import CourtGridOverlay from "@/components/court/CourtGridOverlay";
import { COURT_GRID_DEFINITION } from "@/lib/court/courtGrid";

const FULL_COURT_SCENE = createInitialScene({ courtView: "FULL_COURT", objects: [] });

export default function CourtGridCalibrationPage() {
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true);

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 20px" }}>
      <div className="hm-panel-header" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: "var(--hm-text-lg)" }}>CANONICAL HANDBALL COURT GRID</h1>
        <p style={{ margin: "4px 0 0", opacity: 0.75, fontSize: "var(--hm-text-sm)" }}>
          {COURT_GRID_DEFINITION.courtLengthMeters}m x {COURT_GRID_DEFINITION.courtWidthMeters}m ·{" "}
          {COURT_GRID_DEFINITION.columns} x {COURT_GRID_DEFINITION.rows} · {COURT_GRID_DEFINITION.cellLengthMeters}m x{" "}
          {COURT_GRID_DEFINITION.cellWidthMeters}m cells
        </p>
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
          }}
        >
          TOP GOAL (row 1)
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
          }}
        >
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
        <CourtGridOverlay showGrid={showGrid} showNumbers={showNumbers} />
      </div>
    </div>
  );
}
