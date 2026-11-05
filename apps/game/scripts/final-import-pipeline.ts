import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const APP_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APP_DIR, "../..");
const DATA_ROOT = path.join(REPO_ROOT, "data/real-world");
const SWEDEN_DIR = path.join(DATA_ROOT, "sweden/2026-27");
const REPORT_DIR = "C:/DEV/QA/reports/HM-PLAYER-DATABASE-2026-27";

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
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = row[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

function escapeCsv(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

interface ClubMapping {
  dir: string;
  tier: string;
  playerFile: string;
  rosterFile: string;
}

function getClubMap(): Record<string, ClubMapping> {
  const tiers = ["handbollsligan", "allsvenskan", "division1-norra", "division1-sodra"];
  const map: Record<string, ClubMapping> = {};

  for (const tier of tiers) {
    const tierDir = path.join(SWEDEN_DIR, tier);
    if (!fs.existsSync(tierDir)) continue;
    for (const clubFolder of fs.readdirSync(tierDir)) {
      const clubDir = path.join(tierDir, clubFolder);
      if (!fs.statSync(clubDir).isDirectory()) continue;
      if (["identity", "ratings", "fixtures"].includes(clubFolder)) continue;

      const files = fs.readdirSync(clubDir);
      const playerFile = files.find((f) => f.startsWith("players-") && f.endsWith(".json"));
      const rosterFile = files.find((f) => f.startsWith("roster-") && f.endsWith(".json"));

      if (playerFile && rosterFile) {
        map[clubFolder] = { dir: clubDir, tier, playerFile, rosterFile };
      }
    }
  }

  return map;
}

export function executeFinalImport() {
  console.log("==========================================================");
  console.log("HM PLAYER DATABASE 2026/27 — FINAL IMPORT PIPELINE");
  console.log("==========================================================");

  // 1. Load and triage new players
  const newPlayersPath = path.join(REPORT_DIR, "new-players.csv");
  const newPlayers = parseCsv(fs.readFileSync(newPlayersPath, "utf8"));
  console.log(`Loaded ${newPlayers.length} proposed new player records`);

  const uniqueAdditions: typeof newPlayers = [];
  const deferredToReview: typeof newPlayers = [];

  for (const p of newPlayers) {
    if (p.existsInOtherClub === "YES") {
      deferredToReview.push(p);
    } else {
      uniqueAdditions.push(p);
    }
  }

  console.log(`- Unique, source-supported additions to import: ${uniqueAdditions.length}`);
  console.log(`- Ambiguous identities deferred to owner review: ${deferredToReview.length}`);
  for (const d of deferredToReview) {
    console.log(`  * Deferred: ${d.fullName} (${d.clubName}, ${d.competition}) - exists in another club`);
  }

  // 2. Map clubs
  const clubMap = getClubMap();
  console.log(`Mapped ${Object.keys(clubMap).length} real-world club directories.`);

  // 3. Process the 85 verified additions
  let newlyImportedPlayers = 0;
  let alreadyImportedPlayers = 0;
  let newlyImportedRosters = 0;
  let alreadyImportedRosters = 0;

  for (const p of uniqueAdditions) {
    const club = clubMap[p.clubName];
    if (!club) {
      throw new Error(`Club directory not found for: ${p.clubName}`);
    }

    const playerFilePath = path.join(club.dir, club.playerFile);
    const rosterFilePath = path.join(club.dir, club.rosterFile);

    const playersData = JSON.parse(fs.readFileSync(playerFilePath, "utf8"));
    const rosterData = JSON.parse(fs.readFileSync(rosterFilePath, "utf8"));

    // Name split
    const nameParts = p.fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    // Check if club uses se_player_ convention
    const useSePrefix = playersData.some((pl: any) => pl.playerId.startsWith("se_player_"));
    const actualPlayerId = (useSePrefix && p.proposedPlayerId.startsWith("player_"))
      ? p.proposedPlayerId.replace(/^player_/, "se_player_")
      : p.proposedPlayerId;

    // Check if player already exists in playersData
    const existingPlayer = playersData.find((pl: any) =>
      pl.playerId === actualPlayerId ||
      pl.playerId === p.proposedPlayerId ||
      (pl.fullName?.toLowerCase() === p.fullName?.toLowerCase() &&
       pl.birthYear === parseInt(p.birthYear, 10))
    );

    if (!existingPlayer) {
      const newPlayerObj = {
        playerId: actualPlayerId,
        firstName,
        lastName,
        fullName: p.fullName,
        aliases: [],
        dateOfBirth: p.dateOfBirth || (p.birthYear ? `${p.birthYear}-01-01` : null),
        birthYear: p.birthYear ? parseInt(p.birthYear, 10) : null,
        nationalities: ["SE"],
        heightCm: null,
        handedness: null,
        recordConfidence: "VERIFIED",
        fieldConfidence: {
          dateOfBirth: p.dateOfBirth ? "VERIFIED" : "UNVERIFIED",
        },
        sourceRefs: {
          identity: ["src_profixio_roster_2026_27"],
          dateOfBirth: ["src_profixio_roster_2026_27"],
        },
        dataNotes: [
          "HM-PLAYER-DATABASE-2026-27: Imported verified player from official Profixio 2026/27 competition roster.",
        ],
      };
      playersData.push(newPlayerObj);
      fs.writeFileSync(playerFilePath, JSON.stringify(playersData, null, 2) + "\n", "utf8");
      newlyImportedPlayers++;
    } else {
      alreadyImportedPlayers++;
    }

    // Check if player already exists in rosterData
    const existingRoster = rosterData.find((r: any) => r.playerId === actualPlayerId || r.playerId === p.proposedPlayerId);
    if (!existingRoster) {
      // derive sample clubId, compId, and entryId prefix from existing roster entries
      const sampleEntry = rosterData[0];
      const clubId = sampleEntry?.clubId || p.clubId;
      const competitionId = sampleEntry?.competitionId || p.competitionId;

      let entryPrefix = "se_2026_27";
      if (sampleEntry?.rosterEntryId) {
        const parts = sampleEntry.rosterEntryId.split("__");
        if (parts.length > 1) {
          entryPrefix = parts[0];
        } else {
          entryPrefix = sampleEntry.rosterEntryId.replace(/_[a-f0-9]+$/, "");
        }
      }

      const hashSuffix = actualPlayerId.split("_").pop() ||
        crypto.createHash("md5").update(actualPlayerId).digest("hex").slice(0, 8);
      const rosterEntryId = `${entryPrefix}__${hashSuffix}`;

      const newRosterObj = {
        rosterEntryId,
        playerId: actualPlayerId,
        clubId,
        competitionId,
        season: "2026/27",
        snapshotDate: "2026-11-05",
        shirtNumber: p.shirtNumber ? parseInt(p.shirtNumber, 10) : null,
        sourcePosition: p.primaryPosition,
        primaryPosition: p.primaryPosition,
        secondaryPositions: [],
        rosterStatus: "CONFIRMED",
        contract: {
          untilDate: null,
          untilSeason: null,
          optionUntilSeason: null,
        },
        rosterConfidence: "VERIFIED",
        sourceRefs: {
          roster: ["src_profixio_roster_2026_27"],
          position: ["src_profixio_roster_2026_27"],
        },
        dataNotes: [
          "HM-PLAYER-DATABASE-2026-27: Imported verified squad member for 2026/27 season.",
        ],
        defaultSquadStatus: null,
        specialTags: [],
      };
      rosterData.push(newRosterObj);
      fs.writeFileSync(rosterFilePath, JSON.stringify(rosterData, null, 2) + "\n", "utf8");
      newlyImportedRosters++;
    } else {
      alreadyImportedRosters++;
    }
  }

  console.log(`\nImport Summary:`);
  console.log(`- Newly imported players to identity files: ${newlyImportedPlayers}`);
  console.log(`- Already present players in identity files: ${alreadyImportedPlayers}`);
  console.log(`- Newly imported roster entries: ${newlyImportedRosters}`);
  console.log(`- Already present roster entries: ${alreadyImportedRosters}`);

  // 4. Update quarantined-players.csv (Zero quarantined!)
  console.log("\n=== STEP 2: CORRECT STATUS CLASSIFICATION ===");
  console.log("- Policy: Missing DOB or nationality alone must never trigger quarantine.");
  console.log("- Policy: Unresolved players remain UNVERIFIED; active youth and reserves preserved.");
  console.log("- Result: 0 players quarantined.");

  const quarantinedHeader = "playerId,fullName,clubId,clubName,competitionId,position,birthYear,reason,quarantineDate,reversible\n";
  fs.writeFileSync(path.join(REPORT_DIR, "quarantined-players.csv"), quarantinedHeader, "utf8");

  // 5. Generate owner-review-workflow.csv
  console.log("\n=== STEP 3: PREPARING OWNER REVIEW WORKFLOW ===");
  generateOwnerReviewWorkflow(deferredToReview);

  // 6. Regenerate player inventory
  console.log("\n=== STEP 4: REGENERATING PLAYER INVENTORY ===");
  generateUpdatedPlayerInventory();

  console.log("\nImport pipeline completed successfully.");
}

function generateOwnerReviewWorkflow(deferredNewPlayers: Record<string, string>[]) {
  const dupPath = path.join(REPORT_DIR, "duplicate-candidates.csv");
  const manPath = path.join(REPORT_DIR, "manual-review.csv");

  const duplicates = fs.existsSync(dupPath) ? parseCsv(fs.readFileSync(dupPath, "utf8")) : [];
  const manual = fs.existsSync(manPath) ? parseCsv(fs.readFileSync(manPath, "utf8")) : [];

  interface ReviewItem {
    batch: string;
    priority: string;
    playerId: string;
    player: string;
    currentInformation: string;
    proposedCorrection: string;
    evidence: string;
    conflictDescription: string;
    recommendedAction: string;
    decision: string;
  }

  const items: ReviewItem[] = [];

  // Batch 1: Identity conflicts & duplicates (Priority 1)
  // Deferred new additions
  for (const d of deferredNewPlayers) {
    items.push({
      batch: "Batch 1: Identity Conflicts & Duplicates",
      priority: "Priority 1",
      playerId: d.proposedPlayerId,
      player: d.fullName,
      currentInformation: `Proposed for ${d.clubName} (${d.competition}), pos: ${d.primaryPosition}, DOB: ${d.dateOfBirth}`,
      proposedCorrection: `Disambiguate from existing player with identical name in another club`,
      evidence: d.sourceUrl || "Profixio 2026/27 official roster",
      conflictDescription: `Multi-club name collision: Player with same name already exists in database at another club`,
      recommendedAction: "DEFER_FOR_OWNER_CONFIRMATION",
      decision: "DEFER",
    });
  }

  // Duplicates from duplicate-candidates.csv
  for (const dup of duplicates) {
    items.push({
      batch: "Batch 1: Identity Conflicts & Duplicates",
      priority: "Priority 1",
      playerId: dup.playerIds,
      player: dup.fullName,
      currentInformation: `Clubs: ${dup.clubs} | DOBs: ${dup.dobs} | Pos: ${dup.positions}`,
      proposedCorrection: dup.verdict === "POTENTIAL_DUPLICATE_SAME_PERSON" ? "Merge records if confirmed same person" : "Retain distinct stable IDs",
      evidence: dup.evidence,
      conflictDescription: dup.verdict,
      recommendedAction: dup.action,
      decision: dup.verdict === "POTENTIAL_DUPLICATE_SAME_PERSON" ? "DEFER" : "APPROVE",
    });
  }

  // Add any Category A from manual review
  for (const m of manual) {
    if (m.category?.startsWith("A.")) {
      items.push({
        batch: "Batch 1: Identity Conflicts & Duplicates",
        priority: "Priority 1",
        playerId: m.playerId,
        player: m.suggestedName || m.nameInGame,
        currentInformation: `In game: ${m.nameInGame} at ${m.currentGameClub} (${m.currentPosition})`,
        proposedCorrection: m.recommendedAction,
        evidence: m.sources,
        conflictDescription: m.exactConflict,
        recommendedAction: m.recommendedAction,
        decision: "DEFER",
      });
    }
  }

  // Batch 2: Confirmed club changes requiring approval (Priority 2)
  for (const m of manual) {
    if (m.category?.startsWith("C.")) {
      items.push({
        batch: "Batch 2: Confirmed Club Changes",
        priority: "Priority 2",
        playerId: m.playerId,
        player: m.suggestedName || m.nameInGame,
        currentInformation: `In game: club=${m.currentGameClub}, pos=${m.currentPosition}`,
        proposedCorrection: `Transfer to ${m.suggestedClub}`,
        evidence: m.sources,
        conflictDescription: m.exactConflict,
        recommendedAction: m.recommendedAction,
        decision: "DEFER",
      });
    }
  }

  // Batch 3: Handbollsligan and Allsvenskan uncertainties (Priority 3)
  for (const m of manual) {
    const isTier12 =
      m.currentGameClub.includes("Malmö") ||
      m.currentGameClub.includes("Kristianstad") ||
      m.currentGameClub.includes("Sävehof") ||
      m.currentGameClub.includes("Ystads") ||
      m.currentGameClub.includes("Alingsås") ||
      m.currentGameClub.includes("Guif") ||
      m.currentGameClub.includes("H43") ||
      m.currentGameClub.includes("Karlskrona") ||
      m.currentGameClub.includes("Lugi") ||
      m.currentGameClub.includes("Önnereds") ||
      m.currentGameClub.includes("Skånela") ||
      m.currentGameClub.includes("Hammarby") ||
      m.currentGameClub.includes("Hallby") ||
      m.currentGameClub.includes("Amo") ||
      m.currentGameClub.includes("OV Helsingborg") ||
      m.currentGameClub.includes("Huddinge") ||
      m.currentGameClub.includes("Kungälvs") ||
      m.currentGameClub.includes("Redbergslids") ||
      m.currentGameClub.includes("Tyresö") ||
      m.currentGameClub.includes("VästeråsIrsta") ||
      m.currentGameClub.includes("Aranäs") ||
      m.currentGameClub.includes("Drott") ||
      m.currentGameClub.includes("Torslanda") ||
      m.currentGameClub.includes("Varberg") ||
      m.currentGameClub.includes("Tumba");

    if (!m.category?.startsWith("A.") && !m.category?.startsWith("C.") && isTier12) {
      items.push({
        batch: "Batch 3: Handbollsligan & Allsvenskan Uncertainties",
        priority: "Priority 3",
        playerId: m.playerId,
        player: m.suggestedName || m.nameInGame,
        currentInformation: `Club: ${m.currentGameClub}, pos: ${m.currentPosition}, DOB: ${m.birthYear}`,
        proposedCorrection: m.recommendedAction,
        evidence: m.sources,
        conflictDescription: m.exactConflict,
        recommendedAction: m.recommendedAction.includes("quarantine") ? "KEEP_UNVERIFIED_IN_SQUAD" : m.recommendedAction,
        decision: "DEFER",
      });
    }
  }

  // Batch 4: Division 1 uncertainties (Priority 4)
  for (const m of manual) {
    const isTier3 =
      m.currentGameClub.includes("Boden") ||
      m.currentGameClub.includes("Enköping") ||
      m.currentGameClub.includes("Cliff") ||
      m.currentGameClub.includes("Eskil") ||
      m.currentGameClub.includes("Bolton") ||
      m.currentGameClub.includes("Lindesberg") ||
      m.currentGameClub.includes("Rimbo") ||
      m.currentGameClub.includes("RP IF") ||
      m.currentGameClub.includes("Sannadal") ||
      m.currentGameClub.includes("Täby") ||
      m.currentGameClub.includes("Uppsala") ||
      m.currentGameClub.includes("Örebro") ||
      m.currentGameClub.includes("Anderstorp") ||
      m.currentGameClub.includes("Eslöv") ||
      m.currentGameClub.includes("Country") ||
      m.currentGameClub.includes("S-hof") ||
      m.currentGameClub.includes("Önnerediterna") ||
      m.currentGameClub.includes("HP Alingsås") ||
      m.currentGameClub.includes("Warta") ||
      m.currentGameClub.includes("IF Kristianstad") ||
      m.currentGameClub.includes("Lågan") ||
      m.currentGameClub.includes("Kärra") ||
      m.currentGameClub.includes("Vinslöv") ||
      m.currentGameClub.includes("Åhus");

    if (!m.category?.startsWith("A.") && !m.category?.startsWith("C.") && isTier3) {
      items.push({
        batch: "Batch 4: Division 1 Uncertainties",
        priority: "Priority 4",
        playerId: m.playerId,
        player: m.suggestedName || m.nameInGame,
        currentInformation: `Club: ${m.currentGameClub}, pos: ${m.currentPosition}, DOB: ${m.birthYear}`,
        proposedCorrection: m.recommendedAction,
        evidence: m.sources,
        conflictDescription: m.exactConflict,
        recommendedAction: m.recommendedAction.includes("quarantine") ? "KEEP_UNVERIFIED_IN_SQUAD" : m.recommendedAction,
        decision: "DEFER",
      });
    }
  }

  // Batch 5: Remaining international and inactive-status cases (Priority 5)
  for (const m of manual) {
    const isTier12 =
      m.currentGameClub.includes("Malmö") ||
      m.currentGameClub.includes("Kristianstad") ||
      m.currentGameClub.includes("Sävehof") ||
      m.currentGameClub.includes("Ystads") ||
      m.currentGameClub.includes("Alingsås") ||
      m.currentGameClub.includes("Guif") ||
      m.currentGameClub.includes("H43") ||
      m.currentGameClub.includes("Karlskrona") ||
      m.currentGameClub.includes("Lugi") ||
      m.currentGameClub.includes("Önnereds") ||
      m.currentGameClub.includes("Skånela") ||
      m.currentGameClub.includes("Hammarby") ||
      m.currentGameClub.includes("Hallby") ||
      m.currentGameClub.includes("Amo") ||
      m.currentGameClub.includes("OV Helsingborg") ||
      m.currentGameClub.includes("Huddinge") ||
      m.currentGameClub.includes("Kungälvs") ||
      m.currentGameClub.includes("Redbergslids") ||
      m.currentGameClub.includes("Tyresö") ||
      m.currentGameClub.includes("VästeråsIrsta") ||
      m.currentGameClub.includes("Aranäs") ||
      m.currentGameClub.includes("Drott") ||
      m.currentGameClub.includes("Torslanda") ||
      m.currentGameClub.includes("Varberg") ||
      m.currentGameClub.includes("Tumba");

    const isTier3 =
      m.currentGameClub.includes("Boden") ||
      m.currentGameClub.includes("Enköping") ||
      m.currentGameClub.includes("Cliff") ||
      m.currentGameClub.includes("Eskil") ||
      m.currentGameClub.includes("Bolton") ||
      m.currentGameClub.includes("Lindesberg") ||
      m.currentGameClub.includes("Rimbo") ||
      m.currentGameClub.includes("RP IF") ||
      m.currentGameClub.includes("Sannadal") ||
      m.currentGameClub.includes("Täby") ||
      m.currentGameClub.includes("Uppsala") ||
      m.currentGameClub.includes("Örebro") ||
      m.currentGameClub.includes("Anderstorp") ||
      m.currentGameClub.includes("Eslöv") ||
      m.currentGameClub.includes("Country") ||
      m.currentGameClub.includes("S-hof") ||
      m.currentGameClub.includes("Önnerediterna") ||
      m.currentGameClub.includes("HP Alingsås") ||
      m.currentGameClub.includes("Warta") ||
      m.currentGameClub.includes("IF Kristianstad") ||
      m.currentGameClub.includes("Lågan") ||
      m.currentGameClub.includes("Kärra") ||
      m.currentGameClub.includes("Vinslöv") ||
      m.currentGameClub.includes("Åhus");

    if (!m.category?.startsWith("A.") && !m.category?.startsWith("C.") && !isTier12 && !isTier3) {
      items.push({
        batch: "Batch 5: International & Inactive Cases",
        priority: "Priority 5",
        playerId: m.playerId,
        player: m.suggestedName || m.nameInGame,
        currentInformation: `Club: ${m.currentGameClub}, pos: ${m.currentPosition}, DOB: ${m.birthYear}`,
        proposedCorrection: m.recommendedAction,
        evidence: m.sources,
        conflictDescription: m.exactConflict,
        recommendedAction: m.recommendedAction.includes("quarantine") ? "KEEP_UNVERIFIED" : m.recommendedAction,
        decision: "DEFER",
      });
    }
  }

  // Write CSV
  const header = "batch,priority,playerId,player,currentInformation,proposedCorrection,evidence,conflictDescription,recommendedAction,decision\n";
  const rows = items.map((i) =>
    [
      escapeCsv(i.batch),
      escapeCsv(i.priority),
      escapeCsv(i.playerId),
      escapeCsv(i.player),
      escapeCsv(i.currentInformation),
      escapeCsv(i.proposedCorrection),
      escapeCsv(i.evidence),
      escapeCsv(i.conflictDescription),
      escapeCsv(i.recommendedAction),
      escapeCsv(i.decision),
    ].join(",")
  );

  const outPath = path.join(REPORT_DIR, "owner-review-workflow.csv");
  fs.writeFileSync(outPath, header + rows.join("\n") + "\n", "utf8");
  console.log(`Generated owner-review-workflow.csv with ${items.length} items across 5 priority batches.`);

  // Print summary by batch
  const batchCounts: Record<string, number> = {};
  for (const it of items) {
    batchCounts[it.batch] = (batchCounts[it.batch] || 0) + 1;
  }
  for (const [b, c] of Object.entries(batchCounts)) {
    console.log(`  * ${b}: ${c} items`);
  }
}

function generateUpdatedPlayerInventory() {
  const allPlayers: any[] = [];
  const seenPlayerIds = new Set<string>();

  function scanDataDir(baseDir: string, isIntl: boolean) {
    if (!fs.existsSync(baseDir)) return;
    for (const group of fs.readdirSync(baseDir)) {
      const groupDir = path.join(baseDir, group);
      if (!fs.statSync(groupDir).isDirectory()) continue;
      if (["identity", "ratings", "fixtures"].includes(group)) continue;

      for (const clubFolder of fs.readdirSync(groupDir)) {
        const clubDir = path.join(groupDir, clubFolder);
        if (!fs.statSync(clubDir).isDirectory()) continue;
        if (["identity", "ratings", "fixtures"].includes(clubFolder)) continue;

        const files = fs.readdirSync(clubDir);
        const pf = files.find((f) => f.startsWith("players-") && f.endsWith(".json"));
        const rf = files.find((f) => f.startsWith("roster-") && f.endsWith(".json"));
        if (!pf) continue;

        const pData = JSON.parse(fs.readFileSync(path.join(clubDir, pf), "utf8"));
        const rData = rf ? JSON.parse(fs.readFileSync(path.join(clubDir, rf), "utf8")) : [];

        const rosterByPlayer = new Map<string, any>();
        for (const r of rData) {
          rosterByPlayer.set(r.playerId, r);
        }

        for (const pl of pData) {
          const roster = rosterByPlayer.get(pl.playerId);
          const isYouth = pl.birthYear && pl.birthYear >= 2008;
          const isReserveClub = ["HK Cliff", "HK S-hof", "HK Önnerediterna", "HP Alingsås", "IF Kristianstad"].includes(clubFolder);

          let status = "ACTIVE_SENIOR";
          if (isYouth) {
            status = "ACTIVE_YOUTH";
          } else if (isReserveClub) {
            status = "ACTIVE_RESERVE";
          } else if (isIntl) {
            status = "ACTIVE_SENIOR";
          }

          allPlayers.push({
            playerId: pl.playerId,
            fullName: pl.fullName,
            firstName: pl.firstName,
            lastName: pl.lastName,
            dateOfBirth: pl.dateOfBirth || "",
            birthYear: pl.birthYear || "",
            nationalities: (pl.nationalities || []).join(";"),
            clubName: clubFolder,
            tier: group,
            position: roster?.primaryPosition || "",
            shirtNumber: roster?.shirtNumber || "",
            status,
            recordConfidence: pl.recordConfidence || "VERIFIED",
            isCanonical: true,
          });
          seenPlayerIds.add(pl.playerId);
        }
      }
    }
  }

  scanDataDir(SWEDEN_DIR, false);
  scanDataDir(path.join(DATA_ROOT, "international/2026-27"), true);

  console.log(`Total canonical real-world players: ${allPlayers.length}`);

  // CSV output
  const header = "playerId,fullName,firstName,lastName,dateOfBirth,birthYear,nationalities,clubName,tier,position,shirtNumber,status,recordConfidence,isCanonical\n";
  const rows = allPlayers.map((p) =>
    [
      escapeCsv(p.playerId),
      escapeCsv(p.fullName),
      escapeCsv(p.firstName),
      escapeCsv(p.lastName),
      escapeCsv(p.dateOfBirth),
      escapeCsv(p.birthYear),
      escapeCsv(p.nationalities),
      escapeCsv(p.clubName),
      escapeCsv(p.tier),
      escapeCsv(p.position),
      escapeCsv(p.shirtNumber),
      escapeCsv(p.status),
      escapeCsv(p.recordConfidence),
      escapeCsv("YES"),
    ].join(",")
  );

  fs.writeFileSync(path.join(REPORT_DIR, "player-inventory.csv"), header + rows.join("\n") + "\n", "utf8");
  console.log(`Updated player-inventory.csv with ${allPlayers.length} canonical records.`);
}

if (require.main === module || process.argv[1]?.endsWith("final-import-pipeline.ts")) {
  executeFinalImport();
}
