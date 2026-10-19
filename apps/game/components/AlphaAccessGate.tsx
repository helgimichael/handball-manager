"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

const AUTHORIZED_KEY = "hm_alpha_authorized";
const CODE_KEY = "hm_alpha_access_code";
const ACCESS_CHANGED = "hm-alpha-access-changed";
const accessCode = process.env.NEXT_PUBLIC_ALPHA_ACCESS_CODE?.trim() || "HBL-ALPHA-2026";
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
  // Keep children unmounted until storage is checked, including on hydration.
  const access = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (normalize(code) !== normalize(accessCode)) {
      setError("Ogiltig testkod. Kontrollera koden och försök igen.");
      return;
    }
    try {
      localStorage.setItem(CODE_KEY, code.trim());
      localStorage.setItem(AUTHORIZED_KEY, "true");
      window.dispatchEvent(new Event(ACCESS_CHANGED));
    } catch {
      setError("Kunde inte spara åtkomsten. Tillåt lokal lagring i webbläsaren och försök igen.");
    }
  }

  if (access === "authorized") return children;
  return (
    <main className="alpha-gate">
      <section className="alpha-card" aria-labelledby="alpha-title">
        <p className="alpha-eyebrow">Tidig testversion</p>
        <h1 id="alpha-title">Handball Manager Alpha</h1>
        {access === "checking" ? <p role="status">Kontrollerar åtkomst…</p> : (
          <>
            <p>Välkommen till den tidiga alpha-testningen. Ange din accesskod för att starta.</p>
            <form onSubmit={unlock}>
              <label htmlFor="alpha-code">Accesskod</label>
              <input id="alpha-code" name="accessCode" type="text" autoComplete="off"
                autoCapitalize="characters" spellCheck={false} value={code}
                onChange={event => { setCode(event.target.value); setError(""); }}
                aria-invalid={Boolean(error)} aria-describedby={error ? "alpha-error" : undefined} />
              {error && <p id="alpha-error" className="alpha-error" role="alert">{error}</p>}
              <button className="alpha-primary" type="submit">Lås upp</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
