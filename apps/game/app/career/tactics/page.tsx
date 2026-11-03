'use client';
import { useState, type DragEvent } from 'react';
import Link from 'next/link';
import { PageHeading } from '@/components/manager/Workspace';
import { clubColorVars, PlayerCell, PlayerGlyph, playerAvailabilityLabel } from '@/components/game/Identity';
import ClubCrest from '@/components/ClubCrest';
import { CoachingChoices, COACH_AGGRESSION_LABEL, COACH_ATTACK_LABEL, COACH_ROTATION_LABEL, COACH_SEVEN_V_SIX_LABEL, COACH_TEMPO_LABEL, type CoachAttack } from '@/components/game/CoachingChoices';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerSquad } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { getClub, type PlayerMock } from '@/lib/game-data';
import { squadEnergy } from '@/lib/career/management';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import { averageRating } from '@/lib/career/types';
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
  DefenceSection,
  FIVE_SPACES,
  LeadershipSection,
  PLAN_SECTIONS,
  PlanSummary,
  SetPieceSection,
  SPACE_ORDER,
  SpecialistSection,
  SubstitutionSection,
  TACTICAL_DRAG_PLAYER_MIME,
  type SixCode,
  type TacticalCourtMode,
} from '@/components/matchPlan/HandballPlanSections';

const COURT_ROLES: readonly { position: Position; x: number; y: number }[] = [
  { position: 'V6', x: 16, y: 21 },
  { position: 'M6', x: 50, y: 32 },
  { position: 'H6', x: 84, y: 21 },
  { position: 'V9', x: 23, y: 61 },
  { position: 'M9', x: 50, y: 75 },
  { position: 'H9', x: 77, x6: 77, y: 61 } as { position: Position; x: number; y: number },
];

const DEFENCE_COURT_COORDS: Record<'6-0' | '5-1', Record<number, { x: number; y: number; short: string }>> = {
  '6-0': {
    5: { x: 14, y: 24, short: 'V1' },
    4: { x: 28, y: 34, short: 'V2' },
    3: { x: 43, y: 39, short: 'V3' },
    2: { x: 57, y: 39, short: 'H3' },
    1: { x: 72, y: 34, short: 'H2' },
    0: { x: 86, y: 24, short: 'H1' },
  },
  '5-1': {
    5: { x: 14, y: 24, short: 'V1' },
    4: { x: 30, y: 34, short: 'V2' },
    3: { x: 50, y: 38, short: 'CH' },
    2: { x: 50, y: 58, short: 'SPETS' },
    1: { x: 70, y: 34, short: 'H2' },
    0: { x: 86, y: 24, short: 'H1' },
  },
};

const FIVE_DEFENCE_COORDS: readonly { zone: number; x: number; y: number; short: string }[] = [
  { zone: 5, x: 16, y: 25, short: 'V1' },
  { zone: 4, x: 33, y: 35, short: 'V2' },
  { zone: 2, x: 50, y: 39, short: 'MITT' },
  { zone: 1, x: 67, y: 35, short: 'H2' },
  { zone: 0, x: 84, y: 25, short: 'H1' },
];

const COURT_MODE_TABS: readonly { id: TacticalCourtMode; label: string; sub: string }[] = [
  { id: 'ATTACK_6V6', label: 'Anfall 6v6', sub: 'Startsjua' },
  { id: 'DEFENCE_6V6', label: 'Försvar 6v6', sub: '6–0 / 5–1' },
  { id: 'EXCHANGES', label: 'Försvarsbyten', sub: 'Anfall ↔ Försvar' },
  { id: 'ATTACK_6V5', label: 'Övertag 6v5', sub: 'Powerplay' },
  { id: 'DEFENCE_5V6', label: 'Undertag 5v6', sub: 'Boxplay' },
  { id: 'ATTACK_7V6', label: 'Anfall 7v6', sub: 'Tomt mål' },
];

export default function TacticsPage() {
  const { career, updateMatchPlan, updateCareer } = useCareer();
  const [activePosition, setActivePosition] = useState<Position>('V6');
  const [courtMode, setCourtMode] = useState<TacticalCourtMode>('ATTACK_6V6');
  const [selectedDefZone, setSelectedDefZone] = useState<number>(3);
  const [selected5v6Index, setSelected5v6Index] = useState<number>(0);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fixture = getNextPlayerFixture(career);
  const allSquad = getCareerSquad(career);
  const squad = allSquad.filter(p => isSelectableForMatch(career.playerStatuses, p.id));
  const own = getClub(career.playerClubId);

  const heading = (
    <PageHeading
      eyebrow="Matchförberedelse / laguttagning"
      title="Matchplan & Taktiktavla"
      description="Vem spelar var och när: anfall, försvar, byten, specialsituationer, fasta situationer och ledarskap. Dra och släpp eller klicka direkt på planen."
      actions={fixture && <Link className="hm-btn hm-btn-primary" href="/career/match-preview">Till matchen →</Link>}
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
    if (!sixIds.has(playerId)) return;
    save(current => {
      const k = defenceSystemKey(current);
      const now = effectiveDefenceSpaces(current);
      const from = now[playerId];
      const occupant = Object.keys(now).find(id => now[id] === zone);
      const next = { ...now, [playerId]: zone, ...(occupant && occupant !== playerId && from !== undefined ? { [occupant]: from } : {}) };
      return { ...current, defenceAssignments: { ...current.defenceAssignments, [k]: next } };
    });
    setSelectedDefZone(zone);
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

  function courtPlayer(position: Position) {
    const slot = plan!.attackStartingUnit.slots.find(s => s.position === position);
    const player = squad.find(p => p.id === slot?.playerId);
    const isCapt = player && roles.captainId === player.id;
    const is7m = player && roles.penaltyTakers[0] === player.id;
    const exchPartnerId = player ? plan!.substitutionPairs.find(sp => sp.attackPlayerId === player.id)?.defencePlayerId : undefined;
    const exchPartner = exchPartnerId ? squad.find(p => p.id === exchPartnerId) : undefined;

    return (
      <button
        type="button"
        className="coach-position"
        aria-label={`Välj startposition ${position === 'GK' ? 'MV' : position}`}
        aria-pressed={activePosition === position}
        data-active={activePosition === position}
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
          {position === 'GK' ? 'MV' : position}
          {isCapt && ' · K'}
          {is7m && ' · 7m'}
        </span>
        {player && <PlayerGlyph player={player} size={48} />}
        <strong>{player?.lastName ?? 'Välj spelare'}</strong>
        <small>
          {courtMode === 'EXCHANGES' && exchPartner
            ? `⇄ Försvar: ${exchPartner.lastName}`
            : player
            ? `${Math.round(squadEnergy(career, player))}% energi`
            : 'Ingen spelare'}
        </small>
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
        const player = squad.find(p => p.id === (specialistId ?? starterId));
        return (
          <div className="coach-court-slot" key={`def-${zone}`} style={{ left: `${coord.x}%`, top: `${coord.y}%` }}>
            <button
              type="button"
              className="coach-position"
              aria-label={`Försvarsposition ${DEFENCE_SPACE_LABEL[defKey][zone]}`}
              aria-pressed={selectedDefZone === zone}
              data-active={selectedDefZone === zone}
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
              <span className="coach-position-code">{coord.short}</span>
              {player && <PlayerGlyph player={player} size={46} />}
              <strong>{player?.lastName ?? 'Välj försvarare'}</strong>
              <small>{specialistId ? '⇄ Försvarsspecialist' : DEFENCE_SPACE_LABEL[defKey][zone].split('·')[0]}</small>
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
              {player && <PlayerGlyph player={player} size={46} />}
              <strong>{player?.lastName ?? 'Välj spelare'}</strong>
              <small>Numerärt övertag</small>
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
              {player && <PlayerGlyph player={player} size={46} />}
              <strong>{player?.lastName ?? 'Välj försvarare'}</strong>
              <small>Numerärt undertag</small>
            </button>
          </div>
        );
      });
    }

    if (courtMode === 'ATTACK_7V6') {
      const extraPlayer = plan!.sevenVSixPlayerId ? squad.find(p => p.id === plan!.sevenVSixPlayerId) : undefined;
      return (
        <>
          {COURT_ROLES.map(role => (
            <div className="coach-court-slot" key={role.position} style={{ left: `${role.x}%`, top: `${role.y}%` }}>
              {courtPlayer(role.position)}
            </div>
          ))}
          <div className="coach-court-slot" style={{ left: '64%', top: '34%' }}>
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
              <span className="coach-position-code">7v6 · EXTRA</span>
              {extraPlayer && <PlayerGlyph player={extraPlayer} size={46} />}
              <strong>{extraPlayer?.lastName ?? 'Auto (assistent)'}</strong>
              <small>7:e utespelare (tomt mål)</small>
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

  return (
    <div className="coach-preparation" style={clubColorVars(own)}>
      {heading}
      {notice && <p className="hm-panel-body" role="status">{notice}</p>}
      <PlanSummary career={career} plan={plan} squad={allSquad} />
      <nav className="hm-plan-nav" aria-label="Matchplanens delar">
        {PLAN_SECTIONS.map(s => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
      </nav>
      {manual && (
        <div className="hm-panel-body coach-lineup-status" role={manualIssues.length ? 'alert' : 'status'} data-complete={manualIssues.length === 0}>
          <strong>Startsju {selectedStarters}/7 · Matchtrupp {plan.squad.players.length}/{MATCH_SQUAD_MAX_PLAYERS}</strong>{' '}
          <span>{manualIssues.length ? manualIssues.join(' ') : carried ? 'Senaste uppställningen gäller. Ändra den här eller gå till matchen.' : 'Startsjuan är komplett och klar för avkast.'}</span>
          {replacementNotes.length > 0 && <ul className="coach-replacement-notes">{replacementNotes.map(note => <li key={note}>{note}</li>)}</ul>}
          {carried && (
            <>
              {' '}
              <button type="button" className="hm-btn" onClick={() => save(carried.plan)}>Behåll uppställningen</button>{' '}
              <button type="button" className="hm-btn" onClick={() => built.ok && built.plan && save(built.plan)}>Börja om med tom uppställning</button>
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
        <div>
          <strong>{fixture.date}{fixture.kickoffTime ? ` ${fixture.kickoffTime}` : ''}</strong>
          <span>{fixture.homeClubId === career.playerClubId ? 'Hemma' : 'Borta'} · {fixture.type === 'LEAGUE' ? `Omgång ${fixture.round}` : fixture.type === 'CUP' ? 'Cup' : 'Träningsmatch'}</span>
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
                  ? 'Byten anfall–försvar på taktiktavlan'
                  : courtMode === 'ATTACK_6V5'
                  ? 'Anfall 6 mot 5 · Numerärt övertag'
                  : courtMode === 'DEFENCE_5V6'
                  ? 'Försvar 5 mot 6 · Numerärt undertag'
                  : courtMode === 'ATTACK_7V6'
                  ? 'Anfall 7 mot 6 · Tomt mål & extra utespelare'
                  : 'Anfall 6 mot 6 · startsju'}
              </h2>
              <span>Dra och släpp spelare på planen eller klicka på en position för att välja</span>
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

          <div className="hm-court-mode-bar" role="tablist" aria-label="Taktiktavlans läge">
            {COURT_MODE_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={courtMode === tab.id}
                className="hm-court-mode-tab"
                data-active={courtMode === tab.id}
                onClick={() => setCourtMode(tab.id)}
              >
                <strong>{tab.label}</strong>
                <small>{tab.sub}</small>
              </button>
            ))}
          </div>

          <div className="coach-court" aria-label="Startsju på handbollsplanen" data-mode={courtMode}>
            <svg viewBox="0 0 1000 660" preserveAspectRatio="none" aria-hidden="true">
              <rect x="12" y="8" width="976" height="644" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M180 8C180 275 820 275 820 8M70 8C70 490 930 490 930 8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M440 8v18h120V8M455 305h90" fill="none" stroke="currentColor" strokeWidth="3" />
              <path d="M70 8C70 490 930 490 930 8" fill="none" stroke="#173147" strokeWidth="4" strokeDasharray="13 10" />
            </svg>
            <span className="coach-court-direction">
              {courtMode === 'DEFENCE_6V6' || courtMode === 'DEFENCE_5V6'
                ? 'FÖRSVAR FRAMFÖR EGET MÅL (6M / 9M) ↑'
                : 'ANFALL MOT MOTSTÅNDARNAS MÅL ↑'}
            </span>
            {renderCourtNodes()}
          </div>

          <div className="coach-goalkeeper">
            <span>{courtMode === 'ATTACK_7V6' ? 'Tomt mål i anfall (7 mot 6)' : 'I egna målet'}</span>
            {courtPlayer('GK')}
            <div>
              <strong>{plan.squad.players.length} / {MATCH_SQUAD_MAX_PLAYERS}</strong>
              <small>uttagna · {bench.length} på bänken</small>
            </div>
          </div>
        </section>

        <aside className="coach-plan-rail">
          <section className="coach-gameplan">
            <header className="coach-section-heading"><h2>Så spelar vi</h2><span>Din aktiva plan</span></header>
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
            <button type="button" className="hm-btn hm-btn-sm" aria-pressed={assistant} onClick={() => save(current => ({ ...current, transitionPlan: { ...current.transitionPlan, assistantRotation: !assistant } }))}>
              Assistentbyten {assistant ? 'på' : 'av'}
            </button>
          </section>

          <section className="coach-replacements">
            <header className="coach-section-heading">
              <h2>{matchPlanPositionLabel(activePosition)}</h2>
              <span>{activePosition === 'GK' ? 'MV' : activePosition}</span>
            </header>
            {activePlayer && (
              <div className="coach-current-player">
                <span className="hm-eyebrow">Startar nu</span>
                <PlayerCell player={activePlayer} />
                {manual && (
                  <button type="button" className="hm-btn" onClick={() => save(current => clearStartingPosition(current, activePosition))}>
                    Ta bort från startsjun
                  </button>
                )}
              </div>
            )}
            <p>
              {manual
                ? 'Välj eller dra en spelare till positionen. En spelare som inte är uttagen läggs till i matchtruppen.'
                : 'Välj eller dra en uttagen spelare till planen. En annan startspelare byter plats; en bänkspelare tar över rollen.'}
            </p>
            <div className="coach-candidate-list">
              {eligible.map(p => {
                const blocked = !squadIds.has(p.id) && plan.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS;
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
        </aside>
      </div>

      <DefenceSection plan={plan} squad={allSquad} save={save} onSelectCourtMode={setCourtMode} />
      <SubstitutionSection plan={plan} squad={squad} save={save} onSelectCourtMode={setCourtMode} />
      <SpecialistSection plan={plan} squad={squad} save={save} onSelectCourtMode={setCourtMode} />
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
