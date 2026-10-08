"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub } from '@/lib/career/careerWorld';
import ClubCrest from '@/components/ClubCrest';
import { SectionScene } from '@/components/game/Secondary';

const TABS = [
  { href: "/career/analysis", label: "Översikt" },
  { href: "/career/analysis/opponent", label: "Motståndaren" },
  { href: "/career/analysis/our-team", label: "Vårt lag" },
  { href: "/career/analysis/last-match", label: "Senaste matchen" },
];

export default function AnalysisLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { career } = useCareer();
  const club = getCareerClub(career);

  return (
    <div className="game-secondary-page">
      <SectionScene eyebrow={`${club.name} · ${career.seasonId}`} title="Matchanalys" description="Registrerade matcher, lagets prestationer och underlaget inför nästa motståndare." mark={<ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={72} />} actions={<><Link className="hm-btn hm-btn-sm" href="/career/tactics">Matchplan →</Link><Link className="hm-btn hm-btn-sm" href="/career/schedule">Matcher & resultat →</Link></>} />
      <nav className="hm-tabs game-analysis-tabs" aria-label="Analysvyer">{TABS.map(tab => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? 'page' : undefined}>{tab.label}</Link>)}</nav>
      {children}
    </div>
  );
}
