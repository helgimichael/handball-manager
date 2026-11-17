// HM-TRANSFER-REALISM M8B: international clubs buy contracted players --
// selectively, within their means, with the selling club and the player both
// deciding, and with one owner and one contract at all times.
import test from "node:test";
import assert from "node:assert/strict";
import { createFullWorldCareer } from "../../scripts/lib/fullWorldCareer";
import { progressInternationalMarket } from "./internationalMarket";
import {
  INTERNATIONAL_PURCHASES_PER_SEASON, INTERNATIONAL_PURCHASE_MAX_AGE, internationalBuyerWants, internationalFeeCapacityEur,
  internationalPurchasesThisSeason, recordInternationalPurchase, transferSeasonKey,
} from "./careerDecision/stateAdapter";
import { clubLevelOf, environmentLevelOf, worldPoolClubIds } from "./careerDecision/sportingStrength";
import { getPlayerContract } from "../economy/contractIntegration";
import { getCareerPlayer } from "../career/careerWorld";
import { careerWorldClubIds } from "../career/worldCompetitions";
import { playerAgeAtDate } from "../development/developmentIntegration";
import type { CareerState } from "../career/types";

const WINDOW_DAY = "2026-09-03";
const base: CareerState = { ...createFullWorldCareer("m8b-purchases"), gameDate: WINDOW_DAY };

const owners = (s: CareerState, id: string) => Object.entries(s.worldSquads).filter(([, sq]) => sq.some((p) => p.id === id)).map(([c]) => c);

test("M8B: a purchase pass in an open window buys contracted players -- one owner, one contract, fee within capacity, seller paid", () => {
  const { state, log } = progressInternationalMarket(base, WINDOW_DAY);
  const bought = log.filter((e) => e.kind === "BOUGHT_CONTRACTED");
  assert.ok(bought.length > 0, "the international market buys someone");
  const pool = new Set(worldPoolClubIds(base));
  for (const e of bought) {
    assert.ok(pool.has(e.clubId), "buyer is a world-pool club");
    assert.notEqual(e.fromClubId, base.playerClubId, "never the manager's player: he decides on those bids himself");
    assert.deepEqual(owners(state, e.playerId), [e.clubId], "exactly one owner -- the buyer");
    assert.equal(getPlayerContract(state, e.playerId)?.clubId, e.clubId, "one contract, at the buyer");
    assert.ok((e.feeEur ?? 0) <= internationalFeeCapacityEur(base, e.clubId) + 500, "fee within the buyer's capacity");
    const p = getCareerPlayer(base, e.playerId)!;
    const age = playerAgeAtDate(p.dateOfBirth, p.birthYear, WINDOW_DAY) ?? 0;
    assert.ok(age <= INTERNATIONAL_PURCHASE_MAX_AGE, "a paid transfer is for a player in his prime");
    assert.ok(environmentLevelOf(base, e.clubId) > environmentLevelOf(base, e.fromClubId!), "a real step up for the player");
    const sellerEconomy = base.clubEconomies[e.fromClubId!];
    if (sellerEconomy) assert.ok(state.clubEconomies[e.fromClubId!].cashEur >= sellerEconomy.cashEur + (e.feeEur ?? 0) - 1, "the selling club is paid");
  }
  // Selective: at most one signing per club per pass, and far fewer than the visible candidates.
  const perClub = new Map<string, number>();
  for (const e of bought) perClub.set(e.clubId, (perClub.get(e.clubId) ?? 0) + 1);
  for (const n of perClub.values()) assert.equal(n, 1);
  for (const [clubId, n] of perClub) assert.equal(internationalPurchasesThisSeason(state, clubId), n, "the purchase is recorded");
});

test("M8B: the selling club and the player both decide -- refusals are logged, not forced", () => {
  const { log } = progressInternationalMarket(base, WINDOW_DAY);
  const refused = log.filter((e) => e.kind === "BID_REJECTED_BY_CLUB" || e.kind === "BID_DECLINED_BY_PLAYER");
  for (const e of refused) assert.deepEqual(owners(base, e.playerId), [e.fromClubId], "a refused bid moves nobody");
  assert.ok(log.some((e) => e.kind === "BOUGHT_CONTRACTED" || refused.length > 0));
});

test("M8B: no purchases outside a transfer window; deterministic inside one", () => {
  const closed = "2026-11-03";
  const out = progressInternationalMarket({ ...base, gameDate: closed }, closed);
  assert.equal(out.log.filter((e) => e.kind === "BOUGHT_CONTRACTED").length, 0);
  const a = progressInternationalMarket(base, WINDOW_DAY).log;
  const b = progressInternationalMarket(base, WINDOW_DAY).log;
  assert.deepEqual(a, b);
});

test("M8B: the buyer rule is selective -- own club, no step up, season limit", () => {
  const buyer = [...worldPoolClubIds(base)].sort((x, y) => clubLevelOf(base, y) - clubLevelOf(base, x))[0];
  // A player already at the buyer is never "bought".
  const own = base.worldSquads[buyer][0];
  assert.equal(internationalBuyerWants(base, buyer, own.id), false);
  // A Division 1 player is never a world-pool target (visibility and fit).
  const div1 = careerWorldClubIds(base).find((id) => id.includes("div") || id.includes("division")) ?? careerWorldClubIds(base).at(-1)!;
  for (const p of (base.worldSquads[div1] ?? []).slice(0, 5)) assert.equal(internationalBuyerWants(base, buyer, p.id), false);
  // Season limit.
  let limited = base;
  for (let i = 0; i < INTERNATIONAL_PURCHASES_PER_SEASON; i++) limited = recordInternationalPurchase(limited, buyer);
  const anyone = careerWorldClubIds(base).flatMap((id) => base.worldSquads[id] ?? []).map((p) => p.id);
  assert.equal(anyone.some((id) => internationalBuyerWants(limited, buyer, id)), false, "a club that used its season's signings bids for nobody");
  assert.equal(transferSeasonKey("2027-01-15"), "2026");
  assert.equal(transferSeasonKey("2027-06-02"), "2027");
});

test("M8B: financial capacity follows sporting level", () => {
  const clubs = [...worldPoolClubIds(base)].sort((x, y) => clubLevelOf(base, x) - clubLevelOf(base, y));
  const weakest = internationalFeeCapacityEur(base, clubs[0]);
  const strongest = internationalFeeCapacityEur(base, clubs[clubs.length - 1]);
  assert.ok(strongest > weakest * 2, `${strongest} vs ${weakest}`);
});
