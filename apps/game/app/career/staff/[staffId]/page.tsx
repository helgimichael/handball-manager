"use client";

// HM-STAFF-CAREER-1.0: a real staff profile -- name, current club, role(s),
// relevant attributes, contract/wage/employment status, role suitability,
// career-tracked club history, and (for a recruitable external candidate)
// an inline recruitment offer form. Reachable for ANY club's staff, not
// only the manager's own (Part 1: "All staff i alla klubbar ska vara
// klickbar").
import { useState, type CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { findStaffMember } from "@/lib/staff/staffCareerIntegration";
import { isStaffRecruitable } from "@/lib/staff/staffRecruitment";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { ROLE_ATTRIBUTE_WEIGHTS } from "@/lib/staff/roleAttributeMap";
import { STAFF_ATTRIBUTE_LABEL, STAFF_EMPLOYMENT_TYPE_LABEL, STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { STAFF_ATTRIBUTES } from "@/lib/staff/types";
import { formatEur } from "@/lib/economy/currency";
import { mondayOf, resolveTrainingWeek } from "@/lib/training/trainingSchedule";
import { resolveResponsibleCoach } from "@/lib/staff/roleSuitability";
import StarRating from "@/components/StarRating";
import { ClubLink } from "@/components/entityLinks";

const SESSION_TYPE_LABEL: Record<string, string> = {
  TEAM_TACTICAL: "Lagtaktik",
  ATTACK: "Anfallsspel",
  DEFENCE: "Försvarsspel",
  TRANSITION: "Omställning",
  SPECIAL_PLAY: "Specialspel",
  TECHNICAL: "Teknik",
  PHYSICAL: "Fysik",
  STRENGTH: "Styrka",
  CONDITIONING: "Kondition",
  GOALKEEPER: "Målvakt",
  MATCH_PREPARATION: "Matchförberedelse",
  RECOVERY: "Återhämtning",
};

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function StaffProfilePage() {
  const router = useRouter();
  const params = useParams<{ staffId: string }>();
  const searchParams = useSearchParams();
  const { career, offerStaffContract } = useCareer();
  const member = findStaffMember(career, params.staffId);

  if (!member) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Personen hittades inte.</div>
      </div>
    );
  }

  const club = getClub(member.clubId);
  const employment = career.staffEmployment[member.id];
  const isOwnClub = member.clubId === career.playerClubId;
  const backHref = searchParams.get("from") === "recruitment" ? "/career/staff/recruitment" : isOwnClub ? "/career/staff" : `/career/clubs/${member.clubId}`;
  const history = career.staffClubHistory[member.id];
  const recruitable = !isOwnClub && isStaffRecruitable(career, member.id);

  const weekStart = mondayOf(career.gameDate);
  const week = isOwnClub ? resolveTrainingWeek(career, weekStart) : null;
  const roster = career.staffRoster[career.playerClubId] ?? [];
  const responsibilities = week
    ? week.days.flatMap((day) =>
        day.sessions
          .filter((session) => resolveResponsibleCoach(roster, session.type, session.coachId ?? null)?.id === member.id)
          .map((session) => ({ date: day.date, type: session.type })),
      )
    : [];

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
      <div className="hm-grid" style={{ gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>{member.displayName}</div>
              <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)", marginTop: 2 }}>
                {member.roles.length > 0 ? member.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (member.officialRoleLabel ?? "—")}
                {" · "}
                {club ? <ClubLink clubId={club.id}>{club.name}</ClubLink> : member.clubId}
              </div>
            </div>
            <button type="button" className="hm-btn" onClick={() => router.push(backHref)}>
              ← Tillbaka
            </button>
          </div>
        </div>

        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Egenskaper</span>
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              {member.source === "REAL_WORLD_IDENTITY" ? "Namn/roll från klubbdata — egenskaper genererade" : "Genererad personal"}
            </span>
          </div>
          <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {STAFF_ATTRIBUTES.map((attr) => {
              const isRelevant = member.roles.some((r) => attr in ROLE_ATTRIBUTE_WEIGHTS[r]);
              return (
                <div key={attr} className="hm-stat-row" style={{ opacity: isRelevant ? 1 : 0.5 }}>
                  <span className="hm-stat-label">{STAFF_ATTRIBUTE_LABEL[attr]}</span>
                  <span style={{ fontWeight: 700 }}>{member.profile.attributes[attr].value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {member.roles.length > 0 ? (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Lämplighet för rollen</span>
            </div>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {member.roles.map((role) => (
                <div key={role} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>{STAFF_ROLE_LABEL[role]}</span>
                  <StarRating stars={roleSuitabilityStars(computeRoleSuitability(member, role))} title="Tränarstabens bedömning av lämplighet för rollen" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {history && history.entries.length > 0 ? (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Klubbhistorik (denna karriär)</span>
            </div>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.entries.map((entry, i) => (
                <ContractRow key={i} label={getClub(entry.clubId)?.name ?? entry.clubId} value={entry.toDate ? `${entry.fromDate} – ${entry.toDate}` : `${entry.fromDate} – pågående`} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="hm-grid" style={{ gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Anställning</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractRow label="Status" value={employment ? STAFF_EMPLOYMENT_TYPE_LABEL[employment.employmentType] : "—"} />
            {employment?.employmentType === "SALARIED" ? (
              <>
                <ContractRow label="Lön / månad" value={employment.wageEurPerMonth !== undefined ? formatEur(employment.wageEurPerMonth) : "—"} />
                <ContractRow label="Kontrakt t.o.m." value={employment.contractEndDate ?? "—"} />
              </>
            ) : (
              <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
                Ingen ordinarie anställning eller lön registrerad för denna roll.
              </p>
            )}
          </div>
        </div>

        {recruitable ? <RecruitmentPanel staffId={member.id} candidateWageHint={employment?.wageEurPerMonth} offerStaffContract={offerStaffContract} /> : null}

        {isOwnClub ? (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Aktuellt träningsansvar</span>
            </div>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {responsibilities.length === 0 ? (
                <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
                  Inget träningspass denna vecka.
                </p>
              ) : (
                responsibilities.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
                    <span className="hm-text-muted">{r.date}</span>
                    <span style={{ fontWeight: 600 }}>{SESSION_TYPE_LABEL[r.type] ?? r.type}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--hm-surface-2)",
  border: "1px solid var(--hm-border)",
  borderRadius: "var(--hm-radius-sm)",
  color: "var(--hm-text-primary)",
  padding: "7px 10px",
  fontSize: "var(--hm-text-xs)",
};

function RecruitmentPanel({
  staffId,
  candidateWageHint,
  offerStaffContract,
}: {
  staffId: string;
  candidateWageHint: number | undefined;
  offerStaffContract: ReturnType<typeof useCareer>["offerStaffContract"];
}) {
  const { career } = useCareer();
  const [wage, setWage] = useState(String(candidateWageHint ?? 1000));
  const [outcome, setOutcome] = useState<{ accepted: boolean; reason: string } | null>(null);

  function submit() {
    const offeredWageEurPerMonth = Math.max(0, Math.round(Number(wage) || 0));
    const result = offerStaffContract({ staffId, toClubId: career.playerClubId, offeredWageEurPerMonth });
    setOutcome({ accepted: result.outcome === "COMPLETED", reason: result.reason });
  }

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Rekrytera</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="hm-text-secondary" style={{ fontSize: "var(--hm-text-xs)" }}>
          Erbjuden lön / månad (€)
          <input type="number" min={0} step={50} value={wage} onChange={(e) => setWage(e.target.value)} style={{ ...inputStyle, display: "block", marginTop: 4, width: "100%" }} />
        </label>
        <button type="button" className="hm-btn hm-btn-primary" onClick={submit}>
          Erbjud kontrakt
        </button>
        {outcome ? (
          <p className={outcome.accepted ? "hm-text-positive" : "hm-text-muted"} style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
            {outcome.accepted ? "Klart! " : "Avvisat. "}
            {outcome.reason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
