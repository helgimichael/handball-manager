"use client";

// HUMAN QA GATE 1: the Match 2D QA harness.
//
// Arena Nights SYS-04 (A) "Gated QA harness with control panel": gated by app/match-qa/layout.tsx
// (isEditorEnabled, 404 otherwise) and rendered in the dev shell -- court (9) + a right control
// panel grouped Uppspelning / Scenario / Växlar, then the read-outs. Only the UI shell changed.
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

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  readDefenders,
  defenceSummaryAt,
  phaseAt,
  type DefenceSystemId,
  type QaSettings,
} from "../../lib/matchQa/qaHarness";
import "./match-qa.css";

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
      setSeekNote("Den här seeden gav inget sådant ögonblick – prova en annan seed.");
    } else {
      setClock(target ?? 0);
      setSeekNote(target === null ? null : `Hoppade till ${formatMatchClock(target)}.`);
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

  // The side NOT in possession is the one defending, and the one whose roles
  // the decision trace is naming.
  const defenders = useMemo(
    () =>
      frame
        ? readDefenders(
            built.match,
            frame.snapshot.players.map((p) => ({ id: p.id, x: p.x, y: p.y })),
            possessionIsHome ? "AWAY" : "HOME",
          )
        : [],
    [built.match, frame, possessionIsHome],
  );

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

  if (!frame || !scene) return <p className="hm-dev-empty">Ingen match att spela upp. Byt seed eller välj ett preset.</p>;

  const possessorId = frame.snapshot.ball.possessorPlayerId;
  const possessor = possessorId ? frame.snapshot.players.find((p) => p.id === possessorId) : undefined;
  const possessionTeam = possessorId ? teams.find((t) => built.match.finalState.rosters[t.team].includes(possessorId)) : undefined;
  const atEnd = clock >= built.duration;

  return (
    // QA GATE 1: a FIXED viewport height, not a percentage one.
    //
    // The court grew steadily through a match, and the cause was here rather
    // than in any geometry: `height: 100%` collapses to content height unless
    // every ancestor has a height, so the page was sized by its own content.
    // The event list and the condition list grow as a match runs, that made the
    // sidebar taller, the row taller and the stage taller -- and the court is
    // fitted to the stage, so it scaled up with it. Pinning the page to the
    // viewport (minus the dev ribbon, see match-qa.css) and letting only the
    // right column scroll makes the court's size a function of the window.
    <div className="mqa">
      {/* ---------------- court (9) ---------------- */}
      <section className="mqa-court hm-dev-panel" aria-label="Plan">
        <div className="hm-dev-panel-head">
          <span className="hm-dev-panel-title">Match 2D · QA</span>
          <span className="hm-dev-num">
            <strong>HOME {frame.score.HOME} – {frame.score.AWAY} AWAY</strong>
            <span className="hm-dev-muted"> · {formatMatchClock(frame.matchSeconds)} · halvlek {frame.half}</span>
          </span>
        </div>
        <div ref={stageRef} className="mqa-stage" style={designSystemTheme}>
          <div className="mqa-court-rotor" style={{ width: courtPixels.width, height: courtPixels.height }}>
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
        <div className="mqa-seek">
          <span className="hm-dev-num">{formatMatchClock(clock)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.round(built.duration))}
            value={Math.round(clock)}
            onChange={(e) => setClock(Number(e.target.value))}
            aria-label="Spola"
          />
          <span className="hm-dev-num hm-dev-muted">{formatMatchClock(built.duration)}</span>
        </div>
      </section>

      {/* ---------------- control panel (3) ---------------- */}
      <aside className="mqa-side" aria-label="Kontrollpanel">
        <section className="hm-dev-panel">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Uppspelning</span></div>
          <div className="hm-dev-panel-body mqa-stack">
            <div className="mqa-row">
              <button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={() => setPlaying((p) => !p)} disabled={atEnd && !playing}>
                {playing ? "Pausa" : "Spela"}
              </button>
              <button type="button" className="hm-dev-btn" onClick={() => { setPlaying(false); setClock(0); setSeekNote(null); }}>
                Börja om
              </button>
            </div>
            {atEnd && !playing ? <span className="hm-dev-muted">Slutsignal – börja om eller spola bakåt för att spela igen.</span> : null}
            <div className="mqa-field">
              <span className="mqa-label">Hastighet</span>
              <div className="hm-dev-chips" role="group" aria-label="Hastighet">
                {PLAYBACK_SPEEDS.map((s) => (
                  <button key={s} type="button" className="hm-dev-chip" aria-pressed={s === speed} onClick={() => setSpeed(s)}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="hm-dev-panel">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Scenario</span></div>
          <div className="hm-dev-panel-body mqa-stack">
            <label className="mqa-field">
              <span className="mqa-label">Seed</span>
              <input type="number" value={settings.seed} onChange={(e) => apply({ seed: Number(e.target.value) || 0 })} style={{ width: 110 }} />
            </label>
            <div className="mqa-field">
              <span className="mqa-label">Presets</span>
              <div className="mqa-presets">
                {QA_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" className="hm-dev-btn hm-dev-btn--sm" onClick={() => runPreset(preset)} title={preset.hint}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <span className="hm-dev-muted">
                {presetHint}
                {seekNote ? ` — ${seekNote}` : ""}
              </span>
            </div>
          </div>
        </section>

        <section className="hm-dev-panel">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Växlar</span><span className="hm-dev-muted">bygger om matchen</span></div>
          <div className="hm-dev-panel-body mqa-stack">
            {(["home", "away"] as const).map((side) => (
              <div key={side} className="mqa-field">
                <span className="mqa-label">Försvar {side === "home" ? "HOME" : "AWAY"}</span>
                <div className="hm-dev-chips" role="group" aria-label={`Försvar ${side === "home" ? "HOME" : "AWAY"}`}>
                  {DEFENCE_SYSTEMS.map((system) => (
                    <button
                      key={system.id}
                      type="button"
                      className="hm-dev-chip"
                      aria-pressed={settings[side] === system.id}
                      onClick={() => apply({ [side]: system.id as DefenceSystemId } as Partial<QaSettings>)}
                    >
                      {system.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mqa-field">
              <span className="mqa-label">Trötthet</span>
              <div className="hm-dev-chips" role="group" aria-label="Trötthet">
                <button type="button" className="hm-dev-chip" aria-pressed={!settings.fatigue} onClick={() => apply({ fatigue: false })}>AV</button>
                <button type="button" className="hm-dev-chip" aria-pressed={settings.fatigue} onClick={() => apply({ fatigue: true })}>PÅ</button>
              </div>
            </div>
            <div className="mqa-field">
              <span className="mqa-label">HOME 7 mot 6</span>
              <div className="hm-dev-chips" role="group" aria-label="HOME 7 mot 6">
                <button type="button" className="hm-dev-chip" aria-pressed={!settings.sevenOut} onClick={() => apply({ sevenOut: false })}>AV</button>
                <button type="button" className="hm-dev-chip" aria-pressed={settings.sevenOut} onClick={() => apply({ sevenOut: true })}>PÅ</button>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- read-outs ---------------- */}
        <section className="hm-dev-panel">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Läge</span></div>
          <div className="hm-dev-panel-body hm-dev-num mqa-readout">
            <div>fas: <strong>{phaseAt(built.match, frame.matchSeconds)}</strong></div>
            <div>
              bollinnehav: <strong>{possessionTeam?.team ?? "—"}</strong>
              {possessor ? ` · ${possessor.id}` : ""} · boll {frame.snapshot.ball.status}
            </div>
            <div>seed {settings.seed} · trötthet {settings.fatigue ? "PÅ" : "AV"} · sim {frame.simulationTime.toFixed(1)} s</div>
            {teams.map((t) => (
              <div key={t.team} className="mqa-team">
                <strong>{t.team}</strong> · försvar {DEFENCE_SYSTEMS.find((s) => s.id === t.defenceSystem)?.label ?? t.defenceSystem}
                <div>
                  på plan: <strong>{t.onCourt}</strong> ({t.fieldPlayers} utespelare{t.goalkeeperOnCourt ? " + MV" : ", INGEN MV"})
                </div>
                <div className={t.goalGuarded ? undefined : "hm-dev-neg"}>
                  mål: <strong>{t.goalGuarded ? "bevakat" : "TOMT"}</strong>
                  {t.goalkeeperOnCourt && !t.goalGuarded ? " (MV på plan, inte i mål än)" : ""}
                  {t.fieldPlayers === 7 ? " · spelar 7 mot 6" : ""}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/*
          QA instrumentation, not a model. The decision trace names defenders
          by ROLE and roles are reassigned by lane at every change of
          possession, so "R2 has the ball" is unverifiable on screen unless a
          human can see which marker is R2 right now. This table is that, and
          nothing else: ids, roles and the coordinates already in the frame.
        */}
        <details className="hm-dev-panel mqa-details" open>
          <summary className="hm-dev-panel-head"><span className="hm-dev-panel-title">Vem är vem (försvarande lag)</span></summary>
          <div className="hm-dev-panel-body">
            <div className="hm-dev-muted mqa-sub">{defenceSummaryAt(built.match, frame.matchSeconds)}</div>
            <div className="mqa-who hm-dev-num">
              {defenders.map((d) => (
                <Fragment key={d.playerId}>
                  <strong>{d.role}</strong>
                  <span className="hm-dev-muted">…{d.shortId}</span>
                  <span className="hm-dev-muted">({d.x.toFixed(1)}, {d.y.toFixed(1)})</span>
                </Fragment>
              ))}
              {defenders.length === 0 ? <span className="hm-dev-muted">—</span> : null}
            </div>
          </div>
        </details>

        <details className="hm-dev-panel mqa-details" open>
          <summary className="hm-dev-panel-head"><span className="hm-dev-panel-title">Kanoniska händelser</span></summary>
          <div className="hm-dev-panel-body">
            <div className="hm-dev-muted mqa-sub">senaste: {latestEvent ? describeEvent(latestEvent) : "—"}</div>
            <div className="mqa-list hm-dev-num">
              {recentEvents.length === 0 ? <span className="hm-dev-muted">Inga händelser än – tryck Spela.</span> : null}
              {recentEvents.map((e, i) => (
                <div key={`${e.sequence}-${i}`} className={i === 0 ? undefined : "hm-dev-muted"}>
                  {describeEvent(e)}
                </div>
              ))}
            </div>
          </div>
        </details>

        {/*
          Kept visibly separate from the canonical events above. This is the
          engine's own development note for the frame on screen -- what it
          says it is doing -- so a human can compare it with what the court
          shows. It is never a data source.
        */}
        <details className="hm-dev-panel mqa-details" open>
          <summary className="hm-dev-panel-head"><span className="hm-dev-panel-title">Beslutsspår (ej kanoniskt)</span></summary>
          <div className="hm-dev-panel-body mqa-trace">{frame.note || "—"}</div>
        </details>

        {settings.fatigue ? (
          <details className="hm-dev-panel mqa-details" open>
            <summary className="hm-dev-panel-head"><span className="hm-dev-panel-title">Kondition (slutsignal)</span></summary>
            <div className="hm-dev-panel-body">
              <div className="hm-dev-muted mqa-sub">spelare · kondition · maxfart · acceleration</div>
              <div className="mqa-list mqa-list--tall hm-dev-num">
                {conditions.map((c) => (
                  <div key={c.playerId} className={c.onCourt ? "mqa-cond" : "mqa-cond hm-dev-muted"}>
                    <span className="mqa-cond-id">{c.onCourt ? "" : "(bänk) "}{c.playerId}</span>
                    <span>{c.condition.toFixed(3)}</span>
                    <span>{c.maxSpeed.toFixed(2)} m/s</span>
                    <span>{c.acceleration.toFixed(2)} m/s²</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        ) : null}
      </aside>
    </div>
  );
}
