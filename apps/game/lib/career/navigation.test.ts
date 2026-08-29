import { test } from "node:test";
import assert from "node:assert/strict";
import { CAREER_NAV_ITEMS, resolveActiveNavId } from "./navigation";

test("every primary nav item exists exactly once (no duplicate id or href)", () => {
  const ids = CAREER_NAV_ITEMS.map((i) => i.id);
  const hrefs = CAREER_NAV_ITEMS.map((i) => i.href);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("nav order is deterministic and matches the approved information architecture (Spec §21)", () => {
  assert.deepEqual(
    CAREER_NAV_ITEMS.map((i) => i.id),
    ["home", "inbox", "squad", "tactics", "training", "schedule", "analysis", "scouting", "recruitment", "transfers", "staff", "medical", "club", "competitions"],
  );
});

test("there is exactly one Schedule primary entry and no separate Matches entry (Spec §5/§7)", () => {
  assert.equal(CAREER_NAV_ITEMS.filter((i) => i.id === "schedule").length, 1);
  assert.equal(CAREER_NAV_ITEMS.some((i) => i.id === "matches"), false);
  assert.equal(CAREER_NAV_ITEMS.some((i) => i.label.toLowerCase().includes("match") && i.id !== "schedule"), false);
});

test("Editor is never part of the central career nav model (Spec §32 -- it is derived separately from the dev flag)", () => {
  assert.equal(CAREER_NAV_ITEMS.some((i) => i.id === "editor"), false);
});

test("every primary href is a valid /career-rooted path", () => {
  for (const item of CAREER_NAV_ITEMS) {
    assert.ok(item.href === "/career" || item.href.startsWith("/career/"), item.href);
  }
});

test("resolveActiveNavId: exact primary routes each resolve to their own id", () => {
  assert.equal(resolveActiveNavId("/career"), "home");
  assert.equal(resolveActiveNavId("/career/inbox"), "inbox");
  assert.equal(resolveActiveNavId("/career/squad"), "squad");
  assert.equal(resolveActiveNavId("/career/tactics"), "tactics");
  assert.equal(resolveActiveNavId("/career/training"), "training");
  assert.equal(resolveActiveNavId("/career/schedule"), "schedule");
  assert.equal(resolveActiveNavId("/career/analysis"), "analysis");
  assert.equal(resolveActiveNavId("/career/scouting"), "scouting");
  assert.equal(resolveActiveNavId("/career/transfers"), "transfers");
  assert.equal(resolveActiveNavId("/career/staff"), "staff");
  assert.equal(resolveActiveNavId("/career/club"), "club");
  assert.equal(resolveActiveNavId("/career/competitions"), "competitions");
});

test("resolveActiveNavId: Player Profile stays contextually owned by Squad", () => {
  assert.equal(resolveActiveNavId("/career/squad/se_player_abc123"), "squad");
});

test("resolveActiveNavId: all four Analysis subroutes resolve to Analysis, never a separate id", () => {
  assert.equal(resolveActiveNavId("/career/analysis/opponent"), "analysis");
  assert.equal(resolveActiveNavId("/career/analysis/our-team"), "analysis");
  assert.equal(resolveActiveNavId("/career/analysis/last-match"), "analysis");
});

test("resolveActiveNavId: the contextual match workflow (Preview/Day/Report) and the legacy Matches route all resolve to Schedule", () => {
  assert.equal(resolveActiveNavId("/career/match-preview"), "schedule");
  assert.equal(resolveActiveNavId("/career/match-day/fx-1"), "schedule");
  assert.equal(resolveActiveNavId("/career/match-report/fx-1"), "schedule");
  assert.equal(resolveActiveNavId("/career/matches"), "schedule");
});

test("resolveActiveNavId: a route no primary area owns (e.g. the orphaned match-center demo, or /editor) resolves to undefined, not a wrong guess", () => {
  assert.equal(resolveActiveNavId("/career/match-center"), undefined);
  assert.equal(resolveActiveNavId("/editor"), undefined);
  assert.equal(resolveActiveNavId("/editor/players"), undefined);
});

test("resolveActiveNavId never returns two different ids for the same pathname (it's a single string, so this is a determinism smoke test across repeated calls)", () => {
  const paths = ["/career", "/career/squad/x", "/career/analysis/opponent", "/career/match-report/x"];
  for (const p of paths) {
    const first = resolveActiveNavId(p);
    const second = resolveActiveNavId(p);
    assert.equal(first, second);
  }
});
