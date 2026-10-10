# Match Realism v2.1 measurement methods

This task starts at released checkpoint `30a946c`. The original v2 baseline, final AFTER sample, committed QA saves and screenshots are immutable references. Current-checkpoint cases 0, 5, 16 and 18 reproduced all four original truth hashes exactly before behavior changes; the separate [reproduction proof](baseline-reproduction/reproduction-proof.json) documents source-equivalent lint cleanup and excludes the heavily contended concurrent runtime from isolated performance claims.

The new tooling advances only the actual career path: pinned real squads/ratings → existing career constructor → actual league fixture and ready event → `startProductionMatch` → repeated `advanceProductionMatch`. A read-only optional post-tick observer receives the real CoreState and newly emitted facts after production metadata/frame capture. It never writes match state, consumes RNG, creates movement, assigns possession or substitutes another result engine.

Run from `apps/game`:

```powershell
node --import tsx scripts/match-calibration-benchmark.ts --count 100 --inputs ../../docs/match-realism-v2/baseline/inputs.json --out ../../docs/match-realism-v21/after
```

Each run stores input SHA-256, fixed seed recipes, actual fixture/player IDs, consumed profiles, complete result, four truth hashes, source fingerprints and per-match observer records. All cases are retained; incomplete matches produce a failure receipt and stop the sample. Use a new output directory for each stage. No completed v2 evidence is overwritten. Source remains fixed throughout a qualified batch.

The first fifty final recipes must pair with the original fifty; additional recipes 50–99 extend the distribution rather than becoming an unlabelled comparison sample. Paired-50 and full-100 summaries must be distinct. All canonical fixtures use normal manual manager defaults and CPU coaching unless explicitly labelled as a controlled experiment.

## Shot decisions and execution

Observed decision/preparation context is retained separately from actual release facts. A real JUMP intent is carried through its subsequent grounded/airborne SHOOT dispatch. The first three v21 pilots used an older exact-text guard that retained the SHOOT-preparation context for most jumps, rather than the original JUMP-selection reason; their release metadata and outcomes are still valid. The corrected guard retains the chosen intent in subsequent runs. This boundary is stated rather than backfilled into old records.

`decisionQuality`/personal estimate is not a calibrated goal probability. The independent `opportunityQuality` evaluates structural chance with a reference player/energy, while executed placement, power/pace, aim error/spread and actual energy retain player-specific execution. The canonical event's full execution metadata is preserved. A single numerical score cut does not make all wing chances intrinsically bad or equate different shot families.

Category rows partition recorded attempts into existing V2 shot kinds. Context rows overlap: transition, pressure, range, nearby curved six-metre boundary and independent/personal quality. The near-six-metre diagnostic region is release clearance up to 1.5m from the existing curved goal-area boundary; it is not a newly invented official scoring category. Range bins ≤8m, 8–10.5m and >10.5m, pressure cut 0.2 and score cut 0.65 are descriptive analysis bins, not encoded conversion quotas or empirical acceptance targets.

The legacy aggregate “close share” is the complement of BACKCOURT_JUMP, STANDING and WING categories, including penalties and any other finish kind. It must not be substituted for the geometric near-six-metre context. Both measures remain separately available.

Each release keeps actual team/role/period, physical origin geometry, keeper position/velocity/condition/profile and ready-action age. The observed keeper stance is distinguished from available flight time. Executed aim is projected from the actual released velocity to the existing goal plane; it is not the target the keeper was allowed to know before release.

Subsequent samples also retain the keeper's actual action target and optional anticipation episode/age. Original JUMP intent is carried into an airborne SHOOT with the same possession, independently of wording. Initial tactics and final per-player energy, distance and court time document controlled experiment setup and physical load.

Every subsequent observed post-tick controller is checked for on-court population, canonical control separation up to 0.86m and exclusion of a concurrent flight. Every release is checked against its actual same-tick body origin with the prior 0.9m catch-offset allowance. Original v2 control coverage sampled chunk boundaries and exact observed release frames, so its zero sampled errors cannot be presented as original every-tick coverage. Older v21 pilots precede these added fields and remain explicitly unavailable for those checks.

Shot outcome uses correlated action IDs. GOAL takes precedence; a SAVE_CAUGHT/PARRY touch counts as a saved attempt only when the shot did not become a goal. The original keeper-touch fact remains available. Blocks and misses are separate. Conventional save rate is saved non-goal shots/(saved non-goal shots+goals); all-attempt save share is reported separately. A low volume of true wide/high misses must not be hidden inside a combined blocked/missed column.

Current observed periods supply precise first/second-half statistics, including protected throws at official boundary time. Older v2 files sometimes require official-clock inference, whose boundary classification is explicitly approximate.

## Transition causality

The observer records actual entries into TRANSITION, distinct attacking possessions, source, gain time and live phase time, exit to settled/restart/possession end, shots/goals and physical snapshots. Sources distinguish opening/post-goal throw-off, keeper-controlled save/rebound, other goalkeeper throws, interception, loose-ball recovery and other awards.

Gain-to-shot progress may include dead-ball retrieval. **Live transition progress** is measured from the real TRANSITION entry to release and is separate. Every released transition chance retains actual goal-side/near-line defenders, forward lane, nearby numerical balance, recovering duties and runner positions. Increasing a label count alone is not proof of improved counterattack: these body/progress facts must support the claimed opportunity.

First-stage records had a forward-lane target clipped to local depth 7m, which pointed backwards for very deep wing releases. Their actual player geometry/progress and outcome counts remain valid; those clipped deep-wing lane figures are not used as forward-opportunity evidence. Later diagnostics use the genuinely goalward corridor. Original stage records remain untouched.

Source attribution follows actual ownership/restart events. A completed restart can create a fresh live phase without a new ownership ID, including the second-half opening; it must not inherit an unrelated old gain's source. Transitions interrupted by a real restart are distinct from a quiet abort into established attack.

Later samples retain the first six actual on-ball action starts of each transition. Restart preparation is timed separately by actual restart ID and phase, with simulation elapsed time, official-clock elapsed time and ticks while the official clock ran. Overall period/phase/ball-mode timing identifies where elapsed match time went. These records are observational; they do not extend the clock or create a restart.

## Contact, advantage and stops

Physical contacts are actual CONTACT_EXECUTED facts. `FOUL_ASSESSED` is the judged infringement, while `WHISTLE_RESTART` is an actual contact-rule stop with its foul ID. Pending, realised and recalled advantages remain distinct. Raw FOUL event counts are retained for continuity with v2, but they are never presented as stopped-whistle counts.

All FREE_THROW awards are counted independently and can include technical/passive rules. Contact whistles do not claim coverage of every possible referee signal. Seven-metre awards/attempts/goals, warnings/suspensions and canonical possession loss are separate facts.

The diagnostic continuous-pair grouping begins only when a real contact occurred. It closes at an actual whistle, possession/control ending or pair separation beyond 1.6m. That threshold describes a continuous duel for inspection; it is not a new canonical referee object or empirical target. Actual contact IDs and class/radial/lateral/control-limit metadata remain retained so this inferred grouping cannot replace the authoritative facts.

Possession terminals come from the canonical ledger, preserving its names and loss classes. A same-team free throw interrupts a sequence rather than creating an extra lost possession. Non-shot losses exclude an earlier shot in that attack; career ending-based turnover counts can therefore differ and retain their own denominator. Assessed fouls continuing under advantage must not manufacture a defensive-foul terminal.

## Controlled experiments and performance

The same fixed indices can run with `--variant QUICK`, WIDTH, COMBINATION, DIRECT or FIVE_ONE. These apply the real manager-side live command at tick zero, retain the same seed/input/lineup, and leave other controls unchanged. BASELINE defaults were checked as BALANCED tempo/orientation and 6:0. Own attacking metrics are the relevant orientation/tempo comparison; opponent chance/pressure metrics are the relevant comparison for a changed own defence. Combined team totals alone cannot establish those effects.

SHOOTER_STRONG/WEAK, KEEPER_STRONG/WEAK, PASSER_STRONG/WEAK and RUNNER_FAST/SLOW alter only cloned in-memory existing gameplay attribute values (18 or 5). They preserve identities, pinned real-player files and CA/PA. Initial consumed profiles document the actual perturbation. These are capability contrasts, not claims that strong always dominates every seed or that the canonical data was edited to make a test pass.

Canonical full-match wall time includes normal production frame capture plus the read-only observer. It is reported with distribution and machine/concurrency context. The four concurrent reproduction jobs were deliberately excluded from an isolated performance comparison. Sequential calibration pilots are practical; tests/build running alongside a batch can still alter elapsed time while all truth hashes remain identical.

Existing EHF_ELITE ranges remain broad engineering references, not precise Allsvenskan empirical targets. Statistical calibration must be shown through the matched sample, context/capability/tactics probes and real browser inspection together. Failed or overcorrected stages remain in the evidence directory.
