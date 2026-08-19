"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GameShell from "@/components/GameShell";
import { getActiveSave } from "@/lib/save/saveRepository";
import { CareerProvider } from "@/lib/career/CareerContext";

export default function CareerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deliberate one-time client-only localStorage read guarding
    // against SSR/hydration mismatch (this route can be reached via a
    // direct navigation, not just client-side push from the title
    // screen). useSyncExternalStore was tried first but saveRepository's
    // getSave()/getActiveSave() re-parse JSON on every call, returning a
    // fresh object reference each time -- without a real cache layer
    // that produces an infinite update loop, which is worse than this
    // rule's cascading-render concern. A one-shot mount effect is the
    // correct tool for "read once on client mount, don't resubscribe".
    const save = getActiveSave();
    if (!save) {
      router.replace("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [router]);

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
