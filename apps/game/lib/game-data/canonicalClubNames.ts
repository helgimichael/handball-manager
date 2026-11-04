/**
 * Canonical club name resolution and capitalization preservation.
 * Ensures consistent, authentic Swedish handball club representation across
 * media, news, transfers, inbox, match reports, and headlines.
 */
import { getClub } from "./clubs";

export interface CanonicalClubInfo {
  id: string;
  fullName: string;
  shortName: string;
}

export const CANONICAL_CLUB_MAP: Record<string, CanonicalClubInfo> = {
  // Handbollsligan
  "se_club_alingsas_hk": { id: "se_club_alingsas_hk", fullName: "Alingsås HK", shortName: "Alingsås HK" },
  "se_club_amo_hk": { id: "se_club_amo_hk", fullName: "Amo HK", shortName: "Amo HK" },
  "se_club_hammarby_if_hf": { id: "se_club_hammarby_if_hf", fullName: "Hammarby IF HF", shortName: "Hammarby IF" },
  "se_club_hf_karlskrona": { id: "se_club_hf_karlskrona", fullName: "HF Karlskrona", shortName: "HF Karlskrona" },
  "se_club_hk_malmo": { id: "se_club_hk_malmo", fullName: "HK Malmö", shortName: "HK Malmö" },
  "se_club_if_hallby_hk": { id: "se_club_if_hallby_hk", fullName: "IF Hallby HK", shortName: "IF Hallby" },
  "se_club_ifk_kristianstad": { id: "se_club_ifk_kristianstad", fullName: "IFK Kristianstad", shortName: "IFK Kristianstad" },
  "se_club_ifk_skovde_hk": { id: "se_club_ifk_skovde_hk", fullName: "IFK Skövde HK", shortName: "IFK Skövde" },
  "se_club_ik_savehof": { id: "se_club_ik_savehof", fullName: "IK Sävehof", shortName: "IK Sävehof" },
  "se_club_lugi_hf": { id: "se_club_lugi_hf", fullName: "Lugi HF", shortName: "Lugi HF" },
  "se_club_ov_helsingborg": { id: "se_club_ov_helsingborg", fullName: "OV Helsingborg", shortName: "OV Helsingborg" },
  "se_club_skanela_if": { id: "se_club_skanela_if", fullName: "Skånela IF", shortName: "Skånela IF" },
  "se_club_ystads_if_hf": { id: "se_club_ystads_if_hf", fullName: "Ystads IF HF", shortName: "Ystads IF" },
  "se_club_onnereds_hk": { id: "se_club_onnereds_hk", fullName: "Önnereds HK", shortName: "Önnereds HK" },

  // Allsvenskan
  "swe2-aranas": { id: "swe2-aranas", fullName: "HK Aranäs", shortName: "HK Aranäs" },
  "swe2-drott": { id: "swe2-drott", fullName: "HK Drott Halmstad", shortName: "HK Drott" },
  "swe2-guif": { id: "swe2-guif", fullName: "HK Guif", shortName: "HK Guif" },
  "swe2-h43lund": { id: "swe2-h43lund", fullName: "H43 Lund HF", shortName: "H43 Lund" },
  "swe2-huddinge": { id: "swe2-huddinge", fullName: "Huddinge HK", shortName: "Huddinge HK" },
  "swe2-kroppskultur": { id: "swe2-kroppskultur", fullName: "GF Kroppskultur", shortName: "GF Kroppskultur" },
  "swe2-kungalv": { id: "swe2-kungalv", fullName: "Kungälvs HK", shortName: "Kungälvs HK" },
  "swe2-redbergslid": { id: "swe2-redbergslid", fullName: "Redbergslids IK", shortName: "Redbergslids IK" },
  "swe2-torslanda": { id: "swe2-torslanda", fullName: "HK Torslanda Elit", shortName: "HK Torslanda" },
  "swe2-tumba": { id: "swe2-tumba", fullName: "IFK Tumba HK", shortName: "IFK Tumba" },
  "swe2-tyreso": { id: "swe2-tyreso", fullName: "Tyresö Handboll", shortName: "Tyresö" },
  "swe2-varberg": { id: "swe2-varberg", fullName: "HK Varberg", shortName: "HK Varberg" },
  "swe2-vasterasirsta": { id: "swe2-vasterasirsta", fullName: "VästeråsIrsta HF", shortName: "VästeråsIrsta" },
  "swe2-ystad2": { id: "swe2-ystad2", fullName: "IFK Ystad HK", shortName: "IFK Ystad" },

  // Division 1 Norra / Södra
  "se_club_bodens_bk_hf": { id: "se_club_bodens_bk_hf", fullName: "Bodens BK HF", shortName: "Bodens BK" },
  "se_club_enkopings_hf": { id: "se_club_enkopings_hf", fullName: "Enköpings HF", shortName: "Enköpings HF" },
  "se_club_hk_cliff": { id: "se_club_hk_cliff", fullName: "HK Cliff", shortName: "HK Cliff" },
  "se_club_hk_eskil": { id: "se_club_hk_eskil", fullName: "HK Eskil", shortName: "HK Eskil" },
  "se_club_ik_bolton": { id: "se_club_ik_bolton", fullName: "IK Bolton", shortName: "IK Bolton" },
  "se_club_lif_lindesberg": { id: "se_club_lif_lindesberg", fullName: "LIF Lindesberg", shortName: "LIF Lindesberg" },
  "se_club_rp_if_linkoping": { id: "se_club_rp_if_linkoping", fullName: "RP IF Linköping", shortName: "RP Linköping" },
  "se_club_rimbo_hk_roslagen": { id: "se_club_rimbo_hk_roslagen", fullName: "Rimbo HK Roslagen", shortName: "Rimbo HK" },
  "se_club_sannadals_sk": { id: "se_club_sannadals_sk", fullName: "Sannadals SK", shortName: "Sannadals SK" },
  "se_club_taby_hbk": { id: "se_club_taby_hbk", fullName: "Täby HBK", shortName: "Täby HBK" },
  "se_club_uppsala_hk": { id: "se_club_uppsala_hk", fullName: "Uppsala HK", shortName: "Uppsala HK" },
  "se_club_orebro_sk_hk_herr": { id: "se_club_orebro_sk_hk_herr", fullName: "Örebro SK HK", shortName: "Örebro SK" },
  "se_club_anderstorps_sk": { id: "se_club_anderstorps_sk", fullName: "Anderstorps SK", shortName: "Anderstorps SK" },
  "se_club_eslovs_hk": { id: "se_club_eslovs_hk", fullName: "Eslövs HK", shortName: "Eslövs HK" },
  "se_club_hk_country": { id: "se_club_hk_country", fullName: "HK Country", shortName: "HK Country" },
  "se_club_hk_s_hof": { id: "se_club_hk_s_hof", fullName: "HK S-hof", shortName: "HK S-hof" },
  "se_club_hk_onnerediterna": { id: "se_club_hk_onnerediterna", fullName: "HK Önnerediterna", shortName: "HK Önnerediterna" },
  "se_club_hp_alingsas": { id: "se_club_hp_alingsas", fullName: "HP Alingsås", shortName: "HP Alingsås" },
  "se_club_hp_warta": { id: "se_club_hp_warta", fullName: "HP Warta", shortName: "HP Warta" },
  "se_club_if_kristianstad": { id: "se_club_if_kristianstad", fullName: "IF Kristianstad", shortName: "IF Kristianstad" },
  "se_club_ik_lagan": { id: "se_club_ik_lagan", fullName: "IK Lågan", shortName: "IK Lågan" },
  "se_club_karra_hf": { id: "se_club_karra_hf", fullName: "Kärra HF", shortName: "Kärra HF" },
  "se_club_vinslovs_hk": { id: "se_club_vinslovs_hk", fullName: "Vinslövs HK", shortName: "Vinslövs HK" },
  "se_club_ahus_handboll": { id: "se_club_ahus_handboll", fullName: "Åhus Handboll", shortName: "Åhus Handboll" },
};

/**
 * Returns canonical full club name.
 */
export function getCanonicalClubName(clubIdOrName: string): string {
  if (!clubIdOrName) return "";
  const entry = CANONICAL_CLUB_MAP[clubIdOrName];
  if (entry) return entry.fullName;

  const lower = clubIdOrName.trim().toLowerCase();
  const match = Object.values(CANONICAL_CLUB_MAP).find(
    (c) => c.fullName.toLowerCase() === lower || c.shortName.toLowerCase() === lower
  );
  if (match) return match.fullName;

  const club = getClub(clubIdOrName);
  if (club) return club.name;

  return normalizeClubAcronyms(clubIdOrName);
}

/**
 * Returns canonical short name with acronyms preserved (e.g. IFK Tumba, HK Guif, OV Helsingborg).
 */
export function getCanonicalClubShortName(clubIdOrName: string): string {
  if (!clubIdOrName) return "";
  const entry = CANONICAL_CLUB_MAP[clubIdOrName];
  if (entry) return entry.shortName;

  const lower = clubIdOrName.trim().toLowerCase();
  const match = Object.values(CANONICAL_CLUB_MAP).find(
    (c) => c.fullName.toLowerCase() === lower || c.shortName.toLowerCase() === lower
  );
  if (match) return match.shortName;

  const club = getClub(clubIdOrName);
  if (club) return normalizeClubAcronyms(club.shortName || club.name);

  return normalizeClubAcronyms(clubIdOrName);
}

/**
 * Regex to restore standard Swedish handball club acronyms and mixed-case names
 * that might have been accidentally lowercased or upper-cased by generic formatters.
 */
const CANONICAL_ACRONYMS: [RegExp, string][] = [
  [/\bifk\b/gi, "IFK"],
  [/\bhk\b/gi, "HK"],
  [/\bov\b/gi, "OV"],
  [/\bik\b/gi, "IK"],
  [/\bhf\b/gi, "HF"],
  [/\bgf\b/gi, "GF"],
  [/\blif\b/gi, "LIF"],
  [/\brp\b/gi, "RP"],
  [/\bhp\b/gi, "HP"],
  [/\bhbk\b/gi, "HBK"],
  [/\bbk\b/gi, "BK"],
  [/\bsk\b/gi, "SK"],
  [/\bh43\b/gi, "H43"],
  [/\bvästeråsirsta\b/gi, "VästeråsIrsta"],
  [/\bvasterasirsta\b/gi, "VästeråsIrsta"],
  [/\bguif\b/gi, "Guif"],
  [/\bsävehof\b/gi, "Sävehof"],
  [/\bsvehof\b/gi, "Sävehof"],
  [/\btumba\b/gi, "Tumba"],
  [/\bhelsingborg\b/gi, "Helsingborg"],
];

export function normalizeClubAcronyms(text: string): string {
  if (!text) return "";
  let res = text;
  for (const [pattern, replacement] of CANONICAL_ACRONYMS) {
    res = res.replace(pattern, replacement);
  }
  return res;
}
