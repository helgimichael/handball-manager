"use client";
// Arena Nights 231 -- MED-01 C "Return-to-play timeline": the physio's note, a timeline of the injured players
// against the coming fixtures (which matches each one misses) beside availability for the next match, the
// rehab cards with a phase stepper (MED-01a A) and the recent returns. Read-only over the injury state and
// the rehab rules (lib/medical/returnToPlay.ts projects them; nothing is changed here).
import Link from "next/link";
import { useMemo } from "react";
import { EnvironmentBanner } from "@/components/clubhq/EnvironmentBanner";
import { SceneEmpty } from "@/components/game/Secondary";
import { PlayerLink } from "@/components/entityLinks";
import { NextMatchAvailability, PhysioQuote, RehabCards, ReturnTimelineView } from "@/components/medical/ReturnToPlay";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub, getCareerSquad } from "@/lib/career/careerWorld";
import { isSelectableForMatch } from "@/lib/career/playerStatus";
import { INJURY_TYPE_LABELS } from "@/lib/medical/labels";
import { computeMedicalRehabQuality, findBestPhysio } from "@/lib/medical/medicalStaffQuality";
import { returnTimeline } from "@/lib/medical/returnToPlay";

export default function MedicalPage() {
  const { career } = useCareer();
  const club = getCareerClub(career), squad = getCareerSquad(career);
  const roster = career.staffRoster[career.playerClubId] ?? [];
  const physio = findBestPhysio(roster), medicalQuality = computeMedicalRehabQuality(roster);
  const players = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);
  const timeline = useMemo(() => returnTimeline(career, squad.map((p) => p.id)), [career, squad]);
  const available = squad.filter((p) => isSelectableForMatch(career.playerStatuses, p.id));
  const recoveries = squad.flatMap((player) => (career.playerInjuries[player.id]?.injuryHistory ?? []).map((injury) => ({ player, injury }))).sort((a, b) => b.injury.returnDate.localeCompare(a.injury.returnDate)).slice(0, 5);
  const injured = timeline.rows.length;

  return (
    <div className="game-secondary-page md-page">
      <EnvironmentBanner
        environment="medical-room"
        eyebrow={`${club.name} · Medicinska kliniken · ${career.gameDate}`}
        title="Medicinskt & Rehabilitering"
        subtitle="Vem kan du välja på lördag? Rehabfaserna mot matcherna, med beräknad återgång."
        badge={injured ? `${injured} aktiva skador` : "Skadefri trupp"}
        actions={<><Link className="hm-btn hm-btn-sm" href="/career/training">Belastning & återhämtning →</Link><Link className="hm-btn hm-btn-sm" href="/career/squad">Truppens status →</Link></>}
        metrics={[
          { label: "Aktiva skador", value: `${injured} st`, sub: injured ? "Under rehab" : "Alla friska", tone: injured ? "warning" : "positive" },
          { label: "Tillgängliga", value: `${available.length} / ${squad.length}`, sub: "Uttagningsbara", tone: "positive" },
          { label: "Rehabkvalitet", value: `${medicalQuality.toFixed(2)}x`, sub: physio ? physio.displayName : "Ingen fysio", tone: "signal" },
        ]}
      />

      <PhysioQuote physio={physio} timeline={timeline} players={players} clubId={career.playerClubId} quality={medicalQuality} />

      {injured === 0 ? (
        <div className="md-split">
          <SceneEmpty title="Hela truppen är tillgänglig" actions={<Link className="hm-btn hm-btn-sm" href="/career/training">Planera återhämtningen →</Link>}>Inga aktiva skador -- alla {squad.length} spelare kan väljas. Belastning och återhämtning följs i träningsveckan.</SceneEmpty>
          <NextMatchAvailability timeline={timeline} players={players} clubId={career.playerClubId} available={available.length} squad={squad.length} />
        </div>
      ) : (
        <>
          <div className="md-split">
            <section className="md-panel" aria-labelledby="md-tl-title">
              <header className="md-head"><span className="xp-eyebrow">Kommande fyra veckor</span><h2 id="md-tl-title">Vägen tillbaka</h2></header>
              <ReturnTimelineView timeline={timeline} players={players} clubId={career.playerClubId} />
            </section>
            <NextMatchAvailability timeline={timeline} players={players} clubId={career.playerClubId} available={available.length} squad={squad.length} />
          </div>
          <section className="md-panel" aria-labelledby="md-cards-title">
            <header className="md-head"><span className="xp-eyebrow">Rehab</span><h2 id="md-cards-title">Aktiva skador</h2></header>
            <RehabCards timeline={timeline} players={players} career={career} />
          </section>
        </>
      )}

      <section className="md-panel" aria-labelledby="md-hist-title">
        <header className="md-head"><span className="xp-eyebrow">Historik</span><h2 id="md-hist-title">Senaste återgångar</h2></header>
        {recoveries.length ? <ul className="game-medical-history">{recoveries.map(({ player, injury }) => <li key={injury.injuryId}><PlayerLink playerId={player.id}>{player.firstName} {player.lastName}</PlayerLink><small>{INJURY_TYPE_LABELS[injury.injuryType]} · återgång {injury.returnDate}</small></li>)}</ul> : <p className="md-hint">Ingen avslutad rehabilitering registrerad ännu.</p>}
      </section>
    </div>
  );
}
