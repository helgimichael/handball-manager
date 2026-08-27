"use client";

// HM-STAFF-1.0 Part 25: a small staff profile -- name, role, club,
// relevant attributes, provenance, and current training responsibilities.
// No salary/contract system (Part 39).
import { useParams, useRouter } from "next/navigation";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { mondayOf, resolveTrainingWeek } from "@/lib/training/trainingSchedule";
import { resolveResponsibleCoach } from "@/lib/staff/roleSuitability";
import { ROLE_ATTRIBUTE_WEIGHTS } from "@/lib/staff/roleAttributeMap";
import { STAFF_ATTRIBUTE_LABEL, STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { STAFF_ATTRIBUTES } from "@/lib/staff/types";

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

export default function StaffProfilePage() {
  const router = useRouter();
  const params = useParams<{ staffId: string }>();
  const { career } = useCareer();
  const club = getCareerClub(career);
  const roster = career.staffRoster[career.playerClubId] ?? [];
  const member = roster.find((m) => m.id === params.staffId);

  if (!member) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Personen hittades inte.</div>
      </div>
    );
  }

  const weekStart = mondayOf(career.gameDate);
  const week = resolveTrainingWeek(career, weekStart);
  const responsibilities = week.days.flatMap((day) =>
    day.sessions
      .filter((session) => resolveResponsibleCoach(roster, session.type, session.coachId ?? null)?.id === member.id)
      .map((session) => ({ date: day.date, type: session.type })),
  );

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
      <div className="hm-grid" style={{ gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--hm-text-lg)", fontWeight: 800 }}>{member.displayName}</div>
              <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)", marginTop: 2 }}>
                {member.roles.length > 0 ? member.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (member.officialRoleLabel ?? "—")} · {club.name}
              </div>
            </div>
            <button type="button" className="hm-btn" onClick={() => router.push("/career/staff")}>
              ← Personal
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
      </div>

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
    </div>
  );
}
