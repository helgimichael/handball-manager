# Reference data and ingestion

Schema: `match-benchmarks/1`; each profile has its own id/version. Profiles contain handball sport identity, optional country/competition/level/category/season/date range, kind, notes, metric distributions and per-metric provenance. A season requires competition identity, and a competition requires country. Each metric knows its denominator, scope, unit, sample N and transformation history. Provenance records source name/location, collection method, extraction version, timestamp, confidence, match/event counts and notes. Adjustments have independent provenance.

Ingest a JSON array of profiles with `--reference path/to/profiles.json`. `ingestReference(unknown)` is also a reusable typed ingestion entry point. Unknown metrics, unit/denominator mismatches, missing provenance, invalid sample counts, malformed dates, negative SD, out-of-order percentiles, duplicate metric/scope rows and non-finite values are rejected. Equal-priority lookup ambiguity is also rejected. Missing distribution fields are allowed; insufficient fields produce an honest unavailable comparison. References must match scope semantics and category; a broad global profile does not silently imply all categories.

Illustrative shape (strings below are placeholders, not a numerical dataset):

```text
{
  schemaVersion: 'match-benchmarks/1', id, version,
  kind: 'REAL_WORLD_REFERENCE', sport: 'handball',
  country, competition, level, category, season, dateRange,
  metrics: [{metric, unit, definition, scope,
    distribution: {n, mean?, median?, sd?, min?, max?, p05?, p10?, p25?, p75?, p90?, p95?},
    provenance: {name, location, collectionMethod, extractionVersion,
      timestamp, confidence, matches, events?, notes},
    transformations: [],
    adjustments?: [{layer, feature, centre, coefficient, provenance}]
  }], notes: []
}
```

## Repository evidence reused

Existing realism v2/v2.1 and Motion reports are engine-generated samples, not empirical handball truth. The pinned v2 inputs provide real club/player identity and gameplay rating snapshots for reproducible simulation; they provide no empirical shot/save distributions. Repository real-world Sweden data principally contains rosters, identity evidence, player biographies, rating proposals and sources. No validated competition match/shot/keeper distribution with consistent denominators and adequate provenance was discovered for this framework. The historical `EHF_ELITE` code explicitly labels its ranges broad plausibility checks, not historical statistics; selected comparable bands are retained only as ENGINEERING_SANITY_RANGE checks, with the code source named. Ambiguous historical foul bands are not applied to actual whistle counts.

Empirical profiles currently populated: **none**. The default reference JSON is an empty array. Current sample: Herrallsvenskan (`swe-2`), reference environment 2026-27, men-senior. Handbollsligan Herr/Dam, Herrallsvenskan/Damallsvenskan, Bundesliga, Danish, Norwegian, Icelandic and youth profiles await verified datasets. Synthetic test fixtures are never shipped as references.

## Collect next

1. Official competition-season match results, team possessions (with definition), shots, turnovers, 7m attempts/goals, suspensions and actual referee restart counts.
2. Keeper-attributed on-target shots and saves, with goals after touches handled consistently; category, release location/angle, pressure and settled/transition tags.
3. Player minutes, tactical position, attempts/goals, assists and turnovers with official coding definitions; keeper and shooter identity to support conditional capability models.
4. Match dates, lineups, opponent/home context and source licenses/access, collection coverage, extraction scripts/versions and missingness checks.

Build distributions at the same analysis scope (team-match, keeper-match or conditional shot cohort), keeping numerator/denominator counts and clustering by match. Estimate any capability/style coefficients from documented evidence or explicitly label an engine-independent model assumption in a separate future model class. Do not infer coefficients from the very simulation being judged.
