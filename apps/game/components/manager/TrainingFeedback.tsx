'use client';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { PlayerLink } from '@/components/entityLinks';
import { Panel, EmptyState } from './Workspace';
export default function TrainingFeedback() {
  const { career } = useCareer();
  const day = Object.values(career.trainingWeeks).flatMap(w => w.days).filter(d => d.executed && d.results?.length).sort((a,b) => b.date.localeCompare(a.date))[0];
  const players = new Map<string,{before:number;after:number;passes:number}>();
  for (const result of day?.results ?? []) for (const id of result.participants) {
    const previous = players.get(id);
    players.set(id,{before:previous?.before ?? result.preEnergyByPlayer[id],after:result.postEnergyByPlayer[id],passes:(previous?.passes ?? 0)+1});
  }
  return <details className="hm-panel"><summary className="hm-panel-body">Senaste träningsutfall{day ? ` · ${day.date}` : ''}</summary><Panel title="Registrerad deltagande & energiförändring">{day ? <table className="hm-table"><thead><tr><th>Spelare</th><th>Pass</th><th>Energi före</th><th>Energi efter</th><th>Förändring</th></tr></thead><tbody>{[...players].map(([id,values]) => { const player = getCareerPlayer(career,id); return <tr key={id}><td><PlayerLink playerId={id}>{player ? `${player.firstName} ${player.lastName}` : id}</PlayerLink></td><td>{values.passes}</td><td>{Math.round(values.before)}%</td><td>{Math.round(values.after)}%</td><td>{(values.after-values.before).toFixed(1)}</td></tr>; })}</tbody></table> : <EmptyState>Inget träningspass utfört ännu. Kalendern kör passen när du fortsätter.</EmptyState>}</Panel></details>;
}
