'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub, getCareerSquad } from '@/lib/career/careerWorld';
import { getLiveStandings } from '@/lib/career/standings';
import { managementAttention } from '@/lib/career/management';
import { attemptSeasonTransition } from '@/lib/career/seasonRollover';
import type { Dependency } from '@/lib/competition/transition/types';
import { COMPETITIONS } from '@/lib/game-data';
import { getClubEconomySnapshot } from '@/lib/economy/clubEconomyIntegration';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { categoryLabel } from '@/lib/career/inboxBridge';
import { WeeklyManagerOverview } from '@/components/game/WeeklyManagerOverview';
import { PlayerLink } from '@/components/entityLinks';
import ClubCrest from '@/components/ClubCrest';
import { resolveClubIdentity } from '@/components/crests/clubIdentity';
import { EmptyState } from '@/components/manager/Workspace';
import { clubColorVars, ClubHero } from '@/components/game/Identity';
import { ENVIRONMENTS } from '@/components/clubhq/environments';
import { MeterBar } from '@/components/experience/primitives';
import { boardPressureStage, BOARD_PRESSURE_LABEL, boardOf, ensureBoard, evaluateObjectives } from '@/lib/board/board';
import { currentTeamRoles } from '@/lib/career/teamRoles';
import { buildFrontPage, buildMatchBox, buildSeasonCurtain, courtCoverage, describeTransitionBlocker, type BriefPriority, type FrontPageEar } from '@/lib/career/frontPage';
import { MatchBox } from '@/components/front/MatchBox';
import { CourtCoverage } from '@/components/front/CourtCoverage';
import { SeasonCurtain, useSeasonCurtain } from '@/components/front/SeasonCurtain';
import { UnemployedFront } from '@/components/front/UnemployedFront';
import { activeClubId } from '@/lib/manager/employment';

const PRIORITY_LABEL: Record<BriefPriority, string> = { ACTION: 'Kräver åtgärd', IMPORTANT: 'Viktigt', UNREAD: 'Oläst', READ: 'Läst' };

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
  const competition = COMPETITIONS.find(c => c.id === career.competitionId);
  const economy = getClubEconomySnapshot(career, club.id);
  const previousSeason = career.seasonHistory?.at(-1);
  const nextYear = Number(career.seasonId.slice(0, 4)) + 1;
  const nextSeasonId = `${nextYear}/${String(nextYear + 1).slice(-2)}`;
  const boardView = useMemo(() => (boardOf(career) ? career : ensureBoard(career, career.gameDate)), [career]);
  const board = boardView.board!;
  const boardObjectives = useMemo(() => evaluateObjectives(boardView, boardView.board!), [boardView]);
  const identity = resolveClubIdentity(club.id, club.shortName, club.primaryColor);
  const roles = currentTeamRoles(career);
  const captain = roles.captainId ? squad.find(p => p.id === roles.captainId) : undefined;
  // DSH-01 (Arena adaptation "Matchweek Front Page"): masthead + ears, lead story, numbered decisions, match box, briefs.
  const front = useMemo(() => buildFrontPage(boardView), [boardView]);
  // DSH-01b/g match box with form strip; DSH-01e court coverage.
  const box = useMemo(() => buildMatchBox(career), [career]);
  const spots = useMemo(() => courtCoverage(career), [career]);
  // DSH-01c season curtain + hand-off checklist, from the season-complete state and the transition's own blockers.
  const curtainData = useMemo(() => (career.seasonComplete ? buildSeasonCurtain(boardView, evaluateObjectives(boardView, boardView.board!, true)) : null), [career.seasonComplete, boardView]);
  const curtain = useSeasonCurtain(`hm-season-curtain:${career.saveSeed}:${club.id}:${career.seasonId}`, !!curtainData);
  const blockers = useMemo(() => {
    const all = [...transitionBlockers, ...(career.seasonComplete ? career.seasonOutcome?.qualificationBlockers ?? [] : [])];
    return [...new Map(all.map(b => [`${b.code}:${b.ref}`, b])).values()];
  }, [transitionBlockers, career.seasonComplete, career.seasonOutcome]);
  const matchday = front.lead.kind === 'MATCHDAY';
  const competitionHref = `/career/competitions/${encodeURIComponent(career.competitionId)}`;
  const matchBox = !career.seasonComplete && <MatchBox box={box} ladder={front.ladder} clubId={club.id} competitionHref={competitionHref} />;

  // Employment states: without a club Idag is the career's own front page -- no former crest, squad, board or shortcuts.
  if (!activeClubId(career)) {
    const handoff = career.seasonComplete ? <section className="game-season-milestone hm-handoff-card" aria-labelledby="hm-handoff-h">
      <div>
        <span className="game-overline">{career.seasonId} avslutad</span>
        <h2 id="hm-handoff-h">Säsongen är i mål.</h2>
        <p>Nästa säsong blir {nextSeasonId}. Jobbmarknaden fortsätter när den nya säsongen börjar.</p>
        <button type="button" className="hm-btn hm-btn-primary hm-btn-sm" onClick={startNextSeason}>Börja nästa säsong →</button>
        {blockers.length > 0 && <div role="alert" className="hm-handoff-blockers"><strong>Det här hindrar säsongsbytet</strong><ul>{blockers.map((b, i) => { const copy = describeTransitionBlocker(b); return <li key={`${b.code}:${b.ref}:${i}`}><b>{copy.title}</b><span>{copy.detail}</span></li>; })}</ul></div>}
      </div>
    </section> : null;
    return <UnemployedFront career={career} front={front} week={front.masthead.week} reputationEar={<FrontEar ear={front.ears[1]} />} seasonHandoff={handoff} />;
  }

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
        <nav className="hm-front-rooms" aria-label="Klubbens rum"><Link href="/career/club">Klubbhuset →</Link><Link href="/career/tactics">Taktikrummet →</Link></nav>
      </div>
      <FrontEar ear={front.ears[1]} />
    </header>
    {matchday && matchBox}
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
    {career.seasonComplete ? <>
      <ClubHero clubId={club.id} career={career} />
      <section className="game-season-milestone hm-handoff-card" aria-labelledby="hm-handoff-h">
        <div>
          <span className="game-overline">{competition?.name} · {career.seasonId} avslutad</span>
          <h2 id="hm-handoff-h">Säsongen är i mål.</h2>
          <p>Nästa ligasäsong blir {nextSeasonId}. Sluttabellen, spelarstatistiken och matcharkiven bevaras när du går vidare.</p>
          <ol className="hm-handoff">
            <li data-done={attention.contracts.length === 0 || undefined}><span className="hm-handoff-n" aria-hidden="true">1</span><div><strong>Se över avtalen</strong><small>{attention.contracts.length ? `${attention.contracts.length} spelare har avtal att ta ställning till.` : 'Inga avtal kräver beslut just nu.'}</small></div><Link className="hm-btn hm-btn-sm" href="/career/contracts">Se över avtalen →</Link></li>
            <li><span className="hm-handoff-n" aria-hidden="true">2</span><div><strong>Granska sluttabellen</strong><small>{ownRow ? `${table.indexOf(ownRow) + 1}:a med ${ownRow.points} poäng.` : 'Din klubb finns inte i tabellen.'}</small></div><Link className="hm-btn hm-btn-sm" href={competitionHref}>Sluttabellen →</Link></li>
            <li data-blocked={blockers.length > 0 || undefined}><span className="hm-handoff-n" aria-hidden="true">3</span><div><strong>Börja säsong {nextSeasonId}</strong><small>{blockers.length ? 'Säsongsbytet väntar på punkterna nedan. Karriären är bevarad.' : 'Seriernas nya sammansättning tillämpas när du startar.'}</small></div><button type="button" className="hm-btn hm-btn-primary hm-btn-sm" onClick={startNextSeason}>Börja nästa säsong →</button></li>
          </ol>
          {blockers.length > 0 && <div role="alert" className="hm-handoff-blockers"><strong>Det här hindrar säsongsbytet</strong><ul>{blockers.map((b, i) => { const copy = describeTransitionBlocker(b); return <li key={`${b.code}:${b.ref}:${i}`}><b>{copy.title}</b><span>{copy.detail}</span><details><summary>Teknisk detalj</summary><code>{b.code}</code> {b.message}</details></li>; })}</ul></div>}
          <button type="button" className="hm-btn hm-btn-ghost hm-btn-sm" onClick={curtain.replay}>Visa säsongen igen</button>
        </div>
        <div className="game-milestone-facts"><div><strong>{ownRow ? table.indexOf(ownRow) + 1 : '—'}</strong><span>Slutplacering</span></div><div><strong>{ownRow?.points ?? '—'}</strong><span>Poäng</span></div><div><strong>{ownRow?.goalsFor ?? '—'}</strong><span>Gjorda mål</span></div></div>
      </section>
      {curtain.open && curtainData && <SeasonCurtain curtain={curtainData} onClose={curtain.close} />}
    </> : !matchday && matchBox}
    <div className="hm-front-briefs">
      <section aria-labelledby="hm-front-league-h"><div className="game-section-heading"><h2 id="hm-front-league-h">Runt ligan</h2><Link href={`${competitionHref}?tab=results`}>Resultaten →</Link></div>{front.leagueBriefs.length ? <ul>{front.leagueBriefs.map(b => <li key={b.id}><Link href={b.href}><strong>{b.text}</strong><small>{b.detail}</small></Link></li>)}</ul> : <EmptyState>Inga ligaresultat ännu.</EmptyState>}</section>
      <section aria-labelledby="hm-front-club-h"><div className="game-section-heading"><h2 id="hm-front-club-h">Från klubben</h2><Link href="/career/inbox">Inkorgen{front.inboxUnread ? ` (${front.inboxUnread})` : ''} →</Link></div>{front.clubBriefs.length ? <ul className="hm-front-ranked">{front.clubBriefs.map(b => <li key={b.id} data-priority={b.priority}><Link href={b.href}><span className="hm-brief-emblem" data-category={b.category} aria-hidden="true">{b.category ? categoryLabel(b.category).slice(0, 2) : '·'}</span><span className="hm-brief-copy"><span className="hm-brief-meta">{b.priority && b.priority !== 'READ' && <em>{PRIORITY_LABEL[b.priority]}</em>}{b.sender}{b.category ? ` · ${categoryLabel(b.category)}` : ''}{b.date ? ` · ${b.date}` : ''}</span><strong>{money.text(b.text)}</strong><small>{money.text(b.detail)}</small></span></Link></li>)}</ul> : <EmptyState>Inga meddelanden. Nyheter från staben och styrelsen hamnar här. <Link href="/career/inbox">Inkorgen →</Link></EmptyState>}</section>
    </div>
    <div className="game-home-body"><div className="game-home-column">
      <CourtCoverage spots={spots} captain={captain?.lastName} />
      <section><div className="game-section-heading"><h2>Utanför planen</h2><Link href="/career/contracts">Besluten →</Link></div><div className="game-decision"><strong>{attention.contracts.length}</strong><div><h3>Avtal närmar sig slutet</h3><p>Vilka blir kvar i laget? Jämför spelarna, förläng eller leta efter nästa lösning.</p><div className="hm-actions"><Link href="/career/contracts">Planera kontrakten →</Link><Link href="/career/players">Upptäck spelare →</Link></div></div></div>{attention.contracts.slice(0,2).map(r=><div className="game-week-line" key={r.player.id}><PlayerLink playerId={r.player.id}>{r.player.firstName} {r.player.lastName}</PlayerLink><span>{r.player.position} · {r.contract?.contractEndDate}</span></div>)}<div className="game-decision"><strong>{attention.shortlist.length}</strong><div><h3>Spelare på din radar</h3><p>{attention.reports.length} scoutingrapporter tillgängliga. Budget för övergångar: {economy ? formatMoney(economy.budgets.transferBudgetEur) : '—'}.</p><Link href="/career/recruitment?view=SHORTLIST">Din kortlista →</Link></div></div></section>
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
