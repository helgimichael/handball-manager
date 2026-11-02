"use client";
// HM-ALPHA3-M04: staff discovery -- every person the club could approach,
// filtered by role, with what we know about them (knowledge-gated
// suitability), their ambition and what they would cost.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ClubCrest from "@/components/ClubCrest";
import StarRating from "@/components/StarRating";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { bestFor } from "@/lib/staff/organisation";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { AMBITION_LABEL, marketCandidates } from "@/lib/staff/staffMarket";
import { STAFF_ROLES, type StaffRole } from "@/lib/staff/types";

export function StaffMarketBoard() {
  const money = useMoney();
  const { career } = useCareer();
  const params = useSearchParams();
  const initialRole = STAFF_ROLES.find((r) => r === params.get("role"));
  const [role, setRole] = useState<StaffRole | "ALL">(initialRole ?? "ALL");
  const [status, setStatus] = useState<"ALL" | "FREE_AGENT" | "EMPLOYED">("ALL");
  const candidates = useMemo(() => marketCandidates(career), [career]);
  const rows = candidates
    .filter((c) => (role === "ALL" || c.role === role) && (status === "ALL" || c.status === status))
    // Ranked by what we believe (suitability blurred towards average when we know little).
    .sort((a, b) => (b.suitability * b.knowledge + 10 * (100 - b.knowledge)) - (a.suitability * a.knowledge + 10 * (100 - a.knowledge)))
    .slice(0, 60);
  return (
    <section className="st-market" aria-labelledby="market-title">
      <header className="st-market-head">
        <div><span className="xp-eyebrow">Personalmarknaden · {candidates.length} personer</span><h2 id="market-title">Hitta rätt person</h2></div>
        <div className="st-market-filters">
          <label>Roll<select className="hm-select" value={role} onChange={(e) => setRole(e.target.value as StaffRole | "ALL")}><option value="ALL">Alla roller</option>{STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}</select></label>
          <label>Status<select className="hm-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="ALL">Alla</option><option value="FREE_AGENT">Fria agenter</option><option value="EMPLOYED">Under kontrakt</option></select></label>
        </div>
      </header>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead><tr><th>Namn</th><th>Roll</th><th>Nu</th><th>Lämplighet</th><th title="Jämfört med den som gör jobbet i dag">Mot i dag</th><th>Ambition</th><th className="hm-table-num">Lön / mån</th><th className="hm-table-num">Kännedom</th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const club = c.currentClubId ? getClub(c.currentClubId) : undefined;
              const stars = roleSuitabilityStars(c.suitability);
              const uncertain = c.knowledge < 60;
              return (
                <tr key={c.member.id}>
                  <td><Link href={`/career/staff/${encodeURIComponent(c.member.id)}?from=recruitment`}>{c.member.displayName}</Link></td>
                  <td>{STAFF_ROLE_LABEL[c.role]}</td>
                  <td>{club ? <span className="st-club"><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={18} />{club.shortName}</span> : <span className="tc-pill" data-tone="done">Fri agent</span>}</td>
                  <td title={uncertain ? "Osäker bedömning -- ta referenser" : undefined}><span className="st-stars" data-uncertain={uncertain}><StarRating stars={stars} />{uncertain ? " ?" : ""}</span></td>
                  <td>{(() => { const holder = bestFor(career, career.playerClubId, c.role); if (!holder) return <span className="st-delta" data-tone="up">Vakant</span>; const d = stars - roleSuitabilityStars(computeRoleSuitability(holder, c.role)); return <span className="st-delta" data-tone={d > 0 ? "up" : d < 0 ? "down" : undefined} title={`I dag: ${holder.displayName}`}>{d === 0 ? "Likvärdig" : `${d > 0 ? "+" : "−"}${Math.abs(d)} ★`}{uncertain ? " ?" : ""}</span>; })()}</td>
                  <td className="st-ambition">{AMBITION_LABEL[c.ambition]}</td>
                  <td className="hm-table-num">{money.format(c.expectedWageEur)}</td>
                  <td className="hm-table-num">{c.knowledge} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="hm-empty">Ingen matchar filtret.</p>}
    </section>
  );
}
