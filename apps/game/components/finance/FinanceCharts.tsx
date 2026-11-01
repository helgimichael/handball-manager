"use client";
// HM-ALPHA3-M02: native SVG charts for the Financial Centre. No chart
// library: two small, accessible components that read the paper/navy
// tokens. Every chart carries a text summary (aria-label + visible legend).
import type { ReactNode } from "react";

export interface CashPoint { label: string; value: number; projected?: boolean }

/** Cash over time: closed months as a solid line, the projection dashed, zero and the overdraft limit as reference lines. */
export function CashLineChart({ points, format, overdraftLimit, label }: { points: readonly CashPoint[]; format: (v: number) => string; overdraftLimit: number; label: string }) {
  const W = 760, H = 230, padL = 74, padR = 18, padT = 16, padB = 34;
  if (points.length === 0) return <p className="hm-text-muted">Inga månader är bokförda ännu.</p>;
  const values = [...points.map((p) => p.value), 0, -overdraftLimit];
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const x = (i: number) => padL + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + ((max - v) / span) * (H - padT - padB);
  const actual = points.map((p, i) => ({ ...p, i })).filter((p) => !p.projected);
  const lastActual = actual.at(-1);
  const projected = points.map((p, i) => ({ ...p, i })).filter((p, idx) => p.projected || idx === (lastActual?.i ?? -1));
  const path = (list: { i: number; value: number }[]) => list.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [max, (max + min) / 2, min];
  return (
    <figure className="fc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
        {ticks.map((t, k) => <g key={k}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="fc-grid" /><text x={padL - 8} y={y(t) + 4} className="fc-axis" textAnchor="end">{format(t)}</text></g>)}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="fc-zero" />
        <line x1={padL} x2={W - padR} y1={y(-overdraftLimit)} y2={y(-overdraftLimit)} className="fc-limit" />
        <text x={W - padR} y={y(-overdraftLimit) - 5} className="fc-axis fc-limit-label" textAnchor="end">Kreditgräns</text>
        {actual.length > 0 && <path d={`${path(actual)} L${x(actual.at(-1)!.i)},${y(min)} L${x(actual[0]!.i)},${y(min)} Z`} className="fc-area" />}
        {actual.length > 1 && <path d={path(actual)} className="fc-line" />}
        {projected.length > 1 && <path d={path(projected)} className="fc-line fc-line-projected" />}
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={p.projected ? 2.5 : 3.5} className={p.projected ? "fc-dot fc-dot-projected" : "fc-dot"} data-negative={p.value < 0}><title>{`${p.label}: ${format(p.value)}${p.projected ? " (prognos)" : ""}`}</title></circle>)}
        {points.map((p, i) => (i % Math.max(1, Math.ceil(points.length / 8)) === 0 || i === points.length - 1) && <text key={`l${i}`} x={x(i)} y={H - 10} className="fc-axis" textAnchor="middle">{p.label}</text>)}
      </svg>
      <figcaption className="fc-legend"><span data-kind="actual">Bokfört</span><span data-kind="projected">Prognos</span><span data-kind="limit">Kreditgräns {format(-overdraftLimit)}</span></figcaption>
    </figure>
  );
}

export interface BarRow { key: string; label: ReactNode; value: number; color: string; display: string }

/** Horizontal bars sharing one scale -- income and costs side by side read as proportions of the larger total. */
export function CategoryBars({ rows, label, scaleMax }: { rows: readonly BarRow[]; label: string; scaleMax?: number }) {
  const max = scaleMax ?? Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="fc-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="fc-bar-label">{r.label}</span>
          <span className="fc-bar-track" aria-hidden="true"><i style={{ width: `${Math.max(1.5, (Math.abs(r.value) / max) * 100)}%`, background: r.color }} /></span>
          <b>{r.display}</b>
        </li>
      ))}
    </ul>
  );
}
