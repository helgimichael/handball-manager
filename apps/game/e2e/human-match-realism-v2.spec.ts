import { test, expect as baseExpect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CareerSave } from '../lib/save/saveRepository';

const expect=baseExpect.configure({timeout:30000});
const base=process.env.HM_QA_URL??'http://localhost:3008';
const qa=resolve(process.env.HM_HUMAN_QA_DIR??'../../docs/match-realism-v2/human-qa');
const output=resolve(process.env.HM_HUMAN_SCREENSHOT_DIR??join(qa,'browser'));
type Case={purpose:string;index:number;canonicalSeed:number;fixture:{id:string};score:{HOME:number;AWAY:number};completedFile:string;truthHash:string;archiveHash:string;verifiedAgainstRecordedAfter:boolean};

async function persistedArchive(page:Page,saveId:string,fixtureId:string){
  return page.evaluate(async({saveId,fixtureId})=>{
    async function record(databaseName:string,store:string,key:string):Promise<unknown>{
      const database=await new Promise<IDBDatabase>((resolve,reject)=>{
        const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      try{return await new Promise((resolve,reject)=>{
        const request=database.transaction(store,'readonly').objectStore(store).get(key);
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });}finally{database.close();}
    }
    const save=await record('hm-game','saves',saveId) as CareerSave;
    const career=save.careerState;
    if(!career)throw new Error('QA career disappeared');
    const archive=career.matchArchives?.[fixtureId]??await record('hm-match-archives','archives',`${saveId}:${fixtureId}`);
    if(!archive)throw new Error('QA archive disappeared');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(archive)));
    return {archiveHash:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),
      activeSession:career.productionMatch!=null,resultCount:Object.keys(career.results).length,
      score:[career.results[fixtureId]?.homeGoals,career.results[fixtureId]?.awayGoals]};
  },{saveId,fixtureId});
}

test('three automatically selected real career archives: normal report and visible immutable replay',async({browser})=>{
  test.setTimeout(600000);mkdirSync(output,{recursive:true});
  const manifest=JSON.parse(readFileSync(join(qa,'manifest.json'),'utf8')) as {cases:Case[]};
  expect(manifest.cases).toHaveLength(3);
  const receipt:{status:string;url:string;cases:unknown[];error?:string}={status:'RUNNING',url:base,cases:[]};
  try{
    for(const item of manifest.cases){
      expect(item.verifiedAgainstRecordedAfter).toBe(true);
      const envelope=JSON.parse(readFileSync(join(qa,item.completedFile),'utf8')) as CareerSave;
      expect(envelope.careerState?.matchArchives?.[item.fixture.id]).toBeTruthy();expect(envelope.schemaVersion).toBe(8);
      const context=await browser.newContext({viewport:{width:1920,height:1080}}),page=await context.newPage();
      page.setDefaultTimeout(30000);
      const errors:string[]=[],frames:unknown[]=[],screenshots:string[]=[],layouts:unknown[]=[],archiveProof:Record<string,unknown>={};
      page.on('pageerror',error=>errors.push(error.message));
      const caseReceipt={purpose:item.purpose,index:item.index,canonicalSeed:item.canonicalSeed,fixtureId:item.fixture.id,truthHash:item.truthHash,errors,frames,screenshots,layouts,archiveProof};
      receipt.cases.push(caseReceipt);
      async function frame(label:string){
        const observed=await page.locator('svg[aria-label="Handbollsplan med matchens spelare och boll"]').evaluate(svg=>({
          players:Array.from(svg.querySelectorAll(':scope > g[transform^="translate("]')).map(g=>({name:g.querySelector('title')?.textContent,transform:g.getAttribute('transform')})),
          ball:{x:svg.querySelector(':scope > circle')?.getAttribute('cx'),y:svg.querySelector(':scope > circle')?.getAttribute('cy')},
        }));
        frames.push({label,clock:await page.locator('.game-scoreboard-top').innerText(),score:await page.locator('.game-live-score').innerText(),...observed});
        expect(observed.players.length).toBeGreaterThanOrEqual(10);
        return observed;
      }
      async function shot(label:string,width=1920){
        const directory=join(output,`match-${String(item.index).padStart(3,'0')}`,String(width));mkdirSync(directory,{recursive:true});
        const path=join(directory,`${label}.png`);await page.screenshot({path,animations:'disabled'});screenshots.push(path);
      }
      async function widths(label:string){
        for(const width of [1920,2560]){
          await page.setViewportSize({width,height:1080});await page.evaluate(()=>window.scrollTo(0,0));
          const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
          expect(layout.scrollWidth).toBeLessThanOrEqual(width);layouts.push({label,viewport:width,...layout});await shot(label,width);
          await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await shot(`${label}-max-scroll`,width);
        }
        await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>window.scrollTo(0,0));
      }
      try{
        // Fresh browser context isolates these developer QA saves from the
        // user's normal career. Only the existing IndexedDB shape is imported.
        await page.goto(`${base}/load-game`);
        await page.evaluate(async save=>{
          const database=await new Promise<IDBDatabase>((resolve,reject)=>{
            const request=indexedDB.open('hm-game',1);
            request.onupgradeneeded=()=>{
              if(!request.result.objectStoreNames.contains('saves'))request.result.createObjectStore('saves',{keyPath:'saveId'});
              if(!request.result.objectStoreNames.contains('meta'))request.result.createObjectStore('meta');
            };
            request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
          });
          await new Promise<void>((resolve,reject)=>{
            const transaction=database.transaction('saves','readwrite');transaction.objectStore('saves').put(save);
            transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error);
          });database.close();localStorage.setItem('hm-game:active-save:v1',save.saveId);
        },envelope);
        await page.goto(`${base}/career/match-report/${item.fixture.id}`);
        await expect(page.getByText('Speltid och belastning',{exact:true})).toBeVisible({timeout:90000});
        const archiveBefore=await persistedArchive(page,envelope.saveId,item.fixture.id);
        expect(archiveBefore.archiveHash).toBe(item.archiveHash);expect(archiveBefore.activeSession).toBe(false);archiveProof.before=archiveBefore;
        await expect(page.locator('.game-match-centre > strong')).toHaveText(`${item.score.HOME}–${item.score.AWAY}`);await widths('recorded-report');
        await page.getByRole('button',{name:'Se matchrepris',exact:true}).click();await page.waitForURL('**/career/match-day/**');
        await expect(page.getByText('Repris',{exact:true})).toBeVisible({timeout:60000});
        const slider=page.getByLabel('Position i reprisen',{exact:true});await slider.press('Home');await frame('start');await widths('replay-start');
        for(const speed of [1,4,16]){
          await page.getByLabel('Reprishastighet',{exact:true}).selectOption(String(speed));await page.getByRole('button',{name:'Spela',exact:true}).click();
          const before=await frame(`${speed}x-before`);
          await page.waitForTimeout(1000);await frame(`${speed}x-frame-1`);await shot(`${speed}x-frame-1`);
          await page.waitForTimeout(1000);const after=await frame(`${speed}x-frame-2`);await shot(`${speed}x-frame-2`);
          await page.getByRole('button',{name:'Pausa',exact:true}).click();
          expect(after.players.some(p=>before.players.find(previous=>previous.name===p.name)?.transform!==p.transform)).toBe(true);
        }
        const bounds=await slider.boundingBox();expect(bounds).not.toBeNull();await slider.click({position:{x:bounds!.width/2,y:bounds!.height/2}});
        await frame('middle');await widths('replay-middle');await slider.press('End');
        await expect(page.locator('.game-live-score')).toHaveText(`${item.score.HOME}:${item.score.AWAY}`);await frame('end');await widths('replay-end');
        await page.getByRole('link',{name:'Matchrapport',exact:true}).click();await expect(page.locator('.game-match-centre > strong')).toHaveText(`${item.score.HOME}–${item.score.AWAY}`);
        const archiveAfter=await persistedArchive(page,envelope.saveId,item.fixture.id);
        expect(archiveAfter).toEqual(archiveBefore);archiveProof.after=archiveAfter;
        expect(errors).toEqual([]);
      }finally{await context.close();}
    }
    receipt.status='PASSED';
  }catch(cause){receipt.status='FAILED';receipt.error=cause instanceof Error?cause.message:String(cause);throw cause;}
  finally{writeFileSync(join(output,'human-browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
});
