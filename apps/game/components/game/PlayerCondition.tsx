"use client";
// HM-PLAYTEST-01 1.4/3.2: one way to show a player's condition everywhere.
// Five separate facts, never merged into one number:
//   availability  can he be selected (and why not)
//   recovery      rehab phase and progress of an active injury
//   return        expected return date
//   energy        today's physical readiness (an injured player can be fully rested)
//   match fitness sharpness for competitive handball
import type { CareerState } from "@/lib/career/types";
import { isSelectableForMatch } from "@/lib/career/playerStatus";
import { INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS, REHAB_PHASE_LABELS } from "@/lib/medical/labels";
import { matchFitnessBand, matchFitnessOf, MATCH_FITNESS_BAND_LABEL } from "@/lib/players/matchFitness";
import { squadEnergy } from "@/lib/career/management";
import type { PlayerMock } from "@/lib/game-data";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral"; consequence?: string }> = {
  AVAILABLE: { label: "Tillgänglig", tone: "ok" },
  INJURED: { label: "Skadad", tone: "bad", consequence: "Kan inte tas ut till match" },
  SUSPENDED: { label: "Avstängd", tone: "bad", consequence: "Kan inte tas ut till match" },
  RECOVERING: { label: "Rehab", tone: "warn", consequence: "Kan inte tas ut till match" },
  LIMITED: { label: "Begränsad återgång", tone: "warn", consequence: "Kan spela med begränsad belastning" },
  ON_PLACEMENT: { label: "Hos partnerklubb", tone: "neutral", consequence: "Inte tillgänglig för egna laget" },
  NATIONAL_TEAM: { label: "Med landslaget", tone: "neutral", consequence: "Inte tillgänglig under landslagsuppehållet" },
};

export function playerConditionFacts(career: CareerState, player: PlayerMock) {
  const availability = career.playerStatuses[player.id]?.availability ?? "AVAILABLE";
  const status = STATUS[availability] ?? STATUS.AVAILABLE;
  const injury = career.playerInjuries?.[player.id]?.activeInjury ?? null;
  const fitness = matchFitnessOf(career, player.id);
  return {
    availability,
    status,
    selectable: isSelectableForMatch(career.playerStatuses, player.id),
    injury,
    returnDate: injury?.expectedReturnDate ?? career.playerStatuses[player.id]?.returnDate ?? null,
    energy: Math.round(squadEnergy(career, player)),
    matchFitness: fitness,
    matchFitnessLabel: MATCH_FITNESS_BAND_LABEL[matchFitnessBand(fitness)],
  };
}

export function AvailabilityChip({ career, player }: { career: CareerState; player: PlayerMock }) {
  const f = playerConditionFacts(career, player);
  return <span className="hm-status" data-tone={f.status.tone} title={f.status.consequence}>{f.status.label}{f.returnDate && !f.selectable ? ` · åter ~${f.returnDate}` : ""}</span>;
}

export function ConditionMeters({ career, player, compact = false }: { career: CareerState; player: PlayerMock; compact?: boolean }) {
  const f = playerConditionFacts(career, player);
  return (
    <div className="hm-meter-pair" data-compact={compact}>
      <label><span>Energi</span><strong>{f.energy}%</strong></label>
      <meter min={0} max={100} low={55} high={80} optimum={100} value={f.energy} aria-label={`Energi ${f.energy}%`} />
      <label title="Matchträning: hur van spelaren är vid matchtempo. Byggs av speltid, tappas utan matcher.">
        <span>Matchträning</span><strong>{f.matchFitness}%</strong>
      </label>
      <meter min={0} max={100} low={50} high={80} optimum={100} value={f.matchFitness} aria-label={`Matchträning ${f.matchFitness}%`} />
    </div>
  );
}

/** The full card for a player profile. */
export function PlayerConditionPanel({ career, player }: { career: CareerState; player: PlayerMock }) {
  const f = playerConditionFacts(career, player);
  return (
    <section className="hm-panel hm-condition-panel" aria-label="Spelarens tillstånd">
      <div className="hm-panel-header"><span className="hm-panel-title">Tillstånd</span><AvailabilityChip career={career} player={player} /></div>
      <div className="hm-panel-body hm-condition-grid">
        <dl>
          <div><dt>Speltillstånd</dt><dd>{f.selectable ? "Kan tas ut till match" : f.status.consequence ?? "Inte tillgänglig"}</dd></div>
          {f.injury && <div><dt>Skada</dt><dd>{INJURY_TYPE_LABELS[f.injury.injuryType]} · {INJURY_SEVERITY_LABELS[f.injury.severity]}</dd></div>}
          {f.injury && <div><dt>Rehabilitering</dt><dd>{REHAB_PHASE_LABELS[f.injury.currentPhase]} · {Math.round(f.injury.rehabProgress * 100)}% av beräknad tid</dd></div>}
          {f.returnDate && !f.selectable && <div><dt>Beräknad återkomst</dt><dd>{f.returnDate}</dd></div>}
          <div><dt>Matchträning</dt><dd>{f.matchFitnessLabel}</dd></div>
        </dl>
        <ConditionMeters career={career} player={player} />
        {f.injury && f.energy >= 80 && <p className="hm-text-muted">Utvilad men skadad: energin är hög, men spelaren kan inte spela förrän skadan är läkt. Matchträningen sjunker under frånvaron.</p>}
      </div>
    </section>
  );
}
