'use client';
// Arena Nights C5.3 -- ENT-07 C "Peek": a quick look at a player without leaving the page.
// Drawer from the right on desktop, bottom sheet on phones; Escape / scrim / close button dismiss it;
// "Öppna hela sidan" goes to the full profile (SQD-02).
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { MatrixRow } from '@/lib/career/squadMatrix';
import { SQUAD_STATUS_TIER_LABEL_SV } from '@/lib/career/squadStatus';
import { PlayerChip } from './PlayerChip';

export default function PlayerPeek({ row, onClose, form }: { row: MatrixRow; onClose: () => void; form?: React.ReactNode }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [onClose]);
  const facts: [string, string][] = [
    ['Trupproll', SQUAD_STATUS_TIER_LABEL_SV[row.role]],
    ['Ålder', row.age == null ? '—' : String(row.age)],
    ['Energi', `${row.energy} %`],
    ['Matchträning', `${row.fitness} %`],
    ['Moral', String(row.morale)],
    ['Matcher / starter', `${row.appearances} / ${row.starts}`],
    ['Mål', String(row.goals)],
    [row.position === 'MV' ? 'Räddn. %' : 'Skott %', String((row.position === 'MV' ? row.savePct : row.shotPct) ?? '—')],
    ['Betyg', row.rating == null ? '—' : row.rating.toFixed(1)],
    ['Avtal till', row.contractEnd ?? '—'],
  ];
  return <div className="hm-peek-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="hm-peek" role="dialog" aria-modal="true" aria-label={`Snabbtitt: ${row.name}`}>
      <header><PlayerChip row={row} form={form} /><button ref={close} type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose} aria-label="Stäng snabbtitten">✕</button></header>
      {!row.available && <p className="hm-peek-alert">{row.availability === 'INJURED' ? 'Skadad' : 'Inte tillgänglig'}{row.returnDate ? ` · åter ${row.returnDate}` : ''}</p>}
      <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className="hm-peek-actions">
        <Link className="hm-btn hm-btn-primary" href={`/career/squad/${encodeURIComponent(row.id)}`}>Öppna hela sidan →</Link>
        <Link className="hm-btn" href={`/career/contracts`}>Kontrakt →</Link>
        <Link className="hm-btn" href={`/career/training`}>Träning →</Link>
      </div>
    </aside>
  </div>;
}
