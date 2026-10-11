/** Developer-only, actual displacement diagnostics. Never changes gameplay or RNG. */
import type { CoreState } from '@handball-manager/handball-engine/src/v2/core/state';
import { distribution } from './calibrationDiagnostics';

type Sample = { tick:number; id:string; team:string; role:string; group:string; live:boolean; possession:string; phase:string; duty:string; action:string|null; actionId:string|null; actionPhase:string|null; intent:string; target:{x:number;y:number}|null; x:number;y:number;vx:number;vy:number;speed:number; acceleration:number; turn:number; distance:number };
type Track = { last:Sample; movingTicks:number; groupTicks:number; stopTicks:number; pendingStop:number; hadMovement:boolean; stops:number[]; segments:number[] };
type Totals = { ticks:number;zero:number;low:number;stationary:number;distance:number;targets:number;intents:number;actions:number;resets:number;frozenVelocity:number;turns:number;acceleration:number;stops:number[];segments:number[] };
const empty=():Totals=>({ticks:0,zero:0,low:0,stationary:0,distance:0,targets:0,intents:0,actions:0,resets:0,frozenVelocity:0,turns:0,acceleration:0,stops:[],segments:[]});
export class MotionDiagnostics {
  readonly players:Record<string,Totals>={};
  readonly groups:Record<string,Totals>={};
  readonly trajectory:Sample[]=[];
  private tracks=new Map<string,Track>();
  private possessions=new Set<string>();
  observe=(s:Readonly<CoreState>)=>{
    for(const p of s.players){
      if(p.population!=='COURT'){this.flush(p.id);continue;}
      const old=this.tracks.get(p.id), last=old?.last;
      const distance=last?Math.hypot(p.position.x-last.x,p.position.y-last.y):0;
      // Displacement, rather than claimed velocity, detects frozen action phases.
      const speed=distance/.05;
      const live=s.ball.live&&s.officialClock.running&&!s.referee.timeout;
      const group=p.kind==='GOALKEEPER'?'keeper':s.possession.phase==='TRANSITION'?(p.team===s.possession.team?'transitionRun':'retreat')
        :p.team!==s.possession.team?'defensiveShift':s.ball.controllerId===p.id?'carrier':p.role==='P'||p.role==='P2'?'pivot':'support';
      const previousSpeed=last?.speed??0;
      const dot=last&&distance>1e-6&&last.distance>1e-6?((p.position.x-last.x)*last.vx+(p.position.y-last.y)*last.vy)/(distance*Math.hypot(last.vx,last.vy)):1;
      const movementTarget=p.action?.target;
      const sample:Sample={tick:s.tick,id:p.id,team:p.team,role:p.role,group,live,possession:s.possession.id,phase:s.possession.phase,duty:p.duty.kind,action:p.action?.kind??null,actionId:p.action?.id??null,actionPhase:p.action?.phase??null,intent:p.intent.effect,target:movementTarget?{...movementTarget}:null,x:p.position.x,y:p.position.y,vx:p.velocity.x,vy:p.velocity.y,speed,acceleration:(speed-previousSpeed)/.05,turn:Math.acos(Math.max(-1,Math.min(1,dot))),distance};
      if(s.tick>=400&&s.tick<=800)this.trajectory.push(sample);
      const totals=this.players[p.id]??=empty(), grouped=this.groups[group]??=empty();
      const track=old??{last:sample,movingTicks:0,groupTicks:0,stopTicks:0,pendingStop:0,hadMovement:false,stops:[],segments:[]};
      if(live&&last?.live){
        if(last.group!==group&&track.groupTicks){this.groups[last.group].segments.push(track.groupTicks*.05);track.groupTicks=0;}
        this.possessions.add(s.possession.id);
        for(const t of [totals,grouped]){
          t.ticks++;t.distance+=distance;t.zero+=Number(speed<1e-8);t.low+=Number(speed<.5);t.stationary+=Number(speed<.1);
          t.targets+=Number(!!sample.target!==!!last.target||!!sample.target&&!!last.target&&Math.hypot(sample.target.x-last.target.x,sample.target.y-last.target.y)>.1);
          t.intents+=Number(sample.intent!==last.intent);t.actions+=Number(sample.actionId!==last.actionId);
          t.resets+=Number(Math.hypot(last.vx,last.vy)>.5&&Math.hypot(sample.vx,sample.vy)<.1);
          t.frozenVelocity+=Number(speed<1e-8&&Math.hypot(sample.vx,sample.vy)>.5);
          t.turns+=Number(sample.turn>Math.PI/4);t.acceleration=Math.max(t.acceleration,Math.abs(sample.acceleration));
        }
        if(speed>=.5){
          const stopped=Math.max(track.pendingStop,track.stopTicks);
          if(stopped>=3&&track.hadMovement){const seconds=stopped*.05;totals.stops.push(seconds);grouped.stops.push(seconds);}
          track.stopTicks=0;track.pendingStop=0;track.movingTicks++;track.groupTicks++;track.hadMovement=true;
        }else if(speed<.1){
          if(track.movingTicks){totals.segments.push(track.movingTicks*.05);track.movingTicks=0;}
          if(track.groupTicks){grouped.segments.push(track.groupTicks*.05);track.groupTicks=0;}
          track.stopTicks++;
        }else {if(track.movingTicks){track.movingTicks++;track.groupTicks++;}if(track.stopTicks>=3)track.pendingStop=Math.max(track.pendingStop,track.stopTicks);track.stopTicks=0;}
      }else {track.stopTicks=0;track.pendingStop=0;track.hadMovement=false;if(track.movingTicks){totals.segments.push(track.movingTicks*.05);track.movingTicks=0;}if(track.groupTicks){this.groups[track.last.group].segments.push(track.groupTicks*.05);track.groupTicks=0;}}
      track.last=sample;this.tracks.set(p.id,track);
    }
  };
  private flush(id:string){const track=this.tracks.get(id);if(track?.movingTicks)this.players[id]?.segments.push(track.movingTicks*.05);if(track?.groupTicks)this.groups[track.last.group]?.segments.push(track.groupTicks*.05);this.tracks.delete(id);}
  report(){
    const summarize=(t:Totals)=>({livePlayerMinutes:t.ticks*.05/60,fullStops:t.stops.length,fullStopsPerPlayerMinute:t.stops.length/Math.max(1,t.ticks)*1200,stopDurationSeconds:distribution(t.stops),continuousMovementSeconds:distribution(t.segments),movementSegments:t.segments.length,targetChangesPerPlayerMinute:t.targets/Math.max(1,t.ticks)*1200,intentChangesPerPlayerMinute:t.intents/Math.max(1,t.ticks)*1200,actionChangesPerPlayerMinute:t.actions/Math.max(1,t.ticks)*1200,velocityResets:t.resets,distanceMetres:t.distance,exactZeroTicks:t.zero,lowSpeedTicks:t.low,stationaryLiveSeconds:t.stationary*.05,frozenDespiteVelocityTicks:t.frozenVelocity,directionChanges:t.turns,maxAbsAcceleration:t.acceleration});
    const aggregate=empty();for(const t of Object.values(this.players)){for(const key of ['ticks','zero','low','stationary','distance','targets','intents','actions','resets','frozenVelocity','turns'] as const)aggregate[key]+=t[key];aggregate.stops.push(...t.stops);aggregate.segments.push(...t.segments);aggregate.acceleration=Math.max(aggregate.acceleration,t.acceleration);}
    return {definitions:{tickSeconds:.05,movingMetresPerSecond:.5,stoppedMetresPerSecond:.1,minStopTicks:3,episode:'Meaningful movement followed by >=3 near-zero ticks then meaningful movement, within uninterrupted live play; dead balls excluded',speed:'Actual per-tick displacement / 0.05s; stored velocity measured separately',targetChangeMetres:.1},aggregate:{...summarize(aggregate),possessions:this.possessions.size,stopsPerPossession:aggregate.stops.length/Math.max(1,this.possessions.size)},players:Object.fromEntries(Object.entries(this.players).map(([id,t])=>[id,summarize(t)])),groups:Object.fromEntries(Object.entries(this.groups).map(([id,t])=>[id,summarize(t)]))};
  }
}
