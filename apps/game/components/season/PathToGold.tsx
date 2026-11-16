"use client";
// Arena Nights MGR-03 B "Path to Gold": the manager's route through the season
// on top of Säsongen -- league position -> SM-slutspel or kval -> the goal,
// with Svenska cupen as a parallel lane and the clubs within two points.
// Projection only from lib/manager/seasonPath.ts (verified rules); always
// labelled "Om serien slutade i dag" while hypothetical.
import Link from "next/link";
import type { CareerState } from "@/lib/career/types";
import type { GhostBracket as Ghost, PathNode, SeasonPath } from "@/lib/manager/seasonPath";
import { svOrdinal } from "@/lib/format/ordinal";
import { CompetitionMark, competitionKeyOf, competitionStyle } from "@/components/season/CompetitionMark";
import { Crest, clubName } from "@/components/season/Knockout";
import { SVENSKA_CUPEN } from "@/lib/competition/rules";

const STATE_LABEL: Record<PathNode["state"], string> = { now: "Nu", projected: "Prognos", live: "Pågår", won: "Klart", lost: "Utslagna", goal: "Målet" };

function Node({ node, career }: { node: PathNode; career: CareerState }) {
  const form = node.opponentId ? (career.clubForm?.[node.opponentId] ?? []).slice(-5) : [];
  return (
    <li className="pg-node" data-state={node.state} tabIndex={0} aria-label={`${node.title}: ${node.detail}`}>
      <span className="pg-dot" aria-hidden="true">{node.label}</span>
      <span className="pg-node-body">
        <small>{STATE_LABEL[node.state]}</small>
        <b>{node.title}</b>
        {node.opponentId && <span className="pg-opp"><Crest id={node.opponentId} size={18} />{clubName(node.opponentId)}</span>}
        <span className="pg-need">{node.detail}</span>
        {form.length > 0 && <span className="pg-form" aria-label={`Form: ${form.join(" ")}`}>{form.map((f, i) => <i key={i} data-r={f}>{f === "W" ? "V" : f === "D" ? "O" : "F"}</i>)}</span>}
      </span>
    </li>
  );
}

export function PathToGold({ career, path, bracket }: { career: CareerState; path: SeasonPath; bracket: Ghost | null }) {
  const me = career.playerClubId;
  const key = competitionKeyOf(career.competitionId);
  const route = bracket?.myPath ?? [];
  return (
    <section className="pg-path" style={competitionStyle(key)} aria-labelledby="pg-title" data-hypothetical={path.hypothetical}>
      <header className="pg-head">
        <CompetitionMark competition={key} size={40} />
        <div>
          <span className="pg-kicker">{path.hypothetical ? "Om serien slutade i dag · prognos" : "Din väg genom säsongen"}</span>
          <h2 id="pg-title">Vägen till guld</h2>
          {path.headline && <p>{path.headline}</p>}
        </div>
      </header>

      {path.nodes.length > 0 ? <ol className="pg-route" aria-label="Din väg">{path.nodes.map((n) => <Node key={n.id} node={n} career={career} />)}</ol>
        : <p className="pg-muted">Tabellen fylls på när de första seriematcherna är spelade. <Link href="/career/schedule">Matchprogrammet →</Link></p>}

      <div className="pg-lanes">
        <div className="pg-lane" style={competitionStyle(key)}>
          <h3><CompetitionMark competition={key} size={20} />{path.leagueName}</h3>
          {path.threats.length ? (
            <ul className="pg-threats" aria-label="Lag inom två poäng">
              {path.threats.map((t) => <li key={t.clubId} data-dir={t.position < (path.position ?? 0) ? "above" : "below"}><span className="pg-num">{svOrdinal(t.position)}</span><Crest id={t.clubId} size={18} /><span>{clubName(t.clubId)}</span><b className="pg-num">{t.gap > 0 ? `+${t.gap}` : t.gap === 0 ? "±0" : t.gap}</b></li>)}
            </ul>
          ) : <p className="pg-muted">Inget lag inom två poäng – {path.position ? `${svOrdinal(path.position)} är er just nu.` : "tabellen har inte börjat."}</p>}
          <small className="pg-muted">Poängskillnad mot er. Lag inom två poäng kan byta plats med er på en omgång.</small>
        </div>
        <div className="pg-lane" style={competitionStyle(route.length ? "SM" : "KVAL")}>
          <h3><CompetitionMark competition={route.length ? "SM" : "KVAL"} size={20} />{route.length ? "SM-slutspel" : "Slutspel och kval"}</h3>
          {route.length && bracket ? (
            <ol className="pg-minibracket">{bracket.rounds.flatMap((r) => r.ties).filter((t) => route.includes(t.key)).map((t) => (
              <li key={t.key} data-ghost={!t.tie}><small>{t.label}{!t.tie ? " · prognos" : ""}</small>
                <span>{t.high ? <><Crest id={t.high.clubId} size={16} />{clubName(t.high.clubId)}</> : "Avgörs senare"}</span>
                <span>{t.low ? <><Crest id={t.low.clubId} size={16} />{clubName(t.low.clubId)}</> : "Avgörs senare"}</span>
              </li>
            ))}</ol>
          ) : <p className="pg-muted">{path.nodes.find((n) => n.label === "Kval") ? "Kvalet avgör vilken serie ni spelar i nästa säsong – se vägen ovan." : "Ni är inte på väg mot slutspel eller kval just nu."}</p>}
        </div>
        <div className="pg-lane" style={competitionStyle("CUP")}>
          <h3><CompetitionMark competition="CUP" size={20} />Svenska cupen</h3>
          {path.cup.length ? <ol className="pg-cup">{path.cup.map((n) => <li key={n.id} data-state={n.state}><b>{n.label}</b><span>{n.opponentId ? clubName(n.opponentId) : n.title}</span><small>{n.detail}</small></li>)}</ol>
            : <p className="pg-muted">{Object.values(career.competitionTies ?? {}).some((t) => t.competitionId === SVENSKA_CUPEN) ? `${clubName(me)} har inga cupmatcher i år.` : "Cupen har inte lottats ännu."}</p>}
        </div>
      </div>
    </section>
  );
}
