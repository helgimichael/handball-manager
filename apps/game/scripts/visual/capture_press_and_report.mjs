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
  console.log("Setting up career session...");
  await page.goto(`${base}/new-game`);
  await expect(page.getByRole("heading", { name: "Din handbollsvärld." })).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.waitForTimeout(400);

  const tumbaBtn = page.locator(".game-club-option").filter({ hasText: /Tumba/i }).first();
  if (await tumbaBtn.isVisible()) {
    await tumbaBtn.click();
    await page.waitForTimeout(200);
  }

  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByPlaceholder("För- och efternamn").fill("Henrik Lindqvist");
  const natSelect = page.locator("select").first();
  if (await natSelect.isVisible()) await natSelect.selectOption("SWE");
  const dobInput = page.locator('input[type="date"]').first();
  if (await dobInput.isVisible()) await dobInput.fill("1984-05-14");

  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  const radioBtn = page.getByRole("radio", { name: /4 veckor före seriestart/i }).first();
  if (await radioBtn.isVisible()) await radioBtn.check();

  await page.getByRole("button", { name: "STARTA KARRIÄR", exact: true }).click();
  await page.waitForURL("**/career", { timeout: 60000 });
  await page.waitForTimeout(600);
  console.log("Career started successfully in IndexedDB.");

  console.log("Updating save record in IndexedDB with Svenska Cupen match & press conference...");
  await page.evaluate(async () => {
    const activeSaveId = localStorage.getItem("hm-game:active-save:v1");
    if (!activeSaveId) throw new Error("No active save ID found in localStorage");

    await new Promise((resolve, reject) => {
      const openReq = indexedDB.open("hm-game", 1);
      openReq.onerror = () => reject(openReq.error);
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction("saves", "readwrite");
        const store = tx.objectStore("saves");
        const getReq = store.get(activeSaveId);
        getReq.onerror = () => reject(getReq.error);
        getReq.onsuccess = () => {
          const save = getReq.result;
          if (!save || !save.careerState) {
            reject(new Error("Save or careerState missing"));
            return;
          }
          const state = save.careerState;
          const cupFixtureId = "swe-cup-2026-tumba-mock";
          const pressId = `press:post:${cupFixtureId}`;
          const today = state.gameDate || "2026-08-20";

          state.fixtures = state.fixtures || [];
          const cupFixture = {
            id: cupFixtureId,
            competitionId: "swe-svenska-cupen",
            round: 1,
            date: today,
            homeClubId: state.playerClubId || "swe2-tumba",
            awayClubId: "swe2-varberg",
            homeScore: 31,
            awayScore: 28,
            status: "COMPLETED",
            played: true,
            type: "CUP"
          };
          const fIdx = state.fixtures.findIndex((f) => f.id === cupFixtureId);
          if (fIdx >= 0) state.fixtures[fIdx] = cupFixture;
          else state.fixtures.push(cupFixture);

          state.results = state.results || {};
          state.results[cupFixtureId] = {
            homeScore: 31,
            awayScore: 28,
            homeStats: { goals: 31, shots: 44, saves: 14, turnovers: 7, suspensions: 1 },
            awayStats: { goals: 28, shots: 42, saves: 11, turnovers: 9, suspensions: 5 },
            homePlayerContributions: [],
            awayPlayerContributions: [],
            events: [
              { minute: 12, type: "GOAL", scoringClubId: state.playerClubId || "swe2-tumba", scorerName: "M. Lindgren" },
              { minute: 24, type: "TWO_MIN", team: "AWAY", playerName: "J. Larsson" },
              { minute: 48, type: "GOAL", scoringClubId: state.playerClubId || "swe2-tumba", scorerName: "A. Andreasson" },
              { minute: 58, type: "GOAL", scoringClubId: state.playerClubId || "swe2-tumba", scorerName: "K. Jönsson" }
            ]
          };

          state.media = state.media || { stories: {}, journalists: {}, press: {}, relations: {}, outletRelations: {}, supporters: 0, boardMood: 0, pressure: {}, discipline: {}, seen: [], week: { key: "", count: 0 } };
          state.media.press = state.media.press || {};
          state.media.journalists = state.media.journalists || {};

          state.media.journalists["jour_flinck"] = {
            id: "jour_flinck",
            name: "Johan Flinck",
            outletId: "aftonbladet",
            style: "CHALLENGING",
            relationship: 50
          };
          state.media.journalists["jour_nilsson"] = {
            id: "jour_nilsson",
            name: "Erik Nilsson",
            outletId: "handbollskanalen",
            style: "TACTICAL",
            relationship: 55
          };

          state.media.press[pressId] = {
            id: pressId,
            date: today,
            expiresOn: "2026-12-31",
            status: "OPEN",
            kind: "POST_MATCH",
            title: "Presskonferens efter Svenska Cupen",
            context: "Seger 31–28 mot HK Varberg i Svenska Cupen",
            answeredCount: 0,
            questions: [
              {
                id: "q_cup_win",
                journalistId: "jour_flinck",
                text: "31–28-seger och avancemang i Svenska Cupen! Hur rankar du insatsen med tanke på att ni gick runt på hela truppen?",
                topic: "AFTER_WIN",
                answers: [
                  { id: "a1", text: "En helgjuten laginsats där alla tog ansvar. Cupen är prioriterad och detta ger oss enorm energi.", tone: "ENTHUSIASTIC", effects: { teamMoraleDelta: 2, boardDelta: 1, mediaDelta: 2 } },
                  { id: "a2", text: "Vi gjorde det som krävdes, varken mer eller mindre. Fokus flyttas direkt till seriepremiären.", tone: "DIPLOMATIC", effects: { teamMoraleDelta: 1, boardDelta: 1, mediaDelta: 1 } },
                  { id: "a3", text: "Segern är skön, men försvaret i andra halvlek var bitvis under all kritik. Vi måste höja skärpan.", tone: "DEMANDING", effects: { teamMoraleDelta: 0, boardDelta: 0, mediaDelta: 1 } }
                ]
              },
              {
                id: "q_referee",
                journalistId: "jour_nilsson",
                text: "Matchen präglades av många utvisningar. Kände du att domarnivån var konsekvent i båda ändar av planen?",
                topic: "REFEREE",
                answers: [
                  { id: "a_ref1", text: "Domarna har ett tufft jobb i ett högt tempo. Vi fokuserar på vad vi själva kan påverka.", tone: "DIPLOMATIC", effects: { teamMoraleDelta: 0, boardDelta: 1, mediaDelta: 1 } },
                  { id: "a_ref2", text: "Det var frustrerande ojämnt i avgörande lägen, men vi vann trots motvinden.", tone: "OUTSPOKEN", effects: { teamMoraleDelta: 1, boardDelta: -1, mediaDelta: 3 } }
                ]
              }
            ]
          };

          const putReq = store.put(save);
          putReq.onerror = () => reject(putReq.error);
          putReq.onsuccess = () => resolve();
        };
      };
    });
  });

  // Navigate to interactive press conference
  console.log("Navigating to Press Conference...");
  const pressUrl = `${base}/career/media/press/press:post:swe-cup-2026-tumba-mock`;
  await page.goto(pressUrl);
  await page.waitForSelector(".md-press-page", { timeout: 20000 });
  await page.waitForTimeout(500);
  await snap("07-press-conference-interactive.png");

  // Navigate to match report for this cup match
  console.log("Navigating to Match Report...");
  const reportUrl = `${base}/career/match-report/swe-cup-2026-tumba-mock`;
  await page.goto(reportUrl);
  await page.waitForSelector(".mc-report-page, .mc-report-actions, .hm-panel", { timeout: 20000 });
  await page.waitForTimeout(500);
  await snap("08-match-report-cup-routing.png");

  console.log("Press and Match Report screenshots captured successfully!");
} catch (e) {
  console.error("Failed:", e);
} finally {
  await browser.close();
}
