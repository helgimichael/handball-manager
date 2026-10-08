'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { COMPETITIONS, getClubsByCompetition, getClub } from '@/lib/game-data';
import { getLiveStandings } from '@/lib/career/standings';
import { managementPlayers } from '@/lib/career/management';
import { ClubLink } from '@/components/entityLinks';
import { CompetitionHero, PlayerCell, RankIndicator } from '@/components/game/Identity';
import FormDots from '@/components/FormDots';
import { Panel, EmptyState, FixtureTable, matchHref } from './Workspace';
import StatisticsTable from './StatisticsTable';

export default function CompetitionWorkspace() {
  return <Suspense fallback={<EmptyState>Läser tävlingen…</EmptyState>}><Competition /></Suspense>;
}

function Competition() {
  const { career } = useCareer();
  const router = useRouter();
  const params = useParams<{ competitionId?: string }>();
  const query = useSearchParams();
  const id = params.competitionId ?? career.competitionId;
  const competition = COMPETITIONS.find(c => c.id === id);
  if (!competition) return <EmptyState>Tävlingen hittades inte. <Link href="/career/competitions">Öppna tävlingar →</Link></EmptyState>;

  const live = id === career.competitionId;
  const tab = query.get('tab') ?? 'table';
  const table = live ? getLiveStandings(career) : [];
  const clubs = getClubsByCompetition(id);
  const fixtures = career.fixtures.filter(f => f.competitionId === id);
  const upcoming = fixtures.filter(f => !career.results[f.id]).sort((a,b) => a.date.localeCompare(b.date));
  const played = fixtures.filter(f => !!career.results[f.id]).sort((a,b) => b.date.localeCompare(a.date));
  const leaguePlayed = played.filter(f => f.type === 'LEAGUE');
  const nextRound = upcoming.find(f => f.type === 'LEAGUE')?.round;
  const nextRoundFixtures = nextRound === undefined ? upcoming.slice(0,7) : upcoming.filter(f => f.type === 'LEAGUE' && f.round === nextRound);
  const playerClubRow = table.find(r => r.clubId === career.playerClubId);
  const playerClubRank = playerClubRow ? table.indexOf(playerClubRow) + 1 : null;
  const players = new Map(managementPlayers(career).map(p => [p.id,p]));
  const leaders = Object.values(career.playerSeasonStats).filter(stat => {
    const player = players.get(stat.playerId);
    return !!player && getClub(player.clubId)?.competitionId === id && stat.appearances > 0;
  }).sort((a,b) => b.goals - a.goals || b.appearances - a.appearances).slice(0,5);
  const href = `/career/competitions/${encodeURIComponent(id)}`;

  return <div className="hm-league-page">
    <CompetitionHero competitionId={id} career={career} />
    <div className="hm-league-switch">
      <label>Tävling<select className="hm-select" value={id} onChange={e => router.push(`/career/competitions/${encodeURIComponent(e.target.value)}`)}>{COMPETITIONS.map(c => <option value={c.id} key={c.id}>{c.name} · {c.nation}</option>)}</select></label>
      <div className="hm-league-meta"><span>{clubs.length} klubbar</span><span>{live ? `${leaguePlayed.length} spelade ligamatcher` : 'Spelare & klubbar i rekryteringsvärlden'}</span>{nextRound !== undefined && <span>Nästa omgång · {nextRound}</span>}</div>
    </div>
    <nav className="hm-tabs" aria-label="Tävlingsvyer">{[['table','Tabell & form'],['fixtures','Matcher'],['results','Resultat'],['statistics','Spelarstatistik'],['clubs','Klubbar'],['history','Historik']].map(([t,label]) => <Link key={t} aria-current={tab === t ? 'page' : undefined} href={`${href}?tab=${t}`}>{label}</Link>)}</nav>
    <div className="hm-league-split">
      <div className="hm-world-main">
        {tab === 'table' && <Panel title="Tabell & form" actions={live ? <span className="hm-text-muted">{career.seasonId} · efter {leaguePlayed.length} ligamatcher</span> : undefined}>
          {live ? <div className="hm-scroll-x"><table className="hm-table hm-league-table"><thead><tr><th>#</th><th>Klubb</th><th>SM</th><th>V</th><th>O</th><th>F</th><th>GM</th><th>IM</th><th>MSK</th><th>P</th><th>Form · fem senaste</th></tr></thead><tbody>{table.map((r,i) => <tr key={r.clubId} data-highlight={r.clubId === career.playerClubId}><td>{i+1}</td><td><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.name ?? r.clubId}</ClubLink></td><td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.goalsFor}</td><td>{r.goalsAgainst}</td><td>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td><td><strong>{r.points}</strong></td><td><FormDots results={(career.clubForm[r.clubId] ?? []).slice(-5)} /></td></tr>)}</tbody></table></div> : <EmptyState>Denna tävling har ingen simulerad tabell. <Link href={`${href}?tab=clubs`}>Inspektera klubbarna →</Link></EmptyState>}
        </Panel>}
        {(tab === 'fixtures' || tab === 'results') && <Panel title={tab === 'results' ? 'Spelade matcher' : 'Kommande matcher'}><FixtureTable career={career} fixtures={tab === 'results' ? played : upcoming} /></Panel>}
        {tab === 'statistics' && <Panel title="Spelarstatistik"><StatisticsTable competitionId={id} /></Panel>}
        {tab === 'clubs' && <Panel title={`${clubs.length} klubbar`}><table className="hm-table"><thead><tr><th>Klubb</th><th>Stad</th><th>Spelare i karriären</th></tr></thead><tbody>{clubs.map(c => <tr key={c.id}><td><ClubLink clubId={c.id}>{c.name}</ClubLink></td><td>{c.city ?? '—'}</td><td>{career.worldSquads[c.id]?.length ?? 'Ingen truppdata'}</td></tr>)}</tbody></table></Panel>}
        {tab === 'history' && <Panel title="Avslutade säsonger">{career.seasonHistory?.filter(s => s.competitionId === id).length ? career.seasonHistory.filter(s => s.competitionId === id).map(s => <div className="hm-detail-row" key={s.seasonId}><Link href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId} · sluttabell & spelarstatistik →</Link></div>) : <EmptyState>Ingen avslutad säsong registrerad för denna tävling.</EmptyState>}</Panel>}
      </div>
      <aside className="hm-world-rail" aria-label="Ligan just nu">
        {playerClubRow && playerClubRank && <Panel title="Din klubb i ligan"><div className="hm-league-your-club"><RankIndicator position={playerClubRank} /><div><strong><ClubLink clubId={career.playerClubId}>{getClub(career.playerClubId)?.name ?? 'Din klubb'}</ClubLink></strong><FormDots results={(career.clubForm[career.playerClubId] ?? []).slice(-5)} /><small>{playerClubRow.points} poäng · {playerClubRow.played} matcher · {playerClubRow.goalDifference > 0 ? '+' : ''}{playerClubRow.goalDifference} i målskillnad</small></div></div></Panel>}
        {live && <Panel title={nextRound === undefined ? 'Kommande matcher' : `Omgång ${nextRound}`} actions={<Link href={`${href}?tab=fixtures`}>Alla →</Link>}>
          {nextRoundFixtures.length ? <div className="hm-league-match-list"><div className="hm-league-round">{nextRoundFixtures[0]?.date} · ligans nästa matcher</div>{nextRoundFixtures.map(f => <div className="hm-league-match-row" key={f.id}><ClubLink clubId={f.homeClubId}>{getClub(f.homeClubId)?.shortName ?? f.homeClubId}</ClubLink><Link className="hm-result-link" href={matchHref(career,f)} aria-label={`${getClub(f.homeClubId)?.name ?? f.homeClubId} mot ${getClub(f.awayClubId)?.name ?? f.awayClubId}`}>VS</Link><ClubLink clubId={f.awayClubId}>{getClub(f.awayClubId)?.shortName ?? f.awayClubId}</ClubLink></div>)}</div> : <EmptyState>Inga kommande matcher registrerade.</EmptyState>}
        </Panel>}
        {played.length > 0 && <Panel title="Senaste resultat" actions={<Link href={`${href}?tab=results`}>Alla →</Link>}><div className="hm-league-match-list">{played.slice(0,5).map(f => { const r = career.results[f.id]; return <div className="hm-league-match-row" key={f.id}><ClubLink clubId={f.homeClubId}>{getClub(f.homeClubId)?.shortName ?? f.homeClubId}</ClubLink><Link className="hm-result-link" href={matchHref(career,f)}>{r.homeGoals}–{r.awayGoals}</Link><ClubLink clubId={f.awayClubId}>{getClub(f.awayClubId)?.shortName ?? f.awayClubId}</ClubLink></div>; })}</div></Panel>}
        <Panel title="Skytteligan" actions={<Link href={`${href}?tab=statistics`}>Statistik →</Link>}>
          {leaders.length ? <ol className="hm-world-player-list">{leaders.map((stat,index) => { const player=players.get(stat.playerId)!; return <li key={stat.playerId}><RankIndicator position={index+1} /><PlayerCell player={player} /><span className="hm-world-player-score" title={`${stat.goals} mål på ${stat.appearances} matcher`}>{stat.goals}</span></li>; })}</ol> : <EmptyState>Skytteligan börjar när matcherna spelas.</EmptyState>}
        </Panel>
        {!live && <section className="hm-world-note"><h2>Upptäck en ny spelarmarknad</h2><p>Besök klubbarna och följ deras spelare genom scouting. Den här ligan har ingen simulerad matchkalender i din karriär.</p><Link href={`${href}?tab=clubs`}>Inspektera klubbarna →</Link></section>}
      </aside>
    </div>
  </div>;
}
