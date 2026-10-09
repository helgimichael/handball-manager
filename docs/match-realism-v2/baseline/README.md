# Baseline: 50 actual canonical career matches

All 50 matches completed before engine behavior changes. Starting HEAD: `aedf868`; exact current V2/production file fingerprints preserve the pre-existing uncommitted engine state. Engine version was `2.9.0-possession-ecology.2`.

The sample uses actual Allsvenskan squads, gameplay ratings, fixture identities, selected lineups, the normal manager plan and CPU coaching. It runs the actual career start/advance path. The complete input snapshot and 50 fixed seed recipes are stored alongside each detailed match. No match was removed.

| Metric, both teams unless stated | Mean | Median | p10–p90 | Range |
|---|---:|---:|---:|---:|
| Possessions | 180.30 | 180 | 173–189 | 164–195 |
| Goals | 81.24 | 82 | 71.8–91.1 | 63–98 |
| Shot attempts | 142.72 | 141 | 135–151 | 123–155 |
| Backcourt jump + standing shot share | 76.52% | 77.14% | 71.38–82.40% | 65.22–84.40% |
| Wing category share | 7.36% | 6.71% | 4.63–10.65% | 3.60–16.56% |
| Other category share | 16.12% | 16.44% | 11.59–20.14% | 8.51–24.44% |
| Lost attacks without a shot | 38.54 | 38.5 | 30.9–47 | 27–51 |
| Career-result turnover ending count | 41.62 | 41 | 34–50.1 | 30–54 |
| Saves | 51.38 | 50.5 | 40–65.1 | 31–74 |
| Save percentage, saves/(saves+goals) | 38.62% | 38.00% | 30.65–46.84% | 24.60–52.86% |
| Save share of all shot attempts | 35.91% | 35.63% | 28.69–43.46% | 22.46–49.33% |
| Mean recorded possession span, seconds | 19.99 | 20.00 | 19.05–20.81 | 18.46–21.95 |
| Transition shot share | 19.54% | 19.39% | 13.61–24.74% | 10.14–30.41% |
| Mean per-team top-scorer share | 32.82% | 32.34% | 25.44–39.39% | 19.65–45.51% |
| Canonical simulation runtime, seconds | 5.254 | 5.031 | 4.313–6.722 | 4.274–7.975 |

The stored `aggregate.json` includes all other metrics, pooled duration/distance/pass distributions, reference comparisons and top-five outliers. Duration is the first-to-last recorded official-event span. Turnover definitions and save denominator are deliberately explicit.

Existing engineering bands describe 84–140 possessions, 42–76 total goals and 18–55% backcourt share. Every baseline match exceeded the possession and backcourt bands; the profile is a question-raising plausibility reference, not an empirically sourced Allsvenskan calibration target.

Shot-origin evidence reveals an additional physical problem: 1,715 of 7,136 attempts occurred beyond 15m, with 455 goals; 1,136 occurred beyond 20m, with 280 goals. These cutoffs describe very long and halfway releases, not desired quotas. There were 1,657 shots by players initially identified as pivot, compared with 484 PIVOT-category attempts. This identity-position count is not a claim about their tactical role after a CPU exchange: incoming players can take a vacated role. An example is index 0: AWAY starting pivot Rasmus Broman scores a BACKCOURT_JUMP release at 20.8m, official time 105,850ms. The source of these shots must be examined in live decisions/continuation, rather than hidden with box-score scaling.

Highest total: index 0, seed `1765851951`, 42–56. Lowest: index 4, seed `2764169999`, 33–30. Three naturally drawn matches occurred, including index 25 (44–44). All outliers and fixtures remain in the sample.

Independent pilot runs repeated indices 0 and 1. Their full-score/event-stream/RNG/observed-frame hashes were identical to the corresponding baseline cases. `repeat-proof.json` records this deterministic proof.

Batch runtime was 378.36 seconds, including career construction, detailed reading and artifact writes. Runtime logs and pilot output remain under `.tmp`. The baseline did not modify engine behavior, player data, production lifecycle, archives, Motion or existing QA files.
