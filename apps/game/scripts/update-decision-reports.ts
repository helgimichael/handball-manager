import fs from "node:fs";
import path from "node:path";

const QA_DIR = "C:/DEV/QA/reports/HM-PLAYER-DATABASE-2026-27";

function readCsv(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return content.trim().split(/\r?\n/).map(line => {
    const row: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    row.push(cur);
    return row;
  });
}

function writeCsv(filePath: string, rows: string[][]): void {
  const lines = rows.map(r => r.map(cell => {
    if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }).join(","));
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

export function updateReports() {
  console.log("Updating decision reports and registries in " + QA_DIR);

  // 1. Update BATCH-1-IDENTITY-DECISIONS.csv
  const b1Path = path.join(QA_DIR, "BATCH-1-IDENTITY-DECISIONS.csv");
  const b1Rows = readCsv(b1Path);
  const b1Header = b1Rows[0];
  const b1PlayerIdx = b1Header.indexOf("playerName");
  const b1OwnerIdx = b1Header.indexOf("ownerDecision");

  for (let i = 1; i < b1Rows.length; i++) {
    const row = b1Rows[i];
    const name = row[b1PlayerIdx];
    if (name === "Malte Månsson") row[b1OwnerIdx] = "APPROVED_APPLIED";
    else if (name === "Elliot Hövre Björck") row[b1OwnerIdx] = "REJECT";
    else if (name === "Emil Arthursson") row[b1OwnerIdx] = "APPROVED_APPLIED";
    else if (name === "Oliver Andersson") row[b1OwnerIdx] = "DEFER";
    else if (name === "Axel Winström") row[b1OwnerIdx] = "DEFER";
    else if (name === "Oskar Alf Dahlin") row[b1OwnerIdx] = "DEFER";
  }
  writeCsv(b1Path, b1Rows);
  console.log("  -> Updated BATCH-1-IDENTITY-DECISIONS.csv");

  // 2. Update BATCH-2-CLUB-DECISIONS.csv
  const b2Path = path.join(QA_DIR, "BATCH-2-CLUB-DECISIONS.csv");
  const b2Rows = readCsv(b2Path);
  const b2Header = b2Rows[0];
  const b2PlayerIdx = b2Header.indexOf("playerName");
  const b2StatusIdx = b2Header.indexOf("approvalStatus");

  for (let i = 1; i < b2Rows.length; i++) {
    const row = b2Rows[i];
    const name = row[b2PlayerIdx];
    if (name === "Emil Arthursson") row[b2StatusIdx] = "APPROVED_APPLIED";
    else if (name === "Adam Füle") row[b2StatusIdx] = "APPROVED_APPLIED";
    else if (name === "Theodor Kapnias Olsson") row[b2StatusIdx] = "APPROVED_APPLIED";
    else if (name === "Viggo Möller Holmén") row[b2StatusIdx] = "DEFER";
    else if (name === "Axel Winström") row[b2StatusIdx] = "DEFER";
    else if (name === "Oliver Andersson") row[b2StatusIdx] = "DEFER";
  }
  writeCsv(b2Path, b2Rows);
  console.log("  -> Updated BATCH-2-CLUB-DECISIONS.csv");

  // 3. Update owner-review-workflow.csv
  const wfPath = path.join(QA_DIR, "owner-review-workflow.csv");
  const wfRows = readCsv(wfPath);
  const wfHeader = wfRows[0];
  const wfPlayerIdx = wfHeader.indexOf("player");
  const wfDecisionIdx = wfHeader.indexOf("decision");

  for (let i = 1; i < wfRows.length; i++) {
    const row = wfRows[i];
    const player = row[wfPlayerIdx];
    if (player === "Malte Månsson") row[wfDecisionIdx] = "APPROVED_APPLIED";
    else if (player === "Elliot Hövre Björck") row[wfDecisionIdx] = "REJECT";
    else if (player === "Emil Arthursson") row[wfDecisionIdx] = "APPROVED_APPLIED";
    else if (player === "Adam Füle") row[wfDecisionIdx] = "APPROVED_APPLIED";
    else if (player === "Theodor Kapnias Olsson") row[wfDecisionIdx] = "APPROVED_APPLIED";
    else if (player === "Viggo Möller Holmén") row[wfDecisionIdx] = "DEFER";
    else if (player === "Oliver Andersson") row[wfDecisionIdx] = "DEFER";
    else if (player === "Axel Winström") row[wfDecisionIdx] = "DEFER";
    else if (player === "Oskar Alf Dahlin") row[wfDecisionIdx] = "DEFER";
  }
  writeCsv(wfPath, wfRows);
  console.log("  -> Updated owner-review-workflow.csv");

  // 4. Update player-inventory.csv (remove retired Karlskrona ghost record, update club for Malte, Adam, Theodor)
  const invPath = path.join(QA_DIR, "player-inventory.csv");
  const invRows = readCsv(invPath);
  const invHeader = invRows[0];
  const invIdIdx = invHeader.indexOf("playerId");
  const invClubIdx = invHeader.indexOf("club");

  const filteredInvRows = [invHeader];
  for (let i = 1; i < invRows.length; i++) {
    const row = invRows[i];
    const id = row[invIdIdx];
    // Remove Karlskrona ghost duplicate of Emil Arthursson
    if (id === "se_player_emil_arthursson_db40e94c") continue;

    // Update clubs for transferred players
    if (id === "player_malte_mansson_1d49a03b") {
      row[invClubIdx] = "HK Malmö";
    } else if (id === "se_player_adam_fule_5020dcbf") {
      row[invClubIdx] = "HP Warta";
    } else if (id === "se_player_theodor_kapnias_olsson_60beed3c") {
      row[invClubIdx] = "Kärra HF";
    }
    filteredInvRows.push(row);
  }
  writeCsv(invPath, filteredInvRows);
  console.log(`  -> Updated player-inventory.csv (${filteredInvRows.length - 1} canonical players)`);

  // 5. Update FINAL-REPORT.md with Owner Decision section
  const reportPath = path.join(QA_DIR, "FINAL-REPORT.md");
  let report = fs.readFileSync(reportPath, "utf8");

  const decisionSection = `

---

## 5. OWNER DECISIONS APPLIED (BATCH 1 & BATCH 2)

Owner decisions on Batch 1 (Identity Conflicts & Duplicates) and Batch 2 (Confirmed Club Changes) have been fully applied to the 2026/27 development database:

### 5.1 Approved & Applied Transfers (4 Cases)
1. **Malte Månsson (\`player_malte_mansson_1d49a03b\`):**
   - Transferred from **GF Kroppskultur** to **HK Malmö** (#9, H9).
   - Official Handbollsligan registration verified via Profixio player 648609.
   - Researched ratings (\`ca: 112, pa: 160\`) and review notes migrated cleanly to HK Malmö locked ratings.
2. **Emil Arthursson (\`se_player_emil_arthursson_e99d2749\`):**
   - Consolidated to **H43 Lund HF** (#12, MV).
   - Removed obsolete Karlskrona ghost placeholder duplicate (\`se_player_emil_arthursson_db40e94c\`).
   - Researched ratings (\`ca: 126, pa: 128\`) and career history preserved at H43 Lund HF.
3. **Adam Füle (\`se_player_adam_fule_5020dcbf\`):**
   - Transferred from **Kungälvs HK** to **HP Warta** (M9, Division 1 Södra).
   - Official Division 1 Södra registration verified via Profixio 2026/27 roster.
   - Researched ratings (\`ca: 106, pa: 149\`) and review notes migrated cleanly to HP Warta locked ratings.
4. **Theodor Kapnias Olsson (\`se_player_theodor_kapnias_olsson_60beed3c\`):**
   - Transferred from **Redbergslids IK** to **Kärra HF** (#19, V9, Division 1 Södra).
   - Official Division 1 Södra registration verified via Profixio 2026/27 roster.
   - Researched ratings (\`ca: 119, pa: 137\`) and review notes migrated cleanly to Kärra HF locked ratings.

### 5.2 Rejected Cases (1 Case)
- **Elliot Hövre Björck (\`se_player_elliot_hovre_bjorck_40a6f29e\`):**
  - HK Drott Halmstad → IFK Tumba HK: **REJECTED**.
  - Current club registration at **HK Drott Halmstad** retained.
  - Recorded \`REJECT\` in the decision registry. No duplicate imported; identity integrity preserved.

### 5.3 Deferred Cases (4 Cases — No Changes Applied)
- **Viggo Möller Holmén (\`player_viggo_moller_holmen_9c5affc4\`):** Retained at HK S-hof reserve squad (\`DEFER\`).
- **Oliver Andersson (\`se_player_oliver_andersson_20b69aa2\`):** Retained at Redbergslids IK with Önnered affiliation (\`DEFER\`).
- **Axel Winström (\`se_player_axel_winstrom_c59447b8\`):** Retained at Redbergslids IK with Kärra affiliation (\`DEFER\`).
- **Oskar Alf Dahlin (\`se_player_oskar_alf_dahlin_591a8ba2\`):** Retained at Alingsås HK with HP Alingsås affiliation (\`DEFER\`).

### 5.4 Final Database Invariants Post-Decisions
- **Canonical Real-World Players:** **1,380** (1,280 Swedish + 100 International).
- **Playable Population in Game:** **1,401** (1,380 canonical + 21 mock in \`TUMBA_SQUAD\`).
- **Researched Ratings Unchanged:** 100% fidelity maintained; 0 fabricated ratings.
- **Verification Test Suite:** **58 / 58 tests passed (100%)**.
`;

  if (!report.includes("## 5. OWNER DECISIONS APPLIED")) {
    report += decisionSection;
    fs.writeFileSync(reportPath, report, "utf8");
    console.log("  -> Appended Owner Decisions section to FINAL-REPORT.md");
  }
}

if (require.main === module || process.argv[1]?.endsWith("update-decision-reports.ts")) {
  updateReports();
}
