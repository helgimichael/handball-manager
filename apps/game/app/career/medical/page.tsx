"use client";

// HM-INJURIES-1.0 Part 32: a simple, compact medical workspace -- every
// injured player, their injury, severity, status, estimated return,
// rehab progress, plus the club's own resolved medical staff quality.
// No full medical center (Part 32/48).
import Link from "next/link";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { resolveStatusLabel } from "@/lib/career/playerStatus";
import { computeMedicalRehabQuality, findBestPhysio } from "@/lib/medical/medicalStaffQuality";
import { INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS, REHAB_PHASE_LABELS } from "@/lib/medical/labels";

export default function MedicalPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const roster = career.staffRoster[career.playerClubId] ?? [];
  const physio = findBestPhysio(roster);
  const medicalQuality = computeMedicalRehabQuality(roster);

  const injuredPlayers = squad
    .map((p) => ({ player: p, injuryState: career.playerInjuries[p.id] }))
    .filter((entry) => entry.injuryState?.activeInjury);

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Medicinsk avdelning — {club.name}</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 28 }}>
          <div>
            <div className="hm-eyebrow">Ansvarig fysio</div>
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{physio?.displayName ?? "Ingen"}</div>
          </div>
          <div>
            <div className="hm-eyebrow">Rehabkvalitet</div>
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{medicalQuality.toFixed(2)}x</div>
          </div>
          <div>
            <div className="hm-eyebrow">Skadade spelare</div>
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{injuredPlayers.length}</div>
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Aktiva skador</span>
        </div>
        {injuredPlayers.length === 0 ? (
          <div className="hm-panel-body hm-text-muted">Inga aktiva skador i truppen.</div>
        ) : (
          <div className="hm-scroll-x">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Spelare</th>
                  <th>Skada</th>
                  <th>Allvarlighetsgrad</th>
                  <th>Status</th>
                  <th>Rehabfas</th>
                  <th className="hm-table-num">Rehabframsteg</th>
                  <th>Beräknad återkomst</th>
                </tr>
              </thead>
              <tbody>
                {injuredPlayers.map(({ player, injuryState }) => {
                  const injury = injuryState!.activeInjury!;
                  return (
                    <tr key={player.id} data-clickable="true">
                      <td className="hm-td-strong">
                        <Link href={`/career/squad/${player.id}`}>
                          {player.firstName} {player.lastName}
                        </Link>
                      </td>
                      <td>{INJURY_TYPE_LABELS[injury.injuryType]}</td>
                      <td>{INJURY_SEVERITY_LABELS[injury.severity]}</td>
                      <td>
                        <span className="hm-badge hm-badge-negative">{resolveStatusLabel(career.playerStatuses, player)}</span>
                      </td>
                      <td>{REHAB_PHASE_LABELS[injury.currentPhase]}</td>
                      <td className="hm-table-num">{Math.round(injury.rehabProgress * 100)}%</td>
                      <td className="hm-text-muted">{injury.expectedReturnDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
