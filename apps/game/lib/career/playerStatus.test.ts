import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlayer } from "../game-data";
import { isAvailable, resolveStatusLabel, seedPlayerStatuses } from "./playerStatus";

test("seedPlayerStatuses maps the mock squad's Skadad/Avstängd into INJURED/SUSPENDED with a return date", () => {
  const statuses = seedPlayerStatuses("2026-08-19");
  const holmgren = statuses["p-holmgren"]; // squadStatus: "Skadad" in the mock squad
  assert.ok(holmgren);
  assert.equal(holmgren.availability, "INJURED");
  assert.ok(holmgren.returnDate);
  assert.equal(isAvailable(statuses, "p-holmgren"), false);
});

test("players without a mock injury/suspension are seeded AVAILABLE", () => {
  const statuses = seedPlayerStatuses("2026-08-19");
  const anyAvailablePlayer = Object.values(statuses).find((s) => s.availability === "AVAILABLE");
  assert.ok(anyAvailablePlayer);
  assert.equal(isAvailable(statuses, anyAvailablePlayer!.playerId), true);
});

test("resolveStatusLabel reflects a live recovery even though the static mock still says Skadad", () => {
  const statuses = seedPlayerStatuses("2026-08-19");
  const player = getPlayer("p-holmgren")!;
  assert.equal(resolveStatusLabel(statuses, player), "Skadad");

  const recovered = { ...statuses, "p-holmgren": { playerId: "p-holmgren", availability: "AVAILABLE" as const } };
  assert.equal(resolveStatusLabel(recovered, player), "Förstaval");
});
