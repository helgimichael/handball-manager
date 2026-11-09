import { test, expect } from '@playwright/test';
const base=process.env.HM_QA_URL??'http://localhost:8795';

test('weekly office links existing training, persists edits and shows daily Continue feedback',async({page})=>{
  test.setTimeout(240000);
  page.setDefaultTimeout(30000);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{localStorage.setItem('hm_alpha_authorized','true');localStorage.setItem('hm_alpha_access_code','HBL-ALPHA-2026');});
  await page.setViewportSize({width:1600,height:1000});
  await page.goto(`${base}/new-game`);
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'N\u00e4sta \u2192',exact:true}).click();
  await page.getByPlaceholder('F\u00f6r- och efternamn').fill('Weekly Manager QA');
  await page.getByRole('combobox',{name:'Nationalitet',exact:true}).selectOption('SWE');
  await page.getByLabel('F\u00f6delsedatum',{exact:true}).fill('1985-01-15');
  await page.getByRole('button',{name:'N\u00e4sta \u2192',exact:true}).click();
  await page.getByRole('radio',{name:'8 veckor f\u00f6re seriestart',exact:true}).check();
  await page.getByRole('button',{name:'STARTA KARRI\u00c4R',exact:true}).click();
  await page.waitForURL('**/career',{timeout:90000});
  const panel=page.locator('#weekly-manager');
  await expect(panel.getByRole('heading',{name:'Veckans managerplan'})).toBeVisible();
  await expect(panel.locator('time[datetime]')).toHaveCount(7);
  await expect(panel).toContainText('Styrelsen:');
  await expect(panel.getByRole('link',{name:'F\u00f6rbered n\u00e4sta match \u2192',exact:true})).toHaveAttribute('href','/career/tactics');
  const date=(await panel.locator('time[datetime]').first().getAttribute('datetime'))!;
  await panel.locator('a.game-week-line').first().click();
  const day=page.getByRole('combobox',{name:`Dagtyp ${date}`,exact:true});
  await expect(day).toBeVisible();
  await day.selectOption('REST');
  await page.getByRole('button',{name:'Spara',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Sparat'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox',{name:`Dagtyp ${date}`,exact:true})).toHaveValue('REST');
  await page.goto(`${base}/career`);
  await expect(panel.locator(`a:has(time[datetime="${date}"])`)).toContainText('Vila');
  await expect(panel.getByRole('status')).toContainText('N\u00e4sta steg:');
  await page.getByRole('button',{name:'Forts\u00e4tt till n\u00e4sta h\u00e4ndelse i kalendern',exact:true}).click();
  // The initial day starts unprocessed. An important event may stop Continue
  // on that same date; verify the completed tick rather than demanding a skip.
  await expect(page.locator('.game-progression-notice')).toBeVisible({timeout:30000});
  await page.getByRole('link',{name:'Kontoret',exact:true}).click();
  await panel.locator('a.game-week-line').first().click();
  await expect(page.getByRole('combobox',{name:`Dagtyp ${date}`,exact:true})).toBeDisabled();
  await page.getByRole('link',{name:'Kontoret',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'Senaste \u00e5terkopplingen',exact:true})).toBeVisible();
  if(process.env.HM_QA_SCREENSHOT_DIR)await panel.screenshot({path:`${process.env.HM_QA_SCREENSHOT_DIR}/weekly-manager.png`});
  expect(errors).toEqual([]);
});
