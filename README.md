# Handball Manager

Playable alpha: real career squads, V2 live matches, saved 2D replay, contracts and season rollover. See [the delivered build and how to play](docs/PLAYABLE_BUILD.md) for architecture, validation and current limits.

From this repository on Windows:

```powershell
npm.cmd run build --workspace=@handball-manager/game
npm.cmd run start --workspace=@handball-manager/game -- --port 3001
```

Open http://localhost:3001/. For development, run `npm.cmd run dev --workspace=@handball-manager/game -- --port 3001`. The app uses Webpack so it also works where Windows blocks native SWC/Turbopack bindings.

The migration baseline below is historical; the actual game now lives in `apps/game`.

Standalone Handball Manager project. Not part of STARKVIS OS, FIELD, SIM, SIGNAL, or Smiðja — those remain the source/reference repositories.

## Layout

```
packages/
  handball-engine/   Framework-free handball match simulation core,
                      migrated verbatim from STARKVIS starkvis-sim
                      (HM-0.1 audit baseline, commit d62c7fe).
```

Further packages (`game-core`, `handball-data`, `tactics`, `match-renderer`, `statistics`, `ui`) and `apps/desktop` will be added in later passes as needed — not built speculatively.

## Provenance

`packages/handball-engine` is a byte-for-byte copy of `starkvis-sim`'s pure-logic simulation core (domain/simulation/policies/scenarios/canonicals + the framework-free `ui/plannedSequence.ts`, `ui/simulationRuntime.ts`, `ui/actionFlow.ts`), per the HM-0.1 Architecture & Extraction Audit. No behavior, terminology, or constants were changed in this pass — see `MIGRATION_NOTES.md`.
