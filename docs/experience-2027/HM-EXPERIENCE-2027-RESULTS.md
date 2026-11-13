# HM Experience 2027 — Results & Owner Presentation

> **Amendment 2026-11-13:** the owner chose **Arena Nights + dynamic Club Identity System** and retained all surface recommendations. The result is summarised in Part 5 at the end of this file.

> Branch `design/hm-experience-2027` in worktree `C:\DEV\WORKTREES\handball-manager\experience-2027`, based on
> `feat/m6-0-state-hygiene` (ca0e85b, which contains `main` 9302bb1). Not pushed, not merged, not deployed.
> Production code, match engine, save schemas, gameplay systems and Alpha careers were not touched. The only change outside the
> worktree is one new preview entry (`hm-experience-2027-lab`) added to the untracked `C:\DEV\PROJECTS\handball-manager\.claude\launch.json`.

---

## Part 1 — Owner presentation

### 1. Why does the current game feel like a sophisticated Excel application?
1. **The navigation is a 27-item list.** The game reads as a database of pages instead of a club.
2. **Nearly every page is "panel + table".** It uses intentionally dense 12–13 px type and three conflicting token files, so nothing has a focal point.
3. **There are no people.** No faces for players, staff or board; systems speak in labels, not voices.
4. **Time is invisible.** Continue is crowded by save buttons and the week has no shape, which removes the management game's heartbeat.
5. **Numbers lack meaning.** 1–200 ability appears only as stars, raw codes leak into the UI, and "load" means three things.

Detail: VISION §1 and `inventory/part-a.md`, `part-b.md`.

### 2. Biggest visual and experiential weaknesses
- The dashboard has 11 competing sections and no lead.
- Live-match decisions are split across three places.
- Post-match content loops back on itself.
- Three overlapping player-market tables, and the shortlist has two names.
- Tactics is one page of 1,665 lines and doesn't work on touch.
- Mobile is a shrunken desktop: a drawer, sideways scrolling and hover-only interactions.
- Fonts exist only on Windows.
- Several existing photographs are unused.

### 3. What do the best management games do differently?
- One contextual heartbeat button.
- Inform ≠ navigate (FM26 → FM27).
- Every entity is clickable everywhere, plus a command palette.
- Staff are the faces of systems.
- The inbox is a task queue.
- A short pre-match ritual and real touchline agency.
- Uncertainty is shown as ranges.
- Different layouts per form factor.

They are also **sport-native**; Handball Manager 2021's main criticism was that it looked like a football reskin. (COMPETITOR-RESEARCH: 24 games, 7 deep dives, 34 patterns, 86 sources.)

### 4. What should Handball Manager's unique identity be?
**"The club journal that comes alive on matchday."**

Calm, editorial, human management on warm paper:
- Every system has a face.
- The week is visible as a spine.
- Decisions are ranked.
- Depth is one Peek away.

Moments (matchday, signings, promotion, sacking) switch to **Floodlight**: dark, cinematic, club-coloured. No competitor owns the editorial/Scandinavian space, and it gets its quality from type and layout rather than an expensive 3D asset budget. It also evolves the paper, navy and signal-orange identity the game already started.

### 5. The three strongest design directions
| | A — Tactical Clarity | B — Arena Nights | C — Paper & Floodlight |
|---|---|---|---|
| Feel | Precise coaching instrument | Broadcast sports world | Club journal that ignites on matchday |
| Best at | Speed, density, accessibility | Emotion, spectacle, marketing | Balance of depth and atmosphere |
| Cost / risk | Lowest / can feel like SaaS | Highest / asset-hungry, can bury depth | Medium / two modes to maintain |

**Recommendation: C**, using A's dense workbench layouts inside it for deep tasks. The per-surface recommendations converged on exactly this hybrid without being told to. It is advice; the owner chooses.

### 6. Best individual surface alternatives (my picks)
| Surface | Pick | Why |
|---|---|---|
| Entry (ENT-02) | C Journal Cover | Turns re-entry into "this week's story"; one obvious Continue |
| New career, club step (ENT-03d) | Club Wall by ambition (Vinna / Utmana / Överleva) | Choosing a club becomes choosing a story, using existing preseason data |
| Continue flow (ENT-10) | Up-next queue + labelled Continue | Fixes silent jumps; the heartbeat becomes visible |
| Dashboard (DSH-01) | C Today's Paper | One focal point, numbered decisions, generated stories |
| Inbox (WLD-01) | C Correspondence Desk + chain rail | Inline decisions; consequences become visible |
| Player (SQD-02) | C Feature Profile + Peek | Words and bars before numbers; full matrix one tab away |
| Squad (SQD-01) | A Squad Matrix + C Depth Chart toggle | Power table plus handball-native court view |
| Training (TRN-01) | C Assistant Proposal (as a diff on the grid) | Delegation with visible reasoning and readiness impact |
| Tactics (TRN-02) | A Tactics Board | One mode switcher, tap-to-place works on touch, readiness header |
| Scouting (REC-01) | C Shortlist & Reports | Scout reports as articles; uncertainty as ranges |
| Negotiation (REC-04) | A Term sheet | Gap to demand and budget impact before you commit |
| Live match (MDY-02) | C Floodlight Sequence + Bench Dock | Ritual → walk-out → live → full time; all decisions in one dock |
| Match report (ANL-01) | C Editorial report | Ends the circular post-match content; links analysis → training |
| Competition (CMP-01) | A League Centre (C almanac voice) | Zones, form, bracket, road to the SM final |
| Manager (MGR-01) | C Biography chapters | Long-term progression becomes a story you author |

### 7. New ideas worth considering
Ordered by value: **Week Spine**, **Today's Paper**, **Peek + Ctrl-K**, **faces for systems**, **Bench Dock**, **shared readiness strip**,
**chain rail (event → decision → consequence)**, **Floodlight moments**, **density modes**, **legend wall / biography**.

Rejected for now:
- Real-time 3D clubhouse (high cost, low decision value).
- Movable dashboard modules (conflicts with ranked "today first").
- Likeness portraits of real players (legal risk).

VISION §12 has the full evaluation.

### 8. Tools that could materially improve quality
| Need | Recommendation |
|---|---|
| Fonts | Self-hosted open fonts via `next/font` |
| Design tokens | One JSON source (Style Dictionary) |
| Motion | CSS + View Transitions by default; Motion (LazyMotion) only in client islands. GSAP (now free) kept for one-off sequences |
| Icons | Lucide plus a custom handball set |
| Charts | Hand-rolled SVG (as in the lab); visx if complexity grows |
| Portraits | Procedural, non-likeness SVG portraits for every player |
| Environments | Blender, pre-rendered to AVIF/WebP |
| Image generation | Higgsfield for environments and editorial art only (never player likeness) |
| Quality checks | Playwright visual snapshots and axe-core in the existing e2e setup |
| Design tool | Figma if a seat exists, otherwise Penpot |

Already available here:
- The **impeccable**, **animate**, **figma**, **design** and **dataviz** skills, and the Higgsfield MCP.
- Blender 5.2 is installed, but its MCP was not reachable because Blender wasn't running.

Detail and costs: TOOLS-AND-SKILLS.

### 9. What should be redesigned first?
1. **Phase 1 foundation:** single token source, web fonts and contrast fixes.
2. **Phase 2 shell & heartbeat:** 6 hubs, labelled Continue with up-next, Week Spine, Peek, Ctrl-K and mobile bottom bar.
3. **Phase 3 daily loop:** Today's Paper, task inbox and calendar.

These three change the feel of *every* session for modest effort. Then **matchday (Phase 5)**, the emotional peak. See REDESIGN-ROADMAP.

### 10. What a complete Experience 2027 product looks and feels like
See VISION §13. In short:
- You open this week's cover of your club's journal and press one button.
- Petra's plan, Mattias's report and Sara's warning are waiting as decisions with faces.
- The week is a visible spine.
- On matchday the paper dims and the floodlights come up.
- The next morning the result is the lead story, with its consequences and a suggested training focus.
- Seasons become chapters of your manager's biography.

---

## Part 2 — Work completed

| Deliverable | Location | Status |
|---|---|---|
| 1 VISION | `HM-EXPERIENCE-2027-VISION.md` | Done |
| 2 SURFACE-INVENTORY | `HM-EXPERIENCE-2027-SURFACE-INVENTORY.md` (generated) + `inventory/part-a.md`, `part-b.md`, JSON | **231 surfaces**: 61 pages, 45 tabs, 86 panels, 26 states, 9 modals/drawers/overlays, 4 nav. Stable IDs |
| 3 COMPETITOR-RESEARCH | `HM-EXPERIENCE-2027-COMPETITOR-RESEARCH.md` | 24 games, 7 deep dives, 34 patterns, 18 anti-patterns, 20 lessons, 86 sources with evidence tags |
| 4 DESIGN-DIRECTIONS | `HM-EXPERIENCE-2027-DESIGN-DIRECTIONS.md` | 3 identities, shared token contract |
| 5 SURFACE-PROPOSALS | `HM-EXPERIENCE-2027-SURFACE-PROPOSALS.md` (generated) + `proposals/*.json` | **551 alternatives** for all 231 surfaces (3 for every player-facing page and core surface; 2 for the 12 internal dev-tool pages), each with the 12 required fields, recommendation, dependencies and priority |
| 6 TOOLS-AND-SKILLS | `HM-EXPERIENCE-2027-TOOLS-AND-SKILLS.md` | Done; claims tagged verified or assumed |
| 7 REDESIGN-ROADMAP | `HM-EXPERIENCE-2027-REDESIGN-ROADMAP.md` | 8 phases with acceptance criteria |
| 8 OWNER-DECISIONS | `HM-EXPERIENCE-2027-OWNER-DECISIONS.md` (generated) | G1–G8 + every surface, with space for decisions |
| 9 RESULTS | this file | Done |
| Interactive Design Lab | `design-lab/experience-2027/` | 7 views; decisions, notes, export/import, responsive preview, identity switch, consistency check |
| Hi-fi prototypes | `design-lab/experience-2027/proto/` | **15 surfaces × 3 alternatives = 45 interactive screens**, plus a journey screen and a component gallery. Each renders in any of the 3 identities and is responsive |
| Concept boards | Lab (auto-rendered) | Every other surface's alternatives as lo-fi layouts in the active identity, desktop and mobile |
| Three full concepts | Lab → Journeys | 9-step journey per concept, plus "My selection" |
| Cross-surface flows | Lab → Journeys & flows; VISION §7 | 5 flows |
| Visual comparison boards | `docs/experience-2027/boards/` | 102 images (17 screens × 3 × desktop/mobile) + index |
| Design system proposal | `proto/themes.css`, `kit.css`, `kit.js`; VISION §9; Lab → Design system | Token contract + component kit |

**Verification performed:**
- All 17 prototype keys × 3 alternatives × 3 identities (153 combinations) rendered with no errors.
- Lab interactions were exercised in the browser preview with no console errors: alternative switching, decision radio buttons, notes saving, device switch, compare, journeys, decisions with the G1 consistency check.
- Mobile layouts were checked via the captured 390 px boards; three issues were found and fixed (hidden panes, cramped decision rows, score wrapping).
- Contrast was measured on the prototype tokens (VISION §11).

## Part 3 — Limitations & unresolved areas (honest list)

- **Not seen running:**
  - The inventory was built from source code. The production app was not run with a real career in this session, so density, overlap and breakpoint behaviour are inferred from CSS.
  - The existing screenshots in `docs/game-experience/` were used as visual reference.
- **Skimmed only** (per the inventory agents):
  - Some sub-tab internals: finance budget, preseason camp forms, season movement.
  - Some components: StaffInsight, AssistantTrainingPanel, DealCompletion, CoachingChoices, the per-mode tactics rail panels.
  - Internal tools: `/scenario-lab`, `/match-qa`, `/career/club/cpu-recruitment`. These show no access gate in source; deployment config was not checked.
  - Seven `components/matchPlan` components appear unused; this was checked with grep only.
- **Bugs spotted in passing** (not fixed; this track does not modify the app):
  - `/career/match-2d` has broken encoding.
  - `/career/history` has a corrupted fallback link text.
  - `/career/match-center` redirects twice.
- **Competitor evidence is thin** for Handball Manager 2021/22, OOTP 26, F1 Manager 2024's Mentality hub, Hattrick, Top Eleven, EHM, FHM and PCM. Some sites blocked fetching, so those claims are tagged "snippet".
- **Prototype data is fictional:** players and staff are invented, and club names and league structure are real.
- **Prototype content isn't live data:** Today's Paper copy is hand-written to show the concept; production needs templated generation.
- **Concept boards are lo-fi.** For the ~215 non-hi-fi surfaces, the alternatives are full written specs plus auto-rendered layout boards, not high-fidelity screens.
- **Accessibility:** contrast issues were found in the prototype tokens (C text-accent, white on B accent, "faint" tokens) and are documented, not yet fixed. A full keyboard and screen-reader audit of the prototypes was not done.
- **No media was generated:**
  - No Higgsfield or AI images (paid credits; and the art direction should be approved first).
  - No Blender renders (Blender was not running).
  - The prototypes reuse the repo's 10 existing environment photos.
- **Fonts** load from Google Fonts in the lab. Production should self-host them.

## Part 4 — Recommended next steps

1. **Review in the lab, at least 45 minutes.** Start with *Identities* → *Journeys* (Concept C, then A and B) → *Decisions* G1–G8.
2. **Decide the P0 surfaces.** Lab *Surfaces* → filter "P0", then export the Markdown into OWNER-DECISIONS.md.
3. **Run a 30-minute live check of the current app with a real save,** to confirm the inferred density and mobile issues before Phase 1.
4. **Start Phase 1 (foundation) on a new branch** from current main, behind the `experience2027` flag. It is low risk and unlocks everything else.
5. **Commission an art-direction spike:**
   - 6 Blender-rendered environment plates.
   - A procedural portrait style board.
   - Owner approval before any paid generation.

---

## Part 5 — Amendment 2026-11-13: Arena Nights + Club Identity System

**Owner decision:** identity **B — Arena Nights**, with a **dynamic club neon accent** (Tumba neon blue, Hammarby neon green, clubless neon orange). **All surface recommendations are retained.** Full write-up: `HM-EXPERIENCE-2027-ARENA-NIGHTS-AMENDMENT.md`.

What was done:
- **Club Identity System** as prototype tokens: `--club-neon` drives accent, glow, active states, highlights, the attribute ramp and data series 1, with dark ink on neon fills. `K.applyClub()` handles Tumba, Hammarby, clubless and derived neons for every other club. Measured AA contrast holds for all of them.
- **Recommendations retained:** the original proposal files are untouched. The verification script compares the lab data with them: all 231 recommendations and 551 alternatives are identical.
- **Navigation:** the recommended Week Spine + hub rail (ENT-07/08) is kept and restyled in Arena; Arena's original top hub bar is still available in the lab for comparison.
- **Conflicts:** 21 recommended alternatives depended on Paper & Floodlight presentation. Each has a documented conflict, an Arena adaptation and a "preserved" list. 9 are interactive hi-fi adaptations (with original vs adapted comparison in the lab); 12 are concept boards with written adaptations. The remaining 210: 49 native, 144 token-level, 17 internal.
- **Design Lab:**
  - Club selector and navigation switch.
  - Arena section on every surface; presentation switch (Arena / Arena tokens / Original).
  - Original-vs-adapted compare mode.
  - New Club identity view and Owner-direction journey.
  - G1/G9 shown as owner decisions.
- **Verification** (`verify-amendment.cjs`; report: `HM-EXPERIENCE-2027-AMENDMENT-VERIFICATION.md`):
  - Data, lab UI and render checks for all 231 surfaces.
  - 162 club-accent renders across desktop, tablet and mobile.
  - **0 issues.**
- **Evidence:** 64 new boards in `boards-arena/`. Generated docs (OWNER-DECISIONS, SURFACE-PROPOSALS) now carry the Arena status per surface, and a new ARENA-ADAPTATION-REGISTER lists them all.

Recommended next steps (updated):
1. Review *Club identity* and the *★ Owner direction* journey in the lab.
2. Review the 21 adaptations (Surfaces → filter "Arena-adapted" → Compare: original vs adapted) and accept or reject each.
3. Phase 1 then builds the Arena token set with the Club Identity System as the first production design-system step.

---

## Part 6 — Club kit colour audit and Club Identity Registry (2026-11-13)

Principle: **every club's neon comes from the dominant colour of its actual first-choice home shirt.** Full write-up: `HM-EXPERIENCE-2027-CLUB-IDENTITY-REGISTRY.md`.

- **Coverage:**
  - All 202 clubs in the game database: Handbollsligan 14, Allsvenskan 14, Division 1 24, Division 2 53, international and world pool 97.
  - 9 verified, 98 probable, 57 uncertain, 38 unknown.
  - Nothing invented: unknown kits use a neutral "pending" neon, and monochrome shirts without a documented accent use ice silver.
- **Registry:**
  - One data-driven source keyed by the game's real club IDs, covering kit colours, neon, rule, status, sources, accent basis, overrides and review reasons.
  - The prototypes read only from it; all hard-coded club colours were removed.
- **Neon generator:** OKLCH conversion that keeps the hue, with consistent intensity, an AA contrast gate, and deterministic output.
- **Design Lab:** club selector with all 202 clubs, and a rebuilt Club identity view (kit card, seven-plus screens, club change, clubless, a six-club comparison, all neons).
- **Evidence:**
  - Visual checks of official imagery confirm Kristianstad (orange, not its blue crest), Sävehof (yellow), Hammarby (green), Malmö (black/red) and Guif (red), and show Tumba is blue rather than navy.
  - 82 of 103 checkable game placeholder colours are a different colour family from the real shirt.
- **Verification:**
  - Club identity checks: 0 issues, including 588 renders.
  - Recommendation-preservation checks: 0 issues (231 surfaces, 551 alternatives unchanged).
  - Game data unchanged.
- **Screenshots:** `boards-clubs/README.md`.

---

## Part 7: Club Identity Verification, Phase 2 (2026-11-14)

Full report: `HM-EXPERIENCE-2027-CLUB-IDENTITY-PHASE2-REPORT.md`.

- **All 202 clubs:**

  | Status | Before | After |
  |---|---:|---:|
  | Verified | 9 | **118** |
  | Probable | 98 | **50** |
  | Uncertain | 57 | **25** |
  | Unknown | 38 | **9** |

- **Sweden (105 clubs):** 59 verified, 34 probable, 5 uncertain, 7 unknown. Handbollsligan is 14/14 verified.
- Shirt colours were checked against **official images** in a browser and measured from 295 archived screenshots.
- Neon comes from the documented hue, nudged at most ±10° toward the measured hue. Crests keep their own colours, and B/U teams don't inherit parent colours.
- **Club database identity findings:** 33 findings in five categories, with proposed corrections. The production data is unchanged.
- **Verification:** club identity checks and recommendation-preservation checks both report 0 issues.
