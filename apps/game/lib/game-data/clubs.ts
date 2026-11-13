import { SWEDISH_DIVISION_2_CLUBS } from './swedishDivision2';
import { clubVenue } from "./clubVenues";
import { CLUB_IDENTITY_METADATA } from "./clubIdentityData";
import { clubMarkColours } from "./clubVisualIdentity";
import type { Club } from "./types";

/**
 * Real club names. Coverage varies by competition, documented per
 * block below -- see the HM-GAME-0.1 report's World Data section.
 *
 * Club Identity C5: club colours have ONE source, the Club Identity Registry
 * (design-lab/experience-2027/club-identity/registry.json -> generated
 * clubVisualIdentity.data.ts). `primaryColor`/`secondaryColor` are the club's
 * own crest colours when documented, else its home-kit colours, else a neutral
 * grey placeholder that claims nothing (`colourSource: "PLACEHOLDER"`).
 */
const NEUTRAL_COLOURS = { primaryColor: "#6b7280", secondaryColor: "#ffffff" } as const;

function club(input: Omit<Club, "playable" | "primaryColor" | "secondaryColor"> & { playable?: boolean }): Club {
  // HM-PLAYTEST-01 5.4: one verified arena registry (clubVenues.ts) feeds the
  // club record, so club selection, profiles and matchday all agree.
  const venue = clubVenue(input.id);
  // The club's own home-area city (used for derbies and geography) is kept; the arena's town is separate.
  // Club Identity C5: colours are never written here -- they come from the Club Identity Registry (withIdentity below).
  return { playable: false, ...input, ...NEUTRAL_COLOURS, ...(venue ? { venue: venue.arena, venueCity: venue.city, ...(venue.capacity ? { venueCapacity: venue.capacity } : {}) } : {}) };
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
//
// HM-YOUTH-INTAKE-1.1B-DATA: `academyQuality` carries researched values for
// SEVEN clubs, all of them here in tier 1. They come from a 47-club evidence
// pass under Academy Quality Research Protocol v1.1: a club receives a value
// only when dimension A (senior-player production) is scorable from named,
// identity-checked developed players and at least four of six dimensions are
// scored. Forty academy-producing clubs did not clear that bar and are
// DELIBERATELY LEFT WITHOUT THE FIELD -- `resolveAcademyQuality` supplies the
// neutral 50 at runtime, which keeps "assessed as ordinary" distinguishable
// from "not known". Writing 50 into the data here would erase that difference.
//
// The seven are not a league table. Within this tier the values do not track
// senior strength -- the reigning-elite club scores lowest of the seven,
// because its young international was recruited at 20 rather than developed.
// That every value happens to sit in tier 1 reflects where Swedish handball
// journalism points, not a tier rule: no club in tiers 2-4 could evidence a
// second cohort, and one Allsvenskan club came within a single player history
// of qualifying.
//
// Five Division 1 entities (HK Cliff, HK S-hof, HP Alingsås, IF Kristianstad,
// HK Önnerediterna) are affiliated B teams that run no independent youth
// intake. They must never receive this field -- not a value, not a neutral 50,
// and not their parent's value.
const SWE_1: Club[] = [
  club({ id: "se_club_alingsas_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Alingsås HK", shortName: "Alingsås", city: "Alingsås", academyQuality: 61 }),
  club({ id: "se_club_amo_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Amo HK", shortName: "Amo", city: "Alstermo" }),
  club({ id: "se_club_hammarby_if_hf", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Hammarby IF HF", shortName: "Hammarby", city: "Stockholm" }),
  club({ id: "se_club_hf_karlskrona", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "HF Karlskrona", shortName: "Karlskrona", city: "Karlskrona" }),
  club({ id: "se_club_hk_malmo", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "HK Malmö", shortName: "Malmö", city: "Malmö" }),
  club({ id: "se_club_if_hallby_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IF Hallby HK", shortName: "Hallby", city: "Jönköping" }),
  club({ id: "se_club_ifk_kristianstad", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IFK Kristianstad", shortName: "Kristianstad", city: "Kristianstad", academyQuality: 48 }),
  club({ id: "se_club_ifk_skovde_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IFK Skövde HK", shortName: "Skövde", city: "Skövde", academyQuality: 62 }),
  club({ id: "se_club_ik_savehof", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "IK Sävehof", shortName: "Sävehof", city: "Göteborg", academyQuality: 59 }),
  club({ id: "se_club_lugi_hf", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Lugi HF", shortName: "Lugi", city: "Lund" }),
  club({ id: "se_club_ov_helsingborg", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "OV Helsingborg", shortName: "OV Helsingborg", city: "Helsingborg", academyQuality: 56 }),
  club({ id: "se_club_skanela_if", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Skånela IF", shortName: "Skånela", city: "Sigtuna" }),
  club({ id: "se_club_ystads_if_hf", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Ystads IF HF", shortName: "Ystad", city: "Ystad", academyQuality: 62 }),
  club({ id: "se_club_onnereds_hk", competitionId: "se_handbollsligan_herr", dataSource: "REAL_WORLD", playable: true, name: "Önnereds HK", shortName: "Önnered", city: "Göteborg", academyQuality: 56 }),
];

// --- Sweden, tier 2: Allsvenskan (2026/27) --- HM-DATA-ALLSVENSKAN-1.0:
// club ids/names now match the 14 CLUB IDENTITY v0.1 source profiles
// 1:1 (data/real-world/sweden/2026-27/allsvenskan/identity/), the same
// "profiles are the canonical club list" precedent HM-DATA-0.2 already
// established for tier 1. Six of the previous mock entries had no
// matching source profile and were removed (Anderstorps SK, "IFK
// Karlskrona"/swe2-karlskrona2, IK Lågan, Vinslövs HK, and -- notably --
// swe2-lugi/swe2-skanela, which were placeholder mock entries that
// collided with the REAL tier-1 clubs of the same name (Lugi HF,
// Skånela IF already exist for real in SWE_1 -- a club cannot play in
// both tiers at once). Six real clubs the mock list was missing were
// added: Västerås/Irsta HF (relegated from Handbollsligan for 2026/27),
// Redbergslids IK, Huddinge HK, H43 Lund HF, GF Kroppskultur, Eskilstuna
// Guif IF. "IFK Ystad" was renamed "IFK Ystad HK" to match its source
// profile's own official name (id unchanged). Real club/coach/staff
// IDENTITY data now exists for all 14 (see lib/gameWorld's identity
// loaders). HM-DATA-ALLSVENSKAN-1.1: real player squads now also exist
// (data/real-world/sweden/2026-27/allsvenskan/<club>/), so `dataSource`
// flips to "REAL_WORLD" for all 14 -- exactly the same flag that already
// gates worldSquads/gameplayRatings/aiTacticalPreferences snapshotting
// for Handbollsligan. All 14 Allsvenskan clubs have complete real-world
// squads, ratings, staff, and club identity profiles on disk and are
// playable in New Game.
const SWE_2: Club[] = [
  club({ id: "swe2-aranas", competitionId: "swe-2", name: "HK Aranäs", shortName: "Aranäs", playable: true, dataSource: "REAL_WORLD", city: "Kungsbacka" }),
  club({ id: "swe2-drott", competitionId: "swe-2", name: "HK Drott Halmstad", shortName: "Drott", playable: true, dataSource: "REAL_WORLD", city: "Halmstad" }),
  club({ id: "swe2-guif", competitionId: "swe-2", name: "Eskilstuna Guif IF", shortName: "Guif", playable: true, dataSource: "REAL_WORLD", city: "Eskilstuna" }),
  club({ id: "swe2-h43lund", competitionId: "swe-2", name: "H43 Lund HF", shortName: "H43", playable: true, dataSource: "REAL_WORLD", city: "Lund" }),
  club({ id: "swe2-huddinge", competitionId: "swe-2", name: "Huddinge HK", shortName: "Huddinge", playable: true, dataSource: "REAL_WORLD", city: "Huddinge" }),
  club({ id: "swe2-kroppskultur", competitionId: "swe-2", name: "GF Kroppskultur", shortName: "Kropps", playable: true, dataSource: "REAL_WORLD", city: "Uddevalla" }),
  club({ id: "swe2-kungalv", competitionId: "swe-2", name: "Kungälvs HK", shortName: "Kungälv", playable: true, dataSource: "REAL_WORLD", city: "Kungälv" }),
  club({ id: "swe2-redbergslid", competitionId: "swe-2", name: "Redbergslids IK", shortName: "Redbergslid", playable: true, dataSource: "REAL_WORLD", city: "Göteborg" }),
  club({ id: "swe2-torslanda", competitionId: "swe-2", name: "HK Torslanda Elit", shortName: "Torslanda", playable: true, dataSource: "REAL_WORLD", city: "Göteborg" }),
  club({ id: "swe2-tumba", competitionId: "swe-2", name: "IFK Tumba HK", shortName: "IFK Tumba", playable: true, dataSource: "REAL_WORLD", city: "Tumba", founded: 1969 }),
  club({ id: "swe2-tyreso", competitionId: "swe-2", name: "Tyresö Handboll", shortName: "Tyresö", playable: true, dataSource: "REAL_WORLD", city: "Tyresö" }),
  club({ id: "swe2-varberg", competitionId: "swe-2", name: "HK Varberg", shortName: "Varberg", playable: true, dataSource: "REAL_WORLD", city: "Varberg" }),
  club({ id: "swe2-vasterasirsta", competitionId: "swe-2", name: "VästeråsIrsta HF", shortName: "V.Irsta", playable: true, dataSource: "REAL_WORLD", city: "Västerås" }),
  club({ id: "swe2-ystad2", competitionId: "swe-2", name: "IFK Ystad HK", shortName: "IFK Ystad", playable: true, dataSource: "REAL_WORLD", city: "Ystad" }),
];

// --- Sweden, Division 1 Norra/Södra (2026/27) --- HM-DATA-DIV1-1.0:
// Playable league clubs and recruitment pool, one tier below Allsvenskan.
// 24 real clubs (12 Norra + 12 Södra), club ids/names matching the
// verified real-world database 1:1 (data/real-world/sweden/2026-27/
// division1-norra|division1-sodra/), sourced from svenskhandboll.se's
// official 2026/27 series list. Managers may select these existing clubs;
// the official next-season transition remains subject to the atomic gate. Every squad is
// `dataSource: "REAL_WORLD"` (real player identity, not invented).
// No `city` is set: unlike the Handbollsligan/Allsvenskan blocks above,
// this milestone's source data does not itself confirm each club's home
// city, so it is left unset rather than guessed.
const SWE_DIV1_NORRA: Club[] = [
  club({ id: "se_club_bodens_bk_hf", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "Bodens BK HF", shortName: "Boden" }),
  club({ id: "se_club_enkopings_hf", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "Enköpings HF", shortName: "Enköping" }),
  club({ id: "se_club_hk_cliff", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "HK Cliff", shortName: "Cliff" }),
  club({ id: "se_club_hk_eskil", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "HK Eskil", shortName: "Eskil" }),
  club({ id: "se_club_ik_bolton", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "IK Bolton", shortName: "Bolton" }),
  club({ id: "se_club_lif_lindesberg", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "LIF Lindesberg", shortName: "Lindesberg" }),
  club({ id: "se_club_rp_if_linkoping", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "RP IF Linköping", shortName: "RP Linköping" }),
  club({ id: "se_club_rimbo_hk_roslagen", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "Rimbo HK Roslagen", shortName: "Rimbo" }),
  club({ id: "se_club_sannadals_sk", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "Sannadals SK", shortName: "Sannadal" }),
  club({ id: "se_club_taby_hbk", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "Täby HBK", shortName: "Täby" }),
  club({ id: "se_club_uppsala_hk", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "Uppsala HK", shortName: "Uppsala" }),
  club({ id: "se_club_orebro_sk_hk_herr", competitionId: "se_division1_norra", dataSource: "REAL_WORLD", playable: true, name: "Örebro SK HK herr", shortName: "Örebro SK" }),
];

const SWE_DIV1_SODRA: Club[] = [
  club({ id: "se_club_anderstorps_sk", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "Anderstorps SK", shortName: "Anderstorp" }),
  club({ id: "se_club_eslovs_hk", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "Eslövs HK", shortName: "Eslöv" }),
  club({ id: "se_club_hk_country", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "HK Country", shortName: "Country" }),
  club({ id: "se_club_hk_s_hof", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "HK S-hof", shortName: "S-hof" }),
  club({ id: "se_club_hk_onnerediterna", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "HK Önnerediterna", shortName: "Önnerediterna" }),
  club({ id: "se_club_hp_alingsas", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "HP Alingsås", shortName: "HP Alingsås" }),
  club({ id: "se_club_hp_warta", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "HP Warta", shortName: "Warta" }),
  club({ id: "se_club_if_kristianstad", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "IF Kristianstad", shortName: "IF Kristianstad" }),
  club({ id: "se_club_ik_lagan", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "IK Lågan", shortName: "Lågan" }),
  club({ id: "se_club_karra_hf", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "Kärra HF", shortName: "Kärra" }),
  club({ id: "se_club_vinslovs_hk", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "Vinslövs HK", shortName: "Vinslöv" }),
  club({ id: "se_club_ahus_handboll", competitionId: "se_division1_sodra", dataSource: "REAL_WORLD", playable: true, name: "Åhus Handboll", shortName: "Åhus" }),
];

// --- Denmark, tier 1: Håndboldligaen --- the 14-club 2025/26 list (en.wikipedia.org) = the frozen
// legacy baseline. 2026/27 changes live in competitionHistory (Club Identity C2/C3).
const DEN_1: Club[] = [
  club({ id: "den1-aalborg", competitionId: "den-1", dataSource: "REAL_WORLD", name: "Aalborg Håndbold", shortName: "Aalborg", city: "Aalborg" }),
  club({ id: "den1-bjerringbro", competitionId: "den-1", dataSource: "REAL_WORLD", name: "Bjerringbro-Silkeborg", shortName: "BSH", city: "Silkeborg" }),
  club({ id: "den1-fredericia", competitionId: "den-1", name: "Fredericia HK", shortName: "Fredericia", city: "Fredericia" }),
  club({ id: "den1-gog", competitionId: "den-1", name: "GOG Håndbold", shortName: "GOG", city: "Gudme/Ørbæk" }),
  club({ id: "den1-grindsted", competitionId: "den-1", name: "Grindsted GIF", shortName: "Grindsted", city: "Grindsted" }),
  club({ id: "den1-hoj", competitionId: "den-1", name: "HØJ Elite", shortName: "HØJ", city: "Ølstykke" }),
  club({ id: "den1-morsthy", competitionId: "den-1", name: "Mors-Thy Håndbold", shortName: "Mors-Thy", city: "Nykøbing Mors" }),
  club({ id: "den1-nordsjaelland", competitionId: "den-1", name: "Nordsjælland Håndbold", shortName: "Nordsjælland", city: "Helsingør" }),
  club({ id: "den1-ribeesbjerg", competitionId: "den-1", name: "Ribe-Esbjerg HH", shortName: "Ribe-Esbjerg", city: "Esbjerg" }),
  club({ id: "den1-skanderborg", competitionId: "den-1", dataSource: "REAL_WORLD", name: "Skanderborg AGF Håndbold", shortName: "Skanderborg AGF", city: "Skanderborg" }),
  club({ id: "den1-skjern", competitionId: "den-1", dataSource: "REAL_WORLD", name: "Skjern Håndbold", shortName: "Skjern", city: "Skjern" }),
  club({ id: "den1-sonderjyske", competitionId: "den-1", name: "SønderjyskE Håndbold", shortName: "SønderjyskE", city: "Sønderborg" }),
  club({ id: "den1-tms", competitionId: "den-1", dataSource: "REAL_WORLD", name: "TMS Ringsted", shortName: "TMS Ringsted", city: "Ringsted" }),
  club({ id: "den1-tth", competitionId: "den-1", name: "TTH Holstebro", shortName: "TTH Holstebro", city: "Holstebro" }),
  // Club Identity C2 (F15): new in the 2026/27 world (addedInWorld); absent from every legacy career until its next season.
  club({ id: "den1-kif-kolding", competitionId: "den-1", name: "KIF Kolding", shortName: "Kolding", city: "Kolding" }),
];

// --- Germany, tier 1: Handball-Bundesliga --- the 18-club 2025/26 list (en.wikipedia.org) = the frozen
// legacy baseline. 2026/27 changes (Leipzig/Minden down, Balingen/Bietigheim up) live in
// competitionHistory (clubIdentityData.ts), never in competitionId (Club Identity C2/C3).
const GER_1: Club[] = [
  club({ id: "ger1-bergischer", competitionId: "ger-1", name: "Bergischer HC", shortName: "Bergischer HC", city: "Bergisches Land" }),
  club({ id: "ger1-fuchse", competitionId: "ger-1", dataSource: "REAL_WORLD", name: "Füchse Berlin", shortName: "Füchse Berlin", city: "Berlin" }),
  club({ id: "ger1-eisenach", competitionId: "ger-1", name: "ThSV Eisenach", shortName: "Eisenach", city: "Eisenach" }),
  club({ id: "ger1-erlangen", competitionId: "ger-1", name: "HC Erlangen", shortName: "Erlangen", city: "Erlangen" }),
  club({ id: "ger1-flensburg", competitionId: "ger-1", name: "SG Flensburg-Handewitt", shortName: "Flensburg", city: "Flensburg" }),
  club({ id: "ger1-goppingen", competitionId: "ger-1", name: "Frisch Auf Göppingen", shortName: "Göppingen", city: "Göppingen" }),
  club({ id: "ger1-gummersbach", competitionId: "ger-1", name: "VfL Gummersbach", shortName: "Gummersbach", city: "Gummersbach" }),
  club({ id: "ger1-hamburg", competitionId: "ger-1", name: "Handball Club Hamburg", shortName: "HC Hamburg", city: "Hamburg" }),
  club({ id: "ger1-hannover", competitionId: "ger-1", name: "TSV Hannover-Burgdorf", shortName: "Hannover-Burgdorf", city: "Hannover" }),
  club({ id: "ger1-kiel", competitionId: "ger-1", dataSource: "REAL_WORLD", name: "THW Kiel", shortName: "THW Kiel", city: "Kiel" }),
  club({ id: "ger1-leipzig", competitionId: "ger-1", name: "SC DHfK Leipzig", shortName: "Leipzig", city: "Leipzig" }),
  club({ id: "ger1-lemgo", competitionId: "ger-1", name: "TBV Lemgo", shortName: "Lemgo", city: "Lemgo" }),
  club({ id: "ger1-magdeburg", competitionId: "ger-1", name: "SC Magdeburg", shortName: "Magdeburg", city: "Magdeburg" }),
  club({ id: "ger1-melsungen", competitionId: "ger-1", name: "MT Melsungen", shortName: "Melsungen", city: "Melsungen" }),
  club({ id: "ger1-minden", competitionId: "ger-1", name: "GWD Minden", shortName: "Minden", city: "Minden" }),
  club({ id: "ger1-rheinneckar", competitionId: "ger-1", name: "Rhein-Neckar Löwen", shortName: "Rhein-Neckar", city: "Mannheim" }),
  club({ id: "ger1-stuttgart", competitionId: "ger-1", name: "TVB Stuttgart", shortName: "Stuttgart", city: "Stuttgart" }),
  club({ id: "ger1-wetzlar", competitionId: "ger-1", dataSource: "REAL_WORLD", name: "HSG Wetzlar", shortName: "Wetzlar", city: "Wetzlar" }),
  // Club Identity C2 (F14): new in the 2026/27 world (addedInWorld); absent from every legacy career until its next season.
  club({ id: "ger1-bietigheim", competitionId: "ger-1", name: "SG BBM Bietigheim", shortName: "Bietigheim", city: "Bietigheim-Bissingen" }),
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
  club({ id: "nor1-elverum", competitionId: "nor-1", dataSource: "REAL_WORLD", name: "Elverum Håndball", shortName: "Elverum", city: "Elverum" }),
  club({ id: "nor1-kolstad", competitionId: "nor-1", name: "Kolstad Håndball", shortName: "Kolstad", city: "Trondheim" }),
  club({ id: "nor1-oif", competitionId: "nor-1", name: "ØIF Arendal", shortName: "Arendal", city: "Arendal" }),
  club({ id: "nor1-bodo", competitionId: "nor-1", name: "Bodø HK", shortName: "Bodø", city: "Bodø" }),
  club({ id: "nor1-halden", competitionId: "nor-1", name: "Halden Topphåndball", shortName: "Halden", city: "Halden" }),
  club({ id: "nor1-runar", competitionId: "nor-1", name: "Runar Håndball", shortName: "Runar", city: "Sandefjord" }),
  // Norway t2
  club({ id: "nor2-nordstrand", competitionId: "nor-2", name: "Nordstrand IF", shortName: "Nordstrand", city: "Oslo" }),
  club({ id: "nor2-fjellhammer", competitionId: "nor-2", name: "Fjellhammer IL", shortName: "Fjellhammer", city: "Lørenskog" }),
  club({ id: "nor2-sandnes", competitionId: "nor-2", name: "Sandnes HK", shortName: "Sandnes", city: "Sandnes" }),
  club({ id: "nor2-vestli", competitionId: "nor-2", name: "Vestli IL", shortName: "Vestli", city: "Oslo" }),
  // Germany t2
  club({ id: "ger2-balingen", competitionId: "ger-2", name: "HBW Balingen-Weilstetten", shortName: "Balingen", city: "Balingen" }),
  club({ id: "ger2-dessau", competitionId: "ger-2", name: "Dessau-Roßlauer HV 06", shortName: "Dessau", city: "Dessau-Roßlau" }),
  club({ id: "ger2-nordhorn", competitionId: "ger-2", name: "HSG Nordhorn-Lingen", shortName: "Nordhorn", city: "Nordhorn" }),
  club({ id: "ger2-wilhelmshaven", competitionId: "ger-2", name: "TV Bittenfeld", shortName: "Bittenfeld", city: "Waiblingen" }),
  // Denmark t2
  club({ id: "den2-aarhus", competitionId: "den-2", name: "Aarhus Håndbold Herrer", shortName: "Aarhus", city: "Aarhus" }),
  club({ id: "den2-vendsyssel", competitionId: "den-2", name: "Elitesport Vendsyssel", shortName: "Vendsyssel", city: "Hjørring" }),
  club({ id: "den2-fif", competitionId: "den-2", name: "FIF Håndbold", shortName: "FIF", city: "Frederiksberg" }),
  club({ id: "den2-norddjurs", competitionId: "den-2", name: "Norddjurs Håndbold", shortName: "Norddjurs", city: "Grenaa" }),
  // Spain t1
  club({ id: "esp1-barca", competitionId: "esp-1", dataSource: "REAL_WORLD", name: "FC Barcelona", shortName: "Barcelona", city: "Barcelona" }),
  club({ id: "esp1-anaitasuna", competitionId: "esp-1", name: "Bidasoa Irun", shortName: "Bidasoa", city: "Irun" }),
  club({ id: "esp1-logrono", competitionId: "esp-1", name: "Ademar León", shortName: "Ademar León", city: "León" }),
  club({ id: "esp1-granollers", competitionId: "esp-1", dataSource: "REAL_WORLD", name: "Fraikin BM Granollers", shortName: "Granollers", city: "Granollers" }),
  club({ id: "esp1-alicante", competitionId: "esp-1", name: "SCDR Anaitasuna", shortName: "Anaitasuna", city: "Pamplona" }),
  club({ id: "esp1-cuenca", competitionId: "esp-1", dataSource: "REAL_WORLD", name: "Cuenca Balonmano", shortName: "Cuenca", city: "Cuenca" }),
  // Spain t2
  club({ id: "esp2-cisne", competitionId: "esp-2", name: "Cisne Balonmano", shortName: "Cisne", city: "Pontevedra" }),
  club({ id: "esp2-cordoba", competitionId: "esp-2", name: "BM Córdoba", shortName: "Córdoba", city: "Córdoba" }),
  club({ id: "esp2-huesca", competitionId: "esp-2", name: "BM Huesca", shortName: "Huesca", city: "Huesca" }),
  club({ id: "esp2-teucro", competitionId: "esp-2", name: "Teucro Pontevedra", shortName: "Teucro", city: "Pontevedra" }),
  // Hungary t1
  club({ id: "hun1-szeged", competitionId: "hun-1", name: "Pick Szeged", shortName: "Szeged", city: "Szeged" }),
  club({ id: "hun1-veszprem", competitionId: "hun-1", dataSource: "REAL_WORLD", name: "Veszprém KC", shortName: "Veszprém", city: "Veszprém" }),
  club({ id: "hun1-ferencvaros", competitionId: "hun-1", name: "Ferencváros", shortName: "Ferencváros", city: "Budapest" }),
  club({ id: "hun1-csurgo", competitionId: "hun-1", name: "Csurgói KK", shortName: "Csurgó", city: "Csurgó" }),
  club({ id: "hun1-gyor", competitionId: "hun-1", name: "Tatabánya KC", shortName: "Tatabánya", city: "Tatabánya" }),
  // Hungary t2 (NB I/B -- see competitions.ts hun-2 / int-hun-2b, S6)
  club({ id: "hun2-cegled", competitionId: "hun-2", name: "Ceglédi KKSE", shortName: "Cegléd", city: "Cegléd" }),
  club({ id: "hun2-eger", competitionId: "hun-2", name: "Eger-Eszterházy SzSE", shortName: "Eger", city: "Eger" }),
  club({ id: "hun2-komlo", competitionId: "hun-2", name: "Komlói Bányász", shortName: "Komló", city: "Komló" }),
  // Slovenia t1
  club({ id: "svn1-celje", competitionId: "svn-1", name: "RK Celje", shortName: "Celje", city: "Celje" }),
  club({ id: "svn1-slovan", competitionId: "svn-1", name: "RD Slovan", shortName: "Slovan", city: "Ljubljana" }),
  club({ id: "svn1-trimo", competitionId: "svn-1", name: "RK Trimo Trebnje", shortName: "Trimo Trebnje", city: "Trebnje" }),
  club({ id: "svn1-gorenje", competitionId: "svn-1", name: "RK Gorenje Velenje", shortName: "Velenje", city: "Velenje" }),
  // Slovenia t2
  club({ id: "svn2-skofjaloka", competitionId: "svn-2", name: "RD Škofja Loka", shortName: "Škofja Loka", city: "Škofja Loka" }),
  club({ id: "svn2-jeruzalem", competitionId: "svn-2", name: "RK Jeruzalem Ormož", shortName: "Ormož", city: "Ormož" }),
  // Iceland t1
  club({ id: "isl1-valur", competitionId: "isl-1", dataSource: "REAL_WORLD", name: "Valur", shortName: "Valur", city: "Reykjavík" }),
  club({ id: "isl1-fh", competitionId: "isl-1", name: "FH", shortName: "FH", city: "Hafnarfjörður" }),
  club({ id: "isl1-haukar", competitionId: "isl-1", name: "Haukar", shortName: "Haukar", city: "Hafnarfjörður" }),
  club({ id: "isl1-akureyri", competitionId: "isl-1", name: "KA Akureyri", shortName: "KA", city: "Akureyri" }),
  // Iceland t2
  club({ id: "isl2-fram", competitionId: "isl-2", name: "Fram", shortName: "Fram", city: "Reykjavík" }),
  club({ id: "isl2-throttur", competitionId: "isl-2", name: "Þróttur Reykjavík", shortName: "Þróttur", city: "Reykjavík" }),
];

// --- HM-WORLD-PLAYER-POOL-1.0: 17 new clubs required by the 100-player
// international pool that have no existing entry to reuse. Every entry
// is `playable: false`, `dataSource: "REAL_WORLD"` -- real player
// identity from the source workbook, never invented. No `city` is set:
// the source workbook does not itself confirm each club's home city, so
// it is left unset rather than guessed (same precedent as Division 1).
const WORLD_POOL_CLUBS: Club[] = [
  // Austria
  club({ id: "int-hard", competitionId: "int-aut-1", dataSource: "REAL_WORLD", name: "ALPLA HC Hard", shortName: "HC Hard" }),
  club({ id: "int-fivers", competitionId: "int-aut-1", dataSource: "REAL_WORLD", name: "Fivers Margareten", shortName: "Fivers" }),
  // Faroe Islands
  club({ id: "int-h71", competitionId: "int-fro-1", dataSource: "REAL_WORLD", name: "H71", shortName: "H71" }),
  // Hungary NB I/B. hun-2 models the same real league (S6); int-hun-2b is canonical (competitions.ts).
  club({ id: "int-veszprem-academy", competitionId: "int-hun-2b", dataSource: "REAL_WORLD", name: "Veszprém Handball Academy", shortName: "Veszprém Akadémia" }),
  // Italy -- Serie A Gold
  club({ id: "int-meran", competitionId: "int-ita-1", dataSource: "REAL_WORLD", name: "Black Devils Meran Alperia", shortName: "Meran" }),
  club({ id: "int-cologno", competitionId: "int-ita-1", dataSource: "REAL_WORLD", name: "Metelli Cologne", shortName: "Cologne" }),
  club({ id: "int-cassano", competitionId: "int-ita-1", dataSource: "REAL_WORLD", name: "Proger Cassano Magnago", shortName: "Cassano Magnago" }),
  // Italy -- Serie A Silver
  club({ id: "int-camerano", competitionId: "int-ita-2", dataSource: "REAL_WORLD", name: "Camerano", shortName: "Camerano" }),
  club({ id: "int-paese", competitionId: "int-ita-2", dataSource: "REAL_WORLD", name: "Paese", shortName: "Paese" }),
  club({ id: "int-fasano", competitionId: "int-ita-2", dataSource: "REAL_WORLD", name: "Serra Fasano", shortName: "Fasano" }),
  // Netherlands
  club({ id: "int-bevo", competitionId: "int-ned-1", dataSource: "REAL_WORLD", name: "Humby/Bevo HC", shortName: "Bevo" }),
  club({ id: "int-volendam", competitionId: "int-ned-1", dataSource: "REAL_WORLD", name: "KRAS/Volendam", shortName: "Volendam" }),
  club({ id: "int-aalsmeer", competitionId: "int-ned-1", dataSource: "REAL_WORLD", name: "RoyalFloraHolland/HV Aalsmeer", shortName: "Aalsmeer" }),
  // Poland
  club({ id: "int-wisla-plock", competitionId: "int-pol-1", dataSource: "REAL_WORLD", name: "ORLEN Wisła Płock", shortName: "Wisła Płock" }),
  // Portugal
  club({ id: "int-sporting", competitionId: "int-por-1", dataSource: "REAL_WORLD", name: "Sporting CP", shortName: "Sporting" }),
  // Qatar
  club({ id: "int-alduhail", competitionId: "int-qat-1", dataSource: "REAL_WORLD", name: "Al Duhail", shortName: "Al Duhail" }),
  // Switzerland
  club({ id: "int-schaffhausen", competitionId: "int-che-1", dataSource: "REAL_WORLD", name: "Kadetten Schaffhausen", shortName: "Kadetten" }),
];

// Club Identity C1: the identity layer (clubIdentityData.ts) is merged into
// each record here, so `getClub` returns one complete record. Array order is
// part of deterministic behaviour (foreign-buyer picks index into it): new
// clubs are only ever appended at the end of their block, never inserted.
function withIdentity(input: Club): Club {
  const mark = clubMarkColours(input.id);
  const c: Club = mark ? { ...input, primaryColor: mark.primary, secondaryColor: mark.secondary, colourSource: "REGISTRY" } : { ...input, ...NEUTRAL_COLOURS, colourSource: "PLACEHOLDER" };
  const meta = CLUB_IDENTITY_METADATA[c.id];
  if (!meta) return c;
  // externalIds merge field by field: generated registrations (Division 2 Profixio ids) + curated SHF ids.
  const externalIds = c.externalIds || meta.externalIds
    ? { ...c.externalIds, ...meta.externalIds, profixioTeam: { ...c.externalIds?.profixioTeam, ...meta.externalIds?.profixioTeam } }
    : undefined;
  return { ...c, ...meta, ...(externalIds ? { externalIds } : {}) };
}

export const CLUBS: readonly Club[] = [...SWE_1, ...SWE_2, ...SWE_DIV1_NORRA, ...SWE_DIV1_SODRA, ...SWEDISH_DIVISION_2_CLUBS, ...DEN_1, ...GER_1, ...REST, ...WORLD_POOL_CLUBS].map(withIdentity);

const CLUB_BY_ID: ReadonlyMap<string, Club> = new Map(CLUBS.map((c) => [c.id, c]));

export function getClub(id: string): Club | undefined {
  return CLUB_BY_ID.get(id);
}

/**
 * LEGACY-BASELINE membership: the clubs of `competitionId` in the v8 world
 * (frozen `competitionId`, records added by a later data epoch excluded), in
 * CLUBS order. Career code that must follow promotions or real-world league
 * changes asks career/competitionMembership.ts (`careerClubsInCompetition`).
 */
export function getClubsByCompetition(competitionId: string): readonly Club[] {
  return CLUBS.filter((c) => c.competitionId === competitionId && !c.addedInWorld);
}

export const TUMBA_CLUB_ID = "swe2-tumba";

export function getPlayerClub(): Club {
  const c = getClub(TUMBA_CLUB_ID);
  if (!c) {
    throw new Error("IFK Tumba club data missing.");
  }
  return c;
}
