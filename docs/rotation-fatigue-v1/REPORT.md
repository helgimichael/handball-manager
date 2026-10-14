# Rotation & Fatigue Consequence v1

Implementation, paired evidence and sequential verification are complete. The manager retains freedom to play a star or the whole court unit for 60 minutes. Fatigue operates through physical capability and difficult execution, with no mandatory substitutions or result quotas.

Known remaining limitation: HBL fixture26 has a prolonged corner-rebound collection tail in the final cohort and a long scoreless tail in the retained v1.1 baseline. It remains in every aggregate; see [BASELINE-TAIL.json](BASELINE-TAIL.json). The N30 controlled pairs and Allsvenskan40 have no scoreless quarters.

HBL:

| Measure | Empirical 2025/26 | v1.1, matched N=40 | Fatigue v1, N=40 |
|---|---:|---:|---:|
| Goals (all actors) | 60.86 | 57.95 | 58.65 |
| Ordinary field attempts (7m excluded) | 91.31 | 87.10 | 87.93 |
| 7m attempts | 6.58 | 6.38 | 6.93 |
| Total field-player attempts (including 7m) | 97.89 | 93.48 | 94.85 |
| Total engine attempts (all actors) | No exact keeper-attempt reference | 93.48 | 94.85 |
| Ordinary field conversion (mean match ratios) | No separately retained mean | 60.84% | 60.61% |
| Ordinary field conversion (pooled) | 61.02% | 60.79% | 60.53% |
| Total field-player conversion (including 7m) | 61.98% | 62.02% | 61.88% |
| 7m conversion (mean match ratios) | 75.65% | 77.77% | 80.07% |
| 7m conversion (pooled) | distinct from mean ratios | 78.43% | 78.34% |
| 2-minute suspensions | 4.80 | 3.05 | 4.05 |

Allsvenskan:

| Measure | Empirical 2025/26 | v1.1, matched N=40 | Fatigue v1, N=40 |
|---|---:|---:|---:|
| Goals (all actors) | 61.62 | 58.25 | 59.15 |
| Ordinary field attempts (7m excluded) | n/a | 88.90 | 88.08 |
| 7m attempts | 7.12 | 6.95 | 8.33 |
| Total field-player attempts (including 7m) | n/a | 95.85 | 96.40 |
| Total engine attempts (all actors) | No exact keeper-attempt reference | 95.85 | 96.40 |
| Ordinary field conversion (mean match ratios) | No separately retained mean | 59.27% | 59.95% |
| Ordinary field conversion (pooled) | No exact reference | 59.28% | 59.92% |
| Total field-player conversion (including 7m) | No exact reference | 60.79% | 61.39% |
| 7m conversion (mean match ratios) | 74.99% | 78.44% | 76.15% |
| 7m conversion (pooled) | distinct from mean ratios | 79.86% | 76.58% |
| 2-minute suspensions | 5.77 | 5.90 | 5.43 |

[Rotation comparison](ROTATION-COMPARISON.md), [full paired distributions](ROTATION-COMPARISON.json), [league regression](DISTRIBUTIONS.json), [source denominator audit](DENOMINATORS.json), [architecture](ARCHITECTURE.md), [verification](VERIFICATION.json), [canonical truth](CANONICAL-TRUTH.json).

## 1. Starting checkpoint

b0a3627a66632518291bc9dcc02b5673d28e6ffc, completed Empirical Reconciliation v1.1. The earlier foundations remain in history.

## 2. Recovery and continuation

The usage-limit recovery found the same HEAD, no commits after b0a3627 and no staged work. Final r5 implementation was uncommitted; its 205 focused passes were reused initially; final traffic repair focused checks pass 206. The rotation-development-r5 launch had not executed because automatic approval review reached the usage limit. No heavy job remained active. Prior-source cohorts/proofs and development reports were preserved, but could not certify the finalized compressed-half runtime. Only missing final-source cohorts, proofs, full checks, build, docs and local commits were completed. HBL tail inspection then exposed a stationary allied carrier deadlock. A narrow physical dribble route around touching teammates repaired it; no fatigue coefficients or Intelligence priorities changed. Prior r5 outputs remain in development/r5-before-teammate-escape. Source-affected cohorts/proofs were regenerated. See RECOVERY.json.

## 3. Git and preserved state

The three original modified QA/season-audit files and three untracked paths were excluded from task staging. All 65 user/presentation/reference hashes match. Motion and both stashes are retained.

## 4. Fatigue architecture before changes

Energy already affected speed, acceleration, spatial arrival, placement/pass/catch execution, shot context and a few tactical/read values. It was functional, not merely displayed. It had no recent-exertion memory and used one modest movement scale for speed and acceleration; all non-active recovery shared one rate. See ARCHITECTURE.md.

## 5. Why low displayed energy was insufficient

At 30% energy the former player still had 83.2% speed and acceleration, and at least 80% generic execution. Simulated halftime could restore up to 30 percentage points, while the career path compressed the break to zero ticks and skipped that recovery. Human QA Torslanda 22–33 Tumba (22–8 halftime, 11–14 second half, no substitutions) revealed a managerial trade-off too weak to infer from the energy column alone. That match was not replayed from an imported save and does not isolate fatigue from score/tactics/chance.

## 6. New consequence model

A smooth remaining-energy-squared load and one optional acute-exertion memory now separate first step/turning/recovery from cruising. A bounded extra execution loss follows actual difficulty. No overall-rating multiplier, result modifier or forced miss is added.

## 7. Long-term energy

Existing endurance and squared-speed workload remain, with a small executing/committed demanding-action cost. Court players remain bounded .15–1; goalkeeper energy retains its prior .3–1 update branch. No minute or score enters these calculations.

## 8. Short-term exertion

Optional canonical acuteExertion, 0–1, follows actual normalized speed and demanding drive/dribble/jump/shot/screen/contact/block activity. Endurance controls accumulation/decay. Quiet intervals and rest clear recent load faster than they restore match energy. Old active saves initialize an absent value from subsequent real work.

## 9. Movement effects

Cruising retains .76+.24*energy. Acceleration applies the continuous fatigue load, with greater repeat-work consequence. Both integration and secondsTo share the same acceleration capacity. Fresh energy retains baseline acceleration. Initial cohort tail inspection exposed a boxed loose-ball claimant; a narrow tangent route around actual bodies repairs that compatibility failure while retaining collision, acceleration and legal-court checks. No teleport or invented acquisition. Final HBL tail inspection also found two touching teammates passing at midfield for a full quarter. Only a dribbler blocked by a touching teammate now uses a physical tangent route; committed drives and opponent contests remain intact. Exact replay changed 56 shots to 98 and stayed active through minute 59. The exact fixture then resumed shooting through minute 59:51. See STALL-REPAIR.json; pre-repair cohorts are retained as development evidence and final cohorts regenerated.

## 10. Repeat-action effects

A tired player with recent exertion has less acceleration than the same tired player after rest. A single isolated clear action remains possible. No action quota, action-count penalty or universal late-match starter penalty exists.

## 11. Defensive recovery

Fatigue delays physical closure and getting goal-side. Late recovery acceleration 5.55 → 5.74; paired change 0.20 m/s²; observed recovery speed 2.29 → 2.33; paired change 0.04 m/s. These are exposure observations; geometry and duty mix differ between arms. Controlled identical-target tests isolate the slower physical recovery.

## 12. Help effects

Helping bodies retain their responsibility and read the same space. The same fatigue-sensitive acceleration/arrival mechanics can make help arrive later and reopen receivers. No binary help-disable flag or direct fatigue-based beaten marker is introduced.

## 13. Transition effects

First-step/turn/repeat recovery effects apply to first/second wave and retreat movement through the ordinary integrator. Late transition shots 1.10 → 1.47; paired change 0.37. This is a shot-phase observation, not a guaranteed transition goal or sprint success rate.

## 14. Offensive effects

Reduced acceleration makes separation and repeated attacks harder. Current capability and geometry still determine whether a tired star or fresh reserve is better. Existing opportunity/shot selection architecture remains authoritative.

## 15. Shooting effects

Ordinary-shot placement reads existing pressure, range and current body speed for the extra bounded fatigue difficulty cost. A stationary clear close chance receives no additional loss. Penalty shooter/keeper resolution retains v1.1 branches. Raw conversion is measured rather than adjusted to a target.

## 16. Passing and technical errors

Existing pass range/lane/pressure/receiver movement/urgency and catch alignment/pace/pressure determine difficulty. Trivial execution receives no extra loss. No new random draw is added. Late named reception failures 1.07 → 1.40; paired change 0.33; these are not all turnovers. Canonical no-shot loss causes remain separately retained in pair files.

## 17. Decision Intelligence preservation

No new Intelligence priority, perception weakness detector or direct defender-energy targeting was added. Free carrier, attack-next-defender, bind/pass, 2v1/3v2, help recognition and intent persistence retain their existing logic. Fatigue changes the real affordances through physical arrival.

## 18. Player attributes

Uses existing ENDURANCE, acceleration/top speed and current passing/handling/placement/finishing/composure profiles. Permanent attributes and role tendencies are not rewritten. No new stamina/work-rate attribute or overall quality score is invented.

## 19. Positional workloads

Actual sprint/drive/contact/screen/shot histories create different workload. No arbitrary M6/wing/backcourt or tactic fatigue multiplier is introduced.

## 20. Goalkeepers

Keeper movement/reaction/anticipation/penalty resolution and energy update/recovery branches remain intact. Keeper exertion receives no new consequence. A keeper may still play 60 minutes without a new rotation requirement.

## 21. Bench recovery

Two/five/ten-minute controlled rests partially restore energy and clear acute load. No entry bonus, inherited outgoing fatigue or instant regeneration to 100%. Values clamp at valid bounds.

## 22. Halftime recovery

Ten minutes clear recent exertion and restore only partial match energy. The 45% controlled player returns below 58%, not 90%. Real career matches compress halftime to zero simulation ticks; partial court-player rest is therefore applied exactly once on the second-half phase transition. Simulated breaks recover through their existing ticks. JSON preserves this phase guard; repeated resume cannot reapply recovery. Keeper behavior, official playing time and restart architecture remain intact.

## 23. Timeout recovery

The existing one-minute timeout allows acute decay and only .48 percentage points of court energy recovery at the configured rate. No energy potion or extra timeout is added.

## 24. Substitution entry

Incoming actors retain their own energy/exertion, identity, profile and accumulated minutes. Their stale perception/re-entry memories clear during real exchange staging. Existing legal exit/admission/court movement and role assignment remain authoritative.

## 25. Re-entry

The resting actor returns with that actor’s own accumulated condition. No state is copied from the replaced person. Bench energy/exertion and active JSON continue through normal rolling substitutions.

## 26. No-rotation controlled result

30 complete paired matches, zero manager substitution commands. Late mean energy 68.57%, acceleration capacity 87.84%. Ordinary sanctions may cause required vacancy replacements; actual minutes and exchanges are retained.

## 27. Rotation controlled result

Same starting careers/fixtures/seeds/tactics. Three scheduled court rests and returns use ordinary substitution commands, with eligibility exceptions logged. Late mean energy 77.72%, acceleration capacity 91.49%. Mean actual issued commands 5.23.

## 28. Paired comparison

Margin change -0.20: 13 improved, 13 worsened, 4 tied. Functional freshness improves; no reliable guaranteed scoring benefit is claimed. Paired distributions and approximate mean confidence intervals remain in ROTATION-COMPARISON.json.

## 29. Late 45–60 comparison

Late energy 0.69 → 0.78; paired change 0.09; acceleration 0.88 → 0.91; paired change 0.04; ordinary attempts 11.37 → 11.37; paired change 0.00; goals 7.47 → 7.70; paired change 0.23; pressure 0.65 → 0.64; paired change -0.01. See ROTATION-COMPARISON.md for every supported metric and scope.

## 30. First half versus second half

All first-half paired diagnostic differences are exactly zero; commands begin at minute 34. Full first/second-half and late diagnostics, plus each player’s four 15-minute segments, are retained. Quarter observer totals handle the horn boundary; raw exclusive-clock helper half totals are not used.

## 31. Severe-fatigue examples

The fresh-career paired cohort contains no <30% sampled court energy. This limitation is explicit rather than manufactured. The ten lowest-energy real players and quarter performance are retained in ROTATION-COMPARISON.json. Severe .15–.25 cases are tested deterministically; no special match state is injected into normal cohorts.

## 32. Fresh reserve versus tired starter

Controlled physical capacity shows a good fresh reserve can out-accelerate a higher-quality severely tired starter; context and intrinsic execution skill remain distinct. This emerges from capability/condition, not a fixed substitution recommendation.

## 33. Star exception

A tired elite executor still beats a weak fresh reserve on simple high-quality execution in the controlled case. Clear-lane Intelligence remains willing to use the tired carrier. No fixed mandatory threshold.

## 34. Free-carrier acceptance

Protected Intelligence seeded free-carrier scenarios pass: 40 continue, no sideways recycle, all reach a finish. Tired clear-lane cases also retain an own-threat choice.

## 35. Bind/pass acceptance

Existing committed-help bind/pass and attack-next-defender cases pass in focused/full core checks. No physical advantage is erased to force a fresh player option.

## 36. 2v1 and 3v2 acceptance

Preserved overload/created-receiver, help/handoff and continuation tests pass. Existing perceived actual arrival capacity is consistent with physical integration.

## 37. Tactics regression

BALANCED, QUICK, WIDTH, COMBINATION, DIRECT and 6:0/5:1 retain their existing priorities/profile inputs. Protected tactics and game mid-match tactical tests pass. No tactic energy multiplier is added.

## 38. HBL regression cohort

| Measure | Empirical 2025/26 | v1.1, matched N=40 | Fatigue v1, N=40 |
|---|---:|---:|---:|
| Goals (all actors) | 60.86 | 57.95 | 58.65 |
| Ordinary field attempts (7m excluded) | 91.31 | 87.10 | 87.93 |
| 7m attempts | 6.58 | 6.38 | 6.93 |
| Total field-player attempts (including 7m) | 97.89 | 93.48 | 94.85 |
| Total engine attempts (all actors) | No exact keeper-attempt reference | 93.48 | 94.85 |
| Ordinary field conversion (mean match ratios) | No separately retained mean | 60.84% | 60.61% |
| Ordinary field conversion (pooled) | 61.02% | 60.79% | 60.53% |
| Total field-player conversion (including 7m) | 61.98% | 62.02% | 61.88% |
| 7m conversion (mean match ratios) | 75.65% | 77.77% | 80.07% |
| 7m conversion (pooled) | distinct from mean ratios | 78.43% | 78.34% |
| 2-minute suspensions | 4.80 | 3.05 | 4.05 |

## 39. Allsvenskan regression cohort

| Measure | Empirical 2025/26 | v1.1, matched N=40 | Fatigue v1, N=40 |
|---|---:|---:|---:|
| Goals (all actors) | 61.62 | 58.25 | 59.15 |
| Ordinary field attempts (7m excluded) | n/a | 88.90 | 88.08 |
| 7m attempts | 7.12 | 6.95 | 8.33 |
| Total field-player attempts (including 7m) | n/a | 95.85 | 96.40 |
| Total engine attempts (all actors) | No exact keeper-attempt reference | 95.85 | 96.40 |
| Ordinary field conversion (mean match ratios) | No separately retained mean | 59.27% | 59.95% |
| Ordinary field conversion (pooled) | No exact reference | 59.28% | 59.92% |
| Total field-player conversion (including 7m) | No exact reference | 60.79% | 61.39% |
| 7m conversion (mean match ratios) | 74.99% | 78.44% | 76.15% |
| 7m conversion (pooled) | distinct from mean ratios | 79.86% | 76.58% |
| 2-minute suspensions | 5.77 | 5.90 | 5.43 |

## 40. Field denominator correction

Retained primary-source rows assert ordinary + 7m = total field-player attempts in all 182 HBL matches. Means: 91.31 ordinary + 6.58 penalties = 97.89 total field-player attempts. Thus the prior 97.89 includes 7m in the stored extraction; it cannot be relabeled as ordinary-only. Historical keeper attempts are unavailable. See DENOMINATORS.json and the source hash.

## 41. 7m denominator reporting

Each league reports penalty attempts, goals, non-empty match-ratio mean and pooled goals/attempts. Ordinary field attempts/conversion exclude penalties and keepers. Total field-player attempts include 7m; all-actor totals are separately available from actual.totals.shots. No bookkeeping change enters simulation.

## 42. Goals regression

Matched N40 v1.1→fatigue: HBL 57.95→58.65; Allsvenskan 58.25→59.15. Published v1.1 N80 means are 56.96 and 58.05; those are contextual rather than paired N40 references.

## 43. Conversion regression

Field-player total conversion HBL 62.02%→61.88%; Allsvenskan 60.79%→61.39%. Ordinary and penalty scopes, opportunity quality and pressure are separately retained. No conversion quota or compensating shot-resolution retune.

## 44. Suspensions regression

HBL 3.05→4.05; Allsvenskan 5.90→5.43. Existing contact, legal containment, lost-shoulder and sanction decisions remain causal. No direct fatigue sanction probability or total-count adjustment.

## 45. Keeper regression

Existing keeper calibration/integration tests pass. With at least 20 on-target shots, mean keeper-match save ratio HBL 25.64%→25.87%, Allsvenskan 25.38%→26.19%. Each stage has 80 keeper-matches from 40 fixtures. Below10% counts HBL 3→1, Allsvenskan 1→0. All-shot and ordinary exposure tails at10/20/30/40 are retained. HBL references include penalties; Allsvenskan keeper comparison remains HBL PROXY ONLY, with no exact league reference.

## 46. Scorer concentration

Mean largest scorer goal share HBL 30.12%→30.84%, Allsvenskan 29.12%→31.09%. Mean largest attempt share HBL 24.66%→26.52%, Allsvenskan 25.51%→26.88%. N80 team-matches per stage/league, generated by N40 fixtures. Full role distributions and tails remain in DISTRIBUTIONS.json. No scoring/minute cap is introduced; stars retain intrinsic quality.

## 47. Fatigue anti-cheat

Condition reads current player/action/work state only. Score, invented noSubstitutions and benchmarkMismatch fields leave the condition update identical. There is no minute>45 nerf, under50 forced miss, no-substitution team penalty, benchmark feedback, post-match result adjustment or fresh-entry bonus. First-half paired equality and observed/plain equality provide independent checks. Existing opponent coaching commands remain an explicit separate policy, not a fatigue result modifier.

## 48. Determinism proof

Both league full-session observed/plain continuations have identical canonical session, RNG, event, result and archive hashes. The new exertion state is included in the session hash.

## 49. Save/load proof

Actual career JSON after 20,000 ticks resumes exactly to the same session/result/archive in both leagues. Focused JSON tests preserve energy/exertion, intent and RNG; optional absence in old saves is accepted. Bench recovery is computed from persisted player state and canonical time/activity.

## 50. Archive proof

New archives retain the existing canonical minutes/energy load, player stats and substitution events. No old archive is rewritten; frame/DTO schema remains. Archive hashes and exactly-once finalize equality pass.

## 51. Match Center truth

Both proofs assert archive model energy/minutes equal archive load and final canonical player condition. Player goals/shots, team score, conversions, penalty/suspension counts, keeper denominators, timeline and key-moment frame positions also pass. Players tab/energy/substitution/halftime/fulltime regressions pass without UI edits.

## 52. Focused tests

206/206 pass, including thirty fatigue scenarios, physical collection-trap and allied-dribbler regressions, and compressed career halftime/JSON/idempotence regression, plus unchanged Intelligence/reconciliation/keeper suites. The final source receipt supersedes the initially reused r5 receipt. Initial test import error retained; corrected to actual assertCore export. The angle-only trap repair failed its new regression, then real tangent routing passed. Earlier receipts remain available.

## 53. Core and V2 tests

Full core 381/381; V2 9/9; engine domain 180/180. All successful receipts are retained. No v1.1 expensive receipts are misrepresented as new-runtime tests.

## 54. Full game regression

2374/2374 canonical game tests passed sequentially with HM_GAME_TEST_CONCURRENCY=1. Empirical framework checks 15/15.

## 55. Typechecks

Repository workspace typechecks exit 0 after the final implementation, diagnostics and proofs. Production build also completes its TypeScript step.

## 56. Production build

Isolated .next-game-rotation-fatigue-v1, build ID usx4M7Bosxj0W5ABGzmpe, HTTP 200 at http://127.0.0.1:3018. Prior v1/v1.1 builds are preserved.

## 57. Performance

The existing condition loop updates one additional value per court player; capacity reads are constant time. The traffic compatibility repairs use bounded current-court body checks during movement, including an added allied-body check for dribblers. No career-wide player search is added. Developer observation samples once per official second and consumes no RNG. Exact cohort timing receipts retain simulation/observer/analysis times; no browser frame-time claim.

## 58. Resource safety

All heavy stages were sequential: focused checks; thirty controlled pairs with guarded resume; HBL40; Allsvenskan40; canonical proofs; core/V2/domain; full game; types; isolated build. Each normal benchmark runner spawns one child at a time. No N80 rerun or concurrent heavy job. Stopped/failure evidence is retained.

## 59. Remaining limitations

Rotation improves measured functional capacity, not guaranteed goals or victory. The paired cohort has no sampled severe states; severe behavior is covered by controlled tests. Actual duty/quality/opportunity mix changes after substitutions, so observed recovery speed and scoring are not pure fatigue estimates. N40 league regression is not a new calibration phase; reference gaps and stochastic tails remain. Retained v1.1 HBL fixture26 has a 17.205-minute final no-shot tail; the final cohort retains a 15.8675-minute tail on that fixture. Replay shows a corner-rebound collection loop at 60–65% energy with near-zero acute load. This remains an explicit collection limitation (BASELINE-TAIL.json), included in every aggregate; league mean differences therefore include compatibility trajectory changes and are not isolated fatigue effects. DISTRIBUTIONS.json retains shot continuity for both stages. No new visible fatigue UI, live 2D, injuries, conditioning or medical system was built.

## 60. Local commits

Source/tests/tooling: 038e78fdf35c2b3aecc039856fd0e87f709e35c0. This evidence/report forms the following local documentation commit, identified by git log -2 and the final response. Only task-owned paths were staged.

## 61. Final git status

Only the original modified match-qa page, qaHarness and season-audit plus untracked .claude/, .tmp-final-benchmark.ts and docs/audit/ remain outside the task commits. Final preservation/status is checked after the documentation commit.

## 62. Motion and stashes

Motion branch remains motion-lab at 197d2a80ecea3b70efdcf8ef347cfc68e0e86b2b, original .claude/ retained. Stashes ddba79055949b76898b12fc1b947e8f8645589cb and b068a9586209b9405b8d5f0dc6fae6384dd09001 remain. No reset, restore, checkout, worktree change or stash replacement.

## 63. Push confirmation

NOTHING WAS PUSHED.

## 64. Exact start command

```powershell
Set-Location 'C:\Users\helgi\Documents\STARKVIS-HELA\handball-manager\apps\game'
$env:HM_NEXT_DIST_DIR = '.next-game-rotation-fatigue-v1'
npm.cmd run start -- --port 3018 --hostname 127.0.0.1
```

## 65. Exact URL

http://127.0.0.1:3018

## 66. Exact report path

C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager/docs/rotation-fatigue-v1/REPORT.md

## 67. Human QA

Play two comparable normal matches: A almost no substitutions; B rotate 2–3 court players during the second half. Judge tired players remaining capable but losing repeated recovery/explosiveness, fresh reserve value in the final 15–20 minutes, stars sometimes still worth keeping, plausible stats and unchanged Match Center. No live 2D, DevTools or imported saves.
