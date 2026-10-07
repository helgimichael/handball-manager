'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { contractRows } from '@/lib/career/management';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { formatEur } from '@/lib/economy/currency';
import { PlayerLink } from '@/components/entityLinks';
import ContractRenewal from '@/components/ContractRenewal';
import { PageHeading, Panel, EmptyState } from '@/components/manager/Workspace';

export default function ContractsPage() {
  const { career } = useCareer();
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selected, setSelected] = useState('');
  const all = contractRows(career);
  const rows = urgentOnly ? all.filter(r => r.days === null || r.days <= 365) : all;
  const selectedRow = all.find(r => r.player.id === selected);
  const payroll = all.reduce((sum, r) => sum + (r.contract?.wageEurPerMonth ?? 0), 0);
  return <><PageHeading eyebrow="Truppplanering" title="Kontrakt" description={`Spelarlöner ${formatEur(payroll)} / månad · ${all.filter(r => r.days !== null && r.days <= 365).length} avtal löper ut inom ett år.`} actions={<Link className="hm-btn" href="/career/players">Hitta ersättare →</Link>} />
    <div className="hm-workspace-split"><Panel title="Avtalsöversikt" actions={<label><input type="checkbox" checked={urgentOnly} onChange={e => setUrgentOnly(e.target.checked)} /> Utgående inom ett år</label>}>
      <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th>Pos</th><th>Avtal till ↑</th><th>Dagar kvar</th><th>Lön / månad</th><th>Status</th><th>Åtgärd</th></tr></thead><tbody>{rows.map(r => <tr key={r.player.id} data-highlight={selected === r.player.id}><td><PlayerLink playerId={r.player.id}>{r.player.firstName} {r.player.lastName}</PlayerLink></td><td>{r.player.position}</td><td>{r.contract?.contractEndDate ?? 'Saknas'}</td><td>{r.days ?? '—'}</td><td>{r.contract ? formatEur(r.contract.wageEurPerMonth) : '—'}</td><td><span className={`hm-badge hm-badge-${r.days !== null && r.days <= 180 ? 'warning' : 'neutral'}`}>{r.status ? CONTRACT_STATUS_LABEL[r.status] : 'Inget avtal'}</span></td><td><button className="hm-btn hm-btn-sm" onClick={() => setSelected(r.player.id)}>Förhandla</button></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState>Inga kontrakt matchar filtret.</EmptyState>}
    </Panel><Panel title={selectedRow ? `${selectedRow.player.firstName} ${selectedRow.player.lastName}` : 'Avtalsbeslut'}>{selectedRow ? <div className="hm-panel-body"><p>Förläng spelaren eller undersök alternativ innan avtalet löper ut. En löneökning kräver utrymme i klubbens lönebudget.</p><ContractRenewal key={selected} playerId={selected} /><Link href={`/career/compare?left=${encodeURIComponent(selected)}`}>Jämför alternativ →</Link></div> : <EmptyState>Välj Förhandla på en spelare för att öppna den befintliga förlängningsprocessen.</EmptyState>}</Panel></div></>;
}
