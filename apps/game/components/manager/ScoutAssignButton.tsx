'use client';
// Arena Nights -- CMP-01e / CMP-01h: start a broad scouting assignment (club or league) right where the club or
// league is shown. Uses the existing createBroadScoutingAssignment action; the scout must be the club's own.
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getAllScoutingAssignments, getClubScouts } from '@/lib/career/scouting';

export function ScoutAssignButton({ kind, targetId, label }: { kind: 'CLUB' | 'COMPETITION'; targetId: string; label: string }) {
  const { career, createBroadScoutingAssignment } = useCareer();
  const scouts = getClubScouts(career);
  const [scoutId, setScoutId] = useState<string>(scouts[0]?.id ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const running = getAllScoutingAssignments(career).find((a) => a.status === 'IN_PROGRESS' && a.assignmentType === kind && (kind === 'CLUB' ? a.targetClubId === targetId : a.targetCompetitionId === targetId));
  if (running) {
    const scout = scouts.find((s) => s.id === running.scoutStaffId);
    return <p className="cc-scout-note" data-tone="ok">Bevakning pågår{scout ? ` · ${scout.displayName}` : ''} · rapport {running.endDate}. <Link href="/career/scouting">Scouting →</Link></p>;
  }
  if (!scouts.length) return <div className="cc-scout"><button type="button" className="hm-btn" disabled>{label}</button><p className="cc-scout-note">Klubben har ingen scout anställd. <Link href="/career/staff">Anställ i staben →</Link></p></div>;
  function start() {
    const result = createBroadScoutingAssignment(scoutId, kind, kind === 'CLUB' ? { targetClubId: targetId } : { targetCompetitionId: targetId });
    setMessage(result.ok ? { ok: true, text: 'Uppdraget har startat. Upptäckter kommer i inkorgen.' } : { ok: false, text: result.errors.join(' ') || 'Uppdraget kunde inte startas.' });
  }
  return <div className="cc-scout">
    {scouts.length > 1 && <label className="cc-scout-pick">Scout<select className="hm-select" value={scoutId} onChange={(e) => setScoutId(e.target.value)}>{scouts.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label>}
    <button type="button" className="hm-btn hm-btn-primary" onClick={start}>{label}{scouts.length === 1 ? ` · ${scouts[0]!.displayName}` : ''}</button>
    {message && <p className="cc-scout-note" role="status" data-tone={message.ok ? 'ok' : 'error'}>{message.text}</p>}
  </div>;
}
