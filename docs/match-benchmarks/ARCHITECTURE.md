# Match Calibration Benchmark Framework v1

The flow is canonical simulation → actual facts → reference lookup → transparent expectation → deviations. No production module imports the benchmark framework. The existing production observer is optional; heavy distributions, Wilson intervals and reference evaluation run after the match. No engine coefficients, player attributes, pacing or movement are changed.

Implementation: `apps/game/lib/matchBenchmarks/{reference,statistics,extract,evaluate,report}.ts`; developer entry point: `apps/game/scripts/match-benchmarks.ts`. Existing `scripts/lib/calibrationDiagnostics.ts` supplies read-only canonical post-tick measurements and definitions. `resultFromSession` and the canonical ledger remain the result/possession sources.

Four distinct objects remain visible: observed reference (with provenance), context expectation (baseline and individual adjustments), actual engine output, deviation/flag. Empirical data and `ENGINEERING_SANITY_RANGE` are separate. Engine samples never populate empirical profiles.

## Layers

Competition environment uses exact-season distributions where available. Lookup then explicitly tries competition multi-season, country/level and global profiles; category must match at every level. There is no cross-gender/category fallback. Missing rows fall back per metric/scope, never silently inherit a different denominator. Ambiguous equal-priority references are rejected. No exact season is extrapolated silently into a fictional future; an explicitly supplied multi-season environment can serve that future season.

Team features are means of actual gameplay capabilities for participating field players. Player features use canonical gameplay profile values, never CA/PA. Match context includes home/away, observed energy, fixture, actual lineup, final tactics and score; per-shot canonical geometry/pressure/energy and keeper/shooter capabilities are retained. Initial tactics and profiles are also emitted so final state is not mistaken for pre-match state. Historical empirical team strengths are not present and are unsupported. Tactical categories remain recorded context; no invented scalar converts them into performance adjustments.

Reference adjustments use `(feature − documented centre) × documented coefficient`, tagged TEAM, PLAYER or MATCH_CONTEXT, each with its own provenance. Missing features suppress confident classification. No empirical coefficients were found, so the shipped baseline has no invented capability adjustment. Conditional keeper expectations sum category reference expectations over actual on-target shots, using individual shot and capability values. Partial coverage cannot yield a whole-match expected save percentage. Conditioning on on-target shots intentionally evaluates conventional save rate rather than miss/block probability. References must use the same conditioning.

## Statistics and interpretation

Distributions include count, mean, median, sample SD, min/max and p05/p10/p25/p75/p90/p95. Percentiles use linear interpolation at `(N−1) × percentile`. A singleton has no SD. Zero denominators yield null, never zero performance.

Classification needs reference N≥30, confidence at least MEDIUM, available features and the metric's minimum actual sample (rates normally ≥10 denominator events). Match-count distributions allow one completed match observation: their SD represents between-match variation. Rate SD must describe variation at the same scope/unit as the observation; event-level Bernoulli SD is not a match-rate SD. Ingestion cannot verify that semantic promise, so collection documentation must establish it.

Reporting policy uses |z| ≥2 WATCH, ≥3 OUTLIER, ≥4 EXTREME. These thresholds are explicitly reporting conventions, not handball targets. SD comes from the selected distribution; no scale is invented. With only sufficient percentile data, p05/p95 mark OUTLIER and p10/p90 WATCH. No z is emitted for zero/missing SD. NO_REFERENCE, INSUFFICIENT_SAMPLE, INSUFFICIENT_REFERENCE, UNSUPPORTED and INVALID_EXPECTATION remain distinct from NORMAL. Wilson 95% intervals show keeper shot-count uncertainty. No shrinkage is applied in v1; tiny samples remain inconclusive. Batch rates are both pooled by explicit denominators and summarized across matches; teams/keepers in a match are correlated, not independent experimental replications.

## Reproducibility and performance

Reports carry engine commit/version/behavior revision, schema/profile versions, input/reference hashes, exact recipes/seeds/fixtures, source fingerprints and source-stability receipt. Partial output can be resumed by rerunning; completed summaries are protected from overwrite. Inputs and references are preserved as JSON. Raw events and full archives are hashed rather than exported. Per-match JSON includes comparisons, player distributions, keeper contexts and unsupported metrics. Summary JSON and Markdown supply distributions, empirical flags and separately labeled sanity checks. CLI/Markdown are the developer viewer; nothing appears in game navigation. Detailed per-match JSON, duplicated input snapshots and full test logs stay local via .gitignore; compact summary JSON, recipes, reference selections, Markdown and verification receipts are retained in git. The baseline command's pinned input already exists in docs/match-realism-v2/baseline/inputs.json.

`--prove` runs the first complete seeded match again without an observer and compares the entire canonical session and result, covering events, RNG, archive frames and core statistics. Every post-match analysis verifies its session hash is unchanged. Focused tests also check deterministic report repetition and short canonical simulation equality. Normal matches have zero added overhead because no new callback is installed there. Developer batches measure observer time and post-match analysis time separately; the paired wall-clock comparison is a single noisy observation, not a microbenchmark.

## Commands (PowerShell, from repository root)

```powershell
Set-Location apps/game
# FAST: 20 matches
node --import tsx scripts/match-benchmarks.ts --mode fast --inputs ../../docs/match-realism-v2/baseline/inputs.json --out ../../docs/match-benchmarks/fast-qa --prove
# CALIBRATION: 100 matches
node --import tsx scripts/match-benchmarks.ts --mode calibration --inputs ../../docs/match-realism-v2/baseline/inputs.json --out ../../docs/match-benchmarks/calibration-qa
# DEEP: 500 matches, explicitly requested; --count supports any positive safe integer
node --import tsx scripts/match-benchmarks.ts --mode deep --inputs ../../docs/match-realism-v2/baseline/inputs.json --out ../../docs/match-benchmarks/deep-qa
node --import tsx --test lib/matchBenchmarks/benchmarks.test.ts
npx tsc --noEmit -p tsconfig.benchmarks.json
```

Use a new output directory for every completed batch. Supported controls: `--competition`, `--season` (reference environment), `--country`, `--level`, `--category`, `--inputs`, `--fixtures` (comma-separated canonical fixture IDs), `--indices`, `--offset`, `--count`, `--seeds` (one explicit save seed per index), `--seed-prefix`, `--tactics` (JSON canonical manager-team patch), `--reference` (JSON profile array), `--out`, `--prove`. Pinned inputs determine fixture pools; a conflicting competition option is rejected. Without inputs, the requested competition's current repository squads/ratings are snapshotted. This is a benchmark of the canonical first-season fixture, not a fabricated future-season simulation.
