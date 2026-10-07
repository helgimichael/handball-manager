'use client';
import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { managementPlayers, squadEnergy } from '@/lib/career/management';
import { getCareerPlayerRating } from '@/lib/career/careerRatingNormalization';
import { resolvePlayerVisibility } from '@/lib/knowledge/playerVisibility';
import { getPlayerKnowledgePct } from '@/lib/knowledge/knowledgeIntegration';
import { getAttributeLabel } from '@/lib/rating/attributeVocabulary';
import type { OutcourtAttribute, GoalkeeperAttribute } from '@/lib/rating/types';
import { playerAgeAtDate } from '@/lib/development/developmentIntegration';
import { averageRating, emptyPlayerSeasonStats } from '@/lib/career/types';
import { formatEur } from '@/lib/economy/currency';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import PlayerActions from '@/components/manager/PlayerActions';
import { PageHeading, Panel, EmptyState } from '@/components/manager/Workspace';

const RELEVANT: Record<string, string[]> = {
  MV: ['GK_POSITIONING', 'REACTION', 'LOW_SAVES', 'HIGH_SAVES', 'ONE_ON_ONE', 'OUTLET_PASSING'],
  V6: ['FINISHING', 'SHOOTING_PLACEMENT', 'TOP_SPEED', 'ACCELERATION', 'GAME_READING', 'DEFENSIVE_POSITIONING'],
  H6: ['FINISHING', 'SHOOTING_PLACEMENT', 'TOP_SPEED', 'ACCELERATION', 'GAME_READING', 'DEFENSIVE_POSITIONING'],
  M6: ['FINISHING', 'BALL_HANDLING', 'CONTACT_ABILITY', 'STRENGTH', 'DEFENSIVE_POSITIONING', 'GAME_READING'],
  M9: ['PASSING', 'GAME_READING', 'DECISION_MAKING', 'BREAKTHROUGH', 'BALL_HANDLING', 'DEFENSIVE_POSITIONING'],
  V9: ['SHOOTING_POWER', 'SHOOTING_PLACEMENT', 'BREAKTHROUGH', 'PASSING', 'DECISION_MAKING', 'CONTACT_ABILITY'],
  H9: ['SHOOTING_POWER', 'SHOOTING_PLACEMENT', 'BREAKTHROUGH', 'PASSING', 'DECISION_MAKING', 'CONTACT_ABILITY'],
};
export default function ComparePage() { return <Suspense fallback={<EmptyState>Läser jämförelse…</EmptyState>}><Comparison /></Suspense>; }
function Comparison() {
  const { career } = useCareer();
  const params = useSearchParams();
  const router = useRouter();
  const players = useMemo(() => managementPlayers(career).sort((a, b) => a.lastName.localeCompare(b.lastName)), [career]);
  const left = players.find(p => p.id === params.get('left')) ?? players.find(p => p.clubId === career.playerClubId);
  const right = players.find(p => p.id === params.get('right'));
  const sides = [left, right];
  const values = sides.map(p => {
    if (!p) return null;
    const own = p.clubId === career.playerClubId;
    const rating = getCareerPlayerRating(career, p.id, p.clubId);
    const knowledge = own ? 100 : getPlayerKnowledgePct(career, p.id, p.clubId);
    return { player: p, own, rating, knowledge, visibility: rating ? resolvePlayerVisibility(rating, knowledge) : null, stats: career.playerSeasonStats[p.id] ?? emptyPlayerSeasonStats(p.id), contract: career.playerContracts[p.id] };
  });
  function select(side: string, id: string) { const next = new URLSearchParams(params.toString()); if (id) next.set(side, id); else next.delete(side); router.replace(`/career/compare?${next}`); }
  const keys = [...new Set(sides.flatMap(p => p ? RELEVANT[p.position] ?? [] : []))];
  function row(label: string, cells: (string | number | null | undefined)[]) { return <tr key={label}><th scope="row">{label}</th>{cells.map((cell, i) => <td key={i}>{cell ?? '—'}</td>)}</tr>; }
  return <><PageHeading eyebrow="Beslutsunderlag" title="Jämför spelare" description="Rollrelevanta egenskaper, prestation och avtalskostnad. Externa bedömningar följer scoutingens kännedom." />
    <div className="hm-comparison-select">{sides.map((p, i) => <label key={i}>{i ? 'Spelare B' : 'Spelare A'}<select className="hm-select" value={p?.id ?? ''} onChange={e => select(i ? 'right' : 'left', e.target.value)}><option value="">Välj spelare</option><optgroup label="Din trupp">{players.filter(p => p.clubId === career.playerClubId).map(p => <option key={p.id} value={p.id}>{p.position} · {p.firstName} {p.lastName}</option>)}</optgroup><optgroup label="Övriga världen">{players.filter(p => p.clubId !== career.playerClubId).map(p => <option key={p.id} value={p.id}>{p.position} · {p.firstName} {p.lastName} · {getClub(p.clubId)?.shortName ?? 'Fri agent'}</option>)}</optgroup></select></label>)}</div>
    <Panel title="Profil & prestation"><table className="hm-table hm-compare-table"><thead><tr><th>Mått</th>{sides.map((p, i) => <th key={i}>{p ? <PlayerLink playerId={p.id}>{p.firstName} {p.lastName}</PlayerLink> : 'Välj en spelare'}</th>)}</tr></thead><tbody>
      <tr><th scope="row">Klubb</th>{sides.map((p, i) => <td key={i}>{p?.clubId ? <ClubLink clubId={p.clubId}>{getClub(p.clubId)?.name ?? 'Okänd'}</ClubLink> : p ? 'Fri agent' : '—'}</td>)}</tr>
      {row('Position', sides.map(p => p?.position))}{row('Ålder', sides.map(p => p ? playerAgeAtDate(p.dateOfBirth, p.birthYear, career.gameDate) : null))}
      {row('Kännedom', values.map(v => v ? `${Math.round(v.knowledge)}%` : null))}
      {row('Bedömd nivå', values.map(v => v?.visibility ? `${v.visibility.abilityRange.min}–${v.visibility.abilityRange.max} ★` : null))}
      {row('Styrkor', values.map(v => v?.visibility?.strengths?.join(', ')))}
      {row('Utvecklingsområden', values.map(v => v?.visibility?.weaknesses?.join(', ')))}
      {row('Matcher / starter', values.map(v => v ? `${v.stats.appearances} / ${v.stats.starts}` : null))}
      {row('Mål / skott', values.map(v => v ? `${v.stats.goals} / ${v.stats.shots}` : null))}
      {row('Skotteffektivitet', values.map(v => v && v.stats.shots ? `${Math.round(v.stats.goals / v.stats.shots * 100)}% (${v.stats.shots} skott)` : null))}
      {row('Räddningar', values.map(v => v?.player.position === 'MV' ? v.stats.shotsFaced ? `${Math.round(v.stats.saves / v.stats.shotsFaced * 100)}% (${v.stats.saves}/${v.stats.shotsFaced})` : 'Inga skott mötta' : null))}
      {row('Snittbetyg', values.map(v => v && v.stats.appearances ? averageRating(v.stats).toFixed(1) : null))}
      {row('Energi', values.map(v => v?.own ? `${Math.round(squadEnergy(career, v.player))}%` : null))}
      {row('Avtal till', values.map(v => v?.contract?.contractEndDate))}
      {row('Lön / månad', values.map(v => v?.contract ? formatEur(v.contract.wageEurPerMonth) : null))}
    </tbody></table></Panel>
    <Panel title={`Egenskaper för ${left?.position ?? 'rollen'}${right && right.position !== left?.position ? ` / ${right.position}` : ''}`}><div className="hm-panel-body hm-text-muted">Egna spelare visar egenskaper på 1–20. Externa spelare jämförs genom scoutens styrkor och utvecklingsområden ovan.</div><table className="hm-table hm-compare-table"><tbody>{keys.map(key => row(getAttributeLabel(key as OutcourtAttribute | GoalkeeperAttribute), values.map(v => v?.own ? (v.rating?.branch.attributes as Record<string, { value: number }> | undefined)?.[key]?.value : null)))}</tbody></table></Panel>
    <div className="hm-comparison-select">{sides.map((p, i) => <div key={i}>{p && <PlayerActions player={p} />}</div>)}</div>
    {!right && <EmptyState>Välj spelare B för att jämföra med en lagkamrat eller ett rekryteringsmål. <Link href="/career/players">Sök efter en kandidat →</Link></EmptyState>}
  </>;
}
