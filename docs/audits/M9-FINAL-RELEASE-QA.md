# M9 — Final owner-release QA

- **Branch:** `work/transfer-realism-pcdm`. Granskat från `656d9021`. Slutlig HEAD är QA-commiten ovanpå (se §6).
- **Omfattning:** begränsad release-granskning. Inga nya funktioner, ingen omdesign, inga simuleringar på 20 säsonger, högst två säsonger per scenario. Inget pushat, mergat eller deployat. Inga andra worktrees är rörda.
- **Loggar:** `C:\DEV\QA\logs\transfer-realism\m9-release-*.log`

## 1. Scenarier

| # | Scenario | Resultat | Belägg |
|---|---|---|---|
| 1 | Managerns egen klubb går upp | **PASS** | QA-1: managern i Allsvenskans vinnarlag. Övergången är APPLIED, `competitionId` blir HBL och klubben har 26 HBL-matcher och 0 i Allsvenskan. Den dagliga världen spelas fram till säsong 2:s första ligamatch, som spelas via matchdagen. Klubben finns i HBL-tabellen och inte i Allsvenskans. Cupen tillkommer genom det befintliga flödet. |
| 2 | Managerns egen klubb åker ned | **PASS** | QA-2: samma sak för HBL:s 14:e-lag, som spelar i Allsvenskan. Dessutom M9G (verklig karriär): Lugi ned och Tyresö upp, med säsong 2 helt spelad. |
| 3 | Trupp, kontrakt, lån och registreringar över övergången | **PASS** | QA-3: ett aktivt lån över gränsen (spelare i den nedflyttade klubben utlånad till den uppflyttade) överlever. Lånespelaren spelar för den inlånande klubben, kontraktet ligger kvar hos moderklubben och lånet är aktivt. `worldSquads`, `playerContracts`, `gameplayRatings`, `loans`, `playerSquadStatus`, `playerStatuses`, `playerPlacements`, `playerClubHistory` och `clubEconomies` är identiska. Varje spelare finns i exakt en trupp. |
| 4 | Inga kvarvarande matcher eller medlemskap från förra säsongen | **PASS** | QA-4: inga gamla match-id:n, `results`, `competitionTies` och `matchPlans` är tomma, `seasonOutcome` gäller den nya säsongen utan flyttar, varje ligamatchs klubbar tillhör serien, 28 olika klubbar utan dubbelt medlemskap, och alla medlemskap pekar på kanoniska klubbar och aktiva serier. M9G kontrollerar samma sak efter en helt spelad säsong 2. |
| 5 | Kompatibilitet med befintliga sparfiler | **PASS** | QA-5: en karriär efter övergången klarar JSON + `migrateCareerState` med identiskt medlemskap, matcher och kvitto, och den dagliga körningen fortsätter efter laddning. En färdig säsong sparad före M9 (utan kvitto) går över med identiskt utfall. Därtill M9F-testerna: äldre säsong med en serie (frozen) och drift som ger explicit block. |
| 6 | Atomisk återställning och nytt försök | **PASS** | QA-6: saknat kvalunderlag ger BLOCKED med exakt samma objekt. Ett nytt försök med underlaget återställt ger APPLIED. Samma begäran mot en genomförd övergång ger `ALREADY_APPLIED`. Ett nytt knapptryck i den nya säsongen ger BLOCKED och orört tillstånd. Ett undantag när underlaget byggs ger BLOCKED (`CAREER_EVIDENCE_FAILED`) med oförändrad karriär. |
| 7 | M8:s transferrealism är intakt | **PASS** | Hela testsviten: alla tester för PCDM, `internationalPurchases`, `internationalYouthIntake`, `ageingModel`, `underpaidReference`, CPU, kontrakt och marknad är gröna. Inga M8-filer ändrade sedan `2bd03b68` förutom M9:s säsongsfiler (`season.ts`, `rules.ts`) och testmanifestet. |

## 2. Defekter

| # | Defekt | Allvar | Åtgärd |
|---|---|---|---|
| D1 | `seasonLifecycle.integration.test.ts:91`: `const live` hade implicit `any` (TS7022). Typkontrollen fallerade, men testkörningen påverkades inte. | Låg (bara testfil) | Typannoterad (`string \| undefined`). |
| D2 | 6 lint-varningar (oanvända variabler) i M9-filer. | Kosmetisk | Rättade utan beteendeändring: licenskroken använder `void` på sina framtida indata, `careerRules` ersätter en oanvänd loopvariabel, och testerna använder `delete` i stället för destrukturering. |

Inga funktionella defekter hittades i scenarierna.

**Observation, utan åtgärd:** `npm run lint` för hela projektet ger 361 fel och 182 varningar i 69 filer. **Inget av dem** ligger i filer som grenen har ändrat: 0 av 16 filer i M9 och 0 av 73 sedan `fa655477`. Det är befintlig lint-skuld, främst `no-require-imports` i skript. `npm run typecheck` i en ny worktree kräver att `next-env.d.ts` genereras av `next build` (36 × TS2307 för `.webp` före bygget, 0 efter). Det är miljöberoende, inte kod.

## 3. Ändrade filer i denna QA

- `apps/game/lib/career/m9ReleaseQa.test.ts` (ny, 6 tester)
- `apps/game/scripts/game-test-files.json` (registrerar QA-testet)
- `apps/game/lib/career/seasonLifecycle.integration.test.ts` (D1)
- `apps/game/lib/career/careerTransitionEvidence.ts`, `apps/game/lib/competition/transition/careerRules.ts`, `apps/game/lib/career/careerSeasonLegacy.test.ts` (D2, ingen beteendeändring)
- `docs/audits/M9-FINAL-RELEASE-QA.md` (denna rapport)

## 4. Release-kontroller

| Kontroll | Resultat | Logg |
|---|---|---|
| Riktade QA-tester (6) | ✅ 6/6 (cirka 48 s) | körda direkt |
| M9-tester (inklusive tvåsäsongstestet) | ✅ | ingår i sviten |
| Hela testsviten | ✅ **2 874 tester, 2 867 pass, 7 fail**. De 7 är exakt de kända felen från bas-commiten: Allsvenskan 284, HBL bio CA/PA, 265 HBL-id, populationsaudit 1191, bundlad HBL-data, season-0-checkpoint och identitetskollision. | `m9-release-tests.log` |
| Typkontroll (`tsc --noEmit`) | ✅ 0 fel (efter D1, med genererad `next-env.d.ts`) | `m9-release-typecheck2.log` |
| Lint, ändrade filer | ✅ 0 fel, 0 varningar (efter D2) | `m9-release-lint-changed.log` |
| Lint, hela projektet | ⚠️ 361 fel, alla befintliga och utanför grenens filer | `m9-release-lint.log` |
| Produktionsbygge (`next build --webpack`) | ✅ Kompilerat, 58/58 sidor, exit 0 | `m9-release-build.log` |

Testsviten kördes innan D1/D2-ändringarna sparades. D1 är bara en typannotering. D2-ändringarna kördes om separat: `careerSeasonLegacy` och `careerSeasonTransition` 12/12, och QA-5 1/1.

## 5. Slutsats

Alla sju scenarier passerar. Inga funktionella defekter hittades, och de två hittade defekterna (typ och lint) är åtgärdade i testfiler och kod utan beteendeändring. **M9 bedöms vara redo för push när ägaren godkänner.**

## 6. Git

- **Branch:** `work/transfer-realism-pcdm`
- **HEAD:** QA-commiten (se `git log -1`). Föregående commits, från `656d9021` och bakåt, är bevarade.
- **Worktree:** ren efter commit.
- **Inte gjort:** push, merge, deploy.
