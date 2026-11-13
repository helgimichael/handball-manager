# HM Experience 2027: Club Identity, Implementation Roadmap

**Status:** This is a plan. Nothing in it has been implemented. No production code, game data, saves, Alpha data or careers were changed.
**Date:** 2026-11-14. Branch `design/hm-experience-2027`, base `29777aa`.

**Prerequisites:** owner approval of the mandatory decisions in `HM-EXPERIENCE-2027-CLUB-IDENTITY-FINAL-DECISIONS.md`:
- D1, D5, D7, D8, D9, D11.

**Mechanics:** see `HM-EXPERIENCE-2027-CLUB-IDENTITY-MIGRATION-STRATEGY.md` (MS).

**Principles:**
1. One phase per release.
2. Alpha first, behind the existing Alpha gate.
3. Each phase is independently revertible.
4. No phase changes the match engine, the cooperation logic (L9), Arena Nights, the Club Identity rules (L2–L5, L8) or the 231/551 design set (L7).
5. Under the recommended decisions no phase bumps the save schema. Only the optional C6b step does, and only if D8-B is chosen.

---

## 1. Phases

The order differs from the owner's draft (C1–C7):
- an inventory phase (C0) comes first;
- the registry and visual integration moves to the end (C7), because it must mirror the corrected records;
- "Save Migration" is not a separate phase. Under the recommended plan nothing is rewritten. The compatibility work (marker, guard) belongs to C4, and the only real migration (D8-B) is an optional sub-step C6b.

| Phase | Name | Class (MS §5) | Release gate |
|---|---|---|---|
| C0 | Baseline, fixtures and research | none | Fixtures committed; research closed for C4 and C5 data |
| C1 | Canonical identity model | A | Types and resolvers, with no visible change |
| C2 | Display and metadata corrections | A | Names, cities, aliases, canonical metadata |
| C3 | Name resolution consolidation | A | One name source; second-team names safe |
| C4 | Season-bound league membership | B | Legacy baseline, resolver, marker, guard |
| C5 | New clubs and tombstones | A/B | Per-club backfill; F05 and D6 tombstones |
| C6 | Club relationships | B (C6b: C) | 11 static relations, gated seeder |
| C7 | Club identity integration | A | Registry rebuilt from records; kits for new ids |
| C8 | Historical career validation | none | Five-season soak and Alpha rollover sign-off |

### C0: Baseline, fixtures and research

- **Goal:** prove what real saves contain, and close the research the data phases need.
- **Scope:**
  - A read-only script, `apps/game/scripts/club-id-usage-audit.ts`. It counts every club id per field in MS §2 across the fixture saves, including embedded-id prefixes.
  - Anonymised Alpha exports in `apps/game/lib/save/__fixtures__/alpha-*.json` (D11). Manager name and date of birth are replaced; archives may be trimmed.
  - Synthetic fixtures:
    - a fresh 2026/27 career;
    - a mid-season career;
    - a career at season end, before rollover;
    - a career managing HK Cliff;
    - a career with an active development partnership.
  - Research T6:
    - Denmark's second promotee;
    - Norway's 2026/27 movements;
    - the HCH rename date;
    - HK S-hof on Profixio;
    - the Bodens BK reserve (S4).
- **Systems and files:** `apps/game/scripts/`, `apps/game/lib/save/__fixtures__/`; read-only use of `lib/save`, `lib/career`.
- **Dependencies:** D11 approval and tester consent.
- **Acceptance:**
  - an id-usage table per fixture;
  - every affected id from the correction plan is marked present or absent in real saves;
  - a research log with sources.
- **Tests:** the audit script runs in CI on the fixtures; the fixtures pass `validatePortableCareerBackup`.
- **Risks:** personal data in exports (mitigated by anonymisation and review); exports too large (trim the archives).
- **Stop conditions:**
  - a fixture contains a club id that `getClub` does not resolve today;
  - consent is not given. In that case continue with synthetic fixtures only and record the gap.

### C1: Canonical identity model

- **Goal:** add the identity fields and resolvers with **zero** behaviour change.
- **Scope:**
  - Optional fields on `Club` (MS §1.2): `canonicalId`, `legacyIdNote`, `status`, `aliases`, `historicalNames`, `competitionHistory`, `relations`, `externalIds`, `approximate`, `validFrom`, `validTo`, `predecessorId`, `duplicateOf`, `retiredReason`.
  - Resolvers, each a pass-through today:
    - `resolveClubId`;
    - `clubDisplayName(id, seasonId?)`;
    - `clubCompetitionForSeason` (returns the current answer);
    - `parentClubOf`.
  - A **frozen-baseline snapshot test** of `competitionId` for all ids.
  - A lint test: an id whose text names another club needs a `legacyIdNote`.
- **Systems and files:**
  - `apps/game/lib/game-data/types.ts`, `clubs.ts`;
  - new `apps/game/lib/game-data/clubIdentity.ts`;
  - `career/competitionMembership.ts` (delegates only).
- **Dependencies:** C0.
- **Acceptance:**
  - every fixture loads to a deep-equal `CareerState`;
  - all existing tests pass;
  - `getClub` snapshot unchanged except the new optional fields.
- **Tests:** snapshot of `CLUBS`; fixture load equality; resolver unit tests.
- **Risks:** accidental behaviour change through the resolver (mitigated by the pass-through implementation and equality tests).
- **Stop conditions:** any fixture or existing test changes output.

### C2: Display and metadata corrections

- **Goal:** apply every class-A data correction.
- **Scope:**
  - F06, F07, F08, F09 (city), F10, F11, F12 (notes, `validFrom`), F13, F16, S1: names, cities, aliases and `historicalNames`, following the D4 naming policy.
  - F01–F04: `canonicalId`, `legacyIdNote`, `externalIds` (D1-A).
  - F22, F24, F25, F26 metadata (licence holder, SHF ids).
  - S5: `externalIds` with the SHF ids listed in the correction plan.
  - F23: `relationConfidence: PARTIAL` (D8-A).
  - Fix the stale comments in `clubs.ts`, such as the "verified" Bundesliga label and the "NB II" comment.
- **Systems and files:** `apps/game/lib/game-data/clubs.ts`, `swedishDivision2.ts` (metadata only), `clubVenues.ts` (only if venue cities change).
- **Dependencies:** C1; D4 (it can ship with neutral names and change later).
- **Acceptance:**
  - only the intended display fields differ in the `CLUBS` snapshot;
  - `competitionId` is unchanged (frozen-baseline test);
  - fixtures load deep-equal apart from derived display;
  - the north/south geography sets in `gameContinuity.ts` are unaffected. Only Swedish cities matter there, and none change.
- **Tests:** snapshot diff review; fixture equality; history views show the season-correct name once T8 lands (C3).
- **Risks:**
  - City changes feeding derby or geography logic. None of the C2 cities are Swedish.
  - Old inbox text keeps old names. This is accepted.
- **Stop conditions:** any `competitionId` or relation change appears in the diff.

### C3: Name resolution consolidation

- **Goal:** one source of club names, safe for second teams (S3, T3, T8).
- **Scope:**
  - Generate `CANONICAL_CLUB_MAP` from the club records.
  - Remove the hand-maintained conflict "HK Guif" vs "Eskilstuna Guif IF".
  - Make lowercased-name matching id-first.
  - History views call `clubDisplayName(id, seasonId)`.
- **Systems and files:**
  - `apps/game/lib/game-data/canonicalClubNames.ts`;
  - the history surfaces that render past seasons (season archive, club history, manager biography), read paths only.
- **Dependencies:** C2.
- **Acceptance:**
  - every Swedish name resolves to its own id;
  - "Tumba HK" never resolves to IFK Tumba HK, and "VästeråsIrsta HK" never to VästeråsIrsta HF;
  - the same applies to Helsingborgs HK vs OV, Malmö HP vs HK Malmö, and Lunds HS Lejon vs H43;
  - `TUMBA_CLUB_ID` is unchanged.
- **Tests:** a name-resolution matrix over all 202 names and aliases; media and inbox rendering snapshots.
- **Risks:** media text changes for Guif. This is intended and display only.
- **Stop conditions:** any name resolves to two ids, or any id changes its name in a way not listed in C2.

### C4: Season-bound league membership

- **Goal:** correct foreign leagues without retroactive change (D5; MS §3–§4).
- **Scope:**
  - `competitionHistory` data for F03, F14, F15, F17, F18, F19, F20, F21 (Teucro: `approximate`) and S6 (competition alias, `int-hun-2b` canonical).
  - `CareerState.clubWorldBaseline` (optional). New careers set it; absence means legacy.
  - `clubCompetitionForSeason`, with the order defined in MS §3.2.
  - Move the readers listed in MS §4.3. Swedish readers stay bit-identical.
  - T7 forward-compatibility guard: the loader warns and refuses to continue on an unknown `clubWorldBaseline`, or on ids it cannot resolve, and offers export.
- **Systems and files:**
  - `game-data/clubs.ts` (history data);
  - `game-data/clubIdentity.ts`;
  - `career/competitionMembership.ts`, `careerWorld.ts`, `worldCompetitions.ts`, `scoutDiscovery.ts`;
  - `players/market.ts`;
  - `rating/gamePrior/clubContextTier.ts`;
  - `career/careerCreation` (marker);
  - `save/saveRepository.ts` (guard only).
- **Dependencies:** C1, D5, and T6 research for the Danish and Norwegian data. Unresolved entries are left out rather than guessed.
- **Acceptance:**
  - A legacy fixture mid-season: every foreign club's league, the world pool, foreign-buyer candidate lists and rating priors are identical to v8.
  - The same fixture after rollover: Leipzig and Minden are in ger-2; Balingen is in ger-1; Fram is in isl-1; Komló is in hun-1; Anaitasuna is in esp-2.
  - A new career shows the corrected leagues from day one.
  - Swedish transitions are byte-identical before and after on all fixtures.
- **Tests:**
  - the resolver truth table;
  - fixture mid-season equality;
  - a rollover test;
  - a foreign-bid determinism test (same seed, legacy career: same buyer pick as v8 before rollover);
  - the rollback test (an old build reads a new-career save without crashing).
- **Risks:**
  - A missed direct reader shows the new league early. Mitigation: grep gate in CI for `.competitionId` reads outside the resolver allow-list.
  - Foreign-bid picks change after rollover. This is intended and documented.
- **Stop conditions:**
  - any Swedish transition output changes;
  - any legacy fixture differs before rollover;
  - research for a league is unresolved (ship without that league's entry).

### C5: New clubs and tombstones

- **Goal:** add the missing real clubs and retire the wrong ones safely.
- **Scope:**
  - New ids with `validFrom: 2026/27`:
    - SG BBM Bietigheim (`ger1-bietigheim`);
    - KIF Kolding (`den1-kif-kolding`);
    - the F05 replacement (D3);
    - the Córdoba replacement (D6);
    - optionally the D2 clubs.
  - Tombstones: `ger2-wilhelmshaven` (`status: retired`, `duplicateOf: ger1-stuttgart`, `retiredReason`), and `esp2-cordoba` if D6-A. TV Bittenfeld becomes a `historicalNames` entry on `ger1-stuttgart`.
  - T2: per-club backfill of world squads and ratings, replacing the single sentinels at `careerInitialization.ts:173,187`. It applies to existing careers only for seasons the career has not started.
  - S4 is new careers only, and only if verified.
- **Systems and files:**
  - `game-data/clubs.ts`;
  - `career/careerInitialization.ts`;
  - `career/worldPoolIntegration.ts`;
  - real-world bundle scripts, only if a squad source exists.
- **Dependencies:** C4 (new clubs are listed through the resolver by `validFrom`); D3 and D6 for the replacements.
- **Acceptance:**
  - every id ever written to any fixture still resolves through `getClub`;
  - tombstones are excluded from enumeration after `validTo` but render in history;
  - no Swedish league size changes in existing careers;
  - a new club appears in a legacy career only from its next season.
- **Tests:**
  - an all-ids-resolve test over fixtures;
  - tombstone render;
  - per-club backfill idempotence (load twice = load once);
  - `INVALID_TARGET_SIZE` regression on all fixtures.
- **Risks:**
  - A new club in `FOREIGN_LEAGUES` changes foreign-bid picks. It is gated to the next season.
  - Backfill cost on load. It is per club and runs only once.
- **Stop conditions:** any fixture fails to load, or any Swedish size check fails.

### C6: Club relationships

- **Goal:** model the 11 second and U teams and the existing five, without changing cooperation logic (D9, L9).
- **Scope:**
  - Static `relations[]` for F22–F28 and S2, with `relationConfidence` and evidence. `PERMANENT_B_TEAM_PAIRS` is unchanged.
  - A new idempotent seeder, `seedStaticRelationPartnerships`. It adds `AFFILIATED_B_TEAM` rows, with ids following the `bteam-<A>-<B>` pattern:
    - legacy careers: `startDate` = next season start;
    - new careers: career start.
  - Development-partnership candidate lists exclude every club with an active static relation.
  - An existing active development partnership with a newly linked team runs to `endDate` and cannot be renewed (D9-A1).
  - Relation labels for the UI (D7), shown as text only.
- **Systems and files:**
  - `career/clubPartnerships.ts` (new seeder and candidate filter; `cooperationEligibility.ts` untouched);
  - `career/saveMigration.ts` (call the seeder);
  - `game-data/clubs.ts`.
- **Dependencies:** C1, C3, D7, D8, D9.
- **Acceptance:**
  - `cooperationEligibility.ts` is byte-identical;
  - the five existing rows are unchanged;
  - legacy fixtures: no row affects the in-progress season (eligibility results identical before rollover);
  - after rollover the cap applies (HK Lif Blå cannot promote while LIF Lindesberg is in Division 1);
  - candidate lists exclude all 16 linked teams.
- **Tests:** seeder idempotence; eligibility before and after rollover; a development-partnership run-out test; an HK Cliff manager fixture loads and plays a rollover.
- **Risks:** changed promotion outcomes in existing careers from the next season. This is intended, reflects SHF rules, and is documented in release notes.
- **Stop conditions:** any change in `cooperationEligibility.ts`, or any change to an existing row.
- **C6b (only if D8-B is chosen):** a v9 retype of IF Kristianstad, with a `pre-v9:<saveId>` backup and a run-twice test. **Not recommended.**

### C7: Club identity integration

- **Goal:** make the Club Identity Registry mirror the corrected records, keeping L2–L5 and L8 exactly.
- **Scope:**
  - The registry build reads `canonicalId`, `status`, `relations`, `parentClubId` and `historicalNames` from the records; they are never edited by hand.
  - Tombstones: `kit: null`, fallback rendering.
  - New ids enter as `NOT_RESEARCHED`, with the orange fallback until researched.
  - Re-research the F03 Anaitasuna and replacement-club kits.
  - Align the `clubs.ts` placeholder colours to the registry where the registry is VERIFIED or PROBABLE (F30 HK Cliff yellow).
  - Relation labels in the Design Lab.
  - Production consumption of the registry by the Arena Nights UI is a separate redesign milestone, not part of this roadmap.
- **Systems and files:**
  - `design-lab/experience-2027/club-identity/*` (build, verify);
  - `game-data/clubs.ts` (colours only, when production adopts them).
- **Dependencies:** C2–C6.
- **Acceptance:**
  - `verify-club-identity.cjs`: 0 issues;
  - `verify-amendment.cjs`: 231/551 intact;
  - Ice Silver, fallback and status rules unchanged;
  - no affiliate inherits colours.
- **Tests:** both verifiers; a registry/records 1:1 join test.
- **Risks:** colour changes in production placeholders are visible, but cosmetic.
- **Stop conditions:** any verifier issue; any L-rule regression.

### C8: Historical career validation

- **Goal:** prove that no club changes identity across many seasons.
- **Scope:**
  - Scripted five-season soaks: a legacy fixture plus a new career, for Tumba, HK Cliff and a Division 1 club.
  - At least one real season rollover on an Alpha v8 save before production.
- **Dependencies:** C1–C7 (it can also run after each phase as a regression).
- **Acceptance:** all invariants in §3 hold after every rollover.
- **Stop conditions:** any invariant fails; production release is blocked.

---

## 2. Release gating

| Step | Rule |
|---|---|
| Per phase | Alpha build first. Fixtures and invariants green. One phase per release |
| Production | Only after C8 passes and one real rollover has run on an Alpha save |
| Communication | Release notes for C4 (foreign leagues change at the next season) and C6 (second-team promotion cap) |
| Backups | Ask testers to export before C4 and C6 releases, even though nothing is rewritten |

---

## 3. Test strategy

### 3.1 Identity invariants (checked after every load and every rollover)

| # | Invariant |
|---|---|
| I1 | Every club id in any save field (MS §2) resolves through `getClub` |
| I2 | No id changes meaning: the `canonicalId` per id is constant across builds (snapshot) |
| I3 | Frozen `competitionId` is identical to the v8 snapshot for all ids |
| I4 | Legacy careers: before their first rollover, every club's league, world pool, foreign-buyer pool and rating prior equal v8 |
| I5 | Swedish membership is written only by the career's transition; transition output is byte-identical to before for the same input |
| I6 | Results, tables, ties and fixtures in `seasonHistory` are unchanged by identity data changes (ids, goals, points) |
| I7 | Partnership rows: ids are unique; existing rows are never modified; the cooperation cap result matches `cooperationEligibility` unchanged |
| I8 | No two ids resolve from the same display name; second-team names never resolve to the parent |
| I9 | Tombstones never appear in enumeration after `validTo`, and always render in history |
| I10 | Visual: every registry entry joins one storage id; fallback only for UNKNOWN or NOT_RESEARCHED; Ice Silver only for achromatic primaries; no inherited colours |

### 3.2 The twelve areas

| # | Area | Test |
|---|---|---|
| 1 | New career | Create Tumba, HK Cliff and a Division 2-promoted club: corrected foreign leagues, relations seeded at start, marker set, I1–I10 |
| 2 | Existing v8 career | Load every fixture: deep-equal state apart from derived display; I4 holds; no field rewritten (the persisted bytes differ only in fields the build already rewrites today) |
| 3 | Migration to v9 | Only if D8-B: the v9 step runs twice = once; the `pre-v9` backup exists; a v8 build rejects the v9 portable backup with the existing message |
| 4 | Five-season career | Scripted soak from 2026/27 to 2031/32: I1–I9 after each rollover; foreign leagues carry the last known season forward |
| 5 | Promotion and relegation | Promote and relegate Swedish clubs through `gameContinuity` rules; `competitionHistory` never overrides career membership (I5) |
| 6 | Club change | The manager moves club mid-career and at season end; partnership rows and membership unaffected; `managedClubId` undefined → clubless accent |
| 7 | International clubs | Legacy vs new career: world pool, foreign buyers and priors per season (I4); the rollover switch; tombstones excluded |
| 8 | B and U teams | All 16 linked teams: no candidate offers; cap before and after rollover; HK Cliff manager career survives two rollovers |
| 9 | Ended cooperation | A development partnership ending before or after 31 Dec: the existing late-termination rule result is unchanged; a newly linked team's active partnership runs out without renewal |
| 10 | Historical results | Rename a club (C2): old seasons show the season-correct name (T8); results and points identical (I6) |
| 11 | Save/load | Every fixture: load → save → load is stable; portable backup export → import round trip; IndexedDB and backup paths both covered |
| 12 | Rollback | Run the previous build against saves written by the new build (legacy and new career): loads without crash; T7 guard shows the warning for unknown baselines; Swedish transition still succeeds |

**Specific multi-rollover identity test.** For each fixture, record the tuple (id → canonicalId, name per season, league per season, parent per season) after each of five rollovers. Compare against an expected table generated from the static data plus the career's own `seasonHistory`. A mismatch fails the build.
