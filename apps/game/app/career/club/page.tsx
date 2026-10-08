"use client";
import ClubContext from "@/components/manager/ClubContext";
import { Panel } from "@/components/manager/Workspace";
import { ClubHero, PlayerCell } from "@/components/game/Identity";

import Link from "next/link";
import { getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { getPlayerClubPosition } from "@/lib/career/standings";
import { getClubEconomySnapshot } from "@/lib/economy/clubEconomyIntegration";
import { formatEur } from "@/lib/economy/currency";
import { ECONOMIC_BAND_LABEL, FINANCIAL_PRESSURE_LABEL, FINANCIAL_PRESSURE_TONE, LIQUIDITY_HEALTH_LABEL, STRUCTURAL_HEALTH_LABEL } from "@/lib/economy/clubEconomyLabels";
import { getClubPartnerships } from "@/lib/career/clubPartnerships";

export default function ClubPage() {
  const { career } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const position = getPlayerClubPosition(career);
  const economy = getClubEconomySnapshot(career, club.id);
  const partnerships = getClubPartnerships(career, club.id);
  const permanentBTeam = partnerships.find((p) => p.type === "AFFILIATED_B_TEAM");
  const activeDevelopment = partnerships.find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");
  const pendingSearch = Object.values(career.partnershipSearches).find((s) => s.clubId === club.id && s.status === "IN_PROGRESS");

  return (
    <div className="hm-world-page">
      <ClubHero clubId={club.id} career={career}>
        <Link className="hm-btn hm-btn-sm" href="/career/squad">Öppna truppen →</Link>
      </ClubHero>
      <section className="hm-world-facts" aria-label="Klubben den här säsongen">
        <div><small>Tabellplacering</small><strong>{position > 0 ? `${position}:a` : "—"}</strong></div>
        <div><small>Spelare i truppen</small><strong>{squad.length}</strong></div>
        <div><small>Hemmaplan</small><strong>{club.venue ?? "—"}</strong></div>
        <div><small>Personal</small><strong>{(career.staffRoster[club.id] ?? []).length}</strong></div>
      </section>
      <div className="hm-world-split">
      <div className="hm-world-main">
        <ClubContext clubId={club.id} />
        <Panel title="Truppens positioner" actions={<Link href="/career/squad">Trupp & lagbygge →</Link>}>
          <div className="hm-world-depth">{(["MV", "V6", "V9", "M9", "M6", "H9", "H6"] as const).map(p => <Link href="/career/squad" key={p}><small>{p}</small><strong>{squad.filter(player => player.position === p).length}</strong><small>spelare</small></Link>)}</div>
        </Panel>
        <Panel title="Spelarna bakom säsongen" actions={<Link href="/career/statistics">Alla prestationer →</Link>}>
          <ul className="hm-world-player-list">{[...squad].sort((a,b) => (career.playerSeasonStats[b.id]?.goals ?? 0) - (career.playerSeasonStats[a.id]?.goals ?? 0) || (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99)).slice(0,6).map(player => <li key={player.id}><PlayerCell player={player} /><span className="hm-world-player-score" title="Registrerade mål den här säsongen">{career.playerSeasonStats[player.id]?.goals ?? 0}</span></li>)}</ul>
        </Panel>
      </div>
      <aside className="hm-world-rail" aria-label="Klubbens förutsättningar">
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
              <div className="hm-eyebrow">{ECONOMIC_BAND_LABEL[economy.band].split(' · ')[1]}</div>
              <FinanceRow label="Återkommande intäkter / år" value={formatEur(economy.recurringRevenueEur)} />
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
      </aside>
      </div>
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
