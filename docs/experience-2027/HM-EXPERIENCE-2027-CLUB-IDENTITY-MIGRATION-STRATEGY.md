# HM Experience 2027: Club Identity, Canonical Model and Migration Strategy

**Status:** Planning document. No production code, game data, save, Alpha data or career was changed, and nothing was migrated.
**Date:** 2026-11-14. Branch `design/hm-experience-2027` (base `29777aa`).
**Read with:**
- `HM-EXPERIENCE-2027-CLUB-IDENTITY-FINAL-DECISIONS.md` (decisions D1–D11, locked L1–L10, technical T1–T8);
- `HM-EXPERIENCE-2027-CLUB-IDENTITY-IMPLEMENTATION-ROADMAP.md`;
- `HM-EXPERIENCE-2027-CLUB-IDENTITY-CORRECTION-PLAN.md` (findings F01–F33 and S1–S6).

**Goal:** existing careers never suddenly get different leagues, club identities or historical results. New careers get the corrected world, and long careers stay coherent across any number of season rollovers.

---

## 1. Canonical club identity model

### 1.1 Three layers, one key

| Layer | Owner | Contents | Changes over time |
|---|---|---|---|
| **1. Static club identity** | Game data (`apps/game/lib/game-data`) | Who the club *is*: id, canonical identity, names per season, nation, city, league per real season, relations per real season, external ids, status | Append-only per real season. Earlier seasons are never rewritten |
| **2. Career world state** | The save (`CareerState`) | What happened *in this career*: Swedish league membership after simulated promotion and relegation, partnership agreements, results, history, squads | Written only by the career's own simulation |
| **3. Visual identity** | Club Identity Registry (`club-identity/registry.json`) | Kit, neon, crest colours, status, evidence | Per storage id plus kit season |

**The join key in all three layers is the storage id** (`Club.id`). A display name is never a key: not in saves, not in the registry, not in import matching.

### 1.2 Identity fields

The static fields extend `Club` (`game-data/types.ts:60-92`). They are optional, so every current record stays valid.

| Concern | Field | Rule |
|---|---|---|
| Stable internal id | `id` | Immutable. Never reused for a different real club, never deleted. Prefixes such as `ger1-` are historical text, not meaning |
| Canonical real-world identity | `canonicalId` (defaults to `id`) | A real-world slug (for example `es-bidasoa-irun`). Used by tools, the registry and imports. Never stored in saves |
| Why id text and identity differ | `legacyIdNote` | Required when the id text names another club (F01–F04, F05) |
| Official name | `name`, `shortName` | The current official or neutral name (D4) |
| Alternative names | `aliases[]` | Used for search and import matching only, never for display (for example "Dessauer HV", "Guif", "H43 Lejonen") |
| Historical names | `historicalNames[]` (`name`, `shortName?`, `validFrom?`, `validTo?`) | Season-bounded. History views pick the name valid in the season shown (T8) |
| Nation | `nation` (derived from the competition today; made explicit) | Nation of the club's federation, not of its players |
| Current league | the resolver `clubCompetitionForSeason` (§4) | Never read `competitionId` directly in new code |
| League at career start | `competitionId` (frozen legacy baseline) or `competitionHistory` at the start season | See §3 |
| League in a given season | `competitionHistory[]` (`competitionId`, `validFrom`, `validTo?`, `source`) | Append-only, one entry per change |
| Parent club / reserve / U team | `relations[]` (`parentClubId`, `relation`, `relationConfidence`, `validFrom`, `validTo?`, `evidence`) | Static fact about the real world (§6). The career agreement is a separate row in layer 2 |
| Dissolved, refounded, retired | `status` (`active`, `dissolved`, `retired`), `validFrom`/`validTo`, `predecessorId?`, `retiredReason`, `duplicateOf?` | A refounded club gets a **new id** and a `predecessorId`. It never inherits the old id |
| Duplicates | `duplicateOf` (informational only) | Never triggers a merge (L10) |
| External ids | `externalIds` (`shfClubId`, `profixioTeam: {season → teamId}`, `wikipedia`, `ehf`) | Import matching uses the SHF association id plus the team name; never a Profixio team id alone (S5) |
| Uncertain data | `approximate: true` | A real club whose tier is uncertain (F21 Teucro) |

### 1.3 Identity rules

1. **Same id ⇔ same playing entity across seasons.** A rename keeps the id (Hamburg to HCH; Skanderborg Aarhus to Skanderborg AGF). A bankrupt club refounded as a new legal entity gets a new id plus `predecessorId`.
   - The 2024 Aarhus Håndbold (`den2-aarhus`) is **not** the pre-2021 Århus Håndbold. It keeps its id with `validFrom: 2024/25` and no predecessor link to `den1-skanderborg`.
   - RD Loka 2012 notes the pre-2011 club in `historicalNames` only (F19).
2. **Similar names never imply a merge.** Tumba HK vs IFK Tumba HK, VästeråsIrsta HK vs HF, Helsingborgs HK vs OV Helsingborg, and Lunds HS Lejon vs H43 Lund are linked by `relations`, never merged (L10).
3. **Name resolution never wins over id.** `getCanonicalClubName` currently matches lowercased names (`canonicalClubNames.ts:82-86`) and normalises acronyms (`:132-137`). It must be generated from the club records (T3) and tested so that a second team's name never resolves to its parent.
4. **Hard-coded ids stay pointed at their club.** `TUMBA_CLUB_ID = "swe2-tumba"` must never point at the Division 2 `se_div2_team_1582988`.

---

## 2. Where club ids live in a v8 save (verified)

This summarises correction plan §2.1, re-checked for this review.

| Kind | Fields | Effect of a static data change |
|---|---|---|
| Envelope | `CareerSave.clubId` | Must resolve, or `getCareerClub` throws (`careerWorld.ts:47-50`) |
| Values | `playerClubId`, fixtures (`homeClubId`/`awayClubId`), `StandingRow.clubId` in `seasonHistory[].table` and `tables`, contracts, club history, offers, `staffAppointments`, ties | Names and colours are **resolved live**. A rename shows on the next load, in old seasons too, unless history views resolve names per season (T8) |
| Map keys | `worldSquads`, `gameplayRatings`, `clubEconomies`, `competitionMembership`, `clubKnowledge`, `clubPartnerships`, `staffRoster`, `clubForm`, `aiTacticalPreferences`, `youthIntakeClubYears` | Keys must keep resolving. A retired id must stay in `CLUBS` |
| Embedded in other ids | `youth-<clubId>-…`, `generated-…-<clubId>-…`, `bteam-<A>-<B>`, seeds `${saveSeed}:${clubId}:${year}` | Cannot be rewritten. This is why ids are never renamed |
| Baked text | Inbox subject and body, bid motive text | Keeps the old name forever. This is accepted as history |
| History | `seasonHistory[]` (tables, fixtures, results, ties, outcome, transition receipt); never compacted (`historyCompaction.ts:33-58` only trims inbox, events, offers, media, training, workload and scouting) | Ids only; reconstructable per season |
| Swedish membership | `competitionMembership` (written by the Swedish transition, `seasonTransition.ts:114-136`) | Wins over static data (`competitionMembership.ts:11`) |

**Two load-path facts that shape the strategy:**
- The IndexedDB loader does **not** reject a newer `schemaVersion` (`saveRepository.ts:184`). Only portable backups do (`portableCareerBackup.ts:35`). A rolled-back build will therefore open a newer save from IndexedDB and stamp it back to v8 on the next write (`saveRepository.ts:376-384`). Every change must be readable by the previous build (additive), or be guarded (T7).
- Backfills of new world squads detect a single sentinel club (`careerInitialization.ts:173` for Division 1, `:187` for the world pool). A new REAL_WORLD club added later is never backfilled (T2).

---

## 3. The legacy baseline: no retroactive league changes

### 3.1 The risk

`clubCompetitionId(state, id) = state.competitionMembership[id] ?? getClub(id).competitionId` (`competitionMembership.ts:10-12`). For every foreign club there is no override, so the **static** value is the live answer. Editing a foreign `competitionId` in `clubs.ts` would, on the next load of every career, immediately:
- move Leipzig and Minden out of the world pool and foreign buyers, and Balingen into them (`careerWorld.ts:42`, `market.ts:72`);
- change which club a deterministic foreign bid picks by index (`market.ts:72-76`);
- change rating priors for clubs evaluated later (`clubContextTier.ts:36,145`);
- change `worldCompetitions.ts:69` enumeration.

The season in progress would change under the player. That breaks L10, rule 4.

For **Swedish** leagues a static edit is worse. The transition's size check (`seasonTransition.ts:135`) counts `membership[c.id] ?? c.competitionId`. Adding a Swedish club, or moving one whose membership was never overridden, can make the next rollover fail with `INVALID_TARGET_SIZE` in existing careers.

### 3.2 The design

1. **Freeze `Club.competitionId`.** Its meaning becomes "the league this club had in the v8 world every existing career started from" (the *legacy baseline*). It is never edited again. A snapshot test over all 202 ids enforces this (ROADMAP C1).
2. **Add `competitionHistory`** per club for the real world, append-only. Example for Leipzig: `[{ger-1, validFrom 2025/26, validTo 2025/26}, {ger-2, validFrom 2026/27}]`.
3. **Add `CareerState.clubWorldBaseline?: string`.**
   - **Absent** = a legacy v8 career (every existing save). No backfill is written, so absence is the marker.
   - **New careers** get the current data epoch, for example `"cid-2026-27-v1"`.
4. **Resolve per season.** `clubCompetitionForSeason(state, clubId, seasonId)` looks up, in order:
   1. `state.competitionMembership[clubId]`: the career's own simulation always wins.
   2. If the club is **Swedish** and the season is after the career's start season: static data is never consulted. Swedish clubs without an override keep their start-of-career league; this is the current behaviour, unchanged.
   3. If `clubWorldBaseline` is absent **and** `seasonId` is the career's start season (2026/27 for every existing save): the frozen `competitionId`.
   4. Otherwise: the `competitionHistory` entry valid for `seasonId`, or, past the last known entry, the last entry carried forward.
   5. Fallback: `competitionId`.

### 3.3 Outcome

| Career | 2026/27 (in progress) | 2027/28 and later |
|---|---|---|
| Existing v8 career | Exactly the leagues it has always shown | Corrected foreign leagues (Leipzig and Minden ger-2, Balingen and Bietigheim ger-1, and so on); Swedish leagues from its own simulation |
| New career after the change | Corrected 2026/27 foreign leagues | `competitionHistory` per season; Swedish leagues from its own simulation |

Nothing in any save is written. Rolling back the build restores the v8 behaviour, because the old build reads the same frozen `competitionId`.

---

## 4. Season-bound league membership and history

### 4.1 Four meanings, four sources

| Meaning | Source | Stored in save? |
|---|---|---|
| Real current league (today's real world) | Last `competitionHistory` entry | No (static) |
| League at career start | Legacy career: frozen `competitionId`. New career: `competitionHistory` at `clubWorldBaseline`'s start season | No (derived from static data plus marker) |
| League in a given career season | Swedish modelled leagues: `seasonHistory[s].tables` (club ids per competition) and `outcome.nextMembership`. Division 2 pools: `swedishContinuity.pools[s]`. Foreign: the resolver (deterministic from static data) | Swedish: yes, already. Foreign: no need, because the resolver is deterministic given append-only data |
| Historical league (real world, before the game) | `competitionHistory` entries before 2026/27, optional | No |

**Determinism requirement.** Foreign history is reproducible only because `competitionHistory` is **append-only**. A correction of an already-published season's entry is a data bug fix and must be listed in the release notes. If it ever affects a season a career has already played, the career's display of that season changes; gameplay results do not, because foreign leagues have no fixtures.

### 4.2 Long careers

| Topic | Rule |
|---|---|
| Swedish promotion and relegation | Simulated by the career (`seasonTransition`, `gameContinuity` rules for every season after 2026/27). Real-world Swedish movements never overwrite a running career (D5) |
| Foreign clubs | Not simulated. They follow `competitionHistory` and carry the last known season forward indefinitely. A future foreign simulation would write `competitionMembership` and therefore win automatically |
| Manager changes club | Unchanged. Only Swedish manageable leagues can employ the manager (`managerCareer.ts:132-135`), and their membership is career-owned |
| B teams | Their league is career membership like any Swedish club. Their **relation** is static and season-bounded (§6) |
| New real-world season data (for example 2027/28) | Appended as new `competitionHistory` entries. They reach existing careers only for seasons the career has not yet started. Foreign leagues therefore update at the next rollover, never mid-season |

### 4.3 Direct readers of static `competitionId` to move to the resolver

These are the only readers that can see a foreign league change. Swedish-only readers keep their current behaviour.

| File | Line | Today |
|---|---|---|
| `career/careerWorld.ts` | 42 | `getClubsByCompetition` for the world pool |
| `players/market.ts` | 72-76 | Foreign buyer pool and country label |
| `rating/gamePrior/clubContextTier.ts` | 36, 145 | Rating prior tier |
| `career/worldCompetitions.ts` | 69 | Membership enumeration |
| `career/scoutDiscovery.ts` | 94, 112 | Candidate competition label |
| `competition/tables.ts`, `competition/season.ts:237`, `competition/transition/careerSnapshot.ts:31` | | Swedish only; already override-first. Keep bit-identical |

**Out of scope:** `market.ts:48` reads the manager's own club's static league for domestic interest. For a promoted club that is a pre-existing Swedish inconsistency. It is noted here and **not** fixed by this work (no gameplay change).

---

## 5. Classification of every correction

**Classes:**
- **A:** no schema change and no change to world behaviour. Static display or metadata only.
- **B:** changes world data but not the save format. Season-gated through the resolver, or added through an idempotent backfill. Nothing existing in a save is rewritten.
- **C:** requires migration of existing save data (a rewrite) and therefore **v9**.

| Item | Class | Old saves | New careers | When | History and relations | Rollback |
|---|---|---|---|---|---|---|
| F06, F07, F08, F09 city, F10, F11, F12 note, F13, F16, S1, S3: names, cities, aliases, `historicalNames` | **A** | New name on next load; old seasons show the season-correct name (T8); inbox keeps old text | Corrected | Immediately (display only) | Ids unchanged; tables and fixtures intact | Revert the commit |
| F01–F04 canonical metadata (D1-A) | **A** | No change | No change | Immediately | Unchanged | Revert |
| F22, F24, F25, F26 metadata (`licenceHolderAssociation`, `externalIds`) | **A** | No change | No change | Immediately | Partnership rows untouched | Revert |
| S5 external ids, S6 competition alias metadata | **A** | No change | No change | Immediately | Unchanged | Revert |
| K items: F30, F31, F32, F33 and registry fields | **A** | Visual only | Visual only | Immediately | n/a | Revert |
| F05 tombstone `ger2-wilhelmshaven`; F21 Córdoba tombstone (D6) | **A** | The id still resolves; not playable; ger-2 and esp-2 are not read by careers | Excluded after `validTo` | Immediately (no reader) | Stray `clubKnowledge` keys keep resolving | Revert; tombstones are only ever added |
| F03, F14, F15, F17, F18, F19, F20, F21 (Teucro), S6: league moves | **B** | Unchanged in 2026/27; corrected from the next rollover (§3) | Corrected from the start | At the season boundary | Swedish history untouched; foreign history deterministic (§4.1) | Revert: the old build reads frozen `competitionId` |
| N: Bietigheim, KIF Kolding, the F05 and D6 replacements (D2 optional) | **B** | Present in `CLUBS`; listed for seasons from `validFrom`; squads backfilled per club (T2) only for seasons not yet started | Present | Next rollover for existing careers | None | Revert. A rolled-back build ignores stray `worldSquads` keys, because enumeration iterates `CLUBS` |
| F27, F28, S2: 11 relations (D9-A) | **B** | Additive idempotent rows, `startDate` = next season start (the cooperation rule skips rows not yet started, `cooperationEligibility.ts:25`) | Rows from career start | At the season boundary | Existing rows unchanged; existing development partnerships run to `endDate` | Revert. A rolled-back build keeps the extra rows and applies the SHF cap to them, which is valid in the old build too |
| F23 IF Kristianstad (D8-A metadata) | **A** | No change | No change | Immediately | Row unchanged | Revert |
| F23 retype (D8-B, not recommended) | **C** | Row type rewritten, `migratedFrom` recorded | New type | At migration | Row id kept | Needs a pre-v9 backup; an older build cannot read the type safely |
| Physical re-key of F01–F04 (D1-B, rejected) | **C** | About 20 fields rewritten; embedded ids impossible | | | | High risk |
| Merge of any duplicate (rejected; none qualifies) | **C** | | | | | |
| Ending existing development partnerships early (D9-A2, not recommended) | **C**-lite (data rewrite, no format change) | Row terminated, refund entry | | At migration | | Pre-migration export |
| S4 Bodens BK reserve into Division 2 (if verified) | **B, new careers only** | **Not** added to existing careers: it would change Division 2 pool sizes and `INVALID_TARGET_SIZE` checks | Present | New careers | | Revert |

**Result:**
- Every recommended correction is class **A** or **B**.
- **No v9 is required** for the recommended plan.
- v9 is required only for the class **C** options, which this review advises against.

### 5.1 When v9 would still be bumped

`CURRENT_SAVE_SCHEMA_VERSION` marks a change in the meaning of stored data that an older build cannot read safely. The precedent for leaving it alone is that `competitionMembership` and `clubPartnerships` both arrived without a bump. Bump to v9 only if one of these is approved:
- D8-B (a new partnership type stored in saves);
- a re-key or merge;
- any later feature that writes career-state values an older build would misinterpret.

If v9 is bumped, then:
- the v9 step lives in `migrateCareerState` and is idempotent ("run twice = run once");
- before running, the untouched v8 record is copied to an IndexedDB meta entry `pre-v9:<saveId>`;
- testers are asked to export once before updating.

---

## 6. Club relations: static facts vs career agreements

### 6.1 Vocabulary

| Concept | Static relation (layer 1) | Career representation (layer 2) | Cooperation cap (L9) |
|---|---|---|---|
| Parent club (moderklubb) | `relations[].parentClubId` on the child | `ClubPartnership.clubAId` | n/a |
| Reserve / second team (reservlag) | `SECOND_TEAM` / `SAME_CLUB_SECOND_TEAM` / `SECOND_TEAM_UNDER_PARTNER_ASSOCIATION` | `AFFILIATED_B_TEAM`, permanent | Applies |
| U team (U-lag) | `U_TEAM` / `U_TEAM_UNDER_PARTNER_LICENCE` (HK Cliff) | `AFFILIATED_B_TEAM`, permanent | Applies |
| Farm club (farmarklubb) | `PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS` (IF Kristianstad, D8) | `AFFILIATED_B_TEAM` (D8-A) | Applies |
| Active cooperation (aktivt samarbete) | No static fact needed | `DEVELOPMENT_PARTNERSHIP` with `status: ACTIVE`, or any row with `competitionRestriction.applyParentDivisionRule` | Applies when SHF-type (existing logic) |
| Historical cooperation (historiskt samarbete) | `relations[]` with `validTo` | Row with `status: EXPIRED` or `TERMINATED` and `endDate` | Only the existing late-termination rule (SHF 9:5-7, `cooperationEligibility.ts:33-35`) |
| Academy | `ACADEMY` (`int-veszprem-academy`) | None (foreign) | n/a |
| Independent club, no active relation | No `relations`, or only `YOUTH_LINK` (F29 Torslanda HK) | None | None |

### 6.2 Lifecycle rules

The cooperation **logic** is unchanged; these rules only decide which rows exist and when.

| Event | Static data | Existing career | New career |
|---|---|---|---|
| Relation added (F27, F28, S2) | `relations[]` with `validFrom` | Separate idempotent seeder adds the `AFFILIATED_B_TEAM` row with `startDate` = next season start; the in-progress season is unaffected | Seeded at creation |
| Relation ends in reality | Set `validTo` on the static relation | **Not** auto-terminated in running careers; the career's agreement is career state. A future "agreement ended" event would use the existing termination path and the existing late-termination rule | Not seeded if `validTo` is before the start season |
| Development partnership with a newly linked team | n/a | Runs to `endDate`, no renewal (D9-A1) | Never offered |
| Promotion of a B team | n/a | The existing cap decides; no change | Same |
| Relegation of the parent | n/a | The cap follows the parent's current tier (`sportingTier(state, clubAId) + 1`), unchanged | Same |
| Manager changes club | n/a | Rows belong to clubs, not the manager; unchanged | Same |
| A B team is the manager's club (HK Cliff) | n/a | Unchanged; it stays selectable (D7) | Same |

**Guard:** `PERMANENT_B_TEAM_PAIRS` and `isPermanentBTeamClub` (`clubPartnerships.ts:89-101`) stay **unchanged**. Extending the constant would apply immediately and retroactively. The new relations use their own seeder and a derived set, which still produce the existing `AFFILIATED_B_TEAM` type that the cooperation rule already understands.

---

## 7. Historical results and club history

- Results, tables, ties and fixtures store **ids only**. Correcting identity data therefore never changes a result, a points total or a winner.
- Names in history views use `clubDisplayName(id, seasonId)` (T8): the `historicalNames` entry valid in that season, otherwise the current name. Before T8 ships, renamed clubs show their new name in old seasons. That is acceptable and documented.
- Baked text (inbox, bid motives) keeps the old wording.
- A tombstone stays in `CLUBS` forever, so history never falls back to a raw id string (`canonicalClubNames.ts:112`).
- Kits in history: the registry is keyed by storage id plus kit season. A retired id renders with the fallback (FINAL-DECISIONS §3).

---

## 8. Rollback

| Phase type | Rollback |
|---|---|
| Class A (static display or metadata) | Revert the commit. Saves are untouched |
| Class B, resolver and baseline | Revert. The old build reads the frozen `competitionId` and ignores `clubWorldBaseline`. A new-career save opened in the old build shows the legacy foreign lists; this is cosmetic, because foreign leagues have no fixtures. T7 makes the old build show a warning |
| Class B, new clubs and relation rows | Revert. Stray `worldSquads` keys are ignored by enumeration. Extra `AFFILIATED_B_TEAM` rows remain valid in the old build |
| Class C (only if approved) | Restore `pre-v9:<saveId>` or the tester's export. Portable v9 backups are rejected by v8 builds (`portableCareerBackup.ts:35`) |

Every phase ships alone, behind the Alpha gate first (ROADMAP §2). A phase is never combined with an unrelated save change.
