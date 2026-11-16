'use client';
// HM-SCOUTING-1.0: the report VIEW for an external player's Player Profile -- a presentation layer over
// lib/knowledge/scoutReportVisibility.ts's already-resolved ScoutReportView; never re-derives ability/potential/
// market-value gating itself.
// Arena Nights SQD-02m (A) "Report timeline": every filed version listed with scout and date, with the ability and
// value ranges AS THEY WERE at that report's knowledge level (resolved by the caller through the same gating), so
// the narrowing is visible; the latest is expanded; tap an older version to compare it with the latest.
import { useState } from "react";
import type { ScoutReportView } from "@/lib/knowledge/scoutReportVisibility";
import type { StarRange } from "@/lib/knowledge/playerVisibility";
import { KNOWLEDGE_TIER_LABEL_SV } from "@/lib/knowledge/types";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { StarRangeBar, ValueRangeBar } from "@/components/players/RangeBar";

export interface ScoutReportHistoryEntry {
  reportId: string;
  createdDate: string;
  scoutDisplayName: string;
  /** Knowledge-gated ranges as resolved at this report's own knowledge level (optional for callers without them). */
  abilityRange?: StarRange;
  valueRange?: { min: number; max: number } | null;
  knowledgePct?: number;
}

const rangeText = (r: { min: number; max: number } | null | undefined, f: (n: number) => string) => !r ? "—" : r.min === r.max ? f(r.min) : `${f(r.min)} – ${f(r.max)}`;

export function ScoutReportPanel({
  view,
  history,
  hasOwnScout,
  onStartAssignment,
}: {
  view: ScoutReportView;
  history: readonly ScoutReportHistoryEntry[];
  /** Whether the manager's own club currently has any SCOUT-role staff at all -- gates whether "Scouta spelare" is offered, or an honest "no scout" message instead (Part 1: never invent a scout). */
  hasOwnScout: boolean;
  onStartAssignment?: () => void;
}) {
  useMoney(); // re-render every figure when the display currency changes
  const [compareId, setCompareId] = useState<string | null>(null);
  const latest = history[0];
  const older = compareId ? history.find((h) => h.reportId === compareId) : undefined;
  const valueScale = Math.max(1, view.marketValueRange?.max ?? 0, ...history.map((h) => h.valueRange?.max ?? 0));
  const stars = (n: number) => `${n} ★`;
  return (
    <section className="hm-panel game-scout-report sr-timeline" aria-label="Scoutingrapport">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Scoutingrapport</span>
        <span className="game-report-stamp">{history.length ? `${history.length} ${history.length === 1 ? "version" : "versioner"}` : "Första observation"}</span>
      </div>
      <div className="hm-panel-body sr-body">
        <div className="game-report-meta"><span className="hm-eyebrow">{KNOWLEDGE_TIER_LABEL_SV[view.tier]}</span>{latest && <span>Senast {latest.createdDate} · {latest.scoutDisplayName}</span>}</div>
        <div className="hm-range-stack">
          <StarRangeBar label="Nivå nu" range={view.visibility.abilityRange} />
          <ValueRangeBar label="Värde nu" range={view.marketValueRange} scaleMax={valueScale} format={(n) => formatMoney(n)} />
        </div>
        <div className="sr-facts"><span>Scoutingens tillförlitlighet</span><b>{view.confidencePct}%</b></div>
        <div className="game-report-recommendation"><div className="hm-eyebrow">Rekommendation</div><p>{view.recommendation}</p></div>
        <div className="game-report-attributes"><div><div className="hm-eyebrow">Styrkor</div>{view.visibility.strengths?.length ? <ul>{view.visibility.strengths.map(s => <li key={s}>{s}</li>)}</ul> : <p>Ännu inte tillräcklig kännedom.</p>}</div><div><div className="hm-eyebrow">Svagheter</div>{view.visibility.weaknesses?.length ? <ul>{view.visibility.weaknesses.map(s => <li key={s}>{s}</li>)}</ul> : <p>Ännu inte tillräcklig kännedom.</p>}</div></div>

        <div className="hm-eyebrow">Rapporthistorik</div>
        {history.length === 0 ? (
          <p className="sr-empty">Ingen scoutingrapport ännu. Intervallen ovan bygger på det klubben vet utan scouting.</p>
        ) : (
          <ol className="sr-versions">
            {history.map((entry, i) => (
              <li key={entry.reportId} data-latest={i === 0}>
                <button type="button" className="sr-version" aria-pressed={i === 0 ? undefined : compareId === entry.reportId} disabled={i === 0}
                  onClick={() => setCompareId(compareId === entry.reportId ? null : entry.reportId)}
                  aria-label={i === 0 ? `Senaste rapporten ${entry.createdDate}` : `Jämför rapporten ${entry.createdDate} med den senaste`}>
                  <span className="sr-version-head"><b>{entry.createdDate}</b><span>{entry.scoutDisplayName}</span>{i === 0 ? <small>Senaste</small> : <small>Jämför</small>}</span>
                  {entry.abilityRange && <StarRangeBar label="Nivå" range={entry.abilityRange} />}
                  {entry.valueRange !== undefined && <ValueRangeBar label="Värde" range={entry.valueRange} scaleMax={valueScale} format={(n) => formatMoney(n, { compact: true })} />}
                </button>
              </li>
            ))}
          </ol>
        )}
        {older && latest && (
          <p className="sr-compare" role="status">
            {older.createdDate} → {latest.createdDate}: nivå {rangeText(older.abilityRange, stars)} → {rangeText(latest.abilityRange, stars)} · värde {rangeText(older.valueRange, (n) => formatMoney(n, { compact: true }))} → {rangeText(latest.valueRange, (n) => formatMoney(n, { compact: true }))}
            {older.knowledgePct != null && latest.knowledgePct != null ? ` · kännedom ${Math.round(older.knowledgePct)} % → ${Math.round(latest.knowledgePct)} %` : ""}
          </p>
        )}

        {hasOwnScout ? (
          onStartAssignment ? (
            <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={onStartAssignment}>
              Scouta spelare
            </button>
          ) : null
        ) : (
          <p className="sr-empty">Din klubb har ingen scout anställd -- kan inte starta ny bevakning.</p>
        )}
      </div>
    </section>
  );
}
