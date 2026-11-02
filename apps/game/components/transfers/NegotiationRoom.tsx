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
import Link from "next/link";
import { useState, type ReactNode } from "react";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink } from "@/components/entityLinks";
import { PlayerGlyph } from "@/components/game/Identity";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { addDays } from "@/lib/career/dateUtils";
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "@/lib/career/squadStatus";
import { playerAgeAtDate } from "@/lib/development/developmentIntegration";
import { currencySymbol, formatMoney, localizeMoneyText } from "@/lib/economy/currency";
import MoneyInput from "@/components/MoneyInput";
import { ProgressSteps, type StepState } from "@/components/experience/primitives";
import { useMoney } from "@/lib/settings/usePreferences";
import { CONTRACT_STATUS_LABEL } from "@/lib/economy/labels";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { getPlayerTrainingCompensation } from "@/lib/economy/trainingCompensationIntegration";
import { getClubBudgets } from "@/lib/economy/clubEconomyIntegration";
import { getClub, positionLabel, type PlayerMock } from "@/lib/game-data";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { resolveMarketValueRange } from "@/lib/knowledge/scoutReportVisibility";
import { getExpectedRoleAtBuyer, getLatestNegotiation, getNegotiationAgentFeeEur, isNegotiationOpen, type NegotiationAction } from "@/lib/transfers/negotiationIntegration";
import { getDealSummary, getPlayerTransferStatus, summarizeNegotiation } from "@/lib/transfers/transferCentre";
import type { NegotiationResponse, NegotiationRound, RivalInterest, TransferDealType, TransferNegotiation } from "@/lib/transfers/types";
import { DealCompletion } from "./DealCompletion";
import { NEGOTIATION_ROOM_BACKDROP, daysLeftLabel, deadlineUrgency, periodProgress } from "./transferVisuals";

const RESPONSE_LABEL: Record<NegotiationResponse, string> = { ACCEPT: "Accepterar", COUNTER: "Motbud", REJECT: "Avböjer", BREAK_OFF: "Avbryter" };
const RIVAL_STATUS: Record<RivalInterest["status"], string> = { ACTIVE: "Aktiv", WITHDRAWN: "Drog sig ur", SIGNED: "Värvade spelaren" };
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

  return (
    <div className="tc-page tc-room-page" data-deal={dealType}>
      {completed && offer ? (
        <DealCompletion summary={getDealSummary(career, offer)} player={player} />
      ) : (
        <RoomHero career={career} player={player} negotiation={negotiation} fromClubId={fromClubId} isLoan={isLoan} isFreeAgent={isFreeAgent} loanBorrower={status.loan?.borrowingClubId} />
      )}

      {negotiation && !completed && <StatusBanner career={career} negotiation={negotiation} />}
      {error && <div className="tc-error" role="alert">{localizeMoneyText(error)}</div>}

      {/* A completed deal shows its record only: the party cards describe the LIVE market position, which no longer applies once he has signed. */}
      <div className={completed ? "tc-room tc-room-history" : "tc-room"}>
        {!completed && <ClubParty career={career} negotiation={negotiation} fromClubId={fromClubId} isLoan={isLoan} playerId={playerId} />}

        <div className="tc-table-area">
          {completed && <h3 className="tc-section-title">Så gick förhandlingen</h3>}
          {negotiation && negotiation.rounds.length + (negotiation.pending ? 1 : 0) > 0 && <Timeline career={career} negotiation={negotiation} player={player} />}
          {open ? (
            <Decision key={`${negotiation.id}:${negotiation.rounds.length}:${negotiation.pending ? "p" : "-"}`} negotiation={negotiation} run={run} contractWage={contract?.wageEurPerMonth ?? 0} contractEnd={contract?.contractEndDate ?? ""} />
          ) : completed ? null : (
            <StartCard
              negotiation={negotiation}
              ownPlayer={status.isOwnPlayer}
              loanable={!isFreeAgent && !status.loan}
              deal={startDeal}
              onDeal={setStartDeal}
              onStart={() => run({ kind: "START", playerId, dealType: startDeal })}
              gameDate={career.gameDate}
            />
          )}
        </div>

        {!completed && <PlayerParty career={career} negotiation={negotiation} playerId={playerId} isLoan={isLoan} />}
      </div>
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

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="tc-facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function ClubParty({ career, negotiation, fromClubId, isLoan, playerId }: { career: Career; negotiation?: TransferNegotiation; fromClubId: string; isLoan: boolean; playerId: string }) {
  const club = fromClubId ? getClub(fromClubId) : undefined;
  const contractStatus = getPlayerContractStatus(career, playerId);
  const contract = getPlayerContract(career, playerId);
  const value = getPlayerMarketValueEur(career, playerId);
  const range = value !== undefined ? resolveMarketValueRange(value, getPlayerKnowledgePct(career, playerId, fromClubId), playerId) : null;
  const lastClub = negotiation?.rounds.filter((r) => r.party === "CLUB").at(-1);
  const rivals = negotiation?.rivals ?? [];
  const agreed = negotiation?.agreedFeeEur !== undefined || negotiation?.agreedWageSharePct !== undefined;
  return (
    <aside className="tc-party" data-party="CLUB" data-agreed={agreed} aria-label="Klubben">
      <header>
        {club ? <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={44} /> : <span className="tc-party-mark" aria-hidden="true">FA</span>}
        <div><small>{isLoan ? "Äger kontraktet" : club ? "Säljande klubb" : "Ingen klubb"}</small><h3>{club?.name ?? "Fri agent"}</h3></div>
        {agreed && <span className="tc-pill" data-tone="done">Överens</span>}
      </header>
      <div className="tc-panel-body">
        <blockquote className="tc-stance" data-response={lastClub?.response}>{lastClub ? localizeMoneyText(lastClub.reason) : fromClubId ? "Klubben väntar på ert första besked." : "Spelaren saknar klubb -- ni förhandlar direkt med honom och hans agent."}</blockquote>
        <Facts rows={[
          ["Kontrakt", contractStatus ? CONTRACT_STATUS_LABEL[contractStatus] : "—"],
          ["Avtal t.o.m.", contract?.contractEndDate ?? "—"],
          ["Marknadsvärde", range ? (range.min === range.max ? formatMoney(range.min) : `${formatMoney(range.min)} – ${formatMoney(range.max)}`) : "—"],
          ...(negotiation?.agreedFeeEur !== undefined && !isLoan ? [["Överenskommen summa", formatMoney(negotiation.agreedFeeEur)] as [string, ReactNode]] : []),
          ...(negotiation?.agreedWageSharePct !== undefined ? [["Överenskommet lån", `${negotiation.agreedWageSharePct}% · till ${negotiation.loanEndDate}`] as [string, ReactNode]] : []),
        ]} />
        {rivals.length > 0 && (
          <div className="tc-rivals">
            <div className="tc-eyebrow">Konkurrerande intresse</div>
            <ul>{rivals.map((r) => <li key={r.clubId} data-status={r.status}><span>{clubName(r.clubId)}</span><b>{RIVAL_STATUS[r.status]}</b></li>)}</ul>
          </div>
        )}
      </div>
    </aside>
  );
}

function PlayerParty({ career, negotiation, playerId, isLoan }: { career: Career; negotiation?: TransferNegotiation; playerId: string; isLoan: boolean }) {
  const player = getCareerPlayer(career, playerId)!;
  const contract = getPlayerContract(career, playerId);
  const expected = negotiation ? getExpectedRoleAtBuyer(career, negotiation) : undefined;
  const agentFee = negotiation && !isLoan ? getNegotiationAgentFeeEur(career, negotiation) : 0;
  const lastPlayer = negotiation?.rounds.filter((r) => r.party === "PLAYER").at(-1);
  const breakdown = lastPlayer?.demandBreakdown ?? [];
  const demand = lastPlayer?.response === "COUNTER" ? lastPlayer.counterWageEurPerMonth ?? lastPlayer.demandEurPerMonth : undefined;
  return (
    <aside className="tc-party" data-party="PLAYER" aria-label="Spelaren och agenten">
      <header>
        <PlayerGlyph player={player} size={44} />
        <div><small>Spelaren & agenten</small><h3>{player.firstName} {player.lastName}</h3></div>
      </header>
      <div className="tc-panel-body">
        {lastPlayer ? <blockquote className="tc-stance" data-response={lastPlayer.response}>{localizeMoneyText(lastPlayer.reason)}</blockquote> : null}
        {demand ? <div className="tc-demand"><small>Lönekrav</small><strong>{formatMoney(demand)}<em>/mån</em></strong></div> : null}
        <Facts rows={[
          ["Nuvarande lön", contract ? `${formatMoney(contract.wageEurPerMonth)}/mån` : "—"],
          ["Förväntad roll hos er", expected ? roleLabel(expected) : "Visas när förhandlingen öppnas"],
          ...(isLoan ? [["Lön under lånet", "Enligt befintligt avtal"] as [string, ReactNode]] : [["Agentarvode", agentFee ? formatMoney(agentFee) : "—"] as [string, ReactNode]]),
        ]} />
        {breakdown.length > 0 ? (
          <div>
            <div className="tc-eyebrow">Vad som styr kravet</div>
            <ul className="tc-breakdown">{breakdown.map((f) => <li key={f.label}><span>{f.label}</span><b data-sign={f.effectPct > 0 ? "up" : "down"}>{f.effectPct > 0 ? "+" : ""}{f.effectPct}%</b><i aria-hidden="true" data-sign={f.effectPct > 0 ? "up" : "down"} style={{ width: `${Math.min(100, Math.abs(f.effectPct) * 4)}%` }} /></li>)}</ul>
          </div>
        ) : (
          <p className="tc-note">{isLoan ? "Spelaren vill ha speltid: en roll högst ett steg under det hans kvalitet motiverar hos er." : "Agenten förklarar spelarens krav när ni har lagt fram villkor."}</p>
        )}
      </div>
    </aside>
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

function StartCard({ negotiation, ownPlayer, loanable, deal, onDeal, onStart, gameDate }: { negotiation?: TransferNegotiation; ownPlayer: boolean; loanable: boolean; deal: TransferDealType; onDeal: (d: TransferDealType) => void; onStart: () => void; gameDate: string }) {
  if (ownPlayer) return <section className="tc-decision"><h3>Spelaren tillhör er klubb</h3><p>Förläng eller hantera hans avtal från spelarprofilen eller kontraktsöversikten.</p><div className="tc-decision-actions"><Link className="hm-btn" href="/career/contracts">Kontraktsöversikt →</Link></div></section>;
  const cooldown = negotiation?.closedUntil && gameDate < negotiation.closedUntil ? negotiation.closedUntil : null;
  return (
    <section className="tc-decision tc-start" aria-label="Inled förhandling">
      <div className="tc-eyebrow">{negotiation ? "Ny förhandling" : "Inled förhandlingen"}</div>
      <div className="tc-deal-choice" role="radiogroup" aria-label="Typ av affär">
        <button type="button" role="radio" aria-checked={deal === "PERMANENT"} onClick={() => onDeal("PERMANENT")}>
          <strong>Permanent övergång</strong>
          <span>Övergångssumma med klubben, därefter lön, längd och roll med spelaren och hans agent.</span>
        </button>
        <button type="button" role="radio" aria-checked={deal === "LOAN"} onClick={() => onDeal("LOAN")} disabled={!loanable}>
          <strong>Lån</strong>
          <span>{loanable ? "Lönebidrag och längd med klubben som äger avtalet, därefter speltid med spelaren. Avtalet stannar hos ägaren." : "Inte möjligt -- spelaren är kontraktslös eller redan utlånad."}</span>
        </button>
      </div>
      {cooldown ? <p>Samtalen bröts nyligen. Ny kontakt tidigast {cooldown}.</p> : <div className="tc-decision-actions"><button type="button" className="hm-btn hm-btn-primary tc-cta" onClick={onStart}>Öppna förhandlingen →</button><span className="tc-note">Svaren kommer efter några dagar i kalendern.</span></div>}
    </section>
  );
}

function Decision({ negotiation, run, contractWage, contractEnd }: { negotiation: TransferNegotiation; run: (a: NegotiationAction) => void; contractWage: number; contractEnd: string }) {
  const { career } = useCareer();
  const isLoan = negotiation.dealType === "LOAN";
  const lastClub = negotiation.rounds.filter((r) => r.party === "CLUB").at(-1);
  const lastPlayer = negotiation.rounds.filter((r) => r.party === "PLAYER").at(-1);
  const expected = getExpectedRoleAtBuyer(career, negotiation);
  const trainingComp = getPlayerTrainingCompensation(career, negotiation.playerId)?.totalEur ?? 0;
  const agentFee = isLoan ? 0 : getNegotiationAgentFeeEur(career, negotiation);
  // Default first bid: the middle of the knowledge-gated value range the manager can see -- never the hidden exact value.
  const marketValue = getPlayerMarketValueEur(career, negotiation.playerId) ?? 0;
  const visibleRange = resolveMarketValueRange(marketValue, getPlayerKnowledgePct(career, negotiation.playerId, negotiation.fromClubId), negotiation.playerId);
  const clock = deadlineUrgency(career.gameDate, negotiation.expiresDate);
  const budgetEur = getClubBudgets(career, career.playerClubId)?.transferBudgetEur ?? 0;

  const [fee, setFee] = useState(lastClub?.counterFeeEur ?? lastClub?.offeredFeeEur ?? Math.round((visibleRange.min + visibleRange.max) / 2 / 100) * 100);
  const [share, setShare] = useState(lastClub?.counterWageSharePct ?? lastClub?.offeredWageSharePct ?? 60);
  const [endDate, setEndDate] = useState(lastClub?.loanEndDate ?? [contractEnd, addDays(career.gameDate, 180)].filter(Boolean).sort()[0]);
  const [wage, setWage] = useState(lastPlayer?.counterWageEurPerMonth ?? lastPlayer?.offeredWageEurPerMonth ?? Math.round(contractWage * 1.1));
  const [years, setYears] = useState(lastPlayer?.contractYears ?? 3);
  const [role, setRole] = useState<SquadStatusTier>(lastPlayer?.promisedSquadRole ?? expected);
  const [bonus, setBonus] = useState(lastPlayer?.signingBonusEur ?? 0);
  const hasCounter = negotiation.stage === "CLUB" ? lastClub?.response === "COUNTER" : lastPlayer?.response === "COUNTER";
  const [editing, setEditing] = useState(!hasCounter);
  const withdraw = <button type="button" className="hm-btn tc-quiet" onClick={() => run({ kind: "WITHDRAW", negotiationId: negotiation.id })}>Dra dig ur</button>;

  if (negotiation.pending) {
    return <section className="tc-decision" data-mode="waiting"><h3>Inget att göra just nu</h3><p>Budet kan inte ändras medan {negotiation.pending.party === "CLUB" ? "klubben" : "spelaren"} överväger det. Fortsätt i kalendern -- svaret kommer {negotiation.pending.responseDate} och visas i inkorgen.</p><div className="tc-decision-actions"><Link className="hm-btn" href="/career/transfers">Till Transfer Centre</Link>{withdraw}</div></section>;
  }

  // The one contextual "meet them" decision for the current counter, if any.
  let meet: { label: string; detail: string; action: NegotiationAction } | null = null;
  if (negotiation.stage === "CLUB" && lastClub?.response === "COUNTER") {
    if (isLoan && lastClub.counterWageSharePct !== undefined) meet = { label: `Acceptera ${lastClub.counterWageSharePct}% lönebidrag`, detail: `Ni betalar ${formatMoney(Math.round(contractWage * lastClub.counterWageSharePct / 100))}/mån av hans lön.`, action: { kind: "LOAN_TERMS", negotiationId: negotiation.id, wageSharePct: lastClub.counterWageSharePct, endDate: lastClub.loanEndDate ?? endDate } };
    else if (lastClub.counterFeeEur !== undefined) meet = { label: `Betala klubbens pris: ${formatMoney(lastClub.counterFeeEur)}`, detail: trainingComp > 0 ? `Plus utbildningsersättning ${formatMoney(trainingComp)}.` : "Därefter förhandlar ni villkor med spelaren.", action: { kind: "FEE", negotiationId: negotiation.id, feeEur: lastClub.counterFeeEur } };
  }
  if (negotiation.stage === "PLAYER" && lastPlayer?.response === "COUNTER") {
    if (isLoan) {
      const wanted = SQUAD_STATUS_TIERS[Math.max(0, SQUAD_STATUS_TIERS.indexOf(expected) + 1)];
      meet = { label: `Lova rollen ${roleLabel(wanted).toLowerCase()}`, detail: "Rollen sätts i truppen när han anländer.", action: { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: contractWage, contractYears: 1, promisedSquadRole: wanted } } };
    } else if (lastPlayer.counterWageEurPerMonth !== undefined) {
      meet = { label: `Möt lönekravet: ${formatMoney(lastPlayer.counterWageEurPerMonth)}/mån`, detail: `${lastPlayer.contractYears ?? years} år · ${roleLabel(lastPlayer.promisedSquadRole ?? role).toLowerCase()} · vid signering ${formatMoney((negotiation.agreedFeeEur ?? 0) + trainingComp + agentFee + (lastPlayer.signingBonusEur ?? 0))}.`, action: { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: lastPlayer.counterWageEurPerMonth, contractYears: lastPlayer.contractYears ?? years, promisedSquadRole: lastPlayer.promisedSquadRole ?? role, signingBonusEur: lastPlayer.signingBonusEur ?? 0 } } };
    }
  }

  const title = negotiation.stage === "CLUB" ? (isLoan ? "Ert lånebud till ägarklubben" : "Ert bud till klubben") : isLoan ? "Er rollutfästelse till spelaren" : "Era villkor till spelaren";
  const upfront = (negotiation.agreedFeeEur ?? 0) + trainingComp + agentFee + bonus;

  return (
    <section className="tc-decision" data-mode={meet ? "counter" : "offer"} data-urgency={clock?.urgency} aria-label="Nästa beslut">
      <header className="tc-decision-head">
        <h3>{meet ? "Motbudet står kvar" : title}</h3>
        {clock && <span className="tc-pill" data-tone={clock.urgency === "urgent" || clock.urgency === "overdue" ? "move" : clock.urgency === "soon" ? "wait" : undefined}>{daysLeftLabel(clock.daysLeft)}</span>}
      </header>
      {meet && (
        <button type="button" className="tc-meet" onClick={() => run(meet!.action)}>
          <strong>{meet.label}</strong>
          <span>{meet.detail}</span>
        </button>
      )}
      {meet && !editing && <div className="tc-decision-actions"><button type="button" className="hm-btn" onClick={() => setEditing(true)}>Justera budet i stället</button>{withdraw}</div>}
      {editing && (
        // noValidate: the input `step`s are arrow-key increments only -- the negotiation rules round every figure themselves, and a browser step mismatch (e.g. a 4 400 € default with step 500) must never silently block the offer.
        <form className="tc-offer-form" noValidate onSubmit={(e) => { e.preventDefault(); run(
          negotiation.stage === "CLUB"
            ? isLoan ? { kind: "LOAN_TERMS", negotiationId: negotiation.id, wageSharePct: share, endDate } : { kind: "FEE", negotiationId: negotiation.id, feeEur: fee }
            : { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: isLoan ? contractWage : wage, contractYears: isLoan ? 1 : years, promisedSquadRole: role, signingBonusEur: isLoan ? 0 : bonus } },
        ); }}>
          {meet && <div className="tc-eyebrow tc-form-title">{title}</div>}
          {negotiation.stage === "CLUB" && !isLoan && <label>Övergångssumma ({currencySymbol()})<MoneyInput className="tc-input" minEur={0} stepEur={500} valueEur={fee} onChangeEur={setFee} /></label>}
          {negotiation.stage === "CLUB" && isLoan && <>
            <label>Lönebidrag ni betalar (%)<input className="tc-input" type="number" min={0} max={100} step={5} value={share} onChange={(e) => setShare(Number(e.target.value))} /></label>
            <label>Lånet slutar<input className="tc-input" type="date" value={endDate} max={contractEnd} onChange={(e) => setEndDate(e.target.value)} /></label>
            <p className="tc-offer-hint">Ni betalar {formatMoney(Math.round(contractWage * share / 100))}/mån av hans {formatMoney(contractWage)}/mån. Avtalet och resten av lönen stannar hos ägarklubben.</p>
          </>}
          {negotiation.stage === "PLAYER" && !isLoan && <>
            <label>Lön ({currencySymbol()}/mån)<MoneyInput className="tc-input" minEur={0} stepEur={10} valueEur={wage} onChangeEur={setWage} /></label>
            <label>Kontraktslängd<select className="tc-input" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} år</option>)}</select></label>
            <label>Signeringsbonus ({currencySymbol()})<MoneyInput className="tc-input" minEur={0} stepEur={500} valueEur={bonus} onChangeEur={setBonus} /></label>
          </>}
          {negotiation.stage === "PLAYER" && <label>Utlovad roll<select className="tc-input" value={role} onChange={(e) => setRole(e.target.value as SquadStatusTier)}>{SQUAD_STATUS_TIERS.map((t) => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}{t === expected ? " (förväntad)" : ""}</option>)}</select></label>}
          {negotiation.stage === "PLAYER" && !isLoan && <p className="tc-offer-hint">Vid signering betalar ni <b>{formatMoney(upfront)}</b>: övergångssumma, utbildningsersättning, agentarvode {formatMoney(agentFee)}{bonus ? " och bonus" : ""}. Bonusen räknas av spelaren som lön utslagen över kontraktet. Den utlovade rollen följer med avtalet.</p>}
          {negotiation.stage === "CLUB" && !isLoan && <p className="tc-offer-hint">Hela affären kostar <b>{formatMoney(fee + trainingComp + agentFee)}</b>: övergångssumma{trainingComp > 0 ? `, utbildningsersättning ${formatMoney(trainingComp)}` : ""} och agentarvode {formatMoney(agentFee)}. Transferbudget {formatMoney(Math.round(budgetEur))}.</p>}
          <div className="tc-decision-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className={meet ? "hm-btn" : "hm-btn hm-btn-primary tc-cta"}>{negotiation.stage === "CLUB" ? "Lägg budet" : "Lägg fram villkoren"}</button>
            {withdraw}
          </div>
        </form>
      )}
    </section>
  );
}
