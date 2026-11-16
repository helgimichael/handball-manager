"use client";
// HM-ALPHA3-M08: the Media Centre -- "Handbollsvärlden".
// Arena Nights 231: WLD-02 C Newsstand (featured press slot, one front page
// per outlet tier with your club first, a Senaste column, rivalries and
// relations as sections), WLD-02a A image lead + dated list, WLD-02b B
// decisions + quote archive, WLD-02c A rivalry cards, WLD-02d A (small
// discipline archive under Medierna), WLD-02e A media favour meters.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import ClubCrest from "@/components/ClubCrest";
import { MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { EmptyState } from "@/components/manager/Workspace";
import { ClubLink } from "@/components/entityLinks";
import { FictionNote, FrontPageCard, LeadStory, OutletChip, PRESSROOM_BACKDROP, StoryCard } from "@/components/media/MediaParts";
import { useCareer } from "@/lib/career/CareerContext";
import { activeClubId } from "@/lib/manager/employment";
import { fixtureHref } from "@/lib/career/fixtureRoutes";
import { getClub } from "@/lib/game-data";
import { appealAction, setRoutinePressDelegation } from "@/lib/media/actions";
import { matchControl, OUTCOME_LABEL } from "@/lib/media/discipline";
import { feed } from "@/lib/media/newsEngine";
import { frontPages, groupByDate, outletFavour, quoteArchive, rivalCards, storyThreadMessageId, type OutletFavourRow } from "@/lib/media/newsstand";
import { mediaOf } from "@/lib/media/people";
import { openPressConferences } from "@/lib/media/press";
import { CLUB_MEDIA, MEDIA_OUTLETS } from "@/lib/media/registry";
import type { NewsStory } from "@/lib/media/types";

type Tab = "feed" | "press" | "rivals" | "outlets";
const TABS: { id: Tab; label: string }[] = [{ id: "feed", label: "Förstasidan" }, { id: "press", label: "Presskonferenser" }, { id: "rivals", label: "Rivaler" }, { id: "outlets", label: "Medierna" }];
type Scope = NewsStory["scope"] | "OWN" | "ALL";
const SCOPES: { id: Scope; label: string }[] = [{ id: "ALL", label: "Alla" }, { id: "OWN", label: "Din klubb" }, { id: "LOCAL", label: "Lokalt" }, { id: "REGIONAL", label: "Regionalt" }, { id: "NATIONAL", label: "Nationellt" }, { id: "SPECIALIST", label: "Handbollsmedia" }];
const NATIONAL_IDS = ["svt-sport", "radiosporten", "aftonbladet", "expressen", "dn", "svd", "tv4-sport", "tt", "handbollskanalen"];

export default function MediaPage() {
  return <Suspense fallback={<EmptyState>Läser tidningarna…</EmptyState>}><MediaCentre /></Suspense>;
}

function MediaCentre() {
  const params = useSearchParams();
  const router = useRouter();
  const rawTab = params.get("tab");
  // WLD-02d: discipline is no longer a tab; old links land on its archive under Medierna.
  const tab = (rawTab === "discipline" ? "outlets" : TABS.find((t) => t.id === rawTab)?.id ?? "feed") as Tab;
  const scope = (SCOPES.find((s) => s.id === params.get("scope"))?.id ?? "ALL") as Scope;
  const { career, updateCareer } = useCareer();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const media = mediaOf(career);
  const open = openPressConferences(career);
  const control = matchControl(career);
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } };
  const local = activeClubId(career) ? CLUB_MEDIA[career.playerClubId] : undefined;
  const go = (next: { tab?: Tab; scope?: Scope }) => {
    const q = new URLSearchParams();
    const t = next.tab ?? tab; if (t !== "feed") q.set("tab", t);
    const s = next.scope ?? scope; if (s !== "ALL" && t === "feed") q.set("scope", s);
    router.replace(q.toString() ? `/career/media?${q}` : "/career/media", { scroll: false });
  };

  return (
    <div className="md-page">
      <MomentHero tone="ink" size="compact" backdrop={{ kind: "photo", style: PRESSROOM_BACKDROP }} tags={[false, "Mediecentret", local?.town ?? ""]} stamp={null} headline="Handbollsvärlden" lede="Vad lokalpressen, handbollsmedierna och rikspressen skriver om dig, din klubb och resten av handbollssverige." aside={<div className="bd-hero-figure"><b>{open.length}</b><small>presskonferenser väntar</small></div>} />
      {control.by === "ASSISTANT" && <p className="md-alert" role="status"><b>Du är avstängd</b> i {control.remaining === 1 ? "en match" : `${control.remaining} matcher`} till. {control.name} leder laget på matchdagen.</p>}

      <div className="bd-tabs" role="tablist" aria-label="Mediecentret">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => go({ tab: t.id })}>{t.label}{t.id === "press" && open.length ? ` (${open.length})` : ""}</button>)}
      </div>
      {message && <p className="pd-note" role="status">{message}</p>}

      {tab === "feed" && <Newsstand scope={scope} setScope={(s) => go({ scope: s })} query={query} setQuery={setQuery} openGoPress={() => go({ tab: "press" })} />}

      {tab === "press" && (
        <section className="md-press" aria-label="Presskonferenser">
          <label className="md-toggle"><input type="checkbox" checked={!!media.delegatePress} onChange={(e) => run(() => updateCareer((s) => setRoutinePressDelegation(s, e.target.checked)), e.target.checked ? "Assisterande tränaren tar presskonferenserna (diplomatiska svar, halva effekten)." : "Du tar presskonferenserna själv.")} /> Låt assisterande tränaren sköta presskonferenserna</label>
          <h3 className="bd-subhead">Väntar på dig</h3>
          {open.length === 0 ? <p className="pd-note">Inga presskonferenser väntar. De kommer inför och efter matcher som betyder något, och när något händer runt klubben. Öppna presskonferenser ligger också i inkorgens Att göra.</p> : (
            <ul className="md-press-list">{open.map((p) => <li key={p.id} data-open="true"><Link href={`/career/media/press/${encodeURIComponent(p.id)}`}><b>{p.title}</b><small>{p.context} · {p.questions.length} frågor · svara senast {p.expiresOn}</small></Link><Link className="md-thread-link" href="/career/inbox?view=todo">I inkorgens Att göra →</Link></li>)}</ul>
          )}
          <h3 className="bd-subhead">Vad du sa – och vad det ledde till</h3>
          <QuoteArchive />
        </section>
      )}

      {tab === "rivals" && <Rivals />}

      {tab === "outlets" && (
        <section className="md-outlets" aria-label="Medierna">
          <p className="pd-note">Varje redaktion minns hur dess journalister blivit bemötta på dina presskonferenser. Avböjer du en presskonferens tappar redaktionerna i rummet förtroende. Mest kritiska först.</p>
          {(() => { const f = outletFavour(career, NATIONAL_IDS); return <>
            {local && f.local.length > 0 && <><h3 className="bd-subhead">Medierna som bevakar {getClub(career.playerClubId)?.name} ({local.town})</h3><ul className="md-favour-list">{f.local.map((r) => <FavourRow key={r.outletId} row={r} />)}</ul></>}
            <h3 className="bd-subhead">Rikstäckande och handbollsmedia</h3>
            <ul className="md-favour-list">{f.national.map((r) => <FavourRow key={r.outletId} row={r} />)}</ul>
          </>; })()}
          <p className="pd-note">Tidningarna, radio- och tv-kanalerna är verkliga svenska medier med sin faktiska bevakning. Journalisterna och artiklarna i spelet är påhittade och handlar bara om händelser i din karriär.</p>

          <details className="md-discipline-archive" id="disciplin" open={rawTab === "discipline" || Object.values(media.discipline).some((c) => c.status !== "CLOSED")}>
            <summary>Disciplinärenden <span>{Object.values(media.discipline).length}</span></summary>
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
          </details>
        </section>
      )}
    </div>
  );
}

/** WLD-02 C + WLD-02a A: press slot, outlet front pages, Senaste (image lead + dated list), rivals/relations aside. */
function Newsstand({ scope, setScope, query, setQuery, openGoPress }: { scope: Scope; setScope: (s: Scope) => void; query: string; setQuery: (q: string) => void; openGoPress: () => void }) {
  const { career } = useCareer();
  const open = openPressConferences(career);
  const pages = useMemo(() => frontPages(career), [career]);
  const stories = useMemo(() => feed(career, { scope: scope === "ALL" ? undefined : scope, query, limit: 80 }), [career, scope, query]);
  const rivals = useMemo(() => rivalCards(career, 3), [career]);
  const favour = useMemo(() => outletFavour(career, NATIONAL_IDS), [career]);
  const lead = stories[0];
  const rest = groupByDate(stories.slice(1));
  const thread = (s: NewsStory) => { const id = storyThreadMessageId(career, s); return id ? `/career/inbox?message=${encodeURIComponent(id)}` : undefined; };
  const press = open[0];
  const coolest = [...favour.local, ...favour.national].sort((a, b) => a.score - b.score)[0];

  return (
    <section className="md-stand" aria-label="Förstasidan">
      {press ? (
        <div className="md-press-slot" role="region" aria-label="Presskonferens väntar">
          <div><span className="xp-eyebrow">Presskonferens · svara senast {press.expiresOn}</span><h2>{press.title}</h2><p>{press.context} · {press.questions.length} frågor{open.length > 1 ? ` · ${open.length - 1} till väntar` : ""}</p></div>
          <div className="hm-actions"><Link className="hm-btn hm-btn-primary" href={`/career/media/press/${encodeURIComponent(press.id)}`}>Gå in i pressrummet →</Link>{open.length > 1 && <button type="button" className="hm-btn" onClick={openGoPress}>Alla presskonferenser</button>}</div>
        </div>
      ) : <p className="md-press-slot" data-empty="true">Ingen presskonferens väntar. <button type="button" className="md-link-btn" onClick={openGoPress}>Se vad du sagt tidigare →</button></p>}

      <div className="md-fronts" aria-label="Förstasidor per redaktion">
        {pages.map((p) => <FrontPageCard key={p.scope} page={p} active={scope === p.scope} onOpen={() => setScope(scope === p.scope ? "ALL" : p.scope)} />)}
      </div>

      <div className="md-stand-grid">
        <div className="md-latest">
          <header className="md-latest-head"><h2>Senaste{scope !== "ALL" ? ` · ${SCOPES.find((s) => s.id === scope)?.label}` : ""}</h2><span>{stories.length} artiklar</span></header>
          {lead ? <LeadStory story={lead} threadHref={thread(lead)} /> : null}
          {stories.length === 0 ? <p className="pd-note">{query ? "Inga artiklar matchar sökningen." : "Inga artiklar ännu. Medierna skriver när något händer: matcher som betyder något, övergångar, tränarbyten och dina uttalanden."} {(query || scope !== "ALL") && <button type="button" className="md-link-btn" onClick={() => { setQuery(""); setScope("ALL"); }}>Visa alla artiklar</button>}</p> : (
            <ol className="md-dated">{rest.map((g) => <li key={g.date}><h3><time>{g.date}</time></h3><div className="md-list">{g.stories.map((s) => <StoryCard key={s.id} story={s} size={s.importance >= 3 ? "md" : "sm"} threadHref={thread(s)} />)}</div></li>)}</ol>
          )}
          <FictionNote />
        </div>
        <aside className="md-stand-aside">
          <div className="md-filters">
            <div className="dg-modes" role="radiogroup" aria-label="Bevakning">{SCOPES.map((s) => <button key={s.id} type="button" role="radio" aria-checked={scope === s.id} data-active={scope === s.id} onClick={() => setScope(s.id)}>{s.label}</button>)}</div>
            <label className="md-search"><span className="sr-only">Sök i nyheterna</span><input type="search" placeholder="Sök spelare, klubb, tidning…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          </div>
          <div className="bd-panel md-aside-panel">
            <header><span className="xp-eyebrow">Rivaler</span><h2>Hetast just nu</h2></header>
            {rivals.length === 0 ? <p className="pd-note">Inga rivaliteter ännu. De växer fram ur era matcher och det ni säger om varandra.</p> : <ul className="md-mini-rivals">{rivals.map((r) => { const c = getClub(r.clubId); return c ? <li key={r.clubId}><ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={20} /><b>{c.shortName}</b><small>{r.coach ? r.coach.label : `Rivalitet ${r.rivalry}`}{r.nextMeeting ? ` · möts ${r.nextMeeting.date}` : ""}</small></li> : null; })}</ul>}
            <Link className="md-thread-link" href="/career/media?tab=rivals">Alla rivaler →</Link>
          </div>
          <div className="bd-panel md-aside-panel">
            <header><span className="xp-eyebrow">Relationer</span><h2>Medierna och du</h2></header>
            {coolest ? <p className="pd-note"><b>{MEDIA_OUTLETS[coolest.outletId]?.name}</b> är mest {coolest.favour.label.toLowerCase()} mot dig just nu.</p> : <p className="pd-note">Inga redaktioner bevakar klubben ännu.</p>}
            <Link className="md-thread-link" href="/career/media?tab=outlets">Alla redaktioner →</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** WLD-02b B: past conferences as quote cards with what they caused. */
function QuoteArchive() {
  const { career } = useCareer();
  const cards = quoteArchive(career);
  if (!cards.length) return <p className="pd-note">Inga avslutade presskonferenser ännu. Det du säger hamnar här tillsammans med följderna.</p>;
  return (
    <ul className="md-quotes">{cards.map((c) => (
      <li key={c.press.id} data-status={c.press.status}>
        <Link href={`/career/media/press/${encodeURIComponent(c.press.id)}`}>
          <small>{c.press.date} · {c.press.title}</small>
          {c.quote ? <blockquote>”{c.quote.text}”<cite>{c.who} · {c.quote.tone}</cite></blockquote> : <p className="md-quote-none">{c.who}.</p>}
        </Link>
        {c.chips.length > 0 ? <ul className="md-chips" aria-label="Följder">{c.chips.map((x) => <li key={x.area} data-sign={x.sign}>{x.label} {x.sign === "plus" ? "+" : "−"}</li>)}</ul> : <small className="md-quote-calm">Inga märkbara följder.</small>}
      </li>
    ))}</ul>
  );
}

/** WLD-02c A: one card per rival -- rivalry, the coach relation, last flashpoint, head-to-head, next meeting. */
function Rivals() {
  const { career } = useCareer();
  const cards = rivalCards(career);
  const feud = cards.find((c) => c.coach && c.coach.score <= -40);
  return (
    <section className="md-rivals" aria-label="Rivaler">
      {feud && feud.coach && <MomentHero kind="ANNOUNCEMENT" tone="loss" size="compact" headingLevel={2} backdrop={{ kind: "photo", style: PRESSROOM_BACKDROP }} tags={[false, "Öppen fejd"]} stamp={null} headline={`Du och ${feud.coach.name}`} lede={feud.flashpoint?.text ?? ""} />}
      {cards.length === 0 ? <p className="pd-note">Inga rivaliteter ännu. De växer fram ur geografin, jämna matcher, slutspelsmöten och det du och de andra tränarna säger om varandra.</p> : (
        <ul className="md-rival-grid">{cards.map((r) => { const c = getClub(r.clubId); if (!c) return null; const played = r.h2h.won + r.h2h.drawn + r.h2h.lost; return (
          <li key={r.clubId} className="md-rival" data-hot={r.heat >= 40 || undefined}>
            <header><ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={34} /><div><ClubLink clubId={c.id}>{c.name}</ClubLink><small>{r.reasons.join(" · ") || "Rivaliteten bygger på er relation"}</small></div></header>
            <MeterBar label="Rivalitet" value={r.rivalry / 100} figure={`${r.rivalry}`} tone="gold" />
            {r.coach && <MeterBar label={`${r.coach.name}: ${r.coach.label}`} value={(r.coach.score + 100) / 200} figure={r.coach.score > 0 ? `+${r.coach.score}` : `${r.coach.score}`} tone={r.coach.score <= -15 ? "loss" : r.coach.score >= 15 ? "success" : "ink"} />}
            <dl>
              <div><dt>Senaste gnistan</dt><dd>{r.flashpoint ? <><time>{r.flashpoint.date}</time> {r.flashpoint.text}</> : "Inget ännu"}</dd></div>
              <div><dt>Inbördes</dt><dd className="md-num">{played ? `${r.h2h.won}V ${r.h2h.drawn}O ${r.h2h.lost}F` : "Inga möten"}</dd></div>
              <div><dt>Nästa möte</dt><dd>{r.nextMeeting ? <Link href={fixtureHref(r.nextMeeting.fixtureId)}>{r.nextMeeting.date} · {r.nextMeeting.home ? "hemma" : "borta"} →</Link> : "Inte i spelschemat"}</dd></div>
            </dl>
          </li>
        ); })}</ul>
      )}
    </section>
  );
}

/** WLD-02e A: favour meter with label and meaning, last story. */
function FavourRow({ row }: { row: OutletFavourRow }) {
  const o = MEDIA_OUTLETS[row.outletId];
  if (!o) return null;
  return (
    <li className="md-favour" data-tone={row.favour.tone}>
      <div className="md-favour-head"><OutletChip outletId={row.outletId} withCategory /><small>{o.frequency === "EVERY_MATCH" ? "Bevakar varje match" : o.frequency === "WEEKLY" ? "Skriver varje vecka" : "Skriver vid stora händelser"}</small></div>
      <MeterBar label={row.favour.label} value={(row.score + 50) / 100} figure={row.score > 0 ? `+${row.score}` : `${row.score}`} tone={row.favour.tone === "pos" ? "success" : row.favour.tone === "neg" ? "loss" : "ink"} />
      <p>{row.favour.meaning}</p>
      <small>{row.last ? <>Senast: <Link href={`/career/media/story/${encodeURIComponent(row.last.id)}`}>{row.last.headline}</Link> ({row.last.date}) · </> : null}{row.count} artiklar</small>
    </li>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
