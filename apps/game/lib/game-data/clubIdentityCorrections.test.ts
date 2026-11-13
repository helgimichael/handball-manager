// Club Identity C2: the approved data corrections (F01-F33, S1-S6) are in place and traceable.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLUBS, getClub, getCompetition, getClubsByCompetition, getCanonicalClubName, getCanonicalClubShortName,
  resolveClubId, resolveClubByName, clubDisplayName, realWorldCompetitionForSeason, CLUB_WORLD_EPOCH, CANONICAL_CLUB_MAP,
} from "./index";

test("F01-F05: misleading ids keep their key and meaning, and explain themselves (D1)", () => {
  const expected: Record<string, [string, string | undefined]> = {
    "esp1-anaitasuna": ["Bidasoa Irun", "es-bidasoa-irun"],
    "esp1-logrono": ["Ademar León", "es-ademar-leon"],
    "esp1-alicante": ["SCDR Anaitasuna", "es-anaitasuna"],
    "hun1-gyor": ["Tatabánya KC", "hu-tatabanya"],
    "ger2-wilhelmshaven": ["TV Bittenfeld", undefined],
  };
  for (const [id, [name, canonicalId]] of Object.entries(expected)) {
    const c = getClub(id)!;
    assert.equal(c.name, name, id);
    assert.equal(c.canonicalId, canonicalId, id);
    assert.ok(c.legacyIdNote && c.legacyIdNote.length > 20, `${id} needs a legacyIdNote`);
    if (canonicalId) assert.equal(resolveClubId(canonicalId), id);
  }
});

test("lint: every non-Swedish id whose slug is absent from its names/aliases carries a legacyIdNote", () => {
  const fold = (t: string) => t.toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae").replace(/þ/g, "th").replace(/ð/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const offenders = CLUBS.filter((c) => !c.id.startsWith("se_") && !c.id.startsWith("swe") && !c.id.startsWith("int-")).filter((c) => {
    const slug = fold(c.id.replace(/^[a-z]{3}\d-/, ""));
    const names = [c.name, c.shortName, c.city ?? "", ...(c.aliases ?? []), ...(c.historicalNames ?? []).map((h) => h.name)].map(fold).join("|");
    return !names.includes(slug) && !c.legacyIdNote;
  }).map((c) => c.id);
  // Abbreviation slugs that are not identity errors (barca = FC Barcelona, fuchse = Füchse, oif = ØIF, rheinneckar, bjerringbro...) are listed explicitly.
  const ABBREVIATIONS = new Set(["esp1-barca", "den1-tms", "den1-tth", "den1-gog", "den1-morsthy", "den1-ribeesbjerg", "nor1-oif", "ger1-rheinneckar", "den1-bjerringbro", "ger1-fuchse", "isl1-fh"]);
  assert.deepEqual(offenders.filter((id) => !ABBREVIATIONS.has(id)), []);
});

test("F05: the TV Bittenfeld duplicate is a tombstone -- kept, resolvable, never playable, never reused", () => {
  const t = getClub("ger2-wilhelmshaven")!;
  assert.equal(t.status, "retired");
  assert.equal(t.duplicateOf, "ger1-stuttgart");
  assert.equal(t.playable, false);
  assert.equal(t.validTo, "2025/26");
  assert.equal(t.competitionId, "ger-2", "frozen legacy value kept");
  assert.equal(realWorldCompetitionForSeason(t, "2026/27"), undefined, "not a member of the 2026/27 world");
  assert.equal(clubDisplayName("ger1-stuttgart", "2014/15"), "TV Bittenfeld");
  assert.equal(clubDisplayName("ger1-stuttgart", "2026/27"), "TVB Stuttgart");
  assert.equal(CLUBS.filter((c) => c.canonicalId === "de-tvb-stuttgart").length, 1, "no second canonical TVB");
});

test("display and city corrections (F06-F13, F16, S1)", () => {
  const want: Record<string, Partial<{ name: string; shortName: string; city: string }>> = {
    "ger2-dessau": { name: "Dessau-Roßlauer HV 06", city: "Dessau-Roßlau" },
    "den2-fif": { city: "Frederiksberg" },
    "esp2-cisne": { city: "Pontevedra" },
    "den1-hoj": { city: "Ølstykke" },
    "hun2-eger": { name: "Eger-Eszterházy SzSE" },
    "den1-sonderjyske": { city: "Sønderborg" },
    "den1-skanderborg": { name: "Skanderborg AGF Håndbold", shortName: "Skanderborg AGF", city: "Skanderborg" },
    "hun1-veszprem": { name: "Veszprém KC" },
    "ger1-hamburg": { name: "Handball Club Hamburg", shortName: "HC Hamburg" },
  };
  for (const [id, fields] of Object.entries(want)) for (const [k, v] of Object.entries(fields)) assert.equal((getClub(id) as Record<string, unknown>)[k], v, `${id}.${k}`);
  assert.equal(getClub("den2-aarhus")!.founded, 2024);
  assert.match(getClub("den2-aarhus")!.identityNote!, /NOT the pre-2021/);
  assert.equal(clubDisplayName("den1-skanderborg", "2022/23"), "Skanderborg Aarhus Håndbold");
  assert.equal(clubDisplayName("den1-skanderborg", "2019/20"), "Skanderborg Håndbold");
  // Old names stay resolvable for search and imports, never for display.
  assert.equal(resolveClubByName("Telekom Veszprém")?.id, "hun1-veszprem");
  assert.equal(resolveClubByName("HSV Hamburg")?.id, "ger1-hamburg");
  assert.equal(resolveClubByName("Grundfos Tatabánya")?.id, "hun1-gyor");
  assert.equal(resolveClubByName("Skanderborg Aarhus")?.id, "den1-skanderborg");
});

test("F14/F15 new clubs are additive, epoch-tagged and invisible to the legacy baseline", () => {
  for (const [id, league] of [["ger1-bietigheim", "ger-1"], ["den1-kif-kolding", "den-1"]] as const) {
    const c = getClub(id)!;
    assert.equal(c.addedInWorld, CLUB_WORLD_EPOCH);
    assert.equal(c.playable, false);
    assert.equal(realWorldCompetitionForSeason(c, "2026/27"), league);
    assert.equal(realWorldCompetitionForSeason(c, "2025/26"), undefined);
    assert.ok(!getClubsByCompetition(league).some((x) => x.id === id), "legacy enumeration excludes it");
  }
});

test("league corrections are season-bound data, never edits of the frozen competitionId", () => {
  const moves: [string, string, string][] = [
    ["ger1-leipzig", "ger-1", "ger-2"], ["ger1-minden", "ger-1", "ger-2"], ["ger2-balingen", "ger-2", "ger-1"],
    ["den1-hoj", "den-1", "den-2"], ["den1-grindsted", "den-1", "den-2"], ["esp1-alicante", "esp-1", "esp-2"],
    ["isl2-fram", "isl-2", "isl-1"], ["svn2-skofjaloka", "svn-2", "svn-1"], ["svn2-jeruzalem", "svn-2", "svn-1"], ["hun2-komlo", "hun-2", "hun-1"],
  ];
  for (const [id, before, after] of moves) {
    const c = getClub(id)!;
    assert.equal(c.competitionId, before, `${id} frozen`);
    assert.equal(realWorldCompetitionForSeason(c, "2025/26"), before);
    assert.equal(realWorldCompetitionForSeason(c, "2026/27"), after);
    assert.equal(realWorldCompetitionForSeason(c, "2031/32"), after, "last known season carried forward");
    for (const h of c.competitionHistory!) assert.ok(h.source.length > 10, `${id} evidence`);
  }
  // Deferred (unverified 2026/27, T6): Norway stays as it is.
  for (const id of ["nor1-bodo", "nor2-fjellhammer", "nor2-sandnes"]) assert.equal(getClub(id)!.competitionHistory, undefined, id);
  assert.equal(getClub("esp2-teucro")!.approximate, true);
  assert.equal(getClub("esp2-cordoba")!.approximate, true);
});

test("S6: hun-2 is an alias of the canonical NB I/B competition", () => {
  assert.equal(getCompetition("hun-2")!.canonicalCompetitionId, "int-hun-2b");
  assert.equal(getCompetition("hun-2")!.name, "NB I/B");
  assert.equal(getCompetition("int-hun-2b")!.canonicalCompetitionId, undefined);
});

test("S3/T3: one name source -- media full names come from the records; no name resolves to two clubs", () => {
  for (const e of Object.values(CANONICAL_CLUB_MAP)) assert.equal(e.fullName, getClub(e.id)!.name.replace(/\s+herr$/i, ""), e.id);
  assert.equal(getCanonicalClubName("swe2-guif"), "Eskilstuna Guif IF");
  assert.equal(getCanonicalClubShortName("Eskilstuna Guif"), "Eskilstuna Guif");
  // Second teams never resolve to their parents through media name lookups.
  assert.equal(getCanonicalClubName("Tumba HK"), "Tumba HK");
  assert.equal(getCanonicalClubName("VästeråsIrsta HK"), "VästeråsIrsta HK");
  assert.equal(getCanonicalClubShortName("Lunds HS Lejon"), "Lunds HS Lejon");
  assert.equal(getCanonicalClubName("Malmö HP"), "Malmö HP");
});

test("S5: Division 2 Profixio registrations are season-scoped external ids; SHF ids recorded where known", () => {
  const div2 = CLUBS.filter((c) => c.id.startsWith("se_div2_team_"));
  assert.ok(div2.length >= 50);
  for (const c of div2) assert.equal(c.externalIds?.profixioTeam?.["2026/27"], c.sourceRegistration!.teamId, c.id);
  assert.equal(getClub("se_club_hk_cliff")!.externalIds?.shfClubId, "26051");
  assert.equal(getClub("se_div2_team_1576008")!.externalIds?.shfClubId, "26090");
});
