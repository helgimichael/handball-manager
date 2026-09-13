# V2 contextual backcourt — Human QA checkpoint

Version: `2.5.0-backcourt-relationships.1`. Human QA accepted this backcourt checkpoint.
The verification and continuation records below were captured before acceptance.

The accepted wing checkpoint was preserved first, in commit
`b0d7c02f8ccb071eb301d8fe9216405492126e15`:
`feat(engine): preserve v2 wing relationship checkpoint`.
That commit contains exactly 18 V2 files, including the wing model, its integration,
tests, proof and documentation. The three unrelated tracked files, `.claude/`,
and the temporary benchmark were excluded. Nothing has been pushed.
`WINGS.md` and `wing-proof.json` remain the accepted 2.4 record.

## Diagnosis

The existing model did not sufficiently support the coach's requested variation.
Established backs used one CONNECT responsibility and a fixed set of anchors,
translated sideways with the ball. A carrier could penetrate, but the off-ball
backs did not know whether to stretch a compact line, support a pivot interval,
clear a drive, or retain the wing's return connection. The available width was
largely a by-product of individual on-ball movement.

`backcourt.ts` now chooses a support relationship from current physical state:

| Responsibility | Physical relationship |
| --- | --- |
| STRETCH | Open width against the half defender while retaining separate wing and central lanes; a weak-side outlet need not copy the ball side. |
| COMBINE | Contract into the inner interval between assigned defenders beside a nearby committed pivot screen. |
| CLEAR_LANE | Stay laterally clear of a committed drive/dribble and offer a trailing pass. |
| RECYCLE | Remain behind the adjacent wing as its return connection. |
| BALANCE | Central back balances the occupied flank lanes and supplies a trailing outlet. |

The plan stores its possession, mode, partner, target, reason and review time in
authoritative player state. It is reconsidered at available decisions after a
minimum review interval. Executing runs and pending receptions keep their existing
commitment; a changed read cannot retarget them mid-action. The movement executor
still checks physical bounds and body separation. A support target is an intent,
not proof that the player reached it or that a combination succeeded.

Plans end on reception by that player, possession change, restart award, or
leaving the court. This prevents inactive plans from appearing as current orders.
Both Lab inspectors show the selected historical support target alongside the
actual position and committed action. No final-state lookup is used.

## Observable evidence and limits

In the compact-defence fixture, H02 moves from x=5.1 to about x=3.2 before receiving.
In the pivot-interval fixture, H02 instead contracts to about x=6.1 while H04
remains wider. Both run through the same executor in both court directions.
The tests assert occupied shape as well as planned targets.

Full-match sampling measures the actual lateral distance between the attacking
LB and RB, only while both are on court in live established attack, every 20
ticks. It includes carriers and recovery frames; it does not count target width
as achieved width. Across the four runs, median occupied width is 10.95–11.42 m.
Each run contains samples over 12 m and under 9 m. These observations establish
variation, not tactical authenticity.

The pivot-combination mode is rare in full matches: 1–5 one-second support samples
per run. It is visible and physically fulfilled in the isolated fixture, but its
natural frequency, timing and conversion into useful continuation need coach QA.
Most full-match flank support remains STRETCH. No probability was raised to make
combinations appear more often.

Remaining uncertainty:

- Whether backs widen soon enough and stay connected to the ball, especially
  when existing RECEIVE commitments delay the next movement decision.
- Whether the central trailing outlet is too deep, and whether weak-side players
  remain useful rather than becoming isolated wide receivers.
- No new coordinated crossing choreography is implemented. The current shared
  movement/defensive handover model remains; contraction now has explicit pivot
  and penetration context, but this is not a complete attacking system.
- Carrier selection still does not construct long combination sequences. Shot
  timing may end possessions before an off-ball relationship fully develops.
- The accepted wing/contact limitations still apply: horizontal airborne travel,
  advantage, goalkeeper behaviour, finishing, pacing and broader rule coverage
  require further development or validation. Scorelines are not realism proof.
- Save versions are strict. Use the accepted commit for 2.4 saves; new saves use
  2.5 and include the support plan.

## Human QA

Open `http://localhost:3001/scenario-lab/core`, seed **2025**, **0.25×** playback.
Select each case, press **Start / reset**, and repeat toward both goals:

1. **Backcourt width against compact defence**: watch both backs widen, then
   receive and continue. Compare actual positions with STRETCH targets.
2. **Backcourt / pivot interval**: watch H02 contract while H04 stays wider.
   Does the connection to the pivot create useful handball space?
3. **Clear the penetration lane**: check whether support vacates the drive's path
   and stays available behind it, without cancelling committed actions.
4. **Wing / backcourt return connection**: inspect wing width and the adjacent
   back's return connection together. Recheck the accepted wing cases as well.

At `http://localhost:3001/scenario-lab/match`, generate seed **2025** in each
starting direction. Seek to these exact ticks and play the surrounding seconds:

| Direction | Ticks | Inspect |
| --- | --- | --- |
| TOP or BOTTOM | 120–220 | Transition settling into width and a central outlet |
| TOP | 1700–1800 | H02's return connection behind H01 |
| TOP | 6380–6500 | A04's pivot-interval support decision around tick 6420 |
| TOP | 12160–12260 | A04's penetration support around tick 12200 |
| BOTTOM | 1600–1700 | A04's return connection behind A05 |
| BOTTOM | 2080–2180 | H04 supporting H03's penetration |
| BOTTOM | 11280–11400 | A04's pivot-interval support around tick 11320 |

These moments identify decisions, not guaranteed successful combinations. Watch
what the players physically do next. Also inspect later attacks after changed
ends. Seek backwards and compare playback rates on the same generated match.

Both routes serve HTTP 200 and the core route includes the four new options.
The browser runtime reports no connected browser, so no automated visual result
is claimed. Human QA of the new batch remains outstanding.

## Tests and deterministic proof

- 9 centre throw-off tests and 42 core tests pass.
- Engine and app TypeScript checks pass.
- Four complete 2×30-minute matches: seeds 1 and 2025, both directions.
- Support saves at ticks 6420 and 11320 resume to identical final state and
  event hashes. Focused scenarios also verify both directions, bounded movement,
  contextual responses, missing partners, commitment preservation, lifecycle
  clearing, historical snapshots and playback-speed independence.
- Existing contact, wing, restart, suspension, exchange, failure-path and sparse
  replay tests remain passing. No outcome requirement was weakened for this batch.

| Seed | Direction | State hash | Event hash | Resumed from |
| --- | --- | --- | --- | --- |
| 1 | TOP | `01bf5569` | `f8104a5a` | — |
| 1 | BOTTOM | `19b5967a` | `4a54e8a9` | — |
| 2025 | TOP | `d093b3d7` | `74296eb8` | 6420 |
| 2025 | BOTTOM | `3052ce07` | `8f3fd975` | 11320 |

Commands:

```text
node packages/handball-engine/scripts/test-v2.cjs
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/prove-v2-backcourt.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/handball-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/game/tsconfig.json
git diff --check
```

`backcourt-proof.json` contains detailed width distributions, support samples,
historical moments and exact replay proof. Its top-level `complete` flag becomes
true only after all runs and replay comparisons succeed.

## Files and continuation

New: `backcourt.ts`, `backcourtScenarios.ts`, `backcourt.test.ts`,
`backcourt-proof.json`, `scripts/prove-v2-backcourt.cjs`, and this note.
V2 state/scenario initialization, structure selection, transition/population
cleanup, the core test runner, and both Scenario Lab pages integrate the model.
Existing geometry and executors remain shared; legacy gameplay was not modified.

This is the next Human QA checkpoint. Preserve this uncommitted batch and the
accepted wing commit. Do not commit the new batch or push without another request.
Continue from the coach's observations rather than restarting the audit or
replacing accepted work.

Unrelated files remain untouched: `apps/game/app/match-qa/page.tsx`,
`apps/game/lib/matchQa/qaHarness.ts`, `apps/game/scripts/season-audit.ts`, `.claude/`,
and `apps/game/.tmp-final-benchmark.ts`.
