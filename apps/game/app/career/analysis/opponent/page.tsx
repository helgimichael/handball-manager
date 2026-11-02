"use client";
import { OpponentScoutingPanel } from '@/components/scouting/OpponentScoutingPanel';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { buildOpponentViewModel } from '@/lib/analysis/viewModels';
import { fmtNum, fmtPct } from '@/lib/analysis/format';
import { InterpretationsList, MissingDataNote, ObservedPatternsList } from '@/components/analysis/EvidenceLists';
import { missingAnalysisLabel } from '@/components/analysis/presentation';
import { SceneEmpty } from '@/components/game/Secondary';
import { MatchHero } from '@/components/game/Identity';
import { ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { Panel } from '@/components/manager/Workspace';
import FormDots from '@/components/FormDots';

export default function AnalysisOpponentPage() {
  const { career } = useCareer();
  const vm = buildOpponentViewModel(career);
  const next = getNextPlayerFixture(career);
  if (vm.status !== 'OK' || !vm.club || !next) return <SceneEmpty title="Ingen kommande motståndare" actions={<Link className="hm-btn hm-btn-sm" href="/career/history">Utforska säsongshistoriken →</Link>}>Det finns ingen ospelad match för ditt lag i det aktuella matchprogrammet.</SceneEmpty>;
  return <div className="game-secondary-split">
    <div className="game-secondary-main">
      <MatchHero career={career} fixture={next} compact context="Motståndaranalys"><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/tactics">Öppna matchplan →</Link><Link className="hm-btn hm-btn-sm" href="/career/match-preview">Matchförberedelse →</Link></MatchHero>
      <OpponentScoutingPanel />
      <Panel title="Motståndarens senaste matcher" actions={<ClubLink clubId={vm.club.id}>Klubb & trupp →</ClubLink>}>
        <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Datum</th><th>Motstånd</th><th>H / B</th><th>Resultat</th><th>Mål framåt</th><th>Insläppta</th></tr></thead><tbody>{(vm.recentMatches ?? []).length ? [...vm.recentMatches!].reverse().map(row => <tr key={row.fixtureId}><td>{row.date}</td><td><ClubLink clubId={row.opponentClubId}>{getClub(row.opponentClubId)?.name ?? row.opponentClubId}</ClubLink></td><td>{row.isHome ? 'H' : 'B'}</td><td><Link className="hm-result-link" href={`/career/match-report/${row.fixtureId}`}>{row.goalsFor}–{row.goalsAgainst}</Link></td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td></tr>) : <tr><td colSpan={6}>Motståndaren har ingen spelad match den här säsongen ännu.</td></tr>}</tbody></table></div>
      </Panel>
      <div className="game-analysis-facts">
        <Panel title="Anfall · senaste fem"><div className="hm-panel-body">{vm.attack ? <MetricRows rows={[['Mål / match',fmtNum(vm.attack.goalsPerMatch)],['Skott / match',fmtNum(vm.attack.shotsPerMatch)],['Skotteffektivitet',fmtPct(vm.attack.shootingPct)],['Bollförluster / match',fmtNum(vm.attack.turnoversPerMatch)],['7m-effektivitet',fmtPct(vm.attack.sevenMetreConversion)]]} /> : <MissingDataNote text={missingAnalysisLabel('NO_MATCHES_YET')} />}</div></Panel>
        <Panel title="Försvar · senaste fem"><div className="hm-panel-body">{vm.defence ? <MetricRows rows={[['Insläppta / match',fmtNum(vm.defence.goalsConcededPerMatch)],['Räddningsprocent',fmtPct(vm.defence.savePct)],['Räddningar / match',fmtNum(vm.defence.savesPerMatch)],['Utvisningar / match',fmtNum(vm.defence.twoMinPerMatch)]]} /> : <MissingDataNote text={missingAnalysisLabel('NO_MATCHES_YET')} />}</div></Panel>
      </div>
    </div>
    <aside className="game-secondary-rail" aria-label="Motståndarens form och bedömning">
      <Panel title={vm.club.name}><div className="hm-panel-body"><div className="game-analysis-stat-row"><span>Nuvarande liga</span><strong>{vm.competitionName}</strong></div><div className="game-analysis-stat-row"><span>Tabellplats</span><strong>{vm.leaguePosition?.ok ? vm.leaguePosition.value : '—'}</strong></div><div className="game-analysis-stat-row"><span>Motståndarens form</span><FormDots results={vm.form ?? []} /></div><p className="hm-text-muted">Underlag: {vm.recentMatches?.length ?? 0} registrerade matcher.</p></div></Panel>
      <Panel title="Observerade mönster"><div className="hm-panel-body"><ObservedPatternsList patterns={vm.patterns} /></div></Panel>
      <Panel title="Bedömning"><div className="hm-panel-body"><InterpretationsList interpretations={vm.interpretations} /></div></Panel>
      <section className="game-secondary-note"><h2>Fördjupa bilden</h2><p>Spelarnas individuella matchproduktion ingår inte i det här motståndarunderlaget. Klubbens trupp och scouting ger separat information inför laguttagningen.</p><ClubLink clubId={vm.club.id}>Öppna klubbens trupp →</ClubLink></section>
    </aside>
  </div>;
}
function MetricRows({ rows }: { rows: [string,string][] }) { return <>{rows.map(([label,value]) => <div className="game-analysis-stat-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</>; }
