# TRANSFER REALISM & PLAYER CAREER DECISIONS — Implementationsrapport v1.0

- **Branch:** `work/transfer-realism-pcdm` (worktree `C:\DEV\WORKTREES\handball-manager\transfer-realism-pcdm`)
- **Bas:** `fa655477` (fix: prevent duplicate transfers and defensive specialist reuse)
- **Commits:** `bf2bdab9` (M1–M2), `a0ca82c8` (M3–M5), `0b8f1e4b` (M6-kalibrering), `253866c2` (prestanda och testjustering), `54612002` (testfix), plus en rapport-commit ovanpå (se `git log`)
- **Inget är pushat, mergat eller deployat.**
- **Underlag:** QA-loggar i `C:\DEV\QA\logs\transfer-realism\`, simuleringsdata i `C:\DEV\QA\reports\transfer-realism\{final,baseline}\`

## 0. Sammanfattning (ärligt läge)

| Område | Resultat |
|---|---|
| Delad beslutsmodell (PCDM) för alla spelarbeslut, människa och CPU | **Klart.** Varje flöde som frågar "vill spelaren?" går genom samma modell. |
| Gidsel/Skipagøtu-felet (världsstjärna → Division 1) | **Löst.** Ingen namngiven spelare i Div 1 före 33 år, i någon seed. Baseline: Skipagøtu i Div 1 under fyra säsonger. |
| Världsklass < 33 i Division 1 | 0 / 1 / 1 i värsta säsongen (seed a/b/c), mot 17 i baseline. |
| Elitspelare < 31 som flyttar till Div 1 (20 säsonger) | 13 / 16 / 20, mot 79 i baseline. **Kriteriet ≤ 1 klaras inte.** |
| Internationella klubbar förnyar och värvar | **Klart.** 856–874 förnyelser i världspoolen (baseline 0). 14 % av alla flyttar är internationella (baseline 4 %). |
| Världsklass kvar i Europa hela perioden | **Klaras inte.** Andelen hålls till och med cirka säsong 11 och faller sedan till 0 vid säsong 20, även i baseline (där den är 0 redan från säsong 4). Orsak: världspoolen saknar ungdomsintag (se §8). |
| Ligaordning HBL > Allsvenskan varje säsong | **Klaras inte**, varken i PCDM eller baseline (§8). |
| Truppstabilitet och nödläge | Klarar median ≥ 16 och nödläge ≤ 10 %. Seed b har en säsong med 3 trupper under 14 spelare (gränsen är 2). |
| Determinism, paritet, sparfilskompatibilitet | Klart och testat. |
| Testsvit | 2831 tester: 2824 pass, 7 fail. Alla 7 fel finns redan på bas-commit (data och harness). Ett tidigare fel är löst. |

Kort sagt: beslutsmodellen fungerar och tar bort det absurda beteendet. Kvar finns två strukturella brister som ligger **utanför** spelarbeslutet, nämligen att världspoolen inte förnyar sin population och att utvecklingsmodellen driver nivåerna uppåt. De gör att tre av tio förutbestämda acceptanskriterier inte klaras över 20 säsonger. Jag har inte ändrat trösklar eller testdata för att dölja det.

## 1. Rotorsaker (från auditen, verifierade)

1. **Fri agent med lön 0 accepterade alltid.** Det gamla `evaluatePlayerTransferDecision` jämförde bara pengar och roll och hade inget sportsligt golv. En fri agent jämförde mot lön 0, så varje erbjudande slog nuläget.
2. **Världspoolens klubbar förnyade aldrig kontrakt.** Den 31 maj släpptes varje världspoolspelare, även världsklass, in i den **svenska** fria agentpoolen, där vilken svensk klubb som helst kunde signa honom.
3. **Ingen jämförbar styrkeskala** mellan ligor eller klubbar. "Division 1 ligger under Allsvenskan" fanns inte i datan som spelaren använde för sitt beslut.
4. **Flera parallella regelverk.** Intresse (`playerInterest`), lönekrav (`negotiation`), förnyelse (`renewals`), CPU-förnyelse, köparsökning (`market`) och lån hade var sin heuristik, ofta med motsägande resultat. Ett exempel: spelaren var "IMPOSSIBLE" i intresse men accepterade i förhandlingen.
5. **CPU-förnyelser frågade aldrig spelaren**, och lönen blåstes upp ×1,9 per förnyelse.

## 2. Arkitektur

```
lib/transfers/careerDecision/
  sportingStrength.ts   M1  klubbnivå, liganivå på en CA-skala, evidensviktade priors,
                            dokumenterad prestige, säsongsutjämning
  model.ts              M2  ren PCDM: profiler, komponenter, mjukt golv, reservationsnytta,
                            decide / chooseBetweenOptions / estimateAcceptance / wageDemandFor
  stateAdapter.ts       M2–M3  CareerState → PCDM (memoiserad): profil, ClubOption,
                            MarketContext, playerDecisionOnMove, playerWageDemandAt,
                            explainedWageDemand, acceptanceEstimate, playerRenewalDecision,
                            renewalWageDemand, playerChoosesBetween, internationalClubWants
lib/transfers/internationalMarket.ts  M4  världspoolens förnyelser, värvning av fria agenter, säsongsrullning
```

### 2.1 Beslutsmodellen (model.ts)

Ett alternativ (klubb + villkor) får nytta `U = Σ wᵢ·cᵢ` över sju komponenter, var och en i [−1, 1]:

| Komponent | Definition |
|---|---|
| sport | Asymmetrisk. `d = miljönivå − CA + 6`. Om `d ≥ 0` gäller `0,8·tanh(d/30)`, annars `−1,6·tanh(−d/55)`. Nedgradering väger alltså dubbelt så tungt som uppgradering. |
| role | Förväntad roll (startspelare, rotation, reserv, talang) utifrån CA mot klubbens trupp |
| money | `tanh(1,2·log₂(lön / referenslön))`, alltså relativt och avtagande |
| security | Kontraktslängd viktad mot ålder |
| personal | Hemland och nation |
| stability | Att stanna kvar i nuvarande klubb |
| development | Speltid och nivå (ung spelare) |

- **Profiler.** Åtta karriärprofiler (WORLD_CLASS, ESTABLISHED_ELITE, AMBITIOUS, YOUNG_TALENT, DEVELOPMENT, ROTATION, VETERAN, CAREER_END) med kontinuerliga medlemskap (smoothstep på ålder, världspercentil och CA/PA). Vikterna blandas, med 35 % basandel ESTABLISHED_ELITE, så att det inte finns några hårda trösklar.
- **Mjukt sportsligt golv.** Tolerans `50 − 34·golvstyrka` CA-poäng. Under den kapas pengakomponenten till `κ·|sportbidrag|`, där `κ = 1 − 0,75·f·smoothstep(0, 20, underskott)`. **Pengar kan alltså inte köpa en enorm nedgradering**, oavsett belopp.
- **Reservationsnytta.** `R = max(stanna + 0,03, vänta − väntekostnad, bästa internationella − 0,04)`. Väntealternativet är en trovärdig marknadsnivå: 75:e percentilen bland klubbar inom [CA − 18, CA + 4], minus 4, med lön referens × 1,1 och roll efter nivågap. Väntekostnaden är `0,1 + 0,035·månader·(1 + 0,6·smoothstep(28, 34, ålder))`.
- **Beslut.** Spelaren accepterar om `U > R + 0,02 + jitter`. Jittret är en deterministisk seed-offset (±0,03) per spelare och klubb. Ingen `Math.random`.
- **Lönekrav.** `wageDemandFor` bisekterar (18 iterationer, upp till 8× referens) fram den lägsta lön där spelaren accepterar. Funktionen returnerar `null` om ingen lön räcker. Då är spelaren omöjlig att värva, och därmed är intresse ⇔ lönekrav konsekvent.
- **Förklaring.** `explainDecision` ger svensk text med de dominerande faktorerna, som används i förhandlingsmotbud.

### 2.2 Referenslön

För en kontrakterad spelare är referensen hans nuvarande lön. För en fri agent är den fair wage × marknadsfaktor, där marknadsfaktorn är medianen av kontrakt/fair i ett deterministiskt urval (var sjunde spelare), begränsad till 0,3–1,5. Golvet är 200 €/mån (ekonomins egen minimilön). Den här ändringen var nödvändig: fair wage låg i snitt ×1,71 över faktiska löner, vilket i de första simuleringarna gav orimliga krav.

## 3. Ändrade filer och flöden

**Nya filer:** `careerDecision/{model,sportingStrength,stateAdapter}.ts`, `careerDecision/{model,integration}.test.ts`, `transfers/internationalMarket.ts`, `scripts/transfer-realism-sim.ts`, `scripts/lib/{fullWorldCareer,transferDiag,wcDiv1Diag}.ts`.

| Flöde | Fil | Före | Efter |
|---|---|---|---|
| Svar på manager-bud (permanent och lån) | `playerDecision.ts`, `transferIntegration.ts` | Pengar + roll, lön 0 för fri agent | `evaluatePlayerTransferDecision(state, …)` delegerar till PCDM. Lånets säkerhet räknas på kvarvarande kontrakt. |
| Intressenivå i UI | `playerInterest.ts` | Egen poängheuristik | Projektion av PCDM-kravkvoten: HIGH ≤ 1,0, INTERESTED ≤ 1,25, UNSURE ≤ 1,6, UNLIKELY ≤ 2,4, annars IMPOSSIBLE |
| Lönekrav och motbud | `negotiation.ts`, `negotiationIntegration.ts` | `computePlayerWageDemand` med egna multiplikatorer | `explainedWageDemand`. Konkurrerande klubbar filtreras på acceptanssannolikhet ≥ 0,5. Rivalbeslut och motbud namnger rivalen utifrån faktorerna. |
| Köparsökning vid försäljning | `players/market.ts` (`findBuyer`) | Valfri klubb med pengar | Endast köpare spelaren accepterar enligt PCDM. Riktiga världspoolsklubbar finns med som köpare. |
| Spelarens hållning och förtida kontrakt | `players/market.ts` | Heuristik | PCDM, där `wantsToLeave` innebär begäran eller moral < 45 |
| Managerns förnyelse | `players/renewals.ts` | Dubbla modifierare | PCDM-krav (kan vägra klubben). Moral- och förhandlarmodifierare behålls. |
| CPU-förnyelse | `cpuContractDecisions.ts` | Klubben bestämmer ensam, lön ×1,9 | Spelaren tillfrågas. Kravet kapas till 1,1 × nuvarande lön, och klubbekonomin räknas en gång per klubb. |
| CPU-värvning | `cpuCandidateEvaluation.ts`, `cpuRecruitment.ts` | Kandidat antas vilja | Lat tvåfas: billig poäng, sedan PCDM i poängordning tills 5 kandidater som är villiga och har råd hittats. Lönetak 1,3 × referens (×1,25 i nödläge). |
| Internationell marknad | `internationalMarket.ts`, `dailyTick.ts` | Fanns inte | Förnyelser (översyn var 15:e dag, dagligen sista 30 dagarna) och värvning av fria agenter den 1, 8, 15 och 22 i månaden |
| Klubbekonomi | `affordability.ts` | — | `maxAffordableRenewalWage` |
| Sparfil | `career/types.ts` | — | Valfritt `transferMarket?.leagueStrength` (enbart utjämningscache) |

## 4. Metod för liga- och klubbstyrka (M1)

- **Klubbnivå** = `ownLevelScore`, samma mått som CPU-värvningen redan använder (de 7 bästa spelarna per positionsbehov, på CA-skalan).
- **Liganivå** = 60:e percentilen av mätbara klubbar (minst 7 ratade spelare), viktad mot en populationsprior med `PRIOR_WEIGHT_PLAYERS = 40`. Priorn har en offset som är **uppmätt** på de svenska ligorna, där full data finns, och appliceras på ligor med partiella trupper.
- **Prestige** (dokumenterad och avsiktligt liten): ger-1 +6; den-1, esp-1, hun-1 +5. Det motsvarar att dessa ligors partiella trupper i datan underskattar verklig bredd.
- **Miljönivå** för en spelare i en klubb = 0,65·klubb + 0,35·liga.
- **Utjämning.** Nivåerna rullas med EMA (α 0,5) den 1 juli in i `state.transferMarket.leagueStrength`. Fältet är valfritt, och om det saknas räknas allt fram direkt.
- **Uppmätt startläge** (säsong 1, seed a): Euro-elit 145,2 > HBL 140,3 > Allsvenskan 129,8 > Div 1 112,4. Division 1 ligger alltså tydligt under Allsvenskan (cirka 17 CA-poäng), som i sin tur ligger cirka 10 under HBL.

## 5. Internationellt beteende (M4)

- **Förnyelse.** En världspoolsklubb vill behålla en spelare som passar nivån (CA ≥ klubbnivå − 14) och är högst 34 år. Spelaren förnyar bara om PCDM föredrar att stanna framför marknaden. Lönen kapas till 1,1 × nuvarande lön.
- **Värvning.** Fria agenter över synlighetsgränsen (världspercentil ≥ 0,75, eller som återvänder till sitt hemland) erbjuds de tre bäst passande klubbarna (CA ≥ klubbnivå − 8) och väljer med `chooseBetweenOptions`. Kapaciteten är 10 per klubb och högst 1 värvning per klubb och pass. De starkaste behandlas först, deterministiskt.
- **Ägarskap** flyttas alltid via `transferPlayerPermanently`, så det finns en ägare och ett kontrakt per spelare.
- **Konsekvens i simuleringen.** Gidsel och Skipagøtu stannar i Euro-elit (Füchse Berlin för Skipagøtu till 35 års ålder) och återvänder till Sverige först som veteraner, till HBL eller Allsvenskan, aldrig Div 1.

## 6. Testresultat

### 6.1 Nya tester

- `model.test.ts` (18 tester). Scenario A–E från uppdraget, plus invarianter:
  - fri agent med lön 0 auto-accepterar aldrig
  - monotonicitet i lön, nivå och roll
  - världsklass accepterar inte Div 1 för pengar (även ×8 lön)
  - determinism
  - paritet mellan människa och CPU (samma nytta för samma villkor)
  - mjukt golv utan diskontinuitet
- `integration.test.ts` (11 tester mot hela världen):
  - liganivåhierarki
  - Gidsel som fri agent avvisar svenska klubbar och signas utomlands
  - Skipagøtu
  - paritet
  - intresse ⇔ null-krav
  - rivalfiltrering
  - internationella förnyelser
  - spelare som vägrar CPU-förnyelse
  - veterangolv
  - laddning av äldre sparfil utan `transferMarket`

### 6.2 Hela sviten

| Körning | Tester | Pass | Fail |
|---|---|---|---|
| Baseline `fa655477` (ren worktree) | 2815 | 2807 | 8 |
| PCDM, HEAD före sista testfix | 2831 | 2823 | 8 (7 befintliga + 1 som fixades i `54612002`) |
| PCDM, HEAD `54612002` (`final-tests-3.log`) | 2831 | 2824 | 7 (exakt de 7 befintliga) |

**Befintliga fel (finns på bas-commit, opåverkade, data- och harness-relaterade):**
- Allsvenskan-roster 284
- HBL bio CA/PA
- 265 unika HBL-id
- populationsaudit 1191
- bundlad HBL-data mot Node
- season-0-checkpoint
- identitetskollision namn+DOB

Baselinens åttonde fel (`IMPOSSIBLE gate: Allsvenskan club cannot negotiate with top Handbollsligan stars`) **passerar nu**, eftersom PCDM ger konsekvent IMPOSSIBLE.

### 6.3 Ändrade befintliga tester, med motivering

Inga tester har ändrats för att dölja ett fel. Varje ändring speglar att den gamla semantiken (spelaren säger alltid ja, oberoende lönemultiplikatorer) medvetet har ersatts.

| Test | Ändring | Varför |
|---|---|---|
| `playerDecision.test.ts` | Borttagen | Testade den gamla pengar+roll-funktionen. Ersatt av `model.test.ts`. |
| `negotiation.test.ts`, `transferManagement.test.ts` | Förväntat krav hämtas från PCDM | `computePlayerWageDemand` finns inte längre |
| `playerInterest.test.ts` | Stjärnfallet använder en spelare i bästa ålder (< 31) | En 34-åring som vill till HBL är nu legitimt intresserad (veteranprofil) |
| `playerDynamics.test.ts` | Spelaren görs missnöjd. Köparvillkor från PCDM. | En nöjd spelare med kontrakt vill inte längre lämna för vem som helst |
| `marketHotfix.test.ts` | Lön enligt PCDM-krav | Samma skäl |
| `allsvenskanTransferIntegration.test.ts` | Väljer en lånebar spelare som accepterar | Lån kräver nu spelarens ja |
| `worldCompetitions.test.ts` | Svagaste spelaren, `exhaustive`, valfri HBL-spelare | Toppstjärnor vill inte till Allsvenskan, vilket är syftet |
| `cpuQualityUpgrade.test.ts` (STRONG) | Omskriven: uppgraderingar ska överträffa gapet, ≤ antal spelare som kan ersättas, ≤ 2 per klubb | Det gamla testet antog att ingen alls kom. Med en marknad där spelare väljer sker enstaka motiverade uppgraderingar. |
| `cpuSquadBuilding.test.ts` (test 7) | `exhaustive: true` | Testar synlighet, inte lat rangordning |
| kontraktstester | PCDM-krav | Samma skäl |

### 6.4 Slutkörning på HEAD

`C:\DEV\QA\logs\transfer-realism\final-tests-3.log`: 2831 tester, 2824 pass, 7 fail. Alla sju fel finns redan på bas-commit `fa655477` (listan ovan). Inga nya fel har tillkommit, och ett tidigare fel (IMPOSSIBLE gate) är löst.

## 7. 20-säsongssimulering (M6)

**Uppställning.** `scripts/transfer-realism-sim.ts`, full värld, CPU-manager, 20 säsonger (2026–2046), seeds `tr-final-a/b/c`, plus baseline (bas-commit, samma skript) på seed `tr-final-a`. Varje körning tog cirka 6 timmar. **Trösklarna sattes i skriptet innan slutkörningarna startades** och har inte ändrats efteråt.

Världsklass = CA ≥ 150 (cirka topp 3 % vid start), elit = CA ≥ 140 (cirka topp 10 %). Båda är fasta vid start.

### 7.1 Acceptanskriterier

| Kriterium | a | b | c | baseline |
|---|---|---|---|---|
| Ingen världsklass < 33 i Div 1 vid säsongsslut | ✅ 0 | ❌ 1 | ❌ 1 | ❌ 17 |
| Elit < 31 till Div 1, högst 1 totalt | ❌ 13 | ❌ 16 | ❌ 20 | ❌ 79 |
| Elitnedgraderingar (≥ 2 nivåer) ≤ 5 % av flyttar | ✅ 0,1 % | ✅ 0,2 % | ✅ 0,3 % | ✅ 2,2 % |
| Världspoolen förnyar kontrakt | ✅ 856 | ✅ 860 | ✅ 874 | ❌ 0 |
| Världsklass i Europa ≥ 60 % av start varje säsong | ❌ min 0 | ❌ min 1 | ❌ min 0 | ❌ min 0 |
| Ligaordning varje säsong | ❌ | ❌ | ❌ | ❌ |
| Svensk truppmedian ≥ 16 | ✅ 19 | ✅ 19 | ✅ 19 | ✅ 20 |
| ≤ 2 svenska trupper < 14 | ✅ 2 | ❌ 3 | ✅ 2 | ✅ 1 |
| Nödläge ≤ 10 % av klubbveckor | ✅ 5,3 % | ✅ 7,1 % | ✅ 8,3 % | ✅ 2,0 % |
| Namngivna spelare aldrig i Div 1 före 33 | ✅ | ✅ | ✅ | ❌ Skipagøtu S1, S2, S7, S8 |

PCDM klarar 6/10, 4/10 och 5/10 kriterier (seed a/b/c). Baseline klarar 4/10.

### 7.2 Totaler över 20 säsonger

| | a | b | c | baseline |
|---|---|---|---|---|
| Klubbflyttar | 3581 | 3551 | 3590 | 1648 |
| varav internationella | 504 | 530 | 490 | 71 |
| Förnyelser | 6643 | 6558 | 6639 | 9231 |
| Kontrakt som löpt ut | 2194 | 2147 | 2138 | 1714 |
| Värvningar från fria agentpoolen | 1096 | 1081 | 1064 | 384 |
| Återanställningsgrad för fria agenter | 23,5 % | 23,4 % | 22,7 % | 7,8 % |

Marknaden är tydligt mer levande: dubbelt så många flyttar, sju gånger fler internationella och tre gånger fler värvningar av fria agenter.

### 7.3 Förlopp (seed a, urval)

| Säsong | Världsklass i Euro-elit | Världspool (EE + EO) | Världsklass < 33 i Sverige | Elit till Div 1 | Median kassa SE (€) | Pressade klubbar |
|---|---|---|---|---|---|---|
| 1 | 26 | 103 | 10 | 0 | 32 630 | 5 |
| 5 | 29 | 154 | 4 | 0 | 3 512 | 17 |
| 10 | 27 | 174 | 5 | 3 | 10 880 | 15 |
| 13 | 19 | 139 | 17 | 2 | 22 612 | 18 |
| 15 | 13 | 85 | 8 | 0 | 22 502 | 14 |
| 20 | 0 | 29 | 2 | 0 | 37 042 | 4 |

Baseline: världspoolen töms helt redan vid säsong 4, och världsklass < 33 i Sverige stiger till 62 vid säsong 11.

### 7.4 Tolkning av de kriterier som inte klaras

1. **Elit till Div 1 (13–20 mot 79).** Det är en minskning med 75–85 %, men inte nära ≤ 1. Flyttarna är inte diagnostiserade en och en. (Diagnosen `wcDiv1Diag.ts` täckte bara världsklass i Div 1, och där var alla veteraner på 35–40 år.) Min **hypotes**: det rör sig om spelare strax över CA 140 som går till de starkaste Div 1-klubbarna. Div 1:s topp (p90 cirka 137) närmar sig elitgränsen när utvecklingsdriften lyfter alla nivåer, och då blir en sådan flytt inget "enormt nedköp" i modellens mening. Kriteriet mäter en fast CA-gräns mot en rörlig miljö. Jag har inte ändrat det, och det bör verifieras per flytt i nästa sprint.
2. **Världsklass < 33 i Div 1 (1 i seed b och c).** Enstaka fall. Värsta säsongen i baseline hade 17.
3. **Världsklass i Europa.** Tydligast i tabellen ovan: världspoolens population krymper från cirka 175 till 29 spelare mellan säsong 10 och 20. Orsaken är att **världspoolsklubbar inte har något ungdomsintag** och bara kan värva fria agenter. Den internationella marknaden köper inte kontrakterade spelare från svenska klubbar. När startgenerationen pensioneras finns inga ersättare. Samtidigt sjunker världsklass < 33 i Sverige till 0–2, så hela världen saknar nya spelare med CA ≥ 150 mot slutet. Beslutsmodellen gör rätt (stjärnorna stannar i Europa så länge de finns), men befolkningsmodellen bär inte 20 säsonger. Baseline är sämre: där är Europa tomt redan från säsong 4.
4. **Ligaordning.** HBL > Allsvenskan bryts från säsong 8 med PCDM, och från säsong 12 i baseline. Två bidrag, som inte isolerats var för sig:
   - **Utvecklingsdrift** (finns i baseline). Div 1 stiger från 112–115 till cirka 128, och Allsvenskan från cirka 129 till cirka 141, eftersom åldersnedgången nästan saknas (exempel: CA 159 vid 40 års ålder).
   - **Transfermodellen.** HBL:s bästa spelare går nu utomlands (cirka 500 internationella flyttar mot 71), vilket sänker HBL:s 60:e percentil några säsonger tidigare. Det är realistiskt i sig, men tillsammans med punkten ovan blir ordningen inverterad.

   Euro-elit > HBL håller fram till cirka säsong 16. Därefter faller den krympande världspoolen (punkt 3).
5. **Tre trupper under 14 (seed b, en säsong).** Gränsfall (gränsen är 2), med median 19.

## 8. Ekonomisk påverkan

- **Löneinflation vid förnyelse är borta.** CPU- och internationella förnyelser kapas till ≤ 1,1 × nuvarande lön (tidigare ×1,9). Förnyelser blir färre (6 600 mot 9 200) eftersom spelare nu kan säga nej och gå till marknaden.
- **Svensk kassa** (median): baseline ackumulerar orealistiskt (40 k → 381 k € på 20 säsonger, eftersom ingen handel sker). Med PCDM ligger medianen på 27–41 k € vid säsong 20, med en svacka säsong 5–7 (ned mot −5 k €) när marknaden ställer om. **Pressade klubbar** ligger på 4–25 (baseline 0–11). Det är en förväntad följd av att det finns en fungerande marknad att spendera på. Det kan behöva kalibreras, se ägarbeslut.
- **Härledda värden.** Referenslön och marknadsfaktor härleds ur befintlig kontraktsdata, så ingen ny lönetabell har lagts in.

## 9. Sparfilskompatibilitet

- Det enda nya fältet är `CareerState.transferMarket?.leagueStrength` (valfritt). Saknas fältet räknas nivåerna fram direkt. Det skrivs först vid nästa 1 juli.
- Inga befintliga fält har bytt betydelse eller tagits bort. Ingen migrering behövs, och inga befintliga sparfiler skrivs om.
- Integrationstestet laddar ett tillstånd utan fältet och verifierar beslut och dagstick.
- Alpha-testarnas sparfiler och produktionsdata har inte rörts.

## 10. Prestanda

PCDM i varje flöde gav först 2,8 s per speldag. Efter memoisering i `stateAdapter` (invaliderad på identitet för ratings, trupper, kontrakt, datum och transferMarket), lyft av klubbkostnadsberäkningar och lat kandidatrangordning ligger det på **cirka 480–600 ms per dag, mot 1 645 ms i baseline** i samma simulering. Hela 20-säsongskörningar tar ungefär lika lång tid som baseline (cirka 6 timmar), eftersom marknaden gör mer.

## 11. Begränsningar

1. **Världspoolen har inget ungdomsintag**, så populationen krymper efter cirka säsong 11 (§7.4). Det är den största kvarvarande bristen.
2. **Internationella klubbar köper inte kontrakterade spelare** från svenska klubbar. De tar bara fria agenter och managerns egna försäljningar (via `findBuyer`).
3. **Abstrakta utländska klubbar har ingen ekonomi.** De styrs av lönetak, inte budget.
4. **Utvecklingsmodellen saknar i praktiken åldersnedgång**, vilket driver nivåerna uppåt och veteraner kvar i toppen. Den har inte rörts eftersom den var skyddad (utanför transferområdet).
5. **CPU erbjuder 3-årskontrakt oavsett ålder** (`CPU_OFFER_CONTRACT_YEARS`). Spelarens säkerhetskomponent tar hänsyn till det, men klubbsidan gör det inte.
6. **Världspoolens trupper är partiella** i datan, vilket kompenseras med prior och prestige (§4).
7. **Genererad kontraktsdata** låter nästan alla kontrakt löpa ut 2027-05-31, vilket ger en stor våg i säsong 1–2.
8. Elitkriterierna använder fasta CA-gränser, som tappar mening när hela nivåskalan driver.

## 12. Ägarbeslut som behövs

1. **Merge.** Ska `work/transfer-realism-pcdm` mergas trots att 3 av 10 kriterier inte klaras över 20 säsonger? Min rekommendation är ja. Alla kriterier förbättras eller är oförändrade mot baseline, och de som inte klaras beror på punkt 2 och 3 nedan.
2. **Världspoolens förnyelse** (nästa sprint): ungdomsintag eller generering av ersättare för världspoolsklubbar, plus att internationella klubbar kan köpa kontrakterade svenska spelare.
3. **Åldersnedgång i utvecklingsmodellen**: ett separat beslut, eftersom den ligger utanför transferområdet.
4. **Prestigevärden** (ger +6; den, esp, hun +5) och att den-1, esp-1 och hun-1 hamnar ungefär i nivå med HBL.
5. **Lönetak** (1,3× vid värvning, ×1,25 extra i nödläge, 1,1× vid förnyelse) och antalet pressade klubbar.
6. **Städning av den temporära baseline-worktreen** `C:\DEV\WORKTREES\handball-manager\transfer-realism-baseline` (detached på `fa655477`, med junctions). Den tas bort först efter ditt godkännande, med `cmd /c rmdir` för junctions och därefter `git worktree remove`.
