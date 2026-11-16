'use client';
// Arena Nights TRN-01e: per-player outcome of ONE executed training day,
// opened from that day's cell in the week planner (previously a collapsed
// block showing only the latest day). Reads the day's stored results.
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { PlayerLink } from '@/components/entityLinks';
import { EmptyState } from './Workspace';
import type { TrainingDay } from '@/lib/training/types';
import { trainingDayOutcome } from '@/lib/training/weekPlanView';

export default function TrainingFeedback({ day }: { day: TrainingDay }) {
  const { career } = useCareer();
  const outcome = trainingDayOutcome(day);
  if (!outcome || outcome.rows.length === 0) {
    return <EmptyState>{day.executed ? 'Ingen spelare tränade den här dagen – bara återhämtning över natten registrerades.' : 'Dagen är inte genomförd ännu. Kalendern kör passen när du fortsätter.'}</EmptyState>;
  }
  return (
    <div className="trn-outcome-table">
      <p className="trn-hint">Registrerat deltagande och energiförändring av passen ({outcome.attendance} spelare, {outcome.sessions} pass). Nattens återhämtning ingår inte.</p>
      <div className="hm-scroll-x">
        <table className="hm-table">
          <thead><tr><th>Spelare</th><th>Pass</th><th>Energi före</th><th>Energi efter</th><th>Förändring</th></tr></thead>
          <tbody>
            {outcome.rows.map((row) => {
              const player = getCareerPlayer(career, row.playerId);
              return (
                <tr key={row.playerId}>
                  <td><PlayerLink playerId={row.playerId}>{player ? `${player.firstName} ${player.lastName}` : row.playerId}</PlayerLink></td>
                  <td className="trn-num">{row.passes}</td>
                  <td className="trn-num">{Math.round(row.before)}%</td>
                  <td className="trn-num">{Math.round(row.after)}%</td>
                  <td className="trn-num">{row.delta.toFixed(1).replace('.', ',')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
