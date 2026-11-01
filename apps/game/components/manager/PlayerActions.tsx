'use client';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { isRetiredClubId } from '@/lib/career/playerLifecycle';
import type { PlayerMock } from '@/lib/game-data';
export default function PlayerActions({ player }: { player: PlayerMock }) {
  const { career, addToShortlist, removeFromShortlist } = useCareer();
  const own = player.clubId === career.playerClubId;
  const listed = career.recruitmentTargets[player.id]?.shortlisted;
  const id = encodeURIComponent(player.id);
  return <div className="hm-actions hm-object-actions">
    <Link className="hm-btn hm-btn-sm" href={`/career/compare?left=${id}`}>Jämför spelare</Link>
    {own ? <><Link className="hm-btn hm-btn-sm" href="/career/tactics">Matchtrupp & startsju</Link><Link className="hm-btn hm-btn-sm" href="/career/contracts">Kontraktsöversikt</Link><Link className="hm-btn hm-btn-sm" href="/career/training">Träning & belastning</Link></> : !isRetiredClubId(player.clubId) && <>
      <button className="hm-btn hm-btn-sm" aria-pressed={!!listed} onClick={() => listed ? removeFromShortlist(player.id) : addToShortlist(player.id)}>{listed ? 'Ta bort från kortlista' : 'Kortlista spelare'}</button>
      <Link className="hm-btn hm-btn-sm" href={`/career/scouting?target=${id}`}>Scouta spelare</Link>
      <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/transfers/${encodeURIComponent(id)}`}>Förhandla</Link>
    </>}
  </div>;
}
