// Central career navigation model (HM-UX-0.2).
//
// The one source of truth for primary sidebar destinations and which
// pathname prefixes each one "owns" for active-state purposes (Spec
// §30/§31) -- GameShell.tsx is the only consumer, replacing the old
// exact-match-only `pathname === item.href` check that never
// highlighted a nested/contextual route (e.g. /career/squad/p-1 or
// /career/analysis/opponent).
//
// LEVEL 1 (this file) = primary management areas, always in the
// sidebar. LEVEL 2 (Analysis' own internal tab bar, Competitions' own
// in-page selector) and LEVEL 3 (Player Profile, Match Preview/Day/
// Report) are deliberately NOT represented here -- they are contextual,
// reached by navigating INTO a Level 1 area (Spec §3).
import type { NavIconName } from "@/components/NavIcon";

export interface CareerNavItem {
  id: string;
  label: string;
  href: string;
  icon: NavIconName;
  /**
   * Every pathname this item is considered "active" for, beyond its own
   * href -- contextual/Level 3 routes reached from this area (Spec §23:
   * "/career/squad/123 -> SQUAD should remain contextually active").
   * Prefix-matched.
   */
  ownsPrefixes: readonly string[];
}

export const CAREER_NAV_ITEMS: readonly CareerNavItem[] = [
  { id: "home", label: "Hem", href: "/career", icon: "home", ownsPrefixes: [] },
  { id: "inbox", label: "Inkorg", href: "/career/inbox", icon: "inbox", ownsPrefixes: [] },
  // HM-ALPHA3-M08: the Media Centre -- news, press conferences, rivals, discipline.
  { id: "media", label: "Media", href: "/career/media", icon: "media", ownsPrefixes: ["/career/media/"] },
  { id: "squad", label: "Trupp", href: "/career/squad", icon: "squad", ownsPrefixes: ["/career/squad/"] },
  { id: "contracts", label: "Kontrakt", href: "/career/contracts", icon: "transfers", ownsPrefixes: ["/career/compare"] },
  { id: "tactics", label: "Taktik", href: "/career/tactics", icon: "tactics", ownsPrefixes: [] },
  { id: "training", label: "Träning", href: "/career/training", icon: "training", ownsPrefixes: [] },
  { id: 'calendar', label: 'Kalender', href: '/career/calendar', icon: 'schedule', ownsPrefixes: [] },
  // Schedule is the canonical fixture surface (Spec §5/§6) -- it also
  // owns the contextual match workflow reached from it (Preview/Day/
  // Report), and the legacy /career/matches route (redirected, Spec §7).
  {
    id: "schedule",
    label: "Schema",
    href: "/career/schedule",
    icon: "schedule",
    ownsPrefixes: ["/career/matches", "/career/match-preview", "/career/match-day/", "/career/match-report/", "/career/match-2d", "/career/fixtures/"],
  },
  { id: "analysis", label: "Analys", href: "/career/analysis", icon: "analysis", ownsPrefixes: ["/career/analysis/"] },
  { id: "players", label: "Spelarsök", href: "/career/players", icon: "scouting", ownsPrefixes: [] },
  { id: "scouting", label: "Scouting", href: "/career/scouting", icon: "scouting", ownsPrefixes: [] },
  { id: "recruitment", label: "Rekrytering", href: "/career/recruitment", icon: "recruitment", ownsPrefixes: [] },
  { id: "transfers", label: "Transfers", href: "/career/transfers", icon: "transfers", ownsPrefixes: ["/career/transfers/"] },
  { id: "staff", label: "Personal", href: "/career/staff", icon: "staff", ownsPrefixes: ["/career/staff/"] },
  { id: "medical", label: "Medicinskt", href: "/career/medical", icon: "medical", ownsPrefixes: [] },
  { id: "club", label: "Klubb", href: "/career/club", icon: "club", ownsPrefixes: ["/career/club/", "/career/clubs/"] },
  // HM-ALPHA3-M07: the Boardroom (objectives, confidence, meetings) and the manager's own career (profile, history, job market).
  { id: "board", label: "Styrelsen", href: "/career/board", icon: "board", ownsPrefixes: [] },
  { id: "manager", label: "Karriär", href: "/career/manager", icon: "manager", ownsPrefixes: [] },
  // HM-ALPHA3-M02: the Financial Centre.
  { id: "finance", label: "Ekonomi", href: "/career/finance", icon: "finance", ownsPrefixes: [] },
  // HM-ALPHA3-M03: the season hub -- tables, SM-slutspel, kval, Svenska cupen, awards.
  { id: "season", label: "Säsongen", href: "/career/season", icon: "competitions", ownsPrefixes: [] },
  { id: "competitions", label: "Tävlingar", href: "/career/competitions", icon: "competitions", ownsPrefixes: ["/career/competitions/"] },
  { id: "statistics", label: "Statistik", href: "/career/statistics", icon: "analysis", ownsPrefixes: [] },
  { id: "history", label: "Historik", href: "/career/history", icon: "schedule", ownsPrefixes: [] },
  // HM-ALPHA3-M01: device preferences (display currency). Not career state.
  { id: "settings", label: "Inställningar", href: "/career/settings", icon: "settings", ownsPrefixes: [] },
];

/** The one primary nav item `pathname` belongs to, or `undefined` for a route no primary area owns (e.g. the dev-only /career/match-center demo, or /editor). Never returns more than one id -- exact-href match wins first, then the longest matching owns-prefix, so a route can never highlight two primary sections at once (Spec §23). */
export function resolveActiveNavId(pathname: string): string | undefined {
  const exact = CAREER_NAV_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact.id;

  let bestMatch: { id: string; prefixLength: number } | undefined;
  for (const item of CAREER_NAV_ITEMS) {
    for (const prefix of item.ownsPrefixes) {
      if (pathname.startsWith(prefix) && (!bestMatch || prefix.length > bestMatch.prefixLength)) {
        bestMatch = { id: item.id, prefixLength: prefix.length };
      }
    }
  }
  return bestMatch?.id;
}
