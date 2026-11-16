# Club Identity — C0 Baseline and Identity Mapping (immutable)

**Status:** Frozen baseline. This document records the state *before* any C1–C6 change. Later phases must not edit it; corrections go in the phase reports.
**Date:** 2026-11-13 (machine date; the design documents use the game-world date 2026-11-14).
**Worktree:** `C:\DEV\WORKTREES\handball-manager\club-identity-implementation`, branch `feat/club-identity-implementation`, created from `design/hm-experience-2027` @ `76513bd`.

## 1. Repository baseline

| Item | Value |
|---|---|
| Design branch | `design/hm-experience-2027` @ `76513bd` (clean worktree `experience-2027`) |
| Production baseline | `main` @ `9302bb1` ("Division 2 playable qualification Alpha release report"). `design/hm-experience-2027` = `main` + 7 docs/design-lab commits (merge-base `9302bb1`), so this branch carries all production code of `main` |
| Remote | `origin` = GitHub `handball-manager`. Nothing is pushed by this assignment |
| Other worktrees | 41 worktrees exist (listed by `git worktree list` at start). None was touched, switched, cleaned or deleted |
| Uncommitted changes | Main checkout (`work/preserved-main-before-alpha-hotfix-2026-11-08`): untracked `.claude/`, `docs/audit/` only — left alone. `experience-2027`: clean |
| Save schema | `CURRENT_SAVE_SCHEMA_VERSION = 8` (`apps/game/lib/save/saveRepository.ts`) |
| Clubs | 202 in `CLUBS` (105 SWE, 18 DEN, 22 GER, 10 NOR, 10 ESP, 9 HUN, 6 SVN, 6 ISL, 17 other int-*). 0 duplicate ids, 0 duplicate names, every `competitionId` resolves (33 competitions) |
| Club Identity Registry | `design-lab/experience-2027/club-identity/registry.json`: 202 entries (118 VERIFIED, 50 PROBABLE, 25 UNCERTAIN, 9 UNKNOWN); neon rules 147 primary, 45 Ice Silver, 10 fallback orange |
| Design set | 231 surface recommendations, 551 alternatives (verified by `verify-amendment.cjs`, not modified here) |

## 2. Documentation read and decisions verified

Read in full: FINAL-DECISIONS, MIGRATION-STRATEGY, IMPLEMENTATION-ROADMAP, CORRECTION-PLAN (F01–F33, S1–S6), plus the registry, kit audit and identity findings index.

| Decision | Owner status (this assignment) | Implementation consequence |
|---|---|---|
| D1 keep ids, canonical metadata | Approved | `canonicalId` + `legacyIdNote`, no re-key |
| D5 season-bound leagues | Approved | frozen `competitionId`, `competitionHistory`, `clubWorldBaseline` marker, resolver |
| D7 HK Cliff | Approved | selectable, relation label "Hammarby U" |
| D8 IF Kristianstad | Approved (option A) | keep row, `relationConfidence: PARTIAL`, no v9 |
| D9 11 Division 2 relations | Approved (A + A1) | separate seeder, next-season start in existing careers, development partnerships run out |
| D11 tester saves | Approved with consent condition | No tester exports or consents exist in the repository → internally generated representative saves are used (see §7) |
| D2, D3, D4, D6, D10 | Not approved / later | D4 and D10 follow the documented recommendations (display-only, reversible). D2/D3/D6 replacement clubs are **deferred** (no owner choice; no invented clubs) |
| L1–L10 | Locked | Not reopened |

**Roadmap vs code check.** Every file and line cited by MIGRATION-STRATEGY §2–§4 was re-located in this worktree. Two refinements to the roadmap's reader list were found (both recorded in §5): `cpuCandidateEvaluation.ts:244` (international label) and the world-pool economic backfill (`worldPoolIntegration.ts:20`) read static leagues; the latter is squad-keyed and unaffected (no moving club has a squad).

## 3. Collision and conflict check

- New ids planned: `ger1-bietigheim`, `den1-kif-kolding` — **absent** today, no collision.
- No existing id is renamed, merged or deleted.
- `ger2-wilhelmshaven` is retired (tombstone) and stays in `CLUBS` forever.
- No unexplained identity conflict was found. **No stop condition triggered.**

## 4. Before/after identity mapping (every affected id)

Legend — *Migration*: **A** metadata/display only; **B** season-gated world data (legacy careers: next rollover; new careers: immediately); **P+** additive relation row; **R** tombstone; **N** new id; **K** visual only; **DEF** deferred with reason. *Risk* is the risk to existing careers.

| Existing id | Canonical identity | Display name (before → after) | Country | League now (frozen) | League 2026/27 (new careers) | Relationships | Aliases / historical names | Visual (registry) | Migration | Evidence | Risk |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `esp1-anaitasuna` (F01) | `es-bidasoa-irun` | Bidasoa Irun (unchanged) | ESP | esp-1 | esp-1 | — | Irudek Bidasoa Irún | VERIFIED `#ffd337` | A, legacyIdNote | Liga ASOBAL 2025/26 (Wikipedia) | Low |
| `esp1-logrono` (F02) | `es-ademar-leon` | Ademar León (unchanged) | ESP | esp-1 | esp-1 | — | ABANCA Ademar León | VERIFIED Ice Silver | A, legacyIdNote | ASOBAL; asobal.es/equipos/ADE | Low |
| `esp1-alicante` (F03) | `es-anaitasuna` | Helvetia Anaitasuna → SCDR Anaitasuna | ESP | esp-1 | **esp-2** | — | Helvetia Anaitasuna | UNCERTAIN `#41e77c` | A + B, legacyIdNote | ASOBAL 2024/25 relegated; Plata 2025/26; lost 2026 play-off | Low |
| `hun1-gyor` (F04, F16) | `hu-tatabanya` | Grundfos Tatabánya → Tatabánya KC | HUN | hun-1 | hun-1 | — | MOL Tatabánya KC; hist. Grundfos Tatabánya KC | VERIFIED `#5193fd` | A, legacyIdNote | NB I 2025/26 (Wikipedia) | Low (old bid text keeps old name) |
| `ger2-wilhelmshaven` (F05) | duplicate of `ger1-stuttgart` | TV Bittenfeld (kept for history) | GER | ger-2 | none (retired) | `duplicateOf: ger1-stuttgart` (informational) | — | kit removed → fallback | R (tombstone); replacement club DEF (D3) | TVB Stuttgart history; WHV in 3. Liga | None (ger-2 unread by careers) |
| `ger1-stuttgart` | `de-tvb-stuttgart` | TVB Stuttgart (unchanged) | GER | ger-1 | ger-1 | — | hist. TV Bittenfeld (≤2014/15) | VERIFIED | A | Wikipedia TVB Stuttgart | None |
| `ger2-dessau` (F06) | `de-dessau-rosslauer-hv` | SC DHfK Dessau → Dessau-Roßlauer HV 06 | GER | ger-2 | ger-2 | — | Dessauer HV, DRHV | VERIFIED | A | Wikipedia DRHV; 2. HBL 2026/27 schedule | None |
| `den2-fif` (F07) | `dk-fif` | FIF Håndbold; city Fredensborg → Frederiksberg | DEN | den-2 | den-2 | — | Frederiksberg IF | UNCERTAIN Ice Silver | A | Wikipedia Frederiksberg IF | None |
| `esp2-cisne` (F08) | `es-cisne` | Cisne Balonmano; city Ourense → Pontevedra | ESP | esp-2 | esp-2 | — | Club Cisne | UNCERTAIN Ice Silver | A | planomato.com | None |
| `den1-hoj` (F09, F15) | `dk-hoj-elite` | HØJ Elite; city Hjørring → Ølstykke | DEN | den-1 | **den-2** | — | — | VERIFIED Ice Silver | A + B | Håndboldligaen 2025/26 (relegation play-off lost) | Low |
| `hun2-eger` (F10) | `hu-eger-eszterhazy` | Egri Spartacus → Eger-Eszterházy SzSE | HUN | hun-2 | hun-2 | — | SBS-Eger, QHB-Eger | UNCERTAIN | A (league consolidation S6 DEF) | Wikipedia; Sofascore NB I/B 2025/26 | None |
| `den1-sonderjyske` (F11) | `dk-sonderjyske` | SønderjyskE Håndbold; city Aabenraa → Sønderborg | DEN | den-1 | den-1 | — | — | UNCERTAIN | A | Håndboldligaen 2025/26 arena table | None |
| `den2-aarhus` (F12) | `dk-aarhus-handbold-2024` | Aarhus Håndbold Herrer (unchanged) | DEN | den-2 | den-2 | none (explicitly not the pre-2021 club) | — | PROBABLE (F32 closed) | A (`founded: 2024`, note) | aarhush.dk press release | None |
| `den1-skanderborg` (F13) | `dk-skanderborg-agf` | Skanderborg Aarhus → Skanderborg AGF Håndbold; city Aarhus → Skanderborg | DEN | den-1 | den-1 | — | hist. Skanderborg Håndbold (≤2020/21), Skanderborg Aarhus Håndbold (2021/22–2022/23) | PROBABLE Ice Silver | A (REAL_WORLD key kept) | Wikipedia Skanderborg AGF | Low |
| `ger1-leipzig` (F14) | `de-sc-dhfk-leipzig` | unchanged | GER | ger-1 | **ger-2** | — | — | VERIFIED | B | 2026/27 Handball-Bundesliga (Wikipedia) | Low–Med (world pool/foreign buyers after rollover) |
| `ger1-minden` (F14) | `de-gwd-minden` | unchanged | GER | ger-1 | **ger-2** | — | — | VERIFIED | B | idem | Low–Med |
| `ger2-balingen` (F14) | `de-hbw-balingen` | unchanged | GER | ger-2 | **ger-1** | — | — | VERIFIED | B | idem | Low–Med |
| *(new)* `ger1-bietigheim` (F14) | `de-sg-bbm-bietigheim` | SG BBM Bietigheim | GER | — (not in legacy world) | ger-1 | — | — | NOT_RESEARCHED → fallback | N + B | idem | Low (legacy: from next rollover) |
| `den1-grindsted` (F15) | `dk-grindsted-gif` | unchanged | DEN | den-1 | **den-2** | — | — | UNCERTAIN | B | Håndboldligaen 2025/26 (last place) | Low |
| *(new)* `den1-kif-kolding` (F15) | `dk-kif-kolding` | KIF Kolding | DEN | — | den-1 | — | — | NOT_RESEARCHED → fallback | N + B | Håndboldligaen 2025/26 play-off; Wikipedia KIF Kolding | Low |
| `hun1-veszprem` (F16) | `hu-veszprem` | Telekom Veszprém → Veszprém KC | HUN | hun-1 | hun-1 | parent of `int-veszprem-academy` (ACADEMY) | ONE Veszprém HC; hist. Telekom Veszprém | VERIFIED | A (REAL_WORLD key kept) | EHF CL 2026/27 profile | Low (old bid text keeps old name) |
| `nor1-bodo`, `nor2-fjellhammer`, `nor2-sandnes` (F17) | unchanged | unchanged | NOR | nor-1 / nor-2 / nor-2 | **unchanged (DEF)** | — | — | various | DEF: 2026/27 movements unverified (T6; web re-check 2026-11-13 inconclusive) | Wikipedia (2025/26 only) | None |
| `isl2-fram` (F18) | `is-fram` | unchanged | ISL | isl-2 | **isl-1** | — | — | UNCERTAIN | B | Wikipedia Fram; Úrvalsdeild | Low |
| `svn2-skofjaloka` (F19) | `si-rd-loka` | RD Škofja Loka (unchanged) | SVN | svn-2 | **svn-1** | — | hist. note: pre-2011 RD Loka (no predecessor link) | UNCERTAIN | B | siol.net Liga NLB 2025/26 | None |
| `svn2-jeruzalem` (F19) | `si-jeruzalem-ormoz` | unchanged | SVN | svn-2 | **svn-1** | — | — | UNCERTAIN | B | idem | None |
| `hun2-komlo` (F20) | `hu-komlo` | Komlói Bányász (unchanged) | HUN | hun-2 | **hun-1** | — | Carbonex-Komló | UNCERTAIN | B | NB I 2025/26 | Low |
| `esp2-teucro` (F21) | `es-teucro` | Teucro Pontevedra (unchanged) | ESP | esp-2 | esp-2, `approximate: true` | — | — | UNCERTAIN | A (flag) | planomato.com (Primera Nacional 2025/26) | None |
| `esp2-cordoba` (F21) | unresolved | BM Córdoba (unchanged) | ESP | esp-2 | esp-2, `approximate: true` | — | — | UNKNOWN fallback | A (flag); retirement + replacement DEF (D6) | eldebate.com | None |
| `se_club_hk_cliff` (F22, F30) | `se-hk-cliff` | HK Cliff (unchanged, selectable) | SWE | Div 1 Norra | Div 1 Norra (career-owned) | `U_TEAM_UNDER_PARTNER_LICENCE` of Hammarby (FULL); existing row unchanged; label "Hammarby U" | — | PROBABLE yellow | A + K | Profixio 1578872; SHF 26051 | None |
| `se_club_if_kristianstad` (F23) | `se-if-kristianstad` | unchanged | SWE | Div 1 Södra | career-owned | `PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS` of IFK Kristianstad, `PARTIAL`; existing B-team row unchanged | — | PROBABLE | A (D8-A) | Profixio 1575285; SHF 25971 | None |
| `se_club_hp_alingsas` (F24) | `se-hp-alingsas` | unchanged | SWE | Div 1 Södra | career-owned | `SECOND_TEAM` of Alingsås HK (FULL) | — | PROBABLE | A | Profixio 1572549 | None |
| `se_club_hk_onnerediterna` (F25) | `se-hk-onnerediterna` | unchanged | SWE | Div 1 Södra | career-owned | `SECOND_TEAM_UNDER_PARTNER_ASSOCIATION` of Önnereds HK (FULL) | — | UNCERTAIN | A | Profixio 1575759; SHF 26228 | None |
| `se_club_hk_s_hof` (F26) | `se-hk-s-hof` | unchanged | SWE | Div 1 Södra | career-owned | `SECOND_TEAM` of IK Sävehof (PROBABLE confidence, unverified on Profixio) | — | PROBABLE | A | iksungdom.se P18 | None |
| `se_div2_team_1585295` (F27) | `se-lugi-hf-u` | LUGI HF U | SWE | Div 2 Syd | career-owned | `U_TEAM` of Lugi HF (FULL) | — | PROBABLE | P+ | Profixio 1585295 | Low |
| `se_div2_team_1582183` (F27) | `se-hf-karlskrona-u` | HF Karlskrona U | SWE | Div 2 Syd | career-owned | `SAME_CLUB_SECOND_TEAM` of HF Karlskrona (FULL) | — | PROBABLE Ice Silver | P+ | Profixio 1582183 | Low |
| `se_div2_team_1585596` (F27) | `se-ystads-if-u` | Ystads IF HF U | SWE | Div 2 Syd | career-owned | `U_TEAM` of Ystads IF HF (FULL) | — | VERIFIED Ice Silver | P+ | Profixio 1585596 | Low |
| `se_div2_team_1582988` (F28) | `se-tumba-hk` | Tumba HK | SWE | Div 2 Öst | career-owned | `SECOND_TEAM_UNDER_PARTNER_ASSOCIATION` of IFK Tumba HK (FULL) | — | VERIFIED | P+ (TUMBA_CLUB_ID unchanged) | Profixio 1582988 | Low |
| `se_div2_team_1578886` (F28) | `se-vasterasirsta-hk` | VästeråsIrsta HK | SWE | Div 2 Mitt | career-owned | idem of VästeråsIrsta HF (FULL) | — | UNKNOWN fallback | P+ | Profixio 1578886 | Low |
| `se_div2_team_1575715` (F28) | `se-hk-varberg-09` | HK Varberg 09 | SWE | Div 2 Väst | career-owned | idem of HK Varberg (MAJORITY) | — | UNKNOWN fallback | P+ | Profixio 1575715 | Low |
| `se_div2_team_1578982` (F28) | `se-helsingborgs-hk` | Helsingborgs HK | SWE | Div 2 Syd | career-owned | idem of OV Helsingborg (FULL) | — | PROBABLE | P+ | Profixio 1578982 | Low |
| `se_div2_team_1579219` (F28) | `se-malmo-hp` | Malmö HP | SWE | Div 2 Syd | career-owned | idem of HK Malmö (FULL) | — | UNKNOWN fallback | P+ | Profixio 1579219 | Low |
| `se_div2_team_1575788` (F28) | `se-hk-lif-bla` | HK Lif Blå | SWE | Div 2 Mitt | career-owned | idem of LIF Lindesberg (FULL) | — | PROBABLE | P+ | Profixio 1575788 | Low |
| `se_div2_team_1583015` (F28) | `se-hk-ystadpagarna` | HK Ystadpågarna | SWE | Div 2 Syd | career-owned | idem of IFK Ystad HK (FULL) | — | PROBABLE | P+ | Profixio 1583015 | Low |
| `se_div2_team_1576008` (S2) | `se-lunds-hs-lejon` | Lunds HS Lejon | SWE | Div 2 Syd | career-owned | idem of H43 Lund HF (FULL) | H43 Lejonen | UNKNOWN fallback | P+ | Profixio 1576008 | Low |
| `se_div2_team_1578270` (F29) | `se-torslanda-hk` | Torslanda HK | SWE | Div 2 Väst | career-owned | `YOUTH_LINK` to HK Torslanda Elit (informational, no gameplay effect) | — | UNCERTAIN | A | Profixio 1578270 | None |
| `ger1-hamburg` (S1) | `de-handball-club-hamburg` | HSV Hamburg → Handball Club Hamburg | GER | ger-1 | ger-1 | — | HSV Hamburg; hist. HSV Handball (≤2015/16) | PROBABLE (kit kept, L-rule "renamed clubs keep kit") | A | flashscore.de; Wikipedia | Low |
| `swe2-guif` (S3) | `se-eskilstuna-guif` | Eskilstuna Guif IF (record); canonical map "HK Guif" → "Eskilstuna Guif" | SWE | Allsvenskan | career-owned | — | Guif, IF Guif | VERIFIED | A (one name source) | Wikipedia; Sofascore | None (media text only) |
| *(none)* Bodens BK reserve (S4) | — | — | SWE | — | — | — | — | — | DEF: unverified, not imported | sweden2026Data notes | None |
| all `se_div2_team_*` (S5) | unchanged | unchanged | SWE | — | — | — | — | — | A: `externalIds` (SHF id where known, Profixio per season) | Profixio | None |
| `hun-2` / `int-hun-2b` (S6) | competition alias | hun-2 sourceNote "NB II" → "NB I/B" | HUN | — | — | — | — | — | A: competition alias metadata only; club consolidation DEF | Wikipedia NB I/B | None |
| `int-veszprem-academy` | `hu-veszprem-academy` | unchanged | HUN | int-hun-2b | int-hun-2b | `ACADEMY` of `hun1-veszprem` | — | UNCERTAIN | A | correction plan F16 | None |

Kit findings F30–F33 are visual only (C5): F30 Cliff yellow already in registry; F31 follows the identities above (tombstone kit removed, new ids NOT_RESEARCHED); F32 closed; F33 affiliates keep their own or fallback colours, never the parent's.

## 5. Consumers of club identity and league membership (inventory)

**Static league readers (`Club.competitionId` / `getClubsByCompetition`) that can observe a *foreign* league change — must move to the career-aware resolver in C3:**

| File:line | Use | Plan |
|---|---|---|
| `lib/career/careerWorld.ts:42` | world-pool candidate clubs (scouting/transfers) | resolver |
| `lib/players/market.ts:72-75` | foreign buyer pool (pick by index) and country label | resolver; order preserved |
| `lib/career/scoutDiscovery.ts:94,112` | candidate competition label | resolver |
| `lib/career/cpuCandidateEvaluation.ts:244` | "international" flag | resolver |
| `lib/career/competitionMembership.ts:11` | the resolver itself | becomes season-aware |
| `lib/career/worldCompetitions.ts:69`, `lib/competition/tables.ts:18`, `lib/competition/season.ts:237`, `lib/competition/transition/careerSnapshot.ts:31`, `lib/career/seasonTransition.ts:135` | Swedish-only membership | **bit-identical** (Swedish clubs never consult real-world history) |
| `lib/rating/gamePrior/clubContextTier.ts:36,145` | rating priors (stateless) | unchanged; guarded by test: no REAL_WORLD club changes league (no squad-bearing club moves) |
| `lib/career/worldPoolIntegration.ts:20` | economic identity for world-pool squads | unchanged (squad-keyed, idempotent; no moving club has a squad) |
| `lib/players/market.ts:48` | manager's own domestic bar | out of scope (pre-existing Swedish inconsistency, MS §4.3) |

**Swedish-only / offline static readers (unchanged by design):** `careerInitialization.ts` (fetch by own league), `newCareer.ts:82-83` (own league fixtures), `clubPartnerships.ts:211,420`, `division1Integration.ts`, `youthIntake.ts:214-215,613`, `gameContinuity.ts:44,47`, economy (`clubEconomyIntegration.ts`, `clubHistoryGeneration.ts`, `contractIntegration.ts`, `trainingCompensation.ts`), staff (`staffCareerIntegration.ts`, `scoutPool.ts`), media (`worldTick.ts`), transfers (`playerInterest.ts`, `transferExecution.ts`), editor/rating pipeline (offline tools over static data), UI labels (`app/new-game`, `app/career/scouting`, `components/manager/*`, `components/game/Identity.tsx`, `lib/newGame/clubSelectionContext.ts`, `lib/manager/changeClub.ts`, `lib/manager/managerCareer.ts`).

**Club identity consumers:** `getClub` (every surface), `getCanonicalClubName`/`getCanonicalClubShortName` (media, inbox, news, match reports), `getCareerClub` (throws on unknown manager club), `PERMANENT_B_TEAM_PAIRS`/`isPermanentBTeamClub` (partnerships), `TUMBA_CLUB_ID`.

**Save loading and career initialisation:** `getOrCreateCareerState` → `migrateCareerState` (idempotent field-by-field; seeds permanent B-team rows at `saveMigration.ts:417`) → sentinel backfills (`careerInitialization.ts:173,187`). New careers: `createNewCareer` (`newCareer.ts`), B-team rows at `:256`.

**Transfers and foreign recruitment:** `market.ts` foreign buyers (`FOREIGN_LEAGUES` ger-1, den-1, nor-1, esp-1, hun-1), `getExternalCandidateClubs` (Swedish world + `WORLD_POOL_COMPETITION_IDS`), CPU candidate evaluation.

**Historical references:** `seasonHistory[]` stores club ids, competition ids, tables, fixtures, results, ties, transition receipts; never compacted. Baked text (inbox, bid motives) keeps old names. These are never rewritten by this work.

## 6. Rollback strategy

- All work is on the local branch `feat/club-identity-implementation`, one or more commits per phase; `git revert` of a phase commit restores the previous behaviour.
- No phase rewrites save data. New fields are optional and additive (`clubWorldBaseline`, extra partnership rows), the same precedent as `competitionMembership`/`clubPartnerships`. A rolled-back build reads the frozen `competitionId`, ignores the marker and keeps extra `AFFILIATED_B_TEAM` rows valid.
- No schema bump. If v9 ever became necessary the assignment stops first (prompt §C6).

## 7. Tester saves (D11)

No anonymised Alpha exports and no recorded tester consent exist in the repository (`apps/game/lib/save/__fixtures__/` does not exist). Per D11 the validation uses internally generated representative careers: legacy (marker-less) v8 states created through the production `createNewCareer` path with the marker removed, mid-season states, end-of-season states, an HK Cliff career and a career with an active development partnership. This gap is recorded, not a blocker.

## 8. Baseline test status

Recorded in `C:\DEV\QA\logs\club-identity\baseline-full-suite.log` (untouched code, `npm test` in `apps/game`). Summary is copied into the final report.
