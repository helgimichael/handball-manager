# HM Experience 2027 — Redesign Roadmap

> **Amendment 2026-11-13:** Phase 1 now builds the **Arena Nights** token set with the **Club Identity System** (`--club-neon` → accent/glow/active states; dark ink on neon). The surface phases are unchanged because the recommendations are retained. The 21 adapted surfaces use their Arena adaptations (see the register). The C-specific paper/Floodlight mode work in Phases 3 and 5 is replaced by the intensity-escalation pattern.

> Proposal. Implementation starts only after owner approval of the global decisions (G1–G8) and the P0 surface decisions in
> `HM-EXPERIENCE-2027-OWNER-DECISIONS.md`. This track is **presentation only**. It does not touch the match engine, player attributes,
> competition rules, economy, career logic or save schemas, and it does not unpause M6.1–M6.6.
> Priorities per surface come from SURFACE-PROPOSALS (P0: 55 · P1: 78 · P2: 66 · P3: 32).

## Guiding engineering approach

- **Strangler pattern behind a flag.** Add an `experience2027` preference flag in settings (presentation only, stored like existing UI preferences). The new shell and pages render when it is on; the old pages stay as fallback until each surface is accepted.
- **One token source.** Generate `tokens.css` from a JSON token file, for example with Style Dictionary (see TOOLS-AND-SKILLS). Delete the duplicate `:root` blocks in `game.css` and `legacy.css` only after each consumer has migrated.
- **Port the lab kit, don't reinvent it.** `design-lab/experience-2027/proto/kit.css` and `kit.js` are the reference implementation. Port them to typed React components in `apps/game/components/ui2027/` using the existing CSS approach. No new runtime dependency until Phase 5 (Motion, optional).
- **Data stays where it is.** Pages read the same `CareerContext` selectors. Any "needs new data" item in the proposals is listed separately and needs a gameplay-track decision.
- **Verification per surface.** Playwright screenshots at 1440, 1024 and 390 in all used identities. Add axe-core checks with zero serious violations. Keyboard path tests for the palette, Peek and Continue. Reuse the existing `e2e/` setup.

## Phase 0 — Decide (owner) · ~1 session

- Record G1–G8, then the P0 surfaces, in the Lab (*Decisions* → export) or in OWNER-DECISIONS.md.
- **Exit:** G1, G2, G3, G4 and G7 decided. All P0 surfaces have a choice or "keep current".

## Phase 1 — Foundation · S–M

Work items:
- Consolidate tokens into one file and add identity tokens for the chosen direction, plus Floodlight mode and density tokens.
- Self-host fonts with `next/font` (Latin + Swedish subset).
- Apply the contrast fixes found in VISION §11.
- Port the kit primitives: button, chip, card, tile, table, bar, attribute cell, entity chip, crest, avatar/bust, tabs, segmented control, empty, skeleton and error states.
- Add an internal `/design-system` route that renders the gallery from real components (internal only, like `/scenario-lab`).

**Acceptance:**
- Exactly one `:root` token source.
- No Windows-only font dependency.
- axe passes on the gallery.
- Bundle increase is at most 40 KB gzip of CSS/JS (fonts excluded); woff2 subsets are at most 150 KB in total.

## Phase 2 — Shell & heartbeat · M · P0

Surfaces: ENT-07 sidebar → hub rail, ENT-07a mobile nav, ENT-08 top bar, ENT-09/09a context bar and progression notice, ENT-10/10a Continue flow, ENT-08a global search.

Work items:
- 6-hub IA (VISION §5): merge duplicate destinations. Old routes stay valid and redirect.
- Continue with a contextual label and an "up next" queue of 3 events; save controls move into a menu.
- Week Spine component with day pins (training, match, deadline, event).
- Ctrl-K palette and Peek drawer, built on `entityLinks`.
- Mobile bottom bar with a sticky Continue.

**Acceptance:**
- Every pre-2027 route is reachable within 2 clicks or 1 palette query.
- Continue always states its next stop.
- Keyboard-only users can open, use and close the palette and Peek.
- On a 390 px viewport there is no horizontal page scroll on any hub landing page.

## Phase 3 — Daily loop · M · P0

Surfaces: DSH-01 (+DSH-01a–k) Today's Paper, WLD-01/01a/01b Inbox (task queue, chain rail, inline actions), WLD-05/06 Calendar (Week Spine calendar; Schema merged), ENT-02/04 entry (Journal Cover + "since you last played").

- Templates turn existing career events into headline, lede, decision rows and briefs. This is deterministic text only; no runtime LLM.
- Inbox actions call the same handlers as today's buttons.

**Acceptance:**
- The dashboard has one focal point (lead) and at most 6 modules.
- Every actionable inbox message can be resolved inline.
- The calendar is usable at 390 px without sideways scrolling (week list mode).

## Phase 4 — People & team · M–L · P0/P1

Surfaces:
- SQD-01 Squad Matrix with column sets and a depth-chart toggle.
- SQD-02 Feature Profile with Peek variant; tab state in the URL.
- STF-01 Org & Responsibility Matrix.
- TRN-01 Assistant Proposal training, shown as a diff on the planner grid.
- TRN-02 Tactics Board: one mode switcher, tap-to-place that works on touch, no emoji icons.
- MED-01, SQD-03 Contracts, SQD-04 Compare.

Work items:
- Procedural busts and crests (G4), deterministic per id.
- A shared **readiness strip**, the single definition of "load" across squad, training and preview.
- Staff voice lines on decisions.

**Acceptance:**
- No raw codes in the UI (tempo, attribute keys).
- Ability and potential are shown consistently: stars plus a range where knowledge is below 100%.
- Tactics is operable by touch and by keyboard.

## Phase 5 — Matchday · M–L · P0

Surfaces:
- MDY-01 preview ritual: at most 3 skippable steps.
- MDY-02 live match:
  - A Bench Dock unifies timeout, substitutions, tactics and 7 mot 6, and shows a reason when timeout is disabled.
  - Manpower and 2-minute suspensions become the most legible elements.
  - Half-time and full-time screens.
- ANL-01 Editorial match report, absorbing ANL-05 and MDY-04 to remove the circular content.
- `/career/match-2d` encoding bug fixed or route retired; the match-center redirect chain simplified.

Work items:
- Floodlight mode transition using CSS and the View Transitions API.
- Optionally introduce Motion (LazyMotion) in the live match island only.

**Acceptance:**
- All live decisions are reachable from one dock.
- Suspension and timeout state are readable at 390 px.
- Reduced motion leaves no animation longer than 150 ms.
- The live view sustains 60 fps on a mid-range laptop (Chrome performance trace).

## Phase 6 — Market · M · P1

Surfaces: REC-01/02 unified market (Scouting + Spelarsök + Rekrytering → one search workbench with saved searches), shortlist with a single name, REC-03 Market Table + Deal Panel, REC-04 term-sheet negotiation, transfer pipeline view.

**Acceptance:**
- One player-market table definition.
- Uncertainty is shown as ranges.
- Negotiation shows the gap to demand and the budget impact before submitting.

## Phase 7 — World & progression · M · P1/P2

Surfaces:
- CLB-01/02 Club Journal, with the clubhouse photo rooms as entry points.
- CLB-05 Board, with the two meters (confidence and reputation).
- CLB-06 Finance tabs.
- MGR-01 biography chapters and job market as "Nästa kapitel".
- MGR-02 history and almanac; MGR-03 season hub with the verdict gala.
- WLD-02/03/04 media, press conference and story pages.
- CMP-01 League Centre / Almanac with zones, cup bracket and the road to the SM final.

**Acceptance:**
- Every board or press decision appears in history with its consequence.
- Season end produces a Floodlight verdict and a new biography chapter.

## Phase 8 — Polish & assets · ongoing · P2/P3

- Motion catalogue (VISION §8).
- Asset pipeline (TOOLS-AND-SKILLS):
  - Blender pre-rendered environment set as AVIF/WebP, ≤150 KB per hero.
  - Higgsfield only for environments and editorial art, never player likeness.
- Remaining P2/P3 surfaces.
- Internal tools (SYS-*) restyled minimally and hidden from players.

**Acceptance:**
- Lighthouse performance ≥ 90 on Today (production build, desktop).
- Total image weight on a hub page is at most 400 KB.
- An axe-clean pass across all hubs.

## Dependencies (critical path)

```
G1–G8 decisions ─► Phase 1 tokens/fonts/kit ─► Phase 2 shell (hub IA, Continue, Spine, Peek, Ctrl-K)
                                              ├─► Phase 3 daily loop
                                              ├─► Phase 4 people (needs procedural busts, readiness strip)
                                              │     └─► Phase 5 matchday (uses readiness strip, Floodlight)
                                              └─► Phase 6 market (uses Peek, ranges)
Phase 3 + 5 ─► Phase 7 progression (chain rail, history logging of decisions)
```

## Items flagged "needs new data" (require a gameplay-track decision, not part of this track)

Collected from SURFACE-PROPOSALS `cons` fields. Examples:
- Per-match board targets.
- Persisting the story chain for decision → consequence logging, if it isn't already logged.
- Journalist and outlet personas.
- Richer staff "mood" if it isn't modelled.

None is required for Phases 1–6. Search the proposals for "needs new data" to get the full list before starting Phase 7.

## Risks

| Risk | Mitigation |
|---|---|
| Two visual modes (paper + floodlight) double QA | Same components, token-only switch; Playwright snapshots per mode |
| Editorial text feels repetitive | Template variety per event type; owner review of copy; tone guide |
| Scope creep into gameplay | "Needs new data" list is gated to the gameplay roadmap |
| Asset legal risk | Procedural non-likeness portraits only (G4); licence log for photos/fonts |
| Regression for Alpha testers | Feature flag; old pages remain until each surface is accepted |
