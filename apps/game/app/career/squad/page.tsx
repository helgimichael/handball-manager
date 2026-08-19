"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSquad, playerAge, positionLabel } from "@/lib/game-data";
import type { HandballPosition } from "@/lib/game-data";

type SortKey = "name" | "position" | "age" | "form" | "fitness" | "morale" | "appearances" | "goals";

export default function SquadPage() {
  const router = useRouter();
  const squad = getSquad();
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("position");

  const positions: (HandballPosition | "ALL")[] = ["ALL", "MV", "V9", "V6", "M9", "M6", "H9", "H6", "PV"];

  const rows = useMemo(() => {
    const filtered = positionFilter === "ALL" ? squad : squad.filter((p) => p.position === positionFilter);
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.lastName.localeCompare(b.lastName);
        case "age":
          return playerAge(a.dateOfBirth) - playerAge(b.dateOfBirth);
        case "form":
          return b.form - a.form;
        case "fitness":
          return b.fitnessPct - a.fitnessPct;
        case "morale":
          return b.moralePct - a.moralePct;
        case "appearances":
          return b.appearances - a.appearances;
        case "goals":
          return b.goals - a.goals;
        default:
          return a.position.localeCompare(b.position);
      }
    });
  }, [squad, positionFilter, sortKey]);

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Trupp — IFK Tumba</span>
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
              <th>Nr</th>
              <th onClick={() => setSortKey("name")} style={{ cursor: "pointer" }}>Spelare</th>
              <th onClick={() => setSortKey("position")} style={{ cursor: "pointer" }}>Pos</th>
              <th onClick={() => setSortKey("age")} style={{ cursor: "pointer" }}>Ålder</th>
              <th>Status</th>
              <th onClick={() => setSortKey("appearances")} style={{ cursor: "pointer" }} className="hm-table-num">M</th>
              <th onClick={() => setSortKey("goals")} style={{ cursor: "pointer" }} className="hm-table-num">Mål</th>
              <th onClick={() => setSortKey("form")} style={{ cursor: "pointer" }} className="hm-table-num">Form</th>
              <th onClick={() => setSortKey("fitness")} style={{ cursor: "pointer" }} className="hm-table-num">Fitness</th>
              <th onClick={() => setSortKey("morale")} style={{ cursor: "pointer" }} className="hm-table-num">Moral</th>
              <th>Kontrakt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} data-clickable="true" onClick={() => router.push(`/career/squad/${p.id}`)}>
                <td>
                  <span className="hm-shirt-number">{p.shirtNumber}</span>
                </td>
                <td className="hm-td-strong">
                  {p.firstName} {p.lastName}
                </td>
                <td title={positionLabel(p.position)}>{p.position}</td>
                <td>{playerAge(p.dateOfBirth)}</td>
                <td>
                  <StatusBadge status={p.squadStatus} />
                </td>
                <td className="hm-table-num">{p.appearances}</td>
                <td className="hm-table-num">{p.goals}</td>
                <td className="hm-table-num">{p.form.toFixed(1)}</td>
                <td className="hm-table-num">
                  <Bar pct={p.fitnessPct} />
                </td>
                <td className="hm-table-num">
                  <Bar pct={p.moralePct} />
                </td>
                <td className="hm-text-muted">{p.contractEndSeason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "Förstaval" ? "positive" : status === "Skadad" ? "negative" : status === "Avstängd" ? "negative" : status === "Ungdom" ? "warning" : "neutral";
  return <span className={`hm-badge hm-badge-${tone}`}>{status}</span>;
}

function Bar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "var(--hm-positive)" : pct >= 55 ? "var(--hm-warning)" : "var(--hm-negative)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
      <div style={{ width: 40, height: 5, borderRadius: 3, background: "var(--hm-surface-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <span style={{ width: 26, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}
