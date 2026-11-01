"use client";

import Link from 'next/link';
import { useEffect,useMemo,useRef,useState } from 'react';
import MasterCourtDisplay from '../../../components/matchPlan/MasterCourtDisplay';
import { designSystemTheme } from '@handball-manager/match-renderer/src/ui/design-system/index';
import { snapshotToScene } from '@handball-manager/match-integration/src/fieldAdapter';
import { v2CoreRenderSnapshot } from '@handball-manager/match-integration/src/v2CoreSnapshot';
import { createMatch,matchReport } from '@handball-manager/handball-engine/src/v2/core/match';
import { archiveMatch,advanceArchive,seekMatch,type MatchArchive } from '@handball-manager/handball-engine/src/v2/core/matchReplay';
import { coreHash,coreEventHash,loadCore,saveCore } from '@handball-manager/handball-engine/src/v2/core/replay';
import type { CoreState,Direction } from '@handball-manager/handball-engine/src/v2/core/state';
import type { AttackIdentity } from '@handball-manager/handball-engine/src/v2/core/offence';
import { setTactics } from '@handball-manager/handball-engine/src/v2/core/coaching';
import { requestTeamTimeout } from '@handball-manager/handball-engine/src/v2/core/referee';
import { requestTreatment } from '@handball-manager/handball-engine/src/v2/core/condition';
import { requestExchange } from '@handball-manager/handball-engine/src/v2/core/population';
import { showPassiveWarning } from '@handball-manager/handball-engine/src/v2/core/passive';
import '../scenario-lab.css';

const clock=(ms:number)=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000)%60<10?'0':''}${Math.floor(ms/1000)%60}`;
export default function MatchLab() {
  const [seed,setSeed]=useState('2025'),[direction,setDirection]=useState<Direction>('TOP');
  const [team,setTeam]=useState<'HOME'|'AWAY'>('HOME'),[defence,setDefence]=useState<'6:0'|'5:1'>('6:0'),[tempo,setTempo]=useState<'SLOW'|'BALANCED'|'QUICK'>('BALANCED');
  const [attackIdentity,setAttackIdentity]=useState<AttackIdentity>('BALANCED');
  const [outId,setOutId]=useState('H03'),[inId,setInId]=useState('H09');
  const [s,setState]=useState<CoreState>(()=>createMatch());
  const archive=useRef<MatchArchive|null>(null),generation=useRef(0);
  const [running,setRunning]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
  const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[hashes,setHashes]=useState('');
  const [report,setReport]=useState<ReturnType<typeof matchReport>|null>(null),[showJson,setShowJson]=useState(false);
  useEffect(()=>()=>{generation.current++;},[]);
  const scene=useMemo(()=>snapshotToScene(v2CoreRenderSnapshot(s)),[s]);
  const events=useMemo(()=>s.events.filter(e=>!['ACTION_STARTED','ACTION_PHASE','RESPONSIBILITY_ASSIGNED','ACTION_INTERRUPTED','RECEPTION_OFFERED','HANDLING_STEP'].includes(e.type)),[s]);
  const keyEvents=useMemo(()=>archive.current?.state.events.filter(e=>['ATTACK_ENTRY_SELECTED','ATTACK_RELATIONSHIP_ESTABLISHED','ATTACK_RESPONSE','DEFENSIVE_ENTRY_RECOGNIZED','PERIOD_STARTED','PERIOD_ENDED','GOAL','FOUL','WARNING','CONTACT_EXECUTED','DEFENDER_BEATEN','HANDOVER_COMPLETED','TWO_MINUTE_SUSPENSION','DISQUALIFICATION','EXCHANGE_COMPLETED','EXCHANGE_CANCELLED','PASSIVE_WARNING','PASSIVE_PLAY','ADVANTAGE_PENDING','ADVANTAGE_RECALLED','ADVANTAGE_REALIZED','TEAM_TIMEOUT_STARTED','OFFICIAL_CLOCK_RESTARTED','TREATMENT_STARTED','TREATMENT_ELIGIBILITY_RESTORED','TACTICS_CHANGED','RESTART_FAILED','INCOMPLETE'].includes(e.type))??[],[report]);
  function select(tick:number) {
    if(!archive.current)return;
    try{setState(seekMatch(archive.current,tick));setHashes('');}catch(e){setError(String(e));setPlaying(false);}
  }
  useEffect(()=>{
    if(!playing||!archive.current)return;
    let before=performance.now(),remainder=0,tick=s.tick;
    const timer=setInterval(()=>{
      const now=performance.now();remainder+=(now-before)*speed;before=now;
      const ticks=Math.floor(remainder/50);if(!ticks)return;remainder-=ticks*50;
      tick=Math.min(archive.current!.state.tick,tick+ticks);select(tick);
      if(tick===archive.current!.state.tick)setPlaying(false);
    },50);
    return()=>clearInterval(timer);
    // A selected historical frame does not reset the wall-clock accumulator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing,speed]);
  async function run(initial?:CoreState) {
    const token=++generation.current;setPlaying(false);setRunning(true);setError('');setHashes('');setReport(null);
    try {
      if(!initial&&!seed.trim())throw new Error('Enter a numeric seed');
      const a=archiveMatch(initial??createMatch(Number(seed),direction));archive.current=a;
      setState(seekMatch(a,a.state.tick));
      while(a.state.status==='RUNNING') {
        advanceArchive(a,1000);setProgress(`${clock(a.state.officialClock.timeMs)} · ${a.state.match?.phase} · tick ${a.state.tick}`);
        await new Promise(resolve=>setTimeout(resolve,0));if(generation.current!==token)return;
      }
      setReport(matchReport(a.state));setState(seekMatch(a,a.state.tick));
    }catch(e){setError(String(e));}finally{if(generation.current===token)setRunning(false);}
  }
  function download() {
    try{const data=saveCore(s),url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=`v2-match-${s.seed}-tick-${s.tick}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(String(e));}
  }
  function branch(command:'TACTICS'|'TIMEOUT'|'EXCHANGE'|'TREATMENT'|'PASSIVE') {
    try {
      const next=structuredClone(s);
      const accepted=command==='TACTICS'?setTactics(next,team,{defence,tempo,attackIdentity}):command==='TIMEOUT'?requestTeamTimeout(next,team):command==='EXCHANGE'?requestExchange(next,team,outId,inId):command==='PASSIVE'?showPassiveWarning(next,'Human QA referee observation of unproductive play'):requestTreatment(next,next.players.find(p=>p.id===outId)!,'Human QA observed injury');
      if(!accepted)throw new Error('Command is not eligible at this tick. Check match phase, possession, time-out allowance and player eligibility.');
      void run(next);
    }catch(e){setError(String(e));}
  }
  const first=archive.current?.checkpoints[0].body.tick??0,last=archive.current?.state.tick??0;
  return <main className="scenario-lab" style={designSystemTheme}>
    <header><small>HANDBALL ENGINE V2 · FULL MATCH HUMAN QA</small><h1>Full-match timeline</h1>
      <p>Two 30-minute halves, a 10-minute interval, physical restarts and player exchanges. Generate a match, then inspect any exact tick. Coach review of tactical behaviour is still required.</p>
      <Link href="/scenario-lab/core">Possessions, continuous play and 7v6 →</Link></header>
    <section className="lab-controls" aria-label="Full match controls">
      <label>Seed<input value={seed} onChange={e=>setSeed(e.target.value)} disabled={running}/></label>
      <label>Home starts attacking<select value={direction} onChange={e=>setDirection(e.target.value as Direction)} disabled={running}><option value="TOP">Top goal</option><option value="BOTTOM">Bottom goal</option></select></label>
      <button disabled={running} onClick={()=>void run()}>{running?'Simulating…':'Generate 2 × 30-minute match'}</button>
      <label>Resume exact save<input type="file" accept=".json,application/json" disabled={running} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const state=loadCore(await file.text());if(!state.match)throw new Error('Select a full-match save');setSeed(String(state.seed));setDirection(state.directions.HOME);await run(state);}catch(err){setError(String(err));}}}/></label>
    </section>
    <p role="status">{running?progress:report?`${report.complete?'Full time':report.status}: ${report.reason} · ${report.shots} shots · ${report.goals} goals · ${report.exchanges} completed exchanges`:'Generate a match to enable the timeline.'}</p>
    {error&&<p role="alert">{error}</p>}
    <section className="lab-controls" aria-label="Coaching and medical QA">
      <p>Branch from the selected tick and simulate its continuation. Download the current run first if you want to keep both versions.</p>
      <label>Team<select value={team} onChange={e=>{const t=e.target.value as 'HOME'|'AWAY';setTeam(t);setOutId(t==='HOME'?'H03':'A03');setInId(t==='HOME'?'H09':'A09');}}><option>HOME</option><option>AWAY</option></select></label>
      <label>Defence<select value={defence} onChange={e=>setDefence(e.target.value as typeof defence)}><option>6:0</option><option>5:1</option></select></label>
      <label>Attacking identity<select value={attackIdentity} onChange={e=>setAttackIdentity(e.target.value as AttackIdentity)}><option value="BALANCED">Balanced</option><option value="COMBINATION">Combination play</option><option value="WIDTH">Width and reversal</option><option value="DIRECT">Direct / player-led</option></select></label>
      <label>Tempo<select value={tempo} onChange={e=>setTempo(e.target.value as typeof tempo)}><option>SLOW</option><option>BALANCED</option><option>QUICK</option></select></label>
      <button disabled={running||s.status!=='RUNNING'} onClick={()=>branch('TACTICS')}>Apply tactics and continue</button>
      <button disabled={running||s.status!=='RUNNING'} onClick={()=>branch('TIMEOUT')}>Request team time-out and continue</button>
      <label>Court player<select value={outId} onChange={e=>setOutId(e.target.value)}>{s.players.filter(p=>p.team===team).map(p=><option key={p.id} value={p.id}>{p.id} {p.role} {p.population}</option>)}</select></label>
      <label>Replacement<select value={inId} onChange={e=>setInId(e.target.value)}>{s.players.filter(p=>p.team===team).map(p=><option key={p.id} value={p.id}>{p.id} {p.role} {p.population}</option>)}</select></label>
      <button disabled={running||s.status!=='RUNNING'} onClick={()=>branch('EXCHANGE')}>Request exchange and continue</button>
      <button disabled={running||s.status!=='RUNNING'} onClick={()=>branch('TREATMENT')}>Test medical interruption and continue</button>
      <button disabled={running||s.status!=='RUNNING'} onClick={()=>branch('PASSIVE')}>Test observed passive warning and continue</button>
    </section>
    <section className="lab-controls" aria-label="Exact match playback">
      <button disabled={running||!report} onClick={()=>{setPlaying(false);select(first);}}>Opening tick</button>
      <button disabled={running||!report||s.tick===last} onClick={()=>setPlaying(p=>!p)}>{playing?'Pause':'Play'}</button>
      <button disabled={running||!report||s.tick<=first} onClick={()=>{setPlaying(false);select(s.tick-1);}}>Previous tick</button>
      <button disabled={running||!report||s.tick>=last} onClick={()=>{setPlaying(false);select(s.tick+1);}}>Single tick</button>
      <label>Playback speed<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
      <label>Jump to executed event<select value="" disabled={running||!report} onChange={e=>{setPlaying(false);select(Number(e.target.value));}}><option value="">Select a moment</option>{keyEvents.map(e=><option key={e.id} value={e.tick}>{clock(e.officialMs)} · {e.type} · {e.actorId??''} · tick {e.tick}</option>)}</select></label>
    </section>
    <label>Historical tick {s.tick} / {last}<input aria-label="Historical match tick" type="range" min={first} max={Math.max(first,last)} value={s.tick} disabled={running||!report} onChange={e=>{setPlaying(false);select(Number(e.target.value));}}/></label>
    <div className="lab-grid"><section className="lab-court" aria-label="Court at exact historical tick"><MasterCourtDisplay scene={scene}/></section>
      <section className="lab-inspector"><h2>HOME {s.score.HOME} – {s.score.AWAY} AWAY</h2><p>{clock(s.officialClock.timeMs)} · period {s.period} · {s.match?.phase}</p>
        <dl><dt>Tick / simulation time</dt><dd>{s.tick} / {(s.timeMs/1000).toFixed(2)} s</dd><dt>Home attacks</dt><dd>{s.directions.HOME}</dd><dt>Possession</dt><dd>{s.possession.team} · {s.possession.phase}</dd><dt>Ball</dt><dd>{s.ball.mode} · {s.ball.live?'LIVE':'DEAD'} · {s.ball.controllerId??'no controller'}</dd><dt>Flight</dt><dd>{s.ball.flight?`${s.ball.flight.kind} · ${s.ball.flight.purpose} · ${s.ball.flight.fromId} → ${s.ball.flight.receiverId??'goal / rebound'}`:'none'}</dd><dt>Restart</dt><dd>{s.restart?`${s.restart.kind} · ${s.restart.context??'ordinary'} · ${s.restart.phase}`:'none'}</dd><dt>Population</dt><dd>{(['HOME','AWAY'] as const).map(team=><span key={team}>{team}: {s.players.filter(p=>p.team===team&&p.population==='COURT').length} on court · </span>)}</dd></dl>
        <button disabled={running} onClick={()=>setHashes(`${coreHash(s)} / ${coreEventHash(s)}`)}>Fingerprint selected exact state</button><p><code>{hashes}</code></p><button disabled={running} onClick={download}>Download selected tick for exact resume</button>
        <dl><dt>Official clock</dt><dd>{s.officialClock.running?'Running':s.referee.timeout?`${s.referee.timeout.reason}: ${Math.max(0,(s.referee.timeout.untilTick-s.tick)/20).toFixed(1)} seconds remaining`:s.referee.resumeOnWhistle?'Awaiting restart whistle':'Stopped'}</dd>
          <dt>Passive play</dt><dd>{s.referee.passive.warnedTick===null?'No warning':`Warning at tick ${s.referee.passive.warnedTick}; ${s.referee.passive.passes} completed passes; ${s.referee.passive.extraPass?'one exceptional pass available':'four-pass allowance'}`}</dd>
          <dt>Advantage</dt><dd>{s.referee.advantage?`${s.referee.advantage.team}: ${s.referee.advantage.attackerId}`:'None'}</dd>
          <dt>Team time-outs used</dt><dd>HOME: {s.referee.teamTimeouts.HOME.join(', ')||'none'}; AWAY: {s.referee.teamTimeouts.AWAY.join(', ')||'none'} (half numbers)</dd>
          <dt>Offensive subphase</dt><dd>{{UPPSPEL:'Fas 1: Uppspel',UPPFOLJNING:'Fas 2: Uppf?ljning',UPPBYGGNAD:'Fas 3: Uppbyggnad',AVSLUTNING:'Fas 4: Avslutning'}[s.offence.phase]}</dd>
          <dt>Attacking relationship</dt><dd>{s.offence.entry?`${s.offence.entry.family}: ${s.offence.entry.initiatorId} with ${s.offence.entry.partnerId}; defence: ${s.offence.entry.response}`:'Player-led play / no active entry'}</dd>
          <dt>Executed evidence</dt><dd>{s.offence.entry?`${s.offence.entry.moved.length} participants moved; relationship ${s.offence.entry.established?'physically established':'still developing'}; ${s.offence.entry.recognized.length} defenders recognized repeated movement`:'See relationship events in the timeline'}</dd>
          <dt>Attacking identities</dt><dd>HOME {s.coaching.HOME.attackIdentity}; AWAY {s.coaching.AWAY.attackIdentity}</dd>
          <dt>Current tactics</dt><dd>HOME {s.coaching.HOME.defence} / {s.coaching.HOME.tempo}; AWAY {s.coaching.AWAY.defence} / {s.coaching.AWAY.tempo}</dd></dl>
      </section></div>
    <section className="lab-table"><h2>Players at tick {s.tick}</h2><table><thead><tr><th>Identity / role</th><th>Population</th><th>Duty / target</th><th>Committed action</th><th>Position / handling</th></tr></thead><tbody>{s.players.map(p=><tr key={p.id}><td>{p.id} · {p.role}</td><td>{p.population}<br/>{p.warnings} warnings ? {p.sanctions} suspensions</td><td>{p.duty.kind} · {p.duty.targetId??'space'}{p.support&&<><br/><small>Support target {p.support.target.x.toFixed(2)}, {p.support.target.y.toFixed(2)}</small></>}</td><td>{p.action?`${p.action.kind} · ${p.action.phase}`:'none'}<br/><small>{p.intent.reason}</small>{s.offence.entry?.targets[p.id]&&<><br/><small>Entry target {s.offence.entry.targets[p.id].x.toFixed(2)}, {s.offence.entry.targets[p.id].y.toFixed(2)}</small></>}</td><td>{p.position.x.toFixed(2)}, {p.position.y.toFixed(2)} · {p.handling.steps} steps · {p.airborne?'airborne':'grounded'}</td></tr>)}</tbody></table></section>
    <section className="lab-table"><h2>Workload and eligibility</h2><table><thead><tr><th>Player</th><th>Energy</th><th>Distance</th><th>Court time</th><th>Medical status</th></tr></thead><tbody>{s.players.map(p=><tr key={p.id}><td>{p.id}</td><td>{Math.round(p.condition.energy*100)}%</td><td>{p.condition.distanceMetres.toFixed(0)} m</td><td>{clock(p.condition.courtMs)}</td><td>{p.condition.unavailable?'Unable to continue':p.condition.exitRequired?'Must leave for treatment':p.condition.attacksRemaining?`${p.condition.attacksRemaining} attacks before eligibility`:'Available'}</td></tr>)}</tbody></table></section>
    <section><h2>Latest 100 meaningful events through tick {s.tick}</h2><p>The event filter changes this display only. Downloads contain the complete canonical history through the selected tick.</p><div className="lab-events">{events.slice(-100).map(e=><p key={e.id}><strong>{e.tick} · {clock(e.officialMs)} · {e.type}</strong><br/>{e.actorId??'referee'} · {JSON.stringify(e.details)}<br/><small>{e.actionId}</small></p>)}</div></section>
    <details onToggle={e=>setShowJson(e.currentTarget.open)}><summary>Complete exact snapshot (large near full time)</summary>{showJson&&<pre>{JSON.stringify(s,null,2)}</pre>}</details>
  </main>;
}
