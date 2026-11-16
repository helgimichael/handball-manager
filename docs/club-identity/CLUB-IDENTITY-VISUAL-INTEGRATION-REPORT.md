# Club Identity — Visual Integration (C5)

**Status: PARTIAL.** The identity data, rules and active-club plumbing are integrated in production; the Arena Nights redesign of the 19 surfaces is not part of production yet (see §4).

## 1. One source of club colour truth

```
design-lab/experience-2027/club-identity/registry.json   (research, evidence, neon generator, locked rules)
        │  apps/game/scripts/generate-club-visual-identity.mjs   (copies; chooses nothing; --check for staleness)
        ▼
apps/game/lib/game-data/clubVisualIdentity.data.ts       (generated, 204 records)
        ▼
clubVisualIdentity(id) / clubMarkColours(id)              (lib/game-data/clubVisualIdentity.ts)
        ├─ Club.primaryColor / secondaryColor  (assembled in clubs.ts: crest colours → kit → neutral placeholder)
        └─ activeClubVisualIdentity(career)    (lib/career/activeClubIdentity.ts → GameShell CSS variables)
```

- **Removed:** all 151 hard-coded colour literals in `clubs.ts` and the 28 duplicate colour pairs in the bespoke crest specs (`components/crests/clubIdentity.ts`; shapes, motifs and banners kept). A test forbids reintroducing them.
- **Registry ⇄ records:** the registry build now copies `canonicalId`, `clubStatus`, `teamType`, `relation`, `parentClubId`, `relationLabel` and `addedInWorld` from the game's records (`apps/game/scripts/export-club-identity-records.ts` → `clubs-identity.json`); nothing is edited by hand. Registry key = storage id, 204/204 joined.
- **Registry changes from the rebuild (all expected):** 6 renamed clubs keep their kits (renames never invalidate a kit); `ger1-bietigheim`, `den1-kif-kolding` enter as `NOT_RESEARCHED` → orange fallback; `ger2-wilhelmshaven` becomes `RETIRED` with no kit (the TV Bittenfeld e.V. research is kept as a note only). No other entry changed colour or status.

## 2. Rules (locked L2–L5, L8) and how production applies them

| Rule | Production behaviour | Evidence |
|---|---|---|
| Neon from the verified first-choice home shirt | `--club-neon` on the career shell = registry neon | `clubVisualIdentity.test.ts`; browser: HK Cliff `#ffd258` |
| Black/white shirts → Ice Silver `#d7e1ee` | `kind: "ice"` | test |
| UNKNOWN / NOT_RESEARCHED / RETIRED → orange, marked, never "verified" | `kind: "fallback"`, `verifiedColour: false`, visible marker "Klubbfärg ej verifierad" (`ClubIdentityTags`) | test; browser: HK Torslanda Elit card |
| Clubless manager → orange | `managedClubId` undefined → `kind: "clubless"`; shell shows "Utan klubb · Tidigare <club>" | test; browser after resignation |
| Crests keep their own colours | Club mark = documented crest colours, else kit, else neutral grey; never the neon | test; verifier sample crests |
| B/U teams never inherit parent colours | Affiliates use only their own evidence or the fallback; relation shown as **text** (e.g. "Hammarby U · HK Cliffs licens") | registry verifier; test; browser |
| Identity follows the active club | `activeClubVisualIdentity(career)` on `.hm-shell` (`data-club-identity`, `--club-neon`, `--club-identity-*`) | soak (club change), browser |

## 3. Surfaces

| Surface | What is integrated | Verified |
|---|---|---|
| First game screen | Featured crests in registry colours | Desktop screenshot |
| Career creation / club selection | Crests in registry colours; relation labels (HK Cliff, HK S-hof, HK Önnerediterna, HP Alingsås, IF Kristianstad); fallback marker (HK Torslanda Elit) | Desktop, DOM read |
| Navigation / shell (every career page) | Active-club neon on the club badge and active nav item; clubless state; relation label; header follows clubless | Desktop + mobile 375 px (no overflow), resignation flow |
| Dashboard, Clubhouse, Squad, Player profiles, Scouting, Transfers, Training, Tactics, Matchday, Match report, Analysis, Inbox, Calendar, Manager career, Career history, Club pages, Promotion/relegation (season) | Every crest, `clubColorVars`, `--kh-club`, possession bar, court colours (`matchColors`) now read registry colours through `Club.primaryColor/secondaryColor`; shell identity applies around all of them | Dashboard and manager pages in browser; court readability test (`matchday.test.ts`) and crest contrast test pass |
| Career history | Archived tables show the season-correct club name (T8, `clubDisplayName(id, season)`) | Code + unit tests of the resolver |
| Club hero (club pages) | Relation label + fallback marker | Code |

Design-lab verifiers (served from this worktree on port 3791; port 3790 belonged to another session and was left alone):
- `verify-amendment.cjs`: **0 issues** — 231 recommendations unchanged, 551 alternatives identical, 231 Arena renders, 162 club-accent renders.
- `verify-club-identity.cjs`: **0 issues** — 204/204 clubs, 204/204 reproducible neons, 204/204 contrast ≥ 4.5, owner-decision rules, 708 renders (59 clubs incl. clubless × 6 screens × desktop/mobile).

## 4. What is not done (honest scope)

- **Arena Nights is not the production theme.** Production still uses the light "paper/broadcast" theme with signal orange. The approved Experience 2027 surface redesign (231 recommendations / 551 alternatives) lives in the design lab; the roadmap itself scopes "production consumption of the registry by the Arena Nights UI" as a separate redesign milestone. This work makes the identity data and the active-club identity available to every production surface (`--club-neon`, `data-club-identity`), applies the neon on the dark shell, and recolours every club mark — it does **not** re-skin the 19 surfaces to Arena Nights, and does not simplify or replace any approved recommendation.
- The neon is applied only on dark production surfaces (sidebar). On the light paper surfaces the club mark colours are used, because the registry neon is contrast-gated against the Arena night background, not paper.
- Kit research for the two new clubs and the F05/D6 replacements remains open (they render with the marked fallback).
