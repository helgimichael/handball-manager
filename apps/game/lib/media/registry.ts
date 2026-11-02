// HM-ALPHA3-M08: the media landscape -- real Swedish outlets, what they
// cover and which clubs they follow. Names, categories and geographic
// coverage are real; every story the game writes is fiction about the
// game's own events and is always labelled as such ("Spelets nyheter").
// Journalists are fictional. No real article is reproduced.
//
// `confidence`: VERIFIED = established outlet whose coverage area is
// well documented; REGIONAL_DESK = a public-service regional desk (SR P4 /
// SVT regional) whose area follows the official region split. Outlets we
// could not confirm (e.g. a dedicated local paper for Märsta/Sigtuna) are
// deliberately left out rather than invented.

export type OutletCategory = "NATIONAL_TABLOID" | "NATIONAL_DAILY" | "PUBLIC_SERVICE_TV" | "PUBLIC_SERVICE_RADIO" | "COMMERCIAL_TV" | "NEWS_AGENCY" | "HANDBALL_SPECIALIST" | "REGIONAL_DAILY" | "LOCAL" | "REGIONAL_RADIO" | "REGIONAL_TV";
export type StoryInterest = "RESULTS" | "TRANSFERS" | "MANAGERS" | "CRISIS" | "TITLES" | "DISCIPLINE" | "TALENT" | "RECORDS" | "RIVALRY" | "INTERVIEWS" | "LOCAL_LIFE";

export interface MediaOutlet {
  id: string;
  name: string;
  category: OutletCategory;
  /** Where it is based / what it covers, in words. */
  coverage: string;
  /** 1 (very local) .. 5 (national reach). */
  reach: number;
  interests: StoryInterest[];
  /** How often it writes about handball: daily club coverage vs only the big moments. */
  frequency: "EVERY_MATCH" | "WEEKLY" | "BIG_EVENTS";
  /** National outlets follow the top flight; local ones follow named clubs. */
  leagues?: ("HBL" | "ALLSVENSKAN")[];
  confidence: "VERIFIED" | "REGIONAL_DESK";
  /** The colour the outlet chip uses -- a neutral editorial tint, not the outlet's logo or brand mark. */
  tint: string;
}

const NATIONAL: MediaOutlet[] = [
  { id: "aftonbladet", name: "Aftonbladet", category: "NATIONAL_TABLOID", coverage: "Rikstäckande kvällstidning, Stockholm", reach: 5, interests: ["MANAGERS", "CRISIS", "TITLES", "DISCIPLINE", "TRANSFERS"], frequency: "BIG_EVENTS", leagues: ["HBL"], confidence: "VERIFIED", tint: "#b4232a" },
  { id: "expressen", name: "Expressen", category: "NATIONAL_TABLOID", coverage: "Rikstäckande kvällstidning, Stockholm", reach: 5, interests: ["MANAGERS", "CRISIS", "TITLES", "DISCIPLINE", "RIVALRY"], frequency: "BIG_EVENTS", leagues: ["HBL"], confidence: "VERIFIED", tint: "#1f4fa3" },
  { id: "dn", name: "Dagens Nyheter", category: "NATIONAL_DAILY", coverage: "Rikstäckande morgontidning, Stockholm", reach: 4, interests: ["TITLES", "MANAGERS", "RECORDS"], frequency: "BIG_EVENTS", leagues: ["HBL"], confidence: "VERIFIED", tint: "#22303f" },
  { id: "svd", name: "Svenska Dagbladet", category: "NATIONAL_DAILY", coverage: "Rikstäckande morgontidning, Stockholm", reach: 3, interests: ["TITLES", "RECORDS"], frequency: "BIG_EVENTS", leagues: ["HBL"], confidence: "VERIFIED", tint: "#3b3f46" },
  { id: "svt-sport", name: "SVT Sport", category: "PUBLIC_SERVICE_TV", coverage: "Sveriges Television, rikstäckande", reach: 5, interests: ["TITLES", "RESULTS", "MANAGERS", "DISCIPLINE", "RECORDS"], frequency: "WEEKLY", leagues: ["HBL"], confidence: "VERIFIED", tint: "#1e3d33" },
  { id: "radiosporten", name: "Radiosporten (Sveriges Radio)", category: "PUBLIC_SERVICE_RADIO", coverage: "Sveriges Radio, rikstäckande", reach: 4, interests: ["RESULTS", "INTERVIEWS", "TITLES", "DISCIPLINE"], frequency: "WEEKLY", leagues: ["HBL"], confidence: "VERIFIED", tint: "#24507a" },
  { id: "tv4-sport", name: "TV4 Sport", category: "COMMERCIAL_TV", coverage: "TV4, rikstäckande", reach: 4, interests: ["TITLES", "MANAGERS", "RIVALRY"], frequency: "BIG_EVENTS", leagues: ["HBL"], confidence: "VERIFIED", tint: "#7a2a52" },
  { id: "tt", name: "TT Nyhetsbyrån", category: "NEWS_AGENCY", coverage: "Rikstäckande nyhetsbyrå", reach: 3, interests: ["RESULTS", "TRANSFERS", "MANAGERS", "DISCIPLINE"], frequency: "WEEKLY", leagues: ["HBL", "ALLSVENSKAN"], confidence: "VERIFIED", tint: "#4a4f57" },
  { id: "handbollskanalen", name: "Handbollskanalen", category: "HANDBALL_SPECIALIST", coverage: "Svensk handbollsmedia, hela landet", reach: 3, interests: ["RESULTS", "TRANSFERS", "MANAGERS", "TALENT", "RECORDS", "INTERVIEWS", "RIVALRY", "DISCIPLINE"], frequency: "EVERY_MATCH", leagues: ["HBL", "ALLSVENSKAN"], confidence: "VERIFIED", tint: "#c0612b" },
];

const r = (id: string, name: string, category: OutletCategory, coverage: string, reach: number, frequency: MediaOutlet["frequency"], confidence: MediaOutlet["confidence"] = "VERIFIED"): MediaOutlet => ({
  id, name, category, coverage, reach, frequency, confidence,
  interests: category === "LOCAL" ? ["RESULTS", "TRANSFERS", "MANAGERS", "TALENT", "INTERVIEWS", "LOCAL_LIFE", "RIVALRY", "CRISIS"] : ["RESULTS", "TRANSFERS", "MANAGERS", "RIVALRY", "INTERVIEWS", "CRISIS", "TITLES"],
  tint: category === "REGIONAL_RADIO" ? "#24507a" : category === "REGIONAL_TV" ? "#1e3d33" : category === "LOCAL" ? "#6b5a3a" : "#3c4a5c",
});

const REGIONAL: MediaOutlet[] = [
  r("gp", "Göteborgs-Posten", "REGIONAL_DAILY", "Göteborg och Västra Götaland", 3, "EVERY_MATCH"),
  r("partille-tidning", "Partille Tidning", "LOCAL", "Partille", 1, "EVERY_MATCH"),
  r("kungalvs-posten", "Kungälvs-Posten", "LOCAL", "Kungälv", 1, "EVERY_MATCH"),
  r("alingsas-tidning", "Alingsås Tidning", "LOCAL", "Alingsås", 2, "EVERY_MATCH"),
  r("kungsbacka-posten", "Kungsbacka-Posten", "LOCAL", "Kungsbacka", 1, "EVERY_MATCH"),
  r("skaraborgs-allehanda", "Skaraborgs Allehanda", "REGIONAL_DAILY", "Skövde och Skaraborg", 2, "EVERY_MATCH"),
  r("skovde-nyheter", "Skövde Nyheter", "LOCAL", "Skövde", 1, "EVERY_MATCH"),
  r("bohuslaningen", "Bohusläningen", "REGIONAL_DAILY", "Uddevalla och Bohuslän", 2, "EVERY_MATCH"),
  r("ttela", "TTELA", "REGIONAL_DAILY", "Trollhättan, Vänersborg och Fyrbodal", 2, "WEEKLY"),
  r("hallandsposten", "Hallandsposten", "REGIONAL_DAILY", "Halmstad och södra Halland", 2, "EVERY_MATCH"),
  r("hallands-nyheter", "Hallands Nyheter", "REGIONAL_DAILY", "Varberg, Falkenberg och norra Halland", 2, "EVERY_MATCH"),
  r("sydsvenskan", "Sydsvenskan", "REGIONAL_DAILY", "Malmö, Lund och sydvästra Skåne", 3, "EVERY_MATCH"),
  r("kvallsposten", "Kvällsposten (Expressen)", "REGIONAL_DAILY", "Skåne, Expressens södra upplaga", 3, "WEEKLY"),
  r("skanska-dagbladet", "Skånska Dagbladet", "REGIONAL_DAILY", "Skåne, Malmö och Lund", 2, "WEEKLY"),
  r("helsingborgs-dagblad", "Helsingborgs Dagblad", "REGIONAL_DAILY", "Helsingborg och nordvästra Skåne", 2, "EVERY_MATCH"),
  r("kristianstadsbladet", "Kristianstadsbladet", "REGIONAL_DAILY", "Kristianstad och nordöstra Skåne", 2, "EVERY_MATCH"),
  r("ystads-allehanda", "Ystads Allehanda", "LOCAL", "Ystad och Sydöstra Skåne", 2, "EVERY_MATCH"),
  r("blt", "Blekinge Läns Tidning", "REGIONAL_DAILY", "Karlskrona och Blekinge", 2, "EVERY_MATCH"),
  r("sydostran", "Sydöstran", "LOCAL", "Karlskrona", 1, "EVERY_MATCH"),
  r("smalandsposten", "Smålandsposten", "REGIONAL_DAILY", "Växjö och Kronobergs län", 2, "EVERY_MATCH"),
  r("jonkopings-posten", "Jönköpings-Posten", "REGIONAL_DAILY", "Jönköping och Jönköpings län", 2, "EVERY_MATCH"),
  r("eskilstuna-kuriren", "Eskilstuna-Kuriren", "REGIONAL_DAILY", "Eskilstuna och Sörmland", 2, "EVERY_MATCH"),
  r("vlt", "Vestmanlands Läns Tidning", "REGIONAL_DAILY", "Västerås och Västmanland", 2, "EVERY_MATCH"),
  r("mitt-i", "Mitt i", "LOCAL", "Lokala upplagor i Stockholms kommuner", 1, "WEEKLY"),
  // Sveriges Radio P4 and SVT regional desks.
  r("p4-goteborg", "P4 Göteborg (Sveriges Radio)", "REGIONAL_RADIO", "Göteborgsregionen", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-skaraborg", "P4 Skaraborg (Sveriges Radio)", "REGIONAL_RADIO", "Skaraborg", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-vast", "P4 Väst (Sveriges Radio)", "REGIONAL_RADIO", "Fyrbodal", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-halland", "P4 Halland (Sveriges Radio)", "REGIONAL_RADIO", "Halland", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-malmohus", "P4 Malmöhus (Sveriges Radio)", "REGIONAL_RADIO", "Malmö, Lund, Helsingborg, Ystad", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-kristianstad", "P4 Kristianstad (Sveriges Radio)", "REGIONAL_RADIO", "Nordöstra Skåne", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-blekinge", "P4 Blekinge (Sveriges Radio)", "REGIONAL_RADIO", "Blekinge", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-kronoberg", "P4 Kronoberg (Sveriges Radio)", "REGIONAL_RADIO", "Kronobergs län", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-jonkoping", "P4 Jönköping (Sveriges Radio)", "REGIONAL_RADIO", "Jönköpings län", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-stockholm", "P4 Stockholm (Sveriges Radio)", "REGIONAL_RADIO", "Stockholms län", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-sormland", "P4 Sörmland (Sveriges Radio)", "REGIONAL_RADIO", "Sörmland", 2, "WEEKLY", "REGIONAL_DESK"),
  r("p4-vastmanland", "P4 Västmanland (Sveriges Radio)", "REGIONAL_RADIO", "Västmanland", 2, "WEEKLY", "REGIONAL_DESK"),
  r("svt-vast", "SVT Nyheter Väst", "REGIONAL_TV", "Västra Götaland", 3, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-halland", "SVT Nyheter Halland", "REGIONAL_TV", "Halland", 2, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-skane", "SVT Nyheter Skåne", "REGIONAL_TV", "Skåne", 3, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-blekinge", "SVT Nyheter Blekinge", "REGIONAL_TV", "Blekinge", 2, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-smaland", "SVT Nyheter Småland", "REGIONAL_TV", "Kronoberg och Kalmar", 2, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-jonkoping", "SVT Nyheter Jönköping", "REGIONAL_TV", "Jönköpings län", 2, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-stockholm", "SVT Nyheter Stockholm", "REGIONAL_TV", "Stockholms län", 3, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-sormland", "SVT Nyheter Sörmland", "REGIONAL_TV", "Sörmland", 2, "BIG_EVENTS", "REGIONAL_DESK"),
  r("svt-vastmanland", "SVT Nyheter Västmanland", "REGIONAL_TV", "Västmanland", 2, "BIG_EVENTS", "REGIONAL_DESK"),
];

export const MEDIA_OUTLETS: Readonly<Record<string, MediaOutlet>> = Object.fromEntries([...NATIONAL, ...REGIONAL].map((o) => [o.id, o]));

/**
 * Where each club really plays and who covers it, nearest first. The town is
 * the one the media write from (Partille for Sävehof, Märsta for Skånela);
 * the club data keeps the municipality.
 */
export const CLUB_MEDIA: Readonly<Record<string, { town: string; region: string; outlets: string[] }>> = {
  se_club_alingsas_hk: { town: "Alingsås", region: "VAST", outlets: ["alingsas-tidning", "gp", "p4-goteborg", "svt-vast"] },
  se_club_amo_hk: { town: "Alstermo", region: "SMALAND", outlets: ["smalandsposten", "p4-kronoberg", "svt-smaland"] },
  se_club_hammarby_if_hf: { town: "Stockholm", region: "STOCKHOLM", outlets: ["dn", "mitt-i", "p4-stockholm", "svt-stockholm"] },
  se_club_hf_karlskrona: { town: "Karlskrona", region: "BLEKINGE", outlets: ["blt", "sydostran", "p4-blekinge", "svt-blekinge"] },
  se_club_hk_malmo: { town: "Malmö", region: "SKANE_SYD", outlets: ["sydsvenskan", "kvallsposten", "skanska-dagbladet", "p4-malmohus", "svt-skane"] },
  se_club_if_hallby_hk: { town: "Jönköping", region: "JONKOPING", outlets: ["jonkopings-posten", "p4-jonkoping", "svt-jonkoping"] },
  se_club_ifk_kristianstad: { town: "Kristianstad", region: "SKANE_NO", outlets: ["kristianstadsbladet", "p4-kristianstad", "kvallsposten", "svt-skane"] },
  se_club_ifk_skovde_hk: { town: "Skövde", region: "SKARABORG", outlets: ["skaraborgs-allehanda", "skovde-nyheter", "p4-skaraborg", "svt-vast"] },
  se_club_ik_savehof: { town: "Partille", region: "VAST", outlets: ["partille-tidning", "gp", "p4-goteborg", "svt-vast"] },
  se_club_lugi_hf: { town: "Lund", region: "SKANE_SYD", outlets: ["sydsvenskan", "skanska-dagbladet", "p4-malmohus", "svt-skane"] },
  se_club_ov_helsingborg: { town: "Helsingborg", region: "SKANE_NV", outlets: ["helsingborgs-dagblad", "p4-malmohus", "svt-skane"] },
  se_club_skanela_if: { town: "Märsta", region: "STOCKHOLM", outlets: ["p4-stockholm", "svt-stockholm", "dn"] },
  se_club_ystads_if_hf: { town: "Ystad", region: "SKANE_SYD", outlets: ["ystads-allehanda", "p4-malmohus", "kvallsposten", "svt-skane"] },
  se_club_onnereds_hk: { town: "Göteborg", region: "VAST", outlets: ["gp", "p4-goteborg", "svt-vast"] },
  "swe2-aranas": { town: "Kungsbacka", region: "HALLAND", outlets: ["kungsbacka-posten", "gp", "p4-halland", "svt-halland"] },
  "swe2-drott": { town: "Halmstad", region: "HALLAND", outlets: ["hallandsposten", "p4-halland", "svt-halland"] },
  "swe2-guif": { town: "Eskilstuna", region: "SORMLAND", outlets: ["eskilstuna-kuriren", "p4-sormland", "svt-sormland"] },
  "swe2-h43lund": { town: "Lund", region: "SKANE_SYD", outlets: ["sydsvenskan", "skanska-dagbladet", "p4-malmohus", "svt-skane"] },
  "swe2-huddinge": { town: "Huddinge", region: "STOCKHOLM", outlets: ["mitt-i", "p4-stockholm", "svt-stockholm"] },
  "swe2-kroppskultur": { town: "Uddevalla", region: "FYRBODAL", outlets: ["bohuslaningen", "ttela", "p4-vast", "svt-vast"] },
  "swe2-kungalv": { town: "Kungälv", region: "VAST", outlets: ["kungalvs-posten", "gp", "p4-goteborg", "svt-vast"] },
  "swe2-redbergslid": { town: "Göteborg", region: "VAST", outlets: ["gp", "p4-goteborg", "svt-vast"] },
  "swe2-torslanda": { town: "Göteborg", region: "VAST", outlets: ["gp", "p4-goteborg", "svt-vast"] },
  "swe2-tumba": { town: "Tumba", region: "STOCKHOLM", outlets: ["mitt-i", "p4-stockholm", "svt-stockholm"] },
  "swe2-tyreso": { town: "Tyresö", region: "STOCKHOLM", outlets: ["mitt-i", "p4-stockholm", "svt-stockholm"] },
  "swe2-varberg": { town: "Varberg", region: "HALLAND", outlets: ["hallands-nyheter", "p4-halland", "svt-halland"] },
  "swe2-vasterasirsta": { town: "Västerås", region: "VASTMANLAND", outlets: ["vlt", "p4-vastmanland", "svt-vastmanland"] },
  "swe2-ystad2": { town: "Ystad", region: "SKANE_SYD", outlets: ["ystads-allehanda", "p4-malmohus", "svt-skane"] },
};

const NEIGHBOURS: Record<string, string[]> = {
  VAST: ["SKARABORG", "FYRBODAL", "HALLAND"], SKARABORG: ["VAST", "JONKOPING"], FYRBODAL: ["VAST"], HALLAND: ["VAST", "SKANE_NV"],
  SKANE_SYD: ["SKANE_NO", "SKANE_NV"], SKANE_NO: ["SKANE_SYD", "BLEKINGE"], SKANE_NV: ["SKANE_SYD", "HALLAND"], BLEKINGE: ["SKANE_NO", "SMALAND"],
  SMALAND: ["BLEKINGE", "JONKOPING"], JONKOPING: ["SMALAND", "SKARABORG"], STOCKHOLM: ["SORMLAND", "VASTMANLAND"], SORMLAND: ["STOCKHOLM", "VASTMANLAND"], VASTMANLAND: ["STOCKHOLM", "SORMLAND"],
};

export function clubMedia(clubId: string) {
  return CLUB_MEDIA[clubId];
}

/** 3 = same town, 2 = same region, 1 = neighbouring region, 0 = far apart. */
export function geographicTie(a: string, b: string): number {
  const x = CLUB_MEDIA[a], y = CLUB_MEDIA[b];
  if (!x || !y) return 0;
  if (x.town === y.town) return 3;
  if (x.region === y.region) return 2;
  return NEIGHBOURS[x.region]?.includes(y.region) ? 1 : 0;
}

export const NATIONAL_OUTLETS = NATIONAL.map((o) => o.id);
export const CATEGORY_LABEL: Record<OutletCategory, string> = {
  NATIONAL_TABLOID: "Kvällstidning", NATIONAL_DAILY: "Rikstidning", PUBLIC_SERVICE_TV: "Public service, tv", PUBLIC_SERVICE_RADIO: "Public service, radio", COMMERCIAL_TV: "Tv",
  NEWS_AGENCY: "Nyhetsbyrå", HANDBALL_SPECIALIST: "Handbollsmedia", REGIONAL_DAILY: "Regional dagstidning", LOCAL: "Lokaltidning", REGIONAL_RADIO: "Regional radio", REGIONAL_TV: "Regional tv",
};
