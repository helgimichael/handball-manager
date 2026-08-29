"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { playerAge, positionLabel } from "@/lib/game-data";
import type { HandballPosition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { averageRating, emptyPlayerSeasonStats } from "@/lib/career/types";
import { resolveStatusLabel } from "@/lib/career/playerStatus";
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "@/lib/career/squadStatus";
import { REHAB_PHASE_LABELS } from "@/lib/medical/labels";
import { getPlayerContract, getPlayerMarketValueEur } from "@/lib/economy/contractIntegration";
import { formatEur } from "@/lib/economy/currency";
import { SortableTh, applySortDirection, type SortState } from "@/components/SortableTh";

type SortKey = "name" | "position" | "age" | "status" | "appearances" | "goals" | "rating" | "fitness" | "morale" | "contract" | "value";

const SQUAD_STATUS_RANK: Record<SquadStatusTier, number> = { KEY_PLAYER: 0, FIRST_CHOICE: 1, ROTATION: 2, SQUAD_PLAYER: 3, TALENT: 4 };

export default function SquadPage() {
  const router = useRouter();
  const { career, updateSquadStatus } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const [positionFilter, setPositionFilter] = useState<HandballPosition | "ALL">("ALL");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "position", direction: "asc" });

  const positions: (HandballPosition | "ALL")[] = ["ALL", "MV", "V9", "V6", "M9", "M6", "H9", "H6"];

  const rows = useMemo(() => {
    const filtered = positionFilter === "ALL" ? squad : squad.filter((p) => p.position === positionFilter);
    return [...filtered].sort((a, b) => {
      const statsA = career.playerSeasonStats[a.id] ?? emptyPlayerSeasonStats(a.id);
      const statsB = career.playerSeasonStats[b.id] ?? emptyPlayerSeasonStats(b.id);
      let cmp: number;
      switch (sort.key) {
        case "name":
          cmp = a.lastName.localeCompare(b.lastName);
          break;
        case "age":
          cmp = (playerAge(a.dateOfBirth, a.birthYear) ?? 0) - (playerAge(b.dateOfBirth, b.birthYear) ?? 0);
          break;
        case "status":
          cmp = (SQUAD_STATUS_RANK[career.playerSquadStatus[a.id]] ?? 9) - (SQUAD_STATUS_RANK[career.playerSquadStatus[b.id]] ?? 9);
          break;
        case "appearances":
          cmp = statsA.appearances - statsB.appearances;
          break;
        case "goals":
          cmp = statsA.goals - statsB.goals;
          break;
        case "rating":
          cmp = averageRating(statsA) - averageRating(statsB);
          break;
        case "fitness":
          cmp = a.fitnessPct - b.fitnessPct;
          break;
        case "morale":
          cmp = a.moralePct - b.moralePct;
          break;
        case "contract":
          cmp = (getPlayerContract(career, a.id)?.contractEndDate ?? "").localeCompare(getPlayerContract(career, b.id)?.contractEndDate ?? "");
          break;
        case "value":
          cmp = (getPlayerMarketValueEur(career, a.id) ?? 0) - (getPlayerMarketValueEur(career, b.id) ?? 0);
          break;
        default:
          cmp = a.position.localeCompare(b.position);
      }
      return applySortDirection(sort.direction, cmp);
    });
  }, [squad, positionFilter, sort, career]);

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
              <SortableTh label="Spelare" sortKey="name" sort={sort} onSort={setSort} />
              <SortableTh label="Pos" sortKey="position" sort={sort} onSort={setSort} />
              <SortableTh label="Ålder" sortKey="age" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
              <SortableTh label="Status" sortKey="status" sort={sort} onSort={setSort} />
              <SortableTh label="M" sortKey="appearances" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
              <SortableTh label="Mål" sortKey="goals" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
              <SortableTh label="Snittbetyg" sortKey="rating" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
              <SortableTh label="Fitness" sortKey="fitness" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
              <SortableTh label="Moral" sortKey="morale" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
              <SortableTh label="Kontrakt t.o.m." sortKey="contract" sort={sort} onSort={setSort} />
              <SortableTh label="Värde" sortKey="value" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const stats = career.playerSeasonStats[p.id] ?? emptyPlayerSeasonStats(p.id);
              const marketValue = getPlayerMarketValueEur(career, p.id);
              const availabilityLabel = resolveStatusLabel(career.playerStatuses, p);
              const isUnavailable = availabilityLabel === "Skadad" || availabilityLabel === "Avstängd" || availabilityLabel === "Under rehab" || availabilityLabel === "Utplacerad hos partnerklubb";
              const tier = career.playerSquadStatus[p.id];
              return (
                <tr key={p.id}>
                  <td onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    <span className="hm-shirt-number">{p.shirtNumber ?? "–"}</span>
                  </td>
                  <td className="hm-td-strong" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {p.firstName} {p.lastName}
                  </td>
                  <td title={positionLabel(p.position)} onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {p.position}
                  </td>
                  <td onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {playerAge(p.dateOfBirth, p.birthYear) ?? "–"}
                  </td>
                  <td>
                    {/* HM-DATA-ALLSVENSKAN-1.1B Part 3: the manager's own
                        editable, persistent squad-role tier -- separate
                        from MatchUsage and from live medical/discipline
                        availability (shown as a small secondary note
                        below when relevant, never blended into this dropdown). */}
                    <select
                      className="hm-select"
                      value={tier ?? "ROTATION"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateSquadStatus(p.id, e.target.value as SquadStatusTier)}
                    >
                      {SQUAD_STATUS_TIERS.map((t) => (
                        <option key={t} value={t}>
                          {SQUAD_STATUS_TIER_LABEL_SV[t]}
                        </option>
                      ))}
                    </select>
                    {isUnavailable ? (
                      <div style={{ marginTop: 2 }}>
                        <span className={`hm-badge ${availabilityLabel === "Utplacerad hos partnerklubb" ? "hm-badge-neutral" : "hm-badge-negative"}`}>{availabilityLabel}</span>
                        {career.playerInjuries[p.id]?.activeInjury ? (
                          <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", marginTop: 2 }}>
                            {REHAB_PHASE_LABELS[career.playerInjuries[p.id]!.activeInjury!.currentPhase]} · åter {career.playerInjuries[p.id]!.activeInjury!.expectedReturnDate}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="hm-table-num" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {stats.appearances}
                  </td>
                  <td className="hm-table-num" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {stats.goals}
                  </td>
                  <td className="hm-table-num" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {stats.appearances > 0 ? averageRating(stats).toFixed(1) : "—"}
                  </td>
                  <td className="hm-table-num" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    <Bar pct={p.fitnessPct} />
                  </td>
                  <td className="hm-table-num" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    <Bar pct={p.moralePct} />
                  </td>
                  <td className="hm-text-muted" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {getPlayerContract(career, p.id)?.contractEndDate ?? "—"}
                  </td>
                  <td className="hm-table-num" onClick={() => router.push(`/career/squad/${p.id}`)} data-clickable="true">
                    {marketValue !== undefined ? formatEur(marketValue) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
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
