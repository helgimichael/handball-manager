# Club Identity C4.1 — Final Report

**Status: PASS**

| | |
|---|---|
| Branch | `feat/club-identity-arena` (worktree `C:\DEV\WORKTREES\handball-manager\club-identity-arena`), based on `feat/club-identity-final` @ `27a559d` |
| C4.1 commit | `e99d303` feat(club-identity): C4.1 human managers never lead B-teams; deterministic Division 3 re-entry |
| Pushed / merged / deployed | No / no / no |

## 1. Owner decisions implemented

### "The A-team always has priority. The B-team must adapt." (C4, completed in C4.1)

C4 built the deterministic allocation after the transition planner (`lib/competition/transition/parentPriority.ts`). It runs inside `attemptSeasonTransition`:

- A B-team is never placed in or above its A-team's division.
- It moves down one tier at a time to the highest valid division below the A-team.
- Its place goes to the next eligible club in sporting order. Eligibility checks, in order: the destination league's ranking or the Division 2 pool order; upper half; untied; eligibility evidence; the cooperation rule; the A-team rule; the regional rule; squad.
- Displacements cascade through all three divisions.
- Conflicts block the whole rollover atomically, and the exact conflict is reported.

C4.1 adds **Division 3 re-entry**:

- **Where it returns:** a B-team that was moved to the non-simulated Division 3 (`se_division3`) goes back to its own Division 2 district. It never goes higher.
- **When:** only once every restricting A-team has been above Division 2 both in the season just played *and* in the next one. This hysteresis means:
  - an A-team promoted this summer does not lift its B-team in the same summer;
  - an A-team relegated back to Division 2 keeps the B-team down.
- **No oscillation or automatic promotion:** re-entry is not a promotion and does not count in the season's promotion lists. It is excluded from `relegated` (`seasonTransition.ts`).
- **Other requirements:** the B-team must still have a valid Division 2 registration (`hasValidCompetitionRegistrations`) and pass `cooperationEligibility`.
- **Terminated or expired restrictions:** these impose nothing, so the B-team re-enters at the next transition.
- **Logging:** every re-entry is logged as a `RE_ENTRY` move with its reason in `SeasonOutcome.parentPriority`.

### "A human player can never manage or select a B-team." (new in C4.1)

**What counts as a B-team.** `isBTeam` / `isHumanManageable` in `lib/game-data/clubIdentity.ts` use only the second-team relation kinds:

- `SECOND_TEAM`
- `SAME_CLUB_SECOND_TEAM`
- `SECOND_TEAM_UNDER_PARTNER_ASSOCIATION`

These clubs are *not* B-teams and stay selectable:

- U-teams (e.g. HK Cliff, D7);
- farm or partner associations (e.g. IF Kristianstad);
- historical cooperations.

**Entry points:**

| Entry point | Guard |
|---|---|
| New Game club lists (playable, world, selected club, per-league count) and the title screen's featured clubs | filtered with `isHumanManageable` (`app/new-game/page.tsx`, `app/page.tsx`) |
| Career creation (the human entry, `getOrCreateCareerState`) | refuses a B-team with `B_TEAM_CPU_ONLY` before anything is fetched or written |
| Job market (`eligibleClubs` → `openVacancies`) | B-teams never listed |
| `applyForJob` | throws `B_TEAM_CPU_ONLY` |
| Offers, takeover, club change (`clubChangeBlocker` → `acceptJobOffer`) | refused with `B_TEAM_CPU_ONLY` |
| Continue / load of an existing save | `releaseManagerFromBTeam` (see below) |

**Existing saves.** A save whose human manager leads a B-team is recovered on load, in `getOrCreateCareerState` (not in the pure migration, so fixtures and tests are unaffected):

- The appointment ends neutrally (`CONTRACT_ENDED`, not a dismissal).
- The stint closes and the manager becomes clubless with job offers.
- An explanatory `MANAGER_CAREER` event is sent.
- Nothing is deleted: the club, squad, fixtures and history are intact.
- The interim runs the club.
- The recovery is idempotent.

**CPU B-teams** keep operating normally: squads, fixtures and promotion and relegation under the A-team rule.

## 2. The 20 required tests

| # | Requirement | Evidence (test) | Result |
|---|---|---|---|
| 1 | B-team promotion ineligible | `parentPriority.test.ts` "B-team winning promotion…"; `parentPrioritySeason.test.ts` "a B-team that earns promotion into its A-team's division stays down…" (real rollover) | PASS |
| 2 | Next eligible club takes the place | same tests (rank 2 of the district order goes up) | PASS |
| 3 | A-team relegation | "A-team relegated into its B-team's division…", "…Division 1 group…" | PASS |
| 4 | B-team to Division 3 | "A-team relegated into its B-team's division: … (Division 2 -> non-simulated Division 3)" | PASS |
| 5 | A-team moves up | "re-entry: …" (promoted this summer → stays in Division 3), "full cycle …" | PASS |
| 6 | B-team re-entry | "re-entry: …", "full cycle: … re-enters one season later, never oscillating" | PASS |
| 7 | Multiple B-teams | "multiple B-teams in one division and two parent clubs…" | PASS |
| 8 | Three-division cascade | "cascading displacement through three divisions terminates deterministically" | PASS |
| 9 | Next club also ineligible | "next eligible is also ineligible: evidence, the cooperation rule and the A-team rule all skip a candidate" | PASS |
| 10 | Active / terminated / historical cooperation | "only restricting relationships count: terminated, expired and plain development partnerships impose nothing"; re-entry with a TERMINATED row | PASS |
| 11 | League sizes | sizes asserted in every allocation test and in both five-season soaks | PASS |
| 12 | Atomic rollback | "no valid allocation is reported exactly and nothing is half-applied"; "no valid allocation blocks the whole rollover atomically…" (real rollover) | PASS |
| 13 | Retry idempotence | `parentPrioritySeason.test.ts` (save/load after rollover; retry is idempotent); determinism asserted in the allocation tests | PASS |
| 14 | Save / load | `parentPrioritySeason.test.ts` and both soaks round-trip through JSON + `migrateCareerState` after every rollover | PASS |
| 15 | Invalid registration blocks re-entry | "re-entry: …" with `registrationValid: () => false` | PASS |
| 16 | Re-entry not a promotion | `RE_ENTRY` excluded from relegation/promotion lists; deterministic (deep-equal on repeat) | PASS |
| 17 | Human cannot select a B-team | `bTeamHumanManager.test.ts` "17. …" (career creation rejects HK S-hof and HP Alingsås; New Game and title lists filtered); browser: the club step showed 28 playable clubs, none a B-team | PASS |
| 18 | Human cannot receive a B-team appointment | "18-19. …" (`clubChangeBlocker`, `acceptJobOffer` refuse) | PASS |
| 19 | Human cannot apply for a B-team job | "18-19. …" (`applyForJob` throws; vacancy never shown) | PASS |
| 20 | Existing save with a B-team manager | "20. … neutral release, history and club intact, idempotent" | PASS |

**Classification.** A separate test checks the classification itself: second teams only; U-teams, farm clubs and partner associations stay manageable.

## 3. Runs

| Run | Result | Log |
|---|---|---|
| Focused competition, manager and identity suites (transition, parentPriority, soak, partnerships, `m7dCareer`, B-team, game-data) | **149 / 149 pass**, 0 fail, 0 skipped, 0 cancelled | `C:\DEV\QA\logs\club-identity-arena\c41-focused.log` |
| Five-season soak, NEW career (seed `club-identity-soak-new-b`) | pass: identity, leagues, relations, history intact; parent-priority moves exercised; 80 B-team invariant checks | same |
| Five-season soak, LEGACY v8 career | pass: keeps its world, switches at the first rollover, survives five seasons | same |
| Full bounded regression (see the complete report) | 3,002 tests: 2,990 pass, 12 fail (the 12 known baseline failures, no new failures) | `full-regression.log` |

The soaks use **quick simulation** (`simulateMatch`) for every fixture, including the manager's own. They validate the career lifecycle and competition logic, not live matches. Live matches were validated separately in the browser (see the cross-system report).

## 4. Limitations and owner decisions

1. **Interpretation of "B-team".**
   - Only the three second-team relation kinds count.
   - U-teams (HK Cliff and the Lugi U teams) and partner associations (IF Kristianstad) stay selectable for humans, per D7.
   - **Owner confirmation requested.**
2. **Existing-save recovery is a neutral `CONTRACT_ENDED` release.**
   - An alternative would be to keep the manager and block Continue until they choose a new club.
   - The neutral release was chosen because it never blocks a save and never deletes anything.
   - **Owner confirmation requested.**
3. **Re-entry timing.**
   - Re-entry needs the A-team above Division 2 for the season just played and the next one.
   - The cost is a one-season delay after an A-team promotion, which prevents oscillation.
4. **Pre-existing limitation, unchanged.**
   - `DIVISION2_POOL_INSUFFICIENT` (district Norr) at the fifth rollover for seed `club-identity-soak-new`.
   - It reproduces on the baseline.
   - The soak uses seed `-b`.
