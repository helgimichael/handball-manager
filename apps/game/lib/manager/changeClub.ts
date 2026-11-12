// HM-ALPHA3-M07: the manager changes employer -- the world does not reset.
// Every club, player, contract, table, fixture, ledger and staff member
// stays exactly where it is. What changes is whose club the manager runs:
// his open business at the old club (negotiations, talks, bids, scouting
// trips, delegation, plans for future matches) is closed, the old club's
// squad stays well known to him, the new club gets the manager's-club
// setup (ratings, contracts, squad roles, availability), the new club's
// head coach makes way, and the old club gets a vacancy that the CPU staff
// market fills.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import { clubCompetitionId } from "../career/competitionMembership";
import { ensureCareerGameplayRatings } from "../career/careerRatingNormalization";
import { getCareerClubSquad } from "../career/careerWorld";
import { ensureCareerPlayerSquadStatus } from "../career/squadStatus";
import type { CareerState } from "../career/types";
import { ensureCareerPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { ensureCareerPlayerContracts } from "../economy/contractIntegration";
import { getClub } from "../game-data";
import { withEvents } from "./events";
export { withEvents };
import { releaseStaff } from "../staff/staffNegotiation";
import { closeOpenBusiness } from "./departure";
import { addDaysIso } from "../players/dynamicsState";
import { ensureBoard } from "../board/board";
import { closeStint, eligibleClubs, ensureManagerCareer, leagueName, unplayedOwnFixtureDue } from "./managerCareer";

export function clubChangeBlocker(state: CareerState, clubId: string): string | null {
  if (state.productionMatch || state.activeMatchSession) return "Spela klart matchen först.";
  if (clubId === state.playerClubId && !state.managerCareer?.seekingJob) return "Du arbetar redan i klubben.";
  if (clubId === state.playerClubId) return "Klubben går vidare utan dig.";
  // HM-M7D: a match whose day has come is played by the manager whose club it is.
  if (unplayedOwnFixtureDue(state)) return "Spela dagens match först.";
  if (!eligibleClubs(state).includes(clubId)) return "Klubben spelar inte i någon av de svenska serierna den här säsongen.";
  return null;
}

/** Sets up the new club as the manager's club, exactly as a new career would for it. */
function takeOver(state: CareerState, clubId: string): CareerState {
  const squad = getCareerClubSquad(state, clubId);
  let next: CareerState = { ...state, playerClubId: clubId, competitionId: clubCompetitionId(state, clubId) ?? getClub(clubId)?.competitionId ?? state.competitionId };
  next = ensureCareerGameplayRatings(next, clubId);
  next = ensureCareerPlayerContracts(next, clubId);
  next = ensureCareerPlayerClubHistory(next, clubId);
  next = ensureCareerPlayerSquadStatus(next, clubId, squad);
  const playerStatuses = { ...next.playerStatuses };
  for (const p of squad) if (!playerStatuses[p.id]) playerStatuses[p.id] = { playerId: p.id, availability: "AVAILABLE" };
  // A CPU club's recruitment plan was its own; the manager now decides.
  const { [clubId]: _plan, ...cpuRecruitmentPlans } = next.cpuRecruitmentPlans ?? {};
  return { ...next, playerStatuses, cpuRecruitmentPlans };
}

/** The career without the unemployment marker (removed, not set to undefined, so a save round-trip is exact). */
function employedCareer<T extends { seekingJob?: unknown }>(c: T): T {
  const { seekingJob: _seeking, ...rest } = c;
  return rest as T;
}

/** Accepts a job offer: leaves the current club (if still employed) and takes over the new one. */
export function acceptJobOffer(state: CareerState, offerId: string): CareerState {
  const events: CareerEvent[] = [];
  const emit = (e: CareerEvent) => events.push(e);
  const s = ensureManagerCareer(state);
  const c = s.managerCareer!;
  const offer = c.offers[offerId];
  if (!offer || offer.status !== "OPEN" || offer.expiresOn < s.gameDate) throw new Error("Erbjudandet gäller inte längre.");
  const blocker = clubChangeBlocker(s, offer.clubId);
  if (blocker) throw new Error(blocker);
  const date = s.gameDate;
  const oldClubId = s.playerClubId;
  const leaving = !c.seekingJob;

  // The old squad stays well known to the manager.
  const playerKnowledge = { ...s.playerKnowledge };
  for (const p of getCareerClubSquad(s, oldClubId)) playerKnowledge[p.id] = Math.max(playerKnowledge[p.id] ?? 0, 85);
  let next: CareerState = closeOpenBusiness({ ...s, playerKnowledge }, date);

  // The new club's head coach makes way; the old club needs one.
  const incumbent = (next.staffRoster[offer.clubId] ?? []).find((m) => m.roles[0] === "HEAD_COACH");
  if (incumbent) next = releaseStaff(next, incumbent.id, date, "DISMISSED");
  next = takeOver(next, offer.clubId);

  const offers = Object.fromEntries(Object.entries(c.offers).map(([k, o]) => [k, k === offerId ? { ...o, status: "ACCEPTED" as const } : o.status === "OPEN" ? { ...o, status: "DECLINED" as const } : o]));
  const applications = Object.fromEntries(Object.entries(c.applications).map(([k, a]) => [k, (a.status === "INTERVIEW" || a.status === "ANSWERED") ? { ...a, status: (a.clubId === offer.clubId ? "OFFERED" : "WITHDRAWN") as typeof a.status } : a]));
  // HM-M7D: the stint closes once, with the part-season he leaves behind; an unemployed manager's old stint is already closed.
  const stints = closeStint(s, c, date, "NEW_JOB").stints;
  // The club he walks out of looks for a coach; the vacancy his earlier departure opened is not re-opened.
  const vacancies = [...c.vacancies.filter((v) => v.clubId !== offer.clubId && (!leaving || v.clubId !== oldClubId)), ...(leaving ? [{ clubId: oldClubId, openedOn: date, closesOn: addDaysIso(date, 14), reason: `Tränaren lämnade för ${getClub(offer.clubId)?.shortName ?? offer.clubId}.` }] : [])];
  const name = getClub(offer.clubId)?.name ?? offer.clubId;
  next = {
    ...next,
    board: undefined,
    managerCareer: {
      ...employedCareer(c),
      offers,
      applications,
      vacancies,
      stints: [...stints, { clubId: offer.clubId, from: date, seasons: [], competitionId: next.competitionId, reputationAtStart: c.reputation }],
      contract: { clubId: offer.clubId, wageEurPerMonth: offer.wageEurPerMonth, startDate: date, endDate: `${Number(next.seasonId.slice(0, 4)) + offer.years}-05-31` },
      milestones: [...c.milestones, ...(leaving ? [{ date, kind: "RESIGNED" as const, text: `Lämnade ${getClub(oldClubId)?.name ?? oldClubId} för ett nytt jobb.`, clubId: oldClubId }] : []), { date, kind: "APPOINTED" as const, text: `Ny huvudtränare i ${name}.`, clubId: offer.clubId }].slice(-60),
    },
  };
  next = ensureBoard(next, date, emit);
  emit(buildClubEvent("MANAGER_CAREER", `appointed:${offer.clubId}:${date}`, date, "IMPORTANT", `Välkommen till ${name}`, `Du har skrivit på för ${offer.years} år (${leagueName(next.competitionId)}). Styrelsens mål väntar i styrelserummet och truppen är din från och med i dag.`, [{ route: "MANAGER" }, { route: "BOARDROOM" }]));
  return withEvents(next, events);
}
