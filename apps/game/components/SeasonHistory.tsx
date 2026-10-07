'use client';
import { useCareer } from '@/lib/career/CareerContext';
import { getClub } from '@/lib/game-data';
export default function SeasonHistory() {
  const { career } = useCareer();
  if (!career.seasonHistory?.length) return null;
  return <details className="hm-panel"><summary className="hm-panel-body">Tidigare säsonger</summary>{[...career.seasonHistory].reverse().map(season => <div key={season.seasonId}><div className="hm-panel-header"><strong>{season.seasonId} · Sluttabell</strong></div><table className="hm-table"><thead><tr><th>#</th><th>Klubb</th><th>Matcher</th><th>Målskillnad</th><th>Poäng</th></tr></thead><tbody>{season.table.map((row, index) => <tr key={row.clubId}><td>{index + 1}</td><td>{getClub(row.clubId)?.name ?? row.clubId}</td><td>{row.played}</td><td>{row.goalDifference}</td><td>{row.points}</td></tr>)}</tbody></table></div>)}</details>;
}
