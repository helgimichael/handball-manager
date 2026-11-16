"use client";

// Arena Nights SYS-03b (A) "Timeline-first lab": the full-match human QA lab with the court
// (12) synced above a full-width event timeline (12): scrubber, event marks and event rows that
// seek the archive on click. Branch/coaching commands, inspector and tables follow below.
// Engine calls are unchanged; this is only the UI shell.
import { useEffect,useMemo,useRef,useState } from 'react';
import MasterCourtDisplay from '../../../components/matchPlan/MasterCourtDisplay';
import { DevPageHead } from '@/components/dev/DevShell';
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
import { LabList } from '../LabList';
import '../scenario-lab.css';

const clock=(ms:number)=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000)%60<10?'0':''}${Math.floor(ms/1000)%60}`;
const KEY_TYPES=['ATTACK_ENTRY_SELECTED','ATTACK_RELATIONSHIP_ESTABLISHED','ATTACK_RESPONSE','DEFENSIVE_ENTRY_RECOGNIZED','PERIOD_STARTED','PERIOD_ENDED','GOAL','FOUL','WARNING','CONTACT_EXECUTED','DEFENDER_BEATEN','HANDOVER_COMPLETED','TWO_MINUTE_SUSPENSION','DISQUALIFICATION','EXCHANGE_COMPLETED','EXCHANGE_CANCELLED','PASSIVE_WARNING','PASSIVE_PLAY','ADVANTAGE_PENDING','ADVANTAGE_RECALLED','ADVANTAGE_REALIZED','TEAM_TIMEOUT_STARTED','OFFICIAL_CLOCK_RESTARTED','TREATMENT_STARTED','TREATMENT_ELIGIBILITY_RESTORED','TACTICS_CHANGED','RESTART_FAILED','INCOMPLETE'];
/** Marks on the timeline track: only the moments a QA reviewer scans for, so the track stays readable. */
const TRACK_TYPES=new Set(['GOAL','FOUL','TWO_MINUTE_SUSPENSION','DISQUALIFICATION','PERIOD_STARTED','PERIOD_ENDED','TEAM_TIMEOUT_STARTED','EXCHANGE_COMPLETED','PASSIVE_PLAY']);
const PHASE_LABEL:Record<string,string>={UPPSPEL:'Fas 1: Uppspel',UPPFOLJNING:'Fas 2: Uppföljning',UPPBYGGNAD:'Fas 3: Uppbyggnad',AVSLUTNING:'Fas 4: Avslutning'};

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
  // Timeline bounds and key events are captured from the finished archive (a ref) when the run completes,
  // so render never reads the ref.
  type KeyEvent=CoreState['events'][number];
  const [timeline,setTimeline]=useState<{first:number;last:number;keyEvents:KeyEvent[]}|null>(null);
  const keyEvents=timeline?.keyEvents??[];
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
    const token=++generation.current;setPlaying(false);setRunning(true);setError('');setHashes('');setReport(null);setTimeline(null);
    try {
      if(!initial&&!seed.trim())throw new Error('Ange en numerisk seed.');
      const a=archiveMatch(initial??createMatch(Number(seed),direction));archive.current=a;
      setState(seekMatch(a,a.state.tick));
      while(a.state.status==='RUNNING') {
        advanceArchive(a,1000);setProgress(`${clock(a.state.officialClock.timeMs)} · ${a.state.match?.phase} · tick ${a.state.tick}`);
        await new Promise(resolve=>setTimeout(resolve,0));if(generation.current!==token)return;
      }
      setTimeline({first:a.checkpoints[0].body.tick,last:a.state.tick,keyEvents:a.state.events.filter(e=>KEY_TYPES.includes(e.type))});
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
      if(!accepted)throw new Error('Kommandot är inte tillåtet vid den här ticken. Kontrollera matchfas, bollinnehav, timeout-kvot och spelarens behörighet.');
      void run(next);
    }catch(e){setError(String(e));}
  }
  const first=timeline?.first??0,last=timeline?.last??0;
  const span=Math.max(1,last-first);
  const pct=(tick:number)=>`${((Math.min(Math.max(tick,first),last)-first)/span)*100}%`;
  // The current timeline row: the latest key event at or before the selected tick.
  let currentKey=-1;
  for(let i=0;i<keyEvents.length;i++){if(keyEvents[i].tick<=s.tick)currentKey=i;else break;}
  const currentRowRef=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{currentRowRef.current?.scrollIntoView({block:'nearest'});},[currentKey]);
  const noTimeline=running||!report;
  const branchDisabled=running||s.status!=='RUNNING';
  const branchReason=running?'Simulerar…':s.status!=='RUNNING'?'Välj en tick där matchen pågår (före slutsignal) för att förgrena.':null;

  return <div className="scenario-lab">
    <DevPageHead eyebrow="Motorlabb · Handball Engine V2 · mänsklig QA" title="Labb · helmatch" note="Två halvlekar à 30 minuter, 10 minuters paus, fysiska restarter och byten. Generera en match och granska sedan valfri exakt tick. Tränargranskning av taktiskt beteende krävs fortfarande."/>
    <LabList/>
    <section className="hm-dev-panel" aria-label="Helmatchkontroller">
      <div className="hm-dev-panel-body lab-row" style={{alignItems:'flex-end',gap:12}}>
        <label className="lab-form" style={{display:'flex',flexDirection:'column',gap:3}}><span className="hm-dev-muted">Seed</span><input className="hm-dev-num" value={seed} onChange={e=>setSeed(e.target.value)} disabled={running} style={{width:100}}/></label>
        <label style={{display:'flex',flexDirection:'column',gap:3}}><span className="hm-dev-muted">Hemmalaget börjar anfalla</span><select value={direction} onChange={e=>setDirection(e.target.value as Direction)} disabled={running}><option value="TOP">Övre mål</option><option value="BOTTOM">Nedre mål</option></select></label>
        <button type="button" className="hm-dev-btn hm-dev-btn--primary" disabled={running} onClick={()=>void run()}>{running?'Simulerar…':'Generera match 2 × 30 min'}</button>
        <label style={{display:'flex',flexDirection:'column',gap:3}}><span className="hm-dev-muted">Återuppta exakt sparning</span><input type="file" accept=".json,application/json" disabled={running} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const state=loadCore(await file.text());if(!state.match)throw new Error('Välj en helmatchsparning.');setSeed(String(state.seed));setDirection(state.directions.HOME);await run(state);}catch(err){setError(String(err));}}}/></label>
        <p role="status" className="hm-dev-num hm-dev-muted" style={{margin:0,flex:'1 1 240px'}}>{running?progress:report?`${report.complete?'Slutsignal':report.status}: ${report.reason} · ${report.shots} skott · ${report.goals} mål · ${report.exchanges} genomförda byten`:'Generera en match för att aktivera tidslinjen.'}</p>
      </div>
    </section>
    {error&&<p className="hm-dev-alert" role="alert" style={{marginTop:12}}>{error}</p>}

    <section className="hm-dev-panel" style={{marginTop:12}} aria-label="Plan vid exakt historisk tick">
      <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Plan</span><span className="hm-dev-num"><strong>HEMMA {s.score.HOME} – {s.score.AWAY} BORTA</strong> <span className="hm-dev-muted">· {clock(s.officialClock.timeMs)} · period {s.period} · {s.match?.phase} · tick {s.tick}</span></span></div>
      <div className="lab-court lab-court--wide" style={designSystemTheme}><MasterCourtDisplay scene={scene}/></div>
    </section>

    <section className="hm-dev-panel" style={{marginTop:12}} aria-label="Tidslinje">
      <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Tidslinje</span><span className="hm-dev-num hm-dev-muted">tick {s.tick} / {last}{report?` · ${keyEvents.length} nyckelhändelser`:''}</span></div>
      <div className="lab-timeline-scrub">
        <button type="button" className="hm-dev-btn hm-dev-btn--sm" disabled={noTimeline} onClick={()=>{setPlaying(false);select(first);}}>Första tick</button>
        <button type="button" className="hm-dev-btn hm-dev-btn--sm" disabled={noTimeline||s.tick<=first} onClick={()=>{setPlaying(false);select(s.tick-1);}}>‹ Tick</button>
        <button type="button" className="hm-dev-btn hm-dev-btn--sm hm-dev-btn--primary" disabled={noTimeline||s.tick===last} onClick={()=>setPlaying(p=>!p)}>{playing?'Pausa':'Spela'}</button>
        <button type="button" className="hm-dev-btn hm-dev-btn--sm" disabled={noTimeline||s.tick>=last} onClick={()=>{setPlaying(false);select(s.tick+1);}}>Tick ›</button>
        <input aria-label="Historisk matchtick" type="range" min={first} max={Math.max(first,last)} value={s.tick} disabled={noTimeline} onChange={e=>{setPlaying(false);select(Number(e.target.value));}}/>
        <label className="hm-dev-muted" style={{display:'flex',gap:6,alignItems:'center'}}>Hastighet<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
      </div>
      {noTimeline?<p className="hm-dev-empty">{running?'Matchen simuleras – tidslinjen öppnas vid slutsignal.':'Ingen match ännu. Generera en match eller återuppta en sparning ovan.'}</p>:<>
        <div className="lab-timeline-track" aria-hidden="true">
          {keyEvents.filter(e=>TRACK_TYPES.has(e.type)).map(e=><button key={e.id} type="button" tabIndex={-1} className="lab-timeline-mark" data-kind={e.type} style={{left:pct(e.tick)}} title={`${clock(e.officialMs)} · ${e.type}`} onClick={()=>{setPlaying(false);select(e.tick);}}/>)}
          <span className="lab-timeline-cursor" style={{left:pct(s.tick)}}/>
        </div>
        <div className="lab-timeline-rows" role="list">
          {keyEvents.map((e,i)=><button key={e.id} role="listitem" type="button" ref={i===currentKey?currentRowRef:undefined} className="lab-timeline-row" aria-current={i===currentKey?'true':undefined} data-past={e.tick<=s.tick?'true':'false'} onClick={()=>{setPlaying(false);select(e.tick);}}><span className="hm-dev-num">{clock(e.officialMs)}</span><span className="hm-dev-num hm-dev-muted">t {e.tick}</span><span>{e.type}</span><span className="hm-dev-muted">{e.actorId??''}</span></button>)}
        </div>
      </>}
    </section>

    <div className="hm-dev-split hm-dev-split--8-4" style={{marginTop:12}}>
      <section className="hm-dev-panel" aria-label="Inspektör">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Inspektör</span><span className="lab-row"><button type="button" className="hm-dev-btn hm-dev-btn--sm" disabled={running} onClick={()=>setHashes(`${coreHash(s)} / ${coreEventHash(s)}`)}>Fingeravtryck</button><button type="button" className="hm-dev-btn hm-dev-btn--sm" disabled={running} onClick={download}>Ladda ner vald tick</button></span></div>
        <div className="hm-dev-panel-body">
          {hashes&&<p><code>{hashes}</code></p>}
          <dl className="lab-dl" style={{gridTemplateColumns:'150px minmax(0,1fr) 150px minmax(0,1fr)'}}><dt>Tick / simtid</dt><dd className="hm-dev-num">{s.tick} / {(s.timeMs/1000).toFixed(2)} s</dd><dt>Hemma anfaller</dt><dd>{s.directions.HOME}</dd><dt>Bollinnehav</dt><dd>{s.possession.team} · {s.possession.phase}</dd><dt>Boll</dt><dd>{s.ball.mode} · {s.ball.live?'LIVE':'DÖD'} · {s.ball.controllerId??'ingen kontrollant'}</dd><dt>Flykt</dt><dd>{s.ball.flight?`${s.ball.flight.kind} · ${s.ball.flight.purpose} · ${s.ball.flight.fromId} → ${s.ball.flight.receiverId??'mål / retur'}`:'ingen'}</dd><dt>Restart</dt><dd>{s.restart?`${s.restart.kind} · ${s.restart.context??'vanlig'} · ${s.restart.phase}`:'ingen'}</dd><dt>Spelare på plan</dt><dd>{(['HOME','AWAY'] as const).map(t=><span key={t}>{t}: {s.players.filter(p=>p.team===t&&p.population==='COURT').length} · </span>)}</dd>
            <dt>Officiell klocka</dt><dd>{s.officialClock.running?'Går':s.referee.timeout?`${s.referee.timeout.reason}: ${Math.max(0,(s.referee.timeout.untilTick-s.tick)/20).toFixed(1)} s kvar`:s.referee.resumeOnWhistle?'Väntar på restartsignal':'Stoppad'}</dd>
            <dt>Passivt spel</dt><dd>{s.referee.passive.warnedTick===null?'Ingen varning':`Varning vid tick ${s.referee.passive.warnedTick}; ${s.referee.passive.passes} passningar; ${s.referee.passive.extraPass?'en extra passning tillgänglig':'fyra passningar'}`}</dd>
            <dt>Fördel</dt><dd>{s.referee.advantage?`${s.referee.advantage.team}: ${s.referee.advantage.attackerId}`:'Ingen'}</dd>
            <dt>Timeouts (halvlek)</dt><dd>HOME: {s.referee.teamTimeouts.HOME.join(', ')||'inga'}; AWAY: {s.referee.teamTimeouts.AWAY.join(', ')||'inga'}</dd>
            <dt>Anfallsfas</dt><dd>{PHASE_LABEL[s.offence.phase]??s.offence.phase}</dd>
            <dt>Anfallsrelation</dt><dd>{s.offence.entry?`${s.offence.entry.family}: ${s.offence.entry.initiatorId} med ${s.offence.entry.partnerId}; försvar: ${s.offence.entry.response}`:'Spelarlett spel / ingen aktiv inledning'}</dd>
            <dt>Utförda belägg</dt><dd>{s.offence.entry?`${s.offence.entry.moved.length} deltagare rörde sig; relation ${s.offence.entry.established?'fysiskt etablerad':'under uppbyggnad'}; ${s.offence.entry.recognized.length} försvarare kände igen rörelsen`:'Se relationshändelser i tidslinjen'}</dd>
            <dt>Anfallsidentitet</dt><dd>HOME {s.coaching.HOME.attackIdentity}; AWAY {s.coaching.AWAY.attackIdentity}</dd>
            <dt>Aktuell taktik</dt><dd>HOME {s.coaching.HOME.defence} / {s.coaching.HOME.tempo}; AWAY {s.coaching.AWAY.defence} / {s.coaching.AWAY.tempo}</dd></dl>
        </div>
      </section>
      <section className="hm-dev-panel" aria-label="Tränar- och medicin-QA">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Förgrena från vald tick</span></div>
        <div className="hm-dev-panel-body lab-form">
          <p className="lab-note" style={{margin:0}}>Simulerar fortsättningen från vald tick. Ladda ner nuvarande körning först om du vill behålla båda.</p>
          {branchReason&&<p className="hm-dev-warn" style={{margin:0}}>{branchReason}</p>}
          <label>Lag<select value={team} onChange={e=>{const t=e.target.value as 'HOME'|'AWAY';setTeam(t);setOutId(t==='HOME'?'H03':'A03');setInId(t==='HOME'?'H09':'A09');}}><option>HOME</option><option>AWAY</option></select></label>
          <div className="lab-section-title">Taktik</div>
          <label>Försvar<select value={defence} onChange={e=>setDefence(e.target.value as typeof defence)}><option>6:0</option><option>5:1</option></select></label>
          <label>Anfallsidentitet<select value={attackIdentity} onChange={e=>setAttackIdentity(e.target.value as AttackIdentity)}><option value="BALANCED">Balanserad</option><option value="COMBINATION">Kombinationsspel</option><option value="WIDTH">Bredd och vändning</option><option value="DIRECT">Direkt / spelarlett</option></select></label>
          <label>Tempo<select value={tempo} onChange={e=>setTempo(e.target.value as typeof tempo)}><option>SLOW</option><option>BALANCED</option><option>QUICK</option></select></label>
          <div className="lab-row"><button type="button" className="hm-dev-btn" disabled={branchDisabled} onClick={()=>branch('TACTICS')}>Ändra taktik och fortsätt</button><button type="button" className="hm-dev-btn" disabled={branchDisabled} onClick={()=>branch('TIMEOUT')}>Timeout och fortsätt</button></div>
          <div className="lab-section-title">Byte / medicin</div>
          <label>Spelare på plan<select value={outId} onChange={e=>setOutId(e.target.value)}>{s.players.filter(p=>p.team===team).map(p=><option key={p.id} value={p.id}>{p.id} {p.role} {p.population}</option>)}</select></label>
          <label>Inbytare<select value={inId} onChange={e=>setInId(e.target.value)}>{s.players.filter(p=>p.team===team).map(p=><option key={p.id} value={p.id}>{p.id} {p.role} {p.population}</option>)}</select></label>
          <div className="lab-row"><button type="button" className="hm-dev-btn" disabled={branchDisabled} onClick={()=>branch('EXCHANGE')}>Byte och fortsätt</button><button type="button" className="hm-dev-btn" disabled={branchDisabled} onClick={()=>branch('TREATMENT')}>Testa skadeavbrott</button><button type="button" className="hm-dev-btn" disabled={branchDisabled} onClick={()=>branch('PASSIVE')}>Testa passivvarning</button></div>
        </div>
      </section>
    </div>

    <section className="hm-dev-panel lab-table" style={{marginTop:12}}>
      <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Spelare vid tick {s.tick}</span></div>
      <div className="hm-dev-table-wrap"><table className="hm-dev-table"><thead><tr><th>Identitet / roll</th><th>Population</th><th>Uppgift / mål</th><th>Bunden aktion</th><th>Position / bollhantering</th></tr></thead><tbody>{s.players.map(p=><tr key={p.id}><td>{p.id} · {p.role}</td><td>{p.population}<br/><small>{p.warnings} varningar · {p.sanctions} utvisningar</small></td><td>{p.duty.kind} · {p.duty.targetId??'yta'}{p.support&&<><br/><small>Stödmål {p.support.target.x.toFixed(2)}, {p.support.target.y.toFixed(2)}</small></>}</td><td>{p.action?`${p.action.kind} · ${p.action.phase}`:'ingen'}<br/><small>{p.intent.reason}</small>{s.offence.entry?.targets[p.id]&&<><br/><small>Inledningsmål {s.offence.entry.targets[p.id].x.toFixed(2)}, {s.offence.entry.targets[p.id].y.toFixed(2)}</small></>}</td><td className="hm-dev-num">{p.position.x.toFixed(2)}, {p.position.y.toFixed(2)} · {p.handling.steps} steg · {p.airborne?'i luften':'på marken'}</td></tr>)}</tbody></table></div>
    </section>
    <div className="hm-dev-split hm-dev-split--6-6" style={{marginTop:12}}>
      <section className="hm-dev-panel lab-table">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Belastning och speltillstånd</span></div>
        <div className="hm-dev-table-wrap"><table className="hm-dev-table"><thead><tr><th>Spelare</th><th className="hm-dev-num">Energi</th><th className="hm-dev-num">Distans</th><th className="hm-dev-num">Speltid</th><th>Medicinsk status</th></tr></thead><tbody>{s.players.map(p=><tr key={p.id}><td>{p.id}</td><td className="hm-dev-num">{Math.round(p.condition.energy*100)}%</td><td className="hm-dev-num">{p.condition.distanceMetres.toFixed(0)} m</td><td className="hm-dev-num">{clock(p.condition.courtMs)}</td><td>{p.condition.unavailable?'Kan inte fortsätta':p.condition.exitRequired?'Måste ut för behandling':p.condition.attacksRemaining?`${p.condition.attacksRemaining} anfall till spelbar`:'Tillgänglig'}</td></tr>)}</tbody></table></div>
      </section>
      <section className="hm-dev-panel">
        <div className="hm-dev-panel-head"><span className="hm-dev-panel-title">Senaste 100 händelser t.o.m. tick {s.tick}</span></div>
        <div className="hm-dev-panel-body lab-events"><p className="lab-note">Filtret påverkar bara visningen. Nedladdningar innehåller hela den kanoniska historiken fram till vald tick.</p>{events.slice(-100).map(e=><p key={e.id}><strong className="hm-dev-num">{e.tick} · {clock(e.officialMs)} · {e.type}</strong><br/>{e.actorId??'domare'} · {JSON.stringify(e.details)}<br/><small>{e.actionId}</small></p>)}</div>
      </section>
    </div>
    <details onToggle={e=>setShowJson(e.currentTarget.open)}><summary>Fullständig exakt snapshot (stor nära slutsignal)</summary>{showJson&&<pre>{JSON.stringify(s,null,2)}</pre>}</details>
  </div>;
}
