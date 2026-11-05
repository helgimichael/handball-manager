import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APP_DIR, "../..");
const RESEARCH_DIR = path.join(REPO_ROOT, "exports/player-rating-research");

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header: string[] = [];
  let cur = "";
  let inQ = false;
  for (const c of lines[0]) {
    if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) { header.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  header.push(cur.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row: string[] = [];
    cur = "";
    inQ = false;
    for (const c of lines[i]) {
      if (c === '"') inQ = !inQ;
      else if (c === "," && !inQ) { row.push(cur); cur = ""; }
      else cur += c;
    }
    row.push(cur);
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = row[j] ?? "";
    rows.push(obj);
  }
  return rows;
}

export function auditInternationalAndCoverage() {
  console.log("=== AUDITING WORLD POOL (100 PLAYERS) ===");
  const wpPath = path.join(RESEARCH_DIR, "WORLD_POOL_FINAL_RATING_RESEARCH_v1.csv");
  const wpRows = parseCsv(fs.readFileSync(wpPath, "utf8"));
  console.log(`Loaded ${wpRows.length} international player research rows`);

  let withS1 = 0;
  let withS2 = 0;
  let with2026Evidence = 0;
  let with2025Evidence = 0;
  let withoutExplicitSeason = 0;
  const confBreakdown: Record<string, number> = {};

  for (const r of wpRows) {
    confBreakdown[r.Confidence] = (confBreakdown[r.Confidence] || 0) + 1;
    const s1 = r["Source 1"] || "";
    const s2 = r["Source 2"] || "";
    if (s1.startsWith("http")) withS1++;
    if (s2.startsWith("http")) withS2++;

    const text = `${s1} ${s2} ${r["Research Reason"] || ""}`;
    if (text.includes("2026") || text.includes("26/27") || text.includes("2026/27")) {
      with2026Evidence++;
    } else if (text.includes("2025") || text.includes("25/26") || text.includes("2025/26")) {
      with2025Evidence++;
    } else {
      withoutExplicitSeason++;
    }
  }

  console.log("Confidence breakdown:", confBreakdown);
  console.log(`With HTTP Source 1: ${withS1} / ${wpRows.length}`);
  console.log(`With HTTP Source 2: ${withS2} / ${wpRows.length}`);
  console.log(`With explicit 2026/27 evidence: ${with2026Evidence}`);
  console.log(`With 2025/26 season evidence (baseline predecessor): ${with2025Evidence}`);
  console.log(`Without explicit season string in URL: ${withoutExplicitSeason}`);

  // Sample check
  console.log("\nSample 10 international players:");
  for (const r of wpRows.slice(0, 10)) {
    console.log(`- ${r.Player} (${r.Club}, ${r.Competition}): Conf=${r.Confidence}, S1=${r["Source 1"] || "NONE"}`);
  }
}

if (require.main === module || process.argv[1]?.endsWith("audit-coverage.ts")) {
  auditInternationalAndCoverage();
}
