// Arena Nights Phase 2 -- SQD-02 (C) "Feature Profile + Peek": the player dossier model.
// Pure and read-only over stored career state. Nothing is invented: every figure comes from an
// existing record (ratings, development history, match archive, contracts, dynamics, club history).
// Rating-derived content (strengths/weaknesses, family profile) is ONLY produced for the manager's
// own players -- external players keep the knowledge-gated scouting views (HM-DATA-ALLSVENSKAN-1.1B Part 12).
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { playerMatchHistory, squadEnergy } from "../career/management";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { emptyPlayerSeasonStats, averageRating } from "../career/types";
import { abilityStarsFromCA, potentialStarsFromPA } from "../development/types";
import { OUTCOURT_ATTRIBUTE_FAMILIES, GOALKEEPER_ATTRIBUTE_FAMILIES } from "../rating/types";
import { getAttributeFamilyLabel, getAttributeLabel } from "../rating/attributeVocabulary";
import { getPlayerContractStatus } from "../economy/contractIntegration";
import { matchFitnessOf } from "./matchFitness";
import { moraleOf } from "./morale";
import { readinessSummary } from "../training/readinessSummary";
import { currentTeamRoles } from "../career/teamRoles";
import { isSelectableForMatch } from "../career/playerStatus";
import { getClub } from "../game-data";

const DAY_MS = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const name = (id: string | undefined) => (id ? getClub(id)?.shortName ?? id : "—");

export interface DossierAttribute { key: string; label: string; value: number; family: string }
export interface DossierFamily { key: string; label: string; avg: number }
export interface DossierMatch {
  fixtureId: string; date: string; competitionId: string; type: string;
  opponent: string; home: boolean; score: string; outcome: "W" | "D" | "L";
  started: boolean; minutes: number | null; goals: number; shots: number; saves: number | null; shotsFaced: number | null; rating: number;
}
export interface DossierDevelopmentPoint { date: string; attribute: string; label: string; from: number; to: number; source: string }
export interface DossierProgression { attribute: string; label: string; first: number; last: number; changes: number }
export interface DossierCareerEvent { date: string | null; kind: "CLUB" | "TRANSFER" | "LOAN" | "CONTRACT" | "SEASON" | "DEPARTURE"; title: string; detail: string; href?: string }
export interface DossierRisk { tone: "neg" | "warn" | "info"; text: string }

export interface PlayerDossier {
  own: boolean;
  rating: { current: number; potential: number } | null;
  families: DossierFamily[];
  strengths: DossierAttribute[];
  weaknesses: DossierAttribute[];
  season: { appearances: number; starts: number; goals: number; shots: number; saves: number; shotsFaced: number; avgRating: number | null; minutes: number; matchesInArchive: number };
  matches: DossierMatch[];
  readiness: { energy: number; fitness: number; morale: number; available: boolean; outlook: string; reasons: string[]; weekLoad: number | null } | null;
  development: { focus: string | null; points: DossierDevelopmentPoint[]; progression: DossierProgression[]; sources: { training: number; match: number; other: number } };
  milestones: { date: string; text: string; href?: string }[];
  career: DossierCareerEvent[];
  contract: { clubId: string | null; endDate: string | null; daysLeft: number | null; wage: number | null; status: string | null; role: string | null; renewal: string | null; listed: boolean; request: boolean; offers: number; preContract: string | null; risks: DossierRisk[] } | null;
  roles: { captain: boolean; vice: boolean; penalty: number | null };
}

export function buildPlayerDossier(state: CareerState, playerId: string): PlayerDossier | undefined {
  const player = getCareerPlayer(state, playerId);
  if (!player) return undefined;
  const own = player.clubId === state.playerClubId;
  const stats = state.playerSeasonStats[playerId] ?? emptyPlayerSeasonStats(playerId);
  const rating = own ? getCareerPlayerRating(state, playerId, player.clubId) : undefined;

  // --- rating-derived (own players only)
  const families: DossierFamily[] = [];
  let strengths: DossierAttribute[] = [], weaknesses: DossierAttribute[] = [];
  if (rating) {
    const attrs = rating.branch.attributes as Record<string, { value: number }>;
    const fam = (rating.branch.branch === "GOALKEEPER" ? GOALKEEPER_ATTRIBUTE_FAMILIES : OUTCOURT_ATTRIBUTE_FAMILIES) as Record<string, readonly string[]>;
    const all: DossierAttribute[] = [];
    for (const [key, list] of Object.entries(fam)) {
      const vals = list.map((a) => attrs[a]?.value).filter((v): v is number => typeof v === "number");
      families.push({ key, label: getAttributeFamilyLabel(key as never), avg: vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : 0 });
      for (const a of list) if (typeof attrs[a]?.value === "number") all.push({ key: a, label: getAttributeLabel(a), value: attrs[a]!.value, family: key });
    }
    const sorted = [...all].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "sv"));
    strengths = sorted.slice(0, 5);
    weaknesses = sorted.slice(-3).reverse();
  }

  // --- match archive
  const history = playerMatchHistory(state, playerId);
  const matches: DossierMatch[] = history.slice(0, 15).map((m) => {
    // The side he actually played for (stays true after a transfer).
    const home = m.result.homePlayerContributions.some((p) => p.playerId === playerId);
    const ours = home ? m.result.homeGoals : m.result.awayGoals, theirs = home ? m.result.awayGoals : m.result.homeGoals;
    return {
      fixtureId: m.fixture.id, date: m.fixture.date, competitionId: m.fixture.competitionId, type: m.fixture.type,
      opponent: name(home ? m.fixture.awayClubId : m.fixture.homeClubId), home, score: `${m.result.homeGoals}–${m.result.awayGoals}`,
      outcome: ours > theirs ? "W" : ours < theirs ? "L" : "D",
      started: m.performance.started, minutes: m.load ? Math.round(m.load.minutes) : null,
      goals: m.performance.goals, shots: m.performance.shots, saves: m.performance.shotsFaced ? m.performance.saves ?? 0 : null, shotsFaced: m.performance.shotsFaced ?? null,
      rating: Math.round(m.performance.rating * 10) / 10,
    };
  });
  const thisSeason = new Set(state.fixtures.map((f) => f.id));
  const minutes = history.filter((m) => thisSeason.has(m.fixture.id)).reduce((s, m) => s + (m.load?.minutes ?? 0), 0);

  // --- readiness (own players)
  const readiness = own ? (() => {
    const r = readinessSummary(state, playerId);
    return { energy: Math.round(squadEnergy(state, player)), fitness: Math.round(matchFitnessOf(state, playerId)), morale: moraleOf(state, playerId), available: isSelectableForMatch(state.playerStatuses, playerId), outlook: r.outlook, reasons: r.reasons, weekLoad: r.week.complete ? Math.round(r.week.total) : null };
  })() : null;

  // --- development (stored, bounded history; most-recent-first in storage)
  const dev = state.playerDevelopmentState[playerId];
  const events = [...(dev?.developmentHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const points = events.map((e) => ({ date: e.date, attribute: e.attribute, label: getAttributeLabel(e.attribute), from: e.previousValue, to: e.newValue, source: e.sourceSummary }));
  const prog = new Map<string, DossierProgression>();
  for (const p of points) {
    const cur = prog.get(p.attribute);
    if (cur) { cur.last = p.to; cur.changes++; } else prog.set(p.attribute, { attribute: p.attribute, label: p.label, first: p.from, last: p.to, changes: 1 });
  }
  const sources = { training: 0, match: 0, other: 0 };
  for (const p of points) {
    if (/training|träning/i.test(p.source)) sources.training++;
    else if (/match/i.test(p.source)) sources.match++;
    else sources.other++;
  }

  // --- milestones from the archive (honest: only what the archive holds)
  const milestones: PlayerDossier["milestones"] = [];
  const asc = [...history].sort((a, b) => a.fixture.date.localeCompare(b.fixture.date));
  if (asc[0]) milestones.push({ date: asc[0].fixture.date, text: `Första matchen i matcharkivet (mot ${name(asc[0].fixture.homeClubId === player.clubId ? asc[0].fixture.awayClubId : asc[0].fixture.homeClubId)})`, href: `/career/match-report/${encodeURIComponent(asc[0].fixture.id)}` });
  const firstGoal = asc.find((m) => m.performance.goals > 0);
  if (firstGoal) milestones.push({ date: firstGoal.fixture.date, text: `Första målet i matcharkivet (${firstGoal.performance.goals} mål)`, href: `/career/match-report/${encodeURIComponent(firstGoal.fixture.id)}` });
  const best = [...history].sort((a, b) => b.performance.rating - a.performance.rating)[0];
  if (best && history.length > 1) milestones.push({ date: best.fixture.date, text: `Bästa betyg: ${best.performance.rating.toFixed(1)}`, href: `/career/match-report/${encodeURIComponent(best.fixture.id)}` });
  const bigImprove = [...prog.values()].sort((a, b) => b.last - b.first - (a.last - a.first))[0];
  if (bigImprove && bigImprove.last > bigImprove.first) milestones.push({ date: points.filter((p) => p.attribute === bigImprove.attribute).at(-1)!.date, text: `Största utvecklingen: ${bigImprove.label} ${bigImprove.first} → ${bigImprove.last}` });
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  // --- career timeline
  const career: DossierCareerEvent[] = [];
  for (const e of state.playerClubHistory[playerId]?.entries ?? []) career.push({ date: null, kind: "CLUB", title: getClub(e.clubId)?.name ?? e.clubId, detail: `${e.fromAge}–${e.toAge} år`, href: `/career/clubs/${encodeURIComponent(e.clubId)}` });
  for (const o of Object.values(state.transferOffers ?? {})) {
    if (o.playerId !== playerId || o.status !== "COMPLETED") continue;
    const loan = o.dealType === "LOAN";
    career.push({ date: o.resolvedDate ?? o.scheduledCompletionDate ?? o.offeredDate, kind: loan ? "LOAN" : "TRANSFER", title: `${loan ? "Lån" : "Övergång"}: ${name(o.fromClubId)} → ${name(o.toClubId)}`, detail: loan ? "Lån enligt lånevillkoren" : `Ny lön ${o.newWageEurPerMonth} €/mån, avtal till ${o.newContractEndDate}` });
  }
  for (const d of state.playerDynamics?.departures ?? []) if (d.playerId === playerId) career.push({ date: d.date, kind: "DEPARTURE", title: `Lämnade för ${name(d.toClubId)}`, detail: { SALE: "Försäljning", RELEASE: "Kontraktet bröts", PRE_CONTRACT: "Förhandsavtal", FREE: "Fri övergång" }[d.kind] });
  for (const t of Object.values(state.renewalTalks ?? {})) if (t.playerId === playerId && t.status === "AGREED") career.push({ date: t.closedOn ?? t.openedOn, kind: "CONTRACT", title: "Kontraktet förlängt", detail: t.rounds.at(-1) ? `${t.rounds.at(-1)!.offer.years} år, ${t.rounds.at(-1)!.offer.wageEurPerMonth} €/mån` : "Förlängning överenskommen" });
  for (const s of state.seasonHistory ?? []) {
    const st = s.stats[playerId];
    if (st?.appearances) career.push({ date: null, kind: "SEASON", title: `Säsong ${s.seasonId}`, detail: `${st.appearances} matcher, ${st.goals} mål, snittbetyg ${averageRating(st).toFixed(1)}`, href: `/career/history?season=${encodeURIComponent(s.seasonId)}` });
  }

  // --- contract & future
  const c = state.playerContracts[playerId];
  const contract = c || own ? (() => {
    const status = getPlayerContractStatus(state, playerId) ?? null;
    const daysLeft = c ? days(state.gameDate, c.contractEndDate) : null;
    const talk = Object.values(state.renewalTalks ?? {}).filter((t) => t.playerId === playerId).sort((a, b) => b.openedOn.localeCompare(a.openedOn))[0];
    const renewal = !own ? null : talk ? ({ OPEN: "Förhandling pågår", AGREED: "Förlängning klar", REFUSED: "Spelaren tackade nej", WITHDRAWN: "Förhandlingen avbröts" }[talk.status]) : null;
    const listed = !!state.playerDynamics?.listings?.[playerId];
    const request = state.playerDynamics?.requests?.[playerId]?.status === "OPEN";
    const offers = own ? Object.values(state.incomingOffers ?? {}).filter((o) => o.playerId === playerId && !["WITHDRAWN", "EXPIRED", "COMPLETED", "REJECTED", "PLAYER_REFUSED"].includes(o.status)).length : 0;
    const pre = state.preContracts?.[playerId];
    const risks: DossierRisk[] = [];
    if (own) {
      if (daysLeft !== null && daysLeft <= 180) risks.push({ tone: "neg", text: `Avtalet löper ut om ${daysLeft} dagar` });
      else if (daysLeft !== null && daysLeft <= 365) risks.push({ tone: "warn", text: "Mindre än ett år kvar på avtalet" });
      if (request) risks.push({ tone: "neg", text: "Spelaren har begärt att bli såld" });
      if (pre) risks.push({ tone: "neg", text: `Förhandsavtal med ${name(pre.toClubId)} från ${pre.effectiveOn}` });
      if (offers) risks.push({ tone: "warn", text: `${offers} aktiva bud från andra klubbar` });
      const m = moraleOf(state, playerId);
      if (m < 40) risks.push({ tone: "warn", text: `Låg moral (${m})` });
      if (listed) risks.push({ tone: "info", text: "Transferlistad" });
    }
    const tier = own ? state.playerSquadStatus[playerId] ?? null : null;
    return { clubId: c?.clubId ?? null, endDate: c?.contractEndDate ?? null, daysLeft, wage: c?.wageEurPerMonth ?? null, status, role: tier, renewal, listed, request, offers, preContract: pre ? `${name(pre.toClubId)} · ${pre.effectiveOn}` : null, risks };
  })() : null;

  const roles = own ? currentTeamRoles(state) : null;
  return {
    own,
    rating: rating ? { current: abilityStarsFromCA(rating.ca), potential: potentialStarsFromPA(rating.pa) } : null,
    families, strengths, weaknesses,
    season: { appearances: stats.appearances, starts: stats.starts, goals: stats.goals, shots: stats.shots, saves: stats.saves, shotsFaced: stats.shotsFaced, avgRating: stats.appearances ? Math.round(averageRating(stats) * 10) / 10 : null, minutes: Math.round(minutes), matchesInArchive: history.length },
    matches, readiness,
    development: { focus: own ? state.playerTrainingAssignments[playerId]?.individualFocus ?? "NORMAL" : null, points, progression: [...prog.values()].sort((a, b) => (b.last - b.first) - (a.last - a.first) || a.label.localeCompare(b.label, "sv")), sources },
    milestones,
    career: career.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    contract,
    roles: { captain: roles?.captainId === playerId, vice: roles?.viceCaptainId === playerId, penalty: roles && roles.penaltyTakers.includes(playerId) ? roles.penaltyTakers.indexOf(playerId) + 1 : null },
  };
}
