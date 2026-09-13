"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MasterCourtDisplay from "../../components/matchPlan/MasterCourtDisplay";
import { designSystemTheme } from "@handball-manager/match-renderer/src/ui/design-system/index";
import { snapshotToScene } from "@handball-manager/match-integration/src/fieldAdapter";
import { v2RenderSnapshot } from "@handball-manager/match-integration/src/v2Snapshot";
import { createCentreThrowOff } from "@handball-manager/handball-engine/src/v2/scenario";
import { advancePlayback, createReplay, currentSnapshot, eventHash, loadScenario, saveScenario, seekReplay, stateHash, stepReplay } from "@handball-manager/handball-engine/src/v2/replay";
import type { Direction, RestartContext } from "@handball-manager/handball-engine/src/v2/model";
import "./scenario-lab.css";

export default function ScenarioLab() {
  const [seed,setSeed]=useState("2025");
  const [direction,setDirection]=useState<Direction>("TOP");
  const [context,setContext]=useState<RestartContext>("OPENING_HALF");
  const [replay,setReplay]=useState(()=>createReplay(createCentreThrowOff({seed:2025})));
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(.25);
  const [saved,setSaved]=useState("");
  const [error,setError]=useState("");
  const state=currentSnapshot(replay);
  const scene=useMemo(()=>snapshotToScene(v2RenderSnapshot(state)),[state]);
  useEffect(()=>{
    if(!playing) return;
    let previous=performance.now();
    const timer=setInterval(()=>{ const now=performance.now(); const elapsed=now-previous; previous=now; setReplay(r=>advancePlayback(r,elapsed,speed)); },50);
    return ()=>clearInterval(timer);
  },[playing,speed]);
  useEffect(()=>{if(state.status!=="RUNNING" && replay.cursor===replay.snapshots.length-1) setPlaying(false);},[state.status,replay.cursor,replay.snapshots.length]);
  function reset(){try {if(!seed.trim()) throw new Error("Enter an unsigned integer seed"); setReplay(createReplay(createCentreThrowOff({seed:Number(seed),direction,context})));setPlaying(false);setError("");}catch(e){setError(String(e));}}
  function reload(){try{const loaded=loadScenario(saved);setReplay(createReplay(loaded));setSeed(String(loaded.seed));setDirection(loaded.direction);setContext(loaded.restart.context);setPlaying(false);setError("");}catch(e){setError(String(e));}}
  function download(){const text=saveScenario(state);setSaved(text);const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`centre-throw-off-${state.seed}-tick-${state.tick}.json`;a.click();URL.revokeObjectURL(url);}
  return <main className="scenario-lab" style={designSystemTheme}>
    <header><small>HANDBALL ENGINE V2 · MILESTONE 1</small><h1>Centre throw-off lab</h1><p>Controlled baseline · IHF indoor 2025, throw-off area · exact 50 ms snapshots</p><Link href="/scenario-lab/core">Possession &amp; transition lab →</Link></header>
    <section className="lab-controls" aria-label="Scenario controls">
      <label>Seed<input aria-label="Seed" value={seed} onChange={e=>setSeed(e.target.value)}/></label>
      <label>Attack direction<select value={direction} onChange={e=>setDirection(e.target.value as Direction)}><option value="TOP">Top goal</option><option value="BOTTOM">Bottom goal</option></select></label>
      <label>Restart context<select value={context} onChange={e=>setContext(e.target.value as RestartContext)}><option value="OPENING_HALF">Opening half</option><option value="POST_GOAL">After goal</option></select></label>
      <button onClick={reset}>Start / reset</button><button onClick={()=>setPlaying(p=>!p)} disabled={state.status!=="RUNNING" && replay.cursor===replay.snapshots.length-1}>{playing?"Pause":"Play"}</button>
      <button onClick={()=>{setPlaying(false);setReplay(stepReplay);}}>Single tick</button>
      <label>Playback<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2,4].map(s=><option key={s} value={s}>{s}×</option>)}</select></label>
    </section>
    {error && <p role="alert">{error}</p>}
    <div className="lab-grid">
      <section className="lab-court" aria-label="FIELD court, exact current snapshot"><MasterCourtDisplay scene={scene}/></section>
      <section className="lab-inspector" aria-label="Authoritative state">
        <h2 data-testid="stage">{state.stage}</h2><p>{state.status} · tick <strong>{state.tick}</strong> · simulation {(state.timeMs/1000).toFixed(2)} s</p>
        <p>Official clock {(state.officialClock.timeMs/1000).toFixed(2)} s · {state.officialClock.running?"running":"stopped"}</p>
        <p>Active: seed {state.seed} · {state.direction} · {state.restart.context}</p>
        <dl><dt>Restart</dt><dd>{state.restart.phase} · {state.restart.id}</dd><dt>Taker → receiver</dt><dd>{state.restart.takerId} → {state.restart.receiverId}</dd><dt>Ball</dt><dd>{state.ball.status} · {state.ball.inPlay?"LIVE":"DEAD"}</dd><dt>Controller</dt><dd>{state.ball.controllerId??"None"}</dd><dt>Ball position</dt><dd>{state.ball.position.x.toFixed(4)}, {state.ball.position.y.toFixed(4)} m</dd><dt>Intended receiver</dt><dd>{state.ball.intendedReceiverId}</dd><dt>Flight</dt><dd>{state.ball.flight?`${state.ball.flight.actionId} · released tick ${state.ball.flight.releasedTick}`:"None"}</dd><dt>State / event fingerprints</dt><dd><code>{stateHash(state)} / {eventHash(state)}</code></dd><dt>RNG</dt><dd>{state.rng.algorithm} · {state.rng.state} · {state.rng.draws} draws</dd></dl>
        {state.failure && <p role="alert">{state.failure}</p>}
        <label>Historical snapshot {replay.cursor+1} / {replay.snapshots.length}<input aria-label="Historical snapshot" type="range" min="0" max={replay.snapshots.length-1} value={replay.cursor} onChange={e=>{setPlaying(false);setReplay(r=>seekReplay(r,Number(e.target.value)));}}/></label>
        <p className="lab-note">The receiver waits inside the area. Reception completes this restart. Live play is the end of this milestone.</p>
      </section>
    </div>
    <section className="lab-table"><h2>Players at tick {state.tick}</h2><table><thead><tr>{["Stable ID / team","Role / responsibility","Position / velocity (m, m/s)","Intent","Action / phase / ID"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{state.players.map(p=><tr key={p.identity.id}><td>{p.identity.id}<br/>{p.identity.teamId} · {p.identity.kind}</td><td>{p.assignment.role}<br/>{p.assignment.responsibility}</td><td>{p.position.x.toFixed(3)}, {p.position.y.toFixed(3)}<br/>{p.velocity.x.toFixed(3)}, {p.velocity.y.toFixed(3)}</td><td>{p.intent.kind}<br/><small>{p.intent.id}</small></td><td>{p.action?<>{p.action.kind} · {p.action.phase}<br/><small>{p.action.id} · phase tick {p.action.phaseTick}</small></>:"None"}</td></tr>)}</tbody></table></section>
    <section><h2>Canonical events through tick {state.tick}</h2><div className="lab-events">{state.events.length===0?<p>No transitions yet.</p>:state.events.map(e=><p key={e.id}><strong>{e.tick} · {(e.timeMs/1000).toFixed(2)} s · {e.type}</strong><br/><small>{e.id} · {e.actionId??"restart"} · {JSON.stringify(e.details)}</small></p>)}</div></section>
    <section><h2>Save / reload</h2><p>Save includes the current tick, actions, clock, events and RNG. Reload starts history at that exact tick.</p><div className="lab-controls"><button onClick={()=>setSaved(saveScenario(state))}>Save state to text</button><button onClick={download}>Download save</button><button onClick={reload} disabled={!saved}>Reload state</button><label>Open save file<input aria-label="Open save file" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(file)setSaved(await file.text());}}/></label></div><textarea aria-label="Saved scenario JSON" value={saved} onChange={e=>setSaved(e.target.value)} placeholder="Save JSON appears here. Paste or open a saved state, then reload."/></section>
    <details><summary>Complete exact snapshot / rule profile</summary><pre>{JSON.stringify(state,null,2)}</pre></details>
  </main>;
}
