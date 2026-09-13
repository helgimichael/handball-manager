"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import MasterCourtDisplay from '../../../components/matchPlan/MasterCourtDisplay';
import { designSystemTheme } from '@handball-manager/match-renderer/src/ui/design-system/index';
import { snapshotToScene } from '@handball-manager/match-integration/src/fieldAdapter';
import { v2CoreRenderSnapshot } from '@handball-manager/match-integration/src/v2CoreSnapshot';
import { CORE_SCENARIOS, createCoreScenario, type CoreScenario } from '@handball-manager/handball-engine/src/v2/core/scenarios';
import { coreHash, coreEventHash, loadCore, saveCore, replayCore, stepCoreReplay, seekCore, playCore } from '@handball-manager/handball-engine/src/v2/core/replay';
import { CONTACT_SCENARIOS,createContactScenario,type ContactScenario } from '@handball-manager/handball-engine/src/v2/core/contactScenarios';
import { WING_SCENARIOS,createWingScenario,type WingScenario } from '@handball-manager/handball-engine/src/v2/core/wingScenarios';
import { BACKCOURT_SCENARIOS,createBackcourtScenario,type BackcourtScenario } from '@handball-manager/handball-engine/src/v2/core/backcourtScenarios';
import { createContinuous } from '@handball-manager/handball-engine/src/v2/core/continuous';
import type { Direction } from '@handball-manager/handball-engine/src/v2/core/state';
import '../scenario-lab.css';

type LabScenario=CoreScenario|ContactScenario|WingScenario|BackcourtScenario|'CONTINUOUS_PLAY'|'SEVEN_V_SIX';
const options:LabScenario[]=[...CORE_SCENARIOS,...CONTACT_SCENARIOS,...WING_SCENARIOS,...BACKCOURT_SCENARIOS,'CONTINUOUS_PLAY','SEVEN_V_SIX'];
const names:Record<LabScenario,string>={COMPACT_DEFENCE_WIDTH:'Backcourt width against compact defence',PIVOT_INTERVAL_SUPPORT:'Backcourt / pivot interval',PENETRATION_SPACING:'Clear the penetration lane',WING_BACKCOURT_RETURN:'Wing / backcourt return connection',LEFT_WING_LINK:'Left wing / adjacent back',RIGHT_WING_LINK:'Right wing / adjacent back',CLOSED_WING_RETURN:'Closed wing window / return pass',OPEN_WING_FINISH:'Open wing window / actual finish',SHOULDER_BREAKTHROUGH:'Physical shoulder breakthrough',FRONTAL_CONTACT:'Frontal contact and containment',LATE_HOLD:'Late holding attempt',EVADED_CONTACT:'Evaded contact attempt',CONTINUOUS_PLAY:'Continuous play (6 outcomes)',SEVEN_V_SIX:'7v6 and goalkeeper return (6 outcomes)',ESTABLISHED_6V6:'Established 6v6',TRANSITION_3V2:'3v2 transition',FREE_THROW:'Free throw',PIVOT_2V2:'Local 2v2 with pivot',WING_FINISH:'Wing finish / rebound',BACKCOURT_SHOT:'Backcourt jump shot',DEFENSIVE_HELP:'Defensive help',PRESSURE_5_1:'5:1 pressure',EMPTY_GOAL:'Empty-goal opportunity'};
export default function CoreLab() {
  const [scenario,setScenario]=useState<LabScenario>('ESTABLISHED_6V6');
  const [seed,setSeed]=useState('2025');const [direction,setDirection]=useState<Direction>('TOP');
  const [replay,setReplay]=useState(()=>replayCore(createCoreScenario()));
  const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(.25),[saved,setSaved]=useState(''),[error,setError]=useState('');
  const [showActions,setShowActions]=useState(false);
  const s=replay.frames[replay.cursor];
  const scene=useMemo(()=>snapshotToScene(v2CoreRenderSnapshot(s)),[s]);
  const hashes=useMemo(()=>`${coreHash(s)} / ${coreEventHash(s)}`,[s]);
  useEffect(()=>{if(!playing)return;let before=performance.now();const timer=setInterval(()=>{const now=performance.now(),elapsed=now-before;before=now;setReplay(r=>playCore(r,elapsed,speed));},50);return()=>clearInterval(timer);},[playing,speed]);
  useEffect(()=>{if(s.status!=='RUNNING')setPlaying(false);},[s.status]);
  function reset(){try{if(!seed.trim())throw new Error('Enter a seed');setReplay(replayCore(scenario==='CONTINUOUS_PLAY'||scenario==='SEVEN_V_SIX'?createContinuous(scenario,Number(seed),direction):BACKCOURT_SCENARIOS.includes(scenario as BackcourtScenario)?createBackcourtScenario(scenario as BackcourtScenario,Number(seed),direction):WING_SCENARIOS.includes(scenario as WingScenario)?createWingScenario(scenario as WingScenario,Number(seed),direction):CONTACT_SCENARIOS.includes(scenario as ContactScenario)?createContactScenario(scenario as ContactScenario,Number(seed),direction):createCoreScenario(scenario as CoreScenario,Number(seed),direction)));setPlaying(false);setError('');}catch(e){setError(String(e));}}
  function reload(){try{const loaded=loadCore(saved);setReplay(replayCore(loaded));setSeed(String(loaded.seed));setScenario(loaded.scenario as LabScenario);setDirection(loaded.directions.HOME);setPlaying(false);setError('');}catch(e){setError(String(e));}}
  function download(){const data=saveCore(s);setSaved(data);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`v2-${s.scenario}-${s.seed}-${s.tick}.json`;a.click();URL.revokeObjectURL(url);}
  const important=s.events.filter(e=>showActions||!['ACTION_STARTED','ACTION_PHASE','RESPONSIBILITY_ASSIGNED','ACTION_INTERRUPTED'].includes(e.type));
  return <main className="scenario-lab" style={designSystemTheme}>
    <header><small>HANDBALL ENGINE V2 · PLAYABLE CORE CHECKPOINT</small><h1>Possession &amp; transition lab</h1><p>One action / ball / contest model. Single possessions or six consecutive outcomes, including physical restarts and exchanges.</p><Link href="/scenario-lab">Centre throw-off proof →</Link> ? <Link href="/scenario-lab/match">Full-match timeline ?</Link></header>
    <section className="lab-controls" aria-label="Core scenario controls">
      <label>Scenario<select value={scenario} onChange={e=>setScenario(e.target.value as LabScenario)}>{options.map(key=><option value={key} key={key}>{names[key]}</option>)}</select></label>
      <label>Seed<input aria-label="Seed" value={seed} onChange={e=>setSeed(e.target.value)}/></label>
      <label>Home attacks<select value={direction} onChange={e=>setDirection(e.target.value as Direction)}><option value="TOP">Top goal</option><option value="BOTTOM">Bottom goal</option></select></label>
      <button onClick={reset}>Start / reset</button><button disabled={s.status!=='RUNNING'&&replay.cursor===replay.frames.length-1} onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button>
      <button onClick={()=>{setPlaying(false);setReplay(stepCoreReplay);}}>Single tick</button>
      <label>Playback<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
    </section>
    {error&&<p role="alert">{error}</p>}
    <div className="lab-grid"><section className="lab-court" aria-label="FIELD court at selected exact tick"><MasterCourtDisplay scene={scene}/></section>
      <section className="lab-inspector" aria-label="Authoritative core state"><h2>{s.possession.phase} · {s.status}</h2>
        <p>{s.scenario} · seed {s.seed} · HOME → {s.directions.HOME}</p><p>Tick <strong>{s.tick}</strong> · simulation {(s.timeMs/1000).toFixed(2)} s · official {(s.officialClock.timeMs/1000).toFixed(2)} s · period {s.period}</p>
        <p>Score HOME {s.score.HOME} – {s.score.AWAY} AWAY</p>
        <dl><dt>Possession</dt><dd>{s.possession.team} · {s.possession.id}</dd><dt>Ball</dt><dd>{s.ball.mode} · {s.ball.live?'LIVE':'DEAD'} · controller {s.ball.controllerId??'none'}</dd><dt>Ball position</dt><dd>{s.ball.position.x.toFixed(3)}, {s.ball.position.y.toFixed(3)} m · height {s.ball.height.toFixed(2)} m</dd><dt>Flight</dt><dd>{s.ball.flight?`${s.ball.flight.kind} · ${s.ball.flight.actionId} · ${s.ball.flight.fromId} → ${s.ball.flight.receiverId??'goal / rebound'}`:'none'}</dd><dt>Defence</dt><dd>{s.defence.system} · primary {s.defence.pressureId??'none'} · helper {s.defence.helperId??'none'}</dd><dt>Restart</dt><dd>{s.restart?`${s.restart.kind} · ${s.restart.phase} · ${s.restart.owner} ? ${s.restart.context??'ordinary restart'}`:'none'}</dd><dt>Continuous outcomes / exchanges</dt><dd>{s.flow.outcomes} / {s.exchanges.filter(e=>e.phase==='COMPLETED').length}</dd><dt>Outcome</dt><dd>{s.checkpoint.outcome??'Pending'} {s.reason&&`· ${s.reason}`}</dd><dt>State / event hashes</dt><dd><code>{hashes}</code></dd><dt>RNG</dt><dd>{s.rng.state} · {s.rng.draws} draws</dd></dl>
        <label>Historical tick {s.tick} · frame {replay.cursor+1}/{replay.frames.length}<input aria-label="Historical tick" type="range" min="0" max={replay.frames.length-1} value={replay.cursor} onChange={e=>{setPlaying(false);setReplay(r=>seekCore(r,Number(e.target.value)));}}/></label>
        <p className="lab-note">Inspect why a duty was allocated, which action is committed, and the consequences of each contest below. Green tests do not establish tactical authenticity.</p>
      </section></div>
    <section className="lab-table"><h2>Player responsibilities and committed actions</h2><table><thead><tr>{['Identity / role','Responsibility','Intent / reason','Action / phase','Physical / handling'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{s.players.map(p=><tr key={p.id}><td>{p.id} · {p.team}<br/>{p.role} · {p.population}</td><td>{p.duty.kind} → {p.duty.targetId??'space'}<br/><small>since tick {p.duty.sinceTick}</small>{p.support&&<><br/><small>Support target {p.support.target.x.toFixed(2)}, {p.support.target.y.toFixed(2)} ? review after {p.support.reviewAfterTick}</small></>}</td><td style={{whiteSpace:'normal',minWidth:210,maxWidth:320}}>{p.intent.effect}<br/><small>{p.intent.reason}</small></td><td>{p.action?`${p.action.kind} · ${p.action.phase}`:'None'}<br/><small>{p.action?.id} {p.action?.contact&&`? ${p.action.contact.technique} / ${p.action.contact.approach}`}</small></td><td>{p.position.x.toFixed(2)}, {p.position.y.toFixed(2)}<br/>{p.airborne?'AIRBORNE':'GROUNDED'} · steps {p.handling.steps}<br/>{p.wrongFootedUntilTick>s.tick?`Wrong-footed until ${p.wrongFootedUntilTick}`:p.beatenUntilTick>s.tick?`Beaten until ${p.beatenUntilTick}`:p.screenedUntilTick>s.tick?`Screened until ${p.screenedUntilTick}`:'Available subject to action'}</td></tr>)}</tbody></table></section>
    <section><h2>Executed contests</h2><div className="lab-events">{s.contests.length===0?<p>No physical contest resolved yet.</p>:s.contests.map(c=><p key={c.id}><strong>{c.tick} · {c.kind} · {c.outcome}</strong><br/>{c.attackerId} vs {c.defenderId} · consequence until {c.consequenceUntilTick}<br/><small>{c.id} · {c.actionId}</small></p>)}</div></section>
    <section><h2>Canonical events through tick {s.tick}</h2><label><span><input type="checkbox" checked={showActions} onChange={e=>setShowActions(e.target.checked)}/> Show action and responsibility transitions</span></label><div className="lab-events">{important.map(e=><p key={e.id}><strong>{e.tick} · {(e.timeMs/1000).toFixed(2)} s · {e.type}</strong><br/>{e.actorId??'referee'} · {JSON.stringify(e.details)}<br/><small>{e.actionId} {e.contestId} {e.relatedIds.join(', ')}</small></p>)}</div></section>
    <section><h2>Exact save / resume</h2><div className="lab-controls"><button onClick={()=>setSaved(saveCore(s))}>Save state to text</button><button onClick={download}>Download save</button><button disabled={!saved} onClick={reload}>Reload state</button><label>Open save file<input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(f)setSaved(await f.text());}}/></label></div><textarea aria-label="Saved core JSON" value={saved} onChange={e=>setSaved(e.target.value)}/></section>
    <details><summary>Complete exact snapshot</summary><pre>{JSON.stringify(s,null,2)}</pre></details>
  </main>;
}
