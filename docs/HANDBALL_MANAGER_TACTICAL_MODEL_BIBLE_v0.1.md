# HANDBALL MANAGER — TACTICAL MODEL BIBLE v0.1

**Document Type:** Domain Specification  
**Status:** Draft / Design Source of Truth  
**Version:** 0.1  
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

# 17. Next Design Work

## HM-TACTICS-0.2 — First Attacking Interaction Model

Purpose:

Create the first attacking model capable of interacting meaningfully with the 6:0 Decision Model.

Conceptual sequence:

**Utforska → Ställ frågor → Läs respons → Exploatera**

Only after at least one attacking interaction is defined should the Tactical Matchup Engine be specified in code.

---

# 18. Status

**6:0 Decision Model v0.1:** DESIGN DEFINED  
**TI-001:** DEFINED  
**TI-002:** DEFINED  
**TI-003:** DEFINED  
**Attacking model:** NOT YET DEFINED  
**Tactical Matchup Engine:** NOT YET IMPLEMENTABLE  
**Code implementation:** PAUSED pending attacking model design
