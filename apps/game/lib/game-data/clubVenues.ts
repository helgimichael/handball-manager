// HM-PLAYTEST-01 5.4: verified home arenas for the 28 playable Swedish clubs.
//
// Every entry cites its source. Handbollsligan arenas and capacities come from
// the league's own 2026/27 arena list; Allsvenskan arenas from the clubs' own
// sites. Where the evidence was weak or contradictory (Aranäs, Huddinge,
// Torslanda) the arena is deliberately left out rather than guessed -- the UI
// then shows the city only. Researched 2026-11-02 for HM-PLAYTEST-01.
export type ClubVenue = {
  readonly arena: string;
  readonly city: string;
  /** Seated/standing capacity as published by the source, when it gives one. */
  readonly capacity?: number;
  readonly source: string;
  readonly note?: string;
};

const HBL_ARENAS = "https://handbollsligan.se/herrligan/har-ar-herrligans-arenor/";

export const CLUB_VENUES: Readonly<Record<string, ClubVenue>> = {
  se_club_alingsas_hk: { arena: "Estrad Alingsås", city: "Alingsås", capacity: 2750, source: HBL_ARENAS },
  se_club_amo_hk: { arena: "Amokabel-hallen", city: "Alstermo", capacity: 700, source: HBL_ARENAS },
  se_club_hammarby_if_hf: { arena: "Eriksdalshallen", city: "Stockholm", capacity: 2300, source: HBL_ARENAS },
  se_club_hf_karlskrona: { arena: "Brinova Arena", city: "Karlskrona", capacity: 2750, source: HBL_ARENAS },
  se_club_hk_malmo: { arena: "Baltiska hallen", city: "Malmö", capacity: 3590, source: HBL_ARENAS },
  se_club_if_hallby_hk: { arena: "Jönköpings Idrottshus", city: "Jönköping", capacity: 1600, source: HBL_ARENAS },
  se_club_ifk_kristianstad: { arena: "Kristianstad Arena", city: "Kristianstad", capacity: 4800, source: HBL_ARENAS },
  se_club_ifk_skovde_hk: { arena: "Arena Skövde", city: "Skövde", capacity: 2516, source: HBL_ARENAS },
  se_club_ik_savehof: { arena: "Partille Arena", city: "Partille", capacity: 4500, source: HBL_ARENAS },
  se_club_lugi_hf: { arena: "Sparbanken Skåne Arena", city: "Lund", capacity: 3400, source: HBL_ARENAS },
  se_club_ov_helsingborg: { arena: "Helsingborg Arena", city: "Helsingborg", capacity: 5000, source: HBL_ARENAS },
  se_club_skanela_if: { arena: "Vikingahallen", city: "Märsta", capacity: 800, source: HBL_ARENAS },
  se_club_ystads_if_hf: { arena: "Ystad Arena", city: "Ystad", capacity: 2900, source: HBL_ARENAS },
  se_club_onnereds_hk: { arena: "ÖHK-hallen", city: "Göteborg", capacity: 1500, source: HBL_ARENAS },
  "swe2-drott": { arena: "Halmstad Arena", city: "Halmstad", source: "https://www.hkdrott.se/" },
  "swe2-guif": { arena: "Volvo CE Arena", city: "Eskilstuna", capacity: 3700, source: "https://www.guif.nu/vara-lag/matcher/volvo-ce-arena/" },
  "swe2-h43lund": { arena: "Sparbanken Skåne Arena", city: "Lund", source: "https://www.h43lund.se/", note: "Vissa matcher spelas i Lunds Idrottshall." },
  "swe2-kroppskultur": { arena: "Agnebergshallen", city: "Uddevalla", source: "https://www.kroppskultur.com" },
  "swe2-kungalv": { arena: "Mimershallen", city: "Kungälv", source: "https://kungalvhk.web.sportadmin.se/start/" },
  "swe2-redbergslid": { arena: "Prioritet Serneke Arena", city: "Göteborg", source: "https://www.redbergslid.se/" },
  "swe2-tumba": { arena: "Tumba Idrottshus", city: "Tumba", source: "https://www.svenskalag.se/tumbahandboll" },
  "swe2-tyreso": { arena: "Tyresöhallen", city: "Tyresö", source: "https://www.tyresohandboll.se/" },
  "swe2-varberg": { arena: "Arena Varberg", city: "Varberg", source: "http://hkvarberg.myclub.se/" },
  "swe2-vasterasirsta": { arena: "Expandia Arena", city: "Västerås", source: "https://www.vasterasirsta.se/" },
  "swe2-ystad2": { arena: "Ystad Arena", city: "Ystad", source: "https://www.ifkystad.se/" },
};

export function clubVenue(clubId: string): ClubVenue | undefined {
  return CLUB_VENUES[clubId];
}
