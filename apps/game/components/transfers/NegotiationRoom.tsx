"use client";
// HM-ALPHA2-05E: the Negotiation Room -- one player, the selling/owning
// club and the player (with his agent) as two distinct parties, every
// offer and answer as a card, the stage visible at all times, and the
// next decision offered in context (meet the counter, adjust, walk away)
// instead of a repeated form. All actions go through the existing
// CareerContext `negotiateTransfer` -> negotiationIntegration.ts; all
// figures are derived from career state, so the room reads the same
// after a save/reload.
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
import { formatEur } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL } from "@/lib/economy/labels";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { getPlayerTrainingCompensation } from "@/lib/economy/trainingCompensationIntegration";
import { getClub, positionLabel } from "@/lib/game-data";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { resolveMarketValueRange } from "@/lib/knowledge/scoutReportVisibility";
import { getExpectedRoleAtBuyer, getLatestNegotiation, getNegotiationAgentFeeEur, isNegotiationOpen, type NegotiationAction } from "@/lib/transfers/negotiationIntegration";
import { getDealSummary, getPlayerTransferStatus, summarizeNegotiation } from "@/lib/transfers/transferCentre";
import type { NegotiationResponse, NegotiationRound, RivalInterest, TransferDealType, TransferNegotiation } from "@/lib/transfers/types";
import { CourtBackdrop } from "./CourtBackdrop";
import { DealCompletion } from "./DealCompletion";

const RESPONSE_LABEL: Record<NegotiationResponse, string> = { ACCEPT: "Accepterar", COUNTER: "Motbud", REJECT: "Nej", BREAK_OFF: "Avbryter" };
const RIVAL_STATUS: Record<RivalInterest["status"], string> = { ACTIVE: "Aktiv", WITHDRAWN: "Drog sig ur", SIGNED: "Värvade spelaren" };
const CLOSED_LABEL: Partial<Record<TransferNegotiation["stage"], string>> = {
  COLLAPSED: "Förhandlingen bröt samman",
  WITHDRAWN: "Du drog dig ur",
  EXPIRED: "Tidsfristen gick ut",
  LOST: "Spelaren gick till en annan klubb",
};

function clubName(clubId: string): string {
  return clubId ? getClub(clubId)?.name ?? clubId : "Fri agent";
}

function roleLabel(role: SquadStatusTier | undefined): string {
  return role ? SQUAD_STATUS_TIER_LABEL_SV[role] : "—";
}

export function NegotiationRoom({ playerId, initialDeal }: { playerId: string; initialDeal: TransferDealType }) {
  const { career, negotiateTransfer } = useCareer();
  const [error, setError] = useState<string | null>(null);
  const [startDeal, setStartDeal] = useState<TransferDealType>(initialDeal);
  const player = getCareerPlayer(career, playerId);
  const contract = getPlayerContract(career, playerId);
  const status = getPlayerTransferStatus(career, playerId);
  if (!player || !status) return <div className="tc-empty">Spelaren kunde inte hittas.</div>;

  const negotiation = getLatestNegotiation(career, playerId, career.playerClubId);
  const summary = negotiation ? summarizeNegotiation(negotiation) : undefined;
  const open = !!negotiation && isNegotiationOpen(negotiation);
  const dealType: TransferDealType = negotiation && (open || negotiation.stage === "COMPLETED") ? negotiation.dealType ?? "PERMANENT" : startDeal;
  const isLoan = dealType === "LOAN";
  const fromClubId = negotiation?.fromClubId ?? status.ownerClubId;
  const isFreeAgent = fromClubId === "" || getPlayerContractStatus(career, playerId) === "FREE_AGENT";
  const offer = negotiation?.offerId ? career.transferOffers[negotiation.offerId] : undefined;
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate);

  function run(action: NegotiationAction) {
    const result = negotiateTransfer(action);
    setError(result.ok ? null : result.error);
  }

  return (
    <div className="tc-page" data-deal={dealType}>
      <header className="tc-room-hero">
        <CourtBackdrop />
        <div className="tc-room-identity">
          <PlayerGlyph player={player} size={84} />
          <div>
            <div className="tc-eyebrow">{isLoan ? "Låneförhandling" : "Övergångsförhandling"} · {positionLabel(player.position)}{age !== null ? ` · ${age} år` : ""}</div>
            <h1>{player.firstName} {player.lastName}</h1>
            <div className="tc-route">
              {fromClubId ? <ClubLink clubId={fromClubId}>{clubName(fromClubId)}</ClubLink> : <span>Fri agent</span>}
              {status.loan && status.loan.borrowingClubId !== fromClubId && <span>(spelar på lån i {clubName(status.loan.borrowingClubId)})</span>}
              <span aria-hidden="true">→</span>
              <ClubLink clubId={career.playerClubId}>{clubName(career.playerClubId)}</ClubLink>
            </div>
          </div>
        </div>
        <Stepper negotiation={negotiation} isLoan={isLoan} isFreeAgent={isFreeAgent} />
      </header>

      {summary && <StatusLine negotiation={summary.negotiation} />}
      {error && <div className="tc-error" role="alert">{error}</div>}

      {negotiation?.stage === "COMPLETED" && offer && <DealCompletion summary={getDealSummary(career, offer)} playerName={`${player.firstName} ${player.lastName}`} />}

      <div className="tc-room">
        <ClubParty career={career} negotiation={negotiation} fromClubId={fromClubId} isLoan={isLoan} playerId={playerId} />

        <div className="tc-table-area">
          {negotiation && negotiation.rounds.length + (negotiation.pending ? 1 : 0) > 0 && <Timeline negotiation={negotiation} />}
          {open ? (
            <Decision key={`${negotiation.id}:${negotiation.rounds.length}:${negotiation.pending ? "p" : "-"}`} negotiation={negotiation} run={run} contractWage={contract?.wageEurPerMonth ?? 0} contractEnd={contract?.contractEndDate ?? ""} />
          ) : negotiation?.stage === "COMPLETED" ? null : (
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

        <PlayerParty career={career} negotiation={negotiation} playerId={playerId} isLoan={isLoan} />
      </div>
    </div>
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
  const steps = [isFreeAgent && !isLoan ? "Fri agent" : isLoan ? "Ägarklubben" : "Klubben", "Spelaren", "Klart"];
  return (
    <ol className="tc-stepper" aria-label="Förhandlingens steg">
      {steps.map((label, index) => (
        <li key={label} data-state={state(index)} aria-current={state(index) === "current" ? "step" : undefined}>
          <i>{state(index) === "done" ? "✓" : index + 1}</i>
          {label}
        </li>
      ))}
    </ol>
  );
}

function StatusLine({ negotiation }: { negotiation: TransferNegotiation }) {
  const s = summarizeNegotiation(negotiation);
  const text = s.nextStep === "WAITING"
    ? <><strong>Väntar på svar från {negotiation.pending?.party === "CLUB" ? "klubben" : "spelaren"}</strong><span>Svar väntas {s.date} -- fortsätt i kalendern.</span></>
    : s.nextStep === "YOUR_MOVE"
      ? <><strong>Ditt drag</strong><span>{s.date ? `Lägg nästa bud senast ${s.date}, annars förfaller förhandlingen.` : "Lägg ditt bud."}</span></>
      : s.nextStep === "COMPLETED"
        ? <><strong>Överenskommelse klar</strong><span>Båda parter har accepterat.</span></>
        : <><strong>{CLOSED_LABEL[negotiation.stage]}</strong>{negotiation.closedUntil && <span>Ny kontakt tidigast {negotiation.closedUntil}.</span>}</>;
  return <div className="tc-status" data-step={s.nextStep} role="status">{text}{s.activeRivals.length > 0 && <span className="tc-pill" data-tone="rival">{s.activeRivals.length} konkurrerande klubb{s.activeRivals.length > 1 ? "ar" : ""}</span>}</div>;
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="tc-facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function ClubParty({ career, negotiation, fromClubId, isLoan, playerId }: { career: ReturnType<typeof useCareer>["career"]; negotiation?: TransferNegotiation; fromClubId: string; isLoan: boolean; playerId: string }) {
  const club = fromClubId ? getClub(fromClubId) : undefined;
  const contractStatus = getPlayerContractStatus(career, playerId);
  const contract = getPlayerContract(career, playerId);
  const value = getPlayerMarketValueEur(career, playerId);
  const range = value !== undefined ? resolveMarketValueRange(value, getPlayerKnowledgePct(career, playerId, fromClubId)) : null;
  const lastClub = negotiation?.rounds.filter((r) => r.party === "CLUB").at(-1);
  const rivals = negotiation?.rivals ?? [];
  return (
    <aside className="tc-party" data-party="CLUB" aria-label="Klubben">
      <header>
        {club ? <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={40} /> : null}
        <div><small>{isLoan ? "Äger kontraktet" : "Säljande klubb"}</small><h3>{club?.name ?? "Ingen klubb -- fri agent"}</h3></div>
      </header>
      <div className="tc-panel-body">
        <Facts rows={[
          ["Kontraktsstatus", contractStatus ? CONTRACT_STATUS_LABEL[contractStatus] : "—"],
          ["Kontrakt t.o.m.", contract?.contractEndDate ?? "—"],
          ["Marknadsvärde", range ? (range.min === range.max ? formatEur(range.min) : `${formatEur(range.min)} – ${formatEur(range.max)}`) : "—"],
          ...(negotiation?.agreedFeeEur !== undefined && !isLoan ? [["Överenskommen summa", formatEur(negotiation.agreedFeeEur)] as [string, ReactNode]] : []),
          ...(negotiation?.agreedWageSharePct !== undefined ? [["Överenskommet lån", `${negotiation.agreedWageSharePct}% · till ${negotiation.loanEndDate}`] as [string, ReactNode]] : []),
        ]} />
        <p className="tc-stance">{lastClub ? lastClub.reason : fromClubId ? "Klubben väntar på ert första besked." : "Spelaren saknar klubb -- ni förhandlar direkt med honom och hans agent."}</p>
        {rivals.length > 0 && (
          <div>
            <div className="tc-eyebrow">Konkurrerande intresse</div>
            <dl className="tc-facts">{rivals.map((r) => <div key={r.clubId}><dt>{clubName(r.clubId)}</dt><dd>{RIVAL_STATUS[r.status]}</dd></div>)}</dl>
          </div>
        )}
      </div>
    </aside>
  );
}

function PlayerParty({ career, negotiation, playerId, isLoan }: { career: ReturnType<typeof useCareer>["career"]; negotiation?: TransferNegotiation; playerId: string; isLoan: boolean }) {
  const player = getCareerPlayer(career, playerId)!;
  const contract = getPlayerContract(career, playerId);
  const expected = negotiation ? getExpectedRoleAtBuyer(career, negotiation) : undefined;
  const agentFee = negotiation && !isLoan ? getNegotiationAgentFeeEur(career, negotiation) : 0;
  const lastPlayer = negotiation?.rounds.filter((r) => r.party === "PLAYER").at(-1);
  const breakdown = lastPlayer?.demandBreakdown ?? [];
  return (
    <aside className="tc-party" data-party="PLAYER" aria-label="Spelaren och agenten">
      <header>
        <PlayerGlyph player={player} size={40} />
        <div><small>Spelaren & agenten</small><h3>{player.firstName} {player.lastName}</h3></div>
      </header>
      <div className="tc-panel-body">
        <Facts rows={[
          ["Nuvarande lön", contract ? `${formatEur(contract.wageEurPerMonth)}/mån` : "—"],
          ["Förväntad roll hos er", expected ? roleLabel(expected) : "Okänd tills förhandlingen öppnas"],
          ...(isLoan ? [["Lön under lånet", "Enligt befintligt avtal"] as [string, ReactNode]] : [["Agentarvode", agentFee ? formatEur(agentFee) : "—"] as [string, ReactNode]]),
          ...(lastPlayer?.demandEurPerMonth && lastPlayer.response === "COUNTER" ? [["Lönekrav", `${formatEur(lastPlayer.counterWageEurPerMonth ?? lastPlayer.demandEurPerMonth)}/mån`] as [string, ReactNode]] : []),
        ]} />
        {breakdown.length > 0 ? (
          <div>
            <div className="tc-eyebrow">Vad som styr kravet</div>
            <ul className="tc-breakdown">{breakdown.map((f) => <li key={f.label}><span>{f.label}</span><b data-sign={f.effectPct > 0 ? "up" : "down"}>{f.effectPct > 0 ? "+" : ""}{f.effectPct}%</b></li>)}</ul>
          </div>
        ) : (
          <p className="tc-stance">{isLoan ? "Spelaren vill ha speltid: en roll högst ett steg under det hans kvalitet motiverar hos er." : "Agenten förklarar spelarens krav när ni har lagt fram villkor."}</p>
        )}
      </div>
    </aside>
  );
}

function OfferTerms({ round }: { round: Pick<NegotiationRound, "offeredFeeEur" | "offeredWageEurPerMonth" | "contractYears" | "promisedSquadRole" | "signingBonusEur" | "offeredWageSharePct" | "loanEndDate" | "party"> }) {
  if (round.offeredWageSharePct !== undefined) return <div className="tc-terms"><span>Lönebidrag <b>{round.offeredWageSharePct}%</b></span><span>Till <b>{round.loanEndDate}</b></span></div>;
  if (round.party === "CLUB") return <div className="tc-terms"><span>Övergångssumma <b>{formatEur(round.offeredFeeEur ?? 0)}</b></span></div>;
  if (round.offeredWageEurPerMonth === undefined) return <div className="tc-terms"><span>Utlovad roll <b>{roleLabel(round.promisedSquadRole)}</b></span></div>;
  return (
    <div className="tc-terms">
      <span>Lön <b>{formatEur(round.offeredWageEurPerMonth)}/mån</b></span>
      <span><b>{round.contractYears}</b> år</span>
      <span>Roll <b>{roleLabel(round.promisedSquadRole)}</b></span>
      {round.signingBonusEur ? <span>Bonus <b>{formatEur(round.signingBonusEur)}</b></span> : null}
    </div>
  );
}

function Timeline({ negotiation }: { negotiation: TransferNegotiation }) {
  const items: ReactNode[] = [];
  negotiation.rounds.forEach((round, i) => {
    if (round.party === "MARKET") {
      items.push(<li key={`m${i}`} className="tc-card" data-side="market"><span className="tc-eyebrow">Marknaden · {round.date}</span><p>{round.reason}</p></li>);
      return;
    }
    const partyName = round.party === "CLUB" ? clubName(negotiation.fromClubId) : "Spelaren";
    items.push(
      <li key={`o${i}`} className="tc-card" data-side="manager">
        <span className="tc-eyebrow">Ert bud till {round.party === "CLUB" ? "klubben" : "spelaren"}</span>
        <OfferTerms round={round} />
      </li>,
      <li key={`r${i}`} className="tc-card" data-side="party" data-response={round.response}>
        <header><span className="tc-eyebrow">{partyName} · {round.date}</span><span className="tc-pill" data-tone={round.response === "ACCEPT" ? "done" : round.response === "COUNTER" ? "wait" : "closed"}>{RESPONSE_LABEL[round.response]}</span></header>
        <p>{round.reason}</p>
        {round.counterFeeEur !== undefined && round.response === "COUNTER" && <div className="tc-counter"><span>Klubbens pris</span><strong>{formatEur(round.counterFeeEur)}</strong></div>}
        {round.counterWageSharePct !== undefined && <div className="tc-counter"><span>Kräver lönebidrag</span><strong>{round.counterWageSharePct}%</strong></div>}
        {round.counterWageEurPerMonth !== undefined && <div className="tc-counter"><span>Lönekrav</span><strong>{formatEur(round.counterWageEurPerMonth)}/mån</strong></div>}
      </li>,
    );
  });
  if (negotiation.pending) {
    const p = negotiation.pending;
    items.push(
      <li key="pending-offer" className="tc-card" data-side="manager"><span className="tc-eyebrow">Ert bud · {p.submittedDate}</span><OfferTerms round={{ ...p, party: p.party }} /></li>,
      <li key="pending-wait" className="tc-card" data-side="party"><div className="tc-wait"><span className="tc-wait-mark" aria-hidden="true" /><p>{p.party === "CLUB" ? "Klubben" : "Spelaren och agenten"} överväger budet. Svar väntas {p.responseDate}.</p></div></li>,
    );
  }
  return <ol className="tc-timeline" aria-label="Förhandlingens historik">{items}</ol>;
}

function StartCard({ negotiation, ownPlayer, loanable, deal, onDeal, onStart, gameDate }: { negotiation?: TransferNegotiation; ownPlayer: boolean; loanable: boolean; deal: TransferDealType; onDeal: (d: TransferDealType) => void; onStart: () => void; gameDate: string }) {
  if (ownPlayer) return <section className="tc-decision"><h3>Spelaren tillhör er klubb</h3><p>Förläng eller hantera hans avtal från spelarprofilen eller kontraktsöversikten.</p><div className="tc-decision-actions"><Link className="hm-btn" href="/career/contracts">Kontraktsöversikt →</Link></div></section>;
  const cooldown = negotiation?.closedUntil && gameDate < negotiation.closedUntil ? negotiation.closedUntil : null;
  return (
    <section className="tc-decision">
      <h3>{negotiation ? "Ny förhandling" : "Inled förhandlingen"}</h3>
      <p>{deal === "LOAN" ? "Ett lån förhandlas med klubben som äger kontraktet: ni föreslår hur stor del av lönen ni betalar och hur länge lånet gäller. Avtalet stannar hos ägarklubben." : "En övergång förhandlas i två steg: först övergångssumman med klubben, sedan lön, längd och roll med spelaren och hans agent. Svaren kommer efter några dagar i kalendern."}</p>
      <div className="tc-decision-actions" role="group" aria-label="Typ av affär">
        <button type="button" className="tc-chip" aria-pressed={deal === "PERMANENT"} onClick={() => onDeal("PERMANENT")}>Permanent övergång</button>
        <button type="button" className="tc-chip" aria-pressed={deal === "LOAN"} onClick={() => onDeal("LOAN")} disabled={!loanable}>Lån</button>
      </div>
      {cooldown ? <p>Samtalen bröts nyligen. Ny kontakt tidigast {cooldown}.</p> : <div className="tc-decision-actions"><button type="button" className="hm-btn hm-btn-primary" onClick={onStart}>Öppna förhandlingen</button></div>}
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
  const marketValue = getPlayerMarketValueEur(career, negotiation.playerId) ?? 0;

  const [fee, setFee] = useState(lastClub?.counterFeeEur ?? lastClub?.offeredFeeEur ?? Math.round(marketValue));
  const [share, setShare] = useState(lastClub?.counterWageSharePct ?? lastClub?.offeredWageSharePct ?? 60);
  const [endDate, setEndDate] = useState(lastClub?.loanEndDate ?? [contractEnd, addDays(career.gameDate, 180)].filter(Boolean).sort()[0]);
  const [wage, setWage] = useState(lastPlayer?.counterWageEurPerMonth ?? lastPlayer?.offeredWageEurPerMonth ?? Math.round(contractWage * 1.1));
  const [years, setYears] = useState(lastPlayer?.contractYears ?? 3);
  const [role, setRole] = useState<SquadStatusTier>(lastPlayer?.promisedSquadRole ?? expected);
  const [bonus, setBonus] = useState(lastPlayer?.signingBonusEur ?? 0);
  const hasCounter = negotiation.stage === "CLUB" ? lastClub?.response === "COUNTER" : lastPlayer?.response === "COUNTER";
  const [editing, setEditing] = useState(!hasCounter);
  const withdraw = <button type="button" className="hm-btn" onClick={() => run({ kind: "WITHDRAW", negotiationId: negotiation.id })}>Dra dig ur</button>;

  if (negotiation.pending) {
    return <section className="tc-decision"><h3>Budet är lagt</h3><p>Ni kan inte ändra budet medan {negotiation.pending.party === "CLUB" ? "klubben" : "spelaren"} överväger det. Svaret kommer {negotiation.pending.responseDate} och syns i inkorgen.</p><div className="tc-decision-actions"><Link className="hm-btn" href="/career/transfers">Till Transfer Centre</Link>{withdraw}</div></section>;
  }

  // The one contextual "meet them" decision for the current counter, if any.
  let meet: { label: string; action: NegotiationAction } | null = null;
  if (negotiation.stage === "CLUB" && lastClub?.response === "COUNTER") {
    if (isLoan && lastClub.counterWageSharePct !== undefined) meet = { label: `Acceptera ${lastClub.counterWageSharePct}% lönebidrag`, action: { kind: "LOAN_TERMS", negotiationId: negotiation.id, wageSharePct: lastClub.counterWageSharePct, endDate: lastClub.loanEndDate ?? endDate } };
    else if (lastClub.counterFeeEur !== undefined) meet = { label: `Betala klubbens pris: ${formatEur(lastClub.counterFeeEur)}`, action: { kind: "FEE", negotiationId: negotiation.id, feeEur: lastClub.counterFeeEur } };
  }
  if (negotiation.stage === "PLAYER" && lastPlayer?.response === "COUNTER") {
    if (isLoan) {
      const wanted = SQUAD_STATUS_TIERS[Math.max(0, SQUAD_STATUS_TIERS.indexOf(expected) + 1)];
      meet = { label: `Lova rollen ${roleLabel(wanted).toLowerCase()}`, action: { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: contractWage, contractYears: 1, promisedSquadRole: wanted } } };
    } else if (lastPlayer.counterWageEurPerMonth !== undefined) {
      meet = { label: `Möt lönekravet: ${formatEur(lastPlayer.counterWageEurPerMonth)}/mån`, action: { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: lastPlayer.counterWageEurPerMonth, contractYears: lastPlayer.contractYears ?? years, promisedSquadRole: lastPlayer.promisedSquadRole ?? role, signingBonusEur: lastPlayer.signingBonusEur ?? 0 } } };
    }
  }

  const title = negotiation.stage === "CLUB" ? (isLoan ? "Ert lånebud till ägarklubben" : "Ert bud till klubben") : isLoan ? "Er rollutfästelse till spelaren" : "Era villkor till spelaren";
  const upfront = (negotiation.agreedFeeEur ?? 0) + trainingComp + agentFee + bonus;

  return (
    <section className="tc-decision" aria-label="Nästa beslut">
      <h3>{title}</h3>
      {meet && <p>Motbudet står {negotiation.expiresDate ? `till ${negotiation.expiresDate}` : "kvar"}. Möt det direkt eller justera ert bud.</p>}
      <div className="tc-decision-actions">
        {meet && <button type="button" className="hm-btn hm-btn-primary" onClick={() => run(meet!.action)}>{meet.label}</button>}
        {meet && !editing && <button type="button" className="hm-btn" onClick={() => setEditing(true)}>Justera budet</button>}
      </div>
      {editing && (
        <form className="tc-offer-form" onSubmit={(e) => { e.preventDefault(); run(
          negotiation.stage === "CLUB"
            ? isLoan ? { kind: "LOAN_TERMS", negotiationId: negotiation.id, wageSharePct: share, endDate } : { kind: "FEE", negotiationId: negotiation.id, feeEur: fee }
            : { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: isLoan ? contractWage : wage, contractYears: isLoan ? 1 : years, promisedSquadRole: role, signingBonusEur: isLoan ? 0 : bonus } },
        ); }}>
          {negotiation.stage === "CLUB" && !isLoan && <label>Övergångssumma (€)<input className="tc-input" type="number" min={0} step={500} value={fee} onChange={(e) => setFee(Number(e.target.value))} /></label>}
          {negotiation.stage === "CLUB" && isLoan && <>
            <label>Lönebidrag ni betalar (%)<input className="tc-input" type="number" min={0} max={100} step={5} value={share} onChange={(e) => setShare(Number(e.target.value))} /></label>
            <label>Lånet slutar<input className="tc-input" type="date" value={endDate} max={contractEnd} onChange={(e) => setEndDate(e.target.value)} /></label>
            <p className="tc-offer-hint">Ni betalar {formatEur(Math.round(contractWage * share / 100))}/mån av hans {formatEur(contractWage)}/mån. Avtalet och resten av lönen stannar hos ägarklubben.</p>
          </>}
          {negotiation.stage === "PLAYER" && !isLoan && <>
            <label>Lön (€/mån)<input className="tc-input" type="number" min={0} step={10} value={wage} onChange={(e) => setWage(Number(e.target.value))} /></label>
            <label>Kontraktslängd<select className="tc-input" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} år</option>)}</select></label>
            <label>Signeringsbonus (€)<input className="tc-input" type="number" min={0} step={500} value={bonus} onChange={(e) => setBonus(Number(e.target.value))} /></label>
          </>}
          {negotiation.stage === "PLAYER" && <label>Utlovad roll<select className="tc-input" value={role} onChange={(e) => setRole(e.target.value as SquadStatusTier)}>{SQUAD_STATUS_TIERS.map((t) => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}{t === expected ? " (förväntad)" : ""}</option>)}</select></label>}
          {negotiation.stage === "PLAYER" && !isLoan && <p className="tc-offer-hint">Vid signering betalar ni {formatEur(upfront)} (övergångssumma, utbildningsersättning, agentarvode {formatEur(agentFee)}{bonus ? " och bonus" : ""}). Bonusen räknas av spelaren som lön utslagen över kontraktet. Den utlovade rollen följer med avtalet.</p>}
          {negotiation.stage === "CLUB" && !isLoan && trainingComp > 0 && <p className="tc-offer-hint">Plus utbildningsersättning {formatEur(trainingComp)} som separat post.</p>}
          <div className="tc-decision-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className={meet ? "hm-btn" : "hm-btn hm-btn-primary"}>{negotiation.stage === "CLUB" ? "Lägg budet" : "Lägg fram villkoren"}</button>
            {withdraw}
          </div>
        </form>
      )}
      {!editing && <div className="tc-decision-actions">{withdraw}</div>}
    </section>
  );
}
