/** Read an exported developer trace. Never resumes or resimulates an archive. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {DecisionTrace,DefensiveTrace} from '@handball-manager/handball-engine/src/v2/core/intelligence';
const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const file=option('--file');if(!file)throw Error('Provide --file exported-intelligence.json; filter with --player, --possession, --action or --motor.');
const input=JSON.parse(readFileSync(resolve(file),'utf8'));
let player=option('--player'),possession=option('--possession'),action=option('--action');
const eventId=option('--event'),archivePath=option('--archive');
if(eventId){if(!archivePath)throw Error('--event needs --archive containing the immutable event list');const archive=JSON.parse(readFileSync(resolve(archivePath),'utf8')),event=archive.events?.find((e:any)=>e.id===eventId);if(!event)throw Error('Event not found in supplied archive');player=event.actorId;possession=event.possessionId;action=event.actionId;}
const clock=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
if(args.includes('--defence')){
 const rows:DefensiveTrace[]=(input.defensiveTraces??[]).filter((t:DefensiveTrace)=>(!player||t.playerId===player)&&(!possession||t.possessionId===possession));
 if(!rows.length)console.log('No captured defensive trace in this bounded export.');
 for(const t of args.includes('--last')?rows.slice(-1):rows)console.log(`Simulation ${clock(t.timeMs)} / tick ${t.tick}\n${t.playerId}; ${t.possessionId}\nIntent: ${t.intent}\nSituation: ${t.read.situations.join(', ')}\nPrimary: ${t.read.primaryId}; helper: ${t.read.helperId}; own threat: ${t.read.ownThreatId}\nUnit: ${JSON.stringify(t.read.unit)}\nWhy: ${t.read.reason}\n`);
}else{
 const motor=option('--motor'),situation=option('--situation'),rows:DecisionTrace[]=(input.traces??[]).filter((t:DecisionTrace)=>(!player||t.playerId===player)&&(!possession||t.possessionId===possession)&&(!action||t.actionId===action)&&(!motor||t.actualMotor===motor)&&(!situation||t.decision.situations.some(s=>s===situation)));
 if(!rows.length)console.log('No captured decision in this bounded export. Old archives do not require traces.');
 for(const t of args.includes('--last')?rows.slice(-1):rows){const d=t.decision,r=d.perception;console.log(`Simulation ${clock(t.timeMs)} / tick ${t.tick}\n${t.playerId} (${r.self.role}); ${t.possessionId}; ${t.actionId}\nSituation: ${d.situations.join(', ')}\nPrimary beaten: ${r.primary?.beaten??false}; goal lane: ${r.space.open}; help distance: ${r.help?.distance??'none'}; help committed: ${r.help?.committed??false}\nAdvantage: ${JSON.stringify(d.advantage)}\nPrevious intent: ${d.previous?.kind??'none'}; commitment: ${d.previous?.commitment??0}\nActual: ${t.actualMotor} to ${t.actualTargetId??'goal/space'}\nWhy/change: ${d.reason}; break: ${d.breakCondition??'none'}\nCandidate values (existing V2 fallback uses its recorded reason):\n${d.affordances.map(c=>`${c.name} ${c.targetId??''}: ${c.value.toFixed(3)} ${JSON.stringify(c.components)}`).join('\n')}\n`);}
}
