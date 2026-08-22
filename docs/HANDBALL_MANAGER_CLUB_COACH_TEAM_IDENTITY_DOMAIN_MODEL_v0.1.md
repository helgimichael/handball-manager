# HANDBALL MANAGER — CLUB / COACH / TEAM IDENTITY DOMAIN MODEL v0.1

**Status:** Design source of truth  
**Scope:** Handbollsligan Herr 2026/27  
**Input basis:** 14 approved CLUB IDENTITY v0.1 source profiles  
**Purpose:** Define the canonical data model that separates club identity, coach identity, squad/current-team context, staff data, evidence/provenance, and future game-facing identity.

## 1. Core principle

A single flat `ClubIdentity` object is insufficient.

```text
CLUB
  ↓
long-term structural / cultural / tactical heritage

COACH
  ↓
portable philosophy, behaviour and coaching tendencies

SQUAD
  ↓
current people, capabilities, depth, continuity and composition

SEASON CONTEXT
  ↓
temporary financial, organisational, competitive and transition state

        ↓

CURRENT TEAM IDENTITY
```

A club must not permanently inherit a current coach's philosophy. A coach must not permanently inherit the identity of the club currently employing them. Temporary 2026/27 context must not automatically become permanent club DNA.

## 2. Source-data rule

The 14 approved CLUB IDENTITY documents remain source material. Every imported field must preserve its subject, value, evidence class, temporal scope, source/provenance, confidence/status and whether it is observed, projected, historical, current-context or unknown.

`UNKNOWN` means unknown. It must never silently become a neutral game value.

## 3. Canonical root objects

```ts
ClubIdentityProfile
CoachIdentityProfile
StaffPerson
StaffAssignment
SquadIdentityContext
SeasonClubContext
CurrentTeamIdentity
IdentityClaim
EvidenceReference
```

## 4. ClubIdentityProfile

Contains qualities that can persist beyond the current coach and current squad.

```ts
interface ClubIdentityProfile {
  clubId: string;
  seasonReference: string;
  structuralIdentity: IdentityClaim[];
  cultureIdentity: IdentityClaim[];
  tacticalHeritage: IdentityClaim[];
  developmentIdentity: IdentityClaim[];
  recruitmentIdentity: IdentityClaim[];
  financialStrategicIdentity: IdentityClaim[];
  supporterEnvironmentIdentity: IdentityClaim[];
}
```

It must not directly contain current player ratings, current squad strength as permanent identity, current coach traits, temporary transfer losses, injury state or season-specific title expectations.

## 5. CoachIdentityProfile

Coach identity belongs to the person and moves with them if they change club.

```ts
interface CoachIdentityProfile {
  personId: string;
  coachingStyleClaims: IdentityClaim[];
  tacticalPreferenceClaims: IdentityClaim[];
  communicationLeadershipClaims: IdentityClaim[];
  developmentClaims: IdentityClaim[];
  adaptabilityClaims: IdentityClaim[];
  cultureBuildingClaims: IdentityClaim[];
}
```

The 14 profiles already contain coach-specific dimensions such as analytical orientation, authority, discipline, player autonomy, coach-player relationship, buy-in, adaptability, ability to maximize a squad, culture building, young-player motivation, tactical intelligence and club-identity fit.

These must not be collapsed into one generic coaching rating.

## 6. StaffPerson

```ts
interface StaffPerson {
  id: string;
  displayName: string;
  nationality?: string;
  dateOfBirth?: string;
  externalCareerNotes?: string[];
}
```

Unknown biography stays absent.

## 7. StaffAssignment

Roles belong to assignments.

```ts
interface StaffAssignment {
  personId: string;
  clubId: string;
  officialRole: string;
  standardRoles: HMStaffRole[];
  validFrom?: string;
  validTo?: string;
  season?: string;
  status:
    | "CONFIRMED"
    | "PROBABLE"
    | "HISTORICAL"
    | "ROLE_NEEDS_CLARIFICATION"
    | "DUAL_STATUS";
  evidence: EvidenceReference[];
}
```

A person may hold multiple roles simultaneously.

## 8. Initial HM staff-role vocabulary

```text
CHAIRPERSON
CLUB_DIRECTOR
SPORTING_DIRECTOR
SENIOR_DIRECTOR
ELITE_DIRECTOR

HEAD_COACH
ASSISTANT_COACH
COACH
GOALKEEPER_COACH

STRENGTH_CONDITIONING_COACH
PHYSIOTHERAPIST
DOCTOR
PERFORMANCE_STAFF

TEAM_MANAGER
TEAM_ADMIN
EQUIPMENT_MANAGER

ANALYST
SCOUT

OTHER
ACTIVE_PLAYER
```

Always preserve the official role alongside the standardized role.

## 9. Staff special cases

The model must support multiple simultaneous roles, collective sporting leadership, player/staff hybrids and imperfect role-group mappings such as Naprapat grouped under a broader medical category while retaining the original official title.

A collective sportteam must not silently become several independent traditional sporting directors.

A real person who is both active player and sporting director must remain one person/entity with multiple assignments/roles.

## 10. Evidence model

```ts
type EvidenceClass =
  | "VERIFIED_EXTERNAL_DATA"
  | "VERIFIED_EXTERNAL_CLUB_STRATEGY"
  | "VERIFIED_EXTERNAL_CLUB_STATEMENT"
  | "PROBABLE_EXTERNAL_DATA"
  | "USER_EXPERT_ASSESSMENT"
  | "USER_PROJECTION"
  | "USER_EXPERT_REQUIRES_VERIFICATION"
  | "INFERENCE"
  | "UNKNOWN_NOT_ASSESSED";
```

### Semantics

- **VERIFIED_EXTERNAL_DATA**: externally verified fact.
- **VERIFIED_EXTERNAL_CLUB_STRATEGY / STATEMENT**: proves that the club stated an ambition/direction, not that it achieved it.
- **PROBABLE_EXTERNAL_DATA**: likely current but not fully verified for the exact season.
- **USER_EXPERT_ASSESSMENT**: expert-source assessment, usable later but not relabeled as verified fact.
- **USER_PROJECTION**: plausible future direction, never established current identity.
- **USER_EXPERT_REQUIRES_VERIFICATION**: factual expert-source claim awaiting verification.
- **INFERENCE**: derived interpretation; current source set intentionally minimizes this.
- **UNKNOWN_NOT_ASSESSED**: no supported assessment exists.

## 11. IdentityClaim

```ts
interface IdentityClaim {
  id: string;
  subjectType:
    | "CLUB"
    | "COACH"
    | "STAFF"
    | "SQUAD"
    | "TEAM"
    | "SEASON_CONTEXT"
    | "ENVIRONMENT";
  subjectId: string;
  domain: string;
  key: string;
  value: string | number | boolean;
  evidenceClass: EvidenceClass;
  confidence?: "CONFIRMED" | "PROBABLE" | "UNCERTAIN";
  temporalScope:
    | "LONG_TERM"
    | "HISTORICAL"
    | "CURRENT"
    | "SEASON"
    | "PROJECTED";
  season?: string;
  validFrom?: string;
  validTo?: string;
  sourceRefs: string[];
  notes?: string;
}
```

Do not require numeric values. The approved source vocabulary includes values such as PRIMARY, CORE, STRONG, VERY STRONG, ELITE, HIGH, VERY HIGH, LOW, LIMITED, GROWING, IMPROVING, VARIABLE, DYNAMIC, THIN, SIMPLE and UNKNOWN. Do not prematurely collapse this to 1–20.

## 12. Club identity domains

### Structural / cultural
Examples found across the profiles:

```text
club stature
legacy / tradition
club attachment
club loyalty
collective identity
work ethic
player commitment
winning culture
professional environment
training environment
financial strength
resource efficiency
tactical flexibility
system adaptability
```

### Tactical heritage
Subdomains:

```text
ATTACK
DEFENCE
TRANSITION
MATCH PHILOSOPHY
TEMPO / CONTROL
```

Examples already supported include 6:0, 5:1, växelspel, over-zone movement, M6 involvement, 7v6 usage, tempo control, physical attack, transition orientation, goalkeeper transition initiation, defensive depth and ball-winning intent.

Not every club needs every field.

### Development
Examples:

```text
academy scale
youth production
youth-to-senior pathway
young-player opportunity
external young-player recruitment
development-to-export pathway
player improvement environment
internal competition for senior places
```

Separate “pathway exists” from “pathway quality is elite”.

### Recruitment
Examples:

```text
external recruitment orientation
regional recruitment
Nordic/international recruitment
young-talent identification
returning elite-player attraction
long-term squad building
recruitment decision quality
```

Historical patterns must retain historical temporal scope.

### Supporter / home environment
Examples:

```text
fanbase
home attendance
away support
supporter density
local supporter connection
home environment
home-court difficulty
attendance trajectory
```

Do not automatically convert these to a numeric home-advantage modifier.

## 13. Coach identity domains

Initial domains supported by the sources:

```text
TACTICAL / COGNITIVE
- analytical orientation
- tactical intelligence
- game understanding
- adaptability
- preparation

LEADERSHIP
- authority
- player relationship
- player buy-in
- discipline demands
- standards/demands
- player autonomy
- tolerance for opposition

CULTURE
- winning-culture building
- work-culture building
- club commitment
- club identity fit

DEVELOPMENT
- young-player motivation
- young-player coaching
- development coaching

SQUAD UTILIZATION
- ability to maximize squad
```

Preference/philosophy and quality/capability must remain separate.

## 14. SquadIdentityContext

Current-squad claims belong here, not automatically to the club:

```text
squad depth
squad age
squad experience
physical profile
technical profile
key-player dependency
squad continuity
young-player importance
current goalkeeper strength
```

```ts
interface SquadIdentityContext {
  clubId: string;
  season: string;
  claims: IdentityClaim[];
}
```

Long term, many of these should be derived from actual player data.

## 15. SeasonClubContext

Temporary 2026/27 conditions:

```text
financial pressure
board instability
squad rebuilding
coach transition
title contention
relegation risk
key-player losses
relative squad strength
tactical uncertainty
performance variance
```

```ts
interface SeasonClubContext {
  clubId: string;
  season: string;
  organisationalClaims: IdentityClaim[];
  financialClaims: IdentityClaim[];
  squadClaims: IdentityClaim[];
  competitiveClaims: IdentityClaim[];
  transitionClaims: IdentityClaim[];
}
```

These expire or require reassessment.

## 16. CurrentTeamIdentity

`CurrentTeamIdentity` is derived gameplay state, not directly authored source data.

```text
Club Identity
+
Coach Identity
+
Squad capabilities/context
+
Season context
+
Tactical familiarity
+
Manager/AI tactical selections

        ↓

Current Team Identity
```

Every derived value must retain provenance.

No opaque aggregate overall identity score.

## 17. Temporal model

Claims may be:

```text
LONG_TERM
HISTORICAL
CURRENT
SEASON
PROJECTED
```

Examples from the dataset include historical external recruitment, growing current youth integration, low 2026/27 squad continuity, projected future tactical direction and long-term development culture. These must never be flattened together.

## 18. Coach movement

When a coach changes club:

- `CoachIdentityProfile` follows the coach.
- `ClubIdentityProfile` stays with the club.
- `CurrentTeamIdentity` is recalculated.
- Tactical familiarity/adoption may later determine how quickly the team changes.

## 19. Club identity change

Club identity itself may evolve more slowly. Use dated claims rather than overwriting history.

Example:

```text
historical external recruitment
→ current youth integration growing
```

Both may remain true in their respective time scopes.

## 20. Special cases proven by the 14 profiles

The model must explicitly support:

1. **Tactical flexibility as identity** — a club may be highly adaptable rather than have one fixed style.
2. **New-coach uncertainty** — current tactical identity may be NOT YET ESTABLISHED while USER_PROJECTION exists separately.
3. **Financial crisis** — acute crisis belongs to season context unless later established as long-term structural identity.
4. **Player/staff hybrids** — one person may simultaneously be player and staff.
5. **Collective sporting management** — sportteam/group structures are representable.
6. **Elite/world-class expert claims** — preserved qualitatively with evidence class, not automatically turned into ratings.
7. **Comparative claims** — “best”, “largest”, “top 3”, “world class” remain evidence-bearing claims unless separately verified.

## 21. Structured import architecture

Preferred flow:

```text
approved DOCX source profile
        ↓
controlled extraction
        ↓
structured identity source JSON
        ↓
schema validation
        ↓
game-world import
```

Do not parse DOCX dynamically in the shipped game.

Recommended future source location:

```text
data/real-world/sweden/2026-27/handbollsligan/identity/
```

Identity data must reference the existing canonical club IDs. Do not create a second club-ID system.

## 22. Unknown import rule

If source data says:

```text
UNKNOWN
NOT ASSESSED
NOT YET VERIFIED
```

do not import `MEDIUM`.

Prefer missing/explicit-unknown source state.

If a consuming gameplay system later needs a neutral fallback, that fallback belongs there and must be explicitly provisional.

## 23. Gameplay boundaries

Identity may later inform:

```text
AI tactical preferences
coach hiring / staff transfers
coach-club alignment
tactical familiarity
recruitment preferences
development environment
financial risk behaviour
home/supporter environment
staff NPC behaviour
player-development context
player-rating priors
```

No gameplay effect is automatically approved just because source data exists.

## 24. Player-rating boundary

Identity provides context, not direct player ability.

Example:

```text
developed in elite youth environment
```

does not prove:

```text
player ability = 16
```

Player Capability requires its own model.

## 25. Tactical Domain boundary

Only map identity claims to Tactical Domain where existing vocabulary can represent the claim honestly.

Do not invent tactical variables to absorb prose.

## 26. Validation invariants

A valid structured identity dataset must satisfy:

1. Every staff assignment references a known person and club.
2. Official role text is preserved.
3. Standardized role is never the only role record.
4. Every meaningful claim has an evidence class.
5. USER_PROJECTION is never treated as observed current identity.
6. UNKNOWN is never silently converted to neutral.
7. Season context is not stored as long-term club identity.
8. Coach claims belong to coach identity.
9. Player/staff hybrids can reference one person.
10. Historical assignments are not loaded as current staff.
11. Probable roles remain distinguishable from confirmed roles.
12. No numerical ratings are invented during import.

## 27. Implementation roadmap

### HM-IDENTITY-0.1 — Structured Source Schema
Build the schema/types, evidence model, staff person/assignment model, club/coach/squad/season claims and validators. No gameplay effects.

### HM-STAFF-DATA-0.1 — Real Staff Import
Import all verified/probable staff from the 14 approved profiles, current club assignments, roles, evidence status and dual-role support. No staff ratings.

### HM-COACH-IDENTITY-0.1 — Coach Profiles
Extract coach-specific expert claims into portable coach profiles. No final numeric ratings.

### HM-IDENTITY-0.2 — Current Team Identity Resolver
Headless, explainable resolver:

```text
Club Identity
+ Coach Identity
+ Squad Context
+ Season Context
+ existing tactical selections
→ Current Team Identity
```

### HM-IDENTITY-0.3 — AI Tactical Preference Adapter
Only after the resolver exists, map supported identity claims into AI tactical preferences. Deterministic and explainable.

## 28. GO criteria

The model is ready for implementation only if:

- all 14 source profiles can be represented without information loss;
- club and coach identity can separate cleanly;
- current-season context can expire independently;
- staff can change clubs without recreating the person;
- dual player/staff roles work;
- collective sporting leadership works;
- evidence survives import;
- projections stay projections;
- unknown stays unknown;
- no numerical ratings are invented.

## 29. Final principle

The game should not ask:

> What is this club's one fixed style?

It should ask:

```text
What does this club historically value?
Who is coaching it now?
What does that coach prefer and do well?
What squad exists right now?
What temporary constraints exist this season?
How familiar is the team with the current plan?
```

The derived answer becomes **CURRENT TEAM IDENTITY**.

That identity can change as coaches, players, finances and tactics change while deeper club history remains.
