// HM-DATA-ALLSVENSKAN-1.1B Parts 11/12/13: the Knowledge / Fog-of-War
// foundation.
//
// Central architecture principle this whole package exists to enforce:
//   TRUE WORLD STATE  ->  MANAGER/CLUB KNOWLEDGE  ->  PLAYER-FACING VIEW
// The game (the engine, the rating pipeline, the identity data) always
// knows the truth. The manager does not automatically know it too, just
// because it exists somewhere in CareerState/canonical data. This
// package is the ONE place that turns "how well does this manager know
// X" into "what should the UI actually show" -- never a second copy of
// the underlying player/club data, only a knowledge SCORE plus pure
// resolver functions that read the real data and redact/fuzz it.
//
// Deliberately per-career (CareerState-resident), never global/canonical
// -- two different managers' careers can have wildly different
// knowledge of the exact same real player/club, and neither one ever
// touches the shared canonical data itself.
export const KNOWLEDGE_MIN = 0;
export const KNOWLEDGE_MAX = 100;

/** Every external club/player starts here until a future scouting/observation pass raises it -- low enough that almost nothing beyond public facts is visible, matching "just opening another club currently reveals nearly all canonical data" being the exact problem this foundation fixes. */
export const DEFAULT_EXTERNAL_KNOWLEDGE_PCT = 15;
/** The manager's own club and own players are always effectively fully known -- never stored as a row, just the `clubId === state.playerClubId` fast path every getter below uses. */
export const OWN_CLUB_KNOWLEDGE_PCT = 100;

export const KNOWLEDGE_TIERS = ["MINIMAL", "LOW", "MEDIUM", "HIGH"] as const;
export type KnowledgeTier = (typeof KNOWLEDGE_TIERS)[number];

/** Part: "En 0-100 knowledge/familiarity-grad är en bra utgångspunkt" -- four coarse tiers gate which visibility rules apply; the underlying score stays continuous for future finer-grained sources to nudge. */
export function knowledgeTier(pct: number): KnowledgeTier {
  if (pct >= 75) return "HIGH";
  if (pct >= 50) return "MEDIUM";
  if (pct >= 25) return "LOW";
  return "MINIMAL";
}

export function clampKnowledgePct(pct: number): number {
  return Math.max(KNOWLEDGE_MIN, Math.min(KNOWLEDGE_MAX, Math.round(pct)));
}

/** Shared Swedish presentation for a knowledge tier -- used anywhere the UI shows how well the manager knows an external club/player, never the raw 0-100 number. */
export const KNOWLEDGE_TIER_LABEL_SV: Record<KnowledgeTier, string> = {
  MINIMAL: "Mycket begränsad kännedom",
  LOW: "Begränsad kännedom",
  MEDIUM: "Måttlig kännedom",
  HIGH: "God kännedom",
};
