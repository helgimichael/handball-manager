"use client";
// HM-ALPHA3-M08: shared pieces of the Media Centre -- the outlet chip (a
// real outlet's name and category, never its logo), story cards, and the
// label that keeps game fiction apart from real-world journalism.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { getClub } from "@/lib/game-data";
import { CATEGORY_LABEL, MEDIA_OUTLETS } from "@/lib/media/registry";
import type { NewsStory } from "@/lib/media/types";
import { ENVIRONMENTS } from "@/components/clubhq/environments";
import { storyImage, type FrontPage } from "@/lib/media/newsstand";

/** The Media Centre and press-conference backdrop. */
export const PRESSROOM_BACKDROP = ENVIRONMENTS["press-room"].backdropStyle;

export const SCOPE_LABEL: Record<NewsStory["scope"], string> = { NATIONAL: "Nationellt", SPECIALIST: "Handbollsmedia", REGIONAL: "Regionalt", LOCAL: "Lokalt" };

export function OutletChip({ outletId, withCategory = false }: { outletId: string; withCategory?: boolean }) {
  const o = MEDIA_OUTLETS[outletId];
  if (!o) return null;
  return (
    <span className="md-outlet" style={{ ["--md-tint" as string]: o.tint }}>
      <b>{o.name}</b>{withCategory && <small>{CATEGORY_LABEL[o.category]}</small>}
    </span>
  );
}

export function FictionNote() {
  return <p className="md-fiction">Spelets nyheter: fiktiva artiklar om händelser i din karriär, skrivna i stil med verkliga svenska medier. Inga verkliga artiklar återges.</p>;
}

export function StoryCard({ story, size = "md", threadHref }: { story: NewsStory; size?: "lg" | "md" | "sm"; threadHref?: string }) {
  return (
    <article className="md-story" data-size={size} data-breaking={story.breaking || undefined}>
      <header>
        <OutletChip outletId={story.outletId} />
        <span className="md-scope">{SCOPE_LABEL[story.scope]}</span>
        <time>{story.date}</time>
      </header>
      <Link href={`/career/media/story/${encodeURIComponent(story.id)}`}><h3>{story.headline}</h3></Link>
      {size !== "sm" && <p>{story.standfirst}</p>}
      {size === "lg" && story.quote && <blockquote>”{story.quote.text}” <cite>– {story.quote.who}</cite></blockquote>}
      <footer>{story.clubIds.slice(0, 2).map((id) => { const c = getClub(id); return c ? <span key={id} className="md-club"><ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={16} />{c.shortName}</span> : null; })}{threadHref && <Link className="md-thread-link" href={threadHref}>Tråden i inkorgen →</Link>}</footer>
    </article>
  );
}

/** Arena 231 WLD-02a: the lead story over an existing environment photograph (match -> arena, transfer -> office, board -> boardroom...). */
export function LeadStory({ story, threadHref }: { story: NewsStory; threadHref?: string }) {
  const env = ENVIRONMENTS[storyImage(story.kind)];
  return (
    <article className="md-lead" data-breaking={story.breaking || undefined} style={env.backdropStyle} aria-label="Huvudnyheten">
      <div className="md-lead-shade">
        <header><OutletChip outletId={story.outletId} /><span className="md-scope">{SCOPE_LABEL[story.scope]}</span><time>{story.date}</time></header>
        <Link href={`/career/media/story/${encodeURIComponent(story.id)}`}><h3>{story.headline}</h3></Link>
        <p>{story.standfirst}</p>
        {story.quote && <blockquote>”{story.quote.text}” <cite>– {story.quote.who}</cite></blockquote>}
        {threadHref && <Link className="md-thread-link" href={threadHref}>Tråden i inkorgen →</Link>}
      </div>
    </article>
  );
}

/** Arena 231 WLD-02: one outlet tier's mini front page, skinned by tier, your club first. */
export function FrontPageCard({ page, onOpen, active }: { page: FrontPage; onOpen: () => void; active: boolean }) {
  const outlet = page.outletId ? MEDIA_OUTLETS[page.outletId] : undefined;
  return (
    <article className="md-front" data-tier={page.scope} data-active={active || undefined} aria-label={`${page.label}: förstasidan`}>
      <header className="md-masthead"><small>{page.label}</small><b>{outlet?.name ?? page.label}</b></header>
      {page.lead ? (
        <>
          <Link className="md-front-lead" href={`/career/media/story/${encodeURIComponent(page.lead.id)}`}>
            {page.lead.ownClub && <span className="md-front-own">Om er</span>}
            <h3>{page.lead.headline}</h3>
            <span className="md-front-stand">{page.lead.standfirst}</span>
          </Link>
          {page.more.length > 0 && <ul>{page.more.map((s) => <li key={s.id}><Link href={`/career/media/story/${encodeURIComponent(s.id)}`}>{s.headline}</Link><time>{s.date}</time></li>)}</ul>}
        </>
      ) : <p className="md-front-empty">{outlet ? `${outlet.name} har inte skrivit något ännu.` : "Ingen bevakning ännu."} Medierna skriver när något händer.</p>}
      <footer><button type="button" className="hm-btn hm-btn-sm" aria-pressed={active} onClick={onOpen} disabled={page.count === 0}>{page.count === 0 ? "Inga artiklar" : active ? "Visar i Senaste" : `Visa alla ${page.count} →`}</button></footer>
    </article>
  );
}
