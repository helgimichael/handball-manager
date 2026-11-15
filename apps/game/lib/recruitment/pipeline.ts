// Arena Nights Phase 3 -- REC-02 C unified pipeline board. A pure arrangement of the Recruitment Centre's
// existing candidates (lib/career/recruitment.ts) into one funnel. Knowledge-gated: it only ever reads the
// candidate's visible star RANGES and report view -- never CA/PA. Squad need comes from the shared depth model.
import type { RecruitmentCandidate, RecruitmentPriority } from "../career/recruitment";
import type { DepthSpot } from "../club/clubJournal";
import type { HandballPosition } from "../game-data/types";

export type LaneId = "DISCOVERED" | "SCOUTING" | "SCOUTED" | "SHORTLIST" | "NEGOTIATING" | "CLOSED";
export interface Lane { id: LaneId; label: string; hint: string; insight: string; items: PipelineItem[] }
export interface PipelineItem { candidate: RecruitmentCandidate; fillsNeed: "GAP" | "THIN" | null }

export const LANE_ORDER: { id: LaneId; label: string; hint: string }[] = [
  { id: "DISCOVERED", label: "Upptäckt", hint: "Spelare dina scouter och rapporter har hittat." },
  { id: "SCOUTING", label: "Scoutas", hint: "Ett scoutuppdrag pågår – osäkerheten minskar." },
  { id: "SCOUTED", label: "Rapport", hint: "Bedömningen är klar. Kortlista den som passar." },
  { id: "SHORTLIST", label: "Kortlista", hint: "Dina mål, rankade efter prioritet." },
  { id: "NEGOTIATING", label: "Förhandling", hint: "Bud och avtal som pågår." },
  { id: "CLOSED", label: "Klar", hint: "Avslutade affärer." },
];
const PRIORITY_RANK: Record<RecruitmentPriority, number> = { TOP: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

export function laneOf(c: RecruitmentCandidate): LaneId {
  switch (c.recruitmentStatus) {
    case "SHORTLISTED": case "PRIORITIZED": return "SHORTLIST";
    default: return c.recruitmentStatus;
  }
}

/** The squad's needs by position: GAP = no available natural player, THIN = one. */
export function squadNeeds(depth: readonly DepthSpot[]): Map<HandballPosition, "GAP" | "THIN"> {
  const needs = new Map<HandballPosition, "GAP" | "THIN">();
  for (const d of depth) if (d.tone === "bad") needs.set(d.position, "GAP"); else if (d.tone === "warn") needs.set(d.position, "THIN");
  return needs;
}

export function buildPipeline(candidates: readonly RecruitmentCandidate[], depth: readonly DepthSpot[]): Lane[] {
  const needs = squadNeeds(depth);
  const lanes: Lane[] = LANE_ORDER.map((l) => ({ ...l, insight: "", items: [] }));
  const byId = new Map(lanes.map((l) => [l.id, l]));
  for (const candidate of candidates) byId.get(laneOf(candidate))!.items.push({ candidate, fillsNeed: needs.get(candidate.position) ?? null });
  for (const lane of lanes) {
    lane.items.sort((a, b) =>
      (lane.id === "SHORTLIST" ? PRIORITY_RANK[a.candidate.priority] - PRIORITY_RANK[b.candidate.priority] : 0) ||
      Number(!!b.fillsNeed) - Number(!!a.fillsNeed) ||
      b.candidate.knowledgePct - a.candidate.knowledgePct ||
      a.candidate.lastName.localeCompare(b.candidate.lastName, "sv"));
    const n = lane.items.length;
    const needCount = lane.items.filter((i) => i.fillsNeed).length;
    lane.insight =
      n === 0 ? "Tomt" :
      lane.id === "SCOUTING" ? `${lane.items.filter((i) => i.candidate.activeAssignment).length} uppdrag pågår` :
      lane.id === "SCOUTED" ? `${lane.items.filter((i) => i.candidate.hasCompletedReport).length} rapporter klara` :
      lane.id === "SHORTLIST" ? `${lane.items.filter((i) => i.candidate.priority === "TOP" || i.candidate.priority === "HIGH").length} högt prioriterade` :
      needCount ? `${needCount} fyller en lucka` : `${n} spelare`;
  }
  return lanes;
}
