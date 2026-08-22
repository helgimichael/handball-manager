// HM-RATINGS-0.5 Part F/G: a SMALL, hand-transcribed extension of
// player-specific evidence beyond the 12 HM-RATINGS-0.2 calibration
// players -- transcribed directly (verbatim, not paraphrased) from
// docs/design/HANDBALL_MANAGER_SWEDEN_2026-27_PLAYER_RATING_ANCHORS_v0.1.docx's
// Alingsås HK section, following the exact same hand-transcription
// rigor HM-RATINGS-0.2 already used for its 12 players. This is NOT a
// calibrated CA/PA/attribute profile (that stays HM-RATINGS-0.2's
// job) -- it only supplies CLAIMS, matched onto a real roster player by
// normalized full name, for the CA ESTIMATOR to reason over.
//
// This is deliberately a SMALL, bounded set (6 players from ONE club),
// not an attempt at broad league coverage -- see this milestone's
// report for why: the source document has this kind of evidence for a
// meaningfully larger slice of the league (roughly 40-100+ additional
// named players across all 14 clubs), but transcribing all of it is a
// substantial data-acquisition effort explicitly out of scope for this
// milestone (HM-RATINGS-0.5's own "IMPORTANT DECISION RULE": implement
// the estimator on a defensible subset, then report exactly what
// additional transcription work remains -- do not force full coverage).
import type { PlayerRatingClaim } from "../types";
import { normalizeName } from "../pipeline/evidenceCollection";

interface ExtendedEvidenceEntry {
  fullName: string;
  claims: Omit<PlayerRatingClaim, "playerId">[];
}

function careerSignal(id: string, key: string, value: string, sourceRefs: string[] = ["ev-sweden-2026-27-anchors"]): Omit<PlayerRatingClaim, "playerId"> {
  return { id, evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key, value, sourceRefs };
}

function expertAnchor(id: string, value: string, notes?: string, sourceRefs: string[] = ["ev-sweden-2026-27-anchors"]): Omit<PlayerRatingClaim, "playerId"> {
  return { id, evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value, sourceRefs, ...(notes ? { notes } : {}) };
}

function injuryAvailability(id: string, value: string, notes: string): Omit<PlayerRatingClaim, "playerId"> {
  return { id, evidenceClass: "INJURY_AVAILABILITY", domain: "INJURY", key: "availabilityRisk", value, sourceRefs: ["ev-sweden-2026-27-anchors"], notes, confidence: "UNCERTAIN" };
}

// ---------------------------------------------------------------------------
// Alingsås HK -- transcribed 2026-08-22 directly from the source docx's
// "1. ALINGSÅS HK" section (VERIFIED CAREER SIGNALS / USER EXPERT PLAYER
// ANCHORS / INJURY-AVAILABILITY SIGNALS tables). Quotes are verbatim
// except for minor punctuation normalization.
// ---------------------------------------------------------------------------

const ALINGSAS_EXTENDED_EVIDENCE: ExtendedEvidenceEntry[] = [
  {
    fullName: "Niklas Kraft",
    claims: [
      careerSignal("ext-niklas-kraft-cs-1", "seniorCareerSignal", "SM champion 2022 with Ystads IF; 300+ top-flight Swedish matches; three recent seasons with Ribe-Esbjerg in Denmark; previous Alingsås league/SM-final experience; Swedish league-national-team selection reported in club profile."),
      expertAnchor("ext-niklas-kraft-an-1", "CLUB_STAR", "Very, very good goalkeeper."),
    ],
  },
  {
    fullName: "August Wiger",
    claims: [
      careerSignal("ext-august-wiger-cs-1", "foreignCareerSignal", "Four consecutive foreign seasons in Denmark with Aarhus Håndbold and Sønderjyske before return to Sweden; previous Sävehof, Aranäs and Redbergslid experience."),
      expertAnchor("ext-august-wiger-an-1", "CLUB_STAR", "The player expected to control Alingsås' attacking game. Very skilled playmaker / game engine."),
      expertAnchor("ext-august-wiger-an-2", "PRIMARY_PLAYMAKER"),
      expertAnchor("ext-august-wiger-an-3", "ATTACK_ORGANIZER"),
    ],
  },
  {
    fullName: "Benjamin Helander",
    claims: [
      careerSignal("ext-benjamin-helander-cs-1", "seniorInternational", "Finland senior international; club profile reports 38 senior internationals/148 goals and 35 youth internationals; two seasons with Rhein-Neckar Löwen; German Cup winner 2023."),
      expertAnchor("ext-benjamin-helander-an-1", "CLUB_STAR", "Superb in his V6 / wing role."),
    ],
  },
  {
    fullName: "Anton Hagvall",
    claims: [
      careerSignal("ext-anton-hagvall-cs-1", "youthCareerSignal", "27 Swedish youth internationals; foreign experience with Skjern; previous Sävehof, LUGI and IFK Skövde experience."),
      expertAnchor("ext-anton-hagvall-an-1", "CLUB_STAR", "Club-star level goalkeeper when available. Availability is a major concern because of reported ACL injury."),
      injuryAvailability("ext-anton-hagvall-inj-1", "ACL injury; user reports risk of missing all or most of the coming season.", "Do not lower underlying ability because of injury -- availability is modeled separately (Rating Model §2)."),
    ],
  },
  {
    fullName: "Arvid Boquist",
    claims: [
      careerSignal("ext-arvid-boquist-cs-1", "youthCareerSignal", "20 Swedish youth internationals/25 goals reported; Handbollsligan All Star Team – Defender of the Year 2025/26."),
      expertAnchor("ext-arvid-boquist-an-1", "EMERGING_KEY_PLAYER", "Moving from high-potential status toward KEY_PLAYER, but recurring injury problems have prevented full establishment/continuity."),
      injuryAvailability("ext-arvid-boquist-inj-1", "Recurring injury problems have limited continuity.", "Keep current playing-quality trajectory separate from availability/durability (Rating Model §2)."),
    ],
  },
  {
    fullName: "Alexander Regen",
    claims: [
      // Explicitly listed in the source doc's own UNASSESSED PLAYERS
      // list -- "retain their VERIFIED CAREER SIGNALS but have no USER
      // EXPERT PLAYER ANCHOR yet... must not be interpreted as weaker
      // merely because no anchor was assigned." Deliberately kept as a
      // career-signal-only test case (no anchor claim at all).
      careerSignal("ext-alexander-regen-cs-1", "youthCareerSignal", "16 Swedish youth internationals/36 goals reported; extensive Alingsås experience; named captain for 2026/27."),
    ],
  },
];

const EXTENDED_EVIDENCE_BY_NORMALIZED_NAME: Map<string, ExtendedEvidenceEntry> = new Map(ALINGSAS_EXTENDED_EVIDENCE.map((entry) => [normalizeName(entry.fullName), entry]));

/**
 * Finds extended evidence claims for a real roster player by normalized
 * full name -- the same match semantics as HM-RATINGS-0.3's calibration
 * matching. Returns `[]` (never throws) for the ~262 players outside
 * this small hand-transcribed set; that is the expected, common case.
 */
export function matchExtendedEvidence(fullName: string, playerId: string): PlayerRatingClaim[] {
  const entry = EXTENDED_EVIDENCE_BY_NORMALIZED_NAME.get(normalizeName(fullName));
  if (!entry) return [];
  return entry.claims.map((claim) => ({ ...claim, playerId }));
}
