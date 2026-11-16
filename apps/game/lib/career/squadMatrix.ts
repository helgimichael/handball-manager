// Arena Nights C5.3 -- SQD-01 (A) "Squad Matrix": a dense, sortable roster whose rows start with a player
// chip (shirt, name, position, energy bar, match-fitness band, morale dot, form), four saved views,
// a compact/detailed density and a multi-select tray. Pure model + bulk actions over existing career
// operations (squad status, training load, captaincy, transfer list) -- no new game rules.
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";
import { averageRating, emptyPlayerSeasonStats } from "./types";
import { getCareerSquad } from "./careerWorld";
import { squadEnergy } from "./management";
import { isSelectableForMatch } from "./playerStatus";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { matchFitnessOf } from "../players/matchFitness";
import { moraleOf } from "../players/morale";
import { getPlayerContractStatus } from "../economy/contractIntegration";
import { getCareerPlayerRating } from "./careerRatingNormalization";
import { abilityStarsFromCA, potentialStarsFromPA } from "../development/types";
import { readinessSummary } from "../training/readinessSummary";
import { workloadWindow } from "../training/workloadLedger";
import { MATCH_FITNESS_FULL_EFFECT } from "../players/matchFitness";
import { setPlayerTrainingLoad } from "../training/trainingSchedule";
import { setCaptaincy, currentTeamRoles } from "./teamRoles";
import { listPlayer } from "../players/talks";
import { updatePlayerSquadStatus, type SquadStatusTier } from "./squadStatus";

export type MatrixView = "OVERVIEW" | "READINESS" | "PERFORMANCE" | "CONTRACT_RISK" | "DEVELOPMENT";
export type MatrixDensity = "COMPACT" | "DETAILED";
export type MatrixColumn =
  | "position" | "age" | "role" | "energy" | "fitness" | "availability" | "returnDate" | "morale" | "load" | "trend" | "recovery"
  | "appearances" | "starts" | "goals" | "shotPct" | "savePct" | "rating" | "form" | "shots" | "shotsFaced"
  | "contractEnd" | "daysLeft" | "wage" | "contractStatus" | "contractAction"
  | "current" | "potential" | "trainingLoad" | "focus"
  | "readiness" | "output" | "goalsPerMatch" | "savesPerMatch";

export const MATRIX_VIEWS: readonly { id: MatrixView; label: string; columns: readonly MatrixColumn[]; detailed: readonly MatrixColumn[] }[] = [
  // SQD-01a (A): curated 8-column summary (chip + 7); every other figure lives in the expandable row band.
  { id: "OVERVIEW", label: "Översikt", columns: ["position", "role", "readiness", "form", "rating", "output", "contractEnd"], detailed: [] },
  // SQD-01c (A): the readiness heat-strip (rendered as its own table; these columns drive the phone card fallback).
  { id: "READINESS", label: "Fysisk status", columns: ["position", "age", "role", "energy", "fitness", "availability", "returnDate", "morale"], detailed: ["load", "trend", "recovery", "form"] },
  { id: "PERFORMANCE", label: "Prestation", columns: ["position", "role", "appearances", "starts", "goals", "shotPct", "savePct", "rating"], detailed: ["shots", "shotsFaced", "form", "age"] },
  { id: "CONTRACT_RISK", label: "Kontraktsrisk", columns: ["position", "age", "role", "contractEnd", "daysLeft", "wage", "contractStatus", "contractAction"], detailed: ["rating", "appearances", "morale"] },
  { id: "DEVELOPMENT", label: "Utveckling", columns: ["position", "age", "role", "current", "potential", "starts", "trainingLoad", "focus"], detailed: ["appearances", "rating", "fitness"] },
];

export const POSITIONS = ["V6", "V9", "M9", "M6", "H9", "H6", "MV"] as const;
export type StateFilter = "ALL" | "AVAILABLE" | "UNAVAILABLE" | "TIRED";

export interface MatrixRow {
  player: PlayerMock;
  id: string;
  name: string;
  shirt: number | null;
  position: string;
  secondaryPosition?: string | null;
  age: number | null;
  role: SquadStatusTier;
  energy: number;
  fitness: number;
  /** Match-fitness band for the chip pip. */
  fitnessBand: "LOW" | "MID" | "HIGH";
  morale: number;
  moraleTone: "good" | "ok" | "low" | "bad";
  available: boolean;
  availability: string;
  returnDate: string | null;
  appearances: number; starts: number; goals: number; shots: number; saves: number; shotsFaced: number;
  shotPct: number | null; savePct: number | null; rating: number | null;
  contractEnd: string | null; daysLeft: number | null; wage: number; contractStatus: string | null;
  current: number | null; potential: number | null;
  trainingLoad: string; focus: string | null;
  load: number | null; trend: string | null; recovery: string;
  /** 7-day load against the 28-day weekly average (null until both windows are complete). */
  loadRatio: number | null;
  /** Recovery reasons from readinessSummary (plain language, shown as chips -- not tooltips). */
  reasons: string[];
  goalsPerMatch: number | null; savesPerMatch: number | null;
  captain: boolean; vice: boolean; penaltyOrder: number | null;
}

const DAY_MS = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

export function buildMatrixRows(state: CareerState): MatrixRow[] {
  const roles = currentTeamRoles(state);
  return getCareerSquad(state).map((p): MatrixRow => {
    const stats = state.playerSeasonStats[p.id] ?? emptyPlayerSeasonStats(p.id);
    const fitness = Math.round(matchFitnessOf(state, p.id));
    const morale = moraleOf(state, p.id);
    const contract = state.playerContracts[p.id];
    const rating = getCareerPlayerRating(state, p.id);
    const readiness = readinessSummary(state, p.id);
    const status = state.playerStatuses[p.id];
    const month = workloadWindow(state.workloadLedger, p.id, state.gameDate, 28);
    const loadRatio = readiness.week.complete && month.complete && month.total > 0 ? Math.round((readiness.week.total / (month.total / 4)) * 100) / 100 : null;
    return {
      player: p, id: p.id, name: `${p.firstName} ${p.lastName}`, shirt: p.shirtNumber ?? null, position: p.position, secondaryPosition: p.secondaryPosition ?? null,
      age: playerAgeAtDate(p.dateOfBirth, p.birthYear, state.gameDate),
      role: (state.playerSquadStatus[p.id] ?? "ROTATION") as SquadStatusTier,
      energy: Math.round(squadEnergy(state, p)), fitness, fitnessBand: fitness < 50 ? "LOW" : fitness < 75 ? "MID" : "HIGH",
      morale, moraleTone: morale >= 70 ? "good" : morale >= 55 ? "ok" : morale >= 40 ? "low" : "bad",
      available: isSelectableForMatch(state.playerStatuses, p.id), availability: status?.availability ?? "AVAILABLE",
      returnDate: state.playerInjuries[p.id]?.activeInjury?.expectedReturnDate ?? status?.returnDate ?? null,
      appearances: stats.appearances, starts: stats.starts, goals: stats.goals, shots: stats.shots, saves: stats.saves, shotsFaced: stats.shotsFaced,
      shotPct: stats.shots ? Math.round((stats.goals / stats.shots) * 100) : null,
      savePct: stats.shotsFaced ? Math.round((stats.saves / stats.shotsFaced) * 100) : null,
      rating: stats.appearances ? Math.round(averageRating(stats) * 10) / 10 : null,
      contractEnd: contract?.contractEndDate ?? null, daysLeft: contract ? days(state.gameDate, contract.contractEndDate) : null, wage: contract?.wageEurPerMonth ?? 0,
      contractStatus: getPlayerContractStatus(state, p.id) ?? null,
      current: rating ? abilityStarsFromCA(rating.ca) : null, potential: rating ? potentialStarsFromPA(rating.pa) : null,
      trainingLoad: state.playerTrainingAssignments[p.id]?.loadSetting ?? "FULL", focus: state.playerTrainingAssignments[p.id]?.individualFocus ?? null,
      load: readiness.week.complete ? Math.round(readiness.week.total) : null, trend: readiness.trend ?? null, recovery: readiness.outlook,
      loadRatio, reasons: readiness.reasons,
      goalsPerMatch: stats.appearances ? Math.round((stats.goals / stats.appearances) * 10) / 10 : null,
      savesPerMatch: stats.appearances && stats.shotsFaced ? Math.round((stats.saves / stats.appearances) * 10) / 10 : null,
      captain: roles.captainId === p.id, vice: roles.viceCaptainId === p.id, penaltyOrder: roles.penaltyTakers.includes(p.id) ? roles.penaltyTakers.indexOf(p.id) + 1 : null,
    };
  });
}

export interface MatrixQuery { query: string; position: string; state: StateFilter; sortKey: keyof MatrixRow; direction: "asc" | "desc" }

const POSITION_ORDER: Record<string, number> = Object.fromEntries(["MV", ...POSITIONS.filter((p) => p !== "MV")].map((p, i) => [p, i]));

export function filterSortMatrix(rows: readonly MatrixRow[], q: MatrixQuery): MatrixRow[] {
  const term = q.query.trim().toLocaleLowerCase("sv");
  const out = rows.filter((r) =>
    (!term || r.name.toLocaleLowerCase("sv").includes(term)) &&
    (q.position === "ALL" || r.position === q.position || r.secondaryPosition === q.position) &&
    (q.state === "ALL" || (q.state === "AVAILABLE" ? r.available : q.state === "UNAVAILABLE" ? !r.available : r.energy < 75)));
  const dir = q.direction === "asc" ? 1 : -1;
  return [...out].sort((a, b) => {
    const k = q.sortKey;
    const av = k === "position" ? POSITION_ORDER[a.position] ?? 99 : a[k], bv = k === "position" ? POSITION_ORDER[b.position] ?? 99 : b[k];
    // Missing values always sort last, whatever the direction.
    if (av == null && bv == null) return a.name.localeCompare(b.name, "sv");
    if (av == null) return 1;
    if (bv == null) return -1;
    const c = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv, "sv") : Number(av) - Number(bv);
    return c * dir || a.name.localeCompare(b.name, "sv");
  });
}

/** Top-3 metrics of a view for the phone card (the chip already carries energy, fitness, morale and form). */
export function cardMetrics(view: MatrixView): MatrixColumn[] {
  return MATRIX_VIEWS.find((v) => v.id === view)!.columns.filter((c) => !["position", "role", "energy", "fitness", "morale", "contractAction", "readiness", "form"].includes(c)).slice(0, 3);
}

// ---------------------------------------------------------------- tray actions (existing operations, many players)
export type TrayAction =
  | { kind: "ROLE"; tier: SquadStatusTier }
  | { kind: "REST" } | { kind: "FULL_LOAD" }
  | { kind: "CAPTAIN" } | { kind: "VICE" }
  | { kind: "TRANSFER_LIST" };

/** Applies a tray action to the selected players; returns the new state and the players it could not apply to (with the reason). */
export function applyTrayAction(state: CareerState, ids: readonly string[], action: TrayAction): { state: CareerState; skipped: { id: string; reason: string }[] } {
  let next = state;
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      if (action.kind === "ROLE") next = updatePlayerSquadStatus(next, id, action.tier);
      else if (action.kind === "REST") next = setPlayerTrainingLoad(next, id, "REST");
      else if (action.kind === "FULL_LOAD") next = setPlayerTrainingLoad(next, id, "FULL");
      else if (action.kind === "TRANSFER_LIST") { if (next.playerDynamics?.listings?.[id]) { skipped.push({ id, reason: "redan transferlistad" }); continue; } next = listPlayer(next, id, "MANAGER"); }
    } catch (e) { skipped.push({ id, reason: e instanceof Error ? e.message : String(e) }); }
  }
  if (action.kind === "CAPTAIN" || action.kind === "VICE") {
    if (ids.length !== 1) return { state, skipped: ids.map((id) => ({ id, reason: "välj exakt en spelare" })) };
    next = setCaptaincy(state, action.kind, ids[0]!);
  }
  return { state: next, skipped };
}

// ---------------------------------------------------------------- SQD-01c readiness heat-strip (bands over existing values)
export type HeatTone = "ok" | "warn" | "bad" | "info" | "none";
export interface HeatCell { key: "energy" | "fitness" | "load" | "trend" | "outlook"; label: string; value: string; tone: HeatTone; band: string }

/** Energy bands shown in the legend: Pigg >= 80, Något sliten >= 55, Trött below. */
export function energyBand(energy: number): { band: string; tone: HeatTone } {
  return energy >= 80 ? { band: "Pigg", tone: "ok" } : energy >= 55 ? { band: "Något sliten", tone: "warn" } : { band: "Trött", tone: "bad" };
}
/** Match fitness against the existing full-effect threshold (MATCH_FITNESS_FULL_EFFECT = 80) and the matrix's 50 % low mark. */
export function fitnessBand(fitness: number): { band: string; tone: HeatTone } {
  return fitness >= MATCH_FITNESS_FULL_EFFECT ? { band: "Full effekt", tone: "ok" } : fitness >= 50 ? { band: "Under full effekt", tone: "warn" } : { band: "Låg matchträning", tone: "bad" };
}
/** Load ratio uses the same 1.15 / 0.85 limits as readinessSummary's trend. */
export function loadBand(ratio: number | null): { band: string; tone: HeatTone } {
  if (ratio == null) return { band: "Historik saknas", tone: "none" };
  return ratio > 1.15 ? { band: "Över vanan", tone: "warn" } : ratio < 0.85 ? { band: "Under vanan", tone: "info" } : { band: "I nivå", tone: "ok" };
}

export function heatStrip(r: MatrixRow): HeatCell[] {
  const e = energyBand(r.energy), f = fitnessBand(r.fitness), l = loadBand(r.loadRatio);
  const trend = r.trend === "RISING" ? { value: "↑", band: "Ökande", tone: "warn" as HeatTone } : r.trend === "FALLING" ? { value: "↓", band: "Minskande", tone: "ok" as HeatTone } : r.trend === "STABLE" ? { value: "→", band: "Stabil", tone: "ok" as HeatTone } : { value: "—", band: "Historik saknas", tone: "none" as HeatTone };
  return [
    { key: "energy", label: "Energi", value: `${r.energy}%`, ...e },
    { key: "fitness", label: "Matchträning", value: `${r.fitness}%`, ...f },
    { key: "load", label: "7 d / 28 d", value: r.loadRatio == null ? "—" : `${r.loadRatio.toFixed(2)}×`, ...l },
    { key: "trend", label: "Trend", ...trend },
    { key: "outlook", label: "Utsikt", value: r.recovery === "GOOD" ? "God" : r.recovery === "REDUCED" ? "Nedsatt" : "Normal", band: "Återhämtning i natt", tone: r.recovery === "GOOD" ? "ok" : r.recovery === "REDUCED" ? "bad" : "info" },
  ];
}

/** Sort order for "sortera på risk": unavailable first, then the count/severity of warning cells. Ordering only -- not a medical score. */
export function readinessRisk(r: MatrixRow): number {
  const w: Record<HeatTone, number> = { bad: 3, warn: 1, info: 0, ok: 0, none: 0 };
  return (r.available ? 0 : 100) + heatStrip(r).reduce((s, c) => s + w[c.tone], 0);
}

/** Reason chips: readinessSummary's reasons, negative ones first; the first is the "worst" chip on phones. */
const POSITIVE_REASONS = ["God uthållighet"];
export function reasonChips(r: MatrixRow): { text: string; tone: "neg" | "pos" | "info" }[] {
  const rank = { neg: 0, info: 1, pos: 2 } as const;
  return r.reasons
    .map((text) => ({ text, tone: POSITIVE_REASONS.includes(text) ? "pos" as const : /kort|Ålder/.test(text) ? "info" as const : "neg" as const }))
    .sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/** Plain explanation shown when a reason chip is tapped (touch-accessible replacement for the old title tooltips). */
export function reasonExplanation(text: string): string {
  if (/Mer belastning/.test(text)) return "De senaste sju dagarnas belastning ligger över spelarens vana från de senaste fyra veckorna. Återhämtningen går långsammare tills belastningen jämnar ut sig.";
  if (/Återhämtar till högst/.test(text)) return "Hög belastning sätter ett tak för hur pigg spelaren kan bli. Taket släpper när belastningen sjunker -- en vilodag eller reducerad träning hjälper.";
  if (/Nyligen spelad match/.test(text)) return "Dagarna närmast efter en match återhämtar sig spelaren långsammare.";
  if (/rehabilitering/.test(text)) return "Spelaren är under rehabilitering, vilket sänker återhämtningen. Se medicinska avdelningen.";
  if (/Ålder/.test(text)) return "Äldre spelare återhämtar sig något långsammare.";
  if (/God uthållighet/.test(text)) return "Spelarens uthållighet gör att han återhämtar sig snabbare än snittet.";
  if (/Lägre uthållighet/.test(text)) return "Spelarens uthållighet gör att han återhämtar sig långsammare än snittet.";
  if (/kort/.test(text)) return "Det finns ännu inte fyra veckors belastningshistorik, så jämförelsen mot vanan är osäker.";
  return text;
}

// ---------------------------------------------------------------- SQD-01b position-aware performance
export function splitByRole(rows: readonly MatrixRow[]): { outcourt: MatrixRow[]; goalkeepers: MatrixRow[] } {
  return { outcourt: rows.filter((r) => r.position !== "MV"), goalkeepers: rows.filter((r) => r.position === "MV") };
}

// ---------------------------------------------------------------- SQD-01d contract countdown
/** Share of a 2-year horizon left on the contract (100 = 730+ days), for the countdown bar. */
export function contractCountdownPct(daysLeft: number | null): number | null {
  if (daysLeft == null) return null;
  return Math.max(0, Math.min(100, Math.round((daysLeft / 730) * 100)));
}

// ---------------------------------------------------------------- SQD-01g explaining empty state
export interface EmptyExplanation { message: string; nearest: MatrixRow[] }
const AVAILABILITY_SHORT: Record<string, string> = { INJURED: "skadad", SUSPENDED: "avstängd", RECOVERING: "under återhämtning", LIMITED: "begränsad", ON_PLACEMENT: "hos partnerklubb", NATIONAL_TEAM: "med landslaget" };
/**
 * Why a filter combination returned zero rows, and the nearest real matches: the same position without the
 * state filter and search, or the search without the position. Unavailable players are listed with return dates.
 */
export function explainEmpty(rows: readonly MatrixRow[], q: Pick<MatrixQuery, "query" | "position" | "state">): EmptyExplanation {
  const atPos = q.position === "ALL" ? [...rows] : rows.filter((r) => r.position === q.position || r.secondaryPosition === q.position);
  const posLabel = q.position === "ALL" ? "spelare" : q.position;
  const parts: string[] = [];
  if (q.position !== "ALL" && atPos.length === 0) parts.push(`Truppen har ingen ${posLabel}`);
  else if (q.state === "AVAILABLE") {
    const out = atPos.filter((r) => !r.available);
    parts.push(`0 tillgängliga ${posLabel}` + (out.length ? ` -- ${out.map((r) => `${r.name.split(" ").at(-1)} ${AVAILABILITY_SHORT[r.availability] ?? "inte tillgänglig"}${r.returnDate ? `, åter ${r.returnDate}` : ""}`).join("; ")}` : ""));
  } else if (q.state === "UNAVAILABLE") parts.push(`Alla ${posLabel} är tillgängliga`);
  else if (q.state === "TIRED") parts.push(`Ingen ${posLabel === "spelare" ? "spelare" : posLabel} har energi under 75 %`);
  if (q.query.trim()) parts.push(`ingen träff på "${q.query.trim()}"`);
  const loose = filterSortMatrix(rows, { query: "", position: q.position, state: "ALL", sortKey: "position", direction: "asc" });
  const nearest = (loose.length ? loose : filterSortMatrix(rows, { query: q.query, position: "ALL", state: "ALL", sortKey: "position", direction: "asc" })).slice(0, 4);
  return { message: (parts.join(" · ") || "Inga spelare matchar dina filter") + ".", nearest };
}
