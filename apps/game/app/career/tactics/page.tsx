'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageHeading } from '@/components/manager/Workspace';
import { PlayerCell, PlayerGlyph, playerAvailabilityLabel } from '@/components/game/Identity';
import ClubCrest from '@/components/ClubCrest';
import { CoachingChoices, COACH_ATTACK_LABEL, type CoachAttack } from '@/components/game/CoachingChoices';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerSquad } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getClub, type PlayerMock } from '@/lib/game-data';
import { squadEnergy } from '@/lib/career/management';
import { averageRating } from '@/lib/career/types';
import { buildInitialMatchSquad } from '@/lib/matchPlan/careerSquadBridge';
import { buildDefaultMatchPlan } from '@/lib/matchPlan/defaultMatchPlan';
import { addPlayerToSquad, removePlayerFromSquad, assignNormalAttackSlot, isPlayerStarting } from '@/lib/matchPlan/matchPlanEdits';
import { matchPlanPositionLabel } from '@/lib/matchPlan/matchPlanLabels';
import { isSelectableForMatch } from '@/lib/career/playerStatus';
import { MATCH_SQUAD_MAX_PLAYERS, type MatchPlan, type Position } from '@/lib/matchPlan/types';

// Production uses one starting seven. Keep the retained plan domain's defence
// selection aligned so a hidden legacy assignment cannot veto squad removal.
function sharedStartingSeven(plan: MatchPlan): MatchPlan {
  if (plan.attackStartingUnit.formation !== 'NORMAL') return plan;
  const outfield = plan.attackStartingUnit.slots.filter(slot => slot.position !== 'GK');
  const goalkeeper = plan.attackStartingUnit.slots.find(slot => slot.position === 'GK');
  return { ...plan, defenceStartingUnit: { ...plan.defenceStartingUnit, goalkeeperId: goalkeeper?.playerId ?? plan.defenceStartingUnit.goalkeeperId, courtSlots: plan.defenceStartingUnit.courtSlots.map((slot, index) => ({ ...slot, playerId: outfield[index]?.playerId ?? slot.playerId })) } };
}

const COURT_ROLES: readonly { position: Position; x: number; y: number }[] = [
  { position: 'V6', x: 16, y: 21 }, { position: 'M6', x: 50, y: 32 }, { position: 'H6', x: 84, y: 21 },
  { position: 'V9', x: 23, y: 61 }, { position: 'M9', x: 50, y: 75 }, { position: 'H9', x: 77, y: 61 },
];

export default function TacticsPage() {
  const { career, updateMatchPlan } = useCareer();
  const [activePosition, setActivePosition] = useState<Position>('V6');
  const fixture = getNextPlayerFixture(career);
  const allSquad = getCareerSquad(career);
  const squad = allSquad.filter(p => isSelectableForMatch(career.playerStatuses, p.id));
  const heading = <PageHeading eyebrow="Matchförberedelse / laguttagning" title="Taktik & matchtrupp" description="Välj din startsju. Ge laget en plan. Förbered bytena som kan avgöra matchen." actions={fixture && <Link className="hm-btn hm-btn-primary" href="/career/match-preview">Till matchen →</Link>} />;
  if (!fixture) return <div className="coach-preparation">{heading}<div className="coach-empty"><span className="hm-eyebrow">{career.seasonComplete ? 'Säsongens sista match är spelad' : 'Ingen kommande match'}</span><h2>Nästa laguttagning väntar.</h2><p>Ingen kommande match. Börja nästa säsong från Hem när serien är färdig.</p><Link className="hm-btn" href="/career">Till klubben →</Link></div></div>;
  const built = buildDefaultMatchPlan(buildInitialMatchSquad(squad, fixture.id, career.playerClubId), career.tactics[career.playerClubId], career.playerMatchDefaults);
  const candidate = career.matchPlans[fixture.id] ?? (built.ok ? built.plan : null);
  const plan = candidate ? sharedStartingSeven(candidate) : null;
  if (!plan) return <div className="coach-preparation">{heading}<div role="alert" className="coach-empty"><h2>Startsjuan behöver fler spelare.</h2><p>Det behövs minst sex tillgängliga utespelare och en målvakt.</p><div className="hm-actions"><Link className="hm-btn" href="/career/squad">Öppna truppen →</Link><Link className="hm-btn" href="/career/players">Hitta förstärkning →</Link></div></div></div>;
  const savedPlan = plan;
  const save = (edit: MatchPlan | ((current: MatchPlan) => MatchPlan)) => updateMatchPlan(fixture.id, latest => sharedStartingSeven(typeof edit === 'function' ? edit(sharedStartingSeven(latest ?? savedPlan)) : edit));
  if (plan.squad.players.some(p => !squad.some(available => available.id === p.playerId))) return <div className="coach-preparation">{heading}<div className="coach-empty" role="alert"><h2>Uttagningen behöver uppdateras.</h2><p>Matchplanen innehåller spelare som inte är tillgängliga. Uppdatera uttagningen innan matchstart.</p><button className="hm-btn hm-btn-primary" disabled={!built.ok} onClick={() => { if (built.ok && built.plan) save(built.plan); }}>Uppdatera till tillgänglig matchtrupp</button><p><Link href="/career/squad">Öppna truppen</Link></p></div></div>;
  if (plan.attackStartingUnit.formation !== 'NORMAL') return <div className="coach-preparation">{heading}<div className="coach-empty" role="alert"><h2>Välj en normal startsju.</h2><p>Den sparade matchplanen använder en spelform som inte är tillgänglig i den här versionen.</p><button className="hm-btn hm-btn-primary" disabled={!built.ok} onClick={() => { if (built.ok && built.plan) save(built.plan); }}>Skapa normal matchplan</button></div></div>;
  const attack = plan.attackPlan;
  const identity: CoachAttack = attack.ballCirculation === 'DIRECT' ? 'DIRECT' : attack.wingUsage === 'HIGH' ? 'WIDTH' : attack.structureFreedom === 'STRUCTURED' ? 'COMBINATION' : 'BALANCED';
  const defence = plan.defencePlan.baseFormation.replace('-', ':') === '5:1' ? '5:1' : '6:0';
  const startingIds = new Set(plan.attackStartingUnit.slots.map(slot => slot.playerId));
  const squadIds = new Set(plan.squad.players.map(p => p.playerId));
  const bench = squad.filter(p => squadIds.has(p.id) && !startingIds.has(p.id));
  const outside = allSquad.filter(p => !squadIds.has(p.id));
  const activeSlot = plan.attackStartingUnit.slots.find(slot => slot.position === activePosition);
  const activePlayer = squad.find(p => p.id === activeSlot?.playerId);
  const naturalPosition = activePosition === 'GK' ? 'MV' : activePosition;
  const positionGroup = (player: PlayerMock) => player.position === naturalPosition ? 0 : player.secondaryPosition === naturalPosition || player.secondaryPositions?.includes(naturalPosition) ? 1 : 2;
  const eligible = squad.filter(p => squadIds.has(p.id) && (activePosition === 'GK' ? p.position === 'MV' : p.position !== 'MV')).sort((a, b) => positionGroup(a) - positionGroup(b) || Number(b.id === activeSlot?.playerId) - Number(a.id === activeSlot?.playerId));
  const own = getClub(career.playerClubId);
  const opponentId = fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId;
  const opponent = getClub(opponentId);

  function courtPlayer(position: Position) {
    const slot = plan!.attackStartingUnit.slots.find(s => s.position === position);
    const player = squad.find(p => p.id === slot?.playerId);
    return <button type="button" className="coach-position" aria-label={`Välj startposition ${position === 'GK' ? 'MV' : position}`} aria-pressed={activePosition === position} data-active={activePosition === position} onClick={() => setActivePosition(position)}><span className="coach-position-code">{position === 'GK' ? 'MV' : position}</span>{player && <PlayerGlyph player={player} size={48} />}<strong>{player?.lastName ?? 'Välj spelare'}</strong><small>{player ? `${Math.round(squadEnergy(career, player))}% energi` : 'Ingen spelare'}</small></button>;
  }
  function rosterRows(players: readonly PlayerMock[]) {
    return <div className="hm-scroll-x"><table className="hm-table coach-roster-table"><thead><tr><th>Uttagen</th><th>Spelare</th><th>Position</th><th>Roll i matchen</th><th>Energi</th><th>Snittbetyg</th><th>Tillgänglighet</th></tr></thead><tbody>{players.map(p => { const available = isSelectableForMatch(career.playerStatuses, p.id); const starting = isPlayerStarting(plan!, p.id); const included = squadIds.has(p.id); const stats = career.playerSeasonStats[p.id]; const energy = Math.round(squadEnergy(career, p)); return <tr key={p.id} data-starter={starting} data-unavailable={!available}><td><input aria-label={`Ta ut ${p.firstName} ${p.lastName}`} type="checkbox" disabled={!available || starting || (!included && plan!.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS)} title={!available ? 'Spelaren är inte tillgänglig' : starting ? 'Byt startspelare först' : !included && plan!.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS ? 'Matchtruppen är full' : undefined} checked={included} onChange={e => save(current => e.target.checked ? addPlayerToSquad(current, p.id, p.position === 'MV' ? 'GK' : p.position) : removePlayerFromSquad(current, p.id))} /></td><td><PlayerCell player={p} /></td><td>{p.position}{p.secondaryPosition ? ` / ${p.secondaryPosition}` : ''}</td><td>{starting ? `Start · ${plan!.attackStartingUnit.slots.find(s => s.playerId === p.id)?.position === 'GK' ? 'MV' : plan!.attackStartingUnit.slots.find(s => s.playerId === p.id)?.position}` : included ? 'Bänk' : 'Ej uttagen'}</td><td><div className="coach-energy" data-low={energy < 70}><strong>{energy}%</strong><meter aria-label={`${p.firstName} ${p.lastName}: energi`} min={0} max={100} value={energy} /></div></td><td>{stats?.appearances ? averageRating(stats).toFixed(1) : '—'}</td><td>{playerAvailabilityLabel(career,p.id)}</td></tr>; })}</tbody></table></div>;
  }
  return <div className="coach-preparation">{heading}
    <div className="coach-fixture-strip"><div><ClubCrest shortName={own?.shortName ?? 'HM'} primaryColor="" size={42} /><strong>{own?.shortName}</strong><span>mot</span><ClubCrest shortName={opponent?.shortName ?? '?'} primaryColor="" size={42} /><Link href={`/career/clubs/${encodeURIComponent(opponentId)}`}>{opponent?.name ?? opponentId}</Link></div><div><strong>{fixture.date}</strong><span>{fixture.homeClubId === career.playerClubId ? 'Hemma' : 'Borta'} · {fixture.type === 'LEAGUE' ? `Omgång ${fixture.round}` : fixture.type === 'CUP' ? 'Cup' : 'Träningsmatch'}</span></div></div>
    <div className="coach-preparation-layout"><section className="coach-lineup"><header className="coach-section-heading"><h2>Startsju</h2><span>Klicka på en position · välj spelare</span></header><div className="coach-court" aria-label="Startsju på handbollsplanen"><svg viewBox="0 0 1000 660" preserveAspectRatio="none" aria-hidden="true"><rect x="12" y="8" width="976" height="644" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M180 8C180 275 820 275 820 8M70 8C70 490 930 490 930 8" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M440 8v18h120V8M455 305h90" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M70 8C70 490 930 490 930 8" fill="none" stroke="#173147" strokeWidth="4" strokeDasharray="13 10" /></svg><span className="coach-court-direction">ANFALL MOT MOTSTÅNDARNAS MÅL ↑</span>{COURT_ROLES.map(role => <div className="coach-court-slot" key={role.position} style={{ left: `${role.x}%`, top: `${role.y}%` }}>{courtPlayer(role.position)}</div>)}</div><div className="coach-goalkeeper"><span>I egna målet</span>{courtPlayer('GK')}<div><strong>{plan.squad.players.length} / {MATCH_SQUAD_MAX_PLAYERS}</strong><small>uttagna · {bench.length} på bänken</small></div></div></section>
    <aside className="coach-plan-rail"><section className="coach-gameplan"><header className="coach-section-heading"><h2>Så spelar vi</h2><span>Din aktiva plan</span></header><CoachingChoices defence={defence} tempo={attack.tempo === 'FAST' ? 'QUICK' : 'BALANCED'} attack={identity} onDefence={value => save(current => ({ ...current, defencePlan: { ...current.defencePlan, baseFormation: value } }))} onTempo={value => save(current => ({ ...current, attackPlan: { ...current.attackPlan, tempo: value === 'QUICK' ? 'FAST' : 'BALANCED' } }))} onAttack={value => save(current => ({ ...current, attackPlan: { ...current.attackPlan, ballCirculation: value === 'DIRECT' ? 'DIRECT' : 'BALANCED', wingUsage: value === 'WIDTH' ? 'HIGH' : 'MEDIUM', structureFreedom: value === 'COMBINATION' ? 'STRUCTURED' : 'BALANCED' } }))} /><p className="coach-active-plan">{defence} · {attack.tempo === 'FAST' ? 'Snabbt' : 'Balanserat'} tempo · {COACH_ATTACK_LABEL[identity]}</p></section>
      <section className="coach-replacements"><header className="coach-section-heading"><h2>{matchPlanPositionLabel(activePosition)}</h2><span>{activePosition === 'GK' ? 'MV' : activePosition}</span></header>{activePlayer && <div className="coach-current-player"><span className="hm-eyebrow">Startar nu</span><PlayerCell player={activePlayer} /></div>}<p>Välj en uttagen spelare. En annan startspelare byter plats; en bänkspelare tar över rollen.</p><div className="coach-candidate-list">{eligible.map(p => <button type="button" key={p.id} aria-label={`Starta ${p.firstName} ${p.lastName} som ${activePosition === 'GK' ? 'MV' : activePosition}`} aria-pressed={p.id === activeSlot?.playerId} data-active={p.id === activeSlot?.playerId} onClick={() => { if (p.id !== activeSlot?.playerId) save(current => assignNormalAttackSlot(current, activePosition, p.id)); }}><span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span><span><strong>{p.firstName} {p.lastName}</strong><small>{p.position} · {startingIds.has(p.id) ? 'Startspelare' : 'Bänk'}</small></span><b>{Math.round(squadEnergy(career, p))}%</b></button>)}</div></section>
    </aside></div>
    <div className="coach-roster-layout"><section className="coach-roster"><header className="coach-section-heading"><h2>Matchtrupp · {plan.squad.players.length} spelare</h2><span>Startsju + bänk</span></header>{rosterRows(squad.filter(p => squadIds.has(p.id)))}</section><section className="coach-roster coach-outside"><header className="coach-section-heading"><h2>Ej uttagna</h2><span>{outside.length} spelare</span></header>{outside.length ? rosterRows(outside) : <p className="coach-small-empty">Alla tillgängliga spelare är uttagna.</p>}</section></div>
  </div>;
}
