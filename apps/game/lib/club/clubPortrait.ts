// Arena Nights -- other club as a portrait (CLB-04 C "Peek-first Scout Card") and its identity in words
// (CLB-04a B). Pure: public facts (table, form, results) are ungated; identity and coach claims arrive already
// knowledge-gated by resolveClubVisibility, and every domain the manager does not know yet is a fogged line.
import type { CareerState } from "../career/types";
import type { ClubVisibleView } from "../knowledge/clubVisibility";
import type { IdentityClaim } from "../identity/types";
import { presentClaim } from "../identity/presentation";
import { clubPeek } from "../competition/leagueCentre";
import { headToHead, type HeadToHead } from "./clubTimeline";
import { getClub } from "../game-data";

export const CLUB_DOMAINS = [
  ["tacticalHeritage", "Spelsätt"],
  ["developmentIdentity", "Utveckling"],
  ["recruitmentIdentity", "Rekrytering"],
  ["cultureIdentity", "Kultur"],
  ["structuralIdentity", "Organisation"],
  ["financialStrategicIdentity", "Ekonomi"],
  ["supporterEnvironmentIdentity", "Publik"],
] as const;
export const COACH_DOMAINS = [
  ["coachingStyleClaims", "Tränarstil"],
  ["tacticalPreferenceClaims", "Taktik"],
  ["communicationLeadershipClaims", "Ledarskap"],
  ["developmentClaims", "Spelarutveckling"],
  ["adaptabilityClaims", "Anpassning"],
  ["cultureBuildingClaims", "Kulturbygge"],
] as const;

export interface PortraitLine { key: string; label: string; sentences: string[]; known: boolean }
export interface ClubPortrait {
  name: string;
  shortName: string;
  headline: string;
  standfirst: string | null;
  h2h: HeadToHead;
  identity: PortraitLine[];
  coach: PortraitLine[];
  hidden: number;
  /** Nothing imported for this club at all (an honest absence, unrelated to knowledge). */
  noIdentityData: boolean;
  noCoachData: boolean;
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const claimsOf = (profile: object | null | undefined, key: string): IdentityClaim[] => ((profile as Record<string, IdentityClaim[] | undefined> | null | undefined)?.[key] ?? []);

/** Who they are (table and form in one sentence) -> how they play (the first known style claim) -> what you don't know. */
export function clubPortrait(state: CareerState, clubId: string, visibility: ClubVisibleView | null, loaded: { club: boolean; coach: boolean } = { club: !!visibility?.clubIdentity, coach: !!visibility?.coachIdentity }): ClubPortrait | null {
  const club = getClub(clubId);
  const peek = clubPeek(state, clubId);
  if (!club || !peek) return null;
  const wins = peek.form.filter((f) => f === "W").length;
  const parts = [peek.position ? `${club.shortName} ligger ${peek.position}:a av ${peek.teams}` : `${club.shortName}${peek.competition ? ` spelar i ${peek.competition}` : ""}`];
  if (peek.form.length >= 3) parts.push(`${wins === 0 ? "har inte vunnit" : `har vunnit ${wins}`} av de senaste ${peek.form.length}`);
  const headline = parts.join(" och ");
  const identity = CLUB_DOMAINS.map(([key, label]) => { const c = claimsOf(visibility?.clubIdentity, key); return { key, label, sentences: c.map((x) => sentence(presentClaim(x))), known: c.length > 0 }; });
  const coach = COACH_DOMAINS.map(([key, label]) => { const c = claimsOf(visibility?.coachIdentity, key); return { key, label, sentences: c.map((x) => presentClaim(x)), known: c.length > 0 }; });
  const style = identity.find((l) => l.key === "tacticalHeritage" && l.known) ?? identity.find((l) => l.known);
  return {
    name: club.name, shortName: club.shortName,
    headline: sentence(headline),
    standfirst: style ? style.sentences[0]! : null,
    h2h: headToHead(state, clubId),
    identity, coach,
    hidden: (visibility?.hiddenClubClaimCount ?? 0) + (visibility?.hiddenCoachClaimCount ?? 0),
    noIdentityData: !loaded.club, noCoachData: !loaded.coach,
  };
}
