"use client";
// HM-ALPHA2-05E/F: the transfer side of a player profile -- who owns the
// contract and where he plays (drawn as owner -> playing club when they
// differ), the loan period with today marked, the role promised when he
// signed and whether it is being kept, the manager's negotiation, other
// clubs' interest, and the transfer/loan actions available.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { useCareer } from "@/lib/career/CareerContext";
import { SQUAD_STATUS_TIER_LABEL_SV } from "@/lib/career/squadStatus";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { CONTRACT_STATUS_LABEL } from "@/lib/economy/labels";
import { getClub } from "@/lib/game-data";
import { getPlayerTransferStatus } from "@/lib/transfers/transferCentre";
import { daysLeftLabel, deadlineUrgency, periodProgress } from "./transferVisuals";

function ClubChip({ clubId, role }: { clubId: string; role: string }) {
  const club = clubId ? getClub(clubId) : undefined;
  return (
    <div className="tc-own-club">
      {club ? <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={34} /> : <span className="tc-party-mark" aria-hidden="true">FA</span>}
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
  const negotiating = negotiation && (negotiation.nextStep === "WAITING" || negotiation.nextStep === "YOUR_MOVE");
  const canNegotiate = !status.isOwnPlayer;
  const canLoan = canNegotiate && status.contractStatus !== "FREE_AGENT" && !status.loan;
  const split = status.ownerClubId !== status.playingClubId;
  const loan = status.loan;
  const clock = negotiating ? deadlineUrgency(career.gameDate, negotiation!.date) : null;
  const tag = status.isOwnPlayer ? (loan ? "Utlånad" : "Er spelare") : status.isLoanedIn ? "Inlånad" : status.contractStatus === "FREE_AGENT" ? "Fri agent" : "Extern spelare";
  return (
    <section className="tc-panel tc-profile-card" aria-label="Transferläge">
      <div className="tc-panel-head"><h3>Transferläge</h3><span className="tc-pill" data-tone={status.isLoanedIn || (status.isOwnPlayer && loan) ? "wait" : status.isOwnPlayer ? "done" : undefined}>{tag}</span></div>
      <div className="tc-panel-body">
        <div className="tc-ownership" data-split={split}>
          <ClubChip clubId={status.ownerClubId} role="Äger avtalet" />
          {split && <><span className="tc-own-link" aria-hidden="true"><i />{loan ? "lån" : ""}</span><ClubChip clubId={status.playingClubId} role="Spelar för" /></>}
        </div>

        {loan && (
          <div className="tc-loan-line" aria-label={`Lån ${loan.startDate} till ${loan.endDate}`}>
            <div className="tc-loan-track"><i style={{ width: `${Math.round(periodProgress(loan.startDate, loan.endDate, career.gameDate) * 100)}%` }} /></div>
            <div className="tc-loan-dates"><span>{loan.startDate}</span><b>{daysLeftLabel(deadlineUrgency(career.gameDate, loan.endDate)?.daysLeft ?? 0).replace("kvar", "kvar av lånet")}</b><span>{loan.endDate}</span></div>
            <p className="tc-note">{getClub(loan.borrowingClubId)?.shortName} betalar {loan.wageShareBorrowingPct}% av lönen{status.wageEurPerMonth ? ` (${formatMoney(Math.round(status.wageEurPerMonth * loan.wageShareBorrowingPct / 100))}/mån)` : ""}. Han återvänder automatiskt när lånet slutar.</p>
          </div>
        )}

        <dl className="tc-facts">
          <div><dt>Avtal</dt><dd>{status.contractStatus ? CONTRACT_STATUS_LABEL[status.contractStatus] : "—"}{status.contractEndDate ? ` · t.o.m. ${status.contractEndDate}` : ""}</dd></div>
          {status.wageEurPerMonth !== undefined && <div><dt>Lön enligt avtal</dt><dd>{formatMoney(status.wageEurPerMonth)}/mån</dd></div>}
          {status.interestedClubIds.length > 0 && <div><dt>Konkurrerande intresse</dt><dd>{status.interestedClubIds.map((id) => getClub(id)?.shortName ?? id).join(", ")}</dd></div>}
        </dl>

        {status.promise && (
          <div className="tc-promise" data-kept={status.promise.kept}>
            <span><small>Löfte vid värvningen</small><b>{SQUAD_STATUS_TIER_LABEL_SV[status.promise.role]}</b></span>
            <span>{status.promise.kept ? "Hålls" : "Bryts -- höj hans truppstatus"}</span>
          </div>
        )}

        {canNegotiate && (
          <div className="tc-actions">
            <Link className="hm-btn hm-btn-primary tc-wide tc-cta" href={`/career/transfers/${encodeURIComponent(playerId)}`}>
              {negotiating ? (negotiation!.nextStep === "YOUR_MOVE" ? `Ditt drag${clock ? ` · ${daysLeftLabel(clock.daysLeft)}` : ""} →` : `Väntar på besked ${negotiation!.date ?? ""} →`) : status.isLoanedIn ? "Förhandla om att köpa loss honom →" : "Förhandla om övergång →"}
            </Link>
            {canLoan && !negotiating && <Link className="hm-btn tc-wide" href={`/career/transfers/${encodeURIComponent(playerId)}?deal=LOAN`}>Föreslå lån</Link>}
          </div>
        )}
      </div>
    </section>
  );
}
