# HANDBALL MANAGER — CAREER RHYTHM SPEC v0.1

**Document Type:** Game Domain / Career Flow Specification  
**Status:** Draft / Design Source of Truth  
**Version:** 0.1  
**Owner:** Handball Manager Career Systems  
**Purpose:** Define how time, days, career events, inbox delivery and CONTINUE behaviour work in Handball Manager so implementation does not collapse into "jump to next match".

---

# 1. Governing Principle

`CONTINUE` does **not** mean "go to the next match".

It means:

> **Advance the game world until the next relevant moment when control should return to the manager.**

The career experience must have rhythm between matches.

Days should matter.

Information should arrive over time.

The manager should experience:

```text
TRAINING
↓
RECOVERY
↓
SCOUTING
↓
ANALYSIS
↓
PLAYER STATUS
↓
STAFF INFORMATION
↓
MATCH PREPARATION
↓
MATCH DAY
↓
POST-MATCH
↓
NEXT WEEK
```

The system should create the feeling of managing a club through time rather than navigating between isolated fixtures.

---

# 2. Core Architecture

Career Rhythm consists of five primary systems:

```text
CALENDAR
    ↓
WORLD SIMULATION
    ↓
CAREER EVENT GENERATOR
    ↓
INBOX / NOTIFICATION DELIVERY
    ↓
CONTINUE CONTROLLER
```

Responsibilities must remain separated.

## 2.1 Calendar

Owns:

- current date,
- fixture dates,
- scheduled career events,
- deadlines,
- season boundaries,
- future dated tasks.

The Calendar determines **when** things may happen.

It does not generate news text.

## 2.2 World Simulation

Advances the simulated world.

It processes:

- player availability,
- recovery,
- training,
- scouting progress,
- analysis progress,
- fixtures,
- tables,
- statistics,
- other world state.

## 2.3 Career Event Generator

Observes meaningful state changes and creates semantic Career Events.

Examples:

```text
player became available
→ PLAYER_STATUS_CHANGED

scouting assignment completed
→ SCOUT_REPORT_READY

opponent analysis completed
→ OPPONENT_REPORT_READY

manager fixture reached
→ MATCHDAY_READY
```

Career Events describe things that happened in the game world.

## 2.4 Inbox / Notification Delivery

Consumes Career Events and presents them to the manager.

Inbox does **not** invent world events independently.

## 2.5 Continue Controller

Determines whether world simulation should:

- keep advancing,
- stop and notify,
- stop because manager action is required.

---

# 3. Event Priority Model

All manager-facing Career Events have one of three priority levels.

## 3.1 INFORMATION

Useful information that does not require the manager to stop.

Examples:

- competition results,
- minor club news,
- ordinary training completed,
- general league update.

Default v0.1 behaviour:

> deliver to Inbox / feed, but Continue may keep advancing.

## 3.2 IMPORTANT

Information relevant enough that the manager should normally regain control.

Examples:

- training report,
- scouting report completed,
- opponent analysis completed,
- important player-status change,
- weekly staff report,
- match preparation ready.

Default v0.1 behaviour:

> deliver and stop Continue.

Future user preferences may allow some IMPORTANT events to become non-stopping.

## 3.3 ACTION_REQUIRED

The game must stop.

The manager must not accidentally advance past the event.

Examples:

- manager's match day,
- future transfer decision,
- future contract decision,
- future squad registration,
- future mandatory team selection,
- other explicit decisions.

Default:

> hard stop.

---

# 4. Initial Career Event Types v0.1

The first implementation should support the following semantic events.

## 4.1 TRAINING_COMPLETED

**Priority:** INFORMATION

Meaning:

A planned daily training activity has been processed.

This does not need a separate Inbox message every day.

It exists primarily as world/domain state and may feed summaries.

---

## 4.2 TRAINING_REPORT

**Priority:** IMPORTANT

Meaning:

A periodic report on training has become available.

Possible information:

- completed sessions,
- attendance,
- training focus,
- load summary,
- tactical familiarity development later,
- player notes.

v0.1 may use a simple template/report.

---

## 4.3 PLAYER_STATUS_CHANGED

**Priority:** IMPORTANT by default

Meaning:

A meaningful player availability state changed.

Examples:

- returned to full training,
- recovered from injury,
- became unavailable,
- suspension ended.

Deep link target:

```text
PLAYER_PROFILE
```

---

## 4.4 PLAYER_INJURED

**Priority:** IMPORTANT or ACTION_REQUIRED depending severity/future implementation

Meaning:

A player injury occurred.

v0.1 does not require a complex medical simulation.

Deep links may include:

```text
PLAYER_PROFILE
SQUAD
```

---

## 4.5 SCOUT_REPORT_READY

**Priority:** IMPORTANT

Meaning:

A player scouting assignment is complete.

Deep links:

```text
SCOUT_REPORT
PLAYER_PROFILE
SCOUTING
```

---

## 4.6 OPPONENT_REPORT_READY

**Priority:** IMPORTANT

Meaning:

An opponent-analysis task has completed.

Deep links:

```text
ANALYSIS_HUB
OPPONENT_ANALYSIS
MATCH_PREVIEW
```

The Analysis Hub itself may be implemented later.

The event architecture should allow these destinations without hardcoding screen content into the event generator.

---

## 4.7 MATCH_PREPARATION_READY

**Priority:** IMPORTANT

Meaning:

Match-preparation information is available for the next manager fixture.

Deep links:

```text
MATCH_PREVIEW
TACTICS
future ANALYSIS_HUB
```

---

## 4.8 MATCHDAY_READY

**Priority:** ACTION_REQUIRED

Meaning:

The current date contains an unsimulated manager-controlled fixture.

Mandatory rule:

> The manager's own fixture must not be automatically simulated past the manager by ordinary Continue behaviour.

Deep link:

```text
MATCH_PREVIEW / MATCH_DAY
```

---

## 4.9 MATCH_COMPLETED

**Priority:** ACTION_REQUIRED or IMPORTANT depending player flow

Meaning:

The manager-controlled fixture has completed and result/report state is available.

Deep links:

```text
MATCH_REPORT
SCHEDULE
COMPETITION
future ANALYSIS_HUB
```

---

## 4.10 COMPETITION_UPDATE

**Priority:** INFORMATION

Meaning:

Relevant competition state changed.

Examples:

- round completed,
- other league results processed,
- table recalculated,
- manager club changed position.

Deep link:

```text
COMPETITION
```

---

## 4.11 STAFF_REPORT

**Priority:** IMPORTANT

Meaning:

A periodic staff summary is available.

Possible v0.1 content:

- squad availability,
- recent training,
- next fixture,
- notable status changes.

Do not build a complex staff-AI system in v0.1.

---

## 4.12 CLUB_NEWS

**Priority:** INFORMATION

Meaning:

Generic relevant club/competition information.

This is a domain event category, not permission to generate meaningless filler.

Use sparingly.

---

# 5. Daily World Tick v0.1

Every processed calendar day follows the same conceptual order:

```text
START DAY
   ↓
1. DATE / CALENDAR
   ↓
2. PLAYER AVAILABILITY
   ↓
3. TRAINING / RECOVERY
   ↓
4. SCOUTING / ANALYSIS PROGRESS
   ↓
5. CLUB / COMPETITION WORLD
   ↓
6. FIXTURES
   ↓
7. TABLE / STATISTICS
   ↓
8. CAREER EVENT GENERATION
   ↓
9. INBOX DELIVERY
   ↓
10. CONTINUE STOP CHECK
```

The ordering is part of the v0.1 design.

---

# 6. Step 1 — Date / Calendar

At the start of a Daily World Tick:

- resolve the day being processed,
- identify fixtures scheduled for the day,
- identify scheduled tasks/reports/deadlines,
- identify relevant season/calendar context.

The simulation must know whether the date has already been processed.

---

# 7. Step 2 — Player Availability

Update player status that changes with time.

Possible v0.1 state:

- available,
- injured,
- recovering,
- suspended,
- unavailable.

Do not implement deep injury medicine in Career Rhythm v0.1.

The important requirement is that a meaningful state change can create:

```text
PLAYER_STATUS_CHANGED
PLAYER_INJURED
```

---

# 8. Step 3 — Training / Recovery

Process the club's activity for the day.

v0.1 may keep this simple.

Potential state effects:

- recovery,
- training completion,
- later Tactical Familiarity,
- later player development,
- later relationship development.

Daily training should not automatically produce a stopping Inbox item.

Periodic summaries may generate:

```text
TRAINING_REPORT
```

---

# 9. Step 4 — Scouting / Analysis Progress

Progress active scouting and analysis assignments.

Tasks may have:

- start date,
- progress,
- completion date,
- target entity.

When completed:

```text
SCOUT_REPORT_READY
OPPONENT_REPORT_READY
```

must be generated.

Do not hardcode "Tuesday = scouting report".

Reports are completed because the assignment reaches completion.

---

# 10. Step 5 — Club / Competition World

Advance relevant non-fixture world state.

v0.1 may remain deliberately shallow.

Potential responsibilities:

- competition context,
- AI club state needed by current features,
- scheduled news/events,
- later transfers/contracts/staff.

Do not attempt to build full Football Manager world simulation in this milestone.

---

# 11. Step 6 — Fixtures

Process fixtures scheduled for the current date.

## 11.1 Other clubs

AI fixtures due that day may be simulated by the existing Fast Match Engine.

## 11.2 Manager-controlled club

If IFK Tumba / the manager club has an unplayed fixture today:

```text
MATCHDAY_READY
```

must be created.

The fixture must not be silently auto-completed through ordinary Continue.

The player then enters the approved match flow.

---

# 12. Step 7 — Table / Statistics

Tables and statistics are derived from actually completed fixtures.

They are not independently generated.

After AI fixtures are completed:

- competition standings update,
- team stats update,
- player stats update where the existing engine supports them,
- form updates.

This may generate:

```text
COMPETITION_UPDATE
```

where relevant.

---

# 13. Step 8 — Career Event Generation

After world state has been processed, compare meaningful state transitions and generate semantic Career Events.

Career Events should contain enough structured context to understand:

- what happened,
- when,
- which entity/entities are involved,
- priority,
- destination/deep links,
- whether action is required.

The generator should not create UI components.

---

# 14. Career Event Shape

Conceptual domain shape:

```text
CareerEvent

id
type
date
priority

titleKey / semantic subject
summaryData

primaryEntity:
  entityType
  entityId

relatedEntities[]

destinations[]

requiresAction
resolved
createdAtGameDate
```

Exact TypeScript representation is an implementation detail.

Important rule:

> Store semantic data, not pre-rendered React UI.

Message text may be created by presentation/template logic.

---

# 15. Deep Link / Destination Model

Career Events and Inbox messages should be able to point to relevant game areas.

Conceptual destinations include:

```text
HOME
INBOX
PLAYER_PROFILE
SQUAD
TACTICS
TRAINING
SCHEDULE
MATCH_PREVIEW
MATCH_DAY
MATCH_REPORT
SCOUTING
SCOUT_REPORT
COMPETITION
CLUB
future ANALYSIS_HUB
future OPPONENT_ANALYSIS
```

A destination should include necessary entity IDs.

Example:

```text
destination:
  route: PLAYER_PROFILE
  playerId: player_123
```

Do not embed brittle HTML links in domain state.

---

# 16. Inbox Principle

Inbox is the presentation layer for relevant Career Events.

Inbox should answer:

> What changed in my club/world, why does it matter, and where can I inspect it?

Inbox must not become a disconnected collection of mock messages once real Career Events exist.

---

# 17. Inbox Message Behaviour

A message may expose:

- sender/category,
- title,
- date,
- summary,
- body,
- entity references,
- one or more actions/deep links,
- read/unread state,
- action-required state.

Examples:

```text
ASSISTANT MANAGER

Match preparation: Skånela

[OPEN MATCH PREVIEW]
[OPEN TACTICS]
```

or:

```text
SCOUTING

New scouting report completed: Player X

[OPEN REPORT]
[OPEN PLAYER]
```

---

# 18. Continue Controller

The Continue Controller advances through unprocessed days until it hits a stop condition.

Conceptually:

```text
CONTINUE
   ↓
process next required day
   ↓
generate events
   ↓
check event priority
   ↓
ACTION_REQUIRED?
   ├── YES → STOP
   └── NO
        ↓
IMPORTANT?
   ├── YES → STOP in v0.1
   └── NO
        ↓
only INFORMATION / nothing
        ↓
continue advancing
```

This is the core Career Rhythm loop.

---

# 19. Continue Stop Rules v0.1

## Hard stop

Always stop for:

```text
ACTION_REQUIRED
MATCHDAY_READY
```

## Soft stop

In v0.1, also stop for:

```text
IMPORTANT
```

This helps make the career rhythm visible while the game has relatively few event types.

Future settings may allow managers to customise which IMPORTANT events stop Continue.

## No stop

Continue automatically through days containing only:

```text
INFORMATION
```

unless another stop condition exists.

---

# 20. The Same Day Must Never Be Simulated Twice

This is a hard rule.

If the game stops on 20 August because an IMPORTANT message arrived, navigating to:

- Squad,
- Tactics,
- Player Profile,
- Competition,

and returning to Continue must not repeat:

- 20 August training,
- 20 August scouting progress,
- 20 August AI fixtures,
- 20 August event generation.

The world tick for that day is complete.

---

# 21. Date State Model

At minimum distinguish:

## currentDate

The date currently presented to the manager.

## processedThroughDate

The latest date for which the Daily World Tick has fully completed.

These may be equal when the manager is stopped after a processed day.

The implementation may introduce additional explicit states if required, but it must preserve exactly-once day processing.

---

# 22. Event Resolution State

Stopping on a Career Event does not mean the world day is unprocessed.

Events therefore need state such as:

```text
resolved
read
actionRequired
```

A manager may inspect information without rerunning the day's world simulation.

For ACTION_REQUIRED events, Continue may remain blocked until the event's required action is resolved.

---

# 23. Matchday Rhythm

A manager fixture should feel like a special state in the calendar.

Example:

```text
FRIDAY
MATCH_PREPARATION_READY
→ stop
→ manager reviews

CONTINUE
        ↓

SATURDAY
MATCHDAY_READY
→ hard stop

MATCH PREVIEW
        ↓
MATCH DAY
        ↓
MATCH COMPLETED
        ↓
MATCH REPORT
        ↓
career resumes
```

Do not automatically skip directly from previous fixture to next fixture.

---

# 24. Example Career Week

Example only:

```text
MONDAY
Training / recovery
No important event
→ auto-continue

TUESDAY
Opponent analysis completed
→ OPPONENT_REPORT_READY
→ stop
→ Inbox

WEDNESDAY
Training
No important event
→ auto-continue

THURSDAY
Player returns to full training
→ PLAYER_STATUS_CHANGED
→ stop

FRIDAY
Match preparation completed
→ MATCH_PREPARATION_READY
→ stop

SATURDAY
Manager fixture
→ MATCHDAY_READY
→ hard stop

After match
→ MATCH_COMPLETED
→ match report / career state

SUNDAY
Recovery / competition updates
→ continue according to events
```

This is illustrative.

The implementation must be event-driven, not weekday-scripted.

---

# 25. Save / Load Requirements

Career Rhythm state must be persisted as domain state.

At minimum persist:

```text
currentDate
processedThroughDate
careerEvents
event read/resolution state
scheduled assignments/tasks needed by v0.1
fixture state
```

Save/load must not cause already processed days to run again.

---

# 26. Deterministic Resume

If the broader career simulation uses seeded deterministic systems, Career Rhythm must preserve deterministic continuation across save/load.

Example:

```text
simulate to 20 Aug
save
reload
continue
```

should behave consistently with:

```text
simulate continuously through the same period
```

where the existing simulation architecture supports determinism.

---

# 27. Event Idempotency

Career Event generation should be idempotent for a processed day.

The same semantic event must not be duplicated merely because:

- the user refreshes,
- visits another page,
- reloads the save,
- presses Continue again after stopping.

Use stable event IDs or another explicit deduplication strategy.

Exact implementation is technical, but behaviour is mandatory.

---

# 28. Career Rhythm vs Inbox

Important distinction:

```text
WORLD STATE CHANGE
        ↓
CAREER EVENT
        ↓
INBOX MESSAGE
```

Do not invert it into:

```text
INBOX decides something happened
```

This principle must remain stable as the game grows.

---

# 29. Career Rhythm vs Future Analysis Hub

Career Rhythm may generate events such as:

```text
OPPONENT_REPORT_READY
MATCH_COMPLETED
future MATCH_ANALYSIS_READY
```

The Analysis Hub will consume/display related domain data later.

Career Rhythm should not implement the Analysis Hub itself.

It only needs structured destinations and event semantics.

---

# 30. Career Rhythm vs Future Transfers / Contracts

Future systems may add events such as:

```text
TRANSFER_OFFER_RECEIVED
CONTRACT_DECISION_REQUIRED
REGISTRATION_DEADLINE
PLAYER_CONVERSATION_REQUIRED
```

These are not required in v0.1.

The priority/action architecture should make them possible later.

Do not implement speculative transfer/contract logic now.

---

# 31. Career Rhythm vs Training

v0.1 only needs enough Training integration for calendar rhythm and reports.

Future training may update:

- Tactical Familiarity,
- relationships,
- player development,
- fatigue/load.

Do not make Career Rhythm own those formulas.

Career Rhythm schedules/processes the daily activity; specialised systems own their domain effects.

---

# 32. Career Rhythm vs Fast Match Engine

Career Rhythm determines **when fixtures are due**.

Fast Match Engine determines **what happens in AI fixtures / current fast-match simulation**.

Career Rhythm must not implement match-result algorithms.

The manager's own match must respect MATCHDAY_READY stopping behaviour.

---

# 33. UI Scope for First Implementation

A first implementation may modify game UI only where needed to expose the new rhythm.

Likely areas:

- top-bar current date,
- CONTINUE behaviour,
- Inbox,
- Home current date/next event,
- Matchday transition.

Do not redesign the entire game shell.

The primary milestone is domain behaviour.

---

# 34. Minimum First-Implementation Proof

A valid HM-GAME-0.3 implementation should demonstrate:

1. Start from a known date.
2. Press CONTINUE.
3. One or more quiet days process automatically.
4. An IMPORTANT Career Event is reached.
5. Continue stops.
6. Inbox shows the event.
7. Event links to the relevant destination.
8. Visiting that destination does not rerun the day.
9. Continue resumes after the event.
10. Manager eventually reaches MATCHDAY_READY.
11. Matchday is not skipped.
12. Reload/save does not duplicate processed days/events.

---

# 35. Required Test Areas

At minimum:

## Calendar

- days advance in chronological order,
- next fixture date recognised,
- already processed day never runs twice.

## Event priority

- INFORMATION does not stop,
- IMPORTANT stops in v0.1,
- ACTION_REQUIRED hard-stops.

## Event generation

- correct state transition creates expected event,
- same processed transition does not create duplicates.

## Continue

- skips quiet days,
- stops at first stop-worthy event,
- does not skip MATCHDAY_READY,
- can resume after stopping.

## Inbox

- event produces appropriate message representation,
- deep-link metadata preserved,
- read/resolution state persists.

## Save/load

- currentDate persists,
- processedThroughDate persists,
- event state persists,
- resume does not rerun prior world ticks,
- resume does not duplicate events.

## Fixture integration

- AI fixtures may process on their scheduled day,
- manager fixture remains unplayed until manager enters match flow.

---

# 36. Explicit Non-Goals v0.1

Do NOT implement as part of Career Rhythm v0.1:

- full transfer system,
- full contract system,
- media simulation,
- press conferences,
- board politics,
- full medical simulation,
- full training engine,
- player conversations,
- complete scouting simulation,
- full Analysis Hub,
- new tactical resolver work,
- detailed 2D match engine,
- promotion/relegation,
- season rollover,
- every possible Football Manager event type.

The goal is a believable daily managerial rhythm, not complete career simulation.

---

# 37. Implementation Rules for Claude / Codex

1. Read this specification in full before implementation.
2. `CONTINUE` must not mean "next match".
3. Preserve exactly-once Daily World Tick processing.
4. Separate Calendar, World Simulation, Career Events, Inbox and Continue Controller responsibilities.
5. Inbox must consume events; it must not invent world changes.
6. Preserve INFORMATION / IMPORTANT / ACTION_REQUIRED.
7. MATCHDAY_READY must hard-stop.
8. Manager fixtures must not auto-simulate past the manager.
9. Do not hardcode reports to specific weekdays.
10. Do not create duplicated events after reload/navigation.
11. Persist currentDate and processedThroughDate.
12. Do not rerun a processed day when an event is unresolved.
13. Keep event payloads semantic and route/deep-link aware.
14. Do not store React components/HTML as career-domain state.
15. Reuse the existing Fast Match Engine for fixture results where appropriate; do not recreate match-result logic here.
16. Do not expand into Analysis Hub implementation.
17. Do not redesign the entire UI shell.
18. Preserve all existing engine/tactics baselines.
19. Ask for a design decision if a new career-event concept is required rather than silently inventing a major new system.
20. Keep v0.1 focused.

---

# 38. Future Roadmap Context

After Career Rhythm, the currently intended product direction is:

```text
HM-GAME-0.3
Career Rhythm

        ↓

HM-MATCH-0.1
CM-style Live Match

        ↓

HM-GAME-0.4
Inbox & Career Events expansion

        ↓

HM-ANALYSIS-0.1
Analysis Hub

        ↓

HM-UX-0.2
Navigation Consolidation

        ↓

HM-TACTICS-0.6
Tactical Domain → Fast Match Engine integration
```

This order may be revisited through product review, but Career Rhythm should not pre-implement later milestones.

---

# 39. Status

**Career Rhythm architecture:** DESIGN DEFINED  
**CONTINUE semantics:** DESIGN DEFINED  
**Daily World Tick:** DESIGN DEFINED  
**Event priority model:** DESIGN DEFINED  
**Initial Career Events:** DESIGN DEFINED  
**Inbox event-source rule:** DESIGN DEFINED  
**Deep-link requirement:** DESIGN DEFINED  
**Exactly-once day processing:** DESIGN DEFINED  
**Save/load requirements:** DESIGN DEFINED  
**MATCHDAY_READY hard stop:** DESIGN DEFINED  
**HM-GAME-0.3 implementation:** READY FOR CONTROLLED IMPLEMENTATION  
**CM-style Live Match:** NOT PART OF THIS SPEC  
**Analysis Hub:** NOT PART OF THIS SPEC  
**Expanded Inbox ecosystem:** FUTURE MILESTONE
