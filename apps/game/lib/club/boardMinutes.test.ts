// Arena Nights -- Board Minutes (CLB-05 C) and the meeting options (CLB-05b B): read-only over the real board.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { ensureBoard } from "../board/board";
import type { CareerState } from "../career/types";
import { boardMinutes, decisionOptions } from "./boardMinutes";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("board-minutes", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    const c = ensureSeasonCalendar(ensureClubFinances(s, s.gameDate));
    base = JSON.stringify(ensureBoard(c, c.gameDate));
  }
  return JSON.parse(base) as CareerState;
}

test("minutes: newest first, the season-start agenda is the first entry, no open decision on a calm board, pure", () => {
  const s = career();
  const before = hash(s);
  const m = boardMinutes(s);
  assert.equal(hash(s), before);
  assert.equal(m.entries.length, s.board!.meetings.length);
  assert.equal(m.entries.at(-1)!.kind, "SEASON_START");
  assert.equal(m.decision, null);
  assert.equal(m.verdictToday, null, "a season-start agenda is not a verdict");
  assert.equal(m.confidence, s.board!.confidence);
  assert.ok(m.objectives.length > 0);
  assert.ok(m.objectives.filter((o) => o.meter).length === 0, "no table meter before a game is played");
});

test("minutes: an unanswered warning is the open decision and its minute says so", () => {
  const s = career();
  const meeting = { id: `meeting:${s.gameDate}:warning`, date: s.gameDate, kind: "WARNING" as const, title: "Styrelsen varnar", summary: "Resultaten räcker inte.", verdict: "WARNING" as const };
  const warned: CareerState = { ...s, board: { ...s.board!, warnings: 1, meetings: [...s.board!.meetings, meeting] }, careerEvents: [...s.careerEvents, { id: `BOARD_UPDATE:${meeting.id}`, requiresAction: true, resolved: false } as never] };
  const m = boardMinutes(warned);
  assert.equal(m.decision?.kind, "RECOVERY");
  assert.equal(m.entries[0]!.open, true);
  assert.match(m.entries[0]!.response ?? "", /Obesvarat/);
  assert.equal(m.verdictToday?.id, meeting.id);
  const options = decisionOptions(m.decision!, (v) => `${v} €`);
  assert.deepEqual(options.map((o) => o.id), ["PLAN", "LATER"]);
  assert.ok(options[0]!.consequences.some((c) => c.includes("+6")));
});

test("meeting options: a contract offer previews years and the wage change", () => {
  const options = decisionOptions({ kind: "CONTRACT", years: 2, wageEurPerMonth: 5200, currentWageEurPerMonth: 5000, currentEndDate: "2028-05-31", expiresOn: "2027-06-30" }, (v) => `${v} €`);
  assert.deepEqual(options.map((o) => o.id), ["SIGN", "DECLINE"]);
  assert.ok(options[0]!.consequences.some((c) => c.includes("+200 €")));
  assert.ok(options[1]!.consequences.some((c) => c.includes("2028-05-31")));
});
