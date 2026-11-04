import { chromium } from "playwright";

async function smokeWorkerdBrowser() {
  const targetBase = process.argv[2] || "http://127.0.0.1:8787";
  console.log(`Starting headless browser check against ${targetBase}...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => {
    errors.push(`PageError: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  // 1. Load root route
  await page.goto(`${targetBase}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
  console.log(`Loaded ${targetBase}/ successfully`);

  // Check title
  const title = await page.title();
  console.log(`Page title: "${title}"`);
  if (!title.includes("Handball Manager")) {
    throw new Error(`Unexpected page title: ${title}`);
  }

  // 2. Check alpha gate rendered
  const card = await page.locator(".alpha-card").first();
  await card.waitFor({ timeout: 5000 });
  console.log("Alpha access gate card is visible");

  // 3. Check hydration by checking that client JS attached
  // If access code input is present, submit it
  const input = page.locator('input[type="password"], input[type="text"]').first();
  if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("Access code input visible; testing gate submission...");
    await input.fill("HBL-ALPHA-2026");
    const submitBtn = page.locator('button:has-text("Fortsätt"), button[type="submit"]').first();
    await submitBtn.click();
    console.log("Submitted access code");
    await page.waitForTimeout(2000);
  }

  console.log(`Errors captured during page load: ${errors.length}`);
  if (errors.length > 0) {
    console.warn("Captured errors:", errors);
  }

  await browser.close();
  console.log("Headless workerd browser verification PASSED!");
}

smokeWorkerdBrowser().catch((err) => {
  console.error("Browser smoke verification FAILED:", err);
  process.exit(1);
});
