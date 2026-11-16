"use client";

// Arena 231 -- ENT-01 A "Ticket at the turnstile": the gate is the first frame of the title screen -- the dimmed
// arena backdrop and wordmark, with a small ticket stub (code field, Lås upp, where codes come from) that tears
// away on success (crossfade under reduced motion). Same check, storage keys and messages as before; a public
// build can skip the gate entirely with NEXT_PUBLIC_ALPHA_GATE=off. Also applies the device's display preferences
// (ENT-05 Visning) once, since this wrapper is mounted on every route.
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { COURT_MOMENT_BACKDROP } from "./experience/experienceAssets";
import { applyStoredDisplayPreferences } from "./settings/displayPreferences";
import "./settings/motion.css";
import "./entry/alpha-gate.css";

const AUTHORIZED_KEY = "hm_alpha_authorized";
const CODE_KEY = "hm_alpha_access_code";
const ACCESS_CHANGED = "hm-alpha-access-changed";
const accessCode = process.env.NEXT_PUBLIC_ALPHA_ACCESS_CODE?.trim() || "HBL-ALPHA-2026";
const gateDisabled = process.env.NEXT_PUBLIC_ALPHA_GATE?.trim().toLowerCase() === "off";
const normalize = (code: string) => code.trim().toUpperCase();
const serverSnapshot = () => "checking" as const;

function getSnapshot() {
  try {
    return localStorage.getItem(AUTHORIZED_KEY) === "true"
      && normalize(localStorage.getItem(CODE_KEY) ?? "") === normalize(accessCode)
      ? "authorized" : "locked";
  } catch {
    return "locked";
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(ACCESS_CHANGED, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(ACCESS_CHANGED, listener);
  };
}

export function AlphaAccessGate({ children }: { children: ReactNode }) {
  useEffect(() => { applyStoredDisplayPreferences(); }, []);
  // Keep children unmounted until storage is checked, including on hydration.
  const access = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tearing, setTearing] = useState(false);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (normalize(code) !== normalize(accessCode)) {
      setError("Ogiltig testkod. Kontrollera koden och försök igen.");
      return;
    }
    try {
      localStorage.setItem(CODE_KEY, code.trim());
      localStorage.setItem(AUTHORIZED_KEY, "true");
    } catch {
      setError("Kunde inte spara åtkomsten. Tillåt lokal lagring i webbläsaren och försök igen.");
      return;
    }
    // The stub tears (200 ms) before the title screen takes over; no reload.
    setTearing(true);
    const reduced = document.documentElement.dataset.motion === "reduced" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => window.dispatchEvent(new Event(ACCESS_CHANGED)), reduced ? 0 : 200);
  }

  if (gateDisabled || access === "authorized") return children;
  return (
    <main className="alpha-gate ce-turnstile" style={COURT_MOMENT_BACKDROP as CSSProperties}>
      <div className="ce-turnstile-mark" aria-hidden="true"><span>HM</span><strong>Handball Manager</strong></div>
      <section className="alpha-card ce-ticket" data-tearing={tearing} aria-labelledby="alpha-title">
        <div className="ce-ticket-stub" aria-hidden="true"><span>Alpha</span><span>2026/27</span></div>
        <div className="ce-ticket-body">
          <p className="alpha-eyebrow">Tidig testversion · ange testkod</p>
          <h1 id="alpha-title">Handball Manager Alpha</h1>
          {access === "checking" ? <p role="status">Kontrollerar åtkomst…</p> : (
            <>
              <p>Spelet är i sluten alpha-testning. Koden får du av den som bjöd in dig till testet.</p>
              <form onSubmit={unlock}>
                <label htmlFor="alpha-code">Accesskod</label>
                <input id="alpha-code" name="accessCode" type="text" autoComplete="off" autoFocus
                  autoCapitalize="characters" spellCheck={false} value={code}
                  onChange={event => { setCode(event.target.value); setError(""); }}
                  aria-invalid={Boolean(error)} aria-describedby={error ? "alpha-error" : undefined} />
                {error && <p id="alpha-error" className="alpha-error" role="alert">{error}</p>}
                <button className="alpha-primary" type="submit" disabled={tearing}>Lås upp</button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
