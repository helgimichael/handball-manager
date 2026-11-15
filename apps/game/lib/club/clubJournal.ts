// Arena Nights Phase 3 -- the Club Journal (CLB-02 C, CLB-02b A) and the shared position-depth model
// (SQD-01f B). Pure read-only views over existing career data: standings, season history, the board,
// the economy snapshot, contracts, player availability, staff and partnerships. No new reputation,
// supporter or financial calculation is introduced -- every figure is one the game already holds.
import type { CareerState } from "../career/types";
import type { HandballPosition, PlayerMock } from "../game-data/types";
import { getCareerClub, getCareerSquad } from "../career/careerWorld";
import { getPlayerClubPosition, getLiveStandings } from "../career/standings";
import { isSelectableForMatch } from "../career/playerStatus";
import { getClubEconomySnapshot } from "../economy/clubEconomyIntegration";
import { FINANCIAL_PRESSURE_LABEL, FINANCIAL_PRESSURE_TONE } from "../economy/clubEconomyLabels";
import { getClubPartnerships } from "../career/clubPartnerships";
import { seasonEndDate } from "../career/staticRelationPartnerships";

export type Tone = "good" | "warn" | "bad" | "neutral";

// ---------------------------------------------------------------- position depth (SQD-01f B)
export const COURT_POSITIONS: readonly HandballPosition[] = ["V6", "V9", "M9", "H9", "H6", "M6", "MV"];
export const POSITION_NAME: Record<HandballPosition, string> = { MV: "Målvakt", V6: "Vänsterkant", V9: "Vänsternia", M9: "Mittnia", M6: "Linje", H9: "Högernia", H6: "Högerkant" };
export interface DepthSpot {
  position: HandballPosition;
  /** Natural players at the position who can be selected today. */
  available: number;
  /** Natural players at the position, available or not. */
  total: number;
  /** Players from other positions who list this one as secondary and are available. */
  secondary: number;
  tone: Tone;
  natural: { id: string; name: string; available: boolean }[];
  cover: { id: string; name: string }[];
}
const fullName = (p: PlayerMock) => `${p.firstName} ${p.lastName}`;
const secondaries = (p: PlayerMock): HandballPosition[] => p.secondaryPositions ?? (p.secondaryPosition ? [p.secondaryPosition] : []);
/** Per position: who plays there naturally, who is available, and who can cover. Two available naturals = covered, one = thin, none = gap. */
export function positionDepth(state: CareerState, squad: readonly PlayerMock[] = getCareerSquad(state)): DepthSpot[] {
  const ok = (id: string) => isSelectableForMatch(state.playerStatuses, id);
  return COURT_POSITIONS.map((position) => {
    const natural = squad.filter((p) => p.position === position).map((p) => ({ id: p.id, name: fullName(p), available: ok(p.id) }));
    const cover = squad.filter((p) => p.position !== position && secondaries(p).includes(position) && ok(p.id)).map((p) => ({ id: p.id, name: fullName(p) }));
    const available = natural.filter((n) => n.available).length;
    const tone: Tone = available >= 2 ? "good" : available === 1 ? "warn" : "bad";
    return { position, available, total: natural.length, secondary: cover.length, tone, natural, cover };
  });
}

// ---------------------------------------------------------------- club journal (CLB-02 C)
export interface HistoryPoint { seasonId: string; position: number | null; teams: number; current: boolean }
export interface JournalBrief { id: string; title: string; headline: string; detail: string; tone: Tone; href: string; cta: string }
export interface ClubJournal {
  name: string;
  kicker: string[];
  history: HistoryPoint[];
  board: { confidence: number; predictedPosition: number; objectives: { label: string; status: string; progress: string }[] } | null;
  kpis: { cashEur: number; wageRoomEur: number; transferBudgetEur: number; pressureLabel: string; pressureTone: Tone } | null;
  revenueMix: { label: string; eur: number }[];
  depth: DepthSpot[];
  briefs: JournalBrief[];
}
const toneOf = (t: "positive" | "warning" | "negative" | "neutral"): Tone => (t === "positive" ? "good" : t === "warning" ? "warn" : t === "negative" ? "bad" : "neutral");
const rank: Record<Tone, number> = { bad: 0, warn: 1, neutral: 2, good: 3 };

export function clubJournal(state: CareerState): ClubJournal {
  const club = getCareerClub(state);
  const squad = getCareerSquad(state);
  const depth = positionDepth(state, squad);

  // History: every completed season the save remembers, then the live season.
  const history: HistoryPoint[] = (state.seasonHistory ?? []).map((h) => {
    const table = h.tables?.[h.competitionId] ?? h.table;
    const index = table.findIndex((r) => r.clubId === club.id);
    return { seasonId: h.seasonId, position: index >= 0 ? index + 1 : null, teams: table.length, current: false };
  });
  const live = getLiveStandings(state);
  const position = getPlayerClubPosition(state);
  history.push({ seasonId: state.seasonId, position: position > 0 && live.some((r) => r.played > 0) ? position : null, teams: live.length, current: true });

  const board = state.board && state.board.clubId === club.id
    ? { confidence: state.board.confidence, predictedPosition: state.board.predictedPosition, objectives: state.board.objectives.map((o) => ({ label: o.label, status: o.status, progress: o.progress })) }
    : null;

  const economy = getClubEconomySnapshot(state, club.id);
  const kpis = economy ? {
    cashEur: economy.cashEur,
    wageRoomEur: economy.budgets.wageBudgetEur - economy.playerWageCostsEurAnnual,
    transferBudgetEur: economy.budgets.transferBudgetEur,
    pressureLabel: FINANCIAL_PRESSURE_LABEL[economy.health.pressure],
    pressureTone: toneOf(FINANCIAL_PRESSURE_TONE[economy.health.pressure]),
  } : null;
  const revenueMix = economy ? [
    { label: "Kommersiellt", eur: economy.revenue.commercialRevenueEur },
    { label: "Media", eur: economy.revenue.mediaRevenueEur },
    { label: "Matchdag", eur: economy.revenue.matchdayRevenueEur },
    { label: "Sportsligt", eur: economy.revenue.sportingRevenueEur },
    { label: "Övrigt", eur: economy.revenue.otherRevenueEur },
  ].filter((r) => r.eur > 0) : [];

  // Department briefs: what is going well, what needs attention.
  const briefs: JournalBrief[] = [];
  const gaps = depth.filter((d) => d.tone === "bad"), thin = depth.filter((d) => d.tone === "warn");
  const unavailable = squad.filter((p) => !isSelectableForMatch(state.playerStatuses, p.id)).length;
  briefs.push({
    id: "squad", title: "Truppen", cta: "Truppens balans →", href: "/career/squad",
    tone: gaps.length ? "bad" : thin.length || unavailable ? "warn" : "good",
    headline: gaps.length ? `Ingen tillgänglig ${gaps.map((g) => POSITION_NAME[g.position].toLowerCase()).join(", ")}` : thin.length ? `Tunt på ${thin.map((t) => t.position).join(", ")}` : "Alla positioner har dubbel täckning",
    detail: `${squad.length} spelare · ${unavailable ? `${unavailable} inte spelbara just nu` : "alla spelbara"}`,
  });
  const summer = seasonEndDate(state.seasonId);
  const expiring = squad.filter((p) => { const c = state.playerContracts?.[p.id]; return c && c.contractEndDate <= summer; });
  briefs.push({
    id: "contracts", title: "Kontrakt", cta: "Kontraktsläget →", href: "/career/contracts",
    tone: expiring.length >= 4 ? "bad" : expiring.length ? "warn" : "good",
    headline: expiring.length ? `${expiring.length} avtal löper ut i sommar` : "Inga avtal löper ut den här säsongen",
    detail: expiring.length ? expiring.slice(0, 3).map(fullName).join(", ") + (expiring.length > 3 ? ` m.fl.` : "") : "Truppen är kontrakterad över säsongen.",
  });
  if (board) {
    const atRisk = board.objectives.filter((o) => o.status === "AT_RISK" || o.status === "FAILED");
    briefs.push({
      id: "board", title: "Styrelsen", cta: "Styrelserummet →", href: "/career/board",
      tone: board.confidence < 35 || atRisk.length >= 2 ? "bad" : board.confidence < 55 || atRisk.length ? "warn" : "good",
      headline: `Förtroende ${board.confidence} av 100`,
      detail: atRisk.length ? `I fara: ${atRisk.map((o) => o.label).join(", ")}` : `Väntad placering ${board.predictedPosition}. Målen ser ut att nås.`,
    });
  }
  if (kpis && economy) {
    briefs.push({
      id: "finance", title: "Ekonomin", cta: "Finanscentralen →", href: "/career/finance",
      tone: economy.budgets.wageOverBudget ? "bad" : kpis.pressureTone,
      headline: economy.budgets.wageOverBudget ? "Lönerna överstiger lönebudgeten" : kpis.pressureLabel,
      detail: `Lönerum ${kpis.wageRoomEur >= 0 ? "kvar" : "över"} · transferbudget finns i Finanscentralen`,
    });
  }
  const staff = state.staffRoster[club.id] ?? [];
  briefs.push({
    id: "staff", title: "Personalen", cta: "Personal →", href: "/career/staff",
    tone: staff.length ? "neutral" : "warn",
    headline: staff.length ? `${staff.length} i ledarstaben` : "Ingen personal anställd",
    detail: "Ansvar, delegering och rekrytering av personal.",
  });
  const partnerships = getClubPartnerships(state, club.id).filter((p) => p.status === "ACTIVE" || p.type === "AFFILIATED_B_TEAM");
  briefs.push({
    id: "partners", title: "Partnerskap", cta: "Partnerskap →", href: "/career/club/partnerships",
    tone: "neutral",
    headline: partnerships.length ? `${partnerships.length} aktiva samarbeten` : "Inget aktivt samarbete",
    detail: partnerships.length ? "B-lag och samarbetsklubbar för speltid och utveckling." : "En samarbetsklubb ger unga spelare matcher.",
  });
  briefs.sort((a, b) => rank[a.tone] - rank[b.tone]);

  const kicker = [club.founded ? `Grundad ${club.founded}` : null, club.city ?? null, club.venue ?? null].filter((x): x is string => !!x);
  return { name: club.name, kicker, history, board, kpis, revenueMix, depth, briefs };
}
