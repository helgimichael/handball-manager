"use client";
// HM-ALPHA3-M08: one story -- the outlet, the (fictional) reporter, the
// article, and how the other outlets covered the same event.
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/manager/Workspace";
import { FictionNote, OutletChip, SCOPE_LABEL, StoryCard } from "@/components/media/MediaParts";
import { useCareer } from "@/lib/career/CareerContext";
import { resolveDestinationHref, destinationLabel } from "@/lib/career/destinations";
import { coverageOf } from "@/lib/media/newsEngine";
import { mediaOf } from "@/lib/media/people";
import { CATEGORY_LABEL, MEDIA_OUTLETS } from "@/lib/media/registry";

export default function StoryPage() {
  const params = useParams<{ storyId: string }>();
  const id = decodeURIComponent(params.storyId);
  const { career } = useCareer();
  const media = mediaOf(career);
  const story = media.stories[id];
  if (!story) return <EmptyState>Artikeln finns inte längre. <Link href="/career/media">Till mediecentret →</Link></EmptyState>;
  const outlet = MEDIA_OUTLETS[story.outletId];
  const journalist = story.journalistId ? media.journalists[story.journalistId] : undefined;
  const others = coverageOf(career, story.eventKey).filter((s) => s.id !== story.id);
  return (
    <div className="mc-article-page">
      <Link className="hm-btn hm-btn-sm" href="/career/media">← Mediecentret</Link>
      <article className="mc-article" data-scope={story.scope}>
        <header>
          <OutletChip outletId={story.outletId} withCategory />
          <span className="mc-scope">{SCOPE_LABEL[story.scope]}{story.breaking ? " · Senaste nytt" : ""}</span>
          <h1>{story.headline}</h1>
          <p className="mc-standfirst">{story.standfirst}</p>
          <p className="mc-byline">{journalist ? `${journalist.name}, ${outlet?.name}` : outlet?.name} · <time>{story.date}</time></p>
        </header>
        {story.body.map((p, i) => <p key={i}>{p}</p>)}
        {story.quote && <blockquote className="mc-quote">”{story.quote.text}”<cite>{story.quote.who}</cite></blockquote>}
        <footer>
          {story.destinations.map((d, i) => { const href = resolveDestinationHref(d); return href ? <Link key={i} className="hm-btn hm-btn-sm" href={href}>{destinationLabel(d)} →</Link> : null; })}
        </footer>
        <FictionNote />
        {outlet && <p className="pd-note">{outlet.name}: {CATEGORY_LABEL[outlet.category].toLowerCase()}, {outlet.coverage}.</p>}
      </article>
      {others.length > 0 && (
        <section className="mc-coverage" aria-label="Så skrev andra">
          <h2 className="bd-subhead">Så skrev andra</h2>
          <div className="mc-list">{others.map((s) => <StoryCard key={s.id} story={s} size="md" />)}</div>
        </section>
      )}
    </div>
  );
}
