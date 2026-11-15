# Arena Nights Phase 2 — Player Experience (Phase A)

**Status: PASS**

| | |
|---|---|
| Commit | `a54e0dc` (dossier), plus the primary-action refinement in the Phase 2 integration commit |
| Recommendations implemented | SQD-02 (C) Feature Profile + Peek, SQD-02a (A) key-ratings summary, SQD-02g (A) sticky identity bar + primary CTA |
| Screenshots | `phase2-screenshots/02-player-overview-desktop.png`, `03-player-career-desktop.png`, `10-player-phone.png` |

## What changed

The player page is now a **dossier**: the existing identity hero, then a sticky identity bar, then six chapters. All data comes from a pure, read-only model (`lib/players/playerDossier.ts`) over stored career state. No rating, development calculation or match outcome is changed.

### Identity (A1)

The hero still shows name, glyph, age, nationality, positions, club, availability, squad tier, roles and contract end.

New is the **sticky identity bar**, which stays in view while the dossier scrolls. It shows:

- club crest, shirt number, name and position;
- an availability chip and the squad role;
- K / VK / 7m pills.

It carries one **primary action chosen from state**:

- **Förläng kontrakt** when a year or less remains;
- **Svara på oro** when the player has an open concern;
- **Förhandla** for external players (from the existing actions).

The existing real actions follow it: compare, line-up, contracts and training (own players); shortlist, scouting and negotiation (external players).

### The six chapters

| Chapter | What it shows | Requirement |
|---|---|---|
| Översikt | Season line (matches/starts, archive playing time, goals/shots or saves, efficiency, average rating); form timeline (one bar per match, coloured by result, each linking to its report); **Spelarbild** (ability/potential band, six attribute-family bars, five strengths and three weaknesses); readiness gauges (energy, match fitness, morale + recovery outlook and reasons); condition, medical, morale/dynamics; contract & future summary | A2 |
| Utveckling | Individual focus (with a link to training); counts of changes from training and matches; a timeline of every stored development event (above the line = improvement); per-attribute progression (first → last); the full list of changes with their source | A3 |
| Matcher | Performance curve over the last 15 matches (each links to its report), then the existing match table and season history | A4 |
| Karriär | Timeline of previous clubs, completed transfers and loans, departures, contract renewals, completed seasons, and milestones from the match archive (first match, first goal, best rating, biggest development) | A5 |
| Kontrakt & framtid | End date, days left, wage, squad role, renewal-talk status, bids from other clubs; risks (expiry, transfer request, pre-contract, bids, low morale, transfer listing); then the existing renewal, transfer and market-value tools | A6 |
| Egenskaper | The existing full attribute views, unchanged | A2 |

### Honesty and entitlement

- **External players:** strengths, weaknesses and the family profile are produced **only for the manager's own players**. External players keep the existing knowledge-gated scouting panels: no raw attributes, no wage, no squad role, no risks. A unit test asserts this.
- **Empty states:** when there is no development history or match archive yet, the page says so plainly. It never fabricates. On a fresh career: "Ingen synlig förändring registrerad ännu…".
- **Career length:** the career timeline only shows what the save stores. Club history, completed deals, departures and renewals are real records.

## Tests

`lib/players/playerDossier.test.ts`: **4 / 4 pass**.

1. Own-player profile, readiness and contract; the model is pure and deterministic.
2. External gating: nothing rating-derived, no wage or role.
3. Stored development history becomes a chronological timeline, net progression and source split.
4. Contract risks come from stored state.

In the journey e2e, steps 6–7 open a player from the Squad Matrix and walk the Utveckling, Matcher, Karriär and Kontrakt & framtid chapters.

**E2E specs updated** for the renamed chapters ("Prestation & historik" → "Matcher", "Profil & egenskaper" → "Översikt", "Kontrakt" → "Kontrakt & framtid", "Klubbhistorik" → "Karriär"):

- `management`
- `product`
- `game-presentation`
- `contract-renewal-errors`
- `match-calibration-v21`
- `match-realism-v2`

## Remaining

- The Peek drawer exists for squad players only.
- The SQD-02 sub-panels (02b–02j) keep their earlier layouts inside the chapters; see the traceability.
