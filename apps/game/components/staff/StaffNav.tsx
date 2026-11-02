"use client";
// HM-PLAYTEST-01 4.2: recruitment is a first-class part of Staff Management.
// One navigation across organisation, vacancies, market, negotiations and responsibilities.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCareer } from "@/lib/career/CareerContext";
import { vacancies } from "@/lib/staff/organisation";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";

export function StaffNav() {
  const { career } = useCareer();
  const path = usePathname();
  const params = useSearchParams();
  const open = Object.values(career.staffNegotiations ?? {}).filter((n) => n.stage === "CLUB" || n.stage === "TERMS").length;
  const vacant = vacancies(career, career.playerClubId).length;
  const view = params.get("view");
  const items: { href: string; label: string; badge?: number; current: boolean }[] = [
    { href: "/career/staff", label: "Organisation", current: path === "/career/staff" },
    { href: "/career/staff/recruitment?view=vacancies", label: "Vakanser", badge: vacant, current: path === "/career/staff/recruitment" && view === "vacancies" },
    { href: "/career/staff/recruitment", label: "Rekryteringsmarknad", current: path === "/career/staff/recruitment" && !view },
    { href: "/career/staff/recruitment?view=negotiations", label: "Förhandlingar", badge: open, current: path === "/career/staff/recruitment" && view === "negotiations" },
    { href: "/career/staff/responsibilities", label: "Ansvarsområden", current: path === "/career/staff/responsibilities" },
  ];
  return <nav className="hm-subnav" aria-label="Personal">{items.map((i) => <Link key={i.label} href={i.href} aria-current={i.current ? "page" : undefined}>{i.label}{i.badge ? <b>{i.badge}</b> : null}</Link>)}</nav>;
}

/** The vacancies and negotiations views of the recruitment workspace. The market view is StaffMarketBoard. */
export function StaffRecruitmentView() {
  const { career } = useCareer();
  const view = useSearchParams().get("view");
  if (view === "vacancies") {
    const list = vacancies(career, career.playerClubId);
    return (
      <section className="hm-plan-section" aria-labelledby="vac-title">
        <header><h2 id="vac-title">Vakanta tjänster</h2><p>Tjänster klubbens storlek ger plats för men som ingen har i dag. Välj en roll för att se kandidater på marknaden.</p></header>
        {list.length === 0 ? <p className="hm-plan-note">Alla tjänster är tillsatta.</p> : <ul className="hm-link-list">{list.map((p) => <li key={`${p.role}-${p.slot}`}><span>{STAFF_ROLE_LABEL[p.role]}</span><Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/staff/recruitment?role=${p.role}`}>Visa kandidater →</Link></li>)}</ul>}
      </section>
    );
  }
  if (view === "negotiations") {
    const all = Object.values(career.staffNegotiations ?? {}).sort((a, b) => b.id.localeCompare(a.id));
    const open = all.filter((n) => n.stage === "CLUB" || n.stage === "TERMS");
    const name = (id: string) => Object.values(career.staffRoster).flat().find((m) => m.id === id)?.displayName ?? career.staffMarket?.freeAgents[id]?.displayName ?? id;
    return (
      <section className="hm-plan-section" aria-labelledby="neg-title">
        <header><h2 id="neg-title">Förhandlingar</h2><p>Pågående och avslutade samtal med personal. Svar kommer i inkorgen; öppna personens profil för att lägga ett nytt bud.</p></header>
        {all.length === 0 ? <p className="hm-plan-note">Inga förhandlingar ännu. Hitta en kandidat på rekryteringsmarknaden.</p> : <ul className="hm-link-list">{all.slice(0, 20).map((n) => <li key={n.id}><span><b>{name(n.staffId)}</b> · {STAFF_ROLE_LABEL[n.role]} · {n.kind === "HIRE" ? "rekrytering" : "förlängning"}</span><span className="hm-status" data-tone={open.includes(n) ? "warn" : "neutral"}>{open.includes(n) ? "Pågår" : "Avslutad"}</span><Link href={`/career/staff/${encodeURIComponent(n.staffId)}?from=recruitment`}>Profil →</Link></li>)}</ul>}
      </section>
    );
  }
  return null;
}
