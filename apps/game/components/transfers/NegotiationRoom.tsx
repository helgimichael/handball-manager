"use client";
// HM-ALPHA2-05E/F: the Negotiation Room -- one player, the selling/owning
// club and the player (with his agent) as two distinct parties, every
// offer and answer as a card, the stage and the clock visible at all
// times, and the next decision offered in context (meet the counter,
// adjust, walk away) instead of a repeated form. All actions go through
// the existing CareerContext `negotiateTransfer` -> negotiationIntegration.ts;
// all figures are derived from career state, so the room reads the same
// after a save/reload. 05F: photographic hero (Higgsfield asset), urgency
// countdown, richer stepper, stamped answers, a pending "on the table"
// state and a proper signing moment.
// Arena Nights 231: REC-04 A "Term Sheet" -- the decision is a term sheet (vårt bud · skillnad · deras krav)
// with the budget impact beside it (TermSheet.tsx); the waiting state can play the calendar forward to the
// answer inline (REC-04d A); the start is two choice cards with the real readiness checklist (REC-04a A);
// round history sits compactly underneath. Party stances, demand drivers and rivals moved into the sheet.
import { useState, type ReactNode } from "react";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink } from "@/components/entityLinks";
import { PlayerGlyph } from "@/components/game/Identity";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "@/lib/career/squadStatus";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { formatMoney, localizeMoneyText } from "@/lib/economy/currency";
import { ProgressSteps, type StepState } from "@/components/experience/primitives";
import { useMoney } from "@/lib/settings/usePreferences";
import { getPlayerContract, getPlayerContractStatus } from "@/lib/economy/contractIntegration";
import { getClub, positionLabel, type PlayerMock } from "@/lib/game-data";
import { getLatestNegotiation, isNegotiationOpen, type NegotiationAction } from "@/lib/transfers/negotiationIntegration";
import { getDealSummary, getPlayerTransferStatus, summarizeNegotiation } from "@/lib/transfers/transferCentre";
import type { NegotiationResponse, NegotiationRound, TransferDealType, TransferNegotiation } from "@/lib/transfers/types";
import { DealCompletion } from "./DealCompletion";
import { StartChoice, TermSheet, WaitingCard } from "./TermSheet";
import { NEGOTIATION_ROOM_BACKDROP, daysLeftLabel, deadlineUrgency, periodProgress } from "./transferVisuals";

const RESPONSE_LABEL: Record<NegotiationResponse, string> = { ACCEPT: "Accepterar", COUNTER: "Motbud", REJECT: "Avböjer", BREAK_OFF: "Avbryter" };
const CLOSED_LABEL: Partial<Record<TransferNegotiation["stage"], string>> = {
  COLLAPSED: "Förhandlingen bröt samman",
  WITHDRAWN: "Du drog dig ur",
  EXPIRED: "Tidsfristen gick ut",
  LOST: "Spelaren gick till en annan klubb",
};

type Career = ReturnType<typeof useCareer>["career"];

function clubName(clubId: string): string {
  return clubId ? getClub(clubId)?.name ?? clubId : "Fri agent";
}

function roleLabel(role: SquadStatusTier | undefined): string {
  return role ? SQUAD_STATUS_TIER_LABEL_SV[role] : "—";
}

export function NegotiationRoom({ playerId, initialDeal }: { playerId: string; initialDeal: TransferDealType }) {
  useMoney(); // re-render every figure when the display currency changes
  const { career, negotiateTransfer } = useCareer();
  const [error, setError] = useState<string | null>(null);
  const [startDeal, setStartDeal] = useState<TransferDealType>(initialDeal);
  const player = getCareerPlayer(career, playerId);
  const contract = getPlayerContract(career, playerId);
  const status = getPlayerTransferStatus(career, playerId);
  if (!player || !status) return <div className="tc-empty">Spelaren kunde inte hittas.</div>;

  const negotiation = getLatestNegotiation(career, playerId, career.playerClubId);
  const open = !!negotiation && isNegotiationOpen(negotiation);
  const completed = negotiation?.stage === "COMPLETED";
  const dealType: TransferDealType = negotiation && (open || completed) ? negotiation.dealType ?? "PERMANENT" : startDeal;
  const isLoan = dealType === "LOAN";
  const fromClubId = negotiation?.fromClubId ?? status.ownerClubId;
  const isFreeAgent = fromClubId === "" || getPlayerContractStatus(career, playerId) === "FREE_AGENT";
  const offer = negotiation?.offerId ? career.transferOffers[negotiation.offerId] : undefined;

  function run(action: NegotiationAction) {
    const result = negotiateTransfer(action);
    setError(result.ok ? null : result.error);
  }
  const clubLabel = isFreeAgent ? "agenten" : clubName(fromClubId);
  const playerName = `${player.firstName} ${player.lastName}`;

  return (
    <div className="tc-page tc-room-page tx-room" data-deal={dealType}>
      {completed && offer ? (
        <DealCompletion summary={getDealSummary(career, offer)} player={player} />
      ) : (
        <RoomHero career={career} player={player} negotiation={negotiation} fromClubId={fromClubId} isLoan={isLoan} isFreeAgent={isFreeAgent} loanBorrower={status.loan?.borrowingClubId} />
      )}

      {negotiation && !completed && !negotiation.pending && <StatusBanner career={career} negotiation={negotiation} />}
      {error && <div className="tc-error" role="alert">{localizeMoneyText(error)}</div>}

      {open && negotiation.pending ? (
        <WaitingCard key={`${negotiation.id}:${negotiation.rounds.length}`} negotiation={negotiation} partyName={negotiation.pending.party === "CLUB" ? clubLabel : playerName} onWithdraw={() => run({ kind: "WITHDRAW", negotiationId: negotiation.id })} />
      ) : open ? (
        <TermSheet key={`${negotiation.id}:${negotiation.rounds.length}`} negotiation={negotiation} run={run} contractWage={contract?.wageEurPerMonth ?? 0} contractEnd={contract?.contractEndDate ?? ""} position={player.position} clubName={isFreeAgent ? "Fri agent" : clubName(fromClubId)} playerName={playerName} />
      ) : completed ? null : (
        <StartChoice playerId={playerId} deal={startDeal} onDeal={setStartDeal} onStart={(deal) => run({ kind: "START", playerId, dealType: deal })} clubName={isFreeAgent ? "agenten" : clubName(fromClubId)} isNew={!!negotiation} />
      )}

      {/* Round history: compact, under the decision (and the whole record once the deal is done). */}
      {negotiation && negotiation.rounds.length + (negotiation.pending ? 1 : 0) > 0 && (
        <section className={completed ? "tx-history tc-room-history" : "tx-history"} aria-label="Förhandlingens historik">
          <h3 className="tc-section-title">{completed ? "Så gick förhandlingen" : "Rundorna hittills"}</h3>
          <Timeline career={career} negotiation={negotiation} player={player} />
        </section>
      )}
    </div>
  );
}

function RoomHero({ career, player, negotiation, fromClubId, isLoan, isFreeAgent, loanBorrower }: { career: Career; player: PlayerMock; negotiation?: TransferNegotiation; fromClubId: string; isLoan: boolean; isFreeAgent: boolean; loanBorrower?: string }) {
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate);
  const summary = negotiation ? summarizeNegotiation(negotiation) : undefined;
  const clock = summary && (summary.nextStep === "YOUR_MOVE" || summary.nextStep === "WAITING") ? deadlineUrgency(career.gameDate, summary.date) : null;
  return (
    <header className="tc-room-hero tc-photo-hero" style={NEGOTIATION_ROOM_BACKDROP}>
      <div className="tc-room-identity">
        <PlayerGlyph player={player} size={92} />
        <div>
          <div className="tc-hero-tags">
            <span className="tc-tag" data-tone={isLoan ? "loan" : "permanent"}>{isLoan ? "Lån" : "Övergång"}</span>
            <span>{positionLabel(player.position)}{age !== null ? ` · ${age} år` : ""}</span>
          </div>
          <h1>{player.firstName} <b>{player.lastName}</b></h1>
          <div className="tc-route">
            {fromClubId ? <ClubLink clubId={fromClubId}>{clubName(fromClubId)}</ClubLink> : <span>Fri agent</span>}
            {loanBorrower && loanBorrower !== fromClubId && <span className="tc-route-note">spelar på lån i {clubName(loanBorrower)}</span>}
            <span className="tc-route-arrow" aria-hidden="true" />
            <ClubLink clubId={career.playerClubId}>{clubName(career.playerClubId)}</ClubLink>
          </div>
        </div>
      </div>
      <div className="tc-hero-side">
        <Stepper negotiation={negotiation} isLoan={isLoan} isFreeAgent={isFreeAgent} />
        {clock && summary && (
          <div className="tc-clock" data-urgency={clock.urgency} data-step={summary.nextStep}>
            <strong>{summary.nextStep === "WAITING" ? (clock.daysLeft <= 0 ? "Svar idag" : `Svar om ${clock.daysLeft} d`) : daysLeftLabel(clock.daysLeft)}</strong>
            <span>{summary.nextStep === "WAITING" ? `Besked ${summary.date}` : `Ditt bud senast ${summary.date}`}</span>
          </div>
        )}
      </div>
    </header>
  );
}

function Stepper({ negotiation, isLoan, isFreeAgent }: { negotiation?: TransferNegotiation; isLoan: boolean; isFreeAgent: boolean }) {
  const stage = negotiation?.stage;
  const clubAgreed = negotiation ? (isLoan ? negotiation.agreedWageSharePct !== undefined : negotiation.agreedFeeEur !== undefined) : false;
  const failed = stage && CLOSED_LABEL[stage] !== undefined;
  const state = (index: number): string => {
    if (!negotiation) return index === 0 ? "current" : "todo";
    if (stage === "COMPLETED") return "done";
    const current = clubAgreed ? 1 : 0;
    if (index < current) return "done";
    if (index === current) return failed ? "failed" : "current";
    return "todo";
  };
  const clubDetail = negotiation?.agreedFeeEur !== undefined && !isLoan ? (isFreeAgent ? "Ingen klubb" : formatMoney(negotiation.agreedFeeEur)) : negotiation?.agreedWageSharePct !== undefined ? `${negotiation.agreedWageSharePct}% av lönen` : undefined;
  const steps: { label: string; detail?: string }[] = [
    { label: isFreeAgent && !isLoan ? "Fri agent" : isLoan ? "Ägarklubben" : "Klubben", detail: clubDetail },
    { label: isLoan ? "Speltiden" : "Spelaren", detail: stage === "COMPLETED" ? "Överens" : undefined },
    { label: isLoan ? "Lånet" : "Signering", detail: stage === "COMPLETED" ? "Klart" : undefined },
  ];
  // Shared ProgressSteps markup in Transfer Management's own tc-stepper skin.
  return <ProgressSteps className="tc-stepper" label="Förhandlingens steg" steps={steps.map((step, index) => ({ ...step, state: state(index) as StepState }))} />;
}

function StatusBanner({ career, negotiation }: { career: Career; negotiation: TransferNegotiation }) {
  const s = summarizeNegotiation(negotiation);
  const clock = deadlineUrgency(career.gameDate, s.date);
  const rivals = s.activeRivals.length > 0 ? <span className="tc-pill" data-tone="rival">{s.activeRivals.length} konkurrerande klubb{s.activeRivals.length > 1 ? "ar" : ""}</span> : null;
  if (s.nextStep === "WAITING") {
    const p = negotiation.pending!;
    return (
      <div className="tc-status" data-step="WAITING" role="status">
        <span className="tc-wait-mark" aria-hidden="true" />
        <strong>Budet ligger på bordet</strong>
        <span>{p.party === "CLUB" ? "Klubben" : "Spelaren och agenten"} svarar senast {p.responseDate}. Svaret kommer i inkorgen.</span>
        <span className="tc-meter" aria-hidden="true"><i style={{ width: `${Math.round(periodProgress(p.submittedDate, p.responseDate, career.gameDate) * 100)}%` }} /></span>
        {rivals}
      </div>
    );
  }
  if (s.nextStep === "YOUR_MOVE") {
    return (
      <div className="tc-status" data-step="YOUR_MOVE" data-urgency={clock?.urgency} role="status">
        <strong>Ditt drag</strong>
        <span>{s.date ? `${clock ? daysLeftLabel(clock.daysLeft) : ""} -- lägg nästa bud senast ${s.date}, annars förfaller förhandlingen.` : "Lägg ditt bud."}</span>
        {rivals}
      </div>
    );
  }
  return (
    <div className="tc-status" data-step="CLOSED" role="status">
      <strong>{CLOSED_LABEL[negotiation.stage]}</strong>
      {negotiation.closedUntil && <span>Ny kontakt tidigast {negotiation.closedUntil}.</span>}
    </div>
  );
}

function OfferTerms({ round }: { round: Pick<NegotiationRound, "offeredFeeEur" | "offeredWageEurPerMonth" | "contractYears" | "promisedSquadRole" | "signingBonusEur" | "offeredWageSharePct" | "loanEndDate" | "party"> }) {
  if (round.offeredWageSharePct !== undefined) return <div className="tc-terms"><span><small>Lönebidrag</small><b>{round.offeredWageSharePct}%</b></span><span><small>Till</small><b>{round.loanEndDate}</b></span></div>;
  if (round.party === "CLUB") return <div className="tc-terms"><span><small>Övergångssumma</small><b>{formatMoney(round.offeredFeeEur ?? 0)}</b></span></div>;
  if (round.offeredWageEurPerMonth === undefined) return <div className="tc-terms"><span><small>Utlovad roll</small><b>{roleLabel(round.promisedSquadRole)}</b></span></div>;
  return (
    <div className="tc-terms">
      <span><small>Lön</small><b>{formatMoney(round.offeredWageEurPerMonth)}/mån</b></span>
      <span><small>Längd</small><b>{round.contractYears} år</b></span>
      <span><small>Roll</small><b>{roleLabel(round.promisedSquadRole)}</b></span>
      {round.signingBonusEur ? <span><small>Bonus</small><b>{formatMoney(round.signingBonusEur)}</b></span> : null}
    </div>
  );
}

function PartyMark({ party, clubId, player }: { party: "CLUB" | "PLAYER"; clubId: string; player: PlayerMock }) {
  const club = clubId ? getClub(clubId) : undefined;
  if (party === "CLUB" && club) return <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={26} />;
  return <PlayerGlyph player={player} size={26} />;
}

function Timeline({ career, negotiation, player }: { career: Career; negotiation: TransferNegotiation; player: PlayerMock }) {
  const items: ReactNode[] = [];
  const own = getClub(career.playerClubId);
  negotiation.rounds.forEach((round, i) => {
    if (round.party === "MARKET") {
      items.push(<li key={`m${i}`} className="tc-card" data-side="market"><span className="tc-eyebrow">Marknaden · {round.date}</span><p>{localizeMoneyText(round.reason)}</p></li>);
      return;
    }
    const partyName = round.party === "CLUB" ? clubName(negotiation.fromClubId) : `${player.firstName} ${player.lastName}`;
    items.push(
      <li key={`o${i}`} className="tc-card" data-side="manager">
        <header><span className="tc-eyebrow">{own?.shortName ?? "Ni"} · bud till {round.party === "CLUB" ? "klubben" : "spelaren"}</span></header>
        <OfferTerms round={round} />
      </li>,
      <li key={`r${i}`} className="tc-card" data-side="party" data-response={round.response}>
        <header>
          <span className="tc-card-from"><PartyMark party={round.party} clubId={negotiation.fromClubId} player={player} /><span className="tc-eyebrow">{partyName} · {round.date}</span></span>
          <span className="tc-stamp" data-response={round.response}>{RESPONSE_LABEL[round.response]}</span>
        </header>
        <p>{localizeMoneyText(round.reason)}</p>
        {round.counterFeeEur !== undefined && round.response === "COUNTER" && <div className="tc-counter"><span>Klubbens pris</span><strong>{formatMoney(round.counterFeeEur)}</strong></div>}
        {round.counterWageSharePct !== undefined && <div className="tc-counter"><span>Kräver lönebidrag</span><strong>{round.counterWageSharePct}%</strong></div>}
        {round.counterWageEurPerMonth !== undefined && <div className="tc-counter"><span>Lönekrav</span><strong>{formatMoney(round.counterWageEurPerMonth)}/mån</strong></div>}
      </li>,
    );
  });
  if (negotiation.pending) {
    const p = negotiation.pending;
    items.push(
      <li key="pending-offer" className="tc-card" data-side="manager" data-pending="true"><header><span className="tc-eyebrow">{own?.shortName ?? "Ni"} · bud {p.submittedDate}</span></header><OfferTerms round={{ ...p, party: p.party }} /></li>,
      <li key="pending-wait" className="tc-card" data-side="party" data-response="PENDING">
        <div className="tc-wait"><span className="tc-wait-mark" aria-hidden="true" /><p>{p.party === "CLUB" ? clubName(negotiation.fromClubId) : "Spelaren och agenten"} överväger budet. Besked senast {p.responseDate}.</p></div>
      </li>,
    );
  }
  return <ol className="tc-timeline" aria-label="Förhandlingens historik">{items}</ol>;
}
