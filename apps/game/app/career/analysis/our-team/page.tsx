"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { buildOurTeamViewModel } from '@/lib/analysis/viewModels';
import { fmtNum, fmtPct } from '@/lib/analysis/format';
import type { AnalysisWindow } from '@/lib/analysis/types';
import { InterpretationsList, ObservedPatternsList } from '@/components/analysis/EvidenceLists';
import { missingAnalysisLabel } from '@/components/analysis/presentation';
import { SceneEmpty } from '@/components/game/Secondary';
import { PlayerCell } from '@/components/game/Identity';
import { PlayerLink } from '@/components/entityLinks';
import { Panel } from '@/components/manager/Workspace';
import FormDots from '@/components/FormDots';

export default function AnalysisOurTeamPage() {
  const { career } = useCareer();
  const [window, setWindow] = useState<AnalysisWindow>('LAST_5');
  const vm = buildOurTeamViewModel(career,window);
  if (vm.status !== 'OK') return <SceneEmpty title="Lagets första match väntar" actions={<><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/tactics">Förbered laget →</Link><Link className="hm-btn hm-btn-sm" href="/career/history">Tidigare säsonger →</Link></>}>{missingAnalysisLabel(vm.status)} Matchstatistik och jämförelser blir tillgängliga när laget har spelat.</SceneEmpty>;
  const period = window === 'LAST_5' ? 'senaste fem' : 'hela säsongen';
  function playerCell(id:string,name:string) { const player=getCareerPlayer(career,id); return player ? <PlayerCell player={player} /> : <PlayerLink playerId={id}>{name}</PlayerLink>; }
  return <div className="game-secondary-split">
    <div className="game-secondary-main">
      <Panel title={`${vm.club.name} · ${period}`} actions={<div className="hm-actions">{(['LAST_5','SEASON'] as const).map(w => <button key={w} className="hm-btn hm-btn-sm" aria-pressed={window === w} onClick={() => setWindow(w)}>{w === 'LAST_5' ? 'Senaste fem' : 'Hela säsongen'}</button>)}</div>}>
        <div className="hm-panel-body"><FormDots results={vm.form ?? []} /></div><div className="game-secondary-metrics"><div><small>Matchunderlag</small><strong>{vm.form?.length ?? 0}</strong></div><div><small>Målskillnad</small><strong>{vm.goalDifference !== undefined && vm.goalDifference > 0 ? '+' : ''}{vm.goalDifference ?? '—'}</strong></div><div><small>Mål / match</small><strong>{fmtNum(vm.attack?.goalsPerMatch)}</strong></div></div>
      </Panel>
      <div className="game-analysis-facts">
        <Panel title={`Anfall · ${period}`}><div className="hm-panel-body"><MetricRows rows={[['Mål / match',fmtNum(vm.attack?.goalsPerMatch)],['Skott / match',fmtNum(vm.attack?.shotsPerMatch)],['Skotteffektivitet',fmtPct(vm.attack?.shootingPct)],['Bollförluster / match',fmtNum(vm.attack?.turnoversPerMatch)],['7m-effektivitet',fmtPct(vm.attack?.sevenMetreConversion)],['Mål i första halvlek',String(vm.attack?.firstHalfGoals ?? '—')],['Mål i andra halvlek',String(vm.attack?.secondHalfGoals ?? '—')]]} /></div></Panel>
        <Panel title={`Försvar · ${period}`}><div className="hm-panel-body"><MetricRows rows={[['Insläppta / match',fmtNum(vm.defence?.goalsConcededPerMatch)],['Räddningar / match',fmtNum(vm.defence?.savesPerMatch)],['Räddningsprocent',fmtPct(vm.defence?.savePct)],['Utvisningar / match',fmtNum(vm.defence?.twoMinPerMatch)]]} /></div></Panel>
      </div>
      <Panel title="Säsongens utespelare" actions={<Link href="/career/squad">Truppen →</Link>}>
        <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th>Pos</th><th className="hm-table-num">Matcher</th><th className="hm-table-num">Mål</th><th className="hm-table-num">Mål / match</th><th className="hm-table-num">Snittbetyg</th></tr></thead><tbody>{vm.players.length ? vm.players.map(p => <tr key={p.playerId}><td>{playerCell(p.playerId,p.name)}</td><td>{p.position}</td><td className="hm-table-num">{p.appearances}</td><td className="hm-table-num">{p.goals}</td><td className="hm-table-num">{fmtNum(p.goalsPerMatch,2)}</td><td className="hm-table-num">{p.averageRating > 0 ? p.averageRating.toFixed(1) : '—'}</td></tr>) : <tr><td colSpan={6}>Ingen utespelare har en registrerad matchprestation ännu.</td></tr>}</tbody></table></div>
      </Panel>
      <Panel title="Säsongens målvakter"><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th className="hm-table-num">Matcher</th><th className="hm-table-num">Räddningar</th><th className="hm-table-num">Mötta skott</th><th className="hm-table-num">Räddning %</th><th className="hm-table-num">Räddningar / match</th></tr></thead><tbody>{vm.goalkeepers.length ? vm.goalkeepers.map(gk => <tr key={gk.playerId}><td>{playerCell(gk.playerId,gk.name)}</td><td className="hm-table-num">{gk.appearances}</td><td className="hm-table-num">{gk.saves}</td><td className="hm-table-num">{gk.shotsFaced}</td><td className="hm-table-num">{fmtPct(gk.savePct)}</td><td className="hm-table-num">{fmtNum(gk.savesPerMatch)}</td></tr>) : <tr><td colSpan={6}>Ingen målvakt har en registrerad matchprestation ännu.</td></tr>}</tbody></table></div></Panel>
    </div>
    <aside className="game-secondary-rail" aria-label="Lagets mönster och nästa arbete">
      <Panel title="Observerade mönster"><div className="hm-panel-body"><ObservedPatternsList patterns={vm.patterns} /></div></Panel>
      <Panel title="Bedömning"><div className="hm-panel-body"><InterpretationsList interpretations={vm.interpretations} /></div></Panel>
      <section className="game-secondary-note"><h2>Ta analysen till planen</h2><p>Periodvalet gäller lagets anfalls- och försvarssiffror. Spelartabellerna visar hela säsongens registrerade prestationer.</p><div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/tactics">Matchplan →</Link><Link className="hm-btn hm-btn-sm" href="/career/training">Träningsvecka →</Link></div></section>
    </aside>
  </div>;
}
function MetricRows({rows}:{rows:[string,string][]}) { return <>{rows.map(([label,value]) => <div className="game-analysis-stat-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</>; }
