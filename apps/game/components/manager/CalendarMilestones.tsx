'use client';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { addDays } from '@/lib/career/dateUtils';
import { isTransferWindowOpen } from '@/lib/transfers/transferWindow';
import { getClub } from '@/lib/game-data';
import { PlayerLink } from '@/components/entityLinks';
export default function CalendarMilestones({ date }: { date:string }) {
  const { career } = useCareer();
  const opens = isTransferWindowOpen(date) && !isTransferWindowOpen(addDays(date,-1));
  const closes = isTransferWindowOpen(date) && !isTransferWindowOpen(addDays(date,1));
  const lastLeagueDate = career.fixtures.filter(f => f.type === 'LEAGUE').reduce((latest,f) => f.date > latest ? f.date : latest,'');
  return <div className="hm-stack">{opens && <Link href="/career/transfers">Transferfönstret öppnar →</Link>}{closes && <Link href="/career/transfers">Sista dagen i transferfönstret →</Link>}{lastLeagueDate === date && <Link href={`/career/competitions/${career.competitionId}`}>Sista ligaomgången →</Link>}{Object.values(career.transferOffers).filter(o => o.status === 'AGREED_AWAITING_WINDOW' && o.scheduledCompletionDate === date && o.toClubId === career.playerClubId).map(o => <PlayerLink key={o.id} playerId={o.playerId}>Planerad övergång från {getClub(o.fromClubId)?.shortName ?? 'fri agent'}</PlayerLink>)}</div>;
}
