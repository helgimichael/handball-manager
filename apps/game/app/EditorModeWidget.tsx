"use client";

// HM-EDITOR-0.2 + Arena Nights SYS-06 (A) "DEV ribbon toggle": one small DEV ribbon in the
// bottom-right screen corner replaces the old floating buttons. Its menu toggles Editor Mode and
// opens the dev console and its tools. Mounted once in the root layout.
//
// Renders NOTHING until /api/editor/status confirms the server actually has editor capability
// (HM_EDITOR_ENABLED=true AND NODE_ENV !== "production") -- in a production build that endpoint
// always reports { enabled: false }, so the ribbon (and any way to reach /editor from the game UI)
// is absent regardless of any stale localStorage value. Hidden on dev routes, which have the dev
// shell's own ribbon, and on narrow screens (dev tools are desktop-only).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEditorMode } from "@/components/dev/useEditorMode";
import { DEV_CONSOLE_HREF, DEV_TOOLS, isDevRoute } from "@/lib/editor/devTools";
import "@/components/dev/dev.css";

export function EditorModeWidget() {
  const pathname = usePathname();
  const [serverCapable, setServerCapable] = useState(false);
  const [open, setOpen] = useState(false);
  const { enabled, setEnabled } = useEditorMode();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/editor/status")
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => setServerCapable(Boolean(data.enabled)))
      .catch(() => setServerCapable(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!serverCapable || isDevRoute(pathname)) return null;

  return (
    <div className="hm-dev-corner" ref={rootRef}>
      {open ? (
        <div className="hm-dev-corner-menu" role="menu" aria-label="Utvecklarmeny">
          <button type="button" role="menuitemcheckbox" aria-checked={enabled} onClick={() => setEnabled(!enabled)}>
            <span>Editor Mode</span>
            <b>{enabled ? "PÅ" : "AV"}</b>
          </button>
          <Link href={DEV_CONSOLE_HREF} role="menuitem" onClick={() => setOpen(false)}>
            <span>Öppna dev-konsolen</span>
            <small>/editor</small>
          </Link>
          <hr />
          {DEV_TOOLS.map((tool) => (
            <Link key={tool.id} href={tool.href} role="menuitem" onClick={() => setOpen(false)}>
              <span>{tool.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="hm-dev-corner-tab"
        data-on={enabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={enabled ? "Editor Mode är på" : "Editor Mode är av"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="hm-dev-corner-dot" aria-hidden="true" />
        DEV
      </button>
    </div>
  );
}
