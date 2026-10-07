"use client";

// HM-CAREER-0.5: a visible day-by-day reveal of a CONTINUE press that has
// ALREADY fully run (Career Rhythm's exactly-once processing already
// happened synchronously in CareerContext's continueCareer() before this
// component is ever shown -- see GameShell.tsx). This is purely a
// presentation-layer replay of the already-decided `events` it is given,
// grouped by their own `.date` field, at a UI-controlled pace -- exactly
// the same "reveal controller over pre-decided data" pattern Live Match
// uses for a FastMatchResult (see lib/liveMatch/useLiveMatch.ts). It
// never re-processes, re-decides, or invents anything: a day with no
// notable events still legitimately shows "Träning genomförd" (every
// single day always has at least that one real, already-happened event
// -- see dailyTick.ts), never a fabricated filler line.
import { useEffect, useRef, useState } from "react";
import { formatGameDate } from "@/lib/career/dateUtils";
import type { CareerEvent } from "@/lib/career/careerEvents";

export type ProcessingDay = {
  date: string;
  events: CareerEvent[];
};

const DAY_TICK_INTERVAL_MS = 450;
const FAST_DAY_TICK_INTERVAL_MS = 110;
/** Above this many days, switch to the faster interval -- otherwise a 100-quiet-day CONTINUE press would take nearly a minute to reveal. */
const FAST_THRESHOLD_DAYS = 10;

function eventPriorityBadge(priority: CareerEvent["priority"]): { label: string; className: string } | null {
  if (priority === "ACTION_REQUIRED") return { label: "ÅTGÄRD", className: "hm-badge-warning" };
  if (priority === "IMPORTANT") return { label: "VIKTIGT", className: "hm-badge-neutral" };
  return null;
}

export default function ContinueProcessingOverlay({ days, onFinished }: { days: readonly ProcessingDay[]; onFinished: () => void }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (revealedCount >= days.length) {
      return;
    }
    const intervalMs = days.length > FAST_THRESHOLD_DAYS ? FAST_DAY_TICK_INTERVAL_MS : DAY_TICK_INTERVAL_MS;
    const timer = setTimeout(() => setRevealedCount((n) => n + 1), intervalMs);
    return () => clearTimeout(timer);
  }, [revealedCount, days.length]);

  useEffect(() => {
    if (revealedCount < days.length || days.length === 0 || finishedRef.current) {
      return;
    }
    // A short pause on the final day so the manager can actually read it before navigating away.
    const timer = setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinished();
    }, 350);
    return () => clearTimeout(timer);
  }, [revealedCount, days.length, onFinished]);

  function handleSkip() {
    if (!finishedRef.current) {
      finishedRef.current = true;
      onFinished();
    }
  }

  const revealedDays = days.slice(0, revealedCount);
  const currentDay = days[Math.min(revealedCount, days.length - 1)];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
        padding: 20,
      }}
    >
      <div className="hm-panel" style={{ maxWidth: 520, width: "100%" }}>
        <div className="hm-panel-header">
          <span className="hm-panel-title">Bearbetar säsongen…</span>
          <button type="button" className="hm-btn hm-btn-sm" style={{ marginLeft: "auto" }} onClick={handleSkip}>
            HOPPA ÖVER
          </button>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div className="hm-eyebrow" style={{ fontSize: "var(--hm-text-md)", fontVariantNumeric: "tabular-nums" }}>
              {currentDay ? formatGameDate(currentDay.date) : ""}
            </div>
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {revealedDays.flatMap((day) =>
              day.events.map((e) => {
                const badge = eventPriorityBadge(e.priority);
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "var(--hm-text-xs)" }}>
                    <span className="hm-text-muted" style={{ width: 78, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {formatGameDate(day.date)}
                    </span>
                    <span>{e.subject}</span>
                    {badge ? (
                      <span className={`hm-badge ${badge.className}`} style={{ marginLeft: "auto", fontSize: "var(--hm-text-2xs)" }}>
                        {badge.label}
                      </span>
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
