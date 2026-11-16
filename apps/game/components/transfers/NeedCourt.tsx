"use client";
// Arena Nights 231 -- REC-03d B: Truppbehov drawn on a mini court. Each position is coloured by the squad's
// real need assessment (the same one CPU clubs recruit from); clicking a zone filters the market to it.
// On phones the court collapses to a compact chip row.
import type { HandballPosition } from "@/lib/game-data";
import type { PositionNeedView } from "@/lib/transfers/transferCentre";

const SPOT: Record<HandballPosition, { x: number; y: number }> = { V6: { x: 9, y: 70 }, V9: { x: 25, y: 32 }, M9: { x: 50, y: 20 }, H9: { x: 75, y: 32 }, H6: { x: 91, y: 70 }, M6: { x: 50, y: 58 }, MV: { x: 50, y: 90 } };
const NEED_LABEL = { HIGH: "Akut behov", MEDIUM: "Behov", LOW: "Täckt", NONE: "Full" } as const;

export function NeedCourt({ needs, selected, onSelect }: { needs: PositionNeedView[]; selected: HandballPosition | "ALL"; onSelect: (pos: HandballPosition | "ALL") => void }) {
  const toggle = (pos: HandballPosition) => onSelect(selected === pos ? "ALL" : pos);
  const urgent = needs.filter((n) => n.level === "HIGH").map((n) => n.position);
  return (
    <div className="tx-court-wrap">
      <div className="tx-court" role="group" aria-label="Truppbehov per position -- välj en position för att filtrera marknaden">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="99" height="99" className="tx-court-frame" />
          <path d="M 20 100 A 30 30 0 0 1 80 100" className="tx-court-line" />
          <path d="M 5 100 A 45 48 0 0 1 95 100" className="tx-court-line" data-dashed="true" />
        </svg>
        {needs.map((n) => (
          <button key={n.position} type="button" className="tx-court-spot" data-level={n.level} aria-pressed={selected === n.position}
            style={{ left: `${SPOT[n.position].x}%`, top: `${SPOT[n.position].y}%` }}
            title={n.reason}
            aria-label={`${n.position}: ${n.projectedDepth} spelare, ${NEED_LABEL[n.level].toLowerCase()}. ${n.reason}`}
            onClick={() => toggle(n.position)}>
            <b>{n.position}</b><span>{n.projectedDepth}</span>
          </button>
        ))}
      </div>
      <div className="tx-court-chips" role="group" aria-label="Truppbehov per position">
        {needs.map((n) => (
          <button key={n.position} type="button" className="tx-court-chip" data-level={n.level} aria-pressed={selected === n.position} onClick={() => toggle(n.position)}>
            {n.position}<span>{n.projectedDepth}</span>
          </button>
        ))}
      </div>
      <p className="tx-court-note">{urgent.length ? `Akut: ${urgent.join(", ")}.` : "Inga akuta luckor."} Siffran är spelare på positionen inkl. överenskomna ankomster. Välj en position för att filtrera.</p>
    </div>
  );
}
