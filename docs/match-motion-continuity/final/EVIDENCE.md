# Evidence provenance

The delivery report uses these authoritative results from the final implementation at `706cec7`:

- `delivery-motion/`: all three full canonical fixtures, detailed trajectory windows and canonical scene catalogs.
- `delivery-regression/`: twenty paired fixture/seed recipes and their full results; source stable during the batch.
- `delivery-browser/`: three passing real-browser checks, live/replay at 1×/4×/16×, pause/seek, full replay and canonical handball cues.
- `motion/`: the three completed final envelopes intended for normal Load Game import.
- `scene-source/scenes-{7,3,28}.json`: final canonical cue catalogs copied from `delivery-motion/`.
- `measurements/before/`: pinned v2.1 baseline measured with the final diagnostic definition.
- `comparison.json`, `trajectory.svg`, `trajectory.png`: final before/after comparison and trajectory evidence.
- Final test/build/typecheck logs and `continuation-proof.json`: verification receipts.

Earlier task-owned artifacts are preserved for traceability and are **not final-result evidence**: `browser/`, `browser-live-verified/`, `regression/`, `pass-support-motion/`, `pass-support-regression/`, `measurements/after/`, and non-catalog files in `scene-source/`. Their scores, trajectories and browser counts may differ from the final implementation. `tactics/` contains completed tactic variant checks before the last released-passer/coverage correction; final core tests verify tactic behavior after it.

The retained baseline at `../before-final/` and `../browser-baseline/` predates implementation. `../experiments-summary.json` retains development-trial results, including rejected movement models. No artifacts were regenerated during closeout.
