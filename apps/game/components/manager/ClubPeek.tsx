'use client';
// Arena Nights -- club "Peek" (ENT-07 C pattern, as PlayerPeek): a quick look at a club without leaving the
// page -- league place, form, squad shape (counts only), last and next game, and "Scouta klubben".
// Used by the competition centre (rows, crest tiles) and the dashboard match box (opponent).
import Link from 'next/link';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useCareer } from '@/lib/career/CareerContext';
import { clubPeek } from '@/lib/competition/leagueCentre';
import { getClub } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import FormDots from '@/components/FormDots';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { ScoutAssignButton } from './ScoutAssignButton';
import { ClubPeekDossier } from '@/components/club/ClubPeekDossier';

const name = (id: string) => getClub(id)?.shortName ?? id;

export default function ClubPeek({ clubId, onClose, actions }: { clubId: string; onClose: () => void; actions?: ReactNode }) {
  const { career } = useCareer();
  const model = useMemo(() => clubPeek(career, clubId), [career, clubId]);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); back?.focus?.(); };
  }, [onClose]);
  if (!model) return null;
  const href = model.own ? '/career/club' : `/career/clubs/${encodeURIComponent(clubId)}`;
  return <div className="hm-peek-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="hm-peek cc-club-peek" role="dialog" aria-modal="true" aria-label={`Snabbtitt: ${model.name}`}>
      <header>
        <span className="cc-peek-id"><ClubCrest clubId={clubId} shortName={model.shortName} primaryColor={getClub(clubId)?.primaryColor ?? ''} size={44} /><span><strong>{model.name}</strong><small>{[model.city, model.competition].filter(Boolean).join(' · ') || 'Okänd serie'}</small></span></span>
        <button ref={close} type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose} aria-label="Stäng snabbtitten">✕</button>
      </header>
      <dl>
        <div><dt>Placering</dt><dd>{model.position ? `${model.position} av ${model.teams}` : '—'}</dd></div>
        <div><dt>Poäng</dt><dd>{model.row ? `${model.row.points} p · ${model.row.played} m` : '—'}</dd></div>
        <div><dt>Målskillnad</dt><dd>{model.row ? `${model.row.goalDifference > 0 ? '+' : ''}${model.row.goalDifference}` : '—'}</dd></div>
        <div><dt>Form</dt><dd>{model.form.length ? <FormDots results={model.form} /> : 'Inga matcher'}</dd></div>
        <div><dt>Senaste match</dt><dd>{model.last ? <Link href={matchReportHref(model.last.fixtureId)}>{model.last.score} {model.last.home ? 'mot' : 'borta mot'} {name(model.last.opponentId)}</Link> : '—'}</dd></div>
        <div><dt>Nästa match</dt><dd>{model.next ? <Link href={`/career/fixtures/${encodeURIComponent(model.next.fixtureId)}`}>{model.next.date} · {model.next.home ? 'hemma' : 'borta'} mot {name(model.next.opponentId)}</Link> : '—'}</dd></div>
      </dl>
      {model.squad ? <div className="cc-peek-squad" aria-label="Truppens positioner"><span className="cc-peek-label">Trupp · {model.squad.total} spelare</span><ul>{model.squad.byPosition.map((p) => <li key={p.position} data-thin={p.count < 2 || undefined}><b>{p.count}</b><span>{p.position}</span></li>)}</ul></div> : <p className="cc-scout-note">Ingen truppdata för klubben i din karriär.</p>}
      <ClubPeekDossier clubId={clubId} />
      <div className="hm-peek-actions">
        <Link className="hm-btn hm-btn-primary" href={href}>{model.own ? 'Öppna klubbsidan →' : 'Öppna hela →'}</Link>
        {actions}
      </div>
      {!model.own && <ScoutAssignButton kind="CLUB" targetId={clubId} label="Scouta klubben" />}
    </aside>
  </div>;
}
