"use client";
// HM-ALPHA3-M05: the incoming-offer room -- the Negotiation Room mirrored.
// Arena Nights 231 REC-05 A "Sell decision sheet": money vs squad side by side (bid vs your valuation and the
// wage the sale frees; his position's depth before and after), then the bid itself and the decision with a
// counter slider and confirm steps. REC-05a A: a short floodlight farewell once the sale completes, with
// "Fyll luckan" into the market filtered to his position. Every action calls the same lib/players/market
// functions as before; nothing about the sale rules changes.
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import MoneyInput from "@/components/MoneyInput";
import { ClubLink } from "@/components/entityLinks";
import { PlayerGlyph } from "@/components/game/Identity";
import { DecisionCard, MomentHero } from "@/components/experience/Moment";
import { PageHeading } from "@/components/manager/Workspace";
import { DEPARTURE_BACKDROP } from "@/components/players/playerVisuals";
import { ImpactChip } from "@/components/players/IncomingOffersBoard";
import { FloodlightMoment, useMomentOnce } from "@/components/transfers/FloodlightMoment";
import { NEGOTIATION_ROOM_BACKDROP, weekdayDate } from "@/components/transfers/transferVisuals";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { currencySymbol } from "@/lib/economy/currency";
import { getClub, positionLabel } from "@/lib/game-data";
import { POSITION_NAME } from "@/lib/club/clubJournal";
import { useMoney } from "@/lib/settings/usePreferences";
import { dynamicsOf } from "@/lib/players/dynamicsState";
import { acceptIncomingOffer, confirmIncomingSale, counterIncomingOffer, rejectIncomingOffer, rejectIncomingSale, withdrawIncomingOffer } from "@/lib/players/market";
import { moraleOf } from "@/lib/players/morale";
import { activePromises } from "@/lib/players/promises";
import { getClubBudgets } from "@/lib/economy/clubEconomyIntegration";
import { deskHref, farewellFacts, saleMoney, sellImpact } from "@/lib/transfers/transferDesk";
import type { IncomingOffer } from "@/lib/players/types";
import type { CareerState } from "@/lib/career/types";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Väntar på ditt svar",
  OFFER_RECEIVED: "Väntar på ditt svar",
  COUNTERED: "Ditt motbud ligger hos köparen",
  COUNTEROFFER_SUBMITTED: "Ditt motbud ligger hos köparen",
  CLUBS_AGREED: "Klubbarna är överens",
  PLAYER_NEGOTIATING: "Spelaren förhandlar villkor",
  AWAITING_FINAL_APPROVAL: "Slutgiltigt godkännande krävs",
  ACCEPTED: "Klubbarna är överens",
  AWAITING_WINDOW: "Klar – går igenom när fönstret öppnar",
  COMPLETED: "Såld",
  REJECTED: "Avvisat",
  WITHDRAWN: "Avbruten / Tillbakadraget",
  PLAYER_REFUSED: "Spelaren sa nej",
  EXPIRED: "Gick ut utan svar"
};
const SELL_HREF = deskHref({ mode: "salj" });

export default function IncomingOfferPage() {
  const params = useParams<{ offerId: string }>();
  const offerId = decodeURIComponent(params.offerId);
  const { career } = useCareer();
  const offer = career.incomingOffers?.[offerId];
  if (!offer) {
    return (
      <div className="game-transfers-page pd-offer-page">
        <PageHeading eyebrow="Transfers / inkommande bud" title="Bud på din spelare" actions={<Link className="hm-btn" href={SELL_HREF}>← Sälj</Link>} />
        <section className="tx-state" data-tone="blocked"><h3>Budet hittades inte</h3><div className="tx-muted">Budet kan ha gått ut eller dragits tillbaka. Aktuella bud finns under Sälj i Transfer Centre.</div><div className="tx-wait-actions"><Link className="hm-btn hm-btn-primary" href={SELL_HREF}>Till Sälj →</Link></div></section>
      </div>
    );
  }
  return <OfferSheet key={offer.id} career={career} offer={offer} />;
}

function OfferSheet({ career, offer }: { career: CareerState; offer: IncomingOffer }) {
  const money = useMoney();
  const { updateCareer } = useCareer();
  const money$ = saleMoney(career, offer);
  const impact = sellImpact(career, offer.playerId);
  const counterMin = offer.feeEur + 500;
  const counterMax = Math.max(counterMin + 5000, Math.round(Math.max(offer.feeEur * 2, (money$.marketValueEur ?? 0) * 1.6) / 500) * 500);
  const [ask, setAsk] = useState<number>(Math.min(counterMax, Math.max(counterMin, Math.round(offer.feeEur * 1.25 / 500) * 500)));
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"accept" | "reject" | "confirm-sale" | "reject-sale" | null>(null);
  const [tab, setTab] = useState<"money" | "squad">("money");
  const player = getCareerPlayer(career, offer.playerId);
  const buyer = getClub(offer.fromClubId);
  const me = career.playerClubId;
  const name = player ? `${player.firstName} ${player.lastName}` : offer.playerId;
  const cash = career.clubEconomies[me]?.cashEur ?? 0;
  const notSell = activePromises(career, offer.playerId).some((p) => p.kind === "NOT_SELL");
  const request = dynamicsOf(career).requests[offer.playerId];
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); setConfirm(null); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); } };
  const open = offer.status === "OPEN" || offer.status === "OFFER_RECEIVED";
  const awaitingApproval = offer.status === "AWAITING_FINAL_APPROVAL";
  const completed = offer.status === "COMPLETED";
  const departure = dynamicsOf(career).departures.find((d) => d.playerId === offer.playerId && d.kind === "SALE");
  const budgets = getClubBudgets(career, me);
  const bye = farewellFacts(career, offer);
  const [moment, closeMoment] = useMomentOnce(`sold:${offer.id}`);
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - offer.feeEur) / Math.max(1, counterMax - offer.feeEur)) * 100))}%`;

  return (
    <div className="game-transfers-page pd-offer-page tx-offer">
      <PageHeading eyebrow="Transfers / inkommande bud" title="Bud på din spelare" description="Köparen svarar dagen efter ett motbud. Spelaren har sista ordet om flytten." actions={<Link className="hm-btn" href={SELL_HREF}>← Sälj</Link>} />

      {completed && departure && moment && (
        <FloodlightMoment
          label={`Tack, ${bye.name}`}
          tone="farewell"
          eyebrow={`Såld till ${buyer?.shortName ?? offer.fromClubId}`}
          headline={`Tack, ${bye.name}`}
          media={player ? <PlayerGlyph player={player} size={64} /> : undefined}
          terms={[
            ...(bye.seasonsAtClub !== null ? [{ label: "Säsonger i klubben", value: String(bye.seasonsAtClub) }] : []),
            { label: "Matcher / mål i år", value: `${bye.appearances} / ${bye.goals}` },
            { label: "Övergångssumma", value: money.format(bye.feeEur) },
          ]}
          actions={<>
            <Link className="hm-btn hm-btn-primary tc-cta" href={bye.fillGapHref} onClick={closeMoment}>Fyll luckan{bye.position ? ` på ${bye.position}` : ""} →</Link>
            <Link className="hm-btn" href={SELL_HREF} onClick={closeMoment}>Till Sälj</Link>
          </>}
          onClose={closeMoment}
        />
      )}

      {completed && departure ? (
        <MomentHero kind="ANNOUNCEMENT" tone="ink" backdrop={{ kind: "photo", style: DEPARTURE_BACKDROP }} tags={[offer.closedOn ?? "", offer.foreign ? "Lämnar för utlandet" : "Inrikes övergång"]} stamp="Såld" headline={`Tack, ${name}`} lede={`${money.format(offer.feeEur)} är bokfört i Ekonomi.${bye.seasonsAtClub !== null ? ` ${bye.seasonsAtClub} säsong${bye.seasonsAtClub > 1 ? "er" : ""} i klubben.` : ""} I år: ${bye.appearances} matcher, ${bye.goals} mål.`} />
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
          <div className="tc-hero-side"><div className="pd-offer-fee"><small>{STATUS_LABEL[offer.status] ?? offer.status}</small><b>{money.format(offer.feeEur)}</b><span>{open ? `Svara senast ${weekdayDate(offer.respondBy)}` : awaitingApproval ? "Kräver ditt godkännande" : offer.completesOn ? `Går igenom ${offer.completesOn}` : offer.closedOn ?? ""}</span></div></div>
        </header>
      )}

      {completed && departure && (
        <div className="tx-farewell-next">
          <span>{impact ? `Kvar på ${impact.position}: ${impact.before.available} spelbara av ${impact.before.total}.` : "Truppen har en plats mindre."}</span>
          <Link className="hm-btn hm-btn-primary" href={bye.fillGapHref}>Fyll luckan{bye.position ? ` på ${bye.position}` : ""} →</Link>
        </div>
      )}

      {!completed && (
        <>
          <div className="tx-impact-tabs" role="tablist" aria-label="Vad en försäljning innebär">
            <button type="button" role="tab" aria-selected={tab === "money"} onClick={() => setTab("money")}>Pengar</button>
            <button type="button" role="tab" aria-selected={tab === "squad"} onClick={() => setTab("squad")}>Truppen</button>
          </div>
          <div className="tx-sell-impact" data-tab={tab}>
            <section className="tx-sell-money" aria-label="Pengarna">
              <h3 className="tx-h4">Pengarna</h3>
              <dl className="tx-total">
                <div data-k="total"><dt>Budet</dt><dd className="tx-num">{money.format(offer.feeEur)}</dd></div>
                {money$.marketValueEur !== null && <div><dt>Er värdering</dt><dd className="tx-num">{money.format(money$.marketValueEur)}</dd></div>}
                {money$.marketValueEur !== null && <div data-sign={offer.feeEur >= money$.marketValueEur ? "up" : "down"}><dt>Mot värderingen</dt><dd className="tx-num">{offer.feeEur >= money$.marketValueEur ? "+" : "−"}{money.format(Math.abs(offer.feeEur - money$.marketValueEur))}</dd></div>}
                {money$.contractEnd && <div><dt>Avtal t.o.m.</dt><dd>{money$.contractEnd} · {money$.monthsLeft} mån kvar</dd></div>}
                <div><dt>Lön som frigörs</dt><dd className="tx-num">{money.format(money$.wageEurPerMonth)}/mån{money$.wageSavedEur ? ` · ${money.format(money$.wageSavedEur, { compact: true })} avtalet ut` : ""}</dd></div>
                <div><dt>Kassa efter försäljning</dt><dd className="tx-num">{money.format(cash + offer.feeEur)}</dd></div>
                {budgets && <div><dt>Styrelsens transferram</dt><dd className="tx-num">{money.format(budgets.transferBudgetEur)}</dd></div>}
              </dl>
              {money$.contractEnd && money$.monthsLeft <= 6 && <p className="tx-muted">Avtalet går snart ut -- säljer du inte nu kan han gå gratis.</p>}
            </section>

            <section className="tx-sell-depth" aria-label="Truppen">
              <h3 className="tx-h4">Truppen på {impact ? POSITION_NAME[impact.position].toLowerCase() : "positionen"} <ImpactChip impact={impact} /></h3>
              {impact ? (
                <div className="tx-depth-pair">
                  {(["before", "after"] as const).map((k) => {
                    const spot = impact[k];
                    return (
                      <div key={k} data-k={k} data-tone={spot.tone}>
                        <small>{k === "before" ? "I dag" : "Efter försäljningen"}</small>
                        <b className="tx-num">{spot.available}<span>/{spot.total}</span></b>
                        <ul>{(k === "before" ? impact.before.natural : impact.after.natural).map((n) => <li key={n.id} data-sold={n.id === offer.playerId || undefined} data-available={n.available}>{n.name}{!n.available && <small> · inte spelbar</small>}</li>)}{k === "before" ? null : impact.after.natural.length === 0 && <li className="tx-muted">Ingen kvar</li>}</ul>
                        {spot.cover.length > 0 && <p className="tx-muted">Kan täcka: {spot.cover.map((c) => c.name).join(", ")}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="tx-muted">Spelaren tillhör inte längre truppen.</p>}
              <dl className="tx-total">
                <div><dt>Hans moral</dt><dd className="tx-num">{moraleOf(career, offer.playerId)} %</dd></div>
              </dl>
              {request?.status === "OPEN" || request?.status === "ACCEPTED" ? <p className="tx-muted">Han har bett att få lämna. Avvisar du ett bra bud blir han ännu mer missnöjd.</p> : <p className="tx-muted">Han har inte bett att få gå. Han bestämmer själv när klubbarna är överens.</p>}
              {notSell && <p className="tx-warn-line">Du har lovat att inte sälja honom. En försäljning bryter löftet.</p>}
            </section>
          </div>
        </>
      )}

      <section className="tx-sell-bid" aria-label="Budet">
        <div>
          <h3 className="tx-h4">Varför {buyer?.shortName ?? "de"} vill ha honom</h3>
          <p>{offer.motive}</p>
          <dl className="tx-total">
            <div><dt>Lön de erbjuder honom</dt><dd className="tx-num">{money.format(offer.wageEurPerMonth)} / mån</dd></div>
            <div><dt>Avtal</dt><dd>{offer.contractYears} år</dd></div>
          </dl>
          {offer.playerStance && <blockquote className="tx-stance" data-response={offer.playerStance.willing ? "ACCEPT" : "REJECT"}>{offer.playerStance.reason}</blockquote>}
        </div>
        <div>
          <h3 className="tx-h4">Budgivningen</h3>
          <ol className="tx-rounds">{offer.rounds.map((r, i) => <li key={i} data-by={r.by}><time>{r.date}</time><b>{r.by === "BUYER" ? buyer?.shortName ?? "Köparen" : "Du"}</b><span className="tx-num">{money.format(r.feeEur)}</span><small>{r.note}</small></li>)}</ol>
        </div>
      </section>

      {awaitingApproval && (
        <div className="tx-sell-decision">
          <DecisionCard
            tone="gold"
            title="Slutgiltigt godkännande krävs"
            primary={{ label: "Bekräfta försäljning", consequence: `${money.format(offer.feeEur)} bokförs i kassan och övergången slutförs`, onSelect: () => setConfirm("confirm-sale") }}
            secondary={<button type="button" className="hm-btn" onClick={() => setConfirm("reject-sale")}>Avvisa affär</button>}
          >
            <p>Klubbarna är överens om övergångssumman och spelaren har tackat ja till det personliga avtalet. Du har sista ordet innan spelaren skrivs över.</p>
            {confirm === "confirm-sale" && <Confirm text={`Sälja ${name} till ${buyer?.shortName ?? offer.fromClubId} för ${money.format(offer.feeEur)}? Det går inte att ångra.`} yes="Ja, sälj" onYes={() => run(() => updateCareer((s) => confirmIncomingSale(s, offer.id)), "Försäljningen är bekräftad och godkänd!")} onNo={() => setConfirm(null)} />}
            {confirm === "reject-sale" && <Confirm text="Avvisa affären? Köparen drar sig ur." yes="Ja, avvisa" onYes={() => run(() => updateCareer((s) => rejectIncomingSale(s, offer.id)), "Affären har avvisats.")} onNo={() => setConfirm(null)} />}
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => run(() => updateCareer((s) => withdrawIncomingOffer(s, offer.id)), "Du drog dig ur affären.")}>Dra dig ur</button>
          </DecisionCard>
        </div>
      )}

      {open && (
        <div className="tx-sell-decision">
          <DecisionCard tone="gold" title="Ditt svar" status={<span className="tx-pill" data-tone="wait">Svara senast {weekdayDate(offer.respondBy)}</span>} primary={{ label: "Acceptera budet", consequence: `${money.format(offer.feeEur)} till kassan om spelaren säger ja`, onSelect: () => setConfirm("accept") }} secondary={<button type="button" className="hm-btn" onClick={() => setConfirm("reject")}>Avvisa</button>}>
            {confirm === "accept" && <Confirm text={`Acceptera ${money.format(offer.feeEur)} från ${buyer?.shortName ?? offer.fromClubId}? Spelaren bestämmer sedan själv.`} yes="Ja, acceptera" onYes={() => run(() => updateCareer((s) => acceptIncomingOffer(s, offer.id)), "Du accepterade budet.")} onNo={() => setConfirm(null)} />}
            {confirm === "reject" && <Confirm text="Avvisa budet? Köparen kan återkomma senare, men det är inte säkert." yes="Ja, avvisa" onYes={() => run(() => updateCareer((s) => rejectIncomingOffer(s, offer.id)), "Budet är avvisat.")} onNo={() => setConfirm(null)} />}
            <div className="tx-counter">
              <label className="pd-counter">Motbud ({currencySymbol()})<MoneyInput className="tc-input tx-num" minEur={counterMin} stepEur={500} valueEur={ask} onChangeEur={setAsk} /></label>
              <div className="tx-counter-band">
                <div className="tc-band-track" aria-hidden="true">
                  {money$.marketValueEur !== null && <i className="tc-band-counter" style={{ left: pct(money$.marketValueEur) }} />}
                  <i className="tc-band-bid" style={{ left: pct(ask) }} />
                </div>
                <input type="range" className="tx-range" min={counterMin} max={counterMax} step={500} value={Math.min(counterMax, Math.max(counterMin, ask))} onChange={(e) => setAsk(Number(e.target.value))} aria-label="Motbud" aria-valuetext={money.format(ask)} />
                <ul className="tc-band-legend"><li data-k="bid">Ert motbud {money.format(ask)}</li>{money$.marketValueEur !== null && <li data-k="counter">Er värdering {money.format(money$.marketValueEur)}</li>}<li data-k="range">Deras bud {money.format(offer.feeEur)}</li></ul>
              </div>
              <button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => counterIncomingOffer(s, offer.id, ask)), "Motbudet är skickat. Svar i morgon.")}>Skicka motbud</button>
            </div>
          </DecisionCard>
        </div>
      )}
      {message && <p className="tx-status-line" role="status">{message}</p>}
    </div>
  );
}

function Confirm({ text, yes, onYes, onNo }: { text: string; yes: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="tx-confirm" role="group" aria-label="Bekräfta">
      <span>{text}</span>
      <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={onYes}>{yes}</button>
      <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onNo}>Avbryt</button>
    </div>
  );
}
