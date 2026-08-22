"use client";

// HM-EDITOR-0.2: renders /editor's real content only when the user has
// switched Editor Mode ON in this browser (lib/editor/editorToggle.ts).
// This is layered ON TOP OF (never instead of) the server-side
// isEditorEnabled() gate already enforced by app/editor/layout.tsx and
// every /api/editor/* route -- flipping this toggle off/on can only
// ever hide/show already-server-permitted content, never grant access
// a disabled build wouldn't already allow.
import { useEffect, useState } from "react";
import { readEditorToggle } from "@/lib/editor/editorToggle";

export function EditorModeGate({ children }: { children: React.ReactNode }) {
  // null = "haven't read localStorage yet" -- avoids a one-frame flash
  // of the wrong state on mount (SSR has no localStorage to read at all).
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only localStorage read, matches editor/players/page.tsx's own rationale.
    setEnabled(readEditorToggle());
  }, []);

  if (enabled === null) {
    return null;
  }

  if (!enabled) {
    return (
      <div style={{ maxWidth: 640, margin: "48px auto", padding: "0 20px" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">EDITOR MODE ÄR AVSTÄNGT</span>
            <span className="hm-badge hm-badge-warning">UTVECKLING</span>
          </div>
          <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
            Aktivera Editor Mode via växlingsknappen (nedre högra hörnet) för att fortsätta.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
