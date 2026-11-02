// HM-ALPHA3-M10: the CPU's squad-size planning figures, in one place. Recruitment
// (cpuCandidateEvaluation, cpuRecruitment) already used them; contract decisions
// now plan against the same numbers, so a club that recruits up to a squad size
// also stops renewing surplus players beyond it.

/** A club plans for about this many senior players: buying beyond it is penalised, renewing surplus beyond it stops. */
export const SQUAD_PLANNING_SIZE = 20;

/** A squad this size is large: no new non-urgent recruitment at all (the audit script's own outlier flag). */
export const SQUAD_SIZE_LARGE_THRESHOLD = 24;
