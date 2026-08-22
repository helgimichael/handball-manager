"use client";

// HM-EDITOR-0.2: the in-game Editor Mode toggle. Mounted once in the
// root layout so it's reachable from anywhere in the app (new game,
// career screens, etc.) without adding a link to every page's own nav.
//
// Renders NOTHING until /api/editor/status confirms the server actually
// has editor capability enabled (HM_EDITOR_ENABLED=true AND
// NODE_ENV !== "production") -- in a production build that endpoint
// always reports { enabled: false }, so this widget (and therefore any
// way to reach /editor from the normal game UI) is completely absent,
// regardless of any stale localStorage value from a previous session.
import { useEffect, useState } from "react";
import Link from "next/link";
import { readEditorToggle, writeEditorToggle } from "@/lib/editor/editorToggle";

export function EditorModeWidget() {
  const [serverCapable, setServerCapable] = useState(false);
  const [toggleOn, setToggleOn] = useState(false);

  useEffect(() => {
    fetch("/api/editor/status")
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => setServerCapable(Boolean(data.enabled)))
      .catch(() => setServerCapable(false));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only localStorage read, matches editor/players/page.tsx's own rationale.
    setToggleOn(readEditorToggle());
  }, []);

  if (!serverCapable) {
    return null;
  }

  function toggle() {
    const next = !toggleOn;
    setToggleOn(next);
    writeEditorToggle(next);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      {toggleOn ? (
        <Link href="/editor" className="hm-btn hm-btn-sm hm-btn-primary" style={{ textDecoration: "none" }}>
          EDITOR MODE AKTIVT →
        </Link>
      ) : null}
      <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={toggle}>
        {toggleOn ? "STÄNG AV EDITOR MODE" : "AKTIVERA EDITOR MODE"}
      </button>
    </div>
  );
}
