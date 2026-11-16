# HM Experience 2027: Competitor and Genre UX Research

**Status:** Research deliverable, v1.0
**Date of research / access date for all sources:** 2026-11-12
**Scope:** User experience of management and simulation games, to inform the redesign of the Handball Manager web app (Next.js, desktop and mobile).
**Coverage:** 24 games. 7 deep dives: Football Manager 24, 26 and 27 preview; F1 Manager 2024; OOTP 25/26; Motorsport Manager; NBA 2K MyNBA/MyGM; Two Point Hospital/Campus; Basketball GM. 17 shorter entries.

---

## 1. Method and evidence policy

### 1.1 Method
1. Ran targeted web searches for each game across official sites and dev blogs, Steam store pages, reputable reviews, community threads, and UI references such as Game UI Database.
2. Opened the primary pages (WebFetch) where they were reachable. Several outlets blocked automated fetches: PC Gamer article bodies were truncated, and f1manager.com, operationsports.com, stuff.tv and gameuidatabase.com search pages returned 403. For those pages I used the search-engine snippets and labelled them as such.
3. Grouped the findings by UX dimension: landing, navigation, home/dashboard, hierarchy, player profiles, club identity, staff, scouting, transfers, competition, matchday, news/inbox, time advance, animation, desktop vs mobile.
4. Built the pattern library (Section 5) and the anti-patterns (Section 6) only from patterns seen in at least one evidenced source. Where a pattern rests on prior genre knowledge, it says so.

### 1.2 Evidence tags (used throughout)

| Tag | Meaning |
|---|---|
| **[V n]** | Verified. I opened and read source *n* in Section 8. |
| **[S n]** | Snippet. Taken from a search-result summary of source *n*; the page itself was not fully read. Treat as secondary. |
| **[K]** | Prior genre knowledge. Not re-verified in this session. Plausible, but confirm against current builds before relying on it. |
| **[I]** | Inference. My design interpretation, not a factual claim about the game. |

**Rules followed:** no features are invented from marketing copy, marketing claims are labelled "official claim", and quotations are at most a few words. No images or binaries were downloaded. Visual references are URLs only. Steam store fetches did not expose individual screenshot URLs, so the visual references are the Steam app page, which hosts the screenshot gallery, plus Game UI Database game pages where they exist.

### 1.3 Known gaps
- **Handball Manager 2021/2022 (netmin games):** very thin public critique. One substantive Steam feedback thread and the store page.
- **F1 Manager 2024:** the official feature pages returned 403. Mentality-hub UI details come from secondary coverage.
- **OOTP 26:** no detailed UI review found. The "improved UI experience" is an official claim. OOTP 27 (2026) claims a redesigned interface.
- **Hattrick, Top Eleven, EHM, Franchise Hockey Manager, Pro Cycling Manager:** UI-specific evidence is shallow or dated.
- **Game UI Database:** no entries found for Football Manager, F1 Manager, Motorsport Manager or Crusader Kings III.

---

## 2. Summary matrix

Short notes. Tags refer to Section 8. "—" means no evidence found.

| Game | Landing / Home | Navigation | Player / People | Recruitment / Transfers | Matchday / Event | News / Inbox | Time advance | Desktop vs Mobile |
|---|---|---|---|---|---|---|---|---|
| **FM24** | Inbox-centred home [S16] | Left sidebar, deep menus [K] | Rich profiles; poor newgen faces [V13] | TransferRoom, intermediaries; stiff agent talks [V13] | 2D/3D highlights, smooth animations [V13] | Inbox items such as the pre-match "Match Focus" [S14] | Continue, top right (console/mobile manuals) [S15][S16] | Separate Touch and Mobile SKUs; iPhone-optimised [S17][S18] |
| **FM26** | **Portal** = Home + Inbox merged [V1] | Top navbar, tiles that open Cards, bookmarks, global search [V1] | Compact tiles; fitness harder to read [V4] | Recruitment tab; TransferRoom felt like hand-holding [V5] | Shouts removed at launch, later restored [V4][S10][S12] | Filters All/New/Tasks/Unread; action panel [V1] | — | One UI for PC, console and phone, which SI called "detrimental" [V2] |
| **FM27 (preview)** | Portal kept | Six primary sections, secondary toggle, control panels, fewer full-screen cards [V3] | — | Recruitment control panel [V3] | Swappable match tiles [V3] | Colour-coded, inline actions, consolidated [V3] | — | Scaling modes Default/Detailed/Condensed [V3] |
| **F1 Manager 2024** | HQ/facilities management [V21] | Tabbed, text-heavy; "could be pared down" [V21][S28] | Driver/staff **Mentality** [S22][S23] | Contracts confusing [V21] | Live race with cameras, track map, per-driver tactics [V21] | — | Calendar, Race Targets, Engagement Activities [V21] | Controller-friendly [S30] |
| **OOTP 25/26** | Configurable manager home boxes [S34] | Dense menu tree, configurable [K] | Selectable rating scales (20-80 etc.) [S38] | Draft Central, Draft Pipeline [V32] | 3D view plus dynamic scoreboards [V32] | — | Sim to date [K] | PC; separate mobile "OOTP Go" [S] |
| **Motorsport Manager** | HQ buildings [S45][S46] | "Clean and fluid" [S41] | Driver personalities and demands [V40][S44] | Scouting HQ widens search [V40] | Practice with feedback bars, pit predictions [V40][S43][S47] | Chairman expectations [V40] | Season calendar [K] | Mobile origin; PC version "torn" [S41] |
| **NBA 2K MyGM/MyNBA** | Walkable GM office [V48] | Calendar plus landing menus [V48] | 7-role MySTAFF; RPG GM attributes and perks [V48] | Trade logic varies with sim mode [S49] | Full 3D NBA games [K] | Era-styled news hub: newspaper, web 1.0, social [V48] | Sim speeds Faster/Smarter [S49] | Console/PC |
| **Two Point Hospital/Campus** | 3D building is the dashboard [K] | Tabs for rooms and items [S58] | Staff traits make "people" [V54] | Hiring by traits and qualifications [V54] | — | Tannoy/radio as feedback [S56][S57] | Real-time with speed control [K] | Console editions with gamepad UI [V52][V53] |
| **Basketball GM** | League dashboard [V61] | Left menu, command palette Ctrl+K [V61][V63] | Hover ratings snapshot [V63] | "What would make this deal work?", trading-block filters [V61] | Live play-by-play log [V61] | News feed lacking dates/recaps [V63] | **Big green Play menu** [V62] | Browser; local IndexedDB [S] |
| Handball Manager 2021 | — | "Clunky" menus (player) [V65] | Dated portraits [V65] | — | Live real-time match [V64] | "Intuitive e-mail system" (official claim) [V64] | — | PC only |
| Hattrick | Browser | — | — | Transfer market [V69] | Weekly matches [S] | — | Real-time weekly cadence [V69] | Browser plus paid mobile [V69] |
| Top Eleven | Mobile | — | — | — | 3D live matches since 2022 [V70] | — | Real-time daily cadence [K] | Mobile-first |
| EA FC Career | — | Menu UI criticised in FC25 [S73] | Unsettling youth faces [S73] | Youth academy from 13 [S73] | Full 3D | — | — | Console |
| Pro Cycling Manager | Multi-panel office | "Not very inviting" [S74] | — | — | 3D race with real-time orders [S74] | — | — | PC |
| EHM / FHM | — | FHM "cumbersome" [S76] | OOTP-style stars (FHM) [S76] | — | Text/2D | — | — | PC |
| Planet Zoo / Coaster 2 | — | Menus inside menus [S77] | — | — | — | Vague notifications [S77] | — | Console poor fit [S77] |
| Cities: Skylines II | — | Toolbar redesign by Iceflake [S78] | — | — | — | — | — | — |
| Anno 117 | — | Grouped production menus, too many clicks [S79] | — | — | — | — | — | PC and console together [V79] |
| Frostpunk | — | Hope and Discontent bars [S80] | — | — | — | — | — | — |
| CK3 | — | Nested, lockable tooltips [V81][S81] | — | — | — | — | — | — |
| Persona 5 | — | Expressive menus; parsing hard [S82] | — | — | — | — | — | — |
| Hades | — | — | Visual-novel portraits [S83] | — | — | — | — | — |

---

## 3. Deep dives

### 3.1 Football Manager 24, FM26 redesign, FM27 preview (Sports Interactive / SEGA)

**Why it matters most:** FM is the reference product for anyone playing Handball Manager. FM26 is also a large, public, well-documented case study of a UI redesign going wrong. FM27's announced corrections show what the market leader learned.

#### FM24 baseline (the "familiar" that FM26 broke)
- **Landing / home:** On console, the inbox acts as the central hub between matches [S16]. The PC left-sidebar plus inbox-home structure is long-standing [K].
- **Time advance:** The console manual places Continue in the top-right corner. On mobile, the Continue Game button changes to "Go To Match" when match day arrives [S15][S16]. This is a single, context-mutating primary action.
- **Inbox as task queue:** FM24 added a pre-match inbox item for setting one tactical and two set-piece focuses, the "Match Focus" session [S14]. Decisions arrive as messages.
- **Squad Planner:** FM24 reworked it to flag squad depth, ability gaps and role conflicts "at a glance". A selected row shows best role, current-role ability and contract [S14].
- **Player and staff presentation:** 3D newgen faces were criticised as poor. Player interactions repeat the same lines [V13].
- **Transfers:** TransferRoom replaced "offer to clubs". Intermediaries take a cut. Agent conversations stayed stiff [V13].
- **Matchday:** Highlights praised as smooth with new ball-control animations. Crowds still look like a loop [V13].
- **Pacing problem:** The reviewer reported "overstimulation" from tasks, data, meetings and press on returning to a save, and estimated about 50 hours per season [V13].
- **Mobile:** The FM24 Touch iPhone interface was redesigned for phone screens and praised as a "proper game" on iPhone [S18]. FM24 Mobile (Netflix) is the most streamlined edition [S19]. iPad Touch was the reviewer's favourite way to play [S17].

#### FM26: what changed (official) [V1]
- **Design goals:** stated as Efficiency, Familiarity and Predictability, plus larger fonts and defined colour contrast.
- **Top navbar:** replaces the left sidebar. Each category opens an extensive sub-menu.
- **Tiles and Cards:** tiles are the building blocks of every screen. Clicking a tile opens a Card with detail.
- **Portal:** merges Home and Inbox into one hub, with:
  - message filters: All, New, Tasks, Unread
  - an action panel flagging decisions
  - an Advice dropdown for Coaching, Recruitment, Development and Staffing
  - news, upcoming fixtures and a two-week calendar snapshot
- **Bookmarks:** 6 by default, chosen from 24.
- **Universal search:** covers objects, information and navigation, including tiles, messages, news and guides.
- **FMPedia:** an in-game glossary reachable from a ribbon icon or from search.

#### FM26: how players and press reacted
- **Steam:** "Mostly Negative", 38% positive of 15,651 English reviews. Recent reviews are "Mixed" at 63% [V9]. Coverage called it among the worst-rated Steam launches [S7][S8].
- **SI admission:** Miles Jacobson acknowledged frustration with "navigation and the loss of immersion". He said aiming for one experience across PC, console and phone had been "detrimental" to many players [V2].
- **Specific complaints:**
  - Budgets and staffing need "further clicking and digging" [V4].
  - Text and player info are smaller. Fitness is harder to read because FM24's big tiles became compact [V4].
  - Opening news from the Portal needs an extra click [V4].
  - Screen transitions are delayed [V4].
  - Injuries are hard to spot on the tactics screen mid-match [V4].
  - Managing between matches is a "navigational nightmare" [V5].
  - Lower information density from "controller-friendly" blocks instead of mouse-friendly lists [V5].
  - Irritating pop-ups [V5].
  - A press conference takes four steps: inbox item, "Go to Press Conference", a separate Start button, then the questions [V5].
  - The reviewer automated training and scouting to avoid the clicks [V5].
  - League tables sit behind "a panel … behind a tab … behind a dashboard" [V6].
  - Buttons don't look like buttons [V6].
  - Lists such as penalty takers lack the relevant attributes, so each player must be opened [V6].
  - Drag-and-drop training was removed [V6].
  - The live stat panel can't be customised. Pass maps and heat maps are gone. Attributes can't be viewed mid-match [V6].
- **Immersion loss:** touchline shouts and team-talk gestures were removed. Reviewers felt "detached" [V4][S10]. Shouts were later restored in an update [S12]. Sources disagree on which update.
- **Praise:**
  - In and out of possession tactics tabs [V6].
  - Plain-English role descriptions with small 2D animations [V6].
  - Prettier UI and a stronger match engine [V6][S11].

#### FM27 preview: the correction [V3]
- **Tile roles split:** tiles become mainly informational, and navigation moves back to the menus.
- **Primary menu:** Portal, Squad, Tactics, Recruitment, Training, Club. Each opens directly on core content.
- **Secondary navigation:** the toggle is re-introduced, so you can switch screens without going back to an overview.
- **Control panels:** a panel at the top of each area gathers key actions, such as team meetings and delegation in Squad, or budget and staff advice in Recruitment.
- **Cards:** fewer, and full-screen.
- **Messages:**
  - colour-coded by topic
  - scout reports inline
  - multiple offers for one player consolidated into one message
  - actions handled inline
  - more tooltips
- **Scaling:** Default, Detailed or Condensed modes. Tables fill vertical and horizontal space.
- **Customisation:**
  - choose the landing screen for each primary menu
  - shortcut remapping is back
  - bookmarks gain text labels and can be reordered
  - same-size tiles can be swapped via dropdowns, including on the Match Day Interface

#### Named patterns and why they work
- **Continue as heartbeat** (FM24 to 27): one persistent primary action carries the session's rhythm, and its label changes with context ("Go To Match") [S15]. *Why it works:* it cuts decision load to one obvious next step and creates a "one more day" compulsion loop [I].
- **Inbox as task queue** (Portal filters: Tasks, Unread; inline actions in FM27) [V1][V3]. *Why it works:* the world comes to you as a to-do list, and inline resolution prevents context switches [I].
- **Tile to Card drill-down:** glanceable summary, then detail [V1]. *Why it failed:* tiles were also the navigation, so every lookup became a modal round trip [V3][V5]. The lesson is to separate "inform" from "navigate".
- **Advice dropdown and staff advice:** staff voices surface recommendations by domain [V1].
- **Bookmarks, plus a configurable landing screen per section** [V1][V3]: lets experts shape their own route through the game.
- **Global search across entities and navigation** [V1]: a command-palette-like escape hatch.

#### Adopt / does not fit / inspire (for HM)
- **Adopt:**
  - a Portal-style home that merges inbox, next fixture, two-week calendar and an action panel
  - filters for Tasks and Unread
  - inline actions in messages
  - consolidated messages per subject
  - control panels per area
  - a scaling/density setting
  - global search
  - an in-game glossary in the spirit of FMPedia, for handball terms such as 7v6, passive play and 2-minute suspensions
- **Does not fit:**
  - one input model for every device. Build responsive density instead.
  - modal cards for routine lookups
  - multi-step ceremonies for frequent tasks, such as press conferences
- **Inspire:** a handball-specific "Match Focus" inbox item before each game. For example, choose one defensive system emphasis (6-0 or 5-1) and one 7v6 or set-play rehearsal, so the pre-match decision becomes a ritual rather than a menu dive [I].

**Visual references:**
- FM26 Steam page and gallery: https://store.steampowered.com/app/3551340. Steam feature image example: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3551340/extras/1cec9d1b9691a5398ece912df96e4659.webp [V9].
- FM26 UI article: [V1].
- FM27 UI article with footage: [V3].

---

### 3.2 F1 Manager 2024 (Frontier)

- **Landing / HQ:** facilities such as Suspension Simulator, CFD, Team Hub and Weather Centre can be upgraded. They need refurbishing over time, so their condition is ongoing maintenance [V21]. An update improved the Facilities screen UI [S25].
- **Navigation and hierarchy:**
  - fluid despite heavy information; tab switching easy once learned; reviewer felt it could be "pared down" [V21]
  - "text-heavy menus" in a slicker UI [S28]
  - UI barely changed from 2023; three colour-blind modes [S26]
  - the 2022 review noted deeper submenus become less self-explanatory [S31]
- **Data visualisation:** official claim of refreshed data visualisations and a UI that signals how much each car area matters before upcoming races [S25].
- **People / Mentality:** a mood system for drivers and staff, driven by car performance, facilities, sponsors and engagement activities [V21][S23]. It affects performance, development and negotiation patience [S23]. Coverage describes a Mentality Hub showing every team member's mentality [S24]. One reviewer found it "more bark than bite" [S].
- **Staff presentation:** driver likenesses "serviceable". Some models look lifeless. Drivers comment on events that never happened on screen, which breaks immersion [V21].
- **Recruitment / contracts:** the Contracts flow was confusing, especially when counter-offers were not received. Frontier promised fixes [V21].
- **Matchday (race weekend):**
  - practice and qualifying can be played or simulated; the full weekend can be simulated (official) [V20]
  - live race shows lap times, fuel, temperatures and tyre degradation, with per-driver tactics [V21]
  - camera range from a track map with icons to cockpit view, plus Helicam (official) [V20][V21]
  - the 2022 race view showed weather only as a small top-right bar, which was criticised [S30]
- **Progression:** a season calendar, per-race Race Targets, and scheduled Engagement Activities such as sponsor events and factory tours, with consequences [V21].
- **Identity:** Create a Team covers origin, livery, logo, suits and sponsor placement on the car (official) [V20].

**Named patterns:**
- **Paddock/garage hub:** facilities as a visible place.
- **Mood as a system with a hub:** Mentality Hub.
- **Race Targets as micro-goals per event.**
- **Play or simulate each session.**
- **Broadcast camera switcher.**

**Why they work:** the HQ makes investment tangible. Per-event targets give each weekend a narrative arc. Choosing how much to play respects players' time [I].

**For HM:**
- **Adopt:**
  - per-match targets set by the board or coach ("win by 3+", "under 25 conceded")
  - a play-or-sim choice per fixture
  - facilities as a visual hall/training-centre view
  - a Mentality-style squad mood overview with causes
- **Does not fit:** a multi-session weekend structure. Handball has one match and no qualifying.
- **Inspire:** a "bench wall" live view (track map → court map; tyre wear → player load and 2-min suspension status; radio → bench calls) [I].

**Visual references:** https://store.steampowered.com/app/2591280 ; header https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2591280/header.jpg [V20].

---

### 3.3 Out of the Park Baseball 25/26 (OOTP Developments)

- **Landing / home:** the manager home shows reputation, career record and salary in boxes. Users found box count limited by font size, and a developer said the layout would be reviewed [S34]. Team-home units with facegens failed to render until a tab switch (bug) [S34].
- **Navigation:** historically dense. Reviews mention the "odd confusing menu" [S37], a steep learning curve for newcomers [S36], and settings spread across at least three player-related screens [V35].
- **Information hierarchy:**
  - stats screens are not all customisable, and sortable fields are not clearly marked [V35]
  - OOTP 26 lists an "Improved UI experience" (official claim) [V32]
  - OOTP 27 claims a redesigned interface with improved calendars, in-game screens and player pages (official) [V33]
- **Player profiles / ratings:**
  - selectable rating scale: 1-5, 1-10, 1-20, 20-80, 1-100, or scouting off. 20-80 is the community norm [S38].
  - scouting error is applied non-uniformly across scales, so users distrust the summary stars versus individual ratings [S38]
  - Scouting accuracy is a league setting [S38]
- **Scouting / draft:**
  - OOTP 26 adds Draft Central, a draft combine, and a Draft Pipeline with expert opinions (official) [V32]
  - Player Development Lab 2.0 adds progress bars and mid-term reports (official) [V32]
- **Matchday:** a 3D view and dynamic scoreboards with live info (official) [V32]. Critique: unrealistic animations, a replay without search, and too many close-up cameras [V35].
- **Delegation:** OOTP lets you hand lineup, roster and other duties to AI [K].

**Named patterns:**
- **Player-chosen rating scale.**
- **Scouting-fogged ratings.**
- **Progress reports on development plans.**
- **"Central" screens for annual events** (Draft Central).

**Why they work:** a choice of scale serves both stat-heads and casuals. Fogged ratings make scouting meaningful [I].

**For HM:**
- **Adopt:**
  - fog of war on opponent and youth ratings, tied to scouting investment
  - development plans with mid-term progress reports
  - a "Central" screen for the season's peak events (transfer window, youth intake, EHF qualification)
- **Avoid:** settings sprawl and non-sortable stat tables.

**Visual references:** https://store.steampowered.com/app/3116890 [V32].

---

### 3.4 Motorsport Manager (Playsport Games, 2016)

- **First impression / UI tone:**
  - "clean and fluid" [S41], "clearly-labelled" [S42], help "a click away" [S42]
  - depth hidden behind a slick interface [S]
  - polish consistent across practice, qualifying and race [S43]
  - the PC version is "torn" between mobile feel and full sim [S41]
- **HQ:** factory and design centre start at base level and must be upgraded before more of the HQ opens [S45]. The team chosen sets HQ size [S46]. A scouting HQ upgrade lets you research more drivers at once. Tour centre and theme park add revenue [V40]. HQ location affects which drivers want to join (official) [V39].
- **People:**
  - drivers have stats, a marketability rating and personality traits [V40]
  - drivers voice frustration at your decisions [V40]
  - one driver disliked his mechanic and demanded the mechanic be fired [V40]
  - drivers comment during races and make demands you may meet or ignore [S44]
  - official: personalities create drama, managed with "tough love or support" [V39]
- **Chairman:** expects a stated finishing position, and missing it can cost your job [V40].
- **Race weekend:**
  - practice sets car setup from driver feedback [S43]
  - a fan guide describes feedback as a green bar zone with smiley icons per setup category [S47] (low confidence)
  - you get limited attempts within a session [S41]
  - the pit screen predicts stop duration, added time for fuel and repairs, and rejoin position [V40]
  - weather forecasts inform tyres [V40]
- **Criticism:** the tutorial skips car balancing, the game feels "a little too distant", and decisions feel reactive [V40].

**Named patterns:**
- **Feedback zone bar:** a target band rather than raw numbers.
- **Predictive consequence preview:** for example, rejoin position after a pit stop.
- **Driver demands as story beats.**
- **HQ unlock tree as visible progression.**

**Why they work:** the previews turn uncertainty into an informed trade-off. Target bands make a complex optimisation feel like a skill game. Demands personify the simulation [I].

**For HM:**
- **Adopt:**
  - predictive previews, such as projected fatigue at 45' if a player stays on, or the expected 7v6 swing
  - player demands as inbox story beats
  - training-centre upgrades as a visible tree
- **Inspire:** a "rhythm band" for a tactical sliders preview (tempo, risk), showing the target zone based on the opponent [I].

**Visual references:** https://store.steampowered.com/app/415200 [V39].

---

### 3.5 NBA 2K MyNBA / MyGM (2K25, 2K26)

- **Landing / home:** the MyGM Building is a free-roam front office. You walk up to staff to start conversations [V48].
- **Navigation:** conversation requests from the Governor or staff appear as notifications on the calendar or other landing menus [V48]. Reviewers felt the menus "show age" and could use "a fresh coat of paint" [S50].
- **Staff presentation:** MySTAFF was simplified to seven roles: Governor, GM, Assistant GM, CFO, Head Coach, Head Scout, Team Doctor. Bonus Staff can be reassigned to a department, for example to the Head Coach for the playoffs [V48].
- **Manager as RPG character:**
  - six GM attributes; backstories such as Ex-Player, Ex-Scout and Savant set starting perks
  - XP from goals; level cap 20; perks at levels 4, 8, 12 and 16 [V48]
  - attributes unlock dialogue options [V48]
  - being fired ends the game [V48]
- **Conversations:** fewer, more impactful conversations replace small talk [V48].
- **News:** the **League News hub changes with the era**: newspaper, then web 1.0, then a web 2.0 page styled like NBA 2K11 menus, then a social feed [V48].
- **2K26:**
  - 30 offseason scenarios, each with three team-specific goals
  - simulation modes such as Faster vs Smarter trade logic
  - a pre-season governor meeting that sets goals, budget and core directives
  - dynamic arena banners [S49]

**Named patterns:**
- **Staff as faces of systems.**
- **Manager progression tree.**
- **Era-skinned news.**
- **Scenario starts with three goals.**
- **Pre-season directive meeting.**
- **Fewer, weightier conversations.**

**Why they work:** faces turn abstract systems into relationships. Perks give the manager a growth arc. Scenario goals cut the blank-slate paralysis of the first session [I].

**For HM:**
- **Adopt:**
  - a pre-season board meeting that sets objectives and budget
  - "scenario starts", such as rescuing a relegation club or building a Champions League contender
  - a small named staff cast (assistant coach, goalkeeper coach, physio, scout, director) as the voices of systems
  - fewer, weightier conversations
- **Does not fit:** a walkable 3D office on web/mobile, which is too costly and slow [I].
- **Inspire:** news-hub styling by club tier (local paper for amateurs, national sports portal for the top league) [I].

---

### 3.6 Two Point Hospital / Two Point Campus (Two Point Studios / SEGA)

- **Design philosophy:** coverage cites Gary Carr saying the team avoided lots of tables and let players discover the depth through play [S55]. A preview says the UI is kept "nice and simple" [S55].
- **Feedback channel:** a passive-aggressive tannoy announcer and a county radio station [S57]. The snarky announcer drew attention to problems [S56]. Lines "wear thin" after repetition [V54].
- **Staff:**
  - hiring compares qualifications, temperament and traits, which makes choices meaningful [V54]
  - traits make staff feel like people: they plead when threatened with firing and chat in hallways [V54]
  - staff requests point to where the hospital needs work [V54]
  - names carry the humour [V54]
- **Campus:**
  - UI separated into tabs for rooms, indoor items and outdoor items [S58]
  - objectives earn stars per campus, and a mentor character guides them [S]
  - criticism: hard to find why a student has low grades [S59]
  - few accessibility options beyond subtitles and UI scale [S]
- **Criticism:** no prefab rooms, repetitive rebuilding, and unspecified "UI gripes" [V54]. TechRaptor cites interface and QoL lacks [S56].

**Named patterns:**
- **Diegetic narrator** (tannoy and radio).
- **Traits as personality.**
- **Star-tier objectives.**
- **Discover depth rather than read tables.**

**Why they work:** humour lowers the cost of failure. A narrator gives a single prioritised voice for problems. Stars give clear mastery goals [I].

**For HM:**
- **Adopt:**
  - a stadium announcer or local radio voice for news and alerts, with variety budgets to prevent repetition
  - player and staff traits written as personality, not numbers alone
  - season star objectives
- **Guard:** always provide the "why" drill-down. The Campus criticism shows charm cannot replace explanation [S59].

**Visual references:**
- https://www.gameuidatabase.com/gameData.php?id=99 (TPH PC)
- https://www.gameuidatabase.com/gameData.php?id=699 (TPH Console)
- https://www.gameuidatabase.com/gameData.php?id=1508 (Campus gamepad)
- https://store.steampowered.com/app/535930 , https://store.steampowered.com/app/1649080

---

### 3.7 Basketball GM / ZenGM (browser; the closest technical analogue)

- **Time advance:** a **big green Play button** at the top opens the Play Menu, holding all context-dependent actions: play games, or advance a phase [V62].
- **Phases:** preseason, regular season, playoffs, draft lottery, draft, re-sign players, free agency [V62]. The season is a visible state machine.
- **Navigation:** left menu with collapsible sections and a Dashboard link [V63]. A **command palette (Ctrl/Cmd+K)** for keyboard navigation [V61]. Collapsed menus hid features such as the fantasy draft, which the reviewer missed [V63].
- **Tables:**
  - searchable, filterable, downloadable [V61]
  - a "…" menu on any player table enables bulk actions [V61]
  - league leaders in bold on profile stats [V61]
  - career totals across chosen season ranges [V61]
  - missing historical stats shown as null rather than 0 [V61]
- **Player hover:** hovering a bar-graph icon by a name shows a ratings snapshot, positives in green and negatives in red. The reviewer wanted it on every screen [V63].
- **Trades:**
  - "What would make this deal work?" button with "untouchable" exclusions [V61]
  - trading-block filters [V61]
  - Trade Summary page [V61]
- **Owner messages:** a short summary plus a performance-history chart [V61].
- **News:** praised for expandable score items. Criticised for lacking dates and recaps, and for unclear categories [V63].
- **Live sim:** play-by-play log redesign; running stat totals in the log [V61].
- **Cross-device:** runs in any browser. Saves are local, so moving between devices means manual export and import [V63].
- **Team notes:** a free-text note per team and season [V61].

**Named patterns:**
- **Single Play menu as the state machine.**
- **Command palette.**
- **Hover cards.**
- **"Make it work" negotiation helper.**
- **Bulk actions on any table.**
- **Notes on entities.**

**Why they work:** experts move fast, and the AI explains what it wants instead of leaving you to guess-and-check [I].

**For HM:** HM is a Next.js web app, so these patterns transfer almost one-to-one.
- **Adopt:**
  - command palette
  - hover cards (long-press on mobile)
  - "what would make this work" in transfers
  - bulk actions
  - season phases as an explicit state
  - dated, categorised news with weekly recaps, which fixes BBGM's criticised gap
  - **server or cloud saves**, which fixes the cross-device pain

---

## 4. Shorter entries

**Handball Manager 2021/2022 (netmin games)** — the direct predecessor.
- **Official:** licensed HBL, 2. HBL, ASOBAL and Czech Extraliga; real-time live matches you can control; an "intuitive e-mail system" and many assistants; men's and women's handball; Workshop editor [V64]. Steam: "Very Positive", 85% of 76 reviews [V64].
- **Player critique (Steam feedback thread):**
  - menus "clunky" and not very user-friendly; asks for a consistent, attractive, functional UI modelled on other manager games
  - dated negotiation and spouse portraits
  - can't type numbers in wage fields (arrow buttons only)
  - wants monthly finance vs plan and per-game attendance and income stats
  - not all weekly fixtures shown; CL/EM group tables missing [V65]
- **Developer response:** a new layout was in progress; staying off Unity was too much effort [V65].
- **2009 precedent:** GameStar's 2009 review noted the menu structure copied the football sibling [S68].
- **Lesson:** the handball niche has been served by football-template UIs with dated presentation. There is an open gap for a native, modern handball UX [I].
- **Visual:** https://store.steampowered.com/app/1262930

**Hattrick (browser, since 1997):**
- seasons of 16 weeks; real-time weekly cadence; free with a Supporter subscription since 2001 [V69]
- users peaked near 1M in 2009, about 202k in 2022 [V69]
- third-party tools (Hattrick Organizer) fill the visualisation gaps [S]
- **Lesson:** slow real-time cadence plus community builds years-long retention, but its UI depth was outsourced to fan tools [I].

**Top Eleven (Nordeus, mobile):**
- replaced 2D live matches with an in-house 3D engine in 2022 [V70]
- earlier reviews praised accessible simplicity and training depth [S71][S72]
- monetisation pressure is a recurring complaint (low-confidence aggregator) [S]
- **Lesson:** on mobile, a short visual match payoff rewards the tactical choices [I].

**FM Mobile / Touch:**
- iPhone-tailored Touch UI was praised [S18]
- Mobile is the streamlined SKU [S19]
- FM24 Mobile revamped the Squad and Tactics interface (official) [S86]
- **Lesson:** SI's pre-FM26 strategy of distinct UIs per form factor worked better than FM26's single UI [V2][I].

**EA Sports FC 25 Career Mode:**
- menu UI criticised as a regression [S73]
- youth academy recruits from age 13 [S73]
- youth faces "unnerving" [S73]
- **Lesson:** generated faces carry uncanny-valley risk; prefer stylised avatars [I].

**Pro Cycling Manager 24/25:**
- multi-panel office screen; interface 70% and accessibility 40% in one review [S74]
- PCM25 UI "modestly modernised", data-efficient but "not very inviting" [S74]
- real-time race control of energy, attacks and nutrition [S74]
- **Lesson:** data efficiency without warmth stalls a niche sports manager's reach [I].

**Eastside Hockey Manager:**
- SI-made; "not an easy game to learn" [S75]
- the early-access reviewer hoped presentation and interface would improve [S75]

**Franchise Hockey Manager:**
- OOTP-derived interface with star ratings [S76]
- "incredibly detailed … extremely cumbersome" [S76]
- **Lesson:** a borrowed UI frame across sports imports its friction [I].

**Planet Zoo / Planet Coaster 2:**
- "menus … drop-down menus spilling out" [S77]
- PC2 notifications are vague and don't say what to fix [S77]
- forum users ask why the sequel didn't build on the previous UI [S77]
- **Visual:** https://www.gameuidatabase.com/gameData.php?id=1025

**Cities: Skylines II:**
- launch tutorial criticised as tell-don't-show, with visual noise [S78]
- the new developer Iceflake overhauled the UI: toolbar, icons, demand bars, simplified onboarding [S78]

**Anno 117 / 1800:**
- UI team pillars: elegance, a UI integrated with the world, and a reserved accent colour for selection only [V79]
- reviews: sleeker but with navigation woes; grouped production chains need too much clicking [S79]
- early layered-menu overload [S79]

**Frostpunk:**
- two independent morale meters, Hope and Discontent, at the bottom of the screen [S80]
- reviewers call them gauges of the city's health; choices preview their effect on the bars [S80]
- critique: some swings had little consequence [S80]
- Frostpunk 2's UI was reworked before launch [S80]
- **Visual:** https://www.gameuidatabase.com/gameData.php?id=38

**Crusader Kings III:**
- nested tooltips locked by timer or middle mouse button, opening "hyper text style" [S81]
- praised as intuitive for learning a complex game; suggested depth limit of 2–3 levels; important info belongs in the first tooltip [V81][S81]
- reimplemented as a Godot add-on with Shift-pinning [S81]
- an encyclopedia linked from highlighted text [S81]

**Persona 5:**
- red-only palette; typographic inspiration from ransom-note punk covers [S82]
- the director says such menus take a lot of time and are "annoying" to design [S82]
- critique: hard to parse [S82]
- **Visuals:** https://www.gameuidatabase.com/gameData.php?id=72 , https://www.gameuidatabase.com/gameData.php?id=618

**Hades:**
- dialogue as visual-novel portraits beside a text box, in a more elaborate art style than gameplay [S83]
- 59 portraits shipped [S83]
- **Lesson:** a few high-quality portraits and expressions beat many mediocre 3D faces [I].

**Note on Game UI Database as a reference library:**
- home: https://www.gameuidatabase.com/
- "Maintenance & Management" screen category: https://www.gameuidatabase.com/index.php?scrn=65&set=1&sort=2
- FIFA 20 entry: https://www.gameuidatabase.com/gameData.php?id=178
- Use for moodboards. No FM or F1 Manager entries were found.

---

## 5. Cross-game pattern library (34 patterns)

Fit for Handball Manager: **H** (High), **M** (Medium), **L** (Low).

| # | Pattern | Description | Seen in | Why it works | Fit | Notes |
|---|---|---|---|---|---|---|
| 1 | **Continue button as heartbeat** | One persistent primary action advances time; its label mutates ("Go To Match") | FM console/mobile [S15][S16]; BBGM Play [V62] | One obvious next step; drives the one-more-day loop | **H** | Sticky bottom bar on mobile, top-right on desktop. Blocked state explains why ("2 tasks need you"). |
| 2 | **Play menu as season state machine** | Advance options depend on phase (day, week, to next match, to phase end) | BBGM [V62]; NBA 2K sim modes [S49] | Makes the season's structure legible; respects time | **H** | Phases for HM: preseason, league, cup, EHF, transfer windows, offseason. |
| 3 | **Inbox as task queue** | Messages are decisions with inline actions; filters for Tasks/Unread | FM26 Portal [V1]; FM27 inline actions [V3]; FM24 Match Focus [S14] | Turns the world into a to-do list; closure feels good | **H** | Never force navigation away to act. |
| 4 | **Consolidated threads** | Related events merged (all offers for one player in one message) | FM27 [V3] | Reduces noise and mental bookkeeping | **H** | Group by entity. |
| 5 | **Portal home** | Home = inbox + next fixture + 2-week calendar + action panel + advice | FM26 [V1] | One glance answers "what now?" | **H** | Keep it scannable; avoid FM26's extra click to read news [V4]. |
| 6 | **Control panel per area** | Area-level action strip (meetings, delegation, budget) | FM27 [V3] | Actions co-located with their data | **H** | |
| 7 | **Inform vs navigate separation** | Summary tiles are informational; navigation lives in menus | FM27 correction [V3] | Predictable spatial model | **H** | Direct lesson from FM26. |
| 8 | **Hover cards for every entity** | Hover or long-press on any name shows a mini-profile | BBGM [V63]; CK3 tooltips [S81] | Answers questions in context, no navigation cost | **H** | Must work on touch (long-press or tap-chip). |
| 9 | **Nested lockable tooltips** | Tooltips contain linked terms that open further tooltips; lock to explore | CK3 [V81][S81] | Learn in place without losing context | **M** | Cap at 2–3 levels; key info in level 1. Good for handball rules glossary. |
| 10 | **In-game glossary** | Searchable rules and mechanics encyclopedia | FMPedia [V1]; CK3 encyclopedia [S81] | Lowers the learning curve for a niche sport | **H** | Handball rules are unfamiliar to many. |
| 11 | **Command palette / global search** | Ctrl/Cmd+K or search across entities and screens | BBGM [V61]; FM26 search [V1] | Expert speed; escape hatch from deep menus | **H** | Trivial in Next.js. |
| 12 | **Bookmarks + configurable landing** | User-chosen shortcuts and per-section landing screens | FM26/27 [V1][V3] | Lets experts own their route | **M** | |
| 13 | **Density modes** | Default/Detailed/Condensed | FM27 [V3] | One UI serves casuals and spreadsheet lovers | **H** | Tie to breakpoints and a user setting. |
| 14 | **Staff as faces of systems** | Each subsystem has a named staff voice giving advice | NBA 2K MySTAFF [V48]; FM Advice [V1]; F1M chiefs [V21] | Personifies abstract systems; advice feels social | **H** | Assistant, GK coach, physio, scout, sporting director. |
| 15 | **Fewer, weightier conversations** | Limit talk frequency, raise stakes | NBA 2K25 [V48] | Avoids repetition fatigue (cf. FM24 stale lines [V13]) | **H** | |
| 16 | **Mood hub with causes** | Central overview of player/staff morale plus drivers | F1M24 Mentality [S23][S24] | Makes hidden state visible and actionable | **H** | Show the "because". |
| 17 | **Demands as story beats** | Players or staff make requests you grant or refuse | Motorsport Manager [V40][S44]; TPH staff requests [V54] | Emergent narrative from simulation | **H** | |
| 18 | **Traits as personality** | Short traits plus flavour text over bare numbers | TPH [V54]; MM [V40] | Humanises; memorable | **H** | |
| 19 | **Attribute bars + numbers, fogged by scouting** | Ratings shown with uncertainty depending on scouting | OOTP [S38]; BBGM scouting spend [V62] | Makes scouting meaningful | **H** | Show ranges, not false precision. |
| 20 | **User-chosen rating scale** | 1-20 / 20-80 / stars | OOTP [S38] | Serves different mental models | **M** | Perhaps 1-20 plus a "simple" star view. |
| 21 | **"What would make this work?"** | AI proposes the counter-package | BBGM [V61] | Removes guess-and-check frustration | **H** | Also for contracts (F1M24 contract confusion [V21]). |
| 22 | **Predictive consequence preview** | Show the projected outcome before confirming | MM pit preview [V40]; Frostpunk law effects [S80] | Informed trade-offs; fewer "gotcha" moments | **H** | Fatigue, morale and budget deltas. |
| 23 | **Per-event targets** | Board or self goals per match | F1M24 Race Targets [V21] | Every fixture gets a mini-arc | **H** | |
| 24 | **Scenario starts with 3 goals** | Curated starts with explicit goals | NBA 2K26 [S49]; Two Point stars [S] | Cures blank-slate paralysis | **H** | "Rescue", "Rebuild", "Dynasty". |
| 25 | **Pre-season directive meeting** | Board sets objectives and budget in a ritual | NBA 2K26 [S49]; MM chairman [V40] | Frames the season; stakes are clear | **H** | |
| 26 | **Play-or-sim per event** | Choose to manage a session live or simulate it | F1M24 [V20][V21] | Respects time; supports different play rhythms | **H** | Also "sim to half-time". |
| 27 | **Broadcast camera / view switcher** | Map view ↔ broadcast view | F1M22/24 [S30][V21] | Analytic and emotional modes | **M** | 2D court map plus a highlight view. |
| 28 | **Pre-match ritual sequence** | Focus session → lineup → team talk → kickoff | FM24 Match Focus [S14]; FM shouts/talks [V4] | Anticipation; ownership of the result | **H** | Keep it to 3 short steps, skippable (contrast FM26 press-conference steps [V5]). |
| 29 | **In-match touchline interventions** | Quick shouts and instructions | FM (removed then restored) [V4][S12] | Agency and emotional connection during sim | **H** | Removal caused backlash. Timeouts and 7v6 calls in HM. |
| 30 | **Diegetic narrator** | Announcer or radio voices alerts and news | TPH [S56][S57] | Prioritised, characterful feedback | **M** | Needs line variety [V54]. |
| 31 | **Era- or tier-skinned news** | News presentation reflects context (newspaper vs social feed) | NBA 2K MyNBA [V48] | Cheap immersion | **M** | Local paper for lower leagues. |
| 32 | **Dual meters** | Two independent gauges for competing pressures | Frostpunk Hope/Discontent [S80] | Shows trade-offs instantly | **M** | Perhaps Board confidence and Dressing-room harmony. |
| 33 | **Visible facility tree** | Upgradeable buildings as progression | MM HQ [S45][V40]; F1M facilities [V21] | Tangible long-term investment | **M** | Training centre, youth academy, arena. |
| 34 | **Bulk actions + notes on entities** | Act on many rows; annotate players and teams | BBGM [V61] | Power-user efficiency; memory aid | **M** | Shortlist notes for scouting. |

---

## 6. Anti-patterns observed

1. **One UI for all input devices.** FM26 aimed at a single PC, console and phone experience. SI itself called this "detrimental" [V2]. Controller-sized blocks lowered PC information density [V5].
2. **Tiles as navigation and modal cards for routine lookups.** This produced round trips and pop-up fatigue [V5]. FM27 reversed it [V3].
3. **Deep nesting.** Tables "behind a panel behind a tab behind a dashboard" [V6]. The Planet Zoo menus-in-menus problem [S77]. FM26 budgets need "further clicking and digging" [V4]. Anno 117 grouped production menus [S79].
4. **Ceremony for frequent tasks.** FM26 press conferences take four steps, and the exit button doesn't exit [V5]. Players respond by automating whole systems to avoid clicks [V5], which hollows out the game.
5. **Removing cherished micro-agency.** FM26 shouts and team-talk gestures were removed, leaving players "detached". They were later restored [V4][S12].
6. **Shrinking critical info.** FM26 made fitness and injury readability worse [V4]. Status information must be the most legible thing on a match screen.
7. **Lists without decision-relevant columns.** FM26 penalty-taker list [V6]. OOTP non-sortable stats [V35].
8. **Buttons that don't look like buttons** [V6].
9. **Vague notifications.** Planet Coaster 2 "visitors are stuck" without a fix path [S77]. Two Point Campus can't explain low grades [S59].
10. **Repetitive voice lines and conversations.** Two Point tannoy [V54]. FM24 player interactions [V13]. F1M24 drivers commenting on events that never happened [V21].
11. **Spreadsheet fatigue and overstimulation.** FM24 "massive overstimulation" when returning to a save; about 50 hours per season [V13]. OOTP and FHM described as "cumbersome" or a hard learning curve [S36][S76].
12. **Settings sprawl** across several screens [V35].
13. **Uncanny generated faces.** FM24 newgens [V13]. EA FC youth [S73].
14. **Tell-don't-show tutorials** [S78]. Tutorials that skip the core skill [V40]. Dismissed tips that reappear [S27].
15. **Removing muscle-memory features without replacement.** Shortcut editing, secondary toggle, drag-and-drop training [V3][V6]. Veterans feel punished.
16. **Undated, uncategorised news** [V63].
17. **Local-only saves** in a browser game [V63].
18. **Football-template UI for handball.** The Handball Manager 2009 menu structure copied its football counterpart [S68]. 2021 menus were called "clunky" [V65].

---

## 7. Lessons for Handball Manager (prioritised)

**P0: foundational**
1. **Build a Portal-style home around one heartbeat action.**
   - One screen shows: next match card, action-required tasks, a two-week calendar strip, squad status alerts (injured, suspended, fatigued) and filtered news.
   - A single Continue button changes label with context: Continue → Prepare Match → Go To Match → Results.
   - Evidence: [V1][S15][V62].
2. **Separate inform from navigate.**
   - Summary tiles never act as the primary navigation.
   - A fixed primary nav: Home, Squad, Tactics, Match, Recruitment, Club, plus a per-section control panel and a secondary tab toggle.
   - This learns directly from FM26 → FM27 [V3][V5].
3. **Design per form factor, not one UI for all.**
   - Desktop: dense tables and side panels, with Density modes.
   - Mobile: bottom nav, sticky Continue, cards, and long-press hover cards.
   - Share components, not layouts [V2][V3][S18].
4. **Inbox = task queue with inline resolution.**
   - Every message that needs a decision can be resolved inside it: accept/counter offer, set match focus, answer a player demand.
   - Consolidate messages by entity. Colour-code by domain [V3].
5. **Hover/long-press cards for every entity, plus a command palette.**
   - Every player, club and staff name is interactive everywhere.
   - Ctrl/Cmd+K jumps anywhere [V61][V63].

**P1: core loop quality**

6. **A pre-match ritual of at most three skippable steps:**
   - Match Focus (defensive system plus one set-play or 7v6 rehearsal)
   - Line-up
   - Team talk
   - Never add FM26-style extra Start screens [S14][V5].
7. **Keep touchline agency in the live match.** Timeouts (3 per match in handball), 7v6 toggle, tempo and defensive-system shouts. Removing agency is the fastest way to lose immersion [V4][S12].
8. **Make match-status info the most legible element.** Fatigue, 2-minute suspensions, injuries and the timeout count must be large, colour-coded and scannable on mobile [V4].
9. **Staff as faces of systems; fewer, weightier conversations.** A named small cast gives advice per domain, with portraits rather than uncanny 3D faces [V48][V1][V13][S83].
10. **Predictive previews before commitments.** Projected fatigue, morale and budget deltas on substitutions, training loads and contracts. Add "What would make this work?" in negotiations [V40][V61][V21].
11. **Fog of war on ratings, tied to scouting.** Show ranges and confidence, and offer a simple vs detailed rating scale [S38][V62].
12. **Per-match targets and a pre-season board meeting.** Give every fixture and every season an explicit arc [V21][S49].

**P2: depth, onboarding, identity**

13. **Scenario starts with three goals** (Rescue, Rebuild, Dynasty) to cut first-session paralysis [S49].
14. **Nested tooltips plus a handball glossary.** Explain 7v6, passive play, suspensions and defensive systems in place, capped at two levels [V81][V1].
15. **Mood hub with explicit causes.** A squad morale overview with the "because" [S23][S24].
16. **Player demands and traits as story beats.** Emergent narrative from the simulation [V40][V54].
17. **Dated, categorised news with weekly recaps, skinned by league tier** [V63][V48].
18. **Play-or-sim choice per fixture**, including sim to half-time [V20][V21].
19. **Cloud/server saves for the browser game**, so cross-device continuity comes free [V63].
20. **Handball-native IA, not a football reskin.** Court-based visuals, handball phases (6-0/5-1/3-2-1 defence, 7v6, timeouts) and handball calendar rhythms (international breaks, EHF). This is the gap the incumbent left [V65][S68].

---

## 8. Sources

All URLs accessed 2026-11-12. "fetched" means the page was opened and read. "snippet" means only the search summary was available, because the page was not fetched or the fetch was blocked or truncated.

1. Football Manager — "Total Football, Total Control: FM26's Reimagined User Interface" (fetched). https://www.footballmanager.com/features/total-football-total-control-fm26s-reimagined-user-interface
2. FM Scout — "Miles admits FM26 missed the mark" (fetched). https://www.fmscout.com/a-miles-admits-fm26-missed-the-mark.html
3. Football Manager — "FM27: Clearer Interface & Smoother Navigation" (fetched; undated, likely Sept 2026). https://www.footballmanager.com/node/1099
4. TheSixthAxis — Football Manager 26 Review (fetched). https://www.thesixthaxis.com/2025/11/04/football-manager-26-review/
5. Jump Dash Roll — Football Manager 26 Review (fetched). https://www.jumpdashroll.com/article/football-manager-26-review
6. Finalboss — "After 70 hours with Football Manager 26…" (fetched). https://finalboss.io/after-70-hours-with-football-manager-26-im
7. PC Gamer — FM26 Steam reviews "Mostly Negative" (fetch truncated; headline/snippet). https://www.pcgamer.com/games/sim/football-manager-26-launches-straight-into-a-relegation-battle-as-steam-reviews-plummet-to-mostly-negative-been-playing-since-1993-and-this-is-the-worst-one
8. GamesRadar — FM26 among worst-rated Steam games (fetch truncated; snippet). https://www.gamesradar.com/games/sports/after-a-2-year-wait-football-manager-26-becomes-the-7th-worst-rated-steam-game-ever-as-the-bug-laden-sequel-is-slammed-for-poor-ui-missing-features-and-more-this-is-the-worst-iteration-ever
9. Steam — Football Manager 26 store page (fetched). https://store.steampowered.com/app/3551340
10. Operation Sports — "FM26 players react to the removal of touchline shouts" (snippet; 403 on fetch). https://www.operationsports.com/fm26-players-react-to-the-removal-of-touchline-shouts
11. TechRadar — Football Manager 26 review (snippet). https://www.techradar.com/gaming/football-manager-26-review
12. Passion4FM — FM26 Update 4 return of shouts (snippet). https://www.passion4fm.com/?p=20411
13. PCGamesN — Football Manager 2024 review (fetched). https://www.pcgamesn.com/football-manager-2024/review
14. Football Manager — FM24 quality-of-life upgrades / gameplay deep dives (snippet). https://www.footballmanager.com/features/fm24-quality-life-upgrades-part-one ; https://www.footballmanager.com/features/more-gameplay-deep-dives
15. SI Manual — Football Manager Mobile 2024: Matchday (snippet). https://community.sports-interactive.com/sigames-manual/football-manager-mobile-2024/matchday-r5239
16. SI Manual — Introduction to Football Manager Console 2024 (snippet). https://community.sigames.com/sigames-manual/football-manager-2024-touch-and-console/introduction-to-football-manager%E2%84%A2-console-2024-r4971/
17. TouchArcade — FM24 review: Touch vs Mobile vs PS5 vs PC (snippet). https://toucharcade.com/2023/11/14/football-manager-2024-review-touch-vs-mobile-vs-ps5-vs-pc-steam-deck-features-save-controller-console/
18. TouchArcade — FM24 interview with Sports Interactive (snippet). https://toucharcade.com/2023/12/08/football-manager-2024-interview-sports-interactive-apple-arcade-nintendo-switch-touch-features-cross-save-physical-release-dlc/
19. iMore — FM24 Mobile first impressions (snippet). https://www.imore.com/gaming/ios-games/football-manager-2024-mobile-first-impressions
20. Steam — F1 Manager 2024 store page (fetched). https://store.steampowered.com/app/2591280
21. GamingBolt — F1 Manager 2024 Review (fetched). https://gamingbolt.com/f1-manager-2024-review-we-are-the-champions
22. F1 Manager official — "Managing Mentality" (403; snippet). https://www.f1manager.com/en-US/features/new/managing-mentality
23. Traxion — F1 Manager 2024's mentality system (snippet). https://traxion.gg/f1-manager-2024s-mentality-system-set-to-shake-up-staff-relationships/
24. RacingGames.gg — F1 Manager 2024 mentality system and track upgrades (snippet). https://racinggames.gg/f1/f1-manager-2024-new-mentality-system-and-track-upgrades-unveiled/
25. Xbox Wire — Real F1 data in F1 Manager 2024 (snippet); Overtake — F1M24 update (snippet). https://news.xbox.com/en-us/2024/05/17/real-f1-data-creates-ultimate-sporting-simulation-f1-manager-2024 ; https://overtake.gg/news/f1-manager-2024-pit-lane-starts-more-new-features-in-latest-update.2616
26. TechRadar — F1 Manager 24 review (snippet). https://www.techradar.com/gaming/f1-manager-24-review
27. Shacknews — F1 Manager 2024 review (snippet). https://shacknews.com/article/140757/f1-manager-2024-review-we-think-it-might-be-plan-a
28. Tom's Guide — F1 Manager 24 (snippet). https://www.tomsguide.com/gaming/f1-manager-24-let-me-live-out-my-dream-to-destroy-max-verstappen
29. GGRecon — F1 Manager 2022 review (snippet). https://www.ggrecon.com/reviews/f1-manager-2022-review/
30. RacingGames.gg — F1 Manager 2022 review (snippet); Movies Games and Tech — F1M22 (snippet). https://racinggames.gg/article/f1-manager-2022-review-a-worthy-addition-to-the-f1-world ; https://moviesgamesandtech.com/?p=267943
31. Overtake — F1 Manager 22 review, Presentation and Menus (403; snippet). https://overtake.gg/news/f1-manager-22-review.743/page/presentation-and-menus.152
32. Steam — Out of the Park Baseball 26 store page (fetched). https://store.steampowered.com/app/3116890
33. OOTP Developments — OOTP home page (fetched; now promotes OOTP 27). https://ootpdevelopments.com/out-of-the-park-baseball-home/
34. OOTP forums — manager home screen boxes; facegen bug (snippet; exact post IDs from search, not individually opened). https://forums.ootpdevelopments.com/showthread.php?p=5179943 ; https://forums.ootpdevelopments.com/showthread.php?p=5185807
35. Baseball Replay Journal — "5 Things I Hate About OOTP" (fetched). https://baseballreplayjournal.substack.com/p/5-things-i-hate-about-ootp
36. ClutchPoints — OOTP 25 review (snippet). https://clutchpoints.com/out-of-the-park-baseball-25-review
37. PC Gamer — Out of the Park Baseball review (snippet). https://pcgamer.com/out-of-the-park-baseball-review
38. OOTP forums — rating scales and scouting error (snippet). https://forums.ootpdevelopments.com/showthread.php?p=5098116 ; https://forums.ootpdevelopments.com/showthread.php?p=5097964
39. Steam — Motorsport Manager store page (fetched). https://store.steampowered.com/app/415200
40. Wccftech — Motorsport Manager Review (fetched). https://wccftech.com/review/motorsport-manager-review-one-race-at-a-time/amp/
41. Stuff — Motorsport Manager review (403; snippet). https://www.stuff.tv/game-reviews/motorsport-manager/review
42. Cubed3 — Motorsport Manager PC Second Opinion (snippet). https://cubed3.com/review/3360/1/motorsport-manager-pc.html
43. Bonus Stage — Motorsport Manager review (snippet). https://www.bonusstage.co.uk/archives/81430
44. Gaming Trend — Motorsport Manager review (snippet). https://gamingtrend.com/feature/reviews/take-road-watching-to-the-next-level-motorsport-manager-review
45. Autosport — Motorsport Manager full game review (snippet). https://www.autosport.com/gaming/feature/7139/motorsport-manager-full-game-review
46. Windows Central — Motorsport Manager preview (snippet). https://www.windowscentral.com/motorsport-manager-preview
47. RAWG — Motorsport Manager (fan guide snippet; low confidence). https://rawg.io/games/1222
48. 2K — NBA 2K25 Courtside Report: MyNBA/MyGM (fetched). https://nba.2k.com/2k25/courtside-report/mynba/
49. 2K — NBA 2K26 Courtside Report: MyNBA (snippet); RealSport101 summary (snippet). https://nba.2k.com/2k26/courtside-report/mynba/ ; https://realsport101.com/article/nba-2k26-mynba-mygm-all-the-new-features-explained
50. TheSixthAxis — NBA 2K25 review (snippet). https://www.thesixthaxis.com/2024/09/16/nba-2k25-review/
51. Shacknews — NBA 2K25 review (snippet). https://shacknews.com/article/141399/nba-2k25-review-score
52. Game UI Database — Two Point Hospital (PC) and Console Edition. https://www.gameuidatabase.com/gameData.php?id=99 ; https://www.gameuidatabase.com/gameData.php?id=699
53. Game UI Database — Two Point Campus (Gamepad). https://www.gameuidatabase.com/gameData.php?id=1508
54. PCGamesN — Two Point Hospital review (fetched). https://www.pcgamesn.com/two-point-hospital/two-point-hospital-review
55. PC Gamer — Two Point Hospital hands-on (fetch truncated; snippet with Gary Carr remarks). https://www.pcgamer.com/two-point-hospital-hands-on-theme-hospital-fans-are-getting-the-exact-game-they-want-with-a-few-twists
56. TechRaptor — Two Point Hospital review (snippet). https://techraptor.net/gaming/reviews/two-point-hospital-review-patient-revived
57. bit-tech — Two Point Hospital review (snippet). https://bit-tech.net/reviews/two-point-hospital-review/1/
58. GameSkinny — Two Point Campus review (snippet). https://www.gameskinny.com/zgzg6/two-point-campus-review-salutatorian
59. XXL Gamer — Two Point Campus review (snippet). https://xxlgamer.com/reviews/exit/60
60. PC Gamer — Two Point Campus review (fetch truncated). https://www.pcgamer.com/two-point-campus-review
61. ZenGM blog — posts tagged UI (fetched). https://zengm.com/blog/tag/ui/
62. Basketball GM — Manual (fetched). https://basketball-gm.com/manual/
63. GM Games — Basketball GM review (fetched). https://gmgames.org/basketball-gm/review/
64. Steam — Handball Manager 2021 store page (fetched). https://store.steampowered.com/app/1262930
65. Steam Community — Handball Manager 2021 feedback thread (fetched). https://steamcommunity.com/app/1262930/discussions/0/3108015514313240978
66. Daikin HBL — netmin games Handball Manager 2022 announcement (snippet). https://www.daikin-hbl.de/de/hbl-gmbh/content/migration/content-element/1961084
67. GamesPress — Handball Manager 2022 DLC now available (snippet). https://gamespress.westeu-v2.propressroom.com/it/Handball-Manager-2022-DLC-Now-Available
68. GameStar — Handball Manager 2009 review PDF (snippet only; not downloaded). https://download.gamestar.de/public/41900/41995/01_2009_105.pdf
69. Wikipedia — Hattrick (video game) (fetched). https://en.wikipedia.org/wiki/Hattrick_(video_game)
70. Nordeus — Top Eleven introduces 3D live matches (snippet). https://nordeus.com/press-releases/top-eleven-introduces-3d-live-matches-in-major-update/
71. Trusted Reviews — Top Eleven 2016 (snippet). https://www.trustedreviews.com/reviews/top-eleven-2016
72. Pocket Gamer — Top Eleven review (snippet). https://www.pocketgamer.com/top-eleven/review/
73. EA FC 25 Career Mode — EA forums; Finalboss; Charlie Intel (snippets). https://forums.ea.com/discussions/fc-25-game-modes-en/overall-review-2-months-in---career-mode-player-since-fifa-10/7872077 ; https://finalboss.io/ea-sports-fc-25s-stumble-sets-a-high ; https://charlieintel.com/ea-sports-fc/all-new-features-in-ea-fc-25-career-mode-333031
74. Pro Cycling Manager — Tech-Gaming PCM 2024 review; Loot Level Chill PCM25 preview; CyclingTips overhaul piece (snippets). https://www.tech-gaming.com/pro-cycling-manager-2024/ ; https://lootlevelchill.com/features/pro-cycling-manager-25-preview/ ; https://zenocycleparts.com/blogs/cyclingtips/cycling-s-most-enduring-videogame-needs-an-overhaul
75. Eastside Hockey Manager — PC Gamer; Steam (snippets). https://www.pcgamer.com/the-pc-finally-has-a-hockey-game-again ; https://store.steampowered.com/app/301120/
76. Franchise Hockey Manager — OSFTW FHM2 and FHM3; Gaming Trend FHM4 (snippets). https://www.osftw.com/reviews/813/franchise-hockey-manager-2 ; https://osftw.com/reviews/849/franchise-hockey-manager-3 ; https://gamingtrend.com/reviews/the-ice-is-once-again-nice-franchise-hockey-manager-4-review
77. Planet Zoo / Coaster — Kotaku; Game Informer; COGconnected; Frontier forums; Game UI Database (snippets). https://kotaku.com/planet-zoo-has-cute-animals-but-the-management-sucks-1839590839 ; https://www.gameinformer.com/review/planet-zoo/planet-zoo-review-wearing-down-barriers ; https://cogconnected.com/review/planet-coaster-2-review/ ; https://forums.frontier.co.uk/threads/ui-ux-planet-coaster-and-zoo-1-vs-2.629417 ; https://www.gameuidatabase.com/gameData.php?id=1025
78. Cities: Skylines II — PC Gamer (Iceflake plans); Neowin; TapTap review (snippets). https://www.pcgamer.com/games/city-builder/cities-skylines-2s-new-developer-breaks-cover-on-its-plans-for-the-sequels-future-revealing-a-patch-that-will-include-changes-players-have-been-requesting-for-a-long-time/ ; https://www.neowin.net/news/cities-skylines-ii-gets-first-update-under-new-developer-iceflake/ ; https://www.taptap.io/post/6454531
79. Anno 117 — Anno Union UI DevBlog (fetched); GamesRadar and Well Played reviews (snippets). https://www.anno-union.com/devblog-the-user-interface-team-and-a-deeper-dive-into-the-visuals/ ; https://www.gamesradar.com/games/strategy/anno-117-pax-romana-review ; https://www.well-played.com.au/anno-117-pax-romana-review/
80. Frostpunk — Gamepressure guide; PC Gamer developer interview; PCGamesN FP2 UI improvements; Game UI Database (snippets). https://gamepressure.com/frostpunk/what-happens-when-discontent-or-hope-reach-critical-values/zfad7c ; https://www.pcgamer.com/frostpunk-developers-on-hope-misery-and-the-ultimately-terrifying-book-of-laws ; https://www.pcgamesn.com/frostpunk-2/ui-improvements ; https://www.gameuidatabase.com/gameData.php?id=38
81. Crusader Kings III tooltips — Philip Ardeljan "Tooltips in tooltips" (fetched via reader mirror; original at philip.design); Godot Tooltips Pro; PC Gamer CK3 learnability; GameWatcher CK3 encyclopedia (snippets). https://hn.jakechampion.name/reader/https://philip.design/blog/tooltips-in-tooltips ; https://forum.godotengine.org/t/tooltips-pro-advanced-tooltip-positioning-functionality/111511 ; https://pcgamer.com/the-crusader-kings-3-team-is-working-hard-to-make-the-game-easier-to-learn ; https://www.gamewatcher.com/crusader-kings-3-tutorials-highlighted-text-encyclopedia
82. Persona 5 — PC Gamer (Hashino on menus); The Star (Suto, typography); Mechanics of Magic; Game UI Database entries (snippets). https://www.pcgamer.com/games/rpg/persona-series-director-says-atluss-flashy-menus-are-actually-really-annoying-to-design ; https://www.thestar.com.my/tech/tech-news/2024/10/20/exuberant-video-game-menus-designed-with-da-vinci-in-mind ; https://mechanicsofmagic.com/2022/04/23/visual-design-of-games-persona-5/ ; https://www.gameuidatabase.com/gameData.php?id=72 ; https://www.gameuidatabase.com/gameData.php?id=618
83. Hades — MCV/Develop art interview; Kotaku "The Art of Hades"; Twinfinite (snippets). https://mcvuk.com/business-news/behind-the-art-of-hades-we-value-artistic-integrity-and-excellence-in-artistic-craft-at-supergiant-however-were-first-and-foremost-a-game-design-lead-team/ ; https://kotaku.com/the-art-of-hades-1845443438 ; https://twinfinite.net/pc/5-reasons-why-hades-shouldnt-be-slept-on/2/
84. Game UI Database — home, Maintenance & Management category, FIFA 20 entry (search results; site fetch returned 403). https://www.gameuidatabase.com/ ; https://www.gameuidatabase.com/index.php?scrn=65&set=1&sort=2 ; https://www.gameuidatabase.com/gameData.php?id=178
85. Two Point store pages (visual references). https://store.steampowered.com/app/535930 ; https://store.steampowered.com/app/1649080
86. Football Manager — FM24 Mobile new features revealed (snippet). https://www.footballmanager.com/features/football-manager-2024-mobile-new-features-revealed
