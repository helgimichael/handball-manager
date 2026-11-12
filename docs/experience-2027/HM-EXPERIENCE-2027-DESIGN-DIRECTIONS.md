# HM Experience 2027 — Design Directions

> Status: **proposal for owner review**. Nothing here is implemented in the production app.
> Live, switchable versions of all three identities are in the Design Lab
> (`design-lab/experience-2027/index.html` → *Identities* and *Journeys*).

Handball Manager needs one coherent visual language, but the owner should choose its *temperament*.
The three directions below are deliberately far apart. They share **one semantic token contract**
(see §5 and `design-lab/experience-2027/proto/themes.css`), so any surface alternative can be rendered
in any identity — which is exactly what the Design Lab lets you do.

| | **A — Tactical Clarity** | **B — Arena Nights** | **C — Paper & Floodlight** |
|---|---|---|---|
| One-liner | A precise coaching instrument | A broadcast-grade sports world | An editorial club journal that ignites on matchday |
| Closest to (in spirit) | Linear / Figma-grade productivity, FM-style depth | F1 Manager, NBA 2K, TV graphics | Matchday programme + The Athletic + Football Manager depth |
| Base mode | Light (with full dark twin) | Dark | Warm paper by day, dark "floodlight" for moments |
| Emotional promise | "I am in control" | "I am inside professional handball" | "This is *my* club, and it has a story" |
| Imagery | Minimal — data is the image | Maximal — portraits, arenas, light | Curated — photography & illustration in editorial frames |
| Navigation | 6 hubs in a left rail + ⌘K command palette | Top hub bar + full-bleed hub pages | Week Spine (timeline) + hub rail + Peek drawer |
| Risk | Can feel sterile; still "app-like" | Asset hungry; can bury depth; motion cost | Two modes to maintain; editorial tone needs good copy |
| Continuity with today | Low (new palette & type) | Low–medium (keeps navy/dark hero) | **High** — evolves today's paper/navy/signal-orange identity |

---

## Direction A — TACTICAL CLARITY ("Modern Manager")

**Idea.** The manager's tablet on the bench: crisp, cool, fast. Every pixel is information, but the
information is *ranked*. Football Manager depth with the clarity of the best modern productivity tools.

### Visual identity
- Light, airy surfaces on a cool neutral base; hairline dividers instead of boxes.
- One saturated accent — **Court Blue** — used only for focus, primary action and the user's own club.
- Data visualisation *is* the decoration: sparklines, distribution strips, deltas, heat cells.
- No photography in management screens; club crests and stylised monogram avatars only.

### Typography
- UI: **Inter** (variable, tabular figures `font-feature-settings: "tnum"`), 13/14 px base.
- Numbers & codes: **JetBrains Mono** (tabular) for attributes, money, minutes.
- Display: Inter Tight/Inter 700, sentence case, negative tracking (-0.02em). No all-caps shouting.
- Scale: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 32.

### Colour system
| Token | Light | Dark |
|---|---|---|
| bg | `#F5F6F8` | `#0C0F14` |
| surface | `#FFFFFF` | `#141922` |
| ink | `#0E1726` | `#E8ECF2` |
| muted | `#5B6576` | `#8C96A6` |
| line | `#E3E7ED` | `#232A36` |
| accent (Court Blue) | `#2257F5` | `#5B84FF` |
| positive / negative / warning | `#12A150` / `#E5484D` / `#D98A00` | brighter twins |
Attribute ramp (1–20): 5-step sequential blue → used everywhere an attribute appears.

### Component language
Hairline tables with sticky headers and inline micro-charts · compact "metric tiles" (label, value, delta, spark) ·
segmented controls · entity chips (crest/avatar + name, hover card on every entity) · keyboard hints on buttons ·
radius 8 px · elevation only for overlays (popover, palette, drawer).

### Navigation model
- **Left rail with 6 hubs**: *Today · Team · Club · Recruitment · Competition · Career* (replacing today's 24 flat sidebar items).
- Each hub has a **secondary tab row** (e.g. Team → Squad · Tactics · Training · Medical · Contracts).
- **⌘K / Ctrl-K command palette**: jump to any player, club, fixture or action ("offer contract Lindqvist").
- **Hover cards** on every player/club/staff mention; **Continue** is a fixed button in the top-right with a queue counter.
- Mobile: bottom tab bar (Today, Team, Match, Market, More), palette via search icon.

### Dashboard concept — "Briefing"
A ranked decision queue ("3 things need you today") above a compact KPI strip (league position, squad
fitness, board confidence, budget headroom) and a next-match card. Everything else is one click away.

### Player profile concept — "Dossier"
Two-column dossier: left identity column (avatar, role, contract, status), right **attribute matrix** with
sequential colour ramp, position fit on a mini court, form sparkline, and comparison toggle.

### Club concept — "Executive Office"
Department grid (Squad, Staff, Finance, Board, Facilities, Youth) each a status tile with trend and owner (staff face).

### Matchday concept — "Bench Tablet"
Compact live view: score bar, momentum line, 2D court, timeline, player energy table, one-tap timeout and substitution.

### Motion principles
Functional only: 120–180 ms ease-out for state changes, number tickers on value change, list reorders with
FLIP. No ambient motion. `prefers-reduced-motion` → instant.

### Mobile principles
Same information architecture; tables collapse to **ranked cards** with the top 3 columns; long-press = hover card.

**Strengths:** fastest to build on the current React/CSS stack; best for power users and accessibility; scales to deep data.
**Trade-offs:** least "game-like"; risks feeling like a well-designed SaaS product rather than a sports world.

---

## Direction B — ARENA NIGHTS ("Premium Sports World")

**Idea.** You are inside a televised handball league. The UI borrows the grammar of sports broadcast
graphics: dark arenas, light beams, big condensed numerals, player cut-outs, club colours everywhere.

### Visual identity
- Deep night-blue base, layered "glass" panels, subtle court-line patterns.
- **Club colour is the accent**: the whole UI re-tints to the managed club (primary + secondary).
- Portraits and environment photography are first-class: hero images on hubs, player busts on cards.
- Broadcast lower-thirds, score bugs and ticker tape as recurring motifs.

### Typography
- Display: **Barlow Condensed** 700/800, UPPERCASE, slight italic for numerals in score bugs.
- UI: **Barlow** 400/500/600.
- Numbers: Barlow Condensed tabular for stats; huge numerals (64–120 px) for scores and positions.

### Colour system
| Token | Value |
|---|---|
| bg | `#070B12` |
| surface | `rgba(255,255,255,0.04)` over gradient `#0E1626 → #070B12` |
| ink / muted | `#F4F6FA` / `#9AA6B8` |
| line | `rgba(255,255,255,0.10)` |
| accent | **club primary** (default `#FF4D2E`), glow = club primary @ 35% |
| secondary accent | club secondary (default `#FFC531`) |
| positive / negative | `#2BD98A` / `#FF5A6A` |

### Component language
Glass cards with 1 px inner highlight · angled corner cuts ("broadcast tabs") · large hero bands with environment
photography · player cards (bust, number, rating badge) · ticker · score bug · radius 14 px.

### Navigation model
- **Top hub bar** (club crest + 6 hubs + Continue), each hub opens a **full-bleed hub page** (Clubhouse, Squad Room,
  Scouting Office, Arena, Press Room, Manager's Office) using the existing environment photography.
- Inside a hub, content is organised as **stacked broadcast panels** you scroll through.
- Mobile: swipeable full-screen cards, bottom bar with a central **Continue** button.

### Dashboard concept — "Matchweek Show"
A broadcast-style opener: next-match hero with both crests and a countdown, ticker of league news, and
"storylines" cards (player in form, injury worry, board mood).

### Player profile concept — "Athlete Spotlight"
Full-bleed portrait/bust, number and name in giant type, career timeline, signature strengths as badges,
season stats as broadcast graphics; attributes are a secondary tab.

### Club concept — "Clubhouse"
Interactive environment: the club building with rooms (Office, Dressing Room, Tactics Room, Medical, Press,
Boardroom). Each room shows its staff member and live status.

### Matchday concept — "Broadcast"
Walk-out sequence → full-screen 2D/2.5D court with score bug, lower-third event captions, and replay cards.

### Motion principles
Expressive but purposeful: hub transitions as camera moves (shared-element crests, 300–450 ms), staggered card
reveals, number count-ups, signature moments (goal, signing, promotion) get a 1.5–3 s celebration that is always skippable.

### Mobile principles
Card-stack navigation; each card = one story/decision. Detail via bottom sheets.

**Strengths:** most "video-game" feel; strongest emotional pull; great for marketing/screenshots.
**Trade-offs:** needs a real asset pipeline (portraits, environments); dark dense tables are harder to read for long
sessions; highest motion/perf cost; risks hiding depth behind presentation.

---

## Direction C — PAPER & FLOODLIGHT ("Hybrid") — *recommended starting point*

**Idea.** Management is calm, editorial and readable — like a beautifully typeset club journal on warm paper.
But when something *happens* (matchday, a signing, a promotion, a sacking) the lights go down and the
**Floodlight** mode takes over: dark, cinematic, broadcast. Depth by default; spectacle by moment.

This evolves the identity the game already has (`--game-paper #f3f1ea`, navy `#0f1b2d`, signal `#c84320`,
condensed display type in `apps/game/app/tokens.css`) instead of throwing it away.

### Visual identity
- **Paper mode** (management): warm paper base, ink navy, signal orange accent, generous editorial headlines,
  photography in framed editorial crops, rules (horizontal lines) instead of boxes.
- **Floodlight mode** (moments): navy-black, club colours, light beams, big numerals.
- Club colour appears as a thin "club stripe" and in crests; signal orange stays the system accent.

### Typography
- Display: **Saira Condensed** 700 / existing Bahnschrift SemiCondensed fallback — uppercase for section kickers,
  title case for headlines.
- Editorial serif for story headlines & quotes: **Source Serif 4** (news, press, history).
- UI: **IBM Plex Sans**; numbers: **IBM Plex Mono** tabular.

### Colour system
| Token | Paper | Floodlight |
|---|---|---|
| bg | `#F3F1EA` | `#0B1220` |
| surface | `#FBFAF6` | `#121B2C` |
| ink | `#131B26` | `#F1EEE6` |
| muted | `#5A6675` | `#9BA6B5` |
| line | `#DCD8CC` | `rgba(241,238,230,.12)` |
| accent (Signal) | `#C84320` | `#FF6A3D` |
| gold (achievement) | `#C99218` | `#F2C14E` |
| positive / negative | `#1E7045` / `#B42828` | `#3DDC97` / `#FF6B6B` |

### Component language
Rules & columns (newspaper grid) · kicker + headline pattern · numbered "decision cards" · entity chips ·
framed photo blocks · tables with zebra-free hairlines and inline bars · radius 4–6 px (paper is not round) ·
Floodlight components: score bug, hero band, celebration card.

### Navigation model
- **Week Spine**: a persistent horizontal timeline under the top bar (Mon–Sun + next matches). It is the game's
  heartbeat: Continue advances along it; every day shows training, match, deadline and event pins.
- **Hub rail** with 6 hubs (same IA as A) + **Peek drawer**: clicking any player/club/staff/fixture opens a right-side
  drawer without losing context; "Open full page" for depth.
- Mobile: *Today* feed first; bottom bar (Today, Team, Match, Market, Club); the Week Spine becomes a swipeable strip.

### Dashboard concept — "Today's Paper"
Front page of the club journal: lead story (biggest thing happening), decision column (numbered), next match box,
league table snippet, "around the league" briefs — all generated from real game state.

### Player profile concept — "Feature Profile"
Editorial header (portrait/avatar framed, kicker "Högersexa · #23"), a **Profile column** of strengths/weaknesses in
words, attribute groups with inline bars, development timeline, season ledger; Peek-drawer variant for quick looks.

### Club concept — "Club Journal + Clubhouse map"
A club front page (identity, history strip, departments, board mood) with an optional illustrated clubhouse map.

### Matchday concept — "Floodlight Sequence"
Paper → Floodlight transition: Preparation checklist (paper) → Walk-out (floodlight) → Live (floodlight, readable
data panels) → Full-time story (back to paper as an editorial match report).

### Motion principles
Calm in paper (page-turn fades 160 ms, drawer slides 220 ms); expressive in floodlight (lights-down transition 600 ms,
count-ups, goal pulses). Mode switch itself is the signature animation. Reduced motion: crossfade only.

### Mobile principles
"Morning paper" — a vertical Today feed of decision cards and stories; deep management screens adapt to single
column with sticky section headers; match is portrait-first floodlight.

**Strengths:** best balance of depth and atmosphere; continuity with current brand; spectacle budget concentrated
where it matters (cheaper than B); distinctive — no competitor uses an editorial/journal identity.
**Trade-offs:** two visual modes to design and test; editorial voice depends on good text generation from game events.

---

## 4. How the directions compare across the journey

| Journey step | A — Tactical Clarity | B — Arena Nights | C — Paper & Floodlight |
|---|---|---|---|
| Opening the game | Clean career list + "continue where you left off" summary | Cinematic arena title, club crest fly-in | Journal cover of your current career ("Week 12 — Tumba travel to Kristianstad") |
| Entering the club | Hub rail lands on Today | Clubhouse environment | Front page |
| Dashboard | Decision queue + KPIs | Matchweek show | Today's Paper |
| Opening a player | Dossier (matrix) | Athlete Spotlight | Peek drawer → Feature profile |
| Staff/training | Weekly grid planner | Training hall scene with staff cards | Week Spine-driven plan with assistant proposal |
| Scouting | Search table + saved filters | Scouting office board with player cards | Shortlist "board" + scout report articles |
| Matchday | Bench tablet | Broadcast | Floodlight sequence |
| Result | Stats sheet | Highlight show | Editorial match report |
| Returning | Queue refreshed | Locker-room celebration / blues | Next day's paper with the result as lead |

## 5. Shared token contract (applies to every direction)

All prototypes use **semantic tokens only** (no raw colours in components):

```
--bg --bg-2 --surface --surface-2 --raised
--ink --ink-2 --muted --line --line-strong
--accent --accent-ink --accent-soft
--club --club-2 --pos --neg --warn --info --gold
--font-ui --font-display --font-num --font-editorial
--display-transform --display-weight --display-tracking
--radius --radius-lg --shadow --shadow-lg
--attr-1 … --attr-5 (attribute ramp)   --data-1 … --data-6 (categorical)
```

This means: (1) direction choice is mostly a token + shell decision, (2) individual surface alternatives can be
chosen independently, and (3) a future production design system can ship one component library with
three (or one) themes. See `HM-EXPERIENCE-2027-VISION.md` §Design System for the full component inventory.

## 6. Which identity-level decisions must be made first

1. **Base temperament** (A / B / C) — drives tokens, type, imagery budget.
2. **Navigation model** (Hub rail + palette / Top hub bar / Week Spine + Peek) — affects every surface.
3. **Imagery policy** (none / portraits+environments everywhere / curated moments) — drives asset pipeline cost.
4. **Portrait strategy** (monogram / stylised generated busts / photo) — legal and production implications.
5. **Motion budget** (functional / expressive / moment-based).
6. **Density modes** (single / compact+comfortable toggle).

These are recorded as global decisions G1–G6 in `HM-EXPERIENCE-2027-OWNER-DECISIONS.md` and in the Lab.
