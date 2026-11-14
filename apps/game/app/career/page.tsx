'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub, getCareerSquad } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getLiveStandings } from '@/lib/career/standings';
import { managementAttention, squadEnergy } from '@/lib/career/management';
import { attemptSeasonTransition } from '@/lib/career/seasonRollover';
import type { Dependency } from '@/lib/competition/transition/types';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import { getClubEconomySnapshot } from '@/lib/economy/clubEconomyIntegration';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { resolveStatusLabel } from '@/lib/career/playerStatus';
import { WeeklyManagerOverview } from '@/components/game/WeeklyManagerOverview';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import ClubCrest from '@/components/ClubCrest';
import { resolveClubIdentity } from '@/components/crests/clubIdentity';
import FormDots from '@/components/FormDots';
import { EmptyState } from '@/components/manager/Workspace';
import { clubColorVars, MatchHero, PlayerCell, RankIndicator, ClubHero } from '@/components/game/Identity';
import { ENVIRONMENTS } from '@/components/clubhq/environments';
import { MeterBar } from '@/components/experience/primitives';
import { boardPressureStage, BOARD_PRESSURE_LABEL, boardOf, ensureBoard, evaluateObjectives } from '@/lib/board/board';
import { currentTeamRoles } from '@/lib/career/teamRoles';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { buildFrontPage, type FrontPageEar } from '@/lib/career/frontPage';

export default function HomePage() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const [transitionBlockers, setTransitionBlockers] = useState<readonly Dependency[]>([]);
  function startNextSeason() {
    const result = attemptSeasonTransition(career);
    setTransitionBlockers(result.blockers);
    if (result.status === 'APPLIED') updateCareer((current) => current === career ? result.state : current);
  }
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const attention = useMemo(() => managementAttention(career), [career]);
  const table = useMemo(() => getLiveStandings(career), [career]);
  const ownRow = table.find(r => r.clubId === club.id);
  const next = getNextPlayerFixture(career);
  const competition = COMPETITIONS.find(c => c.id === career.competitionId);
  const economy = getClubEconomySnapshot(career, club.id);
  const recent = career.fixtures.filter(f => career.results[f.id]).sort((a,b) => b.date.localeCompare(a.date));
  const ownRecent = recent.filter(f => f.homeClubId === club.id || f.awayClubId === club.id).slice(0,3);
  const previousSeason = career.seasonHistory?.at(-1);
  const nextYear = Number(career.seasonId.slice(0, 4)) + 1;
  const nextSeasonId = `${nextYear}/${String(nextYear + 1).slice(-2)}`;
  const boardView = useMemo(() => (boardOf(career) ? career : ensureBoard(career, career.gameDate)), [career]);
  const board = boardView.board!;
  const boardObjectives = useMemo(() => evaluateObjectives(boardView, boardView.board!), [boardView]);
  const issues = [...attention.unavailable.map(p => ({p,detail:resolveStatusLabel(career.playerStatuses,p)})), ...attention.tired.filter(p=>!attention.unavailable.some(x=>x.id===p.id)).map(p=>({p,detail:`${Math.round(squadEnergy(career,p))}% energi`}))];
  const identity = resolveClubIdentity(club.id, club.shortName, club.primaryColor);
  const roles = currentTeamRoles(career);
  const captain = roles.captainId ? squad.find(p => p.id === roles.captainId) : undefined;
  const avgMatchFitness = squad.length ? Math.round(squad.reduce((s, p) => s + matchFitnessOf(career, p.id), 0) / squad.length) : 0;
  // DSH-01 (Arena adaptation "Matchweek Front Page"): masthead + ears, lead story, numbered decisions, ladder ±2, briefs.
  const front = useMemo(() => buildFrontPage(boardView), [boardView]);

  return <div className="game-home hm-front" style={clubColorVars(club)}>
    <header className="hm-front-masthead" aria-label="Matchveckan">
      <FrontEar ear={front.ears[0]} />
      <div className="hm-front-nameplate">
        <ClubCrest clubId={club.id} shortName={club.shortName} primaryColor={club.primaryColor} size={56} />
        <div>
          <div className="game-overline">{front.masthead.title} · vecka {front.masthead.week} · {career.seasonId}</div>
          <h1>{club.name}</h1>
          <p>{competition?.name}{identity.heritageTag ? ` · ${identity.heritageTag}` : ''}</p>
        </div>
        <nav className="hm-front-rooms" aria-label="Klubbens rum"><Link href="/career/klubbhuset">Klubbhuset →</Link><Link href="/career/tactics">Taktikrummet →</Link></nav>
      </div>
      <FrontEar ear={front.ears[1]} />
    </header>
    <section className="hm-front-top" aria-label="Förstasidan">
      <article className="hm-front-lead xp-photo-hero" data-kind={front.lead.kind} style={ENVIRONMENTS["manager-office"].backdropStyle}>
        <div className="hm-front-lead-copy">
          <span className="hm-front-kicker">{front.lead.kicker}</span>
          <h2>{front.lead.headline}</h2>
          <p>{front.lead.standfirst}</p>
          <Link className="hm-btn hm-btn-primary" href={front.lead.href}>{front.lead.cta} →</Link>
        </div>
      </article>
      <aside className="hm-front-decisions" aria-labelledby="hm-front-decisions-h">
        <h2 id="hm-front-decisions-h">Att avgöra</h2>
        {front.decisions.length ? <ol>{front.decisions.map(d => <li key={d.n} data-urgent={d.urgent}><span className="hm-front-num" aria-hidden="true">{d.n}</span><div><strong>{d.title}</strong><p>{money.text(d.detail)}</p></div><Link className="hm-btn hm-btn-sm" href={d.href}>{d.cta} →</Link></li>)}</ol> : <p className="hm-front-clear">Inga beslut väntar. Fortsätt när du är redo.</p>}
      </aside>
    </section>
    {career.managerCareer?.seekingJob && <div className="game-new-season-note"><strong>Du står utan klubb.</strong> Kalendern fortsätter och klubbar med lediga tjänster hör av sig. Sök jobb själv eller tryck Fortsätt.<Link href="/career/manager?tab=jobs">Jobbmarknaden →</Link></div>}
    {previousSeason && !career.seasonComplete && !ownRow?.played && <div className="game-new-season-note"><strong>Säsong {career.seasonId} tar vid.</strong> Matcher och spelarstatistik från {previousSeason.seasonId} finns kvar.<Link href={`/career/history?season=${encodeURIComponent(previousSeason.seasonId)}`}>Se föregående säsong →</Link></div>}
    {career.seasonComplete && transitionBlockers.length > 0 && <div role="alert" className="game-new-season-note"><strong>Säsongsbytet är blockerat. Karriären är bevarad.</strong><ul>{transitionBlockers.map((b, i) => <li key={`${b.code}:${b.ref}:${i}`}>{b.message} ({b.ref})</li>)}</ul></div>}
    {career.seasonComplete ? <><ClubHero clubId={club.id} career={career}/><section className="game-season-milestone"><div><span className="game-overline">{competition?.name} · {career.seasonId} avslutad</span><h2>Säsongen är i mål.</h2><p>{attention.contracts.length} spelare har avtal att ta ställning till. Nästa ligasäsong blir {nextSeasonId}. Sluttabellen, spelarstatistiken och matcharkiven bevaras när du går vidare.</p><div className="hm-actions"><button className="hm-btn hm-btn-primary" onClick={startNextSeason}>Börja nästa säsong →</button><Link className="hm-btn" href="/career/contracts">Se över avtalen →</Link><Link className="hm-btn" href={`/career/competitions/${career.competitionId}`}>Sluttabellen →</Link></div></div><div className="game-milestone-facts"><div><strong>{ownRow ? table.indexOf(ownRow)+1 : '—'}</strong><span>Slutplacering</span></div><div><strong>{ownRow?.points ?? '—'}</strong><span>Poäng</span></div><div><strong>{ownRow?.goalsFor ?? '—'}</strong><span>Gjorda mål</span></div></div></section></> : <div className="game-home-event">{next ? <MatchHero career={career} fixture={next}><Link className="hm-btn" href={`/career/clubs/${next.homeClubId===club.id ? next.awayClubId : next.homeClubId}`}>Motståndaren →</Link><Link className="hm-btn" href="/career/tactics">Taktiktavla →</Link><Link className="hm-btn hm-btn-primary" href="/career/match-preview">Förbered match →</Link></MatchHero> : <EmptyState>Inget kommande avkast.</EmptyState>}<aside className="game-season-card"><div><div className="game-overline">{competition?.name} · {ownRow?.played ? 'LIGALÄGET' : 'FÖRE SERIESTART'}</div><RankIndicator position={ownRow?.played ? table.indexOf(ownRow)+1 : '—'} label={`/ ${table.length}`}/><h2>{club.shortName} i ligan</h2></div><div className="game-season-record"><div><strong>{ownRow?.points ?? 0}</strong><small>POÄNG</small></div><div><strong>{ownRow?.played ?? 0}</strong><small>MATCHER</small></div><div><strong>{ownRow?.goalDifference ?? 0}</strong><small>MÅLSKILLNAD</small></div></div><div><span className="game-overline">Senaste fem</span><div><FormDots results={career.clubForm[club.id] ?? []}/>{!(career.clubForm[club.id]?.length) && <small>Inga spelade matcher ännu</small>}</div></div><Link href={`/career/competitions/${career.competitionId}`}>Ligan, resultaten och rivalerna →</Link></aside></div>}
    {!career.seasonComplete && front.ladder.length > 0 && <section className="hm-front-ladder" aria-label="Tabelläget ±2"><div className="game-section-heading"><h2>Tabelläget</h2><Link href={`/career/competitions/${career.competitionId}`}>Hela tabellen →</Link></div><ol>{front.ladder.map(r => <li key={r.clubId} data-own={r.own}><span className="hm-front-pos">{r.position}</span><ClubLink clubId={r.clubId}>{r.name}</ClubLink><span>{r.played} m</span><span>{r.goalDifference > 0 ? '+' : ''}{r.goalDifference}</span><strong>{r.points} p</strong></li>)}</ol></section>}
    <div className="hm-front-briefs">
      <section aria-labelledby="hm-front-league-h"><div className="game-section-heading"><h2 id="hm-front-league-h">Runt ligan</h2><Link href={`/career/competitions/${career.competitionId}?tab=results`}>Resultaten →</Link></div>{front.leagueBriefs.length ? <ul>{front.leagueBriefs.map(b => <li key={b.id}><Link href={b.href}><strong>{b.text}</strong><small>{b.detail}</small></Link></li>)}</ul> : <EmptyState>Inga ligaresultat ännu.</EmptyState>}</section>
      <section aria-labelledby="hm-front-club-h"><div className="game-section-heading"><h2 id="hm-front-club-h">Från klubben</h2><Link href="/career/inbox">Inkorgen →</Link></div>{front.clubBriefs.length ? <ul>{front.clubBriefs.map(b => <li key={b.id}><Link href={b.href}><strong>{money.text(b.text)}</strong><small>{money.text(b.detail)}</small></Link></li>)}</ul> : <EmptyState>Inga meddelanden.</EmptyState>}</section>
    </div>
    <div className="game-home-body"><div className="game-home-column">
      <section>
        <div className="game-section-heading"><h2>Laget inför avkast</h2><Link href="/career/squad">Hela truppen →</Link></div>
        <div className="game-availability-line">
          <strong>{squad.length-attention.unavailable.length}<span>/{squad.length}</span></strong>
          <span>spelare tillgängliga · matchträning {avgMatchFitness}%<br /><small>{attention.tired.length} behöver mer återhämtning{captain ? ` · Kapten: ${captain.lastName}` : ''}</small></span>
          <Link className="hm-btn" href="/career/tactics">Välj startsju →</Link>
        </div>
        {issues.slice(0,3).map(({p,detail})=><div className="game-week-line" key={p.id}><PlayerCell player={p}/><span>{detail}</span></div>)}
      </section>
      <section><div className="game-section-heading"><h2>Utanför planen</h2><Link href="/career/contracts">Besluten →</Link></div><div className="game-decision"><strong>{attention.contracts.length}</strong><div><h3>Avtal närmar sig slutet</h3><p>Vilka blir kvar i laget? Jämför spelarna, förläng eller leta efter nästa lösning.</p><div className="hm-actions"><Link href="/career/contracts">Planera kontrakten →</Link><Link href="/career/players">Upptäck spelare →</Link></div></div></div>{attention.contracts.slice(0,2).map(r=><div className="game-week-line" key={r.player.id}><PlayerLink playerId={r.player.id}>{r.player.firstName} {r.player.lastName}</PlayerLink><span>{r.player.position} · {r.contract?.contractEndDate}</span></div>)}<div className="game-decision"><strong>{attention.shortlist.length}</strong><div><h3>Spelare på din radar</h3><p>{attention.reports.length} scoutingrapporter tillgängliga. Budget för övergångar: {economy ? formatMoney(economy.budgets.transferBudgetEur) : '—'}.</p><Link href="/career/recruitment?view=SHORTLIST">Din kortlista →</Link></div></div></section>
      <section><div className="game-section-heading"><h2>Senaste avtrycket</h2><Link href="/career/schedule">Matcharkivet →</Link></div>{ownRecent.length ? ownRecent.map(f=>{const result=career.results[f.id];return <Link className="game-recent-score" href={matchReportHref(f.id)} key={f.id}><span>{getClub(f.homeClubId)?.shortName}<br />{getClub(f.awayClubId)?.shortName}<small> · {f.date}</small></span><strong>{result.homeGoals}–{result.awayGoals}</strong></Link>;}) : <EmptyState>Säsongens första avkast väntar. Här följer dina resultat och matchrapporter.</EmptyState>}</section>
    </div><div className="game-home-column">
      <WeeklyManagerOverview career={career}/>
    </div><div className="game-home-column">
      <section className="game-board-card"><div className="game-section-heading"><h2>Styrelsen</h2><Link href="/career/board">Styrelserummet →</Link></div><MeterBar label="Förtroende" value={board.confidence/100} figure={`${board.confidence} / 100`} tone={board.confidence>=60?'success':board.confidence>=35?'gold':'loss'}/><p>{BOARD_PRESSURE_LABEL[boardPressureStage(board)]} · {board.factors.slice(0,2).map(f=>f.label).join(" · ") || "Styrelsen bedömer utvecklingen månadsvis."}</p><ul>{boardObjectives.slice(0,3).map(o=><li key={o.id}><span>{o.label}</span><span className="tc-pill" data-status={o.status}>{o.status==='ON_TRACK'?'I fas':o.status==='AT_RISK'?'I fara':o.status==='MET'?'Uppfyllt':o.status==='PARTLY_MET'?'Delvis':'Missat'}</span></li>)}</ul></section>
      <section className="game-training-note"><div className="game-overline">NÄSTA LAGINSATS</div><h3>Bygg veckan runt matchen.</h3><p>Träning, återhämtning och spelarbelastning följer kalendern. Förbered laget för nästa avkast.</p><Link className="hm-btn" href="/career/training">Träningsveckan →</Link></section>
    </div></div>
  </div>;
}

function FrontEar({ ear }: { ear: FrontPageEar }) {
  // Only the board's confidence carries a warning scale; reputation is a standing, shown in club neon.
  const tone = ear.href !== '/career/board' ? 'club' : ear.value >= 60 ? 'pos' : ear.value >= 35 ? 'warn' : 'neg';
  return <Link className="hm-front-ear" href={ear.href} data-tone={tone} aria-label={`${ear.label} (${ear.caption}): ${ear.value} av 100${ear.delta ? `, ${ear.delta > 0 ? 'upp' : 'ned'} ${Math.abs(ear.delta)}` : ''}. ${ear.reason}`}>
    <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" className="hm-front-ring-bg" /><circle cx="22" cy="22" r="18" className="hm-front-ring" style={{ strokeDasharray: `${(ear.value / 100) * 113.1} 113.1` }} /></svg>
    <span className="hm-front-ear-copy"><span className="hm-front-ear-label">{ear.label} <small>· {ear.caption}</small></span><strong>{ear.value}{ear.delta ? <em data-dir={ear.delta > 0 ? 'up' : 'down'}>{ear.delta > 0 ? '▲' : '▼'}{Math.abs(ear.delta)}</em> : null}</strong><small>{ear.reason}</small></span>
  </Link>;
}
