"use client";
// Arena Nights 231 -- the budget waterfall (REC-03 A header, REC-04 A impact panel): transferram -> bundet ->
// kvar, plus lönerum. When a deal is being considered its up-front cost is drawn on top of what is left, so
// the consequence is visible before committing. Every figure comes from lib/transfers/transferDesk.ts.
import { formatMoney } from "@/lib/economy/currency";
import type { BudgetWaterfall as Waterfall } from "@/lib/transfers/transferDesk";

const pct = (part: number, whole: number) => `${Math.max(0, Math.min(100, whole > 0 ? (part / whole) * 100 : 0))}%`;

export function BudgetWaterfall({ w, compact, pendingLabel = "Den här affären" }: { w: Waterfall | null; compact?: boolean; pendingLabel?: string }) {
  if (!w) return <div className="tx-budget" data-empty="true"><p className="tx-muted">Klubbens budget kunde inte läsas in.</p></div>;
  const over = w.pendingEur > 0 && w.afterPendingEur < 0;
  const wageOver = w.wageRoomAfterEurPerMonth < 0;
  const frame = Math.max(w.frameEur, w.committedEur + w.pendingEur);
  return (
    <div className="tx-budget" data-compact={compact || undefined} data-over={over || undefined}>
      <div className="tx-budget-bar" role="img" aria-label={`Transferram ${formatMoney(w.frameEur)}: ${formatMoney(w.committedEur)} bundet, ${formatMoney(w.remainingEur)} kvar${w.pendingEur ? `, ${pendingLabel.toLowerCase()} ${formatMoney(w.pendingEur)}` : ""}`}>
        <i data-k="committed" style={{ width: pct(w.committedEur, frame) }} />
        <i data-k="pending" style={{ width: pct(Math.min(w.pendingEur, Math.max(0, w.remainingEur)), frame) }} />
        {over && <i data-k="over" style={{ width: pct(w.pendingEur - Math.max(0, w.remainingEur), frame) }} />}
      </div>
      <dl className="tx-budget-steps">
        <div><dt>Transferram</dt><dd>{formatMoney(w.frameEur)}</dd></div>
        <div data-k="committed"><dt>Bundet</dt><dd>{w.committedEur > 0 ? `− ${formatMoney(w.committedEur)}` : formatMoney(0)}</dd></div>
        {w.pendingEur > 0 && <div data-k="pending"><dt>{pendingLabel}</dt><dd>− {formatMoney(w.pendingEur)}</dd></div>}
        <div data-k="left" data-tone={over ? "neg" : undefined}><dt>{w.pendingEur > 0 ? "Kvar efter" : "Kvar att buda med"}</dt><dd>{formatMoney(w.pendingEur > 0 ? w.afterPendingEur : w.remainingEur)}</dd></div>
        <div data-k="wage" data-tone={wageOver ? "neg" : undefined}><dt>{w.pendingWageEurPerMonth > 0 ? "Lönerum efter" : "Lönerum"}</dt><dd>{formatMoney(w.pendingWageEurPerMonth > 0 ? w.wageRoomAfterEurPerMonth : w.wageRoomEurPerMonth)}<small>/mån</small></dd></div>
        {!compact && <div data-k="cash"><dt>Kassa</dt><dd>{formatMoney(w.cashEur)}</dd></div>}
      </dl>
      {over && <p className="tx-warn-line" role="note">Affären kostar mer än det som finns kvar i transferbudgeten -- budet stoppas.</p>}
      {!over && wageOver && w.pendingWageEurPerMonth > 0 && <p className="tx-warn-line" role="note">Lönen spräcker styrelsens lönebudget.</p>}
    </div>
  );
}
