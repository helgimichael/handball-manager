import { test, expect as baseExpect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CareerSave } from '../lib/save/saveRepository';
import type { PlayedMatchArchive } from '../lib/career/productionMatch';
import { decodeFrames, frameAt } from '../lib/career/matchFrames';

const expect=baseExpect.configure({timeout:30000});
const base=process.env.HM_QA_URL??'http://127.0.0.1:3009';
const output=resolve(process.env.HM_QA_SCREENSHOT_DIR??'../../docs/match-realism-v21/browser');
const courtSelector='svg[aria-label="Handbollsplan med matchens spelare och boll"]';

async function archiveEvidence(page:Page,fixtureId:string){
  return page.evaluate(async fixtureId=>{
    async function read(databaseName:string,store:string,key:string):Promise<unknown>{
      const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      try{return await new Promise((resolve,reject)=>{const request=database.transaction(store,'readonly').objectStore(store).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{database.close();}
    }
    const saveId=localStorage.getItem('hm-game:active-save:v1');if(!saveId)throw new Error('Missing active QA career');
    const save=await read('hm-game','saves',saveId) as CareerSave,career=save.careerState;
    if(!career)throw new Error('Missing QA career state');
    const archive=(career.matchArchives?.[fixtureId]??await read('hm-match-archives','archives',`${saveId}:${fixtureId}`)) as PlayedMatchArchive;
    if(!archive)throw new Error('Missing actual recorded archive');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(archive)));
    const resultDigest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(archive.result)));
    return {hash:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),seed:archive.seed,
      resultHash:Array.from(new Uint8Array(resultDigest),n=>n.toString(16).padStart(2,'0')).join(''),
      score:[archive.result.homeGoals,archive.result.awayGoals],activeSession:career.productionMatch!=null,
      events:archive.events,people:archive.people,frameData:archive.frameData??null,frames:archive.frames??null,behaviorRevision:archive.behaviorRevision??null};
  },fixtureId);
}

async function importQa(page:Page,envelope:CareerSave){
  await page.goto(`${base}/load-game`);
  await page.evaluate(async save=>{
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('hm-game',1);request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains('saves'))request.result.createObjectStore('saves',{keyPath:'saveId'});
        if(!request.result.objectStoreNames.contains('meta'))request.result.createObjectStore('meta');
      };request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    await new Promise<void>((resolve,reject)=>{const transaction=database.transaction('saves','readwrite');transaction.objectStore('saves').put(save);transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error);});
    database.close();localStorage.setItem('hm-game:active-save:v1',save.saveId);
  },envelope);
}

async function recordScenes(page:Page,fixtureId:string,directory:string,observations:unknown[]){
  const evidence=await archiveEvidence(page,fixtureId),person=new Map(evidence.people.map(p=>[p.id,p]));
  const recordedFrames=evidence.frameData?decodeFrames(evidence.frameData):evidence.frames??[];
  const shotRange=(e:typeof evidence.events[number])=>{
    const second=evidence.events.some(p=>p.type==='PERIOD_STARTED'&&p.tick<=e.tick&&p.details.period===2);
    const top=person.get(e.actorId??'')?.team==='HOME'?!second:second;
    return Math.hypot(Number(e.details.x)-10,top?Number(e.details.y):40-Number(e.details.y));
  };
  const shots=evidence.events.filter(e=>e.type==='SHOT_RELEASED');
  const savedAction=new Set(evidence.events.filter(e=>e.type.startsWith('SAVE_')).map(e=>e.actionId));
  const cues=[
    {name:'near-six-metres',event:shots.find(e=>shotRange(e)<8)},
    {name:'keeper-backcourt-save',event:shots.find(e=>savedAction.has(e.actionId)&&['BACKCOURT_JUMP','STANDING'].includes(String(e.details.shotKind)))},
    {name:'seven-metres',event:shots.find(e=>e.details.shotKind==='SEVEN_METRE')},
    {name:'pivot-cooperation',event:shots.find(e=>e.details.shotKind==='PIVOT')??evidence.events.find(e=>e.type==='PASS_RECEIVED'&&person.get(e.actorId??'')?.role==='P')},
    {name:'wing-shot',event:shots.find(e=>e.details.shotKind==='WING')},
    {name:'keeper-outlet',event:evidence.events.find(e=>e.type==='PASS_RELEASED'&&person.get(e.actorId??'')?.role==='GK')},
    {name:'turnover-retreat',event:evidence.events.find(e=>e.type==='INTERCEPTION'||e.type==='REBOUND_CONTROLLED'&&person.get(e.actorId??'')?.team!==person.get(e.relatedIds[0])?.team)},
    {name:'transition-finish',event:shots.find(e=>e.details.phase==='TRANSITION'&&shotRange(e)<12)},
    {name:'settled-handoff',event:evidence.events.find(e=>e.type==='ATTACK_SETTLED')},
    {name:'actual-whistle',event:evidence.events.find(e=>e.type==='WHISTLE_RESTART')},
    {name:'advantage-continuation',event:evidence.events.find(e=>e.type==='ADVANTAGE_REALIZED')},
  ];
  const slider=page.getByLabel('Position i reprisen',{exact:true});
  const minimum=Number(await slider.getAttribute('min')),maximum=Number(await slider.getAttribute('max'));
  for(const cue of cues){
    if(!cue.event){observations.push({kind:'scene-unavailable',name:cue.name,fixtureId,note:'Not manufactured to satisfy a category quota'});continue;}
    const sequence=[];
    for(const offset of [-5,5,25]){
      const desired=Math.max(minimum,Math.min(maximum,cue.event.tick+offset));
      await slider.evaluate((element,value)=>{
        const input=element as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String(value));
        input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
      },desired);
      await expect(slider).toHaveValue(String(desired));
      // A native key adjustment also exercises the actual React seek handler;
      // changing an input property alone is not evidence of rendered playback.
      if(desired<maximum){await slider.press('ArrowRight');await slider.press('ArrowLeft');}
      else{await slider.press('ArrowLeft');await slider.press('ArrowRight');}
      await expect(slider).toHaveValue(String(desired));
      const expected=frameAt(recordedFrames,desired);
      await expect.poll(async()=>Number(await page.locator(`${courtSelector} > circle`).getAttribute('cx')),{timeout:10000}).toBeCloseTo(4000-expected[6],3);
      await expect.poll(async()=>Number(await page.locator(`${courtSelector} > circle`).getAttribute('cy')),{timeout:10000}).toBeCloseTo(expected[5],3);
      const visible=await page.locator(courtSelector).evaluate(svg=>({players:Array.from(svg.querySelectorAll(':scope > g[transform^="translate("]')).map(g=>({name:g.querySelector('title')?.textContent,transform:g.getAttribute('transform')})),ball:{x:svg.querySelector(':scope > circle')?.getAttribute('cx'),y:svg.querySelector(':scope > circle')?.getAttribute('cy')}}));
      sequence.push({tick:desired,clock:await page.locator('.game-scoreboard-top').innerText(),...visible});
      for(const width of offset===5?[1920,2560]:[1920]){
        await page.setViewportSize({width,height:1080});await page.evaluate(()=>window.scrollTo(0,0));
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const target=join(directory,String(width));mkdirSync(target,{recursive:true});await page.screenshot({path:join(target,`${cue.name}-${offset}.png`),animations:'disabled'});
      }
      await page.setViewportSize({width:1920,height:1080});
    }
    observations.push({kind:'actual-recorded-scene',name:cue.name,fixtureId,event:cue.event,sequence});
  }
  const after=await archiveEvidence(page,fixtureId);expect(after.hash).toBe(evidence.hash);expect(after.activeSession).toBe(false);
  observations.push({kind:'scene-archive-unchanged',fixtureId,before:evidence.hash,after:after.hash,score:after.score});
}

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
      const initialDigest=core?.tick===0&&session?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({fixture:session.fixture,core,people:session.people}))):null;
      return {saveId,saveSeed:career.saveSeed,fixtureId:session?.fixture.id??null,seed:core?.seed??null,
        coreHash:digest?Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''):null,
        initialSessionHash:initialDigest?Array.from(new Uint8Array(initialDigest),n=>n.toString(16).padStart(2,'0')).join(''):null,
        tick:core?.tick??null,officialMs:core?.officialClock.timeMs??null,phase:core?.match?.phase??null,
        rng:core?.rng??null,score:core?.score??null,
        archiveIds:career.matchArchiveIds??[],resultCount:Object.keys(career.results).length,
        resultScores:Object.fromEntries(Object.entries(career.results).map(([id,result])=>[id,[result.homeGoals,result.awayGoals]])),
        commands:core?.events.filter(e=>['TACTICS_CHANGED','EXCHANGE_REQUESTED','SUBSTITUTE_ADMITTED','EXCHANGE_COMPLETED','TEAM_TIMEOUT_STARTED','WHISTLE_RESTART','ADVANTAGE_REALIZED'].includes(e.type)).map(e=>({type:e.type,tick:e.tick,actorId:e.actorId,details:e.details}))??[]};
    }finally{database.close();}
  });
}

test('calibrated v2.1 career match: visible 2D at live speeds, coaching, both halves, persistence, report and archived replay',async({page})=>{
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
    const visibleEvents=await page.locator('.coach-live-event strong').allTextContents();
    observations.push({kind:'rendered-2d',label,wallTime:new Date().toISOString(),clock,score,visibleEvents,
      visibleWhistle:visibleEvents.includes('Avblåsning'),visibleAdvantage:visibleEvents.includes('Fördel spelad'),...frame});
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
    await page.getByPlaceholder('För- och efternamn').fill('Match Calibration v2.1 Browser QA');
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
    await recordScenes(page,fixtureId,join(output,'normal-match-scenes'),observations);
    await page.getByRole('link',{name:'Matchrapport',exact:true}).click();await page.getByRole('button',{name:'Ligaläget →',exact:true}).click();
    await page.getByRole('link',{name:'Spelarstatistik',exact:true}).click();await expect(page.locator('main table a[href^="/career/squad/"]').first()).toBeVisible();
    await widths('season-player-statistics');await page.locator('main table a[href^="/career/squad/"]').first().click();
    await expect(page.locator('.game-player-hero')).toBeVisible();await page.getByRole('button',{name:'Prestation & historik',exact:true}).click();
    await expect(page.locator('main a[href^="/career/match-report/"]')).not.toHaveCount(0);await widths('player-recorded-match');
    expect(errors).toEqual([]);receipt.status='PASSED';
  }catch(cause){receipt.status='FAILED';receipt.error=cause instanceof Error?cause.message:String(cause);throw cause;}
  finally{receipt.finishedAt=new Date().toISOString();writeFileSync(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
});

test('retained19–19 replay stays immutable on the new build; same pinned recipe starts a new canonical match',async({browser})=>{
  test.setTimeout(600000);
  const oldDirectory=resolve(process.env.HM_OLD_REALISM_QA_DIR??'../../docs/match-realism-v2/human-qa');
  const oldCompleted=JSON.parse(readFileSync(join(oldDirectory,'match-016-completed.json'),'utf8')) as CareerSave;
  const oldInitial=JSON.parse(readFileSync(join(oldDirectory,'match-016-initial.json'),'utf8')) as CareerSave;
  const oldManifest=JSON.parse(readFileSync(join(oldDirectory,'manifest.json'),'utf8')) as {cases:{index:number;archiveHash:string;canonicalSeed:number}[]};
  const oldCase=oldManifest.cases.find(c=>c.index===16)!;
  const recordedPath=resolve(process.env.HM_CALIBRATION_AFTER_DIR??'../../docs/match-realism-v21/after','match-016.json');
  expect(existsSync(recordedPath),'Final recorded same-seed calibration sample must exist before QA').toBe(true);
  const recorded=JSON.parse(readFileSync(recordedPath,'utf8')) as {canonicalSeed:number;initialSessionHash:string;resultHash:string;result:{homeGoals:number;awayGoals:number}};
  const fixtureId=oldInitial.careerState!.productionMatch!.fixture.id;
  const receipt:{status:string;errors:string[];observations:unknown[];error?:string}={status:'RUNNING',errors:[],observations:[]};
  const directory=join(output,'retained-seed16');mkdirSync(directory,{recursive:true});
  async function observed(page:Page,label:string){
    const frame=await page.locator(courtSelector).evaluate(svg=>({players:Array.from(svg.querySelectorAll(':scope > g[transform^="translate("]')).map(g=>({name:g.querySelector('title')?.textContent,transform:g.getAttribute('transform')})),ball:{x:svg.querySelector(':scope > circle')?.getAttribute('cx'),y:svg.querySelector(':scope > circle')?.getAttribute('cy')}}));
    receipt.observations.push({kind:'rendered-2d',label,clock:await page.locator('.game-scoreboard-top').innerText(),...frame});
    const target=join(directory,'1920');mkdirSync(target,{recursive:true});await page.screenshot({path:join(target,`${label}.png`),animations:'disabled'});return frame;
  }
  const oldContext=await browser.newContext({viewport:{width:1920,height:1080}}),oldPage=await oldContext.newPage();
  oldPage.on('pageerror',error=>receipt.errors.push(error.message));
  try{
    await importQa(oldPage,oldCompleted);await oldPage.goto(`${base}/career/match-report/${fixtureId}`);
    await expect(oldPage.locator('.game-match-centre > strong')).toHaveText('19–19',{timeout:90000});
    const before=await archiveEvidence(oldPage,fixtureId);expect(before.hash).toBe(oldCase.archiveHash);expect(before.activeSession).toBe(false);
    await oldPage.getByRole('button',{name:'Se matchrepris',exact:true}).click();await oldPage.waitForURL('**/career/match-day/**');
    await expect(oldPage.getByText('Repris',{exact:true})).toBeVisible({timeout:60000});
    for(const speed of [1,4,16]){
      await oldPage.getByLabel('Reprishastighet',{exact:true}).selectOption(String(speed));await oldPage.getByRole('button',{name:'Spela',exact:true}).click();
      await oldPage.waitForTimeout(1000);const a=await observed(oldPage,`old-${speed}x-before`);await oldPage.waitForTimeout(1000);const b=await observed(oldPage,`old-${speed}x-after`);
      expect(b.players.some(p=>a.players.find(prior=>prior.name===p.name)?.transform!==p.transform)).toBe(true);await oldPage.getByRole('button',{name:'Pausa',exact:true}).click();
    }
    await oldPage.getByLabel('Position i reprisen',{exact:true}).press('End');await expect(oldPage.locator('.game-live-score')).toHaveText('19:19');await observed(oldPage,'old-recorded-end');
    const after=await archiveEvidence(oldPage,fixtureId);expect(after.hash).toBe(before.hash);expect(after.activeSession).toBe(false);
    receipt.observations.push({kind:'old-archive-preserved',seed:before.seed,score:before.score,before:before.hash,after:after.hash,behaviorRevision:before.behaviorRevision});
  }catch(cause){receipt.status='FAILED';receipt.error=cause instanceof Error?cause.message:String(cause);writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');throw cause;}
  finally{await oldContext.close();}

  const newContext=await browser.newContext({viewport:{width:1920,height:1080}}),page=await newContext.newPage();
  page.on('pageerror',error=>receipt.errors.push(error.message));page.setDefaultTimeout(30000);
  try{
    // Preserve the pinned world/ratings/date/seed recipe, and explicitly start
    // a NEW match through the normal preview. The old active session is not
    // resumed under different mechanics, and its archive is never replaced.
    const fresh=structuredClone(oldInitial);fresh.saveId='hm-calibration-v21-seed16-new';fresh.manager.name='Calibration v2.1 · same pinned seed16';
    fresh.careerState!.productionMatch=null;fresh.careerState!.activeMatchSession=null;
    await importQa(page,fresh);await page.goto(`${base}/career/match-preview`);
    await expect(page.getByRole('button',{name:'STARTA MATCH →',exact:true})).toBeVisible({timeout:90000});
    await page.getByRole('button',{name:'STARTA MATCH →',exact:true}).click();await page.waitForURL('**/career/match-day/**');
    await expect(page.locator(courtSelector)).toBeVisible({timeout:60000});await page.getByRole('button',{name:'Spara',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Sparat'})).toBeVisible();const started=await savedFacts(page);
    expect(started.seed).toBe(oldCase.canonicalSeed);expect(started.saveSeed).toBe(oldInitial.careerState!.saveSeed);
    expect(started.initialSessionHash).toBe(recorded.initialSessionHash);
    receipt.observations.push({kind:'new-same-seed-started',source:'Pinned kickoff envelope with old live session cleared; normal Match Preview start',...started});
    await observed(page,'new-kickoff');
    for(const speed of [1,4,16]){
      await page.getByLabel('Matchhastighet',{exact:true}).selectOption(String(speed));await page.getByRole('button',{name:'Spela',exact:true}).click();
      await page.waitForTimeout(1000);const a=await observed(page,`new-${speed}x-before`);await page.waitForTimeout(2000);const b=await observed(page,`new-${speed}x-after`);
      expect(b.players.some(p=>a.players.find(prior=>prior.name===p.name)?.transform!==p.transform)).toBe(true);await page.getByRole('button',{name:'Pausa',exact:true}).click();
    }
    await page.getByLabel('Matchhastighet',{exact:true}).selectOption('64');await page.getByRole('button',{name:'Spela',exact:true}).click();
    await expect(page.locator('.game-live-match')).toHaveAttribute('data-phase','halftime',{timeout:240000});await expect(page.locator('.game-scoreboard')).toContainText('30:00');await observed(page,'new-halftime');
    await page.getByRole('button',{name:'Starta andra halvlek',exact:true}).click();await expect(page.locator('.game-scoreboard')).toContainText('Andra halvlek');
    await page.waitForTimeout(1000);await page.getByRole('button',{name:'Pausa',exact:true}).click();await page.getByRole('button',{name:'Spela till slut',exact:true}).click();
    await page.waitForURL('**/career/match-report/**',{timeout:180000});await expect(page.getByText('Speltid och belastning',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Spara',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Sparat'})).toBeVisible();
    const current=await archiveEvidence(page,fixtureId);expect(current.seed).toBe(oldCase.canonicalSeed);
    expect(current.seed).toBe(recorded.canonicalSeed);expect(current.score).toEqual([recorded.result.homeGoals,recorded.result.awayGoals]);
    expect(current.resultHash).toBe(recorded.resultHash);
    receipt.observations.push({kind:'new-same-seed-result',oldScore:[19,19],newScore:current.score,archiveHash:current.hash,behaviorRevision:current.behaviorRevision});
    await page.getByRole('button',{name:'Se matchrepris',exact:true}).click();await page.waitForURL('**/career/match-day/**');await expect(page.getByText('Repris',{exact:true})).toBeVisible();
    await recordScenes(page,fixtureId,join(directory,'new-scenes'),receipt.observations);
    expect(receipt.errors).toEqual([]);receipt.status='PASSED';
  }catch(cause){receipt.status='FAILED';receipt.error=cause instanceof Error?cause.message:String(cause);throw cause;}
  finally{await newContext.close();writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
});
