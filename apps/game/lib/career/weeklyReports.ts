// HM-PLAYTEST-01 3.4/3.5: weekly training report and staff report built
// only from facts the simulation already holds -- the workload ledger,
// readiness, injuries, development history, match fitness, results and the
// next fixture. Nothing is invented: when a week has too little data the
// report says so instead of filling the gap.
import type { EventDestination } from "./careerEvents";
import type { CareerState } from "./types";
import { getCareerSquad } from "./careerWorld";
import { getNextPlayerFixture } from "./calendar";
import { readinessSummary } from "../training/readinessSummary";
import { matchFitnessOf } from "../players/matchFitness";
import { getAttributeLabel } from "../rating/attributeVocabulary";
import { getClub } from "../game-data";
import { currentTeamRoles } from "./teamRoles";
import type { PlayerMock } from "../game-data";

export type WeeklyReport = { summary: string; lines: string[]; destinations: EventDestination[] };

const name = (p: PlayerMock) => `${p.firstName} ${p.lastName}`;
const list = (names: string[], max = 4) => (names.length > max ? `${names.slice(0, max).join(", ")} m.fl.` : names.join(", "));

function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
}

/** Attribute changes recorded by weekly development in the last 7 days. */
function recentDevelopment(state: CareerState, squad: readonly PlayerMock[], date: string) {
  const from = daysBefore(date, 7);
  return squad.map((p) => {
    const events = (state.playerDevelopmentState?.[p.id]?.developmentHistory ?? []).filter((e) => e.date > from && e.date <= date);
    const net = events.reduce((n, e) => n + (e.newValue - e.previousValue), 0);
    return { player: p, events, net };
  }).filter((x) => x.events.length > 0);
}

export function buildTrainingReport(state: CareerState, date: string): WeeklyReport {
  const squad = getCareerSquad(state);
  const injured = squad.filter((p) => state.playerInjuries?.[p.id]?.activeInjury);
  const readiness = squad.filter((p) => !injured.includes(p)).map((p) => ({ p, r: readinessSummary(state, p.id) }));
  const recorded = readiness.filter((x) => x.r.week.complete);
  const lines: string[] = [];
  if (recorded.length === 0) {
    lines.push("Belastningsdata för en hel vecka finns inte än – nästa rapport blir mer detaljerad.");
  } else {
    const avg = recorded.reduce((n, x) => n + x.r.week.training, 0) / recorded.length;
    lines.push(`Träningsbelastning: snitt ${Math.round(avg)} per spelare de senaste 7 dagarna (${recorded.filter((x) => x.r.week.matches > 0).length} spelare har även matchbelastning).`);
  }
  const rising = recorded.filter((x) => x.r.trend === "RISING" && x.r.outlook === "REDUCED");
  if (rising.length) lines.push(`Belastningsrisk: ${list(rising.map((x) => name(x.p)))} har ökande belastning och nedsatt återhämtning. Överväg reducerad belastning.`);
  const tired = readiness.filter((x) => x.r.readiness < 60).sort((a, b) => a.r.readiness - b.r.readiness);
  if (tired.length) lines.push(`Låg energi: ${list(tired.map((x) => `${name(x.p)} (${Math.round(x.r.readiness)} %)`))}.`);
  const resting = squad.filter((p) => ["REST", "RECOVERY_ONLY"].includes(state.playerTrainingAssignments?.[p.id]?.loadSetting ?? "FULL"));
  if (resting.length) lines.push(`Begränsat deltagande enligt dina val: ${list(resting.map(name))}.`);
  if (injured.length) lines.push(`Deltar inte (skadade): ${list(injured.map((p) => `${name(p)} – åter ~${state.playerInjuries[p.id]!.activeInjury!.expectedReturnDate}`))}.`);
  const dev = recentDevelopment(state, squad, date);
  const up = dev.filter((d) => d.net > 0).sort((a, b) => b.net - a.net);
  const down = dev.filter((d) => d.net < 0).sort((a, b) => a.net - b.net);
  if (up.length) lines.push(`Utveckling: ${list(up.map((d) => `${name(d.player)} (${d.events.filter((e) => e.newValue > e.previousValue).map((e) => getAttributeLabel(e.attribute as never)).slice(0, 2).join(", ")})`), 3)} har förbättrats denna vecka.`);
  if (down.length) lines.push(`Tillbakagång: ${list(down.map((d) => name(d.player)), 3)} har tappat i någon egenskap – ofta efter skada eller låg träningsmängd.`);
  if (!up.length && !down.length) lines.push("Inga synliga förändringar i egenskaper denna vecka – utveckling sker gradvis över flera veckor.");
  const rusty = squad.filter((p) => !injured.includes(p) && matchFitnessOf(state, p.id) < 50);
  if (rusty.length) lines.push(`Matchträning: ${list(rusty.map((p) => `${name(p)} (${matchFitnessOf(state, p.id)} %)`))} behöver speltid – träning ensam räcker inte.`);
  const concerns = rising.length + tired.length + injured.length;
  return {
    summary: concerns ? `${concerns} punkter att följa upp: belastning, energi och tillgänglighet.` : "Träningsveckan gick enligt plan utan belastningsvarningar.",
    lines,
    destinations: [{ route: "TRAINING" }, { route: "SQUAD" }],
  };
}

export function buildStaffReport(state: CareerState, date: string): WeeklyReport {
  const squad = getCareerSquad(state);
  const observations: string[] = [], risks: string[] = [], opportunities: string[] = [], recommendations: string[] = [];
  const destinations: EventDestination[] = [];
  const next = getNextPlayerFixture(state);
  if (next) {
    const opponentId = next.homeClubId === state.playerClubId ? next.awayClubId : next.homeClubId;
    observations.push(`Nästa match: ${getClub(opponentId)?.name ?? opponentId}, ${next.date} (${next.homeClubId === state.playerClubId ? "hemma" : "borta"}).`);
    const report = state.opponentScouting?.reports?.[next.id];
    if (report) observations.push(`Motståndaranalys finns (${report.reliabilityLabel.toLowerCase()} säkerhet).`);
    else recommendations.push("Beställ en motståndaranalys inför nästa match under Analys → Motståndare.");
    destinations.push({ route: "ANALYSIS_OPPONENT" });
  }
  const results = Object.entries(state.results).map(([id, r]) => ({ f: state.fixtures.find((f) => f.id === id), r }))
    .filter((x) => x.f && (x.f.homeClubId === state.playerClubId || x.f.awayClubId === state.playerClubId))
    .sort((a, b) => a.f!.date.localeCompare(b.f!.date)).slice(-3);
  if (results.length) {
    const form = results.map(({ f, r }) => { const home = f!.homeClubId === state.playerClubId; const own = home ? r.homeGoals : r.awayGoals, opp = home ? r.awayGoals : r.homeGoals; return own > opp ? "V" : own < opp ? "F" : "O"; });
    observations.push(`Senaste resultat: ${form.join(" ")}.`);
    const turnovers = results.map(({ f, r }) => (f!.homeClubId === state.playerClubId ? r.homeStats : r.awayStats)?.turnovers).filter((n): n is number => typeof n === "number");
    if (turnovers.length && turnovers.reduce((a, b) => a + b, 0) / turnovers.length >= 14) risks.push(`Bollförluster: i snitt ${Math.round(turnovers.reduce((a, b) => a + b, 0) / turnovers.length)} per match de senaste matcherna. Ett lugnare anfallstempo kan minska dem.`);
  }
  // Player-level picture, every week: who most needs games, who is most tired, who stood out last time.
  const fit = squad.filter((p) => !state.playerInjuries?.[p.id]?.activeInjury).map((p) => ({ p, mf: matchFitnessOf(state, p.id), en: Math.round(state.playerPhysicalState[p.id]?.currentEnergy ?? 100) }));
  const lowestFitness = [...fit].filter((x) => x.mf < 80).sort((a, b) => a.mf - b.mf).slice(0, 3);
  if (lowestFitness.length) observations.push(`Lägst matchträning: ${lowestFitness.map((x) => `${name(x.p)} (${x.mf} %)`).join(", ")}.`);
  const lowestEnergy = [...fit].filter((x) => x.en < 85).sort((a, b) => a.en - b.en).slice(0, 3);
  if (lowestEnergy.length) observations.push(`Lägst energi: ${lowestEnergy.map((x) => `${name(x.p)} (${x.en} %)`).join(", ")}.`);
  const lastOwn = results.at(-1);
  if (lastOwn) {
    const own = lastOwn.f!.homeClubId === state.playerClubId ? lastOwn.r.homePlayerContributions : lastOwn.r.awayPlayerContributions;
    const best = [...(own ?? [])].sort((a, b) => b.rating - a.rating)[0];
    const bestPlayer = best ? squad.find((p) => p.id === best.playerId) : undefined;
    if (best && bestPlayer) opportunities.push(`Bäst i senaste matchen: ${name(bestPlayer)} (betyg ${best.rating.toFixed(1)}, ${best.goals} mål).`);
  }
  const injured = squad.filter((p) => state.playerInjuries?.[p.id]?.activeInjury);
  if (injured.length) { risks.push(`Skadade: ${list(injured.map((p) => `${name(p)} (åter ~${state.playerInjuries[p.id]!.activeInjury!.expectedReturnDate})`))}.`); destinations.push({ route: "SQUAD" }); }
  const tired = squad.filter((p) => !injured.includes(p) && (state.playerPhysicalState[p.id]?.currentEnergy ?? 100) < 60);
  if (tired.length) { risks.push(`Låg energi inför matchen: ${list(tired.map(name))}.`); recommendations.push("Sänk belastningen för de tröttaste spelarna i Träning eller låt dem börja på bänken."); destinations.push({ route: "TRAINING" }); }
  const rusty = squad.filter((p) => !injured.includes(p) && matchFitnessOf(state, p.id) < 50);
  if (rusty.length) { opportunities.push(`${list(rusty.map(name))} saknar matchträning. Träningsmatcher eller inhopp bygger upp den.`); }
  const dev = recentDevelopment(state, squad, date).filter((d) => d.net > 0).sort((a, b) => b.net - a.net);
  if (dev.length) opportunities.push(`I god utveckling: ${list(dev.map((d) => name(d.player)), 3)}.`);
  const roles = currentTeamRoles(state);
  if (!roles.captainId) recommendations.push("Laget har ingen utsedd kapten. Utse en under Matchplan → Ledarskap.");
  if (!roles.penaltyTakers.length) recommendations.push("Ingen straffläggarordning är satt. Välj under Matchplan → Fasta situationer.");
  if (roles.captainId || !roles.penaltyTakers.length) destinations.push({ route: "TACTICS" });
  const lines = [
    "Nyckelobservationer:", ...(observations.length ? observations : ["Inga nya observationer."]),
    "Risker:", ...(risks.length ? risks : ["Inga akuta risker."]),
    "Möjligheter:", ...(opportunities.length ? opportunities : ["Inga särskilda möjligheter denna vecka."]),
    "Rekommendationer:", ...(recommendations.length ? recommendations : ["Fortsätt enligt plan."]),
  ];
  const seen = new Set<string>();
  return {
    summary: `${risks.length} risker och ${recommendations.length} rekommendationer från staben.`,
    lines,
    destinations: destinations.filter((d) => (seen.has(d.route) ? false : (seen.add(d.route), true))).slice(0, 4),
  };
}
