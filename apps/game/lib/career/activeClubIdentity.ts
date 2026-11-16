// Club Identity C5: the visual identity of the club the manager ACTUALLY leads.
//
// While the manager is seeking a job, `playerClubId` still holds the former
// club (run by an interim); the experience is then clubless (orange), never
// the former club's colours. One resolver for every surface (GameShell sets it
// as CSS custom properties on the whole career UI).
import { clubVisualIdentity, type ClubVisualIdentity } from "../game-data";
import { managedClubId } from "../manager/managerCareer";
import type { CareerState } from "./types";

export function activeClubVisualIdentity(state: CareerState | null | undefined): ClubVisualIdentity {
  return clubVisualIdentity(state ? managedClubId(state) : undefined);
}

/** CSS custom properties + data attribute for the career shell. `--club-neon` is the Arena Nights accent; `--club-identity-*` carry kit colours (never a parent's). */
export function clubIdentityStyle(identity: ClubVisualIdentity): { style: Record<string, string>; dataIdentity: ClubVisualIdentity["kind"] } {
  const style: Record<string, string> = {
    "--club-neon": identity.neon,
    "--club-neon-ink": identity.neonInk,
  };
  if (identity.kit) {
    style["--club-identity-primary"] = identity.kit.primary;
    if (identity.kit.secondary) style["--club-identity-secondary"] = identity.kit.secondary;
  }
  return { style, dataIdentity: identity.kind };
}
