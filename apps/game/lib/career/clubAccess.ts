// Club access control for the career shell: which destinations need a club of the manager's own.
// One rule set serves the route guard (GameShell renders the "no club" panel instead of the page --
// so a direct URL, a remembered tab or a stale link can never mount a former club's workspace),
// the hub rail, the hub tabs, the phone bar and the command palette.
//
// Club-internal = the squad, its tactics, training, medical, contracts and comparisons; the club's
// own house (Klubb, Klubbhuset, partnerships), board, finances and staff; the club's recruitment
// desk (pipeline, scouts, transfers); own-team analysis; and the match workflow for its fixtures.
// Public = everything a manager without a club still has: Idag, Inkorg, Kalender, the
// player market (Spelarsök and player profiles, seen from the outside), competitions, tables,
// statistics, results and match reports, other clubs' portraits, Karriär, Historik, Media, Inställningar.
import type { CareerState } from "./types";
import { CAREER_NAV_ITEMS, type CareerNavItem } from "./navigation";
import { CAREER_HUBS, MERGED_NAV_IDS, type CareerHub } from "./hubs";
import { formerClubId, isEmployed } from "../manager/employment";

type AccessInput = Pick<CareerState, "playerClubId" | "managerCareer">;

/** Primary destinations that belong to the club the manager runs. */
export const CLUB_INTERNAL_NAV_IDS: ReadonlySet<string> = new Set([
  "squad", "tactics", "training", "medical", "contracts",
  "klubbhuset", "club", "board", "finance", "staff",
  "recruitment", "scouting", "transfers",
  "analysis",
  // The match programme (friendlies, camps, preseason bookings) is the club's; without one the calendar shows his own agenda.
  "schedule",
]);

/** Every club-internal route (segment-matched: "/career/club" covers /career/club/partnerships, never /career/clubs/…). */
const CLUB_INTERNAL_ROUTES: readonly string[] = [
  "/career/tactics", "/career/training", "/career/medical", "/career/contracts", "/career/compare",
  "/career/klubbhuset", "/career/club", "/career/board", "/career/finance", "/career/staff",
  "/career/recruitment", "/career/scouting", "/career/transfers",
  "/career/analysis", "/career/schedule", "/career/matches",
  "/career/match-preview", "/career/match-day", "/career/match-2d",
];
/** Routes whose index is club-internal but whose children are public (the squad list vs any player's profile). */
const CLUB_INTERNAL_EXACT: readonly string[] = ["/career/squad"];

const strip = (pathname: string) => (pathname.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";

/** Whether a pathname (query and hash ignored) is part of a club's internal workspace. */
export function isClubInternalPath(pathname: string): boolean {
  const p = strip(pathname);
  return CLUB_INTERNAL_EXACT.includes(p) || CLUB_INTERNAL_ROUTES.some((r) => p === r || p.startsWith(`${r}/`));
}

export type RouteAccess = { allowed: true } | { allowed: false; reason: "NO_CLUB"; formerClubId?: string };

/** The route guard's verdict: an employed manager may open everything (unchanged); without a club, nothing club-internal. */
export function routeAccess(state: AccessInput, pathname: string): RouteAccess {
  if (isEmployed(state) || !isClubInternalPath(pathname)) return { allowed: true };
  return { allowed: false, reason: "NO_CLUB", formerClubId: formerClubId(state) };
}

export function navItemAvailable(state: AccessInput, navId: string): boolean {
  const id = MERGED_NAV_IDS[navId] ?? navId;
  return isEmployed(state) || !CLUB_INTERNAL_NAV_IDS.has(id);
}

/** A hub's tabs the manager may open now (all of them while employed). */
export function availableHubTabs(state: AccessInput, hub: CareerHub): CareerNavItem[] {
  const byId = new Map(CAREER_NAV_ITEMS.map((i) => [i.id, i]));
  return hub.tabs.filter((id) => navItemAvailable(state, id)).map((id) => byId.get(id)).filter((i): i is CareerNavItem => !!i);
}

export function hubAvailable(state: AccessInput, hub: CareerHub): boolean {
  return availableHubTabs(state, hub).length > 0;
}

/** Where a hub lands: its first tab, or its first open tab without a club (Rekrytering → Spelarsök). */
export function availableHubHref(state: AccessInput, hub: CareerHub): string | undefined {
  return availableHubTabs(state, hub)[0]?.href;
}

export interface HubAccess { hub: CareerHub; available: boolean; href?: string }

export function hubAccessList(state: AccessInput): HubAccess[] {
  return CAREER_HUBS.map((hub) => ({ hub, available: hubAvailable(state, hub), href: availableHubHref(state, hub) }));
}
