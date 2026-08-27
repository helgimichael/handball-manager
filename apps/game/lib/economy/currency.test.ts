// HM-CONTRACTS-1.0A: the one currency display boundary -- formatEur/eurToSek.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eurToSek, formatEur, EUR_TO_SEK_REFERENCE_RATE } from "./currency";

test("(1) formatEur renders a EUR amount with the euro sign, no decimals", () => {
  const formatted = formatEur(450_000);
  assert.match(formatted, /€/);
  assert.doesNotMatch(formatted, /[.,]\d{2}\s*€/); // no cent fractions
});

test("(2) formatEur(0) renders a plain zero, never a crash or NaN", () => {
  const formatted = formatEur(0);
  assert.match(formatted, /0/);
  assert.doesNotMatch(formatted, /NaN/);
});

test("(3) eurToSek multiplies by the fixed reference rate and rounds to a whole number", () => {
  assert.equal(eurToSek(1000), 1000 * EUR_TO_SEK_REFERENCE_RATE);
  assert.equal(eurToSek(0), 0);
  assert.ok(Number.isInteger(eurToSek(1234.56)));
});

test("(4) eurToSek is a pure, deterministic conversion", () => {
  assert.equal(eurToSek(50_000), eurToSek(50_000));
});
