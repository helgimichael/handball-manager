'use client';
// Arena Nights -- SQD-01d / SQD-05a renewal drawer: the existing renewal flow (ContractRenewal, SQD-02n) in the
// shared side drawer, so a contract can be handled without leaving the squad or contracts page.
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { daysBetween } from '@/lib/career/dateUtils';
import { getPlayerContractStatus } from '@/lib/economy/contractIntegration';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { useMoney } from '@/lib/settings/usePreferences';
import ContractRenewal from '@/components/ContractRenewal';
import { SideDrawer } from './SideDrawer';

export function RenewalDrawer({ playerId, onClose, showContractsLink = true }: { playerId: string; onClose: () => void; showContractsLink?: boolean }) {
  const { career } = useCareer();
  const money = useMoney();
  const player = getCareerPlayer(career, playerId);
  const contract = career.playerContracts[playerId];
  const status = getPlayerContractStatus(career, playerId);
  const days = contract ? daysBetween(career.gameDate, contract.contractEndDate) : null;
  const name = player ? `${player.firstName} ${player.lastName}` : 'Okänd spelare';
  return <SideDrawer label={`Kontraktsbeslut: ${name}`}
    onClose={onClose}
    title={<>
      <span className="hm-eyebrow">Förlängning</span>
      <strong className="hm-renew-drawer-name">{player?.shirtNumber != null ? `#${player.shirtNumber} ` : ''}{name}</strong>
      <span className="hm-renew-drawer-meta">{player?.position ?? '—'} · {contract ? `avtal till ${contract.contractEndDate}` : 'avtal saknas'}{days != null ? ` · ${days} dagar kvar` : ''}{contract ? ` · ${money.format(contract.wageEurPerMonth)}/mån` : ''}{status ? ` · ${CONTRACT_STATUS_LABEL[status]}` : ''}</span>
    </>}
    actions={<>
      {showContractsLink && <Link className="hm-btn hm-btn-sm" href={`/career/contracts?player=${encodeURIComponent(playerId)}`}>Öppna i Kontrakt →</Link>}
      <Link className="hm-btn hm-btn-sm" href={`/career/squad/${encodeURIComponent(playerId)}`}>Spelarprofil →</Link>
      <Link className="hm-btn hm-btn-sm hm-btn-ghost" href={`/career/compare?left=${encodeURIComponent(playerId)}`}>Jämför alternativ →</Link>
    </>}
  >
    {contract && contract.clubId === career.playerClubId
      ? <ContractRenewal key={playerId} playerId={playerId} />
      : <p className="hm-dossier-empty">Spelaren har inget avtal med din klubb, så det finns inget att förlänga här.</p>}
  </SideDrawer>;
}
