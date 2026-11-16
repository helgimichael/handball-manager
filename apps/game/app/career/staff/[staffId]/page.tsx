"use client";

// HM-STAFF-CAREER-1.0: a real staff profile, reachable for ANY club's staff (Part 1: "All staff i alla klubbar
// ska vara klickbar"). Arena Nights 231 -- STF-02 A "Staff Dossier": an identity column (role, club, wage,
// contract, knowledge, ambition, this week's sessions) and a work column -- fit per role on 1-20 with the
// current holder as a marker (STF-02a), attributes with the delta against the holder for the role being
// evaluated, what hiring/keeping changes, and the deal panel (STF-02b). Toggle a role to evaluate the person
// for it; the attributes, impact and the offer's role follow. Phones: a sticky bar and stacked sections.
import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StaffMark } from "@/components/game/Secondary";
import { ClubLink } from "@/components/entityLinks";
import { MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { StaffDealPanel } from "@/components/staff/StaffDealPanel";
import { RoleFit, StaffAttributes, StaffImpact } from "@/components/staff/StaffInsight";
import { NEGOTIATION_ROOM_BACKDROP } from "@/components/transfers/transferVisuals";
import { useCareer } from "@/lib/career/CareerContext";
import { daysBetween } from "@/lib/career/dateUtils";
import { formatMoney } from "@/lib/economy/currency";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_EMPLOYMENT_TYPE_LABEL, STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { bestFor } from "@/lib/staff/organisation";
import { resolveResponsibleCoach } from "@/lib/staff/roleSuitability";
import { getStaffAmbitionProfile, staffKnowledge } from "@/lib/staff/staffMarket";
import { isStaffRecruitable } from "@/lib/staff/staffRecruitment";
import { resolveStaffProfile, staffIdFromRouteParam } from "@/lib/staff/staffProfileRoute";
import type { StaffRole } from "@/lib/staff/types";
import { SESSION_TYPE_LABEL } from "@/lib/training/labels";
import { mondayOf, resolveTrainingWeek } from "@/lib/training/trainingSchedule";

const LEADERSHIP_LABEL = { ORGANISATION_HEAD: "Huvudansvar", DEPARTMENT_LEAD: "Avdelningsansvar" } as Record<string, string>;
const PRESTIGE_LABEL = { INTERNATIONAL: "Internationell elit", NATIONAL_ELITE: "Handbollsligan" } as Record<string, string>;
const WAGE_TIER_LABEL = { PREMIUM: "Toppavtal", MODEST: "Modesta" } as Record<string, string>;

export default function StaffProfilePage() {
  useMoney(); // re-render every figure when the display currency changes
  const router = useRouter();
  const params = useParams<{ staffId: string }>();
  const searchParams = useSearchParams();
  const { career } = useCareer();
  // HM-ALPHA3-M04: free agents come from the scout pool and the season's staff market.
  const staffId = staffIdFromRouteParam(params.staffId);
  const { member, isFreeAgent } = resolveStaffProfile(career, staffId);
  const [evalRole, setEvalRole] = useState<StaffRole | undefined>(undefined);
  const knowledge = member ? staffKnowledge(career, member.id) : 0;
  const appointed = member ? (career.staffAppointments ?? []).filter((a) => a.staffId === member.id && a.clubId === career.playerClubId && a.kind === "APPOINTED" && daysBetween(a.date, career.gameDate) <= 14).at(-1) : undefined;
  const departed = member ? (career.staffAppointments ?? []).filter((a) => a.staffId === member.id && a.clubId === career.playerClubId && (a.kind === "DISMISSED" || a.kind === "LEFT") && daysBetween(a.date, career.gameDate) <= 14).at(-1) : undefined;
  const severance = departed?.kind === "DISMISSED" && member ? [...(career.clubFinances?.[career.playerClubId]?.pendingTransactions ?? []), ...(career.clubFinances?.[career.playerClubId]?.statements.at(-1)?.transactions ?? [])].find((t) => t.category === "STAFF_COMPENSATION" && t.label.endsWith(member.displayName)) : undefined;

  if (!member) {
    return <div className="sf-empty"><p>Personen hittades inte.</p><Link className="hm-btn hm-btn-sm" href="/career/staff">← Personal</Link></div>;
  }

  const club = isFreeAgent ? null : getClub(member.clubId);
  const employment = career.staffEmployment[member.id];
  const isOwnClub = !isFreeAgent && member.clubId === career.playerClubId;
  const backHref = searchParams.get("from") === "recruitment" ? "/career/staff/recruitment" : isOwnClub ? "/career/staff" : isFreeAgent ? "/career/staff/recruitment" : `/career/clubs/${member.clubId}`;
  const history = career.staffClubHistory[member.id];
  const recruitable = !isOwnClub && (isFreeAgent || isStaffRecruitable(career, member.id));

  const week = isOwnClub ? resolveTrainingWeek(career, mondayOf(career.gameDate)) : null;
  const roster = career.staffRoster[career.playerClubId] ?? [];
  const responsibilities = week ? week.days.flatMap((day) => day.sessions.filter((session) => resolveResponsibleCoach(roster, session.type, session.coachId ?? null)?.id === member.id).map((session) => ({ date: day.date, type: session.type }))) : [];

  const focusRole = evalRole ?? member.roles[0];
  const holder = focusRole ? bestFor(career, career.playerClubId, focusRole) : undefined;
  const compareWith = holder && holder.id !== member.id ? holder : undefined;
  const ambition = getStaffAmbitionProfile(member.id, focusRole);
  const hasDeal = recruitable || (isOwnClub && employment?.employmentType === "SALARIED");

  return (
    <div className="game-secondary-page sf-page">
      {appointed && <MomentHero kind="STAFF_APPOINTMENT" size="compact" headingLevel={2} backdrop={{ kind: "photo", style: NEGOTIATION_ROOM_BACKDROP }} tags={[appointed.date]} headline={`${member.displayName} är ${STAFF_ROLE_LABEL[appointed.role].toLowerCase()}`} lede={`Avtalet är klart: ${employment?.wageEurPerMonth ? formatMoney(employment.wageEurPerMonth) + " i månaden, " : ""}till ${employment?.contractEndDate ?? "—"}.`} />}
      {departed && !isOwnClub && <MomentHero tone="loss" size="compact" headingLevel={2} backdrop={{ kind: "plain" }} tags={[departed.kind === "DISMISSED" ? "Uppsägning" : "Avgång", departed.date]} stamp={departed.kind === "DISMISSED" ? "Uppsagd" : null} headline={departed.kind === "DISMISSED" ? `${member.displayName} är uppsagd` : `${member.displayName} har lämnat klubben`} lede={`${departed.kind === "DISMISSED" ? `Avgångsvederlaget${severance ? ` på ${formatMoney(-severance.amountEur)}` : ""} är bokfört i Ekonomi. ` : "Avtalet gick ut utan förlängning. "}Rollen ${STAFF_ROLE_LABEL[departed.role].toLowerCase()} är nu vakant och visas under Behov just nu i organisationen.`} />}

      <div className="sf-sticky" aria-hidden="false">
        <button type="button" className="hm-btn hm-btn-sm" onClick={() => router.push(backHref)}>←</button>
        <b>{member.displayName}</b>
        {hasDeal && <a className="hm-btn hm-btn-sm hm-btn-primary" href="#sf-deal">{isOwnClub ? "Avtal" : "Värva"}</a>}
      </div>

      <div className="sf-dossier">
        <aside className="sf-id" aria-label="Identitet och anställning">
          <button type="button" className="hm-btn hm-btn-sm sf-back" onClick={() => router.push(backHref)}>← Tillbaka</button>
          <div className="sf-id-head"><StaffMark name={member.displayName} size={72} /><div><small>{member.roles.length > 0 ? member.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" · ") : member.officialRoleLabel ?? "Personal"}</small><h1>{member.displayName}</h1><span>{isFreeAgent ? "Fri agent · kan värvas direkt" : club ? <ClubLink clubId={club.id}>{club.name}</ClubLink> : "Klubb ej registrerad"}</span></div></div>
          <dl className="sf-facts">
            <div><dt>Status</dt><dd>{isFreeAgent ? "Tillgänglig" : employment ? STAFF_EMPLOYMENT_TYPE_LABEL[employment.employmentType] : "—"}</dd></div>
            {!isFreeAgent && employment?.employmentType === "SALARIED" && <><div><dt>Lön</dt><dd className="sf-num">{employment.wageEurPerMonth !== undefined ? `${formatMoney(employment.wageEurPerMonth)}/mån` : "—"}</dd></div><div><dt>Kontrakt t.o.m.</dt><dd className="sf-num">{employment.contractEndDate ?? "—"}</dd></div></>}
            {!isFreeAgent && employment && employment.employmentType !== "SALARIED" && <div><dt>Lön</dt><dd>Ingen ordinarie anställning eller lön</dd></div>}
          </dl>
          {!isOwnClub && <div className="sf-id-know"><MeterBar label="Kännedom om personen" value={knowledge / 100} figure={`${knowledge} %`} tone={knowledge >= 80 ? "success" : "gold"} /><p className="sf-hint">{knowledge >= 90 ? "Fullständig bild. Värdena är exakta." : "Värdena visas som intervall. Ta referenser för en säkrare bild."}</p></div>}
          <section className="sf-id-amb" aria-label="Karriärambition">
            <h2>Karriärambition <span className="sf-chip">{LEADERSHIP_LABEL[ambition.leadershipDesire] ?? "Specialist/stöd"}</span></h2>
            <b>{ambition.label}</b>
            <p>{ambition.description}</p>
            <dl className="sf-facts"><div><dt>Nivåmål</dt><dd>{PRESTIGE_LABEL[ambition.prestigeDesire] ?? "Regional / Allsvenskan"}</dd></div><div><dt>Löneanspråk</dt><dd>{WAGE_TIER_LABEL[ambition.wageExpectationTier] ?? "Marknadsmässiga"}</dd></div></dl>
          </section>
          {isOwnClub && (
            <section className="sf-id-week" aria-label="Aktuellt träningsansvar">
              <h2>Pass den här veckan</h2>
              {responsibilities.length === 0 ? <p className="sf-hint">Inget träningspass denna vecka.</p> : <ul>{responsibilities.map((r, i) => <li key={i}><span className="sf-num">{r.date}</span><Link href="/career/training">{SESSION_TYPE_LABEL[r.type] ?? "Träningspass"}</Link></li>)}</ul>}
            </section>
          )}
          <p className="sf-hint">{member.source === "REAL_WORLD_IDENTITY" ? "Namn och roll från klubbdata, egenskaper genererade." : member.source === "REAL_PERSON_FICTIONAL_PROFILE" ? "Verklig namngiven person, spelvärdena är en fiktiv tolkning." : "Genererad personal."}</p>
        </aside>

        <div className="sf-work">
          <section className="sf-work-sec" aria-labelledby="sf-fit-title">
            <header><span className="xp-eyebrow">Skala 1–20{compareWith ? ` · markering: ${compareWith.displayName} i dag` : ""}</span><h2 id="sf-fit-title">Lämplighet</h2></header>
            {member.roles.length > 0 || evalRole ? <RoleFit member={member} knowledge={knowledge} roles={member.roles} evalRole={focusRole} onEval={setEvalRole} career={career} /> : <p className="sf-hint">Ingen tränar- eller stabsroll.</p>}
          </section>

          <section className="sf-work-sec">
            <StaffAttributes member={member} knowledge={knowledge} roles={focusRole ? [focusRole] : member.roles} compareWith={compareWith} />
          </section>

          {focusRole && focusRole !== "HEAD_COACH" && hasDeal && <StaffImpact career={career} member={member} role={focusRole} mode={isOwnClub ? "OWN" : "HIRE"} knowledge={knowledge} />}

          <div id="sf-deal">
            {recruitable ? <StaffDealPanel key={`${member.id}-${focusRole}`} member={member} mode="HIRE" initialRole={focusRole} /> : null}
            {isOwnClub && employment?.employmentType === "SALARIED" ? <StaffDealPanel key={`own-${member.id}`} member={member} mode="OWN" /> : null}
          </div>

          {history && history.entries.length > 0 ? (
            <section className="sf-work-sec" aria-labelledby="sf-hist-title">
              <header><h2 id="sf-hist-title">Klubbhistorik (denna karriär)</h2></header>
              <dl className="sf-facts">{history.entries.map((entry, i) => <div key={i}><dt><ClubLink clubId={entry.clubId}>{getClub(entry.clubId)?.name ?? entry.clubId}</ClubLink></dt><dd className="sf-num">{entry.toDate ? `${entry.fromDate} – ${entry.toDate}` : `${entry.fromDate} – pågående`}</dd></div>)}</dl>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
