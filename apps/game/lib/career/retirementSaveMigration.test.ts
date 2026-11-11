import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { migrateCareerState } from './saveMigration';
import { retirePlayer } from './playerLifecycle';
import { TUMBA_SQUAD } from '../game-data';

test('save migration preserves terminal retirement instead of releasing expired retired players back to free agency',()=>{
 let s=createNewCareerState('retirement-reload','swe2-tumba');
 const player=TUMBA_SQUAD[0]!;
 s={...s,worldSquads:{...s.worldSquads,'swe2-tumba':[...structuredClone(TUMBA_SQUAD)]}};
 s=retirePlayer(s,player.id,'2026-08-20');s=JSON.parse(JSON.stringify({...s,gameDate:'2026-08-21'}));
 assert.equal(s.worldSquads.retired!.find(p=>p.id===player.id)?.clubId,'retired');
 const before=JSON.stringify(s),loaded=migrateCareerState(JSON.parse(before));
 assert.deepEqual(loaded.worldSquads,s.worldSquads);assert.deepEqual(loaded.playerContracts,s.playerContracts);
 assert.deepEqual(loaded.gameplayRatings,s.gameplayRatings);
 assert.ok(!(loaded.worldSquads['']??[]).some(p=>p.id===player.id));
 assert.deepEqual(migrateCareerState(JSON.parse(JSON.stringify(loaded))),loaded);
 assert.equal(JSON.stringify(s),before);
});
