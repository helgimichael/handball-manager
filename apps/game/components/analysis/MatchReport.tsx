'use client';
// Arena Nights -- ANL-01 C "Editorial Match Report" pieces: momentum hero (ANL-01b), turning points,
// ratings column, workload box with load actions (ANL-01c), secondary press box (ANL-01f), the stats
// sheet (Statistik tab, absorbs ANL-05) and the empty state (ANL-01e). Renders lib/analysis/matchReport.ts;
// every action uses an existing career action.
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FastMatchResult, MatchEventType } from '@handball-manager/game-simulation';
import type { CareerFixture } from '@/lib/career/types';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { buildMatrixRows, type MatrixRow } from '@/lib/career/squadMatrix';
import { ensurePostMatchPress } from '@/lib/media/postMatchPress';
import { delegatePress, skipPress } from '@/lib/media/press';
import { computeHalfSplit } from '@/lib/analysis/halfSplit';
import { LOAD_SETTINGS, LOAD_SETTING_LABEL, type LoadSetting, type MatchStory, type RatingRow, type Side, type TurningPoint, type WorkloadRow } from '@/lib/analysis/matchReport';
import { ANALYSIS_EVENT_LABEL } from './presentation';
import PlayerPeek from '@/components/shell/PlayerPeek';
import { PlayerLink } from '@/components/entityLinks';

const tpScore = (t: TurningPoint) => `${t.score.home}–${t.score.away}`;

/** ANL-01b: goal difference per minute from the report's side, scoring runs shaded, half-time line, goals as ticks. */
export function MomentumChart({ story, names, selected, onSelect }: { story: MatchStory; names: Record<Side, string>; selected: number | null; onSelect: (i: number) => void }) {
  const clip = useId().replaceAll(':', '');
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const flow = story.flow;
  if (!flow.length) return <p className="rp-empty">Ingen tidsatt målsekvens finns sparad för den här matchen. Slutresultatet och statistiken finns kvar.</p>;
  const end = Math.max(60, Math.ceil(flow.at(-1)!.minute));
  const max = Math.max(3, ...flow.map((p) => Math.abs(p.diff)));
  const W = 800, H = 240, pad = 14;
  const x = (m: number) => (Math.min(end, Math.max(0, m)) / end) * W;
  const y = (d: number) => H / 2 - (d / max) * (H / 2 - pad);
  let d = `M0 ${y(0)}`, prev = 0;
  for (const p of flow) { d += ` L${x(p.minute)} ${y(prev)} L${x(p.minute)} ${y(p.diff)}`; prev = p.diff; }
  d += ` L${W} ${y(prev)}`;
  const area = `${d} L${W} ${y(0)} Z`;
  const own = names[story.ownSide], opp = names[story.ownSide === 'home' ? 'away' : 'home'];
  const tpDiff = (t: TurningPoint) => (t.score.home - t.score.away) * (story.ownSide === 'home' ? 1 : -1);
  const hovered = hover !== null ? flow[hover] : null;
  function move(e: React.PointerEvent<SVGSVGElement>) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const minute = ((e.clientX - box.left) / box.width) * end;
    let best = 0;
    flow.forEach((p, i) => { if (Math.abs(p.minute - minute) < Math.abs(flow[best]!.minute - minute)) best = i; });
    setHover(best);
  }
  return <figure className="rp-momentum">
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Målskillnaden minut för minut för ${own}. Slutade ${prev > 0 ? '+' : ''}${prev}. Största ledning ${story.maxLead.own}, största underläge ${story.maxLead.opp}.`} onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <defs>
        <clipPath id={`${clip}a`}><rect x="0" y="0" width={W} height={y(0)} /></clipPath>
        <clipPath id={`${clip}b`}><rect x="0" y={y(0)} width={W} height={H - y(0)} /></clipPath>
      </defs>
      {story.runs.map((r, i) => <rect key={i} className="rp-run" data-own={r.own} x={x(r.startMinute) - 3} y="0" width={Math.max(6, x(r.endMinute) - x(r.startMinute) + 6)} height={H}><title>{`${names[r.side]}: ${r.goals} mål i rad`}</title></rect>)}
      <line className="rp-zero" x1="0" x2={W} y1={y(0)} y2={y(0)} />
      <line className="rp-half" x1={x(30)} x2={x(30)} y1="0" y2={H} />
      {end > 60 && <line className="rp-half" x1={x(60)} x2={x(60)} y1="0" y2={H} />}
      <path className="rp-area-for" d={area} clipPath={`url(#${clip}a)`} />
      <path className="rp-area-against" d={area} clipPath={`url(#${clip}b)`} />
      <path className="rp-line" d={d} />
      {flow.map((p, i) => <line key={i} className="rp-tick" data-own={(p.side === story.ownSide)} x1={x(p.minute)} x2={x(p.minute)} y1={p.side === story.ownSide ? 0 : H - 8} y2={p.side === story.ownSide ? 8 : H} />)}
      {hovered && <circle className="rp-hover" cx={x(hovered.minute)} cy={y(hovered.diff)} r="5" />}
    </svg>
    <ol className="rp-markers" aria-label="Avgörande ögonblick i diagrammet">
      {story.turningPoints.map((t, i) => <li key={i} style={{ left: `${(x(t.minute) / W) * 100}%`, top: `${(y(tpDiff(t)) / H) * 100}%` }}>
        <button type="button" aria-pressed={selected === i} onClick={() => onSelect(i)} title={`${Math.round(t.minute)}′ ${t.title} (${tpScore(t)})`}>{i + 1}</button>
      </li>)}
    </ol>
    <figcaption>
      <span className="rp-readout" aria-live="polite">{hovered ? `${Math.round(hovered.minute)}′ · ${names[hovered.side]} gör ${hovered.score.home}–${hovered.score.away}` : `Över linjen: ${own} leder · under: ${opp} leder · streckat: halvtid · skuggat: ryck`}</span>
    </figcaption>
  </figure>;
}

/** Three turning points; with an archive each shows the recorded court picture. */
export function TurningPoints({ points, selected, onSelect, snapshot }: { points: TurningPoint[]; selected: number | null; onSelect: (i: number) => void; snapshot?: (t: TurningPoint) => ReactNode }) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => { if (selected !== null) refs.current[selected]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, [selected]);
  if (!points.length) return <p className="rp-empty">Ingen detaljdata för den här matchen: målen saknar tidsstämplar, så avgörande ögonblick kan inte visas.</p>;
  return <ol className="rp-turns">{points.map((t, i) => <li key={i} ref={(el) => { refs.current[i] = el; }} data-tone={t.tone} data-selected={selected === i || undefined}>
    <button type="button" className="rp-turn-head" onClick={() => onSelect(i)} aria-pressed={selected === i}><b>{i + 1}</b><time>{Math.round(t.minute)}′</time><strong>{t.title}</strong><span className="rp-num">{tpScore(t)}</span></button>
    {snapshot?.(t) ?? null}
    <p>{t.text}</p>
  </li>)}</ol>;
}

/** Ratings column: best first; the manager's own players open the Peek, others their profile. */
export function RatingsColumn({ rows, homeClubId, awayClubId, names }: { rows: RatingRow[]; homeClubId: string; awayClubId: string; names: Record<Side, string> }) {
  const { career } = useCareer();
  const matrix = useMemo(() => new Map(buildMatrixRows(career).map((r) => [r.id, r])), [career]);
  const [peek, setPeek] = useState<MatrixRow | null>(null);
  if (!rows.length) return <p className="rp-empty">Inga spelarbetyg sparades för den här matchen.</p>;
  return <>
    <ol className="rp-ratings">{rows.map((r) => {
      const p = getCareerPlayer(career, r.playerId);
      const name = p ? `${p.firstName[0]}. ${p.lastName}` : r.playerId;
      const own = (r.side === 'home' ? homeClubId : awayClubId) === career.playerClubId;
      const m = matrix.get(r.playerId);
      const line = r.saves !== undefined && r.shotsFaced ? `${r.saves}/${r.shotsFaced} räddn.` : `${r.goals} mål · ${r.shots} skott`;
      return <li key={r.playerId} data-own={own || undefined}>
        <span className="rp-rating rp-num" style={{ ['--r' as string]: `${Math.max(0, Math.min(100, r.rating * 10))}%` }}>{r.rating.toFixed(1)}</span>
        <span className="rp-rating-name">{m ? <button type="button" onClick={() => setPeek(m)}>{name}</button> : <PlayerLink playerId={r.playerId}>{name}</PlayerLink>}<small>{names[r.side]} · {line}</small></span>
      </li>;
    })}</ol>
    {peek && <PlayerPeek row={peek} onClose={() => setPeek(null)} />}
  </>;
}

/** ANL-01c: "Speltid och belastning" with an inline training-load selector per player and a bulk rest action. */
export function WorkloadBox({ rows, onSet, onBulk, bulk, empty }: { rows: WorkloadRow[]; onSet: (id: string, s: LoadSetting) => void; onBulk: () => void; bulk: string[]; empty?: string }) {
  return <section className="rp-box rp-load" aria-labelledby="rp-load-h">
    <header><h3 id="rp-load-h">Speltid och belastning</h3><small>Vad matchen kostade. Belastningen gäller spelarens träning från nästa pass tills du ändrar den.</small></header>
    {rows.length === 0 ? <p className="rp-empty">{empty ?? 'Ingen av dina spelare har registrerad speltid i den här matchen.'}</p> : <>
      <div className="rp-load-bulk">
        <button type="button" className="hm-btn hm-btn-sm" disabled={!bulk.length} onClick={onBulk}>Vila alla &gt;50 min{bulk.length ? ` (${bulk.length})` : ''}</button>
        {!bulk.length && <small>Ingen spelare över 50 minuter som inte redan vilar.</small>}
        <Link className="hm-btn hm-btn-sm" href="/career/training">Träningsveckan →</Link>
      </div>
      <div className="rp-load-table" role="table" aria-label="Speltid och belastning per spelare">
        <div role="row" className="rp-load-row rp-load-headrow"><span role="columnheader">Spelare</span><span role="columnheader">Minuter</span><span role="columnheader">Energi efter match</span><span role="columnheader" title="Belastningspoäng: den energi matchen krävde (samma enhet som träning).">Matchbelastning</span><span role="columnheader" title="Match + träning de senaste 7 dagarna jämfört med spelarens normala vecka (28 dagar / 4).">Senaste 7 dagar</span><span role="columnheader">Träning</span></div>
        {rows.map((r) => <div role="row" key={r.id} className="rp-load-row" data-risk={r.risk}>
          <span role="cell" className="rp-load-name"><PlayerLink playerId={r.id}>{r.name}</PlayerLink>{r.reasons.length > 0 && r.risk !== 'LOW' && <small>{r.reasons.join(' · ')}</small>}</span>
          <span role="cell" className="rp-num" data-label="Minuter">{r.minutes.toFixed(1).replace('.', ',')}</span>
          <span role="cell" data-label="Energi"><i className="rp-energy" style={{ ['--e' as string]: `${Math.max(0, Math.min(100, r.energy))}%` }} data-low={r.energy < 60 || undefined} aria-hidden="true" /><span className="rp-num">{Math.round(r.energy)} %</span></span>
          <span role="cell" className="rp-num" data-label="Matchbelastning" title={r.estimated ? 'Uppskattad (målvakt: nettoförlust av energi, ett minimivärde)' : undefined}>{r.workload === undefined ? '—' : `${r.estimated ? '≈' : ''}${Math.round(r.workload)}`}</span>
          <span role="cell" className="rp-num" data-label="7 dagar">{r.week === null ? '—' : Math.round(r.week)}{r.typical !== null && <small> / normalt {Math.round(r.typical)}</small>}</span>
          <span role="cell" data-label="Träning"><select className="hm-select" aria-label={`Träningsbelastning för ${r.name}`} value={r.setting} onChange={(e) => onSet(r.id, e.target.value as LoadSetting)}>{LOAD_SETTINGS.map((s) => <option key={s} value={s}>{LOAD_SETTING_LABEL[s]}</option>)}</select></span>
        </div>)}
      </div>
    </>}
  </section>;
}

/** ANL-01f: the post-match press conference as a secondary box (the one primary on the page stays "Fortsätt"). */
export function PressBox({ fixture, result }: { fixture: CareerFixture; result: FastMatchResult }) {
  const { career, updateCareer } = useCareer();
  const [note, setNote] = useState<string | null>(null);
  const id = `press:post:${fixture.id}`;
  const press = career.media?.press?.[id];
  const involved = fixture.homeClubId === career.playerClubId || fixture.awayClubId === career.playerClubId;
  useEffect(() => { if (!press && involved) updateCareer((c) => ensurePostMatchPress(c, fixture, result)); }, [press, involved, fixture, result, updateCareer]);
  if (!press) return null;
  const journalist = press.questions[0] ? career.media?.journalists?.[press.questions[0].journalistId] : undefined;
  const initials = journalist?.name.split(' ').map((w) => w[0]).join('').slice(0, 2) ?? '?';
  const status = press.status === 'OPEN' ? `Väntar · ${press.questions.length} frågor` : press.status === 'ANSWERED' ? 'Genomförd' : press.status === 'DELEGATED' ? 'Delegerad' : press.status === 'DECLINED' ? 'Avböjd' : 'Stängd';
  const act = (fn: typeof delegatePress, text: string) => { try { updateCareer((c) => fn(c, id, () => {})); setNote(text); } catch (e) { setNote(e instanceof Error ? e.message : 'Det gick inte.'); } };
  return <section className="rp-press" aria-label="Pressen">
    <span className="rp-press-face" aria-hidden="true">{initials}</span>
    <div>
      <strong>{press.status === 'OPEN' ? 'Pressen väntar' : 'Presskonferensen'}</strong>
      <small>{journalist ? `${journalist.name} och kollegorna · ` : ''}{status}</small>
      {note && <p role="status">{note}</p>}
      <div className="rp-press-actions">
        <Link className="hm-btn hm-btn-sm" href={`/career/media/press/${encodeURIComponent(id)}`}>{press.status === 'OPEN' ? 'Möt pressen →' : 'Svaren och följderna →'}</Link>
        {press.status === 'OPEN' && <><button type="button" className="hm-btn hm-btn-sm" onClick={() => act(delegatePress, 'Assisterande tränaren tog presskonferensen.')}>Delegera</button><button type="button" className="hm-btn hm-btn-sm" onClick={() => act(skipPress, 'Du valde att inte möta pressen efter matchen.')}>Hoppa över</button></>}
      </div>
    </div>
  </section>;
}

const FILTERS: { label: string; types: MatchEventType[] | null }[] = [{ label: 'Alla', types: null }, { label: 'Mål', types: ['GOAL'] }, { label: 'Räddningar', types: ['SAVE'] }, { label: 'Bollförluster', types: ['TURNOVER'] }, { label: '2 min', types: ['TWO_MIN'] }, { label: '7m', types: ['SEVEN_M'] }];

/** Statistik tab: team comparison, halves, scoring runs and the filterable event timeline (from ANL-05). */
export function StatsSheet({ result, names, story, children }: { result: FastMatchResult; names: Record<Side, string>; story: MatchStory; children?: ReactNode }) {
  const { career } = useCareer();
  const [filter, setFilter] = useState(0);
  const halves = useMemo(() => computeHalfSplit(result), [result]);
  const rows: [string, string, string, number, number][] = [
    ['Mål / skott', `${result.homeStats.goals}/${result.homeStats.shots}`, `${result.awayStats.goals}/${result.awayStats.shots}`, result.homeStats.goals, result.awayStats.goals],
    ['Skotteffektivitet', pct(result.homeStats.goals, result.homeStats.shots), pct(result.awayStats.goals, result.awayStats.shots), result.homeStats.goals / Math.max(1, result.homeStats.shots), result.awayStats.goals / Math.max(1, result.awayStats.shots)],
    ['Målvaktsräddningar', `${result.homeStats.saves}/${result.homeStats.shotsFaced}`, `${result.awayStats.saves}/${result.awayStats.shotsFaced}`, result.homeStats.saves, result.awayStats.saves],
    ['7-meterskast', `${result.homeStats.sevenMetreGoals}/${result.homeStats.sevenMetreAttempts}`, `${result.awayStats.sevenMetreGoals}/${result.awayStats.sevenMetreAttempts}`, result.homeStats.sevenMetreGoals, result.awayStats.sevenMetreGoals],
    ['Utvisningar (2 min)', String(result.homeStats.twoMinuteSuspensions), String(result.awayStats.twoMinuteSuspensions), result.homeStats.twoMinuteSuspensions, result.awayStats.twoMinuteSuspensions],
    ['Bollförluster', String(result.homeStats.turnovers), String(result.awayStats.turnovers), result.homeStats.turnovers, result.awayStats.turnovers],
  ];
  const f = FILTERS[filter]!;
  const events = result.events.filter((e) => !f.types || f.types.includes(e.type));
  return <div className="rp-sheet">
    <section className="rp-box" aria-labelledby="rp-cmp-h"><header><h3 id="rp-cmp-h">Matchstatistik · Jämförelse</h3><small>{names.home} – {names.away}</small></header>
      <div className="rp-compare">{rows.map(([label, h, a, hv, av]) => { const t = hv + av || 1; return <div key={label}><span className="rp-num">{h}</span><small>{label}</small><span className="rp-num">{a}</span><i aria-hidden="true" style={{ ['--h' as string]: `${(hv / t) * 100}%` }} /></div>; })}</div>
    </section>
    <div className="rp-sheet-grid">
      <section className="rp-box" aria-labelledby="rp-half-h"><header><h3 id="rp-half-h">Halvlekar</h3></header>
        <table className="hm-table"><thead><tr><th>Period</th><th className="hm-table-num">{names.home}</th><th className="hm-table-num">{names.away}</th><th className="hm-table-num">Skott</th></tr></thead><tbody>
          {([['Första', halves.firstHalf], ['Andra', halves.secondHalf]] as const).map(([l, h]) => <tr key={l}><th scope="row">{l}</th><td className="hm-table-num">{h.home.goals}</td><td className="hm-table-num">{h.away.goals}</td><td className="hm-table-num">{h.home.shots}–{h.away.shots}</td></tr>)}
        </tbody></table>
      </section>
      <section className="rp-box" aria-labelledby="rp-runs-h"><header><h3 id="rp-runs-h">Mål i följd</h3></header>
        {story.runs.length ? <ul className="rp-runs">{story.runs.map((r, i) => <li key={i} data-own={r.own}><span className="rp-num">{Math.round(r.startMinute)}′–{Math.round(r.endMinute)}′</span><strong>{names[r.side]} {r.goals}–0</strong><small>ställning efter: {r.scoreAfter.home}–{r.scoreAfter.away}</small></li>)}</ul> : <p className="rp-empty">Ingen följd med minst tre mål i den här matchen.</p>}
      </section>
    </div>
    <section className="rp-box" aria-labelledby="rp-tl-h"><header><h3 id="rp-tl-h">Matchhändelser</h3><div className="rp-filter" role="group" aria-label="Filtrera händelser">{FILTERS.map((x, i) => <button key={x.label} type="button" className="hm-btn hm-btn-sm" aria-pressed={filter === i} onClick={() => setFilter(i)}>{x.label}</button>)}</div></header>
      {events.length ? <ol className="rp-timeline">{events.map((e, i) => { const p = e.playerId ? getCareerPlayer(career, e.playerId) : null; return <li key={i} data-side={e.side}><time className="rp-num">{e.minute}′</time><span>{ANALYSIS_EVENT_LABEL[e.type] ?? e.type} · {names[e.side]}{p && <> · <PlayerLink playerId={p.id}>{p.lastName}</PlayerLink></>}</span><strong className="rp-num">{e.homeScoreAfter !== undefined && e.awayScoreAfter !== undefined ? `${e.homeScoreAfter}–${e.awayScoreAfter}` : ''}</strong></li>; })}</ol> : <p className="rp-empty">Ingen registrerad händelse av den här typen.</p>}
    </section>
    {children}
  </div>;
}
function pct(a: number, b: number) { return b > 0 ? `${Math.round((a / b) * 100)} %` : '—'; }

/** ANL-01e: the message, an optional retry and always a way out. */
export function ReportEmpty({ title, text, retry, competitionId }: { title: string; text: string; retry?: () => void; competitionId?: string }) {
  return <section className="rp-empty-card" role={retry ? 'alert' : undefined}>
    <h2>{title}</h2><p>{text}</p>
    <div className="rp-actions">{retry && <button type="button" className="hm-btn hm-btn-primary" onClick={retry}>Försök igen</button>}<Link className="hm-btn" href="/career/schedule">← Schema</Link><Link className="hm-btn" href={competitionId ? `/career/competitions/${encodeURIComponent(competitionId)}` : '/career/season'}>Tabell →</Link></div>
  </section>;
}

