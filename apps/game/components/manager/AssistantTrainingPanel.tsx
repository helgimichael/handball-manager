"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerSquad } from '@/lib/career/careerWorld';
import { approveProposal, delegationOf, modeOf, rejectProposal, setDelegation } from '@/lib/delegation/delegation';
import { buildAssistantTrainingPlan, editAssistantTrainingPlan, requestAssistantTraining, trainingPlanner } from '@/lib/training/assistantTraining';
import { mondayOf, updateTrainingSession } from '@/lib/training/trainingSchedule';
import { SESSION_TYPE_LABEL, DAY_TYPE_LABEL } from '@/lib/training/labels';
import { PLAYER_TRAINING_LOAD_SETTINGS, TRAINING_INTENSITIES, TRAINING_SESSION_TYPES, WEEKLY_TRAINING_TEMPLATES, type PlayerTrainingLoadSetting, type TrainingIntensity, type TrainingSessionType, type WeeklyTrainingTemplate } from '@/lib/training/types';
import { INDIVIDUAL_DEVELOPMENT_FOCUSES, type IndividualDevelopmentFocus } from '@/lib/development/types';
import type { DelegationMode } from '@/lib/delegation/types';

const templates: Record<WeeklyTrainingTemplate,string> = {BALANCED:'Balanserad',TACTICAL:'Taktisk',PHYSICAL:'Fysisk',RECOVERY:'Återhämtning',MATCH_HEAVY:'Matchtätt'};
const loads:Record<PlayerTrainingLoadSetting,string>={FULL:'Full',REDUCED:'Reducerad',RECOVERY_ONLY:'Endast Återhämtning',REST:'Vila'};
const focuses:Record<IndividualDevelopmentFocus,string>={NORMAL:'Allsidig',TECHNICAL:'Teknik',ATTACKING_DECISIONS:'Anfallsspel',DEFENCE:'Försvar',PHYSICAL:'Fysik',MENTAL:'Mentalt',GOALKEEPER:'Målvakt'};
const intensities:Record<TrainingIntensity,string>={LOW:'Låg',NORMAL:'Normal',HIGH:'Hög',VERY_HIGH:'Mycket hög'};

export default function AssistantTrainingPanel({weekStart}:{weekStart:string}) {
  const {career,updateCareer}=useCareer();
  const [message,setMessage]=useState('');
  const staff=trainingPlanner(career), mode=modeOf(career,'TRAINING_SCHEDULE');
  const proposal=Object.values(delegationOf(career).proposals).filter(p=>p.status==='PENDING'&&p.action.kind==='TRAINING_PLAN'&&p.action.plan.clubId===career.playerClubId&&p.action.plan.week.weekStart===weekStart).at(-1);
  const plan=proposal?.action.kind==='TRAINING_PLAN'?proposal.action.plan:undefined;
  const current=weekStart===mondayOf(career.gameDate);
  const run=(fn:Parameters<typeof updateCareer>[0],text:string)=>{
    try{fn(career);updateCareer(fn);setMessage(text);}catch(e){setMessage(e instanceof Error?e.message:'Det gick inte att ändra planen.');}
  };
  const players=new Map(getCareerSquad(career).map(p=>[p.id,p]));
  return <section className="hm-panel" aria-labelledby="assistant-training-title">
    <header className="hm-panel-header"><h2 id="assistant-training-title">Assistentens träningsplan</h2><Link href="/career/staff/responsibilities">Ansvarsfördelning →</Link></header>
    <p>{staff?`${staff.displayName} planerar utifrån matcher, energi, tillgänglighet och individuella utvecklingsbehov.`:'Ingen ansvarig tränare finns. Utse en assistent i ledarstaben.'}</p>
    <label>Träningsansvar <select className="hm-select" aria-label="Träningsansvar" value={mode} onChange={e=>run(s=>setDelegation(s,'TRAINING_SCHEDULE',e.target.value as DelegationMode),'Ansvar sparat.')}>
      <option value="MANAGER">Du själv</option><option value="ADVISE">Råd först</option><option value="DELEGATE">Delegera</option>
    </select></label>
    <p>Råd först lämnar ditt schema orört. Delegera lägger kommande veckor när de ännu saknar plan. Manuella ändringar skyddas. Individuella instruktioner kräver alltid ditt val och godkännande.</p>
    {current&&!proposal&&<button className="hm-btn" disabled={!staff} onClick={()=>run(requestAssistantTraining,'Förslaget är klart för granskning.')}>Be om veckoförslag</button>}
    {!current&&<p>Granska assistentens förslag under den aktuella veckan. Kommande veckor bedöms när de börjar.</p>}
    {proposal&&plan&&<>
      <p><strong>{plan.staffName} · vecka {weekStart}</strong>{plan.teamApplied?' · Veckoschemat är redan delegerat. Individuella råd väntar på ditt beslut.':' · Förslag: ändrar inget förrän du godkänner.'}</p>
      <ul>{plan.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
      <label>Förslagets träningsmål <select className="hm-select" aria-label="Förslagets träningsmål" value={plan.template} onChange={e=>run(s=>editAssistantTrainingPlan(s,proposal.id,old=>{
        const fresh=buildAssistantTrainingPlan(s,s.gameDate,e.target.value as WeeklyTrainingTemplate);
        return {...old,week:fresh.week,template:fresh.template,reasons:fresh.reasons};
      }),'Förslagets mål ändrat. Ditt aktiva schema är oförändrat.')}>
        {WEEKLY_TRAINING_TEMPLATES.map(t=><option key={t} value={t}>{templates[t]}</option>)}
      </select></label>
      <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Dag</th><th>Planerat</th><th>Intensitet</th></tr></thead><tbody>
        {plan.week.days.map(day=>{
          const locked=day.executed||day.date<=career.processedThroughDate||day.date<career.gameDate;
          const prep=day.sessions.some(s=>s.type==='MATCH_PREPARATION');
          return <tr key={day.date}><td>{day.date}{locked?' · genomförd/låst':''}</td><td>{DAY_TYPE_LABEL[day.dayType]}{day.sessions.map(session=><div key={session.id}><select className="hm-select" aria-label={`Föreslaget pass ${session.id}`} value={session.type} disabled={locked||prep} onChange={e=>run(s=>editAssistantTrainingPlan(s,proposal.id,p=>({...p,week:updateTrainingSession(p.week,day.date,session.id,{type:e.target.value as TrainingSessionType})})),'Passförslag ändrat.')}>
            {TRAINING_SESSION_TYPES.map(t=><option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>)}
          </select></div>)}</td><td>{day.sessions.map(session=><div key={session.id}><select className="hm-select" aria-label={`Föreslagen intensitet ${session.id}`} disabled={locked||prep} value={session.intensity} onChange={e=>run(s=>editAssistantTrainingPlan(s,proposal.id,p=>({...p,week:updateTrainingSession(p.week,day.date,session.id,{intensity:e.target.value as TrainingIntensity})})),'Intensitetsförslag ändrat.')}>
            {TRAINING_INTENSITIES.map(t=><option key={t} value={t}>{intensities[t]}</option>)}
          </select></div>)}</td></tr>;
        })}
      </tbody></table></div>
      <h3>Individuella råd</h3><p>Markera bara de ändringar du vill genomföra. Valen gäller tills du ändrar dem i spelarens träningsinställningar. Skadade spelare följer alltid medicinska begränsningar.</p>
      <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Godkänn</th><th>Spelare / skäl</th><th>Belastning</th><th>Fokus</th></tr></thead><tbody>
        {plan.players.map(player=>{
          const person=players.get(player.playerId);
          const edit=(patch:Partial<typeof player>)=>run(s=>editAssistantTrainingPlan(s,proposal.id,p=>({...p,players:p.players.map(x=>x.playerId===player.playerId?{...x,...patch}:x)})),'Individuellt förslag ändrat.');
          return <tr key={player.playerId}><td><input type="checkbox" aria-label={`Godkänn individuellt ${player.playerId}`} checked={player.selected} onChange={e=>edit({selected:e.target.checked})}/></td><td>{person?`${person.firstName} ${person.lastName}`:player.playerId}<p>{player.reason}</p></td><td><select className="hm-select" aria-label={`Föreslagen belastning ${player.playerId}`} value={player.loadSetting} onChange={e=>edit({loadSetting:e.target.value as PlayerTrainingLoadSetting})}>{PLAYER_TRAINING_LOAD_SETTINGS.map(t=><option key={t} value={t}>{loads[t]}</option>)}</select></td><td><select className="hm-select" aria-label={`Föreslaget fokus ${player.playerId}`} value={player.individualFocus} onChange={e=>edit({individualFocus:e.target.value as IndividualDevelopmentFocus})}>{INDIVIDUAL_DEVELOPMENT_FOCUSES.map(t=><option key={t} value={t}>{focuses[t]}</option>)}</select></td></tr>;
        })}
      </tbody></table></div>
      <button className="hm-btn hm-btn-primary" onClick={()=>run(s=>approveProposal(s,proposal.id),'Beslut sparat. Veckans schema och utfallet visas nedan och i ansvarsfördelningen.')}>Godkänn träningsplan</button>{' '}
      <button className="hm-btn" onClick={()=>run(s=>rejectProposal(s,proposal.id),'Förslaget avböjt. Det aktiva schemat behålls.')}>Avböj träningsplan</button>
    </>}
    {message&&<p role="status">{message}</p>}
    {Object.values(delegationOf(career).proposals).filter(p=>p.action.kind==='TRAINING_PLAN'&&p.action.plan.clubId===career.playerClubId&&p.action.plan.week.weekStart===weekStart&&p.status!=='PENDING').slice(-1).map(p=><p key={p.id}>Senaste beslut: {p.status==='APPROVED'?'Godkänt':p.status==='REJECTED'?'Avböjt':p.status==='FAILED'?'Kunde inte genomföras':'Avslutat'}{p.outcome?` · ${p.outcome}`:''}</p>)}
  </section>;
}
