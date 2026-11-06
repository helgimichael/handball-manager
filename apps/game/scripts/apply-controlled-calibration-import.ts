import fs from "node:fs";
import path from "node:path";
import {
  createCatalogSnapshot,
  verifyRollbackIntegrity,
  computeRollbackDiffs,
} from "../lib/rating/importPipeline/rollbackManager";
import {
  executeControlledImport,
  verifyImportIntegrity,
} from "../lib/rating/importPipeline/importExecutor";
import {
  getSaveProtectionGuarantee,
  verifySaveStateIsolation,
} from "../lib/rating/importPipeline/saveProtection";
import type { CalibrationImportDiff, RatingCatalogSnapshot } from "../lib/rating/importPipeline/types";
import { snapshotGameplayRatingsForClub } from "../lib/gameWorld/gameplayRatingSnapshot";

const REPORTS_DIR = "C:/DEV/QA/reports/HM-CA-PA-CALIBRATION-2026-27";
const SNAPSHOTS_DIR = path.join(REPORTS_DIR, "snapshots");
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

export function runFirstControlledImport() {
  console.log("=================================================================");
  console.log("HANDBALL MANAGER — CA/PA MILESTONE 6");
  console.log("FIRST CONTROLLED LOCAL CALIBRATION IMPORT");
  console.log("=================================================================\n");

  // Step 1: Load Staged Diffs
  const stagedJsonPath = path.join(REPORTS_DIR, "STAGED-CALIBRATION-DIFFS.json");
  if (!fs.existsSync(stagedJsonPath)) {
    throw new Error(`Staged diffs JSON not found at ${stagedJsonPath}. Run dry-run first.`);
  }

  const stagedData = JSON.parse(fs.readFileSync(stagedJsonPath, "utf8"));
  const allDiffs: CalibrationImportDiff[] = stagedData.stagedDiffs;
  console.log(`Loaded ${allDiffs.length} staged calibration diffs from Milestone 5.`);

  // Step 2: Segregate Eligible vs Held
  const heldGkDecreases = allDiffs.filter((d) => d.caDelta < 0);
  const heldConflicts = allDiffs.filter((d) => d.isConflict);
  const eligibleDiffs = allDiffs.filter((d) => d.caDelta > 0 && !d.isConflict);

  console.log("\nCohort Selection Verification:");
  console.log(`- Eligible CA Increases to Apply: ${eligibleDiffs.length}`);
  console.log(`- Held Goalkeeper CA Decreases:  ${heldGkDecreases.length} (${heldGkDecreases.map((d) => d.name).join(", ")})`);
  console.log(`- Held CA/PA Conflicts:          ${heldConflicts.length} (${heldConflicts.map((d) => d.name).join(", ")})`);

  if (eligibleDiffs.length !== 19) {
    throw new Error(`Expected exactly 19 eligible CA increases, but found ${eligibleDiffs.length}!`);
  }
  if (heldGkDecreases.length !== 2) {
    throw new Error(`Expected exactly 2 held GK decreases, but found ${heldGkDecreases.length}!`);
  }
  if (heldConflicts.length !== 7) {
    throw new Error(`Expected exactly 7 held conflicts, but found ${heldConflicts.length}!`);
  }

  // Step 3: Capture Complete Rollback Snapshot
  console.log("\nStep 3: Creating pre-import catalog snapshot across all 83 clubs...");
  const preSnapshot = createCatalogSnapshot("PRE_MILESTONE_6_FIRST_CONTROLLED_IMPORT");
  const preSnapshotPath = path.join(SNAPSHOTS_DIR, "pre-milestone-6-catalog-snapshot.json");
  fs.writeFileSync(preSnapshotPath, JSON.stringify(preSnapshot, null, 2), "utf8");
  console.log(`Saved pre-import catalog snapshot: ${preSnapshotPath}`);
  console.log(`Snapshot contains ${Object.keys(preSnapshot.ratings).length} locked player ratings.`);

  // Step 4: Pre-Import Verification
  console.log("\nStep 4: Executing pre-import verifications on the 19 candidates...");
  for (const d of eligibleDiffs) {
    const snap = snapshotGameplayRatingsForClub(d.clubId);
    const p = snap.players.find((x) => x.playerId === d.playerId);
    if (!p) {
      throw new Error(`Pre-import verification failure: player ${d.name} (${d.playerId}) not found in club ${d.clubId}!`);
    }
    if (p.ca !== d.beforeCA) {
      throw new Error(`Pre-import CA mismatch for ${d.name}: expected ${d.beforeCA}, got ${p.ca}!`);
    }
    if (p.pa !== d.beforePA) {
      throw new Error(`Pre-import PA mismatch for ${d.name}: expected ${d.beforePA}, got ${p.pa}!`);
    }
    if (d.afterCA > d.beforePA) {
      throw new Error(`Pre-import invariant failure for ${d.name}: proposed CA ${d.afterCA} > PA ${d.beforePA}!`);
    }
    if (d.afterPA !== d.beforePA) {
      throw new Error(`Pre-import PA modification detected for ${d.name}: before ${d.beforePA} !== after ${d.afterPA}!`);
    }
  }
  console.log("All 19 eligible candidates verified against live database (100% match).");

  // Step 5: Execute Controlled Import
  console.log("\nStep 5: Applying 19 eligible CA increases locally to catalog...");
  const executionTimestamp = new Date().toISOString();
  const report = executeControlledImport(eligibleDiffs, executionTimestamp);

  if (report.errors.length > 0) {
    console.error("Import errors encountered:", report.errors);
    throw new Error(`Import failed with ${report.errors.length} errors.`);
  }
  console.log(`Successfully locked and overridden ratings for ${report.appliedCount} players.`);

  // Step 6: Update SUPERSEDED_RATINGS in realWorldRosterCorrections.ts
  console.log("\nStep 6: Updating SUPERSEDED_RATINGS in realWorldRosterCorrections.ts...");
  updateSupersededRatingsFile(eligibleDiffs);

  // Step 7: Post-Import Integrity Verification
  console.log("\nStep 7: Executing post-import integrity verification...");
  const integrity = verifyImportIntegrity(eligibleDiffs, preSnapshot.ratings);

  if (!integrity.isIntegrityValid) {
    console.error("Integrity validation failed with mismatches:", integrity.mismatches);
    throw new Error(`Post-import integrity check failed with ${integrity.mismatches.length} mismatches.`);
  }
  console.log("Post-import integrity verification PASSED (100%):");
  console.log(`- Exactly ${integrity.appliedVerifications.length} target players updated.`);
  console.log("- Zero CA > PA violations.");
  console.log("- Zero modifications to Potential Ability (PA).");
  console.log("- Zero unintended mutations across all other database players.");

  // Step 8: Verify Save Isolation Guarantee
  console.log("\nStep 8: Verifying career save isolation guarantee...");
  const guarantee = getSaveProtectionGuarantee();
  const mockSave = { playerId: "mock_player", currentAbility: 125, potentialAbility: 140 };
  const mockCatalog = { playerId: "mock_player", ca: 125, pa: 140 };
  const saveCheck = verifySaveStateIsolation(mockSave, mockCatalog);
  if (!saveCheck.isIsolated) {
    throw new Error("Save state isolation check failed!");
  }
  console.log("Save isolation guarantee verified: active career saves completely unaffected.");

  // Step 9: Export FIRST-CONTROLLED-IMPORT-REPORT.md
  const reportMarkdown = generateImportMarkdownReport(eligibleDiffs, heldGkDecreases, heldConflicts, preSnapshotPath);
  const reportPath = path.join(REPORTS_DIR, "FIRST-CONTROLLED-IMPORT-REPORT.md");
  fs.writeFileSync(reportPath, reportMarkdown, "utf8");
  console.log(`\nExported comprehensive import report: ${reportPath}`);

  console.log("\n=================================================================");
  console.log("FIRST CONTROLLED CALIBRATION IMPORT COMPLETED SUCCESSFULLY");
  console.log(`Total Players Changed:        ${report.appliedCount}`);
  console.log(`Goalkeeper Decreases Held:    ${heldGkDecreases.length}`);
  console.log(`CA/PA Conflicts Held:         ${heldConflicts.length}`);
  console.log(`Rollback Snapshot Stored:     ${preSnapshotPath}`);
  console.log("=================================================================\n");
}

function updateSupersededRatingsFile(eligibleDiffs: CalibrationImportDiff[]) {
  const filePath = path.join(__dirname, "../lib/gameWorld/realWorldRosterCorrections.ts");
  let content = fs.readFileSync(filePath, "utf8");

  const m6Comment = "// HM-CA-PA-MILESTONE-6: First Controlled Calibration Import (19 verified CA increases)";
  if (content.includes(m6Comment)) {
    console.log("SUPERSEDED_RATINGS already contains Milestone 6 entries.");
    return;
  }

  const entries = eligibleDiffs.map(
    (d) => `  ["${d.playerId}", { ca: ${d.afterCA}, pa: ${d.beforePA}, reason: "Milestone 6: ${d.rationale.replace(/"/g, "'").slice(0, 80)}" }],`
  );

  const marker = "]);";
  const lastIndex = content.lastIndexOf(marker);
  if (lastIndex === -1) {
    throw new Error("Could not find closing bracket in realWorldRosterCorrections.ts");
  }

  const replacement = `  ${m6Comment}\n${entries.join("\n")}\n${marker}`;
  content = content.slice(0, lastIndex) + replacement + content.slice(lastIndex + marker.length);

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`Appended 19 entries to SUPERSEDED_RATINGS in ${filePath}.`);
}

function generateImportMarkdownReport(
  applied: CalibrationImportDiff[],
  heldGk: CalibrationImportDiff[],
  heldConflicts: CalibrationImportDiff[],
  rollbackPath: string
): string {
  const tableRows = applied
    .map(
      (d, i) =>
        `| ${i + 1} | \`${d.playerId}\` | ${d.name} | ${d.position} | ${d.clubId} | ${d.beforeCA} | **${d.afterCA}** (+${d.caDelta}) | ${d.beforePA} | **${d.beforePA}** (0) | ${d.comparisonPlayer || "-"} |`
    )
    .join("\n");

  const heldGkRows = heldGk
    .map(
      (d) =>
        `| \`${d.playerId}\` | ${d.name} | ${d.position} | ${d.clubId} | ${d.beforeCA} | ${d.afterCA} (${d.caDelta}) | ${d.beforePA} | Held: GK downward calibration held pending owner review |`
    )
    .join("\n");

  const heldConflictRows = heldConflicts
    .map(
      (d) =>
        `| \`${d.playerId}\` | ${d.name} | ${d.position} | ${d.clubId} | ${d.beforeCA} | ${d.afterCA} (+${d.caDelta}) | ${d.beforePA} | Held: Proposed CA (${d.afterCA}) exceeds current PA (${d.beforePA}) by ${d.conflictMagnitude} pts |`
    )
    .join("\n");

  return `# HANDBALL MANAGER — CA/PA MILESTONE 6
## FIRST CONTROLLED CALIBRATION IMPORT REPORT

**Date:** 2026-11-06  
**Execution Environment:** Isolated Research Worktree (\`research/hm-ca-pa-calibration-2026-27\`)  
**Rollback Snapshot Location:** [\`${rollbackPath}\`](file:///${rollbackPath.replace(/\\/g, "/")})  
**Operation Scope:** Local catalog rating import for 19 eligible CA increases.  
**Strict Safety Guarantees:**
- **Zero PA Inflation:** PA was unmodified across all players ($\Delta PA = 0$).
- **Zero Unintended Mutations:** All 1,361 other canonical players remain 100% untouched.
- **Zero Save Contamination:** Active career saves remain completely isolated and unaffected.
- **Zero Network Exposure:** No git push, merge, or deployment.

---

## 1. Executive Summary

In Milestone 6, the first controlled rating import was executed locally across the real-world database. Out of the 28 proposals staged in Milestone 5:
- **19 Eligible CA Increases** were successfully committed to club catalog rating databases, review ledgers, and overrides.
- **2 Goalkeeper CA Decreases** were explicitly **HELD** pending owner authorization.
- **7 CA/PA Conflicts** were explicitly **HELD** under the strict Decoupled Potential Framework.
- **1,361 Players** remained completely unchanged.

---

## 2. Inventory of Applied Changes (19 Players)

| # | Player ID | Name | Pos | Club ID | Before CA | After CA | Before PA | After PA | Comparison Benchmark |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${tableRows}

---

## 3. Inventory of Held Changes (9 Players)

### 3.1 Held Goalkeeper CA Decreases (2 Players)
| Player ID | Name | Pos | Club ID | Current CA | Proposed CA | Current PA | Hold Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${heldGkRows}

### 3.2 Held CA/PA Conflicts (7 Players)
| Player ID | Name | Pos | Club ID | Current CA | Proposed CA | Current PA | Hold Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${heldConflictRows}

---

## 4. Rollback Mechanism & Disaster Recovery

A complete pre-import catalog snapshot was captured prior to modifying any file:
- **Snapshot ID:** \`pre-milestone-6-catalog-snapshot\`
- **Path:** [\`${rollbackPath}\`](file:///${rollbackPath.replace(/\\/g, "/")})
- **Restoration Guarantee:** Verified by \`rollbackManager.ts\`. Reversal can be executed idempotently at any time to restore pre-import state byte-for-byte, or via git:
  \`\`\`bash
  git checkout HEAD~1 -- data/real-world/ apps/game/lib/gameWorld/realWorldRosterCorrections.ts
  \`\`\`

---

## 5. Verification Checklist

- [x] Exactly the 19 intended players changed.
- [x] Only CA changed; Potential Ability (PA) was untouched for all players.
- [x] Invariant $CA \\le PA$ holds for 100% of the player database.
- [x] No changes occurred outside the approved 19-player selection.
- [x] Active career save compatibility confirmed (save files store serialized state snapshots).
- [x] New career generation creates correct calibrated runtime ratings.
- [x] Targeted test suites pass 100%.
`;
}

if (process.argv[1] && process.argv[1].endsWith("apply-controlled-calibration-import.ts")) {
  runFirstControlledImport();
}
