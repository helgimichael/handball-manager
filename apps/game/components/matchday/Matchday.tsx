"use client";
// HM-ALPHA3-M09: the matchday around the engine. Before: the stage -- why
// this match matters, the arena, the table and form, how the clubs have
// met, what the media and the rival coach say, the pressure from the
// manager's own words, and what the opponent analysis has (or has not yet)
// found. After: what was written, what the rival said, what followed, and
// the match's flow from the engine's own events. Ordinary matches get a
// compact stage; big ones the full Moment.
import Link from "next/link";
import { useMemo } from "react";
import ClubCrest from "@/components/ClubCrest";
import FormDots from "@/components/FormDots";
import { MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { photoBackdrop } from "@/components/experience/visuals";
import { OutletChip, StoryCard } from "@/components/media/MediaParts";
import { useCareer } from "@/lib/career/CareerContext";
import type { CareerFixture } from "@/lib/career/types";
import { buildOpponentViewModel } from "@/lib/analysis/viewModels";
import { interpretationLabel } from "@/components/analysis/presentation";
import { getClub } from "@/lib/game-data";
import { matchAftermath, matchdayBriefing } from "@/lib/matchday/matchday";
import { relationLabel } from "@/lib/media/people";
import arenaWide from "./assets/arena-moment-1920.webp";
import arenaNarrow from "./assets/arena-moment-960.webp";

/** Arriving at the hall on matchday (Blender, scripts/visual/render_arena_moment.py). */
export const ARENA_BACKDROP = photoBackdrop(arenaWide, arenaNarrow);

const AREA_LABEL: Record<string, string> = { PLAYER: "Spelaren", TEAM: "Truppen", BOARD: "Styrelsen", MEDIA: "Media", RIVAL: "Rivalen", SUPPORTERS: "Supportrarna", REPUTATION: "Ditt rykte", PRESSURE: "Pressen", DISCIPLINE: "Disciplin" };

function Crest({ id, size = 34 }: { id: string; size?: number }) {
  const c = getClub(id);
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={size} /> : null;
}

export function MatchdayStage({ fixture, matchday }: { fixture: CareerFixture; matchday: boolean }) {
  const { career } = useCareer();
  const b = useMemo(() => matchdayBriefing(career, fixture), [career, fixture]);
  const opponent = useMemo(() => buildOpponentViewModel(career), [career]);
  const home = getClub(fixture.homeClubId), away = getClub(fixture.awayClubId);
  const big = b.stakes.level >= 3;
  const tone = b.stakes.level >= 5 ? "gold" : b.stakes.derby || b.stakes.rival?.relation !== undefined && b.stakes.rival.relation <= -15 ? "signal" : "ink";
  const lede = [b.stakes.labels.length ? b.stakes.labels.join(" · ") : null, b.attendance ? `Väntad publik ${b.attendance.expected.toLocaleString("sv-SE")} av ${b.attendance.capacity.toLocaleString("sv-SE")}` : null].filter(Boolean).join(". ");
  return (
    <section className="mday-stage" aria-label="Matchdagen" data-big={big || undefined}>
      <MomentHero kind="ANNOUNCEMENT" tone={tone} size={big ? undefined : "compact"} headingLevel={2} backdrop={{ kind: "photo", style: ARENA_BACKDROP }} tags={[false, matchday ? "Matchdag" : "Inför matchen", `${fixture.date}${fixture.kickoffTime ? ` · ${fixture.kickoffTime}` : ""}`, b.headline]} stamp={null}
        headline={`${home?.shortName ?? ""} – ${away?.shortName ?? ""}`} lede={lede || "En seriematch av många – men varje poäng räknas."}
        aside={<div className="mday-crests"><Crest id={fixture.homeClubId} size={big ? 64 : 44} /><span>mot</span><Crest id={fixture.awayClubId} size={big ? 64 : 44} /></div>} />
      {b.suspended && <p className="md-alert" role="status"><b>Du är avstängd.</b> Assisterande tränaren leder laget från bänken i den här matchen. Du kan fortfarande förbereda laget.</p>}
      <div className="mday-grid">
        <section className="bd-panel" aria-labelledby="mday-state">
          <header><span className="xp-eyebrow">Läget</span><h3 id="mday-state">Tabell och form</h3></header>
          <dl className="mday-table">
            <div><dt>{getClub(career.playerClubId)?.shortName}</dt><dd>{b.table.own ? `${b.table.own}:a av ${b.table.size}` : "–"}</dd><FormDots results={b.form.own} /></div>
            <div><dt>{getClub(b.opponentId)?.shortName}</dt><dd>{b.table.opp ? `${b.table.opp}:a av ${b.table.size}` : "–"}</dd><FormDots results={b.form.opp} /></div>
          </dl>
          {b.rivalry.reasons.length > 0 && <p className="pd-note">Rivalitet: {b.rivalry.reasons.join(" · ")}.</p>}
          {b.history.length > 0 ? <ul className="mday-history">{b.history.map((h, i) => <li key={i}>{h}</li>)}</ul> : <p className="pd-note">Lagen har inte mötts tidigare i din karriär.</p>}
        </section>
        <section className="bd-panel" aria-labelledby="mday-media">
          <header><span className="xp-eyebrow">Medierna</span><h3 id="mday-media">Vad som sägs</h3></header>
          {b.rivalQuote && <blockquote className="mday-quote">”{b.rivalQuote.text}”<cite>{b.rivalQuote.name} · {relationLabel(b.rivalQuote.relation).toLowerCase()} relation till dig</cite></blockquote>}
          {b.narratives.length === 0 ? <p className="pd-note">Medierna har inte skrivit om matchen.</p> : <div className="md-list">{b.narratives.slice(0, 3).map((s) => <StoryCard key={s.id} story={s} size="sm" />)}</div>}
          {b.pressure && <MeterBar label={`Pressen inför matchen: ${b.pressure.reason.toLowerCase()}`} value={b.pressure.level / 5} figure={`${b.pressure.level}/5`} tone={b.pressure.level >= 3 ? "loss" : "gold"} />}
          {b.press && b.press.status === "OPEN" && <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/media/press/${encodeURIComponent(b.press.id)}`}>Presskonferensen väntar →</Link>}
          {b.press && b.press.status !== "OPEN" && <Link className="hm-btn hm-btn-sm" href={`/career/media/press/${encodeURIComponent(b.press.id)}`}>Presskonferensen och följderna →</Link>}
        </section>
        <section className="bd-panel" aria-labelledby="mday-opp">
          <header><span className="xp-eyebrow">Motståndaren</span><h3 id="mday-opp">Det vi vet</h3></header>
          {opponent.status === "OK" && opponent.interpretations.length > 0 ? (
            <ul className="mday-notes">{opponent.interpretations.slice(0, 3).map((i, k) => <li key={k}>{interpretationLabel(i)}</li>)}</ul>
          ) : <p className="pd-note">Inga mönster i motståndarens resultat ännu.</p>}
          <p className="pd-note">{b.analysisReady ? "Motståndaranalysen är klar." : "Motståndaranalysen blir klar några dagar före matchen."} Spelarnivåer och startsju visas bara när det finns ett underlag – inget gissas fram.</p>
          <Link className="hm-btn hm-btn-sm" href="/career/analysis/opponent">Motståndaranalys →</Link>
        </section>
      </div>
    </section>
  );
}

/** The goal difference through the match, from the engine's own goal events. */
export function MatchFlow({ flow, ownName }: { flow: { minute: number; diff: number }[]; ownName: string }) {
  if (flow.length < 2) return null;
  const max = Math.max(3, ...flow.map((p) => Math.abs(p.diff)));
  const w = 600, h = 120, y = (d: number) => h / 2 - (d / max) * (h / 2 - 8), x = (m: number) => (Math.min(60, m) / 60) * w;
  const pts = flow.map((p, i) => `${x(p.minute)},${y(i === 0 ? 0 : flow[i - 1]!.diff)} ${x(p.minute)},${y(p.diff)}`).join(" ");
  const end = flow.at(-1)!;
  return (
    <figure className="mday-flow">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Målskillnaden under matchen för ${ownName}: slutade ${end.diff > 0 ? "+" : ""}${end.diff}.`}>
        <rect x="0" y="0" width={w} height={h / 2} className="mday-flow-ahead" />
        <rect x="0" y={h / 2} width={w} height={h / 2} className="mday-flow-behind" />
        <line x1="0" x2={w} y1={h / 2} y2={h / 2} className="mday-flow-zero" />
        <line x1={w / 2} x2={w / 2} y1="0" y2={h} className="mday-flow-half" />
        <polyline points={`0,${h / 2} ${pts} ${x(60)},${y(end.diff)}`} />
      </svg>
      <figcaption>Över mittlinjen: {ownName} leder. Under: {ownName} ligger under. Streckad linje: halvtid.</figcaption>
    </figure>
  );
}

export function MatchAftermathPanel({ fixtureId }: { fixtureId: string }) {
  const { career } = useCareer();
  const a = useMemo(() => matchAftermath(career, fixtureId), [career, fixtureId]);
  const f = career.fixtures.find((x) => x.id === fixtureId);
  const own = getClub(career.playerClubId)?.shortName ?? "";
  if (!f) return null;
  const seen = new Set<string>();
  const headlines = a.stories.filter((s) => s.kind !== "RIVAL_COMMENT" && (seen.has(s.eventKey) ? false : (seen.add(s.eventKey), true)));
  const versions = a.stories.filter((s) => s.kind === "MATCH_REPORT");
  const stakes = matchdayBriefing(career, f).stakes;
  const r = career.results[fixtureId];
  const score = r ? `${r.homeGoals}–${r.awayGoals}` : "";
  // The big ones get their Moment: a derby, a final, a feud settled, a return to an old club.
  const moment = stakes.level >= 3 && a.result && a.result !== "DRAW" ? { win: a.result === "WIN", label: stakes.labels[0] ?? "Stormatch" } : null;
  return (
    <section className="mday-after" aria-label="Efter matchen">
      {moment && <MomentHero kind={moment.win ? (stakes.level >= 5 ? "CHAMPIONSHIP" : "SEASON_ACHIEVEMENT") : "ANNOUNCEMENT"} tone={moment.win ? "gold" : "loss"} size="compact" headingLevel={2} backdrop={{ kind: "photo", style: ARENA_BACKDROP }} tags={[false, moment.label, f.date]} stamp={moment.win ? "Seger" : null} headline={moment.win ? `${moment.label}: ${own} vann ${score}` : `${moment.label}: förlust ${score}`} lede={moment.win ? "En kväll som kommer att minnas." : "En kväll att lägga bakom sig – men den glöms inte."} />}
      <div className="mday-grid">
        <section className="bd-panel" aria-labelledby="after-media">
          <header><span className="xp-eyebrow">Medierna</span><h3 id="after-media">Rubrikerna</h3></header>
          {headlines.length === 0 ? <p className="pd-note">Inga artiklar ännu – tidningarna skriver dagen efter.</p> : <div className="md-list">{headlines.slice(0, 4).map((s) => <StoryCard key={s.id} story={s} size="sm" />)}</div>}
          {versions.length > 1 && <p className="pd-note">Samma match i {versions.map((s, i) => <span key={s.id}>{i ? ", " : ""}<OutletChip outletId={s.outletId} /></span>)}.</p>}
        </section>
        <section className="bd-panel" aria-labelledby="after-voices">
          <header><span className="xp-eyebrow">Röster</span><h3 id="after-voices">Efter slutsignalen</h3></header>
          {a.rivalComment?.quote && <blockquote className="mday-quote">”{a.rivalComment.quote.text}”<cite>{a.rivalComment.quote.who}</cite></blockquote>}
          {a.press ? <Link className={`hm-btn hm-btn-sm${a.press.status === "OPEN" ? " hm-btn-primary" : ""}`} href={`/career/media/press/${encodeURIComponent(a.press.id)}`}>{a.press.status === "OPEN" ? "Intervjun väntar →" : "Intervjun och följderna →"}</Link> : <p className="pd-note">Ingen intervju efter den här matchen.</p>}
          {a.consequences.length > 0 && <ul className="md-effects">{a.consequences.map((c, i) => <li key={i} data-sign={c.delta >= 0 ? "plus" : "minus"}><b>{AREA_LABEL[c.area]}</b>{c.text}</li>)}</ul>}
          {a.tablePos && f.type === "LEAGUE" && <p className="pd-note">{own} ligger {a.tablePos}:a i tabellen.</p>}
        </section>
      </div>
      {a.flow.length > 1 && <section className="bd-panel"><header><span className="xp-eyebrow">Matchens flöde</span><h3>Målskillnaden minut för minut</h3></header><MatchFlow flow={a.flow} ownName={own} /></section>}
    </section>
  );
}
