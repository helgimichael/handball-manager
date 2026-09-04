// HM-YOUTH-INTAKE-1.0: annual world-lifecycle youth generation -- the
// answer to the world-stability audit's own finding that average age
// rises without bound and under-21 count trends to zero, because nothing
// ever adds new players to the world. This is a WORLD RULE, not a
// transfer, free-agent signing, generated scout result, or clone of a
// real player (Part 1) -- every generated player is a genuinely new
// canonical entity, integrated through the SAME worldSquads/
// gameplayRatings/playerContracts/playerSquadStatus/playerStatuses maps
// every other player already lives in. No parallel youth database.
//
// REUSE, not a second generation engine (Part 1/9/10/12/14):
//   - identity/CA/PA/attribute SHAPE:    lib/rating/generation/generationEngine.ts's
//                                        generatePlayerRatingProfile (same
//                                        pipeline careerFallbackRating.ts
//                                        already uses for every mock/
//                                        generated player) -- only the CA/PA
//                                        NUMBERS themselves are youth-specific
//                                        (see below on why).
//   - CA baseline mechanism:             lib/rating/gamePrior/populationModel.ts's
//                                        own generateGamePriorCA, via its
//                                        existing profileOverride escape
//                                        hatch -- three youth-specific
//                                        PopulationBaselineProfile objects
//                                        (HBL/Allsvenskan/Division1),
//                                        deliberately lower than every
//                                        adult senior baseline (Part 9:
//                                        "Youth CA måste ligga tydligt
//                                        under etablerade seniorer").
//   - contract:                          lib/economy/contractGeneration.ts's
//                                        generateInitialContract, unmodified.
//   - club-quality influence:            lib/career/squadDerivedClubStrength.ts's
//                                        own ClubStrength.overall as a
//                                        SMALL, modest shift (Part 11:
//                                        documented as a temporary proxy
//                                        pending a real Youth Academy
//                                        milestone) into the SAME
//                                        `clubShift` parameter
//                                        generateGamePriorCA already accepts.
//
// NOT reused: generateGamePriorPA's own bonus shape is a bounded, roughly
// UNIFORM offset -- the wrong shape for Part 10's own explicit "long-tail,
// many limited/moderate, some good, few high, very few wonderkid, no
// uniform random PA" requirement. Youth PA below is a purpose-built
// long-tail band model instead, still built on the SAME seededOffset
// deterministic primitive every other generator in this codebase uses,
// still hard-bounded within the same global CA_MIN/CA_MAX/PA_MIN/PA_MAX
// scale (never a separate scale).
import { getClub, getCompetition, type HandballPosition, type NationCode, type PlayerMock, type PlayerMockAttributes } from "../game-data";
import { mapHandballPositionToMatchPlanPosition } from "../matchPlan/careerSquadBridge";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { generateGamePriorCA, type PopulationBaselineProfile } from "../rating/gamePrior/populationModel";
import { GAME_PRIOR_MODEL_VERSION } from "../rating/gamePrior/types";
import { assignArchetypeForPosition } from "../rating/gamePrior/archetypeAssignment";
import { generatePlayerRatingProfile } from "../rating/generation/generationEngine";
import { GENERATION_MODEL_VERSION } from "../rating/generation/types";
import { unassessedAbilityRating } from "../rating/validators";
import { CA_MAX, CA_MIN, PA_MAX, PA_MIN, type AttackRole, type PlayerRatingClaim, type PlayerRatingProfile } from "../rating/types";
import { generateInitialContract } from "../economy/contractGeneration";
import type { EconomyProfileInputs } from "../economy/marketValue";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { DIVISION_1_COMPETITION_IDS } from "./division1Integration";
import { careerWorldClubIds } from "./worldCompetitions";
import { resolveAcademyQuality, academyPotentialGamma } from "./academyQuality";
import { buildYouthIntakeCompleteEvent, type CareerEvent } from "./careerEvents";
import { generateYouthName } from "./youthNames";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { RatingValueSource } from "../editor/ratingDatabaseRepository";
import type { PlayerContract } from "../economy/types";
import type { CareerState } from "./types";

/** Part 2: 1 July -- deliberately after the 31 May contract-expiry wave and the initial June transfer scramble have already settled the roster for the new season, while still inside the summer transfer window (June-Sept) so a generated player is never structurally locked out of it. One calendar check, `date.slice(5,10)`, the same pattern contractExpiry.ts's own 31 May check and this codebase's own season-boundary audits already use. */
export const YOUTH_INTAKE_DATE_MMDD = "07-01";

const YOUTH_MODEL_VERSION = "HM-YOUTH-INTAKE-1.0-v1";

/**
 * HM-WORLD-POPULATION-CALIBRATION-1.0: probabilistic small intake,
 * replacing the original uniform 2-5 (mean 3.5). Evidence (5x20-season
 * baseline + a 4-way intake-size comparison + a retirement-sensitivity
 * control, all full-daily-tick simulations against this exact 14-club
 * Handbollsligan world): with the original 2-5 range, population grew
 * +132% over the first 10 seasons and a further +64% over the next 10 --
 * far past the world-health calibration target. A retirement-only
 * countermeasure (doubling the free-agent-duration retirement multiplier)
 * was tested FIRST and rejected: it barely moved total population
 * (+0.5%) because departing free agents are immediately backfilled by
 * contract-expiry churn from the much larger attached population --
 * retirement rate was conclusively NOT the bottleneck. Intake size IS:
 * cutting it measurably slowed growth in every model tested. A uniform
 * 1-2 range was also tested and rejected -- it cut growth the most but
 * repeatedly starved several clubs down to single-digit squads for many
 * consecutive seasons (a real world-health failure, not just a smaller
 * number). This probabilistic model (mostly 1, sometimes 2, rarely 3;
 * mean 1.65) cuts the same ~53% off the mean while keeping the
 * occasional larger cohort that a hard 1-2 cap lacks -- squad depth
 * degrades gracefully instead of persistently collapsing (minimum squad
 * size observed staying at least 1-8 throughout a 20-season run, vs. 1-2
 * for many consecutive seasons under the uniform 1-2 model). Population
 * growth is not fully flattened by year 20 (a demographic transient --
 * see this milestone's own final report on why -- not a defect in this
 * distribution), but growth is meaningfully slower than the original
 * range in every run tested, without the squad-health cost of a harder
 * cut. Position generation, CA/PA shape, club-quality shift, contracts,
 * and retirement itself are all deliberately UNCHANGED -- this is the
 * smallest evidence-justified lever, per this milestone's own explicit
 * "prefer smallest production change" instruction.
 */
function intakeSizeForClub(saveSeed: string, clubId: string, intakeYear: number): number {
  const roll = seededIndex(`${saveSeed}:${clubId}:${intakeYear}:youth-intake-size`, 100);
  if (roll < 45) return 1;
  if (roll < 90) return 2;
  return 3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 0..n-1, deterministic from `seedKey`. */
function seededIndex(seedKey: string, n: number): number {
  return Math.abs(seededOffset(seedKey, n)) % n;
}

// ---------------------------------------------------------------------------
// Part 3: eligible clubs.
// ---------------------------------------------------------------------------

/**
 * HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0 Part 17/37: deliberately
 * scoped to ONLY the manager's own live competition (whichever of
 * Handbollsligan/Allsvenskan `state.competitionId` is) -- intentionally
 * NARROWER than the career world's full CPU-recruiter/lifecycle scope
 * (see worldCompetitions.ts's own `careerWorldClubIds`, used by CPU
 * recruitment and player lifecycle instead). World Pool clubs are
 * deliberately excluded (their own squad depth isn't populated the same
 * way -- a genuine extension seam for a later milestone).
 *
 * HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.1 -- SCOPE CORRECTED. The paragraph
 * above describes the PREVIOUS behaviour, kept for provenance: intake was
 * deliberately narrowed to the manager's own competition to restore a
 * volume calibrated against a 14-club assumption, and left as an explicit
 * "seam for a future Youth Intake 1.1 to revisit with real population
 * evidence for the full world". This is that revisit, and the evidence is
 * measured:
 *
 * With intake scoped to one competition, a 5-season world benchmark showed
 * Handbollsligan receiving 22-24 entrants a year while Herrallsvenskan and
 * both Division 1 groups received EXACTLY ZERO. Those three tiers therefore
 * only aged and developed -- Herrallsvenskan's mean squad age climbed from
 * 23.9 to 27.7 in five seasons with no replacement cohort at all -- while
 * Handbollsligan alone absorbed low-CA youth that diluted its mean. That is
 * not a development effect; it made league-quality calibration meaningless,
 * because the one league being replenished looked worst.
 *
 * Youth intake is a WORLD RULE, exactly like retirement, decline and CPU
 * recruitment, and now uses the same canonical membership source they do
 * (`careerWorldClubIds`). Nothing about generation changes: intake size is
 * still per club (mean 1.65), tier profiles were ALREADY per club via
 * youthTierForClub, and every generated player was already derived from its
 * own club's competition -- so a Division 1 intake has always carried
 * Division 1 context, never the manager's. Only eligibility was narrow.
 *
 * Volume follows from the existing per-club rule rather than a new world
 * quota: ~52 eligible clubs x 1.65 = ~86 entrants/year, against the 56-75
 * annual retirements Phase 1A measured late in a 20-season run.
 *
 * World Pool clubs remain excluded -- they are not in careerWorldClubIds,
 * and their squad depth is not populated the same way.
 *
 * Deliberately checks key PRESENCE, not current length: a club whose
 * squad has legitimately collapsed to zero players (e.g. an unattended
 * human club losing everyone on the same 31 May contract-expiry wave)
 * must still remain eligible -- youth intake existing specifically to
 * replenish a thinning world, it must never itself become permanently
 * unreachable for the exact clubs that need it most.
 */
export function eligibleYouthIntakeClubIds(state: CareerState): string[] {
  return careerWorldClubIds(state);
}

// ---------------------------------------------------------------------------
// Part 9: CA generation -- three youth-specific baselines, clearly below
// every adult senior baseline, with genuine overlap between tiers (never
// a rigid league ladder).
// ---------------------------------------------------------------------------

type YouthTier = "HANDBOLLSLIGAN" | "ALLSVENSKAN" | "DIVISION1";

const YOUTH_CA_PROFILES: Record<YouthTier, PopulationBaselineProfile> = {
  HANDBOLLSLIGAN: { baselineCA: 85, caSpread: 18, caCeiling: 118, caFloor: 60, paMaxBonus: 0 },
  ALLSVENSKAN: { baselineCA: 78, caSpread: 18, caCeiling: 110, caFloor: 55, paMaxBonus: 0 },
  DIVISION1: { baselineCA: 68, caSpread: 20, caCeiling: 102, caFloor: 45, paMaxBonus: 0 },
};

function youthTierForClub(clubId: string): YouthTier {
  if ((DIVISION_1_COMPETITION_IDS as readonly string[]).includes(getClub(clubId)?.competitionId ?? "")) return "DIVISION1";
  return getCompetition(getClub(clubId)?.competitionId ?? "")?.tier === 1 ? "HANDBOLLSLIGAN" : "ALLSVENSKAN";
}

/**
 * Part 11: a SMALL, bounded nudge from the club's own current senior
 * squad quality (ClubStrength.overall, 0-100, neutral 50) into
 * generateGamePriorCA's existing `clubShift` parameter -- never a
 * guarantee ("Sävehof ska inte automatiskt få bästa spelaren varje år").
 * Documented as a TEMPORARY proxy: there is no youth-academy-quality
 * architecture yet (Part 11's own explicit instruction not to build one
 * in this milestone) -- a future Academy milestone should replace this
 * with a real academy-quality signal.
 */
function clubQualityShift(state: CareerState, clubId: string): number {
  const squad = state.worldSquads[clubId] ?? [];
  const ratings = state.gameplayRatings[clubId] ?? [];
  const strength = computeSquadDerivedClubStrength(clubId, squad, ratings);
  return Math.round(clamp((strength.overall - 50) * 0.24, -8, 8));
}

function generateYouthCA(playerId: string, clubShift: number, tier: YouthTier): number {
  return generateGamePriorCA(playerId, clubShift, YOUTH_MODEL_VERSION, "STANDARD", YOUTH_CA_PROFILES[tier]);
}

// ---------------------------------------------------------------------------
// HM-YOUTH-INTAKE-1.1A: PA is an INDEPENDENT talent draw, not a function of
// current ability.
//
// THE DEFECT THIS REPLACES. The previous model computed
//   PA = min(ceiling, ca + headroom)      headroom <= 45, top 3% band only
// so potential was a bounded shadow of what a 17-year-old could already do.
// Measured over 3377 generated players across 40 intake seasons, that produced
// world-wide rates of PA>=130 at 0.3/season, PA>=140 at 0.03/season (one player
// in the entire sample) and PA>=150 at EXACTLY ZERO -- against a replacement
// requirement of roughly tens, mid-teens and a few per season respectively. It
// also made the most interesting prospect in the sport impossible to express:
// with CA 75 the old model could not exceed PA 120, so a raw elite talent who
// is years away from ready simply could not be generated.
//
// The draw below is independent of CA, of the club, and of the competition
// tier. Tier deliberately has NO influence on potential in this phase: the old
// tier signal reached PA only through CA, and reintroducing it here would make
// Division 1 structurally incapable of producing an exceptional talent. Club-
// level variation is the job of Academy Quality (Youth Intake 1.1c), which will
// shift these odds per club without ever making a tier a ceiling.
//
// STATISTICAL INDEPENDENCE IS THE POINT, NOT AN OVERSIGHT. The resulting
// CA<->PA Pearson correlation is ~0.02, down from ~0.90 under the old model,
// and that is deliberate for this phase. Phase 1.1a has exactly one
// responsibility: remove the structural dependency of potential on current
// ability. Feeding CA (or a tier-relative CA percentile) back in as a PA input
// would partially recouple them before a proper maturity / development-stage
// model exists, and -- because CA is tier-scaled -- would quietly reintroduce
// competition tier as a soft ceiling on potential, which is precisely what a
// Division 1 club must not have. A modest correlation is expected to EMERGE in
// later phases through maturity, player profile, academy context and
// development stage. It must not be imposed here by a direct CA -> PA rule.
//
// SHAPE. A five-band mixture over PA itself, each band drawing uniformly within
// its own range. Bands are the cleanest deterministic way to build a long tail
// from the existing seeded-integer primitive: the mass sits in the ordinary
// range, and each better band is both rarer and narrower, so exceptional
// potential is rare BY CONSTRUCTION rather than by luck -- the same guarantee
// the previous model's own doc claimed, now applied to a range that can
// actually reach the top of the scale. No categorical label is stored on the
// player; the band exists only inside this function.
// ---------------------------------------------------------------------------

const YOUTH_PA_CEILING = 165;

/**
 * Percentile bands over POTENTIAL. `upToPercentile` is exclusive; `minPA`/
 * `maxPA` are inclusive bounds of a uniform draw within the band.
 *
 * Calibrated against the measured elite-replacement requirement for a 52-club
 * Swedish world taking ~87 players a year -- see this milestone's report for
 * the derivation and the realised rates.
 */
const YOUTH_PA_BANDS: readonly { upToPercentile: number; minPA: number; maxPA: number }[] = [
  { upToPercentile: 46, minPA: 85, maxPA: 115 },    // 46%: ordinary -- lower-tier senior at best
  { upToPercentile: 76, minPA: 115, maxPA: 135 },   // 30%: useful professional
  { upToPercentile: 93.8, minPA: 135, maxPA: 150 }, // 17.8%: strong prospect
  { upToPercentile: 98.8, minPA: 150, maxPA: 160 }, // 5%: national-level talent
  { upToPercentile: 100, minPA: 160, maxPA: 165 },  // 1.2%: rare wonderkid
];

/** Percentile in [0,100) with one decimal of resolution, so fractional band edges are honoured. */
function seededPercentile(seedKey: string): number {
  return seededIndex(seedKey, 1000) / 10;
}

/**
 * Independent potential for one generated youth player.
 *
 * `ca` is used for ONE thing only: the PA >= CA invariant. A player whose
 * current ability already exceeds his drawn potential has simply finished
 * developing -- that is a legitimate state the rating model already supports
 * (headroom 0), and it is the smallest coherent handling of the invariant. It
 * is deliberately NOT a headroom floor, which would quietly rebuild the old
 * `CA + offset` coupling for exactly the high-CA players it applied to.
 */
/**
 * Exported for calibration and distribution tests, which must be able to supply
 * SYNTHETIC academy-quality values (20/35/50/65/80) rather than depend on which
 * real clubs happen to be calibrated. Production has exactly one caller,
 * generateYouthPlayer below.
 */
export function generateYouthPA(playerId: string, ca: number, academyQuality: number): number {
  // HM-YOUTH-INTAKE-1.1B: academy quality REWEIGHTS the bands, it never adds
  // potential points. `p' = 100 * (p/100)^gamma` is monotone and continuous, so
  // a better academy shifts mass toward the upper bands without ever closing
  // the lower ones or guaranteeing the upper ones -- the weakest academy keeps
  // a real chance of a wonderkid, the strongest is never promised one. gamma
  // is exactly 1 at neutral, leaving the 1.1a distribution untouched.
  const raw = seededPercentile(`${playerId}:youth-pa-talent:v2`);
  const gamma = academyPotentialGamma(academyQuality);
  const percentile = 100 * Math.pow(raw / 100, gamma);
  const band = YOUTH_PA_BANDS.find((b) => percentile < b.upToPercentile) ?? YOUTH_PA_BANDS[YOUTH_PA_BANDS.length - 1];
  const drawn = band.minPA + seededIndex(`${playerId}:youth-pa-value:v2`, band.maxPA - band.minPA + 1);
  const bounded = Math.min(YOUTH_PA_CEILING, Math.min(PA_MAX, drawn));
  return Math.max(bounded, ca); // PA >= CA, always.
}

// ---------------------------------------------------------------------------
// Part 6: position -- canonical HandballPosition only, world MV-supply
// used as a MILD, WORLD-LEVEL signal (never a per-club deterministic
// "club lacks MV -> youth MV always appears" rule, per Part 6's own
// explicit instruction).
// ---------------------------------------------------------------------------

const BASE_POSITION_WEIGHTS: Record<HandballPosition, number> = { MV: 12, V6: 15, H6: 15, V9: 16, M9: 16, H9: 15, M6: 11 };
/** Below this world-wide MV-to-total ratio, MV's own weight is mildly boosted for this whole intake pass (every eligible club draws from the same adjusted weights -- not a per-club reaction). */
const LOW_MV_SUPPLY_RATIO = 0.12;
const MV_SUPPLY_BOOST_MULTIPLIER = 1.5;

function worldMvSupplyRatio(state: CareerState, clubIds: readonly string[]): number {
  let mv = 0;
  let total = 0;
  for (const clubId of clubIds) {
    const squad = state.worldSquads[clubId] ?? [];
    total += squad.length;
    mv += squad.filter((p) => p.position === "MV").length;
  }
  return total > 0 ? mv / total : BASE_POSITION_WEIGHTS.MV / 100;
}

function positionWeights(mvSupplyRatio: number): Record<HandballPosition, number> {
  if (mvSupplyRatio >= LOW_MV_SUPPLY_RATIO) return BASE_POSITION_WEIGHTS;
  const boostedMv = BASE_POSITION_WEIGHTS.MV * MV_SUPPLY_BOOST_MULTIPLIER;
  const delta = boostedMv - BASE_POSITION_WEIGHTS.MV;
  const othersTotal = 100 - BASE_POSITION_WEIGHTS.MV;
  const scale = (othersTotal - delta) / othersTotal;
  const weights = {} as Record<HandballPosition, number>;
  for (const position of Object.keys(BASE_POSITION_WEIGHTS) as HandballPosition[]) {
    weights[position] = position === "MV" ? boostedMv : BASE_POSITION_WEIGHTS[position] * scale;
  }
  return weights;
}

function pickPosition(seedKey: string, weights: Record<HandballPosition, number>): HandballPosition {
  const positions = Object.keys(weights) as HandballPosition[];
  const total = positions.reduce((sum, p) => sum + weights[p], 0);
  const roll = (seededIndex(`${seedKey}:youth-position`, 10_000) / 10_000) * total;
  let cursor = 0;
  for (const position of positions) {
    cursor += weights[position];
    if (roll < cursor) return position;
  }
  return positions[positions.length - 1];
}

// ---------------------------------------------------------------------------
// Part 5/7: age, birth date, nationality.
// ---------------------------------------------------------------------------

/** Weighted toward 17 (Part 5: "16-18 år med tyngdpunkt runt 17"). */
function generateYouthAge(seedKey: string): number {
  const roll = seededIndex(`${seedKey}:youth-age`, 100);
  if (roll < 25) return 16;
  if (roll < 75) return 17;
  return 18;
}

/** Month/day always in Jan-Jun (1-6/1-28) so the player has always already had their birthday by the 1 July intake date -- birthYear = intakeYear - age holds exactly, never an off-by-one from playerAgeAtDate's own month/day-aware calculation. */
function generateYouthDateOfBirth(seedKey: string, intakeYear: number, age: number): string {
  const birthYear = intakeYear - age;
  const month = 1 + seededIndex(`${seedKey}:youth-dob-month`, 6);
  const day = 1 + seededIndex(`${seedKey}:youth-dob-day`, 28);
  return `${birthYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const YOUTH_OTHER_NORDIC_NATIONS: readonly NationCode[] = ["DEN", "NOR", "ISL"];
/** Part 7: SWE default/very high probability; a small minority of other Nordic backgrounds, no migration/heritage simulation. */
function generateYouthNationality(seedKey: string): NationCode {
  const roll = seededIndex(`${seedKey}:youth-nationality`, 100);
  if (roll < 92) return "SWE";
  return YOUTH_OTHER_NORDIC_NATIONS[seededIndex(`${seedKey}:youth-nationality-other`, YOUTH_OTHER_NORDIC_NATIONS.length)];
}

// ---------------------------------------------------------------------------
// Part 12: canonical attribute-model reuse for the real (GameplayPlayerRating)
// profile; a simple CA-derived approximation for the legacy PlayerMock.attributes
// field (1-20 scale, largely superseded by GameplayPlayerRating post-HM-RATINGS-CAREER-1.0
// -- same flat-approximation precedent every synthetic test fixture elsewhere
// in this codebase already uses for that field).
// ---------------------------------------------------------------------------

function legacyAttributesFromCA(ca: number): PlayerMockAttributes {
  const v = clamp(Math.round(ca / 10), 1, 20);
  return {
    technical: { skott: v, passning: v, spelforstaelse: v, genombrott: v, mottagning: v, fint: v, spelUtanBoll: v },
    mental: { beslutsfattande: v, kyla: v, arbetskapacitet: v, kampvilja: v, positionering: v, lagarbete: v, ledarskap: v },
    physical: { snabbhet: v, acceleration: v, styrka: v, explosivitet: v, uthallighet: v, rorlighet: v },
  };
}

function gamePriorRationaleClaim(playerId: string, archetype: string): PlayerRatingClaim {
  return {
    id: `${playerId}-youth-intake-prior`,
    playerId,
    evidenceClass: "UNASSESSED",
    domain: "GAME_PRIOR",
    key: "rationale",
    value: `Ny ungdomsspelare genererad vid årets intag -- ingen evidens finns ännu. Deterministisk youth-intake CA/arketyp (${archetype}), aldrig ett forskat faktum.`,
    sourceRefs: [],
  };
}

/** Mirrors careerFallbackRating.ts's own generateFallbackGameplayRating internal structure exactly, substituting the youth-specific CA/PA generated above in place of the (wrong-shaped-for-youth) adult game-prior CA/PA. Same underlying generatePlayerRatingProfile/assignArchetypeForPosition/unassessedAbilityRating building blocks -- never a second rating system. */
function generateYouthGameplayRating(playerId: string, position: HandballPosition, ca: number, pa: number): GameplayPlayerRating {
  const ratingPosition = mapHandballPositionToMatchPlanPosition(position);
  let profile: PlayerRatingProfile = {
    playerId,
    position: ratingPosition,
    physicalProfile: {},
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [],
  };

  const archetype = assignArchetypeForPosition(playerId, ratingPosition, GAME_PRIOR_MODEL_VERSION);
  const extraClaims: PlayerRatingClaim[] = [gamePriorRationaleClaim(playerId, archetype)];
  let attackRoleProficiencies = profile.attackRoleProficiencies;
  let claims = [...profile.claims, ...extraClaims];
  if (ratingPosition === "GK") {
    claims = [...claims, { id: `${playerId}-gk-archetype`, playerId, evidenceClass: "UNASSESSED", domain: "ARCHETYPE", key: "gkArchetype", value: archetype, sourceRefs: [] }];
  } else {
    attackRoleProficiencies = [...attackRoleProficiencies, { role: archetype as AttackRole }];
  }
  profile = { ...profile, ca: { value: ca, confidence: "LOW", plausibleRange: { min: Math.max(1, ca - 25), max: Math.min(200, ca + 25) } }, attackRoleProficiencies, claims };
  profile = { ...profile, pa: { value: pa, confidence: "LOW", plausibleRange: { min: Math.max(PA_MIN, pa - 20), max: Math.min(PA_MAX, pa + 20) } } };

  const generation = generatePlayerRatingProfile(profile, GENERATION_MODEL_VERSION);
  const branch = generation.status === "OK" ? generation.profile.branch : { branch: "OUTCOURT" as const, attributes: {} as never };
  const caSource: RatingValueSource = "GENERATED_GAME_PRIOR";

  return {
    playerId,
    position: ratingPosition,
    ca,
    pa,
    caSource,
    branch,
    attackRoleProficiencies,
    defenceRoleProficiencies: profile.defenceRoleProficiencies,
    attributeGenerationModelVersion: GENERATION_MODEL_VERSION,
    locked: false,
  };
}

// ---------------------------------------------------------------------------
// Part 13/14/15: squad status, contract, full player assembly.
// ---------------------------------------------------------------------------

interface GeneratedYouthPlayer {
  player: PlayerMock;
  rating: GameplayPlayerRating;
  contract: PlayerContract;
}

/**
 * `saveSeed` (Part 20: "Different career seed... should produce
 * variation") is folded into every DETERMINISTIC-DRAW seed key below,
 * never into the persisted `playerId` itself -- the id stays the simple,
 * stable `youth-${clubId}-${year}-${index}` form (readable, and the
 * ONLY thing idempotency/ownership actually needs to be stable), while
 * name/position/age/CA/PA/contract-length all vary by career even for
 * the exact same club+year+index, since `clubShift` alone (derived from
 * the club's own REAL, career-seed-independent squad) could not
 * otherwise produce any variation across different careers at all.
 */
function generateYouthPlayer(saveSeed: string, clubId: string, intakeYear: number, index: number, weights: Record<HandballPosition, number>, clubShift: number, tier: YouthTier, academyQuality: number): GeneratedYouthPlayer {
  const playerId = `youth-${clubId}-${intakeYear}-${index}`;
  const seedKey = `${saveSeed}:${playerId}`;
  const name = generateYouthName(seedKey);
  const position = pickPosition(seedKey, weights);
  const age = generateYouthAge(seedKey);
  const dateOfBirth = generateYouthDateOfBirth(seedKey, intakeYear, age);
  const nationality = generateYouthNationality(seedKey);
  const ca = generateYouthCA(seedKey, clubShift, tier);
  const pa = generateYouthPA(seedKey, ca, academyQuality);

  const rating = generateYouthGameplayRating(playerId, position, ca, pa);

  // Part 14: modest term (2-4 years), canonical contract creation, no fee, EUR (all inherited from generateInitialContract itself -- never a second youth-contract engine).
  const contractYears = 2 + seededIndex(`${seedKey}:youth-contract-years`, 3);
  const contractEndYear = intakeYear + contractYears;
  const contractEndSeasonHint = `${contractEndYear - 1}/${String(contractEndYear).slice(-2)}`;
  const ratingPosition = mapHandballPositionToMatchPlanPosition(position);
  const competitionTier = getCompetition(getClub(clubId)?.competitionId ?? "")?.tier;
  const economyInputs: EconomyProfileInputs = { ca, pa, age, position: ratingPosition, role: "DEVELOPMENT", competitionTier };
  const contract = generateInitialContract(playerId, clubId, contractEndSeasonHint, contractEndYear, economyInputs);

  const player: PlayerMock = {
    id: playerId,
    clubId,
    firstName: name.firstName,
    lastName: name.lastName,
    shirtNumber: null,
    position,
    nationality,
    dateOfBirth,
    heightCm: null,
    weightKg: null,
    foot: null,
    // Part 13: TALENT default -- never automatically FIRST_CHOICE regardless of CA.
    squadStatus: "Ungdom",
    dataSource: "MOCK",
    currentAbility: ca,
    potentialAbility: pa,
    form: 5,
    fitnessPct: 100,
    moralePct: 70,
    appearances: 0,
    goals: 0,
    contractEndSeason: contractEndSeasonHint,
    wageSekPerMonth: 0,
    attributes: legacyAttributesFromCA(ca),
  };

  return { player, rating, contract };
}

// ---------------------------------------------------------------------------
// Part 2/17/19/20: the daily-tick hook.
// ---------------------------------------------------------------------------

export interface YouthIntakeResult {
  state: CareerState;
  events: CareerEvent[];
  /** clubId -> generated playerIds this call, for callers that want the exact cohort (e.g. tests, a future summary panel). Empty on a day that isn't the intake date, or for a club already generated this year. */
  generated: Record<string, string[]>;
}

/**
 * Runs every day (cheap early-exit on any day that isn't 1 July -- Part
 * 20: deterministic, no Math.random anywhere in this module). For each
 * eligible club not yet generated for the CURRENT calendar year (Part 2:
 * "Det får aldrig genereras två intakes samma season", enforced via
 * `youthIntakeClubYears`), generates a small cohort and inserts them as
 * full canonical roster members. The human's own club receives intake
 * exactly like every CPU club (Part 17: "Human club receives youth
 * intake too... CPU must NOT decide which youth to accept/reject") --
 * only the resulting CareerEvent is club-scoped (human club only, one
 * message per club, never per player).
 */
export function progressYouthIntake(state: CareerState, date: string): YouthIntakeResult {
  if (date.slice(5, 10) !== YOUTH_INTAKE_DATE_MMDD) return { state, events: [], generated: {} };

  const year = date.slice(0, 4);
  const intakeYear = Number(year);
  let next = state;
  const events: CareerEvent[] = [];
  const generated: Record<string, string[]> = {};

  const clubIds = eligibleYouthIntakeClubIds(next);
  const weights = positionWeights(worldMvSupplyRatio(next, clubIds));

  for (const clubId of clubIds) {
    if (next.youthIntakeClubYears[clubId] === year) continue; // idempotent -- this club's intake for this year already ran (reload-safe, Part 19/20).

    const tier = youthTierForClub(clubId);
    const clubShift = clubQualityShift(next, clubId);
    const size = intakeSizeForClub(next.saveSeed, clubId, intakeYear);
    const academyQuality = resolveAcademyQuality(clubId);

    const newPlayers: PlayerMock[] = [];
    const newRatings: GameplayPlayerRating[] = [];
    let contracts = next.playerContracts;
    let squadStatusMap = next.playerSquadStatus;
    let statuses = next.playerStatuses;

    for (let i = 0; i < size; i++) {
      const { player, rating, contract } = generateYouthPlayer(next.saveSeed, clubId, intakeYear, i, weights, clubShift, tier, academyQuality);
      newPlayers.push(player);
      newRatings.push(rating);
      contracts = { ...contracts, [player.id]: contract };
      squadStatusMap = { ...squadStatusMap, [player.id]: "TALENT" };
      statuses = { ...statuses, [player.id]: { playerId: player.id, availability: "AVAILABLE" } };
    }

    next = {
      ...next,
      worldSquads: { ...next.worldSquads, [clubId]: [...(next.worldSquads[clubId] ?? []), ...newPlayers] },
      gameplayRatings: { ...next.gameplayRatings, [clubId]: [...(next.gameplayRatings[clubId] ?? []), ...newRatings] },
      playerContracts: contracts,
      playerSquadStatus: squadStatusMap,
      playerStatuses: statuses,
      youthIntakeClubYears: { ...next.youthIntakeClubYears, [clubId]: year },
    };

    generated[clubId] = newPlayers.map((p) => p.id);

    // Part 17: never per-player, never for a CPU club -- one message, human club only.
    if (clubId === next.playerClubId) {
      events.push(buildYouthIntakeCompleteEvent(clubId, date, newPlayers.length));
    }
  }

  return { state: next, events, generated };
}
