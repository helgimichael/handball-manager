'use client';
// Arena Nights Phase 3 -- REC-04b A range-band slider. Our bid on one axis with the scouts' knowledge-gated value
// range (never the hidden value), the selling club's latest counter and our transfer budget. The slider drives the
// same fee field the form submits; negotiation rules and economics are unchanged.
import { formatMoney } from '@/lib/economy/currency';

export function FeeRangeBand({ fee, onFee, range, counter, budget }: { fee: number; onFee: (eur: number) => void; range: { min: number; max: number }; counter?: number; budget: number }) {
  const marks = [range.min, range.max, fee, counter ?? range.max, budget > 0 ? budget : range.max];
  const lo = Math.max(0, Math.floor((Math.min(...marks) * 0.8) / 500) * 500);
  const hi = Math.ceil((Math.max(...marks) * 1.15) / 500) * 500 || 1000;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  const over = budget > 0 && fee > budget;
  return (
    <div className="tc-band" data-over={over || undefined}>
      <div className="tc-band-track" aria-hidden="true">
        <i className="tc-band-range" style={{ left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})` }} />
        {budget > 0 && <i className="tc-band-budget" style={{ left: pct(budget) }} />}
        {counter !== undefined && <i className="tc-band-counter" style={{ left: pct(counter) }} />}
        <i className="tc-band-bid" style={{ left: pct(fee) }} />
      </div>
      <input type="range" min={lo} max={hi} step={500} value={Math.min(hi, Math.max(lo, fee))} onChange={(e) => onFee(Number(e.target.value))} aria-label="Övergångssumma" aria-valuetext={formatMoney(fee)} />
      <ul className="tc-band-legend">
        <li data-k="range">Scouternas värdering {range.min === range.max ? formatMoney(range.min) : `${formatMoney(range.min)} – ${formatMoney(range.max)}`}</li>
        {counter !== undefined && <li data-k="counter">Klubbens motbud {formatMoney(counter)}</li>}
        {budget > 0 && <li data-k="budget">Transferbudget {formatMoney(budget)}</li>}
        <li data-k="bid">Ert bud {formatMoney(fee)}{over ? ' – över budget' : ''}</li>
      </ul>
    </div>
  );
}
