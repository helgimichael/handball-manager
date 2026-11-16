"use client";
// Arena Nights MGR-01b C: Jobbmarknaden as an application pipeline --
// Lediga -> Ansökt -> Intervju -> Erbjudande -> Avgjort, with a Peek for the
// selected club (fit, interview, consequence of accepting). Every action is
// the existing job-market action from lib/manager; the page wires them in.
import { useState } from "react";
import { DecisionCard } from "@/components/experience/Moment";
import type { JobApplication } from "@/lib/board/types";
import type { JobPipeline as Pipeline, PipelineCard, PipelineStage } from "@/lib/manager/jobPipeline";
import { Crest, clubName } from "./CareerBiography";

export interface JobPipelineActions {
  apply: (clubId: string) => void;
  answer: (appId: string, answers: Record<string, string>) => void;
  withdraw: (appId: string) => void;
  accept: (offerId: string) => void;
  decline: (offerId: string) => void;
  /** Why this club cannot be joined now (existing clubChangeBlocker), or null. */
  blocker: (clubId: string) => string | null;
  league: (clubId: string) => string;
  formatWage: (eurPerMonth: number) => string;
  /** The club the manager would leave, or null when unemployed. */
  leaving: string | null;
}

const ACTION_LABEL = { APPLY: "Sök jobbet", ANSWER: "Svara på intervjun", ACCEPT: "Tacka ja…" } as const;

export function JobPipeline({ pipeline, actions, seeking }: { pipeline: Pipeline; actions: JobPipelineActions; seeking: boolean }) {
  const firstBusy = pipeline.stages.find((s) => s.cards.some((c) => c.action && c.action !== "APPLY"))?.id ?? pipeline.stages.find((s) => s.cards.length)?.id ?? "OPEN";
  const [stage, setStage] = useState<PipelineStage>(firstBusy);
  const [peekId, setPeekId] = useState<string | null>(null);
  const all = pipeline.stages.flatMap((s) => s.cards);
  const peek = all.find((c) => c.id === peekId) ?? null;

  const primary = (c: PipelineCard) => {
    if (c.action === "APPLY") actions.apply(c.clubId);
    else setPeekId(c.id);
  };

  return (
    <section className="kr-pipe" aria-labelledby="kr-pipe-title">
      <header className="kr-sec-head">
        <span className="kr-kicker">Nästa kapitel</span>
        <h2 id="kr-pipe-title">Jobbmarknaden</h2>
        <p className="kr-muted">{pipeline.needsAction > 0 ? `${pipeline.needsAction} ${pipeline.needsAction === 1 ? "klubb väntar" : "klubbar väntar"} på ditt svar.` : seeking ? "Du står utan klubb. Klubbar med lediga tjänster tittar på dig varje vecka – sök själv eller fortsätt kalendern." : "Klubbar hör av sig när de söker tränare och ditt rykte och din erfarenhet räcker."}</p>
      </header>

      <div className="kr-pipe-tabs" role="tablist" aria-label="Steg i jobbsökandet">
        {pipeline.stages.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={stage === s.id} onClick={() => setStage(s.id)}>
            {s.label}<span className="kr-num">{s.cards.length}</span>
          </button>
        ))}
      </div>

      <div className="kr-pipe-board">
        {pipeline.stages.map((s) => (
          <div key={s.id} className="kr-pipe-col" data-stage={s.id} data-active={stage === s.id} aria-label={s.label} role="group">
            <header><b>{s.label}</b><span className="kr-num">{s.cards.length}</span><small>{s.hint}</small></header>
            {s.cards.length === 0 ? <p className="kr-pipe-empty">{EMPTY[s.id](seeking)}</p> : (
              <ul>{s.cards.map((c) => (
                <li key={c.id}>
                  <article className="kr-job" data-glow={!!c.action && c.action !== "APPLY"} data-selected={c.id === peekId} data-fit={c.fit?.level}>
                    <button type="button" className="kr-job-open" onClick={() => setPeekId(c.id === peekId ? null : c.id)} aria-expanded={c.id === peekId}>
                      <Crest clubId={c.clubId} size={28} />
                      <span><b>{clubName(c.clubId)}</b><small>{actions.league(c.clubId)}</small></span>
                    </button>
                    <p className="kr-job-status">{c.status}</p>
                    {c.fit && <p className="kr-fit" data-fit={c.fit.level}><i style={{ width: `${Math.max(6, Math.min(100, (c.fit.standing / Math.max(1, c.fit.need)) * 100))}%` }} aria-hidden="true" />{c.fit.label}</p>}
                    {c.deadlineLabel && <p className="kr-job-deadline">{c.deadlineLabel}</p>}
                    {c.action && <button type="button" className={`hm-btn hm-btn-sm${c.action !== "APPLY" ? " hm-btn-primary" : ""}`} onClick={() => primary(c)}>{ACTION_LABEL[c.action]}</button>}
                  </article>
                </li>
              ))}</ul>
            )}
          </div>
        ))}
      </div>

      {peek && <JobPeek card={peek} actions={actions} onClose={() => setPeekId(null)} />}
    </section>
  );
}

const EMPTY: Record<PipelineStage, (seeking: boolean) => string> = {
  OPEN: (s) => (s ? "Inga lediga tjänster just nu. Klubbar byter ofta tränare under vintern och efter säsongen – fortsätt kalendern." : "Inga lediga tjänster. Klubbar som går sämre än väntat byter ofta tränare under vintern."),
  APPLIED: () => "Inga ansökningar väntar på svar.",
  INTERVIEW: () => "Inga intervjuer. Sök ett jobb under Lediga så kallar klubben till intervju.",
  OFFER: () => "Inga erbjudanden just nu.",
  DECIDED: () => "Inget avgjort ännu.",
};

function JobPeek({ card, actions, onClose }: { card: PipelineCard; actions: JobPipelineActions; onClose: () => void }) {
  const blocker = actions.blocker(card.clubId);
  return (
    <aside className="kr-peek" aria-label={`Detaljer: ${clubName(card.clubId)}`}>
      <header>
        <Crest clubId={card.clubId} size={40} />
        <div><span className="kr-kicker">{actions.league(card.clubId)} · {card.status}</span><h3>{clubName(card.clubId)}</h3></div>
        <button type="button" className="hm-btn hm-btn-sm" onClick={onClose}>Stäng</button>
      </header>
      {card.fit && (
        <div className="kr-peek-fit">
          <b data-fit={card.fit.level}>{card.fit.label}</b>
          <ul>{card.fit.factors.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      {card.vacancy && <p className="kr-muted">{card.vacancy.reason}. Ansök senast {card.vacancy.closesOn}.</p>}
      {card.note && <p className="kr-muted">{card.note}</p>}
      {card.stage === "OPEN" && <div className="hm-actions"><button type="button" className="hm-btn hm-btn-primary" onClick={() => actions.apply(card.clubId)}>Sök jobbet</button></div>}
      {card.application?.status === "INTERVIEW" && <Interview app={card.application} onAnswer={(a) => actions.answer(card.application!.id, a)} onWithdraw={() => actions.withdraw(card.application!.id)} />}
      {card.stage === "APPLIED" && card.application && <p className="kr-muted">Intervjun är gjord. {card.application.decisionOn ? `Klubben svarar ${card.application.decisionOn}.` : "Klubben svarar snart."}</p>}
      {card.offer && card.stage === "OFFER" && (
        <DecisionCard tone={card.offer.source === "APPROACH" ? "gold" : "success"} title={`${card.offer.years} år · ${actions.formatWage(card.offer.wageEurPerMonth)} i månaden`} status={<span className="tc-pill">Svar senast {card.offer.expiresOn}</span>}
          primary={{ label: "Tacka ja", consequence: blocker ?? (actions.leaving ? `Du lämnar ${actions.leaving} och tar över ${clubName(card.clubId)} direkt.` : `Du tar över ${clubName(card.clubId)} direkt.`), disabled: !!blocker, onSelect: () => actions.accept(card.offer!.id) }}
          secondary={<button type="button" className="hm-btn" onClick={() => actions.decline(card.offer!.id)}>Tacka nej</button>} />
      )}
    </aside>
  );
}

function Interview({ app, onAnswer, onWithdraw }: { app: JobApplication; onAnswer: (answers: Record<string, string>) => void; onWithdraw: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const missing = app.questions.filter((q) => !answers[q.id]).length;
  return (
    <div className="kr-interview">
      <span className="kr-kicker">Intervju · styrelsen lyssnar</span>
      {app.questions.map((q) => (
        <fieldset key={q.id} className="bd-question">
          <legend>{q.question}</legend>
          {q.answers.map((ans) => <label key={ans.id}><input type="radio" name={`${app.id}:${q.id}`} value={ans.id} aria-label={ans.label} checked={answers[q.id] === ans.id} onChange={() => setAnswers((x) => ({ ...x, [q.id]: ans.id }))} />{ans.label}</label>)}
        </fieldset>
      ))}
      <div className="hm-actions">
        <button type="button" className="hm-btn hm-btn-primary" disabled={missing > 0} onClick={() => onAnswer(answers)}>Lämna svaren</button>
        <button type="button" className="hm-btn" onClick={onWithdraw}>Dra tillbaka</button>
        {missing > 0 && <small className="kr-muted">Svara på {missing === 1 ? "en fråga till" : `${missing} frågor till`} för att lämna svaren.</small>}
      </div>
    </div>
  );
}
