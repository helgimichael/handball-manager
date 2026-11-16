"use client";
// Arena Nights 231 -- WLD-01 / WLD-01b: a message's decision resolved in place.
// Every button calls the same existing mutation the owning screen uses
// (player talks, board recovery plan, press actions); the consequence
// preview is the copy those screens already show. Once resolved, the
// outcome is shown as a "Följd" badge.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { matchDayHref } from "@/lib/career/fixtureRoutes";
import type { InboxDecision as Decision } from "@/lib/inbox/threads";
import { submitBoardRecoveryPlan } from "@/lib/board/board";
import { delegatePressAction, skipPressAction } from "@/lib/media/actions";
import { answerConcern, decideTransferRequest } from "@/lib/players/talks";

const AREA_LABEL = { PLAYER: "Spelaren", TEAM: "Truppen", BOARD: "Styrelsen", MEDIA: "Media", RIVAL: "Rivalen", SUPPORTERS: "Supportrarna", REPUTATION: "Ditt rykte", PRESSURE: "Pressen inför matchen", DISCIPLINE: "Disciplin" } as const;
const REQUEST_LABEL = { ACCEPTED: "Godkänd: han är transferlistad", REFUSED: "Avslagen", WITHDRAWN: "Han stannar på ditt löfte", OPEN: "" } as const;

export function InboxDecision({ decision, compact = false }: { decision: Decision; compact?: boolean }) {
  const { career, updateCareer } = useCareer();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => void, ok: string) => { try { fn(); setNote({ ok: true, text: ok }); } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Det gick inte." }); } };
  const assistant = (career.staffRoster[career.playerClubId] ?? []).find((m) => m.roles[0] === "ASSISTANT_COACH");
  const status = note ? <p className="ib-decision-note" role="status" data-ok={note.ok}>{note.text}</p> : null;

  if (decision.kind === "concern") {
    if (!decision.open) return <Outcome title={decision.answer ? `Du svarade: ${decision.answer}` : "Samtalet är avslutat"} text={decision.outcome} sign={decision.effect === "NEGATIVE" ? "minus" : decision.effect === "POSITIVE" ? "plus" : undefined} date={decision.answeredOn}>{status}</Outcome>;
    return <section className="ib-decision" aria-label="Ditt beslut"><h3>Ditt svar</h3>
      <div className="ib-options">{decision.options.slice(0, compact ? 3 : undefined).map((o) => <button key={o.id} type="button" className="ib-option" onClick={() => run(() => updateCareer((s) => answerConcern(s, decision.concernId, o.id)), "Du har svarat.")}><b>{o.label}</b><small>{o.consequence}</small></button>)}</div>
      {compact && decision.options.length > 3 && <p className="ib-hint">{decision.options.length - 3} svar till i läsaren.</p>}{status}</section>;
  }
  if (decision.kind === "transferRequest") {
    if (!decision.open) return <Outcome title={`Flyttbegäran: ${REQUEST_LABEL[decision.status]}`} date={decision.decidedOn} sign={decision.status === "REFUSED" ? "minus" : "plus"}>{status}</Outcome>;
    const id = decision.playerId;
    return <section className="ib-decision" aria-label="Ditt beslut"><h3>Han begär att få lämna</h3>
      <div className="ib-options">
        <button type="button" className="ib-option" onClick={() => run(() => updateCareer((s) => decideTransferRequest(s, id, "ACCEPT")), "Han är transferlistad.")}><b>Godkänn – lyssna på bud</b><small>Han sätts på transferlistan och blir lugnare. Bud kommer oftare.</small></button>
        <button type="button" className="ib-option" onClick={() => run(() => updateCareer((s) => decideTransferRequest(s, id, "PROMISE")), "Han stannar på ditt löfte.")}><b>Övertala med ett löfte</b><small>Bara lojala spelare lyssnar. Löfte om en större roll i tre månader.</small></button>
        <button type="button" className="ib-option" onClick={() => run(() => updateCareer((s) => decideTransferRequest(s, id, "REFUSE")), "Begäran är avslagen.")}><b>Avslå</b><small>Moralen sjunker kraftigt. Han kan begära igen om två månader.</small></button>
      </div>{status}</section>;
  }
  if (decision.kind === "boardPlan") {
    if (decision.plan) return <Outcome title="Handlingsplanen är registrerad" text={decision.plan.status === "ACTIVE" ? "Styrelsen granskar den efter minst 28 dagar." : decision.plan.status === "MET" ? "Planen uppfylldes: +6 till målförtroendet." : "Planen uppfylldes inte: −6 till målförtroendet."} date={decision.plan.reviewedOn ?? decision.plan.agreedOn} sign={decision.plan.status === "FAILED" ? "minus" : "plus"}>{status}</Outcome>;
    if (!decision.open) return <p className="ib-hint">{career.managerCareer?.seekingJob ? "Du leder inte klubben längre; styrelsen väntar inte på en plan från dig." : "En annan handlingsplan är redan aktiv. Styrelsen granskar den först."} <Link href="/career/board">Till styrelserummet →</Link></p>;
    return <section className="ib-decision" aria-label="Ditt beslut"><h3>Styrelsen begär en handlingsplan</h3>
      <div className="ib-options"><button type="button" className="ib-option" data-primary onClick={() => run(() => updateCareer((s) => submitBoardRecoveryPlan(s, decision.meetingId)), "Handlingsplanen är registrerad.")}><b>Lämna handlingsplan</b><small>Vid nästa granskning efter minst 28 dagar: stig två tabellplatser, förbättra formen med 0,5 poäng per match eller minska ekonomiska problem. Uppfyllt ger +6 till målförtroendet, annars −6.</small></button></div>{status}</section>;
  }
  if (decision.kind === "press") {
    const p = decision.press;
    const href = `/career/media/press/${encodeURIComponent(p.id)}`;
    if (!decision.open) {
      const who = p.status === "ANSWERED" ? (p.answeredBy && p.answeredBy !== "MANAGER" ? `${p.answeredBy.name} svarade` : "Du svarade") : p.status === "DELEGATED" ? "Assisterande tränaren svarade" : p.status === "DECLINED" ? "Du avböjde presskonferensen" : "Inga svar lämnades";
      return <Outcome title={who} date={p.date} href={href} hrefLabel="Läs utskriften →">
        {p.consequences && p.consequences.length > 0 && <ul className="ib-effects">{p.consequences.map((c, i) => <li key={i} data-sign={c.delta >= 0 ? "plus" : "minus"}><b>{AREA_LABEL[c.area]}</b>{c.text}</li>)}</ul>}{status}</Outcome>;
    }
    return <section className="ib-decision" aria-label="Ditt beslut"><h3>Presskonferens · svara senast {p.expiresOn}</h3>
      <div className="ib-options">
        <Link className="ib-option" data-primary href={href}><b>Svara på {p.questions.length} frågor</b><small>Välj ton per fråga. Svaren påverkar truppen, styrelsen, medierna och ditt rykte.</small></Link>
        {assistant ? <button type="button" className="ib-option" onClick={() => run(() => updateCareer((s) => delegatePressAction(s, p.id)), `${assistant.displayName} tar presskonferensen (halverad effekt).`)}><b>Låt {assistant.displayName} svara</b><small>Diplomatiska svar, halva effekten.</small></button> : <p className="ib-hint">Ingen assisterande tränare kan ta presskonferensen.</p>}
        <button type="button" className="ib-option" onClick={() => run(() => updateCareer((s) => skipPressAction(s, p.id)), "Du avböjde presskonferensen. Media rapporterar om din frånvaro.")}><b>Avböj</b><small>Medierna rapporterar om din frånvaro; redaktionerna tycker sämre om dig.</small></button>
      </div>{status}</section>;
  }
  // Matchday: the match itself is the action -- it cannot be resolved from the inbox.
  if (!decision.open) return <Outcome title="Matchen är spelad" />;
  return <section className="ib-decision" aria-label="Ditt beslut"><h3>Matchen väntar</h3>
    <div className="ib-options"><Link className="ib-option" data-primary href={matchDayHref(decision.fixtureId)}><b>Till matchdagen</b><small>Spela eller simulera matchen. Beskedet löses när matchen är klar.</small></Link></div></section>;
}

function Outcome({ title, text, date, sign, href, hrefLabel, children }: { title: string; text?: string; date?: string; sign?: "plus" | "minus"; href?: string; hrefLabel?: string; children?: ReactNode }) {
  return <section className="ib-outcome" aria-label="Följd" data-sign={sign}>
    <span className="ib-outcome-badge">Följd</span>
    <div><strong>{title}</strong>{text && <p>{text}</p>}{date && <small>Registrerat {date.slice(0, 10)}</small>}</div>
    {children}
    {href && <Link className="hm-btn hm-btn-sm" href={href}>{hrefLabel}</Link>}
  </section>;
}
