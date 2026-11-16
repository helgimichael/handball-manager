'use client';
import { useMemo, useState } from 'react';
import type { ProductionMatchSession, MatchCommand } from '@/lib/career/productionMatch';
import type { MatchCenterModel } from '@/lib/matchCenter/model';
import { type TeamId, otherTeam } from '@handball-manager/handball-engine/src/v2/core/state';
import type { TeamTactics } from '@handball-manager/handball-engine/src/v2/core/coaching';
import { COACH_AGGRESSION_LABEL, COACH_ATTACK_LABEL, COACH_SEVEN_V_SIX_LABEL, COACH_TEMPO_LABEL } from '@/components/game/CoachingChoices';
import type { MatchControl } from '@/lib/media/discipline';
import { getClub } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import { clockText } from '@/lib/matchCenter/model';
import { byEnergy, energyTone, huddleDirectives } from './liveFlow';

export type ContextualInstruction = {
    id: string;
    title: string;
    description: string;
    intendedEffect: string;
    tradeoff: string;
    durationCondition: string;
    patch: Partial<Pick<TeamTactics, 'defence' | 'tempo' | 'attackIdentity' | 'rotation' | 'aggression' | 'rotationStrategy' | 'sevenVSix' | 'instruction'>>;
    isRecommended: boolean;
};

export function getContextualInstructions(margin = 0, opponentDefence = '6:0', period: number | null | undefined = 1): ContextualInstruction[] {
    return [
        {
            id: 'HIGH_PRESS_TRANSITION',
            title: 'Hög press & snabb omställning',
            description: 'Flytta fram i 5:1, höj aggressiviteten och tryck intensivt i andrafas.',
            intendedEffect: 'Ökar bollstölder och snabba kontringsmål genom offensiv spets i 5:1.',
            tradeoff: 'Ökad risk för utvisningar och stora ytor bakom spetsen om motståndaren bryter pressen.',
            durationCondition: 'Gäller tills nästa mål/avbrott eller tills du justerar taktiken.',
            patch: { defence: '5:1', aggression: 'HIGH', tempo: 'QUICK', instruction: 'HIGH_PRESS_TRANSITION' },
            isRecommended: margin <= -2,
        },
        {
            id: 'COMPACT_CONTROL',
            title: 'Täta bakåt & kontrollerat tempo',
            description: 'Sjunk ned i kompakt 6:0 och sänk farten för att vårda bollen och stänga ytor.',
            intendedEffect: 'Minimerar tekniska fel, stänger mittförsvaret i 6:0 och drar ned motståndarnas fart.',
            tradeoff: 'Minskar egna kontringsmöjligheter och tillåter motståndarna mer bollinnehav.',
            durationCondition: 'Gäller tills du återställer till balanserat spel.',
            patch: { defence: '6:0', aggression: 'LOW', tempo: 'SLOW', instruction: 'COMPACT_CONTROL' },
            isRecommended: margin >= 2,
        },
        {
            id: 'WIDTH_FOCUS',
            title: 'Bredda spelet & gå för kantlägen',
            description: 'Dra isär motståndarnas mur till hörnpositionerna och skapa öppningar utvändigt.',
            intendedEffect: 'Drar isär motståndarnas 6:0-försvar mot kanterna och skapar fria avslut och inspel.',
            tradeoff: 'Mindre direkthot från nio meter centralt om kantspelarna missar sina avslut.',
            durationCondition: 'Gäller under anfallsfaserna fram till nästa taktiska justering.',
            patch: { attackIdentity: 'WIDTH', tempo: 'BALANCED', instruction: 'WIDTH_FOCUS' },
            isRecommended: margin >= -1 && margin <= 1 && opponentDefence === '6:0',
        },
        {
            id: 'PATIENT_COMBINATIONS',
            title: 'Tålamod & uppställt kombinationsspel',
            description: 'Rulla runt med disciplin, korsa på nio meter och vänta in högprocentiga skottlägen.',
            intendedEffect: 'Tröttar ut motståndarnas försvarsmur med växlar och tvingar fram luckor för genombrott eller M6.',
            tradeoff: 'Risk för passivitetsvarning vid utdragna anfall om avsluten dröjer för länge.',
            durationCondition: 'Gäller i uppställt anfallsspel tills matchbilden förändras.',
            patch: { attackIdentity: 'COMBINATION', tempo: 'SLOW', instruction: 'PATIENT_COMBINATIONS' },
            isRecommended: margin >= -1 && margin <= 1 && opponentDefence !== '6:0',
        },
        {
            id: 'SEVEN_ON_SIX_PUSH',
            title: 'Extraspela 7 mot 6',
            description: 'Ta ut målvakten och spela med två linjespelare för numerärt överläge i anfall.',
            intendedEffect: 'Garanterar numerärt övertag (7 mot 6) i anfall med två linjespelare som binder mittförsvaret.',
            tradeoff: 'Målet står helt tomt vid tekniskt fel eller räddning — motståndaren kan kasta i tomt mål.',
            durationCondition: 'Gäller så länge 7 mot 6 är aktivt i anfall.',
            patch: { sevenVSix: 'ALWAYS', tempo: 'BALANCED', instruction: 'SEVEN_ON_SIX_PUSH' },
            isRecommended: period === 2 && margin <= -3,
        },
    ];
}

const PATCH_LABEL: { key: keyof ContextualInstruction['patch']; label: string; value: (v: string) => string }[] = [
    { key: 'defence', label: 'Försvar', value: v => v },
    { key: 'aggression', label: 'Aggressivitet', value: v => COACH_AGGRESSION_LABEL[v as keyof typeof COACH_AGGRESSION_LABEL] ?? v },
    { key: 'tempo', label: 'Tempo', value: v => COACH_TEMPO_LABEL[v as keyof typeof COACH_TEMPO_LABEL] ?? v },
    { key: 'attackIdentity', label: 'Anfall', value: v => COACH_ATTACK_LABEL[v as keyof typeof COACH_ATTACK_LABEL] ?? v },
    { key: 'sevenVSix', label: '7 mot 6', value: v => COACH_SEVEN_V_SIX_LABEL[v as keyof typeof COACH_SEVEN_V_SIX_LABEL] ?? v },
];
/** What a directive actually changes, in the dock's own words ("Försvar 5:1 · Tempo Snabbt"). */
export function directiveChanges(patch: ContextualInstruction['patch']): string {
    return PATCH_LABEL.filter(p => patch[p.key] !== undefined).map(p => `${p.label} ${p.value(String(patch[p.key]))}`).join(' · ');
}

/** Whiteboard backdrop for the huddle: a court in chalk lines (decorative). */
function Whiteboard() {
    return <svg className="mc-huddle-board" viewBox="0 0 200 110" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" strokeWidth=".8"><rect x="2" y="2" width="196" height="106" /><path d="M100 2V108" /><path d="M2 25A30 30 0 0 1 32 55A30 30 0 0 1 2 85" /><path strokeDasharray="3 3" d="M2 10A45 45 0 0 1 47 55A45 45 0 0 1 2 100" /><path d="M198 25A30 30 0 0 0 168 55A30 30 0 0 0 198 85" /><path strokeDasharray="3 3" d="M198 10A45 45 0 0 0 153 55A45 45 0 0 0 198 100" /><circle cx="100" cy="55" r="9" /></g></svg>;
}

/**
 * MDY-02h (A) Timeout huddle phase -- during a team time-out the centre of the Match Center becomes the huddle:
 * 2-3 contextual directive cards (effect, trade-off, duration) on a whiteboard. Substitutions and base tactics stay
 * in the Bench Dock beside it (no second panel). Directives use the existing TACTICS command only.
 */
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
    const assistant = control?.by === 'ASSISTANT' ? control : null;

    const activeSuspensions = useMemo(() => model.players.filter(p => p.population === 'SUSPENDED' && p.remainingSuspension > 0), [model.players]);
    const pendingExchange = core.exchanges.find(e => e.team === team && e.phase !== 'COMPLETED' && e.phase !== 'CANCELLED');
    const opponent = otherTeam(team);
    const margin = team === 'HOME' ? model.result.homeGoals - model.result.awayGoals : model.result.awayGoals - model.result.homeGoals;
    const opponentDefence = core.coaching[opponent]?.defence ?? '6:0';
    const activeInstructionId = tactics?.instruction;
    const directives = useMemo(() => huddleDirectives(getContextualInstructions(margin, opponentDefence, model.period), activeInstructionId), [margin, opponentDefence, model.period, activeInstructionId]);
    const tired = useMemo(() => byEnergy(core.players.filter(p => p.team === team && p.population === 'COURT' && energyTone(p.condition.energy * 100) !== 'ok'), p => p.condition.energy).slice(0, 3), [core.players, team]);
    const [acknowledgedMessage, setAcknowledgedMessage] = useState<string | null>(null);
    const person = (id: string | null) => session.people.find(x => x.id === id);

    function handleResume() {
        if (!onResumeTimeout) return;
        const active = directives.find(d => d.id === activeInstructionId);
        setAcknowledgedMessage(active ? `Spelet återupptas: ${active.title}.` : `Spelet återupptas efter timeout för ${callingName}.`);
        setTimeout(() => onResumeTimeout(), 150);
    }

    return (
        <section className="mc-timeout-overlay mc-huddle" role="dialog" aria-modal="false" aria-label="Lagtimeout" data-own={isOwnTimeout || undefined}>
            <header className="mc-timeout-header mc-huddle-head">
                <ClubCrest shortName={callingClub?.shortName ?? '—'} primaryColor={callingClub?.primaryColor ?? ''} clubId={callingClub?.id} size={44} />
                <div>
                    <span className="game-overline">Timeout · {clockText(model.clock)}</span>
                    <h2>{isOwnTimeout ? 'Din timeout · Samla laget' : `Motståndarens timeout · ${callingName}`}</h2>
                    <p>{isOwnTimeout ? 'Välj ett direktiv. Byten och taktik gör du i bänken bredvid.' : `${callingName} har kallat in laget. Svara med ett direktiv eller justera i bänken.`}</p>
                </div>
                <dl className="mc-huddle-state">
                    <div><dt>Ställning</dt><dd>{names.HOME} {model.result.homeGoals}–{model.result.awayGoals} {names.AWAY}</dd></div>
                    {model.manpower && <div><dt>På plan</dt><dd>{model.manpower.HOME} mot {model.manpower.AWAY}{activeSuspensions.length > 0 && ` · ${activeSuspensions.map(s => `${names[s.team]} #${s.number} ${clockText(s.remainingSuspension)}`).join(', ')}`}</dd></div>}
                    {model.timeouts && <div><dt>Timeouts kvar</dt><dd>{names.HOME} {model.timeouts.HOME} · {names.AWAY} {model.timeouts.AWAY}</dd></div>}
                </dl>
            </header>

            {acknowledgedMessage && <p className="mc-timeout-resume-banner" role="alert">{acknowledgedMessage}</p>}

            <section className="mc-timeout-section mc-huddle-directives">
                <Whiteboard />
                <header className="mc-timeout-section-head"><h3>Kontextuellt lagdirektiv</h3><span className="mc-timeout-section-hint">Utifrån ställning, halvlek och motståndarens försvar</span></header>
                {assistant ? (
                    <div className="mc-timeout-assistant-notice" role="status">
                        <strong>{assistant.name} leder laget från bänken</strong>
                        <p>{assistant.reason}</p>
                        <p>Assisterande tränaren samlar laget enligt matchplanen du förberedde.</p>
                    </div>
                ) : (
                    <div className="mc-timeout-instructions-list mc-huddle-cards">
                        {directives.map(inst => {
                            const isActive = activeInstructionId === inst.id;
                            return (
                                <button key={inst.id} type="button" className={`mc-timeout-instruction-btn mc-huddle-card${isActive ? ' is-active' : ''}${inst.isRecommended ? ' is-recommended' : ''}`} disabled={!onCommand} onClick={() => onCommand?.({ kind: 'TACTICS', team, patch: inst.patch })} aria-pressed={isActive}>
                                    <span className="mc-huddle-card-tags">{inst.isRecommended && <i className="mc-timeout-recommended-badge">Rekommenderat</i>}{isActive && <i className="mc-timeout-active-badge">Valt ✓</i>}</span>
                                    <strong>{inst.title}</strong>
                                    <small className="mc-huddle-changes">{directiveChanges(inst.patch)}</small>
                                    <dl>
                                        <div><dt>Effekt</dt><dd>{inst.intendedEffect}</dd></div>
                                        <div><dt>Risk</dt><dd>{inst.tradeoff}</dd></div>
                                        <div><dt>Gäller</dt><dd>{inst.durationCondition}</dd></div>
                                    </dl>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {!assistant && (tired.length > 0 || pendingExchange) && <p className="mc-huddle-subs-hint">
                {pendingExchange ? <>Byte pågår: #{person(pendingExchange.outId)?.number ?? '—'} → #{person(pendingExchange.inId)?.number ?? '—'}. </> : null}
                {tired.length > 0 && <>Tröttast på plan: {tired.map(p => `#${person(p.id)?.number ?? '—'} ${person(p.id)?.name ?? p.id} (${Math.round(p.condition.energy * 100)} %)`).join(', ')}. Byt i bänken.</>}
            </p>}

            <footer className="mc-timeout-footer mc-huddle-foot">
                <small>Direktiven ändrar lagets taktik direkt och gäller när domaren blåser igång spelet.</small>
                {onResumeTimeout && <button type="button" className="hm-btn hm-btn-primary mc-timeout-resume-action" onClick={handleResume}>Återgå till match</button>}
            </footer>
        </section>
    );
}
