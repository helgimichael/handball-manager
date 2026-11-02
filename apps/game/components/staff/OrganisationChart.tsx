"use client";
// HM-ALPHA3-M04: the club as an organisation -- departments, positions
// (filled, vacant, covered by a combined role), what it costs and what is
// about to change.
import Link from "next/link";
import StarRating from "@/components/StarRating";
import { MeterBar, Stat } from "@/components/experience/primitives";
import { useCareer } from "@/lib/career/CareerContext";
import { getClubStaffCostsEurAnnual } from "@/lib/economy/clubEconomyIntegration";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { clubOrganisation, DEPARTMENT_LABEL, RESPONSIBILITY_LABEL, responsibilityCandidates, type Department } from "@/lib/staff/organisation";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { staffSpendingLimit } from "@/lib/staff/staffNegotiation";

const DEPARTMENTS: Department[] = ["LEADERSHIP", "COACHING", "RECRUITMENT", "ACADEMY", "SUPPORT"];

export function OrganisationChart() {
  const money = useMoney();
  const { career } = useCareer();
  const clubId = career.playerClubId;
  const org = clubOrganisation(career, clubId);
  const costs = getClubStaffCostsEurAnnual(career, clubId);
  const limit = staffSpendingLimit(career, clubId);
  const roster = career.staffRoster[clubId] ?? [];
  const governance = roster.filter((m) => career.staffEmployment[m.id]?.employmentType === "GOVERNANCE");
  const expiring = roster.filter((m) => { const end = career.staffEmployment[m.id]?.contractEndDate; return end && end <= `${Number(career.seasonId.slice(0, 4)) + 1}-05-31`; });
  const open = Object.values(career.staffNegotiations ?? {}).filter((n) => n.stage === "CLUB" || n.stage === "TERMS");
  const vacant = org.filter((p) => !p.holder && !p.coveredBy);
  return (
    <section className="st-org" aria-labelledby="org-title">
      <header className="xp-band st-org-band" data-tone={vacant.length ? "gold" : "ink"}>
        <div>
          <span className="xp-eyebrow">Organisation · {career.seasonId}</span>
          <h2 id="org-title">Klubbens organisation</h2>
          <p>{vacant.length ? `${vacant.length} ${vacant.length === 1 ? "tjänst är vakant" : "tjänster är vakanta"}. ` : "Alla tjänster är tillsatta. "}Antalet tjänster följer klubbens storlek; där en specialist saknas täcker någon annan rollen, som i de flesta svenska klubbar.</p>
          <div className="st-org-meter"><MeterBar label="Personalkostnad mot styrelsens ram" value={limit ? costs / limit : 0} figure={`${money.format(costs, { compact: true })} / ${money.format(limit, { compact: true })} per år`} tone={costs > limit ? "loss" : "gold"} /></div>
        </div>
        <div className="st-org-stats">
          <Stat label="Anställda" value={roster.filter((m) => career.staffEmployment[m.id]?.employmentType === "SALARIED").length} note={`${roster.length} i organisationen`} />
          <Stat label="Avtal som går ut" value={expiring.length} note="den här säsongen" />
          <Stat label="Pågående samtal" value={open.length} note={open.length ? "Svar kommer i inkorgen" : "Inga"} />
        </div>
      </header>
      <div className="st-depts">
        {DEPARTMENTS.map((dept) => (
          <div key={dept} className="st-dept">
            <h3>{DEPARTMENT_LABEL[dept]}</h3>
            {dept === "LEADERSHIP" && governance.map((g) => <div key={g.id} className="st-pos" data-state="board"><small>Styrelsen</small><Link href={`/career/staff/${encodeURIComponent(g.id)}`}>{g.displayName}</Link><span className="st-pos-meta">{g.officialRoleLabel ?? "Ideellt uppdrag"}</span></div>)}
            {org.filter((p) => p.department === dept).map((p) => {
              const e = p.holder ? career.staffEmployment[p.holder.id] : undefined;
              return (
                <div key={`${p.role}-${p.slot}`} className="st-pos" data-state={p.holder ? (p.combinedWith ? "combined" : "filled") : p.coveredBy ? "covered" : "vacant"}>
                  <small>{STAFF_ROLE_LABEL[p.role]}{p.slot > 1 ? ` ${p.slot}` : ""}</small>
                  {p.holder ? (
                    <>
                      <Link href={`/career/staff/${encodeURIComponent(p.holder.id)}`}>{p.holder.displayName}</Link>
                      <span className="st-pos-meta"><StarRating stars={roleSuitabilityStars(computeRoleSuitability(p.holder, p.role))} />{e?.employmentType === "SALARIED" ? `${money.format(e.wageEurPerMonth ?? 0)}/mån · t.o.m. ${e.contractEndDate ?? "—"}` : "Ideell"}</span>
                      {p.combinedWith && <span className="st-pos-meta">Kombinerad roll med {STAFF_ROLE_LABEL[p.combinedWith].toLowerCase()}</span>}
                    </>
                  ) : p.coveredBy ? (
                    <span className="st-pos-meta">Ingen tjänst i klubbens storlek. {STAFF_ROLE_LABEL[p.coveredBy]} täcker rollen.</span>
                  ) : (
                    <Link className="st-pos-hire" href={`/career/staff/recruitment?role=${p.role}`}>Vakant · rekrytera →</Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <details className="st-resp">
        <summary>Ansvarsområden (förberedelse för delegering)</summary>
        <ul>{responsibilityCandidates(career, clubId).map((r) => <li key={r.area}><span>{RESPONSIBILITY_LABEL[r.area]}</span><b>{r.member?.displayName ?? "Ingen"}</b><small>Du beslutar själv i dag</small></li>)}</ul>
      </details>
    </section>
  );
}
