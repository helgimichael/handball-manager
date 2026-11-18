# M1–M9 integration och spelbar QA-build

- **Branch:** `integration/m1-m9-playable-qa`, baserad på `origin/main` `58c55efe` (Arena Nights 2027 och Club Identity, Alpha-release).
- **Worktree:** `C:\DEV\WORKTREES\handball-manager\m1-m9-playable-qa`
- **Källa för M1–M9:** `origin/work/transfer-realism-pcdm` `880738c5`.
- **Varken `main` eller M1–M9-grenen har ändrats.** Ingen merge till `main` och ingen deployment.
- **QA-server:** **http://localhost:3109**, ett produktionsbygge av denna gren (se §9).
- **HEAD:** se §11.

## 1. Sammanfattning

| Del | Status |
|---|---|
| M1–M7: PCDM och alla flöden för spelarbeslut | **Integrerat**, anpassat till `main`s nyare system (intentioner, säsongsmedvetna medlemskap, säljande klubbs begärda pris, listningar, köpar-id) |
| M8: internationellt ekosystem, köp, åldrande och lönereferens | **Integrerat**, med världspoolen säsongsmedveten enligt Club Identity C3 |
| M9: säsongsövergång | **Täcks redan av `main`**, i bredare form (`gameContinuity`: fyra spelade serier plus Division 2). M9:s kod porteras **inte**, eftersom den skulle ge två system för säsongsövergångar. M9:s krav är i stället verifierade på `main`s väg med ett verkligt tvåsäsongstest. |
| Nyare funktioner på `main` | Behållna. Inga tester borttagna eller försvagade. |
| Tester | Hela sviten: 3 290 tester, 3 279 pass, 11 fel, samtliga befintliga på `main` (som har 13). Inga nya fel. Tvåsäsongstestet passerar. |
| Produktionsbygge | Lyckas |
| QA-server | Kör: ny karriär, match spelad i UI:t, PCDM synlig i förhandlingen |

## 2. Alla M1–M9-funktioner och deras status

| Milstolpe | Funktion | Status i integrationen |
|---|---|---|
| M1 | Klubb- och ligastyrka på CA-skala, priors, prestige, utjämning (`sportingStrength.ts`) | Integrerad. Ligatillhörigheten läses via `main`s säsongsmedvetna `clubCompetitionId`. |
| M2 | PCDM-kärna: profiler, komponenter, mjukt golv, reservationsnytta, lönekrav (`model.ts`, `stateAdapter.ts`) | Integrerad oförändrad |
| M3 | Bud, intresse, lönekrav, motbud, rivaler, lån, köparsökning, förtida kontrakt, förlängning genom PCDM | Integrerad: köparsökningen använder `main`s `careerWorldCatalogClubs` och `buyerClubId` med PCDM-villkor, och förlängningen behåller `main`s spelarintentioner (`intentionMinimumWage`, `renewalBlocker`) |
| M4 | Världspoolens förnyelser, värvning av fria agenter, säsongsrullning (`internationalMarket.ts`) | Integrerad |
| M5 | CPU-förlängning frågar spelaren; CPU-värvning med PCDM och lönetak | Integrerad: intentionslönen är golvet för PCDM-kravet; `main`s spärr för intention och budget ligger kvar |
| M6 | Krispremie i nödläge; kalibrering | Integrerad, med `main`s `emit`-parameter |
| M6/M7 | Lat kandidatrankning; prestanda | Integrerad: fas 1 innehåller `main`s bonus för listade spelare; fas 2 använder `main`s övergångssumma (max av marknadsvärde och begärt pris) och utbildningsersättning |
| M8A | Internationellt ungdomsintag; utveckling, åldrande och pension även i världspoolen | Integrerad: världspool och intag är säsongsmedvetna (C3) |
| M8B | Internationella köp av kontrakterade spelare; samma köparregel för managern | Integrerad |
| M8C | Lönereferens för underbetalda spelare; ett internationellt köp per klubb och säsong | Integrerad |
| M8D | Positionskänsligt åldrande per attributfamilj; pension med speltidsfaktor; åldersanpassad kontraktslängd | Integrerad |
| M8E | Diagnos- och simuleringsskript | Integrerade (endast observation) |
| M9A–D | Regelpaket för managerläget, adapter för säsongsunderlag, stängd gräns mot Division 1, knappkoppling | **Inte porterade.** `main`s `gameContinuityRules` och `prepareGameContinuity` gör samma sak och mer: Division 1 spelas på riktigt, Division 2 finns som pooler, kval, lottad hemmaordning, geografisk gruppindelning, A-lagsprioritet och samarbetsregler. M9:s stängda gräns mot Division 1 skulle ha tagit bort funktionalitet som finns på `main`. |
| M9E | Historikkomprimering vid övergången | **Finns redan på `main`** (`seasonTransition.ts:155`), testad i `m10SaveIntegrity` |
| M9F | Kompatibilitet med äldre sparfiler | Täcks av `main`s tester (`seasonRollover`: kvitto, JSON-migrering, äldre sparfiler) |
| M9G | Verkligt tvåsäsongstest | **Porterat och anpassat** till `main`s väg: `m1m9CareerIntegration.integration.test.ts` (§6) |
| M9 release-QA | Managerns klubb upp eller ned, lån och registreringar, gammalt tillstånd, återställning och nya försök | Täcks av `main`s `seasonRollover`-tester ("manager and AI", "human relegation", atomicitet, nya försök, sparfiler), `gameContinuity`-testerna (fyra nivåer, tre säsonger, lån och dubbla ägarskap) och det porterade tvåsäsongstestet |
| Rapporter | M7- och M8-rapporterna | Medtagna (`docs/audits`). M9-rapporterna beskriver den ersatta grenens kod och finns kvar på `origin/work/transfer-realism-pcdm`. |

## 3. Arkitekturbeslut

1. **`main` styr arkitekturen.** Säsongsövergången är `main`s: `attemptSeasonTransition` med `gameContinuity` som standard. Ingen andra pipeline finns.
2. **PCDM är den enda motorn för spelarbeslut.** `main`s egna regler för klubbsidan behålls: intentioner, budgetkontroll, begärt pris, utbildningsersättning, listningar och omprövning av köparens ekonomi vid slutförd affär. PCDM ersätter bara spelarens egen heuristik, som den gamla tier-jämförelsen i `playerStance`.
3. **Säsongsmedvetenhet (Club Identity C3).** All M1–M8-kod läser klubbens serie via `competitionMembership`: `clubCompetitionId` och `careerClubsInCompetition`. Världspoolen (`worldPoolCareerClubIds`) följer också det faktiska medlemskapet.
4. **Division 2 och nyare CPU-flöden** omfattas automatiskt av M8:s köppass och livscykel genom `main`s `careerWorldClubIds`, som numera inkluderar Division 2-klubbar med trupp.

## 4. Lösta konflikter

| Fil | `main` | M1–M9 | Lösning |
|---|---|---|---|
| `career/types.ts` | `clubWorldBaseline` | `transferMarket` | Båda behålls |
| `players/market.ts` | Säsongsmedveten katalog, `buyerClubId`, slumpmässiga utländska klubbar via C3 | PCDM-köpare, verkliga världspoolsklubbar, köparregel och kapacitet | `main`s katalog, `buyerClubId` och säsongsmedvetna landsnamn, plus PCDM-villkor och världspoolsklubbar som vill ha spelaren |
| `players/renewals.ts` | Intentionsgolv och `renewalBlocker` | `refusesClub` | Båda: intentionsspärren går först, sedan spelarens PCDM-vägran |
| `career/cpuContractDecisions.ts` | Intentionsmultiplikator, budgetspärr | Spelarsidans PCDM-förlängning | Intentionslönen blir golvet för PCDM-kravet och taket; `main`s budgetspärr ligger kvar. En dubbel import och en dubbel variabel från den automatiska sammanfogningen är rättade. |
| `career/cpuCandidateEvaluation.ts` | Begärt pris, utbildningsersättning, bonus för listade spelare | Lat tvåfas-PCDM | Bonusen ligger i fas 1 (oberoende av lön); summa och utbildningsersättning i fas 2 |
| `career/cpuRecruitment.ts` | `emit`-parameter | `emergency`-parameter | Båda |
| `career/careerWorld.ts` | `careerClubsInCompetition` | `worldPoolCareerClubIds` (statisk) | Säsongsmedveten via `careerClubsInCompetition` |
| `internationalYouthIntake.ts` | Grind mot statiska serieläsningar | `getClub().competitionId` | `clubCompetitionId` (rättelse som integrationen krävde) |
| `scripts/game-test-files.json` | +87 tester | +6 tester | Union |
| `players/marketHotfix.test.ts` | Finansierad köpare | Lön enligt PCDM | Båda |

## 5. Ändrade filer (jämfört med `main`)

61 filer, +5 510 / −824. Av dem:
- **Nya:** `transfers/careerDecision/{model,sportingStrength,stateAdapter}.ts` med tester, `transfers/internationalMarket.ts`, `career/internationalYouthIntake.ts`, `career/internationalYouthNames.ts`, testerna för M8 och integrationen, samt simulerings- och diagnosskripten.
- **Ändrade:** `players/market.ts`, `players/renewals.ts`, `transfers/{playerDecision,playerInterest,negotiation,negotiationIntegration,transferIntegration,affordability}.ts`, `career/{cpuCandidateEvaluation,cpuContractDecisions,cpuRecruitment,dailyTick,playerLifecycle,worldDevelopment,youthIntake,careerWorld,types}.ts`, tester och manifest, `package.json` (`test:m1-m9:integration`) och rapporterna under `docs/audits`.

## 6. Testresultat

| Körning | Tester | Pass | Fail |
|---|---|---|---|
| `main` `58c55efe` (egen baslinje-worktree) | 3 250 | 3 237 | 13 |
| Integration före rättelserna | 3 290 | 3 277 | 13 |
| **Integration, slutlig HEAD `c8ea84bb`** | **3 290** | **3 279** | **11** |

- **Kända fel på `main`** finns även här. De omfattar bland annat Continue Controller-reproduktionen, `intentions.test` (2 tester, krasch i uppsättningen: `clubFinances[club]` saknas) och data- och harness-testerna.
- **Lösta av integrationen:**
  - "Allsvenskan club cannot negotiate with top Handbollsligan stars (IMPOSSIBLE gate)", löst av PCDM.
  - "an overfull weak squad starts no upgrade at all".
- **Fel som integrationen orsakade, nu rättade:**
  1. `clubWorldMembership`: grinden mot statiska serieläsningar fångade `internationalYouthIntake.ts`. Läsningen går nu via medlemskapsfunktionen.
  2. `playtest05Improvement` Pillar 1: på `main` passerade testet utan att pröva något, eftersom spelaren tackade nej enligt den gamla heuristiken. Med PCDM tackar han ja, och `main`s egen kontroll av köparens ekonomi stoppar då den underfinansierade köparen. Fixturen finansierar nu köparen enligt `main`s `marketHotfix`-mönster. Inga assertioner är ändrade.
- **Riktade M1–M8-tester** (careerDecision, transfers, players, cpu, livscykel, ungdom, utveckling): 490 tester, varav 488 passerar. De 2 felen är `main`s kända `intentions`-fel.
- **Tvåsäsongstestet** (`npm run test:m1-m9:integration`, 19–27 minuter) **passerar:**
  - Spelad säsong 1 för IFK Skövde med världspoolen laddad.
  - Övergången på `main`s väg är APPLIED. Aranäs går upp, Hallby ned, och flyttar sker i hela pyramiden: 11 upp och 11 ned över alla nivåer.
  - 182 + 182 nya matcher, arkivet växer med 1, kontrakten är intakta och nivåfaktorerna stämmer.
  - Säsong 2 spelas klart, och alla HBL- och Allsvenskan-klubbar har matchdagsintäkter.
  - Övergången till 2028/29 är också APPLIED.
  - M8 är aktivt i karriären: 20 internationella händelser, och världspoolen växer från 100 till 105 spelare efter säsong 1.
- **Typkontroll:** 0 fel. Projektet kräver genererad `next-env.d.ts` och genererat världspaket, som skapas av `pre*`-skripten och `next build`.
- **Lint på ändrade filer:** 0 nya fynd. De 3 felen och 5 varningarna som finns ligger identiskt på `main`: `playtest05` `any`, `careerWorld` `CLUBS`, `market.ts` `_done/_m/_l` och `playerDynamics.test`.
- **Produktionsbygge:** lyckas, 54 sidor, inklusive en omstart av bygget efter rättelserna.

### 6.1 Slutlig körning (HEAD `c8ea84bb`)

- Hela sviten: 3 290 tester, 3 279 pass, **11 fel**. Alla 11 felar även på `main` `58c55efe` (jämförelse per testnamn). **Inga fel finns bara i integrationen.** Två fel finns bara på `main` och är lösta här (IMPOSSIBLE gate, overfull weak squad).
- Tvåsäsongstestet: **pass** på 19 min 15 s. Aranäs upp, Hallby ned, 11 + 11 flyttar i hela pyramiden, 20 internationella händelser, världspoolen växer 100 → 105, och säsong 3 är 2028/29.
- Loggar: `C:\DEV\QA\logs\m1-m9-integrationull-integration-final.log`, `two-season-final.log` och `full-main-baseline.fails.txt`.

## 7. Kända begränsningar

1. **Långtidskalibrering** (M8-rapporten §9.4 och §14): världens elitnivå sjunker efter cirka 15 säsonger. Ungdomens potential och åldrandet behöver kalibreras mot varandra. Det är inte omprövat på `main`s pyramid, eftersom långa simuleringar låg utanför uppdraget.
2. **Världspoolens klubbar har ingen ekonomi.** Kapaciteten härleds ur nivå.
3. **M9:s egen kod finns inte i integrationen.** `main`s kontinuitetspolicy gäller, med serieavspark 1 september enligt `main`s regel, inte M9:s härledda vecka och veckodag.
4. **Säsongsövergången från QA-servern är inte genomspelad i UI:t** inom ramen för detta uppdrag. Det täcks av det automatiska tvåsäsongstestet med samma funktioner som knappen anropar.

## 8. Ägarbeslut och rekommendationer

- Granska PCDM-beteendet i `main`s nya funktioner för intentioner och samtal: intentionsgolvet och PCDM samverkar som beskrivet i §4.
- `main`s två kända `intentions.test`-fel (klubbekonomin saknas i testets fixtur) bör åtgärdas på `main`.

## 9. QA-server

- **URL:** **http://localhost:3109**
- **Start:** startkonfigurationen `handball-m1-m9-qa`, som kör `npm --prefix C:/DEV/WORKTREES/handball-manager/m1-m9-playable-qa/apps/game run start -- --port 3109`. Det är ett produktionsbygge (`next build` + `next start`).
- **Isolering:** en egen port ger ett eget webbläsarursprung, och spelets sparfiler (IndexedDB/localStorage) är knutna till ursprunget. Inga Alpha- eller produktionssparfiler rörs. Inga andra servrar har stoppats eller ändrats.
- **Alpha-spärren:** ange Alpha-testkoden. Den är projektets standardkod i `components/AlphaAccessGate.tsx`.
- **Verifierat i UI:t:**
  - Ny karriär (IFK Tumba, manager "QA Manager", start vid första matchen).
  - Assistentens förslag på startsjua.
  - Cupmatchen mot VästeråsIrsta spelad hela vägen (förlust 31–33) och resultatet sparat.
  - Servern omstartad med slutligt bygge; karriären laddas igen.
  - Förhandling om Mathias Gidsel (Füchse Berlin): spelaren svarar "Helt ointresserad. Anser att nivån i Allsvenskan är för låg i nuvarande skede av karriären." Det är PCDM i UI:t.
- **Så testar du:**
  1. Öppna http://localhost:3109 och ange Alpha-koden.
  2. Fortsätt den befintliga testkarriären ("Alla karriärer") eller starta ett nytt spel.
  3. **Transferrealism:** Rekrytering → Spelarsök → öppna en stjärna utomlands eller i HBL → Förhandla. Intresse och lönekrav kommer från PCDM.
  4. **Internationell marknad:** under transferfönstret (juni–september, januari) köper utländska klubbar kontrakterade svenska spelare, och dina egna spelare får bud. Se inkorgen och spelarnas klubbhistorik.
  5. **Åldrande, pension och ungdom:** följ spelare över 30 under säsongen (15 juni utvärderas ålder och pension) och världspoolens trupper (1 juli kommer nya prospekt).
  6. **Säsongsbyte:** spela säsongen till slut och tryck "Börja nästa säsong". Det är `main`s övergång.

## 10. Övrigt

- En temporär baslinje-worktree `C:\DEV\WORKTREES\handball-manager\m1-m9-main-baseline` (detached på `origin/main`) skapades för att kunna jämföra fel. Den tas bort först efter godkännande, med `cmd /c rmdir` för junctions och därefter `git worktree remove`.
- Loggar: `C:\DEV\QA\logs\m1-m9-integration\`

## 11. Git

- **Branch:** `integration/m1-m9-playable-qa`, pushad till `origin/integration/m1-m9-playable-qa` (se slutrapporten i chatten för fjärr-HEAD).
- **Commits ovanpå `main`:** 13 överförda M1–M8-commits (med `-x`-referenser till originalen), 3 integrationscommits och denna rapport.
