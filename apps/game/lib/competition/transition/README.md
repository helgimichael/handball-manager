# Read-only competition transition planner

`planCompetitionTransition(input)` is a pure function. It returns a sporting proposal and never calls the live postseason engine, rollover, save repository or match engine. The default Swedish rule package applies only to 2026/27 qualification into 2027/28.

Authoritative inputs: [verified rules](../../../../../SWEDISH-COMPETITION-RULES-2026-27.md), [architecture](../../../../../CURRENT-LEAGUE-ARCHITECTURE.md), [design](../../../../../DATA-DRIVEN-COMPETITION-DESIGN.md), [implementation scope](../../../../../M1.2B-IMPLEMENTATION-PLAN.md). Rules carry exact official URL/section references; unverified findings remain limitations rather than executable rules.

```ts
import { planCompetitionTransition, SWEDISH_2026_RULES } from "./index";

const proposal = planCompetitionTransition({
  seasonId: "2026/27",
  rules: SWEDISH_2026_RULES,
  clubs: canonicalIdentities,       // id, nation, category; no ratings
  standings: completedLeagueTables,
  eligibility: evidencedEligibility,
  qualificationResults: knownConcludedResults,
});
```

The optional `snapshotCompetitionTransitionInput` adapter in `careerSnapshot.ts` reads a career without changing it. It recomputes league totals and checks calendar coverage; it does not import strength-selected Division 1 winners, legacy movement maps, or the live standings' hash tiebreak. Missing calendars stay missing. It is not wired into live progression.

## Input contract

- Completed tables contain every participant and consistent full double-round-robin totals. Input row order does not establish rank. Mutual results are optional evidence for tied clubs and must agree with supplied totals. Multiway ties require an evidenced organizer order; neutral-match evidence resolves two clubs only.
- Eligibility explicitly attests acceptance, licence and cooperation restrictions for the club/target/season. Missing evidence is unknown. Upper-half replacements are processed in rank order without using a club twice. Defensive/external ineligibility and exhausted replacements require an organizer decision.
- A confirmed replacement can supersede a normal retention entry; pending replacements withhold affected upper-half candidates from confirmed retention. Lower unaffected ranks remain explainable.
- Known qualification results are **concluded, evidenced outcomes**, not partially played scores or predictions. They must match the selected opponents, season and graph. Winner feeds do not resolve until prior stages and entrant eligibility resolve. The planner does not certify evidence supplied by a caller; the live adapter supplies none automatically.
- Division 2 ports name district/rank rights, not placeholder clubs. An external entrant must already exist in the caller's canonical registry with evidence and cannot simultaneously occupy a modeled table position. No runtime club or result is generated.
- Group allocations are explicit evidenced inputs. A Division 1 sporting destination alone does not select Norra/Södra. Boundary destinations preserve identity and tier without assigning an invented district league.

## Output semantics

`directPromotions`, `directRelegations`, `qualificationMovements` and `remaining` contain confirmed **ordinary sporting** claims. They do not certify administrative approval or a valid future calendar. `clubs` provides one disposition per known input participant; `entries` explains replacements; `qualification` provides participants, concluded winners and unresolved potential games; `sizes` checks family/group counts; `dependencies` names missing or unsupported requirements. Tied direct ranks with the same destination reference both rules without choosing a rank order.

Potential games include conditional later series games and explicit home/away IDs only when known. They have no dates, fabricated scores or fixture IDs. A recorded concluded result needs no hypothetical fixtures, so it can resolve a path whose original home priority is unverified. No claim about that missing rule is inferred from the result.

`BLOCKED` indicates invalid/unsupported inputs or an unverified required home policy; `UNRESOLVED` indicates missing outcomes, eligibility, allocation or administrative evidence. `READY` is reserved for a fully supported package with no dependencies. The current Swedish package intentionally retains administrative/calendar/decider/future-season limitations, even when all sporting claims are resolved. It therefore cannot authorize live rollover.

Only affected destinations are withheld: direct moves and unaffected retention can still be shown in a blocked proposal. Bad structural input is rejected before any claims. League-size checks use ordinary capacities; exceptional licensing expansions require organizer review, not automatic normalization.

The SM title tournament does not change league membership and stays in the existing competition engine. This planner covers league movement paths, not title/cup execution. No fixture regeneration, persistence migration or live career mutation is included.

## M1.2C fixture resolution and readiness

Supply `qualificationFixtures` with stage ID, season, game number, canonical opponents and optional observed results. Goals include played extra time; shoot-out throws are separate terminal-winner evidence. Unplayed fixtures omit `result`. The same planner now resolves verified best-of-three/five and two-leg formats, advances its existing graph and validates all resulting memberships/counts.

Fixture evidence must form a completed prefix. Conflicting opponents/home order, duplicate games, invalid scores and games completed after a series clinch are blocked. Drawn deciding games/aggregates require evidenced terminal winners. If fixtures and a winner-only record are supplied together, the fixtures must fully resolve and agree. Pending fixture evidence cannot be hidden behind an attested winner.

[Home-priority verification and exact blocked paths](HOME-PRIORITY.md) records the official findings. The northern N10 semi-off retains its unverified home reference; its final is explicitly blocked upstream. Neither the rule package nor any home advantage was guessed or changed.

`previewSeasonTransition(input)` calls the planner and returns current membership, confirmed incoming/outgoing clubs, retained divisional membership, known next group assignments, clubs awaiting qualification, missing external slots and shared geographic-allocation pools. Unallocated Division 1 clubs are never presented as confirmed entrants in either group.

Per-league `membershipReady` and overall `modeledMembershipReady` mean the modeled participant lists validate. `canGenerateNextSeason` additionally requires no remaining planner dependencies. The current package's administrative, calendar, terminal-method and future-season limitations stay visible; a membership-ready proposal does not authorize rollover. All preview objects are read-only outputs.

Smallest safe live follow-up: add a read-only readiness gate at rollover first. Apply no new memberships while `canGenerateNextSeason` is false. Once all required external/administrative decisions and the next-season profile are supplied and verified, commit the complete membership transaction once, archive the qualification evidence, and generate fixtures from that finalized membership. Do not replace a blocked plan with the legacy strength-selected Division 1 outcome.

## Run

From `apps/game`:

```text
npm run test:competition:planner
npm run competition:preview
npm run competition:preview -- --full
npm run competition:preview -- --unresolved
```

The developer preview uses deterministic **synthetic** completed seasons and explicit synthetic eligibility on current canonical IDs. By default it supplies completed fixtures for the seven HBL/HA qualification stages; `--unresolved` omits those fixtures. District entrants remain unknown. Fully supplied external-provider test cases use isolated `fixture-only:*` identities in tests; they are never added to production data.
