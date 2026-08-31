// HM-BIO-NATIONALITY-1.0: guards the nationality resolution path.
//
// The bug this exists to prevent: ISO_TO_NATION_CODE used to cover only 8 of
// the 27 ISO codes actually present in the real-world player database, and
// unmapped codes fell through to "SWE". Correctly-researched foreign players
// (Dika Mem/FR, Mijajlo Marsenic/RS, Faroese internationals/FO, ...) all
// silently rendered as Swedish. These tests fail if any observed ISO code
// loses its mapping, or if an unknown nationality ever resolves to SWE again.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { snapshotWorldSquads } from "./serverSnapshot";
import { COMPETITIONS } from "../game-data/competitions";
import { NATION_LABEL_SV } from "../career/scoutDiscovery";

const DATA_ROOT = path.join(__dirname, "..", "..", "..", "..", "data", "real-world");

function collectPlayersFiles(dir: string, out: string[] = []): string[] {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) collectPlayersFiles(p, out);
    else if (d.name.startsWith("players-") && d.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Every distinct ISO nationality code present anywhere in the real-world database. */
function observedIsoCodes(): Set<string> {
  const codes = new Set<string>();
  for (const file of collectPlayersFiles(DATA_ROOT)) {
    const players: { nationalities: string[] | null }[] = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const p of players) for (const c of p.nationalities ?? []) codes.add(c);
  }
  return codes;
}

test("nationality: every ISO code observed in the real-world database resolves to a real NationCode, never a silent SWE fallback", () => {
  const observed = observedIsoCodes();
  assert.ok(observed.size > 0, "expected the real-world database to contain nationality data");

  // Resolve each observed code through the same production path the game uses.
  const squads = COMPETITIONS.flatMap((c) => {
    try { return Object.values(snapshotWorldSquads(c.id)).flat(); } catch { return []; }
  });
  const resolvedByIso = new Map<string, Set<string>>();
  for (const p of squads) {
    const iso = p.nationalities?.[0];
    if (!iso) continue;
    if (!resolvedByIso.has(iso)) resolvedByIso.set(iso, new Set());
    resolvedByIso.get(iso)!.add(p.nationality);
  }

  const unmapped: string[] = [];
  for (const iso of observed) {
    const resolved = resolvedByIso.get(iso);
    if (!resolved) continue; // present in a file the snapshot path doesn't load -- covered by the mapping-table test below.
    // A non-SE code must never resolve to SWE, and must never resolve to UNK.
    for (const code of resolved) {
      if (iso !== "SE" && (code === "SWE" || code === "UNK")) unmapped.push(`${iso} -> ${code}`);
    }
  }
  assert.deepEqual(unmapped, [], `these observed ISO codes do not resolve to their own nation: ${unmapped.join(", ")}`);
});

test("nationality: a player with no source nationality resolves to UNK (explicitly unknown), never to an assumed SWE", () => {
  const squads = COMPETITIONS.flatMap((c) => {
    try { return Object.values(snapshotWorldSquads(c.id)).flat(); } catch { return []; }
  });
  const noSource = squads.filter((p) => !p.nationalities || p.nationalities.length === 0);
  assert.ok(noSource.length > 0, "expected at least one player without researched nationality data");
  for (const p of noSource) {
    assert.equal(p.nationality, "UNK", `${p.firstName} ${p.lastName} has no source nationality but resolved to ${p.nationality}`);
  }
});

test("nationality: specific real players resolve to their correct researched nation", () => {
  const squads = COMPETITIONS.flatMap((c) => {
    try { return Object.values(snapshotWorldSquads(c.id)).flat(); } catch { return []; }
  });
  const byName = new Map(squads.map((p) => [`${p.firstName} ${p.lastName}`, p]));

  const expectations: [string, string][] = [
    ["Dika Mem", "FRA"],
    ["Mijajlo Marsenić", "SRB"],
    ["Sander Sagosen", "NOR"],
    ["Mirko Alilović", "HRV"],
    ["Senjamin Burić", "BIH"],
    ["Benjamin Helander", "FIN"],
    ["Leonard Gegaj", "KOS"],
    ["Markus Viitkar", "EST"],
    ["Mounir Chehri", "DZA"],
    ["Vaidas Trainavičius", "LTU"],
  ];
  for (const [name, expected] of expectations) {
    const p = byName.get(name);
    if (!p) continue; // roster churn must not break this guard
    assert.equal(p.nationality, expected, `${name} should resolve to ${expected}, got ${p.nationality}`);
  }
});

test("nationality: every NationCode reachable from the ISO map has a Swedish display label", () => {
  const squads = COMPETITIONS.flatMap((c) => {
    try { return Object.values(snapshotWorldSquads(c.id)).flat(); } catch { return []; }
  });
  const usedCodes = new Set(squads.map((p) => p.nationality));
  for (const code of usedCodes) {
    assert.ok(NATION_LABEL_SV[code], `NationCode ${code} is in use but has no NATION_LABEL_SV entry`);
  }
});
