'use client';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerSquad } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { buildInitialMatchSquad } from '@/lib/matchPlan/careerSquadBridge';
import { buildDefaultMatchPlan } from '@/lib/matchPlan/defaultMatchPlan';
import { addPlayerToSquad, removePlayerFromSquad, assignNormalAttackSlot, isPlayerStarting } from '@/lib/matchPlan/matchPlanEdits';
import { isSelectableForMatch } from '@/lib/career/playerStatus';
import type { MatchPlan } from '@/lib/matchPlan/types';

// Production uses one starting seven. Keep the retained plan domain's defence
// selection aligned so a hidden legacy assignment cannot veto squad removal.
function sharedStartingSeven(plan: MatchPlan): MatchPlan {
  if (plan.attackStartingUnit.formation !== 'NORMAL') return plan;
  const outfield = plan.attackStartingUnit.slots.filter(slot => slot.position !== 'GK');
  const goalkeeper = plan.attackStartingUnit.slots.find(slot => slot.position === 'GK');
  return { ...plan, defenceStartingUnit: { ...plan.defenceStartingUnit, goalkeeperId: goalkeeper?.playerId ?? plan.defenceStartingUnit.goalkeeperId, courtSlots: plan.defenceStartingUnit.courtSlots.map((slot, index) => ({ ...slot, playerId: outfield[index]?.playerId ?? slot.playerId })) } };
}

export default function TacticsPage() {
  const { career, updateMatchPlan } = useCareer();
  const fixture = getNextPlayerFixture(career);
  const squad = getCareerSquad(career).filter(p => isSelectableForMatch(career.playerStatuses, p.id));
  if (!fixture) return <div className="hm-panel-body">Ingen kommande match. Börja nästa säsong från Hem när serien är färdig.</div>;
  const built = buildDefaultMatchPlan(buildInitialMatchSquad(squad, fixture.id, career.playerClubId), career.tactics[career.playerClubId], career.playerMatchDefaults);
  const candidate = career.matchPlans[fixture.id] ?? (built.ok ? built.plan : null);
  const plan = candidate ? sharedStartingSeven(candidate) : null;
  if (!plan) return <div role="alert" className="hm-panel-body">Det behövs minst sex tillgängliga utespelare och en målvakt. Se truppen och rekrytering.</div>;
  const savedPlan: MatchPlan = plan;
  const save = (next: MatchPlan) => updateMatchPlan(fixture.id, sharedStartingSeven(next));
  if (plan.squad.players.some(p => !squad.some(available => available.id === p.playerId))) return <div className="hm-panel-body"><p>Matchplanen innehåller spelare som inte är tillgängliga. Uppdatera uttagningen innan matchstart.</p><button className="hm-btn" disabled={!built.ok} onClick={() => { if (built.ok && built.plan) save(built.plan); }}>Uppdatera till tillgänglig matchtrupp</button><p><Link href="/career/squad">Öppna truppen</Link></p></div>;
  if (plan.attackStartingUnit.formation !== 'NORMAL') return <div className="hm-panel-body"><p>Den sparade matchplanen använder en spelform som inte är tillgänglig i den här versionen. Välj en normal startsju för att fortsätta.</p><button className="hm-btn" disabled={!built.ok} onClick={() => { if (built.ok && built.plan) save(built.plan); }}>Skapa normal matchplan</button></div>;
  const attack = plan.attackPlan;
  const identity = attack.ballCirculation === 'DIRECT' ? 'DIRECT' : attack.wingUsage === 'HIGH' ? 'WIDTH' : attack.structureFreedom === 'STRUCTURED' ? 'COMBINATION' : 'BALANCED';
  return <div className="hm-grid" style={{ gap: 12 }}>
    <div className="hm-panel"><div className="hm-panel-header"><strong>Matchplan</strong><Link className="hm-btn hm-btn-primary" href="/career/match-preview">Till matchen →</Link></div><div className="hm-panel-body" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <label>Försvar<br /><select aria-label="Försvar" value={plan.defencePlan.baseFormation.replace('-', ':') === '5:1' ? '5:1' : '6:0'} onChange={e => save({ ...savedPlan, defencePlan: { ...savedPlan.defencePlan, baseFormation: e.target.value } })}><option>6:0</option><option>5:1</option></select></label>
      <label>Tempo<br /><select aria-label="Tempo" value={attack.tempo === 'FAST' ? 'FAST' : 'BALANCED'} onChange={e => save({ ...savedPlan, attackPlan: { ...attack, tempo: e.target.value as 'FAST' | 'BALANCED' } })}><option value="BALANCED">Balanserat</option><option value="FAST">Snabbt</option></select></label>
      <label>Anfall<br /><select aria-label="Anfall" value={identity} onChange={e => save({ ...savedPlan, attackPlan: { ...attack, ballCirculation: e.target.value === 'DIRECT' ? 'DIRECT' : 'BALANCED', wingUsage: e.target.value === 'WIDTH' ? 'HIGH' : 'MEDIUM', structureFreedom: e.target.value === 'COMBINATION' ? 'STRUCTURED' : 'BALANCED' } })}><option value="BALANCED">Balanserat</option><option value="COMBINATION">Kombinationer</option><option value="WIDTH">Bredd</option><option value="DIRECT">Direkt</option></select></label>
    </div><p className="hm-panel-body hm-text-muted">Du kan ändra dessa instruktioner, göra byten och ta timeout under matchen. Spelarnas egenskaper och trötthet påverkar utförandet.</p></div>
    <div className="hm-panel"><div className="hm-panel-header"><strong>Startsju</strong></div><div className="hm-panel-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{plan.attackStartingUnit.slots.map(slot => <label key={slot.position}>{slot.position === 'GK' ? 'Målvakt' : slot.position}<br /><select aria-label={`Startspelare ${slot.position}`} value={slot.playerId} onChange={e => save(assignNormalAttackSlot(savedPlan, slot.position, e.target.value))}>{plan.squad.players.filter(p => slot.position === 'GK' ? p.position === 'GK' : p.position !== 'GK').map(p => { const person = squad.find(x => x.id === p.playerId); return <option value={p.playerId} key={p.playerId}>{person?.firstName} {person?.lastName}</option>; })}</select></label>)}</div></div>
    <div className="hm-panel"><div className="hm-panel-header"><strong>Matchtrupp · {plan.squad.players.length} spelare</strong></div><table className="hm-table"><thead><tr><th>Uttagen</th><th>Spelare</th><th>Position</th><th>Energi</th></tr></thead><tbody>{squad.map(p => <tr key={p.id}><td><input aria-label={`Ta ut ${p.firstName} ${p.lastName}`} type="checkbox" disabled={isPlayerStarting(plan, p.id)} title={isPlayerStarting(plan, p.id) ? "Byt startspelare f?rst" : undefined} checked={plan.squad.players.some(x => x.playerId === p.id)} onChange={e => save(e.target.checked ? addPlayerToSquad(savedPlan, p.id, p.position === 'MV' ? 'GK' : p.position) : removePlayerFromSquad(savedPlan, p.id))} /></td><td><Link href={`/career/squad/${p.id}`}>{p.firstName} {p.lastName}</Link></td><td>{p.position}</td><td>{Math.round(career.playerPhysicalState[p.id]?.currentEnergy ?? 100)}%</td></tr>)}</tbody></table></div>
  </div>;
}
