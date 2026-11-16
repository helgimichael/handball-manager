"use client";
// HM-ALPHA2-05E/F: the transfer side of a player profile -- who owns the contract and where he plays, the loan
// period with today marked, the role promised when he signed and whether it is being kept, the manager's
// negotiation, other clubs' interest, and the transfer/loan actions available.
// Arena 231 -- SQD-02o A "Unified status card": rendered in the profile's own card system (hm-dossier-section,
// like Förlängning beside it) instead of the Transfer Centre tc-* skin. Hierarchy: the deadline clock first, then
// the state as chips (promise kept/broken, loan time left, competing interest), then ownership/loan, then the CTA
// to the negotiation (REC-04). Contract and wage are not repeated: the deal sheet's facts row beside it shows them.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { useCareer } from "@/lib/career/CareerContext";
import { SQUAD_STATUS_TIER_LABEL_SV } from "@/lib/career/squadStatus";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { getClub } from "@/lib/game-data";
import { getPlayerTransferStatus } from "@/lib/transfers/transferCentre";
import { daysLeftLabel, deadlineUrgency, periodProgress, weekdayDate } from "./transferVisuals";
import "./player-transfer-card.css";

function ClubChip({ clubId, role }: { clubId: string; role: string }) {
  const club = clubId ? getClub(clubId) : undefined;
  return (
    <div className="ptc-club">
      {club ? <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={28} /> : <span className="ptc-club-fa" aria-hidden="true">FA</span>}
      <div><small>{role}</small><strong>{club?.shortName ?? "Fri agent"}</strong></div>
    </div>
  );
}

export function PlayerTransferCard({ playerId }: { playerId: string }) {
  useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const status = getPlayerTransferStatus(career, playerId);
  if (!status) return null;
  const negotiation = status.managerNegotiation;
  const negotiating = !!negotiation && (negotiation.nextStep === "WAITING" || negotiation.nextStep === "YOUR_MOVE");
  const yourMove = negotiating && negotiation!.nextStep === "YOUR_MOVE";
  const canNegotiate = !status.isOwnPlayer;
  const canLoan = canNegotiate && status.contractStatus !== "FREE_AGENT" && !status.loan;
  const split = status.ownerClubId !== status.playingClubId;
  const loan = status.loan;
  const clock = negotiating ? deadlineUrgency(career.gameDate, negotiation!.date) : null;
  const loanLeft = loan ? deadlineUrgency(career.gameDate, loan.endDate) : null;
  const tag = status.isOwnPlayer ? (loan ? "Utlånad" : "Er spelare") : status.isLoanedIn ? "Inlånad" : status.contractStatus === "FREE_AGENT" ? "Fri agent" : "Extern spelare";
  const tagTone = status.isLoanedIn || (status.isOwnPlayer && loan) ? "wait" : status.isOwnPlayer ? "own" : undefined;
  const rivals = status.interestedClubIds.map((id) => getClub(id)?.shortName ?? id);
  const replyDate = negotiation?.date ? weekdayDate(negotiation.date) : null;

  return (
    <section className="hm-dossier-section ptc" aria-labelledby={`ptc-h-${playerId}`}>
      <header><h2 id={`ptc-h-${playerId}`}>Transferläge</h2><span className="ptc-chip" data-tone={tagTone}>{tag}</span></header>

      {negotiating && (
        <div className="ptc-clock" data-urgency={clock?.urgency ?? "calm"} role="status">
          <b className="ce-num">{clock ? daysLeftLabel(clock.daysLeft) : yourMove ? "Ditt drag" : "Väntar på besked"}</b>
          <span>{yourMove ? `Ditt drag – svara senast ${replyDate ?? "så snart som möjligt"}` : `Motparten svarar${replyDate ? ` senast ${replyDate}` : " snart"}`}</span>
        </div>
      )}

      {(status.promise || rivals.length > 0 || loanLeft) && (
        <ul className="ptc-chips" aria-label="Läge">
          {status.promise && <li className="ptc-chip" data-tone={status.promise.kept ? "pos" : "neg"}>Löfte: {SQUAD_STATUS_TIER_LABEL_SV[status.promise.role]} · {status.promise.kept ? "hålls" : "bryts"}</li>}
          {loanLeft && <li className="ptc-chip ce-num" data-tone="wait">{daysLeftLabel(loanLeft.daysLeft).replace("kvar", "kvar av lånet")}</li>}
          {rivals.length > 0 && <li className="ptc-chip" data-tone="warn" title={rivals.join(", ")}>Intresse: {rivals.length === 1 ? rivals[0] : `${rivals.length} klubbar`}</li>}
        </ul>
      )}
      {rivals.length > 1 && <p className="hm-dossier-note">Konkurrerande intresse: {rivals.join(", ")}.</p>}
      {status.promise && !status.promise.kept && <p className="hm-dossier-note">Löftet bryts – höj hans truppstatus till minst {SQUAD_STATUS_TIER_LABEL_SV[status.promise.role].toLowerCase()} för att hålla det.</p>}

      <div className="ptc-own" data-split={split}>
        <ClubChip clubId={status.ownerClubId} role="Äger avtalet" />
        {split && <><span className="ptc-own-link" aria-hidden="true"><i />{loan ? "lån" : ""}</span><ClubChip clubId={status.playingClubId} role="Spelar för" /></>}
      </div>

      {loan && (
        <div className="ptc-loan" aria-label={`Lån ${loan.startDate} till ${loan.endDate}`}>
          <div className="ptc-loan-track"><i style={{ width: `${Math.round(periodProgress(loan.startDate, loan.endDate, career.gameDate) * 100)}%` }} /></div>
          <div className="ptc-loan-dates ce-num"><span>{loan.startDate}</span><span>{loan.endDate}</span></div>
          <p className="hm-dossier-note">{getClub(loan.borrowingClubId)?.shortName} betalar {loan.wageShareBorrowingPct} % av lönen{status.wageEurPerMonth ? ` (${formatMoney(Math.round(status.wageEurPerMonth * loan.wageShareBorrowingPct / 100))}/mån)` : ""}. Han återvänder automatiskt när lånet slutar.</p>
        </div>
      )}

      {canNegotiate ? (
        <div className="ptc-actions">
          <Link className="hm-btn hm-btn-primary ptc-cta" href={`/career/transfers/${encodeURIComponent(playerId)}`}>
            {negotiating ? (yourMove ? "Till förhandlingen – ditt drag →" : "Öppna förhandlingen →") : status.isLoanedIn ? "Förhandla om att köpa loss honom →" : "Förhandla om övergång →"}
          </Link>
          {canLoan && !negotiating && <Link className="hm-btn" href={`/career/transfers/${encodeURIComponent(playerId)}?deal=LOAN`}>Föreslå lån</Link>}
        </div>
      ) : !loan && <p className="hm-dossier-note">Er spelare – ingen pågående övergång eller utlåning.</p>}
    </section>
  );
}
