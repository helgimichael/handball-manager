import { test, expect as baseExpect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CareerSave } from '../lib/save/saveRepository';

const expect=baseExpect.configure({timeout:30000});
const base=process.env.HM_QA_URL??'http://localhost:3008';
const output=resolve(process.env.HM_QA_SCREENSHOT_DIR??'../../docs/match-realism-v2/browser');
const courtSelector='svg[aria-label="Handbollsplan med matchens spelare och boll"]';

async function savedFacts(page:Page){
  return page.evaluate(async()=>{
    const saveId=localStorage.getItem('hm-game:active-save:v1');
    if(!saveId)throw new Error('No active saved career');
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('hm-game',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    try{
      const save=await new Promise<CareerSave>((resolve,reject)=>{
        const transaction=database.transaction('saves','readonly'),request=transaction.objectStore('saves').get(saveId);
        request.onsuccess=()=>resolve(request.result as CareerSave);request.onerror=()=>reject(request.error);
      });
      const career=save.careerState;
      if(!career)throw new Error('Saved career has no state');
      const session=career.productionMatch,core=session?.core;
      const digest=core?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(core))):null;
      return {saveId,saveSeed:career.saveSeed,fixtureId:session?.fixture.id??null,seed:core?.seed??null,
        coreHash:digest?Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''):null,
        tick:core?.tick??null,officialMs:core?.officialClock.timeMs??null,phase:core?.match?.phase??null,
        rng:core?.rng??null,score:core?.score??null,
        archiveIds:career.matchArchiveIds??[],resultCount:Object.keys(career.results).length,
        resultScores:Object.fromEntries(Object.entries(career.results).map(([id,result])=>[id,[result.homeGoals,result.awayGoals]])),
        commands:core?.events.filter(e=>['TACTICS_CHANGED','EXCHANGE_REQUESTED','SUBSTITUTE_ADMITTED','EXCHANGE_COMPLETED','TEAM_TIMEOUT_STARTED'].includes(e.type)).map(e=>({type:e.type,tick:e.tick,actorId:e.actorId,details:e.details}))??[]};
    }finally{database.close();}
  });
}

test('canonical career match: visible 2D at live speeds, coaching, both halves, persistence, report and archived replay',async({page})=>{
  test.setTimeout(600000);page.setDefaultTimeout(30000);
  mkdirSync(output,{recursive:true});
  const errors:string[]=[],observations:unknown[]=[],screenshots:string[]=[];
  const receipt:{status:string;url:string;startedAt:string;finishedAt?:string;error?:string;errors:string[];observations:unknown[];screenshots:string[]}={status:'RUNNING',url:base,startedAt:new Date().toISOString(),errors,observations,screenshots};
  page.on('pageerror',error=>errors.push(error.message));
  async function renderedFrame(label:string){
    const frame=await page.locator(courtSelector).evaluate(svg=>({
      players:Array.from(svg.querySelectorAll(':scope > g[transform^="translate("]')).map(group=>({name:group.querySelector('title')?.textContent??'',transform:group.getAttribute('transform')})),
      ball:{x:svg.querySelector(':scope > circle')?.getAttribute('cx'),y:svg.querySelector(':scope > circle')?.getAttribute('cy')},
    }));
    const clock=await page.locator('.game-scoreboard-top').innerText(),score=await page.locator('.game-live-score').innerText();
    observations.push({kind:'rendered-2d',label,wallTime:new Date().toISOString(),clock,score,...frame});
    expect(frame.players.length).toBeGreaterThanOrEqual(10);
    return frame;
  }
  async function screenshot(label:string,width=1920){
    const directory=join(output,String(width));mkdirSync(directory,{recursive:true});
    const path=join(directory,`${label}.png`);await page.screenshot({path,animations:'disabled'});screenshots.push(path);
  }
  async function widths(label:string){
    for(const width of [1920,2560]){
      await page.setViewportSize({width,height:1080});await page.evaluate(()=>window.scrollTo(0,0));
      const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
      expect(layout.scrollWidth).toBeLessThanOrEqual(width);observations.push({kind:'layout',label,viewport:width,...layout});
      await screenshot(label,width);
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      observations.push({kind:'max-scroll',label,viewport:width,...await page.evaluate(()=>({scrollY:window.scrollY,maximum:Math.max(0,document.documentElement.scrollHeight-window.innerHeight)}))});
      await screenshot(`${label}-max-scroll`,width);
    }
    await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>window.scrollTo(0,0));
  }
  async function save(){
    await page.getByRole('button',{name:'Spara',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Sparat'})).toBeVisible();
  }
  async function play(){await page.getByRole('button',{name:'Spela',exact:true}).click();await expect(page.getByRole('button',{name:'Pausa',exact:true})).toBeVisible();}
  async function pause(){await page.getByRole('button',{name:'Pausa',exact:true}).click();await expect(page.getByRole('button',{name:'Spela',exact:true})).toBeVisible();}
  async function watch(speed:number,label:string){
    await page.getByLabel('Matchhastighet',{exact:true}).selectOption(String(speed));await play();
    const frames=[];
    for(let n=0;n<3;n++){
      await page.waitForTimeout(n===0?1000:2000);frames.push(await renderedFrame(`${label}-${n+1}`));
      await screenshot(`${label}-${n+1}`);
    }
    await page.waitForTimeout(1000);await pause();
    const moved=frames.slice(1).some(frame=>frame.players.some(p=>frames[0].players.find(previous=>previous.name===p.name)?.transform!==p.transform));
    expect(moved).toBe(true);observations.push({kind:'visible-movement',label,speed,moved,minimumObservationSeconds:6});
  }
  try{
    await page.setViewportSize({width:1920,height:1080});
    await page.goto(`${base}/new-game`);
    for(let step=0;step<4;step++)await page.getByRole('button',{name:'Nästa →',exact:true}).click();
    await page.getByPlaceholder('För- och efternamn').fill('Match Realism v2 Browser QA');
    await page.getByRole('button',{name:'Nästa →',exact:true}).click();
    await page.getByRole('radio',{name:'Vid första tävlingsmatchen',exact:true}).check();
    await page.getByRole('button',{name:'STARTA KARRIÄR',exact:true}).click();
    await page.waitForURL('**/career',{timeout:90000});await expect(page.locator('.game-home')).toBeVisible({timeout:90000});
    await page.goto(`${base}/career/match-preview`);
    for(let attempt=0;attempt<30;attempt++){
      if(await page.getByRole('button',{name:'STARTA MATCH →',exact:true}).isVisible())break;
      await page.getByRole('button',{name:'Fortsätt »',exact:true}).click();
      if(await page.getByRole('dialog').isVisible())await page.getByRole('dialog').press('Escape');
      await expect(page.locator('.game-world-advance')).toHaveCount(0);await page.goto(`${base}/career/match-preview`);
    }
    await expect(page.getByRole('button',{name:'STARTA MATCH →',exact:true})).toBeVisible();await widths('preview');
    await page.getByRole('button',{name:'STARTA MATCH →',exact:true}).click();await page.waitForURL('**/career/match-day/**');
    await expect(page.locator(courtSelector)).toBeVisible({timeout:60000});await expect(page.getByRole('button',{name:'Spela',exact:true})).toBeVisible();
    const matchUrl=page.url(),fixtureId=matchUrl.split('/').at(-1)!.split('?')[0];observations.push({kind:'match',fixtureId,matchUrl});
    await widths('kickoff');await renderedFrame('kickoff');
    for(const speed of [1,4,16]){await watch(speed,`first-half-${speed}x`);await widths(`first-half-${speed}x-paused`);}

    for(const name of ['Försvar 5:1','Tempo Snabbt','Anfall Bredd']){
      await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
    }
    await page.getByRole('button',{name:/^Byt ut /}).first().click();
    const outName=(await page.locator('.coach-live-out-list button[aria-pressed="true"] strong').innerText()).trim();
    await page.getByRole('button',{name:/^Byt in /}).first().click();
    const inName=(await page.locator('.coach-live-in-list button[aria-pressed="true"] strong').innerText()).trim();
    await page.getByRole('button',{name:'Genomför byte',exact:true}).click();await expect(page.locator('.coach-pending-exchange')).toBeVisible();
    observations.push({kind:'substitution-request',outName,inName});await widths('substitution-requested');
    await page.getByLabel('Matchhastighet',{exact:true}).selectOption('16');await play();
    await expect(page.locator('.coach-live-out-list').getByRole('button',{name:`Byt ut ${inName}`,exact:true})).toBeVisible({timeout:60000});
    await expect(page.locator('.coach-pending-exchange')).toHaveCount(0);await pause();
    const admitted=await renderedFrame('substitution-admitted');expect(admitted.players.some(p=>p.name===inName)).toBe(true);
    observations.push({kind:'substitution-admitted',outName,inName});await widths('substitution-admitted');

    const timeout=page.getByRole('button',{name:'Timeout',exact:true});
    for(let attempt=0;attempt<10;attempt++){
      if(await timeout.isEnabled()){await timeout.click();break;}
      await play();await expect.poll(()=>timeout.isEnabled(),{timeout:30000,intervals:[50]}).toBe(true);await pause();
    }
    await expect(page.locator('.coach-timeout[data-active="true"]')).toBeVisible();await expect(timeout).toBeDisabled();
    await widths('timeout');await save();
    const beforeReload=await savedFacts(page),clockBefore=await page.locator('.game-scoreboard-top').innerText();
    expect(beforeReload.coreHash).toBeTruthy();observations.push({kind:'saved-live',...beforeReload});
    await page.reload();await expect(page.locator(courtSelector)).toBeVisible({timeout:60000});
    expect(await page.locator('.game-scoreboard-top').innerText()).toBe(clockBefore);
    await expect(page.locator('.coach-timeout[data-active="true"]')).toBeVisible();await expect(timeout).toBeDisabled();
    for(const name of ['Försvar 5:1','Tempo Snabbt','Anfall Bredd'])await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
    const afterReload=await savedFacts(page);expect(afterReload.coreHash).toBe(beforeReload.coreHash);expect(afterReload.rng).toEqual(beforeReload.rng);
    observations.push({kind:'live-reloaded',...afterReload});await widths('live-reloaded');

    await page.getByLabel('Matchhastighet',{exact:true}).selectOption('64');await play();
    await expect(page.locator('.game-live-match')).toHaveAttribute('data-phase','halftime',{timeout:240000});
    await expect(page.locator('.game-scoreboard')).toContainText('30:00');await expect(page.getByRole('button',{name:'Starta andra halvlek',exact:true})).toBeVisible();
    await renderedFrame('halftime');await widths('halftime');await save();observations.push({kind:'halftime-saved',...await savedFacts(page)});
    await page.getByLabel('Matchhastighet',{exact:true}).selectOption('16');await page.getByRole('button',{name:'Starta andra halvlek',exact:true}).click();
    await expect(page.locator('.game-scoreboard')).toContainText('Andra halvlek');
    for(let n=0;n<3;n++){await page.waitForTimeout(n===0?2000:3000);await renderedFrame(`second-half-16x-${n+1}`);await screenshot(`second-half-16x-${n+1}`);}
    await pause();await widths('second-half-paused');
    await page.getByRole('button',{name:'Spela till slut',exact:true}).click();await page.waitForURL('**/career/match-report/**',{timeout:180000});
    await expect(page.getByText('Speltid och belastning',{exact:true})).toBeVisible();
    const finalScore=(await page.locator('.game-match-centre > strong').innerText()).replace(/\s/g,'');
    await widths('fulltime-report');await save();const reportSaved=await savedFacts(page);observations.push({kind:'report-saved',finalScore,...reportSaved});
    expect(reportSaved.archiveIds).toContain(fixtureId);expect(reportSaved.resultScores[fixtureId]).toHaveLength(2);
    await page.reload();await expect(page.getByText('Speltid och belastning',{exact:true})).toBeVisible({timeout:60000});
    const reportReloaded=await savedFacts(page);expect(reportReloaded.resultScores).toEqual(reportSaved.resultScores);expect(reportReloaded.resultCount).toBe(reportSaved.resultCount);
    await expect(page.locator('.game-match-centre > strong')).toHaveText(finalScore);observations.push({kind:'report-reloaded',...reportReloaded});

    await page.getByRole('button',{name:'Se matchrepris',exact:true}).click();await page.waitForURL('**/career/match-day/**');
    await expect(page.getByText('Repris',{exact:true})).toBeVisible({timeout:60000});
    const slider=page.getByLabel('Position i reprisen',{exact:true});
    await slider.press('Home');await renderedFrame('replay-start');await widths('replay-start');
    const bounds=await slider.boundingBox();expect(bounds).not.toBeNull();await slider.click({position:{x:bounds!.width/2,y:bounds!.height/2}});
    observations.push({kind:'replay-middle',tick:await slider.inputValue()});await renderedFrame('replay-middle');await widths('replay-middle');
    await slider.press('End');await renderedFrame('replay-end');await widths('replay-end');
    const replayScore=(await page.locator('.game-live-score').innerText()).replace(/\s/g,'').replace(':','–');expect(replayScore).toBe(finalScore);
    const replaySaved=await savedFacts(page);expect(replaySaved.resultScores).toEqual(reportSaved.resultScores);expect(replaySaved.resultCount).toBe(reportSaved.resultCount);
    observations.push({kind:'archive-replay-unchanged',finalScore,...replaySaved});
    await page.getByRole('link',{name:'Matchrapport',exact:true}).click();await page.getByRole('button',{name:'Ligaläget →',exact:true}).click();
    await page.getByRole('link',{name:'Spelarstatistik',exact:true}).click();await expect(page.locator('main table a[href^="/career/squad/"]').first()).toBeVisible();
    await widths('season-player-statistics');await page.locator('main table a[href^="/career/squad/"]').first().click();
    await expect(page.locator('.game-player-hero')).toBeVisible();await page.getByRole('button',{name:'Prestation & historik',exact:true}).click();
    await expect(page.locator('main a[href^="/career/match-report/"]')).not.toHaveCount(0);await widths('player-recorded-match');
    expect(errors).toEqual([]);receipt.status='PASSED';
  }catch(cause){receipt.status='FAILED';receipt.error=cause instanceof Error?cause.message:String(cause);throw cause;}
  finally{receipt.finishedAt=new Date().toISOString();writeFileSync(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
});
