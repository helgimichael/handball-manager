'use client';
import { useMemo, useState } from 'react';
import type { ProductionMatchSession, MatchCommand } from '@/lib/career/productionMatch';
import type { MatchCenterModel } from '@/lib/matchCenter/model';
import { type TeamId, type Role, otherTeam } from '@handball-manager/handball-engine/src/v2/core/state';
import type { TeamTactics } from '@handball-manager/handball-engine/src/v2/core/coaching';
import { CoachingChoices } from '@/components/game/CoachingChoices';
import type { MatchControl } from '@/lib/media/discipline';
import { getClub } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import { clockText } from '@/lib/matchCenter/model';

const ROLE_LABEL: Record<Role, string> = { LW: 'V6', LB: 'V9', CB: 'M9', RB: 'H9', RW: 'H6', P: 'M6', P2: 'M6', GK: 'MV' };

export type ContextualInstruction = {
    id: string;
    title: string;
    description: string;
    patch: Partial<Pick<TeamTactics, 'defence' | 'tempo' | 'attackIdentity' | 'rotation' | 'aggression' | 'rotationStrategy' | 'sevenVSix' | 'instruction'>>;
    isRecommended: boolean;
};

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

    const [outId, setOutId] = useState<string | null>(null);
    const [inId, setInId] = useState<string | null>(null);

    const courtPlayers = useMemo(() => {
        return core.players
            .filter(p => p.team === team && p.population === 'COURT')
            .map(p => {
                const person = session.people.find(x => x.id === p.id);
                return {
                    id: p.id,
                    kind: p.kind,
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

    const selectedOut = useMemo(() => {
        return outId ? courtPlayers.find(p => p.id === outId) : null;
    }, [courtPlayers, outId]);

    const benchReplacements = useMemo(() => {
        if (!selectedOut) return [];
        return core.players
            .filter(p => p.team === team && p.population === 'BENCH' && !p.condition.unavailable && !p.condition.exitRequired && !(p.condition.attacksRemaining > 0) && p.kind === selectedOut.kind)
            .map(p => {
                const person = session.people.find(x => x.id === p.id);
                return {
                    id: p.id,
                    kind: p.kind,
                    role: p.role,
                    number: person?.number ?? '—',
                    name: person?.name ?? p.id,
                    energy: Math.round(p.condition.energy * 100),
                };
            });
    }, [core.players, session.people, team, selectedOut]);

    const selectedIn = useMemo(() => {
        return inId ? benchReplacements.find(p => p.id === inId) : null;
    }, [benchReplacements, inId]);

    const pendingExchange = useMemo(() => {
        return core.exchanges.find(e => e.team === team && e.phase !== 'COMPLETED' && e.phase !== 'CANCELLED');
    }, [core.exchanges, team]);

    // Contextual team instructions based on scoreline, half, and opponent tactical setup
    const opponent = otherTeam(team);
    const margin = team === 'HOME' ? model.result.homeGoals - model.result.awayGoals : model.result.awayGoals - model.result.homeGoals;
    const opponentDefence = core.coaching[opponent]?.defence ?? '6:0';

    const contextualInstructions: ContextualInstruction[] = useMemo(() => {
        return [
            {
                id: 'HIGH_PRESS_TRANSITION',
                title: 'Hög press & snabb omställning',
                description: 'Flytta fram i 5:1, höj aggressiviteten och tryck intensivt i andrafas.',
                patch: { defence: '5:1', aggression: 'HIGH', tempo: 'QUICK', instruction: 'HIGH_PRESS_TRANSITION' },
                isRecommended: margin <= -2,
            },
            {
                id: 'COMPACT_CONTROL',
                title: 'Täta bakåt & kontrollerat tempo',
                description: 'Sjunk ned i kompakt 6:0 och sänk farten för att vårda bollen och stänga ytor.',
                patch: { defence: '6:0', aggression: 'LOW', tempo: 'SLOW', instruction: 'COMPACT_CONTROL' },
                isRecommended: margin >= 2,
            },
            {
                id: 'WIDTH_FOCUS',
                title: 'Bredda spelet & gå för kantlägen',
                description: 'Dra isär motståndarnas mur till hörnpositionerna och skapa öppningar utvändigt.',
                patch: { attackIdentity: 'WIDTH', tempo: 'BALANCED', instruction: 'WIDTH_FOCUS' },
                isRecommended: margin >= -1 && margin <= 1 && opponentDefence === '6:0',
            },
            {
                id: 'PATIENT_COMBINATIONS',
                title: 'Tålamod & uppställt kombinationsspel',
                description: 'Rulla runt med disciplin, korsa på nio meter och vänta in högprocentiga skottlägen.',
                patch: { attackIdentity: 'COMBINATION', tempo: 'SLOW', instruction: 'PATIENT_COMBINATIONS' },
                isRecommended: margin >= -1 && margin <= 1 && opponentDefence !== '6:0',
            },
            {
                id: 'SEVEN_ON_SIX_PUSH',
                title: 'Extraspela 7 mot 6',
                description: 'Ta ut målvakten och spela med två linjespelare för numerärt överläge i anfall.',
                patch: { sevenVSix: 'ALWAYS', tempo: 'BALANCED', instruction: 'SEVEN_ON_SIX_PUSH' },
                isRecommended: model.period === 2 && margin <= -3,
            },
        ];
    }, [margin, model.period, opponentDefence]);

    const activeInstructionId = tactics?.instruction;

    function handleApplyInstruction(inst: ContextualInstruction) {
        if (!onCommand) return;
        onCommand({ kind: 'TACTICS', team, patch: inst.patch });
    }

    function handleConfirmSubstitution() {
        if (!onCommand || !outId || !inId) return;
        onCommand({ kind: 'SUBSTITUTION', team, outId, inId });
        setOutId(null);
        setInId(null);
    }

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
                                ? 'Utnyttja pausen för att ge nya direktiv, göra byten och samla kraft.'
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
                {/* Left Column: Contextual Instructions & Tactical Settings */}
                <div className="mc-timeout-tactics-col">
                    <section className="mc-timeout-section">
                        <header className="mc-timeout-section-head">
                            <h3>Kontextuellt lagdirektiv</h3>
                            <span className="mc-timeout-section-hint">Välj lagets primära fokus inför återupptagandet</span>
                        </header>
                        {control?.by === 'ASSISTANT' ? (
                            <div className="mc-timeout-assistant-notice" role="status">
                                <strong>{control.name} leder laget från bänken</strong>
                                <p>{control.reason}</p>
                                <p>Assisterande tränaren samlar laget enligt matchplanen du förberedde.</p>
                            </div>
                        ) : (
                            <div className="mc-timeout-instructions-list">
                                {contextualInstructions.map(inst => {
                                    const isActive = activeInstructionId === inst.id;
                                    return (
                                        <button
                                            key={inst.id}
                                            type="button"
                                            className={`mc-timeout-instruction-btn ${isActive ? 'is-active' : ''} ${inst.isRecommended ? 'is-recommended' : ''}`}
                                            onClick={() => handleApplyInstruction(inst)}
                                            aria-pressed={isActive}
                                        >
                                            <div className="mc-timeout-instruction-header">
                                                <strong>{inst.title}</strong>
                                                <div className="mc-timeout-instruction-badges">
                                                    {inst.isRecommended && <span className="mc-timeout-recommended-badge">Rekommenderat</span>}
                                                    {isActive && <span className="mc-timeout-active-badge">Aktivt ✓</span>}
                                                </div>
                                            </div>
                                            <p>{inst.description}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="mc-timeout-section">
                        <header className="mc-timeout-section-head">
                            <h3>Taktiska grundinställningar</h3>
                        </header>
                        {tactics && onCommand && control?.by !== 'ASSISTANT' && (
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
                        )}
                    </section>
                </div>

                {/* Right Column: Court Lineup & Quick Substitution */}
                <div className="mc-timeout-court-col">
                    <section className="mc-timeout-section">
                        <header className="mc-timeout-section-head">
                            <h3>Spelare på planen ({courtPlayers.length})</h3>
                            <span className="mc-timeout-section-hint">Klicka på en spelare för att byta ut</span>
                        </header>

                        {pendingExchange && (
                            <div className="mc-timeout-pending-notice" role="status">
                                Byte pågår: #{session.people.find(x => x.id === pendingExchange.outId)?.number ?? pendingExchange.outId} → #{session.people.find(x => x.id === pendingExchange.inId)?.number ?? pendingExchange.inId}
                            </div>
                        )}

                        <div className="mc-timeout-players-list">
                            {courtPlayers.map(p => {
                                const isSelectedOut = p.id === outId;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className={`mc-timeout-player-chip ${isSelectedOut ? 'is-selected-out' : ''}`}
                                        onClick={() => {
                                            if (control?.by === 'ASSISTANT') return;
                                            if (outId === p.id) {
                                                setOutId(null);
                                                setInId(null);
                                            } else {
                                                setOutId(p.id);
                                                setInId(null);
                                            }
                                        }}
                                        aria-pressed={isSelectedOut}
                                        disabled={control?.by === 'ASSISTANT'}
                                    >
                                        <span className="mc-timeout-player-number">{p.number}</span>
                                        <div className="mc-timeout-player-info">
                                            <strong>{p.name}</strong>
                                            <small>{ROLE_LABEL[p.role]} · {p.energy}% energi</small>
                                        </div>
                                        <div className="mc-timeout-chip-actions">
                                            <div
                                                className="mc-timeout-energy-bar"
                                                style={{ width: `${Math.max(10, Math.min(100, p.energy))}%`, background: p.energy < 70 ? '#ef4444' : '#10b981' }}
                                                aria-hidden="true"
                                            />
                                            <span className="mc-timeout-action-pill">{isSelectedOut ? 'Vald ut' : 'Byt'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Bench Replacements Drawer when player selected */}
                    {selectedOut && control?.by !== 'ASSISTANT' && (
                        <section className="mc-timeout-substitution-box">
                            <header className="mc-timeout-sub-header">
                                <h4>Ersätt #{selectedOut.number} {selectedOut.name} ({ROLE_LABEL[selectedOut.role]})</h4>
                                <small>Välj tillgänglig avbytare från bänken:</small>
                            </header>

                            {benchReplacements.length === 0 ? (
                                <p className="mc-timeout-empty-bench">Inga tillgängliga ersättare på bänken på denna position.</p>
                            ) : (
                                <div className="mc-timeout-bench-list">
                                    {benchReplacements.map(p => {
                                        const isSelectedIn = p.id === inId;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className={`mc-timeout-bench-chip ${isSelectedIn ? 'is-selected-in' : ''}`}
                                                onClick={() => setInId(p.id)}
                                                aria-pressed={isSelectedIn}
                                            >
                                                <span className="mc-timeout-player-number">{p.number}</span>
                                                <div className="mc-timeout-player-info">
                                                    <strong>{p.name}</strong>
                                                    <small>{ROLE_LABEL[p.role]} · {p.energy}% energi</small>
                                                </div>
                                                <span className="mc-timeout-action-pill">{isSelectedIn ? 'Vald in' : 'Välj'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedIn && (
                                <div className="mc-timeout-confirm-wrap">
                                    <div className="mc-timeout-confirm-label">
                                        Byte: #{selectedOut.number} {selectedOut.name} <strong>→</strong> #{selectedIn.number} {selectedIn.name}
                                    </div>
                                    <button
                                        type="button"
                                        className="hm-btn hm-btn-primary mc-timeout-confirm-btn"
                                        onClick={handleConfirmSubstitution}
                                    >
                                        Genomför snabbyte
                                    </button>
                                </div>
                            )}
                        </section>
                    )}
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
