"use client";
// Arena Nights -- ANL-02 A "Trend dashboard": KPI tiles (last five vs season, sparkline) -> trend chart
// with metric picker and window toggle -> "Vad har ändrats" cards -> links to the next opponent and the
// latest report. Every number comes from lib/analysis (stored results only).
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getLastPlayedPlayerFixture, getNextPlayerFixture } from '@/lib/career/calendar';
import { getClubMatchHistory } from '@/lib/analysis/matchHistory';
import { kpiTiles, trendSeries, whatChanged, type TrendMetricId } from '@/lib/analysis/trends';
import { buildOverviewViewModel } from '@/lib/analysis/viewModels';
import { ObservedPatternsList } from '@/components/analysis/EvidenceLists';
import { ChangeCards, KpiTiles, MetricPicker, TrendChart, WindowToggle } from '@/components/analysis/Trends';
import { SceneEmpty } from '@/components/game/Secondary';
import { getClub } from '@/lib/game-data';
import { matchReportHref } from '@/lib/career/fixtureRoutes';

type Range = 'LAST_10' | 'SEASON';

export default function AnalysisOverviewPage() {
  const { career } = useCareer();
  const [metric, setMetric] = useState<TrendMetricId>('GF');
  const [range, setRange] = useState<Range>('SEASON');
  const rows = getClubMatchHistory(career, career.playerClubId);
  const next = getNextPlayerFixture(career);
  const last = getLastPlayedPlayerFixture(career);
  const vm = buildOverviewViewModel(career);
  const nextOpp = next ? getClub(next.homeClubId === career.playerClubId ? next.awayClubId : next.homeClubId) : undefined;
  const links = <nav className="an-links" aria-label="Vidare">
    {next && nextOpp ? <Link href="/career/analysis/opponent"><small>Nästa motståndare · {next.date}</small><b>{nextOpp.name} →</b></Link> : <Link href="/career/schedule"><small>Nästa motståndare</small><b>Ingen ospelad match · matchprogrammet →</b></Link>}
    {last ? <Link href={matchReportHref(last.fixture.id)}><small>Senaste matchen · {last.fixture.date}</small><b>{getClub(last.fixture.homeClubId)?.shortName} {last.result.homeGoals}–{last.result.awayGoals} {getClub(last.fixture.awayClubId)?.shortName} · matchrapport →</b></Link> : null}
    <Link href="/career/analysis/matches"><small>Alla matcher</small><b>Välj en match →</b></Link>
  </nav>;
  if (!rows.length) return <div className="an-page"><SceneEmpty title="Säsongens första match väntar" actions={<><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/match-preview">Matchförberedelse →</Link><Link className="hm-btn hm-btn-sm" href="/career/history">Tidigare säsonger →</Link></>}>Trenderna byggs av spelade matcher. Efter första matchen visas nyckeltal här, och efter två en trendlinje.</SceneEmpty>{links}</div>;
  const shown = range === 'LAST_10' ? rows.slice(-10) : rows;
  return <div className="an-page">
    <section className="an-section" aria-labelledby="an-kpi-h">
      <header><h2 id="an-kpi-h">Nyckeltal</h2><small>Senaste fem matcherna jämfört med hela säsongen ({rows.length} matcher). Klicka ett tal för att se trenden.</small></header>
      <KpiTiles tiles={kpiTiles(rows)} onPick={setMetric} picked={metric} />
    </section>
    <section className="an-section" aria-labelledby="an-trend-h">
      <header><h2 id="an-trend-h">Trend</h2><div className="an-controls"><MetricPicker value={metric} onChange={setMetric} /><WindowToggle label="Period" value={range} onChange={setRange} options={[{ id: 'LAST_10', label: 'Senaste 10' }, { id: 'SEASON', label: 'Hela säsongen' }]} /></div></header>
      <TrendChart points={trendSeries(rows, metric).slice(-shown.length)} metric={metric} window={3} />
    </section>
    <section className="an-section" aria-labelledby="an-change-h">
      <header><h2 id="an-change-h">Vad har ändrats</h2><small>Största skillnaderna, senaste fem mot säsongssnittet</small></header>
      <ChangeCards cards={whatChanged(rows)} />
      <details className="an-more"><summary>Observerade mönster</summary><ObservedPatternsList patterns={vm.recentObservations} /></details>
    </section>
    {links}
  </div>;
}
