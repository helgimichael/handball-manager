# V2 contact and continuation Human QA checkpoint

Version: `2.3.0-contact-continuation.1`. Human QA accepted this realism checkpoint.
The verification and working-tree records below were captured before acceptance.
The accepted foundation is preserved in commit
`a0291a600631ac39cad7f5b16017fc696f524f09`:
`feat(engine): establish handball engine v2 playable match core`.
Nothing has been pushed. The earlier `CONTINUATION.md` and `match-proof.json`
describe the accepted 2.2 checkpoint; this file describes its successor.

## Findings and model changes

1. **Pressure did not reliably become contact.** A diagnostic six-minute run of
   the accepted model started 120 PRESS actions but no FEINT, DRIVE or CONTACT.
   The foul path existed only inside the feint/drive skill contest. `contact.ts`
   now owns a shared contact commitment and physical execution path, usable
   regardless of the carrier's action. Only the allocated primary/helper can
   initiate it; a committed attempt that no longer reaches the carrier misses.
2. **A strong defender could be punished for winning.** The old skill margin
   could convert stronger defence into an illegal stop. Legality now follows the
   committed technique: bent-arm monitoring or an explicit late holding attempt.
   Approach and actual separation are recorded at execution. Legal monitoring
   preserves committed passes/shots; frontal containment can stop penetration
   while retaining physical control and the handling clock. Holding has a
   progressive warning/suspension path, independent of a random foul percentage.
3. **Backs released without engaging recovering cover.** An available shoulder
   can now trigger a physical drive before continuation; a nearby defender can
   trigger a feint. Drive targets use the defender relationship. The execution
   window leaves time for a subsequent release within the handling budget.
4. **A feint could fabricate a breakthrough.** Wrong-footing now has its own
   reaction deadline. A BEATEN event requires an actual change from the defender
   being goal-side at drive commitment to the attacker crossing that shoulder.
   No roll moves players or labels a stationary feint as a breakthrough. The
   existing recovery debt, helper and adjacent-cover allocation then apply.
5. **A pass and receiver followed different commitments.** A lead pass assumed
   that its receiver would keep running; the receiver could end the RUN timer
   and stop for RECEIVE. Long traces exposed repeating misses and alternating
   throw-ins, despite full-time completion. An offered moving reception now
   preserves the existing run/target while that pass is pending or in flight.
   Control still requires a compatible actual ball encounter. Inactive movement
   phases no longer supply stale velocity to the lead calculation.
6. **Handover completion preceded execution.** Paired handovers now retain the
   original marks until both committed actions complete. Interruption cancels
   the exchange. The completion event reflects the resulting mark transition.
7. **Restart targets could prevent execution indefinitely.** A throw-in spacing
   target near a goal-area boundary could remain too close to the taker. The
   target now clears the taker while remaining in legal space. An eligible field
   player already holding an awarded free throw/throw-in can take it; otherwise
   a collector occupying the designated taker spot moves clear before returning
   the ball. All repositioning, return and execution remain physical.

The contact rules are a scoped implementation informed by
[IHF indoor rules effective July 2025, particularly Rule 8](https://www.ihf.info/sites/default/files/2025-07/09A%20-%20Rules%20of%20the%20Game_Indoor%20Handball_E.pdf).
Legal body monitoring, prohibited holding and progressive sanctions are distinct
concepts. This remains a simplified technique/body model, not full officiating.

## What should look different

- More shoulder attacks and continuations against arriving pressure.
- Actual containment, missed contact attempts, and late holding with dead-ball
  restart consequences. A legal touch does not arbitrarily cancel a pass or shot.
- A wrong-footed defender is distinguishable from one actually passed; help and
  cover react to the latter's persistent disadvantage.
- Runners continue through receiving opportunities instead of stopping beneath
  a ball led beyond them. The identified repeating throw-in loop is removed.
- Warnings and suspensions become visible in ordinary full matches. Eligibility
  returns on official time, followed by physical substitution-line admission.
- Handover labels and historical marks change after the committed exchange.

## Exact Human QA

No browser was connected to the automation runtime. Routes were verified with
HTTP responses and server-rendered controls; this batch has **not** received
visual/browser approval. The user's acceptance applies to the committed 2.2
foundation, not automatically to this successor.

Open `http://localhost:3001/scenario-lab/core`, seed **2025**, both directions:

1. **Frontal contact and containment:** watch preparation/commitment before legal
   contact, physical control retained, penetration stopped, and no invented foul.
2. **Late holding attempt:** inspect the committed HOLD technique, actual reach,
   CONTACT_EXECUTED, linked FOUL/WARNING and dead-ball restart award.
3. **Evaded contact attempt:** the carrier leaves the reach window; the attempt
   misses and does not award a foul or possession.
4. **Physical shoulder breakthrough:** single-step the actual relative-position
   crossing, BEATEN event, recovery deadline, helper and cover.
5. **Local 2v2 with pivot:** distinguish WRONG_FOOTED/FEINT_READ from BEATEN. A
   feint does not guarantee that the subsequent drive beats the defender.
6. **Continuous play** and **7v6 and goalkeeper return:** review moving receptions,
   restart continuity, contact under changing numbers and goalkeeper exchange.

Open `http://localhost:3001/scenario-lab/match`, generate seed **2025** in both
initial directions, and also seed **1** for contrast. The event dropdown now
includes contact, fouls, warnings, suspensions, breakthroughs and handovers.
Use the tick numbers in `contact-proof.json`'s `qaMoments` to jump to reproducible
sequences. Step back before a contact; inspect the committed technique and player
positions. Compare the same tick at 0.25x, 1x and 4x. Download the tick before a
holding foul, resume it and compare final state/event fingerprints.

Coach questions: does pressure arrive at a believable time; do attackers have
credible continuation choices after contact; is late holding chosen sensibly;
does the beaten defender's recovery look plausible; do receiving commitments
improve flow without becoming rigid; are foul/restart rhythms appropriate?
Report seed, initial direction, tick and an exact save for suspicious sequences.

## Tests and deterministic evidence

From repository root:

```text
node packages/handball-engine/scripts/test-v2.cjs
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/prove-v2-contact.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/handball-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/game/tsconfig.json
```

M1: 9 tests. Core/continuous/contact: 27 tests. The tests cover committed and
evaded contact, legality independent of defender skill, progressive discipline,
physical breakthrough evidence, paired handover cancellation, moving reception,
save/resume, observation, playback speed, adverse restart paths and both halves.

The old parry regression depended on one wing possession always choosing the same
finish. It now initializes a physically reachable shot outside the keeper's catch
window and verifies the actual parry flight, loose ball and later recovery. The
beaten-debt regression now uses a physical shoulder-crossing fixture, rather than
depending on the old feint's synthetic BEATEN event. Neither change forces a
successful production outcome.

`contact-proof.json` is generated from four full 2x30-minute matches (seeds 1 and
2025, both initial directions). It records action/contest counts, sanctions,
re-entry, QA ticks and fingerprints. Both seed-2025 runs save immediately before
their first holding foul and resume to identical final state and event hashes.
The old proof file is preserved. Scores are observations, never acceptance gates.

## Remaining uncertainty / next continuation

This is a materially stronger checkpoint for coach review, not final realism
approval. Contact uses body discs and a simplified reach/technique model. It does
not yet model detailed arm/hand anatomy, contact balance, offensive charging,
advantage or the complete severe-foul catalogue. Late holding decisions still
use a limited policy; foul frequency has not been calibrated. Disqualification
replacement selection is still incomplete.

Shot volume, goalkeeper behaviour, defensive/offensive symmetry, repeated screen
episodes, action cadence, restart pacing and long-match balance need inspection.
Moving reception now preserves a commitment through the pass; the policy for
aborting such a commitment under new threats remains limited. No scoreline is
proof that these behaviours are realistic.

The schema/version changed. Existing 2.2 saves remain reproducible with the
accepted commit and are deliberately rejected by the 2.3 loader, rather than
silently changing their semantics. No legacy gameplay source was modified.
Unrelated match-QA instrumentation, season audit, `.claude/` and temporary
benchmark files remain exactly outside this batch. Do not commit this batch or
push unless the user asks. Resume here, preserving the current tree.

## Accepted checkpoint file manifest

Exact 40 files committed in `a0291a6` (no legacy gameplay edits):

```text
apps/game/app/scenario-lab/core/page.tsx
apps/game/app/scenario-lab/match/page.tsx
apps/game/app/scenario-lab/page.tsx
apps/game/app/scenario-lab/scenario-lab.css
packages/handball-engine/package.json
packages/handball-engine/scripts/prove-v2-match.cjs
packages/handball-engine/scripts/test-core.cjs
packages/handball-engine/scripts/test-v2.cjs
packages/handball-engine/src/v2/README.md
packages/handball-engine/src/v2/actions.ts
packages/handball-engine/src/v2/core/CHECKPOINT.md
packages/handball-engine/src/v2/core/CONTINUATION.md
packages/handball-engine/src/v2/core/actions.ts
packages/handball-engine/src/v2/core/checkpoint-proof.json
packages/handball-engine/src/v2/core/continuous.test.ts
packages/handball-engine/src/v2/core/continuous.ts
packages/handball-engine/src/v2/core/core.test.ts
packages/handball-engine/src/v2/core/engine.ts
packages/handball-engine/src/v2/core/interactions.ts
packages/handball-engine/src/v2/core/match-proof.json
packages/handball-engine/src/v2/core/match.ts
packages/handball-engine/src/v2/core/matchReplay.ts
packages/handball-engine/src/v2/core/population.ts
packages/handball-engine/src/v2/core/replay.ts
packages/handball-engine/src/v2/core/restarts.ts
packages/handball-engine/src/v2/core/rules.ts
packages/handball-engine/src/v2/core/scenarios.ts
packages/handball-engine/src/v2/core/space.ts
packages/handball-engine/src/v2/core/state.ts
packages/handball-engine/src/v2/core/structure.ts
packages/handball-engine/src/v2/core/transitions.ts
packages/handball-engine/src/v2/executor.ts
packages/handball-engine/src/v2/model.ts
packages/handball-engine/src/v2/primitives.ts
packages/handball-engine/src/v2/replay.ts
packages/handball-engine/src/v2/rules.ts
packages/handball-engine/src/v2/scenario.test.ts
packages/handball-engine/src/v2/scenario.ts
packages/match-integration/src/v2CoreSnapshot.ts
packages/match-integration/src/v2Snapshot.ts
```

## Final recorded verification

All 36 tests passed (9 M1 + 27 core/continuous/contact); engine and app typechecks passed. Both lab routes returned HTTP 200 with the new controls. Browser automation had no connected browser.

| Seed / direction | Fouls | Two-minute suspensions | State hash | Event hash |
|---|---:|---:|---|---|
| 1 / TOP | 17 | 9 | `0213a788` | `4593ebbb` |
| 1 / BOTTOM | 10 | 3 | `715bfe02` | `3719c5c5` |
| 2025 / TOP | 16 | 8 | `ef3f4453` | `84ec2062` |
| 2025 / BOTTOM | 10 | 4 | `0554e6c6` | `6ffe199b` |

Every run reached exactly 3,600,000 ms of official time. In both seed-2025 directions, saving at tick 310 before the holding foul at tick 311 reproduces the final hashes above. For TOP, inspect the suspension at tick 3887 and expiry at 6287. For BOTTOM, inspect the suspension at 5500 and expiry at 7900. Physical admission follows expiry; it is not implied by the expiry event.

## Final working-tree status

No realism-batch files are staged. HEAD remains the accepted checkpoint. The three unrelated tracked files and two unrelated untracked entries below were already present and were preserved.

```text
 M apps/game/app/match-qa/page.tsx
 M apps/game/app/scenario-lab/core/page.tsx
 M apps/game/app/scenario-lab/match/page.tsx
 M apps/game/lib/matchQa/qaHarness.ts
 M apps/game/scripts/season-audit.ts
 M packages/handball-engine/scripts/test-core.cjs
 M packages/handball-engine/src/v2/core/CONTINUATION.md
 M packages/handball-engine/src/v2/core/actions.ts
 M packages/handball-engine/src/v2/core/core.test.ts
 M packages/handball-engine/src/v2/core/engine.ts
 M packages/handball-engine/src/v2/core/interactions.ts
 M packages/handball-engine/src/v2/core/restarts.ts
 M packages/handball-engine/src/v2/core/scenarios.ts
 M packages/handball-engine/src/v2/core/state.ts
 M packages/handball-engine/src/v2/core/structure.ts
 M packages/handball-engine/src/v2/core/transitions.ts
?? .claude/
?? apps/game/.tmp-final-benchmark.ts
?? packages/handball-engine/scripts/prove-v2-contact.cjs
?? packages/handball-engine/src/v2/core/REALISM.md
?? packages/handball-engine/src/v2/core/contact-proof.json
?? packages/handball-engine/src/v2/core/contact.test.ts
?? packages/handball-engine/src/v2/core/contact.ts
?? packages/handball-engine/src/v2/core/contactScenarios.ts
```
