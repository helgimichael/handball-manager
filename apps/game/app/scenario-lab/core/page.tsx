"use client";

// Arena Nights SYS-03a (A) "Dev shell lab": possession & transition lab as court (9) + run
// controls (3), with a snapshot list that seeks to any recorded key moment. Engine calls unchanged.
import { useEffect, useMemo, useState } from 'react';
import MasterCourtDisplay from '../../../components/matchPlan/MasterCourtDisplay';
import { DevPageHead } from '@/components/dev/DevShell';
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
import { LabList } from '../LabList';
import '../scenario-lab.css';

type LabScenario=CoreScenario|ContactScenario|WingScenario|BackcourtScenario|'CONTINUOUS_PLAY'|'SEVEN_V_SIX';
const options:LabScenario[]=[...CORE_SCENARIOS,...CONTACT_SCENARIOS,...WING_SCENARIOS,...BACKCOURT_SCENARIOS,'CONTINUOUS_PLAY','SEVEN_V_SIX'];
const names:Record<LabScenario,string>={COMPACT_DEFENCE_WIDTH:'Bredd i niometersspelet mot kompakt försvar',PIVOT_INTERVAL_SUPPORT:'Nio / mittsexa i luckan',PENETRATION_SPACING:'Frigör genombrottsytan',WING_BACKCOURT_RETURN:'Kant / nio returkoppling',LEFT_WING_LINK:'Vänsterkant / närmaste nia',RIGHT_WING_LINK:'Högerkant / närmaste nia',CLOSED_WING_RETURN:'Stängt kantfönster / returpass',OPEN_WING_FINISH:'Öppet kantfönster / avslut',SHOULDER_BREAKTHROUGH:'Fysiskt axelgenombrott',FRONTAL_CONTACT:'Frontal kontakt och stopp',LATE_HOLD:'Sent fasthållningsförsök',EVADED_CONTACT:'Undvikt kontaktförsök',CONTINUOUS_PLAY:'Kontinuerligt spel (6 utfall)',SEVEN_V_SIX:'7 mot 6 och målvaktsretur (6 utfall)',ESTABLISHED_6V6:'Etablerat 6 mot 6',TRANSITION_3V2:'Omställning 3 mot 2',FREE_THROW:'Frikast',PIVOT_2V2:'Lokalt 2 mot 2 med mittsexa',WING_FINISH:'Kantavslut / retur',BACKCOURT_SHOT:'Hoppskott från nio',DEFENSIVE_HELP:'Försvarshjälp',PRESSURE_5_1:'5:1-press',EMPTY_GOAL:'Läge mot tomt mål'};
const NOISE=['ACTION_STARTED','ACTION_PHASE','RESPONSIBILITY_ASSIGNED','ACTION_INTERRUPTED'];

export default function CoreLab() {
  const [scenario,setScenario]=useState<LabScenario>('ESTABLISHED_6V6');
  const [seed,setSeed]=useState('2025');const [direction,setDirection]=useState<Direction>('TOP');
  const [replay,setReplay]=useState(()=>replayCore(createCoreScenario()));
  const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(.25),[saved,setSaved]=useState(''),[error,setError]=useState('');
  const [showActions,setShowActions]=useState(false);
  const s=replay.frames[replay.cursor];
  const scene=useMemo(()=>snapshotToScene(v2CoreRenderSnapshot(s)),[s]);
  const hashes=useMemo(()=>`${coreHash(s)} / ${coreEventHash(s)}`,[s]);
  // Playback stops by itself once the scenario is no longer running (derived, not synced through an effect).
  const live=playing&&s.status==='RUNNING';
  useEffect(()=>{if(!live)return;let before=performance.now();const timer=setInterval(()=>{const now=performance.now(),elapsed=now-before;before=now;setReplay(r=>playCore(r,elapsed,speed));},50);return()=>clearInterval(timer);},[live,speed]);
  function reset(){try{if(!seed.trim())throw new Error('Ange en seed.');setReplay(replayCore(scenario==='CONTINUOUS_PLAY'||scenario==='SEVEN_V_SIX'?createContinuous(scenario,Number(seed),direction):BACKCOURT_SCENARIOS.includes(scenario as BackcourtScenario)?createBackcourtScenario(scenario as BackcourtScenario,Number(seed),direction):WING_SCENARIOS.includes(scenario as WingScenario)?createWingScenario(scenario as WingScenario,Number(seed),direction):CONTACT_SCENARIOS.includes(scenario as ContactScenario)?createContactScenario(scenario as ContactScenario,Number(seed),direction):createCoreScenario(scenario as CoreScenario,Number(seed),direction)));setPlaying(false);setError('');}catch(e){setError(String(e));}}
  function reload(){try{const loaded=loadCore(saved);setReplay(replayCore(loaded));setSeed(String(loaded.seed));setScenario(loaded.scenario as LabScenario);setDirection(loaded.directions.HOME);setPlaying(false);setError('');}catch(e){setError(String(e));}}
  function download(){const data=saveCore(s);setSaved(data);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`v2-${s.scenario}-${s.seed}-${s.tick}.json`;a.click();URL.revokeObjectURL(url);}
  function seekTo(index:number){setPlaying(false);setReplay(r=>seekCore(r,index));}
  const important=s.events.filter(e=>showActions||!NOISE.includes(e.type));
  // Snapshot list: every recorded key moment (from the newest recorded frame), mapped to the first frame at that tick.
  const snapshots=useMemo(()=>{
    const frames=replay.frames,latest=frames[frames.length-1];
    const indexByTick=new Map<number,number>();
    frames.forEach((f,i)=>{if(!indexByTick.has(f.tick))indexByTick.set(f.tick,i);});
    return latest.events.filter(e=>!NOISE.includes(e.type)).flatMap(e=>{const index=indexByTick.get(e.tick);return index===undefined?[]:[{id:e.id,tick:e.tick,type:e.type,actor:e.actorId,index}];});
  },[replay.frames]);
  const atEnd=s.status!=='RUNNING'&&replay.cursor===replay.frames.length-1;

  return <div className="scenario-lab">
    <DevPageHead eyebrow="Motorlabb · Handball Engine V2 · spelbar kärna" title="Labb · anfall & omställning" note="En modell för aktion, boll och duell. Enskilda anfall eller sex utfall i följd, med fysiska restarter och byten. Gröna tester bevisar inte taktisk äkthet."/>
    <LabList/>
    {error&&<p className="hm-dev-alert" role="alert">{error}</p>}
    <div className="hm-dev-split">
      <section className="hm-dev-panel" aria-label="FIELD-plan vid vald exakt tick">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Plan · {s.possession.phase} · {s.status}</span><span className="hm-dev-num hm-dev-muted">tick {s.tick} · HEMMA {s.score.HOME}–{s.score.AWAY} BORTA</span></div>
        <div className="lab-court" style={designSystemTheme}><MasterCourtDisplay scene={scene}/></div>
      </section>
      <aside className="hm-dev-sticky">
        <section className="hm-dev-panel" aria-label="Kärnscenariokontroller">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Kör</span></div>
          <div className="hm-dev-panel-body lab-form">
            <label>Scenario<select value={scenario} onChange={e=>setScenario(e.target.value as LabScenario)}>{options.map(key=><option value={key} key={key}>{names[key]}</option>)}</select></label>
            <label>Seed<input aria-label="Seed" className="hm-dev-num" value={seed} onChange={e=>setSeed(e.target.value)}/></label>
            <label>Hemmalaget anfaller<select value={direction} onChange={e=>setDirection(e.target.value as Direction)}><option value="TOP">Övre mål</option><option value="BOTTOM">Nedre mål</option></select></label>
            <div className="lab-row">
              <button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={reset}>Starta / nollställ</button>
              <button type="button" className="hm-dev-btn" disabled={atEnd} onClick={()=>setPlaying(!live)}>{live?'Pausa':'Spela'}</button>
              <button type="button" className="hm-dev-btn" onClick={()=>{setPlaying(false);setReplay(stepCoreReplay);}}>En tick</button>
            </div>
            {atEnd&&<span className="lab-note">Scenariot är slut ({s.status}). Nollställ för att spela igen.</span>}
            <label>Uppspelning<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
            <label>Historisk tick <span className="hm-dev-num">{s.tick} · bild {replay.cursor+1}/{replay.frames.length}</span><input aria-label="Historisk tick" type="range" min="0" max={replay.frames.length-1} value={replay.cursor} onChange={e=>seekTo(Number(e.target.value))}/></label>
          </div>
        </section>
        <section className="hm-dev-panel" aria-label="Snapshot-lista">
          <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Snapshots</span><span className="hm-dev-num hm-dev-muted">{snapshots.length}</span></div>
          {snapshots.length===0?<p className="hm-dev-empty">Inga nyckelhändelser inspelade ännu. Spela eller stega scenariot.</p>:
            <div className="lab-timeline-rows lab-snapshots">{snapshots.map(x=><button type="button" key={x.id} className="lab-timeline-row" style={{gridTemplateColumns:'52px minmax(0,1fr)'}} aria-current={x.tick===s.tick?'true':undefined} data-past={x.index<=replay.cursor?'true':'false'} onClick={()=>seekTo(x.index)}><span className="hm-dev-num">{x.tick}</span><span>{x.type}{x.actor?` · ${x.actor}`:''}</span></button>)}</div>}
        </section>
      </aside>
    </div>

    <section className="hm-dev-panel" style={{marginTop:12}} aria-label="Auktoritativt kärntillstånd">
      <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Inspektör</span><span className="hm-dev-num hm-dev-muted">{s.scenario} · seed {s.seed} · HEMMA → {s.directions.HOME}</span></div>
      <div className="hm-dev-panel-body">
        <p className="hm-dev-num">Tick <strong>{s.tick}</strong> · sim {(s.timeMs/1000).toFixed(2)} s · officiell {(s.officialClock.timeMs/1000).toFixed(2)} s · period {s.period}</p>
        <dl className="lab-dl" style={{gridTemplateColumns:'160px minmax(0,1fr) 160px minmax(0,1fr)'}}><dt>Bollinnehav</dt><dd>{s.possession.team} · {s.possession.id}</dd><dt>Boll</dt><dd>{s.ball.mode} · {s.ball.live?'LIVE':'DÖD'} · kontrollant {s.ball.controllerId??'ingen'}</dd><dt>Bollposition</dt><dd className="hm-dev-num">{s.ball.position.x.toFixed(3)}, {s.ball.position.y.toFixed(3)} m · höjd {s.ball.height.toFixed(2)} m</dd><dt>Flykt</dt><dd>{s.ball.flight?`${s.ball.flight.kind} · ${s.ball.flight.actionId} · ${s.ball.flight.fromId} → ${s.ball.flight.receiverId??'mål / retur'}`:'ingen'}</dd><dt>Försvar</dt><dd>{s.defence.system} · primär {s.defence.pressureId??'ingen'} · hjälp {s.defence.helperId??'ingen'}</dd><dt>Restart</dt><dd>{s.restart?`${s.restart.kind} · ${s.restart.phase} · ${s.restart.owner} · ${s.restart.context??'vanlig restart'}`:'ingen'}</dd><dt>Utfall / byten</dt><dd className="hm-dev-num">{s.flow.outcomes} / {s.exchanges.filter(e=>e.phase==='COMPLETED').length}</dd><dt>Utfall</dt><dd>{s.checkpoint.outcome??'Väntar'} {s.reason&&`· ${s.reason}`}</dd><dt>State / event-hash</dt><dd><code>{hashes}</code></dd><dt>RNG</dt><dd className="hm-dev-num">{s.rng.state} · {s.rng.draws} drag</dd></dl>
      </div>
    </section>
    <section className="hm-dev-panel lab-table" style={{marginTop:12}}>
      <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Spelaransvar och bundna aktioner</span></div>
      <div className="hm-dev-table-wrap"><table className="hm-dev-table"><thead><tr>{['Identitet / roll','Ansvar','Avsikt / skäl','Aktion / fas','Fysik / bollhantering'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{s.players.map(p=><tr key={p.id}><td>{p.id} · {p.team}<br/><small>{p.role} · {p.population}</small></td><td>{p.duty.kind} → {p.duty.targetId??'yta'}<br/><small>sedan tick {p.duty.sinceTick}</small>{p.support&&<><br/><small>Stödmål {p.support.target.x.toFixed(2)}, {p.support.target.y.toFixed(2)} · omprövas efter {p.support.reviewAfterTick}</small></>}</td><td className="lab-wrap">{p.intent.effect}<br/><small>{p.intent.reason}</small></td><td>{p.action?`${p.action.kind} · ${p.action.phase}`:'Ingen'}<br/><small>{p.action?.id} {p.action?.contact&&`· ${p.action.contact.technique} / ${p.action.contact.approach}`}</small></td><td className="hm-dev-num">{p.position.x.toFixed(2)}, {p.position.y.toFixed(2)}<br/>{p.airborne?'I LUFTEN':'PÅ MARKEN'} · steg {p.handling.steps}<br/>{p.wrongFootedUntilTick>s.tick?`Fel fot till ${p.wrongFootedUntilTick}`:p.beatenUntilTick>s.tick?`Passerad till ${p.beatenUntilTick}`:p.screenedUntilTick>s.tick?`Skymd till ${p.screenedUntilTick}`:'Tillgänglig enligt aktion'}</td></tr>)}</tbody></table></div>
    </section>
    <div className="hm-dev-split hm-dev-split--6-6" style={{marginTop:12}}>
      <section className="hm-dev-panel">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Genomförda dueller</span><span className="hm-dev-num hm-dev-muted">{s.contests.length}</span></div>
        <div className="hm-dev-panel-body lab-events">{s.contests.length===0?<p className="hm-dev-muted">Ingen fysisk duell avgjord ännu.</p>:s.contests.map(c=><p key={c.id}><strong className="hm-dev-num">{c.tick} · {c.kind} · {c.outcome}</strong><br/>{c.attackerId} mot {c.defenderId} · konsekvens till {c.consequenceUntilTick}<br/><small>{c.id} · {c.actionId}</small></p>)}</div>
      </section>
      <section className="hm-dev-panel">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Kanoniska händelser t.o.m. tick {s.tick}</span><label className="hm-dev-muted" style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" checked={showActions} onChange={e=>setShowActions(e.target.checked)}/> Visa aktions- och ansvarsövergångar</label></div>
        <div className="hm-dev-panel-body lab-events">{important.length===0?<p className="hm-dev-muted">Inga händelser ännu.</p>:important.map(e=><p key={e.id}><strong className="hm-dev-num">{e.tick} · {(e.timeMs/1000).toFixed(2)} s · {e.type}</strong><br/>{e.actorId??'domare'} · {JSON.stringify(e.details)}<br/><small>{e.actionId} {e.contestId} {e.relatedIds.join(', ')}</small></p>)}</div>
      </section>
    </div>
    <section className="hm-dev-panel" style={{marginTop:12}}>
      <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Exakt spara / återuppta</span></div>
      <div className="hm-dev-panel-body lab-form">
        <div className="lab-row"><button type="button" className="hm-dev-btn" onClick={()=>setSaved(saveCore(s))}>Spara till text</button><button type="button" className="hm-dev-btn" onClick={download}>Ladda ner</button><button type="button" className="hm-dev-btn hm-dev-btn--primary" disabled={!saved} onClick={reload}>Ladda om</button>{!saved&&<span className="lab-note">Ladda om kräver sparad JSON nedan.</span>}</div>
        <label>Öppna sparfil<input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(f)setSaved(await f.text());}}/></label>
        <textarea aria-label="Sparad kärn-JSON" value={saved} onChange={e=>setSaved(e.target.value)}/>
      </div>
    </section>
    <details><summary>Fullständig exakt snapshot</summary><pre>{JSON.stringify(s,null,2)}</pre></details>
  </div>;
}
