import fs from "node:fs";
import path from "node:path";
import { buildCatalog, findClubById } from "../lib/editor/catalog";
import { loadRatingDatabase, lockPlayerRating, unlockPlayerRating } from "../lib/editor/ratingDatabaseRepository";
import { setRatingOverride, loadRatingOverrideState } from "../lib/editor/ratingOverrideRepository";
import { setReviewStatus, loadRatingReviewState } from "../lib/editor/ratingReviewRepository";
import { atomicWriteJsonFile } from "../lib/editor/atomicWrite";
import { generatePlayerRatingProfile } from "../lib/rating/generation/generationEngine";
import { GENERATION_MODEL_VERSION } from "../lib/rating/generation/types";

const REPORT_DIR = "C:/DEV/QA/reports/HM-CA-PA-CALIBRATION-2026-27";
const DATA_ROOT = path.resolve(__dirname, "../../..");

console.log("=== PHASE 2C CLOSEOUT: EXECUTING OWNER DECISIONS & EVIDENCE GATE ===");

const catalog = buildCatalog();

// -------------------------------------------------------------------
// 1. REVERT UNSUPPORTED EXPERIMENTAL RATINGS (PHASE 2C EVIDENCE GATE)
// -------------------------------------------------------------------
console.log("\n1. Reverting Unsupported Experimental Ratings...");

// A. Emil Hovgaard Pedersen (den1-bjerringbro): PA 142 -> 158 (CA 105 kept)
console.log("  - Emil Hovgaard Pedersen: restoring PA to 158 (CA 105)");
const bshClub = findClubById(catalog, "den1-bjerringbro")!;
const bshRatings = loadRatingDatabase("den1-bjerringbro");
const bshEmil = bshRatings["player_intl_emil_hovgaard_pedersen_a169f355"];
if (bshEmil) {
  bshEmil.pa = {
    value: 158,
    confidence: "MEDIUM",
    plausibleRange: { min: 158, max: 158 },
    source: "EDITOR_OVERRIDE",
  };
  bshEmil.lockedNote = "HM-PHASE-2C (2026-11-05): reverted unsupported PA deflation; restored pre-calibration PA 158 (CA 105).";
  lockPlayerRating("den1-bjerringbro", bshEmil);
  setRatingOverride({ clubId: "den1-bjerringbro", playerId: "player_intl_emil_hovgaard_pedersen_a169f355", position: "GK", ca: 105, pa: 158 });
  setReviewStatus("den1-bjerringbro", "player_intl_emil_hovgaard_pedersen_a169f355", "LOCKED", "HM-PHASE-2C: restored pre-calibration PA 158.");
}

// B. Alvin Sundström (swe2-kroppskultur): PA 126 -> 158 (CA 91 kept)
console.log("  - Alvin Sundström: restoring PA to 158 (CA 91)");
const kroppsClub = findClubById(catalog, "swe2-kroppskultur")!;
const kroppsRatings = loadRatingDatabase("swe2-kroppskultur");
const kroppsAlvin = kroppsRatings["se_player_alvin_sundstrom_733a7887"];
if (kroppsAlvin) {
  kroppsAlvin.pa = {
    value: 158,
    confidence: "LOW",
    plausibleRange: { min: 158, max: 158 },
    source: "EDITOR_OVERRIDE",
  };
  kroppsAlvin.lockedNote = "HM-PHASE-2C (2026-11-05): reverted unsupported PA deflation; restored pre-calibration PA 158 (CA 91).";
  lockPlayerRating("swe2-kroppskultur", kroppsAlvin);
  setRatingOverride({ clubId: "swe2-kroppskultur", playerId: "se_player_alvin_sundstrom_733a7887", position: "GK", ca: 91, pa: 158 });
  setReviewStatus("swe2-kroppskultur", "se_player_alvin_sundstrom_733a7887", "LOCKED", "HM-PHASE-2C: restored pre-calibration PA 158.");
}

// C. Love Ljungqvist (swe2-kroppskultur): PA 128 -> 160 (CA 92 kept)
console.log("  - Love Ljungqvist: restoring PA to 160 (CA 92)");
const kroppsLove = kroppsRatings["se_player_love_ljungqvist_3f94aca6"];
if (kroppsLove) {
  kroppsLove.pa = {
    value: 160,
    confidence: "LOW",
    plausibleRange: { min: 160, max: 160 },
    source: "EDITOR_OVERRIDE",
  };
  kroppsLove.lockedNote = "HM-PHASE-2C (2026-11-05): reverted unsupported PA deflation; restored pre-calibration PA 160 (CA 92).";
  lockPlayerRating("swe2-kroppskultur", kroppsLove);
  setRatingOverride({ clubId: "swe2-kroppskultur", playerId: "se_player_love_ljungqvist_3f94aca6", position: "V6", ca: 92, pa: 160 });
  setReviewStatus("swe2-kroppskultur", "se_player_love_ljungqvist_3f94aca6", "LOCKED", "HM-PHASE-2C: restored pre-calibration PA 160.");
}

// D. Adam Füle (se_club_hp_warta): CA 108 retained; PA 130 -> 149
console.log("  - Adam Füle: retaining CA 108, restoring PA to 149");
const wartaClub = findClubById(catalog, "se_club_hp_warta")!;
const wartaRatings = loadRatingDatabase("se_club_hp_warta");
const wartaFule = wartaRatings["se_player_adam_fule_5020dcbf"];
if (wartaFule) {
  wartaFule.ca.value = 108;
  wartaFule.pa = {
    value: 149,
    confidence: "HIGH",
    plausibleRange: { min: 149, max: 149 },
    source: "EDITOR_OVERRIDE",
  };
  wartaFule.lockedNote = "HM-PHASE-2C (2026-11-05): retained calibrated CA 108; restored pre-calibration PA 149.";
  lockPlayerRating("se_club_hp_warta", wartaFule);
  setRatingOverride({ clubId: "se_club_hp_warta", playerId: "se_player_adam_fule_5020dcbf", position: "M9", ca: 108, pa: 149 });
  setReviewStatus("se_club_hp_warta", "se_player_adam_fule_5020dcbf", "LOCKED", "HM-PHASE-2C: CA 108 retained, restored PA 149.");
}

// -------------------------------------------------------------------
// 2. OWNER DECISION: MARKUS STEGEFELT (RETIRED)
// -------------------------------------------------------------------
console.log("\n2. Executing Owner Decision: Markus Stegefelt (Retirement)...");
const rpClub = findClubById(catalog, "se_club_rp_if_linkoping")!;

// Remove from active roster
const rpRosterPath = rpClub.rosterFile;
const rpRoster = JSON.parse(fs.readFileSync(rpRosterPath, "utf8")) as any[];
const filteredRpRoster = rpRoster.filter((r) => r.playerId !== "player_markus_stegefelt_8aedec38");
fs.writeFileSync(rpRosterPath, JSON.stringify(filteredRpRoster, null, 2) + "\n", "utf8");
console.log(`  - Removed Markus Stegefelt from active roster (${rpRoster.length} -> ${filteredRpRoster.length} players).`);

// Update players file with retirement note
const rpPlayersPath = rpClub.playersFile;
const rpPlayers = JSON.parse(fs.readFileSync(rpPlayersPath, "utf8")) as any[];
const stegefeltPlayer = rpPlayers.find((p) => p.playerId === "player_markus_stegefelt_8aedec38");
if (stegefeltPlayer) {
  stegefeltPlayer.dataNotes = stegefeltPlayer.dataNotes || [];
  stegefeltPlayer.dataNotes.push("HM-OWNER-DECISION (2026-11-05): roster membership at RP IF Linköping removed -- owner confirmed player has stopped playing (retired); identity and historical records retained.");
  fs.writeFileSync(rpPlayersPath, JSON.stringify(rpPlayers, null, 2) + "\n", "utf8");
  console.log("  - Appended retirement note to Markus Stegefelt player identity.");
}

// Restore pre-calibration rating CA 146 / PA 146
const rpRatings = loadRatingDatabase("se_club_rp_if_linkoping");
const rpStegefelt = rpRatings["player_markus_stegefelt_8aedec38"];
if (rpStegefelt) {
  rpStegefelt.ca.value = 146;
  rpStegefelt.ca.plausibleRange = { min: 146, max: 146 };
  rpStegefelt.pa = {
    value: 146,
    confidence: "HIGH",
    plausibleRange: { min: 146, max: 146 },
    source: "EDITOR_OVERRIDE",
  };
  rpStegefelt.lockedNote = "HM-OWNER-DECISION (2026-11-05): player retired; restored pre-calibration CA 146 / PA 146 historical record.";
  lockPlayerRating("se_club_rp_if_linkoping", rpStegefelt);
  setRatingOverride({ clubId: "se_club_rp_if_linkoping", playerId: "player_markus_stegefelt_8aedec38", position: "V9", ca: 146, pa: 146 });
  setReviewStatus("se_club_rp_if_linkoping", "player_markus_stegefelt_8aedec38", "LOCKED", "HM-OWNER-DECISION: retired player historical record (CA 146 / PA 146).");
  console.log("  - Restored Markus Stegefelt historical rating to CA 146 / PA 146.");
}

// -------------------------------------------------------------------
// 3. OWNER DECISION: OSKAR ALF DAHLIN (CANONICAL UNIFICATION)
// -------------------------------------------------------------------
console.log("\n3. Executing Owner Decision: Oskar Alf Dahlin (Canonical Unification)...");
// Canonical identity: se_player_oskar_dahlin_50f8181d (Alingsås HK)
// Duplicate to remove from Alingsås HK active roster: se_player_oskar_alf_dahlin_591a8ba2
// Duplicate to remove from HP Alingsås active roster: player_oskar_alf_dahlin_29d39f91

const ahkClub = findClubById(catalog, "se_club_alingsas_hk")!;
const hpClub = findClubById(catalog, "se_club_hp_alingsas")!;

// A. Alingsås HK: remove ghost se_player_oskar_alf_dahlin_591a8ba2 from active roster
const ahkRosterPath = ahkClub.rosterFile;
const ahkRoster = JSON.parse(fs.readFileSync(ahkRosterPath, "utf8")) as any[];
const filteredAhkRoster = ahkRoster.filter((r) => r.playerId !== "se_player_oskar_alf_dahlin_591a8ba2");
fs.writeFileSync(ahkRosterPath, JSON.stringify(filteredAhkRoster, null, 2) + "\n", "utf8");
console.log(`  - Removed duplicate Oskar Alf Dahlin from Alingsås HK active roster (${ahkRoster.length} -> ${filteredAhkRoster.length} players).`);

// B. Alingsås HK: update canonical identity name to "Oskar Alf Dahlin", add alias "Oskar Dahlin"
const ahkPlayersPath = ahkClub.playersFile;
const ahkPlayers = JSON.parse(fs.readFileSync(ahkPlayersPath, "utf8")) as any[];
const canonicalOskar = ahkPlayers.find((p) => p.playerId === "se_player_oskar_dahlin_50f8181d");
if (canonicalOskar) {
  canonicalOskar.fullName = "Oskar Alf Dahlin";
  canonicalOskar.lastName = "Alf Dahlin";
  if (!canonicalOskar.aliases.includes("Oskar Dahlin")) {
    canonicalOskar.aliases.push("Oskar Dahlin");
  }
  canonicalOskar.dataNotes = canonicalOskar.dataNotes || [];
  canonicalOskar.dataNotes.push("HM-OWNER-DECISION (2026-11-05): confirmed as canonical identity for Oskar Alf Dahlin (primary club Alingsås HK, farm team HP Alingsås). Merged duplicate identities se_player_oskar_alf_dahlin_591a8ba2 and player_oskar_alf_dahlin_29d39f91.");
}
const duplicateAhkOskar = ahkPlayers.find((p) => p.playerId === "se_player_oskar_alf_dahlin_591a8ba2");
if (duplicateAhkOskar) {
  duplicateAhkOskar.dataNotes = duplicateAhkOskar.dataNotes || [];
  duplicateAhkOskar.dataNotes.push("HM-OWNER-DECISION (2026-11-05): duplicate registration merged into canonical identity se_player_oskar_dahlin_50f8181d.");
}
fs.writeFileSync(ahkPlayersPath, JSON.stringify(ahkPlayers, null, 2) + "\n", "utf8");
console.log("  - Updated canonical Oskar Alf Dahlin identity with full name, alias, and merge history.");

// C. HP Alingsås: remove player_oskar_alf_dahlin_29d39f91 from active roster
const hpRosterPath = hpClub.rosterFile;
const hpRoster = JSON.parse(fs.readFileSync(hpRosterPath, "utf8")) as any[];
const filteredHpRoster = hpRoster.filter((r) => r.playerId !== "player_oskar_alf_dahlin_29d39f91");
fs.writeFileSync(hpRosterPath, JSON.stringify(filteredHpRoster, null, 2) + "\n", "utf8");
console.log(`  - Removed duplicate Oskar Alf Dahlin from HP Alingsås active roster (${hpRoster.length} -> ${filteredHpRoster.length} players).`);

// D. HP Alingsås: record merge on player record
const hpPlayersPath = hpClub.playersFile;
const hpPlayers = JSON.parse(fs.readFileSync(hpPlayersPath, "utf8")) as any[];
const hpOskar = hpPlayers.find((p) => p.playerId === "player_oskar_alf_dahlin_29d39f91");
if (hpOskar) {
  hpOskar.dataNotes = hpOskar.dataNotes || [];
  hpOskar.dataNotes.push("HM-OWNER-DECISION (2026-11-05): duplicate Division 1 identity of se_player_oskar_dahlin_50f8181d (Alingsås HK). Removed from HP Alingsås roster -- player belongs to senior parent club Alingsås HK with farm-team (HP Alingsås) affiliation.");
  fs.writeFileSync(hpPlayersPath, JSON.stringify(hpPlayers, null, 2) + "\n", "utf8");
  console.log("  - Recorded farm-team affiliation and canonical merge note on HP Alingsås player record.");
}

// E. HP Alingsås: remove experimental rating lock for player_oskar_alf_dahlin_29d39f91
unlockPlayerRating("se_club_hp_alingsas", "player_oskar_alf_dahlin_29d39f91");

// Remove from rating-overrides.json and rating-review.json
const hpOverrides = loadRatingOverrideState("se_club_hp_alingsas");
delete hpOverrides["player_oskar_alf_dahlin_29d39f91"];
atomicWriteJsonFile(path.join(hpClub.clubDir, "rating-overrides.json"), hpOverrides);

const hpReviews = loadRatingReviewState("se_club_hp_alingsas");
delete hpReviews["player_oskar_alf_dahlin_29d39f91"];
atomicWriteJsonFile(path.join(hpClub.clubDir, "rating-review.json"), hpReviews);
console.log("  - Removed experimental rating records for player_oskar_alf_dahlin_29d39f91 from HP Alingsås.");

console.log("\n=== PHASE 2C CLOSEOUT EXECUTION COMPLETE ===");
