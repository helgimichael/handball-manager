// HM-PLAYER-DATA-EDITOR-1.0: the canonical special-tag vocabulary for a
// player -- a small, simple first model (Part: "Håll första modellen
// enkel"). Confirmed by audit that no player-level tag/trait field
// existed anywhere in the codebase before this milestone (identity
// claims, RoleProficiency, and staff roles are all separate concepts).
// Purely descriptive/informational at this milestone -- nothing in
// career/matchPlan reads these yet, the same "foundation now, consequences
// later" precedent squadStatus.ts's own doc already established for
// SquadStatusTier.
export const PLAYER_TAGS = [
  "ATTACK_SPECIALIST",
  "DEFENCE_SPECIALIST",
  "SEVEN_METER_TAKER",
  "SEVEN_VS_SIX_IMPORTANT",
  "CAPTAIN",
  "FIRST_GOALKEEPER",
  "BACKUP_GOALKEEPER",
] as const;
export type PlayerTag = (typeof PLAYER_TAGS)[number];

export const PLAYER_TAG_LABEL_SV: Record<PlayerTag, string> = {
  ATTACK_SPECIALIST: "Anfallsspecialist",
  DEFENCE_SPECIALIST: "Försvarsspecialist",
  SEVEN_METER_TAKER: "Straffskytt",
  SEVEN_VS_SIX_IMPORTANT: "Viktig i 7-mot-6",
  CAPTAIN: "Lagkapten",
  FIRST_GOALKEEPER: "Förstemålvakt",
  BACKUP_GOALKEEPER: "Reservmålvakt",
};

export function isPlayerTag(value: unknown): value is PlayerTag {
  return typeof value === "string" && (PLAYER_TAGS as readonly string[]).includes(value);
}
