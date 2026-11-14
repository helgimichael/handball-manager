// Arena Nights Phase 2 -- matchday presentation models (MDY-01 C three-step ritual, MDY-01e court line-up,
// ANL-01 report navigation). Pure, read-only: they arrange existing match-plan, readiness, status and
// archive data. No match logic, tactical calculation, rating or result is touched.
import type { CareerFixture, CareerState } from "../career/types";
import type { MatchPlan } from "../matchPlan/types";
import type { PlayerMock } from "../game-data";
import { getClub } from "../game-data";
import { isSelectableForMatch } from "../career/playerStatus";
import { readinessSummary } from "../training/readinessSummary";
import { careerArchiveSummaries } from "../career/matchArchiveSummary";
import { currentTeamRoles } from "../career/teamRoles";

export type AttentionTone = "block" | "warn" | "ok";
export interface AttentionItem { id: string; tone: AttentionTone; text: string; href?: string; cta?: string }

/** MDY-01 step 1 "Före avkast": everything that needs the manager before kick-off, blocking first. */
export function preMatchAttention(state: CareerState, input: { lineupErrors: readonly string[]; blocking: readonly { code: string; text: string }[]; warnings: readonly { code: string; text: string }[]; plan: MatchPlan | undefined; lowReadiness: number; unavailable: number }): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const e of input.lineupErrors) out.push({ id: `lineup:${e}`, tone: "block", text: e, href: "/career/tactics", cta: "Taktik" });
  for (const b of input.blocking) out.push({ id: `block:${b.code}`, tone: "block", text: b.text, href: "/career/tactics", cta: "Matchtrupp" });
  if (!input.plan) out.push({ id: "no-plan", tone: "block", text: "Ingen matchtrupp eller startsju vald.", href: "/career/tactics", cta: "Välj startsju" });
  for (const w of input.warnings) out.push({ id: `warn:${w.code}`, tone: "warn", text: w.text, href: "/career/tactics", cta: "Matchtrupp" });
  for (const e of state.careerEvents.filter((ev) => ev.requiresAction && !ev.resolved && !ev.id.startsWith("MATCHDAY_READY:"))) out.push({ id: `event:${e.id}`, tone: "warn", text: e.subject, href: "/career/inbox", cta: "Hantera" });
  if (input.lowReadiness) out.push({ id: "readiness", tone: "warn", text: `${input.lowReadiness} uttagna spelare har lägre beredskap.`, href: "/career/medical", cta: "Medicinskt" });
  const roles = currentTeamRoles(state);
  if (!roles.captainId) out.push({ id: "captain", tone: "warn", text: "Ingen lagkapten utsedd.", href: "/career/squad", cta: "Truppen" });
  if (!roles.penaltyTakers.length) out.push({ id: "penalty", tone: "warn", text: "Ingen 7-metersskytt vald.", href: "/career/tactics", cta: "Taktik" });
  if (input.unavailable) out.push({ id: "unavailable", tone: "ok", text: `${input.unavailable} spelare otillgängliga (skada, avstängning eller landslag).` });
  if (!out.some((i) => i.tone !== "ok")) out.unshift({ id: "ready", tone: "ok", text: "Laget är klart för avkast." });
  return out;
}

export type PositionGroup = "MV" | "KANT" | "BACK" | "MITT" | "LINJE";
export const POSITION_GROUP_LABEL: Record<PositionGroup, string> = { MV: "Målvakter", KANT: "Kanter", BACK: "Backar", MITT: "Mittnior", LINJE: "Linje" };
export function positionGroup(position: string): PositionGroup {
  if (position === "GK" || position === "MV") return "MV";
  if (position === "V6" || position === "H6") return "KANT";
  if (position === "V9" || position === "H9") return "BACK";
  if (position === "M9") return "MITT";
  return "LINJE";
}

export interface LineupSpot { slot: string; label: string; playerId?: string; name?: string; shirt?: number | null; readiness?: number; available?: boolean; captain: boolean; penalty: boolean }
export interface BenchPlayer { playerId: string; name: string; shirt: number | null; position: string; group: PositionGroup; readiness: number; available: boolean }

/** MDY-01e: the starting seven on court coordinates (attack shape) and the bench grouped by position. */
export function lineupBoard(state: CareerState, plan: MatchPlan | undefined, squad: readonly PlayerMock[]): { spots: LineupSpot[]; bench: BenchPlayer[] } {
  const roles = currentTeamRoles(state);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const slots = ["V6", "V9", "M9", "H9", "H6", "M6", "GK"];
  const label = (s: string) => (s === "GK" ? "MV" : s);
  const spot = (slot: string): LineupSpot => {
    const pid = plan?.attackStartingUnit.slots.find((x) => x.position === slot)?.playerId;
    const p = pid ? byId.get(pid) : undefined;
    return { slot, label: label(slot), playerId: pid, name: p ? `${p.firstName[0]}. ${p.lastName}` : undefined, shirt: p?.shirtNumber ?? null, readiness: p ? Math.round(readinessSummary(state, p.id).readiness) : undefined, available: p ? isSelectableForMatch(state.playerStatuses, p.id) : undefined, captain: !!pid && roles.captainId === pid, penalty: !!pid && roles.penaltyTakers[0] === pid };
  };
  const starters = new Set((plan?.attackStartingUnit.slots ?? []).map((s) => s.playerId));
  const bench = (plan?.squad.players ?? []).filter((sp) => !starters.has(sp.playerId)).map((sp) => {
    const p = byId.get(sp.playerId);
    return { playerId: sp.playerId, name: p ? `${p.firstName[0]}. ${p.lastName}` : sp.playerId, shirt: p?.shirtNumber ?? null, position: label(sp.position), group: positionGroup(sp.position), readiness: Math.round(readinessSummary(state, sp.playerId).readiness), available: isSelectableForMatch(state.playerStatuses, sp.playerId) };
  }).sort((a, b) => ["MV", "KANT", "BACK", "MITT", "LINJE"].indexOf(a.group) - ["MV", "KANT", "BACK", "MITT", "LINJE"].indexOf(b.group) || a.name.localeCompare(b.name, "sv"));
  return { spots: slots.map(spot), bench };
}

// ---------------------------------------------------------------- history: head-to-head and own-match navigation
export interface PlayedMatch { fixtureId: string; date: string; homeClubId: string; awayClubId: string; homeGoals: number; awayGoals: number; competitionId: string; type: string }

/** Every played fixture the career still holds (current season, archive summaries, past seasons). Deduplicated by fixture id. */
export function playedMatches(state: CareerState): PlayedMatch[] {
  const out = new Map<string, PlayedMatch>();
  const add = (f: CareerFixture, r: { homeGoals: number; awayGoals: number } | undefined) => { if (r && !out.has(f.id)) out.set(f.id, { fixtureId: f.id, date: f.date, homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: r.homeGoals, awayGoals: r.awayGoals, competitionId: f.competitionId, type: f.type }); };
  for (const f of state.fixtures) add(f, state.results[f.id]);
  for (const a of Object.values(careerArchiveSummaries(state))) add(a.fixture, a.result);
  for (const s of state.seasonHistory ?? []) for (const f of s.fixtures ?? []) add(f, s.results?.[f.id]);
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date) || a.fixtureId.localeCompare(b.fixtureId));
}

export function headToHead(state: CareerState, a: string, b: string, exclude?: string, limit = 6): PlayedMatch[] {
  return playedMatches(state).filter((m) => m.fixtureId !== exclude && ((m.homeClubId === a && m.awayClubId === b) || (m.homeClubId === b && m.awayClubId === a))).slice(0, limit);
}

/** Previous / next played match of a club around a fixture (for report-to-report navigation). */
export function clubMatchNeighbours(state: CareerState, clubId: string, fixtureId: string): { previous?: PlayedMatch; next?: PlayedMatch } {
  const own = playedMatches(state).filter((m) => m.homeClubId === clubId || m.awayClubId === clubId).reverse();
  const i = own.findIndex((m) => m.fixtureId === fixtureId);
  if (i < 0) return {};
  return { previous: own[i - 1], next: own[i + 1] };
}

export const clubShort = (id: string) => getClub(id)?.shortName ?? id;
