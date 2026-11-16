# Experience 2027 · UI inventory — Part A

Scope: entry & global shell, dashboard, club & organisation, manager career, world & communication, medical, settings and internal tools of `apps/game` (Next.js app router). Established from source in the `experience-2027` worktree on 2026-11-12 (read-only; nothing under `apps/` or `packages/` was changed). Machine-readable twin: [part-a.json](./part-a.json).

Out of scope (covered by Part B, only referenced as links here): squad, contracts/compare, players/recruitment, staff, training, tactics, scouting, transfers, competitions/statistics, match preview/day/report/2D/center, analysis.

**100 surfaces** — by domain: ENT 26, DSH 12, CLB 22, MGR 10, WLD 15, MED 2, SYS 13; by kind: overlay 2, page 34, panel 33, state 8, nav 4, drawer 1, modal 1, tab 17.

## Index

| ID | Name | Route | Kind | Importance |
|---|---|---|---|---|
| ENT-01 | Alpha access gate | `* (all routes, root layout)` | overlay | occasional |
| ENT-02 | Title screen (Huvudmeny) | `/` | page | frequent |
| ENT-03 | New game wizard | `/new-game` | page | frequent |
| ENT-03a | Step 1 · Nationer | `/new-game (step 0)` | panel | occasional |
| ENT-03b | Step 2 · Ligor | `/new-game (step 1)` | panel | occasional |
| ENT-03c | Step 3 · Databas (summary) | `/new-game (step 2)` | panel | rare |
| ENT-03d | Step 4 · Klubb | `/new-game (step 3)` | panel | frequent |
| ENT-03e | Step 5 · Manager | `/new-game (step 4)` | panel | occasional |
| ENT-03f | Step 6 · Starta (preseason) | `/new-game (step 5)` | panel | frequent |
| ENT-04 | Load game (Sparade karriärer) | `/load-game` | page | frequent |
| ENT-04a | Delete-save inline confirmation | `/load-game` | panel | rare |
| ENT-04b | Load game: loading / empty / error states | `/load-game` | state | occasional |
| ENT-05 | Settings (from main menu) | `/settings` | page | occasional |
| ENT-06 | Host shell (STARKVIS navbar) | `* (root layout)` | nav | frequent |
| ENT-07 | Career shell · sidebar navigation | `/career/* (layout)` | nav | core |
| ENT-07a | Mobile nav drawer | `/career/*` | drawer | core |
| ENT-08 | Career top bar (header) | `/career/*` | nav | core |
| ENT-08a | Global search results dropdown | `/career/*` | panel | frequent |
| ENT-08b | Save controls | `/career/*` | panel | frequent |
| ENT-09 | Context bar (breadcrumb row) | `/career/*` | nav | frequent |
| ENT-09a | Progression notice (after Continue) | `/career/*` | panel | core |
| ENT-10 | Continue / advance-day flow | `/career/*` | panel | core |
| ENT-10a | Continue processing overlay ('Världen går vidare.') | `/career/*` | overlay | core |
| ENT-11 | Feedback / bug report modal | `* (root layout)` | modal | occasional |
| ENT-12 | Career initialization / loading / error screen | `/career (layout) & /new-game` | state | frequent |
| ENT-13 | Live-match banner (header subline) | `/career/* (when away from live match)` | state | occasional |
| DSH-01 | Dashboard · Managerns kontor (Hem) | `/career` | page | core |
| DSH-01a | Office hero header | `/career` | panel | core |
| DSH-01b | Next match hero + league card | `/career` | panel | core |
| DSH-01c | Season-complete milestone & transition blockers | `/career (seasonComplete)` | state | occasional |
| DSH-01d | Contextual notices (unemployed / new season) | `/career` | state | occasional |
| DSH-01e | Laget inför avkast (availability) | `/career` | panel | core |
| DSH-01f | Utanför planen (contracts & radar) | `/career` | panel | frequent |
| DSH-01g | Senaste avtrycket (recent results) | `/career` | panel | frequent |
| DSH-01h | Från klubben (latest news) | `/career` | panel | frequent |
| DSH-01i | Veckans managerplan (weekly overview) | `/career` | panel | core |
| DSH-01j | Styrelsen (board card) | `/career` | panel | frequent |
| DSH-01k | Rivalerna + På andra planer + training note | `/career` | panel | frequent |
| CLB-01 | Klubbhuset (clubhouse hub) | `/career/klubbhuset` | page | frequent |
| CLB-01a | Interactive floorplan + room stage | `/career/klubbhuset` | panel | frequent |
| CLB-01b | Room cards gallery | `/career/klubbhuset` | panel | frequent |
| CLB-01c | Identity / Supporters / National team panels | `/career/klubbhuset` | panel | occasional |
| CLB-02 | Klubb (own club overview) | `/career/club` | page | frequent |
| CLB-02a | ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik) | `/career/club, /career/clubs/[clubId]` | tab | frequent |
| CLB-02b | Economy & partnerships rail | `/career/club` | panel | occasional |
| CLB-03 | Klubbpartnerskap | `/career/club/partnerships` | page | occasional |
| CLB-03a | Partner search & agreement form | `/career/club/partnerships` | panel | occasional |
| CLB-03b | Placement & international loan panels | `/career/club/partnerships` | panel | rare |
| CLB-04 | Other club profile | `/career/clubs/[clubId]` | page | frequent |
| CLB-04a | Club identity & coach philosophy panels | `/career/clubs/[clubId]` | panel | occasional |
| CLB-05 | Styrelserummet (Board) | `/career/board` | page | frequent |
| CLB-05a | Board verdict hero | `/career/board` | state | frequent |
| CLB-05b | Recovery-plan & contract-offer decision cards | `/career/board` | panel | occasional |
| CLB-06 | Finanscentralen (Finance) | `/career/finance` | page | frequent |
| CLB-06a | Tab · Översikt | `/career/finance` | tab | frequent |
| CLB-06b | Tab · Intäkter & kostnader | `/career/finance?tab=flows` | tab | occasional |
| CLB-06c | Tab · Budget | `/career/finance?tab=budget` | tab | occasional |
| CLB-06d | Tab · Huvudbok (ledger) | `/career/finance?tab=ledger` | tab | rare |
| CLB-06e | Tab · Lönekontrakt | `/career/finance?tab=wages` | tab | occasional |
| CLB-06f | Tab · Prognos | `/career/finance?tab=forecast` | tab | rare |
| MGR-01 | Karriär (manager career) | `/career/manager` | page | occasional |
| MGR-01a | Tab · Profil och historik | `/career/manager` | tab | occasional |
| MGR-01b | Tab · Jobbmarknaden | `/career/manager?tab=jobs` | tab | occasional |
| MGR-01c | Dismissed / unemployed hero state | `/career/manager` | state | rare |
| MGR-02 | Historik | `/career/history` | page | occasional |
| MGR-02a | Season selector tabs | `/career/history?season=` | tab | occasional |
| MGR-03 | Säsongen (season hub) | `/career/season` | page | frequent |
| MGR-03a | SM-slutspel / Kval / Cup sections | `/career/season` | panel | occasional |
| MGR-03b | Season verdict & awards gala | `/career/season` | state | rare |
| MGR-04 | Momentbiblioteket (moment library) | `/career/moments` | page | internal |
| WLD-01 | Inkorg (Inbox) | `/career/inbox` | page | core |
| WLD-01a | Inbox filters | `/career/inbox` | panel | frequent |
| WLD-01b | Message reader + empty states | `/career/inbox?message=` | panel | core |
| WLD-02 | Mediecentret (Media) | `/career/media` | page | frequent |
| WLD-02a | Tab · Nyheter (feed) | `/career/media` | tab | frequent |
| WLD-02b | Tab · Presskonferenser | `/career/media?tab=press` | tab | frequent |
| WLD-02c | Tab · Rivaler | `/career/media?tab=rivals` | tab | occasional |
| WLD-02d | Tab · Disciplin | `/career/media?tab=discipline` | tab | rare |
| WLD-02e | Tab · Medierna (outlets) | `/career/media?tab=outlets` | tab | rare |
| WLD-03 | Presskonferens | `/career/media/press/[pressId]` | page | frequent |
| WLD-04 | Artikel (story) | `/career/media/story/[storyId]` | page | occasional |
| WLD-05 | Kalender | `/career/calendar` | page | frequent |
| WLD-06 | Schema (Matcher & resultat) | `/career/schedule` | page | frequent |
| WLD-06a | Preseason planner (tabs Träningsmatch / Läger-resa / Turnering) | `/career/schedule` | tab | occasional |
| WLD-06b | Schedule filter tabs | `/career/schedule` | tab | frequent |
| MED-01 | Medicinskt & Rehabilitering | `/career/medical` | page | occasional |
| MED-01a | Active injuries table / empty scene | `/career/medical` | panel | occasional |
| SYS-01 | Inställningar (in-career settings) | `/career/settings` | page | rare |
| SYS-02 | Editor home (dev data editor) | `/editor` | page | internal |
| SYS-02a | Editor · players (bulk calibration table) | `/editor/players` | page | internal |
| SYS-02b | Editor · player detail | `/editor/players/[playerId]` | page | internal |
| SYS-02c | Editor · rating review roster | `/editor/ratings` | page | internal |
| SYS-02d | Editor · rating detail | `/editor/ratings/[playerId]` | page | internal |
| SYS-02e | Editor · court grid calibration | `/editor/court-grid` | page | internal |
| SYS-03 | Scenario lab (engine labs) | `/scenario-lab` | page | internal |
| SYS-03a | Scenario lab · core | `/scenario-lab/core` | page | internal |
| SYS-03b | Scenario lab · match | `/scenario-lab/match` | page | internal |
| SYS-04 | Match 2D QA harness | `/match-qa` | page | internal |
| SYS-05 | CPU-rekrytering (debug) | `/career/club/cpu-recruitment` | page | internal |
| SYS-06 | Editor mode widget (global) | `* (root layout)` | panel | internal |

## Global observations — why it feels like a "sophisticated spreadsheet"

The product already contains strong experience pieces (photo heroes, moments, brackets, a spatial clubhouse), but they sit on top of a management layer that is built from the same three primitives everywhere: **`hm-panel` + `hm-table` + label/value rows**. Concrete evidence:

1. **Density is a stated design goal.** `app/manager.css` opens with "Shared management workspaces. Intentional density". Body text is 13px (`app/game.css` `--hm-text-base: 13px`), tables 12px with 10px headers (`.hm-table`, `.hm-table th`), nav items 12px and nav group labels 9px (`.hm-nav-item`, `.hm-nav-group-label`), the context bar 11px. There are about **333 rules declaring 9–11px font sizes** across the CSS. `hm-table` is used about 161 times in TSX. Most "secondary" pages (partnerships, other club, history, schedule, medical, finance ledger and forecast) are mainly stacks of tables.
2. **Flat, deep information architecture.** The sidebar has **27 Level‑1 destinations** (28 with Editor) in one list with six injected labels (`lib/career/navigation.ts`, `components/GameShell.tsx` `NAV_GROUP_LABELS`). The "Klubben" group alone has 11 unrelated items. Several destinations overlap: Kalender/Schema; Säsongen/Tävlingar/Svenska Cupen; Spelarsök/Scouting/Rekrytering/Transfers; Klubb/Klubbhuset; Historik/Karriär. News lives in three places (Dashboard, Inkorg, Media). Around this sit extra navigation layers: the STARKVIS host bar, the breadcrumb/back-forward context bar, Klubbhuset's room map and in-page tabs. That makes 4–5 overlapping ways to move around.
3. **Icons don't carry meaning.** `NavIcon` has 22 glyphs for 27 items, so icons get reused: `schedule` for Kalender, Schema and Historik; `competitions` for Säsongen, Tävlingar and Svenska Cupen; `scouting` for Spelarsök and Scouting; `transfers` for Kontrakt and Transfers; `analysis` for Analys and Statistik.
4. **Typography has no voice on most screens.** `--game-font-display` is a Windows system stack ("Bahnschrift SemiCondensed" → "Franklin Gothic Medium" → "Arial Narrow" → "Impact"). No web font is loaded (no `@font-face` or `next/font` found), so on macOS, iOS and Android the display face falls back to Arial Narrow/Impact or a generic sans. The display face appears mostly in heroes and overlines. Panel titles are 13px/600 sans (`.hm-panel-title`).
5. **The colour system is muted and split three ways.** The palette is paper `#f3f1ea`, ink `#131b26`, navy sidebar and one signal orange `#c84320`. It is defined three times with conflicting values: `app/tokens.css` (`--hm-accent-strong:#e0532c`, `--hm-text-base:.875rem`), `app/game.css :root` (`--hm-accent-strong:#aa3216`, `--hm-text-base:13px`) and `app/legacy.css`. Club colours reach only a few surfaces through `clubColorVars()` (dashboard, Klubbhuset `--kh-club`). Status relies on small 10px badges (`.hm-badge`). The processing overlay even hard-codes navy for the club crest (`ContinueProcessingOverlay.tsx`, `primaryColor="#121d31"`).
6. **Inline styling bypasses the system.** There are about **757 `style={{…}}` occurrences** in TSX under `app/` and `components/`. Examples: the title-screen crest row, the dashboard hero, `FinanceRow` and the economy rail in `app/career/club/page.tsx`, `inputStyle` and radio cards in `partnerships/page.tsx`, the badge in the press page. CSS is spread over **29 files (~8,100 lines)** with about 20 different ad-hoc breakpoints (640/680/700/760/900/1000/1050/1100/1200/1250/1280/1500/1700/2100/2200 px).
7. **Few people and little imagery in the management layer.** Players appear as jersey/initial glyphs (`PlayerGlyph`, `JerseyGlyph` in `components/game/Identity.tsx`). Staff appear as initials (`StaffMark`). The manager has no avatar (initials on the new-game pass). Board members, journalists and rivals have no faces. Crests are **procedural SVG shields** (`components/ClubCrest.tsx` + `components/crests/clubIdentity.ts`, with 7 shapes, patterns and motifs from club colours). No licensed crest is registered: `components/crests/assets/` contains only a README and `CREST_SOURCES` lists reuse status as non-free or no-licence.
8. **Emotional moments exist but are islands.** `components/experience/Moment.tsx` (`MomentHero`, `EventCard`, `DecisionCard`, stamps) and the primitives (`MeterBar`, `ValueFlow`, `RouteLine`, `ProgressSteps`) are good. They are used on the Board, Manager, Media, Season and Klubbhuset pages. The core loop does not use them: the dashboard body, Inbox, Schedule, Calendar and the Continue overlay are text and tables. The only catalogue of them is the unlinked dev page `/career/moments`.
9. **The core loop button is crowded.** The header puts four save/export/import buttons beside the contextual Continue button (`CareerSaveControl.tsx`). The game clock (date and next event) is 12px muted text. The "world advances" overlay lasts about 1 second and is all text.
10. **Mobile is a shrunken desktop.** On phones the 27-item sidebar becomes a left drawer (`game.css` ≤760px). There is no bottom navigation. Global search is hidden (`manager.css`). The calendar grid becomes ~1,015px wide and scrolls sideways (`squad-season.css` `repeat(7, minmax(145px,1fr))`). Klubbhuset relies on double-click and hover. Two rule sets set the mobile sidebar (`manager.css` 150px column vs `game.css` off-canvas).

### Existing visual assets (reusable for the redesign)

All are WebP, in pairs of 1920/960 (~1.6 MB total):

- **Environment photos** (`components/clubhq/assets/environments/`, registered in `components/clubhq/environments.ts`, ten of them): arena-club, arena-matchday, dressing-room, tactical-room, manager-office, boardroom, press-room, training-hall, scouting-office, medical-room.
  - Used by: dashboard hero, Klubbhuset stage/cards, `EnvironmentBanner` (squad, tactics, training, medical), Board/Manager (`BOARDROOM_BACKDROP`), Media/Press (`PRESSROOM_BACKDROP`), Matchday (`ARENA_BACKDROP`), Scouting (`SCOUTING_BACKDROP`).
- **Moment photos:**
  - `components/experience/assets/court-moment` (`COURT_MOMENT_BACKDROP`, Blender-rendered 40×20 court)
  - `components/season/assets/trophy-moment` (`TROPHY_MOMENT_BACKDROP`)
  - `components/transfers/assets/negotiation-room` and `deal-signed`
  - `components/players/assets/departure-moment`
- **Present but apparently unreferenced** (no import found in TS/TSX/CSS):
  - `components/board/assets/boardroom-moment`
  - `components/media/assets/pressroom-moment`
  - `components/matchday/assets/arena-moment`
  - `components/scouting/assets/scouting-moment`
  - `components/clubhq/assets/klubbhuset-local/pro/elite`. These three are imported only by `components/clubhq/ClubHq.tsx`, which nothing imports. They are tiered clubhouse images that match the economy tiers and are ready for a "facility grows with the club" visual.
- **Vector/procedural:**
  - procedural club crests (`ClubCrest`, 7 shapes)
  - `NationFlag` SVGs (225 lines)
  - `CompetitionMark` per competition (HBL/SM/KVAL/CUP) with `competitionStyle()` colours
  - `CourtBackdrop` court-line SVG
  - Klubbhuset floorplan court SVG
  - finance charts (`FinanceCharts.tsx`)
  - board confidence sparkline
  - `FormDots`
  - jersey/player glyphs
- **No:** player photos, staff/manager/board/journalist portraits, licensed club crests, arena photos per club, or a web font.

## Unexamined / uncertain

- **Nothing was rendered in a browser.** All desktop/mobile notes come from CSS and TSX. Visual overlap is inferred, not observed: the floating feedback button vs the sidebar footer, the STARKVIS host bar's auto-hide timing, how the mobile drawer and `manager.css` 150px rule resolve, and inbox behaviour on phones.
- **Not read line by line:**
  - Finance sub-tab internals: the budget reallocation UI (`Budget`), the ledger month selector.
  - Season `Movement`/`NextStep` branches.
  - Media `Rivals`/`discipline`/`outlets` markup beyond structure.
  - Manager job-market vacancy/application controls.
  - `PreseasonPlanner` camp/tournament forms.
  - `ClubHero`/`MatchHero` internals in `components/game/Identity.tsx`.
  - The `lib/clubhq/clubhq.ts` room metric definitions.
- **Internal tools were inventoried briefly only:** editor pages, scenario-lab pages, match-qa. Statements that `/scenario-lab`, `/match-qa` and `/career/club/cpu-recruitment` have no gate come from source grep. They are not verified against deployment config (e.g. `wrangler.jsonc` routes or middleware).
- **"Apparently unreferenced" assets** were checked by grep for file names and imports. Dynamic references were not traced exhaustively.
- **Count accuracy:** the numbers for inline styles (~757), small-font rules (~333) and `hm-table` uses (~161) come from regex counts. They include internal tools and out-of-scope pages, so treat them as orders of magnitude.
- **Part B routes** are only referenced, not analysed: squad, contracts, compare, players, recruitment, staff, training, tactics, scouting, transfers, competitions, statistics, analysis, fixtures, match-preview, match-day, match-report, match-2d, match-center, matches.


## Surfaces

### ENT-01 · Alpha access gate

- **Route:** `* (all routes, root layout)`  
- **Kind:** overlay · **Importance:** occasional · **Domain:** ENT
- **Components:** `app/layout.tsx`, `components/AlphaAccessGate.tsx`, `components/alpha.css`
- **Purpose:** Blocks the whole app until a tester enters the alpha access code (stored in localStorage).
- **Structure:** Centred card (eyebrow 'Tidig testversion', H1 'Handball Manager Alpha', one text input, one button). Children stay unmounted while checking ('Kontrollerar åtkomst…').
- **Desktop:** Centred card on page background.
- **Mobile:** Same card; no specific mobile rules in alpha.css (0 media queries).

**Main actions**

- Enter access code
- Unlock

**Strengths**

- Accessible form (label, aria-invalid, role=alert error)
- Children not mounted until verified, no flash of content

**Weaknesses**

- Default code is hard-coded in client bundle (HBL-ALPHA-2026) — gate is cosmetic
- Plain utility card, no brand/club imagery; first impression of the product is a form
- No explanation of what the alpha is or how to get a code

**Links to**

`ENT-02`

**Redesign opportunities**

- Fold into a branded splash (arena image already exists) instead of a bare form
- Remove entirely for public builds; keep as env-gated wrapper

### ENT-02 · Title screen (Huvudmeny)

- **Route:** `/`  
- **Kind:** page · **Importance:** frequent · **Domain:** ENT
- **Components:** `app/page.tsx`, `components/ClubCrest.tsx`, `app/game.css (.game-title)`
- **Purpose:** Entry point: start a new career, continue the most recent save, load a save, open device settings.
- **Structure:** Two-column hero: left has tagline, big HANDBALL MANAGER wordmark and a row of 12 procedural club crests (36px); right is a vertical stack of 4 large text buttons with sublabels. A faint SVG court outline sits behind. Footer string 'GAME EXPERIENCE v2 …'.
- **Desktop:** Full-bleed dark title (host shell header hidden via .app-shell:has(.game-title)).
- **Mobile:** At ≤760px collapses to one column, h1 64px, padding 8vw (game.css ~L1725).

**Main actions**

- NYTT SPEL
- FORTSÄTT (most recent save)
- LADDA SPEL
- INSTÄLLNINGAR

**Strengths**

- Clear primary verbs with helpful sublines (Continue shows manager · club · date)
- Uses club colours/crests to signal 'Swedish handball'
- Error from save storage surfaced with role=alert

**Weaknesses**

- No photography although arena/court renders exist; the 'court' is a 2px #eee outline
- Inline styles for the crest row (style={{…}}) rather than design-system classes
- Continue button only shows the single most recent save; no preview of club/season state
- Footer 'GAME EXPERIENCE v2' is internal jargon visible to players

**Links to**

`ENT-03`, `ENT-04`, `ENT-05`, `DSH-01`

**Redesign opportunities**

- Make it a living 'club select' stage: last save's club crest/colours + arena env image as backdrop
- Show 'what happened since you left' for Continue
- Ambient motion (crest wall, arena lights)

### ENT-03 · New game wizard

- **Route:** `/new-game`  
- **Kind:** page · **Importance:** frequent · **Domain:** ENT
- **Components:** `app/new-game/page.tsx`, `components/game/CareerEntryFrame.tsx`, `components/game/career-entry.css`, `components/game/NationFlag.tsx`, `components/ClubCrest.tsx`, `components/crests/clubIdentity.ts`, `lib/newGame/clubSelectionContext.ts`
- **Purpose:** Six-step career setup: nations → leagues → database summary → club → manager → preseason/start.
- **Structure:** Three-zone CareerEntryFrame: left rail = numbered step list (01–06 with notes), centre = step content (choice-card grids), right = live context column (selected club crest 126px, club facts dl, manager pass, world summary counters), sticky footer with Back/hint/Next.
- **Desktop:** Three columns (rail / content / context).
- **Mobile:** career-entry.css has 6 media queries; rail and context stack (exact order unverified in browser).

**Main actions**

- Toggle nations
- Toggle leagues
- Pick club
- Enter manager name/nationality/DOB
- Choose preseason start (8/6/4/2 weeks or first match)
- STARTA KARRIÄR
- Back / Next
- Open settings

**Strengths**

- Strong wizard scaffolding with persistent context column — the user always sees the club they are about to lead
- Club cards show forecast ('Tips: 5:a · expectation') and heritage tag
- Focus management on step change, aria-live hint, validation messages
- Preseason options show computed dates

**Weaknesses**

- Steps 1–3 (nations/leagues/'Databas') are configuration chores before the emotional choice (club); 'Databas' step is a pure summary screen
- Only Swedish clubs are playable, yet the flow starts with a multi-nation picker
- Club grid is text-heavy cards with 48px procedural crests; no arena/town imagery
- Manager creation is three form fields; no portrait/avatar or style choice

**Links to**

`ENT-02`, `ENT-05`, `ENT-12`, `DSH-01`

**Redesign opportunities**

- Lead with the club ('Välj din hemmaplan') and make leagues/nations an advanced drawer
- Club cards as visual tiles: colour field, crest, arena, expectation meter
- Manager card as a collectible 'pass' with chosen archetype
- A cinematic 'first day' handover instead of the generic init screen

### ENT-03a · Step 1 · Nationer

- **Route:** `/new-game (step 0)`  
- **Kind:** panel (parent ENT-03) · **Importance:** occasional · **Domain:** ENT
- **Components:** `app/new-game/page.tsx`
- **Purpose:** Select handball nations included in the career world.
- **Structure:** Grid of checkbox cards (flag + code, nation name, '#ligor i urvalet', ✓ Vald / + Välj) plus a note card.
- **Desktop:** Card grid
- **Mobile:** Stacks

**Main actions**

- Toggle nation checkbox cards

**Strengths**

- Flags give some colour

**Weaknesses**

- Low-stakes setting presented as step one

**Links to**

`ENT-03b`

**Redesign opportunities**

- Collapse into 'Världen' advanced settings

### ENT-03b · Step 2 · Ligor

- **Route:** `/new-game (step 1)`  
- **Kind:** panel (parent ENT-03) · **Importance:** occasional · **Domain:** ENT
- **Components:** `app/new-game/page.tsx`
- **Purpose:** Select competitions per nation.
- **Structure:** Per-nation sections of league cards (tier number '01', name, '#klubbar', '# spelbara klubbar'). Empty state note when no playable club.
- **Desktop:** Grid
- **Mobile:** Stacks

**Main actions**

- Toggle league cards

**Strengths**

- Shows playable count

**Weaknesses**

- Tier shown as bare zero-padded number

**Links to**

`ENT-03c`

**Redesign opportunities**

- Pyramid visual of Swedish league system

### ENT-03c · Step 3 · Databas (summary)

- **Route:** `/new-game (step 2)`  
- **Kind:** panel (parent ENT-03) · **Importance:** rare · **Domain:** ENT
- **Components:** `app/new-game/page.tsx`
- **Purpose:** Overview of chosen nations/leagues/clubs.
- **Structure:** Four MiniStat counters + list of selected competitions + explanatory note.
- **Desktop:** Stats row + two sections
- **Mobile:** Stacks

**Main actions**

- Next

**Strengths**

- Transparent about data provenance

**Weaknesses**

- A whole step that asks nothing of the player; reads like a DB report

**Links to**

`ENT-03d`

**Redesign opportunities**

- Remove or merge into league step

### ENT-03d · Step 4 · Klubb

- **Route:** `/new-game (step 3)`  
- **Kind:** panel (parent ENT-03) · **Importance:** frequent · **Domain:** ENT
- **Components:** `app/new-game/page.tsx`, `components/ClubCrest.tsx`
- **Purpose:** Choose the playable club to manage.
- **Structure:** Toolbar with count, radio-card grid (crest 48px, name, league, city · venue, heritage tag, forecast), a <details> list of non-playable clubs.
- **Desktop:** Grid + context column
- **Mobile:** Stacked

**Main actions**

- Select club radio card
- Change league selection
- Expand 'andra klubbar' details

**Strengths**

- Most emotional step; context column updates live with arena, prediction, board expectation, squad strength vs league, economy

**Weaknesses**

- ~30 near-identical text cards; little differentiation between clubs at a glance
- Key differentiators (budget, expectation, strength) live only in the right column

**Links to**

`ENT-03e`

**Redesign opportunities**

- Map of Sweden / club wall with colour tiles; filter by ambition (survive/promote/title)

### ENT-03e · Step 5 · Manager

- **Route:** `/new-game (step 4)`  
- **Kind:** panel (parent ENT-03) · **Importance:** occasional · **Domain:** ENT
- **Components:** `app/new-game/page.tsx`, `components/game/NationFlag.tsx`
- **Purpose:** Create the manager profile.
- **Structure:** Form fields left, 'Tränarbänken' pass card right with initials monogram.
- **Desktop:** Two columns
- **Mobile:** Stacks

**Main actions**

- Name
- Nationality select
- Date of birth

**Strengths**

- Live preview pass card
- Inline validation (age 18–85)

**Weaknesses**

- Identity is just initials; no avatar/style/background choice

**Links to**

`ENT-03f`

**Redesign opportunities**

- Coaching-style archetype, appearance, backstory that later feed media/board

### ENT-03f · Step 6 · Starta (preseason)

- **Route:** `/new-game (step 5)`  
- **Kind:** panel (parent ENT-03) · **Importance:** frequent · **Domain:** ENT
- **Components:** `app/new-game/page.tsx`, `lib/career/preseason.ts`
- **Purpose:** Pick preseason length and confirm.
- **Structure:** Mandate banner (manager name + 'tar plats hos' club + crest 84px), radio grid of 5 preseason options with dates, summary dl.
- **Desktop:** Stacked sections
- **Mobile:** Stacks

**Main actions**

- Choose preseason option
- STARTA KARRIÄR

**Strengths**

- Clear consequence (first day date)

**Weaknesses**

- Mandate moment is small and text-led

**Links to**

`ENT-12`, `DSH-01`

**Redesign opportunities**

- Make this the 'signing' moment (DEAL_SIGNED backdrop already exists)

### ENT-04 · Load game (Sparade karriärer)

- **Route:** `/load-game`  
- **Kind:** page · **Importance:** frequent · **Domain:** ENT
- **Components:** `app/load-game/page.tsx`, `components/game/CareerEntryFrame.tsx`, `components/game/career-entry.css`, `components/ClubCrest.tsx`
- **Purpose:** List saved careers, preview one, open or delete it.
- **Structure:** Same three-zone frame as New Game: rail with save count; centre a 6-column table (Manager, Klubb, Säsong, Speldatum, Senast spelad, actions); right context shows selected club crest 126px, manager, facts and next match.
- **Desktop:** Three-zone frame with table.
- **Mobile:** Table inside .career-save-table-wrap (horizontal scroll likely); frame stacks.

**Main actions**

- Select save
- Ladda / Fortsätt karriären
- Ta bort (two-step inline confirm)
- Börja en ny karriär
- Back to main menu

**Strengths**

- Rich preview of selected save (next opponent, matches played)
- Inline delete confirmation row with focus return and Escape
- Distinct loading, empty ('Vilken klubb blir din?') and read-error states with retry

**Weaknesses**

- Saves rendered as a data table rather than career cards
- Raw ISO game date in table column ('2026-08-03')
- Delete is permanent with only an inline row — no undo/export prompt

**Links to**

`ENT-02`, `ENT-03`, `DSH-01`

**Redesign opportunities**

- Save slots as club-coloured cards with season progress and last result
- Offer 'export before delete'

### ENT-04a · Delete-save inline confirmation

- **Route:** `/load-game`  
- **Kind:** panel (parent ENT-04) · **Importance:** rare · **Domain:** ENT
- **Components:** `app/load-game/page.tsx (SaveRows)`
- **Purpose:** Confirm permanent deletion of a save.
- **Structure:** Extra full-width table row with question, club · date, two buttons.
- **Desktop:** Inline row
- **Mobile:** Inline row

**Main actions**

- Behåll karriären
- Ta bort karriären

**Strengths**

- Keyboard-safe (focus on cancel, Esc cancels)

**Weaknesses**

- Visually just another table row

**Links to**

—

**Redesign opportunities**

- Proper confirm dialog with consequences and export option

### ENT-04b · Load game: loading / empty / error states

- **Route:** `/load-game`  
- **Kind:** state (parent ENT-04) · **Importance:** occasional · **Domain:** ENT
- **Components:** `app/load-game/page.tsx`
- **Purpose:** Feedback while reading IndexedDB, when no saves exist, or on failure.
- **Structure:** Text blocks in centre column with overline + heading + paragraph; context column swaps to matching copy.
- **Desktop:** Centre column
- **Mobile:** Stacks

**Main actions**

- Försök igen
- Skapa en karriär

**Strengths**

- Warm, on-brand copy

**Weaknesses**

- No skeletons; text only

**Links to**

`ENT-03`

**Redesign opportunities**

- Skeleton save cards

### ENT-05 · Settings (from main menu)

- **Route:** `/settings`  
- **Kind:** page · **Importance:** occasional · **Domain:** ENT
- **Components:** `app/settings/page.tsx`, `components/settings/GlobalPreferences.tsx`, `components/settings/settings.css`
- **Purpose:** Device-level preferences outside a career: display currency and default match speed.
- **Structure:** Simple header + three plain sections (Valuta radiogroup styled as subnav links, Matchhastighet select, explanatory 'Karriärens världsinställningar').
- **Desktop:** Single column
- **Mobile:** settings.css has 3 media queries

**Main actions**

- Choose currency (EUR/SEK)
- Choose default match speed
- ← Huvudmeny

**Strengths**

- Honest scope: only settings that do something

**Weaknesses**

- Different UI from in-career settings (SYS-01) for the same currency preference
- Currency radio implemented as <a href='#…' role=radio> links
- No audio/accessibility/text-size/theme options

**Links to**

`ENT-02`

**Redesign opportunities**

- One settings surface shared in and out of career
- Add text size / density / reduced motion toggles (density relevant to 'spreadsheet' feel)

### ENT-06 · Host shell (STARKVIS navbar)

- **Route:** `* (root layout)`  
- **Kind:** nav · **Importance:** frequent · **Domain:** ENT
- **Components:** `app/app-shell/HostNavigation.tsx`, `app/app-shell/StarkvisAppShell.tsx`, `app/app-shell/WebsiteNavbar.tsx`, `app/app-shell/shell.css`
- **Purpose:** Portfolio-site navbar injected in a shadow root on top of the game ('Handball Manager · LAB', '← Tillbaka till Apps', app switcher).
- **Structure:** Fixed 160px-high shadow-DOM layer at z-index 2147483000 with an 8px reveal edge; sets --sv-shell-offset on <html> when revealed.
- **Desktop:** Top overlay
- **Mobile:** Single-column app groups ≤767px

**Main actions**

- Reveal via top edge / button
- Return to Apps
- Switch app
- Hide

**Strengths**

- Isolated in shadow DOM; auto-hide behaviour; reduced-motion respected

**Weaknesses**

- Non-game chrome ('LAB', 'Apps') competes with the game's own header and breaks immersion
- Initial state visible=true — on first load it overlays the game header (behaviour after timeout not verified)
- Teal #00c2b3 accent unrelated to game palette

**Links to**

`external Apps hub`

**Redesign opportunities**

- Hide entirely inside career, or reduce to a single unobtrusive corner affordance

### ENT-07 · Career shell · sidebar navigation

- **Route:** `/career/* (layout)`  
- **Kind:** nav · **Importance:** core · **Domain:** ENT
- **Components:** `app/career/layout.tsx`, `components/GameShell.tsx`, `lib/career/navigation.ts`, `components/NavIcon.tsx`, `app/game.css (.hm-sidebar)`, `app/manager.css`
- **Purpose:** Primary navigation for every career screen.
- **Structure:** Dark navy 232px sidebar: HM monogram wordmark, club badge (crest 64px + name + league), then ONE flat list of 27 links with 6 group labels injected before specific items: 'Din säsong' (Hem, Klubbhuset, Inkorg, Media), 'Laget' (Trupp, Kontrakt, Taktik, Träning), 'Match & kalender' (Kalender, Schema, Analys), 'Spelarvärlden' (Spelarsök, Scouting, Rekrytering, Transfers), 'Klubben' (Personal, Medicinskt, Klubb, Styrelsen, Karriär, Ekonomi, Säsongen, Tävlingar, Svenska Cupen, Statistik, Historik), 'Spelet' (Inställningar). Footer: manager name + 'Sparade karriärer →'. Inbox badge shows unread count.
- **Desktop:** Persistent left rail, scrolls when 27 items exceed viewport height.
- **Mobile:** ≤760px becomes an off-canvas drawer (ENT-07a).

**Main actions**

- Navigate to 27 destinations (28 with Editor)
- Open Sparade karriärer

**Strengths**

- Single source of truth (CAREER_NAV_ITEMS) with prefix ownership so nested routes highlight correctly
- Unread badge on Inbox
- Club identity always visible

**Weaknesses**

- 27 top-level items — no hierarchy, everything is Level 1
- 'Klubben' group holds 11 unrelated items (medical, board, manager career, finance, season, competitions, cup, statistics, history)
- Overlapping destinations: Kalender vs Schema; Säsongen vs Tävlingar vs Svenska Cupen; Spelarsök vs Scouting vs Rekrytering vs Transfers; Klubb vs Klubbhuset; Historik vs Karriär
- Icons reused for different items (schedule ×3: Kalender/Schema/Historik; competitions ×3; scouting ×2; transfers ×2; analysis ×2) — icons stop carrying meaning
- Labels 12px, group labels 9px uppercase (manager.css .hm-nav-group-label) — very small
- Klubbhuset (spatial hub of 11 rooms) duplicates the sidebar instead of replacing it

**Links to**

`DSH-01`, `CLB-01`, `WLD-01`, `WLD-02`, `/career/squad`, `/career/contracts`, `/career/tactics`, `/career/training`, `WLD-05`, `WLD-06`, `/career/analysis`, `/career/players`, `/career/scouting`, `/career/recruitment`, `/career/transfers`, `/career/staff`, `MED-01`, `CLB-02`, `CLB-05`, `MGR-01`, `CLB-06`, `MGR-03`, `/career/competitions`, `/career/competitions/se-svenska-cupen-herr`, `/career/statistics`, `MGR-02`, `SYS-01`, `ENT-04`

**Redesign opportunities**

- Collapse to 6–7 hubs (Hem, Laget, Match, Marknad, Klubben, Värld, Karriär) with in-hub tabs
- Merge Kalender+Schema, Säsongen+Tävlingar+Cup, Spelarsök+Scouting+Rekrytering
- Let Klubbhuset or the Dashboard be the spatial hub; sidebar becomes compact icons
- Distinct icon per destination

### ENT-07a · Mobile nav drawer

- **Route:** `/career/*`  
- **Kind:** drawer (parent ENT-07) · **Importance:** core · **Domain:** ENT
- **Components:** `components/GameShell.tsx (navOpen)`, `app/game.css (@media max-width:760px)`
- **Purpose:** Phone access to the sidebar; also hosts the save controls on phones.
- **Structure:** Same 27-item sidebar slides in from left (min(84vw,300px)), scrim behind; closes on navigation and Escape. Save controls duplicated into the drawer footer.
- **Desktop:** Hidden
- **Mobile:** Primary navigation

**Main actions**

- ☰ open / ✕ close
- Scrim click / Esc to close
- Save/export/import inside drawer

**Strengths**

- Proper 44px toggle target, Esc handling, reduced-motion variant

**Weaknesses**

- A 27-item scrolling drawer is the only navigation on phones; no bottom tab bar
- No focus trap inside the open drawer (not found in source)
- manager.css also sets a 150px sidebar column at ≤760px — two conflicting mobile rules (game.css wins by load order, unverified)

**Links to**

`ENT-07`

**Redesign opportunities**

- Bottom tab bar with 4–5 hubs + 'Mer'
- Continue button as a thumb-reachable FAB

### ENT-08 · Career top bar (header)

- **Route:** `/career/*`  
- **Kind:** nav (parent ENT-07) · **Importance:** core · **Domain:** ENT
- **Components:** `components/GameShell.tsx`, `components/manager/GlobalSearch.tsx`, `components/CareerSaveControl.tsx`, `lib/career/contextualContinueAction.ts`, `app/game.css (.hm-header, .game-continue)`
- **Purpose:** Club/season title, current date & next event (or live-match banner), global search, save controls and the contextual Continue button.
- **Structure:** Left: club name / season and a subline 'date · Nästa: date'. Middle: search input. Right: four small save buttons in a row, then the large orange primary Continue button with a small uppercase sublabel.
- **Desktop:** Single row header.
- **Mobile:** Wraps; only 'Spara' remains (others moved to drawer), Continue shrinks to min-width 92px; search hidden.

**Main actions**

- Search players/clubs/competitions
- Spara
- Spara och avsluta
- Exportera sparafil
- Importera sparafil
- Continue (contextual)

**Strengths**

- Continue is context-aware (Fortsätt / Förbered match / Starta match / Återgå till match / Presskonferens / Styrelsemöte / Säsong klar) with tooltip and aria-label
- Live match banner replaces date line when you navigate away from an in-progress match

**Weaknesses**

- Four save/export/import buttons permanently in the header compete with Continue (file-management in the game's most valuable real estate)
- Date + next-event is plain small text — the game clock, the core of a manager game, has no visual weight
- Search only appears as input; ≤760px it is hidden entirely (manager.css .hm-global-search display:none)

**Links to**

`ENT-08a`, `ENT-08b`, `ENT-10`

**Redesign opportunities**

- Turn the date into a 'calendar clock' widget with next-event countdown
- Move save/export/import to a menu
- Make Continue the hero control with preview of what will happen

### ENT-08a · Global search results dropdown

- **Route:** `/career/*`  
- **Kind:** panel (parent ENT-08) · **Importance:** frequent · **Domain:** ENT
- **Components:** `components/manager/GlobalSearch.tsx`, `lib/career/management.ts (searchManagement)`
- **Purpose:** Jump to players, clubs, competitions.
- **Structure:** Absolute dropdown under input with up to 12 text links (kind + name).
- **Desktop:** Dropdown
- **Mobile:** Hidden

**Main actions**

- Type ≥2 chars
- Select result

**Strengths**

- Fast cross-entity jump

**Weaknesses**

- Text-only results, no crest/face
- No keyboard arrow navigation found (16-line component)
- Unavailable on mobile

**Links to**

`/career/squad/[playerId]`, `CLB-04`, `/career/competitions/[id]`

**Redesign opportunities**

- Command palette (Ctrl+K) incl. actions ('Gå till taktik')

### ENT-08b · Save controls

- **Route:** `/career/*`  
- **Kind:** panel (parent ENT-08) · **Importance:** frequent · **Domain:** ENT
- **Components:** `components/CareerSaveControl.tsx`
- **Purpose:** Manual save, save & exit, export/import JSON backups.
- **Structure:** Row of 4 .hm-btn-sm buttons + inline status text (role=status / alert).
- **Desktop:** Header row
- **Mobile:** Drawer footer

**Main actions**

- Spara
- Spara och avsluta
- Exportera sparafil
- Importera sparafil

**Strengths**

- Clear success/error feedback

**Weaknesses**

- Import of a file from the header of a running career is a destructive action with no confirm
- Developer-ish 'sparafil (.json)' language in a game header

**Links to**

`ENT-02`

**Redesign opportunities**

- Autosave indicator + overflow menu

### ENT-09 · Context bar (breadcrumb row)

- **Route:** `/career/*`  
- **Kind:** nav (parent ENT-07) · **Importance:** frequent · **Domain:** ENT
- **Components:** `components/GameShell.tsx (.hm-context-bar)`, `app/manager.css`
- **Purpose:** Back/forward buttons, breadcrumb 'Kontoret / <section>', unread messages link.
- **Structure:** Thin 11px muted row above every page with two ghost arrow buttons, a two-level breadcrumb and an unread link at the right.
- **Desktop:** Row
- **Mobile:** Wraps

**Main actions**

- ← back
- → forward
- Kontoret
- N olästa meddelanden

**Strengths**

- Always offers a way back from deep Level-3 routes

**Weaknesses**

- Duplicates browser back/forward
- Breadcrumb is always two levels ('Detalj' fallback) — doesn't reflect real depth
- Naming drift: sidebar says 'Hem', breadcrumb says 'Kontoret', dashboard says 'MANAGERNS KONTOR'
- Unread count duplicated (sidebar badge + this row)

**Links to**

`DSH-01`, `WLD-01`

**Redesign opportunities**

- Replace with real hierarchical breadcrumb or remove in favour of hub tabs

### ENT-09a · Progression notice (after Continue)

- **Route:** `/career/*`  
- **Kind:** panel (parent ENT-09) · **Importance:** core · **Domain:** ENT
- **Components:** `components/GameShell.tsx`, `components/game/progressionPresentation.ts`, `components/game/game-feedback.css`
- **Purpose:** Tells the manager why time stopped and links to the event.
- **Structure:** Aside banner at top of main: bold title, detail paragraph, one button, close ×.
- **Desktop:** Banner
- **Mobile:** Banner

**Main actions**

- Action link (e.g. 'Till matchen')
- × dismiss

**Strengths**

- Explains stop reason; matchday notice auto-hides once match played

**Weaknesses**

- Looks like a generic alert; competes with page heroes

**Links to**

`WLD-01`, `CLB-05`, `/career/match-preview`

**Redesign opportunities**

- Turn into a 'news ticker / event card' with imagery per event type

### ENT-10 · Continue / advance-day flow

- **Route:** `/career/*`  
- **Kind:** panel (parent ENT-08) · **Importance:** core · **Domain:** ENT
- **Components:** `components/GameShell.tsx (handleContinue)`, `lib/career/contextualContinueAction.ts`, `lib/career/CareerContext.tsx (continueCareer)`
- **Purpose:** The heartbeat of the game: advance the calendar until something needs the manager, or route to the blocking task.
- **Structure:** One primary button; if the action has targetHref it navigates, otherwise runs continueCareer() then shows ENT-10a for ≥1 processed day, then navigates to notice.navigateHref and shows ENT-09a.
- **Desktop:** Header right
- **Mobile:** Header right, compact

**Main actions**

- Fortsätt »
- Förbered match
- Starta match
- Återgå till match
- Presskonferens
- Styrelsemöte (SVAR KRÄVS)
- Säsong klar (disabled)

**Strengths**

- Hard invariants (never advances a live match or a completed season)
- Blocking decisions are surfaced by label (DECISION_BLOCKED)

**Weaknesses**

- Button may silently navigate elsewhere instead of advancing — mental model shifts with state
- No preview of how far time will move before pressing

**Links to**

`ENT-10a`, `ENT-09a`, `/career/tactics`, `/career/match-preview`, `/career/match-day/[fixtureId]`, `WLD-02b`, `CLB-05`, `WLD-01`

**Redesign opportunities**

- 'Next up' strip showing the queue (training, match in 3 days, deadline) under the button
- Distinct visual states per action kind

### ENT-10a · Continue processing overlay ('Världen går vidare.')

- **Route:** `/career/*`  
- **Kind:** overlay (parent ENT-10) · **Importance:** core · **Domain:** ENT
- **Components:** `components/ContinueProcessingOverlay.tsx`, `components/game/game-feedback.css`
- **Purpose:** Day-by-day replay of an already committed advance, then hands over to the stop reason.
- **Structure:** Modal <dialog>: header with crest (hard-coded navy #121d31 instead of club colour) + club · season + H2; body left = current date ticker, last 12 day numbers revealing, 'N dagar … träningsdagar', up to 5 highlight events; right = stop-reason card; footer hint text.
- **Desktop:** Centred dialog
- **Mobile:** game-feedback.css has 2 media queries

**Main actions**

- Visa händelsen → (skip)
- Esc to skip

**Strengths**

- Gives time passage a felt rhythm; bounded duration (≤ ~0.9s + 0.5s)
- Accessible: aria-live date, Esc skip, focus via showModal

**Weaknesses**

- Crest ignores club primary colour (primaryColor='#121d31')
- Purely textual; no imagery per event type
- Very short — little anticipation for big events

**Links to**

`ENT-09a`

**Redesign opportunities**

- Signature 'time passes' moment: calendar flip, event cards with photos (env images), match-day build-up

### ENT-11 · Feedback / bug report modal

- **Route:** `* (root layout)`  
- **Kind:** modal · **Importance:** occasional · **Domain:** ENT
- **Components:** `components/FeedbackModal.tsx`, `components/alpha.css`
- **Purpose:** Alpha testers download their save and get a feedback link.
- **Structure:** Fixed bottom-left floating button (z-index 200) opening a native <dialog> card with description, download button, status message, link, close.
- **Desktop:** Floating button + dialog
- **Mobile:** Same; max-width calc(100vw-24px)

**Main actions**

- Open via floating 'Rapportera bugg / Feedback' button
- Ladda ner sparafil (.json)
- Skicka feedback (link)
- Stäng

**Strengths**

- Native dialog, focus restore, clear failure copy

**Weaknesses**

- Floating button is on every screen incl. title and match, bottom-left — overlaps the sidebar footer area on desktop (likely, not verified visually)
- No in-app text field; feedback goes out-of-band

**Links to**

—

**Redesign opportunities**

- Move into a help/overflow menu; capture screenshot + note in-app

### ENT-12 · Career initialization / loading / error screen

- **Route:** `/career (layout) & /new-game`  
- **Kind:** state · **Importance:** frequent · **Domain:** ENT
- **Components:** `components/game/CareerInitialization.tsx`, `components/game/career-initialization.css`, `app/career/layout.tsx`
- **Purpose:** Full-screen state while a career is created or opened (IndexedDB), and failure screen.
- **Structure:** Brand mark, big uppercase H1 ('BYGGER DIN HANDBOLLSVÄRLD…' / 'ÖPPNAR DIN KARRIÄR…' / 'KUNDE INTE ÖPPNA KARRIÄREN'), club crest 112px aside, elapsed seconds after 6s, footer tagline.
- **Desktop:** Full screen
- **Mobile:** 2 media queries

**Main actions**

- Tillbaka och försök igen / Till huvudmenyn (on failure)

**Strengths**

- Honest progress (elapsed time, no fake %)
- Club identity shown while loading

**Weaknesses**

- Static text; no imagery despite arena assets

**Links to**

`ENT-02`, `DSH-01`

**Redesign opportunities**

- Use club's arena env image + tips/club facts while loading

### ENT-13 · Live-match banner (header subline)

- **Route:** `/career/* (when away from live match)`  
- **Kind:** state (parent ENT-08) · **Importance:** occasional · **Domain:** ENT
- **Components:** `components/GameShell.tsx (liveMatchBanner)`, `lib/liveMatch/liveMatchView.ts`
- **Purpose:** Remind that a match is in progress and show score/clock.
- **Structure:** Replaces the date subline with 'MATCH PÅGÅR · HAM 7–5 SKA · 13:00' text.
- **Desktop:** Header subline
- **Mobile:** Ellipsised

**Main actions**

- Continue button becomes 'Återgå till match'

**Strengths**

- Correct, reuses live selector

**Weaknesses**

- Only a 12px text line — easy to miss

**Links to**

`/career/match-day/[fixtureId]`

**Redesign opportunities**

- Persistent mini scoreboard pill with pulsing live dot

### DSH-01 · Dashboard · Managerns kontor (Hem)

- **Route:** `/career`  
- **Kind:** page · **Importance:** core · **Domain:** DSH
- **Components:** `app/career/page.tsx`, `components/game/Identity.tsx (MatchHero, ClubHero, RankIndicator, PlayerCell, clubColorVars)`, `components/game/WeeklyManagerOverview.tsx`, `components/manager/Workspace.tsx (EmptyState, FixtureTable)`, `components/experience/primitives.tsx (MeterBar)`, `components/clubhq/environments.ts`, `components/FormDots.tsx`, `app/game.css (.game-home*)`
- **Purpose:** Home: next match, league position, squad availability, decisions, news, weekly plan, board, rivals, other results.
- **Structure:** Photo hero (manager-office env image) with crest 64px + club name; then next-match hero + league card; then a 3-column body with ~11 sections: Laget inför avkast, Utanför planen, Senaste avtrycket | Från klubben, Veckans managerplan | Styrelsen, Rivalerna (mini table), På andra planer (fixture table), Nästa laginsats note. Most section bodies are lists of text lines and small tables.
- **Desktop:** Hero + event row (hero + 240–300px season card) + 3-column body (1.1fr 1fr 1fr at wide).
- **Mobile:** Columns collapse to 2 then 1 (game.css ~L1678–1706); becomes a very long scroll of ~11 sections.

**Main actions**

- Förbered match
- Motståndaren
- Taktiktavla
- Välj startsju
- Planera kontrakten
- Upptäck spelare
- Din kortlista
- Open news item
- Styrelserummet
- Börja nästa säsong (season complete)
- Klubbhuset / Taktikrummet links

**Strengths**

- Covers everything the manager needs this week; every block links to its workspace
- Uses club colour vars and a real photo hero
- Season-complete variant with milestone facts and transition blockers

**Weaknesses**

- Three equal columns of ~11 text-heavy sections — no primary focus below the hero; reads as a report
- Weekly plan (WeeklyManagerOverview) alone renders day list, decisions, board, economy and feedback — duplicating the board card and news
- Many inline styles (flex/gap/colour) in the hero
- Board objectives rendered as small pills; key numbers (position, points) not visualised beyond RankIndicator
- No player faces — only PlayerCell glyphs

**Links to**

`CLB-01`, `/career/tactics`, `/career/match-preview`, `CLB-04`, `/career/competitions/[id]`, `/career/squad`, `/career/contracts`, `/career/players`, `/career/recruitment?view=SHORTLIST`, `/career/match-report/[id]`, `WLD-01`, `WLD-05`, `CLB-05`, `/career/training`, `MGR-02`, `MGR-01b`, `CLB-06`

**Redesign opportunities**

- One 'Today' focal card driven by the Continue state (what matters now)
- Card feed of events with imagery instead of three columns of lists
- Visual league ladder / form strip / squad availability ring
- Personalise by moment (matchday, transfer window, board review)

### DSH-01a · Office hero header

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** core · **Domain:** DSH
- **Components:** `app/career/page.tsx`, `components/clubhq/environments.ts (manager-office)`
- **Purpose:** Club identity banner.
- **Structure:** xp-photo-hero with manager-office photo, crest, overline 'MANAGERNS KONTOR · season', H1 club name, heritage tag; right: league, venue · capacity, two link chips.
- **Desktop:** Wide banner
- **Mobile:** Stacks

**Main actions**

- Klubbhuset →
- Taktikrummet →

**Strengths**

- Real photography + club colours

**Weaknesses**

- Purely decorative — no state (date, next event, mood)

**Links to**

`CLB-01`, `/career/tactics`

**Redesign opportunities**

- Carry live state (countdown to match, board mood)

### DSH-01b · Next match hero + league card

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** core · **Domain:** DSH
- **Components:** `components/game/Identity.tsx (MatchHero, RankIndicator)`, `components/FormDots.tsx`
- **Purpose:** Next fixture and own league standing.
- **Structure:** MatchHero (two crests, date, competition) beside an aside with rank '#/N', points/matches/GD triple and last-5 form dots. Empty: 'Inget kommande avkast.'
- **Desktop:** Hero + 240px aside
- **Mobile:** Stacks

**Main actions**

- Motståndaren
- Taktiktavla
- Förbered match
- Ligan, resultaten och rivalerna

**Strengths**

- Strongest visual block on the page

**Weaknesses**

- League card is three numbers + dots; no table context

**Links to**

`/career/match-preview`, `/career/tactics`, `CLB-04`

**Redesign opportunities**

- Countdown, opponent form, injury impact inline

### DSH-01c · Season-complete milestone & transition blockers

- **Route:** `/career (seasonComplete)`  
- **Kind:** state (parent DSH-01) · **Importance:** occasional · **Domain:** DSH
- **Components:** `app/career/page.tsx`, `lib/career/seasonRollover.ts`
- **Purpose:** End of season summary and 'Börja nästa säsong'.
- **Structure:** ClubHero + milestone section (H2 'Säsongen är i mål.', copy, three facts: final place, points, goals). Blockers shown as role=alert list with codes/refs.
- **Desktop:** Block
- **Mobile:** Stacks

**Main actions**

- Börja nästa säsong →
- Se över avtalen
- Sluttabellen

**Strengths**

- Preserves career on blocked transition

**Weaknesses**

- Blocker list exposes internal codes (b.ref)
- A season ending is a big emotional moment rendered as a text card (trophy env image unused here)

**Links to**

`/career/contracts`, `/career/competitions/[id]`, `MGR-03`

**Redesign opportunities**

- Season review ceremony (trophy-moment asset)

### DSH-01d · Contextual notices (unemployed / new season)

- **Route:** `/career`  
- **Kind:** state (parent DSH-01) · **Importance:** occasional · **Domain:** DSH
- **Components:** `app/career/page.tsx (.game-new-season-note)`
- **Purpose:** Explain special career states.
- **Structure:** Inline note strips with bold lead + link.
- **Desktop:** Strip
- **Mobile:** Strip

**Main actions**

- Jobbmarknaden →
- Se föregående säsong →

**Strengths**

- Contextual

**Weaknesses**

- Same styling for very different stakes (job loss vs new season)

**Links to**

`MGR-01b`, `MGR-02`

**Redesign opportunities**

- Tone-specific event cards

### DSH-01e · Laget inför avkast (availability)

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** core · **Domain:** DSH
- **Components:** `app/career/page.tsx`, `lib/career/management.ts`
- **Purpose:** Squad availability, match fitness, captain, top 3 issues.
- **Structure:** Big 'available/total' number + text line + up to 3 player rows (glyph + issue).
- **Desktop:** Column 1
- **Mobile:** Stacked

**Main actions**

- Hela truppen
- Välj startsju

**Strengths**

- Actionable

**Weaknesses**

- Fitness as a sentence; no visual

**Links to**

`/career/squad`, `/career/tactics`

**Redesign opportunities**

- Availability ring + position coverage court diagram

### DSH-01f · Utanför planen (contracts & radar)

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** frequent · **Domain:** DSH
- **Components:** `app/career/page.tsx`
- **Purpose:** Expiring contracts and shortlist/scouting summary.
- **Structure:** Two 'decision' rows (big count + H3 + copy + links) and 2 contract lines.
- **Desktop:** Column 1
- **Mobile:** Stacked

**Main actions**

- Planera kontrakten
- Upptäck spelare
- Din kortlista

**Strengths**

- Counts give quick read

**Weaknesses**

- Generic copy repeats every visit

**Links to**

`/career/contracts`, `/career/players`, `/career/recruitment?view=SHORTLIST`

**Redesign opportunities**

- Deadline-driven cards with player faces

### DSH-01g · Senaste avtrycket (recent results)

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** frequent · **Domain:** DSH
- **Components:** `app/career/page.tsx`
- **Purpose:** Last 3 own results.
- **Structure:** Three link rows: short names stacked + date + score; empty state copy.
- **Desktop:** Column 1
- **Mobile:** Stacked

**Main actions**

- Open match report
- Matcharkivet

**Strengths**

- Direct to report

**Weaknesses**

- No W/D/L colour, no crests

**Links to**

`/career/match-report/[id]`, `WLD-06`

**Redesign opportunities**

- Result tiles with crests and outcome colour

### DSH-01h · Från klubben (latest news)

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** frequent · **Domain:** DSH
- **Components:** `app/career/page.tsx`, `lib/career/inboxBridge.ts`
- **Purpose:** Latest 4 inbox messages.
- **Structure:** Four article lines: category · date · NYTT, bold subject, preview.
- **Desktop:** Column 2
- **Mobile:** Stacked

**Main actions**

- Open message in inbox

**Strengths**

- Deep-links to the message

**Weaknesses**

- Duplicates inbox; no priority signal

**Links to**

`WLD-01`

**Redesign opportunities**

- Merge into a single prioritised event feed

### DSH-01i · Veckans managerplan (weekly overview)

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** core · **Domain:** DSH
- **Components:** `components/game/WeeklyManagerOverview.tsx`, `lib/career/weeklyManagement.ts`
- **Purpose:** Seven-day plan, next step, decisions/deadlines, board and economy snapshot, latest feedback.
- **Structure:** Long vertical section: date range, status box, two links, 7 day lines (date + day type + sessions + fixtures), availability sentence, H3 'Beslut och tidsfrister' list, board sentence + objectives list, economy sentence, H3 feedback articles.
- **Desktop:** Column 2
- **Mobile:** Very long

**Main actions**

- Öppna nästa steg
- Justera träningsprioriteringar
- Förbered nästa match
- Open day in training
- Decision links
- Kalender

**Strengths**

- The most complete 'what's this week' summary in the game

**Weaknesses**

- Wall of text and links; duplicates board card (DSH-01j) and news (DSH-01h)
- No week visual (unlike calendar's day tiles)

**Links to**

`WLD-05`, `/career/training`, `/career/tactics`, `/career/squad`, `WLD-01`, `CLB-05`, `CLB-06`

**Redesign opportunities**

- Horizontal 7-day strip as the dashboard's spine

### DSH-01j · Styrelsen (board card)

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** frequent · **Domain:** DSH
- **Components:** `app/career/page.tsx`, `components/experience/primitives.tsx (MeterBar)`, `lib/board/board.ts`
- **Purpose:** Board confidence and top 3 objectives.
- **Structure:** MeterBar 'Förtroende n/100', pressure label sentence, three objective rows with status pills.
- **Desktop:** Column 3
- **Mobile:** Stacked

**Main actions**

- Styrelserummet →

**Strengths**

- Meter gives at-a-glance read

**Weaknesses**

- Repeated in weekly plan

**Links to**

`CLB-05`

**Redesign opportunities**

- Board mood portrait/gauge

### DSH-01k · Rivalerna + På andra planer + training note

- **Route:** `/career`  
- **Kind:** panel (parent DSH-01) · **Importance:** frequent · **Domain:** DSH
- **Components:** `app/career/page.tsx`, `components/manager/Workspace.tsx (FixtureTable)`
- **Purpose:** Top-4 + own row mini table, other results, nudge to training.
- **Structure:** 4-column mini table (#, Klubb, SM, P), fixture table of 4 other results, static training note card.
- **Desktop:** Column 3
- **Mobile:** Stacked

**Main actions**

- Ligan →
- Resultaten →
- Träningsveckan →

**Strengths**

- Compact league context

**Weaknesses**

- Static training note repeats every visit

**Links to**

`/career/competitions/[id]`, `/career/training`, `CLB-04`

**Redesign opportunities**

- Live ticker of round results

### CLB-01 · Klubbhuset (clubhouse hub)

- **Route:** `/career/klubbhuset`  
- **Kind:** page · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/klubbhuset/page.tsx`, `lib/clubhq/clubhq.ts`, `components/clubhq/environments.ts`, `components/clubhq/clubhq.css`, `components/experience/Moment.tsx (MomentHero)`, `components/experience/primitives.tsx (MeterBar)`, `lib/nationalTeam/nationalTeam.ts`
- **Purpose:** Spatial headquarters: 11 rooms (manager, dressing, tactics, hall, board, press, scouting, medical, office, staff, trophies) with status, plus identity, supporters, rivals, honours and national team windows.
- **Structure:** Arena photo MomentHero with crest; 'Anläggningen & Avdelningarna' = SVG court floorplan with absolutely-positioned room hotspots (status dot) beside a photo 'stage' of the selected room with metrics and CTA; then a gallery of 11 room cards with env photos; then 3 panels (Identitet, Läktaren/supporters meter/rivals/honours, Landslagsuppehåll).
- **Desktop:** Two-column complex (floorplan | stage), 3-col panel grid.
- **Mobile:** ≤1100px complex and grid stack; ≤680px floorplan min-height 420px; hotspots tiny on phones.

**Main actions**

- Select room on floorplan
- Double-click/enter room
- Kliv in i <room>
- Room card 'Öppna' / 'Granska'
- Open rival club

**Strengths**

- The most game-like, image-rich surface in the product (10 environment photos)
- Rooms carry live status/alert tone, so it can act as a visual hub
- Supporters mood meter and national-team calendar add world texture

**Weaknesses**

- Duplicates sidebar navigation — rooms link to the same routes; three ways to enter a room (hotspot, stage CTA, card)
- Double-click to enter + hover-to-select on cards do not translate to touch
- Floorplan is abstract boxes over a court SVG, not an illustrated building
- Not the landing page — buried as 2nd nav item

**Links to**

`DSH-01`, `/career/squad`, `/career/tactics`, `/career/training`, `CLB-05`, `WLD-02`, `/career/scouting`, `MED-01`, `CLB-06`, `/career/staff`, `MGR-03`, `CLB-04`

**Redesign opportunities**

- Make Klubbhuset the primary hub (replace half the sidebar)
- Illustrated isometric clubhouse whose rooms visibly upgrade with economy tier (assets klubbhuset-local/pro/elite already exist but are unused)
- Single tap opens room; status badges as notifications

### CLB-01a · Interactive floorplan + room stage

- **Route:** `/career/klubbhuset`  
- **Kind:** panel (parent CLB-01) · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/klubbhuset/page.tsx (.kh-blueprint, .kh-stage)`
- **Purpose:** Pick a room to preview its status.
- **Structure:** Left: blueprint header, SVG court, % positioned hotspot buttons (wing, status dot, name, status), legend; Right: photo stage with wing · department, purpose, H3, summary, metric dl, CTA.
- **Desktop:** Side by side
- **Mobile:** Stacked

**Main actions**

- Click hotspot
- Double-click to open
- Kliv in i …
- secondary link

**Strengths**

- aria-pressed, aria-live stage

**Weaknesses**

- Double-click affordance undiscoverable; hint text needed

**Links to**

`(room routes)`

**Redesign opportunities**

- Illustrated map; long-press preview on touch

### CLB-01b · Room cards gallery

- **Route:** `/career/klubbhuset`  
- **Kind:** panel (parent CLB-01) · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/klubbhuset/page.tsx (.kh-rooms)`
- **Purpose:** One-click entry per room with photo.
- **Structure:** Grid of 11 cards: env photo top (wing, badge, title), purpose, metric dl, footer actions.
- **Desktop:** Grid
- **Mobile:** Stacks

**Main actions**

- Öppna
- Granska
- hover selects

**Strengths**

- Photography makes departments tangible

**Weaknesses**

- Same photo reused for multiple rooms (11 rooms, 10 images)
- Hover side-effect changes the stage above

**Links to**

`(room routes)`

**Redesign opportunities**

- Use as hub cards on the dashboard

### CLB-01c · Identity / Supporters / National team panels

- **Route:** `/career/klubbhuset`  
- **Kind:** panel (parent CLB-01) · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/klubbhuset/page.tsx (.kh-grid)`
- **Purpose:** Club facts & colours, supporter mood, rivals, honours, national team breaks.
- **Structure:** Three bd-panels: dl of facts with colour swatches; MeterBar + rivals list + honours list; list of national windows with dates/opponents/called players.
- **Desktop:** 3 columns
- **Mobile:** 1 column

**Main actions**

- Open rival club

**Strengths**

- Unique world flavour (real EHF/IHF calendar)

**Weaknesses**

- Dense prose lists; national team info hidden here only

**Links to**

`CLB-04`, `WLD-05`

**Redesign opportunities**

- Trophy cabinet visual; supporter banner/tifo imagery

### CLB-02 · Klubb (own club overview)

- **Route:** `/career/club`  
- **Kind:** page · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/club/page.tsx`, `components/game/Identity.tsx (ClubHero, PlayerCell)`, `components/manager/ClubContext.tsx`, `components/manager/Workspace.tsx (Panel)`, `components/game/profile-world.css`, `lib/economy/clubEconomyLabels.ts`
- **Purpose:** Own club profile: season facts, results/transfers/history, positional depth, top scorers, economy summary, partnerships.
- **Structure:** ClubHero; 4-cell facts strip (position, squad size, venue, staff); main column: ClubContext panel with tabs, 7-position depth tiles (MV V6 V9 M9 M6 H9 H6 counts), top-6 scorers list; right rail: Ekonomi panel with ~16 label/value FinanceRows and Klubbpartnerskap panel.
- **Desktop:** Main + 290–340px rail.
- **Mobile:** ≤1250px rail drops below (2-col), ≤760px single column; facts 2-col.

**Main actions**

- Öppna truppen
- Öppna tävlingen
- Switch ClubContext tab
- Trupp & lagbygge
- Alla prestationer
- Visa partnerskap

**Strengths**

- Positional depth tiles are a nice handball-specific visual
- Economy health badge

**Weaknesses**

- Economy rail is a 16-row label/value list with inline styles — a spreadsheet in a sidebar, duplicating Finance
- Overlaps heavily with Klubbhuset (CLB-01), Finance (CLB-06) and Squad
- FinanceRow uses inline flex/font-size styles rather than tokens

**Links to**

`/career/squad`, `/career/statistics`, `CLB-03`, `/career/competitions/[id]`, `MGR-02`

**Redesign opportunities**

- Merge with Klubbhuset as 'Klubben' hub (identity, facilities, economy summary as visual cards)
- Replace FinanceRows with 2–3 visual KPIs linking to Finance

### CLB-02a · ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik)

- **Route:** `/career/club, /career/clubs/[clubId]`  
- **Kind:** tab (parent CLB-02) · **Importance:** frequent · **Domain:** CLB
- **Components:** `components/manager/ClubContext.tsx`
- **Purpose:** Club-in-world context reused for own and other clubs.
- **Structure:** Panel 'Klubben i karriärvärlden' with hm-tabs (aria-pressed buttons): results = form dots + fixture table (8); transfers = 5-col table; history = 4-col table.
- **Desktop:** Panel
- **Mobile:** Tabs scroll-x

**Main actions**

- Switch tab
- Open fixture/report
- Open player/club
- Open historic season

**Strengths**

- Reusable component

**Weaknesses**

- Tabs are local state (not URL), reset on navigation
- Transfers/history tables have no empty states styled beyond table

**Links to**

`MGR-02`, `/career/match-report/[id]`, `CLB-04`

**Redesign opportunities**

- Timeline view of club story

### CLB-02b · Economy & partnerships rail

- **Route:** `/career/club`  
- **Kind:** panel (parent CLB-02) · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/club/page.tsx (FinanceRow)`
- **Purpose:** Revenue split, cash, wages vs budget, budgets, health; partnership status.
- **Structure:** hm-panel with badge + eyebrow + 16 FinanceRows separated by dividers + muted note; partnership panel with up to 3 rows or 'Inget aktivt samarbete.'
- **Desktop:** Rail
- **Mobile:** Below main

**Main actions**

- Visa partnerskap →

**Strengths**

- Warns when wages exceed budget

**Weaknesses**

- Pure numeric list; no chart; 11px/12px text

**Links to**

`CLB-03`, `CLB-06`

**Redesign opportunities**

- Mini stacked bar of revenue mix

### CLB-03 · Klubbpartnerskap

- **Route:** `/career/club/partnerships`  
- **Kind:** page · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/club/partnerships/page.tsx`, `components/MoneyInput.tsx`, `lib/career/clubPartnerships.ts`
- **Purpose:** Permanent B-teams, development-partner search/agreement, player placements, international loan partnerships, history.
- **Structure:** Vertical stack of plain hm-panels: intro, 'Permanenta B-lag' 3-col table, 'Sök samarbetsklubb' (state machine: active / searching / candidates radio list + inline form / start button), PlacementPanel per relation (table + Place buttons), InternationalLoanPanel(s), 'Historik' 5-col table.
- **Desktop:** Single column stack.
- **Mobile:** No page-specific CSS; tables likely overflow (no hm-scroll-x wrappers on these tables).

**Main actions**

- ← Klubb
- Sök samarbetsklubb
- Choose candidate + cost/month + duration → Ingå avtal
- Förläng 6 månader
- Avsluta samarbete
- Place player at partner
- Recall player
- Create international loan (player, wage share %, end date)

**Strengths**

- Complete feature with clear state copy (searching until date)
- Blockers explained

**Weaknesses**

- Pure admin form/table UI with inline styles (inputStyle object, radio labels styled as .hm-panel with inline borderColor)
- No hero, no partner crests, no imagery — the least 'game' page in scope
- '--' used as dash in copy ('Permanent -- kan inte sägas upp', 'Internationellt låneavtal -- …')
- Only reachable via a ghost button in Club rail

**Links to**

`CLB-02`, `CLB-04`

**Redesign opportunities**

- Partner network diagram (club → B-team / partner with crests and players on loan)
- Guided 'find partner' flow as a decision card

### CLB-03a · Partner search & agreement form

- **Route:** `/career/club/partnerships`  
- **Kind:** panel (parent CLB-03) · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/club/partnerships/page.tsx`
- **Purpose:** Ask the board to find a Division 1 partner, then agree terms.
- **Structure:** Panel body switching between 4 states; candidate list of radio labels; inline form row.
- **Desktop:** Panel
- **Mobile:** Wraps

**Main actions**

- Sök samarbetsklubb
- Select candidate
- Set cost/month
- Set duration
- Ingå avtal
- Förläng
- Avsluta

**Strengths**

- Explicit states

**Weaknesses**

- Termination is a single click, no confirm

**Links to**

—

**Redesign opportunities**

- Decision card with consequences

### CLB-03b · Placement & international loan panels

- **Route:** `/career/club/partnerships`  
- **Kind:** panel (parent CLB-03) · **Importance:** rare · **Domain:** CLB
- **Components:** `app/career/club/partnerships/page.tsx (PlacementPanel, InternationalLoanPanel)`
- **Purpose:** Send/recall players to partner clubs; register foreign loans.
- **Structure:** Panel with player table + per-row buttons; loan panel with select, % input, date, submit.
- **Desktop:** Panels
- **Mobile:** Overflow risk

**Main actions**

- Place
- Recall
- Submit loan

**Strengths**

- Inline errors

**Weaknesses**

- Player rows text only

**Links to**

`/career/squad/[playerId]`

**Redesign opportunities**

- Drag player onto partner card

### CLB-04 · Other club profile

- **Route:** `/career/clubs/[clubId]`  
- **Kind:** page · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/clubs/[clubId]/page.tsx`, `components/game/Identity.tsx (ClubHero)`, `components/manager/ClubContext.tsx`, `lib/identity/presentation.ts`, `lib/knowledge/clubVisibility.ts`
- **Purpose:** Profile for any non-own club: season facts, results/transfers/history, squad, fixtures, staff, club identity claims and head-coach philosophy (knowledge-gated).
- **Structure:** ClubHero + 4 facts (position, points, squad, staff) + partnership note; main: ClubContext, 'Trupp' table (Nr/Spelare/Pos/Ålder), 'Matcher' table, 'Personal' table, 'Klubbidentitet' claims by 7 domains, 'Tränarfilosofi' claims by 6 domains; knowledge tier/percentage gates detail.
- **Desktop:** Main + rail split (hm-world-split).
- **Mobile:** Stacks at ≤1250px; tables in hm-scroll-x.

**Main actions**

- Tillbaka
- Switch ClubContext tab
- Open player
- Open fixture preview / match report
- Open staff member
- Öppna tävlingen

**Strengths**

- Honest empty states ('Ingen truppdata tillgänglig…')
- Knowledge-gated scouting flavour
- Identity claims add narrative texture

**Weaknesses**

- Five stacked tables/panels with the same visual weight
- Identity claims shown as label lists rather than a personality profile
- Back button relies on router.back()

**Links to**

`/career/squad/[playerId]`, `/career/fixtures/[id]`, `/career/match-report/[id]`, `/career/staff/[staffId]`, `/career/competitions/[id]`, `MGR-02`

**Redesign opportunities**

- Opponent 'dossier' look: style radar, key players with faces, rivalry status, head-to-head
- Tabs: Översikt / Trupp / Matcher / Identitet

### CLB-04a · Club identity & coach philosophy panels

- **Route:** `/career/clubs/[clubId]`  
- **Kind:** panel (parent CLB-04) · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/clubs/[clubId]/page.tsx`, `lib/identity/presentation.ts`
- **Purpose:** Show club culture/tactical heritage and coach style claims at the manager's knowledge level.
- **Structure:** Two hm-panels with grouped claim lists by domain label; empty states when no data.
- **Desktop:** Main column
- **Mobile:** Stacked

**Main actions**

- —

**Strengths**

- Unique narrative data

**Weaknesses**

- Read like database fields

**Links to**

—

**Redesign opportunities**

- Visual identity card / personality wheel

### CLB-05 · Styrelserummet (Board)

- **Route:** `/career/board`  
- **Kind:** page · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/board/page.tsx`, `components/experience/Moment.tsx (MomentHero, DecisionCard)`, `components/experience/primitives.tsx (MeterBar)`, `components/board/boardVisuals.ts`, `components/board/board.css`, `lib/board/board.ts`, `lib/manager/managerCareer.ts`
- **Purpose:** Board confidence and why, season objectives, manager contract and offers, meeting minutes, recovery plan.
- **Structure:** Boardroom photo MomentHero (verdict stamp if a meeting in last 21 days, else neutral); 2×2 grid of bd-panels: Förtroende (meter, trend sparkline SVG with warning/dismissal lines, factor list +/-), Säsongens mål (objectives with status pills, why, progress), Kontraktet (dl + DecisionCard), Möten (protocol list).
- **Desktop:** Hero + 2-column grids.
- **Mobile:** ≤1000px single column; ≤640px contract dl 2-col.

**Main actions**

- Lämna handlingsplan (when warned)
- Skriv på / Tacka nej (contract offer)
- Din karriär →

**Strengths**

- Good narrative framing ('Hur styrelsen ser på dig'); transparent thresholds
- DecisionCard pattern makes consequences explicit
- Confidence trend sparkline

**Weaknesses**

- Board members are faceless — no people, only a room photo
- Thresholds explained in a dense paragraph
- Objectives list is text + pill; no progress bars

**Links to**

`MGR-01`, `DSH-01`

**Redesign opportunities**

- Board table with named members and moods
- Objective progress meters
- Meeting as a scene (dialogue) rather than minutes list

### CLB-05a · Board verdict hero

- **Route:** `/career/board`  
- **Kind:** state (parent CLB-05) · **Importance:** frequent · **Domain:** CLB
- **Components:** `components/experience/Moment.tsx (MomentHero)`
- **Purpose:** Show latest board verdict prominently for 21 days.
- **Structure:** MomentHero with tone (gold/ink/loss), stamp (Nöjd/Godkänt/Oroad/Varning/Avsked), headline and lede.
- **Desktop:** Wide hero
- **Mobile:** Stacks

**Main actions**

- —

**Strengths**

- Emotional framing with stamp

**Weaknesses**

- Same photo for every verdict

**Links to**

—

**Redesign opportunities**

- Verdict-specific imagery

### CLB-05b · Recovery-plan & contract-offer decision cards

- **Route:** `/career/board`  
- **Kind:** panel (parent CLB-05) · **Importance:** occasional · **Domain:** CLB
- **Components:** `components/experience/Moment.tsx (DecisionCard)`
- **Purpose:** Respond to board warnings and contract offers.
- **Structure:** DecisionCard: title, status pill (deadline), primary button with consequence line, secondary button; result message as role=status note.
- **Desktop:** In panel
- **Mobile:** In panel

**Main actions**

- Lämna handlingsplan
- Skriv på
- Tacka nej

**Strengths**

- Consequence-first design

**Weaknesses**

- Embedded inside dense panels — easy to miss; also blocks Continue ('Styrelsemöte')

**Links to**

—

**Redesign opportunities**

- Promote to modal 'meeting' moment

### CLB-06 · Finanscentralen (Finance)

- **Route:** `/career/finance`  
- **Kind:** page · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/finance/page.tsx`, `components/finance/FinanceCharts.tsx (CashLineChart, CategoryBars, StackedBars)`, `components/finance/finance.css`, `components/experience/CourtBackdrop.tsx`, `components/experience/primitives.tsx (Stat)`, `lib/economy/*`
- **Purpose:** Club finances: cash trend, warnings/decisions, flows, budget reallocation, monthly ledger, wage commitments, forecast.
- **Structure:** Status band (court-line backdrop, H1 'Finanscentralen', headline sentence, status pill, 3 Stats: Kassa / Senaste månad / Prognos 31 maj) + tab bar with 6 tabs, each tab a 2-col grid of fc-panels with SVG charts and tables.
- **Desktop:** Band + 2-col grid.
- **Mobile:** ≤1100px band/grid single column; ≤760px stats stack, bars reflow.

**Main actions**

- Switch tab (URL ?tab=)
- Reallocate budget (Budget tab)
- Open players from wage list

**Strengths**

- Real charts (line with overdraft line, category bars, stacked bars) with draw-in animation + reduced-motion
- Narrative headline sentence summarises status
- Tabs are URL-addressable

**Weaknesses**

- Ledger/wages/forecast tabs are long multi-column numeric tables (forecast table ≥5 money columns)
- Six tabs of accounting depth for a sports game; budget decisions buried in tab 3
- No link from warnings to the actions that fix them (e.g. sell player)

**Links to**

`/career/squad/[playerId]`, `CLB-05`, `/career/transfers`

**Redesign opportunities**

- Lead with 3 visual KPIs + one decision; move ledger to 'Detaljer'
- Tie finance to football: 'this signing costs X of your budget' simulations

### CLB-06a · Tab · Översikt

- **Route:** `/career/finance`  
- **Kind:** tab (parent CLB-06) · **Importance:** frequent · **Domain:** CLB
- **Components:** `app/career/finance/page.tsx (Overview)`, `components/finance/FinanceCharts.tsx (CashLineChart)`
- **Purpose:** Cash month-by-month (12 actual + 9 projected), warnings & decisions, season so far.
- **Structure:** Line chart panel, warnings panel (EventCard-like items with tone/consequence), season summary panel.
- **Desktop:** 2-col
- **Mobile:** 1-col

**Main actions**

- Decision links

**Strengths**

- Best data viz in scope

**Weaknesses**

- Warnings are text cards

**Links to**

—

**Redesign opportunities**

- Make warnings actionable buttons

### CLB-06b · Tab · Intäkter & kostnader

- **Route:** `/career/finance?tab=flows`  
- **Kind:** tab (parent CLB-06) · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/finance/page.tsx (Flows)`, `components/finance/FinanceCharts.tsx (CategoryBars)`
- **Purpose:** Income/cost categories and matchday gate revenue.
- **Structure:** Two CategoryBars panels + 5-col match table (date, opponent crest, attendance, occupancy fill bar, revenue). Empty: 'Första månadsbokslutet kommer…'
- **Desktop:** 2-col
- **Mobile:** 1-col

**Main actions**

- —

**Strengths**

- Opponent crests + occupancy bars

**Weaknesses**

- Table-heavy

**Links to**

—

**Redesign opportunities**

- Arena fill visual

### CLB-06c · Tab · Budget

- **Route:** `/career/finance?tab=budget`  
- **Kind:** tab (parent CLB-06) · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/finance/page.tsx (Budget)`
- **Purpose:** Board frames and up to 15% budget reallocation.
- **Structure:** Panel 'Budgeten' with board frames and allocation controls (StackedBars).
- **Desktop:** Panel
- **Mobile:** Stacked

**Main actions**

- Shift budget between areas
- Confirm plan

**Strengths**

- Real decision

**Weaknesses**

- Hidden in 3rd tab; the only decision in Finance

**Links to**

—

**Redesign opportunities**

- Promote to season-start board meeting moment

### CLB-06d · Tab · Huvudbok (ledger)

- **Route:** `/career/finance?tab=ledger`  
- **Kind:** tab (parent CLB-06) · **Importance:** rare · **Domain:** CLB
- **Components:** `app/career/finance/page.tsx (Ledger)`
- **Purpose:** Monthly statements.
- **Structure:** Month selector + statement table with colour swatches per category, one-off transactions, opening/closing cash. Empty state text.
- **Desktop:** Split
- **Mobile:** 1-col

**Main actions**

- Select month

**Strengths**

- Category swatches

**Weaknesses**

- Pure accounting table

**Links to**

—

**Redesign opportunities**

- Collapse into expandable detail

### CLB-06e · Tab · Lönekontrakt

- **Route:** `/career/finance?tab=wages`  
- **Kind:** tab (parent CLB-06) · **Importance:** occasional · **Domain:** CLB
- **Components:** `app/career/finance/page.tsx (Wages)`
- **Purpose:** Commitments per season, staff costs, player wage list.
- **Structure:** Commitments panel, staff panel, 4-col wage table with PlayerCell.
- **Desktop:** Panels
- **Mobile:** Scroll-x tables

**Main actions**

- Open player

**Strengths**

- Remaining-to-pay column useful

**Weaknesses**

- Overlaps Contracts page

**Links to**

`/career/contracts`, `/career/squad/[playerId]`

**Redesign opportunities**

- Merge with Kontrakt

### CLB-06f · Tab · Prognos

- **Route:** `/career/finance?tab=forecast`  
- **Kind:** tab (parent CLB-06) · **Importance:** rare · **Domain:** CLB
- **Components:** `app/career/finance/page.tsx (Forecast)`
- **Purpose:** Projection to season end with assumptions and month table.
- **Structure:** Projected CashLineChart, assumptions panel, wide month-by-month table, calibration note.
- **Desktop:** Panels
- **Mobile:** Scroll-x

**Main actions**

- —

**Strengths**

- Assumptions disclosed

**Weaknesses**

- Wide numeric table

**Links to**

—

**Redesign opportunities**

- What-if sliders

### MGR-01 · Karriär (manager career)

- **Route:** `/career/manager`  
- **Kind:** page · **Importance:** occasional · **Domain:** MGR
- **Components:** `app/career/manager/page.tsx`, `components/experience/Moment.tsx (MomentHero, DecisionCard)`, `components/board/boardVisuals.ts`, `lib/manager/managerCareer.ts`
- **Purpose:** Manager reputation, career stats, clubs history, resignation, job market (offers, vacancies, applications).
- **Structure:** Boardroom-photo MomentHero (variants: dismissed/unemployed, new club welcome, neutral compact); role=tablist with 2 tabs; bd-panels: Tränarprofilen, Karriärstatistik, Avgå (DecisionCard), Klubbarna (per stint 6-col season table) | Erbjudanden (DecisionCards with crest), Lediga tjänster, Ansökningar.
- **Desktop:** Hero + panel grid.
- **Mobile:** board.css rules (≤1000px single column).

**Main actions**

- Switch tab Profil och historik / Jobbmarknaden (?tab=jobs)
- Avgå (resign)
- Tacka ja / decline offer
- Apply for vacancy

**Strengths**

- Dismissal/appointment moments are dramatised with stamps ('Sparkad', 'Påskrivet')
- Job market makes unemployment playable

**Weaknesses**

- Manager has no face/avatar — reputation is a label
- Reuses the boardroom photo for all states
- Overlaps with Board (contract) and Historik

**Links to**

`CLB-05`, `MGR-02`, `DSH-01`

**Redesign opportunities**

- Manager 'player card' with reputation level, badges, career timeline
- Job offers as club cards with crest/colours/ambition

### MGR-01a · Tab · Profil och historik

- **Route:** `/career/manager`  
- **Kind:** tab (parent MGR-01) · **Importance:** occasional · **Domain:** MGR
- **Components:** `app/career/manager/page.tsx`
- **Purpose:** Reputation, record, resign, club history.
- **Structure:** 4 bd-panels incl. per-club season tables.
- **Desktop:** Grid
- **Mobile:** Stack

**Main actions**

- Avgå

**Strengths**

- Clear sections

**Weaknesses**

- Stats as text/numbers

**Links to**

`MGR-02`

**Redesign opportunities**

- Career timeline graphic

### MGR-01b · Tab · Jobbmarknaden

- **Route:** `/career/manager?tab=jobs`  
- **Kind:** tab (parent MGR-01) · **Importance:** occasional · **Domain:** MGR
- **Components:** `app/career/manager/page.tsx`, `components/experience/Moment.tsx (DecisionCard)`
- **Purpose:** Offers, vacancies and applications.
- **Structure:** Three bd-panels: offer DecisionCards (crest + deadline pill), vacancy list, applications list; count in tab label.
- **Desktop:** Grid
- **Mobile:** Stack

**Main actions**

- Tacka ja
- Apply
- Withdraw

**Strengths**

- Count badge in tab
- Good empty-state copy

**Weaknesses**

- Vacancies as plain list

**Links to**

`CLB-04`

**Redesign opportunities**

- Club cards with expectations & budget

### MGR-01c · Dismissed / unemployed hero state

- **Route:** `/career/manager`  
- **Kind:** state (parent MGR-01) · **Importance:** rare · **Domain:** MGR
- **Components:** `app/career/manager/page.tsx`
- **Purpose:** Frame being sacked/resigned/out of contract.
- **Structure:** MomentHero kind=DISMISSAL with stamp.
- **Desktop:** Hero
- **Mobile:** Hero

**Main actions**

- Go to job market

**Strengths**

- Emotional beat exists

**Weaknesses**

- Elsewhere (dashboard) only a text note

**Links to**

`MGR-01b`

**Redesign opportunities**

- Full-screen moment on the day it happens

### MGR-02 · Historik

- **Route:** `/career/history`  
- **Kind:** page · **Importance:** occasional · **Domain:** MGR
- **Components:** `app/career/history/page.tsx`, `components/game/Secondary.tsx (SectionScene)`, `components/manager/Workspace.tsx (Panel, FixtureTable)`, `components/manager/StatisticsTable.tsx`, `lib/career/matchArchiveSummary.ts`
- **Purpose:** Past seasons: final table, player stats, career match archive, completed transfers.
- **Structure:** SectionScene header with crest; season link tabs; main: final-table panel (wide table), statistics table, 'Spelade matcharkiv · hela karriären' fixture table, transfers table; rail: final-placement milestone card + note.
- **Desktop:** Main + rail (game-secondary-split).
- **Mobile:** Single column (secondary.css ≤ breakpoint).

**Main actions**

- Select season (?season=)
- Toggle transfers Din klubb / Hela världen
- Open match report
- Open club/player

**Strengths**

- Preserves full archive; season deep-links

**Weaknesses**

- Mostly long tables; no trophies or highlights
- Mojibake in fallback link text: '?ppna ?ldre matcharkiv ?' (app/career/history/page.tsx L44) — encoding bug
- Overlaps Säsongen, Karriär and Statistik

**Links to**

`/career/match-report/[id]`, `CLB-04`, `/career/squad/[playerId]`, `MGR-03`

**Redesign opportunities**

- Career scrapbook: season cards with final position, trophy, top scorer, best moment
- Merge into a 'Karriär' hub with MGR-01

### MGR-02a · Season selector tabs

- **Route:** `/career/history?season=`  
- **Kind:** tab (parent MGR-02) · **Importance:** occasional · **Domain:** MGR
- **Components:** `app/career/history/page.tsx (.hm-tabs)`
- **Purpose:** Pick historic season.
- **Structure:** Link tabs with aria-current; hidden when no history.
- **Desktop:** Tabs
- **Mobile:** Scroll-x

**Main actions**

- Select season

**Strengths**

- URL-driven

**Weaknesses**

- Empty career shows no explanation in tab area

**Links to**

—

**Redesign opportunities**

- Season timeline

### MGR-03 · Säsongen (season hub)

- **Route:** `/career/season`  
- **Kind:** page · **Importance:** frequent · **Domain:** MGR
- **Components:** `app/career/season/page.tsx`, `components/season/CompetitionMark.tsx`, `components/season/Knockout.tsx (BracketGrid, TieCard)`, `components/season/seasonAssets.ts`, `components/season/season.css`, `components/experience/Moment.tsx (MomentHero, EventCard)`
- **Purpose:** Whole-season picture: hero, next step, promotion/relegation movement, SM-slutspel bracket, kval ties, Svenska cupen, league tables with zones, important upcoming matches, rules, awards gala.
- **Structure:** Court/trophy photo MomentHero; NextStep tone card with CompetitionMark; Movement lists (up/down/kval); competition-coloured sections with brackets (BracketGrid), TieCards, cup group tables + bracket, side-by-side league tables with zone colouring; upcoming list; rules; Galan EventCards.
- **Desktop:** Stacked full-width sections.
- **Mobile:** ≤760px band stats stack, fixture lists single column, cup path 2-col.

**Main actions**

- Open tie/fixture
- Open award player
- Read rules

**Strengths**

- Competition identity marks and colour per competition (HBL/SM/KVAL/CUP)
- Brackets are genuinely visual
- Zone colouring in tables

**Weaknesses**

- Very long single page; overlaps /career/competitions and the separate 'Svenska Cupen' nav item
- Explanatory notes are dense small print (ss-note)

**Links to**

`/career/fixtures/[id]`, `/career/match-report/[id]`, `/career/squad/[playerId]`, `/career/competitions/[id]`

**Redesign opportunities**

- Become the single 'Tävlingar' hub with tabs (Liga / SM / Kval / Cup / Galan)
- Animated bracket progression; trophy moment on title

### MGR-03a · SM-slutspel / Kval / Cup sections

- **Route:** `/career/season`  
- **Kind:** panel (parent MGR-03) · **Importance:** occasional · **Domain:** MGR
- **Components:** `components/season/Knockout.tsx`
- **Purpose:** Knockout progress.
- **Structure:** SectionHead with mark + BracketGrid (QF/SF/F) or TieCards; champion aside.
- **Desktop:** Wide
- **Mobile:** Scroll

**Main actions**

- Open tie

**Strengths**

- Strong visual

**Weaknesses**

- Only appear when ties exist — no preview of the path before

**Links to**

—

**Redesign opportunities**

- Show projected bracket early

### MGR-03b · Season verdict & awards gala

- **Route:** `/career/season`  
- **Kind:** state (parent MGR-03) · **Importance:** rare · **Domain:** MGR
- **Components:** `app/career/season/page.tsx (SeasonVerdict, Awards)`
- **Purpose:** End-of-season honours.
- **Structure:** Verdict grid (champion, runner-up, cup winner, series winners with marks) + EventCards per award.
- **Desktop:** Grid
- **Mobile:** Stack

**Main actions**

- Open player

**Strengths**

- Gala framing

**Weaknesses**

- Only on this page; not pushed as a moment

**Links to**

—

**Redesign opportunities**

- Full-screen gala sequence

### MGR-04 · Momentbiblioteket (moment library)

- **Route:** `/career/moments`  
- **Kind:** page · **Importance:** internal · **Domain:** MGR
- **Components:** `app/career/moments/page.tsx`, `components/experience/Moment.tsx`, `components/experience/primitives.tsx`, `components/transfers/transferVisuals.ts`, `components/experience/experienceAssets.ts`
- **Purpose:** Developer reference page showing the shared 'experience' components (MomentHero, EventCard, DecisionCard, MeterBar, ProgressSteps, RouteLine, ValueFlow) with the user's club.
- **Structure:** Settings-styled page with examples: signing moment with RouteLine/ProgressSteps/ValueFlow, staff appointment hero, championship hero, promotion/dismissal heroes, three EventCards, DecisionCard, meter examples.
- **Desktop:** Stacked examples
- **Mobile:** auto-fit grids

**Main actions**

- None functional (buttons are inert)

**Strengths**

- De-facto living style guide for the 'experience' layer — the best inventory of existing high-emotion components

**Weaknesses**

- Not linked from navigation; reachable only by URL
- Inert buttons look real

**Links to**

`SYS-01`

**Redesign opportunities**

- Promote into a proper documented component gallery for the redesign

### WLD-01 · Inkorg (Inbox)

- **Route:** `/career/inbox`  
- **Kind:** page · **Importance:** core · **Domain:** WLD
- **Components:** `app/career/inbox/page.tsx`, `lib/career/inboxFilters.ts`, `lib/career/destinations.ts`, `components/game/WorkspaceMemory.tsx`, `components/game/Identity.tsx (MatchHero, PlayerCell)`, `components/game/recruitment-news.css`
- **Purpose:** Messages from club/staff/board/world with required actions and deep links.
- **Structure:** PageHeading + masthead strip (date, unread count, action-required count); two-pane layout: left feed (9 filter buttons, count, scrollable list of message buttons with category · date, unread dot, subject, preview, 'ÅTGÄRD KRÄVS →'), right article (kicker, H2, byline, optional compact MatchHero / PlayerCell, paragraphs, next-step buttons, tools footer).
- **Desktop:** Two-pane (360–420px list + article).
- **Mobile:** ≤900px single column — list above article; selecting a message does not scroll to it (no code found).

**Main actions**

- Filter (Alla, Olästa, Åtgärd krävs, Kontrakt, Transfers, Analys, Scouting, Tränarstab, Arkiverat)
- Select message
- Markera som läst
- Arkivera / Återställ
- Destination buttons ('Nästa steg')

**Strengths**

- Classic mail two-pane works; deep link ?message=
- Action-required messages can't be archived until resolved
- Contextual MatchHero/PlayerCell inside article
- Reader state remembered across navigation (WorkspaceMemory)

**Weaknesses**

- Nine flat filter buttons
- All messages look alike — no sender portraits/logos, category only as small text
- Overlaps Media news feed and dashboard news

**Links to**

`(destinations) /career/squad/[playerId]`, `/career/match-report/[id]`, `/career/match-day/[id]`, `CLB-05`, `/career/contracts`, `/career/scouting`

**Redesign opportunities**

- Unify with Media as one 'Nyheter & besked' stream with priority lanes
- Sender identity (assistant, board chair, physio) with faces
- Phone: list → full-screen reader

### WLD-01a · Inbox filters

- **Route:** `/career/inbox`  
- **Kind:** panel (parent WLD-01) · **Importance:** frequent · **Domain:** WLD
- **Components:** `lib/career/inboxFilters.ts`
- **Purpose:** Narrow message list.
- **Structure:** Row of 9 hm-btn-sm aria-pressed buttons.
- **Desktop:** Wrap row
- **Mobile:** Wrap

**Main actions**

- Select filter

**Strengths**

- Includes Åtgärd krävs

**Weaknesses**

- No counts per filter

**Links to**

—

**Redesign opportunities**

- Segmented: Att göra / Allt / Arkiv + category chips

### WLD-01b · Message reader + empty states

- **Route:** `/career/inbox?message=`  
- **Kind:** panel (parent WLD-01) · **Importance:** core · **Domain:** WLD
- **Components:** `app/career/inbox/page.tsx`
- **Purpose:** Read a message and act.
- **Structure:** Article with data-category; empty: 'Välj ett meddelande…' / 'Inga meddelanden i denna vy.'
- **Desktop:** Right pane
- **Mobile:** Below list

**Main actions**

- Destination buttons
- Mark read
- Archive/unarchive

**Strengths**

- Next-step buttons

**Weaknesses**

- Long body paragraphs at 13px

**Links to**

—

**Redesign opportunities**

- Email-as-scene: assistant briefings with visuals

### WLD-02 · Mediecentret (Media)

- **Route:** `/career/media`  
- **Kind:** page · **Importance:** frequent · **Domain:** WLD
- **Components:** `app/career/media/page.tsx`, `components/media/MediaParts.tsx (StoryCard, OutletChip, FictionNote, PRESSROOM_BACKDROP)`, `components/media/media.css`, `components/experience/Moment.tsx (MomentHero)`, `lib/media/*`
- **Purpose:** News world: stories from fictional outlets, press conferences, coach rivalries, discipline cases, outlet relations.
- **Structure:** Press-room photo MomentHero (top story as headline, or neutral 'Handbollsvärlden'); role=tablist of 5 tabs (press tab shows open count); feed = lead StoryCard (lg) + list of md/sm cards; press = list of conferences with status; rivals = coach relations + club rivalries; discipline = case list; outlets = outlet relation rows.
- **Desktop:** Hero + tabs + 2-col feed grid.
- **Mobile:** ≤1000px feed single column, outlet rows reflow.

**Main actions**

- Switch tab (?tab=feed|press|rivals|discipline|outlets)
- Filter scope (Alla, Din klubb, Lokalt, Regionalt, Nationellt, Handbollsmedia)
- Search stories
- Open story
- Open press conference

**Strengths**

- Editorial hierarchy (lead story, sizes by importance)
- Fictional outlets/journalists give world texture
- Top story promoted into hero

**Weaknesses**

- Story cards are typographic only — no photos even though match/arena images exist
- Rivals/discipline/outlets are thin lists
- News split between Media, Inbox and Dashboard

**Links to**

`WLD-03`, `WLD-04`, `CLB-04`

**Redesign opportunities**

- Newspaper/social-feed look with imagery and headlines from your matches
- Press conference as a featured interactive card on the dashboard

### WLD-02a · Tab · Nyheter (feed)

- **Route:** `/career/media`  
- **Kind:** tab (parent WLD-02) · **Importance:** frequent · **Domain:** WLD
- **Components:** `components/media/MediaParts.tsx (StoryCard)`
- **Purpose:** Story feed.
- **Structure:** Radiogroup scope chips + search, lead card + list; empty copy.
- **Desktop:** 2-col
- **Mobile:** 1-col

**Main actions**

- Scope filter
- Search
- Open story

**Strengths**

- Search

**Weaknesses**

- No images

**Links to**

`WLD-04`

**Redesign opportunities**

- Image-led cards

### WLD-02b · Tab · Presskonferenser

- **Route:** `/career/media?tab=press`  
- **Kind:** tab (parent WLD-02) · **Importance:** frequent · **Domain:** WLD
- **Components:** `app/career/media/page.tsx`
- **Purpose:** Open and past press conferences.
- **Structure:** List of links with title, date · status. Open count in tab label.
- **Desktop:** List
- **Mobile:** List

**Main actions**

- Open conference

**Strengths**

- Continue button routes here when one is pending

**Weaknesses**

- Plain list

**Links to**

`WLD-03`

**Redesign opportunities**

- Countdown + journalist faces

### WLD-02c · Tab · Rivaler

- **Route:** `/career/media?tab=rivals`  
- **Kind:** tab (parent WLD-02) · **Importance:** occasional · **Domain:** WLD
- **Components:** `app/career/media/page.tsx (Rivals)`
- **Purpose:** Coach relations and club rivalries; open feud hero.
- **Structure:** Optional compact MomentHero 'Öppen fejd' + two panels of lists.
- **Desktop:** 2 panels
- **Mobile:** Stack

**Main actions**

- Open club

**Strengths**

- Feud framing

**Weaknesses**

- Relations as list values

**Links to**

`CLB-04`

**Redesign opportunities**

- Rivalry heat map

### WLD-02d · Tab · Disciplin

- **Route:** `/career/media?tab=discipline`  
- **Kind:** tab (parent WLD-02) · **Importance:** rare · **Domain:** WLD
- **Components:** `app/career/media/page.tsx`
- **Purpose:** Disciplinary cases.
- **Structure:** List of cases; 'Inga ärenden.'
- **Desktop:** List
- **Mobile:** List

**Main actions**

- —

**Strengths**

- —

**Weaknesses**

- Thin; odd home under Media

**Links to**

—

**Redesign opportunities**

- Move to squad/player status

### WLD-02e · Tab · Medierna (outlets)

- **Route:** `/career/media?tab=outlets`  
- **Kind:** tab (parent WLD-02) · **Importance:** rare · **Domain:** WLD
- **Components:** `app/career/media/page.tsx (OutletRow)`
- **Purpose:** Relationship with each outlet and story counts.
- **Structure:** Rows: OutletChip, relation value, count.
- **Desktop:** Rows
- **Mobile:** Reflow

**Main actions**

- —

**Strengths**

- —

**Weaknesses**

- Numbers without meaning

**Links to**

—

**Redesign opportunities**

- Media favour meter

### WLD-03 · Presskonferens

- **Route:** `/career/media/press/[pressId]`  
- **Kind:** page · **Importance:** frequent · **Domain:** WLD
- **Components:** `app/career/media/press/[pressId]/page.tsx`, `components/media/MediaParts.tsx (OutletChip, PRESSROOM_BACKDROP)`, `lib/media/actions.ts`, `lib/media/press.ts`
- **Purpose:** Answer journalists' questions by tone, delegate to assistant, or skip; see consequences.
- **Structure:** Compact press-room MomentHero (pre/post match, date, stamp when closed); consequences panel when closed; ordered list of questions: outlet chip, journalist name, style badge, question, radio answers (tone label, quote, hint).
- **Desktop:** Single column
- **Mobile:** Same; answers as stacked labels

**Main actions**

- Choose answer tone per question
- Lämna svaren
- Låt <assistant> svara (Delegera)
- Avböj / Hoppa över
- ← Presskonferenser

**Strengths**

- Real interactive dialogue mechanic with tone hints, delegation option
- Consequences listed with reasons

**Weaknesses**

- All questions on one long form; no sense of a live room/turn-taking
- Inline style on badge
- Not-found state is a bare EmptyState

**Links to**

`WLD-02b`, `WLD-04`

**Redesign opportunities**

- One question at a time, journalist portrait, reaction feedback — a signature scene

### WLD-04 · Artikel (story)

- **Route:** `/career/media/story/[storyId]`  
- **Kind:** page · **Importance:** occasional · **Domain:** WLD
- **Components:** `app/career/media/story/[storyId]/page.tsx`, `components/media/MediaParts.tsx`, `lib/media/newsEngine.ts`
- **Purpose:** Read one story and how other outlets covered the same event.
- **Structure:** Article: outlet chip, scope, H1 headline, standfirst, byline, body, quote blockquote, destination buttons, fiction note; 'Så skrev andra' list of StoryCards.
- **Desktop:** Article column
- **Mobile:** Same

**Main actions**

- ← Mediecentret
- Destination buttons
- Open other coverage

**Strengths**

- Newspaper typography hierarchy
- Cross-coverage comparison is a nice idea

**Weaknesses**

- No image; outlets visually indistinct

**Links to**

`WLD-02`, `(destinations)`

**Redesign opportunities**

- Outlet-specific mastheads/styles (tabloid vs local)

### WLD-05 · Kalender

- **Route:** `/career/calendar`  
- **Kind:** page · **Importance:** frequent · **Domain:** WLD
- **Components:** `app/career/calendar/page.tsx`, `components/manager/CalendarMilestones.tsx`, `components/manager/Workspace.tsx (PageHeading, Panel, FixtureTable)`, `components/game/Identity.tsx`, `lib/training/trainingSchedule.ts`, `components/game/squad-season.css`
- **Purpose:** Four-week view of training day types, sessions, matches, contract expiries, scouting completions and milestones.
- **Structure:** PageHeading with prev/next; context strip with period + counts; 4 stacked week Panels, each a 7-column grid of day cells (min-height 200px: weekday, big date, day-type badge, 'Idag', sessions text, match link, deadlines, scouting, milestones) followed by a FixtureTable for that week.
- **Desktop:** 7 columns of min 145px.
- **Mobile:** 7×145px = ~1015px grid → horizontal scroll on phones.

**Main actions**

- ← Fyra veckor / → (navigate 4-week blocks)
- Hantera träning (per week)
- Open fixture / match report
- Open player
- Open scouting

**Strengths**

- Day cells with matchday/recovery/today states make rhythm visible

**Weaknesses**

- Each week repeats a fixture table under the grid (duplicate info)
- 4 × 7 × 200px tall cells = very long page; no month overview
- Overlaps Schema (WLD-06) and the dashboard weekly plan

**Links to**

`/career/training?week=`, `/career/fixtures/[id]`, `/career/match-report/[id]`, `/career/squad/[playerId]`, `/career/scouting`

**Redesign opportunities**

- Merge Calendar + Schedule into one 'Säsong' timeline (month / week / list views)
- Agenda list on mobile

### WLD-06 · Schema (Matcher & resultat)

- **Route:** `/career/schedule`  
- **Kind:** page · **Importance:** frequent · **Domain:** WLD
- **Components:** `app/career/schedule/page.tsx`, `components/season/PreseasonPlanner.tsx`, `components/game/Secondary.tsx (SectionScene)`, `components/manager/Workspace.tsx (Panel)`, `components/ClubCrest.tsx`
- **Purpose:** Own fixture list and results; preseason planning (friendlies, camps, tournaments).
- **Structure:** SectionScene header; PreseasonPlanner form section at top; hm-tabs filter; 8-column table (Omg, Datum, Typ badge, H/B, Motstånd, Status badge, Resultat, link); right rail: Nästa match panel (crest 58px) + note.
- **Desktop:** Main + rail.
- **Mobile:** Table in hm-scroll-x; rail below.

**Main actions**

- Plan friendly/camp/tournament
- Filter Hela säsongen / Kommande / Resultat
- Click row → match report or preview
- Förhandsvisa / Matchrapport
- Open opponent

**Strengths**

- Clickable rows with correct guard (only next/played)
- Type and outcome badges

**Weaknesses**

- Preseason planner (a form with 3 sub-tabs) sits above the fixture list year-round
- 8-column table, no crests in rows
- Nav label 'Schema' vs page title 'Matcher & resultat'

**Links to**

`/career/match-preview`, `/career/match-report/[id]`, `/career/fixtures/[id]`, `CLB-04`, `WLD-05`

**Redesign opportunities**

- Fixture cards with crests, venue photo, result colour
- Move preseason planner into a preseason-only moment

### WLD-06a · Preseason planner (tabs Träningsmatch / Läger-resa / Turnering)

- **Route:** `/career/schedule`  
- **Kind:** tab (parent WLD-06) · **Importance:** occasional · **Domain:** WLD
- **Components:** `components/season/PreseasonPlanner.tsx`
- **Purpose:** Book friendlies, camps, tournaments; costs drawn from cash.
- **Structure:** hm-plan-section with intro (incl. cash), anchor-based subnav (role=tab <a href>), form grid of labelled inputs/selects, cost line, booked events list.
- **Desktop:** Form grid
- **Mobile:** Wraps

**Main actions**

- Switch sub-tab
- Pick date/opponent/venue/location
- Book

**Strengths**

- Clash validation, cost transparency

**Weaknesses**

- Tab semantics on <a href='#'> links
- Form-first UI

**Links to**

—

**Redesign opportunities**

- Preseason calendar board with drag-to-book

### WLD-06b · Schedule filter tabs

- **Route:** `/career/schedule`  
- **Kind:** tab (parent WLD-06) · **Importance:** frequent · **Domain:** WLD
- **Components:** `app/career/schedule/page.tsx`
- **Purpose:** Filter fixtures.
- **Structure:** hm-tabs aria-pressed buttons; empty row 'Inga matcher i den här vyn.'
- **Desktop:** Tabs
- **Mobile:** Scroll-x

**Main actions**

- Hela säsongen
- Kommande
- Resultat

**Strengths**

- —

**Weaknesses**

- Not URL-persisted

**Links to**

—

**Redesign opportunities**

- —

### MED-01 · Medicinskt & Rehabilitering

- **Route:** `/career/medical`  
- **Kind:** page · **Importance:** occasional · **Domain:** MED
- **Components:** `app/career/medical/page.tsx`, `components/clubhq/EnvironmentBanner.tsx`, `components/game/Secondary.tsx (StaffMark)`, `components/manager/Workspace.tsx (Panel)`, `lib/medical/*`
- **Purpose:** Active injuries with rehab phase/progress and return dates, recent recoveries, responsible physio, availability for next selection.
- **Structure:** EnvironmentBanner (medical-room photo, badge, 3 metrics: active injuries, available x/y, rehab quality 1.00x); main: 7-column injuries table (Spelare, Skada, Allvarlighetsgrad, Status, Rehabfas, Rehabframsteg, Beräknad återkomst) or empty scene, 'Senaste återgångar' list; rail: physio panel with initials mark, next-selection note.
- **Desktop:** Banner + main/rail split.
- **Mobile:** Banner stacks (≤900px), split collapses; table scroll-x.

**Main actions**

- Belastning & återhämtning →
- Truppens status →
- Open player
- Open physio
- Open next opponent

**Strengths**

- Photo banner + metric tiles give a department feel
- Clear empty state when no injuries

**Weaknesses**

- Core info is a 7-column table
- Rehab quality shown as raw multiplier '1.00x'
- No body map / timeline to return

**Links to**

`/career/training`, `/career/squad`, `/career/squad/[playerId]`, `/career/staff/[staffId]`, `CLB-04`

**Redesign opportunities**

- Injury cards with body-zone silhouette and return-date timeline
- Integrate availability into squad/tactics instead of a separate nav item

### MED-01a · Active injuries table / empty scene

- **Route:** `/career/medical`  
- **Kind:** panel (parent MED-01) · **Importance:** occasional · **Domain:** MED
- **Components:** `app/career/medical/page.tsx`, `components/game/Secondary.tsx (SceneEmpty)`
- **Purpose:** Track rehab.
- **Structure:** Panel with hm-scroll-x table; else SceneEmpty.
- **Desktop:** Table
- **Mobile:** Scroll-x

**Main actions**

- Open player

**Strengths**

- Progress column

**Weaknesses**

- Severity as text

**Links to**

—

**Redesign opportunities**

- Progress bars + phase stepper

### SYS-01 · Inställningar (in-career settings)

- **Route:** `/career/settings`  
- **Kind:** page · **Importance:** rare · **Domain:** SYS
- **Components:** `app/career/settings/page.tsx`, `components/experience/ChoiceGroup.tsx`, `components/experience/CourtBackdrop.tsx`, `components/settings/SettingsSection.tsx`, `components/settings/settings.css`
- **Purpose:** Display currency (EUR/SEK) with live preview using the club's own figures.
- **Structure:** Ink band with court backdrop, H1, two Stats; SettingsSection with ChoiceGroup (two option cards with sample amount); rail with preview dl (transfer budget, wage budget, top wage, cash) and 'Bra att veta' list.
- **Desktop:** Band + section/rail.
- **Mobile:** settings.css stacks.

**Main actions**

- Choose currency

**Strengths**

- Excellent preview using real numbers
- Persist/session fallback feedback

**Weaknesses**

- Only one setting — match speed (available on /settings) missing here
- Visually heavier than its content warrants
- Diverges from ENT-05 implementation

**Links to**

`MGR-04 (from moments page)`

**Redesign opportunities**

- Single settings component used everywhere; add density/text-size/motion

### SYS-02 · Editor home (dev data editor)

- **Route:** `/editor`  
- **Kind:** page · **Importance:** internal · **Domain:** SYS
- **Components:** `app/editor/layout.tsx`, `app/editor/EditorModeGate.tsx`, `app/editor/page.tsx`, `app/EditorModeWidget.tsx`
- **Purpose:** INTERNAL. Real-database editor entry (nations/competitions/clubs/players counts) gated by HM_EDITOR_ENABLED server flag (404 otherwise).
- **Structure:** Single hm-panel with UTVECKLING badge, 4 stats, two buttons (max-width 720 inline style).
- **Desktop:** Centred panel
- **Mobile:** n/a

**Main actions**

- ÖPPNA SPELARE
- ÖPPNA BETYGSGRANSKNING

**Strengths**

- Server-side gate via notFound()

**Weaknesses**

- Internal styling

**Links to**

`SYS-02a`, `SYS-02c`

**Redesign opportunities**

- Keep internal

### SYS-02a · Editor · players (bulk calibration table)

- **Route:** `/editor/players`  
- **Kind:** page (parent SYS-02) · **Importance:** internal · **Domain:** SYS
- **Components:** `app/editor/players/page.tsx`
- **Purpose:** INTERNAL. Spreadsheet-like inline editing of every HBL + Allsvenskan player (714 lines).
- **Structure:** Self-described 'compact, spreadsheet-like table'.
- **Desktop:** Table
- **Mobile:** n/a

**Main actions**

- Inline edit
- Open player

**Strengths**

- —

**Weaknesses**

- —

**Links to**

`SYS-02b`

**Redesign opportunities**

- —

### SYS-02b · Editor · player detail

- **Route:** `/editor/players/[playerId]`  
- **Kind:** page (parent SYS-02) · **Importance:** internal · **Domain:** SYS
- **Components:** `app/editor/players/[playerId]/page.tsx`
- **Purpose:** INTERNAL. Real data, squad and game-data panels per player.
- **Structure:** hm-panels 'VERKLIG DATA', 'TRUPP', 'SPEL-DATA'.
- **Desktop:** Panels
- **Mobile:** n/a

**Main actions**

- Edit fields
- Save

**Strengths**

- —

**Weaknesses**

- —

**Links to**

—

**Redesign opportunities**

- —

### SYS-02c · Editor · rating review roster

- **Route:** `/editor/ratings`  
- **Kind:** page (parent SYS-02) · **Importance:** internal · **Domain:** SYS
- **Components:** `app/editor/ratings/page.tsx`
- **Purpose:** INTERNAL. Club selector → roster with rating proposals/review status.
- **Structure:** Mirrors players editor layout.
- **Desktop:** Table
- **Mobile:** n/a

**Main actions**

- Pick club
- Open player

**Strengths**

- —

**Weaknesses**

- —

**Links to**

`SYS-02d`

**Redesign opportunities**

- —

### SYS-02d · Editor · rating detail

- **Route:** `/editor/ratings/[playerId]`  
- **Kind:** page (parent SYS-02) · **Importance:** internal · **Domain:** SYS
- **Components:** `app/editor/ratings/[playerId]/page.tsx`
- **Purpose:** INTERNAL. Source proposal, CA estimate, generated attributes, overrides, LOCK.
- **Structure:** Long detail page (625 lines).
- **Desktop:** Panels
- **Mobile:** n/a

**Main actions**

- Set status/note
- Override CA/PA/attributes
- LOCK

**Strengths**

- —

**Weaknesses**

- —

**Links to**

—

**Redesign opportunities**

- —

### SYS-02e · Editor · court grid calibration

- **Route:** `/editor/court-grid`  
- **Kind:** page (parent SYS-02) · **Importance:** internal · **Domain:** SYS
- **Components:** `app/editor/court-grid/page.tsx`
- **Purpose:** INTERNAL. Calibrate canonical 40×20 m court grid.
- **Structure:** Court canvas + controls.
- **Desktop:** Canvas
- **Mobile:** n/a

**Main actions**

- Select calibration mode

**Strengths**

- —

**Weaknesses**

- —

**Links to**

—

**Redesign opportunities**

- —

### SYS-03 · Scenario lab (engine labs)

- **Route:** `/scenario-lab`  
- **Kind:** page · **Importance:** internal · **Domain:** SYS
- **Components:** `app/scenario-lab/page.tsx`, `app/scenario-lab/core/page.tsx`, `app/scenario-lab/match/page.tsx`, `app/scenario-lab/scenario-lab.css`
- **Purpose:** INTERNAL. Engine V2 labs: centre throw-off (/scenario-lab), possession & transition (/core), full-match timeline QA (/match).
- **Structure:** Dark lab headers ('HANDBALL ENGINE V2 · MILESTONE 1'), canvases/timelines.
- **Desktop:** Lab layout
- **Mobile:** n/a

**Main actions**

- Run scenarios
- Step snapshots

**Strengths**

- —

**Weaknesses**

- No server/env gate found in source — publicly reachable in any build (unverified at deploy level)
- Wrapped by AlphaAccessGate + feedback button like the game

**Links to**

`SYS-03a`, `SYS-03b`

**Redesign opportunities**

- Gate like /editor

### SYS-03a · Scenario lab · core

- **Route:** `/scenario-lab/core`  
- **Kind:** page (parent SYS-03) · **Importance:** internal · **Domain:** SYS
- **Components:** `app/scenario-lab/core/page.tsx`
- **Purpose:** INTERNAL. Possession & transition lab.
- **Structure:** Lab page.
- **Desktop:** —
- **Mobile:** —

**Main actions**

- Run

**Strengths**

- —

**Weaknesses**

- —

**Links to**

—

**Redesign opportunities**

- —

### SYS-03b · Scenario lab · match

- **Route:** `/scenario-lab/match`  
- **Kind:** page (parent SYS-03) · **Importance:** internal · **Domain:** SYS
- **Components:** `app/scenario-lab/match/page.tsx`
- **Purpose:** INTERNAL. Full-match human QA timeline.
- **Structure:** Lab page with timeline.
- **Desktop:** —
- **Mobile:** —

**Main actions**

- Run
- Scrub

**Strengths**

- —

**Weaknesses**

- —

**Links to**

—

**Redesign opportunities**

- —

### SYS-04 · Match 2D QA harness

- **Route:** `/match-qa`  
- **Kind:** page · **Importance:** internal · **Domain:** SYS
- **Components:** `app/match-qa/page.tsx`, `@handball-manager/match-renderer MasterCourt`
- **Purpose:** INTERNAL. Human QA gate: play dev scenarios through the real engine with toggles (fatigue, 7-vs-6, presets, speed).
- **Structure:** Court renderer + control rows of hm-btn toggles (inline styles).
- **Desktop:** Court + controls
- **Mobile:** n/a

**Main actions**

- Play/pause
- Reset
- Speed
- Toggle fatigue/sevenOut
- Run preset

**Strengths**

- —

**Weaknesses**

- Outside /career deliberately; no gate found in source

**Links to**

—

**Redesign opportunities**

- Gate

### SYS-05 · CPU-rekrytering (debug)

- **Route:** `/career/club/cpu-recruitment`  
- **Kind:** page · **Importance:** internal · **Domain:** SYS
- **Components:** `app/career/club/cpu-recruitment/page.tsx`, `lib/career/cpuRecruitment.ts`
- **Purpose:** INTERNAL. Debug view of AI clubs' positional needs, pursuits and decision log.
- **Structure:** Three hm-panels with tables (Positionsbehov, Aktiva/senaste pursuits, Beslutslogg).
- **Desktop:** Tables
- **Mobile:** n/a

**Main actions**

- ← Klubb

**Strengths**

- —

**Weaknesses**

- Lives under the player-facing /career/club route without any gate; not linked anywhere (URL-only)

**Links to**

`CLB-02`

**Redesign opportunities**

- Move under /editor gate

### SYS-06 · Editor mode widget (global)

- **Route:** `* (root layout)`  
- **Kind:** panel · **Importance:** internal · **Domain:** SYS
- **Components:** `app/EditorModeWidget.tsx`, `lib/editor/editorToggle.ts`
- **Purpose:** INTERNAL. Floating toggle + link to /editor, rendered only when /api/editor/status reports enabled.
- **Structure:** Small floating control; also adds an 'Editor' item to the sidebar when enabled.
- **Desktop:** Floating
- **Mobile:** Floating

**Main actions**

- Toggle editor mode
- Open editor

**Strengths**

- Absent in production builds

**Weaknesses**

- —

**Links to**

`SYS-02`

**Redesign opportunities**

- —

