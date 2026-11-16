// Arena 231 -- ENT-02 C "Season Cover" / ENT-04 C: a save rendered as the cover of its club's journal.
// Pure and read-only over a stored CareerSave: issue line, last result, table position, next fixture and a
// lead headline built from templates over those facts. Nothing is invented -- every phrase comes from a
// stored fixture/result -- and a save without a career snapshot (schema 1) degrades to a plain cover.
import type { CareerSave } from "../../lib/save/saveRepository";
import type { CareerState } from "../../lib/career/types";
import { getLiveStandings } from "../../lib/career/standings";
import { isoWeek } from "../../lib/career/frontPage";
import { getClub, getCompetition } from "../../lib/game-data";

export type CoverOutcome = "V" | "O" | "F";
export interface CoverResult { fixtureId: string; date: string; opponentId: string; opponent: string; home: boolean; ours: number; theirs: number; outcome: CoverOutcome }
export interface CoverFixture { fixtureId: string; date: string; opponentId: string; opponent: string; home: boolean; daysUntil: number; label: string }
export interface SaveCover {
  saveId: string;
  clubId: string;
  clubName: string;
  clubShortName: string;
  primaryColor: string;
  competitionName: string;
  managerName: string;
  seasonId: string | null;
  gameDate: string;
  week: number;
  issueLine: string;
  position: number | null;
  tableSize: number | null;
  lastResult: CoverResult | null;
  /** Up to five own results, oldest first. */
  recent: CoverResult[];
  nextFixture: CoverFixture | null;
  streak: { outcome: CoverOutcome; count: number } | null;
  seasonComplete: boolean;
  seekingJob: boolean;
  headline: string;
  standfirst: string;
  lastPlayedAt: string;
  hasCareer: boolean;
}

const DAY_MS = 86_400_000;
const COUNT_WORD = ["", "en", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio"];
const count = (n: number) => COUNT_WORD[n] ?? String(n);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
const fixtureLabel = (type: string, round?: number) => (type === "LEAGUE" ? `Omgång ${round ?? ""}`.trim() : type === "CUP" ? "Cupen" : type === "PLAYOFF" ? "Slutspel" : type === "QUALIFIER" ? "Kval" : "Träningsmatch");

function seasonOf(save: CareerSave): string {
  if (save.careerState?.seasonId) return save.careerState.seasonId;
  const y = Number(save.gameDate.slice(0, 4));
  const month = Number(save.gameDate.slice(5, 7));
  const start = month >= 7 ? y : y - 1;
  return `${start}/${String(start + 1).slice(-2)}`;
}

function ownResults(state: CareerState, clubId: string): CoverResult[] {
  const out: CoverResult[] = [];
  for (const f of state.fixtures) {
    if (f.homeClubId !== clubId && f.awayClubId !== clubId) continue;
    const r = state.results[f.id];
    if (!r) continue;
    const home = f.homeClubId === clubId;
    const ours = home ? r.homeGoals : r.awayGoals;
    const theirs = home ? r.awayGoals : r.homeGoals;
    const opponentId = home ? f.awayClubId : f.homeClubId;
    out.push({ fixtureId: f.id, date: f.date, opponentId, opponent: getClub(opponentId)?.shortName ?? opponentId, home, ours, theirs, outcome: ours > theirs ? "V" : ours < theirs ? "F" : "O" });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.fixtureId.localeCompare(b.fixtureId));
}

function streakOf(results: readonly CoverResult[]): SaveCover["streak"] {
  const last = results.at(-1);
  if (!last) return null;
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i]!.outcome === last.outcome; i--) n++;
  return { outcome: last.outcome, count: n };
}

function streakPhrase(s: NonNullable<SaveCover["streak"]>): string {
  if (s.count < 2) return "";
  return s.outcome === "V" ? `${count(s.count)} raka segrar` : s.outcome === "F" ? `${count(s.count)} raka förluster` : `${count(s.count)} raka oavgjorda`;
}

/** Lead headline + standfirst from the facts on the cover; the templates only ever name stored fixtures and results. */
export function coverHeadline(c: Pick<SaveCover, "clubShortName" | "lastResult" | "nextFixture" | "streak" | "position" | "tableSize" | "competitionName" | "seasonComplete" | "seekingJob" | "hasCareer" | "seasonId">): { headline: string; standfirst: string } {
  const club = c.clubShortName;
  if (!c.hasCareer) return { headline: `${club} väntar på sin tränare`, standfirst: "Karriären öppnas där du lämnade den. Säsongens läge visas när den har öppnats en gång." };
  if (c.seekingJob) return { headline: "Utan klubb – telefonen kan ringa när som helst", standfirst: `Du lämnade ${club}. Nästa uppdrag väntar i Karriär.` };
  const table = c.position && c.tableSize ? `${c.position}:a av ${c.tableSize} i ${c.competitionName}` : null;
  if (c.seasonComplete) return { headline: `${c.seasonId ?? "Säsongen"} är i mål för ${club}`, standfirst: table ? `Slutplacering: ${table}. Nästa säsong väntar på dina beslut.` : "Nästa säsong väntar på dina beslut." };
  const n = c.nextFixture;
  const s = c.streak && c.streak.count >= 2 ? streakPhrase(c.streak) : "";
  const r = c.lastResult;
  if (n) {
    const verb = n.home ? `tar emot ${n.opponent}` : `reser till ${n.opponent}`;
    const when = n.daysUntil <= 0 ? " i dag" : n.daysUntil === 1 ? " i morgon" : "";
    const headline = s ? `${club} ${verb}${when} efter ${s}` : r ? `${club} ${verb}${when} efter ${r.outcome === "V" ? "segern" : r.outcome === "F" ? "förlusten" : "kryssen"} mot ${r.opponent}` : `${club} ${verb}${when} – säsongen kan börja`;
    const standfirst = [r ? `Senast: ${r.ours}–${r.theirs} ${r.home ? "hemma" : "borta"} mot ${r.opponent}.` : null, table ? `Läget: ${table}.` : null, `${n.label} ${n.daysUntil <= 0 ? "spelas i dag" : n.daysUntil === 1 ? "spelas i morgon" : `om ${n.daysUntil} dagar`}.`].filter(Boolean).join(" ");
    return { headline, standfirst };
  }
  if (r) return { headline: `${club} ${r.outcome === "V" ? "vann" : r.outcome === "F" ? "föll" : "delade poängen"} mot ${r.opponent}`, standfirst: [`${r.ours}–${r.theirs} ${r.home ? "hemma" : "borta"}.`, table ? `Läget: ${table}.` : null, "Ingen match inplanerad ännu."].filter(Boolean).join(" ") };
  return { headline: `${club} förbereder säsongen`, standfirst: "Ingen match är spelad ännu. Försäsongen pågår." };
}

export function buildSaveCover(save: CareerSave): SaveCover {
  const state = save.careerState;
  const club = getClub(save.clubId);
  const clubId = save.clubId;
  const competitionId = state?.competitionId ?? club?.competitionId ?? "";
  const competitionName = getCompetition(competitionId)?.name ?? "Ligan";
  const gameDate = state?.gameDate ?? save.gameDate;
  const seasonId = state?.seasonId ?? null;
  const seekingJob = !!state?.managerCareer?.seekingJob;
  const results = state && !seekingJob ? ownResults(state, clubId) : [];
  let position: number | null = null;
  let tableSize: number | null = null;
  if (state && !seekingJob) {
    try {
      const table = getLiveStandings(state);
      const idx = table.findIndex((row) => row.clubId === clubId);
      if (idx >= 0 && table.some((row) => row.played > 0)) { position = idx + 1; tableSize = table.length; }
    } catch { /* an older snapshot without a table: the cover simply omits the position */ }
  }
  let nextFixture: CoverFixture | null = null;
  if (state && !seekingJob) {
    const next = state.fixtures
      .filter((f) => (f.homeClubId === clubId || f.awayClubId === clubId) && !state.results[f.id] && f.date >= gameDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
    if (next) {
      const home = next.homeClubId === clubId;
      const opponentId = home ? next.awayClubId : next.homeClubId;
      nextFixture = { fixtureId: next.id, date: next.date, opponentId, opponent: getClub(opponentId)?.shortName ?? opponentId, home, daysUntil: daysBetween(gameDate, next.date), label: fixtureLabel(next.type, next.round) };
    }
  }
  const week = isoWeek(gameDate);
  const season = seasonOf(save);
  const base = {
    saveId: save.saveId, clubId, clubName: club?.name ?? clubId, clubShortName: club?.shortName ?? clubId, primaryColor: club?.primaryColor ?? "",
    competitionName, managerName: save.manager.name, seasonId, gameDate, week,
    issueLine: [`Vecka ${week}`, season, position && tableSize ? `${position}:a i ${competitionName}` : null].filter(Boolean).join(" · "),
    position, tableSize, lastResult: results.at(-1) ?? null, recent: results.slice(-5), nextFixture, streak: streakOf(results),
    seasonComplete: !!state?.seasonComplete, seekingJob, lastPlayedAt: save.lastPlayedAt, hasCareer: !!state,
  };
  return { ...base, ...coverHeadline(base) };
}
