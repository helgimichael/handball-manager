import { test, expect as baseExpect } from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { CareerState } from '../lib/career/types';

const base=process.env.HM_QA_URL??'http://localhost:8796';
const backup=process.env.HM_QA_CONTRACT_BACKUP;
const planFile=process.env.HM_QA_RENEWAL_PLAN;
async function state(page:Page):Promise<CareerState>{
  return page.evaluate(async()=>{
    const id=localStorage.getItem('hm-game:active-save:v1');
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('hm-game');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    try{return await new Promise<CareerState>((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get(id!);r.onsuccess=()=>resolve(r.result.careerState);r.onerror=()=>reject(r.error);});}finally{db.close();}
  });
}
const hash=(s:CareerState)=>createHash('sha256').update(JSON.stringify(s)).digest('hex');

test('renewal refusal is recoverable, duplicate/over-budget offers are safe, and a valid renewal survives reload',async({page})=>{
  test.skip(!backup||!planFile,'Requires an exported controlled career and its affordable renewal plan.');
  test.setTimeout(480000);page.setDefaultTimeout(90000);
  const plan=JSON.parse(readFileSync(planFile!,'utf8')) as {id:string;name:string;demand:number;years:number;beforeContract:CareerState['playerContracts'][string];expectedContract:CareerState['playerContracts'][string]};
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{localStorage.setItem('hm_alpha_authorized','true');localStorage.setItem('hm_alpha_access_code','HBL-ALPHA-2026');});
  await page.setViewportSize({width:1680,height:1080});
  await page.goto(base+'/new-game');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:/^N.sta/}).click();
  await page.getByPlaceholder(/och efternamn/).fill('Contract Error Regression');await page.getByRole('combobox',{name:'Nationalitet',exact:true}).selectOption('SWE');await page.getByLabel(/delsedatum/).fill('1985-01-15');await page.getByRole('button',{name:/^N.sta/}).click();await page.getByRole('radio',{name:/^Vid f.rsta t.vlingsmatchen$/}).check();await page.getByRole('button',{name:/^STARTA KARRI.R$/}).click();await page.waitForURL('**/career',{timeout:120000});await page.locator('#weekly-manager').waitFor();
  await Promise.all([page.waitForEvent('domcontentloaded',{timeout:120000}),page.getByLabel('Importera sparafil',{exact:true}).setInputFiles(backup!,{timeout:240000})]);
  await expect.poll(async()=>(await state(page)).gameDate,{timeout:120000}).toBe('2026-10-26');
  await page.locator('#weekly-manager').waitFor();
  const loaded=await state(page);
  const refusedId=Object.keys(loaded.playerDynamics!.intentions!).find(id=>loaded.playerDynamics!.intentions![id]!.kind==='WANTS_TO_LEAVE'&&Object.values(loaded.renewalTalks??{}).some(t=>t.playerId===id&&t.status==='OPEN'))!;
  expect(refusedId).toBeTruthy();
  const profile=async(id:string)=>{await page.goto(base+'/career/squad/'+encodeURIComponent(id));await page.getByRole('button',{name:'Kontrakt',exact:true}).click();await page.locator('.pd-renewal').waitFor();};
  await profile(refusedId);
  const before=await state(page),beforeHash=hash(before);
  for(let i=0;i<3;i++){
    await page.getByRole('button',{name:/^F.rl.ng kontrakt$/}).click();
    await expect(page.locator('.pd-renewal > p[role="status"]').last()).toContainText(/Han vill l.mna och avvisar/,{timeout:10000});
    expect(errors).toEqual([]);expect(hash(await state(page))).toBe(beforeHash);
  }
  await page.reload();await page.getByRole('button',{name:'Kontrakt',exact:true}).click();await expect(page.locator('.pd-renewal')).toContainText(/Han vill l.mna och avvisar/);expect(hash(await state(page))).toBe(beforeHash);
  if(process.env.HM_QA_SCREENSHOT_DIR)await page.locator('.pd-renewal').screenshot({path:process.env.HM_QA_SCREENSHOT_DIR+'/refusal-functional.png'});

  await profile(plan.id);await page.getByRole('button',{name:/Inled f.rl.ngningssamtal/}).click();
  await page.getByRole('button',{name:'Spara',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Sparat'})).toBeVisible();
  await expect.poll(async()=>Object.values((await state(page)).renewalTalks??{}).some(t=>t.playerId===plan.id&&t.status==='OPEN')).toBe(true);
  const beforeBudget=await state(page),budgetHash=hash(beforeBudget);
  await page.getByRole('spinbutton',{name:/^L.n,/}).fill('1000000000');await page.getByRole('button',{name:/^F.rl.ng kontrakt$/}).click();
  await expect(page.locator('.pd-renewal > p[role="status"]').last()).toContainText(/budget|utrymme|kassa|l.ner/i);expect(hash(await state(page))).toBe(budgetHash);expect(errors).toEqual([]);
  await page.getByRole('spinbutton',{name:/^L.n,/}).fill(String(plan.demand));await page.getByRole('combobox',{name:/^F.rl.ngning$/}).selectOption(String(plan.years));
  // Two clicks in one task exercise the latest-state guard, before a second user event.
  await page.getByRole('button',{name:/^F.rl.ng kontrakt$/}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await expect.poll(async()=>Object.values((await state(page)).renewalTalks??{}).find(t=>t.playerId===plan.id&&t.status==='OPEN')?.rounds.length).toBe(1);
  let s=await state(page);const talk=Object.values(s.renewalTalks!).find(t=>t.playerId===plan.id&&t.status==='OPEN')!;expect(s.playerContracts[plan.id]).toEqual(plan.beforeContract);expect(talk.answerOn).toBeTruthy();
  // Honor genuine required discussions before advancing the reply date.
  for(const event of s.careerEvents.filter(e=>e.requiresAction&&!e.resolved)){
    expect(event.type).toBe('PLAYER_DYNAMICS');
    const c=Object.values(s.playerDynamics!.concerns).find(c=>'PLAYER_DYNAMICS:concern:'+c.id===event.id&&c.status==='OPEN')!;expect(c).toBeTruthy();
    const option=c.options.find(o=>['EARN_IT','LATER','PATIENCE','LISTEN_OFFERS'].includes(o.id))!;expect(option).toBeTruthy();
    await page.goto(base+'/career/squad/'+encodeURIComponent(c.playerId));await page.getByRole('button',{name:'Profil & egenskaper',exact:true}).click();
    await page.getByRole('button',{name:option.label}).click();
    await expect.poll(async()=>(await state(page)).playerDynamics!.concerns[c.id]!.status).toBe('ANSWERED');s=await state(page);
  }
  for(let step=0;step<8;step++){
    s=await state(page);if(s.renewalTalks![talk.id]!.status==='AGREED')break;
    const press=Object.values(s.media?.press??{}).find(p=>p.status==='OPEN'&&p.expiresOn>=s.gameDate);
    if(press){
      await page.goto(base+'/career/media/press/'+encodeURIComponent(press.id));
      for(const [index,q] of press.questions.entries()){
        const balanced=q.answers.findIndex(a=>String(a.tone)==='BALANCED'||String(a.tone)==='CALM');
        await page.locator('.md-questions > li').nth(index).getByRole('radio').nth(Math.max(0,balanced)).check();
      }
      await page.getByRole('button',{name:/L.mna svaren/}).click();
      await expect.poll(async()=>(await state(page)).media!.press[press.id]!.status).not.toBe('OPEN');continue;
    }
    expect(s.careerEvents.filter(e=>e.requiresAction&&!e.resolved)).toHaveLength(0);
    const beforeDate=s.processedThroughDate;
    await page.goto(base+'/career');await page.locator('#weekly-manager').waitFor();await page.locator('button.game-continue').click();
    await expect.poll(async()=>(await state(page)).processedThroughDate).not.toBe(beforeDate);
    await page.locator('.game-world-advance').waitFor({state:'hidden',timeout:120000});
  }
  expect((await state(page)).renewalTalks![talk.id]!.status).toBe('AGREED');
  s=await state(page);expect(s.playerContracts[plan.id]).toEqual(plan.expectedContract);expect(s.renewalTalks![talk.id]!.rounds).toHaveLength(1);expect(s.playerContracts[refusedId]).toEqual(before.playerContracts[refusedId]);expect(s.playerDynamics!.intentions![refusedId]).toEqual(before.playerDynamics!.intentions![refusedId]);
  await profile(plan.id);await expect(page.locator('.pd-renewal')).toContainText(/F.rl.ngningen .r klar/);await page.reload();await page.getByRole('button',{name:'Kontrakt',exact:true}).click();
  const reloaded=await state(page);expect(reloaded.playerContracts[plan.id]).toEqual(plan.expectedContract);expect(reloaded.renewalTalks![talk.id]!.rounds).toHaveLength(1);expect(reloaded.playerDynamics!.requests[refusedId]).toEqual(before.playerDynamics!.requests[refusedId]);expect(reloaded.matchArchiveIds).toEqual(before.matchArchiveIds);expect(errors).toEqual([]);
  if(process.env.HM_QA_SCREENSHOT_DIR){await page.locator('.pd-renewal').screenshot({path:process.env.HM_QA_SCREENSHOT_DIR+'/valid-renewal-reloaded.png'});writeFileSync(process.env.HM_QA_SCREENSHOT_DIR+'/contract-browser-result.json',JSON.stringify({status:'PASS',base,refusedId,refusalCareerHash:beforeHash,refusalAttempts:3,overBudgetUnchanged:true,duplicateSubmissionRounds:1,validRenewal:{playerId:plan.id,contract:reloaded.playerContracts[plan.id]},archives:reloaded.matchArchiveIds?.length,reload:true,errors},null,2));}
});
