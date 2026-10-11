# MATCH MOTION QUALITY v2 — Natural Handball Movement

## Recovery from the interrupted session

The recovery began at **d36be32**, with **1769cb1**, **2100f48** and **d36be32** already committed after the canonical **5569b59** checkpoint. The staged index was empty. Locomotion, braking, relational movement, bounded steering, receiving-window preparation and containment fixes were already implemented. No movement feature was restarted, discarded or expanded during recovery.

Recovered uncommitted task work consisted of the motion observer, comparison generator, benchmark observation/archive-size integration, tactic-output options, benchmark/build type configuration, two core fixture expectation repairs, and the motion-quality documentation/evidence directory. The three pre-existing modified user files and original untracked files remain outside task commits.

The final HBL and Allsvenskan release cohorts each contain 20 complete matches. Every recorded source fingerprint matches the recovered current code, so those expensive cohorts and their deterministic/save-load proofs were reused. Interrupted `hbl-final`, `allsv-final`, tactic and season runs are retained locally and are not counted as final proofs. The retained full game suite passed **2,306/2,306** tests; V2 protocol passed **9/9**; empirical framework passed **15/15**. The retained core manifest passed **241/243**: its two obsolete expectation failures were repaired before recovery. Recovery reran all three focused/changed core files: **34/34 passed**, including both formerly failing assertions. Those 34 plus 209 unchanged passing core cases verify the **243-case manifest**. This is a composite core verification, not a claim that the retained failing run passed.

Recovery completes the unfinished tactic, season/rollover, changed-core verification, fresh typechecks, workspace regressions, production rebuild, evidence receipts and local delivery commits. `VERIFICATION.json` records completed results and file hashes. Detailed diagnostic JSON and intermediate experiments stay on disk; Git tracks release summaries, recipes, comparison artifacts and verification receipts. Nothing in the historical Motion worktree or stashes is modified.

The browser inventory returned no apps or browsers; both in-app-browser and Chrome creation explicitly returned `Browser is not available`. **HUMAN QA PENDING**: no normal-career match was visually approved during recovery. Empirical drift described below also remains an acceptance risk; technical completion does not establish visual or empirical acceptance.

**HUMAN QA REQUIRED.** Browser inventory in this session is empty. Canonical motion, tests and a production build can be verified here; the claim “that looks like handball” remains for the user to judge at 1×. No visual approval is invented.

## Checkpoint, preservation and the actual failure (items 1–5)

Starting checkpoint: **5569b59**, the completed empirical calibration. The user's normal Allsvenskan match, Torslanda 27–35 IFK Tumba, established broadly credible match statistics but movement still looked artificial. Continuity v1 removed many technical stops; it did not establish purposeful handball movement.

The existing three modified files (`app/match-qa/page.tsx`, `lib/matchQa/qaHarness.ts`, `scripts/season-audit.ts` under `apps/game`) and original `.claude/`, `.tmp-final-benchmark.ts`, and `docs/audit/` remain outside these commits. The original byte inventory, Motion worktree and both M6 stashes are checked in `VERIFICATION.json`. The empirical profiles, datasets, calibration reports and retained 60-match baseline cohorts are reused unchanged. No research or statistical calibration phase was restarted. Nothing was pushed.

Because no browser is available, the first reproduction uses missing canonical trajectory observations from two ordinary career recipes; it is not described as a visually watched match. Both contain all ten requested categories: settled attack, circulation, breakthrough, M6, wing, help/recovery, transition, retreat, passer after release and support. The before/after CSV includes positions, velocities, action/duty and tactical targets. SVG paths draw recorded poses and split dead-ball gaps. Matched recipes do not imply identical subsequent event windows.

Observed code/path causes differ: collision fallbacks can produce abrupt velocity headings; tactical destinations refresh on every tick; a soft arrival clips remaining travel even when physical braking needs more distance; an unclaimed RECEIVE action can keep a now-obsolete post for about two seconds; a moving passer brakes during throwing preparation; a stationary named receiver has no preparation route; retreat goes directly to its final post. These are target, path, braking, reaction and intention-handoff issues. The production renderer already interpolates recorded positions and is not the source of every unnatural path.

## Canonical locomotion and perception (items 6–13)

`movement.ts` formalizes HOLD, ADJUST, SUPPORT, THREATEN, RECEIVE, DRIVE, SHIFT, STEP_OUT, HELP, RECOVER, RETREAT and SPRINT_TRANSITION from existing actions, responsibility and phase. This is a small derived policy, not another giant state machine. Position, velocity, capacities and action commitments remain in canonical player state. One optional persisted movement read holds a relational target and its next review tick; old active saves initialize it from the current action.

Existing acceleration/top speed, explosiveness/agility mappings, reaction, anticipation and fatigue provide the capacities. Short positional adjustments use a lower preferred pace; penetration, transition, help and genuine threats retain their capacity. A changing preferred ceiling does not clip existing velocity: braking spends the same bounded physical budget. Ordinary soft support arrival can use its remaining braking distance rather than being pinned to a coordinate. Hard keeper reach, held-ball step budgets, exchange placement, and primary goal-side pressure/pivot containment retain their existing authority.

Traffic steering only occurs when a real body occupies the projected corridor. Bounded changes in velocity produce the actual route; there is no visual Bezier curve, sine wave, idle wander or invented between-frame momentum. Physical body/court/restart legality is checked before every step. Genuine blocks and contacts can still stop or redirect a player. Diagnostic acceleration/turn events are therefore not automatically defects.

Relational destinations are reread using actual reaction/anticipation and proximity/responsibility. Direct pressure stays immediate; remote positioning spends bounded reading time. No random delays or player-ID offsets desynchronize teams. Action identity and phase are retained during compatible corrections.

Facing was investigated: canonical players and the compact archive currently contain no orientation, and the court renders numbered circles. Adding a new orientation codec/display would widen archive/render scope. This version stays focused on faithful trajectories; body orientation is a remaining visual limitation.

## Attacking movement (items 14–20)

The established V6–V9–M9–H9–H6 structure, width/depth and M6 line relationships remain the calibrated tactical source. This work improves how those relationships are occupied. Backcourt corrections follow existing second-attacker, stretch, clear-lane, combine and recycle duties. A waiting offer that becomes obsolete can become a support run without restarting the action lifecycle or discarding usable momentum.

A moving carrier can retain legal movement while preparing a pass. Its actual remaining held-ball distance limits the release approach; no fourth step is granted. Once the ball leaves, the passer follows its current support relationship while the hands recover. No second action, crossing or new goal opportunity is forced after every pass.

A named stationary receiver can adjust before the ball arrives when an actual passing-lane/defender-separation improvement exists. The adjustment is a small legal route perpendicular to the current passing relation, selected from real geometry. There is no compulsory goalward step. A receiver already moving retains the committed run that the throw leads; physical contact still establishes ownership. A clear player may legitimately hold an available post.

M9 retains the personal role tendencies that removed its scoring monopoly. Side backs remain active threatening connections, not fixed symmetrical slots. Wings preserve width and make economical corrections rather than continuous wandering. M6 follows existing ball/defender interval, seal, screen and roll logic. Named pivot feeds still check/present; a screen can deliberately plant. Traffic steering does not replace a committed drive or screen.

## Defensive, contact and transition movement (items 21–30)

The existing zonal coordinator still owns six spaces, one primary pressure responsibility, helper/cover allocation, handover and pivot ownership. 6:0 shifts with the ball; 5:1 retains its distinct forward pressure and back-five structure. Movement is not reassigned to whichever defender has the shortest route.

Primary pressure and pivot containment preserve the calibrated goal-side approach. A helper has a relational compression/recovery destination; remote line members adjust with their own bounded reading time. Physical stepping and recovery preserve usable momentum. A stepped defender may have an inward x projection ahead of the line while remaining separated in depth; that is different from the actual line crossing itself. Regression keeps lateral order checks on actual line neighbours, checked-pair coverage and the hole bound.

Breakthroughs retain committed physical penetration, beaten-defender debt, helper responsibility and the existing pass/finish/rebuild decision. Contact, advantage, 7m and sanction semantics are unchanged in the delivered engine. Broader contact-handoff experiments were rejected when they materially changed the calibrated environment. There is no count-based correction restoring desired foul totals.

Transition still uses actual ahead outlets, wide first wave and trailing second wave. Retreat now regains inside/goal-side space before widening into the final zonal post. Individual reads and physical braking carry the transition-to-settled handoff; no team-wide velocity reset or decorative phase animation was added.

Keeper anticipation, released-shot reaction/reach, stopping capability and goal taxonomy remain calibrated. Ordinary keeper positioning follows the actual ball/angle; it receives no fabricated jitter or teleport. Whistles, throw-off, free throws, penalties, timeout, halftime, planted screens and suspension/exchange protocols remain legitimate stopped or controlled movement.

## Diagnostics, attributes, fatigue and playback (items 31–42)

`MotionQualityDiagnostics` is developer-only. It measures actual nearest-neighbour spacing, attack width, backcourt depth, defensive neighbour gaps, M6-to-defender distance, overlaps/near collisions, heading changes, >120° reversals, vector acceleration events, path efficiency, target churn and simultaneous reactions by at least four teammates. Curvature and acceleration distributions for the representative windows are derived offline. Counts are accompanied by live exposure; they are not gameplay targets or sourced real-handball motion standards.

Before/after evidence is in `COMPARISON.md`, `comparison.json`, `TRAJECTORIES.svg` and `trajectory-windows.csv`. Increased curvature is not automatically better, and every acceleration event is not automatically unrealistic. Contact, takeoff/landing, hard bodily/court constraints and committed keeper reaches require contextual interpretation. Synchronization also legitimately occurs at restarts; diagnostics exclude dead-ball/halftime/fulltime observations.

Player capacities affect actual travel rather than personality sliders or raw CA/PA. Focused checks compare stronger/fresher and weaker/tired locomotion, bounded turning, soft arrival and persisted reaction reads. Fatigue remains activity-dependent, bounded and recoverable; acceleration and sustainable top speed use current movement capacity. Late-match trajectory windows and halves remain in canonical observations.

Production playback and its binary archive codec are unchanged. Frame cadence/interpolation from Continuity v1 remains authoritative. At 1×, 4× and 16× the player is displayed between recorded samples, without renderer-designed arcs, acceleration, extrapolated outcomes or invented orientation. Automated playback/archive checks are distinct from unavailable visual smoothness and browser timing checks.

## Empirical and technical regression (items 43–58)

The final cohorts use the retained first 20 exact save seeds, fixture IDs and input hashes in each competition. HBL is the exact competition reference; Allsvenskan keeper findings remain the explicit male HBL proxy. Engine roster season is retained 2026/27 while reference identity is 2025/26. Registered-position season shares are descriptive N=1 evidence, not release-role match distributions. Detailed supported/unsupported reference policy remains the empirical-calibration policy.

The final before/after goals, attempts, conversion, keeper rate, penalties, suspensions, concentration and M9 shares are in `COMPARISON.md`; final report receipts record whether each material change is preserved, improved or a remaining tradeoff. No empirical target enters simulation. Intermediate candidates and interrupted validation outputs are retained locally as development evidence and excluded from final claims.

| Metric | HBL paired before → after | Allsvenskan paired before → after |
|---|---:|---:|
| Goals/match | 62.90 → 65.75 | 60.55 → 60.10 |
| Attempts/match | 101.45 → 100.45 | 93.45 → 93.75 |
| Field conversion | 62.1% → 65.4% | 64.8% → 64.1% |
| Keeper-match save rate | 26.1% → 23.9% | 23.9% → 23.7% (HBL proxy reference) |
| 7m/match | 4.90 → 3.55 | 5.00 → 4.05 |
| Suspensions/match | 4.85 → 3.50 | 7.65 → 3.95 |
| Largest scorer share/team | 30.6% → 30.1% | 29.7% → 28.8% |
| Largest attempt share/team | 26.4% → 26.9% | 26.7% → 25.2% |
| M9 goal share | 15.82% → 14.37% | 19.16% → 17.47% |
| M9 attempt share | 14.34% → 12.74% | 16.37% → 15.04% |

Scoring/keeper/M9 gains are broadly retained, especially in Allsvenskan. **This is not exact statistical preservation.** HBL chance conversion increased and keeper rate fell. Penalties and suspensions fell materially, shifting previously excessive suspension activity into underrepresentation relative to the official HBL 4.80 and Allsvenskan 5.77 means. The delivered movement changes preserve all rule thresholds/techniques and committed contact/reach authority; the change comes from different paths, receiving windows and contact opportunities. These rule-frequency and HBL chance-quality differences remain acceptance risks, not hidden “passes.” A new coefficient/statistical calibration phase was not started to force them back.

Across the two matched motion recipes, >120° live reversals fall **38→6**, synchronized retarget ticks **4,768→3,069**, and synchronous stop ticks **12→0**. Vector acceleration flags fall **113,452→104,001**. Other diagnostics do not uniformly improve: target churn rises **88,221→91,140**, near-collision samples **8,265→10,314**, and synchronized acceleration ticks **22,665→25,225**; overlap samples remain **0→0**. These are engineering counts with comparable live exposure, not real-world motion benchmarks or proof of visual quality. Close traffic, purposeful threat starts and protected engagement turns need human/contextual judgment.

Balanced/quick/width/combination/direct and 6:0/5:1 checks use the same retained two recipes per condition. Their event paths can change; small treatment samples establish sensitivity, not a population ranking or visual approval. Existing strong/weak keeper/shooter, offensive-foul, advantage, handling, sanction, pivot, wing, shape and tactic regressions remain part of the core/game checks.

Full-match observer/no-observer proofs compare complete canonical sessions, results, RNG, trajectories and recorded frames. Mid-match JSON save/reload resumes the same trajectory and final truth. Post-analysis hashes do not change. The import-graph/injected-target proof protects benchmark independence. Completed older archives remain stored/immutable; new archives encode actual canonical poses. Career regression covers commands, halftime/fulltime, persisted continuation, replay and exactly-once commit; season/rollover evidence is recorded separately.

Focused motion checks and the exact existing core test manifest are run. The two fixture expectation repairs test actual physical substitution order and actual line neighbours rather than requiring a conditional sixth substitution or flattening a step-out into one lateral line. Full game, V2 protocol, empirical framework, workspace and explicit script typechecks are recorded in `VERIFICATION.json`. Checks are not reported as passing until their receipts finish.

The isolated build is `.next-game-motion-quality-v2`, separate from retained `.next-game-empirical-cal-v1`/3011 and Motion 3010. Simulation wall time, observed overhead and archived pose bytes are retained with the samples. The observer/report cost is developer-only; ordinary matches import no benchmark module. Concurrent validation wall timings do not establish browser FPS or exact 1×/4×/16× rendering performance.

## Visual limits and delivery (items 59–67)

No browser tooling is available, so several minutes of normal-career 1× observation could not be performed here. Remaining visual limits include numbered-dot presentation without body orientation, simplified local steering, constrained collision/contact turns, and the need to judge connected attacking/defensive timing in the actual product. Diagnostics cannot substitute for the user's visual verdict.

Local implementation commits begin with `1769cb1`, `2100f48` and `d36be32`; delivery/verification commits are recorded in local history and the final response. The original user changes remain unstaged. Motion remains at `197d2a8`, retaining both M6 stashes. **NOTHING WAS PUSHED.**

Exact start command from repository root:

```powershell
$env:HM_NEXT_DIST_DIR='.next-game-motion-quality-v2'
npm run start --workspace @handball-manager/game -- --port 3012 --hostname 127.0.0.1
```

URL: **http://127.0.0.1:3012**. Open the game, create a normal career and play a match at **1×**. No DevTools or JSON import is required. Judge only:

1. Does movement look more like real handball?
2. Do attackers move together rather than as isolated dots?
3. Does defence shift/help/recover naturally?
4. Does transition look like players running lanes rather than chasing coordinates?
5. Is the old artificial/childish feeling substantially reduced?

Human QA remains pending until the user watches this build. This does not approve retained unfinished Motion-lab work.

## Recovery closeout evidence

| Requested proof | Evidence and scope |
|---|---|
| Focused motion / core | Recovery passed 34/34 across motion-quality, continuous and defence files. Combined with 209 unchanged retained cases, all 243 core-manifest cases are verified. The original 241/243 receipt remains available with its failures visible. |
| Full game | Retained 2,306/2,306 passing cases, including production career match commands, JSON continuation, archive codec, exactly-once commit, replay and next-season fixtures. |
| V2 protocol / empirical framework | Retained 9/9 and 15/15 passing cases. |
| Workspace regression | Fresh package tests: engine 180, game-simulation 46, match-contract 12, match-integration 29, tactical-domain 25; 292 total, zero failures. Renderer has no test script; its typecheck passed. |
| Typechecks | Fresh root workspace typecheck and explicit `apps/game/tsconfig.benchmarks.json` check passed. |
| Tactics | Fresh 12 complete matches: balanced, quick, width, combination, direct and 5:1; two matched recipes each. All 12 result hashes differ. Descriptive sensitivity, not a statistical ranking. |
| Determinism / save-load | Both final release cohorts retain full-match observer/no-observer exact session/result equality and mid-match JSON continuation equality. Source fingerprints still match every recorded input code file. |
| Archive / replay | Retained passing game cases verify exact canonical poses, immutable interpolation and archive round trip. Full-match cohort proofs include archived frames. |
| Career / season | Complete 26-match manager season, 27 saved archives including season two, JSON persistence, rollover to 2027/28 and a real season-two match on 2027-09-23. |
| Production build | Fresh `.next-game-motion-quality-v2` build passed after the recovered engine fixes; 48 static pages generated. Local normal-career `/new-game` returned HTTP 200. |
| Performance | Representative full matches without diagnostics took 15.26s HBL and 15.97s Allsvenskan during retained concurrent validation. Observed runs took 29.58s and 30.76s, including developer instrumentation. Archived representative pose payloads are 5.57–5.68 MB for 63,528–64,617 frames. These measurements do not certify browser FPS. |
| Browser QA | Empty available-surface inventory. **HUMAN QA PENDING**; normal-career build ready at `http://127.0.0.1:3012`. |
| Preservation | User-file byte hashes match the empirical-calibration preservation inventory. Motion HEAD/status and both stash object IDs also match it. |

`VERIFICATION.json` links hashed logs, preservation checks, cohort proofs and a manifest of retained local diagnostic JSON. Large per-match/causal/motion inputs and intermediate runs remain locally available under this directory, with task-specific ignore rules; no historical artifacts were deleted. Release summaries, recipes, references, comparison JSON/CSV/SVG and final verification logs are committed.

Existing implementation commits: **1769cb1**, **2100f48**, **d36be32**. Recovered tooling/test commit: **6934036**. The final documentation/receipt commit is identified in the final response and local history. Task-owned code is committed without the pre-existing user files. Expected final working-tree changes are precisely the original three modified files and original `.claude/`, `.tmp-final-benchmark.ts`, `docs/audit/` untracked paths. **NOTHING WAS PUSHED.**

Technical verification does not remove the measured empirical risks: HBL conversion/save rate and both competitions' penalty/suspension frequency differ from calibration. No statistical coefficients, target quotas or empirical corrections were introduced to hide those changes. Visual and empirical acceptance remain explicit limitations.
