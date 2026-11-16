"use client";

// Arena Nights 231 -- STF-01 A "Org & Responsibility Matrix". One matrix (departments x positions: holder, fit
// 1-20, wage and contract, delegation mode, sessions this week) replaces the org chart, the role-count grid and
// the staff table. The tree (STF-01b) and the compact list (STF-01c) are alternate lenses on the same rows;
// the week grid (STF-01d) shows who leads which session. Reads the resolved roster on CareerState
// (career.staffRoster) exactly as before -- no staff rule changes here.
import Link from "next/link";
import { Suspense } from "react";
import ClubCrest from "@/components/ClubCrest";
import { SectionScene } from "@/components/game/Secondary";
import { StaffNav } from "@/components/staff/StaffNav";
import { StaffOrganisation } from "@/components/staff/StaffOrganisation";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";

export default function StaffPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const roster = career.staffRoster[career.playerClubId] ?? [];
  return (
    <div className="game-secondary-page sf-page">
      <SectionScene eyebrow={`${club.name} · ${career.seasonId}`} title="Personal" description="Vem gör vad, hur bra, till vilken kostnad och med vilket mandat." mark={<ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={72} />} actions={<><Link href="/career/staff/recruitment" className="hm-btn hm-btn-sm hm-btn-primary">Rekrytera personal</Link><Link href="/career/scouting" className="hm-btn hm-btn-sm">Scouting →</Link><Link href="/career/medical" className="hm-btn hm-btn-sm">Medicinskt →</Link></>}><div><strong>{roster.length}</strong><small>personer i klubben</small></div></SectionScene>
      <Suspense><StaffNav /></Suspense>
      <StaffOrganisation />
      <p className="sf-hint">{roster.some((m) => m.source === "GENERATED_FICTIONAL") ? "Vissa roller är tillsatta med spelgenererad personal." : "Personer och roller i din klubb."}</p>
    </div>
  );
}
