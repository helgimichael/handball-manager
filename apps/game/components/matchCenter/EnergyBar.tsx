import type { CSSProperties } from 'react';
import { clampEnergy, energyTone } from './liveFlow';

/** Energy as a bar with the number kept as visible text (MDY-02g/i/e "Energy bar component"). */
export function EnergyBar({ energy, label }: { energy: number | null | undefined; label?: string }) {
    const value = clampEnergy(energy), tone = energyTone(energy);
    return <span className="mc-energy" data-tone={tone} title={label ?? (tone === 'unknown' ? 'Energi saknas' : `${value} % energi`)}><i style={{ '--mc-energy': `${value}%` } as CSSProperties} aria-hidden="true" /><b>{tone === 'unknown' ? '—' : `${value}%`}</b></span>;
}
