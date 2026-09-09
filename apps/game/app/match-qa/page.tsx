"use client";

// HUMAN QA GATE 1: the Match 2D QA harness.
//
// One dev-only page where a human can deliberately reach the behaviours M1-M25
// built, instead of waiting for a lucky random match.
//
// It deliberately sits OUTSIDE /career. The career layout redirects to the
// title screen unless a save exists, and this harness needs no career at all --
// it plays a dev scenario through the real engine, so gating it behind somebody
// having started a career would make it unreachable on a fresh machine.
//
// It is a CONSUMER, exactly like /career/match-2d: the real `simulateMatch`
// produces the match, match-integration produces the frames, FIELD's own
// MasterCourt draws them, and the canonical event stream provides the facts.
// Nothing here decides a target, a pass, a contact or a score, and there is no
// second QA simulation anywhere. Changing a control rebuilds the match from the
// engine rather than mutating a running one into a state the engine could never
// have produced.

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
import type { CanonicalMatchEvent } from "@handball-manager/handball-engine/src/simulation/canonicalEvents.ts";
import {
  DEFAULT_QA_SETTINGS,
  DEFENCE_SYSTEMS,
  QA_PRESETS,
  buildQaMatch,
  readConditions,
  readTeams,
  phaseAt,
  type DefenceSystemId,
  type QaSettings,
} from "../../lib/matchQa/qaHarness";

function noop() {}

/** One canonical fact, as a line of text. Composed here, never read back as data. */
function describeEvent(event: CanonicalMatchEvent): string {
  const at = formatMatchClock(event.matchSeconds);
  const side = event.teamId ?? "";
  switch (event.type) {
    case "GOAL":
      return `${at} GOAL ${side} ${event.playerId ?? "?"}${event.sevenMetre ? " (7m)" : ""} → ${event.score.HOME}–${event.score.AWAY}`;
    case "SHOT":
      return `${at} SHOT ${side} ${event.playerId ?? "?"} → ${event.outcome}${event.blockedByDefenderId ? ` (blocked ${event.blockedByDefenderId})` : ""}`;
    case "FOUL":
      return `${at} FOUL ${side} ${event.playerId} on ${event.victimPlayerId} → ${event.restart}${event.punishment === "TWO_MINUTES" ? " + 2min" : ""}`;
    case "SUSPENSION":
      return `${at} 2 MIN ${side} ${event.playerId}`;
    case "TURNOVER":
      return `${at} TURNOVER ${side} ${event.playerId ?? ""}`;
    case "POSSESSION_CHANGE":
      return `${at} POSSESSION → ${side}`;
    case "SUBSTITUTION_COMPLETED":
      return `${at} SUB ${side} ${event.incomingPlayerId} on for ${event.outgoingPlayerId}`;
    case "SUBSTITUTION_REQUESTED":
      return `${at} SUB REQUESTED ${side} ${event.incomingPlayerId} for ${event.outgoingPlayerId}`;
    case "TIMEOUT_STARTED":
      return `${at} TIMEOUT ${side}`;
    case "TIMEOUT_ENDED":
      return `${at} TIMEOUT ends ${side}`;
    case "INSTRUCTION_CHANGED":
      return `${at} INSTRUCTION ${side} ${event.scope}`;
    case "HALF_START":
      return `${at} HALF ${event.half} START`;
    case "HALF_END":
      return `${at} HALF ${event.half} END`;
    case "FULL_TIME":
      return `${at} FULL TIME ${event.finalScore.HOME}–${event.finalScore.AWAY}`;
    default:
      return `${at} ${event.type}`;
  }
}

const panel: React.CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border-subtle)",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

export default function MatchQaPage() {
  const [settings, setSettings] = useState<QaSettings>(DEFAULT_QA_SETTINGS);
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [presetHint, setPresetHint] = useState<string>(QA_PRESETS[0].hint);
  const [seekNote, setSeekNote] = useState<string | null>(null);

  // The match is simulated ONCE per settings change, in full, before a frame is
  // drawn. Speed and seeking are therefore purely presentational.
  const built = useMemo(() => {
    const { match, events } = buildQaMatch(settings);
    const frames = buildPlaybackFrames(match, {
      goalkeeperIds: match.finalState.goalkeeperIds,
      rosters: match.finalState.rosters,
    });
    return { match, events, frames, duration: playbackDurationSeconds(frames) };
  }, [settings]);

  /** Every control goes through here: change an input, rebuild, start at the top. */
  const apply = (next: Partial<QaSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
    setPlaying(false);
    setClock(0);
    setSeekNote(null);
  };

  const runPreset = (preset: (typeof QA_PRESETS)[number]) => {
    const { match, events } = buildQaMatch(preset.settings);
    setSettings(preset.settings);
    setPresetHint(preset.hint);
    setPlaying(false);
    const target = preset.seek ? preset.seek(events, match) : null;
    if (preset.seek && target === null) {
      setClock(0);
      setSeekNote("This seed produced no such moment — try another seed.");
    } else {
      setClock(target ?? 0);
      setSeekNote(target === null ? null : `Sought to ${formatMatchClock(target)}.`);
    }
  };

  const frame = frameAtMatchSeconds(built.frames, clock) ?? built.frames[0];
  const scene = useMemo(() => (frame ? snapshotToScene(frame.snapshot) : null), [frame]);

  const latestEvent = useMemo(() => {
    let found: CanonicalMatchEvent | null = null;
    for (const event of built.events) {
      if (event.matchSeconds > clock) break;
      found = event;
    }
    return found;
  }, [built.events, clock]);

  const recentEvents = useMemo(
    () => built.events.filter((e) => e.matchSeconds <= clock).slice(-14).reverse(),
    [built.events, clock],
  );

  // Which side has the ball in this frame, which decides which goal each side
  // is defending.
  const possessionIsHome = useMemo(() => {
    const id = frame?.snapshot.ball.possessorPlayerId;
    return id ? built.match.finalState.rosters.HOME.includes(id) : true;
  }, [built.match, frame]);

  const teams = useMemo(
    () =>
      frame
        ? readTeams(
            built.match,
            frame.snapshot.players.map((p) => ({ id: p.id, x: p.x, y: p.y })),
            settings,
            // The side in possession attacks `attackingGoalSide`, so its OWN
            // goal is the other one; the defending side's own goal is that one.
            frame.snapshot.court.attackingGoalSide === "TOP"
              ? { HOME: possessionIsHome ? "BOTTOM" : "TOP", AWAY: possessionIsHome ? "TOP" : "BOTTOM" }
              : { HOME: possessionIsHome ? "TOP" : "BOTTOM", AWAY: possessionIsHome ? "BOTTOM" : "TOP" },
          )
        : [],
    [built.match, frame, settings, possessionIsHome],
  );

  const conditions = useMemo(
    () => (settings.fatigue && frame ? readConditions(built.match, frame.snapshot.players.map((p) => p.id)) : []),
    [built.match, frame, settings.fatigue],
  );

  // Fit the portrait court into the landscape stage.
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
    const scale = Math.min(stage.width / 40, stage.height / 20);
    const s = Number.isFinite(scale) && scale > 0 ? scale : 0;
    return { width: 20 * s, height: 40 * s };
  }, [stage.width, stage.height]);

  // Presentation loop: real elapsed time * speed advances the official clock.
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
        const next = advancePlaybackClock(current, deltaRealSeconds, speed, built.duration);
        if (next >= built.duration) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, built.duration]);

  if (!frame || !scene) return <div style={{ padding: 24 }}>No match to play back.</div>;

  const possessorId = frame.snapshot.ball.possessorPlayerId;
  const possessor = possessorId ? frame.snapshot.players.find((p) => p.id === possessorId) : undefined;
  const possessionTeam = possessorId ? teams.find((t) => built.match.finalState.rosters[t.team].includes(possessorId)) : undefined;

  return (
    // QA GATE 1: a FIXED viewport height, not a percentage one.
    //
    // The court grew steadily through a match, and the cause was here rather
    // than in any geometry: `height: 100%` collapses to content height unless
    // every ancestor has a height, so the page was sized by its own content.
    // The event list and the condition list grow as a match runs, that made the
    // sidebar taller, the row taller and the stage taller -- and the court is
    // fitted to the stage, so it scaled up with it. Pinning the page to the
    // viewport and letting only the inner lists scroll makes the court's size a
    // function of the window and nothing else.
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", minHeight: 0, overflow: "hidden" }}>
      {/* ---------------- controls ---------------- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--hm-border-subtle)", background: "var(--hm-surface-2)" }}>
        <strong style={{ fontSize: 13, letterSpacing: 0.5 }}>MATCH 2D — QA</strong>

        <button type="button" className="hm-btn hm-btn-primary" onClick={() => setPlaying((p) => !p)}>
          {playing ? "PAUSE" : "PLAY"}
        </button>
        <button type="button" className="hm-btn" onClick={() => { setPlaying(false); setClock(0); setSeekNote(null); }}>
          RESTART
        </button>
        <span style={{ display: "flex", gap: 4 }}>
          {PLAYBACK_SPEEDS.map((s) => (
            <button key={s} type="button" className={s === speed ? "hm-btn hm-btn-primary" : "hm-btn"} onClick={() => setSpeed(s)}>
              {s}x
            </button>
          ))}
        </span>

        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          seed
          <input
            type="number"
            value={settings.seed}
            onChange={(e) => apply({ seed: Number(e.target.value) || 0 })}
            style={{ width: 74 }}
          />
        </label>

        {(["home", "away"] as const).map((side) => (
          <span key={side} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
            <span style={{ opacity: 0.7, textTransform: "uppercase" }}>{side} def</span>
            {DEFENCE_SYSTEMS.map((system) => (
              <button
                key={system.id}
                type="button"
                className={settings[side] === system.id ? "hm-btn hm-btn-primary" : "hm-btn"}
                onClick={() => apply({ [side]: system.id as DefenceSystemId } as Partial<QaSettings>)}
              >
                {system.label}
              </button>
            ))}
          </span>
        ))}

        <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>FATIGUE</span>
          <button type="button" className={!settings.fatigue ? "hm-btn hm-btn-primary" : "hm-btn"} onClick={() => apply({ fatigue: false })}>OFF</button>
          <button type="button" className={settings.fatigue ? "hm-btn hm-btn-primary" : "hm-btn"} onClick={() => apply({ fatigue: true })}>ON</button>
        </span>

        <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>HOME 7v6</span>
          <button type="button" className={!settings.sevenOut ? "hm-btn hm-btn-primary" : "hm-btn"} onClick={() => apply({ sevenOut: false })}>OFF</button>
          <button type="button" className={settings.sevenOut ? "hm-btn hm-btn-primary" : "hm-btn"} onClick={() => apply({ sevenOut: true })}>ON</button>
        </span>
      </div>

      {/* ---------------- presets ---------------- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "6px 12px", borderBottom: "1px solid var(--hm-border-subtle)" }}>
        <span style={{ fontSize: 11, opacity: 0.6, marginRight: 4 }}>PRESETS</span>
        {QA_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="hm-btn" onClick={() => runPreset(preset)} title={preset.hint}>
            {preset.label}
          </button>
        ))}
        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}>
          {presetHint}
          {seekNote ? ` — ${seekNote}` : ""}
        </span>
      </div>

      {/* ---------------- seek ---------------- */}
      <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--hm-border-subtle)" }}>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(built.duration))}
          value={Math.round(clock)}
          onChange={(e) => setClock(Number(e.target.value))}
          style={{ width: "100%" }}
          aria-label="Seek"
        />
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* ---------------- court ---------------- */}
        <div
          ref={stageRef}
          style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden", ...designSystemTheme, background: "var(--ds-color-background)" }}
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

        {/* ---------------- debug ---------------- */}
        <div style={{ width: 340, flexShrink: 0, minHeight: 0, borderLeft: "1px solid var(--hm-border-subtle)", overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={panel}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              HOME {frame.score.HOME} – {frame.score.AWAY} AWAY
            </div>
            <div>{formatMatchClock(frame.matchSeconds)} · half {frame.half}</div>
            <div>phase: <strong>{phaseAt(built.match, frame.matchSeconds)}</strong></div>
            <div>
              possession: <strong>{possessionTeam?.team ?? "—"}</strong>
              {possessor ? ` · ${possessor.id}` : ""} · ball {frame.snapshot.ball.status}
            </div>
            <div>seed {settings.seed} · fatigue {settings.fatigue ? "ON" : "OFF"} · sim {frame.simulationTime.toFixed(1)}s</div>
          </div>

          {teams.map((t) => (
            <div key={t.team} style={panel}>
              <div style={{ fontWeight: 600 }}>{t.team}</div>
              <div>defence: <strong>{DEFENCE_SYSTEMS.find((s) => s.id === t.defenceSystem)?.label ?? t.defenceSystem}</strong></div>
              <div>
                on court: <strong>{t.onCourt}</strong> ({t.fieldPlayers} outfield
                {t.goalkeeperOnCourt ? " + GK" : ", NO GK"})
              </div>
              <div style={{ color: t.goalGuarded ? undefined : "var(--hm-danger, #e66)" }}>
                goal: <strong>{t.goalGuarded ? "guarded" : "EMPTY"}</strong>
                {t.goalkeeperOnCourt && !t.goalGuarded ? " (GK on court, not yet in goal)" : ""}
                {t.fieldPlayers === 7 ? " · playing 7v6" : ""}
              </div>
            </div>
          ))}

          <div style={panel}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>CANONICAL EVENTS</div>
            <div style={{ opacity: 0.65, marginBottom: 4 }}>latest: {latestEvent ? describeEvent(latestEvent) : "—"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflowY: "auto" }}>
              {recentEvents.map((e, i) => (
                <div key={`${e.sequence}-${i}`} style={{ opacity: i === 0 ? 1 : 0.7 }}>
                  {describeEvent(e)}
                </div>
              ))}
            </div>
          </div>

          {/*
            Kept visibly separate from the canonical events above. This is the
            engine's own development note for the frame on screen -- what it
            says it is doing -- so a human can compare it with what the court
            shows. It is never a data source.
          */}
          <div style={panel}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>DECISION TRACE (not canonical)</div>
            <div style={{ opacity: 0.8, minHeight: 32 }}>{frame.note || "—"}</div>
          </div>

          {settings.fatigue ? (
            <div style={panel}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>CONDITION (full time)</div>
              <div style={{ opacity: 0.6, marginBottom: 4 }}>player · condition · max speed · acceleration</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
                {conditions.map((c) => (
                  <div key={c.playerId} style={{ display: "flex", gap: 6, opacity: c.onCourt ? 1 : 0.6 }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.onCourt ? "" : "🪑 "}
                      {c.playerId}
                    </span>
                    <span>{c.condition.toFixed(3)}</span>
                    <span>{c.maxSpeed.toFixed(2)} m/s</span>
                    <span>{c.acceleration.toFixed(2)} m/s²</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
