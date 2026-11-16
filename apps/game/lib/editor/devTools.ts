// Arena Nights SYS-02 (A) "Dev console home": the one list of internal developer tools.
//
// Every tool here sits behind the same server gate (lib/editor/env.ts isEditorEnabled():
// HM_EDITOR_ENABLED=true and NODE_ENV !== "production"); each route's own server layout
// enforces it with notFound(). This module only describes the tools for the dev shell's
// navigation and the console home -- it grants nothing. Pure: no React, no fetch.

export type DevToolGroup = "data" | "labs" | "debug";

export interface DevTool {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly group: DevToolGroup;
  readonly description: string;
  /** Single key that opens the tool from the console home (no modifiers, never while typing). */
  readonly shortcut: string;
}

export const DEV_TOOL_GROUP_LABEL: Record<DevToolGroup, string> = {
  data: "Data",
  labs: "Motorlabb",
  debug: "Felsökning",
};

export const DEV_CONSOLE_HREF = "/editor";

export const DEV_TOOLS: readonly DevTool[] = [
  { id: "players", label: "Spelare", href: "/editor/players", group: "data", shortcut: "1", description: "Kalibrera HBL- och Allsvenskan-spelare direkt i tabellen." },
  { id: "ratings", label: "Betyg", href: "/editor/ratings", group: "data", shortcut: "2", description: "Granska betygsförslag, överstyr attribut och lås spelare." },
  { id: "court-grid", label: "Court grid", href: "/editor/court-grid", group: "data", shortcut: "3", description: "Kalibrera den kanoniska 40×20 m-planen." },
  { id: "scenario-lab", label: "Scenario lab", href: "/scenario-lab", group: "labs", shortcut: "4", description: "Motor V2: mittkast med replay, hashar och sparade scenarier." },
  { id: "scenario-core", label: "Labb · anfall & omställning", href: "/scenario-lab/core", group: "labs", shortcut: "5", description: "Motor V2: bollinnehav och omställning i stegläge." },
  { id: "scenario-match", label: "Labb · helmatch", href: "/scenario-lab/match", group: "labs", shortcut: "6", description: "Motor V2: hel match med tidslinje för mänsklig QA." },
  { id: "match-qa", label: "Match 2D QA", href: "/match-qa", group: "labs", shortcut: "7", description: "Spela dev-scenarier genom den riktiga motorn med växlar." },
  { id: "cpu-recruitment", label: "CPU-rekrytering", href: "/editor/cpu-recruitment", group: "debug", shortcut: "8", description: "Varför CPU-klubbar rekryterar: behov, pursuits och beslutslogg i aktiv karriär." },
];

const DEV_ROUTE_ROOTS = ["/editor", "/scenario-lab", "/match-qa"] as const;

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** True for every route that renders inside the dev shell (and so never shows the global DEV ribbon). */
export function isDevRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return DEV_ROUTE_ROOTS.some((root) => matches(pathname, root));
}

/** The tool `pathname` belongs to: longest matching href wins, so /scenario-lab/core is never "Scenario lab". */
export function activeDevTool(pathname: string | null | undefined): DevTool | undefined {
  if (!pathname) return undefined;
  let best: DevTool | undefined;
  for (const tool of DEV_TOOLS) {
    if (matches(pathname, tool.href) && (!best || tool.href.length > best.href.length)) best = tool;
  }
  return best;
}

export function devToolForShortcut(key: string): DevTool | undefined {
  return DEV_TOOLS.find((tool) => tool.shortcut === key);
}

export interface DevCatalogClub {
  readonly clubId: string;
  readonly competitionId: string;
  readonly nation: string;
  readonly playerCount: number;
}

export interface DevDataCounts {
  readonly nations: number;
  readonly competitions: number;
  readonly clubs: number;
  readonly players: number;
}

/** The console's data counts, from the real editor catalog (/api/editor/catalog). */
export function devDataCounts(clubs: readonly DevCatalogClub[]): DevDataCounts {
  return {
    nations: new Set(clubs.map((entry) => entry.nation)).size,
    competitions: new Set(clubs.map((entry) => entry.competitionId)).size,
    clubs: clubs.length,
    players: clubs.reduce((sum, entry) => sum + entry.playerCount, 0),
  };
}
