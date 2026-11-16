'use client';
// Arena Nights -- DSH-01c B "Season Curtain": a skippable floodlight sequence the first time the manager lands on
// Idag after the last match -- final position counts up, honours, the board's verdict, reputation, then the season
// card. Space / Enter / → / click advance, "Hoppa över" always visible, Escape closes. Reduced motion: no count-up,
// no auto-advance. Afterwards the dashboard shows the hand-off checklist (existing actions only).
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SeasonCurtain as Curtain } from '@/lib/career/frontPage';

const STAGE_MS = 1700;

/** Shows the curtain once per season and save (per-viewer convenience in localStorage); `replay` reopens it. */
export function useSeasonCurtain(key: string, active: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return;
    let seen = true;
    try { seen = !!window.localStorage.getItem(key); } catch { seen = true; }
    if (!seen) { const t = window.setTimeout(() => setOpen(true), 0); return () => window.clearTimeout(t); }
  }, [key, active]);
  const close = useCallback(() => { try { window.localStorage.setItem(key, '1'); } catch { /* storage unavailable: show again next time */ } setOpen(false); }, [key]);
  return { open, close, replay: () => setOpen(true) };
}

export function SeasonCurtain({ curtain, onClose }: { curtain: Curtain; onClose: () => void }) {
  const [stage, setStage] = useState(0);
  const [shown, setShown] = useState(curtain.teams || 0);
  const reduced = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const stages = 5;
  const advance = useCallback(() => setStage((s) => Math.min(stages - 1, s + 1)), []);
  useEffect(() => { reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; root.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { const tag = (e.target as HTMLElement)?.tagName; if (tag === 'A' || tag === 'BUTTON') return; e.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onClose]);
  useEffect(() => {
    if (reduced.current || stage >= stages - 1) return;
    const t = window.setTimeout(advance, STAGE_MS);
    return () => window.clearTimeout(t);
  }, [stage, advance]);
  // Final position counts up from last place.
  useEffect(() => {
    const target = curtain.position;
    if (target == null) return;
    if (reduced.current) { const t = window.setTimeout(() => setShown(target), 0); return () => window.clearTimeout(t); }
    const start = performance.now(), from = curtain.teams || target;
    let raf = 0;
    const tick = (now: number) => { const k = Math.min(1, (now - start) / 900); setShown(Math.round(from - (from - target) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [curtain.position, curtain.teams]);

  const rep = curtain.reputation;
  return <div ref={root} tabIndex={-1} className="hm-curtain" role="dialog" aria-modal="true" aria-label={`Säsongen ${curtain.seasonId} är slut`} onClick={(e) => { if ((e.target as HTMLElement).closest('a,button')) return; advance(); }}>
    <div className="hm-curtain-lights" aria-hidden="true" />
    <div className="hm-curtain-top"><span>{curtain.competition} · {curtain.seasonId}</span><button type="button" className="hm-btn hm-btn-sm" onClick={onClose}>Hoppa över</button></div>
    <div className="hm-curtain-stage" key={stage} aria-live="polite">
      {stage === 0 && <>
        <span className="hm-curtain-kicker">Slutplacering</span>
        <strong className="hm-curtain-big">{curtain.position != null ? shown : '—'}<small>{curtain.teams ? ` / ${curtain.teams}` : ''}</small></strong>
        {curtain.record && <p>{curtain.points} poäng · {curtain.record.won} vinster, {curtain.record.drawn} oavgjorda, {curtain.record.lost} förluster · {curtain.record.goalsFor}–{curtain.record.goalsAgainst}</p>}
        {curtain.zone && <span className="cz-zone hm-curtain-zone" data-tone={curtain.zone.tone}>{curtain.zone.label}</span>}
      </>}
      {stage === 1 && <>
        <span className="hm-curtain-kicker">Utmärkelser</span>
        {curtain.honours.length ? <ul className="hm-curtain-honours">{curtain.honours.map((h) => <li key={h} data-neg={h === 'Nedflyttning' || undefined}>{h}</li>)}</ul> : <strong className="hm-curtain-mid">Inga titlar i år</strong>}
        {curtain.topScorer ? <p>Lagets skyttekung: <Link href={`/career/squad/${encodeURIComponent(curtain.topScorer.id)}`}>{curtain.topScorer.name}</Link> · {curtain.topScorer.goals} mål på {curtain.topScorer.appearances} matcher</p> : <p>Ingen målskytt registrerad för laget.</p>}
      </>}
      {stage === 2 && <>
        <span className="hm-curtain-kicker">Styrelsens dom</span>
        {curtain.board ? <>
          <strong className="hm-curtain-stamp" data-tone={curtain.board.tone}>{curtain.board.verdict}</strong>
          <p>Förtroende {curtain.board.confidence}/100 · {curtain.board.met} av {curtain.board.total} mål uppfyllda{curtain.board.partly ? `, ${curtain.board.partly} delvis` : ''}{curtain.board.failed ? `, ${curtain.board.failed} missade` : ''}</p>
        </> : <strong className="hm-curtain-mid">Styrelsen har inte lämnat någon dom</strong>}
      </>}
      {stage === 3 && <>
        <span className="hm-curtain-kicker">Ditt rykte</span>
        {rep ? <><strong className="hm-curtain-big">{rep.value}<small> / 100</small></strong><p className="hm-curtain-delta" data-dir={rep.delta > 0 ? 'up' : rep.delta < 0 ? 'down' : undefined}>{rep.delta === 0 ? 'Oförändrat under säsongen' : `${rep.delta > 0 ? '▲ +' : '▼ '}${rep.delta} under säsongen`}</p></> : <strong className="hm-curtain-mid">Inget rykte registrerat</strong>}
      </>}
      {stage === 4 && <article className="hm-curtain-card">
        <span className="hm-curtain-kicker">Säsongskortet · {curtain.seasonId}</span>
        <dl>
          <div><dt>Placering</dt><dd>{curtain.position != null ? `${curtain.position}/${curtain.teams}` : '—'}</dd></div>
          <div><dt>Poäng</dt><dd>{curtain.points ?? '—'}</dd></div>
          <div><dt>Utmärkelser</dt><dd>{curtain.honours.join(', ') || '—'}</dd></div>
          <div><dt>Skyttekung</dt><dd>{curtain.topScorer ? `${curtain.topScorer.name} (${curtain.topScorer.goals})` : '—'}</dd></div>
          <div><dt>Styrelsen</dt><dd>{curtain.board?.verdict ?? '—'}</dd></div>
          <div><dt>Rykte</dt><dd>{rep ? `${rep.value}${rep.delta ? ` (${rep.delta > 0 ? '+' : ''}${rep.delta})` : ''}` : '—'}</dd></div>
        </dl>
        <p>Säsongen arkiveras i din managerkarriär när nästa säsong startar.</p>
        <div className="hm-actions"><button type="button" className="hm-btn hm-btn-primary" onClick={onClose}>Till checklistan →</button><Link className="hm-btn" href="/career/manager">Managerkarriären →</Link></div>
      </article>}
    </div>
    <ol className="hm-curtain-steps" aria-label="Steg">{Array.from({ length: stages }, (_, i) => <li key={i} data-done={i <= stage || undefined}><button type="button" onClick={() => setStage(i)} aria-label={`Steg ${i + 1} av ${stages}`} aria-current={i === stage ? 'step' : undefined} /></li>)}</ol>
    {stage < stages - 1 && <p className="hm-curtain-hint">Klicka eller tryck mellanslag för att gå vidare</p>}
  </div>;
}
