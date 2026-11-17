# M9 — Season Lifecycle: slutrapport

- **Branch:** `work/transfer-realism-pcdm`. Utgångspunkt `2bd03b68` (M8), som är bevarad.
- **Commits:**

  | Commit | Milstolpe |
  |---|---|
  | `621c5f54` | M9A |
  | `983afdc5` | M9B + M9C |
  | `1d3f3e68` | M9D |
  | `7e4ce408` | M9E |
  | `906566ef` | M9E + M9F, tester |
  | `4c321ba3` | M9G |

  Ovanpå dem ligger en rapport-commit (se `git log`).
- **Inget är pushat, mergat eller deployat.** Inga andra worktrees, Alpha-sparfiler eller produktionsdata har rörts.
- **Ägarbeslut D1–D3** är tillämpade som de låstes.

## Definition of done

| # | Krav | Status | Belägg |
|---|---|---|---|
| 1 | En komplett säsong i HBL och Allsvenskan kan avslutas | ✅ | M9G: 182 + 182 ligamatcher, SM-slutspel, kval och cup; `phase COMPLETE`; 0 ospelade |
| 2 | De faktiska sportsliga resultaten går in i den atomiska planeraren | ✅ | M9G: planerarens medlemskap = den levande motorns `nextMembership` för varje klubb i HBL och Allsvenskan |
| 3 | Upp- och nedflyttning fungerar åt båda hållen | ✅ | Riktade tester med kvalutfall åt båda håll; M9G: Tyresö (direkt) och Kroppskultur (kval) upp, Lugi (direkt) och Önnered (kval) ned |
| 4 | Alla aktiva klubbar har giltig destination | ✅ | 0 `CLUB_DESTINATION_UNRESOLVED`; 14 + 14 klubbar; ingen förlorad eller dubblerad; Division 1 orörd |
| 5 | Säsongsövergången är atomisk | ✅ | Blockerade försök returnerar exakt samma objekt; ett fel i adaptern ger ett återställbart BLOCKED |
| 6 | Den ekonomiska övergången fungerar | ✅ | Nivåfaktor ×1,35 upp och ×0,72 ned på sponsor- och mediaintäkter (uppmätt i M9G); matchdagsintäkt > 0 för alla 28 klubbar i säsong 2 |
| 7 | Nästa säsongs spelschema genereras | ✅ | 182 + 182 nya matcher, alla efter avspark, inga återanvända id:n |
| 8 | Säsong 2 startar och kan spelas | ✅ | M9G: säsong 2 spelas klart, och övergången till 2028/29 är också APPLIED |
| 9 | Befintliga sparfiler fungerar | ✅ | JSON- och migreringsrundtur, sparfiler utan kvitto, äldre säsonger med en serie, och drift som ger explicit block |
| 10 | Historikkomprimering fungerar | ✅ | Återinförd; testad vid övergång och idempotent (befintligt M10-test) |
| 11 | Det kompletta tvåsäsongstestet passerar | ✅ | `seasonLifecycle.integration.test.ts`, cirka 6 minuter |

## 1. Ursprunglig grundorsak

Den levande säsongsmotorn (`competition/season.ts`) spelade hela säsongen och räknade fram upp- och nedflyttning. Den atomiska övergången (`seasonTransition.ts`, M1.2D) ersatte den gamla övergången, men den godtar bara uttryckligt underlag. Det officiella paketet `SWEDISH_2026_RULES` har dessutom fyra permanenta begränsningar, bland andra `ADMINISTRATIVE_REVIEW_REQUIRED`.

Knappen skickade inget underlag och inget paket som spelet kunde uppfylla. Följderna var:
- 73 spärrar av 15 olika slag, bland dem 12 × `CLUB_DESTINATION_UNRESOLVED`.
- Ingen karriär kunde nå säsong 2.
- Simuleringar över flera säsonger kördes med fryst kalender (M8 §8).

Se `SEASON-LIFECYCLE-M9-AUDIT.md`.

## 2. Arkitektur och integration

```
completed career season (live engine: tables, SM-slutspel, KVAL_HBL, cup)
        │
        ▼
career/careerTransitionEvidence.ts           (M9B, nytt)
  managerModePackageOptions(state)  → vilket paket säsongen faktiskt motiverar
  managerModeRules(year, options)   → competition/transition/careerRules.ts (M9A, nytt)
  standings  : careerSnapshot (karriärens egna resultat) + live-tabellens ordning som ruling vid lika
  kval       : KVAL_HBL-serierna match för match (hemma/borta, mål inkl. förlängning, straffavgörande)
  licenser   : managerModeLicence() → ELIGIBLE (D3, utbyggbar krok)
  nästa säsong: managerModeRules(year+1) + deriveNextKickoffDate() (D2)
        │
        ▼
career/seasonTransition.ts attemptSeasonTransition (oförändrad validering)
  + compactCareerHistory på kandidaten (M9E)
        │
        ▼
APPLIED: medlemskap, arkiv, kvitto, nytt spelschema   |   BLOCKED: exakt samma karriär + beroenden
```

- **Ingen andra algoritm.** Planeraren bygger tabellerna ur karriärens egna resultat. Där klubbar har lika poäng, målskillnad och gjorda mål används den levande tabellens ordning (inbördes möten och seedad lottning) som `ORGANIZER_RULING`. Det är samma ordning som den levande motorn lottade kvalet efter.
- **Kvalet** läses direkt ur `competitionTies`: paren K1–K3 svarar mot `hbl-11/12/13` med samma hemmaordning (LOW, HIGH, HIGH, LOW, HIGH = `[1,0,0,1,0]`). Förlängningsmål ingår redan i resultatet, och ett avgörande skickas bara med vid lika ställning efter straffar. Planeraren avvisar ett avgörande vid ojämn ställning.
- **Inmatning:**
  - `app/career/page.tsx` → `transitionCareerSeason(career)`.
  - Skript-API: `rolloverCareerSeason` (`qa-advance-career.ts`).
  - `rolloverSeason` och standardanropet `attemptSeasonTransition(career)` är oförändrade, alltså det officiella paketet och samma tester.

## 3. Ändrade filer

| Fil | Ändring |
|---|---|
| `lib/competition/transition/careerRules.ts` (ny) | Paket för managerläget med `frozen`- och `closedLeagues`-varianter |
| `lib/competition/transition/types.ts` | Valfri `authority` (`OFFICIAL`/`MANAGER_MODE`) |
| `lib/career/careerTransitionEvidence.ts` (ny) | Adapter för underlag, licenskrok, avsparksregel, `transitionCareerSeason`, `rolloverCareerSeason` |
| `lib/career/seasonTransition.ts` | Anropar `compactCareerHistory` på kandidaten |
| `lib/competition/rules.ts` | `ALLSVENSKAN_DIVISION1_BOUNDARY = "CLOSED"` och ny antagandetext |
| `lib/competition/season.ts` | Inga Division 1-kval och inga kvalitetsbaserade Division 1-flyttar när gränsen är stängd |
| `app/career/page.tsx` | Knappen använder managerläget |
| `app/career/season/page.tsx` | Inga nedflyttningszoner i Allsvenskan när gränsen är stängd |
| `scripts/qa-advance-career.ts` | `rolloverCareerSeason` |
| `lib/career/seasonTransition.fixtures.ts` | `withSyntheticLiveKval` (kval i den levande motorns format) |
| Tester (nya) | `careerSeasonTransition.test.ts` (8), `careerSeasonLegacy.test.ts` (4), `seasonLifecycle.integration.test.ts` (1, tvåsäsongstestet) |
| `scripts/game-test-files.json` | De tre nya testfilerna |

## 4. Regelpaketet (beslut)

- `authority: "MANAGER_MODE"`, id `manager-mode-se-men-hbl-allsvenskan-<säsong>`, `limitations: []`. Det officiella `SWEDISH_2026_RULES` är oförändrat och har fortfarande sina fyra begränsningar (test).
- **D1:**
  - Utbytet mellan HBL och Allsvenskan är exakt det verifierade: HBL 14 går direkt ned, Allsvenskan 1 går direkt upp (licenskrav och `UPPER_HALF`), HBL 11–13 möter Allsvenskan 4–2 i bäst av fem med officiell hemmaordning.
  - Allsvenskan 11–14 behåller platsen, med källan `manager-mode:closed-lower-boundary`.
  - Division 1 ingår inte i paketet och berörs aldrig.
  - Den levande motorn skapar inga Division 1-kval och väljer inga klubbar efter truppstyrka, eftersom gränsflaggan i `rules.ts` styr det.
- **D2:** avsparken härleds ur säsongens eget spelschema. Det blir samma vecka och veckodag ett år senare (närmaste samma veckodag ±3 dagar från samma datum) och alltid efter dagens speldatum. I M9G gav det 2027-09-16, samma veckodag som säsong 1:s första ligaomgång. Ingen fast 20 september. Försäsong och kontraktsdatum följer `leagueKickoffDate` och det dagliga flödet som förut.
- **D3:** `managerModeLicence(state, clubId, familyId)` returnerar ELIGIBLE med underlag. Det är den enda kroken för ett framtida licenssystem, och ett saknat beslut kan aldrig blockera.
- Valideringen är inte försvagad någonstans: samma `validatePlannerInput`, planerare och storleks-, matchschema- och kvittokontroller.

## 5. Upp- och nedflyttning

- **Riktade tester** med de 28 kanoniska klubbarna och kvalserier i den levande motorns format, i båda utfallen:
  - Allsvenskan-utmanarna vinner kvalet: HBL 11–13 går ned och Allsvenskan 4–2 går upp.
  - HBL-lagen håller: alla stannar kvar.
  - I båda fallen går Allsvenskan 1 upp och HBL 14 ned, och resten behåller sin serie.
- **Verklig karriär (M9G, IFK Skövde som manager, seed `m9g-two-seasons`):**
  - Den levande motorn hade `promoted [swe2-tyreso, swe2-kroppskultur]` och `relegated [se_club_lugi_hf, se_club_onnereds_hk]`.
  - Planerarens medlemskap blev identiskt för alla 28 klubbar.
  - Säsong 2 spelades med Tyresö i HBL (26 matcher) och Lugi i Allsvenskan (26 matcher).
  - Varje ligamatch i säsong 2 spelas mellan klubbar som tillhör just den serien. Inga matcher eller utfall från säsong 1 är aktiva.

## 6. Atomicitet och återställning

- `attemptSeasonTransition` är oförändrad: den bygger en kandidat som exponeras först efter slutlig validering av matchschemat. Vid BLOCKED returneras exakt samma objekt.
- `transitionCareerSeason` fångar även fel i adaptern och svarar med `CAREER_EVIDENCE_FAILED` som BLOCKED på den orörda karriären.
- Kvittot gör upprepade försök idempotenta (`ALREADY_APPLIED`), också efter sparning och laddning.
- Komprimeringen körs bara på kandidaten. Ett blockerat försök rör inte inkorgen (test).
- Ekonomi, kontrakt och spelarlivscykel går genom det befintliga dagliga flödet, som förut. Övergången flyttar inte pengar: kassan är oförändrad vid själva övergången (M9G), och nivåfaktorn läser det nya medlemskapet.

## 7. Historikkomprimering

`compactCareerHistory` (HM-ALPHA3-M10) körs åter vid varje övergång:
- Den trimmar inkorg och händelser äldre än 400 dagar (utom de som väntar på åtgärd), gamla bud, nyheter och träningsveckor, utvecklingshistorik över 24 poster per spelare och inaktiva belastningsposter.
- Säsongsarkiv, tabeller, kvalserier, kontrakt, ekonomi och historik rörs aldrig.
- Tester: M9E-testet vid övergång (en gammal post trimmas, en ny och en öppen post finns kvar, utvecklingshistoriken är högst 24 poster, arkivet växer med 1, kontrakten är identiska) och det befintliga M10-testet (idempotens).

## 8. Sparfilskompatibilitet (M9F)

- **Ingen schemaändring och ingen migrering.** `authority` är valfritt och finns bara i regelpaket, inte i sparfiler. Underlaget byggs ur befintliga fält.
- **Rundtur:** JSON + `migrateCareerState` ger identiskt utfall. En sparfil utan `lastSeasonTransition` godtas.
- **Äldre säsong med bara den egna serien:** det fanns inget underlag för flytt, så paketet `frozen` gäller och ingen klubb flyttas. Inga resultat hittas på. Kvittot visar `frozen`. Nästa säsong får båda serierna genom det befintliga `ensureSeasonCalendar` före avspark.
- **Manager i en Division 1-grupp** (från den gamla övergången): den spelade gruppen tas in som sluten serie (`closedLeagues`).
- **Drift som inte kan gå säkert**, till exempel Allsvenskan med 15 klubbar: explicit och återställbart BLOCKED med koder och meddelanden. Karriären returneras orörd.

## 9. Ekonomisk validering

| Klubb | Mått | Säsong 1 | Säsong 2 |
|---|---|---|---|
| Tyresö (upp) | Sponsor- och mediaintäkt per månad | – | ×1,35 (inom 1 %) |
| Tyresö (upp) | Matchdagsintäkt | 99 439 € | 156 357 € |
| Lugi (ned) | Sponsor- och mediaintäkt per månad | – | ×0,72 (inom 1 %) |
| Lugi (ned) | Matchdagsintäkt | 124 852 € | 166 350 € |

- Lugis matchdagsintäkt steg trots nivåfaktorn 0,72. Det beror på bättre resultat och därmed större publik, plus fler hemmamatcher (kval och cup). Intäkten följer publiksiffran och redovisas därför, men används inte som påstående i testet.
- Alla 28 klubbar i HBL och Allsvenskan har matchdagsintäkt > 0 i säsong 2. Bortfallet av matchdagsintäkter i M8:s frysta kalender beror helt på att säsongsövergången saknades.
- Ingen omdesign av ekonomin: bara verifiering av att den befintliga nivålogiken (`economicTier`, `tierRevenueFactor`) får rätt medlemskap.

## 10. Tvåsäsongsscenariot (M9G)

Testet är `lib/career/seasonLifecycle.integration.test.ts` och tar cirka 6 minuter. Loggen ligger i `C:\DEV\QA\logs\transfer-realism\m9-two-season.log`.

- **Säsong 1:** 2026-08-26 → 2027-05; båda serierna, SM-slutspel, KVAL_HBL och cup; inga Division 1-kval; 0 automatiskt lösta åtgärder.
- **Övergång:** APPLIED. Upp- och nedflyttning enligt ovan, 14 + 14 klubbar, Division 1 orörd. Spelschemat har 182 + 182 nya matcher från 2027-09-16 (härledd avspark). Arkivet har +1 post, kontrakten är intakta och nivåfaktorerna stämmer.
- **Säsong 2:** spelas klart. Medlemskapet är konsekvent i tabeller, matcher och utfall, och alla klubbar har matchdagsintäkter.
- **Övergång till 2028/29:** APPLIED, 14 + 14 klubbar, arkivet +1.

Därtill täcker riktade tester omvänt kvalutfall, misslyckat försök med senare lyckat försök, sparfilsladdning, komprimering och kontraktsintegritet.

## 11. Testresultat

| Körning | Tester | Pass | Fail |
|---|---|---|---|
| M8 `2bd03b68` | 2 855 | 2 848 | 7 |
| **M9** `4c321ba3` (`m9-tests.log`) | **2 868** | **2 861** | **7** |

- **Nya:** 13 tester, alla gröna.
- **Befintliga test för övergång, säsong och sparfiler:** `seasonRollover`, `transition`, `season`, `m10SaveIntegrity`, `m10WorldBalance`, `alpha3SaveCompatibility`, `cpuCondition` och `workloadLedger`. 94/94 gröna efter ändringen, utan att något test har ändrats.

### 11.1 Hela sviten

`C:\DEV\QA\logs\transfer-realism\m9-tests.log`: 2 868 tester, varav 2 861 passerar och 7 fallerar. De 7 är exakt de kända felen från bas-commiten (data och harness): Allsvenskan 284, HBL bio CA/PA, 265 HBL-id, populationsaudit 1191, bundlad HBL-data, season-0-checkpoint och identitetskollision. Inga nya regressioner. Inga tester har tagits bort eller försvagats.

## 12. Kvarstående begränsningar

1. **Allsvenskan ↔ Division 1 är stängd (D1).** Allsvenskan 11–14 stannar och Division 1-klubbar kan inte gå upp, tills Division 1 spelas som riktig serie. Det är steg B i auditen: generera Division 1-gruppernas spelschema, låt AI spela matcherna, öppna gränsen i paketet och i `rules.ts`, och lägg till en regel för gruppindelning.
2. **Licenser** saknar modell. Alla är licensierade (D3). Kroken `managerModeLicence` finns för en framtida modell.
3. **En manager i Division 1** (äldre karriärer) spelar i en sluten grupp. HBL och Allsvenskan genereras inte för den karriären, eftersom paketet bara innehåller de serier som spelades.
4. **Simuleringsharnessen** (`transfer-realism-sim.ts`) är inte ändrad: den hoppar fortfarande över första dagen och spelar inte managerns matcher. Långtidskörningar behöver använda samma flöde som M9G. Det är ett separat steg, men nu möjligt.
5. **Officiella regelbevis:** det officiella paketet blockerar fortfarande, avsiktligt, tills ett granskat paket för 2027/28 finns.
