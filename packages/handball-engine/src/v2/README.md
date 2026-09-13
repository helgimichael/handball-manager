# Engine V2 — Milestone 1

Status: implemented and programmatically verified; visual Human QA remains pending.
Scenario: `CENTRE_THROW_OFF_BASELINE`. Engine version: `2.0.0-centre-throw-off.1`.

## Architecture and boundaries

- `model.ts`: authoritative state, stable player identities, temporary assignments,
  intents, actions, ball/flight ownership, exact tick/time, official clock and persisted RNG.
- `rules.ts`: explicit IHF indoor 2025 throw-off-area profile, preparation checks,
  action eligibility and restart-completion evidence.
- `scenario.ts`: controlled starting positions, tasks, seed and distinct opening-half /
  post-goal contexts. No autonomous attacking or defensive policy.
- `actions.ts`: bounded repositioning and PREPARING → COMMITTED → EXECUTING →
  COMPLETED lifecycle; failed/interrupted actions are terminal. Preparing is not throwing.
- `executor.ts`: reads the situation, accepts authorisation/execution commands,
  executes actions, resolves physical contact and applies atomic state transitions.
  Canonical events record transitions at the resulting tick, never predicted outcomes.
- `replay.ts`: immutable exact snapshots, historical cursor, fixed-tick playback,
  versioned JSON saves and deterministic state/event fingerprints.
- `packages/match-integration/src/v2Snapshot.ts` converts
  only the supplied historical state to `MatchRenderSnapshot`.
- `apps/game/app/scenario-lab/page.tsx` uses the existing `snapshotToScene` adapter
  and production FIELD `MasterCourtDisplay`, with separate authoritative inspectors.

Reuse is limited to court dimensions/mirroring, pure distance geometry, the pure
FNV-1a `seedFromString` primitive, and rendering infrastructure. The Mulberry32
primitive has explicit serializable V2 state rather than the legacy closure.
No legacy gameplay state, possession loop, AI policy, outcome, or timing contract
is imported. IDs retain their initial labels even if temporary assignments change.

## Rule and physical scope

Profile source: [IHF rules effective July 2025, 10:3b and 10:4](https://www.ihf.info/sites/default/files/2025-07/09A%20-%20Rules%20of%20the%20Game_Indoor%20Handball_E.pdf).

The baseline uses the four-metre throw-off area and a receiver inside that area.
Taker and ball must be wholly inside before authorisation; defenders remain outside.
Opening-half placement and clock differ from the post-goal context, where an
opponent deliberately remains across the centre line and the clock keeps running.
This post-goal baseline assumes no separate referee timeout.

Player geometry is a conservative body disc; receiving uses a 0.12 m swept ball /
hand envelope. This is a planar controlled scenario, without jumping or dribbling.
The ball travels from its actual release position. Only an executing receive action
at an actual compatible physical encounter can acquire control. Missing or
incompatible receivers never receive at the old target by timeout.

Physical encounter, successful control and legal restart completion are atomic at
the same tick. This matters because teammate touch inside the area completes the
throw-off under the selected rule. `RECEIVER_ENCOUNTER` shows that actual completed
contact, `CONTROL_COMPLETION` preserves the result for the next exact snapshot,
and `LIVE_PLAY` stops the scenario. These display stages do not postpone or predict
the legal completion timestamp. Before that completion, `ball.inPlay` and ordinary
play permission are false. No ordinary-play actions are implemented after it either.

IHF also allows completion when the released ball wholly leaves the area. That
evidence is recognized by the profile, but outside-area throws are outside this
baseline; an unreceived exit terminates the scenario explicitly rather than
fabricating the required successful reception. This slice is not a complete IHF engine.

## Focused verification

From the repository root:

```powershell
npm run test:v2 --workspace=@handball-manager/handball-engine
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/handball-engine/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/game/tsconfig.json
```

Nine tests pass: physical/event lifecycle, save/replay/speed determinism, both
directions and contexts, missing authorisation/execution/budget/interruption,
moved receiver, corrupt saves, invalid preparation and observation independence,
historical-state isolation, and physically present but incompatible receiver.
Tests execute through the real V2 executor. The dedicated runner transpiles in
memory; the separate typechecks validate types. Logging/inspection is read-only
and has no tick scheduler input. Canonical transition recording is always on.

Seed 2025 finishes at tick 112 / 5,600 ms. Saving at release and resuming matches
both final fingerprints exactly in each combination:

| Direction | Context | State fingerprint | Event fingerprint |
|---|---|---|---|
| TOP | OPENING_HALF | `dca2efac` | `12d00b64` |
| TOP | POST_GOAL | `42a150da` | `7abde065` |
| BOTTOM | OPENING_HALF | `a6af512e` | `8ba22846` |
| BOTTOM | POST_GOAL | `b9bdf0e3` | `54a9e8bb` |

Fingerprints are stable FNV-1a regression checks, not security signatures.
Tests additionally check continuation from several stages and playback at
0.25×, 0.5×, 1×, 2× and 4×. Seeking selects an existing immutable snapshot;
the renderer never labels it using a future player's role, action or ownership.

## Remaining local Human QA

The route returned HTTP 200 with the lab and historical inspector at
`http://localhost:3001/scenario-lab`. Browser discovery returned no connected
browsers, so layout, animation, hydration and click interaction have not been
visually verified. If needed, start the app with:

```powershell
npm run dev --workspace=apps/game -- --port 3001
```

1. Open `/scenario-lab`, use seed `2025`, Top goal and Opening half, then
   **Start / reset**. Confirm the full FIELD court and all 14 players appear.
2. Play at 0.25×, pause and single-step. Confirm taker preparation, authorisation,
   release, visible ball travel and receiver control. Use the history slider to
   inspect ticks 0 (dead), 1 (preparation), 84 (ready), 91 (authorised),
   105 (release), 106–109 (flight), 110 (encounter/control/completion),
   111 (completion inspection), and 112 (live-play stop).
3. Before tick 110, confirm DEAD / no live permission; during flight confirm
   controller None. At tick 110, confirm receiver control and same-tick
   PASS_RECEIVED / RESTART_COMPLETED. The controller and ball must match the court.
4. Save at tick 105, finish, reload the saved text, finish again and compare the
   state/event fingerprints above. Check Download save and Open save file too.
5. Seek back to preparation after finishing: positions, actions, roles, ownership
   and event list must return to that historical tick. Change playback speed and
   confirm the final fingerprints stay identical.
6. Repeat for Bottom goal and After goal (all four combinations). Confirm the
   mirrored court, legal post-goal opponent across halfway, and different official
   clock. End at live play; no organised attack should start.

No organised attack, defensive systems, transitions, shooting, goalkeeper AI,
7v6, scoring, or calibration was added. No commit or push was performed.
