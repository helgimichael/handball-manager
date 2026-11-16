"use client";
// Arena Nights 231 -- STF-03c A "Board as sole market" (and the STF-03 B candidate list). Every person the club
// could approach, ranked for the chosen role, with fit as a 1-20 range bar (the knowledge-gated range the
// dossier uses for attributes -- exact only from 90 % knowledge), the current holder as a marker and the
// delta "Mot i dag" as a range, availability, ambition, wage and knowledge. Optional columns via "Kolumner".
// Phones get ranked cards. Opening a row goes to the staff dossier (STF-02) where the deal lives.
import { useMemo, useState } from "react";
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { FitBar } from "@/components/staff/FitBar";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { bestFor } from "@/lib/staff/organisation";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { staffFitRange } from "@/lib/staff/staffDesk";
import { formatStaffAmbition, marketCandidates } from "@/lib/staff/staffMarket";
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
type OptionalColumn = "AVAILABILITY" | "AMBITION" | "WAGE" | "KNOWLEDGE";
const OPTIONAL: { key: OptionalColumn; label: string }[] = [{ key: "AVAILABILITY", label: "Tillgänglighet" }, { key: "AMBITION", label: "Ambition" }, { key: "WAGE", label: "Lön" }, { key: "KNOWLEDGE", label: "Kännedom" }];

export function StaffMarketBoard({ role, onRole }: { role: StaffRole | "ALL"; onRole: (role: StaffRole | "ALL") => void }) {
  const money = useMoney();
  const { career } = useCareer();
  const [status, setStatus] = useState<"ALL" | "FREE_AGENT" | "EMPLOYED">("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("ESTIMATE");
  const [descending, setDescending] = useState(true);
  const [cols, setCols] = useState<Record<OptionalColumn, boolean>>({ AVAILABILITY: true, AMBITION: true, WAGE: true, KNOWLEDGE: true });
  const candidates = useMemo(() => marketCandidates(career), [career]);
  // HM-PLAYTEST-01 4.3: every sort reads only what the club knows -- the knowledge-weighted ESTIMATE, never the
  // hidden true value; knowledge itself is a public fact.
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
      <button type="button" className="sf-sort" onClick={() => { if (sort === key) setDescending(!descending); else { setSort(key); setDescending(key === "ESTIMATE" || key === "KNOWLEDGE"); } }}>{label}{sort === key ? (descending ? " ↓" : " ↑") : ""}</button>
    </th>
  );
  return (
    <section className="st-market sf-market" aria-labelledby="market-title">
      <header className="st-market-head">
        <div><span className="xp-eyebrow">Personalmarknaden · {rows.length} av {candidates.length} personer</span><h2 id="market-title">{role === "ALL" ? "Hitta rätt person" : `Kandidater: ${STAFF_ROLE_LABEL[role]}`}</h2></div>
        <div className="st-market-filters">
          <label>Roll<select className="hm-select" value={role} onChange={(e) => onRole(e.target.value as StaffRole | "ALL")}><option value="ALL">Alla roller</option>{STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}</select></label>
          <label>Tillgänglighet<select className="hm-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="ALL">Alla</option><option value="FREE_AGENT">Fria agenter (direkt tillgängliga)</option><option value="EMPLOYED">Under kontrakt (kräver förhandling)</option></select></label>
          <label>Sök<input className="hm-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Namn" /></label>
          <details className="sf-cols"><summary>Kolumner</summary><div>{OPTIONAL.map((o) => <label key={o.key}><input type="checkbox" checked={cols[o.key]} onChange={(e) => setCols((c) => ({ ...c, [o.key]: e.target.checked }))} />{o.label}</label>)}</div></details>
        </div>
      </header>
      <p className="sf-hint">Lämplighet på skalan 1–20. Ett streckat spann betyder att klubben inte känner personen väl -- ta referenser på profilen för en säkrare bild. Den gula markeringen är den som gör jobbet i dag.</p>
      <div className="sf-market-wrap">
        <table className="hm-table sf-market-table">
          <thead><tr><th className="sf-rank-h">#</th>{header("NAME", "Namn")}{header("ROLE", "Roll")}{cols.AVAILABILITY && header("AVAILABILITY", "Tillgänglighet", "Fria agenter först, sedan efter avtalets slut")}{header("ESTIMATE", "Bedömd lämplighet", "Vår bedömning – osäker när kännedomen är låg. Den verkliga förmågan visas aldrig.")}<th title="Jämfört med den som gör jobbet i dag">Mot i dag</th>{cols.AMBITION && <th>Ambition</th>}{cols.WAGE && header("WAGE", "Lön / mån", undefined, true)}{cols.KNOWLEDGE && header("KNOWLEDGE", "Kännedom", "Hur väl klubben känner personen. Ta referenser för att öka den.", true)}</tr></thead>
          <tbody>
            {rows.map((c, i) => {
              const club = c.currentClubId ? getClub(c.currentClubId) : undefined;
              const fit = staffFitRange(c.suitability, c.knowledge);
              const holder = bestFor(career, career.playerClubId, c.role);
              const holderFit = holder ? Math.round(computeRoleSuitability(holder, c.role)) : undefined;
              const delta = holderFit === undefined ? null : { low: fit.low - holderFit, high: fit.high - holderFit };
              const sign = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;
              return (
                <tr key={c.member.id}>
                  <td className="sf-rank sf-num">{i + 1}</td>
                  <td data-label="Namn"><Link href={`/career/staff/${encodeURIComponent(c.member.id)}?from=recruitment`}><b>{c.member.displayName}</b></Link></td>
                  <td data-label="Roll">{STAFF_ROLE_LABEL[c.role]}</td>
                  {cols.AVAILABILITY && <td data-label="Tillgänglighet">{club ? <span className="st-club"><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={18} />{club.shortName}{c.contractEndDate ? <small> · avtal t.o.m. {c.contractEndDate}</small> : null}</span> : <span className="sf-chip" data-tone="free">Fri agent</span>}</td>}
                  <td data-label="Bedömd lämplighet"><FitBar value={fit.low} range={fit} marker={holderFit} markerLabel={holder ? `I dag: ${holder.displayName}` : undefined} /></td>
                  <td data-label="Mot i dag">{!holder && c.role === "HEAD_COACH" ? <span className="sf-delta" title="Du är lagets huvudtränare">Du (manager)</span> : !delta ? <span className="sf-delta" data-tone="up">Vakant</span> : <span className="sf-delta sf-num" data-tone={delta.low > 0 ? "up" : delta.high < 0 ? "down" : undefined} title={`I dag: ${holder!.displayName} (${holderFit})`}>{delta.low === delta.high ? sign(delta.low) : `${sign(delta.low)} – ${sign(delta.high)}`}</span>}</td>
                  {cols.AMBITION && <td data-label="Ambition" className="st-ambition">{formatStaffAmbition(c.ambition, c.role)}</td>}
                  {cols.WAGE && <td data-label="Lön / mån" className="hm-table-num sf-num">{money.format(c.expectedWageEur)}</td>}
                  {cols.KNOWLEDGE && <td data-label="Kännedom" className="hm-table-num sf-num">{c.knowledge} %</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="sf-empty"><p>Ingen matchar filtret{role !== "ALL" ? ` för ${STAFF_ROLE_LABEL[role].toLowerCase()}` : ""}.</p>{(role !== "ALL" || status !== "ALL" || query) && <button type="button" className="hm-btn hm-btn-sm" onClick={() => { onRole("ALL"); setStatus("ALL"); setQuery(""); }}>Visa alla roller</button>}</div>}
    </section>
  );
}
