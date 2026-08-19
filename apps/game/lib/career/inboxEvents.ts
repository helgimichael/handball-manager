import type { FastMatchResult } from "@handball-manager/game-simulation";
import { getClub } from "../game-data";
import type { InboxMessage } from "../game-data";
import type { CareerFixture } from "./types";

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `career-msg-${messageCounter}`;
}

export function buildPreMatchMessage(fixture: CareerFixture, playerClubId: string): InboxMessage {
  const opponentId = fixture.homeClubId === playerClubId ? fixture.awayClubId : fixture.homeClubId;
  const opponent = getClub(opponentId);
  const isHome = fixture.homeClubId === playerClubId;
  return {
    id: nextMessageId(),
    category: "Match",
    sender: "Assisterande tränare",
    subject: `Matchdag mot ${opponent?.shortName ?? "okänd motståndare"}`,
    preview: `${isHome ? "Hemma" : "Borta"} i Allsvenskan, omgång ${fixture.round}.`,
    body: [
      `${isHome ? "Hemmamatch" : "Bortamatch"} mot ${opponent?.name ?? "motståndaren"} i Allsvenskan, omgång ${fixture.round}.`,
      "Truppen är redo. Gå till matchförhandsvisningen för att se laguppställning och analys.",
    ],
    date: fixture.date,
    read: false,
    important: false,
  };
}

export function buildPostMatchMessage(fixture: CareerFixture, result: FastMatchResult, playerClubId: string): InboxMessage {
  const isHome = fixture.homeClubId === playerClubId;
  const own = getClub(playerClubId);
  const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
  const opponent = getClub(opponentId);
  const ownGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const outcome = ownGoals > oppGoals ? "vinst" : ownGoals < oppGoals ? "förlust" : "oavgjort";

  return {
    id: nextMessageId(),
    category: "Match",
    sender: "Assisterande tränare",
    subject: `${own?.shortName ?? "Vi"} ${ownGoals}–${oppGoals} ${opponent?.shortName ?? "Motståndare"}`,
    preview: `Resultat: ${outcome} i omgång ${fixture.round}.`,
    body: [
      `Matchen mot ${opponent?.name ?? "motståndaren"} slutade ${ownGoals}–${oppGoals} (${isHome ? "hemma" : "borta"}).`,
      outcome === "vinst"
        ? "Bra jobbat av truppen idag."
        : outcome === "förlust"
          ? "En tung dag på jobbet. Vi analyserar inför nästa match."
          : "Ett delat resultat idag.",
    ],
    date: fixture.date,
    read: false,
    important: outcome !== "oavgjort",
  };
}

export function buildSeasonCompleteMessage(finalPosition: number, seasonId: string): InboxMessage {
  return {
    id: nextMessageId(),
    category: "Styrelse",
    sender: "Klubbstyrelsen",
    subject: `Säsongen ${seasonId} är avslutad`,
    preview: `Slutplacering: ${finalPosition}:a plats i Allsvenskan.`,
    body: [
      `Allsvenskan-säsongen ${seasonId} är nu avslutad. Laget slutade på ${finalPosition}:a plats.`,
      "Tack för en genomförd säsong. Fler funktioner för säsongsavslut kommer i en senare version.",
    ],
    date: "",
    read: false,
    important: true,
  };
}
