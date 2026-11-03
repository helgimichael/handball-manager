"use client";
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub,getCareerSquad } from '@/lib/career/careerWorld';
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { isSelectableForMatch } from '@/lib/career/playerStatus';
import { computeMedicalRehabQuality,findBestPhysio } from '@/lib/medical/medicalStaffQuality';
import { INJURY_SEVERITY_LABELS,INJURY_TYPE_LABELS,REHAB_PHASE_LABELS } from '@/lib/medical/labels';
import { SectionScene,SceneEmpty,StaffMark } from '@/components/game/Secondary';
import { EnvironmentBanner } from '@/components/clubhq/EnvironmentBanner';
import { PlayerCell,playerAvailabilityLabel } from '@/components/game/Identity';
import ClubCrest from '@/components/ClubCrest';
import { Panel } from '@/components/manager/Workspace';
import { PlayerLink,ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';

export default function MedicalPage() {
  const { career }=useCareer();
  const club=getCareerClub(career),squad=getCareerSquad(career);
  const roster=career.staffRoster[career.playerClubId] ?? [];
  const physio=findBestPhysio(roster),medicalQuality=computeMedicalRehabQuality(roster);
  const injured=squad.map(player => ({player,injury:career.playerInjuries[player.id]?.activeInjury})).filter(e => e.injury).sort((a,b) => a.injury!.expectedReturnDate.localeCompare(b.injury!.expectedReturnDate));
  const available=squad.filter(p => isSelectableForMatch(career.playerStatuses,p.id));
  const recoveries=squad.flatMap(player => (career.playerInjuries[player.id]?.injuryHistory ?? []).map(injury => ({player,injury}))).sort((a,b) => b.injury.returnDate.localeCompare(a.injury.returnDate)).slice(0,5);
  const next=getNextPlayerFixture(career);
  const opponentId=next ? next.homeClubId===club.id ? next.awayClubId : next.homeClubId : null;
  return <div className="game-secondary-page">
    <EnvironmentBanner
      environment="medical-room"
      eyebrow={`${club.name} · Medicinska kliniken · ${career.gameDate}`}
      title="Medicinskt & Rehabilitering"
      subtitle="Tillgänglighet, diagnostik, rehabilitering och beräknad återgång. Följ spelarnas väg tillbaka till matchtruppen."
      badge={injured.length ? `${injured.length} aktiva skador` : "Skadefri trupp"}
      actions={
        <>
          <Link className="hm-btn hm-btn-sm" href="/career/training">Belastning & återhämtning →</Link>
          <Link className="hm-btn hm-btn-sm" href="/career/squad">Truppens status →</Link>
        </>
      }
      metrics={[
        { label: "Aktiva skador", value: `${injured.length} st`, sub: injured.length ? "Under rehab" : "Alla friska", tone: injured.length ? "warning" : "positive" },
        { label: "Tillgängliga", value: `${available.length} / ${squad.length}`, sub: "Uttagningsbara", tone: "positive" },
        { label: "Rehabkvalitet", value: `${medicalQuality.toFixed(2)}x`, sub: physio ? physio.displayName : "Ingen fysio", tone: "signal" },
      ]}
    />
    <div className="game-secondary-split">
      <div className="game-secondary-main">
        {injured.length ? <Panel title="Aktiva skador · beräknad återgång"><div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Spelare</th><th>Skada</th><th>Allvarlighetsgrad</th><th>Status</th><th>Rehabfas</th><th>Rehabframsteg</th><th>Beräknad återkomst</th></tr></thead><tbody>{injured.map(({player,injury}) => <tr key={player.id}><td><PlayerCell player={player} /></td><td>{INJURY_TYPE_LABELS[injury!.injuryType]}</td><td>{INJURY_SEVERITY_LABELS[injury!.severity]}</td><td><span className="hm-badge hm-badge-negative">{playerAvailabilityLabel(career,player.id)}</span></td><td>{REHAB_PHASE_LABELS[injury!.currentPhase]}</td><td><div className="game-medical-progress"><progress max={1} value={injury!.rehabProgress} aria-label={`Rehabilitering: ${player.firstName} ${player.lastName}`} /><span>{Math.round(injury!.rehabProgress*100)}%</span></div></td><td>{injury!.expectedReturnDate}</td></tr>)}</tbody></table></div></Panel> : <SceneEmpty title="Inga aktiva skador" actions={<Link className="hm-btn hm-btn-sm" href="/career/training">Planera återhämtningen →</Link>}>Truppen har inga registrerade aktiva skador. Belastning och återhämtning följs i träningsveckan; övrig tillgänglighet syns i truppen.</SceneEmpty>}
        <Panel title="Senaste återgångar">{recoveries.length ? <ul className="game-medical-history">{recoveries.map(({player,injury}) => <li key={injury.injuryId}><PlayerLink playerId={player.id}>{player.firstName} {player.lastName}</PlayerLink><small>{INJURY_TYPE_LABELS[injury.injuryType]} · återgång {injury.returnDate}</small></li>)}</ul> : <div className="hm-panel-body hm-text-muted">Ingen avslutad rehabilitering registrerad ännu.</div>}</Panel>
      </div>
      <aside className="game-secondary-rail">
        <Panel title="Ansvarig fysio"><div className="hm-panel-body">{physio ? <div className="game-staff-cell"><StaffMark name={physio.displayName} size={52} /><div><Link href={`/career/staff/${encodeURIComponent(physio.id)}`}>{physio.displayName}</Link><small>Öppna roll och egenskaper</small></div></div> : <><p>Ingen fysio finns i den registrerade personalgruppen.</p><Link className="hm-btn hm-btn-sm" href="/career/staff/recruitment">Rekrytera personal →</Link></>}<details style={{marginTop:18}}><summary className="hm-text-muted">Rehabiliteringens förutsättningar</summary><p className="hm-text-muted">Personalens aktuella rehabfaktor: {medicalQuality.toFixed(2)}x jämfört med grundnivån.</p></details></div></Panel>
        <section className="game-secondary-note"><h2>Inför nästa uttagning</h2>{next && opponentId ? <p><ClubLink clubId={opponentId}>{getClub(opponentId)?.name ?? opponentId}</ClubLink> · {next.date}. {available.length} spelare är tillgängliga för uttagning enligt truppens aktuella status.</p> : <p>Ingen kommande match registrerad för laget.</p>}<div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/tactics">Matchtrupp →</Link><Link className="hm-btn hm-btn-sm" href="/career/calendar">Kalender →</Link></div></section>
      </aside>
    </div>
  </div>;
}
