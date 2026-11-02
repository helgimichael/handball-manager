// HM-PLAYTEST-01 7.3/7.4: turnover definitions and score spread on the real
// career match path (v2 engine, quick result). Read-only measurement:
//   node --import tsx scripts/playtest-turnover-audit.ts
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../lib/gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from '../lib/career/careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch, finalizeProductionMatch } from '../lib/career/productionMatch';
import { ledger, lossClassOf } from '@handball-manager/handball-engine/src/v2/core/ledger';

const rows: unknown[] = [];
for (const [comp, club] of [['swe-2', 'swe2-tumba'], ['se_handbollsligan_herr', 'se_club_ystads_if_hf']] as const) {
  let base = createNewCareerState('turnover-audit-2026', club, snapshotWorldSquads(comp), undefined, snapshotGameplayRatings(comp));
  base = { ...base, playerClubId: club };
  for (const f of base.fixtures.filter(x => x.homeClubId === club || x.awayClubId === club).slice(0, Number(process.env.AUDIT_MATCHES ?? 6))) {
    let s = startProductionMatch({ ...base, gameDate: f.date, careerEvents: [buildMatchdayReadyEvent(f.id, f.date)] }, f.id, { quick: true });
    for (let i = 0; i < 40 && s.productionMatch?.core.status === 'RUNNING'; i++) { if (s.productionMatch.pausedAtHalf) s = commandProductionMatch(s, { kind: 'SECOND_HALF' }); s = advanceProductionMatch(s, 10000, false); }
    const core = s.productionMatch!.core;
    const losses: Record<string, Record<string, number>> = { HOME: {}, AWAY: {} };
    const poss: Record<string, number> = { HOME: 0, AWAY: 0 };
    const lossesAfterShot: Record<string, number> = { HOME: 0, AWAY: 0 };
    for (const r of ledger(core).records) { poss[r.team]++; if (lossClassOf(r.ending)) { losses[r.team][String(r.ending)] = (losses[r.team][String(r.ending)] ?? 0) + 1; if ((r as { shots?: number }).shots) lossesAfterShot[r.team]++; } }
    const res = finalizeProductionMatch(s).results[f.id];
    rows.push({ fixture: f.id, home: f.homeClubId, away: f.awayClubId, score: `${res.homeGoals}-${res.awayGoals}`, turnovers: [res.homeStats.turnovers, res.awayStats.turnovers], possessions: poss, shots: [res.homeStats.shots, res.awayStats.shots], losses, lossesAfterShot });
  }
}
console.log(JSON.stringify(rows));
