"use client";

import type { PlayerFormEntry } from "@/lib/career/playerForm";

function ratingColor(rating?: number): string {
  if (rating === undefined) return "var(--hm-text-muted, #888)";
  if (rating >= 7.5) return "var(--hm-tone-positive, #10b981)";
  if (rating >= 6.5) return "var(--hm-accent-primary, #3b82f6)";
  return "var(--hm-accent-gold, #f59e0b)";
}

export function PlayerFormSparkline({
  entries,
  maxEntries = 5,
}: {
  entries: PlayerFormEntry[];
  maxEntries?: number;
}) {
  // Pad with empty entries if fewer matches have been played yet
  const slots: (PlayerFormEntry | null)[] = [];
  for (let i = 0; i < maxEntries; i++) {
    slots.push(entries[i] ?? null);
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
      aria-label="Formkurva senaste matcherna"
    >
      {slots.map((item, idx) => {
        if (!item) {
          return (
            <span
              key={`empty-${idx}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "20px",
                fontSize: "10px",
                borderRadius: "3px",
                background: "rgba(255,255,255,0.05)",
                color: "var(--hm-text-muted, #666)",
              }}
              title="Ingen match registrerad ännu"
            >
              —
            </span>
          );
        }

        if (!item.played) {
          return (
            <span
              key={`dnp-${item.fixtureId}-${idx}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "20px",
                fontSize: "9px",
                fontWeight: 600,
                borderRadius: "3px",
                background: "rgba(255,255,255,0.08)",
                color: "var(--hm-text-muted, #aaa)",
                border: "1px dashed rgba(255,255,255,0.15)",
              }}
              title={`${item.date}: ${item.isHome ? "Hemma" : "Borta"} mot ${item.opponentShortName} (${item.scoreText}) — Spelade ej (DNP)`}
            >
              DNP
            </span>
          );
        }

        const ratingVal = item.rating?.toFixed(1) ?? "—";
        const bg = ratingColor(item.rating);

        return (
          <span
            key={`match-${item.fixtureId}-${idx}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "20px",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "3px",
              background: bg,
              color: "#fff",
              cursor: "help",
            }}
            title={`${item.date}: ${item.isHome ? "Hemma" : "Borta"} mot ${item.opponentShortName} (${item.scoreText}) — Betyg ${ratingVal}${item.goals !== undefined ? `, ${item.goals} mål` : ""}`}
          >
            {ratingVal}
          </span>
        );
      })}
    </div>
  );
}
