import type { ReactNode } from 'react';

export type CoachDefence = '6:0' | '5:1';
export type CoachTempo = 'SLOW' | 'BALANCED' | 'QUICK';
export const COACH_TEMPO_LABEL: Record<CoachTempo, string> = { SLOW: 'Lugnt', BALANCED: 'Balanserat', QUICK: 'Snabbt' };
export type CoachAttack = 'BALANCED' | 'COMBINATION' | 'WIDTH' | 'DIRECT';
export const COACH_ATTACK_LABEL: Record<CoachAttack, string> = { BALANCED: 'Balanserat', COMBINATION: 'Kombinationer', WIDTH: 'Bredd', DIRECT: 'Direkt' };
export type CoachAggression = 'LOW' | 'BALANCED' | 'HIGH';
export type CoachRotation = 'SHORT' | 'BALANCED' | 'WIDE';
export type CoachSevenVSix = 'OFF' | 'SITUATIONAL' | 'ALWAYS';
export const COACH_SEVEN_V_SIX_LABEL: Record<CoachSevenVSix, string> = { OFF: 'Av', SITUATIONAL: 'Situationellt', ALWAYS: 'Alltid' };
export const COACH_ROTATION_LABEL: Record<CoachRotation, string> = { SHORT: 'Kort', BALANCED: 'Balanserad', WIDE: 'Bred' };
export const COACH_AGGRESSION_LABEL: Record<CoachAggression, string> = { LOW: 'Låg', BALANCED: 'Balanserad', HIGH: 'Hög' };

function DefenceShape({ value }: { value: CoachDefence }) {
  return <svg viewBox="0 0 90 28" aria-hidden="true"><path d="M5 23H85" stroke="currentColor" strokeWidth="1" opacity=".35" />{Array.from({ length: value === '6:0' ? 6 : 5 }, (_, index) => <circle key={index} cx={12 + index * (value === '6:0' ? 13 : 16)} cy="19" r="3.4" fill="currentColor" />)}{value === '5:1' && <circle cx="44" cy="7" r="3.4" fill="currentColor" />}</svg>;
}

function ChoiceGroup<T extends string>({ title, value, options, onChange, disabled }: { title: string; value: T; options: readonly { value: T; label: string; graphic?: ReactNode }[]; onChange: (value: T) => void; disabled?: boolean }) {
  return <fieldset className="coach-choice-group" disabled={disabled}><legend>{title}</legend><div className="coach-choice-options">{options.map(option => <button key={option.value} type="button" aria-label={`${title} ${option.label}`} aria-pressed={option.value === value} data-active={option.value === value} onClick={() => { if (option.value !== value) onChange(option.value); }}>{option.graphic}<span>{option.label}</span>{option.value === value && <i aria-hidden="true">✓</i>}</button>)}</div></fieldset>;
}

/** The production-supported team instructions, shared by preparation and live coaching. */
export function CoachingChoices({ defence, aggression, tempo, attack, rotation, sevenVSix, onDefence, onAggression, onTempo, onAttack, onRotation, onSevenVSix, disabled }: { defence: CoachDefence; aggression: CoachAggression; tempo: CoachTempo; attack: CoachAttack; rotation: CoachRotation; sevenVSix: CoachSevenVSix; onDefence: (value: CoachDefence) => void; onAggression: (value: CoachAggression) => void; onTempo: (value: CoachTempo) => void; onAttack: (value: CoachAttack) => void; onRotation: (value: CoachRotation) => void; onSevenVSix: (value: CoachSevenVSix) => void; disabled?: boolean }) {
  return <div className="coach-tactic-choices"><ChoiceGroup title="Försvar" value={defence} onChange={onDefence} disabled={disabled} options={[{ value: '6:0', label: '6:0', graphic: <DefenceShape value="6:0" /> }, { value: '5:1', label: '5:1', graphic: <DefenceShape value="5:1" /> }]} /><ChoiceGroup title="Aggressivitet" value={aggression} onChange={onAggression} disabled={disabled} options={(Object.keys(COACH_AGGRESSION_LABEL) as CoachAggression[]).map(value => ({ value, label: COACH_AGGRESSION_LABEL[value] }))} /><ChoiceGroup title="Tempo" value={tempo} onChange={onTempo} disabled={disabled} options={(Object.keys(COACH_TEMPO_LABEL) as CoachTempo[]).map(value => ({ value, label: COACH_TEMPO_LABEL[value] }))} /><ChoiceGroup title="Anfall" value={attack} onChange={onAttack} disabled={disabled} options={(Object.keys(COACH_ATTACK_LABEL) as CoachAttack[]).map(value => ({ value, label: COACH_ATTACK_LABEL[value] }))} /><ChoiceGroup title="Rotation" value={rotation} onChange={onRotation} disabled={disabled} options={(Object.keys(COACH_ROTATION_LABEL) as CoachRotation[]).map(value => ({ value, label: COACH_ROTATION_LABEL[value] }))} /><ChoiceGroup title="7 mot 6" value={sevenVSix} onChange={onSevenVSix} disabled={disabled} options={(Object.keys(COACH_SEVEN_V_SIX_LABEL) as CoachSevenVSix[]).map(value => ({ value, label: COACH_SEVEN_V_SIX_LABEL[value] }))} /></div>;
}
