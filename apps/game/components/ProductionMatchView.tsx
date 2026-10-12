'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { advanceProductionMatch, commandProductionMatch, finalizeProductionMatch, observedFrame, archiveFrames, type MatchCommand, type MatchFrame, type MatchPerson, type PlayedMatchArchive } from '@/lib/career/productionMatch';
import { frameAt } from '@/lib/career/matchFrames';
import { playbackTick } from '@/lib/career/matchPlayback';
import type { ProductionMatchSession } from '@/lib/career/productionMatch';
import { Scoreboard } from '@/components/game/Identity';
import { LiveCoachPanel } from '@/components/game/LiveCoachPanel';
import { LiveMatchCenter, ArchivedMatchCenter } from '@/components/matchCenter/MatchCenter';
import { MATCH_SPEEDS } from '@/lib/matchCenter/model';
import { advanceMatchCenter, resumeMatchTimeout } from '@/lib/matchCenter/control';

function Court({ frame, people }: { frame: MatchFrame; people: MatchPerson[] }) {
  return <svg data-render-tick={frame[0]} viewBox="-150 -100 4300 2200" aria-label="Handbollsplan med matchens spelare och boll" style={{ width: '100%', maxHeight: '64vh', minHeight: 340 }}>
    <g transform="matrix(0 1 -1 0 4000 0)">
    <rect x="0" y="0" width="2000" height="4000" rx="10" fill="#173e51" stroke="#d2e7ee" strokeWidth="8" />
    <g fill="none" stroke="#d2e7ee" strokeWidth="7">
      <path d="M0 2000 H2000" /><circle cx="1000" cy="2000" r="200" />
      <path d="M250 0 A600 600 0 0 0 850 600 H1150 A600 600 0 0 0 1750 0 M250 4000 A600 600 0 0 1 850 3400 H1150 A600 600 0 0 1 1750 4000" />
      <path strokeDasharray="25 20" d="M0 0 A1000 900 0 0 0 2000 0 M0 4000 A1000 900 0 0 1 2000 4000" />
      <path d="M850 0 V-90 H1150 V0 M850 4000 V4090 H1150 V4000 M900 700 H1100 M900 3300 H1100" />
    </g>
    </g>
    {Array.from({ length: Math.floor((frame.length - 7) / 3) }, (_, n) => {
      const at = 7 + n * 3, person = people[frame[at]];
      if (!person) return null;
      return <g key={person.id} transform={`translate(${4000 - frame[at + 2]} ${frame[at + 1]})`}><circle r="43" fill={person.team === 'HOME' ? '#4da5ef' : '#ef775f'} stroke={person.role === 'GK' ? '#ffe6a0' : '#fff'} strokeWidth="7" /><text textAnchor="middle" dominantBaseline="central" fill="white" fontSize="35" fontWeight="700">{person.number}</text><title>{person.name}</title></g>;
    })}
    <circle cx={4000 - frame[6]} cy={frame[5]} r="20" fill="#ffdc5b" stroke="#182c38" strokeWidth="5" />
  </svg>;
}

/** A display may trail the engine, but never extrapolates beyond its buffer. */
function LiveCourt({session,playing,speed}:{session:ProductionMatchSession;playing:boolean;speed:number}) {
  const latest=useRef(session);
  useEffect(()=>{latest.current=session;},[session]);
  const cursor=useRef(session.core.tick),[tick,setTick]=useState(session.core.tick);
  useEffect(()=>{
    if(!playing)return;
    let request=0,last:number|null=null;
    const render=(now:number)=>{
      const elapsed=last===null||document.hidden?0:now-last;last=now;
      cursor.current=playbackTick(cursor.current,elapsed,speed,latest.current.core.tick);
      setTick(cursor.current);request=requestAnimationFrame(render);
    };
    request=requestAnimationFrame(render);return()=>cancelAnimationFrame(request);
  },[playing,speed]);
  return <Court frame={frameAt(session.frames,tick)} people={session.people}/>;
}

function ExperimentalArchiveReplay({ archive }: { archive: PlayedMatchArchive }) {
  const decoded = useMemo(() => { try { return { frames: archiveFrames(archive), error: null }; } catch (cause) { return { frames: [], error: cause instanceof Error ? cause.message : 'Reprisen kunde inte läsas.' }; } }, [archive]);
  const frames = decoded.frames;
  const [tick, setTick] = useState(frames[0]?.[0] ?? 0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(4);
  useEffect(() => {
    if (!playing) return;
    let request=0,last:number|null=null;
    const render=(now:number)=>{const elapsed=last===null||document.hidden?0:now-last;last=now;setTick(i=>playbackTick(i,elapsed,speed,frames.at(-1)?.[0]??0));request=requestAnimationFrame(render);};
    request=requestAnimationFrame(render);
    return () => cancelAnimationFrame(request);
  }, [playing, speed, frames]);
  const frame = frames.length ? frameAt(frames, tick) : null;
  if (!frame) return <p role="alert">{decoded.error ?? 'Den här matchen saknar sparad 2D-visning.'}</p>;
  return <div className="game-live-match"><Scoreboard homeClubId={archive.fixture.homeClubId} awayClubId={archive.fixture.awayClubId} homeScore={frame[3]} awayScore={frame[4]} label="Repris"><span>{Math.floor(frame[1] / 60000)}:{String(Math.floor(frame[1] / 1000) % 60).padStart(2, '0')}</span></Scoreboard><div className="game-court-stage"><Court frame={frame} people={archive.people} /></div><div className="game-match-controls"><button className="hm-btn" onClick={() => setPlaying(!playing)}>{playing ? 'Pausa' : 'Spela'}</button> <select aria-label="Reprishastighet" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1, 4, 16, 64].map(n => <option key={n} value={n}>{n}×</option>)}</select><input aria-label="Position i reprisen" type="range" min={frames[0][0]} max={frames.at(-1)![0]} value={Math.floor(tick)} onChange={e => { setTick(Number(e.target.value)); setPlaying(false); }} style={{ width: '100%', marginTop: 16 }} /><p>Slutresultat: {archive.result.homeGoals}–{archive.result.awayGoals}</p></div></div>;
}

/** Normal replay is the recorded event/key-moment experience. 2D remains optional. */
export function ArchiveReplay({archive}:{archive:PlayedMatchArchive}){
  const decoded=useMemo(()=>{try{return{frames:archiveFrames(archive),error:null};}catch{return{frames:[],error:'Positionsbilderna kunde inte läsas. Matchrapporten finns kvar.'};}},[archive]);
  return <>{decoded.error&&<p role="alert">{decoded.error}</p>}<ArchivedMatchCenter archive={archive} frames={decoded.frames} experimental={<ExperimentalArchiveReplay archive={archive}/>}/></>;
}

export default function ProductionMatchView({ fixtureId, quickFinish = false }: { fixtureId: string; quickFinish?: boolean }) {
  const router = useRouter();
  const { career, updateCareer } = useCareer();
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(4), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(quickFinish);
  const [keyMode,setKeyMode]=useState(false),[untilKey,setUntilKey]=useState(false);
  const stopped=useRef(false),coachRef=useRef<HTMLDivElement>(null);
  const [outId, setOutId] = useState(''), [inId, setInId] = useState('');
  const [finishing, setFinishing] = useState(quickFinish);
  const session = career.productionMatch;
  useEffect(() => {
    if ((!playing && !finishing) || !session || session.fixture.id !== fixtureId) return;
    if (session.core.match?.phase === 'FULLTIME' && finishing) {
      const timer = setTimeout(() => { updateCareer(finalizeProductionMatch); setBusy(false); setFinishing(false); router.replace(`/career/match-report/${fixtureId}`); }, 0);
      return () => clearTimeout(timer);
    }
    if (session.core.status !== 'RUNNING' || (session.pausedAtHalf && !finishing)) return;
    const timer = setTimeout(() => updateCareer(state => {
      if(finishing)return advanceProductionMatch(state.productionMatch?.pausedAtHalf?commandProductionMatch(state,{kind:'SECOND_HALF'}):state,1000,false);
      const ticks=untilKey?128:Math.max(1,speed)*4,next=advanceMatchCenter(state,ticks,keyMode||untilKey,()=>{stopped.current=true;});
      if(next.productionMatch&&(next.productionMatch.pausedAtHalf||next.productionMatch.core.match?.phase==='FULLTIME'))stopped.current=true;
      return next;
    }), finishing ? 10 : untilKey?50:200);
    return () => clearTimeout(timer);
  }, [playing, finishing, speed, session, fixtureId, updateCareer, router,keyMode,untilKey]);
  useEffect(()=>{if(stopped.current){stopped.current=false;setPlaying(false);setUntilKey(false);}},[session]);
  const archive = career.matchArchives?.[fixtureId];
  if (!session || session.fixture.id !== fixtureId) {
    if (archive) return <><div style={{ marginBottom: 12 }}><Link className="hm-btn" href={`/career/match-report/${fixtureId}`}>Matchrapport</Link> <Link className="hm-btn hm-btn-primary" href="/career">Fortsätt karriären</Link></div><ArchiveReplay archive={archive} /></>;
    return <div className="hm-panel-body"><p>{career.results[fixtureId] ? 'Resultatet finns i matchrapporten. Den här matchen saknar sparade händelser för repris.' : 'Starta matchen från matchförhandsvisningen.'}</p><Link className="hm-btn" href={career.results[fixtureId] ? `/career/match-report/${fixtureId}` : '/career/match-preview'}>Öppna match</Link></div>;
  }
  const c = session.core, team = session.fixture.homeClubId === career.playerClubId ? 'HOME' : 'AWAY';
  const fulltime = c.match?.phase === 'FULLTIME';
  function apply(command: MatchCommand) { try { updateCareer(state => commandProductionMatch(state, command)); if(command.kind==='TIMEOUT'){setPlaying(false);setUntilKey(false);} setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Beslutet kunde inte genomföras.'); } }
  function finish() { setPlaying(false); setBusy(true); setFinishing(true); }
  const recent = c.events.filter(e => ['GOAL', 'SAVE_CAUGHT', 'SAVE_PARRY', 'WHISTLE_RESTART', 'ADVANTAGE_REALIZED', 'TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION', 'EXCHANGE_COMPLETED', 'TEAM_TIMEOUT_STARTED', 'TACTICS_CHANGED'].includes(e.type)).slice(-8).reverse();
  function choosePlayer(id:string){setOutId(id);setInId('');coachRef.current?.scrollIntoView({block:'nearest'});coachRef.current?.focus();}
  const timeout=c.referee.timeout?.reason==='TEAM_TIMEOUT';
  return <><LiveMatchCenter session={session} playing={playing} team={team} importantOnly={playing&&speed>=8} onPlayer={!fulltime&&!busy?choosePlayer:undefined}
    controls={<>{!fulltime&&<><button type="button" className="hm-btn hm-btn-primary" disabled={busy||!!session.error} onClick={()=>{if(timeout)updateCareer(resumeMatchTimeout);if(session.pausedAtHalf)apply({kind:'SECOND_HALF'});setUntilKey(false);setPlaying(!playing||session.pausedAtHalf||timeout);}}>{timeout?'Återuppta efter timeout':session.pausedAtHalf?'Starta andra halvlek':playing?'Pausa':'Spela'}</button><label>Hastighet <select aria-label="Matchhastighet" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{MATCH_SPEEDS.map(n=><option value={n} key={n}>{n}×</option>)}</select></label><button type="button" className="hm-btn" disabled={busy||session.pausedAtHalf||timeout} onClick={()=>{setUntilKey(true);setPlaying(true);}}>Nästa viktiga händelse</button><button type="button" className="hm-btn" aria-pressed={keyMode} disabled={busy} onClick={()=>setKeyMode(!keyMode)}>Nyckelhändelser {keyMode?'på':'av'}</button><button type="button" className="hm-btn" disabled={busy} onClick={finish}>{busy?'Spelar färdigt…':'Spela till slut'}</button></>}{fulltime&&<button type="button" className="hm-btn hm-btn-primary" onClick={()=>{updateCareer(finalizeProductionMatch);router.push(`/career/match-report/${fixtureId}`);}}>Slutför match och öppna rapport</button>}<span className="mc-autosave">Matchen sparas automatiskt. Pausa innan du lämnar.</span>{(error||session.error)&&<p role="alert">{error??session.error}</p>}</>}
    coach={!fulltime?<div ref={coachRef} tabIndex={-1} aria-label="Byten och instruktioner"><LiveCoachPanel session={session} team={team} busy={busy} outId={outId} inId={inId} onOut={id=>{setOutId(id);setInId('');}} onIn={setInId} onSubstitute={()=>{apply({kind:'SUBSTITUTION',team,outId,inId});setOutId('');setInId('');}} onCommand={apply} recent={recent} showEvents={false}/></div>:undefined}
    experimental={<div className="game-court-stage">{finishing?<Court frame={observedFrame(session)} people={session.people}/>:<LiveCourt key={session.fixture.id} session={session} playing={playing} speed={speed}/>}</div>}
  /></>;
}
