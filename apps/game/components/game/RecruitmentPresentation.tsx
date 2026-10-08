import Link from 'next/link';
import { getClub } from '@/lib/game-data';
import type { CareerState } from '@/lib/career/types';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { formatEur } from '@/lib/economy/currency';
import { KNOWLEDGE_TIER_LABEL_SV, knowledgeTier } from '@/lib/knowledge/types';
import { RECRUITMENT_STATUS_LABEL_SV, type RecruitmentStatus } from '@/lib/career/recruitment';
import type { TransferOffer } from '@/lib/transfers/types';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import { PlayerGlyph } from './Identity';

export function KnowledgeMeter({ pct }: { pct: number }) {
  return <div className="game-knowledge"><span>{KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(pct)]}<b>{Math.round(pct)}%</b></span><div className="game-knowledge-track" role="meter" aria-label="Spelarkännedom" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div></div>;
}

export function RecruitmentTag({ status }: { status: RecruitmentStatus }) {
  return <span className="game-recruitment-tag" data-stage={status}>{RECRUITMENT_STATUS_LABEL_SV[status]}</span>;
}

const OUTCOME = {
  COMPLETED: 'Affären är klar',
  AGREED_AWAITING_WINDOW: 'Överenskommelse på plats',
  REJECTED_BY_CLUB: 'Klubben avböjer budet',
  REJECTED_BY_PLAYER: 'Spelaren avböjer avtalet',
  BLOCKED_UNAFFORDABLE: 'Budet ryms inte i ekonomin',
  BLOCKED_PENDING_TRANSFER: 'Spelaren har en pågående affär',
  CANCELLED_STALE: 'Affären har avbrutits',
} as const;

/** A resolved offer is the event source, including after a signing leaves the candidate list. */
export function TransferEvent({ offer, career }: { offer: TransferOffer; career: CareerState }) {
  const player = getCareerPlayer(career, offer.playerId);
  const incoming = offer.toClubId === career.playerClubId;
  const loan = offer.dealType === 'LOAN' ? career.loans[offer.id] : undefined;
  return <article className="game-transfer-event" data-outcome={offer.status} aria-live="polite">
    <div className="game-transfer-event-identity">{player && <PlayerGlyph player={player} size={72} />}<div><div className="hm-eyebrow">{incoming ? 'Inkommande' : 'Utgående'} · {offer.dealType === 'LOAN' ? 'Lån' : 'Övergång'} · {offer.resolvedDate ?? offer.offeredDate}</div><h2>{OUTCOME[offer.status]}</h2><PlayerLink playerId={offer.playerId}>{player ? `${player.firstName} ${player.lastName}` : 'Spelarprofil'}</PlayerLink></div></div>
    <div className="game-transfer-route">{offer.fromClubId ? <ClubLink clubId={offer.fromClubId}>{getClub(offer.fromClubId)?.shortName ?? offer.fromClubId}</ClubLink> : <span>Fri agent</span>}<span aria-hidden="true">→</span><ClubLink clubId={offer.toClubId}>{getClub(offer.toClubId)?.shortName ?? offer.toClubId}</ClubLink></div>
    <div className="game-transfer-terms"><div><small>{offer.dealType === 'LOAN' ? 'Låneavgift' : 'Övergångssumma'}</small><strong>{formatEur(offer.transferFeeEur)}</strong></div><div><small>Utbildningsersättning</small><strong>{formatEur(offer.trainingCompensationEur)}</strong></div><div><small>{offer.dealType === 'LOAN' ? 'Erbjuden lönebas / månad' : 'Erbjuden lön / månad'}</small><strong>{formatEur(offer.newWageEurPerMonth)}</strong></div>{offer.loanTerms && <><div><small>Låneklubbens löneandel</small><strong>{offer.loanTerms.wageShareBorrowingPct}%</strong></div><div><small>Låneperiod</small><strong>{offer.loanTerms.startDate} → {offer.loanTerms.endDate}</strong></div></>}{loan && <div><small>Avtalad löneandel / månad</small><strong>{formatEur(Math.round(loan.originalWageEurPerMonth * loan.wageShareBorrowingPct / 100))}</strong></div>}</div>
    {offer.dealType === 'LOAN' && <p>Löneandelen beräknas från spelarens befintliga avtal.</p>}
    {(offer.clubDecisionReason || offer.playerDecisionReason) && <p>{[offer.clubDecisionReason, offer.playerDecisionReason].filter(Boolean).join(' ')}</p>}
    {offer.status === 'AGREED_AWAITING_WINDOW' && offer.scheduledCompletionDate && <p>Ankomst planerad till {offer.scheduledCompletionDate}.</p>}
    {offer.status === 'COMPLETED' && <Link className="hm-btn hm-btn-primary" href={incoming ? '/career/squad' : `/career/clubs/${encodeURIComponent(offer.toClubId)}`}>{incoming ? 'Se spelaren i truppen →' : 'Besök den nya klubben →'}</Link>}
  </article>;
}
