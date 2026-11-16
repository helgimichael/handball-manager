"use client";
// HM-ALPHA3-M06: Ansvarsfördelning -- who handles what at the club; proposals wait for approval and every
// delegated action is logged with who did it and why.
// Arena Nights 231 -- STF-04 B "Contextual delegation + proposals queue": the page is now a calm overview --
// the one proposals queue first (8/12), mode summary chips per area (4/12) that link to where the mode is set
// (the domain page's "Vem gör det?" toggle, or the STF-01 matrix), and a log filterable by area and staff.
// The queue, approve/reject and every M6C/M6D flow are the existing functions, unchanged: training plans are
// still reviewed on the training page (the approve button says so), negotiations still open in the room.
import Link from "next/link";
import { useState } from "react";
import { StaffNav } from "@/components/staff/StaffNav";
import { DecisionCard } from "@/components/experience/Moment";
import { PageHeading } from "@/components/manager/Workspace";
import { useCareer } from "@/lib/career/CareerContext";
import { approveProposal, delegateFor, delegationOf, pendingProposals, rejectProposal } from "@/lib/delegation/delegation";
import { DELEGATION_MODE_LABEL } from "@/lib/delegation/types";
import { useMoney } from "@/lib/settings/usePreferences";
import { RESPONSIBILITY_AREAS, RESPONSIBILITY_LABEL, type ResponsibilityArea } from "@/lib/staff/organisation";
import { delegationSummary, filterDelegationLog } from "@/lib/staff/staffDesk";

const AREA_SCOPE: Record<ResponsibilityArea, string> = {
  SCOUTING_ASSIGNMENTS: "Lediga scouter skickas till positionerna där truppen är tunnast.",
  PLAYER_RECRUITMENT: "Kortlistar rekommenderade spelare och marknadsför transferlistade. Bud och förhandlingar kräver alltid dig.",
  CONTRACT_RENEWALS: "Förlänger rotations- och truppspelare inom lönebudgeten. Nyckelspelare kräver ditt godkännande.",
  STAFF_HIRING: "Föreslår förlängningar av personalens avtal och kandidater till vakanta tjänster, även assisterande tränare (inte huvudtränaren). Allt kräver ditt godkännande.",
  YOUTH_INTAKE: "Inte delegerbart i den här versionen.",
  TRAINING_SCHEDULE: "Veckoplan från assistenten. Individuella instruktioner kräver ditt godkännande.",
  OPPONENT_ANALYSIS: "Inte delegerbart i den här versionen.",
};
/** Where each area's mode is set: its domain page's toggle where one exists, otherwise the organisation matrix. */
const AREA_HOME: Record<ResponsibilityArea, { href: string; label: string }> = {
  SCOUTING_ASSIGNMENTS: { href: "/career/scouting", label: "Scouting" },
  STAFF_HIRING: { href: "/career/staff/recruitment", label: "Personalrekrytering" },
  PLAYER_RECRUITMENT: { href: "/career/staff#matrix", label: "Organisationen" },
  CONTRACT_RENEWALS: { href: "/career/staff#matrix", label: "Organisationen" },
  TRAINING_SCHEDULE: { href: "/career/staff#matrix", label: "Organisationen" },
  YOUTH_INTAKE: { href: "/career/staff#matrix", label: "Organisationen" },
  OPPONENT_ANALYSIS: { href: "/career/staff#matrix", label: "Organisationen" },
};
const RESULT_LABEL: Record<string, string> = { DONE: "Utfört", PROPOSED: "Föreslaget", APPROVED: "Godkänt", REJECTED: "Avslaget", WITHDRAWN: "Återkallat", EXPIRED: "Förföll", FAILED: "Misslyckades", SKIPPED: "Stoppat" };

export default function ResponsibilitiesPage() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<ResponsibilityArea | "ALL">("ALL");
  const [staffFilter, setStaffFilter] = useState<string>("ALL");
  const summary = delegationSummary(career);
  const proposals = pendingProposals(career);
  const fullLog = delegationOf(career).log;
  const log = filterDelegationLog(career, { area: areaFilter, staffId: staffFilter });
  const logStaff = [...new Map(fullLog.map((l) => [l.staffId, l.staffName])).entries()];
  const decided = Object.values(delegationOf(career).proposals).filter((p) => p.status !== "PENDING").sort((a, b) => (b.decidedOn ?? "").localeCompare(a.decidedOn ?? "")).slice(0, 6);
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); } };

  return (
    <div className="dg-page sf-page">
      <PageHeading eyebrow="Klubben / organisation" title="Ansvarsfördelning" description="Det här väntar på dig, vem som bär vad och vad staben har gjort. Läget ställer du där det märks: i scoutingen, i personalrekryteringen och i organisationens matris." actions={<Link className="hm-btn" href="/career/staff">← Personal</Link>} />
      <StaffNav />

      <div className="sf-deleg">
        <section className="dg-panel sf-queue" aria-labelledby="proposals-title">
          <header><span className="xp-eyebrow">Väntar på dig</span><h2 id="proposals-title">Förslag från staben <b className="sf-num">{proposals.length}</b></h2></header>
          {proposals.length === 0 ? <p className="pd-note">Inga förslag väntar. Sätt ett område på <b>Råd först</b> så kommer stabens förslag hit.</p> : (
            <div className="dg-proposals">{proposals.map((p) => {
              const who = delegateFor(career, p.area);
              return (
                <DecisionCard key={p.id} tone="gold" title={p.title} status={<span className="tc-pill">{RESPONSIBILITY_LABEL[p.area]} · till {p.expiresOn}</span>}
                  primary={{ label: "Godkänn", consequence: p.action.kind === "TRAINING_PLAN" ? "Träningsplaner granskas och godkänns i träningsveckan." : money.text(p.consequence), disabled: p.action.kind === "TRAINING_PLAN", onSelect: () => run(() => updateCareer((s) => approveProposal(s, p.id)), "Förslaget är godkänt.") }}
                  secondary={<button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => rejectProposal(s, p.id)), "Förslaget är avslaget.")}>Avslå</button>}>
                  <p className="pd-note"><b>{who ? <Link href={`/career/staff/${encodeURIComponent(who.staffId)}`}>{who.name}</Link> : "Staben"}:</b> {money.text(p.reason)}</p>
                  {p.action.kind === "TRAINING_PLAN" && <Link className="hm-btn hm-btn-primary" href="/career/training">Granska och ändra träningsplan →</Link>}
                  {p.action.kind === "OPEN_NEGOTIATION" && <Link className="hm-btn hm-btn-sm" href={`/career/transfers/${encodeURIComponent(p.action.playerId)}`}>Titta på spelaren först →</Link>}
                </DecisionCard>
              );
            })}</div>
          )}
          {message && <p className="pd-note" role="status">{message}</p>}
          {decided.length > 0 && <ul className="dg-decided">{decided.map((p) => <li key={p.id} data-status={p.status}><b>{p.title}</b><small>{p.status === "APPROVED" ? "Godkänt" : p.status === "REJECTED" ? "Avslaget" : p.status === "FAILED" ? `Gick inte: ${money.text(p.outcome ?? "")}` : p.status === "WITHDRAWN" ? `Återkallat: ${p.outcome ?? ""}` : "Gick ut"} · {p.decidedOn}{p.status === "APPROVED" && p.outcome ? ` · ${p.outcome}` : ""}</small>{p.status === "APPROVED" && p.action.kind === "OPEN_NEGOTIATION" && <Link href={`/career/transfers/${encodeURIComponent(p.action.playerId)}`}>Öppna förhandlingsrummet →</Link>}</li>)}</ul>}
        </section>

        <aside className="dg-panel sf-modes-summary" aria-labelledby="modes-title">
          <header><span className="xp-eyebrow">Läget i dag</span><h2 id="modes-title">Vem gör vad</h2></header>
          <ul>
            {summary.map((a) => (
              <li key={a.area} data-mode={a.mode}>
                <div><b>{RESPONSIBILITY_LABEL[a.area]}</b><small>{a.who ? <Link href={`/career/staff/${encodeURIComponent(a.who.staffId)}`}>{a.who.name}</Link> : "Ingen i klubben -- du gör det själv"}{a.pending ? ` · ${a.pending} förslag` : ""}</small></div>
                <span className="sf-chip" data-mode={a.mode}>{a.delegable && a.who ? DELEGATION_MODE_LABEL[a.mode] : "Du själv"}</span>
                <p>{AREA_SCOPE[a.area]}</p>
                {a.delegable && a.who ? <Link className="sf-more" href={AREA_HOME[a.area].href}>Ändra i {AREA_HOME[a.area].label} →</Link> : null}
              </li>
            ))}
          </ul>
          <p className="pd-note">Staben arbetar varje måndag. <b>Råd först</b>: allt kommer som förslag. <b>Delegera</b>: staben agerar inom ramen och rapporterar.</p>
        </aside>
      </div>

      <section className="dg-panel" aria-labelledby="log-title">
        <header><span className="xp-eyebrow">Aktivitetslogg</span><h2 id="log-title">Vad staben har gjort</h2></header>
        <div className="sf-log-filters">
          <label>Område<select className="hm-select" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value as ResponsibilityArea | "ALL")}><option value="ALL">Alla områden</option>{RESPONSIBILITY_AREAS.map((a) => <option key={a} value={a}>{RESPONSIBILITY_LABEL[a]}</option>)}</select></label>
          <label>Person<select className="hm-select" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}><option value="ALL">Alla</option>{logStaff.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
        <p className="pd-note">Senaste aktiviteten per ansvarsområde (upp till 40 poster per område). Avtal, övergångar och anställningar finns kvar i sin egen historik.</p>
        {log.length === 0 ? <p className="pd-note">{fullLog.length === 0 ? "Inget delegerat arbete ännu." : "Inget i loggen matchar filtret."}</p> : (
          <ol className="dg-log">{log.map((l, i) => <li key={i} data-result={l.result}><time>{l.date}</time><b>{l.staffName}</b><span>{money.text(l.action)}</span><small>{RESPONSIBILITY_LABEL[l.area]} · {money.text(l.reason)}</small><em>{RESULT_LABEL[l.result] ?? l.result}</em></li>)}</ol>
        )}
      </section>
    </div>
  );
}
