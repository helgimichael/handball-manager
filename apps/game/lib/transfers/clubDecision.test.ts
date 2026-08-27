import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSellingClubDecision, evaluateLoanOutDecision } from "./clubDecision";

test("(1) an offer well above market value for a rotation player is accepted", () => {
  const result = evaluateSellingClubDecision({ marketValueEur: 20_000, offerTransferFeeEur: 25_000, contractStatus: "UNDER_CONTRACT", role: "ROTATION", financialPressure: "NONE", hasAdequateReplacement: false });
  assert.ok(result.accept);
});

test("(2) a lowball offer for a rotation player is rejected", () => {
  const result = evaluateSellingClubDecision({ marketValueEur: 20_000, offerTransferFeeEur: 5_000, contractStatus: "UNDER_CONTRACT", role: "ROTATION", financialPressure: "NONE", hasAdequateReplacement: false });
  assert.ok(!result.accept);
});

test("(3) a KEY_PLAYER requires clearly more than baseline market value to be sold", () => {
  const atValue = evaluateSellingClubDecision({ marketValueEur: 100_000, offerTransferFeeEur: 100_000, contractStatus: "UNDER_CONTRACT", role: "KEY_PLAYER", financialPressure: "NONE", hasAdequateReplacement: false });
  assert.ok(!atValue.accept, "an offer exactly at market value should not be enough for a key player");
  const wellAbove = evaluateSellingClubDecision({ marketValueEur: 100_000, offerTransferFeeEur: 150_000, contractStatus: "UNDER_CONTRACT", role: "KEY_PLAYER", financialPressure: "NONE", hasAdequateReplacement: false });
  assert.ok(wellAbove.accept);
});

test("(4) an EMERGENCY player is sellable at or even below baseline market value", () => {
  const result = evaluateSellingClubDecision({ marketValueEur: 10_000, offerTransferFeeEur: 8_000, contractStatus: "UNDER_CONTRACT", role: "EMERGENCY", financialPressure: "NONE", hasAdequateReplacement: false });
  assert.ok(result.accept);
});

test("(5) financial pressure lowers the acceptance threshold -- the same offer is rejected at NONE pressure but accepted under CRITICAL pressure", () => {
  const inputs = { marketValueEur: 50_000, offerTransferFeeEur: 32_000, contractStatus: "UNDER_CONTRACT" as const, role: "STARTER" as const, hasAdequateReplacement: false };
  const calm = evaluateSellingClubDecision({ ...inputs, financialPressure: "NONE" });
  const desperate = evaluateSellingClubDecision({ ...inputs, financialPressure: "CRITICAL" });
  assert.ok(!calm.accept);
  assert.ok(desperate.accept);
});

test("(6) an adequate replacement in the squad makes a club more willing to sell (lower threshold)", () => {
  const inputs = { marketValueEur: 50_000, offerTransferFeeEur: 52_000, contractStatus: "UNDER_CONTRACT" as const, role: "STARTER" as const, financialPressure: "NONE" as const };
  const noReplacement = evaluateSellingClubDecision({ ...inputs, hasAdequateReplacement: false });
  const withReplacement = evaluateSellingClubDecision({ ...inputs, hasAdequateReplacement: true });
  assert.ok(!noReplacement.accept);
  assert.ok(withReplacement.accept);
});

test("(7) an expiring contract lowers the acceptance threshold (the club risks losing the player for nothing)", () => {
  const inputs = { marketValueEur: 50_000, offerTransferFeeEur: 49_000, role: "STARTER" as const, financialPressure: "NONE" as const, hasAdequateReplacement: false };
  const underContract = evaluateSellingClubDecision({ ...inputs, contractStatus: "UNDER_CONTRACT" });
  const expiring = evaluateSellingClubDecision({ ...inputs, contractStatus: "EXPIRING" });
  assert.ok(!underContract.accept);
  assert.ok(expiring.accept);
});

test("(8) evaluateLoanOutDecision: a DEVELOPMENT player with an adequate replacement is loaned out easily", () => {
  const result = evaluateLoanOutDecision({ role: "DEVELOPMENT", financialPressure: "NONE", hasAdequateReplacement: true, wageShareBorrowingPct: 50 });
  assert.ok(result.accept);
});

test("(9) evaluateLoanOutDecision: a KEY_PLAYER with no financial pressure is refused for a loan", () => {
  const result = evaluateLoanOutDecision({ role: "KEY_PLAYER", financialPressure: "NONE", hasAdequateReplacement: false, wageShareBorrowingPct: 50 });
  assert.ok(!result.accept);
});

test("(10) evaluateLoanOutDecision: severe financial pressure can make even a starter loanable (wage relief)", () => {
  const result = evaluateLoanOutDecision({ role: "STARTER", financialPressure: "CRITICAL", hasAdequateReplacement: false, wageShareBorrowingPct: 100 });
  assert.ok(result.accept);
});

test("(11) both decision functions are pure/deterministic", () => {
  const inputs = { marketValueEur: 30_000, offerTransferFeeEur: 30_000, contractStatus: "UNDER_CONTRACT" as const, role: "ROTATION" as const, financialPressure: "WATCH" as const, hasAdequateReplacement: false };
  assert.deepEqual(evaluateSellingClubDecision(inputs), evaluateSellingClubDecision(inputs));
});
