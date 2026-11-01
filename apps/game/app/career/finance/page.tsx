"use client";
// HM-ALPHA3-M02: the Financial Centre -- the club's books as a manager
// reads them: where the money stands, where it comes from and goes, what
// the board allows, what is already committed and where it is heading.
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ClubCrest from "@/components/ClubCrest";
import MoneyInput from "@/components/MoneyInput";
import { PlayerCell } from "@/components/game/Identity";
import { CourtBackdrop } from "@/components/experience/CourtBackdrop";
import { DecisionCard, EventCard } from "@/components/experience/Moment";
import { MeterBar, Stat } from "@/components/experience/primitives";
import { CashLineChart, CategoryBars, type CashPoint } from "@/components/finance/FinanceCharts";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerPlayer } from "@/lib/career/careerWorld";
import { getClub } from "@/lib/game-data";
import { getClubBudgets, getClubEconomyBaseline, getClubPlayerWageCostsEurAnnual, getClubStaffCostsEurAnnual, MAX_BUDGET_SHIFT_SHARE } from "@/lib/economy/clubEconomyIntegration";
import { contractWagesForMonth, overdraftLimitEur, projectClubFinances, recurringRevenueEurAnnual, seasonStatements, sumLines } from "@/lib/economy/ledger";
import { boardBudgets, setBudgetPlan } from "@/lib/economy/budgetPlan";
import { monthLabelSv } from "@/lib/economy/financeTick";
import { FINANCIAL_STATUS_LABEL, FINANCIAL_STATUS_TONE, LEDGER_CATEGORY_COLOR, LEDGER_CATEGORY_LABEL } from "@/lib/economy/ledgerLabels";
import type { LedgerCategory, MonthlyStatement } from "@/lib/economy/ledgerTypes";
import { useMoney } from "@/lib/settings/usePreferences";
import type { CareerState } from "@/lib/career/types";

const TABS = [
  { id: "overview", label: "Översikt" },
  { id: "flows", label: "Intäkter & kostnader" },
  { id: "budget", label: "Budget" },
  { id: "ledger", label: "Huvudbok" },
  { id: "wages", label: "Lönekontrakt" },
  { id: "forecast", label: "Prognos" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const SHORT_MONTH = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const shortMonth = (m: string) => `${SHORT_MONTH[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

export default function FinancePage() {
  return <Suspense><FinancialCentre /></Suspense>;
}

function FinancialCentre() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "overview") as TabId;
  const club = getCareerClub(career);
  const baseline = getClubEconomyBaseline(career, club.id);
  const finance = career.clubFinances?.[club.id];
  const budgets = getClubBudgets(career, club.id);
  const projection = projectClubFinances(career, club.id);

  if (!baseline || !budgets) return <p className="hm-empty">Klubben saknar ekonomiska data.</p>;
  const status = finance?.status ?? "HEALTHY";
  const limit = overdraftLimitEur(baseline);
  const last = finance?.statements.at(-1);
  const lastResult = last ? last.closingCashEur - last.openingCashEur : null;
  const seasonEnd = projection.filter((p) => p.month <= `${Number(career.seasonId.slice(0, 4)) + 1}-05`).at(-1);

  return (
    <div className="fc-page">
      <header className="xp-band fc-band" data-tone={FINANCIAL_STATUS_TONE[status]}>
        <CourtBackdrop />
        <div className="fc-band-lead">
          <span className="xp-eyebrow">Ekonomi · {club.name} · {career.seasonId}</span>
          <h1>Finanscentralen</h1>
          <p>{headline(career, status, lastResult, seasonEnd?.closingCashEur)}</p>
          <span className="fc-status" data-status={status}>{FINANCIAL_STATUS_LABEL[status]}</span>
        </div>
        <div className="fc-band-stats">
          <Stat label="Kassa" value={money.format(baseline.cashEur, { compact: true })} note={finance ? `Kredit ${money.format(limit, { compact: true })}` : "Bokföringen startar nästa dag"} />
          <Stat label="Senaste månad" value={lastResult === null ? "—" : `${lastResult >= 0 ? "+" : ""}${money.format(lastResult, { compact: true })}`} note={last ? monthLabelSv(last.month) : "Inget bokslut ännu"} />
          <Stat label="Prognos 31 maj" value={seasonEnd ? money.format(seasonEnd.closingCashEur, { compact: true }) : "—"} note="Med nuvarande avtal" />
        </div>
      </header>

      <nav className="fc-tabs" role="tablist" aria-label="Finanscentralens vyer">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-active={tab === t.id} onClick={() => router.replace(t.id === "overview" ? "/career/finance" : `/career/finance?tab=${t.id}`, { scroll: false })}>{t.label}</button>
        ))}
      </nav>

      {tab === "overview" && <Overview career={career} clubId={club.id} projection={projection} limit={limit} />}
      {tab === "flows" && <Flows career={career} clubId={club.id} />}
      {tab === "budget" && <Budget career={career} clubId={club.id} onPlan={(shift) => updateCareer((s) => setBudgetPlan(s, shift))} />}
      {tab === "ledger" && <Ledger statements={finance?.statements ?? []} />}
      {tab === "wages" && <Wages career={career} clubId={club.id} />}
      {tab === "forecast" && <Forecast projection={projection} limit={limit} />}
    </div>
  );
}

function headline(career: CareerState, status: string, lastResult: number | null, seasonEndCash?: number): string {
  if (status === "CRISIS") return "Klubben ligger under krediten. Styrelsen har fryst lönerna och transferbudgeten tills kassan är i balans.";
  if (status === "OVERDRAFT") return "Kassan är negativ men inom krediten. Transferbudgeten är stängd tills den vänder.";
  if (seasonEndCash !== undefined && seasonEndCash < 0) return "Prognosen pekar mot minus före säsongens slut. Se över lönerna innan det blir kris.";
  if (lastResult !== null && lastResult < 0) return "Förra månaden gick med underskott. Hemmamatcher och sponsorer bär resten av säsongen.";
  return "Ekonomin är i balans. Löner, matchintäkter och avtal bokförs månad för månad.";
}

// --- Overview -------------------------------------------------------------------

function Overview({ career, clubId, projection, limit }: { career: CareerState; clubId: string; projection: ReturnType<typeof projectClubFinances>; limit: number }) {
  const money = useMoney();
  const statements = career.clubFinances?.[clubId]?.statements ?? [];
  const points: CashPoint[] = [
    ...statements.slice(-12).map((s) => ({ label: shortMonth(s.month), value: s.closingCashEur })),
    ...projection.slice(0, 9).map((p) => ({ label: shortMonth(p.month), value: p.closingCashEur, projected: true })),
  ];
  const warnings = buildWarnings(career, clubId, projection);
  const season = seasonStatements(career, clubId);
  const income = season.reduce((s, st) => s + sumLines(st.lines, "in"), 0);
  const costs = -season.reduce((s, st) => s + sumLines(st.lines, "out"), 0);
  return (
    <div className="fc-grid">
      <section className="fc-panel fc-span-2" aria-labelledby="cash-title">
        <header><span className="xp-eyebrow">Kassaflöde</span><h2 id="cash-title">Kassan månad för månad</h2></header>
        <CashLineChart points={points} format={(v) => money.format(v, { compact: true })} overdraftLimit={limit} label={`Kassan: ${points.length} punkter, senaste ${points.at(-1) ? money.format(points.at(-1)!.value) : "—"}`} />
      </section>
      <section className="fc-panel" aria-labelledby="warn-title">
        <header><span className="xp-eyebrow">Att besluta</span><h2 id="warn-title">Varningar och beslut</h2></header>
        <div className="fc-warnings">
          {warnings.length === 0 && <p className="hm-text-muted">Inget kräver ett ekonomiskt beslut just nu.</p>}
          {warnings.map((w) => <EventCard key={w.title} tone={w.tone} eyebrow={w.eyebrow} title={w.title} footer={w.href ? <Link className="hm-btn hm-btn-sm" href={w.href}>{w.action} →</Link> : undefined}>{w.text}</EventCard>)}
        </div>
      </section>
      <section className="fc-panel" aria-labelledby="season-title">
        <header><span className="xp-eyebrow">Säsongen hittills</span><h2 id="season-title">{career.seasonId}</h2></header>
        <dl className="fc-facts">
          <div><dt>Intäkter</dt><dd>{money.format(income)}</dd></div>
          <div><dt>Löpande kostnader</dt><dd>{money.format(costs)}</dd></div>
          <div><dt>Löpande resultat</dt><dd data-tone={income - costs >= 0 ? "pos" : "neg"}>{money.format(income - costs)}</dd></div>
          <div><dt>Bokförda månader</dt><dd>{season.length}</dd></div>
        </dl>
      </section>
    </div>
  );
}

interface Warning { tone: "loss" | "gold" | "signal" | "success"; eyebrow: string; title: string; text: string; href?: string; action?: string }

function buildWarnings(career: CareerState, clubId: string, projection: ReturnType<typeof projectClubFinances>): Warning[] {
  const out: Warning[] = [];
  const finance = career.clubFinances?.[clubId];
  const budgets = getClubBudgets(career, clubId)!;
  if (finance?.status === "CRISIS") out.push({ tone: "loss", eyebrow: "Kris", title: "Budgetarna är frysta", text: "Sänk lönekostnaderna eller sälj för att komma tillbaka över krediten.", href: "/career/contracts", action: "Se kontrakten" });
  else if (finance?.status === "OVERDRAFT") out.push({ tone: "gold", eyebrow: "Övertrassering", title: "Kassan är negativ", text: "Transferbudgeten är stängd tills kassan är positiv igen." });
  const low = projection.find((p) => p.closingCashEur < 0);
  if (low && finance?.status === "HEALTHY") out.push({ tone: "gold", eyebrow: "Prognos", title: `Minus i ${monthLabelSv(low.month)}`, text: "Med nuvarande löner går kassan under noll. Matchintäkter kan rädda det, men marginalen är tunn.", href: "/career/finance?tab=forecast", action: "Öppna prognosen" });
  if (budgets.wageOverBudget) out.push({ tone: "signal", eyebrow: "Löner", title: "Lönerna överskrider budgeten", text: "Nya kontrakt och höjningar stoppas av lönebudgeten. Utgående avtal frigör utrymme.", href: "/career/finance?tab=wages", action: "Se lönekontrakten" });
  const plan = career.budgetPlans?.[clubId];
  if (finance?.status !== "CRISIS" && (!plan || plan.seasonId !== career.seasonId)) out.push({ tone: "success", eyebrow: "Budget", title: "Fördela säsongens budget", text: "Styrelsen låter dig flytta upp till 15 % av lönebudgeten till transfermarknaden, eller tillbaka.", href: "/career/finance?tab=budget", action: "Planera budgeten" });
  return out;
}

// --- Income & costs -------------------------------------------------------------

function Flows({ career, clubId }: { career: CareerState; clubId: string }) {
  const money = useMoney();
  const season = seasonStatements(career, clubId);
  const totals = new Map<LedgerCategory, number>();
  for (const st of season) for (const l of [...st.lines, ...st.transactions]) totals.set(l.category, (totals.get(l.category) ?? 0) + l.amountEur);
  const rows = [...totals.entries()].map(([category, value]) => ({ key: category, label: LEDGER_CATEGORY_LABEL[category], value, color: LEDGER_CATEGORY_COLOR[category], display: money.format(value) }));
  const income = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const costs = rows.filter((r) => r.value < 0).sort((a, b) => a.value - b.value);
  const scaleMax = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const matches = season.flatMap((s) => s.homeMatches);
  if (season.length === 0) return <p className="hm-empty">Första månadsbokslutet kommer i början av nästa hela månad.</p>;
  return (
    <div className="fc-grid">
      <section className="fc-panel" aria-labelledby="in-title"><header><span className="xp-eyebrow">Säsongen {career.seasonId}</span><h2 id="in-title">Intäkter</h2></header><CategoryBars rows={income} scaleMax={scaleMax} label="Intäkter per kategori" /></section>
      <section className="fc-panel" aria-labelledby="out-title"><header><span className="xp-eyebrow">Säsongen {career.seasonId}</span><h2 id="out-title">Kostnader</h2></header><CategoryBars rows={costs} scaleMax={scaleMax} label="Kostnader per kategori" /></section>
      <section className="fc-panel fc-span-2" aria-labelledby="gate-title">
        <header><span className="xp-eyebrow">Matchdag</span><h2 id="gate-title">Publik och matchintäkter</h2></header>
        {matches.length === 0 ? <p className="hm-text-muted">Inga bokförda hemmamatcher ännu.</p> : (
          <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Datum</th><th>Motståndare</th><th className="hm-table-num">Publik</th><th>Beläggning</th><th className="hm-table-num">Intäkt</th></tr></thead>
            <tbody>{matches.map((m) => { const opp = getClub(m.opponentClubId); return <tr key={m.fixtureId}><td>{m.date}</td><td>{opp && <span className="fc-opp"><ClubCrest shortName={opp.shortName} primaryColor={opp.primaryColor} clubId={opp.id} size={20} />{opp.shortName}</span>}</td><td className="hm-table-num">{m.attendance.toLocaleString("sv-SE")}</td><td><span className="fc-fill"><i style={{ width: `${Math.round((m.attendance / m.capacity) * 100)}%` }} /></span> {Math.round((m.attendance / m.capacity) * 100)} %</td><td className="hm-table-num">{money.format(m.revenueEur)}</td></tr>; })}</tbody></table></div>
        )}
      </section>
    </div>
  );
}

// --- Budget ---------------------------------------------------------------------------

function Budget({ career, clubId, onPlan }: { career: CareerState; clubId: string; onPlan: (shift: number) => void }) {
  const money = useMoney();
  const board = boardBudgets(career, clubId)!;
  const current = getClubBudgets(career, clubId)!;
  const plan = career.budgetPlans?.[clubId];
  const activeShift = plan?.seasonId === career.seasonId ? plan.wageToTransferEur : 0;
  const [draft, setDraft] = useState(activeShift);
  const [message, setMessage] = useState<string | null>(null);
  const crisis = career.clubFinances?.[clubId]?.status === "CRISIS";
  const maxOut = Math.round(board.wageBudgetEur * MAX_BUDGET_SHIFT_SHARE);
  const maxIn = Math.round(Math.min(board.transferBudgetEur, board.wageBudgetEur * MAX_BUDGET_SHIFT_SHARE));
  const wages = getClubPlayerWageCostsEurAnnual(career, clubId);
  const staff = getClubStaffCostsEurAnnual(career, clubId);
  const preview = { wage: board.wageBudgetEur - draft, transfer: board.transferBudgetEur + draft };
  return (
    <div className="fc-grid">
      <section className="fc-panel" aria-labelledby="board-title">
        <header><span className="xp-eyebrow">Styrelsens ramar · {career.seasonId}</span><h2 id="board-title">Budgeten</h2></header>
        <div className="fc-meters">
          <MeterBar label="Spelarlöner mot lönebudget" value={current.wageBudgetEur ? wages / current.wageBudgetEur : 1} figure={`${money.format(wages, { compact: true })} / ${money.format(current.wageBudgetEur, { compact: true })} per år`} tone={wages > current.wageBudgetEur ? "loss" : "success"} />
          <MeterBar label="Personal mot personalbudget" value={current.staffBudgetEur ? staff / current.staffBudgetEur : 0} figure={`${money.format(staff, { compact: true })} / ${money.format(current.staffBudgetEur, { compact: true })} per år`} tone={staff > current.staffBudgetEur ? "loss" : "ink"} />
          <MeterBar label="Transferbudget tillgänglig" value={1} figure={money.format(current.transferBudgetEur)} tone={current.transferBudgetEur > 0 ? "gold" : "loss"} />
          <MeterBar label="Akademibudget" value={1} figure={`${money.format(current.academyBudgetEur, { compact: true })} per år`} tone="ink" />
        </div>
        <p className="fc-note">Transferbudgeten följer kassan: varje köp och försäljning ändrar den direkt. Lönebudgeten bygger på klubbens återkommande intäkter, {money.format(recurringRevenueEurAnnual(getClubEconomyBaseline(career, clubId)!), { compact: true })} per år.</p>
      </section>
      <DecisionCard
        tone={crisis ? "loss" : "gold"}
        title="Fördela mellan löner och transfers"
        status={<span className="tc-pill" data-tone={activeShift ? "done" : undefined}>{activeShift ? "Plan gäller" : "Styrelsens fördelning"}</span>}
        primary={crisis ? undefined : { label: draft !== activeShift ? "Godkänn fördelningen" : activeShift ? "Planen är sparad" : "Flytta reglaget för att fördela om", consequence: `Lönebudget ${money.format(preview.wage, { compact: true })} · transferbudget ${money.format(preview.transfer, { compact: true })}`, onSelect: () => { try { onPlan(draft); setMessage("Styrelsen har godkänt fördelningen för säsongen."); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Kunde inte spara planen."); } }, disabled: draft === activeShift }}
        secondary={<p className="fc-note" role="status">{message ?? (crisis ? "Under krisen tillåter styrelsen ingen omfördelning." : `Upp till ${money.format(maxOut, { compact: true })} kan flyttas till transfers och upp till ${money.format(maxIn, { compact: true })} tillbaka till lönerna.`)}</p>}
      >
        {crisis ? "Styrelsen har fryst budgetarna tills kassan är tillbaka över krediten." : "Ge upp lönebudget för att ha mer att bjuda med på transfermarknaden, eller tvärtom. Planen gäller resten av säsongen."}
        {!crisis && (
          <span className="fc-shift">
            <label htmlFor="budget-shift" className="xp-eyebrow">Till transfers ({money.symbol})</label>
            <input id="budget-shift" type="range" min={-maxIn} max={maxOut} step={Math.max(1, Math.round(maxOut / 60))} value={draft} onChange={(e) => setDraft(Number(e.target.value))} aria-valuetext={money.format(draft)} />
            <span className="fc-shift-scale"><span>← Mer till löner</span><MoneyInput className="hm-input fc-shift-input" aria-label="Belopp att flytta till transfers" valueEur={draft} onChangeEur={(v) => setDraft(Math.max(-maxIn, Math.min(maxOut, v)))} /><span>Mer till transfers →</span></span>
          </span>
        )}
      </DecisionCard>
    </div>
  );
}

// --- Ledger ------------------------------------------------------------------------------

function Ledger({ statements }: { statements: readonly MonthlyStatement[] }) {
  const money = useMoney();
  const [selected, setSelected] = useState(statements.length - 1);
  if (statements.length === 0) return <p className="hm-empty">Huvudboken fylls när den första hela månaden är bokförd.</p>;
  const st = statements[Math.min(selected, statements.length - 1)]!;
  const lines = [...st.lines].sort((a, b) => b.amountEur - a.amountEur);
  return (
    <div className="fc-ledger">
      <ol className="fc-months" aria-label="Bokförda månader">
        {statements.map((s, i) => { const r = s.closingCashEur - s.openingCashEur; return <li key={s.month}><button type="button" aria-pressed={i === selected} onClick={() => setSelected(i)}><span>{monthLabelSv(s.month)}</span><b data-tone={r >= 0 ? "pos" : "neg"}>{r >= 0 ? "+" : ""}{money.format(r, { compact: true })}</b></button></li>; })}
      </ol>
      <section className="fc-panel" aria-labelledby="statement-title">
        <header><span className="xp-eyebrow">Månadsbokslut · stängt {st.closedOn}</span><h2 id="statement-title">{monthLabelSv(st.month)}</h2></header>
        <table className="hm-table fc-statement">
          <tbody>
            <tr className="fc-row-strong"><th scope="row">Ingående kassa</th><td className="hm-table-num">{money.format(st.openingCashEur)}</td></tr>
            {lines.map((l) => <tr key={l.category}><th scope="row"><i className="fc-swatch" style={{ background: LEDGER_CATEGORY_COLOR[l.category] }} />{LEDGER_CATEGORY_LABEL[l.category]}</th><td className="hm-table-num" data-tone={l.amountEur >= 0 ? "pos" : "neg"}>{money.format(l.amountEur)}</td></tr>)}
            {st.transactions.map((t, i) => <tr key={`t${i}`} className="fc-row-oneoff"><th scope="row"><i className="fc-swatch" style={{ background: LEDGER_CATEGORY_COLOR[t.category] }} />{t.label} <small>{t.date} · {LEDGER_CATEGORY_LABEL[t.category]}</small></th><td className="hm-table-num" data-tone={t.amountEur >= 0 ? "pos" : "neg"}>{money.format(t.amountEur)}</td></tr>)}
            <tr className="fc-row-strong"><th scope="row">Utgående kassa</th><td className="hm-table-num">{money.format(st.closingCashEur)}</td></tr>
          </tbody>
        </table>
        {st.homeMatches.length > 0 && <p className="fc-note">Matchintäkter från {st.homeMatches.length} hemmamatch{st.homeMatches.length > 1 ? "er" : ""}, totalt {st.homeMatches.reduce((s, m) => s + m.attendance, 0).toLocaleString("sv-SE")} åskådare.</p>}
      </section>
    </div>
  );
}

// --- Wage commitments ---------------------------------------------------------------------

function Wages({ career, clubId }: { career: CareerState; clubId: string }) {
  const money = useMoney();
  const startYear = Number(career.seasonId.slice(0, 4));
  const seasons = [0, 1, 2].map((k) => ({ label: `${startYear + k}/${String(startYear + k + 1).slice(-2)}`, end: `${startYear + k + 1}-05-31` }));
  const contracts = Object.values(career.playerContracts).filter((c) => c.clubId === clubId).sort((a, b) => b.wageEurPerMonth - a.wageEurPerMonth);
  const staff = (career.staffRoster[clubId] ?? []).map((m) => ({ m, e: career.staffEmployment[m.id] })).filter((x) => x.e);
  const commitments = seasons.map((s) => contractWagesForMonth(career, clubId, s.end) * 12);
  const max = Math.max(1, ...commitments);
  return (
    <div className="fc-grid">
      <section className="fc-panel" aria-labelledby="commit-title">
        <header><span className="xp-eyebrow">Spelarlöner per säsong</span><h2 id="commit-title">Åtaganden framåt</h2></header>
        <ul className="fc-bars">{seasons.map((s, i) => <li key={s.label}><span className="fc-bar-label">{s.label}</span><span className="fc-bar-track"><i style={{ width: `${Math.max(1.5, (commitments[i]! / max) * 100)}%`, background: i === 0 ? "#c74624" : "#e07a52" }} /></span><b>{money.format(commitments[i]!, { compact: true })}</b></li>)}</ul>
        <p className="fc-note">Avtal som löper ut frigör utrymme. Nya kontrakt läggs ovanpå.</p>
      </section>
      <section className="fc-panel fc-span-2" aria-labelledby="players-title">
        <header><span className="xp-eyebrow">{contracts.length} spelarkontrakt</span><h2 id="players-title">Lönelistan</h2></header>
        <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th className="hm-table-num">Lön / mån</th><th>Avtal t.o.m.</th><th className="hm-table-num">Kvar att betala</th></tr></thead>
          <tbody>{contracts.map((c) => { const p = getCareerPlayer(career, c.playerId); const months = Math.max(0, monthsBetween(career.gameDate, c.contractEndDate)); return <tr key={c.playerId}><td>{p ? <PlayerCell player={p} /> : c.playerId}</td><td className="hm-table-num">{money.format(c.wageEurPerMonth)}</td><td>{c.contractEndDate}</td><td className="hm-table-num">{money.format(c.wageEurPerMonth * months)}</td></tr>; })}</tbody>
        </table></div>
      </section>
      <section className="fc-panel" aria-labelledby="staff-title">
        <header><span className="xp-eyebrow">{staff.length} anställda</span><h2 id="staff-title">Personal</h2></header>
        <dl className="fc-facts">{staff.map(({ m, e }) => <div key={m.id}><dt><Link href={`/career/staff/${encodeURIComponent(m.id)}`}>{m.displayName}</Link></dt><dd>{money.format(e!.wageEurPerMonth ?? 0)}/mån</dd></div>)}</dl>
      </section>
    </div>
  );
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!) + 1;
}

// --- Forecast ------------------------------------------------------------------------------

function Forecast({ projection, limit }: { projection: ReturnType<typeof projectClubFinances>; limit: number }) {
  const money = useMoney();
  if (projection.length === 0) return <p className="hm-empty">Prognosen startar när bokföringen är igång.</p>;
  return (
    <div className="fc-grid">
      <section className="fc-panel fc-span-2" aria-labelledby="fc-title">
        <header><span className="xp-eyebrow">Med nuvarande avtal och schema</span><h2 id="fc-title">Prognos till säsongens slut</h2></header>
        <CashLineChart points={projection.map((p) => ({ label: shortMonth(p.month), value: p.closingCashEur, projected: true }))} format={(v) => money.format(v, { compact: true })} overdraftLimit={limit} label="Prognostiserad kassa per månad" />
      </section>
      <section className="fc-panel fc-span-2" aria-labelledby="fct-title">
        <header><span className="xp-eyebrow">Månad för månad</span><h2 id="fct-title">Prognostabell</h2></header>
        <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Månad</th><th className="hm-table-num">Intäkter</th><th className="hm-table-num">Kostnader</th><th className="hm-table-num">Resultat</th><th className="hm-table-num">Kassa</th></tr></thead>
          <tbody>{projection.map((p) => <tr key={p.month}><td>{monthLabelSv(p.month)}</td><td className="hm-table-num">{money.format(p.incomeEur)}</td><td className="hm-table-num">{money.format(p.expensesEur)}</td><td className="hm-table-num" data-tone={p.incomeEur - p.expensesEur >= 0 ? "pos" : "neg"}>{money.format(p.incomeEur - p.expensesEur)}</td><td className="hm-table-num" data-tone={p.closingCashEur >= 0 ? undefined : "neg"}>{money.format(p.closingCashEur)}</td></tr>)}</tbody>
        </table></div>
        <p className="fc-note">Matchintäkterna räknas på genomsnittlig publik för schemalagda hemmamatcher. Prognosen tar inte med framtida värvningar, försäljningar eller prispengar.</p>
      </section>
    </div>
  );
}

