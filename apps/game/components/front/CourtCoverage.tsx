'use client';
// Arena Nights -- DSH-01e B "Court Coverage": the seven positions on a half court, each with one dot per natural
// player (spelklar / tveksam / borta). Thin spots glow. Tapping a position opens a Peek list of its players with
// energy and match fitness, and who can cover. Pure view over courtCoverage() -- no new data.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CoverageSpot } from '@/lib/career/frontPage';

// Half court, attacking the goal at the top (20 m wide = 300 units). The keeper is drawn at our own end.
const SPOT: Record<string, [number, number]> = { V6: [9, 13], H6: [91, 13], M6: [50, 44], V9: [22, 60], M9: [50, 70], H9: [78, 60], MV: [50, 92] };
const STATE_LABEL = { OK: 'Spelklar', DOUBT: 'Tveksam', OUT: 'Borta' } as const;

export function CourtCoverage({ spots, captain }: { spots: readonly CoverageSpot[]; captain?: string }) {
  const [open, setOpen] = useState<CoverageSpot | null>(null);
  const thin = spots.filter(s => s.tone !== 'good').sort((a, b) => (a.tone === 'bad' ? 0 : 1) - (b.tone === 'bad' ? 0 : 1));
  const fit = spots.reduce((n, s) => n + s.fit, 0), total = spots.reduce((n, s) => n + s.players.length, 0);
  return <section id="hm-court" className="hm-court-card" aria-labelledby="hm-court-h">
    <div className="game-section-heading"><h2 id="hm-court-h">Laget inför avkast</h2><Link href="/career/squad">Hela truppen →</Link></div>
    <p className="hm-court-sum"><strong>{fit}</strong><span>/{total} spelklara</span>{captain && <small> · Kapten: {captain}</small>}</p>
    <div className="hm-court" role="group" aria-label="Positionstäckning på planen">
      <svg viewBox="0 0 300 260" aria-hidden="true" preserveAspectRatio="none">
        <rect x="1" y="1" width="298" height="258" className="hm-court-line" />
        <rect x="127.5" y="0" width="45" height="6" className="hm-court-goal" />
        <path d="M37.5 0 A90 90 0 0 0 127.5 90 L172.5 90 A90 90 0 0 0 262.5 0" className="hm-court-line" />
        <path d="M0 44.4 A135 135 0 0 0 127.5 135 L172.5 135 A135 135 0 0 0 300 44.4" className="hm-court-line" data-dashed="true" />
        <line x1="142" y1="105" x2="158" y2="105" className="hm-court-line" />
      </svg>
      {spots.map(s => <button key={s.position} type="button" className="hm-court-spot" data-tone={s.tone} style={{ left: `${SPOT[s.position]![0]}%`, top: `${SPOT[s.position]![1]}%` }} onClick={() => setOpen(s)} aria-label={`${s.name}: ${s.fit} spelklara, ${s.selectable - s.fit} tveksamma, ${s.players.length - s.selectable} borta. Visa spelarna.`}>
        <b>{s.position}</b>
        <span className="hm-court-dots" aria-hidden="true">{s.players.length ? s.players.map(p => <i key={p.id} data-state={p.state} />) : <i data-state="NONE" />}</span>
      </button>)}
    </div>
    <ul className="hm-court-legend" aria-label="Teckenförklaring"><li data-state="OK">Spelklar</li><li data-state="DOUBT">Tveksam · låg energi, matchträning eller begränsad</li><li data-state="OUT">Borta · skada, avstängning</li></ul>
    <div className="hm-court-thin">
      <h3>Tunna positioner</h3>
      {thin.length ? <ul>{thin.slice(0, 4).map(s => <li key={s.position} data-tone={s.tone}><button type="button" onClick={() => setOpen(s)}><b>{s.position}</b><span>{s.selectable === 0 ? 'Ingen spelbar' : `${s.fit} spelklar${s.fit === 1 ? '' : 'a'}${s.selectable > s.fit ? ` · ${s.selectable - s.fit} tveksam` : ''}`}{s.cover.length ? ` · täcks av ${s.cover.slice(0, 2).map(c => c.name.split(' ').at(-1)).join(', ')}` : ' · ingen täckning'}</span></button></li>)}</ul> : <p className="hm-court-ok">Alla positioner har minst två spelklara.</p>}
      <Link className="hm-btn" href="/career/tactics">Välj startsju →</Link>
    </div>
    {open && <PositionPeek spot={open} onClose={() => setOpen(null)} />}
  </section>;
}

function PositionPeek({ spot, onClose }: { spot: CoverageSpot; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [onClose]);
  return <div className="hm-peek-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="hm-peek hm-court-peek" role="dialog" aria-modal="true" aria-label={`${spot.name}: spelarna`}>
      <header><span><strong>{spot.position} · {spot.name}</strong><small>{spot.fit} spelklara av {spot.players.length}</small></span><button ref={close} type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose} aria-label="Stäng">✕</button></header>
      {spot.players.length ? <ul className="hm-court-list">{spot.players.map(p => <li key={p.id} data-state={p.state}><i aria-hidden="true" /><span><Link href={`/career/squad/${encodeURIComponent(p.id)}`}>{p.shirt != null ? `${p.shirt} · ` : ''}{p.name}</Link><small>{STATE_LABEL[p.state]} · {p.detail}</small></span></li>)}</ul> : <p className="hm-peek-alert">Ingen spelare har {spot.name.toLowerCase()} som huvudposition.</p>}
      <div><span className="hm-court-label">Kan täcka</span>{spot.cover.length ? <ul className="hm-court-list">{spot.cover.map(c => <li key={c.id} data-state="COVER"><i aria-hidden="true" /><span><Link href={`/career/squad/${encodeURIComponent(c.id)}`}>{c.name}</Link><small>Ordinarie {c.position}</small></span></li>)}</ul> : <p className="hm-court-ok">Ingen tillgänglig spelare har positionen som andraval.</p>}</div>
      <div className="hm-peek-actions"><Link className="hm-btn hm-btn-primary" href="/career/tactics">Välj startsju →</Link><Link className="hm-btn" href="/career/medical">Medicinskt →</Link><Link className="hm-btn" href="/career/squad">Truppen →</Link></div>
    </aside>
  </div>;
}
