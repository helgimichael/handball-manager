import type { MatchRosterPlayer } from "@handball-manager/game-simulation";
import type { HandballPosition, PlayerMock } from "../game-data";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { MATCH_SQUAD_MAX_PLAYERS } from "../matchPlan/types";
import { isSelectableForMatch, type PlayerCareerStatus } from "./playerStatus";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { GOALKEEPER_ATTRIBUTES, type GoalkeeperAttribute, type OutcourtAttribute, type OutcourtPositionId } from "../rating/types";

/**
 * HM-MATCH-1.1 Part 9: the guaranteed-legal exposure map for a side
 * whose real MatchPlan/MatchUsageTrace could not be resolved (e.g. the
 * AI opponent's squad snapshot has no valid goalkeeper or fewer than 6
 * outcourt players in `buildDefaultMatchPlan`'s greedy pick). Root
 * cause of the observed ">16 participants" bug: `buildMatchRoster`
 * previously fell back to its UNFILTERED branch (every squadStatus-
 * eligible player from the club's full raw squad, no cap at all)
 * whenever the caller had no exposure map to pass. This derives a real,
 * <=16-player map from the SAME deterministic initial-squad selection
 * the Tactics workspace itself uses for a fixture with no saved plan
 * yet -- never a second selection algorithm -- so a caller with no
 * resolved MatchPlan still gets a legally-capped, exposure-gated
 * roster instead of the entire club.
 */
export function buildFallbackAttackExposure(squad: readonly PlayerMock[], fixtureId: string, clubId: string): ReadonlyMap<string, number> {
  const initial = buildInitialMatchSquad(squad, fixtureId, clubId);
  const map = new Map<string, number>();
  for (const p of initial.players) {
    if (p.position !== "GK") map.set(p.playerId, 1);
  }
  return map;
}

/**
 * Builds the matchday roster the Fast Match Engine distributes goals
 * across for one club's squad (HM-DATA-0.2: any club's snapshotted
 * squad, not just IFK Tumba's). Scope decision for HM-GAME-0.2A
 * (documented here, not silently assumed): every non-unavailable senior player
 * (squadStatus "Förstaval" or "Rotation") is included every match --
 * there is no bench-rotation/selection model yet, so every eligible
 * player registers an appearance each fixture. "Ungdom" prospects are
 * excluded from the regular matchday squad by default (a future pass
 * can introduce occasional youth involvement); "Skadad"/"Avstängd"
 * players are always excluded.
 */
// ---------------------------------------------------------------------------
// HM-PLAYER-CALIBRATION-1.0 Part C: scorer-attribution weight, root-fixed
// to read canonical GameplayPlayerRating (CA + a position-appropriate
// attribute family) instead of the stale, flat `PlayerMock.currentAbility`
// gameWorldAdapter.ts hardcodes to 100 for every real-world player (see
// that file's own PROVISIONAL_ABILITY doc). Reuses the SAME blended-value
// pattern lib/career/playerMatchStrength.ts's playerAttackValue already
// establishes for team-strength (CA + attribute-family average, equally
// weighted, both rescaled onto 0-100) -- not a parallel quality model,
// just a different, position-specific attribute family suited to
// per-player SHOT CREDIT rather than team-level attack strength: a wing
// finishes differently than a pivot, and a playmaker (M9) sets up more
// than they shoot, in real handball.
// ---------------------------------------------------------------------------

const SCORING_ATTRIBUTES_BY_POSITION: Record<OutcourtPositionId, readonly OutcourtAttribute[]> = {
  V6: ["WING_FINISHING", "SHOOTING_PLACEMENT", "BREAKTHROUGH", "FINISHING"],
  H6: ["WING_FINISHING", "SHOOTING_PLACEMENT", "BREAKTHROUGH", "FINISHING"],
  V9: ["SHOOTING_POWER", "SHOOTING_VARIETY", "BREAKTHROUGH", "FINISHING"],
  H9: ["SHOOTING_POWER", "SHOOTING_VARIETY", "BREAKTHROUGH", "FINISHING"],
  M9: ["PLAYMAKING", "DECISION_MAKING", "SHOOTING_VARIETY", "BREAKTHROUGH"],
  M6: ["PIVOT_PLAY", "FINISHING", "SCREENING"],
};

/**
 * How large a share of a team's shot volume a position typically carries
 * in real handball -- the same coarse idea the old flat 0.75 M6/M9
 * dampener already captured, now graded per position instead of one
 * dampener applied to both a playmaker AND a pivot (very different
 * offensive roles). Never a claim of a final tactical model.
 */
const OFFENSIVE_INVOLVEMENT_BY_POSITION: Record<OutcourtPositionId, number> = {
  V6: 1.1,
  H6: 1.1,
  V9: 1.0,
  H9: 1.0,
  M6: 0.95,
  M9: 0.7,
};

/** HM-PLAYER-CALIBRATION-1.0: small, bounded PlayerTag nudges -- the first real gameplay consumer of lib/game-data/playerTags.ts's vocabulary (previously read only by the editor/data layer). Deliberately NOT a new attribution system: a plain multiplier on the same scoring weight below, for the two tags with an honest, direct link to "how often does this player get a scoring chance". */
const ATTACK_SPECIALIST_MULTIPLIER = 1.15;
const SEVEN_METER_TAKER_MULTIPLIER = 1.1;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function averageAttribute(attrs: readonly string[], record: Record<string, { value: number }>): number {
  let sum = 0;
  let count = 0;
  for (const attr of attrs) {
    const entry = record[attr];
    if (entry) {
      sum += entry.value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 10.5; // 10.5 = midpoint of the 1-20 attribute scale
}

/** Blends CA (1-200) with a 1-20 attribute-family average, equally weighted, both rescaled onto a shared 0-100 value space -- mirrors playerMatchStrength.ts's own blendedValue verbatim (kept as a small local copy rather than an import, since that function is module-private there and this is a different module's concern: per-player shot credit, not team strength). */
function blendedValue(ca: number, attrAvg1to20: number): number {
  const caScaled = clamp((ca / 200) * 100, 0, 100);
  const attrScaled = clamp((attrAvg1to20 / 20) * 100, 0, 100);
  return caScaled * 0.5 + attrScaled * 0.5;
}

function isOutcourtPosition(position: HandballPosition): position is OutcourtPositionId {
  return position !== "MV";
}

function scoringWeightFor(player: PlayerMock, rating: GameplayPlayerRating | undefined): number {
  if (!isOutcourtPosition(player.position)) return 0; // goalkeepers never score in handball
  const involvement = OFFENSIVE_INVOLVEMENT_BY_POSITION[player.position];

  let quality: number;
  if (rating && rating.branch.branch === "OUTCOURT") {
    quality = blendedValue(rating.ca, averageAttribute(SCORING_ATTRIBUTES_BY_POSITION[player.position], rating.branch.attributes));
  } else {
    // No canonical rating resolved for this player (e.g. the static
    // fiction squads that predate real-world import, or a club with no
    // gameplayRatings snapshot yet) -- fall back to the mock's own
    // currentAbility, exactly as before this fix, so those squads are
    // unaffected.
    quality = player.currentAbility;
  }

  let weight = (quality / 10) * involvement;
  const tags = player.specialTags ?? [];
  if (tags.includes("ATTACK_SPECIALIST")) weight *= ATTACK_SPECIALIST_MULTIPLIER;
  if (tags.includes("SEVEN_METER_TAKER")) weight *= SEVEN_METER_TAKER_MULTIPLIER;
  return Math.max(0.1, weight);
}

/**
 * HM-PLAYER-CALIBRATION-1.0 Part C: the starting goalkeeper's post-match
 * `rating` (in packages/game-simulation's buildPlayerContributions) is
 * currently derived ONLY from that match's own save percentage -- no
 * skill input at all, so a genuinely elite keeper and a weak one having
 * an identical match get an identical rating. `goalkeeperQuality`
 * (0-100, the same blended-value pattern as scoringWeightFor above, over
 * the canonical GOALKEEPER_ATTRIBUTES family) gives buildPlayerContributions
 * a small, bounded skill nudge on TOP of that save-percentage-driven
 * rating -- it does NOT touch the underlying save-count/shots-faced
 * simulation itself (that stays governed by ClubStrength.goalkeeper +
 * playerMatchStrength.ts's own goalkeeper value channel, both untouched
 * here); this is attribution/rating only.
 */
function goalkeeperQualityFor(rating: GameplayPlayerRating | undefined): number | undefined {
  if (!rating || rating.branch.branch !== "GOALKEEPER") return undefined;
  const attrs: readonly GoalkeeperAttribute[] = GOALKEEPER_ATTRIBUTES;
  return blendedValue(rating.ca, averageAttribute(attrs, rating.branch.attributes));
}

/**
 * `playerStatuses` (HM-GAME-0.3): when provided, the per-save live
 * availability slice overrides the static mock's `squadStatus` for
 * eligibility -- so a Career Rhythm recovery (Skadad -> AVAILABLE)
 * actually puts a player back in the matchday roster, and not merely in
 * a cosmetic status label. Omitted for callers that predate Career
 * Rhythm (falls back to the original squadStatus-only behaviour).
 *
 * `attackExposureById` (HM-MATCH-1.0 Part P): when supplied (the
 * manager's own MatchPlan/MatchUsage trace is known -- see
 * matchdayAction.ts), a player who isn't in the MatchPlan's MatchSquad
 * at all (no entry in EITHER exposure map -- squadStatus eligibility
 * alone would otherwise still have included them, since these maps are
 * a strict narrowing, never a widening, of that eligibility) is
 * excluded from the roster, so they are structurally unreachable by
 * `distributeGoalsToRoster` in matchEngine.ts -- preventing a live QA
 * finding ("a player not even selected into the 16-man MatchSquad still
 * appeared as a scorer") Part P calls out. `scoringWeight` is scaled by
 * `attackExposureById` alone, so a player with ZERO intended attacking
 * exposure (EMERGENCY_ONLY, or a HM-MATCH-USAGE-1.4 DEFENCE_ONLY player)
 * is structurally unreachable as a SCORER specifically (Part P's
 * "EMERGENCY_ONLY becomes top scorer" case), never merely deprioritized
 * -- while a heavily-used player gets proportionally more scoring
 * opportunity. `defenceExposureById` (HM-MATCH-USAGE-1.4 Part 21/24 #9):
 * roster INCLUSION itself is the union of attack and defence exposure --
 * a legitimate DEFENCE_ONLY player still participated in the match (and
 * needs a contribution/stats entry) even though they structurally can
 * never be drawn as a scorer; only a player with ZERO exposure in BOTH
 * phases (e.g. EMERGENCY_ONLY, or absent from the plan) is excluded
 * from the roster entirely. Omitting both maps is byte-identical to
 * before HM-MATCH-1.0.
 *
 * `ratingsById` (HM-PLAYER-CALIBRATION-1.0 Part C): the club's canonical
 * GameplayPlayerRating[] snapshot (CareerState.gameplayRatings[clubId]),
 * keyed by playerId -- every existing call site already has this value
 * in scope (matchdayAction.ts/calendar.ts/season-audit.ts's detailed
 * mode all read state.gameplayRatings right where buildMatchRoster is
 * called). Powers scoringWeightFor/goalkeeperQualityFor above. Omitting
 * it falls back to the old currentAbility-based weight for every
 * player -- byte-identical to before this fix, so any caller that
 * genuinely has no ratings (a static fiction squad) is unaffected.
 */
export function buildMatchRoster(
  squad: readonly PlayerMock[],
  playerStatuses?: Record<string, PlayerCareerStatus>,
  attackExposureById?: ReadonlyMap<string, number>,
  attackActiveWindowsById?: ReadonlyMap<string, readonly boolean[]>,
  defenceExposureById?: ReadonlyMap<string, number>,
  ratingsById?: ReadonlyMap<string, GameplayPlayerRating>,
): MatchRosterPlayer[] {
  const eligible = squad.filter((p) => {
    const baseEligible = p.squadStatus === "Förstaval" || p.squadStatus === "Rotation";
    if (!playerStatuses || !playerStatuses[p.id]) {
      return baseEligible;
    }
    if (!isSelectableForMatch(playerStatuses, p.id)) {
      // HM-INJURIES-1.0 Part 15/16: a live INJURED/SUSPENDED/RECOVERING
      // status always excludes, regardless of the static mock -- but a
      // LIMITED (return-to-play) player IS still selectable (Part 17).
      return false;
    }
    // Live AVAILABLE: recovers a stale Skadad/Avstängd mock status, but never grants eligibility to Ungdom.
    return baseEligible || p.squadStatus === "Skadad" || p.squadStatus === "Avstängd";
  });
  const outfieldEligible = eligible.filter((p) => p.position !== "MV");
  let outfield = attackExposureById ? outfieldEligible.filter((p) => (attackExposureById.get(p.id) ?? 0) > 0 || (defenceExposureById?.get(p.id) ?? 0) > 0) : outfieldEligible;

  // HM-MATCH-1.1 Part 9: a hard, unconditional cap -- belt-and-suspenders
  // alongside `buildFallbackAttackExposure` above. Even a caller that
  // omits `attackExposureById` entirely (the legacy "no MatchPlan"
  // fallback other pre-existing call sites still use) can never produce
  // a roster of more than MATCH_SQUAD_MAX_PLAYERS participants -- the
  // invariant every match report/analysis view depends on. Preference
  // order (Förstaval before Rotation, existing squad order within each)
  // keeps the cap's choice deterministic and biased toward the players
  // who would actually be selected first.
  const maxOutfield = MATCH_SQUAD_MAX_PLAYERS - 1; // one slot reserved for the goalkeeper
  if (outfield.length > maxOutfield) {
    outfield = [...outfield].sort((a, b) => (a.squadStatus === b.squadStatus ? 0 : a.squadStatus === "Förstaval" ? -1 : 1)).slice(0, maxOutfield);
  }

  // Exactly ONE goalkeeper plays per match -- the Fast Match Engine
  // attributes the team's full saves/shotsFaced tally to every roster
  // entry marked isGoalkeeper, so including more than one here would
  // double-count goalkeeper stats. Prefer the Förstaval keeper; fall
  // back to the next eligible one if unavailable.
  const goalkeepers = eligible.filter((p) => p.position === "MV");
  const startingGoalkeeper = goalkeepers.find((p) => p.squadStatus === "Förstaval") ?? goalkeepers[0];

  const outfieldRoster: MatchRosterPlayer[] = outfield.map((p) => ({
    playerId: p.id,
    isGoalkeeper: false,
    scoringWeight: scoringWeightFor(p, ratingsById?.get(p.id)) * (attackExposureById ? Math.max(0, Math.min(1, attackExposureById.get(p.id) ?? 1)) : 1),
    started: p.squadStatus === "Förstaval",
    activeWindows: attackActiveWindowsById?.get(p.id),
  }));

  if (!startingGoalkeeper) {
    return outfieldRoster;
  }

  return [
    {
      playerId: startingGoalkeeper.id,
      isGoalkeeper: true,
      scoringWeight: 0,
      started: true,
      goalkeeperQuality: goalkeeperQualityFor(ratingsById?.get(startingGoalkeeper.id)),
    },
    ...outfieldRoster,
  ];
}
