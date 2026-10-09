# Canonical career match metrics

50 paired real-career matches before and after. Input snapshot SHA-256: `37b2f9ee4648ede1a422549fb680bad5c172ebdf70c77f65334d2e6487ab0347`. Seed recipes are identical.

All rows are distributions across complete matches, not independent possession samples. Percentile interpolation is linear between sorted observations. The stored per-match records include shot origins, identities, positions, outcomes and canonical possession endings.

| Metric | BEFORE mean / median | BEFORE p10–p90 | BEFORE range | AFTER mean / median | AFTER p10–p90 | AFTER range |
|---|---:|---:|---:|---:|---:|---:|
| Possessions, both teams | 180.30 / 180.00 | 173.00–189.00 | 164.00–195.00 | 111.46 / 111.00 | 102.80–121.10 | 97.00–125.00 |
| Home possessions | 90.24 / 90.00 | 86.00–94.00 | 83.00–98.00 | 55.98 / 56.00 | 51.90–61.00 | 49.00–63.00 |
| Away possessions | 90.06 / 90.00 | 86.90–95.00 | 81.00–97.00 | 55.48 / 55.00 | 50.90–61.00 | 48.00–62.00 |
| Goals, both teams | 81.24 / 82.00 | 71.80–91.10 | 63.00–98.00 | 34.08 / 34.00 | 26.00–43.00 | 18.00–50.00 |
| Shot attempts | 142.72 / 141.00 | 135.00–151.00 | 123.00–155.00 | 83.60 / 82.50 | 73.90–94.10 | 67.00–102.00 |
| Goals / possession | 45.1% / 45.2% | 39.7%–50.6% | 34.6%–54.7% | 30.5% / 31.1% | 23.7%–36.5% | 17.8%–43.5% |
| Mean possession recorded span, seconds | 19.99 / 20.00 | 19.05–20.81 | 18.46–21.95 | 32.44 / 32.43 | 29.73–35.02 | 28.80–37.11 |
| Completed passes / possession | 4.11 / 4.11 | 3.84–4.46 | 3.71–4.66 | 8.43 / 8.35 | 7.36–9.77 | 6.90–10.38 |
| Backcourt jump + standing share | 76.5% / 77.1% | 71.4%–82.4% | 65.2%–84.4% | 63.9% / 64.8% | 55.5%–71.1% | 50.6%–75.2% |
| Wing category share | 7.4% / 6.7% | 4.6%–10.7% | 3.6%–16.6% | 5.3% / 5.1% | 2.3%–9.0% | 0.0%–11.6% |
| Other close/category share | 16.1% / 16.4% | 11.6%–20.1% | 8.5%–24.4% | 30.8% / 30.9% | 25.0%–36.8% | 20.3%–42.5% |
| Turnover ending count (career result) | 41.62 / 41.00 | 34.00–50.10 | 30.00–54.00 | 34.10 / 34.00 | 25.00–44.00 | 18.00–53.00 |
| Losses without shot (ledger) | 38.54 / 38.50 | 30.90–47.00 | 27.00–51.00 | 28.46 / 29.00 | 20.00–36.10 | 14.00–49.00 |
| Goalkeeper save events | 51.38 / 50.50 | 40.00–65.10 | 31.00–74.00 | 38.00 / 39.00 | 30.80–45.10 | 21.00–54.00 |
| Save %: saves / (saves + goals) | 38.6% / 38.0% | 30.7%–46.8% | 24.6%–52.9% | 52.7% / 52.5% | 44.2%–63.0% | 33.8%–72.0% |
| Save events / all attempts | 35.9% / 35.6% | 28.7%–43.5% | 22.5%–49.3% | 45.5% / 45.6% | 37.2%–54.2% | 28.6%–61.2% |
| Transition shot attempts | 28.08 / 28.00 | 18.00–37.10 | 14.00–45.00 | 0.08 / 0.00 | 0.00–0.00 | 0.00–1.00 |
| Transition goals | 7.50 / 7.00 | 5.00–11.00 | 2.00–13.00 | 0.06 / 0.00 | 0.00–0.00 | 0.00–1.00 |
| Transition shot share | 19.5% / 19.4% | 13.6%–24.7% | 10.1%–30.4% | 0.1% / 0.0% | 0.0%–0.0% | 0.0%–1.4% |
| Mean per-team top scorer share | 32.8% / 32.3% | 25.4%–39.4% | 19.6%–45.5% | 38.3% / 38.3% | 30.3%–49.0% | 25.5%–50.5% |
| Mean per-team scorer HHI | 0.21 / 0.21 | 0.17–0.24 | 0.15–0.27 | 0.26 / 0.25 | 0.20–0.33 | 0.16–0.41 |
| 7m attempts | 2.88 / 3.00 | 1.00–5.00 | 0.00–8.00 | 2.86 / 2.50 | 1.00–5.00 | 0.00–8.00 |
| Suspensions + disqualifications | 4.34 / 4.50 | 1.00–7.00 | 1.00–10.00 | 3.20 / 3.00 | 1.00–6.00 | 0.00–8.00 |
| Fouls | 52.42 / 52.00 | 45.00–60.20 | 33.00–69.00 | 96.10 / 95.00 | 73.70–124.20 | 64.00–142.00 |
| Mean release distance, metres | 12.14 / 12.14 | 11.38–12.73 | 11.06–13.55 | 9.16 / 9.15 | 8.96–9.41 | 8.89–9.53 |
| Canonical simulation time, ms | 5254.14 / 5031.01 | 4313.05–6721.85 | 4273.72–7975.39 | 4317.44 / 3372.71 | 3136.89–4737.95 | 2796.40–19903.88 |

Existing EHF_ELITE intervals are engineering plausibility bands. They have no cited empirical precision and do not automatically calibrate an Allsvenskan career sample. Being inside a band proves no visual causality. See aggregate.json for every interval and every outside seed.

Long-release diagnostics: BEFORE 1715/7136 attempts beyond 15m (455 goals), including 1136 beyond 20m (280 goals). AFTER 2/4180 beyond 15m (1 goals), including 2 beyond 20m (1 goals). These cutoffs describe observed geometry; no required quota is imposed.

Definitions and limitations are in each aggregate.json. Save percentage is explicitly saves/(saves+goals); misses and blocks are excluded from that denominator. Other attempts comprise CLOSE in the existing reference reader, including 7m and EMPTY_GOAL; it is not a pure six-metre-distance count. Possession duration is the recorded first-to-last official event span. Exact transition attempts without a phase-bearing event and a distinct catch-quality scalar are unavailable in the baseline.

No outliers were removed. Both aggregate.json files preserve top-five high/low scoring, possession-count, shot-mix and scorer-concentration matches. after/seed-set.json plus inputs.json can reproduce any match via the same canonical career path.
