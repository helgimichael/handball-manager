"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import GameShell from "@/components/GameShell";
import { getActiveSave } from "@/lib/save/saveRepository";
import { COMPETITIONS, getClub } from '@/lib/game-data';
import CareerInitialization, { type HandoverFact } from '@/components/game/CareerInitialization';
import { buildSaveCover } from '@/components/entry/saveCover';
import { CareerProvider } from "@/lib/career/CareerContext";
import '@/components/game/game-feedback.css';
import { WorkspaceMemory } from '@/components/game/WorkspaceMemory';

export default function CareerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Keep only display metadata; the provider owns the large career snapshot.
  const [save, setSave] = useState<{ clubId: string; gameDate: string; seasonId?: string; existing: boolean; facts?: HandoverFact[] } | null>(null);
  // ENT-12: when opening takes longer than three seconds the handover waits for 'Gå in på kontoret'.
  const [startedAt] = useState(() => Date.now());
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
        setSave({ clubId: save.clubId, gameDate: save.gameDate, seasonId: save.careerState?.seasonId, existing: !!save.careerState, facts: save.careerState ? coverFacts(save) : undefined });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        console.error('[career] Failed to read active save', cause);
        setError(cause instanceof Error ? cause.message : "Kunde inte läsa sparade karriärer.");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const club = save ? getClub(save.clubId) : undefined;
  const identity = { club, competition: COMPETITIONS.find(c => c.id === club?.competitionId)?.name,
    season: save?.seasonId ?? (save ? `${Number(save.gameDate.slice(0, 4))}/${String(Number(save.gameDate.slice(0, 4)) + 1).slice(-2)}` : undefined), existing: !!save?.existing };
  // Clear any failed in-memory write promise before the player opens a saved career.
  const failure = <CareerInitialization {...identity} failed onBack={() => window.location.replace('/')} />;
  if (error) return failure;
  const loading = <CareerInitialization {...identity} facts={save?.facts} existing={!save || identity.existing} />;
  if (!save) return loading;

  return (
    <CareerProvider loadingFallback={loading} initializationErrorFallback={failure}>
      <Handover startedAt={startedAt} identity={identity} facts={save.facts}>
        <WorkspaceMemory><GameShell>{children}</GameShell></WorkspaceMemory>
      </Handover>
    </CareerProvider>
  );
}

/** ENT-12 for a saved career: the cover's own facts (position, last result, next match) instead of preseason ones. */
function coverFacts(save: Parameters<typeof buildSaveCover>[0]): HandoverFact[] {
  try {
    const c = buildSaveCover(save);
    return [
      c.position && c.tableSize ? { label: 'Läget', value: `${c.position}:a av ${c.tableSize} i ${c.competitionName}` } : null,
      c.lastResult ? { label: 'Senast', value: `${c.lastResult.ours}–${c.lastResult.theirs} ${c.lastResult.home ? 'hemma' : 'borta'} mot ${c.lastResult.opponent}` } : null,
      c.nextFixture ? { label: 'Nästa match', value: `${c.nextFixture.opponent} ${c.nextFixture.home ? 'hemma' : 'borta'} · ${c.nextFixture.daysUntil <= 0 ? 'i dag' : c.nextFixture.daysUntil === 1 ? 'i morgon' : `om ${c.nextFixture.daysUntil} dagar`}` } : null,
    ].filter((f): f is HandoverFact => !!f);
  } catch {
    return [];
  }
}

/** Mounted only once the provider has the career: a quick open goes straight in, a slow one hands over with a button. */
function Handover({ startedAt, identity, facts, children }: { startedAt: number; identity: Omit<Parameters<typeof CareerInitialization>[0], 'facts'>; facts?: HandoverFact[]; children: ReactNode }) {
  const [entered, setEntered] = useState(() => Date.now() - startedAt <= 3000);
  if (entered) return children;
  return <CareerInitialization {...identity} facts={facts} ready onEnter={() => setEntered(true)} />;
}
