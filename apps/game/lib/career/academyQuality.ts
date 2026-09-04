// HM-YOUTH-INTAKE-1.1B: Academy Quality -- a club's standing ability to produce
// young talent.
//
// WHY THIS IS NOT SAVE-RANDOM. Academy quality is part of a real club's
// identity: Alingsås should have a recognisable youth system across every
// career you ever start, the way its colours and its city are the same in
// every career. Deriving it from (saveSeed, clubId) would make the same club a
// talent factory in one save and a wasteland in the next, which is world
// flavour, not identity. The baseline below therefore keys on `clubId` ALONE.
// Save- and year-specific variation (a golden generation, a bad intake year) is
// a genuinely different concept and belongs to 1.1c.
//
// WHY NOT DERIVE IT FROM THE SQUAD OR THE LEAGUE. An academy is not the first
// team. A strong Handbollsligan side can run an ordinary youth section, a
// mid-table one can be the country's best developer, and a Division 1 club can
// quietly produce an international. Deriving academy quality from
// ClubStrength.overall or competition tier would make all four of those
// impossible and would additionally mean a club's youth system changed the day
// it was promoted or relegated -- which is not how youth systems work.
//
// WHERE THE VALUE LIVES. `Club.academyQuality` in the canonical club registry
// (lib/game-data/clubs.ts), which already holds all 149 clubs including the
// full Swedish 52. That registry is the only complete club source: canonical
// club identity files under data/real-world/ exist for Handbollsligan and
// Herrallsvenskan only (14 + 14), Division 1 has none at all, and their schema
// is evidence-referenced tactical/culture claims -- an unsourced academy rating
// would not belong in a document that cites approved profile evidence for
// every value it holds.
//
// ACADEMY QUALITY SUPPORT EXISTS, BUT REAL CLUB BASELINES ARE NOT YET
// CALIBRATED. The field is OPTIONAL and currently unset for every club, so
// every club resolves to neutral 50 and the youth potential distribution is
// bit-for-bit the one Youth Intake 1.1a produced.
//
// That fallback is a deliberate refusal, not a placeholder. An earlier draft
// derived it from a hash of the clubId, which is stable and league-independent
// and therefore looked harmless -- but a deterministic arbitrary number is
// still an invented characteristic of a real club. It would have permanently
// declared, on no evidence, that Kungälv runs an elite academy and Uppsala a
// poor one, purely because their ids hash differently. Neutral 50 gives no real
// club an unsupported advantage or disadvantage and leaves global talent supply
// untouched until real data exists.
//
// Populating real values is a dedicated data/research pass. When it happens it
// is a pure data change: set Club.academyQuality and this function prefers it
// automatically, with no code change anywhere.
import { getClub } from "../game-data";

/**
 * 0-100, neutral 50 -- the SAME shape as ClubStrength.overall, which this
 * codebase already uses for club-level quality and which clubQualityShift
 * already consumes. Reusing it means an editor, a future academy investment
 * system and a staff/facility modifier all speak one club-quality vocabulary.
 *
 * Deliberately NOT the 1-200 player scale: academy quality is a property of an
 * organisation, not an ability a player has, and conflating the two invites
 * exactly the "academy adds +N PA" arithmetic this milestone must avoid.
 */
export const ACADEMY_QUALITY_MIN = 0;
export const ACADEMY_QUALITY_MAX = 100;
export const ACADEMY_QUALITY_NEUTRAL = 50;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * The club's academy quality, 0-100.
 *
 * `Club.academyQuality` when a real, researched value exists; otherwise NEUTRAL.
 * Neutral is exactly the no-op: academyPotentialGamma(50) is 1, so an
 * uncalibrated club generates the Youth Intake 1.1a distribution unchanged.
 *
 * Reads `clubId` only -- never the current league, the current squad or the
 * save seed -- so a club carries its academy through promotion and relegation,
 * and the same real club has the same academy in every career.
 */
export function resolveAcademyQuality(clubId: string): number {
  const explicit = getClub(clubId)?.academyQuality;
  if (typeof explicit !== "number") return ACADEMY_QUALITY_NEUTRAL;
  return clamp(explicit, ACADEMY_QUALITY_MIN, ACADEMY_QUALITY_MAX);
}

/**
 * How strongly academy quality bends the youth potential distribution.
 *
 * Returns a `gamma` for the monotone percentile transform used by youth PA
 * generation: `p' = 100 * (p/100)^gamma`. gamma < 1 pushes probability mass
 * toward the upper bands, gamma > 1 toward the lower ones, and gamma === 1 at
 * neutral leaves the 1.1a distribution exactly untouched.
 *
 * This is a REWEIGHTING, never an addition. No academy adds potential points to
 * a player; a better academy makes the good outcomes more likely and the poor
 * ones less so. Because the transform is monotone and continuous, every band
 * -- including the rarest -- keeps a non-zero probability at every academy
 * quality: the weakest academy in the country can still produce a wonderkid,
 * and the strongest is never guaranteed one.
 */
export function academyPotentialGamma(academyQuality: number): number {
  const centred = (clamp(academyQuality, ACADEMY_QUALITY_MIN, ACADEMY_QUALITY_MAX) - ACADEMY_QUALITY_NEUTRAL) / 50;
  return 1 - centred * ACADEMY_GAMMA_SPREAD;
}

/**
 * Calibrated so a top academy roughly doubles elite-tail odds and a poor one
 * roughly halves them, while whole-world elite production stays in the same
 * order of magnitude -- academy quality answers "which clubs have the better
 * odds", not "how many extra elite players does Sweden produce".
 */
const ACADEMY_GAMMA_SPREAD = 0.7;

export const ACADEMY_QUALITY_CONSTANTS = { ACADEMY_GAMMA_SPREAD } as const;
