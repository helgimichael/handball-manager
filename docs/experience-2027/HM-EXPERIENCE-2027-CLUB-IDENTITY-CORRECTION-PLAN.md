# HM Experience 2027: Club Identity Correction Plan

**Status:** Proposal only. No game data, save, registry entry or career was changed. Nothing here is migrated.
**Date:** 2026-11-14
**Owner decision G12 (2026-11-14):** "CORRECT: we approve correcting incorrectly identified clubs rather than merely changing their displayed names." This plan says how each identity would be corrected, and with what consequences for careers and saves, before any controlled production change.
**Inputs:** `HM-EXPERIENCE-2027-CLUB-DATABASE-IDENTITY-FINDINGS.md` (F01–F33), `apps/game/lib/game-data/clubs.ts`, `swedishDivision2.ts`, `competition/transition/sweden2026Data.json`, `canonicalClubNames.ts`, `clubVenues.ts`, `competitions.ts`, the career and save code under `apps/game/lib`, and `design-lab/experience-2027/club-identity/registry.json`.
**Re-checked on the web for this plan (2026-11-14):** Lunds HS Lejon on Profixio, the HSV Hamburg rename, the Eger tier, the Danish 2025/26 relegation and promotion, the Norwegian top flight, the Slovenian Liga NLB, Fram's tier and the Eskilstuna Guif name. The results are listed under each issue. Evidence for the other findings is carried over from the findings document and its sources.

> **Final decision review, 2026-11-14.** This plan is now read together with three companion documents:
> - `HM-EXPERIENCE-2027-CLUB-IDENTITY-FINAL-DECISIONS.md` (D1–D11, locked L1–L10, technical T1–T8);
> - `HM-EXPERIENCE-2027-CLUB-IDENTITY-MIGRATION-STRATEGY.md` (MS);
> - `HM-EXPERIENCE-2027-CLUB-IDENTITY-IMPLEMENTATION-ROADMAP.md` (phases C0–C8).
>
> One conclusion here is **superseded**: season-gated league moves (strategy **S**) no longer need save schema v9. The static `competitionId` is frozen as the legacy baseline, real seasons go into an append-only `competitionHistory`, and an optional career marker `clubWorldBaseline` (absent = legacy save) drives a season-aware resolver. Existing careers keep their in-progress season and switch at their next rollover; nothing in a save is rewritten (MS §3).
>
> Under the recommended decisions no correction requires v9. v9 is needed only for the not-recommended F23 retype (D8-B), a re-key or a merge. Superseded passages below are marked *[superseded: see MS]*; the evidence and per-issue analysis are unchanged.

**Guiding rules**

1. A club id is a storage key, not a label. It is never reused for a different real club.
2. Do not merge clubs only because their names are similar. A merge needs evidence that both ids are the *same playing entity in the same season*.
3. Keep the id whenever the stored meaning can stay the same. Re-key, through an alias, only when keeping the id would itself be the identity error.
4. League moves are bound to seasons. They never rewrite a season that is in progress.

---

## 1. Summary table

Evidence strength: **H** high, **M** medium, **L** low. Career/save risk is the risk to *existing* careers, including Alpha testers, if the recommended strategy is used.

Strategy codes (defined in section 2.3):
- **D**: data-only correction, id kept.
- **S**: season-gated league move, id kept.
- **A**: alias plus canonical metadata, storage key kept.
- **R**: retire the id as a tombstone and add a new id.
- **N**: add a new club under a new id.
- **P+**: add a relationship row (additive migration).
- **P~**: retype or remove a relationship row (explicit migration).
- **K**: kit or registry only.

| # | Current id | Current identity (game) | Correct identity | Class | Evidence | ID retained? | Career/save risk | Migration strategy |
|---|---|---|---|---|---|---|---|---|
| F01 | `esp1-anaitasuna` | Bidasoa Irun, Irun, esp-1 | CD Bidasoa (Irudek Bidasoa Irún), esp-1. The id's name points at SD Anaitasuna | Incorrect identity | H | Yes, as storage key; canonical id corrected | Low | A (+K) |
| F02 | `esp1-logrono` | Ademar León, León, esp-1 | CB Ademar León, esp-1. The id's name points at BM Logroño La Rioja | Incorrect identity | H | Yes, as storage key | Low | A (+ optional N for Logroño) |
| F03 | `esp1-alicante` | Helvetia Anaitasuna, Pamplona, esp-1 | SCDR Anaitasuna, Pamplona, **esp-2** (Plata) for 2025/26 and 2026/27 | Incorrect identity + league | H | Yes, as storage key | Low | A + S (+ optional N for Alicante) |
| F04 | `hun1-gyor` | Grundfos Tatabánya, Tatabánya, hun-1 | MOL Tatabánya KC, hun-1. The id's name points at Győri ETO-UNI FKC | Incorrect identity + stale name | H | Yes, as storage key | Low | A + D (+ optional N for Győr) |
| F05 | `ger2-wilhelmshaven` | TV Bittenfeld, Waiblingen, ger-2 | Duplicate of TVB Stuttgart (`ger1-stuttgart`). Wilhelmshavener HV is 3. Liga | Duplicate club | H | No: retired as tombstone, never reused | None | R + N (replacement 2. BL club) |
| F06 | `ger2-dessau` | "SC DHfK Dessau" | Dessau-Roßlauer HV 06 (Dessau-Roßlau), ger-2 | Alias / historical name | H | Yes | None | D |
| F07 | `den2-fif` | FIF Håndbold, Fredensborg | FIF Håndbold (Frederiksberg IF), Frederiksberg | League/country/city | H | Yes | None | D |
| F08 | `esp2-cisne` | Cisne, Ourense | Club Cisne, Pontevedra | League/country/city | H | Yes | None | D |
| F09 | `den1-hoj` | HØJ Elite, Hjørring | HØJ Elite, Ølstykke/Jyllinge | League/country/city | H | Yes | None | D (league move is F15) |
| F10 | `hun2-eger` | "Egri Spartacus" | Eger-Eszterházy SzSE (sponsor name QHB-Eger), NB I/B | Alias / historical name | H (raised from M) | Yes | None | D (+ competition note S6) |
| F11 | `den1-sonderjyske` | SønderjyskE, Aabenraa | SønderjyskE Håndbold, Sønderborg | League/country/city | H (raised from M) | Yes | None | D |
| F12 | `den2-aarhus` | Aarhus Håndbold Herrer, den-2 | The 2024 Aarhus Håndbold, 1st Division; **not** the pre-2021 Århus Håndbold | Dissolved/renamed (suspicion refuted) | H | Yes | None | D (comments, `historicalNames` boundary) |
| F13 | `den1-skanderborg` | "Skanderborg Aarhus" / "Skanderborg AGF" | Skanderborg AGF Håndbold (renamed June 2023) | Dissolved/renamed | H | Yes | Low (REAL_WORLD squad keyed by id) | D + `historicalNames` |
| F14 | `ger1-leipzig`, `ger1-minden`, `ger2-balingen` (+ Bietigheim missing) | 2025/26 Bundesliga list | Leipzig and Minden to ger-2; Balingen and Bietigheim to ger-1 for 2026/27 | League | H | Yes | Low–Med | S + N (Bietigheim) |
| F15 | `den1-hoj`, `den1-grindsted` (+ KIF Kolding missing) | 2025/26 Håndboldligaen | Both relegated; KIF Kolding promoted via play-off | League | H | Yes | Low–Med | S + N (Kolding) |
| F16 | `hun1-veszprem`, `hun1-gyor` | Telekom Veszprém; Grundfos Tatabánya | ONE Veszprém HC; MOL Tatabánya KC (or neutral names) | Dissolved/renamed | H | Yes | Low (Veszprém REAL_WORLD) | D + `historicalNames` |
| F17 | `nor1-bodo`, `nor2-fjellhammer`, `nor2-sandnes` | Bodø nor-1; Fjellhammer, Sandnes nor-2 | Fjellhammer and Sandnes nor-1; Bodø nor-2 (1. divisjon) | League | H | Yes | Low–Med | S |
| F18 | `isl2-fram` | Fram, isl-2 | Fram, isl-1 (2024/25 champions, in the 12-club top flight) | League | H | Yes | Low | S |
| F19 | `svn2-skofjaloka`, `svn2-jeruzalem` | svn-2 | Both in the 12-club Liga NLB (svn-1) | League | H (raised from M) | Yes | None | S |
| F20 | `hun2-komlo` | Komlói Bányász, hun-2 | Carbonex-Komló, NB I (hun-1) | League | H | Yes | Low | S |
| F21 | `esp2-teucro`, `esp2-cordoba` | Plata | Teucro: third tier in 2025/26. "BM Córdoba": not found in Plata | League | M / L | Yes (Teucro); Córdoba: owner decision | None | S or flag `approximate` (Córdoba: R + N if replaced) |
| F22 | `se_club_hk_cliff` | HK Cliff, Div 1 Norra, B team of Hammarby | Hammarby IF HF's U team playing under the HK Cliff association licence | B/U-team relationship | H | Yes | None (keep) / High (if removed) | Keep row; add `licenceHolder` metadata |
| F23 | `se_club_if_kristianstad` | Permanent B team of IFK Kristianstad | Partner/development association (most players registered with IF Kristianstad itself) | B/U-team relationship | M | Yes | Med | P~ (owner decision) |
| F24 | `se_club_hp_alingsas` | B team of Alingsås HK | Confirmed | B/U-team relationship | H | Yes | None | none |
| F25 | `se_club_hk_onnerediterna` | B team of Önnereds HK | Confirmed | B/U-team relationship | H | Yes | None | none |
| F26 | `se_club_hk_s_hof` | B team of IK Sävehof | Probable | B/U-team relationship | M | Yes | None | Verify; none |
| F27 | 3 Div 2 "U" ids | Independent Div 2 teams | U teams of Lugi, HF Karlskrona, Ystads IF | B/U-team relationship | H | Yes | Low | P+ |
| F28 | 7 Div 2 ids | Independent Div 2 teams | Second teams of IFK Tumba, VästeråsIrsta HF, HK Varberg, OV Helsingborg, HK Malmö, LIF Lindesberg, IFK Ystad HK | B/U-team relationship | H | Yes | Low | P+ |
| F29 | `se_div2_team_1578270` | Torslanda HK | Separate club, partial youth link to HK Torslanda Elit | B/U-team relationship | M | Yes | None | Do not model a B team |
| F30 | `se_club_hk_cliff` (kit) | Hammarby green in clubs.ts; yellow in registry | Yellow/navy measured for the "Cliff" team (Feb 2026) | Kit (dependent) | M | Yes | None | K |
| F31 | F01–F05 ids (kits) | Kits match the displayed name | Follows the identity decision | Kit (dependent) | H | Yes | None | K |
| F32 | `den2-aarhus` (kit) | Registry kit | Phase 2 already re-researched it (maroon/white/navy hoops from aarhush.dk) | Kit (dependent) | M | Yes | None | K (close) |
| F33 | Div 1 / Div 2 affiliates (kits) | null or parent colours | Unknown until evidenced | Kit (dependent) | M | Yes | None | K + fallback rule |
| S1 | `ger1-hamburg` | HSV Hamburg | Now competes as **Handball Club Hamburg (HCH)**; legal history: HSV Handball (insolvent 2016) to Handball Sport Verein Hamburg to HCH | Dissolved/renamed | M–H | Yes | Low | D + `historicalNames` |
| S2 | `se_div2_team_1576008` | Lunds HS Lejon (independent) | Second team of H43 Lund HF (19/19 players registered with H43 Lund HF) | B/U-team relationship | H | Yes | Low | P+ |
| S3 | `swe2-guif` | clubs.ts "Eskilstuna Guif IF"; canonical map "HK Guif" | Eskilstuna Guif. The canonical map's "HK Guif" is unsupported | Alias / historical name | M | Yes | None | D (single source of names) |
| S4 | (no id) Bodens BK Div 2 registration 1577093 | `AMBIGUOUS_SENIOR_RESERVE`, not imported | Reserve team of Bodens BK HF (unconfirmed) | B/U-team + external id | L | n/a | None | Keep unresolved until verified |
| S5 | all `se_div2_team_<profixioTeamId>` | Id embeds a Profixio *team registration* id | A season-scoped registration, not a club or association id | External id | H (structural) | Yes (frozen) | Low now, Med from 2027/28 | Add `externalIds` + registration history |
| S6 | `hun-2` vs `int-hun-2b` | Two competitions for one real league (NB I/B) | One competition | League | H | Competition ids retained | Low | S (competition alias) |

**Counts by class (33 findings):**

| Class | Count |
|---|---|
| Incorrect identity | 4 (F01–F04) |
| Duplicate club | 1 (F05) |
| League/country/city assignment | 11 (F07, F08, F09, F11, F14, F15, F17, F18, F19, F20, F21) |
| Dissolved or renamed | 3 (F12, F13, F16) |
| Alias / historical name | 2 (F06, F10) |
| B/U-team relationship | 8 (F22–F29) |
| Kit, dependent on identity | 4 (F30–F33) |

None of the 33 is primarily an external-id error. External ids are a secondary concern in F22–F29 and the main concern in S4–S5. Six supplementary items (S1–S6) were found while preparing this plan. They are listed separately and are not renumbered into the 33.

**IDs retained vs migration needed:**
- **32 of 33** findings keep every existing storage id.
- **1** (F05 `ger2-wilhelmshaven`) retires an id as a tombstone. It is never deleted and never reused.
- **Save migrations required** *[superseded: see MS §5. All of these are now class A or B and need no schema change and no rewrite. Only the F23 retype (D8-B) would be class C / v9.]*: a *season-gated competition move* for 9 findings (F03, F14, F15, F17, F18, F19, F20, F21, and S6); *additive relationship rows* for F27, F28 and S2 (11 Division 2 ids); *one retype* if the owner downgrades IF Kristianstad (F23).
- **Physical re-keying** (a new id plus rewriting keys inside saves) is **not** recommended for any finding. F01–F04 are corrected by giving each storage key a correct canonical identity and alias, not by renaming keys inside saves.

---

## 2. How club IDs flow through careers and saves

### 2.1 Where the id lives

**Static data, resolved at read time.** `clubs.ts` builds one `CLUBS` array (`apps/game/lib/game-data/clubs.ts:301`). Every lookup goes through `getClub(id)` and `getClubsByCompetition(competitionId)` (`clubs.ts:303-309`). The `club()` helper attaches the venue by id from `clubVenues.ts` (`clubs.ts:14-20`, `clubVenues.ts:19-48`). Division 2 clubs are generated from `sweden2026Data.json`. Their id is `canonicalClubId`, and the Profixio registration is kept in `sourceRegistration` (`swedishDivision2.ts:14-21`). **Consequence:** name, shortName, city, colours and the static `competitionId` are **not** stored in saves. Changing them in `clubs.ts` changes every existing career on its next load.

**The save envelope** (`apps/game/lib/save/saveRepository.ts`):
- `CURRENT_SAVE_SCHEMA_VERSION = 8` (`:83`). The version history is in the comment at `:63-82`.
- `CareerSave.clubId` (`:90`) and `selectedCompetitionIds` (`:88`).
- Every career write rewrites the envelope's `clubId` from `careerState.playerClubId` and stamps the current schema (`:376-384`).
- Saves with no version are tagged v1 (`:184`).
- Portable backups are validated against the current schema (`:441`, `:464`). `portableCareerBackup.ts:35` **rejects a backup whose `schemaVersion` is newer than the build**, and `:50` requires `careerState.playerClubId === save.clubId`.

**CareerState** (`apps/game/lib/career/types.ts`) stores club ids as values and as map keys throughout:
- Values: `playerClubId` (`:120`), `CareerFixture.homeClubId/awayClubId` (`:64-65`), `seasonHistory[].table` rows (`StandingRow.clubId`, `packages/game-simulation/src/table.ts:17-30`), `seasonHistory[].competitionId` (`:117`), and `staffAppointments[].clubId` (`:564`).
- Maps keyed by club id: `clubForm` (`:143`), `worldSquads` (`:187`), `aiTacticalPreferences` (`:213`), `gameplayRatings` (`:260`), `staffRoster` (`:437`), `clubEconomies` (`:544`), `competitionMembership` (`:552`), `clubKnowledge` (`:652`), `clubPartnerships` (`:696`, row id format `bteam-<A>-<B>`, `clubPartnerships.ts:109-111`), and `youthIntakeClubYears` (`:771`).
- Records that carry a `clubId`: player contracts and club history (`:509`, `:525`; `economy/types.ts:36,64,94`), and incoming offers (`:569`).

**Ids baked into other ids.**
- Generated Division 2 players: `generated-<model>-<seed>-${clubId}-<season>-<n>` (`career/promotionSquads.ts:32`).
- Youth players: `youth-${clubId}-${year}-${index}` (`career/youthIntake.ts:596`).
- Deterministic seeds: `${saveSeed}:${clubId}:${year}` (`youthIntake.ts:112`, `academyCohortYear.ts`).
- Real fixture ids embed Profixio match ids next to club ids (`game-data/realLeagueSchedules.ts:207`).
- Real-world roster files carry `clubId` per entry. Example: `data/real-world/international/2026-27/hun_1/ONE Veszprém/roster-one_veszprem-2026-27.json` has `"clubId": "hun1-veszprem"`, and the folder `den_1/SAH - Aarhus/` feeds `den1-skanderborg`. They are bundled by `apps/game/scripts/generate-real-world-bundle.mjs:10-24`.

**Names baked into text.**
- Inbox messages store rendered `subject`, `preview` and `body` strings (`game-data/types.ts:242-251`).
- Foreign bids bake the buyer's display name into the motive text (`players/market.ts:76`, `:117`).
- **Corrected names therefore never reach old inbox items.** That is acceptable as history, but it should be documented.

**Load path and migration hook.**
- Every career load runs `migrateCareerState` (`career/careerInitialization.ts:148`). It is idempotent and works field by field (`career/saveMigration.ts:69`).
- The migration already seeds permanent B-team rows (`saveMigration.ts:417`, `clubPartnerships.ts:119-139`) and qualification squads (`saveMigration.ts:572`).
- Backfills are detected by **one sentinel club id**: Division 1 by `se_club_bodens_bk_hf` (`careerInitialization.ts:173-174`) and the world pool by `ger1-kiel` (`:187`). **A new REAL_WORLD club added later will not be backfilled into existing saves** unless the sentinel logic becomes per-club.

**League membership.**
- `clubCompetitionId(state, clubId)` = `state.competitionMembership[clubId] ?? getClub(clubId).competitionId` (`career/competitionMembership.ts:10-12`).
- Membership overrides are written only by the Swedish season transition (`career/seasonTransition.ts:114,154`).
- **For every non-Swedish club, the static `competitionId` is the live answer.** Editing it in `clubs.ts` moves the club mid-season in every save.

**Where foreign clubs enter a career.**
- **World pool:** `WORLD_POOL_COMPETITION_IDS` lists only tier-1 foreign leagues plus `int-*` (`career/careerWorld.ts:19-23`). It feeds scouting and transfer candidates (`careerWorld.ts:41-43`) and economic identity (`worldPoolIntegration.ts:17-25`).
- **Foreign buyers:** `FOREIGN_LEAGUES = ger-1, den-1, nor-1, esp-1, hun-1` (`players/market.ts:32`). A foreign buyer is chosen **by index into `getClubsByCompetition`** (`market.ts:72-76`). Any club in those leagues can therefore appear in a saved offer, contract or club history, including non-REAL_WORLD ones such as `esp1-anaitasuna`, `esp1-logrono` and `hun1-gyor`. Adding or removing a club in those leagues changes which club future deterministic picks select. It does not change past offers.
- **Not referenced anywhere in career code:** the lower foreign tiers (`ger-2`, `den-2`, `esp-2`, `hun-2`, `nor-2`, `isl-2`, `svn-1`, `svn-2`). A grep outside `clubs.ts` and `competitions.ts` returns nothing. These clubs reach a save only through `selectedCompetitionIds` and generic maps such as `clubKnowledge`.
- **Rating priors:** these read the static `competitionId` (`rating/gamePrior/clubContextTier.ts:34-36`, `:122-146`). Existing saves keep their snapshotted `gameplayRatings`. New careers would see different priors after a tier move.

**Which clubs can be the manager's club.**
- New Game offers `playable` clubs only (`app/new-game/page.tsx:51-53`). Job offers come from simulated Swedish leagues only (`manager/managerCareer.ts:132`).
- `getCareerClub` **throws** if `playerClubId` does not resolve (`careerWorld.ts:47-50`). Retiring a playable id would therefore break that career on load.
- Of the ids in this plan, only `se_club_hk_cliff` and the other Division 1 ids can be a `playerClubId`.

**Hard-coded ids.**
- `TUMBA_CLUB_ID = "swe2-tumba"` (`clubs.ts:311`), used in `careerWorld.ts:57` (mock-squad fallback), `game-data/players.ts:111`, `game-data/staff.ts:6-10` and the New Game ordering (`app/new-game/page.tsx:51`).
- Other literals: `swe2-tumba` in `competition/transition/gameContinuity.ts:43` (north set), `economy/clubEconomySignals.ts:30` and `realLeagueSchedules.ts`.
- `PERMANENT_B_TEAM_PAIRS` (`clubPartnerships.ts:89-95`).
- `CANONICAL_CLUB_MAP` (`canonicalClubNames.ts:14-72`). It also matches by **lowercased name** (`:82-86`), which can confuse similar names. See F28 and S3.

**Alias and canonical-name maps today.** The only one is `CANONICAL_CLUB_MAP` / `getCanonicalClubName` (`canonicalClubNames.ts:77-112`). It covers the 52 Swedish tier 1–3 ids and maps id or name to a display name. There is **no id-alias mechanism**: an unknown id falls through to `getClub`, and then to the raw string (`:109-112`).

**Alpha.** Testers' careers live in IndexedDB, one record per save (`saveRepository.ts:17-34`). The feedback button exports the active career and its match archive as the portable JSON (`apps/game/ALPHA.md`). Existing compatibility coverage is synthetic: `career/alpha3SaveCompatibility.test.ts`, `career/m10SaveIntegrity.test.ts` and `scripts/m6-0-old-saves.ts`. No real Alpha save fixtures are committed.

### 2.2 Consequences of each correction mechanism

**(a) Keep the id and correct its data (`name`, `shortName`, `city`, kit, venue).**
- Saves load unchanged. Every structured reference (fixtures, tables, contracts, history, offers) shows the corrected name on the next load.
- Old inbox and news text keeps the old name.
- Deterministic generation stays the same, because seeds use the id (`youthIntake.ts:112`).
- Changing `city` can change derby or geography logic. For a Swedish club, also check the hard-coded north set (`gameContinuity.ts:43`).
- Changing static `competitionId` is **not** "data only". It moves the club immediately in every save (`competitionMembership.ts:10-12`), changes world-pool and foreign-buyer membership (`careerWorld.ts:19-23`, `market.ts:32,72`), and changes rating priors for new careers. It must therefore be season-gated (mechanism S below).
- Risk: none to low.

**(b) Alias an id (keep the storage key and add canonical identity metadata, or have a legacy key resolve to a canonical key).**
- In this plan's preferred form, **the storage key stays** and a `canonicalId` plus `legacyIdNote` are added to the club record and the registry. No save data changes.
- In the stronger form (a legacy key resolves to a different storage key), every reader must call `resolveClubId()` before `getClub`. Map lookups such as `worldSquads[id]` and `gameplayRatings[id]` would also need either a resolve step or a one-time rewrite of the keys. Ids embedded in other ids (`youth-<clubId>-…`, `generated-…-<clubId>-…`, `bteam-<A>-<B>`) **cannot be rewritten safely**, because they are player and partnership identities. They keep the legacy text for good.
- Risk: none in the preferred form, medium in the stronger form.

**(c) Introduce a new id and migrate.**
- Needs a schema bump (v8 to v9) and a migration in `migrateCareerState`.
- The migration would rewrite every value and map key listed in 2.1, but leave embedded ids as they are.
- It is irreversible in practice. `portableCareerBackup.ts:35` rejects a v9 backup in a v8 build, so rollback needs the pre-migration export.
- Any missed reader produces `getClub(undefined)` gaps. `getCareerClub` throws for a manager club.
- Risk: high for clubs that appear in saves (Swedish ids and FOREIGN_LEAGUES clubs). **Not recommended for any finding.**

**(d) Merge duplicates.**
- Both ids' squads, contracts, history, economy rows, knowledge and partnership rows would need combining. Collisions would be unavoidable: two `clubEconomies` baselines, two staff rosters, two fixture-list entries in the same competition.
- Players' generated ids keep the losing id.
- A merge is only legitimate when both ids are provably the same playing team in the same season. **None of the 33 qualify**:
  - F05 is a duplicate *identity* sitting under an id whose own name is a third club. The fix is to retire that identity, not to merge it into `ger1-stuttgart`.
  - Tumba HK / IFK Tumba HK, VästeråsIrsta HK / HF, Helsingborgs HK / OV, Malmö HP / HK Malmö and Lunds HS Lejon / H43 are **different registered teams** that belong together. They are linked (P+), never merged.
- Risk: high.

**(e) Retire an id.**
- The id stays in `CLUBS` as a **tombstone**: `status: "retired"`, `playable: false`, no `competitionId` membership in future seasons, and a `retiredReason`.
- `getClub` still resolves it, so old fixtures, tables and archives render. `getClubsByCompetition` stops returning it for seasons after `validTo`.
- It must never be deleted from data. Deleting it would break any save that references it, and every history view would fall back to the raw id string (`canonicalClubNames.ts:112`).
- It is safe only for an id that cannot be a `playerClubId` and is not in `WORLD_POOL_COMPETITION_IDS` or `FOREIGN_LEAGUES`. `ger2-wilhelmshaven` meets both conditions.
- Risk: none to low.

### 2.3 Strategy codes used in this plan

| Code | Meaning | Save schema bump? |
|---|---|---|
| **D** | Data-only correction of display fields under the same id | No |
| **S** | Season-gated league move: `competitionHistory` entries with a `validFrom` season. Applied to new careers immediately and to existing careers from their next rollover, through the season-aware resolver and the frozen legacy baseline (MS §3). *[superseded: the earlier write-into-`competitionMembership` mechanism would freeze foreign entries forever, because the Swedish transition only copies them]* | **No** (additive marker `clubWorldBaseline`; absence = legacy) |
| **A** | Alias: storage key retained, `canonicalId` / `aliases` / `legacyIdNote` added; registry keyed by canonical id with legacy key mapping | No (metadata only) |
| **R** | Retire as tombstone (never deleted, never reused) | No |
| **N** | New club under a new id (additive; needs per-club backfill rather than a single sentinel) | No for new careers; optional additive backfill |
| **P+** | Add a permanent relationship row through a separate idempotent seeder. In existing careers `startDate` = next season start, so the in-progress season is unaffected. `PERMANENT_B_TEAM_PAIRS` stays unchanged (MS §6) | No (additive, idempotent) |
| **P~** | Retype or remove an existing permanent row (the seeder only adds rows). Not recommended (D8-A keeps the row with metadata) | Yes, only if chosen |
| **K** | Kit, crest or registry correction only | No |

---

## 3. Issue-by-issue plan

Each entry gives: current identity and id; correct identity; evidence; proposed correction; whether the id can be retained; impact on existing careers and saves, including Alpha testers; and the recommended migration.

### Class: Incorrect club identity

#### F01: `esp1-anaitasuna`
- **Current:** id names SD Anaitasuna. Data is "Bidasoa Irun", Irun, esp-1, not REAL_WORLD (`clubs.ts:227`). Registry kit is Bidasoa yellow/navy, VERIFIED.
- **Correct identity:** CD Bidasoa Irún (Irudek Bidasoa), Liga ASOBAL 2025/26 and 2026/27.
- **Evidence:** https://en.wikipedia.org/wiki/2025%E2%80%9326_Liga_ASOBAL. Earlier note `research/results-6.json`.
- **Proposed correction:** keep the club players see (Bidasoa). Give the record `canonicalId: "es-bidasoa-irun"`, `legacyIdNote: "id text names Anaitasuna; meaning is Bidasoa since HM-GAME-0.1"`, and `externalIds.wikipedia`. Never re-point the key to Anaitasuna. Anaitasuna already exists under `esp1-alicante` (F03).
- **Retain id?** Yes, as storage key.
- **Career/save impact:** esp-1 is in both `FOREIGN_LEAGUES` and `WORLD_POOL_COMPETITION_IDS`. Existing saves may contain this id in incoming offers, a sold player's contract and club history, and `clubKnowledge`. Keeping the key keeps all of them valid. Alpha testers see no change.
- **Migration:** A, plus K (kit already matches Bidasoa).

#### F02: `esp1-logrono`
- **Current:** id names BM Logroño La Rioja. Data is "Ademar León", León, esp-1 (`clubs.ts:228`). Registry kit is Ademar white/orange, VERIFIED.
- **Correct identity:** CB Ademar León (ABANCA Ademar León), ASOBAL.
- **Evidence:** 2025–26 Liga ASOBAL (URL as in F01). https://asobal.es/equipos/ADE/ (registry source).
- **Proposed correction:** keep Ademar. Add `canonicalId: "es-ademar-leon"` and a legacy note. If BM Logroño La Rioja is wanted, add it under a **new** id (for example `esp1-logrono-larioja`), never under `esp1-logrono`.
- **Retain id?** Yes.
- **Career/save impact:** as F01. One extra point: adding Logroño to esp-1 increases the esp-1 pool size and so changes which club future foreign bids pick by index (`market.ts:74`). Past offers are unaffected.
- **Migration:** A (+ N if Logroño is added).

#### F03: `esp1-alicante`
- **Current:** id names an Alicante club. Data is "Helvetia Anaitasuna", Pamplona, esp-1 (`clubs.ts:230`). Registry kit is UNCERTAIN, 0.3.
- **Correct identity:** SCDR Anaitasuna (Pamplona). Relegated from ASOBAL after 2024/25, in División de Honor Plata in 2025/26, and lost the 2026 promotion play-off, so **esp-2 for 2026/27**.
- **Evidence:** 2025–26 Liga ASOBAL (relegated list). https://www.cbmpuertosagunto.com/noticias/anaitasuna-primera-piedra-en-el-camino?lang=en. https://planomato.com/es/pontevedra/p/partido-balonmano-cisne-vs-anaitasuna.
- **Proposed correction:** keep Anaitasuna under this key with `canonicalId: "es-anaitasuna"` and a legacy note. Season-gated move to `esp-2` from 2026/27. Optionally add Horneo Eón Alicante (promoted to ASOBAL 2025/26) under a new id.
- **Retain id?** Yes.
- **Career/save impact:** leaving esp-1 removes Anaitasuna from `FOREIGN_LEAGUES` and the world pool. A player already sold there keeps a valid `clubId`, because `getClub` still resolves, but he stops appearing among scouting and transfer candidates (`careerWorld.ts:41-43`). The esp-1 pool shrinks, which changes future foreign-buyer picks. Do not apply mid-season.
- **Migration:** A + S (+ N for Alicante).

#### F04: `hun1-gyor`
- **Current:** id names Győr. Data is "Grundfos Tatabánya", Tatabánya, hun-1 (`clubs.ts:242`). Registry kit is Tatabánya blue with MOL logo.
- **Correct identity:** MOL Tatabánya KC (Grundfos is a former sponsor), NB I.
- **Evidence:** https://en.wikipedia.org/wiki/2025%E2%80%9326_Nemzeti_Bajnoks%C3%A1g_I_(men%27s_handball) (both ETO University HT Győr and MOL Tatabánya KC listed).
- **Proposed correction:** keep Tatabánya. Set name to "MOL Tatabánya KC" or the neutral "Tatabánya KC" (naming policy, decision 6.4). Add `canonicalId: "hu-tatabanya"`, `historicalNames: [{name: "Grundfos Tatabánya KC", validTo: "2022/23"}]` (the end season still needs confirming) and a legacy note. Add Győr under a new id only if wanted.
- **Retain id?** Yes.
- **Career/save impact:** hun-1 is in `FOREIGN_LEAGUES`, so the same exposure as F01. A rename shows in structured views. Old offer motive text keeps "Grundfos Tatabánya".
- **Migration:** A + D.

### Class: Duplicate club

#### F05: `ger2-wilhelmshaven`
- **Current:** id names Wilhelmshavener HV. Data is "TV Bittenfeld", Waiblingen, ger-2 (`clubs.ts:219`). The registry kit (white/blue, PROBABLE 0.62) was taken from tvbittenfeld.de, the *amateur parent association's* handball page. It is neither TVB Stuttgart's kit nor WHV's.
- **Correct identity:** TV Bittenfeld 1898 is the origin and parent association of TVB Stuttgart. The professional team renamed itself on promotion in 2015, and it is already in the game as `ger1-stuttgart` (`clubs.ts:188`). Wilhelmshavener HV played 3. Liga Nord-West in 2025/26 and is not on the 2026/27 2. Bundesliga list.
- **Evidence:** https://en.wikipedia.org/wiki/TVB_Stuttgart. https://www.hessenschau.de/sport/ergebnisse-tabellen/handball-2bl100~_matchday-26.html. https://www.daikin-hbl.de/downloads/HBL/HBL_GmbH/Spielplan/Spielplan_2.HBL_Saison-26-27.pdf. https://tabellen.traunsteiner-tagblatt.de/handball/maenner-__berregional-3__liga/3__liga_n_w_maenner/2025_26.html.
- **Proposed correction:**
  1. Do **not** merge the record into `ger1-stuttgart`. The ger-2 record has no squad, economy or history of its own, so there is nothing to merge, and TVB cannot play in two leagues.
  2. Add "TV Bittenfeld" as a `historicalNames` entry on `ger1-stuttgart` (validTo 2014/15).
  3. Retire `ger2-wilhelmshaven` as a tombstone with `retiredReason: "duplicate identity of ger1-stuttgart; id text names Wilhelmshavener HV (3. Liga)"`.
  4. Add the owner's chosen replacement 2026/27 2. Bundesliga club under a **new** id, for example `ger2-tusem-essen`.
- **Why not reuse the id for the replacement?** Re-pointing would be save-safe today, because ger-2 is not referenced by career code. But it would break rule 1 and leave a third meaning on the key.
- **Retain id?** No (tombstone).
- **Career/save impact:** none expected. ger-2 is in neither `WORLD_POOL_COMPETITION_IDS` nor `FOREIGN_LEAGUES`, and the club is not playable. A save can reference it only through `selectedCompetitionIds` (a competition id, unaffected) or a stray `clubKnowledge` key. The tombstone keeps such keys resolvable.
- **Migration:** R + N. The registry entry gets status `retired`. The TV Bittenfeld e.V. kit is removed from that entry and kept only as a research note.

### Class: Alias / historical name

#### F06: `ger2-dessau`
- **Current:** "SC DHfK Dessau", Dessau (`clubs.ts:217`).
- **Correct identity:** Dessau-Roßlauer HV 06 (DRHV, "Dessauer HV"), Dessau-Roßlau, 2. Bundesliga 2026/27.
- **Evidence:** https://en.wikipedia.org/wiki/Dessau-Ro%C3%9Flauer_HV. 2. HBL 2026/27 schedule PDF (F05).
- **Proposed correction:** name "Dessau-Roßlauer HV 06", shortName "Dessau", city "Dessau-Roßlau". Add `aliases: ["Dessauer HV", "DRHV"]`. This is not a duplicate of `ger1-leipzig`.
- **Retain id?** Yes. **Impact:** none (ger-2 is not referenced in careers). **Migration:** D.

#### F10: `hun2-eger`
- **Current:** "Egri Spartacus", Eger, hun-2 (`clubs.ts:245`).
- **Correct identity:** Eger-Eszterházy SzSE (sponsor name SBS-Eger / QHB-Eger), relegated from NB I after 2024/25 and in **NB I/B** in 2025/26.
- **Evidence (re-checked):** https://en.wikipedia.org/wiki/Eger-Eszterh%C3%A1zy_SzSE. https://en.wikipedia.org/wiki/2025%E2%80%9326_Nemzeti_Bajnoks%C3%A1g_I_(men%27s_handball). https://www.sofascore.com/handball/team/sbs-eger-eszterhazy/205127 (NB I/B 2025/26 table).
- **Proposed correction:** name "Eger-Eszterházy SzSE", shortName "Eger", with sponsor names as `aliases`. See S6 for the hun-2 / int-hun-2b competition duplication.
- **Retain id?** Yes. **Impact:** none. **Migration:** D.

### Class: League / country / city assignment

#### F07: `den2-fif`
- **Current:** city Fredensborg (`clubs.ts:223`). **Correct:** Frederiksberg (Frederiksberg IF, Frederiksberghallen), Danish 1st Division.
- **Evidence:** https://en.wikipedia.org/wiki/Frederiksberg_IF. https://fifhaandbold.dk/klub/fif-handbold--2/nyheder/20964.
- **Correction:** city "Frederiksberg". Optionally add `aliases: ["Frederiksberg IF"]`. **Retain:** yes. **Impact:** none (den-2 is not referenced). **Migration:** D.

#### F08: `esp2-cisne`
- **Current:** city Ourense (`clubs.ts:233`). **Correct:** Pontevedra (Pabellón Municipal), Plata.
- **Evidence:** https://planomato.com/es/pontevedra/p/partido-balonmano-cisne-vs-anaitasuna.
- **Correction:** city "Pontevedra". **Retain:** yes. **Impact:** none. **Migration:** D.

#### F09: `den1-hoj`
- **Current:** city Hjørring (`clubs.ts:159`). **Correct:** Ølstykke/Jyllinge (Zealand).
- **Evidence (re-checked):** https://en.wikipedia.org/wiki/2025%E2%80%9326_H%C3%A5ndboldligaen (arena table "Ølstykke and Jyllinge"). https://en.wikipedia.org/wiki/H%C3%98J_Elite.
- **Correction:** city "Ølstykke". **Retain:** yes. **Impact:** none for the city change. den-1 is in the world pool and among foreign buyers, but city is display only. **Migration:** D. The league move is F15.

#### F11: `den1-sonderjyske`
- **Current:** city Aabenraa (`clubs.ts:165`). **Correct:** Sønderborg.
- **Evidence (re-checked):** 2025–26 Håndboldligaen arena table lists SønderjyskE as Sønderborg.
- **Correction:** city "Sønderborg". `clubVenues.ts` has no Danish entries, so there is no venue conflict. **Retain:** yes. **Impact:** display only. **Migration:** D.

#### F14: Germany 2026/27 (`ger1-leipzig`, `ger1-minden`, `ger2-balingen`, Bietigheim missing)
- **Current:** the `GER_1` block is the 2025/26 list, labelled "verified" (`clubs.ts:170-190`).
- **Correct:** for 2026/27, SC DHfK Leipzig and GWD Minden are in the 2. Bundesliga, and HBW Balingen-Weilstetten and SG BBM Bietigheim are in the Bundesliga.
- **Evidence:** https://en.wikipedia.org/wiki/2026%E2%80%9327_Handball-Bundesliga. Hessenschau 2. BL table and the HBL 2. BL 2026/27 schedule (F05).
- **Proposed correction:** keep all ids. The `ger1-`/`ger2-` prefixes stop matching the league; that is acceptable, because ids are keys. Add a `competitionHistory` per club: Leipzig `ger-1` to 2025/26 and `ger-2` from 2026/27; Minden the same; Balingen `ger-2` to 2025/26 and `ger-1` from 2026/27. Add SG BBM Bietigheim under a new id (`ger1-bietigheim`). Fix the block comment.
- **Retain id?** Yes.
- **Career/save impact:**
  - Existing careers start in 2026/27. A static edit would move these clubs in all saves immediately. Because foreign leagues have no fixtures, the visible effect is on enumeration only: Leipzig and Minden leave the world pool and `FOREIGN_LEAGUES`; Balingen and Bietigheim join them.
  - A player sold to Leipzig stays valid but drops out of candidate lists.
  - Foreign-bid picks by index change.
  - If Bietigheim gets a REAL_WORLD squad later, the `ger1-kiel` sentinel (`careerInitialization.ts:187`) will not backfill it into existing saves.
- **Migration:** S + N. **Season-gate the move, or apply it with the S6/S resolver from 2027/28 in existing careers.** New careers get the 2026/27 truth immediately.

#### F15: Denmark 2026/27 (`den1-hoj`, `den1-grindsted`, KIF Kolding missing)
- **Current:** DEN_1 is the 2025/26 list (`clubs.ts:152-168`).
- **Correct:** Grindsted GIF (last in the regular season) and HØJ Elite (lost the play-off) are relegated. **KIF Kolding**, a 1st Division club in 2025/26, won the best-of-three play-off against HØJ and is in the 2026/27 Håndboldligaen. The second promotee is still unconfirmed.
- **Evidence (re-checked):** https://en.wikipedia.org/wiki/2025%E2%80%9326_H%C3%A5ndboldligaen. https://gohandball.com/?p=12311. https://en.wikipedia.org/wiki/KIF_Kolding.
- **Proposed correction:** season-gated move of both clubs to den-2. Add KIF Kolding under a new id (`den1-kif-kolding`). Leave the second promotee as an open research item.
- **Retain id?** Yes. **Impact:** as F14 (den-1 is in the world pool and among foreign buyers). **Migration:** S + N.

#### F17: Norway (`nor1-bodo`, `nor2-fjellhammer`, `nor2-sandnes`)
- **Current:** Bodø in nor-1; Fjellhammer and Sandnes in nor-2 (`clubs.ts:207,212-213`).
- **Correct:** the 14-club REMA 1000-ligaen includes Fjellhammer IL and Sandnes HK. Bodø HK is listed in the 1. divisjon.
- **Evidence (re-checked):** https://en.wikipedia.org/wiki/REMA_1000-ligaen_(men%27s_handball). The page does not state 2026/27 movements explicitly, so a 2026/27 check is still needed.
- **Proposed correction:** season-gated swap. Fjellhammer and Sandnes to nor-1, Bodø to nor-2.
- **Retain ids?** Yes. **Impact:** nor-1 is in both the world pool and `FOREIGN_LEAGUES`. Same enumeration effects as F14. **Migration:** S.

#### F18: `isl2-fram`
- **Current:** isl-2 (`clubs.ts:261`).
- **Correct:** Fram won the 2024/25 Icelandic double and is one of the 12 top-flight clubs in 2025/26 (also EHF European League 2025/26).
- **Evidence (re-checked):** https://en.wikipedia.org/wiki/Fram_men%27s_handball. https://www.wikiwand.com/en/articles/%C3%9Arvalsdeild_karla_(handball). https://gohandball.com/?p=8805.
- **Proposed correction:** season-gated move to isl-1.
- **Retain id?** Yes. **Impact:** isl-1 is in the world pool, so Fram becomes a scouting source (no squad, because it is not REAL_WORLD). isl-1 is not in `FOREIGN_LEAGUES`. Low. **Migration:** S.

#### F19: Slovenia (`svn2-skofjaloka`, `svn2-jeruzalem`)
- **Current:** svn-2 (`clubs.ts:253-254`).
- **Correct:** RD Loka (RD Loka 2012, the successor of the club that went bankrupt in 2011) and RK Jeruzalem Ormož are both in the 12-club Liga NLB 2025/26. They met in the 7th-place series in May 2026.
- **Evidence (re-checked):** https://siol.net/sportal/rokomet/liga-nlb-9-krog-704482. https://siol.net/sportal/rokomet/liga-nlb-22-krog-686215. https://www.rtvslo.si/sport/rokomet/drzavno-rokometno-prvenstvo/zacenja-se-nova-sezona-drzavnega-prvenstva/639764.
- **Proposed correction:** season-gated move to svn-1. For Loka, add `historicalNames` and a `predecessor` note (the pre-2011 RD Loka).
- **Retain ids?** Yes. **Impact:** none (svn leagues are not referenced). **Migration:** S. It could equally be a plain D edit, because nothing reads svn membership in a career.

#### F20: `hun2-komlo`
- **Current:** hun-2 (`clubs.ts:246`). **Correct:** Carbonex-Komló, NB I 2025/26.
- **Evidence:** 2025–26 NB I (F04 URL).
- **Correction:** season-gated move to hun-1. Fix the "NB II" comment.
- **Retain:** yes. **Impact:** joining hun-1 adds the club to `FOREIGN_LEAGUES` and the world pool. Low. **Migration:** S.

#### F21: Spain second tier (`esp2-teucro`, `esp2-cordoba`)
- **Current:** both in esp-2 (`clubs.ts:234,236`).
- **Correct:** SD Teucro played the third tier (Primera Nacional) in 2025/26. "BM Córdoba" was not found as a men's Plata club.
- **Evidence:** https://planomato.com/es/pontevedra/p/partido-balonmano-teucro-tacoronte-primera-nacional. https://www.eldebate.com/espana/la-voz-de-cordoba/deportes/20251224/balonmano-cordobes-entre-ilusion-dudas-cerrar-2025_368653_amp.html.
- **Proposed correction:**
  - **Teucro** is a real club. Keep the id. Either flag it `approximate: true` with a note, or, if the game adds an esp-3 tier later, move it there.
  - **"BM Córdoba"** may be an invented identity. Under G12 the correction is to retire `esp2-cordoba` as a tombstone and add a confirmed 2026/27 Plata club under a new id (for example Servigroup Benidorm or BM Zamora). Do **not** re-label the id to a different club.
- **Retain id?** Teucro: yes. Córdoba: tombstone (owner decision).
- **Impact:** none (esp-2 is not referenced). **Migration:** S or flag; R + N for Córdoba.

### Class: Dissolved or renamed

#### F12: `den2-aarhus`
- **Current:** "Aarhus Håndbold Herrer", den-2 (`clubs.ts:221`).
- **Correct:** matches the **new** Aarhus Håndbold, founded 1 July 2024 from Aarhus United and Aarhus HC, men's team in the 1st Division. It is **not** the pre-2021 Århus Håndbold (bankrupt in 2021, top-flight operation continued as Skanderborg Aarhus, now `den1-skanderborg`). New evidence: Aarhus lost a 2026 promotion/relegation play-off semifinal 30–34 to Kolding, consistent with staying in den-2 for 2026/27 (medium confidence).
- **Evidence:** https://en.wikipedia.org/wiki/Aarhus_H%C3%A5ndbold_(women%27s_handball). https://en.wikipedia.org/wiki/Aarhus_H%C3%A5ndbold. https://aarhush.dk/wp-content/uploads/Pressemeddelelse_AarhusHaandbold.pdf. https://tophaandbold.dk/intranet/pdfs/game/6580/report. https://statshub.sportradar.com/easywin/en/match/61437943.
- **Proposed correction:** no identity change. Add `founded: 2024` and a note that it is not the successor of the pre-2021 club. On `den1-skanderborg`, add `historicalNames` covering the 2021 continuation.
- **Retain id?** Yes. **Impact:** none. **Migration:** D.

#### F13: `den1-skanderborg`
- **Current:** name "Skanderborg Aarhus", shortName "Skanderborg AGF", city Aarhus, REAL_WORLD (`clubs.ts:163`). The roster folder is `SAH - Aarhus`.
- **Correct:** Skanderborg AGF Håndbold (renamed June 2023). Home is Skanderborg Fælled, with games also at Ceres Arena, Aarhus.
- **Evidence:** https://en.wikipedia.org/wiki/Skanderborg_AGF_H%C3%A5ndbold. The 2025–26 Håndboldligaen table still uses "Skanderborg Aarhus Håndbold", "Aarhus and Skanderborg".
- **Proposed correction:** name "Skanderborg AGF Håndbold". City "Skanderborg", with arena city Aarhus as `venueCity` if it is added to the venue registry. `historicalNames`: Skanderborg Håndbold (to 2020/21) and Skanderborg Aarhus Håndbold (2021/22 to 2022/23). The data folder name does not need to change, because it is not a key.
- **Retain id?** Yes. This is essential: the REAL_WORLD squad, ratings (`den_1/ratings/den1-skanderborg.json`) and roster entries are keyed by this id.
- **Impact:** display only. **Migration:** D.

#### F16: `hun1-veszprem`, `hun1-gyor` (stale sponsor names)
- **Current:** "Telekom Veszprém" (REAL_WORLD, `clubs.ts:239`); "Grundfos Tatabánya" (`:242`).
- **Correct:** ONE Veszprém HC (EHF CL 2026/27 profile); MOL Tatabánya KC.
- **Evidence:** NB I 2025/26 (F04 URL). https://ehfcl.eurohandball.com/men/2026-27/clubs/details/jV5CzKP5W_-TGMWEwA-jVQ/OneVeszpr%C3%A9mHC/ (registry source). The roster folder is already named `ONE Veszprém`.
- **Proposed correction:** follow the naming policy (decision 6.4). Either current sponsor names, or neutral names ("Veszprém KC", "Tatabánya KC") with sponsor names in `aliases` and `historicalNames` (for example "Telekom Veszprém" with validTo 2024/25). `int-veszprem-academy` stays a separate club (academy team; possible `parentClubId: hun1-veszprem`, relation `ACADEMY`).
- **Retain ids?** Yes (Veszprém has REAL_WORLD players keyed by the id).
- **Impact:** display only. Old inbox and bid text keeps the old names. **Migration:** D.

### Class: B-team / U-team relationship

Background: on Profixio, each player's "Skriven i" line names the club he is registered with. A team that appears under one name but whose players are all registered with a higher-tier club is functionally that club's second team.

#### F22: `se_club_hk_cliff`
- **Current:** HK Cliff, Division 1 Norra, `playable: true`, permanent `AFFILIATED_B_TEAM` of Hammarby (`clubPartnerships.ts:89`). Hammarby green in `clubs.ts:125`.
- **Correct:** HK Cliff (SHF club id 26051, founded 1939) is a separate association. Its Division 1 licence is used by **Hammarby IF HF's U team**: 19/19 players are registered with Hammarby IF HF (club id 25963).
- **Evidence:** https://www.profixio.com/app/lx/competition/leagueid28142/teams/1578872?t=players. https://sv.wikipedia.org/wiki/HK_Cliff. https://www.hammarbyhandboll.se/u-laget/truppen.
- **Proposed correction:** keep the id and the relation. Add `licenceHolderAssociation: { name: "HK Cliff", shfClubId: "26051" }`, `parentClubId: "se_club_hammarby_if_hf"`, `relation: "U_TEAM_UNDER_PARTNER_LICENCE"`, and `externalIds.profixioTeam: { "2026/27": "1578872" }`.
- **Retain id?** Yes.
- **Impact:** the id can be a `playerClubId` (Division 1 is playable, `managerCareer.ts:132`). Keeping everything means no impact. **Removing the relation or retiring the id would be high risk.** It would orphan the `bteam-se_club_hammarby_if_hf-se_club_hk_cliff` row (the seeder never removes rows), and `getCareerClub` would throw for any Alpha tester managing Cliff.
- **Migration:** metadata only.

#### F23: `se_club_if_kristianstad`
- **Current:** permanent `AFFILIATED_B_TEAM` of IFK Kristianstad (`clubPartnerships.ts:92`).
- **Correct:** IF Kristianstad (SHF 25971) is a separate association closely linked to IFK Kristianstad (SHF 25964). Most players are registered with IF Kristianstad itself; only 3 with IFK.
- **Evidence:** https://www.profixio.com/app/lx/competition/leagueid28142/teams/1575285?t=players. Repo `data/real-world/sweden/2026-27/division1-sodra/IF Kristianstad/sources-*.json`.
- **Proposed correction (owner decision):** either keep the B-team relation with the caveat `relationConfidence: "PARTIAL"`, or retype it to a permanent `PARTNER_ASSOCIATION` relation. Under the retype, the club is still excluded from partnership offers, but its players are not treated as owned by IFK.
- **Retain id?** Yes.
- **Impact:** a retype changes loan and ownership semantics for players already moved through the link (`clubPartnerships.ts:375-398`). It also needs a migration that rewrites the existing row, because `seedPermanentBTeamPartnerships` only adds. Medium risk.
- **Migration:** P~ with a schema bump. Keep the row id; change `type`; record `migratedFrom`.

#### F24: `se_club_hp_alingsas`
- **Confirmed:** players are registered with Alingsås HK (owner decision 2026-11-05 already describes the team as a farm team).
- **Evidence:** https://www.profixio.com/app/lx/competition/leagueid28142/teams/1572549?t=players.
- **Correction:** none. Add `externalIds.profixioTeam`. **Retain:** yes. **Impact:** none.

#### F25: `se_club_hk_onnerediterna`
- **Confirmed:** all players are registered with Önnereds HK (26047); the team sits under association 26228.
- **Evidence:** https://www.profixio.com/app/lx/competition/leagueid28142/teams/1575759?t=players.
- **Correction:** none. Add `licenceHolderAssociation.shfClubId: "26228"`. **Retain:** yes. **Impact:** none.

#### F26: `se_club_hk_s_hof`
- **Probable:** the roster source is IK Sävehof's P18 page. A Profixio check was not possible (a re-search on 2026-11-14 also found nothing).
- **Evidence:** https://www.iksungdom.se/iksavehof-p18/truppen.
- **Correction:** none now. Verify on Profixio before any production change. **Retain:** yes. **Impact:** none.

#### F27: Division 2 "U" teams
| Id | Name | Profixio evidence | Parent |
|---|---|---|---|
| `se_div2_team_1585295` | LUGI HF U | association 26102; 18/18 registered with Lugi HF | `se_club_lugi_hf` |
| `se_div2_team_1582183` | HF Karlskrona U | club 26363 = HF Karlskrona; 20/21 | `se_club_hf_karlskrona` |
| `se_div2_team_1585596` | Ystads IF HF U | association 26429; 25/25 | `se_club_ystads_if_hf` |
- **Evidence:** https://www.profixio.com/app/leagueid28096/teams/1585295. https://www.profixio.com/app/leagueid28096/teams/1582183. https://www.profixio.com/app/leagueid28096/teams/1585596.
- **Proposed correction:** keep the ids. Add permanent rows of a new type `U_TEAM` (or reuse `AFFILIATED_B_TEAM`) through a separate idempotent seeder. These clubs then never appear as `DEVELOPMENT_PARTNERSHIP` candidates (`clubPartnerships.ts:99-101`). HF Karlskrona U is a team *of the same club*: model it as `relation: "SAME_CLUB_SECOND_TEAM"`.
- **Retain ids?** Yes.
- **Impact:** additive and idempotent. Saves that already hold an *active* `DEVELOPMENT_PARTNERSHIP` with one of these teams (possible only if the manager's club signed one) need a rule: either let it run to `endDate` and block renewal, or end it at the migration date with a refund. Low risk.
- **Migration:** P+.

#### F28: Division 2 affiliates under different names
| Id | Name | Profixio evidence | Parent |
|---|---|---|---|
| `se_div2_team_1582988` | Tumba HK | association 26146; all registered with IFK Tumba HK | `swe2-tumba` |
| `se_div2_team_1578886` | VästeråsIrsta HK | association 26317; registered with VästeråsIrsta HF | `swe2-vasterasirsta` |
| `se_div2_team_1575715` | HK Varberg 09 | 26185; 12/15 registered with HK Varberg | `swe2-varberg` |
| `se_div2_team_1578982` | Helsingborgs HK | 26450; 21/23 registered with OV Helsingborg HK | `se_club_ov_helsingborg` |
| `se_div2_team_1579219` | Malmö HP | 26298; 29/29 registered with HK Malmö | `se_club_hk_malmo` |
| `se_div2_team_1575788` | HK Lif Blå | 26101; 18/18 registered with LIF Lindesberg | `se_club_lif_lindesberg` |
| `se_div2_team_1583015` | HK Ystadpågarna | 26411; 22/22 registered with IFK Ystad HK | `swe2-ystad2` |
- **Evidence:** the Profixio team pages listed under Sources in the findings document (leagueid27989, 28151, 28052, 28096 and the team ids above).
- **Proposed correction:** keep the ids and the registered names exactly as they are; these are not typos or duplicates. Add `parentClubId` and `relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION"` (HK Varberg 09: `relationConfidence: "MAJORITY"`), plus P+ rows as in F27.
- **Guard the name resolver.** `getCanonicalClubName` matches lowercased names (`canonicalClubNames.ts:82-86`) and `normalizeClubAcronyms` rewrites "tumba" and "vasterasirsta" (`:132-137`). Add a test that "Tumba HK" never resolves to IFK Tumba HK and "VästeråsIrsta HK" never to VästeråsIrsta HF.
- **Note on Tumba:** `TUMBA_CLUB_ID` (`clubs.ts:311`) stays `swe2-tumba` and must never point at the Division 2 id.
- **Retain ids?** Yes. **Impact:** as F27. **Migration:** P+.

#### F29: `se_div2_team_1578270` (Torslanda HK)
- **Finding:** a separate club (26041). Six players (born 2005–2008) are registered with HK Torslanda Elit; the rest have no such link.
- **Evidence:** https://www.profixio.com/app/leagueid28052/teams/1578270.
- **Correction:** do not model a B team. At most, add a weak `YOUTH_LINK` note with no gameplay effect. **Retain:** yes. **Impact:** none. **Migration:** none.

### Class: Kit (dependent on identity)

#### F30: `se_club_hk_cliff` kit
- **Current:** `clubs.ts:125` uses Hammarby green. Registry (phase 2) uses yellow/navy, PROBABLE 0.8, measured from a Sannadals SK photo of "Cliff" at home on 2026-02-08 (https://sannadal.com/content/uploads/2026/02/herr-seger-borta-cliff-8-feb-2026-1-scaled.jpg).
- **Correction:** the team that plays as "Cliff" wears Cliff yellow. Once the registry is authoritative, align the `clubs.ts` placeholder colours to the registry. Keep PROBABLE until a 2026/27 photo exists.
- **Retain:** yes. **Impact:** visual only. **Migration:** K.

#### F31: kits of F01–F05
- Under the recommended strategy (keep the displayed identity), the kits for F01, F02 and F04 stay correct.
- F03: Anaitasuna's kit is still UNCERTAIN; re-research it.
- F05: the registry's white/blue kit belongs to TV Bittenfeld e.V. Drop it when the id is retired, and research the replacement club's kit.
- **Migration:** K.

#### F32: `den2-aarhus` kit
- Already resolved by phase 2: maroon shirt with white/navy hoops, from https://aarhush.dk/1-div-herrer/ (PROBABLE 0.72). The findings' black/orange concern is obsolete.
- **Correction:** close, with a note. **Migration:** K.

#### F33: affiliate kits
- **Correction:** keep them null or UNKNOWN. Show the owner-approved neon-orange fallback (decision G11) rather than inheriting parent colours silently. Display the parent's colours only behind an explicit `kitInherited: "UNVERIFIED"` flag if the owner wants that (decision 6.9). This applies to the F22–F28 teams and S2.
- **Migration:** K.

### Supplementary items found while preparing this plan

#### S1: `ger1-hamburg` (renamed: Handball Club Hamburg)
- **Current:** "HSV Hamburg" (`clubs.ts:179`). The registry note already says the club "now appears as Handball Club Hamburg".
- **Correct:** Handball Sport Verein Hamburg now competes as **Handball Club Hamburg (HCH)**, with a new logo. Its lineage: HSV Handball (insolvent, withdrawn in 2016) was refounded as Handball Sport Verein Hamburg (HSVH) and is now HCH. The operating company Handball Sport Management und Marketing GmbH was restructured in December 2025.
- **Evidence:** https://www.flashscore.de/news/handball-hbl-hsv-hamburg-andert-namen-zum-handball-club-hamburg/8v7ijyn3/. https://en.wikipedia.org/wiki/Handball_Sport_Verein_Hamburg. https://www.rkh-law.de/download/rkh-pm-hsm-251209-en.pdf. https://hamburg-handball.de/. The rename date is not yet confirmed.
- **Correction:** name "Handball Club Hamburg", shortName "HC Hamburg". `historicalNames`: HSV Handball (to 2015/16) and Handball Sport Verein Hamburg (to the rename season). Keep the id: it is the same club, renamed.
- **Retain:** yes. **Impact:** ger-1 is in the world pool and among foreign buyers. Display only. **Migration:** D.

#### S2: `se_div2_team_1576008` (Lunds HS Lejon)
- **Finding:** Profixio Herr 2 Syd shows club "Lunds HS Lejon" (association id 26090) with **19/19 players registered with H43 Lund HF**. H43 Lund calls its men's development team "H43 Lejonen". This is the 11th Division 2 second team; the findings list 10.
- **Evidence:** https://www.profixio.com/app/leagueid28096/teams/1576008 (re-checked 2026-11-14). https://www.h43lund.se/l/valkommen-till-h43-lund-tobias-lovet-linde/.
- **Correction:** `parentClubId: "swe2-h43lund"`, `relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION"`, `aliases: ["H43 Lejonen"]`. Add a P+ row. Do not merge with `swe2-h43lund`.
- **Retain:** yes. **Impact:** as F27. **Migration:** P+.

#### S3: `swe2-guif` (conflicting names)
- **Finding:** `clubs.ts:97` says "Eskilstuna Guif IF"; `canonicalClubNames.ts:34` says "HK Guif" / "HK Guif". The canonical map wins in media, inbox and news (`getCanonicalClubName`), so different surfaces show different names. No source found for "HK Guif". The club is Eskilstuna Guif (IF Guif's handball club), 13th of 14 in Handbollsligan in February 2026 and in Allsvenskan for 2026/27.
- **Evidence:** https://en.wikipedia.org/wiki/Eskilstuna_Guif. https://www.sofascore.com/en-us/handball/team/eskilstuna-guif/4107.
- **Correction:** keep one name source: the club record, with `aliases: ["Guif", "IF Guif"]`. Generate `CANONICAL_CLUB_MAP` from the club records instead of maintaining it by hand.
- **Retain:** yes. **Impact:** display only. **Migration:** D.

#### S4: Bodens BK Division 2 registration (Profixio team 1577093)
- **Finding:** deliberately not imported (`AMBIGUOUS_SENIOR_RESERVE`, `sweden2026Data.json`; see its `notes[2]`).
- **Correction:** keep it unresolved until Profixio shows whose players it fields. If it proves to be a reserve team, add it as `se_div2_team_1577093` with `parentClubId: "se_club_bodens_bk_hf"`. Never fold it into the Division 1 id.
- **Impact:** none.

#### S5: Profixio team ids as club keys (external-id class)
- **Finding:** `se_div2_team_<profixioTeamId>` embeds a **season-scoped team registration** (`sourceRegistration.seasonId` = 2026/27, `swedishDivision2.ts:18`). Profixio issues new team ids each season. In 2027/28 the same team will have a different Profixio id. A naive importer would then create a second club for the same team.
- **Correction:**
  - Freeze the existing ids as permanent storage keys.
  - Add `externalIds: { shfClubId, profixioTeam: { "2026/27": "1582988", … } }`.
  - Match future imports on SHF association id plus the team name, never on the Profixio team id alone.
  - Record SHF ids already known from the findings: 26051, 25963, 25971, 25964, 26047, 26228, 26102, 26363, 26429, 26146, 26317, 26185, 26450, 26298, 26101, 26411, 26041, 26090.
- **Impact:** none now. Medium from the 2027/28 import if left unaddressed.

#### S6: `hun-2` vs `int-hun-2b`
- **Finding:** `competitions.ts:129` (hun-2, described as "NB II") and `competitions.ts:188` (int-hun-2b, "NB I/B, distinct from hun-2") model the **same real league**. Hungary's men's second tier is NB I/B.
- **Correction:** declare `hun-2` as the canonical competition, with `int-hun-2b` as an alias (or the reverse). Move `int-veszprem-academy` and the Eger club into one competition at a season boundary. Do not change the competition ids stored in saves.
- **Impact:** `int-hun-2b` is in `WORLD_POOL_COMPETITION_IDS` (`careerWorld.ts:21`); hun-2 is not. Folding it the wrong way would drop the Veszprém academy players from candidate lists. Low.

---

## 4. Proposed canonical data model additions

Extend `Club` (`apps/game/lib/game-data/types.ts:60-92`) without changing `id` semantics:

```ts
type ClubStatus = "active" | "renamed" | "dissolved" | "retired"; // retired = tombstone kept for saves
type ClubRelation =
  | "AFFILIATED_B_TEAM"                       // existing
  | "U_TEAM"                                  // F27
  | "SAME_CLUB_SECOND_TEAM"                   // HF Karlskrona U
  | "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION"   // F28, S2
  | "U_TEAM_UNDER_PARTNER_LICENCE"            // F22 HK Cliff
  | "PARTNER_ASSOCIATION"                     // F23 option
  | "ACADEMY"                                 // int-veszprem-academy
  | "YOUTH_LINK";                             // F29, informational only

type Club = {
  id: string;                         // storage key: immutable, never reused
  canonicalId?: string;               // stable real-world identity slug, e.g. "es-bidasoa-irun"; defaults to id
  legacyIdNote?: string;              // why the id text and the identity differ (F01–F04)
  status?: ClubStatus;                // default "active"
  retiredReason?: string;
  duplicateOf?: string;               // F05: ger2-wilhelmshaven -> ger1-stuttgart (informational, never a merge)
  aliases?: readonly string[];        // search/import matching only, never display
  historicalNames?: readonly { name: string; shortName?: string; validFrom?: string; validTo?: string }[];
  competitionHistory?: readonly { competitionId: string; validFrom: string; validTo?: string; source: string }[];
  parentClubId?: string;
  relation?: ClubRelation;
  relationConfidence?: "FULL" | "MAJORITY" | "PARTIAL";
  licenceHolderAssociation?: { name: string; shfClubId?: string };
  externalIds?: {
    shfClubId?: string;                                 // Swedish federation association id
    profixioTeam?: Readonly<Record<string, string>>;    // season -> team id (S5)
    wikipedia?: string;
    ehf?: string;
  };
  approximate?: boolean;              // F21: real club, uncertain tier
  validFrom?: string;                 // first season the record is valid in this world
  validTo?: string;                   // last season (tombstones, dissolved clubs)
  identitySources?: readonly { url: string; checkedOn: string }[];
  // existing fields unchanged: competitionId (= the 2026/27 start-of-world value), name, shortName, city, colours, sourceRegistration...
};
```

**Resolvers**, each the single entry point:
- `resolveClubId(id)`: returns the storage key, after an alias lookup if one exists. A no-op for every current id; reserved for any future re-keying.
- `clubCompetitionForSeason(state, clubId, seasonId)`: order is `competitionMembership` (career state) first, then `competitionHistory` for that season, then static `competitionId`. It replaces direct reads at `competitionMembership.ts:10-12`, `careerWorld.ts:42` (`getClubsByCompetition`), `market.ts:72` and `clubContextTier.ts:35,144`.
- `clubDisplayName(clubId, seasonId?)`: the current `name` by default, or a `historicalNames` entry for history views. Replaces the hand-written `CANONICAL_CLUB_MAP`, which is then generated from the records.
- `parentClubOf(clubId)`: reads `parentClubId` and `relation`, and drives the partnership seeders. `PERMANENT_B_TEAM_PAIRS` becomes derived data.

**Club Identity Registry** (`design-lab/experience-2027/club-identity/registry.json`):
- Keep it **keyed by game storage id**. It must join 1:1 to `CLUBS` and to saves.
- Add `canonicalId`, `status`, `relation` and `parentClubId` per entry, copied from the club record by the build script, never edited by hand.
- A retired id keeps its registry entry with `status: "retired"` and `kit: null`, so a historical fixture still renders with the neutral or clubless fallback.
- A kit belongs to the **storage id plus the season** (`kit.season` already exists). When an identity is corrected, invalidate the kit if the playing entity changed.
- Affiliate entries inherit nothing automatically (F33).

---

## 5. Phased rollout for a controlled production implementation

> *[superseded: see `HM-EXPERIENCE-2027-CLUB-IDENTITY-IMPLEMENTATION-ROADMAP.md`, phases C0–C8.]* The phases below are kept for traceability:
> - Phase 0 → C0;
> - Phase 1 → C1–C3;
> - Phase 2 → C4, **without** v9 or a `competitionMembership` rewrite;
> - Phase 3 → C5;
> - Phase 4 → C6, where the F23 retype becomes optional C6b;
> - Phase 5 → C7;
> - new C8 (multi-season validation).

**Phase 0: Inventory (no production change).**
- Build a read-only script, `scripts/club-id-usage-audit.ts`, that loads exported saves and counts every club id per field listed in 2.1. Embedded ids are counted by prefix pattern.
- Ask Alpha testers for their exported JSON (the feedback export, `ALPHA.md`) and commit anonymised copies as fixtures: `apps/game/lib/save/__fixtures__/alpha-*.json`. Manager names are personal data, so replace them before committing.
- Exit criterion: a table of which affected ids occur in real saves.

**Phase 1: Metadata, display-only corrections, safe for all saves.**
- Add the optional fields from section 4 (no schema bump: static data only).
- Apply the D items: F06, F07, F08, F09 (city), F10, F11, F12 notes, F13, F16, S1, S3. Apply the A metadata for F01–F04.
- Generate `CANONICAL_CLUB_MAP` from the records. Add a test that every Swedish name resolves to its own id, including the Tumba HK / IFK Tumba HK and VästeråsIrsta HK / HF pairs.
- Tests: snapshot of `getClub` for every id (only the intended fields change); load each Alpha fixture through `getOrCreateCareerState` and assert deep equality of `CareerState` except derived display.

**Phase 2: Season-aware competition resolver (save schema v9).**
- Introduce `competitionHistory` and `clubCompetitionForSeason`.
- `CURRENT_SAVE_SCHEMA_VERSION = 9`. The v9 step in `migrateCareerState` writes the *current-season* value of every non-Swedish club into `competitionMembership`, which freezes the in-progress season exactly as the player has seen it. From the next season transition, `competitionHistory` applies.
- New careers read `competitionHistory` for 2026/27 directly.
- Covers F03, F14, F15, F17–F21 and S6.
- Tests: an Alpha fixture mid-season keeps every foreign club's league until rollover; after rollover, Leipzig is in ger-2 and Balingen in ger-1; foreign-bid picks before rollover are identical to v8.

**Phase 3: New clubs and tombstones.**
- Add Bietigheim, KIF Kolding and the F05 replacement (plus Logroño, Alicante or Győr if the owner wants them).
- Retire `ger2-wilhelmshaven` (and `esp2-cordoba` if decided) as tombstones.
- Replace the single-sentinel backfills (`careerInitialization.ts:173,187`) with per-club presence checks, so new REAL_WORLD clubs reach existing saves.
- Test: every id ever written to a fixture still resolves through `getClub`.

**Phase 4: Relationships.**
- An idempotent seeder for F27, F28 and S2 (P+), the same pattern as `seedPermanentBTeamPartnerships`. Define what happens to an active development partnership with a newly linked team.
- If the owner retypes F23, add an explicit v10 migration (P~) that keeps the row id and records `migratedFrom`.
- Tests: partnership-candidate lists exclude all linked teams; existing permanent rows are unchanged.

**Phase 5: Registry and kits (K items).**
- Rebuild `registry.json` from the club records. Re-research the F03 and F05 replacement kits. Apply the affiliate fallback rule.

**Rollback.**
- Phases 1 and 3 are static-data changes. Revert the commit and saves load as before, because no save field changed. Tombstones are only ever added.
- Phases 2 and 4 bump the schema, and a v8 build rejects v9 backups (`portableCareerBackup.ts:35`). Before the v9 migration runs, keep the untouched v8 record in IndexedDB under a backup key (a `pre-v9:<saveId>` meta entry), and tell Alpha testers to export once before updating.
- Every migration step must be idempotent and covered by a "run twice equals run once" test, as `migrateCareerState` already promises (`saveMigration.ts:68`).

**Release gating.** One phase per release. Alpha first, behind the existing alpha access gate. Production only after the Alpha fixtures pass and at least one real season rollover has run on a v9 Alpha save.

---

## 6. Decisions still needed from the owner

> **Reviewed 2026-11-14.** Every item below is analysed, with options, a recommendation, effects on new careers and existing saves, and the schema impact, in `HM-EXPERIENCE-2027-CLUB-IDENTITY-FINAL-DECISIONS.md`.

| Original item | Review id | Status | Recommendation |
|---|---|---|---|
| 1 | D1 | **Mandatory** | Keep storage keys; add canonical metadata |
| 2 | D2 | Later | Do not add the missing clubs now |
| 3 | D3 | Later (by C5) | Tombstone plus one confirmed 2. BL club |
| 4 | D4 | Later | Neutral names; sponsor names as aliases |
| 5 | D5 | **Mandatory** | 2026/27 reality: new careers now, existing careers from their next rollover; a career's own Swedish simulation is never overwritten |
| 6 | D6 | Later (by C5) | Teucro `approximate`; Córdoba tombstone plus replacement |
| 7 | D7 | **Mandatory** | Name "HK Cliff", relation label "Hammarby U", stays selectable |
| 8 | D8 | **Mandatory** | Keep the B-team row with `PARTIAL` metadata (no v9) |
| 9 | D9 | **Mandatory** | 11 relations; career rows from the next season; existing development partnerships run out |
| 10 | D10 | Confirmation only | Already answered by G11 and the no-inheritance rule |
| 11 | D11 | **Mandatory** | Anonymised Alpha fixtures, with consent |
| 12 | T6 | Technical (research) | Close in C0 before the matching data lands |

The original wording is kept below for traceability.

1. **F01–F04 identity form:** confirm "keep the club players see, correct its canonical identity, never rename the storage key" (recommended). The alternative is a physical re-key in a schema migration, which is high risk and not recommended.
2. **Missing real clubs:** add BM Logroño La Rioja, Horneo Eón Alicante and Győri ETO-UNI FKC as new ids, or leave them out?
3. **F05:** which 2026/27 2. Bundesliga club replaces the retired "TV Bittenfeld" identity? Candidates: TuSEM Essen, HC Dresden, VfL Lübeck-Schwartau, TV Großwallstadt, Bayer Dormagen, VfL Potsdam.
4. **Naming policy (F04, F16, S1):** current sponsor names (ONE Veszprém HC, MOL Tatabánya KC, Handball Club Hamburg) or neutral names?
5. **League freshness (F03, F14, F15, F17–F21, S6):** adopt 2026/27 reality in foreign leagues, and apply it to existing careers only from their next season rollover (recommended)?
6. **F21:** keep Teucro flagged `approximate`, and replace "BM Córdoba" with a confirmed Plata club (tombstone plus new id)?
7. **HK Cliff (F22, F30):** present the team as "HK Cliff (Hammarby U)" or as plain HK Cliff? Keep it manager-selectable?
8. **IF Kristianstad (F23):** keep the permanent B team, or retype to partner association (needs a migration)?
9. **Division 2 affiliates (F27, F28, S2):** model all 11 relations? What happens to an existing active development partnership with one of them?
10. **Affiliate kit fallback (F33):** neon-orange fallback only, or parent colours with an "unverified" flag?
11. **Phase 0 data:** may anonymised Alpha tester exports be committed as test fixtures?
12. **2026/27 open research before Phase 2:** Denmark's second promotee; Norway's 2026/27 movements; HCH rename date; HK S-hof on Profixio; Bodens BK reserve (S4).
