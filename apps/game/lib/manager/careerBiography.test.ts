// Arena Nights MGR-01 / MGR-01a: biography chapters and the annotated reputation line.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ManagerCareerState } from "../board/types";
import { buildCareerBiography, monogram, reputationStanding, timeFraction } from "./careerBiography";

function career(): ManagerCareerState {
  return {
    reputation: 41,
    contract: { startDate: "2027-07-01", endDate: "2029-06-30", wageEurPerMonth: 4000 } as ManagerCareerState["contract"],
    stints: [
      { clubId: "a", from: "2026-07-01", to: "2027-02-10", leftReason: "DISMISSED", reputationAtStart: 30, reputationAtEnd: 26, competitionId: "swe-2", seasons: [{ seasonId: "2026/27", competitionId: "swe-2", position: 12, objectivesScore: 0.2, honours: [], partial: true }] },
      { clubId: "b", from: "2027-03-01", reputationAtStart: 26, seasons: [{ seasonId: "2027/28", competitionId: "swe-2", position: 1, objectivesScore: 1, honours: ["Uppflyttning"] }] },
    ],
    vacancies: [], applications: {}, offers: {},
    milestones: [
      { date: "2026-07-01", kind: "APPOINTED", text: "Tog över A.", clubId: "a" },
      { date: "2027-02-10", kind: "DISMISSED", text: "A sparkade dig.", clubId: "a" },
      { date: "2027-03-01", kind: "APPOINTED", text: "Tog över B.", clubId: "b" },
      { date: "2028-05-20", kind: "PROMOTION", text: "B upp i Handbollsligan.", clubId: "b" },
    ],
    reputationLog: [
      { date: "2027-02-10", delta: -4, after: 26, reason: "Sparkad mitt i säsongen", clubId: "a" },
      { date: "2028-05-20", delta: 15, after: 41, reason: "Uppflyttning", clubId: "b" },
    ],
  };
}

test("reputation line starts before the first change and merges same-day milestones", () => {
  const bio = buildCareerBiography(career(), "2028-08-01");
  assert.equal(bio.startReputation, 30);
  const dismissed = bio.points.find((p) => p.kind === "DISMISSED")!;
  assert.equal(dismissed.delta, -4);
  assert.equal(dismissed.value, 26);
  assert.equal(dismissed.milestone, "A sparkade dig.");
  assert.equal(dismissed.text, "Sparkad mitt i säsongen");
  assert.equal(bio.points.filter((p) => p.kind === "REPUTATION").length, 0, "both changes merged into their milestones");
  assert.deepEqual(bio.points.map((p) => p.value), [30, 26, 26, 41]);
});

test("chapters are newest first with opening, closing and reputation in/out", () => {
  const bio = buildCareerBiography(career(), "2028-08-01");
  assert.deepEqual(bio.chapters.map((c) => c.clubId), ["b", "a"]);
  const [b, a] = bio.chapters;
  assert.equal(b!.open, true);
  assert.equal(b!.number, 2);
  assert.equal(b!.reputationOut, 41);
  assert.deepEqual(b!.honours, ["Uppflyttning"]);
  assert.equal(a!.closing, "A sparkade dig.");
  assert.equal(a!.opening, "Tog över A.");
  assert.equal(a!.reputationIn, 30);
  assert.equal(a!.reputationOut, 26);
  assert.equal(bio.sparse, false);
  assert.equal(bio.bands.at(-1)!.to, "2028-08-01");
});

test("a brand-new career is sparse and helpers are stable", () => {
  const fresh: ManagerCareerState = { ...career(), stints: [{ clubId: "a", from: "2026-07-01", seasons: [] }], milestones: [{ date: "2026-07-01", kind: "APPOINTED", text: "Tog över A.", clubId: "a" }], reputationLog: [], reputation: 30 };
  const bio = buildCareerBiography(fresh, "2026-08-01");
  assert.equal(bio.sparse, true);
  assert.equal(bio.startReputation, 30);
  assert.equal(timeFraction(bio, bio.firstDate), 0);
  assert.equal(timeFraction(bio, bio.lastDate), 1);
  assert.equal(monogram("IFK Kristianstad"), "IK");
  assert.equal(monogram("Tumba"), "TU");
  assert.equal(reputationStanding(56), "Respekterad i Handbollsligan");
});
