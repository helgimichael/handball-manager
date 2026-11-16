"use client";
// Arena Nights TRN-01 / TRN-01a: the assistant's weekly training proposal
// as the page header (face, goal, effect on matchday readiness, Godkänn /
// Justera / Avböj, delegation mode). The M6C/M6D flow is unchanged: the
// same proposal lookup, the same `run` guard and the same delegation /
// assistantTraining calls as before -- only the presentation moved (the
// session diff is drawn on the week grid, see ProposalDiffGrid).
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { approveProposal, delegationOf, modeOf, rejectProposal, setDelegation } from '@/lib/delegation/delegation';
import { buildAssistantTrainingPlan, editAssistantTrainingPlan, requestAssistantTraining, trainingPlanner } from '@/lib/training/assistantTraining';
import { mondayOf } from '@/lib/training/trainingSchedule';
import { WEEKLY_TRAINING_TEMPLATES, type WeeklyTrainingTemplate } from '@/lib/training/types';
import type { DelegationMode } from '@/lib/delegation/types';
import { AssistantFace } from '@/components/training/weekParts';

const templates: Record<WeeklyTrainingTemplate,string> = {BALANCED:'Balanserad',TACTICAL:'Taktisk',PHYSICAL:'Fysisk',RECOVERY:'Återhämtning',MATCH_HEAVY:'Matchtätt'};
const MODES: [DelegationMode, string][] = [['MANAGER','Du själv'],['ADVISE','Råd först'],['DELEGATE','Delegera']];

/** The proposal state and the guarded action runner shared by the header, the diff grid and the advice list. */
export function useAssistantTraining(weekStart: string) {
  const {career,updateCareer}=useCareer();
  const [message,setMessage]=useState('');
  const staff=trainingPlanner(career), mode=modeOf(career,'TRAINING_SCHEDULE');
  const proposal=Object.values(delegationOf(career).proposals).filter(p=>p.status==='PENDING'&&p.action.kind==='TRAINING_PLAN'&&p.action.plan.clubId===career.playerClubId&&p.action.plan.week.weekStart===weekStart).at(-1);
  const plan=proposal?.action.kind==='TRAINING_PLAN'?proposal.action.plan:undefined;
  const current=weekStart===mondayOf(career.gameDate);
  const run=(fn:Parameters<typeof updateCareer>[0],text:string)=>{
    try{fn(career);updateCareer(fn);setMessage(text);}catch(e){setMessage(e instanceof Error?e.message:'Det gick inte att ändra planen.');}
  };
  const lastDecision=Object.values(delegationOf(career).proposals).filter(p=>p.action.kind==='TRAINING_PLAN'&&p.action.plan.clubId===career.playerClubId&&p.action.plan.week.weekStart===weekStart&&p.status!=='PENDING').slice(-1)[0];
  return {career,staff,mode,proposal,plan,current,run,message,lastDecision};
}
export type AssistantTraining = ReturnType<typeof useAssistantTraining>;

export interface ProposalEffect {
  targetLabel: string;
  before: number | null;
  after: number | null;
  changedDays: number;
}

export default function AssistantTrainingPanel({ctx,weekStart,editing,onToggleEdit,effect}:{ctx:AssistantTraining;weekStart:string;editing:boolean;onToggleEdit:()=>void;effect?:ProposalEffect}) {
  const {staff,mode,proposal,plan,current,run,message,lastDecision}=ctx;
  const goal=plan?.reasons[1]??(staff?`${staff.displayName} kan lägga veckans träning utifrån matcher, energi, tillgänglighet och individuella utvecklingsbehov.`:'Ingen ansvarig tränare finns för träningsplaneringen.');
  const delta=effect&&effect.before!==null&&effect.after!==null?effect.after-effect.before:null;
  return <section className="hm-panel trn-assistant" aria-labelledby="assistant-training-title" data-state={proposal?'proposal':'idle'}>
    <div className="trn-assistant-main">
      {staff?<AssistantFace name={staff.displayName}/>:<span className="trn-face" aria-hidden="true">?</span>}
      <div className="trn-assistant-copy">
        <span className="hm-eyebrow">Assistentens träningsplan{staff?` · ${staff.displayName}`:''}{proposal&&plan?` · vecka ${weekStart}`:''}</span>
        <h2 id="assistant-training-title">{goal}</h2>
        {proposal&&plan?<p>{plan.teamApplied?'Veckoschemat är redan delegerat. Individuella råd väntar på ditt beslut.':'Förslag: ändrar inget förrän du godkänner.'} {plan.reasons[0]}</p>
          :staff?<p>{current?'Be om ett förslag – det ritas som ändringar på veckoschemat så att du ser vad som flyttas innan du godkänner.':'Granska assistentens förslag under den aktuella veckan. Kommande veckor bedöms när de börjar.'}</p>
          :<p>Utse en assistent i <Link href="/career/staff">ledarstaben</Link> för att kunna få veckoförslag.</p>}
        {proposal&&effect&&<p className="trn-effect">
          <span>Matchberedskap {effect.targetLabel}</span>
          <b className="trn-num">{effect.before??'—'} %</b><span aria-hidden="true">→</span><b className="trn-num" data-tone={delta===null?undefined:delta>0?'pos':delta<0?'neg':undefined}>{effect.after??'—'} %</b>
          <span className="trn-effect-days">{effect.changedDays===0?'Inga dagar ändras':`${effect.changedDays} ${effect.changedDays===1?'dag ändras':'dagar ändras'}`}</span>
        </p>}
      </div>
      <div className="trn-assistant-actions">
        {proposal&&plan?<>
          <button className="hm-btn hm-btn-primary" onClick={()=>run(s=>approveProposal(s,proposal.id),'Beslut sparat. Veckans schema och utfallet visas nedan och i ansvarsfördelningen.')}>Godkänn träningsplan</button>
          <button className="hm-btn" aria-pressed={editing} onClick={onToggleEdit}>{editing?'Klar med justering':'Justera'}</button>
          <button className="hm-btn" onClick={()=>run(s=>rejectProposal(s,proposal.id),'Förslaget avböjt. Det aktiva schemat behålls.')}>Avböj träningsplan</button>
        </>:current?<>
          <button className="hm-btn hm-btn-primary" disabled={!staff} onClick={()=>run(requestAssistantTraining,'Förslaget är klart för granskning.')}>Be om veckoförslag</button>
          {!staff&&<small className="trn-slot-reason">Kräver en ansvarig tränare.</small>}
        </>:null}
      </div>
    </div>
    <div className="trn-assistant-foot">
      <div className="trn-field">
        <span id="trn-mode-label">Träningsansvar</span>
        <div className="trn-seg" role="radiogroup" aria-labelledby="trn-mode-label">
          {MODES.map(([m,label])=><button key={m} type="button" role="radio" aria-checked={mode===m} onClick={()=>mode!==m&&run(s=>setDelegation(s,'TRAINING_SCHEDULE',m),'Ansvar sparat.')}>{label}</button>)}
        </div>
      </div>
      <p className="trn-hint">Råd först lämnar ditt schema orört. Delegera lägger kommande veckor när de ännu saknar plan. Manuella ändringar skyddas. Individuella instruktioner kräver alltid ditt val och godkännande.</p>
      <Link className="trn-foot-link" href="/career/staff/responsibilities">Ansvarsfördelning →</Link>
    </div>
    {proposal&&plan&&editing&&<div className="trn-assistant-edit">
      <label className="trn-field">Förslagets träningsmål <select className="hm-select" aria-label="Förslagets träningsmål" value={plan.template} onChange={e=>run(s=>editAssistantTrainingPlan(s,proposal.id,old=>{
        const fresh=buildAssistantTrainingPlan(s,s.gameDate,e.target.value as WeeklyTrainingTemplate);
        return {...old,week:fresh.week,template:fresh.template,reasons:fresh.reasons};
      }),'Förslagets mål ändrat. Ditt aktiva schema är oförändrat.')}>
        {WEEKLY_TRAINING_TEMPLATES.map(t=><option key={t} value={t}>{templates[t]}</option>)}
      </select></label>
      <p className="trn-hint">Tryck på ett pass i schemat nedan för att ändra passtyp eller intensitet i förslaget. Ditt aktiva schema ändras först när du godkänner.</p>
    </div>}
    {proposal&&plan&&plan.reasons.length>2&&<details className="trn-reasons"><summary>Assistentens bedömning ({plan.reasons.length-2} till)</summary><ul>{plan.reasons.slice(2).map(reason=><li key={reason}>{reason}</li>)}</ul></details>}
    {message&&<p className="trn-message" role="status">{message}</p>}
    {lastDecision&&<p className="trn-hint">Senaste beslut: {lastDecision.status==='APPROVED'?'Godkänt':lastDecision.status==='REJECTED'?'Avböjt':lastDecision.status==='FAILED'?'Kunde inte genomföras':'Avslutat'}{lastDecision.outcome?` · ${lastDecision.outcome}`:''}</p>}
  </section>;
}
