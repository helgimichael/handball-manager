import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const base = process.env.HM_QA_URL ?? 'http://localhost:3004';
const phase = process.env.HM_VISUAL_PHASE ?? 'after';
const output = path.resolve('../../docs/game-experience', phase);

async function ready(page:Page) {
  await expect(page.locator('.hm-shell')).toBeVisible({timeout:90000});
  await expect(page.locator('.hm-club-name')).toContainText('Tumba',{timeout:90000});
}
async function createCareer(page:Page) {
  await page.setViewportSize({width:1920,height:1080});
  await page.goto(`${base}/new-game`);
  for(let step=0;step<4;step++) await page.getByRole('button',{name:'Nästa →',exact:true}).click();
  await page.getByPlaceholder('För- och efternamn').fill('Visual QA');
  await page.getByRole('button',{name:'Nästa →',exact:true}).click();
  await page.getByRole('radio',{name:'Vid första tävlingsmatchen',exact:true}).check();
  await page.getByRole('button',{name:'STARTA KARRIÄR',exact:true}).click();
  await page.waitForURL('**/career',{timeout:90000});
  await ready(page);
  await expect(page.locator('main')).toContainText('Torslanda',{timeout:90000});
}
test('five presentation screens at desktop and ultrawide, with actual career data', async ({page}) => {
  test.setTimeout(240000);
  const errors:string[]=[];
  page.on('pageerror',error => errors.push(error.message));
  await createCareer(page);
  await page.getByRole('link',{name:'Trupp',exact:true}).click();
  await page.waitForURL('**/career/squad');
  const playerHref = await page.locator('main table a[href^="/career/squad/"]').first().getAttribute('href');
  const screens = [{name:'home',route:'/career'},{name:'squad',route:'/career/squad'},{name:'player',route:playerHref!},{name:'search',route:'/career/players'},{name:'competition',route:'/career/competitions'}];
  const measurements:unknown[]=[];
  for(const viewport of [{width:1920,height:1080},{width:2560,height:1080}]) {
    const dir=path.join(output,String(viewport.width)); mkdirSync(dir,{recursive:true});
    await page.setViewportSize(viewport);
    for(const screen of screens) {
      await page.goto(`${base}${screen.route}`); await ready(page);
      if(['squad','search','competition'].includes(screen.name)) await expect(page.locator('main table tbody tr').first()).toBeVisible({timeout:30000});
      if(screen.name==='player') { if(phase==='before') await expect(page.getByRole('button',{name:'Förläng kontrakt',exact:true})).toBeVisible({timeout:30000}); else await expect(page.locator('.game-player-hero')).toBeVisible({timeout:30000}); }
      if(screen.name==='home') await expect(page.locator('main')).toContainText('Torslanda',{timeout:30000});
      await page.screenshot({path:path.join(dir,`${screen.name}.png`),fullPage:false,animations:'disabled'});
      const layout=await page.evaluate(() => ({width:window.innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:document.querySelector('main')?.getBoundingClientRect().width}));
      measurements.push({screen:screen.name,route:screen.route,...layout});
      expect(layout.documentWidth).toBeLessThanOrEqual(viewport.width);
    }
  }
  writeFileSync(path.join(output,'capture.json'),JSON.stringify({base,phase,club:'IFK Tumba HK',screens,measurements,errors},null,2));
  expect(errors).toEqual([]);
});

test('player identity survives tabs, offer drafts survive selection and sporting screens remain navigable',async ({page})=>{
  test.skip(phase==='before','Interaction QA applies to the redesigned build.');
  test.setTimeout(240000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await createCareer(page);
  await page.getByRole('link',{name:'Trupp',exact:true}).click();
  await page.locator('main table a[href^="/career/squad/"]').first().click();
  await expect(page.locator('.game-player-hero')).toBeVisible({timeout:30000});
  const playerId=await page.locator('.game-player-hero').getAttribute('data-player-id');
  for(const tab of ['Prestation & historik','Egenskaper','Utveckling','Kontrakt','Klubbhistorik','Profil & egenskaper']) {
    await page.getByRole('button',{name:tab,exact:true}).click();
    await expect(page.locator('.game-player-hero')).toHaveAttribute('data-player-id',playerId!);
    await expect(page.getByRole('button',{name:tab,exact:true})).toHaveAttribute('aria-pressed','true');
  }
  await page.getByRole('link',{name:'Transfers',exact:true}).click();
  const row=page.locator('main table tbody tr').first();
  await row.getByRole('button',{name:'Välj',exact:true}).click();
  const fee=page.getByLabel('Övergångssumma (€)',{exact:true});
  await fee.fill('1234');
  await row.getByRole('button',{name:'Välj',exact:true}).click();
  await expect(fee).toHaveValue('1234');
  await page.getByRole('button',{name:'Lån',exact:true}).click();
  await expect(page.locator('.game-offer-impact > div').filter({hasText:'Låneavgift'})).toContainText('0');
  await page.getByRole('button',{name:'Permanent övergång',exact:true}).click();
  await expect(fee).toHaveValue('1234');
  await page.getByRole('button',{name:'Spara',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Sparat'})).toBeVisible();
  const screens=[{name:'club',route:'/career/club'},{name:'inbox',route:'/career/inbox'},{name:'training',route:'/career/training'},{name:'calendar',route:'/career/calendar'},{name:'preview',route:'/career/match-preview'},{name:'statistics',route:'/career/statistics'},{name:'transfers',route:'/career/transfers'}];
  for(const viewport of [{width:1920,height:1080},{width:2560,height:1080}]) {
    await page.setViewportSize(viewport);
    const dir=path.resolve('../../docs/game-experience/supplemental',String(viewport.width));mkdirSync(dir,{recursive:true});
    for(const screen of screens) {
      await page.goto(`${base}${screen.route}`);await ready(page);
      await expect(page.locator('main h1').first()).toBeVisible({timeout:30000});
      if(screen.name==='inbox') await page.getByRole('button',{name:/Kontraktsplanering:/}).first().click();
      await page.screenshot({path:path.join(dir,`${screen.name}.png`),animations:'disabled'});
      const width=await page.evaluate(()=>document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(viewport.width);
    }
  }
  expect(errors).toEqual([]);
});
