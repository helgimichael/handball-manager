# Canonical career engine audit and evidence boundaries

This is a source-grounded companion to the realism implementation and final delivery report. It does not certify the unfinished final sample or browser checks. The preserved starting checkpoint is Game Experience v1.1 `aedf868`; `39e1dae` anchors the relevant pre-existing V2 ecology work rather than discarding it. Baseline source fingerprints identify the exact original working-copy bytes independently of commit metadata.

## One played-match owner

The player route is `apps/game/lib/career/productionMatch.ts`: actual career fixture, available squads and saved lineup → `createProductionSession` → canonical V2 `createMatch` → repeated `advanceProductionMatch` → `resultFromSession` → `finalizeProductionMatch`.

The adapter reuses `buildSpatialMatchInput` and `resolveCareerLineup` as input/selection helpers. Importing those helpers is not a call to the old spatial runner. The player-facing `ProductionMatchView` directly advances this V2 session and sends commands to `commandProductionMatch`. The FastMatchResult name is a shared result shape; its `engine: 'V2'` identifies the actual played source. Separate CPU/background fixture simulation remains separate.

Real player IDs replace template references, including restart and receiver references. Scenario demonstration coaching plans are cleared before a career begins. Manager rotation/timeouts are manual; the opponent has the existing canonical CPU coach. The seed recipe is `seedFromString(saveSeed + ':' + fixtureId + ':v2')`.

`advanceProductionMatch` clones the prior session body and histories before a bounded batch, then calls only `advanceCoreMutable`. Official halves remain 30 minutes; stopped-clock time and the UI halftime pause are distinct. Live tactics, substitution, timeout and SECOND_HALF commands mutate the same match, without creating a replacement result simulation.

## Decision, motion, execution and rules

The actual tick uses a 50ms chronology. Match/coaching/referee/population transitions happen before live collection, offence/defensive coordination and action selection. Existing bodies then execute their current actions; population and handling constraints are applied, contact/screens and release effects resolve, and the physical ball advances. Referee, passive play, energy/load and period bookkeeping follow.

The coherent handball model is trigger → intention → relational movement → defensive reaction → available continuation → execution → outcome. Its modules have distinct responsibilities:

| Responsibility | Canonical modules and observed contract |
|---|---|
| Attack read | `engage.ts`, `offence.ts`, `structure.ts`: live intervals, help-created availability, pivot/wing outlets, recycle and real handling deadlines. |
| Defensive response | `defence.ts`, `structure.ts`: shared line read, owned lateral spaces, pressure, adjacent help, line-player responsibility and recovery. |
| Movement | `actions.ts`: current targets steer an existing action; acceleration, bodies, goal-area legality and real commitments constrain execution. |
| Opportunity assessment | `space.ts`: distance/angle, directional pressure, blocking, ability, fatigue and actual keeper presence; one normal/constrained opportunity contract. |
| Throw/catch execution | `execution.ts`, `interactions.ts`: capability- and context-dependent spatial error, actual swept encounters and difficult reachable catches. |
| Possession/transition | `transitions.ts`, `engine.ts`: transfer after a real encounter/award; preserve bodies/momentum, clear stale responsibilities and recover the actual ball. |
| Periods/rules | `match.ts`, `rules.ts`, `referee.ts`, `passive.ts`, `sanction.ts`: official time, legal restarts, advantage, sanctions and contextual possession loss. |

An intentional pass can miss, be deflected, intercepted or recovered through ordinary physics. A catch failure is rolled only after a physically reachable difficult catch; it creates a contested ball rather than awarding possession globally. A poor shot choice and poor shot execution are separate problems. Geometry/quality gates prevent an ordinary backcourt finish from being manufactured at halfway solely because handling time is running out.

Retreat uses one useful goal-side delaying defender and distinct recovery lanes for others. Settled handoff reads actual line organisation and available population, including short-handed teams. Actions, queued follow-ups and reception offers from the previous possession are cancelled; bodies, momentum, airborne state and exchanges retain continuity.

## Player capabilities and provenance

`core/profile.ts` accepts the existing game's 1–20 attribute keys. It derives execution capacities once; the tick loop does not substitute a new permanent rating system. The production bridge reads actual `rating.branch.attributes`. It no longer supplies missing gameplay capacities from CA/PA. Missing keys use the existing explicit neutral attribute anchor, and `profile.source` retains missing/supplied/expected fields.

| Capability | Existing source keys |
|---|---|
| Passing and control | PASSING, DECISION_MAKING; BALL_HANDLING, COMPOSURE. Keeper passing uses OUTLET_PASSING. |
| Backcourt/close finishing | SHOOTING_POWER, SHOOTING_PLACEMENT, FINISHING, BREAKTHROUGH. |
| Wings and line cooperation | WING_FINISHING, PIVOT_PLAY, SCREENING, OFF_BALL_MOVEMENT, TIMING, STRENGTH. |
| Reading and decisions | GAME_READING, DECISION_MAKING, ANTICIPATION, COMPOSURE. |
| Motion and physical contests | TOP_SPEED, ACCELERATION, AGILITY, EXPLOSIVENESS, STRENGTH, CONTACT_BALANCE. |
| Defensive execution | DEFENSIVE_POSITIONING, DEFENSIVE_TIMING, LATERAL_DEFENCE, COVERING, SWITCHING_HANDOVER, BALL_WINNING, SHOT_BLOCKING, CONTACT_ABILITY. |
| Workload | ENDURANCE plus actual official court time and speed. |
| Goalkeeper | GK_POSITIONING, SET_POSITION, REACTION, GK_EXPLOSIVENESS, low/high/range/wing save families, SHOOTER_READING, SHOT_ANTICIPATION, OUTLET_PASSING. |

The audit identified a derived but unused specialised seven-metre capacity. This is now resolved in the keeper's actual penalty-flight read: `structure.ts` combines reading, reaction, positioning and `keeper.sevenMetre` (from SEVEN_M_SAVES) to determine the committed read. Holding/parrying additionally uses height, range and wing/reaction families. An attribute being accepted or derived still does not prove every capacity is read in every action; these distinct uses were checked in current source.

Synthetic character/tendency tables exist for engine verification, but production constructs profiles with the normal neutral tendencies. Gameplay differences here come from actual attributes, context and court position; it would be inaccurate to claim that every editor archetype label is mapped to a production tendency.

ENDURANCE changes equal-work energy cost; energy remains bounded and recovery remains the existing physical system. Movement and execution capacity respond to current energy without editing permanent attributes. Goalkeeper sheets may not supply field endurance, in which case that capacity remains the explicit neutral fallback. These coefficients are engineering mappings, not medical predictions or empirical physiology fits.

## Tactics actually supported

Canonical live choices are 6:0/5:1, BALANCED/QUICK tempo and BALANCED/COMBINATION/WIDTH/DIRECT attacking identity. Tempo changes receiving/decision timing and priorities; orientation changes relative appeal rather than forcing a scoring family. Current 5:1 has a high central point above five connected lower spaces, with corresponding pivot ownership and help geometry. This is a coherent supported distinction; it is not a claim of complete tactical depth for every named defence.

The legacy QA page lists other systems through another verification harness. Those labels are not proof of canonical career 3:2:1 support. No Motion or legacy backend switch was added to the player match.

The audited normal TacticalConfigPanel and StartingUnitEditor had also enumerated 3-2-1, 3-3 and 4-2 through `courtScene.ts`, while the production adapter mapped those choices to 6:0. This mismatch is resolved: both normal controls now select only 6-0/5-1, and production preflight rejects an unsupported persisted own-team formation with an actionable choice rather than silently playing 6:0. The legacy geometry helpers remain for their separate purposes. The approved layout is retained.

## Rules are deliberately scoped

The source rule profile identifies IHF_INDOOR_2025 and implements selected indoor constraints: holding/steps, grounded/takeoff area legality, restart positions and release gates, centre throw-off, goalkeeper throw, throw-in, free throw, seven-metre throw, progressive sanctions, team timeout, passive-play warning/pass allowance and protected final throws. Source comments cite rule families, but the implementation is not a complete referee simulator or external standards certification.

Foul severity is read from actual contact/approach, position and destroyed chance. Ordinary infringements do not automatically accumulate into suspensions. Clear-chance contact can award seven metres; personal sanctions use individual/team warning history and severity. A team timeout requires canonical eligibility/own possession, stops official time and is limited by the current one-per-half profile. Passive idle thresholds are explicit engineering decisions; they are not official fixed possession-length limits.

OFFENSIVE_FOUL is recognised by the result/ledger taxonomy, but no current canonical producer was found in the inspected modules. Do not describe a newly implemented offensive-contact referee model. No arbitrary foul/7m/suspension quota was introduced by the diagnostic harness.

The integration review also corrected two concrete lifecycle semantics: a goalkeeper throw which physically crosses the area boundary in the same swept segment as a catch completes its restart on that actual exit before the catch controls the ball; a failed feint read no longer resets passive idle time as though it created a defensive problem. The actual wrong-footed consequence remains an attacking threat. These are state/causality corrections, not added artificial possession seconds.

## Motion as an inspected donor

The preserved Motion worktree at `197d2a8` was read, not changed. Its `motion/defence.ts` separates player responsibility from space responsibility and describes help which can free the line player. Its `motion/transition.ts` starts from actual post-outcome bodies, assigns one useful delayer, preserves recovery lanes and hands off when the line/attack are physically formed.

Those are useful conceptual donor principles. V2 represents them through its own CoreState, action lifecycle, zones and possession/rule contracts. No MotionWorld, Motion composer or second Motion result is imported into the canonical career path. This audit does not claim a verbatim code port or newly rerun Motion proofs.

## RNG, save continuation, archives and 2D

V2 uses the persisted mulberry32 state/draw count through `random(s)`/`nextRandom`. No Math.random call was found in the canonical V2 source search. Diagnostic wall-clock timing is outside simulation truth. The baseline repeated two independent complete matches with identical score, complete events, RNG and production-frame hashes; final-release determinism still requires the matching final tests/sample evidence.

CORE_VERSION remains schema-compatible 2.9.0. Optional production session/archive `behaviorRevision` identifies career-realism-v2.1 and exact source fingerprints identify the release bytes. Compatibility does not mean future decisions made under old installed code and new installed code must be identical. Within one release, save/reload preserves the same persisted state and RNG. Existing historical frames/results are never regenerated by current policy.

Finalization reads the actually completed core, writes that score/result and observed encoded frames, and applies career bookkeeping once. Archives retain people, seed, version/revision, selected canonical events, result and load. New pass/reception/continuation fields are filtered into the same archive rather than adding a competing replay source. Verbose diagnostic action windows remain developer artifacts.

`ArchiveReplay` decodes stored `archiveFrames` and reads `archive.people`; it does not call either simulator or current roster/rating lookup to recreate movement. The live court reads `observedFrame(session)`. Both display the actual score/clock/positions. The existing renderer is planar; new vertical shot execution is engine truth but is not a claim of a redesigned high/low-shot visual treatment.

## Existing reference bands and measurement boundaries

The existing `core/realism.ts` EHF_ELITE profile explicitly calls these broad plausibility bands rather than historical statistics. The October 7 audit likewise labels them development assumptions. They are not precise empirical Allsvenskan targets.

| Existing band, both teams per match | Range |
|---|---:|
| Goals / shots | 42–76 / 88–150 |
| Goals per shot | 42–68% |
| Possessions | 84–140 |
| Lost attacks without a shot / interceptions | 14–46 / 4–34 |
| Fouls / sanctions / 7m attempts / blocks | 20–70 / 0–10 / 0–14 / 2–28 |
| Backcourt / wing / remaining category share | 18–55% / 8–34% / 12–55% |
| Transition shot share | 2–35% |

No exact sourced target was found in these references for duration, save rate or scorer concentration. Geometry, duration and concentration remain observations, not hidden quotas. BACKCOURT is BACKCOURT_JUMP plus STANDING; CLOSE is the remaining categories, including penalties/empty-goal when present, not a pure distance bucket.

The canonical ledger counts attacks containing live touches, not procedural fragments. Non-shot loss differs from the career result's ending-based turnover classification after a prior shot. Both are retained. Save percentage is explicitly saves/(saves+goals); saves/all-attempts is a different retained denominator. Identity positions differ from reassigned tactical roles. Chunk control checks are sampled checks; release-origin checks use exact recorded shooter frames with quantization tolerance. See DIAGNOSTICS.md for the complete definitions.

The 50-match baseline was measured before behavior edits. The five-case first pilot retains a severe loose-ball lifecycle outlier rather than hiding it. Final matched sampling must use the immutable input hash and seed recipes; it cannot cite that pilot as final acceptance.

## Completed matched sample: strengths and remaining limits

The final 50 matched cases all reached full time, source fingerprints remained stable, and independent cases 0/1 repeated identically on initial-session, full-final-core, derived-result and score/event/RNG/frame hashes. `METRICS.md`, `comparison.json` and `after/repeat-proof.json` retain the evidence.

Possessions moved from 180.30 to 111.46 per match, with all final cases inside the existing possession band. Mean recorded attack span increased from 19.99 to 32.44 seconds. Actual P/P2 players took 217 shots, including 212 PIVOT-category shots across 48 of 50 matches. All 4,180 final releases had exact same-tick observed shooter frames; zero release/body separation errors or sampled controller errors were found. This is not an every-tick invariant claim. The longest recorded attack was 187.1 seconds; the original 1,702.8-second stranded possession did not recur.

The statistical picture still has material weaknesses. Total goals averaged 34.08 (range 18–50), with 43/50 below the project's broad 42-goal floor; attempts averaged 83.60, with 35/50 below 88. Backcourt share averaged 63.86%, and wing share 5.34%; 47 and 39 cases respectively missed those broad category bands. Only four transition-phase shots and three goals occurred in the whole sample. Transition movement/retreat/handoff existing in source must not be misrepresented as frequent early transition finishing. Average per-team top-scorer concentration increased from 32.82% to 38.32%.

Judged FOUL events increased from 52.42 to 96.10 per match, outside the existing band in 47/50 cases. These are not 96 stopped whistles: averages include 40.86 pending advantages, 38.46 realised advantages and 2.40 recalled advantages. Exact whistle/free-throw counts were not separately retained. Goalkeeper save share rose to 52.71% on saves/(saves+goals), or 45.50% of all attempts. The batch therefore must not be described as empirically calibrated or statistically balanced across every dimension.

Long-release observations fell from 1,715/7,136 beyond 15m to 2/4,180. The two retained long attempts are STANDING/RESTART direct throws at the official half/full-time signal (one goal, one save), not EMPTY_GOAL. Highest final total was 22–28, seed 1765851951; lowest was 9–9, seed 1619981876. Neither is removed.

Measured canonical wall time averaged 4.317 seconds, median 3.373, range 2.796–19.904. Verification/build processes ran concurrently; repeats of the same cases measured 9.381/15.686 seconds while preserving exact truth hashes. These timings show practical termination and load sensitivity, not an isolated engine speedup claim.

## High-value production acceptance coverage

The original productionMatch.test already covers real IDs, admission of a requested substitution, live tactics without replacing tick/seed, mid-match JSON continuation equality, full-result/archive equality, score/events/player goals/final-frame agreement, table progress and exactly-once career commit, and repository separation of archive payloads from autosave references.

The root's expanded acceptance source adds explicit halftime/SECOND_HALF, canonical timeout eligibility/clock/reload, post-career-mutation archive immutability, team shots/saves/7m/suspensions and player minutes/energy/recent-load/season reconciliation. Test execution and final pass counts belong to the final verification record. The rollover unit itself seeds background fixture results through fast simulation; actual canonical season-two play must be evidenced by the career regression/browser journey instead.

Browser acceptance must separately observe preview/kickoff, supported 1x/4x/16x, tactics/substitution/timeout, halftime/second half/full time, report and archived replay. Code inspection or a full-time flag does not substitute for watching actual 2D situations.

## Final delivery evidence mapping (user requirements 1–57)

| Requested items | Required evidence owner/source |
|---|---|
| 1–3: checkpoint, git/worktrees, preserved prior engine work | Root git/stash/worktree audit; original source fingerprints; anchor commit. |
| 4–5, 8: architecture, largest problems, chosen model | This source audit; baseline origins/distributions; preserved first-pilot stall evidence; actual implementation. |
| 6–7, 33–37, 45: samples, paired metrics/outliers, QA seeds, performance | Metrics owner: immutable baseline, stable final paired sample, comparison and documented denominators. |
| 9–27: lifecycle, attack/positions/defence, execution, transitions, attributes/energy, tactics and rules | Root/engine authors' final diff and focused semantic tests; avoid claims beyond actual supported modules. |
| 28–32: RNG/determinism/trace/archive/2D | Complete truth repeats, persisted continuation tests, canonical trace details, recorded replay reader. |
| 38–44: actual browser situations, commands, persistence/replay and stats | Root browser and expanded production acceptance; real career regression. |
| 46–49: focused/full tests, workspace types, production build | Root completed logs and final verification record; no inferred pass claims. |
| 50: meaningful limitations | Source/data limits above plus undesirable final distribution and observed browser evidence. |
| 51–54: local commits, final status, Motion/stashes and no push | Root final repository inspection and explicit NOTHING WAS PUSHED confirmation. |
| 55–57: exact start/URL and short human QA guide | Root verified production command/port and the actual retained representative, close and unusual fixtures. |

The final user delivery remains one completed realism report. This document supplies evidence boundaries; it is not a substitute for implementing and verifying the batch.
