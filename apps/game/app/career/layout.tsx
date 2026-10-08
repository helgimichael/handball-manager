"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GameShell from "@/components/GameShell";
import { getActiveSave } from "@/lib/save/saveRepository";
import { CareerProvider } from "@/lib/career/CareerContext";
import '@/components/game/game-feedback.css';
import { WorkspaceMemory } from '@/components/game/WorkspaceMemory';

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
    getActiveSave(false)
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
      <main className="game-career-gate"><section role="alert"><span className="game-overline">Handball Manager</span><h1>Karriären kunde inte laddas</h1><p>{error}</p><div className="hm-actions"><button className="hm-btn hm-btn-primary" onClick={() => window.location.reload()}>Försök igen</button><button className="hm-btn" onClick={() => router.replace('/')}>← Till huvudmenyn</button></div></section></main>
    );
  }

  if (!ready) {
    return (
      <main className="game-career-gate"><section role="status"><span className="game-overline">Handball Manager</span><h1>Laddar karriär…</h1><p>Ditt lag, din säsong och dina sparade beslut.</p></section></main>
    );
  }

  return (
    <CareerProvider>
      <WorkspaceMemory><GameShell>{children}</GameShell></WorkspaceMemory>
    </CareerProvider>
  );
}
