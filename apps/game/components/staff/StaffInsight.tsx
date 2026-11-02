"use client";
// HM-ALPHA3 release readiness: the readable half of a staff dossier --
// attributes grouped by what they are used for (role-relevant first, as
// bars with the scouting uncertainty drawn as a range), a side-by-side
// with whoever does the job today, what the person would change at the
// club and what they would cost. Deliberately no single overall rating.
import Link from "next/link";
import StarRating from "@/components/StarRating";
import type { CareerState } from "@/lib/career/types";
import { getClubStaffCostsEurAnnual } from "@/lib/economy/clubEconomyIntegration";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ATTRIBUTE_LABEL, STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { academyDevelopmentFactor, bestFor, departmentQuality, recruitmentDepartmentFactor } from "@/lib/staff/organisation";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { ROLE_ATTRIBUTE_WEIGHTS } from "@/lib/staff/roleAttributeMap";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { visibleAttribute } from "@/lib/staff/staffMarket";
import { compensationDemand, dismissalCost, staffSpendingLimit, vacancyFunding, wageDemand } from "@/lib/staff/staffNegotiation";
import type { ResolvedStaffMember, StaffAttribute, StaffRole } from "@/lib/staff/types";

const GROUPS: { label: string; attrs: StaffAttribute[] }[] = [
  { label: "Träning", attrs: ["TECHNICAL_COACHING", "TACTICAL_COACHING", "ATTACKING_COACHING", "DEFENSIVE_COACHING", "GOALKEEPER_COACHING", "PHYSICAL_COACHING"] },
  { label: "Utveckling", attrs: ["PLAYER_DEVELOPMENT", "YOUTH_DEVELOPMENT"] },
  { label: "Ledarskap", attrs: ["LEADERSHIP", "COMMUNICATION", "MOTIVATION", "TEAM_ENVIRONMENT"] },
  { label: "Analys och match", attrs: ["ANALYSIS", "MATCH_PREPARATION", "TACTICAL_ASSESSMENT"] },
  { label: "Bedömning och rekrytering", attrs: ["PLAYER_JUDGEMENT", "POTENTIAL_JUDGEMENT", "RECRUITMENT", "NEGOTIATION", "NETWORK", "REGIONAL_KNOWLEDGE", "INTERNATIONAL_KNOWLEDGE"] },
  { label: "Organisation", attrs: ["SQUAD_PLANNING", "FINANCIAL_JUDGEMENT", "ORGANISATION", "LOGISTICS"] },
  { label: "Medicin", attrs: ["MEDICAL"] },
];

/** What the role changes in the game today -- only claims the code backs. */
export const ROLE_EFFECT: Record<StaffRole, string> = {
  HEAD_COACH: "Huvudtränaren leder laget. I din klubb är det du.",
  ASSISTANT_COACH: "Kan leda lagtaktik-, anfalls-, försvars- och teknikpass. Passens kvalitet följer tränarens egenskaper.",
  GOALKEEPER_COACH: "Leder målvaktsträningen. Målvakternas träningseffekt följer tränarens kvalitet.",
  PHYSICAL_COACH: "Leder fysik-, styrke- och konditionspass.",
  ANALYST: "Kan leda matchförberedelsen. Passets kvalitet följer analys och matchförberedelse.",
  PHYSIO: "Ingår i den medicinska staben som påverkar skadebehandling och återkomst.",
  SCOUT: "Gör scoutrapporter. Bedömningsförmågan styr hur säker bilden av spelare blir.",
  SPORTING_DIRECTOR: "Förhandlar: påverkar vilka löner personal begär. Nätverket ger kännedom om personal på marknaden.",
  TEAM_MANAGER: "Organisation runt laget. Ingen direkt spelpåverkan i den här versionen.",
  HEAD_OF_RECRUITMENT: "Styr scouterna: mer kunskap per scoutrapport. Nätverket ger kännedom om personal på marknaden.",
  HEAD_OF_ACADEMY: "Akademin: snabbare utveckling för spelare 21 år och yngre.",
  DEVELOPMENT_COACH: "Utvecklar unga spelare: snabbare utveckling för spelare 21 år och yngre.",
};

function weightFor(roles: StaffRole[], attr: StaffAttribute): number {
  return Math.max(0, ...roles.map((r) => ROLE_ATTRIBUTE_WEIGHTS[r][attr] ?? 0));
}

function AttributeBar({ label, value, knowledge, weight, compare }: { label: string; value: number; knowledge: number; weight: number; compare?: number }) {
  const v = visibleAttribute(value, knowledge);
  const pct = (n: number) => `${((n - 1) / 19) * 100}%`;
  return (
    <div className="si-attr" data-key={weight > 0} data-strong={v.low >= 15} data-weak={v.high <= 7}>
      <span className="si-attr-label">{label}{weight >= 0.3 ? <small> · nyckel</small> : weight > 0 ? <small> · viktig</small> : null}</span>
      <span className="si-attr-track" aria-hidden="true">
        <span className="si-attr-fill" style={{ width: pct(v.low) }} />
        {!v.exact && <span className="si-attr-range" style={{ left: pct(v.low), width: `calc(${pct(v.high)} - ${pct(v.low)})` }} data-exact="false" />}
        {compare !== undefined && <span className="si-attr-compare" style={{ left: pct(compare) }} title={`Nuvarande: ${compare}`} />}
      </span>
      <b className="si-attr-value">{v.exact ? v.low : `${v.low}–${v.high}`}</b>
    </div>
  );
}

/** Grouped attributes; the groups that matter for the roles first, the rest folded away. */
export function StaffAttributes({ member, knowledge, roles, compareWith }: { member: ResolvedStaffMember; knowledge: number; roles: StaffRole[]; compareWith?: ResolvedStaffMember }) {
  const groups = GROUPS.map((g) => ({ ...g, relevance: g.attrs.reduce((s, a) => s + weightFor(roles, a), 0) })).sort((a, b) => b.relevance - a.relevance);
  const key = groups.filter((g) => g.relevance > 0);
  const rest = groups.filter((g) => g.relevance === 0);
  const render = (g: (typeof groups)[number]) => (
    <div key={g.label} className="si-group">
      <h4>{g.label}</h4>
      {[...g.attrs].sort((a, b) => weightFor(roles, b) - weightFor(roles, a)).map((a) => <AttributeBar key={a} label={STAFF_ATTRIBUTE_LABEL[a]} value={member.profile.attributes[a].value} knowledge={knowledge} weight={weightFor(roles, a)} compare={compareWith && weightFor(roles, a) > 0 ? compareWith.profile.attributes[a].value : undefined} />)}
    </div>
  );
  return (
    <section className="si-attrs" aria-label="Egenskaper">
      <header className="si-head">
        <div><span className="xp-eyebrow">Skala 1–20</span><h3>Egenskaper för rollen</h3></div>
        <ul className="si-key" aria-label="Förklaring">
          <li><span className="si-key-bar" />Värde</li>
          {knowledge < 90 && <li><span className="si-key-bar" data-exact="false" />Osäkert intervall</li>}
          {compareWith && <li><span className="si-key-tick" />{compareWith.displayName.split(" ")[0]} i dag</li>}
        </ul>
      </header>
      <div className="si-groups">{key.map(render)}</div>
      {rest.length > 0 && <details className="si-rest"><summary>Övriga egenskaper ({rest.reduce((s, g) => s + g.attrs.length, 0)})</summary><div className="si-groups">{rest.map(render)}</div></details>}
    </section>
  );
}

/** Per-role fit: stars plus the two strengths and the weakness that explain them. */
export function RoleFit({ member, knowledge, roles }: { member: ResolvedStaffMember; knowledge: number; roles: StaffRole[] }) {
  return (
    <section className="si-fit" aria-label="Lämplighet">
      {roles.map((role) => {
        const attrs = (Object.keys(ROLE_ATTRIBUTE_WEIGHTS[role]) as StaffAttribute[]).map((a) => ({ a, v: member.profile.attributes[a].value })).sort((x, y) => y.v - x.v);
        const sure = knowledge >= 60;
        return (
          <div key={role} className="si-fit-row">
            <span className="si-fit-role">{STAFF_ROLE_LABEL[role]}</span>
            <StarRating stars={roleSuitabilityStars(computeRoleSuitability(member, role))} title="Lämplighet för rollen, bedömd från rollens egenskaper" />
            <p>{sure ? <>Styrkor: <b>{attrs.slice(0, 2).map((x) => STAFF_ATTRIBUTE_LABEL[x.a].toLowerCase()).join(", ")}</b>{attrs.length > 2 ? <> · svagast: {STAFF_ATTRIBUTE_LABEL[attrs.at(-1)!.a].toLowerCase()}</> : null}</> : "Osäker bedömning. Ta referenser för en säkrare bild."}</p>
          </div>
        );
      })}
    </section>
  );
}

function withCandidate(state: CareerState, member: ResolvedStaffMember, role: StaffRole): CareerState {
  const clubId = state.playerClubId;
  const roster = (state.staffRoster[clubId] ?? []).filter((m) => m.id !== member.id);
  return { ...state, staffRoster: { ...state.staffRoster, [clubId]: [...roster, { ...member, clubId, roles: [role] }] } };
}

const pctChange = (f: number) => `${f >= 1 ? "+" : "−"}${Math.abs(Math.round((f - 1) * 100))} %`;

/** What hiring (or keeping) this person changes: the job, the effect at the club and the money. */
export function StaffImpact({ career, member, role, mode, knowledge = 100 }: { career: CareerState; member: ResolvedStaffMember; role: StaffRole; mode: "HIRE" | "OWN"; knowledge?: number }) {
  const money = useMoney();
  const clubId = career.playerClubId;
  const current = bestFor(career, clubId, role);
  const incumbent = current && current.id !== member.id ? current : undefined;
  const after = mode === "HIRE" ? withCandidate(career, member, role) : career;
  const effect = (() => {
    if (role === "HEAD_OF_ACADEMY" || role === "DEVELOPMENT_COACH") return { label: "Utvecklingstakt, spelare ≤ 21 år", now: academyDevelopmentFactor(career, clubId), next: academyDevelopmentFactor(after, clubId) };
    if (role === "HEAD_OF_RECRUITMENT") return { label: "Kunskap per scoutrapport", now: recruitmentDepartmentFactor(career, clubId), next: recruitmentDepartmentFactor(after, clubId) };
    return { label: `Rollens kvalitet (${STAFF_ROLE_LABEL[role].toLowerCase()})`, now: departmentQuality(career, clubId, role), next: departmentQuality(after, clubId, role) };
  })();
  const costs = getClubStaffCostsEurAnnual(career, clubId);
  const limit = staffSpendingLimit(career, clubId);
  const wage = mode === "HIRE" ? wageDemand(career, member.id, clubId, role, "HIRE") : career.staffEmployment[member.id]?.wageEurPerMonth ?? 0;
  const funding = mode === "HIRE" ? vacancyFunding(career, clubId, role, "HIRE") : 0;
  const compensation = mode === "HIRE" && member.clubId && career.staffEmployment[member.id]?.clubId ? compensationDemand(career, member.id) : 0;
  const afterCosts = costs + (mode === "HIRE" ? wage * 12 : 0);
  const room = limit + funding - afterCosts;
  return (
    <section className="si-impact" aria-label="Vad personen tillför">
      <h3>{mode === "HIRE" ? "Om du anställer" : "Personens roll i klubben"}</h3>
      <p className="si-impact-effect">{ROLE_EFFECT[role]}</p>
      <dl className="si-impact-grid">
        <div><dt>{effect.label}</dt><dd>{mode === "HIRE" ? <>{pctChange(effect.now)} <span aria-hidden="true">→</span> {knowledge >= 60 ? <b data-tone={effect.next > effect.now ? "up" : effect.next < effect.now ? "down" : undefined}>{knowledge < 90 ? "≈ " : ""}{pctChange(effect.next)}</b> : <b>?</b>}</> : <b>{pctChange(effect.now)}</b>}</dd><small>{mode === "HIRE" && knowledge < 60 ? "I dag mot en genomsnittlig yrkesperson. Ta referenser för att bedöma kandidaten." : "mot en genomsnittlig yrkesperson"}</small></div>
        {mode === "HIRE" && <div><dt>Gör jobbet i dag</dt><dd>{incumbent ? <Link href={`/career/staff/${encodeURIComponent(incumbent.id)}`}>{incumbent.displayName}</Link> : "Ingen (vakant)"}</dd><small>{incumbent ? (incumbent.roles.includes(role) ? "Kandidaten blir ett komplement eller en ersättare" : `Täcks av ${STAFF_ROLE_LABEL[incumbent.roles[0]!].toLowerCase()}`) : funding ? `Vakansen har finansiering: ${money.format(funding, { compact: true })}/år` : "Ingen avsatt finansiering"}</small></div>}
        <div><dt>{mode === "HIRE" ? "Förväntad lön" : "Lön"}</dt><dd><b>{money.format(wage)}</b>/mån</dd><small>{money.format(wage * 12, { compact: true })} per år{compensation ? ` + ersättning ${money.format(compensation, { compact: true })} till klubben` : ""}</small></div>
        <div><dt>{mode === "HIRE" ? "Personalbudget efter" : "Personalbudget"}</dt><dd data-tone={room < 0 ? "down" : undefined}><b>{money.format(afterCosts, { compact: true })}</b> / {money.format(limit + funding, { compact: true })}</dd><small>{room < 0 ? `${money.format(-room, { compact: true })} över styrelsens ram -- avtalet går inte att godkänna` : `${money.format(room, { compact: true })} kvar inom ramen`}</small></div>
        {mode === "OWN" && <div><dt>Avgångsvederlag i dag</dt><dd><b>{money.format(dismissalCost(career, member.id))}</b></dd><small>resterande lön, högst sex månader</small></div>}
      </dl>
    </section>
  );
}
