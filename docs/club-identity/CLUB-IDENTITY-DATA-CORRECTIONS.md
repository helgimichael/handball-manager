# Club Identity — Data Corrections (C2)

**Phase:** C2. **Status:** PASS (with explicitly deferred items listed in §3).
**Branch:** `feat/club-identity-implementation`. Baseline mapping: `CLUB-IDENTITY-C0-BASELINE.md` (immutable).

## 1. How corrections are stored

| Layer | Where | Rule |
|---|---|---|
| Display fields (`name`, `shortName`, `city`) | `apps/game/lib/game-data/clubs.ts` (the record) | Edited in place; the id never changes |
| Identity metadata (`canonicalId`, `legacyIdNote`, `aliases`, `historicalNames`, `externalIds`, `status`, `approximate`, `identityNote`, `addedInWorld`, `competitionHistory`, `relations`) | `apps/game/lib/game-data/clubIdentityData.ts` | Merged into the record when `CLUBS` is built (`clubs.ts`), so `getClub` returns one record — one source of truth |
| Frozen league (`competitionId`) | `clubs.ts` | **Never edited.** Snapshot `lib/game-data/__snapshots__/club-legacy-baseline.v8.json` (202 ids) is enforced by `clubIdentity.test.ts` |
| Real-world league per season | `competitionHistory` | Append-only; read only through the career resolver (C3) |
| Competition alias | `competitions.ts` `canonicalCompetitionId` | Metadata; stored competition ids are never rewritten |

## 2. Findings addressed

| # | Id(s) | Correction applied | Class | Evidence |
|---|---|---|---|---|
| F01 | `esp1-anaitasuna` | `canonicalId es-bidasoa-irun`, `legacyIdNote`, aliases, Wikipedia id. Display unchanged (Bidasoa Irun) | A | Liga ASOBAL 2025/26 |
| F02 | `esp1-logrono` | `canonicalId es-ademar-leon`, `legacyIdNote`, aliases | A | asobal.es |
| F03 | `esp1-alicante` | `canonicalId es-anaitasuna`, `legacyIdNote`, name Helvetia Anaitasuna → **SCDR Anaitasuna** (sponsor name kept as alias), league esp-1 → **esp-2 from 2026/27** (`competitionHistory`) | A + B | ASOBAL relegation; 2026 play-off |
| F04 | `hun1-gyor` | `canonicalId hu-tatabanya`, `legacyIdNote`, name Grundfos Tatabánya → **Tatabánya KC** (D4 neutral), MOL/Grundfos as aliases | A | NB I 2025/26 |
| F05 | `ger2-wilhelmshaven` | **Tombstone**: `status: retired`, `validTo: 2025/26`, `duplicateOf: ger1-stuttgart` (informational), `retiredReason`, `legacyIdNote`. Kept in `CLUBS` forever; never playable; never reused. "TV Bittenfeld" added as `historicalNames` (≤2014/15) on `ger1-stuttgart` | R | TVB Stuttgart history; WHV 3. Liga |
| F06 | `ger2-dessau` | name SC DHfK Dessau → **Dessau-Roßlauer HV 06**, city Dessau-Roßlau, aliases Dessauer HV/DRHV | A | Wikipedia DRHV |
| F07 | `den2-fif` | city Fredensborg → **Frederiksberg**, alias Frederiksberg IF | A | Wikipedia |
| F08 | `esp2-cisne` | city Ourense → **Pontevedra**, alias Club Cisne | A | planomato.com |
| F09 | `den1-hoj` | city Hjørring → **Ølstykke** | A | Håndboldligaen arena table |
| F10 | `hun2-eger` | name Egri Spartacus → **Eger-Eszterházy SzSE**, sponsor names as aliases | A | Wikipedia; Sofascore |
| F11 | `den1-sonderjyske` | city Aabenraa → **Sønderborg** | A | arena table |
| F12 | `den2-aarhus` | `founded: 2024`, `identityNote` (not the pre-2021 club; no predecessor link) | A | aarhush.dk |
| F13 | `den1-skanderborg` | name → **Skanderborg AGF Håndbold**, city → Skanderborg, `historicalNames` (Skanderborg Håndbold ≤2020/21; Skanderborg Aarhus Håndbold 2021/22–2022/23). REAL_WORLD key kept | A | Wikipedia |
| F14 | `ger1-leipzig`, `ger1-minden`, `ger2-balingen` + new `ger1-bietigheim` | history: Leipzig/Minden ger-1 → **ger-2**, Balingen ger-2 → **ger-1** from 2026/27; **SG BBM Bietigheim** added (`addedInWorld: cid-2026-27-v1`, ger-1 from 2026/27). GER_1 comment no longer claims "verified current list" | B + N | 2026/27 Handball-Bundesliga |
| F15 | `den1-hoj`, `den1-grindsted` + new `den1-kif-kolding` | history: both den-1 → **den-2** from 2026/27; **KIF Kolding** added (den-1 from 2026/27) | B + N | Håndboldligaen 2025/26; KIF Kolding |
| F16 | `hun1-veszprem`, `hun1-gyor` | Telekom Veszprém → **Veszprém KC** (D4 neutral; ONE Veszprém HC and Telekom Veszprém as aliases). REAL_WORLD key kept | A | EHF CL profile |
| F18 | `isl2-fram` | isl-2 → **isl-1** from 2026/27 | B | Wikipedia Fram |
| F19 | `svn2-skofjaloka`, `svn2-jeruzalem` | svn-2 → **svn-1** from 2026/27; RD Loka aliases + identity note (no predecessor id) | B | siol.net |
| F20 | `hun2-komlo` | hun-2 → **hun-1** from 2026/27; alias Carbonex-Komló | B | NB I 2025/26 |
| F21 | `esp2-teucro`, `esp2-cordoba` | both `approximate: true` with notes; ids kept, never re-labelled | A | planomato.com; eldebate.com |
| F22–F29, S2 | Swedish B/U teams | Metadata in C2 (`canonicalId`, SHF ids, licence holder for HK Cliff/Önnerediterna, F26 probable note). **Relations are C4** (see `CLUB-IDENTITY-RELATIONSHIPS-REPORT.md`) | A / P+ | Profixio |
| F30–F33 | kits | **C5** (see `CLUB-IDENTITY-VISUAL-INTEGRATION-REPORT.md`) | K | registry |
| S1 | `ger1-hamburg` | HSV Hamburg → **Handball Club Hamburg** (HC Hamburg); historical HSV Handball ≤2015/16; aliases | A | flashscore.de; Wikipedia |
| S3 | `swe2-guif` | One name source: `CANONICAL_CLUB_MAP` full names are now **generated from the club records**; the unsupported "HK Guif" became "Eskilstuna Guif IF" / short "Eskilstuna Guif"; aliases Guif, IF Guif | A | Wikipedia; Sofascore |
| S5 | all `se_div2_team_*` | `externalIds.profixioTeam` derived per season from `sourceRegistration` (no second copy); 18 SHF association ids recorded | A | Profixio |
| S6 | `hun-2` / `int-hun-2b` | `hun-2` relabelled **NB I/B** (was "NB II") with `canonicalCompetitionId: int-hun-2b` | A | Wikipedia NB I/B |

**Name resolution hardening (C2, also T3/T8):** `getCanonicalClubName`/`ShortName` resolve by id first, then by a *unique* exact name; an ambiguous name is never resolved. `clubDisplayName(id, season)` returns the season-correct historical name (T8 resolver; history views use it in C5).

## 3. Deferred (explicitly, with reason)

| Item | Why deferred | What is in place instead |
|---|---|---|
| F17 Norway (Bodø, Fjellhammer, Sandnes) | 2026/27 movements unverified (T6). A web re-check on 2026-11-13 found no confirmed 2026/27 list | No `competitionHistory`; leagues unchanged. Roadmap rule: "research unresolved → ship without that league's entry" |
| F15 Denmark second promotee | Unconfirmed (T6) | den-1 has 13 clubs from 2026/27 in the real-world layer (foreign leagues have no fixtures) |
| F05 replacement 2. Bundesliga club | Owner decision D3 not taken | Tombstone only; ger-2 one club short (cosmetic) |
| F21 Córdoba retirement + replacement | Owner decision D6 not taken | `approximate: true` + note |
| D2 missing clubs (Logroño, Alicante, Győr) | Recommended "not now" (no squad source) | `legacyIdNote` documents that they would get NEW ids |
| S4 Bodens BK reserve | Unverified; not imported | Unchanged |
| S6 club consolidation (Eger, Cegléd into int-hun-2b) | 2026/27 tier of Eger/Cegléd unverified | Competition alias metadata only |
| HCH rename date, Grundfos/Telekom sponsor-name end seasons | Dates unconfirmed | Former names kept as aliases (search only), not as season-bounded display names |

## 4. Safety and compatibility

- `competitionId` of all 202 legacy ids is byte-identical to `76513bd` (snapshot test).
- `getClubsByCompetition` = legacy baseline: excludes the two new epoch-tagged clubs, so legacy enumeration and order are unchanged (test over every competition).
- Names are resolved live; old inbox and bid-motive text keeps old wording (accepted as history).
- No save field is written by C2. Rollback: revert the commit.
- Changed test expectation: `playtest05Improvement.test.ts` asserted the unsupported "HK Guif"; it now asserts the corrected S3 name. No assertion was removed.

## 5. Verification

- `lib/game-data/clubIdentity.test.ts`, `lib/game-data/clubIdentityCorrections.test.ts`: 15/15 pass.
- 364 targeted tests over every suite touching club names, counts, crests, partnerships, world pool and transitions: 364/364 pass (`C:\DEV\QA\logs\club-identity\c2-targeted.log`).
- TypeScript clean; scoped ESLint clean.
