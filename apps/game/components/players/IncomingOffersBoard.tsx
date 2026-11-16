"use client";
// HM-ALPHA3-M05 / Arena Nights 231 REC-03a A "Sälj mode": the selling side of the Transfer Centre. Bids for
// your players sorted by respond-by date (answer-first), each with the fee against your own valuation and a
// squad-impact chip from the real position depth; then the four mini-lists (Vill lämna, Transferlistan,
// Förhandsavtal, Senaste avgångar) as compact columns -- accordions on phones. Opening a bid goes to REC-05.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { dynamicsOf } from "@/lib/players/dynamicsState";
import { sellBids, type SellImpact } from "@/lib/transfers/transferDesk";

const STATUS: Record<string, string> = {
  OPEN: "Väntar på ditt svar",
  OFFER_RECEIVED: "Väntar på ditt svar",
  COUNTERED: "Motbud skickat",
  COUNTEROFFER_SUBMITTED: "Motbud skickat",
  CLUBS_AGREED: "Klubbarna är överens",
  PLAYER_NEGOTIATING: "Spelarförhandling",
  AWAITING_FINAL_APPROVAL: "Slutgiltigt godkännande",
  AWAITING_WINDOW: "Klar till fönstret",
  ACCEPTED: "Överens",
  COMPLETED: "Klar",
};

function Crest({ clubId }: { clubId: string }) {
  const c = getClub(clubId);
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={28} /> : <span className="tc-party-mark" aria-hidden="true">?</span>;
}

export function ImpactChip({ impact }: { impact: SellImpact | null }) {
  if (!impact) return null;
  const label = impact.tone === "gap" ? `Lucka på ${impact.position}` : impact.tone === "thin" ? `Tunt på ${impact.position}` : `${impact.position} täckt`;
  return <span className="tx-impact-chip" data-tone={impact.tone} title={`Efter en försäljning: ${impact.after.available} spelbara av ${impact.after.total} på positionen (i dag ${impact.before.available}).`}>{label} · {impact.before.available}→{impact.after.available}</span>;
}

export function IncomingOffersBoard() {
  const money = useMoney();
  const { career } = useCareer();
  const d = dynamicsOf(career);
  // HM-ALPHA3-M10: only players still under contract here (one who left at the end of his contract stayed listed).
  const ours = (id: string) => career.playerContracts[id]?.clubId === career.playerClubId;
  const bids = sellBids(career);
  const listings = Object.values(d.listings).filter((l) => ours(l.playerId));
  const requests = Object.values(d.requests).filter((r) => r.status === "OPEN" && ours(r.playerId));
  const departures = [...d.departures].reverse().slice(0, 5);
  const preContracts = Object.values(career.preContracts ?? {});
  const name = (id: string) => { const p = getCareerPlayer(career, id); return p ? `${p.firstName} ${p.lastName}` : id; };
  const waiting = bids.filter((b) => b.needsAnswer).length;

  return (
    <section className="tx-sell" aria-label="Försäljning">
      <header className="tx-sell-head">
        <div><span className="tc-eyebrow">Sälj</span><h2>{bids.length === 0 ? "Inga bud just nu" : waiting > 0 ? `${waiting} bud väntar på ditt svar` : "Bud och avgångar"}</h2></div>
        <p className="tx-muted">{bids.length === 0 ? "Andra klubbar hör av sig när en spelare är transferlistad, vill lämna, har kort avtal kvar eller är tillräckligt bra. Bud kommer oftast när fönstret är öppet." : "Sorterat efter när du senast måste svara. Värdet är klubbens egen värdering av spelaren."}</p>
      </header>

      {bids.length > 0 && (
        <ol className="tx-bids">
          {bids.map((b) => {
            const o = b.offer;
            const late = b.needsAnswer && b.daysLeft <= 1;
            return (
              <li key={o.id} data-status={o.status} data-answer={b.needsAnswer || undefined} data-late={late || undefined}>
                <Crest clubId={o.fromClubId} />
                <div className="tx-bid-who">
                  <b>{b.playerName}{b.position ? <small> · {b.position}</small> : null}</b>
                  <small>{getClub(o.fromClubId)?.shortName ?? o.fromClubId}{o.foreign ? " · utlandet" : ""} · {STATUS[o.status] ?? o.status}</small>
                </div>
                <div className="tx-bid-fee">
                  <strong className="tx-num">{money.format(o.feeEur)}</strong>
                  {b.deltaEur !== null && <small className="tx-num" data-sign={b.deltaEur >= 0 ? "up" : "down"}>{b.deltaEur >= 0 ? "+" : "−"}{money.format(Math.abs(b.deltaEur), { compact: true })} mot värdet</small>}
                </div>
                <ImpactChip impact={b.impact} />
                <Link className={b.needsAnswer ? "hm-btn hm-btn-sm hm-btn-primary" : "hm-btn hm-btn-sm"} href={`/career/transfers/offers/${encodeURIComponent(o.id)}`}>
                  {b.needsAnswer ? (b.daysLeft <= 0 ? "Svara i dag" : `Svara före ${o.respondBy}`) : "Öppna"}
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <div className="tx-sell-lists">
        <details open><summary>Vill lämna <b>{requests.length}</b></summary>{requests.length ? <ul>{requests.map((r) => <li key={r.playerId}><Link href={`/career/squad/${encodeURIComponent(r.playerId)}`}>{name(r.playerId)}</Link><small>{r.reason}</small></li>)}</ul> : <p className="tx-muted">Ingen har bett att få lämna.</p>}</details>
        <details open><summary>Transferlistan <b>{listings.length}</b></summary>{listings.length ? <ul>{listings.map((l) => <li key={l.playerId}><Link href={`/career/squad/${encodeURIComponent(l.playerId)}`}>{name(l.playerId)}</Link><small>{money.format(l.askingEur, { compact: true })} · {l.reason === "TRANSFER_REQUEST" ? "på egen begäran" : "listad av dig"}</small></li>)}</ul> : <p className="tx-muted">Ingen är transferlistad. Lista en spelare från hans profil.</p>}</details>
        <details open><summary>Förhandsavtal <b>{preContracts.length}</b></summary>{preContracts.length ? <ul>{preContracts.map((p) => <li key={p.playerId}><Link href={`/career/squad/${encodeURIComponent(p.playerId)}`}>{name(p.playerId)}</Link><small>till {getClub(p.toClubId)?.shortName ?? p.toClubId} {p.effectiveOn}</small></li>)}</ul> : <p className="tx-muted">Inga förhandsavtal.</p>}</details>
        <details open><summary>Senaste avgångar <b>{departures.length}</b></summary>{departures.length ? <ul>{departures.map((dep) => <li key={`${dep.playerId}-${dep.date}`}><span>{dep.playerName}</span><small>{dep.date} · {dep.kind === "SALE" ? `såld för ${money.format(dep.feeEur, { compact: true })}` : dep.kind === "RELEASE" ? `avtal brutet (${money.format(dep.costEur ?? 0, { compact: true })})` : dep.kind === "PRE_CONTRACT" ? "förhandsavtal" : "kontraktslös"}{dep.toClubId ? ` → ${getClub(dep.toClubId)?.shortName ?? dep.toClubId}` : ""}</small></li>)}</ul> : <p className="tx-muted">Inga avgångar än.</p>}</details>
      </div>
    </section>
  );
}
