// HM-ALPHA3 release readiness: a visual identity per competition -- one
// accent colour pair and a small native-SVG emblem each, so the leagues,
// the SM-slutspel, kval and Svenska cupen read as different things at a
// glance. Generic marks; no federation or sponsor artwork.
import type { CSSProperties } from "react";
import { ALLSVENSKAN, HANDBOLLSLIGAN, KVAL_ALLSVENSKAN, KVAL_HBL, SM_SLUTSPEL, SVENSKA_CUPEN } from "@/lib/competition/rules";

export type CompetitionKey = "HBL" | "ALLSV" | "SM" | "KVAL" | "CUP";

export interface CompetitionIdentity {
  key: CompetitionKey;
  name: string;
  /** Strong colour: emblem field, section rule, bracket lines. */
  accent: string;
  /** Second colour for the emblem glyph and highlights. */
  glyph: string;
  /** Text colour on `accent`. */
  ink: string;
}

export const COMPETITION_IDENTITY: Record<CompetitionKey, CompetitionIdentity> = {
  HBL: { key: "HBL", name: "Handbollsligan", accent: "#142538", glyph: "#e8553a", ink: "#f8f3e9" },
  ALLSV: { key: "ALLSV", name: "Allsvenskan", accent: "#2f6343", glyph: "#cfe5c4", ink: "#f8f3e9" },
  SM: { key: "SM", name: "SM-slutspel", accent: "#1b1405", glyph: "#e0b23c", ink: "#f6e7b8" },
  KVAL: { key: "KVAL", name: "Kval", accent: "#8a4b12", glyph: "#f2c27a", ink: "#fff4e3" },
  CUP: { key: "CUP", name: "Svenska cupen", accent: "#1d4f91", glyph: "#f2c230", ink: "#f8f3e9" },
};

export function competitionKeyOf(competitionId: string): CompetitionKey {
  if (competitionId === SM_SLUTSPEL) return "SM";
  if (competitionId === KVAL_HBL || competitionId === KVAL_ALLSVENSKAN) return "KVAL";
  if (competitionId === SVENSKA_CUPEN) return "CUP";
  if (competitionId === ALLSVENSKAN) return "ALLSV";
  if (competitionId === HANDBOLLSLIGAN) return "HBL";
  return "HBL";
}

/** CSS custom properties a section or card uses to take on a competition's colours. */
export function competitionStyle(key: CompetitionKey): CSSProperties {
  const c = COMPETITION_IDENTITY[key];
  return { "--comp-accent": c.accent, "--comp-glyph": c.glyph, "--comp-ink": c.ink } as CSSProperties;
}

const GLYPHS: Record<CompetitionKey, React.ReactNode> = {
  // a handball: circle with two seams
  HBL: <><circle cx="20" cy="20" r="8.5" fill="none" strokeWidth="2.4" /><path d="M11.8 17.5c4.5 1.6 11.9 1.6 16.4 0M11.8 22.5c4.5-1.6 11.9-1.6 16.4 0" fill="none" strokeWidth="1.8" /></>,
  // a handball over a single chevron: the second tier
  ALLSV: <><circle cx="20" cy="17" r="6.5" fill="none" strokeWidth="2.2" /><path d="M13 28l7-4 7 4" fill="none" strokeWidth="2.4" strokeLinejoin="round" /></>,
  // a cup with two handles
  SM: <><path d="M14 11h12v4.5a6 6 0 0 1-12 0z" strokeWidth="0" /><path d="M14 13h-3a3 3 0 0 0 3 4.5M26 13h3a3 3 0 0 1-3 4.5" fill="none" strokeWidth="1.8" /><path d="M18.6 21.5h2.8v4h-2.8zM15 26.5h10v2.5H15z" strokeWidth="0" /></>,
  // up and down arrows: promotion and relegation decided head to head
  KVAL: <><path d="M15 25V13m-4 4 4-4 4 4" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M25 15v12m-4-4 4 4 4-4" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></>,
  // a star over a short base: the cup
  CUP: <><path d="m20 9.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" strokeWidth="0" /><path d="M14 29h12" fill="none" strokeWidth="2.4" strokeLinecap="round" /></>,
};

/** The emblem: a shield field in the accent colour with the competition's glyph. */
export function CompetitionMark({ competition, size = 40, title }: { competition: CompetitionKey; size?: number; title?: string }) {
  const c = COMPETITION_IDENTITY[competition];
  return (
    <svg className="ss-mark" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={title ?? c.name}>
      <path d="M20 2.5 35 7v12.5c0 9-6.2 15.4-15 18-8.8-2.6-15-9-15-18V7z" fill={c.accent} stroke={c.glyph} strokeWidth="1.2" />
      <g fill={c.glyph} stroke={c.glyph}>{GLYPHS[competition]}</g>
    </svg>
  );
}
