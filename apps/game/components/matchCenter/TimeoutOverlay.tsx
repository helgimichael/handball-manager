'use client';
import { useMemo } from 'react';
import type { ProductionMatchSession, MatchCommand } from '@/lib/career/productionMatch';
import type { MatchCenterModel } from '@/lib/matchCenter/model';
import type { TeamId, Role } from '@handball-manager/handball-engine/src/v2/core/state';
import { CoachingChoices } from '@/components/game/CoachingChoices';
import type { MatchControl } from '@/lib/media/discipline';
import { getClub } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import { clockText } from '@/lib/matchCenter/model';

const ROLE_LABEL: Record<Role, string> = { LW: 'V6', LB: 'V9', CB: 'M9', RB: 'H9', RW: 'H6', P: 'M6', P2: 'M6', GK: 'MV' };

export function TimeoutOverlay({
    session,
    model,
    team,
    names,
    callingTeam,
    onCommand,
    onResumeTimeout,
    control,
}: {
    session: ProductionMatchSession;
    model: MatchCenterModel;
    team: TeamId;
    names: Record<TeamId, string>;
    callingTeam?: TeamId;
    onCommand?: (command: MatchCommand) => void;
    onResumeTimeout?: () => void;
    control?: MatchControl | null;
}) {
    const core = session.core;
    const isOwnTimeout = callingTeam === team;
    const callingName = callingTeam ? names[callingTeam] : 'Laget';
    const callingClubId = callingTeam === 'HOME' ? session.fixture.homeClubId : session.fixture.awayClubId;
    const callingClub = getClub(callingClubId);
    const tactics = core.coaching[team];
    const courtPlayers = useMemo(() => {
        return core.players
            .filter(p => p.team === team && p.population === 'COURT')
            .map(p => {
                const person = session.people.find(x => x.id === p.id);
                return {
                    id: p.id,
                    role: p.role,
                    number: person?.number ?? '—',
                    name: person?.name ?? p.id,
                    energy: Math.round(p.condition.energy * 100),
                };
            });
    }, [core.players, session.people, team]);

    const activeSuspensions = useMemo(() => {
        return model.players.filter(p => p.population === 'SUSPENDED' && p.remainingSuspension > 0);
    }, [model.players]);

    return (
        <section className="mc-timeout-overlay" role="dialog" aria-modal="false" aria-label="Lagtimeout">
            <header className="mc-timeout-header">
                <div className="mc-timeout-badge-wrap">
                    <ClubCrest
                        shortName={callingClub?.shortName ?? '—'}
                        primaryColor={callingClub?.primaryColor ?? ''}
                        clubId={callingClub?.id}
                        size={48}
                    />
                    <div>
                        <span className="game-overline">Officiell Timeout</span>
                        <h2>{isOwnTimeout ? 'Din timeout · Samla laget' : `Motståndarens timeout · ${callingName}`}</h2>
                        <p>
                            {isOwnTimeout
                                ? 'Utnyttja pausen för att ge nya taktiska direktiv och samla kraft.'
                                : `${callingName} har kallat till bänken. Justera försvars- och anfallstaktiken inför återupptagandet.`}
                        </p>
                    </div>
                </div>
                <div className="mc-timeout-state-card">
                    <span className="mc-timeout-score">
                        {names.HOME} <strong>{model.result.homeGoals}–{model.result.awayGoals}</strong> {names.AWAY}
                    </span>
                    <small>Halvlek {model.period} · Matchklocka {clockText(model.clock)}</small>
                    {model.manpower && (
                        <div className="mc-timeout-manpower">
                            Utespelare: {model.manpower.HOME} mot {model.manpower.AWAY}
                            {activeSuspensions.length > 0 && (
                                <span> ({activeSuspensions.map(s => `${names[s.team]} #${s.number} ${clockText(s.remainingSuspension)}`).join(', ')})</span>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <div className="mc-timeout-body">
                <div className="mc-timeout-tactics-col">
                    <h3>Taktiska instruktioner</h3>
                    {control?.by === 'ASSISTANT' ? (
                        <div className="mc-timeout-assistant-notice" role="status">
                            <strong>{control.name} leder laget från bänken</strong>
                            <p>{control.reason}</p>
                            <p>Assisterande tränaren samlar laget enligt matchplanen du förberedde.</p>
                        </div>
                    ) : (
                        tactics && onCommand && (
                            <CoachingChoices
                                defence={tactics.defence}
                                aggression={tactics.aggression ?? 'BALANCED'}
                                tempo={tactics.tempo}
                                attack={tactics.attackIdentity}
                                rotation={tactics.rotationStrategy ?? 'BALANCED'}
                                sevenVSix={tactics.sevenVSix ?? 'OFF'}
                                onDefence={value => onCommand({ kind: 'TACTICS', team, patch: { defence: value } })}
                                onAggression={value => onCommand({ kind: 'TACTICS', team, patch: { aggression: value } })}
                                onTempo={value => onCommand({ kind: 'TACTICS', team, patch: { tempo: value } })}
                                onAttack={value => onCommand({ kind: 'TACTICS', team, patch: { attackIdentity: value } })}
                                onRotation={value => onCommand({ kind: 'TACTICS', team, patch: { rotationStrategy: value } })}
                                onSevenVSix={value => onCommand({ kind: 'TACTICS', team, patch: { sevenVSix: value } })}
                            />
                        )
                    )}
                </div>

                <div className="mc-timeout-court-col">
                    <h3>Spelare på planen ({courtPlayers.length})</h3>
                    <div className="mc-timeout-players-list">
                        {courtPlayers.map(p => (
                            <div key={p.id} className="mc-timeout-player-chip">
                                <span className="mc-timeout-player-number">{p.number}</span>
                                <div className="mc-timeout-player-info">
                                    <strong>{p.name}</strong>
                                    <small>{ROLE_LABEL[p.role]} · {p.energy}% energi</small>
                                </div>
                                <div
                                    className="mc-timeout-energy-bar"
                                    style={{ width: `${Math.max(10, Math.min(100, p.energy))}%`, background: p.energy < 70 ? '#ef4444' : '#10b981' }}
                                    aria-hidden="true"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <footer className="mc-timeout-footer">
                <div className="mc-timeout-footer-meta">
                    {model.timeouts && (
                        <span>Timeouts kvar: {names.HOME} {model.timeouts.HOME} · {names.AWAY} {model.timeouts.AWAY}</span>
                    )}
                    <small>Besluten träder i kraft omedelbart vid domarens signal.</small>
                </div>
                {onResumeTimeout && (
                    <button
                        type="button"
                        className="hm-btn hm-btn-primary mc-timeout-resume-action"
                        onClick={onResumeTimeout}
                    >
                        Återgå till match
                    </button>
                )}
            </footer>
        </section>
    );
}

