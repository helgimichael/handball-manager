// Arena Nights 231 -- the Transfer Desk view model (REC-03 A, REC-03b A, REC-03c A, REC-03a A, REC-04 A,
// REC-04d A, REC-05 A, REC-05a A). Pure and read-only: every figure is DERIVED from canonical career state
// through the existing transfer/knowledge/economy helpers -- no rule is re-implemented or changed here, and
// no hidden ability or exact value of another club's player is ever read (knowledge-gated ranges only).
import type { CareerState } from "../career/types";
import { getCareerClubSquad, getCareerPlayer, getCareerSquad, getExternalCandidateClubs } from "../career/careerWorld";
import { getFreeAgents } from "../career/contractExpiry";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { getPlayerSquadStatus, type SquadStatusTier } from "../career/squadStatus";
import { addDays, daysBetween } from "../career/dateUtils";
import { pinsOn, type SpinePin } from "../career/weekSpine";
import { positionDepth, type DepthSpot } from "../club/clubJournal";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import type { ContractStatus } from "../economy/types";
import type { HandballPosition, PlayerMock } from "../game-data";
import { careerPlayerVisibility } from "../knowledge/careerVisibility";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { knowledgeTier } from "../knowledge/types";
import type { StarRange } from "../knowledge/playerVisibility";
import { resolveMarketValueRange } from "../knowledge/scoutReportVisibility";
import { isShortlisted } from "../career/recruitment";
import type { IncomingOffer } from "../players/types";
import { getLatestNegotiation, getTransferNegotiations, isNegotiationOpen } from "./negotiationIntegration";
import { evaluatePlayerInterest, matchesInterestFilter, type InterestFilter, type PlayerInterestEvaluation } from "./playerInterest";
import { getActiveLoanForPlayer, hasActivePendingTransfer } from "./transferIntegration";
import { isTransferWindowOpen, nextTransferWindowOpenDate } from "./transferWindow";
import { getManagerRecruitmentNeeds, getTransferFinance, getTransferOpportunities, summarizeNegotiation, type NegotiationSummary } from "./transferCentre";
import type { NeedLevel } from "../career/cpuSquadNeeds";

// ------------------------------------------------------------------ URL state (REC-03 / REC-03b)
export type DeskMode = "kop" | "salj" | "affarer";
export type MarketView = "mojligheter" | "marknad" | "kortlista";
export const DESK_MODES: readonly { id: DeskMode; label: string }[] = [{ id: "kop", label: "Köp" }, { id: "salj", label: "Sälj" }, { id: "affarer", label: "Affärer" }];
export const MARKET_VIEWS: readonly { id: MarketView; label: string }[] = [{ id: "mojligheter", label: "Möjligheter" }, { id: "marknad", label: "Hela marknaden" }, { id: "kortlista", label: "Kortlista" }];
export const DESK_POSITIONS: readonly HandballPosition[] = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"];
const INTERESTS: readonly InterestFilter[] = ["REALISTIC", "PERSUADABLE", "ALL"];

export interface DeskQuery {
  mode: DeskMode;
  view: MarketView;
  pos: HandballPosition | "ALL";
  q: string;
  interest: InterestFilter;
  /** "Endast utgående kontrakt" -- free agents and contracts ending within a year. */
  expiring: boolean;
  target: string | null;
}

export const DEFAULT_DESK_QUERY: DeskQuery = { mode: "kop", view: "mojligheter", pos: "ALL", q: "", interest: "REALISTIC", expiring: false, target: null };

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback);

/** Reads the desk state from the URL; unknown or missing values fall back to the defaults. `?target=` alone keeps working. */
export function parseDeskQuery(params: { get(key: string): string | null }): DeskQuery {
  return {
    mode: oneOf(params.get("mode"), DESK_MODES.map((m) => m.id), "kop"),
    view: oneOf(params.get("view"), MARKET_VIEWS.map((v) => v.id), "mojligheter"),
    pos: oneOf(params.get("pos"), ["ALL", ...DESK_POSITIONS] as const, "ALL"),
    q: (params.get("q") ?? "").slice(0, 60),
    interest: oneOf(params.get("interest"), INTERESTS, "REALISTIC"),
    expiring: params.get("expiring") === "1",
    target: params.get("target") || null,
  };
}

/** The query string for a desk state; defaults are left out so links stay short and stable. */
export function deskSearch(query: DeskQuery): string {
  const p = new URLSearchParams();
  if (query.mode !== "kop") p.set("mode", query.mode);
  if (query.view !== "mojligheter") p.set("view", query.view);
  if (query.pos !== "ALL") p.set("pos", query.pos);
  if (query.q.trim()) p.set("q", query.q.trim());
  if (query.interest !== "REALISTIC") p.set("interest", query.interest);
  if (query.expiring) p.set("expiring", "1");
  if (query.target) p.set("target", query.target);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function deskHref(query: Partial<DeskQuery> = {}): string {
  return `/career/transfers${deskSearch({ ...DEFAULT_DESK_QUERY, ...query })}`;
}

/** A short human label for a saved view ("Hela marknaden · V9 · utgående"). */
export function describeView(query: DeskQuery): string {
  const parts = [MARKET_VIEWS.find((v) => v.id === query.view)?.label ?? ""];
  if (query.pos !== "ALL") parts.push(query.pos);
  if (query.expiring) parts.push("utgående");
  if (query.interest === "PERSUADABLE") parts.push("möjligen intresserade");
  if (query.interest === "ALL") parts.push("alla mål");
  if (query.q.trim()) parts.push(`"${query.q.trim()}"`);
  return parts.join(" · ");
}

// ------------------------------------------------------------------ budget waterfall (REC-03 / REC-04)
export interface BudgetWaterfall {
  cashEur: number;
  /** The board's transfer frame: what is still free plus what deals waiting for the window already hold. */
  frameEur: number;
  committedEur: number;
  /** What a new bid is checked against (the transfer budget the negotiation rules use). */
  remainingEur: number;
  wageRoomEurPerMonth: number;
  /** Optional: a deal being considered, drawn on top of what is left. */
  pendingEur: number;
  afterPendingEur: number;
  pendingWageEurPerMonth: number;
  wageRoomAfterEurPerMonth: number;
}

export function budgetWaterfall(state: CareerState, pending: { upFrontEur?: number; wageEurPerMonth?: number } = {}): BudgetWaterfall | null {
  const finance = getTransferFinance(state);
  if (!finance) return null;
  const pendingEur = Math.max(0, Math.round(pending.upFrontEur ?? 0));
  const pendingWage = Math.max(0, Math.round(pending.wageEurPerMonth ?? 0));
  return {
    cashEur: finance.cashEur,
    frameEur: finance.transferBudgetEur + finance.committedEur,
    committedEur: finance.committedEur,
    remainingEur: finance.transferBudgetEur,
    wageRoomEurPerMonth: Math.round(finance.wageRoomEurPerMonth),
    pendingEur,
    afterPendingEur: finance.transferBudgetEur - pendingEur,
    pendingWageEurPerMonth: pendingWage,
    wageRoomAfterEurPerMonth: Math.round(finance.wageRoomEurPerMonth) - pendingWage,
  };
}

// ------------------------------------------------------------------ the market table (REC-03 / REC-03b)
export interface MarketRow {
  player: PlayerMock;
  clubId: string;
  age: number | null;
  contractStatus: ContractStatus | undefined;
  contractEnd: string | null;
  /** Knowledge-gated value range (never the hidden value). */
  value: { min: number; max: number } | null;
  /** Knowledge-gated star range; null when no rating is available locally (scout first). */
  ability: StarRange | null;
  knowledgePct: number;
  interest: PlayerInterestEvaluation;
  needLevel: NeedLevel;
  negotiation: NegotiationSummary | null;
  shortlisted: boolean;
  /** Opportunities only: why the player fits. */
  why?: string;
}

const NEED_WEIGHT: Record<NeedLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
const INTEREST_WEIGHT: Record<PlayerInterestEvaluation["interestLevel"], number> = { HIGH: 4, INTERESTED: 3, UNSURE: 2, UNLIKELY: 1, IMPOSSIBLE: 0 };

export function isExpiringContract(status: ContractStatus | undefined): boolean {
  return status === "FREE_AGENT" || status === "EXPIRING" || status === "EXPIRING_SOON";
}

function buildRow(state: CareerState, player: PlayerMock, needs: Map<HandballPosition, NeedLevel>, why?: string): MarketRow {
  const knowledgePct = getPlayerKnowledgePct(state, player.id, player.clubId);
  const valueEur = getPlayerMarketValueEur(state, player.id);
  const value = valueEur === undefined ? null : resolveMarketValueRange(valueEur, knowledgePct, player.id);
  const rating = getCareerPlayerRating(state, player.id, player.clubId);
  const latest = getLatestNegotiation(state, player.id, state.playerClubId);
  const contract = getPlayerContract(state, player.id);
  return {
    player,
    clubId: player.clubId,
    age: playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate),
    contractStatus: getPlayerContractStatus(state, player.id),
    contractEnd: contract?.contractEndDate ?? null,
    value: value ? { min: value.min, max: value.max } : null,
    ability: rating ? careerPlayerVisibility(state, rating, player.id, knowledgePct).abilityRange : null,
    knowledgePct,
    interest: evaluatePlayerInterest(state, player.id, state.playerClubId),
    needLevel: needs.get(player.position) ?? "NONE",
    negotiation: latest ? summarizeNegotiation(latest) : null,
    shortlisted: isShortlisted(state, player.id),
    why,
  };
}

/** Every player the manager could approach: external clubs' squads and free agents (the same pool as before). */
function marketPool(state: CareerState): PlayerMock[] {
  return [
    ...getExternalCandidateClubs(state).flatMap((club) => getCareerClubSquad(state, club.id)),
    ...getFreeAgents(state),
  ];
}

/** The Kortlista -- the recruitment shortlist, the same data the Recruitment Centre shows. */
export function kortlistaPlayers(state: CareerState): PlayerMock[] {
  return Object.values(state.recruitmentTargets ?? {})
    .filter((t) => t.shortlisted)
    .map((t) => getCareerPlayer(state, t.playerId))
    .filter((p): p is PlayerMock => !!p && p.clubId !== state.playerClubId);
}

export interface MarketTable {
  rows: MarketRow[];
  /** Rows in the view before filters -- so the UI can say "n dolda av filtren". */
  totalInView: number;
  counts: Record<MarketView, number>;
}

/**
 * One table, three saved views. Filters (position, name, interest, expiring) apply to every view. Rows are
 * ranked by need fit, then by how willing the player is, then by the scouts' value estimate -- never by
 * hidden ability. Opportunities keep the opportunity model's own order.
 */
export function buildMarketTable(state: CareerState, query: DeskQuery, limit = 120): MarketTable {
  const needs = new Map(getManagerRecruitmentNeeds(state).map((n) => [n.position, n.level] as const));
  const opportunities = getTransferOpportunities(state, 24);
  const kortlista = kortlistaPlayers(state);
  const pool = query.view === "marknad" ? marketPool(state) : null;
  const base: { player: PlayerMock; why?: string }[] =
    query.view === "mojligheter" ? opportunities.map((o) => ({ player: o.player, why: o.why }))
      : query.view === "kortlista" ? kortlista.map((player) => ({ player }))
        : pool!.map((player) => ({ player }));
  const q = query.q.trim().toLowerCase();
  const rows: MarketRow[] = [];
  for (const { player, why } of base) {
    if (query.pos !== "ALL" && player.position !== query.pos) continue;
    if (q && !`${player.firstName} ${player.lastName}`.toLowerCase().includes(q)) continue;
    if (query.expiring && !isExpiringContract(getPlayerContractStatus(state, player.id))) continue;
    const interest = evaluatePlayerInterest(state, player.id, state.playerClubId);
    if (!matchesInterestFilter(interest, query.interest)) continue;
    rows.push(buildRow(state, player, needs, why));
  }
  if (query.view !== "mojligheter") {
    const mid = (r: MarketRow) => (r.value ? (r.value.min + r.value.max) / 2 : 0);
    rows.sort((a, b) => NEED_WEIGHT[b.needLevel] - NEED_WEIGHT[a.needLevel] || INTEREST_WEIGHT[b.interest.interestLevel] - INTEREST_WEIGHT[a.interest.interestLevel] || mid(b) - mid(a) || a.player.lastName.localeCompare(b.player.lastName, "sv"));
  }
  return {
    rows: rows.slice(0, limit),
    totalInView: base.length,
    counts: { mojligheter: opportunities.length, marknad: pool ? pool.length : marketPool(state).length, kortlista: kortlista.length },
  };
}

// ------------------------------------------------------------------ deal readiness (REC-03c / REC-04a)
export type ReadinessStatus = "ok" | "warn" | "blocked" | "info";
export interface ReadinessItem {
  key: "interest" | "pending" | "cooldown" | "budget" | "window" | "knowledge";
  label: string;
  status: ReadinessStatus;
  detail: string;
  fix?: { href: string; label: string };
}

export interface DealReadiness {
  own: boolean;
  /** An open negotiation exists -- the room continues it. */
  continuing: boolean;
  canNegotiate: boolean;
  /** The first blocking reason, as visible text. */
  blockedReason: string | null;
  canLoan: boolean;
  loanReason: string | null;
  items: ReadinessItem[];
  value: { min: number; max: number } | null;
  knowledgePct: number;
  trainingCompensationEur: number;
  /** Up-front estimate: the low end of the scouts' value range (no fee for a free agent) plus training compensation. */
  estimatedUpFrontEur: number;
}

/**
 * The deal readiness checklist. Only the negotiation rules' real start guards (own player, interest, an agreed
 * deal waiting for the window, a cooling-off period) BLOCK; budget, window and knowledge are honest context.
 */
export function dealReadiness(state: CareerState, playerId: string): DealReadiness | null {
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player) return null;
  const own = contract?.clubId === state.playerClubId;
  const status = getPlayerContractStatus(state, playerId);
  const freeAgent = status === "FREE_AGENT";
  const knowledgePct = getPlayerKnowledgePct(state, playerId, player.clubId);
  const valueEur = getPlayerMarketValueEur(state, playerId);
  const value = valueEur === undefined ? null : (({ min, max }) => ({ min, max }))(resolveMarketValueRange(valueEur, knowledgePct, playerId));
  const latest = getLatestNegotiation(state, playerId, state.playerClubId);
  const continuing = !!latest && isNegotiationOpen(latest);
  const trainingCompensationEur = getPlayerTrainingCompensation(state, playerId)?.totalEur ?? 0;
  const estimatedUpFrontEur = (freeAgent ? 0 : value?.min ?? 0) + trainingCompensationEur;
  const finance = getTransferFinance(state);
  const items: ReadinessItem[] = [];

  const interest = own ? null : evaluatePlayerInterest(state, playerId, state.playerClubId);
  if (interest) items.push({ key: "interest", label: "Spelarens intresse", status: interest.willEnterNegotiations ? (interest.tone === "caution" ? "warn" : "ok") : "blocked", detail: `${interest.label}. ${interest.reason}` });
  const pending = !own && hasActivePendingTransfer(state, playerId);
  if (!own) items.push({ key: "pending", label: "Ingen affär väntar", status: pending ? "blocked" : "ok", detail: pending ? "Spelaren har redan en överenskommen affär som väntar på transferfönstret." : "Ingen annan överenskommelse binder spelaren." });
  const cooldown = own ? undefined : getTransferNegotiations(state).find((n) => n.playerId === playerId && n.toClubId === state.playerClubId && n.closedUntil && state.gameDate < n.closedUntil);
  if (cooldown) items.push({ key: "cooldown", label: "Ingen spärr", status: "blocked", detail: `Samtalen bröts nyligen. Ny kontakt tidigast ${cooldown.closedUntil}.` });
  if (!own && finance) {
    const fits = estimatedUpFrontEur <= finance.transferBudgetEur;
    items.push({ key: "budget", label: "Budget räcker", status: fits ? "ok" : "warn", detail: fits ? `Uppskattad kostnad vid underskrift från ${Math.round(estimatedUpFrontEur)} € ryms i transferbudgeten.` : `Uppskattad kostnad vid underskrift från ${Math.round(estimatedUpFrontEur)} € är mer än transferbudgeten (${Math.round(finance.transferBudgetEur)} €). Ett bud över budgeten stoppas.`, fix: fits ? undefined : { href: "/career/finance", label: "Se ekonomin" } });
  }
  const windowOpen = isTransferWindowOpen(state.gameDate);
  if (!own) items.push({ key: "window", label: "Fönstret öppet", status: windowOpen ? "ok" : "info", detail: windowOpen ? "En överenskommen övergång registreras direkt." : `Fönstret är stängt. En överenskommelse registreras när det öppnar ${nextTransferWindowOpenDate(state.gameDate)}. Lån startar direkt.` });
  if (!own) {
    const tier = knowledgeTier(knowledgePct);
    const thin = tier === "MINIMAL" || tier === "LOW";
    items.push({ key: "knowledge", label: "Kännedom", status: thin ? "warn" : "ok", detail: thin ? `Kännedom ${Math.round(knowledgePct)} % -- värderingen är bred. En scoutrapport smalnar av spannet.` : `Kännedom ${Math.round(knowledgePct)} % -- värderingen är tillräckligt säker att buda på.`, fix: thin ? { href: "/career/scouting", label: "Scouta först" } : undefined });
  }

  const blocked = items.find((i) => i.status === "blocked");
  const canNegotiate = !own && (continuing || !blocked);
  const blockedReason = own ? "Spelaren tillhör er klubb." : continuing ? null : blocked?.detail ?? null;
  let loanReason: string | null = null;
  if (own) loanReason = "Spelaren tillhör er klubb.";
  else if (freeAgent) loanReason = "En kontraktslös spelare värvas, inte lånas.";
  else if (getActiveLoanForPlayer(state, playerId)) loanReason = "Spelaren är redan utlånad.";
  else if (contract && player.clubId !== contract.clubId) loanReason = "Spelaren spelar inte för klubben som äger kontraktet just nu.";
  else if (!canNegotiate) loanReason = blockedReason;
  else if (continuing) loanReason = "En förhandling pågår redan -- fortsätt den i förhandlingsrummet.";
  return { own, continuing, canNegotiate, blockedReason, canLoan: loanReason === null, loanReason, items, value, knowledgePct, trainingCompensationEur, estimatedUpFrontEur };
}

// ------------------------------------------------------------------ term sheet (REC-04 / REC-04c)
export interface TermGap {
  /** Their figure minus ours; > 0 means we are below them. */
  gap: number;
  label: string;
  met: boolean;
}

/** The distance between our figure and theirs on one term ("skiljer 120 000 kr" / "Möts"). */
export function termGap(ours: number, theirs: number | undefined, format: (n: number) => string): TermGap | null {
  if (theirs === undefined) return null;
  const gap = Math.round(theirs - ours);
  if (gap <= 0) return { gap, label: gap === 0 ? "Möts" : `Över med ${format(-gap)}`, met: true };
  return { gap, label: `Skiljer ${format(gap)}`, met: false };
}

/** Role-promise context: how many of the manager's players at this position already hold each tier. */
export function roleContext(state: CareerState, position: HandballPosition): Record<SquadStatusTier, number> {
  const out: Record<SquadStatusTier, number> = { KEY_PLAYER: 0, FIRST_CHOICE: 0, ROTATION: 0, SQUAD_PLAYER: 0, TALENT: 0 };
  for (const p of getCareerSquad(state)) {
    if (p.position !== position) continue;
    const tier = getPlayerSquadStatus(state, p.id);
    if (tier) out[tier] += 1;
  }
  return out;
}

// ------------------------------------------------------------------ waiting card (REC-04d)
export interface WaitingDay { date: string; daysFromToday: number; isAnswerDay: boolean; pins: SpinePin[] }

/** The days between today and the answer, with what happens on each (the Week Spine's own pins). Capped. */
export function daysUntilAnswer(state: CareerState, responseDate: string, cap = 10): WaitingDay[] {
  const total = Math.max(0, daysBetween(state.gameDate, responseDate));
  const out: WaitingDay[] = [];
  for (let i = 1; i <= Math.min(total, cap); i += 1) {
    const date = addDays(state.gameDate, i);
    out.push({ date, daysFromToday: i, isAnswerDay: date === responseDate, pins: pinsOn(state, date) });
  }
  return out;
}

// ------------------------------------------------------------------ sell side (REC-03a / REC-05 / REC-05a)
const SELL_OPEN = new Set(["OPEN", "OFFER_RECEIVED"]);
const SELL_LIVE = new Set(["OPEN", "OFFER_RECEIVED", "COUNTERED", "COUNTEROFFER_SUBMITTED", "CLUBS_AGREED", "PLAYER_NEGOTIATING", "AWAITING_FINAL_APPROVAL", "AWAITING_WINDOW", "ACCEPTED", "COMPLETED"]);

export interface SellImpact {
  position: HandballPosition;
  before: DepthSpot;
  after: DepthSpot;
  needLevel: NeedLevel;
  /** "gap" when no selectable natural remains, "thin" with one, "ok" otherwise. */
  tone: "gap" | "thin" | "ok";
}

export function sellImpact(state: CareerState, playerId: string): SellImpact | null {
  const player = getCareerPlayer(state, playerId);
  if (!player) return null;
  const squad = getCareerSquad(state);
  const before = positionDepth(state, squad).find((d) => d.position === player.position);
  const after = positionDepth(state, squad.filter((p) => p.id !== playerId)).find((d) => d.position === player.position);
  if (!before || !after) return null;
  const needLevel = getManagerRecruitmentNeeds(state).find((n) => n.position === player.position)?.level ?? "NONE";
  return { position: player.position, before, after, needLevel, tone: after.available === 0 ? "gap" : after.available === 1 ? "thin" : "ok" };
}

export interface SellBidRow {
  offer: IncomingOffer;
  playerName: string;
  position: HandballPosition | null;
  /** Own player: the club's own valuation (what the squad profile already shows). */
  marketValueEur: number | null;
  deltaEur: number | null;
  needsAnswer: boolean;
  daysLeft: number;
  impact: SellImpact | null;
}

/** Live bids for the manager's players, the ones waiting for an answer first, then by respond-by date. */
export function sellBids(state: CareerState): SellBidRow[] {
  const ours = (id: string) => state.playerContracts[id]?.clubId === state.playerClubId;
  return Object.values(state.incomingOffers ?? {})
    .filter((o) => SELL_LIVE.has(o.status) && (ours(o.playerId) || o.status === "COMPLETED"))
    .map((offer) => {
      const p = getCareerPlayer(state, offer.playerId);
      const own = ours(offer.playerId);
      const value = own ? getPlayerMarketValueEur(state, offer.playerId) ?? null : null;
      return {
        offer,
        playerName: p ? `${p.firstName} ${p.lastName}` : offer.playerId,
        position: p?.position ?? null,
        marketValueEur: value,
        deltaEur: value === null ? null : offer.feeEur - value,
        needsAnswer: SELL_OPEN.has(offer.status) || offer.status === "AWAITING_FINAL_APPROVAL",
        daysLeft: daysBetween(state.gameDate, offer.respondBy),
        impact: own ? sellImpact(state, offer.playerId) : null,
      };
    })
    .sort((a, b) => Number(b.needsAnswer) - Number(a.needsAnswer) || a.offer.respondBy.localeCompare(b.offer.respondBy));
}

/** How many bids wait for the manager's answer -- the Sälj badge. */
export function sellBadgeCount(state: CareerState): number {
  return sellBids(state).filter((b) => b.needsAnswer).length;
}

export interface SaleMoney {
  feeEur: number;
  marketValueEur: number | null;
  contractEnd: string | null;
  monthsLeft: number;
  wageEurPerMonth: number;
  /** Wage the club no longer pays for the rest of the contract. */
  wageSavedEur: number;
}

export function saleMoney(state: CareerState, offer: IncomingOffer): SaleMoney {
  const contract = state.playerContracts[offer.playerId];
  const ours = contract?.clubId === state.playerClubId;
  const monthsLeft = contract ? Math.max(0, Math.round(daysBetween(state.gameDate, contract.contractEndDate) / 30.44)) : 0;
  const wage = ours ? contract!.wageEurPerMonth : 0;
  return {
    feeEur: offer.feeEur,
    marketValueEur: ours ? getPlayerMarketValueEur(state, offer.playerId) ?? null : null,
    contractEnd: ours ? contract!.contractEndDate : null,
    monthsLeft: ours ? monthsLeft : 0,
    wageEurPerMonth: wage,
    wageSavedEur: wage * (ours ? monthsLeft : 0),
  };
}

export interface FarewellFacts {
  name: string;
  /** Seasons at the club from the career club history, when recorded. */
  seasonsAtClub: number | null;
  appearances: number;
  goals: number;
  feeEur: number;
  position: HandballPosition | null;
  fillGapHref: string;
}

export function farewellFacts(state: CareerState, offer: IncomingOffer): FarewellFacts {
  const p = getCareerPlayer(state, offer.playerId);
  const entry = getPlayerClubHistory(state, offer.playerId)?.entries.filter((e) => e.clubId === state.playerClubId).at(-1);
  const stats = state.playerSeasonStats?.[offer.playerId];
  const position = p?.position ?? null;
  return {
    name: p ? `${p.firstName} ${p.lastName}` : offer.playerId,
    seasonsAtClub: entry ? Math.max(1, entry.toAge - entry.fromAge + 1) : null,
    appearances: stats?.appearances ?? 0,
    goals: stats?.goals ?? 0,
    feeEur: offer.feeEur,
    position,
    fillGapHref: deskHref({ view: "marknad", pos: position ?? "ALL", interest: "REALISTIC" }),
  };
}
