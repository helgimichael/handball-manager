# Empirical data model and interpretation

The pipeline is public source snapshot/manifest → normalized match and player-match observations → existing `match-benchmarks/1` distributions → post-match empirical evaluation. It adds optional evidence/provenance fields to the existing contracts, without changing their version or creating a competing benchmark contract.

## Physical layers

- `data/empirical-handball/source-manifests/`: official URLs, timestamps, response hashes, parser/version, competition/season and normalized hash. Local raw response bytes remain in the ignored cache.
- `data/empirical-handball/normalized/`: `empirical-handball-observations/1` match data, plus separate `empirical-player-seasons/1` official season tables. These are source observations, not reference distributions.
- `data/empirical-handball/derived/profiles.json`: the five compiled reference profiles, accepted by `ingestReference`. Four exact competition-season profiles and one explicitly labeled HBL keeper/7m proxy.
- Other derived JSON: quality, team histories, mappings, keeper-match cohort, player-season summaries and hashes. They support interpretation and regeneration; they do not change simulation.

## Identity and season

Official match ID is the primary unique key (`profixio:{ID}`); conflicting duplicate observations reject ingestion. Match competition, season, stage, team IDs and score must agree. Team source ID is retained as a durable identity, alongside the original source name. Current game club links use exact name/context or documented aliases; ambiguous names remain unresolved. Historical competition membership is not inferred from current game membership.

The collection key `swe-1` maps explicitly to canonical `se_handbollsligan_herr`; the file keeps its collection-key name while its dataset/profile competition is canonical. Women's reference identifiers are independent of men's and are not claimed to be playable game competitions. Women's teams cannot map to a current men's game team merely because the organization name matches; their source team IDs remain authoritative. Protocol player IDs remain source identities. PDF identities are scoped to match/team/shirt number. No similarly named players are merged across matches. Official season tables retain stable player/team IDs. Source `?`, `6M` or `9M` would remain unknown/broad; no side-specific position is invented.

Only 2025/26 complete regular-season environments were populated. A complete season can still have incomplete metric coverage. The model validates and preserves PARTIAL_SEASON and MULTI_SEASON labels, but no partial 2026/27 or pooled multi-season numerical profile is shipped. Different seasons are not silently combined. Unknown seasons remain NO_REFERENCE unless the documented global keeper proxy is applicable. The engine comparison explicitly selects historical reference environment 2025-26 for current 2026/27 roster/fixture inputs.

## Metric and cohort definitions

The executable registry remains `reference.ts:METRICS`, with strict unit/definition matching. New empirical compatibility metrics are `outfieldShots`, `outfieldConversion`, `sourceTechnicalErrors` and `playerGoalsPerAppearance`; the two outfield metrics are exposed only by post-match benchmark extraction. Canonical engine behavior is unchanged.

Keeper saves = ordinary saves + 7m saves. Shots faced = ordinary on-target shots + 7m on-target shots; keeper rows require this to equal saves + separately recorded goals conceded. Misses/blocks are excluded from the conventional save denominator. Every normalized component remains visible. Empty-goal/unattributed team goals are not automatically charged to a keeper. Keeper-match distributions require ≥10 shots faced; minutes remain unavailable. Keeper-season cohorts require ≥10 appearances and ≥100 shots faced. Season variance is never substituted for match variance.

Field-player goals/attempts combine ordinary and 7m columns. Keeper goals are retained separately, and keeper shot attempts are unavailable. Thus outfield attempts/conversion are benchmarked under explicit outfield definitions; the broader all-player shots metric remains unsupported. The derived source technical-error series sums the recorded field-player pass errors + lost balls + rule errors; keeper error columns are not normalized in v1. It is not an all-player turnover benchmark and is not silently mapped to canonical ledger turnovers/TECHNICAL_VIOLATION endings. Protocol penalties count made + explicitly missed 7m, not awards. Suspensions count two-minute equivalents; source protocol and PDF counting methods remain documented.

Scorer concentration = maximum reconciled player goal count / team goals; scorer HHI = sum squared goal shares. Shot concentration from PDFs describes recorded field-player attempts. Position-season shares use the official season-table denominator, include unresolved positions in that denominator, and have N=1 pooled season aggregate. They are descriptive, not per-match positional variance.

## Validation, evidence and coverage

Validation rejects invalid identity, provenance/hash, duplicate match/player-match identity, negative/non-integer counts, impossible fractions, invalid 7m totals, score disagreement and false keeper-denominator claims. Protocol player goals must reconcile to the result. Bad protocols remain result observations and carry a rejection record; they do not contribute unsupported player/rule measurements. PDF consistency issues are retained and scoped; valid keeper denominators are required for the rate cohort.

Evidence tiers: A full shot-event context; B shot-type aggregates; C shots/saves/goals; D results and scoring/rule protocol facts. The release contains D protocols, C HBL match statistics and a limited 7m category split. Missing full shot quality, distance/pressure, transition, ordinary whistles/free throws and possessions remain explicit gaps. Coverage is parsed metric matches / known regular-season matches, carried in each metric evidence/provenance record. Confidence follows the documented coverage policy, with transferred HBL keeper evidence capped at MEDIUM.

## Expectations and priority

Empirical team histories provide goals-for/against distributions. A separate descriptive report uses league baseline + historical team attack deviation + opposing goals-allowed deviation through the existing TEAM adjustment components. Coefficient 1 denotes arithmetic inclusion of a measured deviation, not a fitted causal prediction. Minimum historical N=10 is required. Unmapped/thin teams remain unresolved. Whole-season histories must not be used as leakage-free predictions of earlier historical matches; 2026/27 roster changes are also unmodeled.

No empirical gameplay-attribute coefficient is fitted, and no CA/PA is used. Player capabilities and shot contexts remain engine observations. Observed reference, contextual components, engine result and deviation stay distinguishable.

Batch mean comparisons report match/team-match/keeper-match observation N explicitly. Standardized mean difference uses empirical between-observation SD as an effect scale; it is not a significance z-score of the batch mean. Approximate mean-difference intervals cap effective N at match counts to reduce false precision from within-match clustering. Fixed fixture selection, season/roster differences and unmatched context remain caveats. Individual keeper flags still use their actual on-target denominator and the existing framework's evidence policy.

Priority = 100 × impact × confidence × coverage × sample weights × (0.7 × capped standardized mean difference + 0.3 × systematic fraction beyond two empirical SD). The factors are emitted and documented as a developer heuristic. SUPPORTED PROBLEM means a supported descriptive mismatch in this engine sample; LIKELY PROBLEM uses transferred competition evidence. Neither identifies the coefficient to fix or forces a future score.

## Offline commands (repository root)

Official goal-view player rows are stored separately under `normalized/season-shots/`. `position-shot-summaries.json` preserves goals, attempts, 7m and shares for all registered positions, including unknown positions in denominators. `position-shot-profiles.json` uses `match-benchmarks/1` with `POSITION_SEASON` scopes and N=1 pooled shot-share/conversion observations. It is supplemental to the pinned match catalog, not invented match variance. The rebuild command regenerates both catalogs. Comparisons show M9 season shot share descriptively with explicit competition-transfer and registered-position/release-role caveats.

```powershell
npm run empirical:rebuild --workspace @handball-manager/game
npm run empirical:report --workspace @handball-manager/game
npm run empirical:compare --workspace @handball-manager/game
```

The existing engine sample can be re-evaluated without simulation. To run a fresh identical Allsvenskan sample, choose a new output directory:

```powershell
npm run benchmark:fast --workspace @handball-manager/game -- --inputs ../../docs/match-realism-v2/baseline/inputs.json --reference ../../data/empirical-handball/derived/profiles.json --season 2025-26 --out ../../docs/empirical-handball-benchmarks/engine-new --prove
npm run empirical:compare --workspace @handball-manager/game -- --engine ../../docs/empirical-handball-benchmarks/engine-new --out ../../docs/empirical-handball-benchmarks/comparison-new
```
