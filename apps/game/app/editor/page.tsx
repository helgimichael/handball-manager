"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CatalogClub {
  clubId: string;
  clubName: string;
  competitionId: string;
  nation: string;
  season: string;
  competitionSlug: string;
  playerCount: number;
}

export default function EditorHomePage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<CatalogClub[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/editor/catalog")
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data) => setClubs(data.clubs))
      .catch(() => setError("Kunde inte läsa databasen."));
  }, []);

  const nations = clubs ? new Set(clubs.map((c) => c.nation)).size : 0;
  const competitions = clubs ? new Set(clubs.map((c) => c.competitionId)).size : 0;
  const totalPlayers = clubs ? clubs.reduce((sum, c) => sum + c.playerCount, 0) : 0;

  return (
    <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px" }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">EDITOR — Verklig databas</span>
          <span className="hm-badge hm-badge-warning">UTVECKLING</span>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
          Utvecklingsverktyg för att korrigera verkliga klubb-/spelardata. Inte tillgängligt i det vanliga spelet.
        </div>
        {error ? (
          <div className="hm-panel-body hm-text-negative">{error}</div>
        ) : (
          <div className="hm-panel-body" style={{ display: "flex", gap: 28 }}>
            <Stat label="Nationer" value={nations} />
            <Stat label="Tävlingar" value={competitions} />
            <Stat label="Klubbar" value={clubs?.length ?? 0} />
            <Stat label="Spelare" value={totalPlayers} />
          </div>
        )}
        <div className="hm-panel-body" style={{ paddingTop: 0 }}>
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push("/editor/players")} disabled={!clubs}>
            ÖPPNA SPELARE →
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>{value}</div>
    </div>
  );
}
