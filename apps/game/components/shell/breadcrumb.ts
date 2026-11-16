// Arena 231 -- ENT-09 A "Real breadcrumb in page header": a true path 'Laget › Trupp › Lindqvist' built from the
// six-hub map (lib/career/hubs.ts), replacing the old 'Kontoret / Detalj' context row. Pure; names of the detail
// object (player, club, competition) come from lookups the shell passes in.
import { hubHref, hubTabs, resolveHubRoute } from "../../lib/career/hubs";
import { CAREER_NAV_ITEMS } from "../../lib/career/navigation";

export interface Crumb { label: string; href?: string }
export interface CrumbLookups { player?: (id: string) => string | undefined; club?: (id: string) => string | undefined; competition?: (id: string) => string | undefined }

const seg = (pathname: string, prefix: string) => (pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length).split("/")[0] ?? "") : "");

/** Routes outside the six hubs' tabs (reached from a match, a fixture, the utility foot). */
const LOOSE: { prefix: string; label: string; parent: Crumb }[] = [
  { prefix: "/career/match-preview", label: "Matchförberedelse", parent: { label: "Idag", href: "/career" } },
  { prefix: "/career/match-day/", label: "Match", parent: { label: "Idag", href: "/career" } },
  { prefix: "/career/match-report/", label: "Matchrapport", parent: { label: "Tävling", href: "/career/season" } },
  { prefix: "/career/fixtures/", label: "Match", parent: { label: "Tävling", href: "/career/season" } },
  { prefix: "/career/settings", label: "Inställningar", parent: { label: "Idag", href: "/career" } },
];

function detailLabel(pathname: string, lookups: CrumbLookups): string | null {
  const player = seg(pathname, "/career/squad/") || (pathname.startsWith("/career/transfers/offers/") ? "" : seg(pathname, "/career/transfers/"));
  if (player) return lookups.player?.(player) ?? "Spelare";
  if (pathname.startsWith("/career/transfers/offers/")) return "Bud";
  const club = seg(pathname, "/career/clubs/");
  if (club) return lookups.club?.(club) ?? "Klubb";
  const comp = seg(pathname, "/career/competitions/");
  if (comp) return lookups.competition?.(comp) ?? "Tävling";
  // The staff hub's own sub-pages (StaffNav: Organisation · Rekrytering · Ansvar) are not a staff member's profile.
  const staff = seg(pathname, "/career/staff/");
  if (staff) return staff === "recruitment" ? "Rekrytering" : staff === "responsibilities" ? "Ansvar" : "Profil";
  if (pathname.startsWith("/career/media/press/")) return "Presskonferens";
  if (pathname.startsWith("/career/media/story/")) return "Artikel";
  if (pathname.startsWith("/career/fixtures/") || pathname.startsWith("/career/match-day/")) return "Match";
  if (pathname.startsWith("/career/match-report/")) return "Matchrapport";
  if (pathname.startsWith("/career/analysis/")) return "Detalj";
  if (pathname.startsWith("/career/club/")) return "Detalj";
  return null;
}

export function buildBreadcrumb(pathname: string, lookups: CrumbLookups = {}): Crumb[] {
  const { hub, navId } = resolveHubRoute(pathname);
  const tab = CAREER_NAV_ITEMS.find((i) => i.id === navId);
  if (!hub || !tab) {
    const loose = LOOSE.find((l) => pathname.startsWith(l.prefix));
    return loose ? [loose.parent, { label: loose.label }] : [{ label: "Idag", href: "/career" }];
  }
  const crumbs: Crumb[] = [{ label: hub.label, href: hubHref(hub) }];
  const isLanding = hubTabs(hub)[0]?.id === tab.id;
  const onTab = pathname === tab.href;
  if (!isLanding || !onTab) crumbs.push({ label: tab.label, href: tab.href });
  if (!onTab) {
    const detail = detailLabel(pathname, lookups);
    if (detail) crumbs.push({ label: detail });
  }
  // The last crumb is the current page: never a link to itself.
  const last = crumbs[crumbs.length - 1]!;
  crumbs[crumbs.length - 1] = { label: last.label };
  return crumbs;
}

/** Phone: only the parent crumb, as a back link ('‹ Trupp'); null on a hub landing page. */
export function parentCrumb(crumbs: readonly Crumb[]): Crumb | null {
  return crumbs.length > 1 ? crumbs[crumbs.length - 2]! : null;
}
