'use client';
// Arena Nights -- SQD-03a (B) Peek drawer: row selection on the market opens the shared drawer (bottom sheet on
// phones) with previous/next through the current result list. Everything shown is knowledge-gated.
import Link from 'next/link';
import type { CareerState } from '@/lib/career/types';
import type { MarketRow } from '@/lib/players/marketWorkbench';
import { getRecruitmentStatus } from '@/lib/career/recruitment';
import { formatMoney } from '@/lib/economy/currency';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { RANGE_TIER_HINT_SV } from '@/lib/players/rangeBar';
import { ClubLink } from '@/components/entityLinks';
import { PlayerHero } from '@/components/game/Identity';
import { KnowledgeMeter, RecruitmentTag } from '@/components/game/RecruitmentPresentation';
import { SideDrawer } from './SideDrawer';
import { StarRangeBar, ValueRangeBar } from './RangeBar';

export function MarketPeek({ row, career, index, total, valueScale, shortlisted, onShortlist, onPrev, onNext, onClose }: {
  row: MarketRow; career: CareerState; index: number; total: number; valueScale: number; shortlisted: boolean;
  onShortlist: () => void; onPrev: () => void; onNext: () => void; onClose: () => void;
}) {
  const id = encodeURIComponent(row.id);
  return <SideDrawer label={`Spelardossier: ${row.name}`}
    title={<><span className="hm-eyebrow">Spelardossier · {index + 1} av {total}</span><RecruitmentTag status={getRecruitmentStatus(career, row.id)} /></>}
    onClose={onClose}
    nav={<><button type="button" className="hm-btn hm-btn-sm" onClick={onPrev} disabled={index <= 0} aria-label="Föregående spelare">←</button><button type="button" className="hm-btn hm-btn-sm" onClick={onNext} disabled={index >= total - 1} aria-label="Nästa spelare">→</button></>}
    actions={<>
      <Link className="hm-btn hm-btn-primary" href={`/career/squad/${id}`}>Öppna spelarprofil →</Link>
      <button type="button" className="hm-btn" aria-pressed={shortlisted} onClick={onShortlist}>{shortlisted ? 'Kortlistad ✓' : '+ Kortlista'}</button>
      <Link className="hm-btn" href={`/career/scouting?target=${id}`}>Scouta spelare</Link>
      <Link className="hm-btn" href={`/career/transfers?target=${id}`}>Öppna bud & budget</Link>
      <Link className="hm-btn" href={`/career/compare?left=${id}`}>Jämför</Link>
    </>}
  >
    <PlayerHero player={row.player} career={career} />
    <KnowledgeMeter pct={row.knowledge} />
    <div className="hm-range-stack">
      <StarRangeBar label="Nivå" range={row.ability} />
      <StarRangeBar label="Potential" range={row.potential} unknownText="Okänd -- kräver mer kännedom" />
      <ValueRangeBar label="Värde" range={row.value} scaleMax={valueScale} format={n => formatMoney(n, { compact: true })} />
    </div>
    <p className="hm-dossier-note">{RANGE_TIER_HINT_SV[row.tier]}</p>
    <dl className="hm-market-peek-facts">
      <div><dt>Klubb</dt><dd>{row.clubId ? <ClubLink clubId={row.clubId}>{row.clubName}</ClubLink> : 'Fri agent'}</dd></div>
      <div><dt>Position</dt><dd>{row.position}{row.secondaryPosition ? ` / ${row.secondaryPosition}` : ''}</dd></div>
      <div><dt>Ålder</dt><dd>{row.age ?? '—'}</dd></div>
      <div><dt>Avtal till</dt><dd>{row.contractEnd ?? (row.contractStatus ? CONTRACT_STATUS_LABEL[row.contractStatus as keyof typeof CONTRACT_STATUS_LABEL] : '—')}</dd></div>
      <div><dt>Säsongsmål</dt><dd>{row.goals}</dd></div>
      <div><dt>Nationalitet</dt><dd>{row.nationality}</dd></div>
    </dl>
  </SideDrawer>;
}
