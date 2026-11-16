# HM Experience 2027 — Surface Proposals

> 2–3 alternatives for every inventoried surface. Generated from `docs/experience-2027/proposals/*.json` by `design-lab/experience-2027/build-data.mjs`.
> Surfaces marked **HI-FI** have interactive high-fidelity prototypes in the Design Lab; all others render as concept boards (lo-fi wireframes) in every identity.
> Recommendations are advice only — the owner decides (see HM-EXPERIENCE-2027-OWNER-DECISIONS.md).

## Summary

| ID | Surface | Priority | A | B | C | Rec. |
|---|---|---|---|---|---|---|
| ENT-01 | Alpha access gate | P2 | Ticket at the turnstile | Tester welcome letter | — | A |
| ENT-02 **HI-FI** | Title screen (Huvudmeny) | P0 | Career Library | Arena Title | Journal Cover | C |
| ENT-03 | New game wizard | P0 | Single-screen Setup Console | Draft Night | Club first, contract last | C |
| ENT-03a | Step 1 · Nationer | P1 | 'Världen' advanced drawer | World map selector | — | A |
| ENT-03b | Step 2 · Ligor | P1 | League pyramid | Inline league chips on the club step | — | A |
| ENT-03c | Step 3 · Databas (summary) | P1 | Fold into drawer footer | World-building beat in the loading screen | — | A |
| ENT-03d | Step 4 · Klubb | P0 | Comparison table + spotlight | Map of Sweden | Club Wall by ambition | C |
| ENT-03e | Step 5 · Manager | P1 | Plain form, live pass | Accreditation pass | Press release byline | B |
| ENT-03f | Step 6 · Starta (preseason) | P1 | Mandate summary | Signing ceremony | Board's first meeting | B |
| ENT-04 **HI-FI** | Load game (Sparade karriärer) | P1 | Career Library | Arena Title | Journal Cover | C |
| ENT-04a | Delete-save inline confirmation | P2 | Consequence dialog with export | Soft delete with undo | — | A |
| ENT-04b | Load game: loading / empty / error states | P2 | Skeleton saves + invitation | Locker room states | — | A |
| ENT-05 | Settings (from main menu) | P2 | Unified settings panel | Settings sheet over title | Manager's preferences card | A |
| ENT-06 | Host shell (STARKVIS navbar) | P1 | Corner escape hatch | Merge into user menu | — | A |
| ENT-07 | Career shell · sidebar navigation | P0 | Hub rail + tabs | Top hub bar + full-bleed hubs | Hub rail + Week Spine + Peek | C |
| ENT-07a | Mobile nav drawer | P0 | Bottom tabs + docked Continue | Central Continue FAB bar | Today feed + hub sheet | A |
| ENT-08 | Career top bar (header) | P0 | Command bar | Score-bug header | Matchday clock | C |
| ENT-08a | Global search results dropdown | P1 | Command palette (⌘K) | Rich result cards | — | A |
| ENT-08b | Save controls | P1 | Autosave indicator + overflow | Save as a diegetic "kansliet" drawer | — | A |
| ENT-09 | Context bar (breadcrumb row) | P1 | Real breadcrumb in page header | Recent trail | — | A |
| ENT-09a | Progression notice (after Continue) | P0 | Next-action card | Breaking-news lower third | Spine pin + event card | C |
| ENT-10 | Continue / advance-day flow | P0 | Stateful heartbeat button | Matchweek countdown | Up-next queue | C |
| ENT-10a | Continue processing overlay ('Världen går vidare.') | P0 | Day ticker strip | Matchweek montage | Calendar flip → floodlight build-up | C |
| ENT-11 | Feedback / bug report modal | P2 | Help menu + context capture | Edge tab (alpha only) | — | A |
| ENT-12 | Career initialization / loading / error screen | P1 | Progress checklist | Arena arrival | First-day handover | C |
| ENT-13 | Live-match banner (header subline) | P1 | Live score pill | Score bug overlay | — | A |
| DSH-01 **HI-FI** | Dashboard · Managerns kontor (Hem) | P0 | Decision Briefing | Matchweek Show | Today's Paper | C |
| DSH-01a | Office hero header | P0 | Status Bar | Live Arena Masthead | Journal Masthead | C |
| DSH-01b | Next match hero + league card | P0 | Fixture Card + Ladder Slice | Pre-match Bug | Match Box | C |
| DSH-01c | Season-complete milestone & transition blockers | P1 | Season Hand-off Checklist | Season Curtain | Special Edition | B |
| DSH-01d | Contextual notices (unemployed / new season) | P1 | Tone-tiered Notices | State Front Pages | — | B |
| DSH-01e | Laget inför avkast (availability) | P0 | Availability Ring | Court Coverage | Squad Status Row | B |
| DSH-01f | Utanför planen (contracts & radar) | P1 | Deadline Cards | Folded into Decisions | — | B |
| DSH-01g | Senaste avtrycket (recent results) | P2 | Result Tiles | Form Strip | — | B |
| DSH-01h | Från klubben (latest news) | P1 | Ranked Briefs | Removed | — | A |
| DSH-01i | Veckans managerplan (weekly overview) | P0 | 7-Day Planner Strip | Week Road | Week Spine (embedded) | C |
| DSH-01j | Styrelsen (board card) | P1 | Dual Meter + Objectives | Chairman's Note | — | A |
| DSH-01k | Rivalerna + På andra planer + training note | P2 | Ladder Slice + Round List | Round Ticker | — | A |
| CLB-01 | Klubbhuset (clubhouse hub) | P1 | Department Status Board | Illustrated Clubhouse | Merged into Club Journal | C |
| CLB-01a | Interactive floorplan + room stage | P2 | Illustrated Map + Peek | Room List + Stage | — | A |
| CLB-01b | Room cards gallery | P3 | Retire the Gallery | Status Chip Row | — | A |
| CLB-01c | Identity / Supporters / National team panels | P2 | Fact Sheet | The Stand | Club Almanac | C |
| CLB-02 **HI-FI** | Klubb (own club overview) | P1 | Executive Office | Clubhouse Rooms | Club Journal | C |
| CLB-02a | ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik) | P2 | URL Tabs + Tables | Club Story Timeline | — | B |
| CLB-02b | Economy & partnerships rail | P1 | KPI Trio + Revenue Mix | Headroom Gauge | — | A |
| CLB-03 | Klubbpartnerskap | P2 | Clean Admin | Partner Network | Partner Dossiers + Guided Deal | C |
| CLB-03a | Partner search & agreement form | P2 | Three-step Drawer | Board Message Decision | — | A |
| CLB-03b | Placement & international loan panels | P3 | Placement List | Drag to Partner | — | A |
| CLB-04 | Other club profile | P1 | Opponent Dossier Tabs | Broadcast Club Profile | Peek-first Portrait | C |
| CLB-04a | Club identity & coach philosophy panels | P2 | Identity Wheel | Profile in Words | — | B |
| CLB-05 | Styrelserummet (Board) | P1 | Confidence Cockpit | Boardroom Table | Board Minutes | C |
| CLB-05a | Board verdict hero | P2 | Stamp Band | Verdict Moment then Band | — | B |
| CLB-05b | Recovery-plan & contract-offer decision cards | P1 | Pinned Decision Bar | Meeting Moment | — | B |
| CLB-06 | Finanscentralen (Finance) | P1 | Finance Cockpit | Matchday Money | Monthly Report | A |
| CLB-06a | Tab · Översikt | P1 | Chart + Action Cards | Status Sentence | — | A |
| CLB-06b | Tab · Intäkter & kostnader | P2 | Bars + Arena Fill Strip | Flow Diagram | — | A |
| CLB-06c | Tab · Budget | P1 | Reallocation Sliders | Board Meeting Only | — | A |
| CLB-06d | Tab · Huvudbok (ledger) | P3 | Month Accordion | Statement Sheet | — | A |
| CLB-06e | Tab · Lönekontrakt | P2 | Merge into Kontrakt | Wage Structure | — | A |
| CLB-06f | Tab · Prognos | P3 | What-if Sliders | Fan Chart + Assumptions | — | B |
| MGR-01 **HI-FI** | Karriär (manager career) | P1 | Career Ledger | Legacy Wall | Manager Biography | C |
| MGR-01a | Tab · Profil och historik | P1 | Stats Ledger | Annotated Reputation Timeline | — | B |
| MGR-01b | Tab · Jobbmarknaden | P1 | Job Board Table | Club Offer Cards | Application Pipeline | C |
| MGR-01c | Dismissed / unemployed hero state | P1 | Dismissal Moment | Letter from the Board | — | A |
| MGR-02 | Historik | P2 | Season Archive | Scrapbook Wall | Season Books | C |
| MGR-02a | Season selector tabs | P3 | Season Timeline | Dropdown | — | A |
| MGR-03 | Säsongen (season hub) | P1 | Competition Centre | Path to Gold | Season Almanac | B |
| MGR-03a | SM-slutspel / Kval / Cup sections | P2 | Ghost Bracket | Tie Cards | — | A |
| MGR-03b | Season verdict & awards gala | P2 | Gala Sequence | Awards Page | — | A |
| MGR-04 | Momentbiblioteket (moment library) | P3 | Dev-flagged Gallery | Move to Design Lab | — | B |
| WLD-01 **HI-FI** | Inkorg (Inbox) | P0 | Task Inbox | Messenger Feed | Correspondence Desk | C |
| WLD-01a | Inbox filters | P0 | Segment + Chips | Sender Lanes | — | A |
| WLD-01b | Message reader + empty states | P0 | Action-first Reader | Scene Reader | Thread Reader with Chain Rail | C |
| WLD-02 | Mediecentret (Media) | P1 | News Desk | Broadcast Feed | Newsstand | C |
| WLD-02a | Tab · Nyheter (feed) | P1 | Image Lead + Dated List | Outlet Carousel | — | A |
| WLD-02b | Tab · Presskonferenser | P1 | Press Calendar | Decisions + Quote Archive | — | B |
| WLD-02c | Tab · Rivaler | P2 | Rivalry Cards | Heat Map | — | A |
| WLD-02d | Tab · Disciplin | P3 | Move to Player Status | Case File | — | A |
| WLD-02e | Tab · Medierna (outlets) | P3 | Media Favour Meters | Outlet Cards | — | A |
| WLD-03 | Presskonferens | P1 | Rapid Answer Sheet | Press Room Scene | Live Transcript | C |
| WLD-04 | Artikel (story) | P2 | Clean Reader | Outlet-skinned Article | Why This Story | B |
| WLD-05 **HI-FI** | Kalender | P0 | Planner Grid | Season Road | Week Spine Calendar | C |
| WLD-06 | Schema (Matcher & resultat) | P1 | Fixture Table with Crests | Fixture Cards | Calendar List View | C |
| WLD-06a | Preseason planner (tabs Träningsmatch / Läger-resa / Turnering) | P2 | Preseason Board on Calendar | Preseason Wizard | — | A |
| WLD-06b | Schedule filter tabs | P3 | URL Segmented Control | Calendar Chips | — | B |
| MED-01 | Medicinskt & Rehabilitering | P2 | Availability board | Treatment room | Return-to-play timeline | C |
| MED-01a | Active injuries table / empty scene | P2 | Rehab cards with phase stepper | Empty state: 'Full trupp' | — | A |
| SYS-01 | Inställningar (in-career settings) | P2 | Unified settings (shared with ENT-05) | Quick settings popover | Settings inside Karriär hub | A |
| SYS-02 | Editor home (dev data editor) | P3 | Dev console home | Keep as is, restyle only | — | A |
| SYS-02a | Editor · players (bulk calibration table) | P3 | Keep spreadsheet, add dev affordances | Split view | — | A |
| SYS-02b | Editor · player detail | P3 | Diff-first detail | Drawer in SYS-02a | — | A |
| SYS-02c | Editor · rating review roster | P3 | Review queue | Kanban by status | — | A |
| SYS-02d | Editor · rating detail | P3 | Sectioned with sticky summary | Attribute grid compare | — | A |
| SYS-02e | Editor · court grid calibration | P3 | Canvas + inspector | Overlay toolbar | — | A |
| SYS-03 | Scenario lab (engine labs) | P2 | Gate under dev console | Labs as tabs of one page | — | A |
| SYS-03a | Scenario lab · core | P3 | Dev shell lab | Tab in SYS-03 | — | A |
| SYS-03b | Scenario lab · match | P3 | Timeline-first lab | Tab in SYS-03 | — | A |
| SYS-04 | Match 2D QA harness | P2 | Gated QA harness with control panel | Merge into SYS-03 labs | — | A |
| SYS-05 | CPU-rekrytering (debug) | P2 | Move under dev gate | Dev overlay on club pages | — | A |
| SYS-06 | Editor mode widget (global) | P3 | DEV ribbon toggle | Palette commands | — | A |
| SQD-01 **HI-FI** | Truppen & Omklädningsrummet (squad list) | P0 | Squad Matrix | Locker Room | Depth Chart | A |
| SQD-01a | Tab "Översikt" | P0 | Curated summary + expandable rows | Readiness cards | Next-match readiness grouping | A |
| SQD-01b | Tab "Prestation" | P1 | Position-aware stat tables | Small multiples | — | A |
| SQD-01c | Tab "Fysisk status" | P0 | Readiness heat-strip | Load quadrant board | — | A |
| SQD-01d | Tab "Kontrakt" | P2 | Remove and deep-link | Kontraktsrisk view + renewal drawer | — | B |
| SQD-01e | Selection aside "Spelardossier & jämförelse" | P1 | Floating selection tray | Inline duel preview | — | A |
| SQD-01f | Panel "Truppens balans" (SquadDepth) | P1 | Clickable position counters | Mini court depth | — | B |
| SQD-01g | Empty filter state | P3 | Reset-first empty state | Explaining empty state | — | B |
| SQD-02 **HI-FI** | Spelarprofil (player dossier) | P0 | Dossier | Athlete Spotlight | Feature Profile + Peek | C |
| SQD-02a | Tab "Profil & egenskaper" (overview) | P0 | Key-ratings summary | Storyline overview | Decisions-first overview | A |
| SQD-02b | Tab "Prestation & historik" | P1 | Trend chart + match log | Season ledger | — | A |
| SQD-02c | Tab "Egenskaper" | P1 | Attributes & development workspace | Role lens | — | A |
| SQD-02d | Tab "Utveckling" | P1 | Development curve + focus | Growth ledger | — | A |
| SQD-02e | Tab "Kontrakt" | P1 | Deal sheet | Contract timeline | — | A |
| SQD-02f | Tab "Klubbhistorik" | P2 | Career ribbon | Merge into Historik | — | A |
| SQD-02g | PlayerHero + PlayerActions | P0 | Sticky identity bar + primary CTA | Spotlight hero + action dock | Kicker header + numbered actions | A |
| SQD-02h | Panel "Tillstånd" (PlayerConditionPanel) | P1 | Condition gauge set | Readiness timeline | — | A |
| SQD-02i | Panel "Spelaren som person" (PlayerDynamicsPanel) | P1 | Mood hub with causes | Person timeline | — | A |
| SQD-02j | Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel) | P0 | Heat matrix | Radar showcase | Report bars with words | A |
| SQD-02k | Panel "Förmåga & Positionskarta" (GameplayAbilityPanel) | P1 | Suitability court | Ability band only | — | A |
| SQD-02l | Knowledge-gated panels (external players) | P1 | Tightening range bars | Fogged card | — | A |
| SQD-02m | Panel "Scoutingrapport" (ScoutReportPanel) | P2 | Report timeline | Report as article | — | A |
| SQD-02n | Panel "Förläng kontrakt" (ContractRenewal) | P1 | Offer with consequence preview | Shared talk stepper | — | A |
| SQD-02o | Panel "Transferläge" (PlayerTransferCard) | P2 | Unified status card | Hero status + drawer | — | A |
| SQD-02p | Panel "Medicinskt" (MedicalPanel) | P2 | Rehab timeline | Body map | — | A |
| SQD-02q | Loading / not-found states | P3 | Skeleton + recover | Suggesting not-found | — | A |
| SQD-03 | Spelarsök (player market search) | P1 | Market Workbench | Scouting board | Need-based finder | A |
| SQD-03a | Dossier aside "Spelardossier" | P2 | Aside with mini report | Peek drawer | — | B |
| SQD-04 | Jämför spelare | P2 | Head-to-head with delta bars | Tale of the tape | Compare against baseline | A |
| SQD-05 | Kontrakt (contracts overview) | P1 | Contract table + payroll bar | Contract timeline (Gantt) | Renewal docket | B |
| SQD-05a | Panel "Ditt avtalsbeslut" | P2 | Side drawer | Inline expanding row | — | A |
| STF-01 **HI-FI** | Personal – Organisation | P1 | Org & Responsibility Matrix | Staff Room | Department Journal | A |
| STF-01a | Staff subnav (StaffNav) | P2 | Hub secondary tabs | Control panel actions | — | A |
| STF-01b | Panel "Klubbens organisation" (OrganisationChart) | P2 | Health-coloured tree | Department cards | — | A |
| STF-01c | Staff table + role counts | P3 | Compact list view toggle | Remove | — | A |
| STF-01d | Rail "Veckans tränaransvar" | P2 | Mini week grid | Week Spine pins | — | A |
| STF-02 | Personprofil (staff profile) | P2 | Staff Dossier | Staff card | Interview profile | A |
| STF-02a | Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight) | P2 | Range bars with holder delta | Fit radar | — | A |
| STF-02b | Panel "Värva / Förläng eller avsluta" (StaffDealPanel) | P2 | Shared stepper + consequence preview | Summary card + modal flow | — | A |
| STF-03 | Rekrytera personal | P2 | One staff market | Vacancy-led hiring | Staff scouting board | B |
| STF-03a | View "Vakanta tjänster" | P2 | Vacancy cards with impact | Vacancy pins in org | — | A |
| STF-03b | View "Förhandlingar" | P2 | Negotiation board | Inbox threads | — | A |
| STF-03c | Panel "Hitta rätt person" (StaffMarketBoard) | P2 | Board as sole market | Ranked candidate cards | — | A |
| STF-03d | Legacy tables "Fria scouter" + "Rekrytering — Personal" | P3 | Remove | Dev-only behind flag | — | A |
| STF-04 | Ansvarsfördelning (delegation) | P2 | Delegation matrix | Contextual delegation + proposals queue | Weekly staff meeting | B |
| TRN-01 **HI-FI** | Träning & Återhämtning | P0 | Weekly Planner Grid | Training Hall | Assistant Proposal | C |
| TRN-01a | Panel "Assistentens träningsplan" (AssistantTrainingPanel) | P0 | Diff overlay on grid | Compact assistant card | — | A |
| TRN-01b | Panel "Veckoschema" (week planner) | P0 | Block planner | Day-focus timeline | Template-first | A |
| TRN-01c | Panel "Spelarberedskap" | P0 | Shared readiness strip + inline settings | Load lanes | — | A |
| TRN-01d | Panel "Utveckling" | P1 | Development leaderboard | Growth small multiples | — | A |
| TRN-01e | TrainingFeedback block | P1 | Outcome on executed day | Training log | — | A |
| TRN-01f | Loading state | P3 | Skeleton grid | Last-known plan | — | A |
| TRN-02 | Matchplan & Taktiktavla 2.0 | P0 | Tactics Board | Coach's Clipboard | Assistant-guided Match Plan | A |
| TRN-02a | Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup) | P0 | Inline warning + auto-fix preview | Checklist item with fix drawer | — | A |
| TRN-02b | Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs) | P0 | Phase × manpower switcher | Court flip | Split court | A |
| TRN-02c | Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6) | P1 | Matrix cells with completion | Situation cards | — | A |
| TRN-02d | Mode "Byten & Diff" (TacticsDiffManager) | P1 | Pairing lines on court | Two-way roster | — | A |
| TRN-02e | Overlay mode selector "Taktikvisning" | P1 | Segmented control + legend | Chip lens on long-press | — | A |
| TRN-02f | Rail "Så spelar vi" (CoachingChoices) | P0 | Choices with trade-off lines | Style dials with target band | Identity sentence | A |
| TRN-02g | Section "Fasta situationer · 7-meter" (SetPieceSection) | P1 | Ordered takers with stats | Takers at the goal | — | A |
| TRN-02h | Section "Ledarskap" (LeadershipSection) | P2 | Single roles editor | Armband on the board | — | A |
| TRN-02i | Roster "Matchtrupp · n spelare" / "Ej uttagna" | P0 | Bench strip + counter | Two-column readiness roster | Squad selection step | A |
| REC-01 **HI-FI** | Scouting & Motståndaranalys | P1 | Search Workbench | Scouting Board | Shortlist & Reports | C |
| REC-01a | ScoutingCentre ("Scoutingcentralen") | P2 | Compact header strip | Need-driven recommendations rail | — | B |
| REC-01b | Panel "Dina scouter" | P2 | Scout capacity cards | Merged into staff peek | — | A |
| REC-01c | Panel "Ny bevakning" | P1 | Inline in Search Workbench | "Scouta" action sheet | — | B |
| REC-01d | Panel "Nytt bredare uppdrag" | P2 | Sentence builder | Coverage map | — | B |
| REC-01e | Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag" | P1 | Single pipeline list | Assignment timeline | — | A |
| REC-01f | Panel "Upptäckta spelare" | P1 | Ranked discoveries table | Discovery card wall by position | — | A |
| REC-02 | Rekryteringscentrum | P0 | Pipeline table with stage tabs | Recruitment war room | Unified pipeline board | C |
| REC-02a | Candidate dossier | P1 | Recruitment Peek drawer | Dossier as tabbed column | — | A |
| REC-03 **HI-FI** | Transfer Centre | P0 | Market Table + Deal Panel | Deal Room | Transfer Desk Pipeline | A |
| REC-03a | Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard) | P1 | Sälj mode | Urgent-bid banner only | — | A |
| REC-03b | Market tabs (Möjligheter / Hela marknaden / Bevakade) | P0 | Saved views over one table | Opportunity spotlight carousel | Need-first view | A |
| REC-03c | Dossier aside (TransferDossier) | P0 | Deal drawer | Player card flip | — | A |
| REC-03d | Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer) | P1 | Affärer mode | Need heat-map on court | — | B |
| REC-04 | Förhandlingsrum (negotiation room) | P0 | Term Sheet | Across the Table | Deal Ledger | A |
| REC-04a | Start decision "Inled förhandling" | P1 | Two choice cards | Blocked-state cards | — | A |
| REC-04b | Decision form – club stage | P0 | Range-band slider | Offer presets | Counter-proposal helper | A |
| REC-04c | Decision form – player stage | P0 | Package builder with total cost | Agent card | Contract document | A |
| REC-04d | Waiting / closed status | P0 | Waiting card with advance | Closed outcome card | — | A |
| REC-04e | Deal completed (DealCompletion) | P2 | Signing moment | Inline confirmation | — | A |
| REC-05 | Bud på din spelare (incoming offer) | P1 | Sell decision sheet | Bidding-war scene | Ledger thread | A |
| REC-05a | Sold moment (MomentHero "Såld") | P3 | Farewell card | News item | — | A |
| CMP-01 **HI-FI** | Tävlingar (competition workspace) | P0 | League Centre | Broadcast League Hub | Competition Almanac | A |
| CMP-01a | Tab "Tabell & form" | P0 | Annotated standings | Points ladder | Race chart | A |
| CMP-01b | Tab "Matcher" | P2 | Round-grouped fixtures | Fixture grid | — | A |
| CMP-01c | Tab "Resultat" | P2 | Results by round | Round recap cards | — | A |
| CMP-01d | Tab "Spelarstatistik" | P2 | Shared stats component | Link out | — | A |
| CMP-01e | Tab "Klubbar" | P3 | Crest grid with Peek | Sortable club table | — | A |
| CMP-01f | Tab "Historik" | P3 | Roll of honour | Season timeline | — | A |
| CMP-01g | Svenska Cupen variant (CupWorkspace) | P1 | Stage path + bracket | Cup run story | Draw night | A |
| CMP-01h | Non-simulated league / not found states | P3 | Scouting-destination state | Not-found with way out | — | A |
| CMP-02 | Match (fixture page) | P2 | Head-to-head card | Match poster | Peek-only fixture | A |
| CMP-03 | Matcher (legacy redirect) | P3 | Server redirect | Remove route | — | A |
| CMP-04 | Statistik | P2 | Leaderboards by position | Scatter explorer | Season almanac stats | A |
| MDY-01 | Matchförhandsvisning (match preview / matchday gate) | P0 | Pre-match checklist board | Matchday build-up | Three-step ritual | C |
| MDY-01a | MatchdayStage ("Matchdagen") | P2 | Stakes header | Press-room panel | — | A |
| MDY-01b | Confirm dialog "Kontrollera matchtruppen" | P1 | Fix-it dialog | Inline gate (no dialog) | — | A |
| MDY-01c | Blocking / lineup error alerts | P1 | Checklist tile state | Below-heading banner | — | A |
| MDY-01d | OpponentScoutingPanel (compact) | P1 | Threat cards | Summary line + link | — | A |
| MDY-01e | Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare" | P0 | Court lineup with readiness rings | Starting seven busts | Readiness table | A |
| MDY-01f | States: season complete / no fixture | P3 | State with next step | Redirect | — | A |
| MDY-02 **HI-FI** | Live match (Match Center) | P0 | Bench Tablet | Broadcast | Floodlight Sequence | C |
| MDY-02a | Header / scoreboard & manpower | P0 | Score bug with pips | Broadcast bug + manpower bar | Two-row header | A |
| MDY-02b | Controls bar | P0 | Transport control | Auto-pause rules | Play-or-sim menu | A |
| MDY-02c | View "Översikt" | P0 | Live-first overview | Court + caption | Momentum + feed | A |
| MDY-02d | View "Nyckelögonblick" | P2 | Timeline scrubber | Moment cards | — | A |
| MDY-02e | View "Spelare" | P2 | Energy-forward table | On-court formation | — | A |
| MDY-02f | View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling) | P1 | Shot map + goal-mouth | Stat graphics | — | A |
| MDY-02g | Coach aside "Dina matchbeslut" (LiveCoachPanel) | P0 | Bench Dock | Court drag substitutions | Shout cards | A |
| MDY-02h | TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout) | P1 | Timeout huddle phase | Whiteboard overlay | Opponent timeout notice | A |
| MDY-02i | Half-time state | P0 | Half-time briefing | Dressing-room talk | Half-time editorial | A |
| MDY-02j | Full-time state | P0 | Final-whistle card | Merge with report | Celebration/blues moment | A |
| MDY-02k | Assistant-in-control state | P3 | Assistant dock | Stand view | — | A |
| MDY-02l | Experimental 2D court (details) | P1 | "Plan" view tab | Picture-in-picture court | — | A |
| MDY-02m | Quick finish / no session / archive fallback states | P2 | Simulation progress | Styled fallback states | — | A |
| MDY-03 | Match Center (legacy redirect) | P3 | Direct redirect | Remove | — | A |
| MDY-04 | Matchrepriser (match-2d replays) | P2 | Replay library | Highlight cinema | "Repris" tab in report | C |
| ANL-01 **HI-FI** | Matchrapport | P0 | Stats Sheet | Highlight Show | Editorial Match Report | C |
| ANL-01a | Archived match center (4 views) | P0 | Depth tabs behind summary | Collapsed "Hela matchen" section | Moment explorer | A |
| ANL-01b | MatchAftermathPanel ("Efter matchen") | P1 | Momentum hero | Press clippings | — | A |
| ANL-01c | Details "Speltid och belastning" | P1 | Workload with actions | Heat strip | — | A |
| ANL-01d | Legacy report variant (no archive) | P2 | Unified layout, degraded sections | Compact result card | — | A |
| ANL-01e | Error / no report states | P3 | Empty state with routes | Fallback to fixture page | — | A |
| ANL-01f | PostMatchPressBanner | P2 | Secondary press box | Inbox task | — | A |
| ANL-02 | Matchanalys – Översikt | P1 | Trend dashboard | Analyst's room | Weekly analysis column | A |
| ANL-02a | Analysis tab bar (layout) | P2 | Three tabs + match picker | Hub secondary row | — | A |
| ANL-03 | Matchanalys – Motståndaren | P1 | Mirror comparison | Opponent dossier | Scout report article | A |
| ANL-04 | Matchanalys – Vårt lag | P2 | Trends + window-aware tables | Squad contribution court | Merge into ANL-02 | A |
| ANL-05 | Matchanalys – Senaste matchen | P1 | Keep as stats deep dive with picker | Replay-led analysis | Merge into report | C |

## ENT — Entry & global shell

### ENT-01 · Alpha access gate

**Current:** A plain centred card ('Tidig testversion' / 'Handball Manager Alpha') with one code input blocks every route; the default code ships in the client bundle, so the gate is cosmetic.

**Recommendation:** A — The gate should disappear for public builds; while it exists it should cost one tap and already feel like the game. Folding it into the arena splash keeps the first impression branded without building a second title screen.

**Priority:** P2 · **Dependencies:** Env flag for alpha gate, ENT-02 backdrop asset

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Ticket at the turnstile

| | |
|---|---|
| Visual concept | The gate becomes the first frame of the title screen: dimmed arena backdrop, wordmark, and a small 'Ange testkod' ticket stub that tears away on success and reveals ENT-02 underneath. |
| Layout | Full-bleed ENT-02 backdrop blurred at 60%; centred ticket card (360px) with code field, Lås upp button and a one-line explanation of the alpha + where codes come from. |
| Information hierarchy | 1) Wordmark 2) code field 3) what the alpha is / how to get a code. |
| Interactions | Autofocus field, Enter submits, inline error (role=alert kept), success = ticket tear (200 ms, crossfade under reduced motion) into the title screen. |
| Navigation | Wraps the root layout as today; hands straight to ENT-02 with no reload. Env-gated wrapper so public builds skip it entirely. |
| Desktop | Ticket centred over blurred arena; title-screen buttons visible but inert behind it. |
| Mobile | Ticket docks to bottom third as a sheet so the keyboard does not cover the field; wordmark stays on top. |
| Advantages | First impression is the product, not a form; Zero extra screens; Keeps current accessibility semantics |
| Disadvantages | Still a client-side cosmetic gate unless moved server-side |
| Complexity / perf | S / Low |
| Works with | ENT-02 |
| Fits identities | B, C |

#### B — Tester welcome letter

| | |
|---|---|
| Visual concept | An editorial 'letter to testers' page: what is being tested this build, known issues, how feedback works, and the code field as the signature line. |
| Layout | Two columns: left letter (kicker, headline, 3 short paragraphs, known-issues list); right code card + feedback promise. |
| Information hierarchy | 1) Headline 2) code field 3) known issues. |
| Interactions | Code submit; collapsible known-issues; link to feedback (ENT-11). |
| Navigation | On success goes to ENT-02; content of the letter re-openable from ENT-11 help menu. |
| Desktop | Paper surface, 2-column letter. |
| Mobile | Single column, code card first, letter below. |
| Advantages | Sets tester expectations; Reduces duplicate bug reports |
| Disadvantages | Adds reading before play; Needs per-build copy maintenance |
| Complexity / perf | S / Low |
| Works with | ENT-02, ENT-11 |
| Fits identities | C, A |

### ENT-02 · Title screen (Huvudmeny) — HI-FI prototype `entry`

**Current:** Two-column hero: tagline, big HANDBALL MANAGER wordmark and a row of 12 procedural crests on the left; four large text buttons (NYTT SPEL / FORTSÄTT / LADDA SPEL / INSTÄLLNINGAR) on the right over a faint SVG court outline; internal 'GAME EXPERIENCE v2' footer.

**Recommendation:** C — Most sessions start here with an existing career, so the title screen should be about *your* club's current story, not a generic menu. Journal Cover makes Continue the hero with real state (week, next fixture, last result) while degrading gracefully to a new-player welcome; Arena Title is the stronger pick if the owner chooses identity B.

**Priority:** P0 · **Dependencies:** G1 base identity, Save summary metadata (club, season, next fixture, last result), ENT-04, Club colour tokens (--club/--club-2)

**Arena Nights (owner identity, 2026-11-13):** adapt → *Season Cover* — Keep the cover structure exactly (masthead, generated lead headline + standfirst, one Fortsätt CTA, arena photo with crest stamp, three briefs, back issues = other careers). Masthead becomes a broadcast title strap with a club-neon underline; headline set in Barlow Condensed italic; photo full-bleed with dark gradient; crest stamp glows in the club neon; back issues become glass cards, the active one glowing instead of an offset paper shadow. _Conflict:_ The recommended Journal Cover is built on a printed-magazine metaphor: paper cover, nameplate masthead with double rule, framed photo and back-issue stack styled as paper with offset shadows. Arena Nights has no paper layer.

#### A — Career Library

| | |
|---|---|
| Visual concept | The title screen *is* your shelf of careers: the most recent save is a large 'resume' card, other saves are smaller cards, and New Game is the last card in the row. Menu items shrink to a quiet top-right utility row. |
| Layout | Top utility row (wordmark left; Inställningar, Ladda fil right). Main: hero resume card (8 cols: crest, club, 'Säsong 2026/27 · Omg 12', table position, last result, next fixture) + 'what happened since you left' list (4 cols). Below: card row of other saves + '+ Ny karriär' card. |
| Information hierarchy | 1) Fortsätt as Tumba HK (resume card) 2) since-you-left digest 3) other careers / new career. |
| Interactions | Enter = Fortsätt; arrow keys move across save cards; hover on a card shows mini season chart; '…' on a card opens Ladda / Exportera / Ta bort (routes to ENT-04a pattern). |
| Navigation | Replaces most of ENT-04 for players with ≤4 saves; "Alla karriärer" link to ENT-04 for more. New-game card → ENT-03, Fortsätt → DSH-01. |
| Desktop | Light, dense, keyboard-first; 12-col grid, no imagery beyond crests and a position sparkline. |
| Mobile | Resume card fills first screen with a thumb-zone 'Fortsätt' button; other saves as a horizontal snap row; utility row collapses to a ⋯ menu. |
| Advantages | Fastest path back into the game (one key); Shows real state, kills the "which save was that?" problem; Removes the need to visit Load Game for most players |
| Disadvantages | Least atmospheric first impression for new players; Needs save metadata (last result, position) cached at save time — needs new data: save-summary snapshot |
| Complexity / perf | M / Low |
| Works with | ENT-04, ENT-03, DSH-01 |
| Fits identities | A |
| Patterns | Continue button as heartbeat |

#### B — Arena Title

| | |
|---|---|
| Visual concept | A cinematic broadcast opener: the last-played club's arena photograph in floodlight, its crest flying in, club colours tinting the light beams; menu is a broadcast lower-third. New players see a neutral Swedish handball arena and a crest wall of all playable clubs. |
| Layout | Full-bleed arena media; bottom-left lower-third with wordmark + club line; right edge vertical menu of 4 broadcast tabs (angled corners); ticker along the bottom with since-you-left headlines. |
| Information hierarchy | 1) Arena + crest (emotion) 2) FORTSÄTT tab with club name 3) ticker news. |
| Interactions | Ambient light sweep (paused under reduced motion); hover on menu tab previews (e.g. hovering Ladda spel fans out save crests); click Fortsätt triggers a camera push-in to DSH-01. |
| Navigation | Same 4 destinations as today; Fortsätt → DSH-01 with shared-element crest; Ladda → ENT-04 Arena variant. |
| Desktop | Video-game title feel; 16:9 hero, menu on the right third. |
| Mobile | Portrait crop of arena with crest centred; menu as stacked full-width broadcast bars at the bottom; ticker hidden. |
| Advantages | Strongest emotional pull and screenshot value; Uses existing environment photography; Club colours make it personal immediately |
| Disadvantages | Asset hungry (per-club arena imagery needed for full effect — needs new data: arena image per club or fallback set); Highest motion cost; Since-you-left content is secondary |
| Complexity / perf | L / High |
| Works with | ENT-04, ENT-03, DSH-01, ENT-12 |
| Fits identities | B |
| Patterns | Broadcast camera / view switcher |

#### C — Journal Cover

| | |
|---|---|
| Visual concept | The title screen is the cover of your club's journal for this week: masthead 'HANDBALL MANAGER', issue line 'Vecka 12 · 2026/27', a lead headline generated from state ('Tumba reser till Kristianstad efter tre raka segrar'), a framed arena photo, and Fortsätt as the cover's call to action. No save → cover welcomes you: 'Välj din klubb. Skriv din historia.' |
| Layout | Masthead row; main split 7/5: left lead headline + standfirst + Fortsätt CTA, right framed photo with crest stamp; bottom strip of three briefs (last result, table position, next fixture) and a quiet menu line (Ny karriär · Alla karriärer · Inställningar). |
| Information hierarchy | 1) Headline about your club 2) Fortsätt 3) briefs and secondary menu. |
| Interactions | Fortsätt primary; 'Byt karriär' opens a small cover-flip of other saves (each save is a cover); paper→floodlight dim on Fortsätt as the transition into the career. |
| Navigation | Fortsätt → DSH-01 (Today's Paper continues the metaphor); Alla karriärer → ENT-04; Ny karriär → ENT-03. |
| Desktop | Paper surface, editorial grid, one curated photo. |
| Mobile | Vertical cover: masthead, photo, headline, Fortsätt pinned at the bottom; briefs as a 3-item list; menu line under it. |
| Advantages | Answers 'where was I?' in one sentence; Continuity with existing paper/navy/signal identity; Cheaper than B (one photo, no motion system); Distinctive — no competitor uses a cover |
| Disadvantages | Headline generation needs good copy templates; needs new data: save-summary snapshot (last result, position, next fixture) readable without opening the full save |
| Complexity / perf | M / Low |
| Works with | DSH-01, ENT-04, ENT-03 |
| Fits identities | C |
| Patterns | Continue button as heartbeat; Era- or tier-skinned news |

### ENT-03 · New game wizard

**Current:** Six-step CareerEntryFrame (Nationer → Ligor → Databas → Klubb → Manager → Starta) with a numbered left rail, choice-card grids in the centre, a live context column (126px crest, club facts, manager pass, world counters) and a sticky Back/Next footer.

**Recommendation:** C — Club choice is how the player identifies with their club, so it must come first and feel like a decision, not step 4 of a database wizard. 'Club first, contract last' collapses the six steps into three emotional beats (club → manager → signing) while keeping the world configuration available as an advanced drawer.

**Priority:** P0 · **Dependencies:** ENT-03d, ENT-03e, ENT-03f, ENT-12, Club preseason context (predicted, expectation, strengthVsLeague, economyLabel), G1 base identity

**Arena Nights (owner identity, 2026-11-13):** adapt → *Club first, contract last — living club card* — Keep the three beats (Klubb · Manager · Kontrakt) and the growing context column, rendered as a living glass club card. When a club is picked, the whole wizard switches to that club's neon accent: the Club Identity System is shown at the moment of choice. Byline becomes a manager tag; mandate becomes a board-goal strip. _Conflict:_ The right-hand context column is a 'growing club journal page' (paper page with byline).

#### A — Single-screen Setup Console

| | |
|---|---|
| Visual concept | Everything on one scrollable page with a sticky summary: a club table you can sort by Förhandstips, Truppstyrka, Ekonomi; inline manager fields; preseason segmented control; Starta karriär in the summary bar. Power users finish in 30 seconds. |
| Layout | Left 8 cols: sortable club table (crest, club, serie, ort, arena, tips, förväntan, styrka ±, ekonomi). Right 4 cols sticky: selected club card + manager fields + preseason segmented control + Starta. 'Världen' (nations/leagues) collapsed above the table. |
| Information hierarchy | 1) Club table 2) selected club summary 3) manager + start. |
| Interactions | Sort/filter the table; arrow keys move selection, summary updates live; Världen drawer for nations/leagues with a live count of playable clubs. |
| Navigation | From ENT-02; Starta → ENT-12 → DSH-01. No step rail. |
| Desktop | Dense, fast, one screen. |
| Mobile | Club list as ranked cards (crest, name, tips, styrka); a bottom sheet holds manager + preseason + Starta once a club is picked. |
| Advantages | Fastest setup; Comparing clubs on real numbers is easy; Removes the empty Databas step |
| Disadvantages | No ceremony — the club choice feels like a filter result; Manager identity becomes an afterthought |
| Complexity / perf | M / Low |
| Works with | ENT-03d, ENT-12, DSH-01 |
| Fits identities | A |
| Patterns | Density modes |

#### B — Draft Night

| | |
|---|---|
| Visual concept | A broadcast "choose your team" sequence: a crest wall of every playable club in its own colours; selecting one swings the camera into that club's arena with a broadcast lower-third of facts; then a locker-room manager card; then a signing ceremony. |
| Layout | Step 1 full-bleed crest wall grouped Handbollsligan / Allsvenskan; Step 2 arena hero with club stats as broadcast graphics; Step 3 manager card on dark glass; Step 4 signing ceremony. |
| Information hierarchy | 1) Crests in club colours 2) selected club spotlight 3) proceed. |
| Interactions | Hover a crest lights it; click → spotlight transition; L/R to browse club spotlights; Välj klubben locks in; skippable motion. |
| Navigation | Linear 4 beats with a progress bug top-left; back always available; advanced world settings via gear icon. |
| Desktop | Immersive, 16:9 scenes. |
| Mobile | Swipeable full-screen club cards (one club per card, colour field + crest + 3 key facts); swipe up to select. |
| Advantages | Maximum identification with the chosen club; Clubs differentiated by colour and arena at a glance |
| Disadvantages | Comparing clubs on numbers is harder; Needs arena imagery per club (needs new data: per-club arena photo or styled fallback); Heavy motion |
| Complexity / perf | L / High |
| Works with | ENT-03d, ENT-03f, ENT-12 |
| Fits identities | B |
| Patterns | Broadcast camera / view switcher |

#### C — Club first, contract last

| | |
|---|---|
| Visual concept | Three beats instead of six: 1 'Välj din hemmaplan' (club choice, with world settings as an advanced drawer), 2 'Vem är du?' (manager), 3 'Kontraktet' (preseason length + signing). The right context column becomes a growing club journal page that fills as you choose. |
| Layout | Top: 3-step progress line (Klubb · Manager · Kontrakt). Centre 8 cols: step content. Right 4 cols: living journal page (crest, club headline, facts, then manager byline, then mandate). Sticky footer Back / Next. |
| Information hierarchy | 1) The club decision 2) the journal page reflecting it 3) Next. |
| Interactions | Step 1 offers three lenses on the same clubs (ambition chips: Överleva / Utmana / Vinna; league toggle HBL/Allsvenskan); world settings drawer shows playable-club count; 'Signera' on step 3 triggers the ENT-03f signing moment. |
| Navigation | From ENT-02 Ny karriär; finishes into ENT-12 (club-themed loading) → DSH-01. Nations/leagues/Databas live in the drawer (ENT-03a/b/c merged). |
| Desktop | Paper three-zone frame kept (low migration cost) but with 3 steps and a richer right column. |
| Mobile | Step content full-width; the journal page becomes a collapsible header card showing crest + club name; footer CTA thumb-reachable. |
| Advantages | Emotional choice first, chores hidden; Reuses CareerEntryFrame structure; Context column becomes a story, not a dl |
| Disadvantages | Advanced users must open the drawer to change nations; Journal headline copy needs templates |
| Complexity / perf | M / Low |
| Works with | ENT-03d, ENT-03e, ENT-03f, ENT-12, DSH-01 |
| Fits identities | C, A |
| Patterns | Scenario starts with 3 goals |

### ENT-03a · Step 1 · Nationer

**Current:** Step 1 of the wizard: a grid of checkbox cards per nation (flag + code, name, '# ligor i urvalet', ✓ Vald / + Välj) plus a note card.

**Recommendation:** A — Only Swedish clubs are playable, so nation selection is a world-size setting, not a first decision. It belongs in an advanced 'Världen' drawer with sensible defaults.

**Priority:** P1 · **Dependencies:** ENT-03 restructure, ENT-03b

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — 'Världen' advanced drawer

| | |
|---|---|
| Visual concept | Nation selection moves into a right-side drawer opened from a 'Världen: 3 nationer · 5 ligor' chip on the club step; defaults pre-selected. |
| Layout | Drawer 420px: nation list with toggles and league count; footer shows simulated-world size (clubs, players). |
| Information hierarchy | 1) Defaults summary chip 2) nation toggles 3) world size. |
| Interactions | Toggle rows; Återställ standard; closing updates playable-club count on the club step. |
| Navigation | Opened from ENT-03d toolbar; never a step. |
| Desktop | Right drawer over the wizard. |
| Mobile | Full-height bottom sheet. |
| Advantages | Removes a step; Keeps power-user control |
| Disadvantages | Less discoverable for players who care about world size |
| Complexity / perf | S / Low |
| Works with | ENT-03b, ENT-03d |
| Fits identities | A, C |

#### B — World map selector

| | |
|---|---|
| Visual concept | A stylised Europe map where nations light up when included; a counter shows leagues and clubs simulated. |
| Layout | Map 8 cols, selected list 4 cols. |
| Information hierarchy | 1) Map 2) counts. |
| Interactions | Click a country to toggle; hover shows its leagues. |
| Navigation | Inside the Världen drawer or as an optional screen. |
| Desktop | Map canvas. |
| Mobile | List fallback (map too small to tap reliably). |
| Advantages | Visual sense of world scope |
| Disadvantages | Map asset for a low-stakes setting; Small countries hard to hit |
| Complexity / perf | M / Medium |
| Works with | ENT-03b |
| Fits identities | B |

### ENT-03b · Step 2 · Ligor

**Current:** Step 2: per-nation sections of league cards showing tier as a zero-padded number ('01'), club count and playable-club count; empty-state note when none is playable.

**Recommendation:** A — A pyramid makes the Swedish system (Handbollsligan over Allsvenskan, with kval between) legible and doubles as a teaching moment, while staying inside the advanced drawer.

**Priority:** P1 · **Dependencies:** ENT-03a drawer, Competition tier metadata

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — League pyramid

| | |
|---|---|
| Visual concept | Each nation's leagues drawn as a stacked pyramid: Handbollsligan on top, Allsvenskan below, with kval arrows between tiers; playable tiers marked with a crest count. |
| Layout | One pyramid per nation, stacked; toggle on each tier row. |
| Information hierarchy | 1) Tier names 2) playable clubs 3) promotion/relegation links. |
| Interactions | Toggle a tier; hover the kval arrow explains promotion/relegation (glossary tooltip). |
| Navigation | Inside Världen drawer; changes update ENT-03d immediately. |
| Desktop | Pyramid in drawer. |
| Mobile | Stacked tier rows with indent by tier. |
| Advantages | Teaches the league structure; Replaces bare tier numbers |
| Disadvantages | Needs promotion/relegation links per tier (exists for Sweden; other nations unverified) |
| Complexity / perf | S / Low |
| Works with | ENT-03a, ENT-03d |
| Fits identities | A, C |
| Patterns | In-game glossary; Nested lockable tooltips |

#### B — Inline league chips on the club step

| | |
|---|---|
| Visual concept | No league screen at all: league chips (Handbollsligan · Allsvenskan · +) sit above the club grid and filter it; adding non-Swedish leagues is in the Världen drawer. |
| Layout | Chip row above ENT-03d grid. |
| Information hierarchy | 1) Club grid 2) league filter. |
| Interactions | Toggle chips filters and includes leagues at once. |
| Navigation | Part of ENT-03d. |
| Desktop | Chip row. |
| Mobile | Horizontally scrolling chips. |
| Advantages | Zero extra screens |
| Disadvantages | Conflates "include in world" with "filter the list" |
| Complexity / perf | S / Low |
| Works with | ENT-03d |
| Fits identities | A |

### ENT-03c · Step 3 · Databas (summary)

**Current:** Step 3 'Databas': four MiniStat counters, the list of selected competitions and an explanatory note; asks nothing of the player.

**Recommendation:** A — A step with no decision should not exist. Its counts are useful as a footer of the world drawer.

**Priority:** P1 · **Dependencies:** ENT-03a drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Fold into drawer footer

| | |
|---|---|
| Visual concept | Remove the step; the four counters (nationer, ligor, klubbar, spelare) become a one-line footer in the Världen drawer and a tooltip on the 'Världen' chip. |
| Layout | Single footer line. |
| Information hierarchy | Tertiary. |
| Interactions | None beyond tooltip. |
| Navigation | Step removed from rail. |
| Desktop | Drawer footer. |
| Mobile | Sheet footer. |
| Advantages | One fewer step |
| Disadvantages | Loses the "this is a big world" moment |
| Complexity / perf | S / Low |
| Works with | ENT-03a, ENT-03b |
| Fits identities | A, C |

#### B — World-building beat in the loading screen

| | |
|---|---|
| Visual concept | Move the counters into ENT-12 while the world is generated ('Bygger 84 klubbar, 1 400 spelare…'), turning dead loading time into the summary. |
| Layout | Counters tick up on ENT-12. |
| Information hierarchy | Secondary to club crest on ENT-12. |
| Interactions | Passive. |
| Navigation | Step removed. |
| Desktop | Counter strip on loading screen. |
| Mobile | Same strip, 2×2. |
| Advantages | Uses waiting time; Keeps the scale moment |
| Disadvantages | Counts shown after the choice can no longer change |
| Complexity / perf | S / Low |
| Works with | ENT-12 |
| Fits identities | B, C |

### ENT-03d · Step 4 · Klubb

**Current:** Step 4: toolbar with count, a radio-card grid of ~30 near-identical text cards (48px crest, name, league, city · venue, heritage tag, 'Tips: 7:a · förväntan'), and a <details> list of non-playable clubs; the real differentiators (Truppstyrka mot serien, Ekonomi, Styrelsens förväntan) only appear in the right column after selection.

**Recommendation:** C — This is how the player identifies with their club. The ambition-led Club Wall puts club colour and identity first, shows the real differentiators on every tile, and frames the choice as a challenge type (Överleva / Utmana / Vinna) — the 'scenario with three goals' pattern built purely from existing preseason context.

**Priority:** P0 · **Dependencies:** Club preseason context (predicted, clubsInLeague, expectation, strengthVsLeague, economyLabel), Club colours (primaryColor + secondary), ENT-03 restructure, ClubCrest component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Comparison table + spotlight

| | |
|---|---|
| Visual concept | A sortable club table with every differentiator as a column, inline bars for Truppstyrka ± and Ekonomi, and a spotlight card on the right for the selected row. |
| Layout | Table 8 cols (crest, klubb, serie, ort, arena · platser, tips x/14, förväntan, styrka ± bar, ekonomi); spotlight 4 cols (126px crest, heritage line, facts, Välj). |
| Information hierarchy | 1) Sorted table 2) selected spotlight 3) Välj. |
| Interactions | Sort any column; filter HBL/Allsvenskan; arrow keys + Enter; compare two clubs by shift-click (side-by-side spotlight). |
| Navigation | Next → ENT-03e. |
| Desktop | Dense table. |
| Mobile | Ranked cards with crest, name, tips and styrka bar; tap = spotlight bottom sheet. |
| Advantages | Best for informed choice; All differentiators visible without clicking |
| Disadvantages | Feels like a spreadsheet at the most emotional moment |
| Complexity / perf | S / Low |
| Works with | ENT-03e, CLB-04 |
| Fits identities | A |
| Patterns | Density modes; Bulk actions + notes on entities |

#### B — Map of Sweden

| | |
|---|---|
| Visual concept | Clubs placed on a stylised map of Sweden as crest pins in club colours; clustering in Skåne, Stockholm, Göteborg tells the geography of Swedish handball. Selecting a pin opens a club postcard (arena, capacity, founded, heritage, tips). |
| Layout | Map 7 cols (tall), postcard 5 cols; league toggle overlay. |
| Information hierarchy | 1) Where in Sweden 2) the club postcard 3) Välj. |
| Interactions | Zoom into regions; pins filter by league; rivals within 50 km highlighted (derby hint). |
| Navigation | Next → ENT-03e. |
| Desktop | Map + postcard. |
| Mobile | Map as top half with region chips; postcards swipe horizontally beneath. |
| Advantages | Strong local identity (home town); Derby geography emerges naturally |
| Disadvantages | needs new data: club coordinates; Hard to compare strength/economy; Dense regions need clustering |
| Complexity / perf | L / Medium |
| Works with | ENT-03e, CLB-04 |
| Fits identities | B, C |

#### C — Club Wall by ambition

| | |
|---|---|
| Visual concept | Every playable club is a colour tile (primary colour field, secondary stripe, crest, name, town) grouped by the challenge it offers — 'Vinna' (tipped top 3), 'Utmana' (mid-table, strength ≈ 0), 'Överleva' (tipped bottom / Allsvenskan climbers). Each tile shows three micro-meters: Förväntan, Truppstyrka ±, Ekonomi. |
| Layout | Top: ambition tabs + league toggle. Grid of colour tiles (4 per row desktop). Right 4 cols: living journal page that expands the selected club (heritage line, arena, founded, board expectation in a quote, Seriestart). |
| Information hierarchy | 1) Colour + crest (recognition) 2) ambition group (what kind of story) 3) micro-meters (informed choice). |
| Interactions | Hover tile = club colour floods the journal page header; click selects; 'Jämför' pins up to 3 tiles for a side-by-side; non-playable clubs shown greyed in an 'Övriga klubbar i världen' strip. |
| Navigation | Next → ENT-03e; the selected club's colours tint the rest of the wizard. |
| Desktop | Tile wall + journal column (CareerEntryFrame kept). |
| Mobile | Ambition tabs sticky; tiles 2 per row; tapping a tile expands it in place to show facts and a Välj button. |
| Advantages | Club identity first, numbers second but present; Ambition framing cures blank-slate paralysis without new gameplay; Uses only existing context data |
| Disadvantages | Grouping thresholds need tuning; Club secondary colour may need curating for poor-contrast pairs |
| Complexity / perf | M / Low |
| Works with | ENT-03, ENT-03e, ENT-03f, CLB-04 |
| Fits identities | C, B |
| Patterns | Scenario starts with 3 goals; Hover cards for every entity |

### ENT-03e · Step 5 · Manager

**Current:** Step 5: three form fields (name, nationality select, date of birth) beside a 'Tränarbänken' pass card showing an initials monogram.

**Recommendation:** B — The manager pass is a strong existing metaphor; making it a credential the player fills in (with optional coaching philosophy as flavour) gives identity without inventing gameplay. A philosophy choice must stay cosmetic until a system exists.

**Priority:** P1 · **Dependencies:** ENT-03 restructure, Monogram/avatar component (G4 portrait strategy)

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Plain form, live pass

| | |
|---|---|
| Visual concept | Keep the three fields but make the pass card update live and larger; add a monogram colour taken from the chosen club. |
| Layout | Form 6 cols, pass 6 cols. |
| Information hierarchy | 1) Name 2) pass preview. |
| Interactions | Typing updates pass; nationality flag appears. |
| Navigation | → ENT-03f. |
| Desktop | Side by side. |
| Mobile | Pass on top (compact), form below. |
| Advantages | Minimal work; Fast |
| Disadvantages | Still identity-light |
| Complexity / perf | S / Low |
| Works with | ENT-03f, MGR-01 |
| Fits identities | A |

#### B — Accreditation pass

| | |
|---|---|
| Visual concept | The manager fills in a sports-federation accreditation: photo slot (monogram or chosen avatar style), name, nationality, date of birth, and an optional 'Tränarfilosofi' line (e.g. 'Snabba omställningar', '6-0 och tålamod') printed on the pass as flavour text. |
| Layout | Large pass centred (credit-card ratio, club colours, lanyard), fields edit directly on the pass. |
| Information hierarchy | 1) The pass 2) name 3) optional philosophy. |
| Interactions | Click a field on the pass to edit in place; avatar style picker (monogram / silhouette variants); philosophy chosen from a short list or skipped. |
| Navigation | → ENT-03f; the pass reappears in MGR-01 and the ENT-03f signing. |
| Desktop | Pass at 480px over the club-coloured background. |
| Mobile | Pass full-width, fields as stacked inputs under it. |
| Advantages | Strong identity artefact reused later; No new gameplay required |
| Disadvantages | Philosophy is cosmetic — must be labelled so (needs new data: stored philosophy string); Avatar choice depends on G4 |
| Complexity / perf | M / Low |
| Works with | ENT-03f, MGR-01 |
| Fits identities | B, C |
| Patterns | Traits as personality |

#### C — Press release byline

| | |
|---|---|
| Visual concept | The manager step is a draft press release from the chosen club: '[Klubben] presenterar [namn] som ny huvudtränare'. The player fills the blanks; a quote line is optional. |
| Layout | Editorial article 8 cols with inline fill-in fields; right 4 cols the club crest and date. |
| Information hierarchy | 1) Headline with your name 2) club 3) fields. |
| Interactions | Inline fields in text; preview toggles. |
| Navigation | → ENT-03f; the release later seeds the first WLD-02 news item. |
| Desktop | Article column. |
| Mobile | Article full width; fields remain inline but larger. |
| Advantages | Narrative continuity into Media; Tone fits identity C |
| Disadvantages | needs new data: first news item seeded from manager creation; Form fields in prose are less scannable |
| Complexity / perf | M / Low |
| Works with | ENT-03f, WLD-02, MGR-01 |
| Fits identities | C |
| Patterns | Era- or tier-skinned news |

### ENT-03f · Step 6 · Starta (preseason)

**Current:** Step 6: mandate banner ('Ditt uppdrag · 2026/27', manager name 'tar plats hos' club, 84px crest), radio grid of five preseason options with dates (8/6/4/2 weeks or first match) and a summary dl, then STARTA KARRIÄR.

**Recommendation:** B — The start of a career should be a moment. The signing ceremony uses the existing DEAL_SIGNED backdrop, keeps the preseason choice as a clear decision with dates, and makes STARTA a signature rather than a submit.

**Priority:** P1 · **Dependencies:** DEAL_SIGNED environment image, ENT-03e pass, ENT-12

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Mandate summary

| | |
|---|---|
| Visual concept | A clean confirmation: club + manager header, preseason as a horizontal timeline from today to Seriestart with the 5 options as stops, summary list, Starta. |
| Layout | Header 12; timeline 12; summary 8 + CTA 4. |
| Information hierarchy | 1) Timeline choice 2) summary 3) Starta. |
| Interactions | Drag/click stop on timeline; shows training weeks and friendlies window. |
| Navigation | → ENT-12. |
| Desktop | Horizontal timeline. |
| Mobile | Vertical timeline list. |
| Advantages | Preseason length becomes understandable in time |
| Disadvantages | Low ceremony |
| Complexity / perf | S / Low |
| Works with | ENT-12, WLD-06a |
| Fits identities | A |
| Patterns | Pre-season directive meeting |

#### B — Signing ceremony

| | |
|---|---|
| Visual concept | Floodlight moment on the DEAL_SIGNED backdrop: the contract document (club crest, 'Huvudtränare', season 2026/27, board expectation quote) with the preseason choice as a clause; the player signs by pressing and holding 'Signera' — then flash and crest stamp. |
| Layout | Full-bleed backdrop; centred contract card; clause section with 5 preseason radio chips and dates; signature line CTA. |
| Information hierarchy | 1) Contract with club 2) preseason clause 3) Signera. |
| Interactions | Press-and-hold to sign (keyboard: hold Enter / or plain click under reduced motion); stamp animation; skippable. |
| Navigation | → ENT-12 themed with club colours. |
| Desktop | Cinematic card on photo. |
| Mobile | Contract scrolls; sticky signature bar at bottom. |
| Advantages | Memorable start; reuses existing asset; Board expectation framed as stakes |
| Disadvantages | Hold-to-sign must have an accessible alternative |
| Complexity / perf | M / Medium |
| Works with | ENT-03e, ENT-12, CLB-05 |
| Fits identities | B, C |
| Patterns | Pre-season directive meeting |

#### C — Board's first meeting

| | |
|---|---|
| Visual concept | Framed as the first board meeting: the chair states expectation (from preseason context), budget label and a target; the manager answers by choosing preseason length ('Jag vill ha 6 veckor'). |
| Layout | Dialogue column 8 (board portrait monogram + speech), response options 4. |
| Information hierarchy | 1) Board expectation 2) your answer. |
| Interactions | Choose a response = preseason option. |
| Navigation | → ENT-12; meeting archived in CLB-05. |
| Desktop | Dialogue layout. |
| Mobile | Chat-like stack. |
| Advantages | Sets season stakes as a ritual |
| Disadvantages | Risk of fake choice framing; must stay presentation only |
| Complexity / perf | M / Low |
| Works with | CLB-05, ENT-12 |
| Fits identities | C |
| Patterns | Pre-season directive meeting; Staff as faces of systems |

### ENT-04 · Load game (Sparade karriärer) — HI-FI prototype `entry`

**Current:** Same three-zone frame as New Game: rail with save count; a 6-column table (Manager, Klubb, Säsong, Speldatum as raw ISO, Senast spelad, actions); right context column with 126px crest, manager, facts and next match; delete is a two-step inline row.

**Recommendation:** C — Saves are careers, i.e. stories — cards with club colour, season progress and last result are far easier to recognise than a table row. Journal Cover keeps the B/C metaphor consistent with the title screen; Career Library (A) is the recommended fallback if the title screen goes A.

**Priority:** P1 · **Dependencies:** ENT-02 choice, Save-summary snapshot, ENT-04a, ENT-04b

**Arena Nights (owner identity, 2026-11-13):** adapt → *Season Cover (load list)* — Same as ENT-02: back issues become glass career cards with crest, season, position; the current career glows in its own club neon, each card previews its own club accent. _Conflict:_ Shares the Journal Cover concept with ENT-02 (back issues as paper issues).

#### A — Career Library

| | |
|---|---|
| Visual concept | Saves as a sortable list of career rows with crest, club, manager, season progress bar (omgång 12/26), table position and last-played; selected row expands to a preview panel. |
| Layout | List 8 cols, preview 4 cols; toolbar with sort (Senast spelad / Klubb) and Importera fil. |
| Information hierarchy | 1) Most recent career 2) progress 3) actions. |
| Interactions | Arrow keys + Enter to load; ⋯ menu Exportera / Ta bort; drag a .json file anywhere to import. |
| Navigation | From ENT-02; Ladda → ENT-12 → DSH-01. |
| Desktop | List + preview. |
| Mobile | List rows only; tap = preview bottom sheet with Ladda. |
| Advantages | Scales to many saves; Formatted dates and progress instead of ISO |
| Disadvantages | Little emotion |
| Complexity / perf | S / Low |
| Works with | ENT-02, ENT-04a, ENT-12 |
| Fits identities | A |

#### B — Arena Title

| | |
|---|---|
| Visual concept | Saves as a carousel of club 'jerseys' / crest banners in club colours in a dark arena; centred card shows season, position, last result; Ladda is a broadcast button. |
| Layout | Horizontal carousel centred; info lower-third; actions row. |
| Information hierarchy | 1) Centred club 2) season state 3) Ladda. |
| Interactions | L/R arrows/swipe; Enter loads; hold Delete for ENT-04a. |
| Navigation | From ENT-02 Arena; → ENT-12. |
| Desktop | Carousel 3 visible. |
| Mobile | One full-width card per swipe. |
| Advantages | Consistent with Arena title; Club colours make saves recognisable |
| Disadvantages | Poor for many saves; Hard to compare |
| Complexity / perf | M / Medium |
| Works with | ENT-02, ENT-12 |
| Fits identities | B |

#### C — Journal Cover

| | |
|---|---|
| Visual concept | Each save is a journal cover on a shelf: masthead in club colours, the latest headline from that career, issue line ('Vecka 12 · 2026/27 · 3:a i HBL'). Select to open a spread with the last 5 results and next fixture. |
| Layout | Shelf grid of covers (3-4 per row); selected cover opens a right spread 5 cols. |
| Information hierarchy | 1) Covers (club colour + headline) 2) selected spread 3) Fortsätt karriären. |
| Interactions | Click cover → spread; Fortsätt; ⋯ Exportera / Ta bort (ENT-04a confirm with export offer); '+ Ny karriär' is a blank cover. |
| Navigation | From ENT-02; → ENT-12. |
| Desktop | Shelf + spread. |
| Mobile | Covers as a vertical list of half-height cards; spread as full-screen sheet. |
| Advantages | Every save remembered by its story; Continuity with cover title screen |
| Disadvantages | needs new data: save-summary snapshot (latest headline, last results) |
| Complexity / perf | M / Low |
| Works with | ENT-02, ENT-04a, ENT-12, DSH-01 |
| Fits identities | C |

### ENT-04a · Delete-save inline confirmation

**Current:** An extra full-width table row with the question, club · date and two buttons (Behåll karriären / Ta bort karriären); deletion is permanent with no export prompt.

**Recommendation:** A — A permanent, unrecoverable delete deserves a real dialog that names what is lost and offers export first.

**Priority:** P2 · **Dependencies:** ENT-04, Export save function (exists in ENT-08b)

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Consequence dialog with export

| | |
|---|---|
| Visual concept | Modal that shows the club crest, season and play time, states 'Kan inte ångras', and offers 'Exportera först' as the primary safe action next to a destructive 'Ta bort'. |
| Layout | Small dialog: crest + summary, consequence line, buttons Exportera först · Behåll · Ta bort. |
| Information hierarchy | 1) What is deleted 2) Exportera först 3) Ta bort. |
| Interactions | Esc/Behåll closes; Ta bort requires typing club short name only for saves >1 season (optional). |
| Navigation | Returns to ENT-04. |
| Desktop | Centred dialog. |
| Mobile | Bottom sheet with stacked buttons, destructive last. |
| Advantages | Prevents irreversible accidents |
| Disadvantages | One more click |
| Complexity / perf | S / Low |
| Works with | ENT-04 |
| Fits identities | A, B, C |
| Patterns | Predictive consequence preview |

#### B — Soft delete with undo

| | |
|---|---|
| Visual concept | Deleting moves the save to 'Papperskorg' for 7 days with an Ångra toast; permanent deletion happens later or from the bin. |
| Layout | Toast + bin section at the bottom of ENT-04. |
| Information hierarchy | 1) Ångra toast. |
| Interactions | Ångra within toast; restore from bin. |
| Navigation | Bin visible in ENT-04. |
| Desktop | Toast bottom-left. |
| Mobile | Toast above bottom bar. |
| Advantages | No modal friction; Recoverable |
| Disadvantages | needs new data: deletedAt flag on saves; Storage used longer |
| Complexity / perf | M / Low |
| Works with | ENT-04 |
| Fits identities | A |

### ENT-04b · Load game: loading / empty / error states

**Current:** Text blocks in the centre column (overline + heading + paragraph) for loading, empty and error; the context column swaps to matching copy; no skeletons.

**Recommendation:** A — Skeletons matching the chosen save layout remove layout jump; the empty state should be an invitation to the club choice, not a dead end.

**Priority:** P2 · **Dependencies:** ENT-04 layout choice, ENT-03

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Skeleton saves + invitation

| | |
|---|---|
| Visual concept | Loading = 3 skeleton save cards in final layout; empty = one large '+ Ny karriär' card with a teaser of the club wall (row of crests); error = card explaining IndexedDB in plain Swedish with Försök igen and Exportera-help link. |
| Layout | Same grid as ENT-04 final. |
| Information hierarchy | Loading: shape; Empty: CTA; Error: cause + retry. |
| Interactions | Retry; Skapa en karriär. |
| Navigation | Empty → ENT-03. |
| Desktop | Grid skeletons. |
| Mobile | List skeletons. |
| Advantages | No layout shift; Empty state sells the game |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | ENT-04, ENT-03 |
| Fits identities | A, C |
| Patterns | Vague notifications |

#### B — Locker room states

| | |
|---|---|
| Visual concept | Empty = empty locker room photo with 'Ingen har hängt upp sin tröja här än' and Ny karriär; error = dim arena with the error and retry. |
| Layout | Full-width media state. |
| Information hierarchy | 1) Image 2) message 3) CTA. |
| Interactions | CTA buttons. |
| Navigation | → ENT-03. |
| Desktop | Media band. |
| Mobile | Portrait crop. |
| Advantages | Atmospheric |
| Disadvantages | Asset need; Heavier for a rare state |
| Complexity / perf | S / Medium |
| Works with | ENT-04 |
| Fits identities | B |

### ENT-05 · Settings (from main menu)

**Current:** A simple page with header and three plain sections: Valuta (EUR/SEK as link-styled radios), Matchhastighet select and an explanatory note; diverges from the in-career settings page (SYS-01).

**Recommendation:** A — One settings component used in and out of career removes the divergence and is the natural home for density, text size and reduced motion — accessibility settings that matter more than currency.

**Priority:** P2 · **Dependencies:** SYS-01, Density modes (G6), Reduced-motion token

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Unified settings panel

| | |
|---|---|
| Visual concept | One settings component with sections Visning (density, textstorlek, rörelse, tema), Match (standardhastighet), Ekonomi (valuta with live sample amount), Data (export/import moved here); used on /settings and /career/settings. |
| Layout | Left section nav 3 cols, content 9 cols with grouped rows (label, control, live preview). |
| Information hierarchy | 1) Section 2) control 3) preview. |
| Interactions | Instant apply; reset per section; real radio inputs. |
| Navigation | Out of career from ENT-02; in career from user menu (ENT-08) — same component. |
| Desktop | Two-column settings. |
| Mobile | Section list → push detail. |
| Advantages | One implementation; Accessibility settings added; Fixes link-as-radio semantics |
| Disadvantages | needs new data: persisted density/text-size/motion prefs |
| Complexity / perf | M / Low |
| Works with | SYS-01, ENT-02, ENT-08 |
| Fits identities | A, C |
| Patterns | Density modes |

#### B — Settings sheet over title

| | |
|---|---|
| Visual concept | Settings open as a side sheet over the title screen instead of a separate page, so the arena/cover stays visible behind and changes (e.g. theme, density) preview live on it. |
| Layout | Right sheet 480px over ENT-02. |
| Information hierarchy | 1) Controls. |
| Interactions | Sheet open/close; live preview behind. |
| Navigation | No route change. |
| Desktop | Side sheet. |
| Mobile | Full-screen sheet. |
| Advantages | Keeps atmosphere; Live preview of visual settings |
| Disadvantages | Different container than in-career page |
| Complexity / perf | S / Low |
| Works with | ENT-02 |
| Fits identities | B |

#### C — Manager's preferences card

| | |
|---|---|
| Visual concept | Settings presented as a short 'så vill jag ha det' card with 4 plain-language toggles and an Avancerat expander. |
| Layout | Single column card. |
| Information hierarchy | 1) Top 4 toggles 2) Avancerat. |
| Interactions | Toggle, expand. |
| Navigation | Same route. |
| Desktop | Centred card. |
| Mobile | Full width. |
| Advantages | Approachable |
| Disadvantages | Hides power settings |
| Complexity / perf | S / Low |
| Works with | SYS-01 |
| Fits identities | C |
| Patterns | Settings sprawl |

### ENT-06 · Host shell (STARKVIS navbar)

**Current:** STARKVIS portfolio navbar injected via shadow DOM (z-index 2147483000, 160px when revealed, 8px reveal edge) with 'Handball Manager · LAB', '← Tillbaka till Apps' and an app switcher in teal #00c2b3; initially visible.

**Recommendation:** A — Host chrome must never compete with the game. Hidden by default inside the career with one small escape hatch preserves immersion at near-zero cost.

**Priority:** P1 · **Dependencies:** Host shell config flag

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Corner escape hatch

| | |
|---|---|
| Visual concept | Inside /career and match routes the host shell is hidden; a 28px corner affordance (bottom-left, below feedback) reveals 'Tillbaka till Apps'. On ENT-02 it may stay as a slim 32px strip. |
| Layout | Corner pill; no reserved height. |
| Information hierarchy | Tertiary. |
| Interactions | Click/hover pill reveals the existing panel. |
| Navigation | External Apps hub only. |
| Desktop | Corner pill. |
| Mobile | Item in the ⋯ menu instead of a pill. |
| Advantages | Restores the game header; Trivial change |
| Disadvantages | Host discoverability drops |
| Complexity / perf | S / Low |
| Works with | ENT-08, ENT-11 |
| Fits identities | A, B, C |

#### B — Merge into user menu

| | |
|---|---|
| Visual concept | No host bar at all; 'Tillbaka till STARKVIS Apps' becomes the last item of the in-game user/overflow menu (with save, settings, feedback). |
| Layout | Menu item. |
| Information hierarchy | Tertiary. |
| Interactions | Menu click. |
| Navigation | Overflow menu in ENT-08. |
| Desktop | Overflow menu. |
| Mobile | Drawer footer. |
| Advantages | Cleanest |
| Disadvantages | Requires host to respect a no-inject flag |
| Complexity / perf | S / Low |
| Works with | ENT-08b, ENT-11 |
| Fits identities | A, B, C |

### ENT-07 · Career shell · sidebar navigation

**Current:** Dark navy 232px sidebar with HM wordmark, club badge (64px crest + name + league) and one flat list of 27 links under six injected group labels ('Klubben' alone holds 11 unrelated items), reused icons, 12px labels / 9px group labels, inbox badge, and 'Sparade karriärer →' in the footer.

**Recommendation:** C — The hub model (6 hubs + in-hub tabs) is non-negotiable across all directions; the Week Spine + hub rail variant adds what a manager game lacks most — a visible game clock — and pairs with the Peek drawer to stop page-hopping. If C is not chosen, A's rail is the safe default.

**Priority:** P0 · **Dependencies:** G2 navigation model, Hub IA mapping of 27 routes → 6 hubs, ENT-08, ENT-10, WLD-05 calendar data, Peek drawer component, Command palette (ENT-08a)

**Arena Nights (owner identity, 2026-11-13):** token → *Week Spine + hub rail in Arena Nights* — Rail and Week Spine on dark glass; today's day cell lit in club neon; match days in club primary with a neon top edge; active hub with neon inset bar. _Conflict:_ No conflict, but note: choosing Arena Nights as identity does NOT switch the navigation to Arena's original top hub bar. The recommended navigation model (6-hub rail + Week Spine + Peek + Ctrl-K) is preserved and restyled.

#### A — Hub rail + tabs

| | |
|---|---|
| Visual concept | A 64px icon+label rail with exactly six hubs — Idag, Laget, Klubben, Rekrytering, Tävling, Karriär — each with one distinct icon; hub pages carry a secondary tab row (e.g. Laget → Trupp · Taktik · Träning · Medicinskt · Kontrakt). Expands to 220px with labels on hover/pin. |
| Layout | Rail: crest at top (club colour ring), 6 hubs, spacer, Inkorg (badge), settings/user at bottom. Content area gets a hub header with tab row. Mapping: Idag = Hem, Inkorg, Kalender+Schema; Laget = Trupp, Taktik, Träning, Medicinskt, Kontrakt; Klubben = Klubbhuset, Klubb, Styrelsen, Ekonomi, Personal; Rekrytering = Spelarsök+Scouting, Rekrytering, Transfers; Tävling = Tävlingar, Säsongen, Svenska Cupen, Statistik, Analys; Karriär = Karriär, Historik, Media. |
| Information hierarchy | 1) Current hub (accent bar) 2) tab within hub 3) inbox badge. |
| Interactions | Keyboard 1–6 jumps to hubs; hover-expand; pin to keep expanded; badges per hub (e.g. Laget shows injury count). |
| Navigation | Every legacy route resolves to hub + tab; old URLs redirect; breadcrumb (ENT-09) shows hub › tab › entity. |
| Desktop | Collapsed 64px rail by default to give tables room; pinned 220px option. |
| Mobile | Becomes bottom tab bar (ENT-07a). |
| Advantages | 27 → 6 top-level items; Distinct icons regain meaning; Fastest to build on current stack |
| Disadvantages | Requires owner decisions on where ambiguous items live (Media, Analys); Muscle memory reset for alpha testers |
| Complexity / perf | M / Low |
| Works with | ENT-07a, ENT-08, ENT-09, DSH-01, CLB-01 |
| Fits identities | A |
| Patterns | Inform vs navigate separation; Control panel per area; Command palette / global search |

#### B — Top hub bar + full-bleed hubs

| | |
|---|---|
| Visual concept | No sidebar. A broadcast-style top bar (crest, six hubs, Continue) and each hub opens a full-bleed hub landing (Laget = Locker room, Klubben = Clubhouse, Rekrytering = Scouting office, Tävling = Arena) with environment photography and stacked panels linking to sub-pages. |
| Layout | Top bar 64px; hub landing hero 320px with environment image; panels below; sub-pages keep a slim hub sub-nav. |
| Information hierarchy | 1) Hub hero (place) 2) panels (stories/status) 3) sub-page links. |
| Interactions | Hub transitions as camera moves (shared-element crest); hover hub shows dropdown of its sub-pages for experts. |
| Navigation | Two levels: hub landing → sub-page; Klubbhuset (CLB-01) becomes the Klubben landing rather than duplicating nav. |
| Desktop | Full width content, more horizontal room for tables. |
| Mobile | Bottom bar with central Continue; hubs as swipeable full-screen cards. |
| Advantages | Strongest sense of place; Resolves Klubbhuset/sidebar duplication; Uses existing environment photography |
| Disadvantages | Extra click to deep pages unless dropdowns are used (FM26 tile-nav risk); Asset and motion cost |
| Complexity / perf | L / High |
| Works with | ENT-08, CLB-01, DSH-01 |
| Fits identities | B |
| Patterns | Inform vs navigate separation; Tiles as navigation and modal cards for routine lookups |

#### C — Hub rail + Week Spine + Peek

| | |
|---|---|
| Visual concept | The A rail (six hubs) plus a persistent Week Spine under the top bar: Mon–Sun with training, match, deadline and event pins and the next two fixtures. The Spine is the game clock — Continue advances along it — and any entity link opens the Peek drawer on the right instead of navigating. |
| Layout | Left rail 64/220px; top bar; Week Spine 56px full width (today highlighted, pins per day, next-match chip at right end); content; Peek drawer 420px overlays from the right when invoked. |
| Information hierarchy | 1) Today on the Spine + next pin 2) current hub/tab 3) content. |
| Interactions | Click a day = jump to WLD-05 day view; hover a pin = what happens (e.g. 'Lör · HBL omg 12 · IFK Kristianstad (B)'); Peek drawer opens from any player/club/staff/fixture chip with 'Öppna hela sidan'; 1–6 hub keys; ⌘K palette. |
| Navigation | Same hub mapping as A; the Spine links into WLD-05/WLD-06; Peek reduces navigation to SQD/CLB-04 pages for quick looks. |
| Desktop | Rail + Spine + content + optional Peek; Spine compresses to current week only at <1200px. |
| Mobile | Spine becomes a swipeable day strip under the top bar; bottom tab bar (ENT-07a); Peek becomes a bottom sheet. |
| Advantages | Gives the game clock visual weight (biggest current gap); Peek kills round-trips to profile pages; Continuity with existing paper identity |
| Disadvantages | Two shell components to build (Spine, Peek); Vertical space cost of the Spine on short laptops |
| Complexity / perf | L / Medium |
| Works with | ENT-08, ENT-10, WLD-05, WLD-06, DSH-01, ENT-07a |
| Fits identities | C, A |
| Patterns | Continue button as heartbeat; Hover cards for every entity; Command palette / global search; Play menu as season state machine |

### ENT-07a · Mobile nav drawer

**Current:** On ≤760px the same 27-item sidebar slides in from the left (min(84vw,300px)) with a scrim; it closes on navigation and Esc, duplicates the save controls in its footer, has no focus trap, and is the only phone navigation.

**Recommendation:** A — Phones need thumb navigation and a reachable heartbeat. A bottom tab bar with the hubs plus a docked Continue is the proven pattern and matches every direction's mobile principle.

**Priority:** P0 · **Dependencies:** ENT-07 hub IA, ENT-10 mobile Continue, Focus-trap utility

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Bottom tabs + docked Continue

| | |
|---|---|
| Visual concept | Bottom bar with Idag · Laget · Tävling · Marknad (Rekrytering) · Mer; a full-width Continue bar docks directly above it showing label + what's next ('Fortsätt » · Träning, 2 dagar till match'). 'Mer' opens a sheet with Klubben, Karriär, Inkorg, Inställningar, Spara. |
| Layout | Top bar 48px (crest, date, search icon); content; Continue bar 52px; tab bar 56px + safe-area. |
| Information hierarchy | 1) Continue 2) current tab 3) Mer. |
| Interactions | Tap tabs; long-press a tab = jump to its last-visited sub-page; Mer sheet with focus trap and swipe-to-close. |
| Navigation | Hubs as tabs; sub-pages via in-hub segmented control at top of page. |
| Desktop | n/a (desktop uses rail). |
| Mobile | Primary navigation; Continue always thumb-reachable. |
| Advantages | Thumb ergonomics; Continue always visible; Fixes the 27-item scroll |
| Disadvantages | Five slots force Klubben into Mer (owner choice) |
| Complexity / perf | M / Low |
| Works with | ENT-07, ENT-10, ENT-08b |
| Fits identities | A, C |
| Patterns | Continue button as heartbeat; Design per form factor |

#### B — Central Continue FAB bar

| | |
|---|---|
| Visual concept | Bottom bar with four hubs split around a raised circular Continue button in club colour (Idag · Laget · [Continue] · Marknad · Mer); label of the Continue state appears above it as a chip. |
| Layout | Bottom bar 64px with central 64px FAB. |
| Information hierarchy | 1) FAB 2) tabs. |
| Interactions | Tap FAB = Continue; long-press FAB = preview queue (ENT-10 next-up). |
| Navigation | Same hubs. |
| Desktop | n/a. |
| Mobile | Game-like, iconic. |
| Advantages | Iconic heartbeat button; Club colour presence |
| Disadvantages | Small space for mutated labels (Presskonferens) |
| Complexity / perf | M / Low |
| Works with | ENT-10, ENT-07 |
| Fits identities | B |
| Patterns | Continue button as heartbeat |

#### C — Today feed + hub sheet

| | |
|---|---|
| Visual concept | Mobile opens on the Idag feed; navigation is a single 'Hubbar' button bottom-left opening a 2×3 grid sheet of hubs with status lines (Laget: 2 skadade), Continue bottom-right. |
| Layout | Feed; bottom bar with Hubbar + Continue. |
| Information hierarchy | 1) Feed 2) Continue 3) hubs. |
| Interactions | Sheet grid; swipe down to close. |
| Navigation | Hub grid → hub page. |
| Desktop | n/a. |
| Mobile | Morning-paper feel. |
| Advantages | Status-rich hub picker |
| Disadvantages | One extra tap to any hub |
| Complexity / perf | S / Low |
| Works with | DSH-01, ENT-10 |
| Fits identities | C |
| Patterns | Portal home |

### ENT-08 · Career top bar (header)

**Current:** Top bar: club name / season and a small subline 'date · Nästa: date' on the left; a search input in the middle (hidden ≤760px); four small save/export/import buttons and the large orange contextual Continue button on the right.

**Recommendation:** C — The top bar should hold exactly three things of weight: where you are in time, how to find anything, and the heartbeat. The 'Matchday clock' gives the game date real presence with a countdown to the next match and pairs with the Week Spine; file management moves to an overflow menu.

**Priority:** P0 · **Dependencies:** ENT-08a palette, ENT-08b overflow, ENT-10, ENT-13, G2 navigation model

**Arena Nights (owner identity, 2026-11-13):** token → *Masthead top bar in Arena Nights* — Continue rendered as the neon primary with glow and dark ink label; search on glass. _Conflict:_ No conflict; recommended top bar (masthead + search + labelled Continue) is kept rather than Arena's original hub bar.

#### A — Command bar

| | |
|---|---|
| Visual concept | Minimal 52px bar: breadcrumb-style location (Laget › Trupp) left, a wide '⌘K Sök spelare, klubbar, åtgärder' trigger centre, date chip and Continue right; save state as a small 'Sparat 12:04' indicator inside an overflow ⋯. |
| Layout | Location 3 · palette trigger 5 · date chip 2 · Continue 2. |
| Information hierarchy | 1) Continue 2) palette 3) date. |
| Interactions | ⌘K/Ctrl-K opens palette; date chip click → WLD-05; ⋯ holds Spara, Spara och avsluta, Exportera, Importera. |
| Navigation | Replaces ENT-09 breadcrumb row (merged in). |
| Desktop | Single row. |
| Mobile | Location + search icon + date; Continue moves to bottom bar (ENT-07a). |
| Advantages | Frees the most valuable real estate; Merges breadcrumb row |
| Disadvantages | Date still small |
| Complexity / perf | S / Low |
| Works with | ENT-08a, ENT-08b, ENT-09, ENT-10 |
| Fits identities | A |
| Patterns | Command palette / global search; Continue button as heartbeat |

#### B — Score-bug header

| | |
|---|---|
| Visual concept | Broadcast score-bug as header: crest in club colours, club + 'HBL · 3:a', big condensed date ('LÖR 12 OKT'), next-match bug ('vs IFK K · om 2 dagar'), Continue as a glowing club-colour tab. |
| Layout | Crest block 3 · date block 3 · next-match bug 3 · Continue 3; search as icon. |
| Information hierarchy | 1) Date + next match 2) Continue 3) club. |
| Interactions | Next-match bug → match preview; ticker slide-down on new events. |
| Navigation | Top hub bar sits beneath or merges (ENT-07 B). |
| Desktop | Bold dark band. |
| Mobile | Crest + date + next-match bug; Continue in bottom bar. |
| Advantages | Game clock and fixture become visible; Club colour presence |
| Disadvantages | Tall header; Less room for search |
| Complexity / perf | M / Low |
| Works with | ENT-07, ENT-10, ENT-13 |
| Fits identities | B |
| Patterns | Continue button as heartbeat |

#### C — Matchday clock

| | |
|---|---|
| Visual concept | The date becomes a calendar clock widget: day tile ('Tor 10 okt'), a ring or bar counting down to the next match ('2 dagar till IFK Kristianstad – borta'), with the Week Spine directly below. Continue sits right with its sublabel describing what will happen; search is a ⌘K field; files in ⋯. |
| Layout | Club mark 2 · clock widget 4 · palette field 3 · ⋯ 1 · Continue 2; Week Spine row below (ENT-07 C). |
| Information hierarchy | 1) Clock + countdown 2) Continue 3) search. |
| Interactions | Clock click → WLD-05; countdown turns to Floodlight styling on match day; ⋯ overflow for save/export/import; live state replaces countdown with ENT-13 pill. |
| Navigation | Owns the time display for the whole shell; ENT-09 folded into page headers. |
| Desktop | Paper top bar with one bold clock. |
| Mobile | Clock compact (day tile + countdown) with search icon; Continue in bottom dock. |
| Advantages | The clock — core of a manager game — gets weight; Countdown builds matchday anticipation; Clear separation: time / find / act |
| Disadvantages | Needs next-fixture data in shell (already used in subline) |
| Complexity / perf | M / Low |
| Works with | ENT-07, ENT-10, ENT-13, WLD-05, ENT-08a, ENT-08b |
| Fits identities | C, A |
| Patterns | Continue button as heartbeat; Command palette / global search |

### ENT-08a · Global search results dropdown

**Current:** Absolute dropdown under the header input, up to 12 text links (kind + name) after ≥2 characters; no crest/face, no arrow-key navigation, unavailable on mobile.

**Recommendation:** A — A command palette is a high-fit pattern, trivial in Next.js, and gives experts an escape hatch from any IA choice.

**Priority:** P1 · **Dependencies:** ENT-08, Search index over players/clubs/competitions/routes

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Command palette (⌘K)

| | |
|---|---|
| Visual concept | Centred palette: grouped results Spelare (avatar/monogram, position MV/VS/…, club), Klubbar (crest), Tävlingar, Sidor ('Gå till taktik') and Åtgärder ('Sätt upp 5-1 försvar', 'Förläng kontrakt…' → opens target). Recent items when empty. |
| Layout | Modal 640px; input; grouped list with icons; footer key hints. |
| Information hierarchy | 1) Top match 2) groups 3) hints. |
| Interactions | Arrows/Enter; Tab cycles groups; Shift+Enter opens in Peek drawer; prefixes (@ players, # clubs, > actions). |
| Navigation | Global; on mobile via search icon as full-screen sheet. |
| Desktop | Modal palette. |
| Mobile | Full-screen search sheet with recent + groups. |
| Advantages | Expert speed; Works on mobile (currently missing) |
| Disadvantages | Action catalogue must be curated |
| Complexity / perf | M / Low |
| Works with | ENT-08, CLB-04, ENT-07 |
| Fits identities | A, C |
| Patterns | Command palette / global search; Hover cards for every entity |

#### B — Rich result cards

| | |
|---|---|
| Visual concept | Dropdown stays inline but shows rich cards: player bust/monogram, position, age, CA band, club crest; hover a card shows the hover card. |
| Layout | Dropdown 480px with card rows. |
| Information hierarchy | 1) Faces/crests. |
| Interactions | Arrow keys; hover card. |
| Navigation | Inline from header. |
| Desktop | Dropdown. |
| Mobile | Full-screen sheet. |
| Advantages | Visual recognition |
| Disadvantages | No actions/routes |
| Complexity / perf | S / Low |
| Works with | ENT-08 |
| Fits identities | B |
| Patterns | Hover cards for every entity |

### ENT-08b · Save controls

**Current:** Row of four small buttons in the header (Spara, Spara och avsluta, Exportera sparafil, Importera sparafil) with inline status text; import into a running career has no confirm; moved into the drawer footer on phones.

**Recommendation:** A — Autosave status belongs in the shell; file management belongs in a menu with a confirm for destructive import.

**Priority:** P1 · **Dependencies:** ENT-08, ENT-05/SYS-01 Data section

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Autosave indicator + overflow

| | |
|---|---|
| Visual concept | A quiet 'Sparat · 12:04' indicator (spinner while saving) beside a ⋯ menu: Spara nu, Spara och avsluta, Exportera säkerhetskopia, Importera… (confirm dialog explaining that the current career is replaced). |
| Layout | Indicator + menu in top bar right, left of Continue. |
| Information hierarchy | Tertiary. |
| Interactions | Ctrl+S saves; import shows a consequence dialog with Exportera först. |
| Navigation | Menu also lists Inställningar, Feedback, Tillbaka till Apps. |
| Desktop | Indicator + ⋯. |
| Mobile | Inside 'Mer' sheet. |
| Advantages | Header freed for Continue; Destructive import guarded |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | ENT-08, ENT-11, ENT-06, ENT-04a |
| Fits identities | A, B, C |
| Patterns | Predictive consequence preview |

#### B — Save as a diegetic "kansliet" drawer

| | |
|---|---|
| Visual concept | Saves live in a 'Kansliet' drawer from the user menu showing save slots, last save time, export/import with explanations in game language ('Ta med karriären till en annan dator'). |
| Layout | Right drawer. |
| Information hierarchy | 1) Current save state 2) actions. |
| Interactions | Drawer actions with confirms. |
| Navigation | From user menu. |
| Desktop | Drawer. |
| Mobile | Sheet. |
| Advantages | Plain-language, less dev jargon |
| Disadvantages | More UI than needed |
| Complexity / perf | S / Low |
| Works with | ENT-08 |
| Fits identities | C |

### ENT-09 · Context bar (breadcrumb row)

**Current:** Thin 11px muted row above every page: two ghost back/forward arrows, a two-level breadcrumb 'Kontoret / <section>' (fallback 'Detalj') and an unread-messages link duplicating the sidebar badge.

**Recommendation:** A — With hubs and tabs the breadcrumb only has value when it reflects real depth (hub › tab › entity). Folding it into the page header removes a row and the naming drift (Hem/Kontoret/MANAGERNS KONTOR).

**Priority:** P1 · **Dependencies:** ENT-07 hub IA, Route → hub/tab map

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Real breadcrumb in page header

| | |
|---|---|
| Visual concept | Remove the row; each page header shows a true path 'Laget › Trupp › Lindqvist' with the hub name matching the rail; back/forward arrows dropped (browser does it); unread count only on Inkorg. |
| Layout | Breadcrumb as kicker above page H1. |
| Information hierarchy | Kicker. |
| Interactions | Click any crumb. |
| Navigation | Uses hub map. |
| Desktop | Kicker line. |
| Mobile | Only parent crumb as '‹ Trupp' back link. |
| Advantages | Saves a row; Fixes naming drift |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | ENT-07, ENT-08 |
| Fits identities | A, C |
| Patterns | Inform vs navigate separation |

#### B — Recent trail

| | |
|---|---|
| Visual concept | Replace back/forward with a 'senast besökt' trail of the last 5 entities as chips (player faces, crests) for quick return. |
| Layout | Chip row under top bar. |
| Information hierarchy | Tertiary. |
| Interactions | Click chip; Shift-click opens Peek. |
| Navigation | Session history. |
| Desktop | Chip row. |
| Mobile | Hidden; available in palette as recent. |
| Advantages | Useful for comparison hopping (scouting/transfers) |
| Disadvantages | Another row of chrome |
| Complexity / perf | S / Low |
| Works with | ENT-08a |
| Fits identities | A |
| Patterns | Bookmarks + configurable landing |

### ENT-09a · Progression notice (after Continue)

**Current:** After Continue stops, an aside banner at the top of main shows a bold title, detail paragraph, one action link (e.g. 'Till matchen') and ×; it looks like a generic alert and competes with page heroes.

**Recommendation:** C — The notice answers 'why did time stop and what do I do now?' — the heartbeat's second half. Anchoring it to the Week Spine/clock as a typed event card keeps it in the same place every time, gives each stop reason its own visual identity, and lets it be resolved inline when possible.

**Priority:** P0 · **Dependencies:** ENT-10, ENT-10a, Stop-reason type taxonomy (match, board, press, transfer, injury, deadline), WLD-01 inline actions

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Next-action card

| | |
|---|---|
| Visual concept | A compact card docked under the top bar right, aligned with Continue: event type icon, one-line title, one-line consequence, primary action ('Sätt laguppställning') and Senare. It stays until resolved or dismissed and its count appears on Continue. |
| Layout | Popover-like card 360px anchored to Continue. |
| Information hierarchy | 1) Title 2) action 3) dismiss. |
| Interactions | Primary action navigates or resolves inline; Senare collapses to a dot on Continue; Esc dismisses. |
| Navigation | Always anchored to Continue; links to WLD-01 for history. |
| Desktop | Anchored card. |
| Mobile | Card slides up above the Continue dock. |
| Advantages | Spatially tied to cause (Continue); Never competes with page hero |
| Disadvantages | Small; little room for imagery |
| Complexity / perf | S / Low |
| Works with | ENT-10, WLD-01 |
| Fits identities | A |
| Patterns | Inbox as task queue; Continue button as heartbeat |

#### B — Breaking-news lower third

| | |
|---|---|
| Visual concept | A broadcast lower-third slides in at the bottom of the viewport: type-coloured tag ('MATCHDAG', 'STYRELSEN', 'TRANSFER'), headline, event image thumbnail from the environment set, action button. |
| Layout | Bottom band 96px across content area. |
| Information hierarchy | 1) Tag + headline 2) image 3) action. |
| Interactions | Auto-collapse to a tag chip after 8 s; click expands; multiple stops queue as a ticker. |
| Navigation | Action routes to target; ticker links to WLD-01. |
| Desktop | Lower-third band. |
| Mobile | Full-width card above the bottom bar, swipe to dismiss. |
| Advantages | Event types instantly recognisable; Very game-like |
| Disadvantages | Can overlap tables at the bottom; Auto-collapse may hide important stops |
| Complexity / perf | M / Medium |
| Works with | ENT-10a, WLD-01 |
| Fits identities | B |
| Patterns | Diegetic narrator |

#### C — Spine pin + event card

| | |
|---|---|
| Visual concept | The stop is a pin on today's slot in the Week Spine that expands into an event card directly beneath it: kicker by type ('Matchdag · HBL omg 12'), headline, the blocking reason in plain words ('Laguppställningen saknar mittnia'), and up to two actions — one resolves inline where possible. Dismissed cards stay as pins on the Spine. |
| Layout | Event card 480px dropping from the Spine at today's position; page content shifts down, not overlapped. |
| Information hierarchy | 1) Why time stopped 2) what to do 3) where it lives on the timeline. |
| Interactions | Primary action (inline or navigate); 'Visa i inkorg'; collapse to pin; multiple stops stack as numbered pins; keyboard: N cycles stops. |
| Navigation | Bridges ENT-10a (replay ends by "landing" the card on the Spine) and WLD-01. |
| Desktop | Card below Spine. |
| Mobile | Card expands from the day strip as a sheet; pin stays on strip. |
| Advantages | Consistent location every time; Ties events to time — the core mental model; Inline resolution cuts round trips |
| Disadvantages | Depends on the Week Spine shell (ENT-07 C); Inline resolution needs per-type handlers |
| Complexity / perf | M / Low |
| Works with | ENT-07, ENT-08, ENT-10, ENT-10a, WLD-01, WLD-05 |
| Fits identities | C, A |
| Patterns | Inbox as task queue; Continue button as heartbeat; Vague notifications |

### ENT-10 · Continue / advance-day flow

**Current:** One primary orange button in the header whose label mutates (Fortsätt » / Förbered match / Starta match / Återgå till match / Presskonferens / Styrelsemöte · SVAR KRÄVS / Säsong klar); with a targetHref it silently navigates, otherwise it advances days, shows ENT-10a, then lands on the stop target with ENT-09a.

**Recommendation:** C — The heartbeat must make its own behaviour predictable: the player should know before pressing whether it will advance time or take them somewhere. 'Up-next queue' shows the queue and distinguishes 'go to' from 'advance' visually, using only existing ContinueActionKind states and calendar data.

**Priority:** P0 · **Dependencies:** ContinueActionKind (ADVANCE_DAY, PREPARE_MATCH, START_MATCH, RESUME_MATCH, PRESS_CONFERENCE, DECISION_BLOCKED, SEASON_COMPLETE), ENT-10a, ENT-09a, WLD-05 calendar data, ENT-07a mobile dock

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Stateful heartbeat button

| | |
|---|---|
| Visual concept | Keep one button but give each ContinueActionKind a distinct visual state: ADVANCE_DAY = solid accent with » and 'till tor 10 okt'; navigate kinds = outlined with → and destination name; DECISION_BLOCKED = warning colour with count; SEASON_COMPLETE = gold, disabled with reason. |
| Layout | Button 200px with two lines (label + sublabel), state icon left. |
| Information hierarchy | 1) Label 2) sublabel = consequence. |
| Interactions | Space/Enter global shortcut (when no input focused); tooltip always explains blockReason. |
| Navigation | Same behaviour as today, but legible. |
| Desktop | Top-right. |
| Mobile | Docked bar (ENT-07a). |
| Advantages | Small change, big clarity; No new data |
| Disadvantages | Still no queue preview |
| Complexity / perf | S / Low |
| Works with | ENT-08, ENT-07a |
| Fits identities | A |
| Patterns | Continue button as heartbeat; Play menu as season state machine |

#### B — Matchweek countdown

| | |
|---|---|
| Visual concept | Continue is a large club-coloured tab with a segmented progress ring of days to the next match; each press fills a segment; on match day it transforms into 'MATCHDAG' with crests. |
| Layout | Button 240px with ring and crest pair on match days. |
| Information hierarchy | 1) Ring/progress 2) label. |
| Interactions | Press = advance; ring animates; hold = advance to next stop (same engine call, just default). |
| Navigation | Same targets. |
| Desktop | Top hub bar right. |
| Mobile | Central FAB with ring (ENT-07a B). |
| Advantages | Anticipation built into the control; Club colours |
| Disadvantages | Ring meaningless in long off-weeks/offseason |
| Complexity / perf | M / Low |
| Works with | ENT-07a, ENT-13 |
| Fits identities | B |
| Patterns | Continue button as heartbeat |

#### C — Up-next queue

| | |
|---|---|
| Visual concept | Continue plus a 'Nästa' strip directly beneath it (or the Week Spine's right end): the next 3 things in order — 'Tor · Träning (taktik)', 'Fre · Transferfönster stänger', 'Lör · IFK Kristianstad (B)' — with a marker showing where Continue will stop. Navigate-type states show '→ Taktik' instead of '»' so it never surprises. |
| Layout | Button 200px + strip 3 items (desktop under top bar right / on Spine); expandable to full next-7-days list. |
| Information hierarchy | 1) Continue label + stop marker 2) next items 3) expand. |
| Interactions | Hover strip item = Peek of fixture/event; click opens WLD-05 at that day; blocked state lists the blocking tasks with inline 'Lös' links. |
| Navigation | Ties ENT-10 to ENT-09a (stop) and WLD-05 (calendar). |
| Desktop | Button + strip. |
| Mobile | Continue dock shows label + 'stannar: lör · match'; tap the dock's chevron for the queue sheet. |
| Advantages | Predictable heartbeat (fixes the silent-navigation surprise); Uses existing calendar data; Supports one-more-day loop |
| Disadvantages | Predicting exact stop requires a dry-run of stop rules (needs new data: projected stop reason without committing) |
| Complexity / perf | M / Low |
| Works with | ENT-08, ENT-09a, ENT-10a, WLD-05, ENT-07 |
| Fits identities | C, A |
| Patterns | Continue button as heartbeat; Play menu as season state machine; Predictive consequence preview |

### ENT-10a · Continue processing overlay ('Världen går vidare.')

**Current:** A modal <dialog> 'Världen går vidare.' replays an already committed advance: navy header with a crest that ignores the club colour, a date ticker, the last 12 day numbers revealing, training-day count, up to 5 highlight events, and a stop-reason card; skippable with 'Visa händelsen →' / Esc.

**Recommendation:** C — Time passing is the game's signature rhythm. Calendar-flip in paper mode for ordinary days, escalating to a Floodlight build-up only when the stop is a match, keeps the moment short for routine presses and big when it matters; it lands on the Spine so ENT-09a is the natural continuation.

**Priority:** P0 · **Dependencies:** ENT-10, ENT-09a, Club colour tokens, Event-type imagery set, Reduced-motion policy (G5)

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Day ticker strip

| | |
|---|---|
| Visual concept | No modal: the Week Spine/clock itself ticks forward day by day (≈120 ms per day) while a compact toast lists highlights; the page stays usable and the stop card appears at the end. |
| Layout | Inline ticker in the top bar clock + toast 320px. |
| Information hierarchy | 1) Date moving 2) highlights 3) stop. |
| Interactions | Click toast to skip; reduced motion = jump. |
| Navigation | Ends with ENT-09a. |
| Desktop | Inline. |
| Mobile | Clock in top bar ticks; toast above dock. |
| Advantages | Fastest, non-blocking; Cheap |
| Disadvantages | Little drama for big events |
| Complexity / perf | S / Low |
| Works with | ENT-08, ENT-09a |
| Fits identities | A |
| Patterns | Continue button as heartbeat |

#### B — Matchweek montage

| | |
|---|---|
| Visual concept | Full-screen floodlight overlay: days as broadcast cards sweeping past with event photos (training ground, office, press room), club-coloured crest, and a build-up to the stop card (e.g. next opponent crest vs yours). |
| Layout | Full-screen; card track centre; stop card hero at end. |
| Information hierarchy | 1) Motion of time 2) event cards 3) stop hero. |
| Interactions | Skip (Esc/tap); auto-skip if only 1 day processed. |
| Navigation | Ends on target page. |
| Desktop | Full-screen. |
| Mobile | Portrait card stack. |
| Advantages | Most cinematic; Club colours fixed |
| Disadvantages | Gets tiresome on frequent presses; Asset set per event type |
| Complexity / perf | L / High |
| Works with | ENT-09a, ENT-10 |
| Fits identities | B |
| Patterns | Broadcast camera / view switcher |

#### C — Calendar flip → floodlight build-up

| | |
|---|---|
| Visual concept | Paper-mode calendar page flips once per processed day with that day's one-line highlight ('Ons · Lindqvist tillbaka i träning'); the dialog header uses the club crest in true colours. If the stop is a match, the last flip dims the lights into a Floodlight 'Matchdag' card with both crests; other stops land as an event card that docks onto the Spine (ENT-09a). |
| Layout | Centred 560px dialog (not full-screen): calendar page left, highlights list right (≤5), stop card replaces the calendar at the end. |
| Information hierarchy | 1) Date flipping 2) highlights 3) stop. |
| Interactions | Esc/click skips to stop; duration scales with days (cap 1.5 s); reduced motion = crossfade list; single-day advance shows no dialog, only the Spine tick. |
| Navigation | Hands off to ENT-09a/Spine; match stop offers Förbered match directly. |
| Desktop | Centred dialog with page curl. |
| Mobile | Full-width sheet with vertical flip; highlights below. |
| Advantages | Proportional drama (big only when match); Fixes club colour; Clear handoff to the notice |
| Disadvantages | Two visual modes to maintain; Highlight copy quality matters |
| Complexity / perf | M / Medium |
| Works with | ENT-09a, ENT-10, ENT-07, ENT-08 |
| Fits identities | C, B |
| Patterns | Continue button as heartbeat; Pre-match ritual sequence |

### ENT-11 · Feedback / bug report modal

**Current:** A fixed bottom-left floating 'Rapportera bugg / Feedback' button on every screen (incl. title and match) opens a native dialog with a description, 'Ladda ner sparafil (.json)', status message and an external feedback link.

**Recommendation:** A — Feedback is essential in alpha but should not float over the sidebar and the match; a help-menu entry with context capture serves testers better.

**Priority:** P2 · **Dependencies:** ENT-08b overflow menu, ENT-06

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Help menu + context capture

| | |
|---|---|
| Visual concept | Move to the ⋯/help menu ('Rapportera problem'); the dialog pre-fills route, game date, club and build, offers 'Bifoga sparfil' checkbox and keeps the external link. |
| Layout | Dialog: context summary chips, attach checkbox, open-form button. |
| Information hierarchy | 1) What gets sent 2) action. |
| Interactions | Shortcut F8 opens; copy context to clipboard. |
| Navigation | From overflow menu; on title screen from the menu line. |
| Desktop | Dialog. |
| Mobile | Sheet from Mer. |
| Advantages | No overlay on game UI; Better reports |
| Disadvantages | Less visible to testers |
| Complexity / perf | S / Low |
| Works with | ENT-08b, ENT-06 |
| Fits identities | A, B, C |

#### B — Edge tab (alpha only)

| | |
|---|---|
| Visual concept | Keep visibility for alpha but as a slim vertical 'Feedback' tab on the right edge, hidden in match and title; removed in public builds. |
| Layout | Right-edge tab 28px. |
| Information hierarchy | Tertiary. |
| Interactions | Click opens the same dialog. |
| Navigation | Global except match/title. |
| Desktop | Edge tab. |
| Mobile | In Mer sheet. |
| Advantages | Stays discoverable |
| Disadvantages | Still chrome on screen |
| Complexity / perf | S / Low |
| Works with | ENT-07 |
| Fits identities | A |

### ENT-12 · Career initialization / loading / error screen

**Current:** Full-screen state while a career is created or opened: brand mark, big uppercase H1 ('BYGGER DIN HANDBOLLSVÄRLD…' / 'ÖPPNAR DIN KARRIÄR…' / 'KUNDE INTE ÖPPNA KARRIÄREN'), 112px crest aside, elapsed seconds after 6 s, footer tagline.

**Recommendation:** C — Loading is the bridge between choosing a club and arriving at it. A club-themed handover that shows real club facts and rotating handball tips uses the wait productively; it must stay honest about progress and keep a clear failure path.

**Priority:** P1 · **Dependencies:** ENT-03f, ENT-02, Club colour tokens, Glossary tips (In-game glossary)

**Arena Nights (owner identity, 2026-11-13):** adapt → *First-day handover (Arena)* — Keep the two-column handover (crest + headline + facts appearing one by one | rotating handball tip card) and the explicit 'Gå in på kontoret' button (no auto-jump after 3 s). Rendered on the arena-night background with the new club's neon, facts ticking in with a neon check. Differs from Alternative B 'Arena arrival' by keeping C's calm handover and tips. _Conflict:_ Recommended 'First-day handover' is a paper page ('Första dagen på jobbet').

#### A — Progress checklist

| | |
|---|---|
| Visual concept | Honest step list: 'Läser ligor ✓', 'Skapar 84 klubbar ✓', 'Genererar spelare…', 'Lägger upp schemat' with elapsed time; failure highlights the failed step with retry. |
| Layout | Centre column: crest, step list, timer. |
| Information hierarchy | 1) Current step 2) crest. |
| Interactions | Retry / Till huvudmenyn on failure. |
| Navigation | → DSH-01. |
| Desktop | Centred. |
| Mobile | Same, full width. |
| Advantages | Transparent; Debuggable failures |
| Disadvantages | needs new data: progress events from world builder |
| Complexity / perf | S / Low |
| Works with | DSH-01 |
| Fits identities | A |

#### B — Arena arrival

| | |
|---|---|
| Visual concept | The club's arena photo fades up in floodlight with crest and 'Välkommen till [arena]'; capacity and founded year as broadcast stats; a light bar shows progress. |
| Layout | Full-bleed media + lower-third. |
| Information hierarchy | 1) Arena 2) welcome 3) progress. |
| Interactions | Passive; failure overlays a card. |
| Navigation | → DSH-01 with shared crest. |
| Desktop | Full-bleed. |
| Mobile | Portrait crop. |
| Advantages | Strong arrival emotion |
| Disadvantages | Per-club arena imagery (needs new data or fallback set) |
| Complexity / perf | M / Medium |
| Works with | ENT-03f, DSH-01 |
| Fits identities | B |

#### C — First-day handover

| | |
|---|---|
| Visual concept | Paper page 'Första dagen på jobbet': club crest in true colours, three facts (Arena · platser, Förhandstips, Styrelsens förväntan) appearing one by one, and rotating handball tips ('7-mot-6: …') while loading; finishes with 'Gå in på kontoret' button rather than an auto-jump when loading took >3 s. |
| Layout | Two columns: left crest + headline + facts; right tip card; bottom progress line + CTA. |
| Information hierarchy | 1) Your club 2) facts 3) tip. |
| Interactions | Tip next/prev; CTA when ready; failure state keeps facts, shows reason + retry. |
| Navigation | → DSH-01; for load-game uses save summary instead of preseason facts. |
| Desktop | Two columns. |
| Mobile | Single column; tip as swipe card. |
| Advantages | Teaches handball while waiting; Reuses preseason context data |
| Disadvantages | Tip copy needed |
| Complexity / perf | S / Low |
| Works with | ENT-03f, ENT-04, DSH-01 |
| Fits identities | C |
| Patterns | In-game glossary |

### ENT-13 · Live-match banner (header subline)

**Current:** When away from a live match the header date subline becomes a 12px text line 'MATCH PÅGÅR · HAM 7–5 SKA · 13:00' and Continue becomes 'Återgå till match'.

**Recommendation:** A — A paused live match is the most important state in the shell; a persistent score pill makes it impossible to miss at minimal cost.

**Priority:** P1 · **Dependencies:** ENT-08, ENT-10 RESUME_MATCH

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Live score pill

| | |
|---|---|
| Visual concept | Persistent pill replacing the clock: pulsing live dot, two crests, score '7–5', clock '13:00', state (Paus / Timeout / Halvtid); click returns to match. |
| Layout | Pill 260px in top bar. |
| Information hierarchy | 1) Score 2) clock 3) live dot. |
| Interactions | Click returns; hover shows last 3 events. |
| Navigation | → match-day route. |
| Desktop | Top bar centre-left. |
| Mobile | Pill above content; Continue dock says Återgå. |
| Advantages | Impossible to miss; Tiny build |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | ENT-08, ENT-10 |
| Fits identities | A, C |

#### B — Score bug overlay

| | |
|---|---|
| Visual concept | Broadcast score bug pinned to the top-left of the content area in club colours, mirroring the match screen score bug. |
| Layout | Bug 200×48 floating. |
| Information hierarchy | 1) Score. |
| Interactions | Click returns. |
| Navigation | → match-day. |
| Desktop | Floating bug. |
| Mobile | Under top bar. |
| Advantages | Visual continuity with match screen |
| Disadvantages | Overlaps content |
| Complexity / perf | S / Low |
| Works with | ENT-08 |
| Fits identities | B |
| Patterns | Broadcast camera / view switcher |

## DSH — Dashboard

### DSH-01 · Dashboard · Managerns kontor (Hem) — HI-FI prototype `dashboard`

**Current:** Photo hero with crest and club name, a next-match hero plus league card, then a three-column body of ~11 text-heavy sections (availability, contracts/radar, results, news, weekly plan, board, rivals, other results, training note). Weekly plan duplicates the board card and news; nothing below the hero is ranked.

**Recommendation:** C — Today's Paper is the only concept that both ranks (lead story + numbered decisions) and de-duplicates (weekly plan becomes the Week Spine, news becomes briefs, board appears once). Its lead story switches with the Continue state, so matchday, board review, transfer deadline and season end each get their own front page without new data. A's queue is embedded as the decision column, so power users lose nothing.

**Priority:** P0 · **Dependencies:** G1 base identity, G2 navigation model (hub rail + Week Spine + Peek), Continue state machine (label mutates: Fortsätt → Förbered match → Till matchen), Week Spine component (DSH-01i / WLD-05), WLD-01 inline resolution (decision column reuses inbox actions), Dual meter component (Förtroende + Rykte), Event chain presentation (careerEventId → message → decision → consequence)

**Arena Nights (owner identity, 2026-11-13):** adapt → *Matchweek Front Page* — Same front-page structure: masthead with the two ears (Förtroende · styrelsen | Rykte · manager, each with delta and reason) → lead story chosen from game state (8/12) + numbered 'Att avgöra' column (4/12) → match box, ladder ±2, around-the-league briefs. Arena treatment: broadcast strap masthead with neon ring meters, lead story as full-bleed hero with headline on the image, decisions with neon numerals, match box styled as a score bug. _Conflict:_ Today's Paper is a newspaper front page: nameplate with ears, serif lead headline, rules and columns on paper.

#### A — Decision Briefing

| | |
|---|---|
| Visual concept | The manager's morning briefing: a ranked queue of what needs you ('3 saker kräver dig i dag'), each item resolvable in place, above a four-tile KPI strip. Everything informational is one click away, nothing is navigation-by-tile. |
| Layout | KPI strip (Tabellplats, Spelbara x/16, Förtroende, Budgetutrymme) → two columns: ranked decision queue (7/12) and next-match card with countdown (5/12) → a thin 7-day strip → three compact cards (mini table ±2 rows, last results, board objectives). |
| Information hierarchy | 1) Number of open decisions and the top one; 2) next match and days left; 3) KPI deltas since last visit; 4) week strip. |
| Interactions | Each queue row has its primary verb inline (Förläng, Välj startsju, Svara styrelsen) with a consequence line; j/k + Enter keyboard flow; resolved rows collapse with a FLIP animation; KPI tiles open a hover card explaining the delta. |
| Navigation | Lives at Idag hub root. KPI tiles do not navigate (inform vs navigate); each has an explicit 'Öppna' link. Continue in the top bar shows the blocked count from the same queue. |
| Desktop | Dense 12-col grid, sticky KPI strip, tabular numerals, hover cards on every player/club name. |
| Mobile | Sticky Continue bar at bottom; queue first as swipe-to-resolve cards; KPI strip becomes a 2×2 grid; mini table and results move behind 'Mer i dag'. |
| Advantages | Fastest route from login to action; Directly answers the 'no primary focus' weakness; Easy on current stack (lists + tiles) |
| Disadvantages | Least emotional — matchday feels like any other day; Season-end and dismissal moments need a separate takeover; Risk of feeling like a SaaS to-do app |
| Complexity / perf | M / Low |
| Works with | WLD-01, WLD-05, CLB-05, CLB-06, MGR-03 |
| Fits identities | A |
| Patterns | Portal home; Inbox as task queue; Continue button as heartbeat; Inform vs navigate separation |

#### B — Matchweek Show

| | |
|---|---|
| Visual concept | The dashboard is the opening of a TV broadcast for this round: a full-bleed next-match hero with both crests in club colours and a live countdown, a news ticker, and four 'storyline' cards that frame the week (player in form, injury worry, board mood, rival watch). |
| Layout | Full-bleed hero (crests face-off, competition mark Handbollsligan/Svenska Cupen/SM-slutspel, countdown, form strips) → ticker band (other results, transfers) → storyline card row (4) → decision tray as a lower-third → league table panel. |
| Information hierarchy | 1) The match and the countdown; 2) storylines; 3) decisions in the lower-third tray. |
| Interactions | Storyline cards flip to show the underlying data (e.g. 'Lindqvist 31 mål på 5 matcher' → stats); ticker items open Peek; decision tray expands upward like a broadcast lower-third. |
| Navigation | Top hub bar; hero CTA becomes 'Förbered match' and leads into the matchday sequence. Storylines deep-link to SQD/MED/CLB-05. |
| Desktop | Cinematic 16:9 hero, glass panels, club-colour re-tint. |
| Mobile | Vertical card stack: hero card, then one storyline per swipe; decisions as a badge on the central Continue button. |
| Advantages | Strongest emotional pull and screenshot value; Matchday anticipation every week; Uses existing arena/manager-office photography |
| Disadvantages | Decisions are secondary — easy to miss deadlines; Weeks without matches (international break, off-season) feel empty; Asset-hungry; storylines need good copy generation; needs new data: storyline selection heuristic (presentation layer only) |
| Complexity / perf | L / High |
| Works with | WLD-02, WLD-01, CLB-05, MGR-03 |
| Fits identities | B |
| Patterns | Pre-match ritual sequence; Staff as faces of systems; Era- or tier-skinned news |

#### C — Today's Paper

| | |
|---|---|
| Visual concept | The front page of the club journal for today's in-game date. A lead story is chosen from game state (matchday preview, yesterday's result, board verdict, deadline day, injury crisis), a numbered decision column sits beside it, and the week runs across the top as the Week Spine. Board confidence and manager reputation sit in the masthead 'ears' as a dual meter. |
| Layout | Masthead (Klubbjournalen · <Klubb> · Vecka 12, tisdag 14 jan) with ears: left Förtroende, right Rykte → Week Spine → lead story (8/12) + numbered decisions 'Att avgöra' (4/12) → match box + mini ladder ±2 + availability court → 'Runt ligan' briefs + 'Från klubben' briefs. |
| Information hierarchy | 1) Lead headline (the one thing that matters today); 2) numbered decisions with deadlines; 3) next match box; 4) briefs. |
| Interactions | Decisions resolve inline (same components as the inbox reader); briefs open Peek; lead story's 'Läs mer' opens the article or match report; the masthead ears hover-explain the last change ('−4 efter 24–29 mot Kristianstad'). |
| Navigation | Idag hub root. Continue advances the Week Spine; the next day's paper replaces this one (yesterday's papers live in Karriär → Säsongsbok). Lead stories link to their source surface (match report, CLB-05, transfers). |
| Desktop | Newspaper grid with rules instead of boxes, serif headlines, Peek drawer on the right preserves the page. |
| Mobile | 'Morning paper' feed: lead story card, then decisions as numbered cards with sticky action, Week Spine as swipeable strip at top, briefs last. |
| Advantages | Ranks and de-duplicates the 11 sections; Lead switches with moment (matchday, board review, window) — personalisation without new systems; Gives every day a memory: past papers feed career history; Continuity with today's paper/navy/signal identity |
| Disadvantages | Editorial quality depends on headline templates from game events; Two layers (lead + decisions) must never disagree about priority; Needs the Week Spine component first |
| Complexity / perf | L / Medium |
| Works with | WLD-01, WLD-05, WLD-02, CLB-05, MGR-01, MGR-03 |
| Fits identities | C, A |
| Patterns | Portal home; Continue button as heartbeat; Inbox as task queue; Dual meters; Dated, categorised news |

### DSH-01a · Office hero header

**Current:** Photo hero with manager-office image, 64px crest, overline 'MANAGERNS KONTOR · season', club name H1, league/venue/capacity and two link chips (Klubbhuset, Taktikrummet). Purely decorative — carries no live state.

**Recommendation:** C — The masthead turns a decorative banner into the place where long-term state lives (date, phase, board confidence, reputation) at almost no height cost, and it is the natural anchor for the Today's Paper concept.

**Priority:** P0 · **Dependencies:** DSH-01 recommendation, Dual meter component, Season phase label from the season state machine

**Arena Nights (owner identity, 2026-11-13):** adapt → *Broadcast Masthead* — Title strap with the issue line; ears become neon ring meters (board confidence left, manager reputation right) with last delta and reason. Club-colour rule becomes a club-neon underline. _Conflict:_ Newspaper nameplate ('KLUBBJOURNALEN') with paper ears and club-colour rule.

#### A — Status Bar

| | |
|---|---|
| Visual concept | Replace the hero with a 56px status bar: club stripe + crest, in-game date, season phase ('Grundserie · omgång 14 av 22'), and the Continue label. |
| Layout | Single row: crest · club · phase · date \| spacer \| Continue button with blocked-count badge. |
| Information hierarchy | Date/phase first, Continue second, club identity third. |
| Interactions | Phase label opens the season hub (MGR-03); date opens the calendar; Continue explains blockers on hover. |
| Navigation | Becomes part of the global shell rather than the page. |
| Desktop | Fixed under top bar; never scrolls away. |
| Mobile | Collapses to crest + date; Continue moves to bottom bar. |
| Advantages | Saves ~280px of scroll; Always-visible phase answers 'where am I in the season?' |
| Disadvantages | Loses identity/atmosphere entirely; Office photography unused |
| Complexity / perf | S / Low |
| Works with | MGR-03, WLD-05, ENT-07 |
| Fits identities | A |
| Patterns | Continue button as heartbeat; Play menu as season state machine |

#### B — Live Arena Masthead

| | |
|---|---|
| Visual concept | Keep a photographic hero but make it alive: countdown to next match, opponent crest, board mood glow colour, and the arena image switching by phase (training hall in the week, arena on matchday, trophy room at season end). |
| Layout | Full-width photo band; left: crest + club + heritage; right: countdown block 'Om 2 dagar · Kristianstad (B)'. |
| Information hierarchy | Countdown > club name > mood tint. |
| Interactions | Countdown click → match preview; mood tint hover → board summary. |
| Navigation | Page-level; dissolves into the hub bar on scroll. |
| Desktop | 320px band with parallax disabled under reduced motion. |
| Mobile | 160px band, countdown only. |
| Advantages | Atmospheric; uses existing env images; Carries real state |
| Disadvantages | Still costs vertical space every visit; Image switching needs image set per phase (exists partly) |
| Complexity / perf | M / Medium |
| Works with | DSH-01b, CLB-05 |
| Fits identities | B |
| Patterns | Pre-match ritual sequence |

#### C — Journal Masthead

| | |
|---|---|
| Visual concept | A newspaper nameplate: 'KLUBBJOURNALEN · <Klubb>' with issue line ('Vecka 12 · tisdag 14 januari · Grundserie omg 14'), and two ears — left ear Förtroende (board, this club, short-term), right ear Rykte (manager, career, long-term) — each with the last delta and its reason. |
| Layout | Three-part row: left ear \| nameplate + issue line \| right ear; thin club-colour rule beneath. |
| Information hierarchy | Nameplate/date, then the two ears' deltas. |
| Interactions | Ears hover/long-press explain 'why it moved' from board factors and reputationLog; nameplate opens the club journal (CLB-02). |
| Navigation | Top of Idag only; other hubs use a smaller running head with the same date. |
| Desktop | ~120px; serif nameplate; ears as mini gauges. |
| Mobile | Nameplate shrinks to one line; ears become two chips under it. |
| Advantages | Introduces the long-term/short-term dual meter everywhere it matters; Cheap; reuses data already computed; Strong identity hook |
| Disadvantages | Editorial tone must be maintained in other hubs; Two meters can be confused without labels |
| Complexity / perf | S / Low |
| Works with | CLB-05, MGR-01, CLB-02 |
| Fits identities | C |
| Patterns | Dual meters; Hover cards for every entity |

### DSH-01b · Next match hero + league card

**Current:** MatchHero (two crests, date, competition) beside an aside with rank '#/N', points/matches/goal difference and last-5 form dots. No table context, no countdown, no injury impact.

**Recommendation:** C — The match box answers 'how ready are we and what is at stake' in one block: opponent form, our absentees and the ladder slice. It stays compact enough to sit beside the lead story.

**Priority:** P0 · **Dependencies:** DSH-01e availability data, Peek drawer (opponent), Competition marks

**Arena Nights (owner identity, 2026-11-13):** adapt → *Match Box (score-bug styling)* — Same content order (headline + countdown, readiness line, opponent form, ladder ±2, opponent in Peek) in a glass card with a score-bug crest row. _Conflict:_ An editorial boxed 'Matchrutan' with serif headline.

#### A — Fixture Card + Ladder Slice

| | |
|---|---|
| Visual concept | A compact fixture card and, beside it, the league table sliced to ±2 rows around your club with zone colours (SM-slutspel, kval, nedflyttning). |
| Layout | Card: crests, H/B, date, countdown, competition; table: 5 rows + header. |
| Information hierarchy | Opponent and days left; then your row highlighted in the slice. |
| Interactions | Row hover → club hover card; 'Hela tabellen' link. |
| Navigation | Links to match preview and competition. |
| Desktop | Two equal halves. |
| Mobile | Card first; ladder slice below as 5 compact rows. |
| Advantages | Gives table context the current card lacks; Small, data-forward |
| Disadvantages | No readiness signal; Duplicates the competition page slice |
| Complexity / perf | S / Low |
| Works with | MGR-03, CLB-04 |
| Fits identities | A |
| Patterns | Hover cards for every entity |

#### B — Pre-match Bug

| | |
|---|---|
| Visual concept | A broadcast pre-match graphic: crests face-off in club colours, both teams' last-5 form strips, head-to-head line and a 'Saknas' row with faces of injured/suspended players. |
| Layout | Wide band: home crest \| VS + countdown \| away crest; second row: form strips; third: Saknas chips. |
| Information hierarchy | Face-off → countdown → absentees. |
| Interactions | Absentee chip → player Peek; 'Förbered match' primary. |
| Navigation | Primary entry to the pre-match ritual. |
| Desktop | Full width, 200px. |
| Mobile | Stacks; crests shrink; absentees as horizontal scroll. |
| Advantages | Matchday anticipation; Absentees visible where they matter |
| Disadvantages | No table context; Big on non-match weeks |
| Complexity / perf | M / Medium |
| Works with | DSH-01e, CLB-04 |
| Fits identities | B |
| Patterns | Pre-match ritual sequence |

#### C — Match Box

| | |
|---|---|
| Visual concept | An editorial 'Matchrutan': fixture headline ('Lördag: Kristianstad borta'), a readiness line ('13 spelbara · 2 skadade · 1 avstängd'), opponent form and the ladder slice, with the opponent opening in Peek. |
| Layout | Boxed column: headline + countdown, readiness line with icons, opponent form strip, ladder ±2. |
| Information hierarchy | Headline → readiness → stakes (ladder). |
| Interactions | Opponent name → Peek dossier; readiness → availability court; 'Förbered match' starts the 3-step ritual. |
| Navigation | Sits under the lead story; becomes the lead itself on matchday. |
| Desktop | 4/12 column. |
| Mobile | Card with sticky 'Förbered match'. |
| Advantages | Readiness + stakes in one glance; Promotes to lead on matchday |
| Disadvantages | More text than A; Copy templates needed |
| Complexity / perf | M / Low |
| Works with | DSH-01e, CLB-04, MGR-03 |
| Fits identities | C |
| Patterns | Portal home; Per-event targets |

### DSH-01c · Season-complete milestone & transition blockers

**Current:** ClubHero + milestone section ('Säsongen är i mål.') with three facts (final place, points, goals); transition blockers rendered as an alert list exposing internal codes (b.ref).

**Recommendation:** B — Season end is the biggest recurring emotional beat and today it is a text card. A skippable Floodlight curtain that ends by writing the season into the career biography makes progression felt, and blockers become human tasks instead of codes.

**Priority:** P1 · **Dependencies:** G5 motion budget, Floodlight moment shell, MGR-01 biography (season card write-back), Human-readable blocker copy for transition codes

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Season Hand-off Checklist

| | |
|---|---|
| Visual concept | A calm summary followed by a transition checklist: each blocker rewritten as a task with a fix link ('3 kontrakt löper ut — Se över avtalen'). |
| Layout | Summary strip (place, points, goals, board verdict) → checklist → 'Börja nästa säsong' disabled until done. |
| Information hierarchy | Blockers first, then summary. |
| Interactions | Each task resolves in place or deep-links; progress bar. |
| Navigation | Replaces dashboard body until the season is started. |
| Desktop | Single column, 720px. |
| Mobile | Same; sticky primary at bottom. |
| Advantages | Clear, functional, low cost; Fixes the internal-code leak |
| Disadvantages | Season ending still feels administrative |
| Complexity / perf | S / Low |
| Works with | MGR-03, WLD-01 |
| Fits identities | A |
| Patterns | Inbox as task queue |

#### B — Season Curtain

| | |
|---|---|
| Visual concept | A skippable Floodlight sequence the first time you land after the last match: lights down, final position counts up, trophy/promotion/relegation asset, top scorer, board verdict stamp, reputation delta — ending on a season card that is 'filed' into Karriär. Afterwards the dashboard shows the checklist. |
| Layout | Full-screen stages (5–8 s total, Space to skip): Final position → Honours → Board verdict → Rykte → Season card + 'Arkivera och fortsätt'. |
| Information hierarchy | Position/honour, then verdict, then career delta. |
| Interactions | Click/Space advances; 'Hoppa över' always visible; final card animates into the Karriär icon. |
| Navigation | Returns to Idag with the hand-off checklist. |
| Desktop | Full-bleed floodlight with trophy-moment asset. |
| Mobile | Portrait stages, tap to advance. |
| Advantages | Makes the season matter emotionally; Creates the career history artefact visibly; Reuses trophy-moment asset |
| Disadvantages | Motion budget and copy needed; Must be idempotent (show once) |
| Complexity / perf | M / Medium |
| Works with | MGR-01, MGR-02, MGR-03b, CLB-05a |
| Fits identities | B, C |
| Patterns | Pre-season directive meeting |

#### C — Special Edition

| | |
|---|---|
| Visual concept | The day after the final whistle the paper prints a special edition: season review headline, table of the season in numbers, best match, and blockers as 'Att göra före nästa säsong'. |
| Layout | Paper front page variant with large headline + numbered blockers. |
| Information hierarchy | Headline → review → tasks. |
| Interactions | Static reading, tasks inline. |
| Navigation | Normal dashboard flow. |
| Desktop | Paper layout. |
| Mobile | Feed. |
| Advantages | Consistent with Today's Paper; Low motion cost |
| Disadvantages | Less of a 'moment' than B |
| Complexity / perf | S / Low |
| Works with | DSH-01, MGR-02 |
| Fits identities | C |

### DSH-01d · Contextual notices (unemployed / new season)

**Current:** Inline note strips with a bold lead and a link, used identically for very different stakes (unemployed vs. new season).

**Recommendation:** B — Being without a club is a career state, not a notice. Letting the Idag hub turn into a job-hunt front page (and a new season into a pre-season front page) gives each state its proper weight.

**Priority:** P1 · **Dependencies:** MGR-01b job market, MGR-01c dismissal moment, Season phase state machine

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Tone-tiered Notices

| | |
|---|---|
| Visual concept | Three notice tiers — info (paper), milestone (gold), crisis (signal/Floodlight) — each with an icon, headline and one CTA. |
| Layout | Strip above the lead story. |
| Information hierarchy | Tier colour → headline → CTA. |
| Interactions | Dismissible except crisis. |
| Navigation | Links to MGR-01b / MGR-02. |
| Desktop | Full-width strip. |
| Mobile | Card at top. |
| Advantages | Simple; Fixes equal-weight problem |
| Disadvantages | Unemployment still feels like a banner |
| Complexity / perf | S / Low |
| Works with | MGR-01 |
| Fits identities | A, C |

#### B — State Front Pages

| | |
|---|---|
| Visual concept | Career states replace the dashboard body: 'Utan klubb' front page (days unemployed, reputation, open vacancies matched to your standing, applications pipeline), 'Ny säsong' front page (board objectives meeting, pre-season planner, squad changes). |
| Layout | Same masthead; body swaps to a state template. |
| Information hierarchy | State headline → the 2–3 actions that move you out of it. |
| Interactions | Apply / answer interview / plan pre-season inline. |
| Navigation | Continue keeps advancing time while unemployed; offers arrive as decisions. |
| Desktop | Paper grid template per state. |
| Mobile | Feed per state. |
| Advantages | Unemployment becomes playable, not a dead end; Pre-season gets a ritual |
| Disadvantages | Two extra templates to maintain |
| Complexity / perf | M / Low |
| Works with | MGR-01b, MGR-01c, WLD-06a, CLB-05 |
| Fits identities | C, B |
| Patterns | Pre-season directive meeting; Play menu as season state machine |

### DSH-01e · Laget inför avkast (availability)

**Current:** Big 'available/total' number, one sentence on fitness and captain, up to three player rows with glyph + issue.

**Recommendation:** B — Handball availability is positional — losing both left backs matters more than losing three wings. A court coverage diagram is native to the sport and answers that instantly.

**Priority:** P0 · **Dependencies:** Squad positional depth data (already in CLB-02 depth tiles), Peek drawer (player)

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Availability Ring

| | |
|---|---|
| Visual concept | A ring chart (spelbara / skadade / avstängda / låg matchform) with the top three issues listed with faces. |
| Layout | Ring left, issues right. |
| Information hierarchy | x/16 → issue list. |
| Interactions | Segment hover filters list. |
| Navigation | Hela truppen link. |
| Desktop | 4/12 card. |
| Mobile | Ring shrinks inline with number. |
| Advantages | Glanceable; Simple |
| Disadvantages | Not position-aware |
| Complexity / perf | S / Low |
| Works with | MED-01 |
| Fits identities | A |
| Patterns | Mood hub with causes |

#### B — Court Coverage

| | |
|---|---|
| Visual concept | A half-court with the seven positions (MV, VS, VN, MN, HN, HS, M); each shows depth dots (available green, doubtful amber, out red). Thin positions glow. |
| Layout | Half-court SVG with position nodes; legend; 'Välj startsju' CTA. |
| Information hierarchy | Red/amber positions → names → CTA. |
| Interactions | Tap a position → Peek list of players for that spot with fitness and match form; long-press on touch. |
| Navigation | Links to tactics line-up and medical. |
| Desktop | 4/12 card, 240px court. |
| Mobile | Full-width court, positions large enough to tap (44px). |
| Advantages | Handball-native; Answers 'can we field a team?'; No new data |
| Disadvantages | Needs a clear legend for doubtful vs. low match form |
| Complexity / perf | M / Low |
| Works with | MED-01, DSH-01b |
| Fits identities | A, C, B |
| Patterns | Hover cards for every entity |

#### C — Squad Status Row

| | |
|---|---|
| Visual concept | One line '13 av 16 spelbara' followed by a horizontal row of face chips sorted by problem severity with status icons (plus sign, 2-min clock, battery). |
| Layout | Sentence + chip row. |
| Information hierarchy | Number → problem faces. |
| Interactions | Chip → Peek. |
| Navigation | Hela truppen link. |
| Desktop | Full-width row. |
| Mobile | Horizontal scroll. |
| Advantages | Very compact; Faces humanise |
| Disadvantages | needs new data: player portraits (or monograms); No positional view |
| Complexity / perf | S / Low |
| Works with | MED-01 |
| Fits identities | C |

### DSH-01f · Utanför planen (contracts & radar)

**Current:** Two 'decision' rows (count + heading + generic copy + links) for contracts and scouting, plus two contract lines. Copy repeats every visit.

**Recommendation:** B — Expiring contracts and shortlist updates are decisions with deadlines; they belong in the ranked decision column, not a separate panel with static copy.

**Priority:** P1 · **Dependencies:** DSH-01 decision column, WLD-01 inline actions

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Deadline Cards

| | |
|---|---|
| Visual concept | Cards for contracts expiring sorted by days left, each with player, position, wage and 'Förläng' / 'Låt gå'. |
| Layout | 3 cards + 'alla kontrakt'. |
| Information hierarchy | Days left → player → action. |
| Interactions | Inline open negotiation. |
| Navigation | Kontrakt page. |
| Desktop | Row of 3. |
| Mobile | Stack. |
| Advantages | Concrete and actionable |
| Disadvantages | Another panel competing for attention |
| Complexity / perf | S / Low |
| Works with | CLB-06e |
| Fits identities | A |
| Patterns | Predictive consequence preview |

#### B — Folded into Decisions

| | |
|---|---|
| Visual concept | No panel. Contract deadlines and scouting reports become numbered items in 'Att avgöra' when they cross a threshold (e.g. <60 days); otherwise silent. |
| Layout | Items in DSH-01 decision column. |
| Information hierarchy | By deadline. |
| Interactions | Same inline verbs. |
| Navigation | Kontrakt / Rekrytering hubs. |
| Desktop | — |
| Mobile | — |
| Advantages | Removes repeated generic copy; One priority system |
| Disadvantages | Less ambient awareness of the radar |
| Complexity / perf | S / Low |
| Works with | DSH-01, WLD-01 |
| Fits identities | A, B, C |
| Patterns | Inbox as task queue; Consolidated threads |

### DSH-01g · Senaste avtrycket (recent results)

**Current:** Three link rows with stacked short names, date and score; no W/D/L colour or crests.

**Recommendation:** B — A five-block form strip inside the match box carries the same information in one line and removes a panel.

**Priority:** P2 · **Dependencies:** DSH-01b match box

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Result Tiles

| | |
|---|---|
| Visual concept | Three tiles: opponent crest, score, V/O/F colour edge, competition mark. |
| Layout | Row of 3. |
| Information hierarchy | Outcome colour → score. |
| Interactions | Tile → match report. |
| Navigation | Matcharkivet link. |
| Desktop | 4/12. |
| Mobile | Horizontal scroll. |
| Advantages | Clear outcomes |
| Disadvantages | Separate panel |
| Complexity / perf | S / Low |
| Works with | WLD-06 |
| Fits identities | A, B |

#### B — Form Strip

| | |
|---|---|
| Visual concept | Last five results as coloured blocks with score inside, embedded in the match box; tap opens the report in Peek. |
| Layout | One row in DSH-01b. |
| Information hierarchy | Colour pattern. |
| Interactions | Hover → crest + score; tap → Peek report. |
| Navigation | Match report. |
| Desktop | Inline. |
| Mobile | Inline. |
| Advantages | Zero extra panel; Pattern readable at a glance |
| Disadvantages | Less detail per match |
| Complexity / perf | S / Low |
| Works with | DSH-01b |
| Fits identities | A, C |
| Patterns | Hover cards for every entity |

### DSH-01h · Från klubben (latest news)

**Current:** Four article lines (category · date · NYTT, subject, preview) duplicating the inbox with no priority signal.

**Recommendation:** A — Short ranked briefs keep the world visible on the front page while the inbox remains the place to act.

**Priority:** P1 · **Dependencies:** WLD-01 priority model

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Ranked Briefs

| | |
|---|---|
| Visual concept | 'Från klubben' as three briefs ranked by priority (action-required first), sender role emblem, one-line dek; 'Inkorgen (5)' link. |
| Layout | List of 3. |
| Information hierarchy | Priority → headline. |
| Interactions | Brief → open thread in inbox or Peek. |
| Navigation | WLD-01. |
| Desktop | 6/12 column. |
| Mobile | List. |
| Advantages | Keeps news visible but ranked |
| Disadvantages | Some overlap remains |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | C, A |
| Patterns | Dated, categorised news |

#### B — Removed

| | |
|---|---|
| Visual concept | No news panel: actionable messages surface in decisions, the biggest story becomes the lead; everything else stays in Inbox/Media. |
| Layout | — |
| Information hierarchy | — |
| Interactions | — |
| Navigation | Inbox badge in hub rail. |
| Desktop | — |
| Mobile | — |
| Advantages | Shortest page |
| Disadvantages | World feels quieter on Idag |
| Complexity / perf | S / Low |
| Works with | WLD-01, WLD-02 |
| Fits identities | A |
| Patterns | Inform vs navigate separation |

### DSH-01i · Veckans managerplan (weekly overview)

**Current:** Long vertical section: date range, status box, seven day lines, availability sentence, decisions/deadlines list, board sentence + objectives, economy sentence and feedback articles — duplicating the board card and news.

**Recommendation:** C — The week is the game's heartbeat; it should be one persistent component (Week Spine) shared with the calendar and Continue, not a wall of text on one page.

**Priority:** P0 · **Dependencies:** Week Spine component, WLD-05 calendar, Continue state machine, Training day types (MATCH, MATCH_PREPARATION, TACTICAL, TRAINING, RECOVERY, REST, TRAVEL)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — 7-Day Planner Strip

| | |
|---|---|
| Visual concept | Seven columns (mån–sön) with day type badge, sessions count, match chip and deadline pins; today highlighted. |
| Layout | Grid 7 × 1 on the dashboard. |
| Information hierarchy | Today → match day → deadlines. |
| Interactions | Click day → day detail popover; 'Justera träning'. |
| Navigation | Training and calendar. |
| Desktop | Full width, 140px. |
| Mobile | Horizontal scroll, today centred. |
| Advantages | Visual week; Removes duplicated board/news |
| Disadvantages | Page-local component; calendar needs its own |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | A |
| Patterns | Portal home |

#### B — Week Road

| | |
|---|---|
| Visual concept | A road from today to the next match with stops (training, travel, recovery) and the match as an arena at the end. |
| Layout | Illustrated horizontal path. |
| Information hierarchy | Distance to match. |
| Interactions | Stops open details. |
| Navigation | Matchday sequence. |
| Desktop | Full width illustrated. |
| Mobile | Vertical road. |
| Advantages | Atmospheric, conveys build-up |
| Disadvantages | Weeks with two matches get awkward; Asset cost |
| Complexity / perf | M / Medium |
| Works with | WLD-05 |
| Fits identities | B |
| Patterns | Pre-match ritual sequence |

#### C — Week Spine (embedded)

| | |
|---|---|
| Visual concept | The global Week Spine sits under the masthead: seven day cells with day-type colour, pins for match, deadlines, board meetings, scouting completions; Continue moves a 'today' marker along it. On Idag it expands to show the selected day's detail. |
| Layout | Spine row + expandable day detail drawer. |
| Information hierarchy | Today marker → next pin → day detail. |
| Interactions | Click day → detail (sessions, events); drag future days to WLD-05 for more; pins open Peek. |
| Navigation | Same component in every hub (collapsed); full calendar = WLD-05. |
| Desktop | Spine 64px collapsed / 180px expanded. |
| Mobile | Swipeable strip at top of Idag. |
| Advantages | One mental model of time across the game; Continue becomes spatial; Removes the wall of text |
| Disadvantages | Shell-level component — needs G2 decision; Pins must be prioritised to avoid clutter |
| Complexity / perf | M / Low |
| Works with | WLD-05, WLD-06, DSH-01, CLB-05 |
| Fits identities | C, A |
| Patterns | Continue button as heartbeat; Play menu as season state machine |

### DSH-01j · Styrelsen (board card)

**Current:** MeterBar 'Förtroende n/100', pressure label sentence and three objective rows with status pills; repeated in the weekly plan.

**Recommendation:** A — Pairing board confidence (this club, now) with manager reputation (career, long-term) explains the two stakes the player juggles; objectives get real progress bars.

**Priority:** P1 · **Dependencies:** Dual meter component, CLB-05

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Dual Meter + Objectives

| | |
|---|---|
| Visual concept | Two gauges side by side — Förtroende and Rykte — with last delta + reason, then the three objectives as progress bars against target and minimum (I fas / I fara). |
| Layout | Gauges row, objectives list. |
| Information hierarchy | Pressure stage colour → objectives at risk. |
| Interactions | Delta hover → factor list; objective → CLB-05. |
| Navigation | Styrelserummet. |
| Desktop | 4/12 card. |
| Mobile | Card; gauges as chips. |
| Advantages | Explains long vs short term; Progress visible |
| Disadvantages | Two meters need clear naming |
| Complexity / perf | S / Low |
| Works with | CLB-05, MGR-01 |
| Fits identities | A, C |
| Patterns | Dual meters; Mood hub with causes |

#### B — Chairman's Note

| | |
|---|---|
| Visual concept | A short signed note from the board chair role reflecting the pressure stage ('Styrelsen är oroad efter fyra raka förluster') with the stamp colour. |
| Layout | Note card with stamp. |
| Information hierarchy | Stamp → sentence. |
| Interactions | Read more → CLB-05. |
| Navigation | Styrelserummet. |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Human tone; Pairs with editorial identity |
| Disadvantages | Less precise than numbers; needs new data: varied note templates per stage |
| Complexity / perf | S / Low |
| Works with | CLB-05 |
| Fits identities | C, B |
| Patterns | Staff as faces of systems |

### DSH-01k · Rivalerna + På andra planer + training note

**Current:** Four-column mini table (#, Klubb, SM, P), table of four other results and a static training note card that repeats every visit.

**Recommendation:** A — A ladder slice centred on your club is more relevant than the top four, and a compact round list keeps the world alive; the static training note goes.

**Priority:** P2 · **Dependencies:** DSH-01b ladder slice

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Ladder Slice + Round List

| | |
|---|---|
| Visual concept | Table rows ±2 around you plus the leader, with zone colours; 'Omgången' list of other scores with crests. |
| Layout | Two compact blocks. |
| Information hierarchy | Your row → scores. |
| Interactions | Rows hover cards. |
| Navigation | Competition. |
| Desktop | Two 4/12 cards. |
| Mobile | Collapsed under 'Runt ligan'. |
| Advantages | Relevant context |
| Disadvantages | Some overlap with match box |
| Complexity / perf | S / Low |
| Works with | MGR-03, CLB-04 |
| Fits identities | A, C |

#### B — Round Ticker

| | |
|---|---|
| Visual concept | A slim ticker under the masthead with other scores and table movements (↑2 Ystad). |
| Layout | One-line marquee (paused on hover / reduced motion: static list). |
| Information hierarchy | Movement arrows. |
| Interactions | Item → Peek club. |
| Navigation | Competition. |
| Desktop | Full width 32px. |
| Mobile | Static swipe row. |
| Advantages | Lively, tiny footprint |
| Disadvantages | Motion distraction; Harder to scan |
| Complexity / perf | S / Low |
| Works with | MGR-03 |
| Fits identities | B |

## CLB — Club & organisation

### CLB-01 · Klubbhuset (clubhouse hub)

**Current:** Arena photo hero, an SVG court floorplan with absolutely-positioned room hotspots beside a photo 'stage', a gallery of 11 room cards, and three panels (identity, supporters, national team). Rooms duplicate sidebar navigation; double-click/hover affordances fail on touch.

**Recommendation:** C — The clubhouse's real value is identity and visible progression (local → pro → elite facility tiers), not a second navigation system. Folding it into the Klubben hub as an illustrated header that upgrades with the club keeps the atmosphere and kills the duplication.

**Priority:** P1 · **Dependencies:** CLB-02 recommendation (Club Journal), G3 imagery policy, Existing klubbhuset-local/pro/elite assets, Peek drawer

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Department Status Board

| | |
|---|---|
| Visual concept | No map. Eleven rooms become status rows grouped by wing (Sport, Kansli, Media) with a responsible staff role, live status and badge count. |
| Layout | Grouped list with status column and one action each. |
| Information hierarchy | Rooms with alerts first. |
| Interactions | Row → room's page or Peek; filter 'Bara avvikelser'. |
| Navigation | Becomes the Klubben hub's secondary index. |
| Desktop | Two-column grouped list. |
| Mobile | Single list with badges. |
| Advantages | Fast, accessible, no assets; Answers 'what needs attention' per department |
| Disadvantages | Loses the spatial charm entirely; Overlaps CLB-02 Executive Office |
| Complexity / perf | S / Low |
| Works with | CLB-02, CLB-05, CLB-06, MED-01 |
| Fits identities | A |
| Patterns | Control panel per area; Staff as faces of systems |

#### B — Illustrated Clubhouse

| | |
|---|---|
| Visual concept | An isometric illustrated building whose look follows the facility tier (local/pro/elite assets exist, unused). Rooms show notification badges; a single tap opens a room Peek with status, metrics and the CTA. |
| Layout | Large illustration (8/12) + room Peek drawer; identity strip below. |
| Information hierarchy | Badged rooms → building tier → identity. |
| Interactions | Tap room → Peek; long-press for preview on touch; tier upgrade plays a short reveal. |
| Navigation | Klubben hub landing for B identity. |
| Desktop | Full-bleed illustration, hover highlights. |
| Mobile | Pannable illustration with a room list toggle (accessible fallback). |
| Advantages | Visible long-term progression (facility tiers); Strong identity and screenshot value |
| Disadvantages | Illustration cost per tier; Still duplicates navigation; Map accessibility needs a list twin |
| Complexity / perf | L / High |
| Works with | CLB-02, CLB-05, CLB-06 |
| Fits identities | B |
| Patterns | Visible facility tree; Hover cards for every entity |

#### C — Merged into Club Journal

| | |
|---|---|
| Visual concept | Klubbhuset stops being a page. Its illustrated building (tier art) becomes the header image of the Klubben hub front page (CLB-02 C), with room badges as small hotspots that open Peek; identity/supporters/honours move into the journal. |
| Layout | Club Journal header = clubhouse illustration with hotspots; body = journal sections. |
| Information hierarchy | Club identity → departments needing attention → history. |
| Interactions | Hotspot → Peek (single tap); 'Visa som karta' expands the header to full screen. |
| Navigation | Removes a nav item; /career/klubbhuset redirects to Klubben. |
| Desktop | Header 280px expandable. |
| Mobile | Header image static; hotspots replaced by department chips. |
| Advantages | Removes duplicated navigation; Keeps facility tier as visible progression; Less to maintain |
| Disadvantages | Map is less central for players who loved it; Depends on CLB-02 C |
| Complexity / perf | M / Medium |
| Works with | CLB-02, CLB-01c, CLB-05, CLB-06 |
| Fits identities | C, B |
| Patterns | Visible facility tree; Inform vs navigate separation |

### CLB-01a · Interactive floorplan + room stage

**Current:** Left: blueprint SVG court with %-positioned hotspot buttons and legend; right: photo stage with department, purpose, metrics and CTA. Double-click to open is undiscoverable.

**Recommendation:** A — Single-tap to a Peek drawer works on every input device and keeps context; the illustrated map is the identity payoff.

**Priority:** P2 · **Dependencies:** Peek drawer, Illustration assets per tier

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Illustrated Map + Peek

| | |
|---|---|
| Visual concept | Illustrated rooms replace boxes; one tap opens a room Peek (status, metrics, staff role, CTA). No double-click, no hover side effects. |
| Layout | Map + right Peek. |
| Information hierarchy | Badges → room. |
| Interactions | Tap/Enter opens; arrow keys move between rooms. |
| Navigation | Peek 'Öppna rummet' goes to the room's page. |
| Desktop | Map 8/12. |
| Mobile | Map pans; Peek as bottom sheet. |
| Advantages | Touch-friendly; Keyboard navigable |
| Disadvantages | Illustration cost |
| Complexity / perf | M / Medium |
| Works with | CLB-01 |
| Fits identities | B, C |
| Patterns | Hover cards for every entity |

#### B — Room List + Stage

| | |
|---|---|
| Visual concept | A vertical room list (status dot, name, one-line status) drives the photo stage; the floorplan is dropped. |
| Layout | List 4/12 + stage 8/12. |
| Information hierarchy | Status → stage. |
| Interactions | Click/arrow keys select; Enter opens. |
| Navigation | Same. |
| Desktop | Two-pane. |
| Mobile | List only; stage as sheet. |
| Advantages | Accessible; Cheap |
| Disadvantages | Loses spatial idea |
| Complexity / perf | S / Low |
| Works with | CLB-01 |
| Fits identities | A |

### CLB-01b · Room cards gallery

**Current:** Grid of 11 room cards with env photo, purpose, metrics and Öppna/Granska; hover changes the stage above; one photo reused across rooms.

**Recommendation:** A — The gallery is a third way into the same rooms; removing it reduces duplication. Status belongs in the map/Peek and the Today decisions.

**Priority:** P3 · **Dependencies:** CLB-01 recommendation

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Retire the Gallery

| | |
|---|---|
| Visual concept | Remove the cards; map/header hotspots + Peek cover entry, and alerts flow to Idag. |
| Layout | — |
| Information hierarchy | — |
| Interactions | — |
| Navigation | Rooms reachable via hub rail and Peek. |
| Desktop | — |
| Mobile | — |
| Advantages | Less duplication and scroll |
| Disadvantages | Loses a photo-led browse |
| Complexity / perf | S / Low |
| Works with | CLB-01, DSH-01 |
| Fits identities | A, C |
| Patterns | Inform vs navigate separation |

#### B — Status Chip Row

| | |
|---|---|
| Visual concept | A compact chip row (room name + status dot + count) under the map for quick scanning. |
| Layout | Wrap row of 11 chips. |
| Information hierarchy | Alert chips first. |
| Interactions | Chip → Peek. |
| Navigation | Same. |
| Desktop | One row. |
| Mobile | Horizontal scroll. |
| Advantages | Glanceable index |
| Disadvantages | Still a duplicate entry |
| Complexity / perf | S / Low |
| Works with | CLB-01a |
| Fits identities | A, B |

### CLB-01c · Identity / Supporters / National team panels

**Current:** Three panels: identity facts with colour swatches; supporter MeterBar + rivals list + honours list; national team windows with dates/opponents/called players.

**Recommendation:** C — Identity, supporters and honours are the club's story; an almanac page inside the journal shows them as history, while national windows belong on the calendar.

**Priority:** P2 · **Dependencies:** CLB-02 Club Journal, WLD-05 (national windows as calendar pins)

**Arena Nights (owner identity, 2026-11-13):** adapt → *Club Archive panel* — Keep timeline + facts sidebar; honours as gold-glow markers on a neon timeline; supporters' mood with causes as chips; national windows still move to the calendar as pins. _Conflict:_ 'Almanac section of the Club Journal' (printed almanac styling).

#### A — Fact Sheet

| | |
|---|---|
| Visual concept | Tidy definition-list fact sheet with colour swatches, supporter meter and lists. |
| Layout | Three columns. |
| Information hierarchy | Facts. |
| Interactions | Rival → club. |
| Navigation | CLB-04. |
| Desktop | 3 cols. |
| Mobile | Stack. |
| Advantages | Cheap |
| Disadvantages | Still database-like |
| Complexity / perf | S / Low |
| Works with | CLB-04 |
| Fits identities | A |

#### B — The Stand

| | |
|---|---|
| Visual concept | Supporters as a stand: tifo banner in club colours with the supporter mood meter, derby cards for rivals (last result, next meeting), honours as a trophy shelf. |
| Layout | Banner → derby cards → shelf. |
| Information hierarchy | Mood → derbies → trophies. |
| Interactions | Derby card → CLB-04; trophy → season in history. |
| Navigation | MGR-02. |
| Desktop | Full-width banner. |
| Mobile | Stack. |
| Advantages | Emotional; rivals feel like rivals |
| Disadvantages | Asset cost (tifo, trophies) |
| Complexity / perf | M / Medium |
| Works with | CLB-04, MGR-02, WLD-02c |
| Fits identities | B |

#### C — Club Almanac

| | |
|---|---|
| Visual concept | An almanac section of the Club Journal: founding, colours, home arena, honours timeline (year + title), supporters' mood with its causes, rivals with head-to-head; national windows move to the calendar as pins. |
| Layout | Timeline + sidebar facts. |
| Information hierarchy | Honours timeline → mood → rivals. |
| Interactions | Timeline year → season book (MGR-02). |
| Navigation | Klubben hub section. |
| Desktop | 8/4 split. |
| Mobile | Single column with sticky section heads. |
| Advantages | History visible as progression; National windows where they belong |
| Disadvantages | Honours timeline thin for small clubs at start |
| Complexity / perf | S / Low |
| Works with | CLB-02, MGR-02, WLD-05 |
| Fits identities | C |
| Patterns | Mood hub with causes |

### CLB-02 · Klubb (own club overview) — HI-FI prototype `club`

**Current:** ClubHero, 4-cell facts strip, ClubContext tabs (results/transfers/history), 7-position depth tiles, top-6 scorers, and a right rail with ~16 label/value finance rows and partnerships. Overlaps Klubbhuset, Finance and Squad.

**Recommendation:** C — The Club Journal becomes the single Klubben hub landing: identity and history first, departments and board/economy as summaries that link out. It absorbs Klubbhuset (as header art) and replaces the finance spreadsheet with three KPIs, resolving all three overlaps.

**Priority:** P1 · **Dependencies:** G2 navigation model (Klubben hub), CLB-01 merge, CLB-06 KPIs, Dual meter component, Season history data for the history strip

**Arena Nights (owner identity, 2026-11-13):** adapt → *Club Channel* — Same front-page order (header with identity facts → history strip of positions/honours → department briefs, board mood, economy KPIs, people). Arena treatment: neon club stripe (primary → neon), radial club glow behind the header, gold-glow honours, quote with neon edge. _Conflict:_ Club Journal is the club's paper front page (rules, serif quote, double-rule head).

#### A — Executive Office

| | |
|---|---|
| Visual concept | A department grid — Trupp, Personal, Ekonomi, Styrelse, Anläggning, Ungdom, Partnerskap — each a status tile with headline number, trend sparkline and responsible staff role. |
| Layout | Facts strip → 3×3 department tiles → club context table below. |
| Information hierarchy | Tiles with warnings → numbers → context. |
| Interactions | Tile 'Öppna' link (tile body informs only); hover cards for staff. |
| Navigation | Klubben hub root; tiles link to sub-tabs. |
| Desktop | Dense grid, sparklines. |
| Mobile | Tiles become ranked cards (warnings first). |
| Advantages | Fast overview of the whole organisation; Low cost |
| Disadvantages | No story or identity; Tiles risk becoming navigation (FM26 lesson) |
| Complexity / perf | M / Low |
| Works with | CLB-05, CLB-06, CLB-03 |
| Fits identities | A |
| Patterns | Control panel per area; Inform vs navigate separation; Staff as faces of systems |

#### B — Clubhouse Rooms

| | |
|---|---|
| Visual concept | The club is its building: the illustrated clubhouse (facility tier art) is the page, and each room opens a full-bleed room panel (Kontoret, Styrelserummet, Ekonomi, Pressrummet, Troférummet). |
| Layout | Full-bleed illustration + stacked broadcast panels per room on scroll. |
| Information hierarchy | Building → room badges → room panels. |
| Interactions | Tap room → camera move to room panel; swipe between rooms on mobile. |
| Navigation | Klubben hub = building. |
| Desktop | Full-bleed. |
| Mobile | Swipe between room cards. |
| Advantages | Most immersive; Facility progression visible |
| Disadvantages | Asset-hungry; Depth hidden behind presentation; Duplicates nav |
| Complexity / perf | XL / High |
| Works with | CLB-01, CLB-05, CLB-06 |
| Fits identities | B |
| Patterns | Visible facility tree |

#### C — Club Journal

| | |
|---|---|
| Visual concept | The club's own front page: header art (clubhouse at current tier), kicker 'Grundad 1932 · Handbollsligan', a history strip of final positions across every season you managed (and before), department briefs, board mood, three economy KPIs, positional depth court and top scorers. |
| Layout | Header → history strip (sparkline of positions with honours stars) → 8/4 grid: department briefs + club context \| board dual meter + economy KPIs + partnerships. |
| Information hierarchy | Identity → trajectory over seasons → what needs attention now. |
| Interactions | History strip season → season book; department briefs → Peek; KPI → Finance. |
| Navigation | Klubben hub root; Klubbhuset, Partnerskap, Ekonomi, Styrelsen as secondary tabs. |
| Desktop | Editorial grid with rules. |
| Mobile | Single column; header shorter; KPIs as 3 chips. |
| Advantages | Tells the club's long story; Resolves CLB-01/06 overlaps; Builds on existing data (history, depth, finance) |
| Disadvantages | History strip empty in season 1 (show club's pre-history if available); Copy templates |
| Complexity / perf | M / Medium |
| Works with | CLB-01, CLB-05, CLB-06, MGR-02, CLB-03 |
| Fits identities | C |
| Patterns | Dated, categorised news; Visible facility tree |

### CLB-02a · ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik)

**Current:** Panel 'Klubben i karriärvärlden' with local-state tabs: results (form dots + 8 fixtures), transfers (5-col table), history (4-col table). Tabs reset on navigation.

**Recommendation:** B — Results, transfers and seasons are one club story; a filterable timeline reads as narrative and is reusable for other clubs (CLB-04).

**Priority:** P2 · **Dependencies:** URL-persisted filters, MGR-02 season books

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — URL Tabs + Tables

| | |
|---|---|
| Visual concept | Keep three tabs but persist in URL, add crests and styled empty states. |
| Layout | Tabs + table. |
| Information hierarchy | Active tab. |
| Interactions | Tab switch; rows to reports. |
| Navigation | Deep-linkable. |
| Desktop | Table. |
| Mobile | Scroll-x tabs. |
| Advantages | Minimal change |
| Disadvantages | Still three tables |
| Complexity / perf | S / Low |
| Works with | CLB-04 |
| Fits identities | A |

#### B — Club Story Timeline

| | |
|---|---|
| Visual concept | One chronological timeline mixing matches (outcome colour), transfers (in/out arrows with player) and season ends (position + honours), filterable by chips. |
| Layout | Vertical timeline grouped by month; filter chips. |
| Information hierarchy | Season markers → big events → matches. |
| Interactions | Chips Matcher/Övergångar/Säsonger; items open Peek. |
| Navigation | Shared with CLB-04. |
| Desktop | 8/12 column. |
| Mobile | Full width. |
| Advantages | Narrative; Reusable |
| Disadvantages | Long timelines need virtualisation |
| Complexity / perf | M / Medium |
| Works with | CLB-04, MGR-02 |
| Fits identities | C, B |
| Patterns | Dated, categorised news |

### CLB-02b · Economy & partnerships rail

**Current:** Panel with 16 FinanceRows (revenue split, cash, wages vs budget, budgets, health) at 11–12px with inline styles, plus partnership rows.

**Recommendation:** A — Three KPIs and a revenue-mix bar give the club page what it needs and push depth to Finance.

**Priority:** P1 · **Dependencies:** CLB-06 KPI definitions

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — KPI Trio + Revenue Mix

| | |
|---|---|
| Visual concept | Kassa, Lönerum (wages vs budget), Prognos 31 maj as tiles with deltas; one stacked bar of revenue mix; partnerships as crest chips. |
| Layout | 3 tiles, bar, chips. |
| Information hierarchy | Budget headroom. |
| Interactions | Tile hover → explanation; link to Finance. |
| Navigation | CLB-06. |
| Desktop | Rail. |
| Mobile | Chips row. |
| Advantages | Replaces spreadsheet; Tokens not inline styles |
| Disadvantages | Less detail on page |
| Complexity / perf | S / Low |
| Works with | CLB-06, CLB-03 |
| Fits identities | A, C |
| Patterns | Inform vs navigate separation |

#### B — Headroom Gauge

| | |
|---|---|
| Visual concept | One gauge: how much you can spend on wages/transfers this season without board alarm, with partner chips. |
| Layout | Gauge + caption. |
| Information hierarchy | Headroom number. |
| Interactions | → Finance budget. |
| Navigation | CLB-06c. |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Football-relevant single number |
| Disadvantages | needs new data: combined 'spendable' figure (derivable, but a new calculation) |
| Complexity / perf | S / Low |
| Works with | CLB-06c |
| Fits identities | A, B |
| Patterns | Predictive consequence preview |

### CLB-03 · Klubbpartnerskap

**Current:** Vertical stack of plain panels: intro, permanent B-teams table, partner search state machine with radio candidates and inline form, placement panels, international loan panels and a history table. Inline styles, no imagery, '--' in copy, no confirm on termination.

**Recommendation:** C — Partnerships are a few weighty decisions per season; partner dossier cards plus a guided agreement flow with consequence preview fit that rhythm and fix the one-click termination.

**Priority:** P2 · **Dependencies:** Decision card component with consequence preview, Confirm dialog for irreversible actions, Crests for Division 1 clubs

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Clean Admin

| | |
|---|---|
| Visual concept | Same structure, done properly: tables with crests and scroll wrappers, forms with labels, confirm on Avsluta, typographic dashes. |
| Layout | Stacked sections. |
| Information hierarchy | Active agreements → search → history. |
| Interactions | Forms; confirm dialogs. |
| Navigation | Klubben → Partnerskap tab. |
| Desktop | Single column 960px. |
| Mobile | Cards instead of tables. |
| Advantages | Low risk, fixes bugs |
| Disadvantages | Still the least 'game' page |
| Complexity / perf | S / Low |
| Works with | CLB-02 |
| Fits identities | A |

#### B — Partner Network

| | |
|---|---|
| Visual concept | A network diagram: your club at the centre, B-team and partner clubs as crest nodes, placed players as avatars on the edges; drag a player onto a partner to place. |
| Layout | Diagram 8/12 + node detail 4/12. |
| Information hierarchy | Partners → players out on placement. |
| Interactions | Drag to place; node click → agreement detail; '+' node to search. |
| Navigation | Same tab. |
| Desktop | Canvas. |
| Mobile | List twin (diagram not usable on phone). |
| Advantages | Makes the network tangible |
| Disadvantages | Drag-drop accessibility; Few nodes — diagram may look sparse |
| Complexity / perf | L / Medium |
| Works with | CLB-02, CLB-04 |
| Fits identities | B |

#### C — Partner Dossiers + Guided Deal

| | |
|---|---|
| Visual concept | Each partner as a dossier card (crest, league, months left, cost/month, players placed with minutes). 'Hitta samarbetsklubb' is a 3-step guided flow: board search → choose candidate → terms with total cost preview. |
| Layout | Card row of partners → 'Ny partner' card → placements list → history accordion. |
| Information hierarchy | Partners and their players → next action. |
| Interactions | Guided flow in a drawer; Förläng/Avsluta with consequence line and confirm. |
| Navigation | Klubben → Partnerskap. |
| Desktop | Cards 3-up. |
| Mobile | Stacked cards; flow full-screen. |
| Advantages | Decisions feel weighty, consequences previewed; Imagery via crests only |
| Disadvantages | More components than A |
| Complexity / perf | M / Low |
| Works with | CLB-02, CLB-04, CLB-05 |
| Fits identities | C, A |
| Patterns | Predictive consequence preview; Fewer, weightier conversations |

### CLB-03a · Partner search & agreement form

**Current:** Panel switching between four states (active/searching/candidates/start) with radio candidate list and inline form; termination is one click.

**Recommendation:** A — A stepper with cost preview matches the decision's weight and makes the termination reversible-until-confirmed.

**Priority:** P2 · **Dependencies:** Confirm dialog, Consequence preview component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Three-step Drawer

| | |
|---|---|
| Visual concept | Sök → Välj kandidat (cards with crest, league, distance) → Villkor (cost/month × months = total; board note) → Ingå avtal. |
| Layout | Drawer with stepper. |
| Information hierarchy | Current step. |
| Interactions | Back/next; confirm. |
| Navigation | Opens from CLB-03. |
| Desktop | Right drawer 480px. |
| Mobile | Full-screen steps. |
| Advantages | Clear; Cost visible before commit |
| Disadvantages | One more click than today |
| Complexity / perf | S / Low |
| Works with | CLB-03 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Board Message Decision

| | |
|---|---|
| Visual concept | The board's candidate search result arrives in the inbox as a decision message with candidates as inline choices. |
| Layout | Inbox reader decision block. |
| Information hierarchy | Candidates. |
| Interactions | Choose + terms inline. |
| Navigation | WLD-01. |
| Desktop | Reader. |
| Mobile | Reader. |
| Advantages | Fits event→decision chain |
| Disadvantages | Harder to compare candidates in a message |
| Complexity / perf | S / Low |
| Works with | WLD-01b |
| Fits identities | C |
| Patterns | Inbox as task queue |

### CLB-03b · Placement & international loan panels

**Current:** Panel with player table + per-row Place buttons; loan panel with select, % input, date and submit. Rows text only; tables overflow on phones.

**Recommendation:** A — A player list with the info that decides a placement (age, position, minutes this season) is enough; drag-drop adds little for few players.

**Priority:** P3 · **Dependencies:** Player minutes data, Scroll wrappers

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Placement List

| | |
|---|---|
| Visual concept | Rows with face/monogram, position, age, minutes this season and Placera/Kalla tillbaka; loan form in a drawer. |
| Layout | List + drawer. |
| Information hierarchy | Low-minute young players first. |
| Interactions | Row action; drawer form. |
| Navigation | Player Peek. |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | Decision-relevant columns |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | CLB-03 |
| Fits identities | A |
| Patterns | Bulk actions + notes on entities |

#### B — Drag to Partner

| | |
|---|---|
| Visual concept | Drag player chips onto partner cards; drop shows a preview of terms. |
| Layout | Players column + partner cards. |
| Information hierarchy | Partners. |
| Interactions | Drag/drop with keyboard alternative. |
| Navigation | Same. |
| Desktop | Two columns. |
| Mobile | Tap player → choose partner sheet. |
| Advantages | Tactile |
| Disadvantages | Accessibility work; Few items |
| Complexity / perf | M / Low |
| Works with | CLB-03 |
| Fits identities | B |

### CLB-04 · Other club profile

**Current:** ClubHero + four facts + partnership note; then ClubContext, Trupp, Matcher, Personal, Klubbidentitet (7 domains) and Tränarfilosofi (6 domains), knowledge-gated, all with the same visual weight. Back uses router.back().

**Recommendation:** C — Other clubs are opened constantly from tables, fixtures and news; a Peek-first profile answers most lookups without leaving context, and the full page reads as an opponent portrait where knowledge tier visibly fogs what you don't know.

**Priority:** P1 · **Dependencies:** Peek drawer, Knowledge tier presentation (fog), CLB-02a timeline, Head-to-head from fixtures

**Arena Nights (owner identity, 2026-11-13):** adapt → *Peek-first Scout Card* — Peek drawer unchanged. Full page keeps headline sentence + identity + philosophy + squad/fixtures; headline in condensed display; prose split into short statements; unknown claims as blurred glass lines (fog of war). _Conflict:_ 'Öppna hela' opens an editorial portrait (headline sentence, prose identity, quotes).

#### A — Opponent Dossier Tabs

| | |
|---|---|
| Visual concept | Tabbed dossier: Översikt (facts, form, H2H, key players) · Trupp (sortable table) · Matcher · Identitet (claims + coach philosophy) with a knowledge meter. |
| Layout | Header + URL tabs. |
| Information hierarchy | Översikt KPIs → key players → H2H. |
| Interactions | Sortable tables; knowledge meter tooltip 'Mer info kräver scouting'. |
| Navigation | Explicit back link to origin; Peek from anywhere. |
| Desktop | Dense tables. |
| Mobile | Tabs scroll; tables → ranked cards. |
| Advantages | Efficient for scouting opponents; Fixes equal-weight stacking |
| Disadvantages | Generic; no personality |
| Complexity / perf | M / Low |
| Works with | CLB-02a, MGR-03 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting; Hover cards for every entity |

#### B — Broadcast Club Profile

| | |
|---|---|
| Visual concept | The UI re-tints to the club's colours: big crest, arena image, three key player busts, style badges ('6-0 försvar', 'snabba kontringar'), rivalry status. |
| Layout | Hero band → busts → badges → schedule. |
| Information hierarchy | Identity → stars. |
| Interactions | Bust → player Peek. |
| Navigation | Top hub bar. |
| Desktop | Full-bleed. |
| Mobile | Swipe cards. |
| Advantages | Rivals feel distinct |
| Disadvantages | needs new data: player busts/portraits; Depth hidden |
| Complexity / perf | L / High |
| Works with | WLD-02c |
| Fits identities | B |

#### C — Peek-first Portrait

| | |
|---|---|
| Visual concept | Peek drawer (crest, position, form strip, next meeting, H2H, knowledge tier) handles most lookups; 'Öppna hela' gives an editorial portrait: headline sentence ('Ystad spelar 3-2-1 och lever på kontringar'), identity as prose, coach philosophy as quotes, squad and fixtures below; unknown claims shown as fogged lines. |
| Layout | Drawer 420px / full page 8/4 portrait. |
| Information hierarchy | Who they are → how they play → what you don't know yet. |
| Interactions | Peek from any mention; fogged lines link to 'Scouta klubben'. |
| Navigation | Peek keeps context; full page with real back link. |
| Desktop | Drawer + portrait page. |
| Mobile | Bottom sheet → full screen. |
| Advantages | Fewest navigation round trips; Knowledge fog motivates scouting |
| Disadvantages | Prose generation from claims; Two layouts |
| Complexity / perf | M / Low |
| Works with | CLB-04a, CLB-02a, WLD-02c, MGR-03 |
| Fits identities | C, A |
| Patterns | Hover cards for every entity; Attribute bars + numbers, fogged by scouting; Traits as personality |

### CLB-04a · Club identity & coach philosophy panels

**Current:** Two panels with grouped claim lists by domain label (7 identity domains, 6 coach domains) and empty states; reads like database fields.

**Recommendation:** B — Claims are categorical, not numeric; turning them into short sentences with a knowledge indicator is truer to the data than a radar.

**Priority:** P2 · **Dependencies:** Knowledge tier, Copy templates per claim

**Arena Nights (owner identity, 2026-11-13):** token — Structure unchanged; Arena Nights tokens and the club accent restyle it. No paper-specific dependency found.

#### A — Identity Wheel

| | |
|---|---|
| Visual concept | A wheel of the 7 identity domains, each segment labelled with its claim; unknown segments fogged. |
| Layout | Wheel + legend. |
| Information hierarchy | Known segments. |
| Interactions | Segment hover → claim detail. |
| Navigation | — |
| Desktop | Card. |
| Mobile | List fallback. |
| Advantages | Visual signature per club |
| Disadvantages | Implies numeric scale the data lacks |
| Complexity / perf | M / Low |
| Works with | CLB-04 |
| Fits identities | A, B |
| Patterns | Attribute bars + numbers, fogged by scouting |

#### B — Profile in Words

| | |
|---|---|
| Visual concept | Sentences per domain ('Ungdom: bygger på egna juniorer'), coach philosophy as pull quotes; unknown domains shown as 'Okänt — scouta för att veta mer'. |
| Layout | Two prose columns. |
| Information hierarchy | Strongest traits first. |
| Interactions | Unknown line → scouting. |
| Navigation | Scouting. |
| Desktop | Columns. |
| Mobile | Stack. |
| Advantages | Readable, honest to data |
| Disadvantages | Copy work |
| Complexity / perf | S / Low |
| Works with | CLB-04 |
| Fits identities | C |
| Patterns | Traits as personality |

### CLB-05 · Styrelserummet (Board)

**Current:** Boardroom photo hero (verdict stamp if a meeting in the last 21 days), then a 2×2 grid: Förtroende (meter, trend sparkline with warning/dismissal lines, factor list), Säsongens mål (status pills, why, progress), Kontraktet (dl + DecisionCard), Möten (protocol list). Board members are faceless; thresholds in dense text.

**Recommendation:** C — The board is a relationship over time. A minutes-led page shows verdict → reasons → required action → outcome chronologically, which is exactly the event→decision→consequence chain; A's factor waterfall and objective meters are embedded in its header so clarity is not lost.

**Priority:** P1 · **Dependencies:** Dual meter component, Decision card with consequence preview, Event chain presentation, CLB-05a/b, Board pressure stages (STABLE→CONCERN→WARNING→CRITICAL→DISMISSAL)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Confidence Cockpit

| | |
|---|---|
| Visual concept | A cockpit for one number: confidence gauge with target, trend chart with the warning and dismissal thresholds drawn as lines, a factor waterfall (+/− points by label), objective progress bars (target vs minimum), contract box. |
| Layout | Gauge + trend (8/12) \| pressure stage ladder (4/12) → factor waterfall → objectives → contract + meetings. |
| Information hierarchy | Distance to the next threshold → biggest factors → objectives at risk. |
| Interactions | Hover factor → which matches/months caused it; objective → source page. |
| Navigation | Klubben → Styrelsen tab. |
| Desktop | Chart-forward. |
| Mobile | Gauge + stage chip, then factors as list. |
| Advantages | Maximal clarity of 'why'; Thresholds visual instead of paragraph |
| Disadvantages | Cold; board as a number |
| Complexity / perf | M / Low |
| Works with | DSH-01j, MGR-01 |
| Fits identities | A |
| Patterns | Mood hub with causes; Predictive consequence preview |

#### B — Boardroom Table

| | |
|---|---|
| Visual concept | A scene: the board table with seats for chair, finance director and sporting director, each with a mood; meetings play as short dialogue with your reply options. |
| Layout | Scene illustration + dialogue panel. |
| Information hierarchy | Mood faces → current topic. |
| Interactions | Dialogue choices for recovery plan / contract. |
| Navigation | Opens as moment on meeting days. |
| Desktop | Full-bleed scene. |
| Mobile | Portrait dialogue. |
| Advantages | Personifies the board; Meetings memorable |
| Disadvantages | needs new data: named board members with individual moods and dialogue; Repetition fatigue risk |
| Complexity / perf | XL / High |
| Works with | CLB-05b |
| Fits identities | B |
| Patterns | Staff as faces of systems; Fewer, weightier conversations |

#### C — Board Minutes

| | |
|---|---|
| Visual concept | The page is the protocol of your relationship with this board: a header with the dual meter (Förtroende now / Rykte), pressure stage and objective meters; below, dated minutes — each meeting a stamped entry (SEASON_START, MID_SEASON, WARNING, SEASON_REVIEW…) with summary, what was demanded, what you did (recovery plan agreed, contract signed) and how it ended (MET/FAILED). |
| Layout | Header strip → open decision (if any) pinned → minutes timeline (newest first) → contract box in rail. |
| Information hierarchy | Open decision → current standing → the story so far. |
| Interactions | Entries expand to show factors at that time; recovery plan entry shows baseline vs now; contract offer resolved inline. |
| Navigation | Klubben → Styrelsen; entries link to matches/finance months. |
| Desktop | 8/4 editorial layout with stamps. |
| Mobile | Header chips → pinned decision → timeline. |
| Advantages | Consequences are visible over time; Feeds the manager biography; No new data — meetings, verdicts and plans exist |
| Disadvantages | Timeline sparse early in a stint; Relies on good summaries |
| Complexity / perf | M / Low |
| Works with | CLB-05a, CLB-05b, MGR-01, DSH-01j, WLD-01 |
| Fits identities | C, A |
| Patterns | Dual meters; Mood hub with causes; Pre-season directive meeting |

### CLB-05a · Board verdict hero

**Current:** MomentHero with tone (gold/ink/loss), stamp (Nöjd/Godkänt/Oroad/Varning/Avsked), headline and lede; same photo for every verdict; visible for 21 days.

**Recommendation:** B — A verdict is news the day it lands; show it once as a moment, then let it settle into a compact stamp band so the page isn't dominated by a three-week-old hero.

**Priority:** P2 · **Dependencies:** Floodlight moment shell, G5 motion budget

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Stamp Band

| | |
|---|---|
| Visual concept | A compact band with the stamp, headline and date; tone-specific colour and icon instead of one photo. |
| Layout | Band 96px. |
| Information hierarchy | Stamp. |
| Interactions | → minutes entry. |
| Navigation | — |
| Desktop | Band. |
| Mobile | Band. |
| Advantages | Cheap; Honest hierarchy |
| Disadvantages | Undersells big verdicts |
| Complexity / perf | S / Low |
| Works with | CLB-05 |
| Fits identities | A, C |

#### B — Verdict Moment then Band

| | |
|---|---|
| Visual concept | On the meeting day the verdict plays as a short Floodlight moment (stamp slams, factors listed, confidence delta), then collapses to the stamp band for the rest of the window. |
| Layout | Full-screen once → band. |
| Information hierarchy | Stamp → delta → demand. |
| Interactions | Skip; 'Till protokollet'. |
| Navigation | Continue pauses on the day. |
| Desktop | Overlay. |
| Mobile | Portrait overlay. |
| Advantages | Weight where it belongs; Verdict-specific tone without new photos |
| Disadvantages | Must not block quick play (skippable) |
| Complexity / perf | M / Medium |
| Works with | CLB-05, DSH-01 |
| Fits identities | B, C |
| Patterns | Fewer, weightier conversations |

### CLB-05b · Recovery-plan & contract-offer decision cards

**Current:** DecisionCard (title, deadline pill, primary with consequence line, secondary) inside dense panels; easy to miss though it blocks Continue ('Styrelsemöte').

**Recommendation:** B — A warning or contract offer is a meeting; when it blocks time it should be the meeting, with the consequence of each answer previewed.

**Priority:** P1 · **Dependencies:** Continue state machine (blocked reason opens this), Consequence preview, WLD-01 inline resolution

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Pinned Decision Bar

| | |
|---|---|
| Visual concept | Pin the decision at the top of the board page and in Today's decision column with deadline and both options' consequences. |
| Layout | Full-width card. |
| Information hierarchy | Deadline → options. |
| Interactions | Choose inline. |
| Navigation | Continue tooltip links here. |
| Desktop | Card. |
| Mobile | Sticky card. |
| Advantages | Hard to miss; Cheap |
| Disadvantages | No sense of occasion |
| Complexity / perf | S / Low |
| Works with | DSH-01, CLB-05 |
| Fits identities | A |
| Patterns | Inbox as task queue; Predictive consequence preview |

#### B — Meeting Moment

| | |
|---|---|
| Visual concept | Continue opens 'Styrelsemöte' as a modal scene: board's statement, your options as cards (Lämna handlingsplan / Skriv på / Tacka nej) with consequence preview (confidence, wage, years, reputation note), then the minute is written. |
| Layout | Modal: statement → option cards → confirmation. |
| Information hierarchy | Statement → options. |
| Interactions | Choose; confirm; result toast linking to minutes. |
| Navigation | Returns to where Continue was pressed. |
| Desktop | Centered 720px modal (Floodlight). |
| Mobile | Full-screen sheet. |
| Advantages | Matches stakes; Consequence preview prevents gotchas |
| Disadvantages | Modal fatigue if overused — only for board meetings |
| Complexity / perf | M / Low |
| Works with | CLB-05, WLD-01b, MGR-01 |
| Fits identities | C, B |
| Patterns | Predictive consequence preview; Fewer, weightier conversations |

### CLB-06 · Finanscentralen (Finance)

**Current:** Status band (H1, headline sentence, status pill, Kassa / Senaste månad / Prognos 31 maj) + 6 URL tabs, each a 2-col grid of panels with SVG charts and long numeric tables. Budget decision buried in tab 3; warnings don't link to fixes.

**Recommendation:** A — Finance is consulted often and briefly; players want 'can I afford it and what is going wrong'. A cockpit with three KPIs, actionable warnings and the budget decision on top, with accounting collapsed into Detaljer, beats atmosphere here — and its warnings plug into the event chain.

**Priority:** P1 · **Dependencies:** CLB-06 tab restructure (Översikt · Budget · Detaljer), Actionable warning links (sell/loan/renegotiate), Contracts page merge for wages

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Finance Cockpit

| | |
|---|---|
| Visual concept | Three KPIs (Kassa, Lönerum, Prognos säsongsslut) with deltas, the cash line (actual + projected with board floor line), warnings as action cards ('Lönerna 8 % över budget → Se kontrakt'), and the budget reallocation as the one decision. Ledger, wages and forecast tables collapse into 'Detaljer'. |
| Layout | KPI strip → cash chart (8/12) + warnings/actions (4/12) → budget reallocation → Detaljer accordion (Huvudbok, Löner, Prognos). |
| Information hierarchy | Is cash heading below the floor? → what to do → details. |
| Interactions | Warnings have one verb each; chart hover shows month; Detaljer sections lazy-load. |
| Navigation | Klubben → Ekonomi; deep links ?section=. |
| Desktop | Chart-forward cockpit. |
| Mobile | KPIs 1×3 swipe, chart full width, actions as cards; tables as month cards. |
| Advantages | Fast answers; Decision no longer buried; Warnings close the loop to actions |
| Disadvantages | Accounting fans lose a click; Least atmospheric |
| Complexity / perf | M / Low |
| Works with | CLB-02b, CLB-05, DSH-01 |
| Fits identities | A, C |
| Patterns | Control panel per area; Predictive consequence preview; Inform vs navigate separation |

#### B — Matchday Money

| | |
|---|---|
| Visual concept | Finance through the arena: an arena silhouette fills per home match (occupancy), revenue streams as stands (biljetter, sponsorer, TV, försäljning), wage bill as the team bench. |
| Layout | Arena illustration + stands → match-by-match fill strip → summary. |
| Information hierarchy | Arena fill → revenue streams. |
| Interactions | Click a stand → category detail; match → gate revenue. |
| Navigation | Klubben → Ekonomi. |
| Desktop | Illustrated. |
| Mobile | Stacked bars instead of illustration. |
| Advantages | Connects money to football; Memorable |
| Disadvantages | Hides cash risk; Illustration cost; Budget decision still needs a home |
| Complexity / perf | L / Medium |
| Works with | CLB-06b |
| Fits identities | B |

#### C — Monthly Report

| | |
|---|---|
| Visual concept | Each month-end produces a finance article ('Januari: publiken lyfte kassan') with one chart, the month's big items and a forecast paragraph; the page is the latest report plus an archive. |
| Layout | Article + archive list; budget decision as sidebar card. |
| Information hierarchy | Headline → chart → items. |
| Interactions | Archive month → report. |
| Navigation | Linked from inbox month-end message. |
| Desktop | Editorial article. |
| Mobile | Article. |
| Advantages | Explains rather than lists; Fits event chain (month-end → report) |
| Disadvantages | Slower lookups; Copy generation |
| Complexity / perf | M / Low |
| Works with | WLD-01, CLB-06d |
| Fits identities | C |
| Patterns | Dated, categorised news |

### CLB-06a · Tab · Översikt

**Current:** Line chart (12 actual + 9 projected months), warnings panel with text cards, season summary panel.

**Recommendation:** A — The overview should end every warning in a verb.

**Priority:** P1 · **Dependencies:** Action link mapping per warning type

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Chart + Action Cards

| | |
|---|---|
| Visual concept | Cash chart with board floor and projection band; warnings as cards with tone, consequence and one action. |
| Layout | 8/4. |
| Information hierarchy | Floor breach → action. |
| Interactions | Action buttons; chart hover. |
| Navigation | Deep links. |
| Desktop | 8/4 grid. |
| Mobile | Stack. |
| Advantages | Closes the loop |
| Disadvantages | Needs action mapping |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | A |
| Patterns | Predictive consequence preview |

#### B — Status Sentence

| | |
|---|---|
| Visual concept | One sentence verdict ('Kassan räcker till maj, men lönerna äter marginalen') + small chart + actions. |
| Layout | Sentence hero + chart. |
| Information hierarchy | Sentence. |
| Interactions | Actions. |
| Navigation | — |
| Desktop | Hero. |
| Mobile | Hero. |
| Advantages | Readable |
| Disadvantages | Less precise |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | C |

### CLB-06b · Tab · Intäkter & kostnader

**Current:** Two CategoryBars panels (income/costs) + 5-col match table with crest, attendance, occupancy fill bar and revenue.

**Recommendation:** A — Category bars are fine; the matchday table becomes an arena-fill strip that reads at a glance.

**Priority:** P2 · **Dependencies:** —

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Bars + Arena Fill Strip

| | |
|---|---|
| Visual concept | Income/cost bars side by side; home matches as a strip of fill gauges with opponent crest (derbies stand out). |
| Layout | Two bars → strip. |
| Information hierarchy | Biggest category → best gates. |
| Interactions | Gauge hover → numbers. |
| Navigation | Match report. |
| Desktop | Grid. |
| Mobile | Stack; strip scrolls. |
| Advantages | Compact, visual |
| Disadvantages | Exact numbers on hover only |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | A, C |

#### B — Flow Diagram

| | |
|---|---|
| Visual concept | Sankey-lite: income categories → kassa → cost categories. |
| Layout | Single diagram. |
| Information hierarchy | Widest flows. |
| Interactions | Hover flow. |
| Navigation | — |
| Desktop | Wide diagram. |
| Mobile | Falls back to bars. |
| Advantages | Shows balance at once |
| Disadvantages | Hard to read for small categories |
| Complexity / perf | M / Low |
| Works with | CLB-06 |
| Fits identities | A |

### CLB-06c · Tab · Budget

**Current:** Panel 'Budgeten' with board frames and up to 15% reallocation via StackedBars; hidden in the third tab — the only decision in Finance.

**Recommendation:** A — Sliders with live consequence preview and board-frame markers make the 15% rule visible; the same component can appear in the season-start board meeting.

**Priority:** P1 · **Dependencies:** Consequence preview, CLB-05 season-start meeting

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Reallocation Sliders

| | |
|---|---|
| Visual concept | One slider per area (trupp, personal, ungdom, anläggning…) with board frame markers and a running ±15% budget; preview line ('+4 % trupp → ~1 extra kontrakt på 18 000 €/mån'). |
| Layout | Slider list + summary. |
| Information hierarchy | Remaining margin. |
| Interactions | Drag/keyboard; Bekräfta plan. |
| Navigation | Top of Ekonomi; also in season-start meeting. |
| Desktop | Form. |
| Mobile | Stepper buttons instead of drag. |
| Advantages | Rule visible; Decision promoted |
| Disadvantages | Preview line needs mapping |
| Complexity / perf | M / Low |
| Works with | CLB-06, CLB-05 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview; Pre-season directive meeting |

#### B — Board Meeting Only

| | |
|---|---|
| Visual concept | Budget set only in the season-start meeting as part of the directive ritual; Finance shows it read-only. |
| Layout | Meeting step. |
| Information hierarchy | Proposal. |
| Interactions | Accept/adjust. |
| Navigation | CLB-05. |
| Desktop | Modal. |
| Mobile | Sheet. |
| Advantages | Ritual weight |
| Disadvantages | Removes mid-season flexibility if the system allows it |
| Complexity / perf | S / Low |
| Works with | CLB-05b |
| Fits identities | B, C |
| Patterns | Pre-season directive meeting |

### CLB-06d · Tab · Huvudbok (ledger)

**Current:** Month selector + statement table with category swatches, one-offs and opening/closing cash.

**Recommendation:** A — Accordion months keep the ledger available without dominating.

**Priority:** P3 · **Dependencies:** —

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Month Accordion

| | |
|---|---|
| Visual concept | Months as rows with net result and sparkline; expand to the statement. |
| Layout | Accordion list. |
| Information hierarchy | Net per month. |
| Interactions | Expand. |
| Navigation | Detaljer. |
| Desktop | List. |
| Mobile | Same. |
| Advantages | Scannable |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | A |

#### B — Statement Sheet

| | |
|---|---|
| Visual concept | Keep a full statement table with sticky header and category sparklines. |
| Layout | Table. |
| Information hierarchy | Totals. |
| Interactions | Month select. |
| Navigation | — |
| Desktop | Table. |
| Mobile | Scroll-x. |
| Advantages | Familiar |
| Disadvantages | Dense |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | A |

### CLB-06e · Tab · Lönekontrakt

**Current:** Commitments-per-season panel, staff costs panel and a 4-col wage table; overlaps the Contracts page.

**Recommendation:** A — Wages belong with contracts in Laget; Finance keeps only the commitment curve.

**Priority:** P2 · **Dependencies:** Contracts page (part B)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Merge into Kontrakt

| | |
|---|---|
| Visual concept | Wage list lives on the Contracts page; Finance shows commitments per future season as stacked bars with link. |
| Layout | One chart + link. |
| Information hierarchy | Future commitments. |
| Interactions | → Kontrakt. |
| Navigation | Laget hub. |
| Desktop | Chart. |
| Mobile | Chart. |
| Advantages | Removes duplicate |
| Disadvantages | Cross-hub link |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | A, C |
| Patterns | Inform vs navigate separation |

#### B — Wage Structure

| | |
|---|---|
| Visual concept | Players as bars sorted by wage, grouped by position, with contract end markers. |
| Layout | Bar chart + list. |
| Information hierarchy | Top earners. |
| Interactions | Bar → Peek. |
| Navigation | — |
| Desktop | Chart. |
| Mobile | List. |
| Advantages | Shows structure |
| Disadvantages | Still duplicates Kontrakt |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | A |

### CLB-06f · Tab · Prognos

**Current:** Projected cash line, assumptions panel, wide month-by-month table and calibration note.

**Recommendation:** B — A fan chart with plain-language assumptions communicates uncertainty without a wide table.

**Priority:** P3 · **Dependencies:** —

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — What-if Sliders

| | |
|---|---|
| Visual concept | Adjust assumptions (publik, sponsorintäkt, försäljning) and see the projection move. |
| Layout | Chart + sliders. |
| Information hierarchy | End cash. |
| Interactions | Sliders. |
| Navigation | — |
| Desktop | 8/4. |
| Mobile | Stack. |
| Advantages | Exploratory |
| Disadvantages | needs new data: forecast function accepting adjusted assumptions |
| Complexity / perf | M / Low |
| Works with | CLB-06 |
| Fits identities | A |
| Patterns | Predictive consequence preview |

#### B — Fan Chart + Assumptions

| | |
|---|---|
| Visual concept | Projection drawn as a band, assumptions listed as sentences, month table collapsed. |
| Layout | Chart → assumptions → table accordion. |
| Information hierarchy | Band at season end. |
| Interactions | Expand table. |
| Navigation | — |
| Desktop | Chart. |
| Mobile | Chart. |
| Advantages | Honest about uncertainty |
| Disadvantages | Band width must be meaningful |
| Complexity / perf | S / Low |
| Works with | CLB-06 |
| Fits identities | A, C |

## SQD — Squad & players

### SQD-01 · Truppen & Omklädningsrummet (squad list) — HI-FI prototype `squad`

**Current:** Dressing-room photo banner with 3 metric tiles, a 7-card SquadDepth strip, 4 tab buttons and one horizontally scrolling roster table (~19 columns on Översikt). Compare and captaincy hide behind a max-2 checkbox aside; position chips are duplicated below the table.

**Recommendation:** A — The squad list is the most-used workspace; a matrix with saved views and player chips removes the 19-column scroll, makes readiness scannable and adds the missing bulk actions. Ship the Depth Chart (C) as the SQD-01f panel on top of it rather than as the whole page.

**Priority:** P0 · **Dependencies:** G2 navigation model (Laget hub tabs), Player chip component (energy/MF/morale/form micro-visuals), Peek drawer, SQD-01f depth chart, Saved views persistence

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Squad Matrix

| | |
|---|---|
| Visual concept | A dense, sortable roster where every row starts with a "player chip" (shirt number, name, position, energy bar, match-fitness band pip, morale dot, 5-match form sparkline). The four hard tabs become saved views (Matchberedskap, Prestation, Kontraktsrisk, Utveckling) with a column chooser; a multi-select tray carries actions. |
| Layout | Control panel row (view switcher, search, position segmented filter V6–MV, state filter, density toggle); full-width roster table with 8 default columns; sticky selection tray at the bottom when rows are selected. |
| Information hierarchy | 1) Availability and readiness per row (chip colours, Tillgänglighet). 2) Squad role and season output (Trupproll, Betyg, Mål, Skott%/Räddn%). 3) Contract end and wage in the Kontraktsrisk view only. |
| Interactions | Sort any column (incl. Skott % and Räddn %); click/shift-click or tap-select rows; tray actions: Jämför (2), Sätt trupproll (bulk), Vila (sets REST load in training), Kapten / vice / 7 m, Transferlista; row click opens Peek drawer; saved custom views; ⌘K "visa trötta spelare". |
| Navigation | Laget hub › Truppen. Row → Peek → "Öppna profil" (SQD-02). Tray deep-links to /career/compare, /career/training (load) and /career/contracts with the player preselected. |
| Desktop | Fits 1280 px without horizontal scroll at 8 columns; Detailed density reveals up to 14; sticky header and sticky first column. |
| Mobile | Rows collapse to ranked cards showing the chip plus the current view's top 3 metrics; views become a horizontal chip scroller; selection tray becomes a bottom sheet; long-press = Peek. |
| Advantages | Ends horizontal scrolling on desktop; Readiness visible at a glance via chips; Bulk actions save many round trips; Saved views serve both casual and spreadsheet players |
| Disadvantages | Least atmospheric of the three; Column chooser and saved views add settings surface; Bulk "Vila" must respect injury/limited constraints already enforced on training |
| Complexity / perf | M / Low |
| Works with | SQD-02, SQD-04, SQD-05, TRN-01c, TRN-02 |
| Fits identities | A |
| Patterns | Density modes; Bulk actions + notes on entities; Hover cards for every entity; Control panel per area |

#### B — Locker Room

| | |
|---|---|
| Visual concept | The dressing room as the page: a wall of lockers, one per player, grouped in seven position bays. Each locker shows shirt number, portrait, a readiness ring (energy + match fitness), a morale glow and injury/suspension tags; the captain armband hangs in its owner's locker. |
| Layout | Full-bleed dressing-room hero with squad mood strip (average morale, average match fitness, available n/N, captain); below, 7 bays (MV, V6, V9, M9, M6, H9, H6) of locker cards; a side panel opens for the selected player. |
| Information hierarchy | 1) Who is out or tired (lockers dim, tags). 2) Squad mood and captaincy. 3) Stats on the back of the card. |
| Interactions | Tap a locker to flip it (back: season stats, Trupproll, Avtal till); long-press = Peek; drag the armband to another locker or tap "Gör till kapten"; filter dims non-matching lockers instead of hiding them. |
| Navigation | Locker → Athlete Spotlight profile; "Matrisvy" link switches to the Squad Matrix for sorting work. |
| Desktop | Seven bays as columns, lockers stacked; side panel 4/12 wide. |
| Mobile | Swipe between bays (one position per screen) with a 2-column locker grid; flip on tap; armband via action sheet. |
| Advantages | Strong emotional identity of "my squad"; Captaincy and mood become tangible; Great for screenshots and B identity |
| Disadvantages | Weak for sorting and comparing 20+ players; Needs new data: player portraits (asset pipeline); Flip cards hide data behind interaction |
| Complexity / perf | L / Medium |
| Works with | SQD-02, TRN-02h |
| Fits identities | B |
| Patterns | Mood hub with causes; Traits as personality; Hover cards for every entity |

#### C — Depth Chart

| | |
|---|---|
| Visual concept | A court-shaped depth chart: seven position slots on a handball court, each listing its depth (primary-position players, then secondary-position cover) with a readiness heat chip. A ledger column beside it summarises squad numbers; below, a compact list grouped by position. |
| Layout | Left 7/12: court with 7 slots; right 5/12: "Truppen i siffror" ledger (size, average match fitness, injuries with return dates, contracts ending ≤180 d); below: position-grouped list with chips. |
| Information hierarchy | 1) Positional gaps (slot turns warning when fewer than 2 available). 2) Who covers each slot. 3) Supporting numbers in the ledger. |
| Interactions | Tap a slot to filter the list; overlay toggle (Energi / Matchträning / Form / Avtal) recolours chips; tap a name for Peek; "Öppna i taktiktavlan" jumps to the same slot on TRN-02. |
| Navigation | Slot → TRN-02 court with that position focused; list rows → SQD-02. |
| Desktop | Court and ledger side by side; list below spans 12. |
| Mobile | Court becomes a vertical position list ("H6: Lindqvist · Ek · (Berg)") with heat chips; ledger collapses into a summary card at top. |
| Advantages | Answers "do I have cover at H6 on Saturday?" instantly; Shows secondary positions that are invisible today; Handball-specific, editorial feel |
| Disadvantages | Needs new data: an explicit depth order (or derive it from squad tier + ability); Weaker for contract and performance tasks; Court layout cramped for big squads |
| Complexity / perf | M / Low |
| Works with | SQD-01f, TRN-02, SQD-02k |
| Fits identities | C, A |
| Patterns | Inform vs navigate separation; Hover cards for every entity |

### SQD-01a · Tab "Översikt"

**Current:** Default roster tab showing the union of performance, physical and contract-end columns (~19 columns), the widest table in the game.

**Recommendation:** A — A curated 8-column summary with expandable rows keeps everything reachable without horizontal scroll; the readiness view (C) becomes a saved view in SQD-01.

**Priority:** P0 · **Dependencies:** SQD-01 Squad Matrix, Player chip component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Curated summary + expandable rows

| | |
|---|---|
| Visual concept | Översikt shows 8 columns: chip, Pos, Trupproll, readiness strip, Form (5M), Betyg, Mål or Räddn %, Avtal till. Expanding a row reveals the remaining stats inline. |
| Layout | Single table; expanded row shows a two-line detail band (performance left, physical right). |
| Information hierarchy | Chip and readiness first, output second, contract third. |
| Interactions | Click/tap row chevron to expand; keyboard ←/→ collapses/expands. |
| Navigation | Expanded band links to profile tabs (?tab=). |
| Desktop | No horizontal scroll at 1280 px. |
| Mobile | Cards with chip + 3 metrics; expand reveals the rest as key-value pairs. |
| Advantages | Scannable; Nothing removed, only deferred |
| Disadvantages | Expanded rows push content down |
| Complexity / perf | S / Low |
| Works with | SQD-01, SQD-02 |
| Fits identities | A, C |
| Patterns | Density modes |

#### B — Readiness cards

| | |
|---|---|
| Visual concept | Overview as a card grid sorted by availability, each card a large chip with energy ring, match-fitness band and next-match status. |
| Layout | Responsive card grid, 4–6 per row. |
| Information hierarchy | Availability, then readiness, then name. |
| Interactions | Tap card = Peek; select mode for bulk actions. |
| Navigation | Cards → SQD-02. |
| Desktop | 5 cards per row. |
| Mobile | 2 per row. |
| Advantages | Visual, touch-friendly |
| Disadvantages | Poor for comparing numbers across players |
| Complexity / perf | S / Low |
| Works with | SQD-01 |
| Fits identities | B |

#### C — Next-match readiness grouping

| | |
|---|---|
| Visual concept | Overview grouped into Tillgängliga / Tveksamma / Borta with return dates, followed by a contract-warning strip, framed as "Inför lördagens match". |
| Layout | Three grouped lists + warning strip. |
| Information hierarchy | Who can play next match, then risks. |
| Interactions | Tap a doubtful player to see reasons (load trend, outlook) inline, not in tooltips. |
| Navigation | Header links to MDY-01 match preview. |
| Desktop | Three columns. |
| Mobile | Stacked groups with sticky group headers. |
| Advantages | Directly tied to the next decision |
| Disadvantages | Not a general-purpose overview |
| Complexity / perf | S / Low |
| Works with | MDY-01, TRN-02 |
| Fits identities | C |
| Patterns | Pre-match ritual sequence |

### SQD-01b · Tab "Prestation"

**Current:** Prestation tab: M, Starter, Mål, Skott % / försök, Räddningar % / mötta, Betyg and a 5-match form sparkline; shot % and save % are not sortable.

**Recommendation:** A — Separating goalkeeper and outcourt metric sets and making every metric sortable fixes the real weakness with little cost.

**Priority:** P1 · **Dependencies:** SQD-01 Squad Matrix

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Position-aware stat tables

| | |
|---|---|
| Visual concept | Two stacked tables: Utespelare (M, Starter, Mål, Mål/match, Skott %, Betyg, Form) and Målvakter (M, Räddn %, Räddn/match, mötta skott, Betyg, Form); all sortable, per-match values derived from appearances. |
| Layout | Outcourt table above GK table. |
| Information hierarchy | Betyg and efficiency first. |
| Interactions | Sort, inline bars in numeric cells. |
| Navigation | Row → profile Prestation tab. |
| Desktop | Both tables fit without scroll. |
| Mobile | Cards per player with the 3 key metrics of their role. |
| Advantages | Correct metrics per role; Sortable efficiency |
| Disadvantages | Two tables instead of one |
| Complexity / perf | S / Low |
| Works with | SQD-02b |
| Fits identities | A |

#### B — Small multiples

| | |
|---|---|
| Visual concept | A grid of mini charts per player: rating line over the last matches and goal/save bars, sorted by average rating. |
| Layout | Grid of small multiples. |
| Information hierarchy | Trend shape first, numbers second. |
| Interactions | Tap a multiple to open the profile performance chart. |
| Navigation | → SQD-02b. |
| Desktop | 4 per row. |
| Mobile | 1 per row, swipeable. |
| Advantages | Shows form trends, not just totals |
| Disadvantages | Harder to read exact values; Uses per-match history only available via profile match log |
| Complexity / perf | M / Medium |
| Works with | SQD-02b, ANL-01 |
| Fits identities | C, B |

### SQD-01c · Tab "Fysisk status"

**Current:** Fysisk status tab with Energi %, Matchträning %, Belastning 7 d, Trend arrows, Återhämtning (reasons only in title tooltips), Tillgänglighet and Återkomst.

**Recommendation:** A — A readiness heat-strip with visible risk bands and reason chips makes the workload story legible and touch-accessible; the same strip is reused on training (TRN-01c).

**Priority:** P0 · **Dependencies:** Readiness heat-strip component (shared with TRN-01c, MDY-01), readinessSummary data

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Readiness heat-strip

| | |
|---|---|
| Visual concept | Each player row is a strip of coloured cells: Energi, Matchträning band (with 80 % full-effect marker), 7 d load vs 28 d average ratio, Trend, Utsikt; reasons appear as chips ("2 matcher på 4 dagar") rather than tooltips. |
| Layout | Table with heat cells + legend with explicit bands (Pigg ≥80, Något sliten ≥55, Trött). |
| Information hierarchy | Risk colour first, value second, reason third. |
| Interactions | Sort by risk; tap a reason chip for an explanation; row action "Vila / Reducerad" sets training load. |
| Navigation | Load action writes to TRN-01c; row → SQD-02h. |
| Desktop | Strip fits in 10 columns. |
| Mobile | Each player a compact card with a 5-segment strip and the worst reason chip. |
| Advantages | Reasons visible without hover; Unifies three load numbers into one story |
| Disadvantages | Requires agreeing one load semantics with TRN-01c and ANL-01c |
| Complexity / perf | M / Low |
| Works with | TRN-01c, MDY-01, SQD-02h |
| Fits identities | A, C |
| Patterns | Feedback zone bar; Predictive consequence preview |

#### B — Load quadrant board

| | |
|---|---|
| Visual concept | A scatter board: energy on x, 7-day load ratio on y, quadrants labelled Redo / Bevaka / Vila / Bygg upp; each dot is a player chip. |
| Layout | Chart 8/12 + selected player panel 4/12. |
| Information hierarchy | Clusters of risk first. |
| Interactions | Tap dot → panel with numbers and load action; lasso-select for bulk rest. |
| Navigation | → TRN-01c. |
| Desktop | Large chart. |
| Mobile | Chart full width with bottom sheet for the selected dot. |
| Advantages | Whole squad risk in one picture |
| Disadvantages | Overlapping dots with 20+ players; Exact values one tap away |
| Complexity / perf | M / Medium |
| Works with | TRN-01 |
| Fits identities | B, A |
| Patterns | Dual meters |

### SQD-01d · Tab "Kontrakt"

**Current:** Kontrakt tab with Avtal till, Lön / månad and an Åtgärd link that only opens the profile root; duplicates /career/contracts with fewer features.

**Recommendation:** B — Keeping contract risk one tap away inside the squad is useful, but the action must open the renewal itself, not the profile root.

**Priority:** P2 · **Dependencies:** SQD-01 saved views, Peek drawer, SQD-02n renewal component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Remove and deep-link

| | |
|---|---|
| Visual concept | Drop the tab; a "Kontrakt" control-panel link opens SQD-05 pre-filtered to the squad. |
| Layout | No tab; link in control panel. |
| Information hierarchy | — |
| Interactions | One click to contracts page. |
| Navigation | → SQD-05. |
| Desktop | Link button. |
| Mobile | Link in overflow menu. |
| Advantages | Removes duplication |
| Disadvantages | Contract context leaves the squad screen |
| Complexity / perf | S / Low |
| Works with | SQD-05 |
| Fits identities | A, C |
| Patterns | Inform vs navigate separation |

#### B — Kontraktsrisk view + renewal drawer

| | |
|---|---|
| Visual concept | A saved view sorted by days left with a countdown bar per row; "Förläng" opens the renewal flow (SQD-02n) in a drawer. |
| Layout | Table view + right drawer. |
| Information hierarchy | Days left, then wage, then status. |
| Interactions | Drawer renewal without leaving the squad. |
| Navigation | Drawer → "Öppna i Kontrakt" (SQD-05). |
| Desktop | Drawer 480 px. |
| Mobile | Full-screen sheet. |
| Advantages | Acts in context; Fixes the dead link |
| Disadvantages | Two places can start a renewal |
| Complexity / perf | S / Low |
| Works with | SQD-05, SQD-02n |
| Fits identities | A, C |
| Patterns | Inbox as task queue |

### SQD-01e · Selection aside "Spelardossier & jämförelse"

**Current:** An aria-live aside appears above the table when 1–2 rows are ticked, mixing captaincy and compare; the compare CTA sits in the panel header.

**Recommendation:** A — A floating tray with contextual actions separates selection from its jobs and scales to bulk actions.

**Priority:** P1 · **Dependencies:** SQD-01 Squad Matrix, TRN-02h roles editor

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Floating selection tray

| | |
|---|---|
| Visual concept | Bottom-docked tray listing selected chips and actions that adapt to the count (1: Kapten, Vila, Profil; 2: Jämför; n: Trupproll, Vila). |
| Layout | Sticky bottom bar. |
| Information hierarchy | Selected chips, then primary action. |
| Interactions | Remove chip to deselect; Esc clears. |
| Navigation | Jämför → SQD-04. |
| Desktop | Centred 720 px tray. |
| Mobile | Bottom sheet above the tab bar. |
| Advantages | Clear, scalable |
| Disadvantages | Must not cover the Continue button |
| Complexity / perf | S / Low |
| Works with | SQD-04, TRN-02h |
| Fits identities | A, C |
| Patterns | Bulk actions + notes on entities |

#### B — Inline duel preview

| | |
|---|---|
| Visual concept | With two players selected, a slim panel shows a radar overlay and 4 delta bars inline, with "Öppna full jämförelse". |
| Layout | Panel above table. |
| Information hierarchy | Visual diff first. |
| Interactions | Swap left/right. |
| Navigation | → SQD-04. |
| Desktop | Panel 12 wide, 160 px tall. |
| Mobile | Collapsible card. |
| Advantages | Compare without leaving |
| Disadvantages | Only covers the compare job |
| Complexity / perf | M / Low |
| Works with | SQD-04 |
| Fits identities | B, C |

### SQD-01f · Panel "Truppens balans" (SquadDepth)

**Current:** SquadDepth strip: "SJU POSITIONER. ETT LAG." with 7 position cards showing available/total; not clickable, ignores secondary positions.

**Recommendation:** B — The mini court makes coverage spatial and doubles as the position filter, removing the duplicated chip row.

**Priority:** P1 · **Dependencies:** Court component (shared with TRN-02), Secondary position data

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Clickable position counters

| | |
|---|---|
| Visual concept | Seven segmented counters (available/total + secondary cover count) that act as the position filter. |
| Layout | One row of 7 segments. |
| Information hierarchy | Counts first. |
| Interactions | Tap to filter, tap again to clear. |
| Navigation | Filters SQD-01 table. |
| Desktop | Row above the table. |
| Mobile | Horizontal scroller. |
| Advantages | Cheap, removes duplicate filter |
| Disadvantages | Not spatial |
| Complexity / perf | S / Low |
| Works with | SQD-01 |
| Fits identities | A |

#### B — Mini court depth

| | |
|---|---|
| Visual concept | Handball half-court with the 7 spots; each spot shows available/total and is coloured green/amber/red by cover, secondary cover as a small "+n". |
| Layout | Court band 220 px tall. |
| Information hierarchy | Red spots first. |
| Interactions | Tap spot filters; long-press lists the cover names. |
| Navigation | Filters SQD-01; "Taktiktavla" link → TRN-02. |
| Desktop | Court left, legend right. |
| Mobile | Compact court, tap = filter + sheet. |
| Advantages | Instant gap detection; Shared court language with tactics |
| Disadvantages | Takes vertical space |
| Complexity / perf | M / Low |
| Works with | SQD-01, TRN-02 |
| Fits identities | A, B, C |
| Patterns | Inform vs navigate separation |

### SQD-01g · Empty filter state

**Current:** "Inga spelare matchar dina filter." text under an empty table; the reset button is not repeated.

**Recommendation:** B — A helpful empty state explains why and offers both reset and the nearest result.

**Priority:** P3 · **Dependencies:** SQD-01

**Arena Nights (owner identity, 2026-11-13):** token — Structure unchanged; Arena Nights tokens and the club accent restyle it. No paper-specific dependency found.

#### A — Reset-first empty state

| | |
|---|---|
| Visual concept | Message plus the active filters as removable chips and one "Rensa filter" button. |
| Layout | Centred block in table area. |
| Information hierarchy | Active filters, then reset. |
| Interactions | Remove one chip or reset all. |
| Navigation | — |
| Desktop | Inline. |
| Mobile | Inline. |
| Advantages | Simple |
| Disadvantages | No explanation |
| Complexity / perf | S / Low |
| Works with | SQD-01 |
| Fits identities | A |

#### B — Explaining empty state

| | |
|---|---|
| Visual concept | Explains the zero ("0 tillgängliga V6 — 2 skadade, åter 14 nov") and shows the nearest matches plus reset. |
| Layout | Message + mini list. |
| Information hierarchy | Reason, then alternatives. |
| Interactions | Tap an alternative or reset. |
| Navigation | — |
| Desktop | Inline. |
| Mobile | Inline. |
| Advantages | Turns a dead end into information |
| Disadvantages | Needs reason logic per filter |
| Complexity / perf | S / Low |
| Works with | SQD-01 |
| Fits identities | C |

### SQD-02 · Spelarprofil (player dossier) — HI-FI prototype `player`

**Current:** One dossier for any player: photo PlayerHero, a flat action row, own-player Tillstånd panel, 6 local-state tabs that recombine the same blocks (ability in 3 tabs, body profile in 3), and a rail; CA/PA shown only as 1–5 stars and knowledge-gated ranges as text.

**Recommendation:** C — The profile is opened from every surface, so a Peek drawer for quick looks plus a full editorial page cuts navigation churn; the Feature Profile treats own and knowledge-gated players with the same layout (ranges tighten as knowledge grows). Embed the Dossier attribute matrix (A) inside its Egenskaper section.

**Priority:** P0 · **Dependencies:** Peek drawer, URL-addressable tabs (?tab=), Attribute matrix component (SQD-02j), Range bar component (SQD-02l), Person timeline data join

**Arena Nights (owner identity, 2026-11-13):** adapt → *Athlete Feature* — Same two-column profile: words-first strengths/weaknesses, attribute groups with potential bars, development, season ledger, Peek variant. Portrait framed in a club-neon radial glow; header with neon underline; headline in condensed display. _Conflict:_ Feature Profile is an editorial magazine profile (serif headline, double-rule header, framed paper portrait).

#### A — Dossier

| | |
|---|---|
| Visual concept | A two-column instrument: a sticky identity column (number, position, age, nation, status chips, contract, squad tier, knowledge meter for external) and a work column with four URL tabs: Översikt, Egenskaper & utveckling, Kontrakt & transfer, Historik. Attributes are a sequential-ramp matrix with deltas and a compare toggle. |
| Layout | Left 3/12 sticky identity column; right 9/12 tabbed workspace; compare toggle overlays a second player or squad average on the matrix. |
| Information hierarchy | 1) Status and role (availability, energy, morale). 2) Attribute matrix and ability band. 3) Contract and history. |
| Interactions | Tabs via ?tab=; compare picker (search) overlays deltas; hover/long-press any attribute for its development events (previous → new); one primary contextual CTA in the identity column. |
| Navigation | Other surfaces can deep-link (/career/squad/[id]?tab=kontrakt); prev/next player arrows within the current squad view. |
| Desktop | Identity column + 9-col matrix; no long scroll on Översikt. |
| Mobile | Identity collapses to a sticky compact bar; tabs become a segmented control; matrix becomes family accordions. |
| Advantages | Fast for power users; Deep-linkable tabs; Ends tab redundancy |
| Disadvantages | Least emotional; Dense on small phones |
| Complexity / perf | M / Low |
| Works with | SQD-01, SQD-04, REC-01, TRN-01 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting; User-chosen rating scale; Control panel per area |

#### B — Athlete Spotlight

| | |
|---|---|
| Visual concept | Broadcast-style hero: full-bleed portrait, giant name and shirt number in club colours, signature strengths as badges ("Kanonskott", "Läser spelet"), season stats as TV graphics (Mål, Skott %, Betyg), a career ribbon. Attributes live on a secondary tab. |
| Layout | Full-bleed hero (60 vh) → stat graphic band → strengths badges → career ribbon; tabs for Egenskaper, Kontrakt, Person. |
| Information hierarchy | 1) Identity and star quality. 2) Season numbers. 3) Detail on tabs. |
| Interactions | Scroll-driven stat count-ups (reduced-motion safe); tap a badge to see the attributes behind it; action dock with primary CTA. |
| Navigation | Entered from squad Locker Room and market cards; back returns to scroll position. |
| Desktop | Hero with portrait right, text left; stat band in 4 tiles. |
| Mobile | Portrait-first full screen, swipe up for stats; tabs as bottom sheet. |
| Advantages | Most "video game" feel; Celebrates star players |
| Disadvantages | Needs new data: portraits / likeness assets; Buries depth behind presentation; Weak for low-knowledge external players |
| Complexity / perf | L / High |
| Works with | SQD-01, MDY-02 |
| Fits identities | B |
| Patterns | Traits as personality; Broadcast camera / view switcher |

#### C — Feature Profile + Peek

| | |
|---|---|
| Visual concept | Editorial profile with a kicker ("Högersexa · #23 · 24 år") and headline, a Profile column of strengths/weaknesses in words, attribute groups with inline bars, an ability/potential band, a person timeline (morale factors, promises, talks, injuries, transfers) and a season ledger. A Peek drawer variant opens from any player mention. |
| Layout | Full page: header band → two columns (8/12 story: profile words, attribute groups, development timeline; 4/12 rail: condition, contract, scout report). Peek: 480 px right drawer with header, condition, top attributes, primary CTA, "Öppna hela profilen". |
| Information hierarchy | 1) Who he is and his state in words. 2) Attribute groups and development. 3) Contract, report, history in the rail and timeline. |
| Interactions | Peek from anywhere without losing context; ranges for external players drawn as error bars with inline "Scouta"; section anchors in a sticky mini-nav. |
| Navigation | Peek → full page; full page sections are URL anchors; person timeline items link to inbox threads and match reports. |
| Desktop | Two-column journal layout; Peek drawer over any page. |
| Mobile | Peek becomes a half-height bottom sheet that expands to the full profile; single column with sticky section headers. |
| Advantages | Works equally for own, external and retired players; Peek removes most full-page trips; Continuity with today's paper identity |
| Disadvantages | Editorial wording must be generated from data (copy quality risk); Two variants (Peek + page) to maintain |
| Complexity / perf | L / Low |
| Works with | SQD-01, SQD-03, REC-01, MDY-01, WLD-01 |
| Fits identities | C |
| Patterns | Hover cards for every entity; Attribute bars + numbers, fogged by scouting; Traits as personality; Mood hub with causes |

### SQD-02a · Tab "Profil & egenskaper" (overview)

**Current:** Profil & egenskaper tab: a 4-stat season strip, PlayerDynamicsPanel and the full 56-attribute grid; rail with ability, scout report, medical and a note — very long for own players.

**Recommendation:** A — A summary hero with key ratings answers the first question quickly and pushes grids to the Egenskaper section, ending the long scroll.

**Priority:** P0 · **Dependencies:** SQD-02, SQD-02j

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Key-ratings summary

| | |
|---|---|
| Visual concept | Ability/potential band, the 6 most role-relevant attributes, readiness gauges and the season strip on one screen. |
| Layout | Two rows: ratings + readiness; season strip + form. |
| Information hierarchy | Ability, then readiness, then season. |
| Interactions | "Visa alla egenskaper" jumps to the matrix. |
| Navigation | Anchors to Egenskaper / Historik. |
| Desktop | Fits one viewport. |
| Mobile | Stacked cards. |
| Advantages | Fast first read |
| Disadvantages | Role relevance needs a defined attribute subset per position |
| Complexity / perf | S / Low |
| Works with | SQD-02j, SQD-02h |
| Fits identities | A, C |
| Patterns | Tile to Card drill-down |

#### B — Storyline overview

| | |
|---|---|
| Visual concept | Three generated storyline cards (Form, Utveckling, Personen) each with one number and one sentence, then the season strip. |
| Layout | 3 cards + strip. |
| Information hierarchy | Stories first. |
| Interactions | Tap a story to jump to its section. |
| Navigation | Anchors. |
| Desktop | 3 columns. |
| Mobile | Swipeable cards. |
| Advantages | Engaging, editorial |
| Disadvantages | Copy generation quality risk |
| Complexity / perf | M / Low |
| Works with | SQD-02i, SQD-02d |
| Fits identities | C, B |
| Patterns | Traits as personality |

#### C — Decisions-first overview

| | |
|---|---|
| Visual concept | Opens with what needs deciding about this player (renewal window, open concern, transfer request, rest advice) as numbered decision cards, then the summary. |
| Layout | Decision list then summary. |
| Information hierarchy | Pending decisions first. |
| Interactions | Resolve inline. |
| Navigation | Links to inbox thread. |
| Desktop | Decision column 8/12. |
| Mobile | Decision cards top. |
| Advantages | Action-oriented |
| Disadvantages | Empty for most players most of the time |
| Complexity / perf | M / Low |
| Works with | WLD-01, SQD-02i, SQD-02n |
| Fits identities | A, C |
| Patterns | Inbox as task queue |

### SQD-02b · Tab "Prestation & historik"

**Current:** Prestation & historik: season strip, last-12-matches table and season history table; no charts; same component reused in Klubbhistorik.

**Recommendation:** A — A trend chart over the existing match log adds insight cheaply and links each match to its report.

**Priority:** P1 · **Dependencies:** SQD-02, ANL-01

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Trend chart + match log

| | |
|---|---|
| Visual concept | Rating line over the last 12 matches with goal/save bars; below, the match log with each row linking to the match report. |
| Layout | Chart over table; season history below. |
| Information hierarchy | Trend, then matches, then seasons. |
| Interactions | Tap a chart point = highlight the row; row → ANL-01. |
| Navigation | → /career/match-report/[id]. |
| Desktop | Chart 12 wide. |
| Mobile | Chart full width, log as cards. |
| Advantages | Shows form shape; Fixes missing drill-down |
| Disadvantages | Only 12 matches of history |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A, C |

#### B — Season ledger

| | |
|---|---|
| Visual concept | Editorial ledger of seasons with inline bars and career totals, current season expanded with its match log. |
| Layout | Ledger table with expandable current season. |
| Information hierarchy | Career arc first. |
| Interactions | Expand a season. |
| Navigation | Season → /career/history?season. |
| Desktop | Ledger 12 wide. |
| Mobile | Season cards. |
| Advantages | Career perspective |
| Disadvantages | Weaker for current form |
| Complexity / perf | S / Low |
| Works with | SQD-02f |
| Fits identities | C |

### SQD-02c · Tab "Egenskaper"

**Current:** Egenskaper tab: attribute grid with a rail of ability, body profile and scout report; a near-duplicate of the overview tab.

**Recommendation:** A — Merging attributes and development into one workspace removes the duplicate tab and gives attributes their history.

**Priority:** P1 · **Dependencies:** SQD-02j, SQD-02d

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Attributes & development workspace

| | |
|---|---|
| Visual concept | One section with the attribute matrix, deltas since last month and development events per attribute. |
| Layout | Matrix 9/12 + development rail 3/12. |
| Information hierarchy | Values, then changes. |
| Interactions | Tap attribute → its event history. |
| Navigation | Replaces tabs Egenskaper + Utveckling. |
| Desktop | Side by side. |
| Mobile | Family accordions with delta chips. |
| Advantages | One place for "how good, how improving" |
| Disadvantages | Bigger single section |
| Complexity / perf | M / Low |
| Works with | SQD-02j, SQD-02d, TRN-01d |
| Fits identities | A, C |
| Patterns | Progress reports on development plans |

#### B — Role lens

| | |
|---|---|
| Visual concept | Choose a role (attack/defence role proficiencies) and attributes reorder and highlight by relevance to it. |
| Layout | Role picker + reordered bars. |
| Information hierarchy | Relevant attributes first. |
| Interactions | Switch lens. |
| Navigation | Lens shared with SQD-04. |
| Desktop | Picker top, bars below. |
| Mobile | Same, stacked. |
| Advantages | Explains fit for a role |
| Disadvantages | Needs new data: exposed role→attribute weighting map |
| Complexity / perf | M / Low |
| Works with | SQD-04, TRN-02 |
| Fits identities | A |

### SQD-02d · Tab "Utveckling"

**Current:** Utveckling tab: current level and potential as star text ("★★★☆☆"), individual focus label (read-only) and the last 5 development events.

**Recommendation:** A — A progression visual with editable focus turns a read-only list into a development tool; flag the CA history need honestly.

**Priority:** P1 · **Dependencies:** SQD-02c workspace, TRN-01d, Individual focus write path

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Development curve + focus

| | |
|---|---|
| Visual concept | Non-numeric ability band over time against the potential ceiling band, event markers with attribute previous → new, and the individual focus as an editable segmented control. |
| Layout | Curve 8/12 + focus card 4/12; events list below. |
| Information hierarchy | Gap to potential, then recent growth, then focus. |
| Interactions | Change focus in place; tap a marker for the event. |
| Navigation | Focus syncs with TRN-01c. |
| Desktop | Side by side. |
| Mobile | Curve full width, focus as chips. |
| Advantages | Makes development visible; Removes trip to Training |
| Disadvantages | Needs new data: periodic ability snapshots for the curve (only events exist today) |
| Complexity / perf | M / Low |
| Works with | TRN-01c, TRN-01d |
| Fits identities | A, C |
| Patterns | Progress reports on development plans |

#### B — Growth ledger

| | |
|---|---|
| Visual concept | Development events as delta chips grouped by attribute family (e.g. "Avslut 12 → 13"), with stars as a graphic and a focus card. |
| Layout | Family groups + focus card. |
| Information hierarchy | Recent deltas first. |
| Interactions | Edit focus inline. |
| Navigation | Syncs with TRN-01c. |
| Desktop | Two columns. |
| Mobile | Stacked. |
| Advantages | Uses existing data only |
| Disadvantages | No trajectory |
| Complexity / perf | S / Low |
| Works with | TRN-01d |
| Fits identities | C, A |

### SQD-02e · Tab "Kontrakt"

**Current:** Kontrakt tab: contract panel with renewal flow, transfer status card and market value split across 3 panels; rail with club history and training compensation; no budget context.

**Recommendation:** A — One deal sheet with budget impact answers "can I afford to keep him?" in one place.

**Priority:** P1 · **Dependencies:** SQD-02n, Club wage budget data

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Deal sheet

| | |
|---|---|
| Visual concept | Single sheet: contract facts, market value (exact or range), renewal flow and a payroll/budget impact bar. |
| Layout | Facts row, budget bar, renewal panel. |
| Information hierarchy | Days left and value, then budget, then action. |
| Interactions | Renewal inline. |
| Navigation | Links SQD-05. |
| Desktop | Two-column sheet. |
| Mobile | Stacked sheet. |
| Advantages | One place for contract decisions |
| Disadvantages | Budget data must be joined in |
| Complexity / perf | M / Low |
| Works with | SQD-05, SQD-02n, SQD-02o |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Contract timeline

| | |
|---|---|
| Visual concept | A horizontal timeline from today to contract end with season boundaries, renewal window, promises and loan periods. |
| Layout | Timeline band + details below. |
| Information hierarchy | Time left first. |
| Interactions | Tap markers. |
| Navigation | Links SQD-05 Gantt. |
| Desktop | Full width. |
| Mobile | Vertical timeline. |
| Advantages | Shows timing clearly |
| Disadvantages | Less room for money detail |
| Complexity / perf | M / Low |
| Works with | SQD-05 |
| Fits identities | C, B |

### SQD-02f · Tab "Klubbhistorik"

**Current:** Klubbhistorik tab: club history entries by age, training compensation and PlayerPerformance repeated; rail body profile.

**Recommendation:** A — A career ribbon is the clearest form for club history and removes the repeated performance block.

**Priority:** P2 · **Dependencies:** SQD-02b

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Career ribbon

| | |
|---|---|
| Visual concept | Horizontal ribbon of clubs by age with crest chips and training-compensation shares as segment labels. |
| Layout | Ribbon + compensation table. |
| Information hierarchy | Clubs over time. |
| Interactions | Tap club → club page. |
| Navigation | → /career/clubs/[id]. |
| Desktop | Full width. |
| Mobile | Vertical list. |
| Advantages | Visual career story |
| Disadvantages | Few clubs for young players |
| Complexity / perf | S / Low |
| Works with | SQD-02b |
| Fits identities | C, B |

#### B — Merge into Historik

| | |
|---|---|
| Visual concept | Club history becomes a section of a single Historik tab with season ledger. |
| Layout | Section in Historik. |
| Information hierarchy | Seasons first. |
| Interactions | Anchors. |
| Navigation | Tab removed. |
| Desktop | Section. |
| Mobile | Section. |
| Advantages | One fewer tab |
| Disadvantages | Longer Historik |
| Complexity / perf | S / Low |
| Works with | SQD-02b |
| Fits identities | A |

### SQD-02g · PlayerHero + PlayerActions

**Current:** Photo hero band (name, number, position, age, nation, club colours, status, tier, captain/7m) followed by a flat row of 3–4 equal-weight buttons.

**Recommendation:** A — A sticky compact identity bar with one contextual primary CTA makes the next action obvious on every scroll position.

**Priority:** P0 · **Dependencies:** SQD-02, Peek drawer header (shared)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Sticky identity bar + primary CTA

| | |
|---|---|
| Visual concept | Header collapses to a sticky bar; one primary action chosen from state (own: "Förläng kontrakt" when expiring, "Svara på oro" on concern; external: "Scouta" when knowledge low, "Lägg bud" when high), others in an overflow menu. |
| Layout | Hero 160 px → sticky 56 px bar. |
| Information hierarchy | Name/number, status chips, primary CTA. |
| Interactions | Overflow menu for Jämför, Kortlista, Transferlista. |
| Navigation | CTA routes to REC-04 / SQD-02n / REC-01. |
| Desktop | Bar spans content width. |
| Mobile | Bar + floating CTA above tab bar. |
| Advantages | Clear next step |
| Disadvantages | CTA rules must be well defined |
| Complexity / perf | S / Low |
| Works with | REC-04, REC-01, SQD-04 |
| Fits identities | A, C |
| Patterns | Continue button as heartbeat; Control panel per area |

#### B — Spotlight hero + action dock

| | |
|---|---|
| Visual concept | Full-bleed portrait hero with name in giant type; actions in a dock at the hero bottom. |
| Layout | Hero 50 vh. |
| Information hierarchy | Portrait and name first. |
| Interactions | Dock buttons. |
| Navigation | Same targets. |
| Desktop | Portrait right. |
| Mobile | Portrait full screen. |
| Advantages | Immersive |
| Disadvantages | Needs new data: portraits; Pushes content down |
| Complexity / perf | M / High |
| Works with | SQD-02 |
| Fits identities | B |

#### C — Kicker header + numbered actions

| | |
|---|---|
| Visual concept | Editorial kicker and headline with actions as a numbered list of what this player needs from you. |
| Layout | Header + decision list on the right. |
| Information hierarchy | Headline, then decisions. |
| Interactions | Resolve or open. |
| Navigation | Links to inbox threads. |
| Desktop | Header 8 + list 4. |
| Mobile | Header then list. |
| Advantages | Narrative and actionable |
| Disadvantages | Empty list looks odd |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | C |
| Patterns | Inbox as task queue |

### SQD-02h · Panel "Tillstånd" (PlayerConditionPanel)

**Current:** Own-player Tillstånd panel: availability chip, state select, injury and rehab, return date, match-fitness band and two native <meter> bars.

**Recommendation:** A — A shared condition gauge set gives the same visual language for energy and match fitness in squad, profile and matchday.

**Priority:** P1 · **Dependencies:** Condition gauge component, SQD-01c, MDY-01

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Condition gauge set

| | |
|---|---|
| Visual concept | Energy ring, match-fitness bar with band labels and the 80 % full-effect marker, availability chip and rehab progress bar. |
| Layout | Row of 3 gauges. |
| Information hierarchy | Availability, energy, sharpness. |
| Interactions | Tap gauge for explanation. |
| Navigation | Shared with SQD-01c, MDY-01. |
| Desktop | Row. |
| Mobile | Row, smaller. |
| Advantages | Consistent visuals; Replaces inconsistent <meter> |
| Disadvantages | Component work |
| Complexity / perf | S / Low |
| Works with | SQD-01c, MDY-01, TRN-01c |
| Fits identities | A, B, C |
| Patterns | Feedback zone bar |

#### B — Readiness timeline

| | |
|---|---|
| Visual concept | A 28-day chart of daily load with energy line and the return date marker. |
| Layout | Chart with summary chips. |
| Information hierarchy | Trend first. |
| Interactions | Tap a day. |
| Navigation | Links TRN-01. |
| Desktop | Full width. |
| Mobile | Full width. |
| Advantages | Explains why he is tired |
| Disadvantages | Heavier than needed for a status panel |
| Complexity / perf | M / Low |
| Works with | TRN-01 |
| Fits identities | A |

### SQD-02i · Panel "Spelaren som person" (PlayerDynamicsPanel)

**Current:** Spelaren som person: morale meter with factor chips, intentions, concerns with options, transfer-request decision card, promises, bids, and transfer-list/release buttons with inline confirm; destructive release sits next to listing.

**Recommendation:** A — A mood hub with causes and a separated danger zone makes morale actionable and protects irreversible actions.

**Priority:** P1 · **Dependencies:** Decision card component, Confirm dialog

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Mood hub with causes

| | |
|---|---|
| Visual concept | Morale meter vs target with a factor waterfall (±points), open concerns/requests as decision cards, promises with status, and a separate "Riskzon" for release. |
| Layout | Meter + waterfall, decision cards, danger zone. |
| Information hierarchy | Mood and why, then decisions, then risks. |
| Interactions | Resolve cards inline; release behind a modal confirm. |
| Navigation | Links inbox threads. |
| Desktop | Two columns. |
| Mobile | Stacked. |
| Advantages | Shows the "because"; Safer destructive actions |
| Disadvantages | Waterfall needs careful labels |
| Complexity / perf | M / Low |
| Works with | WLD-01, SQD-02o |
| Fits identities | A, C |
| Patterns | Mood hub with causes; Demands as story beats |

#### B — Person timeline

| | |
|---|---|
| Visual concept | Chronological feed of talks, promises, concerns, bids and morale changes, with the current open item pinned on top. |
| Layout | Pinned card + feed. |
| Information hierarchy | Open item first. |
| Interactions | Respond on the pinned card. |
| Navigation | Items link to inbox. |
| Desktop | Feed 8 wide. |
| Mobile | Feed. |
| Advantages | Narrative memory |
| Disadvantages | Harder to see current morale drivers |
| Complexity / perf | M / Low |
| Works with | WLD-01 |
| Fits identities | C, B |
| Patterns | Consolidated threads |

### SQD-02j · Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel)

**Current:** Own players: dark gradient strip with a 160 px family radar and family tiles, then all 56 outcourt / 21 GK attributes with hard-coded tier-coloured bars; no deltas, no role weighting.

**Recommendation:** A — A tokenised heat matrix with deltas and compare overlay serves power users and maps cleanly to every identity.

**Priority:** P0 · **Dependencies:** Tier colour tokens, Development events, SQD-04 compare

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Heat matrix

| | |
|---|---|
| Visual concept | Families as columns (Teknik, Perception/beslut, Taktik, Försvar, Fysik, Mental; GK: 4 families), attributes as tiles with value and tokenised tier ramp, ▲/▼ deltas since last month, role-relevant tiles outlined. |
| Layout | Family average header row + matrix. |
| Information hierarchy | Family averages, then outliers, then deltas. |
| Interactions | Compare toggle overlays another player/squad average; tap tile for history. |
| Navigation | Shared with SQD-04. |
| Desktop | 6 columns. |
| Mobile | Family accordions with 2-col tiles. |
| Advantages | All 56 visible at once; Deltas visible |
| Disadvantages | Dense for newcomers |
| Complexity / perf | M / Low |
| Works with | SQD-04, SQD-02d |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting; User-chosen rating scale |

#### B — Radar showcase

| | |
|---|---|
| Visual concept | A large family radar that expands into petals; tapping a petal reveals that family's attribute bars. |
| Layout | Radar left, petal detail right. |
| Information hierarchy | Shape first. |
| Interactions | Tap petal; compare overlay. |
| Navigation | — |
| Desktop | Radar 6/12. |
| Mobile | Radar top, sheet for detail. |
| Advantages | Instant player "shape" |
| Disadvantages | Radar hides individual values |
| Complexity / perf | M / Medium |
| Works with | SQD-04 |
| Fits identities | B |

#### C — Report bars with words

| | |
|---|---|
| Visual concept | Grouped inline bars with verbal grades (Elit ≥17, Stark ≥14, Bra ≥11 …) and a one-line summary per family. |
| Layout | Family sections in two columns. |
| Information hierarchy | Words, then bars. |
| Interactions | Toggle numbers on/off. |
| Navigation | — |
| Desktop | Two columns. |
| Mobile | One column. |
| Advantages | Readable for casual players |
| Disadvantages | Verbal bands lose precision |
| Complexity / perf | S / Low |
| Works with | SQD-02 |
| Fits identities | C |
| Patterns | User-chosen rating scale |

### SQD-02k · Panel "Förmåga & Positionskarta" (GameplayAbilityPanel)

**Current:** Förmåga & Positionskarta: CA/PA as 1–5 stars, SVG mini-court with only the primary position lit, role proficiencies as text.

**Recommendation:** A — A suitability court shows primary, secondary and role proficiency spatially using data that already exists.

**Priority:** P1 · **Dependencies:** Court component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Suitability court

| | |
|---|---|
| Visual concept | Mini court with all 7 spots shaded (primary solid, secondary partial), attack and defence role proficiencies as chips beside the court, and the ability band above. |
| Layout | Ability band + court + role chips. |
| Information hierarchy | Ability band, then positions, then roles. |
| Interactions | Tap a spot for role chips at that spot. |
| Navigation | → TRN-02 with player preselected. |
| Desktop | Court 4/12 in rail. |
| Mobile | Full width. |
| Advantages | Uses existing data; Spatial |
| Disadvantages | Proficiency levels need clear legend |
| Complexity / perf | S / Low |
| Works with | TRN-02, SQD-01f |
| Fits identities | A, C |

#### B — Ability band only

| | |
|---|---|
| Visual concept | CA/PA drawn as a star band with the gap shaded, roles as a ranked list; no court. |
| Layout | Band + list. |
| Information hierarchy | Gap to potential. |
| Interactions | — |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Very compact |
| Disadvantages | Loses position story |
| Complexity / perf | S / Low |
| Works with | SQD-02d |
| Fits identities | A |

### SQD-02l · Knowledge-gated panels (external players)

**Current:** External players: ability/potential as star-range text ("2–4 ★") with a knowledge tier badge; attributes reduced to strengths/weaknesses lists; no scout CTA in the panel.

**Recommendation:** A — Range bars that visibly tighten make scouting meaningful and are honest about uncertainty.

**Priority:** P1 · **Dependencies:** Range bar component, REC-01 scouting

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Tightening range bars

| | |
|---|---|
| Visual concept | Ability and potential as range bars on the star scale, width from knowledge tier; strengths/weaknesses as chips; inline "Scouta nu". |
| Layout | Two range bars + chips + CTA. |
| Information hierarchy | Range width (certainty), then position. |
| Interactions | CTA opens scout assignment preselected. |
| Navigation | → REC-01 ?target. |
| Desktop | Rail panel. |
| Mobile | Card. |
| Advantages | Uncertainty visible; Direct action |
| Disadvantages | Needs legend for newcomers |
| Complexity / perf | S / Low |
| Works with | REC-01, SQD-02m |
| Fits identities | A, C |
| Patterns | Attribute bars + numbers, fogged by scouting |

#### B — Fogged card

| | |
|---|---|
| Visual concept | Attribute grid rendered fogged in proportion to knowledge; known strengths revealed as clear tiles. |
| Layout | Grid with fog layer. |
| Information hierarchy | Revealed tiles first. |
| Interactions | Scout CTA on fog. |
| Navigation | → REC-01. |
| Desktop | Grid. |
| Mobile | Grid. |
| Advantages | Memorable game feel |
| Disadvantages | Implies per-attribute knowledge that only exists as lists |
| Complexity / perf | M / Medium |
| Works with | REC-01 |
| Fits identities | B |
| Patterns | Attribute bars + numbers, fogged by scouting |

### SQD-02m · Panel "Scoutingrapport" (ScoutReportPanel)

**Current:** Scoutingrapport: value range, confidence %, recommendation, strengths/weaknesses, report history, "Scouta spelare" CTA; only the latest report shown.

**Recommendation:** A — A report timeline shows how ranges narrowed over time, which is the payoff of scouting.

**Priority:** P2 · **Dependencies:** Scout report history

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Report timeline

| | |
|---|---|
| Visual concept | Versions listed with scout and date; value and ability ranges drawn per version so narrowing is visible; latest expanded. |
| Layout | Stacked range rows + latest detail. |
| Information hierarchy | Latest verdict, then history. |
| Interactions | Tap a version to compare with latest. |
| Navigation | → REC-01. |
| Desktop | Rail panel. |
| Mobile | Card. |
| Advantages | Shows scouting value |
| Disadvantages | Needs old report ranges kept (check history depth) |
| Complexity / perf | M / Low |
| Works with | REC-01 |
| Fits identities | A, C |
| Patterns | Scouting-fogged ratings |

#### B — Report as article

| | |
|---|---|
| Visual concept | The scout's report as a short article with byline, recommendation as headline and a stamp. |
| Layout | Article block. |
| Information hierarchy | Headline verdict. |
| Interactions | Older reports as links. |
| Navigation | → REC-01. |
| Desktop | Main column. |
| Mobile | Full width. |
| Advantages | Personifies the scout |
| Disadvantages | Copy quality risk |
| Complexity / perf | S / Low |
| Works with | REC-01 |
| Fits identities | C |
| Patterns | Staff as faces of systems |

### SQD-02n · Panel "Förläng kontrakt" (ContractRenewal)

**Current:** ContractRenewal state machine: intention, blockers, talks, demand vs wage, role, demand factors, last response, waiting state, offer form, signing moment; feedback via a plain status line, no budget impact.

**Recommendation:** A — A consequence preview (budget delta, demand gap) reduces guess-and-check, the main pain in contract flows.

**Priority:** P1 · **Dependencies:** Wage budget data, REC-04 negotiation components

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Offer with consequence preview

| | |
|---|---|
| Visual concept | Demand vs offer slider with demand factors (±%) as a breakdown, payroll/budget delta bar and role promise, then send. |
| Layout | Demand breakdown left, offer form right, budget bar below. |
| Information hierarchy | Gap to demand, then budget effect. |
| Interactions | Drag wage/years; preview updates; send. |
| Navigation | Answers arrive in WLD-01. |
| Desktop | Two columns. |
| Mobile | Stepper: demand → offer → confirm. |
| Advantages | Fewer rejected offers; Budget awareness |
| Disadvantages | Needs new data: acceptance likelihood if shown (omit otherwise) |
| Complexity / perf | M / Low |
| Works with | SQD-05, REC-04, WLD-01 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview; "What would make this work?" |

#### B — Shared talk stepper

| | |
|---|---|
| Visual concept | Same stepper and round timeline as the transfer negotiation room (REC-04): Krav → Bud → Svar → Avtal. |
| Layout | Stepper + rounds. |
| Information hierarchy | Stage first. |
| Interactions | Respond per round. |
| Navigation | Shared with REC-04. |
| Desktop | Stepper top. |
| Mobile | Stepper top. |
| Advantages | One negotiation language |
| Disadvantages | Less budget context |
| Complexity / perf | M / Low |
| Works with | REC-04, STF-02b |
| Fits identities | A, B, C |

### SQD-02o · Panel "Transferläge" (PlayerTransferCard)

**Current:** PlayerTransferCard in the Transfer Centre tc-* skin: ownership chips, loan progress, competing interest, promise status and a negotiation CTA with deadline.

**Recommendation:** A — One card system across profile and market removes the visual mismatch.

**Priority:** P2 · **Dependencies:** Unified card tokens, REC-03

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Unified status card

| | |
|---|---|
| Visual concept | Same card component as the profile, with deadline clock and promise state as chips. |
| Layout | Card. |
| Information hierarchy | Deadline, then state. |
| Interactions | CTA → negotiation. |
| Navigation | → REC-04. |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Visual consistency |
| Disadvantages | Refactor of tc-* |
| Complexity / perf | S / Low |
| Works with | REC-03, REC-04 |
| Fits identities | A, B, C |

#### B — Hero status + drawer

| | |
|---|---|
| Visual concept | Transfer state as a chip in the identity bar; detail in a drawer on tap. |
| Layout | Chip + drawer. |
| Information hierarchy | Chip first. |
| Interactions | Tap chip. |
| Navigation | → REC-04. |
| Desktop | Drawer. |
| Mobile | Sheet. |
| Advantages | Saves space |
| Disadvantages | Less visible deadlines |
| Complexity / perf | S / Low |
| Works with | SQD-02g |
| Fits identities | A |

### SQD-02p · Panel "Medicinskt" (MedicalPanel)

**Current:** MedicalPanel key-value rows: availability, injury type/severity/rehab phase/return/rehab %, last 5 injuries; duplicates Tillstånd and has no link to /career/medical.

**Recommendation:** A — A rehab timeline uses existing phase and progress data and links to the medical page.

**Priority:** P2 · **Dependencies:** /career/medical (part A)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Rehab timeline

| | |
|---|---|
| Visual concept | Phase bar with progress, expected return marker relative to upcoming fixtures, and injury history markers. |
| Layout | Timeline + history list. |
| Information hierarchy | Return date, then phase. |
| Interactions | Tap history item. |
| Navigation | → /career/medical. |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Return relative to fixtures |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | SQD-02h |
| Fits identities | A, C |

#### B — Body map

| | |
|---|---|
| Visual concept | Body silhouette marking current and past injury locations. |
| Layout | Silhouette + list. |
| Information hierarchy | Location first. |
| Interactions | Tap marker. |
| Navigation | → /career/medical. |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Immediately readable |
| Disadvantages | Needs new data: body location per injury type mapping |
| Complexity / perf | M / Low |
| Works with | SQD-02h |
| Fits identities | B |

### SQD-02q · Loading / not-found states

**Current:** "Läser in spelarbetyg…" muted text while ratings load; "Spelaren hittades inte." with no way back.

**Recommendation:** A — Skeletons and a useful not-found state are low-cost polish.

**Priority:** P3 · **Dependencies:** Skeleton component, ⌘K palette

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Skeleton + recover

| | |
|---|---|
| Visual concept | Layout-matching skeleton; not-found offers back, search and recent players. |
| Layout | Skeleton of profile. |
| Information hierarchy | — |
| Interactions | Back / search. |
| Navigation | → SQD-01 / ⌘K. |
| Desktop | Full skeleton. |
| Mobile | Full skeleton. |
| Advantages | No layout jump |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | SQD-02 |
| Fits identities | A, B, C |
| Patterns | Command palette / global search |

#### B — Suggesting not-found

| | |
|---|---|
| Visual concept | Not-found suggests similarly named players via the palette index. |
| Layout | Message + suggestions. |
| Information hierarchy | Suggestions. |
| Interactions | Tap suggestion. |
| Navigation | → SQD-02. |
| Desktop | Inline. |
| Mobile | Inline. |
| Advantages | Recovers typos and stale links |
| Disadvantages | Needs fuzzy search |
| Complexity / perf | S / Low |
| Works with | SQD-03 |
| Fits identities | A |
| Patterns | Command palette / global search |

### SQD-03 · Spelarsök (player market search)

**Current:** Spelarsök: counters band, a 6-filter 9-column paginated table with no ability/value column, and a sticky dossier aside; overlaps Transfer Centre and Recruitment lists.

**Recommendation:** A — Three market tables should become one; a workbench with knowledge-gated ability bands and saved searches gives the market its missing quality signal.

**Priority:** P1 · **Dependencies:** REC-02 / REC-03 merge (Rekrytering hub), Range bar component, Virtualised table, Peek drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Market Workbench

| | |
|---|---|
| Visual concept | One market table shared with Recruitment: ability and potential range bands, value range, knowledge %, age, position, contract end; saved searches and need-based presets. |
| Layout | Filter rail 3/12 + virtualised table 9/12; Peek drawer replaces the aside. |
| Information hierarchy | Ability band and value, then knowledge, then contract. |
| Interactions | Sort by band midpoint; save search; + Kortlista; bulk scout. |
| Navigation | Rekrytering hub › Marknad; rows → Peek → REC-04 / REC-01. |
| Desktop | Filter rail + table. |
| Mobile | Filter sheet; ranked cards with band bars. |
| Advantages | One market, not three; Quality signal finally present |
| Disadvantages | Requires merging REC lists |
| Complexity / perf | L / Medium |
| Works with | REC-02, REC-03, REC-01, SQD-02 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting; Bulk actions + notes on entities; Density modes |

#### B — Scouting board

| | |
|---|---|
| Visual concept | Players as cards pinned on a board by position; card shows fogged ability band, value range and knowledge tier. |
| Layout | Position columns of cards. |
| Information hierarchy | Positions, then quality. |
| Interactions | Drag card to shortlist lane. |
| Navigation | → REC-01. |
| Desktop | 7 columns. |
| Mobile | Position tabs + card list. |
| Advantages | Tactile, game-like |
| Disadvantages | Poor at scale (thousands of players) |
| Complexity / perf | L / Medium |
| Works with | REC-01, REC-02 |
| Fits identities | B |
| Patterns | Scouting-fogged ratings |

#### C — Need-based finder

| | |
|---|---|
| Visual concept | Starts from squad needs ("Du har en tillgänglig V6") as preset searches with an explanation per result. |
| Layout | Needs cards → results list. |
| Information hierarchy | Needs first. |
| Interactions | Pick need, refine. |
| Navigation | → SQD-01 depth. |
| Desktop | Needs row + results. |
| Mobile | Needs cards then list. |
| Advantages | Purposeful searching |
| Disadvantages | Less free exploration |
| Complexity / perf | M / Low |
| Works with | SQD-01f, REC-02 |
| Fits identities | C |
| Patterns | "What would make this work?" |

### SQD-03a · Dossier aside "Spelardossier"

**Current:** Sticky "Spelardossier" aside with PlayerHero, knowledge meter, 3 facts and 3 buttons; no ability information even when known.

**Recommendation:** B — Using the global Peek drawer avoids a bespoke aside and brings the mini report with it.

**Priority:** P2 · **Dependencies:** Peek drawer, SQD-02l

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Aside with mini report

| | |
|---|---|
| Visual concept | Keep the aside but add ability range bars and scout verdict. |
| Layout | Sticky aside. |
| Information hierarchy | Ability band, then facts. |
| Interactions | CTA buttons. |
| Navigation | → SQD-02. |
| Desktop | 4/12 aside. |
| Mobile | Bottom sheet. |
| Advantages | Small change |
| Disadvantages | Bespoke component |
| Complexity / perf | S / Low |
| Works with | SQD-02l |
| Fits identities | A |

#### B — Peek drawer

| | |
|---|---|
| Visual concept | Row selection opens the shared Peek drawer. |
| Layout | Drawer. |
| Information hierarchy | Same as Peek. |
| Interactions | Next/prev in drawer. |
| Navigation | → SQD-02. |
| Desktop | Right drawer. |
| Mobile | Bottom sheet. |
| Advantages | One component everywhere |
| Disadvantages | Drawer covers part of the table |
| Complexity / perf | S / Low |
| Works with | SQD-02 |
| Fits identities | A, B, C |
| Patterns | Hover cards for every entity |

### SQD-04 · Jämför spelare

**Current:** Two selects listing every player in the world, a 15-row comparison table and 6 position attributes (own players only); no visual diff or winner highlight.

**Recommendation:** A — A searchable picker and delta bars fix the real problems; the radar duel can be a toggle inside.

**Priority:** P2 · **Dependencies:** Searchable entity picker (⌘K index), SQD-02j matrix

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Head-to-head with delta bars

| | |
|---|---|
| Visual concept | Searchable pickers, rows with centre-aligned delta bars and the better value highlighted; external values as ranges. |
| Layout | Two identity headers + delta rows. |
| Information hierarchy | Biggest gaps first (optional sort). |
| Interactions | Swap, sort by delta, compare vs squad average. |
| Navigation | From tray / profile. |
| Desktop | Centre axis layout. |
| Mobile | Stacked delta bars. |
| Advantages | Clear winners |
| Disadvantages | — |
| Complexity / perf | M / Low |
| Works with | SQD-01e, SQD-02 |
| Fits identities | A |

#### B — Tale of the tape

| | |
|---|---|
| Visual concept | Broadcast duel graphic: portraits face to face, overlaid radars, stat bars sliding in. |
| Layout | Duel hero + radar. |
| Information hierarchy | Overall shape. |
| Interactions | Swap sides. |
| Navigation | — |
| Desktop | Full width. |
| Mobile | Stacked portraits. |
| Advantages | Fun |
| Disadvantages | Needs new data: portraits; Values less precise |
| Complexity / perf | M / Medium |
| Works with | SQD-02 |
| Fits identities | B |

#### C — Compare against baseline

| | |
|---|---|
| Visual concept | Compare a player against a baseline: current starter at his position or squad average, with a verdict sentence. |
| Layout | Baseline picker + rows + verdict. |
| Information hierarchy | Verdict first. |
| Interactions | Change baseline. |
| Navigation | → REC-04. |
| Desktop | Two columns. |
| Mobile | Stacked. |
| Advantages | Answers "is he an upgrade?" |
| Disadvantages | Less flexible |
| Complexity / perf | M / Low |
| Works with | SQD-03, REC-02 |
| Fits identities | C |

### SQD-05 · Kontrakt (contracts overview)

**Current:** PageHeading, a 4-cell summary, a non-sortable 7-column contract table with countdown and a decision panel embedding ContractRenewal; no wage budget, no staff contracts.

**Recommendation:** B — A contract timeline against season boundaries with a payroll bar shows timing and money together, which a table alone cannot.

**Priority:** P1 · **Dependencies:** Payroll/budget data, SQD-02n, Drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Contract table + payroll bar

| | |
|---|---|
| Visual concept | Sortable table (Avtal till, Dagar kvar, Lön, Status) with payroll vs budget bar on top and renewal in a drawer. |
| Layout | Bar + table + drawer. |
| Information hierarchy | Expiring soonest. |
| Interactions | Sort, open drawer. |
| Navigation | → SQD-02n. |
| Desktop | Table 12. |
| Mobile | Cards. |
| Advantages | Simple, efficient |
| Disadvantages | Timing harder to grasp |
| Complexity / perf | S / Low |
| Works with | SQD-02n |
| Fits identities | A |

#### B — Contract timeline (Gantt)

| | |
|---|---|
| Visual concept | Each player and staff member a bar to contract end across seasons, with season boundaries, transfer windows and the renewal window; payroll vs budget with projected renewals above. |
| Layout | Payroll bar + Gantt + drawer. |
| Information hierarchy | Bars ending soonest, then money. |
| Interactions | Tap bar → renewal drawer; group by position. |
| Navigation | → SQD-02n, STF-02. |
| Desktop | Gantt 12 wide. |
| Mobile | Vertical list with mini bars and grouped by season of expiry. |
| Advantages | Timing and money together; Shows position cover gaps over time |
| Disadvantages | Staff contracts must be joined in |
| Complexity / perf | M / Low |
| Works with | SQD-02n, STF-02b, WLD-05 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### C — Renewal docket

| | |
|---|---|
| Visual concept | Numbered docket of contract decisions ("1. Lindqvist — 42 dagar kvar, kräver +12 %") with inline actions. |
| Layout | Docket list + drawer. |
| Information hierarchy | Most urgent first. |
| Interactions | Resolve per item. |
| Navigation | → WLD-01. |
| Desktop | List 8/12 + rail. |
| Mobile | Cards. |
| Advantages | Decision-centric |
| Disadvantages | Hides non-urgent contracts |
| Complexity / perf | S / Low |
| Works with | WLD-01, DSH-01 |
| Fits identities | C |
| Patterns | Inbox as task queue |

### SQD-05a · Panel "Ditt avtalsbeslut"

**Current:** Embedded renewal flow for the selected row; selection persists in workspace memory across visits.

**Recommendation:** A — A drawer opens and closes cleanly and does not leave stale selection.

**Priority:** P2 · **Dependencies:** Drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Side drawer

| | |
|---|---|
| Visual concept | Renewal opens in a right drawer; closing clears selection. |
| Layout | Drawer. |
| Information hierarchy | Player + days left. |
| Interactions | Close resets. |
| Navigation | URL ?player=. |
| Desktop | 480 px. |
| Mobile | Sheet. |
| Advantages | No stale state |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | SQD-02n |
| Fits identities | A, C |

#### B — Inline expanding row

| | |
|---|---|
| Visual concept | The row expands to show the renewal flow below it. |
| Layout | Expanded row. |
| Information hierarchy | In context. |
| Interactions | Collapse. |
| Navigation | — |
| Desktop | Row expansion. |
| Mobile | Card expansion. |
| Advantages | Context kept |
| Disadvantages | Long rows |
| Complexity / perf | S / Low |
| Works with | SQD-02n |
| Fits identities | A |

## STF — Staff

### STF-01 · Personal – Organisation — HI-FI prototype `staff`

**Current:** SectionScene header, StaffNav, an OrganisationChart band (cost meter, needs list, 5 department columns), a role-count grid, a 4-column staff table with suitability stars and a rail of weekly coach responsibilities — three overlapping views of the same staff.

**Recommendation:** A — One matrix that merges organisation, suitability (1–20 resolution), cost and delegation mode answers "who does what, how well, at what cost" and absorbs the delegation page's matrix.

**Priority:** P1 · **Dependencies:** STF-04 delegation data, Range/score bar component, Staff cost vs board limit

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Org & Responsibility Matrix

| | |
|---|---|
| Visual concept | A single matrix: departments (Ledning, Tränare, Rekrytering, Akademi, Stöd) as row groups, positions as rows; columns holder, suitability bar (1–20), wage and contract end, delegation mode (Du själv / Råd först / Delegera), sessions led this week. Vacancies are highlighted rows. |
| Layout | Header with staff cost vs board limit meter and "Behov just nu"; matrix 12 wide; rail optional. |
| Information hierarchy | 1) Vacancies and weak fits. 2) Holders and suitability. 3) Cost and delegation. |
| Interactions | Change delegation inline; tap holder → Peek; vacancy row → "Visa kandidater" (STF-03 filtered). |
| Navigation | Klubben hub › Personal. Replaces org chart + role grid + table. |
| Desktop | Matrix fits 1280 px. |
| Mobile | Department accordions with position cards (holder, fit bar, mode chip). |
| Advantages | Ends triple representation; Shows suitability resolution |
| Disadvantages | Less warm than a room |
| Complexity / perf | M / Low |
| Works with | STF-02, STF-03, STF-04, TRN-01 |
| Fits identities | A |
| Patterns | Control panel per area; Staff as faces of systems |

#### B — Staff Room

| | |
|---|---|
| Visual concept | An illustrated staff room: each staff member at a desk/station with portrait, role and a fit glow; empty chairs are vacancies; the weekly whiteboard shows who leads which session. |
| Layout | Scene hero with clickable stations; staff card panel. |
| Information hierarchy | Empty chairs, then faces. |
| Interactions | Tap a station → staff card; tap empty chair → candidates. |
| Navigation | → STF-02, STF-03. |
| Desktop | Scene 8/12 + card 4/12. |
| Mobile | Scrollable station list with avatars. |
| Advantages | Personifies systems; Vacancies obvious |
| Disadvantages | Needs new data: staff portraits / illustrations; Weak for cost comparison |
| Complexity / perf | L / Medium |
| Works with | STF-02, STF-03 |
| Fits identities | B |
| Patterns | Staff as faces of systems; Visible facility tree |

#### C — Department Journal

| | |
|---|---|
| Visual concept | Each department as a journal column with a headline ("Akademin saknar huvudtränare"), staff bylines with fit words, and a one-line impact on training or scouting. |
| Layout | 5 columns (desktop) of department articles; cost box. |
| Information hierarchy | Headlines, then people. |
| Interactions | Tap byline → Peek. |
| Navigation | → STF-02/03. |
| Desktop | 5-column newspaper grid. |
| Mobile | Department sections stacked with sticky headers. |
| Advantages | Readable, narrative |
| Disadvantages | Copy generation needed; Less precise |
| Complexity / perf | M / Low |
| Works with | STF-02, CLB-02 |
| Fits identities | C |
| Patterns | Staff as faces of systems |

### STF-01a · Staff subnav (StaffNav)

**Current:** Five-item StaffNav mixing routes and ?view= states, with vacancy and negotiation badges.

**Recommendation:** A — A consistent hub secondary tab row with badges matches the 6-hub IA.

**Priority:** P2 · **Dependencies:** G2 navigation model

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Hub secondary tabs

| | |
|---|---|
| Visual concept | Organisation · Rekrytering · Ansvar as real tabs; vacancies and negotiations become filter chips inside Rekrytering. |
| Layout | Tab row. |
| Information hierarchy | Badges. |
| Interactions | Tabs. |
| Navigation | Routes only, no mixed query states. |
| Desktop | Tab row. |
| Mobile | Scrollable segmented control. |
| Advantages | Predictable |
| Disadvantages | URL changes |
| Complexity / perf | S / Low |
| Works with | STF-03, STF-04 |
| Fits identities | A, B, C |
| Patterns | Inform vs navigate separation |

#### B — Control panel actions

| | |
|---|---|
| Visual concept | No sub-nav; the Personal page has a control panel with "Rekrytera", "Ansvar" and badges. |
| Layout | Action strip. |
| Information hierarchy | Actions. |
| Interactions | Buttons. |
| Navigation | → pages. |
| Desktop | Strip. |
| Mobile | Overflow. |
| Advantages | Fewer tabs |
| Disadvantages | Less discoverable |
| Complexity / perf | S / Low |
| Works with | STF-01 |
| Fits identities | A |
| Patterns | Control panel per area |

### STF-01b · Panel "Klubbens organisation" (OrganisationChart)

**Current:** OrganisationChart band: cost meter, stats, needs list, 5 department columns of dense position cards, collapsible responsibilities.

**Recommendation:** A — A tree with health colours is the clearest at-a-glance view of gaps if a chart is kept.

**Priority:** P2 · **Dependencies:** STF-01

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Health-coloured tree

| | |
|---|---|
| Visual concept | Manager at top, departments as branches, positions as nodes coloured by fit (good/ok/weak/vacant). |
| Layout | Tree. |
| Information hierarchy | Red/vacant nodes. |
| Interactions | Tap node → Peek. |
| Navigation | → STF-02/03. |
| Desktop | Horizontal tree. |
| Mobile | Indented list. |
| Advantages | Gaps obvious |
| Disadvantages | Tree layout work |
| Complexity / perf | M / Low |
| Works with | STF-02, STF-03 |
| Fits identities | A, C |

#### B — Department cards

| | |
|---|---|
| Visual concept | Five department cards with fit summary and vacancies count. |
| Layout | Card grid. |
| Information hierarchy | Vacancies. |
| Interactions | Expand card. |
| Navigation | — |
| Desktop | 5 cards. |
| Mobile | Stacked. |
| Advantages | Compact |
| Disadvantages | Less detail |
| Complexity / perf | S / Low |
| Works with | STF-01 |
| Fits identities | A, B |

### STF-01c · Staff table + role counts

**Current:** Role-count grid plus sortable staff table (Namn, Roll, Relevanta egenskaper as text, Lämplighet stars); redundant with the org chart.

**Recommendation:** A — Keep a compact list as an alternate view for sorting, but with values instead of attribute names.

**Priority:** P3 · **Dependencies:** STF-01

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Compact list view toggle

| | |
|---|---|
| Visual concept | List view of the matrix: name, role, fit bar, top 3 attribute values. |
| Layout | Table. |
| Information hierarchy | Fit. |
| Interactions | Sort. |
| Navigation | Toggle in STF-01. |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | Sortable |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | STF-01 |
| Fits identities | A |
| Patterns | Density modes |

#### B — Remove

| | |
|---|---|
| Visual concept | Delete the table and role grid; the matrix covers both. |
| Layout | — |
| Information hierarchy | — |
| Interactions | — |
| Navigation | — |
| Desktop | — |
| Mobile | — |
| Advantages | Less code |
| Disadvantages | No sorted overview |
| Complexity / perf | S / Low |
| Works with | STF-01 |
| Fits identities | A, B, C |

### STF-01d · Rail "Veckans tränaransvar"

**Current:** Rail "Veckans tränaransvar": coach + date list without session type.

**Recommendation:** A — A mini week grid shows type and coach together and links to training.

**Priority:** P2 · **Dependencies:** TRN-01

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Mini week grid

| | |
|---|---|
| Visual concept | 7 day cells with session type colour and coach avatar/initials. |
| Layout | Grid. |
| Information hierarchy | Day, type, coach. |
| Interactions | Tap → TRN-01 day. |
| Navigation | → TRN-01. |
| Desktop | Rail. |
| Mobile | Horizontal strip. |
| Advantages | Same language as training |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | TRN-01 |
| Fits identities | A, C |

#### B — Week Spine pins

| | |
|---|---|
| Visual concept | Coach responsibilities shown as pins on the global Week Spine instead of a rail. |
| Layout | Spine pins. |
| Information hierarchy | — |
| Interactions | Hover pin. |
| Navigation | Global. |
| Desktop | Spine. |
| Mobile | Spine strip. |
| Advantages | No extra panel |
| Disadvantages | Depends on direction C spine |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | C |

### STF-02 · Personprofil (staff profile)

**Current:** SectionScene + main column (role fit, attributes with compare-to-holder, club history) + rail (employment, ambition with knowledge meter, impact, deal panel, training responsibilities); inline-styled ambition panel and a 6-field deal form without preview.

**Recommendation:** A — A staff dossier mirroring the player Dossier gives fit at full resolution and a delta versus the current holder — the real hiring question.

**Priority:** P2 · **Dependencies:** Range bar component, Shared negotiation stepper (REC-04), Peek drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Staff Dossier

| | |
|---|---|
| Visual concept | Identity column (role, club, wage, contract, knowledge) and work column: role-fit bars 1–20 (ranges under 90 % knowledge), attributes with delta vs current holder, impact on training/scouting, deal panel. |
| Layout | 3/12 identity + 9/12 work column. |
| Information hierarchy | Fit vs holder, then attributes, then deal. |
| Interactions | Toggle role to evaluate; open deal stepper. |
| Navigation | From STF-01/03. |
| Desktop | Two columns. |
| Mobile | Sticky bar + sections. |
| Advantages | Answers "is he better than mine?" |
| Disadvantages | — |
| Complexity / perf | M / Low |
| Works with | STF-01, STF-03, TRN-01 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting |

#### B — Staff card

| | |
|---|---|
| Visual concept | A trading-card style profile with a role-fit radar and ambition badges, flip for contract. |
| Layout | Card centre + actions. |
| Information hierarchy | Radar. |
| Interactions | Flip. |
| Navigation | — |
| Desktop | Card + side detail. |
| Mobile | Full-screen card. |
| Advantages | Personable |
| Disadvantages | Needs new data: portraits; Radar loses precision |
| Complexity / perf | M / Medium |
| Works with | STF-01 |
| Fits identities | B |
| Patterns | Traits as personality |

#### C — Interview profile

| | |
|---|---|
| Visual concept | Profile as an interview article: ambition as quotes, fit in words, then the deal stepper. |
| Layout | Article + rail. |
| Information hierarchy | Headline verdict. |
| Interactions | Deal in rail. |
| Navigation | — |
| Desktop | Article 8 + rail 4. |
| Mobile | Article. |
| Advantages | Characterful |
| Disadvantages | Copy risk |
| Complexity / perf | M / Low |
| Works with | STF-01 |
| Fits identities | C |
| Patterns | Staff as faces of systems |

### STF-02a · Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight)

**Current:** Lämplighet rows (1–20 converted to 1–5 stars with verbal label) and role-relevant attributes with ranges under uncertainty.

**Recommendation:** A — Range bars keep the 1–20 resolution and show uncertainty honestly.

**Priority:** P2 · **Dependencies:** Range bar component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Range bars with holder delta

| | |
|---|---|
| Visual concept | Fit per role as a bar or range on 1–20 with a marker for the current holder. |
| Layout | Bar list. |
| Information hierarchy | Best role first. |
| Interactions | Tap for attributes. |
| Navigation | — |
| Desktop | Main column. |
| Mobile | Full width. |
| Advantages | Precise and honest |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | STF-02 |
| Fits identities | A, C |
| Patterns | Attribute bars + numbers, fogged by scouting |

#### B — Fit radar

| | |
|---|---|
| Visual concept | Radar of role fits overlayed with current holder. |
| Layout | Radar. |
| Information hierarchy | Shape. |
| Interactions | Toggle holder. |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Compact |
| Disadvantages | Loses resolution |
| Complexity / perf | S / Low |
| Works with | STF-02 |
| Fits identities | B |

### STF-02b · Panel "Värva / Förläng eller avsluta" (StaffDealPanel)

**Current:** StaffDealPanel: stepper, 6-cell finance grid with warnings, 6-field form, status notes and a dismissal DecisionCard inline under the hire form.

**Recommendation:** A — One negotiation language across players and staff, with dismissal moved to a guarded modal.

**Priority:** P2 · **Dependencies:** REC-04 negotiation stepper, Confirm dialog

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Shared stepper + consequence preview

| | |
|---|---|
| Visual concept | Same stepper as REC-04 with budget delta vs staff cost limit; dismissal as a separate danger action with modal. |
| Layout | Stepper + form + budget bar. |
| Information hierarchy | Stage, then budget. |
| Interactions | Step through; confirm. |
| Navigation | Answers via WLD-01. |
| Desktop | Rail or main. |
| Mobile | Full-screen stepper. |
| Advantages | Consistent; Safer dismissal |
| Disadvantages | Shared component dependency |
| Complexity / perf | M / Low |
| Works with | REC-04, SQD-02n |
| Fits identities | A, B, C |
| Patterns | Predictive consequence preview |

#### B — Summary card + modal flow

| | |
|---|---|
| Visual concept | Rail shows a deal summary card; "Förhandla" opens a modal flow. |
| Layout | Card + modal. |
| Information hierarchy | Status. |
| Interactions | Modal. |
| Navigation | — |
| Desktop | Modal 640 px. |
| Mobile | Full-screen. |
| Advantages | Clean profile |
| Disadvantages | Modal hides profile context |
| Complexity / perf | S / Low |
| Works with | STF-02 |
| Fits identities | A |

### STF-03 · Rekrytera personal

**Current:** Staff recruitment page with counters, StaffNav, optional vacancies/negotiations lists stacked above the StaffMarketBoard (8 columns), then legacy free-scout and staff tables with contradictory filters.

**Recommendation:** B — Hiring starts from a vacancy; leading with vacancy cards and a single filtered market removes the duplicated tables.

**Priority:** P2 · **Dependencies:** STF-03c board, STF-03d removal, Peek drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — One staff market

| | |
|---|---|
| Visual concept | Single sortable market table with saved role filters and vacancy chips above. |
| Layout | Chips + table. |
| Information hierarchy | Fit vs today, then wage. |
| Interactions | Sort, filter, Peek. |
| Navigation | → STF-02. |
| Desktop | Table 12. |
| Mobile | Cards. |
| Advantages | Efficient |
| Disadvantages | Less guidance |
| Complexity / perf | S / Low |
| Works with | STF-02 |
| Fits identities | A |
| Patterns | Density modes |

#### B — Vacancy-led hiring

| | |
|---|---|
| Visual concept | Vacancy cards first (role, impact of filling, budget room); choosing one shows a ranked candidate list with "Mot i dag" delta and knowledge. |
| Layout | Vacancy cards row → candidate list + Peek. |
| Information hierarchy | Vacancies, then best candidates. |
| Interactions | Pick vacancy; compare candidates; open deal. |
| Navigation | → STF-02 ?from=recruitment. |
| Desktop | Cards row + list. |
| Mobile | Vacancy cards then list. |
| Advantages | Purposeful; Fixes stacked views |
| Disadvantages | Browsing without a vacancy needs an "Alla roller" card |
| Complexity / perf | M / Low |
| Works with | STF-01, STF-02 |
| Fits identities | C, A |
| Patterns | "What would make this work?" |

#### C — Staff scouting board

| | |
|---|---|
| Visual concept | Candidates as cards on a board grouped by role with fit glow. |
| Layout | Role columns. |
| Information hierarchy | Roles. |
| Interactions | Drag to shortlist. |
| Navigation | → STF-02. |
| Desktop | Columns. |
| Mobile | Role tabs. |
| Advantages | Tactile |
| Disadvantages | Scales poorly |
| Complexity / perf | M / Medium |
| Works with | STF-02 |
| Fits identities | B |

### STF-03a · View "Vakanta tjänster"

**Current:** Vacant roles as a link list with "Visa kandidater →"; empty state "Alla tjänster är tillsatta."

**Recommendation:** A — Vacancy cards with impact give the list purpose.

**Priority:** P2 · **Dependencies:** STF-03

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Vacancy cards with impact

| | |
|---|---|
| Visual concept | Card per vacancy: role, what is missing (e.g. training quality for GK sessions), budget room. |
| Layout | Card row. |
| Information hierarchy | Impact. |
| Interactions | Tap → candidates. |
| Navigation | → STF-03c filtered. |
| Desktop | Row. |
| Mobile | Stack. |
| Advantages | Motivates hiring |
| Disadvantages | Impact copy per role |
| Complexity / perf | S / Low |
| Works with | STF-03c |
| Fits identities | A, C |

#### B — Vacancy pins in org

| | |
|---|---|
| Visual concept | Vacancies shown as empty nodes in the STF-01 matrix/tree only. |
| Layout | In STF-01. |
| Information hierarchy | — |
| Interactions | Tap node. |
| Navigation | → STF-03. |
| Desktop | — |
| Mobile | — |
| Advantages | No separate view |
| Disadvantages | Less visible from recruitment |
| Complexity / perf | S / Low |
| Works with | STF-01 |
| Fits identities | A, B |

### STF-03b · View "Förhandlingar"

**Current:** Last 20 staff negotiations as a link list with stage; answers arrive in the inbox with no CTA here.

**Recommendation:** A — A negotiation board shared with player transfers shows what is waiting on whom.

**Priority:** P2 · **Dependencies:** REC-03 negotiation list

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Negotiation board

| | |
|---|---|
| Visual concept | Columns by stage (Väntar på dig / Väntar på svar / Klar) with deadlines. |
| Layout | Kanban. |
| Information hierarchy | Your move first. |
| Interactions | Tap → STF-02 deal. |
| Navigation | Shared with REC-03. |
| Desktop | 3 columns. |
| Mobile | Grouped list. |
| Advantages | Clear ownership |
| Disadvantages | — |
| Complexity / perf | M / Low |
| Works with | REC-03, STF-02b |
| Fits identities | A, C |
| Patterns | Inbox as task queue |

#### B — Inbox threads

| | |
|---|---|
| Visual concept | Remove the view; each negotiation is a consolidated inbox thread. |
| Layout | — |
| Information hierarchy | — |
| Interactions | Inline reply in inbox. |
| Navigation | → WLD-01. |
| Desktop | — |
| Mobile | — |
| Advantages | One place for answers |
| Disadvantages | Less overview |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | C |
| Patterns | Consolidated threads |

### STF-03c · Panel "Hitta rätt person" (StaffMarketBoard)

**Current:** StaffMarketBoard: header with 3 filters + 8-column sortable table (fit stars with "?", Mot i dag delta, ambition, wage, knowledge %).

**Recommendation:** A — Keep the board as the only market, upgraded with fit range bars.

**Priority:** P2 · **Dependencies:** Range bar component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Board as sole market

| | |
|---|---|
| Visual concept | Same columns, fit as range bars, column chooser; legacy tables removed. |
| Layout | Filters + table. |
| Information hierarchy | Fit delta. |
| Interactions | Sort, Peek. |
| Navigation | → STF-02. |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | One truth |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | STF-02 |
| Fits identities | A |

#### B — Ranked candidate cards

| | |
|---|---|
| Visual concept | Cards ranked by "Mot i dag" delta with fit range and wage. |
| Layout | Card list. |
| Information hierarchy | Delta. |
| Interactions | Tap → Peek. |
| Navigation | → STF-02. |
| Desktop | 2-column cards. |
| Mobile | Cards. |
| Advantages | Touch-friendly |
| Disadvantages | Less sortable |
| Complexity / perf | S / Low |
| Works with | STF-02 |
| Fits identities | B, C |

### STF-03d · Legacy tables "Fria scouter" + "Rekrytering — Personal"

**Current:** Legacy "Fria scouter" rail table and "Rekrytering — Personal" table still rendered below the board (internal leftover).

**Recommendation:** A — Redundant player-facing duplicate; remove from players' view.

**Priority:** P3 · **Dependencies:** STF-03c

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Remove

| | |
|---|---|
| Visual concept | Delete both legacy tables from the player route. |
| Layout | — |
| Information hierarchy | — |
| Interactions | — |
| Navigation | — |
| Desktop | — |
| Mobile | — |
| Advantages | Removes contradictory filters |
| Disadvantages | Check nothing else links to them |
| Complexity / perf | S / Low |
| Works with | STF-03c |
| Fits identities | A, B, C |

#### B — Dev-only behind flag

| | |
|---|---|
| Visual concept | Hide behind a dev flag with plain internal styling. |
| Layout | Collapsed dev section. |
| Information hierarchy | — |
| Interactions | — |
| Navigation | — |
| Desktop | Muted. |
| Mobile | Hidden. |
| Advantages | Keeps debugging aid |
| Disadvantages | Code stays |
| Complexity / perf | S / Low |
| Works with | STF-03c |
| Fits identities | A |

### STF-04 · Ansvarsfördelning (delegation)

**Current:** Ansvarsfördelning: 5-column matrix (Område, owning role, responsible + stars, Läge radios Du själv / Råd först / Delegera, explanation), staff proposals as DecisionCards, and an unfiltered activity log; training proposals cannot be approved here.

**Recommendation:** B — Delegation is best set where its consequences are felt; contextual toggles plus one proposals queue reduce trips, and the central page becomes a calm overview.

**Priority:** P2 · **Dependencies:** Delegation toggle component, WLD-01 inbox proposals, STF-01 matrix

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Delegation matrix

| | |
|---|---|
| Visual concept | Refined matrix: area rows with owner face, fit bar, 3-state segmented control and a consequence sentence; proposals queue and filtered log below. |
| Layout | Matrix + proposals + log. |
| Information hierarchy | Modes, then pending proposals. |
| Interactions | Toggle; approve/reject (incl. training). |
| Navigation | → domain pages. |
| Desktop | Table. |
| Mobile | Area cards with segmented control. |
| Advantages | All delegation in one place |
| Disadvantages | Far from consequences |
| Complexity / perf | S / Low |
| Works with | STF-01, TRN-01a |
| Fits identities | A |
| Patterns | Staff as faces of systems |

#### B — Contextual delegation + proposals queue

| | |
|---|---|
| Visual concept | Each domain page (Träning, Transfer, Scouting…) has a small "Vem gör det?" toggle in its control panel; this page becomes an overview of modes plus one proposals queue and a filterable log. |
| Layout | Mode summary chips + proposals queue + log. |
| Information hierarchy | Pending proposals first. |
| Interactions | Approve in place (incl. training plans); filter log by area/staff. |
| Navigation | Mode chips link to the domain page toggle. |
| Desktop | Queue 8/12 + summary 4/12. |
| Mobile | Queue cards, summary chips on top. |
| Advantages | Delegation where it matters; Fixes disabled training approval |
| Disadvantages | Toggles spread across pages |
| Complexity / perf | M / Low |
| Works with | TRN-01a, REC-03, REC-01, WLD-01 |
| Fits identities | A, C |
| Patterns | Control panel per area; Inbox as task queue |

#### C — Weekly staff meeting

| | |
|---|---|
| Visual concept | A short weekly meeting sequence: each staff member presents their proposal as a card; you approve, adjust or decline; modes adjustable per speaker. |
| Layout | Card sequence. |
| Information hierarchy | One proposal at a time. |
| Interactions | Swipe/approve. |
| Navigation | From inbox item. |
| Desktop | Centred card. |
| Mobile | Full-screen cards. |
| Advantages | Ritual, personal |
| Disadvantages | Slower for many proposals |
| Complexity / perf | M / Low |
| Works with | WLD-01, DSH-01 |
| Fits identities | B, C |
| Patterns | Fewer, weightier conversations; Staff as faces of systems |

## TRN — Training & tactics

### TRN-01 · Träning & Återhämtning — HI-FI prototype `training`

**Current:** Training hall banner, a "Veckans matchberedskap" band, collapsed TrainingFeedback, the assistant panel, a 7-column week grid where each session card is 4–5 native selects, a readiness table and a development table; no forecast of how the plan leaves players on matchday.

**Recommendation:** C — The assistant already proposes weeks; presenting that proposal as a diff on a visual week grid with projected matchday readiness turns the densest screen into a review-and-adjust task, while the grid (A) stays fully editable underneath.

**Priority:** P0 · **Dependencies:** TRN-01b block planner, TRN-01a proposal data, Readiness projection (derived from intensity/duration multipliers), Readiness heat-strip (SQD-01c)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Weekly Planner Grid

| | |
|---|---|
| Visual concept | A 7-day grid of session blocks coloured by type (12 types), height by intensity, with a load bar per day and a projected energy lane per player group; a session palette for tap-to-place or drag. |
| Layout | Control panel (week picker, templates, delegation mode); grid 12 wide with day columns; lanes below for group energy projection; readiness table collapsible. |
| Information hierarchy | 1) The week shape and match day. 2) Daily load vs budget. 3) Player readiness consequence. |
| Interactions | Drag or tap-to-place sessions; tap a block for a popover (type, intensity, duration, target group, coach); copy day; apply template; executed days show outcome deltas. |
| Navigation | Laget hub › Träning; match cell → MDY-01 (fixes wrong link); coach avatars → STF-02. |
| Desktop | Full-width grid with 2 slots per day. |
| Mobile | Day-by-day swipe view with the week strip on top; blocks as large cards; palette in a bottom sheet. |
| Advantages | Replaces select stacks with direct manipulation; Load visible per day |
| Disadvantages | Projection needs a derived model (not stored today) |
| Complexity / perf | L / Medium |
| Works with | SQD-01c, STF-01d, MDY-01, WLD-05 |
| Fits identities | A |
| Patterns | Predictive consequence preview; Feedback zone bar; Control panel per area |

#### B — Training Hall

| | |
|---|---|
| Visual concept | An illustrated training hall for the selected day: stations per session type (Avslut, Försvar, Kondition, Återhämtning…), the responsible coach at each station and players as tokens assigned to groups. |
| Layout | Day selector strip; hall scene 8/12; station detail 4/12. |
| Information hierarchy | Today's stations, then who is where. |
| Interactions | Tap station to set intensity/duration; move player tokens between groups/rest. |
| Navigation | Week overview link to grid. |
| Desktop | Scene with stations. |
| Mobile | Station cards per day. |
| Advantages | Immersive, personifies coaches |
| Disadvantages | Weak week overview; Needs new data: hall illustrations / station art |
| Complexity / perf | L / High |
| Works with | STF-01, TRN-01c |
| Fits identities | B |
| Patterns | Staff as faces of systems; Visible facility tree |

#### C — Assistant Proposal

| | |
|---|---|
| Visual concept | The assistant drafts the week; the page opens on that proposal drawn as a diff over the week grid (added, changed, removed sessions) with the assistant's reasons and the projected matchday readiness before vs after; you approve all, accept per day, or edit blocks. |
| Layout | Assistant header (face, goal sentence, Godkänn / Justera / Avböj); diff week grid; readiness forecast (before → after) and individual advice list. |
| Information hierarchy | 1) Assistant's goal and the effect on matchday readiness. 2) What changed. 3) Individual load advice. |
| Interactions | Approve all or per day; tap a changed block to accept/revert; edit opens the planner grid; delegation mode in the header. |
| Navigation | Inbox item "Veckoplanen är klar" opens this page; TRN-01a merged in; executed days show outcomes. |
| Desktop | Header + grid + forecast rail. |
| Mobile | Proposal summary card, then day-by-day diff cards with accept toggles. |
| Advantages | Turns the densest screen into review; Matches existing delegation system; Teaches trade-offs |
| Disadvantages | Needs new data: projected readiness model; Power users may skip the proposal |
| Complexity / perf | L / Medium |
| Works with | STF-04, WLD-01, SQD-01c, MDY-01 |
| Fits identities | C, A |
| Patterns | Staff as faces of systems; Predictive consequence preview; Inbox as task queue |

### TRN-01a · Panel "Assistentens träningsplan" (AssistantTrainingPanel)

**Current:** AssistantTrainingPanel above the planner: delegation mode buttons, request proposal, goal, planned sessions/intensity, individual advice table, approve/decline; competes for attention.

**Recommendation:** A — Showing the proposal as a diff overlay on the grid places it where it is evaluated.

**Priority:** P0 · **Dependencies:** TRN-01b

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Diff overlay on grid

| | |
|---|---|
| Visual concept | Proposal rendered on the week grid as ghost/changed blocks with a slim header for approve/decline. |
| Layout | Header bar + overlay. |
| Information hierarchy | Changes. |
| Interactions | Accept per block/day. |
| Navigation | — |
| Desktop | Overlay. |
| Mobile | Diff cards per day. |
| Advantages | In context |
| Disadvantages | Overlay states to design |
| Complexity / perf | M / Low |
| Works with | TRN-01b, STF-04 |
| Fits identities | A, C |
| Patterns | Staff as faces of systems |

#### B — Compact assistant card

| | |
|---|---|
| Visual concept | Small card in the control panel with mode toggle and "Visa förslag" that opens the overlay. |
| Layout | Card. |
| Information hierarchy | Status. |
| Interactions | Toggle. |
| Navigation | — |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Quiet |
| Disadvantages | Less visible |
| Complexity / perf | S / Low |
| Works with | TRN-01 |
| Fits identities | A |
| Patterns | Control panel per area |

### TRN-01b · Panel "Veckoschema" (week planner)

**Current:** Veckoschema: 7 day cells, each with ≤2 session cards made of 4–5 native selects (type, intensity, duration, target, coach).

**Recommendation:** A — Block-based direct manipulation with tap-to-place works with touch and keyboard and shows load immediately.

**Priority:** P0 · **Dependencies:** Session block component, Load calculation

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Block planner

| | |
|---|---|
| Visual concept | Session blocks with type colour, intensity height and duration width; per-day load bar. |
| Layout | 7 columns × 2 slots. |
| Information hierarchy | Week shape. |
| Interactions | Drag or tap palette then tap slot; popover editor; keyboard arrows. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | Day swipe. |
| Advantages | Fast editing; Touch + keyboard |
| Disadvantages | Accessibility of drag needs care |
| Complexity / perf | L / Medium |
| Works with | TRN-01 |
| Fits identities | A, C |
| Patterns | Feedback zone bar |

#### B — Day-focus timeline

| | |
|---|---|
| Visual concept | One day at a time as a vertical timeline (morning/afternoon) with large controls; week mini-map on top. |
| Layout | Mini-map + day timeline. |
| Information hierarchy | Today. |
| Interactions | Swipe days. |
| Navigation | — |
| Desktop | Day + mini-map. |
| Mobile | Native fit. |
| Advantages | Mobile-first |
| Disadvantages | Week overview weaker |
| Complexity / perf | M / Low |
| Works with | TRN-01 |
| Fits identities | B, C |

#### C — Template-first

| | |
|---|---|
| Visual concept | Pick a week template (e.g. "Matchvecka – lördag", "Dubbelmatch") then tweak; load curve shown. |
| Layout | Template cards + grid. |
| Information hierarchy | Template choice. |
| Interactions | Apply, tweak. |
| Navigation | — |
| Desktop | Cards top. |
| Mobile | Template list. |
| Advantages | Quick start |
| Disadvantages | Templates must cover common weeks |
| Complexity / perf | M / Low |
| Works with | TRN-01 |
| Fits identities | C |
| Patterns | Scenario starts with 3 goals |

### TRN-01c · Panel "Spelarberedskap"

**Current:** Spelarberedskap table: energy badge, MF %, "Senaste belastning" (unexplained decaying number), load setting select, individual focus select and status badges.

**Recommendation:** A — Reusing the squad readiness heat-strip unifies the three load numbers and keeps settings inline.

**Priority:** P0 · **Dependencies:** SQD-01c heat-strip, Load semantics decision

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Shared readiness strip + inline settings

| | |
|---|---|
| Visual concept | Same heat-strip as SQD-01c with segmented load setting (Full / Reducerad / Endast återhämtning / Vila) and focus chip per row. |
| Layout | Table. |
| Information hierarchy | Risk, then setting. |
| Interactions | Segmented control; bulk set. |
| Navigation | Shared with SQD-01c. |
| Desktop | Table. |
| Mobile | Player cards with segmented control. |
| Advantages | One readiness language |
| Disadvantages | Requires load unification |
| Complexity / perf | M / Low |
| Works with | SQD-01c, SQD-02d |
| Fits identities | A, C |
| Patterns | Bulk actions + notes on entities |

#### B — Load lanes

| | |
|---|---|
| Visual concept | Four lanes (Full, Reducerad, Återhämtning, Vila) with player chips moved between them; injured/limited chips locked. |
| Layout | Four columns. |
| Information hierarchy | Who is resting. |
| Interactions | Drag or tap-move. |
| Navigation | — |
| Desktop | 4 columns. |
| Mobile | Lane tabs. |
| Advantages | Very touch-friendly |
| Disadvantages | Focus setting needs another place |
| Complexity / perf | M / Low |
| Works with | TRN-01 |
| Fits identities | B, C |

### TRN-01d · Panel "Utveckling"

**Current:** Utveckling table: age, level and potential stars as text, status, latest improvement printed as raw attribute key.

**Recommendation:** A — A leaderboard with Swedish attribute labels and deltas fixes the bug-like issues and shows focus effect.

**Priority:** P1 · **Dependencies:** attributeVocabulary labels

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Development leaderboard

| | |
|---|---|
| Visual concept | Players ranked by recent growth with delta chips ("Avslut 12 → 13"), focus chip and stars as graphic. |
| Layout | Ranked list. |
| Information hierarchy | Biggest gains. |
| Interactions | Tap → SQD-02d. |
| Navigation | → SQD-02d. |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | Rewarding |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | SQD-02d |
| Fits identities | A, C |
| Patterns | Progress reports on development plans |

#### B — Growth small multiples

| | |
|---|---|
| Visual concept | Small chart per player of attribute events over time grouped by family. |
| Layout | Grid. |
| Information hierarchy | Trends. |
| Interactions | Tap. |
| Navigation | → SQD-02d. |
| Desktop | Grid. |
| Mobile | List. |
| Advantages | Visual |
| Disadvantages | Sparse data for most players |
| Complexity / perf | M / Low |
| Works with | SQD-02d |
| Fits identities | B |

### TRN-01e · TrainingFeedback block

**Current:** Collapsed <details> "Senaste träningsutfall" with per-player energy before/after for the latest executed day only.

**Recommendation:** A — Outcomes belong on the executed day itself; this also fixes "Genomförd" badges with no result.

**Priority:** P1 · **Dependencies:** TRN-01b

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Outcome on executed day

| | |
|---|---|
| Visual concept | Executed day cells show average energy delta and attendance; tap opens the per-player table. |
| Layout | In grid. |
| Information hierarchy | Delta. |
| Interactions | Tap day. |
| Navigation | — |
| Desktop | Grid cell. |
| Mobile | Day card. |
| Advantages | History for every day |
| Disadvantages | Needs results stored per day (exists per day) |
| Complexity / perf | S / Low |
| Works with | TRN-01b |
| Fits identities | A, C |

#### B — Training log

| | |
|---|---|
| Visual concept | A log section with day picker and the outcome table. |
| Layout | Picker + table. |
| Information hierarchy | Day. |
| Interactions | Pick day. |
| Navigation | — |
| Desktop | Panel. |
| Mobile | Panel. |
| Advantages | Simple |
| Disadvantages | Separate from the plan |
| Complexity / perf | S / Low |
| Works with | TRN-01 |
| Fits identities | A |

### TRN-01f · Loading state

**Current:** Suspense fallback text "Förbereder träningsveckan…".

**Recommendation:** A — Skeleton grid avoids layout jump.

**Priority:** P3 · **Dependencies:** Skeleton component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Skeleton grid

| | |
|---|---|
| Visual concept | Week grid skeleton with day headers. |
| Layout | Skeleton. |
| Information hierarchy | — |
| Interactions | — |
| Navigation | — |
| Desktop | Grid. |
| Mobile | Day cards. |
| Advantages | No jump |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | TRN-01 |
| Fits identities | A, B, C |

#### B — Last-known plan

| | |
|---|---|
| Visual concept | Show cached plan read-only while loading. |
| Layout | Dimmed grid. |
| Information hierarchy | — |
| Interactions | Disabled. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | Cards. |
| Advantages | Instant content |
| Disadvantages | Stale risk |
| Complexity / perf | S / Low |
| Works with | TRN-01 |
| Fits identities | A |

### TRN-02 · Matchplan & Taktiktavla 2.0

**Current:** Matchplan & Taktiktavla 2.0 (1665-line page): banner, fixture strip, an SVG court with HTML5-only drag chips, three overlapping mode controls (anchor pills, Anfall/Försvar tabs, situation tabs), a "Så spelar vi" rail, set pieces, leadership and the match squad roster at the bottom; emoji icons, no touch drag, no opponent context.

**Recommendation:** A — The board is the heart of match preparation; a single phase × manpower switcher, tap-to-place on a touch court and a readiness header fix every listed weakness. Offer the guided plan (C) as a "Guidad" mode for first runs and phones rather than as the default.

**Priority:** P0 · **Dependencies:** Touch court component (tap-to-place, keyboard), Player chip with overlays, Plan readiness header, MDY-01 match preview, Opponent analysis data (ANL), Remove dead components/matchPlan

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Tactics Board

| | |
|---|---|
| Visual concept | A full-height tactics board: the court is the page. A readiness header ("Trupp 16/16 · MV ✓ · Startsju ✓ · 7 m ✓ · Kapten ✓ · 6v5 –") sits above a single 2×4 phase × manpower switcher (Anfall/Försvar × 6v6 · 6v5 · 5v6 · 7v6) with completion dots. Player chips show the chosen overlay (Energi, Lämplighet, Form, Senaste match) colour-scaled with a legend; specialist exchanges are drawn as pairing lines between attack and defence spots. |
| Layout | Fixture strip with opponent crest; readiness header; left 8/12: switcher + court + bench strip (16 squad chips); right 4/12 rail: "Så spelar vi" with trade-off lines, selected-player detail, opponent tendencies panel. Set pieces and leadership as rail tabs instead of below-the-fold sections. |
| Information hierarchy | 1) Is the plan valid (readiness header). 2) Who stands where in the current phase (court). 3) Style and special roles (rail). |
| Interactions | Tap a chip, then tap a spot or bench slot to place/swap (drag also works, mouse and touch); keyboard: arrow keys move focus across spots, Enter picks/places; long-press a chip = Peek; overlay segmented control; "Auto-fyll" per phase with diff preview; Undo. |
| Navigation | Laget hub › Taktik; fixture strip → MDY-01 "Till matchförberedelse"; opponent crest → club page / opponent analysis; chip → SQD-02 Peek. |
| Desktop | Court ~720 px wide with rail; whole plan visible without scrolling at 1440×900. |
| Mobile | Portrait: readiness header collapses to a progress pill; switcher as a horizontally scrollable 8-chip row; court fills width; bench as a bottom drawer you pull up; rail content in bottom sheets (Stil, 7 m, Ledare). Hit targets ≥ 44 px. |
| Advantages | Fixes no-touch drag and the three overlapping mode controls; Plan validity always visible; Spatial and handball-specific |
| Disadvantages | Largest refactor (split the 1665-line page); Opponent overlay depends on opponent analysis data availability |
| Complexity / perf | XL / Medium |
| Works with | MDY-01, SQD-01, SQD-02, ANL-01, TRN-01 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview; Hover cards for every entity; Control panel per area; Pre-match ritual sequence |

#### B — Coach's Clipboard

| | |
|---|---|
| Visual concept | An immersive clipboard / whiteboard: the plan is a deck of unit cards — Startsju anfall, Försvar 6-0/5-1, Byten, 6 mot 5, 5 mot 6, 7 mot 6, 7-meter, Ledare. Each card flips to a marker-style court with magnet chips you place by tap or drag. Team style is set with chalk dials on the clipboard frame. "Plays" here are the existing units and policies, not new set plays. |
| Layout | Clipboard frame centre (court card), deck of unit cards along the bottom with completion ticks, style dials on the frame edge, squad magnet tray on the side. |
| Information hierarchy | 1) The current unit card. 2) Deck completion. 3) Style dials. |
| Interactions | Swipe or tap through the deck; tap-to-place magnets (large targets); flip card back for a text summary; pinch to zoom court on tablets; satisfying snap feedback (reduced-motion safe). |
| Navigation | Deck "Klar" card leads to MDY-01; fixture card at the top of the deck. |
| Desktop | Clipboard at 900 px centred over a dark tactics-room background; magnet tray left. |
| Mobile | One card per screen, swipe horizontally; magnet tray as bottom drawer; dials in a sheet. |
| Advantages | Most tactile and game-like; Very touch-friendly; Completion per unit obvious |
| Disadvantages | Whole-plan overview weaker than the board; Skeuomorphic art and fonts needed; Data overlays must stay legible on "whiteboard" |
| Complexity / perf | L / Medium |
| Works with | MDY-01, SQD-01 |
| Fits identities | B |
| Patterns | Pre-match ritual sequence; In-match touchline interventions |

#### C — Assistant-guided Match Plan

| | |
|---|---|
| Visual concept | A six-step match plan with the assistant as co-author: 1 Matchtrupp → 2 Startsju → 3 Försvar & stil → 4 Specialsituationer → 5 7 m & ledarskap → 6 Granska. Each step opens pre-filled from the assistant's rotation and auto-fix logic, showing "Assistentens förslag" as a diff against your current plan with reasons (energy, suitability, form). The guard states become steps with fix previews instead of page blocks. |
| Layout | Stepper header with step status; step body (court or list depending on step); assistant note card; sticky footer Föregående / Godkänn förslag / Nästa. Final step is a one-page plan sheet that mirrors the match preview. |
| Information hierarchy | 1) Which step needs attention. 2) Assistant suggestion vs current. 3) Fine-tuning. |
| Interactions | Accept suggestion per step or edit on the same tap-to-place court; skip to any step; "Godkänn allt" for delegators; plan sheet printable/shareable. |
| Navigation | Entered from inbox "Matchplan klar?" or match preview; ends on MDY-01; steps are URL-addressable. |
| Desktop | Stepper left rail, content right. |
| Mobile | Natural fit: one step per screen with sticky footer. |
| Advantages | Best for newcomers and phones; Uses existing assistant rotation; No blocking guard pages |
| Disadvantages | Slower for experts who want everything at once; Assistant suggestions must be explainable |
| Complexity / perf | L / Low |
| Works with | MDY-01, STF-04, WLD-01, TRN-01 |
| Fits identities | C, A |
| Patterns | Pre-match ritual sequence; Staff as faces of systems; "What would make this work?"; Predictive consequence preview |

### TRN-02a · Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup)

**Current:** Five full-page guard states ("Nästa laguttagning väntar.", "Startsjuan behöver fler spelare." …) each with a repair button; the plan cannot be inspected while blocked.

**Recommendation:** A — Inline warnings with an auto-fix preview keep the plan visible and explain the fix.

**Priority:** P0 · **Dependencies:** TRN-02 readiness header

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Inline warning + auto-fix preview

| | |
|---|---|
| Visual concept | A warning bar above the court names the problem; "Åtgärda" shows the proposed change as highlighted chips before applying. |
| Layout | Bar + highlighted court. |
| Information hierarchy | Problem, then fix. |
| Interactions | Preview, apply, undo. |
| Navigation | — |
| Desktop | Bar. |
| Mobile | Sticky bar. |
| Advantages | Plan stays visible; Trust in auto-fix |
| Disadvantages | Each guard needs a preview |
| Complexity / perf | M / Low |
| Works with | TRN-02 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Checklist item with fix drawer

| | |
|---|---|
| Visual concept | Problems appear as red items in the readiness header; tapping opens a drawer with the fix. |
| Layout | Header item + drawer. |
| Information hierarchy | Red item. |
| Interactions | Open drawer, fix. |
| Navigation | — |
| Desktop | Drawer. |
| Mobile | Sheet. |
| Advantages | Consistent with checklist |
| Disadvantages | Less prominent |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | A |

### TRN-02b · Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs)

**Current:** Two large role=tablist tabs "ANFALL (6v6)" / "FÖRSVAR (6v6)" with emoji icons and badges ("6 båda vägar", "n specialister").

**Recommendation:** A — One phase × manpower matrix replaces three overlapping controls and shows completion.

**Priority:** P0 · **Dependencies:** TRN-02 switcher

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Phase × manpower switcher

| | |
|---|---|
| Visual concept | A 2×4 grid (Anfall/Försvar × 6v6, 6v5, 5v6, 7v6) where each cell shows a completion dot and badge. |
| Layout | Compact grid above court. |
| Information hierarchy | Current cell. |
| Interactions | Tap cell; keyboard arrows. |
| Navigation | Replaces anchor pills and situation tabs. |
| Desktop | Grid 8 cells. |
| Mobile | Scrollable chip row. |
| Advantages | One control; Completion visible |
| Disadvantages | 8 cells to label clearly |
| Complexity / perf | S / Low |
| Works with | TRN-02c |
| Fits identities | A, C |
| Patterns | Inform vs navigate separation |

#### B — Court flip

| | |
|---|---|
| Visual concept | A toggle in the court header flips the court between attack half and defence half with a short rotation. |
| Layout | Header toggle. |
| Information hierarchy | Court. |
| Interactions | Tap or swipe to flip. |
| Navigation | Specials separate. |
| Desktop | Toggle. |
| Mobile | Swipe. |
| Advantages | Spatially intuitive |
| Disadvantages | Does not cover manpower situations |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | B |

#### C — Split court

| | |
|---|---|
| Visual concept | Attack and defence mini courts side by side with exchange lines between them. |
| Layout | Two courts. |
| Information hierarchy | Both phases. |
| Interactions | Tap either court. |
| Navigation | — |
| Desktop | Side by side. |
| Mobile | Stacked. |
| Advantages | Shows two-way players |
| Disadvantages | Small courts |
| Complexity / perf | M / Low |
| Works with | TRN-02d |
| Fits identities | A |

### TRN-02c · Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6)

**Current:** Small tabs for 6 mot 5 / 5 mot 6 / 7 mot 6 with situation panel in the rail; no indication if unconfigured.

**Recommendation:** A — Folding situations into the switcher with completion indicators makes gaps visible.

**Priority:** P1 · **Dependencies:** TRN-02b

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Matrix cells with completion

| | |
|---|---|
| Visual concept | Situations live in the phase × manpower grid with dots (klar / ofullständig / standard). |
| Layout | Grid cells. |
| Information hierarchy | Incomplete first. |
| Interactions | Tap cell. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | Chips. |
| Advantages | Gaps visible |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | TRN-02b |
| Fits identities | A, C |

#### B — Situation cards

| | |
|---|---|
| Visual concept | Each situation as a card in the clipboard deck with tick when configured. |
| Layout | Cards. |
| Information hierarchy | Ticks. |
| Interactions | Flip card. |
| Navigation | — |
| Desktop | Deck. |
| Mobile | Swipe. |
| Advantages | Tactile |
| Disadvantages | Tied to B concept |
| Complexity / perf | M / Low |
| Works with | TRN-02 |
| Fits identities | B |

### TRN-02d · Mode "Byten & Diff" (TacticsDiffManager)

**Current:** TacticsDiffManager under the court: who plays both ways, specialist pairs (max 3), clear all; reached only via an anchor pill.

**Recommendation:** A — Pairing lines on the court make exchanges spatial and visible in context.

**Priority:** P1 · **Dependencies:** TRN-02 court

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Pairing lines on court

| | |
|---|---|
| Visual concept | Lines connect attacker spot to defender spot for each specialist pair; counter "2/3 par". |
| Layout | Court overlay + pair list in rail. |
| Information hierarchy | Pairs. |
| Interactions | Tap two chips to pair; tap line to remove. |
| Navigation | — |
| Desktop | Overlay. |
| Mobile | Overlay + sheet list. |
| Advantages | In context |
| Disadvantages | Visual clutter on small courts |
| Complexity / perf | M / Low |
| Works with | TRN-02b |
| Fits identities | A, C |

#### B — Two-way roster

| | |
|---|---|
| Visual concept | List of the starting players with a three-state toggle (Båda vägar / Bara anfall / Bara försvar) and a pairs counter. |
| Layout | List. |
| Information hierarchy | Toggles. |
| Interactions | Toggle. |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Sheet. |
| Advantages | Simple |
| Disadvantages | Not spatial |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | A |

### TRN-02e · Overlay mode selector "Taktikvisning"

**Current:** Inline-styled emoji radiogroup "Taktikvisning" switching chip subtitles (Energi, Lämplighet, Senaste match, Form).

**Recommendation:** A — A proper segmented control with colour scale and legend is accessible and readable.

**Priority:** P1 · **Dependencies:** Player chip overlays

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Segmented control + legend

| | |
|---|---|
| Visual concept | Text segmented control in court header; chips recolour by a sequential scale with a legend. |
| Layout | Header control. |
| Information hierarchy | Legend. |
| Interactions | Tap; keyboard radios. |
| Navigation | — |
| Desktop | Header. |
| Mobile | Compact segmented. |
| Advantages | Accessible; No emoji |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | A, C |

#### B — Chip lens on long-press

| | |
|---|---|
| Visual concept | No global mode: long-press/hover a chip shows all four values in a mini card. |
| Layout | Popover. |
| Information hierarchy | Per player. |
| Interactions | Long-press. |
| Navigation | — |
| Desktop | Hover. |
| Mobile | Long-press. |
| Advantages | Less chrome |
| Disadvantages | No squad-wide pattern view |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | B |
| Patterns | Hover cards for every entity |

### TRN-02f · Rail "Så spelar vi" (CoachingChoices)

**Current:** Rail "Så spelar vi": fieldsets of segmented choices (defence system 6-0/5-1, aggression, tempo, attack identity, rotation, 7v6 policy), a summary line and Assistentbyten on/off; no trade-off explanations.

**Recommendation:** A — Keeping explicit segmented controls but adding one trade-off line per option (reusing TimeoutOverlay copy) gives understanding without hiding precision.

**Priority:** P0 · **Dependencies:** TimeoutOverlay copy, Opponent data (optional)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Choices with trade-off lines

| | |
|---|---|
| Visual concept | Segmented controls with a trade-off sentence under the selected option ("Hög aggression: fler bollvinster, fler 2-minuters"). |
| Layout | Fieldsets in rail. |
| Information hierarchy | Defence system, then tempo/aggression. |
| Interactions | Tap; summary updates. |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Bottom sheet. |
| Advantages | Precise and explained |
| Disadvantages | Copy work |
| Complexity / perf | S / Low |
| Works with | MDY-02 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Style dials with target band

| | |
|---|---|
| Visual concept | Tempo and aggression as dials with a suggested band against this opponent. |
| Layout | Dial row. |
| Information hierarchy | Dials. |
| Interactions | Turn dial. |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Sheet. |
| Advantages | Game-like |
| Disadvantages | Needs new data: opponent-based target band; Choices are discrete, dials imply continuous |
| Complexity / perf | M / Low |
| Works with | ANL-01 |
| Fits identities | B |
| Patterns | Feedback zone bar |

#### C — Identity sentence

| | |
|---|---|
| Visual concept | Style as a sentence with tappable words: "Vi försvarar [5-1], spelar [högt tempo], pressar [aggressivt] och roterar [ofta]." |
| Layout | Sentence block. |
| Information hierarchy | Sentence. |
| Interactions | Tap word to cycle options. |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Readable summary and control in one |
| Disadvantages | Discoverability of tappable words |
| Complexity / perf | S / Low |
| Works with | MDY-01 |
| Fits identities | C |

### TRN-02g · Section "Fasta situationer · 7-meter" (SetPieceSection)

**Current:** Section "Fasta situationer · 7-meter": ordered selects for penalty takers, below the fold.

**Recommendation:** A — An ordered list with 7 m conversion stats makes the choice informed; shot facts already carry SEVEN_METRE kind.

**Priority:** P1 · **Dependencies:** Shot facts aggregation

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Ordered takers with stats

| | |
|---|---|
| Visual concept | Ordered list with 7 m goals/attempts this season per candidate; reorder by drag or up/down buttons. |
| Layout | Rail tab list. |
| Information hierarchy | Order, then stats. |
| Interactions | Reorder. |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Sheet. |
| Advantages | Informed |
| Disadvantages | Aggregation needed |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A, C |

#### B — Takers at the goal

| | |
|---|---|
| Visual concept | Mini goal graphic with numbered taker chips. |
| Layout | Graphic. |
| Information hierarchy | Order. |
| Interactions | Tap to reorder. |
| Navigation | — |
| Desktop | Rail. |
| Mobile | Card. |
| Advantages | Visual |
| Disadvantages | No stats |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | B |

### TRN-02h · Section "Ledarskap" (LeadershipSection)

**Current:** Section "Ledarskap": captain, vice-captain and leadership effect; duplicates captaincy on the squad page.

**Recommendation:** A — One roles editor used from both squad tray and tactics removes duplication.

**Priority:** P2 · **Dependencies:** SQD-01e tray

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Single roles editor

| | |
|---|---|
| Visual concept | Shared component: Kapten, Vice, 7 m first taker, with leadership effect note. |
| Layout | Rail tab. |
| Information hierarchy | Captain. |
| Interactions | Pick from squad chips. |
| Navigation | Same in SQD-01 tray. |
| Desktop | Rail. |
| Mobile | Sheet. |
| Advantages | One truth |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | SQD-01e |
| Fits identities | A, C |

#### B — Armband on the board

| | |
|---|---|
| Visual concept | Drag or tap-place the armband on a court chip. |
| Layout | Court token. |
| Information hierarchy | Armband. |
| Interactions | Tap armband then chip. |
| Navigation | — |
| Desktop | Court. |
| Mobile | Court. |
| Advantages | Playful |
| Disadvantages | Vice role less visible |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | B |

### TRN-02i · Roster "Matchtrupp · n spelare" / "Ej uttagna"

**Current:** Roster "Matchtrupp · n spelare" / "Ej uttagna" as two columns at the bottom of the page; squad size validation only surfaces in match preview.

**Recommendation:** A — A persistent bench strip with a 16-slot counter keeps squad selection next to the court and validates it immediately.

**Priority:** P0 · **Dependencies:** TRN-02 readiness header, Player chip

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Bench strip + counter

| | |
|---|---|
| Visual concept | 16 slots under the court (7 on court + 9 bench) with counter; "Ej uttagna" in a pull-up drawer sorted by readiness. |
| Layout | Strip under court + drawer. |
| Information hierarchy | Counter. |
| Interactions | Tap-to-place between court, bench and drawer. |
| Navigation | — |
| Desktop | Strip. |
| Mobile | Bottom drawer. |
| Advantages | Always visible; Immediate validation |
| Disadvantages | Space under court |
| Complexity / perf | M / Low |
| Works with | MDY-01, SQD-01 |
| Fits identities | A, C |

#### B — Two-column readiness roster

| | |
|---|---|
| Visual concept | Selected and not-selected lists with readiness chips, moving players between them. |
| Layout | Two columns. |
| Information hierarchy | Counts. |
| Interactions | Tap-move. |
| Navigation | — |
| Desktop | Two columns. |
| Mobile | Tabs. |
| Advantages | Clear lists |
| Disadvantages | Separated from court |
| Complexity / perf | S / Low |
| Works with | SQD-01c |
| Fits identities | A |

#### C — Squad selection step

| | |
|---|---|
| Visual concept | Squad selection as step 1 of the guided plan with readiness-sorted suggestions. |
| Layout | Step page. |
| Information hierarchy | Suggestions. |
| Interactions | Accept/edit. |
| Navigation | Guided mode. |
| Desktop | Step. |
| Mobile | Step. |
| Advantages | Guided |
| Disadvantages | Only in guided mode |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | C |
| Patterns | Pre-match ritual sequence |

## REC — Scouting & transfers

### REC-01 · Scouting & Motståndaranalys — HI-FI prototype `scouting`

**Current:** Long single-column page: ScoutingCentre hero (spotlight discovery, stats, need-based recommendations, scout workload) stacked above a market-stage band with overlapping counters, then seven panels (Dina scouter, Ny bevakning, Nytt bredare uppdrag, Aktiva uppdrag, Färdiga rapporter, Breda uppdrag, Upptäckta spelare). "Öppna rapport" lands on the player profile; the title promises Motståndaranalys that is not here.

**Recommendation:** C — The scouting loop is about turning fog into a decision. Shortlist & Reports gives reports a real home (fixing the "Öppna rapport → profile" dead end), keeps one pipeline strip instead of three lists, and hands shortlisted players straight to the transfer flow. A's search table stays available as the "Sök" mode inside it.

**Priority:** P1 · **Dependencies:** G2 navigation model, Knowledge range bar (star range that tightens with Kännedom), Peek drawer, Unified "Kortlista" naming across REC/SQD, REC-02 pipeline states, Rename page to "Scouting" (move Motståndaranalys to ANL-03)

**Arena Nights (owner identity, 2026-11-13):** adapt → *Scout Desk* — Keep pipeline strip, report feed and ranked Kortlista. Report cards with scout tag (not byline), confidence ring, verdict with glow; selected shortlist row lit in club neon. _Conflict:_ 'Editorial scouting desk': reports as articles with bylines.

#### A — Search Workbench

| | |
|---|---|
| Visual concept | A power-user instrument: one filter bar and one ranked table of every known player, with scouts as assignable resources in a right rail. Fog of war is a column, not a paragraph: ability/potential shown as star-range bars that narrow as Kännedom rises. |
| Layout | Top: query bar with saved filters (position MV/VS/VN/MN/HN/HS/M, ålder, liga, nation, kännedom-nivå). Centre: table (Spelare, Pos, Ålder, Klubb, Kännedom meter, Förmåga range, Potential range, Värde range, Status). Right rail: scouts with workload pips and a drop zone; below it the active-assignment queue with ETA. |
| Information hierarchy | 1) Ranked results for the current need filter. 2) Scout capacity (who is free). 3) Running assignments and fresh reports badge. |
| Interactions | Multi-select rows → "Scouta" with chosen scout; drag a row onto a scout card to assign; Kortlista toggle per row (bulk too); saved filter chips ("Behov: VN under 24"); broad assignment is a "Spara som bevakning" action on any filter (club/competition/nation/position+max age). |
| Navigation | Rows open the Peek drawer (report summary + "Hela rapporten"); "Lägg bud" deep-links REC-04. Lives under Rekrytering hub tab "Scouting"; ⌘K "scouta <namn>". |
| Desktop | Dense hairline table, sticky header, keyboard row navigation, column chooser, density toggle. |
| Mobile | Ranked cards (name, pos, star-range bar, kännedom ring); filter chips in a bottom sheet; scouts become a horizontal capacity strip; long-press = Peek. |
| Advantages | Fastest path from need to assignment; Makes fog of war visible and sortable; Replaces the Ny bevakning search + Upptäckta table with one table |
| Disadvantages | Least narrative; reports still feel like rows; Risk of becoming a fourth market table unless it is the shared table component |
| Complexity / perf | M / Low |
| Works with | REC-02, REC-03b, SQD-03, SQD-02 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting; Bulk actions + notes on entities; Command palette / global search |

#### B — Scouting Board

| | |
|---|---|
| Visual concept | The scouting office wall: a kanban of player cards moving Upptäckt → Bevakas → Rapport klar → Kortlista, with scout faces pinned to the cards they work on. Each card shows a star-range that visibly tightens between columns. |
| Layout | Header strip with scout portraits and workload rings. Four columns of cards. A "Nytt uppdrag" tray on the right for broad assignments (club/competition/nation/position). |
| Information hierarchy | 1) Cards in "Rapport klar" (new news). 2) Scout availability. 3) Discovery column volume. |
| Interactions | Drag card between columns (Bevakas = assign scout; Kortlista = shortlist); drop a card on a scout face to assign; click card → flip to report summary; broad assignments appear as "sweep" tiles that spawn cards over time. |
| Navigation | "Lägg bud" on any Kortlista card goes to REC-04; card overflow menu → Jämför (SQD-04), profil (SQD-02). |
| Desktop | Full-width board with horizontal scroll per column, card density switch (bust/compact). |
| Mobile | One column at a time with segmented tabs and counts; swipe card right to promote; scouts in a top carousel. |
| Advantages | Pipeline legible at a glance (inventory opportunity); Tactile, game-like; Merges three list panels into one board |
| Disadvantages | Poor for scanning 200 discoveries; needs a list fallback; Drag targets weak on touch; Portrait-hungry (needs scout/player imagery) |
| Complexity / perf | L / Medium |
| Works with | REC-02, SQD-02, STF-01 |
| Fits identities | B |
| Patterns | Staff as faces of systems; Attribute bars + numbers, fogged by scouting |

#### C — Shortlist & Reports

| | |
|---|---|
| Visual concept | Editorial scouting desk: finished scout reports are articles (kicker, headline verdict, confidence, strengths/weaknesses in words, value range) and the Kortlista is a ranked column beside them. A thin pipeline strip on top replaces the three list panels and the duplicate counters. |
| Layout | Top: pipeline strip (Upptäckta n · Under scouting n · Rapporter n · Kortlista n) and scout faces with free/busy. Left 8 cols: "Nya rapporter" feed of report cards (scout byline, confidence %, knowledge-gain bar from → to). Right 4 cols: Kortlista ranked by priority with need tag; below it "Ge ett uppdrag" compact form. |
| Information hierarchy | 1) Newest report verdicts. 2) Kortlista and what is ready to bid on. 3) Scout capacity and new assignment. |
| Interactions | Open report → standalone report view (Peek → full page) with "Lägg på kortlistan", "Scouta igen", "Lägg bud"; priority reorder by drag in Kortlista; "Ge ett uppdrag" accepts a player, a club, a competition, a nation or position+age in one field (typeahead) and shows expected duration where known. |
| Navigation | Kortlista is the same list REC-03 and SQD-02 use (renamed from "Bevakade"). Report links from inbox (WLD-01) open the same report view. Week Spine pins show when assignments finish. |
| Desktop | Two-column journal grid; reports as framed cards with scout portrait byline. |
| Mobile | Today-style feed of report cards; Kortlista as a second tab; sticky "Nytt uppdrag" button opening a bottom sheet. |
| Advantages | Fixes the report dead end with a real report view; One pipeline instead of 7 panels; Feeds directly into transfer flow via Kortlista |
| Disadvantages | Needs good generated verdict copy from ScoutReportView recommendation text; Expected duration needs new data: assignment duration estimate unless derivable from scout ability |
| Complexity / perf | M / Low |
| Works with | REC-02, REC-03, REC-04, WLD-01, WLD-05, SQD-02 |
| Fits identities | C, A |
| Patterns | Attribute bars + numbers, fogged by scouting; Staff as faces of systems; Bulk actions + notes on entities |

### REC-01a · ScoutingCentre ("Scoutingcentralen")

**Current:** ScoutingCentre hero: spotlight on the newest discovery, stats, need-based recommendations with star ranges, scout workload rail, latest discoveries; duplicates the counters below it.

**Recommendation:** B — Making the centre the page (as the inventory suggests) only works if it collapses into one header; a need-driven recommendation strip is the useful part to keep.

**Priority:** P2 · **Dependencies:** REC-01 recommendation

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Compact header strip

| | |
|---|---|
| Visual concept | Reduce the hero to a single status strip: counters + free scouts + "n nya rapporter". |
| Layout | One row of 4 metric tiles above the page body. |
| Information hierarchy | Counts first; everything else moves to the page body. |
| Interactions | Each tile filters the body. |
| Navigation | Tiles are filters, not navigation (inform vs navigate). |
| Desktop | 48px strip. |
| Mobile | Horizontal scroll chips. |
| Advantages | Removes duplication |
| Disadvantages | Loses the spotlight moment |
| Complexity / perf | S / Low |
| Works with | REC-01 |
| Fits identities | A |
| Patterns | Inform vs navigate separation |

#### B — Need-driven recommendations rail

| | |
|---|---|
| Visual concept | Keep only "Rekommendationer för truppbehov": positions where depth is thin (from Truppbehov) each with 2–3 suggested players with star ranges. |
| Layout | Row of position cards (e.g. VN: 1 spelare) each listing candidates. |
| Information hierarchy | Position need → candidate → action. |
| Interactions | Kortlista / Scouta per candidate; "Visa fler" opens filtered search. |
| Navigation | Links to SQD-01f depth. |
| Desktop | Up to 4 need cards. |
| Mobile | Swipeable need cards. |
| Advantages | Ties scouting to squad need; Unique value of the current hero kept |
| Disadvantages | Depends on recommendation quality |
| Complexity / perf | S / Low |
| Works with | REC-01, REC-03d, SQD-01 |
| Fits identities | A, C |

### REC-01b · Panel "Dina scouter"

**Current:** List of scouts with suitability x/20 and active assignment count; duplicates the "Scouterna" rail in ScoutingCentre.

**Recommendation:** A — One scout component, reused everywhere, removes the duplicate and shows capacity in the same visual as the board.

**Priority:** P2 · **Dependencies:** Staff star/scale decision (x/20 vs stars)

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Scout capacity cards

| | |
|---|---|
| Visual concept | Scout card: face, suitability on one scale (pick 1–20 or stars consistently), workload pips (assignments), next finish date. |
| Layout | Horizontal row of cards. |
| Information hierarchy | Free/busy first, then quality. |
| Interactions | Card is a drop target for assignments; click → staff profile. |
| Navigation | "Rekrytera scout" as trailing ghost card → staff recruitment. |
| Desktop | Row in page header. |
| Mobile | Carousel. |
| Advantages | Single source; Doubles as assignment target |
| Disadvantages | Needs the scale decision |
| Complexity / perf | S / Low |
| Works with | REC-01, STF-01 |
| Fits identities | A, B, C |
| Patterns | Staff as faces of systems |

#### B — Merged into staff peek

| | |
|---|---|
| Visual concept | Remove the panel; scouts appear only as avatars in the assignment form and open a Peek drawer. |
| Layout | None on page. |
| Information hierarchy | - |
| Interactions | Avatar → Peek. |
| Navigation | Staff hub owns the list. |
| Desktop | - |
| Mobile | - |
| Advantages | Less page length |
| Disadvantages | Capacity not visible at decision time |
| Complexity / perf | S / Low |
| Works with | STF-01 |
| Fits identities | A |

### REC-01c · Panel "Ny bevakning"

**Current:** Targeted assignment: search, 6-column table (Spelare, Pos, Ålder, Klubb, Kännedom, Välj), scout select, start; ?target= preselects; errors as plain text.

**Recommendation:** B — Assignment should be an action on a player, not a separate search; a one-step sheet reached from any player mention removes a whole table.

**Priority:** P1 · **Dependencies:** Peek drawer, Player action menu

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Inline in Search Workbench

| | |
|---|---|
| Visual concept | Merge into REC-01 A table: select rows → choose scout → start. |
| Layout | Action bar appears on selection. |
| Information hierarchy | Selection count, scout picker, start. |
| Interactions | Bulk assign; validation inline on the action bar. |
| Navigation | ?target= preselects row. |
| Desktop | Sticky action bar. |
| Mobile | Bottom action bar. |
| Advantages | No duplicate table |
| Disadvantages | Requires A layout |
| Complexity / perf | S / Low |
| Works with | REC-01 |
| Fits identities | A |
| Patterns | Bulk actions + notes on entities |

#### B — "Scouta" action sheet

| | |
|---|---|
| Visual concept | From any player chip (profile, market, discoveries, ⌘K) open a small sheet: player summary with current Kännedom, scout picker showing suitability and queue length, expected knowledge after report. |
| Layout | Popover/sheet, 3 rows. |
| Information hierarchy | Player + current fog → scout choice → start. |
| Interactions | One click start; errors inline next to the field. |
| Navigation | Return to where you were; assignment appears in pipeline and Week Spine. |
| Desktop | Anchored popover. |
| Mobile | Bottom sheet. |
| Advantages | Zero navigation; Works from every surface |
| Disadvantages | Expected knowledge needs new data: projected knowledge gain per scout |
| Complexity / perf | S / Low |
| Works with | SQD-02, REC-03c, REC-02a |
| Fits identities | A, C |
| Patterns | Hover cards for every entity; Predictive consequence preview |

### REC-01d · Panel "Nytt bredare uppdrag"

**Current:** Broad assignment builder: type buttons CLUB/COMPETITION/NATION/POSITION with conditional fields, max age and scout; no estimate of duration or yield.

**Recommendation:** B — A map of coverage turns an abstract form into a visible plan and shows where scouts already are.

**Priority:** P2 · **Dependencies:** Competition/nation list, REC-01 layout

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Sentence builder

| | |
|---|---|
| Visual concept | "Låt [scout] bevaka [vänstersexor] under [23] i [Allsvenskan]" — each bracket a dropdown. |
| Layout | One sentence form + start. |
| Information hierarchy | Sentence reads as the assignment. |
| Interactions | Tokens open pickers. |
| Navigation | Creates a sweep in the pipeline. |
| Desktop | Inline in Ge ett uppdrag. |
| Mobile | Each token opens a sheet. |
| Advantages | Readable; Compact |
| Disadvantages | Less discoverable for combos |
| Complexity / perf | S / Low |
| Works with | REC-01 |
| Fits identities | C, A |

#### B — Coverage map

| | |
|---|---|
| Visual concept | League/nation tiles (Handbollsligan, Allsvenskan, other nations) shaded by current scouting coverage; pick a tile → choose position/age → scout. |
| Layout | Tile grid left, config right. |
| Information hierarchy | Uncovered areas stand out. |
| Interactions | Click tile to start a sweep; hover shows active sweeps. |
| Navigation | Tiles link to CMP-01 for that competition. |
| Desktop | Grid of competition tiles. |
| Mobile | List of competitions with coverage bars. |
| Advantages | Shows where scouts are (inventory opportunity) |
| Disadvantages | Coverage shading needs new data: aggregated knowledge per competition (derivable) |
| Complexity / perf | M / Low |
| Works with | REC-01, CMP-01 |
| Fits identities | B, C |

### REC-01e · Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag"

**Current:** Three separate list panels for one pipeline: Aktiva uppdrag (progress), Färdiga rapporter (knowledge meter), Breda uppdrag (with cancel).

**Recommendation:** A — A single pipeline component (also used by REC-02) is the structural fix; the timeline view is a strong optional lens.

**Priority:** P1 · **Dependencies:** REC-02 pipeline states, Week Spine component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Single pipeline list

| | |
|---|---|
| Visual concept | One list grouped by status (Pågår · Klar · Svep) with a progress bar and the scout face per row. |
| Layout | Grouped list with section headers and counts. |
| Information hierarchy | Ready reports first. |
| Interactions | Open report; cancel sweep; re-scout. |
| Navigation | Reports open report view, not profile. |
| Desktop | Panel in right column. |
| Mobile | Accordion groups. |
| Advantages | One mental model |
| Disadvantages | Still a list |
| Complexity / perf | S / Low |
| Works with | REC-01, REC-02 |
| Fits identities | A, C |

#### B — Assignment timeline

| | |
|---|---|
| Visual concept | Gantt-like rows per scout across the next weeks with report-due markers, aligned with the Week Spine. |
| Layout | Scouts as rows, days as columns. |
| Information hierarchy | What finishes when. |
| Interactions | Click bar → assignment; drag not allowed (no rescheduling in game). |
| Navigation | Matches calendar (WLD-05). |
| Desktop | Full-width timeline. |
| Mobile | Vertical list by due date. |
| Advantages | Shows timing |
| Disadvantages | Duration data may be estimate only |
| Complexity / perf | M / Low |
| Works with | WLD-05 |
| Fits identities | C |

### REC-01f · Panel "Upptäckta spelare"

**Current:** Discoveries table (Spelare, Klubb, Källa, Scout, Kännedom) with filters by scout and assignment type; no ability column.

**Recommendation:** A — Add the star-range column and sort, and make it the same table component as the market.

**Priority:** P1 · **Dependencies:** Shared market table component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Ranked discoveries table

| | |
|---|---|
| Visual concept | Add Förmåga/Potential star-range bars and sort by "bäst kända först" or by need. |
| Layout | Table with filter chips. |
| Information hierarchy | Quality range → kännedom → source. |
| Interactions | Sort, filter, Kortlista toggle, Scouta. |
| Navigation | Same component as REC-03b/SQD-03. |
| Desktop | Hairline table. |
| Mobile | Ranked cards. |
| Advantages | Fixes missing column; Reduces table variants |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-03b, SQD-03 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting |

#### B — Discovery card wall by position

| | |
|---|---|
| Visual concept | Cards grouped by position lane (MV, VS, VN, MN, HN, HS, M). |
| Layout | 7 lanes. |
| Information hierarchy | Position gaps visible. |
| Interactions | Card → Peek; Kortlista. |
| Navigation | - |
| Desktop | Lanes horizontal. |
| Mobile | Position tabs. |
| Advantages | Squad-need framing |
| Disadvantages | Weak at volume |
| Complexity / perf | M / Medium |
| Works with | REC-01 |
| Fits identities | B |

### REC-02 · Rekryteringscentrum

**Current:** Recruitment pipeline page: numbered stage strip (Alla, Nya fynd, Under scouting, Scoutade, Kortlista, Prioriterade, Aktiva förhandlingar), a 10-column candidate table and a long 4-panel dossier column. Stage state is local (not deep-linkable) and the table overlaps Spelarsök and Transfer Centre.

**Recommendation:** C — This is where the inconsistent shortlist naming and the three market tables converge. Making REC-02 the one pipeline board ("Kortlista" end to end, Förhandling lane fed by REC-04) gives the flow a spine; market browsing stays in REC-03.

**Priority:** P0 · **Dependencies:** Unified "Kortlista" naming, Shared market table component, Peek drawer, URL state for stage (?stage=), REC-04 negotiation states

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Pipeline table with stage tabs

| | |
|---|---|
| Visual concept | Keep the table but fix it: stage tabs in the URL, the shared market table component with knowledge-gated ranges, dossier as a right drawer instead of a 4-panel column. |
| Layout | Stage tabs (with counts) → table (12 cols) → slide-over dossier. |
| Information hierarchy | Stage counts → candidates → selected dossier. |
| Interactions | Deep-linkable stages; inline priority (1–3) and note; bulk "Scouta"; row → drawer. |
| Navigation | Stage URLs usable from inbox and ⌘K ("kortlista"). |
| Desktop | Full-width table, drawer overlays 480px. |
| Mobile | Stage dropdown + ranked cards; drawer as full-screen sheet. |
| Advantages | Minimal change, quick win; Fixes deep-linking |
| Disadvantages | Still a fourth table look unless shared component lands |
| Complexity / perf | S / Low |
| Works with | REC-01, REC-03, SQD-03 |
| Fits identities | A |
| Patterns | Bulk actions + notes on entities |

#### B — Recruitment war room

| | |
|---|---|
| Visual concept | A big board with player busts per stage and a "target wall" for the current window: budget remaining, positions to fill, and the 3 priority targets as hero cards. |
| Layout | Hero row: window status + budget + 3 priority targets. Below: stage lanes of busts. |
| Information hierarchy | Priority targets → budget → wider pipeline. |
| Interactions | Drag between lanes; promote to Prioriterad via star; click → Peek. |
| Navigation | Hero card CTA "Förhandla" → REC-04. |
| Desktop | Dark broadcast board. |
| Mobile | Priority targets carousel then stage tabs. |
| Advantages | Emotional focus on the few targets that matter |
| Disadvantages | Asset hungry; Lanes weak with large volumes |
| Complexity / perf | L / Medium |
| Works with | REC-04, REC-03 |
| Fits identities | B |

#### C — Unified pipeline board

| | |
|---|---|
| Visual concept | One funnel from discovery to signature: Upptäckt → Scoutas → Rapport → Kortlista → Förhandling → Klar. Each column header shows count and a micro-insight ("2 rapporter klara"). The Förhandling lane shows the deal stage (Klubben/Spelaren) and whose move it is. |
| Layout | Six compact columns with dense rows (not big cards); dossier in Peek drawer; top-right budget mini-meter (budget, committed, wage room). |
| Information hierarchy | 1) "Ditt drag" cards in Förhandling. 2) Kortlista ranked. 3) Upstream volume. |
| Interactions | Drag to promote/demote (respecting real transitions only: scouting starts an assignment, Kortlista toggles shortlist, Förhandling opens REC-04); filter by position chips across all lanes; notes and priority inline. |
| Navigation | Clicking a Förhandling row opens REC-04; REC-01 reports drop into the Rapport lane; same Kortlista used in REC-03 and SQD-02. |
| Desktop | Six columns at ≥1280px, collapsing upstream lanes to counters below. |
| Mobile | Funnel summary bar (6 counts) → tap a stage → list; "Ditt drag" pinned on top. |
| Advantages | Makes the whole recruitment flow one visible spine; Resolves Bevakade/Kortlista naming; Surfaces whose move it is |
| Disadvantages | Drag semantics must map to real actions (no fake stages); Needs stage in URL and pipeline status helper shared with REC-04 |
| Complexity / perf | M / Low |
| Works with | REC-01, REC-03, REC-04, SQD-02, WLD-01 |
| Fits identities | C, A |
| Patterns | Inbox as task queue; Bulk actions + notes on entities; Consolidated threads |

### REC-02a · Candidate dossier

**Current:** Stack of 4 panels (assessment, scouting box, priority & note, transfer) below/next to the table; long and duplicating profile content.

**Recommendation:** A — A drawer that summarises only what is decision-relevant for recruitment, with one link to the full profile.

**Priority:** P1 · **Dependencies:** Peek drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Recruitment Peek drawer

| | |
|---|---|
| Visual concept | Drawer: identity, knowledge-gated star ranges with confidence, scout verdict line, value range, contract end, priority + note, then actions (Scouta, Kortlista, Förhandla). |
| Layout | Header, 3 compact sections, sticky action footer. |
| Information hierarchy | Verdict and ranges → contract/value → actions. |
| Interactions | Inline note editing; priority 1–3 toggle. |
| Navigation | "Hela profilen" → SQD-02. |
| Desktop | 480px slide-over. |
| Mobile | Full-screen sheet, swipe down to close. |
| Advantages | No duplication; Same drawer on every market surface |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-03c, SQD-02 |
| Fits identities | A, C |
| Patterns | Hover cards for every entity; Attribute bars + numbers, fogged by scouting |

#### B — Dossier as tabbed column

| | |
|---|---|
| Visual concept | Keep a fixed column but tabbed (Bedömning · Scouting · Anteckning · Transfer). |
| Layout | Right column with tabs. |
| Information hierarchy | Tab 1 assessment. |
| Interactions | Tabs. |
| Navigation | - |
| Desktop | Fixed 360px column. |
| Mobile | Below list. |
| Advantages | Always visible |
| Disadvantages | Hides actions behind tabs |
| Complexity / perf | S / Low |
| Works with | REC-02 |
| Fits identities | A |

### REC-03 · Transfer Centre — HI-FI prototype `transfers`

**Current:** Very long Transfer Centre: incoming-sales board first, then a budget band, urgent negotiation cards, market tabs (Möjligheter / Hela marknaden / Bevakade) with an 8-column table, a dossier aside and four side panels. Shortlist is called "Bevakade" here; this is the third market table in the game.

**Recommendation:** A — The market needs to be the fastest, most trustworthy table in the game and the single shared market component (retiring the parallel ones). Splitting Köp / Sälj / Affärer as modes removes the sell board from the top, and the deal panel keeps negotiation one click away. The pipeline itself lives in REC-02.

**Priority:** P0 · **Dependencies:** Shared market table component (also SQD-03, REC-01f, REC-02), Budget waterfall component, Peek/deal drawer, Unified "Kortlista" naming, URL state for mode and tab

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Market Table + Deal Panel

| | |
|---|---|
| Visual concept | A trading terminal for handball: one canonical market table with knowledge-gated quality ranges and value ranges, a persistent budget waterfall (transferbudget → bundet → kvar; lönerum) and a right Deal Panel that turns the selected player into a decision. |
| Layout | Header: mode switch Köp · Sälj · Affärer, budget waterfall. Köp: tabs Möjligheter / Hela marknaden / Kortlista, filter row, table (Spelare, Pos, Ålder, Klubb, Kontrakt till, Förmåga range, Värde range, Intresse, Status). Right: Deal Panel (selected player: ranges, interest assessment, contract, "Förhandla", "Föreslå lån", "Kortlista", "Jämför"). |
| Information hierarchy | 1) Budget headroom. 2) Market rows ranked by need fit. 3) Selected player's deal readiness. |
| Interactions | Keyboard row nav updates panel; disabled actions show the reason as visible text in the panel (not a tooltip); position chips; "Endast utgående kontrakt"; bulk Kortlista. |
| Navigation | Sälj mode holds IncomingOffersBoard (REC-03a); Affärer mode holds ongoing negotiations and recent deals (REC-03d). "Förhandla" → REC-04. Mode/tab in URL. |
| Desktop | Table 8/12, panel 4/12, sticky budget header. |
| Mobile | Mode segmented control; ranked cards with value range; Deal Panel becomes a bottom sheet with sticky "Förhandla". |
| Advantages | One market table for the whole game; Budget always in sight; Selling no longer blocks buying |
| Disadvantages | Less atmosphere; Requires migrating other tables to the shared component |
| Complexity / perf | M / Low |
| Works with | REC-02, REC-04, REC-05, SQD-03, SQD-04 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting; Control panel per area; Predictive consequence preview; Density modes |

#### B — Deal Room

| | |
|---|---|
| Visual concept | The transfer window as an event: a dark room with the deadline clock, the budget as a big number, "Ditt drag" deals as glowing cards and the rest of the market behind a "Marknaden" door. |
| Layout | Hero: window countdown + budget. Row: active deals as large cards (crest ↔ crest, stage, next response date). Below: incoming bids strip; market as a secondary full page. |
| Information hierarchy | 1) Deadline & budget. 2) Live deals needing you. 3) Incoming bids. |
| Interactions | Deal card → REC-04; bid chip → REC-05; "Gå till marknaden" opens market table. |
| Navigation | Top hub page under Rekrytering; market is one level deeper. |
| Desktop | Full-bleed broadcast layout with ticker of league deals (Senaste affärer). |
| Mobile | Swipeable deal cards; sticky deadline bar. |
| Advantages | Strong window drama; Puts urgency first |
| Disadvantages | Market browsing one level deeper; Ticker needs league-wide deal data (exists as Senaste affärer, own club only? verify) |
| Complexity / perf | L / Medium |
| Works with | REC-04, REC-05, DSH-01 |
| Fits identities | B |
| Patterns | Continue button as heartbeat; Consolidated threads |

#### C — Transfer Desk Pipeline

| | |
|---|---|
| Visual concept | A desk organised by deal stage: Kortlista → Bud lagt → Klubben svarar → Spelarens villkor → Klar, with selling deals mirrored in a second lane. Each row is a consolidated thread of all rounds for that player. |
| Layout | Two swimlanes (Köp, Sälj) × stage columns; budget meter top-right; market search as a slide-in. |
| Information hierarchy | Rows where it is your move, then waiting rows with response dates. |
| Interactions | Expand row → round history; act inline (accept counter / adjust) for simple steps, open REC-04 for full terms. |
| Navigation | Mirrors REC-02 C; Week Spine shows response dates. |
| Desktop | Lanes full width. |
| Mobile | Stage list with "Ditt drag" first. |
| Advantages | Every deal's state visible; Inline actions on simple counters |
| Disadvantages | Overlaps REC-02 C pipeline – choose one home; Market discovery is secondary |
| Complexity / perf | M / Low |
| Works with | REC-02, REC-04, REC-05, WLD-05 |
| Fits identities | C |
| Patterns | Consolidated threads; Inbox as task queue |

### REC-03a · Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard)

**Current:** IncomingOffersBoard always first on Transfer Centre: bid list with respond-by CTA plus four mini-lists (Vill lämna, Transferlistan, Förhandsavtal, Senaste avgångar).

**Recommendation:** A — Moving it to a Sälj mode solves the "always first" problem; urgent bids still surface via a badge and the inbox.

**Priority:** P1 · **Dependencies:** REC-03 modes

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Sälj mode

| | |
|---|---|
| Visual concept | A dedicated Sälj tab: bids sorted by respond-by date with fee vs market value delta and squad impact chip; the four mini-lists as compact columns below. |
| Layout | Bid list on top, 4 columns below. |
| Information hierarchy | Deadline → fee → impact. |
| Interactions | Open bid → REC-05; badge count on mode switch. |
| Navigation | Inbox bid messages deep-link here/REC-05. |
| Desktop | Full width. |
| Mobile | Bid cards; mini-lists as accordions. |
| Advantages | Removes clutter from buying; Clear deadline order |
| Disadvantages | Impact chip needs depth data (exists in Truppbehov) |
| Complexity / perf | S / Low |
| Works with | REC-05, WLD-01 |
| Fits identities | A, C |
| Patterns | Inbox as task queue |

#### B — Urgent-bid banner only

| | |
|---|---|
| Visual concept | Show only a slim banner "2 bud väntar på svar" on Köp; the rest lives in the inbox. |
| Layout | Banner. |
| Information hierarchy | Count + nearest deadline. |
| Interactions | Banner → REC-05 list. |
| Navigation | Inbox-first. |
| Desktop | Banner. |
| Mobile | Banner. |
| Advantages | Minimal |
| Disadvantages | Lists like Vill lämna lose a home |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | A |

### REC-03b · Market tabs (Möjligheter / Hela marknaden / Bevakade)

**Current:** role=tablist with three market lists and counts; featured cards for opportunities; filters only on full market; tab state not in URL.

**Recommendation:** A — A single table with tabs as saved views is the efficient choice; tabs and filters must persist in the URL.

**Priority:** P0 · **Dependencies:** Shared market table component, URL state

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Saved views over one table

| | |
|---|---|
| Visual concept | Tabs become saved views (Möjligheter, Hela marknaden, Kortlista, plus user-saved) over the same table with the same filters. |
| Layout | View chips + filters + table. |
| Information hierarchy | Active view → rows. |
| Interactions | Filters everywhere; save view; URL state. |
| Navigation | Deep-linkable. |
| Desktop | Chips row. |
| Mobile | View dropdown. |
| Advantages | Consistent; Power user friendly |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-03 |
| Fits identities | A |
| Patterns | Bookmarks + configurable landing |

#### B — Opportunity spotlight carousel

| | |
|---|---|
| Visual concept | Möjligheter as large featured cards (expiring contract, low value, need fit) above the table. |
| Layout | Carousel + table. |
| Information hierarchy | Featured first. |
| Interactions | Swipe; Kortlista. |
| Navigation | - |
| Desktop | 3 cards. |
| Mobile | Swipe deck. |
| Advantages | Inviting |
| Disadvantages | Can bias toward few players |
| Complexity / perf | S / Medium |
| Works with | REC-03 |
| Fits identities | B |

#### C — Need-first view

| | |
|---|---|
| Visual concept | Market grouped by squad need (positions where depth is thin first), each group a short ranked list. |
| Layout | Group headers by position. |
| Information hierarchy | Need → candidates. |
| Interactions | Expand group. |
| Navigation | Links depth chart. |
| Desktop | Grouped table. |
| Mobile | Grouped cards. |
| Advantages | Ties to Truppbehov |
| Disadvantages | Hides non-need bargains |
| Complexity / perf | S / Low |
| Works with | SQD-01 |
| Fits identities | C |

### REC-03c · Dossier aside (TransferDossier)

**Current:** Non-modal aside with close button: knowledge-gated view, interest assessment, negotiate/loan/watch/compare/profile actions; disabled reasons only in tooltip.

**Recommendation:** A — Unify with the recruitment Peek so every market surface uses one deal drawer with visible blocked reasons.

**Priority:** P0 · **Dependencies:** Peek drawer

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Deal drawer

| | |
|---|---|
| Visual concept | Slide-over with the deal readiness checklist: Kännedom (≥ tier?), Budget räcker?, Klubbens intresse, Fönster öppet — each with a visible ✓/✕ and reason, then actions. |
| Layout | Header, ranges, readiness checklist, actions. |
| Information hierarchy | Can I bid? → why not → actions. |
| Interactions | Fix-it links (e.g. "Scouta först"). |
| Navigation | Förhandla → REC-04. |
| Desktop | 480px drawer. |
| Mobile | Sheet. |
| Advantages | Disabled reasons visible; Same drawer everywhere |
| Disadvantages | Checklist items must reflect real guards only |
| Complexity / perf | S / Low |
| Works with | REC-02a, REC-04 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Player card flip

| | |
|---|---|
| Visual concept | Selected row expands into an inline card with bust and key numbers. |
| Layout | Expanded row. |
| Information hierarchy | Card. |
| Interactions | Collapse. |
| Navigation | - |
| Desktop | Inline. |
| Mobile | Inline. |
| Advantages | No overlay |
| Disadvantages | Pushes table |
| Complexity / perf | S / Low |
| Works with | REC-03 |
| Fits identities | B |

### REC-03d · Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer)

**Current:** Four side panels: Förhandlingar (next step), Truppbehov (players per position vs need), Marknadspuls (14-day responses), Senaste affärer.

**Recommendation:** B — Truppbehov is best shown on a court; negotiations belong to Affärer mode.

**Priority:** P1 · **Dependencies:** Court component, REC-03 modes

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Affärer mode

| | |
|---|---|
| Visual concept | Move all four into the Affärer mode as a dashboard: negotiations list, pulse sparkline, recent deals. |
| Layout | 2×2 grid. |
| Information hierarchy | Negotiations first. |
| Interactions | Open deal. |
| Navigation | REC-04. |
| Desktop | Grid. |
| Mobile | Stack. |
| Advantages | Clean Köp mode |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-04 |
| Fits identities | A |

#### B — Need heat-map on court

| | |
|---|---|
| Visual concept | Truppbehov drawn on a mini court: each position zone coloured by depth (players / need), clicking filters the market. |
| Layout | Mini court in the Köp header. |
| Information hierarchy | Red zones = needs. |
| Interactions | Click zone → filter. |
| Navigation | SQD-01 depth. |
| Desktop | Header widget. |
| Mobile | Compact court chip row. |
| Advantages | Handball-native; Turns need into filter |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | SQD-01, REC-03b |
| Fits identities | A, C |
| Patterns | Inform vs navigate separation |

### REC-04 · Förhandlingsrum (negotiation room)

**Current:** Förhandlingsrum: photo hero with parties, ProgressSteps (Klubben → Spelaren/Speltiden → Signering/Lånet), deadline clock, two party asides around a decision section, a timeline of rounds, acquisition summary with training compensation, DealCompletion moment. No visible acceptance range beyond counters; answers require leaving the room to advance time.

**Recommendation:** A — Negotiation is a numbers decision under uncertainty. The Term Sheet puts our offer, their counter and our knowledge-gated value range on the same axis, keeps the round history visible, and adds an inline "advance to answer" so the user never leaves the room. C's editorial ledger is a good secondary lens for history.

**Priority:** P0 · **Dependencies:** Range slider with band component, Shared negotiation pattern (renewals SQD-05, staff STF-02b), Continue/advance-day service callable inline, Budget waterfall component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Term Sheet

| | |
|---|---|
| Visual concept | A two-column term sheet: left "Vårt bud", right "Deras krav" (club then player), aligned row by row (Övergångssumma, Lön/månad, År, Signeringsbonus, Utlovad roll). Each money row has a slider over a band showing the knowledge-gated market value range and the last counter as a marker. |
| Layout | Header: parties (crest ↔ crest, player chip) + stepper + deadline. Main: term-sheet grid with gap column ("skiljer 120 000 kr"). Right: budget waterfall impact (fee + wage over contract vs remaining budget/lönerum) and training compensation. Bottom: round history (compact). |
| Information hierarchy | 1) Gap between us and them per term. 2) Budget consequence. 3) History and deadline. |
| Interactions | Drag slider or type; "Möt motbudet" snaps to their marker; "Lägg budet" / "Lägg fram villkoren"; "Dra dig ur" behind confirm; waiting state shows "Svar väntas tor 14/3" with inline "Spela fram till svaret". |
| Navigation | Back to REC-03/REC-02; completion → DealCompletion → squad/tactics. Same component reused for renewals (SQD-05) and staff hiring (STF-02b). |
| Desktop | Grid 8/12 + impact panel 4/12; numbers tabular mono. |
| Mobile | One term per card with slider; sticky footer with gap total and primary CTA; impact in a collapsible bar. |
| Advantages | Makes the gap legible; Shows budget impact before committing; Removes need to leave the room |
| Disadvantages | Acceptance zone beyond counters needs new data: acceptance probability — do not show; Slider precision on mobile needs steppers |
| Complexity / perf | M / Low |
| Works with | REC-03, REC-02, SQD-05, STF-02b, WLD-05 |
| Fits identities | A |
| Patterns | Predictive consequence preview; "What would make this work?"; Continue button as heartbeat |

#### B — Across the Table

| | |
|---|---|
| Visual concept | A face-to-face meeting: the selling club's director (then the player and agent) sit opposite you; each round is a short exchange of speech bubbles carrying the numbers, and their mood is shown by posture/expression. |
| Layout | Full-bleed scene with two portraits; centre: current proposal card; bottom: offer controls. |
| Information hierarchy | 1) Their latest words + number. 2) Your offer card. 3) Deadline. |
| Interactions | Adjust numbers in the offer card; submit plays the exchange; counters appear as replies with "Möt" button. |
| Navigation | Stage transition (club → player) is a scene change. |
| Desktop | Cinematic 16:9 stage, numbers in a lower-third card. |
| Mobile | Chat-like vertical exchange; offer controls in a bottom sheet. |
| Advantages | Emotional and memorable; Rounds are naturally a conversation |
| Disadvantages | Mood expression needs new data unless mapped from response type; Portrait pipeline required; Slower for repeated negotiations |
| Complexity / perf | L / Medium |
| Works with | REC-04e |
| Fits identities | B |
| Patterns | Fewer, weightier conversations; Staff as faces of systems |

#### C — Deal Ledger

| | |
|---|---|
| Visual concept | The negotiation as a dated ledger: every round is a numbered entry (date, who, terms, response), with the current decision as an open entry at the bottom and a one-paragraph "Läget just nu" summary written from the state. |
| Layout | Left 8: ledger timeline with numbered decision card at the end. Right 4: parties, deadline, acquisition summary. |
| Information hierarchy | 1) "Läget just nu" sentence. 2) Open decision. 3) History. |
| Interactions | Fill the open entry; counters are entries you can "accept" with one click; inline advance-day. |
| Navigation | Ledger also embedded in inbox thread for the player (consolidated). |
| Desktop | Journal column with rules. |
| Mobile | Vertical ledger, decision card sticky at bottom. |
| Advantages | History and reasoning clear; Fits inbox consolidation |
| Disadvantages | Gap and budget impact less visual than A |
| Complexity / perf | M / Low |
| Works with | WLD-01, REC-03 |
| Fits identities | C |
| Patterns | Consolidated threads; Inbox as task queue |

### REC-04a · Start decision "Inled förhandling"

**Current:** Deal-type radiogroup (Permanent / Lån) and "Öppna förhandlingen", plus cooldown and own-player text variants.

**Recommendation:** A — Show the consequences of each deal type before opening, and give cooldown/own-player proper states.

**Priority:** P1 · **Dependencies:** REC-04 layout

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Two choice cards

| | |
|---|---|
| Visual concept | Permanent vs Lån as two cards each listing what will be negotiated (fee vs wage share % + end date) and the knowledge-gated value range. |
| Layout | Two cards + CTA. |
| Information hierarchy | Choice → what follows. |
| Interactions | Select card, open. |
| Navigation | ?deal=LOAN preselects. |
| Desktop | Side by side. |
| Mobile | Stacked. |
| Advantages | Clear consequence |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-04 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Blocked-state cards

| | |
|---|---|
| Visual concept | Cooldown and own-player become styled states with reason, date when possible again, and an alternative action (Kortlista, påminn mig). |
| Layout | Status card. |
| Information hierarchy | Reason → date → alternative. |
| Interactions | Set reminder (calendar pin). |
| Navigation | Week Spine pin. |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | No dead end |
| Disadvantages | Reminder needs new data: user reminders |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | A, C |

### REC-04b · Decision form – club stage

**Current:** Club-stage form: fee (or loan wage share %, end date) with knowledge-gated value range default; counter "meet" button; % as number input.

**Recommendation:** A — A slider over the value-range band with the counter marker is the clearest way to place a bid.

**Priority:** P0 · **Dependencies:** Range slider with band component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Range-band slider

| | |
|---|---|
| Visual concept | Fee slider over the market value range band (min–max from scout report), with markers: their last counter, our last bid, budget limit. |
| Layout | Slider + number field + markers legend. |
| Information hierarchy | Where my bid sits vs range and counter. |
| Interactions | Drag, type, snap to counter; loan: % slider 0–100 + date picker limited to season. |
| Navigation | - |
| Desktop | Wide slider. |
| Mobile | Slider + ± steppers. |
| Advantages | Visual negotiation |
| Disadvantages | Range width depends on knowledge (good: shows uncertainty) |
| Complexity / perf | S / Low |
| Works with | REC-04 |
| Fits identities | A |
| Patterns | Attribute bars + numbers, fogged by scouting |

#### B — Offer presets

| | |
|---|---|
| Visual concept | Three preset chips (Lågt / Marknadsvärde / Säkert) computed from the range, plus custom. |
| Layout | Chips + field. |
| Information hierarchy | Preset choice. |
| Interactions | Pick preset, adjust. |
| Navigation | - |
| Desktop | Chips. |
| Mobile | Chips. |
| Advantages | Fast |
| Disadvantages | Presets may imply certainty we do not have |
| Complexity / perf | S / Low |
| Works with | REC-04 |
| Fits identities | C, B |

#### C — Counter-proposal helper

| | |
|---|---|
| Visual concept | "Vad krävs?" button that pre-fills the last counter and shows the delta to budget. |
| Layout | Helper row under the form. |
| Information hierarchy | Delta. |
| Interactions | One click apply. |
| Navigation | - |
| Desktop | Inline. |
| Mobile | Inline. |
| Advantages | Removes guesswork |
| Disadvantages | Only uses existing counter data |
| Complexity / perf | S / Low |
| Works with | REC-04 |
| Fits identities | A, C |
| Patterns | "What would make this work?" |

### REC-04c · Decision form – player stage

**Current:** Player-stage form: wage/month, years 1–5, signing bonus, promised role; acquisition summary; dense.

**Recommendation:** A — Term rows with a total-cost readout make the trade-off between wage, years and bonus explicit.

**Priority:** P0 · **Dependencies:** Squad role tiers, Budget waterfall component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Package builder with total cost

| | |
|---|---|
| Visual concept | Rows for Lön, År (1–5 segmented), Bonus, Utlovad roll (role tiers with squad context "du har 2 VN i rotation"); live total "Kostnad över kontraktet" and wage-budget bar. |
| Layout | Form left, total & budget right. |
| Information hierarchy | Total cost → role promise → individual terms. |
| Interactions | Steppers, segmented years, role select with consequence note (promise tracked later). |
| Navigation | Promise later shown on PlayerTransferCard. |
| Desktop | 8/4 split. |
| Mobile | Stack; total sticky. |
| Advantages | Trade-off visible; Role promise has context |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-04, SQD-01 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Agent card

| | |
|---|---|
| Visual concept | Agent portrait with their stated demand per row and a short quote; your counter per row. |
| Layout | Agent card + rows. |
| Information hierarchy | Their demand. |
| Interactions | Match/adjust per row. |
| Navigation | - |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Personal |
| Disadvantages | Agent persona needs new data: agent identity |
| Complexity / perf | M / Medium |
| Works with | REC-04 |
| Fits identities | B |

#### C — Contract document

| | |
|---|---|
| Visual concept | Terms rendered as a draft contract paragraph with editable blanks. |
| Layout | Document. |
| Information hierarchy | Readable contract. |
| Interactions | Edit blanks. |
| Navigation | - |
| Desktop | Paper document. |
| Mobile | Document. |
| Advantages | Charming, clear |
| Disadvantages | Slower to scan |
| Complexity / perf | S / Low |
| Works with | REC-04 |
| Fits identities | C |

### REC-04d · Waiting / closed status

**Current:** "Inget att göra just nu" while the other party considers, plus closed labels (refused, expired, withdrawn); only "continue in calendar".

**Recommendation:** A — Waiting is where users leave the room; an inline advance to the response date keeps the flow.

**Priority:** P0 · **Dependencies:** Continue/advance service

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Waiting card with advance

| | |
|---|---|
| Visual concept | Card: "Kristianstad svarar senast tor 14/3" + "Spela fram till svaret" (advances days, stops on any other event) + what happens in between (matches, training) as Week Spine preview. |
| Layout | Card + mini spine. |
| Information hierarchy | When → advance → what is skipped. |
| Interactions | Advance; stops early on interrupts. |
| Navigation | Week Spine. |
| Desktop | Card. |
| Mobile | Card + sticky advance. |
| Advantages | Keeps user in flow |
| Disadvantages | Must respect continue blockers |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | A, C |
| Patterns | Continue button as heartbeat; Play menu as season state machine |

#### B — Closed outcome card

| | |
|---|---|
| Visual concept | Closed states as a summary: outcome, final terms gap, "Försök igen från" date if cooldown. |
| Layout | Outcome card. |
| Information hierarchy | Outcome → reason → next. |
| Interactions | Back to market/Kortlista. |
| Navigation | REC-03. |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Closure |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-03 |
| Fits identities | A, C |

### REC-04e · Deal completed (DealCompletion)

**Current:** DealCompletion photo moment with deal summary and next steps (profile, squad, plan lineup, back).

**Recommendation:** A — Short skippable celebration, then straight into the useful next step.

**Priority:** P2 · **Dependencies:** Floodlight moment component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Signing moment

| | |
|---|---|
| Visual concept | 1.5–3 s floodlight moment: crest, player, "Klar för [klubb]", key terms, then next-step buttons. |
| Layout | Hero + 3 CTAs. |
| Information hierarchy | Headline → terms → next. |
| Interactions | Skippable; Esc. |
| Navigation | SQD-02 / TRN-02. |
| Desktop | Overlay. |
| Mobile | Full-screen. |
| Advantages | Emotional payoff |
| Disadvantages | Motion budget |
| Complexity / perf | S / Medium |
| Works with | SQD-02, TRN-02 |
| Fits identities | B, C |

#### B — Inline confirmation

| | |
|---|---|
| Visual concept | In-place success state in the term sheet with a toast and next steps. |
| Layout | State. |
| Information hierarchy | Confirmed. |
| Interactions | - |
| Navigation | - |
| Desktop | Inline. |
| Mobile | Inline. |
| Advantages | Fast |
| Disadvantages | Flat |
| Complexity / perf | S / Low |
| Works with | REC-04 |
| Fits identities | A |

### REC-05 · Bud på din spelare (incoming offer)

**Current:** Incoming offer page: player header, "Varför de vill ha honom", bid history, financial & sporting effect (text), DecisionCard (accept/counter/reject/withdraw), sold moment; bare not-found panel.

**Recommendation:** A — The sell decision hinges on squad impact; showing depth before/after next to the money makes it concrete.

**Priority:** P1 · **Dependencies:** Court/depth chart component, Term sheet component (REC-04)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Sell decision sheet

| | |
|---|---|
| Visual concept | Money vs squad: left money (bid vs market value vs contract remaining, wage saved), right a mini depth chart for his position before/after sale; DecisionCard below with counter slider. |
| Layout | Header, two-column impact, decision. |
| Information hierarchy | Impact → bid → decision. |
| Interactions | Counter with slider; accept/reject confirm. |
| Navigation | Back to Sälj mode. |
| Desktop | 6/6 impact, decision full width. |
| Mobile | Impact as two tabs; sticky decision. |
| Advantages | Concrete trade-off |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-03a, SQD-01 |
| Fits identities | A |
| Patterns | Predictive consequence preview |

#### B — Bidding-war scene

| | |
|---|---|
| Visual concept | Bidding club as opponent card, history as escalating bids, decision as big buttons. |
| Layout | Hero + history. |
| Information hierarchy | Latest bid. |
| Interactions | Buttons. |
| Navigation | - |
| Desktop | Broadcast. |
| Mobile | Stack. |
| Advantages | Drama |
| Disadvantages | Hides impact |
| Complexity / perf | M / Medium |
| Works with | REC-05a |
| Fits identities | B |

#### C — Ledger thread

| | |
|---|---|
| Visual concept | Same ledger pattern as REC-04 C, with "Läget" sentence. |
| Layout | Ledger + decision. |
| Information hierarchy | Summary. |
| Interactions | Respond. |
| Navigation | Inbox thread. |
| Desktop | Column. |
| Mobile | Ledger. |
| Advantages | Consistent with buying |
| Disadvantages | Impact less visual |
| Complexity / perf | S / Low |
| Works with | REC-04, WLD-01 |
| Fits identities | C |
| Patterns | Consolidated threads |

### REC-05a · Sold moment (MomentHero "Såld")

**Current:** MomentHero "Såld" departure announcement after completion.

**Recommendation:** A — Short, respectful farewell with the useful follow-up (depth gap).

**Priority:** P3 · **Dependencies:** Floodlight moment component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Farewell card

| | |
|---|---|
| Visual concept | Floodlight card: "Tack, [namn]" with seasons at club, goals, fee; then "Fyll luckan" link to market filtered by position. |
| Layout | Hero + CTA. |
| Information hierarchy | Farewell → next need. |
| Interactions | Skippable. |
| Navigation | REC-03b filtered. |
| Desktop | Overlay. |
| Mobile | Full-screen. |
| Advantages | Closure + action |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-03 |
| Fits identities | B, C |

#### B — News item

| | |
|---|---|
| Visual concept | No overlay; the sale becomes a news item and inbox entry. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | Inbox. |
| Desktop | - |
| Mobile | - |
| Advantages | Quiet |
| Disadvantages | No moment |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | A |

## CMP — Competition

### CMP-01 · Tävlingar (competition workspace) — HI-FI prototype `competition`

**Current:** Tävlingar workspace: CompetitionHero, competition switcher + meta pills, six link-tabs (Tabell & form, Matcher, Resultat, Spelarstatistik, Klubbar, Historik), main panel + rail (Din klubb i ligan, Omgång n, Senaste resultat, Skytteligan top 5). /competitions and /competitions/[id] render the same thing; the cup uses a different layout; statistics duplicate /career/statistics.

**Recommendation:** A — The table is the heart of the season and must be fast, exact and honest about what each position means (SM-slutspel, kval, nedflyttning). League Centre adds zone lines, position arrows and a points-gap chart on top of the existing data, gives /competitions a real overview of all competitions, and unifies league and cup under one shell.

**Priority:** P0 · **Dependencies:** G2 navigation model, Competition rules → zone lines (SM-slutspel / kval / nedflyttning) from the season transition planner, Per-round standings derived from results, Shared stats component with CMP-04, CMP-01g cup shell

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — League Centre

| | |
|---|---|
| Visual concept | A data-forward competition centre: the standings table is the hero, annotated with qualification zones (SM-slutspel spots, kvalserie, nedflyttning) as coloured rules, position-change arrows since last round and a compact points-gap chart showing your distance to the line above and below. |
| Layout | Overview route: grid of competition cards (Handbollsligan, Allsvenskan, Svenska Cupen, other leagues) with your club's status. Detail: header (switcher, round x/y, next round date) → tabs (Tabell · Matcher · Resultat · Statistik · Klubbar · Historik) → main table 8/12 + rail 4/12 (Din klubb: position, gap to playoff line, next 3 fixtures with opponent position; Omgång n; Skytteligan). |
| Information hierarchy | 1) Your row and the nearest zone line. 2) Whole table with form. 3) Next round. |
| Interactions | Toggle table views (Total / Hemma / Borta / Form senaste 5); hover a row → club Peek; click a gap bar → show the fixtures that decide it; tabs in URL. |
| Navigation | Tävling hub landing = overview; each card → detail. Rows → club (Peek), fixtures → CMP-02/ANL-01. Statistik tab and CMP-04 share one component. |
| Desktop | Sticky table header, tabular numerals, zone rules full-width, rail sticky. |
| Mobile | Compact table (#, Klubb, M, MSK, P, form dots) with horizontal scroll for the rest; your row pinned; zone legend chips; rail content becomes "Din klubb" card above the table. |
| Advantages | Table becomes decision-relevant (zones, gap); Fixes missing all-competitions overview; Fast, accessible |
| Disadvantages | Position arrows need per-round standings (derivable from results; compute, do not store); Less atmospheric |
| Complexity / perf | M / Low |
| Works with | CMP-01a, CMP-01g, CMP-04, CMP-02, DSH-01 |
| Fits identities | A |
| Patterns | Inform vs navigate separation; Hover cards for every entity; Density modes |

#### B — Broadcast League Hub

| | |
|---|---|
| Visual concept | The league as a TV product: a big standings graphic in club colours, "Omgångens match" hero, a results ticker and storylines (streaks, top scorer race). |
| Layout | Hero: featured match of the round. Then broadcast-style standings (crest columns, large numerals), results ticker, storyline cards. |
| Information hierarchy | 1) Featured fixture. 2) Standings graphic. 3) Storylines. |
| Interactions | Swipe rounds; tap club → spotlight; tap storyline → player/club. |
| Navigation | Top hub page "Arena"; deep stats one level down. |
| Desktop | Full-bleed dark hub. |
| Mobile | Card stack per round; standings as vertical crest list. |
| Advantages | Atmosphere; Good for screenshots |
| Disadvantages | Storylines need generated copy; Dense data harder to read; Asset hungry |
| Complexity / perf | L / Medium |
| Works with | DSH-01, CMP-02 |
| Fits identities | B |
| Patterns | Broadcast camera / view switcher; Era- or tier-skinned news |

#### C — Competition Almanac

| | |
|---|---|
| Visual concept | An editorial almanac per competition: season overview page with a "Läget i serien" lead paragraph, the table with zone annotations in the margin, and the season as a round-by-round strip; history tab as past seasons' champions. |
| Layout | Journal grid: lead + table (8) with margin notes (4); round strip below; past champions roll in Historik. |
| Information hierarchy | 1) Lead sentence. 2) Table. 3) Round strip. |
| Interactions | Click a round in the strip → that round's results and table snapshot. |
| Navigation | Peek drawer for clubs; Week Spine shows rounds. |
| Desktop | Paper layout, serif headlines. |
| Mobile | Lead, table, rounds swipe. |
| Advantages | Story and context; Round strip is a natural season timeline (inventory opportunity) |
| Disadvantages | Lead copy generation needed; Table snapshot per round needs derivation |
| Complexity / perf | M / Low |
| Works with | CMP-01f, WLD-05 |
| Fits identities | C |
| Patterns | Era- or tier-skinned news |

### CMP-01a · Tab "Tabell & form"

**Current:** Standings table #, Klubb, SM, V, O, F, GM, IM, MSK, P, Form (five latest) with own club highlighted.

**Recommendation:** A — Zone lines and arrows are cheap and make every position meaningful.

**Priority:** P0 · **Dependencies:** Competition rules for zones

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Annotated standings

| | |
|---|---|
| Visual concept | Table with zone rules (SM-slutspel, kval, nedflyttning) labelled in the left gutter, ▲▼ since last round, form dots with result tooltips. |
| Layout | Table. |
| Information hierarchy | Own row, zones. |
| Interactions | Sort, Hemma/Borta toggle. |
| Navigation | Row → club Peek. |
| Desktop | Sticky header. |
| Mobile | Pinned own row, compact columns. |
| Advantages | Meaning at a glance |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | CMP-01 |
| Fits identities | A, C |

#### B — Points ladder

| | |
|---|---|
| Visual concept | Vertical ladder chart: clubs placed by points so gaps are physical distances; zone bands behind. |
| Layout | Ladder chart beside table. |
| Information hierarchy | Gaps. |
| Interactions | Hover club. |
| Navigation | - |
| Desktop | Chart 4/12. |
| Mobile | Ladder replaces table as toggle. |
| Advantages | Gaps visible |
| Disadvantages | Ties overlap |
| Complexity / perf | M / Low |
| Works with | CMP-01 |
| Fits identities | A, B |

#### C — Race chart

| | |
|---|---|
| Visual concept | Position by round line chart (bump chart) for the season. |
| Layout | Chart under table. |
| Information hierarchy | Trajectory. |
| Interactions | Highlight club. |
| Navigation | - |
| Desktop | Full width. |
| Mobile | Own club + neighbours only. |
| Advantages | Season story |
| Disadvantages | Needs per-round standings (derivable) |
| Complexity / perf | M / Low |
| Works with | CMP-01 |
| Fits identities | C |

### CMP-01b · Tab "Matcher"

**Current:** Upcoming fixtures in a FixtureTable.

**Recommendation:** A — Round-grouped list with own fixtures emphasised is enough.

**Priority:** P2 · **Dependencies:** Fixture row component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Round-grouped fixtures

| | |
|---|---|
| Visual concept | Group by Omgång with date headers; own match highlighted; opponent table position chip. |
| Layout | Grouped list. |
| Information hierarchy | Next round first. |
| Interactions | Row → CMP-02/MDY-01 for own. |
| Navigation | Own next fixture → match prep. |
| Desktop | List. |
| Mobile | Cards. |
| Advantages | Scannable |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | CMP-02, MDY-01 |
| Fits identities | A, C |

#### B — Fixture grid

| | |
|---|---|
| Visual concept | Matrix of home vs away clubs with dates/results. |
| Layout | Grid. |
| Information hierarchy | Full season. |
| Interactions | Cell → match. |
| Navigation | - |
| Desktop | Grid. |
| Mobile | Not on mobile (list). |
| Advantages | Complete |
| Disadvantages | Heavy |
| Complexity / perf | M / Low |
| Works with | CMP-01 |
| Fits identities | A |

### CMP-01c · Tab "Resultat"

**Current:** Played fixtures in a FixtureTable.

**Recommendation:** A — Results by round, each linking to the report.

**Priority:** P2 · **Dependencies:** Fixture row component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Results by round

| | |
|---|---|
| Visual concept | Grouped results with score, half-time score where available, link to report. |
| Layout | Grouped list. |
| Information hierarchy | Latest round. |
| Interactions | Row → ANL-01. |
| Navigation | - |
| Desktop | List. |
| Mobile | Cards. |
| Advantages | Simple |
| Disadvantages | Half-time score needs archive data |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A, C |

#### B — Round recap cards

| | |
|---|---|
| Visual concept | Each round as a card: results + biggest win + table movers. |
| Layout | Cards. |
| Information hierarchy | Recap. |
| Interactions | Expand. |
| Navigation | - |
| Desktop | Cards grid. |
| Mobile | Stack. |
| Advantages | Story |
| Disadvantages | Movers derivation |
| Complexity / perf | S / Low |
| Works with | CMP-01 |
| Fits identities | B, C |

### CMP-01d · Tab "Spelarstatistik"

**Current:** StatisticsTable with metric select, minimum filter and 12 columns; duplicates /career/statistics.

**Recommendation:** A — Share the CMP-04 component with a competition parameter.

**Priority:** P2 · **Dependencies:** CMP-04 component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Shared stats component

| | |
|---|---|
| Visual concept | Embed CMP-04 leaderboards scoped to this competition. |
| Layout | Leader cards + table. |
| Information hierarchy | Leaders. |
| Interactions | Metric, minimum, position filter. |
| Navigation | - |
| Desktop | As CMP-04. |
| Mobile | As CMP-04. |
| Advantages | No duplication |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | CMP-04 |
| Fits identities | A |

#### B — Link out

| | |
|---|---|
| Visual concept | Replace tab with a deep link to CMP-04?competition=. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | CMP-04. |
| Desktop | - |
| Mobile | - |
| Advantages | Less code |
| Disadvantages | Context switch |
| Complexity / perf | S / Low |
| Works with | CMP-04 |
| Fits identities | A |

### CMP-01e · Tab "Klubbar"

**Current:** Three-column club list (club, city, squad count).

**Recommendation:** A — A crest grid with Peek is more useful for browsing (especially non-simulated leagues used for recruitment).

**Priority:** P3 · **Dependencies:** Peek drawer

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Crest grid with Peek

| | |
|---|---|
| Visual concept | Crest tiles with city and table position; click → Peek with squad and "Scouta klubben". |
| Layout | Grid. |
| Information hierarchy | Crests. |
| Interactions | Peek; start broad assignment (club). |
| Navigation | REC-01d. |
| Desktop | Grid. |
| Mobile | 2-col grid. |
| Advantages | Recruitment entry |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-01d |
| Fits identities | B, C |

#### B — Sortable club table

| | |
|---|---|
| Visual concept | Add position, squad size, average age. |
| Layout | Table. |
| Information hierarchy | - |
| Interactions | Sort. |
| Navigation | - |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | Data |
| Disadvantages | Avg age derivation |
| Complexity / perf | S / Low |
| Works with | CMP-01 |
| Fits identities | A |

### CMP-01f · Tab "Historik"

**Current:** Links to finished seasons or EmptyState.

**Recommendation:** A — A roll of honour gives history meaning.

**Priority:** P3 · **Dependencies:** Season archive

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Roll of honour

| | |
|---|---|
| Visual concept | Per season: champion, your finish, top scorer; link to season page. |
| Layout | List. |
| Information hierarchy | Champion. |
| Interactions | Open season. |
| Navigation | /career/history. |
| Desktop | List. |
| Mobile | List. |
| Advantages | Meaningful |
| Disadvantages | Top scorer per season needs archive (verify) |
| Complexity / perf | S / Low |
| Works with | MGR-01 |
| Fits identities | C, A |

#### B — Season timeline

| | |
|---|---|
| Visual concept | Horizontal timeline of seasons with your finishing position line. |
| Layout | Timeline. |
| Information hierarchy | Trend. |
| Interactions | Click season. |
| Navigation | - |
| Desktop | Chart. |
| Mobile | Vertical. |
| Advantages | Visual |
| Disadvantages | Few seasons early |
| Complexity / perf | S / Low |
| Works with | MGR-01 |
| Fits identities | C |

### CMP-01g · Svenska Cupen variant (CupWorkspace)

**Current:** CupWorkspace for Svenska Cupen: "Din väg i cupen", next cup matches, group tables (#, Lag, M, +/-, P), fixtures/results, previous winners; different structure from leagues, h1 inside a section, no bracket.

**Recommendation:** A — Cup format is group stage then knockout; a stage-aware path view (groups → bracket) inside the same League Centre shell fixes both the visual gap and the layout inconsistency.

**Priority:** P1 · **Dependencies:** CMP-01 shell, Cup format data (groups + knockout rounds)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Stage path + bracket

| | |
|---|---|
| Visual concept | Same shell as leagues; main area shows the stage timeline (Gruppspel → Åttondel → Kvart → Semi → Final) with your current position, group tables during the group stage, and a bracket once knockouts are drawn. |
| Layout | Stage stepper top; group tables grid or bracket below; rail: next cup match, previous winners. |
| Information hierarchy | Where we are in the cup → next match → others. |
| Interactions | Click bracket node → match; hover path highlights your route. |
| Navigation | Same tabs as leagues. |
| Desktop | Bracket full width. |
| Mobile | Bracket as round-by-round swipe; own path pinned. |
| Advantages | Fixes "no bracket" weakness; Consistent shell |
| Disadvantages | Bracket only where knockout fixtures exist; unresolved slots shown as "Vinnare av …" |
| Complexity / perf | M / Low |
| Works with | CMP-01, CMP-02 |
| Fits identities | A, C |

#### B — Cup run story

| | |
|---|---|
| Visual concept | "Din väg i cupen" as a vertical path of your matches with scores, ending in the next opponent and the trophy. |
| Layout | Vertical path. |
| Information hierarchy | Own run. |
| Interactions | Tap match. |
| Navigation | - |
| Desktop | Path + groups. |
| Mobile | Path. |
| Advantages | Emotional |
| Disadvantages | Others' bracket hidden |
| Complexity / perf | S / Low |
| Works with | CMP-02 |
| Fits identities | B, C |

#### C — Draw night

| | |
|---|---|
| Visual concept | Floodlight treatment for draws and knockout rounds with crests in a bracket. |
| Layout | Bracket hero. |
| Information hierarchy | Bracket. |
| Interactions | - |
| Navigation | - |
| Desktop | Hero. |
| Mobile | Hero. |
| Advantages | Moment |
| Disadvantages | Draw animation needs draw events (verify) |
| Complexity / perf | M / Medium |
| Works with | DSH-01 |
| Fits identities | B |

### CMP-01h · Non-simulated league / not found states

**Current:** "Ej simulerad · ingen tabell" pill with note to explore clubs; "Tävlingen hittades inte."

**Recommendation:** A — Turn non-simulated leagues into an explicit scouting destination.

**Priority:** P3 · **Dependencies:** REC-01d

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Scouting-destination state

| | |
|---|---|
| Visual concept | Explain not simulated; show clubs grid and "Starta bevakning i ligan" CTA. |
| Layout | Notice + clubs + CTA. |
| Information hierarchy | Why → what you can do. |
| Interactions | Start broad assignment. |
| Navigation | REC-01d. |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Purposeful |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | REC-01d, CMP-01e |
| Fits identities | A, C |

#### B — Not-found with way out

| | |
|---|---|
| Visual concept | Not-found with competition list and back link. |
| Layout | Card. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | CMP-01 overview. |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | No dead end |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | CMP-01 |
| Fits identities | A |

### CMP-02 · Match (fixture page)

**Current:** Neutral fixture page: heading with date/teams/result, two club panels (table position, form dots, FixtureTable), link to report; thin; Training wrongly links here as "Matchförberedelse".

**Recommendation:** A — A compact head-to-head match card serves neutral fixtures; the user's own next fixture should redirect to MDY-01.

**Priority:** P2 · **Dependencies:** Redirect own next fixture to MDY-01, Head-to-head derivation from results

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Head-to-head card

| | |
|---|---|
| Visual concept | Tale of the tape: both clubs' position, form, goals for/against per match, previous meetings this season and history (from results), and the result + report link if played. |
| Layout | Mirror layout: club A \| metric \| club B. |
| Information hierarchy | Result or kick-off → mirrored stats → previous meetings. |
| Interactions | Click club → Peek; report link. |
| Navigation | Own upcoming fixture → MDY-01; played → ANL-01. |
| Desktop | Centred mirror 8/12. |
| Mobile | Mirror rows compact. |
| Advantages | Useful neutral page; Fixes misleading link |
| Disadvantages | Previous meetings depend on archive depth |
| Complexity / perf | S / Low |
| Works with | MDY-01, ANL-01, ANL-03 |
| Fits identities | A |

#### B — Match poster

| | |
|---|---|
| Visual concept | Broadcast poster: crests, date, venue, positions, form. |
| Layout | Hero. |
| Information hierarchy | Poster. |
| Interactions | - |
| Navigation | - |
| Desktop | Hero. |
| Mobile | Hero. |
| Advantages | Atmosphere |
| Disadvantages | Thin data |
| Complexity / perf | S / Medium |
| Works with | DSH-01 |
| Fits identities | B |

#### C — Peek-only fixture

| | |
|---|---|
| Visual concept | No full page; fixtures open in Peek drawer with the same mirror summary. |
| Layout | Drawer. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | Peek everywhere. |
| Desktop | Drawer. |
| Mobile | Sheet. |
| Advantages | No navigation cost |
| Disadvantages | Deep links need fallback page |
| Complexity / perf | S / Low |
| Works with | CMP-01 |
| Fits identities | C |
| Patterns | Hover cards for every entity |

### CMP-03 · Matcher (legacy redirect)

**Current:** Client-side redirect /career/matches → /career/schedule; flashes empty page; part of double redirect.

**Recommendation:** A — Server redirect; never player-visible.

**Priority:** P3 · **Dependencies:** Routing

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Server redirect

| | |
|---|---|
| Visual concept | next.config redirect to /career/schedule. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | No flash |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-03 |
| Fits identities | A, B, C |

#### B — Remove route

| | |
|---|---|
| Visual concept | Delete route after checking links; 404 with schedule link. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | Less code |
| Disadvantages | Old bookmarks break |
| Complexity / perf | S / Low |
| Works with | MDY-03 |
| Fits identities | A, B, C |

### CMP-04 · Statistik

**Current:** Statistik: leader strip (Flest mål, Flest räddningar, Högst snittbetyg), 12-column player ranking with metric select and minimum sample, team attack & defence table; own league only; no charts or per-position leaderboards.

**Recommendation:** A — Position leaderboards and two honest scatter plots (shots vs efficiency, saves vs faced) add insight without inventing metrics.

**Priority:** P2 · **Dependencies:** Shared stats component with CMP-01d, Competition switcher

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Leaderboards by position

| | |
|---|---|
| Visual concept | Competition switcher, leader cards per position (MV saves %, wings goals/efficiency, backs goals/shots, M rating) and the full ranking table. |
| Layout | Switcher → position leader grid → table → team table. |
| Information hierarchy | Leaders → full ranking. |
| Interactions | Metric, minimum, position filter; row Peek. |
| Navigation | Players → SQD-02 / scouting. |
| Desktop | Grid 7 cards + table. |
| Mobile | Position tabs + ranked cards. |
| Advantages | Handball-native; Recruitment value |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | CMP-01d, SQD-02, REC-01 |
| Fits identities | A |
| Patterns | Lists without decision-relevant columns (avoided) |

#### B — Scatter explorer

| | |
|---|---|
| Visual concept | Scatter plots: Skott vs Skott % (outfield), Mötta vs Räddning % (MV), team goals for vs against; size = matches. |
| Layout | Chart + table. |
| Information hierarchy | Outliers. |
| Interactions | Brush to filter table; hover player. |
| Navigation | - |
| Desktop | Chart 8 + list 4. |
| Mobile | Chart full width, tap points. |
| Advantages | Insight |
| Disadvantages | Small-sample noise (respect minimum) |
| Complexity / perf | M / Medium |
| Works with | REC-01 |
| Fits identities | A, B |

#### C — Season almanac stats

| | |
|---|---|
| Visual concept | Editorial "Säsongen i siffror" with leaders as short features. |
| Layout | Features + tables. |
| Information hierarchy | Stories. |
| Interactions | - |
| Navigation | - |
| Desktop | Journal. |
| Mobile | Feed. |
| Advantages | Readable |
| Disadvantages | Copy generation |
| Complexity / perf | S / Low |
| Works with | CMP-01 |
| Fits identities | C |

## MDY — Matchday

### MDY-01 · Matchförhandsvisning (match preview / matchday gate)

**Current:** Match preview / matchday gate: alerts rendered above the heading, MatchdayStage (stakes, Tabell och form, Vad som sägs, Det vi vet), MatchHero with start buttons only on matchday, compact opponent scouting, starting-seven slot cards with raw engine enums ("Anfallsstil: SLOW"), low-readiness and unavailable lists. Read-only with no "advance to matchday" CTA on other days.

**Recommendation:** C — A three-step ritual (Truppen → Motståndaren → Planen) with a visible readiness checklist turns scattered warnings into a gate the user clears, then hands off to the live match. It reuses the court lineup from tactics and keeps blocking issues fixable in place.

**Priority:** P0 · **Dependencies:** Court lineup component (shared with TRN-02), Readiness summary (lib/training/readinessSummary), Enum → Swedish label mapping, Continue heartbeat ("Till matchen"), MDY-02 walk-out

**Arena Nights (owner identity, 2026-11-13):** adapt → *Three-step ritual (intensity escalation)* — Same three skippable steps (Truppen, Motståndaren, Planen). Steps sit on calm, desaturated dark glass; completing step 3 raises intensity: club neon floods the stage, the arena photo fades in and the walk-out starts. The signature transition becomes an intensity escalation instead of a light-mode switch. _Conflict:_ A 'paper-mode stepper' that flips to Floodlight for kick-off. In Arena Nights everything is already dark, so the paper→floodlight contrast disappears.

#### A — Pre-match checklist board

| | |
|---|---|
| Visual concept | A bench-tablet checklist: four status tiles (Trupp ✓, Målvakt ✓, 7m-skytt ✓, Motståndarrapport ◐) above a court lineup with readiness rings and an unavailable list; start buttons sit in a sticky footer that explains what is still blocking. |
| Layout | Top: fixture strip (opponent, positions, form, stakes chip). Row: 4 checklist tiles. Main: court lineup 7/12 (MV + VS/VN/MN/HN/HS/M with readiness ring and K/7m badges) + rail 5/12 (Lägre beredskap, Otillgängliga). Sticky footer: STARTA MATCH / Snabbresultat, or "Spela fram till matchdagen". |
| Information hierarchy | 1) What blocks kick-off. 2) Lineup on court. 3) Opponent/stakes context. |
| Interactions | Click a failed tile → fix inline (opens tactics sheet with the problem preselected); click player → Peek with energy, match fitness, 7-day load; footer explains disabled start. |
| Navigation | Taktik → TRN-02 sheet; Motståndaren → ANL-03; starting goes to MDY-02. |
| Desktop | Dense, single screen without scrolling at 1440×900. |
| Mobile | Checklist tiles as a 2×2 grid, court lineup portrait, sticky start bar. |
| Advantages | Blocking issues obvious and fixable; No alerts above heading; Lineup readable as handball |
| Disadvantages | Less pre-match atmosphere |
| Complexity / perf | M / Low |
| Works with | TRN-02, ANL-03, MDY-02, SQD-02 |
| Fits identities | A |
| Patterns | Pre-match ritual sequence; Predictive consequence preview; Continue button as heartbeat |

#### B — Matchday build-up

| | |
|---|---|
| Visual concept | Broadcast pre-show: hero with both crests and countdown, "Vad som sägs" quotes as lower-thirds, opponent key players as threat cards, your starting seven as a walk-out line of busts. |
| Layout | Hero → threat cards row → starting seven bust line → start. |
| Information hierarchy | 1) The occasion. 2) Threats. 3) Your seven. |
| Interactions | Tap threat card → opponent player Peek; tap bust → our player; start triggers walk-out. |
| Navigation | Leads directly into MDY-02 Broadcast. |
| Desktop | Full-bleed dark, environment photography. |
| Mobile | Vertical story cards; sticky start. |
| Advantages | Anticipation; Strong for matchday ritual |
| Disadvantages | Blocking issues get buried; Asset hungry; Threat cards need opponent scouting knowledge (exists, gated) |
| Complexity / perf | L / Medium |
| Works with | MDY-02, ANL-03 |
| Fits identities | B |
| Patterns | Pre-match ritual sequence; Broadcast camera / view switcher |

#### C — Three-step ritual

| | |
|---|---|
| Visual concept | A paper-mode stepper of at most three skippable steps: 1 Truppen (lineup on court, readiness, unavailable), 2 Motståndaren (threat cards next to our matchups, scouting confidence), 3 Planen (defence system, tempo, attack, 7 mot 6 policy in Swedish words instead of raw enums). Completing the steps flips to Floodlight for kick-off. |
| Layout | Left: vertical step list with ✓ states and blocking counts. Right: the current step's content. Footer: "Till avkast" (or "Spela fram till matchdagen" on other days). |
| Information hierarchy | 1) Current step & blockers. 2) Step content. 3) Kick-off. |
| Interactions | Steps skippable; blocking issues fixable in place; "Snabbresultat" always available as secondary; ConfirmDialog only when skipping a blocker. |
| Navigation | Step 2 embeds ANL-03 summary; step 3 embeds TRN-02 summary; kick-off → MDY-02. |
| Desktop | Stepper 3/12 + content 9/12. |
| Mobile | Steps as a top segmented progress; content scrolls; sticky kick-off. |
| Advantages | Ritual without ceremony (≤3 steps); Consolidates prep that is spread across MDY-01, CMP-02 and ANL-03; Transitions into Floodlight |
| Disadvantages | Step 3 must not duplicate the tactics editor – summary + edit link only |
| Complexity / perf | M / Low |
| Works with | TRN-02, ANL-03, MDY-02, CMP-02, WLD-05 |
| Fits identities | C, A |
| Patterns | Pre-match ritual sequence; Per-event targets; Continue button as heartbeat |

### MDY-01a · MatchdayStage ("Matchdagen")

**Current:** MatchdayStage: stakes band, assistant-control alert, "Tabell och form", "Vad som sägs" media quotes, "Det vi vet".

**Recommendation:** A — Compress to a stakes header; the text-heavy parts become optional.

**Priority:** P2 · **Dependencies:** MDY-01 layout

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Stakes header

| | |
|---|---|
| Visual concept | One strip: competition, round, both table positions with gap, what a win/loss means (e.g. "Vinst = upp på 4:e plats"). |
| Layout | Strip. |
| Information hierarchy | Stakes. |
| Interactions | Expand for media quotes. |
| Navigation | - |
| Desktop | Strip. |
| Mobile | Strip. |
| Advantages | Concise |
| Disadvantages | Outcome projection derivable from table only |
| Complexity / perf | S / Low |
| Works with | CMP-01a |
| Fits identities | A, C |
| Patterns | Per-event targets |

#### B — Press-room panel

| | |
|---|---|
| Visual concept | Media quotes as lower-thirds with portraits. |
| Layout | Panel. |
| Information hierarchy | Quotes. |
| Interactions | - |
| Navigation | - |
| Desktop | Panel. |
| Mobile | Cards. |
| Advantages | Atmosphere |
| Disadvantages | Text heavy |
| Complexity / perf | S / Medium |
| Works with | MDY-01 |
| Fits identities | B |

### MDY-01b · Confirm dialog "Kontrollera matchtruppen"

**Current:** ConfirmDialog (warning tone) listing squad warnings (e.g. NO_SUBSTITUTES) before LIVE or QUICK start.

**Recommendation:** A — Fix-in-place beats confirm-and-hope.

**Priority:** P1 · **Dependencies:** MDY-01 checklist

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Fix-it dialog

| | |
|---|---|
| Visual concept | Each warning row has a fix action (open tactics sheet at that slot) and the consequence in words. |
| Layout | Dialog with rows. |
| Information hierarchy | Warnings → fixes. |
| Interactions | Fix; or "Starta ändå". |
| Navigation | TRN-02 sheet. |
| Desktop | Modal. |
| Mobile | Sheet. |
| Advantages | Actionable |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | TRN-02 |
| Fits identities | A, C |

#### B — Inline gate (no dialog)

| | |
|---|---|
| Visual concept | Warnings live in the checklist; start button label becomes "Starta ändå (2 varningar)". |
| Layout | No modal. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | Fewer modals |
| Disadvantages | Easier to miss |
| Complexity / perf | S / Low |
| Works with | MDY-01 |
| Fits identities | A |

### MDY-01c · Blocking / lineup error alerts

**Current:** role=alert banners above the heading with link to Taktik when lineup invalid or squad blocking.

**Recommendation:** A — Move into the checklist so context comes first and blocking is visible where it matters.

**Priority:** P1 · **Dependencies:** MDY-01 checklist

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Checklist tile state

| | |
|---|---|
| Visual concept | Blocking issue turns the relevant tile red with reason and fix link. |
| Layout | Tile. |
| Information hierarchy | - |
| Interactions | Fix. |
| Navigation | TRN-02. |
| Desktop | Tile. |
| Mobile | Tile. |
| Advantages | In context |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-01 |
| Fits identities | A, C |

#### B — Below-heading banner

| | |
|---|---|
| Visual concept | Keep banner but below heading, with icon and one fix CTA. |
| Layout | Banner. |
| Information hierarchy | - |
| Interactions | Fix. |
| Navigation | - |
| Desktop | Banner. |
| Mobile | Banner. |
| Advantages | Small change |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-01 |
| Fits identities | A |

### MDY-01d · OpponentScoutingPanel (compact)

**Current:** Compact OpponentScoutingPanel: order report, per-topic confidence, strengths/weaknesses, recommendations, link to plan; duplicated on ANL-03.

**Recommendation:** A — One threat-card component shared with ANL-03, gated by report confidence.

**Priority:** P1 · **Dependencies:** ANL-03 component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Threat cards

| | |
|---|---|
| Visual concept | 3–4 cards (e.g. "Snabb omställning", "Stark HN") each with confidence %, and a matching "Vårt svar" link to the plan setting. |
| Layout | Card row. |
| Information hierarchy | Threats. |
| Interactions | Order report if none; card → plan. |
| Navigation | TRN-02. |
| Desktop | Row. |
| Mobile | Swipe. |
| Advantages | Actionable; Shared |
| Disadvantages | Mapping to plan settings must use existing recommendations |
| Complexity / perf | S / Low |
| Works with | ANL-03, TRN-02 |
| Fits identities | A, B, C |

#### B — Summary line + link

| | |
|---|---|
| Visual concept | One line "Rapport 72 % säker · 3 hot" linking to ANL-03. |
| Layout | Line. |
| Information hierarchy | - |
| Interactions | Link. |
| Navigation | ANL-03. |
| Desktop | - |
| Mobile | - |
| Advantages | No duplication |
| Disadvantages | Less visible |
| Complexity / perf | S / Low |
| Works with | ANL-03 |
| Fits identities | A |

### MDY-01e · Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare"

**Current:** Two panels: "Din matchförberedelse & startsjua" (7 slot cards with K/7m badges, plan summary with raw enums, low-readiness list) and "Otillgängliga spelare" table.

**Recommendation:** A — The starting seven should be drawn on the court with readiness visible; this is the single most handball-native improvement in preparation.

**Priority:** P0 · **Dependencies:** Court lineup component, Enum label mapping

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Court lineup with readiness rings

| | |
|---|---|
| Visual concept | Half-court with the 7 starters in position (MV, VS, VN, MN, HN, HS, M); ring = readiness (energy × match fitness), badges K (captain) and 7m; bench row below with same rings. |
| Layout | Court 8 + plan summary 4. |
| Information hierarchy | Starters and their readiness. |
| Interactions | Hover → Peek; click → swap via tactics sheet. |
| Navigation | TRN-02. |
| Desktop | Court large. |
| Mobile | Portrait court. |
| Advantages | Readable as handball; Readiness in context |
| Disadvantages | - |
| Complexity / perf | M / Low |
| Works with | TRN-02, SQD-01 |
| Fits identities | A, C |
| Patterns | Attribute bars + numbers, fogged by scouting |

#### B — Starting seven busts

| | |
|---|---|
| Visual concept | Seven player cards with bust, number, position, readiness bar. |
| Layout | Card row. |
| Information hierarchy | Faces. |
| Interactions | Tap card. |
| Navigation | - |
| Desktop | Row. |
| Mobile | Grid. |
| Advantages | Personal |
| Disadvantages | Loses spatial sense |
| Complexity / perf | S / Medium |
| Works with | SQD-01 |
| Fits identities | B |

#### C — Readiness table

| | |
|---|---|
| Visual concept | Table: player, position, energy, match fitness, 7-day load, outlook, availability. |
| Layout | Table. |
| Information hierarchy | Risk rows highlighted. |
| Interactions | Sort. |
| Navigation | - |
| Desktop | Table. |
| Mobile | Ranked cards. |
| Advantages | Precise |
| Disadvantages | Not spatial |
| Complexity / perf | S / Low |
| Works with | SQD-01 |
| Fits identities | A |

### MDY-01f · States: season complete / no fixture

**Current:** Bare muted panels: "Säsongen är avslutad…" / "Ingen kommande match schemalagd."

**Recommendation:** A — Always give a way forward.

**Priority:** P3 · **Dependencies:** Season review route

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — State with next step

| | |
|---|---|
| Visual concept | Season complete → "Säsongsavslut" CTA; no fixture → next fixture date + "Spela fram". |
| Layout | Card + CTA. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | Schedule / season review. |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | No dead end |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | A, B, C |

#### B — Redirect

| | |
|---|---|
| Visual concept | Without a fixture, the Match entry routes to the schedule. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | Simple |
| Disadvantages | Confusing if unexpected |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | A |

### MDY-02 · Live match (Match Center) — HI-FI prototype `matchday`

**Current:** Live Match Center: header (score, period, clock, manpower "6v6 jämnt"/"7 mot 6", suspensions), controls bar (play/pause, 7 speeds, next key event, key-event toggle, play to end, finalise), four views (Översikt, Nyckelögonblick, Spelare, Statistik), LiveCoachPanel aside (tactics, timeout, two-step substitutions) and TimeoutOverlay that repeats tactics and subs; 2D court hidden behind an English "Experimental 2D" details element.

**Recommendation:** C — Floodlight Sequence treats the match as phases (avkast → live → timeout → halvtid → slutsignal) with one unified Bench Dock for every decision, which removes the three-way split of controls. It promotes the court to a first-class view, gives half-time its own briefing and ends by handing a single story to the report instead of repeating it.

**Priority:** P0 · **Dependencies:** Unified Bench Dock component (tactics, timeout, subs, 7 mot 6), Court view (promote MDY-02l), Score-flow/momentum chart, Floodlight mode tokens, ANL-01 post-match story

**Arena Nights (owner identity, 2026-11-13):** adapt → *Matchday Sequence* — Identical phases (walk-out → live with Bench Dock → timeout huddle → half-time → slutsignal) and the same score bug/Bench Dock. Phase intensity is expressed with neon: calm preparation, glowing live cards, neon score separator. _Conflict:_ Floodlight Sequence depends on the paper→Floodlight mode switch for its emotional payoff (it already fits B visually).

#### A — Bench Tablet

| | |
|---|---|
| Visual concept | The coach's tablet: score bug with manpower and suspension timers on top, the court or key-moment view in the centre, and a permanent right-hand Bench Dock holding every decision (Försvar 6:0/5:1, Aggressivitet, Tempo, Anfall, Rotation, 7 mot 6 Av/Vid behov/Alltid, Timeout, Byten with energy bars). |
| Layout | Top: score bug (crests, score, period, clock, manpower, 2-min timers, timeout pip per half). Left 8/12: view tabs (Plan · Händelser · Spelare · Statistik) with Plan = court + momentum strip. Right 4/12: Bench Dock (tactics segmented controls, timeout button with reason when disabled, on-court list sorted by energy with tap-to-swap). Bottom: transport (play/pause, speed, next key event). |
| Information hierarchy | 1) Score, clock, manpower, suspensions. 2) Who is tired / suspended now. 3) Event view. |
| Interactions | Tap tired player → eligible replacements of same kind listed with energy → confirm; keyboard: Space play/pause, T timeout, 1–7 speeds; disabled timeout shows reason ("Kräver eget bollinnehav"). |
| Navigation | Full time → "Till matchrapporten"; no other navigation during live play (hub rail collapses). |
| Desktop | Single dense screen, no page scroll; dark or light. |
| Mobile | Score bug sticky; view in the middle; Bench Dock as a bottom drawer with three tabs (Taktik · Byten · Timeout) and a big timeout button. |
| Advantages | All decisions in one place; Fast and legible; Status info most legible element |
| Disadvantages | Least cinematic; Dense on small laptops |
| Complexity / perf | M / Low |
| Works with | MDY-02a, MDY-02b, MDY-02g, ANL-01 |
| Fits identities | A |
| Patterns | In-match touchline interventions; Predictive consequence preview; Density modes |

#### B — Broadcast

| | |
|---|---|
| Visual concept | A TV broadcast of the match: full-width court with a score bug, lower-third captions for events (goal, 2 min, 7m, save) and replay cards for key moments; coaching opens as a "touchline" overlay. |
| Layout | Full-bleed court; score bug top-left; lower-third captions; right edge: collapsed touchline tab; bottom ticker of events. |
| Information hierarchy | 1) The court and the ball. 2) Score bug. 3) Captions. |
| Interactions | Touchline overlay slides in for tactics/subs/timeout and pauses at timeouts; "Repris" on a key moment replays its tactical snapshot; camera toggle court ↔ helplan. |
| Navigation | Walk-out sequence before; full-time highlight reel after. |
| Desktop | 16:9 stage, controls auto-hide. |
| Mobile | Landscape court; portrait shows score bug + caption feed + touchline button. |
| Advantages | Most immersive; Showcases the 2D engine |
| Disadvantages | Decisions one step away; Depends on the 2D court quality and frame buffer; Highest motion cost |
| Complexity / perf | XL / High |
| Works with | MDY-02l, MDY-04, ANL-01 |
| Fits identities | B |
| Patterns | Broadcast camera / view switcher; In-match touchline interventions; Diegetic narrator |

#### C — Floodlight Sequence

| | |
|---|---|
| Visual concept | The match as a sequence of phases in Floodlight mode: Walk-out (starting sevens) → Live (court + commentary + Bench Dock) → Timeout huddle → Halvtid briefing → Slutsignal story, each with its own layout but the same score bug and Bench Dock. |
| Layout | Live: score bug; centre court/key-moment card with commentary feed beneath; right Bench Dock; momentum line under the score bug. Phase screens (huddle, halvtid, slutsignal) replace the centre while the bug stays. |
| Information hierarchy | 1) Phase and score. 2) What needs a decision now (dock highlights it). 3) Story of the match so far. |
| Interactions | Dock as in A; timeout opens the huddle phase (directive cards) instead of a second panel; half-time pauses into a briefing; slutsignal offers one button "Läs matchrapporten" that opens ANL-01 at the story, not a replay. |
| Navigation | Comes from MDY-01 C ritual; leaves to ANL-01 C; the Experimental 2D becomes the "Plan" view. |
| Desktop | Floodlight dark with readable data panels; phase transitions 600 ms (reduced motion: crossfade). |
| Mobile | Portrait-first: score bug, phase card, dock as bottom drawer; huddle and halvtid as full-screen cards. |
| Advantages | One decision surface across live, timeout and half-time; Gives half-time and full-time a purpose; Ends the circular post-match content |
| Disadvantages | More states to design and test; Phase screens need disciplined content to stay quick |
| Complexity / perf | L / Medium |
| Works with | MDY-01, MDY-02h, MDY-02i, MDY-02j, ANL-01 |
| Fits identities | C, B |
| Patterns | Pre-match ritual sequence; In-match touchline interventions; Play-or-sim per event; Broadcast camera / view switcher |

### MDY-02a · Header / scoreboard & manpower

**Current:** mc-header: crests, score, competition, period & remaining time, manpower line, suspensions/disqualifications per club; timeouts remaining not prominent.

**Recommendation:** A — Status must be the most legible element: manpower, 2-minute timers and timeout availability as visual pips.

**Priority:** P0 · **Dependencies:** Score bug component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Score bug with pips

| | |
|---|---|
| Visual concept | Score bug: score, clock, period; under each team: manpower dots (6/7 court players), running 2-min countdown chips per suspended player, timeout pip for this half (filled = available), red-card marker. |
| Layout | Compact band. |
| Information hierarchy | Score → manpower → timers. |
| Interactions | Click suspension chip → player. |
| Navigation | - |
| Desktop | Band 64px. |
| Mobile | Sticky band 48px; pips enlarged. |
| Advantages | Scannable; Handball-native |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-02 |
| Fits identities | A, B, C |
| Patterns | In-match touchline interventions |

#### B — Broadcast bug + manpower bar

| | |
|---|---|
| Visual concept | TV-style corner bug and a separate manpower bar that flashes on change (6v5 övertag). |
| Layout | Corner bug. |
| Information hierarchy | Score. |
| Interactions | - |
| Navigation | - |
| Desktop | Overlay. |
| Mobile | Overlay. |
| Advantages | Immersive |
| Disadvantages | Small |
| Complexity / perf | S / Low |
| Works with | MDY-02 |
| Fits identities | B |

#### C — Two-row header

| | |
|---|---|
| Visual concept | Row 1 score; row 2 a full-width "läget" sentence: "6 mot 5 i 1:24 – Lindqvist utvisad". |
| Layout | Two rows. |
| Information hierarchy | Score → situation in words. |
| Interactions | - |
| Navigation | - |
| Desktop | Header. |
| Mobile | Header. |
| Advantages | Clear for novices |
| Disadvantages | Text changes often |
| Complexity / perf | S / Low |
| Works with | MDY-02 |
| Fits identities | C |
| Patterns | In-game glossary |

### MDY-02b · Controls bar

**Current:** mc-controls: many equal-weight buttons (play/pause/resume/second half, speed select, next key event, key-events toggle, play to end, finalise).

**Recommendation:** A — A single transport control with one primary state button reduces the equal-weight problem.

**Priority:** P0 · **Dependencies:** MDY-02 layout

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Transport control

| | |
|---|---|
| Visual concept | One primary toggle (Spela/Pausa/Starta andra halvlek/Återuppta), speed as a 7-step segmented scrubber (1×…86×), "Nästa viktiga händelse" as secondary, "Spela till slut" in overflow with confirm. |
| Layout | Single row, primary left. |
| Information hierarchy | Primary state → speed → skip. |
| Interactions | Keyboard shortcuts; speed remembers last choice. |
| Navigation | - |
| Desktop | Row. |
| Mobile | Bottom bar with big primary button; speed in a popover. |
| Advantages | Clear priority |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-02 |
| Fits identities | A, C |
| Patterns | Play-or-sim per event |

#### B — Auto-pause rules

| | |
|---|---|
| Visual concept | Replace key-event toggle with "Pausa vid: mål · 2 min · 7m · timeout" chips. |
| Layout | Chip row. |
| Information hierarchy | - |
| Interactions | Toggle chips. |
| Navigation | - |
| Desktop | Row. |
| Mobile | Popover. |
| Advantages | Control without babysitting |
| Disadvantages | Engine must support pause-on-type (key events exist; verify per-type) |
| Complexity / perf | M / Low |
| Works with | MDY-02 |
| Fits identities | A |

#### C — Play-or-sim menu

| | |
|---|---|
| Visual concept | A "Spela" menu: Live, Till halvtid, Till slutet (quick finish). |
| Layout | Split button. |
| Information hierarchy | - |
| Interactions | Pick. |
| Navigation | - |
| Desktop | Split button. |
| Mobile | Sheet. |
| Advantages | Respects time |
| Disadvantages | "Till halvtid" needs engine stop at half (exists: pausedAtHalf) |
| Complexity / perf | S / Low |
| Works with | MDY-02m |
| Fits identities | A, C |
| Patterns | Play-or-sim per event |

### MDY-02c · View "Översikt"

**Current:** Overview view: key moment card with tactical snapshot stepper, live commentary, match summary, "Matchen i siffror", "Matchens profiler", "Händelser att återvända till"; also hosts TimeoutOverlay and decision heading; very busy.

**Recommendation:** A — Prioritise live state: the current moment and the court; review content moves to the report.

**Priority:** P0 · **Dependencies:** Court view, ANL-01

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Live-first overview

| | |
|---|---|
| Visual concept | Only three things: current key moment (snapshot on court), commentary feed, mini stats (5 numbers: Mål/skott %, Räddningar, Bollförluster, 2 min, 7m). |
| Layout | Court/snapshot 8 + feed 4; stats strip. |
| Information hierarchy | Now → feed → numbers. |
| Interactions | Step snapshots; tap event → snapshot. |
| Navigation | Profiler & return-to events move to report. |
| Desktop | Two columns. |
| Mobile | Snapshot, then feed. |
| Advantages | Calm, focused |
| Disadvantages | Power users lose some on-screen info (still in Statistik) |
| Complexity / perf | S / Low |
| Works with | MDY-02f, ANL-01 |
| Fits identities | A, C |

#### B — Court + caption

| | |
|---|---|
| Visual concept | Overview = continuous court with lower-third captions. |
| Layout | Court. |
| Information hierarchy | Court. |
| Interactions | - |
| Navigation | - |
| Desktop | Full width. |
| Mobile | Landscape. |
| Advantages | Immersive |
| Disadvantages | Depends on 2D quality |
| Complexity / perf | L / High |
| Works with | MDY-02l |
| Fits identities | B |

#### C — Momentum + feed

| | |
|---|---|
| Visual concept | Score-flow/momentum line on top, feed underneath with goal markers, snapshot opens inline. |
| Layout | Chart + feed. |
| Information hierarchy | Flow. |
| Interactions | Click marker. |
| Navigation | - |
| Desktop | Stack. |
| Mobile | Stack. |
| Advantages | Story of the match |
| Disadvantages | Momentum = goal difference only (no invented metric) |
| Complexity / perf | S / Low |
| Works with | ANL-01b |
| Fits identities | C |

### MDY-02d · View "Nyckelögonblick"

**Current:** Filterable key moments (Alla, Mål, Räddningar, Genombrott, Omställning, 7m, Försvar) with KeyMoment detail.

**Recommendation:** A — A timeline scrubber makes the match navigable.

**Priority:** P2 · **Dependencies:** Timeline component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Timeline scrubber

| | |
|---|---|
| Visual concept | Horizontal 0–60 min track with coloured event markers per type; filters toggle markers; click → snapshot. |
| Layout | Track + detail. |
| Information hierarchy | Distribution of events. |
| Interactions | Scrub, filter. |
| Navigation | Reused in ANL-01. |
| Desktop | Track full width. |
| Mobile | Vertical timeline. |
| Advantages | Overview + detail |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01, ANL-05 |
| Fits identities | A, C |

#### B — Moment cards

| | |
|---|---|
| Visual concept | Swipeable replay cards. |
| Layout | Cards. |
| Information hierarchy | - |
| Interactions | Swipe. |
| Navigation | - |
| Desktop | Carousel. |
| Mobile | Deck. |
| Advantages | Fun |
| Disadvantages | Slow scanning |
| Complexity / perf | S / Medium |
| Works with | MDY-02 |
| Fits identities | B |

### MDY-02e · View "Spelare"

**Current:** Per-team player table sortable by Position, Betyg, Mål, Skott, Minuter, Energi; player focus with related moments.

**Recommendation:** A — Energy bars and population state make the table a substitution tool.

**Priority:** P2 · **Dependencies:** Energy bar component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Energy-forward table

| | |
|---|---|
| Visual concept | Rows with energy bar, population chip (Plan/Bänk/Utvisad 1:12), rating, goals/shots; sort by energy default when live. |
| Layout | Table + focus panel. |
| Information hierarchy | Who is tired. |
| Interactions | Row → focus; "Byt" from row opens dock. |
| Navigation | Dock. |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | Decision-relevant |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-02g |
| Fits identities | A |

#### B — On-court formation

| | |
|---|---|
| Visual concept | Players drawn in positions on a court with energy rings and rating. |
| Layout | Court. |
| Information hierarchy | Spatial. |
| Interactions | Tap. |
| Navigation | - |
| Desktop | Court. |
| Mobile | Court. |
| Advantages | Handball-native |
| Disadvantages | Bench separate |
| Complexity / perf | M / Low |
| Works with | MDY-02l |
| Fits identities | B, C |

### MDY-02f · View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling)

**Current:** Statistik view with sub-nav (Match & positioner / Avslut / Målvakter / Matchutveckling): team stats, goals by position, shot map with outcome filter, keeper categories, score-flow SVG. No shot-quality metric exists.

**Recommendation:** A — Make the shot map the centrepiece with outcome and origin; do not add xG – none exists.

**Priority:** P1 · **Dependencies:** Shot map component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Shot map + goal-mouth

| | |
|---|---|
| Visual concept | Court shot map from ShotFact origin x/y coloured by outcome (Mål/Räddning/Block/Miss), filter by kind (BREAKTHROUGH, SEVEN_METRE, transition phase) and player; keeper panel with saves by shot kind. |
| Layout | Map 7 + filters & keeper 5. |
| Information hierarchy | Where shots came from and what happened. |
| Interactions | Filter; hover shot → moment. |
| Navigation | Reused in ANL-01/05. |
| Desktop | Large map. |
| Mobile | Map full width, filters in sheet. |
| Advantages | Uses real data; No invented metric |
| Disadvantages | Goal-mouth placement needs new data: shot target location |
| Complexity / perf | M / Low |
| Works with | ANL-01, ANL-05 |
| Fits identities | A, C |

#### B — Stat graphics

| | |
|---|---|
| Visual concept | Broadcast bars comparing teams per metric. |
| Layout | Mirror bars. |
| Information hierarchy | Comparison. |
| Interactions | - |
| Navigation | - |
| Desktop | Bars. |
| Mobile | Bars. |
| Advantages | Readable |
| Disadvantages | Less depth |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | B |

### MDY-02g · Coach aside "Dina matchbeslut" (LiveCoachPanel)

**Current:** LiveCoachPanel aside: possession, CoachingChoices (Försvar 6:0/5:1, Aggressivitet, Tempo, Anfall, Rotation, 7 mot 6), timeout block (1 per half, own possession required, reasons when disabled), two-step substitutions, Assistentbyten toggle, bench details; energy only as text.

**Recommendation:** A — The Bench Dock is the single home for all in-match decisions; TimeoutOverlay becomes a mode of it, not a duplicate.

**Priority:** P0 · **Dependencies:** Bench Dock component, Energy bar component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Bench Dock

| | |
|---|---|
| Visual concept | Three stacked sections: Taktik (segmented controls with tiny graphics for 6:0/5:1, 7 mot 6 Av/Vid behov/Alltid), Timeout (big button + pip + plain reason when unavailable, e.g. "Kräver eget bollinnehav"), Byten (on-court players sorted by energy; tap one → eligible same-kind bench players with energy bars → confirm). Assistentbyten as a switch at the bottom. |
| Layout | Right column 4/12, sections collapsible. |
| Information hierarchy | Timeout availability → tired players → tactics. |
| Interactions | One-tap timeout; two taps to substitute; changed tactic shows "gäller från nästa anfall" if applicable. |
| Navigation | Same dock appears inside timeout huddle and half-time. |
| Desktop | Sticky column. |
| Mobile | Bottom drawer with tabs. |
| Advantages | Ends the three-way split; Energy-sorted bench |
| Disadvantages | - |
| Complexity / perf | M / Low |
| Works with | MDY-02, MDY-02h, MDY-02i |
| Fits identities | A, C |
| Patterns | In-match touchline interventions; Predictive consequence preview |

#### B — Court drag substitutions

| | |
|---|---|
| Visual concept | Drag a bench player onto a court player in the court view; tactics via radial menu. |
| Layout | On court. |
| Information hierarchy | Spatial. |
| Interactions | Drag. |
| Navigation | - |
| Desktop | Court. |
| Mobile | Tap-tap instead of drag. |
| Advantages | Tactile |
| Disadvantages | Hard on touch; Needs court view always visible |
| Complexity / perf | L / Medium |
| Works with | MDY-02l |
| Fits identities | B |

#### C — Shout cards

| | |
|---|---|
| Visual concept | Tactics as a few named shouts ("Höj tempot", "Gå 5-1", "Extraspelare") mapped to existing choices, with effect/trade-off text like TimeoutOverlay directives. |
| Layout | Card row + subs. |
| Information hierarchy | Shouts. |
| Interactions | Tap to apply. |
| Navigation | - |
| Desktop | Cards. |
| Mobile | Cards. |
| Advantages | Approachable |
| Disadvantages | Must map exactly to existing settings |
| Complexity / perf | M / Low |
| Works with | MDY-02h |
| Fits identities | C, B |
| Patterns | In-match touchline interventions |

### MDY-02h · TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout)

**Current:** Non-modal TimeoutOverlay: contextual directives by score margin/period (e.g. "Hög press & snabb omställning", "Täta bakåt & kontrollerat tempo", "Extraspela 7 mot 6") with effect/trade-off/duration, base tactics, on-court substitution picker, resume banner; duplicates LiveCoachPanel; inline styles.

**Recommendation:** A — The huddle should be a focused phase that uses the Bench Dock rather than a second copy of it.

**Priority:** P1 · **Dependencies:** Bench Dock component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Timeout huddle phase

| | |
|---|---|
| Visual concept | Centre view becomes a huddle: 2–3 directive cards (effect, trade-off, duration) on a whiteboard-style court; dock stays on the right for subs; "Återuppta" primary. |
| Layout | Directives 8 + dock 4. |
| Information hierarchy | Directives → subs → resume. |
| Interactions | Pick directive; sub; resume. |
| Navigation | - |
| Desktop | Replaces centre view. |
| Mobile | Full-screen card stack with resume sticky. |
| Advantages | No duplication; Clear moment |
| Disadvantages | - |
| Complexity / perf | M / Low |
| Works with | MDY-02g |
| Fits identities | C, A |
| Patterns | In-match touchline interventions |

#### B — Whiteboard overlay

| | |
|---|---|
| Visual concept | Full-screen huddle with coach whiteboard drawing the directive's shape. |
| Layout | Overlay. |
| Information hierarchy | Board. |
| Interactions | Choose. |
| Navigation | - |
| Desktop | Overlay. |
| Mobile | Overlay. |
| Advantages | Immersive |
| Disadvantages | Animation cost |
| Complexity / perf | L / Medium |
| Works with | MDY-02 |
| Fits identities | B |

#### C — Opponent timeout notice

| | |
|---|---|
| Visual concept | Opponent timeouts as a slim banner with "Ändra något?" opening the dock. |
| Layout | Banner. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Banner. |
| Mobile | Banner. |
| Advantages | Light |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-02g |
| Fits identities | A, C |

### MDY-02i · Half-time state

**Current:** Half-time: view forced to Översikt, heading "Nästa halvlek börjar med ditt beslut.", button "Starta andra halvlek"; no first-half summary or energy view.

**Recommendation:** A — A dedicated briefing with first-half numbers vs plan, energy and the dock is the main inventory opportunity.

**Priority:** P0 · **Dependencies:** Bench Dock component, Half split (lib/analysis/halfSplit)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Half-time briefing

| | |
|---|---|
| Visual concept | Three columns: Första halvlek i siffror (score, Mål/skott %, räddning %, bollförluster, 2 min, 7m vs opponent), Energi (on-court & bench bars, lowest first), Assistentens förslag (from existing analysis interpretations, if any). Dock on right; "Starta andra halvlek". |
| Layout | 3 panels + dock. |
| Information hierarchy | Numbers → energy → suggestion. |
| Interactions | Apply changes in dock; start. |
| Navigation | - |
| Desktop | Grid. |
| Mobile | Swipe cards: Siffror · Energi · Förslag; sticky start. |
| Advantages | Purposeful pause |
| Disadvantages | Assistant suggestions need new data unless derived from interpretations |
| Complexity / perf | M / Low |
| Works with | MDY-02g, ANL-05 |
| Fits identities | A, C |
| Patterns | Staff as faces of systems; Predictive consequence preview |

#### B — Dressing-room talk

| | |
|---|---|
| Visual concept | Locker-room scene with captain and assistant; numbers as a chalkboard. |
| Layout | Scene. |
| Information hierarchy | Atmosphere. |
| Interactions | - |
| Navigation | - |
| Desktop | Scene. |
| Mobile | Scene. |
| Advantages | Immersive |
| Disadvantages | Team talk would invent gameplay – presentation only |
| Complexity / perf | L / Medium |
| Works with | MDY-02 |
| Fits identities | B |

#### C — Half-time editorial

| | |
|---|---|
| Visual concept | "Halvtid: 14–12" kicker + a short paragraph of the first half, momentum line, then dock. |
| Layout | Story + dock. |
| Information hierarchy | Story. |
| Interactions | - |
| Navigation | - |
| Desktop | Paper-in-floodlight card. |
| Mobile | Card. |
| Advantages | Readable |
| Disadvantages | Copy generation |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | C |

### MDY-02j · Full-time state

**Current:** Full-time: same surface in review mode with a summary headline, coach aside hidden, "Slutför match och öppna rapport"; the report then re-renders much of the same content.

**Recommendation:** A — Full time should be a short verdict and a single handoff to the report story – no second copy of the match center.

**Priority:** P0 · **Dependencies:** ANL-01 post-match story

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Final-whistle card

| | |
|---|---|
| Visual concept | Floodlight card: final score, halftime score, one-line story, top performer, table effect ("Upp till 5:e"), single CTA "Läs matchrapporten". |
| Layout | Centered card. |
| Information hierarchy | Score → story → CTA. |
| Interactions | CTA finalises and opens ANL-01. |
| Navigation | ANL-01 (story first). |
| Desktop | Overlay card. |
| Mobile | Full-screen card. |
| Advantages | Removes circular content |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | C, B, A |
| Patterns | Continue button as heartbeat |

#### B — Merge with report

| | |
|---|---|
| Visual concept | Finalise automatically and transform the page in place into the ANL-01 layout. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | Same URL changes. |
| Desktop | - |
| Mobile | - |
| Advantages | One flow |
| Disadvantages | URL semantics change |
| Complexity / perf | M / Low |
| Works with | ANL-01 |
| Fits identities | A, C |

#### C — Celebration/blues moment

| | |
|---|---|
| Visual concept | Short win/loss moment (2 s) then the card from A. |
| Layout | Moment. |
| Information hierarchy | - |
| Interactions | Skippable. |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | Emotion |
| Disadvantages | Motion budget |
| Complexity / perf | S / Medium |
| Works with | ANL-01 |
| Fits identities | B |

### MDY-02k · Assistant-in-control state

**Current:** Manager suspended: banner and "{name} leder laget" box replaces the coach panel; manager watches.

**Recommendation:** A — Make the state clear and calm.

**Priority:** P3 · **Dependencies:** Bench Dock component

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Assistant dock

| | |
|---|---|
| Visual concept | Dock shows assistant face, "leder laget" and read-only current tactics. |
| Layout | Dock state. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Dock. |
| Mobile | Drawer. |
| Advantages | Consistent |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-02g |
| Fits identities | A, C |
| Patterns | Staff as faces of systems |

#### B — Stand view

| | |
|---|---|
| Visual concept | Visual change: "Från läktaren" framing. |
| Layout | Banner. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Banner. |
| Mobile | Banner. |
| Advantages | Flavour |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-02 |
| Fits identities | B |

### MDY-02l · Experimental 2D court (details)

**Current:** Experimental 2D court in a <details> with English label; numbered circles and ball from frame buffer; hidden by default.

**Recommendation:** A — Promote it to a first-class "Plan" view tab, Swedish label, with trails.

**Priority:** P1 · **Dependencies:** Frame buffer, Court component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — "Plan" view tab

| | |
|---|---|
| Visual concept | Court as view tab with player circles in club colours, trails (last n seconds), manpower overlay. |
| Layout | Tab. |
| Information hierarchy | Court. |
| Interactions | Toggle trails. |
| Navigation | - |
| Desktop | Large. |
| Mobile | Landscape prompt. |
| Advantages | Showcases engine |
| Disadvantages | Perf on low-end devices |
| Complexity / perf | M / High |
| Works with | MDY-02 |
| Fits identities | A, B, C |
| Patterns | Broadcast camera / view switcher |

#### B — Picture-in-picture court

| | |
|---|---|
| Visual concept | Small court PiP above the dock. |
| Layout | PiP. |
| Information hierarchy | - |
| Interactions | Expand. |
| Navigation | - |
| Desktop | PiP. |
| Mobile | Hidden. |
| Advantages | Always visible |
| Disadvantages | Small |
| Complexity / perf | S / Medium |
| Works with | MDY-02g |
| Fits identities | A |

### MDY-02m · Quick finish / no session / archive fallback states

**Current:** ?finish=1 auto-sims to full time then redirects; loading, error and archive replay fallbacks as plain paragraphs and buttons.

**Recommendation:** A — A simulation progress screen makes quick finish feel intended.

**Priority:** P2 · **Dependencies:** Score bug component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Simulation progress

| | |
|---|---|
| Visual concept | Score bug ticking with a 0–60 progress bar and goal ticks, then auto-open report. |
| Layout | Centered. |
| Information hierarchy | Progress. |
| Interactions | Skip to report. |
| Navigation | ANL-01. |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Feedback |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A, B, C |

#### B — Styled fallback states

| | |
|---|---|
| Visual concept | Error, loading, no session with consistent empty-state component and way out. |
| Layout | Card. |
| Information hierarchy | - |
| Interactions | Försök igen / Fortsätt. |
| Navigation | - |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Consistent |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01e |
| Fits identities | A, C |

### MDY-03 · Match Center (legacy redirect)

**Current:** Server redirect /career/match-center → /career/matches → client redirect /career/schedule (double redirect).

**Recommendation:** A — Redirect directly; dev-only concern.

**Priority:** P3 · **Dependencies:** Routing

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Direct redirect

| | |
|---|---|
| Visual concept | Redirect straight to /career/schedule. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | One hop |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | CMP-03 |
| Fits identities | A, B, C |

#### B — Remove

| | |
|---|---|
| Visual concept | Remove after link audit. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | Less code |
| Disadvantages | Bookmarks |
| Complexity / perf | S / Low |
| Works with | CMP-03 |
| Fits identities | A, B, C |

### MDY-04 · Matchrepriser (match-2d replays)

**Current:** Orphaned /career/match-2d replay page: bare select of archived matches then ArchiveReplay; source has broken encoding (every Swedish character shows as "?").

**Recommendation:** C — Fold replays into the report as a "Repris" tab (and history), fix encoding; a standalone page is not needed.

**Priority:** P2 · **Dependencies:** ANL-01 tabs, Encoding fix

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Replay library

| | |
|---|---|
| Visual concept | Styled list of archived matches by season with score, opponent and a play button. |
| Layout | List + player. |
| Information hierarchy | Matches. |
| Interactions | Select → replay. |
| Navigation | Add to Tävling or Karriär hub. |
| Desktop | List 4 + replay 8. |
| Mobile | List then replay. |
| Advantages | Findable |
| Disadvantages | Another page |
| Complexity / perf | S / Medium |
| Works with | ANL-01 |
| Fits identities | A |

#### B — Highlight cinema

| | |
|---|---|
| Visual concept | Replay as broadcast highlight reel of key moments. |
| Layout | Player. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Stage. |
| Mobile | Landscape. |
| Advantages | Fun |
| Disadvantages | Asset/motion cost |
| Complexity / perf | L / High |
| Works with | ANL-01 |
| Fits identities | B |

#### C — "Repris" tab in report

| | |
|---|---|
| Visual concept | Remove the page; ANL-01 gets a Repris tab with the court replay; history links to reports. |
| Layout | Tab. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | Redirect /career/match-2d → schedule. |
| Desktop | Tab. |
| Mobile | Tab. |
| Advantages | Ends orphan + circular flow |
| Disadvantages | - |
| Complexity / perf | S / Medium |
| Works with | ANL-01 |
| Fits identities | A, C |

## ANL — Match analysis

### ANL-01 · Matchrapport — HI-FI prototype `analysis`

**Current:** Matchrapport in two divergent variants. Archive variant: full ArchivedMatchCenter (same 4 views as live), HeadToHeadStatsComparison (stats shown twice), MatchAftermathPanel, PostMatchPressBanner, an action bar with two primaries (press + continue) and a "Speltid och belastning" table. "Se matchrepris" opens /match-day which renders the same replay again. Legacy variant looks different.

**Recommendation:** C — An editorial report that reads top-down as one post-match story — score → turning points → player ratings → workload consequences → what to change — removes the duplicated match-center rendering and the circular "Se matchrepris". It absorbs ANL-05 for any match, keeps the stats sheet as a tab for depth, and works for both archive and legacy data.

**Priority:** P0 · **Dependencies:** MDY-02j final-whistle handoff, Score-flow/momentum chart, Shot map component (MDY-02f), Timeline scrubber (MDY-02d), Training action from workload table (TRN-01c), Empty/legacy data fallbacks per section

**Arena Nights (owner identity, 2026-11-13):** adapt → *Match Feature* — Same report order (headline + kicker → quote → what decided it / what it means → next step analysis → training → box score, ratings, shot map). Headline in condensed display, neon quote edge, next-step card glowing. _Conflict:_ Editorial Match Report is the club journal's match page (serif headline, journal styling).

#### A — Stats Sheet

| | |
|---|---|
| Visual concept | A box score: final and half-time score, team comparison table, player rating table for both teams (Min, Mål/Skott, Räddningar/Mötta, 2 min, Betyg), shot map, then workload. One page, no narrative. |
| Layout | Header score band → 2-col (team comparison 6 \| score flow 6) → player box score full width (tabs per team) → shot map + keeper → Speltid och belastning. |
| Information hierarchy | 1) Score. 2) Box score. 3) Shot map and workload. |
| Interactions | Sort box score; filter shot map; row → player Peek; "Vila i morgon" per player in workload table. |
| Navigation | Single action bar: Fortsätt (primary), Möt pressen (secondary when open), Tabell. Replay as a tab, not a link to /match-day. |
| Desktop | Dense printable sheet. |
| Mobile | Score band, then accordions per section; box score as ranked cards. |
| Advantages | Fast to read for power users; Single stats rendering |
| Disadvantages | No story; weak emotional closure |
| Complexity / perf | M / Low |
| Works with | MDY-02f, CMP-01c, TRN-01 |
| Fits identities | A |
| Patterns | Density modes; Inform vs navigate separation |

#### B — Highlight Show

| | |
|---|---|
| Visual concept | A post-match TV segment: hero with the result in giant numerals and club colours, a reel of key moments as replay cards (court snapshots), "Matchens lirare" spotlight, media headlines ticker, then the press-room door. |
| Layout | Hero → horizontal highlight reel → player of the match + ratings → headlines → press CTA. |
| Information hierarchy | 1) Result moment. 2) Highlights. 3) Star performer. |
| Interactions | Play reel (snapshots step through, optional 2D court replay); tap player → spotlight; "Möt pressen". |
| Navigation | Comes after MDY-02 broadcast; Fortsätt returns to Today. |
| Desktop | Full-bleed dark show. |
| Mobile | Vertical swipe stories (each highlight a card). |
| Advantages | Emotional payoff; Showcases snapshots and 2D |
| Disadvantages | Depth hidden; Heavy assets and motion; Workload consequences easily lost |
| Complexity / perf | L / High |
| Works with | MDY-02, MDY-04 |
| Fits identities | B |
| Patterns | Broadcast camera / view switcher; Diegetic narrator |

#### C — Editorial Match Report

| | |
|---|---|
| Visual concept | The club journal's match page: headline and kicker generated from the result ("Sen vändning i Kristianstad"), a momentum chart as the hero image, three turning points with court snapshots, a player ratings column, a "Vad det kostade" workload box with actions, and "Vad vi tar med oss" linking to training and tactics. Depth lives in tabs: Rapport · Statistik · Repris. |
| Layout | Header: score + HT, competition, headline. Rapport tab: momentum hero (goal difference per minute, scoring runs marked) 8 \| ratings column 4 → Avgörande ögonblick (3 snapshot cards) → Belastning box with "Vila"/"Lätt pass" per player → Nästa steg (training, tactics, table, press). Statistik tab = Stats Sheet (A). Repris tab = court replay (replaces MDY-04 and "Se matchrepris"). |
| Information hierarchy | 1) Score + headline. 2) How it happened (momentum + turning points). 3) Consequences and next steps. |
| Interactions | Click a momentum point → that snapshot; ratings → Peek; workload actions set next-day training load (existing FULL/REDUCED/RECOVERY_ONLY/REST); one primary "Fortsätt", press as a clearly secondary box. |
| Navigation | Entered from MDY-02j final-whistle card; ANL-05 merges in as this page for any match (picker in header); CMP-01c results link here. |
| Desktop | Paper mode journal, 8/4 grid, serif headline. |
| Mobile | Story order preserved: score, headline, momentum, turning points as swipe cards, ratings list, workload actions, sticky Fortsätt. |
| Advantages | One story, no duplicated match center; Ends circular replay link; Connects result to next week (training/tactics) |
| Disadvantages | Headline/turning-point copy must be generated from events (risk of repetition); Legacy variant lacks snapshots – section degrades to text |
| Complexity / perf | M / Medium |
| Works with | MDY-02j, ANL-05, TRN-01, TRN-02, CMP-01, MDY-04 |
| Fits identities | C, A |
| Patterns | Predictive consequence preview; Era- or tier-skinned news; Fewer, weightier conversations |

### ANL-01a · Archived match center (4 views)

**Current:** Full ArchivedMatchCenter (Översikt / Nyckelögonblick / Spelare / Statistik) read-only with Experimental 2D; heavy for a report.

**Recommendation:** A — Keep the views but as depth tabs behind the report summary, sharing components with the live match.

**Priority:** P0 · **Dependencies:** ANL-01 tabs

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Depth tabs behind summary

| | |
|---|---|
| Visual concept | Statistik and Repris tabs reuse MDY-02f and MDY-02l components; Översikt is replaced by the report story. |
| Layout | Tabs. |
| Information hierarchy | Story first. |
| Interactions | Switch tabs. |
| Navigation | - |
| Desktop | Tabs. |
| Mobile | Tabs. |
| Advantages | No duplication |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | MDY-02f, MDY-02l |
| Fits identities | A, C |

#### B — Collapsed "Hela matchen" section

| | |
|---|---|
| Visual concept | One collapsed section at the bottom containing the archived center. |
| Layout | Details. |
| Information hierarchy | - |
| Interactions | Expand. |
| Navigation | - |
| Desktop | Collapsed. |
| Mobile | Collapsed. |
| Advantages | Minimal work |
| Disadvantages | Hidden depth |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A |

#### C — Moment explorer

| | |
|---|---|
| Visual concept | Replace the four views by a timeline scrubber + snapshot (MDY-02d A). |
| Layout | Track + snapshot. |
| Information hierarchy | Moments. |
| Interactions | Scrub. |
| Navigation | - |
| Desktop | Wide. |
| Mobile | Vertical. |
| Advantages | Report-specific |
| Disadvantages | Loses player table (in Statistik) |
| Complexity / perf | M / Low |
| Works with | MDY-02d |
| Fits identities | C, B |

### ANL-01b · MatchAftermathPanel ("Efter matchen")

**Current:** MatchAftermathPanel: media headlines, voices after the final whistle, small "Målskillnaden minut för minut" SVG.

**Recommendation:** A — Promote the goal-difference chart to the report hero; headlines and voices become a side column.

**Priority:** P1 · **Dependencies:** Score-flow chart

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Momentum hero

| | |
|---|---|
| Visual concept | Large goal-difference-per-minute chart with scoring runs shaded and half-time line; goals as ticks. |
| Layout | Chart 8 + headlines 4. |
| Information hierarchy | Flow. |
| Interactions | Hover minute → event. |
| Navigation | - |
| Desktop | Large. |
| Mobile | Full width. |
| Advantages | Story at a glance; Uses existing data |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01, ANL-05 |
| Fits identities | A, C |

#### B — Press clippings

| | |
|---|---|
| Visual concept | Headlines as newspaper clippings with tone per outlet. |
| Layout | Clippings. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | Press. |
| Desktop | Collage. |
| Mobile | Stack. |
| Advantages | Flavour |
| Disadvantages | Copy dependency |
| Complexity / perf | S / Low |
| Works with | ANL-01f |
| Fits identities | C, B |
| Patterns | Era- or tier-skinned news |

### ANL-01c · Details "Speltid och belastning"

**Current:** Open <details> table: minutes, energy after match, match workload (estimated for GKs), last-7-days load; no link to adjust training.

**Recommendation:** A — Close the loop: rest/reduce actions inline.

**Priority:** P1 · **Dependencies:** Training load setting (TRN-01c)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Workload with actions

| | |
|---|---|
| Visual concept | Rows sorted by load, energy bar, 7-day load vs typical, and a load selector (Full / Reducerad / Endast återhämtning / Vila) for next day. |
| Layout | Table. |
| Information hierarchy | Highest risk first. |
| Interactions | Set load inline; bulk "Vila alla >50 min". |
| Navigation | TRN-01. |
| Desktop | Table. |
| Mobile | Cards with selector. |
| Advantages | Actionable |
| Disadvantages | "Typical" baseline needs derivation from ledger |
| Complexity / perf | S / Low |
| Works with | TRN-01, SQD-01 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview; Bulk actions + notes on entities |

#### B — Heat strip

| | |
|---|---|
| Visual concept | Readiness heat-strip per player (energy × fitness × 7-day load). |
| Layout | Strip. |
| Information hierarchy | Red players. |
| Interactions | Tap → training. |
| Navigation | TRN-01. |
| Desktop | Strip. |
| Mobile | Strip. |
| Advantages | Visual |
| Disadvantages | Composite must be explained |
| Complexity / perf | S / Low |
| Works with | TRN-01 |
| Fits identities | A |

### ANL-01d · Legacy report variant (no archive)

**Current:** Legacy fallback when archive is missing: MatchHero, best players, table position, stats comparison, rating tables; different look.

**Recommendation:** A — Same report layout with sections degrading gracefully.

**Priority:** P2 · **Dependencies:** ANL-01 layout

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Unified layout, degraded sections

| | |
|---|---|
| Visual concept | Same header and sections; missing sections show "Ingen detaljdata för den här matchen". |
| Layout | As ANL-01. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | Consistency |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A, B, C |

#### B — Compact result card

| | |
|---|---|
| Visual concept | Legacy matches show only a result card with ratings. |
| Layout | Card. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | Honest |
| Disadvantages | Thin |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A |

### ANL-01e · Error / no report states

**Current:** "Den här matchen saknar en rapport." and archive load error with "Försök igen"; no navigation out.

**Recommendation:** A — Always offer back links.

**Priority:** P3 · **Dependencies:** Empty state component

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Empty state with routes

| | |
|---|---|
| Visual concept | Message + Försök igen + Schema + Tabell links. |
| Layout | Card. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Card. |
| Mobile | Card. |
| Advantages | No dead end |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | CMP-01 |
| Fits identities | A, B, C |

#### B — Fallback to fixture page

| | |
|---|---|
| Visual concept | Redirect to CMP-02 with a notice. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | CMP-02. |
| Desktop | - |
| Mobile | - |
| Advantages | Still useful |
| Disadvantages | Surprising |
| Complexity / perf | S / Low |
| Works with | CMP-02 |
| Fits identities | A |

### ANL-01f · PostMatchPressBanner

**Current:** Banner entry to post-match press conference (media owned by part A).

**Recommendation:** A — Secondary placement so "Fortsätt" stays the only primary.

**Priority:** P2 · **Dependencies:** Action bar rule: one primary

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Secondary press box

| | |
|---|---|
| Visual concept | Side box "Pressen väntar" with journalist face and optional status. |
| Layout | Box in Nästa steg. |
| Information hierarchy | - |
| Interactions | Möt pressen. |
| Navigation | Press page. |
| Desktop | Box. |
| Mobile | Card. |
| Advantages | Fixes two primaries |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | A, C |

#### B — Inbox task

| | |
|---|---|
| Visual concept | Press conference appears as an inbox task instead. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | Inbox. |
| Desktop | - |
| Mobile | - |
| Advantages | Inbox as task queue |
| Disadvantages | Less discoverable |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | A |
| Patterns | Inbox as task queue |

### ANL-02 · Matchanalys – Översikt

**Current:** Analysis hub: SectionScene + route tabs; overview with next-opponent MatchHero, last match panel, own last-five form and metrics, observed patterns as text; thin and duplicates preview/report entry points.

**Recommendation:** A — A trend dashboard with "what changed" cards is the real value; next-match and last-match entries become links rather than duplicate heroes.

**Priority:** P1 · **Dependencies:** lib/analysis metrics & Evidence states, Trend chart component, IA decision: analysis inside Tävling or Laget hub

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Trend dashboard

| | |
|---|---|
| Visual concept | Rolling trend lines over the season for goals for/against per match, Mål/skott %, räddning %, bollförluster, 2 min and 7m-effektivitet, with "Vad har ändrats" cards (biggest change last five vs season) from existing patterns/interpretations. |
| Layout | KPI tiles (value, delta, spark) → trend chart with metric picker → what-changed cards → links (Nästa motståndare, Senaste matchen). |
| Information hierarchy | Deltas → trend → interpretation. |
| Interactions | Pick metric; window toggle; card → relevant plan/training. |
| Navigation | Tabs: Översikt · Motståndaren · Vårt lag · Matcher (any match via ANL-01). |
| Desktop | Tiles + chart. |
| Mobile | Tiles carousel, chart, cards. |
| Advantages | Numbers become insight; No duplication |
| Disadvantages | Evidence missing states must be shown honestly |
| Complexity / perf | M / Low |
| Works with | ANL-03, ANL-04, ANL-01, TRN-02 |
| Fits identities | A |
| Patterns | Inform vs navigate separation |

#### B — Analyst's room

| | |
|---|---|
| Visual concept | Assistant/analyst presents 3 findings as slides with charts. |
| Layout | Slide deck. |
| Information hierarchy | Finding. |
| Interactions | Next slide. |
| Navigation | - |
| Desktop | Stage. |
| Mobile | Swipe. |
| Advantages | Staff voice |
| Disadvantages | Slower |
| Complexity / perf | M / Medium |
| Works with | STF-01 |
| Fits identities | B |
| Patterns | Staff as faces of systems |

#### C — Weekly analysis column

| | |
|---|---|
| Visual concept | Editorial column "Formen just nu" with inline charts, linked to the week. |
| Layout | Column. |
| Information hierarchy | Story. |
| Interactions | - |
| Navigation | Week Spine. |
| Desktop | Journal. |
| Mobile | Feed. |
| Advantages | Readable |
| Disadvantages | Copy |
| Complexity / perf | S / Low |
| Works with | DSH-01 |
| Fits identities | C |

### ANL-02a · Analysis tab bar (layout)

**Current:** Four route tabs (Översikt / Motståndaren / Vårt lag / Senaste matchen) with aria-current.

**Recommendation:** A — Replace "Senaste matchen" by "Matcher" (any match → report story) since ANL-05 merges into ANL-01.

**Priority:** P2 · **Dependencies:** ANL-05 merge

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Three tabs + match picker

| | |
|---|---|
| Visual concept | Översikt · Motståndaren · Vårt lag · Matcher (picker → ANL-01). |
| Layout | Tabs. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Tabs. |
| Mobile | Scrollable tabs. |
| Advantages | No duplication |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A, B, C |

#### B — Hub secondary row

| | |
|---|---|
| Visual concept | Tabs become the hub secondary row under Tävling/Laget. |
| Layout | Row. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | G2. |
| Desktop | Row. |
| Mobile | Row. |
| Advantages | IA consistency |
| Disadvantages | Depends on G2 |
| Complexity / perf | S / Low |
| Works with | ANL-02 |
| Fits identities | A, C |

### ANL-03 · Matchanalys – Motståndaren

**Current:** Next opponent: MatchHero, scouting report ordering, recent matches, attack and defence metrics over last five, rail with facts, patterns and interpretation; no side-by-side comparison with own numbers.

**Recommendation:** A — A mirror of us vs them per metric is the missing comparison and the cleanest way to show matchups.

**Priority:** P1 · **Dependencies:** Mirror chart component, Threat cards shared with MDY-01d

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Mirror comparison

| | |
|---|---|
| Visual concept | Per metric bar pairs: them (left) vs us (right) for Mål/match, Skott/match, Skotteffektivitet, Bollförluster/match, 7m-effektivitet, Insläppta/match, Räddningsprocent, Utvisningar/match; threat cards with confidence; recommendation links to specific plan settings. |
| Layout | Opponent header → mirror chart 8 + threat cards 4 → recent matches table. |
| Information hierarchy | Where they are stronger → threats → evidence. |
| Interactions | Window toggle; threat card → plan setting; order report. |
| Navigation | Matchförberedelse (MDY-01) step 2 embeds this. |
| Desktop | Mirror chart. |
| Mobile | Metric rows stacked, threats swipe. |
| Advantages | Comparison visible; Shared with prep |
| Disadvantages | Mapping recommendation → plan setting limited to existing recommendations |
| Complexity / perf | M / Low |
| Works with | MDY-01, MDY-01d, TRN-02 |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Opponent dossier

| | |
|---|---|
| Visual concept | Opponent presented like a rival profile: crest hero, key players busts, style tags. |
| Layout | Hero + busts + tags. |
| Information hierarchy | Identity. |
| Interactions | Tap player. |
| Navigation | - |
| Desktop | Hero. |
| Mobile | Cards. |
| Advantages | Rivalry feel |
| Disadvantages | Style tags need derivation from patterns |
| Complexity / perf | M / Medium |
| Works with | CMP-02 |
| Fits identities | B |

#### C — Scout report article

| | |
|---|---|
| Visual concept | Scout's report as an article with confidence per section and charts inline. |
| Layout | Article. |
| Information hierarchy | Verdict. |
| Interactions | - |
| Navigation | - |
| Desktop | Column. |
| Mobile | Article. |
| Advantages | Readable; Shows confidence |
| Disadvantages | Copy |
| Complexity / perf | S / Low |
| Works with | REC-01 |
| Fits identities | C |
| Patterns | Staff as faces of systems |

### ANL-04 · Matchanalys – Vårt lag

**Current:** Own team over last five or season: form, goal difference, attack & defence metrics, outfield and goalkeeper season tables (ignoring the window toggle), patterns.

**Recommendation:** A — Rolling trends plus tables that respect the window fix the main confusion.

**Priority:** P2 · **Dependencies:** Trend chart component, Window-aware player aggregates

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Trends + window-aware tables

| | |
|---|---|
| Visual concept | Rolling lines per metric, player contribution bars; tables respect window or label "Hela säsongen" explicitly. |
| Layout | Charts → tables. |
| Information hierarchy | Trend. |
| Interactions | Window toggle affects all. |
| Navigation | Training/Tactics links. |
| Desktop | Grid. |
| Mobile | Stack. |
| Advantages | Consistent |
| Disadvantages | Window player stats need per-match aggregation (data exists in archives; verify) |
| Complexity / perf | M / Low |
| Works with | ANL-02, SQD-01 |
| Fits identities | A |

#### B — Squad contribution court

| | |
|---|---|
| Visual concept | Contribution per position drawn on the court. |
| Layout | Court. |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | Court. |
| Mobile | Court. |
| Advantages | Handball-native |
| Disadvantages | Aggregation by position |
| Complexity / perf | M / Low |
| Works with | SQD-01 |
| Fits identities | B, C |

#### C — Merge into ANL-02

| | |
|---|---|
| Visual concept | Fold into the trend dashboard as "Vårt lag" section. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | - |
| Desktop | - |
| Mobile | - |
| Advantages | Fewer pages |
| Disadvantages | Long page |
| Complexity / perf | S / Low |
| Works with | ANL-02 |
| Fits identities | A, C |

### ANL-05 · Matchanalys – Senaste matchen

**Current:** Latest own match deep dive: scoreboard, team match facts, player contributions, filterable event timeline, halves split, scoring runs, patterns; largely duplicates the report; no match picker.

**Recommendation:** C — Merge into the report (ANL-01 C) so any match gets the same story + depth; its unique parts (halves split, scoring runs) become report sections.

**Priority:** P1 · **Dependencies:** ANL-01 C

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Keep as stats deep dive with picker

| | |
|---|---|
| Visual concept | Add a match picker and remove facts already on the report. |
| Layout | Picker + timeline + halves. |
| Information hierarchy | - |
| Interactions | Pick match. |
| Navigation | - |
| Desktop | Grid. |
| Mobile | Stack. |
| Advantages | Little change |
| Disadvantages | Still duplicates |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A |

#### B — Replay-led analysis

| | |
|---|---|
| Visual concept | Event timeline drives a court replay. |
| Layout | Court + timeline. |
| Information hierarchy | - |
| Interactions | Scrub. |
| Navigation | - |
| Desktop | Stage. |
| Mobile | Landscape. |
| Advantages | Engaging |
| Disadvantages | Perf |
| Complexity / perf | L / High |
| Works with | MDY-02l |
| Fits identities | B |

#### C — Merge into report

| | |
|---|---|
| Visual concept | Route redirects to the latest ANL-01 report; halves split and scoring runs become report sections; event filter (Mål, Räddningar, Bollförluster, 2 min, 7m) becomes the report timeline. |
| Layout | - |
| Information hierarchy | - |
| Interactions | - |
| Navigation | /career/analysis/last-match → /career/match-report/[latest]. |
| Desktop | - |
| Mobile | - |
| Advantages | Ends circular post-match content; Any match gets the analysis |
| Disadvantages | - |
| Complexity / perf | S / Low |
| Works with | ANL-01 |
| Fits identities | A, B, C |

## MGR — Manager career

### MGR-01 · Karriär (manager career) — HI-FI prototype `manager`

**Current:** Boardroom-photo MomentHero (dismissed / new club / neutral with reputation figure), two tabs: Profil och historik (Tränarprofilen with reputation meter and 'why reputation moved' log, Karriärstatistik, Avgå decision, Klubbarna stints with per-season tables, Milstolpar) and Jobbmarknaden (offers as DecisionCards, vacancies with candidacy hint, applications with interviews). No manager face; same photo for every state.

**Recommendation:** C — The career is the long game; a biography organised in chapters (one per club stint) with an annotated reputation line turns the existing reputationLog, milestones and stints into a story the player wants to extend. The job market becomes 'Nästa kapitel', so dismissal and new jobs read as turning points, not admin.

**Priority:** P1 · **Dependencies:** Event chain presentation (reputationLog reasons + milestones), MGR-02 merge into Karriär hub, DSH-01c season card write-back, G4 portrait strategy (manager monogram/avatar), Dual meter component

**Arena Nights (owner identity, 2026-11-13):** adapt → *Career Chapters* — Keep chapters, the single career reputation line with annotated causes, 'Nästa kapitel' job market and the quiet resign footer. Chapters as neon timeline nodes, trophies with gold glow, headline in condensed display. _Conflict:_ Manager Biography relies on serif biography typesetting and a printed-chapter feel.

#### A — Career Ledger

| | |
|---|---|
| Visual concept | A precise career record: reputation gauge and level label, career W–D–L, goals, SM-guld/cup titles, dismissals/resignations; stints as an expandable ledger table (club, period, league, positions, objectives %, honours, reputation in→out). |
| Layout | KPI strip → reputation trend chart (with log entries as dots) → stints ledger → job market tab. |
| Information hierarchy | Reputation level → record → stints. |
| Interactions | Sort/expand stints; log dot hover shows reason; tab to Jobbmarknaden. |
| Navigation | Karriär hub root; tabs Profil · Jobb · Historik. |
| Desktop | Dense tables and charts. |
| Mobile | KPI 2×2, chart, stints as cards. |
| Advantages | Fast, complete; Easy to build from existing data |
| Disadvantages | Feels like a CV, not a legacy; Milestones lose their weight |
| Complexity / perf | M / Low |
| Works with | MGR-02, CLB-05 |
| Fits identities | A |
| Patterns | Hover cards for every entity |

#### B — Legacy Wall

| | |
|---|---|
| Visual concept | A trophy-room wall: manager card (monogram, reputation tier badge), honours as trophies on shelves, club crests of every stint as framed shirts, milestone plaques (Uppflyttning, SM-guld, Avsked) — memorabilia of a career. |
| Layout | Hero manager card → trophy shelves → crest frames → plaques. |
| Information hierarchy | Biggest honours → clubs → plaques. |
| Interactions | Trophy/plaque → season detail; crest → stint stats. |
| Navigation | Karriär hub landing in B identity. |
| Desktop | Full-bleed room. |
| Mobile | Swipe shelves. |
| Advantages | Emotional reward for long careers; Screenshot value |
| Disadvantages | Empty and sad for new careers; Asset cost (trophies per competition); Data detail hidden |
| Complexity / perf | L / High |
| Works with | MGR-02, MGR-03b |
| Fits identities | B |
| Patterns | Visible facility tree |

#### C — Manager Biography

| | |
|---|---|
| Visual concept | A biography in chapters. Header: manager monogram, reputation level ('Respekterad i Allsvenskan'), dual meter with current board. A single reputation line runs across the whole career with annotated events (reputationLog reasons, milestones: APPOINTED, PROMOTION, TITLE, CUP, RELEGATION, DISMISSED, RESIGNED). Each stint is a chapter: crest, dates, why it began and ended, season-by-season positions and honours, reputation in→out. Last chapter is open: 'Nästa kapitel' = job market. |
| Layout | Header → career reputation line (full width) → chapters (newest first, collapsible) → Nästa kapitel (offers, vacancies, applications) → Avgå in a quiet footer. |
| Information hierarchy | Who you are now → the arc → the current chapter → what's next. |
| Interactions | Hover an annotation → reason + linked event (match report, board minute); chapter seasons open season books; resign uses a consequence-preview decision. |
| Navigation | Karriär hub root; tabs Biografi · Jobbmarknaden · Säsongsböcker (MGR-02). |
| Desktop | Editorial long-form with a sticky chapter index. |
| Mobile | Header, sparkline arc, chapters as cards, sticky 'Jobbmarknaden' chip when unemployed. |
| Advantages | Turns existing data into a story; Makes reputation causes legible; Dismissal/appointment become chapter breaks |
| Disadvantages | Copy templates for chapter intros; needs new data: manager avatar/monogram choice (optional) |
| Complexity / perf | M / Low |
| Works with | MGR-01a, MGR-01b, MGR-01c, MGR-02, CLB-05, DSH-01c |
| Fits identities | C, A |
| Patterns | Dated, categorised news; Mood hub with causes |

### MGR-01a · Tab · Profil och historik

**Current:** Four panels: Tränarprofilen (reputation meter + last 10 log entries), Karriärstatistik (dl), Avgå decision, Klubbarna (stints with 6-col season tables) and Milstolpar list.

**Recommendation:** B — The reputation log already records why reputation moved; plotting it on a timeline with milestones is the clearest progression story.

**Priority:** P1 · **Dependencies:** MGR-01 C

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Stats Ledger

| | |
|---|---|
| Visual concept | Record tiles + stints table + milestone list, tidied. |
| Layout | Tiles → table → list. |
| Information hierarchy | Record. |
| Interactions | Expand. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | Cards. |
| Advantages | Simple |
| Disadvantages | No arc |
| Complexity / perf | S / Low |
| Works with | MGR-01 |
| Fits identities | A |

#### B — Annotated Reputation Timeline

| | |
|---|---|
| Visual concept | A time axis across the career: reputation line, stint bands coloured by club, milestone icons; clicking a point shows reason and source event. |
| Layout | Timeline chart + detail panel. |
| Information hierarchy | Turning points. |
| Interactions | Scrub/zoom; click point. |
| Navigation | Links to season books. |
| Desktop | Wide chart. |
| Mobile | Vertical timeline. |
| Advantages | Shows causality over years |
| Disadvantages | Sparse for new careers (show 'Ditt första kapitel') |
| Complexity / perf | M / Low |
| Works with | MGR-01, MGR-02 |
| Fits identities | C, A |
| Patterns | Mood hub with causes |

### MGR-01b · Tab · Jobbmarknaden

**Current:** Three panels: offers (DecisionCards with crest, deadline, years/wage, stature vs your reputation), vacancies (league, reason, deadline, candidacy hint 'stark kandidat / nära / stort kliv'), applications (interview questions as radios, status pills INTERVIEW/ANSWERED/OFFERED/REJECTED).

**Recommendation:** C — Applications already move through stages; a pipeline makes that progress visible and keeps offers, interviews and deadlines in one place, with each club card showing fit (stature vs reputation) using existing data.

**Priority:** P1 · **Dependencies:** Candidacy assessment (exists), Club cards with crest/colours, Interview as inline conversation

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Job Board Table

| | |
|---|---|
| Visual concept | Sortable table of all openings: club, league, stature, your fit, deadline, status. |
| Layout | Filters + table. |
| Information hierarchy | Fit and deadline. |
| Interactions | Sort, apply inline. |
| Navigation | — |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | Compare quickly |
| Disadvantages | Flat; interviews elsewhere |
| Complexity / perf | S / Low |
| Works with | CLB-04 |
| Fits identities | A |
| Patterns | Lists without decision-relevant columns (avoided) |

#### B — Club Offer Cards

| | |
|---|---|
| Visual concept | Each opening as a club card in its colours: crest, league, ambition line, stature vs your reputation fit bar, wage/years for offers; interview opens as a short conversation. |
| Layout | Card grid; offers first. |
| Information hierarchy | Offers → strong fits → reaches. |
| Interactions | Apply; interview overlay. |
| Navigation | Club Peek. |
| Desktop | 3-up grid. |
| Mobile | Swipe deck. |
| Advantages | Feels like being courted |
| Disadvantages | Less comparable |
| Complexity / perf | M / Medium |
| Works with | CLB-04 |
| Fits identities | B |
| Patterns | Fewer, weightier conversations |

#### C — Application Pipeline

| | |
|---|---|
| Visual concept | Columns Lediga → Ansökt → Intervju → Erbjudande → Avgjort; club cards move as time advances. Each card shows fit ('du är nära vad de söker' + factors), deadline, and the next action (Sök, Svara på intervjun, Tacka ja). |
| Layout | 5-column pipeline; detail Peek. |
| Information hierarchy | Cards needing your action glow. |
| Interactions | Inline apply/answer/accept with consequence ('Du lämnar Tumba'); interview answered in Peek. |
| Navigation | Offers also appear in Today's decisions. |
| Desktop | Kanban. |
| Mobile | Segmented stages with a list each. |
| Advantages | Progress visible as time passes; All stages in one place |
| Disadvantages | Sparse when few openings |
| Complexity / perf | M / Low |
| Works with | MGR-01, DSH-01d, WLD-01, CLB-04 |
| Fits identities | C, A |
| Patterns | Inbox as task queue; Predictive consequence preview |

### MGR-01c · Dismissed / unemployed hero state

**Current:** MomentHero kind=DISMISSAL with stamp (Sparkad / Avgått / Avtalet slut), headline and lede; elsewhere only a text note.

**Recommendation:** A — Being sacked is the most dramatic career event; it deserves a full-screen moment on the day, ending with an epitaph of the stint that is written into the biography.

**Priority:** P1 · **Dependencies:** Floodlight moment shell, MGR-01 biography chapter close, DSH-01d state front page

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Dismissal Moment

| | |
|---|---|
| Visual concept | On the day: lights down, stamp 'Sparkad', the board's reason, then an epitaph card (club, dates, matches, best placement, honours, reputation in→out) that closes the chapter; CTA 'Till jobbmarknaden'. |
| Layout | Overlay stages → epitaph → CTA. |
| Information hierarchy | Stamp → reason → epitaph. |
| Interactions | Skip; Continue to job market. |
| Navigation | Afterwards Idag becomes the 'Utan klubb' front page. |
| Desktop | Full-screen floodlight. |
| Mobile | Portrait stages. |
| Advantages | Proper weight; Creates a career artefact |
| Disadvantages | Motion/copy cost |
| Complexity / perf | M / Medium |
| Works with | MGR-01, DSH-01d, CLB-05 |
| Fits identities | B, C |
| Patterns | Fewer, weightier conversations |

#### B — Letter from the Board

| | |
|---|---|
| Visual concept | A formal letter in the inbox and a quiet hero on Karriär; no overlay. |
| Layout | Letter reader. |
| Information hierarchy | Letter. |
| Interactions | Read; link. |
| Navigation | WLD-01. |
| Desktop | Reader. |
| Mobile | Reader. |
| Advantages | Calm, cheap |
| Disadvantages | Undersells the event |
| Complexity / perf | S / Low |
| Works with | WLD-01b |
| Fits identities | C, A |

### MGR-02 · Historik

**Current:** SectionScene header, season link tabs; main: final table, statistics table, career match archive, transfers table; rail: final-placement milestone card. Long tables, no highlights; mojibake in fallback link text ('?ppna ?ldre matcharkiv ?', history/page.tsx L44).

**Recommendation:** C — Each finished season becomes a 'Säsongsbok' — a cover with final position, honours, top scorer and the season's defining match — opening into the tables. It sits in the Karriär hub next to the biography, so history is the visible payoff of progression. Fix the mojibake regardless.

**Priority:** P2 · **Dependencies:** MGR-01 Karriär hub, DSH-01c season card, Encoding fix in history/page.tsx L44

**Arena Nights (owner identity, 2026-11-13):** adapt → *Season Shelf (cards)* — Keep shelf → open structure: a horizontal row of tall season cards (spine strip with year, position, honour star) that opens into a cover panel (4/12) + tabs (8/12). Cards use club neon of the club managed that season, so history shows your career's colours. _Conflict:_ A skeuomorphic shelf of season books (spines, covers).

#### A — Season Archive

| | |
|---|---|
| Visual concept | Cleaned archive: season selector, summary strip, then tables with crests and sticky headers. |
| Layout | Selector → summary → tables. |
| Information hierarchy | Final position. |
| Interactions | Season switch. |
| Navigation | Karriär → Historik. |
| Desktop | Tables. |
| Mobile | Cards. |
| Advantages | Cheap, complete |
| Disadvantages | No highlights |
| Complexity / perf | S / Low |
| Works with | MGR-03 |
| Fits identities | A |

#### B — Scrapbook Wall

| | |
|---|---|
| Visual concept | Seasons as scrapbook pages: clippings of big results, trophy photo, top scorer card. |
| Layout | Pinboard. |
| Information hierarchy | Clippings. |
| Interactions | Open season. |
| Navigation | — |
| Desktop | Collage. |
| Mobile | Swipe pages. |
| Advantages | Nostalgic |
| Disadvantages | Asset/copy heavy; Tables hidden |
| Complexity / perf | L / Medium |
| Works with | MGR-01 |
| Fits identities | B, C |

#### C — Season Books

| | |
|---|---|
| Visual concept | A shelf of season books (spine shows year + position + honour star). A book's cover: final position, honours, top scorer, best/worst match, board verdict, reputation delta. Inside: final table, stats, matches, transfers. |
| Layout | Shelf row → open book: cover (4/12) + tabs (8/12). |
| Information hierarchy | Cover facts → tables. |
| Interactions | Pick book; tabs inside; match → report. |
| Navigation | Karriär → Säsongsböcker. |
| Desktop | Shelf + book. |
| Mobile | Year list → cover → sections. |
| Advantages | History as reward; Tables still there |
| Disadvantages | Cover facts need a 'best match' heuristic (derivable) |
| Complexity / perf | M / Low |
| Works with | MGR-01, DSH-01c, MGR-03b |
| Fits identities | C |
| Patterns | Dated, categorised news |

### MGR-02a · Season selector tabs

**Current:** Link tabs per season with aria-current; hidden when there is no history (no explanation).

**Recommendation:** A — A timeline of seasons with position badges doubles as a progression graph.

**Priority:** P3 · **Dependencies:** —

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Season Timeline

| | |
|---|---|
| Visual concept | Nodes per season with final position and honour star; empty state 'Din första säsong pågår'. |
| Layout | Horizontal nodes. |
| Information hierarchy | Current selection. |
| Interactions | Click node. |
| Navigation | URL ?season=. |
| Desktop | Row. |
| Mobile | Scroll. |
| Advantages | Shows trajectory |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | MGR-02 |
| Fits identities | A, C |

#### B — Dropdown

| | |
|---|---|
| Visual concept | Simple select with season list. |
| Layout | Select. |
| Information hierarchy | — |
| Interactions | Select. |
| Navigation | URL. |
| Desktop | Select. |
| Mobile | Native select. |
| Advantages | Scales to many seasons |
| Disadvantages | No trajectory |
| Complexity / perf | S / Low |
| Works with | MGR-02 |
| Fits identities | A |

### MGR-03 · Säsongen (season hub)

**Current:** Court/trophy photo hero; NextStep tone card; promotion/relegation movement lists; competition-coloured sections with SM-slutspel BracketGrid, kval TieCards, Svenska Cupen groups + bracket, side-by-side league tables with zone colours; upcoming matches; rules; awards gala. Very long; overlaps /career/competitions and the Svenska Cupen nav item.

**Recommendation:** B — The season hub should answer 'what is my path to something this season?' first. 'Path to Gold' puts your route — league position → SM-slutspel seed or kval → cup run — at the top as a projected path, with all tables one tab away. It turns the Swedish structure into stakes the player feels every week.

**Priority:** P1 · **Dependencies:** Season state machine / phases, Projected bracket (derived from current table), Competition marks, Tävling hub IA (merge with CMP competition page and Svenska Cupen item), MGR-03a/b

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Competition Centre

| | |
|---|---|
| Visual concept | A tabbed centre: Liga · SM-slutspel · Kval · Svenska Cupen · Galan, each a clean table/bracket; a summary strip at top (position, zone, next step). |
| Layout | Summary strip → URL tabs → content. |
| Information hierarchy | Your zone → active competition. |
| Interactions | Tabs; rows hover cards; ties open fixtures. |
| Navigation | Tävling hub root; absorbs Svenska Cupen nav. |
| Desktop | Tables with zone colours. |
| Mobile | Tabs scroll; tables → compact rows. |
| Advantages | Short page, fast lookups; Removes overlap |
| Disadvantages | Stakes less vivid; Brackets hidden until a tab is opened |
| Complexity / perf | M / Low |
| Works with | DSH-01b, CLB-04 |
| Fits identities | A |
| Patterns | Play menu as season state machine |

#### B — Path to Gold

| | |
|---|---|
| Visual concept | Your season as a route. Top: a path from today's league position through the seed you'd get ('Om serien slutade i dag: 5:a → kvartsfinal mot Sävehof') to the SM-final, or the kval branch if you're in the danger zone; Svenska Cupen as a parallel lane. Below: the competitions as sections/tabs with tables and brackets. |
| Layout | Path visual (12) → lanes: Handbollsligan/Allsvenskan, SM-slutspel/kval, Svenska Cupen → tables tabs → gala when live. |
| Information hierarchy | Your projected path and the next step → threats/opportunities (teams within 2 points) → full tables. |
| Interactions | Hover path node → what's needed ('2 poäng till 4:e plats = hemmafördel'); bracket animates as rounds resolve; title triggers trophy moment. |
| Navigation | Tävling hub root; Svenska Cupen nav item removed. |
| Desktop | Broadcast-style path graphic over tables. |
| Mobile | Vertical path (top to final), then tables as tabs. |
| Advantages | Makes Swedish structure (SM-slutspel, kval) emotionally legible; Per-week stakes; Uses derivable projection only |
| Disadvantages | Projection must be clearly labelled as hypothetical; Path graphic per format variant (Allsvenskan vs Handbollsligan) |
| Complexity / perf | L / Medium |
| Works with | MGR-03a, MGR-03b, DSH-01b, DSH-01c |
| Fits identities | B, C |
| Patterns | Per-event targets; Play menu as season state machine |

#### C — Season Almanac

| | |
|---|---|
| Visual concept | An editorial almanac: 'Läget' paragraph, movement columns (upp/ned/kval), then each competition as a chapter with table/bracket and short commentary; rules as margin notes. |
| Layout | Columns with chapter heads and margin notes. |
| Information hierarchy | Läget → movement → chapters. |
| Interactions | Chapters collapse; margin notes expand. |
| Navigation | Tävling hub. |
| Desktop | Two-column editorial. |
| Mobile | Single column with sticky chapter index. |
| Advantages | Explains rules in context; Readable |
| Disadvantages | Still long; Copy dependency |
| Complexity / perf | M / Low |
| Works with | WLD-02, MGR-02 |
| Fits identities | C |
| Patterns | Nested lockable tooltips; In-game glossary |

### MGR-03a · SM-slutspel / Kval / Cup sections

**Current:** SectionHead with mark + BracketGrid (QF/SF/F) or TieCards and champion aside; appears only once ties exist — no preview of the path.

**Recommendation:** A — Showing the bracket early as a ghosted projection gives the regular season stakes.

**Priority:** P2 · **Dependencies:** Projection from current table

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Ghost Bracket

| | |
|---|---|
| Visual concept | Bracket shown all season, ghosted with 'Om serien slutade i dag'; fills in solid as ties are set; your path highlighted. |
| Layout | Bracket. |
| Information hierarchy | Your path. |
| Interactions | Hover tie → teams' form. |
| Navigation | Fixture. |
| Desktop | Wide bracket. |
| Mobile | Round-by-round swipe. |
| Advantages | Stakes all season |
| Disadvantages | Must be clearly hypothetical |
| Complexity / perf | M / Low |
| Works with | MGR-03 |
| Fits identities | A, B, C |
| Patterns | Per-event targets |

#### B — Tie Cards

| | |
|---|---|
| Visual concept | Each tie as a card (seed, teams, games won in the series, next game), list by round. |
| Layout | Card list. |
| Information hierarchy | Your tie. |
| Interactions | Card → fixtures. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | List. |
| Advantages | Readable on phones |
| Disadvantages | Bracket shape lost |
| Complexity / perf | S / Low |
| Works with | MGR-03 |
| Fits identities | A, C |

### MGR-03b · Season verdict & awards gala

**Current:** Verdict grid (champion, runner-up, cup winner, series winners) + EventCards per award; only on this page.

**Recommendation:** A — Awards are a ritual; a short skippable gala sequence, then filed into season books.

**Priority:** P2 · **Dependencies:** Floodlight moment shell, MGR-02 season books

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Gala Sequence

| | |
|---|---|
| Visual concept | Award-by-award reveal (Årets spelare, skyttekung, årets målvakt, årets tränare…), your nominees highlighted; ends with a summary card saved to the season book. |
| Layout | Stages → summary. |
| Information hierarchy | Your club's winners. |
| Interactions | Next/skip. |
| Navigation | Opens once after season end. |
| Desktop | Floodlight overlay. |
| Mobile | Portrait stages. |
| Advantages | Celebration; History artefact |
| Disadvantages | Motion budget |
| Complexity / perf | M / Medium |
| Works with | DSH-01c, MGR-02 |
| Fits identities | B, C |

#### B — Awards Page

| | |
|---|---|
| Visual concept | A static grid of award cards with players and stats. |
| Layout | Grid. |
| Information hierarchy | Award names. |
| Interactions | Player Peek. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | List. |
| Advantages | Cheap |
| Disadvantages | No ritual |
| Complexity / perf | S / Low |
| Works with | MGR-03 |
| Fits identities | A |

### MGR-04 · Momentbiblioteket (moment library)

**Current:** Developer reference page showing the experience components (MomentHero, EventCard, DecisionCard, MeterBar, ProgressSteps, RouteLine, ValueFlow) with the user's club; reachable only by URL; buttons inert but look real.

**Recommendation:** B — A component gallery belongs in the Design Lab, not in a player-reachable route; if kept, it must be dev-flagged.

**Priority:** P3 · **Dependencies:** Design Lab component gallery

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Dev-flagged Gallery

| | |
|---|---|
| Visual concept | Keep the route behind a dev flag with a visible 'DEV' ribbon and labelled inert controls. |
| Layout | Gallery grid. |
| Information hierarchy | Component names. |
| Interactions | None. |
| Navigation | Hidden from player nav. |
| Desktop | Grid. |
| Mobile | Auto-fit. |
| Advantages | Useful with real club data |
| Disadvantages | Maintains a route |
| Complexity / perf | S / Low |
| Works with | SYS-01 |
| Fits identities | A |

#### B — Move to Design Lab

| | |
|---|---|
| Visual concept | Remove the route; specimens live in design-lab with mock data. |
| Layout | — |
| Information hierarchy | — |
| Interactions | — |
| Navigation | Route 404/redirect to Idag. |
| Desktop | — |
| Mobile | — |
| Advantages | No player exposure |
| Disadvantages | Loses real-data preview |
| Complexity / perf | S / Low |
| Works with |  |
| Fits identities | A |

## WLD — World & communication

### WLD-01 · Inkorg (Inbox) — HI-FI prototype `inbox`

**Current:** PageHeading + masthead strip (date, unread, action-required counts); two-pane layout: left feed with 9 flat filter buttons and message rows (category · date, unread dot, subject, preview, 'ÅTGÄRD KRÄVS →'), right article with kicker, H2, byline (sender role), optional MatchHero/PlayerCell, paragraphs, next-step destination buttons and tools. Messages look alike; actions only via navigation.

**Recommendation:** C — The Correspondence Desk combines the two things the genre proved: a pinned 'Att göra' tray with inline resolution (task queue) and consolidated threads per entity. Its reader shows the chain — news → event → your decision → consequence → career log — so the inbox becomes the place where the story is visible, not just where tasks queue. A's triage speed is available via density mode.

**Priority:** P0 · **Dependencies:** careerEventId linking (exists), Inline actions reusing existing mutations (contracts, board, press, scouting), Thread grouping by entity (presentation), Peek drawer, Sender role emblems (roles, not invented names)

**Arena Nights (owner identity, 2026-11-13):** adapt → *Message Desk* — Keep the desk structure: pinned 'Att göra' tray, threads grouped by entity, reader with chain rail. Letters become glass message cards (no rotation); the top item has a neon edge and glow; headlines in condensed display. _Conflict:_ Correspondence Desk uses a paper-desk metaphor: rotated letters, paper stack, serif headlines.

#### A — Task Inbox

| | |
|---|---|
| Visual concept | A triage tool: three lanes Att göra / Nytt / Klart, each row with its verb inline (Svara, Förläng, Välj fokus), keyboard j/k/e, bulk archive. The reader is secondary. |
| Layout | Lane tabs with counts → dense list with inline actions → optional reader pane. |
| Information hierarchy | Att göra count → deadlines → unread. |
| Interactions | Resolve from the row with consequence tooltip; e = archive (blocked for unresolved action-required, as today); multi-select. |
| Navigation | Idag decisions are the same items; Continue blocked count links here. |
| Desktop | Single dense list, reader on demand. |
| Mobile | Swipe right resolve, left archive; tap = full-screen reader. |
| Advantages | Fastest to zero; Direct genre lesson (FM27 inline actions) |
| Disadvantages | Flattens the world into chores; Little sense of who is talking |
| Complexity / perf | M / Low |
| Works with | DSH-01, CLB-05b, WLD-03 |
| Fits identities | A |
| Patterns | Inbox as task queue; Bulk actions + notes on entities; Continue button as heartbeat |

#### B — Messenger Feed

| | |
|---|---|
| Visual concept | Conversations by sender role (Assisterande tränare, Huvudscout, Fysio, Styrelsen, Sportchef): chat-style threads with role emblems; decisions arrive as quick-reply buttons. |
| Layout | Conversation list → chat thread. |
| Information hierarchy | Unread conversations → quick replies. |
| Interactions | Quick replies; tap media cards (match, player). |
| Navigation | Floating Continue; notifications as chat badges. |
| Desktop | Two-pane chat. |
| Mobile | Native messenger feel. |
| Advantages | Staff become voices; Very mobile-native |
| Disadvantages | Board/legal letters feel trivial in chat; Long reports read poorly; Senders are roles, not people — chat with a role feels thin |
| Complexity / perf | M / Low |
| Works with | DSH-01, WLD-01b |
| Fits identities | B |
| Patterns | Staff as faces of systems; Consolidated threads |

#### C — Correspondence Desk

| | |
|---|---|
| Visual concept | A desk with a pinned 'Att göra' tray (decisions with deadlines, resolvable inline) and a correspondence column grouped into threads by entity (a player, a deal, the board, a match). The reader shows the thread's chain: what happened (news/event) → what was asked → what you decided → the consequence (confidence/rykte/morale change) → filed to career log. |
| Layout | Tray (top, max 5) → filter segment + category chips → threaded list (left) → reader with chain rail (right). |
| Information hierarchy | Tray deadlines → unread threads → thread chain. |
| Interactions | Resolve in tray or reader with consequence preview; thread collapses older messages; chain rail items open Peek; archive guarded for unresolved items. |
| Navigation | Idag's decision column = the tray; Media stories that involve you link into threads. |
| Desktop | Three zones; serif headlines; role emblems. |
| Mobile | Tray as top cards, list, full-screen reader with sticky action bar and chain as a collapsible timeline. |
| Advantages | Task closure + narrative continuity; Consolidation reduces noise; Consequences become visible and memorable |
| Disadvantages | Thread grouping rules needed; More complex than A |
| Complexity / perf | L / Low |
| Works with | DSH-01, WLD-02, WLD-03, CLB-05, MGR-01, WLD-01b |
| Fits identities | C, A |
| Patterns | Inbox as task queue; Consolidated threads; Predictive consequence preview; Dated, categorised news |

### WLD-01a · Inbox filters

**Current:** Row of 9 equal aria-pressed buttons (Alla, Olästa, Åtgärd krävs, Kontrakt, Transfers, Analys, Scouting, Tränarstab, Arkiverat) with no counts.

**Recommendation:** A — Three top-level states plus counted category chips match how players triage.

**Priority:** P0 · **Dependencies:** —

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Segment + Chips

| | |
|---|---|
| Visual concept | Segment Att göra · Allt · Arkiv; below, category chips with counts (Kontrakt 2, Scouting 1…), URL-persisted. |
| Layout | Two rows. |
| Information hierarchy | Att göra count. |
| Interactions | Single segment, multi chips. |
| Navigation | ?view=&cat=. |
| Desktop | Two rows. |
| Mobile | Segment + horizontal chip scroll. |
| Advantages | Clear hierarchy; Counts |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | A, C |
| Patterns | Inbox as task queue |

#### B — Sender Lanes

| | |
|---|---|
| Visual concept | Auto-grouped by sender role (Styrelsen, Tränarstab, Scouting, Medicin, Media) as collapsible lanes. |
| Layout | Lane headers. |
| Information hierarchy | Lanes with unread. |
| Interactions | Collapse/expand. |
| Navigation | — |
| Desktop | Lanes. |
| Mobile | Lanes. |
| Advantages | Organises by voice |
| Disadvantages | Deadlines spread across lanes |
| Complexity / perf | S / Low |
| Works with | WLD-01 |
| Fits identities | B, C |
| Patterns | Staff as faces of systems |

### WLD-01b · Message reader + empty states

**Current:** Article with data-category, kicker, H2, sender role byline, optional MatchHero/PlayerCell, 13px paragraphs, destination buttons ('Nästa steg'), read/archive tools; empty states 'Välj ett meddelande…' / 'Inga meddelanden i denna vy.'

**Recommendation:** C — The reader is where consequences should be visible; a chain rail linking earlier events and the eventual outcome makes every message part of the career story.

**Priority:** P0 · **Dependencies:** careerEventId, Inline action components, Consequence log (reputationLog, board factors, press consequences)

**Arena Nights (owner identity, 2026-11-13):** adapt → *Thread Reader with Chain Rail (Arena)* — Message body in Barlow 15/1.55 for readability; chain rail as neon-linked nodes; 'Följd' becomes a glowing outcome badge + 'Sparat i karriärloggen'. _Conflict:_ Letter-style body with serif headline; 'Följd' stamp as an ink stamp.

#### A — Action-first Reader

| | |
|---|---|
| Visual concept | Decision block on top (options with consequence preview and deadline), body below, entity card (player/match) beside. |
| Layout | Decision → body → entity. |
| Information hierarchy | Options. |
| Interactions | Resolve inline; result replaces block. |
| Navigation | Destination as secondary. |
| Desktop | Reader pane. |
| Mobile | Sticky action bar at bottom. |
| Advantages | No navigation to act |
| Disadvantages | Narrative secondary |
| Complexity / perf | M / Low |
| Works with | WLD-01 |
| Fits identities | A |
| Patterns | Inbox as task queue; Predictive consequence preview |

#### B — Scene Reader

| | |
|---|---|
| Visual concept | Message rendered as a scene: sender role emblem large, the text as a spoken bubble, rich visuals (match hero, player card, court diagram for tactical notes). |
| Layout | Emblem + bubble + visual. |
| Information hierarchy | Who → what. |
| Interactions | Quick replies. |
| Navigation | — |
| Desktop | Centered scene. |
| Mobile | Full screen. |
| Advantages | Atmospheric |
| Disadvantages | Long reports awkward |
| Complexity / perf | M / Medium |
| Works with | WLD-01 |
| Fits identities | B |
| Patterns | Staff as faces of systems |

#### C — Thread Reader with Chain Rail

| | |
|---|---|
| Visual concept | Letter-style body with serif headline; a left rail lists the chain for this entity (e.g. 'Skada på träning 12/1 → Fysio: 3 veckor → Du valde vila → Tillbaka 2/2 → Truppen +moral'); decisions inline with consequence preview; once resolved, a 'Följd' stamp shows the outcome and 'Sparat i karriärloggen'. |
| Layout | Chain rail (3/12) + letter (9/12) with decision block. |
| Information hierarchy | Headline → decision → chain context. |
| Interactions | Rail items open earlier messages/Peek; resolve inline; follow-up auto-threads. |
| Navigation | Destinations as links, not the only way to act. |
| Desktop | Two-column reader. |
| Mobile | Letter full screen; chain as collapsible timeline at top; sticky action bar. |
| Advantages | Narrative continuity; Consequence visibility |
| Disadvantages | Chain needs consistent event linking (careerEventId exists, consequences partly) |
| Complexity / perf | L / Low |
| Works with | WLD-01, MGR-01, CLB-05 |
| Fits identities | C |
| Patterns | Consolidated threads; Predictive consequence preview |

### WLD-02 · Mediecentret (Media)

**Current:** Press-room photo hero (top story as headline), 5 tabs (Nyheter, Presskonferenser with open count, Rivaler, Disciplin, Medierna); feed = lead StoryCard + list of typographic cards with scope filter and search. No images; rivals/discipline/outlets are thin lists; news split across Media, Inbox and Dashboard.

**Recommendation:** C — A newsstand where each outlet has its own masthead and tier (local paper vs Handbollsmedia vs national) makes the fictional media world legible and cheap to make immersive; your stories link into inbox threads, so news → event → decision connects.

**Priority:** P1 · **Dependencies:** Outlet masthead styles, WLD-01 thread linking, Dated, categorised news, Image policy (G3) for match/arena photos

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — News Desk

| | |
|---|---|
| Visual concept | A dense, dated news list with outlet, scope, category and your-club flag; filters and search; press conferences as a pinned row. |
| Layout | Filters → list (date groups) → reader Peek. |
| Information hierarchy | Your club's stories → date. |
| Interactions | Filters, search, Peek reading. |
| Navigation | Världen hub (Media) secondary tabs. |
| Desktop | List + Peek. |
| Mobile | List → full-screen story. |
| Advantages | Fast, scannable; Fixes undated/uncategorised |
| Disadvantages | No atmosphere |
| Complexity / perf | S / Low |
| Works with | WLD-04, WLD-03 |
| Fits identities | A |
| Patterns | Dated, categorised news |

#### B — Broadcast Feed

| | |
|---|---|
| Visual concept | Image-led social/broadcast feed: match photos, quotes as graphics, live-ish posts after results. |
| Layout | Card feed. |
| Information hierarchy | Image → headline. |
| Interactions | Like-less reading; tap opens. |
| Navigation | — |
| Desktop | Masonry. |
| Mobile | Vertical feed. |
| Advantages | Lively |
| Disadvantages | Asset hungry; Social feed tone clashes with lower-league local media |
| Complexity / perf | M / High |
| Works with | WLD-04 |
| Fits identities | B |
| Patterns | Era- or tier-skinned news |

#### C — Newsstand

| | |
|---|---|
| Visual concept | Front pages per outlet side by side (local paper, regional, Handbollsmedia, national), each with its masthead style and your club's coverage first; a combined 'Senaste' column; press conferences as a featured slot; tabs become sections (Rivaler, Medierelationer). |
| Layout | Featured press slot → outlet front pages row → Senaste column → sections. |
| Information hierarchy | Your club's headline in each outlet → press slot → others. |
| Interactions | Outlet page opens filtered feed; stories link to inbox thread if they concern a decision. |
| Navigation | Världen hub; Disciplin moves to player status. |
| Desktop | Grid of mini front pages. |
| Mobile | Swipe between outlets; Senaste list below. |
| Advantages | Tier-skinned immersion; Shows how different outlets see you (media favour) |
| Disadvantages | Outlet styles must stay legible; Copy variety |
| Complexity / perf | M / Medium |
| Works with | WLD-03, WLD-04, WLD-01, WLD-02e |
| Fits identities | C, B |
| Patterns | Era- or tier-skinned news; Dated, categorised news |

### WLD-02a · Tab · Nyheter (feed)

**Current:** Radiogroup scope chips (Alla, Din klubb, Lokalt, Regionalt, Nationellt, Handbollsmedia) + search, lead card + list; no images.

**Recommendation:** A — Image-led lead with a dated list is the best balance; it reuses existing match/arena images.

**Priority:** P1 · **Dependencies:** Image policy

**Arena Nights (owner identity, 2026-11-13):** adapt → *Image Lead + Dated List (Arena)* — Lead headline in condensed display over the photo's dark gradient; dated list and outlet chips unchanged. _Conflict:_ Lead story with serif headline.

#### A — Image Lead + Dated List

| | |
|---|---|
| Visual concept | Lead story with photo crop and serif headline; list grouped by date with outlet chips. |
| Layout | Lead → list. |
| Information hierarchy | Lead. |
| Interactions | Filters, search. |
| Navigation | WLD-04. |
| Desktop | 8/4. |
| Mobile | Stack. |
| Advantages | Readable, visual |
| Disadvantages | Image reuse can repeat |
| Complexity / perf | S / Medium |
| Works with | WLD-04 |
| Fits identities | C, A |
| Patterns | Dated, categorised news |

#### B — Outlet Carousel

| | |
|---|---|
| Visual concept | Carousel of outlet front pages; tap to open that outlet's feed. |
| Layout | Carousel → feed. |
| Information hierarchy | Outlet. |
| Interactions | Swipe. |
| Navigation | — |
| Desktop | Carousel. |
| Mobile | Swipe. |
| Advantages | Outlet identity |
| Disadvantages | Hides recency |
| Complexity / perf | M / Medium |
| Works with | WLD-02 |
| Fits identities | B, C |
| Patterns | Era- or tier-skinned news |

### WLD-02b · Tab · Presskonferenser

**Current:** List of press conference links with title, date and status; open count in tab label.

**Recommendation:** B — Open press conferences are decisions; they belong in the Att göra tray and Today, with this tab as an archive of what you said and what it caused.

**Priority:** P1 · **Dependencies:** WLD-01 tray, WLD-03 consequences

**Arena Nights (owner identity, 2026-11-13):** token — Structure unchanged; Arena Nights tokens and the club accent restyle it. No paper-specific dependency found.

#### A — Press Calendar

| | |
|---|---|
| Visual concept | Upcoming/open conferences with countdown and status chips; one featured. |
| Layout | Featured + list. |
| Information hierarchy | Open now. |
| Interactions | Open. |
| Navigation | WLD-03. |
| Desktop | List. |
| Mobile | List. |
| Advantages | Clear |
| Disadvantages | Still a separate place to check |
| Complexity / perf | S / Low |
| Works with | WLD-03 |
| Fits identities | A |

#### B — Decisions + Quote Archive

| | |
|---|---|
| Visual concept | Open conferences surface as tray items; the tab shows past conferences as quote cards with their consequences (Truppen +, Styrelsen −, Ditt rykte +). |
| Layout | Quote cards. |
| Information hierarchy | Your quote → consequences. |
| Interactions | Card → transcript. |
| Navigation | WLD-01 tray. |
| Desktop | Grid. |
| Mobile | List. |
| Advantages | Consequences visible over time |
| Disadvantages | Relies on tray adoption |
| Complexity / perf | S / Low |
| Works with | WLD-01, WLD-03, MGR-01 |
| Fits identities | C |
| Patterns | Inbox as task queue |

### WLD-02c · Tab · Rivaler

**Current:** Optional compact 'Öppen fejd' hero + two panels of lists (coach relations, club rivalries).

**Recommendation:** A — Rivalries need history and a next meeting to matter.

**Priority:** P2 · **Dependencies:** —

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Rivalry Cards

| | |
|---|---|
| Visual concept | One card per rival coach/club: relation meter, last flashpoint (quote/match), H2H, next meeting date. |
| Layout | Card grid. |
| Information hierarchy | Hottest feud. |
| Interactions | Card → club Peek / transcript. |
| Navigation | CLB-04. |
| Desktop | Grid. |
| Mobile | Stack. |
| Advantages | Story-rich |
| Disadvantages | — |
| Complexity / perf | S / Low |
| Works with | CLB-04, WLD-03 |
| Fits identities | C, B |

#### B — Heat Map

| | |
|---|---|
| Visual concept | League clubs as a grid coloured by rivalry heat. |
| Layout | Grid. |
| Information hierarchy | Hot cells. |
| Interactions | Hover. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | List. |
| Advantages | Overview |
| Disadvantages | Abstract |
| Complexity / perf | S / Low |
| Works with | CLB-04 |
| Fits identities | A |

### WLD-02d · Tab · Disciplin

**Current:** List of disciplinary cases or 'Inga ärenden.' under Media.

**Recommendation:** A — Suspensions are squad availability facts; they belong with the player and squad status, with Media keeping only the story.

**Priority:** P3 · **Dependencies:** Squad status chips (part B)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Move to Player Status

| | |
|---|---|
| Visual concept | Cases appear as status chips on players (avstängd 1 match) and in player Peek; Media keeps a small archive. |
| Layout | — |
| Information hierarchy | — |
| Interactions | Peek. |
| Navigation | Laget hub. |
| Desktop | — |
| Mobile | — |
| Advantages | Right home |
| Disadvantages | Cross-hub change |
| Complexity / perf | S / Low |
| Works with | DSH-01e |
| Fits identities | A, C |

#### B — Case File

| | |
|---|---|
| Visual concept | Each case with incident, verdict, suspension timeline. |
| Layout | List + detail. |
| Information hierarchy | Open cases. |
| Interactions | Expand. |
| Navigation | — |
| Desktop | List. |
| Mobile | List. |
| Advantages | Complete |
| Disadvantages | Still thin |
| Complexity / perf | S / Low |
| Works with | WLD-02 |
| Fits identities | C |

### WLD-02e · Tab · Medierna (outlets)

**Current:** Rows of OutletChip, relation value and story count — numbers without meaning.

**Recommendation:** A — A favour meter with what it means in coverage tone gives the number a purpose.

**Priority:** P3 · **Dependencies:** —

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Media Favour Meters

| | |
|---|---|
| Visual concept | Meter per outlet with label ('Välvillig', 'Kritisk') and one line on effect (tone of coverage), last story. |
| Layout | List. |
| Information hierarchy | Most critical. |
| Interactions | → outlet feed. |
| Navigation | WLD-02. |
| Desktop | List. |
| Mobile | List. |
| Advantages | Meaningful |
| Disadvantages | needs new data: plain-language effect copy per range |
| Complexity / perf | S / Low |
| Works with | WLD-02 |
| Fits identities | A, C |
| Patterns | Mood hub with causes |

#### B — Outlet Cards

| | |
|---|---|
| Visual concept | Cards with masthead, tier, relation, story count. |
| Layout | Grid. |
| Information hierarchy | Masthead. |
| Interactions | Open feed. |
| Navigation | — |
| Desktop | Grid. |
| Mobile | Stack. |
| Advantages | Visual identity |
| Disadvantages | Meaning still implicit |
| Complexity / perf | S / Low |
| Works with | WLD-02 |
| Fits identities | C, B |
| Patterns | Era- or tier-skinned news |

### WLD-03 · Presskonferens

**Current:** Compact press-room hero (pre/post match, date, stamp when closed); consequences panel when closed (Spelaren, Truppen, Styrelsen, Media, Rivalen, Supportrarna, Ditt rykte); ordered list of questions with outlet chip, journalist name, style badge, question and radio answers by tone (CONFIDENT, DIPLOMATIC, CRITICAL, PROVOCATIVE, HUMOROUS, DECLINE) with quote and hint; Delegate / Skip.

**Recommendation:** C — Press conferences are frequent, so ceremony must stay low (FM26 lesson), but they are also where the manager's voice creates consequences. The live transcript keeps all questions on one page, answers with one click per question, shows each quote landing and previews which groups react — then becomes the article. B is reserved as an optional 'big match' presentation.

**Priority:** P1 · **Dependencies:** Press consequence targets (exist), WLD-04 article from transcript, WLD-01 tray, MGR-01 reputation log

**Arena Nights (owner identity, 2026-11-13):** adapt → *Live Transcript (broadcast captions)* — Transcript as broadcast captions with journalist/outlet tags; tone chips and 'Vem reagerar' meter rail unchanged; closing article becomes a recap card with the same 'Följder' box. _Conflict:_ Quotes 'typeset into the transcript' and closing as an article.

#### A — Rapid Answer Sheet

| | |
|---|---|
| Visual concept | A compact form: each question one row with tone chips (Självsäker, Diplomatisk, Kritisk, Provocerande, Humor, Avböj) and consequence chips on hover; submit all. |
| Layout | Rows → Lämna svaren / Delegera / Hoppa över. |
| Information hierarchy | Questions. |
| Interactions | Keyboard 1–6 per row. |
| Navigation | Back to tray. |
| Desktop | Table-like rows. |
| Mobile | Stacked questions with chip rows. |
| Advantages | Fastest; Low ceremony |
| Disadvantages | No drama; journalists faceless |
| Complexity / perf | S / Low |
| Works with | WLD-02b |
| Fits identities | A |
| Patterns | Predictive consequence preview |

#### B — Press Room Scene

| | |
|---|---|
| Visual concept | One question at a time in Floodlight: journalist name and outlet, the room's murmur, your answer cards; after each answer a reaction line and consequence chips animate. |
| Layout | Scene → question → answer cards → reaction. |
| Information hierarchy | Current question. |
| Interactions | Choose; next; skip remaining → delegate. |
| Navigation | Ends on the article preview. |
| Desktop | Full-bleed. |
| Mobile | Portrait cards. |
| Advantages | Signature scene; Weighty |
| Disadvantages | Too much ceremony for every round; needs new data: journalist portraits (optional) |
| Complexity / perf | L / Medium |
| Works with | WLD-04 |
| Fits identities | B |
| Patterns | Fewer, weightier conversations |

#### C — Live Transcript

| | |
|---|---|
| Visual concept | A transcript page: questions appear in order with journalist and outlet; the active question shows tone chips with the quote preview; on answer, your quote is typeset into the transcript and small chips show who will react (Truppen ↑, Rivalen ↑ irritation). When closed it becomes the article with a 'Följder' box that also lands in the career log. |
| Layout | Transcript column (8/12) + 'Vem reagerar' meter rail (4/12); footer Delegera / Avböj. |
| Information hierarchy | Active question → your quotes so far → aggregate reaction. |
| Interactions | Click chip or 1–6; Undo before submitting; Delegera hands remaining questions to the assistant. |
| Navigation | From tray/Today; ends with link to the article and inbox thread. |
| Desktop | Editorial transcript. |
| Mobile | Active question card pinned bottom, transcript scrolls above. |
| Advantages | Low ceremony yet dramatic; Consequences previewed then recorded; Creates the article automatically |
| Disadvantages | Copy quality of quotes; Preview must reflect real consequence logic |
| Complexity / perf | M / Low |
| Works with | WLD-04, WLD-02b, WLD-01b, MGR-01 |
| Fits identities | C, A |
| Patterns | Predictive consequence preview; Fewer, weightier conversations |

### WLD-04 · Artikel (story)

**Current:** Article: outlet chip, scope, H1, standfirst, byline, body, quote blockquote, destination buttons, fiction note; 'Så skrev andra' list of StoryCards. No image; outlets indistinct.

**Recommendation:** B — Outlet-skinned articles (tabloid vs local paper vs Handbollsmedia) make the same event feel different by source at low cost; 'Så skrev andra' remains as a comparison strip.

**Priority:** P2 · **Dependencies:** Outlet masthead styles, WLD-02 Newsstand

**Arena Nights (owner identity, 2026-11-13):** native — Recommended alternative already fits Arena Nights; rendered as designed with the club accent.

#### A — Clean Reader

| | |
|---|---|
| Visual concept | Typographic reader with image crop, event links box, related coverage. |
| Layout | Article 680px + aside. |
| Information hierarchy | Headline. |
| Interactions | Links. |
| Navigation | Back to feed. |
| Desktop | Column. |
| Mobile | Column. |
| Advantages | Readable |
| Disadvantages | Outlets indistinct |
| Complexity / perf | S / Low |
| Works with | WLD-02 |
| Fits identities | A |

#### B — Outlet-skinned Article

| | |
|---|---|
| Visual concept | Masthead and typographic voice per outlet tier (local paper serif, tabloid heavy condensed red, Handbollsmedia web style); body + quote; 'Så skrev andra' strip. |
| Layout | Masthead → article → comparison strip. |
| Information hierarchy | Masthead + headline. |
| Interactions | Comparison strip opens other takes. |
| Navigation | Back to Newsstand. |
| Desktop | Column with masthead. |
| Mobile | Same. |
| Advantages | Cheap immersion; Media world legible |
| Disadvantages | Must keep legibility across skins |
| Complexity / perf | M / Low |
| Works with | WLD-02, WLD-03 |
| Fits identities | C, B |
| Patterns | Era- or tier-skinned news |

#### C — Why This Story

| | |
|---|---|
| Visual concept | Article with a context box tracing the event chain ('Skrivs efter: 24–29 mot Kristianstad · ditt svar på presskonferensen'). |
| Layout | Article + context box. |
| Information hierarchy | Headline → context. |
| Interactions | Chain links. |
| Navigation | Thread in inbox. |
| Desktop | 8/4. |
| Mobile | Box collapsed at top. |
| Advantages | Connects cause and coverage |
| Disadvantages | Needs reliable source links |
| Complexity / perf | M / Low |
| Works with | WLD-01b, WLD-03 |
| Fits identities | C |
| Patterns | Consolidated threads |

### WLD-05 · Kalender — HI-FI prototype `calendar`

**Current:** PageHeading with prev/next 4-week navigation; context strip; four stacked week panels, each a 7-column grid of 200px day cells (weekday, date, day type badge MATCH/TRAINING/TACTICAL/RECOVERY/REST/TRAVEL, Idag, sessions, match link, deadlines, scouting, milestones) followed by a duplicate fixture table; horizontal scroll on phones. Overlaps Schema and the dashboard weekly plan.

**Recommendation:** C — A Week Spine calendar shares one component with the dashboard and the global shell, merges Schema (as the list view) and removes the per-week fixture tables. Month, week and agenda views cover planning, today and phones.

**Priority:** P0 · **Dependencies:** Week Spine component, WLD-06 merge (list view), Continue state machine, Training week link (?week=)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Planner Grid

| | |
|---|---|
| Visual concept | A dense month grid (5×7) with compact day cells: day-type colour strip, match chip with crest, icons for deadlines/scouting/milestones; side panel shows the selected day. |
| Layout | Month grid (9/12) + day panel (3/12); filters for layers. |
| Information hierarchy | Matches → deadlines → training types. |
| Interactions | Click day → panel; layer toggles (Träning, Matcher, Kontrakt, Scouting, Landslag); keyboard arrows. |
| Navigation | Tävling/Idag link here; 'Hantera träning' opens week. |
| Desktop | Compact month grid. |
| Mobile | Agenda list grouped by week. |
| Advantages | Whole month at a glance; Kills page length |
| Disadvantages | Less narrative; Separate from the shell spine |
| Complexity / perf | M / Low |
| Works with | WLD-06, DSH-01i |
| Fits identities | A |
| Patterns | Portal home |

#### B — Season Road

| | |
|---|---|
| Visual concept | The season as a road from pre-season to final: weeks as milestones, matches as arenas, transfer windows as toll gates, national breaks as detours, SM-slutspel at the horizon. |
| Layout | Horizontal scrolling road with zoom; current week centred. |
| Information hierarchy | Next match → windows → playoffs. |
| Interactions | Scroll/zoom; click stop → detail. |
| Navigation | Tävling hub companion. |
| Desktop | Wide illustrated road. |
| Mobile | Vertical road. |
| Advantages | Season structure becomes visible; Atmospheric |
| Disadvantages | Poor for day-level planning; Illustration cost |
| Complexity / perf | L / Medium |
| Works with | MGR-03 |
| Fits identities | B |
| Patterns | Play menu as season state machine |

#### C — Week Spine Calendar

| | |
|---|---|
| Visual concept | The full form of the global Week Spine: the current week expanded (day cells with type, sessions, match, pins) above a zoomable season strip (weeks as ticks, matches, windows, national breaks, playoffs). Views: Vecka · Månad · Lista (Lista = today's Schema). |
| Layout | View switch → expanded week (12) → season strip (12) → selected day/fixture Peek. |
| Information hierarchy | Today and this week → next 4 pins → season horizon. |
| Interactions | Click season tick → jump week; drag across weeks to preview; pins open Peek; 'Hantera träning' per week; Continue moves the marker. |
| Navigation | Shell spine expands into this page; Schema becomes the Lista view. |
| Desktop | Week 7×1 cells (no 200px height), season strip below. |
| Mobile | Agenda list per day with sticky week header; season strip swipeable. |
| Advantages | One time model everywhere; Merges Schema and dashboard plan; Short page |
| Disadvantages | Component must handle dense weeks (match + travel + deadline) |
| Complexity / perf | M / Low |
| Works with | DSH-01i, WLD-06, WLD-06a, MGR-03, CLB-01c |
| Fits identities | C, A |
| Patterns | Continue button as heartbeat; Play menu as season state machine |

### WLD-06 · Schema (Matcher & resultat)

**Current:** SectionScene header; PreseasonPlanner form section at the top year-round; filter tabs; 8-column fixture table (Omg, Datum, Typ, H/B, Motstånd, Status, Resultat, link) without crests; rail with next-match panel. Nav label 'Schema' vs title 'Matcher & resultat'.

**Recommendation:** C — Fixtures are a view of time; as the calendar's Lista view they share filters and Peek, and the pre-season planner appears only in pre-season.

**Priority:** P1 · **Dependencies:** WLD-05 Week Spine Calendar, WLD-06a preseason board

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Fixture Table with Crests

| | |
|---|---|
| Visual concept | Keep a dedicated page: crests in rows, outcome colours, URL filters, planner removed from the top. |
| Layout | Filters → table; rail next match. |
| Information hierarchy | Next match → results. |
| Interactions | Row → preview/report. |
| Navigation | Tävling hub. |
| Desktop | Table. |
| Mobile | Cards. |
| Advantages | Familiar |
| Disadvantages | Still overlaps calendar |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | A |

#### B — Fixture Cards

| | |
|---|---|
| Visual concept | Cards per match with crests, venue image, outcome colour, competition mark. |
| Layout | Grid grouped by month. |
| Information hierarchy | Next match card large. |
| Interactions | Card → preview/report. |
| Navigation | — |
| Desktop | 3-up grid. |
| Mobile | List. |
| Advantages | Visual |
| Disadvantages | Less dense |
| Complexity / perf | S / Medium |
| Works with | WLD-05 |
| Fits identities | B |

#### C — Calendar List View

| | |
|---|---|
| Visual concept | No separate page: 'Lista' view of the Week Spine Calendar with chips (Hela säsongen · Kommande · Resultat · Tävling), crests, outcome colours. |
| Layout | Calendar view switch → list. |
| Information hierarchy | Next match row pinned. |
| Interactions | Chips; Peek. |
| Navigation | /career/schedule redirects to calendar?view=list. |
| Desktop | List. |
| Mobile | Agenda. |
| Advantages | One place for time |
| Disadvantages | Players used to a fixtures page must learn the view |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | C, A |
| Patterns | Inform vs navigate separation |

### WLD-06a · Preseason planner (tabs Träningsmatch / Läger-resa / Turnering)

**Current:** Plan section with cash intro, anchor-based sub-tabs (Träningsmatch / Läger-resa / Turnering), form grid, cost line and booked events list; shown year-round.

**Recommendation:** A — Pre-season booking is a calendar activity: empty pre-season weeks as slots you fill gives a spatial plan and cost visibility.

**Priority:** P2 · **Dependencies:** WLD-05 calendar, Season phase (pre-season only)

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Preseason Board on Calendar

| | |
|---|---|
| Visual concept | During pre-season the calendar shows empty slots; click a slot → drawer to book friendly/camp/tournament with cost vs cash. |
| Layout | Calendar weeks + booking drawer. |
| Information hierarchy | Open slots → cost. |
| Interactions | Click slot; book; cancel. |
| Navigation | Only in pre-season phase. |
| Desktop | Calendar + drawer. |
| Mobile | Slot list + full-screen form. |
| Advantages | Spatial planning; Hidden off-season |
| Disadvantages | Calendar must support slots |
| Complexity / perf | M / Low |
| Works with | WLD-05, DSH-01d |
| Fits identities | A, C |
| Patterns | Predictive consequence preview |

#### B — Preseason Wizard

| | |
|---|---|
| Visual concept | A 3-step wizard at season start: matcher → läger → turnering, with a cost summary. |
| Layout | Stepper. |
| Information hierarchy | Step. |
| Interactions | Next/back. |
| Navigation | Part of the 'Ny säsong' front page. |
| Desktop | Modal. |
| Mobile | Full screen. |
| Advantages | Ritual |
| Disadvantages | Harder to revise later |
| Complexity / perf | S / Low |
| Works with | DSH-01d |
| Fits identities | C, B |
| Patterns | Pre-season directive meeting |

### WLD-06b · Schedule filter tabs

**Current:** aria-pressed tab buttons (Hela säsongen / Kommande / Resultat), not URL-persisted; empty row 'Inga matcher i den här vyn.'

**Recommendation:** B — Filters should be shared with the calendar list view.

**Priority:** P3 · **Dependencies:** WLD-05 list view

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — URL Segmented Control

| | |
|---|---|
| Visual concept | Same three filters as a segmented control persisted in URL. |
| Layout | Segment. |
| Information hierarchy | Active. |
| Interactions | Switch. |
| Navigation | ?filter=. |
| Desktop | Segment. |
| Mobile | Segment. |
| Advantages | Minimal |
| Disadvantages | Separate from calendar |
| Complexity / perf | S / Low |
| Works with | WLD-06 |
| Fits identities | A |

#### B — Calendar Chips

| | |
|---|---|
| Visual concept | Filters as chips in the calendar's list view, combinable with competition chips. |
| Layout | Chips. |
| Information hierarchy | Active chips. |
| Interactions | Toggle. |
| Navigation | Shared state. |
| Desktop | Chips row. |
| Mobile | Scroll chips. |
| Advantages | One filter model |
| Disadvantages | Depends on WLD-05 C |
| Complexity / perf | S / Low |
| Works with | WLD-05 |
| Fits identities | C, A |

## MED — Medical

### MED-01 · Medicinskt & Rehabilitering

**Current:** EnvironmentBanner (medical-room photo, badge, metrics: active injuries, available x/y, rehab quality '1.00x'), a 7-column injuries table or empty scene, a 'Senaste återgångar' list, and a rail with the physio panel and next-selection note.

**Recommendation:** C — Medical is ultimately about availability for the next match. A return-to-play timeline aligned with the fixture list answers 'who can I pick on Saturday?' directly and makes the physio the face of the system.

**Priority:** P2 · **Dependencies:** Fixture list, Physio staff entity, ENT-07 hub mapping (Laget › Medicinskt), MED-01a

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Availability board

| | |
|---|---|
| Visual concept | Squad grouped by position (MV, VS, VN, MN, HN, HS, M) with availability status per player for the next 3 fixtures; injured rows expand to rehab phase and expected return. |
| Layout | KPI strip (injured, available x/16, next match); position-grouped table 9 cols; physio rail 3 cols. |
| Information hierarchy | 1) Next match availability 2) injured detail 3) physio. |
| Interactions | Sort; expand row; open player in Peek. |
| Navigation | Laget › Medicinskt tab; links to squad and tactics. |
| Desktop | Table + rail. |
| Mobile | Position groups as collapsible lists with status dots. |
| Advantages | Decision-relevant; Dense |
| Disadvantages | Less visual |
| Complexity / perf | S / Low |
| Works with | MED-01a, ENT-07 |
| Fits identities | A |
| Patterns | Lists without decision-relevant columns; Hover cards for every entity |

#### B — Treatment room

| | |
|---|---|
| Visual concept | The medical-room photo as a stage with injured players as cards on treatment beds: body-zone silhouette highlighting the injury, phase stepper, days to return; physio portrait card with a short advice line. |
| Layout | Hero room image; card row of injured players; physio card. |
| Information hierarchy | 1) Injured player cards 2) physio advice. |
| Interactions | Click card → player Peek; hover silhouette zone shows injury. |
| Navigation | Laget hub. |
| Desktop | Hero + cards. |
| Mobile | Swipe cards. |
| Advantages | Humanises injuries; Staff as face of system |
| Disadvantages | needs new data: injury body-zone mapping |
| Complexity / perf | M / Medium |
| Works with | MED-01a |
| Fits identities | B |
| Patterns | Staff as faces of systems |

#### C — Return-to-play timeline

| | |
|---|---|
| Visual concept | A Gantt-style timeline: rows = injured players, columns = upcoming days with fixture markers (HBL omg 12, Cupen); each bar shows rehab phases ending at expected return, so you see exactly which matches each player misses. Physio's note above as a quote. |
| Layout | Physio quote 12; timeline 9 + availability for next match 3; recent returns list. |
| Information hierarchy | 1) Who misses which match 2) phases 3) recent returns. |
| Interactions | Hover bar = phase + confidence; click name = Peek; fixture marker click = match preview. |
| Navigation | Laget › Medicinskt; the same timeline appears compact in tactics/selection. |
| Desktop | Timeline. |
| Mobile | Each player a card with a mini bar and "missar: lör, ons". |
| Advantages | Directly answers selection question; Uses existing return dates and fixtures |
| Disadvantages | Expected dates may imply false precision — show ranges |
| Complexity / perf | M / Low |
| Works with | MED-01a, WLD-05, WLD-06 |
| Fits identities | C, A |
| Patterns | Staff as faces of systems; Predictive consequence preview |

### MED-01a · Active injuries table / empty scene

**Current:** Panel with a horizontally scrolling 7-column table (severity as text) or a SceneEmpty when nobody is injured.

**Recommendation:** A — A phase stepper plus progress bar makes rehab state readable without the scroll-x table; the empty state should celebrate a full squad.

**Priority:** P2 · **Dependencies:** MED-01

**Arena Nights (owner identity, 2026-11-13):** token — Arena workbench: structure, density and interactions unchanged; dense data on solid dark surfaces (no blur), tabular figures, club neon only for selection, focus and own-club rows.

#### A — Rehab cards with phase stepper

| | |
|---|---|
| Visual concept | Each injury a row-card: player chip (position, number), injury, severity badge (colour + text), 4-step phase stepper, progress bar, return range. |
| Layout | Vertical list of row-cards. |
| Information hierarchy | 1) Player + return 2) phase 3) severity. |
| Interactions | Click → Peek. |
| Navigation | Within MED-01. |
| Desktop | Row-cards 2 columns. |
| Mobile | Single column cards, no scroll-x. |
| Advantages | No horizontal scroll; Phase legible |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | MED-01 |
| Fits identities | A, C |

#### B — Empty state: 'Full trupp'

| | |
|---|---|
| Visual concept | When no injuries: a positive state showing 16/16 tillgängliga with position chips all green and the physio's note. |
| Layout | Small celebratory panel. |
| Information hierarchy | 1) 16/16. |
| Interactions | None. |
| Navigation | Link to squad. |
| Desktop | Panel. |
| Mobile | Panel. |
| Advantages | Reinforces good state |
| Disadvantages | Only the empty variant |
| Complexity / perf | S / Low |
| Works with | MED-01 |
| Fits identities | C, B |

## SYS — Settings & internal tools

### SYS-01 · Inställningar (in-career settings)

**Current:** Ink band with court backdrop, H1 and two stats; a ChoiceGroup with two currency option cards showing a sample amount; a rail with preview dl (transfer budget, wage budget, top wage, cash) and 'Bra att veta'; visually heavy for one setting and diverges from ENT-05.

**Recommendation:** A — One settings component in and out of career; keep the excellent live preview using the club's own figures, and add density/text size/motion.

**Priority:** P2 · **Dependencies:** ENT-05, Density modes (G6)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Unified settings (shared with ENT-05)

| | |
|---|---|
| Visual concept | Same component as ENT-05 A; inside a career the Ekonomi section previews with the club's real budgets (keeps today's best idea). |
| Layout | Section nav 3 + rows 9. |
| Information hierarchy | 1) Section 2) control 3) live preview. |
| Interactions | Instant apply. |
| Navigation | From overflow/user menu; not a sidebar item. |
| Desktop | Two-column. |
| Mobile | List → detail. |
| Advantages | One implementation; Removes a nav item |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | ENT-05, ENT-08b |
| Fits identities | A, C |
| Patterns | Settings sprawl; Density modes |

#### B — Quick settings popover

| | |
|---|---|
| Visual concept | In-career settings as a popover from the user menu with the 4–5 toggles that matter mid-game (valuta, matchhastighet, densitet, rörelse) and a link to full settings. |
| Layout | Popover 320px. |
| Information hierarchy | 1) Toggles. |
| Interactions | Toggle inline. |
| Navigation | User menu. |
| Desktop | Popover. |
| Mobile | Sheet. |
| Advantages | No page change mid-session |
| Disadvantages | Loses the budget preview |
| Complexity / perf | S / Low |
| Works with | ENT-08 |
| Fits identities | A, B |

#### C — Settings inside Karriär hub

| | |
|---|---|
| Visual concept | Place settings as a tab in Karriär ('Spelet') with a manager-desk framing: currency preview shown as the club's budget sheet in the chosen currency. |
| Layout | Hub tab page with budget-sheet preview. |
| Information hierarchy | 1) Choice 2) budget sheet. |
| Interactions | Toggle; preview updates. |
| Navigation | Karriär › Spelet. |
| Desktop | Tab page. |
| Mobile | Single column. |
| Advantages | Discoverable via hubs |
| Disadvantages | Settings are not really "career" |
| Complexity / perf | S / Low |
| Works with | MGR-01, CLB-06 |
| Fits identities | C |

### SYS-02 · Editor home (dev data editor)

**Current:** Single hm-panel with UTVECKLING badge, four count stats and two buttons (players, ratings), gated by HM_EDITOR_ENABLED (404 otherwise); inline max-width style.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Dev console home

| | |
|---|---|
| Visual concept | Unified "Dev" shell with its own grey theme and DEV ribbon; home lists tools (Spelare, Betyg, Court grid, Labs, CPU-rekrytering) with counts. |
| Layout | Tool list 8 + data stats 4. |
| Information hierarchy | 1) Tools 2) counts. |
| Interactions | Click tool; keyboard shortcuts. |
| Navigation | Hub for all SYS tools; never linked from player nav. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | One gated home for all internal tools; Players never see it |
| Disadvantages | Small migration of routes |
| Complexity / perf | S / Low |
| Works with | SYS-02a, SYS-02c, SYS-03, SYS-04, SYS-05 |
| Fits identities | A |

#### B — Keep as is, restyle only

| | |
|---|---|
| Visual concept | Leave structure; replace inline styles with a dev theme class and add the DEV ribbon. |
| Layout | Unchanged. |
| Information hierarchy | Unchanged. |
| Interactions | Unchanged. |
| Navigation | Unchanged. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Zero risk |
| Disadvantages | Tools stay scattered |
| Complexity / perf | S / Low |
| Works with | SYS-02a, SYS-02c, SYS-03, SYS-04, SYS-05 |
| Fits identities | A |

### SYS-02a · Editor · players (bulk calibration table)

**Current:** Spreadsheet-like inline-editing table of every HBL + Allsvenskan player (714-line component).

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Keep spreadsheet, add dev affordances

| | |
|---|---|
| Visual concept | Sticky header/columns, column filters, dirty-cell highlight and a batch Save bar; dev theme. |
| Layout | Filter bar + table + save bar. |
| Information hierarchy | 1) Dirty cells 2) save. |
| Interactions | Inline edit, Ctrl+S, undo. |
| Navigation | From SYS-02. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Faster calibration |
| Disadvantages | Some build effort |
| Complexity / perf | S / Low |
| Works with | SYS-02b |
| Fits identities | A |

#### B — Split view

| | |
|---|---|
| Visual concept | Table left, selected player detail right for context while editing. |
| Layout | Table 7 + detail 5. |
| Information hierarchy | 1) Row 2) detail. |
| Interactions | Select row to load detail. |
| Navigation | Combines with SYS-02b. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Less page hopping |
| Disadvantages | Narrower table |
| Complexity / perf | M / Low |
| Works with | SYS-02b |
| Fits identities | A |

### SYS-02b · Editor · player detail

**Current:** Detail page with hm-panels 'VERKLIG DATA', 'TRUPP', 'SPEL-DATA' and save.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Diff-first detail

| | |
|---|---|
| Visual concept | Real data vs game data side by side with differences highlighted; save shows a diff summary. |
| Layout | Two columns + diff list. |
| Information hierarchy | 1) Differences. |
| Interactions | Edit, save with diff confirm. |
| Navigation | From SYS-02a. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Fewer calibration mistakes |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-02a |
| Fits identities | A |

#### B — Drawer in SYS-02a

| | |
|---|---|
| Visual concept | No separate page: detail opens as a drawer over the bulk table. |
| Layout | Drawer 480px. |
| Information hierarchy | 1) Fields. |
| Interactions | Open/close drawer. |
| Navigation | Part of SYS-02a. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Context kept |
| Disadvantages | Long pages cramped |
| Complexity / perf | M / Low |
| Works with | SYS-02a |
| Fits identities | A |

### SYS-02c · Editor · rating review roster

**Current:** Club selector → roster with rating proposals and review status; mirrors the players editor layout.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Review queue

| | |
|---|---|
| Visual concept | Roster table with status filter (Ej granskad / Granskad / Låst) and progress per club. |
| Layout | Club list 3 + roster 9. |
| Information hierarchy | 1) Unreviewed count. |
| Interactions | Filter, open detail. |
| Navigation | From SYS-02. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Clear review progress |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-02d |
| Fits identities | A |

#### B — Kanban by status

| | |
|---|---|
| Visual concept | Players as cards in columns by review status. |
| Layout | 3 columns. |
| Information hierarchy | 1) Columns. |
| Interactions | Drag between statuses. |
| Navigation | From SYS-02. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Visual progress |
| Disadvantages | Drag status risky without confirm |
| Complexity / perf | M / Low |
| Works with | SYS-02d |
| Fits identities | A |

### SYS-02d · Editor · rating detail

**Current:** Long detail page: source proposal, CA estimate, generated attributes, overrides, LOCK (625 lines).

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Sectioned with sticky summary

| | |
|---|---|
| Visual concept | Sticky summary (CA/PA, status, LOCK) at top; sections collapsible; overrides highlighted against generated values. |
| Layout | Sticky summary + sections. |
| Information hierarchy | 1) Status/CA 2) overrides. |
| Interactions | Edit, LOCK with confirm. |
| Navigation | From SYS-02c. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Less scrolling |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-02c |
| Fits identities | A |

#### B — Attribute grid compare

| | |
|---|---|
| Visual concept | All 1–20 attributes as a grid with generated/override/source in each cell. |
| Layout | Grid. |
| Information hierarchy | 1) Changed cells. |
| Interactions | Click cell to override. |
| Navigation | From SYS-02c. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Fast overview |
| Disadvantages | Dense |
| Complexity / perf | M / Low |
| Works with | SYS-02c |
| Fits identities | A |

### SYS-02e · Editor · court grid calibration

**Current:** Court canvas for calibrating the canonical 40×20 m court grid with mode controls.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Canvas + inspector

| | |
|---|---|
| Visual concept | Court canvas 9 cols with inspector 3 cols (mode, coordinates, snap); dev theme. |
| Layout | Canvas + inspector. |
| Information hierarchy | 1) Court. |
| Interactions | Click/drag calibrate; keyboard nudge. |
| Navigation | From SYS-02. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Clear tool layout |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-04 |
| Fits identities | A |

#### B — Overlay toolbar

| | |
|---|---|
| Visual concept | Full-width canvas with floating toolbar. |
| Layout | Canvas + floating toolbar. |
| Information hierarchy | 1) Court. |
| Interactions | Same. |
| Navigation | From SYS-02. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Max canvas |
| Disadvantages | Toolbar overlaps court |
| Complexity / perf | S / Low |
| Works with | SYS-04 |
| Fits identities | A |

### SYS-03 · Scenario lab (engine labs)

**Current:** Engine V2 labs index with dark 'HANDBALL ENGINE V2 · MILESTONE 1' headers and canvases; no env gate found, wrapped by the alpha gate and feedback button like the game.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P2 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Gate under dev console

| | |
|---|---|
| Visual concept | Move under the same env gate as /editor; list labs in the dev console; remove player feedback button there. |
| Layout | Lab list. |
| Information hierarchy | 1) Labs. |
| Interactions | Open lab. |
| Navigation | From SYS-02 dev home. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Not publicly reachable; Consistent dev shell |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-03a, SYS-03b, SYS-04 |
| Fits identities | A |

#### B — Labs as tabs of one page

| | |
|---|---|
| Visual concept | One /scenario-lab page with tabs Avkast · Omställning · Helmatch sharing a court canvas. |
| Layout | Tabs + canvas. |
| Information hierarchy | 1) Canvas. |
| Interactions | Switch tab. |
| Navigation | Self-contained. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Shared controls |
| Disadvantages | Refactor |
| Complexity / perf | M / Low |
| Works with | SYS-03a, SYS-03b, SYS-04 |
| Fits identities | A |

### SYS-03a · Scenario lab · core

**Current:** Possession & transition lab page.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Dev shell lab

| | |
|---|---|
| Visual concept | Same dev shell; canvas + run controls + snapshot list. |
| Layout | Canvas 9 + controls 3. |
| Information hierarchy | 1) Canvas. |
| Interactions | Run, step. |
| Navigation | From SYS-03. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Consistent |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-03 |
| Fits identities | A |

#### B — Tab in SYS-03

| | |
|---|---|
| Visual concept | Becomes a tab of the unified lab page. |
| Layout | Tab. |
| Information hierarchy | 1) Canvas. |
| Interactions | Run. |
| Navigation | SYS-03 B. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Less routing |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-03 |
| Fits identities | A |

### SYS-03b · Scenario lab · match

**Current:** Full-match human QA timeline lab with scrub.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Timeline-first lab

| | |
|---|---|
| Visual concept | Event timeline full width with scrubber; court canvas synced above. |
| Layout | Canvas 12 + timeline 12. |
| Information hierarchy | 1) Timeline position. |
| Interactions | Scrub, jump to event. |
| Navigation | From SYS-03. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Fast QA scanning |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-03, SYS-04 |
| Fits identities | A |

#### B — Tab in SYS-03

| | |
|---|---|
| Visual concept | Becomes a tab of the unified lab page. |
| Layout | Tab. |
| Information hierarchy | 1) Timeline. |
| Interactions | Scrub. |
| Navigation | SYS-03 B. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Less routing |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-03, SYS-04 |
| Fits identities | A |

### SYS-04 · Match 2D QA harness

**Current:** Court renderer with rows of hm-btn toggles (fatigue, 7-vs-6, presets, speed) using inline styles; outside /career with no gate.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P2 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Gated QA harness with control panel

| | |
|---|---|
| Visual concept | Gate; group toggles into a right control panel (Scenario, Toggles, Speed) with a DEV ribbon. |
| Layout | Court 9 + control panel 3. |
| Information hierarchy | 1) Court 2) controls. |
| Interactions | Play/pause, presets, toggles. |
| Navigation | From dev console. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Not public; Clearer controls |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-03, SYS-02e |
| Fits identities | A |

#### B — Merge into SYS-03 labs

| | |
|---|---|
| Visual concept | Becomes the "Match QA" tab of the unified labs page. |
| Layout | Tab. |
| Information hierarchy | 1) Court. |
| Interactions | Same. |
| Navigation | SYS-03 B. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | One lab home |
| Disadvantages | Different engine path may complicate |
| Complexity / perf | M / Low |
| Works with | SYS-03, SYS-02e |
| Fits identities | A |

### SYS-05 · CPU-rekrytering (debug)

**Current:** Three hm-panels with tables (Positionsbehov, Aktiva/senaste pursuits, Beslutslogg) under the player-facing /career/club route without a gate; URL-only.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P2 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — Move under dev gate

| | |
|---|---|
| Visual concept | Relocate to the dev console with the career context selector; same three tables in dev theme. |
| Layout | 3 stacked tables. |
| Information hierarchy | 1) Decision log. |
| Interactions | Filter by club. |
| Navigation | Dev console. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | Removes ungated debug from player route |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | CLB-02, CLB-04, SYS-06 |
| Fits identities | A |

#### B — Dev overlay on club pages

| | |
|---|---|
| Visual concept | Show the same data as a dev-only drawer on CLB-04 club pages when editor mode is on. |
| Layout | Drawer. |
| Information hierarchy | 1) Pursuits for this club. |
| Interactions | Toggle via SYS-06. |
| Navigation | From CLB-04 in editor mode. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | In context |
| Disadvantages | Mixes dev UI into player pages |
| Complexity / perf | M / Low |
| Works with | CLB-02, CLB-04, SYS-06 |
| Fits identities | A |

### SYS-06 · Editor mode widget (global)

**Current:** Small floating toggle + link to /editor, rendered only when /api/editor/status reports enabled; also adds an 'Editor' sidebar item.

**Recommendation:** A — Internal tool: keep it functional and clearly separated from the player product; the priority is gating and dev-only styling, not redesign.

**Priority:** P3 · **Dependencies:** Editor/lab env gate (HM_EDITOR_ENABLED pattern)

**Arena Nights (owner identity, 2026-11-13):** internal — Internal/dev tool: minimal Arena Nights tokens, hidden from players. Recommendation unchanged.

#### A — DEV ribbon toggle

| | |
|---|---|
| Visual concept | Replace floating widget and sidebar item with a single DEV ribbon in a screen corner (toggle editor mode, open dev console). |
| Layout | Corner ribbon. |
| Information hierarchy | Tertiary. |
| Interactions | Click ribbon menu. |
| Navigation | Links to SYS-02. |
| Desktop | Dense dev styling (monospace numbers, neutral grey), visible DEV badge. |
| Mobile | Not supported; show "desktop only" notice. |
| Advantages | No sidebar pollution; Clearly dev-only |
| Disadvantages |  |
| Complexity / perf | S / Low |
| Works with | SYS-02, ENT-08a, ENT-07 |
| Fits identities | A |

#### B — Palette commands

| | |
|---|---|
| Visual concept | No visible widget; dev actions appear in the ⌘K palette (">dev editor") only when enabled. |
| Layout | None. |
| Information hierarchy | Hidden. |
| Interactions | Palette. |
| Navigation | ENT-08a. |
| Desktop | Same as A within dev console frame. |
| Mobile | Not supported. |
| Advantages | Zero chrome |
| Disadvantages | Undiscoverable for new devs |
| Complexity / perf | S / Low |
| Works with | SYS-02, ENT-08a, ENT-07 |
| Fits identities | A |

