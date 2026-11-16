"use client";

// Arena 231 -- ENT-11 A "Help menu + context capture": the report lives in the ⋯ menu (career top bar), the
// title screen's menu line and F8 everywhere; the floating button remains only on screens without such a menu.
// The dialog pre-fills where the player is (route, game date, club, browser), can copy that context, and keeps
// the real save download and the external feedback link.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { exportSaveAsJson, getActiveSaveId } from "../lib/save/saveRepository";
import "./shell/shell-231.css";

export type FeedbackContext = { club?: string; gameDate?: string; season?: string };

// The career shell registers what it knows (club, game date); outside a career this stays empty.
let registeredContext: FeedbackContext | null = null;
export function registerFeedbackContext(context: FeedbackContext | null): void { registeredContext = context; }

function reportingUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function browserLabel(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const m = ua.match(/(Edg|Firefox|Chrome|Safari)\/(\d+)/);
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [m ? `${m[1] === "Edg" ? "Edge" : m[1]} ${m[2]}` : "", os].filter(Boolean).join(" · ");
}

export function FeedbackModal({ onClose, contactUrl = process.env.NEXT_PUBLIC_ALPHA_FEEDBACK_URL, context }: {
  onClose: () => void;
  contactUrl?: string;
  context?: FeedbackContext;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const destination = reportingUrl(contactUrl);
  const [ctx] = useState(() => context ?? registeredContext ?? {});
  const [browser] = useState(browserLabel);
  const chips = [
    { label: "Sida", value: pathname || "/" },
    ctx.club ? { label: "Klubb", value: ctx.club } : null,
    ctx.season ? { label: "Säsong", value: ctx.season } : null,
    ctx.gameDate ? { label: "Speldatum", value: ctx.gameDate } : null,
    browser ? { label: "Webbläsare", value: browser } : null,
  ].filter((c): c is { label: string; value: string } => !!c);

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

  async function copyContext() {
    const text = chips.map((c) => `${c.label}: ${c.value}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Uppgifterna är kopierade. Klistra in dem i din rapport.");
    } catch {
      setCopied("Webbläsaren tillät inte kopiering. Skriv av uppgifterna ovan i din rapport.");
    }
  }

  return (
    <dialog ref={dialog} className="alpha-feedback-dialog alpha-card" aria-labelledby="feedback-title"
      aria-describedby="feedback-description" onCancel={onClose} onClose={onClose}>
      <h2 id="feedback-title">Rapportera feedback eller bugg</h2>
      <p id="feedback-description">Om du stött på ett fel eller ett oväntat matchresultat, ladda ner din sparfil via knappen nedan och skicka den tillsammans med en kort beskrivning av vad som hände.</p>
      <section className="alpha-feedback-context" aria-label="Det här skickas med">
        <ul>{chips.map((c) => <li key={c.label}><small>{c.label}</small><span>{c.value}</span></li>)}</ul>
        <button className="alpha-secondary" type="button" onClick={() => void copyContext()}>Kopiera uppgifterna</button>
        {copied && <p className="alpha-feedback-copied">{copied}</p>}
      </section>
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

/** Screens with their own menu (title line, career ⋯ menu) carry the report there; elsewhere the corner button stays. */
function hasMenuEntry(pathname: string | null): boolean {
  return pathname === "/" || (!!pathname && pathname.startsWith("/career"));
}

export function AlphaFeedbackControl() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // ENT-11: F8 opens the report from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "F8" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {!hasMenuEntry(pathname) && <button className="alpha-feedback-trigger alpha-secondary" type="button" aria-haspopup="dialog" aria-keyshortcuts="F8" onClick={() => setOpen(true)}>
        Rapportera bugg / Feedback
      </button>}
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
