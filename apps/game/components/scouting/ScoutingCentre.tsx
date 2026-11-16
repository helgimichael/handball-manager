"use client";
// Arena Nights 231 -- REC-01a B: the Scouting Centre collapses into one need-driven recommendations strip. The
// spotlight hero, duplicate counters, workload rail and discovery list moved into the Scout Desk (pipeline
// strip, scout cards, pipeline list, discoveries table). What stays: positions where the squad is thin, each
// with its best recommended candidates as knowledge-gated star ranges, and Kortlista / Scouta per candidate.
import Link from "next/link";
import { useMemo } from "react";
import { StarBand } from "@/components/recruitment/PipelineBoard";
import { useCareer } from "@/lib/career/CareerContext";
import { isShortlisted } from "@/lib/career/recruitment";
import { getClub, positionLabel } from "@/lib/game-data";
import { type StarRange } from "@/lib/knowledge/playerVisibility";
import { useMoney } from "@/lib/settings/usePreferences";
import { recruitmentRecommendations } from "@/lib/scouting/recommendations";
import { needCards } from "@/lib/scouting/scoutDesk";
import { getManagerRecruitmentNeeds } from "@/lib/transfers/transferCentre";

/** A star range as five stars: certain ones filled, the uncertain span hatched. */
export function StarRangeView({ range, label }: { range: StarRange; label: string }) {
  return <StarBand range={range} label={label} />;
}

export function ScoutingCentre({ onOpen, onScout, canScout }: { onOpen: (playerId: string) => void; onScout: (playerId: string, clubId: string) => void; canScout: boolean }) {
  const money = useMoney();
  const { career, addToShortlist } = useCareer();
  const needs = useMemo(() => getManagerRecruitmentNeeds(career), [career]);
  const recs = useMemo(() => recruitmentRecommendations(career, 40), [career]);
  const cards = needCards(recs, needs);

  return (
    <section className="sd-needs" aria-labelledby="sd-needs-title">
      <header className="sd-sec-head">
        <div><span className="xp-eyebrow">Utifrån truppens behov</span><h2 id="sd-needs-title">Rekommendationer</h2></div>
        <Link className="sd-more" href="/career/squad">Truppens djup →</Link>
      </header>
      {cards.length === 0 ? (
        <p className="sd-hint">{needs.some((n) => n.level === "HIGH" || n.level === "MEDIUM") ? "Scouterna har inte sett tillräckligt många spelare på de tunna positionerna ännu. Starta ett svep på en position nedan." : "Truppen har inga tunna positioner just nu. Rekommendationerna kommer när ett behov uppstår."}</p>
      ) : (
        <ul className="sd-need-cards">
          {cards.map((card) => (
            <li key={card.position} data-level={card.level}>
              <header><b>{card.position}</b><span>{positionLabel(card.position)}</span><small>{card.level === "HIGH" ? "Stort behov" : "Behov"} · {card.projectedDepth} spelare i dag</small></header>
              {card.candidates.length === 0 ? <p className="sd-hint">Ingen tillräckligt känd kandidat ännu. Svep positionen för att hitta namn.</p> : (
                <ol>
                  {card.candidates.map((r) => (
                    <li key={r.player.id}>
                      <button type="button" className="sd-linkish" onClick={() => onOpen(r.player.id)}><b>{r.player.firstName.charAt(0)}. {r.player.lastName}</b></button>
                      <small>{getClub(r.clubId)?.shortName ?? "Kontraktslös"} · säkerhet {r.confidencePct} %{r.valueRange ? ` · ${money.format(r.valueRange.min, { compact: true })}–${money.format(r.valueRange.max, { compact: true })}` : ""}</small>
                      <span className="sd-need-est"><StarBand range={r.abilityRange} label="Förmåga" />{r.potentialRange && <StarBand range={r.potentialRange} label="Potential" />}</span>
                      <span className="sd-need-act">
                        {isShortlisted(career, r.player.id) ? <span className="sd-tag" data-tone="kort">Kortlista ✓</span> : <button type="button" className="hm-btn hm-btn-sm" onClick={() => addToShortlist(r.player.id)}>Kortlista</button>}
                        <button type="button" className="hm-btn hm-btn-sm" disabled={!canScout} title={canScout ? undefined : "Klubben har ingen scout"} onClick={() => onScout(r.player.id, r.clubId)}>Scouta</button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {card.more > 0 && <Link className="sd-more" href={`/career/recruitment?position=${card.position}`}>Visa fler ({card.more}) →</Link>}
            </li>
          ))}
        </ul>
      )}
      {!canScout && <p className="sd-hint">Scouta kräver en anställd scout. <Link href="/career/staff/recruitment?role=SCOUT">Rekrytera en scout →</Link></p>}
    </section>
  );
}
