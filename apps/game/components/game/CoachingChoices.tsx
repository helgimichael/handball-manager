import type { ReactNode } from 'react';

export type CoachDefence = '6:0' | '5:1';
export type CoachTempo = 'BALANCED' | 'QUICK';
export type CoachAttack = 'BALANCED' | 'COMBINATION' | 'WIDTH' | 'DIRECT';
export const COACH_ATTACK_LABEL: Record<CoachAttack, string> = { BALANCED: 'Balanserat', COMBINATION: 'Kombinationer', WIDTH: 'Bredd', DIRECT: 'Direkt' };

function DefenceShape({ value }: { value: CoachDefence }) {
  return <svg viewBox="0 0 90 28" aria-hidden="true"><path d="M5 23H85" stroke="currentColor" strokeWidth="1" opacity=".35" />{Array.from({ length: value === '6:0' ? 6 : 5 }, (_, index) => <circle key={index} cx={12 + index * (value === '6:0' ? 13 : 16)} cy="19" r="3.4" fill="currentColor" />)}{value === '5:1' && <circle cx="44" cy="7" r="3.4" fill="currentColor" />}</svg>;
}

function ChoiceGroup<T extends string>({ title, value, options, onChange, disabled }: { title: string; value: T; options: readonly { value: T; label: string; graphic?: ReactNode }[]; onChange: (value: T) => void; disabled?: boolean }) {
  return <fieldset className="coach-choice-group" disabled={disabled}><legend>{title}</legend><div className="coach-choice-options">{options.map(option => <button key={option.value} type="button" aria-label={`${title} ${option.label}`} aria-pressed={option.value === value} data-active={option.value === value} onClick={() => { if (option.value !== value) onChange(option.value); }}>{option.graphic}<span>{option.label}</span>{option.value === value && <i aria-hidden="true">✓</i>}</button>)}</div></fieldset>;
}

/** These are the three production-supported team instructions, shared by preparation and live coaching. */
export function CoachingChoices({ defence, tempo, attack, onDefence, onTempo, onAttack, disabled }: { defence: CoachDefence; tempo: CoachTempo; attack: CoachAttack; onDefence: (value: CoachDefence) => void; onTempo: (value: CoachTempo) => void; onAttack: (value: CoachAttack) => void; disabled?: boolean }) {
  return <div className="coach-tactic-choices"><ChoiceGroup title="Försvar" value={defence} onChange={onDefence} disabled={disabled} options={[{ value: '6:0', label: '6:0', graphic: <DefenceShape value="6:0" /> }, { value: '5:1', label: '5:1', graphic: <DefenceShape value="5:1" /> }]} /><ChoiceGroup title="Tempo" value={tempo} onChange={onTempo} disabled={disabled} options={[{ value: 'BALANCED', label: 'Balanserat' }, { value: 'QUICK', label: 'Snabbt' }]} /><ChoiceGroup title="Anfall" value={attack} onChange={onAttack} disabled={disabled} options={(Object.keys(COACH_ATTACK_LABEL) as CoachAttack[]).map(value => ({ value, label: COACH_ATTACK_LABEL[value] }))} /></div>;
}
