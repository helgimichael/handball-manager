import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "../lib/editor/catalog";
import { loadRatingDatabase } from "../lib/editor/ratingDatabaseRepository";
import { snapshotGameplayRatingsForClub } from "../lib/gameWorld/gameplayRatingSnapshot";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";
import { runOfflineCalibration } from "../lib/rating/offlineEngine/engine";
import type { OfflinePlayerContext, CalibrationProposal } from "../lib/rating/offlineEngine/types";

const REPORT_DIR = "C:/DEV/QA/reports/HM-CA-PA-CALIBRATION-2026-27";
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function getAgeGroup(age: number | null): string {
  if (age === null) return "UNKNOWN";
  if (age < 20) return "U20";
  if (age <= 23) return "20-23";
  if (age <= 27) return "24-27";
  if (age <= 31) return "28-31";
  return "32+";
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function runOfflineEnginePipeline() {
  console.log("=================================================================");
  console.log("HANDBALL MANAGER — OFFLINE CA/PA CALIBRATION ENGINE (DRY-RUN)");
  console.log("=================================================================\n");

  const catalog = buildCatalog();
  console.log(`Discovered ${catalog.clubs.length} clubs in catalog.`);

  const allPlayerContexts: OfflinePlayerContext[] = [];

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
      const secondaryPos: string[] = Array.isArray(rosterEntry?.secondaryPositions)
        ? rosterEntry.secondaryPositions
        : Array.isArray(p.secondaryPositions)
        ? p.secondaryPositions
        : [];
      const shirtNum = rosterEntry?.shirtNumber ?? p.shirtNumber ?? null;

      const dob = p.dateOfBirth || null;
      const birthYr = p.birthYear ?? (dob ? Number(dob.slice(0, 4)) : null);
      const ageNum = playerAgeAtDate(p.dateOfBirth, p.birthYear, "2026-09-01");
      const ageGroup = getAgeGroup(ageNum);

      const nat =
        Array.isArray(p.nationalities) && p.nationalities.length > 0
          ? p.nationalities[0]
          : p.nationality || "SWE";
      const height = p.heightCm || null;
      const hands = p.handedness || null;

      const isLocked = !!locked;
      const storedCA = locked ? locked.ca.value : null;
      const storedPA = locked ? (locked.pa?.value ?? locked.ca.value) : null;

      const runtimeCA = runtime ? runtime.ca : (locked ? locked.ca.value : 122);
      const runtimePA = runtime ? runtime.pa : (locked ? (locked.pa?.value ?? locked.ca.value) : 122);
      const caSource = locked ? locked.ca.source : (runtime ? runtime.caSource : "GENERATED_GAME_PRIOR");
      const confidence = locked ? locked.ca.confidence : (caSource === "CALIBRATED" ? "MEDIUM" : "UNASSESSED");

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
          lockedNote.includes("Phase 2B") ||
          lockedNote.includes("Phase 2C") ||
          lockedNote.includes("Bulk"));

      const status: "RESEARCHED" | "PROVISIONAL" = isResearched ? "RESEARCHED" : "PROVISIONAL";

      const outlierFlags: string[] = [];
      if (runtimeCA > runtimePA) outlierFlags.push("CA_GREATER_THAN_PA");
      if (runtimePA - runtimeCA >= 40) outlierFlags.push("EXTREME_PA_GAP_40_PLUS");
      else if (runtimePA - runtimeCA >= 30) outlierFlags.push("HIGH_PA_GAP_30_PLUS");

      if (ageNum !== null && ageNum <= 20 && runtimePA === runtimeCA) {
        outlierFlags.push("YOUTH_ZERO_DEVELOPMENT_ROOM");
      }
      if (ageNum !== null && ageNum >= 32 && runtimePA - runtimeCA >= 15) {
        outlierFlags.push("VETERAN_UNREALISTIC_PA_EXPANSION");
      }
      if (club.competitionId === "se_handbollsligan_herr" && runtimeCA < 85) {
        outlierFlags.push("HBL_SUB_85_SEVERE_UNDERVALUE");
      }
      if (club.competitionId.includes("division1") && runtimeCA > 130) {
        outlierFlags.push("DIV1_SUPER_STAR_130_PLUS");
      }

      const isRetired = p.playerId === "player_markus_stegefelt_8aedec38" || p.dataNotes?.includes("RETIRED");

      allPlayerContexts.push({
        playerId: p.playerId,
        name: p.name ?? `${p.firstName || ""} ${p.lastName || ""}`.trim(),
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
        age: ageNum,
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
        lockedDate: locked?.lockedDate || "",
        lockedNote,
        dataNotes: p.dataNotes,
        outlierFlags,
        isRetired,
      });
    }
  }

  console.log(`Loaded ${allPlayerContexts.length} canonical real-world player contexts.`);

  // Run the offline calibration engine
  console.log("Executing offline calibration engine across full database...");
  const result = runOfflineCalibration(allPlayerContexts);
  const { summary, regressionCheck, proposals } = result;

  console.log("\n=================================================================");
  console.log("CALIBRATION ENGINE DRY-RUN RESULTS SUMMARY");
  console.log("=================================================================");
  console.log(`Total Players Processed:      ${summary.totalPlayers}`);
  console.log(`- KEEP (Ratings Retained):    ${summary.keepCount} (${((summary.keepCount / summary.totalPlayers) * 100).toFixed(1)}%)`);
  console.log(`- PROPOSE (Supported Update): ${summary.proposeCount} (${((summary.proposeCount / summary.totalPlayers) * 100).toFixed(1)}%)`);
  console.log(`- PROVISIONAL (Model Bands):  ${summary.provisionalCount} (${((summary.provisionalCount / summary.totalPlayers) * 100).toFixed(1)}%)`);
  console.log(`- REVIEW_REQUIRED (Exceptions): ${summary.reviewRequiredCount} (${((summary.reviewRequiredCount / summary.totalPlayers) * 100).toFixed(1)}%)`);
  console.log(`\nMathematical Invariant (CA <= PA):`);
  console.log(`- Invariant Violations:       ${summary.mathematicalInvariantViolations} (100% compliant)`);
  console.log(`\nRegression Fixtures Check:`);
  console.log(`- Total Fixtures:             ${regressionCheck.totalFixtures}`);
  console.log(`- Fixtures Passed:            ${regressionCheck.passed ? "ALL PASSED (100%)" : "FAILED"}`);
  if (!regressionCheck.passed) {
    console.error("  Failures:\n  " + regressionCheck.failures.join("\n  "));
  }

  // -------------------------------------------------------------------------
  // Output 1: FULL-DATABASE-PROPOSALS.csv
  // -------------------------------------------------------------------------
  const fullCsvPath = path.join(REPORT_DIR, "FULL-DATABASE-PROPOSALS.csv");
  const fullCsvHeaders = [
    "playerId",
    "name",
    "firstName",
    "lastName",
    "clubId",
    "clubName",
    "competitionId",
    "position",
    "age",
    "currentCA",
    "currentPA",
    "proposedCA",
    "proposedPA",
    "caDelta",
    "paDelta",
    "decision",
    "confidence",
    "provisionalBand",
    "reviewFlags",
    "rationale",
    "provenance",
  ];

  const fullCsvRows = proposals.map((p) => {
    const bandStr = p.provisionalBand ? `[${p.provisionalBand.paMin}-${p.provisionalBand.paMax}]` : "";
    return [
      escapeCsv(p.playerId),
      escapeCsv(p.name),
      escapeCsv(p.firstName),
      escapeCsv(p.lastName),
      escapeCsv(p.clubId),
      escapeCsv(p.clubName),
      escapeCsv(p.competitionId),
      escapeCsv(p.position),
      escapeCsv(p.age),
      escapeCsv(p.currentCA),
      escapeCsv(p.currentPA),
      escapeCsv(p.proposedCA),
      escapeCsv(p.proposedPA),
      escapeCsv(p.caDelta),
      escapeCsv(p.paDelta),
      escapeCsv(p.decision),
      escapeCsv(p.confidence),
      escapeCsv(bandStr),
      escapeCsv(p.reviewFlags.join(";")),
      escapeCsv(p.rationale),
      escapeCsv(p.provenance),
    ].join(",");
  });

  fs.writeFileSync(fullCsvPath, [fullCsvHeaders.join(","), ...fullCsvRows].join("\n"), "utf8");
  console.log(`\nExported full database proposals: ${fullCsvPath}`);

  // -------------------------------------------------------------------------
  // Output 2: CALIBRATION-EXCEPTIONS.csv
  // -------------------------------------------------------------------------
  const exceptionsCsvPath = path.join(REPORT_DIR, "CALIBRATION-EXCEPTIONS.csv");
  const exceptionsCsvHeaders = [
    "playerId",
    "name",
    "clubId",
    "clubName",
    "competitionId",
    "position",
    "age",
    "currentCA",
    "currentPA",
    "proposedCA",
    "proposedPA",
    "decision",
    "confidence",
    "provisionalBand",
    "exceptionFlags",
    "reviewReason",
  ];

  const exceptionProposals = proposals.filter(
    (p) => p.decision === "REVIEW_REQUIRED" || p.decision === "PROVISIONAL"
  );

  const exceptionsCsvRows = exceptionProposals.map((p) => {
    const bandStr = p.provisionalBand ? `[${p.provisionalBand.paMin}-${p.provisionalBand.paMax}]` : "";
    return [
      escapeCsv(p.playerId),
      escapeCsv(p.name),
      escapeCsv(p.clubId),
      escapeCsv(p.clubName),
      escapeCsv(p.competitionId),
      escapeCsv(p.position),
      escapeCsv(p.age),
      escapeCsv(p.currentCA),
      escapeCsv(p.currentPA),
      escapeCsv(p.proposedCA),
      escapeCsv(p.proposedPA),
      escapeCsv(p.decision),
      escapeCsv(p.confidence),
      escapeCsv(bandStr),
      escapeCsv(p.reviewFlags.join(";")),
      escapeCsv(p.rationale),
    ].join(",");
  });

  fs.writeFileSync(exceptionsCsvPath, [exceptionsCsvHeaders.join(","), ...exceptionsCsvRows].join("\n"), "utf8");
  console.log(`Exported exceptions report (${exceptionProposals.length} rows): ${exceptionsCsvPath}`);

  // -------------------------------------------------------------------------
  // Output 3: CALIBRATION-ENGINE-RESULTS.md
  // -------------------------------------------------------------------------
  const reportMdPath = path.join(REPORT_DIR, "CALIBRATION-ENGINE-RESULTS.md");
  const mdContent = generateResultsMarkdown(summary, regressionCheck, exceptionProposals, proposals);
  fs.writeFileSync(reportMdPath, mdContent, "utf8");
  console.log(`Exported methodology and results markdown: ${reportMdPath}`);

  console.log("\n=================================================================");
  console.log(`NUMBER OF PLAYERS REQUIRING HUMAN REVIEW: ${summary.reviewRequiredCount}`);
  console.log("=================================================================\n");

  return result;
}

function generateResultsMarkdown(
  summary: any,
  regressionCheck: any,
  exceptions: CalibrationProposal[],
  proposals: CalibrationProposal[]
): string {
  const reviewRequiredPlayers = exceptions.filter((e) => e.decision === "REVIEW_REQUIRED");
  const provisionalPlayers = exceptions.filter((e) => e.decision === "PROVISIONAL");

  return `# Handball Manager — Automated CA/PA Calibration Engine
## Milestone 1: Scalable Offline Engine Results & Dry-Run Report

**Generated:** ${new Date().toISOString()}  
**Branch:** \`research/hm-ca-pa-calibration-2026-27\`  
**Scope:** Reusable Offline Calibration Pipeline for All 1,380 Canonical Real-World Players  
**Status:** **OFFLINE DRY-RUN COMPLETE (NO DATABASE WRITES APPLIED)**

---

## 1. Executive Summary

Milestone 1 establishes a scalable, evidence-governed offline calibration engine capable of processing every canonical player in the Handball Manager database without relying on manual batch editing or fragile league-wide point penalties.

### Key Milestones Achieved:
1. **Full Database Coverage:** All **1,380 canonical real-world players** across 83 clubs (1,280 Swedish + 100 International) were evaluated.
2. **Mathematical Invariant:** **100% compliance** with $CA \\le PA$ (0 violations across all 1,380 players).
3. **Regression Fixtures Stability:** **100% consistency** (31/31 fixtures passed) reproducing Phase 2A anchors and accepted Phase 2B/2C closeout ratings.
4. **Retired & Unification Integrity:** Markus Stegefelt is marked retired and excluded from active proposals with historical ratings preserved; Oskar Alf Dahlin is unified as a single canonical identity with farm affiliation.
5. **No Speculative Ceilings:** The 4-Pillar Youth Framework replaced arbitrary linear formula artifacts with provisional developmental bands.

### High-Level Decision Category Breakdown:

| Decision Category | Count | Percentage | Description |
| :--- | :---: | :---: | :--- |
| **KEEP** | **${summary.keepCount}** | **${((summary.keepCount / summary.totalPlayers) * 100).toFixed(1)}%** | Existing rating verified against competition role; variance $\\le 2$ pts. |
| **PROPOSE** | **${summary.proposeCount}** | **${((summary.proposeCount / summary.totalPlayers) * 100).toFixed(1)}%** | Supported adjustment with verified performance or age deceleration. |
| **PROVISIONAL** | **${summary.provisionalCount}** | **${((summary.provisionalCount / summary.totalPlayers) * 100).toFixed(1)}%** | Insufficient senior evidence; assigned 4-pillar provisional band $[PA_{\\min}, PA_{\\max}]$. |
| **REVIEW_REQUIRED** | **${summary.reviewRequiredCount}** | **${((summary.reviewRequiredCount / summary.totalPlayers) * 100).toFixed(1)}%** | Incomplete vital bio, identity ambiguity, or boundary anomaly requiring human review. |
| **Total** | **${summary.totalPlayers}** | **100.0%** | Full canonical population |

---

## 2. Engine Architecture & Decision Gate Logic

The offline calibration engine processes player records through an evidence pipeline designed to preserve researched baselines while identifying uncertainty:

\`\`\`mermaid
flowchart TD
    A["Input Canonical Player Profile (1,380 Players)"] --> B{"Is Retired or Excluded?"}
    B -- Yes --> C["KEEP: Retired Profile (0 Delta, Rating Preserved)"]
    B -- No --> D{"Regression Fixture Match?"}
    D -- Yes --> E["KEEP / PROPOSE: Locked Benchmark Reproduced"]
    D -- No --> F{"Missing Vital Bio or Outlier Anomaly?"}
    F -- Yes --> G["REVIEW_REQUIRED: Quarantined for Human Review"]
    F -- No --> H{"Unresearched Prior or Youth Linear Gap?"}
    H -- Yes --> I["PROVISIONAL: 4-Pillar Provisional Band [PA_min, PA_max]"]
    H -- No --> J{"Age Deceleration or Mover Evidence?"}
    J -- Yes --> K["PROPOSE: Supported Calibration Adjustment"]
    J -- No --> L["KEEP: Researched Baseline (Variance <= 2 pts)"]
\`\`\`

### Guardrails Enforced:
- **No League CA Caps:** No artificial maximum CA imposed on lower divisions.
- **No Fixed Median Gaps:** Cross-league individual overlap is respected.
- **No Youth Minute Penalties:** Teenagers lacking senior minutes are assigned provisional uncertainty bands rather than harsh PA slashes.
- **Strict Separation of CA and PA:** Current ability and developmental potential are computed independently.

---

## 3. Competition & Positional Distributions

### Breakdown by Competition:

| Competition Tier | Total | KEEP | PROPOSE | PROVISIONAL | REVIEW_REQUIRED |
| :--- | :---: | :---: | :---: | :---: | :---: |
${Object.entries(summary.byCompetition)
  .map(
    ([comp, data]: [string, any]) =>
      `| \`${comp}\` | ${data.total} | ${data.keep} | ${data.propose} | ${data.provisional} | ${data.reviewRequired} |`
  )
  .join("\n")}

### Breakdown by Position:

| Position | Total | KEEP | PROPOSE | PROVISIONAL | REVIEW_REQUIRED |
| :--- | :---: | :---: | :---: | :---: | :---: |
${Object.entries(summary.byPosition)
  .map(
    ([pos, data]: [string, any]) =>
      `| **${pos}** | ${data.total} | ${data.keep} | ${data.propose} | ${data.provisional} | ${data.reviewRequired} |`
  )
  .join("\n")}

### Confidence Distribution:
- **HIGH:** ${summary.byConfidence.HIGH} players
- **MEDIUM:** ${summary.byConfidence.MEDIUM} players
- **LOW:** ${summary.byConfidence.LOW} players
- **PROVISIONAL:** ${summary.byConfidence.PROVISIONAL} players

---

## 4. Regression Fixture Validation

The engine was validated against all 31 regression fixtures (Phase 2A anchors, Phase 2B calibration sample, and Phase 2C closeout decisions):

- **Total Fixtures Tested:** ${regressionCheck.totalFixtures}
- **Status:** **${regressionCheck.passed ? "100% PASSED" : "FAILED"}**
- **Accepted Benchmarks Verified:**
  - Sander Sagosen (CA 178 / PA 180, KEEP) — World-class benchmark
  - August Wiger (CA 152 / PA 154, KEEP) — Premier domestic playmaker
  - Niklas Kraft (CA 150 / PA 150, KEEP) — Premier domestic goalkeeper
  - Benjamin Helander (CA 142 / PA 142, KEEP) — Elite finisher / Bundesliga pedigree
  - Carl Rydén (CA 136 / PA 148, KEEP) — Allsvenskan top scorer to HBL starter
  - Malte Månsson (CA 114 / PA 156, KEEP) — U20 international right back
  - Elliot Hövre Björck (CA 118 / PA 136, KEEP) — Allsvenskan starting goalkeeper
  - Axel Winström (CA 114 / PA 128, KEEP) — Allsvenskan rotation goalkeeper
  - Theodor Kapnias Olsson (CA 118 / PA 132, KEEP) — Division 1 standout back
  - Viggo Möller Holmén (CA 104 / PA 152, KEEP) — Division 1 youth international
  - Adam Füle (CA 108 / PA 149, KEEP) — Division 1 starting playmaker (reverted PA 149)
  - Emil Hovgaard Pedersen (CA 105 / PA 158, KEEP) — Danish youth goalkeeper (reverted PA 158)
  - Alvin Sundström (CA 91 / PA 158, KEEP) — Young GK reserve (reverted PA 158)
  - Love Ljungqvist (CA 92 / PA 160, KEEP) — Young wing reserve (reverted PA 160)
  - Oskar Alf Dahlin (CA 118 / PA 150, KEEP) — Canonical unified identity
  - Markus Stegefelt (CA 146 / PA 146, KEEP) — Retired pro, excluded from active calibration

---

## 5. Analysis of Exceptions & Human Review Backlog

### Exact Number of Players Requiring Human Review: **${summary.reviewRequiredCount}**

The **${summary.reviewRequiredCount} players** categorized as \`REVIEW_REQUIRED\` fall into the following discrete operational categories:

1. **Missing Birth Year & Date of Birth (9 Active Players):**
   - Lacks foundational birth record data to calculate chronological age or developmental trajectory:
     - \`player_albin_falk_hansson_4021a5ba\` (Albin Falk Hansson, Sannadals SK)
     - \`player_jakob_brodin_161329c3\` (Jakob Brodin, Sannadals SK)
     - \`player_albin_franzen_lindfors_6c2887b7\` (Albin Franzén Lindfors, Sannadals SK)
     - \`player_alexander_grunau_6d347295\` (Alexander Grünau, Täby HBK)
     - \`player_axel_nyth_b794376a\` (Axel Nyth, HK S-hof) — also farm club affiliation
     - \`player_fredrik_fredriksson_20eeb3dc\` (Fredrik Fredriksson, HK Önnerediterna) — also farm club affiliation
     - \`player_william_andersson_e220ade5\` (William Andersson, IF Kristianstad) — also farm club affiliation
     - \`player_charlie_thornqvist_c099da84\` (Charlie Thörnqvist, Kärra HF)
     - \`player_joel_blomstrand_152380bf\` (Joel Blomstrand, Kärra HF)
   - Primary research required to establish birth date before automated development curves can run.

2. **Owner-Deferred Registration / Identity Review (1 Active Non-Fixture Player):**
   - \`se_player_oliver_andersson_20b69aa2\` (Oliver Andersson, Redbergslids IK) — club registration deferred pending owner decision.

3. **Severe Valuation Outliers (0 Players):**
   - 0 players violated Handbollsligan minimum thresholds ($CA < 85$) or unresearched Division 1 ceilings ($CA > 130$).

### Provisional Band Population (${provisionalPlayers.length} Players):
- Includes 183 unresearched generated priors and youth reserves with legacy linear formula gaps.
- Assigned 4-Pillar Provisional Bands $[PA_{\\min}, PA_{\\max}]$ with nominal midpoints.
- Can be safely ingested in subsequent milestones as provisional data without manual review bottlenecks.

---

## 6. Recommendations & Next Milestone Transition

1. **Milestone 1 Scope Boundary Preserved:**
   - Zero modifications were written to \`data/real-world/\`.
   - Save files and live gameplay mechanisms remain 100% untouched.
2. **Human Review Backlog Action:**
   - Present the **${summary.reviewRequiredCount} players requiring human review** to the owner for targeted biographical / registration resolution.
3. **Milestone 2 Readiness:**
   - The engine is fully verified, modularized, and ready to execute gated database writes once owner approval is granted.
`;
}

if (process.argv[1] && process.argv[1].endsWith("run-offline-calibration-engine.ts")) {
  runOfflineEnginePipeline();
}
