// HM-ALPHA3-M06: delegated staff work. Once a week each delegated (or
// advising) staff member looks at their area and either acts within the
// agreed scope -- with the same functions and rules as the manager -- or
// writes a proposal the manager approves or rejects. Key players, new
// wage commitments for staff and transfer negotiations always need the
// manager's approval: no hidden commitments, no automated transfers.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import { getCareerPlayer } from "../career/careerWorld";
import { addToShortlist, isShortlisted } from "../career/recruitment";
import { createBroadScoutingAssignment, getClubScouts } from "../career/scouting";
import type { CareerState } from "../career/types";
import { formatEur } from "../economy/currency";
import { getClubStaffCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { addDaysIso, managerSquadIds, playerName, tierOf } from "../players/dynamicsState";
import { requestBidFor } from "../players/market";
import { openRenewalTalks, renewalBlocker, renewalDemand, submitRenewalOffer, openTalkFor } from "../players/renewals";
import { recruitmentRecommendations } from "../scouting/recommendations";
import { RESPONSIBILITY_LABEL, responsibilityCandidates, vacancies, type ResponsibilityArea } from "../staff/organisation";
import { findStaffMember } from "../staff/staffCareerIntegration";
import { STAFF_ROLE_LABEL } from "../staff/labels";
import { marketCandidates } from "../staff/staffMarket";
import { hireFreeAgent, staffSpendingLimit, vacancyFunding } from "../staff/staffNegotiation";
import type { StaffRole } from "../staff/types";
import { getManagerRecruitmentNeeds } from "../transfers/transferCentre";
import { assessTransferAffordability } from "../transfers/affordability";
import type { DelegationLogEntry, DelegationMode, DelegationProposal, DelegationState, ProposalAction } from "./types";

type Emit = (event: CareerEvent) => void;
const PROPOSAL_DAYS = 14;
const NON_COACHING_ROLES: StaffRole[] = ["SCOUT", "PHYSIO", "ANALYST", "TEAM_MANAGER", "HEAD_OF_RECRUITMENT"];

export function delegationOf(state: CareerState): DelegationState {
  return state.delegation ?? { settings: {}, proposals: {}, log: [] };
}

export function modeOf(state: CareerState, area: ResponsibilityArea): DelegationMode {
  return delegationOf(state).settings[area]?.mode ?? "MANAGER";
}

/** The person who handles an area: the chosen staff member if still at the club, otherwise the best suited. */
export function delegateFor(state: CareerState, area: ResponsibilityArea): { staffId: string; name: string } | null {
  const chosen = delegationOf(state).settings[area]?.staffId;
  const member = chosen ? findStaffMember(state, chosen) : undefined;
  if (member && member.clubId === state.playerClubId) return { staffId: member.id, name: member.displayName };
  const best = responsibilityCandidates(state, state.playerClubId).find((r) => r.area === area)?.member;
  return best ? { staffId: best.id, name: best.displayName } : null;
}

export function setDelegation(state: CareerState, area: ResponsibilityArea, mode: DelegationMode, staffId?: string): CareerState {
  const d = delegationOf(state);
  return { ...state, delegation: { ...d, settings: { ...d.settings, [area]: { mode, ...(staffId ? { staffId } : {}) } } } };
}

function log(state: CareerState, entry: Omit<DelegationLogEntry, "staffName">): CareerState {
  const d = delegationOf(state);
  const staffName = findStaffMember(state, entry.staffId)?.displayName ?? "Staben";
  return { ...state, delegation: { ...d, log: [...d.log, { ...entry, staffName }].slice(-120) } };
}

function propose(state: CareerState, date: string, emit: Emit, p: Omit<DelegationProposal, "id" | "createdOn" | "expiresOn" | "status">): CareerState {
  const d = delegationOf(state);
  // One pending proposal per area, action and target -- a changed wage or date is not a new proposal.
  const target = (a: ProposalAction) => `${a.kind}:${"playerId" in a ? a.playerId : "staffId" in a ? a.staffId : "position" in a ? a.position : ""}`;
  const pending = Object.values(d.proposals).some((x) => x.status === "PENDING" && x.area === p.area && target(x.action) === target(p.action));
  if (pending) return state;
  const id = `proposal:${p.area}:${date}:${Object.keys(d.proposals).length}`;
  const proposal: DelegationProposal = { ...p, id, createdOn: date, expiresOn: addDaysIso(date, PROPOSAL_DAYS), status: "PENDING" };
  const name = findStaffMember(state, p.staffId)?.displayName ?? "Staben";
  emit(buildClubEvent("DELEGATION_REPORT", id, date, "IMPORTANT", `Förslag från ${name}: ${p.title}`, `${p.reason} ${p.consequence}`, [{ route: "DELEGATION" }]));
  let next: CareerState = { ...state, delegation: { ...d, proposals: { ...d.proposals, [id]: proposal } } };
  next = log(next, { date, area: p.area, staffId: p.staffId, action: p.title, reason: p.reason, result: "PROPOSED" });
  return next;
}

/** Weekly (Mondays): each delegated or advising area does its work. */
export function progressDelegation(state: CareerState, date: string, emit: Emit): CareerState {
  let next = expireProposals(state, date);
  const d = delegationOf(next);
  const monday = new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
  if (!monday || d.lastRun === date) return next;
  next = { ...next, delegation: { ...delegationOf(next), lastRun: date } };
  const done: string[] = [];
  const collect: Emit = (e) => { emit(e); };
  if (modeOf(next, "SCOUTING_ASSIGNMENTS") !== "MANAGER") next = scoutingAssignments(next, date, collect, done);
  if (modeOf(next, "PLAYER_RECRUITMENT") !== "MANAGER") next = playerRecruitment(next, date, collect, done);
  if (modeOf(next, "CONTRACT_RENEWALS") !== "MANAGER") next = contractRenewals(next, date, collect, done);
  if (modeOf(next, "STAFF_HIRING") !== "MANAGER") next = staffHiring(next, date, collect, done);
  if (done.length) emit(buildClubEvent("DELEGATION_REPORT", `digest:${date}`, date, "INFORMATION", "Från staben: veckans arbete", done.join(" "), [{ route: "DELEGATION" }]));
  return next;
}

function expireProposals(state: CareerState, date: string): CareerState {
  const d = delegationOf(state);
  let changed = false;
  const proposals = Object.fromEntries(Object.entries(d.proposals).map(([k, p]) => {
    if (p.status === "PENDING" && p.expiresOn < date) { changed = true; return [k, { ...p, status: "EXPIRED" as const, decidedOn: date }]; }
    return [k, p];
  }));
  return changed ? { ...state, delegation: { ...d, proposals } } : state;
}

function scoutingAssignments(state: CareerState, date: string, emit: Emit, done: string[]): CareerState {
  const who = delegateFor(state, "SCOUTING_ASSIGNMENTS");
  if (!who) return state;
  const busy = new Set(Object.values(state.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS").map((a) => a.scoutStaffId));
  const covered = new Set(Object.values(state.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS" && a.assignmentType === "POSITION").map((a) => a.targetPosition));
  // Urgent needs first; with none, idle scouts still look at the thinnest positions.
  const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
  const needs = getManagerRecruitmentNeeds(state).filter((n) => n.level !== "NONE" && !covered.has(n.position)).sort((a, b) => rank[a.level]! - rank[b.level]!);
  let next = state;
  for (const scout of getClubScouts(state).filter((s) => !busy.has(s.id))) {
    const need = needs.shift();
    if (!need) break;
    const reason = `${need.position}: ${need.reason}`;
    if (modeOf(state, "SCOUTING_ASSIGNMENTS") === "ADVISE") {
      next = propose(next, date, emit, { area: "SCOUTING_ASSIGNMENTS", staffId: who.staffId, title: `Skicka ${scout.displayName} att leta ${need.position}`, reason, consequence: "Ett positionsuppdrag startar. Ingen kostnad.", action: { kind: "START_SCOUTING", scoutStaffId: scout.id, position: need.position } });
      continue;
    }
    const res = createBroadScoutingAssignment(next, scout.id, "POSITION", { targetPosition: need.position }, date);
    if (res.ok) {
      next = log(res.state, { date, area: "SCOUTING_ASSIGNMENTS", staffId: who.staffId, action: `${scout.displayName} letar ${need.position}`, reason, result: "DONE" });
      done.push(`${scout.displayName} har fått ett uppdrag på ${need.position}.`);
    }
  }
  return next;
}

function playerRecruitment(state: CareerState, date: string, emit: Emit, done: string[]): CareerState {
  const who = delegateFor(state, "PLAYER_RECRUITMENT");
  if (!who) return state;
  let next = state;
  const mode = modeOf(state, "PLAYER_RECRUITMENT");
  const rec = recruitmentRecommendations(state, 8).find((r) => !isShortlisted(state, r.player.id));
  if (rec) {
    const name = `${rec.player.firstName} ${rec.player.lastName}`;
    const reason = `${name} (${rec.abilityRange.min === rec.abilityRange.max ? `${rec.abilityRange.min}` : `${rec.abilityRange.min}–${rec.abilityRange.max}`} stjärnor, säkerhet ${rec.confidencePct} %): ${rec.reasons.length ? rec.reasons.join(", ").replace(/^./, (c) => c.toLowerCase()) : "passar truppen"}.`;
    if (mode === "DELEGATE") {
      next = addToShortlist(next, rec.player.id, date);
      next = log(next, { date, area: "PLAYER_RECRUITMENT", staffId: who.staffId, action: `Satte upp ${name} på kortlistan`, reason, result: "DONE" });
      done.push(`${name} är uppsatt på kortlistan.`);
      next = propose(next, date, emit, { area: "PLAYER_RECRUITMENT", staffId: who.staffId, title: `Inled förhandling om ${name}`, reason, consequence: "Godkänner du öppnas förhandlingsrummet. Inget bud läggs utan dig.", action: { kind: "OPEN_NEGOTIATION", playerId: rec.player.id } });
    } else {
      next = propose(next, date, emit, { area: "PLAYER_RECRUITMENT", staffId: who.staffId, title: `Sätt upp ${name} på kortlistan`, reason, consequence: "Spelaren hamnar på kortlistan.", action: { kind: "SHORTLIST", playerId: rec.player.id } });
    }
  }
  // Listed players: the delegate asks around for bids (the first Monday of the month). Any bid still needs your answer.
  if (date.slice(8, 10) <= "07") {
    for (const listing of Object.values(state.playerDynamics?.listings ?? {})) {
      const name = playerName(next, listing.playerId);
      if (mode === "DELEGATE") {
        const before = Object.keys(next.incomingOffers ?? {}).length;
        next = requestBidFor(next, listing.playerId, date, emit);
        const got = Object.keys(next.incomingOffers ?? {}).length > before;
        next = log(next, { date, area: "PLAYER_RECRUITMENT", staffId: who.staffId, action: `Marknadsförde ${name}`, reason: "Transferlistad spelare.", result: got ? "DONE" : "SKIPPED" });
        if (got) done.push(`Bud inkommet på ${name}.`);
      } else {
        next = propose(next, date, emit, { area: "PLAYER_RECRUITMENT", staffId: who.staffId, title: `Marknadsför ${name}`, reason: "Han står på transferlistan.", consequence: "Klubbar kontaktas. Bud kräver ditt svar.", action: { kind: "SEEK_BIDS", playerId: listing.playerId } });
      }
    }
  }
  return next;
}

function contractRenewals(state: CareerState, date: string, emit: Emit, done: string[]): CareerState {
  const who = delegateFor(state, "CONTRACT_RENEWALS");
  if (!who) return state;
  const mode = modeOf(state, "CONTRACT_RENEWALS");
  const horizon = addDaysIso(date, 270);
  let next = state;
  let handled = 0;
  for (const id of managerSquadIds(state)) {
    if (handled >= 2) break;
    const c = next.playerContracts[id];
    if (!c || c.contractEndDate > horizon || openTalkFor(next, id) || renewalBlocker(next, id) || next.playerDynamics?.listings[id]) continue;
    const tier = tierOf(next, id);
    const key = tier === "KEY_PLAYER" || tier === "FIRST_CHOICE";
    const name = playerName(next, id);
    const demand = renewalDemand(next, id, undefined, who.staffId);
    const age = getCareerPlayer(next, id)?.birthYear ? Number(date.slice(0, 4)) - getCareerPlayer(next, id)!.birthYear! : 25;
    const years = age >= 30 ? 1 : 2;
    const increase = demand.demandEurPerMonth - c.wageEurPerMonth;
    const affordable = increase <= 0 || assessTransferAffordability(next, next.playerClubId, 0, 0, increase).affordable;
    const reason = `Avtalet går ut ${c.contractEndDate}. Han begär ${formatEur(demand.demandEurPerMonth)} i månaden (nu ${formatEur(c.wageEurPerMonth)}).`;
    handled++;
    if (key || mode === "ADVISE" || !affordable) {
      next = propose(next, date, emit, { area: "CONTRACT_RENEWALS", staffId: who.staffId, title: `Förläng ${name}`, reason: key ? `${reason} Han är en nyckelspelare -- ditt beslut.` : affordable ? reason : `${reason} Kräver mer lönebudget än som finns.`, consequence: `${who.name} förhandlar fram ${formatEur(demand.demandEurPerMonth)} i månaden, ${years} år.`, action: { kind: "RENEW", playerId: id, wageEurPerMonth: demand.demandEurPerMonth, years } });
      continue;
    }
    try {
      next = openRenewalTalks(next, id, { kind: "DELEGATE", staffId: who.staffId });
      const talk = openTalkFor(next, id);
      if (talk) next = submitRenewalOffer(next, talk.id, { wageEurPerMonth: demand.demandEurPerMonth, years });
      next = log(next, { date, area: "CONTRACT_RENEWALS", staffId: who.staffId, action: `Erbjöd ${name} ${formatEur(demand.demandEurPerMonth)}/mån, ${years} år`, reason, result: "DONE" });
      done.push(`${who.name} har lagt ett förlängningsbud till ${name}.`);
    } catch (e) {
      next = log(next, { date, area: "CONTRACT_RENEWALS", staffId: who.staffId, action: `Förlängning av ${name}`, reason: e instanceof Error ? e.message : "Kunde inte förhandla.", result: "SKIPPED" });
    }
  }
  return next;
}

function staffHiring(state: CareerState, date: string, emit: Emit, done: string[]): CareerState {
  const who = delegateFor(state, "STAFF_HIRING");
  if (!who) return state;
  let next = state;
  const open = vacancies(state, state.playerClubId).filter((p) => NON_COACHING_ROLES.includes(p.role));
  for (const vacancy of open.slice(0, 1)) {
    const candidate = marketCandidates(state).filter((c) => c.status === "FREE_AGENT" && c.role === vacancy.role).sort((a, b) => b.suitability - a.suitability)[0];
    if (!candidate) continue;
    const room = staffSpendingLimit(state, state.playerClubId) + vacancyFunding(state, state.playerClubId, vacancy.role, "HIRE") - getClubStaffCostsEurAnnual(state, state.playerClubId);
    const within = candidate.expectedWageEur * 12 <= room;
    next = propose(next, date, emit, {
      area: "STAFF_HIRING", staffId: who.staffId,
      title: `Anställ ${candidate.member.displayName} som ${STAFF_ROLE_LABEL[vacancy.role].toLowerCase()}`,
      reason: `Tjänsten är vakant. ${candidate.member.displayName} är den bäst lämpade fria kandidaten vi känner till.`,
      consequence: `${formatEur(candidate.expectedWageEur)} i månaden, två år.${within ? "" : " Ryms inte inom personalramen."}`,
      action: { kind: "HIRE_STAFF", staffId: candidate.member.id, role: vacancy.role, wageEurPerMonth: candidate.expectedWageEur },
    });
    done.push(`${who.name} föreslår en ${STAFF_ROLE_LABEL[vacancy.role].toLowerCase()}.`);
  }
  return next;
}

/** The manager approves a proposal: it is carried out with the normal rules (which can still refuse it). */
export function approveProposal(state: CareerState, proposalId: string): CareerState {
  const p = delegationOf(state).proposals[proposalId];
  if (!p || p.status !== "PENDING") throw new Error("Förslaget är inte längre aktuellt.");
  let next = state;
  let outcome = "Genomfört.";
  try {
    next = execute(next, p.action, p.staffId);
  } catch (e) {
    const d = delegationOf(state);
    return { ...state, delegation: { ...d, proposals: { ...d.proposals, [p.id]: { ...p, status: "FAILED", decidedOn: state.gameDate, outcome: e instanceof Error ? e.message : "Det gick inte." } } } };
  }
  if (p.action.kind === "OPEN_NEGOTIATION") outcome = "Öppna förhandlingsrummet för att lägga bud.";
  const d = delegationOf(next);
  next = { ...next, delegation: { ...d, proposals: { ...d.proposals, [p.id]: { ...p, status: "APPROVED", decidedOn: state.gameDate, outcome } } } };
  return log(next, { date: state.gameDate, area: p.area, staffId: p.staffId, action: p.title, reason: "Godkänt av dig.", result: "APPROVED" });
}

export function rejectProposal(state: CareerState, proposalId: string): CareerState {
  const p = delegationOf(state).proposals[proposalId];
  if (!p || p.status !== "PENDING") return state;
  const d = delegationOf(state);
  const next = { ...state, delegation: { ...d, proposals: { ...d.proposals, [p.id]: { ...p, status: "REJECTED" as const, decidedOn: state.gameDate } } } };
  return log(next, { date: state.gameDate, area: p.area, staffId: p.staffId, action: p.title, reason: "Avslaget av dig.", result: "REJECTED" });
}

function execute(state: CareerState, action: ProposalAction, staffId: string): CareerState {
  switch (action.kind) {
    case "START_SCOUTING": {
      const res = createBroadScoutingAssignment(state, action.scoutStaffId, "POSITION", { targetPosition: action.position }, state.gameDate);
      if (!res.ok) throw new Error(res.errors.join(" "));
      return res.state;
    }
    case "SHORTLIST":
      return addToShortlist(state, action.playerId, state.gameDate);
    case "OPEN_NEGOTIATION":
      return isShortlisted(state, action.playerId) ? state : addToShortlist(state, action.playerId, state.gameDate);
    case "SEEK_BIDS":
      return requestBidFor(state, action.playerId, state.gameDate, () => undefined);
    case "RENEW": {
      // The approved terms are the terms: if his demand has risen since, nothing is offered silently above them.
      const now = renewalDemand(state, action.playerId, action.promisedRole, staffId).demandEurPerMonth;
      if (now > action.wageEurPerMonth) throw new Error(`Hans krav har stigit till ${formatEur(now)} sedan förslaget. Staben återkommer med nya villkor.`);
      let next = openRenewalTalks(state, action.playerId, { kind: "DELEGATE", staffId });
      const talk = openTalkFor(next, action.playerId);
      if (talk) next = submitRenewalOffer(next, talk.id, { wageEurPerMonth: action.wageEurPerMonth, years: action.years, promisedRole: action.promisedRole });
      return next;
    }
    case "HIRE_STAFF": {
      const room = staffSpendingLimit(state, state.playerClubId) + vacancyFunding(state, state.playerClubId, action.role, "HIRE") - getClubStaffCostsEurAnnual(state, state.playerClubId);
      if (action.wageEurPerMonth * 12 > room) throw new Error("Lönen ryms inte inom styrelsens personalram.");
      const end = `${Number(state.gameDate.slice(0, 4)) + (state.gameDate.slice(5) > "05-31" ? 3 : 2)}-05-31`;
      return hireFreeAgent(state, action.staffId, state.playerClubId, action.wageEurPerMonth, end);
    }
  }
}

export function pendingProposals(state: CareerState): DelegationProposal[] {
  return Object.values(delegationOf(state).proposals).filter((p) => p.status === "PENDING").sort((a, b) => a.createdOn.localeCompare(b.createdOn));
}

export { RESPONSIBILITY_LABEL };
