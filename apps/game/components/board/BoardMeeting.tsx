'use client';
// Arena Nights -- CLB-05b B "Meeting Moment": a board warning or contract offer is a meeting. The board's
// statement, your answers as option cards with their consequences, a confirmation, then the minute is written and
// a result line links to the protocol. Centered 720 px on desktop, a full-screen sheet on phones. Only for board
// meetings (no modal fatigue elsewhere). CLB-05a B "Verdict Moment": on the day of a verdict, the stamp slams
// once with the factors and the confidence change, then the page shows it as a band.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { DecisionOption, MinuteEntry, OpenDecision } from '@/lib/club/boardMinutes';
import type { ConfidenceFactor } from '@/lib/board/types';
import { BOARDROOM_BACKDROP } from './boardVisuals';

const FLAG_EVENT = 'hm-board-session-flag';
const subscribe = (cb: () => void) => { window.addEventListener(FLAG_EVENT, cb); return () => window.removeEventListener(FLAG_EVENT, cb); };
/** "Seen this session" for a meeting or verdict -- sessionStorage, read without a render-time mismatch (the server counts it as seen). */
export function useSessionFlag(key: string | null): [boolean, () => void] {
  const seen = useSyncExternalStore(subscribe, () => { if (!key) return true; try { return sessionStorage.getItem(key) === '1'; } catch { return true; } }, () => true);
  const mark = useCallback(() => { if (!key) return; try { sessionStorage.setItem(key, '1'); } catch { /* private mode: the moment simply shows again */ } window.dispatchEvent(new Event(FLAG_EVENT)); }, [key]);
  return [seen, mark];
}

function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')];
        if (!items.length) return;
        const first = items[0]!, last = items.at(-1)!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [onClose]);
  return ref;
}

export function BoardMeetingModal({ decision, statement, options, onChoose, onClose }: {
  decision: OpenDecision;
  statement: ReactNode;
  options: DecisionOption[];
  /** Runs the chosen answer; returns the result line, or throws with the reason it could not be done. */
  onChoose: (id: DecisionOption['id']) => string | null;
  onClose: (result?: string) => void;
}) {
  const [picked, setPicked] = useState<DecisionOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => onClose();
  const ref = useDialog(close);
  const title = decision.kind === 'RECOVERY' ? (decision.finalWarning ? 'Styrelsemöte: sista varningen' : 'Styrelsemöte: varning') : 'Styrelsemöte: nytt avtal';
  const confirm = () => {
    if (!picked) return;
    try { const result = onChoose(picked.id); onClose(result ?? undefined); }
    catch (e) { setError(e instanceof Error ? e.message : 'Det gick inte.'); }
  };
  return (
    <div className="bm-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={ref} className="bm-meeting" role="dialog" aria-modal="true" aria-labelledby="bm-meeting-h" data-kind={decision.kind}>
        <header>
          <small>Styrelserummet</small>
          <h2 id="bm-meeting-h">{title}</h2>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost bm-x" onClick={close} aria-label="Stäng mötet">✕</button>
        </header>
        <div className="bm-statement">{statement}</div>
        {!picked ? (
          <div className="bm-options" role="group" aria-label="Ditt svar">
            {options.map((o) => (
              <button key={o.id} type="button" className="bm-option" data-primary={o.primary || undefined} onClick={() => { setError(null); if (o.id === 'LATER') close(); else setPicked(o); }}>
                <strong>{o.label}</strong>
                <ul>{o.consequences.map((c) => <li key={c}>{c}</li>)}</ul>
              </button>
            ))}
          </div>
        ) : (
          <div className="bm-confirm">
            <p>Du svarar: <b>{picked.label}</b></p>
            <ul>{picked.consequences.map((c) => <li key={c}>{c}</li>)}</ul>
            {error && <p className="bm-error" role="alert">{error}</p>}
            <div className="bm-confirm-actions">
              <button type="button" className="hm-btn hm-btn-primary" onClick={confirm}>Bekräfta: {picked.label}</button>
              <button type="button" className="hm-btn" onClick={() => setPicked(null)}>Tillbaka</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VerdictMoment({ entry, factors, onClose }: { entry: MinuteEntry; factors: ConfidenceFactor[]; onClose: (toMinutes: boolean) => void }) {
  const ref = useDialog(() => onClose(false));
  return (
    <div className="bm-scrim bm-scrim-verdict" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div ref={ref} className="bm-verdict xp-photo-hero" style={BOARDROOM_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="bm-verdict-h" data-tone={entry.tone}>
        <span className="bm-stamp" data-tone={entry.tone}>{entry.verdictLabel}</span>
        <small>{entry.kindLabel} · {entry.date}</small>
        <h2 id="bm-verdict-h">{entry.title}</h2>
        <p>{entry.summary}</p>
        {entry.confidenceAt !== null && <p className="bm-delta">Förtroende {entry.confidenceAt}{entry.confidenceDelta !== null && entry.confidenceDelta !== 0 ? ` (${entry.confidenceDelta > 0 ? '+' : '−'}${Math.abs(entry.confidenceDelta)} sedan förra mötet)` : ''}</p>}
        {factors.length > 0 && <ul className="bm-factors">{factors.map((f) => <li key={f.label} data-sign={f.points >= 0 ? 'plus' : 'minus'}><span>{f.label}</span><b>{f.points > 0 ? `+${f.points}` : f.points}</b></li>)}</ul>}
        <div className="bm-verdict-actions">
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => onClose(true)}>Till protokollet</button>
          <button type="button" className="hm-btn" onClick={() => onClose(false)}>Hoppa över</button>
        </div>
      </div>
    </div>
  );
}
