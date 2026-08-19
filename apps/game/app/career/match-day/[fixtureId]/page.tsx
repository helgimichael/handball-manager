"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { describeEvent } from "@/lib/career/eventText";
import ClubCrest from "@/components/ClubCrest";

type Speed = "paused" | "normal" | "fast";

// Text/event match presentation (Fast Match Engine, not the detailed
// SIM engine -- see HM-GAME-0.2A brief Section 14). The match is
// already fully simulated by the time this screen mounts (continueCareer
// ran when the user clicked SPELA MATCH); this view is a deterministic,
// speed-controllable REPLAY of that stored event timeline, not a live
// simulation with its own clock.
export default function MatchDayPage() {
  const router = useRouter();
  const params = useParams<{ fixtureId: string }>();
  const { career } = useCareer();

  const fixture = career.fixtures.find((f) => f.id === params.fixtureId);
  const result = career.results[params.fixtureId];

  const sortedEvents = useMemo(() => (result ? [...result.events].sort((a, b) => a.minute - b.minute) : []), [result]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [speed, setSpeed] = useState<Speed>("normal");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (speed === "paused" || !result) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const intervalMs = speed === "fast" ? 60 : 220;
    timerRef.current = setInterval(() => {
      setVisibleCount((c) => Math.min(sortedEvents.length, c + 1));
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [speed, sortedEvents.length, result]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [visibleCount]);

  if (!fixture || !result) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Ingen matchdata hittades för denna fixture.</div>
      </div>
    );
  }

  const home = getClub(fixture.homeClubId)!;
  const away = getClub(fixture.awayClubId)!;
  const finished = visibleCount >= sortedEvents.length;
  const visibleEvents = sortedEvents.slice(0, visibleCount);
  const lastGoalEvent = [...visibleEvents].reverse().find((e) => e.type === "GOAL");
  const currentHomeScore = lastGoalEvent?.homeScoreAfter ?? 0;
  const currentAwayScore = lastGoalEvent?.awayScoreAfter ?? 0;

  function handleInstant() {
    setSpeed("paused");
    setVisibleCount(sortedEvents.length);
  }

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, padding: "16px 20px" }}>
          <TeamColumn clubId={home.id} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--hm-text-2xl)", fontWeight: 800 }}>
              {currentHomeScore} – {currentAwayScore}
            </div>
            <div className="hm-eyebrow" style={{ marginTop: 4 }}>
              {finished ? "Slutresultat" : `${sortedEvents[Math.max(0, visibleCount - 1)]?.minute ?? 0}'`}
            </div>
          </div>
          <TeamColumn clubId={away.id} />
        </div>
      </div>

      <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
        <div className="hm-panel-header">
          <span className="hm-panel-title">Matchhändelser</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="hm-btn hm-btn-sm" onClick={() => setSpeed("paused")} disabled={speed === "paused"}>
              PAUS
            </button>
            <button type="button" className="hm-btn hm-btn-sm" onClick={() => setSpeed("normal")} disabled={speed === "normal"}>
              NORMAL
            </button>
            <button type="button" className="hm-btn hm-btn-sm" onClick={() => setSpeed("fast")} disabled={speed === "fast"}>
              SNABB
            </button>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={handleInstant} disabled={finished}>
              DIREKT RESULTAT
            </button>
          </div>
        </div>
        <div ref={logRef} style={{ height: 320, overflowY: "auto", padding: "6px 0" }}>
          {visibleEvents.map((event, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                padding: "4px 14px",
                fontSize: "var(--hm-text-xs)",
                background: event.type === "GOAL" ? "var(--hm-accent-muted)" : undefined,
              }}
            >
              <span className="hm-text-muted" style={{ width: 36, fontVariantNumeric: "tabular-nums" }}>
                {String(event.minute).padStart(2, "0")}:00
              </span>
              <span style={{ fontWeight: event.type === "GOAL" ? 700 : 400 }}>{describeEvent(event, home.name, away.name)}</span>
            </div>
          ))}
        </div>
      </div>

      {finished ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push(`/career/match-report/${fixture.id}`)}>
            MATCHRAPPORT →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TeamColumn({ clubId }: { clubId: string }) {
  const c = getClub(clubId)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 130 }}>
      <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={40} />
      <div style={{ fontSize: "var(--hm-text-xs)", fontWeight: 700, textAlign: "center" }}>{c.shortName}</div>
    </div>
  );
}
