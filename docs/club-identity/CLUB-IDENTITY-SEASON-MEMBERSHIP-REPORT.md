# Club Identity — Season-Bound League Membership (C3)

**Phase:** C3. **Status:** see the final report for the PASS/PARTIAL verdict (regression comparison in §6).
**Decisions implemented:** D5 (new careers corrected now; existing careers at their next season; career-owned Swedish pyramid never overwritten), T1, T5 (metadata), T7.

## 1. Architecture

| Piece | File | Behaviour |
|---|---|---|
| Frozen legacy baseline | `Club.competitionId` (`game-data/clubs.ts`) | The league in the v8 world every existing career started from. Never edited (snapshot test, 202 ids) |
| Real-world history | `Club.competitionHistory` (`game-data/clubIdentityData.ts`) | Append-only, per season, with sources; last known season carried forward |
| Data epoch | `CLUB_WORLD_EPOCH = "cid-2026-27-v1"`, `CLUB_WORLD_START_SEASON = "2026/27"` | |
| Career marker | `CareerState.clubWorldBaseline?: string` (`career/types.ts`) | Set by `createNewCareerState`. **Absent = legacy v8 career.** Never backfilled by migration |
| Resolver | `clubCompetitionForSeason(state, clubId, seasonId = state.seasonId)` (`career/competitionMembership.ts`) | Order: (1) career `competitionMembership`; (2) Swedish clubs → starting league (career-owned afterwards); (3) legacy career in its start season → frozen v8 league (records of a later epoch do not exist); (4) otherwise `competitionHistory` for the season |
| Enumeration | `careerClubsInCompetition(state, competitionId, seasonId?)` | `CLUBS` order, identical to the legacy `getClubsByCompetition` for a legacy career before its first rollover, so deterministic foreign-bid picks by index are unchanged |
| Legacy enumeration | `getClubsByCompetition` (`game-data`) | Now explicitly the legacy baseline (excludes `addedInWorld` records) |
| Forward guard (T7) | `career/clubWorldCompatibility.ts`, called first in `getOrCreateCareerState` | Unknown `clubWorldBaseline` or an unresolvable manager club → `ClubWorldCompatibilityError` before anything is migrated or written; stray unresolved ids only warn |

No save schema change: the marker is an optional additive field, exactly the precedent of `competitionMembership` and `clubPartnerships`. **v9 was not needed.**

## 2. Outcome per career type

| Career | 2026/27 (in progress) | 2027/28 and later |
|---|---|---|
| Existing v8 career (no marker) | Exactly the v8 leagues, world pool, foreign-buyer pools and order | Corrected foreign leagues: Leipzig + Minden ger-2; Balingen + Bietigheim ger-1; HØJ + Grindsted den-2; KIF Kolding den-1; Fram isl-1; Komló hun-1; Anaitasuna esp-2; Loka + Ormož svn-1; TV Bittenfeld tombstone leaves ger-2. Swedish leagues from the career's own transitions |
| New career | Corrected 2026/27 world from day one | History per season; Swedish leagues from its own transitions |

The switch happens because `state.seasonId` advances at the career's own season transition; nothing is written for foreign clubs, so it can never happen mid-season, and historical fixtures/results (which store ids and their own `competitionId`) are untouched.

## 3. League consumers audited and migrated

| File | Before | After |
|---|---|---|
| `career/careerWorld.ts` `getExternalCandidateClubs` | static `getClubsByCompetition` | `careerClubsInCompetition` (scouting + transfer candidates) |
| `players/market.ts` foreign buyer pool + country label | static | resolver (order preserved) |
| `career/scoutDiscovery.ts` candidate competition (×2) | static | resolver |
| `career/cpuCandidateEvaluation.ts` international flag | static | resolver |
| `app/career/scouting/page.tsx` competition filter | static | resolver |
| `app/career/players/page.tsx` league filter | static | resolver |
| `components/manager/CompetitionWorkspace.tsx` member list + scorer leaders | static | resolver (also fixes promoted Swedish clubs being listed in their old league) |
| `lib/analysis/viewModels.ts` opponent league name | static | resolver |
| Already override-first (now season-aware automatically) | `clubCompetitionId` callers: club pages, `Identity.tsx`, `ClubContext.tsx`, manager page, `changeClub.ts`, `managerCareer.ts`, `media/worldTick.ts`, `cooperationEligibility.ts` | unchanged code |
| Swedish-only inline `membership ?? competitionId` | `worldCompetitions.ts`, `tables.ts`, `season.ts`, `careerSnapshot.ts`, `seasonTransition.ts` | **unchanged** (bit-identical; equivalent to the resolver for Swedish clubs) |
| Stateless / squad-keyed | `rating/gamePrior/clubContextTier.ts`, `career/worldPoolIntegration.ts` | unchanged, guarded by a test: no REAL_WORLD (squad-bearing) club has a league change in its history |
| Offline tools, own-league fixtures, Swedish tiers | editor, rating pipeline, `newCareer.ts`, `careerInitialization.ts`, economy, staff, transfers tiers, `gameContinuity.ts` | unchanged (reviewed) |

**CI gate:** `clubWorldMembership.test.ts` scans `app/`, `components/`, `lib/` for static league reads; any file outside the reviewed list fails the build.

**Out of scope (documented, not changed):** `players/market.ts:48` reads the manager's own club's static league for the domestic "foreign interest" bar — a pre-existing Swedish inconsistency (MS §4.3).

## 4. Tests

`lib/career/clubWorldMembership.test.ts` (8 tests): markers; I4 legacy start season equals the frozen world (every club, every foreign/world-pool league, member order, world pool); D5 legacy switch at 2027/28 and carry-forward; new careers corrected from day one; I5 Swedish isolation (both career types, three seasons) and career membership overriding real-world history; REAL_WORLD guard; grep gate; T7 guard.
`lib/career/clubIdentityCareer.test.ts`: stored ids resolve; JSON round trip + migration idempotence.
Multi-season behaviour with real transitions is proven in C6 (`CLUB-IDENTITY-SAVE-COMPATIBILITY-REPORT.md`).

## 5. Rollback

Revert the C3 commit. An older build reads the frozen `competitionId`, ignores `clubWorldBaseline`, and shows new careers the legacy foreign lists (cosmetic: foreign leagues have no fixtures). Records added by the new epoch exist only in static data and in no save field except possibly `clubKnowledge`/offers, which an older build renders as raw ids.

## 6. Regression comparison

| Run | Tests | Pass | Fail | Log |
|---|---|---|---|---|
| Baseline `76513bd` (untouched worktree) | 2934 | 2922 | 12 | `C:\DEV\QA\logs\club-identity\baseline-suite.log` |
| After C3 (C1–C3 applied) | 2958 | 2946 | 12 | `C:\DEV\QA\logs\club-identity\c3-suite.log` |

The 12 failures are **identical** to the baseline set (`baseline-failures.txt` vs `c3-failures.txt`: 0 new, 0 fixed). Both runs exclude `lib/career/cpuQualityUpgrade.test.ts` (known >90 min) and use a 15-minute per-test timeout; no test timed out.
