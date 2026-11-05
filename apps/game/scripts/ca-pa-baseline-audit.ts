import fs from "node:fs";
import path from "node:path";
import { buildCatalog, type EditorCatalog, type CatalogClub } from "../lib/editor/catalog";
import { loadRealWorldClubSquad, type RealWorldPlayer } from "../lib/gameWorld/realWorldLoader";
import { loadRatingDatabase, type LockedPlayerRating } from "../lib/editor/ratingDatabaseRepository";
import { snapshotGameplayRatingsForClub } from "../lib/gameWorld/gameplayRatingSnapshot";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";

const REPORT_DIR = "C:/DEV/QA/reports/HM-CA-PA-CALIBRATION-2026-27";
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

interface PlayerAuditRow {
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  primaryPosition: string;
  secondaryPositions: string;
  shirtNumber: number | string;
  dateOfBirth: string;
  birthYear: number | string;
  age: number | string;
  ageGroup: string;
  nationality: string;
  heightCm: number | string;
  handedness: string;
  onActiveRoster: boolean;
  isLocked: boolean;
  storedCA: number | string;
  storedPA: number | string;
  runtimeCA: number;
  runtimePA: number;
  caSource: string;
  confidence: string;
  status: "RESEARCHED" | "PROVISIONAL";
  lockedDate: string;
  lockedNote: string;
  missingEvidence: string;
  outlierFlags: string;
}

function getAgeGroup(age: number | null): string {
  if (age === null) return "UNKNOWN";
  if (age < 20) return "U20";
  if (age <= 23) return "20-23";
  if (age <= 27) return "24-27";
  if (age <= 31) return "28-31";
  return "32+";
}

function computeStats(values: number[]) {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, min: 0, max: 0, p10: 0, p25: 0, p75: 0, p90: 0, stdDev: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const min = sorted[0];
  const max = sorted[n - 1];
  const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const p10 = sorted[Math.floor(n * 0.1)];
  const p25 = sorted[Math.floor(n * 0.25)];
  const p75 = sorted[Math.floor(n * 0.75)];
  const p90 = sorted[Math.floor(n * 0.9)];
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    count: n,
    mean: Number(mean.toFixed(1)),
    median: Number(median.toFixed(1)),
    min,
    max,
    p10,
    p25,
    p75,
    p90,
    stdDev: Number(stdDev.toFixed(1)),
  };
}

export function runBaselineAudit() {
  console.log("=================================================================");
  console.log("HANDBALL MANAGER — CA/PA BASELINE AUDIT & ANALYSIS");
  console.log("=================================================================");

  const catalog = buildCatalog();
  console.log(`Discovered ${catalog.clubs.length} clubs in catalog.`);

  const allPlayers: PlayerAuditRow[] = [];

  for (const club of catalog.clubs) {
    const clubDir = club.clubDir;
    const playersFiles = fs.readdirSync(clubDir).filter((f) => f.startsWith("players-") && f.endsWith(".json"));
    const rosterFiles = fs.readdirSync(clubDir).filter((f) => f.startsWith("roster-") && f.endsWith(".json"));

    let clubPlayersRaw: any[] = [];
    for (const pf of playersFiles) {
      clubPlayersRaw = clubPlayersRaw.concat(JSON.parse(fs.readFileSync(path.join(clubDir, pf), "utf8")));
    }

    let clubRosterRaw: any[] = [];
    for (const rf of rosterFiles) {
      clubRosterRaw = clubRosterRaw.concat(JSON.parse(fs.readFileSync(path.join(clubDir, rf), "utf8")));
    }

    const rosterMap = new Map<string, any>(clubRosterRaw.map((r) => [r.playerId, r]));
    const lockedRatings = loadRatingDatabase(club.clubId);
    const runtimeRatings = snapshotGameplayRatingsForClub(club.clubId);
    const runtimeMap = new Map(runtimeRatings.players.map((r) => [r.playerId, r]));

    for (const p of clubPlayersRaw) {
      const rosterEntry = rosterMap.get(p.playerId);
      const locked = lockedRatings[p.playerId];
      const runtime = runtimeMap.get(p.playerId);

      const primaryPos = rosterEntry?.primaryPosition || p.primaryPosition || "M9";
      const secondaryPos = Array.isArray(rosterEntry?.secondaryPositions)
        ? rosterEntry.secondaryPositions.join(";")
        : Array.isArray(p.secondaryPositions)
        ? p.secondaryPositions.join(";")
        : "";
      const shirtNum = rosterEntry?.shirtNumber ?? p.shirtNumber ?? "";

      const dob = p.dateOfBirth || "";
      const birthYr = p.birthYear ?? (dob ? Number(dob.slice(0, 4)) : "");
      const ageNum = playerAgeAtDate(p.dateOfBirth, p.birthYear, "2026-09-01");
      const ageStr = ageNum !== null ? ageNum : "";
      const ageGroup = getAgeGroup(ageNum);

      const nat = Array.isArray(p.nationalities) && p.nationalities.length > 0 ? p.nationalities[0] : (p.nationality || "SWE");
      const height = p.heightCm || "";
      const hands = p.handedness || "";

      const isLocked = !!locked;
      const storedCA = locked ? locked.ca.value : "";
      const storedPA = locked ? (locked.pa?.value ?? locked.ca.value) : "";

      // Runtime values
      let runtimeCA = runtime ? runtime.ca : (locked ? locked.ca.value : 122);
      let runtimePA = runtime ? runtime.pa : (locked ? (locked.pa?.value ?? locked.ca.value) : 122);
      let caSource = locked ? locked.ca.source : (runtime ? runtime.caSource : "GENERATED_GAME_PRIOR");
      let confidence = locked ? locked.ca.confidence : (caSource === "CALIBRATED" ? "MEDIUM" : "UNASSESSED");

      // Check research provenance note
      const lockedNote = locked?.lockedNote || "";
      const isResearched =
        isLocked &&
        (lockedNote.includes("HM_Player_Rating_Research_v2.13") ||
          lockedNote.includes("ALLSV_rating_import_candidates_v0.13") ||
          lockedNote.includes("DIV1N_rating_import_candidates_v0.6") ||
          lockedNote.includes("DIV1S_rating_import_candidates_v0.5") ||
          lockedNote.includes("WORLD_POOL_FINAL_RATING_RESEARCH_v1") ||
          lockedNote.includes("HM-DATA-1.3") ||
          lockedNote.includes("HM-DATA-1.5") ||
          lockedNote.includes("HM-DATA-1.6") ||
          lockedNote.includes("HM-DATA-1.7") ||
          lockedNote.includes("Bulk"));

      const status: "RESEARCHED" | "PROVISIONAL" = isResearched ? "RESEARCHED" : "PROVISIONAL";

      // Missing evidence checks
      const missingList: string[] = [];
      if (!p.dateOfBirth) missingList.push("NO_EXACT_DOB");
      if (!p.birthYear && !p.dateOfBirth) missingList.push("NO_BIRTH_YEAR");
      if (!p.heightCm) missingList.push("NO_HEIGHT");
      if (!p.handedness) missingList.push("NO_HANDEDNESS");
      if (!p.nationalities || p.nationalities.length === 0) missingList.push("NO_NATIONALITY");
      if (!isResearched) missingList.push("NO_RESEARCH_PROVENANCE");

      // Outlier checks
      const outlierList: string[] = [];
      const caVal = runtimeCA;
      const paVal = runtimePA;

      if (caVal > paVal) outlierList.push("CA_GREATER_THAN_PA");
      if (paVal - caVal >= 40) outlierList.push("EXTREME_PA_GAP_40_PLUS");
      else if (paVal - caVal >= 30) outlierList.push("HIGH_PA_GAP_30_PLUS");

      if (ageNum !== null && ageNum <= 20 && paVal === caVal) {
        outlierList.push("YOUTH_ZERO_DEVELOPMENT_ROOM");
      }
      if (ageNum !== null && ageNum >= 32 && paVal - caVal >= 15) {
        outlierList.push("VETERAN_UNREALISTIC_PA_EXPANSION");
      }

      // League cross-tier anomalies
      if (club.competitionId === "se_handbollsligan_herr" && caVal < 85) {
        outlierList.push("HBL_SUB_85_SEVERE_UNDERVALUE");
      }
      if (club.competitionId.includes("division1") && caVal > 130) {
        outlierList.push("DIV1_SUPER_STAR_130_PLUS");
      }

      allPlayers.push({
        playerId: p.playerId,
        name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
        firstName: p.firstName || "",
        lastName: p.lastName || "",
        clubId: club.clubId,
        clubName: club.clubName,
        competitionId: club.competitionId,
        primaryPosition: primaryPos,
        secondaryPositions: secondaryPos,
        shirtNumber: shirtNum,
        dateOfBirth: dob,
        birthYear: birthYr,
        age: ageStr,
        ageGroup,
        nationality: nat,
        heightCm: height,
        handedness: hands,
        onActiveRoster: !!rosterEntry,
        isLocked,
        storedCA,
        storedPA,
        runtimeCA,
        runtimePA,
        caSource,
        confidence,
        status,
        lockedDate: locked?.lockedAt || "",
        lockedNote,
        missingEvidence: missingList.join(";"),
        outlierFlags: outlierList.join(";"),
      });
    }
  }

  console.log(`Total canonical real-world players audited: ${allPlayers.length}`);

  // -------------------------------------------------------------------
  // 1. Write CURRENT-RATINGS.csv
  // -------------------------------------------------------------------
  const ratingsHeader = [
    "playerId",
    "name",
    "firstName",
    "lastName",
    "clubId",
    "clubName",
    "competitionId",
    "primaryPosition",
    "secondaryPositions",
    "shirtNumber",
    "dateOfBirth",
    "birthYear",
    "age",
    "ageGroup",
    "nationality",
    "heightCm",
    "handedness",
    "onActiveRoster",
    "isLocked",
    "storedCA",
    "storedPA",
    "runtimeCA",
    "runtimePA",
    "caSource",
    "confidence",
    "status",
    "lockedDate",
    "lockedNote",
    "missingEvidence",
    "outlierFlags",
  ].join(",");

  const ratingsRows = allPlayers.map((p) =>
    [
      p.playerId,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.firstName.replace(/"/g, '""')}"`,
      `"${p.lastName.replace(/"/g, '""')}"`,
      p.clubId,
      `"${p.clubName.replace(/"/g, '""')}"`,
      p.competitionId,
      p.primaryPosition,
      `"${p.secondaryPositions}"`,
      p.shirtNumber,
      p.dateOfBirth,
      p.birthYear,
      p.age,
      p.ageGroup,
      p.nationality,
      p.heightCm,
      p.handedness,
      p.onActiveRoster,
      p.isLocked,
      p.storedCA,
      p.storedPA,
      p.runtimeCA,
      p.runtimePA,
      p.caSource,
      p.confidence,
      p.status,
      p.lockedDate,
      `"${p.lockedNote.replace(/"/g, '""')}"`,
      `"${p.missingEvidence}"`,
      `"${p.outlierFlags}"`,
    ].join(",")
  );

  fs.writeFileSync(path.join(REPORT_DIR, "CURRENT-RATINGS.csv"), [ratingsHeader, ...ratingsRows].join("\n"), "utf8");
  console.log("Wrote CURRENT-RATINGS.csv");

  // -------------------------------------------------------------------
  // 2. Compute Distributions
  // -------------------------------------------------------------------
  type Stratifier = (p: PlayerAuditRow) => string;

  const distributionHeaders = [
    "Dimension",
    "Category",
    "Count",
    "Mean",
    "Median",
    "Min",
    "Max",
    "P10",
    "P25",
    "P75",
    "P90",
    "StdDev",
  ].join(",");

  function generateDistRows(dimensionName: string, stratifier: Stratifier, isPA: boolean = false): string[] {
    const groups = new Map<string, number[]>();
    for (const p of allPlayers) {
      const cat = stratifier(p);
      const val = isPA ? p.runtimePA : p.runtimeCA;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(val);
    }

    const rows: string[] = [];
    for (const [cat, vals] of groups) {
      const s = computeStats(vals);
      rows.push(
        [
          dimensionName,
          `"${cat.replace(/"/g, '""')}"`,
          s.count,
          s.mean,
          s.median,
          s.min,
          s.max,
          s.p10,
          s.p25,
          s.p75,
          s.p90,
          s.stdDev,
        ].join(",")
      );
    }
    return rows;
  }

  // Dimensions
  const leagueStrat: Stratifier = (p) => p.competitionId;
  const clubStrat: Stratifier = (p) => `${p.clubName} (${p.competitionId})`;
  const posStrat: Stratifier = (p) => p.primaryPosition;
  const ageStrat: Stratifier = (p) => p.ageGroup;
  const natStrat: Stratifier = (p) => (p.nationality === "SWE" ? "SWE" : "INTERNATIONAL");
  const confStrat: Stratifier = (p) => p.confidence;
  const statusStrat: Stratifier = (p) => p.status;

  const caDistRows = [
    ...generateDistRows("League", leagueStrat, false),
    ...generateDistRows("Position", posStrat, false),
    ...generateDistRows("AgeGroup", ageStrat, false),
    ...generateDistRows("Nationality", natStrat, false),
    ...generateDistRows("Confidence", confStrat, false),
    ...generateDistRows("Status", statusStrat, false),
    ...generateDistRows("Club", clubStrat, false),
  ];

  fs.writeFileSync(path.join(REPORT_DIR, "CA-DISTRIBUTIONS.csv"), [distributionHeaders, ...caDistRows].join("\n"), "utf8");
  console.log("Wrote CA-DISTRIBUTIONS.csv");

  const paDistRows = [
    ...generateDistRows("League", leagueStrat, true),
    ...generateDistRows("Position", posStrat, true),
    ...generateDistRows("AgeGroup", ageStrat, true),
    ...generateDistRows("Nationality", natStrat, true),
    ...generateDistRows("Confidence", confStrat, true),
    ...generateDistRows("Status", statusStrat, true),
    ...generateDistRows("Club", clubStrat, true),
  ];

  fs.writeFileSync(path.join(REPORT_DIR, "PA-DISTRIBUTIONS.csv"), [distributionHeaders, ...paDistRows].join("\n"), "utf8");
  console.log("Wrote PA-DISTRIBUTIONS.csv");

  // -------------------------------------------------------------------
  // 3. RATING-OUTLIERS.csv
  // -------------------------------------------------------------------
  const outliers = allPlayers.filter((p) => p.outlierFlags.length > 0);
  const outlierHeader = [
    "playerId",
    "name",
    "clubName",
    "competitionId",
    "position",
    "age",
    "runtimeCA",
    "runtimePA",
    "gap",
    "status",
    "caSource",
    "outlierFlags",
  ].join(",");

  const outlierRows = outliers.map((p) =>
    [
      p.playerId,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.clubName.replace(/"/g, '""')}"`,
      p.competitionId,
      p.primaryPosition,
      p.age,
      p.runtimeCA,
      p.runtimePA,
      p.runtimePA - p.runtimeCA,
      p.status,
      p.caSource,
      `"${p.outlierFlags}"`,
    ].join(",")
  );

  fs.writeFileSync(path.join(REPORT_DIR, "RATING-OUTLIERS.csv"), [outlierHeader, ...outlierRows].join("\n"), "utf8");
  console.log(`Wrote RATING-OUTLIERS.csv (${outliers.length} flagged outliers)`);

  // -------------------------------------------------------------------
  // 4. RESEARCH-COVERAGE.csv
  // -------------------------------------------------------------------
  const covHeader = [
    "Competition",
    "TotalPlayers",
    "ResearchedCount",
    "ResearchedPct",
    "ProvisionalCount",
    "ProvisionalPct",
    "LockedCount",
    "LockedPct",
    "MissingDOBCount",
    "MissingHeightCount",
    "MissingHandednessCount",
  ].join(",");

  const compGroups = new Map<string, PlayerAuditRow[]>();
  for (const p of allPlayers) {
    if (!compGroups.has(p.competitionId)) compGroups.set(p.competitionId, []);
    compGroups.get(p.competitionId)!.push(p);
  }

  const covRows: string[] = [];
  for (const [comp, players] of compGroups) {
    const total = players.length;
    const researched = players.filter((p) => p.status === "RESEARCHED").length;
    const provisional = total - researched;
    const locked = players.filter((p) => p.isLocked).length;
    const missingDob = players.filter((p) => !p.dateOfBirth).length;
    const missingHeight = players.filter((p) => !p.heightCm).length;
    const missingHand = players.filter((p) => !p.handedness).length;

    covRows.push(
      [
        comp,
        total,
        researched,
        Number(((researched / total) * 100).toFixed(1)),
        provisional,
        Number(((provisional / total) * 100).toFixed(1)),
        locked,
        Number(((locked / total) * 100).toFixed(1)),
        missingDob,
        missingHeight,
        missingHand,
      ].join(",")
    );
  }

  // Summary row
  const totalAll = allPlayers.length;
  const resAll = allPlayers.filter((p) => p.status === "RESEARCHED").length;
  const provAll = totalAll - resAll;
  const lockAll = allPlayers.filter((p) => p.isLocked).length;
  covRows.push(
    [
      "TOTAL_DATABASE",
      totalAll,
      resAll,
      Number(((resAll / totalAll) * 100).toFixed(1)),
      provAll,
      Number(((provAll / totalAll) * 100).toFixed(1)),
      lockAll,
      Number(((lockAll / totalAll) * 100).toFixed(1)),
      allPlayers.filter((p) => !p.dateOfBirth).length,
      allPlayers.filter((p) => !p.heightCm).length,
      allPlayers.filter((p) => !p.handedness).length,
    ].join(",")
  );

  fs.writeFileSync(path.join(REPORT_DIR, "RESEARCH-COVERAGE.csv"), [covHeader, ...covRows].join("\n"), "utf8");
  console.log("Wrote RESEARCH-COVERAGE.csv");

  // -------------------------------------------------------------------
  // 5. CALIBRATION-ANCHORS.csv
  // -------------------------------------------------------------------
  // Select balanced anchors across positions, leagues, and tiers
  const anchorCandidates = [
    // World Class International Pool Anchor
    { id: "player_intl_sander_sagosen_c782fa51", name: "Sander Sagosen", role: "World Class Playmaker / International Elite", tier: "WORLD_CLASS_ELITE", targetBand: "175-185", rationale: "Champions League superstar, Norway international leader, benchmark for elite international CA." },
    // Elite Handbollsligan Stars
    { id: "se_player_august_wiger_94e4bcd0", name: "August Wiger", role: "Elite Playmaker / Club Star", tier: "HBL_ELITE", targetBand: "148-158", rationale: "Proven top Danish league & Handbollsligan playmaker engine. Controls game tempo." },
    { id: "se_player_niklas_kraft_e8842f13", name: "Niklas Kraft", role: "Elite Goalkeeper / Club Star", tier: "HBL_ELITE", targetBand: "146-155", rationale: "SM champion with Ystad, 300+ top matches, 3 Danish seasons. Benchmark top GK." },
    { id: "se_player_benjamin_helander_b5cece84", name: "Benjamin Helander", role: "Elite Left Wing / Finisher", tier: "HBL_ELITE", targetBand: "140-150", rationale: "Finnish international, Bundesliga experience with Rhein-Neckar Löwen, German Cup winner." },
    { id: "se_player_arvid_boquist_39bb770d", name: "Arvid Boquist", role: "Elite Defensive Back / Specialist", tier: "HBL_STAR", targetBand: "145-155", rationale: "Handbollsligan All-Star Defender of the Year 2025/26. Defensive benchmark." },
    { id: "se_player_alexander_regen_705fa7a6", name: "Alexander Regen", role: "Solid Line Player / Captain", tier: "HBL_SOLID_STARTER", targetBand: "132-142", rationale: "Established senior captain, two-way pivot, reliable starter." },
    { id: "player_liam_hultberg_d2b82295", name: "Liam Hultberg", role: "High-Upside Scoring Back", tier: "HBL_HIGH_UPSIDE", targetBand: "145-155 (PA 165-175)", rationale: "Proven Swedish top-flight scoring talent with high international upside." },
    // Young Upside Prospects
    { id: "player_malte_mansson_1d49a03b", name: "Malte Månsson", role: "High-Upside Right Back (U20)", tier: "HBL_DEVELOPING_PROSPECT", targetBand: "110-120 (PA 155-165)", rationale: "U20 international right back. High potential upside with developmental runway." },
    { id: "player_viggo_moller_holmen_9c5affc4", name: "Viggo Möller Holmén", role: "Youth National Team Back", tier: "DIV1_ACADEMY_PROSPECT", targetBand: "100-110 (PA 150-160)", rationale: "Swedish U-team standout in Sävehof system. Modern right-back archetype." },
    // Established Allsvenskan Anchors
    { id: "se_player_elliot_hovre_bjorck_40a6f29e", name: "Elliot Hövre Björck", role: "Allsvenskan Starting GK", tier: "ALLSV_STARTER", targetBand: "115-125", rationale: "HK Drott starting goalkeeper, proven second-tier production." },
    { id: "se_player_axel_winstrom_c59447b8", name: "Axel Winström", role: "Allsvenskan Rotation GK", tier: "ALLSV_ROTATION", targetBand: "110-120", rationale: "Redbergslids IK goalkeeper, benchmark for competitive Allsvenskan depth." },
    // Division 1 Benchmarks
    { id: "se_player_theodor_kapnias_olsson_60beed3c", name: "Theodor Kapnias Olsson", role: "Division 1 Standout Back", tier: "DIV1_STANDOUT", targetBand: "115-125", rationale: "Senior transfer to Kärra HF with Allsvenskan background. Overlaps lower Allsvenskan." },
    { id: "se_player_adam_fule_5020dcbf", name: "Adam Füle", role: "Division 1 Starter / Playmaker", tier: "DIV1_STARTER", targetBand: "100-112", rationale: "HP Warta playmaker, benchmark for Division 1 Södra starting quality." },
  ];

  const anchorHeader = [
    "playerId",
    "name",
    "clubName",
    "competitionId",
    "position",
    "age",
    "currentCA",
    "currentPA",
    "anchorRole",
    "anchorTier",
    "targetCABand",
    "anchorRationale",
  ].join(",");

  const anchorRows: string[] = [];
  for (const ac of anchorCandidates) {
    const p = allPlayers.find((x) => x.playerId === ac.id);
    if (!p) {
      console.warn(`Anchor candidate ${ac.id} not found in database!`);
      continue;
    }
    anchorRows.push(
      [
        p.playerId,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.clubName.replace(/"/g, '""')}"`,
        p.competitionId,
        p.primaryPosition,
        p.age,
        p.runtimeCA,
        p.runtimePA,
        `"${ac.role}"`,
        ac.tier,
        `"${ac.targetBand}"`,
        `"${ac.rationale.replace(/"/g, '""')}"`,
      ].join(",")
    );
  }

  fs.writeFileSync(path.join(REPORT_DIR, "CALIBRATION-ANCHORS.csv"), [anchorHeader, ...anchorRows].join("\n"), "utf8");
  console.log(`Wrote CALIBRATION-ANCHORS.csv (${anchorRows.length} anchors)`);

  console.log("\n=================================================================");
  console.log("BASELINE AUDIT COMPLETED SUCCESSFULLY");
  console.log("=================================================================");
}

runBaselineAudit();
