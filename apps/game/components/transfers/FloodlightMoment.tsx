"use client";
// Arena Nights 231 -- the short floodlight moment shared by the signing (REC-04e A) and the farewell
// (REC-05a A). Shown once per deal per browser session, then the page underneath carries the full record.
// Skippable at any time (Esc, the close button or the backdrop); the follow-up actions fade in after the
// beat (~1.6 s, instantly with reduced motion). Desktop: centred overlay; phones: full screen.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const seenKey = (id: string) => `hm-tx-moment:${id}`;

/** True until the moment for `id` has been shown in this browser session. Storage failures simply skip the moment. */
export function useMomentOnce(id: string): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = true;
    try { seen = window.sessionStorage.getItem(seenKey(id)) === "1"; } catch { seen = true; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: decide once per deal whether to play the moment.
    if (!seen) setOpen(true);
  }, [id]);
  const close = useCallback(() => {
    setOpen(false);
    try { window.sessionStorage.setItem(seenKey(id), "1"); } catch { /* convenience only */ }
  }, [id]);
  return [open, close];
}

export function FloodlightMoment({ label, tone, eyebrow, headline, lede, terms, media, actions, onClose }: {
  label: string;
  tone: "signed" | "farewell" | "scheduled";
  eyebrow: ReactNode;
  headline: ReactNode;
  lede?: ReactNode;
  terms: { label: string; value: ReactNode }[];
  media?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  const skip = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    skip.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); back?.focus?.(); };
  }, [onClose]);
  return (
    <div className="tx-moment-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="tx-moment" data-tone={tone} role="dialog" aria-modal="true" aria-label={label}>
        <button ref={skip} type="button" className="tx-moment-skip" onClick={onClose}>Hoppa över <kbd>Esc</kbd></button>
        <div className="tx-moment-light" aria-hidden="true" />
        {media && <div className="tx-moment-media">{media}</div>}
        <div className="tx-moment-eyebrow">{eyebrow}</div>
        <h2 className="tx-moment-headline">{headline}</h2>
        {lede && <p className="tx-moment-lede">{lede}</p>}
        <dl className="tx-moment-terms">{terms.map((t) => <div key={t.label}><dt>{t.label}</dt><dd>{t.value}</dd></div>)}</dl>
        <div className="tx-moment-actions">{actions}</div>
      </section>
    </div>
  );
}
