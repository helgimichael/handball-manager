"use client";
// HM-ALPHA2-05E: Deal Completion -- what was agreed, what it cost, and
// when the player arrives. Restrained: one confirmation headline, a
// contract column and a money column, two follow-up links.
import Link from "next/link";
import { SQUAD_STATUS_TIER_LABEL_SV } from "@/lib/career/squadStatus";
import { formatEur } from "@/lib/economy/currency";
import { getClub } from "@/lib/game-data";
import type { DealSummary } from "@/lib/transfers/transferCentre";

export function DealCompletion({ summary, playerName }: { summary: DealSummary; playerName: string }) {
  const { offer, isLoan } = summary;
  const scheduled = summary.arrival === "SCHEDULED";
  const owner = getClub(offer.fromClubId)?.name ?? "Fri agent";
  const headline = isLoan ? `${playerName} är lånad` : scheduled ? `${playerName} är klar för er` : `${playerName} har anslutit`;
  const sub = isLoan
    ? `Han spelar för er till ${summary.loan?.endDate ?? offer.loanTerms?.endDate} och återvänder sedan automatiskt till ${owner}, som äger avtalet.`
    : scheduled
      ? `Avtalet är påskrivet. Övergången registreras när transferfönstret öppnar ${summary.arrivalDate}.`
      : "Avtalet är registrerat och spelaren finns i truppen.";
  return (
    <section className="tc-completion" data-arrival={summary.arrival} aria-live="polite">
      <section>
        <div className="tc-eyebrow">{isLoan ? "Lån bekräftat" : scheduled ? "Överenskommelse" : "Övergång genomförd"} · {offer.resolvedDate ?? offer.offeredDate}</div>
        <h2>{headline}</h2>
        <p className="tc-stance">{sub}</p>
        <dl className="tc-facts" style={{ marginTop: 12 }}>
          {isLoan ? <>
            <div><dt>Avtalet ägs av</dt><dd>{owner}</dd></div>
            <div><dt>Låneperiod</dt><dd>{offer.loanTerms?.startDate} → {offer.loanTerms?.endDate}</dd></div>
            <div><dt>Ert lönebidrag</dt><dd>{offer.loanTerms?.wageShareBorrowingPct}% · {formatEur(summary.monthlyWageCostEur)}/mån</dd></div>
          </> : <>
            <div><dt>Lön</dt><dd>{formatEur(offer.newWageEurPerMonth)}/mån</dd></div>
            <div><dt>Avtal t.o.m.</dt><dd>{summary.contractEndDate}</dd></div>
            {scheduled && <div><dt>Ankomst</dt><dd>{summary.arrivalDate}</dd></div>}
          </>}
          {summary.promisedSquadRole && <div><dt>Utlovad roll</dt><dd>{SQUAD_STATUS_TIER_LABEL_SV[summary.promisedSquadRole]}</dd></div>}
        </dl>
        <div className="tc-decision-actions" style={{ marginTop: 14 }}>
          <Link className="hm-btn hm-btn-primary" href={`/career/squad/${encodeURIComponent(offer.playerId)}`}>Öppna spelarprofilen →</Link>
          <Link className="hm-btn" href="/career/transfers">Tillbaka till Transfer Centre</Link>
        </div>
      </section>
      <section>
        <div className="tc-eyebrow">Ekonomi</div>
        <dl className="tc-ledger">
          {!isLoan && <>
            <div><dt>Övergångssumma</dt><dd>{formatEur(summary.feeEur)}</dd></div>
            <div><dt>Utbildningsersättning</dt><dd>{formatEur(summary.trainingCompensationEur)}</dd></div>
            <div><dt>Agentarvode</dt><dd>{formatEur(summary.agentFeeEur)}</dd></div>
            {summary.signingBonusEur > 0 && <div><dt>Signeringsbonus</dt><dd>{formatEur(summary.signingBonusEur)}</dd></div>}
          </>}
          <div data-total><dt>{isLoan ? "Engångskostnad" : scheduled ? "Betalas vid registrering" : "Betalt vid signering"}</dt><dd>{formatEur(summary.upfrontEur)}</dd></div>
          <div><dt>Lönekostnad för er</dt><dd>{formatEur(summary.monthlyWageCostEur)}/mån · {formatEur(summary.monthlyWageCostEur * 12)}/år</dd></div>
        </dl>
      </section>
    </section>
  );
}
