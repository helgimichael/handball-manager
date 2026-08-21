"use client";

import { COMPETITIONS, TUMBA_STAFF } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { getPlayerClubPosition } from "@/lib/career/standings";
import ClubCrest from "@/components/ClubCrest";

export default function ClubPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const position = getPlayerClubPosition(career);
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Klubböversikt</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 16 }}>
          <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={56} />
          <div>
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{club.name}</div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              {competitionName} · {club.city} · Grundad {club.founded ?? "—"}
            </div>
          </div>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 28 }}>
          <MiniStat label="Tabellplacering" value={`${position}:a`} />
          <MiniStat label="Trupp" value={squad.length} />
          <MiniStat label="Arena" value={club.venue ?? "—"} />
          <MiniStat label="Personal" value={TUMBA_STAFF.length} />
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Ekonomi</span>
          <span className="hm-badge hm-badge-neutral">Platshållare</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FinanceRow label="Balans" value="4 250 000 kr" />
          <FinanceRow label="Transferbudget" value="1 800 000 kr" />
          <FinanceRow label="Lönebudget / månad" value="612 000 kr" />
          <FinanceRow label="Nuvarande löner / månad" value="587 500 kr" />
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingTop: 0 }}>
          Fiktiva siffror — ingen ekonomimotor implementerad ännu.
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Anläggningar</span>
          <span className="hm-badge hm-badge-neutral">Platshållare</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FinanceRow label="Träningsanläggning" value="★★★☆☆" />
          <FinanceRow label="Ungdomsakademi" value="★★★★☆" />
          <FinanceRow label="Medicinskt center" value="★★★☆☆" />
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Historik</span>
          <span className="hm-badge hm-badge-neutral">Platshållare</span>
        </div>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
          Klubbhistorik kommer i en senare version.
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function FinanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
