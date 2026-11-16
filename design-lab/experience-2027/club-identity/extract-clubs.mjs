// Read-only extraction of every club in the game database (no game code is imported or modified).
// Sources: apps/game/lib/game-data/clubs.ts (+ swedishDivision2.ts via sweden2026Data.json).
// Usage (repo root): node design-lab/experience-2027/club-identity/extract-clubs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const game = path.join(root, 'apps', 'game', 'lib');
const src = fs.readFileSync(path.join(game, 'game-data', 'clubs.ts'), 'utf8');

const field = (obj, k) => { const m = obj.match(new RegExp(`\\b${k}:\\s*("([^"]*)"|'([^']*)'|(true|false))`)); return m ? (m[2] ?? m[3] ?? m[4]) : undefined; };
const clubs = [];
// club({ ... }) literals; one per club, possibly spanning lines
const re = /club\(\{([\s\S]*?)\}\)/g;
let m;
// Record which const block each club sits in (SWE_1, SWE_2, ...)
const blocks = [...src.matchAll(/^const (\w+): Club\[\] = \[/gm)].map((b) => ({ name: b[1], at: b.index }));
while ((m = re.exec(src))) {
  const body = m[1];
  const id = field(body, 'id');
  if (!id) continue;
  const block = blocks.filter((b) => b.at < m.index).pop();
  clubs.push({
    id, name: field(body, 'name'), shortName: field(body, 'shortName'), city: field(body, 'city'),
    competitionId: field(body, 'competitionId'), playable: field(body, 'playable') === 'true',
    dataSource: field(body, 'dataSource'), placeholderPrimary: field(body, 'primaryColor'), placeholderSecondary: field(body, 'secondaryColor'),
    block: block ? block.name : null,
  });
}
// Division 2 identities
const d2 = JSON.parse(fs.readFileSync(path.join(game, 'competition', 'transition', 'sweden2026Data.json'), 'utf8').replace(/^﻿/, ''));
for (const d of d2.division2Registrations) {
  for (const t of d.registrations) {
    if (t.canonicalMappingStatus === 'RESOLVED_SOURCE_REGISTRATION' && t.canonicalClubId && !clubs.some((c) => c.id === t.canonicalClubId)) {
      clubs.push({ id: t.canonicalClubId, name: t.name, shortName: t.name, city: undefined, competitionId: `se_division2_${d.district}`, playable: false, dataSource: 'IDENTITY_ONLY', placeholderPrimary: '#6b7280', placeholderSecondary: '#ffffff', block: 'SWEDISH_DIVISION_2', registrationUrl: t.sourceUrl });
    }
  }
}
const TIER = (c) => c.competitionId === 'se_handbollsligan_herr' ? 'SE-1 Handbollsligan' : c.competitionId === 'swe-2' ? 'SE-2 Allsvenskan' : /se_division1/.test(c.competitionId || '') ? 'SE-3 Division 1' : /se_division2/.test(c.competitionId || '') ? 'SE-4 Division 2' : 'International / world pool';
clubs.forEach((c) => (c.tier = TIER(c)));
const out = path.join(here, 'clubs-extracted.json');
fs.writeFileSync(out, JSON.stringify(clubs, null, 1));
const byTier = clubs.reduce((a, c) => ((a[c.tier] = (a[c.tier] || 0) + 1), a), {});
console.log(clubs.length, byTier, 'dup ids:', clubs.length - new Set(clubs.map((c) => c.id)).size);
