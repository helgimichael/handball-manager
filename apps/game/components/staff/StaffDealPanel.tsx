"use client";
// HM-ALPHA3-M04: everything the manager can do with one person -- research
// them, approach them (and their club), negotiate terms, renew or dismiss
// their contract. One panel, driven by lib/staff/staffNegotiation.ts.
import { useState } from "react";
import MoneyInput from "@/components/MoneyInput";
import { DecisionCard } from "@/components/experience/Moment";
import { ProgressSteps } from "@/components/experience/primitives";
import { useCareer } from "@/lib/career/CareerContext";
import { currencySymbol } from "@/lib/economy/currency";
import { getClub } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { startStaffResearch } from "@/lib/staff/staffMarket";
import { compensationDemand, dismissalCost, dismissStaff, openNegotiationFor, startStaffNegotiation, submitStaffOffer, wageDemand, withdrawStaffNegotiation } from "@/lib/staff/staffNegotiation";
import { STAFF_ROLES, type ResolvedStaffMember, type StaffRole } from "@/lib/staff/types";

export function StaffDealPanel({ member, mode }: { member: ResolvedStaffMember; mode: "HIRE" | "OWN" }) {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const negotiation = openNegotiationFor(career, member.id);
  const closed = Object.values(career.staffNegotiations ?? {}).filter((n) => n.staffId === member.id && n.stage !== "CLUB" && n.stage !== "TERMS").at(-1);
  const kind = mode === "OWN" ? "RENEW" : "HIRE";
  const [role, setRole] = useState<StaffRole>(member.roles[0] ?? "SCOUT");
  const last = negotiation?.rounds.at(-1);
  const counterWage = last?.counter?.wageEurPerMonth;
  const counterComp = last?.counter?.compensationEur;
  const suggested = counterWage ?? (mode === "OWN" ? career.staffEmployment[member.id]?.wageEurPerMonth : undefined) ?? career.staffMarket?.asking[member.id] ?? Math.round((career.staffEmployment[member.id]?.wageEurPerMonth ?? 1000) * 1.1);
  const [wage, setWage] = useState<number>(suggested);
  const [years, setYears] = useState(2);
  const [compensation, setCompensation] = useState<number>(counterComp ?? Math.round(compensationDemand(career, member.id) * 0.7));
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const fromClub = negotiation?.fromClubId ? getClub(negotiation.fromClubId)?.shortName : undefined;
  const researching = career.staffResearch?.[member.id];

  function act(fn: () => void) {
    try { fn(); setMessage(null); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); }
  }
  function offerTerms() {
    act(() => updateCareer((s) => {
      const existing = openNegotiationFor(s, member.id);
      const started = existing ? { state: s, negotiation: existing } : startStaffNegotiation(s, member.id, role, kind);
      return submitStaffOffer(started.state, started.negotiation.id, started.negotiation.stage === "CLUB" ? { compensationEur: compensation } : { wageEurPerMonth: wage, years, role });
    }));
  }

  const steps = negotiation?.fromClubId || (!negotiation && mode === "HIRE" && member.clubId)
    ? [{ label: "Klubben", state: negotiation ? (negotiation.stage === "CLUB" ? "current" : "done") : "current" }, { label: "Villkoren", state: negotiation?.stage === "TERMS" ? "current" : "todo" }, { label: "Klart", state: "todo" }] as const
    : [{ label: "Villkoren", state: "current" }, { label: "Klart", state: "todo" }] as const;
  const stage = negotiation?.stage ?? (mode === "HIRE" && member.clubId && member.clubId !== career.playerClubId ? "CLUB" : "TERMS");

  return (
    <section className="st-deal" aria-label={mode === "OWN" ? "Kontrakt" : "Rekrytera"}>
      <header className="st-deal-head">
        <span className="xp-eyebrow">{mode === "OWN" ? "Avtal" : "Rekrytering"}</span>
        <h3>{mode === "OWN" ? "Förläng eller avsluta" : `Värva ${member.displayName.split(" ")[0]}`}</h3>
        {(negotiation || mode === "HIRE") && <ProgressSteps surface="paper" label="Förhandlingens steg" steps={steps.map((s) => ({ label: s.label, state: s.state }))} />}
      </header>

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
              <label>Erbjuden lön / månad ({currencySymbol()})<MoneyInput className="tc-input" minEur={0} stepEur={50} valueEur={wage} onChangeEur={setWage} /></label>
              <label>Kontraktslängd<select className="tc-input" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y} år</option>)}</select></label>
              {mode === "HIRE" && <label>Roll<select className="tc-input" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>{STAFF_ROLES.filter((r) => r !== "HEAD_COACH").map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}</select></label>}
            </>
          )}
          <p className="st-note">{stage === "CLUB" ? `Klubben vill ha ungefär ${money.format(compensationDemand(career, member.id))} för återstoden av avtalet.` : `Förväntad lön runt ${money.format(wageDemand(career, member.id, career.playerClubId, role, kind))} i månaden. Svar dagen efter.`}</p>
          <button type="submit" className="hm-btn hm-btn-primary tc-cta">{stage === "CLUB" ? "Lägg bud på ersättning" : mode === "OWN" ? "Erbjud förlängning" : "Erbjud kontrakt"}</button>
        </form>
      )}
      {closed && !negotiation && <p className="st-note">Senaste förhandlingen: {closed.stage === "COMPLETED" ? "klar" : closed.stage === "REJECTED" ? "avbruten av motparten" : closed.stage === "EXPIRED" ? "gick ut" : "avbruten"} ({closed.rounds.at(-1)?.date}).</p>}

      {mode === "OWN" && (
        <DecisionCard
          tone="loss"
          title="Säg upp avtalet"
          primary={confirmDismiss ? { label: "Bekräfta uppsägning", consequence: `Avgångsvederlag ${money.format(dismissalCost(career, member.id))} bokförs direkt`, onSelect: () => act(() => updateCareer((s) => dismissStaff(s, member.id))) } : undefined}
          secondary={confirmDismiss ? <button type="button" className="hm-btn" onClick={() => setConfirmDismiss(false)}>Behåll</button> : <button type="button" className="hm-btn" onClick={() => setConfirmDismiss(true)}>Säg upp…</button>}
        >
          {`Personen lämnar direkt och blir fri agent. Klubben betalar resterande lön, högst sex månader: ${money.format(dismissalCost(career, member.id))}.`}
        </DecisionCard>
      )}
      {message && <p className="tc-error" role="alert">{message}</p>}
    </section>
  );
}
