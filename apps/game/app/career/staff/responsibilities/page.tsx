"use client";
// HM-ALPHA3-M06: Ansvarsfördelning -- who handles what at the club. Per
// area the manager decides himself, delegates to a staff member, or lets
// them advise first; proposals wait for approval and every delegated
// action is logged with who did it and why.
import Link from "next/link";
import { useState } from "react";
import { DecisionCard } from "@/components/experience/Moment";
import { PageHeading } from "@/components/manager/Workspace";
import StarRating from "@/components/StarRating";
import { useCareer } from "@/lib/career/CareerContext";
import { approveProposal, delegateFor, delegationOf, modeOf, pendingProposals, rejectProposal, setDelegation } from "@/lib/delegation/delegation";
import { DELEGABLE_AREAS, DELEGATION_MODE_LABEL, type DelegationMode } from "@/lib/delegation/types";
import { useMoney } from "@/lib/settings/usePreferences";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { RESPONSIBILITY_AREAS, RESPONSIBILITY_LABEL, RESPONSIBILITY_OWNER_ROLE, responsibilityCandidates } from "@/lib/staff/organisation";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";

const AREA_SCOPE: Record<string, string> = {
  SCOUTING_ASSIGNMENTS: "Lediga scouter skickas till positionerna där truppen är tunnast.",
  PLAYER_RECRUITMENT: "Kortlistar rekommenderade spelare och marknadsför transferlistade. Bud och förhandlingar kräver alltid dig.",
  CONTRACT_RENEWALS: "Förlänger rotations- och truppspelare inom lönebudgeten. Nyckelspelare kräver ditt godkännande.",
  STAFF_HIRING: "Föreslår förlängningar av personalens avtal och kandidater till vakanta tjänster, även assisterande tränare (inte huvudtränaren). Allt kräver ditt godkännande.",
  YOUTH_INTAKE: "Inte delegerbart i den här versionen.",
  TRAINING_SCHEDULE: "Inte delegerbart i den här versionen.",
  OPPONENT_ANALYSIS: "Inte delegerbart i den här versionen.",
};

export default function ResponsibilitiesPage() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const candidates = responsibilityCandidates(career, career.playerClubId);
  const proposals = pendingProposals(career);
  const log = [...delegationOf(career).log].reverse().slice(0, 25);
  const decided = Object.values(delegationOf(career).proposals).filter((p) => p.status !== "PENDING").sort((a, b) => (b.decidedOn ?? "").localeCompare(a.decidedOn ?? "")).slice(0, 6);
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); } };

  return (
    <div className="dg-page">
      <PageHeading eyebrow="Klubben / organisation" title="Ansvarsfördelning" description="Bestäm vad du gör själv och vad staben sköter. Delegerade beslut följer samma regler som dina egna; nyckelspelare, anställningar och förhandlingar kräver alltid ditt godkännande." actions={<Link className="hm-btn" href="/career/staff">← Personal</Link>} />

      <section className="dg-panel" aria-labelledby="matrix-title">
        <header><span className="xp-eyebrow">Matrisen</span><h2 id="matrix-title">Vem gör vad</h2></header>
        <div className="hm-scroll-x">
          <table className="hm-table dg-matrix">
            <thead><tr><th>Område</th><th>Rollen som äger det</th><th>Ansvarig</th><th>Läge</th><th>Vad det innebär</th></tr></thead>
            <tbody>{RESPONSIBILITY_AREAS.map((area) => {
              const delegable = DELEGABLE_AREAS.includes(area);
              const mode = modeOf(career, area);
              const who = delegateFor(career, area);
              const cand = candidates.find((c) => c.area === area);
              return (
                <tr key={area} data-mode={mode}>
                  <td><b>{RESPONSIBILITY_LABEL[area]}</b></td>
                  <td>{STAFF_ROLE_LABEL[RESPONSIBILITY_OWNER_ROLE[area]]}</td>
                  <td>{who ? <span className="dg-who"><Link href={`/career/staff/${encodeURIComponent(who.staffId)}`}>{who.name}</Link>{cand?.member && <StarRating stars={roleSuitabilityStars(computeRoleSuitability(cand.member, RESPONSIBILITY_OWNER_ROLE[area]))} />}</span> : <span className="pd-note">Ingen i klubben -- du gör det själv</span>}</td>
                  <td>{delegable && who ? (
                    <div className="dg-modes" role="radiogroup" aria-label={`Läge för ${RESPONSIBILITY_LABEL[area]}`}>{(["MANAGER", "ADVISE", "DELEGATE"] as DelegationMode[]).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} data-active={mode === m} onClick={() => run(() => updateCareer((s) => setDelegation(s, area, m, who.staffId)), `${RESPONSIBILITY_LABEL[area]}: ${DELEGATION_MODE_LABEL[m].toLowerCase()}.`)}>{DELEGATION_MODE_LABEL[m]}</button>)}</div>
                  ) : <span className="tc-pill">Du själv</span>}</td>
                  <td className="dg-scope">{AREA_SCOPE[area]}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="pd-note">Staben arbetar varje måndag. <b>Råd först</b>: allt kommer som förslag. <b>Delegera</b>: staben agerar inom ramen och rapporterar.</p>
        {message && <p className="pd-note" role="status">{message}</p>}
      </section>

      <section className="dg-panel" aria-labelledby="proposals-title">
        <header><span className="xp-eyebrow">Väntar på dig</span><h2 id="proposals-title">Förslag från staben</h2></header>
        {proposals.length === 0 ? <p className="pd-note">Inga förslag väntar.</p> : (
          <div className="dg-proposals">{proposals.map((p) => {
            const who = delegateFor(career, p.area);
            return (
              <DecisionCard key={p.id} tone="gold" title={p.title} status={<span className="tc-pill">{RESPONSIBILITY_LABEL[p.area]} · till {p.expiresOn}</span>}
                primary={{ label: "Godkänn", consequence: money.text(p.consequence), onSelect: () => run(() => updateCareer((s) => approveProposal(s, p.id)), "Förslaget är godkänt.") }}
                secondary={<button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => rejectProposal(s, p.id)), "Förslaget är avslaget.")}>Avslå</button>}>
                <p className="pd-note"><b>{who?.name ?? "Staben"}:</b> {money.text(p.reason)}</p>
                {p.action.kind === "OPEN_NEGOTIATION" && <Link className="hm-btn hm-btn-sm" href={`/career/transfers/${encodeURIComponent(p.action.playerId)}`}>Titta på spelaren först →</Link>}
              </DecisionCard>
            );
          })}</div>
        )}
        {decided.length > 0 && <ul className="dg-decided">{decided.map((p) => <li key={p.id} data-status={p.status}><b>{p.title}</b><small>{p.status === "APPROVED" ? "Godkänt" : p.status === "REJECTED" ? "Avslaget" : p.status === "FAILED" ? `Gick inte: ${money.text(p.outcome ?? "")}` : p.status === "WITHDRAWN" ? `Återkallat: ${p.outcome ?? ""}` : "Gick ut"} · {p.decidedOn}{p.status === "APPROVED" && p.outcome ? ` · ${p.outcome}` : ""}</small>{p.status === "APPROVED" && p.action.kind === "OPEN_NEGOTIATION" && <Link href={`/career/transfers/${encodeURIComponent(p.action.playerId)}`}>Öppna förhandlingsrummet →</Link>}</li>)}</ul>}
      </section>

      <section className="dg-panel" aria-labelledby="log-title">
        <header><span className="xp-eyebrow">Revision</span><h2 id="log-title">Vad staben har gjort</h2></header>
        {log.length === 0 ? <p className="pd-note">Inget delegerat arbete ännu.</p> : (
          <ol className="dg-log">{log.map((l, i) => <li key={i} data-result={l.result}><time>{l.date}</time><b>{l.staffName}</b><span>{money.text(l.action)}</span><small>{money.text(l.reason)}</small><em>{l.result === "DONE" ? "Utfört" : l.result === "PROPOSED" ? "Föreslaget" : l.result === "APPROVED" ? "Godkänt" : l.result === "REJECTED" ? "Avslaget" : l.result === "WITHDRAWN" ? "Återkallat" : "Stoppat"}</em></li>)}</ol>
        )}
      </section>
    </div>
  );
}
