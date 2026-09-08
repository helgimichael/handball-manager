"use client";

// MATCH-EXPERIENCE-2.0 M5: the dev 2D match viewer.
//
// Plays back a deterministic match produced by handball-engine's M4 runner.
// This page is a pure CONSUMER: it never decides a player target, a pass, a
// shot, possession, an outcome or the score. It advances a playback clock,
// asks match-integration for the frame at that clock, and hands the resulting
// snapshot to FIELD's own MasterCourt. Presentation speed changes only how
// fast the official clock is consumed -- the match is already fully simulated
// before the first frame is drawn.
//
// M14: it now plays back REAL CAREER MATCHES. When a career is loaded and its
// most recent result was produced by the spatial engine, this page re-derives
// that same fixture through the SAME seam the matchday action used
// (playCareerFixtureSpatially) and plays back its trace. That is not a second
// simulation dressed up for the visuals: the seam is a pure function of the
// saved career state, so the trace shown here IS the match whose score the
// career recorded -- and the header asserts it by displaying that stored score
// alongside the one the trace ends on. The dev scenario remains available for
// engine work, and nothing here ever writes to career state.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import MasterCourt, {
  type InteractionMode,
  type ToolId,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/MasterCourt.tsx";
import {
  APPROVED_DEFENSIVE_ZONE_CALIBRATION,
  APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/geometry/HandballCourtGeometry.ts";
import { DEFAULT_CAMERA } from "@handball-manager/match-renderer/src/ui/camera/Camera2D.ts";
import { designSystemTheme } from "@handball-manager/match-renderer/src/ui/design-system/index.ts";
import { createFullCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/fullCourt6v6.ts";
import { simulateMatch } from "@handball-manager/handball-engine/src/simulation/matchRunner.ts";
import { autonomousCoach } from "@handball-manager/handball-engine/src/simulation/coach.ts";
import { useCareer } from "../../../lib/career/CareerContext";
import { isSpatialMatchFailure, playCareerFixtureSpatially } from "../../../lib/career/spatialMatch/spatialCareerMatch";
import { buildCanonicalMatchEvents, type CanonicalMatchEvent } from "@handball-manager/handball-engine/src/simulation/canonicalEvents.ts";
import {
  buildPlaybackFrames,
  frameAtMatchSeconds,
  playbackDurationSeconds,
  advancePlaybackClock,
  formatMatchClock,
  snapshotToScene,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
} from "@handball-manager/match-integration";

function noop() {}

const DEFAULT_SEED = 12;

/**
 * M15: one line of commentary, DERIVED from a canonical event.
 *
 * This is the direction the event layer exists for. The engine records the fact
 * -- type, players, outcome -- and the sentence is composed here, at the point
 * of display, from that data. The reverse (an engine sentence read back as
 * data) is exactly what the canonical layer replaces.
 */
function describeCanonicalEvent(event: CanonicalMatchEvent): string {
  const side = event.teamId ?? "";
  switch (event.type) {
    case "GOAL":
      return `MÅL ${side}: ${event.playerId ?? "?"}${event.sevenMetre ? " (7m)" : ""} — ${event.score.HOME}–${event.score.AWAY}`;
    case "SHOT":
      return `SKOTT ${side}: ${event.playerId ?? "?"} → ${event.outcome}${event.blockedByDefenderId ? ` (${event.blockedByDefenderId})` : ""}`;
    case "PASS":
      return `PASS ${side}: ${event.playerId} → ${event.targetPlayerId ?? "?"} (${event.intent})`;
    case "DRIVE":
      return `GENOMBROTT ${side}: ${event.playerId}${event.gapId ? ` mot ${event.gapId}` : ""}`;
    case "TURNOVER":
      return `BOLLFÖRLUST ${side}: ${event.playerId ?? "?"}`;
    case "FOUL":
      return `FRIKAST/7M ${side}: ${event.playerId} på ${event.victimPlayerId} → ${event.restart}`;
    case "SUSPENSION":
      return `UTVISNING ${side}: ${event.playerId} (${event.seconds}s)`;
    case "SUBSTITUTION_COMPLETED":
      return `BYTE ${side}: ${event.incomingPlayerId} in för ${event.outgoingPlayerId}`;
    case "SUBSTITUTION_REQUESTED":
      return `BYTE BEGÄRT ${side}: ${event.incomingPlayerId} för ${event.outgoingPlayerId}`;
    case "TIMEOUT_STARTED":
      return `TIMEOUT ${side}`;
    case "TIMEOUT_ENDED":
      return `TIMEOUT SLUT ${side}`;
    case "INSTRUCTION_CHANGED":
      return `INSTRUKTION ${side} (${event.scope}): ${event.changes.map((c) => `${c.key} ${c.from.toFixed(2)}→${c.to.toFixed(2)}`).join("; ")}`;
    case "POSSESSION_CHANGE":
      return `ANFALL ${side} (#${event.possessionNumber})`;
    case "HALF_START":
      return `HALVLEK ${event.half} BÖRJAR`;
    case "HALF_END":
      return `HALVLEK ${event.half} SLUT`;
    case "FULL_TIME":
      return `SLUTSIGNAL ${event.finalScore.HOME}–${event.finalScore.AWAY}`;
  }
}

export default function Match2DPage() {
  const { career } = useCareer();
  const [seed, setSeed] = useState(DEFAULT_SEED);

  // M14: the most recently played fixture this career owns spatially. Chosen
  // from the career's own results rather than re-simulated speculatively, so
  // the page only ever plays back a match that actually happened.
  const careerFixture = useMemo(() => {
    const spatial = Object.values(career.results).filter((r) => r.engine === "SPATIAL");
    if (spatial.length === 0) return null;
    const played = new Set(spatial.map((r) => r.fixtureId));
    const fixtures = career.fixtures.filter((f) => played.has(f.id));
    const latest = [...fixtures].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).pop();
    return latest ? { fixture: latest, stored: career.results[latest.id] } : null;
  }, [career]);
  const [showCareerMatch, setShowCareerMatch] = useState(true);
  const playingCareerMatch = showCareerMatch && careerFixture !== null;
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  // The match is simulated ONCE, up front and in full. Playback never re-runs
  // it, which is what makes speed purely presentational.
  const { frames, duration, finalScore, canonicalEvents } = useMemo(() => {
    if (playingCareerMatch && careerFixture) {
      // The SAME seam the career used. Same state, same fixture, same inputs,
      // therefore the same match -- re-derived rather than re-invented.
      const spatial = playCareerFixtureSpatially(career, careerFixture.fixture);
      if (!isSpatialMatchFailure(spatial)) {
        const built = buildPlaybackFrames(spatial.match, {
          goalkeeperIds: spatial.match.finalState.goalkeeperIds,
          rosters: spatial.match.finalState.rosters,
        });
        return { frames: built, duration: playbackDurationSeconds(built), finalScore: spatial.match.finalScore, canonicalEvents: spatial.events };
      }
    }
    const start = createFullCourt6v6State({ attackingGoalSide: "TOP" });
    // M12: both benches have a coach. He is the minimal automatic one -- he
    // notices a scoring run, a drought or a numerical situation and answers
    // with a timeout, a tactical adjustment or a substitution request. What he
    // does lands in the ordinary trace, so the HUD below shows it without the
    // renderer knowing anything about coaching.
    const match = simulateMatch(start, seed, { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } });
    // M11: the squad's goalkeepers, not just the two who started -- a reserve
    // keeper who comes on must still be drawn as a keeper. The match carries
    // that list; the starting line-up is only the fallback.
    const goalkeeperIds = match.finalState.goalkeeperIds ?? start.handball.players.filter((p) => p.kind === "GOALKEEPER").map((p) => p.id);
    const built = buildPlaybackFrames(match, { goalkeeperIds, rosters: match.finalState.rosters });
    // M15: the same match, described as canonical facts. The trace above is the
    // high-frequency playback state; this is the low-frequency fact stream, and
    // the commentary line below is composed FROM it rather than read out of the
    // engine's own development notes.
    return { frames: built, duration: playbackDurationSeconds(built), finalScore: match.finalScore, canonicalEvents: buildCanonicalMatchEvents(match) };
  }, [seed, career, careerFixture, playingCareerMatch]);

  const frame = frameAtMatchSeconds(frames, clock) ?? frames[0];
  // M15: the most recent canonical fact the playback clock has reached.
  const latestEvent = useMemo(() => {
    let found: CanonicalMatchEvent | null = null;
    for (const event of canonicalEvents) {
      if (event.matchSeconds > clock) break;
      if (event.type === "PASS" || event.type === "DRIVE" || event.type === "POSSESSION_CHANGE") continue;
      found = event;
    }
    return found;
  }, [canonicalEvents, clock]);
  const scene = useMemo(() => (frame ? snapshotToScene(frame.snapshot) : null), [frame]);

  // Fit the portrait court into the landscape stage. Measured, so the court
  // scales with the window instead of collapsing into a letterboxed sliver.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const courtPixels = useMemo(() => {
    // After a quarter turn the court occupies (length x width) on screen, so
    // fit against the swapped axes and keep the true 20:40 proportion.
    const scale = Math.min(stage.width / 40, stage.height / 20);
    const s = Number.isFinite(scale) && scale > 0 ? scale : 0;
    return { width: 20 * s, height: 40 * s };
  }, [stage.width, stage.height]);

  // Presentation loop: real elapsed time * speed advances the OFFICIAL clock.
  const lastTickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      lastTickRef.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const previous = lastTickRef.current ?? now;
      lastTickRef.current = now;
      const deltaRealSeconds = Math.min(0.25, (now - previous) / 1000);
      setClock((current) => {
        const next = advancePlaybackClock(current, deltaRealSeconds, speed, duration);
        if (next >= duration) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration]);

  if (!frame || !scene) return <div style={{ padding: 24 }}>Ingen match att spela upp.</div>;

  const possessorId = frame.snapshot.ball.possessorPlayerId;
  const possessor = possessorId ? frame.snapshot.players.find((p) => p.id === possessorId) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* HUD -- every value below comes from the engine's own match output. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "10px 16px",
          borderBottom: "1px solid var(--hm-border-subtle)",
          background: "var(--hm-surface-2)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <strong style={{ fontSize: 20 }}>
          HOME {frame.score.HOME} – {frame.score.AWAY} AWAY
        </strong>
        <span style={{ fontSize: 18 }}>{formatMatchClock(frame.matchSeconds)}</span>
        <span style={{ opacity: 0.75 }}>{frame.half === 1 ? "Första halvlek" : "Andra halvlek"}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? "PAUSE" : "PLAY"}
          </button>
          <button type="button" className="hm-btn" onClick={() => { setPlaying(false); setClock(0); }}>
            RESTART
          </button>
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === speed ? "hm-btn hm-btn-primary" : "hm-btn"}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </span>
      </div>

      {/* Seek across the whole match. Seeking only moves the clock. */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--hm-border-subtle)" }}>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(duration))}
          value={Math.round(clock)}
          onChange={(e) => setClock(Number(e.target.value))}
          style={{ width: "100%" }}
          aria-label="Sök i matchen"
        />
      </div>

      {/*
        PRESENTATION ONLY. The canonical court is 20m wide x 40m long, i.e.
        portrait, which letterboxes into a thin strip on a desktop viewport.
        FIELD's Camera2D supports zoom/pan but not rotation, so the court is
        fitted to the container at its true aspect ratio and then rotated a
        quarter turn in CSS for landscape viewing. Simulation coordinates are
        completely untouched -- this is a transform on pixels, nothing else.
      */}
      {/*
        FIELD's court styling is driven by its own design-system custom
        properties: MasterCourt.module.css strokes every line with
        var(--ds-color-text) over var(--ds-color-surface). Those variables are
        supplied by designSystemTheme, which /career/match-center already
        applies to its court container. Without it the tokens are unset here and
        the markings render with no contrast against the dark surface. Applying
        the theme reuses FIELD's existing styling system verbatim -- no colours
        are overridden and no geometry is redrawn.
      */}
      <div
        ref={stageRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          ...designSystemTheme,
          background: "var(--ds-color-background)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: courtPixels.width,
            height: courtPixels.height,
            transform: "translate(-50%, -50%) rotate(-90deg)",
            transformOrigin: "center center",
          }}
        >
        <MasterCourt
          scene={scene}
          activeTool={"SELECT" as ToolId}
          presentationMode
          interactionMode={"SELECT" as InteractionMode}
          interactionCancelVersion={0}
          isContextMenuOpen={false}
          camera={DEFAULT_CAMERA}
          onPlaceObject={noop}
          onSelectObject={noop}
          onMoveObject={noop}
          onDeleteObject={noop}
          onRotateObject={noop}
          onObjectMoveGestureStart={noop}
          onObjectMoveGestureEnd={noop}
          onObjectRotateGestureStart={noop}
          onObjectRotateGestureEnd={noop}
          onPanBy={noop}
          onZoomAt={noop}
          onEmptyCourtPointerDown={noop}
          onCancelToSelect={noop}
          onFinishContinuousDrawingToSelect={noop}
          defensiveZoneCalibration={APPROVED_DEFENSIVE_ZONE_CALIBRATION}
          calibrationMode={false}
          onDragDividerPoint={noop}
          onDividerDragStart={noop}
          onDividerDragEnd={noop}
          defensiveZoneLabelCalibration={APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION}
          defensiveZoneLabelCalibrationMode={false}
          selectedDefensiveZoneLabelKey="center"
          onSelectDefensiveZoneLabel={noop}
          onDragDefensiveZoneLabel={noop}
          onRotateDefensiveZoneLabel={noop}
          onDefensiveZoneLabelGestureStart={noop}
          onDefensiveZoneLabelGestureEnd={noop}
          drawings={[]}
          onSelectDrawing={noop}
          onMoveDrawing={noop}
          onMoveDrawingPoint={noop}
          onAnchorDrawingPoint={noop}
          onDeleteDrawing={noop}
          onDrawingGestureStart={noop}
          onDrawingGestureEnd={noop}
          pathDraftAnchors={null}
          onPathAnchorAdd={noop}
          onPathFinishDroppingLastAnchor={noop}
          onPathPreviewMove={noop}
          areas={[]}
          onCreateArea={noop}
          onSelectArea={noop}
          onMoveArea={noop}
          onMoveAreaPoint={noop}
          onResizeAreaRectangle={noop}
          onRotateArea={noop}
          onDeleteArea={noop}
          onAreaGestureStart={noop}
          onAreaGestureEnd={noop}
          onCreatePlayerAction={noop}
          onMovePlayerActionScreenAnchor={noop}
          onPlayerActionGestureStart={noop}
          onPlayerActionGestureEnd={noop}
          onOpenPlayerActionsContextMenu={noop}
          pendingPlayerAction={null}
          onPendingPlayerActionCommit={noop}
        />
        </div>
      </div>

      {/* Debug/event label -- the engine's own note for the state on screen. */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          padding: "8px 16px",
          borderTop: "1px solid var(--hm-border-subtle)",
          background: "var(--hm-surface-2)",
          fontSize: 13,
        }}
      >
        <span style={{ opacity: 0.85 }}>{frame.note}</span>
        <span style={{ marginLeft: "auto", opacity: 0.6 }}>
          boll: {frame.snapshot.ball.status}
          {possessor ? ` · ${possessor.id}` : ""} · sim {frame.simulationTime.toFixed(1)}s · slutresultat {finalScore.HOME}–{finalScore.AWAY}
          {/* M14: the score the CAREER recorded for this fixture, printed beside
              the one this trace ends on. They are the same simulation, so they
              are the same number -- and if they ever were not, it would be
              visible here rather than silently wrong. */}
          {playingCareerMatch && careerFixture ? (
            <> · karriär {careerFixture.stored.homeGoals}–{careerFixture.stored.awayGoals} ({careerFixture.stored.engine})</>
          ) : null}
          {" · "}
          {canonicalEvents.length} händelser
          {latestEvent ? <> · {describeCanonicalEvent(latestEvent)}</> : null}
        </span>
        <label style={{ display: "flex", gap: 6, alignItems: "center", opacity: 0.8 }}>
          {careerFixture ? (
            <button
              type="button"
              onClick={() => setShowCareerMatch((v) => !v)}
              style={{ marginRight: 8, padding: "2px 8px", cursor: "pointer" }}
            >
              {playingCareerMatch ? "karriärmatch" : "dev-scenario"}
            </button>
          ) : null}
          seed
          <input
            type="number"
            value={seed}
            onChange={(e) => { setSeed(Number(e.target.value) || 0); setClock(0); setPlaying(false); }}
            style={{ width: 80 }}
          />
        </label>
      </div>
    </div>
  );
}
