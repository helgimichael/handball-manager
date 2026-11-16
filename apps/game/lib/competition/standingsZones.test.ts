// Arena Nights Phase 3 -- CMP-01a A: zones follow the verified rules exactly; movement and gaps are read-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALLSVENSKAN, HANDBOLLSLIGAN } from "./rules";
import { zoneFor } from "./standingsZones";

test("Handbollsligan: 1-8 SM-slutspel, 11-13 kval, 14 relegated, 9-10 nothing", () => {
  const z = (p: number) => zoneFor(HANDBOLLSLIGAN, p)?.id ?? null;
  for (let p = 1; p <= 8; p++) assert.equal(z(p), "TITLE_PLAYOFF");
  assert.equal(z(9), null); assert.equal(z(10), null);
  for (const p of [11, 12, 13]) assert.equal(z(p), "RELEGATION_KVAL");
  assert.equal(z(14), "RELEGATION");
});

test("Allsvenskan: 1 promoted, 2-4 kval up, 11-12 kval to stay, 13-14 relegated; other leagues have no zones", () => {
  const z = (p: number) => zoneFor(ALLSVENSKAN, p)?.id ?? null;
  assert.equal(z(1), "PROMOTION");
  for (const p of [2, 3, 4]) assert.equal(z(p), "PROMOTION_KVAL");
  for (let p = 5; p <= 10; p++) assert.equal(z(p), null);
  for (const p of [11, 12]) assert.equal(z(p), "RELEGATION_KVAL");
  for (const p of [13, 14]) assert.equal(z(p), "RELEGATION");
  assert.equal(zoneFor("se_division1_norra", 1), null);
});
