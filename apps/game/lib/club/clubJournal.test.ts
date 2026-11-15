// Arena Nights Phase 3 -- Club Journal and position depth: real data only, ranked attention, pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { getCareerSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import { clubJournal, COURT_POSITIONS, positionDepth } from "./clubJournal";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("club-journal", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

test("position depth: every court position, counts from the real squad, tone from available naturals", () => {
  const s = career();
  const squad = getCareerSquad(s);
  const depth = positionDepth(s, squad);
  assert.deepEqual(depth.map((d) => d.position), [...COURT_POSITIONS]);
  for (const d of depth) {
    assert.equal(d.total, squad.filter((p) => p.position === d.position).length);
    assert.equal(d.tone, d.available >= 2 ? "good" : d.available === 1 ? "warn" : "bad");
    assert.ok(d.cover.every((c) => !d.natural.some((n) => n.id === c.id)), "cover never double-counts a natural");
  }
  // Making every natural V6 unavailable turns the spot into a gap; others are unchanged.
  const v6 = squad.filter((p) => p.position === "V6").map((p) => p.id);
  const injured = { ...s, playerStatuses: { ...s.playerStatuses, ...Object.fromEntries(v6.map((id) => [id, { ...(s.playerStatuses[id] ?? {}), availability: "INJURED" }])) } } as unknown as CareerState;
  const after = positionDepth(injured, squad).find((d) => d.position === "V6")!;
  assert.equal(after.available, 0);
  assert.equal(after.tone, "bad");
});

test("club journal: live season last in the history, briefs ranked by need, nothing invented, pure", () => {
  const s = career();
  const before = hash(s);
  const j = clubJournal(s);
  assert.equal(hash(s), before);
  assert.equal(j.history.at(-1)!.current, true);
  assert.equal(j.history.at(-1)!.seasonId, s.seasonId);
  assert.equal(j.history.at(-1)!.position, null, "no position before any match is played");
  const order = { bad: 0, warn: 1, neutral: 2, good: 3 } as const;
  for (let i = 1; i < j.briefs.length; i++) assert.ok(order[j.briefs[i - 1]!.tone] <= order[j.briefs[i]!.tone]);
  assert.ok(j.briefs.some((b) => b.id === "squad") && j.briefs.some((b) => b.id === "contracts"));
  if (j.kpis) assert.ok(j.revenueMix.every((r) => r.eur > 0));
});
