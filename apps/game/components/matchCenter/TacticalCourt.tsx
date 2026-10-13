'use client';
import { useId } from 'react';
import type { TacticalSnapshot, PlayerRow, ShotFact } from '@/lib/matchCenter/model';
import type { ActorRole } from '@/lib/matchCenter/workspace';
import { ROLE_LABEL, SHOT_LABEL } from '@/lib/matchCenter/model';
function Lines() { return <g transform="matrix(0 1 -1 0 40 0)" fill="none" stroke="currentColor" strokeWidth=".065"><rect width="20" height="40"/><path d="M0 20H20 M8.5 0V-.7H11.5V0 M8.5 40V40.7H11.5V40 M9 7H11 M9 33H11"/><path d="M2.5 0A6 6 0 0 0 8.5 6H11.5A6 6 0 0 0 17.5 0 M2.5 40A6 6 0 0 1 8.5 34H11.5A6 6 0 0 1 17.5 40"/><path strokeDasharray=".2 .18" d="M0 0A10 9 0 0 0 20 0 M0 40A10 9 0 0 1 20 40"/></g>; }
export function TacticalCourt({ snapshot, fullCourt = false, focusY = snapshot.ball.y, actors = {} }: {
    snapshot: TacticalSnapshot;
    fullCourt?: boolean;
    focusY?: number;
    actors?: Record<string, ActorRole>;
}) {
    const arrowId = useId().replaceAll(':', '');
    return <figure className="mc-tactical"><svg viewBox={fullCourt ? '-1 -1 42 22' : focusY < 20 ? '19 -1 22 22' : '-1 -1 22 22'} role="img" aria-label={`${snapshot.label}, ${Math.floor(snapshot.timestamp / 60000)} minuter. ${fullCourt ? 'Helplan' : 'Närbild'}. Sparade spelarpositioner. Gul markering visar bollen.`}><defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs><Lines />{snapshot.arrows.map((a, i) => <line key={i} x1={40 - a.from.y} y1={a.from.x} x2={40 - a.to.y} y2={a.to.x} className="mc-action-arrow" strokeWidth=".13" strokeDasharray={a.kind === 'PASS' ? '.3 .2' : undefined} markerEnd={`url(#${arrowId})`}/>)}{snapshot.players.map(({ person, position }) => <g key={person.id} transform={`translate(${40 - position.y} ${position.x})`} className="mc-marker" data-team={person.team} data-involved={(snapshot.involvedIds.includes(person.id) || !!actors[person.id])} data-role={actors[person.id]}><circle r={(snapshot.involvedIds.includes(person.id) || !!actors[person.id]) ? '.65' : '.48'}/><text textAnchor="middle" dominantBaseline="central" fontSize=".68">{person.number}</text><title>{person.name} · {ROLE_LABEL[person.role]} · {person.team === 'HOME' ? 'Hemma' : 'Borta'}</title></g>)}<circle className="mc-ball" cx={40 - snapshot.ball.y} cy={snapshot.ball.x} r=".2"/></svg><figcaption><span>● Hemma · ○ Borta · <b>Boll</b></span><span>{snapshot.label} · exakt sparad bild</span></figcaption><div className="mc-involved">{snapshot.players.filter(p => (snapshot.involvedIds.includes(p.person.id) || !!actors[p.person.id])).map(p => <span key={p.person.id}><b>{actors[p.person.id] ?? 'Berörd spelare'}</b> #{p.person.number} {p.person.name}</span>)}</div></figure>;
}
/** Role schematic, explicitly separate from recorded physical poses. */
export function StructureCourt({ players, defence, defensivePosts }: {
    players: PlayerRow[];
    defence: string;
    defensivePosts?: Record<string, readonly [
        number,
        number
    ]>;
}) {
    const anchors: Record<string, readonly [
        number,
        number
    ]> = { LW: [7, 1.5], LB: [11, 5], CB: [12, 10], RB: [11, 15], RW: [7, 18.5], P: [7, 10], P2: [7, 12], GK: [1.4, 10] };
    return <div className="mc-structure"><header><strong>Ditt lag på plan</strong><span>{defensivePosts ? `Försvar ${defence}` : 'Anfallsroller'} · schematisk struktur</span></header><svg viewBox="0 0 17 20" role="img" aria-label={`Statisk rollfördelning för ditt lag. ${defensivePosts ? `Försvar ${defence}` : 'Anfallsroller'}. Schematisk vy, inte fysiska spelarpositioner.`}><path d="M0 .5H17V19.5H0 M0 4A6 6 0 0 1 6 10A6 6 0 0 1 0 16" fill="none" stroke="currentColor" strokeWidth=".06"/>{players.filter(p => p.population === 'COURT').map(p => { const [x, y] = defensivePosts?.[p.id] ?? anchors[p.role]; return <g key={p.id} transform={`translate(${x} ${y})`}><circle r=".75"/><text textAnchor="middle" dominantBaseline="central" fontSize=".55">{p.position}</text><text textAnchor="middle" y="1.4" fontSize=".6">{p.name.split(' ').at(-1)}</text><title>{p.name} · {p.position}</title></g>; })}</svg></div>;
}
export function ShotMap({ shots }: {
    shots: ShotFact[];
}) { return <svg className="mc-shot-map" viewBox="-1 -1 42 22" role="img" aria-label="Skottkarta med registrerade avslutspositioner. G: mål, R: räddning, X: utan mål, B: block, punkt: pågående."><Lines />{shots.filter(s => s.origin).map(s => <g key={s.eventId} transform={`translate(${40 - s.origin!.y} ${s.origin!.x})`} data-outcome={s.outcome}><circle r=".42"/><text fontSize=".5" dominantBaseline="central" textAnchor="middle">{{ GOAL: 'G', SAVE: 'R', BLOCK: 'B', MISS: 'X', PENDING: '·' }[s.outcome]}</text><title>{{ GOAL: 'Mål', SAVE: 'Räddning', BLOCK: 'Block', MISS: 'Utan mål', PENDING: 'Pågående' }[s.outcome]} · {SHOT_LABEL[s.kind] ?? 'Övriga avslut'}</title></g>)}</svg>; }
