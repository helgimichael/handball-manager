"use client";

// HM-STAFF-CAREER-1.0 Part 4: browse recruitable staff candidates from
// every OTHER club in the competition. "Identify candidate" step of the
// recruitment flow -- clicking a row goes to their full profile
// (app/career/staff/[staffId]/page.tsx), where the actual offer/contract
// form lives (Part 4: "se profil" -> "erbjuda roll/kontrakt/lön" are two
// separate steps, not squeezed onto one screen).
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { isStaffRecruitable } from "@/lib/staff/staffRecruitment";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { getScoutMarket } from "@/lib/staff/scoutPool";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import type { ResolvedStaffMember, StaffRole } from "@/lib/staff/types";
import StarRating from "@/components/StarRating";
import { SectionScene, StaffMark } from "@/components/game/Secondary";
import { ClubLink } from "@/components/entityLinks";
import { SortableTh, applySortDirection, type SortState } from "@/components/SortableTh";
import { StaffMarketBoard } from "@/components/staff/StaffMarketBoard";

type SortKey = "name" | "club" | "role" | "suitability" | "wage";

interface Candidate {
  member: ResolvedStaffMember;
  clubName: string;
  role: StaffRole;
  suitability: number;
  wageEurPerMonth: number;
}

export default function StaffRecruitmentPage() {
  useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const [roleFilter, setRoleFilter] = useState<StaffRole | "ALL">("ALL");
  const [sort, setSort] = useState<SortState<SortKey> | null>(null);

  const candidates = useMemo<Candidate[]>(() => {
    const list: Candidate[] = [];
    for (const [clubId, roster] of Object.entries(career.staffRoster)) {
      if (clubId === career.playerClubId) continue;
      const clubName = getClub(clubId)?.name ?? clubId;
      for (const member of roster) {
        if (!isStaffRecruitable(career, member.id)) continue;
        const role = member.roles[0];
        if (!role) continue;
        list.push({
          member,
          clubName,
          role,
          suitability: computeRoleSuitability(member, role),
          wageEurPerMonth: career.staffEmployment[member.id]?.wageEurPerMonth ?? 0,
        });
      }
    }
    return list;
  }, [career]);

  const freeAgentScouts = getScoutMarket(career);

  const availableRoles = useMemo(() => Array.from(new Set(candidates.map((c) => c.role))).sort(), [candidates]);

  const filtered = roleFilter === "ALL" ? candidates : candidates.filter((c) => c.role === roleFilter);

  const rows = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => {
      let cmp: number;
      switch (sort.key) {
        case "name":
          cmp = a.member.displayName.localeCompare(b.member.displayName);
          break;
        case "club":
          cmp = a.clubName.localeCompare(b.clubName);
          break;
        case "role":
          cmp = STAFF_ROLE_LABEL[a.role].localeCompare(STAFF_ROLE_LABEL[b.role]);
          break;
        case "suitability":
          cmp = a.suitability - b.suitability;
          break;
        case "wage":
          cmp = a.wageEurPerMonth - b.wageEurPerMonth;
          break;
        default:
          cmp = 0;
      }
      return applySortDirection(sort.direction, cmp);
    });
  }, [filtered, sort]);

  return (
    <div className="game-secondary-page">
      <SectionScene eyebrow={`Laget runt laget · ${career.seasonId}`} title="Rekrytera personal" description="Bedöm en person för rätt roll. Öppna profilen för egenskaper, anställning och ett konkret erbjudande." actions={<Link className="hm-btn hm-btn-sm" href="/career/staff">← Personal</Link>}><div><strong>{candidates.length}</strong><small>personer från klubbar</small></div><div><strong>{freeAgentScouts.length}</strong><small>fria scouter</small></div></SectionScene>
      {/* HM-ALPHA3-M04: discovery across every role -- free agents and staff under contract. */}
      <Suspense><StaffMarketBoard /></Suspense>
      <div className="game-secondary-split game-staff-recruitment">
        <aside className="game-secondary-rail" aria-label="Tillgängliga scouter">
                {freeAgentScouts.length > 0 ? (
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Fria scouter</span>
          </div>
          <div className="hm-scroll-x game-staff-market-table">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Lämplighet</th>
                </tr>
              </thead>
              <tbody>
                {freeAgentScouts.map((scout) => (
                  <tr key={scout.id}>
                    <td className="hm-td-strong">
                      <Link href={`/career/staff/${encodeURIComponent(scout.id)}?from=recruitment`}>{scout.displayName}</Link>
                    </td>
                    <td>
                      <StarRating stars={roleSuitabilityStars(computeRoleSuitability(scout, "SCOUT"))} title="Bedömd lämplighet för scoutrollen" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
          <section className="game-secondary-note"><h2>Rätt person för rollen</h2><p>Lämplighet bygger på personens relevanta egenskaper. Fria scouter kan värvas direkt; klubbpersonal behöver ha en anställning som går att lämna.</p><Link href="/career/scouting">Öppna scoutingarbetet →</Link></section>
        </aside>
        <div className="game-secondary-main">
                <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Rekrytering — Personal</span>
          <Link href="/career/staff" className="hm-btn hm-btn-sm hm-btn-ghost">
            ← Personal
          </Link>
        </div>
      <div className="hm-panel-body" style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 0 }}>
        {(["ALL", ...availableRoles] as const).map((role) => (
          <button
            key={role}
            type="button"
            className="hm-btn hm-btn-sm"
            style={{
              background: roleFilter === role ? "var(--hm-accent)" : undefined,
              borderColor: roleFilter === role ? "var(--hm-accent)" : undefined,
              color: roleFilter === role ? "#fff" : undefined,
            }}
            onClick={() => setRoleFilter(role)}
          >
            {role === "ALL" ? "ALLA" : STAFF_ROLE_LABEL[role]}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="hm-panel-body hm-text-muted">Inga rekryteringsbara kandidater hittades (endast avlönad personal med kontrakt kan värvas).</div>
      ) : (
        <div className="hm-scroll-x game-staff-market-table">
          <table className="hm-table">
            <thead>
              <tr>
                <SortableTh label="Namn" sortKey="name" sort={sort} onSort={setSort} />
                <SortableTh label="Nuvarande klubb" sortKey="club" sort={sort} onSort={setSort} />
                <SortableTh label="Roll" sortKey="role" sort={sort} onSort={setSort} />
                <SortableTh label="Lämplighet" sortKey="suitability" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
                <SortableTh label="Nuvarande lön" sortKey="wage" sort={sort} onSort={setSort} numeric defaultDirection="desc" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, clubName, role, suitability, wageEurPerMonth }) => (
                <tr key={member.id}>
                  <td className="hm-td-strong">
                    <div className="game-staff-cell"><StaffMark name={member.displayName} size={30} /><Link href={`/career/staff/${encodeURIComponent(member.id)}?from=recruitment`}>{member.displayName}</Link></div>
                  </td>
                  <td><ClubLink clubId={member.clubId}>{clubName}</ClubLink></td>
                  <td>{STAFF_ROLE_LABEL[role]}</td>
                  <td>
                    <StarRating stars={roleSuitabilityStars(suitability)} title="Bedömd lämplighet för rollen" />
                  </td>
                  <td>{formatMoney(wageEurPerMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
        Endast avlönad personal (huvudtränare, assisterande tränare, specialister m.fl.) kan värvas -- frivillig eller styrelseliknande personal har ingen anställning att lämna.
      </div>
      </div>

        </div>
      </div>
    </div>
  );
}
