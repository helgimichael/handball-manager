'use client';
// Arena Nights -- analysis hub pieces: KPI tiles with sparklines and the trend chart (ANL-02 A, ANL-04 A),
// "Vad har ändrats" cards, the us-vs-them mirror (ANL-03 A) and the shared threat cards (ANL-03 / MDY-01d).
// Presentation of lib/analysis/trends.ts and lib/analysis/threats.ts only.
import Link from 'next/link';
import { useState } from 'react';
import type { ChangeCard, KpiTile, MirrorRow, TrendMetricId, TrendPoint } from '@/lib/analysis/trends';
import { TREND_METRICS, fmtMetric, trendMetric } from '@/lib/analysis/trends';
import type { ThreatCard } from '@/lib/analysis/threats';
import { CONFIDENCE_LABEL } from '@/lib/scouting/opponentScouting';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { getClub } from '@/lib/game-data';

export function WindowToggle<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div className="an-toggle" role="group" aria-label={label}>{options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>;
}

function Spark({ values }: { values: (number | null)[] }) {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = values.map((x, i) => (x === null ? null : `${(i / (values.length - 1)) * 100},${28 - ((x - lo) / span) * 24}`)).filter(Boolean).join(' ');
  return <svg className="an-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} /></svg>;
}

export function KpiTiles({ tiles, onPick, picked }: { tiles: KpiTile[]; onPick?: (id: TrendMetricId) => void; picked?: TrendMetricId }) {
  return <ul className="an-kpis" aria-label="Nyckeltal, senaste fem mot säsongen">{tiles.map((t) => {
    const body = <><small>{t.label}</small><strong className="an-num">{fmtMetric(t.recent, t.pct)}</strong>
      <span className="an-delta" data-better={t.better === null ? undefined : String(t.better)}>{t.delta === null ? 'säsongssnitt saknas' : `${t.delta > 0 ? '+' : t.delta < 0 ? '−' : '±'}${fmtMetric(Math.abs(t.delta), t.pct)} mot säsong`}</span><Spark values={t.spark} /></>;
    return <li key={t.id} data-picked={picked === t.id || undefined}>{onPick ? <button type="button" onClick={() => onPick(t.id)} aria-pressed={picked === t.id}>{body}</button> : body}</li>;
  })}</ul>;
}

/** Per-match values (dots, each opens that match report) and the rolling average line. */
export function TrendChart({ points, metric, window }: { points: TrendPoint[]; metric: TrendMetricId; window: number }) {
  const m = trendMetric(metric);
  const [hover, setHover] = useState<number | null>(null);
  const vals = points.flatMap((p) => [p.value, p.rolling]).filter((v): v is number => v !== null);
  if (points.length < 2 || !vals.length) return <p className="an-empty">För få matcher för en trendlinje ännu – den visas efter två spelade matcher.</p>;
  const W = 640, H = 200, P = 18;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const roll = points.map((p, i) => (p.rolling === null ? null : `${x(i)},${y(p.rolling)}`)).filter(Boolean).join(' ');
  const h = hover !== null ? points[hover] : null;
  return <figure className="an-trend">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} per match med rullande snitt över ${window} matcher.`}>
      <line className="an-axis" x1={P} x2={W - P} y1={H - P} y2={H - P} />
      <polyline className="an-roll" points={roll} />
      {points.map((p, i) => p.value === null ? null : <a key={p.fixtureId} href={matchReportHref(p.fixtureId)} aria-label={`${p.date} mot ${getClub(p.opponentClubId)?.shortName ?? p.opponentClubId}: ${fmtMetric(p.value, m.pct)}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}><circle className="an-dot" cx={x(i)} cy={y(p.value)} r={hover === i ? 6 : 4} /></a>)}
    </svg>
    <figcaption aria-live="polite">{h ? `${h.date} · mot ${getClub(h.opponentClubId)?.shortName ?? h.opponentClubId}: ${fmtMetric(h.value, m.pct)} (snitt ${fmtMetric(h.rolling, m.pct)})` : `Punkter: varje match (klicka för matchrapporten). Linje: rullande snitt över ${window} matcher. ${m.higherIsBetter ? 'Högre är bättre.' : 'Lägre är bättre.'}`}</figcaption>
  </figure>;
}

export function MetricPicker({ value, onChange }: { value: TrendMetricId; onChange: (id: TrendMetricId) => void }) {
  return <label className="an-picker"><span>Mått</span><select className="hm-select" value={value} onChange={(e) => onChange(e.target.value as TrendMetricId)}>{TREND_METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>;
}

export function ChangeCards({ cards }: { cards: ChangeCard[] }) {
  if (!cards.length) return <p className="an-empty">Inget har ändrats tydligt (mer än 10 %) mellan de senaste fem matcherna och säsongssnittet – eller så finns ännu inget säsongssnitt att jämföra med.</p>;
  return <ul className="an-changes">{cards.map((c) => <li key={c.id} data-better={String(c.better)}>
    <small>{c.better ? 'Bättre' : 'Sämre'} · {c.label}</small>
    <strong className="an-num">{fmtMetric(c.recent, c.pct)} <span>mot {fmtMetric(c.season, c.pct)}</span></strong>
    <p>{c.relative > 0 ? 'Upp' : 'Ner'} {Math.round(Math.abs(c.relative) * 100)} % de senaste fem matcherna jämfört med säsongen.</p>
    <Link className="hm-btn hm-btn-sm" href={c.href}>{c.cta} →</Link>
  </li>)}</ul>;
}

/** Them (left) vs us (right) per metric; the stronger side is lit. */
export function MirrorChart({ rows, them, us }: { rows: MirrorRow[]; them: string; us: string }) {
  return <div className="an-mirror" role="table" aria-label={`${them} mot ${us}`}>
    <div role="row" className="an-mirror-head"><span role="columnheader">{them}</span><span role="columnheader">Mått</span><span role="columnheader">{us}</span></div>
    {rows.map((r) => {
      const scale = Math.max(Math.abs(r.them ?? 0), Math.abs(r.us ?? 0), 1e-9);
      return <div role="row" key={r.id} className="an-mirror-row" data-stronger={r.stronger ?? undefined}>
        <span role="cell" className="an-mirror-bar" data-side="them"><b className="an-num">{fmtMetric(r.them, r.pct)}</b><i style={{ width: `${((r.them ?? 0) / scale) * 100}%` }} /></span>
        <span role="cell" className="an-mirror-label">{r.label}<small>{r.higherIsBetter ? 'högre är bättre' : 'lägre är bättre'}</small></span>
        <span role="cell" className="an-mirror-bar" data-side="us"><i style={{ width: `${((r.us ?? 0) / scale) * 100}%` }} /><b className="an-num">{fmtMetric(r.us, r.pct)}</b></span>
      </div>;
    })}
  </div>;
}

export function ThreatCards({ cards, empty }: { cards: ThreatCard[]; empty?: React.ReactNode }) {
  if (!cards.length) return <div className="an-empty">{empty ?? 'Inga tydliga hot i underlaget ännu.'}</div>;
  return <ul className="an-threats">{cards.map((c) => <li key={c.id} data-source={c.source}>
    <header><strong>{c.title}</strong><span className="an-conf" data-level={c.confidence}>{c.source === 'SCOUTING' ? `${CONFIDENCE_LABEL[c.confidence as 'HIGH']} · ${c.confidencePct} %` : 'Fakta · resultat'}</span></header>
    <p>{c.text}</p>
    <Link className="an-answer" href={c.href}><small>Vårt svar</small>{c.answer} →</Link>
  </li>)}</ul>;
}
