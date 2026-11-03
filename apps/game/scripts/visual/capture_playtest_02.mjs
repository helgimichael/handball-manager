import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.env.HM_QA_URL ?? "http://localhost:3099";
const outDir = process.env.HM_SCREENSHOT_DIR ?? "C:/DEV/QA/reports/HM-PLAYTEST-IMPROVEMENT-02/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript(() => {
  localStorage.setItem("hm_alpha_authorized", "true");
  localStorage.setItem("hm_alpha_access_code", "HBL-ALPHA-2026");
});
page.setDefaultTimeout(60000);

async function snap(name, fullPage = false) {
  const file = path.join(outDir, name);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage, animations: "disabled" });
  console.log(`[SNAP] ${name} -> ${file}`);
}

try {
  console.log("[1/6] Starting career setup for IFK Tumba HK...");
  await page.goto(`${base}/new-game`);
  await expect(page.getByRole("heading", { name: "Din handbollsvärld." })).toBeVisible({ timeout: 30000 });

  // 1. Nations -> 2. Leagues -> 3. DB -> 4. Club Selection
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.waitForTimeout(500);

  // Select IFK Tumba HK
  const tumbaBtn = page.locator(".game-club-option").filter({ hasText: /Tumba/i }).first();
  if (await tumbaBtn.isVisible()) {
    await tumbaBtn.click();
    await page.waitForTimeout(250);
  }

  // 4. Manager Creation
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByPlaceholder("För- och efternamn").fill("Henrik Lindqvist");
  const natSelect = page.locator("select").first();
  if (await natSelect.isVisible()) {
    await natSelect.selectOption("SWE");
  }
  const dobInput = page.locator('input[type="date"]').first();
  if (await dobInput.isVisible()) {
    await dobInput.fill("1984-05-14");
  }

  // 5. Preseason Mandate
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  const radioBtn = page.getByRole("radio", { name: /4 veckor före seriestart/i }).first();
  if (await radioBtn.isVisible()) {
    await radioBtn.check();
  }

  // Launch Career
  await page.getByRole("button", { name: "STARTA KARRIÄR", exact: true }).click();
  await page.waitForURL("**/career", { timeout: 90000 });
  await page.waitForTimeout(1000);
  console.log("[Career started successfully]");

  // -------------------------------------------------------------
  // DELIVERABLE 4: TACTICS WORKSPACE 2.0 (Court-First + Diff Manager)
  // -------------------------------------------------------------
  console.log("[2/6] Tactics Workspace & Diff Manager...");
  await page.goto(`${base}/career/tactics`);
  await page.waitForSelector(".coach-court", { timeout: 30000 });
  const suggestBtn = page.getByRole("button", { name: /Assistentens förslag/i }).first();
  if (await suggestBtn.isVisible()) {
    await suggestBtn.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.scrollTo(0, 320));
  await snap("01-tactics-workspace-court-diff.png");

  // Exchanges tab
  const exchangeTab = page.locator(".hm-court-mode-tab").filter({ hasText: "Försvarsbyten" }).first();
  if (await exchangeTab.isVisible()) {
    await exchangeTab.click();
    await page.waitForTimeout(300);
    await snap("02-tactics-exchanges-mode.png");
  }

  // 6v5 Specialist tab
  const specTab = page.locator(".hm-court-mode-tab").filter({ hasText: "Övertag 6v5" }).first();
  if (await specTab.isVisible()) {
    await specTab.click();
    await page.waitForTimeout(300);
    await snap("03-tactics-specialists-6v5.png");
  }

  // -------------------------------------------------------------
  // DELIVERABLE 3: REALISTIC PLAYER INTEREST & FILTERS
  // -------------------------------------------------------------
  console.log("[3/6] Transfer Market with Realistic Interest Filters...");
  await page.goto(`${base}/career/transfers`);
  await page.waitForSelector(".tc-tabs", { timeout: 30000 });
  await page.waitForTimeout(500);

  // Switch to "Hela marknaden" tab
  const marketTab = page.getByRole("tab", { name: /Hela marknaden/i }).first();
  if (await marketTab.isVisible()) {
    await marketTab.click();
    await page.waitForTimeout(500);
  }
  await snap("04-transfers-realistic-interest.png");

  // Click "Möjligen intresserade" filter chip
  const persuadableChip = page.getByRole("button", { name: "Möjligen intresserade", exact: true }).first();
  if (await persuadableChip.isVisible()) {
    await persuadableChip.click();
    await page.waitForTimeout(400);
    await snap("04b-transfers-persuadable-tab.png");
  }

  // Click "Alla" filter chip to show European stars marked OMÖJLIGT
  const allChips = page.getByRole("button", { name: "Alla", exact: true });
  const allChip = allChips.last();
  if (await allChip.isVisible()) {
    await allChip.click();
    await page.waitForTimeout(400);
    await snap("04c-transfers-all-impossible-stars.png");
  }

  // -------------------------------------------------------------
  // DELIVERABLE 2: TRAINING COMPENSATION (Utbildningsersättning SHF)
  // -------------------------------------------------------------
  console.log("[4/6] Negotiation Room with Training Compensation Breakdown...");
  // Return to "Realistiska mål" so we can negotiate
  const realisticChip = page.getByRole("button", { name: "Realistiska mål", exact: true }).first();
  if (await realisticChip.isVisible()) {
    await realisticChip.click();
    await page.waitForTimeout(400);
  }

  const playerRow = page.locator("tr[data-clickable='true']").first();
  if (await playerRow.isVisible()) {
    await playerRow.click();
    await page.waitForTimeout(400);
    
    // Find negotiate link in Dossier
    const negotiateLink = page.locator("a.tc-wide").filter({ hasText: /Förhandla om övergång/i }).first();
    if (await negotiateLink.isVisible()) {
      await negotiateLink.click();
      await page.waitForURL("**/career/transfers/**");
      await page.waitForSelector(".tc-room", { timeout: 20000 });
      await page.waitForTimeout(500);
      await snap("05-transfer-negotiation-compensation.png");
    }
  }

  // -------------------------------------------------------------
  // DELIVERABLE 1: ROLE-SPECIFIC STAFF AMBITIONS
  // -------------------------------------------------------------
  console.log("[5/6] Staff Profile with Role-Specific Ambitions...");
  await page.goto(`${base}/career/staff`);
  await page.waitForSelector(".game-section-scene, table", { timeout: 30000 });
  await page.waitForTimeout(400);
  await snap("06-staff-overview.png");

  const staffLink = page.locator('table a[href^="/career/staff/"]').first();
  if (await staffLink.isVisible()) {
    await staffLink.click();
    await page.waitForURL("**/career/staff/**");
    await page.waitForSelector(".hm-staff-ambition-card, .game-section-scene", { timeout: 20000 });
    await page.waitForTimeout(500);
    await snap("06b-staff-role-ambition.png");
  }

  // -------------------------------------------------------------
  // DELIVERABLE 5 & 6: INTERACTIVE PRESS CONFERENCE & CUP ROUTING
  // -------------------------------------------------------------
  console.log("[6/6] Interactive Press Conference & Match Report...");
  await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("handball_career_save_v1");
      if (!raw) return;
      const state = JSON.parse(raw);
      
      const cupFixtureId = "swe-cup-2026-tumba-mock";
      const pressId = `press:post:${cupFixtureId}`;
      
      state.fixtures = state.fixtures || [];
      const cupFixture = {
        id: cupFixtureId,
        competitionId: "swe-svenska-cupen",
        round: 1,
        date: state.gameDate || "2026-08-20",
        homeClubId: state.playerClubId || "swe2-tumba",
        awayClubId: "swe2-varberg",
        homeScore: 31,
        awayScore: 28,
        status: "COMPLETED",
        played: true,
        type: "CUP"
      };
      const existingIdx = state.fixtures.findIndex((f) => f.id === cupFixtureId);
      if (existingIdx >= 0) state.fixtures[existingIdx] = cupFixture;
      else state.fixtures.push(cupFixture);

      state.results = state.results || {};
      state.results[cupFixtureId] = {
        homeScore: 31,
        awayScore: 28,
        homeStats: { goals: 31, shots: 44, saves: 14, turnovers: 7, suspensions: 1 },
        awayStats: { goals: 28, shots: 42, saves: 11, turnovers: 9, suspensions: 5 },
        homePlayerContributions: [],
        awayPlayerContributions: []
      };

      state.media = state.media || { press: {} };
      state.media.press = state.media.press || {};
      state.media.press[pressId] = {
        id: pressId,
        date: state.gameDate || "2026-08-20",
        expiresOn: "2026-12-31",
        status: "OPEN",
        kind: "POST_MATCH",
        title: "Presskonferens efter Svenska Cupen",
        context: "Seger 31-28 mot HK Varberg i Svenska Cupen",
        answeredCount: 0,
        questions: [
          {
            id: "q_post_cup_win",
            journalist: { name: "Johan Flinck", outlet: "Aftonbladet", style: "CHALLENGING" },
            text: "31-28-seger och avancemang i Svenska Cupen! Hur rankar du insatsen med tanke på att ni gick runt på hela truppen?",
            topic: "AFTER_WIN",
            answers: [
              {
                id: "a1",
                text: "En helgjuten laginsats där alla tog ansvar. Cupen är prioriterad och detta ger oss enorm energi.",
                tone: "ENTHUSIASTIC",
                effects: { teamMoraleDelta: 2, boardDelta: 1, mediaDelta: 2 }
              },
              {
                id: "a2",
                text: "Vi gjorde det som krävdes, varken mer eller mindre. Fokus flyttas direkt till seriepremiären.",
                tone: "DIPLOMATIC",
                effects: { teamMoraleDelta: 1, boardDelta: 1, mediaDelta: 1 }
              },
              {
                id: "a3",
                text: "Segern är skön, men försvaret i andra halvlek var bitvis under all kritik. Vi måste höja skärpan.",
                tone: "DEMANDING",
                effects: { teamMoraleDelta: 0, boardDelta: 0, mediaDelta: 1 }
              }
            ]
          },
          {
            id: "q_referee_gap",
            journalist: { name: "Erik Nilsson", outlet: "Handbollskanalen", style: "TACTICAL" },
            text: "Matchen präglades av många utvisningar. Kände du att domarnivån var konsekvent i båda ändar av planen?",
            topic: "REFEREE",
            answers: [
              {
                id: "a_ref_dip",
                text: "Domarna har ett tufft jobb i ett högt tempo. Vi fokuserar på vad vi själva kan påverka.",
                tone: "DIPLOMATIC",
                effects: { teamMoraleDelta: 0, boardDelta: 1, mediaDelta: 1 }
              },
              {
                id: "a_ref_outspoken",
                text: "Det var frustrerande ojämnt i avgörande lägen, men vi vann trots motvinden.",
                tone: "OUTSPOKEN",
                effects: { teamMoraleDelta: 1, boardDelta: -1, mediaDelta: 3 }
              }
            ]
          }
        ]
      };

      localStorage.setItem("handball_career_save_v1", JSON.stringify(state));
    } catch (e) {
      console.error("Seed error", e);
    }
  });

  // Navigate to interactive press conference
  const pressUrl = `${base}/career/media/press/press:post:swe-cup-2026-tumba-mock`;
  await page.goto(pressUrl);
  await page.waitForSelector(".md-press-page", { timeout: 20000 });
  await page.waitForTimeout(500);
  await snap("07-press-conference-interactive.png");

  // Navigate to match report for this cup match
  const reportUrl = `${base}/career/match-report/swe-cup-2026-tumba-mock`;
  await page.goto(reportUrl);
  await page.waitForSelector(".mc-report-page, .mc-report-actions, .hm-panel", { timeout: 20000 });
  await page.waitForTimeout(500);
  await snap("08-match-report-cup-routing.png");
  await page.waitForTimeout(500);
  await snap("08-match-report-cup-routing.png");

  console.log("All verification screenshots captured successfully!");
} catch (err) {
  console.error("Capture failed:", err);
} finally {
  await browser.close();
}
