"use client";
// Arena Nights 231 -- STF-01 A "Org & Responsibility Matrix": one matrix answers who does what, how well, at what
// cost and in which delegation mode -- replacing the org chart + role-count grid + staff table. Header with the
// staff cost against the board's limit and "Behov just nu"; the STF-01d mini week grid; the matrix (department
// accordions on phones); the STF-01c compact list as an alternate lens; a Peek for any holder. Own staff only,
// so fit is shown at full 1-20 resolution. Delegation changes go through the existing setDelegation.
import Link from "next/link";
import { useMemo, useState } from "react";
import { StaffMark } from "@/components/game/Secondary";
import { ROLE_EFFECT } from "@/components/staff/StaffInsight";
import { useCareer } from "@/lib/career/CareerContext";
import { setDelegation, delegateFor } from "@/lib/delegation/delegation";
import { DELEGATION_MODE_LABEL, type DelegationMode } from "@/lib/delegation/types";
import { getClubStaffCostsEurAnnual } from "@/lib/economy/clubEconomyIntegration";
import { useMoney } from "@/lib/settings/usePreferences";
import { SESSION_TYPE_LABEL } from "@/lib/training/labels";
import { STAFF_ATTRIBUTE_LABEL, STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { DEPARTMENT_LABEL, RESPONSIBILITY_LABEL, type ResponsibilityArea } from "@/lib/staff/organisation";
import { ROLE_ATTRIBUTE_WEIGHTS } from "@/lib/staff/roleAttributeMap";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { initials, organisationMatrix, unassignedAreas, weekGrid, type MatrixGroup, type MatrixRow } from "@/lib/staff/staffDesk";
import { staffSpendingLimit, vacancyFunding } from "@/lib/staff/staffNegotiation";
import type { StaffAttribute } from "@/lib/staff/types";
import { OrganisationChart } from "@/components/staff/OrganisationChart";
import { FitBar } from "@/components/staff/FitBar";

const MODES: DelegationMode[] = ["MANAGER", "ADVISE", "DELEGATE"];
const WEEKDAY = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

// --- Header: cost vs board limit + Behov just nu ---------------------------------------------------

export function OrgHeader({ groups, onPeek }: { groups: MatrixGroup[]; onPeek: (id: string) => void }) {
  const money = useMoney();
  const { career } = useCareer();
  const clubId = career.playerClubId;
  const costs = getClubStaffCostsEurAnnual(career, clubId);
  const limit = staffSpendingLimit(career, clubId);
  const rows = groups.flatMap((g) => g.rows);
  const vacant = rows.filter((r) => r.state === "vacant");
  const weak = rows.filter((r) => r.tone === "weak");
  const expiring = rows.filter((r) => r.expiring);
  const open = Object.values(career.staffNegotiations ?? {}).filter((n) => n.stage === "CLUB" || n.stage === "TERMS").length;
  const over = costs > limit;
  return (
    <section className="sf-head" aria-labelledby="sf-head-title">
      <div className="sf-cost">
        <span className="xp-eyebrow">Organisation · {career.seasonId}</span>
        <h2 id="sf-head-title">Personalkostnad mot styrelsens ram</h2>
        <div className="sf-cost-bar" data-over={over || undefined} role="meter" aria-valuemin={0} aria-valuemax={Math.round(limit)} aria-valuenow={Math.round(costs)} aria-label="Personalkostnad mot ram"><i style={{ width: `${Math.min(100, limit ? (costs / limit) * 100 : 0)}%` }} /></div>
        <p className="sf-num"><b>{money.format(costs, { compact: true })}</b> av {money.format(limit, { compact: true })} per år · {over ? <span className="sf-neg">{money.format(costs - limit, { compact: true })} över ramen</span> : <>{money.format(limit - costs, { compact: true })} kvar</>}</p>
        <dl className="sf-stats">
          <div><dt>Vakanta</dt><dd className="sf-num">{vacant.length}</dd></div>
          <div><dt>Svag passform</dt><dd className="sf-num">{weak.length}</dd></div>
          <div><dt>Avtal går ut</dt><dd className="sf-num">{expiring.length}</dd></div>
          <div><dt>Samtal pågår</dt><dd className="sf-num">{open}</dd></div>
        </dl>
      </div>
      <div className="sf-needs">
        <h3>Behov just nu</h3>
        {vacant.length + expiring.length + weak.length === 0 ? <p className="sf-hint">Alla tjänster är tillsatta och inga avtal går ut inom fyra månader.</p> : (
          <ul>
            {vacant.map((r) => { const f = r.role ? vacancyFunding(career, clubId, r.role, "HIRE") : 0; return <li key={`v-${r.key}`}><span className="sf-kind" data-kind="vacant">Vakant</span><span><b>{r.role ? STAFF_ROLE_LABEL[r.role] : ""}</b><small>{r.role ? ROLE_EFFECT[r.role] : ""}{f ? ` Finansiering ${money.format(f, { compact: true })}/år.` : ""}</small></span><Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/staff/recruitment?role=${r.role}`}>Visa kandidater</Link></li>; })}
            {expiring.map((r) => <li key={`e-${r.key}`}><span className="sf-kind" data-kind="expiring">Avtal</span><span><b>{r.holderName}</b><small>{r.role ? STAFF_ROLE_LABEL[r.role] : ""}, avtalet går ut {r.contractEnd}</small></span><Link className="hm-btn hm-btn-sm" href={`/career/staff/${encodeURIComponent(r.holderId!)}`}>Förläng</Link></li>)}
            {weak.slice(0, 3).map((r) => <li key={`w-${r.key}`}><span className="sf-kind" data-kind="weak">Svag</span><span><b>{r.holderName}</b><small>{r.role ? STAFF_ROLE_LABEL[r.role] : ""} · lämplighet {r.fit}/20</small></span><button type="button" className="hm-btn hm-btn-sm" onClick={() => onPeek(r.holderId!)}>Visa</button></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

// --- STF-01d mini week grid --------------------------------------------------------------------------

export function WeekGrid() {
  const { career } = useCareer();
  const days = weekGrid(career);
  const total = days.reduce((n, d) => n + d.sessions.length, 0);
  return (
    <section className="sf-week" aria-labelledby="sf-week-title">
      <header><h3 id="sf-week-title">Veckans tränaransvar</h3><Link className="sf-more" href="/career/training">Träningsvecka →</Link></header>
      <ol>
        {days.map((d, i) => (
          <li key={d.date} data-type={d.dayType} data-today={d.today || undefined}>
            <Link href="/career/training" aria-label={`${WEEKDAY[i]} ${d.date}: ${d.sessions.length ? d.sessions.map((s) => `${SESSION_TYPE_LABEL[s.type]}${s.coachName ? `, ${s.coachName}` : ""}`).join("; ") : d.dayType === "MATCH" ? "match" : "inget pass"}`}>
              <small>{WEEKDAY[i]} <span className="sf-num">{d.date.slice(8)}</span></small>
              {d.dayType === "MATCH" ? <span className="sf-day-tag">Match</span> : d.sessions.length === 0 ? <span className="sf-day-tag" data-quiet>{d.dayType === "REST" ? "Vila" : d.dayType === "TRAVEL" ? "Resa" : "—"}</span> : d.sessions.map((s, j) => (
                <span key={j} className="sf-sess" data-session={s.type} title={`${SESSION_TYPE_LABEL[s.type]} · ${s.coachName ?? "ingen ansvarig tränare"}`}><i>{s.coachName ? initials(s.coachName) : "?"}</i><em>{SESSION_TYPE_LABEL[s.type]}</em></span>
              ))}
            </Link>
          </li>
        ))}
      </ol>
      {total === 0 && <p className="sf-hint">Inga registrerade träningspass den här veckan.</p>}
    </section>
  );
}

// --- The matrix ------------------------------------------------------------------------------------

function ModeControl({ area, mode, delegable }: { area: ResponsibilityArea; mode: DelegationMode; delegable: boolean }) {
  const { career, updateCareer } = useCareer();
  if (!delegable) return <span className="sf-area"><small>{RESPONSIBILITY_LABEL[area]}</small><span className="sf-chip">Du själv · ej delegerbart</span></span>;
  const who = delegateFor(career, area);
  return (
    <span className="sf-area">
      <small>{RESPONSIBILITY_LABEL[area]}</small>
      <span className="sf-modes" role="radiogroup" aria-label={`Läge för ${RESPONSIBILITY_LABEL[area]}`}>
        {MODES.map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => who && updateCareer((s) => setDelegation(s, area, m, who.staffId))}>{DELEGATION_MODE_LABEL[m]}</button>)}
      </span>
    </span>
  );
}

function HolderCell({ r, onPeek }: { r: MatrixRow; onPeek: (id: string) => void }) {
  if (r.state === "vacant") return <span className="sf-vacant"><b>Vakant</b><Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/staff/recruitment?role=${r.role}`}>Visa kandidater</Link></span>;
  if (r.state === "manager") return <span className="sf-holder"><StaffMark name="Du" size={26} /><span><Link href="/career/manager">Du (manager)</Link><small>Du leder laget som huvudtränare</small></span></span>;
  if (r.state === "covered") return <span className="sf-covered">Ingen tjänst i klubbens storlek. {r.coveredBy ? `${STAFF_ROLE_LABEL[r.coveredBy]} täcker rollen.` : ""}</span>;
  return (
    <span className="sf-holder">
      <StaffMark name={r.holderName ?? ""} size={26} />
      <span><button type="button" className="sf-linkish" onClick={() => onPeek(r.holderId!)}>{r.holderName}</button>{r.state === "combined" && r.combinedWith ? <small>Kombinerad roll med {STAFF_ROLE_LABEL[r.combinedWith].toLowerCase()}</small> : r.state === "board" ? <small>{r.boardLabel}</small> : null}</span>
    </span>
  );
}

export function OrgMatrix({ groups, onPeek }: { groups: MatrixGroup[]; onPeek: (id: string) => void }) {
  const money = useMoney();
  const { career } = useCareer();
  const nobody = unassignedAreas(career);
  return (
    <div className="sf-matrix" id="matrix">
      <div className="sf-matrix-cols" aria-hidden="true"><span>Tjänst</span><span>Innehavare</span><span>Lämplighet 1–20</span><span>Lön · avtal</span><span>Ansvar och läge</span><span>Pass</span></div>
      {groups.map((g) => (
        <details key={g.department} className="sf-dept" open>
          <summary><b>{DEPARTMENT_LABEL[g.department]}</b><span className="sf-num">{g.rows.length} {g.rows.length === 1 ? "tjänst" : "tjänster"}{g.vacant ? ` · ${g.vacant} vakant` : ""}{g.weak ? ` · ${g.weak} svag` : ""}</span></summary>
          <ul>
            {g.rows.map((r) => (
              <li key={r.key} className="sf-row" data-state={r.state} data-tone={r.tone ?? undefined}>
                <span className="sf-pos" data-label="Tjänst"><b>{r.role ? STAFF_ROLE_LABEL[r.role] : "Styrelsen"}{r.slot > 1 ? ` ${r.slot}` : ""}</b></span>
                <span className="sf-cell" data-label="Innehavare"><HolderCell r={r} onPeek={onPeek} /></span>
                <span className="sf-cell" data-label="Lämplighet">{r.fit !== null ? <FitBar value={r.fit} /> : <span className="sf-dim">—</span>}</span>
                <span className="sf-cell sf-num" data-label="Lön · avtal">{r.wageEurPerMonth !== null ? <><b>{money.format(r.wageEurPerMonth)}</b>/mån<small data-expiring={r.expiring || undefined}>t.o.m. {r.contractEnd ?? "—"}</small></> : r.holderId ? <small>Ideell</small> : <span className="sf-dim">—</span>}</span>
                <span className="sf-cell sf-areas" data-label="Ansvar och läge">{r.areas.length ? r.areas.map((a) => <ModeControl key={a.area} {...a} />) : <span className="sf-dim">—</span>}</span>
                <span className="sf-cell sf-num" data-label="Pass denna vecka">{r.sessions || <span className="sf-dim">0</span>}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      {nobody.length > 0 && <p className="sf-hint">Ingen i klubben bär {nobody.map((a) => RESPONSIBILITY_LABEL[a].toLowerCase()).join(", ")} -- du gör det själv.</p>}
    </div>
  );
}

// --- STF-01c compact list ------------------------------------------------------------------------

type ListSort = "name" | "role" | "fit";

export function StaffList({ onPeek }: { onPeek: (id: string) => void }) {
  const { career } = useCareer();
  const [sort, setSort] = useState<ListSort>("fit");
  const [desc, setDesc] = useState(true);
  const roster = useMemo(() => career.staffRoster[career.playerClubId] ?? [], [career]);
  const rows = roster.map((m) => {
    const role = m.roles[0];
    const fit = role ? Math.round(computeRoleSuitability(m, role) * 10) / 10 : null;
    const top = role ? (Object.keys(ROLE_ATTRIBUTE_WEIGHTS[role]) as StaffAttribute[]).map((a) => ({ a, v: m.profile.attributes[a].value })).sort((x, y) => (ROLE_ATTRIBUTE_WEIGHTS[role][y.a] ?? 0) - (ROLE_ATTRIBUTE_WEIGHTS[role][x.a] ?? 0)).slice(0, 3) : [];
    return { m, role, fit, top };
  }).sort((a, b) => {
    const cmp = sort === "name" ? a.m.displayName.localeCompare(b.m.displayName, "sv") : sort === "role" ? (a.role ? STAFF_ROLE_LABEL[a.role] : a.m.officialRoleLabel ?? "").localeCompare(b.role ? STAFF_ROLE_LABEL[b.role] : b.m.officialRoleLabel ?? "", "sv") : (a.fit ?? -1) - (b.fit ?? -1);
    return (desc ? -cmp : cmp) || a.m.id.localeCompare(b.m.id);
  });
  const th = (key: ListSort, label: string) => <th aria-sort={sort === key ? (desc ? "descending" : "ascending") : "none"}><button type="button" className="sf-sort" onClick={() => { if (sort === key) setDesc(!desc); else { setSort(key); setDesc(key === "fit"); } }}>{label}{sort === key ? (desc ? " ↓" : " ↑") : ""}</button></th>;
  return (
    <div className="sf-list-wrap">
      <table className="hm-table sf-list">
        <thead><tr>{th("name", "Namn")}{th("role", "Roll")}{th("fit", "Lämplighet")}<th>Rollens viktigaste egenskaper</th></tr></thead>
        <tbody>
          {rows.map(({ m, fit, top }) => (
            <tr key={m.id}>
              <td data-label="Namn"><span className="sf-holder"><StaffMark name={m.displayName} size={26} /><button type="button" className="sf-linkish" onClick={() => onPeek(m.id)}>{m.displayName}</button></span></td>
              <td data-label="Roll">{m.roles.length ? m.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" + ") : m.officialRoleLabel ?? "—"}</td>
              <td data-label="Lämplighet">{fit !== null ? <FitBar value={fit} /> : "—"}</td>
              <td data-label="Egenskaper">{top.length ? <span className="sf-attrs">{top.map((x) => <span key={x.a}>{STAFF_ATTRIBUTE_LABEL[x.a]} <b className="sf-num">{x.v}</b></span>)}</span> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="sf-hint">Klubben har ingen registrerad personal. <Link href="/career/staff/recruitment">Rekrytera personal →</Link></p>}
    </div>
  );
}

// --- Peek -------------------------------------------------------------------------------------------

export function StaffPeek({ staffId, groups, onClose }: { staffId: string; groups: MatrixGroup[]; onClose: () => void }) {
  const money = useMoney();
  const { career } = useCareer();
  const member = (career.staffRoster[career.playerClubId] ?? []).find((m) => m.id === staffId);
  if (!member) return null;
  const rows = groups.flatMap((g) => g.rows).filter((r) => r.holderId === staffId);
  const e = career.staffEmployment[staffId];
  return (
    <>
      <button type="button" className="sf-scrim" aria-label="Stäng" tabIndex={-1} onClick={onClose} />
      <aside className="sf-peek" aria-label={`Personal: ${member.displayName}`}>
        <header><StaffMark name={member.displayName} size={44} /><div><small>{member.roles.length ? member.roles.map((r) => STAFF_ROLE_LABEL[r]).join(" · ") : member.officialRoleLabel ?? "Personal"}</small><h3>{member.displayName}</h3></div><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose}>Stäng</button></header>
        <div className="sf-peek-body">
          {member.roles.map((role) => <div key={role} className="sf-peek-fit"><span>{STAFF_ROLE_LABEL[role]}</span><FitBar value={Math.round(computeRoleSuitability(member, role) * 10) / 10} /></div>)}
          <dl className="sf-facts">
            <div><dt>Anställning</dt><dd>{e?.employmentType === "SALARIED" ? <span className="sf-num">{money.format(e.wageEurPerMonth ?? 0)}/mån · t.o.m. {e.contractEndDate ?? "—"}</span> : e?.employmentType === "GOVERNANCE" ? "Styrelseuppdrag" : "Ideell"}</dd></div>
            <div><dt>Pass denna vecka</dt><dd className="sf-num">{rows.reduce((n, r) => Math.max(n, r.sessions), 0)}</dd></div>
            <div><dt>Ansvar</dt><dd>{rows.flatMap((r) => r.areas).map((a) => `${RESPONSIBILITY_LABEL[a.area]} (${DELEGATION_MODE_LABEL[a.mode].toLowerCase()})`).join(", ") || "—"}</dd></div>
          </dl>
          {member.roles[0] && <p className="sf-hint">{ROLE_EFFECT[member.roles[0]]}</p>}
        </div>
        <footer><Link className="hm-btn hm-btn-primary" href={`/career/staff/${encodeURIComponent(staffId)}`}>Öppna profilen →</Link>{rows.some((r) => r.expiring) && <Link className="hm-btn" href={`/career/staff/${encodeURIComponent(staffId)}`}>Förläng avtalet</Link>}</footer>
      </aside>
    </>
  );
}

// --- The page body: header, view toggle, lens, peek -------------------------------------------------

export function StaffOrganisation() {
  const { career } = useCareer();
  const groups = useMemo(() => organisationMatrix(career), [career]);
  const [view, setView] = useState<"MATRIX" | "TREE" | "LIST">("MATRIX");
  const [peek, setPeek] = useState<string | null>(null);
  return (
    <div className="sf-org">
      <OrgHeader groups={groups} onPeek={setPeek} />
      <WeekGrid />
      <div className="sf-lens">
        <div className="sf-toggle" role="tablist" aria-label="Visning">
          {([["MATRIX", "Matris"], ["TREE", "Träd"], ["LIST", "Lista"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <span className="sf-hint">{view === "MATRIX" ? "Vakanser och svaga passformer först. Ändra läget direkt i raden." : view === "TREE" ? "Färgen visar passformen: grön bra, gul godtagbar, röd svag, streckad vakant." : "Sortera på namn, roll eller lämplighet."}</span>
      </div>
      {view === "MATRIX" ? <OrgMatrix groups={groups} onPeek={setPeek} /> : view === "TREE" ? <OrganisationChart groups={groups} onPeek={setPeek} /> : <StaffList onPeek={setPeek} />}
      {peek && <StaffPeek staffId={peek} groups={groups} onClose={() => setPeek(null)} />}
    </div>
  );
}
