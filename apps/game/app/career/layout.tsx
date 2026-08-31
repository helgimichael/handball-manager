"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GameShell from "@/components/GameShell";
import { getActiveSave } from "@/lib/save/saveRepository";
import { CareerProvider } from "@/lib/career/CareerContext";

export default function CareerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Deliberate one-time client-only persistence read guarding
    // against SSR/hydration mismatch (this route can be reached via a
    // direct navigation, not just client-side push from the title
    // screen). useSyncExternalStore was tried first but saveRepository's
    // getSave()/getActiveSave() return a fresh object reference on every
    // call -- without a real cache layer that produces an infinite
    // update loop, which is worse than this rule's cascading-render
    // concern. A one-shot mount effect is the correct tool for "read
    // once on client mount, don't resubscribe".
    // HM-SAVE-STORAGE-1.0: getActiveSave() is now async (IndexedDB has
    // no synchronous API). A persistence failure must NOT be treated as
    // "no save" -- that would bounce the manager back to the title
    // screen as though their career had vanished.
    let cancelled = false;
    getActiveSave()
      .then((save) => {
        if (cancelled) return;
        if (!save) {
          router.replace("/");
          return;
        }
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Kunde inte läsa sparade karriärer.");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--hm-bg-app)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="hm-panel" style={{ maxWidth: 560 }}>
          <div className="hm-panel-body">
            <strong>Karriären kunde inte laddas</strong>
            <p className="hm-text-muted" style={{ marginTop: 8 }}>{error}</p>
            <button type="button" className="hm-btn" style={{ marginTop: 12 }} onClick={() => router.replace("/")}>
              ← Till huvudmenyn
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--hm-bg-app)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--hm-text-muted)" }}>
        Laddar karriär…
      </div>
    );
  }

  return (
    <CareerProvider>
      <GameShell>{children}</GameShell>
    </CareerProvider>
  );
}
