# Handball Manager – levererad spelbar alpha

Den här versionen kopplar ihop den befintliga karriären med en faktisk live-match, sparad 2D-repris och fortsatt spel efter första säsongen. Den vanliga spelvägen använder riktiga klubbar och spelartrupper. Scenario Lab behövs inte för att spela.

## Arkitektur och matchmotor

V2-kärnan i `packages/handball-engine/src/v2/core` äger spelarens karriärmatcher. Valet gjordes efter läsning av Legacy/Spatial, Fast, V2 och Motion-worktreen. V2 hade redan två halvlekar, regler, utvisningar, byten, tränarkommandon, RNG-tillstånd och spelarprofiler. Motion-bryggan har värdefullt rörelse- och samspel men vägrar ännu bland annat utvisningslägen och andra försvar än 6:0. Motion-worktreen är bevarad och har inte skrivits om eller raderats.

Fast-motorn finns kvar för separata AI-bakgrundsmatcher. Den används aldrig för snabbresultat eller för återstoden av spelarens pågående match. Spelarens snabbresultat stegar samma V2-session till slutsignal. Den gamla karriäradaptern är flyttad till `lib/career/legacy/matchday.ts` och används av uttryckligen historiska regressionstester. Debugvärdar kan fortfarande innehålla äldre motorer.

## Återanvända och ersatta system

Trupper, spelaridentiteter, ratings, kontrakt, övergångar, scouting, ekonomi, träning, utveckling, skador, personal, kalender och tabell återanvänds. Nya moduler binder ihop dem med produktmatchens livscykel.

Den tidigare live-sidan med förberäknad tidslinje och motorbyte vid taktiska ändringar är ersatt. Match 2D återsimulerar inte längre gamla matcher. Den gamla match-center-demoytan går till matchrepriser. Taktikskärmen visar en gemensam startsju och de laginstruktioner som den aktuella motorn faktiskt kan utföra. Separata anfalls-/försvarsstartspelare och oanvända specialreglage exponeras inte i den normala matchplanen.

## Matchens livscykel

`Matchförberedelse → sparad matchsession → första halvlek → halvtid → andra halvlek → slutsignal → finalisering och arkiv → bokförd karriär`

Sessionen innehåller det faktiska V2-tillståndet, registrerade spelare och observerade positionsbilder. Kalendern stannar medan sessionen finns. Navigering och omladdning skapar ingen ny match. Omladdad match öppnas pausad.

Byten, timeout och laginstruktioner skickas till samma pågående tillstånd. Tidigare händelser behålls. Ingen oberoende simulator skriver en ny resultatsvans. Ett byte genomförs genom motorns utträde och inträde på planen. Timeout följer motorns innehavs- och regelkontroller.

Resultat, målskyttar, skott, räddningar, utvisningar och tekniska förluster härleds från motorns händelser och bollinnehavsledger. Speltid, energi och distans kommer från samma spelares fysiska tillstånd. Efter slutsignal uppdaterar en idempotent finalisering resultat, klubbform, spelarstatistik, fysisk status, utveckling och befintlig deterministisk skaderisk. Ett redan bokfört fixture-id kan inte bokföras igen.

## 2D, arkiv och sparning

Arkivformat 2 lagrar fixture, motorversion, seed, registrerade spelarnamn/nummer/roller, händelser, slutresultat, statistik och belastning. Observerade positionsbilder packas i en binär representation med centimetermått och base64-kodning för JSON/IndexedDB. Bollflykt samplas tätare än vanlig rörelse. Reprisen interpolerar presentation mellan sparade positioner; resultat och händelser förutsägs inte. Äldre format 1 kan fortfarande läsas.

Live-visningen läser det aktuella matchtillståndet. Repris och historisk matchrapport läser det sparade arkivet. Aktuella spelarattribut, övergångar och senare träning används aldrig för att återskapa en avslutad match.

Karriären lagras i IndexedDB med save-schema 8. Färdiga matcharkiv lagras separat och skrivs innan karriärens arkivreferenser publiceras. Kalendersteg skriver därför inte om varje gammal repris. En begränsad skrivkö behåller senaste väntande snapshot. Vanlig live-autosave begränsas i tid; instruktioner, matchgränser och explicit **Spara** sparas direkt. **Spara och avsluta** väntar på lagringen.

Spelarprofiler byggs av befintliga attribut för skott, passningar, beslut, snabbhet, försvar, målvakt och uthållighet. Saknad rating använder spelarens befintliga förmåga som fallback. Inga nya permanenta attribut eller ersättningsklubbar har skapats. Matchens RNG är sparad `mulberry32` med seed från karriär och fixture-id. Karriärens övriga risk-/utvecklingsmodeller använder befintliga deterministiska seednycklar. Autosavens väggklocka påverkar ingen simulering.

Äldre sparfiler behåller redan bokförda resultat. Den gamla reveal-sessionen stängs vid migrering. Äldre matcher som saknar faktiskt sparade positionsdata får ingen påhittad 2D-repris.

## Säsonger och managerfunktioner

En avslutad säsong arkiverar sluttabell och spelarstatistik. **Börja nästa säsong** skapar nästa kalender med unika URL-säkra fixture-id:n, återställer aktuell tabell/statistik och behåller trupper, avtal, utveckling och ekonomisk värld. Kalendern hoppar inte över sommaren: avtal, ålder, träning, rehab och övergångar fortsätter genom ordinarie dagsteg.

Spelarprofilen har nu kontraktsförlängning. Ett avtal kan förlängas med bibehållen lön eller en höjning som ryms i lönebudgeten. Ett utgånget avtal behöver hanteras genom befintlig rekrytering. Förläng avtal före sista avtalsdagen om du vill behålla spelarna.

Övergångar, scouting, rekrytering och träning använder sina befintliga system och regressionstester. Inga dessa system har ersatts med demo-data. Historiska tabeller finns under **Tidigare säsonger** på Hem, och sparade matcher finns under **Matchrepriser**.

## Verifiering

- Bred regression: 2 290 speltester godkända samt workspace-testkompilering och övriga körda paketsviter. Den tidigare ES2022/`findLast`-konflikten i motorns testkonfiguration är åtgärdad.
- Slutliga produkt-/lagrings-/navigations-/historiska adaptertester: 41 godkända.
- Produktionsbygge: godkänt med Next.js/Webpack, inklusive TypeScript och routegenerering.
- Ändrade produktmoduler: lint godkänd. Äldre lintproblem i andra delar är inte beskrivna som åtgärdade.
- Scriptad karriär: 26 faktiska V2-matcher i Allsvenskan, sparning/omladdning mellan matcher, sluttabell med 26 matcher per klubb, arkiverad säsong, kontraktsförlängningar, sommarens dagsteg och spelad första match i säsong två. Resultatet finns i `audit/playable-season-result.json`; 27 matcharkiv och datum 2027-09-23.
- Riktig Chromium/Playwright-resa: ny karriär, trupp, spelarprofil, kontraktsförlängning, taktik, kalender, match, livebyte och laginstruktion, sparning mitt i matchen, omladdning, slutsignal, rapport, sparning efter match, omladdning och arkivrepris. Den slutliga produktionsresan kontrollerar även byte av startspelare och borttagning av den tidigare startspelaren ur matchtruppen.

Körloggar och visuella QA-bilder ligger i `docs/audit`. Testservern körs tidsbegränsat och stängs efter verifieringen. Den kvarvarande devservern från det avbrutna arbetet identifierades och avslutades; bygg- och testloggarna visade redan avslutade körningar. Kodarbetet återställdes inte eller gjordes om.

## Kända begränsningar

- Det är en spelbar alpha med begränsad taktisk bredd: 6:0/5:1, två tempon och fyra anfallsinriktningar. Avancerat 7v6 och separata fasbyten exponeras inte.
- Ligans medlemskap behålls mellan säsonger. Upp-/nedflyttning, fullständigt slutspel och kompletta cupformat är inte implementerade i denna första sammanhängande version.
- Matchbalans, statistikfördelningar och djupare handbollsrealism behöver fortsatt kalibrering. Fast-bakgrundsmatcher och fysisk V2 har olika detaljnivå.
- Kontraktsförlängning är ett enkelt avtalssystem; fulla personlighetssamtal och förhandlingar ingår inte.
- Skador använder befintlig eftermatch-/dagmodell med faktisk speltid som underlag. Alla medicinska och disciplinära specialfall är inte modellerade.
- Sparningen är lokal i webbläsaren. Äldre matcher utan arkiv kan endast visas som rapporter.

## HOW TO PLAY THIS BUILD

Kör från `C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager`:

```powershell
npm.cmd run build --workspace=@handball-manager/game
npm.cmd run start --workspace=@handball-manager/game -- --port 3001
```

Öppna **http://localhost:3001/**. Serverkommandot kör tills du avslutar det med Ctrl+C. För utveckling används `npm.cmd run dev --workspace=@handball-manager/game -- --port 3001`.

1. Skapa eller ladda en karriär och välj en svensk klubb.
2. Öppna Trupp/spelarprofiler, hantera avtal och välj matchtrupp, startsju och laginstruktioner under Taktik.
3. Använd Fortsätt till matchdagen och Starta match. Tryck Spela eller Spela till slut. Pausa för att coacha, byt spelare eller ta timeout när det är tillåtet.
4. Efter slutsignal, slutför matchen och öppna rapporten. Se tabell och belastning, fortsätt till nästa match eller öppna Matchrepriser.
5. Använd Spara eller Spara och avsluta. När serien är färdig, börja nästa säsong från Hem och fortsätt genom uppehållet.

## Versionskontroll

Endast lokala commits görs. Ursprungliga ändringar i V2-kärnan, match-QA och `season-audit.ts`, samt `.claude` och den befintliga benchmarkfilen, lämnas utanför implementationscommitten. Inga stashes/worktrees har tagits bort. Ingenting har pushats.

Implementationscommit: `9a9f4a98ba2b4d57ebbc64652f5d8731b922d0c2` – `feat(game): unify played matches and preserve season continuity`.

Slutlig produktions-UI-verifiering: godkänd, inklusive den utökade kontrollen av startsju och matchtrupp. Produktionsservern stängdes automatiskt efter testet. Git-status efter implementationscommitten innehåller de ursprungliga användarändringarna samt leveransdokumentation och lokala QA-artefakter; de ursprungliga ändringarna har inte lagts i denna commit. Git försökte automatisk städning av gammal worktree-metadata och fick permission denied; vidare commit körs med automatisk maintenance/pruning avstängd. De två registrerade worktreerna är bevarade.
