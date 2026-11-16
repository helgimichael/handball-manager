# HM — Transfer Realism & Player Career Decisions

**Sprint Audit v1.0 — READ ONLY**
Datum: 2026-11-16

| | |
|---|---|
| Repo | `C:\DEV\PROJECTS\handball-manager` |
| Branch | `work/preserved-main-before-alpha-hotfix-2026-11-08` |
| Commit | `fa65547` — "fix: prevent duplicate transfers and defensive specialist reuse" |
| Arbetsyta | Ej rena: `?? .claude/`, `?? docs/audit/` (fanns före auditen, orörda) |
| Ändringar i denna audit | Endast denna rapportfil. Ingen kod, data, sparfil, commit eller push. Inga andra worktrees rörda. |

Statusmarkeringar i rapporten:

- **[VERIFIERAT]**: läst direkt i koden och följt genom anropskedjan.
- **[SANNOLIKT]**: följer av koden, men inte bekräftat med en körd simulering.
- **[HYPOTES]**: rimlig förklaring som kräver mätning.

---

## 1. Executive summary

Den observerade buggen (Gidsel tackar nej till IFK Tumba men går till RP Linköping i Division 1) är **inte ett viktningsproblem**. Den är en **strukturell följd av att spelet har fyra separata beslutsmodeller för spelare**. Dessutom saknar det en ligahierarki, och världspoolens klubbar deltar inte på marknaden.

Kedjan som ger exakt det observerade resultatet **[VERIFIERAT]**:

1. Klubbarna i världspoolen (Bundesliga, Håndboldligaen, ASOBAL m.fl.) är **inte** CPU-aktörer. De förnyar aldrig kontrakt och värvar aldrig (`cpuRecruiterClubIds` → `careerWorldClubIds` → endast svenska tävlingar).
2. Därför blir varje världsspelare **fri agent** när kontraktet går ut (`progressContractExpiry` sveper *alla* `worldSquads`, även världspoolen). Spelare utan kontraktsdata får slutsäsong `"2026/27"` som standard, så sannolikt hamnar en stor del av världseliten i free agency redan efter första säsongen.
3. Fria agenter syns för **alla** svenska CPU-klubbar, även Division 1, utan räckviddsspärr (`rankCandidates`: free agents "never international-gated").
4. CPU-bud går genom `submitTransferOffer` → `evaluatePlayerDecision`. För en fri agent är nuvarande lön **0**, och då sätts `wageDelta = 1` och poängen till **≥ +0,40**, alltså **alltid accept**. Spelarens förmåga, ligans nivå och klubbens nivå påverkar inte beslutet.
5. Den mänskliga klubben (Tumba) går i stället via `startTransferNegotiation` → `evaluatePlayerInterest`. Den modellen har en sportslig gap-straff (`(CA − klubbnivå) × 1,25`), så en världsstjärna mot en klubb på ~120 i nivå hamnar på `IMPOSSIBLE`, och spelaren "avböjer samtal direkt".

**Resultat:** samma spelare möter två olika modeller. Den mänskliga klubben får en strikt bedömning, medan Division 1-klubben får en modell där en fri agent alltid säger ja. Det bryter direkt mot designprincipen att AI-klubbar och mänskligt styrda klubbar ska möta samma spelarbeteende.

Två ytterligare grundfel förstärker problemet **[VERIFIERAT]**:

- **Division 1 har `tier: 2`, samma som Allsvenskan** (`game-data/competitions.ts`), och alla toppligor i världen har `tier: 1` (Bundesliga = Färöarnas Burn-kappingin). Det finns ingen ligastyrka, ingen klubbstatus och inget spelarrykte i datamodellen.
- **Två olika tier-källor:** `clubCompetitionTier(state, …)` följer upp- och nedflyttning (används av `playerInterest`), medan `competitionTierForClub(clubId)` läser statisk data (används av `playerDecision` och lönekraven). En uppflyttad klubb räknas därför som tier 2 i halva motorn och tier 1 i den andra halvan.

**Rekommendation:** inför en gemensam, ren **Player Career Decision Model (PCDM)** som *alla* flöden anropar (CPU-bud, mänsklig förhandling, rivaler, inkommande bud, förhandsavtal och förnyelser). Den ska bygga på kontinuerlig liganivå, klubbnivå, karriärfas, förväntad roll och lön, och använda ett **reservationsvärde** (värdet av att stanna eller vänta) som varje bud måste slå. Att bara justera vikterna löser inte problemet (se §10 F).

---

## 2. Nuvarande transferarkitektur

### 2.1 Moduler

| Område | Fil | Ansvar |
|---|---|---|
| Kanonisk budpipeline | `transfers/transferIntegration.ts` (`submitTransferOffer`, `resolveTransferOffer`) | Spärrar → affordability → säljande klubb → **spelarbeslut** → exekvering |
| Spelarbeslut A (CPU-bud) | `transfers/playerDecision.ts` (`evaluatePlayerDecision`) | Lön (0,5) + tier (0,25) + situation + jitter, tröskel −0,05 |
| Spelarbeslut B (människa) | `transfers/playerInterest.ts` (`evaluatePlayerInterest`) | Poäng 0–100 → HIGH…IMPOSSIBLE, lönepremie 1,0–1,5 |
| Spelarbeslut C (lönekrav/villkor) | `transfers/negotiation.ts` (`computePlayerWageDemand`, `evaluatePlayerTermsRound`, `packageRatio`) | Krav = bas × multiplikatorer, accept om bud ≥ krav |
| Spelarbeslut D (manager-spelare säljs) | `players/market.ts` (`playerStance`, `findBuyer`, `progressPreContracts`) | Personlighet (ambition/lojalitet) + moral + tier |
| Förhandling och rivaler | `transfers/negotiationIntegration.ts` (`startTransferNegotiation`, `findRivals`, `resolveRivalDecision`, `computeWageDemandAt`) | Rundor, rivaler, val mellan paket |
| CPU-rekrytering | `career/cpuRecruitment.ts` (`progressCpuRecruitment`, `pursuePosition`, `pursueQualityUpgrades`, `progressCpuEmergencyRecruitment`) | Behov → kandidat → `submitTransferOffer` |
| CPU-kandidatrankning | `career/cpuCandidateEvaluation.ts` (`rankCandidates`, `ownLevelScore`) | CA-driven poäng, internationell räckvidd |
| CPU-kontrakt | `career/cpuContractDecisions.ts` (`decideContractAction`) | RENEW/WAIT/RELEASE (klubbsidan, inte spelarens vilja) |
| Kontraktsutgång | `career/contractExpiry.ts` (`progressContractExpiry`, `releasePlayerToFreeAgency`) | Utgånget kontrakt → `FREE_AGENT_CLUB_ID = ""`, lön 0 |
| Karriärslut utan klubb | `career/professionalCareerExit.ts` | Sannolikhet att lämna proffslivet efter tid som fri agent |
| Säljande klubb | `transfers/clubDecision.ts` | Prisbild, lånebeslut |
| Fönster | `transfers/transferWindow.ts` | Fönster öppet/stängt |
| Lönemodell | `economy/marketValue.ts` (`computePlayerSalaryEurPerMonth`, `leagueTierMultiplier`) | CA × ålder × tier (1,15/0,85) × position × roll |
| Ligor | `game-data/competitions.ts` | `tier: 1 | 2` enbart |
| Världsaktiva klubbar | `career/worldCompetitions.ts` (`SWEDISH_WORLD_COMPETITION_IDS`, `careerWorldClubIds`) | Endast fyra svenska tävlingar |
| Världspool | `career/careerWorld.ts` (`WORLD_POOL_COMPETITION_IDS`, `getExternalCandidateClubs`), `career/worldPoolIntegration.ts` | 16 utländska ligor: kandidatkälla, ej aktörer |

### 2.2 Datamodell för nivå och status

- `Competition.tier: 1 | 2`. Ingen styrka, ingen ranking, ingen nivå per land. **[VERIFIERAT]** (`game-data/types.ts`)
- `Club`: ingen reputation, ingen ambition, ingen status. **[VERIFIERAT]**
- `PlayerMock`: ingen reputation, inget karriärmål, inga preferenser. `worldPoolMetadata.hmLevel` ("Elite" m.fl.) finns för världspoolens spelare men används bara i ratinggenereringen (`hmLevelShift`). **[VERIFIERAT]**
- `personalityOf()` (`players/dynamicsState.ts`) ger `ambition` och `loyalty`, härledda deterministiskt från identitet och ålder, men används **endast** av beslutsmodell D och moral. **[VERIFIERAT]**
- Klubbnivå finns endast som härlett värde: `ownLevelScore()`, snittet av bästa CA per position (topp 7). **[VERIFIERAT]**

---

## 3. Komplett flödeskarta för spelarbeslut

```
                         ┌──────────────────────────────┐
                         │  Kontrakt går ut (31 maj)    │
                         │  progressContractExpiry      │◄── världspoolen förnyar ALDRIG
                         └──────────────┬───────────────┘    (inte CPU-aktörer)
                                        ▼
                               FREE AGENT (lön = 0, klubb = "")
                                        │
     ┌──────────────────────────────────┼─────────────────────────────────────┐
     │ CPU-FLÖDE (alla svenska CPU-klubbar inkl. Div 1)                        │
     │ progressCpuRecruitment / EmergencyRecruitment / QualityUpgrades        │
     │   → rankCandidates (score ≈ CA + PA-headroom·0,3 + FA +15 …)           │
     │   → bestAffordableCandidate                                            │
     │   → submitTransferOffer (wage = 1,1 × nuv. lön || 2 % av marknadsvärde)│
     │       → affordability → [säljande klubb, ej för FA]                     │
     │       → evaluatePlayerDecision  ◄── MODELL A                            │
     │            FA: wageDelta = 1 ⇒ ALLTID ACCEPT                            │
     └────────────────────────────────────────────────────────────────────────┘
     ┌────────────────────────────────────────────────────────────────────────┐
     │ MÄNSKLIGT FLÖDE (Tumba)                                                │
     │ startTransferNegotiation                                               │
     │   → evaluatePlayerInterest  ◄── MODELL B (gap-straff, IMPOSSIBLE-gate)  │
     │   → findRivals (CPU-klubbar med behov, topp 3 i rankCandidates)        │
     │   → klubbrundor → spelarrundor                                         │
     │       computeWageDemandAt  ◄── MODELL C (+ B:s premie, men B:s gate     │
     │                                 ignoreras för rivaler)                 │
     │       evaluatePlayerTermsRound: accept om bud ≥ krav                   │
     │   → resolveRivalDecision: spelaren väljer högsta packageRatio          │
     │   → resolveTransferOffer(agreement) (hoppar över modell A)             │
     └────────────────────────────────────────────────────────────────────────┘
     ┌────────────────────────────────────────────────────────────────────────┐
     │ MANAGERNS EGNA SPELARE                                                 │
     │ generateIncomingOffers / progressPreContracts                          │
     │   → findBuyer (köparnivå inom [CA−25, CA+6] ← enda köparbandet!)        │
     │   → playerStance  ◄── MODELL D (personlighet, moral, tier)             │
     │   utländska köpare: slumpvald klubb i 5 ligor, nivå = CA+10 (fiktiv)   │
     └────────────────────────────────────────────────────────────────────────┘
     ┌────────────────────────────────────────────────────────────────────────┐
     │ FÖRNYELSE (CPU): decideContractAction — enbart klubbens vilja.          │
     │ Spelaren tillfrågas aldrig; kan inte välja att gå.                     │
     └────────────────────────────────────────────────────────────────────────┘
```

Svar på frågorna i §2 i uppdraget:

| Fråga | Svar |
|---|---|
| Hur utvärderar spelaren ett inkommande bud? | Beror på flöde: A, B+C eller D (se ovan). **[VERIFIERAT]** |
| Hur jämförs klubbar? | Bara i rivalflödet, via `packageRatio` = lön / krav **på den klubben**. Det är en ren ekonomisk kvot; sportslig nivå påverkar bara kravets multiplikator (≤ ×1,08 för nivå, ×1,15 för tier). **[VERIFIERAT]** |
| Hur beräknas intresse? | Modell B (0–100), används bara mot den mänskliga klubben. |
| Lön, längd, bonus? | A: bara lön. C: lön, längd (ålder), signing bonus som månadslön. **[VERIFIERAT]** |
| Kan spelaren tacka nej till alla? | CPU-bud: ja för kontrakterade spelare. **Nej i praktiken för fria agenter**, som alltid accepterar. **[VERIFIERAT]** |
| Kan spelaren stanna? | Ja implicit om budet avslås, men det finns inget explicit "stanna-värde". CPU-förnyelse är ensidig. |
| Kan spelaren vänta på bättre bud? | **Nej.** Det finns ingen reservationsnytta och inget minne av tidigare bud, och första godkända CPU-bud exekveras omedelbart. **[VERIFIERAT]** |
| Utlåningar? | CPU-klubbar lånar aldrig (`LOAN` förekommer inte i `cpuRecruitment.ts`). Endast den mänskliga klubben. **[VERIFIERAT]** |
| Fönster och timing? | Avtal kan träffas när som helst. Permanenta övergångar exekveras vid nästa fönster (`AGREED_AWAITING_WINDOW`). |

---

## 4. Identifierade problem (med filreferenser)

| # | Problem | Fil / funktion | Status |
|---|---|---|---|
| P1 | Fri agent har lön 0 → `wageDelta = 1` → accepterar alla CPU-bud oavsett klubb | `transfers/playerDecision.ts:36` + `career/contractExpiry.ts:85` | **VERIFIERAT** |
| P2 | Modell A ignorerar CA, klubbnivå, ålder och roll helt; tier-delta väger bara 0,25 och är binär | `transfers/playerDecision.ts:35-55` | **VERIFIERAT** |
| P3 | Fyra olika spelarbeslutsmodeller (A/B/C/D) med olika indata och olika tier-källor | se §2.1 | **VERIFIERAT** |
| P4 | Interest-gaten (B) tillämpas bara på den mänskliga klubben; rivaler och CPU-bud går förbi den | `negotiationIntegration.ts:158` vs `transferIntegration.ts:309`; `computeWageDemandAt` använder bara premien | **VERIFIERAT** |
| P5 | Division 1 = `tier: 2` = Allsvenskan | `game-data/competitions.ts:45-56` | **VERIFIERAT** |
| P6 | Alla utländska toppligor = `tier: 1`, oavsett styrka (Bundesliga = Färöarna = Qatar) | `game-data/competitions.ts` | **VERIFIERAT** |
| P7 | Två tier-källor: statisk (`competitionTierForClub`) och dynamisk (`clubCompetitionTier`) | `transferExecution.ts:194`, `competitionMembership.ts:15` | **VERIFIERAT** |
| P8 | Världspoolens klubbar förnyar aldrig kontrakt och värvar aldrig → hela världseliten matas in i den svenska free agent-poolen | `worldCompetitions.ts`, `cpuRecruitment.ts:147`, `dailyTick.ts:367`, `contractExpiry.ts:133` | **VERIFIERAT** |
| P9 | Världspoolspelare utan kontraktsdata får `"2026/27"` → utgång 2027-05-31 | `gameWorld/gameWorldAdapter.ts:134`; Gidsels post saknar `contract` | **SANNOLIKT** (adaptervägen för världspoolen bör bekräftas) |
| P10 | Free agents är synliga för alla klubbar utan räckviddsstraff; Div 1 kan "hitta" världsstjärnor | `cpuCandidateEvaluation.ts:257-262` | **VERIFIERAT** |
| P11 | CPU-rankning drivs av CA (×1,0) med bara mjukt nivåstraff (0,15/CA-poäng) → svaga klubbar siktar mot de bästa spelarna | `cpuCandidateEvaluation.ts:208-212` | **VERIFIERAT** |
| P12 | CPU-lönebud till fri agent = 2 % av marknadsvärde/månad, utan koppling till spelarens krav | `cpuCandidateEvaluation.ts:201` | **VERIFIERAT** |
| P13 | Rivalval = högsta `packageRatio`; ekonomi kan helt köpa bort sportslig nivå | `negotiationIntegration.ts:444-464, 606-628` | **VERIFIERAT** |
| P14 | Fri agent har `currentClubTier = undefined` → standard 2 → **ingen** tier-kompensation vid gång till Div 1 | `negotiation.ts` (`currentTier = inputs.currentClubTier ?? 2`), `computeWageDemandAt` | **VERIFIERAT** |
| P15 | Död kod i interest: `affordabilityRatio < 0.35` (−45) är onåbar eftersom `< 0.6` kontrolleras först | `playerInterest.ts:210-214` | **VERIFIERAT** |
| P16 | Interest: `resolveClubTier` slår ihop Div 1 och alla lägre nivåer till 3, men statiskt tier är 2 för Div 1 → beror på membership | `playerInterest.ts:100-109` | **VERIFIERAT** |
| P17 | Modell D: fiktiv utländsk köpare (slumpad klubb, nivå "CA+10") utan klubbens verkliga nivå | `players/market.ts:68-75` | **VERIFIERAT** |
| P18 | Ingen "vänta/stanna"-nytta; ingen jämförelse mellan samtidiga bud i CPU-flödet (först till kvarn) | `transferIntegration.ts` | **VERIFIERAT** |
| P19 | CPU-förnyelse frågar aldrig spelaren (ingen stjärna lämnar en svag klubb frivilligt) | `cpuContractDecisions.ts:356-377` | **VERIFIERAT** |
| P20 | Ingen spelar- eller klubbreputation i datamodellen; `hmLevel` och `personalityOf` finns men är isolerade | `game-data/types.ts`, `players/dynamicsState.ts` | **VERIFIERAT** |

---

## 5. Rotorsaksanalys

### 5.1 Svar på de specifika frågorna

| Fråga | Bedömning |
|---|---|
| Saknas ligans nivå eller har den för låg vikt? | **Båda.** Nivån saknas som kontinuerligt värde (P5, P6). I modell A är vikten 0,25 och binär (P2). För fria agenter ger den ingen effekt alls (P1, P14). **VERIFIERAT** |
| Påverkar rykte och förmåga för lite? | Rykte finns inte (P20). Förmåga används bara i modell B och svagt i C. Modell A, som avgör alla CPU-bud, ignorerar förmåga helt. **VERIFIERAT** |
| Kan ekonomin kompensera stora nivåskillnader? | **Ja.** Modell A: +50 % lön ger +0,25, vilket tar ut ett tier-fall. Modell C: ett tier-fall kostar bara +15 % i krav. Rivalval styrs av lönekvot (P13). **VERIFIERAT** |
| Jämförs bud med felnormaliserade poäng? | **Ja.** `packageRatio` normaliserar mot kravet *på respektive klubb*. En Div 1-klubb med lågt krav (fri agent, P14) och marknadsvärdesbaserad lön (P12) kan få högre kvot än en toppklubb. Kvoten säger "hur nöjd med pengarna" och inte "hur bra är detta karriärval". **VERIFIERAT** |
| Saknas spelarens ambitioner? | I alla flöden utom D. `ambition`/`loyalty` finns men används inte i A, B eller C. **VERIFIERAT** |
| Skapar AI-rekryteringen orimliga bud? | **Ja.** CA-driven rankning (P11), free agents utan räckviddsgräns (P10) och lönebud utan koppling till spelarens krav (P12). Köparbandet `[CA−25, CA+6]` finns bara i `findBuyer` (D) och saknas i CPU-rekryteringen. **VERIFIERAT** |
| Använder olika motorer olika modeller? | **Ja, fyra stycken** (P3), med två tier-källor (P7). **VERIFIERAT** |

### 5.2 Gidsel → RP Linköping, steg för steg

1. Gidsel (Füchse Berlin, `hmLevel: Elite`) ligger i världspoolen. Klubben är inte CPU-aktör och förnyar inte (P8). Posten saknar kontraktsdata, så slutsäsongen blir sannolikt 2026/27 (P9).
2. 2027-05-31: `releasePlayerToFreeAgency` ger klubb `""` och lön 0.
3. Tumba (människa): `evaluatePlayerInterest` ger `sportingGap = CA − ~120`, ungefär −75 eller mer, så poängen blir 0 → `IMPOSSIBLE` → "avböjer samtal direkt". **VERIFIERAT** (logik)
4. RP Linköping (Div 1, CPU): har behov på positionen → `rankCandidates` (Gidsel får högst poäng tack vare CA, +15 som fri agent och ingen räckviddsspärr) → affordability med lön = 2 % av marknadsvärdet. Om klubben har råd: `submitTransferOffer` → `evaluatePlayerDecision(currentWage = 0)` → **accept**. **VERIFIERAT** (logik; vilken klubb som vinner beror på schemaläggning och budget)

Samma kedja förklarar Skipagøtu (THW Kiel → HP Warta).

### 5.3 Grundorsak i en mening

Spelarens vilja modelleras inte som **ett** karriärbeslut med ett stanna/vänta-alternativ. Den modelleras som flera lokala, ekonomidrivna acceptregler. Den regel som avgör CPU-bud saknar helt sportslig nivå, och den saknar en giltig referenspunkt för spelare utan kontrakt.

---

## 6. Ligornas och klubbarnas nivåvärdering

### 6.1 Vad som finns

| Signal | Källa | Tillförlitlighet | Används av |
|---|---|---|---|
| `Competition.tier` 1/2 | statisk data | **Låg**: Div 1 = Allsvenskan, ingen skillnad mellan länder | A, C, lönemodell |
| `clubCompetitionTier` (membership) | career state | Medel: följer upp- och nedflyttning men ärver felen i `tier` | B, D |
| `ownLevelScore` (snitt bästa CA/position, topp 7) | `gameplayRatings` | **Hög** som relativ klubbnivå: dynamisk och jämförbar mellan ligor | B, C (sportingLevel), CPU-rankning, `findBuyer` |
| `populationTierForClub` (DIVISION_1) | rating | Hög men smal | Bara ratinggenerering |
| `hmLevel` (världspool) | data | Medel–hög | Bara ratinggenerering |
| Säsongsidentitet (`titleContention`, `previousLeagueSeason` …) | `identity/season` | Glesa (~6/14 klubbar) | Bara `clubContextShift` |

### 6.2 Bedömning

- **Klubbnivå**: `ownLevelScore` är den bästa befintliga signalen. Den är dynamisk, bygger på faktiska ratingar och kan skilja en stark klubb i en svag liga från ligasnittet. Den ska återanvändas.
- **Liganivå**: saknas. Den kan **härledas** utan att hitta på data: liganivå = median (eller 75:e percentil) av `ownLevelScore` för ligans klubbar, beräknad per säsong och cachad. Det ger automatiskt Bundesliga > Håndboldligaen > Handbollsligan > Allsvenskan > Div 1 > Färöarna, så länge ratingarna är rimliga. Ett litet, dokumenterat prestigetillägg per liga (t.ex. Champions League-ligor) kan läggas ovanpå som konfiguration, inte som spelarspärr.
- **Status och prestige**: kan approximeras med liganivå + klubbnivå + historik (titlar finns i `seasonHistory`).
- `tier` bör behållas för reglerverk (upp- och nedflyttning, löneskala) men **inte** användas som attraktivitetssignal.

---

## 7. Spelarprofiler och karriärfaser

Profilerna ska härledas dynamiskt ur befintliga värden, utan manuella flaggor:

| Indata | Källa |
|---|---|
| CA, PA | `gameplayRatings` / `caOf` |
| Ålder | `playerAgeAtDate` |
| Relativ status | percentil av CA i världen (alla `gameplayRatings`), + `hmLevel` där det finns |
| Ambition, lojalitet | `personalityOf` (finns redan, deterministisk) |
| Nuvarande nivå | `ownLevelScore(currentClub)`, liganivå för nuvarande liga |
| Hemland och tidigare klubbar | `nationality`, `getPlayerClubHistory` |
| Kontraktsläge | `getPlayerContractStatus` |

Föreslagen klassning (kontinuerliga vikter, där fasen bara styr viktprofilen):

| Profil | Härledning (exempel) | Prioritet |
|---|---|---|
| 1. Världsklass | CA-percentil ≥ 97 | Sportslig nivå ≫ lön; titlar och liga |
| 2. Etablerad elit | percentil 85–97, ålder 24–30 | Nivå ≈ lön > roll |
| 3. Ambitiös etablerad | elit/god + ambition ≥ 14 | Steg uppåt, roll |
| 4. Ung talang | ålder ≤ 21, PA − CA ≥ 15 | Speltid ≫ utveckling > nivå > lön |
| 5. Utvecklingsspelare | ålder ≤ 23, låg CA | Speltid, kontraktslängd |
| 6. Etablerad rotation | percentil 40–85, ålder 25–31 | Lön ≈ roll |
| 7. Veteran | ålder 31–34 | Lön, trygghet (längd), hemkomst |
| 8. Slutet av karriären | ålder ≥ 34 eller fallande CA | Hemkomst, lön; acceptera nivåfall |

Profilen ska vara en **viktvektor** som interpoleras mellan faser, inte en `switch`, så att 30-åringar och 31-åringar inte beter sig olika.

---

## 8. Resultat av de fem realismscenarierna (nuvarande kod)

Analysen bygger på kodläsning. Siffrorna är approximativa (CA-skala 1–200).

### Scenario A: Världsklass (kontrakterad), bud från toppliga, HBL och Div 1

- **CPU-väg (modell A)**: lön +10 % (CPU-bud) ger +0,05. Topplig (tier 1→1): poäng ≈ 0,05 + jitter → accept. HBL (1→1): **samma poäng** som topplig. Div 1 (1→2): 0,05 − 0,25 → avslag, *om inte* lönen är ≥ +40 %.
- **Utländska klubbar lägger inga bud alls** (P8), så alternativet "topplig" finns inte i praktiken.
- **Resultat:** ❌ HBL = Bundesliga. Div 1 går att köpa med lön. Om spelaren är fri agent accepteras **allt**, inklusive Div 1.

### Scenario B: Ung talang (19 år)

- Modell B ger +24 för hög positionsbrist (≤ 22 år), och modell C ger rollmultiplikatorer (ambitiös talang ×1,18 per steg). Modell A (CPU) har ingen roll- eller utvecklingskomponent alls.
- **Resultat:** ⚠️ Delvis rätt i det mänskliga flödet, men i CPU-flödet avgör bara lön och tier. En toppklubb med liten roll och en Div 1-klubb behandlas lika om lönen är lika.

### Scenario C: Etablerad elitspelare (27 år)

- CPU: lön + binär tier. Människa: B-poäng (gap, tier) + C-krav. Rivaler avgörs på lönekvot.
- **Resultat:** ⚠️ Ingen balanserad avvägning. Ekonomin dominerar, och den sportsliga nivån syns bara som ±8 % i kravet.

### Scenario D: Veteran (35 år), lägre liga, bättre lön, hemkomst

- Modell B: tidigare klubb +42 och halverat gap-straff. Modell C: kortare avtal ×1,1. Modell A: inget hemkomstbegrepp, men högre lön räcker ofta.
- **Resultat:** ✅ Fungerar oftast, men av fel skäl i CPU-flödet (lön, inte livsfas). Begreppet "hemland" (nationalitet) saknas; bara "tidigare klubb" finns.

### Scenario E: Världsklass, bara bud från klart lägre nivå

- Kontrakterad: modell A avslår ofta (tier-fall), men höjer CPU lönen kraftigt kan budet gå igenom.
- **Fri agent: accepterar första CPU-budet.** Det finns ingen vänta-möjlighet.
- **Resultat:** ❌ Direkt orsak till buggen.

---

## 9. Föreslagen målarkitektur: Player Career Decision Model (PCDM)

### 9.1 Princip

En **ren, deterministisk modul** `lib/transfers/careerDecision/` som är den *enda* platsen där en spelares vilja beräknas. Alla flöden anropar den:

```
                        ┌─────────────────────────────┐
  CPU-bud ─────────────►│                             │
  Mänsklig förhandling ►│   evaluateCareerOption()    │──► utility (0–100) + förklaring
  Rival-val ───────────►│   chooseBetweenOptions()    │──► vald option | STAY | WAIT
  Inkommande bud (D) ──►│   reservationUtility()      │──► stanna/vänta-värde
  Förhandsavtal ───────►│   wageDemandFor()           │──► lönekrav = f(utility-gap)
  Förnyelse (spelarsida)►│                             │
                        └─────────────────────────────┘
                 indata: PlayerCareerProfile + ClubOption + MarketContext
```

### 9.2 Byggstenar

1. **`LeagueStrengthIndex`** (ny, härledd): per liga och säsong = percentil av `ownLevelScore` för ligans klubbar, plus en valfri konfigurerad prestigejustering. Cachas i state vid säsongsstart. Ersätter `tier` som attraktivitetssignal.
2. **`ClubSportingLevel`**: `ownLevelScore` (finns), plus valfri status (titlar, Europaspel) senare.
3. **`PlayerCareerProfile`** (ny, härledd, aldrig lagrad): ålder, CA-percentil, PA-headroom, `ambition`, `loyalty` (`personalityOf`), nationalitet, klubbhistorik, kontraktsläge, nuvarande nivå. Ger en viktvektor `w` enligt §7.
4. **`ClubOption`**: klubb, liga, erbjuden lön, längd, bonus, utlovad roll (eller förväntad roll via `expectedRoleFromSquadRank`).
5. **Utility per option** (alla komponenter normaliserade till [−1, 1]):
   - `sport` = f(klubbnivå − spelarens CA) + g(liganivå − nuvarande liganivå), asymmetrisk: nedsteg straffas mer än uppsteg belönas
   - `role` = förväntad speltidsandel mot spelarens förväntan (finns delvis i `EXPECTED_START_SHARE`)
   - `money` = **log**(erbjuden lön / referenslön), *mättad* (t.ex. `tanh`), där referenslönen = max(nuvarande lön, marknadsmässig lön). **Aldrig 0 för fria agenter.**
   - `security` = kontraktslängd mot ålder
   - `personal` = hemland, tidigare klubb, lojalitet
   - `stability` = klubbens ekonomiska press
   - `U = Σ wᵢ·cᵢ`
6. **Sportsligt golv (mjukt)**: om `sport < −θ(profil)` kan `money` bidra högst `κ·|sport|`. Ekonomin kan alltså mildra men inte köpa bort ett stort nivåfall. θ och κ beror på profil (en veteran har lägre θ).
7. **Reservationsvärde `R`**: nyttan av att stanna (nuvarande klubb som option) eller, för fri agent, värdet av att vänta = förväntad bästa option inom en horisont, minus tidskostnad som växer med tid utan klubb och ålder. Detta knyter an till `professionalCareerExit`.
8. **Beslut**: accept om `U(option) > R + margin`. Med flera samtidiga options väljs `argmax U`. Om alla `U ≤ R` blir resultatet STAY eller WAIT.
9. **Lönekrav** (ersätter separata multiplikatorer i modell C): minsta lön som gör `U ≥ R + margin`. Är `sport` under golvet finns ingen sådan lön, och spelaren vägrar samtal. Då blir interest-nivåerna (HIGH…IMPOSSIBLE) en **projektion** av samma utility och ingen separat modell.

### 9.3 Marknadsstruktur (krävs för att modellen ska verka)

- **Världspoolens klubbar måste kunna behålla spelare.** Minimalt: en lättviktig "abstrakt förnyelse" för världspoolen, där klubben förnyar om spelaren inte valt annat (spelaren väljer mellan att stanna i världspoolen och svenska bud via PCDM). Helt CPU-aktiva utländska klubbar är inte nödvändigt i första steget.
- **Fria agenter av hög nivå** behöver en abstrakt "utlandsmarknad": en syntetisk option med liganivå = spelarens tidigare nivå, som representerar att andra ligor hör av sig. Den höjer `R`, så att Div 1 inte blir enda alternativet.
- **CPU-rekrytering** använder `PCDM.estimateAcceptance()` i rankningen, så att klubbar inte lägger bud de vet blir nej (motsvarar köparbandet i `findBuyer`, men generellt).

### 9.4 Gemensam motor eller inte?

**Ja, en gemensam motor.** Motiv:

- Problemet *är* motsägelsen mellan motorerna (P3, P4, P7).
- Principen "AI och människa möter samma spelarbeteende" går bara att garantera om det finns en enda funktion.
- Flödesspecifika saker (rundor, rivaltider, UI-texter, agentarvode) ligger kvar i respektive flöde. Bara själva **viljan** centraliseras.

---

## 10. Rekommenderade viktningar och beslutsprinciper

Startvärden att kalibrera, inte slutliga:

| Komponent | Världsklass | Elit 27 | Ambitiös | Talang 19 | Utveckling | Rotation | Veteran 32 | Slut 35+ |
|---|---|---|---|---|---|---|---|---|
| sport (klubb + liga) | **0,45** | 0,30 | 0,35 | 0,20 | 0,15 | 0,20 | 0,15 | 0,05 |
| role / speltid | 0,10 | 0,20 | 0,20 | **0,40** | **0,40** | 0,25 | 0,15 | 0,10 |
| money | 0,25 | 0,30 | 0,25 | 0,15 | 0,20 | 0,35 | 0,35 | 0,35 |
| security | 0,05 | 0,05 | 0,05 | 0,05 | 0,10 | 0,10 | 0,20 | 0,20 |
| personal | 0,05 | 0,05 | 0,05 | 0,10 | 0,10 | 0,05 | 0,10 | **0,25** |
| stability | 0,10 | 0,10 | 0,10 | 0,10 | 0,05 | 0,05 | 0,05 | 0,05 |
| sportsligt golv θ | 0,25 | 0,40 | 0,35 | 0,60 | 0,70 | 0,60 | 0,70 | ∞ (inget golv) |
| max kompensation κ | 0,3 | 0,5 | 0,4 | 0,7 | 0,8 | 0,8 | 1,0 | 1,0 |

Beslutsprinciper:

1. **Lön i log-skala och mättad.** En dubblad lön ger samma nytta oavsett grundnivå, och ×5 ger inte ×5 nytta.
2. **Referenslön för fria agenter = marknadslön**, aldrig 0.
3. **Asymmetri:** nedsteg kostar 1,5–2 gånger mer än motsvarande uppsteg ger.
4. **Relativ nivå, inte tier:** använd `LeagueStrengthIndex` och `ownLevelScore`.
5. **Reservationsvärde alltid närvarande:** spelaren kan säga nej till allt.
6. **Ingen spärr per spelare.** Golvet θ beror på profil och är kontinuerligt.
7. **Determinism:** behåll `seededOffset` för personlig variation (±5 %), aldrig `Math.random`.
8. **Förklarbarhet:** varje beslut returnerar sina komponentbidrag (UI och decision log).

---

## 11. Risker och potentiella bieffekter

| Risk | Konsekvens | Motåtgärd |
|---|---|---|
| Svenska klubbar kan inte värva alls | Tomma positioner, akutrekrytering fastnar | CPU-rankning med acceptanssannolikhet; fall tillbaka på realistiska kandidater; mät fyllnadsgrad |
| Free agent-poolen växer | Fler "döda" spelare | Koppla `R` till `professionalCareerExit` (tid utan klubb sänker `R`) |
| Världspoolen töms ändå | Elitspelare försvinner till Sverige | Abstrakt världsförnyelse (§9.3) |
| Liganivån driftar | Ratingutveckling ändrar ordningen mellan ligor över 20 säsonger | Utjämna (EMA) per säsong och logga i QA |
| Ekonomin förändras | Löner stiger om kraven blir mer realistiska | Kör ekonomikalibreringen igen (`clubEconomyCalibration`) |
| Befintliga tester bryts | `playerDecision.test`, `playerInterest.test`, `negotiation*.test`, CPU-kalibreringstester | Migrera tester till att verifiera beteende, inte tal |
| Sparfiler | Ingen lagrad data behövs (profil och liganivå härleds), men `transferOffers.playerDecisionReason` kan få nya texter | Ingen migrering krävs om allt är härlett; cachen kan återskapas |
| Prestanda | `rankCandidates` × PCDM per kandidat | Förberäkna `LeagueStrengthIndex` och klubbnivå per tick |
| Två tier-källor kvar | Fortsatt inkonsekvens | Ersätt `competitionTierForClub` med membership-varianten överallt |

---

## 12. Teststrategi

1. **Enhetstester för PCDM** (ren funktion):
   - Fem scenarier A–E som tabelltester med syntetiska profiler.
   - Monotonicitet: högre lön ger aldrig lägre U; högre klubbnivå ger aldrig lägre `sport`.
   - Golv: för världsklass finns ingen lön som gör Div 1 > R när toppalternativ finns.
   - Fri agent med lön 0 behandlas med marknadsreferens (regression mot P1).
   - Determinism: samma indata ger samma utfall.
2. **Paritetstest:** samma spelare och samma bud via CPU-väg, mänsklig väg och rivalväg ska ge samma accept/avslag (regression mot P3/P4).
3. **Invariansttester i flödena:**
   - `submitTransferOffer` med CPU-köpare anropar PCDM.
   - `findRivals` exkluderar klubbar där PCDM ger "vägrar samtal".
4. **Långtidssimulering (20 säsonger, QA-harness)** med mätvärden till `C:\DEV\QA\reports\`:
   - Fördelning av spelar-CA per liganivå (världsklass i Div 1 ≈ 0, utom veteraner över 33)
   - Andel övergångar som är nedsteg per profil
   - Free agent-poolens storlek och återanställningsgrad
   - Fyllnadsgrad i CPU-trupper och antal akutvärvningar
   - Stabilitet i liganivåindexet
5. **Namngivna kontrolltester (data, inte specialregler):** Gidsel och Skipagøtu får inte hamna i Div 1 före 33 års ålder i N seedade simuleringar.

---

## 13. Prioriterad implementationsroadmap

| Fas | Innehåll | Löser |
|---|---|---|
| **0. Säkerhetsfix (liten)** | Referenslön för fri agent = marknadslön i `evaluatePlayerDecision`; lägg till sportslig gap-komponent (samma som B) i modell A; låt rivaler respektera interest-gaten | P1, P4 (huvudsymptomet) |
| **1. Nivåmodell** | `LeagueStrengthIndex` (härledd), en enda tier-källa (membership), Div 1 skild från Allsvenskan | P5, P6, P7, P16 |
| **2. PCDM-kärna** | Ren modul + profiler + reservationsvärde + tester (§12.1–2) | P2, P3, P18, P20 |
| **3. Koppla in alla flöden** | CPU-bud, förhandling, rivaler, `playerStance`, förhandsavtal; lönekrav härleds ur PCDM | P3, P13, P14, P17 |
| **4. Marknadsstruktur** | Abstrakt förnyelse i världspoolen + syntetisk utlandsmarknad för fria agenter | P8, P9, P10 |
| **5. CPU-rekrytering** | Acceptansmedveten rankning, lönebud från PCDM-krav | P11, P12 |
| **6. Spelarsidan i förnyelser** | Spelaren kan avböja CPU-förnyelse (stjärna i svag klubb) | P19 |
| **7. Kalibrering** | 20-säsongers QA, justering av vikter, ekonomikalibrering | — |

---

## Slutrapport

### A. Vad är det egentliga grundproblemet?

Spelarens karriärvilja är uppdelad på **fyra inkonsistenta modeller**. Modellen som avgör alla CPU-bud (`evaluatePlayerDecision`) saknar sportslig nivå och behandlar fria agenter som om de inte har någon referenslön, så de **accepterar allt**. Samtidigt deltar inte världspoolens klubbar på marknaden, vilket driver världseliten in i en svensk free agent-pool där varje Division 1-klubb kan värva den. Den mänskliga klubben bedöms med en annan, striktare modell. Därav "nej till Tumba, ja till RP Linköping".

### B. Vilka befintliga system kan återanvändas?

- `ownLevelScore` (klubbnivå) och basen för en härledd liganivå
- `personalityOf` (ambition och lojalitet), `getPlayerClubHistory` (hemkomst), `worldPoolMetadata.hmLevel`
- `expectedRoleFromSquadRank`, `EXPECTED_START_SHARE` (roll och speltid)
- `computePlayerSalaryEurPerMonth` / `getPlayerFairWageEurPerMonth` (referenslön)
- `seededOffset` (determinism), `professionalCareerExit` (tidskostnad för att vänta)
- Hela exekverings- och förhandlingsmaskineriet (`resolveTransferOffer`, rundor, rivaler, fönster). Bara viljeberäkningen byts ut.
- Komponenterna i `playerInterest` (gap, homecoming, kontraktsläge) som startpunkt för PCDM

### C. Vilka förändringar är absolut nödvändiga?

1. En gemensam spelarbeslutsfunktion för **alla** flöden (minst CPU-bud, mänsklig förhandling och rivaler).
2. Referenslön ≠ 0 för fria agenter.
3. En kontinuerlig sportslig nivå (klubb + liga) som ekonomin inte obegränsat kan kompensera.
4. Ett reservationsvärde (stanna eller vänta), så att spelaren kan säga nej till alla.
5. Div 1 skild från Allsvenskan, och en enda tier-källa.
6. Att världseliten inte automatiskt töms till svensk free agency (abstrakt förnyelse i världspoolen).

### D. Minsta säkra implementation som löser problemet

**Fas 0 + en tunn version av fas 2/3:**

1. Extrahera komponenterna i `evaluatePlayerInterest` (gap, tier-rörelse, hemkomst, ålder) till en ren `careerSportingScore()`.
2. Låt `evaluatePlayerDecision` ta emot `playerCa`, `toClubLevel`, `age` och `isFormerClub`, och använd marknadslön som referens när nuvarande lön är 0. Beslutet blir `sportScore + moneyScore(log, mättad) > reservation`, med ett mjukt golv.
3. `findRivals` hoppar över klubbar där samma funktion ger "vägrar samtal".
4. Ge världspoolens spelare automatisk förnyelse vid utgång, med sannolikhet enligt ålder (deterministisk seed), tills fas 4 finns.

Detta påverkar ingen sparfil och ingen datamodell, och kan avgränsas till ungefär fyra filer (`playerDecision.ts`, `playerInterest.ts`, `negotiationIntegration.ts`, `contractExpiry.ts` eller ett nytt världspool-steg). Det stoppar symptomet utan att låsa fast den felaktiga arkitekturen. Liganivåindex och full PCDM följer i nästa sprint.

### E. Vilka tester krävs för att problemet inte ska återkomma?

- **Paritetstest** (CPU-väg = mänsklig väg = rivalväg för samma spelare och samma bud)
- **Regressionstest för fri agent** (lön 0 får aldrig ge automatisk accept)
- **Scenariotester A–E** som tabelltester
- **Monotonicitets- och golvtester** (ingen lön köper Div 1 för världsklass med alternativ)
- **20-säsongers QA-simulering** med fördelning av CA per liganivå och nedstegsandel per profil, med tröskelvärden som misslyckas i CI om världsklass under 33 år hamnar i Div 1

### F. Vilka ytterligare problem riskerar att uppstå om vi bara justerar nuvarande vikter?

- **P1 kvarstår:** för en fri agent ger `wageDelta = 1` alltid +0,5, så ingen tier-vikt under ~0,55 stoppar dem. Höjer man den vikten blir i stället kontrakterade spelare orörliga.
- **Div 1 = Allsvenskan kvarstår:** ingen vikt kan skilja två ligor med samma `tier`.
- **Motsägelsen mellan motorerna kvarstår:** justerar man A divergerar B, C och D ännu mer, och den mänskliga klubben och AI:n får olika "spelare".
- **Världspoolen töms ändå:** utan marknadsstruktur ackumuleras elit i free agency. Antingen värvas de av fel klubbar, eller så lämnar de proffslivet i förtid via `professionalCareerExit`. Båda är orealistiska.
- **Ekonomiska kedjeeffekter:** högre tier-vikt utan referenslön ger lönekrav som spränger budgetarna i HBL och Allsvenskan och påverkar styrelse- och ekonomikalibreringen.
- **Ingen väntelogik:** även med bättre vikter accepteras första acceptabla budet, så ordningen i CPU-schemat avgör var stjärnorna hamnar.

---

**STOPP.** Auditen är klar. Ingen implementation, commit eller push har gjorts. Inväntar godkännande av modellen innan en separat implementationssprint.
