"use client";
// Arena Nights -- ANL-04 A "Trends + window-aware tables": the window toggle drives everything on the
// page -- the trend, the goal contribution bars and both player tables (summed from the stored match
// contributions of exactly those matches).
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { buildOurTeamViewModel } from '@/lib/analysis/viewModels';
import { getClubMatchHistory, sliceWindow } from '@/lib/analysis/matchHistory';
import { kpiTiles, trendSeries, windowPlayerTotals, type TrendMetricId } from '@/lib/analysis/trends';
import { fmtNum, fmtPct } from '@/lib/analysis/format';
import type { AnalysisWindow } from '@/lib/analysis/types';
import { InterpretationsList, ObservedPatternsList } from '@/components/analysis/EvidenceLists';
import { missingAnalysisLabel } from '@/components/analysis/presentation';
import { KpiTiles, MetricPicker, TrendChart, WindowToggle } from '@/components/analysis/Trends';
import { SceneEmpty } from '@/components/game/Secondary';
import { PlayerCell } from '@/components/game/Identity';
import { PlayerLink } from '@/components/entityLinks';
import { Panel } from '@/components/manager/Workspace';
import FormDots from '@/components/FormDots';

export default function AnalysisOurTeamPage() {
  const { career } = useCareer();
  const [window, setWindow] = useState<AnalysisWindow>('LAST_5');
  const [metric, setMetric] = useState<TrendMetricId>('GF');
  const vm = buildOurTeamViewModel(career, window);
  if (vm.status !== 'OK') return <SceneEmpty title="Lagets första match väntar" actions={<><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/tactics">Förbered laget →</Link><Link className="hm-btn hm-btn-sm" href="/career/history">Tidigare säsonger →</Link></>}>{missingAnalysisLabel(vm.status)} Matchstatistik och jämförelser blir tillgängliga när laget har spelat.</SceneEmpty>;
  const all = getClubMatchHistory(career, career.playerClubId);
  const rows = sliceWindow(all, window);
  const period = window === 'LAST_5' ? 'senaste fem' : 'hela säsongen';
  const totals = windowPlayerTotals(career, rows);
  const isKeeper = (id: string) => getCareerPlayer(career, id)?.position === 'MV';
  const outfield = totals.filter((t) => !isKeeper(t.playerId)), keepers = totals.filter((t) => isKeeper(t.playerId));
  const topGoals = Math.max(1, ...outfield.map((t) => t.goals));
  const name = (id: string) => { const p = getCareerPlayer(career, id); return p ? `${p.firstName} ${p.lastName}` : id; };
  const cell = (id: string) => { const p = getCareerPlayer(career, id); return p ? <PlayerCell player={p} /> : <PlayerLink playerId={id}>{id}</PlayerLink>; };
  return <div className="an-page">
    <section className="an-section" aria-labelledby="an-team-h">
      <header><h2 id="an-team-h">{vm.club.name} · {period}</h2><small>{rows.length} matcher · målskillnad {vm.goalDifference !== undefined && vm.goalDifference > 0 ? '+' : ''}{vm.goalDifference ?? '—'}</small><WindowToggle label="Period för hela sidan" value={window} onChange={setWindow} options={[{ id: 'LAST_5', label: 'Senaste fem' }, { id: 'SEASON', label: 'Hela säsongen' }]} /></header>
      <FormDots results={vm.form ?? []} />
      <KpiTiles tiles={kpiTiles(all)} onPick={setMetric} picked={metric} />
    </section>
    <section className="an-section" aria-labelledby="an-our-trend-h">
      <header><h2 id="an-our-trend-h">Trend · {period}</h2><MetricPicker value={metric} onChange={setMetric} /></header>
      <TrendChart points={trendSeries(all, metric).slice(-rows.length)} metric={metric} window={3} />
    </section>
    <section className="an-section" aria-labelledby="an-contrib-h">
      <header><h2 id="an-contrib-h">Målbidrag · {period}</h2><small>Från de sparade matchprestationerna i perioden</small></header>
      {outfield.some((t) => t.goals > 0) ? <ol className="an-bars">{outfield.filter((t) => t.goals > 0).slice(0, 8).map((t) => <li key={t.playerId}><PlayerLink playerId={t.playerId}>{name(t.playerId)}</PlayerLink><i style={{ width: `${(t.goals / topGoals) * 100}%` }} aria-hidden="true" /><b className="an-num">{t.goals}</b></li>)}</ol> : <p className="an-empty">Inga mål registrerade på enskilda spelare i perioden.</p>}
    </section>
    <Panel title={`Utespelare · ${period}`} actions={<Link href="/career/squad">Truppen →</Link>}>
      <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th className="hm-table-num">Matcher</th><th className="hm-table-num">Starter</th><th className="hm-table-num">Mål</th><th className="hm-table-num">Skott</th><th className="hm-table-num">Mål / match</th><th className="hm-table-num">Snittbetyg</th></tr></thead><tbody>{outfield.length ? outfield.map(t => <tr key={t.playerId}><td>{cell(t.playerId)}</td><td className="hm-table-num">{t.matches}</td><td className="hm-table-num">{t.starts}</td><td className="hm-table-num">{t.goals}</td><td className="hm-table-num">{t.shots}</td><td className="hm-table-num">{fmtNum(t.matches ? t.goals / t.matches : null, 2)}</td><td className="hm-table-num">{t.averageRating !== null ? t.averageRating.toFixed(1) : '—'}</td></tr>) : <tr><td colSpan={7}>Ingen utespelare har en registrerad matchprestation i perioden.</td></tr>}</tbody></table></div>
    </Panel>
    <Panel title={`Målvakter · ${period}`}><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th className="hm-table-num">Matcher</th><th className="hm-table-num">Räddningar</th><th className="hm-table-num">Mötta skott</th><th className="hm-table-num">Räddning %</th><th className="hm-table-num">Räddningar / match</th></tr></thead><tbody>{keepers.length ? keepers.map(gk => <tr key={gk.playerId}><td>{cell(gk.playerId)}</td><td className="hm-table-num">{gk.matches}</td><td className="hm-table-num">{gk.saves}</td><td className="hm-table-num">{gk.shotsFaced}</td><td className="hm-table-num">{fmtPct(gk.shotsFaced ? gk.saves / gk.shotsFaced : null)}</td><td className="hm-table-num">{fmtNum(gk.matches ? gk.saves / gk.matches : null)}</td></tr>) : <tr><td colSpan={6}>Ingen målvakt har en registrerad matchprestation i perioden.</td></tr>}</tbody></table></div></Panel>
    <nav className="an-links" aria-label="Vidare"><Link href="/career/tactics"><small>Ta analysen till planen</small><b>Matchplan →</b></Link><Link href="/career/training"><small>Arbeta med det i veckan</small><b>Träningsvecka →</b></Link></nav>
    <details className="an-more"><summary>Observerade mönster och bedömning</summary><ObservedPatternsList patterns={vm.patterns} /><InterpretationsList interpretations={vm.interpretations} /></details>
  </div>;
}
