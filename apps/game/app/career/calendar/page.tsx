'use client';
import CalendarMilestones from '@/components/manager/CalendarMilestones';
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { addDays, formatGameDate } from '@/lib/career/dateUtils';
import { mondayOf, resolveTrainingWeek } from '@/lib/training/trainingSchedule';
import { contractRows } from '@/lib/career/management';
import { PageHeading, Panel, FixtureTable } from '@/components/manager/Workspace';
import { PlayerLink } from '@/components/entityLinks';
import { MatchHero } from '@/components/game/Identity';
import { getClub } from '@/lib/game-data';
const DAY_LABEL: Record<string,string> = { TRAINING:'Träning', RECOVERY:'Återhämtning', REST:'Vila', MATCH:'Match', TRAVEL:'Resa' };
export default function CalendarPage() {
  const { career } = useCareer();
  const [weekStart, setWeekStart] = useState(mondayOf(career.gameDate));
  const weeks = [0,7,14,21].map(offset => resolveTrainingWeek(career, addDays(weekStart,offset)));
  const contracts = contractRows(career);
  const clubFixtures = career.fixtures.filter(f => f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId);
  const nextMatch = clubFixtures.filter(f => !career.results[f.id] && f.date >= career.gameDate).sort((a, b) => a.date.localeCompare(b.date))[0];
  const visibleMatches = clubFixtures.filter(f => f.date >= weekStart && f.date <= addDays(weekStart, 27));
  return <div className="hm-calendar-screen">
    <PageHeading eyebrow={`${career.seasonId} / säsongens rytm`} title="Kalender" description="Matcherna sätter rytmen. Planera träning, återhämtning och truppbeslut runt dem." actions={<><button className="hm-btn" onClick={() => setWeekStart(addDays(weekStart,-28))}>← Fyra veckor</button><button className="hm-btn" onClick={() => setWeekStart(mondayOf(career.gameDate))}>Idag</button><button className="hm-btn" onClick={() => setWeekStart(addDays(weekStart,28))}>Fyra veckor →</button></>} />
    <div className="hm-week-context"><div><span className="hm-eyebrow">Din fyraveckorsperiod</span><h2>{formatGameDate(weekStart).split(' ').slice(1, 3).join(' ')} — {formatGameDate(addDays(weekStart, 27)).split(' ').slice(1, 3).join(' ')}</h2><p>{visibleMatches.length} matcher · {weeks.reduce((sum, week) => sum + week.days.reduce((sessions, day) => sessions + day.sessions.length, 0), 0)} träningspass</p><Link className="hm-btn hm-btn-sm" href="/career/training">Planera träningsveckan →</Link></div>{nextMatch && <MatchHero career={career} fixture={nextMatch} context="Nästa match" compact />}</div>
    <div className="hm-stack">{weeks.map(week => <Panel key={week.weekStart} title={`Veckan från ${week.weekStart}`} actions={<Link href={`/career/training?week=${encodeURIComponent(week.weekStart)}`}>Hantera träning →</Link>}>
      <div className="hm-calendar-week">{week.days.map(day => {
        const matches = clubFixtures.filter(f => f.date === day.date);
        const expiring = contracts.filter(r => r.contract?.contractEndDate === day.date);
        const scouting = Object.values(career.scoutingAssignments).filter(a => a.status === 'IN_PROGRESS' && a.endDate === day.date);
        return <section className="hm-calendar-day" key={day.date} data-today={day.date === career.gameDate} data-matchday={matches.length > 0} data-recovery={day.dayType === 'RECOVERY' || day.dayType === 'REST'}>
          <div className="hm-calendar-date"><span>{formatGameDate(day.date).split(' ')[0]}</span><strong>{Number(day.date.slice(8, 10))}</strong><small>{formatGameDate(day.date).split(' ')[2]}</small></div>
          <span className={`hm-badge hm-badge-${matches.length ? 'warning' : 'neutral'}`}>{DAY_LABEL[day.dayType]}</span>
          {day.date === career.gameDate && <span className="hm-calendar-today">Idag</span>}
          <p>{day.sessions.length ? `${day.sessions.length} pass · ${day.executed ? 'utförda' : 'planerade'}` : day.dayType === 'REST' ? 'Återhämtning utan pass' : 'Inga träningspass'}</p>
          {matches.map(f => {
            const opponentId = f.homeClubId === career.playerClubId ? f.awayClubId : f.homeClubId;
            const result = career.results[f.id];
            return <Link className="hm-calendar-event hm-calendar-match" key={f.id} href={result ? `/career/match-report/${encodeURIComponent(f.id)}` : `/career/fixtures/${encodeURIComponent(f.id)}`}><span>{f.homeClubId === career.playerClubId ? 'Hemma' : 'Borta'} · {f.type === 'LEAGUE' ? `omg ${f.round}` : f.type === 'CUP' ? 'Cup' : 'Träningsmatch'}</span><strong>{getClub(opponentId)?.shortName ?? opponentId}</strong><b>{result ? `${result.homeGoals}–${result.awayGoals} · Matchrapport →` : 'Matchförberedelse →'}</b></Link>;
          })}
          {expiring.map(r => <div className="hm-calendar-deadline" key={r.player.id}><span>Avtal löper ut</span><PlayerLink playerId={r.player.id}>{r.player.firstName} {r.player.lastName}</PlayerLink></div>)}
          {scouting.map(a => <Link className="hm-calendar-discovery" key={a.id} href="/career/scouting">Scouting beräknas klar →</Link>)}
          <CalendarMilestones date={day.date} />{day.date === career.leagueKickoffDate && <strong>Ligastart</strong>}
        </section>;
      })}</div>
      <FixtureTable career={career} fixtures={clubFixtures.filter(f => f.date >= week.weekStart && f.date <= addDays(week.weekStart,6))} />
    </Panel>)}</div>
  </div>;
}
