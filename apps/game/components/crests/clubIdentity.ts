// HM-RICH-EXPERIENCE-01 Stage D: Central Club Identity & Bespoke Alternative Crest Registry.
//
// Every playable Swedish club in Handbollsligan and Herrallsvenskan (28 clubs)
// has a distinct, club-specific vector identity mark informed by its club name,
// initials, established colours, city/region, founding heritage, and local
// symbolism. Where an official licensed crest is not registered in
// CLUB_CREST_ASSETS, <ClubCrest> renders these bespoke club marks and marks
// them honestly as non-official (`data-official="false"`).

import { getClub } from "@/lib/game-data";
import { contrastRatio, crestPalette } from "./crestPalette";

export type CrestShape =
  | "IFK_STAR_SHIELD"
  | "ROUNDEL_BADGE"
  | "HERALDIC_CREST"
  | "LAUREL_TRADITION"
  | "STRIPED_SHIELD"
  | "DIAMOND_PENNANT"
  | "VIKING_CHEVRON";

export type CrestMotif =
  | "STAR_4"
  | "STAR_6"
  | "CROWN"
  | "TOWER"
  | "ANCHOR"
  | "LAUREL"
  | "STRIPES"
  | "SASH"
  | "FLAME"
  | "WAVE"
  | "WINGS"
  | "FORGE"
  | "PINE"
  | "CHEVRON"
  | "HEARTS"
  | "TORCH";

export type CrestPattern =
  | "SOLID"
  | "VERTICAL_STRIPES"
  | "DIAGONAL_SASH"
  | "HALF_SPLIT"
  | "CHEVRON_SPLIT"
  | "RINGED"
  | "QUARTERED";

export interface ClubIdentitySpec {
  readonly clubId: string;
  readonly shape: CrestShape;
  readonly pattern: CrestPattern;
  readonly motif: CrestMotif;
  readonly monogram: string;
  readonly banner: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
  readonly heritageTag: string;
}

export const PLAYABLE_CLUB_IDENTITIES: Readonly<Record<string, ClubIdentitySpec>> = {
  // --- Handbollsligan (14 clubs) ---
  se_club_alingsas_hk: {
    clubId: "se_club_alingsas_hk",
    shape: "STRIPED_SHIELD",
    pattern: "DIAGONAL_SASH",
    motif: "CROWN",
    monogram: "AHK",
    banner: "ALINGSÅS",
    primaryColor: "#c8102e",
    secondaryColor: "#111318",
    accentColor: "#f4c542",
    heritageTag: "Estrad Alingsås · Västsvensk spets & akademitradition",
  },
  se_club_amo_hk: {
    clubId: "se_club_amo_hk",
    shape: "DIAMOND_PENNANT",
    pattern: "CHEVRON_SPLIT",
    motif: "PINE",
    monogram: "AMO",
    banner: "ALSTERMO",
    primaryColor: "#0b6e4f",
    secondaryColor: "#ffffff",
    accentColor: "#d4af37",
    heritageTag: "Amokabel-hallen · Småländsk brukskraft i elitserien",
  },
  se_club_hammarby_if_hf: {
    clubId: "se_club_hammarby_if_hf",
    shape: "STRIPED_SHIELD",
    pattern: "VERTICAL_STRIPES",
    motif: "LAUREL",
    monogram: "HIF",
    banner: "STOCKHOLM",
    primaryColor: "#0a7a3d",
    secondaryColor: "#ffffff",
    accentColor: "#e2b13c",
    heritageTag: "Eriksdalshallen · Södermalms grönvita handbollsfäste",
  },
  se_club_hf_karlskrona: {
    clubId: "se_club_hf_karlskrona",
    shape: "HERALDIC_CREST",
    pattern: "HALF_SPLIT",
    motif: "ANCHOR",
    monogram: "HFK",
    banner: "KARLSKRONA",
    primaryColor: "#e2b13c",
    secondaryColor: "#111318",
    accentColor: "#ffffff",
    heritageTag: "Brinova Arena · Örlogsstadens guldsvarta elitklubb",
  },
  se_club_hk_malmo: {
    clubId: "se_club_hk_malmo",
    shape: "ROUNDEL_BADGE",
    pattern: "RINGED",
    motif: "WINGS",
    monogram: "HKM",
    banner: "MALMÖ",
    primaryColor: "#1e3a8a",
    secondaryColor: "#ffffff",
    accentColor: "#38bdf8",
    heritageTag: "Baltiska hallen · Skånsk storstadshandboll",
  },
  se_club_if_hallby_hk: {
    clubId: "se_club_if_hallby_hk",
    shape: "DIAMOND_PENNANT",
    pattern: "DIAGONAL_SASH",
    motif: "CHEVRON",
    monogram: "HB",
    banner: "JÖNKÖPING",
    primaryColor: "#111318",
    secondaryColor: "#e2b13c",
    accentColor: "#ffffff",
    heritageTag: "Jönköpings Idrottshus · Smålands svartgula utmanare",
  },
  se_club_ifk_kristianstad: {
    clubId: "se_club_ifk_kristianstad",
    shape: "IFK_STAR_SHIELD",
    pattern: "SOLID",
    motif: "STAR_4",
    monogram: "IFK",
    banner: "1899",
    primaryColor: "#1e3a8a",
    secondaryColor: "#ffffff",
    accentColor: "#ea580c",
    heritageTag: "Kristianstad Arena · Publikfest & mästartradition sedan 1899",
  },
  se_club_ifk_skovde_hk: {
    clubId: "se_club_ifk_skovde_hk",
    shape: "IFK_STAR_SHIELD",
    pattern: "HALF_SPLIT",
    motif: "STAR_4",
    monogram: "IFK",
    banner: "SKÖVDE",
    primaryColor: "#1e3a8a",
    secondaryColor: "#ffffff",
    accentColor: "#93c5fd",
    heritageTag: "Arena Skövde · Blåvit kamratanda och elitfostran",
  },
  se_club_ik_savehof: {
    clubId: "se_club_ik_savehof",
    shape: "ROUNDEL_BADGE",
    pattern: "VERTICAL_STRIPES",
    motif: "CROWN",
    monogram: "IKS",
    banner: "PARTILLE",
    primaryColor: "#111318",
    secondaryColor: "#e2b13c",
    accentColor: "#ffffff",
    heritageTag: "Partille Arena · Gulsvart dynasti och talangfabrik",
  },
  se_club_lugi_hf: {
    clubId: "se_club_lugi_hf",
    shape: "LAUREL_TRADITION",
    pattern: "SOLID",
    motif: "LAUREL",
    monogram: "LUGI",
    banner: "LUND 1912",
    primaryColor: "#111318",
    secondaryColor: "#e2b13c",
    accentColor: "#7f1d1d",
    heritageTag: "Sparbanken Skåne Arena · Akademisk handbollstradition sedan 1912",
  },
  se_club_ov_helsingborg: {
    clubId: "se_club_ov_helsingborg",
    shape: "HERALDIC_CREST",
    pattern: "QUARTERED",
    motif: "TOWER",
    monogram: "OV",
    banner: "HELSINGBORG",
    primaryColor: "#c8102e",
    secondaryColor: "#111318",
    accentColor: "#ffffff",
    heritageTag: "Helsingborg Arena · Sundets stolthet mellan Olympia och Vikingarna",
  },
  se_club_skanela_if: {
    clubId: "se_club_skanela_if",
    shape: "VIKING_CHEVRON",
    pattern: "CHEVRON_SPLIT",
    motif: "WINGS",
    monogram: "SIF",
    banner: "MÄRSTA",
    primaryColor: "#0b6e4f",
    secondaryColor: "#111318",
    accentColor: "#e2b13c",
    heritageTag: "Vikingahallen · Uppländsk kampvilja och föreningshjärta",
  },
  se_club_ystads_if_hf: {
    clubId: "se_club_ystads_if_hf",
    shape: "LAUREL_TRADITION",
    pattern: "HALF_SPLIT",
    motif: "STAR_6",
    monogram: "YIF",
    banner: "YSTAD 1908",
    primaryColor: "#111318",
    secondaryColor: "#e2b13c",
    accentColor: "#ffffff",
    heritageTag: "Ystad Arena · Klassiskt handbollsfäste vid sydkusten",
  },
  se_club_onnereds_hk: {
    clubId: "se_club_onnereds_hk",
    shape: "ROUNDEL_BADGE",
    pattern: "RINGED",
    motif: "WAVE",
    monogram: "ÖHK",
    banner: "GÖTEBORG",
    primaryColor: "#0b6e4f",
    secondaryColor: "#ffffff",
    accentColor: "#a7f3d0",
    heritageTag: "ÖHK-hallen · Västra Göteborgs grönvita kraftcentrum",
  },

  // --- Herrallsvenskan (14 clubs) ---
  "swe2-aranas": {
    clubId: "swe2-aranas",
    shape: "HERALDIC_CREST",
    pattern: "SOLID",
    motif: "TOWER",
    monogram: "HKA",
    banner: "KUNGSBACKA",
    primaryColor: "#1e3a8a",
    secondaryColor: "#e2b13c",
    accentColor: "#ffffff",
    heritageTag: "Kungsbacka · Nordhalländsk spelarutveckling och struktur",
  },
  "swe2-drott": {
    clubId: "swe2-drott",
    shape: "HERALDIC_CREST",
    pattern: "VERTICAL_STRIPES",
    motif: "HEARTS",
    monogram: "DROTT",
    banner: "HALMSTAD",
    primaryColor: "#c8102e",
    secondaryColor: "#111318",
    accentColor: "#e2b13c",
    heritageTag: "Halmstad Arena · Klassisk mästarklubb med elva SM-guld",
  },
  "swe2-guif": {
    clubId: "swe2-guif",
    shape: "ROUNDEL_BADGE",
    pattern: "RINGED",
    motif: "FORGE",
    monogram: "GUIF",
    banner: "ESKILSTUNA",
    primaryColor: "#c8102e",
    secondaryColor: "#111318",
    accentColor: "#ffffff",
    heritageTag: "Volvo CE Arena · Sörmländsk handbollskultur sedan 1896",
  },
  "swe2-h43lund": {
    clubId: "swe2-h43lund",
    shape: "STRIPED_SHIELD",
    pattern: "DIAGONAL_SASH",
    motif: "SASH",
    monogram: "H43",
    banner: "LUND 1943",
    primaryColor: "#1e3a8a",
    secondaryColor: "#e2b13c",
    accentColor: "#ffffff",
    heritageTag: "Sparbanken Skåne Arena · Lundensisk profilklubb grundad 1943",
  },
  "swe2-huddinge": {
    clubId: "swe2-huddinge",
    shape: "DIAMOND_PENNANT",
    pattern: "SOLID",
    motif: "FLAME",
    monogram: "HHK",
    banner: "HUDDINGE",
    primaryColor: "#0b6e4f",
    secondaryColor: "#ffffff",
    accentColor: "#6ee7b7",
    heritageTag: "Huddinge · Södertörns bredd- och talangfäste",
  },
  "swe2-kroppskultur": {
    clubId: "swe2-kroppskultur",
    shape: "ROUNDEL_BADGE",
    pattern: "HALF_SPLIT",
    motif: "TORCH",
    monogram: "GFK",
    banner: "UDDEVALLA",
    primaryColor: "#111318",
    secondaryColor: "#c8102e",
    accentColor: "#e2b13c",
    heritageTag: "Agnebergshallen · Bohusläns klassiska handbollsförening",
  },
  "swe2-kungalv": {
    clubId: "swe2-kungalv",
    shape: "HERALDIC_CREST",
    pattern: "CHEVRON_SPLIT",
    motif: "TOWER",
    monogram: "KHK",
    banner: "KUNGÄLV",
    primaryColor: "#c8102e",
    secondaryColor: "#111318",
    accentColor: "#ffffff",
    heritageTag: "Mimershallen · Fästningsstadens handbollsstolthet",
  },
  "swe2-redbergslid": {
    clubId: "swe2-redbergslid",
    shape: "LAUREL_TRADITION",
    pattern: "SOLID",
    motif: "LAUREL",
    monogram: "RIK",
    banner: "GÖTEBORG 1916",
    primaryColor: "#111318",
    secondaryColor: "#e2b13c",
    accentColor: "#ffffff",
    heritageTag: "Prioritet Serneke Arena · De Vita Elefanterna · 20 SM-guld",
  },
  "swe2-torslanda": {
    clubId: "swe2-torslanda",
    shape: "VIKING_CHEVRON",
    pattern: "CHEVRON_SPLIT",
    motif: "WINGS",
    monogram: "HKT",
    banner: "TORSLANDA",
    primaryColor: "#0b6e4f",
    secondaryColor: "#ffffff",
    accentColor: "#111318",
    heritageTag: "Torslanda · Hisingens snabba omställningshandboll",
  },
  "swe2-tumba": {
    clubId: "swe2-tumba",
    shape: "IFK_STAR_SHIELD",
    pattern: "SOLID",
    motif: "STAR_4",
    monogram: "IFK",
    banner: "TUMBA 1969",
    primaryColor: "#1e3a8a",
    secondaryColor: "#ffffff",
    accentColor: "#f59e0b",
    heritageTag: "Tumba Idrottshus · Botkyrkas blåvita kamratförening",
  },
  "swe2-tyreso": {
    clubId: "swe2-tyreso",
    shape: "ROUNDEL_BADGE",
    pattern: "RINGED",
    motif: "WAVE",
    monogram: "TYR",
    banner: "TYRESÖ",
    primaryColor: "#1e3a8a",
    secondaryColor: "#ffffff",
    accentColor: "#f59e0b",
    heritageTag: "Tyresöhallen · Södertörns offensiva utmanare",
  },
  "swe2-varberg": {
    clubId: "swe2-varberg",
    shape: "HERALDIC_CREST",
    pattern: "HALF_SPLIT",
    motif: "TOWER",
    monogram: "HKV",
    banner: "VARBERG",
    primaryColor: "#111318",
    secondaryColor: "#c8102e",
    accentColor: "#e2b13c",
    heritageTag: "Arena Varberg · Västkustens kustfästning",
  },
  "swe2-vasterasirsta": {
    clubId: "swe2-vasterasirsta",
    shape: "VIKING_CHEVRON",
    pattern: "DIAGONAL_SASH",
    motif: "CHEVRON",
    monogram: "VI",
    banner: "VÄSTERÅS",
    primaryColor: "#1e3a8a",
    secondaryColor: "#ffffff",
    accentColor: "#111318",
    heritageTag: "Expandia Arena · Mälardalens handbollskraft",
  },
  "swe2-ystad2": {
    clubId: "swe2-ystad2",
    shape: "IFK_STAR_SHIELD",
    pattern: "RINGED",
    motif: "STAR_4",
    monogram: "IFK",
    banner: "YSTAD",
    primaryColor: "#1e3a8a",
    secondaryColor: "#ffffff",
    accentColor: "#60a5fa",
    heritageTag: "Ystad Arena · Kamratföreningen i handbollsstaden",
  },
};

const SHAPES: readonly CrestShape[] = [
  "ROUNDEL_BADGE",
  "HERALDIC_CREST",
  "LAUREL_TRADITION",
  "STRIPED_SHIELD",
  "DIAMOND_PENNANT",
  "VIKING_CHEVRON",
  "IFK_STAR_SHIELD",
];

const PATTERNS: readonly CrestPattern[] = [
  "SOLID",
  "VERTICAL_STRIPES",
  "DIAGONAL_SASH",
  "HALF_SPLIT",
  "CHEVRON_SPLIT",
  "RINGED",
  "QUARTERED",
];

const MOTIFS: readonly CrestMotif[] = [
  "CROWN",
  "TOWER",
  "LAUREL",
  "SASH",
  "FLAME",
  "WAVE",
  "WINGS",
  "CHEVRON",
  "STAR_6",
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function deriveInitials(label: string): string {
  const words = label.trim().split(/[\s/-]+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0].toUpperCase();
    if (first === "IFK" || first === "H43" || first === "OV" || first === "GOG" || first === "THW") {
      return first;
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return label.slice(0, 3).toUpperCase();
}

export function resolveClubIdentity(
  clubId?: string,
  shortName?: string,
  primaryColor?: string,
  secondaryColor?: string,
): ClubIdentitySpec {
  if (clubId && PLAYABLE_CLUB_IDENTITIES[clubId]) {
    const spec = PLAYABLE_CLUB_IDENTITIES[clubId];
    return {
      ...spec,
      primaryColor: primaryColor || spec.primaryColor,
      secondaryColor: secondaryColor || spec.secondaryColor,
    };
  }

  const club = clubId ? getClub(clubId) : undefined;
  const name = club?.name ?? shortName ?? "Klubb";
  const short = club?.shortName ?? shortName ?? "HK";
  const pColor = primaryColor ?? club?.primaryColor ?? "#1e3a8a";
  const sColor = secondaryColor ?? club?.secondaryColor ?? "#ffffff";
  const h = hashString(clubId ?? name);

  const isIfk = /\bIFK\b/i.test(name) || /\bIFK\b/i.test(short);
  const shape: CrestShape = isIfk
    ? "IFK_STAR_SHIELD"
    : SHAPES[h % (SHAPES.length - 1)];
  const pattern: CrestPattern = PATTERNS[(h >> 3) % PATTERNS.length];
  const motif: CrestMotif = isIfk ? "STAR_4" : MOTIFS[(h >> 6) % MOTIFS.length];
  const monogram = deriveInitials(short);
  const banner = (club?.city ?? short).toUpperCase().slice(0, 12);
  const palette = crestPalette(pColor, sColor);
  const accentColor = palette?.text ?? "#ffffff";

  return {
    clubId: clubId ?? short,
    shape,
    pattern,
    motif,
    monogram,
    banner,
    primaryColor: pColor,
    secondaryColor: sColor,
    accentColor: contrastRatio(accentColor, pColor) >= 3 ? accentColor : "#e2b13c",
    heritageTag: club?.venue
      ? `${club.venue}${club.city ? ` · ${club.city}` : ""}`
      : club?.city ?? "Handbollsklubb",
  };
}
