"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerPlayer } from '@/lib/career/careerWorld';
import { buildLastMatchViewModel } from '@/lib/analysis/viewModels';
import { fmtPct } from '@/lib/analysis/format';
import { InterpretationsList, MissingDataNote, ObservedPatternsList } from '@/components/analysis/EvidenceLists';
import { ANALYSIS_EVENT_LABEL, missingAnalysisLabel } from '@/components/analysis/presentation';
import { SceneEmpty } from '@/components/game/Secondary';
import { PlayerCell, Scoreboard } from '@/components/game/Identity';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import { Panel } from '@/components/manager/Workspace';
import type { MatchEventType } from '@handball-manager/game-simulation';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
const FILTERS:{label:string;types:MatchEventType[]|null}[]=[{label:'Alla',types:null},{label:'Mål',types:['GOAL']},{label:'Räddningar',types:['SAVE']},{label:'Bollförluster',types:['TURNOVER']},{label:'2 min',types:['TWO_MIN']},{label:'7m',types:['SEVEN_M']}];

export default function AnalysisLastMatchPage() {
  const { career }=useCareer();
  const vm=buildLastMatchViewModel(career);
  const [filterIdx,setFilterIdx]=useState(0);
  if(vm.status !== 'OK' || !vm.homeClub || !vm.awayClub) return <SceneEmpty title="Säsongens första match väntar" actions={<><Link className="hm-btn hm-btn-sm" href="/career/schedule">Kommande matcher →</Link><Link className="hm-btn hm-btn-sm" href="/career/history">Tidigare matcharkiv →</Link></>}>Det finns ingen spelad match för ditt lag den här säsongen ännu. Matchfakta och händelser sparas efter slutsignalen.</SceneEmpty>;
  const us=vm.teamComparison!.us,opp=vm.teamComparison!.opponent;
  const rows:[string,number|string,number|string][]=[['Mål',us.goals,opp.goals],['Skott',us.shots,opp.shots],['Skotteffektivitet',fmtPct(us.shots > 0 ? us.goals/us.shots : null),fmtPct(opp.shots > 0 ? opp.goals/opp.shots : null)],['Räddningar',us.saves,opp.saves],['Räddningsprocent',fmtPct(us.shotsFaced > 0 ? us.saves/us.shotsFaced : null),fmtPct(opp.shotsFaced > 0 ? opp.saves/opp.shotsFaced : null)],['Bollförluster',us.turnovers,opp.turnovers],['Utvisningar · 2 min',us.twoMinuteSuspensions,opp.twoMinuteSuspensions],['7m · mål / försök',`${us.sevenMetreGoals}/${us.sevenMetreAttempts}`,`${opp.sevenMetreGoals}/${opp.sevenMetreAttempts}`]];
  const filter=FILTERS[filterIdx];
  const events=(vm.timeline ?? []).filter(e => !filter.types || filter.types.includes(e.type));
  const ownClub=vm.isPlayerHome ? vm.homeClub : vm.awayClub;
  const opponent=vm.isPlayerHome ? vm.awayClub : vm.homeClub;
  return <div className="game-secondary-page">
    <Scoreboard homeClubId={vm.homeClub.id} awayClubId={vm.awayClub.id} homeScore={vm.homeGoals!} awayScore={vm.awayGoals!} label={`Senaste matchen · ${vm.date}`}><Link className="hm-btn hm-btn-sm" href={matchReportHref(vm.fixtureId ?? "")}>Matchrapport & repris →</Link></Scoreboard>
    <div className="game-secondary-split">
      <div className="game-secondary-main">
        <Panel title="Lagens matchfakta"><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Mått</th><th className="hm-table-num"><ClubLink clubId={ownClub.id}>{ownClub.shortName}</ClubLink> · vårt lag</th><th className="hm-table-num"><ClubLink clubId={opponent.id}>{opponent.shortName}</ClubLink></th></tr></thead><tbody>{rows.map(([label,ours,theirs]) => <tr key={label}><th scope="row">{label}</th><td className="hm-table-num hm-td-strong">{ours}</td><td className="hm-table-num">{theirs}</td></tr>)}</tbody></table></div></Panel>
        <Panel title="Spelarnas bidrag">{vm.ownPlayerProduction.ok ? <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th className="hm-table-num">Mål</th><th className="hm-table-num">Skott</th><th className="hm-table-num">Betyg</th></tr></thead><tbody>{vm.ownPlayerProduction.value.map(c => { const player=getCareerPlayer(career,c.playerId);return <tr key={c.playerId}><td>{player ? <PlayerCell player={player} /> : <PlayerLink playerId={c.playerId}>{c.playerId}</PlayerLink>}</td><td className="hm-table-num">{c.goals}</td><td className="hm-table-num">{c.shots}</td><td className="hm-table-num">{c.rating.toFixed(1)}</td></tr>; })}</tbody></table></div> : <div className="hm-panel-body"><MissingDataNote text={missingAnalysisLabel(vm.ownPlayerProduction.state)} /></div>}</Panel>
        <Panel title="Matchhändelser" actions={<div className="hm-actions">{FILTERS.map((f,i) => <button key={f.label} className="hm-btn hm-btn-sm" aria-pressed={filterIdx===i} onClick={() => setFilterIdx(i)}>{f.label}</button>)}</div>}>
          <div className="hm-panel-body game-analysis-timeline">{events.length ? <ul>{events.map((e,i) => { const club=e.side==='home' ? vm.homeClub! : vm.awayClub!; const player=e.playerId ? getCareerPlayer(career,e.playerId) : null;return <li key={i}><time>{e.minute}′</time><span>{ANALYSIS_EVENT_LABEL[e.type] ?? e.type} · <ClubLink clubId={club.id}>{club.shortName}</ClubLink>{player && <> · <PlayerLink playerId={player.id}>{player.lastName}</PlayerLink></>}</span><strong>{e.homeScoreAfter!==undefined && e.awayScoreAfter!==undefined ? `${e.homeScoreAfter}–${e.awayScoreAfter}` : ''}</strong></li>; })}</ul> : <MissingDataNote text="Ingen registrerad händelse av den här typen." />}</div>
        </Panel>
      </div>
      <aside className="game-secondary-rail" aria-label="Matchens perioder och slutsatser">
        <Panel title="Halvlekar"><table className="hm-table"><thead><tr><th>Period</th><th>Vårt lag</th><th>Motstånd</th></tr></thead><tbody>{[['Första',vm.halfSplit!.firstHalf],['Andra',vm.halfSplit!.secondHalf]].map(([label,half]) => { const h=half as NonNullable<typeof vm.halfSplit>['firstHalf'];return <tr key={String(label)}><th scope="row">{String(label)}</th><td>{vm.isPlayerHome ? h.home.goals : h.away.goals}</td><td>{vm.isPlayerHome ? h.away.goals : h.home.goals}</td></tr>; })}</tbody></table></Panel>
        <Panel title="Mål i följd"><div className="hm-panel-body">{vm.scoringRuns?.length ? <ul className="game-analysis-evidence">{vm.scoringRuns.map((run,i) => {const club=run.side==='home' ? vm.homeClub! : vm.awayClub!;return <li key={i}><small>{run.startMinute}′–{run.endMinute}′</small><ClubLink clubId={club.id}>{club.shortName}</ClubLink> · <strong>{run.goals}–0</strong><div className="hm-text-muted">Ställning efter följden: {run.scoreAfter.home}–{run.scoreAfter.away}</div></li>;})}</ul> : <MissingDataNote text="Ingen följd med minst tre mål i den här matchen." />}</div></Panel>
        <Panel title="Observerade mönster"><div className="hm-panel-body"><ObservedPatternsList patterns={vm.patterns} /></div></Panel><Panel title="Bedömning"><div className="hm-panel-body"><InterpretationsList interpretations={vm.interpretations} /></div></Panel>
      </aside>
    </div>
  </div>;
}
