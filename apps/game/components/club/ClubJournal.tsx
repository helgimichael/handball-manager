'use client';
// Arena Nights Phase 3 -- Club Journal surfaces (CLB-02 C, CLB-02b A) and the shared depth court (SQD-01f B).
// Presentation only: every value comes from lib/club/clubJournal.ts.
import Link from 'next/link';
import { useState } from 'react';
import type { ClubJournal, DepthSpot, HistoryPoint, JournalBrief } from '@/lib/club/clubJournal';
import { POSITION_NAME } from '@/lib/club/clubJournal';
import { formatMoney } from '@/lib/economy/currency';

// Half-court spots (x %, y %) in attack shape, goal at the bottom.
const SPOT: Record<string, { x: number; y: number }> = { V6: { x: 8, y: 70 }, V9: { x: 24, y: 30 }, M9: { x: 50, y: 18 }, H9: { x: 76, y: 30 }, H6: { x: 92, y: 70 }, M6: { x: 50, y: 58 }, MV: { x: 50, y: 92 } };

/** SQD-01f B: the seven positions on a half court, coloured by available cover; tap a spot for the names. */
export function DepthCourt({ depth, onSelect, selected }: { depth: DepthSpot[]; onSelect?: (position: string | null) => void; selected?: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const active = selected ?? open;
  const spot = depth.find((d) => d.position === active);
  return (
    <div className="cj-depth">
      <div className="cj-depth-court" role="group" aria-label="Truppens täckning per position">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 18 100 A 32 32 0 0 1 82 100" className="cj-line" />
          <path d="M 4 100 A 46 50 0 0 1 96 100" className="cj-line cj-dashed" />
          <rect x="0" y="0" width="100" height="100" className="cj-frame" />
        </svg>
        {depth.map((d) => (
          <button key={d.position} type="button" className="cj-spot" data-tone={d.tone} data-active={active === d.position || undefined}
            style={{ left: `${SPOT[d.position]!.x}%`, top: `${SPOT[d.position]!.y}%` }}
            aria-pressed={active === d.position}
            aria-label={`${POSITION_NAME[d.position]}: ${d.available} av ${d.total} tillgängliga${d.secondary ? `, ${d.secondary} kan täcka` : ''}`}
            onClick={() => { const next = active === d.position ? null : d.position; setOpen(next); onSelect?.(next); }}>
            <b>{d.position}</b><span>{d.available}/{d.total}</span>{d.secondary > 0 && <i>+{d.secondary}</i>}
          </button>
        ))}
      </div>
      <div className="cj-depth-side">
        {spot ? (
          <>
            <strong>{POSITION_NAME[spot.position]}</strong>
            <ul>{spot.natural.map((n) => <li key={n.id} data-available={n.available}><Link href={`/career/squad/${n.id}`}>{n.name}</Link>{!n.available && <small>inte spelbar</small>}</li>)}</ul>
            {spot.cover.length > 0 && <p>Kan täcka: {spot.cover.map((c) => c.name).join(', ')}</p>}
            {spot.total === 0 && <p>Ingen spelare har positionen som naturlig roll.</p>}
          </>
        ) : (
          <ul className="cj-depth-legend">
            <li data-tone="good">Två eller fler spelbara</li>
            <li data-tone="warn">En spelbar – tunt</li>
            <li data-tone="bad">Ingen spelbar</li>
            <li>+n = kan täcka från annan position</li>
          </ul>
        )}
      </div>
    </div>
  );
}

/** CLB-02 C: final position per season, the live season highlighted. */
export function HistoryStrip({ history }: { history: HistoryPoint[] }) {
  const maxTeams = Math.max(2, ...history.map((h) => h.teams));
  const n = history.length;
  const x = (i: number) => (n === 1 ? 50 : 6 + (i * 88) / (n - 1));
  const y = (p: number) => 10 + ((p - 1) / (maxTeams - 1)) * 70;
  const pts = history.map((h, i) => (h.position ? `${x(i)},${y(h.position)}` : null)).filter(Boolean).join(' ');
  return (
    <figure className="cj-history" aria-label="Placering säsong för säsong" data-single={history.length === 1 || undefined}>
      <svg viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2="100" y1="10" y2="10" className="cj-grid" />
        {pts.includes(' ') && <polyline points={pts} className="cj-trend" />}
      </svg>
      <ol>
        {history.map((h, i) => (
          <li key={h.seasonId} style={{ left: `${x(i)}%`, top: h.position ? `${(y(h.position) / 90) * 100}%` : '50%' }} data-current={h.current || undefined} data-top={h.position === 1 || undefined}>
            <b>{h.position ? `${h.position}:a` : '–'}</b><small>{h.seasonId}{h.current ? ' · nu' : ''}</small>
          </li>
        ))}
      </ol>
      <figcaption>{history.length === 1 ? 'Den första säsongen i din tid. Varje avslutad säsong läggs till här.' : `Placering av ${maxTeams} lag. Högst upp är bäst.`}</figcaption>
    </figure>
  );
}

export function Briefs({ briefs }: { briefs: JournalBrief[] }) {
  return (
    <ul className="cj-briefs">
      {briefs.map((b) => (
        <li key={b.id} data-tone={b.tone}>
          <small>{b.title}</small>
          <strong>{b.headline}</strong>
          <span>{b.detail}</span>
          <Link href={b.href}>{b.cta}</Link>
        </li>
      ))}
    </ul>
  );
}

export function BoardAndEconomy({ journal }: { journal: ClubJournal }) {
  const total = journal.revenueMix.reduce((n, r) => n + r.eur, 0);
  return (
    <div className="cj-rail">
      {journal.board && (
        <section className="cj-board" aria-label="Styrelsens förtroende">
          <header><small>Styrelsen</small><Link href="/career/board">Styrelserummet →</Link></header>
          <div className="cj-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={journal.board.confidence} aria-label="Förtroende">
            <i style={{ width: `${journal.board.confidence}%` }} data-tone={journal.board.confidence < 35 ? 'bad' : journal.board.confidence < 55 ? 'warn' : 'good'} />
          </div>
          <p><b>{journal.board.confidence}</b> av 100 · väntad placering {journal.board.predictedPosition}</p>
          <ul>{journal.board.objectives.map((o) => <li key={o.label} data-status={o.status}><span>{o.label}</span><small>{o.progress}</small></li>)}</ul>
        </section>
      )}
      {journal.kpis && (
        <section className="cj-kpis" aria-label="Ekonomin i tre tal">
          <header><small>Ekonomin</small><Link href="/career/finance">Finanscentralen →</Link></header>
          <div><small>Kassa</small><strong>{formatMoney(journal.kpis.cashEur)}</strong></div>
          <div data-tone={journal.kpis.wageRoomEur < 0 ? 'bad' : 'good'}><small>Lönerum / år</small><strong>{formatMoney(journal.kpis.wageRoomEur)}</strong></div>
          <div><small>Transferbudget</small><strong>{formatMoney(journal.kpis.transferBudgetEur)}</strong></div>
          {total > 0 && (
            <figure className="cj-mix" aria-label="Intäkternas fördelning">
              <div>{journal.revenueMix.map((r, i) => <i key={r.label} data-i={i} style={{ flexGrow: r.eur }} title={`${r.label} ${Math.round((r.eur / total) * 100)} %`} />)}</div>
              <figcaption>{journal.revenueMix.map((r, i) => <span key={r.label} data-i={i}>{r.label} {Math.round((r.eur / total) * 100)} %</span>)}</figcaption>
            </figure>
          )}
          <p className="cj-note">{journal.kpis.pressureLabel}. Ekonomiska uppgifter är uppskattade.</p>
        </section>
      )}
    </div>
  );
}
