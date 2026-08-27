// HM-SCOUTING-1.0: the report VIEW for an external player's Player
// Profile -- the one place a finished scout report actually renders (no
// separate report detail page, see destinations.ts's own doc). Purely a
// presentation layer over lib/knowledge/scoutReportVisibility.ts's
// already-resolved ScoutReportView; never re-derives ability/potential/
// market-value gating itself.
import type { ScoutReportView } from "@/lib/knowledge/scoutReportVisibility";
import { KNOWLEDGE_TIER_LABEL_SV } from "@/lib/knowledge/types";
import { formatEur } from "@/lib/economy/currency";

export interface ScoutReportHistoryEntry {
  reportId: string;
  createdDate: string;
  scoutDisplayName: string;
}

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
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Scoutingrapport</span>
        <span className="hm-badge hm-badge-neutral">{KNOWLEDGE_TIER_LABEL_SV[view.tier]}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
          <span className="hm-text-muted">Uppskattat marknadsvärde</span>
          <span style={{ fontWeight: 700 }}>
            {view.marketValueRange ? (view.marketValueRange.min === view.marketValueRange.max ? formatEur(view.marketValueRange.min) : `${formatEur(view.marketValueRange.min)} – ${formatEur(view.marketValueRange.max)}`) : "—"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
          <span className="hm-text-muted">Scoutingens tillförlitlighet</span>
          <span style={{ fontWeight: 700 }}>{view.confidencePct}%</span>
        </div>
        <div className="hm-divider" />
        <div>
          <div className="hm-eyebrow" style={{ marginBottom: 4 }}>Rekommendation</div>
          <p style={{ fontSize: "var(--hm-text-xs)", margin: 0, lineHeight: 1.5 }}>{view.recommendation}</p>
        </div>

        <div className="hm-divider" />
        <div className="hm-eyebrow">Rapporthistorik</div>
        {history.length === 0 ? (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            Ingen scoutingrapport ännu.
          </p>
        ) : (
          history.map((entry) => (
            <div key={entry.reportId} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-2xs)" }}>
              <span className="hm-text-muted">{entry.scoutDisplayName}</span>
              <span style={{ fontWeight: 600 }}>{entry.createdDate}</span>
            </div>
          ))
        )}

        <div className="hm-divider" />
        {hasOwnScout ? (
          onStartAssignment ? (
            <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={onStartAssignment}>
              Scouta spelare
            </button>
          ) : null
        ) : (
          <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            Din klubb har ingen scout anställd -- kan inte starta ny bevakning.
          </p>
        )}
      </div>
    </div>
  );
}
