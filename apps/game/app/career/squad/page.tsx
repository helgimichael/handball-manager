"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { playerAge, positionLabel } from "@/lib/game-data";
import type { HandballPosition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { averageRating, emptyPlayerSeasonStats } from "@/lib/career/types";
import { resolveStatusLabel } from "@/lib/career/playerStatus";
import { REHAB_PHASE_LABELS } from "@/lib/medical/labels";
import { getPlayerContract, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { formatEur } from "@/lib/economy/currency";

type SortKey = "name" | "position" | "age" | "appearances" | "goals" | "rating" | "fitness" | "morale";

export default function SquadPage() {
  const router = useRouter();
  const { career } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("position");

  const positions: (HandballPosition | "ALL")[] = ["ALL", "MV", "V9", "V6", "M9", "M6", "H9", "H6", "PV"];

  const rows = useMemo(() => {
    const filtered = positionFilter === "ALL" ? squad : squad.filter((p) => p.position === positionFilter);
    return [...filtered].sort((a, b) => {
      const statsA = career.playerSeasonStats[a.id] ?? emptyPlayerSeasonStats(a.id);
      const statsB = career.playerSeasonStats[b.id] ?? emptyPlayerSeasonStats(b.id);
      switch (sortKey) {
        case "name":
          return a.lastName.localeCompare(b.lastName);
        case "age":
          return (playerAge(a.dateOfBirth, a.birthYear) ?? 0) - (playerAge(b.dateOfBirth, b.birthYear) ?? 0);
        case "appearances":
          return statsB.appearances - statsA.appearances;
        case "goals":
          return statsB.goals - statsA.goals;
        case "rating":
          return averageRating(statsB) - averageRating(statsA);
        case "fitness":
          return b.fitnessPct - a.fitnessPct;
        case "morale":
          return b.moralePct - a.moralePct;
        default:
          return a.position.localeCompare(b.position);
      }
    });
  }, [squad, positionFilter, sortKey, career.playerSeasonStats]);

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Trupp — {club.name} · {career.seasonId}</span>
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
              <th onClick={() => setSortKey("rating")} style={{ cursor: "pointer" }} className="hm-table-num">Snittbetyg</th>
              <th onClick={() => setSortKey("fitness")} style={{ cursor: "pointer" }} className="hm-table-num">Fitness</th>
              <th onClick={() => setSortKey("morale")} style={{ cursor: "pointer" }} className="hm-table-num">Moral</th>
              <th>Kontrakt t.o.m.</th>
              <th className="hm-table-num">Värde</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const stats = career.playerSeasonStats[p.id] ?? emptyPlayerSeasonStats(p.id);
              const marketValue = getPlayerMarketValueEur(career, p.id);
              return (
                <tr key={p.id} data-clickable="true" onClick={() => router.push(`/career/squad/${p.id}`)}>
                  <td>
                    <span className="hm-shirt-number">{p.shirtNumber ?? "–"}</span>
                  </td>
                  <td className="hm-td-strong">
                    {p.firstName} {p.lastName}
                  </td>
                  <td title={positionLabel(p.position)}>{p.position}</td>
                  <td>{playerAge(p.dateOfBirth, p.birthYear) ?? "–"}</td>
                  <td>
                    {/* HM-INJURIES-1.0 Part 30: the live, injury-aware
                        status (never the static mock's own squadStatus)
                        -- resolveStatusLabel is the same single source
                        Player Profile already reads. */}
                    <StatusBadge status={resolveStatusLabel(career.playerStatuses, p)} />
                    {career.playerInjuries[p.id]?.activeInjury ? (
                      <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", marginTop: 2 }}>
                        {REHAB_PHASE_LABELS[career.playerInjuries[p.id]!.activeInjury!.currentPhase]} · åter {career.playerInjuries[p.id]!.activeInjury!.expectedReturnDate}
                      </div>
                    ) : null}
                  </td>
                  <td className="hm-table-num">{stats.appearances}</td>
                  <td className="hm-table-num">{stats.goals}</td>
                  <td className="hm-table-num">{stats.appearances > 0 ? averageRating(stats).toFixed(1) : "—"}</td>
                  <td className="hm-table-num">
                    <Bar pct={p.fitnessPct} />
                  </td>
                  <td className="hm-table-num">
                    <Bar pct={p.moralePct} />
                  </td>
                  <td className="hm-text-muted">{getPlayerContract(career, p.id)?.contractEndDate ?? "—"}</td>
                  <td className="hm-table-num">{marketValue !== undefined ? formatEur(marketValue) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Förstaval"
      ? "positive"
      : status === "Skadad" || status === "Avstängd" || status === "Under rehab"
        ? "negative"
        : status === "Ungdom" || status === "Begränsad"
          ? "warning"
          : "neutral";
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
