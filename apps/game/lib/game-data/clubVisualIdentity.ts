// Club Identity C5: the production resolver over the Club Identity Registry.
//
// One source of club colour truth: registry.json -> (generated)
// clubVisualIdentity.data.ts -> this resolver. Locked rules (L2-L5, L8):
// - Club neon comes from the verified first-choice home shirt (registry neon).
// - Black/white shirts: Ice Silver. Unknown / not researched / retired: the
//   orange fallback, visibly marked and never presented as verified data.
// - Clubless manager: orange. Crests keep their own colours. B/U teams never
//   inherit a parent's colours (the registry stores none for them).
import { CLUB_VISUAL_PALETTE, CLUB_VISUAL_RECORDS } from "./clubVisualIdentity.data";

export type ClubVisualStatus = "VERIFIED" | "PROBABLE" | "UNCERTAIN" | "UNKNOWN" | "NOT_RESEARCHED" | "RETIRED";
export type ClubVisualRule = "CLUB" | "ICE_SILVER" | "FALLBACK";

export interface ClubVisualRecord {
  status: ClubVisualStatus;
  rule: ClubVisualRule;
  neon: string;
  kit: { primary: string; secondary: string | null } | null;
  crest: { primary: string; secondary: string | null } | null;
  season: string | null;
}

export type ClubIdentityKind = "club" | "ice" | "fallback" | "clubless";

export interface ClubVisualIdentity {
  clubId: string | null;
  kind: ClubIdentityKind;
  /** Arena Nights neon accent (tuned for the dark arena surface). */
  neon: string;
  /** Ink that reads on the neon (registry contrast gate >= 4.5). */
  neonInk: string;
  status: ClubVisualStatus | "CLUBLESS";
  /** True only for a registry-backed kit colour; false for the fallback and for clubless. */
  verifiedColour: boolean;
  /** Visible marker text for a fallback colour ("Klubbfärg ej verifierad"), never shown for real colours. */
  fallbackLabel: string | null;
  kit: ClubVisualRecord["kit"];
  crest: ClubVisualRecord["crest"];
}

export const CLUBLESS_ORANGE = CLUB_VISUAL_PALETTE.clubless;
export const ICE_SILVER = CLUB_VISUAL_PALETTE.iceSilver;
export const NEON_INK = "#061018";
export const FALLBACK_LABEL = "Klubbfärg ej verifierad";

export function clubVisualRecord(clubId: string): ClubVisualRecord | undefined {
  return CLUB_VISUAL_RECORDS[clubId];
}

/** The visual identity of a club, or the clubless identity for `null`/`undefined` (manager without a club). */
export function clubVisualIdentity(clubId: string | null | undefined): ClubVisualIdentity {
  if (!clubId) return { clubId: null, kind: "clubless", neon: CLUBLESS_ORANGE, neonInk: NEON_INK, status: "CLUBLESS", verifiedColour: false, fallbackLabel: null, kit: null, crest: null };
  const r = CLUB_VISUAL_RECORDS[clubId];
  if (!r || r.rule === "FALLBACK") {
    return { clubId, kind: "fallback", neon: CLUBLESS_ORANGE, neonInk: NEON_INK, status: r?.status ?? "NOT_RESEARCHED", verifiedColour: false, fallbackLabel: FALLBACK_LABEL, kit: null, crest: r?.crest ?? null };
  }
  return { clubId, kind: r.rule === "ICE_SILVER" ? "ice" : "club", neon: r.neon, neonInk: NEON_INK, status: r.status, verifiedColour: true, fallbackLabel: null, kit: r.kit, crest: r.crest };
}

/**
 * The two colours a club's generated crest/placeholder mark uses: the crest's
 * own colours when the registry documents them (crests keep their original
 * colours), otherwise the home kit, otherwise undefined (caller keeps its
 * neutral placeholder). Never the neon, never a parent's colours.
 */
export function clubMarkColours(clubId: string): { primary: string; secondary: string } | undefined {
  const r = CLUB_VISUAL_RECORDS[clubId];
  if (!r) return undefined;
  const source = r.crest ?? (r.rule === "FALLBACK" ? null : r.kit);
  if (!source) return undefined;
  return { primary: source.primary, secondary: source.secondary ?? "#ffffff" };
}
