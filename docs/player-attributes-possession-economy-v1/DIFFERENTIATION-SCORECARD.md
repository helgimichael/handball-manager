# Attribute differentiation scorecard

Source HEAD: `20173857cf2d449ad716ecc19d58ded8ed210d93`. Corrected receipt: `2026-10-15T14:31:57.863Z`.

Existing execution does distinguish several technical and physical capacities. Coverage is uneven: broad cognition/off-ball/switching domains are sparse, screen/pivot skill is primarily upstream choice, and some sampled outcomes reverse despite better capacity signals. This scorecard preserves those distinctions without changing runtime behavior.

## Evidence scope

[Controlled sensitivity JSON](ATTRIBUTE-SENSITIVITY.json), [readable encounter report](ATTRIBUTE-SENSITIVITY.md), [complete 77-attribute inventory](ATTRIBUTE-COVERAGE.md). Input SHA256: `10f88b47bad84526802f4c1decf6b0842c0ec92e887f6dd42e1eacb3a4140a50`; sensitivity SHA256: `9afc1e6e653340cc13d7001a2fe1969515e4f5e3cd4fbb18fd4d0ce1853f0bc5`.

The retained Allsvenskan input has 261 rating profiles (228 outcourt and 33 goalkeepers). Low/median/high use observed per-key p10/p50/p90, with exact raw values in the receipt. These are production game ratings, including generated priors and derived values; they are not measured athlete physiology or verified skill assessments.

77 shot cells x 64 trials give 4,928 resolved trajectories with zero unresolved and an actual canonical keeper-flight read in every trial. Released shots use full canonical ticks, including re-aiming, movement and deflections. Passing cells report actual release signals. Catch/interception cells resolve actual flights with staged catch bodies, not collective moving-receiver AI. The old development shot harness that omitted re-aiming is excluded.

The 13 source fingerprints match current runtime files. Same shot and reception seed/context repeat checks pass in the receipt. No new experiments, runtime edits, calibration or coefficient tuning were performed for this scorecard.

## Grades and decisions

- **STRONG**: Specific action effect clearly observed in the sampled paired task; no claim of league effect size.
- **ADEQUATE**: Meaningful execution signals or scoped outcomes present, with contextual gaps.
- **WEAK**: Narrow/gated coverage or limited/mixed outcome differentiation; does not automatically mean incorrect behavior.
- **NONE**: No corresponding player-specific canonical path.
- **UNKNOWN**: Current encounter design does not establish the requested action-family outcome distinction.

These labels are qualitative judgments scoped to current evidence. A retained correct choice can be identical at every skill tier. A finite seed sample can be non-monotonic, and a changed profile field alone is insufficient. A family can contain a strong subskill and an UNKNOWN untested subskill.

| Action family | Differentiation | Disposition | Evidence and limit |
|---|---|---|---|
| Passing/releasing | **STRONG** | GOOD_ENOUGH | PASSING 11 to 16: difficult fresh mean error .293284 to .185807m; difficult tired .398075 to .317982m (64 releases/tier). Equal-physical technical-group difficult fresh error .314779 to .153560m. This establishes action-specific release differentiation, not a completion-rate target. |
| Reception/control | **WEAK** | TARGETED_FIX | BALL_HANDLING 11 to 15: difficult fresh failures 4 to 3/128, tired4 to 4/128, with monotonically lower centre probe risk. Coherent technical profiles reverse: difficult+tired failures 6 to 4 to 11/128; even simple high-profile cells have2/128 fresh and 4/128 tired failures although centreRisk0. |
| Shot selection | **UNKNOWN** | DEDICATED_PHASE | The shot encounters deliberately commit a shot; they do not measure whether low/high attributes select a better shot. Code has geometry, technique and tendency inputs, but no distinct SHOOTING_VARIETY or broad decision-domain mapping. |
| Shot execution | **ADEQUATE** | TARGETED_FIX | Technique low to high improves central fresh clear 59 to 64/64, medium 50 to 58/64, difficult 53 to 59/64; tired clear 51 to 59/64 and difficult 49 to 53/64. Wing low to high spread .8517 to .7043 but goals 64 to 58/64. Power11 to 16 changes pace 22.789 to 25.684m/s with 55/64 medium goals in all tiers. |
| Drive/feint | **STRONG** | GOOD_ENOUGH | BREAKTHROUGH 11 to 17 gives wrong-footed outcomes 80 to 115/128 against the same defender and seeds. Stronger defender footwork gives108 to 83/128 wrong-footed outcomes across its low/high group. |
| Screen | **WEAK** | TARGETED_FIX | SCREENING 11 to 16 changes the screening profile field, but its only consumer changes PIVOT_SCREEN entry appeal; the same actual attempted screen has fixed geometry/timing. No controlled screen outcome cells were run. |
| Off-ball/spacing | **WEAK** | DEDICATED_PHASE | OFF_BALL_MOVEMENT 10 to 14 changes offBall only. Its readiness gate always passes once ready and saturates ordinary pending ratings; SPACING, ROLE_DISCIPLINE and tactical understanding keys are unmapped. No independent off-ball route/choice encounter was measured. |
| Defensive positioning/help | **WEAK** | TARGETED_FIX | Paired positioning/timing/covering group moves pressure x10.515789 to 10.589474 (7.37cm) and helper x9.393553 to 9.426987 (3.34cm). All three reached frontal contacts remain legal and stop the carrier, correctly preserving the spatial contract. |
| Handover/switch | **NONE** | DEDICATED_PHASE | SWITCHING_HANDOVER 10 to 13 changes profile.handover but no canonical runtime reads it. Team zonal reassignment is real, but player-specific switching capacity is absent. |
| Contact/fouls | **WEAK** | TARGETED_FIX | CONTACT_ABILITY currently affects only the illegal-HOLD severity composite. Discipline chooses holding technique; balance affects closing tolerance. The containment group did not vary CONTACT_ABILITY or DISCIPLINE independently, so their outcome effect is UNKNOWN. |
| Intercept/block | **ADEQUATE** | GOOD_ENOUGH | BALL_WINNING 10 to 13 increases actual interceptions150 to 176/384 over the same absolute lane offsets (39.06% to 45.83%). SHOT_BLOCKING has actual reach and perceived-threat consumers, but no isolated block encounter was measured. |
| Movement/fatigue/recovery | **ADEQUATE** | GOOD_ENOUGH | Same fatigued arrival: ACCELERATION 11 to 16 improves 2.178631 to 2.043824s; REPEAT_SPRINT 11 to 15 improves 2.185695 to 2.067986s. ENDURANCE 11 to 16 reserve after 120s improves .749558 to .757921 and acute after 10s rest .225596 to .204298. Lateral/mobility effects are small and fatigue-gated. |
| Goalkeeper | **WEAK** | DEDICATED_PHASE | Corrected canonical reads occur in 64/64 trials for every shot cell. REACTION 11 to 16 lowers clear goals conceded 63 to 61/64; reading group63 to 62 to 62/64. Several subtypes are flat in their single geometry;7m outcomes 60 to 59 to 60/64. Close/long/wing are primarily post-reach hold skills, with no caught saves in these cells. |
| Cognition/mental | **WEAK** | DEDICATED_PHASE | Paired cognition group raises perceived decision .473684 to .763158, reaction .234737 to .182632s and recovery-read ticks2 to 1. All tiers correctly retain ATTACK_NEXT_DEFENDER in this geometry; pass risk/appeal changes without changing winner. Many named schema domains remain unmapped. |
| Dribble control | **NONE** | DEDICATED_PHASE | BALL_HANDLING supports receptions/control perception, but no dedicated dribble-mistouch/lost-dribble execution category exists. State-based step/hold/double-dribble rules remain active. |
| Pivot-specific technique | **WEAK** | TARGETED_FIX | PIVOT_PLAY 11 to 16 changes pivotPlay and pivot-specific quality/approach consumers exist. There is no isolated pivot-technique outcome cell; actual release uses common placement/finishing rather than a separate pivotPlay technique input. |

## Bounded follow-up scope

- **Passing/releasing - GOOD_ENOUGH:** Retain the passing release model; inspect downstream delivery/catch coupling separately.
- **Reception/control - TARGETED_FIX:** Investigate actual pace, scattered hit point and reached catch-risk distribution before any coefficient change; preserve safe simple receptions and category truth.
- **Shot selection - DEDICATED_PHASE:** Evaluate opportunity-aware shot choice and player-specific recognition in a dedicated attributes/cognition phase; do not infer choice quality from forced-shot conversion.
- **Shot execution - TARGETED_FIX:** Preserve central technique and actual ball pace; inspect the wing aim/window/keeper geometry locally. Do not force goal-rate monotonicity or globally inflate conversion.
- **Drive/feint - GOOD_ENOUGH:** Retain the actual duel distinction; geometry, movement and follow-up selection are separate evidence domains.
- **Screen - TARGETED_FIX:** Give future screen preparation/retention/release work a player-specific capacity if warranted; do not add an arbitrary screen-success roll. Quantitative effect on screen choice remains UNKNOWN.
- **Off-ball/spacing - DEDICATED_PHASE:** Dedicated perception, spacing, timing and support-run differentiation phase, preserving legal movement and existing team structure.
- **Defensive positioning/help - TARGETED_FIX:** Examine approach/read/recovery effects over meaningful defensive opportunities; do not make an already reached legal frontal contact fail by rating lottery.
- **Handover/switch - DEDICATED_PHASE:** Dedicated handover recognition, timing and communication capacity work; retain unique threat responsibility and legal body movement.
- **Contact/fouls - TARGETED_FIX:** Target action preparation/late recovery/controlled contact specificity where needed; preserve actual approach, clear chance and sanction truth, without a generic contact-success probability.
- **Intercept/block - GOOD_ENOUGH:** Keep interception behavior; retain block grade UNKNOWN at the isolated outcome level until its own opportunities are evaluated.
- **Movement/fatigue/recovery - GOOD_ENOUGH:** Preserve approved physical-load behavior. Distinguish unchanged unexercised impulse channels and acceleration-limited TOP_SPEED task from inactive mappings; no physiology claim.
- **Goalkeeper - DEDICATED_PHASE:** Use a dedicated keeper differentiation phase for subtype opportunities, stance and held/parried behavior if prioritized. Do not call live subskills dead or retune global saves from these samples.
- **Cognition/mental - DEDICATED_PHASE:** Dedicated situation-recognition, option valuation and decision timing work across ambiguous contexts; no random mistakes or penalty just for low attribute.
- **Dribble control - DEDICATED_PHASE:** If expanded later, model actual touch/control difficulty and recoverable ball physics; do not relabel rule violations or inject a turnover quota.
- **Pivot-specific technique - TARGETED_FIX:** Inspect actual catch/turn/contact/release opportunities before extending pivot-specific technique; maintain current close-shot and foul architecture.

## Meaningful technical effects with physical ratings equal

| Encounter | Low | Median | High | Scope |
|---|---:|---:|---:|---|
| Technical-profile clear, fresh goals | 57/64 | 62/64 | 64/64 | Same11 physical ratings; coherent technical group changes |
| Technical-profile clear, tired goals | 50/64 | 58/64 | 59/64 | Same11 physical ratings; coherent technical group changes |
| Technical-profile difficult, fresh goals | 49/64 | 55/64 | 59/64 | Same11 physical ratings; coherent technical group changes |
| Technical-profile difficult, tired goals | 45/64 | 51/64 | 54/64 | Same11 physical ratings; coherent technical group changes |
| Technical-profile simple, fresh mean pass error (m) | 0.0628 | 0.0523 | 0.0366 | Release signal, not completion probability |
| Same-context failed catches | 0/128 | 0/128 | 2/128 | Both passer/receiver technical profiles change; pace/impact context coupled |
| Technical-profile simple, tired mean pass error (m) | 0.0730 | 0.0646 | 0.0520 | Release signal, not completion probability |
| Same-context failed catches | 0/128 | 0/128 | 4/128 | Both passer/receiver technical profiles change; pace/impact context coupled |
| Technical-profile difficult, fresh mean pass error (m) | 0.3148 | 0.2503 | 0.1536 | Release signal, not completion probability |
| Same-context failed catches | 4/128 | 3/128 | 4/128 | Both passer/receiver technical profiles change; pace/impact context coupled |
| Technical-profile difficult, tired mean pass error (m) | 0.4137 | 0.3664 | 0.2933 | Release signal, not completion probability |
| Same-context failed catches | 6/128 | 4/128 | 11/128 | Both passer/receiver technical profiles change; pace/impact context coupled |

**The catch reversal remains an unresolved targeted question.** High technique improves pass accuracy, yet the high-profile difficult+tired sample has 11/128 failed receptions versus6/128 low and 4/128 median. Even simple high-profile catches fail2/128 fresh and 4/128 tired. The centre probe reports0 risk in those simple cells, but actual scattered impacts sample different alignment/pressure/pace. It would be incorrect to interpret centreRisk as the average probability governing every catch, to label these intercepted balls (they are named failed receptions), or to claim high technique causes universally worse control.

Individual BALL_HANDLING cells are cleaner but show small realized separation: difficult fresh failures 4 to 3 to 3/128; difficult tired4 to 4 to 4/128. Their deterministic centre risk improves at every tier. These cells do not justify a blanket catch-failure or tiredness target.

## Shooting, keeper and finite outcome caveats

Central technique and coherent technical profiles improve sampled central shooting; technique also narrows spread under fatigue. Clear/medium/difficult are scenario labels with different geometry, not a measured xG ordering. The difficult low-tier fresh cell can therefore outscore the medium low-tier cell. No empirical league conversion claim follows.

Wing technique remains non-monotonic in the sampled direction: WING_FINISHING 12 to 14 to 16 narrows spread .8517 to .7780 to .7043 while goals fall64 to 61 to 58/64. The actual intended aim changes with skill and interacts with keeper/trajectory geometry. This warrants a local window/aim investigation rather than a forced monotonic goal probability. SHOOTING_POWER 11 to 14 to 16 increases pace 22.789 to 24.526 to 25.684m/s, but the medium goal count is55/64 in every tier; ball-speed differentiation exists even when the outcome count ties.

| Keeper variation | Low / median / high goals conceded | What this establishes |
|---|---|---|
| keeperReaction | 63/64 / 62/64 / 61/64 | Small actual reaction effect in this clear context |
| keeperExplosiveness | 55/64 / 55/64 / 55/64 | Actual movement/reach path is live; final outcome count ties |
| keeperPositioning | 62/64 / 62/64 / 62/64 | Set-body geometry limits stance comparison; not proof positioning is dead |
| keeperReading | 63/64 / 62/64 / 62/64 | Small read effect, saturated median/high outcome |
| keeperHeight | 55/64 / 55/64 / 55/64 | LOW_SAVES/HIGH_SAVES group, not factual athlete height; finite reach probe changes |
| keeperClose | 62/64 / 62/64 / 62/64 | Post-reach hold subskill/context not strongly exercised; no caught saves in these shot cells |
| keeperLong | 55/64 / 55/64 / 55/64 | Post-reach hold subskill/context not strongly exercised; no caught saves in these shot cells |
| keeperWing | 61/64 / 61/64 / 61/64 | Post-reach hold subskill/context not strongly exercised; no caught saves in these shot cells |
| keeperPenalty | 60/64 / 59/64 / 60/64 | Finite non-monotonic penalty outcomes; read/stance paths remain live |

The deterministic preflight keeper-reach probe is a capacity signal, not the complete actual response over time. Parry events are also different from terminal parry outcomes: a deflection can subsequently enter the goal. The receipt retains both. No old flat development result is used as evidence.

## Physical, decisions and reached opportunities

The physical work history is 120 seconds of constant-speed locomotion with direction changes, followed by 10 seconds of rest. Its baseline load has locomotor = 1,920 (squared speed times seconds), turning = 952 (velocity-change units), and acceleration/deceleration/contact/jump totals of 0. Therefore unchanged STRENGTH, CONTACT_BALANCE or JUMP_ABILITY work rows do not invalidate their actual-contact/takeoff cost consumers; those channels were not exercised. TOP_SPEED does change relative acute work (.363808 to .312589 low/high) even though this short, acceleration-limited arrival task ties.

The same fatigued movement comparison shows ACCELERATION 11 to 16 arrival2.178631 to 2.043824s; REPEAT_SPRINT_ABILITY 11 to 15 arrival2.185695 to 2.067986s; LATERAL_QUICKNESS 11 to 16 arrival2.102267 to 2.085304s. The latter is a small fatigue/turn effect, not fresh lateral-speed evidence. ENDURANCE 11 to 16 gives reserve .749558 to .757921 after the task and acute .225596 to .204298 after rest. These are engine state units, not physiological measurements.

Decision-group read timing and option components change while the chosen ATTACK_NEXT_DEFENDER stays appropriate in the same strongly separated geometry. Perceived decision .473684 to .763158 and reaction .234737 to .182632s are meaningful inputs; they do not establish broad cognition quality. Read tasks are nonmutating. A different best choice should only be expected where the actual option tradeoff warrants it.

## Real-roster descriptive examples

The ID-sorted median player from each position is selected without ability ranking, preserving that player's complete branch. Their labels/identities are real roster inputs, while their game rating provenance includes GENERATED_PRIOR and DERIVED values. Other attributes vary together, so none of these comparisons isolates a single attribute or establishes a real athlete ranking. Outcourt examples all execute the same central clear/difficult scenarios; wing/pivot identities do not make these their position-specific normal shot distributions.

| Player | Position | Clear goals /64 | Difficult goals /64 | Interpretation |
|---|---|---:|---:|---|
| Hugo Svensson | V6 | 62 | 55 | Goals scored by this outcourt profile; higher is better |
| Hugo Andersson | H6 | 59 | 54 | Goals scored by this outcourt profile; higher is better |
| Jack Månsson | V9 | 64 | 59 | Goals scored by this outcourt profile; higher is better |
| Jens Lindström | H9 | 64 | 57 | Goals scored by this outcourt profile; higher is better |
| Jakob Grönlund | M9 | 63 | 56 | Goals scored by this outcourt profile; higher is better |
| Kenan Salkicevic | M6 | 63 | 56 | Goals scored by this outcourt profile; higher is better |
| Jonas Åberg | GK | 61 | 50 | Goals conceded against this keeper; lower is better |

The JSON retains player IDs, full raw attributes/profiles, per-attribute provenance, individual trial digests and exact denominators. The keeper example is deliberately labelled goals conceded, so it is not read as the goalkeeper shooting.

## Limits and phase choice

- The superseded direct-move shot harness is excluded. Its flat keeper cells cannot establish attribute weakness.
- 64 trials applies to shot and passing-signal cells; catch and duel cells use 128, interception cells384, physical/decision/containment rows are one deterministic task per tier.
- Passing scatter is an actual release signal, not a measured pass-completion probability. Staged catch cells exercise moving ball resolution with fixed catch bodies, not collective moving-receiver AI.
- centreRisk is one deterministic probe at the centre, not the average probability over actual scattered collision points. Actual delivery pace, landing point, pressure/alignment and fatigue change the risk reached by each trial.
- Higher coherent technical-profile catch performance is not guaranteed: both passer and receiver change, pace changes and sampled failures can reverse despite better release accuracy. Report the reversal; do not tune a catch target.
- Wing technique improves intended precision/spread while observed goals reverse in this geometry. Finite coupled trajectory and keeper outcomes do not establish a universal inverse skill relationship.
- Keeper subtype flat cells can be reach/pace/context gated. No caught saves occurred in the 27 isolated keeper-variation cells; 11 held-save terminal outcomes occur in the other shot groups. Catch-only subskills are not broadly judged from conversion.
- Physical work history exercises constant-speed locomotor/turning channels; acceleration/deceleration/contact/jump totals are0. Unchanged strength/balance/jump work rows do not show dead impulse costs.
- The short movement task is partly acceleration-limited; equal TOP_SPEED arrival does not show topSpeed is dead. Its relative acute-work signal changes.
- Same chosen decision in one geometry does not prove poor decisions. Capability/risk and read timing do change; broad cognition, off-ball, screen and pivot outcome differentiation remain incomplete or unmeasured.
- Real roster identities are descriptive examples, not isolated single-attribute causal comparisons or verified athlete ability. Profiles include generated priors and derived values.
- No physiology, league conversion, injury effect or automatic match-win calibration is established by these developer encounters.

A dedicated player-attribute/cognition phase is justified by the unmapped/gated domains and the absence of meaningful player-specific switching, spacing and dribble-control paths. It should preserve the demonstrated passing, duel, interception and approved fatigue mechanisms. Targeted follow-ups should first explain wing aim and delivery/control coupling from actual encounter state; neither licenses a global conversion or turnover patch. The separate possession ledger determines which economic/continuity bottleneck deserves priority before any broader engine change.
