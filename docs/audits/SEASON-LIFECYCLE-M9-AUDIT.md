# M9 — Season Lifecycle Audit (endast läsning)

- **Branch:** `work/transfer-realism-pcdm`
- **HEAD:** `2bd03b68` (M8-rapporten, bevarad). Ingen kod är ändrad och inga commits är gjorda. Den här filen är otrackad.
- **Underlag:**
  - Kodläsning.
  - En skrivskyddad sond som spelar en hel säsong med verkligt karriärflöde, på samma sätt som `scripts/qa-advance-career.ts`: `continueCareerRhythm` + `playManagerFixtureLegacy`, med IFK Skövde som manager och seed `m9-probe`. Den tog cirka 2 minuter och ligger i scratchpad, utanför repot.
  - De befintliga testerna `seasonRollover.test.ts`, `transition.test.ts` och `season.test.ts`: 52/52 gröna.

## Sammanfattning

Spelet har i dag **två system för säsongsslut**, och de är inte kopplade till varandra:

1. **Den levande säsongsmotorn** (`competition/season.ts`, HM-ALPHA3-M03) **fungerar**. I sonden spelades hela säsongen för båda serierna: 182 + 182 ligamatcher, 30 SM-slutspelsmatcher, 13 + 6 kvalmatcher och 76 cupmatcher. Fasen nådde `COMPLETE` den 13 maj, och motorn räknade fram `seasonOutcome.nextMembership` med 6 uppflyttade och 6 nedflyttade lag. Kvalet till HBL spelades fullt ut: Tyresö, Tumba och H43 slog Lugi, OV Helsingborg och Skånela.
2. **Den atomiska säsongsövergången** (`career/seasonTransition.ts`, M1.2D, commit `c7581a80` den 7 november) **ersatte** den gamla `rolloverSeason`, som tillämpade `nextMembership` direkt. Den nya övergången är designad som en **planerare för officiella regler**:
   - Den godtar bara bevisat underlag: licenser, kvalresultat, distriktslag och gruppindelning.
   - Den förkastar uttryckligen den levande motorns resultat ("legacy `seasonOutcome.nextMembership` ... do not authorize movement").
   - Det levererade regelpaketet för 2026/27 har fyra **permanenta begränsningar** som alltid blockerar.

   Knappen i gränssnittet anropar `attemptSeasonTransition(career)` utan underlag. **Ingen karriär kan därför nå säsong 2.**

**Grundorsaken är alltså inte ett fel i en beräkning.** Det saknas en **koppling från karriärens egen spelade säsong till planerarens underlag**, och det saknas ett **regelpaket för spelläget**. Byggstenarna finns och är testade: `seasonTransition.fixtures.ts` visar ett komplett APPLIED-utfall över två säsonger med en syntetisk sluten tvåseriemodell.

## 1. Befintlig arkitektur och flöde

| # | Steg | Var | Status |
|---|---|---|---|
| 1 | Säsongens sista match | `dailyTick.processDay` → `simulateAiFixturesForDate`; managerns match via matchdag (`productionMatch` / `legacy/matchday`) | Fungerar |
| 2 | Slutliga tabeller och resultat | `competition/tables.ts` (`competitionTable`), `standings.ts`; planeraren bygger egna tabeller i `transition/careerSnapshot.ts` | Fungerar |
| 3 | Slutspel och kval | `season.ts`: `startPostseason` (QF/SF/F, `KVAL_HBL` 11–13 mot 4–2, `KVAL_ALLSV` 11–12 mot Division 1), `settleTies`, `finalizeSeason` (pris, utmärkelser, `phase COMPLETE`) | Fungerar |
| 4 | Säsongen klar | `calendar.checkSeasonComplete`: inga ospelade ligamatcher och `seasonOutcome.phase === COMPLETE` → `seasonComplete = true`; `closeManagerSeason` (styrelsen) | Fungerar |
| 5 | Administrativ granskning | `seasonTransition.attemptSeasonTransition` → `careerSnapshot` → `preview.previewSeasonTransition` → `planner.planCompetitionTransition` | **Blockerar alltid** |
| 6 | Upp- och nedflyttning | Planerarens `claims` (DIRECT/QUALIFY/RETAIN) → `membership` | Når aldrig hit |
| 7 | Nya serietillhörigheter | `state.competitionMembership` (läses av `competitionMembership.clubCompetitionId`) | Mekanismen finns |
| 8 | Ekonomisk avräkning | Månadsbokföring (`economy/ledger.ts`) löper vidare; `tierRevenueFactor` (×1,35 upp, ×0,72 ned) läser medlemskapet; priser i `finalizeSeason`; budgetar ur intäkter | Fungerar automatiskt vid nytt medlemskap |
| 9 | Kontrakt och övergångar | Dagligt flöde (utgång 31 maj, CPU-förlängning och -rekrytering, internationell marknad); övergången behåller kontrakt, registreringar och betyg | Fungerar |
| 10 | Nytt spelschema och ny säsong | `seasonCalendar.buildNewSeasonCalendar` (dubbelmöte via `generateDoubleRoundRobin`, landslagsuppehåll); cupen via `ensureSeasonCalendar` dag 1; ny `seasonId`, `competitionId`, nollställd statistik, `seasonHistory` med tabeller, kvalserier och kvitto | Finns och är testat med syntetiskt paket |

## 2. Grundorsaker till de två spärrarna

Sonden gav följande spärrar vid säsongsslut:

| Kod | Antal |
|---|---|
| `QUALIFICATION_RESULT_UNKNOWN` | 15 |
| `CLUB_DESTINATION_UNRESOLVED` | 12 |
| `MISSING_EXTERNAL_ENTRANT` | 12 |
| `PRIOR_ENTRY_UNRESOLVED` | 7 |
| `UNKNOWN_ELIGIBILITY` | 4 |
| `HOME_PRIORITY_UNVERIFIED` | 3 |
| `REPLACEMENT_SLOT_UNRESOLVED` | 3 |
| `UPSTREAM_QUALIFICATION_BLOCKED` | 3 |
| `MISSING_STANDINGS` | 2 |
| `ADMINISTRATIVE_REVIEW_REQUIRED` | 1 |
| `OFFICIAL_CALENDAR_UNVERIFIED` | 1 |
| `TERMINAL_DECIDER_UNVERIFIED` | 1 |
| `NEXT_SEASON_RULES_UNVERIFIED` | 1 |
| `GROUP_ALLOCATION_REQUIRED` | 1 |
| `NEXT_SEASON_PROFILE_REQUIRED` | 1 |

### 2.1 `ADMINISTRATIVE_REVIEW_REQUIRED`

- **Var den skapas:**
  - `competition/transition/sweden2026.ts:74`, posten finns i `SWEDISH_2026_RULES.limitations`.
  - Den skickas ut ovillkorligt i `planner.ts:267` (`for (const limitation of r.limitations) issue(...)`).
  - Den skickas ut igen som BLOCKED i `seasonTransition.ts:94` för nästa säsongs paket (`for (const limitation of nextRules.limitations) fail(...)`).
- **Villkor:** inget. Den är en **permanent begränsning i regelpaketet**, liksom `OFFICIAL_CALENDAR_UNVERIFIED`, `TERMINAL_DECIDER_UNVERIFIED` och `NEXT_SEASON_RULES_UNVERIFIED`. Enligt `SEASON-TRANSITION.md` "Permanent rule-package limitations require a newly reviewed package; missing evidence alone cannot clear them." Alla begränsningar gör att `proposal.status` aldrig blir READY, och då blir `canGenerateNextSeason` alltid false.
- **Vad som saknas:** ett regelpaket där spelet självt är arrangör. Spelets egen simulerade säsong ska då räknas som avgörande, utan licensöverklaganden, återbud eller avbrott.
- **Finns det redan?** Ja, som mönster. `syntheticClosedRules()` i `seasonTransition.fixtures.ts` är ett paket med `limitations: []`. Det används bara i tester och `npm run competition:rollover-example`.
- **Minsta säkra korrigering:** ett separat **karriärpaket** (till exempel `SWEDISH_CAREER_RULES`) med `limitations: []`, härlett ur `SWEDISH_2026_RULES`. Det officiella paketet lämnas orört, så att planeraren fortsatt kan användas för verkliga regelbevis.

### 2.2 `CLUB_DESTINATION_UNRESOLVED`

- **Var den skapas:** `planner.ts:273`. Varje klubb i en källtabell som saknar ett bekräftat slutmål (claim) får spärren.
- **Villkor:** en klubb blir utan slutmål när dess regelpost eller kvalgren inte går att lösa upp. I sonden gällde det 12 klubbar:

  | Klubbar | Orsak | Saknat underlag |
  |---|---|---|
  | HBL 11–13 (Lugi, OVH, Skånela) | `UNKNOWN_ELIGIBILITY` + `QUALIFICATION_RESULT_UNKNOWN` (hbl-11/12/13) | `evidence.eligibility` och `evidence.qualificationFixtures`. **Kvalet spelades i karriären**, men adaptern (`careerSnapshot.ts`) läser medvetet inte `competitionTies`. |
  | Allsvenskan 1 (Västerås) | `UNKNOWN_ELIGIBILITY` (licens för tier 1) | `eligibility` |
  | Allsvenskan 2–4 | `PRIOR_ENTRY_UNRESOLVED`: uppåtplatserna delar markör och väntar på plats 1 | Följer av punkten ovan |
  | Allsvenskan 5–7 | `REPLACEMENT_SLOT_UNRESOLVED`: en ersättning uppåt kan konsumera platsen | Följer av punkten ovan |
  | Allsvenskan 11–12 | ha-final-11/12 är beroende av ha-semi, som är beroende av Division 1:s tabeller | Division 1 spelas inte som serie (`MISSING_STANDINGS` ×2, `HOME_PRIORITY_UNVERIFIED`) |
  | Division 1 (alla) | Ingen källtabell | Division 1 simuleras inte (antagande i `rules.ts`: "promoted clubs ... ranked by squad strength"). Division 2-portar (`MISSING_EXTERNAL_ENTRANT` ×12) finns inte i spelet. |

- **Finns det redan?** Delvis. Kvalserierna spelas och har exakt den verifierade hemmaordningen: levande `KVAL_HBL` är `LOW, HIGH, HIGH, LOW, HIGH`, vilket motsvarar planerarens `homeOrder [1,0,0,1,0]` med Allsvenskan-laget som andra deltagare. Paren är desamma (11–4, 12–3, 13–2). Resultaten med förlängning eller straffar ligger i `FastMatchResult.decider`. Det som saknas är bara **översättningen** från `competitionTies` och `results` till `QualificationFixture[]`.
- **Minsta säkra korrigering:**
  1. En **adapter för karriärunderlag** som bygger `SeasonTransitionRequest` ur den spelade säsongen:
     - `eligibility` = ELIGIBLE för alla klubbar, eftersom spelet saknar licensmodell (ägarbeslut).
     - `qualificationFixtures` ur `KVAL_HBL`-serierna, med `origin: 'CAREER_SIMULATED'` och deciders.
     - `nextSeason` ur karriärpaketet med avspark härledd i spelet.
  2. Ett karriärpaket som **stänger nedre gränsen** tills Division 1 simuleras på riktigt (se §6).

### 2.3 Övriga spärrar i spelflödet

- `NEXT_SEASON_PROFILE_REQUIRED`: knappen skickar ingen `nextSeason`.
- `MISSING_STANDINGS`, `MISSING_EXTERNAL_ENTRANT`, `GROUP_ALLOCATION_REQUIRED`, `HOME_PRIORITY_UNVERIFIED` och `d1-*`/`ha-*`: Division 1 och Division 2 är inte modellerade som serier.
- `UNPLAYED_COMPETITIVE_FIXTURE`: syntes inte i sonden (0 ospelade), eftersom avgjorda serier tar bort sina ospelade matcher.

## 3. Saknade funktioner

1. **Regelpaket för spelläget** utan permanenta begränsningar, med samma verifierade utbyte mellan HBL och Allsvenskan.
2. **Adapter för karriärunderlag** som bygger licens, kvalmatcher och nästa säsongs profil ur den spelade säsongen.
3. **Nästa säsongs profil i spelet:** paket för `seasonId + 1` och en avsparksregel. Den gamla övergången använde `${year}-09-20`. Den verkliga avsparken 2026/27 var 23 september. Den måste ligga efter `gameDate` enligt `INVALID_NEXT_CALENDAR`.
4. **Koppling i gränssnittet:** `app/career/page.tsx` `startNextSeason` anropar övergången utan underlag.
5. **Division 1 som spelad serie.** Den behövs inte för M9:s acceptans, men behövs för att Allsvenskan ↔ Division 1 ska kunna gå genom planeraren utan att kvaliteten avgör.
6. **Historikkomprimering försvann:** den gamla övergången anropade `compactCareerHistory` (`historyCompaction.ts`), men den nya gör det inte. Funktionen anropas i dag ingenstans, så långa karriärer kommer att växa.
7. **Balansering av Division 1-grupperna** (`balanceDivisionOne` i den gamla övergången) saknas. Den blir aktuell först med punkt 5.

## 4. Berörda filer och moduler

| Område | Filer |
|---|---|
| Övergång | `lib/career/seasonTransition.ts`, `lib/career/seasonRollover.ts`, `lib/career/SEASON-TRANSITION.md`, `lib/career/seasonTransition.fixtures.ts` (mönster) |
| Planerare | `lib/competition/transition/{planner,preview,careerSnapshot,sweden2026,types,validation,qualificationFixtures,ranking}.ts` |
| Levande säsong | `lib/competition/{season,rules,seasonCalendar,tables}.ts`, `lib/career/calendar.ts` (`checkSeasonComplete`), `lib/career/dailyTick.ts` |
| Medlemskap | `lib/career/competitionMembership.ts`, `career/types.ts` (`competitionMembership`, `seasonOutcome`, `lastSeasonTransition`, `seasonHistory`) |
| Ekonomi | `lib/economy/clubEconomyIntegration.ts` (`economicTier`, `tierRevenueFactor`, budgetar), `lib/economy/ledger.ts` (matchdag per hemmamatch) |
| Gränssnitt | `app/career/page.tsx` (`startNextSeason`, visar spärrarna) |
| Historik | `lib/career/historyCompaction.ts` (oanvänd), `lib/manager/managerCareer.ts` (`recordSeasonQuietly`) |

## 5. Beroenden till andra system

- **Ekonomi:** intäktsnivån följer medlemskapet automatiskt. Matchdagsintäkten bokas per hemmamatch i det egna spelschemat. Utan nytt spelschema blir den 0 (se M8-rapporten §8). Det löses av en fungerande övergång.
- **Transfermarknaden och PCDM:** `sportingStrength` läser `clubCompetitionId`, och den utjämnade ligastyrkan rullar den 1 juli. Ingen ändring behövs.
- **Styrelse och manager:** `closeManagerSeason` på säsongens sista dag och `recordSeasonQuietly` i övergången.
- **Kontrakt, utveckling, åldrande och ungdomsintag:** dagligt flöde, oberoende av övergången (1 juli intag, 15 juni livscykel, 31 maj kontraktsutgång).
- **Cupen:** skapas av `ensureSeasonCalendar` när den nya säsongen inte har börjat.
- **Simuleringsharnessen** (`transfer-realism-sim.ts`): hoppar över första dagen och spelar inte managerns matcher (M8 §8). Den måste rättas för att simulera flera säsonger.

## 6. Minsta rekommenderade implementation

**Steg A, utbytet HBL ↔ Allsvenskan genom den befintliga planeraren.** Ingen ny seriemodell behövs.

1. `competition/transition/careerRules.ts` (nytt): `careerRules(seasonYear)` härleds ur `SWEDISH_2026_RULES`.
   - Familjerna och serierna HBL och Allsvenskan, med samma poster och samma `hbl-11/12/13`-steg.
   - `limitations: []`.
   - Nedre gräns, **valet ligger hos ägaren**:
     - Antingen (a) en sluten gräns där Allsvenskan 11–14 behåller platsen, som i `syntheticClosedRules`. Det är det enklaste alternativet men innebär en tillfällig regression: dagens levande motor flyttar Allsvenskan ↔ Division 1 utifrån truppstyrka.
     - Eller (b) att den levande motorns val för Allsvenskan ↔ Division 1 tas in som uttryckligt underlag för en icke simulerad serie. Det går emot planerarens princip om att kvalitet inte får avgöra.
2. `career/careerTransitionEvidence.ts` (nytt): `buildCareerTransitionRequest(state)`, som bygger:
   - `eligibility`: ELIGIBLE för alla klubbar i tabellerna mot alla familjer, med underlaget "spelläge: ingen licensmodell".
   - `qualificationFixtures` ur `competitionTies` där `stage === 'KVAL_HBL'`: `stageId hbl-<HBL-plats>`, `game` = `fixture.stage.game`, resultat ur `state.results` och `decider` ur `FastMatchResult.decider`.
   - `nextSeason`: `careerRules(year + 1)`, avspark enligt avsparksregeln (ägarbeslut: fast `YYYY-09-20` som tidigare, eller härledd) och underlaget "karriärgenererad profil".
3. `app/career/page.tsx`: `attemptSeasonTransition(career, buildCareerTransitionRequest(career))`.
4. `attemptSeasonTransition`: anropa `compactCareerHistory` på den godkända kandidaten, som den gamla övergången gjorde.

Den officiella planeraren och `SWEDISH_2026_RULES` ändras inte. Valideringen (storlekar, unika matcher, dubbelmöte, kvitto och idempotens) gäller oförändrat.

**Steg B, Division 1 som spelad serie (separat milstolpe):**
- `buildNewSeasonCalendar` med Division 1-grupperna bland de berörda serierna. Den kan redan generera godtyckliga serier.
- Simulering av AI-matcher ingår redan i det dagliga flödet.
- Karriärpaketet med Division 1 och sluten gräns mot Division 2: Division 1 11–12 behåller platsen.
- Gruppindelning: deterministisk regel, till exempel den gamla `balanceDivisionOne` med geografi.
- Allsvenskan ↔ Division 1 går då genom planeraren med riktiga tabeller.

## 7. Risker för befintliga karriärer och sparfiler

| Risk | Bedömning |
|---|---|
| Sparfiler som står på `seasonComplete` med blockerad övergång | Kan gå vidare efter steg A. Övergången är ren och idempotent (kvitto) och kräver ingen schemaändring enligt `SEASON-TRANSITION.md`. |
| Äldre sparfiler som gick in mitt i en säsong och bara har den egna serien (`ensureSeasonCalendar` lägger bara till den andra serien före start) | Planeraren får `MISSING_STANDINGS` för Allsvenskan. Kräver en fallback: sluten gräns eller "behåll medlemskapet" för serier utan spelschema. Annars är de fortsatt låsta. |
| Karriärer där managern har åkt ned till Division 1 (gamla övergången tillät det) | Managerns serie måste finnas i paketet (`MANAGER_DESTINATION_MISSING`, `UNCOVERED_COMPETITION`). Med steg A och sluten gräns blockeras de, så steg B behövs för dem. |
| `seasonOutcome.nextMembership` och planerarens val skiljer sig åt | Det kan förvirra gränssnittet (säsongsvyn visar den levande motorns utfall). Steg A ska visa planerarens utfall, eller båda om de är lika. Utbytet HBL ↔ Allsvenskan blir identiskt med samma kvalresultat. |
| Historiken växer | Komprimeringen saknas i dag, så den bör återinföras i steg A. |
| Ekonomin vid ligabyte | Fungerar via `tierRevenueFactor`. En uppflyttad klubbs lönebudget ökar ×1,35. |
| Alpha-sparfiler och produktionsdata | Ingen migrering behövs. Inga sparfiler skrivs om. Övergången sker bara på användarens knapptryck. |

## 8. Konkret tvåsäsongstest med acceptanskriterier

**Testdata, riktad och utan hela världen:**
- Bygg vidare på `seasonTransition.fixtures.ts`: `createNewCareerState` med bara HBL och Allsvenskan och `buildNewSeasonCalendar(state, '2026-09-20', [HBL, ALLSV])`.
- Resultaten sätts deterministiskt, som i `completeSyntheticSeason`, så att tabellerna blir kända:
  - Allsvenskan-laget X slutar **1:a** och går direkt upp.
  - HBL-laget Y slutar **14:e** och går direkt ned.
  - HBL 11–13 möter Allsvenskan 4–2 i **riktiga kvalmatcher** med de levande `KVAL_HBL`-serierna, och de högre seedade lagen vinner.
- Kvalmatcherna läggs in via `competitionTies` med motorns egna `tieFixtures` eller med fasta resultat, så att adaptern prövas.
- Managern placeras i ett av de berörda lagen (X eller Y) för att pröva människosidan, och i ett neutralt lag i en andra variant.

**Säsong 1, efter övergången:**

| # | Kriterium |
|---|---|
| S1-1 | `attemptSeasonTransition(state, buildCareerTransitionRequest(state)).status === 'APPLIED'` |
| S1-2 | `competitionMembership[X] === HBL` och `competitionMembership[Y] === ALLSV`; kvalförlorarna och kvalvinnarna enligt seriernas resultat |
| S1-3 | Exakt 14 klubbar per serie; inga dubbletter; varje klubb har exakt en serie |
| S1-4 | `seasonHistory` har en post med båda sluttabellerna, kvalserierna, `outcome.promoted ⊇ {X}` och `relegated ⊇ {Y}`; kvittot har `fromSeasonId` 2026/27 och `toSeasonId` 2027/28 |
| S1-5 | Ett nytt försök med samma begäran ger `ALREADY_APPLIED`; utan underlag `BLOCKED` med oförändrat tillstånd |
| S1-6 | Trupper, kontrakt och betyg är oförändrade för X och Y (samma spelar-id, samma `contract.clubId`) |

**Säsong 2:**

| # | Kriterium |
|---|---|
| S2-1 | HBL har 14 × 13 = 182 ligamatcher med fräscha id:n; X förekommer i 26 HBL-matcher och i 0 Allsvenskan-matcher; Y omvänt |
| S2-2 | Alla matcher ligger efter avspark; inga id:n från säsong 1 återanvänds |
| S2-3 | `getLiveStandings` och `competitionTable(state, HBL)` innehåller X men inte Y, och för Allsvenskan omvänt |
| S2-4 | Ekonomi: `tierRevenueFactor(X) ≈ 1,35` och `tierRevenueFactor(Y) ≈ 0,72`; HBL-klubbarnas matchdagsintäkt bokas efter första hemmamatchen (> 0) |
| S2-5 | Inga gamla medlemskap lever kvar: `clubCompetitionId`, `competitionClubIds`, `seasonOutcome` för 2027/28 och CPU-rekryteringens ligagrupp (`sportingStrength.clubLeagueId`) pekar på de nya serierna |
| S2-6 | Den andra övergången, från säsong 2 till 3, går också till APPLIED med samma adapter |

**Regressionstester:** `seasonRollover.test.ts`, `transition.test.ts`, `season.test.ts`, `m10SaveIntegrity.test.ts`, `alpha3SaveCompatibility.test.ts`, `productionMatch.test.ts`, ekonomitester för ligabyte, samt hela testsviten (7 kända fel ska vara oförändrade).

**Reproducerbarhet:** ingen simulering av hela världen behövs. Ett integrationstest över två säsonger med det verkliga flödet (som sonden) kan dessutom köras på cirka 2 minuter per säsong: Svensk värld, `continueCareerRhythm`, matchdag och övergång. Det håller sig inom gränsen 2–5 säsonger.

## 9. Rekommenderad implementationsordning

1. **Regelpaket för spelläget**, med enhetstester för planeraren: READY och korrekta direkta flyttar och kvalflyttar med fullt underlag.
2. **Adapter för karriärunderlag**, med enhetstester: kvalserier till `QualificationFixture` med hemmaordning och decider, licens och nästa säsongs profil.
3. **Koppling i gränssnittet och historikkomprimering**, med integrationstest för tvåsäsongsscenariot i §8.
4. **Fallback för äldre sparfiler** som bara har en serie, med test för sparfilskompatibilitet.
5. **Rättning av simuleringsharnessen** (första dagen, managerns matcher, övergång vid säsongsslut), därefter körning på 2–3 säsonger.
6. **Steg B, Division 1 som spelad serie**, som separat milstolpe.

## Rekommendation

**Implementera först steg 1–3: ett karriärpaket och en adapter som för in den levande säsongens egna resultat i den befintliga, testade planeraren, med utbytet HBL ↔ Allsvenskan och en sluten nedre gräns tills vidare.** Det är den minsta säkra vägen:

- Inget nytt seriesystem.
- Den officiella planeraren och dess regelbevis förblir orörda.
- Samma validering och idempotens används.
- Det låser upp säsong 2 för alla karriärer i HBL och Allsvenskan.

**Ägarbeslut före start:**
1. Nedre gränsen i steg A: sluten (enklast, tillfälligt utan Allsvenskan ↔ Division 1) eller den levande motorns kvalitetsval som uttryckligt underlag.
2. Avsparksregel för nästa säsong: fast 20 september eller härledd.
3. Om licensbeslut ska vara automatiskt ELIGIBLE i spelläget.
