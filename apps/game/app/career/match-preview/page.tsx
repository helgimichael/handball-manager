"use client";
import { MatchHero } from '@/components/game/Identity';
import { PageHeading } from '@/components/manager/Workspace';
import MatchContext from "@/components/manager/MatchContext";

import { useRouter } from "next/navigation";
import { useState } from 'react';
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerSquad } from "@/lib/career/careerWorld";
import { getNextPlayerFixture } from "@/lib/career/calendar";
import { isSelectableForMatch, resolveStatusLabel } from "@/lib/career/playerStatus";
import { PlayerLink } from "@/components/entityLinks";
import { startProductionMatch } from '@/lib/career/productionMatch';

export default function MatchPreviewPage() {
  const router = useRouter();
  const { career, updateCareer } = useCareer();
  const [error, setError] = useState<string | null>(null);
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

  // HM-MATCH-1.3A Part C: the ONE explicit action that may create a live
  // session and transition into FIRST_HALF. `playManagerFixture()` is
  // itself idempotent (a no-op once the fixture's MATCHDAY_READY event
  // is already resolved -- matchdayAction.ts), so re-pressing this after
  // already starting the match never re-simulates; `startLiveMatchSession`
  // is equally idempotent for the same fixtureId (liveMatchSessionActions.ts),
  // so together this always resumes rather than restarts.
  function handlePlayMatch() {
    try {
      updateCareer(state => startProductionMatch(state, fixture!.id));
      router.push(`/career/match-day/${fixture!.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Matchen kunde inte startas.'); }
  }

  function handleQuickResult() {
    try {
      updateCareer(state => startProductionMatch(state, fixture!.id));
      router.push(`/career/match-day/${fixture!.id}?finish=1`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Matchen kunde inte startas.'); }
  }


  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      {error && <div role="alert" className="hm-panel-body">{error}</div>}
      <PageHeading eyebrow={fixture.date} title="Matchförhandsvisning" description="Laget, motståndaren och planen inför avkast." />
      <MatchHero career={career} fixture={fixture} context={isMatchdayReady ? 'MATCHDAG' : 'INFÖR AVKAST'}>
        {isMatchdayReady ? <><button type="button" className="hm-btn hm-btn-primary" onClick={handlePlayMatch}>{hasActiveSessionForFixture ? "FORTSÄTT MATCH →" : "STARTA MATCH →"}</button><button type="button" className="hm-btn" onClick={handleQuickResult}>SNABBRESULTAT</button></> : <span>Fortsätt säsongen till matchdagen för att spela.</span>}
      </MatchHero>
      <MatchContext fixture={fixture} />
      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
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
            {career.matchPlans[fixture.id] ? <p>Matchtruppen innehåller {career.matchPlans[fixture.id].squad.players.length} spelare. Försvar: {career.matchPlans[fixture.id].defencePlan.baseFormation}. Öppna Taktik för att granska startsjuan och dina instruktioner.</p> : <p>Granska truppens tillgänglighet och välj startsju och instruktioner i Taktik innan avkast.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
