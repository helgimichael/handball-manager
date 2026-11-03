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
import { AMBITION_LABEL, formatStaffAmbition, marketCandidates } from "@/lib/staff/staffMarket";
import { STAFF_ROLES, type StaffRole } from "@/lib/staff/types";

type SortKey = "ESTIMATE" | "NAME" | "ROLE" | "WAGE" | "AVAILABILITY" | "KNOWLEDGE";
type Candidate = ReturnType<typeof marketCandidates>[number];
/** Knowledge-weighted estimate on the 1-20 scale: what we believe, never the hidden truth. */
export const estimatedSuitability = (c: Candidate) => (c.suitability * c.knowledge + 10 * (100 - c.knowledge)) / 100;
const MARKET_SORT: Record<SortKey, (c: Candidate) => number | string> = {
  ESTIMATE: estimatedSuitability,
  NAME: (c) => c.member.displayName,
  ROLE: (c) => STAFF_ROLE_LABEL[c.role],
  WAGE: (c) => c.expectedWageEur,
  AVAILABILITY: (c) => (c.status === "FREE_AGENT" ? "0" : "1" + (c.contractEndDate ?? "9999")),
  KNOWLEDGE: (c) => c.knowledge,
};

export function StaffMarketBoard() {
  const money = useMoney();
  const { career } = useCareer();
  const params = useSearchParams();
  const initialRole = STAFF_ROLES.find((r) => r === params.get("role"));
  const [role, setRole] = useState<StaffRole | "ALL">(initialRole ?? "ALL");
  const [status, setStatus] = useState<"ALL" | "FREE_AGENT" | "EMPLOYED">("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("ESTIMATE");
  const [descending, setDescending] = useState(true);
  const candidates = useMemo(() => marketCandidates(career), [career]);
  // HM-PLAYTEST-01 4.3: every sort reads only what the club knows. Suitability
  // is the knowledge-weighted ESTIMATE (blurred towards average when little is
  // known), never the hidden true value; knowledge itself is a public fact.
  const rows = candidates
    .filter((c) => (role === "ALL" || c.role === role) && (status === "ALL" || c.status === status) && (!query.trim() || c.member.displayName.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => {
      const x = MARKET_SORT[sort](a), y = MARKET_SORT[sort](b);
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "sv");
      return (descending ? -cmp : cmp) || a.member.id.localeCompare(b.member.id);
    })
    .slice(0, 80);
  const header = (key: SortKey, label: string, title?: string, numeric = false) => (
    <th className={numeric ? "hm-table-num" : undefined} title={title} aria-sort={sort === key ? (descending ? "descending" : "ascending") : "none"}>
      <button type="button" className="st-sort" onClick={() => { if (sort === key) setDescending(!descending); else { setSort(key); setDescending(key === "ESTIMATE" || key === "KNOWLEDGE"); } }}>{label}{sort === key ? (descending ? " ↓" : " ↑") : ""}</button>
    </th>
  );
  return (
    <section className="st-market" aria-labelledby="market-title">
      <header className="st-market-head">
        <div><span className="xp-eyebrow">Personalmarknaden · {candidates.length} personer</span><h2 id="market-title">Hitta rätt person</h2></div>
        <div className="st-market-filters">
          <label>Roll<select className="hm-select" value={role} onChange={(e) => setRole(e.target.value as StaffRole | "ALL")}><option value="ALL">Alla roller</option>{STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}</select></label>
          <label>Tillgänglighet<select className="hm-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="ALL">Alla</option><option value="FREE_AGENT">Fria agenter (direkt tillgängliga)</option><option value="EMPLOYED">Under kontrakt (kräver förhandling)</option></select></label>
          <label>Sök<input className="hm-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Namn" /></label>
        </div>
      </header>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead><tr>{header("NAME", "Namn")}{header("ROLE", "Roll")}{header("AVAILABILITY", "Tillgänglighet", "Fria agenter först, sedan efter avtalets slut")}{header("ESTIMATE", "Bedömd lämplighet", "Vår bedömning – osäker när kännedomen är låg. Den verkliga förmågan visas aldrig.")}<th title="Jämfört med den som gör jobbet i dag">Mot i dag</th><th>Ambition</th>{header("WAGE", "Lön / mån", undefined, true)}{header("KNOWLEDGE", "Kännedom", "Hur väl klubben känner personen. Ta referenser för att öka den.", true)}</tr></thead>
          <tbody>
            {rows.map((c) => {
              const club = c.currentClubId ? getClub(c.currentClubId) : undefined;
              const stars = roleSuitabilityStars(c.suitability);
              const uncertain = c.knowledge < 60;
              return (
                <tr key={c.member.id}>
                  <td><Link href={`/career/staff/${encodeURIComponent(c.member.id)}?from=recruitment`}>{c.member.displayName}</Link></td>
                  <td>{STAFF_ROLE_LABEL[c.role]}</td>
                  <td>{club ? <span className="st-club"><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={18} />{club.shortName}{c.contractEndDate ? <small> · avtal t.o.m. {c.contractEndDate}</small> : null}</span> : <span className="tc-pill" data-tone="done">Fri agent</span>}</td>
                  <td title={uncertain ? "Osäker bedömning -- ta referenser" : undefined}><span className="st-stars" data-uncertain={uncertain}><StarRating stars={stars} />{uncertain ? " ?" : ""}</span></td>
                  <td>{(() => { const holder = bestFor(career, career.playerClubId, c.role); if (!holder && c.role === "HEAD_COACH") return <span className="st-delta" title="Du är lagets huvudtränare">Du (manager)</span>; if (!holder) return <span className="st-delta" data-tone="up">Vakant</span>; const d = stars - roleSuitabilityStars(computeRoleSuitability(holder, c.role)); return <span className="st-delta" data-tone={d > 0 ? "up" : d < 0 ? "down" : undefined} title={`I dag: ${holder.displayName}`}>{d === 0 ? "Likvärdig" : `${d > 0 ? "+" : "−"}${Math.abs(d)} ★`}{uncertain ? " ?" : ""}</span>; })()}</td>
                  <td className="st-ambition">{formatStaffAmbition(c.ambition, c.role)}</td>
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
