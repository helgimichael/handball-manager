// HM-PLAYTEST-01 1.2: the pre-kickoff squad check. Two kinds of finding:
//
//   BLOCKING  the selection breaks a rule the match cannot be played
//             without (IHF 4:1-4:3 as modelled here: at most 16 registered
//             players, a goalkeeper and six court players to start, every
//             registered player actually available).
//   WARNING   legal but risky -- the manager is asked to confirm, never
//             silently overruled. No player is ever added to the squad.
//
// Pure and headless so Match Preview, the tests and any other kickoff
// entry point read the same verdict.
import { MATCH_SQUAD_MAX_PLAYERS, type MatchPlan } from "./types";

export type MatchdaySquadFinding = { readonly code: string; readonly text: string };

export type MatchdaySquadAssessment = {
  readonly blocking: readonly MatchdaySquadFinding[];
  readonly warnings: readonly MatchdaySquadFinding[];
  readonly registered: number;
  readonly benchOutfield: number;
  readonly benchGoalkeepers: number;
};

export type SquadCheckPlayer = {
  readonly id: string;
  readonly name: string;
  readonly isGoalkeeper: boolean;
  /** 0-100 current energy. */
  readonly energy?: number;
  /** 0-100 match fitness (HM-PLAYTEST-01 3.2), when tracked. */
  readonly matchFitness?: number;
};

/** Fewer outfield substitutes than this is legal but leaves no rotation for a suspension or an injury. */
export const THIN_BENCH_OUTFIELD = 3;
export const LOW_ENERGY_STARTER = 60;
export const LOW_MATCH_FITNESS_STARTER = 45;

export function assessMatchdaySquad(plan: MatchPlan | undefined | null, available: readonly SquadCheckPlayer[]): MatchdaySquadAssessment {
  const blocking: MatchdaySquadFinding[] = [];
  const warnings: MatchdaySquadFinding[] = [];
  if (!plan || plan.squad.players.length === 0) {
    return { blocking: [{ code: "EMPTY", text: "Ingen matchtrupp är uttagen. Välj målvakt och sex utespelare i Taktik." }], warnings, registered: 0, benchOutfield: 0, benchGoalkeepers: 0 };
  }
  const byId = new Map(available.map((p) => [p.id, p]));
  const registered = plan.squad.players.map((p) => p.playerId);
  if (registered.length > MATCH_SQUAD_MAX_PLAYERS) blocking.push({ code: "TOO_MANY", text: `Högst ${MATCH_SQUAD_MAX_PLAYERS} spelare får registreras i matchprotokollet (${registered.length} uttagna).` });
  const missing = registered.filter((id) => !byId.has(id));
  if (missing.length) blocking.push({ code: "UNAVAILABLE", text: `${missing.length} uttagen spelare är inte tillgänglig (skada, avstängning eller annat). Ta bort spelaren ur matchtruppen.` });

  const starters = plan.attackStartingUnit.formation === "NORMAL" ? plan.attackStartingUnit.slots.map((s) => s.playerId).filter(Boolean) : [];
  const startingKeeper = plan.attackStartingUnit.slots.find((s) => s.position === "GK")?.playerId;
  if (!startingKeeper) blocking.push({ code: "NO_GOALKEEPER", text: "Ingen målvakt startar. Laget måste ha en målvakt på planen vid avkast." });
  if (starters.length < 7) blocking.push({ code: "INCOMPLETE_SEVEN", text: `Startsjuan är inte komplett (${starters.length} av 7).` });

  const startingSet = new Set(starters);
  const bench = registered.filter((id) => !startingSet.has(id) && byId.has(id)).map((id) => byId.get(id)!);
  const benchGoalkeepers = bench.filter((p) => p.isGoalkeeper).length;
  const benchOutfield = bench.length - benchGoalkeepers;

  if (bench.length === 0) {
    warnings.push({ code: "NO_SUBSTITUTES", text: "Du har inga avbytare uttagna. Vid en utvisning spelar laget i undertal utan möjlighet att byta, och vid en skada står laget utan ersättare." });
  } else if (benchOutfield < THIN_BENCH_OUTFIELD) {
    warnings.push({ code: "THIN_BENCH", text: `Endast ${benchOutfield} utespelare på bänken. Laget kan inte rotera eller ersätta skadade spelare fullt ut.` });
  }
  if (benchGoalkeepers === 0 && bench.length > 0) warnings.push({ code: "NO_RESERVE_GOALKEEPER", text: "Ingen reservmålvakt är uttagen. Skadas målvakten måste en utespelare ta över." });
  if (registered.length < MATCH_SQUAD_MAX_PLAYERS && bench.length > 0 && registered.length < 12) warnings.push({ code: "SHORT_SQUAD", text: `Matchtruppen har ${registered.length} av ${MATCH_SQUAD_MAX_PLAYERS} möjliga platser fyllda.` });

  const tired = starters.map((id) => byId.get(id)).filter((p): p is SquadCheckPlayer => !!p && p.energy !== undefined && p.energy < LOW_ENERGY_STARTER);
  if (tired.length) warnings.push({ code: "LOW_ENERGY", text: `Låg energi i startsjuan: ${tired.map((p) => `${p.name} (${Math.round(p.energy!)}%)`).join(", ")}.` });
  const rusty = starters.map((id) => byId.get(id)).filter((p): p is SquadCheckPlayer => !!p && p.matchFitness !== undefined && p.matchFitness < LOW_MATCH_FITNESS_STARTER);
  if (rusty.length) warnings.push({ code: "LOW_MATCH_FITNESS", text: `Låg matchträning i startsjuan: ${rusty.map((p) => `${p.name} (${Math.round(p.matchFitness!)}%)`).join(", ")}.` });

  return { blocking, warnings, registered: registered.length, benchOutfield, benchGoalkeepers };
}
