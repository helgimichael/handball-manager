"use client";
// Arena 231 -- SYS-01 A: Inställningar inside a career is the same unified panel as the main menu (ENT-05). The
// Ekonomi section keeps today's best idea: the currency preview uses the manager's own club's real budgets.
// Device-level only: nothing here is written into the career (lib/settings/preferences.ts).
import { useMemo } from "react";
import { UnifiedSettings, type EconomyPreviewRow } from "@/components/settings/UnifiedSettings";
import { CareerDataSection } from "@/components/settings/DataSections";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getClubEconomySnapshot } from "@/lib/economy/clubEconomyIntegration";

export default function SettingsPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);

  // Real figures from the manager's own club, so the choice is made on numbers they know.
  const examples = useMemo(() => {
    const economy = getClubEconomySnapshot(career, club.id);
    const wages = Object.values(career.playerContracts).filter((c) => c.clubId === club.id).map((c) => c.wageEurPerMonth);
    return [
      { label: "Transferbudget", eur: economy?.budgets.transferBudgetEur, unit: "" },
      { label: "Lönebudget", eur: economy?.budgets.wageBudgetEur, unit: "/år" },
      { label: "Högsta lön i truppen", eur: wages.length ? Math.max(...wages) : undefined, unit: "/mån" },
      { label: "Kassa", eur: economy?.cashEur, unit: "" },
    ].filter((row): row is EconomyPreviewRow => typeof row.eur === "number");
  }, [career, club.id]);

  return (
    <div className="hm-settings hm-us-page">
      <header className="hm-us-head">
        <span className="ce-kicker">Spelet · den här enheten</span>
        <h1>Inställningar</h1>
        <p>Hur spelet visas för dig. Inställningarna sparas i den här webbläsaren och följer inte med karriären. De ändrar aldrig dina sparade karriärer eller klubbens ekonomi.</p>
      </header>
      <UnifiedSettings scope="career" economyPreview={examples} clubName={club.name} data={<CareerDataSection />} />
    </div>
  );
}
