// HM-PLAYTEST-01 7.3/7.4: does a side with no substitutes (the owner's seven-player
// selection) lose the ball much more often? Read-only: node --import tsx scripts/playtest-short-bench-audit.ts
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../lib/gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from '../lib/career/careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch, finalizeProductionMatch } from '../lib/career/productionMatch';
import { getCareerClubSquad } from '../lib/career/careerWorld';
import { buildDefaultMatchPlan } from '../lib/matchPlan/defaultMatchPlan';

const SIX = ['V6', 'V9', 'M9', 'H9', 'H6', 'M6'] as const;
const club = 'se_club_ystads_if_hf';
let base = createNewCareerState('short-bench-2026', club, snapshotWorldSquads('se_handbollsligan_herr'), undefined, snapshotGameplayRatings('se_handbollsligan_herr'));
base = { ...base, playerClubId: club };
const squad = getCareerClubSquad(base, club);
for (const benchSize of [0, 9]) {
  const rows: string[] = [];
  for (const f of base.fixtures.filter(x => x.homeClubId === club || x.awayClubId === club).slice(0, 5)) {
    const used = new Set<string>();
    const gk = squad.find(p => p.position === 'MV')!; used.add(gk.id);
    const six = SIX.map(pos => { const p = squad.find(x => x.position === pos && !used.has(x.id)) ?? squad.find(x => x.position !== 'MV' && !used.has(x.id))!; used.add(p.id); return { playerId: p.id, position: pos }; });
    const bench = squad.filter(p => !used.has(p.id)).slice(0, benchSize).map(p => ({ playerId: p.id, position: (p.position === 'MV' ? 'GK' : p.position) as never }));
    const plan = buildDefaultMatchPlan({ fixtureId: f.id, clubId: club, players: [{ playerId: gk.id, position: 'GK' }, ...six, ...bench] }).plan!;
    let s = startProductionMatch({ ...base, gameDate: f.date, careerEvents: [buildMatchdayReadyEvent(f.id, f.date)], matchPlans: { [f.id]: plan } }, f.id, { quick: true });
    for (let i = 0; i < 40 && s.productionMatch?.core.status === 'RUNNING'; i++) { if (s.productionMatch.pausedAtHalf) s = commandProductionMatch(s, { kind: 'SECOND_HALF' }); s = advanceProductionMatch(s, 10000, false); }
    const r = finalizeProductionMatch(s).results[f.id];
    const own = f.homeClubId === club ? r.homeStats : r.awayStats;
    rows.push(`${f.id} ${r.homeGoals}-${r.awayGoals} own TO ${own.turnovers}`);
  }
  console.log(`bench=${benchSize}\n  ${rows.join('\n  ')}`);
}
