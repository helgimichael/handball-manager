"use client";
// HM-ALPHA3 release readiness: knockout presentation shared by the
// SM-slutspel, kval and Svenska cupen -- a tie card that says who leads,
// who is through and what comes next, and a bracket whose columns are
// joined by connector lines so the path to the final can be followed.
import ClubCrest from "@/components/ClubCrest";
import { formatGameDate } from "@/lib/career/dateUtils";
import type { CareerState } from "@/lib/career/types";
import { tieWins } from "@/lib/competition/season";
import type { CompetitionTie } from "@/lib/competition/types";
import { getClub } from "@/lib/game-data";

export const clubName = (id?: string) => (id ? getClub(id)?.shortName ?? id : "—");

export function Crest({ id, size = 22 }: { id?: string; size?: number }) {
  const c = id ? getClub(id) : undefined;
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={size} /> : <span className="ss-crest-empty" style={{ width: size, height: size }} />;
}

const SHORT_DATE = (iso: string) => formatGameDate(iso).split(" ").slice(0, 3).join(" ");

/** Short bracket names: "KF1", "SF2", "ÅF3" -- used in placeholders ("Vinnare KF1"). */
export function shortTieName(key: string): string {
  if (/^QF\d$/.test(key)) return `KF${key.slice(2)}`;
  if (/^SF\d$/.test(key)) return `SF${key.slice(2)}`;
  if (key.startsWith("R16-")) return `ÅF${key.slice(4)}`;
  if (key.startsWith("CQF-")) return `KF${key.slice(4)}`;
  if (key.startsWith("CSF-")) return `SF${key.slice(4)}`;
  return key;
}

interface Game { id: string; date?: string; home?: string; homeGoals?: number; awayGoals?: number; method?: "OVERTIME" | "SHOOTOUT"; shootout?: { home: number; away: number }; played: boolean }

function tieGames(career: CareerState, tie: CompetitionTie): Game[] {
  return tie.fixtureIds.map((id) => {
    const f = career.fixtures.find((x) => x.id === id);
    const r = career.results[id];
    return { id, date: f?.date, home: f?.homeClubId, homeGoals: r?.homeGoals, awayGoals: r?.awayGoals, method: r?.decider?.method, shootout: r?.decider?.shootout, played: !!r };
  });
}

function goalsFor(g: Game, club: string) {
  return g.home === club ? g.homeGoals ?? 0 : g.awayGoals ?? 0;
}

export interface TieStatus { tone: "done" | "live" | "todo"; text: string }

/** One line that answers "where does this tie stand?" in plain Swedish. */
export function tieStatus(career: CareerState, tie: CompetitionTie): TieStatus {
  const games = tieGames(career, tie);
  const next = games.find((g) => !g.played);
  const nextText = next?.date ? `${tie.format.kind === "SERIES" ? `Match ${games.indexOf(next) + 1}` : tie.format.kind === "TWO_LEGS" ? (games.indexOf(next) === 0 ? "Första mötet" : "Returen") : "Matchen"} ${SHORT_DATE(next.date)} · hemma ${clubName(next.home)}` : "";
  if (tie.winnerClubId) {
    if (tie.stakes) {
      const winnerSide = tie.winnerClubId === tie.highClubId ? tie.stakes.highCompetitionId : tie.stakes.lowCompetitionId;
      const kept = winnerSide === tie.stakes.highCompetitionId;
      return { tone: "done", text: kept ? `${clubName(tie.winnerClubId)} håller kvar platsen` : `${clubName(tie.winnerClubId)} går upp` };
    }
    return { tone: "done", text: tie.feeds ? `${clubName(tie.winnerClubId)} vidare` : `${clubName(tie.winnerClubId)} vinner` };
  }
  if (tie.format.kind === "SERIES") {
    const w = tieWins(career, tie);
    const a = w[tie.highClubId] ?? 0, b = w[tie.lowClubId] ?? 0;
    const need = Math.ceil(tie.format.series.bestOf / 2);
    if (a + b === 0) return { tone: "todo", text: nextText || `Bäst av ${tie.format.series.bestOf}` };
    const lead = a === b ? `Lika ${a}–${b}` : `${clubName(a > b ? tie.highClubId : tie.lowClubId)} leder ${Math.max(a, b)}–${Math.min(a, b)}`;
    const matchBall = Math.max(a, b) === need - 1 && a !== b ? " · matchboll" : "";
    return { tone: "live", text: `${lead}${matchBall}${nextText ? ` · ${nextText}` : ""}` };
  }
  if (tie.format.kind === "TWO_LEGS" && games[0]?.played) {
    const diff = goalsFor(games[0], tie.highClubId) - goalsFor(games[0], tie.lowClubId);
    return { tone: "live", text: `${diff === 0 ? "Lika efter första mötet" : `${clubName(diff > 0 ? tie.highClubId : tie.lowClubId)} leder med ${Math.abs(diff)}`}${nextText ? ` · ${nextText}` : ""}` };
  }
  return { tone: "todo", text: nextText || "Inte spelad" };
}

function GameChip({ game, index, kind, high }: { game: Game; index: number; kind: CompetitionTie["format"]["kind"]; high: string }) {
  const label = kind === "SERIES" ? `M${index + 1}` : kind === "TWO_LEGS" ? (index === 0 ? "1:a" : "2:a") : "";
  if (!game.played) return <li className="ss-game" data-played="false" title={game.date ? `${formatGameDate(game.date)} · hemma ${clubName(game.home)}` : undefined}>{label && <small>{label}</small>}<span>{game.date ? SHORT_DATE(game.date).split(" ").slice(1).join(" ") : "—"}</span></li>;
  // Scores are always shown higher seed first so a series reads in one direction.
  const hi = goalsFor(game, high), lo = game.home === high ? game.awayGoals ?? 0 : game.homeGoals ?? 0;
  const extra = game.method === "SHOOTOUT" ? " str" : game.method === "OVERTIME" ? " fl" : "";
  const title = `${clubName(game.home)} hemma${game.method === "SHOOTOUT" && game.shootout ? ` · straffar ${game.shootout.home}–${game.shootout.away}` : game.method === "OVERTIME" ? " · avgjord i förlängning" : ""}`;
  return <li className="ss-game" data-played="true" data-won={hi > lo || (hi === lo && (game.shootout ? (game.home === high ? game.shootout.home > game.shootout.away : game.shootout.away > game.shootout.home) : false))} title={title}>{label && <small>{label}</small>}<span>{hi}–{lo}{extra && <em>{extra}</em>}</span></li>;
}

export function TieCard({ career, tie, placeholder, size = "md" }: { career: CareerState; tie?: CompetitionTie; placeholder?: [string, string]; size?: "md" | "lg" }) {
  if (!tie) {
    return (
      <article className="ss-tie" data-empty="true" data-size={size}>
        <div className="ss-tie-row" data-pending="true"><span className="ss-crest-empty" /><span>{placeholder?.[0] ?? "Avgörs senare"}</span><b /></div>
        <div className="ss-tie-row" data-pending="true"><span className="ss-crest-empty" /><span>{placeholder?.[1] ?? ""}</span><b /></div>
      </article>
    );
  }
  const wins = tieWins(career, tie);
  const games = tieGames(career, tie);
  const aggregate = (club: string) => games.reduce((s, g) => s + (g.played ? goalsFor(g, club) : 0), 0);
  const score = (club: string) => (tie.format.kind === "SERIES" ? wins[club] ?? 0 : games.some((g) => g.played) ? aggregate(club) : "");
  const own = tie.highClubId === career.playerClubId || tie.lowClubId === career.playerClubId;
  const status = tieStatus(career, tie);
  return (
    <article className="ss-tie" data-size={size} data-own={own} data-decided={!!tie.winnerClubId} aria-label={`${tie.label}: ${clubName(tie.highClubId)} mot ${clubName(tie.lowClubId)}. ${status.text}`}>
      <header><span>{tie.label}</span>{tie.format.kind === "TWO_LEGS" && games.some((g) => g.played) && <small>Totalt</small>}</header>
      {[tie.highClubId, tie.lowClubId].map((club) => (
        <div key={club} className="ss-tie-row" data-winner={tie.winnerClubId ? tie.winnerClubId === club : undefined} data-mine={club === career.playerClubId}>
          <Crest id={club} size={size === "lg" ? 28 : 22} />
          <span>{clubName(club)}</span>
          <b>{score(club)}</b>
        </div>
      ))}
      {tie.format.kind !== "SINGLE" || games.some((g) => g.played) ? <ol className="ss-games" aria-label="Matcher">{games.map((g, i) => <GameChip key={g.id} game={g} index={i} kind={tie.format.kind} high={tie.highClubId} />)}</ol> : null}
      <footer className="ss-tie-status" data-tone={status.tone}>{status.text}</footer>
    </article>
  );
}

/**
 * A bracket: `rounds` lists tie keys per column, feeders in order, so the
 * winners of rounds[r][2j] and rounds[r][2j + 1] meet in rounds[r + 1][j].
 * Ties are paired in the markup; CSS draws the connectors between pairs.
 */
export function BracketGrid({ career, ties, rounds, roundLabels, extra }: { career: CareerState; ties: CompetitionTie[]; rounds: string[][]; roundLabels: string[]; extra?: { label: string; key: string } }) {
  const byKey = (key: string) => ties.find((t) => t.key === key);
  const placeholderFor = (r: number, j: number): [string, string] | undefined => {
    if (r === 0) return undefined;
    const feeders = [rounds[r - 1]![2 * j]!, rounds[r - 1]![2 * j + 1]!];
    return feeders.map((k) => { const t = byKey(k); return t?.winnerClubId ? clubName(t.winnerClubId) : `Vinnare ${shortTieName(k)}`; }) as [string, string];
  };
  return (
    <div className="ss-bracket-scroll">
      <div className="ss-bracket" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(232px, 1fr))` }}>
        {rounds.map((keys, r) => {
          const last = r === rounds.length - 1;
          const pairs = last ? [keys] : keys.reduce<string[][]>((acc, k, i) => (i % 2 ? (acc.at(-1)!.push(k), acc) : [...acc, [k]]), []);
          return (
            <div key={r} className="ss-round" data-first={r === 0} data-last={last}>
              <h3 className="ss-round-label">{roundLabels[r]}</h3>
              <div className="ss-round-body">
                {pairs.map((pair, p) => (
                  <div key={p} className="ss-pair" data-single={pair.length === 1}>
                    {pair.map((k, i) => <div key={k} className="ss-slot" data-advanced={!!byKey(k)?.winnerClubId}><TieCard career={career} tie={byKey(k)} placeholder={placeholderFor(r, last ? 0 : p * 2 + i)} size={last ? "lg" : "md"} /></div>)}
                  </div>
                ))}
                {last && extra && <div className="ss-extra"><span className="ss-round-label">{extra.label}</span><TieCard career={career} tie={byKey(extra.key)} placeholder={["Förlorare SF1", "Förlorare SF2"]} /></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
