"use client";

import { useRouter } from "next/navigation";
import { useCareer } from "@/lib/career/CareerContext";
import { buildOverviewViewModel } from "@/lib/analysis/viewModels";
import { fmtNum } from "@/lib/analysis/format";
import { ObservedPatternsList, MissingDataNote } from "@/components/analysis/EvidenceLists";
import ClubCrest from "@/components/ClubCrest";
import FormDots from "@/components/FormDots";

export default function AnalysisOverviewPage() {
  const router = useRouter();
  const { career } = useCareer();
  const vm = buildOverviewViewModel(career);

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Next Opponent</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/analysis/opponent")}>
            Open Opponent Analysis →
          </button>
        </div>
        <div className="hm-panel-body">
          {vm.nextOpponent.ok ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ClubCrest shortName={vm.nextOpponent.value.club.shortName} primaryColor={vm.nextOpponent.value.club.primaryColor} size={32} />
              <div>
                <div style={{ fontWeight: 800 }}>{vm.nextOpponent.value.club.name}</div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                  {vm.nextOpponent.value.date} · {vm.nextOpponent.value.isHome ? "Home" : "Away"}
                </div>
                <div style={{ marginTop: 4 }}>
                  <FormDots results={vm.nextOpponent.value.form} />
                </div>
              </div>
            </div>
          ) : (
            <MissingDataNote text="No matches yet" />
          )}
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Our Form</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/analysis/our-team")}>
            Open Team Analysis →
          </button>
        </div>
        <div className="hm-panel-body">
          {vm.ourForm.ok ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FormDots results={vm.ourForm.value.form} />
              <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {fmtNum(vm.ourForm.value.goalsPerMatch)} GF/match · {fmtNum(vm.ourForm.value.goalsConcededPerMatch)} GA/match (last 5)
              </div>
            </div>
          ) : (
            <MissingDataNote text="No matches yet" />
          )}
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Last Match</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/analysis/last-match")}>
            Open Last Match →
          </button>
        </div>
        <div className="hm-panel-body">
          {vm.lastMatch.ok ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ClubCrest shortName={vm.lastMatch.value.opponent.shortName} primaryColor={vm.lastMatch.value.opponent.primaryColor} size={28} />
              <div>
                <div style={{ fontWeight: 800, fontSize: "var(--hm-text-md)" }}>
                  {vm.lastMatch.value.goalsFor}–{vm.lastMatch.value.goalsAgainst}
                </div>
                <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                  vs {vm.lastMatch.value.opponent.name} · {vm.lastMatch.value.date}
                </div>
              </div>
            </div>
          ) : (
            <MissingDataNote text="No matches yet" />
          )}
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Recent Observations</span>
        </div>
        <div className="hm-panel-body">
          <ObservedPatternsList patterns={vm.recentObservations} />
        </div>
      </div>
    </div>
  );
}
