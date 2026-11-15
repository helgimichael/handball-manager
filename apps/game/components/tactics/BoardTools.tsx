'use client';
// Arena Nights Phase 2 completion -- tactics board tools: TRN-02e overlay control + legend, TRN-02a guard bar
// with auto-fix preview, TRN-02i bench strip + "Ej uttagna" drawer, TRN-02d pairing lines on court.
// Every control calls an existing match-plan operation passed in by the page; nothing here changes plan semantics.
import { useRef, type DragEvent, type KeyboardEvent } from 'react';
import type { PlayerMock } from '@/lib/game-data';
import { OVERLAY_LEGEND, type LineupDiff, type OverlayMode, type StripSlot } from '@/lib/matchPlan/tacticsBoard';

// ---------------------------------------------------------------- TRN-02e
export function OverlayControl({ value, onChange }: { value: OverlayMode; onChange: (mode: OverlayMode) => void }) {
  const modes = Object.keys(OVERLAY_LEGEND) as OverlayMode[];
  const refs = useRef<Partial<Record<OverlayMode, HTMLButtonElement | null>>>({});
  const move = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = modes[(i + delta + modes.length) % modes.length]!;
    onChange(next);
    refs.current[next]?.focus();
  };
  const legend = OVERLAY_LEGEND[value];
  return <div className="tb-overlay">
    <span className="tb-overlay-label" id="tb-overlay-label">Taktikvisning</span>
    <div className="tb-segmented" role="radiogroup" aria-labelledby="tb-overlay-label">
      {modes.map((m, i) => <button key={m} ref={el => { refs.current[m] = el; }} type="button" role="radio" aria-checked={value === m} tabIndex={value === m ? 0 : -1} onClick={() => onChange(m)} onKeyDown={e => move(e, i)}>{OVERLAY_LEGEND[m].label}</button>)}
    </div>
    <div className="tb-legend" aria-label={`Förklaring: ${legend.label}`}>
      <small>{legend.caption}</small>
      <ul>{legend.entries.map(e => <li key={e.label} data-tone={e.tone}><i aria-hidden="true" />{e.label}</li>)}</ul>
    </div>
  </div>;
}

// ---------------------------------------------------------------- TRN-02a
export function GuardBar({ issues, preview, nameOf, onPreview, onApply, onCancel, undo, onUndo }: {
  issues: readonly string[];
  preview: LineupDiff | null;
  nameOf: (id: string) => string;
  onPreview: () => void; onApply: () => void; onCancel: () => void;
  undo: boolean; onUndo: () => void;
}) {
  if (!issues.length && !preview && !undo) return null;
  return <section className="tb-guard" data-state={preview ? 'preview' : issues.length ? 'warning' : 'applied'} aria-label="Matchplanens kontroll" role={issues.length && !preview ? 'alert' : 'status'}>
    {!preview && issues.length > 0 && <div className="tb-guard-row"><span className="tb-guard-icon" aria-hidden="true">!</span><p>{issues.join(' ')}</p><button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={onPreview}>Åtgärda – visa förslag</button></div>}
    {preview && <>
      <div className="tb-guard-row"><span className="tb-guard-icon" aria-hidden="true">↻</span><p><strong>Assistentens förslag</strong> · {preview.changes === 0 ? 'Inga ändringar jämfört med nuvarande uttagning.' : `${preview.changes} ändringar. Markerade platser byts.`}</p>
        <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={onApply}>Tillämpa förslaget</button>
        <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onCancel}>Avbryt</button></div>
      <ol className="tb-guard-slots">{preview.slots.map(s => <li key={s.position} data-changed={s.changed}><b>{s.label}</b>{s.changed && s.from ? <s>{nameOf(s.from)}</s> : null}<span>{s.to ? nameOf(s.to) : '—'}</span></li>)}</ol>
      {(preview.added.length > 0 || preview.removed.length > 0) && <p className="tb-guard-squad">{preview.added.length > 0 && <>Tas ut: {preview.added.map(nameOf).join(', ')}. </>}{preview.removed.length > 0 && <>Lämnar truppen: {preview.removed.map(nameOf).join(', ')}.</>}</p>}
    </>}
    {!preview && !issues.length && undo && <div className="tb-guard-row"><span className="tb-guard-icon" aria-hidden="true">✓</span><p>Förslaget är tillämpat.</p><button type="button" className="hm-btn hm-btn-sm" onClick={onUndo}>Ångra</button></div>}
  </section>;
}

// ---------------------------------------------------------------- TRN-02i
export function BenchStrip({ slots, registered, activeLabel, players, onPlace, onRemove, onDragStart, outside, onAdd, full }: {
  slots: StripSlot[]; registered: number; activeLabel: string;
  players: ReadonlyMap<string, PlayerMock>;
  onPlace: (playerId: string) => void; onRemove: (playerId: string) => void;
  onDragStart: (e: DragEvent<HTMLElement>, playerId: string) => void;
  outside: { player: PlayerMock; readiness: number; available: boolean }[]; onAdd: (playerId: string) => void; full: boolean;
}) {
  const name = (id?: string) => { const p = id ? players.get(id) : undefined; return p ? p.lastName : ''; };
  return <section className="tb-strip" aria-label="Matchtrupp på bänken">
    <header><h3>Matchtrupp</h3><span className="tb-strip-count" data-full={registered >= 16}>{registered}/16</span><small>Tryck på en bänkspelare för att placera honom på {activeLabel}, eller dra till planen.</small></header>
    <ol className="tb-strip-slots">
      {slots.map((s, i) => s.kind === 'EMPTY'
        ? <li key={`e${i}`} data-kind="EMPTY" aria-label="Tom plats"><span>—</span></li>
        : <li key={s.playerId} data-kind={s.kind} draggable onDragStart={e => onDragStart(e, s.playerId!)}>
            {s.kind === 'BENCH'
              ? <button type="button" onClick={() => onPlace(s.playerId!)} aria-label={`Placera ${name(s.playerId)} på ${activeLabel}`}><b>{players.get(s.playerId!)?.shirtNumber ?? '—'}</b><span>{name(s.playerId)}</span><small>{s.label}</small><i style={{ width: `${s.readiness ?? 0}%` }} data-low={(s.readiness ?? 0) < 70} /></button>
              : <span className="tb-strip-court"><b>{players.get(s.playerId!)?.shirtNumber ?? '—'}</b><span>{name(s.playerId)}</span><small>{s.label}</small><i style={{ width: `${s.readiness ?? 0}%` }} data-low={(s.readiness ?? 0) < 70} /></span>}
            {s.kind === 'BENCH' && <button type="button" className="tb-strip-remove" onClick={() => onRemove(s.playerId!)} aria-label={`Ta bort ${name(s.playerId)} ur matchtruppen`}>✕</button>}
          </li>)}
    </ol>
    <details className="tb-drawer">
      <summary>Ej uttagna · {outside.length} {outside.length === 1 ? 'spelare' : 'spelare'} <small>(piggast först)</small></summary>
      {outside.length === 0 ? <p className="coach-small-empty">Alla tillgängliga spelare är uttagna.</p> :
        <ul>{outside.map(o => <li key={o.player.id} data-available={o.available} draggable={o.available} onDragStart={e => onDragStart(e, o.player.id)}>
          <b>{o.player.shirtNumber ?? '—'}</b><span>{o.player.firstName} {o.player.lastName}</span><small>{o.player.position}</small>
          <i style={{ width: `${o.readiness}%` }} data-low={o.readiness < 70} aria-label={`Beredskap ${o.readiness} %`} role="img" />
          <button type="button" className="hm-btn hm-btn-xs" disabled={!o.available || full} onClick={() => onAdd(o.player.id)} title={!o.available ? 'Inte tillgänglig' : full ? 'Matchtruppen är full' : undefined}>Ta ut</button>
        </li>)}</ul>}
    </details>
  </section>;
}

// ---------------------------------------------------------------- TRN-02d
const ATTACK_SPOT: Record<string, number> = { V6: 10, V9: 26, M9: 50, H9: 74, H6: 90, M6: 50 };
/** Defence space 0-5 is numbered from the attacking team's right; drawn left-to-right as the defender faces the attack. */
const ZONE_X = (zone: number) => 92 - zone * 16.8;
export function PairingCourt({ attackers, pairs, zoneOf, zoneLabel, players, selectedAttacker, onSelectAttacker, bench, onPair, onRemove }: {
  attackers: { playerId: string; position: string }[];
  pairs: { attackPlayerId: string; defencePlayerId: string }[];
  zoneOf: (attackerId: string) => number | undefined;
  zoneLabel: (zone: number) => string;
  players: ReadonlyMap<string, PlayerMock>;
  selectedAttacker: string; onSelectAttacker: (id: string) => void;
  bench: PlayerMock[]; onPair: (attackerId: string, defenderId: string) => void; onRemove: (attackerId: string) => void;
}) {
  const last = (id: string) => players.get(id)?.lastName ?? id;
  return <figure className="tb-pairing" aria-label="Försvarsbyten på planen">
    <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="62" rx="2" className="tb-pairing-floor" />
      <line x1="2" y1="40" x2="98" y2="40" className="tb-pairing-6m" />
      {[0, 1, 2, 3, 4, 5].map(z => <g key={z}><circle cx={ZONE_X(z)} cy={50} r={1.2} className="tb-pairing-zone" /></g>)}
      {pairs.map(p => { const a = attackers.find(x => x.playerId === p.attackPlayerId); const z = zoneOf(p.attackPlayerId); if (!a || z === undefined) return null;
        return <line key={p.attackPlayerId} x1={ATTACK_SPOT[a.position] ?? 50} y1={a.position === 'M6' ? 30 : 16} x2={ZONE_X(z)} y2={50} className="tb-pairing-line" />; })}
    </svg>
    <ol className="tb-pairing-attack">{attackers.map(a => { const paired = pairs.some(p => p.attackPlayerId === a.playerId);
      return <li key={a.playerId} style={{ left: `${ATTACK_SPOT[a.position] ?? 50}%`, top: a.position === 'M6' ? '47%' : '25%' }}>
        <button type="button" aria-pressed={selectedAttacker === a.playerId} data-paired={paired} onClick={() => onSelectAttacker(selectedAttacker === a.playerId ? '' : a.playerId)} aria-label={`${last(a.playerId)} (${a.position})${paired ? ', byts i försvar' : ''}. Välj för att para med en försvarsspecialist`}>{a.position}<small>{last(a.playerId)}</small></button>
      </li>; })}</ol>
    <ol className="tb-pairing-zones" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(z => <li key={z} style={{ left: `${ZONE_X(z)}%` }}>{zoneLabel(z).split(' ')[0]}</li>)}</ol>
    <ol className="tb-pairing-defence">{pairs.map(p => { const z = zoneOf(p.attackPlayerId); if (z === undefined) return null;
      return <li key={p.defencePlayerId} style={{ left: `${ZONE_X(z)}%` }}><button type="button" onClick={() => onRemove(p.attackPlayerId)} aria-label={`Ta bort bytet ${last(p.attackPlayerId)} ↔ ${last(p.defencePlayerId)}`} title={`${zoneLabel(z)} – tryck för att ta bort bytet`}>{last(p.defencePlayerId)}<small>✕</small></button></li>; })}</ol>
    <figcaption>
      <strong>{pairs.length} par</strong> <span>(riktmärke 3)</span> · {selectedAttacker ? <>Välj försvarsspecialist för <b>{last(selectedAttacker)}</b>:</> : 'Tryck på en anfallare och sedan på en bänkspelare för att para dem. Tryck på en linje-etikett för att ta bort bytet.'}
      {selectedAttacker && <span className="tb-pairing-bench">{bench.length ? bench.map(b => <button key={b.id} type="button" className="hm-btn hm-btn-xs" onClick={() => { onPair(selectedAttacker, b.id); onSelectAttacker(''); }}>{b.lastName} · {b.position}</button>) : <em>Inga uttagna utespelare på bänken.</em>}</span>}
    </figcaption>
  </figure>;
}
