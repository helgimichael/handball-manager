"use client";
// HM-ALPHA3-M08: shared pieces of the Media Centre -- the outlet chip (a
// real outlet's name and category, never its logo), story cards, and the
// label that keeps game fiction apart from real-world journalism.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { getClub } from "@/lib/game-data";
import { CATEGORY_LABEL, MEDIA_OUTLETS } from "@/lib/media/registry";
import type { NewsStory } from "@/lib/media/types";
import pressWide from "./assets/pressroom-moment-1920.webp";
import pressNarrow from "./assets/pressroom-moment-960.webp";
import { photoBackdrop } from "@/components/experience/visuals";

/** The Media Centre and press-conference backdrop (Blender, scripts/visual/render_pressroom_moment.py). */
export const PRESSROOM_BACKDROP = photoBackdrop(pressWide, pressNarrow);

export const SCOPE_LABEL: Record<NewsStory["scope"], string> = { NATIONAL: "Nationellt", SPECIALIST: "Handbollsmedia", REGIONAL: "Regionalt", LOCAL: "Lokalt" };

export function OutletChip({ outletId, withCategory = false }: { outletId: string; withCategory?: boolean }) {
  const o = MEDIA_OUTLETS[outletId];
  if (!o) return null;
  return (
    <span className="mc-outlet" style={{ ["--mc-tint" as string]: o.tint }}>
      <b>{o.name}</b>{withCategory && <small>{CATEGORY_LABEL[o.category]}</small>}
    </span>
  );
}

export function FictionNote() {
  return <p className="mc-fiction">Spelets nyheter: fiktiva artiklar om händelser i din karriär, skrivna i stil med verkliga svenska medier. Inga verkliga artiklar återges.</p>;
}

export function StoryCard({ story, size = "md" }: { story: NewsStory; size?: "lg" | "md" | "sm" }) {
  return (
    <article className="mc-story" data-size={size} data-breaking={story.breaking || undefined}>
      <header>
        <OutletChip outletId={story.outletId} />
        <span className="mc-scope">{SCOPE_LABEL[story.scope]}</span>
        <time>{story.date}</time>
      </header>
      <Link href={`/career/media/story/${encodeURIComponent(story.id)}`}><h3>{story.headline}</h3></Link>
      {size !== "sm" && <p>{story.standfirst}</p>}
      {size === "lg" && story.quote && <blockquote>”{story.quote.text}” <cite>– {story.quote.who}</cite></blockquote>}
      <footer>{story.clubIds.slice(0, 2).map((id) => { const c = getClub(id); return c ? <span key={id} className="mc-club"><ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={16} />{c.shortName}</span> : null; })}</footer>
    </article>
  );
}
