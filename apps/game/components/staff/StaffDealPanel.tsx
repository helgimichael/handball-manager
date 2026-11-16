"use client";
// HM-ALPHA3-M04: everything the manager can do with one person -- research
// them, approach them (and their club), negotiate terms, renew or dismiss
// their contract. One panel, driven by lib/staff/staffNegotiation.ts.
// Arena Nights 231 -- STF-02b A: stepper + form + a budget bar previewing the deal against the board's staff
// limit; dismissal is a separate danger action behind a confirm dialog (same dismissStaff, same cost).
import { useState } from "react";
import MoneyInput from "@/components/MoneyInput";
import { ProgressSteps } from "@/components/experience/primitives";
import { useCareer } from "@/lib/career/CareerContext";
import { currencySymbol } from "@/lib/economy/currency";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { startStaffResearch } from "@/lib/staff/staffMarket";
import { compensationDemand, dismissalCost, dismissStaff, openNegotiationFor, staffSpendingLimit, startStaffNegotiation, submitStaffOffer, wageDemand, withdrawStaffNegotiation, type StaffPromise, type StaffResponsibility } from "@/lib/staff/staffNegotiation";
import { getClubStaffCostsEurAnnual } from "@/lib/economy/clubEconomyIntegration";
import { STAFF_ROLES, type ResolvedStaffMember, type StaffRole } from "@/lib/staff/types";

const RESPONSIBILITY_OPTIONS: { id: StaffResponsibility; label: string }[] = [
  { id: "MAIN_COACHING", label: "Huvudansvar träningsupplägg & matchledning" },
  { id: "ASSISTANT_SUPPORT", label: "Assisterande tränarstab & individuell coachning" },
  { id: "YOUTH_DEV", label: "Ungdomsutveckling & akademiintegration" },
  { id: "MATCH_ANALYSIS", label: "Taktisk matchanalys & scouting" },
  { id: "MEDICAL_REHAB", label: "Skaderehabilitering & medicinskt team" },
];

const PROMISE_OPTIONS: { id: StaffPromise; label: string }[] = [
  { id: "NONE", label: "Inga särskilda löften" },
  { id: "AUTONOMY", label: "Fullt mandat och självständighet i rollen" },
  { id: "FACILITY_UPGRADE", label: "Satsning på tränings- och analysfaciliteter" },
  { id: "KEY_STAFF_ROLE", label: "Långsiktig nyckelroll i föreningens sportsliga ledning" },
];

export function StaffDealPanel({ member, mode, initialRole }: { member: ResolvedStaffMember; mode: "HIRE" | "OWN"; initialRole?: StaffRole }) {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const negotiation = openNegotiationFor(career, member.id);
  const closed = Object.values(career.staffNegotiations ?? {}).filter((n) => n.staffId === member.id && n.stage !== "CLUB" && n.stage !== "TERMS").at(-1);
  const kind = mode === "OWN" ? "RENEW" : "HIRE";
  const [role, setRole] = useState<StaffRole>(initialRole && initialRole !== "HEAD_COACH" ? initialRole : member.roles[0] ?? "SCOUT");
  const last = negotiation?.rounds.at(-1);
  const counterWage = last?.counter?.wageEurPerMonth;
  const counterComp = last?.counter?.compensationEur;
  const suggested = counterWage ?? (mode === "OWN" ? career.staffEmployment[member.id]?.wageEurPerMonth : undefined) ?? career.staffMarket?.asking[member.id] ?? Math.round((career.staffEmployment[member.id]?.wageEurPerMonth ?? 1000) * 1.1);
  const [wage, setWage] = useState<number>(suggested);
  const [years, setYears] = useState(2);
  const [compensation, setCompensation] = useState<number>(counterComp ?? Math.round(compensationDemand(career, member.id) * 0.7));
  const [responsibilities, setResponsibilities] = useState<StaffResponsibility>("MAIN_COACHING");
  const [signingBonus, setSigningBonus] = useState<number>(0);
  const [promise, setPromise] = useState<StaffPromise>("NONE");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const fromClub = negotiation?.fromClubId ? getClub(negotiation.fromClubId)?.shortName : undefined;
  const researching = career.staffResearch?.[member.id];

  const me = career.playerClubId;
  const cash = career.clubEconomies[me]?.cashEur ?? 0;
  const staffLimit = staffSpendingLimit(career, me);
  const currentStaffCosts = getClubStaffCostsEurAnnual(career, me);
  const currentMemberAnnual = mode === "OWN" ? (career.staffEmployment[member.id]?.wageEurPerMonth ?? 0) * 12 : 0;
  const projectedStaffAnnual = currentStaffCosts - currentMemberAnnual + wage * 12;
  const isOverBudget = projectedStaffAnnual > staffLimit;
  const stage = negotiation?.stage ?? (mode === "HIRE" && member.clubId && member.clubId !== career.playerClubId ? "CLUB" : "TERMS");
  const immediateCost = (stage === "CLUB" ? compensation : (negotiation?.agreedCompensationEur ?? 0)) + signingBonus;
  const isCashInsufficient = immediateCost > cash;

  function act(fn: () => void) {
    try { fn(); setMessage(null); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); }
  }
  function offerTerms() {
    act(() => updateCareer((s) => {
      const existing = openNegotiationFor(s, member.id);
      const started = existing ? { state: s, negotiation: existing } : startStaffNegotiation(s, member.id, role, kind);
      return submitStaffOffer(
        started.state,
        started.negotiation.id,
        started.negotiation.stage === "CLUB"
          ? { compensationEur: compensation }
          : { wageEurPerMonth: wage, years, role, responsibilities, signingBonusEur: signingBonus, promise }
      );
    }));
  }

  const steps = negotiation?.fromClubId || (!negotiation && mode === "HIRE" && member.clubId)
    ? [{ label: "Klubben", state: negotiation ? (negotiation.stage === "CLUB" ? "current" : "done") : "current" }, { label: "Villkoren", state: negotiation?.stage === "TERMS" ? "current" : "todo" }, { label: "Klart", state: "todo" }] as const
    : [{ label: "Villkoren", state: "current" }, { label: "Klart", state: "todo" }] as const;

  return (
    <section className="st-deal" aria-label={mode === "OWN" ? "Kontrakt" : "Rekrytera"}>
      <header className="st-deal-head">
        <span className="xp-eyebrow">{mode === "OWN" ? "Avtal" : "Rekrytering"}</span>
        <h3>{mode === "OWN" ? "Förläng eller avsluta" : `Värva ${member.displayName.split(" ")[0]}`}</h3>
        {(negotiation || mode === "HIRE") && <ProgressSteps surface="paper" label="Förhandlingens steg" steps={steps.map((s) => ({ label: s.label, state: s.state }))} />}
      </header>

      {/* STF-02b: the consequence preview -- the staff budget bar with this deal against the board's limit. */}
      <div className="sf-budget" data-over={isOverBudget || undefined}>
        <div className="sf-budget-bar" role="img" aria-label={`Personalkostnad efter avtalet ${money.format(projectedStaffAnnual)} av ramen ${money.format(staffLimit)} per år`}>
          <i data-k="base" style={{ width: `${Math.min(100, ((currentStaffCosts - currentMemberAnnual) / Math.max(staffLimit, projectedStaffAnnual, 1)) * 100)}%` }} />
          <i data-k="deal" style={{ width: `${Math.min(100, ((wage * 12) / Math.max(staffLimit, projectedStaffAnnual, 1)) * 100)}%` }} />
          <b data-k="limit" style={{ left: `${Math.min(100, (staffLimit / Math.max(staffLimit, projectedStaffAnnual, 1)) * 100)}%` }} aria-hidden="true" />
        </div>
        <dl className="sf-budget-facts">
          <div><dt>Personalkostnad efter</dt><dd className="sf-num">{money.format(projectedStaffAnnual, { compact: true })}<small> / {money.format(staffLimit, { compact: true })} per år</small></dd></div>
          <div><dt>{mode === "OWN" ? "Ändring mot i dag" : "Avtalet per år"}</dt><dd className="sf-num">{mode === "OWN" ? `${wage * 12 - currentMemberAnnual >= 0 ? "+" : "−"}${money.format(Math.abs(wage * 12 - currentMemberAnnual), { compact: true })}` : money.format(wage * 12, { compact: true })}</dd></div>
          <div><dt>Direkt kostnad</dt><dd className="sf-num">{money.format(immediateCost, { compact: true })}<small> · kassa {money.format(cash, { compact: true })}</small></dd></div>
          <div><dt>Åtagande totalt</dt><dd className="sf-num">{money.format(wage * 12 * years + signingBonus, { compact: true })}<small> · {years} år</small></dd></div>
        </dl>
        {isOverBudget && <p className="sf-warn">Över styrelsens ram med {money.format(projectedStaffAnnual - staffLimit)}/år.</p>}
        {isCashInsufficient && <p className="sf-warn">Kassan räcker inte till den direkta kostnaden ({money.format(immediateCost)}).</p>}
      </div>

      {mode === "HIRE" && !researching && (career.staffKnowledge?.[member.id] ?? 0) < 80 && (
        <button type="button" className="hm-btn hm-btn-sm" onClick={() => act(() => updateCareer((s) => startStaffResearch(s, member.id)))}>Ta referenser</button>
      )}
      {researching && <p className="st-note">Referenser tas. Klart {researching.readyOn}.</p>}

      {last?.reason && <blockquote className="tc-stance" data-response={last.response}>{money.text(last.reason)}</blockquote>}
      {negotiation?.answerOn ? (
        <div className="tc-wait" role="status"><span className="tc-wait-mark" aria-hidden="true" /><span>Budet ligger på bordet. Svar {negotiation.answerOn}.</span><button type="button" className="hm-btn hm-btn-sm tc-quiet" onClick={() => act(() => updateCareer((s) => withdrawStaffNegotiation(s, negotiation.id)))}>Dra dig ur</button></div>
      ) : (
        <form className="st-deal-form" noValidate onSubmit={(e) => { e.preventDefault(); offerTerms(); }}>
          {stage === "CLUB" ? (
            <label>Ersättning till {fromClub ?? getClub(member.clubId)?.shortName ?? "klubben"} ({currencySymbol()})<MoneyInput className="tc-input" minEur={0} stepEur={500} valueEur={compensation} onChangeEur={setCompensation} /></label>
          ) : (
            <>
              {mode === "HIRE" && (
                <label>Roll<select className="tc-input" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>{STAFF_ROLES.filter((r) => r !== "HEAD_COACH").map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}</select></label>
              )}
              <label>Kontraktslängd<select className="tc-input" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y} år</option>)}</select></label>
              <label>Erbjuden lön / månad ({currencySymbol()})<MoneyInput className="tc-input" minEur={0} stepEur={50} valueEur={wage} onChangeEur={setWage} /></label>
              <label>Ansvarsområde & omfattning<select className="tc-input" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value as StaffResponsibility)}>{RESPONSIBILITY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
              <label>Signeringsbonus ({currencySymbol()})<MoneyInput className="tc-input" minEur={0} stepEur={250} valueEur={signingBonus} onChangeEur={setSigningBonus} /></label>
              <label>Löfte & sportslig satsning<select className="tc-input" value={promise} onChange={(e) => setPromise(e.target.value as StaffPromise)}>{PROMISE_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
            </>
          )}
          <p className="st-note">{stage === "CLUB" ? `Klubben vill ha ungefär ${money.format(compensationDemand(career, member.id))} för återstoden av avtalet.` : `Förväntad lön runt ${money.format(wageDemand(career, member.id, career.playerClubId, role, kind))} i månaden. Svar dagen efter.`}</p>
          <button type="submit" className="hm-btn hm-btn-primary tc-cta">{stage === "CLUB" ? "Lägg bud på ersättning" : mode === "OWN" ? "Erbjud förlängning" : "Erbjud kontrakt"}</button>
        </form>
      )}
      {closed && !negotiation && <p className="st-note">Senaste förhandlingen: {closed.stage === "COMPLETED" ? "klar" : closed.stage === "REJECTED" ? "avbruten av motparten" : closed.stage === "EXPIRED" ? "gick ut" : "avbruten"} ({closed.rounds.at(-1)?.date}).</p>}

      {mode === "OWN" && (
        <div className="sf-danger">
          <button type="button" className="hm-btn sf-danger-btn" onClick={() => setConfirmDismiss(true)}>Säg upp…</button>
          <small>Personen lämnar direkt. Avgångsvederlag {money.format(dismissalCost(career, member.id))}.</small>
        </div>
      )}
      {mode === "OWN" && confirmDismiss && (
        <>
          <button type="button" className="sf-scrim" aria-label="Avbryt" tabIndex={-1} onClick={() => setConfirmDismiss(false)} />
          <div className="sf-modal" role="alertdialog" aria-modal="true" aria-labelledby="sf-dismiss-title" aria-describedby="sf-dismiss-desc">
            <h3 id="sf-dismiss-title">Säga upp {member.displayName}?</h3>
            <p id="sf-dismiss-desc">Personen lämnar direkt och blir fri agent. Klubben betalar resterande lön, högst sex månader: <b className="sf-num">{money.format(dismissalCost(career, member.id))}</b>, bokfört direkt i Ekonomi. Det går inte att ångra.</p>
            <div className="sf-modal-actions">
              <button type="button" className="hm-btn" autoFocus onClick={() => setConfirmDismiss(false)}>Behåll</button>
              <button type="button" className="hm-btn sf-danger-btn" onClick={() => { act(() => updateCareer((s) => dismissStaff(s, member.id))); setConfirmDismiss(false); }}>Bekräfta uppsägning</button>
            </div>
          </div>
        </>
      )}
      {message && <p className="tc-error" role="alert">{message}</p>}
    </section>
  );
}
