"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMostRecentSave, setActiveSaveId, touchSave, type CareerSave } from "@/lib/save/saveRepository";

export default function TitleScreen() {
  const router = useRouter();
  const [lastSave, setLastSave] = useState<CareerSave | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // One-shot client-only persistence read on mount -- see
    // career/layout.tsx for why useSyncExternalStore isn't used here
    // (saveRepository has no cache layer, so its snapshots aren't
    // referentially stable across calls).
    // HM-SAVE-STORAGE-1.0: async, and a read failure is shown rather
    // than silently hiding the "Fortsätt" button as if no save existed.
    let cancelled = false;
    getMostRecentSave()
      .then((save) => { if (!cancelled) setLastSave(save); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Kunde inte läsa sparade karriärer."); });
    return () => { cancelled = true; };
  }, []);

  async function handleContinue() {
    if (!lastSave) {
      return;
    }
    setActiveSaveId(lastSave.saveId);
    try {
      await touchSave(lastSave.saveId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Kunde inte uppdatera karriären.");
      return;
    }
    router.push("/career");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse 900px 500px at 50% -10%, #1a2440 0%, transparent 60%), var(--hm-bg-app)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Faint court-line motif, purely decorative */}
      <svg
        width="640"
        height="640"
        viewBox="0 0 640 640"
        style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", opacity: 0.05 }}
      >
        <circle cx="320" cy="320" r="60" stroke="#ffffff" strokeWidth="2" fill="none" />
        <rect x="20" y="20" width="600" height="600" stroke="#ffffff" strokeWidth="2" fill="none" />
        <path d="M20 20 A120 120 0 0 1 140 140 L20 140 Z" stroke="#ffffff" strokeWidth="2" fill="none" />
        <path d="M620 620 A120 120 0 0 1 500 500 L620 500 Z" stroke="#ffffff" strokeWidth="2" fill="none" />
      </svg>

      <div style={{ zIndex: 1, textAlign: "center", marginBottom: 56 }}>
        <div
          style={{
            fontSize: "var(--hm-text-lg)",
            fontWeight: 700,
            letterSpacing: "0.35em",
            color: "var(--hm-accent-strong)",
            marginBottom: 4,
          }}
        >
          HANDBALL
        </div>
        <div
          style={{
            fontSize: "var(--hm-text-3xl)",
            fontWeight: 800,
            letterSpacing: "0.06em",
            lineHeight: 1,
            color: "var(--hm-text-primary)",
          }}
        >
          MANAGER
        </div>
        <div className="hm-eyebrow" style={{ marginTop: 10, letterSpacing: "0.2em" }}>
          2026
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8, width: 280, zIndex: 1 }}>
        <TitleMenuItem label="NYTT SPEL" onClick={() => router.push("/new-game")} />
        <TitleMenuItem
          label="FORTSÄTT"
          subLabel={error ? "Sparade karriärer kunde inte läsas" : lastSave ? lastSave.manager.name : "Ingen sparad karriär ännu"}
          disabled={!lastSave}
          onClick={handleContinue}
        />
        <TitleMenuItem label="LADDA SPEL" onClick={() => router.push("/load-game")} />
      </nav>

      {error ? (
        <div style={{ zIndex: 1, marginTop: 18, maxWidth: 420, textAlign: "center", fontSize: "12px", color: "var(--hm-text-muted)" }}>
          {error}
        </div>
      ) : null}

      <div style={{ position: "absolute", bottom: 18, fontSize: "10px", color: "var(--hm-text-disabled)", letterSpacing: "0.05em" }}>
        Management Experience v1
      </div>
    </div>
  );
}

function TitleMenuItem({
  label,
  subLabel,
  disabled,
  onClick,
}: {
  label: string;
  subLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "11px 16px",
        background: "transparent",
        border: "none",
        borderTop: "1px solid var(--hm-border-subtle)",
        color: disabled ? "var(--hm-text-disabled)" : "var(--hm-text-primary)",
        fontSize: "var(--hm-text-sm)",
        fontWeight: 700,
        letterSpacing: "0.12em",
        cursor: disabled ? "default" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.color = "var(--hm-accent-strong)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.color = "var(--hm-text-primary)";
      }}
    >
      {label}
      {subLabel ? (
        <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.02em", color: "var(--hm-text-muted)" }}>
          {subLabel}
        </span>
      ) : null}
    </button>
  );
}
