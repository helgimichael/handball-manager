"use client";

import { useEffect, useRef, useState } from "react";
import { exportSaveAsJson, getActiveSaveId } from "../lib/save/saveRepository";

function reportingUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function FeedbackModal({ onClose, contactUrl = process.env.NEXT_PUBLIC_ALPHA_FEEDBACK_URL }: {
  onClose: () => void;
  contactUrl?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const destination = reportingUrl(contactUrl);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  async function downloadSave() {
    setMessage("");
    setFailed(false);
    setBusy(true);
    try {
      const saveId = getActiveSaveId();
      if (!saveId) {
        setFailed(true);
        setMessage("Ingen aktiv karriär. Starta eller öppna en karriär och försök igen.");
        return;
      }
      await exportSaveAsJson(saveId);
      setMessage("Sparafilen har laddats ner. Bifoga den när du skickar din rapport.");
    } catch {
      setFailed(true);
      setMessage("Kunde inte ladda ner sparafilen. Kontrollera att karriären är sparad och att webbläsaren tillåter nedladdningar. Försök sedan igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="alpha-feedback-dialog alpha-card" aria-labelledby="feedback-title"
      aria-describedby="feedback-description" onCancel={onClose} onClose={onClose}>
      <h2 id="feedback-title">Rapportera feedback eller bugg</h2>
      <p id="feedback-description">Om du stött på ett fel eller ett oväntat matchresultat, ladda ner din sparfil via knappen nedan och skicka den tillsammans med en kort beskrivning av vad som hände.</p>
      <button className="alpha-primary" type="button" disabled={busy} onClick={() => void downloadSave()}>
        {busy ? "Laddar ner sparafil…" : "Ladda ner sparafil (.json)"}
      </button>
      {message && <p className={failed ? "alpha-error" : undefined} role={failed ? "alert" : "status"}>{message}</p>}
      {destination ? <p><a href={destination} target="_blank" rel="noopener noreferrer">Skicka feedback eller buggrapport</a></p>
        : <p>Skicka sparafilen och din beskrivning till den som bjöd in dig till alpha-testet.</p>}
      <button className="alpha-secondary" type="button" onClick={onClose}>Stäng</button>
    </dialog>
  );
}

export function AlphaFeedbackControl() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="alpha-feedback-trigger alpha-secondary" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Rapportera bugg / Feedback
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
