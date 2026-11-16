"use client";
// Arena Nights CLB-06 A "Finance Cockpit": "can I afford it, and what is going wrong?" Three KPIs (Kassa, Lönerum,
// Prognos säsongsslut) with deltas; the cash line (booked + projected, with the projection band and the credit
// floor) beside warnings that each end in one verb (CLB-06a A); the budget reallocation as the one decision
// (CLB-06c A); the accounting collapsed into Detaljer (?section=): Intäkter & kostnader (CLB-06b A), Huvudbok as a
// month accordion (CLB-06d A), Löner as commitments with a link to Kontrakt (CLB-06e A) and Prognos as a band with
// its assumptions and the table folded away (CLB-06f B). Old ?tab= links still land on the right section.
// HM-ALPHA3-M02 figures unchanged: ledger, budgets, projection and setBudgetPlan are read/called as they are.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ClubCrest from "@/components/ClubCrest";
import MoneyInput from "@/components/MoneyInput";
import { CourtBackdrop } from "@/components/experience/CourtBackdrop";
import { CashLineChart, CategoryBars, StackedBars, type CashPoint } from "@/components/finance/FinanceCharts";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getClub } from "@/lib/game-data";
import { clubOperationsCostEurAnnual, getClubBudgets, getClubEconomyBaseline } from "@/lib/economy/clubEconomyIntegration";
import { contractWagesForMonth, overdraftLimitEur, projectClubFinances, seasonStatements, sumLines } from "@/lib/economy/ledger";
import { setBudgetPlan } from "@/lib/economy/budgetPlan";
import { monthLabelSv } from "@/lib/economy/financeTick";
import { FINANCIAL_STATUS_LABEL, FINANCIAL_STATUS_TONE, LEDGER_CATEGORY_COLOR, LEDGER_CATEGORY_LABEL } from "@/lib/economy/ledgerLabels";
import type { LedgerCategory, MonthlyStatement } from "@/lib/economy/ledgerTypes";
import { matchReportHref } from "@/lib/career/fixtureRoutes";
import { budgetSlider, financeActions, financeKpis, homeGauges, ledgerMonths, projectionBand } from "@/lib/finance/financeCockpit";
import { useMoney } from "@/lib/settings/usePreferences";
import type { CareerState } from "@/lib/career/types";

const SECTIONS = [
  { id: "flows", label: "Intäkter & kostnader" },
  { id: "ledger", label: "Huvudbok" },
  { id: "wages", label: "Löner" },
  { id: "forecast", label: "Prognos" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const SHORT_MONTH = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const shortMonth = (m: string) => `${SHORT_MONTH[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
type Money = ReturnType<typeof useMoney>;
const signed = (money: Money, v: number) => `${v >= 0 ? "+" : "−"}${money.format(Math.abs(v), { compact: true })}`;

export default function FinancePage() {
  return <Suspense><FinancialCentre /></Suspense>;
}

function FinancialCentre() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const params = useSearchParams();
  const club = getCareerClub(career);
  const baseline = getClubEconomyBaseline(career, club.id);
  const finance = career.clubFinances?.[club.id];
  const budgets = getClubBudgets(career, club.id);
  const projection = projectClubFinances(career, club.id);
  // ?section= (and the old ?tab=) opens one Detaljer section; budget scrolls to the decision.
  const target = params.get("section") ?? params.get("tab");
  const [manual, setManual] = useState<Partial<Record<SectionId, boolean>>>({});
  const isOpen = (id: SectionId) => manual[id] ?? id === target;
  useEffect(() => {
    if (!target || target === "overview") return;
    requestAnimationFrame(() => document.getElementById(`fx-${target}`)?.scrollIntoView({ block: "start" }));
  }, [target]);

  if (!baseline || !budgets) return <p className="hm-empty">Klubben saknar ekonomiska data. <Link href="/career/club">Till Klubben →</Link></p>;
  const status = finance?.status ?? "HEALTHY";
  const limit = overdraftLimitEur(baseline);
  const k = financeKpis(career, club.id, projection)!;
  const toggle = (id: SectionId, open: boolean) => { if (open !== isOpen(id)) setManual((m) => ({ ...m, [id]: open })); };

  return (
    <div className="fc-page fx-page">
      <header className="xp-band fc-band fx-band" data-tone={FINANCIAL_STATUS_TONE[status]}>
        <CourtBackdrop />
        <div className="fc-band-lead">
          <span className="xp-eyebrow">Ekonomi · {club.name} · {career.seasonId}</span>
          <h1>Finanscentralen</h1>
          <p>{headline(status, k.lastMonthEur, k.seasonEndEur ?? undefined)}</p>
          <span className="fc-status" data-status={status}>{FINANCIAL_STATUS_LABEL[status]}</span>
        </div>
      </header>

      <section className="fx-kpis" aria-label="Ekonomin i tre tal">
        <div className="fx-kpi" data-tone={k.cashEur < 0 ? "bad" : "neutral"}>
          <small>Kassa</small>
          <strong>{money.format(k.cashEur, { compact: true })}</strong>
          <span>{k.lastMonthEur === null ? "Första bokslutet kommer nästa hela månad" : `${signed(money, k.lastMonthEur)} i ${monthLabelSv(k.lastMonth!)}`}</span>
        </div>
        <div className="fx-kpi" data-tone={k.wageRoomEur < 0 ? "bad" : k.wageUse > 0.95 ? "warn" : "good"}>
          <small>Lönerum / år</small>
          <strong>{money.format(k.wageRoomEur, { compact: true })}</strong>
          <span>{Math.round(k.wageUse * 100)} % av lönebudgeten används</span>
          <i className="fx-kpi-bar" aria-hidden="true"><b style={{ width: `${Math.min(100, k.wageUse * 100)}%` }} /></i>
        </div>
        <div className="fx-kpi" data-tone={k.seasonEndEur === null ? "neutral" : k.seasonEndEur < k.floorEur ? "bad" : k.seasonEndEur < 0 ? "warn" : "good"}>
          <small>Prognos säsongsslut</small>
          <strong>{k.seasonEndEur === null ? "—" : money.format(k.seasonEndEur, { compact: true })}</strong>
          <span>{k.seasonEndDeltaEur === null ? "Prognosen startar med bokföringen" : `${signed(money, k.seasonEndDeltaEur)} mot i dag · nuvarande avtal`}</span>
        </div>
      </section>

      <Overview career={career} clubId={club.id} projection={projection} limit={limit} floorBreach={k.floorBreach?.month ?? null} />

      <Budget career={career} clubId={club.id} onPlan={(shift) => updateCareer((s) => setBudgetPlan(s, shift))} />

      <section className="fx-details" aria-labelledby="fx-details-h">
        <h2 id="fx-details-h" className="fx-h">Detaljer</h2>
        {SECTIONS.map((s) => (
          <details key={s.id} id={`fx-${s.id}`} className="fx-detail" open={isOpen(s.id)} onToggle={(e) => toggle(s.id, (e.currentTarget as HTMLDetailsElement).open)}>
            <summary>{s.label}</summary>
            {isOpen(s.id) && (
              <div className="fx-detail-body">
                {s.id === "flows" && <Flows career={career} clubId={club.id} />}
                {s.id === "ledger" && <Ledger statements={finance?.statements ?? []} />}
                {s.id === "wages" && <Wages career={career} clubId={club.id} />}
                {s.id === "forecast" && <Forecast career={career} clubId={club.id} projection={projection} limit={limit} />}
              </div>
            )}
          </details>
        ))}
      </section>
    </div>
  );
}

function headline(status: string, lastResult: number | null, seasonEndCash?: number): string {
  if (status === "CRISIS") return "Klubben ligger under krediten. Styrelsen har fryst lönerna och transferbudgeten tills kassan är i balans.";
  if (status === "OVERDRAFT") return "Kassan är negativ men inom krediten. Transferbudgeten är stängd tills den vänder.";
  if (seasonEndCash !== undefined && seasonEndCash < 0) return "Prognosen pekar mot minus före säsongens slut. Se över lönerna innan det blir kris.";
  if (lastResult !== null && lastResult < 0) return "Förra månaden gick med underskott. Hemmamatcher och sponsorer bär resten av säsongen.";
  return "Ekonomin är i balans. Löner, matchintäkter och avtal bokförs månad för månad.";
}

// --- Översikt: cash line + actions (CLB-06a) ---------------------------------------------------------

function Overview({ career, clubId, projection, limit, floorBreach }: { career: CareerState; clubId: string; projection: ReturnType<typeof projectClubFinances>; limit: number; floorBreach: string | null }) {
  const money = useMoney();
  const statements = career.clubFinances?.[clubId]?.statements ?? [];
  const actual = statements.slice(-12);
  const ahead = projection.slice(0, 9);
  const band = projectionBand(ahead);
  const points: CashPoint[] = [...actual.map((s) => ({ label: shortMonth(s.month), value: s.closingCashEur })), ...ahead.map((p) => ({ label: shortMonth(p.month), value: p.closingCashEur, projected: true }))];
  const lows = [...actual.map(() => null), ...band.map((b) => b.low)];
  const actions = financeActions(career, clubId, projection);
  const season = seasonStatements(career, clubId);
  const income = season.reduce((s, st) => s + sumLines(st.lines, "in"), 0);
  const costs = -season.reduce((s, st) => s + sumLines(st.lines, "out"), 0);
  return (
    <div className="fx-cockpit">
      <section className="fx-panel fx-chart" aria-labelledby="cash-title">
        <header><span className="xp-eyebrow">{floorBreach ? `Under kreditgränsen i ${monthLabelSv(floorBreach)}` : "Kassan håller sig över kreditgränsen"}</span><h2 id="cash-title">Kassan månad för månad</h2></header>
        <CashLineChart points={points} lows={lows} bandLabel="Prognos utan uppskattade matchintäkter" format={(v) => money.format(v, { compact: true })} overdraftLimit={limit} label={`Kassan: ${points.length} punkter, senaste ${points.at(-1) ? money.format(points.at(-1)!.value) : "—"}`} />
      </section>
      <section className="fx-panel fx-actions" aria-labelledby="warn-title">
        <header><span className="xp-eyebrow">Att göra</span><h2 id="warn-title">Varningar → åtgärd</h2></header>
        {actions.length === 0 ? <p className="fc-note">Inget kräver ett ekonomiskt beslut just nu. Budgeten för säsongen är fördelad.</p> : (
          <ul>{actions.map((a) => (
            <li key={a.id} data-tone={a.tone}>
              <small>{a.eyebrow}</small>
              <strong>{a.title}</strong>
              <p>{a.consequence}</p>
              <Link className="hm-btn hm-btn-sm" href={a.href}>{a.verb} →</Link>
            </li>
          ))}</ul>
        )}
      </section>
      <dl className="fx-season" aria-label={`Säsongen hittills, ${career.seasonId}`}>
        <div><dt>Intäkter</dt><dd>{money.format(income, { compact: true })}</dd></div>
        <div><dt>Löpande kostnader</dt><dd>{money.format(costs, { compact: true })}</dd></div>
        <div><dt>Löpande resultat</dt><dd data-tone={income - costs >= 0 ? "pos" : "neg"}>{money.format(income - costs, { compact: true })}</dd></div>
        <div><dt>Bokförda månader</dt><dd>{season.length}</dd></div>
      </dl>
    </div>
  );
}

// --- Budget: the one decision (CLB-06c) ---------------------------------------------------------------

function Budget({ career, clubId, onPlan }: { career: CareerState; clubId: string; onPlan: (shift: number) => void }) {
  const money = useMoney();
  const initial = budgetSlider(career, clubId, 0);
  const [draft, setDraft] = useState(initial?.activeShiftEur ?? 0);
  const [message, setMessage] = useState<string | null>(null);
  const b = budgetSlider(career, clubId, draft);
  const current = getClubBudgets(career, clubId);
  if (!b || !current) return null;
  const changed = b.shiftEur !== b.activeShiftEur;
  const nudge = (dir: 1 | -1) => setDraft((v) => Math.max(-b.maxInEur, Math.min(b.maxOutEur, v + dir * b.step)));
  const pos = (v: number) => (b.maxOutEur + b.maxInEur > 0 ? ((v + b.maxInEur) / (b.maxOutEur + b.maxInEur)) * 100 : 50);
  const preview = b.shiftEur === 0 || !b.averageWageEurPerMonth ? null
    : b.shiftEur > 0 ? `+${money.format(b.shiftEur, { compact: true })} till transfers motsvarar ungefär ${Math.abs(b.contractMonths!).toLocaleString("sv-SE")} månadslöner för en snittspelare i truppen (${money.format(b.averageWageEurPerMonth, { compact: true })}/mån).`
    : `+${money.format(-b.shiftEur, { compact: true })} till lönerna ger plats för ungefär ${Math.abs(b.contractMonths!).toLocaleString("sv-SE")} månadslöner à ${money.format(b.averageWageEurPerMonth, { compact: true })} (snittet i truppen).`;
  const confirm = () => { try { onPlan(b.shiftEur); setMessage("Styrelsen har godkänt fördelningen för säsongen."); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Kunde inte spara planen."); } };
  return (
    <section id="fx-budget" className="fx-budget" aria-labelledby="fx-budget-h">
      <header><span className="xp-eyebrow">Styrelsens ramar · {career.seasonId}</span><h2 id="fx-budget-h" className="fx-h">Budgeten</h2></header>
      <div className="fx-budget-grid">
        <div className="fx-sliders">
          <div className="fx-slider" data-locked={b.locked || undefined}>
            <div className="fx-slider-head"><b>Löner ⇄ Transfers</b><span>{b.shiftEur === 0 ? "Styrelsens fördelning" : b.shiftEur > 0 ? `${money.format(b.shiftEur, { compact: true })} till transfers` : `${money.format(-b.shiftEur, { compact: true })} till lönerna`}</span></div>
            {b.locked ? <p className="fc-note">Under krisen tillåter styrelsen ingen omfördelning. Budgetarna är frysta tills kassan är tillbaka över krediten.</p> : (
              <>
                <div className="fx-track">
                  <input type="range" min={-b.maxInEur} max={b.maxOutEur} step={b.step} value={b.shiftEur} onChange={(e) => setDraft(Number(e.target.value))} aria-label="Flytta budget mellan löner och transfers" aria-valuetext={b.shiftEur >= 0 ? `${money.format(b.shiftEur)} till transfers` : `${money.format(-b.shiftEur)} till lönerna`} />
                  <i className="fx-mark" data-mark="board" style={{ left: `${pos(0)}%` }} title="Styrelsens fördelning" />
                  {b.activeShiftEur !== 0 && <i className="fx-mark" data-mark="plan" style={{ left: `${pos(b.activeShiftEur)}%` }} title="Sparad plan" />}
                </div>
                <div className="fx-track-scale"><span>← Mer till löner (max {money.format(b.maxInEur, { compact: true })})</span><span>Mer till transfers (max {money.format(b.maxOutEur, { compact: true })}) →</span></div>
                <div className="fx-steppers">
                  <button type="button" className="hm-btn hm-btn-sm" onClick={() => nudge(-1)} disabled={b.shiftEur <= -b.maxInEur} aria-label="Mer till lönerna">− Löner</button>
                  <MoneyInput className="hm-input fc-shift-input" aria-label="Belopp att flytta till transfers" valueEur={b.shiftEur} onChangeEur={(v) => setDraft(Math.max(-b.maxInEur, Math.min(b.maxOutEur, v)))} />
                  <button type="button" className="hm-btn hm-btn-sm" onClick={() => nudge(1)} disabled={b.shiftEur >= b.maxOutEur} aria-label="Mer till transfers">+ Transfers</button>
                </div>
              </>
            )}
          </div>
          <div className="fx-slider" data-locked>
            <div className="fx-slider-head"><b>Personal</b><span>{money.format(current.staffBudgetEur, { compact: true })} / år</span></div>
            <p className="fc-note">Styrelsens ram. Den kan inte flyttas härifrån; anställningar får gå upp till 15 % över den.</p>
          </div>
          <div className="fx-slider" data-locked>
            <div className="fx-slider-head"><b>Akademi</b><span>{money.format(current.academyBudgetEur, { compact: true })} / år</span></div>
            <p className="fc-note">Avsatt för ungdomsverksamheten av styrelsen. Styrs inte av dig.</p>
          </div>
        </div>
        <aside className="fx-margin" aria-label="Marginal och förhandsvisning">
          <small>Ramen ±15 % av lönebudgeten</small>
          <strong>{Math.round(b.marginUsed * 100)} % använt</strong>
          <i className="fx-kpi-bar" aria-hidden="true"><b style={{ width: `${b.marginUsed * 100}%` }} /></i>
          <dl>
            <div><dt>Lönebudget</dt><dd>{money.format(b.wageEur, { compact: true })}<small>styrelsen {money.format(b.boardWageEur, { compact: true })}</small></dd></div>
            <div><dt>Transferbudget</dt><dd>{money.format(b.transferEur, { compact: true })}<small>styrelsen {money.format(b.boardTransferEur, { compact: true })}</small></dd></div>
          </dl>
          {preview && <p className="fx-preview">{preview}</p>}
          <button type="button" className="hm-btn hm-btn-primary" disabled={b.locked || !changed} onClick={confirm}>Bekräfta plan</button>
          <p className="fc-note" role="status">{message ?? (b.locked ? "Budgetarna är frysta under krisen." : !changed ? (b.activeShiftEur ? "Planen är sparad. Flytta reglaget för att ändra den." : "Flytta reglaget för att fördela om. Planen gäller resten av säsongen.") : "Planen gäller resten av säsongen.")}</p>
        </aside>
      </div>
    </section>
  );
}

// --- Detaljer: Intäkter & kostnader (CLB-06b) -----------------------------------------------------------

function Flows({ career, clubId }: { career: CareerState; clubId: string }) {
  const money = useMoney();
  const season = seasonStatements(career, clubId);
  const totals = new Map<LedgerCategory, number>();
  for (const st of season) for (const l of [...st.lines, ...st.transactions]) totals.set(l.category, (totals.get(l.category) ?? 0) + l.amountEur);
  const rows = [...totals.entries()].map(([category, value]) => ({ key: category, label: LEDGER_CATEGORY_LABEL[category], value, color: LEDGER_CATEGORY_COLOR[category], display: money.format(value) }));
  const income = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const costs = rows.filter((r) => r.value < 0).sort((a, b) => a.value - b.value);
  const scaleMax = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const gauges = homeGauges(career, clubId, season);
  if (season.length === 0) return <p className="fc-note">Första månadsbokslutet kommer i början av nästa hela månad.</p>;
  return (
    <div className="fx-flows">
      <div className="fx-two">
        <section aria-labelledby="in-title"><h3 id="in-title">Intäkter</h3><CategoryBars rows={income} scaleMax={scaleMax} label="Intäkter per kategori" /></section>
        <section aria-labelledby="out-title"><h3 id="out-title">Kostnader</h3><CategoryBars rows={costs} scaleMax={scaleMax} label="Kostnader per kategori" /></section>
      </div>
      <section aria-labelledby="gate-title">
        <h3 id="gate-title">Hemmamatcherna</h3>
        {gauges.length === 0 ? <p className="fc-note">Inga bokförda hemmamatcher ännu.</p> : (
          <ol className="fx-gauges">{gauges.map((g) => { const opp = getClub(g.opponentId); const pct = Math.round(g.fill * 100); return (
            <li key={g.fixtureId} data-derby={g.derby || undefined}>
              <Link href={matchReportHref(g.fixtureId)} aria-label={`${g.date} mot ${opp?.shortName ?? g.opponentId}: ${g.attendance.toLocaleString("sv-SE")} åskådare, ${pct} % fullt, ${money.format(g.revenueEur)}`}>
                <span className="fx-gauge" style={{ ["--fill" as string]: `${pct}%` }}><b>{pct}%</b></span>
                {opp && <ClubCrest shortName={opp.shortName} primaryColor={opp.primaryColor} clubId={opp.id} size={22} />}
                <small>{opp?.shortName ?? g.opponentId}{g.derby ? " · derby" : ""}</small>
                <span className="fx-gauge-detail">{g.attendance.toLocaleString("sv-SE")} · {money.format(g.revenueEur, { compact: true })}</span>
              </Link>
            </li>
          ); })}</ol>
        )}
      </section>
      <CalibrationNote career={career} clubId={clubId} />
    </div>
  );
}

// --- Detaljer: Huvudbok (CLB-06d) ---------------------------------------------------------------------

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60},${18 - ((v - min) / span) * 16}`).join(" ");
  return <svg className="fx-spark" viewBox="0 0 60 20" aria-hidden="true"><polyline points={pts} /></svg>;
}

function Ledger({ statements }: { statements: readonly MonthlyStatement[] }) {
  const money = useMoney();
  const months = ledgerMonths(statements);
  const [open, setOpen] = useState<string | null>(months[0]?.month ?? null);
  if (months.length === 0) return <p className="fc-note">Huvudboken fylls när den första hela månaden är bokförd.</p>;
  return (
    <ol className="fx-ledger">
      {months.map((m) => {
        const isOpen = open === m.month;
        const st = m.statement;
        const lines = [...st.lines].sort((a, b) => b.amountEur - a.amountEur);
        return (
          <li key={m.month}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.month)}>
              <span>{m.label}</span><Spark values={m.spark} /><b data-tone={m.netEur >= 0 ? "pos" : "neg"}>{signed(money, m.netEur)}</b><small>{money.format(m.closingEur, { compact: true })}</small>
            </button>
            {isOpen && (
              <div className="fx-statement">
                <table className="hm-table fc-statement">
                  <tbody>
                    <tr className="fc-row-strong"><th scope="row">Ingående kassa</th><td className="hm-table-num">{money.format(st.openingCashEur)}</td></tr>
                    {lines.map((l) => <tr key={l.category}><th scope="row"><i className="fc-swatch" style={{ backgroundColor: LEDGER_CATEGORY_COLOR[l.category] }} />{LEDGER_CATEGORY_LABEL[l.category]}</th><td className="hm-table-num" data-tone={l.amountEur >= 0 ? "pos" : "neg"}>{money.format(l.amountEur)}</td></tr>)}
                    {st.transactions.map((t, i) => <tr key={`t${i}`} className="fc-row-oneoff"><th scope="row"><i className="fc-swatch" style={{ backgroundColor: LEDGER_CATEGORY_COLOR[t.category] }} />{t.label} <small>{t.date} · {LEDGER_CATEGORY_LABEL[t.category]}</small></th><td className="hm-table-num" data-tone={t.amountEur >= 0 ? "pos" : "neg"}>{money.format(t.amountEur)}</td></tr>)}
                    <tr className="fc-row-strong"><th scope="row">Utgående kassa</th><td className="hm-table-num">{money.format(st.closingCashEur)}</td></tr>
                  </tbody>
                </table>
                <p className="fc-note">Stängd {st.closedOn}.{st.homeMatches.length > 0 ? ` Matchintäkter från ${st.homeMatches.length} hemmamatch${st.homeMatches.length > 1 ? "er" : ""}, totalt ${st.homeMatches.reduce((s, x) => s + x.attendance, 0).toLocaleString("sv-SE")} åskådare.` : ""}</p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// --- Detaljer: Löner (CLB-06e) -----------------------------------------------------------------------------

function Wages({ career, clubId }: { career: CareerState; clubId: string }) {
  const money = useMoney();
  const startYear = Number(career.seasonId.slice(0, 4));
  const seasons = [0, 1, 2].map((k) => ({ label: `${startYear + k}/${String(startYear + k + 1).slice(-2)}`, end: `${startYear + k + 1}-05-31` }));
  const staff = (career.staffRoster[clubId] ?? []).map((m) => career.staffEmployment[m.id]).filter((e): e is NonNullable<typeof e> => !!e);
  const commitments = seasons.map((s) => contractWagesForMonth(career, clubId, s.end) * 12);
  const staffCommitments = seasons.map((s) => staff.filter((e) => e.employmentType === "SALARIED" && (!e.contractEndDate || e.contractEndDate >= s.end)).reduce((sum, e) => sum + (e.wageEurPerMonth ?? 0) * 12, 0));
  return (
    <div className="fx-wages">
      <StackedBars label="Lönekostnader som redan är avtalade, per säsong" format={(v) => money.format(v, { compact: true })} rows={seasons.map((s, i) => ({ key: s.label, label: s.label, parts: [{ key: "players", label: "Spelare", value: commitments[i]!, color: "var(--club-neon)" }, { key: "staff", label: "Personal", value: staffCommitments[i]!, color: "var(--arena-info)" }] }))} />
      <p className="fc-note">Avtal som är giltiga vid säsongens slut, räknat på helår. Avtal som löper ut frigör utrymme; nya kontrakt läggs ovanpå.</p>
      <p className="fx-links"><Link className="hm-btn hm-btn-sm" href="/career/contracts">Lönelistan och avtalen finns under Kontrakt →</Link> <Link className="hm-btn hm-btn-sm hm-btn-ghost" href="/career/staff">Personalen →</Link></p>
    </div>
  );
}

// --- Detaljer: Prognos (CLB-06f) ---------------------------------------------------------------------------

function Forecast({ career, clubId, projection, limit }: { career: CareerState; clubId: string; projection: ReturnType<typeof projectClubFinances>; limit: number }) {
  const money = useMoney();
  if (projection.length === 0) return <p className="fc-note">Prognosen startar när bokföringen är igång.</p>;
  const sum = (f: (p: (typeof projection)[number]) => number) => projection.reduce((s, p) => s + f(p), 0);
  const recurring = sum((p) => p.breakdown.recurringIncomeEur + p.breakdown.associationSupportEur);
  const matchday = sum((p) => p.breakdown.matchdayEstimateEur);
  const costs = sum((p) => p.expensesEur);
  const games = sum((p) => p.breakdown.homeLeagueGames);
  const bridge = career.clubFinances?.[clubId]?.bridgeEurAnnual ?? 0;
  const band = projectionBand(projection);
  const fmt = (v: number) => money.format(v, { compact: true });
  return (
    <div className="fx-forecast">
      <p className="fc-note">Med nuvarande avtal och schema, {monthLabelSv(projection[0]!.month)} till {monthLabelSv(projection.at(-1)!.month)}. Bandet visar hur mycket som hänger på publiken: överkanten med uppskattade matchintäkter, underkanten utan dem.</p>
      <CashLineChart points={projection.map((p) => ({ label: shortMonth(p.month), value: p.closingCashEur, projected: true }))} lows={band.map((b) => b.low)} bandLabel="Utan uppskattade matchintäkter" format={fmt} overdraftLimit={limit} label="Prognostiserad kassa per månad" />
      <ul className="fx-assume">
        <li>Avtalade och återkommande intäkter ger {fmt(recurring)}: sponsorer, media, sportsliga och övriga intäkter{bridge < 0 ? " och föreningsstöd" : ""}, jämnt fördelade och justerade för serienivån.</li>
        <li data-kind="">Matchintäkterna uppskattas till {fmt(matchday)} från {games} schemalagda hemmamatcher i serien med genomsnittlig publik. Form, motstånd och derbyn avgör det verkliga utfallet.</li>
        <li data-kind="">Kostnaderna blir {fmt(costs)}: löner enligt gällande avtal, personal med nuvarande löner och klubbens drift.</li>
        <li data-kind="">Värvningar, försäljningar, nya kontrakt, prispengar, slutspels- och cupmatcher, låneavgifter och avgångsvederlag ingår inte.</li>
        {bridge !== 0 && <li data-kind="">{bridge > 0 ? `Föreningsdrift och resor kostar ${fmt(bridge)} per år.` : `Föreningsstöd och bidrag ger ${fmt(-bridge)} per år.`} Se Intäkter & kostnader.</li>}
      </ul>
      <details className="fx-subdetail">
        <summary>Månad för månad</summary>
        <ol className="fx-forecast-months">{projection.map((p) => { const b = p.breakdown; return (
          <li key={p.month}>
            <b>{monthLabelSv(p.month)}</b>
            <span>Intäkter {fmt(b.recurringIncomeEur + b.associationSupportEur)}{b.matchdayEstimateEur ? <em> + {fmt(b.matchdayEstimateEur)} matchdag ({b.homeLeagueGames})</em> : null}</span>
            <span>Löner {fmt(b.playerWagesEur + b.staffWagesEur)} · övrigt {fmt(b.operationsEur + b.clubOperationsEur)}</span>
            <span data-tone={p.incomeEur - p.expensesEur >= 0 ? "pos" : "neg"}>Resultat {fmt(p.incomeEur - p.expensesEur)}</span>
            <strong data-tone={p.closingCashEur >= 0 ? undefined : "neg"}>{fmt(p.closingCashEur)}</strong>
          </li>
        ); })}</ol>
        <p className="fc-note">Kursiva belopp är uppskattningar; siffran inom parentes är antalet hemmamatcher i serien den månaden.</p>
      </details>
    </div>
  );
}

/** The calibration line, explained where it appears in the books. */
function CalibrationNote({ career, clubId }: { career: CareerState; clubId: string }) {
  const money = useMoney();
  const bridge = career.clubFinances?.[clubId]?.bridgeEurAnnual ?? 0;
  if (!bridge) return null;
  const cost = clubOperationsCostEurAnnual(career, clubId, bridge);
  return (
    <section aria-labelledby="calib-title">
      <h3 id="calib-title">{bridge > 0 ? "Om raden Föreningsdrift och resor" : "Om raden Föreningsstöd och bidrag"}</h3>
      <p className="fc-note">
        {bridge > 0 ? `En kostnad på ${money.format(cost, { compact: true })} per år (${money.format(cost / 12, { compact: true })} i månaden).` : `En fast intäkt på ${money.format(-bridge, { compact: true })} per år (${money.format(-bridge / 12, { compact: true })} i månaden).`}
        {" "}Spelets ekonomidata saknar kostnader och bidrag som svenska klubbar har vid sidan av laget: resor, hallhyror, ungdomsverksamhet och kommunalt stöd. När bokföringen startade lade styrelsen därför in en fast årlig post så att klubbens marginal började nära noll (inom ±6 % av intäkterna). Posten räknas aldrig om{bridge > 0 ? ", men kostnaden följer klubbens serienivå som intäkterna gör (mindre verksamhet och kortare resor en serie ned)" : ""}: allt som händer sedan, löner, transfers och resultat, syns fullt ut i kassan.
      </p>
    </section>
  );
}
