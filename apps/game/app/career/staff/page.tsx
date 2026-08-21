"use client";

import { TUMBA_STAFF } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";

export default function StaffPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);

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
        Generisk exempelpersonal — ingen klubbspecifik personaldata i denna version.
      </div>
    </div>
  );
}
