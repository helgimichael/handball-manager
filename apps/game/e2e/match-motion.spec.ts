import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { advanceProductionMatch, archiveFrames } from '../lib/career/productionMatch';
import { frameAt } from '../lib/career/matchFrames';
import type { CareerSave } from '../lib/save/saveRepository';
const base=process.env.HM_QA_URL??'http://127.0.0.1:3009';
const output=resolve(process.env.HM_MOTION_BROWSER_OUT??'../../docs/match-motion-continuity/browser-baseline');
const court='svg[aria-label="Handbollsplan med matchens spelare och boll"]';
test.use({viewport:{width:1920,height:1080},video:'on'});
async function install(page:import('@playwright/test').Page,save:CareerSave){
  await page.goto(`${base}/load-game`);
  await expect(page.getByRole('heading',{name:'Ladda spel',exact:true})).toBeVisible({timeout:60000});
  await page.evaluate(async save=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('hm-game',1);r.onupgradeneeded=()=>{r.result.createObjectStore('saves',{keyPath:'saveId'});r.result.createObjectStore('meta');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(save);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();localStorage.setItem('hm-game:active-save:v1',save.saveId);
  },save);
}
async function sample(page:import('@playwright/test').Page,seconds:number){
  return page.evaluate(async({court,seconds})=>{
    const result:{ms:number;tick:number|null;poses:string[];ball:string[]}[]=[];
    const start=performance.now();
    await new Promise<void>(resolve=>{const next=(now:number)=>{const svg=document.querySelector(court)!;result.push({ms:now-start,tick:svg.hasAttribute('data-render-tick')?Number(svg.getAttribute('data-render-tick')):null,poses:Array.from(svg.querySelectorAll(':scope > g[transform^="translate("]')).map(g=>g.getAttribute('transform')!),ball:[svg.querySelector(':scope > circle')!.getAttribute('cx')!,svg.querySelector(':scope > circle')!.getAttribute('cy')!]});if(now-start<seconds*1000)requestAnimationFrame(next);else resolve();};requestAnimationFrame(next);});return result;
  },{court,seconds});
}
test('normal career motion: live and immutable replay at 1x/4x/16x, pause and seek',async({page})=>{
  test.setTimeout(180000);page.setDefaultTimeout(30000);expect.configure({timeout:30000});mkdirSync(output,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message);});
  const records:unknown[]=[];
  const initial=JSON.parse(readFileSync(resolve('../../docs/match-realism-v21/human-qa/match-007-initial.json'),'utf8')) as CareerSave;
  initial.careerState=advanceProductionMatch(initial.careerState!,400,false);
  await install(page,initial);await page.goto(`${base}/career/match-day/swe-2-f7`);await expect(page.locator(court)).toBeVisible({timeout:60000});
  for(const speed of [1,4,16]){
    await page.getByLabel('Matchhastighet',{exact:true}).selectOption(String(speed));await page.getByRole('button',{name:'Spela',exact:true}).click();
    const sequence=await sample(page,4);await page.getByRole('button',{name:'Pausa',exact:true}).click();records.push({mode:'live',speed,sequence});
    const paused=await sample(page,.3);expect(new Set(paused.map(s=>JSON.stringify(s.poses))).size).toBe(1);
  }
  await page.screenshot({path:join(output,'live.png')});
  const completed=JSON.parse(readFileSync(resolve(process.env.HM_MOTION_QA_SAVE??'../../docs/match-realism-v21/human-qa/match-007-completed.json'),'utf8')) as CareerSave;
  const archive=completed.careerState!.matchArchives!['swe-2-f7'],frames=archiveFrames(archive);
  writeFileSync(join(output,'live-sequences.json'),JSON.stringify(records));
  await install(page,completed);await page.goto(`${base}/career/match-day/swe-2-f7`);await expect(page.locator(court)).toBeVisible({timeout:30000});
  const slider=page.getByLabel('Position i reprisen',{exact:true});
  for(const speed of [1,4,16]){
    await slider.fill('450');await slider.press('ArrowRight');await slider.press('ArrowLeft');
    const expected=frameAt(frames,450);await expect.poll(async()=>Number(await page.locator(`${court} > circle`).getAttribute('cx'))).toBeCloseTo(4000-expected[6],3);
    await page.getByLabel('Reprishastighet',{exact:true}).selectOption(String(speed));await page.getByRole('button',{name:'Spela',exact:true}).click();
    const sequence=await sample(page,4);await page.getByRole('button',{name:'Pausa',exact:true}).click();
    if(sequence[0].tick!==null){for(const s of sequence){const truth=frameAt(frames,s.tick!);expect(Number(s.ball[0])).toBeCloseTo(4000-truth[6],3);expect(Number(s.ball[1])).toBeCloseTo(truth[5],3);expect(s.poses).toEqual(Array.from({length:(truth.length-7)/3},(_,n)=>`translate(${4000-truth[9+n*3]} ${truth[8+n*3]})`));}}
    records.push({mode:'replay',speed,sequence});
    const paused=await sample(page,.3);expect(new Set(paused.map(s=>JSON.stringify(s.poses))).size).toBe(1);
  }
  const unchanged=await page.evaluate(async fixture=>{const id=localStorage.getItem('hm-game:active-save:v1');async function read(name:string,store:string,key:string|null){const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open(name,1);r.onsuccess=()=>resolve(r.result);});const value=await new Promise<any>(resolve=>{const r=db.transaction(store,'readonly').objectStore(store).get(key!);r.onsuccess=()=>resolve(r.result);});db.close();return value;}const save=await read('hm-game','saves',id) as CareerSave;return save.careerState!.matchArchives?.[fixture]??await read('hm-match-archives','archives',`${id}:${fixture}`);},'swe-2-f7');
  expect(unchanged).toEqual(archive);expect(errors).toEqual([]);
  writeFileSync(join(output,'sequences.json'),JSON.stringify({base,errors,records}));
  writeFileSync(join(output,'receipt.json'),JSON.stringify({base,errors,records:records.map((r:any)=>({mode:r.mode,speed:r.speed,renderSamples:r.sequence.length,changedPoses:r.sequence.filter((s:any,i:number)=>i&&JSON.stringify(s.poses)!==JSON.stringify(r.sequence[i-1].poses)).length})),archiveUnchanged:true},null,2));
  await page.close();await page.video()?.saveAs(join(output,'normal-career-motion.webm'));
});

test('full canonical replay and actual handball scenes in all three motion archives',async({page})=>{
  test.setTimeout(800000);mkdirSync(output,{recursive:true});const scenes:unknown[]=[];
  for(const index of [7,3,28]){
    const save=JSON.parse(readFileSync(resolve(`${process.env.HM_MOTION_ARCHIVE_DIR??'../../docs/match-motion-continuity/after-final'}/match-${String(index).padStart(3,'0')}-completed.json`),'utf8')) as CareerSave;
    const archive=Object.values(save.careerState!.matchArchives!)[0];await install(page,save);await page.goto(`${base}/career/match-day/${archive.fixture.id}`);await expect(page.locator(court)).toBeVisible({timeout:60000});
    const cues=[['settled circulation',archive.events.find(e=>e.type==='PASS_RELEASED'&&e.details.phase==='ESTABLISHED')],['breakthrough',archive.events.find(e=>e.type==='DRIVE_RELEASED')],['defensive help',archive.events.find(e=>e.type==='CONTACT_EXECUTED')],['transition and retreat',archive.events.find(e=>e.type==='POSSESSION_CHANGED')],['pivot screen',archive.events.find(e=>e.type==='SCREEN_CONTACT')],['settled handoff',archive.events.find(e=>e.type==='ATTACK_SETTLED')]] as const;
    for(const [name,event] of cues){if(!event){scenes.push({index,name,available:false});continue;}const tick=Math.max(0,event.tick-15);const slider=page.getByLabel('Position i reprisen',{exact:true});await slider.fill(String(tick));await slider.press('ArrowRight');await slider.press('ArrowLeft');await page.getByLabel('Reprishastighet',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Spela',exact:true}).click();const sequence=await sample(page,2);await page.getByRole('button',{name:'Pausa',exact:true}).click();scenes.push({index,name,event,sequence});}
    if(index===7){const slider=page.getByLabel('Position i reprisen',{exact:true});await slider.fill('0');await slider.press('ArrowRight');await slider.press('ArrowLeft');await page.getByLabel('Reprishastighet',{exact:true}).selectOption('16');await page.getByRole('button',{name:'Spela',exact:true}).click();await expect.poll(async()=>Number(await page.locator(court).getAttribute('data-render-tick')),{timeout:650000,intervals:[1000]}).toBe(archiveFrames(archive).at(-1)![0]);await page.getByRole('button',{name:'Pausa',exact:true}).click();scenes.push({index,fullReplay:true,speed:16,score:[archive.result.homeGoals,archive.result.awayGoals]});}
  }
  writeFileSync(join(output,'handball-scenes.json'),JSON.stringify(scenes));await page.close();await page.video()?.saveAs(join(output,'full-match-and-scenes.webm'));
});

test('actual canonical help, recovery, M6 and support cues at 1x',async({page})=>{
  test.setTimeout(300000);mkdirSync(output,{recursive:true});const records:unknown[]=[];
  for(const index of [7,3,28]){
    const save=JSON.parse(readFileSync(resolve(`../../docs/match-motion-continuity/final/motion/match-${String(index).padStart(3,'0')}-completed.json`),'utf8')) as CareerSave;
    const archive=Object.values(save.careerState!.matchArchives!)[0],frames=archiveFrames(archive);
    const catalog=JSON.parse(readFileSync(resolve(`../../docs/match-motion-continuity/final/scene-source/scenes-${index}.json`),'utf8')) as {fixtureId:string;seed:number;frameHash:string;scenes:{name:string;event:{tick:number};actor:unknown}[]};
    expect(catalog.fixtureId).toBe(archive.fixture.id);expect(catalog.seed).toBe(archive.seed);expect(catalog.frameHash).toBe(createHash('sha256').update(JSON.stringify(frames)).digest('hex'));
    await install(page,save);await page.goto(`${base}/career/match-day/${archive.fixture.id}`);await expect(page.locator(court)).toBeVisible({timeout:60000});
    for(const name of ['defensive help','helper recovery or reconnection','transition and retreat','keeper distribution','M6 screen','passer after release','off-ball support']){
      const cue=catalog.scenes.find(cue=>cue.name===name);expect(cue,`Actual ${name} cue for case ${index}`).toBeTruthy();if(!cue)continue;
      const slider=page.getByLabel('Position i reprisen',{exact:true}),tick=Math.max(0,cue.event.tick-10);await slider.fill(String(tick));await slider.press('ArrowRight');await slider.press('ArrowLeft');await page.getByLabel('Reprishastighet',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Spela',exact:true}).click();const sequence=await sample(page,2);await page.getByRole('button',{name:'Pausa',exact:true}).click();records.push({index,...cue,sequence});
    }
  }
  writeFileSync(join(output,'canonical-cues.json'),JSON.stringify(records));await page.close();await page.video()?.saveAs(join(output,'canonical-cues.webm'));
});
