# HM Experience 2027 — Vision

> **Amendment 2026-11-13 — owner decision:** the visual identity is **B — Arena Nights + Club Identity System** (G1 = B, G9). §5's identity recommendation (C) is kept below as history, but the product identity is now "Arena Nights, with every surface's recommendation retained". The principles, IA, journey, connections, design-system structure and ideas in this document all still apply; only the visual temperament changes. Paper-specific presentations are adapted (21 surfaces), so the editorial *voice* (generated stories, the front-page structure) survives in broadcast form. See `HM-EXPERIENCE-2027-ARENA-NIGHTS-AMENDMENT.md` and `HM-EXPERIENCE-2027-ARENA-ADAPTATION-REGISTER.md`.

> Track: Experience & Presentation (separate from the paused gameplay roadmap; M6.1–M6.6 untouched).
> Status: proposal for owner review. Nothing in the production app, match engine, save schema or Alpha careers was changed.
> Companion material: Design Lab (`design-lab/experience-2027/`), DESIGN-DIRECTIONS, SURFACE-INVENTORY, SURFACE-PROPOSALS,
> COMPETITOR-RESEARCH, TOOLS-AND-SKILLS, REDESIGN-ROADMAP, OWNER-DECISIONS, RESULTS.
>
> Evidence policy: statements about the current app come from the source inventory (`inventory/part-a.md`, `part-b.md`, all read from
> `apps/game` at commit `ca0e85b`). Statements about other games come from COMPETITOR-RESEARCH and carry its evidence tags.
> Everything else is a **proposal**.

---

## 1. Why the game feels like a sophisticated spreadsheet (verified diagnosis)

The systems underneath are deep. The presentation flattens them. Concretely:

1. **Navigation is a list, not a world.** The career shell has a flat sidebar of **27 items**, and the "Klubben" group alone holds 11. Several pairs overlap: Kalender/Schema, Säsongen/Tävlingar/Svenska Cupen, Spelarsök/Scouting/Rekrytering/Transfers, Klubb/Klubbhuset. (`lib/career/navigation.ts`, ENT-07)
2. **One page shape everywhere.** "Panel + table" is the default layout. There are about 757 inline `style={{}}` uses, and tokens are defined three times with conflicting values (`tokens.css`, `game.css :root`, `legacy.css`). `manager.css` even declares "intentional density": 13 px body, 12 px tables, 9–11 px labels.
3. **No people.** Players, staff, manager, board and journalists have no faces. A player is a name in a row, and a staff member is a role label. (Crests are procedural; the 10 environment photographs in `components/clubhq/assets` are the only imagery, and several moment images are unused.)
4. **Numbers without meaning.** Ability and potential are stored on 1–200 but shown only as stars. Raw codes leak into the UI (tempo `SLOW/BALANCED/FAST`, raw attribute keys). "Load" means three different numbers on three screens.
5. **The heartbeat is buried.** Continue sits beside four save, export and import buttons. The date is 12 px muted text, and the "time passes" overlay lasts about a second and is pure text. Time, the core loop of every management game, is invisible.
6. **The dashboard has no focal point.** It is about 11 text sections in three columns, and they repeat each other (DSH-01).
7. **Post-match is circular.** "Se matchrepris" opens the same replay already embedded in the report, and analysis/last-match restates the report in another layout. Live-match decisions are split across three places (controls bar, coach panel, timeout overlay).
8. **Mobile is a shrunken desktop.** It has the 27-item drawer, no bottom navigation and hidden search. Calendar and training scroll sideways at about 1,000 px, and the Clubhouse relies on hover and double-click.
9. **Fonts only exist on Windows.** Bahnschrift and Segoe are not loaded as web fonts, so on Mac or a phone the identity collapses into fallbacks.

The 2026 visual pass (`HM-RICH-EXPERIENCE-01` tokens: warm paper, navy, signal orange, condensed display type) was a good start. It created an **editorial broadcast** feel on a few hero areas but didn't reach the structure, the people or the time model.

## 2. What the best management games do differently (from research)

From 24 games, 7 of them examined in depth (see COMPETITOR-RESEARCH §5–7):

- **One heartbeat.** A single Continue button whose label changes with context: Continue → Prepare match → Go to match → Results (FM, OOTP, Motorsport Manager).
- **Inform ≠ navigate.** FM26's portal tiles doubled as navigation and were heavily criticised. The FM27 preview separates them again.
- **Every entity is clickable everywhere.** Hover or long-press cards plus a command palette (FM, Basketball GM, CK3-style nested tooltips).
- **Staff are the faces of systems.** F1 Manager's department heads and Two Point's named staff turn abstract systems into people with advice.
- **Inbox as task queue.** You act inside the message, and threads are merged per entity.
- **Ritual before the match, agency during it.** FM26 removed touchline shouts and players objected, so SI restored them.
- **Fog of war shown as ranges.** OOTP and FM scouting show uncertainty instead of false precision.
- **Design per form factor.** SI publicly called the single PC/console/phone UI "detrimental".
- **Handball-native, not a reskin.** Handball Manager 2021's menus were called clunky and copied its football sibling. That gap is still open.

## 3. Product identity — what Handball Manager should be

> **"The club journal that comes alive on matchday."**

Handball Manager's distinctive identity is **editorial and human**: a Swedish handball club told like a well-made matchday
programme and club newspaper, where every system has a face (the assistant, the physio, the chief scout, the chairwoman), every week has
a visible shape (the Week Spine), and every match is a *moment* staged under floodlights. Its depth is never hidden, but it is
**ranked**: what matters today comes first, detail is one Peek away.

No competitor owns this space. FM is a dense, grey-blue productivity tool. F1 Manager is a corporate paddock. NBA 2K is a TV
broadcast. The editorial and Scandinavian design voice (paper, rules, serif headlines, strong typography, restraint) is free, it suits
a smaller, community-rooted sport, and it is cheap to execute well because it relies on type and layout, not on a large 3D asset budget.

### Competitive positioning

| | Depth | Atmosphere | Learning curve | Asset cost | HM 2027 target |
|---|---|---|---|---|---|
| Football Manager | Very high | Medium | Steep | High | Match FM's depth on what exists; beat it on clarity and warmth |
| F1 Manager | Medium | High | Medium | Very high | Borrow "department heads as faces", not the 3D budget |
| OOTP | Very high | Low–medium | Steep | Low | Borrow history, almanac and fog-of-war ranges |
| Basketball GM | High | Low | Low | Very low | Borrow web-speed, Ctrl-K and instant tables |
| Two Point | Low | Very high | Low | High | Borrow personality and humour in copy, not the sim genre |

## 4. Design principles

1. **Today first.** Every session starts with what needs *you* now (ranked decisions), then the week, then everything else.
2. **One heartbeat.** Continue is always visible, always says what will happen ("Till onsdag", "Till matchen") and never jumps silently.
3. **Faces for systems.** Every department speaks through a named person with a portrait, a mood and an opinion.
4. **Ranked depth.** Show the 3 things that matter, make the other 50 one click (Peek) or one keystroke (Ctrl-K) away. Never remove depth.
5. **Inform ≠ navigate.** Summary tiles inform; the hub rail navigates; actions live where the decision is.
6. **Calm work, loud moments.** Management is paper-calm; matchday, signings, promotions and sackings go to Floodlight.
7. **Everything connects.** Every name is a link; every consequence shows its cause; every decision lands in history.
8. **Handball-native.** Court geometry, 6-0/5-1/3-2-1, 7 mot 6, 2-minute suspensions, timeouts, Swedish league structure (Handbollsligan, Allsvenskan, SM-slutspel, kval, Svenska Cupen).
9. **Per form factor.** Desktop is a workbench. Mobile is the daily loop (Today, inbox, decisions, matchday), with purpose-built layouts.
10. **Honest uncertainty.** Scouting knowledge is shown as ranges and confidence, never false precision.
11. **Accessible by default.** WCAG 2.2 AA contrast, full keyboard paths, reduced-motion parity, no colour-only status.

## 5. The recommended direction in one picture

**Global identity: C — Paper & Floodlight** (G1), with **A-style workbenches** for deep tasks, **Week Spine + 6-hub rail + Peek + Ctrl-K** navigation (G2),
**curated imagery** (G3), **procedural non-likeness portraits** (G4), **calm-by-default motion with expressive moments** (G5),
**Comfort/Compact density** (G6), **mobile-first daily loop** (G7) and **Saira Condensed + IBM Plex + Source Serif 4** (G8).

The surface recommendations (SURFACE-PROPOSALS) independently converged on this hybrid. Story and moment surfaces recommend the C concepts (Journal
Cover entry, Today's Paper, Feature Profile + Peek, Assistant Proposal training, Shortlist & Reports, Floodlight matchday, Editorial match report,
Correspondence-desk inbox, Week Spine calendar, Manager Biography). Deep-work surfaces recommend the A workbenches (Squad Matrix, Org & Responsibility
Matrix, Tactics Board, Market Table + Deal Panel, Term-sheet negotiation, League Centre). Rendered in C tokens, these are the "paper workbenches" of the hybrid.
B concepts are recommended where spectacle is the job (e.g. availability strip, celebrations). The owner can override any of these.

### Information architecture (6 hubs replace 27 items)

| Hub | Contains (current routes) |
|---|---|
| **Idag** (Today) | Today's Paper /career, Inkorg, Media & press, Kalender (Schema merged) |
| **Laget** (Team) | Trupp, Spelarprofil, Taktik, Träning, Medicinskt, Kontrakt, Jämför |
| **Klubben** (Club) | Klubben/Klubbhuset (merged), Personal & ansvar, Ekonomi, Styrelsen, Partnerskap, Historik |
| **Rekrytering** | Scouting + Spelarsök + Rekrytering merged into one market, Bevakning (one "Kortlista" name), Transfers, Förhandling |
| **Tävling** | Ligan, Cupen, Säsongen (SM-slutspel, kval), Matcher/resultat, Statistik |
| **Karriär** | Manager, rykte, jobbmarknad, milstolpar, historik |

Plus: **Continue** (top right; mobile: sticky), **Week Spine** (persistent), **Ctrl-K palette**, **Peek drawer**, **notifications** → inbox.

## 6. Full user journey (Stage 1–5)

| Stage | Today | Experience 2027 (recommended C; A and B in the lab) |
|---|---|---|
| **1 Entry** | Title menu + save list; save actions compete with Continue | **Journal Cover**: the current career rendered as this week's cover ("Omgång 13: Tumba tar emot Kristianstad"), one big *Fortsätt karriären*, back issues = other careers. A "Since you last played" digest bridges sessions. |
| **2 Career & club** | 6-step wizard, club chosen from a list | **Club Wall by ambition** (Vinna / Utmana / Överleva) with board expectation, squad strength and economy per tile → **first board meeting** sets season arc → club front page introduces the faces (assistant, physio, scout, chairwoman). |
| **3 Daily management** | 11-section dashboard | **Today's Paper**: lead story (biggest thing happening), numbered decisions with inline actions, next match box, table, around-the-league briefs. Delegation in one click ("Låt Petra bestämma"). |
| **4 Weekly rhythm** | Separate pages, no visible week | **Week Spine** makes the week tangible: training → match prep → match → recovery pins. Assistant proposes the week; Continue advances along the spine and names its next stop. Pre-match ritual ≤ 3 skippable steps (plan, line-up, talk). |
| **5 Long-term progression** | History tables, season verdict page | **Biography & almanac**: manager chapters with a reputation line annotated by causes; player careers as timelines; club history strip; legend wall with locked goals ("SM-guld — ännu inte vunnet"); season verdict as a Floodlight gala. Two meters everywhere: board confidence (this club) and reputation (career). |

What makes players keep playing (anticipation → satisfaction → feedback): the Week Spine shows the next three hooks, Continue's label creates anticipation, the Floodlight moments give the payoff, and the next day's paper turns the result into a story with consequences.

## 7. Connections between surfaces (Section 7 of the brief)

The connective tissue is four reusable mechanisms, demonstrated in the prototypes:

1. **Peek drawer.** Any player, staff, club or fixture opens a right-side drawer (bottom sheet on mobile) with the essentials and "Open profile". Context is never lost. *(Click any name in the prototypes.)*
2. **Ctrl-K palette.** Jump to any entity or run a command ("Erbjud kontrakt…", "Välj startsju"). *(Works in the prototypes.)*
3. **Chain rail.** Inbox threads and news items show their story chain: event → your decision → consequence (confidence, reputation, morale) → career log entry.
4. **Next-step cards.** Every result surface ends with the logical next action, e.g. Match report → "Lägg i veckoplanen" (analysis → training) or Scout report → "Förbered bud".

The five required flows, each walkable in the lab (*Journeys & flows*):

| Flow | Path | Key transitions |
|---|---|---|
| Recruitment | Player → Scouting → Shortlist → Negotiation → Contract → Squad | Fog-of-war ranges narrow as knowledge grows; one shortlist name ("Kortlista"); term-sheet shows gap to demand and budget impact; signing is a Floodlight moment, and the player appears in the depth chart with a "Ny" chip. |
| Development | Training → Workload → Development → Performance → Match | One readiness strip (shared heat strip with risk bands and reasons) appears in training, squad and match preview, so "load" is one number. Attribute ticks (13 → 14) animate in the inbox and the profile. |
| Match cycle | Matchday → Report → Analysis → Training priorities → Next match | Report absorbs the archived match centre and last-match analysis (no circular content); it ends with Linnea's suggested training focus, a one-click add to the week. |
| Career turn | Resignation → New club → New staff → Responsibilities → New season | Dismissal is a chapter break in the biography; the job market is "Nästa kapitel"; the new club's front page introduces its faces; the responsibility matrix is pre-filled by the new staff. |
| Story chain | News → Event → Decision → Consequence → Career history | A press question or board demand becomes an inbox decision; the consequence chip appears on Today; the outcome is logged in Historik and the biography. |

## 8. Visual design & motion

- **Typography first.** Condensed display for kickers and numbers, an editorial serif for headlines and quotes, and a humanist sans for UI, all with tabular figures.
- **Colour.** Paper and navy are the base and signal orange is the system accent; club colours appear as a stripe, in crests and in Floodlight. Status always uses an icon or text as well as colour.
- **Depth.** Paper uses rules and columns, not shadows. Floodlight uses layered dark surfaces and light beams. Shadows are only for overlays (Peek, palette, toasts).
- **Imagery.** The existing environment photos are used as hub heroes and story images in framed editorial crops. Procedural busts are used for people, and procedural crests for clubs.
- **Motion catalogue** (purposeful only; all have reduced-motion fallbacks):
  - A new result entering the feed: rise in 180 ms with a score count-up.
  - An attribute improvement: a cell tick flash and an arrow (seen in the component gallery).
  - A transfer agreement: a "KLAR!" pop, the crest swapping into the squad, and a toast.
  - A new scout report: the shortlist card glows once and its fog clears as knowledge rises.
  - Matchday: the lights-down mode switch (600 ms), then the walk-out with crests.
  - A board decision: the confidence meter moves with an annotated cause.
  - A new manager appointment: a chapter-break page turn.

## 9. Design system (proposal)

Implemented as a working token contract and component kit in `design-lab/experience-2027/proto/` (themes.css, kit.css, kit.js) and shown live in the lab's **Design system** view.

- **Tokens:** semantic only. Surfaces (`--bg/--surface/--raised`), ink, lines, accent, club colours, status, a 5-step attribute ramp, a 6-colour categorical palette, fonts (ui/display/num/editorial), display casing and tracking, radius, shadows, court colours, photo filter and overlay. Density uses `--pad/--gap/--row/--fs`. Three identities and the Floodlight mode are just token sets.
- **Layout:** 12-column grid, 16 px gutter (12 on mobile). Breakpoints at 720 and 1100. Shell variants per navigation model.
- **Components:**
  - Buttons (primary, secondary, ghost; sm and lg).
  - Segmented control and tabs.
  - Cards: plain, boxed, accent, hero, photo.
  - Tables: sticky header, group rows, own-row highlight, zone bars.
  - Metric tile, bar with a potential overlay, ring, sparkline, line chart, radar, momentum chart, form dots.
  - Attribute cell (1–20 ramp, delta).
  - Chips and status chips, pin badge.
  - Entity chip (player, staff, club) with Peek.
  - Crest and avatar/bust.
  - Decision row, timeline, quote, note box, ticker, score bug.
  - Court SVG with position tokens.
  - Drawer (Peek), command palette, toast.
  - Empty, skeleton-loading and error states.
- **Relationship to existing components:** keep and restyle `ClubCrest`, `Tabs`, `SegmentedControl`, `SortableTh`, `FormDots`, `StatValue`, `HandballCourtSvg` and `entityLinks`. Replace the three conflicting token files with one generated token file. Retire inline styles progressively. Do not build a new component library from scratch.

## 10. Desktop, tablet, mobile

- **Large desktop (≥1600 px):** three-pane layouts (list, detail and Peek) and Compact density by default for power users.
- **Laptop (1100–1600 px):** two panes; Peek overlays instead of docking.
- **Tablet (720–1100 px):** the hub rail collapses to icons; tables drop to their top columns; the court is touch-first.
- **Mobile (<720 px):** bottom bar (Idag, Laget, Match, Marknad, Klubb) and a sticky Continue. The Week Spine becomes a swipe strip and Peek a bottom sheet. Tables become ranked cards, and long-press replaces hover. The match is portrait-first with a dock of five large controls. Touch targets are at least 44 px.
- Mobile is **not a separate product**. It shares components and data but uses purpose-built layouts for the daily loop (G7).

All 15 hi-fi prototypes include real responsive behaviour. Use the lab's device switch (Desktop 1440 / Tablet 1024 / Mobile 390).

## 11. Accessibility, performance, technical realism

| Proposal | Difficulty | Performance impact | Notes |
|---|---|---|---|
| Token consolidation + web fonts | S–M | Positive (one CSS source; ~120 KB woff2 subset) | Self-host with `next/font`; subset Latin + Swedish |
| 6-hub IA + Continue + Week Spine | M | Neutral | Navigation logic exists (`lib/career/navigation.ts`); mostly presentation |
| Peek drawer + Ctrl-K | M | Low | Reuses entity links; palette index built from in-memory career state |
| Procedural busts & crests | S–M | Very low (inline SVG, ~1 KB each) | No likeness risk; deterministic per player id |
| Editorial text generation for Today's Paper | M | Low | Templates over existing events; no LLM needed at runtime |
| Floodlight mode + moment animations | M | Low–medium | CSS + View Transitions; Motion only in client islands |
| Broadcast 2.5D match court (B) | L | Medium | CSS 3D transform of existing SVG court; no WebGL |
| Blender-rendered environments | M (pipeline) | Low if pre-rendered AVIF/WebP ≤ 150 KB | No real-time 3D in management UI |
| Real-time 3D clubhouse | XL | High | Not recommended (see §12) |

Accessibility requirements:
- WCAG 2.2 AA contrast for all three token sets. Measured on the prototype tokens:

  | Pair | Ratio | Result |
  |---|---|---|
  | C muted on paper (`#5a6675` / `#f3f1ea`) | 5.17 | Pass |
  | A muted (`#5b6576` / `#f5f6f8`) | 5.44 | Pass |
  | A accent on white | 5.60 | Pass |
  | B muted | 8.00 | Pass |
  | B accent on night | 5.96 | Pass |
  | Floodlight muted | 7.59 | Pass |
  | **C accent text on paper** (`#c84320`) | **4.34** | Passes only for large or bold text |
  | **White on B accent** (`#ff4d2e`) | **3.31** | Fails for button labels |
  | **"faint" tokens** | ~2.9 | Decorative or non-essential text only |

  Before production:
  - Darken the C text-accent to about `#b13a1a`; keep `#c84320` for fills.
  - Use a deeper B accent for fills behind white labels, or dark labels on it.
  - Restrict `--faint` to decoration.
- Every interactive element is reachable by keyboard; the palette and Peek have focus traps and Esc.
- `prefers-reduced-motion` reduces all motion to crossfades (already implemented in the kit).
- Status always uses text or an icon as well as colour.
- Live-match updates go through `aria-live="polite"`, throttled.

Long sessions:
- Avoid unbounded DOM in feeds; virtualise tables longer than about 200 rows.
- Keep animation off the main thread (transform and opacity only).

## 12. New ideas — evaluated

| Idea | Problem solved | Fit | Effort | Build? |
|---|---|---|---|---|
| **Week Spine** (persistent week timeline) | Time is invisible; Continue jumps silently | Core | M | **Yes, P0** |
| **Today's Paper** (generated front page) | Dashboard has no focal point; events feel like logs | Core, distinctive | M | **Yes, P0** |
| **Peek drawer + Ctrl-K** | Deep navigation; context loss | Core | M | **Yes, P0** |
| **Faces for systems** (staff voice in advice) | Abstract systems, no people | Core | S–M | **Yes, P0** |
| **Floodlight moments** | Matchday and milestones lack payoff | Core | M | **Yes, P1** |
| **Shared readiness strip** | Three different "load" numbers | Core | S | **Yes, P1** |
| **Chain rail** (event → decision → consequence) | Consequences invisible | Strong | M | **Yes, P1** |
| **Density modes** | FM-style vs casual users | Strong | S | **Yes, P1** |
| **Bench Dock** for live match | Decisions split in 3 places | Core | M | **Yes, P0** |
| **Legend wall / biography chapters** | Weak long-term progression feedback | Strong | M | Yes, P2 |
| **Illustrated clubhouse map** (2D, Blender-rendered) | Club feels abstract | Medium | L | Later, P2; photo rooms first |
| **Customisable/movable dashboard modules** | Personal preference | Low–medium | L | **No** for now: conflicts with "today first" ranking; revisit after telemetry |
| **Optional visual themes (A/B as user skins)** | Taste differences | Medium | M (tokens make it cheap) | Maybe: Floodlight-dark as an accessibility/dark-mode theme first |
| **Contextual assistant** (asks "what should I do?") | Onboarding, overwhelm | Strong | M | Yes, as staff voice in decisions; no chatbot |
| **Real-time 3D arena or clubhouse** | Spectacle | Low | XL | **No**: high cost, perf risk, little decision value |
| **AI likeness portraits of real players** | Faces | — | — | **No**: legal and likeness risk (real Swedish squads in data) |

## 13. What a complete Experience 2027 product feels like

You open the game and see this week's cover of your club's journal. One button: *Fortsätt*. The paper's lead story is Sahlin's nine goals.
Petra has left a training proposal on your desk, Mattias's report on a 20-year-old left back is ready, and Sara flags that Axelsson is on 118% load.
The Week Spine shows Thursday's home game against Kristianstad lit in club navy. You approve Petra's plan in one click, Peek at Öberg, send a scout,
and press Continue: *Till onsdag*. On Thursday the paper dims, the floodlights come up, and the crests walk out. During the match you call a timeout
from the Bench Dock when the momentum line dips, and you pull the keeper for 7 mot 6 in the last minute. At full time the lights come up and tomorrow's paper
already has the headline, the box score, what it means for the table, and a suggested training focus. The year accumulates into chapters of
a biography you are proud of.
