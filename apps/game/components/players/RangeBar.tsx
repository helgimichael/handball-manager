'use client';
// Arena Nights -- SQD-02l tightening range bar. Renders an ALREADY knowledge-gated range (never a true value):
// star ranges as five cells with the plausible band lit, continuous ranges (money) as a band on a track.
// The band narrows as knowledge rises; the tier hint says why it is wide.
import { rangeBarGeometry, starRangeCells } from '@/lib/players/rangeBar';

export function StarRangeBar({ label, range, unknownText = 'Okänd' }: { label: string; range: { min: number; max: number } | null; unknownText?: string }) {
  if (!range) return <div className="hm-range" data-unknown="true"><span className="hm-range-label">{label}</span><span className="hm-range-cells" aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <i key={i} />)}</span><b className="hm-range-value">{unknownText}</b></div>;
  const cells = starRangeCells(range);
  const text = range.min === range.max ? `${range.min} ★` : `${range.min}–${range.max} ★`;
  return <div className="hm-range" data-exact={range.min === range.max}>
    <span className="hm-range-label">{label}</span>
    <span className="hm-range-cells" role="img" aria-label={`${label}: ${range.min === range.max ? `${range.min} av 5 stjärnor` : `mellan ${range.min} och ${range.max} av 5 stjärnor`}`}>{cells.map((on, i) => <i key={i} data-on={on} />)}</span>
    <b className="hm-range-value">{text}</b>
  </div>;
}

export function ValueRangeBar({ label, range, scaleMax, format }: { label: string; range: { min: number; max: number } | null; scaleMax: number; format: (n: number) => string }) {
  if (!range) return <div className="hm-range" data-unknown="true"><span className="hm-range-label">{label}</span><span className="hm-range-track" aria-hidden="true" /><b className="hm-range-value">—</b></div>;
  const g = rangeBarGeometry(range, 0, Math.max(scaleMax, range.max, 1));
  const text = range.min === range.max ? format(range.min) : `${format(range.min)} – ${format(range.max)}`;
  return <div className="hm-range" data-exact={g.exact}>
    <span className="hm-range-label">{label}</span>
    <span className="hm-range-track" role="img" aria-label={`${label}: ${text}`}><i style={{ left: `${g.left}%`, width: `${g.width}%` }} /></span>
    <b className="hm-range-value">{text}</b>
  </div>;
}
