# V2 continuous-match Human QA checkpoint

This is the historical accepted 2.2 checkpoint. The subsequent uncommitted
realism pass and its QA instructions are in [REALISM.md](./REALISM.md).

Version `2.2.0-continuous-play.1`. The working tree is the deliverable; no commit or push.

The resumed tree already contained the accepted 2.1 possession/transition core,
nine scenarios, shared action/ball/contest semantics, exact playback, FIELD
adapters, Scenario Lab, and the separate M1 regression proof. Those remain.
`CHECKPOINT.md` and `checkpoint-proof.json` are historical 2.1 evidence.

This continuation adds continuous possession chains, executable restart recovery,
court/bench exchange, suspension expiry, 7v6 with goalkeeper return, and a complete
two-half match clock. Four actual 2 × 30-minute runs reached full time with the
10-minute interval, changed ends and six completed exchanges each. This is a
materially stronger Human QA checkpoint, not a declaration of complete rules or
tactical realism.

## Current architecture

| Files under `src/v2/core` | Responsibility |
|---|---|
| `state.ts`, `space.ts` | Authoritative state, stable identities, explicit RNG, geometry and rule profile |
| `structure.ts`, `actions.ts`, `interactions.ts` | Shared decisions, persistent execution and actual ball/body encounters |
| `transitions.ts`, `rules.ts`, `restarts.ts` | State-derived events; physical retrieval/return; free throw, throw-in, 7m, goalkeeper throw and centre throw-off |
| `population.ts` | Outgoing player fully leaves before incoming admission; official-time suspension expiry; goalkeeper return |
| `scenarios.ts`, `continuous.ts` | Initial conditions and six-outcome continuous/7v6 sessions |
| `match.ts` | Opening halves, halftime, changed ends, full time and retained final throws; explicit example coaching requests |
| `engine.ts` | One 50 ms executor; immutable public tick and privately owned batch execution |
| `replay.ts`, `matchReplay.ts` | Versioned exact saves; short-session frames; sparse long-match checkpoints and deterministic exact-tick reconstruction |
| `core.test.ts`, `continuous.test.ts` | 19 regression tests, including full halves and adverse paths |

Renderer: `packages/match-integration/src/v2CoreSnapshot.ts` reads only the supplied
tick. The new timeline is `apps/game/app/scenario-lab/match/page.tsx`; the existing
core lab now also offers continuous play and 7v6. The M1 path is preserved.

The core imports no legacy tactical policy or gameplay loop. Shared legacy reuse
is pure distance/goal-area geometry and seed hashing. No legacy gameplay changes
were made in this continuation. Pre-existing unrelated tracked edits in match QA
and the season audit were preserved.

## Semantics reviewed and defects corrected

- Dead-ball retrieval, return passing and restart execution are distinct. A
  collector's return never increments ordinary completed passes or makes play live.
- Arrival at the restart position only permits readiness checks. Authorisation,
  release, area exit/touch and physical reception remain distinct transitions.
- A running receiver can prepare for a named pass, but only a compatible swept
  encounter grants control. The offer and estimated lead do not assign possession.
- Physical local steering now includes lateral escape around a stationary body.
  No teleport or forced acquisition was introduced to resolve halftime congestion.
- Goalkeeper-throw checks permit an actual queued substitution crossing at its gate.
- Goalkeepers can receive a physical dead-ball return. Restart spacing targets
  remain outside the goal area rather than leaving an illegal target unresolved.
- End-line outcomes distinguish attacking last touch, defending field-player
  touch and goalkeeper touch. A later unrelated pass cannot retain an old free
  throw at the final signal.
- Sparse history stores append-only events once and immutable body checkpoints
  every 200 ticks. Seeking restores the preceding checkpoint and executes the
  intervening ticks. It never interpolates state or borrows future player labels.
- Playback speed and event display filters are outside simulation chronology.
  Exhausted budgets and invalid execution remain visibly incomplete/failed.

## Verification and deterministic evidence

Run from the repository root:

```text
node packages/handball-engine/scripts/test-v2.cjs
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/prove-v2-match.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/handball-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/game/tsconfig.json
```

M1: 9 passing tests. Core: 19 passing tests. Engine and app typechecks passed.
`match-proof.json` records actual full-match reports and fingerprints:

| Seed / initial home direction | Final state hash | Event hash | Score |
|---|---|---|---|
| 1 / TOP | `22933116` | `e2e3d788` | 42–50 |
| 1 / BOTTOM | `10405580` | `8c0187b9` | 24–53 |
| 2025 / TOP | `1b8d973e` | `df485856` | 43–39 |
| 2025 / BOTTOM | `2ed4678a` | `27c02a2c` | 27–54 |

Every run reconstructs its penultimate tick and reaches the same final hash.
Both seed-2025 runs also save at halftime (about 32 MB), reload, and finish with
identical state **and** event hashes. These fingerprints are deterministic
regression evidence, not cryptographic integrity guarantees. Saves reject an
incompatible schema or mismatched fingerprints.

## Local Human QA

All routes returned HTTP 200 on the development server at port 3001. The browser
runtime returned an empty browser list; no visual or interactive browser result is
claimed. The new UI still requires actual browser verification.

1. Open `http://localhost:3001/scenario-lab/core`. Run **Continuous play** and
   **7v6 and goalkeeper return**, seed 2025, in both directions. Watch multiple
   possessions, physical ball retrieval and return, legal restart execution,
   outgoing-before-incoming exchange, and goalkeeper return after possession loss.
2. Open `http://localhost:3001/scenario-lab/match`. Generate a 2 × 30-minute match.
   Select **Opening tick**, then Play, Pause, Single tick and the historical slider.
   Compare 0.25×, 1× and 4× at the same tick. Use executed-event jumps for goals,
   exchanges and the two period starts. Confirm the official clock stays fixed
   through halftime and the second half changes ends without position teleporting.
3. Inspect a centre restart around a goal and the opening of each half. Check DEAD
   preparation, authorisation, release/flight and completion. Check the historical
   player table against the court, especially before and after substitutions.
4. Download a selected tick during flight or halftime, resume that file, and
   compare the final fingerprint with the original match at full time. The loaded
   archive begins at the saved tick; it does not invent earlier frames.
5. Report seed, initial direction, tick and a downloaded save for defects. Review
   handball behaviour as well as rendering: spacing, passing options, pressure,
   recovery, restart pace and goalkeeper/extra-player decisions.

If the server is stopped, from `apps/game` run:
`node ../../node_modules/next/dist/bin/next dev --port 3001`.

## Practical limits / next continuation

The four long runs recorded zero fouls and suspensions despite those paths passing
direct encounter and expiry tests. Scores and direction-dependent outcomes are
observations, not targets; tactical diversity and balance need coach review.
Do not calibrate them merely to make summary statistics look realistic.

Coaching requests are an explicit demonstration schedule (field changes at 15/45
minutes, HOME 7v6 request after 51 minutes), not an autonomous coaching strategy.
The system still lacks the full disciplinary/officiating catalogue, passive-play
management, team timeouts, injuries/fatigue, and general roster/tactic management.
Disqualification reduces eligibility but replacement selection is not a complete
coach workflow. Goalkeeper delivery readiness and the three-second execution
budget are a scoped simulation approximation. Ball height, grounded body discs
and 0.8 m handling strides remain declared approximations.

The full-match UI yields between simulation batches and uses sparse history;
late-match playback performance and large save interaction need browser QA. The
short-session lab still retains each exact frame and should be used for bounded
sessions. Stop here for this larger Human QA checkpoint. Resume from this tree,
not from the historical 2.1 report; preserve existing work and do not commit/push.

## Git handoff

HEAD remains `dee325e5b43382ce8184c717b0af32c02ddcc2aa`. `git diff --check` passed.
Exact `git status --short` at handoff (directory entries include all new files):

```text
 M apps/game/app/match-qa/page.tsx
 M apps/game/lib/matchQa/qaHarness.ts
 M apps/game/scripts/season-audit.ts
 M packages/handball-engine/package.json
?? .claude/
?? apps/game/.tmp-final-benchmark.ts
?? apps/game/app/scenario-lab/
?? packages/handball-engine/scripts/prove-v2-match.cjs
?? packages/handball-engine/scripts/test-core.cjs
?? packages/handball-engine/scripts/test-v2.cjs
?? packages/handball-engine/src/v2/
?? packages/match-integration/src/v2CoreSnapshot.ts
?? packages/match-integration/src/v2Snapshot.ts
```
