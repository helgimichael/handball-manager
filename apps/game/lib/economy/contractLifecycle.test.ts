import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntilContractEnd, getContractStatus } from "./contractLifecycle";

test("daysUntilContractEnd is a plain whole-day count, positive for a future date", () => {
  assert.equal(daysUntilContractEnd("2026-09-19", "2026-08-19"), 31);
  assert.equal(daysUntilContractEnd("2026-08-19", "2026-08-19"), 0);
  assert.equal(daysUntilContractEnd("2026-08-01", "2026-08-19"), -18);
});

// (contract status) the four required buckets, boundary-exact.
test("getContractStatus resolves the four required buckets exactly at their boundaries", () => {
  const asOf = "2026-08-19";
  assert.equal(getContractStatus("2026-08-19", asOf), "FREE_AGENT"); // 0 days left
  assert.equal(getContractStatus("2026-08-01", asOf), "FREE_AGENT"); // already past
  assert.equal(getContractStatus("2027-02-14", asOf), "EXPIRING"); // 179 days
  assert.equal(getContractStatus("2027-02-15", asOf), "EXPIRING"); // 180 days -- boundary inclusive
  assert.equal(getContractStatus("2027-02-16", asOf), "EXPIRING_SOON"); // 181 days
  assert.equal(getContractStatus("2027-08-19", asOf), "EXPIRING_SOON"); // 365 days -- boundary inclusive
  assert.equal(getContractStatus("2027-08-20", asOf), "UNDER_CONTRACT"); // 366 days
  assert.equal(getContractStatus("2031-01-01", asOf), "UNDER_CONTRACT");
});

test("getContractStatus is deterministic and never crashes for a far-future date", () => {
  const a = getContractStatus("2099-01-01", "2026-08-19");
  const b = getContractStatus("2099-01-01", "2026-08-19");
  assert.equal(a, b);
  assert.equal(a, "UNDER_CONTRACT");
});
