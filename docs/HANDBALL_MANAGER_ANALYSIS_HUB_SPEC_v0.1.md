# HANDBALL MANAGER — ANALYSIS HUB SPEC v0.1

**Status:** Product/architecture specification  
**Purpose:** Source of truth for HM-ANALYSIS-0.1

## 1. Purpose

Analysis Hub turns existing career and match data into manager information.

**MATCH → DATA → ANALYSIS → DECISION**

It must answer:
1. What is happening around my team?
2. What does the next opponent look like?
3. What patterns exist in our own performance?
4. What actually happened in the last match?

## 2. Core principles

- Every metric or statement must be traceable to actual game data.
- Handball terminology only.
- Separate **FACT → OBSERVED PATTERN → INTERPRETATION**.
- Never invent missing statistics.
- No causal claims without causal evidence.
- Analysis is read-only.
- Dense desktop manager-game UI; no generic SaaS dashboard.

## 3. Evidence model

Conceptually:

```ts
type AnalysisEvidenceLevel =
  | "FACT"
  | "OBSERVED_PATTERN"
  | "INTERPRETATION";
```

A FACT is a direct value or deterministic calculation from stored data.

An OBSERVED PATTERN is a reproducible rule over facts.

An INTERPRETATION is a cautious deterministic manager-facing meaning derived from supported patterns.

Example:

- FACT: 31.2 goals/match over the last five.
- PATTERN: at least 29 goals in all five matches.
- INTERPRETATION: recent offensive production has been stable.

Interpretations must never imply unsupported tactical causality.

## 4. Data sources

HM-ANALYSIS-0.1 may consume existing sources such as:

- CareerState
- career fixtures/results
- FastMatchResult
- MatchEventTimeline
- TeamMatchStats
- PlayerMatchContribution
- career player season statistics
- competition standings
- real-world identity snapshots

Exact names must be audited before implementation.

Preferred flow:

```text
CAREER / MATCH DATA
        ↓
Analysis selectors
        ↓
Derived metrics
        ↓
Pattern rules
        ↓
Interpretation rules
        ↓
View models
        ↓
UI
```

React must not become the analysis engine.

## 5. Navigation

One primary sidebar destination:

**ANALYSIS**

Internal views:

**OVERVIEW | OPPONENT | OUR TEAM | LAST MATCH**

## 6. Overview

Analysis Overview is the manager's analysis desk.

Show, when supported:

- next opponent
- next fixture date and home/away
- our recent form
- opponent recent form
- last completed manager match
- compact recent observations
- links into deeper analysis

It should route deeper rather than duplicate all detail.

## 7. Opponent Analysis

Uses the next scheduled opponent dynamically.

### Identity
- club
- competition
- league position
- next fixture
- home/away
- form

### Recent matches
Default: last 5 completed matches.

| Date | Opponent | H/A | Result | GF | GA |
|---|---|---|---|---:|---:|

### Attack, where supported
- goals/match
- shots/match
- shooting %
- turnovers/match
- 7m goals/attempts/conversion

### Defence, where supported
- goals conceded/match
- opponent shooting %
- goalkeeper saves/match
- goalkeeper save %
- 2-minute suspensions/match

### Players, only if persisted data supports it
Field players:
- appearances
- goals
- goals/match

Goalkeepers:
- appearances
- saves
- shots faced
- save %

If opponent player contributions are not persisted: **NOT AVAILABLE YET**.

## 8. Our Team Analysis

Support recent form and season context without mixing windows.

### Form
- last 5 results
- W/D/L
- goals for
- goals against
- goal difference

### Attack
- goals/match
- shots/match
- shooting %
- turnovers/match
- 7m conversion
- first-half goals
- second-half goals

### Defence
- goals conceded/match
- goalkeeper saves/match
- goalkeeper save %
- 2-minute suspensions/match

### Players
Where career statistics support it:

| Player | Pos | Apps | Goals | Goals/Match | Recent Goals |
|---|---|---:|---:|---:|---:|

No opaque new overall performance score.

## 9. Goalkeeper analysis

Treat goalkeeper output separately.

Current metrics may include:
- saves
- shots faced
- save %
- saves/match

Do not infer goalkeeper quality solely from save percentage.

Future SIGNAL metrics are outside v0.1.

## 10. Last Match Analysis

Use the actual latest completed manager match.

Sections:
1. Match summary
2. Team comparison
3. First/second-half split
4. Player production
5. Goalkeeper
6. Scoring runs
7. Event timeline
8. Observed patterns
9. Interpretation

### Team comparison

| Metric | Us | Opponent |
|---|---:|---:|
| Goals | | |
| Shots | | |
| Shooting % | | |
| Saves | | |
| Save % | | |
| Turnovers | | |
| 2 min | | |
| 7m | | |

Only include reconstructable metrics.

### Timeline
Reuse MatchEventTimeline. Possible filters:

**ALL | GOALS | SAVES | TURNOVERS | 2 MIN | 7M**

Never create events that did not occur.

## 11. Scoring runs

Derive runs from GOAL events.

A run is consecutive goals by the same side before the opponent scores.

Recommended v0.1 display threshold: **3 consecutive goals**.

Example:

```text
13'–16'   IFK Tumba   4–0
42'–45'   HK Malmö    3–0
```

This is a presentation rule, not proof of tactical significance. Do not automatically call it momentum.

## 12. Half splits

Use timeline timestamps:

- first half: 0–30
- second half: 30–60

Where supported derive:
- goals
- turnovers
- saves
- 2 min
- 7m

## 13. Analysis windows

Canonical vocabulary:

```ts
type AnalysisWindow =
  | "LAST_MATCH"
  | "LAST_3"
  | "LAST_5"
  | "SEASON";
```

Every comparison must label its window.

## 14. Sample size

Recommended v0.1 product calibration:

- single match: 1 completed match
- recent pattern: >= 3 completed matches
- last-five analysis: up to 5
- season comparison: >= 5 completed matches

Keep these rules isolated/configurable.

If insufficient: **INSUFFICIENT DATA**.

## 15. Metric definitions

Goals/match:

```text
sum(goalsFor) / completedMatches
```

Goals conceded/match:

```text
sum(goalsAgainst) / completedMatches
```

Shooting %:

```text
goals / shots
```

Turnovers/match:

```text
sum(turnovers) / completedMatches
```

7m conversion:

```text
sevenMetreGoals / sevenMetreAttempts
```

Save %:

```text
saves / shotsFaced
```

Goal difference:

```text
goalsFor - goalsAgainst
```

Form:

```text
W / D / L
```

from the selected team's perspective.

All formulas belong in domain/selectors, not UI components.

## 16. Deterministic pattern library

Start small.

Possible categories:
- scoring consistency
- recent scoring above/below season average
- goals conceded trend
- turnover frequency
- goalkeeper output

Examples:

> Scored at least X goals in each of the last N matches.

> Recent scoring output is above the season average.

> Turnover frequency has increased compared with the season average.

> Recent goalkeeper save output is above the season average.

Rules must be deterministic and carry their evidence/sample window.

Avoid labels such as ELITE, POOR or DOMINANT.

## 17. Interpretation rules

Allowed:
- Recent offensive production has been stable.
- Recent scoring output is above the season average.
- Recent matches have contained more turnovers than the season average.
- Goalkeeper save output has increased recently.
- The team has conceded fewer goals recently.

Forbidden without richer evidence:
- Their 6:0 defence is too passive.
- H3 is overhelping.
- Their pivot relationship is vulnerable.
- The goalkeeper reads shots poorly.

## 18. No unsupported causal claims

Allowed:

> Four turnovers occurred between minute 40 and 50.

Not allowed:

> Fatigue caused four turnovers between minute 40 and 50.

unless fatigue is explicitly modeled and causally linked.

## 19. Missing-data states

Use distinct states:

- **NO MATCHES YET** — no completed matches.
- **INSUFFICIENT DATA** — metric exists but sample is too small.
- **NOT AVAILABLE YET** — game does not produce required evidence.

Do not conflate them.

## 20. Provenance

Derived analysis should be traceable to:
- match IDs
- fixture IDs
- player IDs
- event indexes/IDs where applicable
- analysis window

Technical IDs may remain development/debug information.

## 21. Comparison semantics

Every comparison specifies:
- subject
- metric
- window A
- window B
- values
- direction

Do not equate HIGHER with BETTER for every metric. Higher turnovers or suspensions are not positive.

## 22. UI direction

### Overview

```text
ANALYSIS
OVERVIEW | OPPONENT | OUR TEAM | LAST MATCH

NEXT OPPONENT             OUR FORM
HK Malmö                  W W L W W
League position           GF / match
Recent form               GA / match

LAST MATCH                RECENT OBSERVATIONS
31–28                     • ...
                          • ...
```

### Opponent

```text
HK MALMÖ — NEXT OPPONENT

FORM
W W L W D

RECENT MATCHES

ATTACK              DEFENCE
Goals/match         Goals conceded/match
Shots/match         GK save %
Shooting %          2 min/match
Turnovers/match

KEY PLAYERS
OBSERVED PATTERNS
INTERPRETATION
```

### Our Team

```text
OUR TEAM
LAST 5 | SEASON

FORM
ATTACK
DEFENCE
PLAYERS
GOALKEEPERS
RECENT PATTERNS
```

### Last Match

```text
IFK TUMBA 31–28 SKÅNELA

MATCH SUMMARY
TEAM COMPARISON
FIRST HALF / SECOND HALF
KEY SCORING RUNS
PLAYER PRODUCTION
GOALKEEPER
EVENT TIMELINE
OBSERVED PATTERNS
```

Use existing HM dark, dense desktop game language. No giant SaaS cards.

## 23. Charts

Only use charts when they improve understanding.

Useful future/optional v0.1 candidates:
- goals for/against across last 5
- cumulative score differential
- recent vs season comparison

Avoid decorative radar/pie charts and fake possession/momentum graphs.

## 24. Tactical Domain extension point

Future Tactical Domain evidence may include:
- TacticalOpportunity
- exploitation action
- decision quality
- relationship outcomes
- defensive response
- collective failure/resolution
- recognition

Future questions:
- Which interactions repeatedly created advantage?
- Which defensive responses conceded opportunities?
- Which opportunities were recognised/exploited?

None of these may be fabricated in v0.1.

Preferred future flow:

```text
Tactical Domain
      ↓
Tactical Analysis Adapter
      ↓
Analysis Evidence
      ↓
Analysis Hub
```

## 25. SIGNAL extension point

Future SIGNAL may add:
- shot location/outcome
- goalkeeper actions
- goalkeeper-coach assessment
- xG/xS-style measures
- event tagging

Use an adapter later. Do not couple Analysis UI directly to SIGNAL.

## 26. LENS extension point

Future evidence may reference video clips.

Example:

```text
4 turnovers during minutes 41–49
[OPEN CLIPS]
```

No video integration in v0.1.

## 27. Determinism

Identical:
- CareerState
- completed matches
- analysis window

must produce identical:
- metrics
- patterns
- interpretations

No randomness. No generative AI.

## 28. Acceptance criteria

HM-ANALYSIS-0.1 is GO only if:

### Navigation
- ANALYSIS is one main navigation destination.
- Overview/Opponent/Our Team/Last Match are internal views.

### Overview
- next opponent derives from schedule
- recent form is real
- last completed match is real
- no mock analysis prose

### Opponent
- next opponent is dynamic
- recent completed matches drive metrics
- unavailable data is explicit
- no tactical claims without tactical evidence

### Our Team
- recent/season metrics are real
- player production uses career stats
- goalkeeper metrics use supported data
- windows are explicit

### Last Match
- actual latest manager match
- score matches Match Report
- team stats match FastMatchResult
- half splits derive from timeline
- scoring runs derive from GOAL events
- event timeline is real

### Evidence
- FACT / OBSERVED_PATTERN / INTERPRETATION remain semantically separate
- deterministic pattern/interpretation rules
- no unsupported causality

### Integrity
- read-only
- Career Rhythm unchanged
- Fast Match outcome generation unchanged
- Live Match unchanged
- real-world source unchanged
- Editor unchanged
- Tactical Domain unchanged
- SIM/FIELD unchanged

## 29. Explicitly out of scope

Do NOT implement:
- Tactical Domain integration
- tactical tendencies
- formation effectiveness
- ATI/H2/H3 analysis
- shot maps without shot-location evidence
- xG/xS
- SIGNAL
- LENS/video
- AI summaries
- CA/PA or ability analysis
- recruitment recommendations
- training recommendations
- fatigue causality
- injury-risk analysis
- new simulation data merely to make Analysis richer
- detailed 2D analysis

## 30. Development rule

For every requested analysis:

```text
Does stored evidence exist?
        ↓
 YES -------- NO
  ↓            ↓
derive       NOT AVAILABLE YET
  ↓
enough sample?
  ↓
 YES -------- NO
  ↓            ↓
pattern      INSUFFICIENT DATA
  ↓
optional deterministic interpretation
```

Never design an insight first and invent data to support it.

## 31. Final product principle

Analysis Hub should not merely say:

> You won 31–28.

It should organize evidence so the manager can see:

> We won 31–28. We were +5 in the second half. A 4–0 scoring run changed the score. Our turnover rate was above our recent average, while goalkeeper save output was also higher.

And the system must be able to identify which match data supports each statement.

Later Tactical Domain, SIGNAL and LENS can progressively explain more of **why** it happened.

HM-ANALYSIS-0.1 establishes the trustworthy evidence architecture first.
