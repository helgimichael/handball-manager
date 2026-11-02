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
import { staffSpendingLimit, vacancyFunding } from "@/lib/staff/staffNegotiation";
import { ROLE_EFFECT } from "@/components/staff/StaffInsight";
import { modeOf } from "@/lib/delegation/delegation";
import { DELEGATION_MODE_LABEL } from "@/lib/delegation/types";
import { daysBetween } from "@/lib/career/dateUtils";

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
  const vacant = org.filter((p) => !p.holder && !p.coveredBy && !p.managerHeld);
  // Needs: vacant positions first, then contracts ending within four months.
  const soon = roster.filter((m) => { const e = career.staffEmployment[m.id]; return e?.employmentType === "SALARIED" && e.contractEndDate && daysBetween(career.gameDate, e.contractEndDate) <= 120; });
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
      {(vacant.length > 0 || soon.length > 0) && (
        <section className="st-needs" aria-labelledby="needs-title">
          <h3 id="needs-title">Behov just nu</h3>
          <ul>
            {vacant.map((p) => { const funding = vacancyFunding(career, clubId, p.role, "HIRE"); return (
              <li key={`v-${p.role}-${p.slot}`}><span className="st-need-kind">Vakant</span><span><b>{STAFF_ROLE_LABEL[p.role]}</b> <small>· {ROLE_EFFECT[p.role]}{funding ? ` Finansiering: ${money.format(funding, { compact: true })}/år.` : ""}</small></span><Link className="hm-btn hm-btn-sm" href={`/career/staff/recruitment?role=${p.role}`}>Rekrytera</Link></li>
            ); })}
            {soon.map((m) => (
              <li key={`e-${m.id}`}><span className="st-need-kind" data-kind="expiring">Avtal</span><span><b>{m.displayName}</b> <small>· {STAFF_ROLE_LABEL[m.roles[0] ?? "SCOUT"]}, avtalet går ut {career.staffEmployment[m.id]?.contractEndDate}</small></span><Link className="hm-btn hm-btn-sm" href={`/career/staff/${encodeURIComponent(m.id)}`}>Förläng</Link></li>
            ))}
          </ul>
        </section>
      )}
      <div className="st-depts">
        {DEPARTMENTS.map((dept) => (
          <div key={dept} className="st-dept">
            <h3>{DEPARTMENT_LABEL[dept]}</h3>
            {dept === "LEADERSHIP" && governance.map((g) => <div key={g.id} className="st-pos" data-state="board"><small>Styrelsen</small><Link href={`/career/staff/${encodeURIComponent(g.id)}`}>{g.displayName}</Link><span className="st-pos-meta">{g.officialRoleLabel ?? "Ideellt uppdrag"}</span></div>)}
            {org.filter((p) => p.department === dept).map((p) => {
              const e = p.holder ? career.staffEmployment[p.holder.id] : undefined;
              return (
                <div key={`${p.role}-${p.slot}`} className="st-pos" data-state={p.holder || p.managerHeld ? (p.combinedWith ? "combined" : "filled") : p.coveredBy ? "covered" : "vacant"}>
                  <small>{STAFF_ROLE_LABEL[p.role]}{p.slot > 1 ? ` ${p.slot}` : ""}</small>
                  {p.holder ? (
                    <>
                      <Link href={`/career/staff/${encodeURIComponent(p.holder.id)}`}>{p.holder.displayName}</Link>
                      <span className="st-pos-meta"><StarRating stars={roleSuitabilityStars(computeRoleSuitability(p.holder, p.role))} />{e?.employmentType === "SALARIED" ? `${money.format(e.wageEurPerMonth ?? 0)}/mån · t.o.m. ${e.contractEndDate ?? "—"}` : "Ideell"}</span>
                      {p.combinedWith && <span className="st-pos-meta">Kombinerad roll med {STAFF_ROLE_LABEL[p.combinedWith].toLowerCase()}</span>}
                    </>
                  ) : p.managerHeld ? (
                    <><Link href="/career/manager">Du (manager)</Link><span className="st-pos-meta">Du leder laget som huvudtränare</span></>
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
        <summary>Ansvarsområden · <Link href="/career/staff/responsibilities">Ansvarsfördelning →</Link></summary>
        <ul>{responsibilityCandidates(career, clubId).map((r) => <li key={r.area}><span>{RESPONSIBILITY_LABEL[r.area]}</span><b>{r.member?.displayName ?? "Ingen"}</b><small>{DELEGATION_MODE_LABEL[modeOf(career, r.area)]}</small></li>)}</ul>
      </details>
    </section>
  );
}
