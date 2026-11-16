"use client";
// Arena Nights 231 -- REC-03 A / REC-03b A: the canonical market table. One table for every saved view
// (Möjligheter / Hela marknaden / Kortlista); knowledge-gated ability and value RANGES only. Arrow keys move
// the selection (and the Deal Panel follows); a checkbox column feeds the bulk "Kortlista" action. On phones
// the same rows render as ranked cards. Rows come from lib/transfers/transferDesk.ts#buildMarketTable.
import { useRef, type KeyboardEvent } from "react";
import { PlayerCell, PlayerGlyph } from "@/components/game/Identity";
import { StarBand } from "@/components/recruitment/PipelineBoard";
import { formatMoney } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/economy/labels";
import { getClub, positionLabel } from "@/lib/game-data";
import type { MarketRow } from "@/lib/transfers/transferDesk";
import type { NegotiationSummary } from "@/lib/transfers/transferCentre";

export function valueLabel(value: MarketRow["value"]): string {
  if (!value) return "—";
  return value.min === value.max ? formatMoney(value.min) : `${formatMoney(value.min)} – ${formatMoney(value.max)}`;
}

export function interestTone(tone: MarketRow["interest"]["tone"]): string {
  return tone === "positive" ? "done" : tone === "caution" ? "wait" : tone === "negative" ? "closed" : "neutral";
}

export function NegotiationPill({ summary }: { summary?: NegotiationSummary | null }) {
  if (!summary) return null;
  const tone = summary.nextStep === "YOUR_MOVE" ? "move" : summary.nextStep === "WAITING" ? "wait" : summary.nextStep === "COMPLETED" ? "done" : "closed";
  const label = summary.nextStep === "YOUR_MOVE" ? "Ditt drag" : summary.nextStep === "WAITING" ? "Väntar svar" : summary.nextStep === "COMPLETED" ? "Klar" : "Avslutad";
  return <span className="tx-pill" data-tone={tone}>{label}</span>;
}

function clubShort(clubId: string): string {
  return clubId ? getClub(clubId)?.shortName ?? clubId : "Fri agent";
}

function StatusCell({ row }: { row: MarketRow }) {
  if (row.negotiation) return <NegotiationPill summary={row.negotiation} />;
  if (row.shortlisted) return <span className="tx-pill" data-tone="kort">Kortlista</span>;
  return <span className="tx-muted">—</span>;
}

export function MarketTable({ rows, selectedId, onSelect, picked, onPick, showWhy, caption }: {
  rows: MarketRow[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
  /** Bulk Kortlista selection. */
  picked: ReadonlySet<string>;
  onPick: (playerId: string, on: boolean) => void;
  showWhy?: boolean;
  caption: string;
}) {
  const body = useRef<HTMLTableSectionElement>(null);
  const move = (e: KeyboardEvent<HTMLElement>, index: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (e.key === "Enter" || e.key === " ") { onSelect(rows[index]!.player.id); return; }
    const next = Math.max(0, Math.min(rows.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
    onSelect(rows[next]!.player.id);
    (body.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]")[next])?.focus();
  };
  const selectedInRows = rows.some((r) => r.player.id === selectedId);
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.player.id) || r.shortlisted);

  return (
    <>
      <div className="tx-table" role="region" aria-label={caption} tabIndex={-1}>
        <table className="hm-table">
          <caption className="tx-sr">{caption}. Piltangenterna flyttar markeringen.</caption>
          <thead>
            <tr>
              <th className="tx-col-pick"><input type="checkbox" aria-label="Markera alla rader för Kortlista" checked={allPicked} onChange={(e) => rows.forEach((r) => !r.shortlisted && onPick(r.player.id, e.target.checked))} /></th>
              <th>Spelare</th><th>Pos</th><th className="hm-table-num">Ålder</th><th>Klubb</th><th>Kontrakt till</th><th>Förmåga</th><th className="hm-table-num">Värde</th><th>Intresse</th><th>Status</th>
            </tr>
          </thead>
          <tbody ref={body}>
            {rows.map((row, i) => {
              const p = row.player;
              const selected = selectedId === p.id;
              return (
                <tr key={p.id} data-row="true" data-selected={selected} data-need={row.needLevel} aria-selected={selected} tabIndex={selected || (!selectedInRows && i === 0) ? 0 : -1}
                  onClick={() => onSelect(p.id)} onKeyDown={(e) => move(e, i)}>
                  <td className="tx-col-pick" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Markera ${p.firstName} ${p.lastName} för Kortlista`} disabled={row.shortlisted} checked={row.shortlisted || picked.has(p.id)} onChange={(e) => onPick(p.id, e.target.checked)} />
                  </td>
                  <td className="hm-td-strong"><PlayerCell player={p} />{showWhy && row.why && <div className="tx-why">{row.why}</div>}</td>
                  <td title={positionLabel(p.position)}><span className="tx-pos" data-need={row.needLevel}>{p.position}</span></td>
                  <td className="hm-table-num">{row.age ?? "–"}</td>
                  <td className="tx-muted">{clubShort(row.clubId)}</td>
                  <td>{row.contractStatus === "FREE_AGENT" ? <span className="hm-badge hm-badge-positive">Kontraktslös</span> : row.contractEnd ? <span className={row.contractStatus ? `tx-contract hm-badge hm-badge-${CONTRACT_STATUS_TONE[row.contractStatus]}` : "tx-contract"} title={row.contractStatus ? CONTRACT_STATUS_LABEL[row.contractStatus] : undefined}>{row.contractEnd}</span> : "—"}</td>
                  <td><StarBand range={row.ability} label="Förmåga" /></td>
                  <td className="hm-table-num tx-num">{valueLabel(row.value)}</td>
                  <td><span className="tx-pill" data-tone={interestTone(row.interest.tone)}>{row.interest.label}</span></td>
                  <td><StatusCell row={row} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ol className="tx-cards" aria-label={caption}>
        {rows.map((row, i) => {
          const p = row.player;
          const selected = selectedId === p.id;
          return (
            <li key={p.id} data-selected={selected} data-need={row.needLevel}>
              <button type="button" className="tx-card-main" aria-pressed={selected} onClick={() => onSelect(p.id)}>
                <span className="tx-card-rank">{i + 1}</span>
                <PlayerGlyph player={p} size={36} />
                <span className="tx-card-who">
                  <strong>{p.firstName} {p.lastName}</strong>
                  <small>{p.position} · {row.age ?? "–"} år · {clubShort(row.clubId)}{row.contractEnd ? ` · t.o.m. ${row.contractEnd}` : ""}</small>
                  {row.why && <small className="tx-why">{row.why}</small>}
                </span>
                <span className="tx-card-value">
                  <b className="tx-num">{valueLabel(row.value)}</b>
                  <span className="tx-pill" data-tone={interestTone(row.interest.tone)}>{row.interest.label}</span>
                </span>
              </button>
              <label className="tx-card-pick"><input type="checkbox" disabled={row.shortlisted} checked={row.shortlisted || picked.has(p.id)} onChange={(e) => onPick(p.id, e.target.checked)} /><span>{row.shortlisted ? "På Kortlista" : "Markera"}</span></label>
            </li>
          );
        })}
      </ol>
    </>
  );
}
