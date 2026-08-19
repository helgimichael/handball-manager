# Handball Manager

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
