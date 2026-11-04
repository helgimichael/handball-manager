'use client';
import { useState, type DragEvent } from 'react';
import Link from 'next/link';
import { PageHeading } from '@/components/manager/Workspace';
import { EnvironmentBanner } from '@/components/clubhq/EnvironmentBanner';
import { clubColorVars, PlayerCell, PlayerGlyph, playerAvailabilityLabel } from '@/components/game/Identity';
import ClubCrest from '@/components/ClubCrest';
import { HandballCourtSvg } from '@/components/court/HandballCourtSvg';
import { CoachingChoices, COACH_AGGRESSION_LABEL, COACH_ATTACK_LABEL, COACH_ROTATION_LABEL, COACH_SEVEN_V_SIX_LABEL, COACH_TEMPO_LABEL, type CoachAttack } from '@/components/game/CoachingChoices';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerSquad } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getClub, type PlayerMock } from '@/lib/game-data';
import { squadEnergy } from '@/lib/career/management';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import { averageRating } from '@/lib/career/types';
import { getPlayerLastMatchRating, getPlayerLastFiveAverageRating } from '@/lib/career/playerForm';

export type TacticsVisualMode = 'ENERGY' | 'SUITABILITY' | 'LAST_MATCH' | 'LAST_5_MATCHES';
import { buildInitialMatchSquad } from '@/lib/matchPlan/careerSquadBridge';
import { buildDefaultMatchPlan } from '@/lib/matchPlan/defaultMatchPlan';
import { addPlayerToSquad, removePlayerFromSquad, assignNormalAttackSlot, assignManualStarter, isPlayerStarting } from '@/lib/matchPlan/matchPlanEdits';
import { matchPlanPositionLabel } from '@/lib/matchPlan/matchPlanLabels';
import { isSelectableForMatch } from '@/lib/career/playerStatus';
import { MATCH_SQUAD_MAX_PLAYERS, type MatchPlan, type Position } from '@/lib/matchPlan/types';
import { buildEmptyMatchPlan, carriedLineupFor, clearStartingPosition, isManualLineupCareer, manualLineupIssues, missingStartingPositions, removeUnavailableFromPlan } from '@/lib/career/manualLineup';
import { linkDefenceStarters as sharedStartingSeven, validateAttackStartingUnit } from '@/lib/matchPlan/startingUnits';
import { engineDefenceSystem, normalizeBaseFormation } from '@/lib/matchPlan/defenceFormation';
import { defencePlanAggression, engineDefensiveAggression } from '@/lib/matchPlan/defensiveAggression';
import { attackPlanTempo, engineOffensiveTempo } from '@/lib/matchPlan/offensiveTempo';
import { assistantRotationAtKickoff, engineRotationStrategy } from '@/lib/matchPlan/rotationStrategy';
import { engineSevenVSixMode, sevenVSixPolicyFor } from '@/lib/matchPlan/sevenVSix';
import { defenceSystemKey, effectiveDefenceSpaces } from '@/lib/matchPlan/engineMatchPlan';
import { currentTeamRoles } from '@/lib/career/teamRoles';
import {
  COURT_ORDER,
  DEFENCE_SPACE_LABEL,
  FIVE_SPACES,
  LeadershipSection,
  PLAN_SECTIONS,
  PlanSummary,
  SetPieceSection,
  SPACE_ORDER,
  TACTICAL_DRAG_PLAYER_MIME,
  type SixCode,
  type TacticalCourtMode,
} from '@/components/matchPlan/HandballPlanSections';
import { TacticsDiffManager } from '@/components/matchPlan/TacticsDiffManager';
import {
  deriveTacticalDiff,
  assignDefenderSpecialist,
  removeDefenderSpecialist,
  clearAllExchanges,
  getZoneLabel,
} from '@/lib/matchPlan/tacticsDiffWorkflow';

const COURT_ROLES: readonly { position: Position; x: number; y: number }[] = [
  { position: 'V6', x: 14, y: 22 },
  { position: 'M6', x: 50, y: 31 },
  { position: 'H6', x: 86, y: 22 },
  { position: 'V9', x: 22, y: 62 },
  { position: 'M9', x: 50, y: 76 },
  { position: 'H9', x: 78, y: 62 },
];

const DEFENCE_COURT_COORDS: Record<'6-0' | '5-1', Record<number, { x: number; y: number; short: string }>> = {
  '6-0': {
    5: { x: 12, y: 24, short: 'YV V' },
    4: { x: 27, y: 34, short: 'TV V' },
    3: { x: 42, y: 40, short: 'M3 V' },
    2: { x: 58, y: 40, short: 'M3 H' },
    1: { x: 73, y: 34, short: 'TV H' },
    0: { x: 88, y: 24, short: 'YV H' },
  },
  '5-1': {
    5: { x: 12, y: 24, short: 'YV V' },
    4: { x: 30, y: 33, short: 'TV V' },
    3: { x: 50, y: 31, short: 'CH' },
    2: { x: 50, y: 64, short: 'SPETS' },
    1: { x: 70, y: 33, short: 'TV H' },
    0: { x: 88, y: 24, short: 'YV H' },
  },
};

const FIVE_DEFENCE_COORDS: readonly { zone: number; x: number; y: number; short: string }[] = [
  { zone: 5, x: 14, y: 25, short: 'V1' },
  { zone: 4, x: 32, y: 35, short: 'V2' },
  { zone: 2, x: 50, y: 39, short: 'MITT' },
  { zone: 1, x: 68, y: 35, short: 'H2' },
  { zone: 0, x: 86, y: 25, short: 'H1' },
];

const COURT_MODE_TABS: readonly { id: TacticalCourtMode; label: string; sub: string }[] = [
  { id: 'ATTACK_6V6', label: 'Anfall 6v6', sub: 'Startsjua & rullespel' },
  { id: 'DEFENCE_6V6', label: 'Försvar 6v6', sub: '6–0 / 5–1 & byten' },
  { id: 'ATTACK_6V5', label: 'Överläge 6v5', sub: 'Numerärt överläge' },
  { id: 'DEFENCE_5V6', label: 'Underläge 5v6', sub: 'Numerärt underläge' },
  { id: 'ATTACK_7V6', label: 'Tomt mål 7v6', sub: '7 mot 6 utan målvakt' },
];

export default function TacticsPage() {
  const { career, updateMatchPlan, updateCareer } = useCareer();
  const [activePosition, setActivePosition] = useState<Position>('V6');
  const [courtMode, setCourtMode] = useState<TacticalCourtMode>('ATTACK_6V6');
  const [visualMode, setVisualMode] = useState<TacticsVisualMode>('ENERGY');
  const [selectedDefZone, setSelectedDefZone] = useState<number>(3);
  const [selected5v6Index, setSelected5v6Index] = useState<number>(0);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fixture = getNextPlayerFixture(career);
  const allSquad = getCareerSquad(career);
  const squad = allSquad.filter(p => isSelectableForMatch(career.playerStatuses, p.id));
  const own = getClub(career.playerClubId);

  const heading = (
    <EnvironmentBanner
      environment="tactical-room"
      eyebrow={`${own?.name ?? 'Klubben'} · Taktik- & analysrummet`}
      title="Matchplan & Taktiktavla 2.0"
      subtitle="Direktstyrning på planen: anfall, försvar, försvarsbyten och specialsituationer i en samlad interaktiv yta."
      badge={fixture ? `Nästa: ${getClub(fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId)?.shortName ?? 'Match'} (${fixture.date})` : 'Ingen match'}
      actions={
        fixture && (
          <>
            <Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/match-preview">Till matchen →</Link>
            <Link className="hm-btn hm-btn-sm" href="/career/squad">Truppen →</Link>
          </>
        )
      }
    />
  );

  if (!fixture) {
    return (
      <div className="coach-preparation" style={clubColorVars(own)}>
        {heading}
        <div className="coach-empty">
          <span className="hm-eyebrow">{career.seasonComplete ? 'Säsongens sista match är spelad' : 'Ingen kommande match'}</span>
          <h2>Nästa laguttagning väntar.</h2>
          <p>Ingen kommande match. Börja nästa säsong från Hem när serien är färdig.</p>
          <Link className="hm-btn" href="/career">Till klubben →</Link>
        </div>
      </div>
    );
  }

  const manual = isManualLineupCareer(career);
  const availableIds = new Set(squad.map(p => p.id));
  const built = manual
    ? { ok: true, plan: buildEmptyMatchPlan(fixture.id, career.playerClubId, career.tactics[career.playerClubId]) }
    : buildDefaultMatchPlan(buildInitialMatchSquad(squad, fixture.id, career.playerClubId), career.tactics[career.playerClubId], career.playerMatchDefaults);
  const carried = manual && !career.matchPlans[fixture.id] ? carriedLineupFor(career, fixture.id, squad) : null;
  const candidate = career.matchPlans[fixture.id] ?? carried?.plan ?? (built.ok ? built.plan : null);
  const plan = candidate ? sharedStartingSeven(candidate) : null;

  if (!plan) {
    return (
      <div className="coach-preparation" style={clubColorVars(own)}>
        {heading}
        <div role="alert" className="coach-empty">
          <h2>Startsjuan behöver fler spelare.</h2>
          <p>Det behövs minst sex tillgängliga utespelare och en målvakt.</p>
          <div className="hm-actions">
            <Link className="hm-btn" href="/career/squad">Öppna truppen →</Link>
            <Link className="hm-btn" href="/career/players">Hitta förstärkning →</Link>
          </div>
        </div>
      </div>
    );
  }

  const savedPlan = plan;
  const save = (edit: MatchPlan | ((current: MatchPlan) => MatchPlan)) =>
    updateMatchPlan(fixture.id, latest => sharedStartingSeven(typeof edit === 'function' ? edit(sharedStartingSeven(latest ?? savedPlan)) : edit));
  const repaired = manual ? removeUnavailableFromPlan(plan, availableIds) : built.plan;

  if (plan.squad.players.some(p => !squad.some(available => available.id === p.playerId))) {
    return (
      <div className="coach-preparation" style={clubColorVars(own)}>
        {heading}
        <div className="coach-empty" role="alert">
          <h2>Uttagningen behöver uppdateras.</h2>
          <p>Matchplanen innehåller spelare som inte är tillgängliga. Uppdatera uttagningen innan matchstart.</p>
          <button className="hm-btn hm-btn-primary" disabled={!built.ok} onClick={() => { if (built.ok && repaired) save(repaired); }}>
            {manual ? 'Ta bort otillgängliga spelare' : 'Uppdatera till tillgänglig matchtrupp'}
          </button>
          <p><Link href="/career/squad">Öppna truppen</Link></p>
        </div>
      </div>
    );
  }

  if (plan.attackStartingUnit.formation !== 'NORMAL') {
    return (
      <div className="coach-preparation" style={clubColorVars(own)}>
        {heading}
        <div className="coach-empty" role="alert">
          <h2>Välj en normal startsju.</h2>
          <p>Den sparade matchplanen använder en spelform som inte är tillgänglig i den här versionen.</p>
          <button className="hm-btn hm-btn-primary" disabled={!built.ok} onClick={() => { if (built.ok && built.plan) save(built.plan); }}>
            Skapa normal matchplan
          </button>
        </div>
      </div>
    );
  }

  const attack = plan.attackPlan;
  const lineupValidation = validateAttackStartingUnit(plan.attackStartingUnit, plan.squad);
  if (!manual && !lineupValidation.ok) {
    return (
      <div className="coach-preparation" style={clubColorVars(own)}>
        {heading}
        <div className="coach-empty" role="alert">
          <h2>Startsjuan behöver uppdateras.</h2>
          <p>{lineupValidation.errors.join(' ')}</p>
          <button className="hm-btn hm-btn-primary" disabled={!built.ok} onClick={() => { if (built.ok && built.plan) save(built.plan); }}>
            Skapa giltig matchplan
          </button>
        </div>
      </div>
    );
  }

  const manualIssues = manual ? manualLineupIssues(career.matchPlans[fixture.id] ?? carried?.plan, squad) : [];
  const selectedStarters = 7 - missingStartingPositions(plan).length;
  const nameOf = (id: string) => { const p = allSquad.find(x => x.id === id); return p ? `${p.firstName} ${p.lastName}` : id; };
  const replacementNotes = (carried?.replacements ?? []).map(r => r.inId ? `${nameOf(r.inId)} ersätter ${nameOf(r.outId)} (${r.position === 'GK' ? 'MV' : r.position}).` : `Ingen ersättare för ${nameOf(r.outId)} (${r.position === 'GK' ? 'MV' : r.position}) – välj en spelare.`);
  const identity: CoachAttack = attack.ballCirculation === 'DIRECT' ? 'DIRECT' : attack.wingUsage === 'HIGH' ? 'WIDTH' : attack.structureFreedom === 'STRUCTURED' ? 'COMBINATION' : 'BALANCED';
  const defence = engineDefenceSystem(plan.defencePlan.baseFormation);
  const defKey = defenceSystemKey(plan);
  const defSpaces = effectiveDefenceSpaces(plan);
  const diff = deriveTacticalDiff(plan, squad, p => squadEnergy(career, p), id => matchFitnessOf(career, id));
  const attackOnlySet = new Set(diff.attackOnlyPlayers.map(p => p.id));
  const defenceOnlySet = new Set(diff.defenceOnlyPlayers.map(p => p.id));
  const twoWaySet = new Set(diff.twoWayPlayers.map(p => p.id));
  const aggression = engineDefensiveAggression(plan.defencePlan);
  const rotation = engineRotationStrategy(plan.transitionPlan);
  const sevenVSix = engineSevenVSixMode(plan.attackPlan.sevenVSixPolicy);
  const assistant = assistantRotationAtKickoff(plan.transitionPlan);
  const startingIds = new Set(plan.attackStartingUnit.slots.map(slot => slot.playerId));
  const squadIds = new Set(plan.squad.players.map(p => p.playerId));
  const bench = squad.filter(p => squadIds.has(p.id) && !startingIds.has(p.id));
  const outside = allSquad.filter(p => !squadIds.has(p.id));
  const activeSlot = plan.attackStartingUnit.slots.find(slot => slot.position === activePosition);
  const activePlayer = squad.find(p => p.id === activeSlot?.playerId);
  const naturalPosition = activePosition === 'GK' ? 'MV' : activePosition;
  const positionGroup = (player: PlayerMock) => player.position === naturalPosition ? 0 : player.secondaryPosition === naturalPosition || player.secondaryPositions?.includes(naturalPosition) ? 1 : 2;
  const eligible = squad.filter(p => (manual || squadIds.has(p.id)) && (activePosition === 'GK' ? p.position === 'MV' : p.position !== 'MV')).sort((a, b) => positionGroup(a) - positionGroup(b) || Number(b.id === activeSlot?.playerId) - Number(a.id === activeSlot?.playerId));
  const opponentId = fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId;
  const opponent = getClub(opponentId);
  const roles = currentTeamRoles(career);

  function startDragPlayer(e: DragEvent<HTMLElement>, playerId: string) {
    e.dataTransfer.setData(TACTICAL_DRAG_PLAYER_MIME, playerId);
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function assignStarterAtPosition(position: Position, playerId: string) {
    const player = squad.find(p => p.id === playerId);
    if (!player) return;
    if ((position === 'GK') !== (player.position === 'MV')) {
      setNotice(position === 'GK' ? 'Endast en målvakt (MV) kan placeras i målet.' : 'Målvakter kan endast placeras i målet (MV).');
      return;
    }
    if (!manual && !squadIds.has(playerId) && plan!.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS) {
      setNotice('Matchtruppen är full (16/16). Ta bort en bänkspelare först.');
      return;
    }
    const displaced = manual && !squadIds.has(playerId) ? plan!.attackStartingUnit.slots.find(s => s.position === position)?.playerId : null;
    save(current => {
      const withSquad = !manual && !current.squad.players.some(p => p.playerId === playerId)
        ? addPlayerToSquad(current, playerId, player.position === 'MV' ? 'GK' : player.position)
        : current;
      return manual ? assignManualStarter(withSquad, position, playerId).plan : assignNormalAttackSlot(withSquad, position, playerId);
    });
    setActivePosition(position);
    setNotice(displaced ? `${nameOf(displaced)} är inte längre uttagen. Bocka i spelaren under "Ej uttagna" för att ha spelaren på bänken.` : `${player.firstName} ${player.lastName} placerad som ${position === 'GK' ? 'MV' : position}.`);
  }

  function assignDefenceZone(zone: number, playerId: string) {
    const sixIds = new Set(plan!.attackStartingUnit.slots.filter(s => s.position !== 'GK' && s.playerId).map(s => s.playerId));
    if (sixIds.has(playerId)) {
      save(current => {
        const k = defenceSystemKey(current);
        const now = effectiveDefenceSpaces(current);
        const from = now[playerId];
        const occupant = Object.keys(now).find(id => now[id] === zone);
        const next = { ...now, [playerId]: zone, ...(occupant && occupant !== playerId && from !== undefined ? { [occupant]: from } : {}) };
        return { ...current, defenceAssignments: { ...current.defenceAssignments, [k]: next } };
      });
      setSelectedDefZone(zone);
      return;
    }

    // Bench outfield player assigned as specialist for this zone
    const player = squad.find(p => p.id === playerId);
    if (player && player.position !== 'MV' && squadIds.has(playerId)) {
      save(current => assignDefenderSpecialist(current, zone, playerId));
      setSelectedDefZone(zone);
      setNotice(`${player.firstName} ${player.lastName} insatt som försvarsspecialist på ${getZoneLabel(zone, defKey)}.`);
    }
  }

  function assignExchangeOnCourt(attackPlayerId: string, defencePlayerId: string) {
    const player = squad.find(p => p.id === defencePlayerId);
    if (defencePlayerId && (!player || player.position === 'MV' || startingIds.has(defencePlayerId) || !squadIds.has(defencePlayerId))) {
      setNotice('Välj en uttagen utespelare från bänken för anfall–försvar-byte.');
      return;
    }
    save(current => ({
      ...current,
      substitutionPairs: [
        ...current.substitutionPairs.filter(p => p.attackPlayerId !== attackPlayerId && p.defencePlayerId !== defencePlayerId),
        ...(defencePlayerId ? [{ attackPlayerId, defencePlayerId }] : []),
      ],
    }));
  }

  function assign6v5Position(pos: SixCode, playerId: string) {
    const player = squad.find(p => p.id === playerId);
    if (!player || player.position === 'MV' || !squadIds.has(playerId)) return;
    save(current => {
      const base = current.situationUnits?.ATTACK_6V5 ?? current.attackStartingUnit.slots.filter(s => s.position !== 'GK').map(s => ({ playerId: s.playerId, position: s.position as SixCode }));
      const previous = base.find(e => e.position === pos)?.playerId ?? '';
      const swapped = base.map(e => (e.position === pos ? { ...e, playerId } : e.playerId === playerId ? { ...e, playerId: previous } : e));
      return { ...current, situationUnits: { ...current.situationUnits, ATTACK_6V5: swapped } };
    });
    setActivePosition(pos);
  }

  function assign5v6Slot(index: number, playerId: string) {
    const player = squad.find(p => p.id === playerId);
    if (!player || player.position === 'MV' || !squadIds.has(playerId)) return;
    save(current => {
      const base = [...(current.situationUnits?.DEFENCE_5V6 ?? FIVE_SPACES.map(zone => ({ playerId: '', zone })))];
      const clash = base.findIndex((e, i) => i !== index && e.playerId === playerId);
      if (clash >= 0) base[clash] = { ...base[clash], playerId: base[index].playerId };
      base[index] = { ...base[index], playerId };
      return { ...current, situationUnits: { ...current.situationUnits, DEFENCE_5V6: base } };
    });
    setSelected5v6Index(index);
  }

  function sendStarterToBench(playerId: string) {
    const slot = plan!.attackStartingUnit.slots.find(s => s.playerId === playerId);
    if (!slot) return;
    const pos = slot.position;
    if (manual) {
      save(current => clearStartingPosition(current, pos));
      setNotice(`${nameOf(playerId)} flyttad till bänken (${pos === 'GK' ? 'MV' : pos} är nu tom).`);
      return;
    }
    const targetNat = pos === 'GK' ? 'MV' : pos;
    const candidate = bench
      .filter(p => (pos === 'GK' ? p.position === 'MV' : p.position !== 'MV'))
      .sort((a, b) => {
        const fitA = a.position === targetNat ? 0 : a.secondaryPosition === targetNat ? 1 : 2;
        const fitB = b.position === targetNat ? 0 : b.secondaryPosition === targetNat ? 1 : 2;
        return fitA - fitB || squadEnergy(career, b) - squadEnergy(career, a);
      })[0];
    if (!candidate) {
      setNotice('Ingen tillgänglig bänkspelare för den positionen.');
      return;
    }
    save(current => assignNormalAttackSlot(current, pos, candidate.id));
    setNotice(`${nameOf(playerId)} flyttad till bänken — ${candidate.firstName} ${candidate.lastName} kliver in som ${pos === 'GK' ? 'MV' : pos}.`);
  }

  function suitabilityTone(player: PlayerMock | undefined, posCode: string): 'natural' | 'secondary' | 'out' {
    if (!player) return 'out';
    const nat = posCode === 'GK' ? 'MV' : posCode;
    if (player.position === nat) return 'natural';
    if (player.secondaryPosition === nat || (player.secondaryPositions as readonly string[] | undefined)?.includes(nat)) return 'secondary';
    return 'out';
  }

  function getVisualModeDisplay(player: PlayerMock | undefined, slotPositionOrZone: Position | number) {
    if (!player) {
      return {
        subtitle: 'Tom plats',
        barWidth: '0%',
        barColor: undefined,
        isLow: false,
      };
    }

    const energy = Math.round(squadEnergy(career, player));
    const suit = typeof slotPositionOrZone === 'string'
      ? suitabilityTone(player, slotPositionOrZone)
      : 'natural';
    const lastRating = getPlayerLastMatchRating(career, player.id);
    const avg5 = getPlayerLastFiveAverageRating(career, player.id);

    if (visualMode === 'SUITABILITY') {
      const suitPct = suit === 'natural' ? 100 : suit === 'secondary' ? 85 : 55;
      const subtitle = suit === 'natural' ? 'Naturlig roll (100%)' : suit === 'secondary' ? 'Sekundär roll (85%)' : 'Ovan roll (55%)';
      const barColor = suit === 'natural' ? 'var(--hm-tone-positive, #10b981)' : suit === 'secondary' ? 'var(--hm-accent-gold, #f59e0b)' : 'var(--hm-tone-negative, #ef4444)';
      return { subtitle, barWidth: `${suitPct}%`, barColor, isLow: suit === 'out' };
    }

    if (visualMode === 'LAST_MATCH') {
      const subtitle = lastRating !== null ? `Senaste betyg: ${lastRating.toFixed(1)}` : 'Senaste: Ingen match';
      const barWidth = lastRating !== null ? `${Math.min(100, Math.round((lastRating / 10) * 100))}%` : '0%';
      const barColor = lastRating === null ? undefined : lastRating >= 7.5 ? 'var(--hm-tone-positive, #10b981)' : lastRating >= 6.5 ? 'var(--hm-accent-primary, #3b82f6)' : 'var(--hm-accent-gold, #f59e0b)';
      return { subtitle, barWidth, barColor, isLow: lastRating !== null && lastRating < 6.0 };
    }

    if (visualMode === 'LAST_5_MATCHES') {
      const subtitle = avg5 !== null ? `Form (5M snitt): ${avg5.toFixed(1)}` : 'Form: Inga matcher';
      const barWidth = avg5 !== null ? `${Math.min(100, Math.round((avg5 / 10) * 100))}%` : '0%';
      const barColor = avg5 === null ? undefined : avg5 >= 7.5 ? 'var(--hm-tone-positive, #10b981)' : avg5 >= 6.5 ? 'var(--hm-accent-primary, #3b82f6)' : 'var(--hm-accent-gold, #f59e0b)';
      return { subtitle, barWidth, barColor, isLow: avg5 !== null && avg5 < 6.0 };
    }

    return {
      subtitle: `${player.position} · ${energy}% energi`,
      barWidth: `${energy}%`,
      barColor: undefined,
      isLow: energy < 75,
    };
  }

  function courtPlayer(position: Position) {
    const slot = plan!.attackStartingUnit.slots.find(s => s.position === position);
    const player = squad.find(p => p.id === slot?.playerId);
    const isCapt = player && roles.captainId === player.id;
    const isVice = player && roles.viceCaptainId === player.id;
    const is7m = player && roles.penaltyTakers[0] === player.id;
    const exchPartnerId = player ? plan!.substitutionPairs.find(sp => sp.attackPlayerId === player.id)?.defencePlayerId : undefined;
    const exchPartner = exchPartnerId ? squad.find(p => p.id === exchPartnerId) : undefined;
    const energy = player ? Math.round(squadEnergy(career, player)) : 0;
    const suit = suitabilityTone(player, position);
    const vis = getVisualModeDisplay(player, position);

    return (
      <button
        type="button"
        className="coach-position"
        aria-label={`Välj startposition ${position === 'GK' ? 'MV' : position}`}
        aria-pressed={activePosition === position}
        data-active={activePosition === position}
        data-suitability={suit}
        data-drag-over={dragOverSlot === `attack-${position}`}
        draggable={!!player}
        onDragStart={e => { if (player) startDragPlayer(e, player.id); }}
        onDragOver={e => { e.preventDefault(); setDragOverSlot(`attack-${position}`); }}
        onDragLeave={() => setDragOverSlot(null)}
        onDrop={e => {
          e.preventDefault();
          setDragOverSlot(null);
          const pid = e.dataTransfer.getData(TACTICAL_DRAG_PLAYER_MIME) || e.dataTransfer.getData('text/plain');
          if (!pid) return;
          if (courtMode === 'EXCHANGES' && position !== 'GK' && player) {
            assignExchangeOnCourt(player.id, pid);
          } else {
            assignStarterAtPosition(position, pid);
          }
        }}
        onClick={() => setActivePosition(position)}
      >
        <span className="coach-position-code">
          <i className="coach-suitability-dot" data-suitability={suit} aria-hidden="true" />
          {position === 'GK' ? 'MV' : position}
          {isCapt && <em className="coach-role-tag">K</em>}
          {!isCapt && isVice && <em className="coach-role-tag">VK</em>}
          {is7m && <em className="coach-role-tag">7m</em>}
        </span>
        {player && <PlayerGlyph player={player} size={42} />}
        <strong>{player?.lastName ?? 'Välj spelare'}</strong>
        {player && attackOnlySet.has(player.id) && (
          <span className="coach-specialist-badge coach-badge-attack-only">⚔️ Endast anfall</span>
        )}
        <small>
          {player && visualMode === 'ENERGY' && attackOnlySet.has(player.id) && exchPartner
            ? `⇄ Ersätts av ${exchPartner.lastName}`
            : player
            ? (visualMode === 'ENERGY' ? `${player.position} · ${energy}% · Båda vägar` : vis.subtitle)
            : 'Tom plats'}
        </small>
        {player && (
          <span className="coach-token-bar" aria-hidden="true">
            <i
              style={{ width: vis.barWidth, ...(vis.barColor ? { background: vis.barColor } : {}) }}
              data-low={vis.isLow ? 'true' : undefined}
            />
          </span>
        )}
      </button>
    );
  }

  function renderCourtNodes() {
    if (courtMode === 'DEFENCE_6V6') {
      const six = plan!.attackStartingUnit.slots.filter(s => s.position !== 'GK' && s.playerId);
      return SPACE_ORDER.map(zone => {
        const coord = DEFENCE_COURT_COORDS[defKey][zone];
        const starterId = six.find(s => defSpaces[s.playerId] === zone)?.playerId ?? '';
        const specialistId = starterId ? plan!.substitutionPairs.find(sp => sp.attackPlayerId === starterId)?.defencePlayerId : undefined;
        const starterPlayer = squad.find(p => p.id === starterId);
        const player = squad.find(p => p.id === (specialistId ?? starterId));
        const energy = player ? Math.round(squadEnergy(career, player)) : 0;
        const isSpets = defKey === '5-1' && zone === 2;
        return (
          <div
            className="coach-court-slot"
            key={`def-${zone}`}
            data-spets={isSpets ? 'true' : undefined}
            style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
          >
            <button
              type="button"
              className="coach-position"
              aria-label={`Försvarsposition ${DEFENCE_SPACE_LABEL[defKey][zone]}`}
              aria-pressed={selectedDefZone === zone}
              data-active={selectedDefZone === zone}
              data-spets={isSpets ? 'true' : undefined}
              data-drag-over={dragOverSlot === `def-${zone}`}
              draggable={!!starterId}
              onDragStart={e => { if (starterId) startDragPlayer(e, starterId); }}
              onDragOver={e => { e.preventDefault(); setDragOverSlot(`def-${zone}`); }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverSlot(null);
                const pid = e.dataTransfer.getData(TACTICAL_DRAG_PLAYER_MIME) || e.dataTransfer.getData('text/plain');
                if (pid) assignDefenceZone(zone, pid);
              }}
              onClick={() => setSelectedDefZone(zone)}
            >
              <span className="coach-position-code">
                {coord.short}
                {specialistId && <em className="coach-role-tag">⇄</em>}
              </span>
              {player && <PlayerGlyph player={player} size={42} />}
              <strong>{player?.lastName ?? 'Välj försvarare'}</strong>
              {specialistId ? (
                <span className="coach-specialist-badge coach-badge-def-only">🛡️ Specialist</span>
              ) : (
                <small>{visualMode === 'ENERGY' ? `${energy}% · Båda vägar` : getVisualModeDisplay(player, zone).subtitle}</small>
              )}
              {specialistId && starterPlayer && (
                <small style={{ fontSize: '9px', opacity: 0.85 }}>⇄ Ersätter {starterPlayer.lastName}</small>
              )}
              {player && (
                <span className="coach-token-bar" aria-hidden="true">
                  <i
                    style={{ width: getVisualModeDisplay(player, zone).barWidth, ...(getVisualModeDisplay(player, zone).barColor ? { background: getVisualModeDisplay(player, zone).barColor } : {}) }}
                    data-low={getVisualModeDisplay(player, zone).isLow ? 'true' : undefined}
                  />
                </span>
              )}
            </button>
          </div>
        );
      });
    }

    if (courtMode === 'ATTACK_6V5') {
      const six = plan!.attackStartingUnit.slots.filter(s => s.position !== 'GK');
      const unit = plan!.situationUnits?.ATTACK_6V5 ?? six.map(s => ({ playerId: s.playerId, position: s.position as SixCode }));
      return COURT_ROLES.map(role => {
        const entry = unit.find(u => u.position === role.position);
        const player = squad.find(p => p.id === entry?.playerId);
        const energy = player ? Math.round(squadEnergy(career, player)) : 0;
        const vis = getVisualModeDisplay(player, role.position);
        return (
          <div className="coach-court-slot" key={`6v5-${role.position}`} style={{ left: `${role.x}%`, top: `${role.y}%` }}>
            <button
              type="button"
              className="coach-position"
              aria-label={`6v5 position ${role.position}`}
              aria-pressed={activePosition === role.position}
              data-active={activePosition === role.position}
              draggable={!!player}
              onDragStart={e => { if (player) startDragPlayer(e, player.id); }}
              onDragOver={e => { e.preventDefault(); setDragOverSlot(`6v5-${role.position}`); }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverSlot(null);
                const pid = e.dataTransfer.getData(TACTICAL_DRAG_PLAYER_MIME) || e.dataTransfer.getData('text/plain');
                if (pid) assign6v5Position(role.position as SixCode, pid);
              }}
              onClick={() => setActivePosition(role.position)}
            >
              <span className="coach-position-code">6v5 · {role.position}</span>
              {player && <PlayerGlyph player={player} size={42} />}
              <strong>{player?.lastName ?? 'Välj spelare'}</strong>
              <small>{visualMode === 'ENERGY' ? `Överläge · ${energy}%` : vis.subtitle}</small>
              {player && (
                <span className="coach-token-bar" aria-hidden="true">
                  <i
                    style={{ width: vis.barWidth, ...(vis.barColor ? { background: vis.barColor } : {}) }}
                    data-low={vis.isLow ? 'true' : undefined}
                  />
                </span>
              )}
            </button>
          </div>
        );
      });
    }

    if (courtMode === 'DEFENCE_5V6') {
      const unit = plan!.situationUnits?.DEFENCE_5V6 ?? [];
      return FIVE_DEFENCE_COORDS.map((coord, idx) => {
        const pid = unit[idx]?.playerId ?? '';
        const player = squad.find(p => p.id === pid);
        const energy = player ? Math.round(squadEnergy(career, player)) : 0;
        const vis = getVisualModeDisplay(player, coord.zone);
        return (
          <div className="coach-court-slot" key={`5v6-${coord.zone}`} style={{ left: `${coord.x}%`, top: `${coord.y}%` }}>
            <button
              type="button"
              className="coach-position"
              aria-label={`5v6 position ${coord.short}`}
              aria-pressed={selected5v6Index === idx}
              data-active={selected5v6Index === idx}
              draggable={!!player}
              onDragStart={e => { if (player) startDragPlayer(e, player.id); }}
              onDragOver={e => { e.preventDefault(); setDragOverSlot(`5v6-${idx}`); }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverSlot(null);
                const droppedId = e.dataTransfer.getData(TACTICAL_DRAG_PLAYER_MIME) || e.dataTransfer.getData('text/plain');
                if (droppedId) assign5v6Slot(idx, droppedId);
              }}
              onClick={() => setSelected5v6Index(idx)}
            >
              <span className="coach-position-code">5v6 · {coord.short}</span>
              {player && <PlayerGlyph player={player} size={42} />}
              <strong>{player?.lastName ?? 'Välj försvarare'}</strong>
              <small>{visualMode === 'ENERGY' ? `Underläge · ${energy}%` : vis.subtitle}</small>
              {player && (
                <span className="coach-token-bar" aria-hidden="true">
                  <i
                    style={{ width: vis.barWidth, ...(vis.barColor ? { background: vis.barColor } : {}) }}
                    data-low={vis.isLow ? 'true' : undefined}
                  />
                </span>
              )}
            </button>
          </div>
        );
      });
    }

    if (courtMode === 'ATTACK_7V6') {
      const extraPlayer = plan!.sevenVSixPlayerId ? squad.find(p => p.id === plan!.sevenVSixPlayerId) : undefined;
      const extraVis = getVisualModeDisplay(extraPlayer, 'M6');
      return (
        <>
          {COURT_ROLES.map(role => (
            <div className="coach-court-slot" key={role.position} style={{ left: `${role.x}%`, top: `${role.y}%` }}>
              {courtPlayer(role.position)}
            </div>
          ))}
          <div className="coach-court-slot" style={{ left: '66%', top: '26%' }}>
            <button
              type="button"
              className="coach-position"
              aria-label="Sjunde utespelare 7 mot 6"
              data-active={true}
              onDragOver={e => { e.preventDefault(); setDragOverSlot('7v6-extra'); }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverSlot(null);
                const pid = e.dataTransfer.getData(TACTICAL_DRAG_PLAYER_MIME) || e.dataTransfer.getData('text/plain');
                const p = squad.find(x => x.id === pid);
                if (p && p.position !== 'MV' && !startingIds.has(pid) && squadIds.has(pid)) {
                  save(c => ({ ...c, sevenVSixPlayerId: pid }));
                }
              }}
            >
              <span className="coach-position-code">7v6 · 7:e utespelare</span>
              {extraPlayer && <PlayerGlyph player={extraPlayer} size={42} />}
              <strong>{extraPlayer?.lastName ?? 'Auto (assistent)'}</strong>
              <span className="coach-specialist-badge coach-badge-attack-only">7:e utespelare</span>
              <small>{visualMode === 'ENERGY' ? 'Tomt mål i anfall' : extraVis.subtitle}</small>
              {extraPlayer && (
                <span className="coach-token-bar" aria-hidden="true">
                  <i
                    style={{ width: extraVis.barWidth, ...(extraVis.barColor ? { background: extraVis.barColor } : {}) }}
                    data-low={extraVis.isLow ? 'true' : undefined}
                  />
                </span>
              )}
            </button>
          </div>
        </>
      );
    }

    return COURT_ROLES.map(role => (
      <div className="coach-court-slot" key={role.position} style={{ left: `${role.x}%`, top: `${role.y}%` }}>
        {courtPlayer(role.position)}
      </div>
    ));
  }

  function rosterRows(players: readonly PlayerMock[]) {
    return (
      <div className="hm-scroll-x">
        <table className="hm-table coach-roster-table">
          <thead>
            <tr>
              <th>Uttagen</th>
              <th>Spelare</th>
              <th>Position</th>
              <th>Roll i matchen</th>
              <th>Energi & MF</th>
              <th>Snittbetyg</th>
              <th>Tillgänglighet</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const available = isSelectableForMatch(career.playerStatuses, p.id);
              const starting = isPlayerStarting(plan!, p.id);
              const included = squadIds.has(p.id);
              const stats = career.playerSeasonStats[p.id];
              const energy = Math.round(squadEnergy(career, p));
              const mf = Math.round(matchFitnessOf(career, p.id));
              return (
                <tr
                  key={p.id}
                  data-starter={starting}
                  data-unavailable={!available}
                  draggable={available}
                  onDragStart={e => startDragPlayer(e, p.id)}
                >
                  <td>
                    <input
                      aria-label={`Ta ut ${p.firstName} ${p.lastName}`}
                      type="checkbox"
                      disabled={!available || starting || (!included && plan!.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS)}
                      title={!available ? 'Spelaren är inte tillgänglig' : starting ? 'Byt startspelare först' : !included && plan!.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS ? 'Matchtruppen är full' : undefined}
                      checked={included}
                      onChange={e => save(current => e.target.checked ? addPlayerToSquad(current, p.id, p.position === 'MV' ? 'GK' : p.position) : removePlayerFromSquad(current, p.id))}
                    />
                  </td>
                  <td><PlayerCell player={p} /></td>
                  <td>{p.position}{p.secondaryPosition ? ` / ${p.secondaryPosition}` : ''}</td>
                  <td>
                    {starting
                      ? `Start · ${plan!.attackStartingUnit.slots.find(s => s.playerId === p.id)?.position === 'GK' ? 'MV' : plan!.attackStartingUnit.slots.find(s => s.playerId === p.id)?.position}`
                      : included
                      ? 'Bänk (dra till planen)'
                      : 'Ej uttagen'}
                  </td>
                  <td>
                    <div className="coach-energy" data-low={energy < 70}>
                      <strong>{energy}% · MF {mf}%</strong>
                      <meter aria-label={`${p.firstName} ${p.lastName}: energi`} min={0} max={100} value={energy} />
                    </div>
                  </td>
                  <td>{stats?.appearances ? averageRating(stats).toFixed(1) : '—'}</td>
                  <td>{playerAvailabilityLabel(career, p.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Active rail candidate resolution based on courtMode
  function renderActiveRail() {
    if (courtMode === 'DEFENCE_6V6') {
      const six = plan!.attackStartingUnit.slots.filter(s => s.position !== 'GK' && s.playerId);
      const starterId = six.find(s => defSpaces[s.playerId] === selectedDefZone)?.playerId ?? '';
      const specialistId = starterId ? plan!.substitutionPairs.find(sp => sp.attackPlayerId === starterId)?.defencePlayerId : undefined;
      const starterPlayer = squad.find(p => p.id === starterId);
      const specialistPlayer = specialistId ? squad.find(p => p.id === specialistId) : undefined;
      const currentDefender = specialistPlayer ?? starterPlayer;
      const benchOutfield = squad.filter(p => squadIds.has(p.id) && !startingIds.has(p.id) && p.position !== 'MV');

      return (
        <section className="coach-replacements">
          <header className="coach-section-heading">
            <h2>{getZoneLabel(selectedDefZone, defKey)}</h2>
            <span>Försvarsposition · Zon {selectedDefZone}</span>
          </header>
          {currentDefender && (
            <div className="coach-current-player">
              <div>
                <span className="hm-eyebrow">
                  {specialistPlayer ? '🛡️ Försvarsspecialist (aktivt byte)' : '⚔️ Ordinarie försvarare (båda vägar)'}
                </span>
                <PlayerCell player={currentDefender} />
                {specialistPlayer && starterPlayer && (
                  <small className="hm-text-muted" style={{ display: 'block', marginTop: 4 }}>
                    Ersätter anfallaren: {starterPlayer.firstName} {starterPlayer.lastName}
                  </small>
                )}
              </div>
              {specialistPlayer && (
                <button
                  type="button"
                  className="hm-btn hm-btn-sm"
                  onClick={() => save(c => removeDefenderSpecialist(c, selectedDefZone))}
                >
                  Ta bort specialist
                </button>
              )}
            </div>
          )}
          <p>
            Välj en bänkspelare för att göra ett anfall–försvarsbyte i denna zon, eller dra en startspelare hit för att byta försvarszoner.
          </p>
          <div className="coach-candidate-list">
            <span className="hm-eyebrow" style={{ padding: '6px 8px 2px' }}>Bänkspelare (försvarsspecialister)</span>
            {benchOutfield.map(p => {
              const isSelectedSpec = p.id === specialistId;
              return (
                <button
                  type="button"
                  key={p.id}
                  draggable
                  onDragStart={e => startDragPlayer(e, p.id)}
                  aria-pressed={isSelectedSpec}
                  data-active={isSelectedSpec}
                  onClick={() => assignDefenceZone(selectedDefZone, p.id)}
                >
                  <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                  <span>
                    <strong>{p.firstName} {p.lastName}</strong>
                    <small>{p.position} · {isSelectedSpec ? 'Aktiv specialist' : 'Sätt in som specialist'}</small>
                  </span>
                  <b>{Math.round(squadEnergy(career, p))}%</b>
                </button>
              );
            })}
          </div>
        </section>
      );
    }

    if (courtMode === 'ATTACK_6V5') {
      const six = plan!.attackStartingUnit.slots.filter(s => s.position !== 'GK');
      const unit = plan!.situationUnits?.ATTACK_6V5 ?? six.map(s => ({ playerId: s.playerId, position: s.position as SixCode }));
      const entry = unit.find(u => u.position === activePosition);
      const active6v5Player = squad.find(p => p.id === entry?.playerId);
      const outfieldSquad = squad.filter(p => squadIds.has(p.id) && p.position !== 'MV');

      return (
        <section className="coach-replacements">
          <header className="coach-section-heading">
            <h2>Övertag 6 mot 5 · {matchPlanPositionLabel(activePosition)}</h2>
            <span>Numerärt överläge (6v5) · {activePosition}</span>
          </header>
          {active6v5Player && (
            <div className="coach-current-player">
              <div>
                <span className="hm-eyebrow">Spelar 6v5 som {activePosition}</span>
                <PlayerCell player={active6v5Player} />
              </div>
              <button
                type="button"
                className="hm-btn hm-btn-sm"
                onClick={() => {
                  const base = six.map(s => ({ playerId: s.playerId, position: s.position as SixCode }));
                  save(c => ({ ...c, situationUnits: { ...c.situationUnits, ATTACK_6V5: base } }));
                }}
              >
                Kopiera startsju
              </button>
            </div>
          )}
          <p>Klicka eller dra en utespelare från truppen för att bemanna positionen under numerärt övertag.</p>
          <div className="coach-candidate-list">
            {outfieldSquad.map(p => (
              <button
                type="button"
                key={p.id}
                draggable
                onDragStart={e => startDragPlayer(e, p.id)}
                aria-pressed={p.id === active6v5Player?.id}
                data-active={p.id === active6v5Player?.id}
                onClick={() => assign6v5Position(activePosition as SixCode, p.id)}
              >
                <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                <span>
                  <strong>{p.firstName} {p.lastName}</strong>
                  <small>{p.position} · {startingIds.has(p.id) ? 'Startspelare' : 'Bänk'}</small>
                </span>
                <b>{Math.round(squadEnergy(career, p))}%</b>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (courtMode === 'DEFENCE_5V6') {
      const unit = plan!.situationUnits?.DEFENCE_5V6 ?? [];
      const coord = FIVE_DEFENCE_COORDS[selected5v6Index];
      const pid = unit[selected5v6Index]?.playerId ?? '';
      const active5v6Player = squad.find(p => p.id === pid);
      const outfieldSquad = squad.filter(p => squadIds.has(p.id) && p.position !== 'MV');

      return (
        <section className="coach-replacements">
          <header className="coach-section-heading">
            <h2>Numerärt underläge (5v6) · {coord?.short ?? 'Försvar'}</h2>
            <span>Försvarszon {coord?.zone}</span>
          </header>
          {active5v6Player && (
            <div className="coach-current-player">
              <div>
                <span className="hm-eyebrow">Försvarar i numerärt underläge ({coord?.short})</span>
                <PlayerCell player={active5v6Player} />
              </div>
            </div>
          )}
          <p>Klicka eller dra en utespelare för att placera i underlägesuppställningen.</p>
          <div className="coach-candidate-list">
            {outfieldSquad.map(p => (
              <button
                type="button"
                key={p.id}
                draggable
                onDragStart={e => startDragPlayer(e, p.id)}
                aria-pressed={p.id === active5v6Player?.id}
                data-active={p.id === active5v6Player?.id}
                onClick={() => assign5v6Slot(selected5v6Index, p.id)}
              >
                <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                <span>
                  <strong>{p.firstName} {p.lastName}</strong>
                  <small>{p.position} · {startingIds.has(p.id) ? 'Startspelare' : 'Bänk'}</small>
                </span>
                <b>{Math.round(squadEnergy(career, p))}%</b>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (courtMode === 'ATTACK_7V6') {
      const extraPlayer = plan!.sevenVSixPlayerId ? squad.find(p => p.id === plan!.sevenVSixPlayerId) : undefined;
      const benchOutfield = squad.filter(p => squadIds.has(p.id) && !startingIds.has(p.id) && p.position !== 'MV');

      return (
        <section className="coach-replacements">
          <header className="coach-section-heading">
            <h2>Anfall 7 mot 6</h2>
            <span>Extra utespelare (tomt mål)</span>
          </header>
          {extraPlayer && (
            <div className="coach-current-player">
              <div>
                <span className="hm-eyebrow">Vald 7:e utespelare</span>
                <PlayerCell player={extraPlayer} />
              </div>
              <button
                type="button"
                className="hm-btn hm-btn-sm"
                onClick={() => save(c => ({ ...c, sevenVSixPlayerId: undefined }))}
              >
                Återställ till auto
              </button>
            </div>
          )}
          <p>Välj vilken bänkspelare som kliver in som sjunde utespelare när målvakten lämnar målet tomt i 7 mot 6.</p>
          <div className="coach-candidate-list">
            {benchOutfield.map(p => (
              <button
                type="button"
                key={p.id}
                draggable
                onDragStart={e => startDragPlayer(e, p.id)}
                aria-pressed={p.id === extraPlayer?.id}
                data-active={p.id === extraPlayer?.id}
                onClick={() => save(c => ({ ...c, sevenVSixPlayerId: p.id }))}
              >
                <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                <span>
                  <strong>{p.firstName} {p.lastName}</strong>
                  <small>{p.position} · Bänk</small>
                </span>
                <b>{Math.round(squadEnergy(career, p))}%</b>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (courtMode === 'EXCHANGES') {
      const activeSlotPlayer = activePlayer;
      const isGk = activePosition === 'GK';
      const currentExchangePair = activeSlotPlayer
        ? plan!.substitutionPairs.find(p => p.attackPlayerId === activeSlotPlayer.id)
        : undefined;
      const exchangePartner = currentExchangePair
        ? squad.find(p => p.id === currentExchangePair.defencePlayerId)
        : undefined;
      const benchOutfield = squad.filter(p => squadIds.has(p.id) && !startingIds.has(p.id) && p.position !== 'MV');

      return (
        <section className="coach-replacements">
          <header className="coach-section-heading">
            <h2>Försvarsbyte · {matchPlanPositionLabel(activePosition)}</h2>
            <span>{isGk ? 'MV' : activePosition}</span>
          </header>

          {isGk ? (
            <div className="coach-current-player">
              <div>
                <span className="hm-eyebrow">Målvakt</span>
                {activeSlotPlayer ? <PlayerCell player={activeSlotPlayer} /> : <span>Ingen målvakt vald</span>}
              </div>
              <p className="hm-text-muted" style={{ marginTop: 8, fontSize: 'var(--hm-text-xs)' }}>
                Målvakten byter inte position mellan anfall och försvar. Välj en utespelare på planen för att konfigurera försvarsbyte.
              </p>
            </div>
          ) : activeSlotPlayer ? (
            <div className="coach-current-player">
              <div>
                <span className="hm-eyebrow">
                  {exchangePartner ? 'Aktivt försvarsbyte' : 'Spelar båda vägar (anfall + försvar)'}
                </span>
                <PlayerCell player={activeSlotPlayer} />
                {exchangePartner && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 'var(--hm-text-xs)', fontWeight: 800 }}>⇄ Försvaras av:</span>
                    <PlayerCell player={exchangePartner} />
                  </div>
                )}
              </div>
              {exchangePartner ? (
                <button
                  type="button"
                  className="hm-btn hm-btn-sm"
                  onClick={() => assignExchangeOnCourt(activeSlotPlayer.id, '')}
                  title="Ta bort bytet så anfallaren spelar både anfall och försvar"
                >
                  Ta bort byte
                </button>
              ) : (
                <small className="hm-text-muted">Klicka på en bänkspelare nedan för att byta anfall ↔ försvar vid bollinnehav.</small>
              )}
            </div>
          ) : (
            <p className="hm-text-muted">Välj en position på taktiktavlan ovan.</p>
          )}

          {!isGk && activeSlotPlayer && (
            <>
              <p>
                <strong>Tillgängliga försvarsspecialister på bänken:</strong>
                <br />
                Klicka på en spelare för att koppla ihop bytet med {activeSlotPlayer.lastName}.
              </p>
              <div className="coach-candidate-list">
                {benchOutfield.length === 0 ? (
                  <p className="hm-text-muted" style={{ padding: 10 }}>Inga utespelare tillgängliga på bänken.</p>
                ) : (
                  benchOutfield.map(p => {
                    const isCurrentPartner = p.id === exchangePartner?.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        draggable
                        onDragStart={e => startDragPlayer(e, p.id)}
                        aria-pressed={isCurrentPartner}
                        data-active={isCurrentPartner}
                        onClick={() => assignExchangeOnCourt(activeSlotPlayer.id, isCurrentPartner ? '' : p.id)}
                        title={isCurrentPartner ? 'Klicka för att ta bort byte' : `Byt in som försvarsspecialist för ${activeSlotPlayer.lastName}`}
                      >
                        <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                        <span>
                          <strong>{p.firstName} {p.lastName}</strong>
                          <small>{p.position} · {isCurrentPartner ? '🛡️ Aktiv specialist' : 'Bänk'}</small>
                        </span>
                        <b>{Math.round(squadEnergy(career, p))}%</b>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>
      );
    }

    // Default: ATTACK_6V6 active position rail
    return (
      <section className="coach-replacements">
        <header className="coach-section-heading">
          <h2>{matchPlanPositionLabel(activePosition)}</h2>
          <span>{activePosition === 'GK' ? 'MV' : activePosition}</span>
        </header>
        {activePlayer && (
          <div className="coach-current-player">
            <div>
              <span className="hm-eyebrow">Startar nu ({activePosition === 'GK' ? 'MV' : activePosition})</span>
              <PlayerCell player={activePlayer} />
            </div>
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => sendStarterToBench(activePlayer.id)}
            >
              {manual ? 'Ta bort från startsjun' : '⇄ Byt till bänken'}
            </button>
          </div>
        )}
        <p>
          {manual
            ? 'Välj eller dra en spelare till positionen. En spelare som inte är uttagen läggs till i matchtruppen.'
            : 'Klicka eller dra en spelare till planen för direktbyte. Gröna prickar visar naturlig position.'}
        </p>
        <div className="coach-candidate-list">
          {eligible.map(p => {
            const blocked = !squadIds.has(p.id) && plan!.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS;
            return (
              <button
                type="button"
                key={p.id}
                disabled={blocked}
                draggable={!blocked}
                onDragStart={e => startDragPlayer(e, p.id)}
                title={blocked ? 'Matchtruppen är full' : 'Klicka eller dra till taktiktavlan'}
                aria-label={`Starta ${p.firstName} ${p.lastName} som ${activePosition === 'GK' ? 'MV' : activePosition}`}
                aria-pressed={p.id === activeSlot?.playerId}
                data-active={p.id === activeSlot?.playerId}
                onClick={() => {
                  if (p.id !== activeSlot?.playerId) {
                    assignStarterAtPosition(activePosition, p.id);
                  }
                }}
              >
                <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                <span>
                  <strong>{p.firstName} {p.lastName}</strong>
                  <small>{p.position} · {startingIds.has(p.id) ? 'Startspelare' : squadIds.has(p.id) ? 'Bänk' : 'Ej uttagen'}</small>
                </span>
                <b>{Math.round(squadEnergy(career, p))}%</b>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="coach-preparation" style={clubColorVars(own)}>
      {heading}
      {notice && <p className="hm-panel-body coach-tactics-notice" role="status">{notice}</p>}
      <PlanSummary career={career} plan={plan} squad={allSquad} />
      {manual && (
        <div className="hm-panel-body coach-lineup-status" role={manualIssues.length ? 'alert' : 'status'} data-complete={manualIssues.length === 0}>
          <strong>Startsju {selectedStarters}/7 · Matchtrupp {plan.squad.players.length}/{MATCH_SQUAD_MAX_PLAYERS}</strong>{' '}
          <span>{manualIssues.length ? manualIssues.join(' ') : carried ? 'Senaste uppställningen gäller. Ändra den här eller gå till matchen.' : 'Startsjuan är komplett och klar för avkast.'}</span>
          {replacementNotes.length > 0 && <ul className="coach-replacement-notes">{replacementNotes.map(note => <li key={note}>{note}</li>)}</ul>}
          {' '}
          <button
            type="button"
            className="hm-btn hm-btn-sm hm-btn-primary"
            onClick={() => {
              const auto = buildDefaultMatchPlan(buildInitialMatchSquad(squad, fixture.id, career.playerClubId), career.tactics[career.playerClubId], career.playerMatchDefaults);
              if (auto.ok && auto.plan) {
                save(auto.plan);
                setNotice('Assisterande tränaren har fyllt i startsju och 16-mannatrupp.');
              }
            }}
          >
            Assistentens förslag
          </button>
          {carried && (
            <>
              {' '}
              <button type="button" className="hm-btn hm-btn-sm" onClick={() => save(carried.plan)}>Behåll uppställningen</button>{' '}
              <button type="button" className="hm-btn hm-btn-sm" onClick={() => built.ok && built.plan && save(built.plan)}>Börja om med tom uppställning</button>
            </>
          )}
        </div>
      )}
      <div className="coach-fixture-strip">
        <div>
          <ClubCrest shortName={own?.shortName ?? 'HM'} primaryColor={own?.primaryColor ?? ''} clubId={career.playerClubId} size={42} />
          <strong>{own?.shortName}</strong>
          <span>mot</span>
          <ClubCrest shortName={opponent?.shortName ?? '?'} primaryColor={opponent?.primaryColor ?? ''} clubId={opponentId} size={42} />
          <Link href={`/career/clubs/${encodeURIComponent(opponentId)}`}>{opponent?.name ?? opponentId}</Link>
        </div>
        <div className="coach-fixture-quicklinks">
          <div>
            <strong>{fixture.date}{fixture.kickoffTime ? ` ${fixture.kickoffTime}` : ''}</strong>
            <span>{fixture.homeClubId === career.playerClubId ? 'Hemma' : 'Borta'} · {fixture.type === 'LEAGUE' ? `Omgång ${fixture.round}` : fixture.type === 'CUP' ? 'Cup' : 'Träningsmatch'}</span>
          </div>
          <nav className="coach-anchor-pills" aria-label="Hoppa till sektion">
            <button type="button" className="hm-btn hm-btn-xs" onClick={() => setCourtMode('ATTACK_6V6')}>Anfall 6v6</button>
            <button type="button" className="hm-btn hm-btn-xs" onClick={() => setCourtMode('DEFENCE_6V6')}>Försvar 6v6</button>
            <button type="button" className="hm-btn hm-btn-xs" onClick={() => setCourtMode('EXCHANGES')}>Byten & Diff</button>
            <a href="#plan-setpieces">7m & Kapten ↓</a>
            <a href="#plan-squad">Matchtrupp ({plan.squad.players.length}/16) ↓</a>
          </nav>
        </div>
      </div>

      <div className="coach-preparation-layout" id="plan-attack">
        <section className="coach-lineup">
          <header className="coach-section-heading" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2>
                {courtMode === 'DEFENCE_6V6'
                  ? `Försvar 6 mot 6 · ${defKey === '5-1' ? '5–1 (framskjuten spets)' : '6–0 (linjeförsvar)'}`
                  : courtMode === 'EXCHANGES'
                  ? 'Försvarsbyten & Diff-översikt (Anfall ↔ Försvar)'
                  : courtMode === 'ATTACK_6V5'
                  ? 'Anfall 6 mot 5 · Numerärt övertag'
                  : courtMode === 'DEFENCE_5V6'
                  ? 'Försvar 5 mot 6 · Numerärt undertag'
                  : courtMode === 'ATTACK_7V6'
                  ? 'Anfall 7 mot 6 · Tomt mål & extra utespelare'
                  : 'Anfall 6 mot 6 · Startsjua'}
              </h2>
              <span>
                {courtMode === 'EXCHANGES'
                  ? 'Kombinera anfalls- och försvarsuppställning: se vem som spelar båda vägar och vem som byts vid bollinnehav'
                  : 'Dra spelare mellan bänk och plan, byt två startspelare eller dra en startspelare till bänken'}
              </span>
            </div>
            {courtMode === 'DEFENCE_6V6' && (
              <div className="hm-actions">
                <button
                  type="button"
                  className={`hm-btn hm-btn-sm ${defKey === '6-0' ? 'hm-btn-primary' : ''}`}
                  onClick={() => save(current => ({ ...current, defencePlan: { ...current.defencePlan, baseFormation: normalizeBaseFormation('6-0') } }))}
                >
                  6–0 Försvar
                </button>
                <button
                  type="button"
                  className={`hm-btn hm-btn-sm ${defKey === '5-1' ? 'hm-btn-primary' : ''}`}
                  onClick={() => save(current => ({ ...current, defencePlan: { ...current.defencePlan, baseFormation: normalizeBaseFormation('5-1') } }))}
                >
                  5–1 Försvar
                </button>
              </div>
            )}
          </header>

          {/* Visual Mode Selector: ENERGY | SUITABILITY | LAST_MATCH | LAST_5_MATCHES */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--hm-text-muted)' }}>
                Taktikvisning:
              </span>
              <div className="hm-btn-group" role="radiogroup" aria-label="Visningsläge för spelare på planen">
                <button
                  type="button"
                  className={`hm-btn hm-btn-xs ${visualMode === 'ENERGY' ? 'hm-btn-primary' : ''}`}
                  aria-checked={visualMode === 'ENERGY'}
                  onClick={() => setVisualMode('ENERGY')}
                >
                  ⚡ Energi
                </button>
                <button
                  type="button"
                  className={`hm-btn hm-btn-xs ${visualMode === 'SUITABILITY' ? 'hm-btn-primary' : ''}`}
                  aria-checked={visualMode === 'SUITABILITY'}
                  onClick={() => setVisualMode('SUITABILITY')}
                >
                  🎯 Lämplighet
                </button>
                <button
                  type="button"
                  className={`hm-btn hm-btn-xs ${visualMode === 'LAST_MATCH' ? 'hm-btn-primary' : ''}`}
                  aria-checked={visualMode === 'LAST_MATCH'}
                  onClick={() => setVisualMode('LAST_MATCH')}
                >
                  ⭐ Senaste match
                </button>
                <button
                  type="button"
                  className={`hm-btn hm-btn-xs ${visualMode === 'LAST_5_MATCHES' ? 'hm-btn-primary' : ''}`}
                  aria-checked={visualMode === 'LAST_5_MATCHES'}
                  onClick={() => setVisualMode('LAST_5_MATCHES')}
                >
                  📈 Form (5 matcher)
                </button>
              </div>
            </div>
            <small className="hm-text-muted" style={{ fontSize: '11px' }}>
              {visualMode === 'ENERGY' && 'Visar dagsaktuell energinivå och ork'}
              {visualMode === 'SUITABILITY' && 'Visar hur väl spelaren passar rollen (naturlig vs sekundär/ovan)'}
              {visualMode === 'LAST_MATCH' && 'Visar matchbetyg från spelarens senaste genomförda framträdande'}
              {visualMode === 'LAST_5_MATCHES' && 'Visar snittbetyg över de senaste 5 spelade matcherna'}
            </small>
          </div>

          <div className="coach-court-mode-bar">
            {/* Primary Dual Lineup Switch: ATTACK | DEFENCE */}
            <div className="coach-lineup-dual-switch" role="tablist" aria-label="Primär uppställning">
              <button
                type="button"
                role="tab"
                aria-selected={courtMode === 'ATTACK_6V6'}
                className="coach-dual-tab coach-dual-tab-attack"
                data-active={courtMode === 'ATTACK_6V6'}
                onClick={() => setCourtMode('ATTACK_6V6')}
              >
                <span className="coach-dual-icon">⚔️</span>
                <div className="coach-dual-content">
                  <strong>ANFALL (6v6)</strong>
                  <small>Startsjua & anfallsroller</small>
                </div>
                {diff.attackOnlyPlayers.length > 0 ? (
                  <span className="coach-dual-badge coach-dual-badge-spec">
                    {diff.attackOnlyPlayers.length} vilar i försvar
                  </span>
                ) : (
                  <span className="coach-dual-badge coach-dual-badge-twoway">6 båda vägar</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={courtMode === 'DEFENCE_6V6'}
                className="coach-dual-tab coach-dual-tab-defence"
                data-active={courtMode === 'DEFENCE_6V6'}
                onClick={() => setCourtMode('DEFENCE_6V6')}
              >
                <span className="coach-dual-icon">🛡️</span>
                <div className="coach-dual-content">
                  <strong>FÖRSVAR (6v6)</strong>
                  <small>{defKey} uppställning & byten</small>
                </div>
                {diff.activePairs.length > 0 ? (
                  <span className="coach-dual-badge coach-dual-badge-spec">
                    {diff.activePairs.length} specialist{diff.activePairs.length > 1 ? 'er' : ''}
                  </span>
                ) : (
                  <span className="coach-dual-badge coach-dual-badge-twoway">Alla 6 båda vägar</span>
                )}
              </button>
            </div>

            {/* Special Situations */}
            <div className="coach-situation-row">
              <span className="coach-situation-label">Specialsituationer:</span>
              <div className="coach-situation-tabs" role="tablist" aria-label="Specialsituationer">
                <button
                  type="button"
                  role="tab"
                  aria-selected={courtMode === 'ATTACK_6V5'}
                  className="coach-situation-tab"
                  data-active={courtMode === 'ATTACK_6V5'}
                  onClick={() => setCourtMode('ATTACK_6V5')}
                >
                  <strong>6 mot 5</strong>
                  <small>Numerärt överläge</small>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={courtMode === 'DEFENCE_5V6'}
                  className="coach-situation-tab"
                  data-active={courtMode === 'DEFENCE_5V6'}
                  onClick={() => setCourtMode('DEFENCE_5V6')}
                >
                  <strong>5 mot 6</strong>
                  <small>Numerärt underläge</small>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={courtMode === 'ATTACK_7V6'}
                  className="coach-situation-tab"
                  data-active={courtMode === 'ATTACK_7V6'}
                  onClick={() => setCourtMode('ATTACK_7V6')}
                >
                  <strong>7 mot 6</strong>
                  <small>Spel med tomt mål</small>
                </button>
              </div>
            </div>
          </div>

          {/* Derived Exchange Banner (Utväxlingsbalk) */}
          {(courtMode === 'DEFENCE_6V6' || courtMode === 'EXCHANGES') && (
            <div className="coach-exchange-banner" data-count={diff.activePairs.length}>
              <div className="coach-exchange-info">
                <span className="coach-exchange-icon">{diff.activePairs.length > 0 ? '🔄' : '🛡️'}</span>
                <div>
                  <strong>
                    {diff.activePairs.length > 0
                      ? `Härledda försvarsbyten (${diff.activePairs.length} av 3)`
                      : 'Inga försvarsbyten aktiva (0 av 3)'}
                  </strong>
                  <span>
                    {diff.activePairs.length > 0
                      ? 'Spelarna byts automatiskt vid övergång mellan anfall och försvar:'
                      : 'Alla 6 utespelare spelar båda vägar. Byt en försvarare för att sätta in en specialist.'}
                  </span>
                </div>
              </div>
              {diff.activePairs.length > 0 && (
                <div className="coach-exchange-pairs-list">
                  {diff.activePairs.map(pair => (
                    <div key={pair.attackPlayer.id} className="coach-exchange-chip">
                      <span className="coach-exchange-out">🔴 {pair.attackPlayer.lastName} UT</span>
                      <span className="coach-exchange-arrow">⇄</span>
                      <span className="coach-exchange-in">🟢 {pair.defencePlayer.lastName} IN</span>
                      <span className="coach-exchange-pos">({pair.defensiveZoneLabel.split(' ')[0]})</span>
                      <button
                        type="button"
                        className="coach-exchange-remove"
                        title={`Återställ ${pair.defensiveZoneLabel} till ${pair.attackPlayer.lastName}`}
                        onClick={() => save(c => removeDefenderSpecialist(c, pair.defensiveZone))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="coach-exchange-actions">
                {diff.activePairs.length > 0 ? (
                  <button
                    type="button"
                    className="hm-btn hm-btn-sm"
                    onClick={() => save(clearAllExchanges)}
                  >
                    Nollställ byten (alla båda vägar)
                  </button>
                ) : (
                  <button
                    type="button"
                    className="hm-btn hm-btn-sm"
                    onClick={() => {
                      save(clearAllExchanges);
                      setNotice('Försvaret är synkroniserat med anfallet (alla 6 spelar båda vägar).');
                    }}
                  >
                    Kopiera anfall till försvar
                  </button>
                )}
              </div>
            </div>
          )}

          {courtMode === 'ATTACK_6V6' && diff.activePairs.length > 0 && (
            <div className="coach-exchange-banner coach-exchange-banner-attack" data-count={diff.activePairs.length}>
              <div className="coach-exchange-info">
                <span className="coach-exchange-icon">⚔️</span>
                <div>
                  <strong>{diff.attackOnlyPlayers.length} anfallare vilar i försvaret</strong>
                  <span>Ersätts automatiskt av försvarsspecialister vid bolltapp:</span>
                </div>
              </div>
              <div className="coach-exchange-pairs-list">
                {diff.activePairs.map(pair => (
                  <div key={pair.attackPlayer.id} className="coach-exchange-chip">
                    <span className="coach-exchange-out">⚔️ {pair.attackPlayer.lastName}</span>
                    <span className="coach-exchange-arrow">→ vilar, ersätts av</span>
                    <span className="coach-exchange-in">🛡️ {pair.defencePlayer.lastName}</span>
                  </div>
                ))}
              </div>
              <div className="coach-exchange-actions">
                <button
                  type="button"
                  className="hm-btn hm-btn-sm"
                  onClick={() => setCourtMode('DEFENCE_6V6')}
                >
                  Visa försvarsuppställning →
                </button>
              </div>
            </div>
          )}

          <div
            className="coach-court"
            aria-label="Startsju på handbollsplanen"
            data-mode={courtMode}
            data-formation={courtMode === 'DEFENCE_6V6' ? defKey : undefined}
          >
            <HandballCourtSvg className="coach-court-svg">
              {courtMode === 'DEFENCE_6V6' && defKey === '5-1' && (
                <g id="spets-guide" aria-hidden="true">
                  <ellipse cx="10" cy="11.5" rx="2.4" ry="1.2" fill="rgba(200,67,32,0.18)" stroke="#f59e6c" strokeWidth="0.08" strokeDasharray="0.2 0.15" />
                  <line x1="10" y1="10" x2="10" y2="7.5" stroke="rgba(245,158,108,0.55)" strokeWidth="0.06" strokeDasharray="0.15 0.15" />
                  <line x1="8.5" y1="10.8" x2="6.5" y2="7.5" stroke="rgba(245,158,108,0.4)" strokeWidth="0.05" strokeDasharray="0.15 0.15" />
                  <line x1="11.5" y1="10.8" x2="13.5" y2="7.5" stroke="rgba(245,158,108,0.4)" strokeWidth="0.05" strokeDasharray="0.15 0.15" />
                </g>
              )}
            </HandballCourtSvg>
            <span className="coach-court-direction">
              {courtMode === 'DEFENCE_6V6' || courtMode === 'DEFENCE_5V6'
                ? `FÖRSVARSZON FRAMFÖR EGET MÅL (${courtMode === 'DEFENCE_6V6' ? defKey : '5v6'}) ↑`
                : 'ANFALLSRIKTNING MOT MOTSTÅNDARNAS MÅL ↑'}
            </span>
            {renderCourtNodes()}
          </div>

          <div className="coach-goalkeeper">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {courtMode === 'ATTACK_7V6' ? (
                <>
                  <strong className="coach-badge-empty-net">⚠️ TOMT MÅL I ANFALL</strong>
                  <small>(Målvakt kliver av vid anfall)</small>
                </>
              ) : (
                'Målvakt (MV)'
              )}
            </span>
            {courtPlayer('GK')}
            <div>
              <strong>{plan.squad.players.length} / {MATCH_SQUAD_MAX_PLAYERS}</strong>
              <small>uttagna · {bench.length} på bänken</small>
            </div>
          </div>

          {/* Interactive Bench Strip + Court-to-Bench Dropzone */}
          <div
            className="coach-bench-strip"
            data-drag-over={dragOverSlot === 'bench-dropzone'}
            onDragOver={e => {
              e.preventDefault();
              setDragOverSlot('bench-dropzone');
            }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={e => {
              e.preventDefault();
              setDragOverSlot(null);
              const pid = e.dataTransfer.getData(TACTICAL_DRAG_PLAYER_MIME) || e.dataTransfer.getData('text/plain');
              if (pid && startingIds.has(pid)) {
                sendStarterToBench(pid);
              }
            }}
          >
            <div className="coach-bench-strip-head">
              <div>
                <span className="hm-eyebrow">Avbytarbänken ({bench.length} spelare)</span>
                <strong>Dra en bänkspelare till planen — eller släpp en startspelare här för att byta till bänken</strong>
              </div>
              <span className="coach-bench-drop-badge">⇄ Släpp här: Till bänken</span>
            </div>
            <div className="coach-bench-tokens">
              {bench.map(p => {
                const energy = Math.round(squadEnergy(career, p));
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="coach-bench-token"
                    draggable
                    onDragStart={e => startDragPlayer(e, p.id)}
                    onClick={() => {
                      if (courtMode === 'DEFENCE_6V6') {
                        assignDefenceZone(selectedDefZone, p.id);
                      } else {
                        assignStarterAtPosition(activePosition, p.id);
                      }
                    }}
                    title={
                      courtMode === 'DEFENCE_6V6'
                        ? `Sätt in som specialist på ${getZoneLabel(selectedDefZone, defKey)}`
                        : `Dra till planen eller klicka för att sätta in som ${activePosition === 'GK' ? 'MV' : activePosition}`
                    }
                  >
                    <PlayerGlyph player={p} size={32} />
                    <div>
                      <strong>{p.lastName}</strong>
                      <small>{p.position} · {visualMode === 'ENERGY' ? `${energy}%` : getVisualModeDisplay(p, p.position === 'MV' ? 'GK' : p.position).subtitle}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diff & Exchange Overview (Unified Workspace) */}
          {courtMode === 'EXCHANGES' && (
            <TacticsDiffManager
              plan={plan}
              squad={allSquad}
              save={save}
              onSelectCourtMode={setCourtMode}
            />
          )}
        </section>

        <aside className="coach-plan-rail">
          <section className="coach-gameplan">
            <header className="coach-section-heading"><h2>Så spelar vi</h2><span>Din aktiva matchplan</span></header>
            <CoachingChoices
              defence={defence}
              sevenVSix={sevenVSix}
              onSevenVSix={value => save(current => ({ ...current, attackPlan: { ...current.attackPlan, sevenVSixPolicy: sevenVSixPolicyFor(value) } }))}
              rotation={rotation}
              onRotation={value => save(current => ({ ...current, transitionPlan: { ...current.transitionPlan, rotationStrategy: value } }))}
              aggression={aggression}
              onAggression={value => save(current => ({ ...current, defencePlan: { ...current.defencePlan, ...defencePlanAggression(value) } }))}
              tempo={engineOffensiveTempo(attack)}
              attack={identity}
              onDefence={value => save(current => ({ ...current, defencePlan: { ...current.defencePlan, baseFormation: normalizeBaseFormation(value) } }))}
              onTempo={value => save(current => ({ ...current, attackPlan: { ...current.attackPlan, tempo: attackPlanTempo(value) } }))}
              onAttack={value => save(current => ({ ...current, attackPlan: { ...current.attackPlan, ballCirculation: value === 'DIRECT' ? 'DIRECT' : 'BALANCED', wingUsage: value === 'WIDTH' ? 'HIGH' : 'MEDIUM', structureFreedom: value === 'COMBINATION' ? 'STRUCTURED' : 'BALANCED' } }))}
            />
            <p className="coach-active-plan">
              {defence} · {COACH_AGGRESSION_LABEL[aggression]} aggressivitet · {COACH_TEMPO_LABEL[engineOffensiveTempo(attack)]} tempo · {COACH_ATTACK_LABEL[identity]} · {COACH_ROTATION_LABEL[rotation]} rotation
              {sevenVSix !== 'OFF' ? ` · 7 mot 6 ${COACH_SEVEN_V_SIX_LABEL[sevenVSix].toLowerCase()}` : ''}
            </p>
            <div style={{ padding: '10px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <small className="hm-text-muted">Assisterande tränarens automatiska byten under match</small>
              <button type="button" className="hm-btn hm-btn-sm" aria-pressed={assistant} onClick={() => save(current => ({ ...current, transitionPlan: { ...current.transitionPlan, assistantRotation: !assistant } }))}>
                Assistentbyten {assistant ? 'på' : 'av'}
              </button>
            </div>
          </section>

          {renderActiveRail()}
        </aside>
      </div>

      <SetPieceSection career={career} squad={squad} updateCareer={updateCareer} />
      <LeadershipSection career={career} squad={allSquad} updateCareer={updateCareer} />

      <div className="coach-roster-layout" id="plan-squad">
        <section className="coach-roster">
          <header className="coach-section-heading">
            <h2>Matchtrupp · {plan.squad.players.length} spelare</h2>
            <span>Startsju + bänk (dra en bänkspelare till planen)</span>
          </header>
          {rosterRows(squad.filter(p => squadIds.has(p.id)))}
        </section>
        <section className="coach-roster coach-outside">
          <header className="coach-section-heading">
            <h2>Ej uttagna</h2>
            <span>{outside.length} spelare</span>
          </header>
          {outside.length ? rosterRows(outside) : <p className="coach-small-empty">Alla tillgängliga spelare är uttagna.</p>}
        </section>
      </div>
    </div>
  );
}
