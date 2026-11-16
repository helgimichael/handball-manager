"use client";
// Arena Nights 231 -- the Negotiation Room's decision surfaces.
//  * TermSheet (REC-04 A + REC-04c A, keeps REC-04b A FeeRangeBand): "Vårt bud" and "Deras krav" aligned term
//    by term with the gap between them, a live total-cost readout and the budget waterfall impact. Submits
//    exactly the actions the room always submitted (FEE / LOAN_TERMS / TERMS / WITHDRAW) through
//    CareerContext.negotiateTransfer -- no negotiation rule is computed here.
//  * WaitingCard (REC-04d A): when the answer is due, "Spela fram till svaret" runs the ordinary Continue
//    (it stops on any other important event) and the days in between are previewed from the Week Spine.
//  * StartChoice (REC-04a A): Permanent vs Lån as two cards with what will be negotiated, the knowledge-gated
//    value range and the real readiness checklist; own-player and cooling-off as proper states.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import MoneyInput from "@/components/MoneyInput";
import { progressionNotice, type ProgressionNotice } from "@/components/game/progressionPresentation";
import { useCareer } from "@/lib/career/CareerContext";
import { resolveContextualContinueAction } from "@/lib/career/contextualContinueAction";
import { addDays } from "@/lib/career/dateUtils";
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "@/lib/career/squadStatus";
import { currencySymbol, formatMoney, localizeMoneyText } from "@/lib/economy/currency";
import { getClubBudgets } from "@/lib/economy/clubEconomyIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { calculatePlayerTrainingCompensation } from "@/lib/economy/trainingCompensationIntegration";
import { getClub, type HandballPosition } from "@/lib/game-data";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { resolveMarketValueRange } from "@/lib/knowledge/scoutReportVisibility";
import { getExpectedRoleAtBuyer, getNegotiationAgentFeeEur, type NegotiationAction } from "@/lib/transfers/negotiationIntegration";
import { calculateAcquisitionCost } from "@/lib/transfers/trainingCompensation";
import type { TransferDealType, TransferNegotiation } from "@/lib/transfers/types";
import { budgetWaterfall, dealReadiness, daysUntilAnswer, roleContext, termGap, type TermGap } from "@/lib/transfers/transferDesk";
import { BudgetWaterfall } from "./BudgetWaterfall";
import { ReadinessList } from "./DealDrawer";
import { FeeRangeBand } from "./FeeRangeBand";
import { daysLeftLabel, deadlineUrgency, weekdayDate } from "./transferVisuals";

const roleLabel = (role: SquadStatusTier | undefined) => (role ? SQUAD_STATUS_TIER_LABEL_SV[role] : "—");
const fmtGap = (n: number) => formatMoney(n);
const RIVAL_STATUS = { ACTIVE: "Aktiv", WITHDRAWN: "Drog sig ur", SIGNED: "Värvade spelaren" } as const;

/** "Dra dig ur" behind a confirm -- the WITHDRAW action itself is unchanged. */
export function WithdrawButton({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className="hm-btn tc-quiet" onClick={() => setAsking(true)}>Dra dig ur</button>;
  return (
    <span className="tx-confirm" role="group" aria-label="Bekräfta att du drar dig ur">
      <span>Förhandlingen avslutas och klubben kan spärra nya samtal en tid.</span>
      <button type="button" className="hm-btn hm-btn-sm" onClick={onConfirm}>Ja, dra dig ur</button>
      <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => setAsking(false)}>Avbryt</button>
    </span>
  );
}

function Step({ label, value, step, min = 0, max, onChange, children }: { label: string; value: number; step: number; min?: number; max?: number; onChange: (v: number) => void; children: ReactNode }) {
  return (
    <div className="tx-step">
      <button type="button" aria-label={`Sänk ${label}`} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      {children}
      <button type="button" aria-label={`Höj ${label}`} onClick={() => onChange(max === undefined ? value + step : Math.min(max, value + step))}>+</button>
    </div>
  );
}

function TermRow({ label, ours, theirs, gap, onMeet, note, locked }: { label: string; ours: ReactNode; theirs: ReactNode; gap?: TermGap | null; onMeet?: () => void; note?: ReactNode; locked?: boolean }) {
  return (
    <div className="tx-term" role="row" data-locked={locked || undefined}>
      <div className="tx-term-label" role="rowheader">{label}</div>
      <div className="tx-term-ours" role="cell">{ours}</div>
      <div className="tx-term-gap" role="cell" data-met={gap ? String(gap.met) : undefined}>
        <span>{gap ? gap.label : locked ? "Klart" : "—"}</span>
        {onMeet && gap && !gap.met && <button type="button" className="tx-linkbtn" onClick={onMeet}>Möt motbudet</button>}
      </div>
      <div className="tx-term-theirs" role="cell"><small className="tx-term-mobile-label">Deras krav</small>{theirs}</div>
      {note && <div className="tx-term-note">{note}</div>}
    </div>
  );
}

export function TermSheet({ negotiation, run, contractWage, contractEnd, position, clubName, playerName }: {
  negotiation: TransferNegotiation;
  run: (a: NegotiationAction) => void;
  contractWage: number;
  contractEnd: string;
  position: HandballPosition;
  clubName: string;
  playerName: string;
}) {
  const { career } = useCareer();
  const formId = useId();
  const isLoan = negotiation.dealType === "LOAN";
  const clubStage = negotiation.stage === "CLUB";
  const lastClub = negotiation.rounds.filter((r) => r.party === "CLUB").at(-1);
  const lastPlayer = negotiation.rounds.filter((r) => r.party === "PLAYER").at(-1);
  const expected = getExpectedRoleAtBuyer(career, negotiation);
  const trainingCompDetail = calculatePlayerTrainingCompensation(career, negotiation.playerId, career.playerClubId, negotiation.fromClubId);
  const trainingComp = trainingCompDetail.totalEur;
  const agentFee = isLoan ? 0 : getNegotiationAgentFeeEur(career, negotiation);
  // Default first bid: the middle of the knowledge-gated value range the manager can see -- never the hidden exact value.
  const marketValue = getPlayerMarketValueEur(career, negotiation.playerId) ?? 0;
  const visibleRange = resolveMarketValueRange(marketValue, getPlayerKnowledgePct(career, negotiation.playerId, negotiation.fromClubId), negotiation.playerId);
  const clock = deadlineUrgency(career.gameDate, negotiation.expiresDate);
  const budgets = getClubBudgets(career, career.playerClubId);
  const budgetEur = budgets?.transferBudgetEur ?? 0;
  const cashBalance = career.clubEconomies[career.playerClubId]?.cashEur ?? 0;
  const roles = roleContext(career, position);

  const [fee, setFee] = useState(lastClub?.counterFeeEur ?? lastClub?.offeredFeeEur ?? Math.round((visibleRange.min + visibleRange.max) / 2 / 100) * 100);
  const [share, setShare] = useState(lastClub?.counterWageSharePct ?? lastClub?.offeredWageSharePct ?? 60);
  const [endDate, setEndDate] = useState(lastClub?.loanEndDate ?? [contractEnd, addDays(career.gameDate, 180)].filter(Boolean).sort()[0]);
  const [wage, setWage] = useState(lastPlayer?.counterWageEurPerMonth ?? lastPlayer?.offeredWageEurPerMonth ?? Math.round(contractWage * 1.1));
  const [years, setYears] = useState(lastPlayer?.contractYears ?? 3);
  const [role, setRole] = useState<SquadStatusTier>(lastPlayer?.promisedSquadRole ?? expected);
  const [bonus, setBonus] = useState(lastPlayer?.signingBonusEur ?? 0);

  // The one contextual "accept their counter" decision, if any -- the exact action the room always offered.
  let meet: { label: string; detail: string; action: NegotiationAction } | null = null;
  if (clubStage && lastClub?.response === "COUNTER") {
    if (isLoan && lastClub.counterWageSharePct !== undefined) meet = { label: `Acceptera ${lastClub.counterWageSharePct}% lönebidrag`, detail: `Ni betalar ${formatMoney(Math.round(contractWage * lastClub.counterWageSharePct / 100))}/mån av hans lön.`, action: { kind: "LOAN_TERMS", negotiationId: negotiation.id, wageSharePct: lastClub.counterWageSharePct, endDate: lastClub.loanEndDate ?? endDate } };
    else if (lastClub.counterFeeEur !== undefined) meet = { label: `Betala klubbens pris: ${formatMoney(lastClub.counterFeeEur)}`, detail: trainingComp > 0 ? `Plus utbildningsersättning ${formatMoney(trainingComp)}.` : "Därefter förhandlar ni villkor med spelaren.", action: { kind: "FEE", negotiationId: negotiation.id, feeEur: lastClub.counterFeeEur } };
  }
  if (!clubStage && lastPlayer?.response === "COUNTER") {
    if (isLoan) {
      const wanted = SQUAD_STATUS_TIERS[Math.max(0, SQUAD_STATUS_TIERS.indexOf(expected) + 1)];
      meet = { label: `Lova rollen ${roleLabel(wanted).toLowerCase()}`, detail: "Rollen sätts i truppen när han anländer.", action: { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: contractWage, contractYears: 1, promisedSquadRole: wanted } } };
    } else if (lastPlayer.counterWageEurPerMonth !== undefined) {
      meet = { label: `Möt lönekravet: ${formatMoney(lastPlayer.counterWageEurPerMonth)}/mån`, detail: `${lastPlayer.contractYears ?? years} år · ${roleLabel(lastPlayer.promisedSquadRole ?? role).toLowerCase()} · vid signering ${formatMoney((negotiation.agreedFeeEur ?? 0) + trainingComp + agentFee + (lastPlayer.signingBonusEur ?? 0))}.`, action: { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: lastPlayer.counterWageEurPerMonth, contractYears: lastPlayer.contractYears ?? years, promisedSquadRole: lastPlayer.promisedSquadRole ?? role, signingBonusEur: lastPlayer.signingBonusEur ?? 0 } } };
    }
  }

  const submit = () => run(
    clubStage
      ? isLoan ? { kind: "LOAN_TERMS", negotiationId: negotiation.id, wageSharePct: share, endDate } : { kind: "FEE", negotiationId: negotiation.id, feeEur: fee }
      : { kind: "TERMS", negotiationId: negotiation.id, terms: { wageEurPerMonth: isLoan ? contractWage : wage, contractYears: isLoan ? 1 : years, promisedSquadRole: role, signingBonusEur: isLoan ? 0 : bonus } },
  );

  // Their side, term by term.
  const theirFee = lastClub?.response === "COUNTER" ? lastClub.counterFeeEur : undefined;
  const theirShare = lastClub?.counterWageSharePct;
  const theirWage = lastPlayer?.response === "COUNTER" ? lastPlayer.counterWageEurPerMonth ?? lastPlayer.demandEurPerMonth : undefined;
  const feeGap = termGap(fee, theirFee, fmtGap);
  const shareGap = theirShare === undefined ? null : termGap(share, theirShare, (n) => `${n} %-enheter`);
  const wageGap = termGap(wage, theirWage, fmtGap);
  const mainGap = clubStage ? (isLoan ? shareGap : feeGap) : isLoan ? null : wageGap;

  // Cost readout (the same acquisition-cost helper the room always used).
  const currentFee = clubStage ? fee : negotiation.agreedFeeEur ?? 0;
  const currentBonus = clubStage ? lastPlayer?.signingBonusEur ?? 0 : bonus;
  const proposedWage = isLoan ? Math.round(contractWage * (negotiation.agreedWageSharePct ?? share) / 100) : clubStage ? lastPlayer?.counterWageEurPerMonth ?? contractWage : wage;
  const proposedYears = clubStage ? lastPlayer?.contractYears ?? 3 : years;
  const acq = calculateAcquisitionCost({ transferFeeEur: isLoan ? 0 : currentFee, trainingCompensationEur: isLoan ? 0 : trainingComp, signingCostsEur: isLoan ? 0 : agentFee + currentBonus, monthlyWageEur: proposedWage, contractYears: isLoan ? 1 : proposedYears, compensationDetails: trainingCompDetail });
  const immediateCost = acq.transferFeeEur + acq.trainingCompensationEur + acq.signingCostsEur;
  const w = budgetWaterfall(career, { upFrontEur: immediateCost, wageEurPerMonth: proposedWage });
  const title = clubStage ? (isLoan ? "Ert lånebud till ägarklubben" : "Ert bud till klubben") : isLoan ? "Er rollutfästelse till spelaren" : "Era villkor till spelaren";
  const cta = clubStage ? "Lägg budet" : "Lägg fram villkoren";
  const stance = clubStage ? lastClub : lastPlayer;
  const breakdown = lastPlayer?.demandBreakdown ?? [];

  return (
    <section className="tx-sheet-wrap" aria-label="Nästa beslut">
      <form id={formId} className="tx-sheet" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <header className="tx-sheet-head">
          <div><span className="tc-eyebrow">{clubStage ? (isLoan ? "Steg 1 · ägarklubben" : "Steg 1 · klubben") : isLoan ? "Steg 2 · speltiden" : "Steg 2 · spelaren"}</span><h3>{meet ? "Motbudet står kvar" : title}</h3></div>
          {clock && <span className="tx-pill" data-tone={clock.urgency === "urgent" || clock.urgency === "overdue" ? "move" : clock.urgency === "soon" ? "wait" : undefined}>{daysLeftLabel(clock.daysLeft)}</span>}
        </header>

        {meet && (
          <button type="button" className="tc-meet tx-meet" onClick={() => run(meet!.action)}>
            <strong>{meet.label}</strong>
            <span>{meet.detail}</span>
          </button>
        )}

        <div className="tx-terms" role="table" aria-label="Villkoren, vårt bud mot deras krav">
          <div className="tx-term tx-term-head" role="row">
            <div role="columnheader">Villkor</div>
            <div role="columnheader">Vårt bud</div>
            <div role="columnheader">Skillnad</div>
            <div role="columnheader">Deras krav · {clubStage ? clubName : playerName}</div>
          </div>
          {stance && <p className="tx-stance" data-response={stance.response}>{localizeMoneyText(stance.reason)}</p>}

          {clubStage && !isLoan && (
            <TermRow label="Övergångssumma" gap={feeGap} onMeet={theirFee !== undefined ? () => setFee(theirFee) : undefined}
              ours={<>
                <Step label="övergångssumman" value={fee} step={500} onChange={setFee}><MoneyInput className="tc-input tx-num" aria-label={`Övergångssumma (${currencySymbol()})`} minEur={0} stepEur={500} valueEur={fee} onChangeEur={setFee} /></Step>
                <FeeRangeBand fee={fee} onFee={setFee} range={visibleRange} counter={theirFee} budget={budgetEur} />
              </>}
              theirs={theirFee !== undefined ? <b className="tx-num">{formatMoney(theirFee)}</b> : <span className="tx-muted">{lastClub ? "Inget motbud" : "Inget bud än"}</span>} />
          )}

          {clubStage && isLoan && <>
            <TermRow label="Lönebidrag" gap={shareGap} onMeet={theirShare !== undefined ? () => setShare(theirShare) : undefined}
              ours={<>
                <Step label="lönebidraget" value={share} step={5} max={100} onChange={setShare}><input className="tc-input tx-num" type="number" aria-label="Lönebidrag ni betalar (%)" min={0} max={100} step={5} value={share} onChange={(e) => setShare(Math.max(0, Math.min(100, Number(e.target.value))))} /></Step>
                <input type="range" className="tx-range" min={0} max={100} step={5} value={share} onChange={(e) => setShare(Number(e.target.value))} aria-label="Lönebidrag (%)" aria-valuetext={`${share} procent`} />
                <small className="tx-muted">Ni betalar {formatMoney(Math.round(contractWage * share / 100))}/mån av hans {formatMoney(contractWage)}/mån.</small>
              </>}
              theirs={theirShare !== undefined ? <b className="tx-num">{theirShare} %</b> : <span className="tx-muted">{lastClub ? "Inget motbud" : "Inget bud än"}</span>} />
            <TermRow label="Lånet slutar"
              ours={<input className="tc-input" type="date" aria-label="Lånet slutar" value={endDate} min={addDays(career.gameDate, 1)} max={contractEnd} onChange={(e) => setEndDate(e.target.value)} />}
              theirs={<span className="tx-muted">Senast {contractEnd || "—"} (avtalets slut)</span>} />
          </>}

          {!clubStage && !isLoan && negotiation.agreedFeeEur !== undefined && (
            <TermRow locked label="Övergångssumma" ours={<b className="tx-num">{formatMoney(negotiation.agreedFeeEur)}</b>} theirs={<b className="tx-num">{formatMoney(negotiation.agreedFeeEur)}</b>} />
          )}
          {!clubStage && isLoan && negotiation.agreedWageSharePct !== undefined && (
            <TermRow locked label="Lånet" ours={<b className="tx-num">{negotiation.agreedWageSharePct} % · till {negotiation.loanEndDate}</b>} theirs={<b className="tx-num">{negotiation.agreedWageSharePct} %</b>} />
          )}

          {!clubStage && !isLoan && <>
            <TermRow label="Lön / mån" gap={wageGap} onMeet={theirWage !== undefined ? () => setWage(theirWage) : undefined}
              ours={<Step label="lönen" value={wage} step={50} onChange={setWage}><MoneyInput className="tc-input tx-num" aria-label={`Lön (${currencySymbol()}/mån)`} minEur={0} stepEur={10} valueEur={wage} onChangeEur={setWage} /></Step>}
              theirs={theirWage !== undefined ? <b className="tx-num">{formatMoney(theirWage)}</b> : <span className="tx-muted">{lastPlayer ? "Inget krav" : "Agenten svarar på era villkor"}</span>}
              note={breakdown.length > 0 ? <ul className="tx-breakdown">{breakdown.map((f) => <li key={f.label} data-sign={f.effectPct > 0 ? "up" : "down"}><span>{f.label}</span><b className="tx-num">{f.effectPct > 0 ? "+" : ""}{f.effectPct}%</b></li>)}</ul> : undefined} />
            <TermRow label="År"
              ours={<div className="tx-seg" role="radiogroup" aria-label="Kontraktslängd">{[1, 2, 3, 4, 5].map((y) => <button key={y} type="button" role="radio" aria-checked={years === y} onClick={() => setYears(y)}>{y}</button>)}</div>}
              theirs={<span className="tx-muted">{lastPlayer?.contractYears ? `Senast ${lastPlayer.contractYears} år` : "—"}</span>} />
            <TermRow label="Signeringsbonus"
              ours={<Step label="bonusen" value={bonus} step={500} onChange={setBonus}><MoneyInput className="tc-input tx-num" aria-label={`Signeringsbonus (${currencySymbol()})`} minEur={0} stepEur={500} valueEur={bonus} onChangeEur={setBonus} /></Step>}
              theirs={<span className="tx-muted">—</span>} />
          </>}

          {!clubStage && (
            <TermRow label="Utlovad roll"
              ours={<select className="tc-input" aria-label="Utlovad roll" value={role} onChange={(e) => setRole(e.target.value as SquadStatusTier)}>{SQUAD_STATUS_TIERS.map((t) => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}{t === expected ? " (förväntad)" : ""}</option>)}</select>}
              theirs={<span>Förväntar sig <b>{roleLabel(expected).toLowerCase()}</b></span>}
              note={<span className="tx-muted">Du har {roles[role]} {position} som {roleLabel(role).toLowerCase()} i dag. Löftet följer med avtalet och syns på spelarprofilen -- bryts det sjunker hans humör.</span>} />
          )}
        </div>

        <div className="tx-sheet-actions">
          <button type="submit" className={meet ? "hm-btn" : "hm-btn hm-btn-primary tc-cta"}>{cta}</button>
          <WithdrawButton onConfirm={() => run({ kind: "WITHDRAW", negotiationId: negotiation.id })} />
        </div>
      </form>

      <aside className="tx-impact" aria-label="Budgetpåverkan">
        <h4 className="tx-h4">Budgetpåverkan</h4>
        <BudgetWaterfall w={w} pendingLabel={isLoan ? "Låneavgift" : "Vid underskrift"} />
        <dl className="tx-total">
          <div data-k="total"><dt>Kostnad över kontraktet{isLoan ? "" : ` (${acq.contractYears} år)`}</dt><dd className="tx-num">{formatMoney(isLoan ? acq.annualWageEur : acq.totalContractCommitmentEur)}</dd></div>
          {!isLoan && <div><dt>Vid underskrift</dt><dd className="tx-num">{formatMoney(immediateCost)}</dd></div>}
          <div><dt>{isLoan ? "Er lönedel" : "Lön"}</dt><dd className="tx-num">{formatMoney(proposedWage)}/mån{clubStage && !isLoan ? " (uppsk.)" : ""}</dd></div>
          {!isLoan && agentFee > 0 && <div><dt>Agentarvode</dt><dd className="tx-num">{formatMoney(agentFee)}</dd></div>}
        </dl>
        {!isLoan && immediateCost > cashBalance && <p className="tx-warn-line">Direktkostnaden ({formatMoney(immediateCost)}) är mer än kassan ({formatMoney(cashBalance)}).</p>}
        {trainingComp > 0 && !isLoan && (
          <details className="tx-comp">
            <summary>Utbildningsersättning <b className="tx-num">{formatMoney(trainingComp)}</b> <small>{trainingCompDetail.isDomesticTransfer ? "SHF 2026/27" : "EHF/IHF ITC"}</small></summary>
            <p className="tx-muted">{trainingCompDetail.documentationNote}</p>
            <ul>{trainingCompDetail.perClub.map((c) => <li key={c.clubId}><span>{c.clubName} ({c.seasons} säsonger, {c.fromAge}–{c.toAge} år)</span><b className="tx-num">{formatMoney(c.amountEur)}</b></li>)}</ul>
          </details>
        )}
        {(negotiation.rivals ?? []).length > 0 && (
          <div className="tx-rivals"><span className="tc-eyebrow">Konkurrerande intresse</span><ul>{(negotiation.rivals ?? []).map((r) => <li key={r.clubId} data-status={r.status}><span>{getClub(r.clubId)?.shortName ?? r.clubId}</span><b>{RIVAL_STATUS[r.status]}</b></li>)}</ul></div>
        )}
      </aside>

      <div className="tx-sticky">
        <span className="tx-sticky-gap" data-met={mainGap ? String(mainGap.met) : undefined}>{mainGap ? mainGap.label : "Inget motbud än"}</span>
        <button type="submit" form={formId} className="hm-btn hm-btn-primary">{cta}</button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ REC-04d waiting card
export function WaitingCard({ negotiation, partyName, onWithdraw }: { negotiation: TransferNegotiation; partyName: string; onWithdraw: () => void }) {
  const { career, continueCareer } = useCareer();
  const pathname = usePathname();
  const [stop, setStop] = useState<(ProgressionNotice & { until: string }) | null>(null);
  const p = negotiation.pending!;
  const action = resolveContextualContinueAction(career, null, pathname);
  const days = daysUntilAnswer(career, p.responseDate);
  const canAdvance = action.kind === "ADVANCE_DAY" && !action.disabled;

  function advance() {
    const pending = career.careerEvents.find((e) => e.requiresAction && !e.resolved);
    const result = continueCareer();
    // Still pending after the press means Continue stopped earlier -- tell the manager why (the answer arriving unmounts this card).
    setStop({ ...progressionNotice(result.events, result.stopReason, pending), until: result.daysProcessed > 0 ? addDays(result.startDate, result.daysProcessed - 1) : career.gameDate });
  }

  return (
    <section className="tx-wait" aria-label="Väntar på svar">
      <div className="tx-wait-card">
        <span className="tc-eyebrow"><span className="tc-wait-mark" aria-hidden="true" />Budet ligger på bordet</span>
        <h3>{partyName} svarar senast {weekdayDate(p.responseDate)}</h3>
        <p className="tx-muted">Budet kan inte ändras medan {p.party === "CLUB" ? "klubben" : "spelaren och agenten"} överväger det. Svaret kommer också i inkorgen.</p>
        {stop && (
          <div className="tx-wait-stop" role="status">
            <b>Kalendern stannade {weekdayDate(stop.until)}: {stop.title}</b>
            <span>{stop.detail}</span>
            <Link className="tx-fix" href={stop.actionHref}>{stop.actionLabel}</Link>
          </div>
        )}
        <div className="tx-wait-actions">
          {canAdvance ? (
            <button type="button" className="hm-btn hm-btn-primary tc-cta" onClick={advance}>{stop ? "Fortsätt fram till svaret" : "Spela fram till svaret"}</button>
          ) : (
            <div className="tx-blocked"><Link className="hm-btn hm-btn-primary" href={action.targetHref ?? "/career"}>{action.label}</Link><span>{action.blockReason ?? action.tooltip ?? "Kalendern kan inte fortsätta härifrån just nu."} Lös det först -- sedan kan du spela fram till svaret.</span></div>
          )}
          <WithdrawButton onConfirm={onWithdraw} />
        </div>
        <p className="tx-note-small">Kalendern stannar tidigare om något annat viktigt händer -- en match, ett beslut eller nyheter.</p>
      </div>
      <aside className="tx-mini-spine" aria-label="Det här händer innan svaret">
        <h4 className="tx-h4">Fram till svaret</h4>
        {days.length === 0 ? <p className="tx-muted">Svaret kommer när dagen spelas.</p> : (
          <ol>{days.map((d) => (
            <li key={d.date} data-answer={d.isAnswerDay || undefined}>
              <time dateTime={d.date}>{weekdayDate(d.date)}</time>
              <div>{d.isAnswerDay && <b className="tx-pill" data-tone="wait">Svar</b>}{d.pins.length ? d.pins.slice(0, 3).map((pin) => <Link key={pin.id} href={pin.href} title={pin.detail} data-kind={pin.kind}>{pin.label}</Link>) : !d.isAnswerDay && <span className="tx-muted">Inget inplanerat</span>}</div>
            </li>
          ))}</ol>
        )}
      </aside>
    </section>
  );
}

// ------------------------------------------------------------------ REC-04a start
function StateCard({ tone, title, children, actions }: { tone: "own" | "cooldown" | "blocked"; title: string; children: ReactNode; actions: ReactNode }) {
  return <section className="tx-state" data-tone={tone}><h3>{title}</h3><div className="tx-muted">{children}</div><div className="tx-wait-actions">{actions}</div></section>;
}

export function StartChoice({ playerId, deal, onDeal, onStart, clubName, isNew }: { playerId: string; deal: TransferDealType; onDeal: (d: TransferDealType) => void; onStart: (d: TransferDealType) => void; clubName: string; isNew: boolean }) {
  const { career } = useCareer();
  const ready = dealReadiness(career, playerId);
  if (!ready) return null;
  if (ready.own) {
    return <StateCard tone="own" title="Spelaren tillhör er klubb" actions={<><Link className="hm-btn hm-btn-primary" href={`/career/squad/${encodeURIComponent(playerId)}`}>Öppna spelarprofilen →</Link><Link className="hm-btn" href="/career/contracts">Kontraktsöversikt</Link></>}>Förläng eller hantera hans avtal från spelarprofilen eller kontraktsöversikten. Bud från andra klubbar hanteras under Sälj.</StateCard>;
  }
  const cooldown = ready.items.find((i) => i.key === "cooldown");
  if (cooldown) {
    return <StateCard tone="cooldown" title="Samtalen är spärrade" actions={<><Link className="hm-btn hm-btn-primary" href="/career/transfers">Tillbaka till marknaden</Link><Link className="hm-btn" href={`/career/squad/${encodeURIComponent(playerId)}`}>Spelarprofil</Link></>}>{cooldown.detail}</StateCard>;
  }
  const contract = getPlayerContract(career, playerId);
  const freeAgent = getPlayerContractStatus(career, playerId) === "FREE_AGENT";
  const effective: TransferDealType = deal === "LOAN" && !ready.canLoan ? "PERMANENT" : deal;
  const valueText = ready.value ? (ready.value.min === ready.value.max ? formatMoney(ready.value.min) : `${formatMoney(ready.value.min)} – ${formatMoney(ready.value.max)}`) : "—";
  const wage = contract?.wageEurPerMonth ?? 0;
  return (
    <section className="tx-start" aria-label="Inled förhandling">
      <span className="tc-eyebrow">{isNew ? "Ny förhandling" : "Inled förhandlingen"}</span>
      <div className="tx-choice" role="radiogroup" aria-label="Typ av affär">
        <button type="button" role="radio" aria-checked={effective === "PERMANENT"} onClick={() => onDeal("PERMANENT")}>
          <strong>Permanent övergång</strong>
          <ol>
            <li>{freeAgent ? "Ingen klubb -- ingen övergångssumma" : `Övergångssumma med ${clubName}`}</li>
            <li>Lön, längd, bonus och roll med spelaren och agenten</li>
          </ol>
          <dl><div><dt>Scouternas värdering</dt><dd className="tx-num">{freeAgent ? "Fri" : valueText}</dd></div>{ready.trainingCompensationEur > 0 && <div><dt>Utbildningsersättning</dt><dd className="tx-num">{formatMoney(ready.trainingCompensationEur)}</dd></div>}</dl>
        </button>
        <button type="button" role="radio" aria-checked={effective === "LOAN"} aria-disabled={!ready.canLoan} onClick={() => ready.canLoan && onDeal("LOAN")} data-disabled={!ready.canLoan || undefined}>
          <strong>Lån</strong>
          <ol>
            <li>Lönebidrag (%) och slutdatum med {clubName}</li>
            <li>Speltid (utlovad roll) med spelaren</li>
          </ol>
          {ready.canLoan
            ? <dl><div><dt>Hans lön</dt><dd className="tx-num">{formatMoney(wage)}/mån</dd></div><div><dt>Avtalet</dt><dd>stannar hos ägaren</dd></div></dl>
            : <p className="tx-blocked-reason">{ready.loanReason}</p>}
        </button>
      </div>
      <ReadinessList items={ready.items} />
      <div className="tx-wait-actions">
        {ready.canNegotiate
          ? <button type="button" className="hm-btn hm-btn-primary tc-cta" onClick={() => onStart(effective)}>Öppna förhandlingen →</button>
          : <div className="tx-blocked"><button type="button" className="hm-btn hm-btn-primary" disabled>Öppna förhandlingen</button><span>{ready.blockedReason}</span></div>}
        <span className="tx-note-small">Svaren kommer efter några dagar i kalendern.</span>
      </div>
    </section>
  );
}
