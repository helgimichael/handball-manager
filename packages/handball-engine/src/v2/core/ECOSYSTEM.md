# V2 full-match Human QA handoff

Version `2.6.0-match-ecosystem.1`. Continue from this working tree. Do not commit,
push, restart the implementation, or apply fixes to legacy gameplay.

The accepted continuous-match, contact, wing and backcourt implementations remain
the foundation. This batch completes the broad ordinary-match lifecycle for
comprehensive Human QA. It is not a claim of referee certification, calibrated
match statistics, or visual approval.

## Reconstructed starting state

On resumption, the tree already contained modifications to `engine.ts`,
`restarts.ts`, `scenarios.ts`, `state.ts`, `structure.ts`, `transitions.ts` and the
core test runner, plus untracked `referee.ts`, `passive.ts` and their tests.
The first run passed 49/50 tests: the unfinished passive save test attempted to
mutate a deliberately frozen loaded snapshot. It now creates a mutable owned copy.
The unrelated match-QA page, QA harness, season audit, `.claude/` and temporary
benchmark were preserved. The historical `CONTINUATION.md`, `REALISM.md`,
`WINGS.md`, `BACKCOURT.md` and their proofs describe earlier versions.

## Delivered roadmap

| Area | Current implementation / QA surface |
|---|---|
| Full match | Two 30-minute halves, ten-minute interval, changed ends, opening throws, full time and retained final throws |
| Physical play | Shared persistent actions, swept ball encounters, interceptions, saves, rebounds, contact, wing/back/pivot relationships and defensive help |
| Restarts | Physical collection/return, readiness, release and completion for free throws, throw-ins, goalkeeper throws, centre throws and 7m throws |
| Referee | Protected advantage, recall before control is restored, delayed personal punishment, progressive warnings/suspensions/disqualification, stopped-clock administration |
| Passive play | Observed build-up warning, completed-pass count, restart/blocked-shot exceptions and warning cancellation |
| Population | Fifteen-player match rosters, reserve goalkeeper and field cover, physical exchanges, cancellation on changed eligibility, suspension expiry, replacement after disqualification, 7v6 and goalkeeper return |
| Workload | Persistent energy, distance and court time; bounded movement capacity; bench/interval recovery; automatic rotations |
| Medical input | Explicit treatment request, official interruption, physical exit/replacement, three-attack eligibility and exceptions, permanent unavailability |
| Coaching | Persisted per-team 6:0/5:1 and balanced/quick tempo, workload rotation and timeout policy, explicit exchange commands |
| Time-outs | One one-minute team timeout per half, possession/allowance validation, ten-second notification, existing restart preservation and whistle-based clock resumption |
| Human QA | Exact historical timeline, event jumps, workload/referee inspectors, selected-tick downloads and commands that branch a continuation |
| Reproducibility | Versioned immutable saves, deterministic mutable executor, sparse archives and exact state/event comparisons after resume |

## Rules and modelling boundary

The rules reference is the [IHF indoor rules effective 1 July 2025](https://www.ihf.info/sites/default/files/2025-07/09A%20-%20Rules%20of%20the%20Game_Indoor%20Handball_E.pdf),
especially 2:10, 4:11, 7:11–12, 13:2, 14:2 and Clarifications 3, 4 and 8.
The timeout profile uses the base one-per-half rule, not the optional three-per-match
competition variant. Medical eligibility can also return after suspension or at
the next half; punished-opponent and goalkeeper-head-hit exceptions are inputs.

The passive warning threshold is **a documented modelling choice, not a shot
clock**: accumulate 18 seconds of controlled-ball observation alongside at least
four completed circulation passes. Directed drive/dribble progress reduces that
observation; forward transitions are protected. Dead-ball and stopped-clock ticks
do not advance it. The warning does not itself award a turnover. After warning,
the fifth reception normally ends the attack; the fourth-pass restart and blocked
shot exceptions allow one additional pass. A block before four counts when attack
regains the ball; a deflection out does not count as a reception. Defensive personal
punishment and goalkeeper/goal outcomes clear the warning. Dead-ball return passes
do not count. Broader subjective early-passive criteria remain outside this first
observation model.

Energy is a dimensionless simulation value, not a medical measurement. Each active
50 ms tick costs `0.000003 + speed² × 0.0000007`; rest restores `0.000025`. It is
bounded to 0.3–1. Movement speed and acceleration use `0.8 + 0.2 × energy`, without
changing base attributes. Moving to dead-ball positions still costs effort.
Rotation looks for energy below 0.62 and a replacement at least 0.18 fresher.
The timeout policy looks for three tired players after 60% of a half. These are
explicit coaching choices, alongside the preserved example 15/45-minute exchanges
and late 7v6 request. None is an official handball rule or an optimized coach.

Treatment is an explicit physical-evidence input (`requestTreatment`), also exposed
as a QA command. There is no arbitrary per-tick injury lottery. Treatment currently
uses a 30-second administrative pause and physical walking exit. The referee's
personal-sanction administration lasts two simulation seconds. Those durations are
model choices. Eligibility never teleports a player onto court.

## Defects found by full-match integration

- Terminal mutable ticks used to run post-processing; they are now no-ops.
- A timeout could exhaust the physical restart budget while nothing was allowed
  to move. Paused preparation ticks are now tracked separately from award time.
- Automatic vacancy selection could admit a second goalkeeper or duplicate a
  field role. It now selects the missing kind/role; a new invariant rejects two
  goalkeepers on one team.
- A reused bench player could carry an old wing role into a goalkeeper exchange,
  preventing the extra-player return policy from finding them. Completing that
  exchange explicitly assigns P2; goalkeeper return clears the 7v6 state.
- A sanction during a queued exchange could leave an unfinishable exit request.
  Cancellation is now a persisted event and terminal exchange phase.
- A second infringement could overwrite a recalled 7m opportunity with an ordinary
  free throw. The original protected restart now survives the additional sanction.
- Medical eligibility and deferred punishment now have explicit period-boundary
  handling. Non-finite match intervals are rejected.

## Verification

Final checks: **61 core tests and 9 M1 tests passed**. Engine and game-app
typechecks passed. All four ordinary full matches and both commanded full-match
branches completed with exact saved continuation comparisons. The final route
check returned HTTP 200 and included coaching, passive-warning and workload
controls in its server-rendered content. `git diff --check` passed.

Run from the repository root:

```text
node packages/handball-engine/scripts/test-v2.cjs
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/prove-v2-ecosystem.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/handball-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/game/tsconfig.json
git diff --check
```

`ecosystem-proof.json` is the authoritative generated evidence. Its top-level
`complete` becomes true only when all four ordinary full matches (seeds 1 and 2025,
both initial directions), exact selected-tick saves, penultimate-tick reconstruction
and two commanded full-match branches finish successfully. Each commanded branch
changes tactics, takes a timeout, requests treatment, verifies physical exit and
eligibility restoration, and compares an independent saved continuation.
Earlier proof files must not be used as current-version fingerprints.

The first successful matrix produced 2–4 team timeouts, 9–23 suspensions, 2–6
disqualifications and 17–37 exchanges per ordinary match. Scores ranged from
44–41 to 63–60. These are observations requiring coach scrutiny, not desired
statistics. The ordinary runs produced no passive warnings or pending advantages;
focused tests and explicit QA commands cover those paths. Their natural frequency
has not been established or increased to satisfy a statistical target.

## Comprehensive Human QA

Open `http://localhost:3001/scenario-lab/match`. The local server was started and
the route returned HTTP 200. Browser discovery returned no connected browsers;
there is no automated visual/interaction approval for this batch.

1. Generate seed 2025 in both directions, then seed 1. Confirm exactly 60 minutes
   of official time, the interval, changed ends, scores and visible full-time state.
2. Use `ecosystem-proof.json`'s `qaMoments` and event jumps. Inspect contact before
   its foul, progressive punishment, official clock stoppage, restart whistle,
   suspension expiry, physical gate exit/admission and disqualification replacement.
3. Inspect workload before and after an automatic timeout or exchange. Compare the
   historical player table and court at 0.25×, 1× and 4×. Review the pace of movement,
   passing, contact, shots, restarts and tactical relationships without judging only
   the final score.
4. Download a selected running tick. Use the coaching controls to branch with a
   changed defence/tempo, legal substitution or timeout. A branch replaces the
   displayed archive from the selected tick onward. Save first to retain both runs.
   Ineligible commands must show an error without changing the selected state.
5. At a controlled live-ball tick, use **Test observed passive warning and continue**.
   Inspect warning/pass events and how the carrier responds. This is a supplied
   referee observation, not a claim that the automatic model would warn there.
   `passive.test.ts` and `ecosystem.test.ts` cover fifth reception, exception passes,
   defensive punishment, blocks and unchanged counts through timeouts.
6. Select an on-court player and **Test medical interruption and continue**. Check
   the stopped clock, replacement's wait for exit, attack-count eligibility and
   later legal re-entry. Treatment does not itself create a foul or random injury.
7. Download during flight, warning, timeout, treatment or halftime; resume and
   compare final state/event fingerprints against the same unmodified run. Do not
   compare a deliberately commanded branch with its original continuation.
8. Review the existing `/scenario-lab/core` scenarios for short, repeatable contact,
   wing, backcourt and transition investigations. The M1 lab remains
   a separate regression path.

For a defect, retain the seed, initial direction, exact tick, selected-tick save,
command (if any), expected behaviour and actual behaviour. Browser rendering,
late-match playback cost, coaching plausibility, balance and tactical authenticity
are the key Human QA work. Saves may be tens of megabytes.

This handoff is for the ordinary 2×30-minute simulation. Overtime/shootouts, a
competition-specific timeout variant, a full unsportsmanlike-conduct/head-impact
catalogue, post/crossbar body geometry, involuntary stretcher evacuation and
medical injury incidence are not modelled. The existing planar discs, scalar ball
height, fixed handling-stride approximation and scoped referee judgments remain.
Those limits should guide follow-up work; do not represent this engine as complete
implementation of every IHF rule.

If the server has stopped, from `apps/game` run:
`node ../../node_modules/next/dist/bin/next dev --port 3001`.

## Exact continuation state

HEAD remained `61a720d18423526adb9bb75463846eef37087d63`; no files were staged,
committed or pushed. The V2 changes are the modified core/state/execution modules,
core test runner and match-lab page, plus new `referee.ts`, `passive.ts`,
`condition.ts`, `coaching.ts`, their tests, this guide and
`scripts/prove-v2-ecosystem.cjs` / `ecosystem-proof.json`.
`CONTINUATION.md` now points here without deleting the historical checkpoint.

Resume with the current tree and Human QA findings. Preserve the three unrelated
tracked edits (`apps/game/app/match-qa/page.tsx`, `apps/game/lib/matchQa/qaHarness.ts`,
`apps/game/scripts/season-audit.ts`) and the pre-existing `.claude/` and
`apps/game/.tmp-final-benchmark.ts`. No legacy gameplay was changed. The expected
next action is comprehensive Human QA using the steps above, not restarting any
previous roadmap stage. If code changes follow, regenerate the ecosystem proof
before treating its hashes as current.
