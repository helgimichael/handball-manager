"use client";

// Arena Nights SYS-06: one shared subscription to the client-side Editor Mode toggle
// (lib/editor/editorToggle.ts), so the global DEV ribbon, the dev shell and the
// /editor gate all flip together. Still a UX convenience only: the server gate
// (isEditorEnabled) decides whether any dev route or /api/editor/* call works at all.
import { useCallback, useSyncExternalStore } from "react";
import { readEditorToggle, writeEditorToggle } from "@/lib/editor/editorToggle";

const EVENT = "hm-editor-toggle";

function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

const noopSubscribe = () => () => {};

/** `hydrated` is false during SSR and the hydration pass, so callers can avoid a one-frame flash of the wrong state. */
export function useEditorMode(): { hydrated: boolean; enabled: boolean; setEnabled: (next: boolean) => void } {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const enabled = useSyncExternalStore(subscribe, readEditorToggle, () => false);
  const setEnabled = useCallback((next: boolean) => {
    writeEditorToggle(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { hydrated, enabled, setEnabled };
}
