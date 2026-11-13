/**
 * Canonical club name resolution and capitalization preservation.
 * Ensures consistent, authentic Swedish handball club representation across
 * media, news, transfers, inbox, match reports, and headlines.
 */
import { getClub } from "./clubs";
import { clubNameKey, resolveClubByName } from "./clubIdentity";

export interface CanonicalClubInfo {
  id: string;
  fullName: string;
  shortName: string;
}

/**
 * Club Identity C2 (S3/T3): the media short form per Swedish tier 1-3 club.
 * This is a presentation variant only -- the FULL name always comes from the
 * club record (clubs.ts), so there is one name source. "HK Guif" had no
 * source and is corrected to Eskilstuna Guif (S3).
 */
const MEDIA_SHORT_NAMES: Readonly<Record<string, string>> = {
  "se_club_alingsas_hk": "Alingsås HK",
  "se_club_amo_hk": "Amo HK",
  "se_club_hammarby_if_hf": "Hammarby IF",
  "se_club_hf_karlskrona": "HF Karlskrona",
  "se_club_hk_malmo": "HK Malmö",
  "se_club_if_hallby_hk": "IF Hallby",
  "se_club_ifk_kristianstad": "IFK Kristianstad",
  "se_club_ifk_skovde_hk": "IFK Skövde",
  "se_club_ik_savehof": "IK Sävehof",
  "se_club_lugi_hf": "Lugi HF",
  "se_club_ov_helsingborg": "OV Helsingborg",
  "se_club_skanela_if": "Skånela IF",
  "se_club_ystads_if_hf": "Ystads IF",
  "se_club_onnereds_hk": "Önnereds HK",
  "swe2-aranas": "HK Aranäs",
  "swe2-drott": "HK Drott",
  "swe2-guif": "Eskilstuna Guif",
  "swe2-h43lund": "H43 Lund",
  "swe2-huddinge": "Huddinge HK",
  "swe2-kroppskultur": "GF Kroppskultur",
  "swe2-kungalv": "Kungälvs HK",
  "swe2-redbergslid": "Redbergslids IK",
  "swe2-torslanda": "HK Torslanda",
  "swe2-tumba": "IFK Tumba",
  "swe2-tyreso": "Tyresö",
  "swe2-varberg": "HK Varberg",
  "swe2-vasterasirsta": "VästeråsIrsta",
  "swe2-ystad2": "IFK Ystad",
  "se_club_bodens_bk_hf": "Bodens BK",
  "se_club_enkopings_hf": "Enköpings HF",
  "se_club_hk_cliff": "HK Cliff",
  "se_club_hk_eskil": "HK Eskil",
  "se_club_ik_bolton": "IK Bolton",
  "se_club_lif_lindesberg": "LIF Lindesberg",
  "se_club_rp_if_linkoping": "RP Linköping",
  "se_club_rimbo_hk_roslagen": "Rimbo HK",
  "se_club_sannadals_sk": "Sannadals SK",
  "se_club_taby_hbk": "Täby HBK",
  "se_club_uppsala_hk": "Uppsala HK",
  "se_club_orebro_sk_hk_herr": "Örebro SK",
  "se_club_anderstorps_sk": "Anderstorps SK",
  "se_club_eslovs_hk": "Eslövs HK",
  "se_club_hk_country": "HK Country",
  "se_club_hk_s_hof": "HK S-hof",
  "se_club_hk_onnerediterna": "HK Önnerediterna",
  "se_club_hp_alingsas": "HP Alingsås",
  "se_club_hp_warta": "HP Warta",
  "se_club_if_kristianstad": "IF Kristianstad",
  "se_club_ik_lagan": "IK Lågan",
  "se_club_karra_hf": "Kärra HF",
  "se_club_vinslovs_hk": "Vinslövs HK",
  "se_club_ahus_handboll": "Åhus Handboll",
};

/** Media full name: the record name without the "herr" gender qualifier of a federation registration. */
function mediaFullName(name: string): string {
  return name.replace(/\s+herr$/i, "");
}

export const CANONICAL_CLUB_MAP: Record<string, CanonicalClubInfo> = Object.fromEntries(
  Object.entries(MEDIA_SHORT_NAMES).map(([id, shortName]) => {
    const club = getClub(id);
    if (!club) throw new Error(`Canonical club name map references unknown club id ${id}.`);
    return [id, { id, fullName: mediaFullName(club.name), shortName }];
  }),
);

/** The single map entry a free-text name identifies, or undefined when unknown or ambiguous (never a silent wrong pick). */
function uniqueMapEntryByName(text: string): CanonicalClubInfo | undefined {
  const key = clubNameKey(text);
  const hits = Object.values(CANONICAL_CLUB_MAP).filter((c) => clubNameKey(c.fullName) === key || clubNameKey(c.shortName) === key);
  return hits.length === 1 ? hits[0] : undefined;
}

/**
 * Returns canonical full club name.
 */
export function getCanonicalClubName(clubIdOrName: string): string {
  if (!clubIdOrName) return "";
  const entry = CANONICAL_CLUB_MAP[clubIdOrName];
  if (entry) return entry.fullName;

  // Id first, then an UNIQUE exact name; an ambiguous name is never resolved to a guess.
  const club = getClub(clubIdOrName);
  if (club) return club.name;
  const match = uniqueMapEntryByName(clubIdOrName);
  if (match) return match.fullName;
  const named = resolveClubByName(clubIdOrName);
  if (named) return CANONICAL_CLUB_MAP[named.id]?.fullName ?? named.name;

  return normalizeClubAcronyms(clubIdOrName);
}

/**
 * Returns canonical short name with acronyms preserved (e.g. IFK Tumba, Eskilstuna Guif, OV Helsingborg).
 */
export function getCanonicalClubShortName(clubIdOrName: string): string {
  if (!clubIdOrName) return "";
  const entry = CANONICAL_CLUB_MAP[clubIdOrName];
  if (entry) return entry.shortName;

  const club = getClub(clubIdOrName);
  if (club) return normalizeClubAcronyms(club.shortName || club.name);
  const match = uniqueMapEntryByName(clubIdOrName);
  if (match) return match.shortName;
  const named = resolveClubByName(clubIdOrName);
  if (named) return CANONICAL_CLUB_MAP[named.id]?.shortName ?? normalizeClubAcronyms(named.shortName || named.name);

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
