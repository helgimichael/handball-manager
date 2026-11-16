'use client';
// Arena Nights -- shared right drawer (desktop) / bottom sheet (phone) for the squad & players surfaces
// (SQD-01d renewal drawer, SQD-05a contract decision drawer, SQD-03a market Peek). Escape, the scrim and
// the close button dismiss it; focus moves into the drawer and returns to the opener on close.
// Styling reuses the Peek drawer (.hm-peek in components/shell/matrix.css) with a 480 px width variant.
import { useEffect, useRef, type ReactNode } from 'react';

export function SideDrawer({ title, label, onClose, children, actions, nav, wide = true }: {
  /** Header content; when a string it is also the dialog's accessible name. */
  title: ReactNode;
  /** Accessible name when the title is not a plain string. */
  label?: string;
  onClose: () => void;
  children: ReactNode;
  /** Footer actions (links/buttons). */
  actions?: ReactNode;
  /** Optional previous/next controls rendered in the header. */
  nav?: ReactNode;
  wide?: boolean;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [onClose]);
  return <div className="hm-peek-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="hm-peek hm-drawer" data-wide={wide} role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : 'Detaljer')}>
      <header className="hm-drawer-head">
        <div className="hm-drawer-title">{title}</div>
        <div className="hm-drawer-nav">{nav}<button ref={close} type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose} aria-label="Stäng">✕</button></div>
      </header>
      <div className="hm-drawer-body">{children}</div>
      {actions && <footer className="hm-peek-actions hm-drawer-actions">{actions}</footer>}
    </aside>
  </div>;
}
