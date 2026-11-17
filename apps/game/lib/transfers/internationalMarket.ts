// HM-TRANSFER-REALISM-1.0 M4: the international transfer ecosystem.
//
// World-pool clubs (Bundesliga, Herreligaen, ASOBAL, ...) hold a slice of
// their real squads and were passive containers: they never renewed a
// contract, so on 31 May every world-pool player -- world-class or not -- was
// released into the SWEDISH free-agent pool, where any Swedish club could
// sign him and (under the old decision rule) he would always accept.
//
// This module gives them a lightweight, abstract market, run once a day from
// dailyTick.ts. Nothing about a foreign club's economy is simulated; the
// PLAYER side is the full shared Player Career Decision Model:
//
//   * Renewal. A world-pool club wants to keep a player who still fits its
//     level and age (internationalClubWants). The player renews only if the
//     PCDM prefers staying (at the wage he would demand) to what the open
//     market offers him. Otherwise his contract runs out and he becomes a
//     free agent like anyone else.
//   * Recruitment. A free agent the international market wants is offered
//     the best fitting world-pool clubs; he chooses with the same PCDM, so a
//     world-class player lands at a club near his level instead of drifting
//     into a Swedish lower division. Capacity per club is bounded.
//   * League strength rolls (smoothed) once per season.
//
// Ownership always moves through transferPlayerPermanently, contracts through
// the ordinary PlayerContract record: there is one owner and one contract per
// player at all times. Deterministic: no randomness, fixed review days.
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { FREE_AGENT_CLUB_ID, getFreeAgents } from "../career/contractExpiry";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerContract, getPlayerContractStatus } from "../economy/contractIntegration";
import { daysUntilContractEnd } from "../economy/contractLifecycle";
import { computeNewContractEndDate, transferPlayerPermanently } from "./transferExecution";
import { activePendingTransferPlayerIds } from "./transferIntegration";
import { clubRenewalWageCap, internationalClubWants, playerChoosesBetween, playerCareerProfile, renewalWageDemand } from "./careerDecision/stateAdapter";
import { MARKET_MOVE_PREMIUM } from "./careerDecision/model";
import { clubLeagueId, environmentLevelOf, leagueLevelOf, rollLeagueStrength, worldPoolClubIds } from "./careerDecision/sportingStrength";
import { progressInternationalYouthIntake } from "../career/internationalYouthIntake";

/** Renewal reviews happen on these days-before-expiry (and every day in the final month). */
const RENEWAL_REVIEW_EVERY_DAYS = 15;
const RENEWAL_FINAL_DAYS = 30;
/** Free-agent recruitment pass cadence (days of month). */
const RECRUITMENT_DAYS_OF_MONTH = new Set(["01", "08", "15", "22"]);
/** How many world-pool clubs a free agent is offered at once. */
const OFFERS_PER_PLAYER = 3;
/** A world-pool club adds at most this many free agents per pass. */
const SIGNINGS_PER_CLUB_PER_PASS = 1;

export interface InternationalMarketLogEntry {
  date: string;
  playerId: string;
  clubId: string;
  kind: "RENEWED" | "RENEWAL_REFUSED" | "SIGNED_FREE_AGENT" | "YOUTH_PROMOTED";
  wageEurPerMonth?: number;
}

export const INTERNATIONAL_MARKET_LOG_REASON: Record<InternationalMarketLogEntry["kind"], string> = {
  RENEWED: "Förlängde med sin klubb utomlands.",
  RENEWAL_REFUSED: "Tackade nej till förlängning -- söker en bättre möjlighet.",
  SIGNED_FREE_AGENT: "Skrev på för en klubb utomlands som kontraktslös.",
  YOUTH_PROMOTED: "Uppflyttad från klubbens ungdomsverksamhet till A-truppen.",
};

function renewalYears(age: number | null): number {
  if (age === null) return 2;
  if (age <= 27) return 3;
  if (age <= 31) return 2;
  return 1;
}

/** World-pool clubs renew the players they want, when the player wants to stay. */
function progressInternationalRenewals(state: CareerState, date: string, log: InternationalMarketLogEntry[]): CareerState {
  let next = state;
  const pending = activePendingTransferPlayerIds(state);
  for (const clubId of worldPoolClubIds(state)) {
    for (const player of state.worldSquads[clubId] ?? []) {
      if (pending.has(player.id)) continue;
      const contract = getPlayerContract(next, player.id);
      if (!contract || contract.clubId !== clubId) continue;
      const status = getPlayerContractStatus(next, player.id);
      if (status !== "EXPIRING" && status !== "EXPIRING_SOON") continue;
      const days = daysUntilContractEnd(contract.contractEndDate, date);
      if (days > RENEWAL_FINAL_DAYS && days % RENEWAL_REVIEW_EVERY_DAYS !== 0) continue;
      if (!internationalClubWants(next, clubId, player.id)) continue;
      const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
      const years = renewalYears(age);
      const demand = renewalWageDemand(next, player.id, years);
      if (demand === null) {
        if (days % RENEWAL_REVIEW_EVERY_DAYS === 0) log.push({ date, playerId: player.id, clubId, kind: "RENEWAL_REFUSED" });
        continue;
      }
      const wage = Math.max(contract.wageEurPerMonth, demand);
      if (wage > Math.max(contract.wageEurPerMonth, clubRenewalWageCap(next, player.id))) {
        if (days % RENEWAL_REVIEW_EVERY_DAYS === 0) log.push({ date, playerId: player.id, clubId, kind: "RENEWAL_REFUSED" });
        continue;
      }
      next = { ...next, playerContracts: { ...next.playerContracts, [player.id]: { ...contract, wageEurPerMonth: wage, contractEndDate: computeNewContractEndDate(player.id, contract.contractEndDate, years) } } };
      log.push({ date, playerId: player.id, clubId, kind: "RENEWED", wageEurPerMonth: wage });
    }
  }
  return next;
}

/** Free agents the international market wants are offered fitting world-pool clubs and choose with the PCDM. */
function progressInternationalFreeAgents(state: CareerState, date: string, log: InternationalMarketLogEntry[]): CareerState {
  let next = state;
  const signedThisPass = new Map<string, number>();
  const clubs = worldPoolClubIds(state);
  // Strongest players first: the best clubs fill with the best available players, deterministically.
  const freeAgents = [...getFreeAgents(state)]
    .map((p) => ({ p, ca: playerCareerProfile(state, p.id)?.ca ?? 0 }))
    .sort((a, b) => b.ca - a.ca || a.p.id.localeCompare(b.p.id));
  for (const { p } of freeAgents) {
    const player = getCareerPlayer(next, p.id);
    if (!player || player.clubId !== FREE_AGENT_CLUB_ID) continue;
    const profile = playerCareerProfile(next, p.id);
    if (!profile) continue;
    const interested = clubs
      .filter((clubId) => (signedThisPass.get(clubId) ?? 0) < SIGNINGS_PER_CLUB_PER_PASS && internationalClubWants(next, clubId, p.id))
      .sort((a, b) => environmentLevelOf(next, b) - environmentLevelOf(next, a) || a.localeCompare(b))
      .slice(0, OFFERS_PER_PLAYER);
    if (interested.length === 0) continue;
    const years = renewalYears(profile.age);
    const wage = Math.round((profile.referenceWageEurPerMonth * MARKET_MOVE_PREMIUM) / 10) * 10;
    const { clubId } = playerChoosesBetween(next, p.id, interested.map((id) => ({ clubId: id, terms: { wageEurPerMonth: wage, contractYears: years } })));
    if (!clubId) continue;
    const moved = transferPlayerPermanently(next, p.id, FREE_AGENT_CLUB_ID, clubId, wage, computeNewContractEndDate(p.id, date, years));
    if (moved === next) continue;
    next = moved;
    signedThisPass.set(clubId, (signedThisPass.get(clubId) ?? 0) + 1);
    log.push({ date, playerId: p.id, clubId, kind: "SIGNED_FREE_AGENT", wageEurPerMonth: wage });
  }
  return next;
}

export function progressInternationalMarket(state: CareerState, date: string): { state: CareerState; log: InternationalMarketLogEntry[] } {
  const log: InternationalMarketLogEntry[] = [];
  let next = state;
  // Season rollover: smooth the league levels once, at the start of July.
  if (date.slice(5) === "07-01") next = rollLeagueStrength(next, date.slice(0, 4));
  if (worldPoolClubIds(next).length === 0) return { state: next, log };
  // M8A: once a year, clubs with free slots promote prospects from their country's youth system.
  const intake = progressInternationalYouthIntake(next, date, (clubId) => leagueLevelOf(next, clubLeagueId(next, clubId)));
  if (intake.state !== next) {
    for (const [clubId, ids] of Object.entries(intake.generated)) for (const playerId of ids) log.push({ date, playerId, clubId, kind: "YOUTH_PROMOTED" });
    next = intake.state;
  }
  next = progressInternationalRenewals(next, date, log);
  if (RECRUITMENT_DAYS_OF_MONTH.has(date.slice(8, 10))) next = progressInternationalFreeAgents(next, date, log);
  return { state: next, log };
}
