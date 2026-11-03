import type { CSSProperties } from "react";
import { photoBackdrop } from "@/components/experience/visuals";

import arenaClubWide from "./assets/environments/env-arena-club-1920.webp";
import arenaClubNarrow from "./assets/environments/env-arena-club-960.webp";
import arenaMatchdayWide from "./assets/environments/env-arena-matchday-1920.webp";
import arenaMatchdayNarrow from "./assets/environments/env-arena-matchday-960.webp";
import dressingRoomWide from "./assets/environments/env-dressing-room-1920.webp";
import dressingRoomNarrow from "./assets/environments/env-dressing-room-960.webp";
import tacticalRoomWide from "./assets/environments/env-tactical-room-1920.webp";
import tacticalRoomNarrow from "./assets/environments/env-tactical-room-960.webp";
import managerOfficeWide from "./assets/environments/env-manager-office-1920.webp";
import managerOfficeNarrow from "./assets/environments/env-manager-office-960.webp";
import boardroomWide from "./assets/environments/env-boardroom-1920.webp";
import boardroomNarrow from "./assets/environments/env-boardroom-960.webp";
import pressRoomWide from "./assets/environments/env-press-room-1920.webp";
import pressRoomNarrow from "./assets/environments/env-press-room-960.webp";
import trainingHallWide from "./assets/environments/env-training-hall-1920.webp";
import trainingHallNarrow from "./assets/environments/env-training-hall-960.webp";
import scoutingOfficeWide from "./assets/environments/env-scouting-office-1920.webp";
import scoutingOfficeNarrow from "./assets/environments/env-scouting-office-960.webp";
import medicalRoomWide from "./assets/environments/env-medical-room-1920.webp";
import medicalRoomNarrow from "./assets/environments/env-medical-room-960.webp";

export type EnvironmentId =
  | "arena-club"
  | "arena-matchday"
  | "dressing-room"
  | "tactical-room"
  | "manager-office"
  | "boardroom"
  | "press-room"
  | "training-hall"
  | "scouting-office"
  | "medical-room";

export interface EnvironmentAssetSpec {
  id: EnvironmentId;
  title: string;
  department: string;
  atmosphere: string;
  wideSrc: string;
  narrowSrc: string;
  backdropStyle: CSSProperties;
}

function makeEnv(
  id: EnvironmentId,
  title: string,
  department: string,
  atmosphere: string,
  wide: { src: string },
  narrow: { src: string },
): EnvironmentAssetSpec {
  return {
    id,
    title,
    department,
    atmosphere,
    wideSrc: wide.src,
    narrowSrc: narrow.src,
    backdropStyle: photoBackdrop(wide, narrow),
  };
}

export const ENVIRONMENTS: Record<EnvironmentId, EnvironmentAssetSpec> = {
  "arena-club": makeEnv(
    "arena-club",
    "Hemmahallen & klubbloungen",
    "Arena & Klubbhus",
    "Skandinavisk inomhusarena med limträbalkar och blått tävlingsgolv",
    arenaClubWide,
    arenaClubNarrow,
  ),
  "arena-matchday": makeEnv(
    "arena-matchday",
    "Matchdagsarenan · Sändningsläge",
    "Matchcenter & Sändning",
    "Strålkastarljus, kamerakran och tät kvällsatmosfär inför avkast",
    arenaMatchdayWide,
    arenaMatchdayNarrow,
  ),
  "dressing-room": makeEnv(
    "dressing-room",
    "Omklädningsrummet",
    "Trupp, Moral & Hierarki",
    "Upplysta ekbås med matchtröjor, klisterburk och samlingstavla",
    dressingRoomWide,
    dressingRoomNarrow,
  ),
  "tactical-room": makeEnv(
    "tactical-room",
    "Taktik- & analysrummet",
    "Matchplan & Videogenomgång",
    "Överblick mot hallen med taktikskärm för 6–0/5–1 och videoanalys",
    tacticalRoomWide,
    tacticalRoomNarrow,
  ),
  "manager-office": makeEnv(
    "manager-office",
    "Managerns kontor",
    "Daglig ledning & Beslut",
    "Hörnkontor med utsikt över planen, arbetsbord och taktikanteckningar",
    managerOfficeWide,
    managerOfficeNarrow,
  ),
  boardroom: makeEnv(
    "boardroom",
    "Styrelserummet & troféväggen",
    "Styrelse, Mål & Ekonomi",
    "Konferensbord i mörk ek, prisskåp och panoramautsikt mot arenan",
    boardroomWide,
    boardroomNarrow,
  ),
  "press-room": makeEnv(
    "press-room",
    "Pressrummet & podiet",
    "Media & Presskonferenser",
    "Intervjupodium med mikrofoner, strålkastare och TV-kameror",
    pressRoomWide,
    pressRoomNarrow,
  ),
  "training-hall": makeEnv(
    "training-hall",
    "Träningshallen & gymmet",
    "Träning, Belastning & Fys",
    "Kombinerad handbollshall och elitgym med skivstänger och bollställ",
    trainingHallWide,
    trainingHallNarrow,
  ),
  "scouting-office": makeEnv(
    "scouting-office",
    "Scout- & rekryteringskontoret",
    "Scouting, Kontrakt & Övergångar",
    "Analysstation med skottkartor, spelarprofiler och magnetisk taktiktavla",
    scoutingOfficeWide,
    scoutingOfficeNarrow,
  ),
  "medical-room": makeEnv(
    "medical-room",
    "Medicinska kliniken & rehab",
    "Fysio, Skador & Återhämtning",
    "Behandlingsbänk, ultraljudsdiagnostik och rehabcyklar vid planen",
    medicalRoomWide,
    medicalRoomNarrow,
  ),
};

export function getEnvironment(id: EnvironmentId): EnvironmentAssetSpec {
  return ENVIRONMENTS[id];
}

