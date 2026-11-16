# HM Experience 2027 — Clubs with Missing or Ambiguous Shirt Colours

> 99 of 204 clubs need further evidence or review (generated). Owner decisions 2026-11-14 are applied:
- Unknown kits use the **default orange fallback** `#ff7a1a`. This is temporary, labelled as a fallback, and the status stays UNKNOWN.
- Black/white shirts use **Ice Silver** `#d7e1ee` (decided, not a review item).
- Uncertain kits derive from the best evidence and are flagged.

No colour has been invented to fill a gap. To resolve: add evidence to `club-identity/research/results-*.json` or an entry with reason/owner/date to `club-identity/overrides.json`, then rebuild.

| ID | Club | Tier | Status | Current neon | Reason |
|---|---|---|---|---|---|
| `se_club_alingsas_hk` | Alingsås HK | SE-1 Handbollsligan | VERIFIED | `#5592fd` | Home colour from an official, colour-graded promo banner rather than a live match photo; hex approximate. |
| `se_club_hf_karlskrona` | HF Karlskrona | SE-1 Handbollsligan | VERIFIED | `#d7e1ee` | No in-match home photo; based on official kit launch image and tinted team photo. |
| `se_club_ov_helsingborg` | OV Helsingborg | SE-1 Handbollsligan | VERIFIED | `#13e888` | Studio promo photos only; no in-match home photo. |
| `se_club_skanela_if` | Skånela IF | SE-1 Handbollsligan | VERIFIED | `#fe4749` | Official squad photo, no dated home match photo. |
| `se_club_onnereds_hk` | Önnereds HK | SE-1 Handbollsligan | VERIFIED | `#1ae890` | Home colour from official promo cutouts, not a live match photo; shorts unconfirmed. |
| `swe2-h43lund` | H43 Lund HF | SE-2 Allsvenskan | PROBABLE | `#5a90fe` | No men's A-team match or squad photo; colour from the club's blue-graded composite artwork only. |
| `swe2-torslanda` | HK Torslanda Elit | SE-2 Allsvenskan | UNCERTAIN | `#ff7a1a` | Home shirt never observed; only an away white/blue kit and the red/blue crest are documented. |
| `swe2-varberg` | HK Varberg | SE-2 Allsvenskan | PROBABLE | `#1ce5ae` | Only a January 2024 thumbnail of a men's player; no current-season men's image. |
| `se_club_hk_cliff` | HK Cliff | SE-3 Division 1 | PROBABLE | `#ffd258` | Evidence is an opponent's photo from 2025/26. No 2026/27 Cliff A-team home photo was found on Cliff channels. |
| `se_club_ik_bolton` | IK Bolton | SE-3 Division 1 | UNCERTAIN | `#ffd258` | Yellow vs black first-choice home shirt unresolved; need a Bolton home-match photo from 2026/27. |
| `se_club_taby_hbk` | Täby HBK | SE-3 Division 1 | VERIFIED | `#fe4747` | secondary: measured #2A2836 inconsistent with documented "navy" → palette value kept |
| `se_club_uppsala_hk` | Uppsala HK | SE-3 Division 1 | PROBABLE | `#5991fe` | Only a preseason tournament photo from Aug 2025. No home league-match image for 2026/27; measured hex is underexposed. |
| `se_club_orebro_sk_hk_herr` | Örebro SK HK herr | SE-3 Division 1 | PROBABLE | `#d7e1ee` | The home match photo's date and opponent are unconfirmed. The shirt is monochrome, so a neon accent decision is needed. |
| `se_club_hk_s_hof` | HK S-hof | SE-3 Division 1 | PROBABLE | `#eddb38` | No home-match image; yellow vs black first choice inferred from away games and a club graphic. |
| `se_club_hk_onnerediterna` | HK Önnerediterna | SE-3 Division 1 | UNCERTAIN | `#1ae890` | Only a P18/U-squad team photo on the Önnerediterna page; no Herr 1 match image. Shade green vs teal to confirm.; QA: best evidence shows the youth team, not the men's A-team → capped at UNCERTAIN (was PROBABLE) |
| `se_club_hp_alingsas` | HP Alingsås | SE-3 Division 1 | PROBABLE | `#738afd` | Press photos only, one older (2023/24); no official current-season image. |
| `se_club_hp_warta` | HP Warta | SE-3 Division 1 | PROBABLE | `#d7e1ee` | No home-match photo; white-home inferred from a club home-match poster while team photo and all match photos show black. |
| `se_club_if_kristianstad` | IF Kristianstad | SE-3 Division 1 | PROBABLE | `#f06002` | Press photos only (no official IF team image), though one is a confirmed home match. |
| `den1-grindsted` | Grindsted GIF | International / world pool | UNCERTAIN | `#4694ff` | No image of the men's A-team home shirt could be seen; text evidence only. |
| `den1-skanderborg` | Skanderborg AGF Håndbold | International / world pool | PROBABLE | `#d7e1ee` | Unclear whether white or navy should count as primary; home/away not confirmed by a match photo. |
| `den1-sonderjyske` | SønderjyskE Håndbold | International / world pool | UNCERTAIN | `#029feb` | No image of the men's A-team home shirt could be seen; text evidence only. |
| `den1-tms` | TMS Ringsted | International / world pool | VERIFIED | `#18d9cf` | secondary: measured #1E1D23 inconsistent with documented "navy" → palette value kept |
| `den1-kif-kolding` | KIF Kolding | International / world pool | NOT_RESEARCHED | `#ff7a1a` | status NOT_RESEARCHED |
| `ger1-hamburg` | Handball Club Hamburg | International / world pool | PROBABLE | `#ff4161` | 2026/27 kit not seen; small image. |
| `ger1-bietigheim` | SG BBM Bietigheim | International / world pool | NOT_RESEARCHED | `#ff7a1a` | status NOT_RESEARCHED |
| `nor1-oif` | ØIF Arendal | International / world pool | PROBABLE | `#d7e1ee` | Only an away-game, out-of-focus photo; home kit not confirmed with an ØIF home image. |
| `nor1-bodo` | Bodø HK | International / world pool | PROBABLE | `#668dfe` | Newest image is from 2024/25; no 2026/27 kit image found. |
| `nor1-halden` | Halden Topphåndball | International / world pool | PROBABLE | `#d7e1ee` | Team photo only; home match kit not confirmed. |
| `nor1-runar` | Runar Håndball | International / world pool | PROBABLE | `#d7e1ee` | Team photo shows black kit; confirm whether black is the official home kit. |
| `nor2-nordstrand` | Nordstrand IF | International / world pool | PROBABLE | `#d7e1ee` | Team photo only; no match photo. |
| `nor2-sandnes` | Sandnes HK | International / world pool | UNCERTAIN | `#3c96fe` | Conflict: blue match shirt (homepage) vs black team photo 26/27; home kit undetermined. |
| `nor2-vestli` | Vestli IL | International / world pool | UNCERTAIN | `#41e77c` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `ger2-dessau` | Dessau-Roßlauer HV 06 | International / world pool | VERIFIED | `#4894ff` | Name/identity mismatch (SC DHfK Leipzig vs Dessau-Roßlauer HV 06) needs owner decision. |
| `ger2-wilhelmshaven` | TV Bittenfeld | International / world pool | RETIRED | `#ff7a1a` | retired tombstone: F05: duplicate identity of ger1-stuttgart (TV Bittenfeld is TVB Stuttgart's origin association); id text names Wilhelmshavener HV (3. Liga). Kept for saves and history only. Replacement club awaits owner decision D3. |
| `den2-aarhus` | Aarhus Håndbold Herrer | International / world pool | PROBABLE | `#ff3780` | Headshot only; home/away status of the maroon shirt not confirmed by a match photo. |
| `den2-fif` | FIF Håndbold | International / world pool | UNCERTAIN | `#d7e1ee` | No men's image; city mismatch (Fredensborg vs Frederiksberg). |
| `den2-norddjurs` | Norddjurs Håndbold | International / world pool | PROBABLE | `#fe4845` | Player cards only; no match photo. |
| `esp1-anaitasuna` | Bidasoa Irun | International / world pool | VERIFIED | `#ffd337` | ID/name mismatch (anaitasuna vs Bidasoa Irun) needs owner decision. |
| `esp1-logrono` | Ademar León | International / world pool | VERIFIED | `#d7e1ee` | ID/name mismatch (logrono vs Ademar León) needs owner decision. |
| `esp1-alicante` | SCDR Anaitasuna | International / world pool | UNCERTAIN | `#41e77c` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `esp2-cisne` | Cisne Balonmano | International / world pool | UNCERTAIN | `#d7e1ee` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `esp2-cordoba` | BM Córdoba | International / world pool | UNKNOWN | `#ff7a1a` | No reliable evidence; needs manual source. |
| `esp2-huesca` | BM Huesca | International / world pool | PROBABLE | `#fe493b` | Team photo only, season not stated. |
| `esp2-teucro` | Teucro Pontevedra | International / world pool | UNCERTAIN | `#4694ff` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `hun1-gyor` | Tatabánya KC | International / world pool | VERIFIED | `#5193fd` | ID/name mismatch (gyor vs Tatabánya) needs owner decision. |
| `hun2-cegled` | Ceglédi KKSE | International / world pool | UNCERTAIN | `#ffd32e` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `hun2-eger` | Eger-Eszterházy SzSE | International / world pool | UNCERTAIN | `#ffd32e` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `hun2-komlo` | Komlói Bányász | International / world pool | UNCERTAIN | `#4694ff` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `svn1-celje` | RK Celje | International / world pool | UNCERTAIN | `#eedb38` | Conflicting home kits (yellow-green vs off-white/gold; plus blue in EHF photo). |
| `svn1-trimo` | RK Trimo Trebnje | International / world pool | UNCERTAIN | `#5791fd` | Home kit not seen; only an away-match photo. |
| `svn1-gorenje` | RK Gorenje Velenje | International / world pool | PROBABLE | `#ffd32e` | Press photos only; no 2026/27 home image. |
| `svn2-skofjaloka` | RD Škofja Loka | International / world pool | UNCERTAIN | `#41e77c` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `svn2-jeruzalem` | RK Jeruzalem Ormož | International / world pool | UNCERTAIN | `#4694ff` | Only an away-kit photo seen; home kit unconfirmed. |
| `isl1-akureyri` | KA Akureyri | International / world pool | PROBABLE | `#f3d934` | Small composite graphic; no full match photo. |
| `isl2-fram` | Fram | International / world pool | UNCERTAIN | `#4694ff` | Conflicting/insufficient imagery (black promo shirt vs prior blue). |
| `isl2-throttur` | Þróttur Reykjavík | International / world pool | UNCERTAIN | `#fe4651` | Text evidence only (no image seen); status capped at UNCERTAIN. |
| `int-fivers` | Fivers Margareten | International / world pool | VERIFIED | `#fe4653` | secondary: measured #9BA4B7 inconsistent with documented "light-blue" → palette value kept |
| `int-h71` | H71 | International / world pool | PROBABLE | `#d7e1ee` | Only one clear match photo and it is away; home use inferred from a promo graphic. Measured hex is near-black. |
| `int-veszprem-academy` | Veszprém Handball Academy | International / world pool | UNCERTAIN | `#fe4651` | No image of the men's A-team home shirt could be seen; text evidence only. |
| `int-cassano` | Proger Cassano Magnago | International / world pool | PROBABLE | `#d7e1ee` | Press photo only, from a final away from home; 2026/27 home shirt not seen. White vs amaranth body still to confirm. |
| `int-camerano` | Camerano | International / world pool | UNCERTAIN | `#d7e1ee` | No image of the men's A-team home shirt could be seen; text evidence only. |
| `int-paese` | Paese | International / world pool | UNKNOWN | `#ff7a1a` | No kit evidence found. |
| `int-fasano` | Serra Fasano | International / world pool | UNCERTAIN | `#d7e1ee` | No image of the men's A-team home shirt could be seen; text evidence only. |
| `int-sporting` | Sporting CP | International / world pool | PROBABLE | `#0fe889` | Press photo, not an official club source; 2026/27 not seen. |
| `se_div2_team_1582047` | Kiruna HK | SE-4 Division 2 | PROBABLE | `#fe4a35` | Men's photo is about 8 seasons old; current shirt not confirmed. |
| `se_div2_team_1583325` | Norrfjärdens IF | SE-4 Division 2 | PROBABLE | `#d7e1ee` | Press photo only (back view); black shirt vs yellow/black crest, so the owner should decide the neon accent. |
| `se_div2_team_1583328` | Sikeå SK | SE-4 Division 2 | UNKNOWN | `#ff7a1a` | No image of the men's shirt found. |
| `se_div2_team_1577066` | Djurgårdens HF | SE-4 Division 2 | PROBABLE | `#01a1e1` | Only ~2018 photos with small figures; current kit and exact shades not confirmed. |
| `se_div2_team_1570960` | HK Tyrold | SE-4 Division 2 | PROBABLE | `#fe493d` | B/development team; the photo is the squad in a pre-season match, not a confirmed HK Tyrold league game. |
| `se_div2_team_1576098` | SK Kvarnberga | SE-4 Division 2 | PROBABLE | `#6d8bfe` | B-team; evidence is an edited match graphic, not a plain match photo; blue shade uncertain (navy vs royal). |
| `se_div2_team_1587398` | Skogås HK | SE-4 Division 2 | UNCERTAIN | `#d7e1ee` | Only an away photo (white); home shirt colour (green or white) unconfirmed. |
| `se_div2_team_1582988` | Tumba HK | SE-4 Division 2 | VERIFIED | `#4594ff` | B/U team of IFK Tumba; photo is from 2025/26. |
| `se_div2_team_1583225` | Eksjö BK | SE-4 Division 2 | PROBABLE | `#55e672` | Undated team photo; home status not confirmed by a match photo. |
| `se_div2_team_1585081` | HK Erping | SE-4 Division 2 | PROBABLE | `#d7e1ee` | Team photo undated; home status not confirmed. Second team of RP IF Linköping. |
| `se_div2_team_1575788` | HK Lif Blå | SE-4 Division 2 | PROBABLE | `#ff9c4d` | Team photo undated; shared Blå/junior page; no match photo. |
| `se_div2_team_1579109` | IFK Nyköping | SE-4 Division 2 | PROBABLE | `#d7e1ee` | Shirt is white, not the prior's blue; undated team photo and no match photo to confirm the home kit. |
| `se_div2_team_1575015` | Ludvika HF Herr | SE-4 Division 2 | PROBABLE | `#d7e1ee` | Photos are from 2024/25; no current-season match photo; black primary differs from the green crest. |
| `se_div2_team_1584203` | Norrköpings HK | SE-4 Division 2 | PROBABLE | `#1ae890` | Team photo undated; the poster is a stylised graphic, not a plain match photo. |
| `se_div2_team_1578886` | VästeråsIrsta HK | SE-4 Division 2 | UNKNOWN | `#ff7a1a` | No image of the development team found. |
| `se_div2_team_1580934` | Fjärås HK | SE-4 Division 2 | UNKNOWN | `#ff7a1a` | No visual evidence found. |
| `se_div2_team_1570589` | HB 78 Jönköping | SE-4 Division 2 | UNKNOWN | `#ff7a1a` | No visual evidence found. |
| `se_div2_team_1581244` | HK Skövde | SE-4 Division 2 | PROBABLE | `#5c90fe` | Old photo, not explicitly captioned as the development team; home status unconfirmed. |
| `se_div2_team_1575715` | HK Varberg 09 | SE-4 Division 2 | UNKNOWN | `#ff7a1a` | No image of the development team found. |
| `se_div2_team_1578882` | IF Hellton Karlstad | SE-4 Division 2 | PROBABLE | `#fe4651` | Single 2025/26 graphic; no current-season plain match photo; measured red is darker than the real shirt. |
| `se_div2_team_1574211` | IK Baltichov | SE-4 Division 2 | PROBABLE | `#d7e1ee` | No match photo; home kit not confirmed. |
| `se_div2_team_1586623` | Skara HK | SE-4 Division 2 | PROBABLE | `#ffd258` | Two kits (yellow and red) in use; home attribution inferred from a small opponent photo. |
| `se_div2_team_1579656` | Stenungsunds HK | SE-4 Division 2 | PROBABLE | `#fe4841` | Press photos (~3 yrs) only; home/away not explicitly confirmed for the red photo. |
| `se_div2_team_1578270` | Torslanda HK | SE-4 Division 2 | UNCERTAIN | `#668dfe` | Div 2 entry is the men's B-team; only A-team/club imagery (blue) found, so not inherited per the brief. |
| `se_div2_team_1585949` | Vårgårda IK HK | SE-4 Division 2 | PROBABLE | `#ff4830` | Press photo from 2025; home kit not explicitly confirmed. |
| `se_div2_team_1578815` | Örgryte IS Handboll | SE-4 Division 2 | PROBABLE | `#ff4257` | Pattern detail and exact home status not confirmed; dim lighting. |
| `se_div2_team_1578982` | Helsingborgs HK | SE-4 Division 2 | PROBABLE | `#1ae890` | Team identity inferred via logo; small team photo; photo date not stated. |
| `se_div2_team_1582183` | HF Karlskrona U | SE-4 Division 2 | PROBABLE | `#d7e1ee` | Photo undated; home/away not stated. |
| `se_div2_team_1583015` | HK Ystadpågarna | SE-4 Division 2 | PROBABLE | `#fe4841` | Squad photo shared by U and junior groups; photo undated. |
| `se_div2_team_1581343` | IK Sund | SE-4 Division 2 | PROBABLE | `#5492fd` | No dated current match photo; home status not confirmed.; primary: measured #172332 inconsistent with documented "navy" → palette value kept |
| `se_div2_team_1583912` | Kävlinge HK | SE-4 Division 2 | PROBABLE | `#ff9c4d` | Press photo; the club page has no colour match photos. |
| `se_div2_team_1585295` | LUGI HF U | SE-4 Division 2 | PROBABLE | `#fe4169` | Tiny portrait images; home not stated. |
| `se_div2_team_1576008` | Lunds HS Lejon | SE-4 Division 2 | UNKNOWN | `#ff7a1a` | No image of the Lejon team; parent blue not inherited. |
| `se_div2_team_1571471` | Lödde Vikings HK | SE-4 Division 2 | PROBABLE | `#fe493b` | Press photos only; venue of the red photo unknown. |
| `se_div2_team_1579219` | Malmö HP | SE-4 Division 2 | UNKNOWN | `#ff7a1a` | No image of the team. |
