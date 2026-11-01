"use client";

import { Suspense, useMemo } from "react";
import { useWorkspaceState } from '@/components/game/WorkspaceMemory';
import { useRouter, useSearchParams } from "next/navigation";
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { useCareer } from "@/lib/career/CareerContext";
import { categoryLabel } from "@/lib/career/inboxBridge";
import { destinationLabel, resolveDestinationHref } from "@/lib/career/destinations";
import { filterInboxMessages, INBOX_FILTERS, type InboxFilterId } from "@/lib/career/inboxFilters";
import { getClub } from '@/lib/game-data';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { localizeMoneyText } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { PageHeading } from '@/components/manager/Workspace';
import { PlayerCell, MatchHero } from '@/components/game/Identity';

export default function InboxPage() { return <Suspense><Inbox /></Suspense>; }
function Inbox() {
  useMoney(); // money inside message text follows the display currency
  const params = useSearchParams();
  const router = useRouter();
  const { career, markInboxMessageRead, archiveInboxMessage, unarchiveInboxMessage } = useCareer();
  const source = params.get('message') ?? '';
  const linkedMessage = career.inbox.find(m => m.id === source);
  const defaultReader = { source, id: source, filter: linkedMessage?.archived ? 'ARCHIVED' as const : 'ALL' as const };
  const [reader, setReader] = useWorkspaceState<{source:string;id:string;filter:InboxFilterId}>('inbox.reader', defaultReader);
  const currentReader = reader.source === source ? reader : defaultReader;
  const filter = currentReader.filter;
  const messages = useMemo(() => [...filterInboxMessages(career.inbox, filter)].reverse(), [career.inbox, filter]);
  // A message may leave Unread/All after reading or archiving. Keep the article
  // visible until another selection/filter, and honor a new deep link immediately.
  const selected = (currentReader.id ? career.inbox.find(m => m.id === currentReader.id) : undefined) ?? messages[0];
  const unread = career.inbox.filter(m => !m.archived && !m.read).length;
  const required = career.inbox.filter(m => !m.archived && m.actionRequired && !m.resolved).length;
  const canArchive = selected ? !(selected.actionRequired && !selected.resolved) : false;
  const playerDestination = selected?.destinations?.find(d => d.route === 'PLAYER_PROFILE' || d.route === 'SCOUT_REPORT');
  const player = playerDestination ? getCareerPlayer(career, playerDestination.playerId) : undefined;
  const matchDestination = selected?.destinations?.find(d => d.route === 'MATCH_REPORT' || d.route === 'MATCH_DAY');
  const fixture = matchDestination ? career.fixtures.find(f => f.id === matchDestination.fixtureId) ?? careerArchiveSummaries(career)[matchDestination.fixtureId]?.fixture : undefined;

  function selectMessage(id: string) { setReader({ ...currentReader, id }); markInboxMessageRead(id); }

  return <div className="game-news-page">
    <PageHeading eyebrow={`${getClub(career.playerClubId)?.shortName ?? 'Klubben'} / nyheter & kommunikation`} title="Inkorg" description="Rapporter från laget, besked från klubben och händelser som formar din säsong." />
    <div className="game-news-masthead"><div><span className="hm-eyebrow">Klubbens senaste</span><strong>{new Date(`${career.gameDate}T12:00:00Z`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong></div><div><strong>{unread}</strong><span>olästa besked</span></div><div data-urgent={required > 0}><strong>{required}</strong><span>beslut som kräver dig</span></div><span className="game-news-edition">SÄSONG {career.seasonId}</span></div>
    <div className="game-news-layout">
      <section className="game-news-feed" aria-label="Meddelanden">
        <div className="game-news-filters">{INBOX_FILTERS.map(f => <button key={f.id} type="button" className="hm-btn hm-btn-sm" aria-pressed={filter === f.id} data-active={filter === f.id} onClick={() => setReader({source, id:'', filter:f.id})}>{f.label}</button>)}</div>
        <div className="game-news-feed-label"><span>Senaste först</span><span>{messages.length} meddelanden</span></div>
        <div className="game-news-feed-scroll">{messages.length ? messages.map(m => <button type="button" aria-label={m.subject} aria-pressed={m.id === selected?.id} key={m.id} onClick={() => selectMessage(m.id)} data-active={m.id === selected?.id} data-unread={!m.read} data-urgent={m.actionRequired && !m.resolved} className="game-news-item">
          <div className="game-news-item-meta"><span>{categoryLabel(m.category)}{m.careerEventId ? ' · Karriär' : ''}</span><time>{m.date ? m.date.slice(0, 10) : ''}</time></div>
          <strong>{!m.read && <i className="game-unread-dot" aria-label="Oläst" />}{m.subject}</strong>
          <p>{localizeMoneyText(m.preview)}</p>
          {m.actionRequired && !m.resolved && <span className="game-news-action-label">ÅTGÄRD KRÄVS →</span>}{m.archived && <span className="game-news-action-label">ARKIVERAT</span>}
        </button>) : <div className="hm-empty">Inga meddelanden i denna vy.</div>}</div>
      </section>
      <article className="game-news-article" key={selected?.id} data-category={selected?.category}>
        {selected ? <>
          <header className="game-news-article-header"><div className="game-news-kicker"><span>{categoryLabel(selected.category)}</span><time>{selected.date?.slice(0, 10)}</time></div><h2>{selected.subject}</h2><div className="game-news-byline"><span>Från <b>{selected.sender}</b></span>{selected.actionRequired && !selected.resolved ? <span className="hm-badge hm-badge-warning">ÅTGÄRD KRÄVS</span> : selected.important ? <span className="hm-badge hm-badge-warning">VIKTIGT</span> : null}</div></header>
          {fixture && <MatchHero compact career={career} fixture={fixture} result={career.results[fixture.id] ?? careerArchiveSummaries(career)[fixture.id]?.result} context={categoryLabel(selected.category)} />}
          {player && <div className="game-news-player"><PlayerCell player={player} /></div>}
          <div className="game-news-copy">{selected.body.map((paragraph, i) => <p key={i}>{localizeMoneyText(paragraph)}</p>)}</div>
          {selected.destinations && selected.destinations.length > 0 && <div className="game-news-destinations"><div className="hm-eyebrow">Nästa steg</div><div className="hm-actions">{selected.destinations.map((destination, i) => { const href = resolveDestinationHref(destination); return href ? <button key={i} type="button" className={i === 0 ? 'hm-btn hm-btn-primary' : 'hm-btn'} onClick={() => router.push(href)}>{destinationLabel(destination)}</button> : null; })}</div></div>}
          <footer className="game-news-tools">{!selected.read && <button type="button" className="hm-btn hm-btn-sm" onClick={() => markInboxMessageRead(selected.id)}>Markera som läst</button>}{selected.archived ? <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => unarchiveInboxMessage(selected.id)}>Återställ från arkiv</button> : <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" disabled={!canArchive} title={canArchive ? undefined : 'Kan inte arkiveras förrän den obligatoriska åtgärden är genomförd.'} onClick={() => archiveInboxMessage(selected.id)}>Arkivera</button>}{!canArchive && <span className="hm-text-muted">Genomför den obligatoriska åtgärden innan du arkiverar.</span>}</footer>
        </> : <div className="hm-empty">{messages.length ? 'Välj ett meddelande för att läsa beskedet och se nästa steg.' : 'Inga meddelanden i denna vy.'}</div>}
      </article>
    </div>
  </div>;
}
