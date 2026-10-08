'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub, getCareerSquad } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getLiveStandings } from '@/lib/career/standings';
import { managementAttention, squadEnergy } from '@/lib/career/management';
import { rolloverSeason } from '@/lib/career/seasonRollover';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import { getClubEconomySnapshot } from '@/lib/economy/clubEconomyIntegration';
import { formatEur } from '@/lib/economy/currency';
import { resolveStatusLabel } from '@/lib/career/playerStatus';
import { mondayOf, resolveTrainingWeek } from '@/lib/training/trainingSchedule';
import { categoryLabel } from '@/lib/career/inboxBridge';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import FormDots from '@/components/FormDots';
import { EmptyState, FixtureTable } from '@/components/manager/Workspace';
import { MatchHero, PlayerCell, RankIndicator, ClubHero } from '@/components/game/Identity';

export default function HomePage() {
  const { career, updateCareer } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const attention = useMemo(() => managementAttention(career), [career]);
  const table = useMemo(() => getLiveStandings(career), [career]);
  const ownRow = table.find(r => r.clubId === club.id);
  const next = getNextPlayerFixture(career);
  const competition = COMPETITIONS.find(c => c.id === career.competitionId);
  const economy = getClubEconomySnapshot(career, club.id);
  const week = resolveTrainingWeek(career, mondayOf(career.gameDate));
  const messages = [...career.inbox].filter(m => !m.archived).reverse().slice(0, 4);
  const recent = career.fixtures.filter(f => career.results[f.id]).sort((a,b) => b.date.localeCompare(a.date));
  const ownRecent = recent.filter(f => f.homeClubId === club.id || f.awayClubId === club.id).slice(0,3);
  const issues = [...attention.unavailable.map(p => ({p,detail:resolveStatusLabel(career.playerStatuses,p)})), ...attention.tired.filter(p=>!attention.unavailable.some(x=>x.id===p.id)).map(p=>({p,detail:`${Math.round(squadEnergy(career,p))}% energi`}))];
  return <div className="game-home">
    <header className="game-home-heading"><div><div className="game-overline">DIN KLUBB. DIN SÄSONG. · {career.seasonId}</div><h1>{club.shortName}</h1></div><div><p>{competition?.name}</p><p>{club.venue ?? club.city}</p></div></header>
    {career.seasonComplete ? <><ClubHero clubId={club.id} career={career}/><div className="game-season-complete"><h2>Säsongen är i mål.</h2><p>Slutplacering {ownRow ? table.indexOf(ownRow)+1 : '—'}. Se över kontrakten och bygg laget inför nästa avkast.</p><div className="hm-actions"><button className="hm-btn hm-btn-primary" onClick={()=>updateCareer(rolloverSeason)}>Börja nästa säsong →</button><Link className="hm-btn" href="/career/history">Säsongen i backspegeln →</Link></div></div></> : <div className="game-home-event">{next ? <MatchHero career={career} fixture={next}><Link className="hm-btn" href={`/career/clubs/${next.homeClubId===club.id ? next.awayClubId : next.homeClubId}`}>Motståndaren →</Link><Link className="hm-btn hm-btn-primary" href="/career/match-preview">Förbered match →</Link></MatchHero> : <EmptyState>Inget kommande avkast.</EmptyState>}<aside className="game-season-card"><div><div className="game-overline">{competition?.name} · {ownRow?.played ? 'LIGALÄGET' : 'FÖRE SERIESTART'}</div><RankIndicator position={ownRow ? table.indexOf(ownRow)+1 : '—'} label={`/ ${table.length}`}/><h2>{club.shortName} i ligan</h2></div><div className="game-season-record"><div><strong>{ownRow?.points ?? 0}</strong><small>POÄNG</small></div><div><strong>{ownRow?.played ?? 0}</strong><small>MATCHER</small></div><div><strong>{ownRow?.goalDifference ?? 0}</strong><small>MÅLSKILLNAD</small></div></div><div><span className="game-overline">Senaste fem</span><div><FormDots results={career.clubForm[club.id] ?? []}/>{!(career.clubForm[club.id]?.length) && <small>Inga spelade matcher ännu</small>}</div></div><Link href={`/career/competitions/${career.competitionId}`}>Ligan, resultaten och rivalerna →</Link></aside></div>}
    <div className="game-home-body"><div className="game-home-column">
      <section><div className="game-section-heading"><h2>Laget inför avkast</h2><Link href="/career/squad">Hela truppen →</Link></div><div className="game-availability-line"><strong>{squad.length-attention.unavailable.length}<span>/{squad.length}</span></strong><span>spelare tillgängliga<br /><small>{attention.tired.length} behöver mer återhämtning</small></span><Link className="hm-btn" href="/career/tactics">Välj startsju →</Link></div>{issues.slice(0,3).map(({p,detail})=><div className="game-week-line" key={p.id}><PlayerCell player={p}/><span>{detail}</span></div>)}</section>
      <section><div className="game-section-heading"><h2>Utanför planen</h2><Link href="/career/contracts">Besluten →</Link></div><div className="game-decision"><strong>{attention.contracts.length}</strong><div><h3>Avtal närmar sig slutet</h3><p>Vilka blir kvar i laget? Jämför spelarna, förläng eller leta efter nästa lösning.</p><div className="hm-actions"><Link href="/career/contracts">Planera kontrakten →</Link><Link href="/career/players">Upptäck spelare →</Link></div></div></div>{attention.contracts.slice(0,2).map(r=><div className="game-week-line" key={r.player.id}><PlayerLink playerId={r.player.id}>{r.player.firstName} {r.player.lastName}</PlayerLink><span>{r.player.position} · {r.contract?.contractEndDate}</span></div>)}<div className="game-decision"><strong>{attention.shortlist.length}</strong><div><h3>Spelare på din radar</h3><p>{attention.reports.length} scoutingrapporter tillgängliga. Budget för övergångar: {economy ? formatEur(economy.budgets.transferBudgetEur) : '—'}.</p><Link href="/career/recruitment?view=SHORTLIST">Din kortlista →</Link></div></div></section>
      <section><div className="game-section-heading"><h2>Senaste avtrycket</h2><Link href="/career/schedule">Matcharkivet →</Link></div>{ownRecent.length ? ownRecent.map(f=>{const result=career.results[f.id];return <Link className="game-recent-score" href={`/career/match-report/${f.id}`} key={f.id}><span>{getClub(f.homeClubId)?.shortName}<br />{getClub(f.awayClubId)?.shortName}<small> · {f.date}</small></span><strong>{result.homeGoals}–{result.awayGoals}</strong></Link>;}) : <EmptyState>Säsongens första avkast väntar. Här följer dina resultat och matchrapporter.</EmptyState>}</section>
    </div><div className="game-home-column">
      <section><div className="game-section-heading"><h2>Från klubben</h2><Link href="/career/inbox">Alla nyheter →</Link></div>{messages.map(m=><article className="game-news-line" key={m.id}><Link href={`/career/inbox?message=${encodeURIComponent(m.id)}`}><small>{categoryLabel(m.category)} · {m.date}{!m.read ? ' · NYTT' : ''}</small><strong>{m.subject}</strong><p>{m.preview}</p></Link></article>)}</section>
      <section><div className="game-section-heading"><h2>Veckans rytm</h2><Link href="/career/calendar">Kalender →</Link></div>{week.days.filter(d=>d.date>=career.gameDate).map(d=><Link className="game-week-line" href="/career/training" key={d.date}><time>{d.date}</time><strong>{d.dayType==='MATCH' ? 'MATCHDAG' : d.dayType==='REST' ? 'Vila' : d.dayType==='RECOVERY' ? 'Återhämtning' : `${d.sessions.length} träningspass`}</strong></Link>)}</section>
    </div><div className="game-home-column">
      <section><div className="game-section-heading"><h2>Rivalerna</h2><Link href={`/career/competitions/${career.competitionId}`}>Ligan →</Link></div><table className="hm-table"><thead><tr><th>#</th><th>Klubb</th><th>SM</th><th>P</th></tr></thead><tbody>{table.filter((r,i)=>i<4||r.clubId===club.id).map(r=><tr key={r.clubId} data-highlight={r.clubId===club.id}><td><RankIndicator position={table.indexOf(r)+1}/></td><td><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.shortName ?? r.clubId}</ClubLink></td><td>{r.played}</td><td><strong>{r.points}</strong></td></tr>)}</tbody></table></section>
      <section><div className="game-section-heading"><h2>På andra planer</h2><Link href={`/career/competitions/${career.competitionId}?tab=results`}>Resultaten →</Link></div><FixtureTable career={career} fixtures={recent.filter(f=>f.homeClubId!==club.id&&f.awayClubId!==club.id).slice(0,4)}/></section>
      <section className="game-training-note"><div className="game-overline">NÄSTA LAGINSATS</div><h3>Bygg veckan runt matchen.</h3><p>Träning, återhämtning och spelarbelastning följer kalendern. Förbered laget för nästa avkast.</p><Link className="hm-btn" href="/career/training">Träningsveckan →</Link></section>
    </div></div>
  </div>;
}
