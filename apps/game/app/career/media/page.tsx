"use client";
// HM-ALPHA3-M08: the Media Centre -- "Handbollsvärlden". The news feed
// (local, regional, national, handball media), press conferences and
// their consequences, rivalries with other coaches, disciplinary cases,
// and the media landscape around the manager's club.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import ClubCrest from "@/components/ClubCrest";
import { MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { EmptyState } from "@/components/manager/Workspace";
import { FictionNote, OutletChip, PRESSROOM_BACKDROP, StoryCard } from "@/components/media/MediaParts";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { appealAction, setRoutinePressDelegation } from "@/lib/media/actions";
import { activeSuspension, matchControl, OUTCOME_LABEL } from "@/lib/media/discipline";
import { feed } from "@/lib/media/newsEngine";
import { COACH_STYLE_LABEL, coachPersona, mediaOf, relationLabel, rivalryBetween } from "@/lib/media/people";
import { openPressConferences, TONE_LABEL } from "@/lib/media/press";
import { CLUB_MEDIA, MEDIA_OUTLETS } from "@/lib/media/registry";
import type { NewsStory } from "@/lib/media/types";

type Tab = "feed" | "press" | "rivals" | "discipline" | "outlets";
const TABS: { id: Tab; label: string }[] = [{ id: "feed", label: "Nyheter" }, { id: "press", label: "Presskonferenser" }, { id: "rivals", label: "Rivaler" }, { id: "discipline", label: "Disciplin" }, { id: "outlets", label: "Medierna" }];
const SCOPES: { id: NewsStory["scope"] | "OWN" | "ALL"; label: string }[] = [{ id: "ALL", label: "Alla" }, { id: "OWN", label: "Din klubb" }, { id: "LOCAL", label: "Lokalt" }, { id: "REGIONAL", label: "Regionalt" }, { id: "NATIONAL", label: "Nationellt" }, { id: "SPECIALIST", label: "Handbollsmedia" }];

export default function MediaPage() {
  return <Suspense fallback={<EmptyState>Läser tidningarna…</EmptyState>}><MediaCentre /></Suspense>;
}

function MediaCentre() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "feed") as Tab;
  const { career, updateCareer } = useCareer();
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("ALL");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const media = mediaOf(career);
  const stories = useMemo(() => feed(career, { scope: scope === "ALL" ? undefined : scope, query, limit: 80 }), [career, scope, query]);
  const top = feed(career, { limit: 12 }).find((s) => s.importance >= 4 && s.date >= addDays(career.gameDate, -4));
  const open = openPressConferences(career);
  const suspension = activeSuspension(career);
  const control = matchControl(career);
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } };
  const local = CLUB_MEDIA[career.playerClubId];

  return (
    <div className="md-page">
      {top ? (
        <MomentHero kind="ANNOUNCEMENT" tone={top.kind === "DISCIPLINE" || top.kind === "MANAGER_DISMISSED" ? "loss" : top.kind === "TITLE" || top.kind === "PROMOTION" ? "gold" : "signal"} backdrop={{ kind: "photo", style: PRESSROOM_BACKDROP }} tags={[false, "Senaste nytt", MEDIA_OUTLETS[top.outletId]?.name ?? "", top.date]} stamp={null} headline={top.headline} lede={top.standfirst}>
          <div className="sc-hero-actions"><Link className="hm-btn hm-btn-primary" href={`/career/media/story/${encodeURIComponent(top.id)}`}>Läs artikeln →</Link></div>
        </MomentHero>
      ) : (
        <MomentHero tone="ink" backdrop={{ kind: "photo", style: PRESSROOM_BACKDROP }} tags={[false, "Mediecentret", local?.town ?? ""]} stamp={null} headline="Handbollsvärlden" lede={`Vad lokalpressen, handbollsmedierna och rikspressen skriver om dig, din klubb och resten av handbollssverige.`} aside={<div className="bd-hero-figure"><b>{open.length}</b><small>presskonferenser väntar</small></div>} />
      )}
      {control.by === "ASSISTANT" && <p className="md-alert" role="status"><b>Du är avstängd</b> i {control.remaining === 1 ? "en match" : `${control.remaining} matcher`} till. {control.name} leder laget på matchdagen.</p>}

      <div className="bd-tabs" role="tablist" aria-label="Mediecentret">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => router.replace(t.id === "feed" ? "/career/media" : `/career/media?tab=${t.id}`)}>{t.label}{t.id === "press" && open.length ? ` (${open.length})` : ""}</button>)}
      </div>
      {message && <p className="pd-note" role="status">{message}</p>}

      {tab === "feed" && (
        <section className="md-feed" aria-label="Nyhetsflödet">
          <div className="md-filters">
            <div className="dg-modes" role="radiogroup" aria-label="Bevakning">{SCOPES.map((s) => <button key={s.id} type="button" role="radio" aria-checked={scope === s.id} data-active={scope === s.id} onClick={() => setScope(s.id)}>{s.label}</button>)}</div>
            <label className="md-search"><span className="sr-only">Sök i nyheterna</span><input type="search" placeholder="Sök spelare, klubb, tidning…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          </div>
          {stories.length === 0 ? <p className="pd-note">Inga artiklar ännu. Medierna skriver när något händer: matcher som betyder något, övergångar, tränarbyten och dina uttalanden.</p> : (
            <div className="md-grid">
              {stories.slice(0, 1).map((s) => <StoryCard key={s.id} story={s} size="lg" />)}
              <div className="md-list">{stories.slice(1).map((s) => <StoryCard key={s.id} story={s} size={s.importance >= 3 ? "md" : "sm"} />)}</div>
            </div>
          )}
          <FictionNote />
        </section>
      )}

      {tab === "press" && (
        <section className="md-press" aria-label="Presskonferenser">
          <label className="md-toggle"><input type="checkbox" checked={!!media.delegatePress} onChange={(e) => run(() => updateCareer((s) => setRoutinePressDelegation(s, e.target.checked)), e.target.checked ? "Assisterande tränaren tar presskonferenserna (diplomatiska svar, halva effekten)." : "Du tar presskonferenserna själv.")} /> Låt assisterande tränaren sköta presskonferenserna</label>
          {open.length === 0 ? <p className="pd-note">Inga presskonferenser väntar. De kommer inför och efter matcher som betyder något, och när något händer runt klubben.</p> : (
            <ul className="md-press-list">{open.map((p) => <li key={p.id} data-open="true"><Link href={`/career/media/press/${encodeURIComponent(p.id)}`}><b>{p.title}</b><small>{p.context} · {p.questions.length} frågor · svara senast {p.expiresOn}</small></Link></li>)}</ul>
          )}
          <h3 className="bd-subhead">Tidigare</h3>
          <ul className="md-press-list">{Object.values(media.press).filter((p) => p.status !== "OPEN").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((p) => (
            <li key={p.id} data-status={p.status}><Link href={`/career/media/press/${encodeURIComponent(p.id)}`}><b>{p.title}</b><small>{p.date} · {p.status === "EXPIRED" ? "Inga svar" : p.status === "DELEGATED" ? "Assisterande tränaren svarade" : Object.values(p.answers ?? {}).map((t) => TONE_LABEL[t]).join(", ")}</small></Link>
              {p.consequences && p.consequences.length > 0 && <ul className="md-effects">{p.consequences.map((c, i) => <li key={i} data-sign={c.delta >= 0 ? "plus" : "minus"}>{c.text}</li>)}</ul>}
            </li>
          ))}</ul>
        </section>
      )}

      {tab === "rivals" && <Rivals />}

      {tab === "discipline" && (
        <section className="md-discipline" aria-label="Disciplinärenden">
          <p className="pd-note">Saklig kritik av domarinsatser är tillåten. Den som ifrågasätter domarnas opartiskhet eller uppträder otillbörligt mot funktionärer kan anmälas till SHF:s disciplinnämnd (RF:s stadgar 14 kap.). Påföljder: tillrättavisning, straffavgift (högst 25 000 kr, SHF:s tävlingsbestämmelser § 1:14) eller avstängning. Beslut kan överklagas till Riksidrottsnämnden inom tre veckor.</p>
          {Object.values(media.discipline).length === 0 ? <p className="pd-note">Inga ärenden.</p> : (
            <ol className="md-cases">{Object.values(media.discipline).sort((a, b) => b.openedOn.localeCompare(a.openedOn)).map((c) => (
              <li key={c.id} data-outcome={c.outcome ?? "PENDING"}>
                <header><b>{c.outcome ? OUTCOME_LABEL[c.outcome] : "Anmäld – beslut väntar"}</b><small>{c.openedOn}{c.status === "REPORTED" ? ` · beslut ${c.decisionOn}` : c.status === "APPEALED" ? ` · överklagat, RIN beslutar ${c.appeal?.decisionOn}` : ""}</small></header>
                <blockquote>”{c.statement}”</blockquote>
                <small>Anmält enligt {c.provision}.{c.apologised ? " Du har bett om ursäkt." : ""}</small>
                {c.reasoning && <p>{c.reasoning}</p>}
                {c.outcome === "AVSTANGNING" && <MeterBar label="Avstängning avtjänad" value={(c.servedMatches ?? 0) / Math.max(1, c.matches ?? 1)} figure={`${c.servedMatches ?? 0} / ${c.matches} matcher`} tone="loss" />}
                {c.appeal?.result && <p className="pd-note">Riksidrottsnämnden: {c.appeal.result === "REDUCED" ? "påföljden mildrades." : "inget prövningstillstånd – beslutet står fast."}</p>}
                {c.status === "DECIDED" && (c.outcome === "STRAFFAVGIFT" || c.outcome === "AVSTANGNING") && career.gameDate <= addDays(c.decisionOn, 21) && <button type="button" className="hm-btn hm-btn-sm" onClick={() => run(() => updateCareer((s) => appealAction(s, c.id)), "Överklagandet är inskickat till Riksidrottsnämnden (avgift 1 000 kr).")}>Överklaga till RIN (1 000 kr)</button>}
              </li>
            ))}</ol>
          )}
        </section>
      )}

      {tab === "outlets" && (
        <section className="md-outlets" aria-label="Medierna">
          {local && <><h3 className="bd-subhead">Medierna som bevakar {getClub(career.playerClubId)?.name} ({local.town})</h3>
            <ul className="md-outlet-list">{local.outlets.map((id) => <OutletRow key={id} outletId={id} relation={media.outletRelations[id] ?? 0} count={Object.values(media.stories).filter((s) => s.outletId === id).length} />)}</ul></>}
          <h3 className="bd-subhead">Rikstäckande och handbollsmedia</h3>
          <ul className="md-outlet-list">{["svt-sport", "radiosporten", "aftonbladet", "expressen", "dn", "svd", "tv4-sport", "tt", "handbollskanalen"].map((id) => <OutletRow key={id} outletId={id} relation={media.outletRelations[id] ?? 0} count={Object.values(media.stories).filter((s) => s.outletId === id).length} />)}</ul>
          <p className="pd-note">Tidningarna, radio- och tv-kanalerna är verkliga svenska medier med sin faktiska bevakning. Journalisterna och artiklarna i spelet är påhittade och handlar bara om händelser i din karriär.</p>
        </section>
      )}
    </div>
  );
}

function OutletRow({ outletId, relation, count }: { outletId: string; relation: number; count: number }) {
  const o = MEDIA_OUTLETS[outletId];
  if (!o) return null;
  return (
    <li>
      <OutletChip outletId={outletId} withCategory />
      <small>{o.coverage} · {o.frequency === "EVERY_MATCH" ? "Bevakar varje match" : o.frequency === "WEEKLY" ? "Skriver varje vecka" : "Skriver vid stora händelser"}</small>
      <span className="md-rel" data-sign={relation >= 0 ? "plus" : "minus"}>{relation > 5 ? "Gillar dig" : relation < -5 ? "Kritisk mot dig" : "Neutral"}</span>
      <small>{count} artiklar</small>
    </li>
  );
}

function Rivals() {
  const { career } = useCareer();
  const media = mediaOf(career);
  const rel = Object.values(media.relations).filter((r) => r.a === "manager" || r.b === "manager").map((r) => ({ r, other: r.a === "manager" ? r.b : r.a })).sort((x, y) => x.r.score - y.r.score);
  const feud = rel.find((x) => x.r.score <= -40);
  const clubs = Object.keys(CLUB_MEDIA).filter((id) => id !== career.playerClubId).map((id) => rivalryBetween(career, career.playerClubId, id)).filter((x) => x.score >= 18).sort((a, b) => b.score - a.score).slice(0, 8);
  return (
    <section className="md-rivals" aria-label="Rivaler">
      {feud && <MomentHero kind="ANNOUNCEMENT" tone="loss" size="compact" headingLevel={2} backdrop={{ kind: "photo", style: PRESSROOM_BACKDROP }} tags={[false, "Öppen fejd"]} stamp={null} headline={`Du och ${coachPersona(career, feud.other)?.name ?? "han"}`} lede={feud.r.history.at(-1)?.text ?? ""} />}
      <div className="bd-grid">
        <div className="bd-panel">
          <header><span className="xp-eyebrow">Tränarna</span><h2>Dina relationer</h2></header>
          {rel.length === 0 ? <p className="pd-note">Inga relationer ännu. De växer fram ur det ni säger om varandra och era matcher.</p> : (
            <ul className="md-relations">{rel.map(({ r, other }) => { const p = coachPersona(career, other); const club = p ? getClub(p.clubId) : undefined; return (
              <li key={other}>
                <div>{club && <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={22} />}<b>{p?.name ?? "Tidigare tränare"}</b><small>{club?.shortName ?? "Utan klubb"}{p ? ` · ${COACH_STYLE_LABEL[p.style]}` : ""}</small></div>
                <MeterBar label={relationLabel(r.score)} value={(r.score + 100) / 200} figure={r.score > 0 ? `+${r.score}` : `${r.score}`} tone={r.score <= -15 ? "loss" : r.score >= 15 ? "success" : "ink"} />
                <ol className="md-history">{[...r.history].reverse().slice(0, 4).map((h, i) => <li key={i}><time>{h.date}</time>{h.text}</li>)}</ol>
              </li>
            ); })}</ul>
          )}
        </div>
        <div className="bd-panel">
          <header><span className="xp-eyebrow">Klubbarna</span><h2>Rivaliteter</h2></header>
          {clubs.length === 0 ? <p className="pd-note">Inga rivaliteter ännu.</p> : (
            <ul className="md-relations">{clubs.map((x) => { const c = getClub(x.b); return c ? (
              <li key={x.b}><div><ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={22} /><b>{c.name}</b><small>{x.reasons.join(" · ")}</small></div>
                <MeterBar label="Rivalitet" value={x.score / 100} figure={`${x.score}`} tone="gold" />
                {x.meetings.length > 0 && <small>Säsongens möten: {x.meetings.map((m) => `${m.homeGoals}–${m.awayGoals}`).join(", ")}</small>}
              </li>) : null; })}</ul>
          )}
        </div>
      </div>
    </section>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
