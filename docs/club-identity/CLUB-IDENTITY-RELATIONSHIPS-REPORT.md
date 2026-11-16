# Club Identity — Club Relationships (C4)

**Phase:** C4. **Status: PARTIAL — one genuine blocker (§5).** Decisions implemented: D7 (HK Cliff), D8-A (IF Kristianstad), D9-A1 (no renewal), D9 static relations, L9 (cooperation rule unchanged). **Not activated:** career agreements (and therefore the SHF promotion cap) for the 11 new Division 2 relations — activating them deadlocks careers in the production transition engine (§5); an owner decision is required.

## 1. Two layers, never interchangeable

| Concept | Static relation (layer 1, `Club.relations`) | Career agreement (layer 2, `CareerState.clubPartnerships`) | Cooperation cap (L9) |
|---|---|---|---|
| Parent club | `relations[].parentClubId` on the child | `ClubPartnership.clubAId` | — |
| Reserve / second team | `SECOND_TEAM`, `SAME_CLUB_SECOND_TEAM`, `SECOND_TEAM_UNDER_PARTNER_ASSOCIATION` | `AFFILIATED_B_TEAM` | applies |
| U team | `U_TEAM`, `U_TEAM_UNDER_PARTNER_LICENCE` (HK Cliff) | `AFFILIATED_B_TEAM` | applies |
| Farm club / partner association | `PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS` (IF Kristianstad, `PARTIAL`) | existing permanent `AFFILIATED_B_TEAM` row (kept, D8-A) | applies |
| Active cooperation | — | any `ACTIVE` row the rule reads (unchanged logic) | applies |
| Temporary development partnership | — | `DEVELOPMENT_PARTNERSHIP` (dated; unchanged) | unchanged |
| Historical cooperation | `relations[].validTo` | row with past `endDate` / `EXPIRED` / `TERMINATED` (kept forever) | only the existing late-termination rule |
| Academy (foreign) | `ACADEMY` (`int-veszprem-academy` → `hun1-veszprem`) | none | none |
| Independent club / youth link | none, or `YOUTH_LINK` (Torslanda HK → HK Torslanda Elit, informational) | none | none |

Resolvers (`game-data/clubIdentity.ts`): `clubRelationForSeason`, `parentClubOf`, `clubTeamType` (FIRST_TEAM, SECOND_TEAM, U_TEAM, ACADEMY, PARTNER_ASSOCIATION), `hasStaticCooperationRelation`, `clubRelationLabel` (D7 text label, e.g. "Hammarby U · HK Cliffs licens").

## 2. The 16 cooperation teams (+ 2 non-cooperation links)

| Child | Parent | Kind | Confidence | Career row |
|---|---|---|---|---|
| HK Cliff | Hammarby IF HF | U_TEAM_UNDER_PARTNER_LICENCE | FULL | existing permanent row (unchanged) |
| HK S-hof | IK Sävehof | SECOND_TEAM | PROBABLE | existing permanent row |
| HP Alingsås | Alingsås HK | SECOND_TEAM | FULL | existing permanent row |
| IF Kristianstad | IFK Kristianstad | PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS | **PARTIAL** | existing permanent row (D8-A, no retype, no v9) |
| HK Önnerediterna | Önnereds HK | SECOND_TEAM_UNDER_PARTNER_ASSOCIATION | FULL | existing permanent row |
| LUGI HF U | Lugi HF | U_TEAM | FULL | static relation; career row **gated** (§5) |
| HF Karlskrona U | HF Karlskrona | SAME_CLUB_SECOND_TEAM | FULL | static relation; career row gated |
| Ystads IF HF U | Ystads IF HF | U_TEAM | FULL | static relation; career row gated |
| Tumba HK | IFK Tumba HK | SECOND_TEAM_UNDER_PARTNER_ASSOCIATION | FULL | static relation; career row gated (`TUMBA_CLUB_ID` unchanged) |
| VästeråsIrsta HK | VästeråsIrsta HF | idem | FULL | static relation; career row gated |
| HK Varberg 09 | HK Varberg | idem | **MAJORITY** | static relation; career row gated |
| Helsingborgs HK | OV Helsingborg | idem | FULL | static relation; career row gated |
| Malmö HP | HK Malmö | idem | FULL | static relation; career row gated |
| HK Lif Blå | LIF Lindesberg | idem | FULL | static relation; career row gated |
| HK Ystadpågarna | IFK Ystad HK | idem | FULL | static relation; career row gated |
| Lunds HS Lejon | H43 Lund HF | idem | FULL | static relation; career row gated (S2, the 11th) |
| Torslanda HK | HK Torslanda Elit | YOUTH_LINK | PARTIAL | none (not a B team, F29) |
| Veszprém Handball Academy | Veszprém KC | ACADEMY | PROBABLE | none (foreign) |

Every relation carries its evidence (Profixio registration counts and URLs). No squads or identities are merged.

## 3. Career behaviour

> The table describes the implemented mechanism. In production builds `DIVISION2_RELATION_AGREEMENTS_ENABLED = false` (`career/staticRelationPartnerships.ts`): the seeder and reconciler run on every new career and every load but activate **no** rows for the 11 Division 2 relations, so careers behave exactly as before C4 for promotion and relegation. Candidate exclusion and no-renewal read the static relations and **are** active.

| Event | New career | Existing (legacy) career |
|---|---|---|
| Relation rows | Seeded at career start (`seedStaticRelationPartnerships(…, "CAREER_START")`) | Seeded on load with `startDate` = **next season start** (2027-07-01 for a 2026/27 save); the in-progress season and its own end-of-season transition are unaffected (`cooperationEligibility` skips rows not yet started) |
| Idempotence | Row id `bteam-<parent>-<child>`; never duplicated, never modified; a later load never moves a start date | idem |
| The five canonical rows | Unchanged (`PERMANENT_B_TEAM_PAIRS` untouched, rows keep their exact shape) | idem |
| Development-partnership candidates | All 16 linked teams excluded (`isClubExclusivelyPartnered`) | idem |
| Existing development partnership with a newly linked team (D9-A1) | — | Runs to its `endDate`, expires through the existing daily path; `renewPartnership` refuses it; nothing rewritten |
| Relation ends in reality (`validTo`) | Not seeded if it ended before the career's row could start | `reconcileStaticRelationPartnerships` dates the seeded row to the season close (non-permanent, still ACTIVE until then); the daily tick then expires it; the row stays as history. Only rows the seeder created are touched |
| Manual termination | Existing `terminatePartnership` + SHF 9:5-7 late-termination rule, unchanged | idem |
| Promotion / relegation | Existing cap `highest = max(3, parentTier + 1)`; e.g. HK Lif Blå (parent in Division 1) can never leave Division 2 while active; Tumba HK may reach Division 1 but never Allsvenskan | from 2027/28 |
| Manager club change | Rows belong to clubs, not the manager | idem |
| HK Cliff as manager club (D7) | Selectable, own identity, own records; relation shown as text | unchanged |

**L9 guard:** `cooperationEligibility.ts` is byte-identical to `76513bd` (sha256 asserted in a test).

**Not changed (scope):** player placement into B teams (`playerPlacements.ts`) and the youth-intake exclusion (`youthIntake.ts`) still use only the five canonical pairs — player movement is outside this assignment (no gameplay change beyond the approved cooperation rows).

## 4. Tests

- `lib/career/staticRelationPartnerships.test.ts` (7 tests): L9 byte guard; 16 relations, kinds, confidences, D7/D8 specifics, non-cooperation links, parents resolve; new-career rows from start; legacy rows from next season with the cap applying only from 2027/28 (HK Lif Blå, Tumba HK), idempotence and save/load; candidate exclusion and D9-A1 run-out; termination via `validTo` (cap until season close, EXPIRED row kept, no effect later, canonical rows never ended); SHF late termination on a seeded row.
- `lib/career/staticRelationPartnerships.test.ts` also asserts the gate: production careers hold exactly the five canonical rows, new and loaded.
- `lib/career/clubPartnerships.test.ts`: unchanged from the pre-C4 version (its "exactly five rows" expectations hold again because of the gate).
- Targeted run before the gate (127 tests: partnerships, cooperation, continuity incl. three seeded seasons, promotion stock, Division 2 qualification, placements, world competitions, save migration): 127/127 pass (`C:\DEV\QA\logs\club-identity\c4-targeted.log`, after the two expectation updates).
- Five-season behaviour with real transitions: C6.

## 5. Blocker: activating the 11 Division 2 agreements deadlocks careers

**Finding (C6 five-season soak, reproduced deterministically).** With the 11 agreements active:

1. *Promotion route* (seed `club-identity-soak-new`, 2026/27 → 2027/28): Lunds HS Lejon is promoted Division 2 → Division 1 (eligible: parent H43 Lund is in Allsvenskan, cap = tier 3) **in the same transition** in which H43 Lund is relegated Allsvenskan → Division 1. Both now play Division 1. At the next rollover the unchanged rule (`highest = max(3, parentTier + 1)` = 4) refuses Lejon in Division 1: `COOPERATION_TARGET_INELIGIBLE`, status BLOCKED — and every later attempt is refused the same way. The career cannot start another season.
2. *Remain route* (same seed, 2029/30): LUGI HF U, legitimately promoted earlier, stays in Division 1 while Lugi HF is relegated into Division 1 → same permanent block.

**Why it cannot be fixed inside this assignment.** The rule itself is locked (L9) and correct. What is missing is a *transition-engine* behaviour: moving a cooperation team down when its parent arrives in its tier (SHF "always below its parent"). Two engine extensions were prototyped and **reverted**:
- re-planning with projected parent tiers (fixes route 1), and
- an evidenced `ADMINISTRATIVE_RELEGATION` ranking decision (fixes route 2).

They resolved the soak's blocks but broke the existing production test `gameContinuity.seasons.test.ts` (`QUALIFICATION_TIE_CONFLICT`): Division 1 qualification series are scheduled mid-season from the planner's entrants, and a projection that depends on the parent's final placement changes those entrants afterwards. Making that consistent is a redesign of the Swedish qualification/transition engine — explicitly out of scope ("preserve existing Swedish competition rules", "do not change unrelated gameplay systems").

**Pre-existing exposure (not introduced here).** The same deadlock is reachable today for the five canonical B teams (e.g. HK Cliff in Division 1 if Hammarby is relegated twice). It is rare because those parents are Handbollsligan clubs; the 11 Division 2 relations would make it frequent.

**Consequence of the gate.** Division 2 second/U teams can still be promoted above the real SHF cap in careers (observed in the soak: VästeråsIrsta HK climbed to Handbollsligan). This is the pre-C4 behaviour, unchanged.

**Owner decision required (OD-1).** Choose one:
- **A (recommended):** approve a scoped engine milestone — "cooperation-aware transitions": projected parent tiers in qualification seeding *before* series are scheduled, plus administrative relegation of a cooperation team whose parent arrives in its tier — then flip `DIVISION2_RELATION_AGREEMENTS_ENABLED`. The seeder, termination path, tests and evidence are ready.
- B: keep the gate closed (static relations, labels, candidate exclusion, no renewal only).
- C: activate only relations whose parents are in Division 1 (cap 4 keeps the team in Division 2) — still deadlock-prone if that parent is later promoted and relegated again; not recommended.

## 6. Rollback

Revert the C4 commit. Extra `AFFILIATED_B_TEAM` rows already written to saves remain valid in the older build (same type, same cap) — the documented MS §8 outcome.
