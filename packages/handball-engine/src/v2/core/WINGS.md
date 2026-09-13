# V2 wing relationships — Human QA checkpoint

Version: `2.4.0-wing-relationships.1`. Human QA accepted this wing checkpoint.
The verification and continuation records below were captured before acceptance.
The accepted contact/continuation checkpoint is preserved in
`e07388028dd9f8eac77051479828111a700389c2`
(`feat(engine): preserve v2 contact and continuation realism checkpoint`).
No push was performed. `REALISM.md` and `contact-proof.json` describe that
accepted 2.3 checkpoint; their historical evidence has been preserved.

## Root causes and changes

The old wing duty had a fixed target at the same approximate depth as a central
six-metre line. Its reason mentioned relationships, but it had no adjacent-back
partner or response to the outside defender. Meanwhile, outside defenders used
the central defensive depth floor. Changing the wing coordinate alone would
have left both passing and defending disconnected from the new position.

- `wing.ts` now owns the relationship: the far wing pins corner width; the near
  wing offers outside its adjacent back when there is a passing lane. The offer
  responds to backcourt depth and whether the outside defender has moved inside.
  `WING_PIN` / `WING_OFFER` duties identify the actual adjacent back.
- The outside defender protects the wing-to-goal line from legal space beside
  the curved goal area. Existing primary/helper/cover responsibilities still
  determine who acts. No extra defender is summoned by physical proximity.
- A wing can use an actual shooting window, approach a better legal takeoff
  position, or pass back to its adjacent back when the window is closed. These
  use ordinary persistent DRIVE, JUMP, SHOOT and PASS actions. Predicted positions
  never become releases, catches or completed actions.
- Shot context follows actual takeoff space. A wing player shooting from
  backcourt depth is no longer automatically labelled as a wing finish.
- Free-throw preparation preserves lateral lanes and clears the curved
  free-throw boundary. The old blanket instruction to send every attacker above
  9.7 metres unnecessarily pulled wings into backcourt depth. The shared signed
  goal-area geometry supplies the new constraint; players move there physically.

Long-run inspection also exposed shared sequencing defects:

- An outside defender could be legal at authorisation, then cross inside the
  taker's exclusion distance on the way to another legal destination. Movement
  during authorised free throws and throw-ins now uses the same player-spacing
  predicates as readiness and release. An invalid release still fails.
- Loose-ball collection could change possession after responsibilities were
  allocated but before actions were selected. Collection now precedes allocation,
  with another live/dead gate for goalkeeper recovery. Historical action reasons
  therefore describe the team that actually owns that tick's action.
- A queued outgoing airborne player was skipped by the normal selector, while
  population management waited for landing. Population management now requests
  LAND before EXCHANGE. Admission still waits for the outgoing player to leave.
- A fouled airborne holder could not LAND while holding a dead ball. The action
  gate now permits that prerequisite and rejects other airborne dead-ball
  movement. Landing, carrying to the restart, authorisation and release remain
  separate transitions. This fixed full-match free-throw stalls without clearing
  airborne state or fabricating restart completion.

Coaching references used for the role investigation:
[IHF Handball at School](https://www.ihf.info/sites/default/files/2020-05/H%40S%20Booklet.pdf)
and [EHF Circle of a Handball Life](https://www.eurohandball.com/media/33jjitll/circle-of-hb-manual.pdf).
The implementation choices and numerical thresholds are modelling judgments,
not coaching validation or a complete implementation of those materials.

## Review locally

The current development server serves `http://localhost:3001`.
Both `/scenario-lab/core` and `/scenario-lab/match` returned HTTP 200; the core
response includes the new wing scenario options. The browser runtime reports
no connected browsers. No automated visual or interactive browser result is claimed.

At `/scenario-lab/core`, choose seed **2025**, select a scenario, then press
**Start / reset** and play at **0.25×**. Repeat with HOME attacking each end:

1. **Left wing / adjacent back** and **Right wing / adjacent back**: compare the
   near wing's outside offer with the far wing's corner width. Inspect duty,
   partner ID, committed action, and the outside defender. Does this look like
   a usable wing/back relationship rather than two players chasing coordinates?
2. **Closed wing window / return pass**: inspect the wing's return to its adjacent
   back and actual ball encounter. The receiving back should remain a connection.
3. **Open wing window / actual finish**: watch takeoff, release, ball flight and
   goalkeeper/defender response. Judge the shooting opportunity separately from
   whether the shot scores.
4. **Free throw**, then **Continuous play (6 outcomes)**: watch wings clear the
   curved restart boundary and recover their corner/offer after execution. Check
   that moving defenders retain lawful spacing between whistle and release.

At `/scenario-lab/match`, generate seed **2025** in both starting directions.
Inspect the exact tick field and play short stretches around these moments:

| Home starts toward | Ticks | Inspect |
| --- | --- | --- |
| TOP | 300–450 | Foul at 311; free-throw authorisation at 357; wing recovery |
| BOTTOM | 300–450 | Foul at 311; free-throw authorisation at 362; wing recovery |
| TOP | 3880–4000 | H05's grounded approach at 3924 and return pass decision at 3945 |
| BOTTOM | 2430–2540 | H05 approach at 2467, then actual wing shot release at 2506 |
| BOTTOM | 3280–3380 | H05 returns to the adjacent back at 3327 |

Also inspect a later established attack after changed ends. Seek backwards after
watching an outcome: duties, player population, actions and events must describe
that historical tick. Compare playback rates on the same generated match.

## Remaining uncertainty

- Full horizontal jump travel, an airborne wing's angle improvement over the
  goal area, handedness and landing inside the area are not yet modelled. Current
  wing approaches are grounded; shots use the real stationary takeoff position.
- Wing/back timing, breadth of offers and outside-defender depth need coach QA.
  Long-run occupancy samples still include recovery frames far from the intended
  target. A median near the corner does not prove every relationship is credible.
- Advantage remains incomplete. Holding is an immediate whistle; clear-chance and
  dangerous-contact judgments remain simplified. No foul percentage was increased.
- Shot selection, keeper anticipation/reach, shot volume, possession duration and
  rhythm remain uncalibrated. Scorelines are not evidence of authenticity.
- The wider rule/population limitations recorded in `REALISM.md` remain, including
  passive play, general replacement after disqualification and coach substitutions.
- Saves are versioned strictly. Use the accepted commit for old 2.3 saves; new
  simulations and saves use 2.4.

## Verification and architecture

Commands:

```text
node packages/handball-engine/scripts/test-v2.cjs
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/prove-v2-wing.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/handball-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/game/tsconfig.json
git diff --check
```

The 9 centre throw-off tests and 36 core tests pass. Both typechecks pass.
Focused coverage includes both wing sides and court directions, closed-lane
responses, actual shooting context, physical movement bounds, landing prerequisites,
restart spacing, loose-ball allocation, failed execution, historical state,
save/resume, and playback-speed independence. The established-circulation test
now covers three continuous outcomes: a lawful holding foul can end the first
possession before a shot, and the restart/continuation must also execute.

`wing-proof.json` contains the full-match evidence for seeds 1 and 2025 in both
directions, occupancy diagnostics, canonical action moments, and seed-2025 exact
save/resume state/event hashes. Occupancy samples observe live established attack,
excluding the carrier and the first two seconds after each duty allocation.
`wingShots` counts shots by players with wing roles, not only shots labelled WING;
`wingReturns` counts return-pass commitments, not successful receptions.

| Seed | Direction | Final state hash | Final event hash | Resume tick |
| --- | --- | --- | --- | --- |
| 1 | TOP | `1463cdd1` | `9e5a05a0` | — |
| 1 | BOTTOM | `dd18da1f` | `c9fa6c1e` | — |
| 2025 | TOP | `47134e34` | `013909d2` | 2517 |
| 2025 | BOTTOM | `c9801067` | `2078d6b6` | 2505 |

All four complete 3,600,000 ms of official playing time. Both resumed runs match
their uninterrupted final state and event hashes exactly. Across these four runs,
non-carrier corner-pin samples have median sideline inset about 0.68 m and median
depth 1.45–1.58 m. Outside-offer samples have median depth 3.40–3.62 m. Between
32 and 58 corner-pin samples per run remain more than 4 m from their target;
recovery timing deserves visual review. No claim is made that these distributions
or the 22–25 recorded fouls per match establish realism.

New files: `wing.ts`, `wingScenarios.ts`, `wing.test.ts`, this note,
`wing-proof.json`, and `scripts/prove-v2-wing.cjs`. Existing V2 structure, space,
actions, engine ordering, population and restart files integrate the shared model.
The core Scenario Lab exposes the four fixtures; the existing match lab and exact
snapshot/replay adapters consume the same executor without special wing logic.

Legacy gameplay code was not changed. Only the already shared pure court geometry
is used. There is no new legacy policy import, renderer-driven action, replay-driven
chronology, or final-state lookup for historical labels.

## Continuation

This is the next Human QA checkpoint, not final realism approval. Preserve the
uncommitted batch; do not commit or push without a new request. Start any further
work from this tree and the evidence above. Prioritise the coach's observations
before altering wing thresholds or the unresolved finishing/contact models.

Unrelated pre-existing work remains untouched: `apps/game/app/match-qa/page.tsx`,
`apps/game/lib/matchQa/qaHarness.ts`, `apps/game/scripts/season-audit.ts`, `.claude/`,
and `apps/game/.tmp-final-benchmark.ts`.
