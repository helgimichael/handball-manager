import type { InboxMessage } from "./types";

// Fictional inbox content.
export const INBOX_MESSAGES: readonly InboxMessage[] = [
  {
    id: "i-01",
    category: "Match",
    sender: "Mikael Lindgren",
    subject: "Inför IFK Karlskrona borta nästa helg",
    preview: "Karlskrona har vunnit fem raka hemma. Jag föreslår att vi tightar upp 6:0-försvaret runt centern...",
    body: [
      "Karlskrona har vunnit fem raka hemmamatcher och spelar ett snabbt kontringsspel via sina kanter.",
      "Jag föreslår att vi tightar upp 6:0-försvaret runt center och ber V6/H6 vara snabbare ut i press mot deras niohörn.",
      "Melvin är fullt tränad igen och kan vara ett alternativ från bänken om vi behöver bryta upp deras rytm.",
    ],
    date: "2026-08-19",
    read: false,
    important: true,
  },
  {
    id: "i-02",
    category: "Assisterande tränare",
    sender: "Mikael Lindgren",
    subject: "Veckans träningsrapport",
    preview: "Bra vecka totalt sett. Zachrisson och Johansson har båda visat stark form på passningsövningarna...",
    body: [
      "Bra vecka totalt sett. Zachrisson och Johansson har båda visat stark form på passningsövningarna.",
      "Holmgren är fortsatt borta med sin ljumskskada, ingen ny prognos ännu.",
      "Ungdomarna Ask och Wide sticker ut i intensitet — värt att fortsätta ge dem matchtid när läget tillåter.",
    ],
    date: "2026-08-18",
    read: false,
    important: false,
  },
  {
    id: "i-03",
    category: "Spelare",
    sender: "Eric Johansson",
    subject: "Vill prata om speltid",
    preview: "Hej. Jag skulle gärna vilja boka in ett möte för att prata om min roll i laget framöver...",
    body: [
      "Hej,",
      "Jag skulle gärna vilja boka in ett möte för att prata om min roll i laget framöver. Känner att jag tar ett steg till i min utveckling och vill förstå hur du ser på min plats i truppen.",
      "Hör av dig när det passar.",
      "/ Eric",
    ],
    date: "2026-08-17",
    read: true,
    important: false,
  },
  {
    id: "i-04",
    category: "Scouting",
    sender: "Rickard Öhman",
    subject: "Uppdatering: spelare vi bevakar",
    preview: "Har följt ett par intressanta namn i Norge och Danmark den senaste månaden, se bifogad lista...",
    body: [
      "Har följt ett par intressanta namn i Norge och Danmark den senaste månaden.",
      "Särskilt en 19-årig mittsexa på Fjellhammer sticker ut — spelförståelsen är redan på en hög nivå.",
      "Fortsätter bevakningen och återkommer med fördjupad rapport inom två veckor.",
    ],
    date: "2026-08-16",
    read: true,
    important: false,
  },
  {
    id: "i-05",
    category: "Styrelse",
    sender: "Klubbstyrelsen",
    subject: "Budget inför transferfönstret",
    preview: "Styrelsen har godkänt en utökad transferbudget inför resten av säsongen givet det starka resultatet...",
    body: [
      "Styrelsen har godkänt en utökad transferbudget inför resten av säsongen givet det starka resultatet hittills.",
      "Vi ser gärna en förstärkning på mittsexa eller pivot om rätt spelare blir tillgänglig.",
      "Återkom gärna med konkreta förslag inför nästa styrelsemöte.",
    ],
    date: "2026-08-14",
    read: true,
    important: true,
  },
  {
    id: "i-06",
    category: "Kontrakt",
    sender: "Klubbens administration",
    subject: "Kontraktspåminnelse: Jesper Zachrisson",
    preview: "Zachrissons kontrakt löper ut sommaren 2027. Enligt policy bör förhandling inledas inom 12 månader...",
    body: [
      "Jesper Zachrissons kontrakt löper ut sommaren 2027.",
      "Enligt klubbens policy bör förhandling om förlängning inledas inom 12 månader från utgång.",
      "Hör av dig till administrationen när du vill inleda samtal.",
    ],
    date: "2026-08-12",
    read: true,
    important: false,
  },
  {
    id: "i-07",
    category: "Träning",
    sender: "Jonas Wester",
    subject: "Fysstatus inför september",
    preview: "Generellt god belastningsbalans i truppen. Ett par spelare närmar sig hög kumulativ belastning...",
    body: [
      "Generellt god belastningsbalans i truppen den senaste månaden.",
      "Darj och Almqvist närmar sig hög kumulativ belastning — föreslår avlastning i minst en session per vecka.",
      "Ungdomsgruppen har utmärkt fysisk status och tål ökad volym.",
    ],
    date: "2026-08-10",
    read: true,
    important: false,
  },
];

export function getInboxMessages(): readonly InboxMessage[] {
  return INBOX_MESSAGES;
}

export function getUnreadCount(): number {
  return INBOX_MESSAGES.filter((m) => !m.read).length;
}
