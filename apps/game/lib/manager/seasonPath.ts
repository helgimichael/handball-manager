// Arena Nights MGR-03 B "Path to Gold" and MGR-03a A "Ghost Bracket": the
// manager's projected route through the Swedish season. Everything here is a
// read-only projection from the live table and the verified pairings in
// lib/competition/rules.ts (SM_SLUTSPEL_RULES, KVAL_HBL_RULES, ALLSVENSKAN_RULES);
// real ties replace the projection as soon as they exist. No rule is changed.
import type { StandingRow } from "@handball-manager/game-simulation";
import { ALLSVENSKAN, ALLSVENSKAN_RULES, HANDBOLLSLIGAN, KVAL_ALLSVENSKAN, KVAL_HBL, KVAL_HBL_RULES, SM_SLUTSPEL, SM_SLUTSPEL_RULES, SVENSKA_CUPEN } from "../competition/rules";
import { zoneFor, type Zone } from "../competition/standingsZones";
import type { CompetitionTie, SeasonPhase } from "../competition/types";
import { svOrdinal } from "../format/ordinal";

export type PathNodeState = "now" | "projected" | "live" | "won" | "lost" | "goal";

export interface PathNode {
  id: string;
  /** Short node label: "5:a", "KF", "SF", "Final". */
  label: string;
  title: string;
  /** What it takes / what it means, in plain Swedish. */
  detail: string;
  state: PathNodeState;
  opponentId?: string;
  tieId?: string;
}

export interface Threat {
  clubId: string;
  position: number;
  points: number;
  /** Their points minus yours. */
  gap: number;
}

export interface GhostTie {
  key: string;
  label: string;
  high: { clubId: string; seed: number } | null;
  low: { clubId: string; seed: number } | null;
  /** The real tie when it exists. */
  tie?: CompetitionTie;
  mine: boolean;
}

export interface GhostBracket {
  /** True while every quarter-final is projected from the live table. */
  hypothetical: boolean;
  rounds: { label: string; ties: GhostTie[] }[];
  /** Keys on the manager's route (QF -> SF -> F); empty when outside the top eight. */
  myPath: string[];
}

export interface SeasonPathInput {
  me: string;
  competitionId: string;
  phase: SeasonPhase | undefined;
  /** Live tables by competition id (HBL, Allsvenskan when simulated). */
  tables: Readonly<Record<string, readonly StandingRow[]>>;
  ties: readonly CompetitionTie[];
}

export interface SeasonPath {
  leagueName: string;
  position: number | null;
  points: number | null;
  zone: Zone | null;
  hypothetical: boolean;
  /** Main route: league position -> playoff/kval -> goal. */
  nodes: PathNode[];
  /** Svenska cupen as a parallel lane (real ties only). */
  cup: PathNode[];
  /** Clubs within two points of the manager's club. */
  threats: Threat[];
  /** One sentence about the next step on the route. */
  headline: string;
}

export const LEAGUE_LABEL = (id: string) => (id === HANDBOLLSLIGAN ? "Handbollsligan" : id === ALLSVENSKAN ? "Allsvenskan" : "Division 1");

const QF_KEYS = SM_SLUTSPEL_RULES.quarterFinals.map((_, i) => `QF${i + 1}`);
const SF_KEYS = SM_SLUTSPEL_RULES.semiFinals.map((_, i) => `SF${i + 1}`);

/** The SM-slutspel bracket: real ties where they exist, otherwise QF pairings projected from the live HBL table (THB §2:1-2:3, fixed bracket). */
export function ghostBracket(input: Pick<SeasonPathInput, "me" | "tables" | "ties">): GhostBracket | null {
  const hbl = input.tables[HANDBOLLSLIGAN];
  const sm = input.ties.filter((t) => t.competitionId === SM_SLUTSPEL);
  if (!sm.length && (!hbl || hbl.length < SM_SLUTSPEL_RULES.qualifiers)) return null;
  const real = (key: string) => sm.find((t) => t.key === key);
  const seed = (clubId: string | undefined) => (clubId && hbl ? hbl.findIndex((r) => r.clubId === clubId) + 1 || 0 : 0);
  const qf: GhostTie[] = SM_SLUTSPEL_RULES.quarterFinals.map(([h, l], i) => {
    const key = QF_KEYS[i]!;
    const tie = real(key);
    const highId = tie?.highClubId ?? hbl?.[h - 1]?.clubId;
    const lowId = tie?.lowClubId ?? hbl?.[l - 1]?.clubId;
    return { key, label: `Kvartsfinal ${i + 1}`, high: highId ? { clubId: highId, seed: tie ? seed(highId) || h : h } : null, low: lowId ? { clubId: lowId, seed: tie ? seed(lowId) || l : l } : null, tie, mine: highId === input.me || lowId === input.me };
  });
  const later = (key: string, label: string, feeders: GhostTie[]): GhostTie => {
    const tie = real(key);
    const side = (f: GhostTie | undefined) => {
      const id = f?.tie?.winnerClubId;
      return id ? { clubId: id, seed: seed(id) } : null;
    };
    const high = tie ? { clubId: tie.highClubId, seed: seed(tie.highClubId) } : side(feeders[0]);
    const low = tie ? { clubId: tie.lowClubId, seed: seed(tie.lowClubId) } : side(feeders[1]);
    const mineByFeed = feeders.some((f) => f.mine && (!f.tie?.winnerClubId || f.tie.winnerClubId === input.me));
    return { key, label, high, low, tie, mine: tie ? tie.highClubId === input.me || tie.lowClubId === input.me : mineByFeed };
  };
  const sf = SM_SLUTSPEL_RULES.semiFinals.map(([a, b], i) => later(SF_KEYS[i]!, `Semifinal ${i + 1}`, [qf[a]!, qf[b]!]));
  const final = later("F", "Final", sf);
  const myPath = [...qf, ...sf, final].filter((t) => t.mine).map((t) => t.key);
  return {
    hypothetical: qf.every((t) => !t.tie),
    rounds: [{ label: "Kvartsfinal", ties: qf }, { label: "Semifinal", ties: sf }, { label: "Final", ties: [final] }],
    myPath,
  };
}

function pointsNeeded(table: readonly StandingRow[], myIndex: number, targetPos: number): number {
  const target = table[targetPos - 1];
  const mine = table[myIndex];
  if (!target || !mine) return 0;
  return Math.max(0, target.points - mine.points + 1);
}

function realNode(tie: CompetitionTie, me: string, title: string): PathNode {
  const opponentId = tie.highClubId === me ? tie.lowClubId : tie.highClubId;
  const state: PathNodeState = tie.winnerClubId ? (tie.winnerClubId === me ? "won" : "lost") : "live";
  return { id: tie.id, label: title, title: tie.label, detail: tie.winnerClubId ? (tie.winnerClubId === me ? "Vunnet möte" : "Utslagna") : "Pågår", state, opponentId, tieId: tie.id };
}

export function buildSeasonPath(input: SeasonPathInput): SeasonPath {
  const { me, competitionId, ties } = input;
  const table = input.tables[competitionId] ?? [];
  const idx = table.findIndex((r) => r.clubId === me);
  const position = idx >= 0 ? idx + 1 : null;
  const row = idx >= 0 ? table[idx]! : null;
  const zone = position ? zoneFor(competitionId, position) : null;
  const regular = input.phase !== "POSTSEASON" && input.phase !== "COMPLETE";
  const threats: Threat[] = row ? table.map((r, i) => ({ clubId: r.clubId, position: i + 1, points: r.points, gap: r.points - row.points })).filter((t) => t.clubId !== me && Math.abs(t.gap) <= 2) : [];
  const nodes: PathNode[] = [];
  const leagueName = LEAGUE_LABEL(competitionId);
  let headline = "";

  if (position && row) {
    nodes.push({ id: "league", label: svOrdinal(position), title: `${svOrdinal(position)} i ${leagueName}`, detail: regular ? `${row.points} poäng på ${row.played} matcher` : "Grundserien är spelad", state: "now" });
  }

  const mineTies = ties.filter((t) => t.competitionId !== SVENSKA_CUPEN && (t.highClubId === me || t.lowClubId === me)).sort((a, b) => a.key.localeCompare(b.key));
  const hypothetical = regular && mineTies.length === 0;

  if (competitionId === HANDBOLLSLIGAN && position) {
    const bracket = ghostBracket(input);
    if (position <= SM_SLUTSPEL_RULES.qualifiers || mineTies.some((t) => t.competitionId === SM_SLUTSPEL)) {
      for (const key of [...QF_KEYS, ...SF_KEYS, "F"]) {
        const ghost = bracket?.rounds.flatMap((r) => r.ties).find((t) => t.key === key);
        if (!ghost?.mine) continue;
        const short = key.startsWith("QF") ? "KF" : key.startsWith("SF") ? "SF" : "Final";
        if (ghost.tie) { nodes.push(realNode(ghost.tie, me, short)); continue; }
        const opp = ghost.high?.clubId === me ? ghost.low : ghost.high;
        const isHigh = ghost.high?.clubId === me;
        nodes.push({ id: key, label: short, title: ghost.label, detail: key.startsWith("QF") && opp ? `Mot ${svOrdinal(opp.seed)} · ${isHigh ? "hemmafördel (match 1, 3, 5)" : "borta i match 1"}` : key === "F" ? "Vinnaren blir svenska mästare" : "Mot vinnaren av andra kvartsfinalen", state: "projected", opponentId: opp?.clubId });
      }
      nodes.push({ id: "gold", label: "Guld", title: "Svenska mästare", detail: "Bäst av fem i varje omgång", state: mineTies.some((t) => t.key === "F" && t.winnerClubId === me) ? "won" : "goal" });
      if (regular) {
        const homeEdge = position > 4 ? `${pointsNeeded(table, idx, 4)} poäng till 4:e plats = hemmafördel i kvartsfinalen` : `${row!.points - (table[4]?.points ?? 0)} poäng ner till 5:e plats (hemmafördelen)`;
        const out = `${row!.points - (table[SM_SLUTSPEL_RULES.qualifiers]?.points ?? 0)} poäng ner till plats 9, utanför slutspel`;
        headline = `${homeEdge}. ${out}.`;
      }
    } else if (KVAL_HBL_RULES.pairs.some(([h]) => h === position) || mineTies.some((t) => t.competitionId === KVAL_HBL)) {
      const real = mineTies.find((t) => t.competitionId === KVAL_HBL);
      if (real) nodes.push(realNode(real, me, "Kval"));
      else {
        const pair = KVAL_HBL_RULES.pairs.find(([h]) => h === position)!;
        const opp = input.tables[ALLSVENSKAN]?.[pair[1] - 1];
        nodes.push({ id: "kval", label: "Kval", title: "Kval om Handbollsligan", detail: `Mot ${svOrdinal(pair[1])} i Allsvenskan · bäst av fem, ni börjar borta`, state: "projected", opponentId: opp?.clubId });
      }
      nodes.push({ id: "stay", label: "Kvar", title: `Kvar i Handbollsligan`, detail: "Vinn kvalet för att behålla platsen", state: real?.winnerClubId === me ? "won" : real?.winnerClubId ? "lost" : "goal" });
      if (regular) headline = `${pointsNeeded(table, idx, 10)} poäng upp till plats 10 och säker mark. ${row!.points - (table[KVAL_HBL_RULES.directRelegation[0]! - 1]?.points ?? 0)} poäng ner till direkt nedflyttning.`;
    } else if ((KVAL_HBL_RULES.directRelegation as readonly number[]).includes(position)) {
      nodes.push({ id: "down", label: "Ned", title: "Direkt nedflyttning", detail: "Sista platsen åker direkt ur", state: "projected" });
      if (regular) headline = `${pointsNeeded(table, idx, 13)} poäng upp till kvalplats (13).`;
    } else {
      nodes.push({ id: "mid", label: "Mitten", title: "Utanför slutspel", detail: `${pointsNeeded(table, idx, 8)} poäng upp till 8:e plats och SM-slutspel`, state: "projected" });
      if (regular) headline = `${pointsNeeded(table, idx, 8)} poäng upp till SM-slutspel. ${row!.points - (table[10]?.points ?? 0)} poäng ner till kvalplats (11).`;
    }
  } else if (competitionId === ALLSVENSKAN && position) {
    if (ALLSVENSKAN_RULES.directPromotion.includes(position)) {
      nodes.push({ id: "up", label: "Upp", title: "Direkt till Handbollsligan", detail: "Seriesegraren går direkt upp", state: input.phase === "COMPLETE" ? "won" : "goal" });
      if (regular) headline = `${row!.points - (table[1]?.points ?? 0)} poäng före tvåan. Ettan går direkt upp.`;
    } else if (ALLSVENSKAN_RULES.toHblKval.includes(position) || mineTies.some((t) => t.competitionId === KVAL_HBL)) {
      const real = mineTies.find((t) => t.competitionId === KVAL_HBL);
      if (real) nodes.push(realNode(real, me, "Kval"));
      else {
        const pair = KVAL_HBL_RULES.pairs.find(([, a]) => a === position);
        const opp = pair ? input.tables[HANDBOLLSLIGAN]?.[pair[0] - 1] : undefined;
        nodes.push({ id: "kval", label: "Kval", title: "Kval till Handbollsligan", detail: pair ? `Mot ${svOrdinal(pair[0])} i Handbollsligan · bäst av fem, ni börjar hemma` : "Bäst av fem", state: "projected", opponentId: opp?.clubId });
      }
      nodes.push({ id: "up", label: "Upp", title: "Handbollsligan", detail: "Vinn kvalet och gå upp", state: real?.winnerClubId === me ? "won" : real?.winnerClubId ? "lost" : "goal" });
      if (regular) headline = `${pointsNeeded(table, idx, 1)} poäng upp till direkt uppflyttning. ${row!.points - (table[4]?.points ?? 0)} poäng ner till plats 5, utanför kval.`;
    } else if (ALLSVENSKAN_RULES.relegationKval.includes(position) || mineTies.some((t) => t.competitionId === KVAL_ALLSVENSKAN)) {
      const real = mineTies.find((t) => t.competitionId === KVAL_ALLSVENSKAN);
      if (real) nodes.push(realNode(real, me, "Kval"));
      else nodes.push({ id: "kval", label: "Kval", title: "Kval för att stanna", detail: "Bäst av tre mot ett lag från Division 1, ni börjar borta", state: "projected" });
      nodes.push({ id: "stay", label: "Kvar", title: "Kvar i Allsvenskan", detail: "Vinn kvalet för att behålla platsen", state: real?.winnerClubId === me ? "won" : real?.winnerClubId ? "lost" : "goal" });
      if (regular) headline = `${pointsNeeded(table, idx, 10)} poäng upp till plats 10 och säker mark.`;
    } else if (ALLSVENSKAN_RULES.directRelegation.includes(position)) {
      nodes.push({ id: "down", label: "Ned", title: "Direkt nedflyttning", detail: "Plats 13 och 14 åker direkt ur", state: "projected" });
      if (regular) headline = `${pointsNeeded(table, idx, 12)} poäng upp till kvalplats (12).`;
    } else {
      nodes.push({ id: "mid", label: "Mitten", title: "Mittfältet", detail: `${pointsNeeded(table, idx, 4)} poäng upp till kvalplats (4)`, state: "projected" });
      if (regular) headline = `${pointsNeeded(table, idx, 4)} poäng upp till kval mot Handbollsligan. ${row!.points - (table[10]?.points ?? 0)} poäng ner till kvalplats (11).`;
    }
  } else if (position) {
    headline = `${svOrdinal(position)} i ${leagueName}. Upp- och nedflyttning avgörs vid säsongsskiftet.`;
  }

  if (!headline && !regular) {
    const open = mineTies.find((t) => !t.winnerClubId);
    const lost = mineTies.find((t) => t.loserClubId === me);
    headline = open ? `${open.label} pågår.` : lost ? `Utslagna i ${lost.label.toLowerCase()}.` : "Säsongen är avgjord för er del.";
  }

  // Svenska cupen: real ties only, in round order.
  const cupTies = ties.filter((t) => t.competitionId === SVENSKA_CUPEN && (t.highClubId === me || t.lowClubId === me || t.clubIds?.includes(me)));
  const order = (t: CompetitionTie) => (t.stage === "CUP_GROUP" ? 0 : t.key.startsWith("R32") ? 1 : t.key.startsWith("R16") ? 2 : t.key.startsWith("CQF") ? 3 : t.key.startsWith("CSF") ? 4 : t.key === "C3" ? 5 : 6);
  const cup: PathNode[] = cupTies.sort((a, b) => order(a) - order(b)).map((t) => {
    if (t.stage === "CUP_GROUP") {
      const through = cupTies.some((x) => x.stage !== "CUP_GROUP");
      const knockoutDrawn = ties.some((x) => x.competitionId === SVENSKA_CUPEN && x.key.startsWith("R16"));
      return { id: t.id, label: "Grupp", title: t.label, detail: through ? "Vidare från gruppen" : knockoutDrawn ? "Utslagna i gruppspelet" : "Topp två går vidare", state: through ? "won" : knockoutDrawn ? "lost" : "live", tieId: t.id };
    }
    return realNode(t, me, order(t) === 6 ? "Final" : order(t) === 4 ? "SF" : order(t) === 3 ? "KF" : order(t) === 2 ? "ÅF" : "R");
  });

  return { leagueName, position, points: row?.points ?? null, zone, hypothetical, nodes, cup, threats, headline };
}
