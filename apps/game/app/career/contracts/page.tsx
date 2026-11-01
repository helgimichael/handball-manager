'use client';
import { useWorkspaceState } from '@/components/game/WorkspaceMemory';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { contractRows } from '@/lib/career/management';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { PlayerCell } from '@/components/game/Identity';
import ContractRenewal from '@/components/ContractRenewal';
import { PageHeading, Panel, EmptyState } from '@/components/manager/Workspace';

export default function ContractsPage() {
  useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const [urgentOnly, setUrgentOnly] = useWorkspaceState('contracts.urgent', false);
  const [selected, setSelected] = useWorkspaceState('contracts.selected', '');
  const all = contractRows(career);
  const rows = urgentOnly ? all.filter(r => r.days === null || r.days <= 365) : all;
  const selectedRow = all.find(r => r.player.id === selected);
  const payroll = all.reduce((sum, r) => sum + (r.contract?.wageEurPerMonth ?? 0), 0);
  const expiring = all.filter(r => r.days !== null && r.days <= 365).length;
  return <div className="hm-contract-screen"><div className="hm-roster-heading"><PageHeading eyebrow={`Lagbygget / ${career.seasonId}`} title="Kontrakt" description="Behåll stommen. Planera för nästa säsong." actions={<Link className="hm-btn" href="/career/players">Hitta ersättare →</Link>} />
    <div className="hm-sports-summary"><div><strong>{expiring}</strong><span>avtal löper ut inom ett år</span></div><div><strong>{all.filter(r => r.days !== null && r.days <= 180).length}</strong><span>avtal med högst 180 dagar kvar</span></div><div><strong className="hm-summary-money">{formatMoney(payroll)}</strong><span>spelarlöner / månad</span></div><Link href="/career/squad"><span>Din trupp</span><b>Bedöm roller & positioner →</b></Link></div></div>
    <div className="hm-contract-layout"><Panel title="Avtalsöversikt" actions={<label><input type="checkbox" checked={urgentOnly} onChange={e => setUrgentOnly(e.target.checked)} /> Utgående inom ett år</label>}>
      <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th>Pos</th><th>Avtal till ↑</th><th>Dagar kvar</th><th>Lön / månad</th><th>Status</th><th>Åtgärd</th></tr></thead><tbody>{rows.map(r => <tr key={r.player.id} data-highlight={selected === r.player.id}><td><PlayerCell player={r.player} /></td><td><span className="hm-position-code">{r.player.position}</span></td><td>{r.contract?.contractEndDate ?? 'Saknas'}</td><td><strong className="hm-contract-countdown" data-urgent={r.days !== null && r.days <= 180}>{r.days ?? '—'}</strong></td><td>{r.contract ? formatMoney(r.contract.wageEurPerMonth) : '—'}</td><td><span className={`hm-badge hm-badge-${r.days !== null && r.days <= 180 ? 'warning' : 'neutral'}`}>{r.status ? CONTRACT_STATUS_LABEL[r.status] : 'Inget avtal'}</span></td><td><button className="hm-btn hm-btn-sm" onClick={() => setSelected(r.player.id)}>Förhandla</button></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState>Inga kontrakt matchar filtret.</EmptyState>}
    </Panel><Panel title={selectedRow ? 'Ditt avtalsbeslut' : 'Nästa säsongs trupp'}>{selectedRow ? <div className="hm-panel-body"><div className="hm-contract-player"><PlayerCell player={selectedRow.player} /><strong>{selectedRow.days === null ? 'Avtal saknas' : `${selectedRow.days} dagar kvar`}</strong></div><p>Förläng spelaren eller undersök alternativ innan avtalet löper ut. En löneökning kräver utrymme i klubbens lönebudget.</p><ContractRenewal key={selected} playerId={selected} /><Link href={`/career/compare?left=${encodeURIComponent(selected)}`}>Jämför alternativ →</Link></div> : <EmptyState><span className="hm-eyebrow">Kontinuitet eller generationsskifte?</span><strong className="hm-decision-prompt">Vem bygger du vidare med?</strong>Välj Förhandla på en spelare för att öppna den befintliga förlängningsprocessen.</EmptyState>}</Panel></div></div>;
}
