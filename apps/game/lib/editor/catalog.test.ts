import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCatalog, findClubById } from "./catalog";

const FIXTURE_ROOT = path.join(__dirname, "__fixtures__", "real-world");
const QC_FILE = path.join(FIXTURE_ROOT, "testnation", "2099-00", "testcomp", "Test Club HK", "qc-test.json");

test("buildCatalog discovers the fixture club via its manifest + qc files", () => {
  const catalog = buildCatalog(FIXTURE_ROOT);
  assert.equal(catalog.clubs.length, 1);
  const club = catalog.clubs[0];
  assert.equal(club.clubId, "test_club_fixture");
  assert.equal(club.clubName, "Test Club HK");
  assert.equal(club.competitionId, "test_competition");
  assert.equal(club.nation, "testnation");
  assert.equal(club.season, "2099-00");
  assert.equal(club.competitionSlug, "testcomp");
  assert.equal(club.playerCount, 2);
  assert.ok(club.playersFile.endsWith("players-test.json"));
  assert.ok(club.rosterFile.endsWith("roster-test-2099-00.json"));
});

test("findClubById resolves a real clubId and returns undefined for anything unknown", () => {
  const catalog = buildCatalog(FIXTURE_ROOT);
  assert.ok(findClubById(catalog, "test_club_fixture"));
  assert.equal(findClubById(catalog, "does_not_exist"), undefined);
});

test("a path-traversal-shaped clubId never resolves to anything (Spec S40)", () => {
  const catalog = buildCatalog(FIXTURE_ROOT);
  assert.equal(findClubById(catalog, "../../../../etc/passwd"), undefined);
  assert.equal(findClubById(catalog, "..\\..\\..\\Windows\\System32"), undefined);
});

test("an empty/nonexistent data root produces an empty catalog rather than throwing", () => {
  const catalog = buildCatalog(path.join(FIXTURE_ROOT, "does-not-exist"));
  assert.deepEqual(catalog.clubs, []);
});

test("competitionId falls back to the roster file's own value when the qc file is missing it (a real gap in some source clubs)", () => {
  const before = fs.readFileSync(QC_FILE, "utf8");
  try {
    const qc = JSON.parse(before);
    delete qc.competitionId;
    fs.writeFileSync(QC_FILE, JSON.stringify(qc, null, 2), "utf8");

    const club = buildCatalog(FIXTURE_ROOT).clubs[0];
    assert.equal(club.competitionId, "test_competition", "must fall back to the roster entries' competitionId");
  } finally {
    fs.writeFileSync(QC_FILE, before, "utf8");
  }
});
