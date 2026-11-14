// Arena Nights C5.1 -- ENT-07 (C) "Hub rail": the 27 primary destinations grouped into exactly six
// hubs, each with a contextual tab row. Pure data over CAREER_NAV_ITEMS: no route is removed or
// renamed, every legacy URL still resolves (to hub + tab), so muscle memory and deep links survive.
import type { NavIconName } from "@/components/NavIcon";
import { CAREER_NAV_ITEMS, resolveActiveNavId, type CareerNavItem } from "./navigation";

export type HubId = "idag" | "laget" | "klubben" | "rekrytering" | "tavling" | "karriar";

export interface CareerHub {
  id: HubId;
  label: string;
  /** Short label for the phone tab bar. */
  shortLabel: string;
  icon: NavIconName;
  /** Nav item ids, in tab order; the first is the hub's landing page. */
  tabs: readonly string[];
}

/** Mapping from the lab (ENT-07 A/C): Media sits with Karriär, Analys with Tävling (owner-visible decision in the report). */
export const CAREER_HUBS: readonly CareerHub[] = [
  { id: "idag", label: "Idag", shortLabel: "Idag", icon: "home", tabs: ["home", "inbox", "calendar", "schedule"] },
  { id: "laget", label: "Laget", shortLabel: "Laget", icon: "squad", tabs: ["squad", "tactics", "training", "medical", "contracts"] },
  { id: "klubben", label: "Klubben", shortLabel: "Klubben", icon: "club", tabs: ["klubbhuset", "club", "board", "finance", "staff"] },
  { id: "rekrytering", label: "Rekrytering", shortLabel: "Marknad", icon: "recruitment", tabs: ["recruitment", "players", "scouting", "transfers"] },
  { id: "tavling", label: "Tävling", shortLabel: "Tävling", icon: "competitions", tabs: ["season", "competitions", "cup", "statistics", "analysis"] },
  { id: "karriar", label: "Karriär", shortLabel: "Karriär", icon: "manager", tabs: ["manager", "history", "media"] },
];

/** Items outside the six hubs: always reachable from the rail foot (Inställningar). */
export const UTILITY_NAV_IDS = ["settings"] as const;

/** Phone bottom bar (ENT-07a): Idag · Laget · Tävling · Marknad · Mer (Klubben, Karriär, Inkorg, Inställningar, Spara live in the Mer sheet). */
export const MOBILE_TAB_HUBS: readonly HubId[] = ["idag", "laget", "tavling", "rekrytering"];

const byId = new Map(CAREER_NAV_ITEMS.map((i) => [i.id, i]));

export function hubTabs(hub: CareerHub): CareerNavItem[] {
  return hub.tabs.map((id) => byId.get(id)).filter((i): i is CareerNavItem => !!i);
}

export function hubOfNavId(navId: string | undefined): CareerHub | undefined {
  return navId ? CAREER_HUBS.find((h) => h.tabs.includes(navId)) : undefined;
}

/** Hub + tab for a pathname (exact href first, then owned prefixes -- the existing single-owner rule). */
export function resolveHubRoute(pathname: string): { hub?: CareerHub; navId?: string } {
  const navId = resolveActiveNavId(pathname);
  return { hub: hubOfNavId(navId), navId };
}

export function hubHref(hub: CareerHub): string {
  return byId.get(hub.tabs[0]!)!.href;
}
