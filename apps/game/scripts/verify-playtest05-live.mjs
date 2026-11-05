import { chromium } from "playwright";

const BASE_URL = process.argv[2] || "https://handball-manager-alpha.helgimichael.workers.dev";
const ACCESS_CODE = "HBL-ALPHA-2026";

async function verifyLiveProduction() {
  console.log(`=== LIVE BROWSER VERIFICATION: ${BASE_URL} ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (err) => {
    errors.push(`PageError: ${err.message}`);
    console.error(`[Browser PageError] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`ConsoleError: ${msg.text()}`);
      console.error(`[Browser ConsoleError] ${msg.text()}`);
    }
  });

  // 1. Root & Alpha Gate
  console.log("\n1. Navigating to root...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 25000 });
  const title = await page.title();
  console.log(`Title: "${title}"`);

  // Authorize alpha gate if visible
  const card = page.locator(".alpha-card");
  if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
    console.log("Alpha card visible, entering access code...");
    const input = page.locator('input[type="password"], input[type="text"]').first();
    await input.fill(ACCESS_CODE);
    const submitBtn = page.locator('button:has-text("Fortsätt"), button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForTimeout(2000);
    console.log("Gate cleared.");
  }

  // 2. New Game Wizard & Career Initialization
  console.log("\n2. Stepping through New Game wizard to create IFK Tumba career...");
  await page.goto(`${BASE_URL}/new-game`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1500);

  // Steps 1 to 4: Nations, Leagues, Database, Club (IFK Tumba is default selected)
  for (let i = 0; i < 4; i++) {
    console.log(`Advancing wizard step ${i + 1}...`);
    const nextBtn = page.getByRole("button", { name: "Nästa →", exact: true });
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.click();
    await page.waitForTimeout(800);
  }

  // Step 5: Manager Profile (Fill name, nationality, DOB)
  console.log("Filling manager profile details (name, nationality, DOB)...");
  const nameInput = page.getByPlaceholder("För- och efternamn");
  await nameInput.waitFor({ state: "visible", timeout: 10000 });
  await nameInput.fill("Helgi Manager");
  await page.waitForTimeout(300);

  const natSelect = page.locator('select.hm-select, select[required]');
  if (await natSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await natSelect.selectOption("SWE");
    await page.waitForTimeout(300);
  }

  const dobInput = page.locator('input[type="date"]');
  if (await dobInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dobInput.fill("1985-05-15");
    await page.waitForTimeout(300);
  }

  console.log("Manager profile complete. Advancing to final step...");
  const nextBtn5 = page.getByRole("button", { name: "Nästa →", exact: true });
  await nextBtn5.click();
  await page.waitForTimeout(1000);

  // Step 6: Start Date selection
  console.log("Selecting career start date...");
  const radio = page.getByRole("radio", { name: "Vid första tävlingsmatchen", exact: true });
  if (await radio.isVisible({ timeout: 5000 }).catch(() => false)) {
    await radio.check();
  }

  // Click STARTA KARRIÄR
  console.log("Clicking STARTA KARRIÄR...");
  const startBtn = page.getByRole("button", { name: "STARTA KARRIÄR", exact: true });
  await startBtn.waitFor({ state: "visible", timeout: 10000 });
  await startBtn.click();

  // Wait for career dashboard to load
  console.log("Awaiting career initialization and navigation to /career...");
  await page.waitForURL("**/career", { timeout: 90000 });
  console.log("Career initialized successfully! Landed on /career.");

  // 3. Career Dashboard Navigation Verification
  console.log("\n3. Verifying Career Navigation links...");
  const squadLink = page.getByRole("link", { name: "Trupp", exact: true });
  await squadLink.waitFor({ state: "visible", timeout: 15000 });
  console.log("Squad navigation link visible.");

  // 4. Squad & Player Form
  console.log("\n4. Verifying Squad page (/career/squad)...");
  await page.goto(`${BASE_URL}/career/squad`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(2000);
  const bodyText = await page.textContent("body");
  if (!bodyText.includes("Tumba")) {
    throw new Error("Squad page does not contain expected club name 'Tumba'");
  }
  console.log("Squad page loaded: IFK Tumba squad displayed.");

  // 5. Tactics Board (/career/tactics)
  console.log("\n5. Verifying Tactics Board (/career/tactics)...");
  await page.goto(`${BASE_URL}/career/tactics`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(2000);

  const startsju = page.getByText("Startsju", { exact: false }).first();
  await startsju.waitFor({ state: "visible", timeout: 15000 });
  console.log("Startsju on court tactics board visible.");

  // 6. Match Center (/career/match-center)
  console.log("\n6. Verifying Match Center (/career/match-center)...");
  await page.goto(`${BASE_URL}/career/match-center`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(2000);
  const mcBody = await page.textContent("body");
  console.log(`Match Center loaded (${mcBody.length} chars).`);

  // 7. Staff & Transfers
  console.log("\n7. Verifying Staff & Transfers pages...");
  await page.goto(`${BASE_URL}/career/transfers`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1500);
  console.log("Transfers loaded cleanly.");

  await page.goto(`${BASE_URL}/career/staff`, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1500);
  console.log("Staff loaded cleanly.");

  // 8. Error Summary
  console.log(`\n=== Verification Error Summary: ${errors.length} client errors ===`);
  if (errors.length > 0) {
    console.error("Errors captured:", errors);
    throw new Error(`Browser test failed with ${errors.length} client errors`);
  }

  await browser.close();
  console.log("\n>>> LIVE PRODUCTION VERIFICATION PASSED WITH 0 ERRORS <<<");
}

verifyLiveProduction().catch((err) => {
  console.error("Live verification FAILED:", err);
  process.exit(1);
});
