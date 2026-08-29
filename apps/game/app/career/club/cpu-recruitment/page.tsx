"use client";

// HM-CPU-SQUAD-BUILDING-1.0: a small debug/explainability view -- "why
// did this CPU club do what it did". Not a big new surface (Part:
// "Normal UI behöver inte en ny stor sida"), just a club picker plus the
// same squad-need assessment and decision log the recruitment engine
// itself produces, read directly off CareerState.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClubsByCompetition } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { assessSquadNeeds } from "@/lib/career/cpuSquadNeeds";
import { getCpuDecisionLogForClub, getCpuRecruitmentPlansForClub } from "@/lib/career/cpuRecruitment";

const NEED_TONE: Record<string, "positive" | "neutral" | "warning" | "negative"> = { NONE: "positive", LOW: "neutral", MEDIUM: "warning", HIGH: "negative" };

export default function CpuRecruitmentDebugPage() {
  const router = useRouter();
  const { career } = useCareer();
  const rivalClubs = getClubsByCompetition(career.competitionId).filter((c) => c.id !== career.playerClubId);
  const [clubId, setClubId] = useState(rivalClubs[0]?.id ?? "");

  const assessment = clubId ? assessSquadNeeds(career, clubId, career.gameDate) : null;
  const plans = clubId ? getCpuRecruitmentPlansForClub(career, clubId) : [];
  const log = clubId ? getCpuDecisionLogForClub(career, clubId, 30) : [];

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">CPU-rekrytering (debug)</span>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => router.push("/career/club")}>
            ← Klubb
          </button>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="hm-text-xs hm-text-muted">Klubb:</span>
          <select className="hm-select" value={clubId} onChange={(e) => setClubId(e.target.value)}>
            {rivalClubs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {assessment ? (
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Positionsbehov</span>
          </div>
          <table className="hm-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Behov</th>
                <th>Spelare</th>
                <th>Motivering</th>
              </tr>
            </thead>
            <tbody>
              {assessment.positions.map((p) => (
                <tr key={p.position}>
                  <td className="hm-td-strong">{p.position}</td>
                  <td>
                    <span className={`hm-badge hm-badge-${NEED_TONE[p.level]}`}>{p.level}</span>
                  </td>
                  <td>{p.usableCount}</td>
                  <td className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Aktiva/senaste pursuits</span>
        </div>
        {plans.length === 0 ? (
          <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>Ingen aktiv rekrytering just nu.</div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Behov</th>
                <th>Status</th>
                <th>Kandidat</th>
                <th>Senast utvärderad</th>
                <th>Motivering</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="hm-td-strong">{p.targetPosition}</td>
                  <td>{p.need}</td>
                  <td>{p.status}</td>
                  <td>{p.candidatePlayerId ?? "—"}</td>
                  <td>{p.lastEvaluatedAt}</td>
                  <td className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Beslutslogg</span>
        </div>
        {log.length === 0 ? (
          <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>Inga loggade beslut ännu.</div>
        ) : (
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {log.map((entry) => (
              <div key={entry.id} style={{ fontSize: "var(--hm-text-xs)" }}>
                <span className="hm-text-muted">{entry.date} · </span>
                <span className="hm-td-strong">{entry.summary}</span>
                <div className="hm-text-muted">{entry.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
