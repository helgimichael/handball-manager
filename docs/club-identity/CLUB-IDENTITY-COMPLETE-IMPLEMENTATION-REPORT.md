# Club Identity — Complete Implementation Report (C0–C6)

**Branch:** `feat/club-identity-implementation` in the isolated worktree `C:\DEV\WORKTREES\handball-manager\club-identity-implementation`, from `design/hm-experience-2027` @ `76513bd` (= `main` @ `9302bb1` + 7 design commits).
**Local commits only.** Nothing was pushed, merged or deployed. No Alpha/production data, live save or tester career was touched. No other worktree was switched, cleaned or deleted.
**Save schema:** v8 (no v9).

## 1. Phase assessment

| Phase | Verdict | Summary |
|---|---|---|
| C0 Preparation and identity mapping | **PASS** | Immutable baseline + before/after mapping of every affected id (`CLUB-IDENTITY-C0-BASELINE.md`); consumer inventory; rollback strategy; no id collision. D11: no tester exports/consent → synthetic careers |
| C1 Canonical club identity | **PASS** | Optional identity fields, one metadata overlay merged into `CLUBS`, id-only resolution, ambiguity-safe name search, season-aware display names, frozen v8 `competitionId` snapshot (202 ids) |
| C2 Club database corrections | **PASS** (deferred items explicit) | All 33 findings + 6 supplementary items addressed or classified (`CLUB-IDENTITY-DATA-CORRECTIONS.md`); TVB/TV Bittenfeld duplicate retired as a never-reused tombstone; Bietigheim and KIF Kolding added; Norway (T6), Danish 2nd promotee, D3/D6 replacement clubs, S4, S6 club consolidation deferred with reasons |
| C3 Season-bound league membership | **PASS** | Frozen baseline + append-only history + `clubWorldBaseline` marker + career-aware resolver; every foreign-sensitive reader migrated; grep gate; T7 guard; Swedish transitions byte-identical to baseline (`CLUB-IDENTITY-SEASON-MEMBERSHIP-REPORT.md`) |
| C4 Club relationships | **PARTIAL — blocker** | 16 cooperation relations + 2 informational links as season-bound static facts, D7 HK Cliff, D8-A IF Kristianstad, labels, candidate exclusion, D9-A1 no renewal, seeder/termination mechanism tested. **Career agreements for the 11 Division 2 teams are gated off**: activating them deadlocks careers in the production transition engine; fixing that is a Swedish engine change outside this assignment (`CLUB-IDENTITY-RELATIONSHIPS-REPORT.md` §5, owner decision OD-1) |
| C5 Club identity integration | **PARTIAL** | One source of colour truth (registry → generated table → records); 179 hard-coded colour literals removed; active-club identity on the career shell (club change, clubless orange), fallback marker, relation labels; desktop + mobile verified; both design-lab verifiers 0 issues (231/551 intact). Arena Nights is not yet the production theme — that redesign remains the separate milestone (`CLUB-IDENTITY-VISUAL-INTEGRATION-REPORT.md` §4) |
| C6 Historical career validation | **PASS** | Scenarios A–F; NEW and LEGACY careers each five seasons with five rollovers, save/load after every rollover, club change + unemployment; invariants I1–I9 after every rollover (`CLUB-IDENTITY-SAVE-COMPATIBILITY-REPORT.md`) |

**Definition of done:** not fully met — C4 (Division 2 agreement activation) and C5 (Arena Nights production re-skin) are partial. Everything else is implemented, tested and committed.

## 2. Owner decisions still required

| # | Decision | Recommendation |
|---|---|---|
| OD-1 | How to activate the 11 Division 2 cooperation agreements without deadlocking careers | Approve a scoped "cooperation-aware transitions" engine milestone, then flip `DIVISION2_RELATION_AGREEMENTS_ENABLED` |
| OD-2 | Arena Nights production redesign milestone (surfaces consume `--club-neon` / `data-club-identity`) | Schedule as the next Experience 2027 milestone |
| D3 | Replacement 2. Bundesliga club for the retired `ger2-wilhelmshaven` | Any confirmed 2026/27 club, new id |
| D6 | Retire "BM Córdoba" and replace with a confirmed Plata club | Tombstone + new id |
| D2, D4 | Missing clubs; sponsor naming | D4 neutral names were applied (display only, reversible); D2 not added |
| T6 | Norway 2026/27 movements; Denmark's second promotee | Research, then append `competitionHistory` entries |
| D11 | Tester consent for anonymised exports | Still open; synthetic careers used |

## 3. Commits

| Commit | Phase | Message |
|---|---|---|
| `19420b2` | C0 | docs(club-identity): C0 baseline and identity mapping |
| `4d03df3` | C1 | feat(club-identity): C1 canonical club identity model |
| `e4d59c0` | C2 | feat(club-identity): C2 club database corrections |
| `879be9f` | C3 | feat(club-identity): C3 season-bound league membership |
| `c7c52b8` | C4 | feat(club-identity): C4 club relationships |
| `e8b3e8f` | C5 | feat(club-identity): C5 club identity integration |
| `08ab86f` | C5 | fix(club-identity): C5 browser verification fixes |
| `6619704` | C4 | fix(club-identity): gate Division 2 cooperation agreements (C4 blocker) |
| `376e8ad` | C6 | test(club-identity): C6 five-season historical career validation |
| (this commit) | all | docs(club-identity): final reports, verification and roadmap status |

Files changed `76513bd..376e8ad` (60 files, +7983 / −1352; `A` added, `M` modified):

```
    M	apps/game/app/career/history/page.tsx
    M	apps/game/app/career/players/page.tsx
    M	apps/game/app/career/scouting/page.tsx
    M	apps/game/app/game.css
    M	apps/game/app/new-game/page.tsx
    M	apps/game/components/GameShell.tsx
    M	apps/game/components/crests/clubIdentity.ts
    A	apps/game/components/game/ClubIdentityTags.tsx
    M	apps/game/components/game/Identity.tsx
    M	apps/game/components/manager/CompetitionWorkspace.tsx
    M	apps/game/lib/analysis/viewModels.ts
    A	apps/game/lib/career/activeClubIdentity.test.ts
    A	apps/game/lib/career/activeClubIdentity.ts
    M	apps/game/lib/career/careerInitialization.ts
    M	apps/game/lib/career/careerWorld.ts
    A	apps/game/lib/career/clubIdentityCareer.test.ts
    A	apps/game/lib/career/clubIdentitySoak.test.ts
    M	apps/game/lib/career/clubPartnerships.ts
    A	apps/game/lib/career/clubWorldCompatibility.ts
    A	apps/game/lib/career/clubWorldMembership.test.ts
    M	apps/game/lib/career/competitionMembership.ts
    M	apps/game/lib/career/cpuCandidateEvaluation.ts
    M	apps/game/lib/career/newCareer.ts
    M	apps/game/lib/career/playtest05Improvement.test.ts
    M	apps/game/lib/career/saveMigration.ts
    M	apps/game/lib/career/scoutDiscovery.ts
    A	apps/game/lib/career/staticRelationPartnerships.test.ts
    A	apps/game/lib/career/staticRelationPartnerships.ts
    M	apps/game/lib/career/types.ts
    A	apps/game/lib/game-data/__snapshots__/club-legacy-baseline.v8.json
    M	apps/game/lib/game-data/canonicalClubNames.ts
    A	apps/game/lib/game-data/clubIdentity.test.ts
    A	apps/game/lib/game-data/clubIdentity.ts
    A	apps/game/lib/game-data/clubIdentityCorrections.test.ts
    A	apps/game/lib/game-data/clubIdentityData.ts
    A	apps/game/lib/game-data/clubVisualIdentity.data.ts
    A	apps/game/lib/game-data/clubVisualIdentity.test.ts
    A	apps/game/lib/game-data/clubVisualIdentity.ts
    M	apps/game/lib/game-data/clubs.ts
    M	apps/game/lib/game-data/competitions.ts
    M	apps/game/lib/game-data/index.ts
    M	apps/game/lib/game-data/swedishDivision2.ts
    M	apps/game/lib/game-data/types.ts
    M	apps/game/lib/players/market.ts
    A	apps/game/scripts/export-club-identity-records.ts
    M	apps/game/scripts/game-test-files.json
    A	apps/game/scripts/generate-club-visual-identity.mjs
    M	design-lab/experience-2027/club-identity/build-registry.mjs
    M	design-lab/experience-2027/club-identity/clubs-extracted.json
    A	design-lab/experience-2027/club-identity/clubs-identity.json
    M	design-lab/experience-2027/club-identity/registry.json
    M	design-lab/experience-2027/club-identity/verify-club-identity.cjs
    M	design-lab/experience-2027/data/club-registry.js
    A	docs/club-identity/CLUB-IDENTITY-C0-BASELINE.md
    A	docs/club-identity/CLUB-IDENTITY-DATA-CORRECTIONS.md
    A	docs/club-identity/CLUB-IDENTITY-RELATIONSHIPS-REPORT.md
    A	docs/club-identity/CLUB-IDENTITY-SEASON-MEMBERSHIP-REPORT.md
    M	docs/experience-2027/HM-EXPERIENCE-2027-CLUB-KIT-AUDIT.md
    M	docs/experience-2027/HM-EXPERIENCE-2027-CLUB-KIT-REVIEW-LIST.md
    M	docs/experience-2027/HM-EXPERIENCE-2027-CLUB-SOURCE-REGISTER.md
```
The final docs commit adds the remaining reports and updates `HM-EXPERIENCE-2027-AMENDMENT-VERIFICATION.md`, `HM-EXPERIENCE-2027-CLUB-IDENTITY-VERIFICATION.md` (regenerated by the verifiers) and the roadmap.

## 4. Test results

| Check | Result | Log / evidence |
|---|---|---|
| Full bounded suite, baseline `76513bd` (untouched worktree) | 2934 tests · 2922 pass · **12 fail** | `C:\DEV\QA\logs\club-identity\baseline-suite.log` |
| Full bounded suite after C3 | 2958 · 2946 pass · 12 fail (identical set) | `c3-suite.log` |
| **Final full bounded suite** (all phases) | **2974 · 2962 pass · 12 fail — identical to baseline; 0 new failures; 0 timeouts; 0 cancelled** | `final-suite.log`, `final-failures.txt` |
| Bounds | `cpuQualityUpgrade.test.ts` excluded (known >90 min); 15-min per-test timeout; concurrency 4 | runner in scratchpad (not committed) |
| New Club Identity tests | 11 files in the manifest: `clubIdentity`, `clubIdentityCorrections`, `clubVisualIdentity` (game-data); `clubIdentityCareer`, `clubWorldMembership`, `staticRelationPartnerships`, `activeClubIdentity`, `clubIdentitySoak` (career) — all pass | final suite |
| Five-season soak (NEW + LEGACY) | 2/2 pass, 49 s | `c6-soak-final.log` |
| All competition-transition suites incl. the 3-season continuity test, with the gate active | pass (the only failure in that run was the soak on seed `club-identity-soak-new`, blocked by the pre-existing baseline limitation in §5; the soak then passed on its documented seed) | `c6-soak.log`, `c6-soak-final.log` |
| I5 Swedish transitions vs baseline | byte-identical, 3 rollovers | save-compatibility report §3 |
| TypeScript (`tsc --noEmit`, apps/game) | clean | — |
| Scoped ESLint (all changed files) | clean except 2 pre-existing baseline errors (GameShell set-state-in-effect; playtest05 `no-explicit-any`) | — |
| Production build (`next build`) | success, 58/58 pages | `c6-build.log` |
| Worker packaging (`build:worker`, no deploy) | success: "Worker saved… Successfully Verified". Three `Failed to copy` messages for native `sharp`/`@img` packages (Windows OpenNext copy of image modules; not compared against the baseline) | `worker-build.log` |
| Design-lab `verify-amendment.cjs` | 0 issues; 231 recommendations / 551 alternatives intact | `verify-amendment.log` |
| Design-lab `verify-club-identity.cjs` | 0 issues; 204/204 clubs, 708 renders | `verify-club-identity.log` |
| Browser (local dev, port 3761) | Desktop: first screen, New Game (labels, fallback marker), HK Cliff career shell, dashboard; Mobile 375 px: shell + menu, no horizontal overflow; clubless after resignation (orange, "Utan klubb"); no console errors | this session |

## 5. Known baseline failures (pre-existing on untouched `76513bd`)

The same 12 tests fail on the untouched baseline and on this branch (lists: `C:\DEV\QA\logs\club-identity\baseline-failures.txt`, `final-failures.txt`):
1. total real Allsvenskan player count matches the HM-DATA-1.5 corrected roster (284 players)
2. Continue Controller: same seed reproduces an identical season end-to-end
3. HBL bio milestone: CA/PA ratings are completely unaffected by the bio-data corrections
4. HBL bio milestone: exactly 265 unique active HBL playerIds, no duplicates
5. HM-PLAYTEST-IMPROVEMENT-02: Allsvenskan club cannot negotiate with top Handbollsligan stars (IMPOSSIBLE gate)
6. population audit: 1191/1191 real players receive a complete gameplay CA, PA and attribute branch
7. a complete initialization publishes one complete save using its own deterministic seed
8. bundled Handbollsligan squads, ratings, staff and dated identity snapshots equal native Node data
9. harness: the season-0 checkpoint reproduces the audited database baseline
10. legacy saves are neutral, intentions persist, one bad observation does not change direction or duplicate events
11. no cross-league name+DOB identity collision beyond documented owner decisions
12. persistent financial crisis and an ambitious player facing a sporting setback create explained gradual intentions

They concern player data, ratings, intentions and determinism; none touches club identity.
Also pre-existing: `lib/career/cpuQualityUpgrade.test.ts` exceeds 90 minutes and is excluded from both bounded runs; scoped ESLint errors in `GameShell.tsx` (set-state-in-effect) and `playtest05Improvement.test.ts` (`no-explicit-any`) exist identically on the baseline; `DIVISION2_POOL_INSUFFICIENT` in district Norr at the fifth rollover of seed `club-identity-soak-new` reproduces on the baseline.

## 6. Save compatibility and historical integrity

- v8 kept; every change is additive (optional marker) or static data. Legacy saves keep their 2026/27 world exactly and switch foreign leagues at their own next rollover; Swedish leagues stay career-owned.
- Historical results, tables, fixtures and ties are never rewritten (hash-checked after every rollover and against the baseline).
- Ids are never renamed, merged, deleted or reused; the retired id stays resolvable; old names resolve for search; history tables show season-correct names.

## 7. Remaining risks

1. **Cooperation deadlock (pre-existing, rare):** the five canonical B teams can still deadlock a career if a parent is relegated into its B team's tier. Activating D9 makes it frequent — hence the gate (OD-1).
2. **Second teams above the SHF cap:** while gated, Division 2 second/U teams can climb above their real cap (pre-C4 behaviour, observed in the soak).
3. **Foreign data freshness:** Norway and Denmark's second promotee remain on 2025/26 data until researched; carried-forward history is only as current as its last entry.
4. **Visual:** neon is tuned for the dark arena; on paper surfaces club mark colours are used instead. Two new clubs and replacement candidates use the marked fallback until researched.
5. **Not verified:** real Alpha saves; full UI export/import of a five-season save; a five-season career with V2 matches (soak uses fast match).
6. **Worker packaging:** see §4.

## 8. Deliverables

1. `docs/club-identity/CLUB-IDENTITY-COMPLETE-IMPLEMENTATION-REPORT.md` (this file)
2. `docs/club-identity/CLUB-IDENTITY-DATA-CORRECTIONS.md`
3. `docs/club-identity/CLUB-IDENTITY-SEASON-MEMBERSHIP-REPORT.md`
4. `docs/club-identity/CLUB-IDENTITY-RELATIONSHIPS-REPORT.md`
5. `docs/club-identity/CLUB-IDENTITY-SAVE-COMPATIBILITY-REPORT.md`
6. `docs/club-identity/CLUB-IDENTITY-VISUAL-INTEGRATION-REPORT.md`
7. Updated roadmap: status section at the top of `docs/experience-2027/HM-EXPERIENCE-2027-CLUB-IDENTITY-IMPLEMENTATION-ROADMAP.md`
Plus the immutable baseline `docs/club-identity/CLUB-IDENTITY-C0-BASELINE.md`. QA logs: `C:\DEV\QA\logs\club-identity\`.
