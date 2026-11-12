// Captures comparison boards of all hi-fi prototypes (requires the lab served on 127.0.0.1:3790).
// Usage: node design-lab/experience-2027/capture-boards.cjs  (uses the main checkout's Playwright install; no new deps)
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PATH || 'C:/DEV/PROJECTS/handball-manager/node_modules/playwright');

const BASE = process.env.LAB_URL || 'http://127.0.0.1:3790/design-lab/experience-2027/frame.html';
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'experience-2027', 'boards');
const KEYS = ['entry', 'dashboard', 'club', 'player', 'squad', 'staff', 'training', 'scouting', 'transfers', 'competition', 'matchday', 'analysis', 'inbox', 'calendar', 'manager', 'returning', 'system'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  let n = 0;
  for (const k of KEYS) {
    for (const alt of ['A', 'B', 'C']) {
      const theme = alt.toLowerCase();
      await desk.goto(`${BASE}#s=${k}&alt=${alt}&theme=${theme}`);
      await desk.waitForTimeout(700);
      await desk.screenshot({ path: path.join(OUT, `${k}-${alt}-desktop.jpg`), type: 'jpeg', quality: 72 });
      await mob.goto(`${BASE}#s=${k}&alt=${alt}&theme=${theme}`);
      await mob.waitForTimeout(500);
      await mob.screenshot({ path: path.join(OUT, `${k}-${alt}-mobile.jpg`), type: 'jpeg', quality: 62 });
      n += 2;
    }
  }
  await browser.close();
  console.log(`captured ${n} images to ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
