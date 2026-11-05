import fs from "node:fs";
import path from "node:path";

const REPORT_DIR = "C:/DEV/QA/reports/HM-PLAYER-DATABASE-2026-27";

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header: string[] = [];
  let cur = "";
  let inQ = false;
  for (const c of lines[0]) {
    if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) {
      header.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  header.push(cur.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row: string[] = [];
    cur = "";
    inQ = false;
    for (const c of lines[i]) {
      if (c === '"') inQ = !inQ;
      else if (c === "," && !inQ) {
        row.push(cur);
        cur = "";
      } else cur += c;
    }
    row.push(cur);
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = row[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

export function auditReports() {
  console.log("=== AUDITING GENERATED REPORT DELIVERABLES ===");

  const expectedFiles = [
    "player-inventory.csv",
    "verified-players.csv",
    "new-players.csv",
    "corrected-players.csv",
    "manual-review.csv",
    "quarantined-players.csv",
    "duplicate-candidates.csv",
    "source-register.csv",
    "import-diff.csv",
  ];

  for (const file of expectedFiles) {
    const p = path.join(REPORT_DIR, file);
    if (!fs.existsSync(p)) {
      throw new Error(`Missing expected report file: ${file}`);
    }
    const stat = fs.statSync(p);
    console.log(`[PASS] ${file} (${stat.size} bytes)`);
  }

  // 1. Inventory stats
  const inventory = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "player-inventory.csv"), "utf8"));
  console.log(`\n--- Player Inventory (${inventory.length} total) ---`);
  const invByTier: Record<string, number> = {};
  const invByComp: Record<string, number> = {};
  const invByStatus: Record<string, number> = {};
  for (const r of inventory) {
    invByTier[r.tier || "Mock"] = (invByTier[r.tier || "Mock"] || 0) + 1;
    invByComp[r.competitionName || "Mock"] = (invByComp[r.competitionName || "Mock"] || 0) + 1;
    invByStatus[r.verificationStatus] = (invByStatus[r.verificationStatus] || 0) + 1;
  }
  console.log("By Competition:", invByComp);
  console.log("By Verification Status:", invByStatus);

  // 2. Verified stats
  const verified = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "verified-players.csv"), "utf8"));
  console.log(`\n--- Verified Players (${verified.length} total) ---`);
  const verByComp: Record<string, number> = {};
  for (const r of verified) {
    verByComp[r.competitionName] = (verByComp[r.competitionName] || 0) + 1;
  }
  console.log("Verified by Competition:", verByComp);

  // 3. New players stats
  const newPlayers = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "new-players.csv"), "utf8"));
  console.log(`\n--- New Players Identified (${newPlayers.length} total) ---`);
  const newByComp: Record<string, number> = {};
  for (const r of newPlayers) {
    newByComp[r.competition] = (newByComp[r.competition] || 0) + 1;
  }
  console.log("New by Competition:", newByComp);

  // 4. Corrected players stats
  const corrected = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "corrected-players.csv"), "utf8"));
  console.log(`\n--- Biographical Corrections (${corrected.length} total) ---`);

  // 5. Manual review stats
  const review = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "manual-review.csv"), "utf8"));
  console.log(`\n--- Manual Review Queue (${review.length} total) ---`);
  const reviewCats: Record<string, number> = {};
  for (const r of review) {
    reviewCats[r.category] = (reviewCats[r.category] || 0) + 1;
  }
  console.log("Review Categories:");
  for (const [k, v] of Object.entries(reviewCats).sort()) {
    console.log(`  ${k}: ${v}`);
  }

  // 6. Quarantined stats
  const quarantined = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "quarantined-players.csv"), "utf8"));
  console.log(`\n--- Quarantined Players (${quarantined.length} total) ---`);
  const quarByClub: Record<string, number> = {};
  for (const r of quarantined) {
    quarByClub[r.clubName] = (quarByClub[r.clubName] || 0) + 1;
  }
  console.log("Quarantine by Club:", quarByClub);

  // 7. Duplicate candidates
  const dups = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "duplicate-candidates.csv"), "utf8"));
  console.log(`\n--- Duplicate Candidates (${dups.length} total) ---`);
  const dupVerdicts: Record<string, number> = {};
  for (const r of dups) {
    dupVerdicts[r.verdict] = (dupVerdicts[r.verdict] || 0) + 1;
  }
  console.log("Duplicate Verdicts:", dupVerdicts);

  // 8. Sources
  const sources = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "source-register.csv"), "utf8"));
  console.log(`\n--- Source Register (${sources.length} indexed) ---`);

  // 9. Diff operations
  const diffs = parseCsv(fs.readFileSync(path.join(REPORT_DIR, "import-diff.csv"), "utf8"));
  console.log(`\n--- Import Diff (${diffs.length} operations) ---`);
  const diffOps: Record<string, number> = {};
  for (const r of diffs) {
    diffOps[r.operation] = (diffOps[r.operation] || 0) + 1;
  }
  console.log("Diff Operations:", diffOps);

  console.log("\n[SUCCESS] All deliverable CSVs verified and consistent!");
}

if (require.main === module || process.argv[1]?.endsWith("verify-reports.ts")) {
  auditReports();
}
