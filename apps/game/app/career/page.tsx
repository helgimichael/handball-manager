'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub, getCareerSquad, getCareerPlayer } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getLiveStandings } from '@/lib/career/standings';
import { managementAttention, squadEnergy } from '@/lib/career/management';
import { rolloverSeason } from '@/lib/career/seasonRollover';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import { getClubEconomySnapshot } from '@/lib/economy/clubEconomyIntegration';
import { formatEur } from '@/lib/economy/currency';
import { resolveStatusLabel } from '@/lib/career/playerStatus';
import { mondayOf, resolveTrainingWeek } from '@/lib/training/trainingSchedule';
import { resolveDestinationHref } from '@/lib/career/destinations';
import { categoryLabel } from '@/lib/career/inboxBridge';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import FormDots from '@/components/FormDots';
import { PageHeading, Panel, EmptyState, FixtureTable, CompetitionLink } from '@/components/manager/Workspace';

export default function HomePage() {
  const { career, updateCareer } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const attention = useMemo(() => managementAttention(career), [career]);
  const table = useMemo(() => getLiveStandings(career), [career]);
  const ownRow = table.find(r => r.clubId === club.id);
  const next = getNextPlayerFixture(career);
  const opponentId = next && (next.homeClubId === club.id ? next.awayClubId : next.homeClubId);
  const competition = COMPETITIONS.find(c => c.id === career.competitionId);
  const economy = getClubEconomySnapshot(career, club.id);
  const week = resolveTrainingWeek(career, mondayOf(career.gameDate));
  const messages = [...career.inbox].filter(m => !m.archived).reverse().slice(0, 5);
  const recent = career.fixtures.filter(f => career.results[f.id]).sort((a, b) => b.date.localeCompare(a.date));
  const ownRecent = recent.filter(f => f.homeClubId === club.id || f.awayClubId === club.id).slice(0, 4);
  const upcoming = career.fixtures.filter(f => !career.results[f.id] && (f.homeClubId === club.id || f.awayClubId === club.id)).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 4);
  const issues = [...attention.unavailable.map(p => ({ p, detail: `${resolveStatusLabel(career.playerStatuses, p)} · ${career.playerStatuses[p.id]?.returnDate ?? career.playerInjuries[p.id]?.activeInjury?.expectedReturnDate ?? 'återkomst ej fastställd'}` })), ...attention.tired.filter(p => !attention.unavailable.some(x => x.id === p.id)).map(p => ({ p, detail: `Energi ${Math.round(squadEnergy(career, p))}% · se över återhämtningen` }))];
  return <><PageHeading eyebrow={`${club.name} / ${career.seasonId}`} title="Managerkontoret" description="Klubbens läge, dagens beslut och nästa match." actions={<Link href="/career/calendar" className="hm-btn">Öppna kalender →</Link>} />
    <div className="hm-summary-strip"><div><small>Tabellplacering</small><strong>{ownRow ? table.indexOf(ownRow) + 1 : '—'} <span>/ {table.length}</span></strong></div><div><small>Poäng / matcher</small><strong>{ownRow?.points ?? 0} <span>/ {ownRow?.played ?? 0}</span></strong></div><div><small>Målskillnad</small><strong>{ownRow?.goalDifference ?? 0}</strong></div><div><small>Form · senaste fem</small><FormDots results={(career.clubForm[club.id] ?? []).slice(-5)} /></div><div><small>Tillgänglig trupp</small><strong>{squad.length - attention.unavailable.length} <span>/ {squad.length}</span></strong></div><div><small>Transferutrymme</small><strong>{economy ? formatEur(economy.budgets.transferBudgetEur) : '—'}</strong></div></div>
    <div className="hm-dashboard-grid"><div className="hm-stack">
      <Panel title="Kräver din uppmärksamhet" actions={<Link href="/career/inbox">Inkorg →</Link>}>
        <div className="hm-attention-row"><Link href="/career/contracts"><strong>{attention.contracts.length} utgående avtal</strong><span>Behålla, ersätta eller ge en större roll?</span></Link><Link className="hm-btn hm-btn-sm" href="/career/contracts">Planera kontrakt</Link></div>
        <div className="hm-attention-row"><Link href="/career/training"><strong>{attention.tired.length} spelare med låg energi</strong><span>Träningsbelastning, återhämtning och nästa startsju.</span></Link><Link className="hm-btn hm-btn-sm" href="/career/training">Hantera belastning</Link></div>
        <div className="hm-attention-row"><Link href="/career/recruitment?view=SHORTLIST"><strong>{attention.shortlist.length} spelare på kortlistan</strong><span>{attention.reports.length} scoututlåtanden tillgängliga.</span></Link><Link className="hm-btn hm-btn-sm" href="/career/recruitment?view=SHORTLIST">Granska kandidater</Link></div>
        {attention.contracts.slice(0, 3).map(r => <div className="hm-detail-row" key={r.player.id}><PlayerLink playerId={r.player.id}>{r.player.firstName} {r.player.lastName}</PlayerLink><span>{r.player.position} · avtal till {r.contract?.contractEndDate ?? '—'} · {r.days} dagar</span></div>)}
      </Panel>
      <Panel title={career.seasonComplete ? 'Säsongen avslutad' : 'Nästa match'} actions={next && <Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/match-preview">Förbered match →</Link>}>
        {career.seasonComplete ? <div className="hm-panel-body"><p>Slutplacering {ownRow ? table.indexOf(ownRow) + 1 : '—'} i {competition?.name}. Se över kontrakten inför sommaren.</p><div className="hm-actions"><button className="hm-btn hm-btn-primary" onClick={() => updateCareer(rolloverSeason)}>Börja nästa säsong →</button><Link href="/career/history">Säsongshistorik →</Link></div></div> : next && opponentId ? <div className="hm-match-brief"><div><small>{next.date} · {next.homeClubId === club.id ? 'Hemma' : 'Borta'} · omgång {next.round}</small><h2><ClubLink clubId={opponentId}>{getClub(opponentId)?.name ?? opponentId}</ClubLink></h2><CompetitionLink id={next.competitionId}>{competition?.name ?? next.competitionId}</CompetitionLink></div><div><small>Motståndarens form</small><FormDots results={(career.clubForm[opponentId] ?? []).slice(-5)} /><Link href={`/career/clubs/${opponentId}`}>Inspektera motstånd →</Link></div></div> : <EmptyState>Ingen kommande match.</EmptyState>}
      </Panel>
      <Panel title="Senaste klubbresultat" actions={<Link href="/career/schedule">Alla matcher →</Link>}><FixtureTable career={career} fixtures={ownRecent} /></Panel>
      <Panel title="Truppens tillstånd" actions={<Link href="/career/squad">Öppna trupp →</Link>}>{issues.length ? <table className="hm-table"><thead><tr><th>Spelare</th><th>Pos</th><th>Uppföljning</th></tr></thead><tbody>{issues.slice(0, 7).map(({ p, detail }) => <tr key={p.id}><td><PlayerLink playerId={p.id}>{p.firstName} {p.lastName}</PlayerLink></td><td>{p.position}</td><td>{detail}</td></tr>)}</tbody></table> : <EmptyState>Truppen är tillgänglig och har god energi.</EmptyState>}</Panel>
    </div><div className="hm-stack">
      <Panel title="Senaste information" actions={<Link href="/career/inbox">Alla meddelanden →</Link>}>{messages.length ? messages.map(m => <div key={m.id} className="hm-feed-item"><Link href={`/career/inbox?message=${encodeURIComponent(m.id)}`}><small>{categoryLabel(m.category)} · {m.date}</small><strong>{!m.read && <span className="hm-unread-dot" />}{m.subject}</strong><span>{m.preview}</span></Link>{m.destinations?.[0] && resolveDestinationHref(m.destinations[0]) && <Link href={resolveDestinationHref(m.destinations[0])!}>Öppna ärende →</Link>}</div>) : <EmptyState>Ingen ny information.</EmptyState>}</Panel>
      <Panel title={<CompetitionLink id={career.competitionId}>{competition?.name ?? 'Ligatabell'}</CompetitionLink>} actions={<Link href={`/career/competitions/${career.competitionId}`}>Full tabell →</Link>}><table className="hm-table"><thead><tr><th>#</th><th>Klubb</th><th>SM</th><th>P</th><th>Form</th></tr></thead><tbody>{table.filter((r, i) => i < 5 || Math.abs(i - table.indexOf(ownRow!)) <= 1).map(r => <tr key={r.clubId} data-highlight={r.clubId === club.id}><td>{table.indexOf(r) + 1}</td><td><ClubLink clubId={r.clubId}>{getClub(r.clubId)?.shortName ?? r.clubId}</ClubLink></td><td>{r.played}</td><td><strong>{r.points}</strong></td><td><FormDots results={(career.clubForm[r.clubId] ?? []).slice(-5)} /></td></tr>)}</tbody></table></Panel>
      <Panel title="Veckans rytm" actions={<Link href="/career/training">Träningsplan →</Link>}>{week.days.filter(d => d.date >= career.gameDate).map(d => <div className="hm-detail-row" key={d.date}><span>{d.date}</span><span>{d.dayType === 'MATCH' ? 'Match' : d.dayType === 'REST' ? 'Vila' : d.dayType === 'RECOVERY' ? 'Återhämtning' : `${d.sessions.length} träningspass`}{d.executed ? ' · utfört' : ''}</span></div>)}<FixtureTable career={career} fixtures={upcoming.slice(0, 2)} /></Panel>
      <Panel title="Världen runt klubben" actions={<Link href={`/career/competitions/${career.competitionId}?tab=results`}>Ligaresultat →</Link>}><FixtureTable career={career} fixtures={recent.filter(f => f.homeClubId !== club.id && f.awayClubId !== club.id).slice(0, 3)} />{attention.reports.slice(0, 2).map(report => { const p = getCareerPlayer(career, report.targetPlayerId); return p && <div className="hm-detail-row" key={report.id}><PlayerLink playerId={p.id}>{p.firstName} {p.lastName}</PlayerLink><span>Scoututlåtande · {report.createdDate}</span></div>; })}</Panel>
    </div></div></>;
}
