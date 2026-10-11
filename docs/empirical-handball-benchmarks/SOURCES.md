# Public sources and acquisition

Primary source population: Swedish senior **2025/26 regular seasons**, the most recent complete seasons. All statistics are acquired from real public sources; no engine output, fast simulation or synthetic test record feeds a shipped empirical profile.

| Competition | Official public result/protocol surface | Category | Regular-season matches |
|---|---|---|---:|
| Herrallsvenskan (`swe-2`) | https://www.profixio.com/app/lx/competition/leagueid17956?t=schedule&f=played | men-senior | 182 |
| Handbollsligan Herr (`se_handbollsligan_herr`) | https://www.profixio.com/app/lx/competition/leagueid17951?t=schedule&f=played | men-senior | 182 |
| Handbollsligan Dam (`swe-w-1`, reference identity) | https://www.profixio.com/app/lx/competition/leagueid17958?t=schedule&f=played | women-senior | 132 |
| Damallsvenskan (`swe-w-2`, reference identity) | https://www.profixio.com/app/lx/competition/leagueid17959?t=schedule&f=played | women-senior | 132 |

The expected counts agree with the verified 14-team/26-round and 12-team/22-round regular seasons. Playoff cards are excluded; result coverage is checked against those populations. Published match URLs are `https://www.profixio.com/app/lx/match/{official ID}`. Full-time scores, team IDs and protocol events are read from the ordinary rendered public pages. Hidden generic UI labels such as “Shootout” are not treated as match facts.

Handbollsligan Herr's official Jilsén System player-statistics PDFs provide the richer match layer. The published URL family is `https://handballstats.se/stat_sve/xml/2025/2500101/PDF/{official match ID}_s.pdf`. The family was verified from indexed public documents, including https://handballstats.se/stat_sve/xml/2025/2500101/PDF/32336478_s.pdf. All 182 regular-season PDFs were acquired and parsed. Two representative layouts were rendered and visually checked, including a long player name that overlaps an adjacent numeric cell. Extraction preserves native PDF drawing order within each baseline, rather than geometrically interleaving the name and numbers. Scores, player goal sums, fractions and keeper denominators are independently checked.

Official player-season tables:

- Men: https://handballstats.se/statistics/herr/statistics/statistics.aspx?y=2025&l=2500101&p=Alla&t=0&o=0&ha=Alla and the same URL with `p=MV`.
- Women: https://handballstats.se/statistics/dam/overview.aspx?y=2025&l=2500201&p=Alla&t=0&o=0&ha=Alla and the same URL with `p=MV`.

These tables use stable source player/team IDs and official position labels. Keeper ordinary and 7m columns are separate. Player-season and keeper-season rates are not used as match-level variance. The men's outfield/player-season table records 11,041 goals; the official result population has 11,076. The 35-goal difference is accounted for by keeper goals in the match PDFs. Position-season shares therefore explicitly use the recorded outfield/player table denominator, not a silently asserted all-team total.

## Repository reuse and rejected alternatives

Existing club source manifests identified Handballstats and official protocol URL families. Current game club/competition identities provide exact or explicitly aliased team links; historical affiliations stay attached to the source season. Existing benchmark statistics/validation/evaluation functions remain the profile format and computational foundation. Repository simulation outputs are used only on the engine side of comparison.

Secondary aggregators were not needed because official sources were available. Search results for football Allsvenskan and table-tennis Allsvenskan were rejected as unrelated sports. General league totals and official season keeper leaderboards were not relabeled as keeper-match distributions. An official all-star article was not converted into a league distribution or a precise on-target denominator from rounded percentages.

Detailed international evidence was investigated at the IHF's 2025 men's World Championship statistics, including https://www.ihf.info/competitions/men/308/29th-ihf-mens-world-championship-2025/177649/statistics and its official match/team reports. It was not substituted for exact Swedish league data. No international competition or full pressure/angle shot-context profile is populated in this release. The explicit global keeper proxy uses the sourced Swedish men's Handbollsligan population and names that population in every transferred comparison.

## Access and cache policy

Robots checks returned 404 for the two acquisition hosts: no published directives were found. The collector checks robots and honors disallow rules. It uses anonymous public pages, published PDFs and only the exact public infinite-scroll action exposed in the rendered page. Its ordinary session cookie/CSRF mechanism is the website's anonymous reading flow. Signed live-event resync URLs, private APIs, login surfaces, paywalls and rate-limit bypasses are not used. HTTP 401/403/429 blocks further requests to that host for that collector instance.

`empirical_cache.py` spaces request starts at least one second apart, saves raw bytes and metadata under `.tmp/empirical-cache/public`, reuses successful responses, and caches 404 responses for 24 hours. Raw HTML/PDF buffers and anonymous page tokens are not committed. Transient DNS failures were retried through the same cached collector. The final remaining Damallsvenskan rejection is a source protocol with an unattributed goal, not an unresolved network failure. Tests and derived-profile rebuilds are fully offline.

Each committed source manifest contains public URLs, retrieval timestamps, method, response SHA-256, parser version, competition/season and normalized hash. Reference metrics link to that ordered manifest through `sourceManifestHash`; individual body hashes remain in the manifest/normalized sources. Derived values are never hand-edited.

## Reproduce collection (optional fresh source acquisition)

From repository root:

```powershell
python -m venv .tmp/empirical-venv
.tmp/empirical-venv/Scripts/python.exe -m pip install -r apps/game/scripts/requirements-empirical.txt
.tmp/empirical-venv/Scripts/python.exe apps/game/scripts/collect-empirical-sweden.py --protocols --pdf
.tmp/empirical-venv/Scripts/python.exe apps/game/scripts/collect-empirical-player-seasons.py
```

Use `--cache` with a new directory when intentionally refreshing corrected source content; keep old snapshots for comparison. Ordinary tests do not execute these commands.

## Supplemental official goal views

The same official season tables expose `&c=goal`: total goals, released attempts and separate made/attempted 7m columns, plus registered positions. Both men's (273 rows) and women's (210 rows) goal views reconcile exactly by source player/team ID, appearances, position and goals with the existing summary view. Total columns already include 7m. The source bytes were acquired before interruption and reused without downloading again.

`ingest-cached-position-shots.py` validates cached URL/body hashes, headers, denominators, duplicate IDs and cross-view reconciliation. It is offline by default. `--acquire` explicitly enables the shared public cache for fresh acquisition. Normalized files retain source metadata in `normalized/season-shots/`; supplemental season profiles use the existing `match-benchmarks/1` format and do not change the pinned match catalog.

```powershell
.tmp/empirical-venv/Scripts/python.exe apps/game/scripts/ingest-cached-position-shots.py
```
