import type { CareerState } from '../career/types';
import { addDaysIso, ageOf, dynamicsEvent, dynamicsOf, managerSquadIds, personalityOf, playerName, tierOf, type Emit } from './dynamicsState';
import { assessPlayingTime } from './playingTime';
import type { PlayerIntention, PlayerIntentionState } from './types';

export const INTENTION_LABEL: Record<PlayerIntention,string> = {
  HAPPY_TO_STAY:'Vill stanna', OPEN_TO_RENEWAL:'\u00d6ppen f\u00f6r f\u00f6rl\u00e4ngning',
  CONSIDERING_OPTIONS:'\u00d6verv\u00e4ger alternativ', WANTS_TO_LEAVE:'Vill l\u00e4mna',
};

export function playerIntentionOf(state: CareerState, playerId: string): PlayerIntentionState | undefined {
  const held=dynamicsOf(state).intentions?.[playerId];
  return held?.active && held.clubId===state.playerClubId && state.playerContracts[playerId]?.clubId===held.clubId ? held : undefined;
}

/** Shared by negotiations and the direct domain agreement entry point. */
export function intentionRenewalBlocker(state: CareerState, playerId: string): string | null {
  if(state.preContracts?.[playerId])return "Han har redan skrivit avtal med en annan klubb.";
  if(dynamicsOf(state).requests[playerId]?.status==='OPEN')return "Han har begärt att få lämna och vill inte förlänga just nu.";
  const held=playerIntentionOf(state,playerId);
  if(held?.kind==='WANTS_TO_LEAVE')return `Han vill l\u00e4mna och avvisar en f\u00f6rl\u00e4ngning. ${held.reasons.join(' ')}`;
  return null;
}
export function intentionWageMultiplier(state: CareerState, playerId: string): number {
  const kind=playerIntentionOf(state,playerId)?.kind;
  return kind==='CONSIDERING_OPTIONS'?1.12:kind==='HAPPY_TO_STAY'?.97:1;
}

export function intentionMinimumWage(state: CareerState, playerId: string): number {
  const wage=state.playerContracts[playerId]?.wageEurPerMonth??0,mult=intentionWageMultiplier(state,playerId);
  return mult>1?Math.ceil(wage*mult/10)*10:wage;
}

/** At most once per seven days. Match evidence is role/phase adjusted by Living Squad.
 * A repeated read/tick or a quiet week cannot manufacture another benching observation. */
export function progressPlayerIntentions(state: CareerState, date: string, emit: Emit): CareerState {
  let next={...state,gameDate:date};
  for(const playerId of managerSquadIds(next)) {
    const d=dynamicsOf(next),old=d.intentions?.[playerId],prev=playerIntentionOf(next,playerId);
    if(prev && addDaysIso(prev.reviewedOn,7)>date)continue;
    const preContract=next.preContracts?.[playerId];
    const c=next.playerContracts[playerId]!,time=assessPlayingTime(next,playerId,date),m=d.morale[playerId];
    const soon=c.contractEndDate<=addDaysIso(date,365),urgent=c.contractEndDate<=addDaysIso(date,90);
    const talks=Object.values(next.renewalTalks??{}).some(t=>t.playerId===playerId&&t.status==='OPEN');
    const recentConcerns=Object.values(d.concerns).filter(c=>c.playerId===playerId&&c.raisedOn>=addDaysIso(date,-120)&&c.raisedOn<=date);
    const dismissed=recentConcerns.filter(c=>c.status==='LAPSED'||c.responseEffect==='NEGATIVE').length;
    const nonTime=m?.factors.filter(f=>f.key!=='PLAYING_TIME'&&f.key!=='STAFF'&&f.points<0)??[];
    const poorMorale=!!m&&m.moralePct<50&&m.unhappyWeeks>=2&&nonTime.length>0;
    const ignoredContract=urgent&&!talks&&!next.preContracts?.[playerId];
    const sportingAmbition=nonTime.some(f=>f.key==='CLUB_STATUS'&&f.points<=-4)&&personalityOf(next,playerId).ambition>=15&&(ageOf(next,playerId)??99)<=29;
    const finance=next.clubFinances?.[next.playerClubId]?.status==='CRISIS';
    const timeBad=time.status==='UNMET';
    const freshTime=timeBad&&!!time.lastFixtureId&&time.lastFixtureId!==prev?.lastFixtureId;
    const bad=poorMorale||sportingAmbition||ignoredContract||finance||(dismissed>=2&&(timeBad||(m?.moralePct??70)<60))||timeBad;
    const otherBad=poorMorale||sportingAmbition||ignoredContract||finance||(dismissed>=2&&!timeBad&&(m?.moralePct??70)<60);
    const reasons:string[]=[];
    if(timeBad)reasons.push(time.explanation);
    if(poorMorale)reasons.push(...nonTime.slice(0,2).map(f=>f.label));
    if(dismissed>=2&&(timeBad||(m?.moralePct??70)<60))reasons.push('Flera samtal har l\u00e4mnats obesvarade eller slutat med ett negativt svar.');
    if(sportingAmbition&&!poorMorale)reasons.push(...nonTime.filter(f=>f.key==='CLUB_STATUS').map(f=>f.label));
    if(ignoredContract)reasons.push('Avtalet l\u00f6per ut inom tre m\u00e5nader och inga f\u00f6rl\u00e4ngningssamtal p\u00e5g\u00e5r.');
    if(finance)reasons.push('Klubben befinner sig i ekonomisk kris.');
    if(!bad) {
      if(time.status==='MET'||time.status==='EXCEEDED')reasons.push(time.explanation);
      const age=ageOf(next,playerId);
      if(age!==null&&age<=23&&tierOf(next,playerId)==='TALENT'&&(time.status==='MET'||time.status==='EXCEEDED'))reasons.push('F\u00e5r f\u00f6rtroende i sin utvecklingsroll.');
      if(soon)reasons.push(age!==null&&age>=31?'Vill diskutera trygghet inf\u00f6r den senare delen av karri\u00e4ren.':'Avtalet n\u00e4rmar sig sitt slut; \u00f6ppen f\u00f6r att diskutera n\u00e4sta steg.');
      if(recentConcerns.some(c=>c.status==='ANSWERED'&&c.responseEffect==='POSITIVE'))reasons.push('Spelaren uppskattade ditt senaste svar.');
      if(talks)reasons.push('Klubben har inlett f\u00f6rl\u00e4ngningssamtal.');
      if(!reasons.length)reasons.push('Ingen varaktig anledning att s\u00f6ka en flytt har visats.');
    }
    const base:PlayerIntention=soon?'OPEN_TO_RENEWAL':'HAPPY_TO_STAY';
    let kind=prev?.kind??(['OPEN','ACCEPTED'].includes(d.requests[playerId]?.status??'')?'WANTS_TO_LEAVE':base);
    let adverse=prev?.adverseReviews??0,recovery=prev?.recoveryReviews??0;
    // Injury/warmup or unchanged match evidence freezes a sporting dispute, not adds strikes.
    const frozen=!preContract&&!otherBad&&((timeBad&&!freshTime)||((time.status==='UNAVAILABLE'||time.status==='WARMUP')&&!!prev?.lastFixtureId&&adverse>0));
    if(!frozen){
      if(bad){adverse++;recovery=0;if(adverse>=6)kind='WANTS_TO_LEAVE';else if(adverse>=2&&kind!=='WANTS_TO_LEAVE')kind='CONSIDERING_OPTIONS';}
      else {
        recovery++;adverse=0;
        if(recovery>=2){kind=kind==='WANTS_TO_LEAVE'?'CONSIDERING_OPTIONS':base;recovery=0;}
      }
    }
    // A signed outside contract is an existing decision, not a new dissatisfaction strike.
    if(preContract){kind='WANTS_TO_LEAVE';adverse=0;recovery=0;reasons.splice(0,reasons.length,'Har redan avtalat om att lämna klubben '+preContract.effectiveOn+'.');}
    const changed=!!prev&&kind!==prev.kind;
    const held:PlayerIntentionState={kind,clubId:next.playerClubId,active:true,since:changed||!prev?date:prev.since,reviewedOn:date,
      adverseReviews:adverse,recoveryReviews:recovery,lastFixtureId:time.lastFixtureId??prev?.lastFixtureId,
      reasons:frozen?prev!.reasons:[...new Set(reasons)],
      history:[...(old?.history??[]),...(!prev||changed?[{date,kind,reasons:[...new Set(reasons)]}]:[])].slice(-12)};
    let requests=d.requests;
    // The player can withdraw his still-open request after two stages of genuine recovery.
    // Accepted requests/listings and any agreed transfer remain manager/market decisions.
    if(changed&&['HAPPY_TO_STAY','OPEN_TO_RENEWAL'].includes(kind)&&d.requests[playerId]?.status==='OPEN')requests={...requests,[playerId]:{...requests[playerId]!,status:'WITHDRAWN',decidedOn:date}};
    next={...next,playerDynamics:{...d,requests,intentions:{...d.intentions,[playerId]:held}}};
    // WANTS_TO_LEAVE is explained by the existing request event, not a second complaint.
    if(changed&&kind!=='WANTS_TO_LEAVE')emit(dynamicsEvent(`intention:${next.playerClubId}:${playerId}:${date}:${kind}`,date,
      kind==='CONSIDERING_OPTIONS'?'IMPORTANT':'INFORMATION',`${playerName(next,playerId)}: ${INTENTION_LABEL[kind]}`,held.reasons.join(' '),playerId,[{route:'CONTRACTS'}]));
  }
  return next;
}
