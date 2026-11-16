// Arena Nights -- SQD-05 contract timeline + SQD-02n renewal consequence preview: pure models over stored state.
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
import { getCareerSquad } from "../career/careerWorld";
import { isTransferWindowOpen } from "../transfers/transferWindow";
import { assessRenewalAffordability } from "../transfers/affordability";
import type { CareerState } from "../career/types";
import { buildContractTimeline, groupTimelineRows, seasonOf, sortTimelineRows } from "./contractTimeline";
import { renewalPreview } from "./renewalPreview";
import { openRenewalTalks, openTalkFor } from "./renewals";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2", "se_handbollsligan_herr"];
    const squads = Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c)));
    const s = createNewCareerState("contracts", "swe2-tumba", squads, undefined, ratings, staff);
    base = JSON.stringify(ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

test("season of a date uses the 1 July boundary", () => {
  assert.equal(seasonOf("2027-06-30"), "2026/27");
  assert.equal(seasonOf("2027-07-01"), "2027/28");
});

test("timeline: one row per squad player, bars inside the track, markers from existing rules; pure", () => {
  const s = career();
  const before = hash(s);
  const t = buildContractTimeline(s);
  assert.equal(hash(s), before, "read-only");
  const squad = getCareerSquad(s);
  assert.equal(t.rows.filter((r) => r.kind === "PLAYER").length, squad.length);
  for (const r of t.rows) {
    assert.ok(r.endPct >= 0 && r.endPct <= 100);
    if (r.zonePct !== null) assert.ok(r.zonePct <= r.endPct);
    if (r.endDate) assert.equal(r.expirySeason, seasonOf(r.endDate));
  }
  assert.ok(t.horizonEnd > t.today);
  assert.ok(t.seasons.length >= 1);
  for (const sz of t.seasons) assert.ok(sz.pct > 0 && sz.pct <= 100);
  assert.ok(t.windows.length >= 1, "a two-season horizon always crosses a transfer window");
  assert.equal(t.renewalZoneDays, 365);
  // A window marker starts on a day the existing rule calls open.
  for (const w of t.windows) assert.ok(w.startPct <= w.endPct);
  assert.ok(isTransferWindowOpen(t.windows[0]!.label.split(" ")[1]!));
  assert.ok(t.payroll.currentAnnualEur > 0);
  assert.equal(t.payroll.projectedAnnualEur, t.payroll.currentAnnualEur, "no open talks, nothing projected");
});

test("timeline projects an open renewal talk from its stored demand", () => {
  const start = career();
  let s = start;
  // First player whose talks open without an immediate refusal (a refusal is a valid outcome of the protected rule).
  const p = getCareerSquad(start).find((x) => {
    try { const n = openRenewalTalks(start, x.id, { kind: "MANAGER" }); const t = openTalkFor(n, x.id); if (t && !t.rounds.length) { s = n; return true; } } catch { /* blocked */ }
    return false;
  });
  assert.ok(p, "some squad player is willing to talk");
  const talk = openTalkFor(s, p.id)!;
  const t = buildContractTimeline(s);
  const r = t.payroll.renewals.find((x) => x.playerId === p.id)!;
  assert.equal(r.source, "DEMAND");
  assert.equal(r.toEurPerMonth, talk.demandEurPerMonth);
  assert.equal(t.payroll.projectedAnnualEur, t.payroll.currentAnnualEur + (talk.demandEurPerMonth - r.fromEurPerMonth) * 12);
  assert.equal(t.rows.find((x) => x.id === p.id)!.talk, "OPEN");
});

test("sort and group helpers", () => {
  const t = buildContractTimeline(career());
  const byEnd = sortTimelineRows(t.rows, "END");
  for (let i = 1; i < byEnd.length; i++) assert.ok((byEnd[i - 1]!.endDate ?? "") <= (byEnd[i]!.endDate ?? ""));
  const byWage = sortTimelineRows(t.rows, "WAGE");
  for (let i = 1; i < byWage.length; i++) assert.ok((byWage[i - 1]!.wageEurPerMonth ?? -1) >= (byWage[i]!.wageEurPerMonth ?? -1));
  const groups = groupTimelineRows(t.rows, "POSITION");
  assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), t.rows.length);
  const seasons = groupTimelineRows(t.rows, "SEASON").map((g) => g.key);
  assert.deepEqual(seasons, [...seasons].sort());
});

test("renewal preview: annual delta, payroll after, and the existing affordability verdict", () => {
  const s = career();
  const p = getCareerSquad(s)[0]!;
  const c = s.playerContracts[p.id]!;
  const before = hash(s);
  const same = renewalPreview(s, p.id, c.wageEurPerMonth)!;
  assert.equal(same.annualDeltaEur, 0);
  assert.equal(same.affordable, true);
  assert.equal(same.payrollAfterAnnualEur, same.payrollAnnualEur);
  const raise = renewalPreview(s, p.id, c.wageEurPerMonth + 500)!;
  assert.equal(raise.annualDeltaEur, 6000);
  assert.equal(raise.payrollAfterAnnualEur, raise.payrollAnnualEur + 6000);
  assert.equal(raise.affordable, assessRenewalAffordability(s, s.playerClubId, p.id, c.wageEurPerMonth + 500).affordable);
  const huge = renewalPreview(s, p.id, c.wageEurPerMonth + 10_000_000)!;
  assert.equal(huge.affordable, false);
  assert.ok(huge.reasons.length > 0);
  assert.ok(huge.bar.payrollPct + huge.bar.deltaPct <= 100.5);
  assert.equal(raise.demand, null, "no open talk, no demand");
  assert.equal(hash(s), before, "read-only");
});

test("renewal preview is null for a player outside the club", () => {
  const s = career();
  const external = Object.values(s.playerContracts).find((c) => c.clubId !== s.playerClubId)!;
  assert.equal(renewalPreview(s, external.playerId, 1000), null);
});
