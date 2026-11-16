// Arena Nights MGR-01 C / MGR-01a B: the manager's career as a biography.
// Pure view model over the existing ManagerCareerState -- reputation log,
// milestones and stints become one reputation line with annotated turning
// points and one chapter per club stint. Reads only; never changes career data.
import type { ManagerCareerState, ManagerMilestone, ManagerStint, ManagerStintSeason, ReputationChange } from "../board/types";

export type BiographyEventKind = ManagerMilestone["kind"] | "REPUTATION";

/** One point on the career reputation line: an explained reputation change or a milestone placed on the line. */
export interface ReputationPoint {
  id: string;
  date: string;
  /** Reputation after this point. */
  value: number;
  /** Reputation change at this point (0 for milestones without a recorded change). */
  delta: number;
  kind: BiographyEventKind;
  /** The recorded reason (reputation log) or the milestone text. */
  text: string;
  clubId?: string;
  /** A reputation change and a milestone on the same day are merged; this is the milestone's text. */
  milestone?: string;
}

export interface ChapterBand {
  clubId: string;
  from: string;
  to: string;
  open: boolean;
}

export interface BiographyChapter {
  id: string;
  /** 1-based, oldest first. */
  number: number;
  clubId: string;
  from: string;
  to?: string;
  open: boolean;
  /** Why the chapter began (APPOINTED milestone text), when recorded. */
  opening: string | null;
  /** Why the chapter ended, in plain Swedish. */
  closing: string | null;
  leftReason?: ManagerStint["leftReason"];
  competitionId?: string;
  reputationIn: number | null;
  reputationOut: number | null;
  seasons: ManagerStintSeason[];
  honours: string[];
  /** Milestones inside the stint, newest first. */
  events: ManagerMilestone[];
}

export interface CareerBiography {
  reputation: number;
  /** "Respekterad i Handbollsligan" etc. */
  standing: string;
  /** Reputation before the first recorded change. */
  startReputation: number;
  points: ReputationPoint[];
  bands: ChapterBand[];
  /** Newest first. */
  chapters: BiographyChapter[];
  /** Fewer than two turning points: show "Ditt första kapitel". */
  sparse: boolean;
  firstDate: string;
  lastDate: string;
}

export function reputationStanding(r: number): string {
  return r >= 75 ? "Ett av landets stora namn" : r >= 55 ? "Respekterad i Handbollsligan" : r >= 38 ? "Etablerad tränare" : r >= 25 ? "Ett namn på uppgång" : "Okänd för de flesta";
}

export function leftReasonLabel(r?: ManagerStint["leftReason"]): string | null {
  return r === "DISMISSED" ? "Sparkad" : r === "NEW_JOB" ? "Lämnade för ett nytt jobb" : r === "CONTRACT_ENDED" ? "Avtalet gick ut" : r === "RESIGNED" ? "Avgick" : null;
}

/** Two initials from a display name (clubs and managers alike). */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
}

const MILESTONE_ORDER: Record<ManagerMilestone["kind"], number> = { APPOINTED: 0, CONTRACT: 1, REVIEW: 2, PROMOTION: 3, TITLE: 4, CUP: 5, RELEGATION: 6, DISMISSED: 7, RESIGNED: 8 };

export function buildCareerBiography(mc: ManagerCareerState, today: string): CareerBiography {
  const log: ReputationChange[] = [...(mc.reputationLog ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const firstStint = mc.stints[0];
  const startReputation = log.length ? log[0]!.after - log[0]!.delta : firstStint?.reputationAtStart ?? mc.reputation;

  // Merge the explained changes and the milestones into one dated sequence.
  type Raw = { date: string; order: number; change?: ReputationChange; milestone?: ManagerMilestone };
  const raw: Raw[] = [
    ...log.map((change) => ({ date: change.date, order: 10, change })),
    ...mc.milestones.map((milestone) => ({ date: milestone.date, order: MILESTONE_ORDER[milestone.kind], milestone })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  const points: ReputationPoint[] = [];
  let value = startReputation;
  raw.forEach((r, i) => {
    if (r.change) {
      value = r.change.after;
      // A same-day milestone already on the line takes the reputation change as its own.
      const same = points.at(-1);
      if (same && same.date === r.date && same.kind !== "REPUTATION" && same.delta === 0) {
        same.delta = r.change.delta;
        same.value = value;
        same.milestone = same.text;
        same.text = r.change.reason;
        return;
      }
      points.push({ id: `rep-${i}`, date: r.date, value, delta: r.change.delta, kind: "REPUTATION", text: r.change.reason, clubId: r.change.clubId });
    } else if (r.milestone) {
      points.push({ id: `ms-${i}`, date: r.date, value, delta: 0, kind: r.milestone.kind, text: r.milestone.text, clubId: r.milestone.clubId });
    }
  });

  const bands: ChapterBand[] = mc.stints.map((s) => ({ clubId: s.clubId, from: s.from, to: s.to ?? today, open: !s.to }));

  const chapters: BiographyChapter[] = mc.stints.map((s, i) => {
    const end = s.to ?? "9999-12-31";
    const events = mc.milestones.filter((m) => m.clubId === s.clubId && m.date >= s.from && m.date <= end);
    const appointed = events.find((m) => m.kind === "APPOINTED");
    const leaving = [...events].reverse().find((m) => m.kind === "DISMISSED" || m.kind === "RESIGNED");
    return {
      id: `${s.clubId}:${s.from}`,
      number: i + 1,
      clubId: s.clubId,
      from: s.from,
      to: s.to,
      open: !s.to,
      opening: appointed?.text ?? null,
      closing: s.to ? leaving?.text ?? leftReasonLabel(s.leftReason) : null,
      leftReason: s.leftReason,
      competitionId: s.competitionId ?? s.seasons[0]?.competitionId,
      reputationIn: s.reputationAtStart ?? null,
      reputationOut: s.to ? s.reputationAtEnd ?? null : mc.reputation,
      seasons: s.seasons,
      honours: s.seasons.flatMap((x) => x.honours),
      events: [...events].reverse(),
    };
  }).reverse();

  const dates = [...points.map((p) => p.date), ...bands.map((b) => b.from), today].sort();
  return {
    reputation: mc.reputation,
    standing: reputationStanding(mc.reputation),
    startReputation,
    points,
    bands,
    chapters,
    sparse: points.filter((p) => p.kind !== "APPOINTED").length < 2,
    firstDate: dates[0] ?? today,
    lastDate: today > (dates.at(-1) ?? today) ? today : dates.at(-1) ?? today,
  };
}

/** Days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Position of a date on the line, 0..1. */
export function timeFraction(bio: Pick<CareerBiography, "firstDate" | "lastDate">, date: string): number {
  const span = Math.max(1, daysBetween(bio.firstDate, bio.lastDate));
  return Math.max(0, Math.min(1, daysBetween(bio.firstDate, date) / span));
}
