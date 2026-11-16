"use client";
// Arena Nights -- ANL-03 A "Mirror comparison": opponent header -> them vs us per metric (8) with threat
// cards (4) -> recent matches. The window toggle drives both sides. Threat cards are shared with the
// match preview (MDY-01d) and gated by the scouting report's confidence; the report itself is still
// ordered and read in OpponentScoutingPanel.
import { useState } from 'react';
import Link from 'next/link';
import { OpponentScoutingPanel } from '@/components/scouting/OpponentScoutingPanel';
import { useCareer } from '@/lib/career/CareerContext';
import { buildOpponentViewModel } from '@/lib/analysis/viewModels';
import { getClubMatchHistory, sliceWindow } from '@/lib/analysis/matchHistory';
import { mirrorRows } from '@/lib/analysis/trends';
import { threatCards } from '@/lib/analysis/threats';
import { InterpretationsList, ObservedPatternsList } from '@/components/analysis/EvidenceLists';
import { MirrorChart, ThreatCards, WindowToggle } from '@/components/analysis/Trends';
import { SceneEmpty } from '@/components/game/Secondary';
import { MatchHero } from '@/components/game/Identity';
import { ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { Panel } from '@/components/manager/Workspace';
import FormDots from '@/components/FormDots';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { svOrdinal } from '@/lib/format/ordinal';

type W = 'LAST_5' | 'SEASON';

export default function AnalysisOpponentPage() {
  const { career } = useCareer();
  const [win, setWin] = useState<W>('LAST_5');
  const vm = buildOpponentViewModel(career);
  const next = getNextPlayerFixture(career);
  if (vm.status !== 'OK' || !vm.club || !next) return <SceneEmpty title="Ingen kommande motståndare" actions={<><Link className="hm-btn hm-btn-sm" href="/career/schedule">Matchprogrammet →</Link><Link className="hm-btn hm-btn-sm" href="/career/history">Säsongshistoriken →</Link></>}>Det finns ingen ospelad match för ditt lag i det aktuella matchprogrammet.</SceneEmpty>;
  const them = sliceWindow(getClubMatchHistory(career, vm.club.id), win);
  const us = sliceWindow(getClubMatchHistory(career, career.playerClubId), win);
  const mirror = mirrorRows(them, us);
  const report = career.opponentScouting?.reports[next.id];
  const cards = threatCards(report, mirror);
  const ownName = getClub(career.playerClubId)?.shortName ?? 'Vi';
  const stronger = mirror.filter((m) => m.stronger === 'them').length;
  return <div className="an-page">
    <MatchHero career={career} fixture={next} compact context="Motståndaranalys"><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/tactics">Öppna matchplan →</Link><Link className="hm-btn hm-btn-sm" href="/career/match-preview">Matchförberedelse →</Link></MatchHero>
    <div className="an-opp-facts"><span>{vm.competitionName}</span><span>Tabellplats {vm.leaguePosition?.ok ? svOrdinal(vm.leaguePosition.value) : '—'}</span><span className="an-form">Form <FormDots results={vm.form ?? []} /></span><ClubLink clubId={vm.club.id}>Klubb & trupp →</ClubLink></div>
    <div className="an-mirror-grid">
      <section className="an-section" aria-labelledby="an-mirror-h">
        <header><h2 id="an-mirror-h">{vm.club.shortName} mot {ownName}</h2><small>{them.length ? `${stronger} av ${mirror.length} mått där de är starkare · ${them.length} resp. ${us.length} matcher` : 'Motståndaren har inga spelade matcher ännu'}</small><WindowToggle label="Period" value={win} onChange={setWin} options={[{ id: 'LAST_5', label: 'Senaste fem' }, { id: 'SEASON', label: 'Hela säsongen' }]} /></header>
        <MirrorChart rows={mirror} them={vm.club.shortName} us={ownName} />
      </section>
      <section className="an-section" aria-labelledby="an-threat-h">
        <header><h2 id="an-threat-h">Hot</h2><small>{report ? `Scoutingrapport av ${report.staffName} · säkerhet ${Math.round(report.reliability * 100)} %` : 'Ingen scoutingrapport – bara offentliga resultat'}</small></header>
        <ThreatCards cards={cards} empty={<>Inga mått där motståndaren är tydligt starkare, och ingen scoutingrapport. <a href="#scout-title">Beställ en rapport ↓</a></>} />
      </section>
    </div>
    <Panel title="Motståndarens senaste matcher">
      <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Datum</th><th>Motstånd</th><th>H / B</th><th>Resultat</th><th className="hm-table-num">Skott</th><th className="hm-table-num">Bollförl.</th></tr></thead><tbody>{them.length ? [...them].reverse().map(row => <tr key={row.fixtureId}><td>{row.date}</td><td><ClubLink clubId={row.opponentClubId}>{getClub(row.opponentClubId)?.name ?? row.opponentClubId}</ClubLink></td><td>{row.isHome ? 'H' : 'B'}</td><td><Link className="hm-result-link" href={matchReportHref(row.fixtureId)}>{row.goalsFor}–{row.goalsAgainst}</Link></td><td className="hm-table-num">{row.own.shots}</td><td className="hm-table-num">{row.own.turnovers}</td></tr>) : <tr><td colSpan={6}>Motståndaren har ingen spelad match den här säsongen ännu.</td></tr>}</tbody></table></div>
    </Panel>
    <OpponentScoutingPanel />
    <details className="an-more"><summary>Observerade mönster och bedömning</summary><ObservedPatternsList patterns={vm.patterns} /><InterpretationsList interpretations={vm.interpretations} /></details>
  </div>;
}
