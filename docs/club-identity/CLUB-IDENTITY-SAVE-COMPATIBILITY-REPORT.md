# Club Identity — Save Compatibility and Historical Career Validation (C6)

**Schema:** stays **v8**. No v9 was introduced; none of the implemented changes required one.
**Tester saves (D11):** no anonymised Alpha exports and no tester consent exist in the repository, so all validation uses internally generated representative careers built through the production `createNewCareerState` path (QA-only Division 2 pool squads from `gameContinuity.fixtures`). No live, Alpha or tester save was read, modified or reset.

## 1. What changes in a stored career

| Change | Stored? | Old save on load | Older build reading a new save |
|---|---|---|---|
| `Club` identity fields, names, cities, aliases, relations, colours | No (static data, resolved live) | New names/colours show; old inbox and bid text keeps old wording | Shows the old static data |
| `CareerState.clubWorldBaseline` | New careers only (optional field) | Absent → legacy behaviour; **never backfilled** | Ignored; foreign leagues show the legacy lists (cosmetic: foreign leagues have no fixtures) |
| Partnership rows for the 11 Division 2 relations | Not written (gated, see relationships report §5) | — | — |
| New clubs (`ger1-bietigheim`, `den1-kif-kolding`) | Only as values a new-career pool can reference (buyers, knowledge) | Absent until the career's next season | An unknown id renders as its raw id; T7 in this build refuses only an unknown manager club |
| T7 guard | — | Unknown `clubWorldBaseline` or an unresolvable manager club → refused before migration, nothing written | — |

Every change is class A or B (MIGRATION-STRATEGY §5). Nothing in an existing save is rewritten.

## 2. Scenario results

| Scenario | Test | Result |
|---|---|---|
| A — New 2026/27 career: corrected clubs, starting leagues, identities, colours, relations | `clubIdentitySoak.test.ts` (NEW), `clubWorldMembership.test.ts`, `clubVisualIdentity.test.ts`, `staticRelationPartnerships.test.ts` | PASS |
| B — Existing v8 career: same manager, club, date, membership, fixtures, results, history after load | soak (LEGACY, built as a v8 save: marker removed, v8 partnership rows only), `clubIdentityCareer.test.ts` | PASS |
| C — Five consecutive seasons with promotions, relegations, club change, international clubs, foreign pools, cooperation caps, save/load, transitions | soak: NEW and LEGACY each play 2026/27 → 2031/32 (five seasons, five applied rollovers, JSON save/load after every rollover) | PASS (see §3 for the seed note) |
| D — Club change: complete identity follows; history stays with original clubs | soak (dismissal → clubless orange → new club's full identity; archived fixtures keep the old club id), `activeClubIdentity.test.ts`, browser check | PASS |
| E — Cooperation termination: restriction removed only when legally effective | `staticRelationPartnerships.test.ts` (SHF 9:5-7 late termination keeps this season's cap and lifts it next season; relation `validTo` ends the agreement at the season close), existing `cooperationEligibility.test.ts` (31 Dec deadline) | PASS |
| F — Historical integrity: stable ids, unchanged results, correct historical leagues, old names resolvable, no duplicates, no broken references | soak invariants after every rollover (I1–I9), C1/C2 tests (frozen snapshot, unique canonical ids, alias/historical-name resolution) | PASS |

Soak log (seasons, managers, promotions/relegations per rollover): `C:\DEV\QA\logs\club-identity\c6-soak-final.log`.
- NEW: Tumba (Handbollsligan) → dismissed after 2027/28 → VästeråsIrsta HK (an UNKNOWN-kit club: orange fallback, visibly marked) → Allsvenskan → Handbollsligan; 10–12 promotions and relegations per rollover.
- LEGACY: Tumba → club change → Division 1 → Allsvenskan → Handbollsligan; v8 world for 2026/27, corrected foreign world from 2027/28.

**Invariants checked after every rollover:** every stored club id resolves (I1); T7 accepts the save; frozen `competitionId` = v8 snapshot (I3); archived seasons byte-identical across later rollovers and save/load (I6); every Swedish club's league = the career's own membership or starting league (I5); the five canonical rows unchanged and no extra rows (I7); foreign/world-pool pools contain no Swedish club; the TV Bittenfeld tombstone never in a pool after `validTo` and still renders (I9); promoted cooperation teams within their cap.

## 3. Swedish transitions are byte-identical to the baseline (I5)

The same legacy career (`continuityTestCareer("i5-legacy")`, marker removed) was played and rolled over three times on the untouched `76513bd` worktree and on this branch:

| Rollover | Membership hash | History hash (tables, results, fixtures, outcomes) | New fixtures hash |
|---|---|---|---|
| 2026/27 → 2027/28 | `a69d4ce826f4c12a` = | `7a20c1e36bd41903` = | `7434011903edbf2f` = |
| 2027/28 → 2028/29 | `6745af93cc7ed6e1` = | `e5993441831e86ca` = | `825885eb34818854` = |
| 2028/29 → 2029/30 | `ac9522c3d6bf48e5` = | `556fb28090aae457` = | `eaf01549ba0ed568` = |

Identical on both builds.

**Seed note (pre-existing limitation, not caused by this work).** With seed `club-identity-soak-new`, the fifth rollover (2030/31 → 2031/32) is refused with `DIVISION2_POOL_INSUFFICIENT` (district Norr: needs 2 eligible ranked clubs, has 1). The identical scenario on the untouched `76513bd` baseline is refused the same way at the same rollover. The soak therefore uses seed `club-identity-soak-new-b` for the NEW career; the limitation is reported for the competition owners.

## 4. Save/load and rollback

- Load → save → load is stable (`clubIdentityCareer.test.ts`: deep equality after a second load; soak: after every rollover).
- Migration never adds or removes the marker; it adds no rows while the Division 2 gate is closed.
- Rollback = revert the commits. Saves written by this build stay readable by the previous build (only an optional field and static-data ids differ).

## 5. Not verified

- Real Alpha tester saves (none available with consent).
- Production IndexedDB / portable-backup export–import through the browser UI with a five-season save (the pure functions and JSON round trips are covered; the UI path was not exercised end-to-end).
- A real (non-fast-match) five-season V2 match career; the soak uses the production fast-match competition pipeline and the production atomic transition.
