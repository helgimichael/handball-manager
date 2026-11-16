"use client";
// Arena Nights 231 -- WLD-01 C Correspondence Desk, WLD-01a A Segment + Chips,
// WLD-01b C Thread Reader with Chain Rail. The pinned "Att göra" tray holds
// every open decision (deadline first, resolvable in place); the list is
// grouped into threads per entity (lib/inbox/threads.ts); the reader shows
// the thread's chain (event -> ask -> your decision -> consequence, plus
// the media coverage) next to the letter and its inline decision.
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceState } from "@/components/game/WorkspaceMemory";
import { careerArchiveSummaries } from "@/lib/career/matchArchiveSummary";
import { useCareer } from "@/lib/career/CareerContext";
import { activeClubId } from "@/lib/manager/employment";
import { categoryLabel } from "@/lib/career/inboxBridge";
import { destinationLabel, resolveDestinationHref } from "@/lib/career/destinations";
import { getClub } from "@/lib/game-data";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { localizeMoneyText } from "@/lib/economy/currency";
import { useMoney } from "@/lib/settings/usePreferences";
import { PageHeading } from "@/components/manager/Workspace";
import { PlayerCell, MatchHero } from "@/components/game/Identity";
import { InboxDecision } from "@/components/inbox/InboxDecision";
import { applyChips, buildThreads, chainFor, chipCounts, decisionFor, INBOX_CHIPS, INBOX_SEGMENTS, parseChips, parseSegment, segmentMessages, THREAD_KIND_LABEL, threadOf, trayItems, type ChainNode, type InboxChip, type InboxSegment } from "@/lib/inbox/threads";
import type { InboxMessage } from "@/lib/game-data";

const TRAY_MAX = 5;
const STEP_LABEL: Record<ChainNode["step"], string> = { event: "Händelse", ask: "Besked", decision: "Ditt beslut", outcome: "Följd", media: "I medierna" };

/** A sender's role as a two-letter emblem (roles, never invented faces). */
function emblem(sender: string): string {
  const words = sender.replace(/^(Din|Ditt|Klubbens)\s+/i, "").split(/[\s-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}
const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export default function InboxPage() { return <Suspense><Inbox /></Suspense>; }
function Inbox() {
  useMoney(); // money inside message text follows the display currency
  const params = useSearchParams();
  const router = useRouter();
  const { career, markInboxMessageRead, archiveInboxMessage, unarchiveInboxMessage } = useCareer();
  const segment = parseSegment(params.get("view"));
  const chips = parseChips(params.get("cat"));
  const linked = params.get("message") ?? "";
  const [memo, setMemo] = useWorkspaceState<{ id: string }>("inbox.desk", { id: "" });
  const [reading, setReading] = useState(() => Boolean(linked)); // phone: full-screen reader
  const [trayOpen, setTrayOpen] = useState(false);

  const inSegment = useMemo(() => segmentMessages(career, segment), [career, segment]);
  const counts = useMemo(() => chipCounts(inSegment), [inSegment]);
  const threads = useMemo(() => buildThreads(career, applyChips(inSegment, chips)), [career, inSegment, chips]);
  const tray = useMemo(() => trayItems(career), [career]);
  const selectedId = linked || memo.id;
  const selected = (selectedId ? career.inbox.find((m) => m.id === selectedId) : undefined) ?? threads[0]?.latest;
  const thread = useMemo(() => (selected ? threadOf(career, selected.id) : undefined), [career, selected]);
  const chain = useMemo(() => (thread ? chainFor(career, thread) : []), [career, thread]);
  const unread = career.inbox.filter((m) => !m.archived && !m.read).length;

  function href(next: { view?: InboxSegment; cat?: InboxChip[]; message?: string }) {
    const q = new URLSearchParams();
    const v = next.view ?? segment; if (v !== "all") q.set("view", v);
    const c = next.cat ?? chips; if (c.length) q.set("cat", c.join(","));
    const m = next.message ?? linked; if (m) q.set("message", m);
    const s = q.toString();
    return s ? `/career/inbox?${s}` : "/career/inbox";
  }
  function select(m: InboxMessage) {
    setMemo({ id: m.id });
    markInboxMessageRead(m.id);
    setReading(true);
    if (linked && linked !== m.id) router.replace(href({ message: m.id }), { scroll: false });
  }
  function toggleChip(id: InboxChip) { router.replace(href({ cat: chips.includes(id) ? chips.filter((c) => c !== id) : [...chips, id] }), { scroll: false }); }

  // j / k move between threads; ignored while typing or with modifiers.
  const threadKey = thread?.key;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      const dir = e.key === "j" ? 1 : e.key === "k" ? -1 : 0;
      if (!dir || !threads.length) return;
      const i = threads.findIndex((x) => x.key === threadKey);
      const next = threads[Math.min(threads.length - 1, Math.max(0, (i < 0 ? -1 : i) + dir))];
      if (next) { e.preventDefault(); setMemo({ id: next.latest.id }); markInboxMessageRead(next.latest.id); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [threads, threadKey, setMemo, markInboxMessageRead]);

  const decision = selected ? decisionFor(career, selected) : null;
  const canArchive = selected ? !(selected.actionRequired && !selected.resolved) : false;
  const playerDestination = selected?.destinations?.find((d) => d.route === "PLAYER_PROFILE" || d.route === "SCOUT_REPORT");
  const player = playerDestination ? getCareerPlayer(career, playerDestination.playerId) : undefined;
  const matchDestination = selected?.destinations?.find((d) => d.route === "MATCH_REPORT" || d.route === "MATCH_DAY");
  const fixture = matchDestination ? career.fixtures.find((f) => f.id === matchDestination.fixtureId) ?? careerArchiveSummaries(career)[matchDestination.fixtureId]?.fixture : undefined;
  const older = thread ? thread.messages.filter((m) => m.id !== selected?.id) : [];
  const shownTray = trayOpen ? tray : tray.slice(0, TRAY_MAX);
  const clearChips = () => router.replace(href({ cat: [] }), { scroll: false });

  return <div className="game-news-page ib-desk">
    <PageHeading eyebrow={`${getClub(activeClubId(career) ?? "")?.shortName ?? "Utan klubb"} / nyheter & kommunikation`} title="Inkorg" description="Besked som kräver dig först, sedan trådarna per spelare, match och styrelse. Varje tråd visar vad som hände, vad du beslutade och vad det ledde till." />
    <div className="game-news-masthead"><div><span className="hm-eyebrow">Klubbens senaste</span><strong>{new Date(`${career.gameDate}T12:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</strong></div><div><strong>{unread}</strong><span>olästa besked</span></div><div data-urgent={tray.length > 0}><strong>{tray.length}</strong><span>beslut som kräver dig</span></div><span className="game-news-edition">SÄSONG {career.seasonId}</span></div>

    {/* WLD-01: the pinned tray -- open decisions, earliest deadline first, five shown. */}
    <section className="nw-todo ib-tray" aria-labelledby="nw-todo-h">
      <h2 id="nw-todo-h">Att göra <span>{tray.length}</span></h2>
      {tray.length ? <ol>{shownTray.map(({ message: m, decision: d, deadline }, i) => <li key={m.id} data-top={i === 0 || undefined}>
        <button type="button" aria-pressed={m.id === selected?.id} onClick={() => select(m)}>
          <small>{categoryLabel(m.category)} · {deadline ? `senast ${day(deadline)}` : day(m.date)}</small>
          <strong>{m.subject}</strong>
          <em>{d?.kind === "concern" ? `${d.options.length} svarsalternativ` : d?.kind === "transferRequest" ? "Godkänn, övertala eller avslå" : d?.kind === "boardPlan" ? "Lämna handlingsplan" : d?.kind === "press" ? `${d.press.questions.length} frågor väntar` : d?.kind === "match" ? "Matchen ska spelas" : "Öppna beskedet"} →</em>
        </button>
      </li>)}</ol> : <p>Inget väntar på dig. Nya beslut hamnar här först.</p>}
      {tray.length > TRAY_MAX && <button type="button" className="ib-tray-more" onClick={() => setTrayOpen((v) => !v)}>{trayOpen ? "Visa de fem första" : `Visa alla ${tray.length}`}</button>}
    </section>

    <div className="game-news-layout ib-layout" data-reading={reading || undefined}>
      <section className="game-news-feed ib-feed" aria-label="Trådar">
        {/* WLD-01a: segment + counted category chips, both kept in the URL (?view=&cat=). */}
        <nav className="ib-segment" aria-label="Vy">{INBOX_SEGMENTS.map((s) => <Link key={s.id} href={href({ view: s.id })} scroll={false} replace aria-current={segment === s.id ? "page" : undefined} data-active={segment === s.id}>{s.label}{s.id === "todo" ? <span>{tray.length}</span> : null}</Link>)}</nav>
        <div className="ib-chips" role="group" aria-label="Kategorier">{INBOX_CHIPS.map((c) => <button key={c.id} type="button" aria-pressed={chips.includes(c.id)} disabled={!counts[c.id] && !chips.includes(c.id)} onClick={() => toggleChip(c.id)}>{c.label} <span>{counts[c.id]}</span></button>)}{chips.length > 0 && <button type="button" className="ib-chip-clear" onClick={clearChips}>Rensa</button>}</div>
        <div className="game-news-feed-label"><span>{segment === "todo" ? "Öppna beslut" : "Senaste aktivitet först"} · j/k bläddrar</span><span>{threads.length} trådar</span></div>
        <div className="game-news-feed-scroll ib-threads">{threads.length ? threads.map((t) => {
          const m = t.latest;
          const active = t.key === thread?.key;
          const target = t.openDecisions ? t.messages.find((x) => decisionFor(career, x)?.open || (x.actionRequired && !x.resolved)) ?? m : m;
          return <button type="button" key={t.key} aria-pressed={active} aria-label={m.subject} onClick={() => select(target)} data-active={active} data-unread={t.unread > 0} data-urgent={t.openDecisions > 0} className="game-news-item ib-thread">
            <span className="ib-emblem" aria-hidden="true" data-kind={t.kind}>{emblem(m.sender)}</span>
            <span className="ib-thread-body">
              <span className="game-news-item-meta"><span>{THREAD_KIND_LABEL[t.kind]} · {categoryLabel(m.category)}</span><time>{day(m.date)}</time></span>
              <strong>{t.unread > 0 && <i className="game-unread-dot" aria-label="Oläst" />}{m.subject}</strong>
              <span className="ib-thread-preview">{localizeMoneyText(m.preview)}</span>
              <span className="ib-thread-foot">{t.messages.length > 1 && <span>{t.messages.length} besked</span>}{t.openDecisions > 0 && <span className="game-news-action-label">BESLUT VÄNTAR →</span>}{m.archived && <span className="game-news-action-label">ARKIVERAT</span>}</span>
            </span>
          </button>;
        }) : <div className="hm-empty">{segment === "todo" ? <>Inga öppna beslut. <Link href={href({ view: "all", cat: [] })} replace>Visa alla besked →</Link></> : segment === "archive" ? "Arkivet är tomt. Lösta besked du arkiverar sparas här." : chips.length ? <>Inga besked i de valda kategorierna. <button type="button" className="hm-btn hm-btn-sm" onClick={clearChips}>Rensa kategorierna</button></> : "Inga besked ännu. Fortsätt i kalendern så rapporterar klubben, staben och styrelsen här."}</div>}</div>
      </section>

      <div className="ib-reader" key={selected?.id}>
        {selected ? <>
          <button type="button" className="hm-btn hm-btn-sm ib-back" onClick={() => setReading(false)}>← Trådarna</button>
          {chain.length > 1 && <details className="ib-chain" open>
            <summary>Kedjan <span>{THREAD_KIND_LABEL[thread!.kind]} · {chain.length} steg</span></summary>
            <ol>{chain.map((n) => <li key={n.id} data-step={n.step} data-sign={n.sign} data-current={n.messageId === selected.id || undefined}>
              <time>{day(n.date)}</time><small>{STEP_LABEL[n.step]}</small>
              {n.messageId && n.messageId !== selected.id ? <button type="button" onClick={() => { const m = career.inbox.find((x) => x.id === n.messageId); if (m) select(m); }}>{n.label}</button> : n.href ? <Link href={n.href}>{n.label}</Link> : <span>{n.label}</span>}
            </li>)}</ol>
          </details>}
          <article className="game-news-article ib-letter" data-category={selected.category}>
            <header className="game-news-article-header"><div className="game-news-kicker"><span>{categoryLabel(selected.category)}</span><time>{day(selected.date)}</time></div><h2>{selected.subject}</h2><div className="game-news-byline"><span className="ib-emblem" aria-hidden="true">{emblem(selected.sender)}</span><span>Från <b>{selected.sender}</b></span>{selected.actionRequired && !selected.resolved ? <span className="hm-badge hm-badge-warning">ÅTGÄRD KRÄVS</span> : selected.important ? <span className="hm-badge hm-badge-warning">VIKTIGT</span> : null}</div></header>
            {fixture && <MatchHero compact career={career} fixture={fixture} result={career.results[fixture.id] ?? careerArchiveSummaries(career)[fixture.id]?.result} context={categoryLabel(selected.category)} />}
            {player && <div className="game-news-player"><PlayerCell player={player} /></div>}
            <div className="game-news-copy ib-copy">{selected.body.map((paragraph, i) => <p key={i}>{localizeMoneyText(paragraph)}</p>)}</div>
            {decision && <div className="ib-letter-decision"><InboxDecision decision={decision} /></div>}
            {selected.destinations && selected.destinations.length > 0 && <div className="game-news-destinations"><div className="hm-eyebrow">Nästa steg</div><div className="hm-actions">{selected.destinations.map((destination, i) => { const to = resolveDestinationHref(destination); return to ? <button key={i} type="button" className={i === 0 && !decision ? "hm-btn hm-btn-primary" : "hm-btn"} onClick={() => router.push(to)}>{destinationLabel(destination)}</button> : null; })}</div></div>}
            {older.length > 0 && <details className="ib-older"><summary>{older.length} besked till i tråden</summary><ol>{[...older].reverse().map((m) => <li key={m.id}><button type="button" onClick={() => select(m)}><time>{day(m.date)}</time><strong>{m.subject}</strong><small>{localizeMoneyText(m.preview)}</small></button></li>)}</ol></details>}
            <footer className="game-news-tools">{!selected.read && <button type="button" className="hm-btn hm-btn-sm" onClick={() => markInboxMessageRead(selected.id)}>Markera som läst</button>}{selected.archived ? <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => unarchiveInboxMessage(selected.id)}>Återställ från arkiv</button> : <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" disabled={!canArchive} title={canArchive ? undefined : "Kan inte arkiveras förrän den obligatoriska åtgärden är genomförd."} onClick={() => archiveInboxMessage(selected.id)}>Arkivera</button>}{!canArchive && <span className="hm-text-muted">Genomför den obligatoriska åtgärden innan du arkiverar.</span>}</footer>
          </article>
        </> : <div className="game-news-article"><div className="hm-empty">{threads.length ? "Välj en tråd för att läsa beskedet och se kedjan." : "Inga besked i denna vy."}</div></div>}
      </div>
    </div>
  </div>;
}
