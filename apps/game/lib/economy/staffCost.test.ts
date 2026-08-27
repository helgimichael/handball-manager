// HM-ECONOMY-1.0: pure staff cost estimation tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateStaffMonthlyCostEur } from "./staffCost";

test("(1) is deterministic -- identical inputs always produce the identical cost", () => {
  const member = { id: "staff-1", roles: ["HEAD_COACH" as const] };
  const a = estimateStaffMonthlyCostEur(member, "E6");
  const b = estimateStaffMonthlyCostEur(member, "E6");
  assert.equal(a, b);
});

test("(2) a HEAD_COACH costs more than a SCOUT in the same band", () => {
  const headCoach = estimateStaffMonthlyCostEur({ id: "hc-1", roles: ["HEAD_COACH" as const] }, "E5");
  const scout = estimateStaffMonthlyCostEur({ id: "sc-1", roles: ["SCOUT" as const] }, "E5");
  assert.ok(headCoach > scout, `headCoach=${headCoach} scout=${scout}`);
});

test("(3) a richer band costs strictly more than a poorer band for the identical role", () => {
  const rich = estimateStaffMonthlyCostEur({ id: "same-id", roles: ["HEAD_COACH" as const] }, "E1");
  const poor = estimateStaffMonthlyCostEur({ id: "same-id", roles: ["HEAD_COACH" as const] }, "E7");
  assert.ok(rich > poor, `rich=${rich} poor=${poor}`);
});

test("(4) a multi-role member costs more than a single-role member, but not a bare sum of both full rates", () => {
  const single = estimateStaffMonthlyCostEur({ id: "multi-1", roles: ["HEAD_COACH" as const] }, "E6");
  const multi = estimateStaffMonthlyCostEur({ id: "multi-1", roles: ["HEAD_COACH" as const, "ANALYST" as const] }, "E6");
  assert.ok(multi > single, `multi=${multi} single=${single}`);
  assert.ok(multi < single * 2, `multi=${multi} should be less than a bare double of single=${single}`);
});

test("(5) a member with no roles costs 0, never a crash", () => {
  const cost = estimateStaffMonthlyCostEur({ id: "no-role", roles: [] }, "E4");
  assert.equal(cost, 0);
});

test("(6) cost is always non-negative and finite across every role and band combination", () => {
  const roles = ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSICAL_COACH", "ANALYST", "PHYSIO", "SCOUT"] as const;
  const bands = ["E1", "E2", "E3", "E4", "E5", "E6", "E7"] as const;
  for (const role of roles) {
    for (const band of bands) {
      const cost = estimateStaffMonthlyCostEur({ id: `${role}-${band}`, roles: [role] }, band);
      assert.ok(Number.isFinite(cost) && cost >= 0, `role=${role} band=${band} cost=${cost}`);
    }
  }
});
