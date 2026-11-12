# Experience 2027 — UI inventory, part B

Scope: squad/players, staff, training & tactics, scouting/recruitment/transfers, competitions/statistics, matchday & live match, match report & analysis in `apps/game` (Next.js app router). Established from source on 2026-11-12 in worktree `experience-2027` (branch snapshot of main-line code); no old reports used. Machine-readable twin: `part-b.json` (131 surfaces).

ID scheme: SQD, STF, TRN, REC, CMP, MDY, ANL; pages numbered 01…, sub-surfaces lettered (a, b, …). Component paths are relative to `apps/game`. UI language in the app is Swedish; Swedish labels are quoted verbatim.

**Counts:** 131 surfaces — 27 page, 28 tab, 53 panel, 18 state, 1 drawer, 3 overlay, 1 modal. Per domain: SQD 31, STF 14, TRN 17, REC 22, CMP 12, MDY 23, ANL 12.

## Index

| ID | Name | Route | Kind | Importance |
|---|---|---|---|---|
| SQD-01 | Truppen & Omklädningsrummet (squad list) | `/career/squad` | page | core |
| SQD-01a | Tab "Översikt" | `/career/squad` | tab | core |
| SQD-01b | Tab "Prestation" | `/career/squad` | tab | frequent |
| SQD-01c | Tab "Fysisk status" | `/career/squad` | tab | frequent |
| SQD-01d | Tab "Kontrakt" | `/career/squad` | tab | occasional |
| SQD-01e | Selection aside "Spelardossier & jämförelse" | `/career/squad` | panel | occasional |
| SQD-01f | Panel "Truppens balans" (SquadDepth) | `/career/squad` | panel | frequent |
| SQD-01g | Empty filter state | `/career/squad` | state | rare |
| SQD-02 | Spelarprofil (player dossier) | `/career/squad/[playerId]` | page | core |
| SQD-02a | Tab "Profil & egenskaper" (overview) | `/career/squad/[playerId]` | tab | core |
| SQD-02b | Tab "Prestation & historik" | `/career/squad/[playerId]` | tab | frequent |
| SQD-02c | Tab "Egenskaper" | `/career/squad/[playerId]` | tab | frequent |
| SQD-02d | Tab "Utveckling" | `/career/squad/[playerId]` | tab | occasional |
| SQD-02e | Tab "Kontrakt" | `/career/squad/[playerId]` | tab | frequent |
| SQD-02f | Tab "Klubbhistorik" | `/career/squad/[playerId]` | tab | rare |
| SQD-02g | PlayerHero + PlayerActions | `/career/squad/[playerId]` | panel | core |
| SQD-02h | Panel "Tillstånd" (PlayerConditionPanel) | `/career/squad/[playerId]` | panel | frequent |
| SQD-02i | Panel "Spelaren som person" (PlayerDynamicsPanel) | `/career/squad/[playerId]` | panel | frequent |
| SQD-02j | Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel) | `/career/squad/[playerId]` | panel | core |
| SQD-02k | Panel "Förmåga & Positionskarta" (GameplayAbilityPanel) | `/career/squad/[playerId]` | panel | frequent |
| SQD-02l | Knowledge-gated panels (external players) | `/career/squad/[playerId]` | panel | frequent |
| SQD-02m | Panel "Scoutingrapport" (ScoutReportPanel) | `/career/squad/[playerId]` | panel | frequent |
| SQD-02n | Panel "Förläng kontrakt" (ContractRenewal) | `/career/squad/[playerId]` | panel | frequent |
| SQD-02o | Panel "Transferläge" (PlayerTransferCard) | `/career/squad/[playerId]` | panel | frequent |
| SQD-02p | Panel "Medicinskt" (MedicalPanel) | `/career/squad/[playerId]` | panel | occasional |
| SQD-02q | Loading / not-found states | `/career/squad/[playerId]` | state | rare |
| SQD-03 | Spelarsök (player market search) | `/career/players` | page | frequent |
| SQD-03a | Dossier aside "Spelardossier" | `/career/players` | panel | frequent |
| SQD-04 | Jämför spelare | `/career/compare?left=&right=` | page | occasional |
| SQD-05 | Kontrakt (contracts overview) | `/career/contracts` | page | frequent |
| SQD-05a | Panel "Ditt avtalsbeslut" | `/career/contracts` | panel | frequent |
| STF-01 | Personal – Organisation | `/career/staff` | page | occasional |
| STF-01a | Staff subnav (StaffNav) | `/career/staff*` | tab | occasional |
| STF-01b | Panel "Klubbens organisation" (OrganisationChart) | `/career/staff` | panel | occasional |
| STF-01c | Staff table + role counts | `/career/staff` | panel | occasional |
| STF-01d | Rail "Veckans tränaransvar" | `/career/staff` | panel | occasional |
| STF-02 | Personprofil (staff profile) | `/career/staff/[staffId]` | page | occasional |
| STF-02a | Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight) | `/career/staff/[staffId]` | panel | occasional |
| STF-02b | Panel "Värva / Förläng eller avsluta" (StaffDealPanel) | `/career/staff/[staffId]` | panel | occasional |
| STF-03 | Rekrytera personal | `/career/staff/recruitment[?view=vacancies\|negotiations][&role=]` | page | occasional |
| STF-03a | View "Vakanta tjänster" | `/career/staff/recruitment?view=vacancies` | tab | occasional |
| STF-03b | View "Förhandlingar" | `/career/staff/recruitment?view=negotiations` | tab | rare |
| STF-03c | Panel "Hitta rätt person" (StaffMarketBoard) | `/career/staff/recruitment` | panel | occasional |
| STF-03d | Legacy tables "Fria scouter" + "Rekrytering — Personal" | `/career/staff/recruitment` | panel | internal |
| STF-04 | Ansvarsfördelning (delegation) | `/career/staff/responsibilities` | page | occasional |
| TRN-01 | Träning & Återhämtning | `/career/training[?week=YYYY-MM-DD]` | page | core |
| TRN-01a | Panel "Assistentens träningsplan" (AssistantTrainingPanel) | `/career/training` | panel | frequent |
| TRN-01b | Panel "Veckoschema" (week planner) | `/career/training` | panel | core |
| TRN-01c | Panel "Spelarberedskap" | `/career/training` | panel | frequent |
| TRN-01d | Panel "Utveckling" | `/career/training` | panel | occasional |
| TRN-01e | TrainingFeedback block | `/career/training` | panel | occasional |
| TRN-01f | Loading state | `/career/training` | state | rare |
| TRN-02 | Matchplan & Taktiktavla 2.0 | `/career/tactics` | page | core |
| TRN-02a | Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup) | `/career/tactics` | state | occasional |
| TRN-02b | Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs) | `/career/tactics` | tab | core |
| TRN-02c | Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6) | `/career/tactics` | tab | frequent |
| TRN-02d | Mode "Byten & Diff" (TacticsDiffManager) | `/career/tactics` | tab | frequent |
| TRN-02e | Overlay mode selector "Taktikvisning" | `/career/tactics` | panel | frequent |
| TRN-02f | Rail "Så spelar vi" (CoachingChoices) | `/career/tactics` | panel | core |
| TRN-02g | Section "Fasta situationer · 7-meter" (SetPieceSection) | `/career/tactics` | panel | occasional |
| TRN-02h | Section "Ledarskap" (LeadershipSection) | `/career/tactics` | panel | occasional |
| TRN-02i | Roster "Matchtrupp · n spelare" / "Ej uttagna" | `/career/tactics` | panel | core |
| REC-01 | Scouting & Motståndaranalys | `/career/scouting[?target=playerId]` | page | frequent |
| REC-01a | ScoutingCentre ("Scoutingcentralen") | `/career/scouting` | panel | frequent |
| REC-01b | Panel "Dina scouter" | `/career/scouting` | panel | frequent |
| REC-01c | Panel "Ny bevakning" | `/career/scouting` | panel | frequent |
| REC-01d | Panel "Nytt bredare uppdrag" | `/career/scouting` | panel | occasional |
| REC-01e | Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag" | `/career/scouting` | panel | frequent |
| REC-01f | Panel "Upptäckta spelare" | `/career/scouting` | panel | frequent |
| REC-02 | Rekryteringscentrum | `/career/recruitment[?view=SHORTLIST]` | page | frequent |
| REC-02a | Candidate dossier | `/career/recruitment` | panel | frequent |
| REC-03 | Transfer Centre | `/career/transfers[?target=playerId]` | page | core |
| REC-03a | Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard) | `/career/transfers` | panel | frequent |
| REC-03b | Market tabs (Möjligheter / Hela marknaden / Bevakade) | `/career/transfers` | tab | core |
| REC-03c | Dossier aside (TransferDossier) | `/career/transfers` | drawer | frequent |
| REC-03d | Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer) | `/career/transfers` | panel | frequent |
| REC-04 | Förhandlingsrum (negotiation room) | `/career/transfers/[playerId][?deal=LOAN]` | page | core |
| REC-04a | Start decision "Inled förhandling" | `/career/transfers/[playerId]` | state | frequent |
| REC-04b | Decision form – club stage | `/career/transfers/[playerId]` | panel | core |
| REC-04c | Decision form – player stage | `/career/transfers/[playerId]` | panel | core |
| REC-04d | Waiting / closed status | `/career/transfers/[playerId]` | state | frequent |
| REC-04e | Deal completed (DealCompletion) | `/career/transfers/[playerId]` | overlay | occasional |
| REC-05 | Bud på din spelare (incoming offer) | `/career/transfers/offers/[offerId]` | page | frequent |
| REC-05a | Sold moment (MomentHero "Såld") | `/career/transfers/offers/[offerId]` | overlay | rare |
| CMP-01 | Tävlingar (competition workspace) | `/career/competitions[/competitionId][?tab=]` | page | frequent |
| CMP-01a | Tab "Tabell & form" | `/career/competitions/[competitionId]?tab=` | tab | core |
| CMP-01b | Tab "Matcher" | `/career/competitions/[competitionId]?tab=` | tab | frequent |
| CMP-01c | Tab "Resultat" | `/career/competitions/[competitionId]?tab=` | tab | frequent |
| CMP-01d | Tab "Spelarstatistik" | `/career/competitions/[competitionId]?tab=` | tab | occasional |
| CMP-01e | Tab "Klubbar" | `/career/competitions/[competitionId]?tab=` | tab | occasional |
| CMP-01f | Tab "Historik" | `/career/competitions/[competitionId]?tab=` | tab | rare |
| CMP-01g | Svenska Cupen variant (CupWorkspace) | `/career/competitions/se-svenska-cupen-herr` | state | occasional |
| CMP-01h | Non-simulated league / not found states | `/career/competitions/[competitionId]` | state | occasional |
| CMP-02 | Match (fixture page) | `/career/fixtures/[fixtureId]` | page | occasional |
| CMP-03 | Matcher (legacy redirect) | `/career/matches` | state | internal |
| CMP-04 | Statistik | `/career/statistics` | page | occasional |
| MDY-01 | Matchförhandsvisning (match preview / matchday gate) | `/career/match-preview` | page | core |
| MDY-01a | MatchdayStage ("Matchdagen") | `/career/match-preview` | panel | frequent |
| MDY-01b | Confirm dialog "Kontrollera matchtruppen" | `/career/match-preview` | modal | occasional |
| MDY-01c | Blocking / lineup error alerts | `/career/match-preview` | state | occasional |
| MDY-01d | OpponentScoutingPanel (compact) | `/career/match-preview` | panel | frequent |
| MDY-01e | Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare" | `/career/match-preview` | panel | core |
| MDY-01f | States: season complete / no fixture | `/career/match-preview` | state | rare |
| MDY-02 | Live match (Match Center) | `/career/match-day/[fixtureId][?finish=1]` | page | core |
| MDY-02a | Header / scoreboard & manpower | `/career/match-day/[fixtureId]` | panel | core |
| MDY-02b | Controls bar | `/career/match-day/[fixtureId]` | panel | core |
| MDY-02c | View "Översikt" | `/career/match-day/[fixtureId]` | tab | core |
| MDY-02d | View "Nyckelögonblick" | `/career/match-day/[fixtureId]` | tab | frequent |
| MDY-02e | View "Spelare" | `/career/match-day/[fixtureId]` | tab | frequent |
| MDY-02f | View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling) | `/career/match-day/[fixtureId]` | tab | frequent |
| MDY-02g | Coach aside "Dina matchbeslut" (LiveCoachPanel) | `/career/match-day/[fixtureId]` | panel | core |
| MDY-02h | TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout) | `/career/match-day/[fixtureId]` | overlay | frequent |
| MDY-02i | Half-time state | `/career/match-day/[fixtureId]` | state | frequent |
| MDY-02j | Full-time state | `/career/match-day/[fixtureId]` | state | core |
| MDY-02k | Assistant-in-control state | `/career/match-day/[fixtureId]` | state | rare |
| MDY-02l | Experimental 2D court (details) | `/career/match-day/[fixtureId]` | panel | occasional |
| MDY-02m | Quick finish / no session / archive fallback states | `/career/match-day/[fixtureId]` | state | occasional |
| MDY-03 | Match Center (legacy redirect) | `/career/match-center` | state | internal |
| MDY-04 | Matchrepriser (match-2d replays) | `/career/match-2d` | page | rare |
| ANL-01 | Matchrapport | `/career/match-report/[fixtureId]` | page | core |
| ANL-01a | Archived match center (4 views) | `/career/match-report/[fixtureId]` | panel | core |
| ANL-01b | MatchAftermathPanel ("Efter matchen") | `/career/match-report/[fixtureId]` | panel | frequent |
| ANL-01c | Details "Speltid och belastning" | `/career/match-report/[fixtureId]` | panel | frequent |
| ANL-01d | Legacy report variant (no archive) | `/career/match-report/[fixtureId]` | state | occasional |
| ANL-01e | Error / no report states | `/career/match-report/[fixtureId]` | state | rare |
| ANL-01f | PostMatchPressBanner | `/career/match-report/[fixtureId]` | panel | occasional |
| ANL-02 | Matchanalys – Översikt | `/career/analysis` | page | frequent |
| ANL-02a | Analysis tab bar (layout) | `/career/analysis/*` | tab | frequent |
| ANL-03 | Matchanalys – Motståndaren | `/career/analysis/opponent` | page | frequent |
| ANL-04 | Matchanalys – Vårt lag | `/career/analysis/our-team` | page | occasional |
| ANL-05 | Matchanalys – Senaste matchen | `/career/analysis/last-match` | page | occasional |

## Surfaces

### SQD — Squad & players (incl. compare, contracts)

#### SQD-01 · Truppen & Omklädningsrummet (squad list)

*Route:* `/career/squad` · *Kind:* page · *Importance:* core

*Components:* `app/career/squad/page.tsx`, `components/clubhq/EnvironmentBanner.tsx`, `components/game/Identity.tsx (SquadDepth, PlayerCell)`, `components/SortableTh.tsx`, `components/players/PlayerDynamicsPanel.tsx (MoraleBadge)`, `components/players/PlayerFormSparkline.tsx`, `components/game/squad-season.css`

**Purpose.** Primary roster workspace: review every own player's form, physical state, contract and squad role; set captain and squad-status tier; pick two players to compare.

**Current structure.** Photo EnvironmentBanner (dressing room) with 3 metric tiles (squad size, match fitness avg, captain) and 2 CTA buttons; SquadDepth strip (7 position cards); a hm-tabs row of 4 buttons; one Panel with filter bar and a horizontally scrolling hm-roster-table whose columns change per tab (Overview shows ~19 columns: checkbox, Nr, Spelare, Pos, Ålder, Moral, Trupproll, M, Starter, Mål, Skott%, Räddn%, Betyg, Form(5M), Energi, Matchträning, Tillgänglighet, Återkomst, Avtal till); duplicate position-chip row after the panel.

**Main actions**
- Switch view tab (Översikt / Prestation / Fysisk status / Kontrakt)
- Search by name
- Filter by position (select + 7 position chips below table)
- Filter by state (Tillgängliga / Otillgängliga / Energi under 75%)
- Toggle form mode (last 5 played vs last 5 fixtures incl. DNP)
- Sort 12 columns
- Change squad-role tier per row (inline select)
- Tick up to 2 players for compare/captaincy
- Appoint captain from selection aside
- Open player dossier
- Jump to Taktik / Kontrakt

**Strengths**
- Very data-rich, real handball stats (shot % / attempts, save % / faced) with tooltips explaining Matchträning vs Energi
- Per-workspace state memory (useWorkspaceState) keeps filters/sort/tab between visits
- Inline squad-role select makes promises/roles actionable without leaving the list
- Form sparkline + morale badge give at-a-glance signals
- Captain/vice/7m role pills inside the player cell

**Weaknesses**
- Overview tab is the union of Performance + Physical: ~19 columns, forcing horizontal scroll even on desktop
- Position filter duplicated (select in filter bar + chip row placed below the table, easy to miss)
- Compare and captaincy hidden behind a checkbox selection with max 2; captain can only be set from that aside (vice-captain/7m not editable here)
- Physical tab adds 3 columns only visible there (Belastning 7 d, Trend, Återhämtning) – workload story split across tabs
- No bulk actions, no saved views, no column chooser
- Tab buttons use aria-pressed instead of tablist semantics

**Links:** /career/tactics, /career/contracts, /career/compare?left&right, /career/squad/[playerId]

**Desktop:** Single column, full width; table relies on .hm-scroll-x horizontal scrolling. **Mobile:** No page-specific breakpoint for the roster table; squad-season.css has @media (max-width:800px/1250px) for depth/heading only – table becomes a sideways-scrolling 19-column grid.

**Redesign opportunities**
- Card/list hybrid with a player "chip" showing energy, fitness, morale and form as micro-visuals; columns become optional
- Positional depth chart (court-shaped) instead of a flat strip
- Saved views (e.g. "Matchday readiness", "Contract risk") replacing 4 hard tabs
- Multi-select tray with actions (compare, set roles, rest, list for transfer)

##### SQD-01a · Tab "Översikt"

*Route:* `/career/squad` · *Kind:* tab · *Importance:* core · *Parent:* SQD-01

*Components:* `app/career/squad/page.tsx`

**Purpose.** Default view combining performance, physical and contract-end columns.

**Current structure.** Roster table with performance + physical columns + Avtal till.

**Main actions**
- Sort
- Select
- Set squad role

**Strengths**
- One-glance health check

**Weaknesses**
- Widest table in the game; least scannable

**Links:** SQD-01

**Desktop:** Horizontal scroll at <1600px. **Mobile:** Horizontal scroll.

**Redesign opportunities**
- Make overview a curated 6–8 column summary with expandable rows

##### SQD-01b · Tab "Prestation"

*Route:* `/career/squad` · *Kind:* tab · *Importance:* frequent · *Parent:* SQD-01

*Components:* `app/career/squad/page.tsx`, `components/players/PlayerFormSparkline.tsx`, `lib/career/playerForm.ts`

**Purpose.** Season output per player.

**Current structure.** Columns M, Starter, Mål, Skott % / försök, Räddningar % / mötta, Betyg (1–10 avg), Form (5M) sparkline.

**Main actions**
- Sort by M, Starter, Mål, Betyg
- Toggle form mode

**Strengths**
- Shooting and save efficiency shown with sample size

**Weaknesses**
- Shot% and save% not sortable; no per-60 or per-match normalisation

**Links:** SQD-01

**Desktop:** Fits better than overview. **Mobile:** Scroll.

**Redesign opportunities**
- Small multiples / sparkline per metric; position-aware metric sets (GK vs outcourt)

##### SQD-01c · Tab "Fysisk status"

*Route:* `/career/squad` · *Kind:* tab · *Importance:* frequent · *Parent:* SQD-01

*Components:* `app/career/squad/page.tsx`, `lib/training/readinessSummary.ts`, `lib/players/matchFitness.ts`

**Purpose.** Readiness: energy, match fitness, 7-day load, load trend, recovery outlook, availability and return date.

**Current structure.** Columns Energi %, Matchträning %, Belastning 7 d, Trend (↑/→/↓), Återhämtning (God/Normal/Nedsatt, reasons in tooltip), Tillgänglighet badge, Återkomst date.

**Main actions**
- Sort by Energi / Belastning 7 d

**Strengths**
- Separates energy (day form) from match fitness (match sharpness)
- Reasons for recovery outlook available as tooltip

**Weaknesses**
- Readiness reasons hidden in title tooltips (not touch-accessible)
- No visual thresholds/trend lines; numbers only

**Links:** TRN-01, MDY-01

**Desktop:** OK. **Mobile:** Tooltips unusable on touch.

**Redesign opportunities**
- Readiness heat-strip per player (energy, fitness, load ratio) with explicit risk bands

##### SQD-01d · Tab "Kontrakt"

*Route:* `/career/squad` · *Kind:* tab · *Importance:* occasional · *Parent:* SQD-01

*Components:* `app/career/squad/page.tsx`

**Purpose.** Contract end and wage per player.

**Current structure.** Columns Avtal till, Lön / månad, Åtgärd link; drops Trupproll column.

**Main actions**
- Sort by Avtal till / Lön
- Link "Förläng / profil →"

**Strengths**
- Quick wage overview

**Weaknesses**
- Duplicates /career/contracts (SQD-05) with fewer features; link goes to profile, not to the renewal panel

**Links:** SQD-05, SQD-02e

**Desktop:** Narrow table. **Mobile:** OK.

**Redesign opportunities**
- Remove in favour of a single contracts surface or deep-link to renewal

##### SQD-01e · Selection aside "Spelardossier & jämförelse"

*Route:* `/career/squad` · *Kind:* panel · *Importance:* occasional · *Parent:* SQD-01

*Components:* `app/career/squad/page.tsx`

**Purpose.** Appears when 1–2 rows ticked: availability/energy/fitness line, captain button, dossier link, compare CTA in panel header.

**Current structure.** aria-live aside above the table listing chosen players with inline buttons.

**Main actions**
- Utse till kapten
- Spelardossier →
- Jämför valda spelare →
- Rensa val

**Strengths**
- aria-live announces selection

**Weaknesses**
- Mixes two unrelated jobs (compare vs captaincy)
- Compare CTA lives in panel header, far from the aside

**Links:** SQD-04, SQD-02

**Desktop:** Inline above table. **Mobile:** Wraps.

**Redesign opportunities**
- Floating selection tray with contextual actions

##### SQD-01f · Panel "Truppens balans" (SquadDepth)

*Route:* `/career/squad` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-01

*Components:* `components/game/Identity.tsx (SquadDepth)`

**Purpose.** Available/total per primary position (V6, V9, M9, M6, H9, H6, MV).

**Current structure.** Overline "SJU POSITIONER. ETT LAG." + 7 position cards.

**Main actions**
- None (read-only)

**Strengths**
- Handball-specific framing

**Weaknesses**
- Not clickable as a filter even though a separate chip row does exactly that
- Ignores secondary positions

**Links:** SQD-01

**Desktop:** Row of 7. **Mobile:** Wraps.

**Redesign opportunities**
- Court-shaped depth chart with secondary-position depth and click-to-filter

##### SQD-01g · Empty filter state

*Route:* `/career/squad` · *Kind:* state · *Importance:* rare · *Parent:* SQD-01

*Components:* `components/manager/Workspace.tsx (EmptyState)`

**Purpose.** "Inga spelare matchar dina filter." under an empty table.

**Current structure.** EmptyState text below table headers.

**Main actions**
- Rensa filter (in filter bar)

**Strengths**
- Clear filter reset exists

**Weaknesses**
- Reset button not repeated in the empty state

**Links:** SQD-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Empty state with one-click reset

#### SQD-02 · Spelarprofil (player dossier)

*Route:* `/career/squad/[playerId]` · *Kind:* page · *Importance:* core

*Components:* `app/career/squad/[playerId]/page.tsx`, `components/game/Identity.tsx (PlayerHero)`, `components/manager/PlayerActions.tsx`, `components/game/PlayerCondition.tsx`, `components/players/PlayerDynamicsPanel.tsx`, `components/GameplayProfilePanels.tsx`, `components/KnowledgeGatedProfilePanels.tsx`, `components/ScoutReportPanel.tsx`, `components/ContractRenewal.tsx`, `components/transfers/PlayerTransferCard.tsx`, `components/manager/PlayerPerformance.tsx`, `components/players/DevelopmentHistory.tsx`, `components/game/profile-world.css`

**Purpose.** Single dossier for ANY player (own, external, free agent, retired): identity, condition, morale/person management, ability/attributes (full for own, knowledge-gated for external), scouting report, contract, transfer status, medical, history.

**Current structure.** Photo PlayerHero (dressing-room backdrop) with back button; PlayerActions button row; own-player Tillstånd panel; hm-profile-tabs (6 buttons); body is hm-profile-split (main column + hm-world-rail) whose content is recomposed per tab from shared blocks (attributes, ability, contract, history, body, report, medical).

**Main actions**
- Back (context-aware: Trupp / Transfers / Klubb)
- Switch 6 tabs
- Jämför spelare
- Own: Matchtrupp & startsju / Kontraktsöversikt / Träning & belastning links
- External: Kortlista / Scouta spelare / Förhandla
- Answer player concerns, transfer requests, list/unlist, release (with confirm)
- Open renewal talks / submit renewal offer / withdraw
- Start scouting assignment
- Förhandla om övergång / Föreslå lån

**Strengths**
- Strong knowledge-gating model: external players never expose raw CA/PA or 1–20 grid; ranges and tiers instead
- Own players get a full 56 outcourt / 21 GK attribute grid with family radar
- Person-management (morale factors, promises, concerns as DecisionCards) lives where the player is
- Context-aware back button and own vs external action sets

**Weaknesses**
- Six tabs reuse the same blocks in different combinations (ability panel appears in 3 tabs, body profile in 3, medical in 2, PlayerPerformance in 2) – tabs feel redundant
- Tab "Profil & egenskaper" and tab "Egenskaper" overlap heavily
- Heavy inline styles (hex colours, px) instead of tokens in panels
- Stars-only CA/PA (1–5) for own players hides the meaningful 1–200 scale progression; development tab shows stars as text "★★★☆☆"
- Tab state is local useState (not in URL) – deep links like "open contract tab" impossible (other surfaces link only to the profile root)
- Fallback mock attribute set (Tekniska/Mentala/Fysiska) uses a different vocabulary than gameplay ratings

**Links:** /career/squad, /career/transfers, /career/clubs/[clubId], /career/compare, /career/tactics, /career/contracts, /career/training, /career/scouting?target, /career/transfers/[playerId], /career/transfers/offers/[offerId], /career/history?season

**Desktop:** Two-column split (main + rail ~340–420px; wider at ≥2100px). **Mobile:** profile-world.css: ≤1250px collapses to one column and rail becomes 2-col grid; ≤760px further stacking. Attribute grid uses auto-fill minmax(205px) so it reflows.

**Redesign opportunities**
- Collapse to 3–4 purposeful tabs (Overview, Attributes & development, Contract & transfer, History) with URL-addressable tabs
- Attribute visualisation with history deltas (development events carry previous→new values)
- Knowledge uncertainty as visual ranges (error bars) rather than text ranges
- Unified "person" timeline: morale factors, promises, talks, injuries, transfers

##### SQD-02a · Tab "Profil & egenskaper" (overview)

*Route:* `/career/squad/[playerId]` · *Kind:* tab · *Importance:* core · *Parent:* SQD-02

*Components:* `app/career/squad/[playerId]/page.tsx`

**Purpose.** Season-in-numbers strip, PlayerDynamicsPanel (own), attributes; rail with ability, scout report (external), medical and a "Din nästa bedömning" note.

**Current structure.** 4-stat strip (starts, shots/faced, efficiency/save%, goals/shots) + panels.

**Main actions**
- Visa kontrakt / Visa prestation shortcuts

**Strengths**
- Position-aware stat strip (GK vs outcourt)

**Weaknesses**
- Very long scroll for own players: dynamics + full 56-attribute grid

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Summary hero with key ratings; push detailed grids to Attributes tab

##### SQD-02b · Tab "Prestation & historik"

*Route:* `/career/squad/[playerId]` · *Kind:* tab · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/manager/PlayerPerformance.tsx`

**Purpose.** Season performance strip, last 12 matches table (Datum, Match, Resultat, Start, Min, Mål/skott, Räddningar, Betyg) and season history table.

**Current structure.** Three Panels stacked.

**Main actions**
- Open club / history season links

**Strengths**
- Match-by-match log with rating

**Weaknesses**
- No charts; same component reused in "Klubbhistorik" tab

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Rating/goal trend chart; per-match drill to match report

##### SQD-02c · Tab "Egenskaper"

*Route:* `/career/squad/[playerId]` · *Kind:* tab · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/GameplayProfilePanels.tsx`, `components/KnowledgeGatedProfilePanels.tsx`

**Purpose.** Attribute grid in main column; rail with ability, body profile and scout report.

**Current structure.** GameplayAttributesPanel + rail.

**Main actions**
- Read

**Strengths**
- Dedicated attributes view

**Weaknesses**
- Near-duplicate of overview tab

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Merge with overview or turn into a comparison-ready attribute workspace

##### SQD-02d · Tab "Utveckling"

*Route:* `/career/squad/[playerId]` · *Kind:* tab · *Importance:* occasional · *Parent:* SQD-02

*Components:* `app/career/squad/[playerId]/page.tsx (DevelopmentPanel)`, `components/players/DevelopmentHistory.tsx`

**Purpose.** Own: current level & potential stars, individual focus label, last 5 development events. External: explanatory note only.

**Current structure.** Key-value rows + event list; body profile; rail ability + medical.

**Main actions**
- None (focus is changed only on /career/training)

**Strengths**
- Shows concrete attribute changes

**Weaknesses**
- Read-only: individual focus cannot be changed here (lives on Training)
- Star text strings instead of a progression visual

**Links:** TRN-01d

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Development curve (CA over time vs PA band), editable focus in place

##### SQD-02e · Tab "Kontrakt"

*Route:* `/career/squad/[playerId]` · *Kind:* tab · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/ContractRenewal.tsx`, `components/transfers/PlayerTransferCard.tsx`

**Purpose.** Contract panel (owning club, wage, end, shirt no.) + renewal flow, transfer status card, market value (exact for own, range for external); rail club history & training compensation.

**Current structure.** Stacked panels.

**Main actions**
- Inled förlängningssamtal
- Förläng kontrakt
- Dra dig ur
- Förhandla om övergång
- Föreslå lån

**Strengths**
- Renewal shows demand factors with ±% chips and expected role

**Weaknesses**
- Market value and contract split across 3 panels; no wage-budget context inline

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Contract "deal sheet" with budget impact bar and demand breakdown chart

##### SQD-02f · Tab "Klubbhistorik"

*Route:* `/career/squad/[playerId]` · *Kind:* tab · *Importance:* rare · *Parent:* SQD-02

*Components:* `app/career/squad/[playerId]/page.tsx`, `components/manager/PlayerPerformance.tsx`

**Purpose.** Club history entries (age ranges), training compensation breakdown, then PlayerPerformance again; rail body profile.

**Current structure.** Panels.

**Main actions**
- Read

**Strengths**
- Training compensation explained separately from market value

**Weaknesses**
- Repeats performance tab content

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Career timeline visual

##### SQD-02g · PlayerHero + PlayerActions

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* core · *Parent:* SQD-02

*Components:* `components/game/Identity.tsx (PlayerHero)`, `components/manager/PlayerActions.tsx`

**Purpose.** Identity header (name, number, position, age, nation, club colours, status, squad tier, captain/7m) + contextual action buttons.

**Current structure.** Photo hero band followed by a row of small buttons.

**Main actions**
- Back
- Jämför
- Kortlista
- Scouta
- Förhandla
- Own-player links

**Strengths**
- Club-colour theming

**Weaknesses**
- Action row is a flat list of 3–4 equal-weight buttons; primary action unclear for own players

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Sticky compact hero with one primary contextual CTA

##### SQD-02h · Panel "Tillstånd" (PlayerConditionPanel)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/game/PlayerCondition.tsx`

**Purpose.** Own players: availability chip, selectable state, injury & rehab, return date, match-fitness band, two <meter> bars (Energi, Matchträning).

**Current structure.** Definition list + meters.

**Main actions**
- Read

**Strengths**
- Explains "rested but injured" edge case

**Weaknesses**
- Native <meter> styling inconsistent across browsers

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Condition gauge set shared with squad and matchday

##### SQD-02i · Panel "Spelaren som person" (PlayerDynamicsPanel)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/players/PlayerDynamicsPanel.tsx`, `components/experience (DecisionCard, EventCard, MeterBar)`

**Purpose.** Morale meter (0–100, target), morale factor chips, intention summary, pre-contract warning, player concerns with option buttons, transfer request DecisionCard (accept/promise/refuse), promises list, incoming bids, transfer-list and release actions with inline confirm.

**Current structure.** pd-panel section with header meter and stacked decision cards.

**Main actions**
- Answer concern option
- Godkänn/Övertala/Avslå transfer request
- Öppna budet
- Transferlista / Ta bort
- Bryt avtalet… → Bekräfta

**Strengths**
- Consequences shown on every option
- Morale impact capped and explained (±3 %)

**Weaknesses**
- Destructive "Bryt avtalet" is a small button next to transfer listing
- Status messages rendered as plain text line

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Person timeline + mood chart; separate danger zone

##### SQD-02j · Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* core · *Parent:* SQD-02

*Components:* `components/GameplayProfilePanels.tsx`, `lib/rating/types.ts`, `lib/rating/attributeVocabulary.ts`

**Purpose.** Own players: radar of 6 outcourt families (Teknik, Perception/beslut, Taktik, Försvar, Fysik, Mental) or 4 GK families, family averages with bars, then every attribute (56 outcourt / 21 GK) with a tier-coloured bar and value; dots mark evidence-backed/editor values.

**Current structure.** Dark gradient header strip (160px radar + family tiles) then FamilyBlocks in auto-fill grid.

**Main actions**
- Read (hover tooltip for origin)

**Strengths**
- Complete, well-grouped attribute model; radar gives shape at a glance

**Weaknesses**
- Hard-coded hex colours/gradients; tier colours (≥15 green, ≥12 blue, ≥9 grey, else amber) not tokenised
- No comparison/delta, no position-weighting highlight

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Role-weighted highlights, deltas since last month, compare overlay

##### SQD-02k · Panel "Förmåga & Positionskarta" (GameplayAbilityPanel)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/GameplayProfilePanels.tsx`, `lib/rating/presentation.ts`

**Purpose.** CA/PA as 1–5 stars, mini-court with 7 position spots (primary highlighted), attack and defence role proficiencies as text.

**Current structure.** Stars rows + SVG mini court + role rows.

**Main actions**
- Read

**Strengths**
- Handball court metaphor

**Weaknesses**
- Only primary position lit; secondary positions and proficiency levels not visualised

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Position suitability heat on court (primary/secondary/role proficiency)

##### SQD-02l · Knowledge-gated panels (external players)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/KnowledgeGatedProfilePanels.tsx`, `lib/knowledge/careerVisibility.ts`, `lib/knowledge/types.ts`

**Purpose.** External players: ability/potential as star ranges (e.g. "2–4 ★") with knowledge tier badge (Mycket begränsad / Begränsad / Måttlig / God kännedom); attributes reduced to strengths/weaknesses lists.

**Current structure.** Two panels replacing ability and attribute panels.

**Main actions**
- Read

**Strengths**
- Honest uncertainty model

**Weaknesses**
- Text-only; uncertainty not visual
- Low-knowledge message offers no direct "scout now" button in this panel

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Range bars that tighten as knowledge grows; inline scout CTA

##### SQD-02m · Panel "Scoutingrapport" (ScoutReportPanel)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/ScoutReportPanel.tsx`, `lib/knowledge/scoutReportVisibility.ts`

**Purpose.** Estimated market value range, scout confidence %, recommendation text, strengths/weaknesses, report history (scout + date), "Scouta spelare" CTA or no-scout notice.

**Current structure.** Panel with stamp ("Rapport tillgänglig"/"Första observation").

**Main actions**
- Scouta spelare → /career/scouting?target

**Strengths**
- Report metaphor with stamp and history

**Weaknesses**
- Only latest report shown; no diff between reports

**Links:** SQD-02, REC-01

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Report timeline showing how ranges narrowed

##### SQD-02n · Panel "Förläng kontrakt" (ContractRenewal)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/ContractRenewal.tsx`, `components/MoneyInput.tsx`

**Purpose.** Renewal state machine: intention summary, blocker note, open talks, demand vs current wage, expected role, demand factors (±%), last response quote, waiting state with answer date, offer form (1–4 years, wage, optional role promise), signing MomentHero after agreement.

**Current structure.** pd-renewal block inside contract panel (also embedded on /career/contracts).

**Main actions**
- Inled förlängningssamtal
- Förläng kontrakt
- Dra dig ur

**Strengths**
- Asynchronous negotiation made explicit (answer next day)

**Weaknesses**
- Feedback via a plain status line; no budget impact shown

**Links:** SQD-02e, SQD-05a

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Show payroll/budget delta and acceptance likelihood

##### SQD-02o · Panel "Transferläge" (PlayerTransferCard)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-02

*Components:* `components/transfers/PlayerTransferCard.tsx`

**Purpose.** Ownership vs playing club chips, loan progress line, contract facts, competing interest, promise kept/broken, negotiation CTA with deadline clock.

**Current structure.** tc-panel card.

**Main actions**
- Förhandla om övergång / Ditt drag
- Föreslå lån

**Strengths**
- Loan progress bar and deadline urgency

**Weaknesses**
- Uses Transfer Centre visual skin (tc-*) inside profile skin – visual mismatch

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Unified card system

##### SQD-02p · Panel "Medicinskt" (MedicalPanel)

*Route:* `/career/squad/[playerId]` · *Kind:* panel · *Importance:* occasional · *Parent:* SQD-02

*Components:* `app/career/squad/[playerId]/page.tsx (MedicalPanel)`, `lib/medical/labels.ts`

**Purpose.** Availability, active injury type/severity/rehab phase/return date/rehab %, last 5 injuries.

**Current structure.** Key-value rows.

**Main actions**
- Read

**Strengths**
- Complete injury facts

**Weaknesses**
- Duplicates Tillstånd panel facts for own players; no link to /career/medical

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Body map / rehab timeline

##### SQD-02q · Loading / not-found states

*Route:* `/career/squad/[playerId]` · *Kind:* state · *Importance:* rare · *Parent:* SQD-02

*Components:* `app/career/squad/[playerId]/page.tsx`

**Purpose.** "Läser in spelarbetyg…" while real-world ratings fetch from /api/game-world/gameplay-ratings; "Spelaren hittades inte." when id unknown.

**Current structure.** Plain muted panel text.

**Main actions**
- None

**Strengths**
- Honest fallback (null rating → mock display)

**Weaknesses**
- No skeleton; not-found has no way back

**Links:** SQD-02

**Desktop:** Inside profile split layout. **Mobile:** Stacks under ≤1250px.

**Redesign opportunities**
- Skeleton states; not-found with search/back

#### SQD-03 · Spelarsök (player market search)

*Route:* `/career/players` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/players/page.tsx`, `components/game/RecruitmentPresentation.tsx (KnowledgeMeter, RecruitmentTag)`, `components/game/Identity.tsx`, `components/game/recruitment-news.css`

**Purpose.** Search every non-own, non-retired player in the world; shortlist; open dossier/scouting/transfer.

**Current structure.** PageHeading + "game-market-stage" band with 3 counters (players on market, shortlist, scouts); two-column layout: results Panel (6-filter bar, 9-column table, pager) + sticky "Spelardossier" aside with PlayerHero, KnowledgeMeter, facts and 3 CTAs.

**Main actions**
- Search name/club
- Filter position, max age, nationality, competition, contract (expiring / free agents)
- Sort Spelare/Ålder/Kännedom/Avtal/Mål
- Paginate (60 per page)
- + Kortlista toggle
- Visa (select into dossier)
- Jämför
- Open profile / Scouta / Öppna bud & budget

**Strengths**
- Master-detail layout with persistent dossier
- Knowledge meter per row communicates uncertainty
- Recruitment status tag per row

**Weaknesses**
- No ability/potential/value column – the only sortable quality signal is goals
- Overlaps heavily with Transfer Centre "Hela marknaden" and Recruitment Centre lists (3 player-market tables)
- Pagination instead of virtualised list
- Default selection silently picks first row of page

**Links:** /career/recruitment?view=SHORTLIST, /career/squad/[id], /career/scouting?target, /career/transfers?target, /career/compare?left

**Desktop:** Grid minmax(0,1fr) + 425px dossier at ≥2200px, 320px at ≤1200px. **Mobile:** ≤900px: single column (dossier below results).

**Redesign opportunities**
- Merge into one Market workspace with Recruitment/Transfers
- Show knowledge-gated ability range as a visual band column
- Saved searches and need-based presets

##### SQD-03a · Dossier aside "Spelardossier"

*Route:* `/career/players` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-03

*Components:* `app/career/players/page.tsx`, `components/game/Identity.tsx (PlayerHero)`

**Purpose.** Selected player preview.

**Current structure.** Heading + tag, PlayerHero, knowledge meter, 3 facts, 3 buttons.

**Main actions**
- Öppna spelarprofil
- Scouta spelare
- Öppna bud & budget

**Strengths**
- Fast triage without page change

**Weaknesses**
- Shows no ability information even when known

**Links:** SQD-02, REC-01, REC-03

**Desktop:** Right rail. **Mobile:** Below table.

**Redesign opportunities**
- Mini scout report in dossier

#### SQD-04 · Jämför spelare

*Route:* `/career/compare?left=&right=` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/compare/page.tsx`, `components/manager/PlayerActions.tsx`, `lib/knowledge/careerVisibility.ts`

**Purpose.** Side-by-side comparison of two players (own or external) with role-relevant attributes.

**Current structure.** Two selects; Panel "Profil & prestation" (15-row comparison table: klubb, position, ålder, kännedom, bedömd nivå range, styrkor, utvecklingsområden, matcher/starter, mål/skott, skotteffektivitet, räddningar, snittbetyg, energi, avtal, lön); Panel "Egenskaper för <pos>" with 6 position-relevant 1–20 attributes (own players only); action rows; empty state if B missing.

**Main actions**
- Pick Spelare A / B from grouped selects (Din trupp / Övriga världen)
- Open player/club
- PlayerActions per side

**Strengths**
- URL-addressable selection
- Respects knowledge gating
- Position-relevant attribute subsets (RELEVANT map)

**Weaknesses**
- Select lists contain every player in the world (thousands) with no search
- No visual diff (bars/radar overlay), no winner highlighting
- External attributes blank in the attribute table

**Links:** /career/players, SQD-02

**Desktop:** Two-column table. **Mobile:** Table remains; selects wrap.

**Redesign opportunities**
- Searchable picker, radar overlay, delta bars, "compare against squad average"

#### SQD-05 · Kontrakt (contracts overview)

*Route:* `/career/contracts` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/contracts/page.tsx`, `components/ContractRenewal.tsx`, `lib/career/management.ts (contractRows)`

**Purpose.** Plan renewals: who expires, days left, wages, payroll; open renewal for a player.

**Current structure.** PageHeading + 4-cell summary (expiring ≤1y, ≤180d, monthly payroll, link to squad); two-column hm-contract-layout: "Avtalsöversikt" 7-column table (Spelare, Pos, Avtal till, Dagar kvar countdown, Lön, Status badge, Åtgärd) + decision panel (ContractRenewal) or prompt "Vem bygger du vidare med?".

**Main actions**
- Toggle "Utgående inom ett år"
- Förhandla (select row)
- Hitta ersättare →
- Jämför alternativ →

**Strengths**
- Countdown urgency (≤180 days highlighted)
- Renewal embedded beside the list (master-detail)

**Weaknesses**
- No sorting (header "Avtal till ↑" is static text)
- No wage budget headroom shown although renewal depends on it
- Staff contracts not included

**Links:** /career/players, /career/squad, /career/compare?left

**Desktop:** Two columns. **Mobile:** squad-season.css collapses hm-contract-layout (1.9fr + 280px) to one column at the max-width:1250px breakpoint; renewal panel then sits below a scrolling 7-column table.

**Redesign opportunities**
- Contract timeline (Gantt of contract ends vs season boundaries)
- Payroll vs budget bar with projected renewals

##### SQD-05a · Panel "Ditt avtalsbeslut"

*Route:* `/career/contracts` · *Kind:* panel · *Importance:* frequent · *Parent:* SQD-05

*Components:* `components/ContractRenewal.tsx`

**Purpose.** Embedded renewal flow for selected row.

**Current structure.** Player cell + days left + explanatory paragraph + ContractRenewal.

**Main actions**
- Same as SQD-02n

**Strengths**
- Keeps context

**Weaknesses**
- Selection kept in workspace memory; stale selection persists across visits

**Links:** SQD-02n

**Desktop:** Right column. **Mobile:** Stacked.

**Redesign opportunities**
- Side drawer

### STF — Staff

#### STF-01 · Personal – Organisation

*Route:* `/career/staff` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/staff/page.tsx`, `components/staff/StaffNav.tsx`, `components/staff/OrganisationChart.tsx`, `components/game/Secondary.tsx (SectionScene)`, `components/staff/staff.css`

**Purpose.** See the club organisation (departments, positions, holders, vacancies, costs vs board limit), staff list with role suitability and this week's coaching responsibilities.

**Current structure.** SectionScene header with crest; hm-subnav with badges; OrganisationChart band (cost MeterBar, 3 stats, "Behov just nu" list, 5 department columns of position cards, collapsible responsibilities); split: role-count grid + 4-column staff table; rail with weekly coach responsibilities and a note.

**Main actions**
- Navigate staff subnav (Organisation / Vakanser / Rekryteringsmarknad / Förhandlingar / Ansvarsområden)
- Open staff profile
- Rekrytera (vacancy) / Förläng (expiring)
- Sort staff table (Namn, Roll, Lämplighet)
- Open Träningsvecka / Scouting

**Strengths**
- Org chart by department with filled/covered/vacant/combined states
- Staff cost vs board limit meter
- Needs list surfaces vacancies and expiring contracts

**Weaknesses**
- Three overlapping representations of the same staff (org chart cards, role-count grid, staff table)
- Suitability shown as 1–5 stars everywhere except scouting page (x/20)
- "Relevanta egenskaper" column is a text list of attribute names, not values

**Links:** /career/staff/recruitment, /career/staff/[staffId], /career/staff/responsibilities, /career/training, /career/scouting, /career/manager

**Desktop:** Departments 5 columns → 3 at ≤1280px. **Mobile:** ≤900px departments and band to 1 column; ≤600px stats to 1 column.

**Redesign opportunities**
- Single interactive org chart as the page; table as optional view
- Coaching-quality impact visual (staff → training quality per session type)

##### STF-01a · Staff subnav (StaffNav)

*Route:* `/career/staff*` · *Kind:* tab · *Importance:* occasional · *Parent:* STF-01

*Components:* `components/staff/StaffNav.tsx`

**Purpose.** Five-item sub-navigation shared by staff pages with vacancy and open-negotiation badges.

**Current structure.** hm-subnav links; Vakanser/Förhandlingar are query views of /career/staff/recruitment.

**Main actions**
- Navigate

**Strengths**
- Badges show pending work

**Weaknesses**
- Mixes routes and ?view= query states; Rekryteringsmarknad and Vakanser render on the same page with stacked legacy content

**Links:** STF-03a, STF-03b, STF-04

**Desktop:** Row. **Mobile:** Wraps.

**Redesign opportunities**
- Consistent tab model

##### STF-01b · Panel "Klubbens organisation" (OrganisationChart)

*Route:* `/career/staff` · *Kind:* panel · *Importance:* occasional · *Parent:* STF-01

*Components:* `components/staff/OrganisationChart.tsx`, `lib/staff/organisation*`

**Purpose.** Departments (Ledning, Tränare, Rekrytering, Akademi, Stöd), positions, board members, costs, needs.

**Current structure.** xp-band header with meter + stats, needs list, st-depts grid, details/summary.

**Main actions**
- Rekrytera →
- Förläng →
- Ansvarsfördelning →

**Strengths**
- Clear vacancy affordance per slot

**Weaknesses**
- Dense small text; wage/contract info per card

**Links:** STF-03, STF-02, STF-04

**Desktop:** 5 cols. **Mobile:** 1 col.

**Redesign opportunities**
- Visual tree with health colours

##### STF-01c · Staff table + role counts

*Route:* `/career/staff` · *Kind:* panel · *Importance:* occasional · *Parent:* STF-01

*Components:* `app/career/staff/page.tsx`, `components/StarRating.tsx`

**Purpose.** Role counts per STAFF_ROLE and sortable table (Namn, Roll, Relevanta egenskaper, Lämplighet stars).

**Current structure.** Two Panels.

**Main actions**
- Sort
- Open profile

**Strengths**
- Sortable by suitability

**Weaknesses**
- Redundant with org chart

**Links:** STF-02

**Desktop:** - **Mobile:** Scroll.

**Redesign opportunities**
- Remove or turn into compact list view

##### STF-01d · Rail "Veckans tränaransvar"

*Route:* `/career/staff` · *Kind:* panel · *Importance:* occasional · *Parent:* STF-01

*Components:* `app/career/staff/page.tsx`, `lib/training (resolveResponsibleCoach)`

**Purpose.** Which coach leads each session this week.

**Current structure.** List by date.

**Main actions**
- Open coach
- Träningsvecka →

**Strengths**
- Connects staff to training

**Weaknesses**
- No session type shown here (only coach + date)

**Links:** TRN-01

**Desktop:** Rail. **Mobile:** Stacked.

**Redesign opportunities**
- Mini week grid

#### STF-02 · Personprofil (staff profile)

*Route:* `/career/staff/[staffId]` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/staff/[staffId]/page.tsx`, `components/staff/StaffInsight.tsx (RoleFit, StaffAttributes, StaffImpact)`, `components/staff/StaffDealPanel.tsx`, `components/experience (MeterBar)`

**Purpose.** Assess a staff member (own, other club, free agent): role fit, attributes (ranges when knowledge <90%), ambition, employment, impact, hire/renew/dismiss, this week's responsibilities.

**Current structure.** SectionScene (role eyebrow, name, StaffMark) + main column (Lämplighet RoleFit, StaffAttributes with compare-to-current-holder, club history) + rail (Anställning, Karriärambition & roll with knowledge meter, StaffImpact, StaffDealPanel, Aktuellt träningsansvar).

**Main actions**
- Back (context: recruitment/staff/club)
- Ta referenser (research)
- Lägg bud på ersättning (club stage)
- Erbjud kontrakt / Erbjud förlängning (role, years, wage, responsibility scope, signing bonus, promise)
- Dra dig ur
- Säg upp… → Bekräfta uppsägning

**Strengths**
- Knowledge-gated staff attributes with range display and "take references" action
- Comparison against current role holder
- Deal panel shows budget guardrails (cash, staff limit, projected cost, over-budget warnings)
- ProgressSteps for negotiation stage

**Weaknesses**
- Ambition panel is styled with inline rgba/hex values; mixed dark-on-light panels
- Deal form has 6 fields with no preview of acceptance
- Not-found state is a bare text panel

**Links:** /career/staff, /career/staff/recruitment, /career/clubs/[clubId], /career/training

**Desktop:** Main + rail. **Mobile:** staff.css ≤600px fit rows stack.

**Redesign opportunities**
- Staff "card" with role-fit radar and delta vs holder
- Negotiation stepper consistent with player negotiation room

##### STF-02a · Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight)

*Route:* `/career/staff/[staffId]` · *Kind:* panel · *Importance:* occasional · *Parent:* STF-02

*Components:* `components/staff/StaffInsight.tsx`, `lib/staff/labels.ts`, `lib/staff/presentation.ts`

**Purpose.** Role suitability per role (1–20 → 1–5 stars, verbal label) and role-relevant staff attributes, with ranges under uncertainty.

**Current structure.** si-panel fit rows + attribute list.

**Main actions**
- Read

**Strengths**
- Source note (real identity vs generated)

**Weaknesses**
- Stars hide the 1–20 resolution

**Links:** STF-02

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Range bars

##### STF-02b · Panel "Värva / Förläng eller avsluta" (StaffDealPanel)

*Route:* `/career/staff/[staffId]` · *Kind:* panel · *Importance:* occasional · *Parent:* STF-02

*Components:* `components/staff/StaffDealPanel.tsx`, `components/MoneyInput.tsx`

**Purpose.** HIRE or OWN deal flow with financial overview and dismissal DecisionCard.

**Current structure.** st-deal section: stepper, 6-cell finance grid with warnings, form, status notes, DecisionCard.

**Main actions**
- Ta referenser
- Lägg bud på ersättning
- Erbjud kontrakt
- Erbjud förlängning
- Dra dig ur
- Säg upp… / Bekräfta uppsägning / Behåll

**Strengths**
- Budget consequences explicit

**Weaknesses**
- Dismissal confirm inline (no modal) under the hire form

**Links:** STF-02

**Desktop:** Rail. **Mobile:** Stacked.

**Redesign opportunities**
- Shared negotiation component with REC-04

#### STF-03 · Rekrytera personal

*Route:* `/career/staff/recruitment[?view=vacancies|negotiations][&role=]` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/staff/recruitment/page.tsx`, `components/staff/StaffNav.tsx (StaffRecruitmentView)`, `components/staff/StaffMarketBoard.tsx`

**Purpose.** Find staff candidates (free agents + employed) across every role; view vacancies and staff negotiations.

**Current structure.** SectionScene with counters; StaffNav; optional vacancies/negotiations list section; StaffMarketBoard (8-column table: Namn, Roll, Tillgänglighet, Bedömd lämplighet stars with "?" when knowledge<60, Mot i dag delta, Ambition, Förväntad lön, Kännedom %); then a legacy split with "Fria scouter" table rail and "Rekrytering — Personal" 5-column table with role chips.

**Main actions**
- Filter role / availability / name (market board)
- Sort columns
- Open candidate profile
- Visa kandidater (vacancy)
- Legacy role chip filter

**Strengths**
- StaffMarketBoard compares candidate to current holder ("Mot i dag")
- ?role= deep link pre-filters market board

**Weaknesses**
- Two market tables on one page (new StaffMarketBoard + legacy table + free scout table) – duplicated and contradictory filters (?role= only applies to the board)
- Legacy role chips use inline accent styling
- Vacancies/negotiations views stack above the full market instead of replacing it

**Links:** /career/staff, /career/staff/[staffId]?from=recruitment, /career/scouting

**Desktop:** Board full width, legacy split below. **Mobile:** Tables scroll.

**Redesign opportunities**
- One staff market with saved role filters; vacancies as entry cards

##### STF-03a · View "Vakanta tjänster"

*Route:* `/career/staff/recruitment?view=vacancies` · *Kind:* tab · *Importance:* occasional · *Parent:* STF-03

*Components:* `components/staff/StaffNav.tsx`

**Purpose.** List vacant roles with "Visa kandidater →".

**Current structure.** hm-plan-section link list.

**Main actions**
- Visa kandidater

**Strengths**
- Direct path to candidates

**Weaknesses**
- Empty state "Alla tjänster är tillsatta." only

**Links:** STF-03c

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Vacancy cards with impact of filling

##### STF-03b · View "Förhandlingar"

*Route:* `/career/staff/recruitment?view=negotiations` · *Kind:* tab · *Importance:* rare · *Parent:* STF-03

*Components:* `components/staff/StaffNav.tsx`

**Purpose.** Last 20 staff negotiations (hire/renewal) with stage.

**Current structure.** Link list.

**Main actions**
- Open profile

**Strengths**
- Single history list

**Weaknesses**
- Answers arrive in inbox, not here; no CTA to respond

**Links:** STF-02

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Negotiation board shared with player transfers

##### STF-03c · Panel "Hitta rätt person" (StaffMarketBoard)

*Route:* `/career/staff/recruitment` · *Kind:* panel · *Importance:* occasional · *Parent:* STF-03

*Components:* `components/staff/StaffMarketBoard.tsx`

**Purpose.** Primary staff market table.

**Current structure.** Header with 3 filters + 8-column sortable table.

**Main actions**
- Filter
- Sort
- Open

**Strengths**
- Uncertainty marker

**Weaknesses**
- See STF-03

**Links:** STF-02

**Desktop:** - **Mobile:** Scroll.


##### STF-03d · Legacy tables "Fria scouter" + "Rekrytering — Personal"

*Route:* `/career/staff/recruitment` · *Kind:* panel · *Importance:* internal · *Parent:* STF-03

*Components:* `app/career/staff/recruitment/page.tsx`

**Purpose.** Older candidate tables still rendered below the board.

**Current structure.** Rail table + main table.

**Main actions**
- Role chips
- Sort

**Strengths**
- -

**Weaknesses**
- Redundant; candidate to remove

**Links:** STF-03c

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Remove

#### STF-04 · Ansvarsfördelning (delegation)

*Route:* `/career/staff/responsibilities` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/staff/responsibilities/page.tsx`, `lib/staff delegation (RESPONSIBILITY_AREAS, setDelegation, approveProposal)`, `components/experience (DecisionCard)`

**Purpose.** Decide per responsibility area whether the manager does it, staff advises, or staff acts (Du själv / Råd först / Delegera); approve/reject staff proposals; read staff activity log.

**Current structure.** PageHeading + StaffNav; dg-panel "Vem gör vad" 5-column matrix (Område, Rollen som äger det, Ansvarig + stars, Läge segmented radios, Vad det innebär); dg-panel "Förslag från staben" DecisionCards + decided list; dg-panel "Vad staben har gjort" log (≤25).

**Main actions**
- Set mode per area (radiogroup)
- Godkänn / Avslå proposals
- Granska träningsplan
- Titta på spelaren först
- Open responsible staff

**Strengths**
- Clear delegation model with explained scope per area
- Proposals carry consequence text

**Weaknesses**
- Training-plan proposals cannot be approved here (button disabled, redirect)
- Log is a long ordered list without filters

**Links:** /career/staff, /career/training, /career/transfers/[playerId]

**Desktop:** Stacked panels. **Mobile:** Matrix in hm-scroll-x.

**Redesign opportunities**
- Delegation as toggles on each domain page (contextual) + central inbox of proposals

### TRN — Training & tactics / match plan

#### TRN-01 · Träning & Återhämtning

*Route:* `/career/training[?week=YYYY-MM-DD]` · *Kind:* page · *Importance:* core

*Components:* `app/career/training/page.tsx`, `components/clubhq/EnvironmentBanner.tsx`, `components/game/Identity.tsx (MatchHero)`, `components/manager/TrainingFeedback.tsx`, `components/manager/AssistantTrainingPanel.tsx`, `lib/training/types.ts`, `components/game/squad-season.css`

**Purpose.** Plan the training week (day types, up to 2 sessions/day with type, intensity, duration, target group, responsible coach), apply templates, set per-player load and individual development focus, monitor energy/match fitness and development.

**Current structure.** EnvironmentBanner (training hall) with 3 metrics; "Veckans matchberedskap" band with 3 numbers + compact MatchHero; TrainingFeedback; AssistantTrainingPanel; "Veckoschema" panel with 7-column day grid (each day: date, day-type select or match link, session cards each with 4–5 selects); "Spelarberedskap" 5-column table; "Utveckling" 6-column table.

**Main actions**
- Föregående / Denna / Nästa vecka
- Choose template (Balanserad/Taktisk/Fysisk/Återhämtning/Matchtätt) + Tillämpa mall
- Set day type
- + Lägg till pass / Ta bort pass
- Per session: type (12), intensity (4), duration (3), target (4), coach
- Per player: load setting (Full/Reducerad/Endast återhämtning/Vila), individual focus (7)
- Jump to match prep / report from match day cell
- Assistant plan: ask, approve, decline

**Strengths**
- Match days are embedded in the week and link to prep/report
- Session cards colour-coded by category and intensity
- Coach quality per session surfaced
- Explanatory tooltips with energy multipliers

**Weaknesses**
- Each session card is a stack of 4–5 native selects – extremely dense, no drag/drop, no visual load budget
- Weekly load/energy forecast not shown – the player readiness consequence of the plan is invisible until days execute
- Duplicate metrics: banner and week band both show sessions/recovery/energy
- "Senaste förbättring" column prints the raw attribute key (e.g. FINISHING) not the Swedish label
- Terminology drift: Matchträning / matchform / "MF" for the same metric
- Locked (executed) days only show a "Genomförd" badge, no outcome

**Links:** /career/staff, /career/calendar, /career/fixtures/[id], /career/match-report/[id], /career/staff/responsibilities

**Desktop:** 7 day columns minmax(150px) (175px at large) inside horizontal scroller. **Mobile:** No mobile layout for the week grid: always 7×≥150px columns → sideways scrolling ≥1050px; tables scroll.

**Redesign opportunities**
- Visual week planner (drag session blocks, load bar per day, projected energy curve per player group)
- Per-player load/readiness chart linking to squad physical tab
- Development panel showing attribute deltas and focus effect

##### TRN-01a · Panel "Assistentens träningsplan" (AssistantTrainingPanel)

*Route:* `/career/training` · *Kind:* panel · *Importance:* frequent · *Parent:* TRN-01

*Components:* `components/manager/AssistantTrainingPanel.tsx`

**Purpose.** Delegation mode for training (Du själv / Råd först / Delegera), request weekly proposal, show proposal goal, planned sessions/intensity and individual advice; approve/decline.

**Current structure.** Section with mode buttons, proposal table (Spelare / skäl, Belastning).

**Main actions**
- Be om veckoförslag
- Godkänn (per advice)
- Godkänn träningsplan
- Avböj träningsplan
- Ansvarsfördelning →

**Strengths**
- Low-effort path for casual players

**Weaknesses**
- Placed above the planner; competes for attention

**Links:** STF-04

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Show proposal as a diff overlay on the week grid

##### TRN-01b · Panel "Veckoschema" (week planner)

*Route:* `/career/training` · *Kind:* panel · *Importance:* core · *Parent:* TRN-01

*Components:* `app/career/training/page.tsx`

**Purpose.** Edit the week.

**Current structure.** 7 day cells × ≤2 session cards.

**Main actions**
- See TRN-01

**Strengths**
- Category pills, matchday highlight, today highlight

**Weaknesses**
- Select-heavy

**Links:** TRN-01

**Desktop:** Scroll. **Mobile:** Scroll.

**Redesign opportunities**
- Block-based planner

##### TRN-01c · Panel "Spelarberedskap"

*Route:* `/career/training` · *Kind:* panel · *Importance:* frequent · *Parent:* TRN-01

*Components:* `app/career/training/page.tsx`

**Purpose.** Per player: energy badge (Pigg/Något sliten/Trött), MF %, recent load, load setting select (constrained by injury/limited), individual focus select; status badges (injured/rehab/return/placement).

**Current structure.** 5-column table.

**Main actions**
- Set load
- Set focus

**Strengths**
- Constraints enforced with explanatory title

**Weaknesses**
- "Senaste belastning" is an unexplained decaying magnitude; differs from squad "Belastning 7 d"

**Links:** SQD-01c

**Desktop:** - **Mobile:** Scroll.

**Redesign opportunities**
- Merge with squad physical view

##### TRN-01d · Panel "Utveckling"

*Route:* `/career/training` · *Kind:* panel · *Importance:* occasional · *Parent:* TRN-01

*Components:* `app/career/training/page.tsx`

**Purpose.** Per player: age, level stars, potential stars, status (Förbättras/Tränar/Ingen data), latest improvement.

**Current structure.** 6-column table.

**Main actions**
- Read

**Strengths**
- Squad-wide development overview

**Weaknesses**
- Raw attribute key and stars as text

**Links:** SQD-02d

**Desktop:** - **Mobile:** Scroll.

**Redesign opportunities**
- Development leaderboard / growth chart

##### TRN-01e · TrainingFeedback block

*Route:* `/career/training` · *Kind:* panel · *Importance:* occasional · *Parent:* TRN-01

*Components:* `components/manager/TrainingFeedback.tsx`

**Purpose.** Collapsed <details> "Senaste träningsutfall · date": per player sessions attended, energy before/after and change for the latest executed training day.

**Current structure.** details + Panel table (Spelare, Pass, Energi före, Energi efter, Förändring).

**Main actions**
- Expand

**Strengths**
- Only place showing the actual energy cost of training

**Weaknesses**
- Collapsed by default and only for the latest day; no history

**Links:** TRN-01

**Desktop:** - **Mobile:** -


##### TRN-01f · Loading state

*Route:* `/career/training` · *Kind:* state · *Importance:* rare · *Parent:* TRN-01

*Components:* `app/career/training/page.tsx`

**Purpose.** Suspense fallback "Förbereder träningsveckan…".

**Current structure.** hm-empty status text.

**Main actions**
- None

**Strengths**
- role=status

**Weaknesses**
- No skeleton

**Links:** TRN-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Skeleton

#### TRN-02 · Matchplan & Taktiktavla 2.0

*Route:* `/career/tactics` · *Kind:* page · *Importance:* core

*Components:* `app/career/tactics/page.tsx (1665 lines)`, `components/court/HandballCourtSvg.tsx`, `components/game/CoachingChoices.tsx`, `components/matchPlan/TacticsDiffManager.tsx`, `components/matchPlan/HandballPlanSections.tsx (SetPieceSection, LeadershipSection)`, `components/game/coaching.css`, `lib/matchPlan/*`, `lib/career/manualLineup.ts`

**Purpose.** Choose match squad (≤16) and starting seven, defensive specialists/exchanges, special situations (6v5, 5v6, 7v6), team style (defence 6-0/5-1, aggression, tempo, attack identity, rotation, 7v6 policy), assistant rotation, 7m takers, captaincy/leadership, for the next fixture.

**Current structure.** EnvironmentBanner; fixture strip (crests, date, round, anchor pills); coach-preparation-layout = left court section (heading, visual-mode radiogroup, dual Attack/Defence tabs with badges, special-situation tabs, exchange banner, SVG court with draggable position chips, bench strip, TacticsDiffManager in EXCHANGES mode) + right rail ("Så spelar vi" CoachingChoices + active-plan summary + assistant toggle + mode-specific rail panel); SetPieceSection; LeadershipSection; roster split (Matchtrupp · n spelare / Ej uttagna).

**Main actions**
- Drag & drop players between court slots and bench (HTML5 DnD)
- Switch court mode (Anfall 6v6 / Försvar 6v6 / Byten & Diff / 6 mot 5 / 5 mot 6 / 7 mot 6)
- Switch defence 6–0 / 5–1
- Select defence zone / 5v6 index
- Switch player-overlay mode (Energi / Lämplighet / Senaste match / Form 5 matcher)
- Assign / remove defensive specialists, clear all exchanges
- Set coaching choices
- Toggle Assistentbyten
- Set 7m order, captain, vice
- Add/remove players to match squad
- Repair plan (gate states)
- Jump: Till matchen → / Truppen →

**Strengths**
- Genuinely handball-native: 6v6, 5v6, 7v6 and attack↔defence exchanges are first-class
- Court-based direct manipulation with drag & drop
- Overlay modes turn the court into an information display (energy, suitability, last-match rating, 5-match form)
- Derived exchange banner explains automatic specialist swaps
- Robust guard states that repair invalid plans

**Weaknesses**
- Very large single file (1665 lines) with many inline styles and emoji icons (⚡🎯⭐📈⚔️🛡️🔄) – inconsistent visual language
- Three overlapping mode controls (anchor pills, dual tabs, situation tabs) all set the same courtMode
- Drag & drop is HTML5 only – no touch support, no keyboard alternative visible on court
- Mixed anchor navigation (#plan-setpieces) and in-page state switches
- Several components in components/matchPlan (CourtBoard, StartingUnitEditor, MatchSquadPanel, PlayerInstructionPanel, TacticalConfigPanel, SpecialPlayPanel, SevenVSixPolicyControl) are not used by any career route – dead or editor-only
- Opponent context is absent on the page (opponent analysis lives on /career/analysis/opponent and match-preview)

**Links:** /career/match-preview, /career/squad, /career/players, /career/clubs/[opponentId], /career

**Desktop:** Two columns (court + ~340px rail) ≥1350px. **Mobile:** coaching.css: ≤1350px rail 340px; ≤1050px single column, rail 2-col; ≤750px rail 1-col. DnD unusable on touch.

**Redesign opportunities**
- Tactic board with tap-to-select-then-tap-to-place (touch + keyboard)
- Opponent overlay on court (their tendencies vs our setup)
- Single mode switcher (phase × manpower matrix)
- Plan readiness checklist (squad, GK, 7m, captain) as a progress header

##### TRN-02a · Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup)

*Route:* `/career/tactics` · *Kind:* state · *Importance:* occasional · *Parent:* TRN-02

*Components:* `app/career/tactics/page.tsx`

**Purpose.** Full-page blocking states: "Nästa laguttagning väntar.", "Startsjuan behöver fler spelare.", "Uttagningen behöver uppdateras.", "Välj en normal startsju.", "Startsjuan behöver uppdateras." each with repair button or links.

**Current structure.** Banner + message card.

**Main actions**
- Repair / rebuild plan
- Öppna truppen
- Hitta förstärkning
- Till klubben

**Strengths**
- Clear recovery paths

**Weaknesses**
- Replaces entire page; user cannot inspect current plan while blocked

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Inline warnings with auto-fix preview

##### TRN-02b · Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs)

*Route:* `/career/tactics` · *Kind:* tab · *Importance:* core · *Parent:* TRN-02

*Components:* `app/career/tactics/page.tsx`, `components/court/HandballCourtSvg.tsx`

**Purpose.** Edit attack starting seven or defence 6v6 positions/specialists on the SVG court.

**Current structure.** role=tablist with two large tabs showing badges ("6 båda vägar", "n specialister").

**Main actions**
- Drag players
- Toggle 6–0 / 5–1
- Select defence zone

**Strengths**
- Badges summarise two-way vs specialist usage

**Weaknesses**
- Emoji icons, uppercase labels

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Phase toggle integrated in court header

##### TRN-02c · Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6)

*Route:* `/career/tactics` · *Kind:* tab · *Importance:* frequent · *Parent:* TRN-02

*Components:* `app/career/tactics/page.tsx`

**Purpose.** Configure numerical advantage/disadvantage and empty-goal attack units.

**Current structure.** role=tablist of 3 tabs; rail shows situation-specific panel.

**Main actions**
- Assign players per slot
- Pick 7th outfielder

**Strengths**
- Covers handball-specific situations most managers games ignore

**Weaknesses**
- Hidden behind small tabs; no indication if a situation is unconfigured

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Completion indicators per situation

##### TRN-02d · Mode "Byten & Diff" (TacticsDiffManager)

*Route:* `/career/tactics` · *Kind:* tab · *Importance:* frequent · *Parent:* TRN-02

*Components:* `components/matchPlan/TacticsDiffManager.tsx`, `lib/matchPlan/tacticsDiffWorkflow.ts`

**Purpose.** Attack↔defence exchange overview: who plays both ways, specialist pairs (max 3), clear all.

**Current structure.** Diff manager panel under court.

**Main actions**
- Assign/remove specialist
- Clear all exchanges
- Jump to court mode

**Strengths**
- Makes implicit substitution logic explicit

**Weaknesses**
- Reached only via anchor pill "Byten & Diff", not via the dual tabs

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Visual pairing lines on court

##### TRN-02e · Overlay mode selector "Taktikvisning"

*Route:* `/career/tactics` · *Kind:* panel · *Importance:* frequent · *Parent:* TRN-02

*Components:* `app/career/tactics/page.tsx`

**Purpose.** Switch chip subtitle data: Energi, Lämplighet, Senaste match, Form (5 matcher).

**Current structure.** Inline-styled radiogroup with emoji buttons + helper text.

**Main actions**
- Select mode

**Strengths**
- Turns court into data display

**Weaknesses**
- Uses aria-checked on buttons without role=radio; inline styles

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Colour-scaled chips + legend

##### TRN-02f · Rail "Så spelar vi" (CoachingChoices)

*Route:* `/career/tactics` · *Kind:* panel · *Importance:* core · *Parent:* TRN-02

*Components:* `components/game/CoachingChoices.tsx`

**Purpose.** Team style: defence system, aggression, tempo, attack identity, rotation, 7v6 policy; summary line; Assistentbyten på/av.

**Current structure.** Fieldsets of segmented choices + summary sentence.

**Main actions**
- Change each choice
- Toggle assistant rotation

**Strengths**
- Same component reused live in match (consistency)

**Weaknesses**
- No explanation of trade-offs at plan time (TimeoutOverlay has richer copy)

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Trade-off explanations + opponent-aware suggestion

##### TRN-02g · Section "Fasta situationer · 7-meter" (SetPieceSection)

*Route:* `/career/tactics` · *Kind:* panel · *Importance:* occasional · *Parent:* TRN-02

*Components:* `components/matchPlan/HandballPlanSections.tsx`

**Purpose.** Order of penalty takers (max MAX_PENALTY_TAKERS).

**Current structure.** hm-plan-section with selects.

**Main actions**
- Choose takers in order

**Strengths**
- -

**Weaknesses**
- Below the fold, reached by anchor

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Show 7m conversion stats next to candidates

##### TRN-02h · Section "Ledarskap" (LeadershipSection)

*Route:* `/career/tactics` · *Kind:* panel · *Importance:* occasional · *Parent:* TRN-02

*Components:* `components/matchPlan/HandballPlanSections.tsx`

**Purpose.** Captain, vice-captain, leadership effect (steadying leadership).

**Current structure.** hm-plan-section.

**Main actions**
- Set captain / vice

**Strengths**
- Second place to set captain (also on squad aside)

**Weaknesses**
- Duplicate captaincy entry points

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Single roles editor

##### TRN-02i · Roster "Matchtrupp · n spelare" / "Ej uttagna"

*Route:* `/career/tactics` · *Kind:* panel · *Importance:* core · *Parent:* TRN-02

*Components:* `app/career/tactics/page.tsx`

**Purpose.** Selected match squad (≤16) and players outside it.

**Current structure.** Two roster columns of rows.

**Main actions**
- Add/remove from squad
- Drag to court

**Strengths**
- Clear count vs max

**Weaknesses**
- Placed at bottom; squad size validation surfaces only in match preview

**Links:** TRN-02

**Desktop:** Inside tactics layout. **Mobile:** Stacks ≤1050px.

**Redesign opportunities**
- Persistent squad counter in header

### REC — Scouting, recruitment, transfers, negotiation

#### REC-01 · Scouting & Motståndaranalys

*Route:* `/career/scouting[?target=playerId]` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/scouting/page.tsx`, `components/scouting/ScoutingCentre.tsx`, `components/scouting/scouting.css`, `lib/career/scouting.ts`

**Purpose.** Run the scouting department: see scouts and workload, start player assignments and broad assignments (club / competition / nation / position+age), follow active work, open finished reports, browse discoveries; recommendations by squad need.

**Current structure.** PageHeading; ScoutingCentre (spotlight hero, stats strip, Rekommendationer list with compare, "Scouterna" workload rail, "Senaste upptäckterna"); market-stage band with 3 counters; game-scouting-layout column of 7 Panels: Dina scouter, Ny bevakning (search + 6-column table + scout select), Nytt bredare uppdrag (form), Aktiva uppdrag, Färdiga rapporter, Breda uppdrag, Upptäckta spelare (6-column table + filters).

**Main actions**
- Rekrytera scouter →
- Rekryteringscentrum →
- Search player to watch + pick scout + start assignment
- Configure broad assignment (type, club/competition/nation/position, max age, scout) + start
- Cancel broad assignment
- Filter discoveries by scout/type
- Kortlista / Scouta from recommendations
- Öppna rapport

**Strengths**
- Explicit uncertainty narrative ("Det du inte vet visas som ett spann")
- Two assignment types (targeted vs broad) mirror real scouting
- Recommendations tied to squad needs

**Weaknesses**
- Title promises "Motståndaranalys" but opponent scouting is not on this page (it lives on analysis/opponent and match-preview)
- Two hero/summary blocks stacked (ScoutingCentre hero + market-stage counters) with overlapping numbers
- Seven panels in one long column; no tabs
- Scout ability shown as "x.x/20" here but as stars elsewhere
- "Öppna rapport" leads to the player profile, not a report view

**Links:** /career/staff/recruitment, /career/recruitment, /career/squad/[playerId], /career/staff/[staffId]

**Desktop:** Layout grid; ≥1100px two columns. **Mobile:** scouting.css ≤1100/≤700px; recruitment-news.css ≤900px single column.

**Redesign opportunities**
- Scouting board (kanban: Upptäckt → Bevakas → Rapport → Kortlista)
- Map/league coverage view of where scouts are
- Report view with knowledge-gain visual

##### REC-01a · ScoutingCentre ("Scoutingcentralen")

*Route:* `/career/scouting` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-01

*Components:* `components/scouting/ScoutingCentre.tsx`

**Purpose.** Hero spotlight on newest discovery, stats, need-based recommendations with star ranges, scout workload, latest discoveries.

**Current structure.** sc-centre hero + two-column panels.

**Main actions**
- Öppna rapporten
- Kortlista
- Scouta

**Strengths**
- Star-range component (StarRangeView) is a good uncertainty primitive

**Weaknesses**
- Duplicates counters below

**Links:** REC-01

**Desktop:** Panel. **Mobile:** Stacked.

**Redesign opportunities**
- Make it the page

##### REC-01b · Panel "Dina scouter"

*Route:* `/career/scouting` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-01

*Components:* `app/career/scouting/page.tsx`

**Purpose.** Scouts with suitability x/20 and active assignment count; empty state with recruit button.

**Current structure.** List.

**Main actions**
- Open scout
- Rekrytera

**Strengths**
- Workload visible

**Weaknesses**
- Duplicates ScoutingCentre "Scouterna"

**Links:** REC-01

**Desktop:** Panel. **Mobile:** Stacked.

**Redesign opportunities**
- Merge

##### REC-01c · Panel "Ny bevakning"

*Route:* `/career/scouting` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-01

*Components:* `app/career/scouting/page.tsx`

**Purpose.** Targeted assignment: search, table (Spelare, Pos, Ålder, Klubb, Kännedom, Välj), scout select, start; ?target= preselects.

**Current structure.** Search + table + form.

**Main actions**
- Search
- Select
- Start

**Strengths**
- Deep-link from profile pre-selects player

**Weaknesses**
- Form errors as text only

**Links:** REC-01

**Desktop:** Panel. **Mobile:** Stacked.

**Redesign opportunities**
- Assign by dragging player onto scout

##### REC-01d · Panel "Nytt bredare uppdrag"

*Route:* `/career/scouting` · *Kind:* panel · *Importance:* occasional · *Parent:* REC-01

*Components:* `app/career/scouting/page.tsx`

**Purpose.** Broad assignment builder: type CLUB/COMPETITION/NATION/POSITION, parameters, max age, scout.

**Current structure.** Type buttons + conditional fields.

**Main actions**
- Configure
- Start

**Strengths**
- Flexible discovery

**Weaknesses**
- No estimate of duration/yield

**Links:** REC-01

**Desktop:** Panel. **Mobile:** Stacked.

**Redesign opportunities**
- Show expected output & duration

##### REC-01e · Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag"

*Route:* `/career/scouting` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-01

*Components:* `app/career/scouting/page.tsx`

**Purpose.** Progress of work, completed reports with knowledge meter, broad assignments with cancel.

**Current structure.** Three list panels.

**Main actions**
- Öppna rapport
- Avbryt

**Strengths**
- Progress %

**Weaknesses**
- Three separate lists for one pipeline

**Links:** REC-01

**Desktop:** Panel. **Mobile:** Stacked.

**Redesign opportunities**
- Single pipeline board

##### REC-01f · Panel "Upptäckta spelare"

*Route:* `/career/scouting` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-01

*Components:* `app/career/scouting/page.tsx`

**Purpose.** Discoveries table (Spelare, Klubb, Källa, Scout, Kännedom) with filters by scout and assignment type.

**Current structure.** Filter row + table.

**Main actions**
- Filter
- Kortlista/Open

**Strengths**
- Source attribution

**Weaknesses**
- No ability range column

**Links:** REC-01

**Desktop:** Panel. **Mobile:** Stacked.

**Redesign opportunities**
- Add star-range column and sort

#### REC-02 · Rekryteringscentrum

*Route:* `/career/recruitment[?view=SHORTLIST]` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/recruitment/page.tsx`, `components/game/RecruitmentPresentation.tsx`, `lib/career/recruitment.ts`

**Purpose.** Pipeline of recruitment candidates (discovered → scouting → scouted → shortlist → prioritised → negotiating) with dossier, priority and notes.

**Current structure.** PageHeading; numbered stage nav (01–07) as process strip; layout: candidates Panel (search + filter chips + 10-column table: Spelare, Klubb, Pos, Ålder, Kännedom, Förmåga, Potential, Marknadsvärde, Status) + dossier column (links, profile card, assessment, scouting box with progress, priority & note, transfer panel).

**Main actions**
- Switch pipeline stage (7 buttons: Alla, Nya fynd, Under scouting, Scoutade, Kortlista, Prioriterade, Aktiva förhandlingar)
- Search, filter position/nation/status/knowledge tier
- Select candidate
- Toggle shortlist
- Start scouting with chosen scout
- Set priority, write note
- Jämför med truppen
- Öppna bud & budget
- Open negotiation room

**Strengths**
- Process-oriented stage strip matches the real recruitment funnel
- Shows ability/potential ranges and market value range (knowledge-gated) – the richest market table
- Notes and priority per target

**Weaknesses**
- Stage state is local (only ?view=SHORTLIST read) – not deep-linkable
- Inline style objects (inputStyle)
- Overlaps with Spelarsök and Transfer Centre lists

**Links:** /career/players, /career/compare?left, /career/transfers?target, /career/transfers/[playerId], /career/scouting?target, /career/staff/recruitment

**Desktop:** Two columns (table + dossier 320–500px). **Mobile:** ≤900px single column; stage strip 4 columns.

**Redesign opportunities**
- Kanban funnel with drag between stages
- Unified market + pipeline workspace

##### REC-02a · Candidate dossier

*Route:* `/career/recruitment` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-02

*Components:* `app/career/recruitment/page.tsx (CandidateDossier)`

**Purpose.** Assessment ("Scoutens bedömning"/"Bedömningsunderlag"), scouting box, "Prioritet & anteckning", "Transfer" panel.

**Current structure.** Stack of 4 panels.

**Main actions**
- Open profile
- Shortlist
- Start scouting
- Priority
- Note
- Negotiate

**Strengths**
- Everything for one target in one column

**Weaknesses**
- Long; duplicates profile content

**Links:** SQD-02, REC-04

**Desktop:** Right column. **Mobile:** Below.

**Redesign opportunities**
- Drawer

#### REC-03 · Transfer Centre

*Route:* `/career/transfers[?target=playerId]` · *Kind:* page · *Importance:* core

*Components:* `app/career/transfers/page.tsx`, `components/players/IncomingOffersBoard.tsx`, `components/transfers/transfer-centre.css`, `lib/career transfer status helpers`

**Purpose.** Hub for buying/selling: incoming bids & departures, urgent negotiations, transfer budget, market (opportunities/all/watched), ongoing negotiations, squad needs, market pulse, recent deals.

**Current structure.** PageHeading; IncomingOffersBoard (bids list + 4 mini-lists); tc-stage band (headline sentence + budget/committed meter stats); urgent cards; main tc-panel with tablist, featured opportunity cards and 8-column table (Spelare, Pos, Ålder, Klubb, Kontrakt, Marknadsvärde range, Intresse, Status); dossier aside; side panels Förhandlingar, Truppbehov, Marknadspuls (14-day responses), Senaste affärer.

**Main actions**
- Respond to incoming bid (link)
- Open urgent negotiation card
- Switch market tab (Möjligheter / Hela marknaden / Bevakade)
- Search, position chips, interest filter
- Select player → dossier
- Förhandla / Föreslå lån / Bevaka / Jämför / Spelarprofil

**Strengths**
- Strong decision-first headline ("n förhandlingar väntar på ditt drag")
- Opportunities explain "why" per player (need + realistic contract + budget)
- Interest filter (realistic) reduces dead-end negotiations
- Market pulse gives a sense of a living market

**Weaknesses**
- Shortlist called "Bevakade/Bevaka" here but "Kortlista" elsewhere – same data, two names
- Very long page; incoming sales board sits above buying content
- Third player-market table in the game (with Spelarsök and Rekryteringscentrum)
- Disabled negotiate button uses inline opacity styles; reason only in title tooltip

**Links:** /career/recruitment, /career/transfers/[playerId], /career/transfers/offers/[offerId], /career/compare?right, /career/squad/[playerId]

**Desktop:** Multi-column; transfer-centre.css breakpoints 1280/1100/760. **Mobile:** ≤760px stacked; photo hero swaps to narrow image ≤900px.

**Redesign opportunities**
- Separate Buy / Sell / Deals modes
- Budget waterfall (budget, committed, wage room)
- Unified market table with knowledge-gated quality

##### REC-03a · Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard)

*Route:* `/career/transfers` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-03

*Components:* `components/players/IncomingOffersBoard.tsx`

**Purpose.** Live bids (club crest, player, status, fee, respond-by CTA), "Vill lämna", "Transferlistan", "Förhandsavtal", "Senaste avgångar"; empty state explains when bids arrive.

**Current structure.** tc-panel with bid list + 4-column mini lists.

**Main actions**
- Svara före <date>
- Öppna
- Open player

**Strengths**
- Good empty-state copy

**Weaknesses**
- Always first on Transfer Centre even when user wants to buy

**Links:** REC-05

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Sell tab

##### REC-03b · Market tabs (Möjligheter / Hela marknaden / Bevakade)

*Route:* `/career/transfers` · *Kind:* tab · *Importance:* core · *Parent:* REC-03

*Components:* `app/career/transfers/page.tsx`

**Purpose.** Three market lists with counts; featured cards for opportunities; filters only on full market.

**Current structure.** role=tablist + table.

**Main actions**
- Switch
- Search
- Filter
- Select row (keyboard enabled)

**Strengths**
- Keyboard-selectable rows with aria-selected

**Weaknesses**
- Tab state not in URL

**Links:** REC-03c

**Desktop:** - **Mobile:** Scroll.


##### REC-03c · Dossier aside (TransferDossier)

*Route:* `/career/transfers` · *Kind:* drawer · *Importance:* frequent · *Parent:* REC-03

*Components:* `app/career/transfers/page.tsx`

**Purpose.** Selected player: knowledge-gated view (fetches rating), interest assessment, negotiate/loan/watch/compare/profile actions; Stäng button.

**Current structure.** Aside with close button (behaves like a non-modal drawer).

**Main actions**
- Förhandla om övergång
- Föreslå lån
- Bevaka/Sluta bevaka
- Jämför med truppen
- Spelarprofil
- Stäng

**Strengths**
- Explains why negotiation is blocked (interest.reason)

**Weaknesses**
- Reason only in tooltip

**Links:** REC-04, SQD-02, SQD-04

**Desktop:** Right column. **Mobile:** Stacked.

**Redesign opportunities**
- True slide-over drawer

##### REC-03d · Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer)

*Route:* `/career/transfers` · *Kind:* panel · *Importance:* frequent · *Parent:* REC-03

*Components:* `app/career/transfers/page.tsx`

**Purpose.** Ongoing deals with next step, players per position vs need, last 14 days of responses, recent ins/outs.

**Current structure.** Four tc-panels.

**Main actions**
- Open deal

**Strengths**
- Live dot for pulse

**Weaknesses**
- Truppbehov duplicates squad depth

**Links:** REC-04, SQD-01f

**Desktop:** Rail. **Mobile:** Stacked.

**Redesign opportunities**
- Need heat-map on court

#### REC-04 · Förhandlingsrum (negotiation room)

*Route:* `/career/transfers/[playerId][?deal=LOAN]` · *Kind:* page · *Importance:* core

*Components:* `app/career/transfers/[playerId]/page.tsx`, `components/transfers/NegotiationRoom.tsx`, `components/transfers/DealCompletion.tsx`, `components/experience (ProgressSteps)`, `components/MoneyInput.tsx`

**Purpose.** The single place to negotiate a permanent transfer or loan: club stage (fee or loan wage share + end date), player stage (wage, years 1–5, signing bonus, promised role), counters, waiting, completion.

**Current structure.** PageHeading + photo hero with parties (club ↔ our club), ProgressSteps stepper (Klubben → Spelaren/Speltiden → Signering/Lånet) and deadline clock; two party asides (club, player & agent) around a decision section; timeline of rounds (tc-timeline); acquisition summary box with training compensation; DealCompletion moment on success.

**Main actions**
- Choose deal type (Permanent / Lån) and Öppna förhandlingen
- Lägg budet (fee)
- Loan: wage-share %, end date
- Lägg fram villkoren (wage, years, bonus, role)
- Accept counter ("meet") / Justera budet i stället
- Dra dig ur
- After completion: Öppna spelarprofilen / Se truppen / Planera laguttagning

**Strengths**
- Negotiation as a visible, staged conversation with timeline and stamped answers
- Deadline urgency clock
- Acquisition cost summary (fee, bonus, wage × years, training compensation)
- Rich completion moment with next-step CTAs

**Weaknesses**
- Some summary boxes built with inline styles
- No indication of player's willingness/likely acceptance range beyond counters
- Own-player and cooldown states are text blocks

**Links:** /career/transfers, /career/squad/[playerId], /career/squad, /career/tactics, /career/contracts

**Desktop:** Hero + 3-column party/decision layout. **Mobile:** transfer-centre.css ≤1100/760 stacks parties above decision.

**Redesign opportunities**
- Acceptance-zone slider visual
- Shared negotiation pattern for staff and renewals

##### REC-04a · Start decision "Inled förhandling"

*Route:* `/career/transfers/[playerId]` · *Kind:* state · *Importance:* frequent · *Parent:* REC-04

*Components:* `components/transfers/NegotiationRoom.tsx`

**Purpose.** Deal-type radiogroup and open button; cooldown and own-player variants.

**Current structure.** tc-decision tc-start.

**Main actions**
- Permanent / Lån
- Öppna förhandlingen →

**Strengths**
- Loan disabled with reason

**Weaknesses**
- -

**Links:** REC-04

**Desktop:** Centre column. **Mobile:** Stacked.


##### REC-04b · Decision form – club stage

*Route:* `/career/transfers/[playerId]` · *Kind:* panel · *Importance:* core · *Parent:* REC-04

*Components:* `components/transfers/NegotiationRoom.tsx`

**Purpose.** Fee (or loan wage share %, end date) with visible knowledge-gated value range as default.

**Current structure.** Form inside tc-decision with counter "meet" button.

**Main actions**
- Lägg budet
- Accept counter
- Dra dig ur

**Strengths**
- Defaults derived from value range

**Weaknesses**
- Number input for % (no slider)

**Links:** REC-04

**Desktop:** Centre column. **Mobile:** Stacked.

**Redesign opportunities**
- Slider with range band

##### REC-04c · Decision form – player stage

*Route:* `/career/transfers/[playerId]` · *Kind:* panel · *Importance:* core · *Parent:* REC-04

*Components:* `components/transfers/NegotiationRoom.tsx`

**Purpose.** Wage/month, years, signing bonus, promised role; acquisition summary.

**Current structure.** Form + summary box.

**Main actions**
- Lägg fram villkoren
- Accept counter

**Strengths**
- Total cost transparency

**Weaknesses**
- Dense

**Links:** REC-04

**Desktop:** Centre column. **Mobile:** Stacked.


##### REC-04d · Waiting / closed status

*Route:* `/career/transfers/[playerId]` · *Kind:* state · *Importance:* frequent · *Parent:* REC-04

*Components:* `components/transfers/NegotiationRoom.tsx`

**Purpose.** "Inget att göra just nu" while party considers; closed labels (refused, expired, withdrawn).

**Current structure.** tc-status blocks.

**Main actions**
- Continue in calendar

**Strengths**
- Honest async state

**Weaknesses**
- No "advance to answer" shortcut

**Links:** REC-04

**Desktop:** Centre column. **Mobile:** Stacked.

**Redesign opportunities**
- Inline "advance day" affordance

##### REC-04e · Deal completed (DealCompletion)

*Route:* `/career/transfers/[playerId]` · *Kind:* overlay · *Importance:* occasional · *Parent:* REC-04

*Components:* `components/transfers/NegotiationRoom.tsx`

**Purpose.** Celebratory moment with deal summary and next steps.

**Current structure.** Photo moment hero + summary.

**Main actions**
- Öppna spelarprofilen
- Se truppen
- Planera laguttagning
- Tillbaka till Transfer Centre

**Strengths**
- Emotional payoff

**Weaknesses**
- -

**Links:** REC-04

**Desktop:** Centre column. **Mobile:** Stacked.


#### REC-05 · Bud på din spelare (incoming offer)

*Route:* `/career/transfers/offers/[offerId]` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/transfers/offers/[offerId]/page.tsx`, `components/experience (DecisionCard, MomentHero)`, `components/MoneyInput.tsx`

**Purpose.** Respond to another club's bid for an own player: why they want him, bidding history, financial & sporting effect, accept / counter / reject / withdraw; completed sale moment.

**Current structure.** PageHeading; player header; sections "Varför de vill ha honom", "Budgivningen" history, "Ekonomisk & sportslig effekt"; DecisionCard "Ditt svar"; MomentHero "Såld" when completed.

**Main actions**
- Acceptera budet
- Motbud + Skicka motbud
- Avvisa affär
- Dra dig ur
- ← Transfers

**Strengths**
- Consequences framed (cash, sporting effect)
- Player has final say explicitly stated

**Weaknesses**
- Not-found is a bare panel
- Sporting effect is text, no squad-depth visual

**Links:** /career/transfers, SQD-02i

**Desktop:** Single column. **Mobile:** Single column.

**Redesign opportunities**
- Show depth chart before/after sale

##### REC-05a · Sold moment (MomentHero "Såld")

*Route:* `/career/transfers/offers/[offerId]` · *Kind:* overlay · *Importance:* rare · *Parent:* REC-05

*Components:* `app/career/transfers/offers/[offerId]/page.tsx`

**Purpose.** Departure announcement after completion.

**Current structure.** Photo moment.

**Main actions**
- Read

**Strengths**
- Narrative closure

**Weaknesses**
- -

**Links:** REC-05

**Desktop:** - **Mobile:** -


### CMP — Competitions, fixtures, matches list, statistics

#### CMP-01 · Tävlingar (competition workspace)

*Route:* `/career/competitions[/competitionId][?tab=]` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/competitions/page.tsx`, `app/career/competitions/[competitionId]/page.tsx`, `components/manager/CompetitionWorkspace.tsx`, `components/manager/CupWorkspace.tsx`, `components/manager/StatisticsTable.tsx`, `components/game/Identity.tsx (CompetitionHero)`, `components/game/profile-world.css`

**Purpose.** League/cup hub: table & form, fixtures, results, player statistics, clubs, history; switch between any competition (incl. non-simulated leagues for recruitment browsing).

**Current structure.** CompetitionHero; switcher + meta pills (Fullt simulerad / Ej simulerad, clubs count, played matches, next round); hm-tabs as Links (6); split: main Panel per tab + rail (Din klubb i ligan, Omgång n list, Senaste resultat, Skytteligan top 5, note for non-simulated).

**Main actions**
- Switch competition (select)
- Switch tab (URL ?tab=)
- Open club / match / history season

**Strengths**
- Tabs are URL-driven (deep-linkable)
- Same workspace for every league; clear simulated/non-simulated status
- League table with 11 columns incl. form dots

**Weaknesses**
- /career/competitions and /career/competitions/[id] are identical components (no overview of all competitions)
- Cup uses a different layout (CupWorkspace) with an h1 inside a section
- Statistics tab duplicates /career/statistics

**Links:** /career/clubs/[id], /career/fixtures/[id], /career/match-report/[id], /career/history?season

**Desktop:** Main + rail. **Mobile:** profile-world.css ≤1250px one column, meta pills hidden.

**Redesign opportunities**
- League table with position-change arrows and points-gap chart
- Season progression timeline

##### CMP-01a · Tab "Tabell & form"

*Route:* `/career/competitions/[competitionId]?tab=` · *Kind:* tab · *Importance:* core · *Parent:* CMP-01

*Components:* `components/manager/CompetitionWorkspace.tsx`

**Purpose.** League table.

**Current structure.** Table #, Klubb, SM, V, O, F, GM, IM, MSK, P, Form · fem senaste; own club highlighted.

**Main actions**
- Read
- Open linked entities

**Links:** CMP-01

**Desktop:** Main column. **Mobile:** Scroll tables.


##### CMP-01b · Tab "Matcher"

*Route:* `/career/competitions/[competitionId]?tab=` · *Kind:* tab · *Importance:* frequent · *Parent:* CMP-01

*Components:* `components/manager/CompetitionWorkspace.tsx`

**Purpose.** Upcoming fixtures.

**Current structure.** FixtureTable.

**Main actions**
- Read
- Open linked entities

**Links:** CMP-01

**Desktop:** Main column. **Mobile:** Scroll tables.


##### CMP-01c · Tab "Resultat"

*Route:* `/career/competitions/[competitionId]?tab=` · *Kind:* tab · *Importance:* frequent · *Parent:* CMP-01

*Components:* `components/manager/CompetitionWorkspace.tsx`

**Purpose.** Played fixtures.

**Current structure.** FixtureTable.

**Main actions**
- Read
- Open linked entities

**Links:** CMP-01

**Desktop:** Main column. **Mobile:** Scroll tables.


##### CMP-01d · Tab "Spelarstatistik"

*Route:* `/career/competitions/[competitionId]?tab=` · *Kind:* tab · *Importance:* occasional · *Parent:* CMP-01

*Components:* `components/manager/CompetitionWorkspace.tsx`

**Purpose.** Player ranking for this competition.

**Current structure.** StatisticsTable (metric select, minimum filter, 12 columns).

**Main actions**
- Read
- Open linked entities

**Links:** CMP-01

**Desktop:** Main column. **Mobile:** Scroll tables.


##### CMP-01e · Tab "Klubbar"

*Route:* `/career/competitions/[competitionId]?tab=` · *Kind:* tab · *Importance:* occasional · *Parent:* CMP-01

*Components:* `components/manager/CompetitionWorkspace.tsx`

**Purpose.** Clubs list with city and squad count.

**Current structure.** 3-column table.

**Main actions**
- Read
- Open linked entities

**Links:** CMP-01

**Desktop:** Main column. **Mobile:** Scroll tables.


##### CMP-01f · Tab "Historik"

*Route:* `/career/competitions/[competitionId]?tab=` · *Kind:* tab · *Importance:* rare · *Parent:* CMP-01

*Components:* `components/manager/CompetitionWorkspace.tsx`

**Purpose.** Finished seasons links.

**Current structure.** Link rows / EmptyState.

**Main actions**
- Read
- Open linked entities

**Links:** CMP-01

**Desktop:** Main column. **Mobile:** Scroll tables.


##### CMP-01g · Svenska Cupen variant (CupWorkspace)

*Route:* `/career/competitions/se-svenska-cupen-herr` · *Kind:* state · *Importance:* occasional · *Parent:* CMP-01

*Components:* `components/manager/CupWorkspace.tsx`

**Purpose.** Cup path ("Din väg i cupen"), next cup matches, group tables, fixtures/results, previous winners.

**Current structure.** Header section + panels per group (#, Lag, M, +/-, P).

**Main actions**
- Switch tabs
- Open matches

**Strengths**
- Group stage + ties supported

**Weaknesses**
- Different visual structure from league workspace; no bracket visual

**Links:** CMP-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Bracket / path visual

##### CMP-01h · Non-simulated league / not found states

*Route:* `/career/competitions/[competitionId]` · *Kind:* state · *Importance:* occasional · *Parent:* CMP-01

*Components:* `components/manager/CompetitionWorkspace.tsx`

**Purpose.** "Ej simulerad · ingen tabell" with note to explore clubs; "Tävlingen hittades inte."

**Current structure.** Status pill + world note.

**Main actions**
- Inspektera klubbarna →

**Strengths**
- Honest scope

**Weaknesses**
- -

**Links:** CMP-01e

**Desktop:** - **Mobile:** -


#### CMP-02 · Match (fixture page)

*Route:* `/career/fixtures/[fixtureId]` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/fixtures/[fixtureId]/page.tsx`, `components/manager/Workspace.tsx (FixtureTable)`, `components/FormDots.tsx`

**Purpose.** Neutral fixture page for any match (own or other): teams, table position, form, recent fixtures; link to report when played.

**Current structure.** PageHeading (date/time, "Home – Away", result or round); two Panels side by side (one per club: table position, form dots, FixtureTable).

**Main actions**
- Open match report (if played)
- Open club
- Open schedule (not found)

**Strengths**
- Works for archive fixtures via careerArchiveSummaries

**Weaknesses**
- For the user's next match it is not a preparation hub (prep is on match-preview); Training links to this page as "Matchförberedelse →" which is misleading
- Very thin page

**Links:** /career/match-report/[id], /career/schedule, /career/clubs/[id]

**Desktop:** Two panels. **Mobile:** hm-comparison-select wraps.

**Redesign opportunities**
- Head-to-head history, odds-like strength comparison, redirect own next fixture to match prep

#### CMP-03 · Matcher (legacy redirect)

*Route:* `/career/matches` · *Kind:* state · *Importance:* internal

*Components:* `app/career/matches/page.tsx`

**Purpose.** Client-side redirect to /career/schedule (Schedule is the canonical fixture list, owned by part A).

**Current structure.** Renders null then router.replace.

**Main actions**
- None

**Strengths**
- Old bookmarks do not 404

**Weaknesses**
- Client redirect flashes empty page; /career/match-center redirects here, creating a double redirect

**Links:** /career/schedule

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Server redirect

#### CMP-04 · Statistik

*Route:* `/career/statistics` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/statistics/page.tsx`, `components/manager/StatisticsTable.tsx`, `components/game/Identity.tsx (PlayerCell, RankIndicator)`

**Purpose.** League-wide season statistics: leaders, player ranking, team attack & defence.

**Current structure.** PageHeading; leader strip of 3 cards (Flest mål, Flest räddningar, Högst snittbetyg); Panel "Spelarranking" (12-column table: #, Spelare, Nuvarande klubb, Pos, Matcher, Starter, Mål, Skott, Skott %, Räddningar / mötta, Räddning %, Betyg); Panel "Lag · anfall & försvar" (8 columns).

**Main actions**
- Choose ranking metric (Mål, Matcher, Skotteffektivitet, Räddningar…)
- Set minimum sample
- Tidigare säsonger →
- Open players/clubs

**Strengths**
- Minimum-sample filter avoids small-sample leaders
- Copy promises "Varje procenttal har ett underlag"

**Weaknesses**
- Only own league; no competition switcher (unlike competitions tab)
- No per-position leaderboards, no charts
- Duplicate of competition "Spelarstatistik" tab

**Links:** /career/history, SQD-02, /career/clubs/[id]

**Desktop:** Stack. **Mobile:** Tables scroll.

**Redesign opportunities**
- Scatter plots (shots vs efficiency, saves vs faced)
- Position-specific leaderboards

### MDY — Matchday: preview, live match, match-2d, half/full-time

#### MDY-01 · Matchförhandsvisning (match preview / matchday gate)

*Route:* `/career/match-preview` · *Kind:* page · *Importance:* core

*Components:* `app/career/match-preview/page.tsx`, `components/matchday/Matchday.tsx (MatchdayStage)`, `components/game/Identity.tsx (MatchHero)`, `components/manager/MatchContext.tsx`, `components/scouting/OpponentScoutingPanel.tsx`, `components/game/ConfirmDialog.tsx`, `lib/career/productionMatch*`

**Purpose.** Pre-match hub for the NEXT fixture: stakes, table & form, media, opponent knowledge, our starting seven, low-readiness warnings, unavailable players; start live match or quick result on matchday.

**Current structure.** Alerts (error, blocking squad issues, lineup errors) rendered ABOVE PageHeading; MatchdayStage (stakes band, "Tabell och form", "Vad som sägs", "Det vi vet"); MatchHero with start buttons (only on matchday); MatchContext; OpponentScoutingPanel compact; grid of two Panels ("Din matchförberedelse & startsjua" with 7 slot cards incl. K/7m badges + "Lägre beredskap" list; "Otillgängliga spelare" table).

**Main actions**
- STARTA MATCH → / FORTSÄTT MATCH →
- Quick result (snabbresultat)
- Confirm start despite squad warnings (dialog)
- Justera taktik & matchtrupp →
- Beställ scoutingrapport (opponent)
- Anpassa matchplanen →
- Open players

**Strengths**
- Readiness warnings tie training load to selection (energy %, 7-day load, reduced recovery)
- Confirm dialog prevents starting without substitutes
- Assistant-control notice when manager is suspended

**Weaknesses**
- Plan summary prints raw engine enums ("Anfallsstil: SLOW/BALANCED/FAST", formation code)
- Start buttons only exist on matchday; on other days the page is read-only with no "advance to matchday" CTA
- Alerts appear above the heading – disorienting
- Season-complete / no-fixture states are bare muted panels
- Overlaps with fixture page (CMP-02) and analysis/opponent (ANL-03)

**Links:** /career/tactics, /career/match-day/[fixtureId], /career/match-day/[fixtureId]?finish=1, SQD-02

**Desktop:** Stacked bands; 2-panel auto-fit grid (min 340px). **Mobile:** matchday.css ≤1100px stacks; grid auto-fits to one column.

**Redesign opportunities**
- True "matchday ritual": checklist (squad ✓, GK ✓, 7m ✓, opponent report ✓) → kick-off
- Lineup on a court graphic with readiness rings
- Opponent threat cards next to our matchups

##### MDY-01a · MatchdayStage ("Matchdagen")

*Route:* `/career/match-preview` · *Kind:* panel · *Importance:* frequent · *Parent:* MDY-01

*Components:* `components/matchday/Matchday.tsx`

**Purpose.** Stakes, assistant-control alert, table & form, media quotes, opponent knowledge.

**Current structure.** mday-stage with three bd-panels.

**Main actions**
- Read

**Strengths**
- Narrative framing of the match

**Weaknesses**
- Text heavy

**Links:** MDY-01

**Desktop:** - **Mobile:** Stacks.

**Redesign opportunities**
- Stakes meter

##### MDY-01b · Confirm dialog "Kontrollera matchtruppen"

*Route:* `/career/match-preview` · *Kind:* modal · *Importance:* occasional · *Parent:* MDY-01

*Components:* `components/game/ConfirmDialog.tsx`

**Purpose.** Shown when squad has warnings (e.g. NO_SUBSTITUTES) before LIVE or QUICK start.

**Current structure.** ConfirmDialog (warning tone) with counts and warning list.

**Main actions**
- Confirm start
- Cancel

**Strengths**
- Prevents accidental bad starts

**Weaknesses**
- -

**Links:** MDY-01

**Desktop:** - **Mobile:** Stacks.

**Redesign opportunities**
- Fix-in-place actions inside dialog

##### MDY-01c · Blocking / lineup error alerts

*Route:* `/career/match-preview` · *Kind:* state · *Importance:* occasional · *Parent:* MDY-01

*Components:* `app/career/match-preview/page.tsx`

**Purpose.** role=alert banners with link to Taktik when lineup invalid or squad blocking.

**Current structure.** hm-panel-body alerts.

**Main actions**
- Rätta matchtruppen i Taktik →

**Strengths**
- Actionable

**Weaknesses**
- Above heading; plain styling

**Links:** MDY-01

**Desktop:** - **Mobile:** Stacks.

**Redesign opportunities**
- Inline checklist

##### MDY-01d · OpponentScoutingPanel (compact)

*Route:* `/career/match-preview` · *Kind:* panel · *Importance:* frequent · *Parent:* MDY-01

*Components:* `components/scouting/OpponentScoutingPanel.tsx`

**Purpose.** Order opponent scouting report (choose analyst/scout); report with confidence per topic, observed strengths/weaknesses, recommendations, link to plan.

**Current structure.** hm-plan-section.

**Main actions**
- Beställ scoutingrapport
- Anpassa matchplanen →

**Strengths**
- Confidence labels per topic

**Weaknesses**
- Same panel also on analysis/opponent

**Links:** MDY-01

**Desktop:** - **Mobile:** Stacks.

**Redesign opportunities**
- Threat cards

##### MDY-01e · Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare"

*Route:* `/career/match-preview` · *Kind:* panel · *Importance:* core · *Parent:* MDY-01

*Components:* `app/career/match-preview/page.tsx`

**Purpose.** Starting seven slot cards, plan summary, low-readiness list; unavailable list with status badge.

**Current structure.** Two Panels in auto-fit grid.

**Main actions**
- Taktiktavla →
- Open player

**Strengths**
- Readiness list

**Weaknesses**
- Raw enum text; slot cards not court-shaped

**Links:** MDY-01

**Desktop:** - **Mobile:** Stacks.

**Redesign opportunities**
- Court lineup graphic

##### MDY-01f · States: season complete / no fixture

*Route:* `/career/match-preview` · *Kind:* state · *Importance:* rare · *Parent:* MDY-01

*Components:* `app/career/match-preview/page.tsx`

**Purpose.** "Säsongen är avslutad…" / "Ingen kommande match schemalagd."

**Current structure.** Muted panel.

**Main actions**
- None

**Strengths**
- -

**Weaknesses**
- No CTA

**Links:** MDY-01

**Desktop:** - **Mobile:** Stacks.

**Redesign opportunities**
- CTA to season review / schedule

#### MDY-02 · Live match (Match Center)

*Route:* `/career/match-day/[fixtureId][?finish=1]` · *Kind:* page · *Importance:* core

*Components:* `app/career/match-day/[fixtureId]/page.tsx`, `components/ProductionMatchView.tsx`, `components/matchCenter/MatchCenter.tsx (LiveMatchCenter, MatchCenterSurface, KeyMoment, Commentary)`, `components/matchCenter/WorkspaceViews.tsx`, `components/matchCenter/TimeoutOverlay.tsx`, `components/matchCenter/TacticalCourt.tsx`, `components/game/LiveCoachPanel.tsx`, `components/game/CoachingChoices.tsx`, `components/matchCenter/match-center.css`, `lib/matchCenter/model.ts`, `lib/matchCenter/workspace.ts`

**Purpose.** Play the match: event-driven text/key-moment match center with tactical snapshots, live coaching (tactics, timeouts, substitutions), half-time and full-time decisions, optional continuous 2D court; also serves as archive replay when no live session.

**Current structure.** Optional stakes banner; MatchCenterSurface: header (crests, score, period, clock, manpower line "6v6 jämnt"/"6v5 övertag"/"7 mot 6", suspensions), skip link, controls bar, sticky workspace nav with compact score, tabpanel per view, coach aside (LiveCoachPanel) on the side, details "Experimental 2D" with SVG LiveCourt.

**Main actions**
- Spela / Pausa / Starta andra halvlek / Återuppta efter timeout
- Hastighet (Realtid 1×, Normal 2×, Snabb 10×, Mycket snabb 20×, Express 48×, Turbo 64×, Maximal 86×)
- Nästa viktiga händelse
- Nyckelhändelser på/av
- Spela till slut (quick finish)
- Slutför match och öppna rapport
- Switch view (Översikt / Nyckelögonblick / Spelare / Statistik; arrow-key tablist)
- Change tactics live
- Call timeout
- Substitute (out → in)
- Assistentbyten på/av
- Open Experimental 2D

**Strengths**
- Event-first presentation with key moments and tactical snapshots (before/situation/shot) is distinctive
- Accessible tablist (keyboard Home/End/Arrows), skip link to controls, reduced-motion rules
- Named speeds tied to real wall-clock durations
- Clear manpower state language
- Same surface reused for archive replay (consistency)

**Weaknesses**
- Decision controls are split between the controls bar (play/speed), LiveCoachPanel (tactics/timeout/subs), and TimeoutOverlay (instructions + subs again)
- 2D court is hidden behind an English "Experimental 2D" details element
- Substitution requires two-step button selection in a side panel; no on-court drag
- Quick-finish and error states are bare paragraphs
- Very dense dark UI with custom css (778 lines) separate from the rest of the design system

**Links:** /career/match-report/[fixtureId], /career/match-preview, /career

**Desktop:** Live layout: view panel + coach aside. **Mobile:** match-center.css ≤1000px single column (header compacts); ≤900px overview/player/stat workspaces single column; coaching.css ≤1050px live layout single column, out-list 4-col.

**Redesign opportunities**
- Unified "bench" decision dock (tactics, timeout, subs) always visible
- Promote 2D/court view as a first-class view tab with momentum overlay
- Live momentum graph + energy bars for on-court players
- Half-time as a dedicated briefing screen with stats and suggested changes

##### MDY-02a · Header / scoreboard & manpower

*Route:* `/career/match-day/[fixtureId]` · *Kind:* panel · *Importance:* core · *Parent:* MDY-02

*Components:* `components/matchCenter/MatchCenter.tsx`

**Purpose.** Crests, score, competition label, period & remaining time, manpower line, suspensions/disqualifications per club.

**Current structure.** mc-header.

**Main actions**
- Read

**Strengths**
- Handball-specific manpower state

**Weaknesses**
- Timeouts remaining not prominent

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Timeout & suspension timers as visual pips

##### MDY-02b · Controls bar

*Route:* `/career/match-day/[fixtureId]` · *Kind:* panel · *Importance:* core · *Parent:* MDY-02

*Components:* `components/ProductionMatchView.tsx`

**Purpose.** Play/pause/resume/second half, speed select, next key event, key-events toggle, play to end, finalise.

**Current structure.** mc-controls row of buttons + select.

**Main actions**
- See MDY-02 actions

**Strengths**
- Labels change with state

**Weaknesses**
- Many equal-weight buttons

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Single transport control

##### MDY-02c · View "Översikt"

*Route:* `/career/match-day/[fixtureId]` · *Kind:* tab · *Importance:* core · *Parent:* MDY-02

*Components:* `components/matchCenter/MatchCenter.tsx`, `components/matchCenter/TacticalCourt.tsx`

**Purpose.** Key moment card with tactical snapshot stepper (TacticalCourt, närbild/helplan), commentary feed ("Från planen · Direktflöde"), match summary, "Matchen i siffror" table, "Matchens profiler", "Händelser att återvända till"; TimeoutOverlay and decision heading appear here.

**Current structure.** mc-overview-grid two columns.

**Main actions**
- Step snapshots
- Toggle full court
- Toggle important events
- Open moment/player

**Strengths**
- Rich narrative + tactical illustration

**Weaknesses**
- Very busy; many sub-sections

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Prioritise live state over review content

##### MDY-02d · View "Nyckelögonblick"

*Route:* `/career/match-day/[fixtureId]` · *Kind:* tab · *Importance:* frequent · *Parent:* MDY-02

*Components:* `components/matchCenter/MatchCenter.tsx`, `lib/matchCenter/workspace.ts`

**Purpose.** Filterable key moments (Alla, Mål, Räddningar, Genombrott, Omställning, 7m, Försvar) with KeyMoment detail.

**Current structure.** Filter chips + moment list + detail.

**Main actions**
- Filter
- Open moment

**Strengths**
- Filters hidden if no matching moments

**Weaknesses**
- -

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Timeline scrubber

##### MDY-02e · View "Spelare"

*Route:* `/career/match-day/[fixtureId]` · *Kind:* tab · *Importance:* frequent · *Parent:* MDY-02

*Components:* `components/matchCenter/WorkspaceViews.tsx`

**Purpose.** Per-team player performance table sortable by Position, Betyg, Mål, Skott, Minuter, Energi; player focus with related moments.

**Current structure.** mc-player-workspace.

**Main actions**
- Switch team
- Sort
- Select player

**Strengths**
- Live energy per player

**Weaknesses**
- -

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Energy bars + rating sparkline

##### MDY-02f · View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling)

*Route:* `/career/match-day/[fixtureId]` · *Kind:* tab · *Importance:* frequent · *Parent:* MDY-02

*Components:* `components/matchCenter/WorkspaceViews.tsx`, `components/matchCenter/TacticalCourt.tsx (ShotMap)`

**Purpose.** Team stats with definitions (Mål, Skott, Mål/skott, Räddningar, Räddningsprocent, Bollförluster, Tekniska fel, Frikast, 2 min, Omställningsmål), goals by registered position, shot map with outcome filter, keeper categories, score-flow SVG.

**Current structure.** mc-analysis-nav + panels.

**Main actions**
- Switch section
- Filter shots by team/player/outcome

**Strengths**
- Shot map with registered origins; metric definitions

**Weaknesses**
- No shot-quality / xG-like measure

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Heat zones, goal-mouth placement map

##### MDY-02g · Coach aside "Dina matchbeslut" (LiveCoachPanel)

*Route:* `/career/match-day/[fixtureId]` · *Kind:* panel · *Importance:* core · *Parent:* MDY-02

*Components:* `components/game/LiveCoachPanel.tsx`, `components/game/CoachingChoices.tsx`

**Purpose.** Possession indicator, CoachingChoices (defence, aggression, tempo, attack, rotation), timeout block (1 per half, reasons when disabled), substitutions (choose out on court → eligible in from bench of same kind), Assistentbyten toggle, bench & availability details.

**Current structure.** aside.game-sideline sections.

**Main actions**
- Change tactic
- Ta timeout
- Byt ut / Byt in
- Toggle assistant subs

**Strengths**
- Explains why timeout is unavailable
- Substitution respects suspensions/exit-required

**Weaknesses**
- No energy-sorted bench; energy only as text per button

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Bench dock with energy bars

##### MDY-02h · TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout)

*Route:* `/career/match-day/[fixtureId]` · *Kind:* overlay · *Importance:* frequent · *Parent:* MDY-02

*Components:* `components/matchCenter/TimeoutOverlay.tsx`

**Purpose.** Non-modal dialog (role=dialog, aria-modal=false) during timeouts: contextual team directives based on score margin/period (e.g. "Hög press & snabb omställning", "Täta bakåt & kontrollerat tempo", "Extraspela 7 mot 6") with effect/trade-off/duration, tactical base settings, on-court players with substitution picker, assistant notice, resume banner.

**Current structure.** mc-timeout-overlay inside Overview with inline-styled banners.

**Main actions**
- Choose directive
- Adjust tactics
- Substitute
- Resume

**Strengths**
- Best decision copy in the game: intended effect, trade-off, duration

**Weaknesses**
- Duplicates LiveCoachPanel substitutions and tactics
- Inline styles

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Make this the model for all coaching decisions

##### MDY-02i · Half-time state

*Route:* `/career/match-day/[fixtureId]` · *Kind:* state · *Importance:* frequent · *Parent:* MDY-02

*Components:* `components/matchCenter/MatchCenter.tsx`, `components/ProductionMatchView.tsx`

**Purpose.** Session pausedAtHalf: view forced to Översikt, decision heading "Nästa halvlek börjar med ditt beslut.", primary button "Starta andra halvlek".

**Current structure.** mc-decision-heading role=status.

**Main actions**
- Adjust tactics/subs
- Starta andra halvlek

**Strengths**
- Explicit pause for decisions

**Weaknesses**
- No dedicated half-time summary (first-half stats vs plan, energy)

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Half-time briefing screen

##### MDY-02j · Full-time state

*Route:* `/career/match-day/[fixtureId]` · *Kind:* state · *Importance:* core · *Parent:* MDY-02

*Components:* `components/ProductionMatchView.tsx`

**Purpose.** Reviewing mode: summary headline (win/draw/loss story), coach aside hidden, button "Slutför match och öppna rapport".

**Current structure.** Same surface in review mode.

**Main actions**
- Slutför match och öppna rapport

**Strengths**
- Smooth hand-off to report

**Weaknesses**
- Report then re-renders much of the same content (ANL-01)

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Merge full-time and report into one post-match flow

##### MDY-02k · Assistant-in-control state

*Route:* `/career/match-day/[fixtureId]` · *Kind:* state · *Importance:* rare · *Parent:* MDY-02

*Components:* `components/ProductionMatchView.tsx`

**Purpose.** When manager is suspended: banner and "{name} leder laget" box replaces coach panel; manager can only watch.

**Current structure.** mday-control status box.

**Main actions**
- Watch

**Strengths**
- Rules made explicit

**Weaknesses**
- -

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.


##### MDY-02l · Experimental 2D court (details)

*Route:* `/career/match-day/[fixtureId]` · *Kind:* panel · *Importance:* occasional · *Parent:* MDY-02

*Components:* `components/ProductionMatchView.tsx (Court, LiveCourt)`

**Purpose.** Optional continuous SVG court (players as numbered circles in club colours, ball) driven by frame buffer; also in archive replay.

**Current structure.** <details><summary>Experimental 2D</summary>.

**Main actions**
- Open/close

**Strengths**
- Live positional data exists for a real visual

**Weaknesses**
- English label, hidden by default in live match; minimal graphics

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- First-class 2D view with trails and tactical shape

##### MDY-02m · Quick finish / no session / archive fallback states

*Route:* `/career/match-day/[fixtureId]` · *Kind:* state · *Importance:* occasional · *Parent:* MDY-02

*Components:* `components/ProductionMatchView.tsx`

**Purpose.** ?finish=1 auto-simulates to full time then redirects to report; without session: loading "Laddar matchreprisen…", error + "Försök igen", archive replay with "Matchrapport"/"Fortsätt karriären", or text + "Öppna match".

**Current structure.** Plain paragraphs and buttons.

**Main actions**
- Försök igen
- Matchrapport
- Fortsätt karriären

**Strengths**
- Resilient fallbacks

**Weaknesses**
- Unstyled; quick finish has no progress visual

**Links:** MDY-02

**Desktop:** Inside match center. **Mobile:** Single column ≤900–1000px.

**Redesign opportunities**
- Simulation progress screen

#### MDY-03 · Match Center (legacy redirect)

*Route:* `/career/match-center` · *Kind:* state · *Importance:* internal

*Components:* `app/career/match-center/page.tsx`

**Purpose.** Server redirect to /career/matches (which client-redirects to /career/schedule).

**Current structure.** redirect().

**Main actions**
- None

**Strengths**
- -

**Weaknesses**
- Double redirect chain

**Links:** CMP-03

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Redirect directly to schedule or remove

#### MDY-04 · Matchrepriser (match-2d replays)

*Route:* `/career/match-2d` · *Kind:* page · *Importance:* rare

*Components:* `app/career/match-2d/page.tsx`, `components/ProductionMatchView.tsx (ArchiveReplay)`, `lib/save/useMatchArchive.ts`

**Purpose.** Pick any archived match and replay it (match center + experimental 2D shown by default); continue an ongoing match.

**Current structure.** Bare hm-grid: heading, select of archived matches (date · score), then ArchiveReplay.

**Main actions**
- Fortsätt pågående match
- Select archived match
- Försök igen

**Strengths**
- Archive replay with 2D

**Weaknesses**
- Source file has broken encoding: every Swedish character renders as "?" (e.g. "Matchrepriser ? nyckel?gonblick", "Forts?tt p?g?ende match", "V?lj matchrepris")
- Not in main navigation (navigation.ts only lists it as an owned prefix) – effectively orphaned
- Unstyled select page

**Links:** /career/match-day/[fixtureId]

**Desktop:** Plain. **Mobile:** Plain.

**Redesign opportunities**
- Fold into match report / history as "Repris"; fix encoding

### ANL — Match report & analysis

#### ANL-01 · Matchrapport

*Route:* `/career/match-report/[fixtureId]` · *Kind:* page · *Importance:* core

*Components:* `app/career/match-report/[fixtureId]/page.tsx`, `components/ProductionMatchView.tsx (ArchiveReplay)`, `components/matchCenter/MatchCenter.tsx (ArchivedMatchCenter)`, `components/matchday/Matchday.tsx (MatchAftermathPanel, MatchFlow)`, `lib/save/useMatchArchive.ts`

**Purpose.** Post-match: result, performances, decisive moments, stats comparison, aftermath (media headlines, voices, goal-difference flow), press conference entry, playing time & workload, next steps.

**Current structure.** Two variants. Archive variant: PageHeading, full ArchivedMatchCenter (same 4 views as live), HeadToHeadStatsComparison, MatchAftermathPanel, PostMatchPressBanner, action bar (5–6 buttons), open <details> table (Spelare, Minuter, Energi efter match, Matchbelastning, Senaste 7 dagar). Legacy variant (no archive): MatchHero with result, aftermath, "Bästa spelare", "Tabellplacering", "Matchstatistik · Jämförelse", two "spelarbetyg" tables (Mål, Skott, Betyg).

**Main actions**
- ← Schema
- Se matchrepris
- Öppna matchanalys (if latest)
- Tabell & liga → / Svenska Cupen →
- 🎤 Möt pressen → (when open)
- Fortsätt →
- Expand/collapse "Speltid och belastning"
- Försök igen (archive load error)

**Strengths**
- Workload table connects match minutes to the training load model (same unit)
- Aftermath gives narrative closure (media, voices, flow chart)
- Clear next-step CTAs incl. press

**Weaknesses**
- "Se matchrepris" opens /career/match-day/[id] which renders the same ArchiveReplay already on the report page
- Two divergent layouts depending on archive availability
- Action bar has two primary buttons (press + continue)
- Stats comparison rendered twice in archive variant (match center Statistik + HeadToHead panel)

**Links:** /career/schedule, /career/match-day/[id], /career/analysis/last-match, /career/competitions/[id], /career/media/press/[id], /career

**Desktop:** Long single column. **Mobile:** Match center rules ≤900px; tables scroll.

**Redesign opportunities**
- Single post-match story: score → turning points → player ratings → workload consequences → what to change (link to training/tactics)
- Player rating chart and momentum graph as hero

##### ANL-01a · Archived match center (4 views)

*Route:* `/career/match-report/[fixtureId]` · *Kind:* panel · *Importance:* core · *Parent:* ANL-01

*Components:* `components/matchCenter/MatchCenter.tsx`

**Purpose.** Same Översikt / Nyckelögonblick / Spelare / Statistik views as live, read-only, with Experimental 2D details.

**Current structure.** MatchCenterSurface in review mode.

**Main actions**
- Switch views
- Explore moments

**Strengths**
- Consistency with live

**Weaknesses**
- Heavy for a report

**Links:** ANL-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Report-specific summary first

##### ANL-01b · MatchAftermathPanel ("Efter matchen")

*Route:* `/career/match-report/[fixtureId]` · *Kind:* panel · *Importance:* frequent · *Parent:* ANL-01

*Components:* `components/matchday/Matchday.tsx`

**Purpose.** Media headlines ("Rubrikerna"), voices after final whistle, "Målskillnaden minut för minut" SVG flow chart.

**Current structure.** mday-after with bd-panels.

**Main actions**
- Read

**Strengths**
- Emotion + data

**Weaknesses**
- Flow chart small

**Links:** ANL-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Momentum hero chart

##### ANL-01c · Details "Speltid och belastning"

*Route:* `/career/match-report/[fixtureId]` · *Kind:* panel · *Importance:* frequent · *Parent:* ANL-01

*Components:* `app/career/match-report/[fixtureId]/page.tsx`

**Purpose.** Minutes, energy after match, match workload (≈ estimated for GKs), last-7-days load per player who played.

**Current structure.** Open <details> with table.

**Main actions**
- Collapse

**Strengths**
- Bridges match → training

**Weaknesses**
- No link to adjust training load

**Links:** ANL-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Inline "rest next day" actions

##### ANL-01d · Legacy report variant (no archive)

*Route:* `/career/match-report/[fixtureId]` · *Kind:* state · *Importance:* occasional · *Parent:* ANL-01

*Components:* `app/career/match-report/[fixtureId]/page.tsx`

**Purpose.** Fallback when archive missing: MatchHero, best players, table position, stats comparison, rating tables.

**Current structure.** hm-grid of panels.

**Main actions**
- Same nav buttons

**Strengths**
- Works for simulated/quick matches

**Weaknesses**
- Different look from archive variant

**Links:** ANL-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Unify

##### ANL-01e · Error / no report states

*Route:* `/career/match-report/[fixtureId]` · *Kind:* state · *Importance:* rare · *Parent:* ANL-01

*Components:* `app/career/match-report/[fixtureId]/page.tsx`

**Purpose.** "Den här matchen saknar en rapport.", archive load error with "Försök igen".

**Current structure.** Plain panel/alert.

**Main actions**
- Försök igen

**Strengths**
- -

**Weaknesses**
- No navigation out

**Links:** ANL-01

**Desktop:** - **Mobile:** -

**Redesign opportunities**
- Back links

##### ANL-01f · PostMatchPressBanner

*Route:* `/career/match-report/[fixtureId]` · *Kind:* panel · *Importance:* occasional · *Parent:* ANL-01

*Components:* `app/career/match-report/[fixtureId]/page.tsx`

**Purpose.** Entry to post-match press conference (media domain owned by part A).

**Current structure.** Banner.

**Main actions**
- Möt pressen

**Strengths**
- Contextual

**Weaknesses**
- -

**Links:** ANL-01

**Desktop:** - **Mobile:** -


#### ANL-02 · Matchanalys – Översikt

*Route:* `/career/analysis` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/analysis/layout.tsx`, `app/career/analysis/page.tsx`, `lib/analysis/viewModels.ts`, `components/analysis/EvidenceLists.tsx`, `components/game/Secondary.tsx`

**Purpose.** Analysis hub: next opponent hero, last match result, own form (last five), observed patterns; tabs to opponent / our team / last match.

**Current structure.** Layout: SectionScene (crest, actions Matchplan) + hm-tabs links. Overview: split main (MatchHero next, Panel "Senaste matchen") + rail ("Vårt lag · senaste fem" form dots + metrics, "Observerade mönster", note "Från match till beslut").

**Main actions**
- Switch analysis tab (Översikt / Motståndaren / Vårt lag / Senaste matchen)
- Analysera motståndaren →
- Matchförberedelse →
- Matchanalys →
- Arbeta med matchplanen / Planera veckan

**Strengths**
- Evidence model: Evidence<T> ok/missing with explicit MissingDataNote; patterns vs interpretations separated
- Route-based tabs (deep-linkable)

**Weaknesses**
- Thin overview that duplicates match preview and report entry points
- Patterns and interpretations are plain text lists – no charts despite numeric basis

**Links:** /career/tactics, /career/training, /career/match-preview, /career/analysis/*

**Desktop:** Split. **Mobile:** secondary.css ≤1200/760/720 stacks.

**Redesign opportunities**
- Analysis dashboard with trend charts (goals for/against, shooting %, save %) and "what changed" cards

##### ANL-02a · Analysis tab bar (layout)

*Route:* `/career/analysis/*` · *Kind:* tab · *Importance:* frequent · *Parent:* ANL-02

*Components:* `app/career/analysis/layout.tsx`

**Purpose.** Four route tabs.

**Current structure.** nav.hm-tabs with aria-current.

**Main actions**
- Navigate

**Strengths**
- Proper aria-current

**Weaknesses**
- -

**Links:** ANL-02, ANL-03, ANL-04, ANL-05

**Desktop:** - **Mobile:** Wraps.


#### ANL-03 · Matchanalys – Motståndaren

*Route:* `/career/analysis/opponent` · *Kind:* page · *Importance:* frequent

*Components:* `app/career/analysis/opponent/page.tsx`, `components/scouting/OpponentScoutingPanel.tsx`, `lib/analysis/viewModels.ts`

**Purpose.** Next opponent: scouting report ordering, recent matches, attack & defence metrics over last five, league position, form, patterns, interpretation.

**Current structure.** Main: MatchHero; OpponentScoutingPanel; Panel "Motståndarens senaste matcher" (6 columns); two metric panels "Anfall · senaste fem" (Mål/match, Skott/match, Skotteffektivitet, Bollförluster/match, 7m-effektivitet) and "Försvar · senaste fem" (Insläppta/match, Räddningsprocent, Räddningar/match, Utvisningar/match). Rail: club facts, patterns, interpretation, note.

**Main actions**
- Beställ scoutingrapport
- Öppna matchplan →
- Matchförberedelse →
- Klubb & trupp →

**Strengths**
- Explicit statement of what is NOT in the data (no individual opponent production)

**Weaknesses**
- No comparison to our own numbers side by side
- Empty state when no next fixture only links to history

**Links:** /career/tactics, /career/match-preview, /career/clubs/[id], /career/match-report/[id]

**Desktop:** Split. **Mobile:** Stacks.

**Redesign opportunities**
- Mirror chart us vs them per metric; tactical recommendation linking to specific plan settings

#### ANL-04 · Matchanalys – Vårt lag

*Route:* `/career/analysis/our-team` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/analysis/our-team/page.tsx`, `lib/analysis/viewModels.ts`

**Purpose.** Own team over last five or season: form, goal difference, attack & defence metrics, outfield and goalkeeper season tables, patterns.

**Current structure.** Panel with window toggle + form dots + 4 metrics; two metric panels; "Säsongens utespelare" (6 columns) and "Säsongens målvakter" (6 columns) tables; rail patterns, interpretation, note.

**Main actions**
- Toggle window (Senaste fem / Hela säsongen)
- Matchplan → / Träningsvecka → / Truppen →

**Strengths**
- Explains which numbers the window affects

**Weaknesses**
- Player tables ignore the window toggle (always season) – potentially confusing
- Numbers only

**Links:** /career/squad, /career/tactics, /career/training

**Desktop:** Split. **Mobile:** Stacks.

**Redesign opportunities**
- Rolling trend lines; per-player contribution chart

#### ANL-05 · Matchanalys – Senaste matchen

*Route:* `/career/analysis/last-match` · *Kind:* page · *Importance:* occasional

*Components:* `app/career/analysis/last-match/page.tsx`, `components/analysis/presentation.ts`, `components/game/Identity.tsx (Scoreboard)`

**Purpose.** Deep dive on the latest own match: team match facts, player contributions, filterable event timeline, halves split, scoring runs, patterns, interpretation.

**Current structure.** Scoreboard; main: "Lagens matchfakta" (mått × vårt lag × motstånd), "Spelarnas bidrag" (Mål, Skott, Betyg), "Matchhändelser" timeline with filter buttons; rail: "Halvlekar" table, "Mål i följd" (scoring runs), patterns, "Bedömning".

**Main actions**
- Filter events (Alla, Mål, Räddningar, Bollförluster, 2 min, 7m)
- Matchrapport & repris →
- Open players/clubs

**Strengths**
- Scoring runs and half split are insightful handball analytics

**Weaknesses**
- Largely duplicates match report / match center statistics for the same match
- Only the latest match (no picker)

**Links:** /career/match-report/[id], /career/schedule, /career/history

**Desktop:** Split. **Mobile:** Stacks.

**Redesign opportunities**
- Merge into report as "Analys" tab; allow any match

## Key data available for presentation

All paths relative to `apps/game`. "Shown as" describes today's UI; the gap between the stored scale and what is shown is where a redesign can add the most.

### Player ability & attributes
| Data | Scale / range | Source | Shown today as |
|---|---|---|---|
| Current ability (CA), potential ability (PA) | 1–200 (global) | `lib/rating/types.ts` (§ CA/PA), `lib/gameWorld/gameplayRatingSnapshot.ts` (`ca`, `pa`, `caSource`) | 1–5 stars only (`abilityStarsFromCA` / `potentialStarsFromPA` = ceil(x/40), `lib/development/types.ts`). Raw value deliberately never shown. |
| Outcourt attributes | 56 attributes, 1–20, in 6 families (TECHNICAL 10, PERCEPTION_DECISION 8, TACTICAL 8, DEFENSIVE 10, PHYSICAL 11, MENTAL 9) | `lib/rating/types.ts` `OUTCOURT_ATTRIBUTE_FAMILIES`; labels `lib/rating/attributeVocabulary.ts` | Own players: radar of family averages + bar per attribute (SQD-02j). |
| Goalkeeper attributes | 21 attributes, 1–20, 4 families (SHOT_STOPPING 10, PERCEPTION_DECISION 4, TRANSITION 3, MENTAL 4) | `lib/rating/types.ts` `GOALKEEPER_ATTRIBUTE_FAMILIES` | Same panel, GK branch. |
| Attribute origin | EVIDENCE_BACKED / DERIVED / GENERATED_PRIOR / EDITOR_OVERRIDE | `components/GameplayProfilePanels.tsx` types | Small coloured dot + tooltip. |
| Role proficiencies | attack & defence tactical roles per player | `GameplayRatingRow.attackRoleProficiencies/defenceRoleProficiencies`, `lib/rating/presentation.ts` | Comma text list (SQD-02k). |
| Primary / secondary position | V6, V9, M9, M6, H9, H6, MV | `lib/game-data` `PlayerMock` | Mini-court highlights primary only. |
| Development events | date, attribute, previousValue → newValue, sourceSummary (history ≤20) + per-attribute stimulus/progress | `lib/development/types.ts` `PlayerDevelopmentEvent`, `PlayerDevelopmentState` | Text list; training table prints raw attribute key. |
| Individual focus | NORMAL, TECHNICAL, ATTACKING_DECISIONS, DEFENCE, PHYSICAL, MENTAL, GOALKEEPER | `lib/development/types.ts` | Select (TRN-01c), label (SQD-02d). |

### Knowledge & uncertainty (external players and staff)
| Data | Scale | Source | Shown as |
|---|---|---|---|
| Knowledge % | 0–100; tiers MINIMAL <25, LOW 25–49, MEDIUM 50–74, HIGH ≥75 | `lib/knowledge/types.ts`, `lib/knowledge/knowledgeIntegration.ts` | KnowledgeMeter bar, tier badge text. |
| Visible view | abilityRange & potentialRange (star ranges 1–5), archetype, strengths[], weaknesses[] | `lib/knowledge/playerVisibility.ts` `PlayerVisibleView` | "2–4 ★" text, bullet lists. |
| Scout report | confidencePct, marketValueRange {min,max}, recommendation text, report history | `lib/knowledge/scoutReportVisibility.ts` `ScoutReportView`, `lib/career/scouting.ts` | Text rows (SQD-02m). |
| Staff knowledge | 0–100; attributes become ranges below 90 % | `app/career/staff/[staffId]`, `components/staff/StaffInsight.tsx` | MeterBar + ranges. |

### Condition, workload, morale
| Data | Scale | Source | Shown as |
|---|---|---|---|
| Energy (day form) | 0–100 | `lib/training/types.ts` `PlayerPhysicalState.currentEnergy`; `lib/career/management.ts` `squadEnergy` | %, badge (Pigg ≥80 / Något sliten ≥55 / Trött), `<meter>`. |
| Match fitness (sharpness) | 0–100; bands SHARP ≥85, GOOD ≥68, BUILDING ≥50, LACKING; affects kickoff attributes (full effect ≥80) | `lib/players/matchFitness.ts` | %, band label. |
| Recent load (decaying) | unbounded magnitude | `PlayerPhysicalState.recentLoad` | Bare number (TRN-01c). |
| Workload ledger | per-entry load, source (match/training), quality (exact/estimated), minutes; 7- and 28-day windows | `lib/training/workloadLedger.ts` `WorkloadEntry`, `workloadWindow` | "Belastning 7 d" number, match report table. |
| Readiness summary | readiness (0–100), week window total/matches/training, trend RISING/STABLE/FALLING, outlook GOOD/NORMAL/REDUCED + reasons | `lib/training/readinessSummary.ts` | Squad physical tab columns + tooltip, preview warnings. |
| Training load setting | FULL, REDUCED, RECOVERY_ONLY, REST | `lib/training/types.ts` | Select. |
| Training session | 12 types, intensity LOW/NORMAL/HIGH/VERY_HIGH (energy ×0.6–×1.8), duration SHORT/NORMAL/LONG (×0.7–×1.3), target, coach; per-day results with pre/post energy per player | `lib/training/types.ts`, `components/manager/TrainingFeedback.tsx` | Selects; collapsed table. |
| Morale | 0–100, neutral 70; target %, factor list with ± points; effect on match ≤ ±3 % | `lib/players/morale.ts`, `components/players/PlayerDynamicsPanel.tsx` | Badge (≥70 good, ≥55 ok, ≥40 low), MeterBar + factor chips. |
| Intentions, promises, concerns, transfer requests | kinds, deadlines, status ACTIVE/KEPT/BROKEN | player dynamics (`dynamicsOf`, `activePromises`) | Decision cards/lists. |
| Injuries | type, severity, rehab phase, rehabProgress 0–1, expectedReturnDate, history | `lib/medical/types.ts` `ActiveInjury`, `lib/medical/labels.ts` | Text rows. |
| Availability | AVAILABLE, INJURED, SUSPENDED, RECOVERING, LIMITED, ON_PLACEMENT, NATIONAL_TEAM | `lib/career/playerStatus.ts` | Chips/badges. |

### Performance & match data
| Data | Scale | Source | Shown as |
|---|---|---|---|
| Season stats | appearances, starts, goals, shots, saves, shotsFaced, ratingSum → average rating | `lib/career/types.ts` `PlayerSeasonStats`, `averageRating` | Tables, % efficiency. |
| Match rating | 1–10 (clamped; base 6 + 0.15/goal + 0.07/save − 0.08/missed shot ) | `lib/career/productionMatch.ts` (player contribution builder) | One decimal number. |
| Form history | last 5 appearances or fixtures (incl. DNP) | `lib/career/playerForm.ts` | Sparkline. |
| Live/archived player rows | minutes, energy, population (COURT/BENCH/SUSPENDED/DISQUALIFIED), goals, shots, saves, shotsFaced, rating, suspensions, technical violations | `lib/matchCenter/model.ts` `PlayerRow` | Sortable table. |
| Shot facts | team, player, keeper, tick/timestamp, kind (incl. BREAKTHROUGH, SEVEN_METRE), phase (incl. TRANSITION), origin {x,y}, outcome GOAL/SAVE/BLOCK/MISS/PENDING | `lib/matchCenter/model.ts` `ShotFact` | Shot map SVG, goals-by-position. **No xG/shot-quality metric exists** in lib or engine output. |
| Match model | status PREMATCH/LIVE/PAUSED/TIMEOUT/HALFTIME/FULLTIME, period, clock/remaining, manpower per team, timeouts per team, free throws, trends, alerts, key moments, tactical snapshots (positions, pass/shot arrows) | `lib/matchCenter/model.ts` `MatchCenterModel`, `TacticalSnapshot`, `SnapshotArrow` | Header, key-moment stepper, commentary. |
| Continuous positions | frame buffer [tick, clock, period, score h/a, ball x/y, (person,x,y)…] | `components/ProductionMatchView.tsx` (`frameAt`), archives via `lib/save/useMatchArchive.ts` | Experimental 2D court. |
| Team aggregates & analysis | goals/shots/turnovers/7m conversion/save %/2-min per match, half split, scoring runs, observed patterns, interpretations, Evidence<T> with missing-data states | `lib/analysis/types.ts`, `lib/analysis/metrics.ts`, `halfSplit.ts`, `scoringRuns.ts`, `patterns.ts`, `interpretations.ts` | Key-value rows, lists. |
| Score flow | goal difference per minute | `components/matchday/Matchday.tsx` `MatchFlow`, `WorkspaceViews.tsx` `ScoreFlow` | Small SVG line. |
| Match speeds | 1×, 2×, 10×, 20×, 48×, 64×, 86× (60 min → 42 s) | `lib/matchCenter/model.ts` `MATCH_SPEED_OPTIONS` | Select. |

### Contracts, money, transfers, staff
| Data | Scale | Source | Shown as |
|---|---|---|---|
| Contract | owning club, wage €/month, end date, status (EXPIRING, EXPIRING_SOON, FREE_AGENT…) | `lib/economy/contractIntegration.ts`, `lib/economy/labels.ts` | Rows, countdown. |
| Market value | exact € (own) / knowledge-gated range (external) | `getPlayerMarketValueEur`, `ScoutReportView.marketValueRange` | Money text. |
| Training compensation | total + per-club share/years | `lib/economy/trainingCompensationIntegration.ts` | Rows. |
| Renewal talk | demand €/month, expected role, demand factors (±%), rounds, answerOn, cooldown | `components/ContractRenewal.tsx` (talk helpers) | Demand list. |
| Transfer negotiation | stages CLUB → PLAYER → COMPLETED/closed; fee, wage share %, loan end, wage, years, bonus, promised role, rounds with responses; deadline urgency | `components/transfers/NegotiationRoom.tsx`, `lib/career` transfer status helpers | Stepper, timeline, forms. |
| Squad role tiers | SQUAD_STATUS_TIERS (key → rotation etc.) | `lib/career/squadStatus.ts` | Select. |
| Staff | 1–20 staff attributes (`lib/staff/types.ts` `STAFF_ATTRIBUTES`), role suitability 1–20 → stars ceil(x/4) with verbal labels (`lib/staff/presentation.ts`), ambition profile, employment (wage, end), staff cost vs board limit, delegation modes MANAGER/ADVISE/DELEGATE | `lib/staff/*` | Stars, MeterBar, matrix. |

**Most valuable to visualise:** attribute families (1–20) with development deltas; CA/PA progression (1–200 hidden behind stars — consider a non-numeric curve/band); knowledge-gated ranges as error bars that tighten; energy × match fitness × 7/28-day load ratio as a readiness heat-strip; morale with factor waterfall; match momentum (score flow) + shot map + key-moment snapshots; contract-end timeline vs payroll budget.

## Cross-surface flows

### Player → scouting → shortlist → offer → contract
1. Discovery: `/career/players` (SQD-03) table, `/career/scouting` recommendations/discoveries (REC-01a/f), `/career/transfers` opportunities (REC-03b), `/career/competitions/[id]?tab=clubs` → club page (part A). Three separate market tables with different columns (SQD-03 has no quality column; REC-02 has ability/potential/value ranges; REC-03 has value range + interest).
2. Learn more: player profile `/career/squad/[id]` (SQD-02) → ScoutReportPanel "Scouta spelare" → `/career/scouting?target=` (REC-01c pre-selected) → choose scout → assignment runs in calendar → report appears in "Färdiga rapporter" → "Öppna rapport" links back to the **profile** (no standalone report view).
3. Shortlist: "+ Kortlista" (SQD-03, SQD-02g, REC-01a, REC-02) = "Bevaka" (REC-03c) = list "Bevakade" (REC-03b) = section "Kortlista" (REC-02a). Same data, two names.
4. Offer: every surface links to `/career/transfers/[playerId]` (REC-04, "the ONE place a negotiation is conducted"); `?deal=LOAN` pre-selects loan. Answers arrive via calendar/inbox; urgent ones surface on Transfer Centre (REC-03 urgent cards) and in the PlayerTransferCard CTA ("Ditt drag · n dagar").
5. Contract: player-stage terms in the negotiation room (wage, years, bonus, promised role) → DealCompletion → profile / squad / tactics. Promise later tracked on PlayerTransferCard ("Hålls" / "Bryts -- höj hans truppstatus") and PlayerDynamicsPanel.
6. Own contracts: `/career/contracts` (SQD-05) or profile Kontrakt tab (SQD-02e) both embed ContractRenewal; squad Kontrakt tab (SQD-01d) links only to profile root.
*Dead ends / friction:* "Öppna rapport" → profile instead of report; scouting page title promises opponent analysis that is not there; negotiation answers require leaving the room to advance time; Compare page has no search across thousands of players; staff hiring uses a parallel but different negotiation UI (STF-02b).

### Training → workload → match
1. Plan week on `/career/training` (TRN-01b) and per-player load/focus (TRN-01c); optionally delegate to assistant (TRN-01a, STF-04).
2. Effects appear only after days execute: energy (TrainingFeedback, collapsed), squad Fysisk status tab (SQD-01c: 7-day load, trend, recovery outlook), training readiness table.
3. Match selection on `/career/tactics` (TRN-02) can overlay energy / suitability / form on the court; match preview (MDY-01) lists low-readiness players (readiness < 70 or reduced outlook) and blocks/warns on squad issues.
4. Live match shows per-player energy in LiveCoachPanel and Spelare view; post-match report (ANL-01c) shows minutes, energy after, match workload and 7-day load.
*Gaps:* no forward-looking projection of how a training plan will leave players on matchday; match-report workload table has no action back into training (e.g. set REST); "Senaste belastning" (TRN-01c), "Belastning 7 d" (SQD-01c) and "Matchbelastning" (ANL-01c) are three different load numbers with different semantics; Training's matchday cell links to `/career/fixtures/[id]` labelled "Matchförberedelse →" but real prep is `/career/match-preview`.

### Match → report → analysis
1. `/career/match-preview` (MDY-01) → STARTA MATCH → `/career/match-day/[id]` (MDY-02) live; or quick result → `?finish=1` auto-sim → report.
2. Full time (MDY-02j) → "Slutför match och öppna rapport" → `/career/match-report/[id]` (ANL-01): archived match center + stats + aftermath + press + workload.
3. From report: "Se matchrepris" → back to `/career/match-day/[id]` (renders the **same** archive replay already on the report – circular); "Öppna matchanalys" (only if latest) → `/career/analysis/last-match` (ANL-05), which re-presents the same facts in another layout; "Fortsätt" → `/career`.
4. Analysis hub (ANL-02..05) feeds back with links to Matchplan and Träningsvecka, but no specific recommended change.
*Dead ends:* `/career/match-2d` (MDY-04) not in navigation and has broken Swedish characters; `/career/match-center` → `/career/matches` → `/career/schedule` double redirect; analysis last-match cannot select older matches; legacy report variant looks different from archive variant.

## Unexamined / uncertain
- **Runtime rendering not verified** — this inventory is from source only; no screenshots were taken, so visual density, colour contrast and actual breakpoint behaviour are inferred from CSS.
- `components/staff/StaffInsight.tsx` (RoleFit, StaffAttributes, StaffImpact), `components/manager/AssistantTrainingPanel.tsx`, `components/transfers/DealCompletion.tsx`, `components/game/CoachingChoices.tsx` and `components/matchPlan/HandballPlanSections.tsx` were skimmed for headings/actions only.
- Tactics page (1665 lines) right-rail panels per court mode (zone editor, 6v5/5v6/7v6 slot editors, defence-exchange editor) were identified by headings, not read line by line.
- Components in `components/matchPlan/` not referenced by any career route: `CourtBoard`, `StartingUnitEditor`, `MatchSquadPanel`, `PlayerInstructionPanel`, `TacticalConfigPanel`, `SpecialPlayPanel`, `SevenVSixPolicyControl` (`MasterCourtDisplay` is used by editor/scenario-lab only). They may be legacy or editor-only; they contain richer per-player instruction concepts (match role, phase usage, playing-time intention) that the career UI no longer exposes.
- `components/court/*` (HandballCourtSvg, CourtGridOverlay, geometry) only confirmed as the tactics court renderer; grid overlay usage not traced.
- `MatchContext` (`components/manager/MatchContext.tsx`), `MatchHero`, `Scoreboard`, `CompetitionHero` in `components/game/Identity.tsx` read only partially.
- Legacy match-report variant body (best players / rating tables / `HeadToHeadStatsComparison`) read at heading level.
- `/career/schedule`, `/career/clubs/[id]`, `/career/history`, `/career/medical`, `/career/calendar`, media/press pages are linked from part-B surfaces but belong to part A and were not inventoried here.
- Whether ConfirmDialog (MDY-01b) is a true modal (focus trap) was not verified; TimeoutOverlay is explicitly `aria-modal="false"`.
- Data-volume behaviour (e.g. size of world player list on Compare selects, Spelarsök pagination) inferred, not measured.
