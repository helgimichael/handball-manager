// HM-ALPHA2-03B: one defence-formation format at the plan/engine boundary.
// MatchPlan stores the dash form ("6-0", "5-1", like every default and
// editor); the engine uses the colon form ("6:0" / "5:1"). Older saves may
// hold the colon form written by the tactics page, so both are accepted.

/** Canonical stored form: "6:0" -> "6-0", "5-1" stays "5-1". */
export function normalizeBaseFormation(value: string): string {
  return value.trim().replace(":", "-");
}

/** Formations a played (v2) match supports. */
export const PLAYABLE_BASE_FORMATIONS = ["6-0", "5-1"] as const;

export function isPlayableBaseFormation(value: string): boolean {
  return (PLAYABLE_BASE_FORMATIONS as readonly string[]).includes(normalizeBaseFormation(value));
}

/** The engine's defence system for a stored formation (anything else plays 6:0, as before). */
export function engineDefenceSystem(value: string | undefined): "6:0" | "5:1" {
  return value !== undefined && normalizeBaseFormation(value) === "5-1" ? "5:1" : "6:0";
}
