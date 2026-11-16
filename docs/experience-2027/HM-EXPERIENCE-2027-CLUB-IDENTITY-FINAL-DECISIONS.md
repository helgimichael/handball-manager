# HM Experience 2027: Club Identity, Final Decision Review

**Status:** Decision basis for owner approval. Planning only: no production code, game data, save, Alpha data or career was changed.
**Date:** 2026-11-14 (game-world date). Branch `design/hm-experience-2027`, based on commit `29777aa`.
**Companion documents:**
- `HM-EXPERIENCE-2027-CLUB-IDENTITY-MIGRATION-STRATEGY.md`: save and league mechanics, classes A/B/C.
- `HM-EXPERIENCE-2027-CLUB-IDENTITY-IMPLEMENTATION-ROADMAP.md`: phases C0–C8 and the test strategy.
- `HM-EXPERIENCE-2027-CLUB-IDENTITY-CORRECTION-PLAN.md`: the 33 findings and S1–S6; §6 of that plan now points here.

**Code basis.** Every statement about game behaviour below was checked against the worktree code (base `feat/m6-0-state-hygiene`, `ca0e85b`):
- `career/competitionMembership.ts:10-12`
- `career/seasonTransition.ts:88-136`
- `competition/transition/cooperationEligibility.ts:21-41`
- `career/clubPartnerships.ts:89-139`
- `save/saveRepository.ts:63-83, 184`
- `save/portableCareerBackup.ts:35-50`
- `career/careerInitialization.ts:148-200`
- `competition/transition/gameContinuity.ts`
- `career/historyCompaction.ts:33-58`

---

## 0. What changed since the correction plan

The correction plan (§1, §2.3, §5) assumed that the nine season-gated league moves need **save schema v9**, because they would write the current season into `competitionMembership` and then let `competitionHistory` apply. A closer read of the code shows a safer design that needs **no save-format change**:

1. `competitionMembership` is carried forward unchanged at every rollover. The Swedish transition copies the whole map (`seasonTransition.ts:114`) and rewrites only the Swedish leagues it models. Any foreign entry written into it would therefore be **frozen for the rest of the career**, not "applied from the next season". The plan's v9 freeze-then-apply mechanism would have needed a change to the Swedish transition to work at all.
2. The project has repeatedly added career-state fields through idempotent backfill on load **without** a version bump: `competitionMembership` (M03), `clubPartnerships` and the permanent B-team seeder (`saveMigration.ts:407-417`). The version comment at `saveRepository.ts:63-82` lists bumps only for envelope and format changes.

The design adopted here instead:
- **Freeze** the static `Club.competitionId` as the value every existing v8 career started from, the "legacy baseline". It is never edited again.
- **Add** a static, append-only, season-bounded `competitionHistory` for the real-world truth.
- **Add** a career-level marker `clubWorldBaseline`. When it is absent, the save is a legacy save.

A season-aware resolver then gives:
- existing careers their legacy league for the season in progress and the corrected league from their next season;
- new careers the corrected league immediately.

Nothing in an existing save is rewritten. Details are in MIGRATION-STRATEGY §3–§4.

**Consequence:** under the recommended options, **no correction strictly requires v9**. v9 becomes required only if the owner chooses an option this document advises against (D8-B, a retype of IF Kristianstad), or for a physical re-key or merge, which are rejected. A forward-compatibility guard is still recommended as a technical item (T7); it can be done without bumping the schema.

---

## 1. Decision overview

### 1.1 Already locked (not reopened here)

| # | Locked decision | Source |
|---|---|---|
| L1 | Arena Nights is the game's identity (B) | G1, 2026-11-13 |
| L2 | Dynamic Club Identity: the home shirt's dominant colour drives the club neon | Amendment 2026-11-13, Kit audit |
| L3 | Club Identity Registry keyed by the game's storage club id (202 clubs, data-driven, with sources and status) | Kit audit, Phase 2 |
| L4 | Black and white shirts use Ice Silver `#d7e1ee`; a documented trim is reference metadata only | G10, 2026-11-14 |
| L5 | Unknown shirt colours use the temporary default orange `#ff7a1a`. It is visibly marked, and the status stays UNKNOWN. A clubless manager also gets orange | G11, 2026-11-14 |
| L6 | Wrongly identified clubs are corrected, not just relabelled | G12, 2026-11-14 |
| L7 | All 231 surface recommendations and 551 alternatives are preserved | Amendment verification |
| L8 | Crests keep their original colours. B and U teams do not inherit parent colours without evidence | Phase 2 brief |
| L9 | Swedish cooperation rule: a club with an active SHF cooperation can play no higher than Division 1 and always below its parent (`highest = max(3, parentTier + 1)`, `cooperationEligibility.ts:35`). This logic is **not changed** by any option below | Production code, SHF TB 2026/27 kap. 9 |
| L10 | Correction plan guiding rules: an id is a storage key and is never reused; no merge on name similarity; keep the id when the meaning can stay the same; league moves never rewrite a season in progress | Correction plan, G12 |

### 1.2 Decisions that need owner approval

**Mandatory before implementation starts**

| # | Decision | Recommendation | Schema change? |
|---|---|---|---|
| D1 | Identity form for F01–F04 | Keep the storage key and the club players see; add canonical identity metadata | No |
| D5 | League freshness and the "career world vs real world" rule | Adopt 2026/27 reality for new careers; existing careers from their next rollover; a career's own simulated Swedish pyramid is never overwritten by real-world data | No (baseline marker) |
| D7 | HK Cliff presentation and selectability | Keep "HK Cliff" as the name with "Hammarby U" as the relation label; keep it selectable | No |
| D8 | IF Kristianstad relation | Keep the permanent B-team row; add `relationConfidence: PARTIAL` metadata | No (the retype option needs v9) |
| D9 | Division 2 second and U teams (11) | Model all 11 as static relations; seed the career rows only from the next season start; let an existing development partnership run to its end date | No |
| D11 | Alpha save fixtures | Commit anonymised exports as test fixtures, with the testers' consent | No |

**Can be decided later (non-blocking)**

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D2 | Add missing real clubs (BM Logroño, Horneo Alicante, Győri ETO) | Not now; add only with a real squad source | Nothing |
| D3 | Replacement for the retired `ger2-wilhelmshaven` | Decide at C5; any confirmed 2026/27 2. Bundesliga club | C5 only |
| D4 | Naming policy for sponsor names | Neutral names, with sponsor names as aliases | C2 display text only |
| D6 | F21 Teucro and "BM Córdoba" | Flag Teucro `approximate`; retire Córdoba and replace it at C5 | C5 only |

**Answered by locked decisions; confirmation only**

| # | Item | Why no new decision is needed |
|---|---|---|
| D10 | Affiliate kit fallback | G11 (orange fallback, status kept) and L8 (no inheritance without evidence) already answer it. Recommendation: confirm, and close §6.10 of the correction plan |

### 1.3 Technical questions (no product decision needed)

| # | Item | Resolution owner |
|---|---|---|
| T1 | Season-aware league resolver and frozen legacy baseline | Engineering (C4) |
| T2 | Per-club backfill instead of single sentinels (`careerInitialization.ts:173,187`) | Engineering (C5) |
| T3 | Generate `CANONICAL_CLUB_MAP` from club records; guard the lowercased-name matching | Engineering (C3) |
| T4 | External ids: SHF association id plus a per-season Profixio team registration (S5) | Engineering (C2), before the 2027/28 import |
| T5 | Competition alias for `hun-2` / `int-hun-2b` (S6): the direction is technical; keep `int-hun-2b` canonical because it is in the world pool | Engineering (C4) |
| T6 | Open research: Denmark's second promotee, Norway's 2026/27 movements, HCH rename date, HK S-hof on Profixio, Bodens BK reserve (S4) | Research (C0), before the corresponding data lands |
| T7 | Forward-compatibility guard: an older build warns when a save carries an unknown `clubWorldBaseline` or club ids it cannot resolve. The IndexedDB loader does not check the schema today (`saveRepository.ts:184`) | Engineering (C4) |
| T8 | History views resolve names per season (`clubDisplayName(id, seasonId)`) | Engineering (C1 resolver, C3 views) |

**New product decisions added by this review:** none. The question "should real-world data ever overwrite an existing career's world?" is needed for long careers, and is answered **inside D5** rather than added as a new decision, because it is the same freshness policy.

---

## 2. Decisions in detail

Each decision lists the problem, the affected parts of the game, at least two options with pros and cons, the recommendation, the effect on new careers and on existing v8 saves, and whether a schema change is needed.

### D1: Identity form for the four misidentified ids (F01–F04)

**Problem.** Four ids name one real club and hold another:
- `esp1-anaitasuna` holds Bidasoa;
- `esp1-logrono` holds Ademar León;
- `esp1-alicante` holds Anaitasuna;
- `hun1-gyor` holds Tatabánya.

What players see is correct. The id text is wrong.

**Affected parts:**
- foreign buyers (`market.ts:32,72`; esp-1 and hun-1 are in `FOREIGN_LEAGUES`);
- the world pool (scouting and transfer candidates);
- `clubKnowledge`;
- sold players' contracts and club history;
- the Club Identity Registry (keyed by id).

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A (recommended)** | Keep the storage key and the displayed club. Add `canonicalId` (for example `es-bidasoa-irun`), `legacyIdNote` and `externalIds`. Never re-point the key | Zero save impact; every stored reference stays valid; reversible | The id text stays misleading for developers, which is mitigated by `legacyIdNote` and a lint test |
| B | Physical re-key: new id, rewrite every key and value in saves | Clean ids | Needs v9 and a migration across about 20 fields. Embedded ids (`youth-<clubId>-…`, `generated-…-<clubId>-…`, `bteam-A-B`) cannot be rewritten. Irreversible without a backup. High risk |
| C | Re-point the keys to the club the id names (make `esp1-anaitasuna` = Anaitasuna) | Id text becomes true | Silently changes the meaning of stored references. A player sold to "Bidasoa" would appear at Anaitasuna. This breaks rule L10 |

- **Recommendation:** A.
- **New careers:** identical clubs; canonical metadata available to tools and the registry.
- **Existing saves:** no change at all.
- **Schema:** none.

### D2: Missing real clubs (BM Logroño La Rioja, Horneo Eón Alicante, Győri ETO-UNI FKC)

**Problem.** The real clubs that the F02–F04 id texts point at are absent from the game world.

**Affected parts:** foreign buyer pools by index (`market.ts:72-76`), and world pool size.

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** do not add them now; revisit when a squad source exists | No change to deterministic foreign-buyer picks; no clubs without players | The game world lacks three real clubs |
| B: add them under new ids (never under the misleading old ids) | More complete world | Changes the esp-1 and hun-1 pool size, so future foreign-bid picks differ between builds. Identity-only clubs add nothing to play |

- **Recommendation:** A. When they are added, new careers only, or for existing careers from the next season with T2 per-club backfill.
- **Schema:** none.
- **Timing:** later.

### D3: Replacement for the retired `ger2-wilhelmshaven` (F05)

**Problem.** The id names Wilhelmshavener HV (3. Liga), but it holds "TV Bittenfeld", a duplicate identity of TVB Stuttgart (`ger1-stuttgart`).

**Affected parts:** ger-2 only. It is not in `WORLD_POOL_COMPETITION_IDS` or `FOREIGN_LEAGUES`, it is not playable, and no career code reads ger-2.

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** retire the id as a tombstone (`status: retired`, kept forever). Add one confirmed 2026/27 2. Bundesliga club under a new id (candidates: TuSEM Essen, HC Dresden, VfL Lübeck-Schwartau, TV Großwallstadt, Bayer Dormagen, VfL Potsdam) | Keeps ger-2 at its size; no third meaning on the key | One new club to research (kit, city) |
| B: retire with no replacement | Least work | ger-2 is one club short (cosmetic, because foreign leagues have no fixtures) |
| C: re-point the id to the replacement club | No new id | Breaks L10; the key would carry a third meaning |

- **Recommendation:** A.
- **Timing:** later; the club can be chosen at C5.
- **New careers:** the replacement club is present.
- **Existing saves:** the tombstone keeps any stray reference resolvable.
- **Schema:** none.

### D4: Naming policy for sponsor names (F04, F16, S1)

**Problem.** Some names are stale sponsor names ("Telekom Veszprém", "Grundfos Tatabánya"), and HSV Hamburg now plays as Handball Club Hamburg.

**Affected parts:** display everywhere names are resolved live, and history views. Inbox and bid text keeps the old wording.

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** neutral names ("Veszprém KC", "Tatabánya KC"); current and earlier sponsor names go in `aliases` and `historicalNames`. Real renames that are not sponsor changes (Hamburg to HCH, Skanderborg AGF) are applied as names | Stable over seasons; fewer yearly edits; no sponsor branding in the game | Less "authentic" than broadcast names |
| B: current sponsor names (ONE Veszprém HC, MOL Tatabánya KC) | Matches broadcasts | Goes stale every sponsor cycle; each change is a history-view naming question |

- **Recommendation:** A.
- **Timing:** later; it only affects C2 display text.
- **Existing saves:** names change on the next load in structured views. Season history shows the season-correct name once T8 is in place.
- **Schema:** none.

### D5: League freshness, and career world vs real world

**Problem.** Foreign league lists reflect 2025/26 (F14, F15, F17–F21, S6, F03). Because `clubCompetitionId` falls back to the static `competitionId` (`competitionMembership.ts:11`), editing `clubs.ts` would move clubs **immediately and retroactively** in every existing career:
- world pool and foreign-buyer membership change;
- rating priors for new careers change (`clubContextTier.ts:34-36`).

Long careers also raise a related question: may later real-world data ever overwrite a running career's world?

**Affected parts:**
- world pool (`careerWorld.ts:19-23`);
- foreign buyers (`market.ts:32,72`);
- scouting discovery;
- rating priors;
- `worldCompetitions.ts:69`;
- the Swedish transition's size check (`seasonTransition.ts:134`, Swedish leagues only).

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** freeze static `competitionId` as the legacy baseline; add an append-only `competitionHistory` and a career marker `clubWorldBaseline`. New careers use 2026/27 truth now; existing careers keep the in-progress season and switch at their next rollover. Real-world data never overrides a career's own simulated Swedish pyramid | No retroactive change; no save rewrite; deterministic; works for any number of seasons | New resolver; every direct reader of `competitionId` must move to it (listed in MIGRATION-STRATEGY §4.3) |
| B: write current values into `competitionMembership` with a v9 migration (the plan's earlier proposal) | Uses an existing field | Foreign entries are frozen forever, because the Swedish transition only copies them. It needs a schema bump **and** a transition change to apply later seasons |
| C: edit `clubs.ts` directly | Trivial | Retroactive moves in every save; breaks guiding rule 4 (L10) |
| D: leave foreign leagues as 2025/26 | No work | The game world stays visibly outdated for new careers |

**Recommendation:** A, with this explicit policy for long careers:
1. Real-world data defines a career's **starting world**.
2. After the start, the Swedish pyramid belongs to the career's own simulation. Real-world Swedish promotions and relegations are **never** applied to an existing career.
3. Foreign leagues are not simulated. They follow the static `competitionHistory` season by season, and carry the last known season forward.
4. New real-world seasons are added as new `competitionHistory` entries. They reach existing careers only for seasons the career has not yet started.

- **New careers:** correct 2026/27 leagues immediately.
- **Existing saves:** unchanged until their 2026/27 → 2027/28 rollover; then the corrected foreign leagues apply.
- **Schema:** none (additive marker; absence = legacy).
- **Mandatory before implementation:** yes, because it fixes the shape of C4.

### D6: Spanish second tier (F21: Teucro, "BM Córdoba")

**Problem.**
- SD Teucro played the third tier in 2025/26.
- "BM Córdoba" was not found as a men's Plata club and may be an invented identity.

**Affected parts:** esp-2 only, which no career code reads.

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** Teucro keeps its id with `approximate: true`. Retire `esp2-cordoba` as a tombstone and add a confirmed Plata club (for example Servigroup Benidorm or BM Zamora) under a new id | Honest data; no invented clubs | One new club to research |
| B: keep both and flag them `approximate` | No new ids | Keeps a possibly invented club |
| C: re-label `esp2-cordoba` as another club | No new id | Breaks L10 |

- **Recommendation:** A.
- **Timing:** later (C5).
- **Existing saves:** none.
- **Schema:** none.

### D7: HK Cliff presentation (F22, F30)

**Problem.** HK Cliff is a separate association whose Division 1 licence is used by Hammarby IF HF's U team (19/19 players registered with Hammarby). The game already models it as Hammarby's permanent B team (`clubPartnerships.ts:89`), and the id can be a manager's club.

**Affected parts:**
- New Game list;
- job market (`managerCareer.ts:132`);
- partnership rows (`bteam-se_club_hammarby_if_hf-se_club_hk_cliff`);
- the cooperation rule (L9);
- the registry kit (yellow, measured; F30).

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** name stays "HK Cliff". Show a relation label "Hammarby U · HK Cliff licence" in club headers and the club list. Keep it selectable | Matches league tables and Profixio; honest about the relation; zero save impact | One label to design (the Arena Nights club header already has a sub-line) |
| B: rename to "HK Cliff (Hammarby U)" | Self-explanatory | Diverges from official tables; the name text appears in fixtures and tables |
| C: make it non-selectable | Avoids managing a U team | `getCareerClub` throws for any Alpha tester managing Cliff (`careerWorld.ts:47-50`). Breaks saves |

- **Recommendation:** A.
- **New careers and existing saves:** unchanged, plus the label.
- **Kit:** Cliff yellow as measured (PROBABLE); it never inherits Hammarby green (L8). Align the `clubs.ts` placeholder colour at C7.
- **Schema:** none.
- **Mandatory before implementation:** yes, because C6 relation labels depend on it.

### D8: IF Kristianstad relation (F23)

**Problem.** IF Kristianstad is a separate association closely linked to IFK Kristianstad. Most of its players are registered with IF Kristianstad itself; only 3 are registered with IFK. The game treats it as IFK's permanent B team.

**Affected parts:**
- cooperation eligibility (L9: it can go no higher than Division 1 and must stay below IFK);
- partnership offers (`isPermanentBTeamClub`);
- loan and ownership semantics (`clubPartnerships.ts:375-398`).

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** keep the permanent `AFFILIATED_B_TEAM` row. Add static metadata `relation: PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS`, `relationConfidence: PARTIAL` and the evidence | No change to cooperation logic (L9) or saves; the SHF cooperation cap still applies, which is plausible for a partner club in reality | The model slightly overstates the ownership link |
| B: retype the row to a new `PARTNER_ASSOCIATION` type | More precise | Needs a new `PartnershipType`, a rewrite of an existing row, and **v9**: an older build would read an unknown type and treat the club as uncapped (`cooperationEligibility.ts:30`). It also changes cooperation logic, which this review must not do |

- **Recommendation:** A.
- **New careers and existing saves:** unchanged.
- **Schema:** none under A; **v9 under B**.
- **Mandatory before implementation:** yes, because it decides whether C6 contains a v9 step.

### D9: Division 2 second teams and U teams (F27, F28, S2: 11 teams)

**Problem.** Eleven Division 2 teams are second or U teams of higher clubs, shown by player registrations on Profixio:
- Lugi U, HF Karlskrona U, Ystads IF U;
- Tumba HK, VästeråsIrsta HK, HK Varberg 09, Helsingborgs HK, Malmö HP, HK Lif Blå, HK Ystadpågarna;
- Lunds HS Lejon.

No relation is modelled, so the game lets them:
- be offered as `DEVELOPMENT_PARTNERSHIP` candidates;
- promote above the cooperation cap.

**Affected parts:**
- partnership candidate lists (`clubPartnerships.ts:99-101`);
- cooperation eligibility during Swedish transitions (`seasonTransition.ts:121-123`, L9);
- Division 2 pools (`gameContinuity.ts`);
- name resolution (`canonicalClubNames.ts:82-86,132-137`).

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** add 11 static relations (`parentClubId`, `relation`, `relationConfidence`, `validFrom: 2026/27`). In careers, seed `AFFILIATED_B_TEAM` rows through a **separate** idempotent seeder whose rows start at the **next** season start, so the in-progress season is not changed retroactively. An existing active development partnership with one of these teams runs to its `endDate` and cannot be renewed | Reality-backed; cooperation logic untouched (it already understands `AFFILIATED_B_TEAM`); no retroactive change; no rewrite | Changes future promotion outcomes in existing careers from the next season. This is intended, because it reflects real SHF rules |
| B: static metadata only, no career rows | Zero gameplay effect | These teams can still be "promoted" past real SHF limits and offered as partners |
| C: seed rows effective immediately (extend `PERMANENT_B_TEAM_PAIRS`) | Simplest code | Changes the current season's partnership offers and the next transition evaluation retroactively, because `isPermanentBTeamClub` reads the constant directly |

**Sub-decision: an existing active development partnership with a newly linked team.**
- A1 (recommended): let it run to `endDate`, with no renewal. Nothing is rewritten.
- A2: terminate it at the migration date with a refund. This rewrites a row and an economy entry.

**Effect of the cap.** A Division 2 second team whose parent plays in Division 1 (HK Lif Blå → LIF Lindesberg, tier 3) gets `highest = max(3, 3 + 1) = 4`. It can never leave Division 2 while the relation is active. That is the real SHF rule and is preserved, not changed (L9).

- **New careers:** relations active from 2026/27 (career start).
- **Existing saves:** rows appear on load but take effect at the next season start.
- **Schema:** none (additive idempotent backfill, the same precedent as `seedPermanentBTeamPartnerships`).
- **Mandatory before implementation:** yes.

### D10: Affiliate kit fallback (F33): confirmation only

**Problem.** Second and U teams often have no verified kit.

**Answer already given:**
- G11: default orange fallback, marked "Klubbfärg ej verifierad", status stays UNKNOWN;
- L8: no inheritance without evidence.

**Current registry state (checked 2026-11-14):**
- 4 of the 11 Division 2 affiliates use the fallback (VästeråsIrsta HK, HK Varberg 09, Malmö HP, Lunds HS Lejon);
- 7 have their own measured kit;
- none inherits the parent's colour.

**Options:**
- A (recommended): confirm and close.
- B: show the parent's colours behind an `UNVERIFIED` flag. This would reopen L8 and is not advised.

**Schema:** none.

### D11: Alpha save fixtures

**Problem.** Save-compatibility coverage today is synthetic:
- `alpha3SaveCompatibility.test.ts`;
- `m10SaveIntegrity.test.ts`;
- `scripts/m6-0-old-saves.ts`.

No real save proves that identity changes leave real careers intact.

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** ask testers for their feedback export; anonymise the manager name and date of birth; commit the files as fixtures under `apps/game/lib/save/__fixtures__/` | Real coverage of every field in MIGRATION-STRATEGY §2 | Needs tester consent; some files are large (match archives can be trimmed) |
| B: synthetic fixtures generated by playing scripted careers | No personal data | Misses real-world paths (unusual transfers, partnerships, mid-season saves) |

- **Recommendation:** A, plus B for the five-season soak (ROADMAP C8).
- **Schema:** none.
- **Mandatory before implementation:** yes (C0 exit criterion).

---

## 3. Visual identity: consistency check under corrected identities

| Rule | Still consistent? | Effect of identity corrections |
|---|---|---|
| Home shirt's dominant colour drives the neon | Yes | A kit belongs to the **storage id plus season**. F01, F02 and F04 keep their kits, because the displayed identity is kept (D1). F03 (Anaitasuna) stays UNCERTAIN until re-researched |
| Black and white shirts use Ice Silver | Yes | 45 clubs. `ger2-wilhelmshaven` is currently Ice Silver from the **TV Bittenfeld e.V.** amateur kit, which is the wrong entity. On retirement the kit is removed and the tombstone renders with the fallback (see "Retired clubs" below) |
| Unknown colours use default orange | Yes | New ids (Bietigheim, KIF Kolding, the replacements) enter the registry as `NOT_RESEARCHED` and show the fallback until evidence exists. The verifier already enforces "no colour without a source" |
| Clubless manager uses orange | Yes | `managedClubId()` is undefined while the manager is seeking a job (`managerCareer.ts:127-129`). This is the production hook for the clubless accent |
| Crests keep their original colours | Yes | Unaffected |
| B and U teams do not inherit parent colours | Yes | Checked: none of the 16 affiliate or B-team ids inherits. HK Cliff is Cliff yellow (not Hammarby green); Tumba HK is blue from its own evidence |
| Verification status and fallback status are separate | Yes | Fallback applies to UNKNOWN or NOT_RESEARCHED only. UNCERTAIN keeps its documented colour (for example HK Önnerediterna) |

**Adjustments needed when identities are corrected.** These are technical consequences of L2–L8, not new rules:
1. **Renamed clubs keep their kit.** A new name does not invalidate a kit unless evidence shows a rebrand. Examples: Handball Club Hamburg, Skanderborg AGF, Dessau-Roßlauer HV.
2. **Retired clubs.** A tombstone keeps its registry entry with `status: retired` and `kit: null`. It renders with the fallback orange and the "Klubbfärg ej verifierad" marker in historical views. A stale kit from a different entity is never kept.
3. **Relation labels never change colours.** The parent relation (D7, D9) is shown as text, never as a colour.
4. **Registry joins.** The registry gains `canonicalId`, `status`, `relation` and `parentClubId`, copied from the club record by the build script and never edited by hand. Its key stays the storage id.

---

## 4. Summary for approval

**Needs your approval (mandatory before implementation):**
- D1 (keep keys, canonical metadata);
- D5 (freshness and the career-world policy);
- D7 (HK Cliff label, selectable);
- D8 (IF Kristianstad stays a B team with metadata);
- D9 (11 relations, effective from the next season; existing development partnerships run out);
- D11 (anonymised Alpha fixtures).

**Can wait:**
- D2 (missing clubs);
- D3 (F05 replacement club);
- D4 (naming policy);
- D6 (Córdoba).

**Confirmation only:** D10 (covered by G11 and L8).

**Locked:** L1–L10.

**Without any save migration:** all recommended options. See MIGRATION-STRATEGY §5 for the full A/B/C classification.

**Requires v9:** only D8-B (retype), or a physical re-key or merge. All of these are advised against.
