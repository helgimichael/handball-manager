'use client';
// Arena Nights C5.3 -- SQD-01 player chip: shirt number, name, position, energy bar, match-fitness band pip,
// morale dot and (optionally) the 5-match form sparkline. Reused by the Squad Matrix rows, phone cards and Peek.
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MatrixRow } from '@/lib/career/squadMatrix';

const BAND: Record<MatrixRow['fitnessBand'], string> = { LOW: 'låg', MID: 'medel', HIGH: 'hög' };

export function PlayerChip({ row, form, link = true }: { row: MatrixRow; form?: ReactNode; link?: boolean }) {
  const title = `${row.name} · ${row.position} · energi ${row.energy} % · matchträning ${BAND[row.fitnessBand]} (${row.fitness} %) · moral ${row.morale}`;
  return <span className="hm-chip" data-available={row.available} title={title}>
    <span className="hm-chip-shirt" aria-hidden="true">{row.shirt ?? '—'}</span>
    <span className="hm-chip-main">
      <span className="hm-chip-name">
        {link ? <Link href={`/career/squad/${encodeURIComponent(row.id)}`}>{row.name}</Link> : <strong>{row.name}</strong>}
        {row.captain && <span className="hm-squad-role-pill" data-role="captain" title="Lagkapten">K</span>}
        {row.vice && <span className="hm-squad-role-pill" data-role="vice" title="Vicekapten">VK</span>}
        {row.penaltyOrder != null && <span className="hm-squad-role-pill" data-role="penalty" title={`7-metersskytt #${row.penaltyOrder}`}>7m</span>}
      </span>
      <span className="hm-chip-meta">
        <span className="hm-chip-pos">{row.position}</span>
        <span className="hm-chip-energy" role="img" aria-label={`Energi ${row.energy} %`}><i style={{ width: `${Math.max(0, Math.min(100, row.energy))}%` }} data-low={row.energy < 75} /></span>
        <span className="hm-chip-pip" data-band={row.fitnessBand} role="img" aria-label={`Matchträning ${BAND[row.fitnessBand]}`} />
        <span className="hm-chip-morale" data-tone={row.moraleTone} role="img" aria-label={`Moral ${row.morale}`} />
        {form}
      </span>
    </span>
  </span>;
}
