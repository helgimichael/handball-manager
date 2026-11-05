import fs from "node:fs";
import path from "node:path";

const REPORT_DIR = "C:/DEV/QA/reports/HM-CA-PA-CALIBRATION-2026-27";
const currentRatingsCsv = fs.readFileSync(path.join(REPORT_DIR, "CURRENT-RATINGS.csv"), "utf8");

const lines = currentRatingsCsv.split("\n");
const header = lines[0].split(",");
const players = new Map<string, any>();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  // Parse CSV line handling quotes
  const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
  // Simpler regex split for comma outside quotes
  const tokens: string[] = [];
  let inQuotes = false;
  let currentToken = "";
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      tokens.push(currentToken);
      currentToken = "";
    } else {
      currentToken += ch;
    }
  }
  tokens.push(currentToken);

  const playerId = tokens[0];
  players.set(playerId, {
    playerId: tokens[0],
    name: tokens[1]?.replace(/^"|"$/g, ""),
    clubId: tokens[4],
    clubName: tokens[5]?.replace(/^"|"$/g, ""),
    competitionId: tokens[6],
    primaryPosition: tokens[7],
    age: tokens[12] ? Number(tokens[12]) : null,
    runtimeCA: Number(tokens[21]),
    runtimePA: Number(tokens[22]),
    caSource: tokens[23],
    confidence: tokens[24],
    status: tokens[25],
    lockedNote: tokens[27]?.replace(/^"|"$/g, ""),
  });
}

console.log(`Loaded ${players.size} players from CURRENT-RATINGS.csv`);

// Define 30 representative calibration sample players across tiers, roles, and positions
const sampleSpecs = [
  // 1. INTERNATIONAL TIER
  {
    id: "player_intl_sander_sagosen_c782fa51",
    role: "World Class Playmaker",
    proposedCARange: "176-182",
    proposedPARange: "178-182",
    confidence: "HIGH",
    rationale: "Champions League elite performer, primary game controller for Aalborg & Norway.",
    sources: "EHF Champions League statistics, Norwegian national team official match reports",
    uncertainty: "Minimal. Peak prime performance well documented across multiple seasons.",
  },
  {
    id: "player_intl_lasse_ludwig_180f40b8",
    role: "Bundesliga Starting Goalkeeper",
    proposedCARange: "148-154",
    proposedPARange: "162-170",
    confidence: "HIGH",
    rationale: "Füchse Berlin goalkeeper with consistent Bundesliga shot-stopping metrics.",
    sources: "HBL Bundesliga official statistics, German youth international records",
    uncertainty: "Low. Young GK developmental curve still allows upper-tier upside.",
  },
  {
    id: "player_intl_mirko_alilovic_a5ed9b83",
    role: "International Veteran Goalkeeper",
    proposedCARange: "142-146",
    proposedPARange: "142-146",
    confidence: "HIGH",
    rationale: "40-year-old veteran with over a decade of EHF CL pedigree; declining athletic reaction compensated by elite positioning.",
    sources: "EHF historical records, Polish Superliga match logs",
    uncertainty: "Low. Natural age decline curve, zero developmental runway remaining.",
  },
  {
    id: "player_intl_emil_hovgaard_pedersen_a169f355",
    role: "Danish Academy Youth Goalkeeper",
    proposedCARange: "102-108",
    proposedPARange: "135-150",
    confidence: "MEDIUM",
    rationale: "Bjerringbro-Silkeborg academy prospect. Currently overrated at PA 158 without senior minutes.",
    sources: "Danish youth tournament records, BSH squad profile",
    uncertainty: "High. Limited senior exposure; developmental upside dependent on transition to senior minutes.",
  },

  // 2. HANDBOLLSLIGAN ELITE & STARS
  {
    id: "se_player_august_wiger_94e4bcd0",
    role: "Elite HBL Playmaker / Club Star",
    proposedCARange: "150-156",
    proposedPARange: "152-156",
    confidence: "HIGH",
    rationale: "Alingsås offensive engine. Proven top Danish league and Handbollsligan game controller.",
    sources: "Handbollsligan official match data, Danish league historical records, expert anchor review",
    uncertainty: "Low. Mature, consistent playmaker operating at the peak of the Swedish league.",
  },
  {
    id: "se_player_niklas_kraft_e8842f13",
    role: "Elite HBL Goalkeeper / Club Star",
    proposedCARange: "148-154",
    proposedPARange: "148-154",
    confidence: "HIGH",
    rationale: "SM champion with Ystad, proven 3 seasons in Denmark. Elite shot-stopping volume.",
    sources: "Handbollsligan MEP & save data, Danish league stats, expert anchor review",
    uncertainty: "Low. Established veteran goalkeeper with extensive top-flight sample size.",
  },
  {
    id: "player_andreas_nilsson_e7db3e42",
    role: "World-Class Offensive Pivot / Veteran",
    proposedCARange: "154-162",
    proposedPARange: "154-162",
    confidence: "HIGH",
    rationale: "Former world elite pivot (Champions League winner, Veszprém legend) now leading Önnered. Elite catch & finish, reduced defensive mobility.",
    sources: "EHF Champions League records, Swedish national team, Handbollsligan 2026/27 performance",
    uncertainty: "Low. Established offensive specialist profile; age 36 ceiling.",
  },
  {
    id: "se_player_benjamin_helander_b5cece84",
    role: "Elite HBL Left Wing / Club Star",
    proposedCARange: "140-146",
    proposedPARange: "140-146",
    confidence: "HIGH",
    rationale: "Finnish international, Bundesliga experience with Rhein-Neckar Löwen. Reliable top finisher.",
    sources: "Bundesliga statistics, Finland national team match logs, HBL scoring charts",
    uncertainty: "Low. Established international wing at physical prime.",
  },
  {
    id: "se_player_arvid_boquist_39bb770d",
    role: "HBL Defender of the Year / Specialist Back",
    proposedCARange: "144-150",
    proposedPARange: "152-158",
    confidence: "HIGH",
    rationale: "Handbollsligan All-Star Defender of the Year 2025/26. Dominant central defensive block.",
    sources: "Handbollsligan official All-Star awards, match logs, expert anchor review",
    uncertainty: "Medium. Re-injury history creates durability uncertainty, but current defensive ability is proven.",
  },
  {
    id: "se_player_anders_wik_rydberg_795e9eac",
    role: "HBL Pure Defensive Specialist",
    proposedCARange: "132-138",
    proposedPARange: "132-138",
    confidence: "HIGH",
    rationale: "Hammarby central defensive anchor. Exceptional defensive positioning, zero offensive usage.",
    sources: "Hammarby match tactical logs, 6-0 defensive phase analysis",
    uncertainty: "Low. Pure role specialist evaluated on defense without penalty for lack of attack usage.",
  },

  // 3. HANDBOLLSLIGAN STARTERS & ROTATION
  {
    id: "se_player_alexander_regen_705fa7a6",
    role: "Solid HBL Starting Pivot / Captain",
    proposedCARange: "134-140",
    proposedPARange: "134-140",
    confidence: "HIGH",
    rationale: "Alingsås captain. Two-way line player providing solid 6-0 central defense and reliable 6m scoring.",
    sources: "Alingsås match sheets, captaincy records, youth international caps",
    uncertainty: "Low. High consistency starter in mid-to-upper Handbollsligan.",
  },
  {
    id: "se_player_carl_ryden_d5428e1f",
    role: "Cross-League Transition Back (Allsvenskan Scorer -> HBL)",
    proposedCARange: "130-136",
    proposedPARange: "145-152",
    confidence: "HIGH",
    rationale: "146 Allsvenskan goals in 2025/26 (8th in scoring) on 3-year Alingsås contract. Natural bridge between tiers.",
    sources: "Allsvenskan 2025/26 scoring registers, Alingsås transfer documentation",
    uncertainty: "Medium. Rate of adaptation from second-tier volume scoring to top-flight defensive blocks.",
  },
  {
    id: "se_player_petter_donaldson_80cffba4",
    role: "Established HBL Scoring Back",
    proposedCARange: "136-142",
    proposedPARange: "142-146",
    confidence: "HIGH",
    rationale: "Alingsås leading scorer 2025/26 with 110 goals. Reliable 9m distance shooter.",
    sources: "Handbollsligan official scoring register, youth national team records",
    uncertainty: "Low. Solid starting shooter with verified production volume.",
  },
  {
    id: "player_liam_hultberg_d2b82295",
    role: "High-Upside HBL Scoring Prodigy",
    proposedCARange: "144-150",
    proposedPARange: "164-172",
    confidence: "HIGH",
    rationale: "Ystads IF standout young scorer. Proven top-flight output combined with legitimate international ceiling.",
    sources: "Handbollsligan match statistics, European club youth tournament reports",
    uncertainty: "Medium. High ceiling verified by production, but developmental consistency required.",
  },
  {
    id: "player_malte_mansson_1d49a03b",
    role: "High-Upside U20 Right Back",
    proposedCARange: "112-118",
    proposedPARange: "150-160",
    confidence: "HIGH",
    rationale: "U20 international transferred from Kroppskultur to HK Malmö. Rare left-handed back prospect.",
    sources: "Swedish youth national team delegations, EHF U20 championship logs, club transfer records",
    uncertainty: "Medium. Clear international pedigree, but transition to senior starting minutes is underway.",
  },
  {
    id: "se_player_edwin_tengros_eec4c59b",
    role: "HBL Youth Wing Prospect",
    proposedCARange: "120-126",
    proposedPARange: "142-150",
    confidence: "HIGH",
    rationale: "Alingsås academy wing selected for U20 European Championship 2026. High technical finishing standard.",
    sources: "EHF U20 squad delegation, Alingsås first-team match logs",
    uncertainty: "Medium. High technical baseline, competing for regular senior minutes.",
  },
  {
    id: "se_player_max_sellstedt_314fc84c",
    role: "HBL Academy Novice / Extreme Outlier",
    proposedCARange: "96-102",
    proposedPARange: "145-155",
    confidence: "MEDIUM",
    rationale: "Born 2009. Best attacking player P16 USM 2026. Currently distorted with extreme PA 170 in database.",
    sources: "USM finals 2026 reports, Alingsås 3-year apprentice contract",
    uncertainty: "High. Exceptional teenage pedigree, but senior translation is 3+ years away.",
  },

  // 4. ALLSVENSKAN STANDOUTS & STARTERS
  {
    id: "se_player_elliot_hovre_bjorck_40a6f29e",
    role: "Allsvenskan Starting Goalkeeper",
    proposedCARange: "118-124",
    proposedPARange: "132-138",
    confidence: "HIGH",
    rationale: "HK Drott starting goalkeeper. Core second-tier performer, consistent 60-minute match volume.",
    sources: "Herrallsvenskan match sheets, save percentages, confirmed non-transfer to Tumba",
    uncertainty: "Low. Established second-tier starter standard.",
  },
  {
    id: "se_player_axel_winstrom_c59447b8",
    role: "Allsvenskan Rotation Goalkeeper",
    proposedCARange: "112-118",
    proposedPARange: "124-130",
    confidence: "HIGH",
    rationale: "Redbergslids IK rotation goalkeeper. Solid backup capability in competitive Allsvenskan environment.",
    sources: "Redbergslids IK match sheets, youth cohort records",
    uncertainty: "Low. Reliable second-tier depth benchmark.",
  },
  {
    id: "se_player_emil_arthursson_e99d2749",
    role: "Allsvenskan Proven Starting Goalkeeper",
    proposedCARange: "124-130",
    proposedPARange: "126-130",
    confidence: "HIGH",
    rationale: "H43 Lund starting GK with Handbollsligan experience at Karlskrona. Top-half second tier standard.",
    sources: "Handbollsligan & Allsvenskan match logs, consolidation audit",
    uncertainty: "Low. Mature, proven goalkeeper between HBL fringe and top Allsvenskan.",
  },
  {
    id: "se_player_hugo_lundberg_eef2c0f4",
    role: "Allsvenskan Young Defensive Specialist",
    proposedCARange: "108-114",
    proposedPARange: "132-140",
    confidence: "HIGH",
    rationale: "IFK Ystad defender with HBL apprentice experience at Ystads IF (~27 match sheets).",
    sources: "Ystads IF HBL match logs, Allsvenskan match data, HM-DATA-1.6 research",
    uncertainty: "Medium. Specialized defensive profile; offensive development limited.",
  },
  {
    id: "se_player_alvin_sundstrom_733a7887",
    role: "Allsvenskan Youth Reserve / Extreme Outlier",
    proposedCARange: "88-94",
    proposedPARange: "120-132",
    confidence: "LOW",
    rationale: "17-year-old backup GK for Kroppskultur. Currently has artificial PA 158 without senior minutes.",
    sources: "Kroppskultur squad roster, regional youth logs",
    uncertainty: "Very High. Limited senior data; PA must be normalized from inflated 158 to realistic academy band.",
  },
  {
    id: "se_player_love_ljungqvist_3f94aca6",
    role: "Allsvenskan Youth Wing / Extreme Outlier",
    proposedCARange: "90-96",
    proposedPARange: "122-134",
    confidence: "LOW",
    rationale: "17-year-old reserve wing for Kroppskultur. Currently distorted with PA 160 in database.",
    sources: "Kroppskultur roster, regional youth series",
    uncertainty: "Very High. Unevidenced teenage reserve needing potential normalization.",
  },

  {
    id: "se_player_arwid_krontorp_c6d8c3de",
    role: "Allsvenskan Young Right Wing",
    proposedCARange: "104-110",
    proposedPARange: "128-136",
    confidence: "MEDIUM",
    rationale: "19-year-old right wing for Eskilstuna Guif. Active in second-tier rotation; realistic developmental runway.",
    sources: "Guif senior match sheets, Swedish youth series data",
    uncertainty: "Medium. Second-tier wing development dependent on shooting conversion against senior goalkeepers.",
  },
  // 5. DIVISION 1 STANDOUTS, STARTERS & RESERVES
  {
    id: "player_markus_stegefelt_8aedec38",
    role: "Division 1 Former Pro Standout",
    proposedCARange: "136-144",
    proposedPARange: "136-144",
    confidence: "HIGH",
    rationale: "Former Bundesliga (Balingen) and HBL (Skövde) starting back playing for hometown Linköping. Far exceeds normal Div 1 baseline.",
    sources: "Bundesliga statistics, Handbollsligan records, Div 1 Norra match logs",
    uncertainty: "Low. High individual ability verified over 10-year professional career.",
  },
  {
    id: "se_player_theodor_kapnias_olsson_60beed3c",
    role: "Division 1 Standout Back",
    proposedCARange: "116-122",
    proposedPARange: "130-136",
    confidence: "HIGH",
    rationale: "Kärra HF left back with Allsvenskan senior experience at Redbergslid. Proven second-tier starter playing in Div 1.",
    sources: "Redbergslids IK Allsvenskan match logs, Kärra HF transfer records",
    uncertainty: "Low. Direct proof that elite Div 1 performers overlap middle Allsvenskan.",
  },
  {
    id: "se_player_adam_fule_5020dcbf",
    role: "Division 1 Solid Starting Playmaker",
    proposedCARange: "106-112",
    proposedPARange: "128-136",
    confidence: "HIGH",
    rationale: "HP Warta primary playmaker with Kungälv Allsvenskan background. Benchmark for solid Division 1 starting quality.",
    sources: "Div 1 Södra match sheets, Kungälv senior logs",
    uncertainty: "Low. Established starting playmaker standard for third tier.",
  },
  {
    id: "player_viggo_moller_holmen_9c5affc4",
    role: "Division 1 Academy Standout / U-National Team",
    proposedCARange: "102-108",
    proposedPARange: "148-156",
    confidence: "HIGH",
    rationale: "Sävehof academy standout playing senior minutes for reserve HK S-hof. Verified Swedish youth national team right back.",
    sources: "Swedish youth national team rosters, Sävehof academy evaluation, Profixio senior match logs",
    uncertainty: "Medium. Clear high ceiling, developing in Division 1 before full HBL promotion.",
  },
  {
    id: "player_oskar_alf_dahlin_29d39f91",
    role: "Division 1 Farm Team Goalkeeper",
    proposedCARange: "94-100",
    proposedPARange: "118-126",
    confidence: "MEDIUM",
    rationale: "HP Alingsås goalkeeper in Div 1 Södra; farm team affiliate of Alingsås HK. Currently generated at CA 69.",
    sources: "HP Alingsås match records, farm-team agreement with Alingsås HK",
    uncertainty: "Medium. Capable third-tier starter, significantly undervalued by automated prior.",
  },
  {
    id: "player_alexander_andersson_1718521d",
    role: "Division 1 Veteran Rotation",
    proposedCARange: "100-106",
    proposedPARange: "100-106",
    confidence: "HIGH",
    rationale: "Vinslövs HK central back, age 25. Standard established third-tier rotation player.",
    sources: "Div 1 Södra match sheets, Vinslöv roster logs",
    uncertainty: "Low. Established career baseline, zero developmental runway remaining.",
  },
];

const sampleHeader = [
  "playerId",
  "name",
  "clubName",
  "competitionId",
  "position",
  "age",
  "currentCA",
  "currentPA",
  "proposedCARange",
  "proposedPARange",
  "confidence",
  "role",
  "performanceRationale",
  "evidenceSources",
  "identifiedUncertainty",
].join(",");

const sampleRows: string[] = [];
for (const s of sampleSpecs) {
  const p = players.get(s.id);
  if (!p) {
    console.warn(`Sample player ${s.id} not found in database!`);
    continue;
  }
  sampleRows.push(
    [
      p.playerId,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.clubName.replace(/"/g, '""')}"`,
      p.competitionId,
      p.primaryPosition,
      p.age,
      p.runtimeCA,
      p.runtimePA,
      `"${s.proposedCARange}"`,
      `"${s.proposedPARange}"`,
      s.confidence,
      `"${s.role}"`,
      `"${s.rationale.replace(/"/g, '""')}"`,
      `"${s.sources.replace(/"/g, '""')}"`,
      `"${s.uncertainty.replace(/"/g, '""')}"`,
    ].join(",")
  );
}

fs.writeFileSync(path.join(REPORT_DIR, "PHASE-2A-CALIBRATION-SAMPLE.csv"), [sampleHeader, ...sampleRows].join("\n"), "utf8");
console.log(`Wrote PHASE-2A-CALIBRATION-SAMPLE.csv (${sampleRows.length} players)`);
