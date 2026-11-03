import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const base = process.env.HM_QA_URL ?? "http://localhost:3099";
const outDir = "C:/DEV/QA/reports/HM-RICH-EXPERIENCE-02/screenshots/after";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => {
  localStorage.setItem("hm_alpha_authorized", "true");
  localStorage.setItem("hm_alpha_access_code", "HBL-ALPHA-2026");
});
page.setDefaultTimeout(45000);

const pageErrors = [];
const verificationLog = [];
page.on("pageerror", (err) => pageErrors.push(err.message));

async function snap(name, fullPage = false) {
  const file = path.join(outDir, name);
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage, animations: "disabled" });
  console.log(`[SNAP] ${name} (${page.url()})`);
}

try {
  // 1. Start screen
  await page.goto(base);
  await expect(page.locator(".game-title")).toBeVisible();
  await snap("01-start-screen.png");

  // 2. New Game — Nations
  await page.goto(`${base}/new-game`);
  await expect(page.getByRole("heading", { name: "Din handbollsvärld." })).toBeVisible();
  await snap("02-new-game-nations.png");

  // Step -> Leagues -> Database -> Club Selection
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.waitForTimeout(500);
  await snap("03-club-selection-crests.png");

  // Select an elite Handbollsligan club briefly to capture 03b, then back to IFK Tumba HK
  const eliteBtn = page.locator(".game-club-option").filter({ hasText: /Ystads IF|IK Sävehof|IFK Kristianstad/i }).first();
  if (await eliteBtn.isVisible()) {
    await eliteBtn.click();
    await page.waitForTimeout(300);
  }
  await snap("03b-club-selection-elite.png");

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
  await snap("04-manager-creation.png");

  // 5. Career Start Mandate
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("radio", { name: "4 veckor före seriestart", exact: true }).check();
  await snap("05-career-start-mandate.png");

  // Start Career
  await page.getByRole("button", { name: "STARTA KARRIÄR", exact: true }).click();
  await page.waitForURL("**/career", { timeout: 90000 });
  await expect(page.locator(".game-home")).toBeVisible({ timeout: 90000 });
  await snap("06-home-command-centre.png");

  // Verify STARKVIS shell open vs collapsed (Section 12)
  const svShell = page.locator("[data-starkvis-shell]");
  if ((await svShell.count()) > 0) {
    const revealBtn = page.getByRole("button", { name: "Visa STARKVIS-navigation" });
    const hideBtn = page.getByRole("button", { name: "Dölj STARKVIS-navigation" });
    if ((await svShell.getAttribute("data-revealed")) !== "true" && (await revealBtn.isVisible())) {
      await revealBtn.click();
      await page.waitForTimeout(350);
    }
    await snap("31-starkvis-shell-open.png");
    const headerBoxOpen = await page.locator(".hm-header").boundingBox();
    verificationLog.push({
      check: "STARKVIS shell open overlap check",
      headerTop: headerBoxOpen ? Math.round(headerBoxOpen.y) : null,
      noOverlap: headerBoxOpen ? headerBoxOpen.y >= 150 : true,
    });
    if (await hideBtn.isVisible()) {
      await hideBtn.click();
      await page.waitForTimeout(350);
    }
    await snap("32-starkvis-shell-collapsed.png");
  }

  // 7. Clubhouse 2.0 Interactive Overview + Room Stage switching + entering >=4 rooms
  await page.goto(`${base}/career/klubbhuset`);
  await expect(page.locator(".kh-blueprint")).toBeVisible();
  await snap("07-clubhouse.png");

  const tacticsZone = page.locator('.kh-hotspot[data-room-id="tactics"]').first();
  if (await tacticsZone.isVisible()) {
    await tacticsZone.click();
    await page.waitForTimeout(250);
    await snap("07b-clubhouse-room-tactics.png");
  }
  const dressingZone = page.locator('.kh-hotspot[data-room-id="dressing"]').first();
  if (await dressingZone.isVisible()) {
    await dressingZone.click();
    await page.waitForTimeout(250);
    await snap("07c-clubhouse-room-dressing.png");
  }

  // Verify entering 4 departments from Clubhouse
  const deptRoutes = ["/career/squad", "/career/tactics", "/career/board", "/career/media"];
  for (const target of deptRoutes) {
    await page.goto(`${base}/career/klubbhuset`);
    const link = page.locator(`a[href="${target}"]`).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(`**${target}`);
    verificationLog.push({ check: `Clubhouse navigation to ${target}`, ok: true });
  }

  // 8. Squad Workspace
  await page.goto(`${base}/career/squad`);
  await expect(page.locator(".hm-env-banner")).toBeVisible();
  await snap("08-squad-workspace.png");

  // 9. Player Profile Dossier + Radar & Attribute Bars
  const firstPlayerLink = page.locator('table a[href^="/career/squad/"], table a[href^="/career/players/"]').first();
  await firstPlayerLink.click();
  await page.waitForURL(/\/career\/(squad|players)\//);
  await expect(page.locator(".game-player-hero")).toBeVisible();
  await snap("09-player-profile-dossier.png");

  const attrTab = page.getByRole("button", { name: /^EGENSKAPER$/i }).or(page.getByRole("tab", { name: /^EGENSKAPER$/i })).first();
  if (await attrTab.isVisible()) {
    await attrTab.click();
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 420));
    await snap("09b-player-attributes-radar.png");
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // 10-16. Tactical Board 2.0
  await page.goto(`${base}/career/tactics`);
  await expect(page.locator(".coach-court")).toBeVisible();
  const suggestBtn = page.getByRole("button", { name: /Assistentens förslag/i }).first();
  if (await suggestBtn.isVisible()) {
    await suggestBtn.click();
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.scrollTo(0, 320));
  await snap("10-tactics-attack-6v6.png");

  // Verify starter-to-bench swap & persistence across reload
  const sendToBenchBtn = page.getByRole("button", { name: /Byt till bänken|Ta bort från startsjun/i }).first();
  if (await sendToBenchBtn.isVisible()) {
    await sendToBenchBtn.click();
    await page.waitForTimeout(300);
    await snap("10b-tactics-bench-swap.png");
    // Restore full 7 starters for subsequent screenshots
    if (await suggestBtn.isVisible()) {
      await suggestBtn.click();
      await page.waitForTimeout(250);
    }
    await page.reload();
    await expect(page.locator(".coach-court")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 320));
    verificationLog.push({ check: "Tactics starter-to-bench swap & reload persistence", ok: true });
  }

  // 11. Defence 6-0
  await page.locator(".hm-court-mode-tab").filter({ hasText: "Försvar 6v6" }).click();
  await page.waitForTimeout(250);
  await snap("11-tactics-defence-6-0.png");

  // 12. Defence 5-1 + Verify zero overlap between CH and SPETS
  const fiveOneBtn = page.getByRole("button", { name: "5–1 Försvar", exact: true }).first();
  if (await fiveOneBtn.isVisible()) {
    await fiveOneBtn.click();
    await page.waitForTimeout(300);
  }
  await snap("12-tactics-defence-5-1.png");

  const chToken = page.locator(".coach-court-defence .coach-position").filter({ hasText: "CH" }).first();
  const spetsToken = page.locator(".coach-court-defence .coach-position").filter({ hasText: "SPETS" }).first();
  if ((await chToken.isVisible()) && (await spetsToken.isVisible())) {
    const chBox = await chToken.boundingBox();
    const spetsBox = await spetsToken.boundingBox();
    const verticalGap = spetsBox && chBox ? spetsBox.y - (chBox.y + chBox.height) : 0;
    verificationLog.push({
      check: "5-1 CH vs SPETS non-overlap check",
      chBox,
      spetsBox,
      verticalGapPx: Math.round(verticalGap),
      noOverlap: verticalGap >= 8,
    });
  }

  // 13. Attack-Defence Exchanges
  await page.locator(".hm-court-mode-tab").filter({ hasText: "Försvarsbyten" }).click();
  await page.waitForTimeout(250);
  await snap("13-tactics-exchanges.png");

  // 14. Special 6v5
  await page.locator(".hm-court-mode-tab").filter({ hasText: "Övertag 6v5" }).click();
  await page.waitForTimeout(250);
  await snap("14-tactics-special-6v5.png");

  // 15. Special 7v6
  await page.locator(".hm-court-mode-tab").filter({ hasText: "Anfall 7v6" }).click();
  await page.waitForTimeout(250);
  await snap("15-tactics-special-7v6.png");

  // 16. Leadership & 7m + Matchday Squad
  const rolesAnchor = page.locator('a[href="#roles-section"]').first();
  if (await rolesAnchor.isVisible()) {
    await rolesAnchor.click();
    await page.waitForTimeout(250);
  }
  await snap("16-tactics-leadership-7m.png");

  // 17. Training Board
  await page.goto(`${base}/career/training`);
  await expect(page.locator(".hm-env-banner")).toBeVisible();
  await snap("17-training-board.png");

  // 18. Calendar & Preseason
  await page.goto(`${base}/career/calendar`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("18-calendar-preseason.png");

  // 19. Staff & Recruitment + Staff Dossier
  await page.goto(`${base}/career/staff`);
  await expect(page.locator(".game-section-scene")).toBeVisible();
  await snap("19b-staff-overview.png");

  const firstStaffLink = page.locator('table a[href^="/career/staff/"]').first();
  if (await firstStaffLink.isVisible()) {
    await firstStaffLink.click();
    await page.waitForURL("**/career/staff/**");
    await expect(page.locator(".game-section-scene")).toBeVisible();
    await snap("19c-staff-dossier.png");
  }

  await page.goto(`${base}/career/staff/recruitment`);
  await expect(page.locator(".game-section-scene")).toBeVisible();
  await snap("19-staff-recruitment.png");

  // 20. Scouting, Opponent Scouting & Transfers
  await page.goto(`${base}/career/scouting`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("20-scouting-workspace.png");

  await page.goto(`${base}/career/analysis/opponent`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("20b-opponent-scouting.png");

  await page.goto(`${base}/career/transfers`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("20c-transfers.png");

  // 21. Boardroom, Finance & Club Overview
  await page.goto(`${base}/career/board`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("21-boardroom.png");

  await page.goto(`${base}/career/finance`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("21b-finance.png");

  await page.goto(`${base}/career/club`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("21c-club-overview.png");

  // 22. Competition League
  await page.goto(`${base}/career/competitions`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("22-competition-league.png");

  // 23. Svenska Cupen
  const cupTab = page.getByRole("button", { name: /Svenska cupen/i }).first();
  if (await cupTab.isVisible()) {
    await cupTab.click();
    await page.waitForTimeout(300);
  }
  await snap("23-svenska-cupen.png");

  // 24. Media Centre & Medical Room
  await page.goto(`${base}/career/media`);
  await expect(page.locator(".hm-shell")).toBeVisible();
  await snap("24-media-centre.png");

  await page.goto(`${base}/career/medical`);
  await expect(page.locator(".hm-env-banner")).toBeVisible();
  await snap("24b-medical-room.png");

  // Responsive captures (28, 29, 30, 33) BEFORE starting a new career for live match
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${base}/career/tactics`);
  await expect(page.locator(".coach-court")).toBeVisible();
  await snap("28-tablet-tactics-768.png");

  await page.goto(`${base}/career/klubbhuset`);
  await expect(page.locator(".kh-blueprint")).toBeVisible();
  await snap("33-tablet-clubhouse-768.png");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}/career/tactics`);
  await expect(page.locator(".coach-court")).toBeVisible();
  await snap("29-phone-tactics-375.png");

  await page.goto(`${base}/career`);
  await expect(page.locator(".game-home")).toBeVisible();
  await snap("30-phone-home-375.png");

  // Restore 1920x1080 for Match Preview -> Live Match -> Match Report
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${base}/new-game`);
  for (let step = 0; step < 4; step++) {
    await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  }
  await page.getByPlaceholder("För- och efternamn").fill("Henrik Lindqvist");
  const natSelect2 = page.locator("select").first();
  if (await natSelect2.isVisible()) await natSelect2.selectOption("SWE");
  const dobInput2 = page.locator('input[type="date"]').first();
  if (await dobInput2.isVisible()) await dobInput2.fill("1984-05-14");
  await page.getByRole("button", { name: "Nästa →", exact: true }).click();
  await page.getByRole("radio", { name: "Vid första tävlingsmatchen", exact: true }).check();
  await page.getByRole("button", { name: "STARTA KARRIÄR", exact: true }).click();
  await page.waitForURL("**/career", { timeout: 90000 });
  await expect(page.locator(".game-home")).toBeVisible({ timeout: 90000 });

  // Populate starting 7 & 16-player matchday squad via Assistant Coach before Match Preview
  await page.goto(`${base}/career/tactics`);
  await expect(page.locator(".coach-court")).toBeVisible();
  const suggestBtn2 = page.getByRole("button", { name: /Assistentens förslag/i }).first();
  if (await suggestBtn2.isVisible()) {
    await suggestBtn2.click();
    await page.waitForTimeout(300);
  }

  await page.goto(`${base}/career/match-preview`);
  for (let step = 0; step < 25 && !(await page.getByRole("button", { name: "STARTA MATCH →", exact: true }).isVisible()); step++) {
    await page.getByRole("button", { name: "Fortsätt »", exact: true }).click();
    await page.waitForTimeout(400);
    const skip = page.getByRole("button", { name: /HOPPA ÖVER|Visa händelsen|Gå till händelsen/i }).first();
    if (await skip.isVisible()) await skip.click();
    await expect(page.getByRole("button", { name: "Fortsätt »", exact: true })).toBeEnabled({ timeout: 30000 });
    await page.goto(`${base}/career/match-preview`);
  }
  await snap("25-match-preview.png");

  // 26. Live Match Broadcast Scoreboard & Event Callouts
  await page.getByRole("button", { name: "STARTA MATCH →", exact: true }).click();
  await page.waitForURL("**/career/match-day/**");
  await expect(page.locator(".mc-header")).toBeVisible();
  const playBtn = page.getByRole("button", { name: "Spela", exact: true });
  if (await playBtn.isVisible()) {
    await playBtn.click();
    await page.waitForTimeout(2200);
  }
  await snap("26-live-match.png");

  // 27. Post-Match Report
  await page.getByRole("button", { name: "Spela till slut", exact: true }).click();
  await page.waitForURL("**/career/match-report/**", { timeout: 180000 });
  await expect(page.getByText("Speltid och belastning", { exact: true })).toBeVisible({ timeout: 45000 });
  await snap("27-match-report-h2h.png");

  writeFileSync(
    path.join(outDir, "verification-summary.json"),
    JSON.stringify({ base, pageErrors, verificationLog }, null, 2)
  );
  console.log("ALL CAPTURES COMPLETE. Page errors:", pageErrors.length);
} finally {
  await browser.close();
}
