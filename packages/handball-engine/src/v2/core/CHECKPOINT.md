# V2 possession + transition Human QA checkpoint

Version: `2.1.0-possession-checkpoint.1`.

Historical accepted checkpoint. Current continuous-match work and QA instructions
are in [CONTINUATION.md](./CONTINUATION.md); the report below records the earlier state.

The requested first handoff is implemented: established 6v6 completes a possession,
and transition runs through the **same** action, ball, interaction and rule path.
This is a playable checkpoint for coach review, not the completed 60-minute engine.
No statistical calibration, career integration, commit or push was performed.

## Architecture

| Module | Responsibility |
|---|---|
| `state.ts` | Authoritative tick, official clock, period, population, possession, rule profile, ball, actions, contests and RNG |
| `space.ts` | Exact goal-area clearance, legal ground space, corridors, lanes, angles, goal-side position and local numbers |
| `rules.ts` | Executable free-throw preparation checks, repeated at release |
| `structure.ts` | Team marking allocation, pressure/help/cover, crossing handover, attack relationships and intent selection |
| `actions.ts` | Shared persistent preparation, commitment, execution, recovery and interruption; legal movement/handling |
| `interactions.ts` | Actual swept pass/shot contacts, duels, screens, blocks, keeper catches/parries and rebounds |
| `transitions.ts` | Physical control, possession changes, restart awards, contact sanctions and checkpoint outcomes |
| `engine.ts` | One atomic 50 ms executor, rule enforcement and invariants |
| `scenarios.ts` | Initial situations only; no successful outcome scripts |
| `replay.ts` | Exact immutable historical frames, playback scheduling and versioned saves |
| `core.test.ts` | Levels 1–5 checks plus determinism and adverse paths |
| `checkpoint-proof.json` | Actual results and save/resume fingerprints for nine scenarios in both directions |

`../primitives.ts` shares serializable Mulberry32, stable fingerprints and deep
snapshot freezing with M1. The core does not import the M1 executor or playback
engine. M1 remains a separate regression fixture; its centre throw-off has **not**
yet been migrated into a continuous live-match restart lifecycle.

Pure legacy reuse is restricted to distance/goal-area geometry and FNV-1a hashing.
The old goalkeeper module was inspected; no legacy keeper policy, release-point
correction, possession loop or tactical policy was imported. Goalkeeper read,
commitment, movement and actual ball encounter now use persistent core actions.

Renderer path:
`CoreState → v2CoreRenderSnapshot → MatchRenderSnapshot → snapshotToScene → FIELD`.
Adapter: `packages/match-integration/src/v2CoreSnapshot.ts`.
Lab: `apps/game/app/scenario-lab/core/page.tsx`, sharing existing lab CSS and FIELD.
The M1 lab links to this route.

## What actually executes

- Established attack circulates through role-specific connections, offers width,
  uses stationary pivot screens, reads passing lanes and pressure, and chooses
  feint/drive, continuation or a shot. Roles remain assigned independently of x.
- One coordinator owns primary matchups, one pressure defender and at most one
  helper. Adjacent cover picks up the helper's released threat. Beaten and screened
  defenders retain explicit recovery deadlines. Committed actions do not retarget
  just because the next tactical read changes.
- Transition uses the same selector/executor. It supplies first/second-wave
  duties, retreat and settlement criteria, legal dribbling, outlet passing and
  executable finishing. It contains no separate contact or shot engine.
- Passing has a release, travel, eligible receiver encounter and actual control.
  Interception is a physical contest. A named or absent receiver cannot acquire
  possession merely because PASS was selected.
- Jump shots take off from the actual legal position, retain airborne state,
  release a travelling ball, and land through a subsequent action when playback
  continues that far. Standing, wing and empty-goal finishes use the same release
  and goal-line resolution. A shot is not a goal until it crosses the goal mouth.
- Goalkeepers position from the ball, commit after a released trajectory becomes
  observable, move/recover through actions, and catch or parry only on contact.
  Parries produce deflection flight, a loose ball and physical rebound recovery.
  Missed save windows also retain the initiating shot's causal action ID.
- Contact contests produce legal containment, a persistent beaten state, or a foul
  and correct restart award. Severe contact records a two-minute suspension;
  repeated suspensions can disqualify. This does not yet implement the complete
  disciplinary system or post-suspension re-entry.
- The free-throw scenario prepares, authorises and executes through the common
  passing action, with legality checked again at release. Other resulting restart
  types are awarded with explicit owner/location and dead ball, then paused.

The scoped rule profile references [IHF indoor rules effective July 2025](https://www.ihf.info/sites/default/files/2025-07/09A%20-%20Rules%20of%20the%20Game_Indoor%20Handball_E.pdf),
particularly rules 6, 7, 8, 13 and 15. The implementation enforces a three-second
hold, three-step limit, no renewed dribble after gathering, legal grounded/takeoff
positions and restart spacing. Steps use a deterministic 0.8 m stride abstraction;
players use conservative body discs. Flight height is a linear approximation.
These are declared simulation approximations, not animation-level biomechanics.

## Evidence

Validated with:

```powershell
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/test-v2.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/handball-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/game/tsconfig.json
```

11 core tests and 9 M1 tests pass. The core suite executes all nine initial
situations in both directions and checks geometry, non-overlapping bodies,
population, exact chronology, physical ownership, action persistence, handling
violations, unique defence responsibilities, adverse reception, restart failure,
and outcome transitions. Changing duel participants changes the outcome.
Save/resume and playback speed tests compare complete state and event hashes.
Observation volume is a presentation choice; it does not enter the scheduler.

Seed 2025, TOP:

| Case | Physical sequence | Outcome | State / event fingerprints |
|---|---|---|---|
| Established 6v6 | passes release at 22/52, receive at 30/67; shot at 99 | keeper catch and goalkeeper throw at tick 108 | `3c5208ed` / `f79319bd` |
| 3v2 transition | dribble 18–58; pass 82, receive 91; shot 123 | goal and opposing centre throw-off at tick 134 | `b03c3f3b` / `4f892a46` |

These are measurements, not configured outcomes. Saving during flight and
resuming reproduces both hashes in all 18 scenario/direction combinations.
Hashes are regression fingerprints, not security signatures. The two directions
pass the same invariants; floating-point/local steering can produce different
contact histories, so identical mirrored event hashes are not asserted.

## Human QA

Route verified with HTTP 200:
`http://localhost:3001/scenario-lab/core`.
Browser discovery returned no connected browsers. Layout, hydration, controls and
visual/tactical authenticity are therefore **not browser-verified**.
One later development-server request returned 404; subsequent requests served
200 again without a source change. The route should be checked interactively as
part of the local QA, including after a fresh development-server start.

If the development server is not running:

```powershell
npm run dev --workspace=apps/game -- --port 3001
```

1. Start **Established 6v6**, seed **2025**, **Top goal**, at **0.25×**. Observe
   circulation, defender pressure, pivot screens and shot creation. Inspect the
   responsibilities and action reasons: reject nonsensical movement even if the
   possession ends legally. Pause near ticks 22, 30, 52, 67, 99 and 108.
2. Run **3v2 transition** with the same settings. Inspect the carrier's bounce,
   outlet choices, wide runners, retreat, keeper commitment and resulting restart.
   Pause near ticks 18, 58, 82, 91, 123 and 134.
3. Run **Local 2v2 with pivot**, **Defensive help**, **Wing finish / rebound** and
   **5:1 pressure**. Inspect contest IDs, persistent beaten state, help/cover,
   grounded screens, physical parry and rebound recovery. These are development
   examples; their tactical authenticity remains yours to judge.
4. Repeat the two primary cases toward **Bottom goal**. Compare the same semantic
   contracts, rather than expecting identical hashes across opposite directions.
5. Save during a flight, finish, reload and finish again. Compare hashes. Seek
   backward and confirm old roles, duties, actions, possession and events return
   to their exact historical values. Toggle action/event display and playback
   speeds; the final result must remain unchanged.

## Remaining work / internal roadmap

Stop here for the requested A+B Human QA handoff. Resume from this tree, not a new
audit. Visual rejection takes priority over the passing scenario suite.

1. Address coach feedback on spacing, timing, carrier choices, help/cover and
   transition continuity while keeping the shared action/interaction model.
2. Complete continuous restart execution: migrate M1 throw-off into this core;
   implement goalkeeper throw, throw-in and 7m execution and continuous restart
   preparation, rather than treating awarded restarts as possession endpoints.
3. Implement actual substitution/exchange progression, suspension expiry and
   authorised re-entry, 7v6 population, designated exit and goalkeeper return.
   `EXCHANGE` is currently explicitly ineligible. Population/period fields alone
   do not constitute these features.
4. Extend coordinated structures after 6:0/5:1 feedback: richer crossings and
   second-pivot relationships, then a fresh 3:2:1 and other supported systems.
   Add dedicated handover, legal-dribble, 7v6-turnover and keeper-return scenarios.
5. Complete rule coverage: advantage, passive play, full contact/sanction taxonomy,
   goal-line last-touch distinctions, goalkeeper area restrictions and all end-of-
   period exceptions. Current contact thresholds and keeper reads are preliminary.
6. Add continuous periods, halftime, direction changes and fulltime, then verify
   full 2×30 minute matches at Level 6. The current executor is not a full-match
   runner; disabling `stopOnOutcome` does not make it one. Unsupported subsequent
   restarts explicitly stop incomplete.
7. Only after coach acceptance and Level 1–6 validation, measure and calibrate
   distributions. No score-total tuning or career integration belongs before that.

Potential fidelity limits to review: simplified stepping and jump trajectory,
coarse screen/contact probabilities, fixed reaction/commitment durations, and
conservative local collision steering. They must not be hidden by presentation.
