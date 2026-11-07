# Current league architecture

M1.2A; inspected 2026-11-07 at `main`, `8211ec62bc70ed47f517eebcf1bcf8557e7ff006`. Source inspection only; existing tests were read, not executed. No implementation changes.

## Finding

The baseline already implements Swedish playoffs, qualification, movement and rollover. The next milestone must refactor and constrain these paths, rather than add a second progression engine. Several older comments describe a less capable system than the code actually runs.

## Definitions and identities

| Competition ID (preserve) | Clubs | Catalog tier | New Game | Ordinary league simulation |
| --- | --- | --- | --- | --- |
| `se_handbollsligan_herr` | 14 | 1 | All 14 clubs playable | Yes |
| `swe-2` | 14 | 2 | All 14 clubs playable | Yes |
| `se_division1_norra` | 12 | **2** | Non-playable | Normally absent |
| `se_division1_sodra` | 12 | **2** | Non-playable | Normally absent |

[competitions.ts](apps/game/lib/game-data/competitions.ts) and [clubs.ts](apps/game/lib/game-data/clubs.ts) hold static 2026/27 assignments. [types.ts](apps/game/lib/game-data/types.ts) restricts `CompetitionTier` to `1 | 2`; Division 1 borrows tier 2 for compatibility with economy signatures. Its actual sporting tier is missing. Allsvenskan's comment claiming only Tumba is playable is stale: every entry now has `playable: true`.

Canonical IDs include both `se_club_*` and older `swe2-*` forms. Preserve these, source identities, distinct affiliated clubs and rating files under `data/real-world/sweden/2026-27/`. Display aliases belong in [canonicalClubNames.ts](apps/game/lib/game-data/canonicalClubNames.ts), not membership logic.

[competitionMembership.ts](apps/game/lib/career/competitionMembership.ts) resolves career overrides before static assignments. [competition/tables.ts](apps/game/lib/competition/tables.ts) supplies membership-aware club enumeration. Static `getClubsByCompetition` remains widespread: replacing identity records on promotion would break callers and historical provenance.

## Standings and fixtures

| Area | Existing behavior | Reuse / gap |
| --- | --- | --- |
| Table arithmetic | [game-simulation/table.ts](packages/game-simulation/src/table.ts): recomputes 2/1/0 totals; sorts points, GD, GF, club ID. | Reuse aggregation. Final club-ID sort is display determinism, not an official sporting decision. |
| Career ranking | [competition/tables.ts](apps/game/lib/competition/tables.ts): league results only, head-to-head mini-table, then seeded hash. [standings.ts](apps/game/lib/career/standings.ts) delegates here. | Reuse filtering; replace decisive hash fallback with unresolved ranking/deciding-match requirement. Multiway treatment is an explicit assumption. |
| Completion message | [calendar.ts](apps/game/lib/career/calendar.ts), `checkSeasonComplete`, directly calls the lower-level table. | Can disagree with the career table after head-to-head. Use one future ranking authority. |
| New career | [newCareer.ts](apps/game/lib/career/newCareer.ts): real imported schedule with preseason selection; otherwise generated schedule. | Keep import adapter, but validate season and exact participant coverage. |
| Round-robin | [fixtures.ts](packages/game-simulation/src/fixtures.ts): deterministic circle method, even club count required; dates spread within weekly rounds. | Reuse for supported memberships. It rejects odd counts and does not implement geography or official dates. |
| World calendar | [seasonCalendar.ts](apps/game/lib/competition/seasonCalendar.ts): adds the other top league before kickoff; avoids fabricating a missing midseason calendar. Rollover generates both top leagues plus manager's current league. | Preserve idempotence and legacy behavior. Real-schedule check tests fixture endpoints, not exact full membership/coverage. |

Both top leagues ordinarily have 182 fixtures. Division 1 remains a scouting pool **except** when the manager is relegated into a group: rollover then schedules that group. This conditional simulation is not a complete Division 1 pyramid.

## Existing postseason and movement

[competition/rules.ts](apps/game/lib/competition/rules.ts) contains Swedish constants, series/home patterns, rank slots and provenance comments. Some “verified” comments link only to 2025/26 PDFs; use the new [2026/27 research](SWEDISH-COMPETITION-RULES-2026-27.md) to replace the evidence chain later.

[competition/types.ts](apps/game/lib/competition/types.ts) models `CompetitionTie` (series/two legs/single, feeds, fixtures, winner/loser, stakes), `SeasonOutcome` (phase, next membership, promoted/relegated, honours) and a closed Swedish `TieStage` union.

[competition/season.ts](apps/game/lib/competition/season.ts) is the active orchestrator:

- `startPostseason` creates SM and HBL qualification from tables and stages direct moves.
- `rankDivision1` ranks the **combined** Division 1 population by squad strength and seeded hash; any simulated group leader is prioritized. The first two go up and the next two meet HA's relegation qualifiers. This can select both direct entrants from one group and omits the cross-group semi-offs.
- Direct HA relegation targets the group of the bottom-ranked Division 1 candidate. `settleTies` writes winner/loser destinations using `stakes`.
- `progressCompetitions` coordinates phases and cup completion. Its regular-season dependency list is normally only HBL/HA, even if a manager's Division 1 group also has a calendar. A generalized model must wait for every source table it consumes.
- There is no Division 2 participant registry, qualification path, result provider or boundary state. No eligibility filtering for official cooperation/licence rules appears in postseason selection.

`tieFixtures`, `tieWins`, bracket feeds, early series completion and deduplicated announcements are reusable. `applyKnockoutDecider` calls [knockout.ts](packages/game-simulation/src/knockout.ts) after regulation-time results. Keep engine mechanics unchanged; terminal-decider fidelity is a separate unresolved issue.

## Rollover and AI

[seasonRollover.ts](apps/game/lib/career/seasonRollover.ts) applies `seasonOutcome.nextMembership`, repairs older qualification destinations, archives top-tier tables/ties/outcome, updates the manager's competition, resets current-season records and generates new fixtures. It retains the offseason daily tick. However, `balanceDivisionOne` evens group sizes using arrivals/ID order and exempts the manager's club; it does not implement an official geographic allocation. Division 1 tables are not included in its explicit two-league table archive.

[worldCompetitions.ts](apps/game/lib/career/worldCompetitions.ts) includes all four Swedish competitions in economy/player-market activity. `careerWorldClubIds` requires a squad snapshot; [cpuRecruitment.ts](apps/game/lib/career/cpuRecruitment.ts) excludes only the manager. Recruitment, contracts and player lifecycle are broader than fixture simulation. [calendar.ts](apps/game/lib/career/calendar.ts), `simulateAiFixturesForDate`, simulates scheduled non-manager matches once; [dailyTick.ts](apps/game/lib/career/dailyTick.ts) invokes competition progression. Reuse these paths for future background groups.

[clubPartnerships.ts](apps/game/lib/career/clubPartnerships.ts) already records five canonical A/B pairs and agreement state. It is not wired into qualification eligibility and treats those B-team links as permanent; legal agreement termination needs separate, dated sporting evidence.

Persistence uses [saveMigration.ts](apps/game/lib/career/saveMigration.ts), [saveRepository.ts](apps/game/lib/save/saveRepository.ts) (envelope schema 8) and [saveStorage.ts](apps/game/lib/save/saveStorage.ts) (IndexedDB). Competition fields are optional in `CareerState`; no pinned, season-specific rule snapshot exists.

## Reuse decision

Keep identities, squad/rating snapshots, membership override concept, table arithmetic, fixture generator, tie execution, daily tick and save infrastructure. Replace hardcoded orchestration/selector assumptions behind an adapter. Do not silently reinterpret old saves or treat their strength-selected Division 1 outcomes as verified sporting history.

Existing [season.test.ts](apps/game/lib/competition/season.test.ts) covers both top calendars, SM bracket, HBL qualification, completion and rollover counts. It does not establish official Division 1 advancement, eligibility, lower-pyramid resolution or geographic allocation. Its equal-group assertion preserves a game assumption, not official compliance.
