"use client";
// HM-ALPHA3-M08: a press conference. Arena Nights 231 -- WLD-03 C Live
// Transcript: the questions run in order as broadcast captions; the active
// question takes a tone with one click (or keys 1-6), your quote lands in
// the transcript, and the "Vem reagerar" rail previews which groups will
// react -- computed with the same effectsOf() the conference applies, shown
// as directions, never numbers. Undo before submitting; Delegera / Avböj as
// before. When closed it becomes a recap with the "Följder" box.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MomentHero } from "@/components/experience/Moment";
import { EmptyState } from "@/components/manager/Workspace";
import { OutletChip, PRESSROOM_BACKDROP } from "@/components/media/MediaParts";
import { useCareer } from "@/lib/career/CareerContext";
import { answerPressAction, delegatePressAction, skipPressAction } from "@/lib/media/actions";
import { AREA_LABEL } from "@/lib/media/newsstand";
import { JOURNALIST_STYLE_LABEL, mediaOf } from "@/lib/media/people";
import { effectsOf, TONE_LABEL } from "@/lib/media/press";
import type { Consequence, PressConference, Tone } from "@/lib/media/types";
import type { CareerState } from "@/lib/career/types";

const RAIL: Consequence["area"][] = ["PLAYER", "TEAM", "BOARD", "MEDIA", "RIVAL", "SUPPORTERS", "REPUTATION"];

function contextOf(press: PressConference, i: number) {
  const q = press.questions[i]!;
  return press.contexts?.[i] ?? { topic: q.topic, playerId: q.playerId, rivalStaffId: q.rivalStaffId };
}
/** The reaction per group for a set of answers, from the conference's own consequence rules. */
function reactions(state: CareerState, press: PressConference, answers: Record<string, Tone>): Map<Consequence["area"], { sum: number; texts: string[] }> {
  const out = new Map<Consequence["area"], { sum: number; texts: string[] }>();
  press.questions.forEach((q, i) => {
    const tone = answers[q.id];
    if (!tone) return;
    for (const c of effectsOf(state, q, tone, contextOf(press, i))) {
      const cur = out.get(c.area) ?? { sum: 0, texts: [] };
      out.set(c.area, { sum: cur.sum + c.delta, texts: [...cur.texts, c.text] });
    }
  });
  return out;
}

export default function PressPage() {
  const params = useParams<{ pressId: string }>();
  const id = decodeURIComponent(params.pressId);
  const { career, updateCareer } = useCareer();
  const media = mediaOf(career);
  const press = media.press[id];
  const [answers, setAnswers] = useState<Record<string, Tone>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [preview, setPreview] = useState<Tone | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const open = !!press && press.status === "OPEN" && press.expiresOn >= career.gameDate;
  const active = open ? press.questions.find((q) => !answers[q.id]) : undefined;
  const activeIndex = active && press ? press.questions.indexOf(active) : -1;

  function choose(tone: Tone) {
    if (!active) return;
    setAnswers((x) => ({ ...x, [active.id]: tone }));
    setHistory((h) => [...h, active.id]);
    setPreview(null);
  }
  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setAnswers((x) => { const n = { ...x }; delete n[last]; return n; });
    setHistory((h) => h.slice(0, -1));
  }
  // Keys 1-6 answer the active question with that tone.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const n = Number(e.key);
      const a = Number.isInteger(n) && n >= 1 ? active!.answers[n - 1] : undefined;
      if (a) { e.preventDefault(); setAnswers((x) => ({ ...x, [active!.id]: a.tone })); setHistory((h) => [...h, active!.id]); setPreview(null); }
    }
    // Capture phase: the tone keys run before the shell's hub keys 1-6 (ENT-07), which skip handled events.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active]);

  const shown: Record<string, Tone> = press ? (open ? answers : press.answers ?? {}) : {};
  const rail = press ? reactions(career, press, shown) : new Map<Consequence["area"], { sum: number; texts: string[] }>();
  const previewRail = press && active && preview ? reactions(career, press, { ...shown, [active.id]: preview }) : null;
  if (!press) return <div className="md-press-page"><EmptyState>Presskonferensen finns inte längre. Den kan ha löpt ut eller hört till en tidigare säsong.</EmptyState><div className="hm-actions"><Link className="hm-btn hm-btn-primary" href="/career/media?tab=press">Till presskonferenserna →</Link><Link className="hm-btn" href="/career/inbox?view=todo">Inkorgens Att göra →</Link></div></div>;
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } };
  const assistant = (career.staffRoster[career.playerClubId] ?? []).find((m) => m.roles[0] === "ASSISTANT_COACH");
  const article = Object.values(media.stories).filter((s) => s.eventKey === `interview:${press.id}`).sort((a, b) => b.importance - a.importance)[0];
  const thread = [...career.inbox].reverse().find((m) => m.destinations?.some((d) => d.route === "PRESS" && d.pressId === press.id));
  const answeredCount = press.questions.filter((q) => shown[q.id]).length;
  const max = Math.max(1, ...[...(previewRail ?? rail).values()].map((v) => Math.abs(v.sum)));

  return (
    <div className="md-press-page md-live">
      <MomentHero tone={open ? "signal" : "ink"} size="compact" backdrop={{ kind: "photo", style: PRESSROOM_BACKDROP }} tags={[false, press.kind === "PRE_MATCH" ? "Före matchen" : press.kind === "POST_MATCH" ? "Efter matchen" : "Intervju", press.date]} stamp={open ? null : press.status === "EXPIRED" ? "Inga svar" : press.status === "DECLINED" ? "Avböjd" : "Avslutad"} headline={press.title} lede={press.context} />
      <div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/media?tab=press">← Presskonferenser</Link>{thread && <Link className="hm-btn hm-btn-sm" href={`/career/inbox?message=${encodeURIComponent(thread.id)}`}>Tråden i inkorgen</Link>}{article && <Link className="hm-btn hm-btn-sm" href={`/career/media/story/${encodeURIComponent(article.id)}`}>Artikeln →</Link>}</div>

      {!open && (
        <section className="md-recap" aria-label="Följder">
          <header><span className="xp-eyebrow">{press.answeredBy && press.answeredBy !== "MANAGER" ? `${press.answeredBy.name} svarade` : press.status === "ANSWERED" ? "Du svarade" : press.status === "DECLINED" ? "Du avböjde" : press.status === "DELEGATED" ? "Assisterande tränaren svarade" : "Inga svar lämnades"}</span><h2>Följder</h2></header>
          {press.consequences && press.consequences.length > 0 ? <ul className="md-effects">{press.consequences.map((c, i) => <li key={i} data-sign={c.delta >= 0 ? "plus" : "minus"}><b>{AREA_LABEL[c.area]}</b>{c.text}</li>)}</ul> : <p className="pd-note">{press.status === "OPEN" ? "Presskonferensen löpte ut innan du svarade." : "Inga märkbara följder."}</p>}
        </section>
      )}

      <div className="md-live-grid">
        <section className="md-transcript" aria-label="Utskrift">
          <header className="md-transcript-head"><span>Utskrift</span><span>{answeredCount} / {press.questions.length} besvarade</span></header>
          <ol>{press.questions.map((q, i) => {
            const j = media.journalists[q.journalistId];
            const tone = shown[q.id];
            const quote = tone ? q.answers.find((a) => a.tone === tone) : undefined;
            const isActive = open && q.id === active?.id;
            const upcoming = open && !tone && !isActive;
            const fx = tone ? effectsOf(career, q, tone, contextOf(press, i)) : [];
            return (
              <li key={q.id} data-state={isActive ? "active" : tone ? "answered" : upcoming ? "upcoming" : "unanswered"}>
                <p className="md-caption"><span className="md-caption-tag">{j && <OutletChip outletId={j.outletId} />}<b>{j?.name ?? "Journalist"}</b>{j?.style && <small className="md-style">{JOURNALIST_STYLE_LABEL[j.style] ?? j.style}</small>}</span>{upcoming ? <span className="md-caption-wait">Fråga {i + 1} väntar</span> : <span className="md-caption-q">{q.text}</span>}</p>
                {quote && <p className="md-caption md-caption-you"><span className="md-caption-tag"><b>{press.answeredBy && press.answeredBy !== "MANAGER" ? press.answeredBy.name : "Du"}</b><small className="md-style">{TONE_LABEL[quote.tone]}</small></span><span className="md-caption-q">”{quote.text}”</span></p>}
                {fx.length > 0 && <ul className="md-chips" aria-label="Vem reagerar">{fx.map((c, k) => <li key={k} data-sign={c.delta >= 0 ? "plus" : "minus"} title={c.text}>{AREA_LABEL[c.area]} {c.delta >= 0 ? "↑" : "↓"}</li>)}</ul>}
                {isActive && (
                  <fieldset className="md-tones" aria-label="Välj ton">
                    <legend className="sr-only">Ditt svar på fråga {activeIndex + 1}</legend>
                    {q.answers.map((a, k) => (
                      <button key={a.tone} type="button" onClick={() => choose(a.tone)} onMouseEnter={() => setPreview(a.tone)} onMouseLeave={() => setPreview(null)} onFocus={() => setPreview(a.tone)} onBlur={() => setPreview(null)}>
                        <span className="md-key" aria-hidden="true">{k + 1}</span><b>{TONE_LABEL[a.tone]}</b><span>”{a.text}”</span><small>{a.hint}</small>
                      </button>
                    ))}
                  </fieldset>
                )}
              </li>
            );
          })}</ol>
        </section>

        <aside className="md-react" aria-label="Vem reagerar">
          <header><span className="xp-eyebrow">{previewRail ? "Om du svarar så" : open ? "Förväntad reaktion" : "Reaktionen"}</span><h2>Vem reagerar</h2></header>
          <ul>{RAIL.map((area) => { const v = (previewRail ?? rail).get(area); const sum = v?.sum ?? 0; return (
            <li key={area} data-sign={sum > 0 ? "plus" : sum < 0 ? "minus" : "none"}>
              <span>{AREA_LABEL[area]}</span>
              <span className="md-react-bar" aria-hidden="true"><i style={{ width: `${Math.round((Math.abs(sum) / max) * 50)}%`, [sum >= 0 ? "left" : "right"]: "50%" }} /></span>
              <b>{sum > 0 ? "↑" : sum < 0 ? "↓" : "–"}</b>
              {v?.texts[0] && <small>{v.texts[v.texts.length - 1]}</small>}
            </li>
          ); })}</ul>
          <p className="pd-note">Riktningen kommer från samma regler som presskonferensen använder. Redaktionerna i rummet minns dessutom tonen.</p>
          {open && (
            <div className="md-react-actions">
              <button type="button" className="hm-btn hm-btn-primary" disabled={answeredCount < press.questions.length} onClick={() => run(() => updateCareer((s) => answerPressAction(s, press.id, answers)), "Svaren är lämnade. Medierna skriver om det.")}>Lämna svaren</button>
              {answeredCount < press.questions.length && <small className="hm-text-muted">Svara på alla {press.questions.length} frågor först.</small>}
              <button type="button" className="hm-btn" disabled={!history.length} onClick={undo}>Ångra senaste svaret</button>
              {assistant ? <button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => delegatePressAction(s, press.id)), `${assistant.displayName} tar presskonferensen (halverad effekt).`)}>Låt {assistant.displayName} svara (Delegera)</button> : <small className="hm-text-muted">Ingen assisterande tränare att delegera till.</small>}
              <button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => skipPressAction(s, press.id)), "Du avböjde presskonferensen. Media rapporterar om din frånvaro.")}>Avböj / Hoppa över</button>
            </div>
          )}
        </aside>
      </div>
      {message && <p className="pd-note" role="status">{message}</p>}
    </div>
  );
}
