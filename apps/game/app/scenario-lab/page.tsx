"use client";

// Arena Nights SYS-03 (A) "Gate under dev console": the engine V2 lab index -- lab list on top,
// then the centre throw-off lab as court (9) + controls/inspector (3) inside the dev shell.
// Gated by app/scenario-lab/layout.tsx (isEditorEnabled). Engine calls are unchanged.
import { useEffect, useMemo, useState } from "react";
import MasterCourtDisplay from "../../components/matchPlan/MasterCourtDisplay";
import { DevPageHead } from "@/components/dev/DevShell";
import { designSystemTheme } from "@handball-manager/match-renderer/src/ui/design-system/index";
import { snapshotToScene } from "@handball-manager/match-integration/src/fieldAdapter";
import { v2RenderSnapshot } from "@handball-manager/match-integration/src/v2Snapshot";
import { createCentreThrowOff } from "@handball-manager/handball-engine/src/v2/scenario";
import { advancePlayback, createReplay, currentSnapshot, eventHash, loadScenario, saveScenario, seekReplay, stateHash, stepReplay } from "@handball-manager/handball-engine/src/v2/replay";
import type { Direction, RestartContext } from "@handball-manager/handball-engine/src/v2/model";
import { LabList } from "./LabList";
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
  // Playback stops by itself at the end of the recorded run (derived, not synced through an effect).
  const atEnd=state.status!=="RUNNING" && replay.cursor===replay.snapshots.length-1;
  const live=playing&&!atEnd;
  useEffect(()=>{
    if(!live) return;
    let previous=performance.now();
    const timer=setInterval(()=>{ const now=performance.now(); const elapsed=now-previous; previous=now; setReplay(r=>advancePlayback(r,elapsed,speed)); },50);
    return ()=>clearInterval(timer);
  },[live,speed]);
  function reset(){try {if(!seed.trim()) throw new Error("Ange ett heltal (seed) utan tecken."); setReplay(createReplay(createCentreThrowOff({seed:Number(seed),direction,context})));setPlaying(false);setError("");}catch(e){setError(String(e));}}
  function reload(){try{const loaded=loadScenario(saved);setReplay(createReplay(loaded));setSeed(String(loaded.seed));setDirection(loaded.direction);setContext(loaded.restart.context);setPlaying(false);setError("");}catch(e){setError(String(e));}}
  function download(){const text=saveScenario(state);setSaved(text);const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`centre-throw-off-${state.seed}-tick-${state.tick}.json`;a.click();URL.revokeObjectURL(url);}

  return <div className="scenario-lab">
    <DevPageHead eyebrow="Motorlabb · Handball Engine V2 · milstolpe 1" title="Scenario lab · mittkast" note="Kontrollerad baslinje enligt IHF inomhus 2025 (mittkastområdet), exakta 50 ms-snapshots. Mottagningen avslutar restarten." />
    <LabList />
    {error && <p className="hm-dev-alert" role="alert">{error}</p>}
    <div className="hm-dev-split">
      <section className="hm-dev-panel" aria-label="FIELD-plan, exakt aktuell snapshot">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Plan</span><span className="hm-dev-num hm-dev-muted">tick {state.tick} · {(state.timeMs/1000).toFixed(2)} s</span></div>
        <div className="lab-court" style={designSystemTheme}><MasterCourtDisplay scene={scene}/></div>
      </section>
      <aside className="hm-dev-sticky">
        <section className="hm-dev-panel" aria-label="Scenariokontroller">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Kör</span></div>
          <div className="hm-dev-panel-body lab-form">
            <label>Seed<input aria-label="Seed" className="hm-dev-num" value={seed} onChange={e=>setSeed(e.target.value)}/></label>
            <label>Anfallsriktning<select value={direction} onChange={e=>setDirection(e.target.value as Direction)}><option value="TOP">Övre mål</option><option value="BOTTOM">Nedre mål</option></select></label>
            <label>Restartläge<select value={context} onChange={e=>setContext(e.target.value as RestartContext)}><option value="OPENING_HALF">Halvleksstart</option><option value="POST_GOAL">Efter mål</option></select></label>
            <div className="lab-row">
              <button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={reset}>Starta / nollställ</button>
              <button type="button" className="hm-dev-btn" onClick={()=>setPlaying(!live)} disabled={atEnd}>{live?"Pausa":"Spela"}</button>
              <button type="button" className="hm-dev-btn" onClick={()=>{setPlaying(false);setReplay(stepReplay);}}>En tick</button>
            </div>
            {atEnd && <span className="lab-note">Scenariot är slut ({state.status}). Nollställ för att spela igen.</span>}
            <label>Uppspelning<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2,4].map(s=><option key={s} value={s}>{s}×</option>)}</select></label>
            <label>Historisk snapshot <span className="hm-dev-num">{replay.cursor+1} / {replay.snapshots.length}</span><input aria-label="Historisk snapshot" type="range" min="0" max={replay.snapshots.length-1} value={replay.cursor} onChange={e=>{setPlaying(false);setReplay(r=>seekReplay(r,Number(e.target.value)));}}/></label>
          </div>
        </section>
        <section className="hm-dev-panel" aria-label="Auktoritativt tillstånd">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Inspektör</span></div>
          <div className="hm-dev-panel-body">
            <h2 data-testid="stage">{state.stage}</h2>
            <p className="hm-dev-num">{state.status} · tick <strong>{state.tick}</strong> · sim {(state.timeMs/1000).toFixed(2)} s</p>
            <p className="hm-dev-num">Officiell klocka {(state.officialClock.timeMs/1000).toFixed(2)} s · {state.officialClock.running?"går":"stoppad"}</p>
            <p className="lab-note">Aktivt: seed {state.seed} · {state.direction} · {state.restart.context}</p>
            <dl className="lab-dl"><dt>Restart</dt><dd>{state.restart.phase} · {state.restart.id}</dd><dt>Kastare → mottagare</dt><dd>{state.restart.takerId} → {state.restart.receiverId}</dd><dt>Boll</dt><dd>{state.ball.status} · {state.ball.inPlay?"LIVE":"DÖD"}</dd><dt>Kontrollant</dt><dd>{state.ball.controllerId??"Ingen"}</dd><dt>Bollposition</dt><dd className="hm-dev-num">{state.ball.position.x.toFixed(4)}, {state.ball.position.y.toFixed(4)} m</dd><dt>Tänkt mottagare</dt><dd>{state.ball.intendedReceiverId}</dd><dt>Flykt</dt><dd>{state.ball.flight?`${state.ball.flight.actionId} · släppt tick ${state.ball.flight.releasedTick}`:"Ingen"}</dd><dt>Fingeravtryck (state / event)</dt><dd><code>{stateHash(state)} / {eventHash(state)}</code></dd><dt>RNG</dt><dd className="hm-dev-num">{state.rng.algorithm} · {state.rng.state} · {state.rng.draws} drag</dd></dl>
            {state.failure && <p className="hm-dev-alert" role="alert">{state.failure}</p>}
          </div>
        </section>
      </aside>
    </div>

    <section className="hm-dev-panel lab-table" style={{marginTop:12}}>
      <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Spelare vid tick {state.tick}</span></div>
      <div className="hm-dev-table-wrap"><table className="hm-dev-table"><thead><tr>{["Stabilt id / lag","Roll / ansvar","Position / hastighet (m, m/s)","Avsikt","Aktion / fas / id"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{state.players.map(p=><tr key={p.identity.id}><td>{p.identity.id}<br/><small>{p.identity.teamId} · {p.identity.kind}</small></td><td>{p.assignment.role}<br/><small>{p.assignment.responsibility}</small></td><td className="hm-dev-num">{p.position.x.toFixed(3)}, {p.position.y.toFixed(3)}<br/>{p.velocity.x.toFixed(3)}, {p.velocity.y.toFixed(3)}</td><td>{p.intent.kind}<br/><small>{p.intent.id}</small></td><td>{p.action?<>{p.action.kind} · {p.action.phase}<br/><small>{p.action.id} · fas-tick {p.action.phaseTick}</small></>:"Ingen"}</td></tr>)}</tbody></table></div>
    </section>
    <div className="hm-dev-split hm-dev-split--6-6" style={{marginTop:12}}>
      <section className="hm-dev-panel">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Kanoniska händelser t.o.m. tick {state.tick}</span><span className="hm-dev-num hm-dev-muted">{state.events.length}</span></div>
        <div className="hm-dev-panel-body lab-events">{state.events.length===0?<p className="hm-dev-muted">Inga övergångar ännu. Spela eller stega för att se händelser.</p>:state.events.map(e=><p key={e.id}><strong className="hm-dev-num">{e.tick} · {(e.timeMs/1000).toFixed(2)} s · {e.type}</strong><br/><small>{e.id} · {e.actionId??"restart"} · {JSON.stringify(e.details)}</small></p>)}</div>
      </section>
      <section className="hm-dev-panel">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Spara / ladda om</span></div>
        <div className="hm-dev-panel-body lab-form">
          <p className="lab-note">Sparningen innehåller aktuell tick, aktioner, klocka, händelser och RNG. Omladdning startar historiken på exakt den ticken.</p>
          <div className="lab-row"><button type="button" className="hm-dev-btn" onClick={()=>setSaved(saveScenario(state))}>Spara till text</button><button type="button" className="hm-dev-btn" onClick={download}>Ladda ner</button><button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={reload} disabled={!saved}>Ladda om</button></div>
          {!saved && <span className="lab-note">Ladda om kräver sparad JSON nedan: spara, klistra in eller öppna en fil först.</span>}
          <label>Öppna sparfil<input aria-label="Öppna sparfil" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(file)setSaved(await file.text());}}/></label>
          <textarea aria-label="Sparat scenario (JSON)" value={saved} onChange={e=>setSaved(e.target.value)} placeholder="Sparad JSON visas här. Klistra in eller öppna ett sparat läge och ladda sedan om."/>
        </div>
      </section>
    </div>
    <details><summary>Fullständig exakt snapshot / regelprofil</summary><pre>{JSON.stringify(state,null,2)}</pre></details>
  </div>;
}
