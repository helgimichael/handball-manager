"use client";

// Arena Nights 231 -- STF-03 B "Vacancy-led hiring". Hiring starts from a vacancy: vacancy cards with what is
// missing and the budget room (STF-03a), plus "Alla roller" for browsing; picking one filters the single staff
// market (STF-03c) to a ranked candidate list with fit ranges and "Mot i dag". Negotiations are a filter chip
// showing the board by whose move it is (STF-03b). STF-03d: the legacy "Fria scouter" and "Rekrytering --
// Personal" tables are gone -- both lists are part of the market (free scouts and salaried staff at other clubs
// are in marketCandidates), and its role filter and sort cover what they offered. The offer itself is made on
// the person's dossier (app/career/staff/[staffId]).
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionScene } from "@/components/game/Secondary";
import { StaffMarketBoard } from "@/components/staff/StaffMarketBoard";
import { NegotiationBoard, StaffNav, VacancyCards } from "@/components/staff/StaffNav";
import { DelegationToggle } from "@/components/staff/DelegationToggle";
import { useCareer } from "@/lib/career/CareerContext";
import { vacancies } from "@/lib/staff/organisation";
import { negotiationBoard } from "@/lib/staff/staffDesk";
import { marketCandidates } from "@/lib/staff/staffMarket";
import { STAFF_ROLES, type StaffRole } from "@/lib/staff/types";

export default function StaffRecruitmentPage() { return <Suspense><StaffRecruitment /></Suspense>; }

function StaffRecruitment() {
  const { career } = useCareer();
  const params = useSearchParams();
  const router = useRouter();
  const view = params.get("view") === "negotiations" ? "NEGOTIATIONS" : "VACANCIES";
  const [role, setRoleState] = useState<StaffRole | "ALL">(STAFF_ROLES.find((r) => r === params.get("role")) ?? "ALL");
  const setRole = (r: StaffRole | "ALL") => { setRoleState(r); router.replace(r === "ALL" ? "/career/staff/recruitment" : `/career/staff/recruitment?role=${r}`, { scroll: false }); };
  const vacant = vacancies(career, career.playerClubId).length;
  const board = negotiationBoard(career);
  const openCount = board.YOUR_MOVE.length + board.WAITING.length;
  const pool = marketCandidates(career);

  return (
    <div className="game-secondary-page sf-page">
      <SectionScene eyebrow={`Laget runt laget · ${career.seasonId}`} title="Rekrytera personal" description="Börja i vakansen: vad saknas, vad får det kosta och vem passar bäst. Erbjudandet läggs på personens profil." actions={<Link className="hm-btn hm-btn-sm" href="/career/staff">← Personal</Link>}><div><strong>{pool.length}</strong><small>personer på marknaden</small></div><div><strong>{pool.filter((c) => c.status === "FREE_AGENT").length}</strong><small>fria agenter</small></div></SectionScene>
      <StaffNav />
      <div className="sf-chiprow" role="tablist" aria-label="Rekrytering">
        <Link role="tab" aria-selected={view === "VACANCIES"} className="sf-chip-tab" href="/career/staff/recruitment">Vakanser & marknad{vacant ? <b className="sf-num"> {vacant}</b> : null}</Link>
        <Link role="tab" aria-selected={view === "NEGOTIATIONS"} className="sf-chip-tab" href="/career/staff/recruitment?view=negotiations">Förhandlingar{openCount ? <b className="sf-num"> {openCount}</b> : null}</Link>
        <DelegationToggle area="STAFF_HIRING" compact />
      </div>
      {view === "NEGOTIATIONS" ? <NegotiationBoard /> : (
        <>
          <VacancyCards role={role} onRole={setRole} />
          <StaffMarketBoard role={role} onRole={setRole} />
        </>
      )}
    </div>
  );
}
