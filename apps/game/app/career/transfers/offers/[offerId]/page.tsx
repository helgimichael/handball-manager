"use client";
// HM-ALPHA3-M05: the incoming-offer room -- the Negotiation Room mirrored.
// Another club wants one of the manager's players: who, why, how much, what
// the sale means for the cash and the squad, and the manager's answer.
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import MoneyInput from "@/components/MoneyInput";
import { ClubLink } from "@/components/entityLinks";
import { PlayerGlyph } from "@/components/game/Identity";
import { DecisionCard, MomentHero } from "@/components/experience/Moment";
import { PageHeading } from "@/components/manager/Workspace";
import { DEPARTURE_BACKDROP } from "@/components/players/playerVisuals";
import { NEGOTIATION_ROOM_BACKDROP } from "@/components/transfers/transferVisuals";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad, getCareerPlayer } from "@/lib/career/careerWorld";
import { currencySymbol } from "@/lib/economy/currency";
import { getClub, positionLabel } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { dynamicsOf } from "@/lib/players/dynamicsState";
import { acceptIncomingOffer, counterIncomingOffer, rejectIncomingOffer } from "@/lib/players/market";
import { moraleOf } from "@/lib/players/morale";
import { activePromises } from "@/lib/players/promises";

const STATUS_LABEL: Record<string, string> = { OPEN: "Väntar på ditt svar", COUNTERED: "Ditt motbud ligger hos köparen", ACCEPTED: "Klubbarna är överens", AWAITING_WINDOW: "Klar – går igenom när fönstret öppnar", COMPLETED: "Såld", REJECTED: "Avvisat", WITHDRAWN: "Köparen drog sig ur", PLAYER_REFUSED: "Spelaren sa nej", EXPIRED: "Gick ut utan svar" };

export default function IncomingOfferPage() {
  const params = useParams<{ offerId: string }>();
  const offerId = decodeURIComponent(params.offerId);
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const offer = career.incomingOffers?.[offerId];
  const [ask, setAsk] = useState<number>(offer ? Math.round(offer.feeEur * 1.25) : 0);
  const [message, setMessage] = useState<string | null>(null);
  if (!offer) return <div className="hm-panel"><div className="hm-panel-body hm-text-muted">Budet hittades inte.</div></div>;
  const player = getCareerPlayer(career, offer.playerId);
  const buyer = getClub(offer.fromClubId);
  const me = career.playerClubId;
  const name = player ? `${player.firstName} ${player.lastName}` : offer.playerId;
  const cash = career.clubEconomies[me]?.cashEur ?? 0;
  const samePos = player ? getCareerClubSquad(career, me).filter((p) => p.position === player.position && p.id !== player.id).length : 0;
  const notSell = activePromises(career, offer.playerId).some((p) => p.kind === "NOT_SELL");
  const request = dynamicsOf(career).requests[offer.playerId];
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); } };
  const open = offer.status === "OPEN";
  const departure = dynamicsOf(career).departures.find((d) => d.playerId === offer.playerId && d.kind === "SALE");

  return (
    <div className="game-transfers-page pd-offer-page">
      <PageHeading eyebrow="Transfers / inkommande bud" title="Bud på din spelare" description="Köparen svarar dagen efter ett motbud. Spelaren har sista ordet om flytten." actions={<Link className="hm-btn" href="/career/transfers">← Transfers</Link>} />
      {offer.status === "COMPLETED" && departure ? (
        <MomentHero kind="ANNOUNCEMENT" tone="ink" backdrop={{ kind: "photo", style: DEPARTURE_BACKDROP }} tags={[offer.closedOn ?? "", offer.foreign ? "Lämnar för utlandet" : "Inrikes övergång"]} stamp="Såld" headline={`${name} lämnar för ${buyer?.shortName ?? offer.fromClubId}`} lede={`${money.format(offer.feeEur)} är bokfört i Ekonomi.${samePos <= 1 ? ` Du har ${samePos} kvar på positionen.` : ""}`} />
      ) : (
        <header className="tc-room-hero tc-photo-hero" style={NEGOTIATION_ROOM_BACKDROP}>
          <div className="tc-room-identity">
            {player && <PlayerGlyph player={player} size={92} />}
            <div>
              <div className="tc-hero-tags"><span className="tc-tag" data-tone="permanent">{offer.foreign ? "Bud från utlandet" : "Inkommande bud"}</span>{player && <span>{positionLabel(player.position)}</span>}</div>
              <h1>{player?.firstName} <b>{player?.lastName}</b></h1>
              <div className="tc-route"><ClubLink clubId={me}>{getClub(me)?.shortName}</ClubLink><span className="tc-route-arrow" aria-hidden="true" /><ClubLink clubId={offer.fromClubId}>{buyer?.shortName ?? offer.fromClubId}</ClubLink></div>
            </div>
          </div>
          <div className="tc-hero-side"><div className="pd-offer-fee"><small>{STATUS_LABEL[offer.status]}</small><b>{money.format(offer.feeEur)}</b><span>{open ? `Svara senast ${offer.respondBy}` : offer.completesOn ? `Går igenom ${offer.completesOn}` : offer.closedOn ?? ""}</span></div></div>
        </header>
      )}

      <div className="pd-offer-grid">
        <section className="pd-panel" aria-label="Budet">
          <h3>Varför de vill ha honom</h3>
          <p>{offer.motive}</p>
          <dl className="pd-demand">
            <div><dt>Bud</dt><dd>{money.format(offer.feeEur)}</dd></div>
            <div><dt>Lön de erbjuder honom</dt><dd>{money.format(offer.wageEurPerMonth)} / mån</dd></div>
            <div><dt>Avtal</dt><dd>{offer.contractYears} år</dd></div>
          </dl>
          <h4>Budgivningen</h4>
          <ol className="pd-rounds">{offer.rounds.map((r, i) => <li key={i} data-by={r.by}><time>{r.date}</time><b>{r.by === "BUYER" ? buyer?.shortName ?? "Köparen" : "Du"}</b><span>{money.format(r.feeEur)}</span><small>{r.note}</small></li>)}</ol>
          {offer.playerStance && <blockquote className="tc-stance" data-response={offer.playerStance.willing ? "ACCEPT" : "REJECT"}>{offer.playerStance.reason}</blockquote>}
        </section>

        <aside className="pd-panel" aria-label="Vad en försäljning innebär">
          {/* A completed sale is already in the cash: show what was booked, never add the fee again. */}
          <h3>{offer.status === "COMPLETED" ? "Försäljningen" : "Om du säljer"}</h3>
          <dl className="pd-demand">
            {offer.status === "COMPLETED" ? <div><dt>Inbokat i kassan</dt><dd>{money.format(offer.feeEur)}</dd></div> : <div><dt>Kassan efter</dt><dd>{money.format(cash + offer.feeEur)}</dd></div>}
            <div><dt>Kvar på positionen</dt><dd>{samePos}</dd></div>
            <div><dt>Hans moral</dt><dd>{moraleOf(career, offer.playerId)} %</dd></div>
          </dl>
          {request?.status === "OPEN" || request?.status === "ACCEPTED" ? <p className="pd-note">Han har bett att få lämna. Avvisar du ett bra bud blir han ännu mer missnöjd.</p> : <p className="pd-note">Han har inte bett att få gå. Han bestämmer själv när klubbarna är överens.</p>}
          {notSell && <p className="pd-note" data-tone="loss">Du har lovat att inte sälja honom. En försäljning bryter löftet.</p>}
          {open && (
            <DecisionCard tone="gold" title="Ditt svar" primary={{ label: "Acceptera budet", consequence: `${money.format(offer.feeEur)} till kassan om spelaren säger ja`, onSelect: () => run(() => updateCareer((s) => acceptIncomingOffer(s, offer.id)), "Du accepterade budet.") }} secondary={<button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => rejectIncomingOffer(s, offer.id)), "Budet är avvisat.")}>Avvisa</button>}>
              <label className="pd-counter">Motbud ({currencySymbol()})<MoneyInput className="tc-input" minEur={offer.feeEur + 500} stepEur={500} valueEur={ask} onChangeEur={setAsk} /></label>
              <button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => counterIncomingOffer(s, offer.id, ask)), "Motbudet är skickat. Svar i morgon.")}>Skicka motbud</button>
            </DecisionCard>
          )}
          {message && <p className="pd-note" role="status">{message}</p>}
        </aside>
      </div>
    </div>
  );
}
