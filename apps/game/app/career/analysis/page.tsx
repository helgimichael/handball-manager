"use client";
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { buildOverviewViewModel } from '@/lib/analysis/viewModels';
import { fmtNum } from '@/lib/analysis/format';
import { ObservedPatternsList, MissingDataNote } from '@/components/analysis/EvidenceLists';
import { getLastPlayedPlayerFixture, getNextPlayerFixture } from '@/lib/career/calendar';
import { MatchHero } from '@/components/game/Identity';
import { SceneEmpty } from '@/components/game/Secondary';
import { ClubLink } from '@/components/entityLinks';
import { Panel } from '@/components/manager/Workspace';
import FormDots from '@/components/FormDots';
import { matchReportHref } from '@/lib/career/fixtureRoutes';

export default function AnalysisOverviewPage() {
  const { career } = useCareer();
  const vm = buildOverviewViewModel(career);
  const next = getNextPlayerFixture(career);
  const last = getLastPlayedPlayerFixture(career);
  return <div className="game-secondary-split">
    <div className="game-secondary-main">
      {next ? <MatchHero career={career} fixture={next} compact context="Underlaget inför nästa match"><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/analysis/opponent">Analysera motståndaren →</Link><Link className="hm-btn hm-btn-sm" href="/career/match-preview">Matchförberedelse →</Link></MatchHero> : <SceneEmpty title="Ingen kommande match" actions={<Link className="hm-btn hm-btn-sm" href="/career/history">Säsongshistorik →</Link>}>Matchprogrammet innehåller ingen ospelad match för ditt lag.</SceneEmpty>}
      {vm.lastMatch.ok && last ? <Panel title="Senaste matchen" actions={<Link href="/career/analysis/last-match">Matchanalys →</Link>}><div className="hm-panel-body game-analysis-result"><ClubLink clubId={vm.lastMatch.value.opponent.id}>{vm.lastMatch.value.opponent.name}</ClubLink><strong>{vm.lastMatch.value.goalsFor}–{vm.lastMatch.value.goalsAgainst}</strong><span>{vm.lastMatch.value.date} · från vårt lags perspektiv</span><Link className="hm-btn hm-btn-sm" href={matchReportHref(vm.lastMatch.value.fixtureId)}>Öppna matchrapport →</Link></div></Panel> : <SceneEmpty title="Säsongens första match väntar" actions={<Link className="hm-btn hm-btn-sm" href="/career/schedule">Se matchprogrammet →</Link>}>Matchjämförelser och spelarprestationer blir tillgängliga när laget har spelat. Tidigare säsonger finns i Historik.</SceneEmpty>}
    </div>
    <aside className="game-secondary-rail" aria-label="Lagets form och observationer">
      <Panel title="Vårt lag · senaste fem" actions={<Link href="/career/analysis/our-team">Laget →</Link>}>{vm.ourForm.ok ? <><div className="hm-panel-body"><FormDots results={vm.ourForm.value.form} /></div><div className="game-secondary-metrics"><div><small>Mål / match</small><strong>{fmtNum(vm.ourForm.value.goalsPerMatch)}</strong></div><div><small>Insläppta / match</small><strong>{fmtNum(vm.ourForm.value.goalsConcededPerMatch)}</strong></div><div><small>Matchunderlag</small><strong>{vm.ourForm.value.form.length}</strong></div></div></> : <div className="hm-panel-body"><MissingDataNote text="Ingen spelad match den här säsongen ännu." /></div>}</Panel>
      <Panel title="Observerade mönster"><div className="hm-panel-body"><ObservedPatternsList patterns={vm.recentObservations} /></div></Panel>
      <section className="game-secondary-note"><h2>Från match till beslut</h2><p>Matchfakta visar vad som hände. Mönster och bedömningar bygger på registrerade matcher och kräver tillräckligt underlag.</p><div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/tactics">Arbeta med matchplanen</Link><Link className="hm-btn hm-btn-sm" href="/career/training">Planera veckan</Link></div></section>
    </aside>
  </div>;
}
