import fs from "node:fs";
import path from "node:path";

const DATA_ROOT = "C:/DEV/WORKTREES/handball-manager/hm-player-verification-2026-27/data/real-world/sweden/2026-27";
const APP_DIR = "C:/DEV/WORKTREES/handball-manager/hm-player-verification-2026-27/apps/game";
const CORRECTIONS_PATH = path.join(APP_DIR, "lib/gameWorld/realWorldRosterCorrections.ts");

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, data: any): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function applyOwnerDecisions() {
  console.log("==========================================================");
  console.log("APPLYING OWNER BATCH 1-2 DECISIONS");
  console.log("==========================================================");

  // ---------------------------------------------------------------------
  // 1. Malte Månsson: GF Kroppskultur -> HK Malmö
  // ---------------------------------------------------------------------
  console.log("\n1. Malte Månsson: GF Kroppskultur -> HK Malmö");
  const kroppsDir = path.join(DATA_ROOT, "allsvenskan/GF Kroppskultur");
  const malmoDir = path.join(DATA_ROOT, "handbollsligan/HK Malmö");

  const kroppsPlayers = readJson(path.join(kroppsDir, "players-gf_kroppskultur.json"));
  const kroppsRoster = readJson(path.join(kroppsDir, "roster-gf_kroppskultur-2026-27.json"));
  const malmoPlayers = readJson(path.join(malmoDir, "players-hk-malmo.json"));
  const malmoRoster = readJson(path.join(malmoDir, "roster-hk-malmo-2026-27.json"));

  const malteIdx = kroppsPlayers.findIndex((p: any) => p.playerId === "player_malte_mansson_1d49a03b");
  if (malteIdx !== -1) {
    const maltePlayer = kroppsPlayers.splice(malteIdx, 1)[0];
    const malteRosterIdx = kroppsRoster.findIndex((r: any) => r.playerId === "player_malte_mansson_1d49a03b");
    if (malteRosterIdx !== -1) kroppsRoster.splice(malteRosterIdx, 1);

    writeJson(path.join(kroppsDir, "players-gf_kroppskultur.json"), kroppsPlayers);
    writeJson(path.join(kroppsDir, "roster-gf_kroppskultur-2026-27.json"), kroppsRoster);

    // Update Malte's player record for HK Malmö
    maltePlayer.aliases = Array.from(new Set([...(maltePlayer.aliases || []), "player_malte_mansson_8e1ed1df"]));
    maltePlayer.dataNotes = [
      ...(maltePlayer.dataNotes || []),
      "HM-PLAYER-DATABASE-2026-27 (2026-11-05): Transferred from GF Kroppskultur to HK Malmö for season 2026/27 (Profixio player 648609). Previous club: GF Kroppskultur.",
    ];

    if (!malmoPlayers.some((p: any) => p.playerId === "player_malte_mansson_1d49a03b")) {
      malmoPlayers.push(maltePlayer);
      writeJson(path.join(malmoDir, "players-hk-malmo.json"), malmoPlayers);
    }

    if (!malmoRoster.some((r: any) => r.playerId === "player_malte_mansson_1d49a03b")) {
      malmoRoster.push({
        rosterEntryId: "se_2026_27_handbollsligan_hkmalmo_1d49a03b",
        playerId: "player_malte_mansson_1d49a03b",
        clubId: "se_club_hk_malmo",
        competitionId: "se_handbollsligan_herr",
        season: "2026/27",
        snapshotDate: "2026-11-05",
        shirtNumber: 9,
        sourcePosition: "H9",
        primaryPosition: "H9",
        secondaryPositions: [],
        rosterStatus: "CONFIRMED",
        contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
        rosterConfidence: "VERIFIED",
        sourceRefs: {
          roster: ["src_profixio_roster_2026_27"],
          position: ["src_profixio_roster_2026_27"],
        },
        dataNotes: [
          "2026/27 official Handbollsligan registration at HK Malmö (Profixio player 648609). Transferred from GF Kroppskultur.",
        ],
        defaultSquadStatus: null,
        specialTags: [],
      });
      writeJson(path.join(malmoDir, "roster-hk-malmo-2026-27.json"), malmoRoster);
    }

    // Move rating overrides and review notes
    const kroppsOverrides = readJson(path.join(kroppsDir, "rating-overrides.json"));
    const malmoOverrides = readJson(path.join(malmoDir, "rating-overrides.json"));
    if (kroppsOverrides["player_malte_mansson_1d49a03b"]) {
      malmoOverrides["player_malte_mansson_1d49a03b"] = kroppsOverrides["player_malte_mansson_1d49a03b"];
      delete kroppsOverrides["player_malte_mansson_1d49a03b"];
      writeJson(path.join(kroppsDir, "rating-overrides.json"), kroppsOverrides);
      writeJson(path.join(malmoDir, "rating-overrides.json"), malmoOverrides);
    }

    const kroppsReview = readJson(path.join(kroppsDir, "rating-review.json"));
    const malmoReview = readJson(path.join(malmoDir, "rating-review.json"));
    if (kroppsReview["player_malte_mansson_1d49a03b"]) {
      malmoReview["player_malte_mansson_1d49a03b"] = kroppsReview["player_malte_mansson_1d49a03b"];
      delete kroppsReview["player_malte_mansson_1d49a03b"];
      writeJson(path.join(kroppsDir, "rating-review.json"), kroppsReview);
      writeJson(path.join(malmoDir, "rating-review.json"), malmoReview);
    }

    // Move locked rating record
    const kroppsRatingsPath = path.join(DATA_ROOT, "allsvenskan/ratings/swe2-kroppskultur.json");
    const malmoRatingsPath = path.join(DATA_ROOT, "handbollsligan/ratings/se_club_hk_malmo.json");
    const kroppsRatings = readJson(kroppsRatingsPath);
    const malmoRatings = readJson(malmoRatingsPath);
    if (kroppsRatings["player_malte_mansson_1d49a03b"]) {
      const record = kroppsRatings["player_malte_mansson_1d49a03b"];
      record.clubId = "se_club_hk_malmo";
      malmoRatings["player_malte_mansson_1d49a03b"] = record;
      delete kroppsRatings["player_malte_mansson_1d49a03b"];
      writeJson(kroppsRatingsPath, kroppsRatings);
      writeJson(malmoRatingsPath, malmoRatings);
    }

    console.log("  -> Successfully transferred Malte Månsson to HK Malmö (#9, H9).");
  } else {
    // Check if locked rating record still needs moving
    const kroppsRatingsPath = path.join(DATA_ROOT, "allsvenskan/ratings/swe2-kroppskultur.json");
    const malmoRatingsPath = path.join(DATA_ROOT, "handbollsligan/ratings/se_club_hk_malmo.json");
    if (fs.existsSync(kroppsRatingsPath)) {
      const kroppsRatings = readJson(kroppsRatingsPath);
      if (kroppsRatings["player_malte_mansson_1d49a03b"]) {
        const malmoRatings = readJson(malmoRatingsPath);
        const record = kroppsRatings["player_malte_mansson_1d49a03b"];
        record.clubId = "se_club_hk_malmo";
        malmoRatings["player_malte_mansson_1d49a03b"] = record;
        delete kroppsRatings["player_malte_mansson_1d49a03b"];
        writeJson(kroppsRatingsPath, kroppsRatings);
        writeJson(malmoRatingsPath, malmoRatings);
        console.log("  -> Moved locked rating for Malte Månsson to HK Malmö.");
      }
    }
    console.log("  -> Malte Månsson already at HK Malmö or not in Kroppskultur.");
  }

  // ---------------------------------------------------------------------
  // 2. Emil Arthursson: HF Karlskrona -> H43 Lund HF
  // ---------------------------------------------------------------------
  console.log("\n2. Emil Arthursson: HF Karlskrona -> H43 Lund HF");
  const karlskronaDir = path.join(DATA_ROOT, "handbollsligan/HF Karlskrona");
  const h43Dir = path.join(DATA_ROOT, "allsvenskan/H43 Lund HF");

  const karlskronaPlayers = readJson(path.join(karlskronaDir, "players-hf-karlskrona.json"));
  const karlskronaRoster = readJson(path.join(karlskronaDir, "roster-hf-karlskrona-2026-27.json"));
  const h43Players = readJson(path.join(h43Dir, "players-h43_lund_hf.json"));

  const emilKarlskronaIdx = karlskronaPlayers.findIndex((p: any) => p.playerId === "se_player_emil_arthursson_db40e94c");
  if (emilKarlskronaIdx !== -1) {
    karlskronaPlayers.splice(emilKarlskronaIdx, 1);
    const emilRosterIdx = karlskronaRoster.findIndex((r: any) => r.playerId === "se_player_emil_arthursson_db40e94c");
    if (emilRosterIdx !== -1) karlskronaRoster.splice(emilRosterIdx, 1);

    writeJson(path.join(karlskronaDir, "players-hf-karlskrona.json"), karlskronaPlayers);
    writeJson(path.join(karlskronaDir, "roster-hf-karlskrona-2026-27.json"), karlskronaRoster);

    // Remove obsolete override from Karlskrona
    const karlskronaOverrides = readJson(path.join(karlskronaDir, "rating-overrides.json"));
    if (karlskronaOverrides["se_player_emil_arthursson_db40e94c"]) {
      delete karlskronaOverrides["se_player_emil_arthursson_db40e94c"];
      writeJson(path.join(karlskronaDir, "rating-overrides.json"), karlskronaOverrides);
    }
    const karlskronaReview = readJson(path.join(karlskronaDir, "rating-review.json"));
    if (karlskronaReview["se_player_emil_arthursson_db40e94c"]) {
      delete karlskronaReview["se_player_emil_arthursson_db40e94c"];
      writeJson(path.join(karlskronaDir, "rating-review.json"), karlskronaReview);
    }

    // Remove obsolete locked rating from Karlskrona
    const karlskronaRatingsPath = path.join(DATA_ROOT, "handbollsligan/ratings/se_club_hf_karlskrona.json");
    const karlskronaRatings = readJson(karlskronaRatingsPath);
    if (karlskronaRatings["se_player_emil_arthursson_db40e94c"]) {
      delete karlskronaRatings["se_player_emil_arthursson_db40e94c"];
      writeJson(karlskronaRatingsPath, karlskronaRatings);
    }

    // Update H43 Lund record
    const h43Player = h43Players.find((p: any) => p.playerId === "se_player_emil_arthursson_e99d2749");
    if (h43Player) {
      h43Player.aliases = Array.from(new Set([...(h43Player.aliases || []), "se_player_emil_arthursson_db40e94c"]));
      h43Player.dataNotes = [
        ...(h43Player.dataNotes || []),
        "HM-PLAYER-DATABASE-2026-27 (2026-11-05): Historical registration at HF Karlskrona consolidated into active 2026/27 squad at H43 Lund HF (#12, MV).",
      ];
      writeJson(path.join(h43Dir, "players-h43_lund_hf.json"), h43Players);
    }

    console.log("  -> Successfully consolidated Emil Arthursson to H43 Lund HF; removed Karlskrona placeholder.");
  } else {
    const karlskronaRatingsPath = path.join(DATA_ROOT, "handbollsligan/ratings/se_club_hf_karlskrona.json");
    if (fs.existsSync(karlskronaRatingsPath)) {
      const karlskronaRatings = readJson(karlskronaRatingsPath);
      if (karlskronaRatings["se_player_emil_arthursson_db40e94c"]) {
        delete karlskronaRatings["se_player_emil_arthursson_db40e94c"];
        writeJson(karlskronaRatingsPath, karlskronaRatings);
        console.log("  -> Deleted retired Emil Arthursson record from Karlskrona locked ratings.");
      }
    }
    console.log("  -> Karlskrona placeholder already removed.");
  }

  // ---------------------------------------------------------------------
  // 3. Adam Füle: Kungälvs HK -> HP Warta
  // ---------------------------------------------------------------------
  console.log("\n3. Adam Füle: Kungälvs HK -> HP Warta");
  const kungalvDir = path.join(DATA_ROOT, "allsvenskan/Kungälvs HK");
  const wartaDir = path.join(DATA_ROOT, "division1-sodra/HP Warta");

  const kungalvPlayers = readJson(path.join(kungalvDir, "players-kungalvs_hk.json"));
  const wartaPlayers = readJson(path.join(wartaDir, "players-hp_warta.json"));
  const wartaRoster = readJson(path.join(wartaDir, "roster-hp_warta-2026-27.json"));

  const fuleIdx = kungalvPlayers.findIndex((p: any) => p.playerId === "se_player_adam_fule_5020dcbf");
  if (fuleIdx !== -1) {
    const fulePlayer = kungalvPlayers.splice(fuleIdx, 1)[0];
    writeJson(path.join(kungalvDir, "players-kungalvs_hk.json"), kungalvPlayers);

    fulePlayer.dataNotes = [
      ...(fulePlayer.dataNotes || []),
      "HM-PLAYER-DATABASE-2026-27 (2026-11-05): Transferred from Kungälvs HK to HP Warta for season 2026/27 (Profixio official roster). Previous club: Kungälvs HK.",
    ];

    if (!wartaPlayers.some((p: any) => p.playerId === "se_player_adam_fule_5020dcbf")) {
      wartaPlayers.push(fulePlayer);
      writeJson(path.join(wartaDir, "players-hp_warta.json"), wartaPlayers);
    }

    if (!wartaRoster.some((r: any) => r.playerId === "se_player_adam_fule_5020dcbf")) {
      wartaRoster.push({
        rosterEntryId: "se_2026_27_division1_sodra_hp_warta__5020dcbf",
        playerId: "se_player_adam_fule_5020dcbf",
        clubId: "se_club_hp_warta",
        competitionId: "se_division1_sodra",
        season: "2026/27",
        snapshotDate: "2026-11-05",
        shirtNumber: null,
        sourcePosition: "M9",
        primaryPosition: "M9",
        secondaryPositions: [],
        rosterStatus: "CONFIRMED",
        contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
        rosterConfidence: "VERIFIED",
        sourceRefs: {
          roster: ["src_profixio_roster_2026_27"],
          position: ["src_profixio_roster_2026_27"],
        },
        dataNotes: [
          "2026/27 Division 1 Södra official registration at HP Warta. Transferred from Kungälvs HK.",
        ],
        defaultSquadStatus: null,
        specialTags: [],
      });
      writeJson(path.join(wartaDir, "roster-hp_warta-2026-27.json"), wartaRoster);
    }

    // Move overrides
    const kungalvOverrides = readJson(path.join(kungalvDir, "rating-overrides.json"));
    const wartaOverrides = readJson(path.join(wartaDir, "rating-overrides.json"));
    if (kungalvOverrides["se_player_adam_fule_5020dcbf"]) {
      wartaOverrides["se_player_adam_fule_5020dcbf"] = kungalvOverrides["se_player_adam_fule_5020dcbf"];
      delete kungalvOverrides["se_player_adam_fule_5020dcbf"];
      writeJson(path.join(kungalvDir, "rating-overrides.json"), kungalvOverrides);
      writeJson(path.join(wartaDir, "rating-overrides.json"), wartaOverrides);
    }

    const kungalvReview = readJson(path.join(kungalvDir, "rating-review.json"));
    const wartaReview = readJson(path.join(wartaDir, "rating-review.json"));
    if (kungalvReview["se_player_adam_fule_5020dcbf"]) {
      wartaReview["se_player_adam_fule_5020dcbf"] = kungalvReview["se_player_adam_fule_5020dcbf"];
      delete kungalvReview["se_player_adam_fule_5020dcbf"];
      writeJson(path.join(kungalvDir, "rating-review.json"), kungalvReview);
      writeJson(path.join(wartaDir, "rating-review.json"), wartaReview);
    }

    // Move locked rating record
    const kungalvRatingsPath = path.join(DATA_ROOT, "allsvenskan/ratings/swe2-kungalv.json");
    const wartaRatingsPath = path.join(DATA_ROOT, "division1-sodra/ratings/se_club_hp_warta.json");
    const kungalvRatings = readJson(kungalvRatingsPath);
    const wartaRatings = readJson(wartaRatingsPath);
    if (kungalvRatings["se_player_adam_fule_5020dcbf"]) {
      const record = kungalvRatings["se_player_adam_fule_5020dcbf"];
      record.clubId = "se_club_hp_warta";
      wartaRatings["se_player_adam_fule_5020dcbf"] = record;
      delete kungalvRatings["se_player_adam_fule_5020dcbf"];
      writeJson(kungalvRatingsPath, kungalvRatings);
      writeJson(wartaRatingsPath, wartaRatings);
    }

    console.log("  -> Successfully transferred Adam Füle to HP Warta (M9).");
  } else {
    const kungalvRatingsPath = path.join(DATA_ROOT, "allsvenskan/ratings/swe2-kungalv.json");
    const wartaRatingsPath = path.join(DATA_ROOT, "division1-sodra/ratings/se_club_hp_warta.json");
    if (fs.existsSync(kungalvRatingsPath)) {
      const kungalvRatings = readJson(kungalvRatingsPath);
      if (kungalvRatings["se_player_adam_fule_5020dcbf"]) {
        const wartaRatings = readJson(wartaRatingsPath);
        const record = kungalvRatings["se_player_adam_fule_5020dcbf"];
        record.clubId = "se_club_hp_warta";
        wartaRatings["se_player_adam_fule_5020dcbf"] = record;
        delete kungalvRatings["se_player_adam_fule_5020dcbf"];
        writeJson(kungalvRatingsPath, kungalvRatings);
        writeJson(wartaRatingsPath, wartaRatings);
        console.log("  -> Moved locked rating for Adam Füle to HP Warta.");
      }
    }
    console.log("  -> Adam Füle already transferred or not in Kungälv.");
  }

  // ---------------------------------------------------------------------
  // 4. Theodor Kapnias Olsson: Redbergslids IK -> Kärra HF
  // ---------------------------------------------------------------------
  console.log("\n4. Theodor Kapnias Olsson: Redbergslids IK -> Kärra HF");
  const rikDir = path.join(DATA_ROOT, "allsvenskan/Redbergslids IK");
  const karraDir = path.join(DATA_ROOT, "division1-sodra/Kärra HF");

  const rikPlayers = readJson(path.join(rikDir, "players-redbergslids_ik.json"));
  const rikRoster = readJson(path.join(rikDir, "roster-redbergslids_ik-2026-27.json"));
  const karraPlayers = readJson(path.join(karraDir, "players-karra_hf.json"));
  const karraRoster = readJson(path.join(karraDir, "roster-karra_hf-2026-27.json"));

  const theodorIdx = rikPlayers.findIndex((p: any) => p.playerId === "se_player_theodor_kapnias_olsson_60beed3c");
  if (theodorIdx !== -1) {
    const theodorPlayer = rikPlayers.splice(theodorIdx, 1)[0];
    const theodorRosterIdx = rikRoster.findIndex((r: any) => r.playerId === "se_player_theodor_kapnias_olsson_60beed3c");
    if (theodorRosterIdx !== -1) rikRoster.splice(theodorRosterIdx, 1);

    writeJson(path.join(rikDir, "players-redbergslids_ik.json"), rikPlayers);
    writeJson(path.join(rikDir, "roster-redbergslids_ik-2026-27.json"), rikRoster);

    theodorPlayer.dataNotes = [
      ...(theodorPlayer.dataNotes || []),
      "HM-PLAYER-DATABASE-2026-27 (2026-11-05): Transferred from Redbergslids IK to Kärra HF for season 2026/27 (Profixio official roster). Previous club: Redbergslids IK.",
    ];

    if (!karraPlayers.some((p: any) => p.playerId === "se_player_theodor_kapnias_olsson_60beed3c")) {
      karraPlayers.push(theodorPlayer);
      writeJson(path.join(karraDir, "players-karra_hf.json"), karraPlayers);
    }

    if (!karraRoster.some((r: any) => r.playerId === "se_player_theodor_kapnias_olsson_60beed3c")) {
      karraRoster.push({
        rosterEntryId: "se_2026_27_division1_sodra_karra_hf__60beed3c",
        playerId: "se_player_theodor_kapnias_olsson_60beed3c",
        clubId: "se_club_karra_hf",
        competitionId: "se_division1_sodra",
        season: "2026/27",
        snapshotDate: "2026-11-05",
        shirtNumber: 19,
        sourcePosition: "V9",
        primaryPosition: "V9",
        secondaryPositions: [],
        rosterStatus: "CONFIRMED",
        contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
        rosterConfidence: "VERIFIED",
        sourceRefs: {
          roster: ["src_profixio_roster_2026_27"],
          position: ["src_profixio_roster_2026_27"],
        },
        dataNotes: [
          "2026/27 Division 1 Södra official registration at Kärra HF. Transferred from Redbergslids IK.",
        ],
        defaultSquadStatus: null,
        specialTags: [],
      });
      writeJson(path.join(karraDir, "roster-karra_hf-2026-27.json"), karraRoster);
    }

    // Move overrides
    const rikOverrides = readJson(path.join(rikDir, "rating-overrides.json"));
    const karraOverrides = readJson(path.join(karraDir, "rating-overrides.json"));
    if (rikOverrides["se_player_theodor_kapnias_olsson_60beed3c"]) {
      karraOverrides["se_player_theodor_kapnias_olsson_60beed3c"] = rikOverrides["se_player_theodor_kapnias_olsson_60beed3c"];
      delete rikOverrides["se_player_theodor_kapnias_olsson_60beed3c"];
      writeJson(path.join(rikDir, "rating-overrides.json"), rikOverrides);
      writeJson(path.join(karraDir, "rating-overrides.json"), karraOverrides);
    }

    const rikReview = readJson(path.join(rikDir, "rating-review.json"));
    const karraReview = readJson(path.join(karraDir, "rating-review.json"));
    if (rikReview["se_player_theodor_kapnias_olsson_60beed3c"]) {
      karraReview["se_player_theodor_kapnias_olsson_60beed3c"] = rikReview["se_player_theodor_kapnias_olsson_60beed3c"];
      delete rikReview["se_player_theodor_kapnias_olsson_60beed3c"];
      writeJson(path.join(rikDir, "rating-review.json"), rikReview);
      writeJson(path.join(karraDir, "rating-review.json"), karraReview);
    }

    // Move locked rating record
    const rikRatingsPath = path.join(DATA_ROOT, "allsvenskan/ratings/swe2-redbergslid.json");
    const karraRatingsPath = path.join(DATA_ROOT, "division1-sodra/ratings/se_club_karra_hf.json");
    const rikRatings = readJson(rikRatingsPath);
    const karraRatings = readJson(karraRatingsPath);
    if (rikRatings["se_player_theodor_kapnias_olsson_60beed3c"]) {
      const record = rikRatings["se_player_theodor_kapnias_olsson_60beed3c"];
      record.clubId = "se_club_karra_hf";
      karraRatings["se_player_theodor_kapnias_olsson_60beed3c"] = record;
      delete rikRatings["se_player_theodor_kapnias_olsson_60beed3c"];
      writeJson(rikRatingsPath, rikRatings);
      writeJson(karraRatingsPath, karraRatings);
    }

    console.log("  -> Successfully transferred Theodor Kapnias Olsson to Kärra HF (#19, V9).");
  } else {
    const rikRatingsPath = path.join(DATA_ROOT, "allsvenskan/ratings/swe2-redbergslid.json");
    const karraRatingsPath = path.join(DATA_ROOT, "division1-sodra/ratings/se_club_karra_hf.json");
    if (fs.existsSync(rikRatingsPath)) {
      const rikRatings = readJson(rikRatingsPath);
      if (rikRatings["se_player_theodor_kapnias_olsson_60beed3c"]) {
        const karraRatings = readJson(karraRatingsPath);
        const record = rikRatings["se_player_theodor_kapnias_olsson_60beed3c"];
        record.clubId = "se_club_karra_hf";
        karraRatings["se_player_theodor_kapnias_olsson_60beed3c"] = record;
        delete rikRatings["se_player_theodor_kapnias_olsson_60beed3c"];
        writeJson(rikRatingsPath, rikRatings);
        writeJson(karraRatingsPath, karraRatings);
        console.log("  -> Moved locked rating for Theodor Kapnias Olsson to Kärra HF.");
      }
    }
    console.log("  -> Theodor Kapnias Olsson already transferred or not in RIK.");
  }

  // ---------------------------------------------------------------------
  // 5. Update realWorldRosterCorrections.ts
  // ---------------------------------------------------------------------
  console.log("\n5. Updating realWorldRosterCorrections.ts");
  let correctionsCode = fs.readFileSync(CORRECTIONS_PATH, "utf8");

  // Remove Malte Månsson from RELOCATED_TO_ALLSVENSKAN
  correctionsCode = correctionsCode.replace(
    /\{\s*playerId:\s*"player_malte_mansson_1d49a03b",\s*fromCompetitionId:\s*"se_handbollsligan_herr",\s*toClubId:\s*"swe2-kroppskultur"\s*\},\r?\n/,
    ""
  );

  // Add Emil Arthursson to MERGED_IDENTITIES if not present
  if (!correctionsCode.includes("se_player_emil_arthursson_db40e94c")) {
    correctionsCode = correctionsCode.replace(
      /export const MERGED_IDENTITIES: readonly \{ retiredPlayerId: string; canonicalPlayerId: string; clubId: string \}\[\] = \[/,
      `export const MERGED_IDENTITIES: readonly { retiredPlayerId: string; canonicalPlayerId: string; clubId: string }[] = [\n  { retiredPlayerId: "se_player_emil_arthursson_db40e94c", canonicalPlayerId: "se_player_emil_arthursson_e99d2749", clubId: "swe2-h43lund" },`
    );
  }

  // Remove Adam Füle from REMOVED_MEMBERSHIPS if present
  correctionsCode = correctionsCode.replace(
    /\{\s*playerId:\s*"se_player_adam_fule_5020dcbf",\s*clubId:\s*"swe2-kungalv"\s*\},\r?\n/,
    ""
  );

  fs.writeFileSync(CORRECTIONS_PATH, correctionsCode, "utf8");
  console.log("  -> realWorldRosterCorrections.ts updated.");

  console.log("\nAll 4 owner-approved decisions applied cleanly.");
}

if (require.main === module || process.argv[1]?.endsWith("apply-owner-decisions.ts")) {
  applyOwnerDecisions();
}
