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
const DAY_LABEL: Record<string,string> = { TRAINING:'Träning', RECOVERY:'Återhämtning', REST:'Vila', MATCH:'Match', TRAVEL:'Resa' };
export default function CalendarPage() {
  const { career } = useCareer();
  const [weekStart, setWeekStart] = useState(mondayOf(career.gameDate));
  const weeks = [0,7,14,21].map(offset => resolveTrainingWeek(career, addDays(weekStart,offset)));
  const contracts = contractRows(career);
  return <><PageHeading eyebrow={`${career.seasonId} / klubbalmanacka`} title="Kalender" description="Fyra veckors matcher, träningsrytm och beslutspunkter. Träningsschemat ändras i Träning." actions={<><button className="hm-btn" onClick={() => setWeekStart(addDays(weekStart,-28))}>← Fyra veckor</button><button className="hm-btn" onClick={() => setWeekStart(mondayOf(career.gameDate))}>Idag</button><button className="hm-btn" onClick={() => setWeekStart(addDays(weekStart,28))}>Fyra veckor →</button></>} />
    <div className="hm-stack">{weeks.map(week => <Panel key={week.weekStart} title={`Veckan från ${week.weekStart}`} actions={<Link href="/career/training">Hantera träning →</Link>}><div className="hm-calendar-week">{week.days.map(day => { const matches = career.fixtures.filter(f => f.date === day.date && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId)); const expiring = contracts.filter(r => r.contract?.contractEndDate === day.date); return <section className="hm-calendar-day" key={day.date} data-today={day.date === career.gameDate}><h3>{formatGameDate(day.date).split(' ').slice(0,3).join(' ')}</h3><span className="hm-badge hm-badge-neutral">{DAY_LABEL[day.dayType]}</span><p>{day.sessions.length ? `${day.sessions.length} pass · ${day.executed ? 'utförda' : 'planerade'}` : day.dayType === 'REST' ? 'Återhämtning utan pass' : 'Inga träningspass'}</p>{matches.map(f => <Link className="hm-calendar-event" key={f.id} href={`/career/fixtures/${f.id}`}>{career.results[f.id] ? 'Matchrapport' : 'Matchförberedelse'} · omg {f.round} →</Link>)}{expiring.map(r => <PlayerLink key={r.player.id} playerId={r.player.id}>Avtal löper ut: {r.player.lastName}</PlayerLink>)}{Object.values(career.scoutingAssignments).filter(a => a.status === 'IN_PROGRESS' && a.endDate === day.date).map(a => <Link key={a.id} href="/career/scouting">Scouting beräknas klar →</Link>)}<CalendarMilestones date={day.date} />{day.date === career.leagueKickoffDate && <strong>Ligastart</strong>}</section>; })}</div><FixtureTable career={career} fixtures={career.fixtures.filter(f => f.date >= week.weekStart && f.date <= addDays(week.weekStart,6) && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId))} /></Panel>)}</div>
  </>;
}
