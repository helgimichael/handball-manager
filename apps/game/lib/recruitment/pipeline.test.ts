// Arena Nights Phase 3 -- REC-02 C: candidates land in exactly one lane, need tags come from depth, CA/PA never read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RecruitmentCandidate } from "../career/recruitment";
import type { DepthSpot } from "../club/clubJournal";
import { buildPipeline, LANE_ORDER, laneOf } from "./pipeline";

const c = (id: string, status: RecruitmentCandidate["recruitmentStatus"], extra: Partial<RecruitmentCandidate> = {}) => ({ playerId: id, firstName: "A", lastName: id, position: "V6", knowledgePct: 50, priority: "NORMAL", activeAssignment: false, hasCompletedReport: false, recruitmentStatus: status, ...extra }) as RecruitmentCandidate;
const depth = (tones: Record<string, DepthSpot["tone"]>) => Object.entries(tones).map(([position, tone]) => ({ position, tone })) as DepthSpot[];

test("every candidate in exactly one lane; shortlist ranks by priority; need tags follow the squad's depth", () => {
  const list = [c("a", "DISCOVERED"), c("b", "SHORTLISTED", { priority: "LOW" }), c("c", "PRIORITIZED", { priority: "TOP" }), c("d", "NEGOTIATING"), c("e", "SCOUTING", { activeAssignment: true, position: "MV" }), c("f", "SCOUTED", { hasCompletedReport: true })];
  const lanes = buildPipeline(list, depth({ V6: "bad", MV: "warn", M9: "good" }));
  assert.deepEqual(lanes.map((l) => l.id), LANE_ORDER.map((l) => l.id));
  assert.equal(lanes.reduce((n, l) => n + l.items.length, 0), list.length);
  for (const x of list) assert.equal(lanes.filter((l) => l.items.some((i) => i.candidate.playerId === x.playerId)).length, 1);
  assert.equal(laneOf(list[1]!), "SHORTLIST");
  assert.deepEqual(lanes.find((l) => l.id === "SHORTLIST")!.items.map((i) => i.candidate.playerId), ["c", "b"]);
  assert.equal(lanes.find((l) => l.id === "DISCOVERED")!.items[0]!.fillsNeed, "GAP");
  assert.equal(lanes.find((l) => l.id === "SCOUTING")!.items[0]!.fillsNeed, "THIN");
  assert.equal(lanes.find((l) => l.id === "SCOUTING")!.insight, "1 uppdrag pågår");
  assert.equal(lanes.find((l) => l.id === "CLOSED")!.insight, "Tomt");
});

test("the board never reads hidden ability: no CA/PA in the model or the component", () => {
  for (const f of ["./pipeline.ts", "../../components/recruitment/PipelineBoard.tsx"]) {
    const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
    assert.doesNotMatch(src, /currentAbility|potentialAbility|\.ca\b|\.pa\b/);
  }
});
