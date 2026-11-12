"use client";
import { OpponentScoutingPanel } from '@/components/scouting/OpponentScoutingPanel';
import { MatchHero, PlayerCell } from '@/components/game/Identity';
import { PageHeading } from '@/components/manager/Workspace';
import MatchContext from "@/components/manager/MatchContext";
import { MatchdayStage } from "@/components/matchday/Matchday";

import { useRouter } from "next/navigation";
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerSquad } from "@/lib/career/careerWorld";
import { getNextPlayerFixture } from "@/lib/career/calendar";
import { isSelectableForMatch, resolveStatusLabel } from "@/lib/career/playerStatus";
import { PlayerLink } from "@/components/entityLinks";
import { tryStartProductionMatch } from '@/lib/career/productionMatch';
import { validateCareerLineup } from '@/lib/career/spatialMatch/careerLineup';
import { isManualLineupCareer, manualLineupIssues, resolveManualMatchPlan } from '@/lib/career/manualLineup';
import { readinessSummary } from '@/lib/training/readinessSummary';
import { assessMatchdaySquad } from '@/lib/matchPlan/matchdaySquadCheck';
import { squadEnergy } from '@/lib/career/management';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { currentTeamRoles } from '@/lib/career/teamRoles';
import type { Position } from '@/lib/matchPlan/types';
import { matchDayHref } from '@/lib/career/fixtureRoutes';

const PREVIEW_SLOTS: readonly Position[] = ['GK', 'V6', 'V9', 'M9', 'H9', 'H6', 'M6'];

export default function MatchPreviewPage() {
  const router = useRouter();
  const { career, updateCareer } = useCareer();
  const [error, setError] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState<'LIVE' | 'QUICK' | null>(null);
  const fixture = getNextPlayerFixture(career);
  const squad = getCareerSquad(career);
  const unavailable = squad.filter((p) => !isSelectableForMatch(career.playerStatuses, p.id));

  if (career.seasonComplete) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Säsongen är avslutad — inga fler matcher att förhandsvisa.</div>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Ingen kommande match schemalagd.</div>
      </div>
    );
  }

  const isMatchdayReady = fixture.date === career.gameDate && career.careerEvents.some(event => event.id === `MATCHDAY_READY:${fixture.id}` && !event.resolved);
  const hasActiveSessionForFixture = career.productionMatch?.fixture.id === fixture.id;
  const availableSquad = squad.filter(p => isSelectableForMatch(career.playerStatuses, p.id));
  const savedPlan = isManualLineupCareer(career) ? resolveManualMatchPlan(career, fixture.id, availableSquad) : career.matchPlans[fixture.id];
  const considered = savedPlan ? availableSquad.filter(p => savedPlan.squad.players.some(s => s.playerId === p.id)) : availableSquad;
  const lowReadiness = considered.map(player => ({ player, summary: readinessSummary(career, player.id) }))
    .filter(({ summary }) => summary.readiness < 70 || summary.outlook === "REDUCED")
    .sort((a, b) => a.summary.readiness - b.summary.readiness).slice(0, 6);

  const lineupErrors = hasActiveSessionForFixture ? []
    : isManualLineupCareer(career) ? manualLineupIssues(savedPlan, availableSquad)
    : savedPlan ? validateCareerLineup(savedPlan, availableSquad).errors : [];

  const squadCheck = savedPlan && !hasActiveSessionForFixture ? assessMatchdaySquad(savedPlan, availableSquad.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, isGoalkeeper: p.position === 'MV', energy: squadEnergy(career, p), matchFitness: matchFitnessOf(career, p.id) }))) : null;
  const blocking = lineupErrors.length ? [] : squadCheck?.blocking ?? [];
  const roles = currentTeamRoles(career);

  function requestStart(kind: 'LIVE' | 'QUICK') {
    if (squadCheck && squadCheck.warnings.length > 0) setPendingStart(kind);
    else if (kind === 'LIVE') handlePlayMatch(); else handleQuickResult();
  }

  // Division 2 playable qualification: check the start first; a failure is shown here and changes nothing.
  // The career updater applies the same start and keeps the career as it was if it cannot start.
  function startMatch(options: { quick?: boolean }) {
    const attempt = tryStartProductionMatch(career, fixture!.id, options);
    if (!attempt.ok) { setError(attempt.error); return; }
    setError(null);
    updateCareer(state => { const started = tryStartProductionMatch(state, fixture!.id, options); return started.ok ? started.state : state; });
    router.push(matchDayHref(fixture!.id, { finish: !!options.quick }));
  }

  function handlePlayMatch() { startMatch({}); }

  function handleQuickResult() { startMatch({ quick: true }); }

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      {error && <div role="alert" className="hm-panel-body">{error}</div>}
      {blocking.length > 0 && <div role="alert" className="hm-panel-body hm-squad-check">{blocking.map(b => <span key={b.code} data-kind="blocking">{b.text}</span>)} <Link href="/career/tactics">Rätta matchtruppen i Taktik →</Link></div>}
      {pendingStart && squadCheck && <ConfirmDialog tone="warning" eyebrow="Kontrollera matchtruppen" title={squadCheck.warnings.some(w => w.code === 'NO_SUBSTITUTES') ? 'Du har inga avbytare uttagna. Vill du verkligen starta matchen?' : 'Vill du starta matchen med den här truppen?'} confirmLabel={pendingStart === 'LIVE' ? 'Starta matchen' : 'Spela snabbresultat'} cancelLabel="Tillbaka till laguttagningen" onCancel={() => { setPendingStart(null); router.push('/career/tactics'); }} onConfirm={() => { const kind = pendingStart; setPendingStart(null); if (kind === 'LIVE') handlePlayMatch(); else handleQuickResult(); }}>
        <p>Matchtrupp: {squadCheck.registered} spelare · {squadCheck.benchOutfield} utespelare och {squadCheck.benchGoalkeepers} {squadCheck.benchGoalkeepers === 1 ? 'målvakt' : 'målvakter'} på bänken.</p>
        <ul>{squadCheck.warnings.map(w => <li key={w.code}>{w.text}</li>)}</ul>
        <p>Endast de uttagna spelarna kan användas under matchen. Inga spelare läggs till automatiskt.</p>
      </ConfirmDialog>}
      {lineupErrors.length > 0 && <div role="alert" className="hm-panel-body">{lineupErrors.join(' ')} <Link href="/career/tactics">{isManualLineupCareer(career) ? 'Välj startsju i Taktik →' : 'Öppna Taktik och uppdatera startsjuan.'}</Link></div>}
      <PageHeading
        eyebrow={fixture.kickoffTime ? `${fixture.date} · ${fixture.kickoffTime}` : fixture.date}
        title="Matchförhandsvisning"
        description="Laget, motståndaren och planen inför avkast."
        actions={<Link className="hm-btn" href="/career/tactics">Justera taktik & matchtrupp →</Link>}
      />
      <MatchdayStage fixture={fixture} matchday={isMatchdayReady} />
      <MatchHero career={career} fixture={fixture} context={isMatchdayReady ? 'MATCHDAG' : 'INFÖR AVKAST'}>
        {isMatchdayReady ? <><button type="button" className="hm-btn hm-btn-primary" disabled={lineupErrors.length > 0 || blocking.length > 0} onClick={() => hasActiveSessionForFixture ? handlePlayMatch() : requestStart('LIVE')}>{hasActiveSessionForFixture ? "FORTSÄTT MATCH →" : "STARTA MATCH →"}</button><button type="button" className="hm-btn" disabled={lineupErrors.length > 0 || blocking.length > 0} onClick={() => requestStart('QUICK')}>SNABBRESULTAT</button></> : <span>Fortsätt säsongen till matchdagen för att spela.</span>}
      </MatchHero>
      <MatchContext fixture={fixture} />
      <OpponentScoutingPanel compact />
      <div className="hm-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Din matchförberedelse & startsjua</span>
            <Link className="hm-btn hm-btn-sm" href="/career/tactics">Taktiktavla →</Link>
          </div>
          <div className="hm-panel-body" style={{ fontSize: "var(--hm-text-xs)", color: "var(--hm-text-secondary)", lineHeight: 1.6 }}>
            {savedPlan ? (
              <>
                <p style={{ marginTop: 0 }}>
                  Matchtruppen innehåller <strong>{savedPlan.squad.players.length}</strong> spelare
                  {career.matchPlans[fixture.id] ? '' : ' (senaste uppställningen)'}. Försvar: <strong>{savedPlan.defencePlan.baseFormation}</strong> · Anfallsstil:{' '}
                  <strong>{savedPlan.attackPlan.tempo}</strong>.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 6, marginTop: 8 }}>
                  {PREVIEW_SLOTS.map((slot) => {
                    const pid = savedPlan.attackStartingUnit.slots.find((s) => s.position === slot)?.playerId;
                    const p = pid ? squad.find((x) => x.id === pid) : undefined;
                    return (
                      <div key={slot} className="hm-role-slot-card" style={{ padding: "6px 8px" }}>
                        <div className="hm-role-slot-top">
                          <span className="hm-role-slot-badge">{slot === 'GK' ? 'MV' : slot}</span>
                          {pid && roles.captainId === pid && <span className="hm-badge" data-tone="accent">K</span>}
                          {pid && roles.penaltyTakers[0] === pid && <span className="hm-badge" data-tone="good">7m</span>}
                        </div>
                        {p ? (
                          <PlayerCell player={p} />
                        ) : (
                          <span className="hm-text-muted">Ej uttagen</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p>Granska truppens tillgänglighet och välj startsju och instruktioner i Taktik innan avkast.</p>
            )}
            {lowReadiness.length > 0 && (
              <div aria-label="Lägre beredskap" style={{ marginTop: 10 }}>
                <strong>Lägre beredskap inför matchen</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                  {lowReadiness.map(({ player, summary }) => (
                    <li key={player.id}>
                      <PlayerLink playerId={player.id}>{player.firstName} {player.lastName}</PlayerLink> · {Math.round(summary.readiness)}% energi
                      {summary.week.complete ? ` · ${Math.round(summary.week.total)} i belastning senaste 7 d` : ""}
                      {summary.outlook === "REDUCED" ? " · nedsatt återhämtning" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Otillgängliga spelare</span>
          </div>
          {unavailable.length === 0 ? (
            <div className="hm-panel-body hm-text-muted">Ingen spelare saknas — full trupp tillgänglig inför avkast.</div>
          ) : (
            <table className="hm-table">
              <tbody>
                {unavailable.map((p) => (
                  <tr key={p.id}>
                    <td className="hm-td-strong">
                      <PlayerCell player={p} />
                    </td>
                    <td>{p.position}</td>
                    <td>
                      <span className="hm-badge hm-badge-negative">{resolveStatusLabel(career.playerStatuses, p)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
