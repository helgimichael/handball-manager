"use client";

// HM-EDITOR-0.2: Rating Review roster list -- club selector -> roster,
// mirroring app/editor/players/page.tsx's exact layout conventions.
// Every value shown here is either a HM-RATINGS-0.3 pipeline proposal
// (recomputed fresh every load, never persisted) or a reviewer's own
// recorded status -- never invented, never a filled-in average.
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

interface RatingRow {
  profile: {
    playerId: string;
    position: string;
    ca: { value: number | null; confidence: string };
    pa: { value: number | null; confidence: string };
  };
  matchedCalibration: boolean;
  status: string;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  UNASSESSED: "hm-badge-neutral",
  PROPOSED: "hm-badge-warning",
  REVIEWED: "hm-badge-positive",
  LOCKED: "hm-badge-positive",
};

export default function RatingReviewRosterPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<CatalogClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only load, matches players/page.tsx's own rationale.
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/editor/ratings/clubs/${encodeURIComponent(selectedClubId)}`).then((res) => res.json()),
      fetch(`/api/editor/clubs/${encodeURIComponent(selectedClubId)}/players`).then((res) => res.json()),
    ])
      .then(([ratingData, playerData]) => {
        if (ratingData.error) {
          setError(ratingData.error);
          setRows([]);
          return;
        }
        setRows(ratingData.players ?? []);
        const names: Record<string, string> = {};
        for (const p of playerData.players ?? []) names[p.playerId] = p.fullName;
        setNamesById(names);
      })
      .finally(() => setLoading(false));
  }, [selectedClubId]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (namesById[r.profile.playerId] ?? r.profile.playerId).toLowerCase().includes(term));
  }, [rows, search, namesById]);

  const summary = useMemo(() => {
    const total = rows.length;
    const caResolved = rows.filter((r) => r.profile.ca.value !== null).length;
    const paResolved = rows.filter((r) => r.profile.pa.value !== null).length;
    const matched = rows.filter((r) => r.matchedCalibration).length;
    return { total, caResolved, paResolved, matched };
  }, [rows]);

  return (
    <div style={{ maxWidth: 1200, margin: "32px auto", padding: "0 20px" }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">EDITOR — Betygsgranskning</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/editor")}>
            ← Editor
          </button>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Föreslagna CA/PA kommer från HM-RATINGS-0.3-pipelinen och beräknas alltid på nytt -- de sparas aldrig här. Endast granskningsstatus/anteckning sparas.
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)" }}>
            KLUBB
            <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} style={inputStyle}>
              {clubs.map((c) => (
                <option key={c.clubId} value={c.clubId}>
                  {c.clubName} ({c.playerCount})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--hm-text-2xs)", flex: 1, minWidth: 220 }}>
            SÖK SPELARE
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Namn..." style={inputStyle} />
          </label>
        </div>

        {rows.length > 0 ? (
          <div className="hm-panel-body" style={{ display: "flex", gap: 28 }}>
            <Stat label="Spelare" value={summary.total} />
            <Stat label="CA föreslaget" value={summary.caResolved} />
            <Stat label="PA föreslaget" value={summary.paResolved} />
            <Stat label="Kalibreringsträffar" value={summary.matched} />
          </div>
        ) : null}

        {error ? (
          <div className="hm-panel-body hm-text-negative">{error}</div>
        ) : loading ? (
          <div className="hm-panel-body hm-text-muted">Läser in...</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Position</th>
                <th className="hm-table-num">CA</th>
                <th>CA-konfidens</th>
                <th className="hm-table-num">PA</th>
                <th>PA-konfidens</th>
                <th>Kalibrering</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.profile.playerId} onClick={() => router.push(`/editor/ratings/${r.profile.playerId}?clubId=${selectedClubId}`)} style={{ cursor: "pointer" }}>
                  <td className="hm-td-strong">{namesById[r.profile.playerId] ?? r.profile.playerId}</td>
                  <td>{r.profile.position}</td>
                  <td className="hm-table-num">{r.profile.ca.value ?? "—"}</td>
                  <td className="hm-text-muted">{r.profile.ca.confidence}</td>
                  <td className="hm-table-num">{r.profile.pa.value ?? "—"}</td>
                  <td className="hm-text-muted">{r.profile.pa.confidence}</td>
                  <td>{r.matchedCalibration ? <span className="hm-badge hm-badge-positive">TRÄFF</span> : <span className="hm-text-muted">—</span>}</td>
                  <td>
                    <span className={`hm-badge ${STATUS_BADGE_CLASS[r.status] ?? "hm-badge-neutral"}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="hm-text-muted">
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>{value}</div>
    </div>
  );
}
