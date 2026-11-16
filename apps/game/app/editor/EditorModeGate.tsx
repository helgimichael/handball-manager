"use client";

// HM-EDITOR-0.2: renders /editor's real content only when the user has
// switched Editor Mode ON in this browser (lib/editor/editorToggle.ts).
// This is layered ON TOP OF (never instead of) the server-side
// isEditorEnabled() gate already enforced by app/editor/layout.tsx and
// every /api/editor/* route -- flipping this toggle off/on can only
// ever hide/show already-server-permitted content, never grant access
// a disabled build wouldn't already allow.
// Arena Nights SYS-06: the toggle now lives in the DEV ribbon; this gate offers it inline too.
import { usePathname } from "next/navigation";
import { useEditorMode } from "@/components/dev/useEditorMode";
import { DEV_CONSOLE_HREF } from "@/lib/editor/devTools";

export function EditorModeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrated, enabled, setEnabled } = useEditorMode();

  // The console home (SYS-02) is the hub for every dev tool, labs included, so it is never hidden by the toggle.
  if (pathname === DEV_CONSOLE_HREF) return <>{children}</>;

  // Not hydrated yet: render nothing rather than a one-frame flash of the wrong state.
  if (!hydrated) return null;

  if (!enabled) {
    return (
      <div className="hm-dev-panel" style={{ maxWidth: 560, margin: "32px auto" }}>
        <div className="hm-dev-panel-head">
          <span className="hm-dev-panel-title">Editor Mode är avstängt</span>
          <span className="hm-dev-badge">DEV</span>
        </div>
        <div className="hm-dev-panel-body">
          <p className="hm-dev-muted" style={{ marginTop: 0 }}>
            Dataverktygen skriver till den verkliga databasen och visas bara när Editor Mode är på i den här webbläsaren.
            Motorlabben fungerar utan Editor Mode.
          </p>
          <button type="button" className="hm-dev-btn hm-dev-btn--primary" onClick={() => setEnabled(true)}>
            Aktivera Editor Mode
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
