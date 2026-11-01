"use client";
// HM-ALPHA2-05E: the transfer side of a player profile -- who owns the
// contract and where he plays, any loan, the role promised when he
// signed (and whether it is being kept), the manager's negotiation,
// other clubs' interest, and the transfer/loan actions available.
import Link from "next/link";
import { useCareer } from "@/lib/career/CareerContext";
import { SQUAD_STATUS_TIER_LABEL_SV } from "@/lib/career/squadStatus";
import { getClub } from "@/lib/game-data";
import { getPlayerTransferStatus } from "@/lib/transfers/transferCentre";

export function PlayerTransferCard({ playerId }: { playerId: string }) {
  const { career } = useCareer();
  const status = getPlayerTransferStatus(career, playerId);
  if (!status) return null;
  const name = (id: string) => (id ? getClub(id)?.shortName ?? id : "Fri agent");
  const negotiation = status.managerNegotiation;
  const negotiating = negotiation && (negotiation.nextStep === "WAITING" || negotiation.nextStep === "YOUR_MOVE");
  const canNegotiate = !status.isOwnPlayer;
  const canLoan = canNegotiate && status.contractStatus !== "FREE_AGENT" && !status.loan;
  return (
    <section className="tc-panel tc-profile-card" aria-label="Transferläge">
      <div className="tc-panel-head"><h3>Transferläge</h3><span>{status.isOwnPlayer ? "Er spelare" : status.isLoanedIn ? "Inlånad" : "Extern spelare"}</span></div>
      <div className="tc-panel-body">
        <dl className="tc-facts">
          <div><dt>Avtalet ägs av</dt><dd>{name(status.ownerClubId)}</dd></div>
          <div><dt>Spelar för</dt><dd>{name(status.playingClubId)}</dd></div>
          {status.loan && <div><dt>Lån</dt><dd>{status.loan.startDate} → {status.loan.endDate} · {status.loan.wageShareBorrowingPct}% av lönen hos {name(status.loan.borrowingClubId)}</dd></div>}
          {status.interestedClubIds.length > 0 && <div><dt>Konkurrerande intresse</dt><dd>{status.interestedClubIds.map(name).join(", ")}</dd></div>}
        </dl>
        {status.promise && (
          <div className="tc-promise" data-kept={status.promise.kept}>
            <span>Utlovad roll vid värvningen: <b>{SQUAD_STATUS_TIER_LABEL_SV[status.promise.role]}</b></span>
            <span>{status.promise.kept ? "Löftet hålls" : "Löftet bryts -- ändra truppstatus"}</span>
          </div>
        )}
        {canNegotiate && (
          <div className="tc-actions">
            <Link className="hm-btn hm-btn-primary tc-wide" href={`/career/transfers/${encodeURIComponent(playerId)}`}>{negotiating ? (negotiation!.nextStep === "YOUR_MOVE" ? "Ditt drag -- öppna förhandlingen →" : `Väntar på svar ${negotiation!.date ?? ""} →`) : "Förhandla om övergång →"}</Link>
            {canLoan && !negotiating && <Link className="hm-btn tc-wide" href={`/career/transfers/${encodeURIComponent(playerId)}?deal=LOAN`}>Föreslå lån</Link>}
          </div>
        )}
      </div>
    </section>
  );
}
