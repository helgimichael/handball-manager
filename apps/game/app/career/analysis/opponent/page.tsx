"use client";

import { useCareer } from "@/lib/career/CareerContext";
import { buildOpponentViewModel } from "@/lib/analysis/viewModels";
import { fmtMissing, fmtNum, fmtPct } from "@/lib/analysis/format";
import { InterpretationsList, MissingDataNote, ObservedPatternsList } from "@/components/analysis/EvidenceLists";
import ClubCrest from "@/components/ClubCrest";
import FormDots from "@/components/FormDots";
import { getClub } from "@/lib/game-data";
import type { Evidence } from "@/lib/analysis/types";

function leaguePositionLabel(position: Evidence<number> | undefined): string {
  if (!position) return fmtMissing("NOT_AVAILABLE_YET");
  return position.ok ? `${position.value}. plats` : fmtMissing(position.state);
}

export default function AnalysisOpponentPage() {
  const { career } = useCareer();
  const vm = buildOpponentViewModel(career);

  if (vm.status !== "OK" || !vm.club) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">No upcoming fixture to analyze -- the season may be complete.</div>
      </div>
    );
  }

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ClubCrest shortName={vm.club.shortName} primaryColor={vm.club.primaryColor} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{vm.club.name} — Next Opponent</div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              {vm.competitionName} · {leaguePositionLabel(vm.leaguePosition)}
              {vm.nextFixture?.ok ? ` · ${vm.nextFixture.value.date} · ${vm.nextFixture.value.isHome ? "Home" : "Away"}` : ""}
            </div>
          </div>
          <FormDots results={vm.form ?? []} />
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Recent Matches</span>
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opponent</th>
                <th>H/A</th>
                <th>Result</th>
                <th className="hm-table-num">GF</th>
                <th className="hm-table-num">GA</th>
              </tr>
            </thead>
            <tbody>
              {(vm.recentMatches ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="hm-text-muted">
                    No completed matches yet.
                  </td>
                </tr>
              ) : (
                [...(vm.recentMatches ?? [])].reverse().map((row) => {
                  const opp = getClub(row.opponentClubId);
                  return (
                    <tr key={row.fixtureId}>
                      <td>{row.date}</td>
                      <td>{opp?.name ?? row.opponentClubId}</td>
                      <td>{row.isHome ? "H" : "A"}</td>
                      <td>{row.result}</td>
                      <td className="hm-table-num">{row.goalsFor}</td>
                      <td className="hm-table-num">{row.goalsAgainst}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Attack (last 5)</span>
          </div>
          <div className="hm-panel-body">
            {vm.attack ? (
              <MetricRows
                rows={[
                  ["Goals/match", fmtNum(vm.attack.goalsPerMatch)],
                  ["Shots/match", fmtNum(vm.attack.shotsPerMatch)],
                  ["Shooting %", fmtPct(vm.attack.shootingPct)],
                  ["Turnovers/match", fmtNum(vm.attack.turnoversPerMatch)],
                  ["7m conversion", fmtPct(vm.attack.sevenMetreConversion)],
                ]}
              />
            ) : (
              <MissingDataNote text={fmtMissing("NO_MATCHES_YET")} />
            )}
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Defence (last 5)</span>
          </div>
          <div className="hm-panel-body">
            {vm.defence ? (
              <MetricRows
                rows={[
                  ["Goals conceded/match", fmtNum(vm.defence.goalsConcededPerMatch)],
                  ["GK save %", fmtPct(vm.defence.savePct)],
                  ["Saves/match", fmtNum(vm.defence.savesPerMatch)],
                  ["2 min/match", fmtNum(vm.defence.twoMinPerMatch)],
                ]}
              />
            ) : (
              <MissingDataNote text={fmtMissing("NO_MATCHES_YET")} />
            )}
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Player Production</span>
        </div>
        <div className="hm-panel-body">
          <MissingDataNote text={fmtMissing("NOT_AVAILABLE_YET")} />
        </div>
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Observed Patterns</span>
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
