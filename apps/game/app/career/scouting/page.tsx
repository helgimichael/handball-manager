"use client";

import { useMemo, useState } from "react";
import { getScoutedPlayers } from "@/lib/game-data";
import StarRating from "@/components/StarRating";

export default function ScoutingPage() {
  const players = getScoutedPlayers();
  const [positionFilter, setPositionFilter] = useState("ALL");
  const positions = ["ALL", ...Array.from(new Set(players.map((p) => p.position)))];

  const rows = useMemo(
    () => (positionFilter === "ALL" ? players : players.filter((p) => p.position === positionFilter)),
    [players, positionFilter],
  );

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Scouting — bevakade spelare</span>
        <div style={{ display: "flex", gap: 6 }}>
          {positions.map((p) => (
            <button
              key={p}
              type="button"
              className="hm-btn hm-btn-sm"
              style={{
                background: positionFilter === p ? "var(--hm-accent)" : undefined,
                borderColor: positionFilter === p ? "var(--hm-accent)" : undefined,
                color: positionFilter === p ? "#fff" : undefined,
              }}
              onClick={() => setPositionFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th>Klubb</th>
              <th>Nation</th>
              <th>Ålder</th>
              <th>Pos</th>
              <th>Förmåga</th>
              <th>Potential</th>
              <th className="hm-table-num">Kännedom</th>
              <th>Kontrakt</th>
              <th className="hm-table-num">Uppskattat värde</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="hm-td-strong">{p.name}</td>
                <td>{p.clubName}</td>
                <td>{p.nationality}</td>
                <td>{p.age}</td>
                <td>{p.position}</td>
                <td>
                  <StarRating stars={p.estimatedAbilityStars} />
                </td>
                <td>
                  <StarRating stars={p.potentialStars} />
                </td>
                <td className="hm-table-num">{p.knowledgePct}%</td>
                <td className="hm-text-muted">{p.contractEndSeason}</td>
                <td className="hm-table-num">{p.estimatedValueSek.toLocaleString("sv-SE")} kr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
        Fiktiva spelare och bedömningar. Ingen verklig scoutingsimulering i denna version.
      </div>
    </div>
  );
}
