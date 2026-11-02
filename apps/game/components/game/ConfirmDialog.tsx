"use client";
// HM-PLAYTEST-01 1.2/8: one shared decision dialog. Native <dialog> so focus,
// Escape and the backdrop behave like every other modal in the game.
import { useEffect, useRef, type ReactNode } from "react";

export function ConfirmDialog({ title, eyebrow, children, confirmLabel, cancelLabel = "Avbryt", tone = "default", onConfirm, onCancel }: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className="hm-dialog" data-tone={tone} aria-labelledby="hm-dialog-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      {eyebrow && <span className="hm-eyebrow">{eyebrow}</span>}
      <h2 id="hm-dialog-title">{title}</h2>
      <div className="hm-dialog-body">{children}</div>
      <div className="hm-dialog-actions">
        <button type="button" className="hm-btn" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="hm-btn hm-btn-primary" autoFocus onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
