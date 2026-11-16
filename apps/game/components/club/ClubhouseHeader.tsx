'use client';
// Arena Nights -- Klubbhuset merged into the Club Journal (CLB-01 C) with its departments as hotspots that open a
// room Peek (CLB-01a A): one tap / Enter opens, arrow keys move between rooms, no double-click, no hover side
// effects. The header art is the club's facility tier (local -> pro -> elite) -- visible progression. "Visa som
// karta" expands it to full screen; on phones the pins give way to department chips. The old room-card gallery is
// retired (CLB-01b A): the hotspots and the Peek are the only way into a room from here.
import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ClubCrest from '@/components/ClubCrest';
import { HQ_BACKDROP } from '@/components/clubhq/ClubHq';
import { ENVIRONMENTS } from '@/components/clubhq/environments';
import { SideDrawer } from '@/components/players/SideDrawer';
import type { HqRoom } from '@/lib/clubhq/clubhq';
import type { ClubAlmanac } from '@/lib/club/clubAlmanac';
import { getClub } from '@/lib/game-data';

const TONE_LABEL: Record<HqRoom['alertTone'], string> = { ok: 'I fas', warn: 'Kräver uppmärksamhet', bad: 'Kritiskt', neutral: 'Status' };

export function ClubhouseHeader({ clubId, name, kicker, almanac, children }: { clubId: string; name: string; kicker: string[]; almanac: ClubAlmanac; children?: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [map, setMap] = useState(false);
  const pins = useRef<(HTMLButtonElement | null)[]>([]);
  const rooms = almanac.departments;
  const open = rooms.find((r) => r.id === openId) ?? null;
  const club = getClub(clubId);
  const attention = rooms.filter((r) => r.alertTone === 'bad' || r.alertTone === 'warn').length;

  useEffect(() => {
    if (!map) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !openId) setMap(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, openId]);

  // Arrow keys walk the rooms in reading order (top-left first), Enter/Space opens (native button).
  const order = [...rooms].map((r, i) => ({ i, x: r.zone.x + r.zone.w / 2, y: r.zone.y + r.zone.h / 2 })).sort((a, b) => a.y - b.y || a.x - b.x).map((o) => o.i);
  const onPinKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const at = order.indexOf(index);
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    pins.current[order[(at + step + order.length) % order.length]!]?.focus();
  };

  return (
    <>
      <header className="ch-header xp-photo-hero" data-tier={almanac.tier} data-map={map || undefined} style={HQ_BACKDROP[almanac.tier]} aria-label={`${name}: klubbhuset`}>
        <div className="ch-id">
          <ClubCrest shortName={club?.shortName ?? ''} primaryColor={club?.primaryColor ?? ''} clubId={clubId} size={72} />
          <div>
            <small className="ch-kicker">Din klubb · {almanac.tierLabel}</small>
            <h1>{name}</h1>
            {kicker.length > 0 && <p>{kicker.join(' · ')}</p>}
          </div>
        </div>
        <div className="ch-actions">
          {children}
          <button type="button" className="hm-btn hm-btn-sm ch-map-toggle" aria-pressed={map} onClick={() => setMap((m) => !m)}>{map ? 'Stäng kartan' : 'Visa som karta'}</button>
        </div>
        <div className="ch-pins" role="group" aria-label={`Klubbhusets avdelningar, ${attention} kräver uppmärksamhet. Piltangenter flyttar, Enter öppnar.`}>
          {rooms.map((r, i) => (
            <button key={r.id} ref={(el) => { pins.current[i] = el; }} type="button" className="ch-pin" data-tone={r.alertTone}
              style={{ left: `${r.zone.x + r.zone.w / 2}%`, top: `${r.zone.y + r.zone.h / 2}%` }}
              tabIndex={i === order[0] ? 0 : -1} onKeyDown={(e) => onPinKey(e, i)} onClick={() => setOpenId(r.id)}
              aria-label={`${r.name}: ${r.status ?? TONE_LABEL[r.alertTone]}`}>
              <i aria-hidden="true" /><span>{r.name}</span>
            </button>
          ))}
        </div>
        <p className="ch-legend" aria-hidden="true"><span data-tone="ok">I fas</span><span data-tone="warn">Kräver uppmärksamhet</span><span data-tone="bad">Kritiskt</span></p>
      </header>
      <nav className="ch-chips" aria-label="Avdelningar">
        {rooms.map((r) => (
          <button key={r.id} type="button" className="ch-chip" data-tone={r.alertTone} onClick={() => setOpenId(r.id)}>
            <i aria-hidden="true" /><b>{r.name}</b>{r.status && <small>{r.status}</small>}
          </button>
        ))}
      </nav>
      {open && <RoomPeek room={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function RoomPeek({ room, onClose }: { room: HqRoom; onClose: () => void }) {
  const env = ENVIRONMENTS[room.environment];
  return (
    <SideDrawer wide={false} label={room.name} onClose={onClose}
      title={<span className="ch-peek-title"><small>{room.zone.wing}</small><strong>{room.name}</strong></span>}
      actions={<>
        <Link className="hm-btn hm-btn-primary" href={room.href}>Öppna rummet →</Link>
        {room.secondaryHref && room.secondaryLabel && <Link className="hm-btn" href={room.secondaryHref}>{room.secondaryLabel}</Link>}
      </>}>
      <div className="ch-peek-photo" style={{ backgroundImage: `url(${env.narrowSrc})` }} role="img" aria-label={env.title}>
        <span data-tone={room.alertTone}>{room.status ?? TONE_LABEL[room.alertTone]}</span>
      </div>
      <p className="ch-peek-purpose">{room.purpose}</p>
      <p className="ch-peek-summary">{room.summary}</p>
      <dl className="ch-peek-metrics">
        {room.metrics.map((m) => <div key={m.label} data-tone={m.tone ?? 'neutral'}><dt>{m.label}</dt><dd>{m.value}</dd></div>)}
      </dl>
    </SideDrawer>
  );
}
