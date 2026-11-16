'use client';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { useMatchArchive } from '@/lib/save/useMatchArchive';
import { advanceProductionMatch, commandProductionMatch, finalizeProductionMatch, archiveFrames, type MatchCommand, type PlayedMatchArchive } from '@/lib/career/productionMatch';
import { frameAt } from '@/lib/career/matchFrames';
import { playbackTick } from '@/lib/career/matchPlayback';
import type { TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { Scoreboard } from '@/components/game/Identity';
import { LiveCoachPanel, AssistantDock } from '@/components/game/LiveCoachPanel';
import { LiveMatchCenter, ArchivedMatchCenter } from '@/components/matchCenter/MatchCenter';
import { Court, LiveCourt, PlanOptions, trailFrames } from '@/components/matchCenter/PlanCourt';
import { SimulationProgress, MatchStateCard } from '@/components/matchCenter/MatchStates';
import { speedForKey, type MatchPhase } from '@/components/matchCenter/liveFlow';
import { DEFAULT_MATCH_SPEED, IMPORTANT_ONLY_FROM_SPEED, MATCH_SPEED_OPTIONS, ticksForElapsed } from '@/lib/matchCenter/model';
import { usePreferences } from '@/lib/settings/usePreferences';
import { advanceMatchCenter, resumeMatchTimeout } from '@/lib/matchCenter/control';
import { matchColors, matchdayBriefing } from '@/lib/matchday/matchday';
import { getClub } from '@/lib/game-data';
import { matchReportHref } from '@/lib/career/fixtureRoutes';

function ExperimentalArchiveReplay({ archive }: { archive: PlayedMatchArchive }) {
  const decoded = useMemo(() => { try { return { frames: archiveFrames(archive), error: null }; } catch (cause) { return { frames: [], error: cause instanceof Error ? cause.message : 'Reprisen kunde inte läsas.' }; } }, [archive]);
  const frames = decoded.frames;
  const { trails } = useContext(PlanOptions);
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
  return <div className="game-live-match"><Scoreboard homeClubId={archive.fixture.homeClubId} awayClubId={archive.fixture.awayClubId} homeScore={frame[3]} awayScore={frame[4]} label="Repris"><span>{Math.floor(frame[1] / 60000)}:{String(Math.floor(frame[1] / 1000) % 60).padStart(2, '0')}</span></Scoreboard><div className="game-court-stage"><Court frame={frame} people={archive.people} colors={matchColors(archive.fixture.homeClubId,archive.fixture.awayClubId)} trail={trails ? trailFrames(frames, frame[0]) : undefined} /></div><div className="game-match-controls"><button className="hm-btn" onClick={() => setPlaying(!playing)}>{playing ? 'Pausa' : 'Spela'}</button> <select aria-label="Reprishastighet" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1, 4, 16, 64].map(n => <option key={n} value={n}>{n}×</option>)}</select><input aria-label="Position i reprisen" type="range" min={frames[0][0]} max={frames.at(-1)![0]} value={Math.floor(tick)} onChange={e => { setTick(Number(e.target.value)); setPlaying(false); }} style={{ width: '100%', marginTop: 16 }} /><p>Slutresultat: {archive.result.homeGoals}–{archive.result.awayGoals}</p></div></div>;
}

/** Normal replay is the recorded event/key-moment experience. The 2D court is the optional "Plan" view. */
export function ArchiveReplay({archive, defaultShowExperimental = false, hideOverview = false}:{archive:PlayedMatchArchive; defaultShowExperimental?: boolean; hideOverview?: boolean}){
  // The manager's own side (an archived replay used to default to HOME, mislabelling away results).
  const { career } = useCareer();
  const team: TeamId = archive.fixture.awayClubId === career.playerClubId ? 'AWAY' : 'HOME';
  const decoded=useMemo(()=>{try{return{frames:archiveFrames(archive),error:null};}catch{return{frames:[],error:'Positionsbilderna kunde inte läsas. Matchrapporten finns kvar.'};}},[archive]);
  return <>{decoded.error&&<p role="alert">{decoded.error}</p>}<ArchivedMatchCenter archive={archive} frames={decoded.frames} team={team} defaultShowExperimental={defaultShowExperimental} hideOverview={hideOverview} experimental={<ExperimentalArchiveReplay archive={archive}/>}/></>;
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, select, textarea, [contenteditable="true"]');
const isControl = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('button, a, summary, [role="button"], [role="tab"], [role="radio"], [role="switch"]');

export default function ProductionMatchView({ fixtureId, quickFinish = false }: { fixtureId: string; quickFinish?: boolean }) {
  const router = useRouter();
  const { career, updateCareer } = useCareer();
  const [preferences, updatePreferences] = usePreferences();
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState<number>(preferences.defaultMatchSpeed ?? DEFAULT_MATCH_SPEED), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(quickFinish);
  const lastAdvance=useRef<number|null>(null);
  const [keyMode,setKeyMode]=useState(false),[untilKey,setUntilKey]=useState(false);
  const stopped=useRef(false),coachRef=useRef<HTMLDivElement>(null);
  const [outId, setOutId] = useState(''), [inId, setInId] = useState('');
  const [finishing, setFinishing] = useState(quickFinish);
  const [moreOpen, setMoreOpen] = useState(false), [confirmFinish, setConfirmFinish] = useState(false), [speedOpen, setSpeedOpen] = useState(false);
  const session = career.productionMatch;
  const replay = useMatchArchive(fixtureId, !session || session.fixture.id !== fixtureId);
  useEffect(() => {
    if ((!playing && !finishing) || !session || session.fixture.id !== fixtureId) return;
    if (session.core.match?.phase === 'FULLTIME' && finishing) {
      const timer = setTimeout(() => { updateCareer(finalizeProductionMatch); setBusy(false); setFinishing(false); router.replace(matchReportHref(fixtureId)); }, 0);
      return () => clearTimeout(timer);
    }
    if (session.core.status !== 'RUNNING' || (session.pausedAtHalf && !finishing)) return;
    const timer = setTimeout(() => updateCareer(state => {
      if(finishing)return advanceProductionMatch(state.productionMatch?.pausedAtHalf?commandProductionMatch(state,{kind:'SECOND_HALF'}):state,10000,false);
      // HM-PLAYTEST-01 7.1: advance by the wall-clock time that really passed, so a speed means what it says.
      const now=performance.now(),elapsed=lastAdvance.current===null?200:now-lastAdvance.current;lastAdvance.current=now;
      const ticks=untilKey?128:ticksForElapsed(speed,elapsed),next=advanceMatchCenter(state,ticks,keyMode||untilKey,()=>{stopped.current=true;});
      if(next.productionMatch&&(next.productionMatch.pausedAtHalf||next.productionMatch.core.match?.phase==='FULLTIME'))stopped.current=true;
      return next;
    }), finishing ? 10 : untilKey?50:200);
    return () => clearTimeout(timer);
  }, [playing, finishing, speed, session, fixtureId, updateCareer, router,keyMode,untilKey]);
  useEffect(()=>{if(stopped.current){stopped.current=false;setPlaying(false);setUntilKey(false);}},[session]);
  useEffect(()=>{if(!playing)lastAdvance.current=null;},[playing,speed]);

  const live = !!session && session.fixture.id === fixtureId;
  const fulltime = live && session.core.match?.phase === 'FULLTIME';
  const timeout = live && session.core.referee.timeout?.reason === 'TEAM_TIMEOUT';
  const control = live && session.control?.by === 'ASSISTANT' ? session.control : null;
  /** MDY-02b: speed is remembered as the next match's starting speed. */
  function chooseSpeed(value: number) { setSpeed(value); setSpeedOpen(false); if (value !== preferences.defaultMatchSpeed) updatePreferences({ defaultMatchSpeed: value }); }
  function apply(command: MatchCommand) { try { updateCareer(state => commandProductionMatch(state, command)); if(command.kind==='TIMEOUT'){setPlaying(false);setUntilKey(false);} setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Beslutet kunde inte genomföras.'); } }
  function primary() { if (!session) return; if(timeout)updateCareer(resumeMatchTimeout);if(session.pausedAtHalf)apply({kind:'SECOND_HALF'});setUntilKey(false);setPlaying(!playing||session.pausedAtHalf||timeout); }
  function nextKey() { setUntilKey(true); setPlaying(true); }
  function finish() { setPlaying(false); setBusy(true); setFinishing(true); setMoreOpen(false); setConfirmFinish(false); }
  const canPrimary = live && !fulltime && !busy && !session.error;
  const canNext = live && !fulltime && !busy && !session.pausedAtHalf && !timeout;
  // MDY-02b keyboard shortcuts: Space plays/pauses (when no control has focus), 1-7 pick a speed, N jumps to the next key event.
  useEffect(() => {
    if (!live || fulltime) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === ' ' && !isControl(e.target) && canPrimary) { e.preventDefault(); primary(); return; }
      const value = speedForKey(e.key);
      if (value !== null && !busy) { e.preventDefault(); chooseSpeed(value); return; }
      if ((e.key === 'n' || e.key === 'N') && canNext) { e.preventDefault(); nextKey(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const archive = replay.archive;
  if (!session || session.fixture.id !== fixtureId) {
    if (replay.loading) return <MatchStateCard tone="loading" title="Laddar matchreprisen…"><p>Händelserna och positionerna läses från ditt sparade spel.</p></MatchStateCard>;
    if (replay.error) return <MatchStateCard tone="error" title="Reprisen kunde inte laddas" actions={<button className="hm-btn hm-btn-primary" onClick={replay.retry}>Försök igen</button>}><p>{replay.error}</p></MatchStateCard>;
    if (archive) return <><div className="mc-replay-actions"><Link className="hm-btn" href={matchReportHref(fixtureId)}>Matchrapport</Link> <Link className="hm-btn hm-btn-primary" href="/career">Fortsätt karriären</Link></div><ArchiveReplay archive={archive} defaultShowExperimental /></>;
    const played = !!career.results[fixtureId];
    return <MatchStateCard title={played ? 'Matchen är spelad' : 'Matchen har inte startat'} actions={<Link className="hm-btn hm-btn-primary" href={played ? matchReportHref(fixtureId) : '/career/match-preview'}>{played ? 'Öppna matchrapporten' : 'Öppna match'}</Link>}><p>{played ? 'Resultatet finns i matchrapporten. Den här matchen saknar sparade händelser för repris.' : 'Starta matchen från matchförhandsvisningen.'}</p></MatchStateCard>;
  }
  const c = session.core, team = session.fixture.homeClubId === career.playerClubId ? 'HOME' : 'AWAY';
  const brief=matchdayBriefing(career,session.fixture);
  const banner = (brief.stakes.level>=3||control)&&<p className="mday-banner" role="note"><b>{getClub(session.fixture.homeClubId)?.shortName} – {getClub(session.fixture.awayClubId)?.shortName}</b>{brief.stakes.labels.map(l=><span key={l}>{l}</span>)}{control&&<span>{control.name} leder laget från bänken</span>}</p>;
  if (finishing) return <>{banner}<SimulationProgress session={session}/></>;
  const recent = c.events.filter(e => ['GOAL', 'SAVE_CAUGHT', 'SAVE_PARRY', 'WHISTLE_RESTART', 'ADVANTAGE_REALIZED', 'TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION', 'EXCHANGE_COMPLETED', 'TEAM_TIMEOUT_STARTED', 'TACTICS_CHANGED'].includes(e.type)).slice(-8).reverse();
  function choosePlayer(id:string){setOutId(id);setInId('');coachRef.current?.scrollIntoView({block:'nearest'});coachRef.current?.focus();}
  const phase: MatchPhase = fulltime ? 'FINAL' : session.pausedAtHalf || c.match?.phase === 'HALFTIME' ? 'HALFTIME' : timeout ? 'HUDDLE' : c.match?.phase === 'PREMATCH' ? 'WALKOUT' : 'LIVE';
  const speedOption = MATCH_SPEED_OPTIONS.find(o => o.value === speed);

  const primaryAction = fulltime
    ? <button type="button" className="hm-btn hm-btn-primary mc-transport-primary" onClick={()=>{updateCareer(finalizeProductionMatch);router.push(matchReportHref(fixtureId));}}>Slutför match och öppna rapport</button>
    : <button type="button" className="hm-btn hm-btn-primary mc-transport-primary" data-state={timeout ? 'resume' : session.pausedAtHalf ? 'second-half' : playing ? 'pause' : 'play'} disabled={busy||!!session.error} onClick={primary}>{timeout?'Återuppta efter timeout':session.pausedAtHalf?'Starta andra halvlek':playing?'Pausa':'Spela'}</button>;

  const transport = <>
    {!fulltime && <>
      <div className="mc-speed" data-open={speedOpen || undefined}>
        <button type="button" className="mc-speed-toggle" aria-expanded={speedOpen} onClick={() => setSpeedOpen(!speedOpen)}>Hastighet <b>{speed}×</b></button>
        <div className="mc-speed-scrubber" role="radiogroup" aria-label="Matchhastighet" onKeyDown={e => { const i = MATCH_SPEED_OPTIONS.findIndex(o => o.value === speed); const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0; if (!step) return; e.preventDefault(); const next = MATCH_SPEED_OPTIONS[Math.max(0, Math.min(MATCH_SPEED_OPTIONS.length - 1, i + step))]; chooseSpeed(next.value); (e.currentTarget.querySelector(`[data-speed="${next.value}"]`) as HTMLElement | null)?.focus(); }}>
          {MATCH_SPEED_OPTIONS.map((o, i) => <button key={o.value} type="button" role="radio" data-speed={o.value} aria-checked={speed === o.value} tabIndex={speed === o.value ? 0 : -1} aria-label={`${o.label} ${o.value}×`} title={`${o.label} · en hel match tar ${o.note} · tangent ${i + 1}`} disabled={busy} onClick={() => chooseSpeed(o.value)}><b>{o.value}×</b><small>{o.label}</small></button>)}
        </div>
        <span className="mc-speed-note" aria-live="polite">{speedOption ? `${speedOption.label}: en hel match ≈ ${speedOption.note}` : ''}</span>
      </div>
      <button type="button" className="hm-btn mc-transport-next" disabled={!canNext} title={session.pausedAtHalf ? 'Starta andra halvlek först.' : timeout ? 'Återuppta efter timeouten först.' : 'Spelar fram till nästa mål, utvisning, 7m eller timeout.'} onClick={nextKey}>Nästa viktiga händelse</button>
      <div className="mc-transport-more">
        <button type="button" className="hm-btn mc-more-toggle" aria-expanded={moreOpen} onClick={() => { setMoreOpen(!moreOpen); setConfirmFinish(false); }}>Mer</button>
        {moreOpen && <div className="mc-more-menu" role="group" aria-label="Fler matchval">
          <button type="button" className="hm-btn" aria-pressed={keyMode} disabled={busy} onClick={()=>setKeyMode(!keyMode)}>Nyckelhändelser {keyMode?'på':'av'}</button>
          <small>{keyMode ? 'Spelet stannar vid varje nyckelhändelse.' : 'Spelet rullar tills du pausar.'}</small>
          {confirmFinish ? <div className="mc-finish-confirm" role="group" aria-label="Bekräfta spela till slut"><p>Resten av matchen simuleras utan dina beslut och rapporten öppnas.</p><button type="button" className="hm-btn hm-btn-primary" onClick={finish}>Ja, spela till slut</button><button type="button" className="hm-btn" onClick={() => setConfirmFinish(false)}>Avbryt</button></div>
            : <button type="button" className="hm-btn" disabled={busy} onClick={() => setConfirmFinish(true)}>{busy?'Spelar färdigt…':'Spela till slut'}</button>}
        </div>}
      </div>
    </>}
    <span className="mc-autosave">Matchen sparas automatiskt. Pausa innan du lämnar.{!fulltime && <> <span className="mc-transport-keys">Mellanslag spela/pausa · 1–7 hastighet · N nästa händelse</span></>}</span>
    {(error||session.error)&&<p role="alert">{error??session.error}</p>}
  </>;

  return <>{banner}<LiveMatchCenter session={session} playing={playing} team={team} importantOnly={playing&&speed>=IMPORTANT_ONLY_FROM_SPEED} onPlayer={!fulltime&&!busy&&!control?choosePlayer:undefined} onCommand={apply} onResumeTimeout={()=>{if(timeout)updateCareer(resumeMatchTimeout);setUntilKey(false);setPlaying(true);}} callingTeam={c.events.findLast(e=>e.type==='TEAM_TIMEOUT_STARTED')?.details.team as TeamId|undefined} control={control}
    primaryAction={primaryAction}
    controls={transport}
    coach={!fulltime&&control?<AssistantDock session={session} team={team} control={control}/>:!fulltime?<div ref={coachRef} tabIndex={-1} aria-label="Byten och instruktioner"><LiveCoachPanel session={session} team={team} busy={busy} outId={outId} inId={inId} onOut={id=>{setOutId(id);setInId('');}} onIn={setInId} onSubstitute={()=>{apply({kind:'SUBSTITUTION',team,outId,inId});setOutId('');setInId('');}} onCommand={apply} recent={recent} showEvents={false} phase={phase}/></div>:undefined}
    experimental={<div className="game-court-stage"><LiveCourt key={session.fixture.id} session={session} playing={playing} speed={speed}/></div>}
  /></>;
}
