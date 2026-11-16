"use client";
// HM-ALPHA3-M08: one story -- the outlet, the (fictional) reporter, the
// article, and how the other outlets covered the same event.
// Arena Nights 231 -- WLD-04 B Outlet-skinned Article: a masthead and
// typographic voice per outlet tier (local paper, regional, Handbollsmedia,
// national/tabloid), article + quote column, and a "Så skrev andra" strip
// that opens the other outlets' takes.
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/manager/Workspace";
import { FictionNote, OutletChip, SCOPE_LABEL } from "@/components/media/MediaParts";
import { useCareer } from "@/lib/career/CareerContext";
import { resolveDestinationHref, destinationLabel } from "@/lib/career/destinations";
import { coverageOf } from "@/lib/media/newsEngine";
import { storyThreadMessageId } from "@/lib/media/newsstand";
import { mediaOf } from "@/lib/media/people";
import { CATEGORY_LABEL, MEDIA_OUTLETS } from "@/lib/media/registry";

export default function StoryPage() {
  const params = useParams<{ storyId: string }>();
  const id = decodeURIComponent(params.storyId);
  const { career } = useCareer();
  const media = mediaOf(career);
  const story = media.stories[id];
  if (!story) return <div className="md-article-page"><EmptyState>Artikeln finns inte längre i arkivet.</EmptyState><Link className="hm-btn hm-btn-primary" href="/career/media">Till mediecentret →</Link></div>;
  const outlet = MEDIA_OUTLETS[story.outletId];
  const journalist = story.journalistId ? media.journalists[story.journalistId] : undefined;
  const others = coverageOf(career, story.eventKey).filter((s) => s.id !== story.id);
  // Tabloids get the heavy condensed skin even though they write in national scope.
  const skin = outlet?.category === "NATIONAL_TABLOID" ? "TABLOID" : story.scope;
  const threadId = storyThreadMessageId(career, story);
  return (
    <div className="md-article-page">
      <Link className="hm-btn hm-btn-sm" href="/career/media">← Mediecentret</Link>
      <article className="md-article md-skinned" data-scope={story.scope} data-skin={skin}>
        <header className="md-article-masthead"><b>{outlet?.name ?? "Redaktionen"}</b><small>{outlet ? CATEGORY_LABEL[outlet.category] : ""}{outlet?.coverage ? ` · ${outlet.coverage}` : ""}</small><time>{story.date}</time></header>
        <div className="md-article-body">
          <div className="md-article-main">
            <header>
              <span className="md-scope">{SCOPE_LABEL[story.scope]}{story.breaking ? " · Senaste nytt" : ""}</span>
              <h1>{story.headline}</h1>
              <p className="md-standfirst">{story.standfirst}</p>
              <p className="md-byline">{journalist ? `${journalist.name}, ${outlet?.name}` : outlet?.name} · <time>{story.date}</time></p>
            </header>
            {story.body.map((p, i) => <p key={i}>{p}</p>)}
            <footer>
              {threadId && <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/inbox?message=${encodeURIComponent(threadId)}`}>Tråden i inkorgen →</Link>}
              {story.destinations.map((d, i) => { const href = resolveDestinationHref(d); return href ? <Link key={i} className="hm-btn hm-btn-sm" href={href}>{destinationLabel(d)} →</Link> : null; })}
            </footer>
          </div>
          {story.quote && <aside className="md-article-quote"><blockquote className="md-quote">”{story.quote.text}”<cite>{story.quote.who}</cite></blockquote></aside>}
        </div>
        <FictionNote />
      </article>
      <section className="md-coverage" aria-label="Så skrev andra">
        <h2 className="bd-subhead">Så skrev andra</h2>
        {others.length === 0 ? <p className="pd-note">Ingen annan redaktion skrev om det här.</p> : (
          <ul className="md-strip">{others.map((s) => { const o = MEDIA_OUTLETS[s.outletId]; return (
            <li key={s.id} data-skin={o?.category === "NATIONAL_TABLOID" ? "TABLOID" : s.scope}>
              <Link href={`/career/media/story/${encodeURIComponent(s.id)}`}><OutletChip outletId={s.outletId} /><b>{s.headline}</b><small>{SCOPE_LABEL[s.scope]} · {s.date}</small></Link>
            </li>
          ); })}</ul>
        )}
      </section>
    </div>
  );
}
