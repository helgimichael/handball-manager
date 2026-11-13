# HM Experience 2027 — Club Identity Verification, Phase 2: Final Report

> Branch `design/hm-experience-2027`, building on the Club Identity commit `9a114a7`. Isolated design and research work: no game data, gameplay, match engine, Alpha, saves or career data changed (verified: `apps/` and `packages/` unchanged). No push, merge or deploy.
> Goal (owner): pick any club and know that its visual identity represents the club's real home shirt. *Arena Nights is the game's world; the club gives the world its colour.*

## 1. Verification statistics

### All 202 clubs

| Status | Phase 1 (`9a114a7`) | **Phase 2** |
|---|---:|---:|
| VERIFIED | 9 | **118** |
| PROBABLE | 98 | **50** |
| UNCERTAIN | 57 | **25** |
| UNKNOWN | 38 | **9** |

### Swedish clubs (105)

| Tier | Clubs | Verified | Probable | Uncertain | Unknown |
|---|---:|---:|---:|---:|---:|
| SE-1 Handbollsligan | 14 | **14** | 0 | 0 | 0 |
| SE-2 Allsvenskan | 14 | **11** | 2 | 1 | 0 |
| SE-3 Division 1 | 24 | **15** | 7 | 2 | 0 |
| SE-4 Division 2 | 53 | **19** | 25 | 2 | 7 |
| **Sweden total** | **105** | **59** | **34** | **5** | **7** |

International / world pool (97): 59 verified, 16 probable, 20 uncertain, 2 unknown.

Evidence base:
- All 105 Swedish clubs got a Phase 2 review, and 101 of them are backed by an image seen in a browser.
- 95 Swedish clubs have their original HEX **measured from the evidence photo**.
- 295 evidence screenshots are archived under `design-lab/experience-2027/club-identity/research/phase2/evidence/`.
- 82 Swedish clubs moved up at least one status level.

## 2. Method

1. **Images, not text.** Nine research agents viewed official imagery in the built-in browser:
   - club websites and match reports;
   - Handbollsligan and federation pages;
   - public club social pages (no logins);
   - press photos.

   Each saved a screenshot of its evidence.
2. **Owner standard:**
   - **VERIFIED:** an official match photo or official source where the **men's A-team** home shirt is identifiable. A shop product image alone is never enough.
   - **PROBABLE:** clear visual evidence short of that (older photos, unconfirmed season, press).
   - **UNCERTAIN:** conflicting evidence, several possible kits, or unclear team or kit.
   - **UNKNOWN:** no reliable evidence.
3. **Measured colour.** `club-identity/sample_colour.py` takes the median of a plain-fabric box in the screenshot. A measurement is accepted only if it matches the documented colour name (same hue family or achromatic class); otherwise the palette value is kept and the club is flagged.
4. **Consistent neon.** Photos carry white-balance and colour-grading shifts, so the neon is built from the documented colour's hue, nudged toward the measured hue by at most ±10° (`neon.js` `nudgedReference`). The measured HEX is kept as the "original colour". The same OKLCH conversion and AA contrast gate (≥ 4.5:1 both ways) apply to every club.
5. **Merge rules** (`build-registry.mjs`):
   - Phase 2 supersedes earlier evidence.
   - An older record is kept only if it was itself image-backed and stronger. This never happened in practice.
   - QA cap: if the best image shows a youth or women's team, the status is capped at UNCERTAIN. This applied once, to HK Önnerediterna.
6. **Crests keep their own colours.** Documented crest colours, otherwise the game's existing crest colours; never the neon or the shirt. **B and U teams** never inherit the parent's colours; they were judged only from images of the team itself.

## 3. Notable corrections (named home-shirt colour changed)

| Club | Before | Now | Evidence |
|---|---|---|---|
| HK Aranäs | white | **navy** | 2026/27 squad photo, home matches |
| Tyresö Handboll | black | **red with yellow** | 2026/27 official squad photo |
| VästeråsIrsta HF | white | **black with white** | 2026/27 squad photo (earlier "vitsvart" quote was the women's team) |
| IFK Skövde HK | blue | **navy** | home match vs Alingsås, 11 Nov |
| OV Helsingborg | green/white details | **dark green with red** | 2026/27 official images |
| HF Karlskrona | black (accent unconfirmed) | **black with gold pinstripes** | 2026/27 kit launch |
| SG Flensburg-Handewitt | red (shop listing) | **navy** | three home match photos Sep–Nov 2026 |
| Borlänge HK | red vs white conflict | **white with red sleeves** | men's home match 8 Nov 2026 |
| Norrköpings HK | white | **green** | club imagery |
| IFK Nyköping | blue | **white with blue shorts** | club imagery |
| Ludvika HF | green | **black with green trim** | club imagery |
| Mantorps IF HF | green | **white with green** | club imagery |
| Skogås HK | green | white seen only away; downgraded | away photo only |
| Rimbo HK Roslagen | green | **teal with black sleeves** (pink = one-off charity kit) | match photos |
| Sandnes / Runar / Skanderborg / Trimo / Aarhus / Cassano | various | updated or flagged | see source register |

Previously **unknown, now coloured**: 36 clubs. Examples:
- RP IF Linköping, white with red;
- Enköpings HF, red ("Vi bär rött med stolthet");
- Vinslövs HK, yellow with red;
- Åhus Handboll, royal blue;
- Lidingö SK, red with blue;
- Härnösands HF, green;
- Sundsvall HK, royal blue (green crest);
- Elitesport Vendsyssel, green.

Conflicts **resolved**:
- IK Sävehof: yellow.
- AIK: black with yellow.
- HP Warta: white likely, still probable.

## 4. Remaining uncertainty

The review list (`HM-EXPERIENCE-2027-CLUB-KIT-REVIEW-LIST.md`, 107 clubs with at least one note) includes some verified clubs with caveats, such as promo or studio photos, colour-graded images, or a kit launch image. Clubs that most need more images:
- **Swedish unknown (7):**
  - Sikeå SK, Fjärås HK, HB 78 Jönköping: no image found.
  - Malmö HP (HK Malmö's B-team) and Lunds HS Lejon (H43 Lund's development team): no image of the team itself.
  - VästeråsIrsta HK and HK Varberg 09 (development teams): no image of the team itself.
- **Swedish uncertain (5):**
  - HK Torslanda Elit: no current club site; only an away sighting in white/blue.
  - IK Bolton: yellow and black both seen.
  - Torslanda HK B-team.
  - HK Önnerediterna: youth image only (QA cap).
  - Skogås HK: away photo only.
- **Monochrome shirts** without a documented accent get the ice-silver neon: 13 clubs, including VästeråsIrsta HF and Eslövs HK (black with a grey print). They need an owner decision if a coloured accent is wanted.
- **International:** 9 clubs were not visually checked for time reasons (Cisne, Córdoba, Teucro, Cegléd, Eger, Škofja Loka, Þróttur, Vestli, Komló). They are capped at UNCERTAIN or UNKNOWN.

## 5. Club database identity findings

See **`HM-EXPERIENCE-2027-CLUB-DATABASE-IDENTITY-FINDINGS.md`**: 33 findings in the owner's five categories, each with a proposed correction (keep all IDs, change display data only) and its consequences.

| Category | Count |
|---|---:|
| Felaktig klubbidentitet (wrong club identity) | 5 |
| Felaktigt klubbnamn (wrong club name) | 6 |
| Inaktuell klubb (outdated club) | 10 |
| Felaktig relation mellan klubbar (wrong relation between clubs) | 8 |
| Osäker matchtröja (uncertain match shirt) | 4 |

Highlights:
- The three Spanish IDs carry names shifted by one row, and `hun1-gyor` holds Tatabánya.
- "SC DHfK Dessau" doesn't exist; the real club is Dessau-Roßlauer HV 06.
- **TV Bittenfeld is TVB Stuttgart, so it is a duplicate.**
- Århus Håndbold is **not** defunct: a new club founded in 2024 has a men's team in the Danish 1st Division. This corrects Phase 1.
- HK Cliff is independent, but its Division 1 players are registered with Hammarby, so the relation holds.
- Ten Division 2 teams are second teams of higher clubs, with no relation modelled.
- The German and Danish league lists reflect 2025/26 (for example Leipzig and Minden relegated, Balingen promoted; HØJ is based in Ølstykke, not Hjørring).

Ten product decisions are listed in that document. **The production database was not changed.**

## 6. Deliverables

1. Updated Club Identity Registry: `club-identity/registry.json` and `data/club-registry.js` (stable game club IDs; measured colours, crest colours, evidence screenshots, team and date per club).
2. Complete Swedish Club Kit Audit: `HM-EXPERIENCE-2027-CLUB-KIT-AUDIT-SWEDEN.md` (all 105 clubs).
3. Updated full audit and Source Register, with screenshot links: `HM-EXPERIENCE-2027-CLUB-KIT-AUDIT.md`, `HM-EXPERIENCE-2027-CLUB-SOURCE-REGISTER.md`.
4. Review List: `HM-EXPERIENCE-2027-CLUB-KIT-REVIEW-LIST.md`.
5. Club Database Identity Findings: `HM-EXPERIENCE-2027-CLUB-DATABASE-IDENTITY-FINDINGS.md`.
6. Updated Design Lab, Club identity view:
   - search across all 202 clubs;
   - filters for Sweden, each tier and each status;
   - a per-tier status table;
   - the shirt with its measured colour next to the neon;
   - the crest in its own colours;
   - status, source and the evidence screenshot;
   - a side-by-side comparison of up to four clubs;
   - the selected club across dashboard, navigation, player, squad, scouting, matchday and analysis;
   - club change and the clubless state.
7. Visual comparison: `boards-clubs/README.md`, 70 images covering verified Swedish clubs from **every division** plus international, ice-silver and pending examples.
8. This report.

## 7. Verification

- `club-identity/verify-club-identity.cjs`: **0 issues**. It checks:
  - registry completeness (202/202 against a fresh read-only extraction) and stable IDs;
  - game data unchanged;
  - the neon is reproducible and passes contrast for 202/202 clubs;
  - no colour without a source, and unknown kits are never given a colour;
  - 105/105 Swedish clubs have a Phase 2 review, and 295/295 evidence screenshots exist;
  - no Swedish VERIFIED without image evidence, and no VERIFIED on a shop image alone;
  - crests are never painted with the neon;
  - 588 renders of club accent, shell name and layout (49 clubs including clubless × 6 screens × desktop/mobile);
  - the lab Club identity view lists every club.
- `verify-amendment.cjs`: **0 issues.** All 231 surface recommendations and 551 alternatives are unchanged.

## 8. Limitations

- **Measured colours** come from photos under arena lighting, JPEG compression and sometimes colour grading. They are recorded as the photo's colour, not the fabric's exact dye. The neon is protected by the ±10° rule.
- **Social media** behind a login wasn't used, so some small clubs remain unknown.
- **Season:** a few "verified" clubs rest on a 2026/27 kit launch or squad photo rather than a live match photo; the review list says so.
- **Browser capacity:** a shared tab limit blocked the international A batch twice before it ran. Two text-only fallback files were set aside (`blocked-results-intla-textonly*.json`) and are not used in the registry.
