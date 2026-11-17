# TRANSFER REALISM — Sprint M8: Hållbart internationellt handbollsekosystem

- **Branch:** `work/transfer-realism-pcdm` (worktree `C:\DEV\WORKTREES\handball-manager\transfer-realism-pcdm`)
- **Utgångspunkt:** `0f31ff0d` (PCDM-implementationen och dess rapport)
- **M8-commits:**

  | Commit | Innehåll |
  |---|---|
  | `5172060a` | M8A |
  | `e6fc1b6b` | M8B |
  | `99464291` | M8D |
  | `364547fd` | simuleringsmått |
  | `f4a88177` | M8C |
  | `9973d74a` | M8E-diagnostik |

  Därtill en rapport-commit ovanpå (se `git log`).
- **Inget är pushat, mergat eller deployat.**
- **Underlag:**
  - Loggar i `C:\DEV\QA\logs\transfer-realism\m8\`
  - Data i `C:\DEV\QA\reports\transfer-realism\m8\` (`final/`, `baseline/`, `probe1/`, `probe2/`, diagnos-JSON)

> **Ordningsavvikelse, redovisad öppet.** M8C-utredningen behövde fall från en lång körning. Den kördes därför på koden *före* M8 (`0f31ff0d`), i bakgrunden medan M8A, M8B och M8D implementerades. Kalibreringen i M8C gjordes först efter att diagnosen var klar, och M8C committades efter M8D. Varje milstolpe hade gröna riktade tester innan nästa påbörjades.

## 0. Sammanfattning

| Krav (avsnitt 12) | Status | Belägg |
|---|---|---|
| Internationell population hållbar | **Ja** | 147–155 vid start, max 292–309 (tak 10 per klubb), 246–254 vid säsong 20. Baseline: 2 vid start, 0 i slutet. |
| Internationella klubbar köper kontrakterade spelare | **Ja** | 377–406 köp från Sverige och 318–333 mellan internationella klubbar på 20 säsonger. Säljande klubb och spelare beslutar båda. |
| Elitvärvning till Division 1 utredd och förbättrad | **Ja, men kriteriet klaras inte** | Elitflyttar till Division 1: 9/5/3 (baseline 79, M7 13/16/20). Inga byten mellan två Division 1-klubbar och inga från fri agent. Kriteriet ≤ 1 klaras inte. |
| Åldrande mer realistiskt | **Ja, med kvarstående brist** | 30+ tappar nu 1–4 CA per säsong (förut ±0). Aktiva 38+ max 109–111 (baseline 218). Äldsta aktiva 45–46 (baseline 49). Pensionering av 38–42-åringar med kontrakt är fortfarande för låg. |
| Ligastyrkans utveckling förstådd och trovärdig | **Förstådd, inte trovärdig i simuleringen** | Huvudorsak: säsongsövergången är blockerad i denna version. Efter säsong 1 spelas inga matcher, och HBL-klubbarna förlorar matchdagsintäkterna (§8). |
| Tidigare PCDM-scenarier fungerar | **Ja** | Alla PCDM-, integrations- och transfertester är gröna. Gidsel och Skipagøtu aldrig i Division 1 före 33. |
| Tre simuleringar à 20 säsonger | **Ja** | `tr-final-a/b/c`, cirka 10 000 s vardera, plus baseline med samma skript. |
| Inga nya oförklarade testregressioner | **Ja** | 2 855 tester, varav 2 848 passerar. De 7 felen är exakt de 7 som redan fanns på bas-commiten. |

**Det ärliga helhetsläget.** Det internationella ekosystemet är nu hållbart och realistiskt, och spelarbesluten fungerar. Två saker gör ändå att flera av de ursprungliga kriterierna fortfarande inte klaras över 20 säsonger:

1. **Den frysta säsongskalendern.** Den finns redan i spelet i denna version och påverkar baseline lika mycket (§8).
2. **Talangflödet.** Utvecklingsmodellen och ungdomsgenereringen bär inte, i stationärt läge, den världsklass som realdatan har vid start. Det blir synligt först nu när åldrandet faktiskt verkar (§9.4).

Båda ligger utanför transfersystemet och kräver ägarbeslut.

## 1. Rotorsaker

| # | Problem | Rotorsak (belagd) |
|---|---|---|
| 1 | Världspoolen krympte (cirka 175 → 29) | Världspoolens klubbar låg utanför `careerWorldClubIds`, så de fick inget ungdomsintag och ingen utveckling. Åldrande och pensionering skedde bara via kontraktsutgång. Fria agenter var det enda inflödet. |
| 2 | Internationella klubbar kunde inte köpa kontrakterade spelare | Det fanns ingen sådan väg. Den internationella marknaden tog bara fria agenter och spelare som managern själv sålde. |
| 3 | Elitspelare till Division 1 | Spelare som utvecklats på frysta löner (CA 140–153 på 200–800 €/mån) jämförde pengar med sin egen gamla lön. Dessutom räknade måttet byten mellan två Division 1-klubbar som nedflyttningar (§6). |
| 4 | Åldrandet saknades i praktiken | Nedgången tog högst 3 attributpoäng per år, slumpvis valda. Med 63 attribut för utespelare och 0,166 CA per poäng motsvarar det cirka 0,5 CA per år. CPU erbjöd 3-årskontrakt i alla åldrar. |
| 5 | Allsvenskan gick om HBL | Den huvudlösa simuleringen spelar inga matcher efter säsong 1 (säsongsövergången är blockerad i denna version och första dagen hoppas över). HBL-klubbarnas matchdagsintäkter blir då 0 → konkurs → inga köp möjliga. Utan åldrande samlas dessutom veteraner i HBL:s kärna (§8). |

## 2. Arkitekturändringar

```
lib/career/careerWorld.ts            worldPoolCareerClubIds(): världspoolens klubbar som befolkning
                                     (utveckling, åldrande, intag) -- ej CPU-ekonomiklubbar
lib/career/internationalYouthIntake.ts  M8A: årligt prospektintag till världspoolsklubbar
lib/career/internationalYouthNames.ts   M8A: fiktiva namnpooler per region
lib/career/worldDevelopment.ts       M8A: utvecklingen omfattar världspoolens spelare
lib/career/playerLifecycle.ts        M8A: åldrande/pension även för världspoolen
                                     M8D: familjebaserad, positionskänslig nedgång + speltidsfaktor i pension
lib/transfers/careerDecision/stateAdapter.ts
                                     M8B: internationalBuyerWants, internationalFeeCapacityEur,
                                          köp per säsong (transferSeasonKey, record/count)
                                     M8C: UNDERPAID_REFERENCE_FLOOR i referenslönen
lib/transfers/careerDecision/model.ts  M8D: contractYearsCapForAge
lib/transfers/internationalMarket.ts  M8A: anropar intaget; M8B: köppass i öppna fönster
lib/transfers/transferIntegration.ts  M8B: sellingClubDecisionOnFee (samma säljbeslut som alla bud)
lib/players/market.ts                M8B: bud på managerns spelare använder samma köparregel och kapacitet
lib/career/cpuCandidateEvaluation.ts, cpuRecruitment.ts, cpuContractDecisions.ts
                                     M8D: åldersberoende kontraktslängd
```

PCDM är oförändrad i sin kärna. Den enda modelländringen är referenslönen för kraftigt underbetalda spelare (M8C). Människa och CPU använder fortfarande samma beslutsväg.

## 3. Ändrade filer

**Produktionskod:**
- `career/careerWorld.ts`, `career/internationalYouthIntake.ts` (ny), `career/internationalYouthNames.ts` (ny)
- `career/worldDevelopment.ts`, `career/playerLifecycle.ts`
- `career/youthIntake.ts` (två hjälpfunktioner exporteras), `career/types.ts` (valfritt fält)
- `career/dailyTick.ts` (loggtexter)
- `career/cpuCandidateEvaluation.ts`, `career/cpuRecruitment.ts`, `career/cpuContractDecisions.ts`
- `transfers/careerDecision/{model,stateAdapter,sportingStrength}.ts`
- `transfers/internationalMarket.ts`, `transfers/transferIntegration.ts`, `players/market.ts`

**Tester:**
- Nya: `career/internationalYouthIntake.test.ts` (6), `transfers/internationalPurchases.test.ts` (5), `career/ageingModel.test.ts` (9), `transfers/careerDecision/underpaidReference.test.ts` (4)
- Ändrad fixtur: `career/cpuQualityUpgrade.test.ts` (§12)
- Manifest: `scripts/game-test-files.json`

**Skript (endast observation):**
- `scripts/transfer-realism-sim.ts` har nya mått. De ursprungliga ACCEPTANCE-kriterierna är oförändrade.
- `scripts/m8-div1-diagnostic.ts`, `scripts/m8e-league-diagnostic.ts`, `scripts/m8e-economy-diagnostic.ts`
- `scripts/lib/m8*.ts` (sonder)

## 4. M8A — Internationellt ungdomsintag: resultat

**Modell.**
- Den 1 juli kan en världspoolsklubb med lediga platser flytta upp 0, 1 eller 2 prospekt (35/50/15 %) till sin synliga trupp, aldrig över taket på 10.
- Potentialen dras triangulärt kring klubbens **uppmätta liganivå** − 6 (±28), med tak 190. Talangfördelningen skiljer sig alltså mellan länder därför att de uppmätta liganivåerna gör det, inte på grund av en handsatt tabell.
- CA = PA − mognadsgap (46/39/32 vid 18/19/20 år) ± 8.
- 85 % har klubbens nationalitet. Resten dras från nationaliteter som redan finns i ligan.
- Unika id:n (`intl-youth-<klubb>-<år>-<i>`) och deterministiska seeds.
- Prospekten utvecklas, åldras och pensioneras genom samma världsregler som alla andra.

**Resultat (20 säsonger, a/b/c):**

| Mått | a | b | c | baseline |
|---|---|---|---|---|
| Internationell population, start → max → S20 | 147 → 292 → 247 | 153 → 309 → 246 | 155 → 305 → 254 | 2 → 2 → 0 |
| Uppflyttade prospekt totalt | 294 | 286 | 303 | 0 |
| Prospekt som nått CA ≥ 130 (aktiva, S20) | 28 | 22 | 31 | 0 |

Intaget är självreglerande: 25–30 per år de första säsongerna, därefter 4–13 när trupperna är nära taket, och sedan åter upp mot 20–30 när pensioneringarna ökar. Volymen följer alltså pensioneringar och utflöde och blåser inte upp världen.

**Elitpotential.** Vid en elitliga (nivå 152) har cirka 13 % av prospekten PA ≥ 160. Vid nivå 100 har 0 % PA ≥ 150 (test).

## 5. M8B — Internationell rekrytering av kontrakterade spelare: resultat

**Regel (samma för alla säljare).** `internationalBuyerWants` kräver allt detta:
- synlighet (världspercentil ≥ 0,75 eller hemland) och spelarpassning (CA ≥ klubbnivå − 8)
- ålder högst 30
- att flytten är ett steg upp: köparens miljö är minst 4 högre än säljarens
- högst 2 spelare på samma position i den synliga truppen
- högst **1 köp per klubb och transfersäsong**

**Förlopp per bud.**
- Budet är marknadsvärde × 1,2, men högst klubbens kapacitet.
- Kapaciteten härleds ur klubbens nivå: marknadsvärdet för en nyckelspelare på 26 år med CA = klubbnivå + 10. Den är minst dubbelt så hög för den starkaste klubben som för den svagaste.
- Säljande klubb bedömer budet med samma `evaluateSellingClubDecision` som alla bud. Kontraktstid och roll påverkar via marknadsvärde och motstånd.
- Spelaren beslutar via PCDM med det lönekrav han ställer hos köparen.
- Vid köp sker en ägarflytt via `transferPlayerPermanently`, och övergångssumman betalas till den svenska säljaren.
- Managerns spelare ingår inte i köppasset. De får bud via `generateIncomingOffers`, där managern själv är säljande klubb, och med **samma** köparregel och kapacitet. Köpet räknas mot klubbens säsongskvot.

**Kalibrering.** Med 2 köp per säsong drog de tomma platserna vid karriärstart 61 svenska spelare utomlands under säsong 1 (sond 1), och nödläget blev 10,2 %. Taket sänktes därför till 1.

| 20 säsonger | a | b | c |
|---|---|---|---|
| Köpta från Sverige | 377 | 406 | 382 |
| Mellan internationella klubbar | 333 | 321 | 318 |
| Från utlandet till Sverige | 244 | 285 | 238 |
| Internationell andel av alla flyttar | 21,9 % | 23,0 % | 21,4 % |

Gidsel och Skipagøtu ger exempel: Gidsel flyttade från Füchse till Barcelona genom ett köp, och Skipagøtu spelade i Füchse till 34–35 års ålder.

## 6. M8C — Spelarnivåutredning av Division 1

**Metod.** `scripts/m8-div1-diagnostic.ts` körde koden före M8 med seed `tr-final-c` (den seed som tidigare gav flest fall) i 13 säsonger. Varje dag registrerades varje spelare som anslöt till en Division 1-klubb när han var elit (CA ≥ 140) och under 31. För varje fall loggades:
- identitet, ålder, CA och PA
- tidigare klubb, liga och miljönivå, och ny klubb
- kontrakt före och efter, samt klubbhistorik
- CPU-loggraderna som ledde till flytten
- PCDM-uppdelningen, utvärderad på föregående dags tillstånd
- marknadskontexten: vänteläge, stanna-alternativ och internationellt alternativ
- vilka starkare klubbar som hade accepterats (acceptans ≥ 0,5) och om de hade behov på positionen

Data: `C:\DEV\QA\reports\transfer-realism\m8\div1-diagnostic-tr-final-c.json` (18 fall).

**Klassificering:**

| Typ | Antal | Kännetecken |
|---|---|---|
| A. Byte mellan två Division 1-klubbar av en spelare som **utvecklats till elit där** | 9 | Feldt, Rudenström, Lundstad ×2, Ljungqvist ×2, E. Andersson, Pilman, Hallberg. Inga nedflyttningar, men det ursprungliga måttet räknar dem. |
| B. Verklig nedflyttning med kontrakt från Allsvenskan eller HBL | 8 | Bland annat Brattnäs (CA 153, 25 år, Allsvenskan → Sannadals SK för 300 €/mån), Djerf (CA 147), Sundström, Carrara, Flinck och E. Andersson. |
| C. Fri agent | 1 | Romero, CA 140, fri agent → Kristianstad (reservation: internationellt alternativ i nivå 132). |

**Orsak i typ B (samma i alla fall).**
- Spelarna hade utvecklats på frysta löner och tjänade 230–1 500 €/mån.
- PCDM jämförde pengar med den egna lönen, så 240 → 300 € lästes som +25 % (pengakomponent cirka +0,1).
- Stanna-alternativet låg också långt under spelarens nivå (miljö 137 mot CA 153). Det sportsliga avdraget skilde sig därför bara cirka 0,06 mellan stanna och Division 1, eftersom komponenten mättas.
- Flytten vann med marginaler på 0,005–0,03.
- Starkare klubbar fanns (14–39 med acceptans ≥ 0,5), men det var nästan bara världspoolsklubbar. Före M8B kunde de inte köpa kontrakterade spelare, och få svenska klubbar hade behov på positionen.

**Åtgärder.** Ingen hård regel infördes.
1. **Kalibrering av PCDM (belagd).** En kraftigt underbetald spelare väger pengar mot minst 75 % av sin marknadslön (`UNDERPAID_REFERENCE_FLOOR`).
   - Vid karriärstart påverkas ingen, eftersom alla kontrakt då ligger på marknadsnivå (kvot 1,00 i alla CA-band).
   - Regressionsfallet Adam Krantz (CA 134, underbetald) tackade ja till Division 1 för +25 % före ändringen, men inte efter. Testet fallerar utan ändringen.
2. **Rekryteringsvägen (M8B).** Utländska klubbar kan nu köpa sådana spelare.
3. **Mätningen.** Simuleringen rapporterar nu elitflyttar till Division 1 uppdelade på ursprung: högre liga, byte mellan två Division 1-klubbar och fri agent. Det ursprungliga kriteriet är oförändrat.

**Resultat (20 säsonger).**
- Elitflyttar till Division 1: **9 / 5 / 3** (a/b/c). Alla kom från högre liga. Byten mellan två Division 1-klubbar: 0. Från fri agent: 0.
- Jämförelse: M7 13/16/20 och baseline 79.
- Kriteriet ≤ 1 klaras ändå inte.
- Världsklass under 33 i Division 1: 0 / 1 / 0.

## 7. M8D — Åldrande och utveckling

**Utredning.**
- Tillväxten (`ageDevelopmentMultiplier`) avtar mjukt: 1,5 vid 16, 0,65 vid 28, 0,35 vid 31, 0,05 vid 40. Den har inte ändrats.
- Nedgången var den egentliga bristen: högst 3 attributpoäng per år, slumpmässigt valda, vilket ger cirka 0,5 CA per år.
- Pensioneringen styrs av en statisk truppnivå och kontraktsläget.
- Kontraktslängden var fast 3 år för CPU-värvningar.

**Ny modell (ingen abrupt straffgräns).**
- Varje attributfamilj har en egen jämn kurva för förväntad förlust per attribut och år:
  - fysik först (från cirka 28)
  - därefter försvar och teknik
  - spelförståelse, taktik och mentalt sist och minst
- Avrundningen sker per attribut med deterministisk sannolikhet.
- **Position:** ytter ×1,2 och mittsexa ×1,1 på fysik, mittsexa ×1,1 på försvar, mittnia ×0,9 på fysik och teknik. Målvakter behåller rabatten på 2,5 års effektiv ålder.
- **Individ:** livslång seedad takt (0,7–1,3) och starttidpunkt (±1,5 år), så alla spelare går inte ner vid samma ålder.
- **Uppmätt kurva** (snittförlust i CA per säsong):

  | Position | 29 | 31 | 34 | 36 | 38 | 40 |
  |---|---|---|---|---|---|---|
  | Bakåt (V9) | 0,3 | 1,0 | 2,9 | 4,5 | 6,2 | 7,9 |
  | Ytter (V6) | 0,3 | 1,1 | 3,2 | 4,8 | 6,7 | 8,5 |
  | Mittnia (M9) | 0,2 | 0,9 | 2,7 | 4,2 | 5,9 | 7,4 |
  | Målvakt (MV) | 0 | 0 | 1,0 | 2,2 | 3,9 | 5,8 |

  En CA-170-spelare på 30 år hamnar på cirka 140–160 vid 38 (test).
- **Pension:** från 30 år blir pension gradvis mer sannolik ju längre spelaren ligger under klubbens kärna (median-CA för klubbens 14 bästa), med en faktor mellan 0,75 och 1,6.
- **Kontrakt:** `contractYearsCapForAge` ger högst 4 år till och med 28, 3 år vid 29–30, 2 år vid 31–32 och 1 år från 33. Det gäller CPU-värvning, CPU-förlängning och internationell förlängning.

**Effekt i simuleringen:**

| | M8 (a/b/c) | baseline |
|---|---|---|
| CA-förändring per säsong, spelare 30+ som stannar (HBL) | −1,5 till −4,3 | ±0 |
| Median-CA för aktiva 36+ | 119–129 | 138–143 |
| Äldsta aktiva | 45 / 46 / 45 | 49 |
| Aktiva 38+, max under körningen | 109 / 109 / 111 | 218 |

## 8. M8E — Ligastyrkans utveckling

**Undersökta orsaker:**

| Kandidat | Fynd |
|---|---|
| Spelarutveckling | Spelare som stannar i både HBL och Allsvenskan blir 2–3 CA bättre per säsong. Under 24 år: +4–5. Miljöfaktorn per serie är liten med avsikt (1,08/1,0/0,94). |
| Åldrande | I baseline tappar 30+ ±0. HBL:s sju bästa per klubb åldras (70 % är 30+ vid S10), och veteraner behåller platser. **Åtgärdat i M8D.** |
| Internationell rekrytering | M8B exporterar 7–28 HBL-spelare per säsong. Det är realistiskt, men kräver att HBL kan fylla på underifrån. |
| Koncentration | Elitspelare samlas i lägre serier i baseline: Division 1 18 → 106 och Allsvenskan 25 → 90 på 10 säsonger. |
| Ligamedlemskap | Upp- och nedflyttning sker inte efter säsong 1 (se nedan). |
| Klubbekonomi | **Avgörande.** Diagnosen (`m8e-league-diagnostic-a.json`, S6) visar 10 av 13 HBL-klubbar pressade, transferbudget **0** för 11 och kassa −3 500 till −467 000 €. Allsvenskans 25 bästa spelare skulle tacka ja till 10–13 HBL-klubbar och rankas av dem, men **ingen** klubb har råd. |
| Beräkningen av ligastyrka | Ingen orsak. Både median-`ownLevelScore` och p90 visar samma inversion. |

**Varför HBL-klubbarna saknar pengar.** Det framgår av bokföringen (`economy-baseline-a.json` och `economy-m8-a.json`):
- Under säsong 1 bokar HBL-klubbarna cirka 170 000 € per klubb och år i matchdagsintäkter.
- Från säsong 2 är posten **0**, både i baseline och med M8.
- Allsvenskan och Division 1 behåller sin, eftersom de bokar en fast månadsrad (de har inget spelschema i världen).

Den huvudlösa simuleringen spelar inga matcher efter säsong 1, av två skäl:
1. **Harness-fel:** skriptet behandlar aldrig karriärens första dag (`gameDate` räknas upp innan första `processDay`). Två HBL-matcher den 19 augusti spelas därför aldrig, och säsongen blir aldrig klar. Managerns egna matcher spelas inte heller.
2. **Spelet självt:** även när harnessen rättas (sond `scripts/lib/m8eHarnessProbe.ts`) blir säsongen klar 2027-04-09, men `rolloverSeason` blockeras av `ADMINISTRATIVE_REVIEW_REQUIRED` och `NEXT_SEASON_RULES_UNVERIFIED` i `competition/transition/sweden2026.ts`. Det är avsiktligt i denna version: reglerna för 2027/28 är inte verifierade. I spelet stannar världen vid säsongsslut (`continueCareerRhythm` returnerar `SEASON_COMPLETE`).

**Slutsats.**
- Alla körningar på 20 säsonger, både tidigare och nya och även baseline, simulerar en värld med fryst kalender. Spelet kan inte i sig nå den världen.
- Inversionen beror främst på att HBL-klubbarna får intäktsbortfall och därmed inte kan köpa.
- Den förstärktes tidigare av att åldrandet saknades (åtgärdat) och förstärks nu av exporten, som är realistisk i sig.

**Ändringar.** Jag har inte gett HBL någon konstgjord bonus och inte ändrat ekonomin eller säsongsövergången, eftersom de ligger utanför transferområdet och uppdraget säger "implement only changes supported by the investigation". Åtgärden ägs av säsongsövergången (ägarbeslut, §14). Harness-felet (första dagen) är dokumenterat. Slutkörningarna använder samma harness som M7 och baseline för att kunna jämföras.

**Ligaordning i slutkörningarna:**
- HBL > Allsvenskan till och med S5 i a och b och till och med S7 i c. Därefter ligger Allsvenskan 1–8 över.
- Euro-elit > HBL varje säsong i b och c. I a gäller det alla säsonger utom S2 (137,2 mot 139,5), med god marginal därefter: 135–152 mot 121–139.
- Allsvenskan > Division 1 varje säsong.
- Baseline: inverterad från S12.

## 9. Resultat från tre seeds à 20 säsonger

### 9.1 Ursprungliga acceptanskriterier (oförändrade)

| Kriterium | a | b | c | baseline | M7 (a/b/c) |
|---|---|---|---|---|---|
| Världsklass < 33 i Div 1 = 0 | ✅ 0 | ❌ 1 | ✅ 0 | ❌ 17 | 0/1/1 |
| Elit < 31 till Div 1 ≤ 1 | ❌ 9 | ❌ 5 | ❌ 3 | ❌ 79 | 13/16/20 |
| Elitnedgraderingar ≤ 5 % | ✅ 0 % | ✅ 0 % | ✅ 0,1 % | ✅ 2,2 % | ✅ |
| Världspoolen förnyar | ✅ 1 212 | ✅ 1 279 | ✅ 1 205 | ❌ 0 | ✅ cirka 860 |
| Världsklass i Europa ≥ 60 % varje säsong | ❌ min 4 | ❌ min 7 | ❌ min 6 | ❌ min 0 | ❌ min 0–1 |
| Ligaordning varje säsong | ❌ | ❌ | ❌ | ❌ | ❌ |
| Svensk truppmedian ≥ 16 | ✅ 19 | ✅ 19 | ✅ 19 | ✅ 20 | ✅ |
| ≤ 2 svenska trupper < 14 | ❌ 5 | ❌ 4 | ❌ 5 | ✅ 1 | 2/3/2 |
| Nödläge ≤ 10 % | ✅ 7,4 % | ✅ 9,3 % | ✅ 9,6 % | ✅ 2,0 % | 5,3/7,1/8,3 % |
| Namngivna aldrig i Div 1 < 33 | ✅ | ✅ | ✅ | ❌ | ✅ |

Antal klarade kriterier:
- M8: 5/10 (a), 4/10 (b), 5/10 (c)
- M7: 6/10, 4/10, 5/10
- baseline: 4/10

### 9.2 Världsklass i Europa över tid (seed a)

| Säsong | 1 | 5 | 10 | 11 | 13 | 15 | 16 | 17 | 20 |
|---|---|---|---|---|---|---|---|---|---|
| Världsklass i Europa | 26 | 40 | 68 | 73 | 63 | 52 | 32 | 11 | 5 |
| Världsklass totalt | 39 | 42 | 70 | 75 | 66 | 55 | 39 | 19 | 11 |
| Elit totalt (CA ≥ 140) | 135 | 150 | 239 | – | 220 | 173 | – | 119 | 58 |

- Till och med S14–S15 ligger världsklassen i Europa långt **över** startvärdet (25), med en topp på 68–73 vid S10–S11. Det kriterium som M7 inte klarade (0 vid S20) håller alltså under 15 säsonger.
- Fallet efter S15 är **global**: världsklass totalt sjunker från 75 till 11, och HBL, Allsvenskan och Division 1 sjunker samtidigt. Det beror inte på flyttar.

### 9.3 Övriga mått (sammanfattning)

- **Fria agenter:** återanställningsgraden är 23,5–25,4 % (baseline 7,8 %). Poolen innehåller 213–228 spelare vid S20 (baseline 190).
- **Ekonomi:** pressade svenska klubbar max 25–28 (baseline 11). Medianen för svensk kassa vid S20 är 31 000–49 000 €.
- **Pensioneringar:** cirka 1 500 per körning, ungefär som baseline (1 523). Medianålder vid pension 33–34.
- **Gidsel:** Barcelona 28 år → kortvarigt fri agent vid 30 (a, b) → Füchse/Barcelona → Allsvenskan vid 37 → pension vid cirka 39. I seed b spelade han i Division 1 (Sannadal) vid 35 med CA 185, vilket är tillåtet enligt kriteriet (≥ 33).
- **Skipagøtu:** Füchse Berlin till 34 → Allsvenskan eller HBL vid 36 → pension 39 (a) eller fortsatt i HBL vid 39 (b, c).

### 9.4 Tolkning av fallet efter säsong 15

- Startvärlden består av realdata med en topp upp till CA 197.
- Ungdomsmodellerna producerar, i stationärt läge, färre spelare med CA ≥ 140 och ≥ 150. Svensk PA har tak 165 och 6,2 % ≥ 150. Internationella prospekt centreras på liganivå − 6.
- Utan åldrande syntes inte detta, eftersom startgenerationen aldrig gick ner. Baseline hade 318 elitspelare vid S13 genom inflation.
- Med åldrande pensioneras realdatagenerationen mellan cirka S13 och S18, och ersättarna når lägre nivåer.
- Fasta CA-trösklar (150 och 140) gör att detta syns som en kollaps i absoluta tal. Vid S20 är medianåldern låg i alla grupper (24–28), och de nya generationerna är yngre och sämre i absolut skala, inte frånvarande.
- Det är ett kalibreringsglapp mellan ungdomens potential och åldrandet. Rättelsen hör hemma i ungdomsmodellen och utvecklingsmodellen (ägarbeslut, §14). Jag har inte ändrat ungdomsmodellen eller trösklarna.

## 10. Jämförelse med ursprunglig baseline

| | baseline (`fa655477`) | M7 (`0f31ff0d`) | M8 |
|---|---|---|---|
| Internationell population S20 | 0 | 29 | 246–254 |
| Världsklass i Europa vid S10 | 0 | 26–31 | 68 |
| Elit < 31 till Div 1 (20 s) | 79 | 13–20 | 3–9 |
| Internationell andel av flyttar | 4,3 % | 14 % | 21–23 % |
| Aktiva 38+ (max) / äldsta | 218 / 49 | – / cirka 45 | 109–111 / 45–46 |
| Gidsel/Skipagøtu i Div 1 < 33 | Skipagøtu S1, S2, S7, S8 | aldrig | aldrig |
| Nödläge | 2,0 % | 5–8 % | 7–10 % |
| Trupper < 14 (max) | 1 | 2–3 | 4–5 |

Baseline kördes om med M8-skriptet (`m8/baseline/`) och gav exakt samma ursprungliga värden som förut (79, 17, …). Det bekräftar determinism och att de nya måtten är rent observerande.

## 11. Prestanda

| Körning | Total tid (20 säsonger) | Per säsong | Samtidiga körningar |
|---|---|---|---|
| M7, PCDM (`final-tr-final-a`) | 21 997 s | cirka 1 100 s | 4 |
| Baseline med M8-skript | 7 887 s | 394 s | 2–3 |
| **M8** a/b/c | 10 036 / 10 046 / 10 120 s | 502–506 s | 3 |

- Per säsong (seed a): 143 s vid S1, 509 s vid S10 och 742 s vid S20. Tiden växer med världens storlek, fler svenska trupper och historik.
- M8 är cirka 27 % långsammare per säsong än baseline men cirka 2× snabbare än M7-mätningen. Mätningarna störs av hur många körningar som går samtidigt.
- M8 lägger till cirka 250 utvecklade och åldrade spelare och ett köppass. Köppasset körs bara två dagar per månad i öppna fönster och använder en sorterad kandidatlista per pass med tidigt avbrott.
- Åldringskurvan beräknas bara för spelare från 28 år, en gång per år.

## 12. Testresultat

| Körning | Tester | Pass | Fail |
|---|---|---|---|
| Bas `fa655477` | 2 815 | 2 807 | 8 |
| M7 `0f31ff0d` | 2 831 | 2 824 | 7 |
| **M8 `9973d74a`** (`m8/tests-m8.log`) | **2 855** | **2 848** | **7** |

- **De 7 felen** är identiska med dem på bas-commiten (data och harness): Allsvenskan 284, HBL bio CA/PA, 265 HBL-id, populationsaudit 1191, bundlad HBL-data, season-0-checkpoint och identitetskollision. Ingen ny regression.
- **Nya tester:** 24 stycken, alla gröna, bland dem regressionsfallet för M8C som fallerar utan rättelsen.
- **Ändrad fixtur:** `cpuQualityUpgrade.test.ts` → `fullSquad` betalar nu den syntetiska truppen marknadslön för sin nivå. Tidigare kopierades en svagare mallspelares kontrakt, så CA-145-spelare hade fått en betydligt sämre spelares lön. Med M8C:s referenslön beskrev fixturen då en trupp som ville lämna, inte en stabil stark trupp. Inga assertioner har ändrats.
- **Bevarat och gröna:** alla PCDM-tester (paritet, reservationsnytta för fria agenter, sportsligt golv, internationella förlängningar, ägarskap, fönsterregler, sparfilskompatibilitet, determinism).

## 13. Sparfilskompatibilitet

- Nytt valfritt fält: `transferMarket.internationalPurchases?: { seasonKey, byClub }`. Saknas det betyder det 0 köp.
- Intaget återanvänder `youthIntakeClubYears`, nu även med världspoolens klubb-id. Nya spelare och kontrakt använder befintliga strukturer.
- Åldrandet och kontraktslängderna ändrar bara framtida beslut. Inga befintliga fält har ändrats, ingen migrering behövs och inga sparfiler skrivs om.
- Alpha-testarnas sparfiler och produktionsdata har inte rörts.

## 14. Kvarstående begränsningar och ägarbeslut

1. **Säsongsövergången är blockerad i denna version** (`NEXT_SEASON_RULES_UNVERIFIED`, `ADMINISTRATIVE_REVIEW_REQUIRED`). Långtidssimuleringar kan därför inte representera tävlingar, upp- och nedflyttning eller HBL:s matchdagsekonomi efter säsong 1. **Detta är det enskilt viktigaste ägarbeslutet.** Så länge övergången inte kan köras kan kriteriet för ligaordning inte bedömas meningsfullt.
2. **Harness-fel:** `transfer-realism-sim.ts` och diagnosskripten behandlar inte karriärens första dag och spelar inte managerns matcher. En rättning är prövad (`scripts/lib/m8eHarnessProbe.ts`) men inte införd, för att resultaten ska gå att jämföra med M7 och baseline. Bör införas tillsammans med punkt 1.
3. **Talangflöde mot åldrande:** i stationärt läge tappar världen elit efter cirka S15 (§9.4). Ungdomens potentialfördelning (svensk och internationell) bör kalibreras mot den nya åldringsmodellen, alternativt bör åldrandet mildras. Det är en avvägning för ägaren.
4. **Pensionering av 38–42-åringar med kontrakt** är fortfarande låg (max 109–111 aktiva 38+). Kontraktsfaktorn 0,15 och den statiska truppnivån i pensionsmodellen är oförändrade.
5. **Elit < 31 till Division 1:** 3–9 mot gränsen ≤ 1. Kvarvarande fall kommer från högre liga och sker oftast när HBL-klubbarna är i ekonomisk kris (punkt 1).
6. **Trupper < 14 och nödläge:** fler än i baseline (4–5 mot 1). Det beror på högre omsättning (export + import) i kombination med pressad svensk ekonomi.
7. **Världspoolens klubbar har ingen ekonomi.** Kapaciteten härleds ur nivå, och köptaket är 1 per säsong.
8. **Fiktiva namnpooler** per region är små, så dubbla fullständiga namn kan förekomma. Id:n är alltid unika.
9. **Gidsel blev kortvarigt fri agent vid 30** i två seeds. Världspoolens förlängning av en världsstjärna kan misslyckas när klubbens lönetak (1,1×) understiger kravet. Han valde ändå en utländsk klubb igen.

**Final HEAD och worktree-status:** se rapport-commiten. Inget pushat. Den temporära baseline-worktreen `C:\DEV\WORKTREES\handball-manager\transfer-realism-baseline` finns kvar (används av baseline-körningarna) och tas bort först efter godkännande.
