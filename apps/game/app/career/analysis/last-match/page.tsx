"use client";

import { useState } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { buildLastMatchViewModel } from "@/lib/analysis/viewModels";
import { fmtMissing, fmtPct } from "@/lib/analysis/format";
import { InterpretationsList, MissingDataNote, ObservedPatternsList } from "@/components/analysis/EvidenceLists";
import ClubCrest from "@/components/ClubCrest";
import type { MatchEvent, MatchEventType } from "@handball-manager/game-simulation";

const TIMELINE_FILTERS: { label: string; types: MatchEventType[] | null }[] = [
  { label: "ALL", types: null },
  { label: "GOALS", types: ["GOAL"] },
  { label: "SAVES", types: ["SAVE"] },
  { label: "TURNOVERS", types: ["TURNOVER"] },
  { label: "2 MIN", types: ["TWO_MIN"] },
  { label: "7M", types: ["SEVEN_M"] },
];

export default function AnalysisLastMatchPage() {
  const { career } = useCareer();
  const vm = buildLastMatchViewModel(career);
  const [filterIdx, setFilterIdx] = useState(0);

  if (vm.status !== "OK" || !vm.homeClub || !vm.awayClub) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">{fmtMissing("NO_MATCHES_YET")}</div>
      </div>
    );
  }

  const filter = TIMELINE_FILTERS[filterIdx];
  const filteredEvents: readonly MatchEvent[] = (vm.timeline ?? []).filter((e) => !filter.types || filter.types.includes(e.type));

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "20px" }}>
          <TeamBlock club={vm.homeClub} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--hm-text-2xl)", fontWeight: 800 }}>
              {vm.homeGoals} – {vm.awayGoals}
            </div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              {vm.competitionName} · {vm.date}
            </div>
          </div>
          <TeamBlock club={vm.awayClub} />
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Team Comparison</span>
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="hm-table-num">{vm.isPlayerHome ? vm.homeClub.shortName : vm.awayClub.shortName} (Us)</th>
                <th className="hm-table-num">Opponent</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Goals" us={vm.teamComparison!.us.goals} opp={vm.teamComparison!.opponent.goals} />
              <Row label="Shots" us={vm.teamComparison!.us.shots} opp={vm.teamComparison!.opponent.shots} />
              <Row label="Shooting %" us={fmtPct(vm.teamComparison!.us.shots > 0 ? vm.teamComparison!.us.goals / vm.teamComparison!.us.shots : null)} opp={fmtPct(vm.teamComparison!.opponent.shots > 0 ? vm.teamComparison!.opponent.goals / vm.teamComparison!.opponent.shots : null)} />
              <Row label="Saves" us={vm.teamComparison!.us.saves} opp={vm.teamComparison!.opponent.saves} />
              <Row label="Save %" us={fmtPct(vm.teamComparison!.us.shotsFaced > 0 ? vm.teamComparison!.us.saves / vm.teamComparison!.us.shotsFaced : null)} opp={fmtPct(vm.teamComparison!.opponent.shotsFaced > 0 ? vm.teamComparison!.opponent.saves / vm.teamComparison!.opponent.shotsFaced : null)} />
              <Row label="Turnovers" us={vm.teamComparison!.us.turnovers} opp={vm.teamComparison!.opponent.turnovers} />
              <Row label="2 min" us={vm.teamComparison!.us.twoMinuteSuspensions} opp={vm.teamComparison!.opponent.twoMinuteSuspensions} />
              <Row label="7m" us={`${vm.teamComparison!.us.sevenMetreGoals}/${vm.teamComparison!.us.sevenMetreAttempts}`} opp={`${vm.teamComparison!.opponent.sevenMetreGoals}/${vm.teamComparison!.opponent.sevenMetreAttempts}`} />
            </tbody>
          </table>
        </div>
      </div>

      <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">First Half</span>
          </div>
          <div className="hm-panel-body">
            <MetricRows
              rows={[
                ["Goals (us)", String(vm.isPlayerHome ? vm.halfSplit!.firstHalf.home.goals : vm.halfSplit!.firstHalf.away.goals)],
                ["Goals (opp)", String(vm.isPlayerHome ? vm.halfSplit!.firstHalf.away.goals : vm.halfSplit!.firstHalf.home.goals)],
              ]}
            />
          </div>
        </div>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Second Half</span>
          </div>
          <div className="hm-panel-body">
            <MetricRows
              rows={[
                ["Goals (us)", String(vm.isPlayerHome ? vm.halfSplit!.secondHalf.home.goals : vm.halfSplit!.secondHalf.away.goals)],
                ["Goals (opp)", String(vm.isPlayerHome ? vm.halfSplit!.secondHalf.away.goals : vm.halfSplit!.secondHalf.home.goals)],
              ]}
            />
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Key Scoring Runs</span>
        </div>
        <div className="hm-panel-body">
          {(vm.scoringRuns ?? []).length === 0 ? (
            <MissingDataNote text="No scoring run of 3 or more reached this match." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {vm.scoringRuns!.map((run, i) => {
                const runClub = run.side === "home" ? vm.homeClub! : vm.awayClub!;
                return (
                  <li key={i} style={{ fontSize: "var(--hm-text-xs)", fontFamily: "var(--hm-font-mono, monospace)" }}>
                    {run.startMinute}&apos;–{run.endMinute}&apos; &nbsp; {runClub.name} &nbsp; {run.goals}–0 run &nbsp;
                    <span className="hm-text-muted">(score {run.scoreAfter.home}–{run.scoreAfter.away})</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Player Production</span>
        </div>
        <div className="hm-scroll-x">
          {vm.ownPlayerProduction.ok ? (
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="hm-table-num">Goals</th>
                  <th className="hm-table-num">Shots</th>
                  <th className="hm-table-num">Rating</th>
                </tr>
              </thead>
              <tbody>
                {vm.ownPlayerProduction.value.map((c) => (
                  <tr key={c.playerId}>
                    <td>{(() => {
                      const p = getCareerPlayer(career, c.playerId);
                      return p ? `${p.firstName} ${p.lastName}` : c.playerId;
                    })()}</td>
                    <td className="hm-table-num">{c.goals}</td>
                    <td className="hm-table-num">{c.shots}</td>
                    <td className="hm-table-num">{c.rating.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <MissingDataNote text={fmtMissing(vm.ownPlayerProduction.ok === false ? vm.ownPlayerProduction.state : "NOT_AVAILABLE_YET")} />
          )}
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Event Timeline</span>
          <div style={{ display: "flex", gap: 4 }}>
            {TIMELINE_FILTERS.map((f, i) => (
              <button
                key={f.label}
                type="button"
                className="hm-btn hm-btn-sm"
                style={{
                  background: filterIdx === i ? "var(--hm-accent)" : undefined,
                  borderColor: filterIdx === i ? "var(--hm-accent)" : undefined,
                  color: filterIdx === i ? "#fff" : undefined,
                  fontSize: "var(--hm-text-2xs)",
                }}
                onClick={() => setFilterIdx(i)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hm-panel-body" style={{ maxHeight: 320, overflowY: "auto" }}>
          {filteredEvents.length === 0 ? (
            <MissingDataNote text="No events of this type occurred." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {filteredEvents.map((e, i) => (
                <li key={i} style={{ fontSize: "var(--hm-text-2xs)", display: "flex", gap: 8 }}>
                  <span className="hm-text-muted" style={{ width: 32 }}>
                    {e.minute}&apos;
                  </span>
                  <span>
                    {e.type} — {e.side === "home" ? vm.homeClub!.shortName : vm.awayClub!.shortName}
                    {e.type === "GOAL" ? ` (${e.homeScoreAfter}–${e.awayScoreAfter})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
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

function TeamBlock({ club }: { club: { name: string; shortName: string; primaryColor: string } }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 100 }}>
      <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={36} />
      <div style={{ fontSize: "var(--hm-text-2xs)", fontWeight: 700, textAlign: "center" }}>{club.name}</div>
    </div>
  );
}

function Row({ label, us, opp }: { label: string; us: number | string; opp: number | string }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="hm-table-num hm-td-strong">{us}</td>
      <td className="hm-table-num">{opp}</td>
    </tr>
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
