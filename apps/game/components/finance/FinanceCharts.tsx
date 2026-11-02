"use client";
// HM-ALPHA3-M02: native SVG charts for the Financial Centre. No chart
// library: small, accessible components that read the paper/navy tokens.
// Every chart carries a text summary (aria-label + visible legend). The
// cash chart measures its container so text stays at its real size at any
// width (no stretched SVG), uses round axis steps and marks "today".
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface CashPoint { label: string; value: number; projected?: boolean }

function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => { const w = Math.round(entries[0]?.contentRect.width ?? fallback); if (w > 0) setWidth(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

/** Cash over time: closed months as a solid line, the projection dashed, zero and the overdraft limit as reference lines. */
export function CashLineChart({ points, format, overdraftLimit, label }: { points: readonly CashPoint[]; format: (v: number) => string; overdraftLimit: number; label: string }) {
  const [ref, W] = useWidth<HTMLElement>(760);
  if (points.length === 0) return <p className="hm-text-muted">Inga månader är bokförda ännu.</p>;
  const narrow = W < 520;
  const H = narrow ? 220 : 280, padL = narrow ? 58 : 78, padR = 16, padT = 22, padB = 34;
  const raw = [...points.map((p) => p.value), 0, -overdraftLimit];
  const step = niceStep(Math.max(...raw) - Math.min(...raw) || 1, narrow ? 3 : 4);
  const max = Math.ceil(Math.max(...raw) / step) * step, min = Math.floor(Math.min(...raw) / step) * step;
  const span = max - min || 1;
  const x = (i: number) => padL + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + ((max - v) / span) * (H - padT - padB);
  const actual = points.map((p, i) => ({ ...p, i })).filter((p) => !p.projected);
  const lastActual = actual.at(-1);
  const projected = points.map((p, i) => ({ ...p, i })).filter((p, idx) => p.projected || idx === (lastActual?.i ?? -1));
  const path = (list: { i: number; value: number }[]) => list.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(t);
  const labelEvery = Math.max(1, Math.ceil(points.length / (narrow ? 4 : 9)));
  return (
    <figure className="fc-chart" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {points.some((p) => p.projected) && lastActual && <rect x={x(lastActual.i)} y={padT - 14} width={W - padR - x(lastActual.i)} height={H - padB - padT + 14} className="fc-forecast-zone" />}
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="fc-grid" /><text x={padL - 8} y={y(t) + 4} className="fc-axis" textAnchor="end">{format(t)}</text></g>)}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="fc-zero" />
        <line x1={padL} x2={W - padR} y1={y(-overdraftLimit)} y2={y(-overdraftLimit)} className="fc-limit" />
        <text x={W - padR - 4} y={y(-overdraftLimit) - 6} className="fc-axis fc-limit-label" textAnchor="end">Kreditgräns</text>
        {actual.length > 0 && <path d={`${path(actual)} L${x(actual.at(-1)!.i)},${y(min)} L${x(actual[0]!.i)},${y(min)} Z`} className="fc-area" />}
        {actual.length > 1 && <path d={path(actual)} className="fc-line" />}
        {projected.length > 1 && <path d={path(projected)} className="fc-line fc-line-projected" />}
        {lastActual && points.some((p) => p.projected) && <g><line x1={x(lastActual.i)} x2={x(lastActual.i)} y1={padT - 14} y2={H - padB} className="fc-today" /><text x={x(lastActual.i) + 6} y={padT - 4} className="fc-axis fc-today-label">Senaste bokslut · prognos →</text></g>}
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={p.projected ? 3 : 4.5} className={p.projected ? "fc-dot fc-dot-projected" : "fc-dot"} data-negative={p.value < 0}><title>{`${p.label}: ${format(p.value)}${p.projected ? " (prognos)" : " (bokfört)"}`}</title></circle>)}
        {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && <text key={`l${i}`} x={x(i)} y={H - 10} className="fc-axis" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>{p.label}</text>)}
      </svg>
      <figcaption className="fc-legend">{actual.length > 0 && <span data-kind="actual">Bokfört (stängda månader)</span>}{points.some((p) => p.projected) && <span data-kind="projected">Prognos (uppskattning)</span>}<span data-kind="limit">Kreditgräns {format(-overdraftLimit)}</span></figcaption>
    </figure>
  );
}

export interface BarRow { key: string; label: ReactNode; value: number; color: string; display: string; note?: ReactNode }

/** Horizontal bars sharing one scale -- income and costs side by side read as proportions of the larger total. */
export function CategoryBars({ rows, label, scaleMax }: { rows: readonly BarRow[]; label: string; scaleMax?: number }) {
  const max = scaleMax ?? Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="fc-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="fc-bar-label">{r.label}{r.note && <small>{r.note}</small>}</span>
          <span className="fc-bar-track" aria-hidden="true"><i style={{ width: `${Math.max(1.5, (Math.abs(r.value) / max) * 100)}%`, background: r.color }} /></span>
          <b>{r.display}</b>
        </li>
      ))}
    </ul>
  );
}

export interface StackPart { key: string; label: string; value: number; color: string }

/** One horizontal stacked bar per row (e.g. a season's committed wages: players + staff), on a shared scale. */
export function StackedBars({ rows, format, label }: { rows: readonly { key: string; label: ReactNode; parts: readonly StackPart[] }[]; format: (v: number) => string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((s, p) => s + p.value, 0)));
  const legend = rows[0]?.parts ?? [];
  return (
    <figure className="fc-stack" aria-label={label}>
      <ul className="fc-bars">
        {rows.map((r) => { const total = r.parts.reduce((s, p) => s + p.value, 0); return (
          <li key={r.key}>
            <span className="fc-bar-label">{r.label}</span>
            <span className="fc-bar-track" aria-hidden="true">{r.parts.map((p) => <i key={p.key} style={{ width: `${(p.value / max) * 100}%`, background: p.color }} title={`${p.label}: ${format(p.value)}`} />)}</span>
            <b>{format(total)}</b>
          </li>
        ); })}
      </ul>
      <figcaption className="fc-legend">{legend.map((p) => <span key={p.key} data-swatch style={{ "--sw": p.color } as React.CSSProperties}>{p.label}</span>)}</figcaption>
    </figure>
  );
}
