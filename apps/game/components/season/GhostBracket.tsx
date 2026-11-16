"use client";
// Arena Nights MGR-03a A "Ghost Bracket": the SM-slutspel bracket shown all
// season. Before the playoffs it is ghosted -- "Om serien slutade i dag" --
// with quarter-final pairings from the live table (SM_SLUTSPEL_RULES,
// THB §2:1-2:3); real ties fill in solid as they are set. Your route glows.
import type { CareerState } from "@/lib/career/types";
import type { GhostBracket as Ghost, GhostTie } from "@/lib/manager/seasonPath";
import { Crest, TieCard, clubName } from "@/components/season/Knockout";

function formOf(career: CareerState, clubId: string) {
  return (career.clubForm?.[clubId] ?? []).slice(-5).map((f) => (f === "W" ? "V" : f === "D" ? "O" : "F")).join(" ");
}

function GhostCard({ career, tie }: { career: CareerState; tie: GhostTie }) {
  const sides = [tie.high, tie.low];
  return (
    <article className="pg-ghost" data-mine={tie.mine} aria-label={`${tie.label}, prognos: ${sides.map((s) => (s ? `${clubName(s.clubId)} (${s.seed})` : "avgörs senare")).join(" mot ")}`}>
      <header><span>{tie.label}</span><small>Prognos</small></header>
      {sides.map((s, i) => s ? (
        <div key={i} className="pg-ghost-row" data-me={s.clubId === career.playerClubId} title={formOf(career, s.clubId) ? `Form: ${formOf(career, s.clubId)}` : undefined}>
          <span className="pg-seed">{s.seed || "–"}</span><Crest id={s.clubId} size={20} /><span>{clubName(s.clubId)}</span>
        </div>
      ) : (
        <div key={i} className="pg-ghost-row" data-pending="true"><span className="pg-seed">–</span><span className="ss-crest-empty" /><span>Vinnare {i === 0 ? "första" : "andra"} mötet</span></div>
      ))}
    </article>
  );
}

export function GhostBracket({ career, bracket }: { career: CareerState; bracket: Ghost }) {
  return (
    <div className="pg-bracket-wrap">
      {bracket.hypothetical && <p className="pg-hypo"><b>Om serien slutade i dag.</b> Kvartsfinalerna följer tabellen just nu: 1–8, 4–5, 2–7 och 3–6, fast slutspelsträd utan omseedning. Inget är avgjort förrän grundserien är spelad.</p>}
      <ol className="pg-bracket" aria-label="SM-slutspelets träd">
        {bracket.rounds.map((round) => (
          <li key={round.label} className="pg-round">
            <h3 className="ss-round-label">{round.label}</h3>
            <ol>{round.ties.map((t) => (
              <li key={t.key} data-mine={t.mine} data-route={bracket.myPath.includes(t.key)}>
                {t.tie ? <TieCard career={career} tie={t.tie} size={t.key === "F" ? "lg" : "md"} /> : <GhostCard career={career} tie={t} />}
              </li>
            ))}</ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
