"use client";

// Arena Nights SYS-02/03/04 (A): the one "Dev" shell every internal tool renders in --
// neutral grey dev theme, a DEV ribbon with the tool list, the Editor Mode toggle and a
// way back to the game, plus a "desktop only" notice on narrow screens. Mounted by each
// gated route's SERVER layout (app/editor, app/scenario-lab, app/match-qa) after
// isEditorEnabled() has passed, so this component itself never decides access.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { activeDevTool, DEV_CONSOLE_HREF, DEV_TOOLS } from "@/lib/editor/devTools";
import { useEditorMode } from "./useEditorMode";
import "./dev.css";

export function DevShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = activeDevTool(pathname);
  const atHome = pathname === DEV_CONSOLE_HREF;
  const { hydrated, enabled, setEnabled } = useEditorMode();

  return (
    <div className="hm-dev" data-dev-shell="">
      <header className="hm-dev-ribbon">
        <Link href={DEV_CONSOLE_HREF} className="hm-dev-brand" aria-current={atHome ? "page" : undefined}>
          <span className="hm-dev-badge">DEV</span>
          <span>Dev-konsol</span>
        </Link>
        <nav className="hm-dev-nav" aria-label="Utvecklarverktyg">
          {DEV_TOOLS.map((tool) => (
            <Link key={tool.id} href={tool.href} className="hm-dev-nav-link" aria-current={active?.id === tool.id ? "page" : undefined}>
              {tool.label}
            </Link>
          ))}
        </nav>
        <div className="hm-dev-ribbon-end">
          <button
            type="button"
            className="hm-dev-toggle"
            aria-pressed={hydrated ? enabled : undefined}
            disabled={!hydrated}
            onClick={() => setEnabled(!enabled)}
            title="Editor Mode visar dataverktygen (Spelare, Betyg, Court grid, CPU-rekrytering) i den här webbläsaren."
          >
            Editor Mode <b>{hydrated ? (enabled ? "PÅ" : "AV") : "…"}</b>
          </button>
          <Link href="/" className="hm-dev-exit">Till spelet</Link>
        </div>
      </header>
      <div className="hm-dev-desktop-only" role="note">
        <span className="hm-dev-badge">DEV</span>
        <strong>Endast dator</strong>
        <p>Utvecklarverktygen är byggda för stora skärmar (minst 900 px bred). Öppna dem på en dator.</p>
        <Link href="/" className="hm-dev-exit">Till spelet</Link>
      </div>
      <div className="hm-dev-body">{children}</div>
    </div>
  );
}

/** Shared page head for every dev tool: eyebrow (tool group), title, optional one-line note and actions. */
export function DevPageHead({ eyebrow, title, note, actions }: { eyebrow?: string; title: string; note?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="hm-dev-head">
      <div>
        {eyebrow ? <div className="hm-dev-eyebrow">{eyebrow}</div> : null}
        <h1 className="hm-dev-title">{title}</h1>
        {note ? <p className="hm-dev-note">{note}</p> : null}
      </div>
      {actions ? <div className="hm-dev-head-actions">{actions}</div> : null}
    </div>
  );
}
