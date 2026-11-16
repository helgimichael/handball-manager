'use client';
// Arena Nights Phase 2 -- matchday presentation (MDY-01 C three-step ritual, MDY-01e court line-up with
// readiness rings, ANL-01a/ANL-01 report navigation). Renders lib/matchday/preMatch.ts; links only to
// existing screens.
import Link from 'next/link';
import type { AttentionItem, BenchPlayer, ChecklistTile, LineupSpot, PlayedMatch, PreviewEmptyState, SquadFixRow } from '@/lib/matchday/preMatch';
import { POSITION_GROUP_LABEL, clubShort } from '@/lib/matchday/preMatch';
import { matchReportHref } from '@/lib/career/fixtureRoutes';

/** MDY-01 steps as checklist tiles (MDY-01c): a blocking issue turns its tile red with the reason and the fix link. */
export function RitualSteps({ steps }: { steps: ChecklistTile[] }) {
  return <nav className="md-ritual" aria-label="Matchförberedelse">
    <ol>{steps.map((s, i) => <li key={s.id} data-state={s.state}>
      <a href={`#${s.id}`}><b>{s.state === 'done' ? '✓' : i + 1}</b><span>{s.label}{s.reason && <small className="md-tile-reason">{s.reason}</small>}</span></a>
      {s.state === 'block' && s.href && <Link className="md-tile-fix" href={s.href}>{s.cta ?? 'Åtgärda'} →</Link>}
    </li>)}</ol>
  </nav>;
}

/** MDY-01b: each squad warning with its consequence in words and a fix link. */
export function SquadFixList({ rows }: { rows: SquadFixRow[] }) {
  return <ul className="md-fixes">{rows.map((r) => <li key={r.code}><div><strong>{r.title}</strong><span>{r.text}</span><small>Följd: {r.consequence}</small></div><Link className="hm-btn hm-btn-sm" href={r.href}>{r.cta} →</Link></li>)}</ul>;
}

/** MDY-01f: season complete / no fixture, always with a way forward. */
export function PreviewEmpty({ state }: { state: PreviewEmptyState }) {
  return <section className="md-empty-card"><h2>{state.title}</h2><p>{state.text}</p><div>{state.actions.map((a) => <Link key={a.href} className={`hm-btn${a.primary ? ' hm-btn-primary' : ''}`} href={a.href}>{a.label}</Link>)}</div></section>;
}

export function AttentionList({ items }: { items: AttentionItem[] }) {
  return <ul className="md-attention">{items.map(i => <li key={i.id} data-tone={i.tone}><span>{i.text}</span>{i.href && <Link className="hm-btn hm-btn-sm" href={i.href}>{i.cta ?? 'Öppna'} →</Link>}</li>)}</ul>;
}

/** Attack-shape positions on a half court (goal at the bottom), in viewBox units 0-300 x 0-200. */
const COURT: Record<string, { x: number; y: number }> = {
  // Wings in the corners, backs and centre back beyond the dashed 9 m line, the pivot just outside the 6 m line, the goalkeeper in goal.
  V6: { x: 24, y: 178 }, H6: { x: 276, y: 178 }, V9: { x: 66, y: 66 }, H9: { x: 234, y: 66 }, M9: { x: 150, y: 34 }, M6: { x: 150, y: 80 }, GK: { x: 150, y: 190 },
};

export function LineupCourt({ spots }: { spots: LineupSpot[] }) {
  return <figure className="md-court" aria-label="Startsjua i anfallsuppställning">
    <svg viewBox="0 0 300 210" role="img" aria-hidden="true">
      <rect x="2" y="2" width="296" height="206" rx="4" className="md-court-floor" />
      <path d="M 40 200 A 110 110 0 0 1 260 200" className="md-court-6m" />
      <path d="M 10 200 A 140 140 0 0 1 290 200" className="md-court-9m" />
      <line x1="135" y1="200" x2="165" y2="200" className="md-court-goal" />
      <line x1="2" y1="4" x2="298" y2="4" className="md-court-mid" />
    </svg>
    <ol className="md-court-spots">
      {spots.map(s => { const c = COURT[s.slot]!; return <li key={s.slot} style={{ left: `${(c.x / 300) * 100}%`, top: `${(c.y / 210) * 100}%` }} data-empty={!s.playerId} data-available={s.available ?? true}>
        <span className="md-spot-ring" style={{ ['--ready' as string]: `${s.readiness ?? 0}` }} title={s.readiness != null ? `Beredskap ${s.readiness}%` : undefined}><b>{s.shirt ?? '—'}</b></span>
        <span className="md-spot-pos">{s.label}{s.captain ? ' · K' : ''}{s.penalty ? ' · 7m' : ''}</span>
        {s.playerId ? <Link href={`/career/squad/${encodeURIComponent(s.playerId)}`} className="md-spot-name">{s.name}</Link> : <span className="md-spot-name">Ej uttagen</span>}
      </li>; })}
    </ol>
    <figcaption>Startsjua i anfall · ringen visar spelarens beredskap · klicka ett namn för spelarprofilen</figcaption>
  </figure>;
}

export function Bench({ bench }: { bench: BenchPlayer[] }) {
  if (!bench.length) return <p className="md-empty">Inga avbytare uttagna.</p>;
  const groups = [...new Set(bench.map(b => b.group))];
  return <div className="md-bench">{groups.map(g => <section key={g}><h4>{POSITION_GROUP_LABEL[g]}</h4><ul>{bench.filter(b => b.group === g).map(b => <li key={b.playerId} data-available={b.available}><span className="md-bench-shirt">{b.shirt ?? '—'}</span><Link href={`/career/squad/${encodeURIComponent(b.playerId)}`}>{b.name}</Link><small>{b.position}</small><i style={{ width: `${b.readiness}%` }} data-low={b.readiness < 70} aria-label={`Beredskap ${b.readiness}%`} role="img" /></li>)}</ul></section>)}</div>;
}

export function HeadToHead({ matches, clubId }: { matches: PlayedMatch[]; clubId: string }) {
  if (!matches.length) return <p className="md-empty">Lagen har inte mötts tidigare i din karriär.</p>;
  return <ul className="md-h2h">{matches.map(m => { const ours = m.homeClubId === clubId ? m.homeGoals - m.awayGoals : m.awayClubId === clubId ? m.awayGoals - m.homeGoals : 0; return <li key={m.fixtureId} data-r={ours > 0 ? 'W' : ours < 0 ? 'L' : 'D'}><time>{m.date}</time><Link href={matchReportHref(m.fixtureId)}>{clubShort(m.homeClubId)} {m.homeGoals}–{m.awayGoals} {clubShort(m.awayClubId)}</Link><small>{m.type === 'LEAGUE' ? 'Liga' : m.type === 'CUP' ? 'Cup' : m.type === 'FRIENDLY' ? 'Träningsmatch' : m.type}</small></li>; })}</ul>;
}

export function ReportNav({ previous, next }: { previous?: PlayedMatch; next?: PlayedMatch }) {
  if (!previous && !next) return null;
  const label = (m: PlayedMatch) => `${clubShort(m.homeClubId)} ${m.homeGoals}–${m.awayGoals} ${clubShort(m.awayClubId)}`;
  return <nav className="md-report-nav" aria-label="Föregående och nästa match">
    {previous ? <Link href={matchReportHref(previous.fixtureId)} rel="prev"><small>← Föregående · {previous.date}</small><b>{label(previous)}</b></Link> : <span />}
    {next ? <Link href={matchReportHref(next.fixtureId)} rel="next"><small>Nästa · {next.date} →</small><b>{label(next)}</b></Link> : <span />}
  </nav>;
}
