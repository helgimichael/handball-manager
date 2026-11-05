import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "../lib/editor/catalog";
import { loadRealWorldClubSquad } from "../lib/gameWorld/realWorldLoader";
import { loadRatingDatabase, lockPlayerRating, type LockedPlayerRating } from "../lib/editor/ratingDatabaseRepository";
import { setRatingOverride } from "../lib/editor/ratingOverrideRepository";
import { setReviewStatus } from "../lib/editor/ratingReviewRepository";
import { proposePlayerRating } from "../lib/rating/pipeline/proposalEngine";
import { applyCAEstimation } from "../lib/rating/caEstimation/applyCAEstimation";
import { applyGamePrior } from "../lib/rating/gamePrior/applyGamePrior";
import { generatePlayerRatingProfile } from "../lib/rating/generation/generationEngine";
import { GENERATION_MODEL_VERSION } from "../lib/rating/generation/types";
import { GAME_PRIOR_MODEL_VERSION } from "../lib/rating/gamePrior/types";

const REPORT_DIR = "C:/DEV/QA/reports/HM-CA-PA-CALIBRATION-2026-27";

interface ProposedRatingRow {
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  position: string;
  age: number | null;
  currentCA: number;
  proposedCA: number;
  diffCA: number;
  currentPA: number;
  proposedPA: number;
  diffPA: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  status: "APPLY_CALIBRATION" | "CONFIRMED_UNCHANGED" | "PENDING_ADDITIONAL_EVIDENCE";
  evidenceSupportingChange: string;
  remainingUncertainty: string;
}

// 30 Calibration Sample Players Specification
const CALIBRATION_DATA: ProposedRatingRow[] = [
  // 1. INTERNATIONAL TIER
  {
    playerId: "player_intl_sander_sagosen_c782fa51",
    name: "Sander Sagosen",
    clubId: "den1-aalborg",
    clubName: "Aalborg Håndbold",
    competitionId: "den-1",
    position: "M9",
    age: 30,
    currentCA: 178,
    proposedCA: 178,
    diffCA: 0,
    currentPA: 180,
    proposedPA: 180,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Champions League elite performer, primary game controller for Aalborg & Norway. Rating verified by multi-season European performance.",
    remainingUncertainty: "Minimal. Established world-class ceiling.",
  },
  {
    playerId: "player_intl_lasse_ludwig_180f40b8",
    name: "Lasse Ludwig",
    clubId: "ger1-fuchse",
    clubName: "Füchse Berlin",
    competitionId: "ger-1",
    position: "MV",
    age: 23,
    currentCA: 150,
    proposedCA: 150,
    diffCA: 0,
    currentPA: 165,
    proposedPA: 165,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Füchse Berlin starting/rotation goalkeeper with proven Bundesliga save metrics.",
    remainingUncertainty: "Low. High developmental upside verified by top-flight German league match time.",
  },
  {
    playerId: "player_intl_mirko_alilovic_a5ed9b83",
    name: "Mirko Alilović",
    clubId: "int-wisla-plock",
    clubName: "ORLEN Wisła Płock",
    competitionId: "int-pol-1",
    position: "MV",
    age: 40,
    currentCA: 145,
    proposedCA: 145,
    diffCA: 0,
    currentPA: 145,
    proposedPA: 145,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "40-year-old veteran with EHF CL pedigree. Decelerating athletic reflexes compensated by positioning.",
    remainingUncertainty: "Low. Established ceiling with natural physical age decline.",
  },
  {
    playerId: "player_intl_emil_hovgaard_pedersen_a169f355",
    name: "Emil Hovgaard Pedersen",
    clubId: "den1-bjerringbro",
    clubName: "Bjerringbro-Silkeborg",
    competitionId: "den-1",
    position: "MV",
    age: 18,
    currentCA: 105,
    proposedCA: 105,
    diffCA: 0,
    currentPA: 158,
    proposedPA: 142,
    diffPA: -16,
    confidence: "MEDIUM",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Danish academy reserve goalkeeper. Previous PA 158 was an artificial +53 age-formula artifact without senior minutes.",
    remainingUncertainty: "Medium. High developmental runway (+37 points) maintained, but normalized from unevidenced world-class ceiling.",
  },

  // 2. HANDBOLLSLIGAN ELITE & STARS
  {
    playerId: "se_player_august_wiger_94e4bcd0",
    name: "August Wiger",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "M9",
    age: 29,
    currentCA: 147,
    proposedCA: 152,
    diffCA: 5,
    currentPA: 153,
    proposedPA: 154,
    diffPA: 1,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Four seasons in Danish top flight, primary attack organizer and game engine for Alingsås in 2026/27. Re-centered as premier domestic playmaker.",
    remainingUncertainty: "Low. Consistent high-volume performance across multiple seasons.",
  },
  {
    playerId: "se_player_niklas_kraft_e8842f13",
    name: "Niklas Kraft",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "MV",
    age: 32,
    currentCA: 147,
    proposedCA: 150,
    diffCA: 3,
    currentPA: 150,
    proposedPA: 150,
    diffPA: 0,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "SM Gold 2022, 300+ Swedish matches, 3 Danish seasons. High-volume elite shot-stopping standard (>34% saves).",
    remainingUncertainty: "Low. Top-tier Swedish goalkeeper benchmark.",
  },
  {
    playerId: "player_andreas_nilsson_e7db3e42",
    name: "Andreas Nilsson",
    clubId: "se_club_onnereds_hk",
    clubName: "Önnereds HK",
    competitionId: "se_handbollsligan_herr",
    position: "M6",
    age: 36,
    currentCA: 160,
    proposedCA: 160,
    diffCA: 0,
    currentPA: 160,
    proposedPA: 160,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Champions League winner, Veszprém legend, Swedish national team pivot. Elite catch & finish at 6m.",
    remainingUncertainty: "Low. Verified offensive pivot ceiling.",
  },
  {
    playerId: "se_player_benjamin_helander_b5cece84",
    name: "Benjamin Helander",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "V6",
    age: 27,
    currentCA: 138,
    proposedCA: 142,
    diffCA: 4,
    currentPA: 140,
    proposedPA: 142,
    diffPA: 2,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Finnish senior international (38 caps), German Cup winner & Bundesliga player (Rhein-Neckar Löwen). High-conversion wing finishing.",
    remainingUncertainty: "Low. Re-centered above domestic starter baseline to reflect international efficiency.",
  },
  {
    playerId: "se_player_arvid_boquist_39bb770d",
    name: "Arvid Boquist",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "V9",
    age: 21,
    currentCA: 145,
    proposedCA: 145,
    diffCA: 0,
    currentPA: 156,
    proposedPA: 156,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Handbollsligan All-Star Defender of the Year 2025/26. Dominant central 6-0 defensive block.",
    remainingUncertainty: "Medium. Re-injury history tracked, but current playing ability fully verified.",
  },
  {
    playerId: "se_player_anders_wik_rydberg_795e9eac",
    name: "Anders Wik Rydberg",
    clubId: "se_club_hammarby_if_hf",
    clubName: "Hammarby IF HF",
    competitionId: "se_handbollsligan_herr",
    position: "V9",
    age: 34,
    currentCA: 134,
    proposedCA: 134,
    diffCA: 0,
    currentPA: 134,
    proposedPA: 134,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Pure 6-0 central defensive specialist for Hammarby. Evaluated on elite defensive attributes without penalty for zero offensive usage.",
    remainingUncertainty: "Low. Pure specialist benchmark.",
  },

  // 3. HANDBOLLSLIGAN STARTERS & ROTATION
  {
    playerId: "se_player_alexander_regen_705fa7a6",
    name: "Alexander Regen",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "M6",
    age: 26,
    currentCA: 134,
    proposedCA: 134,
    diffCA: 0,
    currentPA: 134,
    proposedPA: 134,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Alingsås captain. Two-way starting line player, central defense anchor and consistent 6m scoring.",
    remainingUncertainty: "Low. Established starter baseline.",
  },
  {
    playerId: "se_player_carl_ryden_d5428e1f",
    name: "Carl Rydén",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "H9",
    age: 21,
    currentCA: 136,
    proposedCA: 136,
    diffCA: 0,
    currentPA: 154,
    proposedPA: 148,
    diffPA: -6,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "146 Allsvenskan goals in 2025/26 (8th in league); signed 3-year HBL deal. Proven volume shooter entering top-flight rotation.",
    remainingUncertainty: "Medium. Rate of adaptation against top-tier 6-0 defensive blocks.",
  },
  {
    playerId: "se_player_petter_donaldson_80cffba4",
    name: "Petter Donaldson",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "V9",
    age: 23,
    currentCA: 140,
    proposedCA: 140,
    diffCA: 0,
    currentPA: 144,
    proposedPA: 144,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Alingsås leading scorer 2025/26 with 110 goals. Reliable 9m distance shooter.",
    remainingUncertainty: "Low. Established scoring starter.",
  },
  {
    playerId: "player_liam_hultberg_d2b82295",
    name: "Liam Hultberg",
    clubId: "se_club_ystads_if_hf",
    clubName: "Ystads IF HF",
    competitionId: "se_handbollsligan_herr",
    position: "V9",
    age: 20,
    currentCA: 150,
    proposedCA: 150,
    diffCA: 0,
    currentPA: 168,
    proposedPA: 168,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "Ystads IF scoring prodigy. High current scoring efficiency with legitimate international upside.",
    remainingUncertainty: "Medium. High ceiling verified by production, consistency monitored.",
  },
  {
    playerId: "player_malte_mansson_1d49a03b",
    name: "Malte Månsson",
    clubId: "se_club_hk_malmo",
    clubName: "HK Malmö",
    competitionId: "se_handbollsligan_herr",
    position: "H9",
    age: 20,
    currentCA: 112,
    proposedCA: 114,
    diffCA: 2,
    currentPA: 160,
    proposedPA: 156,
    diffPA: -4,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Swedish U20 European Championship delegation 2026; transferred to HK Malmö. Solidified senior rotation ability.",
    remainingUncertainty: "Medium. High upside confirmed by national team pedigree, adapting to senior physical contact.",
  },
  {
    playerId: "se_player_edwin_tengros_eec4c59b",
    name: "Edwin Tengros",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "V6",
    age: 19,
    currentCA: 122,
    proposedCA: 122,
    diffCA: 0,
    currentPA: 150,
    proposedPA: 148,
    diffPA: -2,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Selected for U20 European Championship 2026; Alingsås academy wing. High technical finishing standard.",
    remainingUncertainty: "Low. Realistic upside (+26 points) preserved.",
  },
  {
    playerId: "se_player_max_sellstedt_314fc84c",
    name: "Max Sellstedt",
    clubId: "se_club_alingsas_hk",
    clubName: "Alingsås HK",
    competitionId: "se_handbollsligan_herr",
    position: "V9",
    age: 17,
    currentCA: 98,
    proposedCA: 98,
    diffCA: 0,
    currentPA: 170,
    proposedPA: 152,
    diffPA: -18,
    confidence: "MEDIUM",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Born 2009. Best attacking player P16 USM 2026. Current PA 170 was an extreme mathematical artifact (+72 points).",
    remainingUncertainty: "High. Exceptional teenage pedigree; normalized PA 152 preserves massive +54 growth ceiling.",
  },

  // 4. ALLSVENSKAN STANDOUTS & STARTERS
  {
    playerId: "se_player_elliot_hovre_bjorck_40a6f29e",
    name: "Elliot Hövre Björck",
    clubId: "swe2-drott",
    clubName: "HK Drott Halmstad",
    competitionId: "swe-2",
    position: "MV",
    age: 21,
    currentCA: 118,
    proposedCA: 118,
    diffCA: 0,
    currentPA: 138,
    proposedPA: 136,
    diffPA: -2,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "HK Drott starting goalkeeper; core second-tier performer, consistent 60-minute match volume.",
    remainingUncertainty: "Low. Proven second-tier starter standard.",
  },
  {
    playerId: "se_player_axel_winstrom_c59447b8",
    name: "Axel Winström",
    clubId: "swe2-redbergslid",
    clubName: "Redbergslids IK",
    competitionId: "swe-2",
    position: "MV",
    age: 21,
    currentCA: 116,
    proposedCA: 114,
    diffCA: -2,
    currentPA: 132,
    proposedPA: 128,
    diffPA: -4,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Redbergslids IK rotation goalkeeper. Re-centered to represent competitive second-tier backup depth.",
    remainingUncertainty: "Low. Differentiated from starting peer Elliot Hövre Björck.",
  },
  {
    playerId: "se_player_emil_arthursson_e99d2749",
    name: "Emil Arthursson",
    clubId: "swe2-h43lund",
    clubName: "H43 Lund HF",
    competitionId: "swe-2",
    position: "MV",
    age: 26,
    currentCA: 126,
    proposedCA: 126,
    diffCA: 0,
    currentPA: 128,
    proposedPA: 128,
    diffPA: 0,
    confidence: "HIGH",
    status: "CONFIRMED_UNCHANGED",
    evidenceSupportingChange: "H43 Lund starting GK with Handbollsligan experience at Karlskrona. Upper second-tier standard.",
    remainingUncertainty: "Low. Mature, proven goalkeeper between HBL fringe and top Allsvenskan.",
  },
  {
    playerId: "se_player_hugo_lundberg_eef2c0f4",
    name: "Hugo Lundberg",
    clubId: "swe2-ystad2",
    clubName: "IFK Ystad HK",
    competitionId: "swe-2",
    position: "V9",
    age: 19,
    currentCA: 109,
    proposedCA: 109,
    diffCA: 0,
    currentPA: 140,
    proposedPA: 138,
    diffPA: -2,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "IFK Ystad defender with HBL apprentice experience (~27 match sheets at Ystads IF).",
    remainingUncertainty: "Medium. Specialized defensive profile; offensive growth bounded.",
  },
  {
    playerId: "se_player_alvin_sundstrom_733a7887",
    name: "Alvin Sundström",
    clubId: "swe2-kroppskultur",
    clubName: "GF Kroppskultur",
    competitionId: "swe-2",
    position: "MV",
    age: 17,
    currentCA: 91,
    proposedCA: 91,
    diffCA: 0,
    currentPA: 158,
    proposedPA: 126,
    diffPA: -32,
    confidence: "LOW",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "17-year-old backup GK for Kroppskultur with no senior minutes. Previous PA 158 was an unevidenced age-inflation artifact (+67 points).",
    remainingUncertainty: "Medium. Normalized PA 126 preserves generous +35 point growth runway to solid Allsvenskan senior level.",
  },
  {
    playerId: "se_player_love_ljungqvist_3f94aca6",
    name: "Love Ljungqvist",
    clubId: "swe2-kroppskultur",
    clubName: "GF Kroppskultur",
    competitionId: "swe-2",
    position: "V6",
    age: 17,
    currentCA: 92,
    proposedCA: 92,
    diffCA: 0,
    currentPA: 160,
    proposedPA: 128,
    diffPA: -32,
    confidence: "LOW",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "17-year-old reserve wing for Kroppskultur. Previous PA 160 was an unevidenced age-inflation artifact (+68 points).",
    remainingUncertainty: "Medium. Normalized PA 128 preserves +36 point developmental ceiling.",
  },
  {
    playerId: "se_player_arwid_krontorp_c6d8c3de",
    name: "Arwid Krontorp",
    clubId: "swe2-guif",
    clubName: "Eskilstuna Guif IF",
    competitionId: "swe-2",
    position: "H6",
    age: 19,
    currentCA: 105,
    proposedCA: 105,
    diffCA: 0,
    currentPA: 137,
    proposedPA: 132,
    diffPA: -5,
    confidence: "MEDIUM",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "19-year-old right wing for Eskilstuna Guif. Active in second-tier rotation; realistic developmental runway.",
    remainingUncertainty: "Medium. Healthy +27 growth ceiling.",
  },

  // 5. DIVISION 1 STANDOUTS, STARTERS & RESERVES
  {
    playerId: "player_markus_stegefelt_8aedec38",
    name: "Markus Stegefelt",
    clubId: "se_club_rp_if_linkoping",
    clubName: "RP IF Linköping",
    competitionId: "se_division1_norra",
    position: "V9",
    age: 32,
    currentCA: 146,
    proposedCA: 142,
    diffCA: -4,
    currentPA: 146,
    proposedPA: 142,
    diffPA: -4,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Former Bundesliga (Balingen) and HBL (Skövde) starting back playing for hometown Linköping. Re-centered to reflect veteran status while remaining clear #1 in Div 1.",
    remainingUncertainty: "Low. Proven international pedigree; highest-rated third-tier player in Sweden.",
  },
  {
    playerId: "se_player_theodor_kapnias_olsson_60beed3c",
    name: "Theodor Kapnias Olsson",
    clubId: "se_club_karra_hf",
    clubName: "Kärra HF",
    competitionId: "se_division1_sodra",
    position: "V9",
    age: 21,
    currentCA: 119,
    proposedCA: 118,
    diffCA: -1,
    currentPA: 137,
    proposedPA: 132,
    diffPA: -5,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Kärra HF left back with senior experience at Redbergslids IK. Direct evidence that elite Division 1 players overlap middle Allsvenskan.",
    remainingUncertainty: "Low. Established Allsvenskan-caliber starter in Division 1.",
  },
  {
    playerId: "se_player_adam_fule_5020dcbf",
    name: "Adam Füle",
    clubId: "se_club_hp_warta",
    clubName: "HP Warta",
    competitionId: "se_division1_sodra",
    position: "M9",
    age: 20,
    currentCA: 106,
    proposedCA: 108,
    diffCA: 2,
    currentPA: 149,
    proposedPA: 130,
    diffPA: -19,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "HP Warta primary playmaker with Kungälv Allsvenskan background. Adjusted CA 108 benchmarks starting Div 1 quality; deflated unevidenced PA 149 to realistic 130.",
    remainingUncertainty: "Low. Well-documented third-tier playmaker standard.",
  },
  {
    playerId: "player_viggo_moller_holmen_9c5affc4",
    name: "Viggo Möller Holmén",
    clubId: "se_club_hk_s_hof",
    clubName: "HK S-hof",
    competitionId: "se_division1_sodra",
    position: "H9",
    age: 18,
    currentCA: 102,
    proposedCA: 104,
    diffCA: 2,
    currentPA: 154,
    proposedPA: 152,
    diffPA: -2,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Sävehof academy standout playing senior minutes for reserve HK S-hof. Verified Swedish youth national team right back.",
    remainingUncertainty: "Medium. High ceiling (+48 points) preserved, backed by national team delegation.",
  },
  {
    playerId: "player_oskar_alf_dahlin_29d39f91",
    name: "Oskar Alf Dahlin",
    clubId: "se_club_hp_alingsas",
    clubName: "HP Alingsås",
    competitionId: "se_division1_sodra",
    position: "MV",
    age: 20,
    currentCA: 69,
    proposedCA: 96,
    diffCA: 27,
    currentPA: 93,
    proposedPA: 122,
    diffPA: 29,
    confidence: "MEDIUM",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Starting goalkeeper for HP Alingsås in Div 1 Södra (voted best goalkeeper in Herr 1 2025/26). Undervalued at CA 69 by unanchored prior. Calibrated to senior Div 1 starter standard.",
    remainingUncertainty: "Medium. Significant correction justified by verified starting role and awards.",
  },
  {
    playerId: "player_alexander_andersson_1718521d",
    name: "Alexander Andersson",
    clubId: "se_club_vinslovs_hk",
    clubName: "Vinslövs HK",
    competitionId: "se_division1_sodra",
    position: "M9",
    age: 25,
    currentCA: 112,
    proposedCA: 104,
    diffCA: -8,
    currentPA: 114,
    proposedPA: 104,
    diffPA: -10,
    confidence: "HIGH",
    status: "APPLY_CALIBRATION",
    evidenceSupportingChange: "Vinslövs HK central back, age 25. Standard established third-tier rotation player without developmental runway. Normalized from inflated CA 112.",
    remainingUncertainty: "Low. Established career baseline.",
  },
];

console.log(`Audited ${CALIBRATION_DATA.length} calibration sample players.`);

// -------------------------------------------------------------------
// 1. Output PHASE-2B-PROPOSED-RATINGS.csv
// -------------------------------------------------------------------
const propHeader = [
  "playerId",
  "name",
  "clubId",
  "clubName",
  "competitionId",
  "position",
  "age",
  "currentCA",
  "proposedCA",
  "diffCA",
  "currentPA",
  "proposedPA",
  "diffPA",
  "confidence",
  "status",
  "evidenceSupportingChange",
  "remainingUncertainty",
].join(",");

const propRows = CALIBRATION_DATA.map((p) =>
  [
    p.playerId,
    `"${p.name.replace(/"/g, '""')}"`,
    p.clubId,
    `"${p.clubName.replace(/"/g, '""')}"`,
    p.competitionId,
    p.position,
    p.age ?? "",
    p.currentCA,
    p.proposedCA,
    p.diffCA,
    p.currentPA,
    p.proposedPA,
    p.diffPA,
    p.confidence,
    p.status,
    `"${p.evidenceSupportingChange.replace(/"/g, '""')}"`,
    `"${p.remainingUncertainty.replace(/"/g, '""')}"`,
  ].join(",")
);

fs.writeFileSync(path.join(REPORT_DIR, "PHASE-2B-PROPOSED-RATINGS.csv"), [propHeader, ...propRows].join("\n"), "utf8");
console.log("Wrote PHASE-2B-PROPOSED-RATINGS.csv");

// -------------------------------------------------------------------
// 2. Output PHASE-2B-BEFORE-AFTER.csv (Dry-Run Ranking & Comparative Analysis)
// -------------------------------------------------------------------
const beforeRanked = [...CALIBRATION_DATA].sort((a, b) => b.currentCA - a.currentCA);
const afterRanked = [...CALIBRATION_DATA].sort((a, b) => b.proposedCA - a.proposedCA);

const beforeRankMap = new Map(beforeRanked.map((p, idx) => [p.playerId, idx + 1]));
const afterRankMap = new Map(afterRanked.map((p, idx) => [p.playerId, idx + 1]));

const beforeAfterHeader = [
  "playerId",
  "name",
  "clubName",
  "competitionId",
  "position",
  "currentCA",
  "proposedCA",
  "diffCA",
  "beforeRank",
  "afterRank",
  "rankShift",
  "currentPA",
  "proposedPA",
  "diffPA",
  "currentGap",
  "proposedGap",
  "status",
  "rankingRationale",
].join(",");

const beforeAfterRows = CALIBRATION_DATA.map((p) => {
  const bRank = beforeRankMap.get(p.playerId)!;
  const aRank = afterRankMap.get(p.playerId)!;
  const rShift = bRank - aRank; // positive = moved up in rank
  const cGap = p.currentPA - p.currentCA;
  const pGap = p.proposedPA - p.proposedCA;

  let rationale = "Maintained rank; validated by evidence.";
  if (rShift > 0) rationale = `Moved up ${rShift} spots due to confirmed performance superiority.`;
  else if (rShift < 0) rationale = `Moved down ${Math.abs(rShift)} spots due to re-centering to realistic role depth.`;

  return [
    p.playerId,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.clubName.replace(/"/g, '""')}"`,
    p.competitionId,
    p.position,
    p.currentCA,
    p.proposedCA,
    p.diffCA,
    bRank,
    aRank,
    rShift,
    p.currentPA,
    p.proposedPA,
    p.diffPA,
    cGap,
    pGap,
    p.status,
    `"${rationale}"`,
  ].join(",");
});

fs.writeFileSync(path.join(REPORT_DIR, "PHASE-2B-BEFORE-AFTER.csv"), [beforeAfterHeader, ...beforeAfterRows].join("\n"), "utf8");
console.log("Wrote PHASE-2B-BEFORE-AFTER.csv");

// -------------------------------------------------------------------
// 3. Dry-Run Verification Invariants
// -------------------------------------------------------------------
console.log("\n--- Dry-Run Verification ---");
let invariantErrors = 0;
for (const p of CALIBRATION_DATA) {
  if (p.proposedCA > p.proposedPA) {
    console.error(`INVARIANT VIOLATION: Player ${p.name} (${p.playerId}) has proposedCA (${p.proposedCA}) > proposedPA (${p.proposedPA})!`);
    invariantErrors++;
  }
}
if (invariantErrors === 0) {
  console.log("Dry-Run Invariant PASSED: 0 players have proposedCA > proposedPA.");
}

// -------------------------------------------------------------------
// 4. Controlled Implementation (Apply to Sample Only in Research Worktree)
// -------------------------------------------------------------------
console.log("\n--- Applying Controlled Implementation to Sample ---");
const toApply = CALIBRATION_DATA.filter((p) => p.status === "APPLY_CALIBRATION");
console.log(`Applying updates for ${toApply.length} players with well-supported calibrations...`);

const catalog = buildCatalog();
const byClub = new Map<string, ProposedRatingRow[]>();
for (const p of toApply) {
  if (!byClub.has(p.clubId)) byClub.set(p.clubId, []);
  byClub.get(p.clubId)!.push(p);
}

let updatedCount = 0;
for (const [clubId, playerRows] of byClub) {
  const currentLocked = loadRatingDatabase(clubId);
  const squad = loadRealWorldClubSquad(clubId);
  if (!squad) {
    console.error(`Could not load real world club squad for club ${clubId}`);
    continue;
  }
  const squadPlayerMap = new Map(squad.players.map((p) => [p.playerId, p]));

  for (const row of playerRows) {
    const existing = currentLocked[row.playerId];
    const squadPlayer = squadPlayerMap.get(row.playerId);

    const oldCA = existing ? existing.ca.value : row.currentCA;
    const oldPA = existing ? (existing.pa?.value ?? existing.ca.value) : row.currentPA;
    const oldNote = existing?.lockedNote || "None";

    const note = `HM-PHASE-2B (2026-11-05): calibrated CA ${oldCA}->${row.proposedCA}, PA ${oldPA}->${row.proposedPA}. Previous note: ${oldNote}. Reason: ${row.evidenceSupportingChange}`;

    // Build PlayerRatingProfile for deterministic generation of attributes
    let profile: any;
    if (squadPlayer) {
      const { profile: proposed, matchedCalibration } = proposePlayerRating(squadPlayer);
      const { profile: estimated } = applyCAEstimation(proposed, squadPlayer.fullName, matchedCalibration);
      const { profile: final } = applyGamePrior(estimated, clubId, GAME_PRIOR_MODEL_VERSION, squadPlayer.worldPoolMetadata);
      profile = final;
    } else {
      profile = {
        playerId: row.playerId,
        position: row.position,
        attackRoleProficiencies: existing?.attackRoleProficiencies || [],
        defenceRoleProficiencies: existing?.defenceRoleProficiencies || [],
        outcourtAttributes: existing?.branch.branch === "OUTCOURT" ? existing.branch.attributes : {},
        goalkeeperAttributes: existing?.branch.branch === "GOALKEEPER" ? existing.branch.attributes : {},
      };
    }

    // Force CA & PA to calibrated values
    profile.ca = {
      value: row.proposedCA,
      confidence: row.confidence,
      plausibleRange: { min: row.proposedCA, max: row.proposedCA },
      source: "EDITOR_OVERRIDE" as const,
    };
    profile.pa = {
      value: row.proposedPA,
      confidence: row.confidence,
      plausibleRange: { min: row.proposedPA, max: row.proposedPA },
      source: "EDITOR_OVERRIDE" as const,
    };

    const generation = generatePlayerRatingProfile(profile);
    const branch = generation.status === "OK" ? generation.profile.branch : (existing?.branch as any);

    const updatedRecord: LockedPlayerRating = {
      playerId: row.playerId,
      clubId,
      position: (row.position === "MV" ? "GK" : row.position) as any,
      ca: {
        value: row.proposedCA,
        confidence: row.confidence as any,
        plausibleRange: { min: row.proposedCA, max: row.proposedCA },
        source: "EDITOR_OVERRIDE",
      },
      pa: {
        value: row.proposedPA,
        confidence: row.confidence as any,
        plausibleRange: { min: row.proposedPA, max: row.proposedPA },
        source: "EDITOR_OVERRIDE",
      },
      branch,
      attackRoleProficiencies: profile.attackRoleProficiencies || [],
      defenceRoleProficiencies: profile.defenceRoleProficiencies || [],
      caEstimationModelVersion: existing?.caEstimationModelVersion || null,
      attributeGenerationModelVersion: GENERATION_MODEL_VERSION,
      lockedAt: new Date().toISOString(),
      lockedNote: note,
    };

    const res = lockPlayerRating(clubId, updatedRecord);
    if (res.ok) {
      setRatingOverride({
        clubId,
        playerId: row.playerId,
        position: (row.position === "MV" ? "GK" : row.position) as any,
        ca: row.proposedCA,
        pa: row.proposedPA,
      });
      setReviewStatus(clubId, row.playerId, "LOCKED", `HM-PHASE-2B: calibrated CA ${oldCA}->${row.proposedCA}, PA ${oldPA}->${row.proposedPA}. ${row.evidenceSupportingChange}`);
      console.log(`  -> Calibrated [${clubId}] ${row.name} (${row.playerId}): CA ${oldCA}->${row.proposedCA}, PA ${oldPA}->${row.proposedPA}`);
      updatedCount++;
    } else {
      console.error(`Failed to lock rating for ${row.name}: ${res.errors.join(", ")}`);
    }
  }
}

console.log(`Successfully applied calibrations for ${updatedCount} players.`);
