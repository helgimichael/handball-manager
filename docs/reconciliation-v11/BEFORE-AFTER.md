# Before / after: Empirical Reconciliation v1.1

Both final cohorts contain exactly 80 paired recipes. Save seeds, clubs, fixtures, initial profiles and tactics match v1. HBL is the exact attempt/conversion reference. Allsvenskan has no exact attempt or keeper reference; HBL keeper values are a proxy only. Field-player measures include penalties; ordinary open play is reported separately. Ratios exclude empty denominators. SD is the sample SD; percentiles use linear interpolation.

## HBL

| Measure | Empirical 2025/26 | Reconciliation v1, N=80 | v1.1, N=80 |
|---|---:|---:|---:|
| Goals | 60.86 | 54.64 | 56.96 |
| Field-player attempts (including 7m) | 97.89 | 87.23 | 93.44 |
| Field-player conversion (including 7m) | 61.98% | 62.51% | 61.03% |
| 7m attempts | 6.58 | 7.08 | 6.49 |
| 7m conversion, mean of match ratios | 75.65% | 87.68% | 77.08% |
| 2-minute suspensions | 4.80 | 1.33 | 3.18 |

| v1.1 measure | N | Mean | Median | SD | p10 | p90 | p95 | Range |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Goals | 80 | 56.96 | 57.00 | 7.35 | 49.00 | 66.10 | 69.05 | 41.00–77.00 |
| Field-player attempts (including 7m) | 80 | 93.44 | 93.50 | 7.07 | 85.00 | 102.00 | 104.05 | 68.00–113.00 |
| Field-player conversion (including 7m) | 80 | 61.03% | 61.14% | 6.96% | 52.40% | 69.70% | 72.07% | 43.93%–79.27% |
| 7m attempts | 80 | 6.49 | 6.00 | 2.26 | 3.00 | 10.00 | 10.05 | 2.00–12.00 |
| 7m conversion, mean of match ratios | 80 | 77.08% | 80.00% | 18.68% | 50.00% | 100.00% | 100.00% | 33.33%–100.00% |
| 2-minute suspensions | 80 | 3.18 | 3.00 | 2.13 | 1.00 | 6.00 | 7.00 | 0.00–9.00 |

Penalty denominator: 398/519 pooled (76.69%); 80 non-empty match denominators. v1: 492/566 (86.93%). No streak caps.

Open play: attempts 80.15 → 86.95; mean conversion 60.37% → 59.86%; pooled 60.50% → 59.79%.

| Role | Attempt share v1 | v1.1 | Goal share v1 | v1.1 | Empirical season goal share |
|---|---:|---:|---:|---:|---:|
| V6 | 14.27% | 14.06% | 10.96% | 11.67% | 14.06% |
| V9 | 14.80% | 18.56% | 16.08% | 19.31% | 21.11% |
| M9 | 24.76% | 21.65% | 30.43% | 26.00% | 18.97% |
| M6 | 18.40% | 15.46% | 18.14% | 16.52% | 14.37% |
| H9 | 15.72% | 17.87% | 14.94% | 17.01% | 16.72% |
| H6 | 12.04% | 12.40% | 9.45% | 9.48% | 14.58% |

Position references are season aggregates, not per-match distributions; no exact positional attempt reference is claimed.

Largest scorer share per team: mean 31.52% → 30.18%, p90 41.41% → 38.73%. Largest player attempt share: mean 26.06% → 24.79%, p90 32.56% → 31.42%. These are observed shares, not caps.

Empirical largest scorer share: 25.02% (N=364); largest attempt share 23.73%. Allsvenskan has no exact largest-attempt-share reference.

Recorded intent duration: 1.80s → 0.91s. A real receipt now closes the stale carrier relationship, so this includes a changed episode boundary and is not an invariant uninterrupted-threat duration. Controlled persistence/free-carrier cases remain authoritative. Rapid drive/pass reversals 0.61 → 0.78 per match. Full common-observer and Intelligence diagnostics remain in the JSON.

Team conversion tails (≥30 field attempts): v1 14 above 75%, 3 above 80% of 160; v1.1 6 and 2 of 160.

| Keeper shot exposure | Open-play keepers N, v1 → v1.1 | Below 10%, v1 → v1.1 | Below 15%, v1 → v1.1 | Mean save%, v1 → v1.1 |
|---|---:|---:|---:|---:|
| ≥10 on-target shots | 160 → 160 | 3 → 3 | 13 → 14 | 28.04% → 26.74% |
| ≥20 on-target shots | 160 → 160 | 3 → 3 | 13 → 14 | 28.04% → 26.74% |
| ≥30 on-target shots | 129 → 141 | 2 → 3 | 11 → 12 | 27.30% → 26.71% |
| ≥40 on-target shots | 13 → 34 | 1 → 1 | 3 → 2 | 24.11% → 26.70% |

Duration diagnostic: 27.20s → 26.37s; no exact empirical duration target. Transition shots 6.16 → 6.35, goals 2.74 → 2.73.

Shot-bearing attacks 85.39 → 90.88; no-shot/procedural remainder 47.24 → 46.06. New exclusive endings per match: SHOT 90.88, TURNOVER 44.63, OFFENSIVE_FOUL 0.00, OTHER 1.44. Free throws and recycles continue attacks and are not additional possession endings.

Threat/episode diagnostics per match: threats per possession 6.26, advantage creations per possession 0.52, recoveries per possession 2.58, second-attack motors 186.28, shots after recycle 91.94, shots after second attack 61.65, one-threat possessions 9.64, multiple-threat possessions 116.46. Second-attack motors can recur within a possession: they are not independent attacks or an empirical target.

## Allsvenskan

| Measure | Empirical 2025/26 | Reconciliation v1, N=80 | v1.1, N=80 |
|---|---:|---:|---:|
| Goals | 61.62 | 53.99 | 58.05 |
| Field-player attempts (including 7m) | No exact reference | 87.98 | 95.21 |
| Field-player conversion (including 7m) | No exact reference | 61.28% | 60.97% |
| 7m attempts | 7.12 | 7.46 | 7.18 |
| 7m conversion, mean of match ratios | 74.99% | 88.99% | 80.31% |
| 2-minute suspensions | 5.77 | 1.36 | 6.05 |

| v1.1 measure | N | Mean | Median | SD | p10 | p90 | p95 | Range |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Goals | 80 | 58.05 | 58.00 | 6.75 | 50.00 | 67.00 | 70.05 | 41.00–76.00 |
| Field-player attempts (including 7m) | 80 | 95.21 | 95.00 | 6.93 | 86.90 | 103.00 | 105.05 | 72.00–110.00 |
| Field-player conversion (including 7m) | 80 | 60.97% | 61.04% | 5.56% | 53.02% | 67.09% | 70.30% | 50.98%–77.42% |
| 7m attempts | 80 | 7.18 | 7.00 | 2.76 | 4.00 | 11.00 | 12.00 | 2.00–14.00 |
| 7m conversion, mean of match ratios | 80 | 80.31% | 80.00% | 16.86% | 59.71% | 100.00% | 100.00% | 16.67%–100.00% |
| 2-minute suspensions | 80 | 6.05 | 5.00 | 3.24 | 2.00 | 11.00 | 11.05 | 0.00–14.00 |

Penalty denominator: 464/574 pooled (80.84%); 80 non-empty match denominators. v1: 534/597 (89.45%). No streak caps.

Open play: attempts 80.51 → 88.04; mean conversion 58.69% → 59.37%; pooled 58.76% → 59.35%.

| Role | Attempt share v1 | v1.1 | Goal share v1 | v1.1 | Empirical season goal share |
|---|---:|---:|---:|---:|---:|
| V6 | 14.66% | 14.59% | 12.41% | 13.09% | n/a |
| V9 | 16.07% | 18.84% | 15.58% | 18.50% | n/a |
| M9 | 23.98% | 20.55% | 30.45% | 24.68% | n/a |
| M6 | 16.21% | 14.59% | 14.66% | 13.31% | n/a |
| H9 | 17.08% | 19.94% | 17.30% | 19.94% | n/a |
| H6 | 11.99% | 11.50% | 9.61% | 10.49% | n/a |

Position references are season aggregates, not per-match distributions; no exact positional attempt reference is claimed.

Largest scorer share per team: mean 30.86% → 28.84%, p90 40.76% → 36.75%. Largest player attempt share: mean 25.56% → 25.09%, p90 32.61% → 30.43%. These are observed shares, not caps.

Empirical largest scorer share: 24.52% (N=364); largest attempt share n/a. Allsvenskan has no exact largest-attempt-share reference.

Recorded intent duration: 1.76s → 0.90s. A real receipt now closes the stale carrier relationship, so this includes a changed episode boundary and is not an invariant uninterrupted-threat duration. Controlled persistence/free-carrier cases remain authoritative. Rapid drive/pass reversals 0.64 → 0.75 per match. Full common-observer and Intelligence diagnostics remain in the JSON.

Team conversion tails (≥30 field attempts): v1 7 above 75%, 3 above 80% of 160; v1.1 8 and 2 of 160.

| Keeper shot exposure | Open-play keepers N, v1 → v1.1 | Below 10%, v1 → v1.1 | Below 15%, v1 → v1.1 | Mean save%, v1 → v1.1 |
|---|---:|---:|---:|---:|
| ≥10 on-target shots | 160 → 160 | 3 → 4 | 10 → 22 | 28.77% → 26.40% |
| ≥20 on-target shots | 160 → 160 | 3 → 4 | 10 → 22 | 28.77% → 26.40% |
| ≥30 on-target shots | 126 → 144 | 3 → 3 | 8 → 18 | 28.24% → 26.65% |
| ≥40 on-target shots | 15 → 33 | 0 → 0 | 1 → 2 | 24.51% → 27.79% |

Duration diagnostic: 27.70s → 26.55s; no exact empirical duration target. Transition shots 6.41 → 7.20, goals 3.05 → 3.66.

Shot-bearing attacks 86.51 → 92.59; no-shot/procedural remainder 43.80 → 43.30. New exclusive endings per match: SHOT 92.59, TURNOVER 41.96, OFFENSIVE_FOUL 0.00, OTHER 1.34. Free throws and recycles continue attacks and are not additional possession endings.

Threat/episode diagnostics per match: threats per possession 6.17, advantage creations per possession 0.51, recoveries per possession 2.64, second-attack motors 188.20, shots after recycle 93.46, shots after second attack 62.89, one-threat possessions 9.14, multiple-threat possessions 116.05. Second-attack motors can recur within a possession: they are not independent attacks or an empirical target.

Complete distributions, paired deltas, release quality/pressure, fatigue-by-half, penalty runs and all-shot/open-play keeper tails are retained in [DISTRIBUTIONS.json](DISTRIBUTIONS.json).
