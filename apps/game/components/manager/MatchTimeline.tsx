'use client';
import type { FastMatchResult } from '@handball-manager/game-simulation';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { Panel, EmptyState } from './Workspace';
export default function MatchTimeline({ result }: {result:FastMatchResult}) {
  const { career } = useCareer();
  const labels: Record<string,string> = { GOAL:'Mål', TWO_MIN:'Två minuters utvisning', SEVEN_M:'7m', SAVE:'Räddning', MISS:'Missat skott', TURNOVER:'Bollförlust' };
  const events = result.events.filter(e => e.type === 'GOAL' || e.type === 'TWO_MIN' || e.type === 'SEVEN_M');
  return <details className="hm-panel"><summary className="hm-panel-body">Matchhändelser · {events.length} mål, 7m och utvisningar</summary><Panel title="Registrerade händelser"><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Minut</th><th>Lag</th><th>Händelse</th><th>Spelare</th><th>Ställning</th></tr></thead><tbody>{events.map((event,i) => { const clubId = event.side === 'home' ? result.homeClubId : result.awayClubId; const player = event.playerId ? getCareerPlayer(career,event.playerId) : null; return <tr key={i}><td>{event.minute}′</td><td><ClubLink clubId={clubId}>{getClub(clubId)?.shortName ?? clubId}</ClubLink></td><td>{labels[event.type]}{event.sevenMetreOutcome ? event.sevenMetreOutcome === 'GOAL' ? ' · mål' : ' · miss' : ''}</td><td>{player ? <PlayerLink playerId={player.id}>{player.firstName} {player.lastName}</PlayerLink> : '—'}</td><td>{event.homeScoreAfter !== undefined && event.awayScoreAfter !== undefined ? `${event.homeScoreAfter}–${event.awayScoreAfter}` : '—'}</td></tr>; })}</tbody></table></div>{!events.length && <EmptyState>Matchen saknar registrerade händelser.</EmptyState>}</Panel></details>;
}
