'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { advanceProductionMatch, commandProductionMatch, finalizeProductionMatch, observedFrame, archiveFrames, type MatchCommand, type MatchFrame, type MatchPerson, type PlayedMatchArchive } from '@/lib/career/productionMatch';
import { frameAt } from '@/lib/career/matchFrames';
import { Scoreboard } from '@/components/game/Identity';
import { LiveCoachPanel } from '@/components/game/LiveCoachPanel';

function Court({ frame, people }: { frame: MatchFrame; people: MatchPerson[] }) {
  return <svg viewBox="-150 -100 4300 2200" aria-label="Handbollsplan med matchens spelare och boll" style={{ width: '100%', maxHeight: '64vh', minHeight: 340 }}>
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

export function ArchiveReplay({ archive }: { archive: PlayedMatchArchive }) {
  const decoded = useMemo(() => { try { return { frames: archiveFrames(archive), error: null }; } catch (cause) { return { frames: [], error: cause instanceof Error ? cause.message : 'Reprisen kunde inte läsas.' }; } }, [archive]);
  const frames = decoded.frames;
  const [tick, setTick] = useState(frames[0]?.[0] ?? 0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(4);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTick(i => Math.min(frames.at(-1)?.[0] ?? 0, i + speed)), 50);
    return () => clearInterval(timer);
  }, [playing, speed, frames]);
  const frame = frames.length ? frameAt(frames, tick) : null;
  if (!frame) return <p role="alert">{decoded.error ?? 'Den här matchen saknar sparad 2D-visning.'}</p>;
  return <div className="game-live-match"><Scoreboard homeClubId={archive.fixture.homeClubId} awayClubId={archive.fixture.awayClubId} homeScore={frame[3]} awayScore={frame[4]} label="Repris"><span>{Math.floor(frame[1] / 60000)}:{String(Math.floor(frame[1] / 1000) % 60).padStart(2, '0')}</span></Scoreboard><div className="game-court-stage"><Court frame={frame} people={archive.people} /></div><div className="game-match-controls"><button className="hm-btn" onClick={() => setPlaying(!playing)}>{playing ? 'Pausa' : 'Spela'}</button> <select aria-label="Reprishastighet" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1, 4, 16, 64].map(n => <option key={n} value={n}>{n}×</option>)}</select><input aria-label="Position i reprisen" type="range" min={frames[0][0]} max={frames.at(-1)![0]} value={tick} onChange={e => { setTick(Number(e.target.value)); setPlaying(false); }} style={{ width: '100%', marginTop: 16 }} /><p>Slutresultat: {archive.result.homeGoals}–{archive.result.awayGoals}</p></div></div>;
}

export default function ProductionMatchView({ fixtureId, quickFinish = false }: { fixtureId: string; quickFinish?: boolean }) {
  const router = useRouter();
  const { career, updateCareer } = useCareer();
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(16), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(quickFinish);
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
    const timer = setTimeout(() => updateCareer(state => advanceProductionMatch(state.productionMatch?.pausedAtHalf ? commandProductionMatch(state, { kind: 'SECOND_HALF' }) : state, finishing ? 1000 : Math.max(1, speed), !finishing)), finishing ? 10 : 50);
    return () => clearTimeout(timer);
  }, [playing, finishing, speed, session, fixtureId, updateCareer, router]);
  const archive = career.matchArchives?.[fixtureId];
  if (!session || session.fixture.id !== fixtureId) {
    if (archive) return <><div style={{ marginBottom: 12 }}><Link className="hm-btn" href={`/career/match-report/${fixtureId}`}>Matchrapport</Link> <Link className="hm-btn hm-btn-primary" href="/career">Fortsätt karriären</Link></div><ArchiveReplay archive={archive} /></>;
    return <div className="hm-panel-body"><p>{career.results[fixtureId] ? 'Den här matchen har inget sparat 2D-arkiv.' : 'Starta matchen från matchförhandsvisningen.'}</p><Link className="hm-btn" href={career.results[fixtureId] ? `/career/match-report/${fixtureId}` : '/career/match-preview'}>Öppna match</Link></div>;
  }
  const c = session.core, team = session.fixture.homeClubId === career.playerClubId ? 'HOME' : 'AWAY';
  const fulltime = c.match?.phase === 'FULLTIME';
  const minute = Math.floor(c.officialClock.timeMs / 60000), second = String(Math.floor(c.officialClock.timeMs / 1000) % 60).padStart(2, '0');
  function apply(command: MatchCommand) { try { updateCareer(state => commandProductionMatch(state, command)); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Beslutet kunde inte genomföras.'); } }
  function finish() { setPlaying(false); setBusy(true); setFinishing(true); }
  const recent = c.events.filter(e => ['GOAL', 'SAVE_CAUGHT', 'SAVE_PARRY', 'WHISTLE_RESTART', 'ADVANTAGE_REALIZED', 'TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION', 'EXCHANGE_COMPLETED', 'TEAM_TIMEOUT_STARTED', 'TACTICS_CHANGED'].includes(e.type)).slice(-8).reverse();
  return <div className="game-live-match" data-phase={fulltime ? 'fulltime' : session.pausedAtHalf ? 'halftime' : 'live'}>
    <Scoreboard homeClubId={session.fixture.homeClubId} awayClubId={session.fixture.awayClubId} homeScore={c.score.HOME} awayScore={c.score.AWAY} label={fulltime ? 'SLUTSIGNAL' : session.pausedAtHalf ? 'HALVTID' : 'MATCHCENTRAL'}><strong>{minute}:{second} · {fulltime ? 'Slut' : session.pausedAtHalf ? 'Halvtid' : c.period === 1 ? 'Första halvlek' : 'Andra halvlek'}</strong></Scoreboard>
    <div className="game-live-layout coach-live-layout"><div className="game-live-court">
      <div className="game-match-controls">
        {!fulltime && <><button className="hm-btn hm-btn-primary" disabled={busy || !!session.error} onClick={() => { if (session.pausedAtHalf) apply({ kind: 'SECOND_HALF' }); setPlaying(!playing || session.pausedAtHalf); }}>{session.pausedAtHalf ? 'Starta andra halvlek' : playing ? 'Pausa' : 'Spela'}</button><select aria-label="Matchhastighet" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1, 4, 16, 64].map(n => <option value={n} key={n}>{n}×</option>)}</select><button className="hm-btn" disabled={busy} onClick={finish}>{busy ? 'Spelar färdigt…' : 'Spela till slut'}</button></>}
        {fulltime && <button className="hm-btn hm-btn-primary" onClick={() => { updateCareer(finalizeProductionMatch); router.push(`/career/match-report/${fixtureId}`); }}>Slutför match och öppna rapport</button>}
        <Link className="hm-btn" href="/career/squad">Trupp</Link><span className="hm-text-muted">Matchen sparas automatiskt. Pausa innan du lämnar.</span>
      </div>
      {(error || session.error) && <p role="alert" className="hm-panel-body">{error ?? session.error}</p>}
      <div className="game-court-stage"><Court frame={observedFrame(session)} people={session.people} /></div>
    </div>
    {!fulltime && <LiveCoachPanel session={session} team={team} busy={busy} outId={outId} inId={inId} onOut={id => { setOutId(id); setInId(''); }} onIn={setInId} onSubstitute={() => { apply({ kind: 'SUBSTITUTION', team, outId, inId }); setOutId(''); setInId(''); }} onCommand={apply} recent={recent} />}
    </div>
  </div>;
}
