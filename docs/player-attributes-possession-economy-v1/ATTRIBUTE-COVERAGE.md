# Player attribute coverage: canonical V2 code truth

Audited HEAD: `20173857cf2d449ad716ecc19d58ded8ed210d93`. Date: 2026-10-15.

Static code truth for the canonical career V2 adapter and runtime. An attribute is not classified as effective merely because its name appears in a schema or a profile. Legacy routes are identified separately.

**56 outcourt + 21 goalkeeper attributes are inventoried below.** The adapter maps 35 outcourt and 13 keeper keys; 34 outcourt keys have at least one runtime consumer, one maps to an unconsumed field, and 21 are unmapped. Eight goalkeeper keys are unmapped. A consumer can still be partial, gated or contextually inactive.

This source audit changes no runtime behavior. Corrected controlled evidence is integrated from [ATTRIBUTE-SENSITIVITY.json](ATTRIBUTE-SENSITIVITY.json), created 2026-10-15T14:31:57.863Z. The earlier direct-move shot harness omitted canonical keeper re-aiming and is superseded. [DIFFERENTIATION-SCORECARD.md](DIFFERENTIATION-SCORECARD.md) separates observed action effects, saturated gates and unmeasured paths.

## Meaning and evidence

`u(A)=(clamp(A,1,20)-1)/19`; `m(...)` is the mean of normalized inputs, including any repeated key. Absent/nonfinite input uses raw 10 (`9/19`), with missing provenance retained. Bridge: `apps/game/lib/career/productionMatch.ts:83 to 94 createProductionSession` - `core/profile.ts:156 buildProfile`. Core paths below use `packages/handball-engine/src/v2/core/`.

| Classification | Meaning |
|---|---|
| DIRECT | Affects action execution, physical movement/cost, reaction, or actual interaction thresholds |
| INDIRECT | Affects action appeal, perception/chance assessment, target choice, or tactical commitment rather than a distinct execution term |
| PARTIAL | Has a real consumer but covers only part of the named action domain |
| GATED | Mapped but consumed only behind a gate that normal ratings can saturate |
| DEAD | Mapped into a profile field with no canonical runtime consumer |
| UNMAPPED | Not read by canonical V2 buildProfile; changing only this branch attribute cannot independently change the resulting profile |

HIGH means directly verified mapping/consumer code; MEDIUM means a sensitivity implication inferred from the verified formula. Consumer presence does not establish population effect size.

## All 77 attribute paths

### Outcourt: 56

#### TECHNICAL

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| PASSING | passing=m(PASSING,PASSING,DECISION_MAKING) | [PASS_EXEC](#pass-exec), [PASS_PLAN](#pass-plan) | DIRECT, INDIRECT | HIGH |
| BALL_HANDLING | handling=m(BALL_HANDLING,COMPOSURE) | [CATCH_EXEC](#catch-exec), [RECEIVER_READY](#receiver-ready), [RESTART_SELECT](#restart-select) | DIRECT, INDIRECT | HIGH |
| SHOOTING_POWER | shotPower=u(SHOOTING_POWER) | [SHOT_PACE](#shot-pace), [SHOT_ASSESS](#shot-assess), [PRESS_DEPTH](#press-depth) | DIRECT, INDIRECT | HIGH |
| SHOOTING_PLACEMENT | shotPlacement=m(SHOOTING_PLACEMENT,FINISHING) | [SHOT_AIM](#shot-aim), [SHOT_ASSESS](#shot-assess), [INTEL_SHOOT](#intel-shoot), [PRESS_DEPTH](#press-depth) | DIRECT, INDIRECT | HIGH |
| SHOOTING_VARIETY | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| BREAKTHROUGH | breakthrough=m(BREAKTHROUGH,AGILITY) | [DUEL](#duel), [DRIVE_APPEAL](#drive-appeal), [PRESS_DEPTH](#press-depth) | DIRECT, INDIRECT | HIGH |
| FINISHING | finishing=u(FINISHING); also half of shotPlacement | [SHOT_AIM](#shot-aim), [SHOT_ASSESS](#shot-assess), [INTEL_SHOOT](#intel-shoot), [PIVOT_CRAFT](#pivot-craft), [PRESS_DEPTH](#press-depth) | DIRECT, INDIRECT | HIGH: FINISHING influences all placement through its composite, not just close finishing |
| WING_FINISHING | wingFinishing=u(WING_FINISHING) | [SHOT_AIM](#shot-aim), [SHOT_ASSESS](#shot-assess) | DIRECT, INDIRECT | HIGH |
| PIVOT_PLAY | pivotPlay=u(PIVOT_PLAY) | [PIVOT_CRAFT](#pivot-craft) | INDIRECT, PARTIAL | HIGH: Pivot chance/approach selection only; actual pivot release does not have a separate pivotPlay accuracy input |
| SCREENING | screening=m(SCREENING,STRENGTH) | [SCREEN_APPEAL](#screen-appeal) | INDIRECT, PARTIAL | HIGH: Entry appeal only; actual resolveScreens geometry/timing does not read screening |

#### PERCEPTION_DECISION

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| GAME_READING | anticipation=m(GAME_READING,ANTICIPATION); reaction=.32-.18*anticipation; decision=m(DECISION_MAKING,GAME_READING) | [MOVE_READ](#move-read), [LEARNED_DEFENCE](#learned-defence), [CONTROL_READ](#control-read), [PARTNER_APPEAL](#partner-appeal), [INTEL_PASS_RISK](#intel-pass-risk), [SHOT_HEIGHT](#shot-height), [REACH_PREDICT](#reach-predict), [INTERCEPT](#intercept) | DIRECT, INDIRECT | HIGH |
| DECISION_MAKING | decision=m(DECISION_MAKING,GAME_READING); passing=m(PASSING,PASSING,DECISION_MAKING) | [CONTROL_READ](#control-read), [PARTNER_APPEAL](#partner-appeal), [INTEL_PASS_RISK](#intel-pass-risk), [SHOT_HEIGHT](#shot-height), [PASS_EXEC](#pass-exec), [PASS_PLAN](#pass-plan) | DIRECT, INDIRECT | HIGH: Decision rating also changes mechanical pass speed/scatter |
| AWARENESS | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| ANTICIPATION | anticipation=m(GAME_READING,ANTICIPATION); reaction=.32-.18*anticipation; ballWinning=m(BALL_WINNING,ANTICIPATION) | [MOVE_READ](#move-read), [LEARNED_DEFENCE](#learned-defence), [REACH_PREDICT](#reach-predict), [INTERCEPT](#intercept) | DIRECT, INDIRECT | HIGH |
| PLAYMAKING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH: profile.ts generated-squad PASSING emphasis contains a cast PLAYMAKING key, but generation iterates OUTCOURT_KEYS, which excludes it |
| TEMPO_CONTROL | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| TWO_V_TWO_READING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| ADVANTAGE_RECOGNITION | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |

#### TACTICAL

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| TACTICAL_UNDERSTANDING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| ROLE_DISCIPLINE | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| OFF_BALL_MOVEMENT | offBall=m(OFF_BALL_MOVEMENT,TIMING) | [RECEIVER_READY](#receiver-ready) | INDIRECT, GATED, PARTIAL | HIGH: No direct movement-quality consumer. Once receipt-ready, gate always passes. While pending, only handling+offBall<=.4 fails; normal ratings generally saturate gate |
| SPACING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| TIMING | offBall=m(OFF_BALL_MOVEMENT,TIMING); defTiming=m(DEFENSIVE_TIMING,TIMING) | [RECEIVER_READY](#receiver-ready), [DUEL](#duel), [PRESS_DEPTH](#press-depth), [DUTY_FEASIBLE](#duty-feasible) | DIRECT, INDIRECT, PARTIAL | HIGH: Off-ball branch gated, but defensive timing branch remains active |
| TRANSITION_UNDERSTANDING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| SYSTEM_ADAPTABILITY | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| SEVEN_V_SIX_UNDERSTANDING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |

#### DEFENSIVE

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| CONTACT_ABILITY | contact=m(CONTACT_ABILITY,STRENGTH) | [HOLD_SEVERITY](#hold-severity) | DIRECT, PARTIAL | HIGH: Illegal HOLD intensity threshold only; no independent legal-contact success/containment capacity |
| DEFENSIVE_POSITIONING | defPositioning=u(DEFENSIVE_POSITIONING) | [PRESS_DEPTH](#press-depth), [STEER_DEFENCE](#steer-defence) | INDIRECT | HIGH |
| DEFENSIVE_TIMING | defTiming=m(DEFENSIVE_TIMING,TIMING) | [DUEL](#duel), [PRESS_DEPTH](#press-depth), [DUTY_FEASIBLE](#duty-feasible) | DIRECT, INDIRECT | HIGH |
| LATERAL_DEFENCE | lateral=m(LATERAL_DEFENCE,AGILITY) | [DUEL](#duel) | DIRECT, PARTIAL | HIGH: Duel resistance; not a direct fresh lateral movement-speed input |
| DEPTH_DEFENCE | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| CENTRAL_DEFENCE | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| COVERING | covering=u(COVERING) | [HELP_TARGET](#help-target) | INDIRECT | HIGH |
| SWITCHING_HANDOVER | handover=u(SWITCHING_HANDOVER) | No canonical consumer | DEAD | HIGH: Profile field never read. Team defence.handover is different state; resolveHandovers merely clears the stale team lock |
| BALL_WINNING | ballWinning=m(BALL_WINNING,ANTICIPATION) | [INTERCEPT](#intercept) | DIRECT | HIGH |
| SHOT_BLOCKING | blocking=u(SHOT_BLOCKING) | [BLOCK_EXEC](#block-exec), [BLOCK_ASSESS](#block-assess) | DIRECT, INDIRECT | HIGH |

#### PHYSICAL

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| ACCELERATION | acceleration=3.6+4*m(ACCELERATION,EXPLOSIVENESS); physical.acceleration=u(ACCELERATION) | [MOVE_EXEC](#move-exec), [REACH_PREDICT](#reach-predict), [LOAD_RELATIVE](#load-relative), [FATIGUE_ACCEL](#fatigue-accel), [LOAD_RUN](#load-run) | DIRECT, INDIRECT | HIGH |
| TOP_SPEED | topSpeed=4.4+3*m(TOP_SPEED,TOP_SPEED,AGILITY) | [MOVE_EXEC](#move-exec), [REACH_PREDICT](#reach-predict), [TRAVEL_ESTIMATE](#travel-estimate), [MOVING_DIFFICULTY](#moving-difficulty), [LOAD_RELATIVE](#load-relative) | DIRECT, INDIRECT | HIGH |
| LATERAL_QUICKNESS | physical.lateralQuickness=u(LATERAL_QUICKNESS) | [FATIGUE_ACCEL](#fatigue-accel) | DIRECT, PARTIAL, GATED | HIGH: Turn-fatigue protection only; multiplied by reserve strain, hence no independent fresh/full-reserve lateral effect |
| AGILITY | topSpeed=4.4+3*m(TOP_SPEED,TOP_SPEED,AGILITY); breakthrough=m(BREAKTHROUGH,AGILITY); lateral=m(LATERAL_DEFENCE,AGILITY); physical.agility=u(AGILITY) | [MOVE_EXEC](#move-exec), [REACH_PREDICT](#reach-predict), [MOVING_DIFFICULTY](#moving-difficulty), [LOAD_RELATIVE](#load-relative), [DUEL](#duel), [DRIVE_APPEAL](#drive-appeal), [PRESS_DEPTH](#press-depth), [FATIGUE_ACCEL](#fatigue-accel), [LOAD_RUN](#load-run) | DIRECT, INDIRECT | HIGH: Broad composite coupling across movement, attacking duels and defensive duels |
| EXPLOSIVENESS | acceleration=3.6+4*m(ACCELERATION,EXPLOSIVENESS); physical.explosiveness=u(EXPLOSIVENESS) | [MOVE_EXEC](#move-exec), [REACH_PREDICT](#reach-predict), [LOAD_RELATIVE](#load-relative), [LOAD_IMPULSE](#load-impulse) | DIRECT, INDIRECT | HIGH |
| STRENGTH | strength=u(STRENGTH); screening=m(SCREENING,STRENGTH); contact=m(CONTACT_ABILITY,STRENGTH) | [PIVOT_CRAFT](#pivot-craft), [SCREEN_APPEAL](#screen-appeal), [HOLD_SEVERITY](#hold-severity), [LOAD_IMPULSE](#load-impulse) | DIRECT, INDIRECT | HIGH |
| CONTACT_BALANCE | balance=u(CONTACT_BALANCE) | [CONTACT_BALANCE](#contact-balance), [LOAD_IMPULSE](#load-impulse), [FATIGUE_EXEC](#fatigue-exec) | DIRECT | HIGH |
| JUMP_ABILITY | physical.jumping=u(JUMP_ABILITY) | [LOAD_IMPULSE](#load-impulse) | DIRECT, PARTIAL | HIGH: Jump energy efficiency only. Actual legal takeoff uses fixed24ticks, no rating-dependent elevation/airtime/release geometry |
| ENDURANCE | endurance=u(ENDURANCE) | [FATIGUE_SPEED](#fatigue-speed), [FATIGUE_ACCEL](#fatigue-accel), [LOAD_RUN](#load-run), [RECOVERY](#recovery) | DIRECT | HIGH |
| REPEAT_SPRINT_ABILITY | physical.repeatSprint=u(REPEAT_SPRINT_ABILITY) | [FATIGUE_ACCEL](#fatigue-accel), [FATIGUE_EXEC](#fatigue-exec), [LOAD_RUN](#load-run), [LOAD_IMPULSE](#load-impulse), [RECOVERY](#recovery) | DIRECT | HIGH |
| MOBILITY | physical.mobility=u(MOBILITY) | [FATIGUE_ACCEL](#fatigue-accel), [LOAD_RUN](#load-run) | DIRECT, PARTIAL | HIGH: Braking cost and turning-fatigue protection; not independent fresh reach or recovery capacity |

#### MENTAL

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| CONSISTENCY | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| COMPOSURE | composure=u(COMPOSURE); handling=m(BALL_HANDLING,COMPOSURE) | [SHOT_AIM](#shot-aim), [CATCH_EXEC](#catch-exec), [RECEIVER_READY](#receiver-ready), [RESTART_SELECT](#restart-select), [SHOT_HEIGHT](#shot-height), [INTENT_COMMIT](#intent-commit) | DIRECT, INDIRECT | HIGH: Reception technique expands to .4*u(BALL_HANDLING)+.6*u(COMPOSURE) before fatigue; this is a composite-coupling observation, not proof it is incorrectly weighted |
| CONCENTRATION | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| COMPETITIVE_MENTALITY | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| RESILIENCE | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| DISCIPLINE | discipline=u(DISCIPLINE) | [CONTACT_TECHNIQUE](#contact-technique), [HOLD_SEVERITY](#hold-severity) | DIRECT, INDIRECT | HIGH |
| COACHABILITY | No canonical mapping | No canonical consumer | UNMAPPED | HIGH: No canonical match execution path; this does not classify upstream development systems |
| LEADERSHIP | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| PRESSURE_HANDLING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH: Current execution pressure protection comes through COMPOSURE and action technique instead |

### Goalkeeper: 21

#### SHOT_STOPPING

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| GK_POSITIONING | keeper.positioning=m(GK_POSITIONING,SET_POSITION) | [GK_READ](#gk-read), [GK_STANCE](#gk-stance) | DIRECT, INDIRECT | HIGH |
| SET_POSITION | keeper.setPosition=u(SET_POSITION); keeper.positioning=m(GK_POSITIONING,SET_POSITION) | [GK_STANCE](#gk-stance), [GK_READ](#gk-read) | DIRECT, INDIRECT | HIGH |
| REACTION | keeper.reaction=u(REACTION); reaction=.32-.18*m(REACTION,REACTION,SHOOTER_READING); topSpeed=3.2+1.6*m(GK_EXPLOSIVENESS,REACTION) | [GK_READ](#gk-read), [GK_REACH](#gk-reach), [GK_HOLD](#gk-hold), [MOVE_EXEC](#move-exec), [REACH_PREDICT](#reach-predict) | DIRECT, INDIRECT | HIGH |
| GK_EXPLOSIVENESS | keeper.explosiveness=u(GK_EXPLOSIVENESS); acceleration=5+4*u(GK_EXPLOSIVENESS); topSpeed=3.2+1.6*m(GK_EXPLOSIVENESS,REACTION) | [MOVE_EXEC](#move-exec), [REACH_PREDICT](#reach-predict), [GK_REACH](#gk-reach) | DIRECT, INDIRECT | HIGH |
| LOW_SAVES | keeper.low=u(LOW_SAVES) | [GK_REACH](#gk-reach), [GK_HOLD](#gk-hold), [SHOOTER_GK_READ](#shooter-gk-read) | DIRECT, INDIRECT | HIGH |
| HIGH_SAVES | keeper.high=u(HIGH_SAVES) | [GK_REACH](#gk-reach), [GK_HOLD](#gk-hold), [SHOOTER_GK_READ](#shooter-gk-read) | DIRECT, INDIRECT | HIGH |
| CLOSE_RANGE_SAVES | keeper.close=u(CLOSE_RANGE_SAVES) | [GK_HOLD](#gk-hold) | DIRECT, PARTIAL | HIGH: Primarily post-reach held-save versus parry; does not independently expand finite hand reach |
| LONG_RANGE_SAVES | keeper.long=u(LONG_RANGE_SAVES) | [GK_HOLD](#gk-hold) | DIRECT, PARTIAL | HIGH: Primarily post-reach held-save versus parry; does not independently expand finite hand reach |
| WING_SAVES | keeper.wing=u(WING_SAVES) | [GK_HOLD](#gk-hold) | DIRECT, PARTIAL | HIGH: Post-reach held-save family for wide origins; not a separate wing reach capacity |
| SEVEN_M_SAVES | keeper.sevenMetre=u(SEVEN_M_SAVES) | [GK_READ](#gk-read), [GK_STANCE](#gk-stance), [GK_PENALTY_STEP](#gk-penalty-step) | DIRECT, INDIRECT | HIGH |

#### PERCEPTION_DECISION

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| SHOOTER_READING | keeper.reading=m(SHOOTER_READING,SHOT_ANTICIPATION); anticipation=same mean; reaction=.32-.18*m(REACTION,REACTION,SHOOTER_READING) | [GK_READ](#gk-read), [GK_REACH](#gk-reach), [REACH_PREDICT](#reach-predict) | DIRECT, INDIRECT | HIGH: Generic anticipation is also populated but ordinary keeper stance/flight paths bypass outcourt movement-read and learned-defence targets |
| SHOT_ANTICIPATION | keeper.reading=m(SHOOTER_READING,SHOT_ANTICIPATION); anticipation=same mean | [GK_READ](#gk-read) | DIRECT, INDIRECT | HIGH: Generic anticipation is also populated, but ordinary keeper stance/flight paths use keeper.reading rather than outcourt movement-read/learned-defence targets |
| PATIENCE | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| DECISION_TIMING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |

#### TRANSITION

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| OUTLET_PASSING | passing=u(OUTLET_PASSING); keeper.outlet=u(OUTLET_PASSING) | [PASS_EXEC](#pass-exec), [PASS_PLAN](#pass-plan) | DIRECT, INDIRECT, PARTIAL | HIGH: Generic passing remains active. Duplicate keeper.outlet field has no canonical consumer |
| RESTART_SPEED | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| TRANSITION_DECISION | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |

#### MENTAL

| Attribute | Normalized/composite profile mapping | Consumer evidence IDs | Effect/classification | Confidence and limitation |
|---|---|---|---|---|
| GK_CONSISTENCY | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| GK_COMPOSURE | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| GK_CONCENTRATION | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |
| GK_PRESSURE_HANDLING | No canonical mapping | No canonical consumer | UNMAPPED | HIGH |

## Consumer evidence

Each evidence ID resolves to actual consumer functions, file lines and the effect. File lines indicate the relevant expression or enclosing function. The attribute tables and this registry form one matrix; a named field without a registered consumer is classified accordingly.

### PASS-EXEC

- `packages/handball-engine/src/v2/core/execution.ts:59` - `executePass`: Passing changes pace, difficult-execution capability and scatter.

### PASS-PLAN

- `packages/handball-engine/src/v2/core/engage.ts:251` - `readContinuation`: Pass pace used for lane/travel assessment.
- `packages/handball-engine/src/v2/core/intelligence.ts:65` - `perceiveHandball`: Receiver lane arrival margin.
- `packages/handball-engine/src/v2/core/offence.ts:174` - `chooseOffensiveAction`: Pass timing assessment.
- `packages/handball-engine/src/v2/core/structure.ts:206` - `transitionProgress`: Pass lane assessment.
- `packages/handball-engine/src/v2/core/restarts.ts:90` - `restartStep`: Restart receiver lane assessment.
- `packages/handball-engine/src/v2/core/pivot.ts:139` - `pivotOffer`: Pivot-feed lane arrival assessment.

### CATCH-EXEC

- `packages/handball-engine/src/v2/core/execution.ts:80` - `receptionRisk`: Pressure, pace, alignment and movement form difficulty; technique=.8*handling+.2*composure; fatigue changes control.
- `packages/handball-engine/src/v2/core/interactions.ts:386` - `advanceBall`: Reception failure is resolved on actual swept ball contact.

### RECEIVER-READY

- `packages/handball-engine/src/v2/core/intelligence.ts:68` - `perceiveHandball`: readiness=.5+.25*handling+.25*offBall-.15 while receipt offer pending.
- `packages/handball-engine/src/v2/core/intelligence.ts:124` - `affordancesFor`: readiness is used only as >.45 receiver eligibility, not a value weight.

### RESTART-SELECT

- `packages/handball-engine/src/v2/core/restarts.ts:94` - `restartStep`: Handling and energy affect restart receiver appeal.

### SHOT-PACE

- `packages/handball-engine/src/v2/core/interactions.ts:132` - `release`: Ordinary shot speed=(17+11*shotPower)*flatAdjustment*(.88+.12*executionCapacity).

### SHOT-AIM

- `packages/handball-engine/src/v2/core/execution.ts:14` - `planShotTarget`: Placement/wing/penalty-specific technique, pressure, angle, body movement and fatigue determine intended aim and spread.

### SHOT-ASSESS

- `packages/handball-engine/src/v2/core/space.ts:83` - `geometricShotQuality`: Central ability=.45*shotPower+.35*shotPlacement+.2*finishing; wide ability=.65*wingFinishing+.35*shotPlacement; usable wing sight also reads wingFinishing.
- `packages/handball-engine/src/v2/core/space.ts:147` - `shotContext`: Body pressure, block threat, geometry and fatigue produce assessed chance; opportunityQuality uses reference ability.

### SHOT-HEIGHT

- `packages/handball-engine/src/v2/core/execution.ts:91` - `shotHeight`: decision*composure weights reading of opposing keeper high/low attributes; placement affects height uncertainty.

### PRESS-DEPTH

- `packages/handball-engine/src/v2/core/defence.ts:199` - `pressDepth`: Carrier shooting versus drive threat and defender defTiming/defPositioning determine step-out depth.

### DUEL

- `packages/handball-engine/src/v2/core/interactions.ts:23` - `duel`: At line58 margin=attacker breakthrough-(.6*defender lateral+.4*defender defTiming)+screen/context terms and seeded uncertainty.

### DRIVE-APPEAL

- `packages/handball-engine/src/v2/core/engage.ts:413` - `readContinuation`: Breakthrough influences drive appeal.
- `packages/handball-engine/src/v2/core/offence.ts:223` - `chooseOffensiveAction`: Breakthrough*tendency.drive gates an isolated FEINT.
- `packages/handball-engine/src/v2/core/intelligence.ts:117` - `affordancesFor`: Breakthrough contributes .06-scaled capability to eligible drive options.

### INTEL-SHOOT

- `packages/handball-engine/src/v2/core/intelligence.ts:73` - `perceiveHandball`: shooting=(shotPlacement+finishing)/2.
- `packages/handball-engine/src/v2/core/intelligence.ts:123` - `affordancesFor`: Shooting contributes .08-scaled capability to eligible shot options.

### PIVOT-CRAFT

- `packages/handball-engine/src/v2/core/pivot.ts:165` - `pivotShotQuality`: Craft=.45*pivotPlay+.3*finishing+.25*strength; contributes to pivot chance and legal approach assessment.
- `packages/handball-engine/src/v2/core/structure.ts:283` - `chooseCarrierLegacy`: Pivot quality determines whether and how a pivot finishes.
- `packages/handball-engine/src/v2/core/engage.ts:292` - `readContinuation`: Pivot quality scores pivot shooting and feeding options.
- `packages/handball-engine/src/v2/core/pivot.ts:257` - `pivotCatchApproach`: Pivot quality improvement helps choose legal approach target.

### SCREEN-APPEAL

- `packages/handball-engine/src/v2/core/offence.ts:73` - `entryCandidates`: PIVOT_SCREEN appeal adds .7*pivot.screening*pivot.tendency.hold.

### MOVE-READ

- `packages/handball-engine/src/v2/core/movement.ts:31` - `movementReadTicks`: reaction and anticipation affect reread interval; STEP_OUT, DRIVE and named receiver return1tick before those fields are read.

### LEARNED-DEFENCE

- `packages/handball-engine/src/v2/core/offence.ts:147` - `anticipatedDefenceTarget`: Anticipation scales a lateral read offset when existing pattern recognition is active.

### CONTROL-READ

- `packages/handball-engine/src/v2/core/structure.ts:183` - `controlReadTicks`: Read ticks=round((QUICK?5:8)+(1-decision)*4+(1-energy)*3), with bounded prepared-reentry credit.

### PARTNER-APPEAL

- `packages/handball-engine/src/v2/core/offence.ts:62` - `entryCandidates`: Partner decision*energy affects relationship entry appeal.

### INTEL-PASS-RISK

- `packages/handball-engine/src/v2/core/intelligence.ts:137` - `affordancesFor`: (1-decision)*.05 contributes pass-option risk.

### STEER-DEFENCE

- `packages/handball-engine/src/v2/core/defence.ts:417` - `dutyTarget`: defPositioning changes inside-shoulder lateral bias.

### HELP-TARGET

- `packages/handball-engine/src/v2/core/defence.ts:436` - `dutyTarget`: covering scales actual lateral help pull.

### DUTY-FEASIBLE

- `packages/handball-engine/src/v2/core/defence.ts:462` - `dutyFeasible`: PRESSURE/HELP feasibility requires arrival <=2+.6*defTiming seconds.

### INTERCEPT

- `packages/handball-engine/src/v2/core/interactions.ts:306` - `advanceBall`: Actual reaction eligibility then grasp=.22+.33*ballWinning.

### BLOCK-EXEC

- `packages/handball-engine/src/v2/core/interactions.ts:322` - `advanceBall`: Ready actual BLOCK reach includes .16+.34*blocking after geometric/action eligibility.

### BLOCK-ASSESS

- `packages/handball-engine/src/v2/core/space.ts:172` - `shotContext`: Visible block threat includes .35+.65*blocking.

### MOVE-EXEC

- `packages/handball-engine/src/v2/core/actions.ts:107` - `move`: Actual topSpeed/acceleration times physical capacities, impairment, action pace and target steering.

### REACH-PREDICT

- `packages/handball-engine/src/v2/core/timing.ts:45` - `reachOf`: Uses corresponding topSpeed, acceleration and reaction for legal arrival/lane predictions.

### TRAVEL-ESTIMATE

- `packages/handball-engine/src/v2/core/engine.ts:57` - `collectionTime`: Loose-ball collection detour estimate uses profile.topSpeed.
- `packages/handball-engine/src/v2/core/sanction.ts:79` - `clearChanceDestroyed`: Approach/release-time estimate uses attacker topSpeed.

### MOVING-DIFFICULTY

- `packages/handball-engine/src/v2/core/execution.ts:19` - `planShotTarget`: Velocity relative to topSpeed contributes shot difficulty.
- `packages/handball-engine/src/v2/core/execution.ts:64` - `executePass`: Receiver relative speed contributes pass difficulty.
- `packages/handball-engine/src/v2/core/execution.ts:83` - `receptionRisk`: Relative speed contributes reception difficulty.

### LOAD-RELATIVE

- `packages/handball-engine/src/v2/core/physicalLoad.ts:65` - `updatePhysicalCondition`: Relative speed and velocity changes relative to acceleration determine actual acute/high-intensity work.

### FATIGUE-SPEED

- `packages/handball-engine/src/v2/core/physicalLoad.ts:20` - `physicalSpeedCapacity`: Endurance modifies reserve/acute-related loss; goalkeeper retains separate branch.

### FATIGUE-ACCEL

- `packages/handball-engine/src/v2/core/physicalLoad.ts:24` - `physicalAccelerationCapacity`: RepeatSprint and acceleration protect repeated acceleration; feet=.55*agility+.30*lateralQuickness+.15*mobility protects fatigued turning; feet effect is multiplied by reserve strain.

### FATIGUE-EXEC

- `packages/handball-engine/src/v2/core/physicalLoad.ts:31` - `physicalExecutionCapacity`: Actual reserve/acute, difficulty, technique, repeatSprint and balance/body-demand determine extra difficult-execution loss.

### LOAD-RUN

- `packages/handball-engine/src/v2/core/physicalLoad.ts:70` - `updatePhysicalCondition`: Locomotor cost scales with endurance; acceleration gain cost with rawAcceleration; braking with mobility; turning with agility; repeated acute work with repeatSprint.

### LOAD-IMPULSE

- `packages/handball-engine/src/v2/core/physicalLoad.ts:39` - `physicalImpulse`: Actual contact cost uses strength/balance; actual jump cost uses jumping/explosiveness; repeatSprint moderates acute cost.
- `packages/handball-engine/src/v2/core/contact.ts:74` - `resolveContacts`: Only a reached actual contact charges both players.
- `packages/handball-engine/src/v2/core/interactions.ts:203` - `resolveScreens`: Only sustained actual screen-body contact charges equivalent engagement seconds.
- `packages/handball-engine/src/v2/core/actions.ts:260` - `execute`: Actual takeoff charges jump impulse.

### RECOVERY

- `packages/handball-engine/src/v2/core/physicalLoad.ts:49` - `recoverySeconds / recoverPhysical / updatePhysicalCondition`: Endurance and repeatSprint determine acute decay; endurance affects bounded reserve recovery; bench, timeout and ordinary stopped-clock windows differ.

### CONTACT-BALANCE

- `packages/handball-engine/src/v2/core/sanction.ts:130` - `readContact`: Balance changes controlled frontal closing-speed tolerance.

### CONTACT-TECHNIQUE

- `packages/handball-engine/src/v2/core/contact.ts:44` - `planContact`: Discipline versus actual lost-shoulder desperation chooses HOLD or bent arms.

### HOLD-SEVERITY

- `packages/handball-engine/src/v2/core/sanction.ts:168` - `readContact`: disciplined=.5*discipline+.5*contact changes illegal HOLD intensity threshold; geometry and clear chance remain authoritative.

### INTENT-COMMIT

- `packages/handball-engine/src/v2/core/intelligence.ts:163` - `commitHandball`: Composure adds to intent commitment/hysteresis.
- `packages/handball-engine/src/v2/core/structure.ts:31` - `assign`: Composure affects assigned intent commitment.

### GK-READ

- `packages/handball-engine/src/v2/core/execution.ts:36` - `prepareKeeperAnticipation`: Visible wind-up read: ordinary .45*reading+.35*reaction+.2*positioning; penalty .35*reading+.20*reaction+.15*positioning+.30*sevenMetre.
- `packages/handball-engine/src/v2/core/structure.ts:592` - `commitReleasedKeeper`: Reaction-gated released-flight read with same ordinary/penalty blends and noisy actual target prediction.

### GK-STANCE

- `packages/handball-engine/src/v2/core/structure.ts:550` - `refreshActiveMovement`: Default stance depth=1.05+.6*keeper.setPosition; lateral ideal-post blend=.45+.55*keeper.positioning.
- `packages/handball-engine/src/v2/core/restarts.ts:137` - `restartStep`: Penalty stance quality=.6*sevenMetre+.4*positioning affects legal depth.

### GK-REACH

- `packages/handball-engine/src/v2/core/interactions.ts:255` - `keeperReachForShot`: Explosiveness sets finite hand span; reaction/actual flight time limit hand travel; low/high quality changes vertical reach demand; standing torso is retained.

### GK-HOLD

- `packages/handball-engine/src/v2/core/interactions.ts:348` - `advanceBall`: After a reached shot, family=.5*(low/high)+.3*(close/long)+.2*(wing or reaction). Hold requires actual SAVE, proximity and pace<=15+13*family; otherwise parry.

### SHOOTER-GK-READ

- `packages/handball-engine/src/v2/core/execution.ts:94` - `shotHeight`: Keeper high versus low quality enters shooter's technique-scaled height preference.

### GK-PENALTY-STEP

- `packages/handball-engine/src/v2/core/execution.ts:51` - `prepareKeeperAnticipation`: Penalty loading step=.35+.1*sevenMetre.

## Action-family specificity and bypass matrix

| Action family | Actual specificity | Execution evidence | Bypass, partial or missing path | Weight concentration to examine |
|---|---|---|---|---|
| Passing/releasing | PASSING plus DECISION_MAKING composite; OUTLET_PASSING for keepers; actual range, lane, pressure and recipient motion | PASS_EXEC | Protected restart returns set scatter0; no player-specific RESTART_SPEED or TRANSITION_DECISION. No per-pass general error lottery | Decision rating changes mechanical pass pace and scatter as well as reading; quantify before calling overweighted |
| Reception/control | BALL_HANDLING and COMPOSURE with real pressure, pace, alignment, movement and fatigue | CATCH_EXEC | Ready receiver offBall gate saturates normal ratings; no CONCENTRATION path | Technique expands to .4*BALL_HANDLING+.6*COMPOSURE before fatigue; plausible concentration of influence, not a calibration verdict |
| Shot selection | SHOOTING_POWER, SHOOTING_PLACEMENT, FINISHING, WING_FINISHING; pivot craft on pivot-specific path; role tendency and actual geometry | SHOT_ASSESS | Intelligence relevant only for non-pivot field carriers and particular sustained/moving/created advantages; legacy carrier path retains pivot authority | FINISHING counted both as standalone quality and in shotPlacement composite; no distinct SHOOTING_VARIETY |
| Shot execution | Power changes physical ball pace; placement/wing/penalty technique changes aim/spread; actual body context and fatigue | SHOT_AIM / SHOT_PACE / SHOT_HEIGHT | PIVOT_PLAY affects choice/approach but no pivot-specific mechanical accuracy term; SHOOTING_VARIETY unused | COMPOSURE participates repeatedly in penalty technique/pressure/spread; audit contextual effects rather than assume error |
| Drive/feint | BREAKTHROUGH+AGILITY versus LATERAL_DEFENCE+AGILITY and DEFENSIVE_TIMING+TIMING; legal travel and real body relation | DUEL | No TWO_V_TWO_READING or ADVANTAGE_RECOGNITION input; skill alone cannot bypass legal/body eligibility | AGILITY is shared across attacking duel, defending duel and running topSpeed |
| Screen | SCREENING+STRENGTH changes PIVOT_SCREEN entry appeal | SCREEN_APPEAL | resolveScreens uses geometry, opposing speed and fixed timing/cooldown; same attempted screen has no screening-capacity term | Selection influence should not be presented as screen-execution quality |
| Off-ball/spacing | Team/role geometry, active entries, ball/body relations and generic movement; OFF_BALL_MOVEMENT has receiver-ready gate only | RECEIVER_READY / MOVE_EXEC | SPACING, ROLE_DISCIPLINE, TACTICAL_UNDERSTANDING and transition/system/7v6 understanding unmapped; ready gate passes all valid profiles | Geometry and role can dominate the named off-ball rating |
| Defensive positioning/help | DEFENSIVE_POSITIONING, COVERING and DEFENSIVE_TIMING shape step-out/inside bias/help target/feasibility; actual team zones and geometry | PRESS_DEPTH / STEER_DEFENCE / HELP_TARGET / DUTY_FEASIBLE | DEPTH_DEFENCE, CENTRAL_DEFENCE and tactical cognition unmapped | No claim that allocating the correct job proves equal-rated actors execute it differently |
| Handover/switch | Team zonal allocation reassigns actual threats | No profile.handover consumer | SWITCHING_HANDOVER maps into a dead capacity; resolveHandovers clears stale team state | Schema/profile presence would falsely imply player-specific switching |
| Contact/fouls | Actual approach, shoulder loss, closing speed, clear chance, discipline; CONTACT_ABILITY+STRENGTH only in HOLD severity; balance in closing tolerance | CONTACT_TECHNIQUE / HOLD_SEVERITY / CONTACT_BALANCE | No independent CONTACT_ABILITY legal containment success term | Discipline/geometry dominate punishability; contact rating does not act as general defensive quality |
| Intercept/block | BALL_WINNING+ANTICIPATION and reaction for actual intercept grasp; SHOT_BLOCKING for active block reach and perceived threat | INTERCEPT / BLOCK_EXEC / BLOCK_ASSESS | Actual swept path, readiness/action phase and relation remain eligibility gates | Do not equate large nominal capacity range with frequent reachable opportunities |
| Movement/fatigue/recovery | All11 physical attrs have at least one direct cost/capacity consumer; actual work channels drive load | MOVE_EXEC / REACH_PREDICT / LOAD_RUN / LOAD_IMPULSE / RECOVERY | LATERAL_QUICKNESS full-reserve effect0; JUMP_ABILITY cost only; mobility chiefly braking cost/turn-fatigue; fixed24tick takeoff | AGILITY broad composites; distinguish cost resistance from fresh movement performance |
| Goalkeeper | Positioning, set stance, reaction, explosiveness, reading and 7m capacity affect actual movement/read/reach; low/high affect vertical reach; close/long/wing affect held/parried result | GK_READ / GK_STANCE / GK_REACH / GK_HOLD | 8 GK attrs unmapped. Generic outcourt handling/composure/decision/endurance use raw10 fallback rather than GK mental values | Post-reach hold ability is a different effect from increasing first-save reach |
| Cognition/mental | GAME_READING, DECISION_MAKING, ANTICIPATION, COMPOSURE and DISCIPLINE provide most named effects | CONTROL_READ / MOVE_READ / INTENT_COMMIT / CONTACT_TECHNIQUE | 5 perception/decision,6 tactical and 7 mental outcourt keys unmapped; defensive Intelligence perception describes geometry without an individual cognition parameter | Small capability terms and role tendencies may dominate the distinction between a cognitively strong and weak actor in ordinary context; quantitative effect pending |

These observations identify concentration and bypasses in current formulas. They do not claim that a coefficient is empirically wrong. A named skill must affect a reached opportunity in the controlled evidence before it is called meaningfully differentiating.

## Factual body profile

| Field | Schema | Canonical mapping/effect | Evidence | Confidence |
|---|---|---|---|---|
| heightCm | apps/game/lib/rating/types.ts:88 PlayerPhysicalProfile | UNMAPPED | productionMatch.ts createProductionSession clones template body/radius and assigns attrs/profile, not actual height; CorePlayer state.ts:26 has radius but no height | HIGH |
| weightKg | apps/game/lib/rating/types.ts:89 PlayerPhysicalProfile | UNMAPPED | No weight copied at V2 production seam; contact load uses STRENGTH/CONTACT_BALANCE rather than factual mass | HIGH |
| handedness | apps/game/lib/rating/types.ts:90 PlayerPhysicalProfile | UNMAPPED | No dominant-hand field read by buildProfile/createProductionSession; current aim uses geometry and ratings | HIGH |

## CA, PA, overall and identity routes

| Route | Evidence | Classification | Actual effect | Confidence |
|---|---|---|---|---|
| Canonical V2 execution | `apps/game/lib/career/productionMatch.ts:83` `createProductionSession` | ATTRIBUTES_ONLY | Only branch attribute values enter buildProfile. No CA/PA/overall runtime multiplier or CA-derived missing-attribute fallback | HIGH |
| Normal default plan/lineup | `apps/game/lib/career/playerMatchStrength.ts:434` `resolveClubMatchPlanForFixture`; `apps/game/lib/career/squadStatus.ts:57`, `apps/game/lib/matchPlan/careerSquadBridge.ts:78`, `apps/game/lib/matchPlan/defaultMatchPlan.ts:126` | SELECTION_INDIRECT | Saved plan wins; otherwise calibrated squad status or legacy squad-status fallback determines priority through deriveDefaultSquadStatusTier -> buildInitialMatchSquad -> buildDefaultMatchPlan, not blanket CA sorting | HIGH |
| Fallback best-available lineup | `apps/game/lib/career/spatialMatch/careerLineup.ts:79` `byAbility / selectBestAvailableLineup` | CA_SELECTION_INDIRECT | PlayerMock.currentAbility sorts position-fit candidates and bench. This fallback is different from the normal resolved plan path and does not multiply execution | HIGH |
| Attack role/tendency | `apps/game/lib/career/productionMatch.ts:87` `createProductionSession` | ROLE_CHOICE_INDIRECT | Highest finite supported attackRoleProficiencies entry chooses ROLE_TENDENCIES by name; proficiency magnitude is not an execution multiplier. Missing role uses half-strength positional tendency. OFFENSIVE_PIVOT/TWO_WAY_M6 unsupported by engine ROLE_TENDENCIES; defenceRoleProficiencies not copied | HIGH |
| Legacy Fast Match strength | `apps/game/lib/career/playerMatchStrength.ts:149` `blendedValue / playerAttackValue / playerDefenceValue / playerGoalkeeperValue` | LEGACY_CA_DIRECT | .5*scaledCA+.5*phaseAttributeMean supplies legacy strength/expected-goals adapter, not canonical V2 execution profile | HIGH |
| Legacy spatial ratings fallback | `apps/game/lib/career/spatialMatch/careerRatings.ts:129` `ratingFromCurrentAbility` | LEGACY_CA_DIRECT | CA/10 populates old spatial quality fields. Production V2 seam does not call buildSpatialRatings/ratingFromCurrentAbility | HIGH |
| Upstream attribute generation | `apps/game/lib/gameWorld/gameplayRatingSnapshot.ts:73` `snapshotGameplayRatingsForClub` | UPSTREAM_CA_INDIRECT | Existing proposal -> CA estimation -> game prior -> attribute generation resolves nonlocked attributes before the match. Locked records retain supplied branch. Distinct from hidden in-match CA multiplier | HIGH |
| PA/overall | `apps/game/lib/career/productionMatch.ts:83` `createProductionSession` | NO_CANONICAL_RUNTIME_CONSUMER_FOUND | PA snapshot exists upstream but is not read to construct V2 execution capacity. No overall quality score consumed by the reviewed V2 core | HIGH |

## Missing data and goalkeeper fallback

source.complete checks35/13 supported keys, not56/21 total schema. Production session stores provenance but does not call unratedPlayers or read source.complete to reject/visibly flag it. The profile comment asserting production reads completeness is stronger than this seam's implementation.

Generic keeper handling/composure/decision/endurance/outcourt capacities read absent outcourt keys at raw10. GK-prefixed mental values do not replace them.

## Interpretation limits

- UNMAPPED means no independent canonical match effect from editing that branch value alone; it does not mean unused by editor, CA generation, development, recruitment, legacy simulation or other product systems.
- A live consumer can be gated out, saturated or overwhelmed by actual geometry/phase/tendency; experiments must measure action-specific opportunities and cannot infer effectiveness from cohort score alone.
- Overweight concerns above are coupling/coverage observations, not empirical claims that existing coefficients are wrong.
- All findings describe audited HEAD and source read during this task. No runtime behavior was changed to improve coverage.

Machine-readable inventory: [ATTRIBUTE-COVERAGE.json](ATTRIBUTE-COVERAGE.json).

## Corrected quantitative integration

The retained input contains 261 production rating profiles. All 77 shot cells (including real-roster examples) ran 64 trials: **4,928 resolved trajectories, zero unresolved, and an actual KEEPER_FLIGHT_READ in every trial**. The 13 recorded runtime source hashes match current files. Passing-signal cells run64 releases each; catch/duel cells128; interception cells384. The remaining deterministic tasks are one per tier, not repeated population samples. All11 physical attributes are held equal in coherent technical comparisons.

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

These grades are qualitative engineering judgments, not pass/fail thresholds. GOOD_ENOUGH retains scoped existing behavior; TARGETED_FIX identifies bounded follow-up work; DEDICATED_PHASE identifies broader domain work. No coefficients or outcome targets were changed. Full follow-up scope, real-roster results and sampling/gating limits are in the [scorecard](DIFFERENTIATION-SCORECARD.md). `method.quantitativeEvidence` and `quantitativeFindings` in the JSON retain the receipt identity and actual values.
