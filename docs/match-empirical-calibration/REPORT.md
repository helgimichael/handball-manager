# MATCH ENGINE EMPIRICAL CALIBRATION v1

Starting checkpoint: **6c2c494**. Continued the interrupted work; completed research, retained baseline batches and development iterations were reused. Nothing was pushed. The causal implementation and numerical validation are finished. **Production browser inspection remains unverified because this session exposes no available browser.** This is not a claim that every definition-of-done condition is satisfied.

## Repository and evidence boundaries (items 1–5)

The original modified files `apps/game/app/match-qa/page.tsx`, `apps/game/lib/matchQa/qaHarness.ts` and `apps/game/scripts/season-audit.ts`, plus original `.claude/`, `apps/game/.tmp-final-benchmark.ts` and `docs/audit/`, were preserved byte-for-byte against the initial SHA256 inventory. They are excluded from calibration commits. Motion worktree `../handball-motion-lab` remains at `197d2a8`; both Pack #5 M6 stashes remain retained. Calibration does not grant approval to the unfinished Motion Human QA.

The committed `data/empirical-handball/derived/profiles.json` catalog remains unchanged (reference hash `28a89cbdb4b4646da550d6875cea2a86bc26717fe983ab375e8291f12911ad7a`). HBL men 2025/26 regular season is the primary exact competition reference: 182 matches, 364 team matches, 480 keeper matches with at least 10 on-target shots. The retained engine roster and fixtures are 2026/27, so “exact” denotes reference competition and season identity, not identical historical players or fixtures.

Allsvenskan uses its exact match/scorer/penalty/suspension evidence. Its keeper comparison is explicitly the male HBL proxy. HBL registered-position season totals are N=1 pooled descriptive evidence, not match-level position distributions; their use for Allsvenskan is also a proxy. Women's references were not transferred into male calibration. Allsvenskan attempts and field-player conversion lack exact references.

Both completed BEFORE samples were reused unchanged: HBL N=20 and Allsvenskan N=20. Final AFTER samples are **60 full matches per competition**, including the exact first 20 retained save seeds, fixture IDs and input hashes, followed by 40 additional recipes. No baseline population or original empirical ingestion was rerun. Two diagnostic baseline recipes were used earlier only to recover missing causal traces. Supplemental `team-keeper-reference.json` aggregates all valid official keeper rows, including short-exposure backups, within each team-match; it uses the existing schema and remains separate from the pinned main catalog.

## Shot and keeper causes and changes (items 6–17)

The excessive save environment had several interacting causes. Aim choice repeatedly selected the same side when both corners were similarly open. Keeper coverage combined lateral movement, broad hand reach and flight timing too generously, without spending lateral reach on high/low intervention. A fingertip deflection always killed the shot as a potential goal: after its flight kind became DEFLECTION, goal-plane detection ignored it. Off-target keeper touches were also recorded as saves. These mechanisms depressed conversion independently of any target goal total.

Committed aim now uses the physical posts, execution spread and an existing seeded draw for similarly open corners. Shooter placement, power, composure, shot family and current execution capacity still matter. No goal probability roll or score correction was added. Keeper anticipation still uses information available before release; actual flight reading and response occur after release. Reaction time and legal movement remain causal, including loaded penalty preparation. Finite hand span, reaction budget, movement and a vertical/lateral reach ellipse define whether the keeper can intervene. A weak hand touch can continue across the goal plane; a strong, well-covered intervention can stop it. A torso intersection remains a physical block. The original shot action and source kind survive deflection.

GOAL, terminal SAVE, BLOCK and MISS are disjoint in benchmark diagnostics. Off-target collections/touches have explicit non-save event names. A parry followed by a goal counts as a goal rather than a keeper save. Keeper shots faced are attributed goals plus terminal saves; wide shots and defender blocks do not inflate the denominator. Player and team result accounting now use that same definition. Old completed archives are read as stored and never rewritten.

Final shot taxonomy reconciles exactly: HBL **6,098 = 3,758 goals + 1,383 saves + 584 blocks + 373 misses**; Allsvenskan **5,657 = 3,605 + 1,130 + 496 + 426**. No real conditional shot-context reference exists to validate every engine pressure, distance, height or capability bin.

Ability effects remain. Across 160 matched isolated unopposed duels, strong versus weak shooting produced 160 versus 80 goals; strong versus weak keepers produced 74 versus 0 terminal saves. Close versus far finishing produced 153 versus 146 goals. These are controlled extreme-capacity mechanism checks, not estimated league rates. The full-match capability experiments separately retain named shooting, keeper, creation, speed, M6 and defensive families; raw CA/PA never substitutes for execution capacities.

## Attacking roles and concentration (items 18–23)

Career integration replaced every player's generated role tendencies with all-ones values. Combined with a geometrically central recycle option, weak last-passer discouragement and disconnected half-back support, this made M9 repeatedly receive and finish. The fix retains supported recorded personal attack roles, or blends the existing positional duty with neutral tendencies when a role is missing. It does not presume all centres are specialist playmakers.

V9/H9 support now offers connected threatening lanes. Continuation values actual receiver freedom, marker recovery debt, receiving windows and available space. Wings retain width and benefit when their legal takeoff geometry actually improves. M6 receives a body-relative seal and real lane opportunity; an own screen cannot masquerade as an opponent seal. The pivot still physically approaches a legal finishing point before release. Other defenders and executed pass/shot physics remain authoritative.

There are no positional attempt budgets, scorer caps, player goal ceilings or enforced possession lengths. Largest scorer and shot shares fall as opportunities spread. All six field roles contribute in the final samples.

| M9 pooled share | HBL before | HBL reference | HBL after | Allsvenskan before | Allsvenskan after |
|---|---:|---:|---:|---:|---:|
| Goals | 48.43% | 18.97% | 15.43% | 50.74% | 19.31% |
| Attempts | 46.26% | 20.16% | 14.41% | 48.30% | 16.83% |

Reference positions are registered season positions; engine positions are roles at release. HBL wings contribute 21.58% of goals, half-backs 43.35% and M6 19.64%; Allsvenskan wings 23.44%, half-backs 38.61%, M6 18.64%. These are observations, never quotas.

## Contact, penalties and sanctions (items 24–28)

Defenders recovering behind settled passers/shooters repeatedly generated phantom penetration contact. “Forward intent” at 9–12 metres was treated as a clear scoring chance too broadly. Behind-active-penetration holds were insufficiently distinguished from ordinary bent-arm frontal containment. Restart and personal punishment were too closely coupled.

Active penetration now requires an executing drive/dribble. A controlled reachable near-area finish, an unopposed moving counterattack or an actual direct empty-goal shot can be a clear chance; a stationary distant carrier's forward intent alone cannot. Cover must physically reach the release window in time. A dribbling player may legally gather and reach that immediate finishing window. Deliberate body-directed holds are assessed independently of whether they destroy a clear chance. Dangerous airborne contact remains serious; ordinary permitted frontal containment stays legal.

This implements the distinction between destroying a clear chance and retaining full control under advantage in IHF Rule 14 and Clarification 6: [official 2025 indoor rules](https://www.ihf.info/sites/default/files/2025-07/09A%20-%20Rules%20of%20the%20Game_Indoor%20Handball_E.pdf). A penalty does not automatically require a suspension. Protected advantage retains controlled play; realization, recall and delayed discipline remain covered by regression. Offensive-foul and handling-rule paths were retained and tested. No penalty or suspension total is read while selecting contacts or rulings.

## Final comparisons (items 32–52)

Means below retain the official scopes and denominators. Percentages are averages of the relevant match/team/keeper observations, not interchangeable pooled rates. Complete SD, quantiles, ranges, pairs and coverage are in `comparison.json` and the final summaries.

| Metric | HBL before 20 | Empirical | Paired after 20 | Final after 60 |
|---|---:|---:|---:|---:|
| Goals/match | 51.10 | 60.86 | 62.90 | 62.63 |
| Outfield attempts/match | 111.75 | 97.89 | 101.45 | 101.63 |
| Outfield conversion | 45.7% | 62.0% | 62.1% | 61.7% |
| Keeper save rate | 49.2% | 28.6% | 26.1% | 26.8% |
| 7m/match | 8.90 | 6.58 | 4.90 | 4.20 |
| 7m conversion | 60.5% | 75.7% | 84.4% | 83.6% |
| Suspensions/match | 8.85 | 4.80 | 4.85 | 4.48 |
| Largest scorer/team | 45.3% | 25.0% | 30.6% | 30.1% |
| Largest attempt share/team | 42.5% | 23.7% | 26.4% | 26.3% |

| Metric | Allsvenskan before 20 | Empirical | Paired after 20 | Final after 60 |
|---|---:|---:|---:|---:|
| Goals/match | 50.65 | 61.62 | 60.55 | 60.08 |
| Outfield attempts/match | 103.20 | NO_REFERENCE | 93.45 | 94.28 |
| Outfield conversion | 48.9% | NO_REFERENCE | 64.8% | 63.7% |
| Keeper save rate | 46.9% | 28.6% HBL proxy | 23.9% | 24.0% |
| 7m/match | 11.10 | 7.12 | 5.00 | 4.82 |
| 7m conversion | 64.3% | 75.0% | 86.7% | 89.4% |
| Suspensions/match | 11.85 | 5.77 | 7.65 | 7.27 |
| Largest scorer/team | 44.0% | 24.5% | 29.7% | 29.5% |
| Largest attempt share/team | 41.9% | NO_REFERENCE | 26.7% | 25.9% |

The paired mean goal change is +11.80 HBL and +9.90 Allsvenskan, with identical initial inputs/seeds/fixtures. Final HBL goals have SD 7.62, p05 48.85, median 64, p95 72.15, range 37–78. Allsvenskan has SD 6.66, p05 51.95, median 58, p95 73.05, range 49–78. The larger samples support improvement across conversion, volume, concentration and rulings; they do not demonstrate calibration to every distribution.

| Keeper observation | HBL before N40 | HBL empirical N480 | HBL after N120 | Allsvenskan before N40 | Allsvenskan after N120 |
|---|---:|---:|---:|---:|---:|
| Mean saves | 24.93 | 8.90 | 11.53 | 21.83 | 9.42 |
| Saves median / p95 / max | 24 / 36 / 39 | 9 / 17 / 21 | 12 / 18 / 25 | 21.5 / 31 / 33 | 9 / 15 / 20 |
| Mean faced | 50.48 | 29.81 | 42.84 | 47.15 | 39.46 |
| Save rate SD | 13.00 pp | 9.91 pp | 9.33 pp | 12.87 pp | 9.67 pp |
| Rate median | 49.53% | 28.57% | 26.49% | 47.73% | 23.08% |
| Rate p95 | 67.41% | 45.01% | 42.34% | 66.87% | 40.07% |
| Rate p99 | Too few observations | 55.12% | 50.52% | Too few observations | 44.55% |
| Rate max | 70.59% | 63.64% | 52.63% | 78.57% | 48.78% |
| Count >50% | 18 | 7 | 2 | 13 | 0 |
| Count >60% | 10 | 2 | 0 | 6 | 0 |
| Count >70% | 1 | 0 | 0 | 2 | 0 |

Counts have different sample denominators; the empirical HBL rate is only a proxy for Allsvenskan. Keeper eligibility is at least 10 faced in all final comparisons. Exposure matters: empirical counts in 10–19/20–29/30–39/40+ buckets are 103/107/171/99; HBL final 0/0/28/92; Allsvenskan final 0/0/65/55. Real rotation creates many low-exposure observations absent from these default engine matches. In 30–39 faced, empirical mean rate is 30.47%, engine HBL 25.34%; at 40+ it is 33.07% versus 27.23%. This suggests residual keeper underperformance after exposure adjustment, despite much more plausible overall tails.

Combined official team goalkeeping N364 averages 12.14 saves, 41.46 attributed faced and 29.23% save rate; HBL final N120 averages 11.53, 42.84 and 26.79%. HBL team faced volume is much closer than the per-keeper exposure comparison. Team variance is never substituted for keeper-match variance. Unattributed/empty-goal concessions are not automatically charged to a keeper.

## Outliers, limits and open questions (items 49, 53–56)

The retained Allsvenskan index-8 Jonas Åberg outlier falls from 33/42 (78.57%) to 8/33 (24.24%) under the same recipe. The new largest HBL save count is 25/54 (46.30%, index 50); highest rate is 20/38 (52.63%, index 13). High save count is not high save rate, and exceeding an observed empirical maximum is not proof of impossibility. Allsvenskan maximum saves is 20 and maximum rate 48.78%.

Supported remaining gaps: too few 7m in both leagues, elevated 7m conversion, scorer concentration still about five percentage points above reference, HBL attempts still 3.74/match high, and Allsvenskan suspensions about 1.50/match high. The comparator labels these where its confidence/coverage rules permit. HBL goals, conversion, overall keeper rate and suspensions are not automatically certified by close means; some comparator results remain UNRESOLVED.

Likely gaps: keepers may now be somewhat weak in like-exposure HBL comparisons; default keeper rotation and tactical possession opportunities differ from official usage. M9's HBL share undershoots the pooled registered-position season share, while release-role classification and 7m takers complicate interpretation. Creation, speed and pivot effects in N2 full-match treatments are noisy and not guaranteed to improve the team score monotonically. Stronger defence likewise changes future possession paths. No fresh tuning was undertaken to force those summaries.

NO_REFERENCE remains for possession counts/lengths, exact whistle/free-throw totals, transition success, engine-specific technical-error taxonomy, detailed shot context and Allsvenskan attempts/conversion. Official source technical errors are not silently renamed canonical turnovers. Questions requiring richer official context, real rotations, historical attributes or human observation remain unresolved; no replacement roadmap was started.

## Regression, reproducibility and runtime (items 29–31, 57–68)

Thirty-six controlled full matches retain two recipes each for balanced/quick/width/combination/direct/5:1 and low/high named capacity families. Tactical paths differ: recipe-0 manager goals are respectively 34/37/37/31/39/39; recipe-1 28/30/36/35/29/25. They are descriptive sensitivities, not a ranking of tactical quality. Strong keeper treatment lowers opponent goals in both matched recipes (40→29 and 42→23). Aggregate targeted shooting improves from 9/14 to 20/25. Creation/M6/speed/defending results and changed player IDs are retained even where directions are noisy.

Fatigue remains activity-dependent, bounded and recoverable; endurance changes work cost without mutating attributes. HBL released-shot energy averages 88.0% in half one and 73.4% in half two; conversion remains 61.58% versus 61.68%. Allsvenskan energy 88.2%→74.9%, conversion 63.78%→63.66%. This rejects a universal late-match keeper collapse in these samples; it does not establish a real empirical half target.

Motion's release commitments, continuous locomotion, pass/reception ownership, beaten-defender recovery, contact evidence, handling constraints and archive frames remain on the canonical path. Regression verifies these mechanisms; visual 1× approval is still pending. Offensive-foul, advantage, restart, discipline, pivot, wing, identity, fatigue and loose-ball cases remain in core coverage.

Full-match observer versus no-observer proofs pass for both competitions, comparing complete sessions, RNG, events, archive frames and results. JSON career persistence after two 10,000-tick chunks resumes to identical terminal sessions/results in both batches. Post-analysis hashes are unchanged. Import-graph and injected-target tests prove no benchmark data/targets or uncontrolled random draw enters gameplay. All experimental/reference machinery is developer-only; normal matches add zero benchmark overhead.

Full production career regression verifies live commands, persisted continuation, exact encoded archives/replay, halftime, fulltime and exactly-once career commit. The season smoke completed 26 manager matches, save/archive persistence, contract renewal, rollover to 2027/28 and a season-two match (27 retained archives). The receipt predates the final output-only team-accounting repair; simulation and season mechanics are unchanged, and the final game regression covers repaired result accounting.

Validation receipts: 67 focused tests, 42 mechanism tests and 10 final causal tests passed; V2 protocol 9/9 and empirical benchmark 15/15 passed. Full game regression **2,306/2,306 passed** after the team-stat repair. The original core run had 227 passes and one obsolete parry expectation; that expectation now accepts a physical goal and correct CENTRE_THROW_OFF. Final full-core regression **228/228 passed**, recorded in `VERIFICATION.json`. Workspace typechecks pass after correcting test enum and explicitly including both new scripts in benchmark typechecking. Isolated Next production build `.next-game-empirical-cal-v1` passed after final accounting repair.

Final 60-match batch wall time is 360.31s HBL and 358.93s Allsvenskan, run concurrently with regressions. First proof-match observer processing costs 357.84ms HBL / 383.15ms Allsvenskan inside 6.93s / 7.28s observed runs; post-analysis 1.12s / 0.95s is developer-only. Concurrent wall timings are not a controlled browser performance measurement.

Browser attempts: CUA surface inventory returned no browsers; both `iab` and `chrome` creation returned “Browser is not available.” No normal-career UI inspection, 1× continuity observation or screenshots could therefore be completed. The production server is ready at **http://127.0.0.1:3011**. HTTP reachability does not replace this missing visual QA.

## Delivery and human QA (items 69–77)

Local commits: `103bdec` causal shot/continuation/contact mechanics; `ffe6453` career roles and on-target keeper accounting; `db3bda2` paired proofs/diagnostics; `25dee01` final team accounting and validation fixes. The closeout evidence commit is listed in the final response and local history. Task-owned final summaries, recipes, pinned references, comparisons and controlled experiments are committed. Detailed causal/match/input files and development artifacts stay local. Pre-existing user changes remain unstaged. The main empirical catalog, real-world player research, Motion worktree and stashes are unchanged. **NOTHING WAS PUSHED.**

From repository root, exact start command:

```powershell
$env:HM_NEXT_DIST_DIR='.next-game-empirical-cal-v1'
npm run start --workspace @handball-manager/game -- --port 3011 --hostname 127.0.0.1
```

Exact offline comparison commands (reuse completed observations; no simulation):

```powershell
npm run empirical:calibration:report --workspace @handball-manager/game
npm run empirical:compare --workspace @handball-manager/game -- --engine ../../docs/match-empirical-calibration/hbl-final --out ../../docs/match-empirical-calibration/hbl-comparison
npm run empirical:compare --workspace @handball-manager/game -- --engine ../../docs/match-empirical-calibration/allsv-final --out ../../docs/match-empirical-calibration/allsv-comparison
```

Final report: `C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager/docs/match-empirical-calibration/REPORT.md`. Distribution/pair report: `COMPARISON.md` / `comparison.json`; ranked supported comparisons are in each `*-comparison/CURRENT-ENGINE-COMPARISON.md`. Their generic statement that the comparison changed no gameplay describes that offline command, not this calibration implementation.

### HOW TO HUMAN-QA THE CALIBRATED MATCH

Open the URL, create a normal Swedish HBL career and progress to its first fixture; no JSON import is required. Start Match 2D at 1×. Watch continuous movement, physical shot/keeper contacts, score progression, M9 circulation, half-back/wing/M6 involvement and naturally varying scorers. Raise speed for the remaining half, inspect halftime and start the second half. Observe 7m and suspension restarts when they occur; one match is not expected to contain every event. Finish, compare team/player shots, goals and keeper saves/faced, then save/reload and open the stored replay. Confirm the archive retains the same result and frames. Repeat in Allsvenskan and with a different tactic/keeper. Report visual continuity and usage concerns separately from statistical agreement. Browser QA remains the explicit unfinished acceptance item.
