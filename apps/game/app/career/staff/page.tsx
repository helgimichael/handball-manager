"use client";

// HM-STAFF-1.0 Part 24: the live Staff workspace -- now reads the
// resolved, gameplay-facing roster directly off CareerState
// (career.staffRoster), snapshotted once at career creation (Part 15/19)
// -- no client fetch needed any more (HM-STAFF-DATA-0.1's own on-demand
// fetch is superseded here; the raw identity data it fetched is now only
// consumed once, server-side via newCareer.ts, to build this roster).
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { ROLE_ATTRIBUTE_WEIGHTS } from "@/lib/staff/roleAttributeMap";
import { STAFF_ROLE_LABEL, STAFF_ATTRIBUTE_LABEL } from "@/lib/staff/labels";
import type { ResolvedStaffMember, StaffRole } from "@/lib/staff/types";
import StarRating from "@/components/StarRating";
import { SortableTh, applySortDirection, type SortState } from "@/components/SortableTh";
import { SectionScene, StaffMark } from '@/components/game/Secondary';
import ClubCrest from '@/components/ClubCrest';
import { Panel } from '@/components/manager/Workspace';
import { mondayOf, resolveTrainingWeek } from '@/lib/training/trainingSchedule';
import { resolveResponsibleCoach } from '@/lib/staff/roleSuitability';
import { STAFF_ROLES } from '@/lib/staff/types';

type SortKey = "name" | "role" | "suitability";

function primaryRoleOf(member: ResolvedStaffMember): StaffRole | undefined {
  return member.roles[0];
}
function suitabilityOf(member: ResolvedStaffMember): number | null {
  const role = primaryRoleOf(member);
  return role ? computeRoleSuitability(member, role) : null;
}

export default function StaffPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const roster = useMemo(() => career.staffRoster[career.playerClubId] ?? [], [career.staffRoster,career.playerClubId]);
  const week = resolveTrainingWeek(career,mondayOf(career.gameDate));
  const responsibilities = week.days.flatMap(day => day.sessions.map(session => ({ date:day.date, coach:resolveResponsibleCoach(roster,session.type,session.coachId ?? null) })));
  // HM-DATA-ALLSVENSKAN-1.1B Part 9: `null` = the roster's own natural
  // hierarchy order (Part 5's resolveClubStaffRoster sort) -- the
  // sensible default, not forced onto the manager. A click on any header
  // switches to that column's own sort.
  const [sort, setSort] = useState<SortState<SortKey> | null>(null);

  const rows = useMemo(() => {
    if (!sort) return roster;
    return [...roster].sort((a, b) => {
      let cmp: number;
      switch (sort.key) {
        case "name":
          cmp = a.displayName.localeCompare(b.displayName);
          break;
        case "role": {
          const roleA = a.roles.length > 0 ? a.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (a.officialRoleLabel ?? "");
          const roleB = b.roles.length > 0 ? b.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (b.officialRoleLabel ?? "");
          cmp = roleA.localeCompare(roleB);
          break;
        }
        case "suitability":
          cmp = (suitabilityOf(a) ?? -1) - (suitabilityOf(b) ?? -1);
          break;
        default:
          cmp = 0;
      }
      return applySortDirection(sort.direction, cmp);
    });
  }, [roster, sort]);

  return (
    <div className="game-secondary-page">
      <SectionScene eyebrow={`${club.name} · ${career.seasonId}`} title="Personal" description="Tränare, specialister och ledare runt laget. Följ rollerna och veckans träningsansvar." mark={<ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={72} />} actions={<Link href="/career/staff/recruitment" className="hm-btn hm-btn-sm hm-btn-primary">Rekrytera personal</Link>}><div><strong>{roster.length}</strong><small>personer i klubben</small></div><div><strong>{responsibilities.length}</strong><small>pass den här veckan</small></div></SectionScene>
      <div className="game-secondary-split"><div className="game-secondary-main">
      <Panel title="Rollerna i klubben"><div className="game-staff-roles">{STAFF_ROLES.map(role => <div key={role} className="game-staff-role"><span>{STAFF_ROLE_LABEL[role]}</span><strong>{roster.filter(m => m.roles.includes(role)).length}</strong></div>)}</div></Panel>
      <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Personal — {club.name}</span>
        <span className="hm-text-muted">Roller och bedömningar</span>
      </div>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead>
            <tr>
              <SortableTh label="Namn" sortKey="name" sort={sort} onSort={setSort} />
              <SortableTh label="Roll" sortKey="role" sort={sort} onSort={setSort} />
              <th>Relevanta egenskaper</th>
              <SortableTh label="Lämplighet för rollen" sortKey="suitability" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => {
              const primaryRole = primaryRoleOf(member);
              const relevantAttrs = primaryRole ? Object.keys(ROLE_ATTRIBUTE_WEIGHTS[primaryRole]) : [];
              const suitability = suitabilityOf(member);
              return (
                <tr key={member.id}>
                  <td className="hm-td-strong">
                    <div className="game-staff-cell"><StaffMark name={member.displayName} size={32} /><Link href={`/career/staff/${encodeURIComponent(member.id)}`}>{member.displayName}</Link></div>
                  </td>
                  <td>{member.roles.length > 0 ? member.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (member.officialRoleLabel ?? "—")}</td>
                  <td className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                    {relevantAttrs.map((a) => STAFF_ATTRIBUTE_LABEL[a as keyof typeof STAFF_ATTRIBUTE_LABEL]).join(", ")}
                  </td>
                  <td>{suitability !== null ? <StarRating stars={roleSuitabilityStars(suitability)} title="Tränarstabens bedömning av lämplighet för rollen" /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
        {roster.some((m) => m.source === "GENERATED_FICTIONAL")
          ? "Vissa roller är tillsatta med spelgenererad personal."
          : "Personer och roller i din klubb."}
      </div>
      </div></div>
      <aside className="game-secondary-rail" aria-label="Veckans tränaransvar">
        <Panel title="Veckans tränaransvar" actions={<Link href="/career/training">Träningsvecka →</Link>}><ul className="game-staff-list">{responsibilities.map((r,i) => <li key={i}><div>{r.coach ? <Link href={`/career/staff/${encodeURIComponent(r.coach.id)}`}>{r.coach.displayName}</Link> : 'Ingen ansvarig tränare'}<small>{r.date}</small></div></li>)}</ul>{responsibilities.length === 0 && <div className="hm-panel-body hm-text-muted">Inga registrerade träningspass den här veckan.</div>}</Panel>
        <section className="game-secondary-note"><h2>Arbeta runt laget</h2><p>Öppna en person för rollbedömning, anställning och aktuellt ansvar. Scouter följer spelarmarknaden; fysioavdelningen stöder återgången efter skada.</p><div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/scouting">Scouting →</Link><Link className="hm-btn hm-btn-sm" href="/career/medical">Medicinskt →</Link></div></section>
      </aside></div>
    </div>
  );
}
