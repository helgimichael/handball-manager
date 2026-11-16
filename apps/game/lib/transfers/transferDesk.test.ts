// Arena Nights 231 -- Transfer Desk view model: URL state round-trips, one table with three views, readiness
// mirrors the real start guards only, sell impact from real depth, and never any hidden ability.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { getCareerSquad } from "../career/careerWorld";
import { addToShortlist } from "../career/recruitment";
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { getTransferFinance } from "./transferCentre";
import { runNegotiationAction } from "./negotiationIntegration";
import {
  budgetWaterfall, buildMarketTable, dealReadiness, daysUntilAnswer, DEFAULT_DESK_QUERY, deskHref, deskSearch, describeView,
  farewellFacts, parseDeskQuery, roleContext, saleMoney, sellBids, sellImpact, termGap, type DeskQuery,
} from "./transferDesk";

let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("transfer-desk", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}
const params = (s: string) => new URLSearchParams(s.replace(/^\?/, ""));

test("desk URL state: defaults are omitted, every field round-trips, junk falls back", () => {
  assert.equal(deskSearch(DEFAULT_DESK_QUERY), "");
  const q: DeskQuery = { mode: "kop", view: "kortlista", pos: "V9", q: "  Ek ", interest: "ALL", expiring: true, target: "p1" };
  const back = parseDeskQuery(params(deskSearch(q)));
  assert.deepEqual(back, { ...q, q: "Ek" });
  assert.deepEqual(parseDeskQuery(params("mode=x&view=y&pos=ZZ&interest=nope")), DEFAULT_DESK_QUERY);
  assert.equal(parseDeskQuery(params("target=abc")).target, "abc");
  assert.equal(deskHref({ mode: "salj" }), "/career/transfers?mode=salj");
  assert.equal(describeView(q), "Kortlista · V9 · utgående · alla mål · \"Ek\"");
});

test("budget waterfall: frame = free + committed; a pending deal is drawn on top of what is left", () => {
  const s = career();
  const finance = getTransferFinance(s)!;
  const w = budgetWaterfall(s, { upFrontEur: 1000, wageEurPerMonth: 200 })!;
  assert.equal(w.frameEur, finance.transferBudgetEur + finance.committedEur);
  assert.equal(w.remainingEur, finance.transferBudgetEur);
  assert.equal(w.afterPendingEur, finance.transferBudgetEur - 1000);
  assert.equal(w.wageRoomAfterEurPerMonth, Math.round(finance.wageRoomEurPerMonth) - 200);
});

test("one market table, three views; filters apply to every view; Kortlista is the recruitment shortlist", () => {
  let s = career();
  const all = buildMarketTable(s, { ...DEFAULT_DESK_QUERY, view: "marknad", interest: "ALL" });
  assert.ok(all.rows.length > 0);
  assert.ok(all.rows.every((r) => r.player.clubId !== s.playerClubId));
  const v9 = buildMarketTable(s, { ...DEFAULT_DESK_QUERY, view: "marknad", interest: "ALL", pos: "V9" });
  assert.ok(v9.rows.every((r) => r.player.position === "V9"));
  const expiring = buildMarketTable(s, { ...DEFAULT_DESK_QUERY, view: "marknad", interest: "ALL", expiring: true });
  assert.ok(expiring.rows.every((r) => r.contractStatus === "FREE_AGENT" || r.contractStatus === "EXPIRING" || r.contractStatus === "EXPIRING_SOON"));
  const target = all.rows[0]!.player;
  assert.equal(buildMarketTable(s, { ...DEFAULT_DESK_QUERY, view: "kortlista", interest: "ALL" }).rows.length, 0);
  s = addToShortlist(s, target.id, s.gameDate);
  const kort = buildMarketTable(s, { ...DEFAULT_DESK_QUERY, view: "kortlista", interest: "ALL" });
  assert.deepEqual(kort.rows.map((r) => r.player.id), [target.id]);
  assert.equal(kort.counts.kortlista, 1);
  assert.ok(kort.rows[0]!.shortlisted);
  // Value is a knowledge-gated range, never a single hidden figure unless knowledge is complete.
  for (const r of all.rows.slice(0, 20)) if (r.value) assert.ok(r.value.min <= r.value.max);
});

test("deal readiness blocks only on real start guards and agrees with the negotiation rules", () => {
  const s = career();
  const own = getCareerSquad(s)[0]!;
  const ownReady = dealReadiness(s, own.id)!;
  assert.equal(ownReady.own, true);
  assert.equal(ownReady.canNegotiate, false);
  assert.equal(ownReady.canLoan, false);
  const rows = buildMarketTable(s, { ...DEFAULT_DESK_QUERY, view: "marknad", interest: "ALL" }).rows;
  for (const r of rows.slice(0, 40)) {
    const ready = dealReadiness(s, r.player.id)!;
    const started = runNegotiationAction(s, { kind: "START", playerId: r.player.id, dealType: "PERMANENT" });
    assert.equal(ready.canNegotiate, started.ok, `${r.player.id}: readiness ${ready.canNegotiate} vs rules ${started.ok}`);
    if (!ready.canNegotiate) assert.ok(ready.blockedReason && ready.blockedReason.length > 0);
    for (const item of ready.items) if (item.key === "budget" || item.key === "window" || item.key === "knowledge") assert.notEqual(item.status, "blocked");
  }
});

test("term gap and role context", () => {
  const fmt = (n: number) => `${n} €`;
  assert.deepEqual(termGap(8000, 10000, fmt), { gap: 2000, label: "Skiljer 2000 €", met: false });
  assert.equal(termGap(10000, 10000, fmt)!.label, "Möts");
  assert.equal(termGap(12000, 10000, fmt)!.met, true);
  assert.equal(termGap(1, undefined, fmt), null);
  const s = career();
  const p = getCareerSquad(s)[0]!;
  const ctx = roleContext(s, p.position);
  assert.equal(Object.values(ctx).reduce((a, b) => a + b, 0), getCareerSquad(s).filter((x) => x.position === p.position && s.playerSquadStatus[x.id]).length);
});

test("waiting days list each day up to the answer with the Week Spine's pins", () => {
  const s = career();
  const days = daysUntilAnswer(s, addDays(s.gameDate, 4));
  assert.equal(days.length, 4);
  assert.equal(days.at(-1)!.isAnswerDay, true);
  assert.equal(days[0]!.date, addDays(s.gameDate, 1));
  assert.equal(daysUntilAnswer(s, s.gameDate).length, 0);
  assert.equal(daysUntilAnswer(s, addDays(s.gameDate, 40)).length, 10);
});

test("sell side: impact removes exactly the sold player; bids sort answer-first; money and farewell are real", () => {
  const s = career();
  const p = getCareerSquad(s)[0]!;
  const impact = sellImpact(s, p.id)!;
  assert.equal(impact.before.total - impact.after.total, 1);
  assert.equal(impact.position, p.position);
  const offer = { id: "bid-1", playerId: p.id, fromClubId: "x", foreign: false, openedOn: s.gameDate, feeEur: 5000, wageEurPerMonth: 1000, contractYears: 2, maxFeeEur: 9000, status: "OPEN", respondBy: addDays(s.gameDate, 3), rounds: [], motive: "" } as unknown as NonNullable<CareerState["incomingOffers"]>[string];
  const later = { ...offer, id: "bid-2", status: "COUNTERED", respondBy: addDays(s.gameDate, 1) } as typeof offer;
  const withBids = { ...s, incomingOffers: { [later.id]: later, [offer.id]: offer } } as CareerState;
  const bids = sellBids(withBids);
  assert.deepEqual(bids.map((b) => b.offer.id), ["bid-1", "bid-2"]);
  assert.equal(bids[0]!.needsAnswer, true);
  assert.equal(bids[0]!.daysLeft, 3);
  const money = saleMoney(withBids, offer);
  assert.equal(money.feeEur, 5000);
  assert.equal(money.wageSavedEur, money.wageEurPerMonth * money.monthsLeft);
  const bye = farewellFacts(withBids, offer);
  assert.equal(bye.name, `${p.firstName} ${p.lastName}`);
  assert.match(bye.fillGapHref, new RegExp(`pos=${p.position}`));
  assert.match(bye.fillGapHref, /view=marknad/);
});

test("the desk never reads hidden ability: no CA/PA in the model or the desk components", () => {
  const files = [
    "./transferDesk.ts",
    "../../components/transfers/MarketTable.tsx",
    "../../components/transfers/DealDrawer.tsx",
    "../../components/transfers/TermSheet.tsx",
    "../../app/career/transfers/page.tsx",
  ];
  for (const f of files) {
    const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
    assert.doesNotMatch(src, /currentAbility|potentialAbility|caOf\(|\.ca\b|\.pa\b/, f);
  }
});
