# HM Experience 2027 — Surface Inventory

> Generated from `docs/experience-2027/inventory/part-a.json` + `part-b.json` by `design-lab/experience-2027/build-data.mjs`.
> Source of truth: the application source in `apps/game` (branch `feat/m6-0-state-hygiene`, commit ca0e85b), inspected read-only.
> Narrative findings, global observations and the "unexamined" lists live in [inventory/part-a.md](inventory/part-a.md) and [inventory/part-b.md](inventory/part-b.md).

**231 surfaces** — 61 pages, 45 tabs, 86 panels, 26 states, 9 modals/drawers/overlays, 4 navigation surfaces.

## Index

| ID | Name | Route | Kind | Importance | Parent |
|---|---|---|---|---|---|
| ENT-01 | Alpha access gate | `* (all routes, root layout)` | overlay | occasional |  |
| ENT-02 | Title screen (Huvudmeny) | `/` | page | frequent |  |
| ENT-03 | New game wizard | `/new-game` | page | frequent |  |
| ENT-03a | Step 1 · Nationer | `/new-game (step 0)` | panel | occasional | ENT-03 |
| ENT-03b | Step 2 · Ligor | `/new-game (step 1)` | panel | occasional | ENT-03 |
| ENT-03c | Step 3 · Databas (summary) | `/new-game (step 2)` | panel | rare | ENT-03 |
| ENT-03d | Step 4 · Klubb | `/new-game (step 3)` | panel | frequent | ENT-03 |
| ENT-03e | Step 5 · Manager | `/new-game (step 4)` | panel | occasional | ENT-03 |
| ENT-03f | Step 6 · Starta (preseason) | `/new-game (step 5)` | panel | frequent | ENT-03 |
| ENT-04 | Load game (Sparade karriärer) | `/load-game` | page | frequent |  |
| ENT-04a | Delete-save inline confirmation | `/load-game` | panel | rare | ENT-04 |
| ENT-04b | Load game: loading / empty / error states | `/load-game` | state | occasional | ENT-04 |
| ENT-05 | Settings (from main menu) | `/settings` | page | occasional |  |
| ENT-06 | Host shell (STARKVIS navbar) | `* (root layout)` | nav | frequent |  |
| ENT-07 | Career shell · sidebar navigation | `/career/* (layout)` | nav | core |  |
| ENT-07a | Mobile nav drawer | `/career/*` | drawer | core | ENT-07 |
| ENT-08 | Career top bar (header) | `/career/*` | nav | core | ENT-07 |
| ENT-08a | Global search results dropdown | `/career/*` | panel | frequent | ENT-08 |
| ENT-08b | Save controls | `/career/*` | panel | frequent | ENT-08 |
| ENT-09 | Context bar (breadcrumb row) | `/career/*` | nav | frequent | ENT-07 |
| ENT-09a | Progression notice (after Continue) | `/career/*` | panel | core | ENT-09 |
| ENT-10 | Continue / advance-day flow | `/career/*` | panel | core | ENT-08 |
| ENT-10a | Continue processing overlay ('Världen går vidare.') | `/career/*` | overlay | core | ENT-10 |
| ENT-11 | Feedback / bug report modal | `* (root layout)` | modal | occasional |  |
| ENT-12 | Career initialization / loading / error screen | `/career (layout) & /new-game` | state | frequent |  |
| ENT-13 | Live-match banner (header subline) | `/career/* (when away from live match)` | state | occasional | ENT-08 |
| DSH-01 | Dashboard · Managerns kontor (Hem) | `/career` | page | core |  |
| DSH-01a | Office hero header | `/career` | panel | core | DSH-01 |
| DSH-01b | Next match hero + league card | `/career` | panel | core | DSH-01 |
| DSH-01c | Season-complete milestone & transition blockers | `/career (seasonComplete)` | state | occasional | DSH-01 |
| DSH-01d | Contextual notices (unemployed / new season) | `/career` | state | occasional | DSH-01 |
| DSH-01e | Laget inför avkast (availability) | `/career` | panel | core | DSH-01 |
| DSH-01f | Utanför planen (contracts & radar) | `/career` | panel | frequent | DSH-01 |
| DSH-01g | Senaste avtrycket (recent results) | `/career` | panel | frequent | DSH-01 |
| DSH-01h | Från klubben (latest news) | `/career` | panel | frequent | DSH-01 |
| DSH-01i | Veckans managerplan (weekly overview) | `/career` | panel | core | DSH-01 |
| DSH-01j | Styrelsen (board card) | `/career` | panel | frequent | DSH-01 |
| DSH-01k | Rivalerna + På andra planer + training note | `/career` | panel | frequent | DSH-01 |
| CLB-01 | Klubbhuset (clubhouse hub) | `/career/klubbhuset` | page | frequent |  |
| CLB-01a | Interactive floorplan + room stage | `/career/klubbhuset` | panel | frequent | CLB-01 |
| CLB-01b | Room cards gallery | `/career/klubbhuset` | panel | frequent | CLB-01 |
| CLB-01c | Identity / Supporters / National team panels | `/career/klubbhuset` | panel | occasional | CLB-01 |
| CLB-02 | Klubb (own club overview) | `/career/club` | page | frequent |  |
| CLB-02a | ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik) | `/career/club, /career/clubs/[clubId]` | tab | frequent | CLB-02 |
| CLB-02b | Economy & partnerships rail | `/career/club` | panel | occasional | CLB-02 |
| CLB-03 | Klubbpartnerskap | `/career/club/partnerships` | page | occasional |  |
| CLB-03a | Partner search & agreement form | `/career/club/partnerships` | panel | occasional | CLB-03 |
| CLB-03b | Placement & international loan panels | `/career/club/partnerships` | panel | rare | CLB-03 |
| CLB-04 | Other club profile | `/career/clubs/[clubId]` | page | frequent |  |
| CLB-04a | Club identity & coach philosophy panels | `/career/clubs/[clubId]` | panel | occasional | CLB-04 |
| CLB-05 | Styrelserummet (Board) | `/career/board` | page | frequent |  |
| CLB-05a | Board verdict hero | `/career/board` | state | frequent | CLB-05 |
| CLB-05b | Recovery-plan & contract-offer decision cards | `/career/board` | panel | occasional | CLB-05 |
| CLB-06 | Finanscentralen (Finance) | `/career/finance` | page | frequent |  |
| CLB-06a | Tab · Översikt | `/career/finance` | tab | frequent | CLB-06 |
| CLB-06b | Tab · Intäkter & kostnader | `/career/finance?tab=flows` | tab | occasional | CLB-06 |
| CLB-06c | Tab · Budget | `/career/finance?tab=budget` | tab | occasional | CLB-06 |
| CLB-06d | Tab · Huvudbok (ledger) | `/career/finance?tab=ledger` | tab | rare | CLB-06 |
| CLB-06e | Tab · Lönekontrakt | `/career/finance?tab=wages` | tab | occasional | CLB-06 |
| CLB-06f | Tab · Prognos | `/career/finance?tab=forecast` | tab | rare | CLB-06 |
| MGR-01 | Karriär (manager career) | `/career/manager` | page | occasional |  |
| MGR-01a | Tab · Profil och historik | `/career/manager` | tab | occasional | MGR-01 |
| MGR-01b | Tab · Jobbmarknaden | `/career/manager?tab=jobs` | tab | occasional | MGR-01 |
| MGR-01c | Dismissed / unemployed hero state | `/career/manager` | state | rare | MGR-01 |
| MGR-02 | Historik | `/career/history` | page | occasional |  |
| MGR-02a | Season selector tabs | `/career/history?season=` | tab | occasional | MGR-02 |
| MGR-03 | Säsongen (season hub) | `/career/season` | page | frequent |  |
| MGR-03a | SM-slutspel / Kval / Cup sections | `/career/season` | panel | occasional | MGR-03 |
| MGR-03b | Season verdict & awards gala | `/career/season` | state | rare | MGR-03 |
| MGR-04 | Momentbiblioteket (moment library) | `/career/moments` | page | internal |  |
| WLD-01 | Inkorg (Inbox) | `/career/inbox` | page | core |  |
| WLD-01a | Inbox filters | `/career/inbox` | panel | frequent | WLD-01 |
| WLD-01b | Message reader + empty states | `/career/inbox?message=` | panel | core | WLD-01 |
| WLD-02 | Mediecentret (Media) | `/career/media` | page | frequent |  |
| WLD-02a | Tab · Nyheter (feed) | `/career/media` | tab | frequent | WLD-02 |
| WLD-02b | Tab · Presskonferenser | `/career/media?tab=press` | tab | frequent | WLD-02 |
| WLD-02c | Tab · Rivaler | `/career/media?tab=rivals` | tab | occasional | WLD-02 |
| WLD-02d | Tab · Disciplin | `/career/media?tab=discipline` | tab | rare | WLD-02 |
| WLD-02e | Tab · Medierna (outlets) | `/career/media?tab=outlets` | tab | rare | WLD-02 |
| WLD-03 | Presskonferens | `/career/media/press/[pressId]` | page | frequent |  |
| WLD-04 | Artikel (story) | `/career/media/story/[storyId]` | page | occasional |  |
| WLD-05 | Kalender | `/career/calendar` | page | frequent |  |
| WLD-06 | Schema (Matcher & resultat) | `/career/schedule` | page | frequent |  |
| WLD-06a | Preseason planner (tabs Träningsmatch / Läger-resa / Turnering) | `/career/schedule` | tab | occasional | WLD-06 |
| WLD-06b | Schedule filter tabs | `/career/schedule` | tab | frequent | WLD-06 |
| MED-01 | Medicinskt & Rehabilitering | `/career/medical` | page | occasional |  |
| MED-01a | Active injuries table / empty scene | `/career/medical` | panel | occasional | MED-01 |
| SYS-01 | Inställningar (in-career settings) | `/career/settings` | page | rare |  |
| SYS-02 | Editor home (dev data editor) | `/editor` | page | internal |  |
| SYS-02a | Editor · players (bulk calibration table) | `/editor/players` | page | internal | SYS-02 |
| SYS-02b | Editor · player detail | `/editor/players/[playerId]` | page | internal | SYS-02 |
| SYS-02c | Editor · rating review roster | `/editor/ratings` | page | internal | SYS-02 |
| SYS-02d | Editor · rating detail | `/editor/ratings/[playerId]` | page | internal | SYS-02 |
| SYS-02e | Editor · court grid calibration | `/editor/court-grid` | page | internal | SYS-02 |
| SYS-03 | Scenario lab (engine labs) | `/scenario-lab` | page | internal |  |
| SYS-03a | Scenario lab · core | `/scenario-lab/core` | page | internal | SYS-03 |
| SYS-03b | Scenario lab · match | `/scenario-lab/match` | page | internal | SYS-03 |
| SYS-04 | Match 2D QA harness | `/match-qa` | page | internal |  |
| SYS-05 | CPU-rekrytering (debug) | `/career/club/cpu-recruitment` | page | internal |  |
| SYS-06 | Editor mode widget (global) | `* (root layout)` | panel | internal |  |
| SQD-01 | Truppen & Omklädningsrummet (squad list) | `/career/squad` | page | core |  |
| SQD-01a | Tab "Översikt" | `/career/squad` | tab | core | SQD-01 |
| SQD-01b | Tab "Prestation" | `/career/squad` | tab | frequent | SQD-01 |
| SQD-01c | Tab "Fysisk status" | `/career/squad` | tab | frequent | SQD-01 |
| SQD-01d | Tab "Kontrakt" | `/career/squad` | tab | occasional | SQD-01 |
| SQD-01e | Selection aside "Spelardossier & jämförelse" | `/career/squad` | panel | occasional | SQD-01 |
| SQD-01f | Panel "Truppens balans" (SquadDepth) | `/career/squad` | panel | frequent | SQD-01 |
| SQD-01g | Empty filter state | `/career/squad` | state | rare | SQD-01 |
| SQD-02 | Spelarprofil (player dossier) | `/career/squad/[playerId]` | page | core |  |
| SQD-02a | Tab "Profil & egenskaper" (overview) | `/career/squad/[playerId]` | tab | core | SQD-02 |
| SQD-02b | Tab "Prestation & historik" | `/career/squad/[playerId]` | tab | frequent | SQD-02 |
| SQD-02c | Tab "Egenskaper" | `/career/squad/[playerId]` | tab | frequent | SQD-02 |
| SQD-02d | Tab "Utveckling" | `/career/squad/[playerId]` | tab | occasional | SQD-02 |
| SQD-02e | Tab "Kontrakt" | `/career/squad/[playerId]` | tab | frequent | SQD-02 |
| SQD-02f | Tab "Klubbhistorik" | `/career/squad/[playerId]` | tab | rare | SQD-02 |
| SQD-02g | PlayerHero + PlayerActions | `/career/squad/[playerId]` | panel | core | SQD-02 |
| SQD-02h | Panel "Tillstånd" (PlayerConditionPanel) | `/career/squad/[playerId]` | panel | frequent | SQD-02 |
| SQD-02i | Panel "Spelaren som person" (PlayerDynamicsPanel) | `/career/squad/[playerId]` | panel | frequent | SQD-02 |
| SQD-02j | Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel) | `/career/squad/[playerId]` | panel | core | SQD-02 |
| SQD-02k | Panel "Förmåga & Positionskarta" (GameplayAbilityPanel) | `/career/squad/[playerId]` | panel | frequent | SQD-02 |
| SQD-02l | Knowledge-gated panels (external players) | `/career/squad/[playerId]` | panel | frequent | SQD-02 |
| SQD-02m | Panel "Scoutingrapport" (ScoutReportPanel) | `/career/squad/[playerId]` | panel | frequent | SQD-02 |
| SQD-02n | Panel "Förläng kontrakt" (ContractRenewal) | `/career/squad/[playerId]` | panel | frequent | SQD-02 |
| SQD-02o | Panel "Transferläge" (PlayerTransferCard) | `/career/squad/[playerId]` | panel | frequent | SQD-02 |
| SQD-02p | Panel "Medicinskt" (MedicalPanel) | `/career/squad/[playerId]` | panel | occasional | SQD-02 |
| SQD-02q | Loading / not-found states | `/career/squad/[playerId]` | state | rare | SQD-02 |
| SQD-03 | Spelarsök (player market search) | `/career/players` | page | frequent |  |
| SQD-03a | Dossier aside "Spelardossier" | `/career/players` | panel | frequent | SQD-03 |
| SQD-04 | Jämför spelare | `/career/compare?left=&right=` | page | occasional |  |
| SQD-05 | Kontrakt (contracts overview) | `/career/contracts` | page | frequent |  |
| SQD-05a | Panel "Ditt avtalsbeslut" | `/career/contracts` | panel | frequent | SQD-05 |
| STF-01 | Personal – Organisation | `/career/staff` | page | occasional |  |
| STF-01a | Staff subnav (StaffNav) | `/career/staff*` | tab | occasional | STF-01 |
| STF-01b | Panel "Klubbens organisation" (OrganisationChart) | `/career/staff` | panel | occasional | STF-01 |
| STF-01c | Staff table + role counts | `/career/staff` | panel | occasional | STF-01 |
| STF-01d | Rail "Veckans tränaransvar" | `/career/staff` | panel | occasional | STF-01 |
| STF-02 | Personprofil (staff profile) | `/career/staff/[staffId]` | page | occasional |  |
| STF-02a | Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight) | `/career/staff/[staffId]` | panel | occasional | STF-02 |
| STF-02b | Panel "Värva / Förläng eller avsluta" (StaffDealPanel) | `/career/staff/[staffId]` | panel | occasional | STF-02 |
| STF-03 | Rekrytera personal | `/career/staff/recruitment[?view=vacancies\|negotiations][&role=]` | page | occasional |  |
| STF-03a | View "Vakanta tjänster" | `/career/staff/recruitment?view=vacancies` | tab | occasional | STF-03 |
| STF-03b | View "Förhandlingar" | `/career/staff/recruitment?view=negotiations` | tab | rare | STF-03 |
| STF-03c | Panel "Hitta rätt person" (StaffMarketBoard) | `/career/staff/recruitment` | panel | occasional | STF-03 |
| STF-03d | Legacy tables "Fria scouter" + "Rekrytering — Personal" | `/career/staff/recruitment` | panel | internal | STF-03 |
| STF-04 | Ansvarsfördelning (delegation) | `/career/staff/responsibilities` | page | occasional |  |
| TRN-01 | Träning & Återhämtning | `/career/training[?week=YYYY-MM-DD]` | page | core |  |
| TRN-01a | Panel "Assistentens träningsplan" (AssistantTrainingPanel) | `/career/training` | panel | frequent | TRN-01 |
| TRN-01b | Panel "Veckoschema" (week planner) | `/career/training` | panel | core | TRN-01 |
| TRN-01c | Panel "Spelarberedskap" | `/career/training` | panel | frequent | TRN-01 |
| TRN-01d | Panel "Utveckling" | `/career/training` | panel | occasional | TRN-01 |
| TRN-01e | TrainingFeedback block | `/career/training` | panel | occasional | TRN-01 |
| TRN-01f | Loading state | `/career/training` | state | rare | TRN-01 |
| TRN-02 | Matchplan & Taktiktavla 2.0 | `/career/tactics` | page | core |  |
| TRN-02a | Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup) | `/career/tactics` | state | occasional | TRN-02 |
| TRN-02b | Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs) | `/career/tactics` | tab | core | TRN-02 |
| TRN-02c | Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6) | `/career/tactics` | tab | frequent | TRN-02 |
| TRN-02d | Mode "Byten & Diff" (TacticsDiffManager) | `/career/tactics` | tab | frequent | TRN-02 |
| TRN-02e | Overlay mode selector "Taktikvisning" | `/career/tactics` | panel | frequent | TRN-02 |
| TRN-02f | Rail "Så spelar vi" (CoachingChoices) | `/career/tactics` | panel | core | TRN-02 |
| TRN-02g | Section "Fasta situationer · 7-meter" (SetPieceSection) | `/career/tactics` | panel | occasional | TRN-02 |
| TRN-02h | Section "Ledarskap" (LeadershipSection) | `/career/tactics` | panel | occasional | TRN-02 |
| TRN-02i | Roster "Matchtrupp · n spelare" / "Ej uttagna" | `/career/tactics` | panel | core | TRN-02 |
| REC-01 | Scouting & Motståndaranalys | `/career/scouting[?target=playerId]` | page | frequent |  |
| REC-01a | ScoutingCentre ("Scoutingcentralen") | `/career/scouting` | panel | frequent | REC-01 |
| REC-01b | Panel "Dina scouter" | `/career/scouting` | panel | frequent | REC-01 |
| REC-01c | Panel "Ny bevakning" | `/career/scouting` | panel | frequent | REC-01 |
| REC-01d | Panel "Nytt bredare uppdrag" | `/career/scouting` | panel | occasional | REC-01 |
| REC-01e | Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag" | `/career/scouting` | panel | frequent | REC-01 |
| REC-01f | Panel "Upptäckta spelare" | `/career/scouting` | panel | frequent | REC-01 |
| REC-02 | Rekryteringscentrum | `/career/recruitment[?view=SHORTLIST]` | page | frequent |  |
| REC-02a | Candidate dossier | `/career/recruitment` | panel | frequent | REC-02 |
| REC-03 | Transfer Centre | `/career/transfers[?target=playerId]` | page | core |  |
| REC-03a | Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard) | `/career/transfers` | panel | frequent | REC-03 |
| REC-03b | Market tabs (Möjligheter / Hela marknaden / Bevakade) | `/career/transfers` | tab | core | REC-03 |
| REC-03c | Dossier aside (TransferDossier) | `/career/transfers` | drawer | frequent | REC-03 |
| REC-03d | Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer) | `/career/transfers` | panel | frequent | REC-03 |
| REC-04 | Förhandlingsrum (negotiation room) | `/career/transfers/[playerId][?deal=LOAN]` | page | core |  |
| REC-04a | Start decision "Inled förhandling" | `/career/transfers/[playerId]` | state | frequent | REC-04 |
| REC-04b | Decision form – club stage | `/career/transfers/[playerId]` | panel | core | REC-04 |
| REC-04c | Decision form – player stage | `/career/transfers/[playerId]` | panel | core | REC-04 |
| REC-04d | Waiting / closed status | `/career/transfers/[playerId]` | state | frequent | REC-04 |
| REC-04e | Deal completed (DealCompletion) | `/career/transfers/[playerId]` | overlay | occasional | REC-04 |
| REC-05 | Bud på din spelare (incoming offer) | `/career/transfers/offers/[offerId]` | page | frequent |  |
| REC-05a | Sold moment (MomentHero "Såld") | `/career/transfers/offers/[offerId]` | overlay | rare | REC-05 |
| CMP-01 | Tävlingar (competition workspace) | `/career/competitions[/competitionId][?tab=]` | page | frequent |  |
| CMP-01a | Tab "Tabell & form" | `/career/competitions/[competitionId]?tab=` | tab | core | CMP-01 |
| CMP-01b | Tab "Matcher" | `/career/competitions/[competitionId]?tab=` | tab | frequent | CMP-01 |
| CMP-01c | Tab "Resultat" | `/career/competitions/[competitionId]?tab=` | tab | frequent | CMP-01 |
| CMP-01d | Tab "Spelarstatistik" | `/career/competitions/[competitionId]?tab=` | tab | occasional | CMP-01 |
| CMP-01e | Tab "Klubbar" | `/career/competitions/[competitionId]?tab=` | tab | occasional | CMP-01 |
| CMP-01f | Tab "Historik" | `/career/competitions/[competitionId]?tab=` | tab | rare | CMP-01 |
| CMP-01g | Svenska Cupen variant (CupWorkspace) | `/career/competitions/se-svenska-cupen-herr` | state | occasional | CMP-01 |
| CMP-01h | Non-simulated league / not found states | `/career/competitions/[competitionId]` | state | occasional | CMP-01 |
| CMP-02 | Match (fixture page) | `/career/fixtures/[fixtureId]` | page | occasional |  |
| CMP-03 | Matcher (legacy redirect) | `/career/matches` | state | internal |  |
| CMP-04 | Statistik | `/career/statistics` | page | occasional |  |
| MDY-01 | Matchförhandsvisning (match preview / matchday gate) | `/career/match-preview` | page | core |  |
| MDY-01a | MatchdayStage ("Matchdagen") | `/career/match-preview` | panel | frequent | MDY-01 |
| MDY-01b | Confirm dialog "Kontrollera matchtruppen" | `/career/match-preview` | modal | occasional | MDY-01 |
| MDY-01c | Blocking / lineup error alerts | `/career/match-preview` | state | occasional | MDY-01 |
| MDY-01d | OpponentScoutingPanel (compact) | `/career/match-preview` | panel | frequent | MDY-01 |
| MDY-01e | Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare" | `/career/match-preview` | panel | core | MDY-01 |
| MDY-01f | States: season complete / no fixture | `/career/match-preview` | state | rare | MDY-01 |
| MDY-02 | Live match (Match Center) | `/career/match-day/[fixtureId][?finish=1]` | page | core |  |
| MDY-02a | Header / scoreboard & manpower | `/career/match-day/[fixtureId]` | panel | core | MDY-02 |
| MDY-02b | Controls bar | `/career/match-day/[fixtureId]` | panel | core | MDY-02 |
| MDY-02c | View "Översikt" | `/career/match-day/[fixtureId]` | tab | core | MDY-02 |
| MDY-02d | View "Nyckelögonblick" | `/career/match-day/[fixtureId]` | tab | frequent | MDY-02 |
| MDY-02e | View "Spelare" | `/career/match-day/[fixtureId]` | tab | frequent | MDY-02 |
| MDY-02f | View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling) | `/career/match-day/[fixtureId]` | tab | frequent | MDY-02 |
| MDY-02g | Coach aside "Dina matchbeslut" (LiveCoachPanel) | `/career/match-day/[fixtureId]` | panel | core | MDY-02 |
| MDY-02h | TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout) | `/career/match-day/[fixtureId]` | overlay | frequent | MDY-02 |
| MDY-02i | Half-time state | `/career/match-day/[fixtureId]` | state | frequent | MDY-02 |
| MDY-02j | Full-time state | `/career/match-day/[fixtureId]` | state | core | MDY-02 |
| MDY-02k | Assistant-in-control state | `/career/match-day/[fixtureId]` | state | rare | MDY-02 |
| MDY-02l | Experimental 2D court (details) | `/career/match-day/[fixtureId]` | panel | occasional | MDY-02 |
| MDY-02m | Quick finish / no session / archive fallback states | `/career/match-day/[fixtureId]` | state | occasional | MDY-02 |
| MDY-03 | Match Center (legacy redirect) | `/career/match-center` | state | internal |  |
| MDY-04 | Matchrepriser (match-2d replays) | `/career/match-2d` | page | rare |  |
| ANL-01 | Matchrapport | `/career/match-report/[fixtureId]` | page | core |  |
| ANL-01a | Archived match center (4 views) | `/career/match-report/[fixtureId]` | panel | core | ANL-01 |
| ANL-01b | MatchAftermathPanel ("Efter matchen") | `/career/match-report/[fixtureId]` | panel | frequent | ANL-01 |
| ANL-01c | Details "Speltid och belastning" | `/career/match-report/[fixtureId]` | panel | frequent | ANL-01 |
| ANL-01d | Legacy report variant (no archive) | `/career/match-report/[fixtureId]` | state | occasional | ANL-01 |
| ANL-01e | Error / no report states | `/career/match-report/[fixtureId]` | state | rare | ANL-01 |
| ANL-01f | PostMatchPressBanner | `/career/match-report/[fixtureId]` | panel | occasional | ANL-01 |
| ANL-02 | Matchanalys – Översikt | `/career/analysis` | page | frequent |  |
| ANL-02a | Analysis tab bar (layout) | `/career/analysis/*` | tab | frequent | ANL-02 |
| ANL-03 | Matchanalys – Motståndaren | `/career/analysis/opponent` | page | frequent |  |
| ANL-04 | Matchanalys – Vårt lag | `/career/analysis/our-team` | page | occasional |  |
| ANL-05 | Matchanalys – Senaste matchen | `/career/analysis/last-match` | page | occasional |  |

## ENT — Entry & global shell

### ENT-01 · Alpha access gate

- **Route:** `* (all routes, root layout)` · **Kind:** overlay · **Importance:** occasional
- **Components:** `app/layout.tsx`, `components/AlphaAccessGate.tsx`, `components/alpha.css`
- **Purpose:** Blocks the whole app until a tester enters the alpha access code (stored in localStorage).
- **Main actions:** Enter access code; Unlock
- **Current visual structure:** Centred card (eyebrow 'Tidig testversion', H1 'Handball Manager Alpha', one text input, one button). Children stay unmounted while checking ('Kontrollerar åtkomst…').
- **Navigation relationships:** ENT-02
- **Desktop:** Centred card on page background.
- **Mobile:** Same card; no specific mobile rules in alpha.css (0 media queries).

**Strengths**
- Accessible form (label, aria-invalid, role=alert error)
- Children not mounted until verified, no flash of content

**Weaknesses**
- Default code is hard-coded in client bundle (HBL-ALPHA-2026) — gate is cosmetic
- Plain utility card, no brand/club imagery; first impression of the product is a form
- No explanation of what the alpha is or how to get a code

**Redesign opportunities**
- Fold into a branded splash (arena image already exists) instead of a bare form
- Remove entirely for public builds; keep as env-gated wrapper

### ENT-02 · Title screen (Huvudmeny)

- **Route:** `/` · **Kind:** page · **Importance:** frequent
- **Components:** `app/page.tsx`, `components/ClubCrest.tsx`, `app/game.css (.game-title)`
- **Purpose:** Entry point: start a new career, continue the most recent save, load a save, open device settings.
- **Main actions:** NYTT SPEL; FORTSÄTT (most recent save); LADDA SPEL; INSTÄLLNINGAR
- **Current visual structure:** Two-column hero: left has tagline, big HANDBALL MANAGER wordmark and a row of 12 procedural club crests (36px); right is a vertical stack of 4 large text buttons with sublabels. A faint SVG court outline sits behind. Footer string 'GAME EXPERIENCE v2 …'.
- **Navigation relationships:** ENT-03, ENT-04, ENT-05, DSH-01
- **Desktop:** Full-bleed dark title (host shell header hidden via .app-shell:has(.game-title)).
- **Mobile:** At ≤760px collapses to one column, h1 64px, padding 8vw (game.css ~L1725).

**Strengths**
- Clear primary verbs with helpful sublines (Continue shows manager · club · date)
- Uses club colours/crests to signal 'Swedish handball'
- Error from save storage surfaced with role=alert

**Weaknesses**
- No photography although arena/court renders exist; the 'court' is a 2px #eee outline
- Inline styles for the crest row (style={{…}}) rather than design-system classes
- Continue button only shows the single most recent save; no preview of club/season state
- Footer 'GAME EXPERIENCE v2' is internal jargon visible to players

**Redesign opportunities**
- Make it a living 'club select' stage: last save's club crest/colours + arena env image as backdrop
- Show 'what happened since you left' for Continue
- Ambient motion (crest wall, arena lights)

### ENT-03 · New game wizard

- **Route:** `/new-game` · **Kind:** page · **Importance:** frequent
- **Components:** `app/new-game/page.tsx`, `components/game/CareerEntryFrame.tsx`, `components/game/career-entry.css`, `components/game/NationFlag.tsx`, `components/ClubCrest.tsx`, `components/crests/clubIdentity.ts`, `lib/newGame/clubSelectionContext.ts`
- **Purpose:** Six-step career setup: nations → leagues → database summary → club → manager → preseason/start.
- **Main actions:** Toggle nations; Toggle leagues; Pick club; Enter manager name/nationality/DOB; Choose preseason start (8/6/4/2 weeks or first match); STARTA KARRIÄR; Back / Next; Open settings
- **Current visual structure:** Three-zone CareerEntryFrame: left rail = numbered step list (01–06 with notes), centre = step content (choice-card grids), right = live context column (selected club crest 126px, club facts dl, manager pass, world summary counters), sticky footer with Back/hint/Next.
- **Navigation relationships:** ENT-02, ENT-05, ENT-12, DSH-01
- **Desktop:** Three columns (rail / content / context).
- **Mobile:** career-entry.css has 6 media queries; rail and context stack (exact order unverified in browser).

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

**Redesign opportunities**
- Lead with the club ('Välj din hemmaplan') and make leagues/nations an advanced drawer
- Club cards as visual tiles: colour field, crest, arena, expectation meter
- Manager card as a collectible 'pass' with chosen archetype
- A cinematic 'first day' handover instead of the generic init screen

### ENT-03a · Step 1 · Nationer

- **Route:** `/new-game (step 0)` · **Kind:** panel · **Importance:** occasional · **Parent:** ENT-03
- **Components:** `app/new-game/page.tsx`
- **Purpose:** Select handball nations included in the career world.
- **Main actions:** Toggle nation checkbox cards
- **Current visual structure:** Grid of checkbox cards (flag + code, nation name, '#ligor i urvalet', ✓ Vald / + Välj) plus a note card.
- **Navigation relationships:** ENT-03b
- **Desktop:** Card grid
- **Mobile:** Stacks

**Strengths**
- Flags give some colour

**Weaknesses**
- Low-stakes setting presented as step one

**Redesign opportunities**
- Collapse into 'Världen' advanced settings

### ENT-03b · Step 2 · Ligor

- **Route:** `/new-game (step 1)` · **Kind:** panel · **Importance:** occasional · **Parent:** ENT-03
- **Components:** `app/new-game/page.tsx`
- **Purpose:** Select competitions per nation.
- **Main actions:** Toggle league cards
- **Current visual structure:** Per-nation sections of league cards (tier number '01', name, '#klubbar', '# spelbara klubbar'). Empty state note when no playable club.
- **Navigation relationships:** ENT-03c
- **Desktop:** Grid
- **Mobile:** Stacks

**Strengths**
- Shows playable count

**Weaknesses**
- Tier shown as bare zero-padded number

**Redesign opportunities**
- Pyramid visual of Swedish league system

### ENT-03c · Step 3 · Databas (summary)

- **Route:** `/new-game (step 2)` · **Kind:** panel · **Importance:** rare · **Parent:** ENT-03
- **Components:** `app/new-game/page.tsx`
- **Purpose:** Overview of chosen nations/leagues/clubs.
- **Main actions:** Next
- **Current visual structure:** Four MiniStat counters + list of selected competitions + explanatory note.
- **Navigation relationships:** ENT-03d
- **Desktop:** Stats row + two sections
- **Mobile:** Stacks

**Strengths**
- Transparent about data provenance

**Weaknesses**
- A whole step that asks nothing of the player; reads like a DB report

**Redesign opportunities**
- Remove or merge into league step

### ENT-03d · Step 4 · Klubb

- **Route:** `/new-game (step 3)` · **Kind:** panel · **Importance:** frequent · **Parent:** ENT-03
- **Components:** `app/new-game/page.tsx`, `components/ClubCrest.tsx`
- **Purpose:** Choose the playable club to manage.
- **Main actions:** Select club radio card; Change league selection; Expand 'andra klubbar' details
- **Current visual structure:** Toolbar with count, radio-card grid (crest 48px, name, league, city · venue, heritage tag, forecast), a <details> list of non-playable clubs.
- **Navigation relationships:** ENT-03e
- **Desktop:** Grid + context column
- **Mobile:** Stacked

**Strengths**
- Most emotional step; context column updates live with arena, prediction, board expectation, squad strength vs league, economy

**Weaknesses**
- ~30 near-identical text cards; little differentiation between clubs at a glance
- Key differentiators (budget, expectation, strength) live only in the right column

**Redesign opportunities**
- Map of Sweden / club wall with colour tiles; filter by ambition (survive/promote/title)

### ENT-03e · Step 5 · Manager

- **Route:** `/new-game (step 4)` · **Kind:** panel · **Importance:** occasional · **Parent:** ENT-03
- **Components:** `app/new-game/page.tsx`, `components/game/NationFlag.tsx`
- **Purpose:** Create the manager profile.
- **Main actions:** Name; Nationality select; Date of birth
- **Current visual structure:** Form fields left, 'Tränarbänken' pass card right with initials monogram.
- **Navigation relationships:** ENT-03f
- **Desktop:** Two columns
- **Mobile:** Stacks

**Strengths**
- Live preview pass card
- Inline validation (age 18–85)

**Weaknesses**
- Identity is just initials; no avatar/style/background choice

**Redesign opportunities**
- Coaching-style archetype, appearance, backstory that later feed media/board

### ENT-03f · Step 6 · Starta (preseason)

- **Route:** `/new-game (step 5)` · **Kind:** panel · **Importance:** frequent · **Parent:** ENT-03
- **Components:** `app/new-game/page.tsx`, `lib/career/preseason.ts`
- **Purpose:** Pick preseason length and confirm.
- **Main actions:** Choose preseason option; STARTA KARRIÄR
- **Current visual structure:** Mandate banner (manager name + 'tar plats hos' club + crest 84px), radio grid of 5 preseason options with dates, summary dl.
- **Navigation relationships:** ENT-12, DSH-01
- **Desktop:** Stacked sections
- **Mobile:** Stacks

**Strengths**
- Clear consequence (first day date)

**Weaknesses**
- Mandate moment is small and text-led

**Redesign opportunities**
- Make this the 'signing' moment (DEAL_SIGNED backdrop already exists)

### ENT-04 · Load game (Sparade karriärer)

- **Route:** `/load-game` · **Kind:** page · **Importance:** frequent
- **Components:** `app/load-game/page.tsx`, `components/game/CareerEntryFrame.tsx`, `components/game/career-entry.css`, `components/ClubCrest.tsx`
- **Purpose:** List saved careers, preview one, open or delete it.
- **Main actions:** Select save; Ladda / Fortsätt karriären; Ta bort (two-step inline confirm); Börja en ny karriär; Back to main menu
- **Current visual structure:** Same three-zone frame as New Game: rail with save count; centre a 6-column table (Manager, Klubb, Säsong, Speldatum, Senast spelad, actions); right context shows selected club crest 126px, manager, facts and next match.
- **Navigation relationships:** ENT-02, ENT-03, DSH-01
- **Desktop:** Three-zone frame with table.
- **Mobile:** Table inside .career-save-table-wrap (horizontal scroll likely); frame stacks.

**Strengths**
- Rich preview of selected save (next opponent, matches played)
- Inline delete confirmation row with focus return and Escape
- Distinct loading, empty ('Vilken klubb blir din?') and read-error states with retry

**Weaknesses**
- Saves rendered as a data table rather than career cards
- Raw ISO game date in table column ('2026-08-03')
- Delete is permanent with only an inline row — no undo/export prompt

**Redesign opportunities**
- Save slots as club-coloured cards with season progress and last result
- Offer 'export before delete'

### ENT-04a · Delete-save inline confirmation

- **Route:** `/load-game` · **Kind:** panel · **Importance:** rare · **Parent:** ENT-04
- **Components:** `app/load-game/page.tsx (SaveRows)`
- **Purpose:** Confirm permanent deletion of a save.
- **Main actions:** Behåll karriären; Ta bort karriären
- **Current visual structure:** Extra full-width table row with question, club · date, two buttons.
- **Navigation relationships:** —
- **Desktop:** Inline row
- **Mobile:** Inline row

**Strengths**
- Keyboard-safe (focus on cancel, Esc cancels)

**Weaknesses**
- Visually just another table row

**Redesign opportunities**
- Proper confirm dialog with consequences and export option

### ENT-04b · Load game: loading / empty / error states

- **Route:** `/load-game` · **Kind:** state · **Importance:** occasional · **Parent:** ENT-04
- **Components:** `app/load-game/page.tsx`
- **Purpose:** Feedback while reading IndexedDB, when no saves exist, or on failure.
- **Main actions:** Försök igen; Skapa en karriär
- **Current visual structure:** Text blocks in centre column with overline + heading + paragraph; context column swaps to matching copy.
- **Navigation relationships:** ENT-03
- **Desktop:** Centre column
- **Mobile:** Stacks

**Strengths**
- Warm, on-brand copy

**Weaknesses**
- No skeletons; text only

**Redesign opportunities**
- Skeleton save cards

### ENT-05 · Settings (from main menu)

- **Route:** `/settings` · **Kind:** page · **Importance:** occasional
- **Components:** `app/settings/page.tsx`, `components/settings/GlobalPreferences.tsx`, `components/settings/settings.css`
- **Purpose:** Device-level preferences outside a career: display currency and default match speed.
- **Main actions:** Choose currency (EUR/SEK); Choose default match speed; ← Huvudmeny
- **Current visual structure:** Simple header + three plain sections (Valuta radiogroup styled as subnav links, Matchhastighet select, explanatory 'Karriärens världsinställningar').
- **Navigation relationships:** ENT-02
- **Desktop:** Single column
- **Mobile:** settings.css has 3 media queries

**Strengths**
- Honest scope: only settings that do something

**Weaknesses**
- Different UI from in-career settings (SYS-01) for the same currency preference
- Currency radio implemented as <a href='#…' role=radio> links
- No audio/accessibility/text-size/theme options

**Redesign opportunities**
- One settings surface shared in and out of career
- Add text size / density / reduced motion toggles (density relevant to 'spreadsheet' feel)

### ENT-06 · Host shell (STARKVIS navbar)

- **Route:** `* (root layout)` · **Kind:** nav · **Importance:** frequent
- **Components:** `app/app-shell/HostNavigation.tsx`, `app/app-shell/StarkvisAppShell.tsx`, `app/app-shell/WebsiteNavbar.tsx`, `app/app-shell/shell.css`
- **Purpose:** Portfolio-site navbar injected in a shadow root on top of the game ('Handball Manager · LAB', '← Tillbaka till Apps', app switcher).
- **Main actions:** Reveal via top edge / button; Return to Apps; Switch app; Hide
- **Current visual structure:** Fixed 160px-high shadow-DOM layer at z-index 2147483000 with an 8px reveal edge; sets --sv-shell-offset on <html> when revealed.
- **Navigation relationships:** external Apps hub
- **Desktop:** Top overlay
- **Mobile:** Single-column app groups ≤767px

**Strengths**
- Isolated in shadow DOM; auto-hide behaviour; reduced-motion respected

**Weaknesses**
- Non-game chrome ('LAB', 'Apps') competes with the game's own header and breaks immersion
- Initial state visible=true — on first load it overlays the game header (behaviour after timeout not verified)
- Teal #00c2b3 accent unrelated to game palette

**Redesign opportunities**
- Hide entirely inside career, or reduce to a single unobtrusive corner affordance

### ENT-07 · Career shell · sidebar navigation

- **Route:** `/career/* (layout)` · **Kind:** nav · **Importance:** core
- **Components:** `app/career/layout.tsx`, `components/GameShell.tsx`, `lib/career/navigation.ts`, `components/NavIcon.tsx`, `app/game.css (.hm-sidebar)`, `app/manager.css`
- **Purpose:** Primary navigation for every career screen.
- **Main actions:** Navigate to 27 destinations (28 with Editor); Open Sparade karriärer
- **Current visual structure:** Dark navy 232px sidebar: HM monogram wordmark, club badge (crest 64px + name + league), then ONE flat list of 27 links with 6 group labels injected before specific items: 'Din säsong' (Hem, Klubbhuset, Inkorg, Media), 'Laget' (Trupp, Kontrakt, Taktik, Träning), 'Match & kalender' (Kalender, Schema, Analys), 'Spelarvärlden' (Spelarsök, Scouting, Rekrytering, Transfers), 'Klubben' (Personal, Medicinskt, Klubb, Styrelsen, Karriär, Ekonomi, Säsongen, Tävlingar, Svenska Cupen, Statistik, Historik), 'Spelet' (Inställningar). Footer: manager name + 'Sparade karriärer →'. Inbox badge shows unread count.
- **Navigation relationships:** DSH-01, CLB-01, WLD-01, WLD-02, /career/squad, /career/contracts, /career/tactics, /career/training, WLD-05, WLD-06, /career/analysis, /career/players, /career/scouting, /career/recruitment, /career/transfers, /career/staff, MED-01, CLB-02, CLB-05, MGR-01, CLB-06, MGR-03, /career/competitions, /career/competitions/se-svenska-cupen-herr, /career/statistics, MGR-02, SYS-01, ENT-04
- **Desktop:** Persistent left rail, scrolls when 27 items exceed viewport height.
- **Mobile:** ≤760px becomes an off-canvas drawer (ENT-07a).

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

**Redesign opportunities**
- Collapse to 6–7 hubs (Hem, Laget, Match, Marknad, Klubben, Värld, Karriär) with in-hub tabs
- Merge Kalender+Schema, Säsongen+Tävlingar+Cup, Spelarsök+Scouting+Rekrytering
- Let Klubbhuset or the Dashboard be the spatial hub; sidebar becomes compact icons
- Distinct icon per destination

### ENT-07a · Mobile nav drawer

- **Route:** `/career/*` · **Kind:** drawer · **Importance:** core · **Parent:** ENT-07
- **Components:** `components/GameShell.tsx (navOpen)`, `app/game.css (@media max-width:760px)`
- **Purpose:** Phone access to the sidebar; also hosts the save controls on phones.
- **Main actions:** ☰ open / ✕ close; Scrim click / Esc to close; Save/export/import inside drawer
- **Current visual structure:** Same 27-item sidebar slides in from left (min(84vw,300px)), scrim behind; closes on navigation and Escape. Save controls duplicated into the drawer footer.
- **Navigation relationships:** ENT-07
- **Desktop:** Hidden
- **Mobile:** Primary navigation

**Strengths**
- Proper 44px toggle target, Esc handling, reduced-motion variant

**Weaknesses**
- A 27-item scrolling drawer is the only navigation on phones; no bottom tab bar
- No focus trap inside the open drawer (not found in source)
- manager.css also sets a 150px sidebar column at ≤760px — two conflicting mobile rules (game.css wins by load order, unverified)

**Redesign opportunities**
- Bottom tab bar with 4–5 hubs + 'Mer'
- Continue button as a thumb-reachable FAB

### ENT-08 · Career top bar (header)

- **Route:** `/career/*` · **Kind:** nav · **Importance:** core · **Parent:** ENT-07
- **Components:** `components/GameShell.tsx`, `components/manager/GlobalSearch.tsx`, `components/CareerSaveControl.tsx`, `lib/career/contextualContinueAction.ts`, `app/game.css (.hm-header, .game-continue)`
- **Purpose:** Club/season title, current date & next event (or live-match banner), global search, save controls and the contextual Continue button.
- **Main actions:** Search players/clubs/competitions; Spara; Spara och avsluta; Exportera sparafil; Importera sparafil; Continue (contextual)
- **Current visual structure:** Left: club name / season and a subline 'date · Nästa: date'. Middle: search input. Right: four small save buttons in a row, then the large orange primary Continue button with a small uppercase sublabel.
- **Navigation relationships:** ENT-08a, ENT-08b, ENT-10
- **Desktop:** Single row header.
- **Mobile:** Wraps; only 'Spara' remains (others moved to drawer), Continue shrinks to min-width 92px; search hidden.

**Strengths**
- Continue is context-aware (Fortsätt / Förbered match / Starta match / Återgå till match / Presskonferens / Styrelsemöte / Säsong klar) with tooltip and aria-label
- Live match banner replaces date line when you navigate away from an in-progress match

**Weaknesses**
- Four save/export/import buttons permanently in the header compete with Continue (file-management in the game's most valuable real estate)
- Date + next-event is plain small text — the game clock, the core of a manager game, has no visual weight
- Search only appears as input; ≤760px it is hidden entirely (manager.css .hm-global-search display:none)

**Redesign opportunities**
- Turn the date into a 'calendar clock' widget with next-event countdown
- Move save/export/import to a menu
- Make Continue the hero control with preview of what will happen

### ENT-08a · Global search results dropdown

- **Route:** `/career/*` · **Kind:** panel · **Importance:** frequent · **Parent:** ENT-08
- **Components:** `components/manager/GlobalSearch.tsx`, `lib/career/management.ts (searchManagement)`
- **Purpose:** Jump to players, clubs, competitions.
- **Main actions:** Type ≥2 chars; Select result
- **Current visual structure:** Absolute dropdown under input with up to 12 text links (kind + name).
- **Navigation relationships:** /career/squad/[playerId], CLB-04, /career/competitions/[id]
- **Desktop:** Dropdown
- **Mobile:** Hidden

**Strengths**
- Fast cross-entity jump

**Weaknesses**
- Text-only results, no crest/face
- No keyboard arrow navigation found (16-line component)
- Unavailable on mobile

**Redesign opportunities**
- Command palette (Ctrl+K) incl. actions ('Gå till taktik')

### ENT-08b · Save controls

- **Route:** `/career/*` · **Kind:** panel · **Importance:** frequent · **Parent:** ENT-08
- **Components:** `components/CareerSaveControl.tsx`
- **Purpose:** Manual save, save & exit, export/import JSON backups.
- **Main actions:** Spara; Spara och avsluta; Exportera sparafil; Importera sparafil
- **Current visual structure:** Row of 4 .hm-btn-sm buttons + inline status text (role=status / alert).
- **Navigation relationships:** ENT-02
- **Desktop:** Header row
- **Mobile:** Drawer footer

**Strengths**
- Clear success/error feedback

**Weaknesses**
- Import of a file from the header of a running career is a destructive action with no confirm
- Developer-ish 'sparafil (.json)' language in a game header

**Redesign opportunities**
- Autosave indicator + overflow menu

### ENT-09 · Context bar (breadcrumb row)

- **Route:** `/career/*` · **Kind:** nav · **Importance:** frequent · **Parent:** ENT-07
- **Components:** `components/GameShell.tsx (.hm-context-bar)`, `app/manager.css`
- **Purpose:** Back/forward buttons, breadcrumb 'Kontoret / <section>', unread messages link.
- **Main actions:** ← back; → forward; Kontoret; N olästa meddelanden
- **Current visual structure:** Thin 11px muted row above every page with two ghost arrow buttons, a two-level breadcrumb and an unread link at the right.
- **Navigation relationships:** DSH-01, WLD-01
- **Desktop:** Row
- **Mobile:** Wraps

**Strengths**
- Always offers a way back from deep Level-3 routes

**Weaknesses**
- Duplicates browser back/forward
- Breadcrumb is always two levels ('Detalj' fallback) — doesn't reflect real depth
- Naming drift: sidebar says 'Hem', breadcrumb says 'Kontoret', dashboard says 'MANAGERNS KONTOR'
- Unread count duplicated (sidebar badge + this row)

**Redesign opportunities**
- Replace with real hierarchical breadcrumb or remove in favour of hub tabs

### ENT-09a · Progression notice (after Continue)

- **Route:** `/career/*` · **Kind:** panel · **Importance:** core · **Parent:** ENT-09
- **Components:** `components/GameShell.tsx`, `components/game/progressionPresentation.ts`, `components/game/game-feedback.css`
- **Purpose:** Tells the manager why time stopped and links to the event.
- **Main actions:** Action link (e.g. 'Till matchen'); × dismiss
- **Current visual structure:** Aside banner at top of main: bold title, detail paragraph, one button, close ×.
- **Navigation relationships:** WLD-01, CLB-05, /career/match-preview
- **Desktop:** Banner
- **Mobile:** Banner

**Strengths**
- Explains stop reason; matchday notice auto-hides once match played

**Weaknesses**
- Looks like a generic alert; competes with page heroes

**Redesign opportunities**
- Turn into a 'news ticker / event card' with imagery per event type

### ENT-10 · Continue / advance-day flow

- **Route:** `/career/*` · **Kind:** panel · **Importance:** core · **Parent:** ENT-08
- **Components:** `components/GameShell.tsx (handleContinue)`, `lib/career/contextualContinueAction.ts`, `lib/career/CareerContext.tsx (continueCareer)`
- **Purpose:** The heartbeat of the game: advance the calendar until something needs the manager, or route to the blocking task.
- **Main actions:** Fortsätt »; Förbered match; Starta match; Återgå till match; Presskonferens; Styrelsemöte (SVAR KRÄVS); Säsong klar (disabled)
- **Current visual structure:** One primary button; if the action has targetHref it navigates, otherwise runs continueCareer() then shows ENT-10a for ≥1 processed day, then navigates to notice.navigateHref and shows ENT-09a.
- **Navigation relationships:** ENT-10a, ENT-09a, /career/tactics, /career/match-preview, /career/match-day/[fixtureId], WLD-02b, CLB-05, WLD-01
- **Desktop:** Header right
- **Mobile:** Header right, compact

**Strengths**
- Hard invariants (never advances a live match or a completed season)
- Blocking decisions are surfaced by label (DECISION_BLOCKED)

**Weaknesses**
- Button may silently navigate elsewhere instead of advancing — mental model shifts with state
- No preview of how far time will move before pressing

**Redesign opportunities**
- 'Next up' strip showing the queue (training, match in 3 days, deadline) under the button
- Distinct visual states per action kind

### ENT-10a · Continue processing overlay ('Världen går vidare.')

- **Route:** `/career/*` · **Kind:** overlay · **Importance:** core · **Parent:** ENT-10
- **Components:** `components/ContinueProcessingOverlay.tsx`, `components/game/game-feedback.css`
- **Purpose:** Day-by-day replay of an already committed advance, then hands over to the stop reason.
- **Main actions:** Visa händelsen → (skip); Esc to skip
- **Current visual structure:** Modal <dialog>: header with crest (hard-coded navy #121d31 instead of club colour) + club · season + H2; body left = current date ticker, last 12 day numbers revealing, 'N dagar … träningsdagar', up to 5 highlight events; right = stop-reason card; footer hint text.
- **Navigation relationships:** ENT-09a
- **Desktop:** Centred dialog
- **Mobile:** game-feedback.css has 2 media queries

**Strengths**
- Gives time passage a felt rhythm; bounded duration (≤ ~0.9s + 0.5s)
- Accessible: aria-live date, Esc skip, focus via showModal

**Weaknesses**
- Crest ignores club primary colour (primaryColor='#121d31')
- Purely textual; no imagery per event type
- Very short — little anticipation for big events

**Redesign opportunities**
- Signature 'time passes' moment: calendar flip, event cards with photos (env images), match-day build-up

### ENT-11 · Feedback / bug report modal

- **Route:** `* (root layout)` · **Kind:** modal · **Importance:** occasional
- **Components:** `components/FeedbackModal.tsx`, `components/alpha.css`
- **Purpose:** Alpha testers download their save and get a feedback link.
- **Main actions:** Open via floating 'Rapportera bugg / Feedback' button; Ladda ner sparafil (.json); Skicka feedback (link); Stäng
- **Current visual structure:** Fixed bottom-left floating button (z-index 200) opening a native <dialog> card with description, download button, status message, link, close.
- **Navigation relationships:** —
- **Desktop:** Floating button + dialog
- **Mobile:** Same; max-width calc(100vw-24px)

**Strengths**
- Native dialog, focus restore, clear failure copy

**Weaknesses**
- Floating button is on every screen incl. title and match, bottom-left — overlaps the sidebar footer area on desktop (likely, not verified visually)
- No in-app text field; feedback goes out-of-band

**Redesign opportunities**
- Move into a help/overflow menu; capture screenshot + note in-app

### ENT-12 · Career initialization / loading / error screen

- **Route:** `/career (layout) & /new-game` · **Kind:** state · **Importance:** frequent
- **Components:** `components/game/CareerInitialization.tsx`, `components/game/career-initialization.css`, `app/career/layout.tsx`
- **Purpose:** Full-screen state while a career is created or opened (IndexedDB), and failure screen.
- **Main actions:** Tillbaka och försök igen / Till huvudmenyn (on failure)
- **Current visual structure:** Brand mark, big uppercase H1 ('BYGGER DIN HANDBOLLSVÄRLD…' / 'ÖPPNAR DIN KARRIÄR…' / 'KUNDE INTE ÖPPNA KARRIÄREN'), club crest 112px aside, elapsed seconds after 6s, footer tagline.
- **Navigation relationships:** ENT-02, DSH-01
- **Desktop:** Full screen
- **Mobile:** 2 media queries

**Strengths**
- Honest progress (elapsed time, no fake %)
- Club identity shown while loading

**Weaknesses**
- Static text; no imagery despite arena assets

**Redesign opportunities**
- Use club's arena env image + tips/club facts while loading

### ENT-13 · Live-match banner (header subline)

- **Route:** `/career/* (when away from live match)` · **Kind:** state · **Importance:** occasional · **Parent:** ENT-08
- **Components:** `components/GameShell.tsx (liveMatchBanner)`, `lib/liveMatch/liveMatchView.ts`
- **Purpose:** Remind that a match is in progress and show score/clock.
- **Main actions:** Continue button becomes 'Återgå till match'
- **Current visual structure:** Replaces the date subline with 'MATCH PÅGÅR · HAM 7–5 SKA · 13:00' text.
- **Navigation relationships:** /career/match-day/[fixtureId]
- **Desktop:** Header subline
- **Mobile:** Ellipsised

**Strengths**
- Correct, reuses live selector

**Weaknesses**
- Only a 12px text line — easy to miss

**Redesign opportunities**
- Persistent mini scoreboard pill with pulsing live dot

## DSH — Dashboard

### DSH-01 · Dashboard · Managerns kontor (Hem)

- **Route:** `/career` · **Kind:** page · **Importance:** core
- **Components:** `app/career/page.tsx`, `components/game/Identity.tsx (MatchHero, ClubHero, RankIndicator, PlayerCell, clubColorVars)`, `components/game/WeeklyManagerOverview.tsx`, `components/manager/Workspace.tsx (EmptyState, FixtureTable)`, `components/experience/primitives.tsx (MeterBar)`, `components/clubhq/environments.ts`, `components/FormDots.tsx`, `app/game.css (.game-home*)`
- **Purpose:** Home: next match, league position, squad availability, decisions, news, weekly plan, board, rivals, other results.
- **Main actions:** Förbered match; Motståndaren; Taktiktavla; Välj startsju; Planera kontrakten; Upptäck spelare; Din kortlista; Open news item; Styrelserummet; Börja nästa säsong (season complete); Klubbhuset / Taktikrummet links
- **Current visual structure:** Photo hero (manager-office env image) with crest 64px + club name; then next-match hero + league card; then a 3-column body with ~11 sections: Laget inför avkast, Utanför planen, Senaste avtrycket | Från klubben, Veckans managerplan | Styrelsen, Rivalerna (mini table), På andra planer (fixture table), Nästa laginsats note. Most section bodies are lists of text lines and small tables.
- **Navigation relationships:** CLB-01, /career/tactics, /career/match-preview, CLB-04, /career/competitions/[id], /career/squad, /career/contracts, /career/players, /career/recruitment?view=SHORTLIST, /career/match-report/[id], WLD-01, WLD-05, CLB-05, /career/training, MGR-02, MGR-01b, CLB-06
- **Desktop:** Hero + event row (hero + 240–300px season card) + 3-column body (1.1fr 1fr 1fr at wide).
- **Mobile:** Columns collapse to 2 then 1 (game.css ~L1678–1706); becomes a very long scroll of ~11 sections.

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

**Redesign opportunities**
- One 'Today' focal card driven by the Continue state (what matters now)
- Card feed of events with imagery instead of three columns of lists
- Visual league ladder / form strip / squad availability ring
- Personalise by moment (matchday, transfer window, board review)

### DSH-01a · Office hero header

- **Route:** `/career` · **Kind:** panel · **Importance:** core · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`, `components/clubhq/environments.ts (manager-office)`
- **Purpose:** Club identity banner.
- **Main actions:** Klubbhuset →; Taktikrummet →
- **Current visual structure:** xp-photo-hero with manager-office photo, crest, overline 'MANAGERNS KONTOR · season', H1 club name, heritage tag; right: league, venue · capacity, two link chips.
- **Navigation relationships:** CLB-01, /career/tactics
- **Desktop:** Wide banner
- **Mobile:** Stacks

**Strengths**
- Real photography + club colours

**Weaknesses**
- Purely decorative — no state (date, next event, mood)

**Redesign opportunities**
- Carry live state (countdown to match, board mood)

### DSH-01b · Next match hero + league card

- **Route:** `/career` · **Kind:** panel · **Importance:** core · **Parent:** DSH-01
- **Components:** `components/game/Identity.tsx (MatchHero, RankIndicator)`, `components/FormDots.tsx`
- **Purpose:** Next fixture and own league standing.
- **Main actions:** Motståndaren; Taktiktavla; Förbered match; Ligan, resultaten och rivalerna
- **Current visual structure:** MatchHero (two crests, date, competition) beside an aside with rank '#/N', points/matches/GD triple and last-5 form dots. Empty: 'Inget kommande avkast.'
- **Navigation relationships:** /career/match-preview, /career/tactics, CLB-04
- **Desktop:** Hero + 240px aside
- **Mobile:** Stacks

**Strengths**
- Strongest visual block on the page

**Weaknesses**
- League card is three numbers + dots; no table context

**Redesign opportunities**
- Countdown, opponent form, injury impact inline

### DSH-01c · Season-complete milestone & transition blockers

- **Route:** `/career (seasonComplete)` · **Kind:** state · **Importance:** occasional · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`, `lib/career/seasonRollover.ts`
- **Purpose:** End of season summary and 'Börja nästa säsong'.
- **Main actions:** Börja nästa säsong →; Se över avtalen; Sluttabellen
- **Current visual structure:** ClubHero + milestone section (H2 'Säsongen är i mål.', copy, three facts: final place, points, goals). Blockers shown as role=alert list with codes/refs.
- **Navigation relationships:** /career/contracts, /career/competitions/[id], MGR-03
- **Desktop:** Block
- **Mobile:** Stacks

**Strengths**
- Preserves career on blocked transition

**Weaknesses**
- Blocker list exposes internal codes (b.ref)
- A season ending is a big emotional moment rendered as a text card (trophy env image unused here)

**Redesign opportunities**
- Season review ceremony (trophy-moment asset)

### DSH-01d · Contextual notices (unemployed / new season)

- **Route:** `/career` · **Kind:** state · **Importance:** occasional · **Parent:** DSH-01
- **Components:** `app/career/page.tsx (.game-new-season-note)`
- **Purpose:** Explain special career states.
- **Main actions:** Jobbmarknaden →; Se föregående säsong →
- **Current visual structure:** Inline note strips with bold lead + link.
- **Navigation relationships:** MGR-01b, MGR-02
- **Desktop:** Strip
- **Mobile:** Strip

**Strengths**
- Contextual

**Weaknesses**
- Same styling for very different stakes (job loss vs new season)

**Redesign opportunities**
- Tone-specific event cards

### DSH-01e · Laget inför avkast (availability)

- **Route:** `/career` · **Kind:** panel · **Importance:** core · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`, `lib/career/management.ts`
- **Purpose:** Squad availability, match fitness, captain, top 3 issues.
- **Main actions:** Hela truppen; Välj startsju
- **Current visual structure:** Big 'available/total' number + text line + up to 3 player rows (glyph + issue).
- **Navigation relationships:** /career/squad, /career/tactics
- **Desktop:** Column 1
- **Mobile:** Stacked

**Strengths**
- Actionable

**Weaknesses**
- Fitness as a sentence; no visual

**Redesign opportunities**
- Availability ring + position coverage court diagram

### DSH-01f · Utanför planen (contracts & radar)

- **Route:** `/career` · **Kind:** panel · **Importance:** frequent · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`
- **Purpose:** Expiring contracts and shortlist/scouting summary.
- **Main actions:** Planera kontrakten; Upptäck spelare; Din kortlista
- **Current visual structure:** Two 'decision' rows (big count + H3 + copy + links) and 2 contract lines.
- **Navigation relationships:** /career/contracts, /career/players, /career/recruitment?view=SHORTLIST
- **Desktop:** Column 1
- **Mobile:** Stacked

**Strengths**
- Counts give quick read

**Weaknesses**
- Generic copy repeats every visit

**Redesign opportunities**
- Deadline-driven cards with player faces

### DSH-01g · Senaste avtrycket (recent results)

- **Route:** `/career` · **Kind:** panel · **Importance:** frequent · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`
- **Purpose:** Last 3 own results.
- **Main actions:** Open match report; Matcharkivet
- **Current visual structure:** Three link rows: short names stacked + date + score; empty state copy.
- **Navigation relationships:** /career/match-report/[id], WLD-06
- **Desktop:** Column 1
- **Mobile:** Stacked

**Strengths**
- Direct to report

**Weaknesses**
- No W/D/L colour, no crests

**Redesign opportunities**
- Result tiles with crests and outcome colour

### DSH-01h · Från klubben (latest news)

- **Route:** `/career` · **Kind:** panel · **Importance:** frequent · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`, `lib/career/inboxBridge.ts`
- **Purpose:** Latest 4 inbox messages.
- **Main actions:** Open message in inbox
- **Current visual structure:** Four article lines: category · date · NYTT, bold subject, preview.
- **Navigation relationships:** WLD-01
- **Desktop:** Column 2
- **Mobile:** Stacked

**Strengths**
- Deep-links to the message

**Weaknesses**
- Duplicates inbox; no priority signal

**Redesign opportunities**
- Merge into a single prioritised event feed

### DSH-01i · Veckans managerplan (weekly overview)

- **Route:** `/career` · **Kind:** panel · **Importance:** core · **Parent:** DSH-01
- **Components:** `components/game/WeeklyManagerOverview.tsx`, `lib/career/weeklyManagement.ts`
- **Purpose:** Seven-day plan, next step, decisions/deadlines, board and economy snapshot, latest feedback.
- **Main actions:** Öppna nästa steg; Justera träningsprioriteringar; Förbered nästa match; Open day in training; Decision links; Kalender
- **Current visual structure:** Long vertical section: date range, status box, two links, 7 day lines (date + day type + sessions + fixtures), availability sentence, H3 'Beslut och tidsfrister' list, board sentence + objectives list, economy sentence, H3 feedback articles.
- **Navigation relationships:** WLD-05, /career/training, /career/tactics, /career/squad, WLD-01, CLB-05, CLB-06
- **Desktop:** Column 2
- **Mobile:** Very long

**Strengths**
- The most complete 'what's this week' summary in the game

**Weaknesses**
- Wall of text and links; duplicates board card (DSH-01j) and news (DSH-01h)
- No week visual (unlike calendar's day tiles)

**Redesign opportunities**
- Horizontal 7-day strip as the dashboard's spine

### DSH-01j · Styrelsen (board card)

- **Route:** `/career` · **Kind:** panel · **Importance:** frequent · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`, `components/experience/primitives.tsx (MeterBar)`, `lib/board/board.ts`
- **Purpose:** Board confidence and top 3 objectives.
- **Main actions:** Styrelserummet →
- **Current visual structure:** MeterBar 'Förtroende n/100', pressure label sentence, three objective rows with status pills.
- **Navigation relationships:** CLB-05
- **Desktop:** Column 3
- **Mobile:** Stacked

**Strengths**
- Meter gives at-a-glance read

**Weaknesses**
- Repeated in weekly plan

**Redesign opportunities**
- Board mood portrait/gauge

### DSH-01k · Rivalerna + På andra planer + training note

- **Route:** `/career` · **Kind:** panel · **Importance:** frequent · **Parent:** DSH-01
- **Components:** `app/career/page.tsx`, `components/manager/Workspace.tsx (FixtureTable)`
- **Purpose:** Top-4 + own row mini table, other results, nudge to training.
- **Main actions:** Ligan →; Resultaten →; Träningsveckan →
- **Current visual structure:** 4-column mini table (#, Klubb, SM, P), fixture table of 4 other results, static training note card.
- **Navigation relationships:** /career/competitions/[id], /career/training, CLB-04
- **Desktop:** Column 3
- **Mobile:** Stacked

**Strengths**
- Compact league context

**Weaknesses**
- Static training note repeats every visit

**Redesign opportunities**
- Live ticker of round results

## CLB — Club & organisation

### CLB-01 · Klubbhuset (clubhouse hub)

- **Route:** `/career/klubbhuset` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/klubbhuset/page.tsx`, `lib/clubhq/clubhq.ts`, `components/clubhq/environments.ts`, `components/clubhq/clubhq.css`, `components/experience/Moment.tsx (MomentHero)`, `components/experience/primitives.tsx (MeterBar)`, `lib/nationalTeam/nationalTeam.ts`
- **Purpose:** Spatial headquarters: 11 rooms (manager, dressing, tactics, hall, board, press, scouting, medical, office, staff, trophies) with status, plus identity, supporters, rivals, honours and national team windows.
- **Main actions:** Select room on floorplan; Double-click/enter room; Kliv in i <room>; Room card 'Öppna' / 'Granska'; Open rival club
- **Current visual structure:** Arena photo MomentHero with crest; 'Anläggningen & Avdelningarna' = SVG court floorplan with absolutely-positioned room hotspots (status dot) beside a photo 'stage' of the selected room with metrics and CTA; then a gallery of 11 room cards with env photos; then 3 panels (Identitet, Läktaren/supporters meter/rivals/honours, Landslagsuppehåll).
- **Navigation relationships:** DSH-01, /career/squad, /career/tactics, /career/training, CLB-05, WLD-02, /career/scouting, MED-01, CLB-06, /career/staff, MGR-03, CLB-04
- **Desktop:** Two-column complex (floorplan | stage), 3-col panel grid.
- **Mobile:** ≤1100px complex and grid stack; ≤680px floorplan min-height 420px; hotspots tiny on phones.

**Strengths**
- The most game-like, image-rich surface in the product (10 environment photos)
- Rooms carry live status/alert tone, so it can act as a visual hub
- Supporters mood meter and national-team calendar add world texture

**Weaknesses**
- Duplicates sidebar navigation — rooms link to the same routes; three ways to enter a room (hotspot, stage CTA, card)
- Double-click to enter + hover-to-select on cards do not translate to touch
- Floorplan is abstract boxes over a court SVG, not an illustrated building
- Not the landing page — buried as 2nd nav item

**Redesign opportunities**
- Make Klubbhuset the primary hub (replace half the sidebar)
- Illustrated isometric clubhouse whose rooms visibly upgrade with economy tier (assets klubbhuset-local/pro/elite already exist but are unused)
- Single tap opens room; status badges as notifications

### CLB-01a · Interactive floorplan + room stage

- **Route:** `/career/klubbhuset` · **Kind:** panel · **Importance:** frequent · **Parent:** CLB-01
- **Components:** `app/career/klubbhuset/page.tsx (.kh-blueprint, .kh-stage)`
- **Purpose:** Pick a room to preview its status.
- **Main actions:** Click hotspot; Double-click to open; Kliv in i …; secondary link
- **Current visual structure:** Left: blueprint header, SVG court, % positioned hotspot buttons (wing, status dot, name, status), legend; Right: photo stage with wing · department, purpose, H3, summary, metric dl, CTA.
- **Navigation relationships:** (room routes)
- **Desktop:** Side by side
- **Mobile:** Stacked

**Strengths**
- aria-pressed, aria-live stage

**Weaknesses**
- Double-click affordance undiscoverable; hint text needed

**Redesign opportunities**
- Illustrated map; long-press preview on touch

### CLB-01b · Room cards gallery

- **Route:** `/career/klubbhuset` · **Kind:** panel · **Importance:** frequent · **Parent:** CLB-01
- **Components:** `app/career/klubbhuset/page.tsx (.kh-rooms)`
- **Purpose:** One-click entry per room with photo.
- **Main actions:** Öppna; Granska; hover selects
- **Current visual structure:** Grid of 11 cards: env photo top (wing, badge, title), purpose, metric dl, footer actions.
- **Navigation relationships:** (room routes)
- **Desktop:** Grid
- **Mobile:** Stacks

**Strengths**
- Photography makes departments tangible

**Weaknesses**
- Same photo reused for multiple rooms (11 rooms, 10 images)
- Hover side-effect changes the stage above

**Redesign opportunities**
- Use as hub cards on the dashboard

### CLB-01c · Identity / Supporters / National team panels

- **Route:** `/career/klubbhuset` · **Kind:** panel · **Importance:** occasional · **Parent:** CLB-01
- **Components:** `app/career/klubbhuset/page.tsx (.kh-grid)`
- **Purpose:** Club facts & colours, supporter mood, rivals, honours, national team breaks.
- **Main actions:** Open rival club
- **Current visual structure:** Three bd-panels: dl of facts with colour swatches; MeterBar + rivals list + honours list; list of national windows with dates/opponents/called players.
- **Navigation relationships:** CLB-04, WLD-05
- **Desktop:** 3 columns
- **Mobile:** 1 column

**Strengths**
- Unique world flavour (real EHF/IHF calendar)

**Weaknesses**
- Dense prose lists; national team info hidden here only

**Redesign opportunities**
- Trophy cabinet visual; supporter banner/tifo imagery

### CLB-02 · Klubb (own club overview)

- **Route:** `/career/club` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/club/page.tsx`, `components/game/Identity.tsx (ClubHero, PlayerCell)`, `components/manager/ClubContext.tsx`, `components/manager/Workspace.tsx (Panel)`, `components/game/profile-world.css`, `lib/economy/clubEconomyLabels.ts`
- **Purpose:** Own club profile: season facts, results/transfers/history, positional depth, top scorers, economy summary, partnerships.
- **Main actions:** Öppna truppen; Öppna tävlingen; Switch ClubContext tab; Trupp & lagbygge; Alla prestationer; Visa partnerskap
- **Current visual structure:** ClubHero; 4-cell facts strip (position, squad size, venue, staff); main column: ClubContext panel with tabs, 7-position depth tiles (MV V6 V9 M9 M6 H9 H6 counts), top-6 scorers list; right rail: Ekonomi panel with ~16 label/value FinanceRows and Klubbpartnerskap panel.
- **Navigation relationships:** /career/squad, /career/statistics, CLB-03, /career/competitions/[id], MGR-02
- **Desktop:** Main + 290–340px rail.
- **Mobile:** ≤1250px rail drops below (2-col), ≤760px single column; facts 2-col.

**Strengths**
- Positional depth tiles are a nice handball-specific visual
- Economy health badge

**Weaknesses**
- Economy rail is a 16-row label/value list with inline styles — a spreadsheet in a sidebar, duplicating Finance
- Overlaps heavily with Klubbhuset (CLB-01), Finance (CLB-06) and Squad
- FinanceRow uses inline flex/font-size styles rather than tokens

**Redesign opportunities**
- Merge with Klubbhuset as 'Klubben' hub (identity, facilities, economy summary as visual cards)
- Replace FinanceRows with 2–3 visual KPIs linking to Finance

### CLB-02a · ClubContext tabs (Resultat & form / Övergångar / Säsongshistorik)

- **Route:** `/career/club, /career/clubs/[clubId]` · **Kind:** tab · **Importance:** frequent · **Parent:** CLB-02
- **Components:** `components/manager/ClubContext.tsx`
- **Purpose:** Club-in-world context reused for own and other clubs.
- **Main actions:** Switch tab; Open fixture/report; Open player/club; Open historic season
- **Current visual structure:** Panel 'Klubben i karriärvärlden' with hm-tabs (aria-pressed buttons): results = form dots + fixture table (8); transfers = 5-col table; history = 4-col table.
- **Navigation relationships:** MGR-02, /career/match-report/[id], CLB-04
- **Desktop:** Panel
- **Mobile:** Tabs scroll-x

**Strengths**
- Reusable component

**Weaknesses**
- Tabs are local state (not URL), reset on navigation
- Transfers/history tables have no empty states styled beyond table

**Redesign opportunities**
- Timeline view of club story

### CLB-02b · Economy & partnerships rail

- **Route:** `/career/club` · **Kind:** panel · **Importance:** occasional · **Parent:** CLB-02
- **Components:** `app/career/club/page.tsx (FinanceRow)`
- **Purpose:** Revenue split, cash, wages vs budget, budgets, health; partnership status.
- **Main actions:** Visa partnerskap →
- **Current visual structure:** hm-panel with badge + eyebrow + 16 FinanceRows separated by dividers + muted note; partnership panel with up to 3 rows or 'Inget aktivt samarbete.'
- **Navigation relationships:** CLB-03, CLB-06
- **Desktop:** Rail
- **Mobile:** Below main

**Strengths**
- Warns when wages exceed budget

**Weaknesses**
- Pure numeric list; no chart; 11px/12px text

**Redesign opportunities**
- Mini stacked bar of revenue mix

### CLB-03 · Klubbpartnerskap

- **Route:** `/career/club/partnerships` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/club/partnerships/page.tsx`, `components/MoneyInput.tsx`, `lib/career/clubPartnerships.ts`
- **Purpose:** Permanent B-teams, development-partner search/agreement, player placements, international loan partnerships, history.
- **Main actions:** ← Klubb; Sök samarbetsklubb; Choose candidate + cost/month + duration → Ingå avtal; Förläng 6 månader; Avsluta samarbete; Place player at partner; Recall player; Create international loan (player, wage share %, end date)
- **Current visual structure:** Vertical stack of plain hm-panels: intro, 'Permanenta B-lag' 3-col table, 'Sök samarbetsklubb' (state machine: active / searching / candidates radio list + inline form / start button), PlacementPanel per relation (table + Place buttons), InternationalLoanPanel(s), 'Historik' 5-col table.
- **Navigation relationships:** CLB-02, CLB-04
- **Desktop:** Single column stack.
- **Mobile:** No page-specific CSS; tables likely overflow (no hm-scroll-x wrappers on these tables).

**Strengths**
- Complete feature with clear state copy (searching until date)
- Blockers explained

**Weaknesses**
- Pure admin form/table UI with inline styles (inputStyle object, radio labels styled as .hm-panel with inline borderColor)
- No hero, no partner crests, no imagery — the least 'game' page in scope
- '--' used as dash in copy ('Permanent -- kan inte sägas upp', 'Internationellt låneavtal -- …')
- Only reachable via a ghost button in Club rail

**Redesign opportunities**
- Partner network diagram (club → B-team / partner with crests and players on loan)
- Guided 'find partner' flow as a decision card

### CLB-03a · Partner search & agreement form

- **Route:** `/career/club/partnerships` · **Kind:** panel · **Importance:** occasional · **Parent:** CLB-03
- **Components:** `app/career/club/partnerships/page.tsx`
- **Purpose:** Ask the board to find a Division 1 partner, then agree terms.
- **Main actions:** Sök samarbetsklubb; Select candidate; Set cost/month; Set duration; Ingå avtal; Förläng; Avsluta
- **Current visual structure:** Panel body switching between 4 states; candidate list of radio labels; inline form row.
- **Navigation relationships:** —
- **Desktop:** Panel
- **Mobile:** Wraps

**Strengths**
- Explicit states

**Weaknesses**
- Termination is a single click, no confirm

**Redesign opportunities**
- Decision card with consequences

### CLB-03b · Placement & international loan panels

- **Route:** `/career/club/partnerships` · **Kind:** panel · **Importance:** rare · **Parent:** CLB-03
- **Components:** `app/career/club/partnerships/page.tsx (PlacementPanel, InternationalLoanPanel)`
- **Purpose:** Send/recall players to partner clubs; register foreign loans.
- **Main actions:** Place; Recall; Submit loan
- **Current visual structure:** Panel with player table + per-row buttons; loan panel with select, % input, date, submit.
- **Navigation relationships:** /career/squad/[playerId]
- **Desktop:** Panels
- **Mobile:** Overflow risk

**Strengths**
- Inline errors

**Weaknesses**
- Player rows text only

**Redesign opportunities**
- Drag player onto partner card

### CLB-04 · Other club profile

- **Route:** `/career/clubs/[clubId]` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/clubs/[clubId]/page.tsx`, `components/game/Identity.tsx (ClubHero)`, `components/manager/ClubContext.tsx`, `lib/identity/presentation.ts`, `lib/knowledge/clubVisibility.ts`
- **Purpose:** Profile for any non-own club: season facts, results/transfers/history, squad, fixtures, staff, club identity claims and head-coach philosophy (knowledge-gated).
- **Main actions:** Tillbaka; Switch ClubContext tab; Open player; Open fixture preview / match report; Open staff member; Öppna tävlingen
- **Current visual structure:** ClubHero + 4 facts (position, points, squad, staff) + partnership note; main: ClubContext, 'Trupp' table (Nr/Spelare/Pos/Ålder), 'Matcher' table, 'Personal' table, 'Klubbidentitet' claims by 7 domains, 'Tränarfilosofi' claims by 6 domains; knowledge tier/percentage gates detail.
- **Navigation relationships:** /career/squad/[playerId], /career/fixtures/[id], /career/match-report/[id], /career/staff/[staffId], /career/competitions/[id], MGR-02
- **Desktop:** Main + rail split (hm-world-split).
- **Mobile:** Stacks at ≤1250px; tables in hm-scroll-x.

**Strengths**
- Honest empty states ('Ingen truppdata tillgänglig…')
- Knowledge-gated scouting flavour
- Identity claims add narrative texture

**Weaknesses**
- Five stacked tables/panels with the same visual weight
- Identity claims shown as label lists rather than a personality profile
- Back button relies on router.back()

**Redesign opportunities**
- Opponent 'dossier' look: style radar, key players with faces, rivalry status, head-to-head
- Tabs: Översikt / Trupp / Matcher / Identitet

### CLB-04a · Club identity & coach philosophy panels

- **Route:** `/career/clubs/[clubId]` · **Kind:** panel · **Importance:** occasional · **Parent:** CLB-04
- **Components:** `app/career/clubs/[clubId]/page.tsx`, `lib/identity/presentation.ts`
- **Purpose:** Show club culture/tactical heritage and coach style claims at the manager's knowledge level.
- **Main actions:** —
- **Current visual structure:** Two hm-panels with grouped claim lists by domain label; empty states when no data.
- **Navigation relationships:** —
- **Desktop:** Main column
- **Mobile:** Stacked

**Strengths**
- Unique narrative data

**Weaknesses**
- Read like database fields

**Redesign opportunities**
- Visual identity card / personality wheel

### CLB-05 · Styrelserummet (Board)

- **Route:** `/career/board` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/board/page.tsx`, `components/experience/Moment.tsx (MomentHero, DecisionCard)`, `components/experience/primitives.tsx (MeterBar)`, `components/board/boardVisuals.ts`, `components/board/board.css`, `lib/board/board.ts`, `lib/manager/managerCareer.ts`
- **Purpose:** Board confidence and why, season objectives, manager contract and offers, meeting minutes, recovery plan.
- **Main actions:** Lämna handlingsplan (when warned); Skriv på / Tacka nej (contract offer); Din karriär →
- **Current visual structure:** Boardroom photo MomentHero (verdict stamp if a meeting in last 21 days, else neutral); 2×2 grid of bd-panels: Förtroende (meter, trend sparkline SVG with warning/dismissal lines, factor list +/-), Säsongens mål (objectives with status pills, why, progress), Kontraktet (dl + DecisionCard), Möten (protocol list).
- **Navigation relationships:** MGR-01, DSH-01
- **Desktop:** Hero + 2-column grids.
- **Mobile:** ≤1000px single column; ≤640px contract dl 2-col.

**Strengths**
- Good narrative framing ('Hur styrelsen ser på dig'); transparent thresholds
- DecisionCard pattern makes consequences explicit
- Confidence trend sparkline

**Weaknesses**
- Board members are faceless — no people, only a room photo
- Thresholds explained in a dense paragraph
- Objectives list is text + pill; no progress bars

**Redesign opportunities**
- Board table with named members and moods
- Objective progress meters
- Meeting as a scene (dialogue) rather than minutes list

### CLB-05a · Board verdict hero

- **Route:** `/career/board` · **Kind:** state · **Importance:** frequent · **Parent:** CLB-05
- **Components:** `components/experience/Moment.tsx (MomentHero)`
- **Purpose:** Show latest board verdict prominently for 21 days.
- **Main actions:** —
- **Current visual structure:** MomentHero with tone (gold/ink/loss), stamp (Nöjd/Godkänt/Oroad/Varning/Avsked), headline and lede.
- **Navigation relationships:** —
- **Desktop:** Wide hero
- **Mobile:** Stacks

**Strengths**
- Emotional framing with stamp

**Weaknesses**
- Same photo for every verdict

**Redesign opportunities**
- Verdict-specific imagery

### CLB-05b · Recovery-plan & contract-offer decision cards

- **Route:** `/career/board` · **Kind:** panel · **Importance:** occasional · **Parent:** CLB-05
- **Components:** `components/experience/Moment.tsx (DecisionCard)`
- **Purpose:** Respond to board warnings and contract offers.
- **Main actions:** Lämna handlingsplan; Skriv på; Tacka nej
- **Current visual structure:** DecisionCard: title, status pill (deadline), primary button with consequence line, secondary button; result message as role=status note.
- **Navigation relationships:** —
- **Desktop:** In panel
- **Mobile:** In panel

**Strengths**
- Consequence-first design

**Weaknesses**
- Embedded inside dense panels — easy to miss; also blocks Continue ('Styrelsemöte')

**Redesign opportunities**
- Promote to modal 'meeting' moment

### CLB-06 · Finanscentralen (Finance)

- **Route:** `/career/finance` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/finance/page.tsx`, `components/finance/FinanceCharts.tsx (CashLineChart, CategoryBars, StackedBars)`, `components/finance/finance.css`, `components/experience/CourtBackdrop.tsx`, `components/experience/primitives.tsx (Stat)`, `lib/economy/*`
- **Purpose:** Club finances: cash trend, warnings/decisions, flows, budget reallocation, monthly ledger, wage commitments, forecast.
- **Main actions:** Switch tab (URL ?tab=); Reallocate budget (Budget tab); Open players from wage list
- **Current visual structure:** Status band (court-line backdrop, H1 'Finanscentralen', headline sentence, status pill, 3 Stats: Kassa / Senaste månad / Prognos 31 maj) + tab bar with 6 tabs, each tab a 2-col grid of fc-panels with SVG charts and tables.
- **Navigation relationships:** /career/squad/[playerId], CLB-05, /career/transfers
- **Desktop:** Band + 2-col grid.
- **Mobile:** ≤1100px band/grid single column; ≤760px stats stack, bars reflow.

**Strengths**
- Real charts (line with overdraft line, category bars, stacked bars) with draw-in animation + reduced-motion
- Narrative headline sentence summarises status
- Tabs are URL-addressable

**Weaknesses**
- Ledger/wages/forecast tabs are long multi-column numeric tables (forecast table ≥5 money columns)
- Six tabs of accounting depth for a sports game; budget decisions buried in tab 3
- No link from warnings to the actions that fix them (e.g. sell player)

**Redesign opportunities**
- Lead with 3 visual KPIs + one decision; move ledger to 'Detaljer'
- Tie finance to football: 'this signing costs X of your budget' simulations

### CLB-06a · Tab · Översikt

- **Route:** `/career/finance` · **Kind:** tab · **Importance:** frequent · **Parent:** CLB-06
- **Components:** `app/career/finance/page.tsx (Overview)`, `components/finance/FinanceCharts.tsx (CashLineChart)`
- **Purpose:** Cash month-by-month (12 actual + 9 projected), warnings & decisions, season so far.
- **Main actions:** Decision links
- **Current visual structure:** Line chart panel, warnings panel (EventCard-like items with tone/consequence), season summary panel.
- **Navigation relationships:** —
- **Desktop:** 2-col
- **Mobile:** 1-col

**Strengths**
- Best data viz in scope

**Weaknesses**
- Warnings are text cards

**Redesign opportunities**
- Make warnings actionable buttons

### CLB-06b · Tab · Intäkter & kostnader

- **Route:** `/career/finance?tab=flows` · **Kind:** tab · **Importance:** occasional · **Parent:** CLB-06
- **Components:** `app/career/finance/page.tsx (Flows)`, `components/finance/FinanceCharts.tsx (CategoryBars)`
- **Purpose:** Income/cost categories and matchday gate revenue.
- **Main actions:** —
- **Current visual structure:** Two CategoryBars panels + 5-col match table (date, opponent crest, attendance, occupancy fill bar, revenue). Empty: 'Första månadsbokslutet kommer…'
- **Navigation relationships:** —
- **Desktop:** 2-col
- **Mobile:** 1-col

**Strengths**
- Opponent crests + occupancy bars

**Weaknesses**
- Table-heavy

**Redesign opportunities**
- Arena fill visual

### CLB-06c · Tab · Budget

- **Route:** `/career/finance?tab=budget` · **Kind:** tab · **Importance:** occasional · **Parent:** CLB-06
- **Components:** `app/career/finance/page.tsx (Budget)`
- **Purpose:** Board frames and up to 15% budget reallocation.
- **Main actions:** Shift budget between areas; Confirm plan
- **Current visual structure:** Panel 'Budgeten' with board frames and allocation controls (StackedBars).
- **Navigation relationships:** —
- **Desktop:** Panel
- **Mobile:** Stacked

**Strengths**
- Real decision

**Weaknesses**
- Hidden in 3rd tab; the only decision in Finance

**Redesign opportunities**
- Promote to season-start board meeting moment

### CLB-06d · Tab · Huvudbok (ledger)

- **Route:** `/career/finance?tab=ledger` · **Kind:** tab · **Importance:** rare · **Parent:** CLB-06
- **Components:** `app/career/finance/page.tsx (Ledger)`
- **Purpose:** Monthly statements.
- **Main actions:** Select month
- **Current visual structure:** Month selector + statement table with colour swatches per category, one-off transactions, opening/closing cash. Empty state text.
- **Navigation relationships:** —
- **Desktop:** Split
- **Mobile:** 1-col

**Strengths**
- Category swatches

**Weaknesses**
- Pure accounting table

**Redesign opportunities**
- Collapse into expandable detail

### CLB-06e · Tab · Lönekontrakt

- **Route:** `/career/finance?tab=wages` · **Kind:** tab · **Importance:** occasional · **Parent:** CLB-06
- **Components:** `app/career/finance/page.tsx (Wages)`
- **Purpose:** Commitments per season, staff costs, player wage list.
- **Main actions:** Open player
- **Current visual structure:** Commitments panel, staff panel, 4-col wage table with PlayerCell.
- **Navigation relationships:** /career/contracts, /career/squad/[playerId]
- **Desktop:** Panels
- **Mobile:** Scroll-x tables

**Strengths**
- Remaining-to-pay column useful

**Weaknesses**
- Overlaps Contracts page

**Redesign opportunities**
- Merge with Kontrakt

### CLB-06f · Tab · Prognos

- **Route:** `/career/finance?tab=forecast` · **Kind:** tab · **Importance:** rare · **Parent:** CLB-06
- **Components:** `app/career/finance/page.tsx (Forecast)`
- **Purpose:** Projection to season end with assumptions and month table.
- **Main actions:** —
- **Current visual structure:** Projected CashLineChart, assumptions panel, wide month-by-month table, calibration note.
- **Navigation relationships:** —
- **Desktop:** Panels
- **Mobile:** Scroll-x

**Strengths**
- Assumptions disclosed

**Weaknesses**
- Wide numeric table

**Redesign opportunities**
- What-if sliders

## SQD — Squad & players

### SQD-01 · Truppen & Omklädningsrummet (squad list)

- **Route:** `/career/squad` · **Kind:** page · **Importance:** core
- **Components:** `app/career/squad/page.tsx`, `components/clubhq/EnvironmentBanner.tsx`, `components/game/Identity.tsx (SquadDepth, PlayerCell)`, `components/SortableTh.tsx`, `components/players/PlayerDynamicsPanel.tsx (MoraleBadge)`, `components/players/PlayerFormSparkline.tsx`, `components/game/squad-season.css`
- **Purpose:** Primary roster workspace: review every own player's form, physical state, contract and squad role; set captain and squad-status tier; pick two players to compare.
- **Main actions:** Switch view tab (Översikt / Prestation / Fysisk status / Kontrakt); Search by name; Filter by position (select + 7 position chips below table); Filter by state (Tillgängliga / Otillgängliga / Energi under 75%); Toggle form mode (last 5 played vs last 5 fixtures incl. DNP); Sort 12 columns; Change squad-role tier per row (inline select); Tick up to 2 players for compare/captaincy; Appoint captain from selection aside; Open player dossier; Jump to Taktik / Kontrakt
- **Current visual structure:** Photo EnvironmentBanner (dressing room) with 3 metric tiles (squad size, match fitness avg, captain) and 2 CTA buttons; SquadDepth strip (7 position cards); a hm-tabs row of 4 buttons; one Panel with filter bar and a horizontally scrolling hm-roster-table whose columns change per tab (Overview shows ~19 columns: checkbox, Nr, Spelare, Pos, Ålder, Moral, Trupproll, M, Starter, Mål, Skott%, Räddn%, Betyg, Form(5M), Energi, Matchträning, Tillgänglighet, Återkomst, Avtal till); duplicate position-chip row after the panel.
- **Navigation relationships:** /career/tactics, /career/contracts, /career/compare?left&right, /career/squad/[playerId]
- **Desktop:** Single column, full width; table relies on .hm-scroll-x horizontal scrolling.
- **Mobile:** No page-specific breakpoint for the roster table; squad-season.css has @media (max-width:800px/1250px) for depth/heading only – table becomes a sideways-scrolling 19-column grid.

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

**Redesign opportunities**
- Card/list hybrid with a player "chip" showing energy, fitness, morale and form as micro-visuals; columns become optional
- Positional depth chart (court-shaped) instead of a flat strip
- Saved views (e.g. "Matchday readiness", "Contract risk") replacing 4 hard tabs
- Multi-select tray with actions (compare, set roles, rest, list for transfer)

### SQD-01a · Tab "Översikt"

- **Route:** `/career/squad` · **Kind:** tab · **Importance:** core · **Parent:** SQD-01
- **Components:** `app/career/squad/page.tsx`
- **Purpose:** Default view combining performance, physical and contract-end columns.
- **Main actions:** Sort; Select; Set squad role
- **Current visual structure:** Roster table with performance + physical columns + Avtal till.
- **Navigation relationships:** SQD-01
- **Desktop:** Horizontal scroll at <1600px.
- **Mobile:** Horizontal scroll.

**Strengths**
- One-glance health check

**Weaknesses**
- Widest table in the game; least scannable

**Redesign opportunities**
- Make overview a curated 6–8 column summary with expandable rows

### SQD-01b · Tab "Prestation"

- **Route:** `/career/squad` · **Kind:** tab · **Importance:** frequent · **Parent:** SQD-01
- **Components:** `app/career/squad/page.tsx`, `components/players/PlayerFormSparkline.tsx`, `lib/career/playerForm.ts`
- **Purpose:** Season output per player.
- **Main actions:** Sort by M, Starter, Mål, Betyg; Toggle form mode
- **Current visual structure:** Columns M, Starter, Mål, Skott % / försök, Räddningar % / mötta, Betyg (1–10 avg), Form (5M) sparkline.
- **Navigation relationships:** SQD-01
- **Desktop:** Fits better than overview.
- **Mobile:** Scroll.

**Strengths**
- Shooting and save efficiency shown with sample size

**Weaknesses**
- Shot% and save% not sortable; no per-60 or per-match normalisation

**Redesign opportunities**
- Small multiples / sparkline per metric; position-aware metric sets (GK vs outcourt)

### SQD-01c · Tab "Fysisk status"

- **Route:** `/career/squad` · **Kind:** tab · **Importance:** frequent · **Parent:** SQD-01
- **Components:** `app/career/squad/page.tsx`, `lib/training/readinessSummary.ts`, `lib/players/matchFitness.ts`
- **Purpose:** Readiness: energy, match fitness, 7-day load, load trend, recovery outlook, availability and return date.
- **Main actions:** Sort by Energi / Belastning 7 d
- **Current visual structure:** Columns Energi %, Matchträning %, Belastning 7 d, Trend (↑/→/↓), Återhämtning (God/Normal/Nedsatt, reasons in tooltip), Tillgänglighet badge, Återkomst date.
- **Navigation relationships:** TRN-01, MDY-01
- **Desktop:** OK.
- **Mobile:** Tooltips unusable on touch.

**Strengths**
- Separates energy (day form) from match fitness (match sharpness)
- Reasons for recovery outlook available as tooltip

**Weaknesses**
- Readiness reasons hidden in title tooltips (not touch-accessible)
- No visual thresholds/trend lines; numbers only

**Redesign opportunities**
- Readiness heat-strip per player (energy, fitness, load ratio) with explicit risk bands

### SQD-01d · Tab "Kontrakt"

- **Route:** `/career/squad` · **Kind:** tab · **Importance:** occasional · **Parent:** SQD-01
- **Components:** `app/career/squad/page.tsx`
- **Purpose:** Contract end and wage per player.
- **Main actions:** Sort by Avtal till / Lön; Link "Förläng / profil →"
- **Current visual structure:** Columns Avtal till, Lön / månad, Åtgärd link; drops Trupproll column.
- **Navigation relationships:** SQD-05, SQD-02e
- **Desktop:** Narrow table.
- **Mobile:** OK.

**Strengths**
- Quick wage overview

**Weaknesses**
- Duplicates /career/contracts (SQD-05) with fewer features; link goes to profile, not to the renewal panel

**Redesign opportunities**
- Remove in favour of a single contracts surface or deep-link to renewal

### SQD-01e · Selection aside "Spelardossier & jämförelse"

- **Route:** `/career/squad` · **Kind:** panel · **Importance:** occasional · **Parent:** SQD-01
- **Components:** `app/career/squad/page.tsx`
- **Purpose:** Appears when 1–2 rows ticked: availability/energy/fitness line, captain button, dossier link, compare CTA in panel header.
- **Main actions:** Utse till kapten; Spelardossier →; Jämför valda spelare →; Rensa val
- **Current visual structure:** aria-live aside above the table listing chosen players with inline buttons.
- **Navigation relationships:** SQD-04, SQD-02
- **Desktop:** Inline above table.
- **Mobile:** Wraps.

**Strengths**
- aria-live announces selection

**Weaknesses**
- Mixes two unrelated jobs (compare vs captaincy)
- Compare CTA lives in panel header, far from the aside

**Redesign opportunities**
- Floating selection tray with contextual actions

### SQD-01f · Panel "Truppens balans" (SquadDepth)

- **Route:** `/career/squad` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-01
- **Components:** `components/game/Identity.tsx (SquadDepth)`
- **Purpose:** Available/total per primary position (V6, V9, M9, M6, H9, H6, MV).
- **Main actions:** None (read-only)
- **Current visual structure:** Overline "SJU POSITIONER. ETT LAG." + 7 position cards.
- **Navigation relationships:** SQD-01
- **Desktop:** Row of 7.
- **Mobile:** Wraps.

**Strengths**
- Handball-specific framing

**Weaknesses**
- Not clickable as a filter even though a separate chip row does exactly that
- Ignores secondary positions

**Redesign opportunities**
- Court-shaped depth chart with secondary-position depth and click-to-filter

### SQD-01g · Empty filter state

- **Route:** `/career/squad` · **Kind:** state · **Importance:** rare · **Parent:** SQD-01
- **Components:** `components/manager/Workspace.tsx (EmptyState)`
- **Purpose:** "Inga spelare matchar dina filter." under an empty table.
- **Main actions:** Rensa filter (in filter bar)
- **Current visual structure:** EmptyState text below table headers.
- **Navigation relationships:** SQD-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Clear filter reset exists

**Weaknesses**
- Reset button not repeated in the empty state

**Redesign opportunities**
- Empty state with one-click reset

### SQD-02 · Spelarprofil (player dossier)

- **Route:** `/career/squad/[playerId]` · **Kind:** page · **Importance:** core
- **Components:** `app/career/squad/[playerId]/page.tsx`, `components/game/Identity.tsx (PlayerHero)`, `components/manager/PlayerActions.tsx`, `components/game/PlayerCondition.tsx`, `components/players/PlayerDynamicsPanel.tsx`, `components/GameplayProfilePanels.tsx`, `components/KnowledgeGatedProfilePanels.tsx`, `components/ScoutReportPanel.tsx`, `components/ContractRenewal.tsx`, `components/transfers/PlayerTransferCard.tsx`, `components/manager/PlayerPerformance.tsx`, `components/players/DevelopmentHistory.tsx`, `components/game/profile-world.css`
- **Purpose:** Single dossier for ANY player (own, external, free agent, retired): identity, condition, morale/person management, ability/attributes (full for own, knowledge-gated for external), scouting report, contract, transfer status, medical, history.
- **Main actions:** Back (context-aware: Trupp / Transfers / Klubb); Switch 6 tabs; Jämför spelare; Own: Matchtrupp & startsju / Kontraktsöversikt / Träning & belastning links; External: Kortlista / Scouta spelare / Förhandla; Answer player concerns, transfer requests, list/unlist, release (with confirm); Open renewal talks / submit renewal offer / withdraw; Start scouting assignment; Förhandla om övergång / Föreslå lån
- **Current visual structure:** Photo PlayerHero (dressing-room backdrop) with back button; PlayerActions button row; own-player Tillstånd panel; hm-profile-tabs (6 buttons); body is hm-profile-split (main column + hm-world-rail) whose content is recomposed per tab from shared blocks (attributes, ability, contract, history, body, report, medical).
- **Navigation relationships:** /career/squad, /career/transfers, /career/clubs/[clubId], /career/compare, /career/tactics, /career/contracts, /career/training, /career/scouting?target, /career/transfers/[playerId], /career/transfers/offers/[offerId], /career/history?season
- **Desktop:** Two-column split (main + rail ~340–420px; wider at ≥2100px).
- **Mobile:** profile-world.css: ≤1250px collapses to one column and rail becomes 2-col grid; ≤760px further stacking. Attribute grid uses auto-fill minmax(205px) so it reflows.

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

**Redesign opportunities**
- Collapse to 3–4 purposeful tabs (Overview, Attributes & development, Contract & transfer, History) with URL-addressable tabs
- Attribute visualisation with history deltas (development events carry previous→new values)
- Knowledge uncertainty as visual ranges (error bars) rather than text ranges
- Unified "person" timeline: morale factors, promises, talks, injuries, transfers

### SQD-02a · Tab "Profil & egenskaper" (overview)

- **Route:** `/career/squad/[playerId]` · **Kind:** tab · **Importance:** core · **Parent:** SQD-02
- **Components:** `app/career/squad/[playerId]/page.tsx`
- **Purpose:** Season-in-numbers strip, PlayerDynamicsPanel (own), attributes; rail with ability, scout report (external), medical and a "Din nästa bedömning" note.
- **Main actions:** Visa kontrakt / Visa prestation shortcuts
- **Current visual structure:** 4-stat strip (starts, shots/faced, efficiency/save%, goals/shots) + panels.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Position-aware stat strip (GK vs outcourt)

**Weaknesses**
- Very long scroll for own players: dynamics + full 56-attribute grid

**Redesign opportunities**
- Summary hero with key ratings; push detailed grids to Attributes tab

### SQD-02b · Tab "Prestation & historik"

- **Route:** `/career/squad/[playerId]` · **Kind:** tab · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/manager/PlayerPerformance.tsx`
- **Purpose:** Season performance strip, last 12 matches table (Datum, Match, Resultat, Start, Min, Mål/skott, Räddningar, Betyg) and season history table.
- **Main actions:** Open club / history season links
- **Current visual structure:** Three Panels stacked.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Match-by-match log with rating

**Weaknesses**
- No charts; same component reused in "Klubbhistorik" tab

**Redesign opportunities**
- Rating/goal trend chart; per-match drill to match report

### SQD-02c · Tab "Egenskaper"

- **Route:** `/career/squad/[playerId]` · **Kind:** tab · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/GameplayProfilePanels.tsx`, `components/KnowledgeGatedProfilePanels.tsx`
- **Purpose:** Attribute grid in main column; rail with ability, body profile and scout report.
- **Main actions:** Read
- **Current visual structure:** GameplayAttributesPanel + rail.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Dedicated attributes view

**Weaknesses**
- Near-duplicate of overview tab

**Redesign opportunities**
- Merge with overview or turn into a comparison-ready attribute workspace

### SQD-02d · Tab "Utveckling"

- **Route:** `/career/squad/[playerId]` · **Kind:** tab · **Importance:** occasional · **Parent:** SQD-02
- **Components:** `app/career/squad/[playerId]/page.tsx (DevelopmentPanel)`, `components/players/DevelopmentHistory.tsx`
- **Purpose:** Own: current level & potential stars, individual focus label, last 5 development events. External: explanatory note only.
- **Main actions:** None (focus is changed only on /career/training)
- **Current visual structure:** Key-value rows + event list; body profile; rail ability + medical.
- **Navigation relationships:** TRN-01d
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Shows concrete attribute changes

**Weaknesses**
- Read-only: individual focus cannot be changed here (lives on Training)
- Star text strings instead of a progression visual

**Redesign opportunities**
- Development curve (CA over time vs PA band), editable focus in place

### SQD-02e · Tab "Kontrakt"

- **Route:** `/career/squad/[playerId]` · **Kind:** tab · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/ContractRenewal.tsx`, `components/transfers/PlayerTransferCard.tsx`
- **Purpose:** Contract panel (owning club, wage, end, shirt no.) + renewal flow, transfer status card, market value (exact for own, range for external); rail club history & training compensation.
- **Main actions:** Inled förlängningssamtal; Förläng kontrakt; Dra dig ur; Förhandla om övergång; Föreslå lån
- **Current visual structure:** Stacked panels.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Renewal shows demand factors with ±% chips and expected role

**Weaknesses**
- Market value and contract split across 3 panels; no wage-budget context inline

**Redesign opportunities**
- Contract "deal sheet" with budget impact bar and demand breakdown chart

### SQD-02f · Tab "Klubbhistorik"

- **Route:** `/career/squad/[playerId]` · **Kind:** tab · **Importance:** rare · **Parent:** SQD-02
- **Components:** `app/career/squad/[playerId]/page.tsx`, `components/manager/PlayerPerformance.tsx`
- **Purpose:** Club history entries (age ranges), training compensation breakdown, then PlayerPerformance again; rail body profile.
- **Main actions:** Read
- **Current visual structure:** Panels.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Training compensation explained separately from market value

**Weaknesses**
- Repeats performance tab content

**Redesign opportunities**
- Career timeline visual

### SQD-02g · PlayerHero + PlayerActions

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** core · **Parent:** SQD-02
- **Components:** `components/game/Identity.tsx (PlayerHero)`, `components/manager/PlayerActions.tsx`
- **Purpose:** Identity header (name, number, position, age, nation, club colours, status, squad tier, captain/7m) + contextual action buttons.
- **Main actions:** Back; Jämför; Kortlista; Scouta; Förhandla; Own-player links
- **Current visual structure:** Photo hero band followed by a row of small buttons.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Club-colour theming

**Weaknesses**
- Action row is a flat list of 3–4 equal-weight buttons; primary action unclear for own players

**Redesign opportunities**
- Sticky compact hero with one primary contextual CTA

### SQD-02h · Panel "Tillstånd" (PlayerConditionPanel)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/game/PlayerCondition.tsx`
- **Purpose:** Own players: availability chip, selectable state, injury & rehab, return date, match-fitness band, two <meter> bars (Energi, Matchträning).
- **Main actions:** Read
- **Current visual structure:** Definition list + meters.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Explains "rested but injured" edge case

**Weaknesses**
- Native <meter> styling inconsistent across browsers

**Redesign opportunities**
- Condition gauge set shared with squad and matchday

### SQD-02i · Panel "Spelaren som person" (PlayerDynamicsPanel)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/players/PlayerDynamicsPanel.tsx`, `components/experience (DecisionCard, EventCard, MeterBar)`
- **Purpose:** Morale meter (0–100, target), morale factor chips, intention summary, pre-contract warning, player concerns with option buttons, transfer request DecisionCard (accept/promise/refuse), promises list, incoming bids, transfer-list and release actions with inline confirm.
- **Main actions:** Answer concern option; Godkänn/Övertala/Avslå transfer request; Öppna budet; Transferlista / Ta bort; Bryt avtalet… → Bekräfta
- **Current visual structure:** pd-panel section with header meter and stacked decision cards.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Consequences shown on every option
- Morale impact capped and explained (±3 %)

**Weaknesses**
- Destructive "Bryt avtalet" is a small button next to transfer listing
- Status messages rendered as plain text line

**Redesign opportunities**
- Person timeline + mood chart; separate danger zone

### SQD-02j · Panel "Spelaregenskaper (skala 1–20)" (GameplayAttributesPanel)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** core · **Parent:** SQD-02
- **Components:** `components/GameplayProfilePanels.tsx`, `lib/rating/types.ts`, `lib/rating/attributeVocabulary.ts`
- **Purpose:** Own players: radar of 6 outcourt families (Teknik, Perception/beslut, Taktik, Försvar, Fysik, Mental) or 4 GK families, family averages with bars, then every attribute (56 outcourt / 21 GK) with a tier-coloured bar and value; dots mark evidence-backed/editor values.
- **Main actions:** Read (hover tooltip for origin)
- **Current visual structure:** Dark gradient header strip (160px radar + family tiles) then FamilyBlocks in auto-fill grid.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Complete, well-grouped attribute model; radar gives shape at a glance

**Weaknesses**
- Hard-coded hex colours/gradients; tier colours (≥15 green, ≥12 blue, ≥9 grey, else amber) not tokenised
- No comparison/delta, no position-weighting highlight

**Redesign opportunities**
- Role-weighted highlights, deltas since last month, compare overlay

### SQD-02k · Panel "Förmåga & Positionskarta" (GameplayAbilityPanel)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/GameplayProfilePanels.tsx`, `lib/rating/presentation.ts`
- **Purpose:** CA/PA as 1–5 stars, mini-court with 7 position spots (primary highlighted), attack and defence role proficiencies as text.
- **Main actions:** Read
- **Current visual structure:** Stars rows + SVG mini court + role rows.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Handball court metaphor

**Weaknesses**
- Only primary position lit; secondary positions and proficiency levels not visualised

**Redesign opportunities**
- Position suitability heat on court (primary/secondary/role proficiency)

### SQD-02l · Knowledge-gated panels (external players)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/KnowledgeGatedProfilePanels.tsx`, `lib/knowledge/careerVisibility.ts`, `lib/knowledge/types.ts`
- **Purpose:** External players: ability/potential as star ranges (e.g. "2–4 ★") with knowledge tier badge (Mycket begränsad / Begränsad / Måttlig / God kännedom); attributes reduced to strengths/weaknesses lists.
- **Main actions:** Read
- **Current visual structure:** Two panels replacing ability and attribute panels.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Honest uncertainty model

**Weaknesses**
- Text-only; uncertainty not visual
- Low-knowledge message offers no direct "scout now" button in this panel

**Redesign opportunities**
- Range bars that tighten as knowledge grows; inline scout CTA

### SQD-02m · Panel "Scoutingrapport" (ScoutReportPanel)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/ScoutReportPanel.tsx`, `lib/knowledge/scoutReportVisibility.ts`
- **Purpose:** Estimated market value range, scout confidence %, recommendation text, strengths/weaknesses, report history (scout + date), "Scouta spelare" CTA or no-scout notice.
- **Main actions:** Scouta spelare → /career/scouting?target
- **Current visual structure:** Panel with stamp ("Rapport tillgänglig"/"Första observation").
- **Navigation relationships:** SQD-02, REC-01
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Report metaphor with stamp and history

**Weaknesses**
- Only latest report shown; no diff between reports

**Redesign opportunities**
- Report timeline showing how ranges narrowed

### SQD-02n · Panel "Förläng kontrakt" (ContractRenewal)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/ContractRenewal.tsx`, `components/MoneyInput.tsx`
- **Purpose:** Renewal state machine: intention summary, blocker note, open talks, demand vs current wage, expected role, demand factors (±%), last response quote, waiting state with answer date, offer form (1–4 years, wage, optional role promise), signing MomentHero after agreement.
- **Main actions:** Inled förlängningssamtal; Förläng kontrakt; Dra dig ur
- **Current visual structure:** pd-renewal block inside contract panel (also embedded on /career/contracts).
- **Navigation relationships:** SQD-02e, SQD-05a
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Asynchronous negotiation made explicit (answer next day)

**Weaknesses**
- Feedback via a plain status line; no budget impact shown

**Redesign opportunities**
- Show payroll/budget delta and acceptance likelihood

### SQD-02o · Panel "Transferläge" (PlayerTransferCard)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-02
- **Components:** `components/transfers/PlayerTransferCard.tsx`
- **Purpose:** Ownership vs playing club chips, loan progress line, contract facts, competing interest, promise kept/broken, negotiation CTA with deadline clock.
- **Main actions:** Förhandla om övergång / Ditt drag; Föreslå lån
- **Current visual structure:** tc-panel card.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Loan progress bar and deadline urgency

**Weaknesses**
- Uses Transfer Centre visual skin (tc-*) inside profile skin – visual mismatch

**Redesign opportunities**
- Unified card system

### SQD-02p · Panel "Medicinskt" (MedicalPanel)

- **Route:** `/career/squad/[playerId]` · **Kind:** panel · **Importance:** occasional · **Parent:** SQD-02
- **Components:** `app/career/squad/[playerId]/page.tsx (MedicalPanel)`, `lib/medical/labels.ts`
- **Purpose:** Availability, active injury type/severity/rehab phase/return date/rehab %, last 5 injuries.
- **Main actions:** Read
- **Current visual structure:** Key-value rows.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Complete injury facts

**Weaknesses**
- Duplicates Tillstånd panel facts for own players; no link to /career/medical

**Redesign opportunities**
- Body map / rehab timeline

### SQD-02q · Loading / not-found states

- **Route:** `/career/squad/[playerId]` · **Kind:** state · **Importance:** rare · **Parent:** SQD-02
- **Components:** `app/career/squad/[playerId]/page.tsx`
- **Purpose:** "Läser in spelarbetyg…" while real-world ratings fetch from /api/game-world/gameplay-ratings; "Spelaren hittades inte." when id unknown.
- **Main actions:** None
- **Current visual structure:** Plain muted panel text.
- **Navigation relationships:** SQD-02
- **Desktop:** Inside profile split layout.
- **Mobile:** Stacks under ≤1250px.

**Strengths**
- Honest fallback (null rating → mock display)

**Weaknesses**
- No skeleton; not-found has no way back

**Redesign opportunities**
- Skeleton states; not-found with search/back

### SQD-03 · Spelarsök (player market search)

- **Route:** `/career/players` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/players/page.tsx`, `components/game/RecruitmentPresentation.tsx (KnowledgeMeter, RecruitmentTag)`, `components/game/Identity.tsx`, `components/game/recruitment-news.css`
- **Purpose:** Search every non-own, non-retired player in the world; shortlist; open dossier/scouting/transfer.
- **Main actions:** Search name/club; Filter position, max age, nationality, competition, contract (expiring / free agents); Sort Spelare/Ålder/Kännedom/Avtal/Mål; Paginate (60 per page); + Kortlista toggle; Visa (select into dossier); Jämför; Open profile / Scouta / Öppna bud & budget
- **Current visual structure:** PageHeading + "game-market-stage" band with 3 counters (players on market, shortlist, scouts); two-column layout: results Panel (6-filter bar, 9-column table, pager) + sticky "Spelardossier" aside with PlayerHero, KnowledgeMeter, facts and 3 CTAs.
- **Navigation relationships:** /career/recruitment?view=SHORTLIST, /career/squad/[id], /career/scouting?target, /career/transfers?target, /career/compare?left
- **Desktop:** Grid minmax(0,1fr) + 425px dossier at ≥2200px, 320px at ≤1200px.
- **Mobile:** ≤900px: single column (dossier below results).

**Strengths**
- Master-detail layout with persistent dossier
- Knowledge meter per row communicates uncertainty
- Recruitment status tag per row

**Weaknesses**
- No ability/potential/value column – the only sortable quality signal is goals
- Overlaps heavily with Transfer Centre "Hela marknaden" and Recruitment Centre lists (3 player-market tables)
- Pagination instead of virtualised list
- Default selection silently picks first row of page

**Redesign opportunities**
- Merge into one Market workspace with Recruitment/Transfers
- Show knowledge-gated ability range as a visual band column
- Saved searches and need-based presets

### SQD-03a · Dossier aside "Spelardossier"

- **Route:** `/career/players` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-03
- **Components:** `app/career/players/page.tsx`, `components/game/Identity.tsx (PlayerHero)`
- **Purpose:** Selected player preview.
- **Main actions:** Öppna spelarprofil; Scouta spelare; Öppna bud & budget
- **Current visual structure:** Heading + tag, PlayerHero, knowledge meter, 3 facts, 3 buttons.
- **Navigation relationships:** SQD-02, REC-01, REC-03
- **Desktop:** Right rail.
- **Mobile:** Below table.

**Strengths**
- Fast triage without page change

**Weaknesses**
- Shows no ability information even when known

**Redesign opportunities**
- Mini scout report in dossier

### SQD-04 · Jämför spelare

- **Route:** `/career/compare?left=&right=` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/compare/page.tsx`, `components/manager/PlayerActions.tsx`, `lib/knowledge/careerVisibility.ts`
- **Purpose:** Side-by-side comparison of two players (own or external) with role-relevant attributes.
- **Main actions:** Pick Spelare A / B from grouped selects (Din trupp / Övriga världen); Open player/club; PlayerActions per side
- **Current visual structure:** Two selects; Panel "Profil & prestation" (15-row comparison table: klubb, position, ålder, kännedom, bedömd nivå range, styrkor, utvecklingsområden, matcher/starter, mål/skott, skotteffektivitet, räddningar, snittbetyg, energi, avtal, lön); Panel "Egenskaper för <pos>" with 6 position-relevant 1–20 attributes (own players only); action rows; empty state if B missing.
- **Navigation relationships:** /career/players, SQD-02
- **Desktop:** Two-column table.
- **Mobile:** Table remains; selects wrap.

**Strengths**
- URL-addressable selection
- Respects knowledge gating
- Position-relevant attribute subsets (RELEVANT map)

**Weaknesses**
- Select lists contain every player in the world (thousands) with no search
- No visual diff (bars/radar overlay), no winner highlighting
- External attributes blank in the attribute table

**Redesign opportunities**
- Searchable picker, radar overlay, delta bars, "compare against squad average"

### SQD-05 · Kontrakt (contracts overview)

- **Route:** `/career/contracts` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/contracts/page.tsx`, `components/ContractRenewal.tsx`, `lib/career/management.ts (contractRows)`
- **Purpose:** Plan renewals: who expires, days left, wages, payroll; open renewal for a player.
- **Main actions:** Toggle "Utgående inom ett år"; Förhandla (select row); Hitta ersättare →; Jämför alternativ →
- **Current visual structure:** PageHeading + 4-cell summary (expiring ≤1y, ≤180d, monthly payroll, link to squad); two-column hm-contract-layout: "Avtalsöversikt" 7-column table (Spelare, Pos, Avtal till, Dagar kvar countdown, Lön, Status badge, Åtgärd) + decision panel (ContractRenewal) or prompt "Vem bygger du vidare med?".
- **Navigation relationships:** /career/players, /career/squad, /career/compare?left
- **Desktop:** Two columns.
- **Mobile:** squad-season.css collapses hm-contract-layout (1.9fr + 280px) to one column at the max-width:1250px breakpoint; renewal panel then sits below a scrolling 7-column table.

**Strengths**
- Countdown urgency (≤180 days highlighted)
- Renewal embedded beside the list (master-detail)

**Weaknesses**
- No sorting (header "Avtal till ↑" is static text)
- No wage budget headroom shown although renewal depends on it
- Staff contracts not included

**Redesign opportunities**
- Contract timeline (Gantt of contract ends vs season boundaries)
- Payroll vs budget bar with projected renewals

### SQD-05a · Panel "Ditt avtalsbeslut"

- **Route:** `/career/contracts` · **Kind:** panel · **Importance:** frequent · **Parent:** SQD-05
- **Components:** `components/ContractRenewal.tsx`
- **Purpose:** Embedded renewal flow for selected row.
- **Main actions:** Same as SQD-02n
- **Current visual structure:** Player cell + days left + explanatory paragraph + ContractRenewal.
- **Navigation relationships:** SQD-02n
- **Desktop:** Right column.
- **Mobile:** Stacked.

**Strengths**
- Keeps context

**Weaknesses**
- Selection kept in workspace memory; stale selection persists across visits

**Redesign opportunities**
- Side drawer

## STF — Staff

### STF-01 · Personal – Organisation

- **Route:** `/career/staff` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/staff/page.tsx`, `components/staff/StaffNav.tsx`, `components/staff/OrganisationChart.tsx`, `components/game/Secondary.tsx (SectionScene)`, `components/staff/staff.css`
- **Purpose:** See the club organisation (departments, positions, holders, vacancies, costs vs board limit), staff list with role suitability and this week's coaching responsibilities.
- **Main actions:** Navigate staff subnav (Organisation / Vakanser / Rekryteringsmarknad / Förhandlingar / Ansvarsområden); Open staff profile; Rekrytera (vacancy) / Förläng (expiring); Sort staff table (Namn, Roll, Lämplighet); Open Träningsvecka / Scouting
- **Current visual structure:** SectionScene header with crest; hm-subnav with badges; OrganisationChart band (cost MeterBar, 3 stats, "Behov just nu" list, 5 department columns of position cards, collapsible responsibilities); split: role-count grid + 4-column staff table; rail with weekly coach responsibilities and a note.
- **Navigation relationships:** /career/staff/recruitment, /career/staff/[staffId], /career/staff/responsibilities, /career/training, /career/scouting, /career/manager
- **Desktop:** Departments 5 columns → 3 at ≤1280px.
- **Mobile:** ≤900px departments and band to 1 column; ≤600px stats to 1 column.

**Strengths**
- Org chart by department with filled/covered/vacant/combined states
- Staff cost vs board limit meter
- Needs list surfaces vacancies and expiring contracts

**Weaknesses**
- Three overlapping representations of the same staff (org chart cards, role-count grid, staff table)
- Suitability shown as 1–5 stars everywhere except scouting page (x/20)
- "Relevanta egenskaper" column is a text list of attribute names, not values

**Redesign opportunities**
- Single interactive org chart as the page; table as optional view
- Coaching-quality impact visual (staff → training quality per session type)

### STF-01a · Staff subnav (StaffNav)

- **Route:** `/career/staff*` · **Kind:** tab · **Importance:** occasional · **Parent:** STF-01
- **Components:** `components/staff/StaffNav.tsx`
- **Purpose:** Five-item sub-navigation shared by staff pages with vacancy and open-negotiation badges.
- **Main actions:** Navigate
- **Current visual structure:** hm-subnav links; Vakanser/Förhandlingar are query views of /career/staff/recruitment.
- **Navigation relationships:** STF-03a, STF-03b, STF-04
- **Desktop:** Row.
- **Mobile:** Wraps.

**Strengths**
- Badges show pending work

**Weaknesses**
- Mixes routes and ?view= query states; Rekryteringsmarknad and Vakanser render on the same page with stacked legacy content

**Redesign opportunities**
- Consistent tab model

### STF-01b · Panel "Klubbens organisation" (OrganisationChart)

- **Route:** `/career/staff` · **Kind:** panel · **Importance:** occasional · **Parent:** STF-01
- **Components:** `components/staff/OrganisationChart.tsx`, `lib/staff/organisation*`
- **Purpose:** Departments (Ledning, Tränare, Rekrytering, Akademi, Stöd), positions, board members, costs, needs.
- **Main actions:** Rekrytera →; Förläng →; Ansvarsfördelning →
- **Current visual structure:** xp-band header with meter + stats, needs list, st-depts grid, details/summary.
- **Navigation relationships:** STF-03, STF-02, STF-04
- **Desktop:** 5 cols.
- **Mobile:** 1 col.

**Strengths**
- Clear vacancy affordance per slot

**Weaknesses**
- Dense small text; wage/contract info per card

**Redesign opportunities**
- Visual tree with health colours

### STF-01c · Staff table + role counts

- **Route:** `/career/staff` · **Kind:** panel · **Importance:** occasional · **Parent:** STF-01
- **Components:** `app/career/staff/page.tsx`, `components/StarRating.tsx`
- **Purpose:** Role counts per STAFF_ROLE and sortable table (Namn, Roll, Relevanta egenskaper, Lämplighet stars).
- **Main actions:** Sort; Open profile
- **Current visual structure:** Two Panels.
- **Navigation relationships:** STF-02
- **Desktop:** -
- **Mobile:** Scroll.

**Strengths**
- Sortable by suitability

**Weaknesses**
- Redundant with org chart

**Redesign opportunities**
- Remove or turn into compact list view

### STF-01d · Rail "Veckans tränaransvar"

- **Route:** `/career/staff` · **Kind:** panel · **Importance:** occasional · **Parent:** STF-01
- **Components:** `app/career/staff/page.tsx`, `lib/training (resolveResponsibleCoach)`
- **Purpose:** Which coach leads each session this week.
- **Main actions:** Open coach; Träningsvecka →
- **Current visual structure:** List by date.
- **Navigation relationships:** TRN-01
- **Desktop:** Rail.
- **Mobile:** Stacked.

**Strengths**
- Connects staff to training

**Weaknesses**
- No session type shown here (only coach + date)

**Redesign opportunities**
- Mini week grid

### STF-02 · Personprofil (staff profile)

- **Route:** `/career/staff/[staffId]` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/staff/[staffId]/page.tsx`, `components/staff/StaffInsight.tsx (RoleFit, StaffAttributes, StaffImpact)`, `components/staff/StaffDealPanel.tsx`, `components/experience (MeterBar)`
- **Purpose:** Assess a staff member (own, other club, free agent): role fit, attributes (ranges when knowledge <90%), ambition, employment, impact, hire/renew/dismiss, this week's responsibilities.
- **Main actions:** Back (context: recruitment/staff/club); Ta referenser (research); Lägg bud på ersättning (club stage); Erbjud kontrakt / Erbjud förlängning (role, years, wage, responsibility scope, signing bonus, promise); Dra dig ur; Säg upp… → Bekräfta uppsägning
- **Current visual structure:** SectionScene (role eyebrow, name, StaffMark) + main column (Lämplighet RoleFit, StaffAttributes with compare-to-current-holder, club history) + rail (Anställning, Karriärambition & roll with knowledge meter, StaffImpact, StaffDealPanel, Aktuellt träningsansvar).
- **Navigation relationships:** /career/staff, /career/staff/recruitment, /career/clubs/[clubId], /career/training
- **Desktop:** Main + rail.
- **Mobile:** staff.css ≤600px fit rows stack.

**Strengths**
- Knowledge-gated staff attributes with range display and "take references" action
- Comparison against current role holder
- Deal panel shows budget guardrails (cash, staff limit, projected cost, over-budget warnings)
- ProgressSteps for negotiation stage

**Weaknesses**
- Ambition panel is styled with inline rgba/hex values; mixed dark-on-light panels
- Deal form has 6 fields with no preview of acceptance
- Not-found state is a bare text panel

**Redesign opportunities**
- Staff "card" with role-fit radar and delta vs holder
- Negotiation stepper consistent with player negotiation room

### STF-02a · Panels "Lämplighet" + "Egenskaper för rollen" (StaffInsight)

- **Route:** `/career/staff/[staffId]` · **Kind:** panel · **Importance:** occasional · **Parent:** STF-02
- **Components:** `components/staff/StaffInsight.tsx`, `lib/staff/labels.ts`, `lib/staff/presentation.ts`
- **Purpose:** Role suitability per role (1–20 → 1–5 stars, verbal label) and role-relevant staff attributes, with ranges under uncertainty.
- **Main actions:** Read
- **Current visual structure:** si-panel fit rows + attribute list.
- **Navigation relationships:** STF-02
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Source note (real identity vs generated)

**Weaknesses**
- Stars hide the 1–20 resolution

**Redesign opportunities**
- Range bars

### STF-02b · Panel "Värva / Förläng eller avsluta" (StaffDealPanel)

- **Route:** `/career/staff/[staffId]` · **Kind:** panel · **Importance:** occasional · **Parent:** STF-02
- **Components:** `components/staff/StaffDealPanel.tsx`, `components/MoneyInput.tsx`
- **Purpose:** HIRE or OWN deal flow with financial overview and dismissal DecisionCard.
- **Main actions:** Ta referenser; Lägg bud på ersättning; Erbjud kontrakt; Erbjud förlängning; Dra dig ur; Säg upp… / Bekräfta uppsägning / Behåll
- **Current visual structure:** st-deal section: stepper, 6-cell finance grid with warnings, form, status notes, DecisionCard.
- **Navigation relationships:** STF-02
- **Desktop:** Rail.
- **Mobile:** Stacked.

**Strengths**
- Budget consequences explicit

**Weaknesses**
- Dismissal confirm inline (no modal) under the hire form

**Redesign opportunities**
- Shared negotiation component with REC-04

### STF-03 · Rekrytera personal

- **Route:** `/career/staff/recruitment[?view=vacancies|negotiations][&role=]` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/staff/recruitment/page.tsx`, `components/staff/StaffNav.tsx (StaffRecruitmentView)`, `components/staff/StaffMarketBoard.tsx`
- **Purpose:** Find staff candidates (free agents + employed) across every role; view vacancies and staff negotiations.
- **Main actions:** Filter role / availability / name (market board); Sort columns; Open candidate profile; Visa kandidater (vacancy); Legacy role chip filter
- **Current visual structure:** SectionScene with counters; StaffNav; optional vacancies/negotiations list section; StaffMarketBoard (8-column table: Namn, Roll, Tillgänglighet, Bedömd lämplighet stars with "?" when knowledge<60, Mot i dag delta, Ambition, Förväntad lön, Kännedom %); then a legacy split with "Fria scouter" table rail and "Rekrytering — Personal" 5-column table with role chips.
- **Navigation relationships:** /career/staff, /career/staff/[staffId]?from=recruitment, /career/scouting
- **Desktop:** Board full width, legacy split below.
- **Mobile:** Tables scroll.

**Strengths**
- StaffMarketBoard compares candidate to current holder ("Mot i dag")
- ?role= deep link pre-filters market board

**Weaknesses**
- Two market tables on one page (new StaffMarketBoard + legacy table + free scout table) – duplicated and contradictory filters (?role= only applies to the board)
- Legacy role chips use inline accent styling
- Vacancies/negotiations views stack above the full market instead of replacing it

**Redesign opportunities**
- One staff market with saved role filters; vacancies as entry cards

### STF-03a · View "Vakanta tjänster"

- **Route:** `/career/staff/recruitment?view=vacancies` · **Kind:** tab · **Importance:** occasional · **Parent:** STF-03
- **Components:** `components/staff/StaffNav.tsx`
- **Purpose:** List vacant roles with "Visa kandidater →".
- **Main actions:** Visa kandidater
- **Current visual structure:** hm-plan-section link list.
- **Navigation relationships:** STF-03c
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Direct path to candidates

**Weaknesses**
- Empty state "Alla tjänster är tillsatta." only

**Redesign opportunities**
- Vacancy cards with impact of filling

### STF-03b · View "Förhandlingar"

- **Route:** `/career/staff/recruitment?view=negotiations` · **Kind:** tab · **Importance:** rare · **Parent:** STF-03
- **Components:** `components/staff/StaffNav.tsx`
- **Purpose:** Last 20 staff negotiations (hire/renewal) with stage.
- **Main actions:** Open profile
- **Current visual structure:** Link list.
- **Navigation relationships:** STF-02
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Single history list

**Weaknesses**
- Answers arrive in inbox, not here; no CTA to respond

**Redesign opportunities**
- Negotiation board shared with player transfers

### STF-03c · Panel "Hitta rätt person" (StaffMarketBoard)

- **Route:** `/career/staff/recruitment` · **Kind:** panel · **Importance:** occasional · **Parent:** STF-03
- **Components:** `components/staff/StaffMarketBoard.tsx`
- **Purpose:** Primary staff market table.
- **Main actions:** Filter; Sort; Open
- **Current visual structure:** Header with 3 filters + 8-column sortable table.
- **Navigation relationships:** STF-02
- **Desktop:** -
- **Mobile:** Scroll.

**Strengths**
- Uncertainty marker

**Weaknesses**
- See STF-03

**Redesign opportunities**
- -

### STF-03d · Legacy tables "Fria scouter" + "Rekrytering — Personal"

- **Route:** `/career/staff/recruitment` · **Kind:** panel · **Importance:** internal · **Parent:** STF-03
- **Components:** `app/career/staff/recruitment/page.tsx`
- **Purpose:** Older candidate tables still rendered below the board.
- **Main actions:** Role chips; Sort
- **Current visual structure:** Rail table + main table.
- **Navigation relationships:** STF-03c
- **Desktop:** -
- **Mobile:** -

**Strengths**
- -

**Weaknesses**
- Redundant; candidate to remove

**Redesign opportunities**
- Remove

### STF-04 · Ansvarsfördelning (delegation)

- **Route:** `/career/staff/responsibilities` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/staff/responsibilities/page.tsx`, `lib/staff delegation (RESPONSIBILITY_AREAS, setDelegation, approveProposal)`, `components/experience (DecisionCard)`
- **Purpose:** Decide per responsibility area whether the manager does it, staff advises, or staff acts (Du själv / Råd först / Delegera); approve/reject staff proposals; read staff activity log.
- **Main actions:** Set mode per area (radiogroup); Godkänn / Avslå proposals; Granska träningsplan; Titta på spelaren först; Open responsible staff
- **Current visual structure:** PageHeading + StaffNav; dg-panel "Vem gör vad" 5-column matrix (Område, Rollen som äger det, Ansvarig + stars, Läge segmented radios, Vad det innebär); dg-panel "Förslag från staben" DecisionCards + decided list; dg-panel "Vad staben har gjort" log (≤25).
- **Navigation relationships:** /career/staff, /career/training, /career/transfers/[playerId]
- **Desktop:** Stacked panels.
- **Mobile:** Matrix in hm-scroll-x.

**Strengths**
- Clear delegation model with explained scope per area
- Proposals carry consequence text

**Weaknesses**
- Training-plan proposals cannot be approved here (button disabled, redirect)
- Log is a long ordered list without filters

**Redesign opportunities**
- Delegation as toggles on each domain page (contextual) + central inbox of proposals

## TRN — Training & tactics

### TRN-01 · Träning & Återhämtning

- **Route:** `/career/training[?week=YYYY-MM-DD]` · **Kind:** page · **Importance:** core
- **Components:** `app/career/training/page.tsx`, `components/clubhq/EnvironmentBanner.tsx`, `components/game/Identity.tsx (MatchHero)`, `components/manager/TrainingFeedback.tsx`, `components/manager/AssistantTrainingPanel.tsx`, `lib/training/types.ts`, `components/game/squad-season.css`
- **Purpose:** Plan the training week (day types, up to 2 sessions/day with type, intensity, duration, target group, responsible coach), apply templates, set per-player load and individual development focus, monitor energy/match fitness and development.
- **Main actions:** Föregående / Denna / Nästa vecka; Choose template (Balanserad/Taktisk/Fysisk/Återhämtning/Matchtätt) + Tillämpa mall; Set day type; + Lägg till pass / Ta bort pass; Per session: type (12), intensity (4), duration (3), target (4), coach; Per player: load setting (Full/Reducerad/Endast återhämtning/Vila), individual focus (7); Jump to match prep / report from match day cell; Assistant plan: ask, approve, decline
- **Current visual structure:** EnvironmentBanner (training hall) with 3 metrics; "Veckans matchberedskap" band with 3 numbers + compact MatchHero; TrainingFeedback; AssistantTrainingPanel; "Veckoschema" panel with 7-column day grid (each day: date, day-type select or match link, session cards each with 4–5 selects); "Spelarberedskap" 5-column table; "Utveckling" 6-column table.
- **Navigation relationships:** /career/staff, /career/calendar, /career/fixtures/[id], /career/match-report/[id], /career/staff/responsibilities
- **Desktop:** 7 day columns minmax(150px) (175px at large) inside horizontal scroller.
- **Mobile:** No mobile layout for the week grid: always 7×≥150px columns → sideways scrolling ≥1050px; tables scroll.

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

**Redesign opportunities**
- Visual week planner (drag session blocks, load bar per day, projected energy curve per player group)
- Per-player load/readiness chart linking to squad physical tab
- Development panel showing attribute deltas and focus effect

### TRN-01a · Panel "Assistentens träningsplan" (AssistantTrainingPanel)

- **Route:** `/career/training` · **Kind:** panel · **Importance:** frequent · **Parent:** TRN-01
- **Components:** `components/manager/AssistantTrainingPanel.tsx`
- **Purpose:** Delegation mode for training (Du själv / Råd först / Delegera), request weekly proposal, show proposal goal, planned sessions/intensity and individual advice; approve/decline.
- **Main actions:** Be om veckoförslag; Godkänn (per advice); Godkänn träningsplan; Avböj träningsplan; Ansvarsfördelning →
- **Current visual structure:** Section with mode buttons, proposal table (Spelare / skäl, Belastning).
- **Navigation relationships:** STF-04
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Low-effort path for casual players

**Weaknesses**
- Placed above the planner; competes for attention

**Redesign opportunities**
- Show proposal as a diff overlay on the week grid

### TRN-01b · Panel "Veckoschema" (week planner)

- **Route:** `/career/training` · **Kind:** panel · **Importance:** core · **Parent:** TRN-01
- **Components:** `app/career/training/page.tsx`
- **Purpose:** Edit the week.
- **Main actions:** See TRN-01
- **Current visual structure:** 7 day cells × ≤2 session cards.
- **Navigation relationships:** TRN-01
- **Desktop:** Scroll.
- **Mobile:** Scroll.

**Strengths**
- Category pills, matchday highlight, today highlight

**Weaknesses**
- Select-heavy

**Redesign opportunities**
- Block-based planner

### TRN-01c · Panel "Spelarberedskap"

- **Route:** `/career/training` · **Kind:** panel · **Importance:** frequent · **Parent:** TRN-01
- **Components:** `app/career/training/page.tsx`
- **Purpose:** Per player: energy badge (Pigg/Något sliten/Trött), MF %, recent load, load setting select (constrained by injury/limited), individual focus select; status badges (injured/rehab/return/placement).
- **Main actions:** Set load; Set focus
- **Current visual structure:** 5-column table.
- **Navigation relationships:** SQD-01c
- **Desktop:** -
- **Mobile:** Scroll.

**Strengths**
- Constraints enforced with explanatory title

**Weaknesses**
- "Senaste belastning" is an unexplained decaying magnitude; differs from squad "Belastning 7 d"

**Redesign opportunities**
- Merge with squad physical view

### TRN-01d · Panel "Utveckling"

- **Route:** `/career/training` · **Kind:** panel · **Importance:** occasional · **Parent:** TRN-01
- **Components:** `app/career/training/page.tsx`
- **Purpose:** Per player: age, level stars, potential stars, status (Förbättras/Tränar/Ingen data), latest improvement.
- **Main actions:** Read
- **Current visual structure:** 6-column table.
- **Navigation relationships:** SQD-02d
- **Desktop:** -
- **Mobile:** Scroll.

**Strengths**
- Squad-wide development overview

**Weaknesses**
- Raw attribute key and stars as text

**Redesign opportunities**
- Development leaderboard / growth chart

### TRN-01e · TrainingFeedback block

- **Route:** `/career/training` · **Kind:** panel · **Importance:** occasional · **Parent:** TRN-01
- **Components:** `components/manager/TrainingFeedback.tsx`
- **Purpose:** Collapsed <details> "Senaste träningsutfall · date": per player sessions attended, energy before/after and change for the latest executed training day.
- **Main actions:** Expand
- **Current visual structure:** details + Panel table (Spelare, Pass, Energi före, Energi efter, Förändring).
- **Navigation relationships:** TRN-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Only place showing the actual energy cost of training

**Weaknesses**
- Collapsed by default and only for the latest day; no history

**Redesign opportunities**
- -

### TRN-01f · Loading state

- **Route:** `/career/training` · **Kind:** state · **Importance:** rare · **Parent:** TRN-01
- **Components:** `app/career/training/page.tsx`
- **Purpose:** Suspense fallback "Förbereder träningsveckan…".
- **Main actions:** None
- **Current visual structure:** hm-empty status text.
- **Navigation relationships:** TRN-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- role=status

**Weaknesses**
- No skeleton

**Redesign opportunities**
- Skeleton

### TRN-02 · Matchplan & Taktiktavla 2.0

- **Route:** `/career/tactics` · **Kind:** page · **Importance:** core
- **Components:** `app/career/tactics/page.tsx (1665 lines)`, `components/court/HandballCourtSvg.tsx`, `components/game/CoachingChoices.tsx`, `components/matchPlan/TacticsDiffManager.tsx`, `components/matchPlan/HandballPlanSections.tsx (SetPieceSection, LeadershipSection)`, `components/game/coaching.css`, `lib/matchPlan/*`, `lib/career/manualLineup.ts`
- **Purpose:** Choose match squad (≤16) and starting seven, defensive specialists/exchanges, special situations (6v5, 5v6, 7v6), team style (defence 6-0/5-1, aggression, tempo, attack identity, rotation, 7v6 policy), assistant rotation, 7m takers, captaincy/leadership, for the next fixture.
- **Main actions:** Drag & drop players between court slots and bench (HTML5 DnD); Switch court mode (Anfall 6v6 / Försvar 6v6 / Byten & Diff / 6 mot 5 / 5 mot 6 / 7 mot 6); Switch defence 6–0 / 5–1; Select defence zone / 5v6 index; Switch player-overlay mode (Energi / Lämplighet / Senaste match / Form 5 matcher); Assign / remove defensive specialists, clear all exchanges; Set coaching choices; Toggle Assistentbyten; Set 7m order, captain, vice; Add/remove players to match squad; Repair plan (gate states); Jump: Till matchen → / Truppen →
- **Current visual structure:** EnvironmentBanner; fixture strip (crests, date, round, anchor pills); coach-preparation-layout = left court section (heading, visual-mode radiogroup, dual Attack/Defence tabs with badges, special-situation tabs, exchange banner, SVG court with draggable position chips, bench strip, TacticsDiffManager in EXCHANGES mode) + right rail ("Så spelar vi" CoachingChoices + active-plan summary + assistant toggle + mode-specific rail panel); SetPieceSection; LeadershipSection; roster split (Matchtrupp · n spelare / Ej uttagna).
- **Navigation relationships:** /career/match-preview, /career/squad, /career/players, /career/clubs/[opponentId], /career
- **Desktop:** Two columns (court + ~340px rail) ≥1350px.
- **Mobile:** coaching.css: ≤1350px rail 340px; ≤1050px single column, rail 2-col; ≤750px rail 1-col. DnD unusable on touch.

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

**Redesign opportunities**
- Tactic board with tap-to-select-then-tap-to-place (touch + keyboard)
- Opponent overlay on court (their tendencies vs our setup)
- Single mode switcher (phase × manpower matrix)
- Plan readiness checklist (squad, GK, 7m, captain) as a progress header

### TRN-02a · Guard states (no fixture / too few players / unavailable in plan / non-normal formation / invalid lineup)

- **Route:** `/career/tactics` · **Kind:** state · **Importance:** occasional · **Parent:** TRN-02
- **Components:** `app/career/tactics/page.tsx`
- **Purpose:** Full-page blocking states: "Nästa laguttagning väntar.", "Startsjuan behöver fler spelare.", "Uttagningen behöver uppdateras.", "Välj en normal startsju.", "Startsjuan behöver uppdateras." each with repair button or links.
- **Main actions:** Repair / rebuild plan; Öppna truppen; Hitta förstärkning; Till klubben
- **Current visual structure:** Banner + message card.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Clear recovery paths

**Weaknesses**
- Replaces entire page; user cannot inspect current plan while blocked

**Redesign opportunities**
- Inline warnings with auto-fix preview

### TRN-02b · Court modes "ANFALL (6v6)" / "FÖRSVAR (6v6)" (dual tabs)

- **Route:** `/career/tactics` · **Kind:** tab · **Importance:** core · **Parent:** TRN-02
- **Components:** `app/career/tactics/page.tsx`, `components/court/HandballCourtSvg.tsx`
- **Purpose:** Edit attack starting seven or defence 6v6 positions/specialists on the SVG court.
- **Main actions:** Drag players; Toggle 6–0 / 5–1; Select defence zone
- **Current visual structure:** role=tablist with two large tabs showing badges ("6 båda vägar", "n specialister").
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Badges summarise two-way vs specialist usage

**Weaknesses**
- Emoji icons, uppercase labels

**Redesign opportunities**
- Phase toggle integrated in court header

### TRN-02c · Special situations tabs (6 mot 5 / 5 mot 6 / 7 mot 6)

- **Route:** `/career/tactics` · **Kind:** tab · **Importance:** frequent · **Parent:** TRN-02
- **Components:** `app/career/tactics/page.tsx`
- **Purpose:** Configure numerical advantage/disadvantage and empty-goal attack units.
- **Main actions:** Assign players per slot; Pick 7th outfielder
- **Current visual structure:** role=tablist of 3 tabs; rail shows situation-specific panel.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Covers handball-specific situations most managers games ignore

**Weaknesses**
- Hidden behind small tabs; no indication if a situation is unconfigured

**Redesign opportunities**
- Completion indicators per situation

### TRN-02d · Mode "Byten & Diff" (TacticsDiffManager)

- **Route:** `/career/tactics` · **Kind:** tab · **Importance:** frequent · **Parent:** TRN-02
- **Components:** `components/matchPlan/TacticsDiffManager.tsx`, `lib/matchPlan/tacticsDiffWorkflow.ts`
- **Purpose:** Attack↔defence exchange overview: who plays both ways, specialist pairs (max 3), clear all.
- **Main actions:** Assign/remove specialist; Clear all exchanges; Jump to court mode
- **Current visual structure:** Diff manager panel under court.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Makes implicit substitution logic explicit

**Weaknesses**
- Reached only via anchor pill "Byten & Diff", not via the dual tabs

**Redesign opportunities**
- Visual pairing lines on court

### TRN-02e · Overlay mode selector "Taktikvisning"

- **Route:** `/career/tactics` · **Kind:** panel · **Importance:** frequent · **Parent:** TRN-02
- **Components:** `app/career/tactics/page.tsx`
- **Purpose:** Switch chip subtitle data: Energi, Lämplighet, Senaste match, Form (5 matcher).
- **Main actions:** Select mode
- **Current visual structure:** Inline-styled radiogroup with emoji buttons + helper text.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Turns court into data display

**Weaknesses**
- Uses aria-checked on buttons without role=radio; inline styles

**Redesign opportunities**
- Colour-scaled chips + legend

### TRN-02f · Rail "Så spelar vi" (CoachingChoices)

- **Route:** `/career/tactics` · **Kind:** panel · **Importance:** core · **Parent:** TRN-02
- **Components:** `components/game/CoachingChoices.tsx`
- **Purpose:** Team style: defence system, aggression, tempo, attack identity, rotation, 7v6 policy; summary line; Assistentbyten på/av.
- **Main actions:** Change each choice; Toggle assistant rotation
- **Current visual structure:** Fieldsets of segmented choices + summary sentence.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Same component reused live in match (consistency)

**Weaknesses**
- No explanation of trade-offs at plan time (TimeoutOverlay has richer copy)

**Redesign opportunities**
- Trade-off explanations + opponent-aware suggestion

### TRN-02g · Section "Fasta situationer · 7-meter" (SetPieceSection)

- **Route:** `/career/tactics` · **Kind:** panel · **Importance:** occasional · **Parent:** TRN-02
- **Components:** `components/matchPlan/HandballPlanSections.tsx`
- **Purpose:** Order of penalty takers (max MAX_PENALTY_TAKERS).
- **Main actions:** Choose takers in order
- **Current visual structure:** hm-plan-section with selects.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- -

**Weaknesses**
- Below the fold, reached by anchor

**Redesign opportunities**
- Show 7m conversion stats next to candidates

### TRN-02h · Section "Ledarskap" (LeadershipSection)

- **Route:** `/career/tactics` · **Kind:** panel · **Importance:** occasional · **Parent:** TRN-02
- **Components:** `components/matchPlan/HandballPlanSections.tsx`
- **Purpose:** Captain, vice-captain, leadership effect (steadying leadership).
- **Main actions:** Set captain / vice
- **Current visual structure:** hm-plan-section.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Second place to set captain (also on squad aside)

**Weaknesses**
- Duplicate captaincy entry points

**Redesign opportunities**
- Single roles editor

### TRN-02i · Roster "Matchtrupp · n spelare" / "Ej uttagna"

- **Route:** `/career/tactics` · **Kind:** panel · **Importance:** core · **Parent:** TRN-02
- **Components:** `app/career/tactics/page.tsx`
- **Purpose:** Selected match squad (≤16) and players outside it.
- **Main actions:** Add/remove from squad; Drag to court
- **Current visual structure:** Two roster columns of rows.
- **Navigation relationships:** TRN-02
- **Desktop:** Inside tactics layout.
- **Mobile:** Stacks ≤1050px.

**Strengths**
- Clear count vs max

**Weaknesses**
- Placed at bottom; squad size validation surfaces only in match preview

**Redesign opportunities**
- Persistent squad counter in header

## REC — Scouting & transfers

### REC-01 · Scouting & Motståndaranalys

- **Route:** `/career/scouting[?target=playerId]` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/scouting/page.tsx`, `components/scouting/ScoutingCentre.tsx`, `components/scouting/scouting.css`, `lib/career/scouting.ts`
- **Purpose:** Run the scouting department: see scouts and workload, start player assignments and broad assignments (club / competition / nation / position+age), follow active work, open finished reports, browse discoveries; recommendations by squad need.
- **Main actions:** Rekrytera scouter →; Rekryteringscentrum →; Search player to watch + pick scout + start assignment; Configure broad assignment (type, club/competition/nation/position, max age, scout) + start; Cancel broad assignment; Filter discoveries by scout/type; Kortlista / Scouta from recommendations; Öppna rapport
- **Current visual structure:** PageHeading; ScoutingCentre (spotlight hero, stats strip, Rekommendationer list with compare, "Scouterna" workload rail, "Senaste upptäckterna"); market-stage band with 3 counters; game-scouting-layout column of 7 Panels: Dina scouter, Ny bevakning (search + 6-column table + scout select), Nytt bredare uppdrag (form), Aktiva uppdrag, Färdiga rapporter, Breda uppdrag, Upptäckta spelare (6-column table + filters).
- **Navigation relationships:** /career/staff/recruitment, /career/recruitment, /career/squad/[playerId], /career/staff/[staffId]
- **Desktop:** Layout grid; ≥1100px two columns.
- **Mobile:** scouting.css ≤1100/≤700px; recruitment-news.css ≤900px single column.

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

**Redesign opportunities**
- Scouting board (kanban: Upptäckt → Bevakas → Rapport → Kortlista)
- Map/league coverage view of where scouts are
- Report view with knowledge-gain visual

### REC-01a · ScoutingCentre ("Scoutingcentralen")

- **Route:** `/career/scouting` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-01
- **Components:** `components/scouting/ScoutingCentre.tsx`
- **Purpose:** Hero spotlight on newest discovery, stats, need-based recommendations with star ranges, scout workload, latest discoveries.
- **Main actions:** Öppna rapporten; Kortlista; Scouta
- **Current visual structure:** sc-centre hero + two-column panels.
- **Navigation relationships:** REC-01
- **Desktop:** Panel.
- **Mobile:** Stacked.

**Strengths**
- Star-range component (StarRangeView) is a good uncertainty primitive

**Weaknesses**
- Duplicates counters below

**Redesign opportunities**
- Make it the page

### REC-01b · Panel "Dina scouter"

- **Route:** `/career/scouting` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-01
- **Components:** `app/career/scouting/page.tsx`
- **Purpose:** Scouts with suitability x/20 and active assignment count; empty state with recruit button.
- **Main actions:** Open scout; Rekrytera
- **Current visual structure:** List.
- **Navigation relationships:** REC-01
- **Desktop:** Panel.
- **Mobile:** Stacked.

**Strengths**
- Workload visible

**Weaknesses**
- Duplicates ScoutingCentre "Scouterna"

**Redesign opportunities**
- Merge

### REC-01c · Panel "Ny bevakning"

- **Route:** `/career/scouting` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-01
- **Components:** `app/career/scouting/page.tsx`
- **Purpose:** Targeted assignment: search, table (Spelare, Pos, Ålder, Klubb, Kännedom, Välj), scout select, start; ?target= preselects.
- **Main actions:** Search; Select; Start
- **Current visual structure:** Search + table + form.
- **Navigation relationships:** REC-01
- **Desktop:** Panel.
- **Mobile:** Stacked.

**Strengths**
- Deep-link from profile pre-selects player

**Weaknesses**
- Form errors as text only

**Redesign opportunities**
- Assign by dragging player onto scout

### REC-01d · Panel "Nytt bredare uppdrag"

- **Route:** `/career/scouting` · **Kind:** panel · **Importance:** occasional · **Parent:** REC-01
- **Components:** `app/career/scouting/page.tsx`
- **Purpose:** Broad assignment builder: type CLUB/COMPETITION/NATION/POSITION, parameters, max age, scout.
- **Main actions:** Configure; Start
- **Current visual structure:** Type buttons + conditional fields.
- **Navigation relationships:** REC-01
- **Desktop:** Panel.
- **Mobile:** Stacked.

**Strengths**
- Flexible discovery

**Weaknesses**
- No estimate of duration/yield

**Redesign opportunities**
- Show expected output & duration

### REC-01e · Panels "Aktiva uppdrag" / "Färdiga rapporter" / "Breda uppdrag"

- **Route:** `/career/scouting` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-01
- **Components:** `app/career/scouting/page.tsx`
- **Purpose:** Progress of work, completed reports with knowledge meter, broad assignments with cancel.
- **Main actions:** Öppna rapport; Avbryt
- **Current visual structure:** Three list panels.
- **Navigation relationships:** REC-01
- **Desktop:** Panel.
- **Mobile:** Stacked.

**Strengths**
- Progress %

**Weaknesses**
- Three separate lists for one pipeline

**Redesign opportunities**
- Single pipeline board

### REC-01f · Panel "Upptäckta spelare"

- **Route:** `/career/scouting` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-01
- **Components:** `app/career/scouting/page.tsx`
- **Purpose:** Discoveries table (Spelare, Klubb, Källa, Scout, Kännedom) with filters by scout and assignment type.
- **Main actions:** Filter; Kortlista/Open
- **Current visual structure:** Filter row + table.
- **Navigation relationships:** REC-01
- **Desktop:** Panel.
- **Mobile:** Stacked.

**Strengths**
- Source attribution

**Weaknesses**
- No ability range column

**Redesign opportunities**
- Add star-range column and sort

### REC-02 · Rekryteringscentrum

- **Route:** `/career/recruitment[?view=SHORTLIST]` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/recruitment/page.tsx`, `components/game/RecruitmentPresentation.tsx`, `lib/career/recruitment.ts`
- **Purpose:** Pipeline of recruitment candidates (discovered → scouting → scouted → shortlist → prioritised → negotiating) with dossier, priority and notes.
- **Main actions:** Switch pipeline stage (7 buttons: Alla, Nya fynd, Under scouting, Scoutade, Kortlista, Prioriterade, Aktiva förhandlingar); Search, filter position/nation/status/knowledge tier; Select candidate; Toggle shortlist; Start scouting with chosen scout; Set priority, write note; Jämför med truppen; Öppna bud & budget; Open negotiation room
- **Current visual structure:** PageHeading; numbered stage nav (01–07) as process strip; layout: candidates Panel (search + filter chips + 10-column table: Spelare, Klubb, Pos, Ålder, Kännedom, Förmåga, Potential, Marknadsvärde, Status) + dossier column (links, profile card, assessment, scouting box with progress, priority & note, transfer panel).
- **Navigation relationships:** /career/players, /career/compare?left, /career/transfers?target, /career/transfers/[playerId], /career/scouting?target, /career/staff/recruitment
- **Desktop:** Two columns (table + dossier 320–500px).
- **Mobile:** ≤900px single column; stage strip 4 columns.

**Strengths**
- Process-oriented stage strip matches the real recruitment funnel
- Shows ability/potential ranges and market value range (knowledge-gated) – the richest market table
- Notes and priority per target

**Weaknesses**
- Stage state is local (only ?view=SHORTLIST read) – not deep-linkable
- Inline style objects (inputStyle)
- Overlaps with Spelarsök and Transfer Centre lists

**Redesign opportunities**
- Kanban funnel with drag between stages
- Unified market + pipeline workspace

### REC-02a · Candidate dossier

- **Route:** `/career/recruitment` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-02
- **Components:** `app/career/recruitment/page.tsx (CandidateDossier)`
- **Purpose:** Assessment ("Scoutens bedömning"/"Bedömningsunderlag"), scouting box, "Prioritet & anteckning", "Transfer" panel.
- **Main actions:** Open profile; Shortlist; Start scouting; Priority; Note; Negotiate
- **Current visual structure:** Stack of 4 panels.
- **Navigation relationships:** SQD-02, REC-04
- **Desktop:** Right column.
- **Mobile:** Below.

**Strengths**
- Everything for one target in one column

**Weaknesses**
- Long; duplicates profile content

**Redesign opportunities**
- Drawer

### REC-03 · Transfer Centre

- **Route:** `/career/transfers[?target=playerId]` · **Kind:** page · **Importance:** core
- **Components:** `app/career/transfers/page.tsx`, `components/players/IncomingOffersBoard.tsx`, `components/transfers/transfer-centre.css`, `lib/career transfer status helpers`
- **Purpose:** Hub for buying/selling: incoming bids & departures, urgent negotiations, transfer budget, market (opportunities/all/watched), ongoing negotiations, squad needs, market pulse, recent deals.
- **Main actions:** Respond to incoming bid (link); Open urgent negotiation card; Switch market tab (Möjligheter / Hela marknaden / Bevakade); Search, position chips, interest filter; Select player → dossier; Förhandla / Föreslå lån / Bevaka / Jämför / Spelarprofil
- **Current visual structure:** PageHeading; IncomingOffersBoard (bids list + 4 mini-lists); tc-stage band (headline sentence + budget/committed meter stats); urgent cards; main tc-panel with tablist, featured opportunity cards and 8-column table (Spelare, Pos, Ålder, Klubb, Kontrakt, Marknadsvärde range, Intresse, Status); dossier aside; side panels Förhandlingar, Truppbehov, Marknadspuls (14-day responses), Senaste affärer.
- **Navigation relationships:** /career/recruitment, /career/transfers/[playerId], /career/transfers/offers/[offerId], /career/compare?right, /career/squad/[playerId]
- **Desktop:** Multi-column; transfer-centre.css breakpoints 1280/1100/760.
- **Mobile:** ≤760px stacked; photo hero swaps to narrow image ≤900px.

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

**Redesign opportunities**
- Separate Buy / Sell / Deals modes
- Budget waterfall (budget, committed, wage room)
- Unified market table with knowledge-gated quality

### REC-03a · Panel "Försäljning – Bud och avgångar" (IncomingOffersBoard)

- **Route:** `/career/transfers` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-03
- **Components:** `components/players/IncomingOffersBoard.tsx`
- **Purpose:** Live bids (club crest, player, status, fee, respond-by CTA), "Vill lämna", "Transferlistan", "Förhandsavtal", "Senaste avgångar"; empty state explains when bids arrive.
- **Main actions:** Svara före <date>; Öppna; Open player
- **Current visual structure:** tc-panel with bid list + 4-column mini lists.
- **Navigation relationships:** REC-05
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Good empty-state copy

**Weaknesses**
- Always first on Transfer Centre even when user wants to buy

**Redesign opportunities**
- Sell tab

### REC-03b · Market tabs (Möjligheter / Hela marknaden / Bevakade)

- **Route:** `/career/transfers` · **Kind:** tab · **Importance:** core · **Parent:** REC-03
- **Components:** `app/career/transfers/page.tsx`
- **Purpose:** Three market lists with counts; featured cards for opportunities; filters only on full market.
- **Main actions:** Switch; Search; Filter; Select row (keyboard enabled)
- **Current visual structure:** role=tablist + table.
- **Navigation relationships:** REC-03c
- **Desktop:** -
- **Mobile:** Scroll.

**Strengths**
- Keyboard-selectable rows with aria-selected

**Weaknesses**
- Tab state not in URL

**Redesign opportunities**
- -

### REC-03c · Dossier aside (TransferDossier)

- **Route:** `/career/transfers` · **Kind:** drawer · **Importance:** frequent · **Parent:** REC-03
- **Components:** `app/career/transfers/page.tsx`
- **Purpose:** Selected player: knowledge-gated view (fetches rating), interest assessment, negotiate/loan/watch/compare/profile actions; Stäng button.
- **Main actions:** Förhandla om övergång; Föreslå lån; Bevaka/Sluta bevaka; Jämför med truppen; Spelarprofil; Stäng
- **Current visual structure:** Aside with close button (behaves like a non-modal drawer).
- **Navigation relationships:** REC-04, SQD-02, SQD-04
- **Desktop:** Right column.
- **Mobile:** Stacked.

**Strengths**
- Explains why negotiation is blocked (interest.reason)

**Weaknesses**
- Reason only in tooltip

**Redesign opportunities**
- True slide-over drawer

### REC-03d · Side panels (Förhandlingar, Truppbehov, Marknadspuls, Senaste affärer)

- **Route:** `/career/transfers` · **Kind:** panel · **Importance:** frequent · **Parent:** REC-03
- **Components:** `app/career/transfers/page.tsx`
- **Purpose:** Ongoing deals with next step, players per position vs need, last 14 days of responses, recent ins/outs.
- **Main actions:** Open deal
- **Current visual structure:** Four tc-panels.
- **Navigation relationships:** REC-04, SQD-01f
- **Desktop:** Rail.
- **Mobile:** Stacked.

**Strengths**
- Live dot for pulse

**Weaknesses**
- Truppbehov duplicates squad depth

**Redesign opportunities**
- Need heat-map on court

### REC-04 · Förhandlingsrum (negotiation room)

- **Route:** `/career/transfers/[playerId][?deal=LOAN]` · **Kind:** page · **Importance:** core
- **Components:** `app/career/transfers/[playerId]/page.tsx`, `components/transfers/NegotiationRoom.tsx`, `components/transfers/DealCompletion.tsx`, `components/experience (ProgressSteps)`, `components/MoneyInput.tsx`
- **Purpose:** The single place to negotiate a permanent transfer or loan: club stage (fee or loan wage share + end date), player stage (wage, years 1–5, signing bonus, promised role), counters, waiting, completion.
- **Main actions:** Choose deal type (Permanent / Lån) and Öppna förhandlingen; Lägg budet (fee); Loan: wage-share %, end date; Lägg fram villkoren (wage, years, bonus, role); Accept counter ("meet") / Justera budet i stället; Dra dig ur; After completion: Öppna spelarprofilen / Se truppen / Planera laguttagning
- **Current visual structure:** PageHeading + photo hero with parties (club ↔ our club), ProgressSteps stepper (Klubben → Spelaren/Speltiden → Signering/Lånet) and deadline clock; two party asides (club, player & agent) around a decision section; timeline of rounds (tc-timeline); acquisition summary box with training compensation; DealCompletion moment on success.
- **Navigation relationships:** /career/transfers, /career/squad/[playerId], /career/squad, /career/tactics, /career/contracts
- **Desktop:** Hero + 3-column party/decision layout.
- **Mobile:** transfer-centre.css ≤1100/760 stacks parties above decision.

**Strengths**
- Negotiation as a visible, staged conversation with timeline and stamped answers
- Deadline urgency clock
- Acquisition cost summary (fee, bonus, wage × years, training compensation)
- Rich completion moment with next-step CTAs

**Weaknesses**
- Some summary boxes built with inline styles
- No indication of player's willingness/likely acceptance range beyond counters
- Own-player and cooldown states are text blocks

**Redesign opportunities**
- Acceptance-zone slider visual
- Shared negotiation pattern for staff and renewals

### REC-04a · Start decision "Inled förhandling"

- **Route:** `/career/transfers/[playerId]` · **Kind:** state · **Importance:** frequent · **Parent:** REC-04
- **Components:** `components/transfers/NegotiationRoom.tsx`
- **Purpose:** Deal-type radiogroup and open button; cooldown and own-player variants.
- **Main actions:** Permanent / Lån; Öppna förhandlingen →
- **Current visual structure:** tc-decision tc-start.
- **Navigation relationships:** REC-04
- **Desktop:** Centre column.
- **Mobile:** Stacked.

**Strengths**
- Loan disabled with reason

**Weaknesses**
- -

**Redesign opportunities**
- -

### REC-04b · Decision form – club stage

- **Route:** `/career/transfers/[playerId]` · **Kind:** panel · **Importance:** core · **Parent:** REC-04
- **Components:** `components/transfers/NegotiationRoom.tsx`
- **Purpose:** Fee (or loan wage share %, end date) with visible knowledge-gated value range as default.
- **Main actions:** Lägg budet; Accept counter; Dra dig ur
- **Current visual structure:** Form inside tc-decision with counter "meet" button.
- **Navigation relationships:** REC-04
- **Desktop:** Centre column.
- **Mobile:** Stacked.

**Strengths**
- Defaults derived from value range

**Weaknesses**
- Number input for % (no slider)

**Redesign opportunities**
- Slider with range band

### REC-04c · Decision form – player stage

- **Route:** `/career/transfers/[playerId]` · **Kind:** panel · **Importance:** core · **Parent:** REC-04
- **Components:** `components/transfers/NegotiationRoom.tsx`
- **Purpose:** Wage/month, years, signing bonus, promised role; acquisition summary.
- **Main actions:** Lägg fram villkoren; Accept counter
- **Current visual structure:** Form + summary box.
- **Navigation relationships:** REC-04
- **Desktop:** Centre column.
- **Mobile:** Stacked.

**Strengths**
- Total cost transparency

**Weaknesses**
- Dense

**Redesign opportunities**
- -

### REC-04d · Waiting / closed status

- **Route:** `/career/transfers/[playerId]` · **Kind:** state · **Importance:** frequent · **Parent:** REC-04
- **Components:** `components/transfers/NegotiationRoom.tsx`
- **Purpose:** "Inget att göra just nu" while party considers; closed labels (refused, expired, withdrawn).
- **Main actions:** Continue in calendar
- **Current visual structure:** tc-status blocks.
- **Navigation relationships:** REC-04
- **Desktop:** Centre column.
- **Mobile:** Stacked.

**Strengths**
- Honest async state

**Weaknesses**
- No "advance to answer" shortcut

**Redesign opportunities**
- Inline "advance day" affordance

### REC-04e · Deal completed (DealCompletion)

- **Route:** `/career/transfers/[playerId]` · **Kind:** overlay · **Importance:** occasional · **Parent:** REC-04
- **Components:** `components/transfers/NegotiationRoom.tsx`
- **Purpose:** Celebratory moment with deal summary and next steps.
- **Main actions:** Öppna spelarprofilen; Se truppen; Planera laguttagning; Tillbaka till Transfer Centre
- **Current visual structure:** Photo moment hero + summary.
- **Navigation relationships:** REC-04
- **Desktop:** Centre column.
- **Mobile:** Stacked.

**Strengths**
- Emotional payoff

**Weaknesses**
- -

**Redesign opportunities**
- -

### REC-05 · Bud på din spelare (incoming offer)

- **Route:** `/career/transfers/offers/[offerId]` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/transfers/offers/[offerId]/page.tsx`, `components/experience (DecisionCard, MomentHero)`, `components/MoneyInput.tsx`
- **Purpose:** Respond to another club's bid for an own player: why they want him, bidding history, financial & sporting effect, accept / counter / reject / withdraw; completed sale moment.
- **Main actions:** Acceptera budet; Motbud + Skicka motbud; Avvisa affär; Dra dig ur; ← Transfers
- **Current visual structure:** PageHeading; player header; sections "Varför de vill ha honom", "Budgivningen" history, "Ekonomisk & sportslig effekt"; DecisionCard "Ditt svar"; MomentHero "Såld" when completed.
- **Navigation relationships:** /career/transfers, SQD-02i
- **Desktop:** Single column.
- **Mobile:** Single column.

**Strengths**
- Consequences framed (cash, sporting effect)
- Player has final say explicitly stated

**Weaknesses**
- Not-found is a bare panel
- Sporting effect is text, no squad-depth visual

**Redesign opportunities**
- Show depth chart before/after sale

### REC-05a · Sold moment (MomentHero "Såld")

- **Route:** `/career/transfers/offers/[offerId]` · **Kind:** overlay · **Importance:** rare · **Parent:** REC-05
- **Components:** `app/career/transfers/offers/[offerId]/page.tsx`
- **Purpose:** Departure announcement after completion.
- **Main actions:** Read
- **Current visual structure:** Photo moment.
- **Navigation relationships:** REC-05
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Narrative closure

**Weaknesses**
- -

**Redesign opportunities**
- -

## CMP — Competition

### CMP-01 · Tävlingar (competition workspace)

- **Route:** `/career/competitions[/competitionId][?tab=]` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/competitions/page.tsx`, `app/career/competitions/[competitionId]/page.tsx`, `components/manager/CompetitionWorkspace.tsx`, `components/manager/CupWorkspace.tsx`, `components/manager/StatisticsTable.tsx`, `components/game/Identity.tsx (CompetitionHero)`, `components/game/profile-world.css`
- **Purpose:** League/cup hub: table & form, fixtures, results, player statistics, clubs, history; switch between any competition (incl. non-simulated leagues for recruitment browsing).
- **Main actions:** Switch competition (select); Switch tab (URL ?tab=); Open club / match / history season
- **Current visual structure:** CompetitionHero; switcher + meta pills (Fullt simulerad / Ej simulerad, clubs count, played matches, next round); hm-tabs as Links (6); split: main Panel per tab + rail (Din klubb i ligan, Omgång n list, Senaste resultat, Skytteligan top 5, note for non-simulated).
- **Navigation relationships:** /career/clubs/[id], /career/fixtures/[id], /career/match-report/[id], /career/history?season
- **Desktop:** Main + rail.
- **Mobile:** profile-world.css ≤1250px one column, meta pills hidden.

**Strengths**
- Tabs are URL-driven (deep-linkable)
- Same workspace for every league; clear simulated/non-simulated status
- League table with 11 columns incl. form dots

**Weaknesses**
- /career/competitions and /career/competitions/[id] are identical components (no overview of all competitions)
- Cup uses a different layout (CupWorkspace) with an h1 inside a section
- Statistics tab duplicates /career/statistics

**Redesign opportunities**
- League table with position-change arrows and points-gap chart
- Season progression timeline

### CMP-01a · Tab "Tabell & form"

- **Route:** `/career/competitions/[competitionId]?tab=` · **Kind:** tab · **Importance:** core · **Parent:** CMP-01
- **Components:** `components/manager/CompetitionWorkspace.tsx`
- **Purpose:** League table.
- **Main actions:** Read; Open linked entities
- **Current visual structure:** Table #, Klubb, SM, V, O, F, GM, IM, MSK, P, Form · fem senaste; own club highlighted.
- **Navigation relationships:** CMP-01
- **Desktop:** Main column.
- **Mobile:** Scroll tables.

**Strengths**
- URL-addressable

**Weaknesses**
- —

**Redesign opportunities**
- —

### CMP-01b · Tab "Matcher"

- **Route:** `/career/competitions/[competitionId]?tab=` · **Kind:** tab · **Importance:** frequent · **Parent:** CMP-01
- **Components:** `components/manager/CompetitionWorkspace.tsx`
- **Purpose:** Upcoming fixtures.
- **Main actions:** Read; Open linked entities
- **Current visual structure:** FixtureTable.
- **Navigation relationships:** CMP-01
- **Desktop:** Main column.
- **Mobile:** Scroll tables.

**Strengths**
- URL-addressable

**Weaknesses**
- —

**Redesign opportunities**
- —

### CMP-01c · Tab "Resultat"

- **Route:** `/career/competitions/[competitionId]?tab=` · **Kind:** tab · **Importance:** frequent · **Parent:** CMP-01
- **Components:** `components/manager/CompetitionWorkspace.tsx`
- **Purpose:** Played fixtures.
- **Main actions:** Read; Open linked entities
- **Current visual structure:** FixtureTable.
- **Navigation relationships:** CMP-01
- **Desktop:** Main column.
- **Mobile:** Scroll tables.

**Strengths**
- URL-addressable

**Weaknesses**
- —

**Redesign opportunities**
- —

### CMP-01d · Tab "Spelarstatistik"

- **Route:** `/career/competitions/[competitionId]?tab=` · **Kind:** tab · **Importance:** occasional · **Parent:** CMP-01
- **Components:** `components/manager/CompetitionWorkspace.tsx`
- **Purpose:** Player ranking for this competition.
- **Main actions:** Read; Open linked entities
- **Current visual structure:** StatisticsTable (metric select, minimum filter, 12 columns).
- **Navigation relationships:** CMP-01
- **Desktop:** Main column.
- **Mobile:** Scroll tables.

**Strengths**
- URL-addressable

**Weaknesses**
- —

**Redesign opportunities**
- —

### CMP-01e · Tab "Klubbar"

- **Route:** `/career/competitions/[competitionId]?tab=` · **Kind:** tab · **Importance:** occasional · **Parent:** CMP-01
- **Components:** `components/manager/CompetitionWorkspace.tsx`
- **Purpose:** Clubs list with city and squad count.
- **Main actions:** Read; Open linked entities
- **Current visual structure:** 3-column table.
- **Navigation relationships:** CMP-01
- **Desktop:** Main column.
- **Mobile:** Scroll tables.

**Strengths**
- URL-addressable

**Weaknesses**
- —

**Redesign opportunities**
- —

### CMP-01f · Tab "Historik"

- **Route:** `/career/competitions/[competitionId]?tab=` · **Kind:** tab · **Importance:** rare · **Parent:** CMP-01
- **Components:** `components/manager/CompetitionWorkspace.tsx`
- **Purpose:** Finished seasons links.
- **Main actions:** Read; Open linked entities
- **Current visual structure:** Link rows / EmptyState.
- **Navigation relationships:** CMP-01
- **Desktop:** Main column.
- **Mobile:** Scroll tables.

**Strengths**
- URL-addressable

**Weaknesses**
- —

**Redesign opportunities**
- —

### CMP-01g · Svenska Cupen variant (CupWorkspace)

- **Route:** `/career/competitions/se-svenska-cupen-herr` · **Kind:** state · **Importance:** occasional · **Parent:** CMP-01
- **Components:** `components/manager/CupWorkspace.tsx`
- **Purpose:** Cup path ("Din väg i cupen"), next cup matches, group tables, fixtures/results, previous winners.
- **Main actions:** Switch tabs; Open matches
- **Current visual structure:** Header section + panels per group (#, Lag, M, +/-, P).
- **Navigation relationships:** CMP-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Group stage + ties supported

**Weaknesses**
- Different visual structure from league workspace; no bracket visual

**Redesign opportunities**
- Bracket / path visual

### CMP-01h · Non-simulated league / not found states

- **Route:** `/career/competitions/[competitionId]` · **Kind:** state · **Importance:** occasional · **Parent:** CMP-01
- **Components:** `components/manager/CompetitionWorkspace.tsx`
- **Purpose:** "Ej simulerad · ingen tabell" with note to explore clubs; "Tävlingen hittades inte."
- **Main actions:** Inspektera klubbarna →
- **Current visual structure:** Status pill + world note.
- **Navigation relationships:** CMP-01e
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Honest scope

**Weaknesses**
- -

**Redesign opportunities**
- -

### CMP-02 · Match (fixture page)

- **Route:** `/career/fixtures/[fixtureId]` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/fixtures/[fixtureId]/page.tsx`, `components/manager/Workspace.tsx (FixtureTable)`, `components/FormDots.tsx`
- **Purpose:** Neutral fixture page for any match (own or other): teams, table position, form, recent fixtures; link to report when played.
- **Main actions:** Open match report (if played); Open club; Open schedule (not found)
- **Current visual structure:** PageHeading (date/time, "Home – Away", result or round); two Panels side by side (one per club: table position, form dots, FixtureTable).
- **Navigation relationships:** /career/match-report/[id], /career/schedule, /career/clubs/[id]
- **Desktop:** Two panels.
- **Mobile:** hm-comparison-select wraps.

**Strengths**
- Works for archive fixtures via careerArchiveSummaries

**Weaknesses**
- For the user's next match it is not a preparation hub (prep is on match-preview); Training links to this page as "Matchförberedelse →" which is misleading
- Very thin page

**Redesign opportunities**
- Head-to-head history, odds-like strength comparison, redirect own next fixture to match prep

### CMP-03 · Matcher (legacy redirect)

- **Route:** `/career/matches` · **Kind:** state · **Importance:** internal
- **Components:** `app/career/matches/page.tsx`
- **Purpose:** Client-side redirect to /career/schedule (Schedule is the canonical fixture list, owned by part A).
- **Main actions:** None
- **Current visual structure:** Renders null then router.replace.
- **Navigation relationships:** /career/schedule
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Old bookmarks do not 404

**Weaknesses**
- Client redirect flashes empty page; /career/match-center redirects here, creating a double redirect

**Redesign opportunities**
- Server redirect

### CMP-04 · Statistik

- **Route:** `/career/statistics` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/statistics/page.tsx`, `components/manager/StatisticsTable.tsx`, `components/game/Identity.tsx (PlayerCell, RankIndicator)`
- **Purpose:** League-wide season statistics: leaders, player ranking, team attack & defence.
- **Main actions:** Choose ranking metric (Mål, Matcher, Skotteffektivitet, Räddningar…); Set minimum sample; Tidigare säsonger →; Open players/clubs
- **Current visual structure:** PageHeading; leader strip of 3 cards (Flest mål, Flest räddningar, Högst snittbetyg); Panel "Spelarranking" (12-column table: #, Spelare, Nuvarande klubb, Pos, Matcher, Starter, Mål, Skott, Skott %, Räddningar / mötta, Räddning %, Betyg); Panel "Lag · anfall & försvar" (8 columns).
- **Navigation relationships:** /career/history, SQD-02, /career/clubs/[id]
- **Desktop:** Stack.
- **Mobile:** Tables scroll.

**Strengths**
- Minimum-sample filter avoids small-sample leaders
- Copy promises "Varje procenttal har ett underlag"

**Weaknesses**
- Only own league; no competition switcher (unlike competitions tab)
- No per-position leaderboards, no charts
- Duplicate of competition "Spelarstatistik" tab

**Redesign opportunities**
- Scatter plots (shots vs efficiency, saves vs faced)
- Position-specific leaderboards

## MDY — Matchday

### MDY-01 · Matchförhandsvisning (match preview / matchday gate)

- **Route:** `/career/match-preview` · **Kind:** page · **Importance:** core
- **Components:** `app/career/match-preview/page.tsx`, `components/matchday/Matchday.tsx (MatchdayStage)`, `components/game/Identity.tsx (MatchHero)`, `components/manager/MatchContext.tsx`, `components/scouting/OpponentScoutingPanel.tsx`, `components/game/ConfirmDialog.tsx`, `lib/career/productionMatch*`
- **Purpose:** Pre-match hub for the NEXT fixture: stakes, table & form, media, opponent knowledge, our starting seven, low-readiness warnings, unavailable players; start live match or quick result on matchday.
- **Main actions:** STARTA MATCH → / FORTSÄTT MATCH →; Quick result (snabbresultat); Confirm start despite squad warnings (dialog); Justera taktik & matchtrupp →; Beställ scoutingrapport (opponent); Anpassa matchplanen →; Open players
- **Current visual structure:** Alerts (error, blocking squad issues, lineup errors) rendered ABOVE PageHeading; MatchdayStage (stakes band, "Tabell och form", "Vad som sägs", "Det vi vet"); MatchHero with start buttons (only on matchday); MatchContext; OpponentScoutingPanel compact; grid of two Panels ("Din matchförberedelse & startsjua" with 7 slot cards incl. K/7m badges + "Lägre beredskap" list; "Otillgängliga spelare" table).
- **Navigation relationships:** /career/tactics, /career/match-day/[fixtureId], /career/match-day/[fixtureId]?finish=1, SQD-02
- **Desktop:** Stacked bands; 2-panel auto-fit grid (min 340px).
- **Mobile:** matchday.css ≤1100px stacks; grid auto-fits to one column.

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

**Redesign opportunities**
- True "matchday ritual": checklist (squad ✓, GK ✓, 7m ✓, opponent report ✓) → kick-off
- Lineup on a court graphic with readiness rings
- Opponent threat cards next to our matchups

### MDY-01a · MatchdayStage ("Matchdagen")

- **Route:** `/career/match-preview` · **Kind:** panel · **Importance:** frequent · **Parent:** MDY-01
- **Components:** `components/matchday/Matchday.tsx`
- **Purpose:** Stakes, assistant-control alert, table & form, media quotes, opponent knowledge.
- **Main actions:** Read
- **Current visual structure:** mday-stage with three bd-panels.
- **Navigation relationships:** MDY-01
- **Desktop:** -
- **Mobile:** Stacks.

**Strengths**
- Narrative framing of the match

**Weaknesses**
- Text heavy

**Redesign opportunities**
- Stakes meter

### MDY-01b · Confirm dialog "Kontrollera matchtruppen"

- **Route:** `/career/match-preview` · **Kind:** modal · **Importance:** occasional · **Parent:** MDY-01
- **Components:** `components/game/ConfirmDialog.tsx`
- **Purpose:** Shown when squad has warnings (e.g. NO_SUBSTITUTES) before LIVE or QUICK start.
- **Main actions:** Confirm start; Cancel
- **Current visual structure:** ConfirmDialog (warning tone) with counts and warning list.
- **Navigation relationships:** MDY-01
- **Desktop:** -
- **Mobile:** Stacks.

**Strengths**
- Prevents accidental bad starts

**Weaknesses**
- -

**Redesign opportunities**
- Fix-in-place actions inside dialog

### MDY-01c · Blocking / lineup error alerts

- **Route:** `/career/match-preview` · **Kind:** state · **Importance:** occasional · **Parent:** MDY-01
- **Components:** `app/career/match-preview/page.tsx`
- **Purpose:** role=alert banners with link to Taktik when lineup invalid or squad blocking.
- **Main actions:** Rätta matchtruppen i Taktik →
- **Current visual structure:** hm-panel-body alerts.
- **Navigation relationships:** MDY-01
- **Desktop:** -
- **Mobile:** Stacks.

**Strengths**
- Actionable

**Weaknesses**
- Above heading; plain styling

**Redesign opportunities**
- Inline checklist

### MDY-01d · OpponentScoutingPanel (compact)

- **Route:** `/career/match-preview` · **Kind:** panel · **Importance:** frequent · **Parent:** MDY-01
- **Components:** `components/scouting/OpponentScoutingPanel.tsx`
- **Purpose:** Order opponent scouting report (choose analyst/scout); report with confidence per topic, observed strengths/weaknesses, recommendations, link to plan.
- **Main actions:** Beställ scoutingrapport; Anpassa matchplanen →
- **Current visual structure:** hm-plan-section.
- **Navigation relationships:** MDY-01
- **Desktop:** -
- **Mobile:** Stacks.

**Strengths**
- Confidence labels per topic

**Weaknesses**
- Same panel also on analysis/opponent

**Redesign opportunities**
- Threat cards

### MDY-01e · Panels "Din matchförberedelse & startsjua" + "Otillgängliga spelare"

- **Route:** `/career/match-preview` · **Kind:** panel · **Importance:** core · **Parent:** MDY-01
- **Components:** `app/career/match-preview/page.tsx`
- **Purpose:** Starting seven slot cards, plan summary, low-readiness list; unavailable list with status badge.
- **Main actions:** Taktiktavla →; Open player
- **Current visual structure:** Two Panels in auto-fit grid.
- **Navigation relationships:** MDY-01
- **Desktop:** -
- **Mobile:** Stacks.

**Strengths**
- Readiness list

**Weaknesses**
- Raw enum text; slot cards not court-shaped

**Redesign opportunities**
- Court lineup graphic

### MDY-01f · States: season complete / no fixture

- **Route:** `/career/match-preview` · **Kind:** state · **Importance:** rare · **Parent:** MDY-01
- **Components:** `app/career/match-preview/page.tsx`
- **Purpose:** "Säsongen är avslutad…" / "Ingen kommande match schemalagd."
- **Main actions:** None
- **Current visual structure:** Muted panel.
- **Navigation relationships:** MDY-01
- **Desktop:** -
- **Mobile:** Stacks.

**Strengths**
- -

**Weaknesses**
- No CTA

**Redesign opportunities**
- CTA to season review / schedule

### MDY-02 · Live match (Match Center)

- **Route:** `/career/match-day/[fixtureId][?finish=1]` · **Kind:** page · **Importance:** core
- **Components:** `app/career/match-day/[fixtureId]/page.tsx`, `components/ProductionMatchView.tsx`, `components/matchCenter/MatchCenter.tsx (LiveMatchCenter, MatchCenterSurface, KeyMoment, Commentary)`, `components/matchCenter/WorkspaceViews.tsx`, `components/matchCenter/TimeoutOverlay.tsx`, `components/matchCenter/TacticalCourt.tsx`, `components/game/LiveCoachPanel.tsx`, `components/game/CoachingChoices.tsx`, `components/matchCenter/match-center.css`, `lib/matchCenter/model.ts`, `lib/matchCenter/workspace.ts`
- **Purpose:** Play the match: event-driven text/key-moment match center with tactical snapshots, live coaching (tactics, timeouts, substitutions), half-time and full-time decisions, optional continuous 2D court; also serves as archive replay when no live session.
- **Main actions:** Spela / Pausa / Starta andra halvlek / Återuppta efter timeout; Hastighet (Realtid 1×, Normal 2×, Snabb 10×, Mycket snabb 20×, Express 48×, Turbo 64×, Maximal 86×); Nästa viktiga händelse; Nyckelhändelser på/av; Spela till slut (quick finish); Slutför match och öppna rapport; Switch view (Översikt / Nyckelögonblick / Spelare / Statistik; arrow-key tablist); Change tactics live; Call timeout; Substitute (out → in); Assistentbyten på/av; Open Experimental 2D
- **Current visual structure:** Optional stakes banner; MatchCenterSurface: header (crests, score, period, clock, manpower line "6v6 jämnt"/"6v5 övertag"/"7 mot 6", suspensions), skip link, controls bar, sticky workspace nav with compact score, tabpanel per view, coach aside (LiveCoachPanel) on the side, details "Experimental 2D" with SVG LiveCourt.
- **Navigation relationships:** /career/match-report/[fixtureId], /career/match-preview, /career
- **Desktop:** Live layout: view panel + coach aside.
- **Mobile:** match-center.css ≤1000px single column (header compacts); ≤900px overview/player/stat workspaces single column; coaching.css ≤1050px live layout single column, out-list 4-col.

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

**Redesign opportunities**
- Unified "bench" decision dock (tactics, timeout, subs) always visible
- Promote 2D/court view as a first-class view tab with momentum overlay
- Live momentum graph + energy bars for on-court players
- Half-time as a dedicated briefing screen with stats and suggested changes

### MDY-02a · Header / scoreboard & manpower

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** panel · **Importance:** core · **Parent:** MDY-02
- **Components:** `components/matchCenter/MatchCenter.tsx`
- **Purpose:** Crests, score, competition label, period & remaining time, manpower line, suspensions/disqualifications per club.
- **Main actions:** Read
- **Current visual structure:** mc-header.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Handball-specific manpower state

**Weaknesses**
- Timeouts remaining not prominent

**Redesign opportunities**
- Timeout & suspension timers as visual pips

### MDY-02b · Controls bar

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** panel · **Importance:** core · **Parent:** MDY-02
- **Components:** `components/ProductionMatchView.tsx`
- **Purpose:** Play/pause/resume/second half, speed select, next key event, key-events toggle, play to end, finalise.
- **Main actions:** See MDY-02 actions
- **Current visual structure:** mc-controls row of buttons + select.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Labels change with state

**Weaknesses**
- Many equal-weight buttons

**Redesign opportunities**
- Single transport control

### MDY-02c · View "Översikt"

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** tab · **Importance:** core · **Parent:** MDY-02
- **Components:** `components/matchCenter/MatchCenter.tsx`, `components/matchCenter/TacticalCourt.tsx`
- **Purpose:** Key moment card with tactical snapshot stepper (TacticalCourt, närbild/helplan), commentary feed ("Från planen · Direktflöde"), match summary, "Matchen i siffror" table, "Matchens profiler", "Händelser att återvända till"; TimeoutOverlay and decision heading appear here.
- **Main actions:** Step snapshots; Toggle full court; Toggle important events; Open moment/player
- **Current visual structure:** mc-overview-grid two columns.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Rich narrative + tactical illustration

**Weaknesses**
- Very busy; many sub-sections

**Redesign opportunities**
- Prioritise live state over review content

### MDY-02d · View "Nyckelögonblick"

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** tab · **Importance:** frequent · **Parent:** MDY-02
- **Components:** `components/matchCenter/MatchCenter.tsx`, `lib/matchCenter/workspace.ts`
- **Purpose:** Filterable key moments (Alla, Mål, Räddningar, Genombrott, Omställning, 7m, Försvar) with KeyMoment detail.
- **Main actions:** Filter; Open moment
- **Current visual structure:** Filter chips + moment list + detail.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Filters hidden if no matching moments

**Weaknesses**
- -

**Redesign opportunities**
- Timeline scrubber

### MDY-02e · View "Spelare"

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** tab · **Importance:** frequent · **Parent:** MDY-02
- **Components:** `components/matchCenter/WorkspaceViews.tsx`
- **Purpose:** Per-team player performance table sortable by Position, Betyg, Mål, Skott, Minuter, Energi; player focus with related moments.
- **Main actions:** Switch team; Sort; Select player
- **Current visual structure:** mc-player-workspace.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Live energy per player

**Weaknesses**
- -

**Redesign opportunities**
- Energy bars + rating sparkline

### MDY-02f · View "Statistik" (sub-nav Match & positioner / Avslut / Målvakter / Matchutveckling)

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** tab · **Importance:** frequent · **Parent:** MDY-02
- **Components:** `components/matchCenter/WorkspaceViews.tsx`, `components/matchCenter/TacticalCourt.tsx (ShotMap)`
- **Purpose:** Team stats with definitions (Mål, Skott, Mål/skott, Räddningar, Räddningsprocent, Bollförluster, Tekniska fel, Frikast, 2 min, Omställningsmål), goals by registered position, shot map with outcome filter, keeper categories, score-flow SVG.
- **Main actions:** Switch section; Filter shots by team/player/outcome
- **Current visual structure:** mc-analysis-nav + panels.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Shot map with registered origins; metric definitions

**Weaknesses**
- No shot-quality / xG-like measure

**Redesign opportunities**
- Heat zones, goal-mouth placement map

### MDY-02g · Coach aside "Dina matchbeslut" (LiveCoachPanel)

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** panel · **Importance:** core · **Parent:** MDY-02
- **Components:** `components/game/LiveCoachPanel.tsx`, `components/game/CoachingChoices.tsx`
- **Purpose:** Possession indicator, CoachingChoices (defence, aggression, tempo, attack, rotation), timeout block (1 per half, reasons when disabled), substitutions (choose out on court → eligible in from bench of same kind), Assistentbyten toggle, bench & availability details.
- **Main actions:** Change tactic; Ta timeout; Byt ut / Byt in; Toggle assistant subs
- **Current visual structure:** aside.game-sideline sections.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Explains why timeout is unavailable
- Substitution respects suspensions/exit-required

**Weaknesses**
- No energy-sorted bench; energy only as text per button

**Redesign opportunities**
- Bench dock with energy bars

### MDY-02h · TimeoutOverlay ("Din timeout · Samla laget" / opponent timeout)

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** overlay · **Importance:** frequent · **Parent:** MDY-02
- **Components:** `components/matchCenter/TimeoutOverlay.tsx`
- **Purpose:** Non-modal dialog (role=dialog, aria-modal=false) during timeouts: contextual team directives based on score margin/period (e.g. "Hög press & snabb omställning", "Täta bakåt & kontrollerat tempo", "Extraspela 7 mot 6") with effect/trade-off/duration, tactical base settings, on-court players with substitution picker, assistant notice, resume banner.
- **Main actions:** Choose directive; Adjust tactics; Substitute; Resume
- **Current visual structure:** mc-timeout-overlay inside Overview with inline-styled banners.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Best decision copy in the game: intended effect, trade-off, duration

**Weaknesses**
- Duplicates LiveCoachPanel substitutions and tactics
- Inline styles

**Redesign opportunities**
- Make this the model for all coaching decisions

### MDY-02i · Half-time state

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** state · **Importance:** frequent · **Parent:** MDY-02
- **Components:** `components/matchCenter/MatchCenter.tsx`, `components/ProductionMatchView.tsx`
- **Purpose:** Session pausedAtHalf: view forced to Översikt, decision heading "Nästa halvlek börjar med ditt beslut.", primary button "Starta andra halvlek".
- **Main actions:** Adjust tactics/subs; Starta andra halvlek
- **Current visual structure:** mc-decision-heading role=status.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Explicit pause for decisions

**Weaknesses**
- No dedicated half-time summary (first-half stats vs plan, energy)

**Redesign opportunities**
- Half-time briefing screen

### MDY-02j · Full-time state

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** state · **Importance:** core · **Parent:** MDY-02
- **Components:** `components/ProductionMatchView.tsx`
- **Purpose:** Reviewing mode: summary headline (win/draw/loss story), coach aside hidden, button "Slutför match och öppna rapport".
- **Main actions:** Slutför match och öppna rapport
- **Current visual structure:** Same surface in review mode.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Smooth hand-off to report

**Weaknesses**
- Report then re-renders much of the same content (ANL-01)

**Redesign opportunities**
- Merge full-time and report into one post-match flow

### MDY-02k · Assistant-in-control state

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** state · **Importance:** rare · **Parent:** MDY-02
- **Components:** `components/ProductionMatchView.tsx`
- **Purpose:** When manager is suspended: banner and "{name} leder laget" box replaces coach panel; manager can only watch.
- **Main actions:** Watch
- **Current visual structure:** mday-control status box.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Rules made explicit

**Weaknesses**
- -

**Redesign opportunities**
- -

### MDY-02l · Experimental 2D court (details)

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** panel · **Importance:** occasional · **Parent:** MDY-02
- **Components:** `components/ProductionMatchView.tsx (Court, LiveCourt)`
- **Purpose:** Optional continuous SVG court (players as numbered circles in club colours, ball) driven by frame buffer; also in archive replay.
- **Main actions:** Open/close
- **Current visual structure:** <details><summary>Experimental 2D</summary>.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Live positional data exists for a real visual

**Weaknesses**
- English label, hidden by default in live match; minimal graphics

**Redesign opportunities**
- First-class 2D view with trails and tactical shape

### MDY-02m · Quick finish / no session / archive fallback states

- **Route:** `/career/match-day/[fixtureId]` · **Kind:** state · **Importance:** occasional · **Parent:** MDY-02
- **Components:** `components/ProductionMatchView.tsx`
- **Purpose:** ?finish=1 auto-simulates to full time then redirects to report; without session: loading "Laddar matchreprisen…", error + "Försök igen", archive replay with "Matchrapport"/"Fortsätt karriären", or text + "Öppna match".
- **Main actions:** Försök igen; Matchrapport; Fortsätt karriären
- **Current visual structure:** Plain paragraphs and buttons.
- **Navigation relationships:** MDY-02
- **Desktop:** Inside match center.
- **Mobile:** Single column ≤900–1000px.

**Strengths**
- Resilient fallbacks

**Weaknesses**
- Unstyled; quick finish has no progress visual

**Redesign opportunities**
- Simulation progress screen

### MDY-03 · Match Center (legacy redirect)

- **Route:** `/career/match-center` · **Kind:** state · **Importance:** internal
- **Components:** `app/career/match-center/page.tsx`
- **Purpose:** Server redirect to /career/matches (which client-redirects to /career/schedule).
- **Main actions:** None
- **Current visual structure:** redirect().
- **Navigation relationships:** CMP-03
- **Desktop:** -
- **Mobile:** -

**Strengths**
- -

**Weaknesses**
- Double redirect chain

**Redesign opportunities**
- Redirect directly to schedule or remove

### MDY-04 · Matchrepriser (match-2d replays)

- **Route:** `/career/match-2d` · **Kind:** page · **Importance:** rare
- **Components:** `app/career/match-2d/page.tsx`, `components/ProductionMatchView.tsx (ArchiveReplay)`, `lib/save/useMatchArchive.ts`
- **Purpose:** Pick any archived match and replay it (match center + experimental 2D shown by default); continue an ongoing match.
- **Main actions:** Fortsätt pågående match; Select archived match; Försök igen
- **Current visual structure:** Bare hm-grid: heading, select of archived matches (date · score), then ArchiveReplay.
- **Navigation relationships:** /career/match-day/[fixtureId]
- **Desktop:** Plain.
- **Mobile:** Plain.

**Strengths**
- Archive replay with 2D

**Weaknesses**
- Source file has broken encoding: every Swedish character renders as "?" (e.g. "Matchrepriser ? nyckel?gonblick", "Forts?tt p?g?ende match", "V?lj matchrepris")
- Not in main navigation (navigation.ts only lists it as an owned prefix) – effectively orphaned
- Unstyled select page

**Redesign opportunities**
- Fold into match report / history as "Repris"; fix encoding

## ANL — Match analysis

### ANL-01 · Matchrapport

- **Route:** `/career/match-report/[fixtureId]` · **Kind:** page · **Importance:** core
- **Components:** `app/career/match-report/[fixtureId]/page.tsx`, `components/ProductionMatchView.tsx (ArchiveReplay)`, `components/matchCenter/MatchCenter.tsx (ArchivedMatchCenter)`, `components/matchday/Matchday.tsx (MatchAftermathPanel, MatchFlow)`, `lib/save/useMatchArchive.ts`
- **Purpose:** Post-match: result, performances, decisive moments, stats comparison, aftermath (media headlines, voices, goal-difference flow), press conference entry, playing time & workload, next steps.
- **Main actions:** ← Schema; Se matchrepris; Öppna matchanalys (if latest); Tabell & liga → / Svenska Cupen →; 🎤 Möt pressen → (when open); Fortsätt →; Expand/collapse "Speltid och belastning"; Försök igen (archive load error)
- **Current visual structure:** Two variants. Archive variant: PageHeading, full ArchivedMatchCenter (same 4 views as live), HeadToHeadStatsComparison, MatchAftermathPanel, PostMatchPressBanner, action bar (5–6 buttons), open <details> table (Spelare, Minuter, Energi efter match, Matchbelastning, Senaste 7 dagar). Legacy variant (no archive): MatchHero with result, aftermath, "Bästa spelare", "Tabellplacering", "Matchstatistik · Jämförelse", two "spelarbetyg" tables (Mål, Skott, Betyg).
- **Navigation relationships:** /career/schedule, /career/match-day/[id], /career/analysis/last-match, /career/competitions/[id], /career/media/press/[id], /career
- **Desktop:** Long single column.
- **Mobile:** Match center rules ≤900px; tables scroll.

**Strengths**
- Workload table connects match minutes to the training load model (same unit)
- Aftermath gives narrative closure (media, voices, flow chart)
- Clear next-step CTAs incl. press

**Weaknesses**
- "Se matchrepris" opens /career/match-day/[id] which renders the same ArchiveReplay already on the report page
- Two divergent layouts depending on archive availability
- Action bar has two primary buttons (press + continue)
- Stats comparison rendered twice in archive variant (match center Statistik + HeadToHead panel)

**Redesign opportunities**
- Single post-match story: score → turning points → player ratings → workload consequences → what to change (link to training/tactics)
- Player rating chart and momentum graph as hero

### ANL-01a · Archived match center (4 views)

- **Route:** `/career/match-report/[fixtureId]` · **Kind:** panel · **Importance:** core · **Parent:** ANL-01
- **Components:** `components/matchCenter/MatchCenter.tsx`
- **Purpose:** Same Översikt / Nyckelögonblick / Spelare / Statistik views as live, read-only, with Experimental 2D details.
- **Main actions:** Switch views; Explore moments
- **Current visual structure:** MatchCenterSurface in review mode.
- **Navigation relationships:** ANL-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Consistency with live

**Weaknesses**
- Heavy for a report

**Redesign opportunities**
- Report-specific summary first

### ANL-01b · MatchAftermathPanel ("Efter matchen")

- **Route:** `/career/match-report/[fixtureId]` · **Kind:** panel · **Importance:** frequent · **Parent:** ANL-01
- **Components:** `components/matchday/Matchday.tsx`
- **Purpose:** Media headlines ("Rubrikerna"), voices after final whistle, "Målskillnaden minut för minut" SVG flow chart.
- **Main actions:** Read
- **Current visual structure:** mday-after with bd-panels.
- **Navigation relationships:** ANL-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Emotion + data

**Weaknesses**
- Flow chart small

**Redesign opportunities**
- Momentum hero chart

### ANL-01c · Details "Speltid och belastning"

- **Route:** `/career/match-report/[fixtureId]` · **Kind:** panel · **Importance:** frequent · **Parent:** ANL-01
- **Components:** `app/career/match-report/[fixtureId]/page.tsx`
- **Purpose:** Minutes, energy after match, match workload (≈ estimated for GKs), last-7-days load per player who played.
- **Main actions:** Collapse
- **Current visual structure:** Open <details> with table.
- **Navigation relationships:** ANL-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Bridges match → training

**Weaknesses**
- No link to adjust training load

**Redesign opportunities**
- Inline "rest next day" actions

### ANL-01d · Legacy report variant (no archive)

- **Route:** `/career/match-report/[fixtureId]` · **Kind:** state · **Importance:** occasional · **Parent:** ANL-01
- **Components:** `app/career/match-report/[fixtureId]/page.tsx`
- **Purpose:** Fallback when archive missing: MatchHero, best players, table position, stats comparison, rating tables.
- **Main actions:** Same nav buttons
- **Current visual structure:** hm-grid of panels.
- **Navigation relationships:** ANL-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Works for simulated/quick matches

**Weaknesses**
- Different look from archive variant

**Redesign opportunities**
- Unify

### ANL-01e · Error / no report states

- **Route:** `/career/match-report/[fixtureId]` · **Kind:** state · **Importance:** rare · **Parent:** ANL-01
- **Components:** `app/career/match-report/[fixtureId]/page.tsx`
- **Purpose:** "Den här matchen saknar en rapport.", archive load error with "Försök igen".
- **Main actions:** Försök igen
- **Current visual structure:** Plain panel/alert.
- **Navigation relationships:** ANL-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- -

**Weaknesses**
- No navigation out

**Redesign opportunities**
- Back links

### ANL-01f · PostMatchPressBanner

- **Route:** `/career/match-report/[fixtureId]` · **Kind:** panel · **Importance:** occasional · **Parent:** ANL-01
- **Components:** `app/career/match-report/[fixtureId]/page.tsx`
- **Purpose:** Entry to post-match press conference (media domain owned by part A).
- **Main actions:** Möt pressen
- **Current visual structure:** Banner.
- **Navigation relationships:** ANL-01
- **Desktop:** -
- **Mobile:** -

**Strengths**
- Contextual

**Weaknesses**
- -

**Redesign opportunities**
- -

### ANL-02 · Matchanalys – Översikt

- **Route:** `/career/analysis` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/analysis/layout.tsx`, `app/career/analysis/page.tsx`, `lib/analysis/viewModels.ts`, `components/analysis/EvidenceLists.tsx`, `components/game/Secondary.tsx`
- **Purpose:** Analysis hub: next opponent hero, last match result, own form (last five), observed patterns; tabs to opponent / our team / last match.
- **Main actions:** Switch analysis tab (Översikt / Motståndaren / Vårt lag / Senaste matchen); Analysera motståndaren →; Matchförberedelse →; Matchanalys →; Arbeta med matchplanen / Planera veckan
- **Current visual structure:** Layout: SectionScene (crest, actions Matchplan) + hm-tabs links. Overview: split main (MatchHero next, Panel "Senaste matchen") + rail ("Vårt lag · senaste fem" form dots + metrics, "Observerade mönster", note "Från match till beslut").
- **Navigation relationships:** /career/tactics, /career/training, /career/match-preview, /career/analysis/*
- **Desktop:** Split.
- **Mobile:** secondary.css ≤1200/760/720 stacks.

**Strengths**
- Evidence model: Evidence<T> ok/missing with explicit MissingDataNote; patterns vs interpretations separated
- Route-based tabs (deep-linkable)

**Weaknesses**
- Thin overview that duplicates match preview and report entry points
- Patterns and interpretations are plain text lists – no charts despite numeric basis

**Redesign opportunities**
- Analysis dashboard with trend charts (goals for/against, shooting %, save %) and "what changed" cards

### ANL-02a · Analysis tab bar (layout)

- **Route:** `/career/analysis/*` · **Kind:** tab · **Importance:** frequent · **Parent:** ANL-02
- **Components:** `app/career/analysis/layout.tsx`
- **Purpose:** Four route tabs.
- **Main actions:** Navigate
- **Current visual structure:** nav.hm-tabs with aria-current.
- **Navigation relationships:** ANL-02, ANL-03, ANL-04, ANL-05
- **Desktop:** -
- **Mobile:** Wraps.

**Strengths**
- Proper aria-current

**Weaknesses**
- -

**Redesign opportunities**
- -

### ANL-03 · Matchanalys – Motståndaren

- **Route:** `/career/analysis/opponent` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/analysis/opponent/page.tsx`, `components/scouting/OpponentScoutingPanel.tsx`, `lib/analysis/viewModels.ts`
- **Purpose:** Next opponent: scouting report ordering, recent matches, attack & defence metrics over last five, league position, form, patterns, interpretation.
- **Main actions:** Beställ scoutingrapport; Öppna matchplan →; Matchförberedelse →; Klubb & trupp →
- **Current visual structure:** Main: MatchHero; OpponentScoutingPanel; Panel "Motståndarens senaste matcher" (6 columns); two metric panels "Anfall · senaste fem" (Mål/match, Skott/match, Skotteffektivitet, Bollförluster/match, 7m-effektivitet) and "Försvar · senaste fem" (Insläppta/match, Räddningsprocent, Räddningar/match, Utvisningar/match). Rail: club facts, patterns, interpretation, note.
- **Navigation relationships:** /career/tactics, /career/match-preview, /career/clubs/[id], /career/match-report/[id]
- **Desktop:** Split.
- **Mobile:** Stacks.

**Strengths**
- Explicit statement of what is NOT in the data (no individual opponent production)

**Weaknesses**
- No comparison to our own numbers side by side
- Empty state when no next fixture only links to history

**Redesign opportunities**
- Mirror chart us vs them per metric; tactical recommendation linking to specific plan settings

### ANL-04 · Matchanalys – Vårt lag

- **Route:** `/career/analysis/our-team` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/analysis/our-team/page.tsx`, `lib/analysis/viewModels.ts`
- **Purpose:** Own team over last five or season: form, goal difference, attack & defence metrics, outfield and goalkeeper season tables, patterns.
- **Main actions:** Toggle window (Senaste fem / Hela säsongen); Matchplan → / Träningsvecka → / Truppen →
- **Current visual structure:** Panel with window toggle + form dots + 4 metrics; two metric panels; "Säsongens utespelare" (6 columns) and "Säsongens målvakter" (6 columns) tables; rail patterns, interpretation, note.
- **Navigation relationships:** /career/squad, /career/tactics, /career/training
- **Desktop:** Split.
- **Mobile:** Stacks.

**Strengths**
- Explains which numbers the window affects

**Weaknesses**
- Player tables ignore the window toggle (always season) – potentially confusing
- Numbers only

**Redesign opportunities**
- Rolling trend lines; per-player contribution chart

### ANL-05 · Matchanalys – Senaste matchen

- **Route:** `/career/analysis/last-match` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/analysis/last-match/page.tsx`, `components/analysis/presentation.ts`, `components/game/Identity.tsx (Scoreboard)`
- **Purpose:** Deep dive on the latest own match: team match facts, player contributions, filterable event timeline, halves split, scoring runs, patterns, interpretation.
- **Main actions:** Filter events (Alla, Mål, Räddningar, Bollförluster, 2 min, 7m); Matchrapport & repris →; Open players/clubs
- **Current visual structure:** Scoreboard; main: "Lagens matchfakta" (mått × vårt lag × motstånd), "Spelarnas bidrag" (Mål, Skott, Betyg), "Matchhändelser" timeline with filter buttons; rail: "Halvlekar" table, "Mål i följd" (scoring runs), patterns, "Bedömning".
- **Navigation relationships:** /career/match-report/[id], /career/schedule, /career/history
- **Desktop:** Split.
- **Mobile:** Stacks.

**Strengths**
- Scoring runs and half split are insightful handball analytics

**Weaknesses**
- Largely duplicates match report / match center statistics for the same match
- Only the latest match (no picker)

**Redesign opportunities**
- Merge into report as "Analys" tab; allow any match

## MGR — Manager career

### MGR-01 · Karriär (manager career)

- **Route:** `/career/manager` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/manager/page.tsx`, `components/experience/Moment.tsx (MomentHero, DecisionCard)`, `components/board/boardVisuals.ts`, `lib/manager/managerCareer.ts`
- **Purpose:** Manager reputation, career stats, clubs history, resignation, job market (offers, vacancies, applications).
- **Main actions:** Switch tab Profil och historik / Jobbmarknaden (?tab=jobs); Avgå (resign); Tacka ja / decline offer; Apply for vacancy
- **Current visual structure:** Boardroom-photo MomentHero (variants: dismissed/unemployed, new club welcome, neutral compact); role=tablist with 2 tabs; bd-panels: Tränarprofilen, Karriärstatistik, Avgå (DecisionCard), Klubbarna (per stint 6-col season table) | Erbjudanden (DecisionCards with crest), Lediga tjänster, Ansökningar.
- **Navigation relationships:** CLB-05, MGR-02, DSH-01
- **Desktop:** Hero + panel grid.
- **Mobile:** board.css rules (≤1000px single column).

**Strengths**
- Dismissal/appointment moments are dramatised with stamps ('Sparkad', 'Påskrivet')
- Job market makes unemployment playable

**Weaknesses**
- Manager has no face/avatar — reputation is a label
- Reuses the boardroom photo for all states
- Overlaps with Board (contract) and Historik

**Redesign opportunities**
- Manager 'player card' with reputation level, badges, career timeline
- Job offers as club cards with crest/colours/ambition

### MGR-01a · Tab · Profil och historik

- **Route:** `/career/manager` · **Kind:** tab · **Importance:** occasional · **Parent:** MGR-01
- **Components:** `app/career/manager/page.tsx`
- **Purpose:** Reputation, record, resign, club history.
- **Main actions:** Avgå
- **Current visual structure:** 4 bd-panels incl. per-club season tables.
- **Navigation relationships:** MGR-02
- **Desktop:** Grid
- **Mobile:** Stack

**Strengths**
- Clear sections

**Weaknesses**
- Stats as text/numbers

**Redesign opportunities**
- Career timeline graphic

### MGR-01b · Tab · Jobbmarknaden

- **Route:** `/career/manager?tab=jobs` · **Kind:** tab · **Importance:** occasional · **Parent:** MGR-01
- **Components:** `app/career/manager/page.tsx`, `components/experience/Moment.tsx (DecisionCard)`
- **Purpose:** Offers, vacancies and applications.
- **Main actions:** Tacka ja; Apply; Withdraw
- **Current visual structure:** Three bd-panels: offer DecisionCards (crest + deadline pill), vacancy list, applications list; count in tab label.
- **Navigation relationships:** CLB-04
- **Desktop:** Grid
- **Mobile:** Stack

**Strengths**
- Count badge in tab
- Good empty-state copy

**Weaknesses**
- Vacancies as plain list

**Redesign opportunities**
- Club cards with expectations & budget

### MGR-01c · Dismissed / unemployed hero state

- **Route:** `/career/manager` · **Kind:** state · **Importance:** rare · **Parent:** MGR-01
- **Components:** `app/career/manager/page.tsx`
- **Purpose:** Frame being sacked/resigned/out of contract.
- **Main actions:** Go to job market
- **Current visual structure:** MomentHero kind=DISMISSAL with stamp.
- **Navigation relationships:** MGR-01b
- **Desktop:** Hero
- **Mobile:** Hero

**Strengths**
- Emotional beat exists

**Weaknesses**
- Elsewhere (dashboard) only a text note

**Redesign opportunities**
- Full-screen moment on the day it happens

### MGR-02 · Historik

- **Route:** `/career/history` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/history/page.tsx`, `components/game/Secondary.tsx (SectionScene)`, `components/manager/Workspace.tsx (Panel, FixtureTable)`, `components/manager/StatisticsTable.tsx`, `lib/career/matchArchiveSummary.ts`
- **Purpose:** Past seasons: final table, player stats, career match archive, completed transfers.
- **Main actions:** Select season (?season=); Toggle transfers Din klubb / Hela världen; Open match report; Open club/player
- **Current visual structure:** SectionScene header with crest; season link tabs; main: final-table panel (wide table), statistics table, 'Spelade matcharkiv · hela karriären' fixture table, transfers table; rail: final-placement milestone card + note.
- **Navigation relationships:** /career/match-report/[id], CLB-04, /career/squad/[playerId], MGR-03
- **Desktop:** Main + rail (game-secondary-split).
- **Mobile:** Single column (secondary.css ≤ breakpoint).

**Strengths**
- Preserves full archive; season deep-links

**Weaknesses**
- Mostly long tables; no trophies or highlights
- Mojibake in fallback link text: '?ppna ?ldre matcharkiv ?' (app/career/history/page.tsx L44) — encoding bug
- Overlaps Säsongen, Karriär and Statistik

**Redesign opportunities**
- Career scrapbook: season cards with final position, trophy, top scorer, best moment
- Merge into a 'Karriär' hub with MGR-01

### MGR-02a · Season selector tabs

- **Route:** `/career/history?season=` · **Kind:** tab · **Importance:** occasional · **Parent:** MGR-02
- **Components:** `app/career/history/page.tsx (.hm-tabs)`
- **Purpose:** Pick historic season.
- **Main actions:** Select season
- **Current visual structure:** Link tabs with aria-current; hidden when no history.
- **Navigation relationships:** —
- **Desktop:** Tabs
- **Mobile:** Scroll-x

**Strengths**
- URL-driven

**Weaknesses**
- Empty career shows no explanation in tab area

**Redesign opportunities**
- Season timeline

### MGR-03 · Säsongen (season hub)

- **Route:** `/career/season` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/season/page.tsx`, `components/season/CompetitionMark.tsx`, `components/season/Knockout.tsx (BracketGrid, TieCard)`, `components/season/seasonAssets.ts`, `components/season/season.css`, `components/experience/Moment.tsx (MomentHero, EventCard)`
- **Purpose:** Whole-season picture: hero, next step, promotion/relegation movement, SM-slutspel bracket, kval ties, Svenska cupen, league tables with zones, important upcoming matches, rules, awards gala.
- **Main actions:** Open tie/fixture; Open award player; Read rules
- **Current visual structure:** Court/trophy photo MomentHero; NextStep tone card with CompetitionMark; Movement lists (up/down/kval); competition-coloured sections with brackets (BracketGrid), TieCards, cup group tables + bracket, side-by-side league tables with zone colouring; upcoming list; rules; Galan EventCards.
- **Navigation relationships:** /career/fixtures/[id], /career/match-report/[id], /career/squad/[playerId], /career/competitions/[id]
- **Desktop:** Stacked full-width sections.
- **Mobile:** ≤760px band stats stack, fixture lists single column, cup path 2-col.

**Strengths**
- Competition identity marks and colour per competition (HBL/SM/KVAL/CUP)
- Brackets are genuinely visual
- Zone colouring in tables

**Weaknesses**
- Very long single page; overlaps /career/competitions and the separate 'Svenska Cupen' nav item
- Explanatory notes are dense small print (ss-note)

**Redesign opportunities**
- Become the single 'Tävlingar' hub with tabs (Liga / SM / Kval / Cup / Galan)
- Animated bracket progression; trophy moment on title

### MGR-03a · SM-slutspel / Kval / Cup sections

- **Route:** `/career/season` · **Kind:** panel · **Importance:** occasional · **Parent:** MGR-03
- **Components:** `components/season/Knockout.tsx`
- **Purpose:** Knockout progress.
- **Main actions:** Open tie
- **Current visual structure:** SectionHead with mark + BracketGrid (QF/SF/F) or TieCards; champion aside.
- **Navigation relationships:** —
- **Desktop:** Wide
- **Mobile:** Scroll

**Strengths**
- Strong visual

**Weaknesses**
- Only appear when ties exist — no preview of the path before

**Redesign opportunities**
- Show projected bracket early

### MGR-03b · Season verdict & awards gala

- **Route:** `/career/season` · **Kind:** state · **Importance:** rare · **Parent:** MGR-03
- **Components:** `app/career/season/page.tsx (SeasonVerdict, Awards)`
- **Purpose:** End-of-season honours.
- **Main actions:** Open player
- **Current visual structure:** Verdict grid (champion, runner-up, cup winner, series winners with marks) + EventCards per award.
- **Navigation relationships:** —
- **Desktop:** Grid
- **Mobile:** Stack

**Strengths**
- Gala framing

**Weaknesses**
- Only on this page; not pushed as a moment

**Redesign opportunities**
- Full-screen gala sequence

### MGR-04 · Momentbiblioteket (moment library)

- **Route:** `/career/moments` · **Kind:** page · **Importance:** internal
- **Components:** `app/career/moments/page.tsx`, `components/experience/Moment.tsx`, `components/experience/primitives.tsx`, `components/transfers/transferVisuals.ts`, `components/experience/experienceAssets.ts`
- **Purpose:** Developer reference page showing the shared 'experience' components (MomentHero, EventCard, DecisionCard, MeterBar, ProgressSteps, RouteLine, ValueFlow) with the user's club.
- **Main actions:** None functional (buttons are inert)
- **Current visual structure:** Settings-styled page with examples: signing moment with RouteLine/ProgressSteps/ValueFlow, staff appointment hero, championship hero, promotion/dismissal heroes, three EventCards, DecisionCard, meter examples.
- **Navigation relationships:** SYS-01
- **Desktop:** Stacked examples
- **Mobile:** auto-fit grids

**Strengths**
- De-facto living style guide for the 'experience' layer — the best inventory of existing high-emotion components

**Weaknesses**
- Not linked from navigation; reachable only by URL
- Inert buttons look real

**Redesign opportunities**
- Promote into a proper documented component gallery for the redesign

## WLD — World & communication

### WLD-01 · Inkorg (Inbox)

- **Route:** `/career/inbox` · **Kind:** page · **Importance:** core
- **Components:** `app/career/inbox/page.tsx`, `lib/career/inboxFilters.ts`, `lib/career/destinations.ts`, `components/game/WorkspaceMemory.tsx`, `components/game/Identity.tsx (MatchHero, PlayerCell)`, `components/game/recruitment-news.css`
- **Purpose:** Messages from club/staff/board/world with required actions and deep links.
- **Main actions:** Filter (Alla, Olästa, Åtgärd krävs, Kontrakt, Transfers, Analys, Scouting, Tränarstab, Arkiverat); Select message; Markera som läst; Arkivera / Återställ; Destination buttons ('Nästa steg')
- **Current visual structure:** PageHeading + masthead strip (date, unread count, action-required count); two-pane layout: left feed (9 filter buttons, count, scrollable list of message buttons with category · date, unread dot, subject, preview, 'ÅTGÄRD KRÄVS →'), right article (kicker, H2, byline, optional compact MatchHero / PlayerCell, paragraphs, next-step buttons, tools footer).
- **Navigation relationships:** (destinations) /career/squad/[playerId], /career/match-report/[id], /career/match-day/[id], CLB-05, /career/contracts, /career/scouting
- **Desktop:** Two-pane (360–420px list + article).
- **Mobile:** ≤900px single column — list above article; selecting a message does not scroll to it (no code found).

**Strengths**
- Classic mail two-pane works; deep link ?message=
- Action-required messages can't be archived until resolved
- Contextual MatchHero/PlayerCell inside article
- Reader state remembered across navigation (WorkspaceMemory)

**Weaknesses**
- Nine flat filter buttons
- All messages look alike — no sender portraits/logos, category only as small text
- Overlaps Media news feed and dashboard news

**Redesign opportunities**
- Unify with Media as one 'Nyheter & besked' stream with priority lanes
- Sender identity (assistant, board chair, physio) with faces
- Phone: list → full-screen reader

### WLD-01a · Inbox filters

- **Route:** `/career/inbox` · **Kind:** panel · **Importance:** frequent · **Parent:** WLD-01
- **Components:** `lib/career/inboxFilters.ts`
- **Purpose:** Narrow message list.
- **Main actions:** Select filter
- **Current visual structure:** Row of 9 hm-btn-sm aria-pressed buttons.
- **Navigation relationships:** —
- **Desktop:** Wrap row
- **Mobile:** Wrap

**Strengths**
- Includes Åtgärd krävs

**Weaknesses**
- No counts per filter

**Redesign opportunities**
- Segmented: Att göra / Allt / Arkiv + category chips

### WLD-01b · Message reader + empty states

- **Route:** `/career/inbox?message=` · **Kind:** panel · **Importance:** core · **Parent:** WLD-01
- **Components:** `app/career/inbox/page.tsx`
- **Purpose:** Read a message and act.
- **Main actions:** Destination buttons; Mark read; Archive/unarchive
- **Current visual structure:** Article with data-category; empty: 'Välj ett meddelande…' / 'Inga meddelanden i denna vy.'
- **Navigation relationships:** —
- **Desktop:** Right pane
- **Mobile:** Below list

**Strengths**
- Next-step buttons

**Weaknesses**
- Long body paragraphs at 13px

**Redesign opportunities**
- Email-as-scene: assistant briefings with visuals

### WLD-02 · Mediecentret (Media)

- **Route:** `/career/media` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/media/page.tsx`, `components/media/MediaParts.tsx (StoryCard, OutletChip, FictionNote, PRESSROOM_BACKDROP)`, `components/media/media.css`, `components/experience/Moment.tsx (MomentHero)`, `lib/media/*`
- **Purpose:** News world: stories from fictional outlets, press conferences, coach rivalries, discipline cases, outlet relations.
- **Main actions:** Switch tab (?tab=feed|press|rivals|discipline|outlets); Filter scope (Alla, Din klubb, Lokalt, Regionalt, Nationellt, Handbollsmedia); Search stories; Open story; Open press conference
- **Current visual structure:** Press-room photo MomentHero (top story as headline, or neutral 'Handbollsvärlden'); role=tablist of 5 tabs (press tab shows open count); feed = lead StoryCard (lg) + list of md/sm cards; press = list of conferences with status; rivals = coach relations + club rivalries; discipline = case list; outlets = outlet relation rows.
- **Navigation relationships:** WLD-03, WLD-04, CLB-04
- **Desktop:** Hero + tabs + 2-col feed grid.
- **Mobile:** ≤1000px feed single column, outlet rows reflow.

**Strengths**
- Editorial hierarchy (lead story, sizes by importance)
- Fictional outlets/journalists give world texture
- Top story promoted into hero

**Weaknesses**
- Story cards are typographic only — no photos even though match/arena images exist
- Rivals/discipline/outlets are thin lists
- News split between Media, Inbox and Dashboard

**Redesign opportunities**
- Newspaper/social-feed look with imagery and headlines from your matches
- Press conference as a featured interactive card on the dashboard

### WLD-02a · Tab · Nyheter (feed)

- **Route:** `/career/media` · **Kind:** tab · **Importance:** frequent · **Parent:** WLD-02
- **Components:** `components/media/MediaParts.tsx (StoryCard)`
- **Purpose:** Story feed.
- **Main actions:** Scope filter; Search; Open story
- **Current visual structure:** Radiogroup scope chips + search, lead card + list; empty copy.
- **Navigation relationships:** WLD-04
- **Desktop:** 2-col
- **Mobile:** 1-col

**Strengths**
- Search

**Weaknesses**
- No images

**Redesign opportunities**
- Image-led cards

### WLD-02b · Tab · Presskonferenser

- **Route:** `/career/media?tab=press` · **Kind:** tab · **Importance:** frequent · **Parent:** WLD-02
- **Components:** `app/career/media/page.tsx`
- **Purpose:** Open and past press conferences.
- **Main actions:** Open conference
- **Current visual structure:** List of links with title, date · status. Open count in tab label.
- **Navigation relationships:** WLD-03
- **Desktop:** List
- **Mobile:** List

**Strengths**
- Continue button routes here when one is pending

**Weaknesses**
- Plain list

**Redesign opportunities**
- Countdown + journalist faces

### WLD-02c · Tab · Rivaler

- **Route:** `/career/media?tab=rivals` · **Kind:** tab · **Importance:** occasional · **Parent:** WLD-02
- **Components:** `app/career/media/page.tsx (Rivals)`
- **Purpose:** Coach relations and club rivalries; open feud hero.
- **Main actions:** Open club
- **Current visual structure:** Optional compact MomentHero 'Öppen fejd' + two panels of lists.
- **Navigation relationships:** CLB-04
- **Desktop:** 2 panels
- **Mobile:** Stack

**Strengths**
- Feud framing

**Weaknesses**
- Relations as list values

**Redesign opportunities**
- Rivalry heat map

### WLD-02d · Tab · Disciplin

- **Route:** `/career/media?tab=discipline` · **Kind:** tab · **Importance:** rare · **Parent:** WLD-02
- **Components:** `app/career/media/page.tsx`
- **Purpose:** Disciplinary cases.
- **Main actions:** —
- **Current visual structure:** List of cases; 'Inga ärenden.'
- **Navigation relationships:** —
- **Desktop:** List
- **Mobile:** List

**Strengths**
- —

**Weaknesses**
- Thin; odd home under Media

**Redesign opportunities**
- Move to squad/player status

### WLD-02e · Tab · Medierna (outlets)

- **Route:** `/career/media?tab=outlets` · **Kind:** tab · **Importance:** rare · **Parent:** WLD-02
- **Components:** `app/career/media/page.tsx (OutletRow)`
- **Purpose:** Relationship with each outlet and story counts.
- **Main actions:** —
- **Current visual structure:** Rows: OutletChip, relation value, count.
- **Navigation relationships:** —
- **Desktop:** Rows
- **Mobile:** Reflow

**Strengths**
- —

**Weaknesses**
- Numbers without meaning

**Redesign opportunities**
- Media favour meter

### WLD-03 · Presskonferens

- **Route:** `/career/media/press/[pressId]` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/media/press/[pressId]/page.tsx`, `components/media/MediaParts.tsx (OutletChip, PRESSROOM_BACKDROP)`, `lib/media/actions.ts`, `lib/media/press.ts`
- **Purpose:** Answer journalists' questions by tone, delegate to assistant, or skip; see consequences.
- **Main actions:** Choose answer tone per question; Lämna svaren; Låt <assistant> svara (Delegera); Avböj / Hoppa över; ← Presskonferenser
- **Current visual structure:** Compact press-room MomentHero (pre/post match, date, stamp when closed); consequences panel when closed; ordered list of questions: outlet chip, journalist name, style badge, question, radio answers (tone label, quote, hint).
- **Navigation relationships:** WLD-02b, WLD-04
- **Desktop:** Single column
- **Mobile:** Same; answers as stacked labels

**Strengths**
- Real interactive dialogue mechanic with tone hints, delegation option
- Consequences listed with reasons

**Weaknesses**
- All questions on one long form; no sense of a live room/turn-taking
- Inline style on badge
- Not-found state is a bare EmptyState

**Redesign opportunities**
- One question at a time, journalist portrait, reaction feedback — a signature scene

### WLD-04 · Artikel (story)

- **Route:** `/career/media/story/[storyId]` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/media/story/[storyId]/page.tsx`, `components/media/MediaParts.tsx`, `lib/media/newsEngine.ts`
- **Purpose:** Read one story and how other outlets covered the same event.
- **Main actions:** ← Mediecentret; Destination buttons; Open other coverage
- **Current visual structure:** Article: outlet chip, scope, H1 headline, standfirst, byline, body, quote blockquote, destination buttons, fiction note; 'Så skrev andra' list of StoryCards.
- **Navigation relationships:** WLD-02, (destinations)
- **Desktop:** Article column
- **Mobile:** Same

**Strengths**
- Newspaper typography hierarchy
- Cross-coverage comparison is a nice idea

**Weaknesses**
- No image; outlets visually indistinct

**Redesign opportunities**
- Outlet-specific mastheads/styles (tabloid vs local)

### WLD-05 · Kalender

- **Route:** `/career/calendar` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/calendar/page.tsx`, `components/manager/CalendarMilestones.tsx`, `components/manager/Workspace.tsx (PageHeading, Panel, FixtureTable)`, `components/game/Identity.tsx`, `lib/training/trainingSchedule.ts`, `components/game/squad-season.css`
- **Purpose:** Four-week view of training day types, sessions, matches, contract expiries, scouting completions and milestones.
- **Main actions:** ← Fyra veckor / → (navigate 4-week blocks); Hantera träning (per week); Open fixture / match report; Open player; Open scouting
- **Current visual structure:** PageHeading with prev/next; context strip with period + counts; 4 stacked week Panels, each a 7-column grid of day cells (min-height 200px: weekday, big date, day-type badge, 'Idag', sessions text, match link, deadlines, scouting, milestones) followed by a FixtureTable for that week.
- **Navigation relationships:** /career/training?week=, /career/fixtures/[id], /career/match-report/[id], /career/squad/[playerId], /career/scouting
- **Desktop:** 7 columns of min 145px.
- **Mobile:** 7×145px = ~1015px grid → horizontal scroll on phones.

**Strengths**
- Day cells with matchday/recovery/today states make rhythm visible

**Weaknesses**
- Each week repeats a fixture table under the grid (duplicate info)
- 4 × 7 × 200px tall cells = very long page; no month overview
- Overlaps Schema (WLD-06) and the dashboard weekly plan

**Redesign opportunities**
- Merge Calendar + Schedule into one 'Säsong' timeline (month / week / list views)
- Agenda list on mobile

### WLD-06 · Schema (Matcher & resultat)

- **Route:** `/career/schedule` · **Kind:** page · **Importance:** frequent
- **Components:** `app/career/schedule/page.tsx`, `components/season/PreseasonPlanner.tsx`, `components/game/Secondary.tsx (SectionScene)`, `components/manager/Workspace.tsx (Panel)`, `components/ClubCrest.tsx`
- **Purpose:** Own fixture list and results; preseason planning (friendlies, camps, tournaments).
- **Main actions:** Plan friendly/camp/tournament; Filter Hela säsongen / Kommande / Resultat; Click row → match report or preview; Förhandsvisa / Matchrapport; Open opponent
- **Current visual structure:** SectionScene header; PreseasonPlanner form section at top; hm-tabs filter; 8-column table (Omg, Datum, Typ badge, H/B, Motstånd, Status badge, Resultat, link); right rail: Nästa match panel (crest 58px) + note.
- **Navigation relationships:** /career/match-preview, /career/match-report/[id], /career/fixtures/[id], CLB-04, WLD-05
- **Desktop:** Main + rail.
- **Mobile:** Table in hm-scroll-x; rail below.

**Strengths**
- Clickable rows with correct guard (only next/played)
- Type and outcome badges

**Weaknesses**
- Preseason planner (a form with 3 sub-tabs) sits above the fixture list year-round
- 8-column table, no crests in rows
- Nav label 'Schema' vs page title 'Matcher & resultat'

**Redesign opportunities**
- Fixture cards with crests, venue photo, result colour
- Move preseason planner into a preseason-only moment

### WLD-06a · Preseason planner (tabs Träningsmatch / Läger-resa / Turnering)

- **Route:** `/career/schedule` · **Kind:** tab · **Importance:** occasional · **Parent:** WLD-06
- **Components:** `components/season/PreseasonPlanner.tsx`
- **Purpose:** Book friendlies, camps, tournaments; costs drawn from cash.
- **Main actions:** Switch sub-tab; Pick date/opponent/venue/location; Book
- **Current visual structure:** hm-plan-section with intro (incl. cash), anchor-based subnav (role=tab <a href>), form grid of labelled inputs/selects, cost line, booked events list.
- **Navigation relationships:** —
- **Desktop:** Form grid
- **Mobile:** Wraps

**Strengths**
- Clash validation, cost transparency

**Weaknesses**
- Tab semantics on <a href='#'> links
- Form-first UI

**Redesign opportunities**
- Preseason calendar board with drag-to-book

### WLD-06b · Schedule filter tabs

- **Route:** `/career/schedule` · **Kind:** tab · **Importance:** frequent · **Parent:** WLD-06
- **Components:** `app/career/schedule/page.tsx`
- **Purpose:** Filter fixtures.
- **Main actions:** Hela säsongen; Kommande; Resultat
- **Current visual structure:** hm-tabs aria-pressed buttons; empty row 'Inga matcher i den här vyn.'
- **Navigation relationships:** —
- **Desktop:** Tabs
- **Mobile:** Scroll-x

**Strengths**
- —

**Weaknesses**
- Not URL-persisted

**Redesign opportunities**
- —

## MED — Medical

### MED-01 · Medicinskt & Rehabilitering

- **Route:** `/career/medical` · **Kind:** page · **Importance:** occasional
- **Components:** `app/career/medical/page.tsx`, `components/clubhq/EnvironmentBanner.tsx`, `components/game/Secondary.tsx (StaffMark)`, `components/manager/Workspace.tsx (Panel)`, `lib/medical/*`
- **Purpose:** Active injuries with rehab phase/progress and return dates, recent recoveries, responsible physio, availability for next selection.
- **Main actions:** Belastning & återhämtning →; Truppens status →; Open player; Open physio; Open next opponent
- **Current visual structure:** EnvironmentBanner (medical-room photo, badge, 3 metrics: active injuries, available x/y, rehab quality 1.00x); main: 7-column injuries table (Spelare, Skada, Allvarlighetsgrad, Status, Rehabfas, Rehabframsteg, Beräknad återkomst) or empty scene, 'Senaste återgångar' list; rail: physio panel with initials mark, next-selection note.
- **Navigation relationships:** /career/training, /career/squad, /career/squad/[playerId], /career/staff/[staffId], CLB-04
- **Desktop:** Banner + main/rail split.
- **Mobile:** Banner stacks (≤900px), split collapses; table scroll-x.

**Strengths**
- Photo banner + metric tiles give a department feel
- Clear empty state when no injuries

**Weaknesses**
- Core info is a 7-column table
- Rehab quality shown as raw multiplier '1.00x'
- No body map / timeline to return

**Redesign opportunities**
- Injury cards with body-zone silhouette and return-date timeline
- Integrate availability into squad/tactics instead of a separate nav item

### MED-01a · Active injuries table / empty scene

- **Route:** `/career/medical` · **Kind:** panel · **Importance:** occasional · **Parent:** MED-01
- **Components:** `app/career/medical/page.tsx`, `components/game/Secondary.tsx (SceneEmpty)`
- **Purpose:** Track rehab.
- **Main actions:** Open player
- **Current visual structure:** Panel with hm-scroll-x table; else SceneEmpty.
- **Navigation relationships:** —
- **Desktop:** Table
- **Mobile:** Scroll-x

**Strengths**
- Progress column

**Weaknesses**
- Severity as text

**Redesign opportunities**
- Progress bars + phase stepper

## SYS — Settings & internal tools

### SYS-01 · Inställningar (in-career settings)

- **Route:** `/career/settings` · **Kind:** page · **Importance:** rare
- **Components:** `app/career/settings/page.tsx`, `components/experience/ChoiceGroup.tsx`, `components/experience/CourtBackdrop.tsx`, `components/settings/SettingsSection.tsx`, `components/settings/settings.css`
- **Purpose:** Display currency (EUR/SEK) with live preview using the club's own figures.
- **Main actions:** Choose currency
- **Current visual structure:** Ink band with court backdrop, H1, two Stats; SettingsSection with ChoiceGroup (two option cards with sample amount); rail with preview dl (transfer budget, wage budget, top wage, cash) and 'Bra att veta' list.
- **Navigation relationships:** MGR-04 (from moments page)
- **Desktop:** Band + section/rail.
- **Mobile:** settings.css stacks.

**Strengths**
- Excellent preview using real numbers
- Persist/session fallback feedback

**Weaknesses**
- Only one setting — match speed (available on /settings) missing here
- Visually heavier than its content warrants
- Diverges from ENT-05 implementation

**Redesign opportunities**
- Single settings component used everywhere; add density/text-size/motion

### SYS-02 · Editor home (dev data editor)

- **Route:** `/editor` · **Kind:** page · **Importance:** internal
- **Components:** `app/editor/layout.tsx`, `app/editor/EditorModeGate.tsx`, `app/editor/page.tsx`, `app/EditorModeWidget.tsx`
- **Purpose:** INTERNAL. Real-database editor entry (nations/competitions/clubs/players counts) gated by HM_EDITOR_ENABLED server flag (404 otherwise).
- **Main actions:** ÖPPNA SPELARE; ÖPPNA BETYGSGRANSKNING
- **Current visual structure:** Single hm-panel with UTVECKLING badge, 4 stats, two buttons (max-width 720 inline style).
- **Navigation relationships:** SYS-02a, SYS-02c
- **Desktop:** Centred panel
- **Mobile:** n/a

**Strengths**
- Server-side gate via notFound()

**Weaknesses**
- Internal styling

**Redesign opportunities**
- Keep internal

### SYS-02a · Editor · players (bulk calibration table)

- **Route:** `/editor/players` · **Kind:** page · **Importance:** internal · **Parent:** SYS-02
- **Components:** `app/editor/players/page.tsx`
- **Purpose:** INTERNAL. Spreadsheet-like inline editing of every HBL + Allsvenskan player (714 lines).
- **Main actions:** Inline edit; Open player
- **Current visual structure:** Self-described 'compact, spreadsheet-like table'.
- **Navigation relationships:** SYS-02b
- **Desktop:** Table
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- —

**Redesign opportunities**
- —

### SYS-02b · Editor · player detail

- **Route:** `/editor/players/[playerId]` · **Kind:** page · **Importance:** internal · **Parent:** SYS-02
- **Components:** `app/editor/players/[playerId]/page.tsx`
- **Purpose:** INTERNAL. Real data, squad and game-data panels per player.
- **Main actions:** Edit fields; Save
- **Current visual structure:** hm-panels 'VERKLIG DATA', 'TRUPP', 'SPEL-DATA'.
- **Navigation relationships:** —
- **Desktop:** Panels
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- —

**Redesign opportunities**
- —

### SYS-02c · Editor · rating review roster

- **Route:** `/editor/ratings` · **Kind:** page · **Importance:** internal · **Parent:** SYS-02
- **Components:** `app/editor/ratings/page.tsx`
- **Purpose:** INTERNAL. Club selector → roster with rating proposals/review status.
- **Main actions:** Pick club; Open player
- **Current visual structure:** Mirrors players editor layout.
- **Navigation relationships:** SYS-02d
- **Desktop:** Table
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- —

**Redesign opportunities**
- —

### SYS-02d · Editor · rating detail

- **Route:** `/editor/ratings/[playerId]` · **Kind:** page · **Importance:** internal · **Parent:** SYS-02
- **Components:** `app/editor/ratings/[playerId]/page.tsx`
- **Purpose:** INTERNAL. Source proposal, CA estimate, generated attributes, overrides, LOCK.
- **Main actions:** Set status/note; Override CA/PA/attributes; LOCK
- **Current visual structure:** Long detail page (625 lines).
- **Navigation relationships:** —
- **Desktop:** Panels
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- —

**Redesign opportunities**
- —

### SYS-02e · Editor · court grid calibration

- **Route:** `/editor/court-grid` · **Kind:** page · **Importance:** internal · **Parent:** SYS-02
- **Components:** `app/editor/court-grid/page.tsx`
- **Purpose:** INTERNAL. Calibrate canonical 40×20 m court grid.
- **Main actions:** Select calibration mode
- **Current visual structure:** Court canvas + controls.
- **Navigation relationships:** —
- **Desktop:** Canvas
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- —

**Redesign opportunities**
- —

### SYS-03 · Scenario lab (engine labs)

- **Route:** `/scenario-lab` · **Kind:** page · **Importance:** internal
- **Components:** `app/scenario-lab/page.tsx`, `app/scenario-lab/core/page.tsx`, `app/scenario-lab/match/page.tsx`, `app/scenario-lab/scenario-lab.css`
- **Purpose:** INTERNAL. Engine V2 labs: centre throw-off (/scenario-lab), possession & transition (/core), full-match timeline QA (/match).
- **Main actions:** Run scenarios; Step snapshots
- **Current visual structure:** Dark lab headers ('HANDBALL ENGINE V2 · MILESTONE 1'), canvases/timelines.
- **Navigation relationships:** SYS-03a, SYS-03b
- **Desktop:** Lab layout
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- No server/env gate found in source — publicly reachable in any build (unverified at deploy level)
- Wrapped by AlphaAccessGate + feedback button like the game

**Redesign opportunities**
- Gate like /editor

### SYS-03a · Scenario lab · core

- **Route:** `/scenario-lab/core` · **Kind:** page · **Importance:** internal · **Parent:** SYS-03
- **Components:** `app/scenario-lab/core/page.tsx`
- **Purpose:** INTERNAL. Possession & transition lab.
- **Main actions:** Run
- **Current visual structure:** Lab page.
- **Navigation relationships:** —
- **Desktop:** 
- **Mobile:** 

**Strengths**
- —

**Weaknesses**
- —

**Redesign opportunities**
- —

### SYS-03b · Scenario lab · match

- **Route:** `/scenario-lab/match` · **Kind:** page · **Importance:** internal · **Parent:** SYS-03
- **Components:** `app/scenario-lab/match/page.tsx`
- **Purpose:** INTERNAL. Full-match human QA timeline.
- **Main actions:** Run; Scrub
- **Current visual structure:** Lab page with timeline.
- **Navigation relationships:** —
- **Desktop:** 
- **Mobile:** 

**Strengths**
- —

**Weaknesses**
- —

**Redesign opportunities**
- —

### SYS-04 · Match 2D QA harness

- **Route:** `/match-qa` · **Kind:** page · **Importance:** internal
- **Components:** `app/match-qa/page.tsx`, `@handball-manager/match-renderer MasterCourt`
- **Purpose:** INTERNAL. Human QA gate: play dev scenarios through the real engine with toggles (fatigue, 7-vs-6, presets, speed).
- **Main actions:** Play/pause; Reset; Speed; Toggle fatigue/sevenOut; Run preset
- **Current visual structure:** Court renderer + control rows of hm-btn toggles (inline styles).
- **Navigation relationships:** —
- **Desktop:** Court + controls
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- Outside /career deliberately; no gate found in source

**Redesign opportunities**
- Gate

### SYS-05 · CPU-rekrytering (debug)

- **Route:** `/career/club/cpu-recruitment` · **Kind:** page · **Importance:** internal
- **Components:** `app/career/club/cpu-recruitment/page.tsx`, `lib/career/cpuRecruitment.ts`
- **Purpose:** INTERNAL. Debug view of AI clubs' positional needs, pursuits and decision log.
- **Main actions:** ← Klubb
- **Current visual structure:** Three hm-panels with tables (Positionsbehov, Aktiva/senaste pursuits, Beslutslogg).
- **Navigation relationships:** CLB-02
- **Desktop:** Tables
- **Mobile:** n/a

**Strengths**
- —

**Weaknesses**
- Lives under the player-facing /career/club route without any gate; not linked anywhere (URL-only)

**Redesign opportunities**
- Move under /editor gate

### SYS-06 · Editor mode widget (global)

- **Route:** `* (root layout)` · **Kind:** panel · **Importance:** internal
- **Components:** `app/EditorModeWidget.tsx`, `lib/editor/editorToggle.ts`
- **Purpose:** INTERNAL. Floating toggle + link to /editor, rendered only when /api/editor/status reports enabled.
- **Main actions:** Toggle editor mode; Open editor
- **Current visual structure:** Small floating control; also adds an 'Editor' item to the sidebar when enabled.
- **Navigation relationships:** SYS-02
- **Desktop:** Floating
- **Mobile:** Floating

**Strengths**
- Absent in production builds

**Weaknesses**
- —

**Redesign opportunities**
- —

