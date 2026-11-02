"use client";

// HM-STAFF-CAREER-1.0: a real staff profile -- name, current club, role(s),
// relevant attributes, contract/wage/employment status, role suitability,
// career-tracked club history, and (for a recruitable external candidate)
// an inline recruitment offer form. Reachable for ANY club's staff, not
// only the manager's own (Part 1: "All staff i alla klubbar ska vara
// klickbar").
import { type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { findStaffMember } from "@/lib/staff/staffCareerIntegration";
import { isStaffRecruitable } from "@/lib/staff/staffRecruitment";
import { isFreeAgentScoutAvailable } from "@/lib/staff/scoutPool";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { ROLE_ATTRIBUTE_WEIGHTS } from "@/lib/staff/roleAttributeMap";
import { STAFF_ATTRIBUTE_LABEL, STAFF_EMPLOYMENT_TYPE_LABEL, STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { STAFF_ATTRIBUTES } from "@/lib/staff/types";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { mondayOf, resolveTrainingWeek } from "@/lib/training/trainingSchedule";
import { resolveResponsibleCoach } from "@/lib/staff/roleSuitability";
import StarRating from "@/components/StarRating";
import { SectionScene, StaffMark } from "@/components/game/Secondary";
import Link from "next/link";
import { ClubLink } from "@/components/entityLinks";
import { StaffDealPanel } from "@/components/staff/StaffDealPanel";
import { MomentHero } from "@/components/experience/Moment";
import { NEGOTIATION_ROOM_BACKDROP } from "@/components/transfers/transferVisuals";
import { staffKnowledge, visibleAttribute } from "@/lib/staff/staffMarket";
import { daysBetween } from "@/lib/career/dateUtils";

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

function ContractRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function StaffProfilePage() {
  useMoney(); // re-render every figure when the display currency changes
  const router = useRouter();
  const params = useParams<{ staffId: string }>();
  const searchParams = useSearchParams();
  const { career } = useCareer();
  // HM-ALPHA3-M04: free agents come from the scout pool and the season's staff market.
  const isFreeAgent = isFreeAgentScoutAvailable(career, params.staffId) || !!career.staffMarket?.freeAgents[params.staffId];
  const member = findStaffMember(career, params.staffId) ?? career.scoutMarket[params.staffId] ?? career.staffMarket?.freeAgents[params.staffId];
  const knowledge = member ? staffKnowledge(career, member.id) : 0;
  const appointed = member ? (career.staffAppointments ?? []).filter((a) => a.staffId === member.id && a.clubId === career.playerClubId && a.kind === "APPOINTED" && daysBetween(a.date, career.gameDate) <= 14).at(-1) : undefined;

  if (!member) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Personen hittades inte.</div>
      </div>
    );
  }

  const club = isFreeAgent ? null : getClub(member.clubId);
  const employment = career.staffEmployment[member.id];
  const isOwnClub = !isFreeAgent && member.clubId === career.playerClubId;
  const backHref = searchParams.get("from") === "recruitment" ? "/career/staff/recruitment" : isOwnClub ? "/career/staff" : isFreeAgent ? "/career/staff/recruitment" : `/career/clubs/${member.clubId}`;
  const history = career.staffClubHistory[member.id];
  const recruitable = !isOwnClub && (isFreeAgent || isStaffRecruitable(career, member.id));

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
    <div className="game-secondary-page"><SectionScene eyebrow={member.roles.length > 0 ? member.roles.map(r => STAFF_ROLE_LABEL[r]).join(' · ') : member.officialRoleLabel ?? 'Personal'} title={member.displayName} description={isFreeAgent ? 'Tillgänglig scout · fri agent' : club?.name ?? 'Klubb ej registrerad'} mark={<StaffMark name={member.displayName} size={92} />} actions={<><button type="button" className="hm-btn hm-btn-sm" onClick={() => router.push(backHref)}>← Tillbaka</button>{club && <ClubLink clubId={club.id}>Klubb & personal →</ClubLink>}</>}><div><strong>{member.roles.length}</strong><small>{member.roles.length === 1 ? 'roll' : 'roller'} i spelvärlden</small></div>{isOwnClub && <div><strong>{responsibilities.length}</strong><small>pass den här veckan</small></div>}</SectionScene>{appointed && <MomentHero kind="STAFF_APPOINTMENT" size="compact" headingLevel={2} backdrop={{ kind: "photo", style: NEGOTIATION_ROOM_BACKDROP }} tags={[appointed.date]} headline={`${member.displayName} är ${STAFF_ROLE_LABEL[appointed.role].toLowerCase()}`} lede={`Avtalet är klart: ${employment?.wageEurPerMonth ? formatMoney(employment.wageEurPerMonth) + " i månaden, " : ""}till ${employment?.contractEndDate ?? "—"}.`} />}<div className="game-secondary-split">
      <div className="game-secondary-main">
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Egenskaper</span>
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              {member.source === "REAL_WORLD_IDENTITY"
                ? "Namn/roll från klubbdata — egenskaper genererade"
                : member.source === "REAL_PERSON_FICTIONAL_PROFILE"
                  ? "Verklig namngiven person — spelvärden är fiktiv tolkning"
                  : "Genererad personal"}
            </span>
          </div>
          <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {STAFF_ATTRIBUTES.map((attr) => {
              const isRelevant = member.roles.some((r) => attr in ROLE_ATTRIBUTE_WEIGHTS[r]);
              return (
                <div key={attr} className="hm-stat-row" style={{ opacity: isRelevant ? 1 : 0.5 }}>
                  <span className="hm-stat-label">{STAFF_ATTRIBUTE_LABEL[attr]}</span>
                  <span style={{ fontWeight: 700 }}>{(() => { const v = visibleAttribute(member.profile.attributes[attr].value, knowledge); return v.exact ? v.low : `${v.low}–${v.high}`; })()}</span>
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
                <ContractRow key={i} label={<ClubLink clubId={entry.clubId}>{getClub(entry.clubId)?.name ?? entry.clubId}</ClubLink>} value={entry.toDate ? `${entry.fromDate} – ${entry.toDate}` : `${entry.fromDate} – pågående`} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <aside className="game-secondary-rail" aria-label="Anställning och veckans ansvar">
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Anställning</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractRow label="Status" value={isFreeAgent ? "Tillgänglig" : employment ? STAFF_EMPLOYMENT_TYPE_LABEL[employment.employmentType] : "—"} />
            {isFreeAgent ? (
              <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
                Fri agent -- ingen klubb just nu. Kan värvas direkt.
              </p>
            ) : employment?.employmentType === "SALARIED" ? (
              <>
                <ContractRow label="Lön / månad" value={employment.wageEurPerMonth !== undefined ? formatMoney(employment.wageEurPerMonth) : "—"} />
                <ContractRow label="Kontrakt t.o.m." value={employment.contractEndDate ?? "—"} />
              </>
            ) : (
              <p className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", margin: 0 }}>
                Ingen ordinarie anställning eller lön registrerad för denna roll.
              </p>
            )}
          </div>
        </div>

        {/* HM-ALPHA3-M04: research, approach, multi-round negotiation; renewal and dismissal for our own staff. */}
        {!isOwnClub && <p className="st-note">{knowledge >= 90 ? "Fullständig bild av personen." : `Kännedom ${knowledge} %. Värdena visas som intervall tills referenser är tagna.`}</p>}
        {recruitable ? <StaffDealPanel key={member.id} member={member} mode="HIRE" /> : null}
        {isOwnClub && employment?.employmentType === "SALARIED" ? <StaffDealPanel key={`own-${member.id}`} member={member} mode="OWN" /> : null}

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
                    <Link href="/career/training" style={{ fontWeight: 600 }}>{SESSION_TYPE_LABEL[r.type] ?? "Träningspass"}</Link>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </div></div>
  );
}

