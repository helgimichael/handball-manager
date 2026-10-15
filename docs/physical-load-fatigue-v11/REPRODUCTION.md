# Verification commands

Run each heavy command to completion before starting the next. The final run used one game-test worker. Full raw evidence and logs are retained locally under `final/` and `verification/`; these large directories are ignored by Git. Committed JSON summaries retain paired distributions, denominators, source fingerprints and canonical hashes.

From the repository root:

```powershell
node packages/handball-engine/scripts/test-core.cjs
node packages/handball-engine/scripts/test-v2.cjs
npm.cmd run test --workspace @handball-manager/handball-engine
$env:HM_GAME_TEST_CONCURRENCY = '1'
npm.cmd run test:all:portable --workspace @handball-manager/game
npm.cmd run test:empirical --workspace @handball-manager/game
npm.cmd run typecheck
```

The game package name is defined in `apps/game/package.json`; alternatively run both game commands from that directory without `--workspace`.

From `apps/game`, the final cohort commands were:

```powershell
node --import tsx scripts/run-physical-profiles.ts --count 30
node --import tsx scripts/run-physical-comparisons.ts --mode style --count 20 --out ../../docs/physical-load-fatigue-v11/final/style-20
node --import tsx scripts/run-physical-comparisons.ts --mode rotation --count 30 --out ../../docs/physical-load-fatigue-v11/final/rotation-30
node --import tsx scripts/run-physical-regression.ts --league hbl --count 40
node --import tsx scripts/run-physical-regression.ts --league allsv --count 40
node --import tsx scripts/report-physical-comparisons.ts
node --import tsx scripts/report-physical-regression.ts
node --import tsx scripts/prove-physical-execution.ts
node --import tsx scripts/prove-physical-load.ts --league hbl
node --import tsx scripts/prove-physical-load.ts --league allsv
```

Retained recipes and production inputs under previous reconciliation/rotation `final/` directories are required. Pair/chunk manifests reject source or input drift. Completed profile runs refuse overwriting; use a fresh `--out` directory for a new experiment. Completed match chunks resume only with matching guards. Offline reports use the documented `final/` paths.

The focused test invocation from the repository root was:

```powershell
node --import tsx --test --test-concurrency=1 packages/handball-engine/src/v2/core/physical-load.test.ts packages/handball-engine/src/v2/core/rotation-fatigue.test.ts packages/handball-engine/src/v2/core/intelligence.test.ts packages/handball-engine/src/v2/core/identity.test.ts packages/handball-engine/src/v2/core/reconciliation-v11.test.ts packages/handball-engine/src/v2/core/execution-realism.test.ts
```

Build and start from `apps/game`:

```powershell
$env:HM_NEXT_DIST_DIR = '.next-game-physical-load-v11'
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3020
```

Open http://127.0.0.1:3020. Keep the isolated build directory environment variable set for both build and start. Nothing is deployed or pushed by these commands.
