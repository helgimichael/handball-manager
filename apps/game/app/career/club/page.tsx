"use client";
import ClubContext from "@/components/manager/ClubContext";
import { PageHeading, CompetitionLink } from "@/components/manager/Workspace";

import Link from "next/link";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { getPlayerClubPosition } from "@/lib/career/standings";
import ClubCrest from "@/components/ClubCrest";
import { getClubEconomySnapshot } from "@/lib/economy/clubEconomyIntegration";
import { formatEur } from "@/lib/economy/currency";
import { ECONOMIC_BAND_LABEL, FINANCIAL_PRESSURE_LABEL, FINANCIAL_PRESSURE_TONE, LIQUIDITY_HEALTH_LABEL, STRUCTURAL_HEALTH_LABEL } from "@/lib/economy/clubEconomyLabels";
import { getClubPartnerships } from "@/lib/career/clubPartnerships";

export default function ClubPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const position = getPlayerClubPosition(career);
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";
  const economy = getClubEconomySnapshot(career, club.id);
  const partnerships = getClubPartnerships(career, club.id);
  const permanentBTeam = partnerships.find((p) => p.type === "AFFILIATED_B_TEAM");
  const activeDevelopment = partnerships.find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");
  const pendingSearch = Object.values(career.partnershipSearches).find((s) => s.clubId === club.id && s.status === "IN_PROGRESS");

  return (
    <div className="hm-stack">
      <PageHeading eyebrow="Klubbledning" title={club.name} description="Ekonomi, organisation och klubbens utveckling över säsongerna." />
      <ClubContext clubId={club.id} />
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Klubböversikt</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 16 }}>
          <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={56} />
          <div>
            <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{club.name}</div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>
              <CompetitionLink id={career.competitionId}>{competitionName}</CompetitionLink> · {club.city} · Grundad {club.founded ?? "—"}
            </div>
          </div>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", gap: 28 }}>
          <MiniStat label="Tabellplacering" value={`${position}:a`} />
          <MiniStat label="Trupp" value={squad.length} />
          <MiniStat label="Arena" value={club.venue ?? "—"} />
          <MiniStat label="Personal" value={(career.staffRoster[club.id] ?? []).length} />
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Ekonomi</span>
          {economy ? (
            <span className={`hm-badge hm-badge-${FINANCIAL_PRESSURE_TONE[economy.health.pressure]}`}>{FINANCIAL_PRESSURE_LABEL[economy.health.pressure]}</span>
          ) : (
            <span className="hm-badge hm-badge-neutral">Ingen data</span>
          )}
        </div>
        {economy ? (
          <>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="hm-eyebrow">{ECONOMIC_BAND_LABEL[economy.band]}</div>
              <FinanceRow label="Intäkter / år (recurring)" value={formatEur(economy.recurringRevenueEur)} />
              <FinanceRow label="· Kommersiellt" value={formatEur(economy.revenue.commercialRevenueEur)} />
              <FinanceRow label="· Media/central" value={formatEur(economy.revenue.mediaRevenueEur)} />
              <FinanceRow label="· Matchdag" value={formatEur(economy.revenue.matchdayRevenueEur)} />
              <FinanceRow label="· Sportsligt/cup" value={formatEur(economy.revenue.sportingRevenueEur)} />
              <FinanceRow label="· Övrigt" value={formatEur(economy.revenue.otherRevenueEur)} />
              <div className="hm-divider" />
              <FinanceRow label="Kassa / likviditet" value={formatEur(economy.cashEur)} />
              {economy.ownerFundingEur > 0 ? <FinanceRow label="Ägarstöd (separat från intäkter)" value={formatEur(economy.ownerFundingEur)} /> : null}
              <div className="hm-divider" />
              <FinanceRow label="Spelarlöner / år" value={formatEur(economy.playerWageCostsEurAnnual)} warn={economy.budgets.wageOverBudget} />
              <FinanceRow label="Lönebudget / år" value={formatEur(economy.budgets.wageBudgetEur)} />
              <FinanceRow label="Personalkostnader / år" value={formatEur(economy.staffCostsEurAnnual)} />
              <FinanceRow label="Personalbudget / år" value={formatEur(economy.budgets.staffBudgetEur)} />
              <FinanceRow label="Transferbudget" value={formatEur(economy.budgets.transferBudgetEur)} />
              <FinanceRow label="Akademibudget / år" value={formatEur(economy.budgets.academyBudgetEur)} />
              <div className="hm-divider" />
              <FinanceRow label="Likviditet" value={LIQUIDITY_HEALTH_LABEL[economy.health.liquidityHealth]} />
              <FinanceRow label="Struktur" value={STRUCTURAL_HEALTH_LABEL[economy.health.structuralHealth]} />
            </div>
            <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", paddingTop: 0 }}>
              Ekonomiska uppgifter: uppskattade.
              {economy.budgets.wageOverBudget ? " Klubbens nuvarande spelarlöner överstiger den ekonomiskt hållbara lönebudgeten." : ""}
            </div>
          </>
        ) : (
          <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Ingen ekonomidata genererad för denna klubb ännu.</div>
        )}
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Klubbpartnerskap</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {permanentBTeam ? (
            <FinanceRow label={`B-lag: ${getClub(permanentBTeam.clubBId)?.name ?? permanentBTeam.clubBId}`} value="Permanent" />
          ) : null}
          {activeDevelopment ? (
            <FinanceRow label={`Samarbetsklubb: ${getClub(activeDevelopment.clubBId)?.name ?? activeDevelopment.clubBId}`} value={`t.o.m. ${activeDevelopment.endDate}`} />
          ) : null}
          {pendingSearch ? <FinanceRow label="Sökning efter samarbetsklubb" value={`pågår, klar ${pendingSearch.endDate}`} /> : null}
          {!permanentBTeam && !activeDevelopment && !pendingSearch ? (
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-xs)" }}>Inget aktivt samarbete.</div>
          ) : null}
        </div>
        <div className="hm-panel-body" style={{ paddingTop: 0, display: "flex", gap: 8 }}>
          <Link href="/career/club/partnerships" className="hm-btn hm-btn-sm hm-btn-ghost">
            Visa partnerskap →
          </Link>
        </div>
      </div>

    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="hm-eyebrow">{label}</div>
      <div style={{ fontSize: "var(--hm-text-md)", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function FinanceRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--hm-text-xs)" }}>
      <span className="hm-text-muted">{label}</span>
      <span style={{ fontWeight: 700, color: warn ? "var(--hm-negative)" : undefined }}>{value}</span>
    </div>
  );
}
