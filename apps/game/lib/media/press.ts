// HM-ALPHA3-M08: press conferences and interviews. Only meaningful
// moments get one (derbies and big matches, notable results, a referee
// row, a player wanting out, board pressure, a rival's jab, a new job).
// Each question has answers in different registers; none is simply
// right. What an answer does depends on who is listening: a professional
// squad shrugs off public criticism, a proud rival coach does not, the
// tabloids love a provocation, the board wants calm. Every effect is
// bounded, explained afterwards, and can be handed to the assistant.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import type { CareerState } from "../career/types";
import { addMoraleShock } from "../players/morale";
import { managerSquadIds, personalityOf } from "../players/dynamicsState";
import { getClub } from "../game-data";
import { adjustRelation, coachPersona, hash, journalistFor, mediaOf, withMedia } from "./people";
import { clubShort, playerName, publish } from "./newsEngine";
import { CLUB_MEDIA, MEDIA_OUTLETS } from "./registry";
import { openDisciplineCase } from "./discipline";
import type { Consequence, MediaState, PressAnswer, PressConference, PressContext, PressQuestion, PressTopic, Tone } from "./types";
export type { PressContext };

type Emit = (e: CareerEvent) => void;

export const TONE_LABEL: Record<Tone, string> = { DIPLOMATIC: "Diplomatisk", CONFIDENT: "Självsäker", PROTECTIVE: "Skyddar spelarna", CRITICAL: "Kritisk", PROVOCATIVE: "Provocerande", HUMOROUS: "Skämtsam", DECLINE: "Avböjer" };

/** The answers on offer for a topic: wording in the manager's own voice, and what it is likely to lead to. */
export function answersFor(state: CareerState, c: PressContext): PressAnswer[] {
  const opp = clubShort(c.opponentId);
  const rival = c.rivalStaffId ? coachPersona(state, c.rivalStaffId)?.name ?? "tränaren" : "tränaren";
  const player = playerName(state, c.playerId) || "spelaren";
  switch (c.topic) {
    case "PREVIEW": return [
      { tone: "CONFIDENT", text: `Vi är bättre än ${opp}. Vi åker dit för att vinna.`, hint: "Laget växer, men pressen ökar om ni förlorar." },
      { tone: "DIPLOMATIC", text: `${opp} är ett bra lag. Det blir en jämn match.`, hint: "Lugnt – inget ändras." },
      { tone: "PROVOCATIVE", text: `Ärligt talat förstår jag inte hypen kring ${opp}.`, hint: "Rubriker och laddade supportrar, men en ny fiende." },
      { tone: "HUMOROUS", text: c.derby ? "Mamma har redan bestämt vilken halsduk hon ska ha." : "Jag har lovat spelarna glass om vi vinner.", hint: "Journalisterna gillar det." },
      { tone: "DECLINE", text: "Jag fokuserar på mitt eget lag.", hint: "Säkert, men pressen tycker att du är tråkig." },
    ];
    case "RIVAL_RESPONSE": return [
      { tone: "DIPLOMATIC", text: `${rival} får tycka vad han vill. Jag har stor respekt för honom.`, hint: "Kylan mellan er kan lägga sig." },
      { tone: "PROVOCATIVE", text: `${rival} borde ägna mer tid åt sitt eget lag.`, hint: "Det blir fejd – och rubriker." },
      { tone: "HUMOROUS", text: `Jag ska skicka en tidtabell till ${rival} så han hittar till hallen.`, hint: "Roligt för läsarna, mindre roligt för honom." },
      { tone: "CONFIDENT", text: "Vi svarar på planen.", hint: "Ger laget extra glöd inför matchen." },
      { tone: "DECLINE", text: "Det kommenterar jag inte.", hint: "Inget händer, men frågan försvinner inte." },
    ];
    case "AFTER_WIN": {
      if (c.playerId) {
        return [
          { tone: "PROTECTIVE", text: `Allt beröm till ${player} som var fantastisk i dag, men hela laget lade grunden.`, hint: "Höjer både spelaren och lagandan." },
          { tone: "CONFIDENT", text: `${player} visar vilken klasspelare han är när det gäller.`, hint: "Spelarens självförtroende växer." },
          { tone: "HUMOROUS", text: `${player} får bjuda på fikat i morgon efter den showen.`, hint: "Lättsam stämning." },
          { tone: "DIPLOMATIC", text: `En stark individuell insats av ${player} i en viktig lagseger.`, hint: "Balanserat." },
        ];
      }
      return [
        { tone: "PROTECTIVE", text: "Allt beröm till spelarna. Det är de som gör jobbet.", hint: "Spelarna växer." },
        { tone: "CONFIDENT", text: "Det här är bara början. Vi siktar högre.", hint: "Supportrarna drömmer – styrelsen höjer förväntningarna." },
        { tone: "HUMOROUS", text: "Jag tog rätt beslut vid kaffet i halvtid.", hint: "Lättsamt, journalisterna gillar det." },
        { tone: "DIPLOMATIC", text: "Två viktiga poäng, nu vilar vi och tar nästa.", hint: "Inget ändras." },
      ];
    }
    case "AFTER_DEFEAT": {
      if (c.playerId) {
        return [
          { tone: "PROTECTIVE", text: `${player} gjorde ett enormt jobb, men handboll är en lagsport. Vi måste hjälpa varandra mer.`, hint: "Stöttar spelaren och manar resten till samling." },
          { tone: "CRITICAL", text: "Vi kan inte förlita oss på en enda spelare när resten inte presterar.", hint: "Vass signal till truppen." },
          { tone: "DIPLOMATIC", text: "Vi tar med oss de positiva delarna men måste analysera helheten.", hint: "Lugnt och sakligt." },
          { tone: "DECLINE", text: "Jag kommenterar inte enskilda insatser efter en förlust.", hint: "Skyddar laget, men journalisterna vill ha mer." },
        ];
      }
      return [
        { tone: "PROTECTIVE", text: "Det här tar jag på mig. Spelarna gav allt.", hint: "Laget sluter upp – styrelsen vill se ansvar i resultaten." },
        { tone: "CRITICAL", text: "Några spelare var inte på nivån i dag. Det kommer att få konsekvenser.", hint: "Proffsen tar det som en utmaning, andra tappar." },
        { tone: "CONFIDENT", text: "En dålig dag. Vi kommer tillbaka starkare.", hint: "Lugnar supportrarna." },
        { tone: "DECLINE", text: "Jag behöver se matchen igen innan jag säger något.", hint: "Neutralt, men pressen blir otålig." },
      ];
    }
    case "REFEREE": return [
      { tone: "DIPLOMATIC", text: "Domarna har ett svårt jobb. Vi får titta på oss själva.", hint: "Inga problem, men supportrarna vill att du står upp för laget." },
      { tone: "CRITICAL", text: `Jag tycker att utvisningarna var hårda och det påverkade matchen.${c.detail ? ` ${c.detail}` : ""}`, hint: "Saklig kritik – tillåten, supportrarna gillar den." },
      { tone: "PROVOCATIVE", text: "Man undrar vilket lag domarna höll på i dag.", hint: "Ifrågasätter domarnas opartiskhet – kan anmälas till disciplinnämnden." },
      { tone: "HUMOROUS", text: "Jag ska köpa glasögon till domarna i julklapp.", hint: "Ironi kan uppfattas som otillbörligt." },
      { tone: "DECLINE", text: "Jag säger inget om domarna.", hint: "Säkrast." },
    ];
    case "PLAYER_UNHAPPY": return [
      { tone: "PROTECTIVE", text: `${player} är en viktig spelare och vi löser det internt.`, hint: "Spelaren känner sig sedd." },
      { tone: "CRITICAL", text: `Ingen är större än klubben. ${player} vet vad som gäller.`, hint: "Styrelsen gillar tydligheten, spelaren mindre." },
      { tone: "DIPLOMATIC", text: "Vi har en bra dialog. Mer än så säger jag inte.", hint: "Lugnt." },
      { tone: "DECLINE", text: "Det är en intern fråga.", hint: "Inget händer." },
    ];
    case "BOARD_PRESSURE": return [
      { tone: "CONFIDENT", text: "Jag vet vad jag gör. Resultaten kommer.", hint: "Starkt – om resultaten kommer." },
      { tone: "DIPLOMATIC", text: "Styrelsen och jag vill samma sak. Vi pratar varje vecka.", hint: "Styrelsen uppskattar lojaliteten." },
      { tone: "CRITICAL", text: "Jag skulle behöva mer stöd från klubben.", hint: "Supportrarna förstår dig, styrelsen gör det inte." },
      { tone: "HUMOROUS", text: "Jag sover gott. Det är mina assistenter som ligger vakna.", hint: "Lättar på stämningen, men kan uppfattas som nonchalant." },
    ];
    case "TRANSFER": return [
      { tone: "DIPLOMATIC", text: `${player} har gjort mycket för klubben. Vi önskar lycka till.`, hint: "Värdigt." },
      { tone: "CONFIDENT", text: "Vi har redan en plan för att ersätta honom.", hint: "Supportrarna lugnas." },
      { tone: "CRITICAL", text: "Jag hade velat behålla honom, men ekonomin styr.", hint: "Ärligt – styrelsen gillar det inte." },
    ];
    case "APPOINTMENT": return [
      { tone: "CONFIDENT", text: "Jag är här för att vinna titlar.", hint: "Förväntningarna stiger direkt." },
      { tone: "DIPLOMATIC", text: "Jag är stolt och ödmjuk. Först ska jag lära känna laget.", hint: "Ett lugnt första intryck." },
      { tone: "HUMOROUS", text: "Jag har redan hittat bästa kaffet i stan.", hint: "Lokalpressen tycker om dig." },
    ];
    case "POOR_FORM": return [
      { tone: "PROTECTIVE", text: "Jag tror på de här spelarna. Vi tar oss ur det tillsammans.", hint: "Laget sluter upp." },
      { tone: "CRITICAL", text: "Vi måste kräva mer av varandra. Alla – jag också.", hint: "Proffsen svarar, de känsliga tappar." },
      { tone: "CONFIDENT", text: "Det vänder i nästa match.", hint: "Höjer pressen inför nästa match." },
      { tone: "DECLINE", text: "Inga kommentarer i dag.", hint: "Pressen blir otålig." },
    ];
    case "DISCIPLINE": return [
      { tone: "DIPLOMATIC", text: "Jag ber om ursäkt för mina ord. De var inte okej.", hint: "En ursäkt kan mildra ett beslut." },
      { tone: "CRITICAL", text: "Jag står för det jag sa.", hint: "Supportrarna gillar det. Disciplinnämnden mindre." },
      { tone: "DECLINE", text: "Jag inväntar beskedet.", hint: "Neutralt." },
    ];
    case "TACTICS": return [
      { tone: "CONFIDENT", text: "Matchplanen satt där den skulle. Vi styrde tempot och ytorna.", hint: "Visar taktisk pondus." },
      { tone: "DIPLOMATIC", text: "Vi anpassade oss efter motståndaren och spelarna utförde direktiven bra.", hint: "Balanserat och lugnt." },
      { tone: "CRITICAL", text: "Vi följde inte principerna i spelet utan boll och det straffade sig.", hint: "Skärper kravbilden." },
      { tone: "HUMOROUS", text: "Taktiktavlan såg fin ut, sen fick spelarna springa också.", hint: "Lättar upp stämningen." },
    ];
    case "INJURY": return [
      { tone: "PROTECTIVE", text: `${player} har fullt medicinskt stöd och vi stressar inte fram en återkomst.`, hint: "Trygghet för spelaren." },
      { tone: "CONFIDENT", text: "Det är ett avbräck, men vi har en bred trupp där andra kliver fram.", hint: "Stärker reservspelarna." },
      { tone: "DIPLOMATIC", text: "Vi inväntar läkarteamets slutliga diagnos innan vi drar slutsatser.", hint: "Sakligt." },
      { tone: "CRITICAL", text: "Belastningen har varit för hög, vi måste se över hur vi roterar.", hint: "Krav på fys- och tränarteamet." },
    ];
    case "SQUAD_SELECTION": return [
      { tone: "CONFIDENT", text: "Jag tar ut det lag som ger oss bäst chans att vinna varje specifik match.", hint: "Visar tydligt ledarskap." },
      { tone: "PROTECTIVE", text: "Konkurrensen är stenhård och alla i truppen är viktiga under en lång säsong.", hint: "Håller ihop truppen." },
      { tone: "CRITICAL", text: "Prestation på träning avgör vem som spelar. Svårare än så är det inte.", hint: "Hårdare kravbild." },
      { tone: "DECLINE", text: "Laguttagningen stannar i omklädningsrummet.", hint: "Stänger dörren för spekulationer." },
    ];
    case "FINANCES": return [
      { tone: "DIPLOMATIC", text: "Vi arbetar ansvarsfullt inom föreningens ramar.", hint: "Lugnar styrelsen." },
      { tone: "CRITICAL", text: "Ska vi konkurrera i toppen behövs större sportsliga resurser.", hint: "Sätter press på styrelse och sponsorer." },
      { tone: "CONFIDENT", text: "Ekonomin är stabil och vi bygger långsiktigt med egna krafter.", hint: "Skapar framtidstro." },
      { tone: "DECLINE", text: "Ekonomiska frågor besvaras av klubbledningen.", hint: "Håller sig till det sportsliga." },
    ];
    case "STAFF": return [
      { tone: "CONFIDENT", text: "Vi har satt ihop ett kompetent ledarteam som kompletterar varandra perfekt.", hint: "Stärker ledarstaben." },
      { tone: "PROTECTIVE", text: "Hela staben gör ett oerhört jobb i det tysta som möjliggör resultaten.", hint: "Lyfter medarbetarna." },
      { tone: "DIPLOMATIC", text: "Rollen och ansvarsfördelningen i staben är tydlig och väl förankrad.", hint: "Skapar stabilitet." },
      { tone: "CRITICAL", text: "Vi behöver fortsätta utveckla resurserna runt laget.", hint: "Pressar på för bättre villkor." },
    ];
    case "LEAGUE_POSITION": return [
      { tone: "CONFIDENT", text: "Tabellen ljuger inte, men vi siktar ännu högre innan säsongen är över.", hint: "Höjer ambitionsnivån." },
      { tone: "DIPLOMATIC", text: "Vi tar en match i taget och räknar poängen i april.", hint: "Klassiskt och säkert." },
      { tone: "CRITICAL", text: "Vi ligger inte där vi borde med den här truppen. Vi kan mycket bättre.", hint: "Kräver skärpning." },
      { tone: "PROTECTIVE", text: "Laget har presterat väl utifrån våra förutsättningar.", hint: "Dämpar pressen på spelarna." },
    ];
    case "PROMISES": return [
      { tone: "DIPLOMATIC", text: "Vi har en öppen dialog och full respekt för vad vi kommit överens om.", hint: "Dämpar oron." },
      { tone: "PROTECTIVE", text: `${player} är en del av planerna och vi håller alltid det vi lovar.`, hint: "Lugnar spelaren." },
      { tone: "CRITICAL", text: "Löften måste också förtjänas på planen. Spelaren måste leverera.", hint: "Skärper tonen." },
      { tone: "CONFIDENT", text: "Vi har full kontroll över situationen och lagets bästa går alltid först.", hint: "Visar pondus." },
    ];
  }
}

function questionText(topic: PressTopic, c: PressContext, state: CareerState, style: string): string {
  const opp = clubShort(c.opponentId);
  const rival = c.rivalStaffId ? coachPersona(state, c.rivalStaffId)?.name : undefined;
  const isBlunt = style === "CONFRONTATIONAL" || style === "BLUNT";
  const isCritical = style === "CRITICAL";
  const isAnalytic = style === "ANALYTICAL";
  const isCurious = style === "CURIOUS";
  const isLocal = style === "LOCAL_SUPPORTER" || style === "LOCAL";
  const player = c.playerId ? playerName(state, c.playerId) : undefined;

  switch (topic) {
    case "PREVIEW": {
      if (c.derby) {
        if (isBlunt) return `Hela stan kokar inför derbyt mot ${opp}. Tål du pressen om det blir förlust?`;
        if (isCritical) return `Derbyt mot ${opp} blir ert första riktiga prov. Är defensiven stabil nog?`;
        if (isAnalytic) return `Hur ser den taktiska matchplanen ut för att låsa upp ${opp}:s försvarsspel i derbyt?`;
        if (isCurious) return `Vad är känslan i spelartruppen inför prestigemötet mot ${opp}?`;
        if (isLocal) return `Alla på läktaren lever för det här derbyt mot ${opp}. Hur ska ni göra hemmapubliken stolt?`;
        return `Vad betyder derbyt mot ${opp} för dig och laget?`;
      }
      if (isBlunt) return `Många räknar bort er mot ${opp}. Har ni ens en chans?`;
      if (isAnalytic) return `Vilka taktiska nycklar blir avgörande mot ${opp}:s uppställda spel?`;
      if (isLocal) return `Supportrarna ser fram emot matchen mot ${opp}. Hur laddar ni?`;
      return `Hur ser du på mötet med ${opp}?`;
    }
    case "RIVAL_RESPONSE": {
      if (c.detail) {
        if (isBlunt) return `${rival ?? "Motståndartränaren"} skickade en passning: ”${c.detail}”. Tar du det personligt?`;
        if (isCritical) return `${rival ?? "Tränaren"} hävdar: ”${c.detail}”. Har han en poäng i sin kritik?`;
        return `${rival ?? "Motståndartränaren"} sa: ”${c.detail}”. Vad svarar du på det?`;
      }
      return `${rival ?? "Tränaren"} har uttalat sig om matchen. Vad är din reaktion?`;
    }
    case "AFTER_WIN": {
      if (player && c.detail) {
        if (isBlunt) return `${player} dominerade med ${c.detail}. Är ni helt beroende av hans individuella klass?`;
        if (isAnalytic) return `${player} levererade ${c.detail}. Hur skapade grundspelet lägena för honom?`;
        if (isLocal) return `${player} bjöd på en magisk kväll med ${c.detail}! Hur stolt är du över insatsen?`;
        if (isCritical) return `${player} bar offensiven med ${c.detail}, men bakåt darrade det. Är du nöjd med helheten?`;
        if (isCurious) return `${player} glänste med ${c.detail}. Vad sa ni till varandra efter matchen?`;
        return `${player} stack ut med ${c.detail}. Hur viktig var hans insats i dag?`;
      }
      if (c.detail) {
        if (isAnalytic) return `Det blev ${c.detail}. Hur väl följde laget den taktiska matchplanen?`;
        if (isLocal) return `Det blev ${c.detail}! Fantastiskt jubel i hallen. Hur känns det i hjärtat just nu?`;
        if (isBlunt) return `Det blev ${c.detail}. Var det här ett styrkebesked som tystar tvivlarna?`;
        if (isCritical) return `Det blev ${c.detail}. Ni vinner, men spelet hackade i perioder – vad måste åtgärdas?`;
        if (isCurious) return `Det blev ${c.detail}. Vad var nyckeln i omklädningsrummet under pausen?`;
        return `Det blev ${c.detail}. Vad avgjorde till er fördel i kväll?`;
      }
      return isBlunt ? "Är ni nu ett topplag på riktigt?" : "Vad avgjorde matchen i dag?";
    }
    case "AFTER_DEFEAT": {
      if (player && c.detail) {
        if (isBlunt) return `${player} svarade för ${c.detail}, men ni faller ändå tungt. Hur kan resten av laget svika så?`;
        if (isCritical) return `${player} stod för ${c.detail}, men försvaret läckte. Varför räckte inte det offensiva övertaget?`;
        if (isAnalytic) return `${player} noterades för ${c.detail}, men motståndarna neutraliserade ert övriga anfall. Vad brast taktiskt?`;
        if (isLocal) return `${player} slet med ${c.detail}, men det räckte inte. Hur samlar du laget efter den här smällen?`;
        if (isCurious) return `${player} visade vägen med ${c.detail}. Hur var tongångarna i omklädningsrummet efteråt?`;
        return `${player} svarade för ${c.detail}, men det räckte inte till seger. Vad saknades i dag?`;
      }
      if (c.detail) {
        if (isBlunt) return `Det blev ${c.detail}. Var det här ett rent haveri från er sida?`;
        if (isCritical) return `Det blev ${c.detail}. Borde du inte ha reagerat med timeout och formationsbyte tidigare?`;
        if (isAnalytic) return `Det blev ${c.detail}. Motståndarna läste era anfallsmönster – hur ser din taktiska analys ut?`;
        if (isLocal) return `Det blev ${c.detail}. En tung kväll för supportrarna. Hur ska ni resa er till nästa match?`;
        if (isCurious) return `Det blev ${c.detail}. Vad gick genom huvudet vid slutsignalen?`;
        return `Det blev ${c.detail}. Vad gick fel i matchplanen?`;
      }
      return isBlunt ? "Var det här pinsamt?" : "Vad gick fel i dag?";
    }
    case "REFEREE": {
      if (isBlunt) return `${c.detail ? `${c.detail} ` : ""}Känner du dig rånad av domartrion i dag?`;
      if (isCritical) return `${c.detail ? `${c.detail} ` : ""}Påverkade domarnivån matchens utgång avgörande?`;
      return `${c.detail ? `${c.detail} ` : ""}Vad tycker du om domarinsatsen?`;
    }
    case "PLAYER_UNHAPPY": {
      if (isBlunt) return `${playerName(state, c.playerId)} kräver att få lämna. Har du tappat kontrollen över spelaren?`;
      if (isCritical) return `${playerName(state, c.playerId)} är missnöjd med sin roll. Borde inte klubben hanterat detta bättre?`;
      return `${playerName(state, c.playerId)} vill lämna klubben. Hur ser du på det?`;
    }
    case "BOARD_PRESSURE": {
      if (isBlunt) return "Sitter du löst på tränarposten nu?";
      if (isCritical) return "Resultaten sviker och styrelsen oroar sig. Har du förtroendet kvar?";
      return "Hur ser du på styrelsens oro?";
    }
    case "TRANSFER": {
      if (isBlunt) return `Varför sålde ni ${playerName(state, c.playerId)}? Gav styrelsen upp säsongen?`;
      if (isAnalytic) return `Hur ska truppen kompensera för tappet av ${playerName(state, c.playerId)} spelmässigt?`;
      return `Varför sålde ni ${playerName(state, c.playerId)}?`;
    }
    case "APPOINTMENT": {
      if (isBlunt) return "Kritiker menar att uppdraget är för stort för dig. Vad svarar du dem?";
      if (isLocal) return "Välkommen till klubben! Hur känns det att kliva in i den här anrika föreningen?";
      return "Vad ska supportrarna förvänta sig av dig?";
    }
    case "POOR_FORM": {
      if (isBlunt) return c.detail ? `${c.detail} Har du tappat omklädningsrummet?` : "Har du tappat omklädningsrummet?";
      if (isCritical) return c.detail ? `${c.detail} Vad talar för att du har verktygen att bryta raset?` : "Vad talar för att du har verktygen att bryta raset?";
      return c.detail ? `${c.detail} Hur vänder ni den här trenden?` : "Hur vänder ni den här trenden?";
    }
    case "DISCIPLINE": {
      if (isBlunt) return "Du är anmäld till disciplinnämnden. Ångrar du ditt beteende?";
      return "Du är anmäld till disciplinnämnden. Vad har du för kommentar?";
    }
    case "TACTICS": {
      if (isAnalytic) return "Hur balanserade du tempo och avslutsval i ert uppställda anfallsspel under matchen?";
      if (isCritical) return "Varför dröjde ni så länge med att justera försvarsformationen när motståndarna fick utdelning?";
      if (isBlunt) return "Motståndarna läste era taktiska drag som en öppen bok. Var planen för naiv?";
      if (isCurious) return "Hur tänkte du kring era specialformationer och byten i dag?";
      if (isLocal) return "Publiken uppskattade ert modiga spel i dag! Hur viktigt är det att spela attraktiv handboll?";
      return "Hur utvärderar du lagets taktiska genomförande i dag?";
    }
    case "INJURY": {
      if (isAnalytic) return `Hur påverkar frånvaron av ${player ?? "spelaren"} er taktiska struktur och belastning på övriga niometersspelare?`;
      if (isCritical) return `Varför matchades ${player ?? "spelaren"} så hårt om det fanns risk för överbelastning?`;
      if (isBlunt) return `${player ?? "Nyckelspelaren"} är skadad. Hur ska ni överleva säsongen utan er stjärna?`;
      if (isLocal) return `Hela klubben lider med ${player ?? "spelaren"}. Vad har du för hälsning till supportrarna om hans status?`;
      if (isCurious) return `Hur mår ${player ?? "spelaren"} och hur har laget reagerat på skadebeskedet?`;
      return `Hur ser prognosen ut för ${player ?? "spelaren"} och hur påverkar det laget?`;
    }
    case "SQUAD_SELECTION": {
      if (isBlunt) return `${player ? `Att bänka ${player}` : "Din matchtrupp"} väcker starka reaktioner. Är du inte rädd för missnöje?`;
      if (isAnalytic) return "Vad låg bakom fördelningen av speltid och roller i dagens matchtrupp?";
      if (isCritical) return "Varför fick inte de hetaste spelarna mer förtroende under slutminuterna?";
      if (isCurious) return "Hur resonerar du när du sätter ihop startsjuan inför en så här viktig match?";
      if (isLocal) return "Roligt att se egna produkter i truppen! Hur viktigt är det för klubbens identitet?";
      return "Hur motiverar du dagens laguttagning och bänkning?";
    }
    case "FINANCES": {
      if (isBlunt) return "Räcker klubbens ekonomi verkligen till för att hålla er kvar i toppen?";
      if (isCritical) return "Klubbens lönebudget är under press. Hur påverkar det dina möjligheter att värva spets?";
      if (isAnalytic) return "Hur ser balansen ut mellan truppkostnader, transfers och långsiktig hållbarhet?";
      if (isCurious) return "Hur nära samarbetar du med styrelsen kring de ekonomiska ramarna?";
      if (isLocal) return "Föreningen bygger sunt och ansvarsfullt. Hur känns det att leda det bygget?";
      return "Hur påverkar föreningens ekonomiska situation det sportsliga arbetet?";
    }
    case "STAFF": {
      if (isAnalytic) return "Hur ser ansvarsfördelningen ut mellan dig och dina assisterande tränare vid taktiska beslut?";
      if (isCritical) return "Har ni tillräcklig kompetens i staben kring analys och fysträning för modern elithandboll?";
      if (isBlunt) return "Finns det delade meningar inom ledarstaben om lagets riktning?";
      if (isCurious) return "Hur ser dynamiken ut i ledarrummet före och efter match?";
      if (isLocal) return "Det märks att ni är ett sammansvetsat team på bänken. Vad betyder staben för dig?";
      return "Hur fungerar samarbetet inom tränar- och ledarstaben?";
    }
    case "LEAGUE_POSITION": {
      if (isBlunt) return "Er tabellplacering är under förväntan. När börjar alarmklockorna ringa?";
      if (isCritical) return "Ni tappar mark mot toppen. Vad talar för att ni kan vända säsongen?";
      if (isAnalytic) return "Tittar vi på poängsnitt och målskillnad ligger ni i fas med målen. Hur analyserar du läget?";
      if (isLocal) return "Tabelltoppen är inom räckhåll! Vågar supportrarna börja drömma om medalj?";
      if (isCurious) return "Pratar ni mycket om tabellen och slutspelsstrecket i omklädningsrummet?";
      return "Hur ser du på lagets position i tabellen just nu?";
    }
    case "PROMISES": {
      if (isBlunt) return `${player ? `Har du brutit dina löften till ${player}` : "Har du brutit dina löften till spelarna"}?`;
      if (isCritical) return `${player ? `${player} har inte fått den roll han utlovades.` : "Spelare känner att löften inte infrias."} Hur hanterar du det?`;
      if (isAnalytic) return "Hur balanserar du individuella kontraktslöften mot vad som är taktiskt bäst för laget?";
      if (isCurious) return "Hur håller du dialogen levande med spelare som vill ha mer speltid?";
      if (isLocal) return "Ett lag bygger på förtroende. Hur skapar ni harmoni i truppen?";
      return "Hur ser du på situationen kring de överenskommelser som gjorts med spelartruppen?";
    }
  }
}

/** Opens a press conference with up to three questions from the club's own and wider media. */
export function openPress(state: CareerState, date: string, spec: { key: string; kind: PressConference["kind"]; title: string; context: string; fixtureId?: string; expiresOn: string; topics: PressContext[] }, emit: Emit): CareerState {
  const m0 = mediaOf(state);
  const id = `press:${spec.key}`;
  if (m0.press[id]) return state;
  // HM-ALPHA3-M10: one sitting a day -- an interview is not opened on top of a conference already open from today
  // (two transfer-request interviews were opened on the same day). The news story itself is still published.
  if (spec.kind === "INTERVIEW" && Object.values(m0.press).some((p) => p.date === date && p.status === "OPEN")) return state;
  const outlets = [...(CLUB_MEDIA[state.playerClubId]?.outlets.slice(0, 2) ?? []), "handbollskanalen"];
  if (spec.topics.some((t) => t.derby || t.topic === "RIVAL_RESPONSE" || t.topic === "REFEREE")) outlets.push(hash(spec.key) < 0.5 ? "aftonbladet" : "expressen");
  let m: MediaState = m0;
  const questions: PressQuestion[] = spec.topics.slice(0, 3).map((t, i) => {
    const outletId = outlets[i % outlets.length]!;
    const j = journalistFor(m, outletId, `${spec.key}:${i}`);
    m = j.media;
    return { id: `q${i}`, journalistId: j.journalist.id, topic: t.topic, text: questionText(t.topic, t, state, j.journalist.style), answers: answersFor(state, t), playerId: t.playerId, rivalStaffId: t.rivalStaffId };
  });
  const press: PressConference = { id, date, kind: spec.kind, title: spec.title, context: spec.context, fixtureId: spec.fixtureId, outletIds: [...new Set(outlets)], questions, contexts: spec.topics.slice(0, 3), status: "OPEN", expiresOn: spec.expiresOn };
  m = { ...m, press: { ...m.press, [id]: press } };
  emit(buildClubEvent("MEDIA", id, date, "IMPORTANT", spec.title, `${spec.context} ${questions.length} frågor väntar. Svara själv eller låt assisterande tränaren sköta det.`, [{ route: "PRESS", pressId: id }]));
  return { ...state, media: m };
}

/** What an answer does, in the situation it was given. Bounded and explained. */
export function effectsOf(state: CareerState, q: PressQuestion, tone: Tone, ctx: PressContext, damp = 1): Consequence[] {
  const out: Consequence[] = [];
  // Words lift the stands less the higher they already are: talk alone cannot carry sentiment.
  const headroom = 1 - Math.max(0, mediaOf(state).supporters) / 60;
  const add = (area: Consequence["area"], delta: number, text: string) => { const d = Math.round(delta * damp * (area === "SUPPORTERS" && delta > 0 ? headroom : 1)); if (d !== 0) out.push({ area, delta: d, text }); };
  const rival = ctx.rivalStaffId ? coachPersona(state, ctx.rivalStaffId) : null;
  const touchy = rival ? rival.sensitivity >= 4 || rival.style === "PROUD" : false;
  switch (`${ctx.topic}:${tone}`) {
    case "PREVIEW:CONFIDENT": add("TEAM", 2, "Laget gillade självförtroendet"); add("PRESSURE", 2, "Förväntningarna inför matchen steg"); add("SUPPORTERS", 2, "Supportrarna laddar"); break;
    case "PREVIEW:PROVOCATIVE": add("SUPPORTERS", 4, "Supportrarna älskade det"); add("MEDIA", 2, "Kvällspressen fick sin rubrik"); add("PRESSURE", 3, "Nu måste ni leverera"); if (rival) add("RIVAL", touchy ? -14 : -9, `${rival.name} tog illa upp`); break;
    case "PREVIEW:HUMOROUS": add("MEDIA", 2, "Journalisterna skrattade"); add("SUPPORTERS", 1, "Lättsam stämning"); break;
    case "PREVIEW:DIPLOMATIC": if (rival) add("RIVAL", 3, `${rival.name} uppskattade respekten`); break;
    case "PREVIEW:DECLINE": add("MEDIA", -2, "Pressen tyckte att du var tråkig"); break;
    case "RIVAL_RESPONSE:DIPLOMATIC": if (rival) add("RIVAL", 6, `${rival.name} läste ditt svar`); add("BOARD", 1, "Styrelsen gillar lugnet"); break;
    case "RIVAL_RESPONSE:PROVOCATIVE": if (rival) add("RIVAL", touchy ? -18 : -12, `Fejden med ${rival.name} trappas upp`); add("SUPPORTERS", 3, "Supportrarna står bakom dig"); add("MEDIA", 2, "Fler rubriker"); add("BOARD", -1, "Styrelsen vill ha arbetsro"); break;
    case "RIVAL_RESPONSE:HUMOROUS": if (rival) add("RIVAL", touchy ? -9 : -3, rival.style === "JOKER" ? `${rival.name} skrattade med` : `${rival.name} tyckte inte att det var roligt`); add("MEDIA", 2, "Svaret spreds"); break;
    case "RIVAL_RESPONSE:CONFIDENT": add("TEAM", 2, "Laget tände till"); add("PRESSURE", 1, "Ni måste visa det på planen"); break;
    case "RIVAL_RESPONSE:DECLINE": add("MEDIA", -1, "Frågan hängde kvar"); break;
    case "AFTER_WIN:PROTECTIVE": add("TEAM", 2, "Spelarna växte av berömmet"); break;
    case "AFTER_WIN:CONFIDENT": add("SUPPORTERS", 2, "Supportrarna drömmer"); add("BOARD", 1, "Styrelsen gillar ambitionen"); add("PRESSURE", 1, "Förväntningarna stiger"); break;
    case "AFTER_WIN:HUMOROUS": add("MEDIA", 2, "Ett citat som spreds"); break;
    case "AFTER_DEFEAT:PROTECTIVE": add("TEAM", 2, "Laget slöt upp kring dig"); add("BOARD", -1, "Styrelsen vill se ansvar i resultaten"); break;
    case "AFTER_DEFEAT:CRITICAL": add("TEAM", -1, "Inte alla tog kritiken väl"); add("BOARD", 1, "Styrelsen gillade tydligheten"); break;
    case "AFTER_DEFEAT:CONFIDENT": add("SUPPORTERS", 1, "Supportrarna lugnades"); break;
    case "AFTER_DEFEAT:DECLINE": add("MEDIA", -2, "Pressen blev otålig"); break;
    case "REFEREE:DIPLOMATIC": add("SUPPORTERS", -1, "Supportrarna ville att du skulle stå upp för laget"); break;
    case "REFEREE:CRITICAL": add("SUPPORTERS", 2, "Supportrarna höll med"); add("MEDIA", 1, "Saklig kritik citerades"); break;
    case "REFEREE:PROVOCATIVE": add("SUPPORTERS", 3, "Supportrarna jublade"); add("MEDIA", 2, "Kvällspressen slog upp det"); add("BOARD", -2, "Styrelsen ogillar att klubben hamnar i blåsväder"); add("DISCIPLINE", 1, "Uttalandet anmäls till SHF:s disciplinnämnd"); break;
    case "REFEREE:HUMOROUS": add("MEDIA", 2, "Ironin spreds"); add("SUPPORTERS", 1, "Supportrarna skrattade"); break;
    case "PLAYER_UNHAPPY:PROTECTIVE": add("PLAYER", 4, "Spelaren kände sig sedd"); add("TEAM", 1, "Truppen märkte omtanken"); break;
    case "PLAYER_UNHAPPY:CRITICAL": add("PLAYER", -6, "Spelaren tog illa upp"); add("BOARD", 1, "Styrelsen gillade tydligheten"); break;
    case "PLAYER_UNHAPPY:DIPLOMATIC": add("PLAYER", 1, "Spelaren uppskattade lugnet"); break;
    case "BOARD_PRESSURE:CONFIDENT": add("BOARD", 1, "Styrelsen noterade självförtroendet"); add("PRESSURE", 2, "Nu väntar alla på resultaten"); break;
    case "BOARD_PRESSURE:DIPLOMATIC": add("BOARD", 2, "Styrelsen uppskattade lojaliteten"); break;
    case "BOARD_PRESSURE:CRITICAL": add("BOARD", -4, "Styrelsen tog illa upp"); add("SUPPORTERS", 2, "Supportrarna förstår dig"); break;
    case "BOARD_PRESSURE:HUMOROUS": add("BOARD", -1, "Styrelsen tyckte att du var nonchalant"); add("MEDIA", 1, "Ett citat som spreds"); break;
    case "TRANSFER:CONFIDENT": add("SUPPORTERS", 1, "Supportrarna lugnades"); break;
    case "TRANSFER:CRITICAL": add("BOARD", -2, "Styrelsen gillade inte kritiken"); add("SUPPORTERS", 1, "Supportrarna uppskattade ärligheten"); break;
    case "APPOINTMENT:CONFIDENT": add("SUPPORTERS", 3, "Supportrarna tände till"); add("PRESSURE", 2, "Förväntningarna steg direkt"); break;
    case "APPOINTMENT:DIPLOMATIC": add("BOARD", 1, "Ett lugnt första intryck"); break;
    case "APPOINTMENT:HUMOROUS": add("MEDIA", 2, "Lokalpressen gillade dig direkt"); break;
    case "POOR_FORM:PROTECTIVE": add("TEAM", 2, "Laget slöt upp"); break;
    case "POOR_FORM:CRITICAL": add("TEAM", -1, "Alla tog inte kritiken väl"); add("BOARD", 1, "Styrelsen gillade kravet"); break;
    case "POOR_FORM:CONFIDENT": add("PRESSURE", 2, "Nu måste det vända"); add("SUPPORTERS", 1, "Supportrarna hoppas"); break;
    case "POOR_FORM:DECLINE": add("MEDIA", -2, "Pressen blev otålig"); break;
    case "DISCIPLINE:DIPLOMATIC": add("MEDIA", 1, "Ursäkten togs emot"); add("SUPPORTERS", -1, "Några supportrar ville att du skulle stå på dig"); break;
    case "DISCIPLINE:CRITICAL": add("SUPPORTERS", 2, "Supportrarna stod bakom dig"); add("BOARD", -1, "Styrelsen ville ha en ursäkt"); break;
    case "TACTICS:CONFIDENT": add("TEAM", 2, "Laget stärktes av tränarens tydliga linje"); add("PRESSURE", 1, "Förväntningar på fortsatt utdelning"); break;
    case "TACTICS:DIPLOMATIC": add("BOARD", 1, "Styrelsen uppskattade den balanserade analysen"); break;
    case "TACTICS:CRITICAL": add("TEAM", -1, "Kritiken mot spelet utan boll skärpte kraven"); add("BOARD", 1, "Tydlig kravbild uppskattades"); break;
    case "TACTICS:HUMOROUS": add("MEDIA", 2, "Den avväpnande kommentaren spreds"); add("SUPPORTERS", 1, "Lättsam stämning"); break;
    case "INJURY:PROTECTIVE": add("PLAYER", 3, "Spelaren kände fullt stöd från klubben"); add("TEAM", 1, "Truppen märkte omsorgen"); break;
    case "INJURY:CONFIDENT": add("TEAM", 2, "Reserverna tände till av tränarens förtroende"); add("SUPPORTERS", 1, "Supportrarna lugnades"); break;
    case "INJURY:DIPLOMATIC": add("BOARD", 1, "Lugnt och ansvarsfullt besked"); break;
    case "INJURY:CRITICAL": add("MEDIA", 1, "Ifrågasättandet av belastningen skapade rubriker"); add("BOARD", -1, "Styrelsen ogillar intern kritik"); break;
    case "SQUAD_SELECTION:CONFIDENT": add("TEAM", 2, "Tydlig auktoritet från tränaren"); add("REPUTATION", 1, "Ledarskapet stärktes"); break;
    case "SQUAD_SELECTION:PROTECTIVE": add("TEAM", 2, "Hela truppen slöt upp kring lagbygget"); add("SUPPORTERS", 1, "Supportrarna gillar lagsammanhållningen"); break;
    case "SQUAD_SELECTION:CRITICAL": add("TEAM", -1, "Hårdare kravbild i truppen"); add("BOARD", 1, "Styrelsen gillar prestationsfokuset"); break;
    case "SQUAD_SELECTION:DECLINE": add("MEDIA", -1, "Pressen ville ha svar om bänkningen"); break;
    case "FINANCES:DIPLOMATIC": add("BOARD", 2, "Styrelsen uppskattade det ekonomiska ansvaret"); break;
    case "FINANCES:CRITICAL": add("BOARD", -3, "Kravet på större resurser satte press på styrelsen"); add("SUPPORTERS", 2, "Supportrarna delar din syn"); break;
    case "FINANCES:CONFIDENT": add("SUPPORTERS", 2, "Framtidstron stärktes i föreningen"); add("BOARD", 1, "Styrelsen gillade optimismen"); break;
    case "FINANCES:DECLINE": add("MEDIA", -1, "Ekonomiska frågor lämnades obesvarade"); break;
    case "STAFF:CONFIDENT": add("TEAM", 2, "Ledarstaben känner fullt förtroende"); add("REPUTATION", 1, "Professionellt intryck"); break;
    case "STAFF:PROTECTIVE": add("TEAM", 3, "Staben uppskattade att deras arbete lyftes fram"); break;
    case "STAFF:DIPLOMATIC": add("BOARD", 1, "Lugnt och stabilt ledarskap"); break;
    case "STAFF:CRITICAL": add("BOARD", -1, "Kravet på bättre resurser runt laget noterades"); add("MEDIA", 1, "Staben i fokus"); break;
    case "LEAGUE_POSITION:CONFIDENT": add("SUPPORTERS", 2, "Supportrarna drömmer"); add("PRESSURE", 2, "Förväntningarna på slutspelsplats stiger"); break;
    case "LEAGUE_POSITION:DIPLOMATIC": add("BOARD", 1, "Styrelsen uppskattar match-för-match-fokuset"); break;
    case "LEAGUE_POSITION:CRITICAL": add("TEAM", -1, "Kritiken mot tabellplaceringen skärpte kraven"); add("BOARD", 1, "Ambitiös signal"); break;
    case "LEAGUE_POSITION:PROTECTIVE": add("TEAM", 2, "Laget kände tränarens beskydd"); add("SUPPORTERS", 1, "Supportrarna sluter upp"); break;
    case "PROMISES:PROTECTIVE": add("PLAYER", 4, "Spelaren lugnades av tränarens besked"); add("TEAM", 1, "Truppen ser att löften hålls"); break;
    case "PROMISES:DIPLOMATIC": add("PLAYER", 1, "Konstruktiv dialog dämpade oron"); add("BOARD", 1, "Lugnt hanterat"); break;
    case "PROMISES:CRITICAL": add("PLAYER", -4, "Hård markering – spelaren måste bevisa sig"); add("BOARD", 1, "Tydlig linje"); break;
    case "PROMISES:CONFIDENT": add("REPUTATION", 1, "Tränaren visade auktoritet"); add("TEAM", 1, "Lagets bästa sattes i första rummet"); break;
  }
  void q;
  return out;
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Answers a press conference: effects are applied, the media write it up, a provocation about referees is reported. */
export function answerPress(state: CareerState, pressId: string, answers: Record<string, Tone>, emit: Emit, by: PressConference["answeredBy"] = "MANAGER"): CareerState {
  const press = mediaOf(state).press[pressId];
  if (!press || press.status !== "OPEN") throw new Error("Presskonferensen är redan avslutad.");
  if (press.questions.some((q) => !answers[q.id])) throw new Error("Svara på alla frågor.");
  const ctxs = press.contexts ?? [];
  const damp = by === "MANAGER" ? 1 : 0.5;
  let next = state;
  const all: Consequence[] = [];
  press.questions.forEach((q, i) => {
    const ctx = ctxs[i] ?? { topic: q.topic, playerId: q.playerId, rivalStaffId: q.rivalStaffId };
    const effects = effectsOf(next, q, answers[q.id]!, ctx, damp);
    for (const c of effects) {
      next = applyConsequence(next, c, ctx, press, answers[q.id]!);
      all.push(c);
    }
  });
  // Media relations: the outlets in the room remember how they were treated.
  const tones = Object.values(answers);
  const mediaDelta = tones.filter((t) => t === "HUMOROUS").length * 2 - tones.filter((t) => t === "DECLINE").length * 2 + (tones.includes("PROVOCATIVE") ? 1 : 0);
  next = withMedia(next, (m) => ({ ...m, outletRelations: Object.fromEntries([...Object.entries(m.outletRelations), ...press.outletIds.map((o) => [o, clampN((m.outletRelations[o] ?? 0) + mediaDelta, -50, 50)] as const)]) }));
  next = withMedia(next, (m) => ({ ...m, press: { ...m.press, [pressId]: { ...press, status: by === "MANAGER" ? "ANSWERED" : "DELEGATED", answers, answeredBy: by, consequences: all } } }));
  // The write-up: the boldest answer becomes the headline.
  const boldest = press.questions
    .map((q) => ({ q, a: q.answers.find((x) => x.tone === answers[q.id]) ?? q.answers[0] }))
    .filter((x): x is { q: PressQuestion; a: PressAnswer } => Boolean(x.a))
    .sort((x, y) => rank(y.a.tone) - rank(x.a.tone))[0];
  if (boldest) {
    const speaker = by === "MANAGER" ? "Tränaren" : by.name;
    const own = getClub(state.playerClubId)?.shortName ?? "";
    const primaryOutlet = press.outletIds[0] ? (MEDIA_OUTLETS[press.outletIds[0]]?.name ?? "media") : "media";
    next = publish(next, { key: `interview:${pressId}`, kind: "INTERVIEW", date: next.gameDate, importance: boldest.a.tone === "PROVOCATIVE" ? 4 : rank(boldest.a.tone) >= 3 ? 3 : 2, clubIds: [state.playerClubId, ...(ctxs.find((c) => c.opponentId)?.opponentId ? [ctxs.find((c) => c.opponentId)!.opponentId!] : [])], personIds: ["manager"], fixtureId: press.fixtureId, facts: { headline: `${own}-tränaren: ”${trimQuote(boldest.a.text)}”`, standfirst: `${speaker} mötte pressen – ${press.title}.` }, quote: { who: by === "MANAGER" ? `Huvudtränare, ${own}` : `${by.name}, assisterande tränare`, text: boldest.a.text }, destinations: [{ route: "PRESS", pressId }] });

    emit(buildClubEvent(
      "MEDIA",
      `media-article:${pressId}`,
      next.gameDate,
      boldest.a.tone === "PROVOCATIVE" ? "IMPORTANT" : "INFORMATION",
      `${own}: ”${trimQuote(boldest.a.text)}”`,
      `${speaker} mötte pressen efter ${press.title.toLowerCase()}. Uttalandena har publicerats i ${primaryOutlet}.`,
      [{ route: "PRESS", pressId }, { route: "MEDIA" }]
    ));
  }
  return next;
}

const rank = (t: Tone) => ({ PROVOCATIVE: 5, CRITICAL: 4, HUMOROUS: 3, CONFIDENT: 3, PROTECTIVE: 2, DIPLOMATIC: 1, DECLINE: 0 })[t];
const trimQuote = (t: string) => (t.length > 70 ? `${t.slice(0, 67).trimEnd()}…` : t);

function applyConsequence(state: CareerState, c: Consequence, ctx: PressContext, press: PressConference, tone: Tone): CareerState {
  switch (c.area) {
    case "PLAYER": {
      if (!ctx.playerId) return state;
      const p = personalityOf(state, ctx.playerId);
      const scaled = c.delta < 0 ? Math.round(c.delta * (p.temperament >= 14 ? 1.3 : p.professionalism >= 14 ? 0.7 : 1)) : c.delta;
      return addMoraleShock(state, ctx.playerId, scaled, `Det du sa i media: ${c.text.toLowerCase()}`, 21);
    }
    case "TEAM": {
      let next = state;
      for (const id of managerSquadIds(state)) {
        const p = personalityOf(state, id);
        // Public criticism: professionals take it as a challenge, the sensitive lose a little more.
        const delta = c.delta < 0 ? (p.professionalism >= 14 ? 1 : p.temperament >= 14 ? c.delta - 1 : c.delta) : c.delta;
        if (delta !== 0) next = addMoraleShock(next, id, delta, `Tränarens ord i media`, 14);
      }
      return next;
    }
    case "BOARD": return withMedia(state, (m) => ({ ...m, boardMood: clampN(m.boardMood + c.delta, -6, 6) }));
    case "SUPPORTERS": return withMedia(state, (m) => ({ ...m, supporters: clampN(m.supporters + c.delta, -50, 50) }));
    case "MEDIA": return state; // applied once per conference above
    case "RIVAL": return ctx.rivalStaffId ? withMedia(state, (m) => adjustRelation(m, "manager", ctx.rivalStaffId!, c.delta, state.gameDate, `${press.title}: du var ${tone === "PROVOCATIVE" ? "provocerande" : tone === "HUMOROUS" ? "skämtsam" : tone === "DIPLOMATIC" ? "diplomatisk" : "rak"}`)) : state;
    case "PRESSURE": return press.fixtureId ? withMedia(state, (m) => ({ ...m, pressure: { ...m.pressure, [press.fixtureId!]: { level: clampN((m.pressure[press.fixtureId!]?.level ?? 0) + c.delta, 0, 5), reason: c.text } } })) : state;
    case "REPUTATION": return state.managerCareer ? { ...state, managerCareer: { ...state.managerCareer, reputation: clampN(state.managerCareer.reputation + c.delta, 5, 95) } } : state;
    case "DISCIPLINE": return openDisciplineCase(state, { statement: press.questions.flatMap((q) => q.answers.filter((a) => a.tone === tone && q.topic === "REFEREE").map((a) => a.text))[0] ?? "", pressId: press.id, fixtureId: press.fixtureId, kind: tone === "PROVOCATIVE" ? "INTEGRITY" : "SARCASM" });
  }
}

/** The assistant coach takes the conference: calm, diplomatic answers, half the effect either way. */
export function delegatePress(state: CareerState, pressId: string, emit: Emit): CareerState {
  const press = mediaOf(state).press[pressId];
  if (!press || press.status !== "OPEN") throw new Error("Presskonferensen är redan avslutad.");
  const assistant = (state.staffRoster[state.playerClubId] ?? []).find((m) => m.roles[0] === "ASSISTANT_COACH");
  if (!assistant) throw new Error("Klubben har ingen assisterande tränare som kan ta presskonferensen.");
  const answers = Object.fromEntries(press.questions.map((q) => [q.id, (q.answers.find((a) => a.tone === "DIPLOMATIC") ?? q.answers.find((a) => a.tone === "DECLINE") ?? q.answers[0]!).tone]));
  return answerPress(state, pressId, answers, emit, { staffId: assistant.id, name: assistant.displayName });
}

/** The manager skips/declines the conference: minor media penalty, neutral squad morale. */
export function skipPress(state: CareerState, pressId: string, emit: Emit): CareerState {
  const press = mediaOf(state).press[pressId];
  if (!press || press.status !== "OPEN") throw new Error("Presskonferensen är redan avslutad.");
  const consequences: Consequence[] = [
    { area: "MEDIA", delta: -3, text: "Pressen blev irriterad över att du uteblev från pressmötet" },
    { area: "SUPPORTERS", delta: -1, text: "Supportrarna ville höra tränarens röst efter matchen" },
  ];
  let next = state;
  for (const c of consequences) {
    next = applyConsequence(next, c, { topic: "AFTER_DEFEAT" }, press, "DECLINE");
  }
  const tones: Record<string, Tone> = Object.fromEntries(press.questions.map((q) => [q.id, "DECLINE"]));
  next = withMedia(next, (m) => ({
    ...m,
    outletRelations: Object.fromEntries(
      press.outletIds.map((o) => [o, clampN((m.outletRelations[o] ?? 0) - 3, -50, 50)])
    ),
    press: {
      ...m.press,
      [pressId]: {
        ...press,
        status: "DECLINED",
        answers: tones,
        answeredBy: "MANAGER",
        consequences,
      },
    },
  }));
  const own = getClub(state.playerClubId)?.shortName ?? "Klubben";
  emit(buildClubEvent(
    "MEDIA",
    `media-skipped:${pressId}`,
    next.gameDate,
    "INFORMATION",
    `${own} uteblev från presskonferensen`,
    `Ingen från ledarstaben mötte journalisterna efter ${press.title.toLowerCase()}. Media rapporterar om frånvaron.`,
    [{ route: "PRESS", pressId }, { route: "MEDIA" }]
  ));
  return next;
}

export function openPressConferences(state: CareerState): PressConference[] {
  return Object.values(mediaOf(state).press).filter((p) => p.status === "OPEN" && p.expiresOn >= state.gameDate).sort((a, b) => a.date.localeCompare(b.date));
}

/** Expires stale conferences; with routine delegation on, the assistant takes them. */
export function progressPress(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const p of Object.values(mediaOf(next).press)) {
    if (p.status !== "OPEN") continue;
    if (mediaOf(next).delegatePress && p.questions.every((q) => q.topic !== "DISCIPLINE")) {
      try { next = delegatePress(next, p.id, emit); continue; } catch { /* no assistant: falls through to expiry */ }
    }
    if (p.expiresOn < date) next = withMedia(next, (m) => ({ ...m, press: { ...m.press, [p.id]: { ...p, status: "EXPIRED" } } }));
  }
  return next;
}
