# HM Experience 2027 — Club Database Identity Findings

**Status:** Research only. No game data was changed.
**Date:** 2026-11-13
**Scope:** `apps/game/lib/game-data/clubs.ts` (including block comments), `apps/game/lib/competition/transition/sweden2026Data.json` (Division 2 registrations), `design-lab/experience-2027/club-identity/clubs-extracted.json` (202 clubs), and the earlier kit-research notes in `design-lab/experience-2027/club-identity/research/results-*.json`.
**Method:** Every suspicion was checked against web sources: Wikipedia season and club pages, league schedules, and the official Swedish federation registration pages on Profixio. On a Profixio team page, each player's "Skriven i" line names the club the player is registered with. That line is the strongest evidence available here of a parent/affiliate relationship.

## Categories (Swedish labels)

| # | Category | Meaning in this document |
|---|---|---|
| 1 | **Felaktig klubbidentitet** | The stable `id` refers to one real club, but the display data (name/city) describes a different real club. |
| 2 | **Felaktigt klubbnamn** | Same club, but the name or other display data (such as the city) is wrong or invented. |
| 3 | **Inaktuell klubb** | Defunct, merged or renamed club, or club data that is out of date, such as a club placed in the wrong league for 2026/27 after promotion or relegation. |
| 4 | **Felaktig relation mellan klubbar** | Parent/B-team/affiliate relationship that is wrong, missing or modelled too strongly or too weakly. |
| 5 | **Osäker matchtröja** | The kit cannot be trusted for this entity (researched for a different club, or the playing team's shirt is unknown). |

## Counts

| Category | Findings |
|---|---|
| 1 Felaktig klubbidentitet | 5 (F01–F05) |
| 2 Felaktigt klubbnamn | 6 (F06–F11) |
| 3 Inaktuell klubb | 10 (F12–F21) |
| 4 Felaktig relation mellan klubbar | 8 (F22–F29) |
| 5 Osäker matchtröja | 4 (F30–F33) |
| **Total** | **33** |

## Summary table

Confidence: **H** = high (several sources agree, or there is an official primary source), **M** = medium, **L** = low. "PD" marks findings that need a product decision.

| ID | Cat | Game id | Game values (name / city / competition) | Finding (short) | Conf | PD |
|---|---|---|---|---|---|---|
| F01 | 1 | `esp1-anaitasuna` | Bidasoa Irun / Irun / esp-1 | id = Anaitasuna, data = Bidasoa Irún | H | Yes |
| F02 | 1 | `esp1-logrono` | Ademar León / León / esp-1 | id = BM Logroño La Rioja, data = Ademar León | H | Yes |
| F03 | 1 | `esp1-alicante` | Helvetia Anaitasuna / Pamplona / esp-1 | id = (Eón Horneo) Alicante, data = Anaitasuna, which is now second tier | H | Yes |
| F04 | 1 | `hun1-gyor` | Grundfos Tatabánya / Tatabánya / hun-1 | id = Győr (Győri ETO-UNI FKC), data = Tatabánya | H | Yes |
| F05 | 1 | `ger2-wilhelmshaven` | TV Bittenfeld / Waiblingen / ger-2 | Data duplicates TVB Stuttgart (ger1). Wilhelmshavener HV plays in the 3. Liga | H | Yes |
| F06 | 2 | `ger2-dessau` | SC DHfK Dessau / Dessau / ger-2 | Invented hybrid name; the real club is Dessau-Roßlauer HV 06 | H | No |
| F07 | 2 | `den2-fif` | FIF Håndbold / Fredensborg / den-2 | FIF = Frederiksberg IF (Copenhagen), not Fredensborg | H | No |
| F08 | 2 | `esp2-cisne` | Cisne Balonmano / Ourense / esp-2 | Club Cisne is from Pontevedra | H | No |
| F09 | 2 | `den1-hoj` | HØJ Elite / Hjørring / den-1 | HØJ is from Ølstykke/Jyllinge (Zealand), not Hjørring | H | No |
| F10 | 2 | `hun2-eger` | Egri Spartacus / Eger / hun-2 | No such club found; the Eger men's club is Eger-Eszterházy SzSE | M | No |
| F11 | 2 | `den1-sonderjyske` | SønderjyskE Håndbold / Aabenraa / den-1 | Wikipedia lists the men's home as Sønderborg | M | No |
| F12 | 3 | `den2-aarhus` | Aarhus Håndbold Herrer / Aarhus / den-2 | Suspected defunct: **refuted.** A new Aarhus Håndbold (2024) runs a men's team in the 1st Division | H | Small |
| F13 | 3 | `den1-skanderborg` | Skanderborg Aarhus / Aarhus / den-1 | Renamed Skanderborg AGF Håndbold in June 2023; name and shortName disagree | H | No |
| F14 | 3 | `ger1-leipzig`, `ger1-minden`, `ger2-balingen` (+ missing Bietigheim) | ger-1 / ger-2 | GER_1 is the 2025/26 list. For 2026/27, Leipzig and Minden were relegated and Balingen and Bietigheim promoted | H | Yes |
| F15 | 3 | `den1-hoj`, `den1-grindsted` | den-1 | Both relegated after 2025/26. KIF Kolding promoted via play-off | H | Yes |
| F16 | 3 | `hun1-veszprem`, `hun1-gyor` | Telekom Veszprém; Grundfos Tatabánya | Stale sponsor names: now ONE Veszprém HC and MOL Tatabánya KC | H | No |
| F17 | 3 | `nor1-bodo`, `nor2-fjellhammer`, `nor2-sandnes` | nor-1 / nor-2 | 2025/26 REMA 1000-ligaen includes Fjellhammer and Sandnes but not Bodø | H | Yes |
| F18 | 3 | `isl2-fram` | Fram / Reykjavík / isl-2 | Fram were 2025 Icelandic champions (top flight) | H | Yes |
| F19 | 3 | `svn2-skofjaloka`, `svn2-jeruzalem` | svn-2 | Both play in the top-flight Liga NLB 2025/26 | M | Yes |
| F20 | 3 | `hun2-komlo` | Komlói Bányász / Komló / hun-2 | Komló (Carbonex-Komló) plays in NB I | H | Yes |
| F21 | 3 | `esp2-teucro`, `esp2-cordoba` | esp-2 | Teucro played in Primera Nacional (third tier) in 2025/26. "BM Córdoba" was not found in the second tier | M / L | Yes |
| F22 | 4 | `se_club_hk_cliff` | HK Cliff / – / se_division1_norra | Separate club (est. 1939), but all 19 registered Div 1 players belong to Hammarby IF HF. The B-team relation is functionally right; the earlier research note is wrong | H | Yes |
| F23 | 4 | `se_club_if_kristianstad` | IF Kristianstad / – / Div 1 Södra | Own club ID; most players are registered with IF Kristianstad itself and only 3 with IFK Kristianstad. A permanent B team is too strong | M | Yes |
| F24 | 4 | `se_club_hp_alingsas` | HP Alingsås / – / Div 1 Södra | Confirmed: players registered with Alingsås HK. Keep the relation | H | No |
| F25 | 4 | `se_club_hk_onnerediterna` | HK Önnerediterna / – / Div 1 Södra | Confirmed: players registered with Önnereds HK (separate association ID). Keep | H | No |
| F26 | 4 | `se_club_hk_s_hof` | HK S-hof / – / Div 1 Södra | Probable: roster source is IK Sävehof's P18 page. Profixio not reached | M | No |
| F27 | 4 | Div 2 U-named teams (3 ids) | LUGI HF U, HF Karlskrona U, Ystads IF HF U | Affiliates of Handbollsligan clubs, not modelled as relations | H | Yes |
| F28 | 4 | Div 2 renamed affiliates (7 ids) | Tumba HK, VästeråsIrsta HK, HK Varberg 09, Helsingborgs HK, Malmö HP, HK Lif Blå, HK Ystadpågarna | Squads registered (fully or mostly) to a higher-tier club, but no relation is modelled | H | Yes |
| F29 | 4 | `se_div2_team_1578270` | Torslanda HK / – / Div 2 Väst | Partial link: 6 players registered with HK Torslanda Elit | M | Yes |
| F30 | 5 | `se_club_hk_cliff` | primary #0a7a3d (Hammarby green) | clubs.ts uses Hammarby green; registry uses HK Cliff yellow/blue. The shirt actually worn is unknown | M | Yes |
| F31 | 5 | F01–F05 ids | registry kits | Kits were researched for the club named in the data, not the club in the id. They become wrong if ids are re-pointed | H | Yes |
| F32 | 5 | `den2-aarhus` | registry black/orange | Probably from the old (pre-2021) Århus Håndbold, not the 2024 club | L | No |
| F33 | 5 | Div 1/Div 2 affiliates | kits null or parent kit | Affiliate teams' shirts are not documented. Do not inherit the parent kit silently | M | Yes |

---

## Detailed findings

### Category 1 — Felaktig klubbidentitet

#### F01 `esp1-anaitasuna` (Bidasoa Irun / Irun / esp-1)
- **Finding:** The id names SD Anaitasuna (Pamplona), but name, shortName, city and kit describe CD Bidasoa (Irudek Bidasoa Irún). Both are real clubs. The Spain t1 block looks as if its names were shifted by one row against the ids: the id `anaitasuna` carries Bidasoa, `logrono` carries Ademar and `alicante` carries Anaitasuna.
- **Real-world status:** Irudek Bidasoa Irún plays in Liga ASOBAL 2025/26 and is a European-League-level club. Anaitasuna was relegated after 2024/25 (see F03).
- **Evidence:** Wikipedia, 2025–26 Liga ASOBAL. The earlier research note (results-6) flagged the same mismatch.
- **Confidence:** High.
- **Proposed correction:** Keep the id. Product choice: either (a) keep the club the player sees (Bidasoa) and record in a code comment or alias that `esp1-anaitasuna` is a legacy id for Bidasoa, or (b) re-point the display data to the club the id names. Option (b) is not advisable here, because Anaitasuna is no longer in esp-1.
- **Consequences:** The id is a save key (club records, fixtures, `seasonHistory` tables, contracts). Keeping the id and changing only display data keeps saves loadable, but existing careers would show a different club name in place of one the player already knows. Squads for non-REAL_WORLD REST clubs are generated deterministically, partly seeded by key (`rating/generation/deterministicVariation.ts`), so keeping the id keeps the generated squad stable. Registry and crest: the kit in `registry.json` is Bidasoa's (yellow/navy). It fits option (a) but would be wrong under option (b).
- **Product decision:** Yes. Decide whether to keep the club players see (recommended) or follow the id.

#### F02 `esp1-logrono` (Ademar León / León / esp-1)
- **Finding:** The id names BM Logroño La Rioja, but the data is CB Ademar León. Both are real ASOBAL 2025/26 clubs (Abanca Ademar León and BM Logroño La Rioja).
- **Evidence:** Wikipedia, 2025–26 Liga ASOBAL (team list includes both).
- **Confidence:** High.
- **Proposed correction:** Keep the id and Ademar as the club players see. Add an id-alias note (`esp1-logrono` → Ademar León). If Logroño is wanted as a club, add it under a new id such as `esp1-logrono-larioja`. Never reuse `esp1-logrono` for Logroño, because existing saves treat that key as Ademar.
- **Consequences:** As for F01. Under the current approach the kit (white) is Ademar's.
- **Product decision:** Yes. Decide whether to add BM Logroño La Rioja as a separate club.

#### F03 `esp1-alicante` (Helvetia Anaitasuna / Pamplona / esp-1)
- **Finding:** The id names an Alicante club. Horneo Eón Alicante was promoted to ASOBAL for 2025/26, and TM Benidorm (Alicante province) was relegated in 2025. The data, however, is Helvetia Anaitasuna (Pamplona). In addition, **Anaitasuna is not first tier**: it was relegated from ASOBAL after 2024/25, played in División de Honor Plata in 2025/26, and lost the May 2026 promotion play-off to Puerto Sagunto, so it remains in Plata for 2026/27.
- **Evidence:** Wikipedia, 2025–26 Liga ASOBAL (relegated from 2024/25: Helvetia Anaitasuna, TM Benidorm; promoted: Horneo Eón Alicante, BM Caserío Ciudad Real). Puerto Sagunto and FC Barcelona Atlètic club news on the 2026 promotion phase. Cisne results against Anaitasuna in Plata, October 2025.
- **Confidence:** High.
- **Proposed correction:** Keep the id. Either (a) keep the Anaitasuna identity and move `competitionId` to `esp-2`, or (b) re-point the display data to Alicante (Eón Horneo Alicante, Alicante, esp-1) and add Anaitasuna as a new esp-2 club with its own new id.
- **Consequences:** Changing `competitionId` changes league membership and fixture generation. Apply it only to new careers or at a season transition. Do not rewrite a live season's fixtures. Kit: the registry holds Anaitasuna green/white, which would be wrong under (b).
- **Product decision:** Yes.

#### F04 `hun1-gyor` (Grundfos Tatabánya / Tatabánya / hun-1)
- **Finding:** The id names Győr. Győri ETO-UNI FKC ("ETO University HT") is a real NB I 2025/26 men's club. The data, however, is Tatabánya, whose current name is MOL Tatabánya KC; Grundfos is a former sponsor (see F16).
- **Evidence:** Wikipedia, 2025–26 Nemzeti Bajnokság I (men's handball). Team list includes both ETO University HT (Győr) and MOL Tatabánya KC.
- **Confidence:** High.
- **Proposed correction:** Keep the id and Tatabánya as the club players see. Rename it to "MOL Tatabánya KC" / "Tatabánya" and document `hun1-gyor` as a legacy id. Add Győr as a new id only if the product wants it.
- **Consequences:** As for F01. The registry kit (blue/white) is Tatabánya's.
- **Product decision:** Yes.

#### F05 `ger2-wilhelmshaven` (TV Bittenfeld / Waiblingen / ger-2)
- **Finding:** The id names Wilhelmshavener HV, but the data is "TV Bittenfeld". TV Bittenfeld 1898 *is* TVB Stuttgart: the senior team renamed itself on promotion in 2015, and the club is from Bittenfeld/Waiblingen. The game therefore has **the same club twice**: `ger1-stuttgart` in ger-1 and `ger2-wilhelmshaven` in ger-2. Wilhelmshavener HV itself played in the **3. Liga Nord-West** in 2025/26 and is not on the 2026/27 2. Bundesliga list.
- **Evidence:** Wikipedia, TVB Stuttgart (former name TV Bittenfeld). Hessenschau 2. Bundesliga 2026/27 table (18 clubs, no Wilhelmshaven). 2025/26 3. Liga N/W tables and Sportradar match reports for WHV. The earlier research note (results-5) flagged the same.
- **Confidence:** High.
- **Proposed correction:** Keep the id and replace the display data with a real 2026/27 2. Bundesliga club that is not already in the database. Candidates from the 2026/27 table: TuSEM Essen, HC Dresden, VfL Lübeck-Schwartau, TV Großwallstadt, Bayer Dormagen, VfL Potsdam and others. Alternatively, rename it to Wilhelmshavener HV and set it to a third tier, but the game has no German third tier. Record `ger2-wilhelmshaven` → chosen club as an alias note.
- **Consequences:** Removes the duplicate club. Saves keep the key. Kit is currently null in the registry, so a new research item is needed.
- **Product decision:** Yes. Choose the replacement club.

### Category 2 — Felaktigt klubbnamn

#### F06 `ger2-dessau` (SC DHfK Dessau / Dessau / ger-2)
- **Finding:** "SC DHfK Dessau" does not exist. The name mixes SC DHfK Leipzig with Dessau. The id and city point to **Dessau-Roßlauer HV 06** (DRHV, "Dessauer HV"), which plays in the 2. Handball-Bundesliga in 2026/27. This is not a duplicate of Leipzig: `ger1-leipzig` is a separate entry, and Leipzig itself now also plays in the 2. Bundesliga (F14).
- **Evidence:** Wikipedia, Dessau-Roßlauer HV. HBL 2. Bundesliga 2026/27 provisional schedule. Hessenschau 2. BL 2026/27 table ("Dessauer HV"). The earlier research (results-5) researched the DRHV kit (blue/white).
- **Confidence:** High.
- **Proposed correction:** Keep the id. name → "Dessau-Roßlauer HV 06", shortName → "Dessau", city "Dessau-Roßlau".
- **Consequences:** Display-only change. The registry kit already reflects DRHV.
- **Product decision:** No.

#### F07 `den2-fif` (FIF Håndbold / Fredensborg / den-2)
- **Finding:** FIF Håndbold is Frederiksberg IF (Frederiksberg, Copenhagen; home at Frederiksberghallen) and plays in the Danish 1st Division. The city is wrong.
- **Evidence:** Wikipedia, Frederiksberg IF. The club's own site, fifhaandbold.dk.
- **Confidence:** High.
- **Proposed correction:** city → "Frederiksberg". Optionally name → "FIF Håndbold (Frederiksberg IF)".
- **Consequences:** Display and geography only. Derby or distance logic that uses `city` will change.
- **Product decision:** No.

#### F08 `esp2-cisne` (Cisne Balonmano / Ourense / esp-2)
- **Finding:** Club Cisne is from Pontevedra and plays at the Pabellón Municipal de los Deportes de Pontevedra. Ourense is wrong. Cisne is in División de Honor Plata, so the competition is correct. Note that `esp2-teucro` is also from Pontevedra (F21).
- **Evidence:** Local Pontevedra event and press listings (planomato.com) and Puerto Sagunto match reports.
- **Confidence:** High.
- **Proposed correction:** city → "Pontevedra".
- **Consequences:** Display and geography. A Cisne–Teucro derby becomes possible.
- **Product decision:** No.

#### F09 `den1-hoj` (HØJ Elite / Hjørring / den-1)
- **Finding:** HØJ Elite is based in Ølstykke/Jyllinge on Zealand, not in Hjørring (North Jutland). It was also relegated (F15).
- **Evidence:** Wikipedia, HØJ Elite. Wikipedia, 2025–26 Håndboldligaen (city column "Ølstykke / Jyllinge"). The earlier research note (results-5) also flagged the unverified city.
- **Confidence:** High.
- **Proposed correction:** city → "Ølstykke".
- **Consequences:** Display and geography.
- **Product decision:** No (the league move is a separate decision, F15).

#### F10 `hun2-eger` (Egri Spartacus / Eger / hun-2)
- **Finding:** No men's club called "Egri Spartacus" was found. The Eger men's club is Eger-Eszterházy SzSE (SBS-Eger). It was listed only in the "team changes" section of NB I 2025/26, consistent with relegation to the second tier.
- **Evidence:** Wikipedia, 2025–26 NB I (men's handball). The earlier research note (results-6) assumed SBS-Eger.
- **Confidence:** Medium.
- **Proposed correction:** name → "Eger-Eszterházy SzSE", shortName "Eger".
- **Consequences:** Display only.
- **Product decision:** No.

#### F11 `den1-sonderjyske` (SønderjyskE Håndbold / Aabenraa / den-1)
- **Finding:** Wikipedia's 2025–26 Håndboldligaen city column gives Sønderborg for SønderjyskE's men's team. Aabenraa is the city of SønderjyskE's football section.
- **Evidence:** Wikipedia, 2025–26 Håndboldligaen.
- **Confidence:** Medium. Check the arena registry (`clubVenues.ts`) before changing.
- **Proposed correction:** city → "Sønderborg".
- **Consequences:** Display and geography.
- **Product decision:** No.

### Category 3 — Inaktuell klubb

#### F12 `den2-aarhus` (Aarhus Håndbold Herrer / Aarhus / den-2) — suspicion refuted
- **Finding:** The *old* Århus Håndbold went bankrupt in April 2021. Its top-flight men's operation continued as Skanderborg Aarhus Håndbold, renamed Skanderborg AGF Håndbold in June 2023 (`den1-skanderborg`). Skanderborg AGF describes the 2021 events as the old club ceasing and a new club being created; Wikipedia calls it a merger. However, a **new club named Aarhus Håndbold was founded on 1 July 2024** from the merger of Aarhus United and Aarhus HC. Its men's team, "Aarhus Håndbold Herrer", is in the Danish 1st Division: it was listed for 2024/25, and 2025/26 results include matches against Elitesport Vendsyssel. The game entry therefore matches a **current, real club**. The earlier research note (results-5: "no current men's entity found") is wrong.
- **Evidence:** Wikipedia, Aarhus Håndbold (women's handball) (founded 1 July 2024; men's team in the 1st Division). Wikipedia, Danish 1st Division (handball) (2024/25 list). Wikipedia, Skanderborg AGF Håndbold. Aarhus Håndbold press release (aarhush.dk). tophaandbold.dk match reports.
- **Confidence:** High.
- **Proposed correction:** No identity change. Add a code comment that this is the 2024 club, *not* the pre-2021 Århus Håndbold, which has no successor id other than `den1-skanderborg`. Confirm the 2026/27 division: the club was in contention near the top of the 2025/26 table.
- **Consequences:** None to saves. The kit needs review (F32).
- **Product decision:** Small. Confirm the 2026/27 tier.

#### F13 `den1-skanderborg` (Skanderborg Aarhus / shortName "Skanderborg AGF" / Aarhus / den-1)
- **Finding:** The club was renamed Skanderborg AGF Håndbold in June 2023, when AGF bought 50%. The game's `name` still uses the 2021–23 name while the `shortName` uses the current one. Its home is Skanderborg (Fælled), with games also at Ceres Arena in Aarhus.
- **Evidence:** Wikipedia, Skanderborg AGF Håndbold.
- **Confidence:** High.
- **Proposed correction:** name → "Skanderborg AGF Håndbold". city → "Skanderborg", or keep "Aarhus" if the arena registry deliberately uses Ceres Arena.
- **Consequences:** Display only.
- **Product decision:** No.

#### F14 Germany ger-1 / ger-2 placement for 2026/27
- **Finding:** The comment above GER_1 claims a "verified full 18-club list", but it is the **2025/26** list. For 2026/27:
  - **SC DHfK Leipzig** (`ger1-leipzig`) and **GWD Minden** (`ger1-minden`) were relegated to the 2. Bundesliga.
  - **HBW Balingen-Weilstetten** (`ger2-balingen`) was promoted to ger-1.
  - **SG BBM Bietigheim** was promoted to ger-1 and is missing from the database.
  - The Wikipedia city column lists Bergischer HC as Wuppertal, HC Erlangen as Nuremberg and MT Melsungen as Kassel (arena cities). This is minor.
- **Evidence:** Wikipedia, 2026–27 Handball-Bundesliga. Hessenschau 2. Bundesliga 2026/27 table (includes DHfK Leipzig and GWD Minden). HBL 2. BL 2026/27 provisional schedule.
- **Confidence:** High.
- **Proposed correction:** Keep all ids. Move `ger1-leipzig` and `ger1-minden` to `ger-2` and `ger2-balingen` to `ger-1`. Add Bietigheim under a new id. The `ger1-`/`ger2-` id prefixes then no longer match the league; that is acceptable, because ids are keys, not labels. Document it.
- **Consequences:** League membership, fixture generation and season-transition promotion/relegation logic are affected. Apply to new careers, or through the season-transition path for existing saves. `seasonHistory` keeps the old `competitionId` per season, so history stays correct. Squad strength generated for an 18-team top-flight would need recalibration for promoted or relegated clubs.
- **Product decision:** Yes. Decide whether the international leagues should reflect 2026/27 reality, and how existing saves are migrated.

#### F15 Denmark den-1 placement for 2026/27
- **Finding:** DEN_1 is the 2025/26 Håndboldligaen. **Grindsted GIF** (`den1-grindsted`, last in the regular season) and **HØJ Elite** (`den1-hoj`, lost the play-off) were relegated. **KIF Kolding** was promoted via the play-off and is missing from the database. The direct promotee from the 2025/26 1st Division could not be confirmed.
- **Evidence:** Wikipedia, 2025–26 Håndboldligaen. Sjællandske Nyheder (sn.dk) live report on HØJ's relegation. The earlier research note (results-5) also mentions the relegation.
- **Confidence:** High for the relegations and Kolding. The second promotee is unknown.
- **Proposed correction:** Move both to `den-2` and add KIF Kolding (plus the unconfirmed second promotee) under new ids.
- **Consequences:** As for F14.
- **Product decision:** Yes.

#### F16 Stale sponsor names: `hun1-veszprem`, `hun1-gyor`
- **Finding:** "Telekom Veszprém" is now **ONE Veszprém HC** (it won its 30th title under that name). Tatabánya is **MOL Tatabánya KC**; Grundfos is an earlier sponsor. Pick Szeged currently plays as OTP Bank-Pick Szeged; the game's "Pick Szeged" is an acceptable neutral form.
- **Evidence:** Wikipedia, 2025–26 NB I (men's handball). The earlier research note (results-6).
- **Confidence:** High.
- **Proposed correction:** Prefer neutral, sponsor-free names that stay correct ("Veszprém KC", "Tatabánya KC"), or update them to the current sponsor names.
- **Consequences:** Display only.
- **Product decision:** No, beyond a naming-policy choice (sponsor or neutral names).

#### F17 Norway placement: `nor1-bodo`, `nor2-fjellhammer`, `nor2-sandnes`
- **Finding:** The 2025/26 REMA 1000-ligaen (men) has 14 clubs, including **Fjellhammer IL** and **Sandnes HK** (the game places both in nor-2) but not **Bodø HK** (the game places it in nor-1). Nordstrand and Vestli are correctly outside the top flight.
- **Evidence:** Wikipedia, REMA 1000-ligaen (men's handball), 2025–26 team list.
- **Confidence:** High for 2025/26. 2026/27 movements were not checked.
- **Proposed correction:** Swap the tiers (Fjellhammer and Sandnes to nor-1, Bodø to nor-2), subject to a 2026/27 check.
- **Consequences:** As for F14.
- **Product decision:** Yes.

#### F18 `isl2-fram` (Fram / Reykjavík / isl-2)
- **Finding:** Fram won the 2024/25 Icelandic men's title and cup (a double) and are a top-flight club. The game places them in the second tier.
- **Evidence:** Wikipedia, Fram men's handball. gohandball.com, "Fram champion in Iceland".
- **Confidence:** High.
- **Proposed correction:** `competitionId` → `isl-1`.
- **Consequences:** As for F14.
- **Product decision:** Yes.

#### F19 Slovenia: `svn2-skofjaloka`, `svn2-jeruzalem`
- **Finding:** RD Loka (Urbanscape Loka) and RK Jeruzalem Ormož both play in the top-flight Liga NLB in 2025/26, not the second tier. Also, the original RD Loka went bankrupt in 2011, and the current club, RD Loka 2012, is its successor. "RD Škofja Loka" is acceptable as a neutral name.
- **Evidence:** Slovenian Liga NLB 2025/26 match coverage (siol.net, 24ur.com, rtvslo.si). The earlier research note (results-6) covered the RD Loka succession.
- **Confidence:** Medium, from secondary aggregation.
- **Proposed correction:** `competitionId` → `svn-1` for both.
- **Consequences:** As for F14.
- **Product decision:** Yes.

#### F20 `hun2-komlo` (Komlói Bányász / Komló / hun-2)
- **Finding:** Carbonex-Komló (Komlói BSK) plays in NB I 2025/26. Ceglédi KKSE and Eger are not in NB I, which is consistent with hun-2. Note also that the WORLD_POOL comment calls hun-2 "NB II"; the Hungarian second tier is NB I/B.
- **Evidence:** Wikipedia, 2025–26 NB I (men's handball).
- **Confidence:** High.
- **Proposed correction:** `competitionId` → `hun-1`, and correct the comment wording.
- **Consequences:** As for F14.
- **Product decision:** Yes.

#### F21 Spain second tier: `esp2-teucro`, `esp2-cordoba`
- **Finding:** SD Teucro played in **Primera Nacional** (third tier) in 2025/26, not División de Honor Plata. "BM Córdoba" could not be found as a men's Plata club. The Córdoba men's handball found plays in lower national categories, and the main Córdoba-province club is Ángel Ximénez Puente Genil (ASOBAL). Bada Huesca was relegated from ASOBAL in 2026, so `esp2-huesca` is now correctly placed for 2026/27.
- **Evidence:** planomato.com (Teucro Primera Nacional fixtures, 2025). Sofascore (Primera Nacional). eldebate.com (Córdoba handball, 2025–26). Wikipedia, 2025–26 Liga ASOBAL (Huesca relegated).
- **Confidence:** Medium (Teucro); Low (Córdoba).
- **Proposed correction:** Keep the ids. Replace their display data with confirmed 2026/27 Plata clubs (for example Servigroup Benidorm or Balonmano Zamora), or leave them as they are with a documented "approximate" flag.
- **Consequences:** Display only if the ids are re-labelled. Kits must be re-researched.
- **Product decision:** Yes.

### Category 4 — Felaktig relation mellan klubbar

Swedish handball context: Profixio, the official SHF registration system, shows each player's registration club ("Skriven i"). When a lower-division team appears under one club name but all its players are registered with another club, that team is functionally the second club's U or B team, playing under a separate association or licence (a samarbetsförening). This pattern is common and is the basis of the findings below.

#### F22 `se_club_hk_cliff` (HK Cliff / Division 1 Norra) — relation confirmed, framing needs correction
- **Finding:** HK Cliff is a historic, independent club: founded on 2 February 1939 in Stockholm (Skärholmen/Mälarhöjden), with four top-flight seasons, the last in 1989/90. It has its own SHF club ID, 26051. However, the HK Cliff team in Division 1 Norra 2026/27 has **all 19 listed players registered with Hammarby IF HF** (club ID 25963) and **none with HK Cliff**. The repo's own roster source is `hammarbyhandboll.se/u-laget/truppen` (Hammarby "Herrar U"). The `clubs.ts` comment and `PERMANENT_B_TEAM_PAIRS` (Hammarby → Cliff) are therefore **functionally correct**. The earlier research note (results-2: "Not a B team… independent… no parent") describes the association, not the playing team, and is misleading.
- **Evidence:** Profixio, Division 1 Norra 2026/27, team 1578872 (players "Skriven i: Hammarby IF HF"). sv.wikipedia, HK Cliff. Hammarby Handboll U-lag page. Partille Cup listings for HK Cliff youth teams.
- **Confidence:** High.
- **Proposed correction:** Keep the id and the AFFILIATED_B_TEAM relation. Add a note that HK Cliff is a partner association whose Division 1 licence is used by Hammarby's U team, and that HK Cliff's own youth section is separate. Re-check `playable: true` and the UI copy (see the product decisions).
- **Consequences:** No save impact if kept. If the relation were removed, `seedPermanentBTeamPartnerships` would leave existing rows in saves, so a removal would need a migration. Kit: see F30.
- **Product decision:** Yes. Decide how to present HK Cliff (Hammarby U under the Cliff name vs Cliff as its own club) and whether it stays manager-selectable.

#### F23 `se_club_if_kristianstad` (IF Kristianstad / Division 1 Södra)
- **Finding:** IF Kristianstad has its own SHF club ID (25971), separate from IFK Kristianstad (25964). Most players on the 2026/27 Division 1 roster are registered with IF Kristianstad itself. **Only three** (Felix Wandås, Ludvig Svanström, Theo Ivarsson) are registered with IFK Kristianstad. The roster source is hosted on IFK Kristianstad's SportAdmin site, so the two are closely linked, but the evidence supports a development or partner association rather than a pure B team.
- **Evidence:** Profixio, Division 1 Södra 2026/27, team 1575285. Repo source file `data/real-world/sweden/2026-27/division1-sodra/IF Kristianstad/sources-*.json`.
- **Confidence:** Medium.
- **Proposed correction:** Keep the id. Consider modelling this as a permanent DEVELOPMENT_PARTNERSHIP-style relation rather than AFFILIATED_B_TEAM, or keep the B-team relation with a documented caveat.
- **Consequences:** Changing the relation type for an existing permanent row requires a save migration. `seedPermanentBTeamPartnerships` only adds rows and never removes them.
- **Product decision:** Yes.

#### F24 `se_club_hp_alingsas` (HP Alingsås / Division 1 Södra)
- **Finding:** Confirmed. The roster players are registered with Alingsås HK. The repo already removed a duplicate player under an owner decision dated 2026-11-05, describing the team as Alingsås HK's farm team. What "HP" stands for was not found.
- **Evidence:** Profixio, team 1572549. Repo `players-hp_alingsas.json` owner-decision note. Roster source alingsashk.myclub.se.
- **Confidence:** High.
- **Proposed correction:** None to the relation.
- **Consequences:** None.
- **Product decision:** No.

#### F25 `se_club_hk_onnerediterna` (HK Önnerediterna / Division 1 Södra)
- **Finding:** Confirmed. Every player is registered with Önnereds HK (club ID 26047), while the team sits under a separate association ID (26228). The roster source is Önnereds HK's "U-lag herr / HK Önnerediterna" page.
- **Evidence:** Profixio, team 1575759. onneredshk.se.
- **Confidence:** High.
- **Proposed correction:** None.
- **Consequences:** None.
- **Product decision:** No.

#### F26 `se_club_hk_s_hof` (HK S-hof / Division 1 Södra)
- **Finding:** Probable. The repo roster source is IK Sävehof's P18 page (iksungdom.se), and an existing rating note calls S-hof Sävehof's reserve team. The Profixio team page could not be located for an independent check.
- **Evidence:** iksungdom.se/iksavehof-p18/truppen. Repo `rating-review.json` note.
- **Confidence:** Medium.
- **Proposed correction:** None now. Verify against Profixio when possible.
- **Consequences:** None.
- **Product decision:** No.

#### F27 Division 2 "U" teams — affiliates not modelled
| Div 2 id | Name | Registration evidence (Profixio) | Parent in game |
|---|---|---|---|
| `se_div2_team_1585295` | LUGI HF U | Own association ID 26102; all 18 players registered with **Lugi HF** | `se_club_lugi_hf` |
| `se_div2_team_1582183` | HF Karlskrona U | Club ID 26363 = **HF Karlskrona** itself; 20/21 players registered with HF Karlskrona | `se_club_hf_karlskrona` |
| `se_div2_team_1585596` | Ystads IF HF U | Association ID 26429; all 25 players registered with **Ystads IF HF** | `se_club_ystads_if_hf` |
- **Finding:** These are U teams of Handbollsligan clubs. `sweden2026Data.json` deliberately records "No parent affiliation… inferred", and no partnership is modelled. As a result, they can be offered to other clubs as DEVELOPMENT_PARTNERSHIP candidates, which is unrealistic, and their players are counted as independent. The HF Karlskrona case is a team of the same club rather than a separate association.
- **Confidence:** High.
- **Proposed correction:** Keep the ids (`se_div2_team_<profixioTeamId>` is a stable registration key). Add permanent affiliate rows, using the existing AFFILIATED_B_TEAM type or a new "U_TEAM" type, so they are excluded from partnership offers.
- **Consequences:** Adding permanent rows is save-safe, because the seeding helper only adds missing rows. It does affect transfer, loan and partnership-candidate logic. Division 2 squads are not real-world, so nothing has to be removed.
- **Product decision:** Yes. Decide whether Division 2 affiliates get modelled relations at all.

#### F28 Division 2 affiliates registered under a different club name
| Div 2 id | Name | Registration evidence (Profixio) | Real parent (game id) |
|---|---|---|---|
| `se_div2_team_1582988` | Tumba HK | Association ID 26146; **all** players registered with IFK Tumba HK | `swe2-tumba` |
| `se_div2_team_1578886` | VästeråsIrsta HK | Association ID 26317; players registered with VästeråsIrsta HF ("Herr 2 Mitt") | `swe2-vasterasirsta` |
| `se_div2_team_1575715` | HK Varberg 09 | "Handbollklubben Varberg 09", ID 26185; 12 of 15 players registered with HK Varberg | `swe2-varberg` |
| `se_div2_team_1578982` | Helsingborgs HK | ID 26450; 21 of 23 registered with OV Helsingborg HK | `se_club_ov_helsingborg` |
| `se_div2_team_1579219` | Malmö HP | ID 26298; 29/29 registered with HK Malmö | `se_club_hk_malmo` |
| `se_div2_team_1575788` | HK Lif Blå | ID 26101; 18/18 registered with LIF Lindesberg | `se_club_lif_lindesberg` (Division 1) |
| `se_div2_team_1583015` | HK Ystadpågarna | ID 26411; 22/22 registered with IFK Ystad HK | `swe2-ystad2` |
- **Finding:** Each of these is functionally the second team of a higher-tier club, playing under a separate association name. None is modelled. The earlier kit research left most of them "unconfirmed relation" (results-3 and results-4). That uncertainty is now resolved. The name pairs Tumba HK / IFK Tumba HK and VästeråsIrsta HK / VästeråsIrsta HF are **different entities that belong together**, not duplicates or typos: keep both names exactly as registered.
- **Confidence:** High (Varberg 09 high-medium, 12/15).
- **Proposed correction:** Same as F27.
- **Consequences:** Same as F27. In addition, `canonicalClubNames.ts` normalises "tumba" and "vasterasirsta". Make sure the display-name normalisation never merges the Division 2 entity into the senior club's name.
- **Product decision:** Yes (together with F27).

#### F29 `se_div2_team_1578270` (Torslanda HK / Division 2 Väst)
- **Finding:** Partial link. Six players (born 2005–2008) are registered with HK Torslanda Elit (`swe2-torslanda`), and the rest show no such link. This looks like a separate club (ID 26041) with a youth or loan connection, not a B team. The earlier kit research used Torslanda youth entries for this team.
- **Evidence:** Profixio, team 1578270.
- **Confidence:** Medium.
- **Proposed correction:** Do not model it as a B team. At most, model a development partnership.
- **Consequences:** None if left unmodelled.
- **Product decision:** Yes (low priority).

### Category 5 — Osäker matchtröja

#### F30 `se_club_hk_cliff` kit
- **Finding:** `clubs.ts` gives HK Cliff Hammarby green (#0a7a3d) and white. `registry.json` gives yellow (#FFFF00) and blue, from HK Cliff's own Wikipedia template. The playing squad is Hammarby's U team (F22). Which shirt that team wears in Division 1 (Cliff colours or Hammarby green) is undocumented.
- **Confidence:** Medium on the conflict; the actual shirt is unknown.
- **Proposed correction:** Mark the kit "unverified". Check a Profixio match sheet, match photos or Hammarby U-team media.
- **Consequences:** Visual only.
- **Product decision:** Yes. Decide which identity the team is shown under (tied to F22).

#### F31 Kits of the id-mismatch entries (F01–F05)
- **Finding:** Kits in `registry.json` were researched for the club in the *name*: Bidasoa yellow/navy, Ademar white, Anaitasuna green/white, Tatabánya blue/white, and null for "TV Bittenfeld". They are correct only if the club players see is kept. If any id is re-pointed (option b in F01–F05), the kit becomes wrong. `ger2-wilhelmshaven` has no kit at all.
- **Confidence:** High.
- **Proposed correction:** Re-research the kit for each entry after the identity decision.
- **Consequences:** Visual and crest only.
- **Product decision:** Yes (follows F01–F05).

#### F32 `den2-aarhus` kit (black/orange)
- **Finding:** No source was found for the 2024 club's men's shirt. The registry's black/orange may have come from the pre-2021 Århus Håndbold.
- **Confidence:** Low.
- **Proposed correction:** Re-research using the 2024 Aarhus Håndbold.
- **Consequences:** Visual only.
- **Product decision:** No.

#### F33 Affiliate teams (Division 1 and Division 2)
- **Finding:** For HK S-hof, HP Alingsås, IF Kristianstad, HK Önnerediterna, the Division 2 "U" teams and the F28 teams, the kits are null or follow the parent's colours without evidence. The earlier research correctly refused to copy parent kits.
- **Proposed correction:** Keep them null or "unverified" until there is evidence. If a fallback is needed, show the parent's colours with an "unverified" flag rather than presenting them as fact.
- **Product decision:** Yes. Decide the fallback rule for affiliates.

---

## Checked and found consistent (no finding)

- `ger2-nordhorn` (HSG Nordhorn-Lingen): in the 2. BL 2026/27.
- `den2-vendsyssel` (Elitesport Vendsyssel, Hjørring): men's team in the Danish 1st Division 2024/25 and 2025/26 (Hallen Park Vendia, Hjørring). It is separate from the bankrupt women's club Vendsyssel Håndbold (2022). Its 2026/27 status (possibly relegated) is unconfirmed.
- `den2-fif` competition (1st Division): correct; only the city is wrong (F07).
- `esp2-huesca`: correctly second tier for 2026/27 after the 2026 relegation.
- `int-cologno` "Metelli Cologne": a real club, Pallamano Cologne (Brescia province), not Köln.
- Allsvenskan / Handbollsligan blocks: no identity errors found in this pass. HK Torslanda Elit vs Torslanda HK and HK Varberg vs HK Varberg 09 are distinct entities (F28, F29).

## Save-compatibility guidance (applies to all corrections)

1. **Never rename or reuse an id.** Ids are keys in `CareerState` (clubs, fixtures, contracts, `clubPartnerships`, `seasonHistory[].competitionId`, transition receipts) and in `registry.json`. Change only display fields (`name`, `shortName`, `city`). Record legacy meanings in a comment or a small `CLUB_ID_NOTES` / alias table, for example `esp1-logrono` → "legacy id; club = Ademar León".
2. **New real clubs get new ids** (Bietigheim, KIF Kolding, optionally BM Logroño, Eón Alicante, Győr, Anaitasuna). No existing id is re-pointed to a different club that saves already treat as something else.
3. **`competitionId` moves** (F03, F14, F15, F17–F21) affect league membership and fixture generation. Apply them to new careers and through the season-transition path. Do not rewrite an in-progress season. Past `seasonHistory` keeps its recorded `competitionId`.
4. **Generated squads** for REST clubs are deterministic. Keeping the id keeps the squad. Strength calibration may need adjustment when a club changes tier.
5. **Partnership changes:** `seedPermanentBTeamPartnerships` only adds rows. Adding Division 2 affiliates is save-safe, but removing or retyping an existing permanent row (F23) needs an explicit migration.
6. **Registry, crests and kits:** after any identity decision, rebuild the `registry.json` entry and re-research the kit (F31).

## Product decisions needed

1. **Spain t1 and Hungary t1 id mismatches (F01–F04):** keep the club players see under a legacy id (recommended), or re-point the display data to the club the id names? Also decide whether to add BM Logroño La Rioja, Eón Horneo Alicante and Győri ETO-UNI FKC as new clubs.
2. **Anaitasuna (F03):** move it to esp-2 for 2026/27?
3. **`ger2-wilhelmshaven` (F05):** which real 2026/27 2. Bundesliga club should replace the duplicate "TV Bittenfeld"?
4. **League freshness (F14, F15, F17–F21):** should the international leagues reflect 2026/27 reality, including the promotions and relegations in Germany and Denmark and the tier fixes in Norway, Iceland, Slovenia, Hungary and Spain? If so, how are existing saves migrated, given that new careers are easy?
5. **Sponsor names (F16):** use neutral names or current sponsor names?
6. **HK Cliff (F22, F30):** present it as Hammarby's U team playing under the HK Cliff name, or as HK Cliff the historic club? Should it stay `playable: true`? Which kit?
7. **IF Kristianstad (F23):** keep it as a permanent B team or downgrade to a development partnership?
8. **Division 2 affiliates (F27–F29):** model the 10 confirmed affiliate relations so they are excluded from partnership offers and linked to their parents?
9. **Affiliate kit fallback (F33):** may affiliate teams display the parent's colours with an "unverified" flag?
10. **Spain second tier (F21):** replace Teucro and "BM Córdoba" with confirmed 2026/27 Plata clubs, or accept them as approximate?

## Sources

- Wikipedia, Skanderborg AGF Håndbold: https://en.wikipedia.org/wiki/Skanderborg_AGF_H%C3%A5ndbold
- Wikipedia, Aarhus Håndbold (women's handball; founded 2024, men's team in 1st Division): https://en.wikipedia.org/wiki/Aarhus_H%C3%A5ndbold_(women%27s_handball)
- Wikipedia, Aarhus Håndbold (former men's club): https://en.wikipedia.org/wiki/Aarhus_H%C3%A5ndbold
- Aarhus Håndbold press release: https://aarhush.dk/wp-content/uploads/Pressemeddelelse_AarhusHaandbold.pdf
- Wikipedia, Danish 1st Division (handball): https://en.wikipedia.org/wiki/Danish_1st_Division_(handball)
- tophaandbold.dk match report (Aarhus vs Elitesport Vendsyssel): https://tophaandbold.dk/intranet/pdfs/game/6580/report
- Wikipedia, 2025–26 Håndboldligaen: https://en.wikipedia.org/wiki/2025%E2%80%9326_H%C3%A5ndboldligaen
- Sjællandske Nyheder, HØJ relegation: https://www.sn.dk/art6566999/sport/sport/live-kl-1445-knald-eller-fald-for-hoej-skaebnen-afgoeres-i-dag
- Wikipedia, HØJ Elite: https://en.wikipedia.org/wiki/H%C3%98J_Elite
- Wikipedia, Frederiksberg IF: https://en.wikipedia.org/wiki/Frederiksberg_IF
- FIF Håndbold club news: https://fifhaandbold.dk/klub/fif-handbold--2/nyheder/20964
- Wikipedia, Vendsyssel Håndbold: https://en.wikipedia.org/wiki/Vendsyssel_H%C3%A5ndbold
- Wikipedia, TVB Stuttgart (former TV Bittenfeld): https://en.wikipedia.org/wiki/TVB_Stuttgart
- Wikipedia, Dessau-Roßlauer HV: https://en.wikipedia.org/wiki/Dessau-Ro%C3%9Flauer_HV
- HBL, 2. HBL 2026/27 provisional schedule: https://www.daikin-hbl.de/downloads/HBL/HBL_GmbH/Spielplan/Spielplan_2.HBL_Saison-26-27.pdf
- Hessenschau, 2. Bundesliga 2026/27 table: https://www.hessenschau.de/sport/ergebnisse-tabellen/handball-2bl100~_matchday-26.html
- Wikipedia, 2026–27 Handball-Bundesliga: https://en.wikipedia.org/wiki/2026%E2%80%9327_Handball-Bundesliga
- Wikipedia, Wilhelmshavener HV: https://en.wikipedia.org/wiki/Wilhelmshavener_HV
- 3. Liga N/W 2025/26 table (Wilhelmshaven): https://tabellen.traunsteiner-tagblatt.de/handball/maenner-__berregional-3__liga/3__liga_n_w_maenner/2025_26.html
- Hessenschau, Wilhelmshavener HV matches: https://www.hessenschau.de/sport/ergebnisse-tabellen/handball-356~team_id-285.html
- Wikipedia, 2025–26 Liga ASOBAL: https://en.wikipedia.org/wiki/2025%E2%80%9326_Liga_ASOBAL
- Puerto Sagunto club news (2026 promotion phase, Anaitasuna): https://www.cbmpuertosagunto.com/noticias/anaitasuna-primera-piedra-en-el-camino?lang=en
- FC Barcelona, Barça Atlètic 2026/27 Plata season preview: https://www.fcbarcelona.es/es/noticias/4575120/el-barca-atletic-empieza-la-liga-con-ilusiones-renovadas
- Planomato (Cisne in Pontevedra; Cisne vs Anaitasuna): https://planomato.com/es/pontevedra/p/partido-balonmano-cisne-vs-anaitasuna
- Planomato (Teucro in Primera Nacional): https://planomato.com/es/pontevedra/p/partido-balonmano-teucro-tacoronte-primera-nacional
- El Debate, Córdoba handball 2025: https://www.eldebate.com/espana/la-voz-de-cordoba/deportes/20251224/balonmano-cordobes-entre-ilusion-dudas-cerrar-2025_368653_amp.html
- Wikipedia, 2025–26 Nemzeti Bajnokság I (men's handball): https://en.wikipedia.org/wiki/2025%E2%80%9326_Nemzeti_Bajnoks%C3%A1g_I_(men%27s_handball)
- Wikipedia, REMA 1000-ligaen (men's handball): https://en.wikipedia.org/wiki/REMA_1000-ligaen_(men%27s_handball)
- Wikipedia, Fram men's handball: https://en.wikipedia.com/wiki/Fram_men%27s_handball
- gohandball.com, Fram champion in Iceland: https://gohandball.com/?p=8805
- RTV Slovenija, start of the national championship season: https://www.rtvslo.si/sport/rokomet/drzavno-rokometno-prvenstvo/zacenja-se-nova-sezona-drzavnega-prvenstva/639764
- Siol.net, Liga NLB round reports: https://siol.net/sportal/rokomet/liga-nlb-9-krog-704482
- sv.wikipedia, HK Cliff: https://sv.wikipedia.org/wiki/HK_Cliff
- Hammarby Handboll, Herrar U squad: https://www.hammarbyhandboll.se/u-laget/truppen
- Profixio, HK Cliff (Division 1 Norra 2026/27): https://www.profixio.com/app/lx/competition/leagueid28142/teams/1578872?t=players
- Profixio, HP Alingsås: https://www.profixio.com/app/lx/competition/leagueid28142/teams/1572549?t=players
- Profixio, IF Kristianstad: https://www.profixio.com/app/lx/competition/leagueid28142/teams/1575285?t=players
- Profixio, HK Önnerediterna: https://www.profixio.com/app/lx/competition/leagueid28142/teams/1575759?t=players
- IK Sävehof P18 squad (HK S-hof roster source): https://www.iksungdom.se/iksavehof-p18/truppen
- Profixio, Tumba HK: https://www.profixio.com/app/leagueid27989/teams/1582988
- Profixio, VästeråsIrsta HK: https://www.profixio.com/app/leagueid28151/teams/1578886
- Profixio, LUGI HF U: https://www.profixio.com/app/leagueid28096/teams/1585295
- Profixio, HF Karlskrona U: https://www.profixio.com/app/leagueid28096/teams/1582183
- Profixio, Ystads IF HF U: https://www.profixio.com/app/leagueid28096/teams/1585596
- Profixio, HK Varberg 09: https://www.profixio.com/app/leagueid28052/teams/1575715
- Profixio, Torslanda HK: https://www.profixio.com/app/leagueid28052/teams/1578270
- Profixio, Helsingborgs HK: https://www.profixio.com/app/leagueid28096/teams/1578982
- Profixio, Malmö HP: https://www.profixio.com/app/leagueid28096/teams/1579219
- Profixio, HK Lif Blå: https://www.profixio.com/app/leagueid28151/teams/1575788
- Profixio, HK Ystadpågarna: https://www.profixio.com/app/leagueid28096/teams/1583015
- Repo-internal: `apps/game/lib/career/clubPartnerships.ts` (`PERMANENT_B_TEAM_PAIRS`), `data/real-world/sweden/2026-27/division1-*/<club>/sources-*.json`, `design-lab/experience-2027/club-identity/research/results-2.json` … `results-6.json`, `registry.json`.
