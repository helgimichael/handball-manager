# Current engine versus empirical handball

Engine N=60, se_handbollsligan_herr. Reference season 2025-26; canonical fixture roster season remains 2026/27.

| Metric/scope | Engine N | Engine mean | Reference N | Reference mean | Coverage | Fallback | Status | Priority |
|---|---:|---:|---:|---:|---:|---|---|---:|
| goals/MATCH | 60 | 62.633 | 182 | 60.857 | 1.000 | EXACT_COMPETITION_SEASON | UNRESOLVED | 11.096 |
| possessions/MATCH | 60 | 128.733 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| shots/MATCH | 60 | 101.633 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| outfieldShots/MATCH | 60 | 101.633 | 182 | 97.890 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 11.942 |
| outfieldConversion/MATCH | 60 | 0.617 | 182 | 0.620 | 1.000 | EXACT_COMPETITION_SEASON | UNRESOLVED | 3.007 |
| savePct/MATCH | 60 | 0.269 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| sevenMetres/MATCH | 60 | 4.200 | 182 | 6.582 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 29.180 |
| sevenMetreConversion/MATCH | 59 | 0.836 | 182 | 0.757 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 9.707 |
| suspensions/MATCH | 60 | 4.483 | 182 | 4.802 | 1.000 | EXACT_COMPETITION_SEASON | UNRESOLVED | 9.095 |
| whistles/MATCH | 60 | 18.333 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| transitionShots/MATCH | 60 | 3.633 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| turnovers/MATCH | 60 | 34.400 | 0 | NO REFERENCE | NO REFERENCE | NO_REFERENCE | NO REFERENCE | 0.000 |
| savePct/KEEPER | 120 | 0.268 | 480 | 0.286 | 1.000 | EXACT_COMPETITION_SEASON | UNRESOLVED | 6.770 |
| saves/KEEPER | 120 | 11.525 | 480 | 8.900 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 16.746 |
| shotsFaced/KEEPER | 120 | 42.842 | 480 | 29.815 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 26.947 |
| scorerConcentration/TEAM | 120 | 0.301 | 364 | 0.250 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 27.418 |
| shotConcentration/TEAM | 120 | 0.263 | 364 | 0.237 | 1.000 | EXACT_COMPETITION_SEASON | SUPPORTED PROBLEM | 11.811 |

## 30-save investigation

Percentiles are empirical CDFs. Above the observed maximum is not proof of impossibility. No shot-context/player ability adjustment is fitted.

- Match 50: 25/54 = 46.30%. Saves empirical percentile 1.000, rate percentile 0.958, N=480. Rate above observed maximum: false. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification NORMAL.

- Match 27: 22/52 = 42.31%. Saves empirical percentile 1.000, rate percentile 0.921, N=480. Rate above observed maximum: false. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification NORMAL.

- Match 13: 20/38 = 52.63%. Saves empirical percentile 0.998, rate percentile 0.985, N=480. Rate above observed maximum: false. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification WATCH.

- Match 39: 19/43 = 44.19%. Saves empirical percentile 0.992, rate percentile 0.940, N=480. Rate above observed maximum: false. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification NORMAL.

- Match 46: 19/46 = 41.30%. Saves empirical percentile 0.992, rate percentile 0.906, N=480. Rate above observed maximum: false. EXACT_COMPETITION_SEASON: se_handbollsligan_herr. Classification NORMAL.

## Ranked calibration priorities

100 Ã— impact Ã— confidence Ã— coverage Ã— sample weights Ã— (0.7 Ã— capped standardized mean difference + 0.3 Ã— fraction beyond 2 reference SD); prioritization heuristic, not a handball target

- sevenMetres/MATCH: SUPPORTED PROBLEM, priority 29.180, mean difference -2.382, standardized difference -0.971.
- scorerConcentration/TEAM: SUPPORTED PROBLEM, priority 27.418, mean difference 0.051, standardized difference 0.909.
- shotsFaced/KEEPER: SUPPORTED PROBLEM, priority 26.947, mean difference 13.027, standardized difference 1.226.
- saves/KEEPER: SUPPORTED PROBLEM, priority 16.746, mean difference 2.625, standardized difference 0.562.
- outfieldShots/MATCH: SUPPORTED PROBLEM, priority 11.942, mean difference 3.743, standardized difference 0.497.
- shotConcentration/TEAM: SUPPORTED PROBLEM, priority 11.811, mean difference 0.026, standardized difference 0.491.
- goals/MATCH: UNRESOLVED, priority 11.096, mean difference 1.776, standardized difference 0.267.
- sevenMetreConversion/MATCH: SUPPORTED PROBLEM, priority 9.707, mean difference 0.080, standardized difference 0.448.
- suspensions/MATCH: UNRESOLVED, priority 9.095, mean difference -0.319, standardized difference -0.174.
- savePct/KEEPER: UNRESOLVED, priority 6.770, mean difference -0.018, standardized difference -0.179.
- outfieldConversion/MATCH: UNRESOLVED, priority 3.007, mean difference -0.003, standardized difference -0.057.

## Team expectation

Mapped team observations use competition baseline + historical team attack deviation + opponent goals-allowed deviation through the existing transparent expectation components. Unmapped or thin historical teams remain unresolved. This whole-season model is descriptive and has temporal leakage if misused for historical prediction.

## M9 and position evidence

Engine M9 share 15.43% (580/3758); official se_handbollsligan_herr season-table M9 share 18.97%, denominator 11041 recorded outfield/player goals. N=1 pooled season aggregate. This is descriptive position evidence, with registered-position versus release-role and competition-transfer caveats; no position-match z-score is claimed.

Engine M9 shot share 14.41% (879/6098); official se_handbollsligan_herr M9 shot share 20.16%, denominator 17816 official season attempts, including 7m exactly once. Supplemental profiles use match-benchmarks/1, POSITION_SEASON scope and N=1; they remain separate from the match catalog pinned by both completed engine batches.

## Retained Motion Continuity effects

Historical paired N=20, source docs/match-motion-continuity/final/comparison.json. For Allsvenskan, goals 47.25 â†’ 50.65 moved closer to the empirical 61.615 environment, while remaining below it.
Combined match save rate 42.23% â†’ 46.52%; contact whistles 21.1 â†’ 43.55; transition shots 2.35 â†’ 6. These are paired engine changes, not empirical whistle/transition comparisons. The combined historical save-rate aggregation is not substituted for the keeper-match reference distribution. Attribution of current rule gaps to Motion alone remains unresolved.

## Gaps and interpretation

NO REFERENCE remains honest for possessions, exact whistle/free throws, transition and detailed shot context. Official technical-error counts are retained under sourceTechnicalErrors rather than relabeled as canonical turnovers. Recorded outfield attempts exclude keeper shooting attempts. Scorer concentration is supported where player goals reconcile. Position-season aggregates are separate from match-level position distributions. No engine coefficient, gameplay attribute or match behavior has been changed.

## How to read the empirical benchmark

Check competition, reference season, coverage and denominator before deviation. EXACT_COMPETITION_SEASON and explicit GLOBAL keeper proxy are different evidence. SUPPORTED PROBLEM denotes a measurable descriptive mismatch in this fixed engine sample; LIKELY PROBLEM uses transferred evidence. Neither identifies a causal coefficient. Follow comparison.json for reference provenance, confidence, distributions, mean-difference caveats, team components and source hashes.
