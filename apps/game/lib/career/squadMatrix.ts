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
import { setPlayerTrainingLoad } from "../training/trainingSchedule";
import { setCaptaincy, currentTeamRoles } from "./teamRoles";
import { listPlayer } from "../players/talks";
import { updatePlayerSquadStatus, type SquadStatusTier } from "./squadStatus";

export type MatrixView = "READINESS" | "PERFORMANCE" | "CONTRACT_RISK" | "DEVELOPMENT";
export type MatrixDensity = "COMPACT" | "DETAILED";
export type MatrixColumn =
  | "position" | "age" | "role" | "energy" | "fitness" | "availability" | "returnDate" | "morale" | "load" | "trend" | "recovery"
  | "appearances" | "starts" | "goals" | "shotPct" | "savePct" | "rating" | "form" | "shots" | "shotsFaced"
  | "contractEnd" | "daysLeft" | "wage" | "contractStatus" | "contractAction"
  | "current" | "potential" | "trainingLoad" | "focus";

export const MATRIX_VIEWS: readonly { id: MatrixView; label: string; columns: readonly MatrixColumn[]; detailed: readonly MatrixColumn[] }[] = [
  { id: "READINESS", label: "Matchberedskap", columns: ["position", "age", "role", "energy", "fitness", "availability", "returnDate", "morale"], detailed: ["load", "trend", "recovery", "form"] },
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
  return MATRIX_VIEWS.find((v) => v.id === view)!.columns.filter((c) => !["position", "role", "energy", "fitness", "morale", "contractAction"].includes(c)).slice(0, 3);
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
