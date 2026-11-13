# Club Identity — Club Relationships (C4)

**Phase:** C4. **Decisions implemented:** D7 (HK Cliff), D8-A (IF Kristianstad), D9-A + A1 (11 Division 2 relations), L9 (cooperation rule unchanged).

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
| LUGI HF U | Lugi HF | U_TEAM | FULL | **new** seeded row |
| HF Karlskrona U | HF Karlskrona | SAME_CLUB_SECOND_TEAM | FULL | new |
| Ystads IF HF U | Ystads IF HF | U_TEAM | FULL | new |
| Tumba HK | IFK Tumba HK | SECOND_TEAM_UNDER_PARTNER_ASSOCIATION | FULL | new (`TUMBA_CLUB_ID` unchanged) |
| VästeråsIrsta HK | VästeråsIrsta HF | idem | FULL | new |
| HK Varberg 09 | HK Varberg | idem | **MAJORITY** | new |
| Helsingborgs HK | OV Helsingborg | idem | FULL | new |
| Malmö HP | HK Malmö | idem | FULL | new |
| HK Lif Blå | LIF Lindesberg | idem | FULL | new |
| HK Ystadpågarna | IFK Ystad HK | idem | FULL | new |
| Lunds HS Lejon | H43 Lund HF | idem | FULL | new (S2, the 11th) |
| Torslanda HK | HK Torslanda Elit | YOUTH_LINK | PARTIAL | none (not a B team, F29) |
| Veszprém Handball Academy | Veszprém KC | ACADEMY | PROBABLE | none (foreign) |

Every relation carries its evidence (Profixio registration counts and URLs). No squads or identities are merged.

## 3. Career behaviour

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
- `lib/career/clubPartnerships.test.ts`: two expectations updated from "exactly five rows in total" to "exactly the five canonical rows, unchanged, plus exactly 11 evidence-tagged relation rows" (new career: from start; migrated save: from 2027-07-01). No assertion was weakened.
- Targeted run (127 tests: partnerships, cooperation, continuity incl. three seeded seasons, promotion stock, Division 2 qualification, placements, world competitions, save migration): 127/127 pass (`C:\DEV\QA\logs\club-identity\c4-targeted.log`, after the two expectation updates).
- Five-season behaviour with real transitions: C6.

## 5. Rollback

Revert the C4 commit. Extra `AFFILIATED_B_TEAM` rows already written to saves remain valid in the older build (same type, same cap) — the documented MS §8 outcome.
