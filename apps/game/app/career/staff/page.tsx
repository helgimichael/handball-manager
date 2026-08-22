"use client";

// HM-STAFF-DATA-0.1: shows real imported staff (HM-IDENTITY-0.1 schema)
// for a club with an identity source file; falls back to the existing
// fictional TUMBA_STAFF placeholder exactly as before for every other
// club (no data source exists for them yet -- never invented). Staff
// data is fetched on demand from the server and never persisted into
// CareerState/save data, so old saves need no migration at all.
import { useEffect, useState } from "react";
import { TUMBA_STAFF } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { selectCurrentStaffAssignments, type StaffAssignment, type StaffPerson } from "@/lib/identity";

function roleLabel(assignment: StaffAssignment): string {
  return assignment.standardRoles.join(" + ");
}

function statusBadge(status: StaffAssignment["status"]): string {
  switch (status) {
    case "PROBABLE":
      return "PROBABLE";
    case "ROLE_NEEDS_CLARIFICATION":
      return "ROLL EJ FASTSTÄLLD";
    case "DUAL_STATUS":
      return "DUBBEL STATUS";
    default:
      return "";
  }
}

export default function StaffPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const [staff, setStaff] = useState<{ people: StaffPerson[]; assignments: StaffAssignment[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game-world/staff-snapshot?clubId=${encodeURIComponent(club.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStaff({ people: data.people ?? [], assignments: data.assignments ?? [] });
      })
      .catch(() => {
        if (!cancelled) setStaff({ people: [], assignments: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [club.id]);

  if (staff === null) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Personal — {club.name}</span>
        </div>
        <div className="hm-panel-body hm-text-muted">Laddar…</div>
      </div>
    );
  }

  const currentAssignments = selectCurrentStaffAssignments(staff.assignments, career.gameDate);
  const hasRealStaff = currentAssignments.length > 0;

  if (hasRealStaff) {
    const peopleById = new Map(staff.people.map((p) => [p.id, p]));
    return (
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Personal — {club.name}</span>
        </div>
        <table className="hm-table">
          <thead>
            <tr>
              <th>Namn</th>
              <th>Officiell titel</th>
              <th>HM-roll</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentAssignments.map((a) => {
              const person = peopleById.get(a.personId);
              return (
                <tr key={`${a.personId}:${a.officialRole}`}>
                  <td className="hm-td-strong">{person?.displayName ?? a.personId}</td>
                  <td>{a.officialRole}</td>
                  <td>{roleLabel(a)}</td>
                  <td>{statusBadge(a.status) ? <span className="hm-badge hm-badge-neutral">{statusBadge(a.status)}</span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Källa: Handball Manager Club &amp; Staff Research Project (HM-STAFF-DATA-0.1). Endast bekräftade eller sannolika roller för {career.gameDate} visas -- historiska roller visas inte som aktuella.
        </div>
      </div>
    );
  }

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Personal — {club.name}</span>
      </div>
      <table className="hm-table">
        <thead>
          <tr>
            <th>Namn</th>
            <th>Roll</th>
            <th>Nationalitet</th>
            <th className="hm-table-num">År i klubben</th>
          </tr>
        </thead>
        <tbody>
          {TUMBA_STAFF.map((s) => (
            <tr key={s.id}>
              <td className="hm-td-strong">{s.name}</td>
              <td>{s.role}</td>
              <td>{s.nationality}</td>
              <td className="hm-table-num">{s.yearsAtClub}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
        Generisk exempelpersonal — ingen klubbspecifik personaldata för {club.name} i denna version.
      </div>
    </div>
  );
}
