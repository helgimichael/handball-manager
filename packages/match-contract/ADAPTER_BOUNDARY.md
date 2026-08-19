# Future adapter boundary (HM-0.2D design doc — not implemented yet)

This package (`match-contract`) defines the neutral `MatchRenderSnapshot`
type both sides of the future SIM → FIELD bridge will depend on. It does
not implement the bridge. This document records what the two future
adapters — not yet built — will each be responsible for, so HM-0.2E has
a concrete starting brief instead of a blank page.

```
handball-engine (SIM)
       │  HandballState
       ▼
MatchStateAdapter        ── not built yet, lives outside this package
       │  MatchRenderSnapshot
       ▼
match-contract            ── this package (types only)
       │  MatchRenderSnapshot
       ▼
renderer adapter          ── not built yet, lives outside this package
       │  FIELD scene / BoardObject[]
       ▼
match-renderer (FIELD)
```

Neither `handball-engine` nor `match-renderer` depends on `match-contract`
today (verified: no `match-contract` import exists in either package's
`src/` — see the HM-0.2D report Section 8). That stays true until
HM-0.2E actually builds an adapter that imports it from one side.

## MatchStateAdapter (SIM-facing)

Given the coordinate-system audit in this pass (report Section 4: SIM and
FIELD already share the same origin/axis/unit convention, confirmed by
byte-identical formation coordinates in both `handball-engine/src/
canonicals/fieldHandball/formations.ts` and `match-renderer/src/ui/
workspaces/tactics-board/library/FormationLibrary.ts`), this adapter's
job is narrower than "translate between two coordinate systems" — it is
closer to "reshape and select."

It should eventually:

1. **Read** `HandballState` produced by `handball-engine`'s
   `simulation/engine.ts` `step()` function (or a runtime host like
   `ui/simulationRuntime.ts`) — read-only, never mutate it.
2. **Convert positions**: `Player.position` (`MeterPoint`) and
   `Ball.position` copy straight across to `MatchPlayerRenderState.x/y`
   and `MatchBallRenderState.x/y` — per this pass's audit, no coordinate
   transform is needed for the default (TOP-goal-attacking) case. If a
   future scenario has SIM simulate an attack on the BOTTOM goal, this
   adapter is where `mirrorYForOppositeGoalSide` (already defined in
   `court.ts`) gets applied — not inside `handball-engine` itself.
3. **Map player ids/teams/roles**: `Player.team` (`"ATTACK" | "DEFENSE"`)
   maps directly to `MatchSide`. `Player.role` (SIM's fine-grained
   `AttackRole`/`DefenseRole`) maps to `MatchPlayerRenderState.roleLabel`
   as an opaque string; `MatchPlayerRenderState.kind` should be
   `"FIELD_PLAYER"` for every SIM player today, because **SIM has no
   goalkeeper entity** (see report Section 2 — `fieldDefenseFormationToPlayers`
   discards the canonical formation's `GOALKEEPER` object entirely, and
   `PlayerRole`/`TeamId` have no goalkeeper case). This adapter cannot
   produce a `kind: "GOALKEEPER"` player until SIM's domain model grows
   one — that is new engine work, not adapter work, and is out of scope
   for HM-0.2E as currently briefed.
4. **Map orientation**: `Player.facing` (`MeterVector`, a unit vector)
   needs the inverse of SIM's own `rotationToFacing()` (in
   `scenarios/fieldFormationAdapter.ts`) applied to recover a degrees
   value for `orientationDegrees` — that inverse function does not exist
   yet anywhere in the migrated code and is new adapter-layer work.
5. **Map ball state**: `Ball.status`/`possessorId` map directly to
   `MatchBallRenderState.status`/`possessorPlayerId`; `Ball.flight`
   (pass-in-progress physics) is intentionally NOT part of the contract
   — if FIELD-side rendering ever wants to show a flight trail, that is
   either a derived visual (interpolating between two snapshots) or a
   deliberate, separately-justified contract extension, not a reason to
   leak `BallFlight`'s `passerId`/`elapsedSeconds`/etc. into this type.
6. **Produce one immutable snapshot** per render/update tick — a pure
   function `(state: HandballState) => MatchRenderSnapshot` with no
   internal mutable state of its own, mirroring the immutable style
   already used throughout `handball-engine`.

## Renderer adapter (FIELD-facing)

Given `match-renderer`'s `BoardObject` type already uses the same
`{x, y}` meter convention and a `rotation: number` (degrees) field with
the same 0°-faces-TOP-goal convention `rotationToFacing` was built to
consume (see report Section 3), this side's job is also reshape-only,
not coordinate translation:

1. **Read** one `MatchRenderSnapshot`.
2. **Construct FIELD `BoardObject[]`**: `MatchPlayerRenderState` →
   `BoardObject` with `type` chosen from `side`/`kind`
   (`DEFENSE`+`FIELD_PLAYER` → `"DEFENDER"`, `ATTACK`+`FIELD_PLAYER` →
   `"ATTACKER"`, any side + `kind: "GOALKEEPER"` → `"GOALKEEPER"`),
   `position` copied directly, `rotation` copied directly from
   `orientationDegrees` (defaulting to FIELD's own default when `null`).
   `MatchBallRenderState` → a `"BALL"` `BoardObject`.
3. **Construct a `TacticsBoardScene`** (via FIELD's own
   `createInitialScene({ objects })`, already ported verbatim) from the
   resulting `BoardObject[]` — reusing FIELD's existing scene
   construction rather than inventing a new one.
4. **Never** import `handball-engine` to do this — the renderer adapter
   only ever sees `MatchRenderSnapshot`.

## What HM-0.2E must NOT do (carried over from this pass's constraints)

- Must not make `match-renderer` import `handball-engine`, or vice versa
  — both adapters live in a third place (e.g. a future `packages/
  game-core` or an app-level integration module), each importing
  `match-contract` plus exactly one of the two engine packages.
- Must not attempt to give SIM a goalkeeper to unblock the `kind:
  "GOALKEEPER"` mapping as a side effect of building the adapter — that
  is a SIM domain-model change and belongs to its own reviewed pass.
- Must not add animation/interpolation between snapshots in the adapter
  itself — that is a rendering-layer concern for whatever consumes a
  stream of `MatchRenderSnapshot`s, not the adapter that produces one.
