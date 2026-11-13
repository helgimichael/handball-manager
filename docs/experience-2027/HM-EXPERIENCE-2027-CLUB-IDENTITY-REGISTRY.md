# HM Experience 2027 — Club Identity Registry

> Owner principle (2026-11-13): **every club's neon identity originates from the dominant colour of its actual first-choice home shirt.**
> Isolated design deliverable on `design/hm-experience-2027`. No game data, gameplay, Alpha, club IDs or career data were changed. Arena Nights remains the global identity. The 231 surface recommendations and 551 alternatives are untouched; `verify-amendment.cjs` re-checks this.

## 1. Deliverables

| # | Deliverable | Where |
|---|---|---|
| 1 | Complete club colour audit (all clubs in the game database) | `HM-EXPERIENCE-2027-CLUB-KIT-AUDIT.md` |
| 2 | Club Identity Registry | `design-lab/experience-2027/club-identity/registry.json` (full) · `design-lab/experience-2027/data/club-registry.js` (lab) |
| 3 | Source & confidence register | `HM-EXPERIENCE-2027-CLUB-SOURCE-REGISTER.md` |
| 4 | Clubs with missing or ambiguous shirt colours | `HM-EXPERIENCE-2027-CLUB-KIT-REVIEW-LIST.md` |
| 5 | Updated Design Lab | *Club identity* view + club selector with all clubs |
| 6 | Screenshots of different club identities | `boards-clubs/README.md` |
| 7 | Verification report | `HM-EXPERIENCE-2027-CLUB-IDENTITY-VERIFICATION.md` |

## 2. Pipeline (reproducible)

```
apps/game/lib/game-data/clubs.ts ┐   read-only
sweden2026Data.json (Division 2) ┘ → club-identity/extract-clubs.mjs → clubs-extracted.json (every club, real game ids)
research/results-*.json (evidence per club) ┐
overrides.json (owner-approved overrides)   ┼→ club-identity/build-registry.mjs → registry.json + data/club-registry.js + audit docs
club-identity/neon.js (kit → neon rule)     ┘
data/club-registry.js → proto/sample.js (crest colours) + proto/kit.js applyClub() (identity tokens) + lab.js (selector, Club identity view)
```

```bash
node design-lab/experience-2027/club-identity/extract-clubs.mjs
```

```bash
node design-lab/experience-2027/club-identity/build-registry.mjs
```

```bash
node design-lab/experience-2027/club-identity/verify-club-identity.cjs
```

```bash
node design-lab/experience-2027/club-identity/capture-club-boards.cjs
```

## 3. Registry record

| Field | Meaning |
|---|---|
| `id` | **Stable game club ID**, exactly as in the game database (e.g. `se_club_hammarby_if_hf`, `swe2-tumba`, `se_div2_team_1575294`) |
| `name`, `shortName`, `tier`, `competitionId`, `playable` | From the game database |
| `kit.primary` / `kit.secondary` / `kit.trim` | `{ name, hex, hexSource }`. `hexSource` is `documented` (exact hex from a source) or `standard-palette` (documented colour name → shared palette) |
| `kit.pattern`, `kit.description`, `kit.season` | Home-shirt pattern, factual description, season of the evidence |
| `neon` | Arena Nights accent produced by `neon.js` |
| `neonRule` | `primary`, `secondary (monochrome shirt)`, `trim (monochrome shirt)`, `monochrome (no documented accent)`, `pending`, or `manual-override` |
| `contrast` | `neonOnNight`, `inkOnNeon` |
| `status`, `confidence` | `VERIFIED`, `PROBABLE`, `UNCERTAIN`, `UNKNOWN` or `NOT_RESEARCHED`, plus a 0–1 confidence |
| `sources[]` | URL, type, quoted or paraphrased evidence |
| `crestDiffers` | Whether the crest colour differs from the shirt (where known) |
| `override` | Manual override with reason, owner and date (from `overrides.json` only) |
| `gamePlaceholder` | The game's current *unverified* crest placeholder colours, shown for comparison and never used |
| `reviewReasons[]` | Why the club needs review |

**One identity per club, everywhere:**
- The UI never hard-codes club colours.
- `applyClub(id)` reads the neon from the registry.
- Sample crest colours are read from the registry's kit colours, or a neutral placeholder when there is no kit evidence.
- The verification checks for leftover hard-coded overrides and confirms the identity is stable across reloads.

## 4. Neon generation (`club-identity/neon.js`)

1. **Source colour:**
   - The chromatic home-shirt colour.
   - For white, black or grey shirts: the documented secondary colour, then the trim.
   - No documented accent: **ice silver** `#d7e1ee` (no hue is invented).
   - Unknown or not-researched kit: **pending steel** `#9fb0c6`, flagged for review.
   - Clubless manager: **neon orange** `#ff7a1a`.
2. **Hue preserved:** conversion happens in OKLCH, a perceptual colour space; the shirt's hue angle is kept.
3. **Consistent intensity:** fixed lightness and chroma targets per hue family. Yellows stay light so they don't turn olive, reds and blues are saturated rather than pastel, and chroma is reduced only as far as needed to stay inside sRGB.
4. **Accessibility gate:** lightness is raised until the neon on the night background `#070b12` and dark ink `#061018` on the neon are both at least 4.5:1.

Examples (standard palette → neon): red `#C8102E` → `#fe4651`, green `#00843D` → `#41e77c`, blue `#0057B8` → `#4694ff`, yellow `#FFD100` → `#ffd32e`, purple `#5B2C8F` → `#b47dfe`, turquoise `#00A3AD` → `#02d7e4`.

**Known trade-off:** consistent intensity merges shades within one hue family. Navy and royal blue both become neon blue, and wine and red both become neon red. Different hues stay distinct; different shades of the same hue do not. A club can keep a darker shade through an owner override, if wanted.

## 5. Changes to the earlier amendment

- **Removed:** the hard-coded owner-example neons (Tumba `#2e9bff`, Hammarby `#1ff28a`) and the crest-based neon derivation in `kit.js`. Both clubs now derive from their researched home shirts. Section 7 compares the result with the owner examples.
- **Changed:** sample crest colours are no longer hand-picked; they come from the registry.
- **Lab:** the club selector now lists all clubs grouped by tier, with the verification status shown. Old lab values (`tum`, `ham`) migrate automatically.

## 6. Results

All **202 clubs** in the game database were audited. Research covered:
- Six parallel batches of text evidence.
- A second, official-evidence-only pass over the 28 Handbollsligan and Allsvenskan clubs.
- **Visual checks of official club imagery** in a browser for key clubs: match photos on club websites, and an official shop "Hemma" product.

| Tier | Clubs | Verified | Probable | Uncertain | Unknown |
|---|---|---|---|---|---|
| SE-1 Handbollsligan | 14 | 4 | 10 | 0 | 0 |
| SE-2 Allsvenskan | 14 | 2 | 9 | 3 | 0 |
| SE-3 Division 1 | 24 | 0 | 13 | 7 | 4 |
| SE-4 Division 2 | 53 | 0 | 4 | 23 | 26 |
| International / world pool | 97 | 3 | 62 | 24 | 8 |
| **Total** | **202** | **9** | **98** | **57** | **38** |

Neon rule applied:

| Rule | Clubs |
|---|---|
| Shirt colour (primary) | 119 |
| White/black shirt → secondary colour | 19 |
| White/black shirt → trim colour | 2 |
| Ice silver (monochrome, no documented accent) | 18 |
| Pending steel (kit unknown) | 44 |

All 202 neons pass the contrast gate, and every one is reproducible from its kit data.

**Visual checks (official imagery, 2026-11-13):**

| Club | Home shirt | Neon | Status |
|---|---|---|---|
| IFK Kristianstad | Orange ("brandgul") with white pinstripes. The crest is blue/white, so crest ≠ shirt | `#e07102` | VERIFIED |
| IK Sävehof | Yellow with black shoulders (resolves the black-vs-yellow conflict) | `#ffd32e` | VERIFIED |
| Hammarby IF HF | Green with thin white stripes, green shorts | `#41e77c` | VERIFIED |
| HK Malmö | Black with red shoulders, side panels and numbers (red confirmed as a home-shirt detail) | `#fe4651` | VERIFIED |
| Eskilstuna Guif | Red with dark-red trim, from the official shop's "2026/2027 Match - Hemma" product | `#fe4651` | VERIFIED |
| IFK Tumba HK | Club photos show **blue, not navy**, with white details (club teams; the men's team is not pictured) | `#4694ff` | PROBABLE, confidence 0.8 |

Other verified clubs:
- **HK Drott:** official text, "den vita tröjan" (the white shirt).
- **THW Kiel:** PUMA 25/26 product page.
- **SG Flensburg-Handewitt:** hummel 25/26 listing.
- **FC Barcelona:** official club site.

The full table is in `HM-EXPERIENCE-2027-CLUB-KIT-AUDIT.md`. Every source is in `HM-EXPERIENCE-2027-CLUB-SOURCE-REGISTER.md`. The 123 clubs needing review are in `HM-EXPERIENCE-2027-CLUB-KIT-REVIEW-LIST.md`.

## 7. Comparison with the owner's examples

| Owner example | Before (hard-coded) | Now (from the home shirt) | Agreement |
|---|---|---|---|
| IFK Tumba → neon blue | `#2e9bff` | `#4694ff` (blue shirt) | ✓ same hue family, slightly different shade |
| Hammarby → neon green | `#1ff28a` | `#41e77c` (green shirt, verified) | ✓ same hue family |
| Clubless → neon orange | `#ff7a1a` | `#ff7a1a` | ✓ unchanged (owner rule) |

## 8. Findings for the owner

1. **The game's current club colours are mostly wrong as shirt colours.** For 82 of the 103 clubs with probable or verified shirt evidence, the game's `primaryColor` placeholder is in a different colour family. Examples:
   - Alingsås: red in the game, blue shirt.
   - Sävehof: black → yellow.
   - Kristianstad: blue → orange.
   - Lugi: black → wine.
   - OV Helsingborg: red → green.
   - Skånela: green → red.

   The source says these are placeholders, and this audit is the evidence to replace them. **The game data was not changed.**
2. **Thirteen white/black-shirt clubs take their accent from a club or away colour,** not a confirmed home-shirt detail. Examples are HF Karlskrona (yellow), HK Drott (red) and VästeråsIrsta HF (red). The colour is documented, not invented, but you should decide whether these count as the club's identity.
3. **Game database identity mismatches** were found during research. They are recorded here only, and nothing was changed:
   - `esp1-anaitasuna` is named Bidasoa, `esp1-logrono` Ademar, `esp1-alicante` Anaitasuna and `hun1-gyor` Tatabánya: the IDs don't match the clubs.
   - The entry named "SC DHfK Dessau" doesn't exist as a club; the research used Dessau-Roßlauer HV.
   - The entry named TV Bittenfeld has an ID that says "wilhelmshaven".
   - The "FIF" entry looks like Frederiksberg IF.
   - Århus Håndbold (`den2-aarhus`) was dissolved in 2021.
   - Cisne is in Pontevedra, not Ourense.
   - HK Cliff is an independent club, not a B-team, despite the comment in `clubs.ts`.
4. **B/U teams** (HK S-hof, HP Alingsås, IF Kristianstad, HK Önnerediterna, LUGI U, HF Karlskrona U, Ystads IF U and others) have no evidence that they wear the parent kit. They stay uncertain or unknown rather than inheriting the parent's colour.

## 9. Limitations

- **Evidence ceiling:**
  - Most evidence is text: Wikipedia kit templates, club pages, tournament registrations.
  - Shared web-search limits cut some batches short.
  - Only 9 clubs reach VERIFIED.
  - Division 2 is thin: 26 of 53 clubs are unknown and get the pending steel neon.
- **Colour precision:** apart from documented hexes, values come from colour names mapped to one standard palette. They represent the colour family correctly, not the exact fabric shade. This doesn't affect the neon much, because only the hue survives the conversion.
- **Seasons:** much of the evidence is undated or older. A kit change (as with Eslövs HK's new black kit for 2025/26) would need a re-check each season.
- **Prototype content:** when you pick a club outside the 14-club sample league, it replaces IFK Tumba in the sample career. The squad and players stay sample data. Picking a club inside the sample league swaps it with Tumba.
- **Clubs not shown on screens:** 44 clubs show pending steel and 18 show ice silver until their kit is resolved. These are deliberate placeholders, not identities.
