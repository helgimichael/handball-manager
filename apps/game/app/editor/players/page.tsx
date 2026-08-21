"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

const inputStyle: CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
};

interface CatalogClub {
  clubId: string;
  clubName: string;
  competitionId: string;
  nation: string;
  season: string;
  competitionSlug: string;
  playerCount: number;
}

interface PlayerRow {
  playerId: string;
  fullName: string;
  clubId: string;
  clubName: string;
  primaryPosition: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  nationalities: string[] | null;
  shirtNumber: number | null;
  recordConfidence: string | null;
  rosterConfidence: string | null;
}

export default function PlayerBrowserPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<CatalogClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/editor/catalog")
      .then((res) => res.json())
      .then((data) => {
        setClubs(data.clubs ?? []);
        if (data.clubs?.length) setSelectedClubId(data.clubs[0].clubId);
      });
  }, []);

  useEffect(() => {
    if (!selectedClubId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only load, matches CareerContext's same rationale.
    setLoading(true);
    fetch(`/api/editor/clubs/${encodeURIComponent(selectedClubId)}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data.players ?? []))
      .finally(() => setLoading(false));
  }, [selectedClubId]);

  const nations = useMemo(() => Array.from(new Set(clubs.map((c) => c.nation))), [clubs]);
  const [nationFilter, setNationFilter] = useState<string>("");
  const filteredClubs = useMemo(
    () => (nationFilter ? clubs.filter((c) => c.nation === nationFilter) : clubs),
    [clubs, nationFilter],
  );

  const visiblePlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return players;
    return players.filter((p) => p.fullName.toLowerCase().includes(term));
  }, [players, search]);

  return (
    <div style={{ maxWidth: 1100, margin: "32px auto", padding: "0 20px" }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">EDITOR — Spelare</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/editor")}>
            ← Editor
          </button>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            NATION
            <select value={nationFilter} onChange={(e) => setNationFilter(e.target.value)} style={inputStyle}>
              <option value="">Alla</option>
              {nations.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            KLUBB
            <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} style={inputStyle}>
              {filteredClubs.map((c) => (
                <option key={c.clubId} value={c.clubId}>
                  {c.clubName} ({c.playerCount})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)", flex: 1, minWidth: 220 }}>
            SÖK SPELARE
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Namn..."
              style={inputStyle}
            />
          </label>
        </div>

        {loading ? (
          <div className="hm-panel-body hm-text-muted">Läser in...</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Position</th>
                <th>Född</th>
                <th>Nationalitet</th>
                <th className="hm-table-num">Nr</th>
                <th>Källkonfidens</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((p) => (
                <tr key={p.playerId} onClick={() => router.push(`/editor/players/${p.playerId}?clubId=${p.clubId}`)} style={{ cursor: "pointer" }}>
                  <td className="hm-td-strong">{p.fullName}</td>
                  <td>{p.primaryPosition || "—"}</td>
                  <td className="hm-text-muted">{p.dateOfBirth ?? (p.birthYear ? `${p.birthYear}` : "—")}</td>
                  <td className="hm-text-muted">{p.nationalities?.join(", ") ?? "—"}</td>
                  <td className="hm-table-num">{p.shirtNumber ?? "—"}</td>
                  <td>
                    <span className="hm-badge hm-badge-neutral">{p.recordConfidence ?? "—"}</span>
                  </td>
                </tr>
              ))}
              {visiblePlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="hm-text-muted">
                    Inga spelare matchar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
