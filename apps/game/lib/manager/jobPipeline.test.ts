// Arena Nights MGR-01b: the job market as an application pipeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ManagerCareerState, Vacancy } from "../board/types";
import type { CandidateAssessment } from "./managerCareer";
import { buildJobPipeline, jobFit } from "./jobPipeline";

const assess = (clubId: string): CandidateAssessment => ({ reputation: 40, need: clubId === "big" ? 60 : 38, experiencePoints: clubId === "near" ? -6 : 2, parts: [{ label: "erfarenhet", points: 2 }] });
const vacancies: Vacancy[] = [
  { clubId: "open", openedOn: "2027-01-01", closesOn: "2027-01-20", reason: "Tränaren sparkad" },
  { clubId: "iv", openedOn: "2027-01-01", closesOn: "2027-01-25", reason: "Tränaren slutade" },
  { clubId: "big", openedOn: "2027-01-01", closesOn: "2027-01-15", reason: "Ny ambition" },
];
function mc(): ManagerCareerState {
  return {
    reputation: 40, contract: {} as ManagerCareerState["contract"], stints: [], vacancies, milestones: [],
    applications: {
      a1: { id: "a1", clubId: "iv", appliedOn: "2027-01-05", status: "INTERVIEW", interviewOn: "2027-01-06", questions: [] },
      a2: { id: "a2", clubId: "waiting", appliedOn: "2026-12-20", status: "ANSWERED", interviewOn: "2026-12-21", questions: [], decisionOn: "2027-01-12" },
      a3: { id: "a3", clubId: "off", appliedOn: "2026-12-01", status: "OFFERED", interviewOn: "2026-12-02", questions: [] },
      a4: { id: "a4", clubId: "no", appliedOn: "2026-11-01", status: "REJECTED", interviewOn: "2026-11-02", questions: [], decisionOn: "2026-11-10" },
    },
    offers: {
      o1: { id: "o1", clubId: "off", offeredOn: "2026-12-05", expiresOn: "2027-01-14", wageEurPerMonth: 3000, years: 2, source: "APPLICATION", pitch: "Vi vill ha dig.", status: "OPEN" },
      o2: { id: "o2", clubId: "old", offeredOn: "2026-10-01", expiresOn: "2026-10-10", wageEurPerMonth: 3000, years: 2, source: "APPROACH", pitch: "", status: "DECLINED" },
    },
  };
}

test("cards land in the right stage and an applied club leaves Lediga", () => {
  const p = buildJobPipeline(mc(), vacancies, "2027-01-10", assess);
  const ids = (s: string) => p.stages.find((x) => x.id === s)!.cards.map((c) => c.clubId);
  assert.deepEqual(ids("OPEN"), ["big", "open"], "sorted by deadline; iv moved on");
  assert.deepEqual(ids("INTERVIEW"), ["iv"]);
  assert.deepEqual(ids("APPLIED"), ["waiting"]);
  assert.deepEqual(ids("OFFER"), ["off"], "the offered application continues as its offer");
  assert.deepEqual(ids("DECIDED").sort(), ["no", "old"]);
  assert.equal(p.needsAction, 2, "interview + offer");
});

test("expired open offers are decided, not actionable", () => {
  const p = buildJobPipeline(mc(), vacancies, "2027-01-16", assess);
  assert.equal(p.stages.find((s) => s.id === "OFFER")!.cards.length, 0);
  assert.ok(p.stages.find((s) => s.id === "DECIDED")!.cards.some((c) => c.clubId === "off" && c.status === "Gick ut"));
});

test("fit uses reputation + experience against stature", () => {
  assert.equal(jobFit(assess("open")).level, "STRONG");
  assert.equal(jobFit(assess("near")).level, "CLOSE");
  assert.equal(jobFit(assess("big")).level, "STRETCH");
  assert.match(jobFit(assess("big")).factors[0]!, /rykte 40 mot jobbets nivå 60/);
});
