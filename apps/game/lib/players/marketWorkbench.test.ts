// Arena Nights -- SQD-03 market workbench model: fog of war, filters, band-midpoint sort, presets, purity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import { buildMarketRows, describeMarketFilter, EMPTY_MARKET_FILTER, filterMarket, marketPresets, saveMarketSearch, sortMarket } from "./marketWorkbench";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2", "se_handbollsligan_herr"];
    const squads = Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c)));
    base = JSON.stringify(createNewCareerState("market", "swe2-tumba", squads, undefined, ratings, staff));
  }
  return JSON.parse(base) as CareerState;
}

test("market rows: external players only, knowledge-gated ranges, no true CA/PA, pure", () => {
  const s = career();
  const before = hash(s);
  const rows = buildMarketRows(s);
  assert.ok(rows.length > 50);
  assert.ok(rows.every((r) => r.clubId !== s.playerClubId));
  for (const r of rows.slice(0, 40)) {
    assert.equal("ca" in r || "pa" in r, false);
    if (r.ability) assert.ok(r.ability.min >= 1 && r.ability.max <= 5 && r.ability.min <= r.ability.max);
    if (r.tier === "MINIMAL" || r.tier === "LOW") assert.equal(r.potential, null, "potential hidden below MEDIUM knowledge");
  }
  const lowKnow = rows.find((r) => r.knowledge < 50 && r.value);
  if (lowKnow) assert.ok(lowKnow.value!.max > lowKnow.value!.min, "low knowledge gives a real value range");
  assert.equal(hash(s), before);
});

test("filters and band-midpoint sort", () => {
  const rows = buildMarketRows(career());
  const v6 = filterMarket(rows, { ...EMPTY_MARKET_FILTER, position: "V6" });
  assert.ok(v6.length > 0 && v6.every((r) => r.position === "V6" || r.secondaryPosition === "V6"));
  const young = filterMarket(rows, { ...EMPTY_MARKET_FILTER, maxAge: "21" });
  assert.ok(young.every((r) => r.age !== null && r.age <= 21));
  const sorted = sortMarket(rows, { key: "ability", direction: "desc" });
  const mids = sorted.map((r) => r.abilityMid).filter((m): m is number => m != null);
  for (let i = 1; i < mids.length; i++) assert.ok(mids[i - 1]! >= mids[i]!);
  assert.equal(filterMarket(rows, { ...EMPTY_MARKET_FILTER, minKnowledge: 101 }).length, 0);
});

test("presets come from squad depth; saved searches replace by name", () => {
  const presets = marketPresets(career());
  assert.ok(presets.some((p) => p.id === "expiring") && presets.some((p) => p.id === "young"));
  for (const p of presets.filter((x) => x.id.startsWith("need-"))) assert.notEqual(p.filter.position, "ALL");
  let saved = saveMarketSearch([], "Vänsternior", { ...EMPTY_MARKET_FILTER, position: "V9" });
  saved = saveMarketSearch(saved, "Vänsternior", { ...EMPTY_MARKET_FILTER, position: "V9", maxAge: "23" });
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.filter.maxAge, "23");
  assert.equal(saveMarketSearch(saved, "  ", EMPTY_MARKET_FILTER).length, 1);
  assert.match(describeMarketFilter(saved[0]!.filter), /V9/);
});
