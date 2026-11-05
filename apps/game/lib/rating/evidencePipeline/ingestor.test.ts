import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EvidenceIngestor } from "./ingestor";
import { runSourceAudit } from "./sourceAudit";

describe("Evidence Pipeline Ingestor", () => {
  const ingestor = new EvidenceIngestor();
  const evidenceMap = ingestor.ingestAll();

  it("ingests evidence for all 1,380 canonical real-world players", () => {
    assert.equal(evidenceMap.size, 1380);
  });

  it("attaches official league season stats to Handbollsligan starters", () => {
    // August Wiger
    const wiger = evidenceMap.get("se_player_august_wiger_94e4bcd0");
    assert.ok(wiger, "August Wiger must exist in evidence map");
    assert.equal(wiger.sourceQuality, "OFFICIAL_LEAGUE_STATS");
    assert.equal(wiger.verifiedFacts.appearances, 19);
    assert.equal(wiger.verifiedFacts.goals, 78);
    assert.equal(wiger.verifiedFacts.assists, 57);
    assert.equal(wiger.verifiedFacts.technicalErrors, 41);
    assert.equal(wiger.verifiedFacts.suspensions, 3);
    assert.ok(wiger.completenessScore >= 0.8);
  });

  it("attaches official match protocols to Allsvenskan players", () => {
    // Carl Rydén (played 2025/26 in Allsvenskan)
    const ryden = evidenceMap.get("se_player_carl_ryden_d5428e1f");
    assert.ok(ryden, "Carl Rydén must exist in evidence map");
    assert.equal(ryden.sourceQuality, "OFFICIAL_MATCH_PROTOCOLS");
    assert.equal(ryden.verifiedFacts.appearances, 26);
    assert.equal(ryden.verifiedFacts.goals, 146);
    assert.equal(ryden.verifiedFacts.suspensions, 4);
  });

  it("attaches goalkeeper shot-stopping metrics where recorded", () => {
    // Search for any goalkeeper with saves
    const gksWithSaves = Array.from(evidenceMap.values()).filter(
      (e) => e.verifiedFacts.shotsFaced !== null && e.verifiedFacts.shotsFaced > 0
    );
    assert.ok(gksWithSaves.length > 0, "Must have goalkeepers with verified shots faced");
    for (const gk of gksWithSaves) {
      assert.ok(gk.verifiedFacts.saves !== null);
      assert.ok(gk.verifiedFacts.savePercentage !== null);
      assert.ok(gk.verifiedFacts.savePercentage >= 0 && gk.verifiedFacts.savePercentage <= 100);
    }
  });

  it("never invents missing statistics (unrecorded fields are null)", () => {
    const unresearched = Array.from(evidenceMap.values()).find(
      (e) => e.sourceQuality === "UNRESEARCHED_PRIOR"
    );
    assert.ok(unresearched, "Must have unresearched priors");
    assert.equal(unresearched.verifiedFacts.appearances, null);
    assert.equal(unresearched.verifiedFacts.goals, null);
    assert.equal(unresearched.verifiedFacts.saves, null);
    assert.ok(unresearched.unverifiedClaims.length > 0);
  });

  it("runs source audit and generates valid summary metrics", () => {
    const summary = runSourceAudit();
    assert.equal(summary.totalPlayers, 1380);
    assert.ok(summary.withMatchAppearances > 400);
    assert.ok(summary.withScoringEvidence > 350);
    assert.ok(summary.averageCompleteness >= 0.5);
  });
});
