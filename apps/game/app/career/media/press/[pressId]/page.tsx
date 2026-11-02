"use client";
// HM-ALPHA3-M08: a press conference. Each question shows who asks it and
// for which outlet; each answer its register and what it is likely to lead
// to -- never numbers. After answering, the consequences are listed with
// their reasons. The assistant can take it instead (calm, half the effect).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MomentHero } from "@/components/experience/Moment";
import { EmptyState } from "@/components/manager/Workspace";
import { OutletChip, PRESSROOM_BACKDROP } from "@/components/media/MediaParts";
import { useCareer } from "@/lib/career/CareerContext";
import { answerPressAction, delegatePressAction } from "@/lib/media/actions";
import { mediaOf } from "@/lib/media/people";
import { TONE_LABEL } from "@/lib/media/press";
import type { Tone } from "@/lib/media/types";

const AREA_LABEL = { PLAYER: "Spelaren", TEAM: "Truppen", BOARD: "Styrelsen", MEDIA: "Media", RIVAL: "Rivalen", SUPPORTERS: "Supportrarna", REPUTATION: "Ditt rykte", PRESSURE: "Pressen inför matchen", DISCIPLINE: "Disciplin" } as const;

export default function PressPage() {
  const params = useParams<{ pressId: string }>();
  const id = decodeURIComponent(params.pressId);
  const { career, updateCareer } = useCareer();
  const media = mediaOf(career);
  const press = media.press[id];
  const [answers, setAnswers] = useState<Record<string, Tone>>({});
  const [message, setMessage] = useState<string | null>(null);
  if (!press) return <EmptyState>Presskonferensen finns inte. <Link href="/career/media?tab=press">Till presskonferenserna →</Link></EmptyState>;
  const open = press.status === "OPEN" && press.expiresOn >= career.gameDate;
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } };
  const assistant = (career.staffRoster[career.playerClubId] ?? []).find((m) => m.roles[0] === "ASSISTANT_COACH");

  return (
    <div className="mc-press-page">
      <MomentHero tone={open ? "signal" : "ink"} size="compact" backdrop={{ kind: "photo", style: PRESSROOM_BACKDROP }} tags={[false, press.kind === "PRE_MATCH" ? "Före matchen" : press.kind === "POST_MATCH" ? "Efter matchen" : "Intervju", press.date]} stamp={open ? null : press.status === "EXPIRED" ? "Inga svar" : "Avslutad"} headline={press.title} lede={press.context} />
      <Link className="hm-btn hm-btn-sm" href="/career/media?tab=press">← Presskonferenser</Link>
      {!open && press.consequences ? (
        <section className="bd-panel" aria-label="Följder">
          <header><span className="xp-eyebrow">{press.answeredBy && press.answeredBy !== "MANAGER" ? `${press.answeredBy.name} svarade` : "Du svarade"}</span><h2>Vad det ledde till</h2></header>
          {press.consequences.length === 0 ? <p className="pd-note">Inga märkbara följder.</p> : <ul className="mc-effects">{press.consequences.map((c, i) => <li key={i} data-sign={c.delta >= 0 ? "plus" : "minus"}><b>{AREA_LABEL[c.area]}</b>{c.text}</li>)}</ul>}
        </section>
      ) : null}
      <ol className="mc-questions">{press.questions.map((q) => {
        const j = media.journalists[q.journalistId];
        const chosen = open ? answers[q.id] : press.answers?.[q.id];
        return (
          <li key={q.id}>
            <header>{j && <OutletChip outletId={j.outletId} />}<span>{j?.name}</span></header>
            <p className="mc-q">{q.text}</p>
            <fieldset className="mc-answers" disabled={!open}>
              <legend className="sr-only">Ditt svar</legend>
              {q.answers.map((a) => (
                <label key={a.tone} data-chosen={chosen === a.tone || undefined}>
                  <input type="radio" name={q.id} value={a.tone} checked={chosen === a.tone} onChange={() => setAnswers((x) => ({ ...x, [q.id]: a.tone }))} aria-label={`${TONE_LABEL[a.tone]}: ${a.text}`} />
                  <span><b>{TONE_LABEL[a.tone]}</b>”{a.text}”<small>{a.hint}</small></span>
                </label>
              ))}
            </fieldset>
          </li>
        );
      })}</ol>
      {open ? (
        <div className="hm-actions">
          <button type="button" className="hm-btn hm-btn-primary" disabled={press.questions.some((q) => !answers[q.id])} onClick={() => run(() => updateCareer((s) => answerPressAction(s, press.id, answers)), "Svaren är lämnade. Medierna skriver om det.")}>Lämna svaren</button>
          {assistant && <button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => delegatePressAction(s, press.id)), `${assistant.displayName} tar presskonferensen.`)}>Låt {assistant.displayName} svara</button>}
        </div>
      ) : null}
      {message && <p className="pd-note" role="status">{message}</p>}
    </div>
  );
}
