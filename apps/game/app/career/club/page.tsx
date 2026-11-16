"use client";
import { Panel } from "@/components/manager/Workspace";
import { PlayerCell } from "@/components/game/Identity";

import Link from "next/link";
import { getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { getPlayerClubPosition } from "@/lib/career/standings";
import { getClubEconomySnapshot } from "@/lib/economy/clubEconomyIntegration";
import { formatMoney } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { ECONOMIC_BAND_LABEL, FINANCIAL_PRESSURE_LABEL, FINANCIAL_PRESSURE_TONE, LIQUIDITY_HEALTH_LABEL, STRUCTURAL_HEALTH_LABEL } from "@/lib/economy/clubEconomyLabels";
import { getClubPartnerships } from "@/lib/career/clubPartnerships";
import { svOrdinal } from "@/lib/format/ordinal";
import { clubJournal } from "@/lib/club/clubJournal";
import { BoardAndEconomy, Briefs, DepthCourt, HistoryStrip } from "@/components/club/ClubJournal";
import { clubAlmanac } from "@/lib/club/clubAlmanac";
import { ClubhouseHeader } from "@/components/club/ClubhouseHeader";
import { ClubAlmanacSection } from "@/components/club/ClubAlmanac";
import { ClubStory } from "@/components/club/ClubStory";

export default function ClubPage() {
  useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const club = getCareerClub(career);
  const squad = getCareerSquad(career);
  const position = getPlayerClubPosition(career);
  const economy = getClubEconomySnapshot(career, club.id);
  const partnerships = getClubPartnerships(career, club.id);
  const permanentBTeam = partnerships.find((p) => p.type === "AFFILIATED_B_TEAM");
  const activeDevelopment = partnerships.find((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE");
  const pendingSearch = Object.values(career.partnershipSearches).find((s) => s.clubId === club.id && s.status === "IN_PROGRESS");
  // Arena Nights Phase 3 (CLB-02 C): the club's own front page -- identity, trajectory, what needs attention now.
  const journal = clubJournal(career);
  // CLB-01 C: Klubbhuset folded in -- tier art header with department hotspots, and the almanac below.
  const almanac = clubAlmanac(career);

  return (
    <div className="hm-world-page">
      <ClubhouseHeader clubId={club.id} name={club.name} kicker={journal.kicker} almanac={almanac}>
        <Link className="hm-btn hm-btn-sm" href="/career/squad">Öppna truppen →</Link>
      </ClubhouseHeader>
      <div className="cj-journal">
      <HistoryStrip history={journal.history} />
      <section className="hm-world-facts" aria-label="Klubben den här säsongen">
        <div><small>Tabellplacering</small><strong>{position > 0 ? `${svOrdinal(position)}` : "—"}</strong></div>
        <div><small>Spelare i truppen</small><strong>{squad.length}</strong></div>
        <div><small>Hemmaplan</small><strong>{club.venue ?? "—"}</strong></div>
        <div><small>Personal</small><strong>{(career.staffRoster[club.id] ?? []).length}</strong></div>
      </section>
      <div className="hm-world-split">
      <div className="hm-world-main">
        <section className="cj-section" aria-labelledby="cj-attention">
          <h2 id="cj-attention">Läget i klubben</h2>
          <Briefs briefs={journal.briefs} />
        </section>
        <Panel title="Truppens täckning" actions={<Link href="/career/squad">Trupp & lagbygge →</Link>}>
          <DepthCourt depth={journal.depth} />
        </Panel>
        <ClubStory clubId={club.id} />
        <Panel title="Spelarna bakom säsongen" actions={<Link href="/career/statistics">Alla prestationer →</Link>}>
          <ul className="hm-world-player-list">{[...squad].sort((a,b) => (career.playerSeasonStats[b.id]?.goals ?? 0) - (career.playerSeasonStats[a.id]?.goals ?? 0) || (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99)).slice(0,6).map(player => <li key={player.id}><PlayerCell player={player} /><span className="hm-world-player-score" title="Registrerade mål den här säsongen">{career.playerSeasonStats[player.id]?.goals ?? 0}</span></li>)}</ul>
        </Panel>
      </div>
      <aside className="hm-world-rail" aria-label="Klubbens förutsättningar">
      <BoardAndEconomy journal={journal} />
      <details className="cj-more">
      <summary>Hela ekonomin</summary>
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
              <FinanceRow label="Återkommande intäkter / år" value={formatMoney(economy.recurringRevenueEur)} />
              <FinanceRow label="· Kommersiellt" value={formatMoney(economy.revenue.commercialRevenueEur)} />
              <FinanceRow label="· Media/central" value={formatMoney(economy.revenue.mediaRevenueEur)} />
              <FinanceRow label="· Matchdag" value={formatMoney(economy.revenue.matchdayRevenueEur)} />
              <FinanceRow label="· Sportsligt/cup" value={formatMoney(economy.revenue.sportingRevenueEur)} />
              <FinanceRow label="· Övrigt" value={formatMoney(economy.revenue.otherRevenueEur)} />
              <div className="hm-divider" />
              <FinanceRow label="Kassa / likviditet" value={formatMoney(economy.cashEur)} />
              {economy.ownerFundingEur > 0 ? <FinanceRow label="Ägarstöd (separat från intäkter)" value={formatMoney(economy.ownerFundingEur)} /> : null}
              <div className="hm-divider" />
              <FinanceRow label="Spelarlöner / år" value={formatMoney(economy.playerWageCostsEurAnnual)} warn={economy.budgets.wageOverBudget} />
              <FinanceRow label="Lönebudget / år" value={formatMoney(economy.budgets.wageBudgetEur)} />
              <FinanceRow label="Personalkostnader / år" value={formatMoney(economy.staffCostsEurAnnual)} />
              <FinanceRow label="Personalbudget / år" value={formatMoney(economy.budgets.staffBudgetEur)} />
              <FinanceRow label="Transferbudget" value={formatMoney(economy.budgets.transferBudgetEur)} />
              <FinanceRow label="Akademibudget / år" value={formatMoney(economy.budgets.academyBudgetEur)} />
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
      </details>

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
      <ClubAlmanacSection almanac={almanac} />
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
