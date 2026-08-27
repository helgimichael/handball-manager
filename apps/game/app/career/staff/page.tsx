"use client";

// HM-STAFF-1.0 Part 24: the live Staff workspace -- now reads the
// resolved, gameplay-facing roster directly off CareerState
// (career.staffRoster), snapshotted once at career creation (Part 15/19)
// -- no client fetch needed any more (HM-STAFF-DATA-0.1's own on-demand
// fetch is superseded here; the raw identity data it fetched is now only
// consumed once, server-side via newCareer.ts, to build this roster).
import Link from "next/link";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { ROLE_ATTRIBUTE_WEIGHTS } from "@/lib/staff/roleAttributeMap";
import { STAFF_ROLE_LABEL, STAFF_ATTRIBUTE_LABEL } from "@/lib/staff/labels";
import type { StaffRole } from "@/lib/staff/types";

export default function StaffPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const roster = career.staffRoster[career.playerClubId] ?? [];

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Personal — {club.name}</span>
      </div>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead>
            <tr>
              <th>Namn</th>
              <th>Roll</th>
              <th>Relevanta egenskaper</th>
              <th>Rollsuitability</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((member) => {
              const primaryRole: StaffRole | undefined = member.roles[0];
              const relevantAttrs = primaryRole ? Object.keys(ROLE_ATTRIBUTE_WEIGHTS[primaryRole]) : [];
              const suitability = primaryRole ? Math.round(computeRoleSuitability(member, primaryRole)) : null;
              return (
                <tr key={member.id}>
                  <td className="hm-td-strong">
                    <Link href={`/career/staff/${encodeURIComponent(member.id)}`}>{member.displayName}</Link>
                  </td>
                  <td>{member.roles.length > 0 ? member.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : (member.officialRoleLabel ?? "—")}</td>
                  <td className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                    {relevantAttrs.map((a) => STAFF_ATTRIBUTE_LABEL[a as keyof typeof STAFF_ATTRIBUTE_LABEL]).join(", ")}
                  </td>
                  <td>{suitability !== null ? <span className="hm-badge hm-badge-neutral">{suitability}/20</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
        {roster.some((m) => m.source === "GENERATED_FICTIONAL")
          ? "Vissa roller är genererad exempelpersonal (ingen klubbspecifik källdata för denna position)."
          : "Alla roller är klubbspecifik personal."}
      </div>
    </div>
  );
}
