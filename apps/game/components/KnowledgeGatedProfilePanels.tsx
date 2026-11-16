'use client';
// HM-DATA-ALLSVENSKAN-1.1B Part 12: the EXTERNAL-player counterpart to GameplayProfilePanels.tsx -- for a player
// at any club other than the manager's own, raw CA/PA and the full 1-20 attribute grid are NEVER rendered,
// regardless of knowledge level. These panels render only what lib/knowledge/playerVisibility.ts resolved.
// Arena Nights SQD-02l (A) "Tightening range bars": ability and potential as range bars on the star scale (the
// band is as wide as the knowledge tier leaves it), strengths/weaknesses as chips, and an inline "Scouta nu".
import Link from "next/link";
import type { PlayerVisibleView } from "@/lib/knowledge/playerVisibility";
import { KNOWLEDGE_TIER_LABEL_SV } from "@/lib/knowledge/types";
import { RANGE_TIER_HINT_SV } from "@/lib/players/rangeBar";
import { StarRangeBar } from "@/components/players/RangeBar";

function ScoutCta({ playerId, hasOwnScout }: { playerId?: string; hasOwnScout?: boolean }) {
  if (!playerId) return null;
  if (hasOwnScout === false) return <p className="kg-hint">Din klubb har ingen scout anställd -- anställ en scout för att lära känna spelaren bättre. <Link href="/career/staff">Stab →</Link></p>;
  return <Link className="hm-btn hm-btn-sm hm-btn-primary kg-cta" href={`/career/scouting?target=${encodeURIComponent(playerId)}`}>Scouta nu</Link>;
}

function Chips({ title, items, tone }: { title: string; items: string[] | null; tone: "pos" | "neg" }) {
  return <div className="kg-chips"><span className="kg-chips-title">{title}</span>{items === null ? <span className="hm-text-muted">Kräver måttlig kännedom</span> : items.length === 0 ? <span className="hm-text-muted">—</span> : items.map((i) => <span key={i} className="kg-chip" data-tone={tone}>{i}</span>)}</div>;
}

/** Ability / potential as tightening range bars + archetype + scout CTA. */
export function KnowledgeGatedAbilityPanel({ view, playerId, hasOwnScout }: { view: PlayerVisibleView; playerId?: string; hasOwnScout?: boolean }) {
  return (
    <section className="hm-panel kg-panel" aria-label="Bedömd förmåga">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Förmåga</span>
        <span className="hm-badge hm-badge-neutral" data-tier={view.tier}>{KNOWLEDGE_TIER_LABEL_SV[view.tier]}</span>
      </div>
      <div className="hm-panel-body kg-body">
        <div className="hm-range-stack">
          <StarRangeBar label="Nuvarande nivå" range={view.abilityRange} />
          <StarRangeBar label="Potential" range={view.potentialRange} unknownText="Okänd ännu" />
        </div>
        <p className="kg-hint">{RANGE_TIER_HINT_SV[view.tier]}</p>
        <div className="kg-facts"><span>Spelartyp</span><b>{view.archetype ?? "Okänd"}</b></div>
        <ScoutCta playerId={playerId} hasOwnScout={hasOwnScout} />
      </div>
    </section>
  );
}

/** Strengths and weaknesses as chips -- never the full attribute grid for an external player. */
export function KnowledgeGatedAttributesPanel({ view, playerId, hasOwnScout }: { view: PlayerVisibleView; playerId?: string; hasOwnScout?: boolean }) {
  return (
    <section className="hm-panel kg-panel" aria-label="Bedömda egenskaper">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Egenskaper</span>
        <span className="hm-badge hm-badge-neutral" data-tier={view.tier}>{KNOWLEDGE_TIER_LABEL_SV[view.tier]}</span>
      </div>
      <div className="hm-panel-body kg-body">
        {view.strengths === null || view.weaknesses === null ? (
          <p className="kg-hint">För lite kännedom om spelaren för en detaljerad bedömning. Scouta eller möt klubben för att lära känna spelaren bättre.</p>
        ) : (
          <>
            <Chips title="Styrkor" items={view.strengths} tone="pos" />
            <Chips title="Svagheter" items={view.weaknesses} tone="neg" />
          </>
        )}
        <p className="kg-hint">Externa spelares 1–20-värden visas aldrig -- bara det scoutingen kan säga.</p>
        <ScoutCta playerId={playerId} hasOwnScout={hasOwnScout} />
      </div>
    </section>
  );
}
