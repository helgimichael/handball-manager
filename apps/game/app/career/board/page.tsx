"use client";
// Arena Nights CLB-05 C "Board Minutes": the page is the protocol of your relationship with this board. A header
// strip with the dual meter (Förtroende now / Rykte), the pressure stage, the explained factors and the objective
// meters; an open decision pinned under it (it opens the meeting moment, CLB-05b B); then the dated minutes,
// newest first -- what was said, what was demanded, what you did and how it ended -- with the contract in the rail.
// On the day of a verdict the stamp plays once (CLB-05a B), then stays as the band for 21 days.
// HM-ALPHA3-M07 rules unchanged: every action is the existing submitBoardRecoveryPlan / acceptBoardContract /
// declineBoardContract; nothing about confidence, objectives or thresholds is computed here.
import Link from "next/link";
import { useState } from "react";
import { BOARDROOM_BACKDROP } from "@/components/board/boardVisuals";
import { BoardMeetingModal, useSessionFlag, VerdictMoment } from "@/components/board/BoardMeeting";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { submitBoardRecoveryPlan } from "@/lib/board/board";
import { acceptBoardContract, declineBoardContract, managerCareerOf } from "@/lib/manager/managerCareer";
import { boardMinutes, decisionOptions, type OpenDecision } from "@/lib/club/boardMinutes";
import { useMoney } from "@/lib/settings/usePreferences";

const decisionKey = (d: OpenDecision) => `hm-board-meeting:${d.kind === "RECOVERY" ? d.meetingId : `offer:${d.expiresOn}:${d.wageEurPerMonth}`}`;

/** Confidence over time with the warning, final-warning and dismissal lines drawn in. */
function ConfidenceTrend({ history, lines }: { history: { date: string; confidence: number }[]; lines: { warning: number; finalWarning: number; dismissal: number } }) {
  if (history.length < 2) return null;
  const w = 320, h = 64;
  const x = (i: number) => (i / (history.length - 1)) * w;
  const y = (c: number) => h - (c / 100) * h;
  return (
    <svg className="bm-trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Förtroendet över tid: från ${history[0]!.confidence} till ${history.at(-1)!.confidence}`}>
      {(["warning", "finalWarning", "dismissal"] as const).map((k) => <line key={k} x1={0} x2={w} y1={y(lines[k])} y2={y(lines[k])} data-line={k} />)}
      <polyline points={history.map((p, i) => `${x(i)},${y(p.confidence)}`).join(" ")} />
    </svg>
  );
}

export default function BoardroomPage() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const club = getCareerClub(career);
  const m = boardMinutes(career);
  const contract = managerCareerOf(career).contract;
  const [asked, setAsked] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Arriving with an unanswered meeting (Continue sends you here) opens it once per session; a verdict from today plays once.
  const [decisionSeen, markDecision] = useSessionFlag(m.decision ? decisionKey(m.decision) : null);
  const [verdictSeen, markVerdict] = useSessionFlag(m.verdictToday ? `hm-board-verdict:${m.verdictToday.id}` : null);
  const meeting = !!m.decision && (asked || !decisionSeen);
  const verdict = !meeting && !verdictSeen ? m.verdictToday : null;
  const setMeeting = (open: boolean) => setAsked(open);

  const closeMeeting = (text?: string) => {
    markDecision();
    setAsked(false);
    if (text) setResult(text);
  };
  const choose = (id: string): string | null => {
    if (!m.decision) return null;
    if (id === "PLAN" && m.decision.kind === "RECOVERY") { const meetingId = m.decision.meetingId; updateCareer((s) => submitBoardRecoveryPlan(s, meetingId)); setExpanded(meetingId); return "Handlingsplanen är registrerad i protokollet."; }
    if (id === "SIGN") { updateCareer((s) => acceptBoardContract(s)); return "Avtalet är påskrivet och protokollfört."; }
    if (id === "DECLINE") { updateCareer((s) => declineBoardContract(s)); return "Du tackade nej. Ditt avtal löper som tidigare."; }
    return null;
  };
  const toMinutes = (id?: string) => { if (id) setExpanded(id); document.getElementById("bm-minutes")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const band = m.verdictBand;
  const d = m.decision;
  const name = /[sxz]$/i.test(club.shortName) ? club.shortName : `${club.shortName}s`;

  return (
    <div className="bm-page">
      <header className="bm-band xp-photo-hero" style={BOARDROOM_BACKDROP} data-tone={band?.tone ?? "neutral"}>
        <div>
          <small>Styrelserummet · {career.seasonId}</small>
          <h1>{name} styrelse</h1>
          {band ? <p><b>{band.date}:</b> {band.title}</p> : <p>Styrelsens förhandsbedömning: {m.board.predictedPosition}:a.</p>}
        </div>
        {band && <span className="bm-stamp" data-tone={band.tone}>{band.verdictLabel}</span>}
      </header>

      <section className="bm-strip" aria-label="Läget med styrelsen">
        <div className="bm-dual">
          <div className="bm-meter-row">
            <span>Förtroende</span>
            <div className="bm-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.confidence} aria-label={`Förtroende ${m.confidence} av 100`}>
              <i style={{ width: `${m.confidence}%` }} data-tone={m.confidence >= 60 ? "good" : m.confidence >= m.lines.warning ? "warn" : "bad"} />
              {(["warning", "finalWarning", "dismissal"] as const).map((k) => <b key={k} style={{ left: `${m.lines[k]}%` }} data-line={k} title={k === "warning" ? `Varning under ${m.lines.warning}` : k === "finalWarning" ? `Sista varning under ${m.lines.finalWarning}` : `Avsked under ${m.lines.dismissal} efter två varningar`} />)}
            </div>
            <strong>{m.confidence}<small>{m.trend === "up" ? ` ↗ ${m.targetConfidence}` : m.trend === "down" ? ` ↘ ${m.targetConfidence}` : ""}</small></strong>
          </div>
          <div className="bm-meter-row">
            <span>Rykte</span>
            <div className="bm-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.reputation ?? 0} aria-label="Ditt rykte som tränare"><i style={{ width: `${m.reputation ?? 0}%` }} data-tone="info" /></div>
            <strong>{m.reputation ?? "–"}</strong>
          </div>
          <p className="bm-lines">Linjerna: varning under {m.lines.warning}, sista varning under {m.lines.finalWarning}, avsked under {m.lines.dismissal} efter två varningar. Förtroendet rör sig högst 8 steg i månaden.</p>
          <ConfidenceTrend history={m.history} lines={m.lines} />
        </div>
        <div className="bm-stage" data-tone={m.stageTone}>
          <small>Läge</small><strong>{m.stageLabel}</strong>
          <span>{m.warnings === 0 ? "Inga varningar" : m.warnings === 1 ? "En varning" : "Sista varningen given"}</span>
          <ul className="bm-factor-chips" aria-label="Det som rör förtroendet">
            {m.factors.length === 0 ? <li>Inga tydliga signaler ännu</li> : m.factors.map((f) => <li key={f.label} data-sign={f.points >= 0 ? "plus" : "minus"}><b>{f.points > 0 ? `+${f.points}` : f.points}</b> {f.label}</li>)}
          </ul>
        </div>
        <ol className="bm-objectives" aria-label="Säsongens mål">
          {m.objectives.map((o) => (
            <li key={o.id} data-tone={o.tone}>
              <div><b>{o.label}</b><span className="bm-pill" data-tone={o.tone}>{o.statusLabel}</span></div>
              {o.meter && <div className="bm-obj-meter" aria-hidden="true"><i style={{ width: `${o.meter.value * 100}%` }} /><b style={{ left: `${o.meter.target * 100}%` }} data-mark="target" />{o.meter.minimum !== null && <b style={{ left: `${o.meter.minimum * 100}%` }} data-mark="minimum" />}</div>}
              <small>{o.progress}</small>
            </li>
          ))}
        </ol>
      </section>

      {d && (
        <section className="bm-pinned" aria-label="Öppet beslut" data-kind={d.kind}>
          <div>
            <small>{d.kind === "RECOVERY" ? "Svar krävs · blockerar Fortsätt" : `Svar senast ${d.expiresOn}`}</small>
            <strong>{d.kind === "RECOVERY" ? "Styrelsen begär en handlingsplan" : "Styrelsen erbjuder ett nytt avtal"}</strong>
            <span>{d.kind === "RECOVERY" ? d.summary : `${d.years} år till, ${money.format(d.wageEurPerMonth)} i månaden.`}</span>
          </div>
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => setMeeting(true)}>Öppna mötet</button>
        </section>
      )}
      {result && <p className="bm-result" role="status">{result} <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => toMinutes()}>Till protokollet</button></p>}

      <div className="bm-split">
        <section id="bm-minutes" className="bm-minutes" aria-labelledby="bm-minutes-h">
          <h2 id="bm-minutes-h">Protokollet</h2>
          {m.entries.length <= 1 && <p className="bm-muted">Protokollet är tunt än. Varje möte, varning, plan och avtal skrivs in här.</p>}
          <ol>
            {m.entries.map((e) => {
              const open = expanded === e.id;
              return (
                <li key={e.id} data-tone={e.tone} data-open={e.open || undefined}>
                  <span className="bm-entry-stamp" data-tone={e.tone}>{e.verdictLabel}</span>
                  <div className="bm-entry">
                    <small><time>{e.date}</time> · {e.kindLabel}</small>
                    <strong>{e.title}</strong>
                    <p>{e.summary}</p>
                    <dl>
                      <div><dt>Krav</dt><dd>{e.demanded}</dd></div>
                      {e.response && <div><dt>Ditt svar</dt><dd>{e.response}</dd></div>}
                      {e.outcome && <div><dt>Utfall</dt><dd data-tone={e.outcome.tone}>{e.outcome.label}</dd></div>}
                    </dl>
                    {(e.confidenceAt !== null || e.plan) && <button type="button" className="bm-expand" aria-expanded={open} onClick={() => setExpanded(open ? null : e.id)}>{open ? "Dölj läget då" : "Läget då"}</button>}
                    {open && (
                      <div className="bm-then">
                        {e.confidenceAt !== null && <p>Förtroende vid mötet: <b>{e.confidenceAt}</b>{e.confidenceDelta !== null && e.confidenceDelta !== 0 ? ` (${e.confidenceDelta > 0 ? "+" : "−"}${Math.abs(e.confidenceDelta)} sedan förra mötet)` : ""}.</p>}
                        {e.plan && <p>Utgångsläge för planen: {e.plan.baseline.position ? `${e.plan.baseline.position}:a i tabellen` : "ingen tabellplats"}{e.plan.baseline.form !== null ? `, ${e.plan.baseline.form.toFixed(1).replace(".", ",")} poäng per match` : ""}{e.plan.baseline.overBudget ? ", lönerna över budget" : ""}. {e.plan.status === "ACTIVE" ? "Granskas vid nästa månadsmöte." : `Granskad ${e.plan.reviewedOn ?? ""}.`}</p>}
                        {e.open && <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => setMeeting(true)}>Svara styrelsen</button>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className="bm-rail" aria-labelledby="bm-contract-h">
          <section className="bm-contract">
            <h2 id="bm-contract-h">Kontraktet</h2>
            <dl><div><dt>Klubb</dt><dd>{club.name}</dd></div><div><dt>Lön</dt><dd>{money.format(contract.wageEurPerMonth)} / mån</dd></div><div><dt>Sedan</dt><dd>{contract.startDate}</dd></div><div><dt>Till</dt><dd>{contract.endDate}</dd></div></dl>
            {d?.kind === "CONTRACT" ? <button type="button" className="hm-btn hm-btn-primary" onClick={() => setMeeting(true)}>Svara på avtalet</button> : <p className="bm-muted">Styrelsen tar upp avtalet vid säsongsgenomgången när det har mindre än ett år kvar.</p>}
            <Link href="/career/manager">Din karriär →</Link>
          </section>
        </aside>
      </div>

      {meeting && d && (
        <BoardMeetingModal decision={d} options={decisionOptions(d, (v) => money.format(v))} onChoose={choose} onClose={closeMeeting}
          statement={d.kind === "RECOVERY" ? <><p><b>{d.title}.</b> {d.summary}</p><p>Styrelsen vill se hur du tänker vända det. Fortsatt underprestation kan leda till {d.finalWarning ? "avsked" : "sista varningen"}.</p></> : <p>Styrelsen vill behålla dig och erbjuder {d.years} år till. Erbjudandet gäller till {d.expiresOn}.</p>} />
      )}
      {verdict && <VerdictMoment entry={verdict} factors={m.factors} onClose={(go) => { markVerdict(); if (go) toMinutes(verdict.id); }} />}
    </div>
  );
}
