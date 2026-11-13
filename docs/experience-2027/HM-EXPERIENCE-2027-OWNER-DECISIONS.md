# HM Experience 2027 — Owner Decisions

> Every design decision that needs product-owner approval. Fill in **Decision** and **Comments** here, or record them in the Design Lab (*Decisions* view → *Export Markdown*) and paste the export below.
> Recommendations are advice. Different surfaces may use different alternatives as long as they stay within one identity.

## 1. Decide first — global decisions (affect the whole design system)

These constrain every surface. Recommended order: G1 → G2 → G3/G4 → G5–G8.

### G1 · Base identity / temperament

- [ ] A — Tactical Clarity
- [x] B — Arena Nights
- [ ] C — Paper & Floodlight

**Claude's recommendation:** C — Best balance of depth and atmosphere; evolves the current paper/navy/signal identity; spectacle budget concentrated on moments.

**Decision:** **B** (owner, 2026-11-13) — Arena Nights is the visual design language (not a layout template), combined with a dynamic Club Identity System. All per-surface recommendations are retained.  
**Comments:** 

### G2 · Navigation model

- [ ] A — 6-hub rail + Ctrl-K palette + hover cards
- [ ] B — Top hub bar + full-bleed hub pages
- [ ] C — Week Spine + hub rail + Peek drawer

**Claude's recommendation:** C — Replaces the flat 27-item sidebar; makes time (the core loop) visible; Peek keeps context. Palette from A should be included in any choice.

**Decision:** ______  
**Comments:** 

### G3 · Imagery policy

- [ ] A — Minimal: crests, monograms, data as image
- [ ] B — Maximal: portraits and environments everywhere
- [ ] C — Curated: imagery on hubs, stories and moments

**Claude's recommendation:** C — The repo already owns 10 environment photos; curated use gives atmosphere without a large asset pipeline.

**Decision:** ______  
**Comments:** 

### G4 · Portrait strategy

- [ ] A — Initials / monogram
- [ ] B — Stylised procedural SVG busts (non-likeness)
- [ ] C — Photographic / AI likeness

**Claude's recommendation:** B — Real Swedish player names exist in data — likeness portraits carry legal risk; procedural busts scale to every player at ~1 KB each.

**Decision:** ______  
**Comments:** 

### G5 · Motion budget

- [ ] A — Functional only (≤180 ms)
- [ ] B — Expressive everywhere
- [ ] C — Calm by default, expressive on moments

**Claude's recommendation:** C — Keeps long management sessions calm and performant while giving matchday, signings and milestones a signature.

**Decision:** ______  
**Comments:** 

### G6 · Density modes

- [ ] A — Single density
- [ ] B — Comfortable + Compact toggle

**Claude's recommendation:** B — Power users want FM-level density; newcomers need breathing room. Implemented as tokens (--pad, --row, --fs).

**Decision:** ______  
**Comments:** 

### G7 · Mobile role

- [ ] A — Full parity, responsive
- [ ] B — Companion: Today, inbox, decisions, match
- [ ] C — Full parity but mobile-first layouts for daily loop

**Claude's recommendation:** C — Desktop remains primary; the daily loop (Today, inbox, decisions, matchday) gets purpose-built mobile layouts, deep editors adapt to single column.

**Decision:** ______  
**Comments:** 

### G9 · Club Identity System (accent)

- [x] A — Dynamic club neon accent (club derives accent; clubless = neon orange)
- [ ] B — Fixed brand accent

**Claude's recommendation:** A — Owner decision: the active club determines the Arena Nights accent; changing club updates identity without changing the design system.

**Decision:** **A** (owner, 2026-11-13) — Dynamic neon accent derived from the active club; clubless manager = neon orange default.  
**Comments:** 

### G10 · Black/white home shirts: accent

- [x] A — Ice Silver (trim kept as reference metadata)
- [ ] B — Documented trim/secondary colour
- [ ] C — Crest colour

**Claude's recommendation:** B — Claude recommended the documented trim where it is on the home shirt; owner chose Ice Silver for consistency and to avoid crest/away colours.

**Decision:** **A** (owner, 2026-11-14) — ICE SILVER for predominantly black or white home shirts. The crest colour is never used automatically; a documented shirt trim is kept as reference metadata only.  
**Comments:** 

### G11 · Unknown shirt colours: fallback

- [x] A — Default Arena orange, marked as fallback (status stays UNKNOWN)
- [ ] B — Neutral steel placeholder
- [ ] C — Crest/game colour

**Claude's recommendation:** B — Claude used a neutral steel placeholder; owner chose the default orange so unknown clubs still feel like Arena Nights, clearly marked as a fallback.

**Decision:** **A** (owner, 2026-11-14) — DEFAULT ORANGE as a temporary visual fallback for clubs whose shirt colour is UNKNOWN. Not verified club data: the UNKNOWN status is preserved and the UI marks it as a fallback. Clubless managers also keep orange.  
**Comments:** 

### G12 · Incorrect club identities in the database

- [x] A — Correct the identities (canonical correction plan, controlled migration later)
- [ ] B — Change display names only

**Claude's recommendation:** A — Keeps stable ids where safe and corrects the underlying identity; requires a migration strategy for careers/saves (see correction plan).

**Decision:** **A** (owner, 2026-11-14) — CORRECT incorrectly identified clubs (not just display names). Proposal only: see HM-EXPERIENCE-2027-CLUB-IDENTITY-CORRECTION-PLAN.md; no production data or careers migrated.  
**Comments:** 

### G8 · Typography pairing

- [ ] A — Inter + JetBrains Mono
- [ ] B — Barlow Condensed + Barlow
- [ ] C — Saira Condensed + IBM Plex Sans/Mono + Source Serif 4

**Claude's recommendation:** C — Follows G1. All are open-licence web fonts — replaces Windows-only Bahnschrift/Segoe which degrade on Mac/mobile.

**Decision:** ______  
**Comments:** 

## 2. Surface decisions

Priority P0 = redesign first. HI-FI = interactive prototype available in the lab. **Per-surface recommendations are retained under the Arena Nights identity (owner decision 2026-11-13).** Arena column: native = fits as designed · token = restyled by tokens only · adapt = genuine conflict, adaptation proposed (see HM-EXPERIENCE-2027-ARENA-ADAPTATION-REGISTER.md) · internal.

| ID | Surface | Pri | A | B | C | Rec. | Arena | Decision | Comments |
|---|---|---|---|---|---|---|---|---|---|
| ANL-01 HI-FI | Matchrapport | P0 | Stats Sheet | Highlight Show | Editorial Match Report | C | adapt: Match Feature | | |
| ANL-01a | Archived match center (4 views) | P0 | Depth tabs behind summary | Collapsed "Hela matchen" section | Moment explorer | A | token | | |
| CMP-01 HI-FI | Tävlingar (competition workspace) | P0 | League Centre | Broadcast League Hub | Competition Almanac | A | token | | |
| CMP-01a | Tab "Tabell & form" | P0 | Annotated standings | Points ladder | Race chart | A | token | | |
| DSH-01 HI-FI | Dashboard · Managerns kontor (Hem) | P0 | Decision Briefing | Matchweek Show | Today's Paper | C | adapt: Matchweek Front Page | | |
| DSH-01a | Office hero header | P0 | Status Bar | Live Arena Masthead | Journal Masthead | C | adapt: Broadcast Masthead | | |
| DSH-01b | Next match hero + league card | P0 | Fixture Card + Ladder Slice | Pre-match Bug | Match Box | C | adapt: Match Box (score-bug styling) | | |
| DSH-01e | Laget inför avkast (availability) | P0 | Availability Ring | Court Coverage | Squad Status Row | B | native | | |
| DSH-01i | Veckans managerplan (weekly overview) | P0 | 7-Day Planner Strip | Week Road | Week Spine (embedded) | C | token | | |
| ENT-02 HI-FI | Title screen (Huvudmeny) | P0 | Career Library | Arena Title | Journal Cover | C | adapt: Season Cover | | |
| ENT-03 | New game wizard | P0 | Single-screen Setup Console | Draft Night | Club first, contract last | C | adapt: Club first, contract last — living club card | | |
| ENT-03d | Step 4 · Klubb | P0 | Comparison table + spotlight | Map of Sweden | Club Wall by ambition | C | native | | |
| ENT-07 | Career shell · sidebar navigation | P0 | Hub rail + tabs | Top hub bar + full-bleed hubs | Hub rail + Week Spine + Peek | C | token | | |
| ENT-07a | Mobile nav drawer | P0 | Bottom tabs + docked Continue | Central Continue FAB bar | Today feed + hub sheet | A | token | | |
| ENT-08 | Career top bar (header) | P0 | Command bar | Score-bug header | Matchday clock | C | token | | |
| ENT-09a | Progression notice (after Continue) | P0 | Next-action card | Breaking-news lower third | Spine pin + event card | C | token | | |
| ENT-10 | Continue / advance-day flow | P0 | Stateful heartbeat button | Matchweek countdown | Up-next queue | C | token | | |
| ENT-10a | Continue processing overlay ('Världen går vidare.') | P0 | Day ticker strip | Matchweek montage | Calendar flip → floodlight build-up | C | native | | |
| MDY-01 | Matchförhandsvisning (match preview / matchday gate) | P0 | Pre-match checklist board | Matchday build-up | Three-step ritual | C | adapt: Three-step ritual (intensity escalation) | | |
| MDY-01e | Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare" | P0 | Court lineup with readiness rings | Starting seven busts | Readiness table | A | token | | |
| MDY-02 HI-FI | Live match (Match Center) | P0 | Bench Tablet | Broadcast | Floodlight Sequence | C | adapt: Matchday Sequence | | |
| MDY-02a | Header / scoreboard & manpower | P0 | Score bug with pips | Broadcast bug + manpower bar | Two-row header | A | native | | |
| MDY-02b | Controls bar | P0 | Transport control | Auto-pause rules | Play-or-sim menu | A | token | | |
| MDY-02c | View "Översikt" | P0 | Live-first overview | Court + caption | Momentum + feed | A | token | | |
| MDY-02g | Coach aside "Dina matchbeslut" (LiveCoachPanel) | P0 | Bench Dock | Court drag substitutions | Shout cards | A | token | | |
| MDY-02i | Half-time state | P0 | Half-time briefing | Dressing-room talk | Half-time editorial | A | token | | |
| MDY-02j | Full-time state | P0 | Final-whistle card | Merge with report | Celebration/blues moment | A | native | | |
| REC-02 | Rekryteringscentrum | P0 | Pipeline table with stage tabs | Recruitment war room | Unified pipeline board | C | token | | |
| REC-03 HI-FI | Transfer Centre | P0 | Market Table + Deal Panel | Deal Room | Transfer Desk Pipeline | A | token | | |
| REC-03b | Market tabs (Möjligheter / Hela marknaden / Bevakade) | P0 | Saved views over one table | Opportunity spotlight carousel | Need-first view | A | token | | |
| REC-03c | Dossier aside (TransferDossier) | P0 | Deal drawer | Player card flip | — | A | token | | |
| REC-04 | Förhandlingsrum (negotiation room) | P0 | Term Sheet | Across the Table | Deal Ledger | A | token | | |
| REC-04b | Decision form – club stage | P0 | Range-band slider | Offer presets | Counter-proposal helper | A | token | | |
| REC-04c | Decision form – player stage | P0 | Package builder with total cost | Agent card | Contract document | A | token | | |
| REC-04d | Waiting / closed status | P0 | Waiting card with advance | Closed outcome card | — | A | token | | |
| SQD-01 HI-FI | Truppen & Omklädningsrummet (squad list) | P0 | Squad Matrix | Locker Room | Depth Chart | A | token | | |
| SQD-01a | Tab "Översikt" | P0 | Curated summary + expandable rows | Readiness cards | Next-match readiness grouping | A | token | | |
| SQD-01c | Tab "Fysisk status" | P0 | Readiness heat-strip | Load quadrant board | — | A | token | | |
| SQD-02 HI-FI | Spelarprofil (player dossier) | P0 | Dossier | Athlete Spotlight | Feature Profile + Peek | C | adapt: Athlete Feature | | |
| SQD-02a | Tab "Profil & egenskaper" (overview) | P0 | Key-ratings summary | Storyline overview | Decisions-first overview | A | token | | |
| SQD-02g | PlayerHero + PlayerActions | P0 | Sticky identity bar + primary CTA | Spotlight hero + action dock | Kicker header + numbered actions | A | token | | |
| SQD-02j | Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel) | P0 | Heat matrix | Radar showcase | Report bars with words | A | token | | |
| TRN-01 HI-FI | Träning & Återhämtning | P0 | Weekly Planner Grid | Training Hall | Assistant Proposal | C | token | | |
| TRN-01a | Panel "Assistentens träningsplan" (AssistantTrainingPanel) | P0 | Diff overlay on grid | Compact assistant card | — | A | token | | |
| TRN-01b | Panel "Veckoschema" (week planner) | P0 | Block planner | Day-focus timeline | Template-first | A | token | | |
| TRN-01c | Panel "Spelarberedskap" | P0 | Shared readiness strip + inline settings | Load lanes | — | A | token | | |
| TRN-02 | Matchplan & Taktiktavla 2.0 | P0 | Tactics Board | Coach's Clipboard | Assistant-guided Match Plan | A | token | | |
| TRN-02a | Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup) | P0 | Inline warning + auto-fix preview | Checklist item with fix drawer | — | A | token | | |
| TRN-02b | Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs) | P0 | Phase × manpower switcher | Court flip | Split court | A | token | | |
| TRN-02f | Rail "Så spelar vi" (CoachingChoices) | P0 | Choices with trade-off lines | Style dials with target band | Identity sentence | A | token | | |
| TRN-02i | Roster "Matchtrupp · n spelare" / "Ej uttagna" | P0 | Bench strip + counter | Two-column readiness roster | Squad selection step | A | token | | |
| WLD-01 HI-FI | Inkorg (Inbox) | P0 | Task Inbox | Messenger Feed | Correspondence Desk | C | adapt: Message Desk | | |
| WLD-01a | Inbox filters | P0 | Segment + Chips | Sender Lanes | — | A | token | | |
| WLD-01b | Message reader + empty states | P0 | Action-first Reader | Scene Reader | Thread Reader with Chain Rail | C | adapt: Thread Reader with Chain Rail (Arena) | | |
| WLD-05 HI-FI | Kalender | P0 | Planner Grid | Season Road | Week Spine Calendar | C | token | | |
| ANL-01b | MatchAftermathPanel ("Efter matchen") | P1 | Momentum hero | Press clippings | — | A | token | | |
| ANL-01c | Details "Speltid och belastning" | P1 | Workload with actions | Heat strip | — | A | token | | |
| ANL-02 | Matchanalys – Översikt | P1 | Trend dashboard | Analyst's room | Weekly analysis column | A | token | | |
| ANL-03 | Matchanalys – Motståndaren | P1 | Mirror comparison | Opponent dossier | Scout report article | A | token | | |
| ANL-05 | Matchanalys – Senaste matchen | P1 | Keep as stats deep dive with picker | Replay-led analysis | Merge into report | C | native | | |
| CLB-01 | Klubbhuset (clubhouse hub) | P1 | Department Status Board | Illustrated Clubhouse | Merged into Club Journal | C | native | | |
| CLB-02 HI-FI | Klubb (own club overview) | P1 | Executive Office | Clubhouse Rooms | Club Journal | C | adapt: Club Channel | | |
| CLB-02b | Economy & partnerships rail | P1 | KPI Trio + Revenue Mix | Headroom Gauge | — | A | token | | |
| CLB-04 | Other club profile | P1 | Opponent Dossier Tabs | Broadcast Club Profile | Peek-first Portrait | C | adapt: Peek-first Scout Card | | |
| CLB-05 | Styrelserummet (Board) | P1 | Confidence Cockpit | Boardroom Table | Board Minutes | C | token | | |
| CLB-05b | Recovery-plan & contract-offer decision cards | P1 | Pinned Decision Bar | Meeting Moment | — | B | native | | |
| CLB-06 | Finanscentralen (Finance) | P1 | Finance Cockpit | Matchday Money | Monthly Report | A | token | | |
| CLB-06a | Tab · Översikt | P1 | Chart + Action Cards | Status Sentence | — | A | token | | |
| CLB-06c | Tab · Budget | P1 | Reallocation Sliders | Board Meeting Only | — | A | token | | |
| CMP-01g | Svenska Cupen variant (CupWorkspace) | P1 | Stage path + bracket | Cup run story | Draw night | A | token | | |
| DSH-01c | Season-complete milestone & transition blockers | P1 | Season Hand-off Checklist | Season Curtain | Special Edition | B | native | | |
| DSH-01d | Contextual notices (unemployed / new season) | P1 | Tone-tiered Notices | State Front Pages | — | B | native | | |
| DSH-01f | Utanför planen (contracts & radar) | P1 | Deadline Cards | Folded into Decisions | — | B | native | | |
| DSH-01h | Från klubben (latest news) | P1 | Ranked Briefs | Removed | — | A | token | | |
| DSH-01j | Styrelsen (board card) | P1 | Dual Meter + Objectives | Chairman's Note | — | A | token | | |
| ENT-03a | Step 1 · Nationer | P1 | 'Världen' advanced drawer | World map selector | — | A | token | | |
| ENT-03b | Step 2 · Ligor | P1 | League pyramid | Inline league chips on the club step | — | A | token | | |
| ENT-03c | Step 3 · Databas (summary) | P1 | Fold into drawer footer | World-building beat in the loading screen | — | A | token | | |
| ENT-03e | Step 5 · Manager | P1 | Plain form, live pass | Accreditation pass | Press release byline | B | native | | |
| ENT-03f | Step 6 · Starta (preseason) | P1 | Mandate summary | Signing ceremony | Board's first meeting | B | native | | |
| ENT-04 HI-FI | Load game (Sparade karriärer) | P1 | Career Library | Arena Title | Journal Cover | C | adapt: Season Cover (load list) | | |
| ENT-06 | Host shell (STARKVIS navbar) | P1 | Corner escape hatch | Merge into user menu | — | A | native | | |
| ENT-08a | Global search results dropdown | P1 | Command palette (⌘K) | Rich result cards | — | A | token | | |
| ENT-08b | Save controls | P1 | Autosave indicator + overflow | Save as a diegetic "kansliet" drawer | — | A | native | | |
| ENT-09 | Context bar (breadcrumb row) | P1 | Real breadcrumb in page header | Recent trail | — | A | token | | |
| ENT-12 | Career initialization / loading / error screen | P1 | Progress checklist | Arena arrival | First-day handover | C | adapt: First-day handover (Arena) | | |
| ENT-13 | Live-match banner (header subline) | P1 | Live score pill | Score bug overlay | — | A | token | | |
| MDY-01b | Confirm dialog "Kontrollera matchtruppen" | P1 | Fix-it dialog | Inline gate (no dialog) | — | A | token | | |
| MDY-01c | Blocking / lineup error alerts | P1 | Checklist tile state | Below-heading banner | — | A | token | | |
| MDY-01d | OpponentScoutingPanel (compact) | P1 | Threat cards | Summary line + link | — | A | native | | |
| MDY-02f | View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling) | P1 | Shot map + goal-mouth | Stat graphics | — | A | token | | |
| MDY-02h | TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout) | P1 | Timeout huddle phase | Whiteboard overlay | Opponent timeout notice | A | token | | |
| MDY-02l | Experimental 2D court (details) | P1 | "Plan" view tab | Picture-in-picture court | — | A | native | | |
| MGR-01 HI-FI | Karriär (manager career) | P1 | Career Ledger | Legacy Wall | Manager Biography | C | adapt: Career Chapters | | |
| MGR-01a | Tab · Profil och historik | P1 | Stats Ledger | Annotated Reputation Timeline | — | B | token | | |
| MGR-01b | Tab · Jobbmarknaden | P1 | Job Board Table | Club Offer Cards | Application Pipeline | C | token | | |
| MGR-01c | Dismissed / unemployed hero state | P1 | Dismissal Moment | Letter from the Board | — | A | native | | |
| MGR-03 | Säsongen (season hub) | P1 | Competition Centre | Path to Gold | Season Almanac | B | native | | |
| REC-01 HI-FI | Scouting & Motståndaranalys | P1 | Search Workbench | Scouting Board | Shortlist & Reports | C | adapt: Scout Desk | | |
| REC-01c | Panel "Ny bevakning" | P1 | Inline in Search Workbench | "Scouta" action sheet | — | B | token | | |
| REC-01e | Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag" | P1 | Single pipeline list | Assignment timeline | — | A | token | | |
| REC-01f | Panel "Upptäckta spelare" | P1 | Ranked discoveries table | Discovery card wall by position | — | A | token | | |
| REC-02a | Candidate dossier | P1 | Recruitment Peek drawer | Dossier as tabbed column | — | A | token | | |
| REC-03a | Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard) | P1 | Sälj mode | Urgent-bid banner only | — | A | token | | |
| REC-03d | Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer) | P1 | Affärer mode | Need heat-map on court | — | B | token | | |
| REC-04a | Start decision "Inled förhandling" | P1 | Two choice cards | Blocked-state cards | — | A | token | | |
| REC-05 | Bud på din spelare (incoming offer) | P1 | Sell decision sheet | Bidding-war scene | Ledger thread | A | token | | |
| SQD-01b | Tab "Prestation" | P1 | Position-aware stat tables | Small multiples | — | A | token | | |
| SQD-01e | Selection aside "Spelardossier & jämförelse" | P1 | Floating selection tray | Inline duel preview | — | A | token | | |
| SQD-01f | Panel "Truppens balans" (SquadDepth) | P1 | Clickable position counters | Mini court depth | — | B | native | | |
| SQD-02b | Tab "Prestation & historik" | P1 | Trend chart + match log | Season ledger | — | A | token | | |
| SQD-02c | Tab "Egenskaper" | P1 | Attributes & development workspace | Role lens | — | A | token | | |
| SQD-02d | Tab "Utveckling" | P1 | Development curve + focus | Growth ledger | — | A | token | | |
| SQD-02e | Tab "Kontrakt" | P1 | Deal sheet | Contract timeline | — | A | token | | |
| SQD-02h | Panel "Tillstånd" (PlayerConditionPanel) | P1 | Condition gauge set | Readiness timeline | — | A | native | | |
| SQD-02i | Panel "Spelaren som person" (PlayerDynamicsPanel) | P1 | Mood hub with causes | Person timeline | — | A | token | | |
| SQD-02k | Panel "Förmåga & Positionskarta" (GameplayAbilityPanel) | P1 | Suitability court | Ability band only | — | A | token | | |
| SQD-02l | Knowledge-gated panels (external players) | P1 | Tightening range bars | Fogged card | — | A | token | | |
| SQD-02n | Panel "Förläng kontrakt" (ContractRenewal) | P1 | Offer with consequence preview | Shared talk stepper | — | A | token | | |
| SQD-03 | Spelarsök (player market search) | P1 | Market Workbench | Scouting board | Need-based finder | A | token | | |
| SQD-05 | Kontrakt (contracts overview) | P1 | Contract table + payroll bar | Contract timeline (Gantt) | Renewal docket | B | token | | |
| STF-01 HI-FI | Personal – Organisation | P1 | Org & Responsibility Matrix | Staff Room | Department Journal | A | token | | |
| TRN-01d | Panel "Utveckling" | P1 | Development leaderboard | Growth small multiples | — | A | token | | |
| TRN-01e | TrainingFeedback block | P1 | Outcome on executed day | Training log | — | A | token | | |
| TRN-02c | Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6) | P1 | Matrix cells with completion | Situation cards | — | A | token | | |
| TRN-02d | Mode "Byten & Diff" (TacticsDiffManager) | P1 | Pairing lines on court | Two-way roster | — | A | token | | |
| TRN-02e | Overlay mode selector "Taktikvisning" | P1 | Segmented control + legend | Chip lens on long-press | — | A | token | | |
| TRN-02g | Section "Fasta situationer · 7-meter" (SetPieceSection) | P1 | Ordered takers with stats | Takers at the goal | — | A | token | | |
| WLD-02 | Mediecentret (Media) | P1 | News Desk | Broadcast Feed | Newsstand | C | native | | |
| WLD-02a | Tab · Nyheter (feed) | P1 | Image Lead + Dated List | Outlet Carousel | — | A | adapt: Image Lead + Dated List (Arena) | | |
| WLD-02b | Tab · Presskonferenser | P1 | Press Calendar | Decisions + Quote Archive | — | B | token | | |
| WLD-03 | Presskonferens | P1 | Rapid Answer Sheet | Press Room Scene | Live Transcript | C | adapt: Live Transcript (broadcast captions) | | |
| WLD-06 | Schema (Matcher & resultat) | P1 | Fixture Table with Crests | Fixture Cards | Calendar List View | C | token | | |
| ANL-01d | Legacy report variant (no archive) | P2 | Unified layout, degraded sections | Compact result card | — | A | native | | |
| ANL-01f | PostMatchPressBanner | P2 | Secondary press box | Inbox task | — | A | token | | |
| ANL-02a | Analysis tab bar (layout) | P2 | Three tabs + match picker | Hub secondary row | — | A | native | | |
| ANL-04 | Matchanalys – Vårt lag | P2 | Trends + window-aware tables | Squad contribution court | Merge into ANL-02 | A | token | | |
| CLB-01a | Interactive floorplan + room stage | P2 | Illustrated Map + Peek | Room List + Stage | — | A | native | | |
| CLB-01c | Identity / Supporters / National team panels | P2 | Fact Sheet | The Stand | Club Almanac | C | adapt: Club Archive panel | | |
| CLB-02a | ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik) | P2 | URL Tabs + Tables | Club Story Timeline | — | B | native | | |
| CLB-03 | Klubbpartnerskap | P2 | Clean Admin | Partner Network | Partner Dossiers + Guided Deal | C | token | | |
| CLB-03a | Partner search & agreement form | P2 | Three-step Drawer | Board Message Decision | — | A | token | | |
| CLB-04a | Club identity & coach philosophy panels | P2 | Identity Wheel | Profile in Words | — | B | token | | |
| CLB-05a | Board verdict hero | P2 | Stamp Band | Verdict Moment then Band | — | B | native | | |
| CLB-06b | Tab · Intäkter & kostnader | P2 | Bars + Arena Fill Strip | Flow Diagram | — | A | token | | |
| CLB-06e | Tab · Lönekontrakt | P2 | Merge into Kontrakt | Wage Structure | — | A | token | | |
| CMP-01b | Tab "Matcher" | P2 | Round-grouped fixtures | Fixture grid | — | A | token | | |
| CMP-01c | Tab "Resultat" | P2 | Results by round | Round recap cards | — | A | token | | |
| CMP-01d | Tab "Spelarstatistik" | P2 | Shared stats component | Link out | — | A | token | | |
| CMP-02 | Match (fixture page) | P2 | Head-to-head card | Match poster | Peek-only fixture | A | token | | |
| CMP-04 | Statistik | P2 | Leaderboards by position | Scatter explorer | Season almanac stats | A | token | | |
| DSH-01g | Senaste avtrycket (recent results) | P2 | Result Tiles | Form Strip | — | B | token | | |
| DSH-01k | Rivalerna + På andra planer + training note | P2 | Ladder Slice + Round List | Round Ticker | — | A | token | | |
| ENT-01 | Alpha access gate | P2 | Ticket at the turnstile | Tester welcome letter | — | A | native | | |
| ENT-04a | Delete-save inline confirmation | P2 | Consequence dialog with export | Soft delete with undo | — | A | native | | |
| ENT-04b | Load game: loading / empty / error states | P2 | Skeleton saves + invitation | Locker room states | — | A | token | | |
| ENT-05 | Settings (from main menu) | P2 | Unified settings panel | Settings sheet over title | Manager's preferences card | A | token | | |
| ENT-11 | Feedback / bug report modal | P2 | Help menu + context capture | Edge tab (alpha only) | — | A | native | | |
| MDY-01a | MatchdayStage ("Matchdagen") | P2 | Stakes header | Press-room panel | — | A | token | | |
| MDY-02d | View "Nyckelögonblick" | P2 | Timeline scrubber | Moment cards | — | A | token | | |
| MDY-02e | View "Spelare" | P2 | Energy-forward table | On-court formation | — | A | token | | |
| MDY-02m | Quick finish / no session / archive fallback states | P2 | Simulation progress | Styled fallback states | — | A | native | | |
| MDY-04 | Matchrepriser (match-2d replays) | P2 | Replay library | Highlight cinema | "Repris" tab in report | C | token | | |
| MED-01 | Medicinskt & Rehabilitering | P2 | Availability board | Treatment room | Return-to-play timeline | C | token | | |
| MED-01a | Active injuries table / empty scene | P2 | Rehab cards with phase stepper | Empty state: 'Full trupp' | — | A | token | | |
| MGR-02 | Historik | P2 | Season Archive | Scrapbook Wall | Season Books | C | adapt: Season Shelf (cards) | | |
| MGR-03a | SM-slutspel / Kval / Cup sections | P2 | Ghost Bracket | Tie Cards | — | A | native | | |
| MGR-03b | Season verdict & awards gala | P2 | Gala Sequence | Awards Page | — | A | native | | |
| REC-01a | ScoutingCentre ("Scoutingcentralen") | P2 | Compact header strip | Need-driven recommendations rail | — | B | token | | |
| REC-01b | Panel "Dina scouter" | P2 | Scout capacity cards | Merged into staff peek | — | A | native | | |
| REC-01d | Panel "Nytt bredare uppdrag" | P2 | Sentence builder | Coverage map | — | B | native | | |
| REC-04e | Deal completed (DealCompletion) | P2 | Signing moment | Inline confirmation | — | A | native | | |
| SQD-01d | Tab "Kontrakt" | P2 | Remove and deep-link | Kontraktsrisk view + renewal drawer | — | B | token | | |
| SQD-02f | Tab "Klubbhistorik" | P2 | Career ribbon | Merge into Historik | — | A | native | | |
| SQD-02m | Panel "Scoutingrapport" (ScoutReportPanel) | P2 | Report timeline | Report as article | — | A | token | | |
| SQD-02o | Panel "Transferläge" (PlayerTransferCard) | P2 | Unified status card | Hero status + drawer | — | A | native | | |
| SQD-02p | Panel "Medicinskt" (MedicalPanel) | P2 | Rehab timeline | Body map | — | A | token | | |
| SQD-03a | Dossier aside "Spelardossier" | P2 | Aside with mini report | Peek drawer | — | B | native | | |
| SQD-04 | Jämför spelare | P2 | Head-to-head with delta bars | Tale of the tape | Compare against baseline | A | token | | |
| SQD-05a | Panel "Ditt avtalsbeslut" | P2 | Side drawer | Inline expanding row | — | A | token | | |
| STF-01a | Staff subnav (StaffNav) | P2 | Hub secondary tabs | Control panel actions | — | A | native | | |
| STF-01b | Panel "Klubbens organisation" (OrganisationChart) | P2 | Health-coloured tree | Department cards | — | A | token | | |
| STF-01d | Rail "Veckans tränaransvar" | P2 | Mini week grid | Week Spine pins | — | A | token | | |
| STF-02 | Personprofil (staff profile) | P2 | Staff Dossier | Staff card | Interview profile | A | token | | |
| STF-02a | Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight) | P2 | Range bars with holder delta | Fit radar | — | A | token | | |
| STF-02b | Panel "Värva / Förläng eller avsluta" (StaffDealPanel) | P2 | Shared stepper + consequence preview | Summary card + modal flow | — | A | native | | |
| STF-03 | Rekrytera personal | P2 | One staff market | Vacancy-led hiring | Staff scouting board | B | token | | |
| STF-03a | View "Vakanta tjänster" | P2 | Vacancy cards with impact | Vacancy pins in org | — | A | token | | |
| STF-03b | View "Förhandlingar" | P2 | Negotiation board | Inbox threads | — | A | token | | |
| STF-03c | Panel "Hitta rätt person" (StaffMarketBoard) | P2 | Board as sole market | Ranked candidate cards | — | A | token | | |
| STF-04 | Ansvarsfördelning (delegation) | P2 | Delegation matrix | Contextual delegation + proposals queue | Weekly staff meeting | B | token | | |
| SYS-01 | Inställningar (in-career settings) | P2 | Unified settings (shared with ENT-05) | Quick settings popover | Settings inside Karriär hub | A | internal | | |
| SYS-03 | Scenario lab (engine labs) | P2 | Gate under dev console | Labs as tabs of one page | — | A | internal | | |
| SYS-04 | Match 2D QA harness | P2 | Gated QA harness with control panel | Merge into SYS-03 labs | — | A | internal | | |
| SYS-05 | CPU-rekrytering (debug) | P2 | Move under dev gate | Dev overlay on club pages | — | A | internal | | |
| TRN-02h | Section "Ledarskap" (LeadershipSection) | P2 | Single roles editor | Armband on the board | — | A | token | | |
| WLD-02c | Tab · Rivaler | P2 | Rivalry Cards | Heat Map | — | A | native | | |
| WLD-04 | Artikel (story) | P2 | Clean Reader | Outlet-skinned Article | Why This Story | B | native | | |
| WLD-06a | Preseason planner (tabs Träningsmatch / Läger-resa / Turnering) | P2 | Preseason Board on Calendar | Preseason Wizard | — | A | token | | |
| ANL-01e | Error / no report states | P3 | Empty state with routes | Fallback to fixture page | — | A | native | | |
| CLB-01b | Room cards gallery | P3 | Retire the Gallery | Status Chip Row | — | A | token | | |
| CLB-03b | Placement & international loan panels | P3 | Placement List | Drag to Partner | — | A | token | | |
| CLB-06d | Tab · Huvudbok (ledger) | P3 | Month Accordion | Statement Sheet | — | A | token | | |
| CLB-06f | Tab · Prognos | P3 | What-if Sliders | Fan Chart + Assumptions | — | B | token | | |
| CMP-01e | Tab "Klubbar" | P3 | Crest grid with Peek | Sortable club table | — | A | native | | |
| CMP-01f | Tab "Historik" | P3 | Roll of honour | Season timeline | — | A | token | | |
| CMP-01h | Non-simulated league / not found states | P3 | Scouting-destination state | Not-found with way out | — | A | token | | |
| CMP-03 | Matcher (legacy redirect) | P3 | Server redirect | Remove route | — | A | internal | | |
| MDY-01f | States: season complete / no fixture | P3 | State with next step | Redirect | — | A | native | | |
| MDY-02k | Assistant-in-control state | P3 | Assistant dock | Stand view | — | A | token | | |
| MDY-03 | Match Center (legacy redirect) | P3 | Direct redirect | Remove | — | A | internal | | |
| MGR-02a | Season selector tabs | P3 | Season Timeline | Dropdown | — | A | token | | |
| MGR-04 | Momentbiblioteket (moment library) | P3 | Dev-flagged Gallery | Move to Design Lab | — | B | internal | | |
| REC-05a | Sold moment (MomentHero "Såld") | P3 | Farewell card | News item | — | A | native | | |
| SQD-01g | Empty filter state | P3 | Reset-first empty state | Explaining empty state | — | B | token | | |
| SQD-02q | Loading / not-found states | P3 | Skeleton + recover | Suggesting not-found | — | A | native | | |
| STF-01c | Staff table + role counts | P3 | Compact list view toggle | Remove | — | A | token | | |
| STF-03d | Legacy tables "Fria scouter" + "Rekrytering — Personal" | P3 | Remove | Dev-only behind flag | — | A | internal | | |
| SYS-02 | Editor home (dev data editor) | P3 | Dev console home | Keep as is, restyle only | — | A | internal | | |
| SYS-02a | Editor · players (bulk calibration table) | P3 | Keep spreadsheet, add dev affordances | Split view | — | A | internal | | |
| SYS-02b | Editor · player detail | P3 | Diff-first detail | Drawer in SYS-02a | — | A | internal | | |
| SYS-02c | Editor · rating review roster | P3 | Review queue | Kanban by status | — | A | internal | | |
| SYS-02d | Editor · rating detail | P3 | Sectioned with sticky summary | Attribute grid compare | — | A | internal | | |
| SYS-02e | Editor · court grid calibration | P3 | Canvas + inspector | Overlay toolbar | — | A | internal | | |
| SYS-03a | Scenario lab · core | P3 | Dev shell lab | Tab in SYS-03 | — | A | internal | | |
| SYS-03b | Scenario lab · match | P3 | Timeline-first lab | Tab in SYS-03 | — | A | internal | | |
| SYS-06 | Editor mode widget (global) | P3 | DEV ribbon toggle | Palette commands | — | A | internal | | |
| TRN-01f | Loading state | P3 | Skeleton grid | Last-known plan | — | A | native | | |
| WLD-02d | Tab · Disciplin | P3 | Move to Player Status | Case File | — | A | token | | |
| WLD-02e | Tab · Medierna (outlets) | P3 | Media Favour Meters | Outlet Cards | — | A | token | | |
| WLD-06b | Schedule filter tabs | P3 | URL Segmented Control | Calendar Chips | — | B | token | | |
