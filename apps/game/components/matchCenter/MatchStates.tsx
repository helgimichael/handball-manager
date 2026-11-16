'use client';
/**
 * MDY-02m (A) -- quick finish as a simulation progress card (score bug ticking over a 0-60 track with goal ticks,
 * then the report opens automatically) and the no-session states (loading, error, no replay) as proper cards.
 * Presentation only: the simulation itself is the existing quick-finish loop in ProductionMatchView.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ProductionMatchSession } from '@/lib/career/productionMatch';
import ClubCrest from '@/components/ClubCrest';
import { getClub } from '@/lib/game-data';
import { clockText } from '@/lib/matchCenter/model';
import { simulationProgress } from './liveFlow';

export function SimulationProgress({ session }: { session: ProductionMatchSession }) {
    const core = session.core, teamOf = new Map(session.people.map(p => [p.id, p.team]));
    const goals = core.events.filter(e => e.type === 'GOAL').map(e => ({ id: e.id, timestamp: e.officialMs, team: e.actorId ? teamOf.get(e.actorId) ?? null : null }));
    const progress = simulationProgress(core.officialClock.timeMs, goals), done = core.match?.phase === 'FULLTIME';
    const minute = Math.min(60, Math.floor(core.officialClock.timeMs / 60000));
    const h = getClub(session.fixture.homeClubId), a = getClub(session.fixture.awayClubId);
    return <section className="mc-simulation" role="status" aria-live="polite" aria-label="Matchen spelas färdigt" data-done={done || undefined}>
        <span className="game-overline">{done ? 'Slutsignal' : 'Spelar till slut'}</span>
        <div className="mc-sim-bug">
            <span>{h && <ClubCrest shortName={h.shortName} primaryColor={h.primaryColor} clubId={h.id} size={40} />}<b>{h?.shortName ?? 'Hemma'}</b></span>
            <strong>{core.score.HOME}<i>–</i>{core.score.AWAY}</strong>
            <span>{a && <ClubCrest shortName={a.shortName} primaryColor={a.primaryColor} clubId={a.id} size={40} />}<b>{a?.shortName ?? 'Borta'}</b></span>
        </div>
        <div className="mc-sim-track" role="progressbar" aria-valuemin={0} aria-valuemax={60} aria-valuenow={minute} aria-valuetext={`${clockText(core.officialClock.timeMs)} av 60 minuter`}>
            <i className="mc-sim-fill" style={{ '--mc-sim': `${(progress.at * 100).toFixed(1)}%` } as CSSProperties} />
            <i className="mc-sim-half" aria-hidden="true" />
            {progress.goals.map(g => <b key={g.id} className="mc-sim-goal" data-team={g.team} style={{ left: `${(g.at * 100).toFixed(1)}%` }} aria-hidden="true" />)}
        </div>
        <div className="mc-sim-scale" aria-hidden="true"><span>0′</span><span>30′</span><span>60′</span></div>
        <p>{done ? 'Resultatet sparas och matchrapporten öppnas.' : `${clockText(core.officialClock.timeMs)} spelad. Resten simuleras med samma matchmotor; rapporten öppnas automatiskt.`}</p>
    </section>;
}

/** A centred state card for the match page when there is no live session. */
export function MatchStateCard({ tone = 'info', title, children, actions }: { tone?: 'info' | 'error' | 'loading'; title: string; children?: ReactNode; actions?: ReactNode }) {
    return <section className="mc-state-card" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
        {tone === 'loading' && <i className="mc-state-spinner" aria-hidden="true" />}
        <h2>{title}</h2>
        {children}
        {actions && <div className="mc-state-actions">{actions}</div>}
    </section>;
}
