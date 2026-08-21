"use client";

import { useState } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { buildOurTeamViewModel } from "@/lib/analysis/viewModels";
import { fmtMissing, fmtNum, fmtPct } from "@/lib/analysis/format";
import type { AnalysisWindow } from "@/lib/analysis/types";
import { InterpretationsList, ObservedPatternsList } from "@/components/analysis/EvidenceLists";
import FormDots from "@/components/FormDots";

export default function AnalysisOurTeamPage() {
  const { career } = useCareer();
  const [window, setWindow] = useState<AnalysisWindow>("LAST_5");
  const vm = buildOurTeamViewModel(career, window);

  if (vm.status !== "OK") {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">{fmtMissing(vm.status)}</div>
      </div>
    );
  }

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">{vm.club.name} — Our Team</span>
          <div style={{ display: "flex", gap: 6 }}>
            {(["LAST_5", "SEASON"] as const).map((w) => (
              <button
                key={w}
                type="button"
                className="hm-btn hm-btn-sm"
                style={{
                  background: window === w ? "var(--hm-accent)" : undefined,
                  borderColor: window === w ? "var(--hm-accent)" : undefined,
                  color: window === w ? "#fff" : undefined,
                }}
                onClick={() => setWindow(w)}
              >
                {w === "LAST_5" ? "LAST 5" : "SEASON"}
              </button>
            ))}
          </div>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <FormDots results={vm.form ?? []} />
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
            Goal difference: {vm.goalDifference !== undefined && vm.goalDifference >= 0 ? "+" : ""}
            {vm.goalDifference}
          </span>
        </div>
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Attack</span>
          </div>
          <div className="hm-panel-body">
            <MetricRows
              rows={[
                ["Goals/match", fmtNum(vm.attack?.goalsPerMatch)],
                ["Shots/match", fmtNum(vm.attack?.shotsPerMatch)],
                ["Shooting %", fmtPct(vm.attack?.shootingPct)],
                ["Turnovers/match", fmtNum(vm.attack?.turnoversPerMatch)],
                ["7m conversion", fmtPct(vm.attack?.sevenMetreConversion)],
                ["First-half goals", String(vm.attack?.firstHalfGoals ?? "—")],
                ["Second-half goals", String(vm.attack?.secondHalfGoals ?? "—")],
              ]}
            />
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Defence</span>
          </div>
          <div className="hm-panel-body">
            <MetricRows
              rows={[
                ["Goals conceded/match", fmtNum(vm.defence?.goalsConcededPerMatch)],
                ["GK saves/match", fmtNum(vm.defence?.savesPerMatch)],
                ["GK save %", fmtPct(vm.defence?.savePct)],
                ["2 min/match", fmtNum(vm.defence?.twoMinPerMatch)],
              ]}
            />
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Players</span>
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="hm-table-num">Apps</th>
                <th className="hm-table-num">Goals</th>
                <th className="hm-table-num">Goals/Match</th>
                <th className="hm-table-num">Avg Rating</th>
              </tr>
            </thead>
            <tbody>
              {vm.players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="hm-text-muted">
                    No player appearances yet.
                  </td>
                </tr>
              ) : (
                vm.players.map((p) => (
                  <tr key={p.playerId}>
                    <td className="hm-td-strong">{p.name}</td>
                    <td>{p.position}</td>
                    <td className="hm-table-num">{p.appearances}</td>
                    <td className="hm-table-num">{p.goals}</td>
                    <td className="hm-table-num">{fmtNum(p.goalsPerMatch, 2)}</td>
                    <td className="hm-table-num">{p.averageRating > 0 ? p.averageRating.toFixed(1) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Goalkeepers</span>
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="hm-table-num">Apps</th>
                <th className="hm-table-num">Saves</th>
                <th className="hm-table-num">Shots Faced</th>
                <th className="hm-table-num">Save %</th>
                <th className="hm-table-num">Saves/Match</th>
              </tr>
            </thead>
            <tbody>
              {vm.goalkeepers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="hm-text-muted">
                    No goalkeeper appearances yet.
                  </td>
                </tr>
              ) : (
                vm.goalkeepers.map((gk) => (
                  <tr key={gk.playerId}>
                    <td className="hm-td-strong">{gk.name}</td>
                    <td className="hm-table-num">{gk.appearances}</td>
                    <td className="hm-table-num">{gk.saves}</td>
                    <td className="hm-table-num">{gk.shotsFaced}</td>
                    <td className="hm-table-num">{fmtPct(gk.savePct)}</td>
                    <td className="hm-table-num">{fmtNum(gk.savesPerMatch)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Recent Patterns</span>
          </div>
          <div className="hm-panel-body">
            <ObservedPatternsList patterns={vm.patterns} />
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Interpretation</span>
          </div>
          <div className="hm-panel-body">
            <InterpretationsList interpretations={vm.interpretations} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRows({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
          <span className="hm-text-muted">{label}</span>
          <span style={{ fontWeight: 700 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}
