# Exact metric definitions

The executable definition registry is `apps/game/lib/matchBenchmarks/reference.ts:METRICS`. Reference ingestion requires exact metric name, unit and definition equality. Every comparison carries actual N, sample unit, reference N, confidence, provenance, fallback and status.

| Metric | Numerator / denominator or counting rule |
|---|---|
| goals, shots, possessions | Both teams per completed match; shots = actual SHOT_RELEASED; possessions = completed canonical ledger attacks |
| goalsPerTeam, shotsPerTeam, possessionsPerTeam | Same definitions, one team per completed match |
| conversion | goals / released attempts, including misses/blocks |
| goalsPerPossession | goals / completed ledger attacks |
| saves | Unique non-goal shot actions with SAVE_CAUGHT/PARRY; a goal after keeper touch remains a goal |
| shotsFaced | saves + goals; conventional on-target denominator, not all released attempts |
| savePct | saves / (saves + goals); misses and blocks excluded; keeper ID captured at release |
| turnovers | Sum of career result team turnovers; not relabeled raw pass losses |
| technicalErrors | Ledger TECHNICAL_VIOLATION endings; narrower than TECHNICAL_TURNOVER loss class |
| offensiveFouls | Ledger OFFENSIVE_FOUL endings |
| sevenMetres, sevenMetreConversion | Career result 7m attempts; 7m goals / 7m attempts |
| suspensions | Career result two-minute suspensions |
| contacts | CONTACT_EXECUTED events; these are distinct from referee decisions |
| assessedFouls | Deduplicated canonical foul IDs from existing diagnostics |
| advantages | ADVANTAGE_PENDING events; realized/recalled events remain separate in upstream diagnostics |
| whistles | Deduplicated WHISTLE_RESTART foul IDs: contact-rule stops, not every possible referee whistle |
| freeThrows | FREE_THROW restart awards, including technical/passive awards |
| possessionSeconds | Mean first-to-last event official-clock seconds for completed ledger attacks; not 3600 / attack count |
| transitionPossessions | Distinct possession IDs observed in TRANSITION |
| transitionAttempts | Actual observed TRANSITION phase entries; not a count of theoretical fast-break opportunities |
| transitionShots, transitionGoals | Shots released in TRANSITION and their goals |
| transitionConversion | transition goals / transition shots |
| transitionRate | distinct transition possessions / completed ledger attacks; terminal/phase boundary censoring should be considered |
| shotShare, goalShare | Group attempts/goals divided by all match attempts/goals in category/position scopes; player shares use the player's team |
| scorerConcentration, shotConcentration | Maximum player goals/shots divided by team goals/shots |
| scorerHHI | Sum of squared player goal shares within a team |
| minutes | Canonical courtMs / 60000 |
| quality, pressure, blockThreat | Mean canonical release decisionQuality, pressure and block threat; units are engine scales, not empirical xG |
| distance, angle | Mean canonical goal-centre distance (metres) and shooting angle (radians) at release |

CATEGORY rows partition attempts into canonical kinds (including STANDING, BACKCOURT_JUMP, WING, PIVOT, BREAKTHROUGH, SEVEN_METRE and any future canonical kind). PHASE rows identify transition versus other canonical phases. They are not summed together as disjoint shot types. Near-six-metre context uses the existing curved goal-area clearance ≤1.5m, excluding 7m, not a simple radial 6m threshold. Pressure bins <0.2/≥0.2 and quality bins <0.65/≥0.65 reuse prior diagnostics and are descriptive engineering cuts. Continuous distributions are also retained. Distance bins are ≤8m, 8–10.5m, >10.5m.

Role mapping: GK→MV, LW→V6, LB→V9, CB→M9, P/P2→M6, RB→H9, RW→H6. Position shot/goal rows use role at release; player rows record final canonical role and should not be used to infer time spent in each tactical position. Per-player result contributions are retained, with court time, energy, shots/goals, conversion and team shares. Assists, created chances, penalties won, M6 reception attribution and exact per-shot score/manpower/proximity are explicitly unsupported rather than fabricated.

Goalkeeper contexts include category, range, pressure, decision quality, phase, curved-area proximity, angle and block-threat distributions, plus opposing execution capabilities and keeper gameplay capability/energy snapshots. Keeper-unattributed shots are retained as UNATTRIBUTED and do not receive individual keeper expectations. Post-tick snapshots describe observed release context, not a separate replay or independently estimated shot model.
