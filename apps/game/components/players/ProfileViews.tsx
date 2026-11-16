'use client';
// Arena Nights -- player profile chapters (SQD-02 Feature Profile):
//   SQD-02h (A) Condition gauge set       SQD-02b (A) Trend chart + match log
//   SQD-02c/d (A) Attributes & development workspace: development curve, editable focus, per-attribute history
//   SQD-02e (A) Deal sheet                SQD-02f (A) Career ribbon
//   SQD-02p (A) Rehab timeline            SQD-02q (A) Skeleton + recover
// Read models: lib/players/playerDossier.ts, attributeMatrix.ts, profileModels.ts (existing career data only).
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { CareerState } from '@/lib/career/types';
import type { PlayerMock } from '@/lib/game-data';
import type { PlayerDossier } from '@/lib/players/playerDossier';
import { developmentCurve, type AttributeEvent } from '@/lib/players/attributeMatrix';
import { careerRibbon, dealBudget, matchChart, rehabTimeline, REHAB_PHASES } from '@/lib/players/profileModels';
import { playerConditionFacts } from '@/components/game/PlayerCondition';
import { MATCH_FITNESS_FULL_EFFECT, matchFitnessBand, MATCH_FITNESS_BAND_LABEL } from '@/lib/players/matchFitness';
import { INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS, REHAB_PHASE_LABELS } from '@/lib/medical/labels';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { formatMoney } from '@/lib/economy/currency';
import { averageRating } from '@/lib/career/types';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import ClubCrest from '@/components/ClubCrest';
import { getClub } from '@/lib/game-data';
import { getAttributeLabel } from '@/lib/rating/attributeVocabulary';

// ---------------------------------------------------------------- SQD-02h condition gauges
type Gauge = 'energy' | 'fitness' | 'availability' | 'rehab';
const GAUGE_HELP: Record<Gauge, string> = {
  energy: 'Energi är dagsformen: hur utvilad spelaren är i dag. Den sjunker av träning och match och återhämtas över natten. Under 75 % syns tröttheten i matchen.',
  fitness: `Matchträning är van vid matchtempo. Den byggs av speltid och sjunker utan matcher. Från ${MATCH_FITNESS_FULL_EFFECT} % spelar han med full effekt; under det sänks hans egenskaper i match något.`,
  availability: 'Tillgänglighet avgör om han kan tas ut till match: skada, avstängning, rehab eller landslag.',
  rehab: 'Rehabframsteg är hur stor del av den beräknade läkningstiden som har gått, med medicinska avdelningens kvalitet inräknad.',
};

export function ConditionGauges({ career, player }: { career: CareerState; player: PlayerMock }) {
  const f = playerConditionFacts(career, player);
  const [open, setOpen] = useState<Gauge | null>(null);
  const band = matchFitnessBand(f.matchFitness);
  const btn = (g: Gauge, body: ReactNode, label: string) => <button type="button" className="pv-gauge" data-gauge={g} aria-expanded={open === g} aria-label={`${label}. Visa förklaring`} onClick={() => setOpen(open === g ? null : g)}>{body}</button>;
  return <section className="hm-dossier-section pv-condition" aria-labelledby="pv-cond-h">
    <header><h2 id="pv-cond-h">Tillstånd</h2><span className="hm-status" data-tone={f.status.tone}>{f.status.label}{f.returnDate && !f.selectable ? ` · åter ~${f.returnDate}` : ''}</span></header>
    <div className="pv-gauges">
      {btn('energy', <><svg viewBox="0 0 36 36" className="pv-ring" data-low={f.energy < 75} aria-hidden="true"><circle cx="18" cy="18" r="15" /><circle cx="18" cy="18" r="15" style={{ strokeDasharray: `${(f.energy / 100) * 94.2} 94.2` }} /></svg><b>{f.energy}%</b><span>Energi</span></>, `Energi ${f.energy} %`)}
      {btn('fitness', <><span className="pv-fitbar" aria-hidden="true"><i style={{ width: `${f.matchFitness}%` }} data-band={band} /><em style={{ left: `${MATCH_FITNESS_FULL_EFFECT}%` }} /></span><b>{f.matchFitness}%</b><span>{MATCH_FITNESS_BAND_LABEL[band]}</span><small className="pv-fitscale" aria-hidden="true"><span>0</span><span style={{ left: `${MATCH_FITNESS_FULL_EFFECT}%` }}>{MATCH_FITNESS_FULL_EFFECT} full effekt</span></small></>, `Matchträning ${f.matchFitness} %, ${MATCH_FITNESS_BAND_LABEL[band]}`)}
      {btn('availability', <><span className="pv-avail" data-tone={f.status.tone}>{f.selectable ? '✓' : '✕'}</span><b>{f.status.label}</b><span>{f.selectable ? 'Kan tas ut till match' : f.status.consequence ?? 'Inte tillgänglig'}</span></>, `Tillgänglighet: ${f.status.label}`)}
      {f.injury && btn('rehab', <><span className="pv-fitbar" aria-hidden="true"><i style={{ width: `${Math.round(f.injury.rehabProgress * 100)}%` }} data-band="BUILDING" /></span><b>{Math.round(f.injury.rehabProgress * 100)}%</b><span>{REHAB_PHASE_LABELS[f.injury.currentPhase]}</span></>, `Rehab ${Math.round(f.injury.rehabProgress * 100)} %`)}
    </div>
    {open && <p className="pv-gauge-help" role="status">{GAUGE_HELP[open]}</p>}
    {f.injury && <p className="hm-dossier-note">{INJURY_TYPE_LABELS[f.injury.injuryType]} · {INJURY_SEVERITY_LABELS[f.injury.severity]}{f.energy >= 80 ? ' · utvilad men skadad: kan inte spela förrän skadan är läkt.' : ''}</p>}
  </section>;
}

// ---------------------------------------------------------------- SQD-02b trend chart + match log
export function MatchesView({ dossier, career, playerId, goalkeeper }: { dossier: PlayerDossier; career: CareerState; playerId: string; goalkeeper: boolean }) {
  const [focus, setFocus] = useState<string | null>(null);
  const pts = matchChart(dossier.matches, goalkeeper);
  const seasons = (career.seasonHistory ?? []).filter(s => s.stats[playerId]?.appearances);
  const line = pts.map(p => `${p.x},${100 - p.y * 10}`).join(' ');
  return <div className="hm-stack">
    <section className="hm-dossier-section" aria-labelledby="pv-chart-h">
      <header><h2 id="pv-chart-h">Betyg senaste {pts.length || 12} matcherna</h2><span className="hm-dossier-note">Linje = matchbetyg (0–10) · staplar = {goalkeeper ? 'räddningar' : 'mål'} · tryck en punkt för att markera matchen</span></header>
      {pts.length === 0 ? <p className="hm-dossier-empty">Ingen match i matcharkivet ännu. Kurvan byggs när spelaren får speltid.</p> :
        <div className="pv-chart">
          <svg viewBox="-4 -4 108 108" preserveAspectRatio="none" aria-hidden="true">
            {[25, 50, 75].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y} className="pv-grid" />)}
            {pts.map(p => <rect key={p.fixtureId} x={p.x - 2} width="4" y={100 - p.barPct * 0.35} height={p.barPct * 0.35} className="pv-bar" data-focus={focus === p.fixtureId} />)}
            <polyline points={line} className="pv-line" />
          </svg>
          <ol className="pv-points">{pts.map(p => <li key={p.fixtureId} style={{ left: `${p.x}%`, top: `${100 - p.y * 10}%` }}><button type="button" data-r={p.outcome} aria-pressed={focus === p.fixtureId} aria-label={`${p.label}, betyg ${p.rating.toFixed(1)}`} onClick={() => setFocus(focus === p.fixtureId ? null : p.fixtureId)} /></li>)}</ol>
        </div>}
    </section>
    <section className="hm-dossier-section" aria-labelledby="pv-log-h">
      <header><h2 id="pv-log-h">Matchlogg</h2><span className="hm-dossier-note">{dossier.season.matchesInArchive} matcher i arkivet</span></header>
      {dossier.matches.length === 0 ? <p className="hm-dossier-empty">Inga matcher att visa.</p> :
        <ol className="pv-log">{dossier.matches.slice(0, 12).map(m => <li key={m.fixtureId} data-focus={focus === m.fixtureId} data-r={m.outcome}>
          <Link href={matchReportHref(m.fixtureId)} onFocus={() => setFocus(m.fixtureId)}>
            <time>{m.date}</time><span className="pv-log-opp">{m.home ? 'mot' : '@'} {m.opponent}</span><b className="pv-log-score">{m.score}</b>
            <span>{m.started ? 'Start' : 'Inhopp'}{m.minutes != null ? ` · ${m.minutes} min` : ''}</span>
            <span>{goalkeeper ? `${m.saves ?? 0}/${m.shotsFaced ?? 0} räddn.` : `${m.goals}/${m.shots} mål`}</span>
            <b className="pv-log-rating">{m.rating.toFixed(1)}</b><span className="pv-log-go" aria-hidden="true">→</span>
          </Link>
        </li>)}</ol>}
    </section>
    <section className="hm-dossier-section" aria-labelledby="pv-seasons-h">
      <header><h2 id="pv-seasons-h">Säsongshistorik</h2></header>
      {seasons.length ? <div className="hm-scroll-x"><table className="hm-table pv-seasons"><thead><tr><th>Säsong</th><th data-numeric="true">Matcher</th><th data-numeric="true">Starter</th><th data-numeric="true">Mål / skott</th><th data-numeric="true">Räddn. / mötta</th><th data-numeric="true">Snittbetyg</th></tr></thead><tbody>{[...seasons].reverse().map(s => { const st = s.stats[playerId]!; return <tr key={s.seasonId}><td><Link href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId}</Link></td><td data-numeric="true">{st.appearances}</td><td data-numeric="true">{st.starts}</td><td data-numeric="true">{st.goals} / {st.shots}</td><td data-numeric="true">{st.saves} / {st.shotsFaced}</td><td data-numeric="true">{averageRating(st).toFixed(1)}</td></tr>; })}</tbody></table></div>
        : <p className="hm-dossier-empty">Ingen avslutad säsong i arkivet ännu.</p>}
    </section>
  </div>;
}

// ---------------------------------------------------------------- SQD-02d development curve + focus
export const FOCUS_LABEL: Record<string, string> = { NORMAL: 'Normal', TECHNICAL: 'Teknik', ATTACKING_DECISIONS: 'Anfallsspel', DEFENCE: 'Försvarsspel', PHYSICAL: 'Fysik', MENTAL: 'Mentalt', GOALKEEPER: 'Målvaktsspel' };
const FOCUS_BY_BRANCH = { OUTCOURT: ['NORMAL', 'TECHNICAL', 'ATTACKING_DECISIONS', 'DEFENCE', 'PHYSICAL', 'MENTAL'], GOALKEEPER: ['NORMAL', 'GOALKEEPER', 'MENTAL'] } as const;

export function DevelopmentCurveCard({ dossier, events, goalkeeper, onFocus }: { dossier: PlayerDossier; events: AttributeEvent[]; goalkeeper: boolean; onFocus: (focus: string | null) => void }) {
  const [marker, setMarker] = useState<number | null>(null);
  const curve = developmentCurve(events);
  const focus = dossier.development.focus ?? 'NORMAL';
  const options: string[] = [...FOCUS_BY_BRANCH[goalkeeper ? 'GOALKEEPER' : 'OUTCOURT']];
  if (!options.includes(focus)) options.push(focus);
  const first = curve[0]?.date, last = curve.at(-1)?.date;
  const span = first && last ? Math.max(1, Date.parse(last) - Date.parse(first)) : 1;
  const nets = curve.map(p => p.net);
  const lo = Math.min(0, ...nets), hi = Math.max(1, ...nets);
  const y = (n: number) => 88 - ((n - lo) / Math.max(1, hi - lo)) * 76;
  const xs = curve.map(p => first ? ((Date.parse(p.date) - Date.parse(first)) / span) * 96 + 2 : 50);
  const r = dossier.rating;
  return <div className="pv-devgrid">
    <section className="hm-dossier-section pv-curve" aria-labelledby="pv-curve-h">
      <header><h2 id="pv-curve-h">Utvecklingskurva</h2>{r && <span className="hm-dossier-stars">Nivå {'★'.repeat(r.current)}{'☆'.repeat(5 - r.current)} · tak {'★'.repeat(r.potential)}{'☆'.repeat(5 - r.potential)}</span>}</header>
      {curve.length === 0 ? <p className="hm-dossier-empty">Ingen synlig förändring registrerad ännu. Utvecklingen avgörs veckovis av träning, tränarkvalitet, speltid och ålder; kurvan ritas när de första förändringarna inträffar.</p> : <>
        <div className="pv-curve-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {r && <rect x="0" y="0" width="100" height={Math.max(4, 12 - (r.potential - r.current) * 2)} className="pv-ceiling" />}
            <polyline points={curve.map((p, i) => `${xs[i]},${y(p.net)}`).join(' ')} className="pv-line" />
          </svg>
          <ol className="pv-markers">{curve.map((p, i) => <li key={i} style={{ left: `${xs[i]}%`, top: `${y(p.net)}%` }}><button type="button" data-up={p.up} aria-pressed={marker === i} aria-label={`${p.date}: ${p.label} ${p.from} → ${p.to}`} onClick={() => setMarker(marker === i ? null : i)} /></li>)}</ol>
          <span className="pv-ceiling-label">Potentialtak (scoutingens bedömning)</span>
        </div>
        <p className="hm-dossier-note" role="status">{marker != null && curve[marker] ? <><b>{curve[marker]!.date}</b> · {curve[marker]!.label} {curve[marker]!.from} → {curve[marker]!.to} · {curve[marker]!.source}</> : `${first} – ${last} · kurvan är den samlade nettoförändringen av hans egenskaper, utan siffror. Tryck en punkt för händelsen.`}</p>
      </>}
    </section>
    <section className="hm-dossier-section pv-focus" aria-labelledby="pv-focus-h">
      <header><h2 id="pv-focus-h">Individuellt fokus</h2><Link href="/career/training">Träning →</Link></header>
      <div className="pv-seg" role="radiogroup" aria-label="Individuellt utvecklingsfokus">
        {options.map(o => <button key={o} type="button" role="radio" aria-checked={focus === o} onClick={() => onFocus(o === 'NORMAL' ? null : o)}>{FOCUS_LABEL[o] ?? o}</button>)}
      </div>
      <p className="hm-dossier-note">Fokus styr vilka egenskapsgrupper veckans träning betonar. Samma inställning som i Träning.</p>
      <dl className="pv-devstats"><div><dt>Förändringar</dt><dd>{events.length}</dd></div><div><dt>Från träning</dt><dd>{dossier.development.sources.training}</dd></div><div><dt>Från matcher</dt><dd>{dossier.development.sources.match}</dd></div></dl>
    </section>
  </div>;
}

/** SQD-02c rail: the event history of the attribute tapped in the matrix (or the latest events). */
export function AttributeHistoryRail({ events, selected, label, onClear }: { events: AttributeEvent[]; selected: string | null; label: string | null; onClear: () => void }) {
  const list = [...events].filter(e => !selected || e.attribute === selected).sort((a, b) => b.date.localeCompare(a.date)).slice(0, selected ? 20 : 8);
  return <section className="hm-dossier-section pv-history" aria-labelledby="pv-hist-h" aria-live="polite">
    <header><h2 id="pv-hist-h">{selected ? `Historik: ${label}` : 'Senaste förändringarna'}</h2>{selected && <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClear}>Visa alla</button>}</header>
    {list.length === 0 ? <p className="hm-dossier-empty">{selected ? `Ingen registrerad förändring för ${label} ännu. Historiken sparar de senaste 20 förändringarna.` : 'Ingen registrerad förändring ännu. Tryck en egenskap i matrisen för dess historik.'}</p> :
      <ol className="pv-events">{list.map((e, i) => <li key={`${e.date}:${e.attribute}:${i}`} data-up={e.to >= e.from}><time>{e.date}</time>{!selected && <span>{getAttributeLabel(e.attribute as never)}</span>}<b>{e.from} → {e.to}</b><small>{e.source}</small></li>)}</ol>}
  </section>;
}

// ---------------------------------------------------------------- SQD-02e deal sheet
export function DealSheet({ career, player, dossier, marketValue, renewal, transfer, contractClubName }: {
  career: CareerState; player: PlayerMock; dossier: PlayerDossier; marketValue: ReactNode; renewal: ReactNode; transfer: ReactNode; contractClubName: string;
}) {
  const c = career.playerContracts[player.id];
  const own = dossier.own;
  const b = own ? dealBudget(career, player.id) : null;
  const facts: [string, ReactNode][] = [
    ['Avtalsklubb', contractClubName],
    ['Lön / månad', c ? formatMoney(c.wageEurPerMonth) : '—'],
    ['Avtal t.o.m.', c?.contractEndDate ?? '—'],
    ['Dagar kvar', dossier.contract?.daysLeft ?? '—'],
    ['Status', dossier.contract?.status ? CONTRACT_STATUS_LABEL[dossier.contract.status as keyof typeof CONTRACT_STATUS_LABEL] ?? dossier.contract.status : '—'],
    ['Marknadsvärde', marketValue],
    ['Tröjnummer', player.shirtNumber ?? 'Okänt'],
  ];
  return <div className="pv-deal">
    <dl className="hm-dossier-season pv-deal-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    {b && <section className="pv-budget" aria-label="Lönebudget">
      <header><span className="hm-eyebrow">Lönebudget (per år)</span><Link href="/career/contracts">Alla kontrakt →</Link></header>
      <div className="pv-budget-bar" role="img" aria-label={`Spelarlöner ${formatMoney(b.payrollEur)} av budget ${formatMoney(b.budgetEur)}; hans lön ${formatMoney(b.playerAnnualEur)}`}>
        <i className="pv-budget-payroll" style={{ width: `${b.payrollPct}%` }} data-over={b.over} />
        <i className="pv-budget-player" style={{ width: `${b.sharePct}%` }} />
      </div>
      <p className="hm-dossier-note">Hans lön {formatMoney(b.playerAnnualEur)} ({b.sharePct} %) · alla spelarlöner {formatMoney(b.payrollEur)} · budget {formatMoney(b.budgetEur)} · {b.over ? `över budget med ${formatMoney(-b.roomEur)}` : `utrymme ${formatMoney(b.roomEur)}`}</p>
    </section>}
    <div className="pv-deal-cols">
      <section className="hm-dossier-section" aria-label="Förlängning">{renewal ?? <p className="hm-dossier-note">{own ? 'Avtalet ägs av en annan klubb under lånet; förlängning sköts av ägarklubben.' : 'Extern spelare: kontraktet förhandlas genom ett bud i Transfercentret.'}</p>}</section>
      <div className="pv-deal-side">{transfer}</div>
    </div>
  </div>;
}

// ---------------------------------------------------------------- SQD-02f career ribbon
export function CareerRibbon({ career, player, age }: { career: CareerState; player: PlayerMock; age: number | null }) {
  const segs = careerRibbon(career, player.id, player.clubId || null, age);
  if (!segs.length) return <p className="hm-dossier-empty">Ingen tidigare klubb registrerad.</p>;
  return <section className="hm-dossier-section" aria-labelledby="pv-ribbon-h">
    <header><h2 id="pv-ribbon-h">Klubbresan</h2><span className="hm-dossier-note">Klubbar efter ålder · utbildningsersättning per klubb</span></header>
    <ol className="pv-ribbon">{segs.map((s, i) => {
      const club = getClub(s.clubId);
      return <li key={`${s.clubId}:${i}`} style={{ flexGrow: s.widthPct }} data-current={s.current}>
        <Link href={`/career/clubs/${encodeURIComponent(s.clubId)}`}>
          {club ? <ClubCrest clubId={club.id} shortName={club.shortName} primaryColor={club.primaryColor} size={22} /> : <span className="pv-ribbon-nocrest" aria-hidden="true">—</span>}
          <span className="pv-ribbon-name">{s.shortName}</span>
          <small>{s.fromAge}–{s.toAge} år{s.current ? ' · nu' : ''}</small>
          {s.compensationEur != null && <em>{formatMoney(s.compensationEur, { compact: true })} · {s.compensationYears} år</em>}
        </Link>
      </li>;
    })}</ol>
  </section>;
}

// ---------------------------------------------------------------- SQD-02p rehab timeline
export function RehabTimelinePanel({ career, playerId }: { career: CareerState; playerId: string }) {
  const t = rehabTimeline(career, playerId);
  const a = t.active;
  return <section className="hm-dossier-section pv-rehab" aria-labelledby="pv-rehab-h">
    <header><h2 id="pv-rehab-h">Medicinskt</h2><Link href="/career/medical">Medicinska avdelningen →</Link></header>
    {a ? <>
      <ol className="pv-phases" aria-label={`Rehabfas: ${REHAB_PHASE_LABELS[REHAB_PHASES[a.phaseIndex]!]}, ${a.progressPct} % av beräknad tid`}>{REHAB_PHASES.map((p, i) => <li key={p} data-state={i < a.phaseIndex ? 'done' : i === a.phaseIndex ? 'now' : 'next'}>{REHAB_PHASE_LABELS[p]}</li>)}</ol>
      <div className="pv-progress" aria-hidden="true"><i style={{ width: `${a.progressPct}%` }} /></div>
      <div className="pv-return" aria-label={`Beräknad återkomst ${a.returnDate}, missar ${a.missedCount} matcher`}>
        <span className="pv-return-axis" />
        {a.fixtures.map(f => <span key={f.id} className="pv-fixture" data-missed={f.missed} style={{ left: `${f.pct}%` }} title={`${f.date} ${f.opponent}`} />)}
        <span className="pv-return-mark" style={{ left: `${a.returnPct}%` }}><b>Åter {a.returnDate}</b></span>
      </div>
      <p className="hm-dossier-note">I dag → åter om {a.daysToReturn} dagar · {a.missedCount ? `missar ${a.missedCount} ${a.missedCount === 1 ? 'match' : 'matcher'}: ${a.fixtures.filter(f => f.missed).map(f => f.opponent).join(', ')}` : 'inga matcher före beräknad återkomst'}.</p>
    </> : <p className="hm-dossier-note">Ingen aktiv skada.</p>}
    <h3>Skadehistorik</h3>
    {t.history.length === 0 ? <p className="hm-dossier-note">Ingen tidigare skada registrerad.</p> :
      <ol className="pv-injuries">{t.history.map(h => <li key={h.id}><Link href="/career/medical"><time>{h.occurredDate}</time><span>{INJURY_TYPE_LABELS[h.type as keyof typeof INJURY_TYPE_LABELS] ?? h.type}</span><span className="pv-injury-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, h.daysOut / 1.2)}%` }} /></span><b>{h.daysOut} d</b><small>{INJURY_SEVERITY_LABELS[h.severity as keyof typeof INJURY_SEVERITY_LABELS] ?? h.severity}</small></Link></li>)}</ol>}
  </section>;
}

// ---------------------------------------------------------------- SQD-02q skeleton + recover
export function ProfileSkeleton({ label = 'Läser in spelarbetyg…' }: { label?: string }) {
  return <div className="pv-skeleton" role="status" aria-label={label}>
    <span className="hm-sr-only">{label}</span>
    <i className="pv-sk-head" /><div className="pv-sk-row"><i /><i /><i /><i /></div><div className="pv-sk-grid">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
  </div>;
}

export function PlayerNotFound({ recent, career }: { recent: string[]; career: CareerState }) {
  const players = recent.map(id => [...Object.values(career.worldSquads ?? {}).flat()].find(p => p?.id === id)).filter((p): p is PlayerMock => !!p).slice(0, 5);
  return <section className="hm-panel pv-notfound" aria-labelledby="pv-nf-h">
    <div className="hm-panel-body">
      <h1 id="pv-nf-h">Spelaren hittades inte</h1>
      <p className="hm-dossier-note">Spelaren kan ha lämnat världen, slutat eller så är länken felaktig.</p>
      <div className="pv-nf-actions"><Link className="hm-btn hm-btn-primary" href="/career/squad">← Till truppen</Link><Link className="hm-btn" href="/career/players">Sök spelare</Link></div>
      {players.length > 0 && <><span className="hm-eyebrow">Senast visade</span><ul className="pv-nf-recent">{players.map(p => <li key={p.id}><Link href={`/career/squad/${encodeURIComponent(p.id)}`}><span className="hm-position-code">{p.position}</span> {p.firstName} {p.lastName}</Link></li>)}</ul></>}
    </div>
  </section>;
}
