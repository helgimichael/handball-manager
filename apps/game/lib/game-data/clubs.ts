import type { Club } from "./types";

/**
 * Real club names. Coverage varies by competition, documented per
 * block below -- see the HM-GAME-0.1 report's World Data section.
 * Crest colors are a reasonable placeholder scheme (most Scandinavian
 * "IFK" clubs use blue/white, "HK"/regional clubs vary), not verified
 * official brand colors -- purely a UI placeholder until real crests
 * exist.
 */

function club(input: Omit<Club, "playable"> & { playable?: boolean }): Club {
  return { playable: false, ...input };
}

// --- Sweden, tier 1: Handbollsligan (2026/27) ---
// HM-DATA-0.2: club ids/competitionId now match the verified real-world
// database 1:1 (data/real-world/sweden/2026-27/handbollsligan/), rather
// than the earlier placeholder swe1-* mock ids. Two of the original 14
// mock entries ("Eskilstuna Guif", "VästeråsIrsta HF") had no matching
// real-world club folder and were removed; two real clubs the mock list
// was missing ("Lugi HF", "Skånela IF") were added. All 14 are `playable`
// and `dataSource: "REAL_WORLD"` -- their squads are imported from real
// player identity data, not invented.
const SWE_1: Club[] = [
  club({ id: "se_club_alingsas_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Alingsås HK", shortName: "Alingsås", city: "Alingsås", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "se_club_amo_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Amo HK", shortName: "Amo", city: "Amål", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "se_club_hammarby_if_hf", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Hammarby IF HF", shortName: "Hammarby", city: "Stockholm", primaryColor: "#0a7a3d", secondaryColor: "#ffffff" }),
  club({ id: "se_club_hf_karlskrona", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "HF Karlskrona", shortName: "Karlskrona", city: "Karlskrona", primaryColor: "#e2b13c", secondaryColor: "#111318" }),
  club({ id: "se_club_hk_malmo", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "HK Malmö", shortName: "Malmö", city: "Malmö", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "se_club_if_hallby_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IF Hallby HK", shortName: "Hallby", city: "Kristianstad", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "se_club_ifk_kristianstad", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IFK Kristianstad", shortName: "Kristianstad", city: "Kristianstad", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "se_club_ifk_skovde_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IFK Skövde HK", shortName: "Skövde", city: "Skövde", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "se_club_ik_savehof", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IK Sävehof", shortName: "Sävehof", city: "Göteborg", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "se_club_lugi_hf", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Lugi HF", shortName: "Lugi", city: "Lund", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "se_club_ov_helsingborg", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "OV Helsingborg", shortName: "OV Helsingborg", city: "Helsingborg", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "se_club_skanela_if", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Skånela IF", shortName: "Skånela", city: "Sigtuna", primaryColor: "#0b6e4f", secondaryColor: "#111318" }),
  club({ id: "se_club_ystads_if_hf", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Ystads IF HF", shortName: "Ystad", city: "Ystad", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "se_club_onnereds_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Önnereds HK", shortName: "Önnered", city: "Göteborg", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
];

// --- Sweden, tier 2: Allsvenskan --- verified 14-club list including
// IFK Tumba (sv.wikipedia.org "Allsvenskan i handboll för herrar").
// IFK Tumba is the ONLY playable club in HM-GAME-0.1.
const SWE_2: Club[] = [
  club({ id: "swe2-anderstorp", competitionId: "swe-2", name: "Anderstorps SK", shortName: "Anderstorp", city: "Anderstorp", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "swe2-aranas", competitionId: "swe-2", name: "HK Aranäs", shortName: "Aranäs", city: "Kungsbacka", primaryColor: "#1e3a8a", secondaryColor: "#e2b13c" }),
  club({ id: "swe2-drott", competitionId: "swe-2", name: "HK Drott Halmstad", shortName: "Drott", city: "Halmstad", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "swe2-torslanda", competitionId: "swe-2", name: "HK Torslanda Elit", shortName: "Torslanda", city: "Göteborg", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "swe2-varberg", competitionId: "swe-2", name: "HK Varberg", shortName: "Varberg", city: "Varberg", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  club({ id: "swe2-tumba", competitionId: "swe-2", name: "IFK Tumba HK", shortName: "IFK Tumba", playable: true, city: "Tumba", venue: "Tumba Sporthall", founded: 1969, primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "swe2-karlskrona2", competitionId: "swe-2", name: "IFK Karlskrona", shortName: "IFK Karlskrona", city: "Karlskrona", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "swe2-ystad2", competitionId: "swe-2", name: "IFK Ystad", shortName: "IFK Ystad", city: "Ystad", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "swe2-lagan", competitionId: "swe-2", name: "IK Lågan", shortName: "Lågan", city: "Ljungby", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "swe2-kungalv", competitionId: "swe-2", name: "Kungälvs HK", shortName: "Kungälv", city: "Kungälv", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "swe2-lugi", competitionId: "swe-2", name: "Lugi HF", shortName: "Lugi", city: "Lund", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "swe2-tyreso", competitionId: "swe-2", name: "Tyresö Handboll", shortName: "Tyresö", city: "Tyresö", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "swe2-vinslov", competitionId: "swe-2", name: "Vinslövs HK", shortName: "Vinslöv", city: "Vinslöv", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "swe2-skanela", competitionId: "swe-2", name: "Skånela IF", shortName: "Skånela", city: "Sigtuna", primaryColor: "#0b6e4f", secondaryColor: "#111318" }),
];

// --- Denmark, tier 1: Håndboldligaen --- verified full 14-club list (en.wikipedia.org).
const DEN_1: Club[] = [
  club({ id: "den1-aalborg", competitionId: "den-1", name: "Aalborg Håndbold", shortName: "Aalborg", city: "Aalborg", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "den1-bjerringbro", competitionId: "den-1", name: "Bjerringbro-Silkeborg", shortName: "BSH", city: "Silkeborg", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "den1-fredericia", competitionId: "den-1", name: "Fredericia HK", shortName: "Fredericia", city: "Fredericia", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "den1-gog", competitionId: "den-1", name: "GOG Håndbold", shortName: "GOG", city: "Gudme/Ørbæk", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "den1-grindsted", competitionId: "den-1", name: "Grindsted GIF", shortName: "Grindsted", city: "Grindsted", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "den1-hoj", competitionId: "den-1", name: "HØJ Elite", shortName: "HØJ", city: "Hjørring", primaryColor: "#1b3a6b", secondaryColor: "#e2b13c" }),
  club({ id: "den1-morsthy", competitionId: "den-1", name: "Mors-Thy Håndbold", shortName: "Mors-Thy", city: "Nykøbing Mors", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  club({ id: "den1-nordsjaelland", competitionId: "den-1", name: "Nordsjælland Håndbold", shortName: "Nordsjælland", city: "Helsingør", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "den1-ribeesbjerg", competitionId: "den-1", name: "Ribe-Esbjerg HH", shortName: "Ribe-Esbjerg", city: "Esbjerg", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "den1-skanderborg", competitionId: "den-1", name: "Skanderborg Aarhus", shortName: "Skanderborg AGF", city: "Aarhus", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "den1-skjern", competitionId: "den-1", name: "Skjern Håndbold", shortName: "Skjern", city: "Skjern", primaryColor: "#1e3a8a", secondaryColor: "#e2b13c" }),
  club({ id: "den1-sonderjyske", competitionId: "den-1", name: "SønderjyskE Håndbold", shortName: "SønderjyskE", city: "Aabenraa", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "den1-tms", competitionId: "den-1", name: "TMS Ringsted", shortName: "TMS Ringsted", city: "Ringsted", primaryColor: "#111318", secondaryColor: "#ffffff" }),
  club({ id: "den1-tth", competitionId: "den-1", name: "TTH Holstebro", shortName: "TTH Holstebro", city: "Holstebro", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
];

// --- Germany, tier 1: Handball-Bundesliga --- verified full 18-club list (en.wikipedia.org).
const GER_1: Club[] = [
  club({ id: "ger1-bergischer", competitionId: "ger-1", name: "Bergischer HC", shortName: "Bergischer HC", city: "Bergisches Land", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  club({ id: "ger1-fuchse", competitionId: "ger-1", name: "Füchse Berlin", shortName: "Füchse Berlin", city: "Berlin", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "ger1-eisenach", competitionId: "ger-1", name: "ThSV Eisenach", shortName: "Eisenach", city: "Eisenach", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "ger1-erlangen", competitionId: "ger-1", name: "HC Erlangen", shortName: "Erlangen", city: "Erlangen", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "ger1-flensburg", competitionId: "ger-1", name: "SG Flensburg-Handewitt", shortName: "Flensburg", city: "Flensburg", primaryColor: "#1e3a8a", secondaryColor: "#c8102e" }),
  club({ id: "ger1-goppingen", competitionId: "ger-1", name: "Frisch Auf Göppingen", shortName: "Göppingen", city: "Göppingen", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "ger1-gummersbach", competitionId: "ger-1", name: "VfL Gummersbach", shortName: "Gummersbach", city: "Gummersbach", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "ger1-hamburg", competitionId: "ger-1", name: "HSV Hamburg", shortName: "HSV Hamburg", city: "Hamburg", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "ger1-hannover", competitionId: "ger-1", name: "TSV Hannover-Burgdorf", shortName: "Hannover-Burgdorf", city: "Hannover", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  club({ id: "ger1-kiel", competitionId: "ger-1", name: "THW Kiel", shortName: "THW Kiel", city: "Kiel", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  club({ id: "ger1-leipzig", competitionId: "ger-1", name: "SC DHfK Leipzig", shortName: "Leipzig", city: "Leipzig", primaryColor: "#0b6e4f", secondaryColor: "#111318" }),
  club({ id: "ger1-lemgo", competitionId: "ger-1", name: "TBV Lemgo", shortName: "Lemgo", city: "Lemgo", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "ger1-magdeburg", competitionId: "ger-1", name: "SC Magdeburg", shortName: "Magdeburg", city: "Magdeburg", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "ger1-melsungen", competitionId: "ger-1", name: "MT Melsungen", shortName: "Melsungen", city: "Melsungen", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "ger1-minden", competitionId: "ger-1", name: "GWD Minden", shortName: "Minden", city: "Minden", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "ger1-rheinneckar", competitionId: "ger-1", name: "Rhein-Neckar Löwen", shortName: "Rhein-Neckar", city: "Mannheim", primaryColor: "#111318", secondaryColor: "#1e3a8a" }),
  club({ id: "ger1-stuttgart", competitionId: "ger-1", name: "TVB Stuttgart", shortName: "Stuttgart", city: "Stuttgart", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "ger1-wetzlar", competitionId: "ger-1", name: "HSG Wetzlar", shortName: "Wetzlar", city: "Wetzlar", primaryColor: "#1e3a8a", secondaryColor: "#e2b13c" }),
];

/**
 * The remaining 11 competitions (Norway t1/t2, Germany t2, Spain t1/t2,
 * Hungary t1/t2, Slovenia t1/t2, Iceland t1/t2, Denmark t2) use a
 * smaller set of well-known real clubs rather than an exhaustively
 * re-verified full roster -- these are widely known clubs (many are
 * recent domestic champions or long-established top-flight sides), but
 * this specific pass did not re-fetch a live current-season list for
 * each of them the way it did for the four blocks above. Documented
 * here rather than silently presented as equally verified.
 */
const REST: Club[] = [
  // Norway t1
  club({ id: "nor1-elverum", competitionId: "nor-1", name: "Elverum Håndball", shortName: "Elverum", city: "Elverum", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "nor1-kolstad", competitionId: "nor-1", name: "Kolstad Håndball", shortName: "Kolstad", city: "Trondheim", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "nor1-oif", competitionId: "nor-1", name: "ØIF Arendal", shortName: "Arendal", city: "Arendal", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "nor1-bodo", competitionId: "nor-1", name: "Bodø HK", shortName: "Bodø", city: "Bodø", primaryColor: "#1e3a8a", secondaryColor: "#e2b13c" }),
  club({ id: "nor1-halden", competitionId: "nor-1", name: "Halden Topphåndball", shortName: "Halden", city: "Halden", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "nor1-runar", competitionId: "nor-1", name: "Runar Håndball", shortName: "Runar", city: "Sandefjord", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  // Norway t2
  club({ id: "nor2-nordstrand", competitionId: "nor-2", name: "Nordstrand IF", shortName: "Nordstrand", city: "Oslo", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "nor2-fjellhammer", competitionId: "nor-2", name: "Fjellhammer IL", shortName: "Fjellhammer", city: "Lørenskog", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "nor2-sandnes", competitionId: "nor-2", name: "Sandnes HK", shortName: "Sandnes", city: "Sandnes", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "nor2-vestli", competitionId: "nor-2", name: "Vestli IL", shortName: "Vestli", city: "Oslo", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  // Germany t2
  club({ id: "ger2-balingen", competitionId: "ger-2", name: "HBW Balingen-Weilstetten", shortName: "Balingen", city: "Balingen", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "ger2-dessau", competitionId: "ger-2", name: "SC DHfK Dessau", shortName: "Dessau", city: "Dessau", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "ger2-nordhorn", competitionId: "ger-2", name: "HSG Nordhorn-Lingen", shortName: "Nordhorn", city: "Nordhorn", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "ger2-wilhelmshaven", competitionId: "ger-2", name: "TV Bittenfeld", shortName: "Bittenfeld", city: "Waiblingen", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  // Denmark t2
  club({ id: "den2-aarhus", competitionId: "den-2", name: "Aarhus Håndbold Herrer", shortName: "Aarhus", city: "Aarhus", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "den2-vendsyssel", competitionId: "den-2", name: "Elitesport Vendsyssel", shortName: "Vendsyssel", city: "Hjørring", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "den2-fif", competitionId: "den-2", name: "FIF Håndbold", shortName: "FIF", city: "Fredensborg", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "den2-norddjurs", competitionId: "den-2", name: "Norddjurs Håndbold", shortName: "Norddjurs", city: "Grenaa", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  // Spain t1
  club({ id: "esp1-barca", competitionId: "esp-1", name: "FC Barcelona", shortName: "Barcelona", city: "Barcelona", primaryColor: "#a50044", secondaryColor: "#004d98" }),
  club({ id: "esp1-anaitasuna", competitionId: "esp-1", name: "Bidasoa Irun", shortName: "Bidasoa", city: "Irun", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "esp1-logrono", competitionId: "esp-1", name: "Ademar León", shortName: "Ademar León", city: "León", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "esp1-granollers", competitionId: "esp-1", name: "Fraikin BM Granollers", shortName: "Granollers", city: "Granollers", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  club({ id: "esp1-alicante", competitionId: "esp-1", name: "Helvetia Anaitasuna", shortName: "Anaitasuna", city: "Pamplona", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "esp1-cuenca", competitionId: "esp-1", name: "Cuenca Balonmano", shortName: "Cuenca", city: "Cuenca", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  // Spain t2
  club({ id: "esp2-cisne", competitionId: "esp-2", name: "Cisne Balonmano", shortName: "Cisne", city: "Ourense", primaryColor: "#111318", secondaryColor: "#ffffff" }),
  club({ id: "esp2-cordoba", competitionId: "esp-2", name: "BM Córdoba", shortName: "Córdoba", city: "Córdoba", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "esp2-huesca", competitionId: "esp-2", name: "BM Huesca", shortName: "Huesca", city: "Huesca", primaryColor: "#1e3a8a", secondaryColor: "#e2b13c" }),
  club({ id: "esp2-teucro", competitionId: "esp-2", name: "Teucro Pontevedra", shortName: "Teucro", city: "Pontevedra", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  // Hungary t1
  club({ id: "hun1-szeged", competitionId: "hun-1", name: "Pick Szeged", shortName: "Szeged", city: "Szeged", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "hun1-veszprem", competitionId: "hun-1", name: "Telekom Veszprém", shortName: "Veszprém", city: "Veszprém", primaryColor: "#1e3a8a", secondaryColor: "#e2b13c" }),
  club({ id: "hun1-ferencvaros", competitionId: "hun-1", name: "Ferencváros", shortName: "Ferencváros", city: "Budapest", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "hun1-csurgo", competitionId: "hun-1", name: "Csurgói KK", shortName: "Csurgó", city: "Csurgó", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  club({ id: "hun1-gyor", competitionId: "hun-1", name: "Grundfos Tatabánya", shortName: "Tatabánya", city: "Tatabánya", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  // Hungary t2
  club({ id: "hun2-cegled", competitionId: "hun-2", name: "Ceglédi KKSE", shortName: "Cegléd", city: "Cegléd", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "hun2-eger", competitionId: "hun-2", name: "Egri Spartacus", shortName: "Eger", city: "Eger", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "hun2-komlo", competitionId: "hun-2", name: "Komlói Bányász", shortName: "Komló", city: "Komló", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
  // Slovenia t1
  club({ id: "svn1-celje", competitionId: "svn-1", name: "RK Celje", shortName: "Celje", city: "Celje", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "svn1-slovan", competitionId: "svn-1", name: "RD Slovan", shortName: "Slovan", city: "Ljubljana", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "svn1-trimo", competitionId: "svn-1", name: "RK Trimo Trebnje", shortName: "Trimo Trebnje", city: "Trebnje", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  club({ id: "svn1-gorenje", competitionId: "svn-1", name: "RK Gorenje Velenje", shortName: "Velenje", city: "Velenje", primaryColor: "#111318", secondaryColor: "#c8102e" }),
  // Slovenia t2
  club({ id: "svn2-skofjaloka", competitionId: "svn-2", name: "RD Škofja Loka", shortName: "Škofja Loka", city: "Škofja Loka", primaryColor: "#1e3a8a", secondaryColor: "#ffffff" }),
  club({ id: "svn2-jeruzalem", competitionId: "svn-2", name: "RK Jeruzalem Ormož", shortName: "Ormož", city: "Ormož", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  // Iceland t1
  club({ id: "isl1-valur", competitionId: "isl-1", name: "Valur", shortName: "Valur", city: "Reykjavík", primaryColor: "#c8102e", secondaryColor: "#111318" }),
  club({ id: "isl1-fh", competitionId: "isl-1", name: "FH", shortName: "FH", city: "Hafnarfjörður", primaryColor: "#ffffff", secondaryColor: "#111318" }),
  club({ id: "isl1-haukar", competitionId: "isl-1", name: "Haukar", shortName: "Haukar", city: "Hafnarfjörður", primaryColor: "#e2b13c", secondaryColor: "#111318" }),
  club({ id: "isl1-akureyri", competitionId: "isl-1", name: "KA Akureyri", shortName: "KA", city: "Akureyri", primaryColor: "#0b6e4f", secondaryColor: "#ffffff" }),
  // Iceland t2
  club({ id: "isl2-fram", competitionId: "isl-2", name: "Fram", shortName: "Fram", city: "Reykjavík", primaryColor: "#c8102e", secondaryColor: "#ffffff" }),
  club({ id: "isl2-throttur", competitionId: "isl-2", name: "Þróttur Reykjavík", shortName: "Þróttur", city: "Reykjavík", primaryColor: "#111318", secondaryColor: "#e2b13c" }),
];

export const CLUBS: readonly Club[] = [...SWE_1, ...SWE_2, ...DEN_1, ...GER_1, ...REST];

export function getClub(id: string): Club | undefined {
  return CLUBS.find((c) => c.id === id);
}

export function getClubsByCompetition(competitionId: string): readonly Club[] {
  return CLUBS.filter((c) => c.competitionId === competitionId);
}

export const TUMBA_CLUB_ID = "swe2-tumba";

export function getPlayerClub(): Club {
  const c = getClub(TUMBA_CLUB_ID);
  if (!c) {
    throw new Error("IFK Tumba club data missing.");
  }
  return c;
}
