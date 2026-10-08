"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCareer } from "@/lib/career/CareerContext";
import { categoryLabel } from "@/lib/career/inboxBridge";
import { destinationLabel, resolveDestinationHref } from "@/lib/career/destinations";
import { filterInboxMessages, INBOX_FILTERS, type InboxFilterId } from "@/lib/career/inboxFilters";
import { getClub } from '@/lib/game-data';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { PageHeading } from '@/components/manager/Workspace';
import { PlayerCell, MatchHero } from '@/components/game/Identity';

export default function InboxPage() { return <Suspense><Inbox /></Suspense>; }
function Inbox() {
  const params = useSearchParams();
  const router = useRouter();
  const { career, markInboxMessageRead, archiveInboxMessage, unarchiveInboxMessage } = useCareer();
  const [filter, setFilter] = useState<InboxFilterId>("ALL");
  const messages = useMemo(() => [...filterInboxMessages(career.inbox, filter)].reverse(), [career.inbox, filter]);
  const [selectedId, setSelectedId] = useState(params.get("message") ?? "");
  const selected = selectedId ? messages.find(m => m.id === selectedId) : messages[0];
  const unread = career.inbox.filter(m => !m.archived && !m.read).length;
  const required = career.inbox.filter(m => !m.archived && m.actionRequired && !m.resolved).length;
  const canArchive = selected ? !(selected.actionRequired && !selected.resolved) : false;
  const playerDestination = selected?.destinations?.find(d => d.route === 'PLAYER_PROFILE' || d.route === 'SCOUT_REPORT');
  const player = playerDestination ? getCareerPlayer(career, playerDestination.playerId) : undefined;
  const matchDestination = selected?.destinations?.find(d => d.route === 'MATCH_REPORT' || d.route === 'MATCH_DAY');
  const fixture = matchDestination ? career.fixtures.find(f => f.id === matchDestination.fixtureId) : undefined;

  function selectMessage(id: string) { setSelectedId(id); markInboxMessageRead(id); }

  return <div className="game-news-page">
    <PageHeading eyebrow={`${getClub(career.playerClubId)?.shortName ?? 'Klubben'} / nyheter & kommunikation`} title="Inkorg" description="Rapporter från laget, besked från klubben och händelser som formar din säsong." />
    <div className="game-news-masthead"><div><span className="hm-eyebrow">Klubbens senaste</span><strong>{new Date(`${career.gameDate}T12:00:00Z`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong></div><div><strong>{unread}</strong><span>olästa besked</span></div><div data-urgent={required > 0}><strong>{required}</strong><span>beslut som kräver dig</span></div><span className="game-news-edition">SÄSONG {career.seasonId}</span></div>
    <div className="game-news-layout">
      <section className="game-news-feed" aria-label="Meddelanden">
        <div className="game-news-filters">{INBOX_FILTERS.map(f => <button key={f.id} type="button" className="hm-btn hm-btn-sm" aria-pressed={filter === f.id} data-active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
        <div className="game-news-feed-label"><span>Senaste först</span><span>{messages.length} meddelanden</span></div>
        <div className="game-news-feed-scroll">{messages.length ? messages.map(m => <button type="button" aria-label={m.subject} aria-pressed={m.id === selected?.id} key={m.id} onClick={() => selectMessage(m.id)} data-active={m.id === selected?.id} data-unread={!m.read} data-urgent={m.actionRequired && !m.resolved} className="game-news-item">
          <div className="game-news-item-meta"><span>{categoryLabel(m.category)}{m.careerEventId ? ' · Karriär' : ''}</span><time>{m.date ? m.date.slice(0, 10) : ''}</time></div>
          <strong>{!m.read && <i className="game-unread-dot" aria-label="Oläst" />}{m.subject}</strong>
          <p>{m.preview}</p>
          {m.actionRequired && !m.resolved && <span className="game-news-action-label">ÅTGÄRD KRÄVS →</span>}{m.archived && <span className="game-news-action-label">ARKIVERAT</span>}
        </button>) : <div className="hm-empty">Inga meddelanden i denna vy.</div>}</div>
      </section>
      <article className="game-news-article" key={selected?.id} data-category={selected?.category}>
        {selected ? <>
          <header className="game-news-article-header"><div className="game-news-kicker"><span>{categoryLabel(selected.category)}</span><time>{selected.date?.slice(0, 10)}</time></div><h2>{selected.subject}</h2><div className="game-news-byline"><span>Från <b>{selected.sender}</b></span>{selected.actionRequired && !selected.resolved ? <span className="hm-badge hm-badge-warning">ÅTGÄRD KRÄVS</span> : selected.important ? <span className="hm-badge hm-badge-warning">VIKTIGT</span> : null}</div></header>
          {fixture && <MatchHero compact career={career} fixture={fixture} result={career.results[fixture.id]} context={categoryLabel(selected.category)} />}
          {player && <div className="game-news-player"><PlayerCell player={player} /></div>}
          <div className="game-news-copy">{selected.body.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
          {selected.destinations && selected.destinations.length > 0 && <div className="game-news-destinations"><div className="hm-eyebrow">Nästa steg</div><div className="hm-actions">{selected.destinations.map((destination, i) => { const href = resolveDestinationHref(destination); return href ? <button key={i} type="button" className={i === 0 ? 'hm-btn hm-btn-primary' : 'hm-btn'} onClick={() => router.push(href)}>{destinationLabel(destination)}</button> : null; })}</div></div>}
          <footer className="game-news-tools">{!selected.read && <button type="button" className="hm-btn hm-btn-sm" onClick={() => markInboxMessageRead(selected.id)}>Markera som läst</button>}{selected.archived ? <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => unarchiveInboxMessage(selected.id)}>Återställ från arkiv</button> : <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" disabled={!canArchive} title={canArchive ? undefined : 'Kan inte arkiveras förrän den obligatoriska åtgärden är genomförd.'} onClick={() => archiveInboxMessage(selected.id)}>Arkivera</button>}{!canArchive && <span className="hm-text-muted">Genomför den obligatoriska åtgärden innan du arkiverar.</span>}</footer>
        </> : <div className="hm-empty">{messages.length ? 'Välj ett meddelande för att läsa beskedet och se nästa steg.' : 'Inga meddelanden i denna vy.'}</div>}
      </article>
    </div>
  </div>;
}
