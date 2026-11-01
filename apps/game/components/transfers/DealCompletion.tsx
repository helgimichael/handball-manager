"use client";
// HM-ALPHA2-05E/F: Deal Completion -- the signing as a milestone. A
// photographic hero (Higgsfield "signed contract" asset) with the
// outcome stamped on it, then the contract on one side and where the
// money went on the other (a single stacked bar: who receives each
// euro), then what to do next. Restrained: one reveal, no confetti.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { PlayerGlyph } from "@/components/game/Identity";
import { SQUAD_STATUS_TIER_LABEL_SV } from "@/lib/career/squadStatus";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { getClub, positionLabel, type PlayerMock } from "@/lib/game-data";
import type { DealSummary } from "@/lib/transfers/transferCentre";
import { DEAL_SIGNED_BACKDROP } from "./transferVisuals";

interface Flow { label: string; to: string; eur: number; tone: string }

export function DealCompletion({ summary, player }: { summary: DealSummary; player: PlayerMock }) {
  useMoney(); // re-render every figure when the display currency changes
  const { offer, isLoan } = summary;
  const scheduled = summary.arrival === "SCHEDULED";
  const from = offer.fromClubId ? getClub(offer.fromClubId) : undefined;
  const to = getClub(offer.toClubId);
  const name = `${player.firstName} ${player.lastName}`;
  const stamp = isLoan ? "Lånad" : scheduled ? "Överens" : "Klar";
  const headline = isLoan ? `${player.lastName} är lånad` : scheduled ? `${player.lastName} är klar för er` : `${player.lastName} har skrivit på`;
  const lede = isLoan
    ? `${name} spelar för ${to?.shortName ?? "er"} till ${summary.loan?.endDate ?? offer.loanTerms?.endDate} och återvänder sedan automatiskt till ${from?.name ?? "ägarklubben"}, som äger avtalet.`
    : scheduled
      ? `Avtalet är påskrivet. Övergången registreras när transferfönstret öppnar ${summary.arrivalDate} -- då ansluter han till truppen.`
      : `Avtalet är registrerat och ${name} finns nu i truppen.`;

  const flows: Flow[] = isLoan ? [] : ([
    { label: "Övergångssumma", to: from?.shortName ?? "säljande klubb", eur: summary.feeEur, tone: "fee" },
    { label: "Utbildningsersättning", to: "fostrarklubbar", eur: summary.trainingCompensationEur, tone: "training" },
    { label: "Agentarvode", to: "agenten", eur: summary.agentFeeEur, tone: "agent" },
    { label: "Signeringsbonus", to: "spelaren", eur: summary.signingBonusEur, tone: "bonus" },
  ] satisfies Flow[]).filter((f) => f.eur > 0);
  const total = flows.reduce((s, f) => s + f.eur, 0);
  const share = offer.loanTerms?.wageShareBorrowingPct ?? 100;
  const fullWage = summary.loan?.originalWageEurPerMonth ?? offer.newWageEurPerMonth;

  return (
    <section className="tc-completion" data-arrival={summary.arrival} data-deal={offer.dealType} aria-live="polite">
      <header className="tc-completion-hero tc-photo-hero" style={DEAL_SIGNED_BACKDROP}>
        <div className="tc-completion-copy">
          <div className="tc-hero-tags"><span className="tc-tag" data-tone={isLoan ? "loan" : "permanent"}>{isLoan ? "Lån bekräftat" : scheduled ? "Överenskommelse" : "Övergång genomförd"}</span><span>{offer.resolvedDate ?? offer.offeredDate}</span></div>
          <h1>{headline}</h1>
          <p>{lede}</p>
          <div className="tc-completion-route">
            {from ? <ClubCrest shortName={from.shortName} primaryColor={from.primaryColor} clubId={from.id} size={34} /> : <span className="tc-party-mark" aria-hidden="true">FA</span>}
            <span className="tc-route-arrow" aria-hidden="true" />
            <PlayerGlyph player={player} size={46} />
            <span className="tc-route-arrow" aria-hidden="true" />
            {to && <ClubCrest shortName={to.shortName} primaryColor={to.primaryColor} clubId={to.id} size={34} />}
            <span className="tc-completion-who">{positionLabel(player.position)} · {from?.shortName ?? "Fri agent"} → {to?.shortName}</span>
          </div>
        </div>
        <span className="tc-signed-stamp" aria-hidden="true">{stamp}</span>
      </header>

      <div className="tc-completion-body">
        <section className="tc-completion-card" aria-label="Avtalet">
          <div className="tc-eyebrow">{isLoan ? "Lånet" : "Kontraktet"}</div>
          <dl className="tc-facts">
            {isLoan ? <>
              <div><dt>Avtalet ägs av</dt><dd>{from?.name ?? "—"}</dd></div>
              <div><dt>Spelar för</dt><dd>{to?.name}</dd></div>
              <div><dt>Låneperiod</dt><dd>{offer.loanTerms?.startDate} → {offer.loanTerms?.endDate}</dd></div>
              <div><dt>Återvänder automatiskt</dt><dd>{offer.loanTerms?.endDate}</dd></div>
            </> : <>
              <div><dt>Lön</dt><dd>{formatMoney(offer.newWageEurPerMonth)}/mån</dd></div>
              <div><dt>Avtal t.o.m.</dt><dd>{summary.contractEndDate}</dd></div>
              <div><dt>{scheduled ? "Ansluter" : "Anslöt"}</dt><dd>{summary.arrivalDate}</dd></div>
            </>}
            {summary.promisedSquadRole && <div><dt>Utlovad roll</dt><dd>{SQUAD_STATUS_TIER_LABEL_SV[summary.promisedSquadRole]}</dd></div>}
          </dl>
          {summary.promisedSquadRole && <p className="tc-note">Löftet följer med avtalet. Spelarprofilen visar om ni håller det.</p>}
        </section>

        <section className="tc-completion-card" aria-label="Pengarna">
          <div className="tc-eyebrow">{isLoan ? "Lönen under lånet" : scheduled ? "Betalas vid registrering" : "Betalt vid signering"}</div>
          {isLoan ? (
            <>
              <div className="tc-flow" role="img" aria-label={`Ni betalar ${share} procent av lönen, ägarklubben resten`}>
                <i data-tone="fee" style={{ flexGrow: share }} />
                <i data-tone="owner" style={{ flexGrow: 100 - share }} />
              </div>
              <ul className="tc-flow-legend">
                <li data-tone="fee"><span>Ni betalar · {share}%</span><b>{formatMoney(Math.round(fullWage * share / 100))}/mån</b></li>
                <li data-tone="owner"><span>{from?.shortName ?? "Ägarklubben"} betalar · {100 - share}%</span><b>{formatMoney(Math.round(fullWage * (100 - share) / 100))}/mån</b></li>
              </ul>
              <div className="tc-flow-total"><span>Låneavgift</span><strong>{formatMoney(0)}</strong></div>
            </>
          ) : (
            <>
              <div className="tc-flow" role="img" aria-label={`Totalt ${formatMoney(total)} fördelat på ${flows.length} mottagare`}>
                {flows.map((f) => <i key={f.label} data-tone={f.tone} style={{ flexGrow: Math.max(f.eur, total * 0.02) }} />)}
              </div>
              <ul className="tc-flow-legend">
                {flows.map((f) => <li key={f.label} data-tone={f.tone}><span>{f.label} <em>till {f.to}</em></span><b>{formatMoney(f.eur)}</b></li>)}
              </ul>
              <div className="tc-flow-total"><span>Totalt</span><strong>{formatMoney(total)}</strong></div>
            </>
          )}
          <div className="tc-flow-wage"><span>Lönekostnad för er</span><b>{formatMoney(summary.monthlyWageCostEur)}/mån · {formatMoney(summary.monthlyWageCostEur * 12)}/år</b></div>
        </section>
      </div>

      <nav className="tc-next" aria-label="Nästa steg">
        <Link className="hm-btn hm-btn-primary tc-cta" href={`/career/squad/${encodeURIComponent(offer.playerId)}`}>Öppna spelarprofilen →</Link>
        <Link className="hm-btn" href="/career/squad">Se truppen</Link>
        <Link className="hm-btn" href="/career/tactics">Planera laguttagning</Link>
        <Link className="hm-btn tc-quiet" href="/career/transfers">Tillbaka till Transfer Centre</Link>
      </nav>
    </section>
  );
}
