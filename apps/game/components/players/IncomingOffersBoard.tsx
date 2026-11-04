"use client";
// HM-ALPHA3-M05: the selling side of the Transfer Centre -- bids for your
// players, your transfer list, players who want to leave and recent
// departures.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { dynamicsOf } from "@/lib/players/dynamicsState";

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
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={22} /> : null;
}

export function IncomingOffersBoard() {
  const money = useMoney();
  const { career } = useCareer();
  const d = dynamicsOf(career);
  // HM-ALPHA3-M10: only players still under contract here (one who left at the end of his contract stayed listed).
  const ours = (id: string) => career.playerContracts[id]?.clubId === career.playerClubId;
  const live = Object.values(career.incomingOffers ?? {}).filter((o) => STATUS[o.status] && (ours(o.playerId) || o.status === "COMPLETED")).sort((a, b) => a.respondBy.localeCompare(b.respondBy));
  const listings = Object.values(d.listings).filter((l) => ours(l.playerId));
  const requests = Object.values(d.requests).filter((r) => r.status === "OPEN" && ours(r.playerId));
  const departures = [...d.departures].reverse().slice(0, 5);
  const preContracts = Object.values(career.preContracts ?? {});
  const name = (id: string) => { const p = getCareerPlayer(career, id); return p ? `${p.firstName} ${p.lastName}` : id; };
  if (!live.length && !listings.length && !requests.length && !departures.length && !preContracts.length) {
    return <section className="tc-panel pd-board" aria-label="Försäljning"><header><span className="xp-eyebrow">Försäljning</span><h2>Inga bud just nu</h2></header><p className="pd-note">Andra klubbar hör av sig när en spelare är transferlistad, vill lämna, har kort avtal kvar eller är tillräckligt bra. Bud kommer oftast när fönstret är öppet.</p></section>;
  }
  return (
    <section className="tc-panel pd-board" aria-label="Försäljning">
      <header><span className="xp-eyebrow">Försäljning</span><h2>Bud och avgångar</h2></header>
      {live.length > 0 && (
        <ul className="pd-bids">{live.map((o) => (
          <li key={o.id} data-status={o.status}>
            <Crest clubId={o.fromClubId} />
            <div><b>{name(o.playerId)}</b><small>{getClub(o.fromClubId)?.shortName ?? o.fromClubId}{o.foreign ? " · utlandet" : ""} · {STATUS[o.status]}</small></div>
            <strong>{money.format(o.feeEur)}</strong>
            <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/transfers/offers/${encodeURIComponent(o.id)}`}>{o.status === "OPEN" ? `Svara före ${o.respondBy}` : "Öppna"}</Link>
          </li>
        ))}</ul>
      )}
      <div className="pd-board-grid">
        {requests.length > 0 && <div><h4>Vill lämna</h4><ul>{requests.map((r) => <li key={r.playerId}><Link href={`/career/squad/${encodeURIComponent(r.playerId)}`}>{name(r.playerId)}</Link><small>{r.reason}</small></li>)}</ul></div>}
        {listings.length > 0 && <div><h4>Transferlistan</h4><ul>{listings.map((l) => <li key={l.playerId}><Link href={`/career/squad/${encodeURIComponent(l.playerId)}`}>{name(l.playerId)}</Link><small>{money.format(l.askingEur, { compact: true })} · {l.reason === "TRANSFER_REQUEST" ? "på egen begäran" : "listad av dig"}</small></li>)}</ul></div>}
        {preContracts.length > 0 && <div><h4>Förhandsavtal</h4><ul>{preContracts.map((p) => <li key={p.playerId}><Link href={`/career/squad/${encodeURIComponent(p.playerId)}`}>{name(p.playerId)}</Link><small>till {getClub(p.toClubId)?.shortName ?? p.toClubId} {p.effectiveOn}</small></li>)}</ul></div>}
        {departures.length > 0 && <div><h4>Senaste avgångar</h4><ul>{departures.map((dep) => <li key={`${dep.playerId}-${dep.date}`}><span>{dep.playerName}</span><small>{dep.date} · {dep.kind === "SALE" ? `såld för ${money.format(dep.feeEur, { compact: true })}` : dep.kind === "RELEASE" ? `avtal brutet (${money.format(dep.costEur ?? 0, { compact: true })})` : dep.kind === "PRE_CONTRACT" ? "förhandsavtal" : "kontraktslös"}{dep.toClubId ? ` → ${getClub(dep.toClubId)?.shortName ?? dep.toClubId}` : ""}</small></li>)}</ul></div>}
      </div>
    </section>
  );
}
