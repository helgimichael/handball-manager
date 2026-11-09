'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import type { CareerState } from '@/lib/career/types';
import { weeklyManagement } from '@/lib/career/weeklyManagement';
import { formatGameDate } from '@/lib/career/dateUtils';
import { getClub } from '@/lib/game-data';
import { DAY_TYPE_LABEL, SESSION_TYPE_LABEL } from '@/lib/training/labels';
import { BOARD_PRESSURE_LABEL, boardPressureStage } from '@/lib/board/board';
import { useMoney } from '@/lib/settings/usePreferences';

/** The existing office's weekly section, using the same actions and Continue selector. */
export function WeeklyManagerOverview({career}:{career:CareerState}) {
  const week=useMemo(()=>weeklyManagement(career),[career]);
  const money=useMoney();
  return <section aria-labelledby="weekly-manager-heading" id="weekly-manager">
    <div className="game-section-heading"><h2 id="weekly-manager-heading">Veckans managerplan</h2><Link href="/career/calendar">Kalender →</Link></div>
    <p>{formatGameDate(week.from)} – {formatGameDate(week.through)}</p>
    <div className="game-training-note" role="status"><strong>Nästa steg: {week.action.label}</strong><p>{week.progression}</p>
      {week.action.targetHref ? <Link className="hm-btn" href={week.action.targetHref}>Öppna nästa steg →</Link> : <small>Använd knappen överst för att fortsätta.</small>}
    </div>
    {career.managerCareer?.seekingJob ? <p>Veckoplaneringen återupptas när du har en ny klubb.</p> : <>
      {career.seasonComplete ? <p>Säsongen är avslutad. Gå igenom kvarvarande beslut innan nästa säsong.</p> : <>
        <div className="hm-actions"><Link href="/career/training">Justera träningsprioriteringar →</Link><Link href="/career/tactics">Förbered nästa match →</Link></div>
        {week.days.map(day=><div key={day.date}>
          <Link className="game-week-line" href={`/career/training?week=${encodeURIComponent(day.weekStart)}`}>
            <time dateTime={day.date}>{formatGameDate(day.date)}</time><strong>{day.training.dayType==='MATCH'&&!day.fixtures.length?'Ingen match planerad':DAY_TYPE_LABEL[day.training.dayType]}</strong>
          </Link>
          {day.training.sessions.length>0&&<small>{day.training.executed?'Genomfört':'Planerat'}: {day.training.sessions.map(s=>SESSION_TYPE_LABEL[s.type]).join(' · ')}{day.training.sessions.some(s=>s.intensity==='HIGH'||s.intensity==='VERY_HIGH')?' · Hög belastning':''}</small>}
          {day.fixtures.map(({fixture:f,played,ready,lineupIssues})=><p key={f.id}>
            <Link href={played?`/career/match-report/${encodeURIComponent(f.id)}`:'/career/schedule'}>{getClub(f.homeClubId)?.shortName??f.homeClubId} – {getClub(f.awayClubId)?.shortName??f.awayClubId}</Link><br/>
            <small>{played?'Matchen är spelad.':lineupIssues[0]??'Kontrollera laguttagning och tillgänglighet inför avkast.'} {!played&&!ready?'Matchen öppnas när kalendern har bearbetat matchdagen.':''}</small>
          </p>)}
        </div>)}
        <p>{week.available}/{week.total} spelare tillgängliga · {week.tired} med mindre än 75 % energi. <Link href="/career/squad">Se truppen →</Link></p>
      </>}
      <h3>Beslut och tidsfrister</h3>
      <p>{week.discussions} öppna spelarsamtal. <Link href="/career/inbox">Inkorgen →</Link></p>
      {week.decisions.length?<ul>{week.decisions.map(d=><li key={d.id}><Link href={d.href}>{d.title}</Link>{d.required&&<strong> – Beslut krävs</strong>}<p>{d.detail}</p></li>)}</ul>:<p>Inga öppna beslut eller tidsfrister de närmaste sju dagarna.</p>}
      <p>Styrelsen: {week.board.confidence}/100 · {BOARD_PRESSURE_LABEL[boardPressureStage(week.board)]}. <Link href="/career/board">Mål och granskning →</Link></p>
      <ul>{week.board.objectives.filter(o=>o.kind==='LEAGUE'||o.kind==='FINANCE').map(o=><li key={o.id}>{o.label}{o.progress?`: ${o.progress}`:''}</li>)}</ul>
      {week.recoveryPlan&&<p>Aktiv handlingsplan från {week.recoveryPlan.agreedOn}. Bedöms tidigast vid månadsgranskningen {week.reviewDate}. <Link href="/career/board">Följ planen →</Link></p>}
      {week.economy?<p>Klubbkassa {money.format(week.economy.cashEur)} · {week.economy.budgets.wageOverBudget?'Löner över budget':'Löner inom budget'}. <Link href="/career/finance">Granska ekonomin →</Link></p>:<p>Ekonomiuppgifter saknas. <Link href="/career/finance">Ekonomin →</Link></p>}
    </>}
    {week.feedback.length>0&&<><h3>Senaste återkopplingen</h3>{week.feedback.map(e=><article key={e.id} className="game-news-line"><Link href={`/career/inbox?message=${encodeURIComponent(career.inbox.find(m=>m.careerEventId===e.id)?.id??`msg:${e.id}`)}`}><small>{e.date}</small><strong>{e.subject}</strong><p>{e.summary}</p></Link></article>)}</>}
  </section>;
}
