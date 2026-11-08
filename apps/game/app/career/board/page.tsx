"use client";
// HM-ALPHA3-M07: the Boardroom -- what the board expects this season and
// why, how much it trusts the manager (and what moves that trust), every
// meeting it has held, and the manager's own contract with the club.
import Link from "next/link";
import { useMemo, useState } from "react";
import { DecisionCard, MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { BOARDROOM_BACKDROP } from "@/components/board/boardVisuals";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { boardPressureStage, BOARD_PRESSURE_LABEL, submitBoardRecoveryPlan, boardOf, DISMISSAL_LINE, ensureBoard, evaluateObjectives, FINAL_WARNING_LINE, WARNING_LINE } from "@/lib/board/board";
import type { BoardMeeting, ObjectiveStatus } from "@/lib/board/types";
import { acceptBoardContract, declineBoardContract, managerCareerOf } from "@/lib/manager/managerCareer";
import { useMoney } from "@/lib/settings/usePreferences";

const STATUS_LABEL: Record<ObjectiveStatus, string> = { ON_TRACK: "I fas", AT_RISK: "I fara", MET: "Uppfyllt", PARTLY_MET: "Delvis", FAILED: "Missat" };
const VERDICT_LABEL: Record<BoardMeeting["verdict"], string> = { PLEASED: "Nöjd", SATISFIED: "Godkänt", CONCERNED: "Oroad", WARNING: "Varning", DISMISSED: "Avsked" };

function confidenceTone(c: number) {
  return c >= 60 ? "success" : c >= WARNING_LINE ? "gold" : "loss";
}

/** Confidence over time as a small line with the warning lines drawn in. */
function ConfidenceTrend({ history }: { history: { date: string; confidence: number }[] }) {
  if (history.length < 2) return null;
  const w = 320, h = 80;
  const x = (i: number) => (i / (history.length - 1)) * w;
  const y = (c: number) => h - (c / 100) * h;
  return (
    <svg className="bd-trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Förtroendet över tid: från ${history[0]!.confidence} till ${history.at(-1)!.confidence}`}>
      <line x1={0} x2={w} y1={y(WARNING_LINE)} y2={y(WARNING_LINE)} className="bd-trend-line" data-line="warning" />
      <line x1={0} x2={w} y1={y(DISMISSAL_LINE)} y2={y(DISMISSAL_LINE)} className="bd-trend-line" data-line="dismissal" />
      <polyline points={history.map((p, i) => `${x(i)},${y(p.confidence)}`).join(" ")} />
      <circle cx={x(history.length - 1)} cy={y(history.at(-1)!.confidence)} r={3.5} />
    </svg>
  );
}

export default function BoardroomPage() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const club = getCareerClub(career);
  // A save from before M07 has no board until its next processed day; show the one it would get.
  const view = useMemo(() => (boardOf(career) ? career : ensureBoard(career, career.gameDate)), [career]);
  const board = view.board!;
  const objectives = useMemo(() => evaluateObjectives(view, board), [view, board]);
  const contract = managerCareerOf(career).contract;
  const latest = [...board.meetings].reverse().find((m) => m.kind !== "SEASON_START");
  const recentVerdict = latest && latest.date >= addDays(career.gameDate, -21) ? latest : undefined;
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } };
  const pressureMeeting = [...board.meetings].reverse().find(m => career.careerEvents.some(e => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved) && ['WARNING','FINAL_WARNING'].includes(m.kind));
  const plan = board.recoveryPlans?.at(-1);
  const offer = board.contractOffer && board.contractOffer.expiresOn >= career.gameDate ? board.contractOffer : undefined;

  return (
    <div className="bd-page">
      {recentVerdict ? (
        <MomentHero kind={recentVerdict.kind === "DISMISSAL" ? "DISMISSAL" : "ANNOUNCEMENT"} tone={recentVerdict.verdict === "PLEASED" ? "gold" : recentVerdict.verdict === "SATISFIED" ? "ink" : "loss"} backdrop={{ kind: "photo", style: BOARDROOM_BACKDROP }} tags={[false, "Styrelsens besked", recentVerdict.date]} stamp={VERDICT_LABEL[recentVerdict.verdict]} headline={recentVerdict.title} lede={recentVerdict.summary} />
      ) : (
        <MomentHero tone="ink" backdrop={{ kind: "photo", style: BOARDROOM_BACKDROP }} tags={[false, "Styrelserummet", career.seasonId]} stamp={null} headline={`${/[sxz]$/i.test(club.shortName) ? club.shortName : club.shortName + "s"} styrelse`} lede={`Styrelsens samlade förhandsbedömning: ${board.predictedPosition}:a. Här ser du vad styrelsen kräver, hur mycket den litar på dig och varför.`} aside={<div className="bd-hero-figure"><b>{board.confidence}</b><small>förtroende av 100</small></div>} />
      )}

      <div className="bd-grid">
        <section className="bd-panel" aria-labelledby="bd-conf">
          <header><span className="xp-eyebrow">Förtroende</span><h2 id="bd-conf">Hur styrelsen ser på dig</h2></header>
          <MeterBar label="Förtroende" value={board.confidence / 100} figure={`${board.confidence} / 100`} tone={confidenceTone(board.confidence)} />
          <p className="pd-note">{board.targetConfidence > board.confidence ? `På väg upp mot ${board.targetConfidence}` : board.targetConfidence < board.confidence ? `På väg ner mot ${board.targetConfidence}` : "Stabilt"} – förtroendet rör sig högst 8 steg i månaden. {board.warnings > 0 ? <b>{board.warnings === 1 ? "Du har fått en varning." : "Du har fått sista varningen."}</b> : null}</p>
          <p className="pd-note">Läge: <b>{BOARD_PRESSURE_LABEL[boardPressureStage(board)]}</b></p>
          {pressureMeeting && !career.managerCareer?.seekingJob && <DecisionCard title="Styrelsen begär en handlingsplan" primary={{label:'Lämna handlingsplan',consequence:'Vid nästa granskning efter minst 28 dagar: stig två tabellplatser, förbättra formen med 0,5 poäng per match eller minska ekonomiska problem. Uppfyllt ger +6 till målförtroendet, annars -6.',onSelect:()=>run(()=>updateCareer(s=>submitBoardRecoveryPlan(s,pressureMeeting.id)),'Handlingsplanen är registrerad.')}}>Fortsatt underprestation kan leda till avsked.</DecisionCard>}
          {plan && <p className="pd-note">Handlingsplan från {plan.agreedOn}: {plan.status === 'ACTIVE' ? 'Inväntar nästa granskning' : plan.status === 'MET' ? 'Förbättring uppnådd' : 'Otillräcklig förbättring'}.</p>}
          <ConfidenceTrend history={board.history} />
          <ul className="bd-factors">{board.factors.length === 0 ? <li><span>Inga tydliga signaler ännu – styrelsen bedömer dig efter några matcher.</span></li> : board.factors.map((f) => <li key={f.label} data-sign={f.points >= 0 ? "plus" : "minus"}><span>{f.label}</span><b>{f.points > 0 ? `+${f.points}` : f.points}</b></li>)}</ul>
          <p className="pd-note">Under {WARNING_LINE} varnar styrelsen, under {FINAL_WARNING_LINE} kommer sista varningen. Faller förtroendet under {DISMISSAL_LINE} efter två varningar bryter styrelsen samarbetet.</p>
        </section>

        <section className="bd-panel" aria-labelledby="bd-obj">
          <header><span className="xp-eyebrow">Säsongens mål</span><h2 id="bd-obj">Vad styrelsen kräver</h2></header>
          <ol className="bd-objectives">{objectives.map((o) => (
            <li key={o.id} data-status={o.status}>
              <div><b>{o.label}</b><span className="tc-pill" data-status={o.status}>{STATUS_LABEL[o.status]}</span></div>
              <small>{o.why}</small>
              {o.progress && <small className="bd-progress">{o.progress}</small>}
            </li>
          ))}</ol>
        </section>
      </div>

      <div className="bd-grid">
        <section className="bd-panel" aria-labelledby="bd-contract">
          <header><span className="xp-eyebrow">Ditt avtal</span><h2 id="bd-contract">Kontraktet</h2></header>
          <dl className="bd-contract"><div><dt>Klubb</dt><dd>{club.name}</dd></div><div><dt>Lön</dt><dd>{money.format(contract.wageEurPerMonth)} / mån</dd></div><div><dt>Sedan</dt><dd>{contract.startDate}</dd></div><div><dt>Till</dt><dd>{contract.endDate}</dd></div></dl>
          {offer ? (
            <DecisionCard tone="gold" title="Styrelsen erbjuder ett nytt avtal" status={<span className="tc-pill">Svar senast {offer.expiresOn}</span>}
              primary={{ label: "Skriv på", consequence: `${offer.years} år till, ${money.format(offer.wageEurPerMonth)} i månaden.`, onSelect: () => run(() => updateCareer((s) => acceptBoardContract(s)), "Avtalet är påskrivet.") }}
              secondary={<button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => declineBoardContract(s)), "Du tackade nej. Avtalet löper som tidigare.")}>Tacka nej</button>}>
              Styrelsen vill behålla dig efter säsongen.
            </DecisionCard>
          ) : <p className="pd-note">Styrelsen tar upp avtalet vid säsongsgenomgången när det har mindre än ett år kvar. <Link href="/career/manager">Din karriär →</Link></p>}
          {message && <p className="pd-note" role="status">{message}</p>}
        </section>

        <section className="bd-panel" aria-labelledby="bd-meetings">
          <header><span className="xp-eyebrow">Protokollet</span><h2 id="bd-meetings">Möten</h2></header>
          <ol className="bd-meetings">{[...board.meetings].reverse().map((m) => <li key={m.id} data-verdict={m.verdict}><time>{m.date}</time><b>{m.title}</b><small>{m.summary}</small><em>{VERDICT_LABEL[m.verdict]}</em></li>)}</ol>
        </section>
      </div>
    </div>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
