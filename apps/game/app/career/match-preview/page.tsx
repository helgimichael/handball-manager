"use client";
import { OpponentScoutingPanel } from '@/components/scouting/OpponentScoutingPanel';
import { MatchHero } from '@/components/game/Identity';
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
import { startProductionMatch } from '@/lib/career/productionMatch';
import { validateCareerLineup } from '@/lib/career/spatialMatch/careerLineup';
import { isManualLineupCareer, manualLineupIssues, resolveManualMatchPlan } from '@/lib/career/manualLineup';
import { readinessSummary } from '@/lib/training/readinessSummary';
import { assessMatchdaySquad } from '@/lib/matchPlan/matchdaySquadCheck';
import { squadEnergy } from '@/lib/career/management';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';

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

  // Career Rhythm's Continue Controller now stops exactly on the fixture's
  // own date with an unresolved MATCHDAY_READY (Spec S11.2) -- that IS the
  // matchday-ready condition, replacing the old jump-model's
  // "is this the next fixture" comparison.
  const isMatchdayReady = fixture.date === career.gameDate && career.careerEvents.some(event => event.id === `MATCHDAY_READY:${fixture.id}` && !event.resolved);
  // HM-MATCH-1.3A Part C: the manager may have already pressed STARTA
  // MATCH once (e.g. they went back to check Squad/Tactics from Live
  // Match) -- an already-active session for THIS fixture means "resume",
  // never "restart".
  const hasActiveSessionForFixture = career.productionMatch?.fixture.id === fixture.id;
  const availableSquad = squad.filter(p => isSelectableForMatch(career.playerStatuses, p.id));
  const savedPlan = isManualLineupCareer(career) ? resolveManualMatchPlan(career, fixture.id, availableSquad) : career.matchPlans[fixture.id];
  // HM-ALPHA2-02B: players in the chosen match squad (or, before selection,
  // the available squad) whose readiness or recovery deserves a look.
  const considered = savedPlan ? availableSquad.filter(p => savedPlan.squad.players.some(s => s.playerId === p.id)) : availableSquad;
  const lowReadiness = considered.map(player => ({ player, summary: readinessSummary(career, player.id) }))
    .filter(({ summary }) => summary.readiness < 70 || summary.outlook === "REDUCED")
    .sort((a, b) => a.summary.readiness - b.summary.readiness).slice(0, 6);
  // HM-ALPHA2-01: a MANUAL career must have an explicit, complete selection
  // (no plan at all is itself incomplete); legacy careers only validate a
  // saved plan, falling back to their generated default otherwise.
  const lineupErrors = hasActiveSessionForFixture ? []
    : isManualLineupCareer(career) ? manualLineupIssues(savedPlan, availableSquad)
    : savedPlan ? validateCareerLineup(savedPlan, availableSquad).errors : [];

  // HM-MATCH-1.3A Part C: the ONE explicit action that may create a live
  // session and transition into FIRST_HALF. `playManagerFixture()` is
  // itself idempotent (a no-op once the fixture's MATCHDAY_READY event
  // is already resolved -- matchdayAction.ts), so re-pressing this after
  // already starting the match never re-simulates; `startLiveMatchSession`
  // is equally idempotent for the same fixtureId (liveMatchSessionActions.ts),
  // so together this always resumes rather than restarts.
  // HM-PLAYTEST-01 1.2: illegal selections are blocked; legal but risky ones
  // need an explicit confirmation before kickoff.
  const squadCheck = savedPlan && !hasActiveSessionForFixture ? assessMatchdaySquad(savedPlan, availableSquad.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, isGoalkeeper: p.position === 'MV', energy: squadEnergy(career, p), matchFitness: matchFitnessOf(career, p.id) }))) : null;
  const blocking = lineupErrors.length ? [] : squadCheck?.blocking ?? [];
  function requestStart(kind: 'LIVE' | 'QUICK') {
    if (squadCheck && squadCheck.warnings.length > 0) setPendingStart(kind);
    else if (kind === 'LIVE') handlePlayMatch(); else handleQuickResult();
  }

  function handlePlayMatch() {
    try {
      updateCareer(state => startProductionMatch(state, fixture!.id));
      router.push(`/career/match-day/${fixture!.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Matchen kunde inte startas.'); }
  }

  function handleQuickResult() {
    try {
      updateCareer(state => startProductionMatch(state, fixture!.id, { quick: true }));
      router.push(`/career/match-day/${fixture!.id}?finish=1`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Matchen kunde inte startas.'); }
  }


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
      <PageHeading eyebrow={fixture.kickoffTime ? `${fixture.date} · ${fixture.kickoffTime}` : fixture.date} title="Matchförhandsvisning" description="Laget, motståndaren och planen inför avkast." />
      <MatchdayStage fixture={fixture} matchday={isMatchdayReady} />
      <MatchHero career={career} fixture={fixture} context={isMatchdayReady ? 'MATCHDAG' : 'INFÖR AVKAST'}>
        {isMatchdayReady ? <><button type="button" className="hm-btn hm-btn-primary" disabled={lineupErrors.length > 0 || blocking.length > 0} onClick={() => hasActiveSessionForFixture ? handlePlayMatch() : requestStart('LIVE')}>{hasActiveSessionForFixture ? "FORTSÄTT MATCH →" : "STARTA MATCH →"}</button><button type="button" className="hm-btn" disabled={lineupErrors.length > 0 || blocking.length > 0} onClick={() => requestStart('QUICK')}>SNABBRESULTAT</button></> : <span>Fortsätt säsongen till matchdagen för att spela.</span>}
      </MatchHero>
      <MatchContext fixture={fixture} />
      <OpponentScoutingPanel compact />
      <div className="hm-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Otillgängliga spelare</span>
          </div>
          {unavailable.length === 0 ? (
            <div className="hm-panel-body hm-text-muted">Ingen trupp saknas — full trupp tillgänglig.</div>
          ) : (
            <table className="hm-table">
              <tbody>
                {unavailable.map((p) => (
                  <tr key={p.id}>
                    <td className="hm-td-strong">
                      <PlayerLink playerId={p.id}>
                        {p.firstName} {p.lastName}
                      </PlayerLink>
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
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Din matchförberedelse</span>
          </div>
          <div className="hm-panel-body" style={{ fontSize: "var(--hm-text-xs)", color: "var(--hm-text-secondary)", lineHeight: 1.6 }}>
            {savedPlan ? <p>Matchtruppen innehåller {savedPlan.squad.players.length} spelare{career.matchPlans[fixture.id] ? '' : ' (senaste uppställningen)'}. Försvar: {savedPlan.defencePlan.baseFormation}. Öppna Taktik för att granska startsjuan och dina instruktioner.</p> : <p>Granska truppens tillgänglighet och välj startsju och instruktioner i Taktik innan avkast.</p>}
            {lowReadiness.length > 0 && <div aria-label="Lägre beredskap"><strong>Lägre beredskap inför matchen</strong><ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>{lowReadiness.map(({ player, summary }) => <li key={player.id}><PlayerLink playerId={player.id}>{player.firstName} {player.lastName}</PlayerLink> · {Math.round(summary.readiness)}% energi{summary.week.complete ? ` · ${Math.round(summary.week.total)} i belastning senaste 7 d` : ""}{summary.outlook === "REDUCED" ? " · nedsatt återhämtning" : ""}</li>)}</ul></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
