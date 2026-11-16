// Arena Nights C5.1 -- ENT-08a "Command palette (⌘K)": grouped results over real career data.
// Pure: Sidor (every primary destination + hubs), Spelare / Klubbar / Tävlingar (the existing
// management search), Åtgärder (navigate-only shortcuts -- the palette never mutates the career).
// Prefixes: "@" players, "#" clubs, ">" actions.
import type { CareerState } from "./types";
import { CAREER_NAV_ITEMS } from "./navigation";
import { CAREER_HUBS, hubHref, hubOfNavId } from "./hubs";
import { searchManagement } from "./management";
import { availableHubHref, routeAccess } from "./clubAccess";

export type PaletteGroup = "Sidor" | "Spelare" | "Klubbar" | "Tävlingar" | "Åtgärder";
export interface PaletteItem { id: string; group: PaletteGroup; label: string; context: string; href: string }

export const PALETTE_GROUP_ORDER: readonly PaletteGroup[] = ["Sidor", "Åtgärder", "Spelare", "Klubbar", "Tävlingar"];

/** Navigate-only actions: each opens the screen where the manager performs it (no side effects here). */
export const PALETTE_ACTIONS: readonly PaletteItem[] = [
  { id: "act:lineup", group: "Åtgärder", label: "Sätt matchtruppen och laguppställningen", context: "Laget › Taktik", href: "/career/tactics" },
  { id: "act:defence", group: "Åtgärder", label: "Ändra försvarssystem (6-0, 5-1, 3-2-1)", context: "Laget › Taktik", href: "/career/tactics" },
  { id: "act:training", group: "Åtgärder", label: "Planera träningsveckan", context: "Laget › Träning", href: "/career/training" },
  { id: "act:contracts", group: "Åtgärder", label: "Förläng kontrakt", context: "Laget › Kontrakt", href: "/career/contracts" },
  { id: "act:compare", group: "Åtgärder", label: "Jämför spelare", context: "Laget › Kontrakt", href: "/career/compare" },
  { id: "act:scout", group: "Åtgärder", label: "Skicka ut en scout", context: "Rekrytering › Scouting", href: "/career/scouting" },
  { id: "act:bid", group: "Åtgärder", label: "Lägg bud / erbjud avtal", context: "Rekrytering › Transfers", href: "/career/transfers" },
  { id: "act:tired", group: "Åtgärder", label: "Visa trötta och skadade spelare", context: "Laget › Medicinskt", href: "/career/medical" },
  { id: "act:press", group: "Åtgärder", label: "Svara på presskonferenser", context: "Karriär › Media", href: "/career/media" },
  { id: "act:board", group: "Åtgärder", label: "Möt styrelsen", context: "Klubben › Styrelsen", href: "/career/board" },
  { id: "act:jobs", group: "Åtgärder", label: "Se lediga tränarjobb", context: "Karriär", href: "/career/manager" },
  { id: "act:save", group: "Åtgärder", label: "Sparade karriärer", context: "Spelet", href: "/load-game" },
];

function pages(state: CareerState): PaletteItem[] {
  // Employment states: a hub lands on its first page he may open (none at all for Laget/Klubben without a club).
  const hubs = CAREER_HUBS.flatMap((h): PaletteItem[] => { const href = availableHubHref(state, h) ?? hubHref(h); return [{ id: `hub:${h.id}`, group: "Sidor", label: h.label, context: "Hubb", href }]; });
  const items = CAREER_NAV_ITEMS.map((i): PaletteItem => ({ id: `page:${i.id}`, group: "Sidor", label: i.label, context: hubOfNavId(i.id)?.label ?? "Spelet", href: i.href }));
  return [...hubs, ...items];
}

const norm = (t: string) => t.toLocaleLowerCase("sv").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Ranked, grouped results. Empty query: pages + actions (the caller adds recents). */
export function paletteResults(state: CareerState, raw: string, limitPerGroup = 6): PaletteItem[] {
  const q = raw.trim();
  const prefix = q[0];
  const scope = prefix === "@" ? "Spelare" : prefix === "#" ? "Klubbar" : prefix === ">" ? "Åtgärder" : undefined;
  const rawTerm = scope ? q.slice(1).trim() : q;
  const term = norm(rawTerm);
  const score = (label: string) => { const n = norm(label); return n.startsWith(term) ? 0 : n.split(/\s+/).some((w) => w.startsWith(term)) ? 1 : n.includes(term) ? 2 : -1; };
  const rank = (items: PaletteItem[]) => items.map((i) => ({ i, s: term ? score(i.label) : 0 })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s || a.i.label.localeCompare(b.i.label, "sv")).map((x) => x.i);
  const out: PaletteItem[] = [];
  const add = (g: PaletteGroup, items: PaletteItem[]) => { if (!scope || scope === g) out.push(...rank(items).slice(0, limitPerGroup)); };
  // Pages: dedupe hub landing pages that equal their first tab's label.
  const seen = new Set<string>();
  add("Sidor", pages(state).filter((p) => { const k = `${p.label}|${p.href}`; if (seen.has(k)) return false; seen.add(k); return true; }));
  add("Åtgärder", [...PALETTE_ACTIONS]);
  if (term.length >= 2) {
    const found = searchManagement(state, rawTerm);
    add("Spelare", found.filter((r) => r.kind === "Spelare").map((r) => ({ id: `player:${r.id}`, group: "Spelare" as const, label: r.label, context: r.context, href: r.href })));
    add("Klubbar", found.filter((r) => r.kind === "Klubb").map((r) => ({ id: `club:${r.id}`, group: "Klubbar" as const, label: r.label, context: r.context, href: r.href })));
    add("Tävlingar", found.filter((r) => r.kind === "Tävling").map((r) => ({ id: `comp:${r.id}`, group: "Tävlingar" as const, label: r.label, context: r.context, href: r.href })));
  }
  // Without a club, nothing club-internal is offered (the route guard would refuse it anyway).
  return PALETTE_GROUP_ORDER.flatMap((g) => out.filter((i) => i.group === g && routeAccess(state, i.href).allowed));
}
