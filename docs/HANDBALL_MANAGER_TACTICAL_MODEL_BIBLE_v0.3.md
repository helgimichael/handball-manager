# HANDBALL MANAGER — TACTICAL MODEL BIBLE v0.3

**Document Type:** Domain Specification  
**Status:** Draft / Design Source of Truth  
**Version:** 0.3  
**Owner:** Handball Manager Tactical Design  
**Purpose:** Prevent implementation drift and ensure Claude/Codex implements the agreed tactical model rather than inventing alternative terminology, concepts or abstractions.

---

# 1. Governing Principle

Handball Manager tactics must model **handball behaviour and collective decision logic**, not generic football-manager sliders or isolated player instructions.

The tactical model is built from the handball domain upward:

**Playing Model → Game Phase → Organisation → Principles → Working Rules → Relationships → Player Requirements → Tactical Outcomes → Trade-offs → Counters**

The implementation must not introduce new tactical concepts, names, categories or abstractions unless they are first added to this document.

---

# 2. Core Design Rules

## 2.1 Formation is organisation, not playing style

A formation describes the team's basic organisation.

Examples in set defence:
- 6:0
- 5:1
- 3:2:1
- 3:3

A formation does **not** define whether the team is aggressive, passive, compact, proactive, reactive, high or low.

Two teams can both use 6:0 and defend in fundamentally different ways.

## 2.2 Principles describe intentions

A principle describes what the team is trying to achieve.

Examples:
- Ta initiativ
- Hålla laget kompakt
- Positionera sig för att kunna hantera mer än ett hot
- Hjälpa spelaren bredvid
- Få träff och stoppa spelet
- Styra mot svåra passningar och pressade avslut

## 2.3 Working Rules connect situations to responses

A Working Rule expresses:

> **When X happens → we try to do Y**

Example:

> When H2 steps against V9, H3 secures the changed space/relationship behind H2.

## 2.4 Relationships are first-class tactical objects

Initial 6:0 relations:
- H1 ↔ H2
- H2 ↔ H3
- H3 ↔ V3
- V3 ↔ V2
- V2 ↔ V1

Defender-to-attacker relations:
- H1 ↔ V6
- H2 ↔ V9
- H3 ↔ M6
- H3/V3 ↔ M9
- V2 ↔ H9
- V1 ↔ H6

## 2.5 Every tactical choice must create a trade-off

No tactical principle may function as a pure bonus.

## 2.6 Tactics should change situation probabilities

Do not implement simple modifiers such as:

`aggressive_defense = +5 defense`

Instead, tactical choices should alter the probability distribution of handball situations and outcomes.

## 2.7 Fast Match Engine and Detailed SIM share tactical language

Fast Match Engine may resolve tactical triggers probabilistically.

Detailed SIM may derive the same trigger from positions, movement, ball state and timing.

The tactical model itself must remain engine-independent.

---

# 3. Tactical Domain Objects

## 3.1 Formation

Describes basic organisation.

Example:

```text
Formation
id: DEF_6_0
phase: SET_DEFENSE
positions:
  H1
  H2
  H3
  V3
  V2
  V1
```

## 3.2 Principle

Initial 6:0 defensive principles:

### P-DEF-01 — Ta initiativ
Influence the attacker's available solutions before the attacker has full control of the situation.

### P-DEF-02 — Kompakthet
Maintain useful collective distances and avoid large isolated spaces.

### P-DEF-03 — Hantera flera hot
Avoid locking onto one threat too early when multiple relevant threats exist.

### P-DEF-04 — Hjälp och säkring
Adapt individual behaviour to the action of adjacent teammates.

### P-DEF-05 — Få träff och stoppa
When stepping, do so with the intention of meaningfully affecting or stopping continued attacking action.

### P-DEF-06 — Styra mot sämre lösning
Influence the attack toward lower-value or more predictable solutions.

## 3.3 WorkingRule

Example:

```text
WorkingRule
id: WR_DEF_H2_H3_STEP_COVER

trigger:
  BALL_CARRIER_THREAT from V9 against H2 area

primaryActor:
  H2

primaryResponse:
  STEP_AND_INFLUENCE

supportingActor:
  H3

supportingResponse:
  SECURE_BEHIND_STEP

recovery:
  RESTORE_BASE_RELATIONSHIP when threat disappears
```

## 3.4 Trigger

Initial vocabulary:

```text
BALL_CARRIER_THREAT
DEFENDER_STEPS
PIVOT_BEHIND_PRESSURE
BALL_MOVED_LATERALLY
WING_ATTACKS_INSIDE
CENTRAL_THREAT
CENTRAL_DIRECTION_CHANGE
PIVOT_MOVEMENT
ADJACENT_DEFENDER_STEPS
FIRST_PRESSURE_BYPASSED
THREAT_DISAPPEARS
```

## 3.5 Relationship

```text
REL_H1_H2
REL_H2_H3
REL_H3_V3
REL_V3_V2
REL_V2_V1
```

Future relation state may contain:
- familiarity
- coordination
- role compatibility
- communication

## 3.6 PlayerRequirement

Examples for H2:
- recognise threat
- time intervention
- close space
- control contact
- recover

Examples for H3:
- recognise teammate action
- monitor pivot threat
- adjust position
- decide help depth
- take over threat
- recover

These are requirements, not the final attribute taxonomy.

## 3.7 Outcome

### Positive defensive outcomes

```text
STOP
FORCED_RESET
FORCED_LATERAL_PASS
PRESSURED_SHOT
LOW_VALUE_SHOT
PIVOT_DENIAL
TURNOVER_OPPORTUNITY
```

### Neutral outcomes

```text
CONTINUE_PLAY
REORGANISATION
```

### Negative defensive outcomes

```text
FIRST_DEFENDER_BEATEN
PIVOT_ACCESS
WING_ACCESS
CENTRAL_BREAKTHROUGH
NUMERICAL_ADVANTAGE_CREATED
HIGH_VALUE_SHOT
SEVEN_METER
SUSPENSION
DOUBLE_COMMIT
NO_COMMIT
FAILED_HANDOVER
```

## 3.8 TradeOff

Example: H2 early step.

May increase:
- STOP
- FORCED_RESET
- TURNOVER_OPPORTUNITY

May also increase exposure to:
- PIVOT_ACCESS
- FIRST_DEFENDER_BEATEN
- NUMERICAL_ADVANTAGE_CREATED

## 3.9 Counter

Example:

```text
Defense behaviour:
H2_EARLY_STEP

Potential counters:
PIVOT_BEHIND_STEP
ATTACK_SPACE_BEHIND
FAST_BALL_TRANSFER
CHANGE_DIRECTION_AFTER_COMMITMENT
```

## 3.10 TacticalFamiliarity

Possible future dimensions:

```text
formationFamiliarity
principleFamiliarity
workingRuleFamiliarity
relationshipFamiliarity
```

The final numerical scale is not locked.

---

# 4. Defensive Position Convention — Critical

This mapping is mandatory.

## Left attacking side
- V6 is primarily opposed by **H1**
- V9 is primarily opposed by **H2**
- central support is primarily **H3**

## Right attacking side
- H6 is primarily opposed by **V1**
- H9 is primarily opposed by **V2**
- central support is primarily **V3**

Therefore:

```text
H1 meets V6
H2 meets V9
H3 works centrally

V1 meets H6
V2 meets H9
V3 works centrally
```

Do not invert this convention.

---

# 5. Reference Formation — 6:0

```text
H1 — H2 — H3 — V3 — V2 — V1
```

The formation describes base organisation only.

---

# 6. TI-001 — H2 ↔ H3 against V9 + M6

Mirror:

**V2 ↔ V3 against H9 + M6**

Core problem:

When the 2-position defender steps to influence the 9m attacker, the movement may create a new space or relationship behind that defender.

```text
V9 establishes threat
        ↓
H2 evaluates threat
        ↓
H2 may step / influence
        ↓
new space/relation appears behind H2
        ↓
H3 reads V9 + M6 + H2
        ↓
H3 secures / takes over / holds
        ↓
collective outcome
        ↓
recovery when threat disappears
```

Positive outcomes:
- STOP
- FORCED_RESET
- FORCED_LATERAL_PASS
- TURNOVER_OPPORTUNITY
- PRESSURED_SHOT

Exposures:
- PIVOT_ACCESS
- FIRST_DEFENDER_BEATEN
- NUMERICAL_ADVANTAGE_CREATED
- HIGH_VALUE_SHOT
- SEVEN_METER
- SUSPENSION

Potential attacking counters:
- M6 behind the stepping defender
- attack space behind the step
- fast ball transfer beyond first pressure
- direction change after defensive commitment

---

# 7. TI-002 — H1 ↔ H2 against V6 + V9

Mirror:

**V1 ↔ V2 against H6 + H9**

Core problem:

The outside defender must control the wing threat while the 2-position defender balances wing support against responsibility for the 9m attacker.

Core situations:
1. Wing threat is low.
2. Wing establishes direct threat.
3. 9m attacker threatens the H1-H2 relationship.
4. H2 helps toward wing.
5. H2 holds against V9.
6. Wing attacks inside.
7. Ball returns from wing to 9m.

Potential behaviours:
- STYR UTÅT
- STÄNG INSIDA
- FÖRDRÖJ
- TA DUELLEN
- TIDIG HJÄLP FRÅN 2:A
- HÅLL 2:A HEMMA

Positive outcomes:
- LOW_VALUE_SHOT
- FORCED_RETURN_PASS
- STOP
- FORCED_RESET
- TURNOVER_OPPORTUNITY

Exposures:
- WING_ACCESS
- FIRST_DEFENDER_BEATEN
- V9_ACCESS
- NUMERICAL_ADVANTAGE_CREATED
- SEVEN_METER
- SUSPENSION

Core trade-off:

More help toward wing:
- reduces clean wing situations
- increases space/time for V9

Less help toward wing:
- protects V9 relation
- increases isolated H1 vs V6 situations

---

# 8. TI-003 — H3 ↔ V3 against M9 + M6

Core problem:

The central defenders must protect the central area while managing the ball threat in front of them and the M6 threat around/behind them.

```text
M9 establishes central threat
        ↓
primary 3-position takes responsibility
        ↓
secondary 3-position secures
        ↓
M6 movement changes the problem
        ↓
responsibilities may transfer
        ↓
collective outcome
        ↓
recovery / reorganisation
```

Important behaviours:
- primary defender engagement
- secondary central security
- M6 monitoring
- handover between H3 and V3
- adaptation when H2/V2 steps
- restoration after threat disappears

Positive outcomes:
- CENTRAL_STOP
- PIVOT_DENIAL
- FORCED_LATERAL_PASS
- PRESSURED_SHOT
- FORCED_RESET

Exposures:
- CENTRAL_BREAKTHROUGH
- PIVOT_ACCESS
- DOUBLE_COMMIT
- NO_COMMIT
- FAILED_HANDOVER
- NUMERICAL_ADVANTAGE_CREATED
- HIGH_VALUE_SHOT
- SEVEN_METER
- SUSPENSION

---

# 9. Interaction Network

```text
H1 ↔ H2 ↔ H3 ↔ V3 ↔ V2 ↔ V1
```

Actions can propagate through the network.

Example:

```text
H2 steps
  ↓
H3 secures
  ↓
central relationship changes
  ↓
V3 adapts
  ↓
V3-V2 relationship may change
```

Do not implement six isolated defender instructions.

---

# 10. 6:0 Decision Loop

```text
DETECT THREAT
      ↓
ALLOCATE PRIMARY RESPONSIBILITY
      ↓
CREATE SUPPORT / SECURITY
      ↓
MANAGE THE NEW THREAT CREATED BY THE RESPONSE
      ↓
TRANSFER RESPONSIBILITY IF REQUIRED
      ↓
CREATE TACTICAL OUTCOME
      ↓
RESTORE / REORGANISE WHEN THE THREAT CHANGES
```

---

# 11. Manager Gameplay Intent

The manager should eventually influence:
- principles
- working-rule preferences
- thresholds for proactive/reactive behaviour
- help priorities
- central priorities
- wing priorities
- acceptable shot types
- risk appetite
- tactical familiarity through training

These choices must alter trade-offs rather than create simple additive bonuses.

---

# 12. Scouting / Matchup Intent

Opponent scouting should identify tendencies such as:
- 2-position steps early
- central defenders secure early
- outside defenders close inside
- wing help arrives early
- first pressure often creates space behind

The future Tactical Matchup Engine resolves:

```text
our attacking principles
×
opponent defensive principles
×
player capabilities
×
relationship quality
×
tactical familiarity
×
match context
```

into changes in situation/outcome probabilities.

---

# 13. Fast Match Engine Boundary

Fast Match Engine consumes tactical meaning at interaction/outcome level, not exact coordinates.

The exact probability model is future work.

---

# 14. Detailed SIM Boundary

Detailed SIM may implement the same tactical language using:
- player positions
- velocity
- facing
- ball state
- threat state
- gap state
- timing
- defensive policy

SIM must map physical state into the same domain Triggers and Working Rules rather than create a competing tactical vocabulary.

---

# 15. Explicitly Not Approved Yet

Not locked in v0.1:
- final attacking model
- final Playing Style names
- final player attribute taxonomy
- final tactical slider names
- numerical tactical modifiers
- exact probability equations
- final UI
- final tactical familiarity scale
- final training effects
- final AI-manager logic
- exact shot-value model
- complete 5:1 / 3:2:1 / 3:3 models

Claude must not treat temporary examples as approved permanent terminology.

---

# 16. Implementation Rules for Claude / Codex

Before implementing tactics:

1. Read this document in full.
2. Do not invent new tactical terminology when an existing term covers the concept.
3. Do not rename H1/H2/H3/V3/V2/V1 mappings.
4. Do not replace principle/working-rule logic with generic sliders.
5. Do not implement 6:0 as six isolated defender instructions.
6. Do not hardcode tactical knowledge inside React components.
7. Do not bind domain objects to FIELD rendering coordinates.
8. Do not bind tactical domain objects directly to Fast Match Engine internals.
9. Preserve trade-offs.
10. Preserve mirrored left/right logic.
11. Ask for a design decision if implementation requires a tactical concept not defined here.
12. Do not implement the attacking Tactical Model until its design has been approved separately.

---

---

# 17. Attacking Model — Governing Logic

The first approved attacking decision loop is:

**UTFORSKA → STÄLL FRÅGA → LÄS RESPONS → EXPLOATERA → FORTSÄTT/ÅTERSTÄLL**

These are tactical functions, not a fixed passing sequence.

## 17.1 UTFORSKA

The attack creates information while preserving relevant options.

The purpose is not necessarily to finish the attack immediately. The attack may seek to reveal how the defence organises itself when a credible threat appears.

## 17.2 STÄLL FRÅGA

The attack creates a credible problem that requires a defensive decision.

An attacking action is therefore understood as a tactical question.

## 17.3 LÄS RESPONS

The attack observes how the defence solved or attempted to solve the problem.

The continuation must depend on the observed response rather than a pre-scripted next action.

## 17.4 EXPLOATERA

The attack selects a solution that attacks the opportunity created by the defensive response.

## 17.5 FORTSÄTT / ÅTERSTÄLL

If no relevant advantage exists, the attack must be able to continue play or reset.

The engine must not force a shot or final action merely because an attacking interaction has begun.

---

# 18. Attacking Principles — Initial Functional Set

The final names/IDs are not yet permanently locked, but the following functions are approved for ATI-001:

## 18.1 Create credible threat

An attacking movement must become sufficiently relevant that the defence has to make a decision.

## 18.2 Manipulate relationships

The attack targets relationships between defenders, not only isolated defenders.

## 18.3 Preserve multiple solutions

The ball carrier should preserve several credible solutions for as long as the situation allows.

## 18.4 Exploit response

The selected continuation should depend on the defensive response.

## 18.5 Continue when no advantage exists

The attack must not force a low-quality solution when the tactical question produced no meaningful advantage.

---

# 19. ATI-001 — Provoke 2nd Defender / Exploit Response

## 19.1 Scope

**Primary attacking relationship:** `V9 ↔ M6`

**Target defensive relationship:** `H2 ↔ H3`

**Defensive counterpart:** `TI-001`

Mirror:

**H9 ↔ M6** against **V2 ↔ V3**

ATI-001 is a logical tactical interaction. It is not a named play start and not a fixed animation.

## 19.2 Intention

Create a credible V9 threat that forces H2/H3 to reveal how they intend to solve the situation, read their response, and attack the new opportunity created by that response.

## 19.3 Explore phase

### V9

V9 seeks a situation where multiple solutions remain credible:

- own breakthrough
- shot
- M6
- ball transfer
- continuation/reset

### M6

M6 positions and acts so H3 cannot trivially control both the V9 threat and M6 threat.

A high-quality V9–M6 relationship should create a defensive dilemma.

## 19.4 Primary Trigger

### `CREDIBLE_9M_THREAT`

V9 has established a threat that requires a defensive decision.

The Tactical Domain must not define this trigger through renderer coordinates.

Fast Match Engine may model it probabilistically.

Detailed SIM may derive it from physical state.

## 19.5 Primary attacking Working Rule

When V9 can establish a credible threat against H2, V9 should preserve multiple relevant solutions long enough to read H2's response before committing to exploitation.

## 19.6 First defensive response vocabulary

Initial ATI-001 observation vocabulary:

```text
H2_HOLDS
H2_DELAYS
H2_STEERS
H2_STEPS
H2_STOPS
```

The response is not reduced to a Boolean `steps / does not step`.

---

# 20. ATI-001 Response Logic

## 20.1 H2 holds

If H2 holds, ATI-001 evaluates whether V9 still has a meaningful advantage.

If yes, possible continuation includes:

```text
9M_ATTACK_CONTINUES
BREAKTHROUGH_OPPORTUNITY
SHOT_OPPORTUNITY
```

If no meaningful advantage exists:

```text
CONTINUE_PLAY
RESET_ATTACK
```

## 20.2 H2 steps

When H2 steps, the attack must read H3 before choosing exploitation.

Initial H3 response vocabulary:

```text
H3_HOLDS
H3_SECURES
H3_TAKES_OVER
H3_OVERHELPS
H3_LATE
```

## 20.3 H2 steps + H3 holds

The attack evaluates whether the space/relationship behind H2 is actually exploitable.

M6 availability is not automatic.

Possible state:

```text
PIVOT_AVAILABLE_BEHIND_STEP
```

If the opportunity exists, ATI-001 may create:

```text
PIVOT_ACCESS
BREAKTHROUGH_ACCESS
```

If M6 has not created a useful option, the attack must retain alternative continuations.

## 20.4 H2 steps + H3 secures

The first option may be closed, but H3's security action changes another defensive relationship.

ATI-001 must therefore be able to produce a transition toward another Tactical Interaction instead of treating the attack as failed.

Conceptually:

```text
H2_STEPS
   ↓
H3_SECURES
   ↓
first option closed
   ↓
RELATIONSHIP_CHANGED
   ↓
NEXT_INTERACTION_AVAILABLE
```

## 20.5 Overhelp / double commitment

If the defensive response binds more defenders than necessary, the attack should be able to transfer the problem to the newly exposed relationship.

Fast ball transfer is a relevant exploitation behaviour.

---

# 21. Tactical Interaction Chaining

Tactical Interactions are allowed to create another Tactical Interaction rather than a final shot.

This is a core architecture rule.

Example:

```text
ATI-001
V9 provokes H2
        ↓
H2 steps
        ↓
H3 secures
        ↓
central relationship changes
        ↓
NEXT_INTERACTION_AVAILABLE
        ↓
future central attacking interaction
```

This is how Handball Manager should represent structured attacking play without scripting complete move sequences.

A play start may create the conditions for ATI-001, but the defensive response determines which interaction becomes relevant next.

---

# 22. ATI-001 — M6 Working Rules

## WR-ATT-M6-01 — Create value behind step

When H2 begins leaving the base organisation:

> M6 seeks a position or action that makes the space/relationship behind H2 tactically relevant.

## WR-ATT-M6-02 — Influence H3 security

When H3 secures behind H2:

> M6 attempts to affect H3's ability to control both M6 and the next central threat.

## WR-ATT-M6-03 — Create value without receiving the ball

When direct M6 advantage is unavailable:

> M6 should preserve or create value for the next interaction rather than automatically demand the ball.

M6 tactical value must not be measured only by receptions or shots.

---

# 23. ATI-001 — V9 Working Rules

## WR-ATT-V9-01 — Establish threat

Create a credible threat before committing to a solution.

## WR-ATT-V9-02 — Preserve options

Maintain multiple relevant solutions while the situation permits.

## WR-ATT-V9-03 — Read first defender

Identify H2's response.

## WR-ATT-V9-04 — Read support

If H2 leaves the base organisation, identify H3's response.

## WR-ATT-V9-05 — Exploit response

Choose a continuation that attacks the opportunity created by the defensive response.

## WR-ATT-V9-06 — Do not force

If no relevant advantage exists:

> continue play or reset rather than force a low-quality solution.

---

# 24. Shared Tactical Outcome Language

Attack and defence should not maintain competing outcome vocabularies for the same situation.

Where possible, outcomes describe the handball state neutrally and are valued from each team's perspective.

ATI-001 may produce:

```text
NO_ADVANTAGE
CONTINUE_PLAY
RESET_ATTACK

DEFENDER_COMMITTED
SUPPORT_DEFENDER_COMMITTED
RELATIONSHIP_CHANGED
NEXT_INTERACTION_AVAILABLE

PIVOT_ACCESS
BREAKTHROUGH_ACCESS
SHOT_ACCESS
CENTRAL_ACCESS
NUMERICAL_ADVANTAGE_CREATED

PRESSURED_SOLUTION
HIGH_VALUE_SHOT
SEVEN_METER
SUSPENSION_DRAWN

TURNOVER
```

Example:

`PIVOT_ACCESS` is favourable to the attack and unfavourable to the defence, but it is the same observed tactical outcome.

Tactical outcome remains separate from final match outcome.

---

# 25. ATI-001 Trade-offs

## 25.1 More aggressive exploitation

Attempting to exploit smaller/shorter opportunity windows may increase:

```text
BREAKTHROUGH_ACCESS
PIVOT_ACCESS
HIGH_VALUE_SHOT
```

while also increasing:

```text
TURNOVER
PRESSURED_SOLUTION
```

## 25.2 More patience

Requiring a clearer advantage before exploitation may improve final opportunity quality, but can:

- allow the defence to reorganise
- reduce exploitation of short opportunity windows
- increase CONTINUE_PLAY / RESET_ATTACK outcomes

No attacking preference may be implemented as a pure bonus.

---

# 26. Defensive Counters to ATI-001

The defensive TI-001 model can counter ATI-001 through behaviours such as:

## Controlled step

H2 influences V9 while limiting the space created behind the step.

## Early H3 security

H3 closes the immediate M6/behind-step option early.

## Late but effective security

H3 delays revealing the support response while still securing the relevant threat.

## Steering

H2 attempts to make selected attacking solutions more likely instead of treating every situation as a direct stop attempt.

Counters alter tactical relevance and probability; they do not guarantee success.

---

# 27. ATI-001 Player Requirements

These are capability requirements, not final approved player attributes.

## V9

- create credible threat
- preserve multiple solutions
- read H2
- read H3
- read M6
- time exploitation
- execute selected solution
- reject a poor solution

## M6

- read H2 action
- read H3 security
- create position behind pressure
- create passing line
- influence H3
- time movement
- create value without the ball

## V9 ↔ M6 relationship

- timing
- shared situational understanding
- coordination
- familiarity

---

# 28. ATI-001 Decision Loop

```text
UTFORSKA
V9/M6 create multiple credible threats
        ↓
STÄLL FRÅGA
V9 establishes CREDIBLE_9M_THREAT
        ↓
LÄS H2
        │
   ┌────┴─────┐
   ↓          ↓
 HÅLLER      KLIVER
   │          │
   ↓          ↓
continue     LÄS H3
threat        │
         ┌────┼─────────┐
         ↓    ↓         ↓
       holds secures  overhelps
         │    │         │
         ↓    ↓         ↓
       M6/   next      transfer
       space relation  problem
         │    │         │
         └────┼─────────┘
              ↓
          EXPLOATERA
              ↓
       meaningful advantage?
          │           │
         YES          NO
          ↓           ↓
      next action   CONTINUE/
                    RESET
```

---

# 29. First Approved Attack-vs-Defense Matchup

The first approved tactical matchup is:

**ATI-001 — V9/M6 provoke and exploit H2/H3**

versus

**TI-001 — H2/H3 solve the V9/M6 threat through primary pressure and support/security**

The matchup has no predetermined winner.

Future resolution must account for:

```text
attacking principles
×
defensive principles
×
V9 capability
×
M6 capability
×
H2 capability
×
H3 capability
×
V9-M6 relationship
×
H2-H3 relationship
×
tactical familiarity
×
match context
```

This is the first valid foundation for the future Tactical Matchup Engine.

---

# 30. Play Start Boundary

A Play Start is not a Tactical Interaction and not a fixed full attack script.

A Play Start is a structured way of creating conditions in which one or more Tactical Interactions become likely.

Example purpose:

> Provoke the H2-H3 relationship.

A Play Start may initiate ATI-001, but it must not predetermine the complete continuation.

The defensive response determines which subsequent Tactical Interaction becomes relevant.

---

# 31. Updated Implementation Rules for Claude / Codex

Before implementing tactical code:

1. Read this document in full.
2. Treat this document as the tactical Design Source of Truth.
3. Do not invent new tactical terminology when an approved concept already exists.
4. Preserve the defensive position convention exactly.
5. Preserve mirrored left/right logic.
6. Do not reduce tactics to additive team-rating bonuses.
7. Do not implement 6:0 as six isolated defender instructions.
8. Do not implement ATI-001 as a fixed passing animation.
9. Do not make M6 a passive reception target.
10. Preserve `UTFORSKA → STÄLL FRÅGA → LÄS RESPONS → EXPLOATERA → FORTSÄTT/ÅTERSTÄLL`.
11. Preserve the ability to return `NO_ADVANTAGE`, `CONTINUE_PLAY`, or `RESET_ATTACK`.
12. Preserve Tactical Interaction chaining through `RELATIONSHIP_CHANGED` / `NEXT_INTERACTION_AVAILABLE`.
13. Keep tactical outcomes separate from final shot/match outcomes.
14. Keep Tactical Domain independent of FIELD coordinates.
15. Keep Tactical Domain independent of Fast Match Engine implementation details.
16. SIM and Fast Match Engine must consume the same tactical vocabulary rather than creating separate tactical models.
17. Do not invent final player attributes from PlayerRequirement examples.
18. Do not implement final numerical matchup formulas until Tactical Matchup Engine v0.1 is separately approved.
19. Do not invent final Playing Style names.
20. If implementation requires an undefined handball concept, stop and request a design decision rather than silently inventing one.

---

# 32. Explicitly Not Approved Yet

Still not locked in v0.2:

- additional attacking Tactical Interactions beyond ATI-001
- final Playing Style names
- final player attribute taxonomy
- final tactical UI
- final tactical slider/control names
- final numerical matchup formula
- final probability weights
- final Tactical Familiarity scale
- complete Play Start library
- goalkeeper tactical model
- complete 5:1 / 3:2:1 / 3:3 models
- AI-manager tactical decision logic
- full attacking model for all positions/relationships

---

---

# 33. Tactical Matchup Engine v0.1 — Governing Principle

The Tactical Matchup Engine must not decide which team is simply "better".

It resolves whether players and relationships can:

1. create the tactical problem,
2. choose the intended response,
3. execute that response,
4. solve the situation collectively,
5. recognise any opportunity created,
6. exploit that opportunity.

The first approved resolution pipeline is:

```text
CREATE THE PROBLEM
        ↓
CHOOSE RESPONSE
        ↓
EXECUTE RESPONSE
        ↓
SOLVE COLLECTIVELY
        ↓
RECOGNISE OPPORTUNITY
        ↓
EXPLOIT OPPORTUNITY
        ↓
TACTICAL OUTCOME
```

This pipeline is the first approved resolver structure for `ATI-001 × TI-001`.

---

# 34. Gate 1 — Create the Problem

ATI-001 does not activate successfully merely because V9 possesses the ball.

The attack must establish:

```text
CREDIBLE_9M_THREAT
```

Whether this succeeds may later depend on:

- relevant V9 capabilities,
- V9–M6 relationship quality,
- attacking tactical familiarity,
- defensive readiness,
- pressure,
- fatigue,
- match context.

If the attack cannot create the problem, valid outcomes include:

```text
NO_ADVANTAGE
CONTINUE_PLAY
RESET_ATTACK
```

The defence does not need to reveal a deeper response when the initial tactical problem was never credibly created.

---

# 35. Gate 2 — Choose Response

Once a credible tactical problem exists, the defensive response is primarily shaped by:

- defensive principles,
- Working Rules,
- manager tactical preferences,
- tactical familiarity,
- current situation/context.

The tactic defines what the player attempts to do.

It does **not** guarantee successful execution.

For ATI-001 × TI-001, possible H2 responses include:

```text
H2_HOLDS
H2_DELAYS
H2_STEERS
H2_STEPS
H2_STOPS
```

Do not make response selection a generic random choice detached from the tactical model.

---

# 36. Gate 3 — Execute Response

Once the intended response is known, the engine evaluates how well the player can perform that specific task in the current situation.

The engine must not substitute a generic overall player rating.

Conceptual interface:

```text
ExecutionQuality(
  player,
  workingRule,
  situation
)
```

For an H2 step, relevant requirements currently include:

```text
recognise threat
time intervention
close space
control contact
recover
```

The final player attributes used to produce this assessment remain unapproved.

---

# 37. ExecutionAssessment

`ExecutionAssessment` is a situation-level assessment, not a permanent player attribute.

Conceptual structure:

```text
ExecutionAssessment

actor:
  H2

task:
  H2_STEP_AND_INFLUENCE

requirements:
  threatRecognition
  timing
  closingAbility
  contactControl
  recovery

context:
  fatigue
  currentForm
  familiarity
  opponentPressure

quality:
  future calibrated value/category
```

The engine should retain enough information to explain why execution quality was high or low.

---

# 38. Gate 4 — Solve Collectively

Individual execution does not resolve a collective handball situation by itself.

Example:

```text
H2_STEPS
    ↓
ADJACENT_DEFENDER_STEPS
    ↓
H3 must interpret and respond
```

The collective solution may depend on:

- H3 execution,
- H2–H3 relationship,
- Working Rule familiarity,
- timing,
- communication/coordination,
- contextual pressure.

Possible collective responses include:

```text
H3_SECURES
H3_TAKES_OVER
H3_HOLDS
H3_LATE
H3_OVERHELPS
DOUBLE_COMMIT
FAILED_HANDOVER
```

---

# 39. RelationshipAssessment

`RelationshipAssessment` evaluates the relevant collective relationship in the current tactical task.

Conceptual structure:

```text
RelationshipAssessment

relationship:
  H2_H3

workingRule:
  WR_DEF_H2_H3_STEP_COVER

factors:
  familiarity
  coordination
  communication
  roleCompatibility

context:
  currentSituation

quality:
  future calibrated value/category
```

The exact permanent relationship attributes and numerical scale remain unapproved.

---

# 40. TacticalOpportunity

A defensive response can create a tactical opportunity without the attack successfully using it.

This distinction is mandatory.

Conceptual structure:

```text
TacticalOpportunity

type:
  PIVOT_ACCESS

createdBy:
  H2_STEPS
  H3_LATE

targetRelationship:
  H2_H3

quality:
  HIGH

window:
  SHORT
```

A TacticalOpportunity means:

> a meaningful possibility exists.

It does **not** mean the attacking action has already succeeded.

---

# 41. OpportunityQuality

Initial conceptual quality vocabulary:

```text
LOW
MEDIUM
HIGH
CLEAR
```

This describes the quality of the opportunity itself.

The final scale/calibration is not locked in v0.3.

---

# 42. OpportunityWindow

Initial conceptual opportunity-window vocabulary:

```text
SHORT
MEDIUM
SUSTAINED
```

A high-quality opportunity with a SHORT window may still be difficult to exploit.

A medium-quality opportunity with a SUSTAINED window may be easier to recognise and use.

Fast Match Engine may represent the window abstractly.

Detailed SIM may later derive the window from actual time and physical state.

---

# 43. Gate 5 — Recognise Opportunity

The existence of an opportunity does not guarantee that the attack recognises it.

For ATI-001, recognition may depend on:

- V9 PlayerRequirements,
- M6 PlayerRequirements,
- V9–M6 relationship,
- attacking tactical familiarity,
- opportunity quality,
- opportunity window,
- pressure,
- fatigue,
- match context.

A manager can therefore identify the correct tactical weakness while the players still fail to exploit it.

This distinction is a core gameplay requirement.

---

# 44. Gate 6 — Exploit Opportunity

After an opportunity is recognised, the attack must execute an appropriate action.

Example:

```text
Opportunity:
PIVOT_ACCESS / HIGH / SHORT

Recognition:
SUCCESSFUL

Action:
V9 attempts pivot pass

Execution:
POOR

Outcome:
TURNOVER
```

Another example:

```text
Opportunity:
PIVOT_ACCESS / HIGH / SHORT

Recognition:
LATE

Defense:
H3 recovers

Outcome:
PRESSURED_SOLUTION
```

Opportunity creation, decision and execution must remain separate.

---

# 45. Opportunity → Action → Outcome Separation

This separation is mandatory:

## A. Opportunity

What the tactical interaction made available.

## B. Action

What the player attempted.

## C. Outcome

What actually happened tactically.

Example:

```text
Opportunity:
PIVOT_ACCESS

Action:
PIVOT_PASS

Outcome:
TURNOVER
```

The tactical idea may therefore be correct even when the execution fails.

Likewise, a poor tactical decision may occasionally produce a positive final result.

The engine must not evaluate tactical quality solely from the final score/result.

---

# 46. DecisionQuality

`DecisionQuality` is a situation-level analytical assessment.

It is not currently an approved permanent player attribute.

Conceptual examples:

```text
DecisionQuality:
GOOD

ExecutionQuality:
POOR

TacticalOutcome:
TURNOVER
```

and:

```text
DecisionQuality:
POOR

ExecutionQuality:
EXCELLENT

FinalResult:
GOAL
```

This allows tactical analysis to separate:

- quality of opportunity,
- quality of decision,
- quality of execution,
- final result.

---

# 47. Outcome Distribution

The resolver must operate on distributions of possible tactical outcomes rather than a single attack-vs-defence rating.

Conceptually:

```text
BASE SITUATION DISTRIBUTION
        ↓
TACTICAL INTENT
        ↓
PLAYER EXECUTION
        ↓
COLLECTIVE COORDINATION
        ↓
TACTICAL OPPORTUNITY
        ↓
OPPORTUNITY RECOGNITION
        ↓
EXPLOITATION EXECUTION
        ↓
TACTICAL OUTCOME DISTRIBUTION
```

Example outcome names may include:

```text
NO_ADVANTAGE
CONTINUE_PLAY
FORCED_RESET
PIVOT_ACCESS
BREAKTHROUGH_ACCESS
PRESSURED_SOLUTION
TURNOVER
NEXT_INTERACTION_AVAILABLE
```

Exact baseline percentages are **not approved** in v0.3.

---

# 48. ProbabilityModifier

Every adjustment to an outcome distribution must be attributable to a named source and reason.

Conceptual structure:

```text
ProbabilityModifier

source:
  H3_LATE

reason:
  Late central security increases access behind H2

affects:
  PIVOT_ACCESS      increase
  FORCED_RESET      decrease
  CONTINUE_PLAY     decrease
```

Future implementations may use numerical magnitudes, but v0.3 does not approve any final numbers.

The required properties are:

- source,
- reason,
- affected outcomes,
- direction,
- future calibrated magnitude.

Do not create opaque hidden bonuses that cannot be traced back to tactical causes.

---

# 49. Probability Resolution Rule

A future numerical implementation may conceptually follow:

```text
base distribution
  ↓
apply tactical modifiers
  ↓
apply execution modifiers
  ↓
apply relationship modifiers
  ↓
apply opportunity modifiers
  ↓
normalise distribution
  ↓
sample tactical outcome
```

This is a conceptual pipeline, not approval of a specific mathematical formula.

Explicitly prohibited as the core resolver:

```text
attackRating = 14
defenseRating = 12
successChance = attackRating / (attackRating + defenseRating)
```

The tactical model must not collapse into a single aggregate contest.

---

# 50. Explainability Requirement

Every important tactical resolution must be explainable from its trace.

The system should be capable of explaining statements such as:

> H2 identified the threat correctly and stepped effectively, but H3's late security created pivot access.

or:

> The attack created a high-quality pivot opportunity but V9 recognised it too late and the defence recovered.

or:

> The tactical decision was appropriate, but execution produced a turnover.

Explainability is a core domain requirement, not an optional UI feature.

---

# 51. ResolutionTrace

A detailed tactical resolution may record:

```text
ResolutionTrace

interaction:
  ATI-001 × TI-001

trigger:
  CREDIBLE_9M_THREAT

steps:
  1. V9 created credible threat
  2. H2 selected STEP
  3. H2 execution = GOOD
  4. H3 security = LATE
  5. PIVOT_ACCESS opportunity created
  6. opportunity quality = HIGH
  7. opportunity window = SHORT
  8. V9 recognised opportunity
  9. M6 timing = GOOD
  10. exploitation execution resolved
  11. tactical outcome = PIVOT_ACCESS
```

The exact storage schema remains an implementation decision, provided the domain meaning and traceability are preserved.

---

# 52. Resolution Storage Modes

The engine should support at least two conceptual trace depths.

## 52.1 Summary Mode

Suitable for large-scale simulated matches.

Example aggregate output:

```text
H2_STEP events: 14
PIVOT_ACCESS opportunities created: 6
PIVOT_ACCESS opportunities exploited: 3
TURNOVERS from ATI-001: 2
```

## 52.2 Full Trace Mode

Suitable for:

- manager-controlled matches,
- detailed analysis,
- debugging,
- future SIGNAL integration,
- scouting analysis,
- training recommendations.

Full Trace Mode preserves the causal sequence behind individual tactical resolutions.

The final persistence strategy is not locked in v0.3.

---

# 53. Tactical Analytics Enabled by the Model

The architecture should eventually support analytics such as:

```text
Tactical Opportunities Created
------------------------------
Behind H2                 11
Central overload           7
Wing access                6

Exploitation
------------------------------
Successful                43%
Missed                    31%
Poor execution            18%
Defence recovered          8%
```

and defensive analysis such as:

```text
H2/H3 Defence
------------------------------
Threats faced              17
First pressure successful  11
Security successful         9
Late security               5
Pivot access conceded       4
```

These examples illustrate the intended analytical capability. The exact metrics are not yet locked.

---

# 54. Fast Match Engine Boundary — Updated

Fast Match Engine may use abstract or probabilistic versions of:

- Trigger,
- ExecutionAssessment,
- RelationshipAssessment,
- TacticalOpportunity,
- OpportunityWindow,
- DecisionQuality,
- Outcome Distribution.

It does not need physical coordinates.

The Fast Match Engine must preserve the same causal tactical vocabulary as the Detailed SIM.

---

# 55. Detailed SIM Boundary — Updated

Detailed SIM may derive:

- credible threats,
- timing,
- opportunity windows,
- pressure,
- space,
- movement,
- recovery,

from actual physical simulation.

It must map these physical observations into the shared Tactical Domain.

Detailed SIM must not create a competing tactical truth model.

---

# 56. Implementation Boundary for HM-TACTICS-0.3

The first implementation pass, when explicitly approved, should be deliberately narrow:

> Build the headless tactical domain model and one `ATI-001 × TI-001` resolver with tests.

It must NOT yet:

- modify tactical UI,
- connect to the career Fast Match Engine,
- replace existing SIM policy,
- redesign FIELD,
- implement final player attributes,
- invent additional Tactical Interactions,
- implement final calibrated probabilities,
- implement manager AI,
- implement goalkeeper tactics.

The purpose of the first implementation is to prove the architecture and causal trace.

---

# 57. Additional Implementation Rules for Claude / Codex

1. Read Tactical Model Bible v0.3 in full before implementation.
2. Treat v0.3 as the current tactical Design Source of Truth.
3. Preserve all terminology already approved in v0.1–v0.3.
4. Do not invent replacement abstractions for `TacticalOpportunity`, `OpportunityWindow`, `ProbabilityModifier`, `ExecutionAssessment`, `RelationshipAssessment`, `DecisionQuality`, or `ResolutionTrace`.
5. Do not collapse Opportunity, Action and Outcome into one object.
6. Do not equate final result with decision quality.
7. Do not use a single aggregate attack-vs-defence rating as the resolver.
8. Every probability modification must have a traceable source/reason.
9. Keep numerical values provisional unless separately approved.
10. Preserve ATI-001 × TI-001 as the only required matchup for the first resolver.
11. Keep the resolver headless and independent of React/FIELD.
12. Do not modify the copied SIM or FIELD cores merely to fit this model.
13. If existing code conflicts with this domain model, report the conflict before changing architecture.
14. Do not silently invent missing player attributes.
15. Do not silently invent additional tactical responses.
16. Tests must verify causal trace and domain behaviour, not only final sampled outcomes.
17. Deterministic testing must be possible even if production resolution later uses probability sampling.

---

# 58. Explicitly Not Approved Yet

Still not locked in v0.3:

- calibrated probability numbers,
- baseline outcome percentages,
- mathematical weighting formula,
- final player attribute taxonomy,
- final relationship attribute taxonomy,
- final Tactical Familiarity scale,
- additional ATI models,
- additional defensive interaction models,
- complete Playing Style taxonomy,
- final tactical UI,
- career Fast Match integration,
- manager AI,
- goalkeeper tactical behaviour,
- shot-resolution model,
- final analytics UI.

---

# 59. Next Implementation Milestone

## HM-TACTICS-0.4 — Headless Resolver Proof

When implementation is approved, the task is:

1. audit current `handball-manager` architecture read-only,
2. identify the clean package boundary for the Tactical Domain,
3. implement only the domain structures required by v0.3,
4. implement one deterministic/testable `ATI-001 × TI-001` resolver,
5. produce `ResolutionTrace`,
6. prove at least several distinct causal paths, including:
   - threat not created,
   - H2 holds,
   - H2 steps + H3 secures,
   - H2 steps + H3 late,
   - opportunity exists but is not recognised,
   - opportunity recognised but exploitation fails,
   - opportunity successfully exploited,
   - `NEXT_INTERACTION_AVAILABLE`,
7. preserve all existing engine tests and behaviour,
8. stop before UI/Fast Match integration.

---

# 60. Status

**Tactical Model Bible:** v0.3  
**6:0 Decision Model:** DESIGN DEFINED  
**TI-001 / TI-002 / TI-003:** DESIGN DEFINED  
**Attacking Decision Loop:** DESIGN DEFINED  
**ATI-001:** DESIGN DEFINED  
**First attack-vs-defense matchup:** DESIGN DEFINED  
**Matchup Resolution Pipeline:** DESIGN DEFINED  
**TacticalOpportunity:** DESIGN DEFINED  
**OpportunityWindow:** DESIGN DEFINED  
**ExecutionAssessment:** DESIGN DEFINED  
**RelationshipAssessment:** DESIGN DEFINED  
**DecisionQuality:** DESIGN DEFINED  
**ProbabilityModifier:** DESIGN DEFINED  
**ResolutionTrace:** DESIGN DEFINED  
**Transparent Probability Architecture:** DESIGN DEFINED  
**Calibrated numerical model:** NOT YET DEFINED  
**Headless resolver implementation:** READY FOR CONTROLLED PROOF  
**UI / Fast Match integration:** NOT APPROVED
