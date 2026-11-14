// Arena Nights Phase 2 -- player dossier model: own-player gating, development over time, risks, purity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { ensureBoard } from "../board/board";
import { ensureManagerCareer } from "../manager/managerCareer";
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { buildPlayerDossier } from "./playerDossier";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2", "se_handbollsligan_herr"];
    const squads = Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c)));
    const s = createNewCareerState("dossier", "swe2-tumba", squads, undefined, ratings, staff);
    base = JSON.stringify(ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

test("own player: identity data, rating-derived profile, readiness and contract; pure", () => {
  const s = career();
  const before = hash(s);
  const id = s.worldSquads[s.playerClubId]![0]!.id;
  const d = buildPlayerDossier(s, id)!;
  assert.equal(d.own, true);
  assert.ok(d.families.length >= 4, "attribute families from the stored rating");
  assert.equal(d.strengths.length, 5);
  assert.equal(d.weaknesses.length, 3);
  assert.ok(d.strengths[0]!.value >= d.weaknesses[0]!.value);
  assert.ok(d.readiness && d.readiness.energy >= 0 && d.readiness.energy <= 100);
  assert.equal(d.contract!.endDate, s.playerContracts[id]!.contractEndDate);
  assert.equal(d.matches.length, 0, "a fresh career has no archived matches -- nothing is invented");
  assert.equal(d.development.points.length, 0);
  assert.equal(hash(s), before);
  assert.deepEqual(buildPlayerDossier(s, id), d, "deterministic");
});

test("external player: no rating-derived attributes, no readiness, no wage or squad role (knowledge gating stays with the scouting views)", () => {
  const s = career();
  const other = Object.keys(s.worldSquads).find((c) => c !== s.playerClubId && (s.worldSquads[c]?.length ?? 0) > 0)!;
  const id = s.worldSquads[other]![0]!.id;
  const d = buildPlayerDossier(s, id)!;
  assert.equal(d.own, false);
  assert.deepEqual(d.families, []);
  assert.deepEqual(d.strengths, []);
  assert.equal(d.rating, null);
  assert.equal(d.readiness, null);
  assert.equal(d.contract?.role ?? null, null);
  assert.deepEqual(d.contract?.risks ?? [], []);
  assert.equal(d.contract?.offers ?? 0, 0);
});

test("development over time: stored history becomes a chronological timeline, net progression per attribute and source split", () => {
  const s = career();
  const id = s.worldSquads[s.playerClubId]![1]!.id;
  const d0 = s.gameDate;
  const history = [
    { date: addDays(d0, 21), attribute: "PASSING", previousValue: 12, newValue: 13, sourceSummary: "Training: TECHNICAL stimulus" },
    { date: addDays(d0, 14), attribute: "STRENGTH", previousValue: 10, newValue: 9, sourceSummary: "Match exposure" },
    { date: addDays(d0, 7), attribute: "PASSING", previousValue: 11, newValue: 12, sourceSummary: "Training: TECHNICAL stimulus" },
  ];
  const withDev: CareerState = { ...s, playerDevelopmentState: { ...s.playerDevelopmentState, [id]: { ...(s.playerDevelopmentState[id] ?? { playerId: id, attributeStimulus: {} }), developmentHistory: history } as never } };
  const d = buildPlayerDossier(withDev, id)!;
  assert.deepEqual(d.development.points.map((p) => p.date), [addDays(d0, 7), addDays(d0, 14), addDays(d0, 21)], "oldest first");
  const passing = d.development.progression.find((p) => p.attribute === "PASSING")!;
  assert.deepEqual([passing.first, passing.last, passing.changes], [11, 13, 2]);
  assert.equal(d.development.progression[0]!.attribute, "PASSING", "biggest gain first");
  assert.deepEqual(d.development.sources, { training: 2, match: 1, other: 0 });
  assert.ok(d.milestones.some((m) => /Största utvecklingen/.test(m.text)));
});

test("contract risks come from stored state (expiry, request, pre-contract, bids)", () => {
  const s = career();
  const id = s.worldSquads[s.playerClubId]![2]!.id;
  const soon: CareerState = { ...s, playerContracts: { ...s.playerContracts, [id]: { ...s.playerContracts[id]!, contractEndDate: addDays(s.gameDate, 60) } } };
  const d = buildPlayerDossier(soon, id)!;
  assert.equal(d.contract!.daysLeft, 60);
  assert.ok(d.contract!.risks.some((r) => r.tone === "neg" && /60 dagar/.test(r.text)));
});
