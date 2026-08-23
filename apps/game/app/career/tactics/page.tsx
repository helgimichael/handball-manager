"use client";

// HM-TACTICS-1.1: turns the Tactics screen into the manager's Match
// Plan workspace, consuming HM-TACTICS-1.0's headless domain
// (lib/matchPlan/) instead of the old static, disconnected
// Startsju/Bänk display.
//
// HM-MATCH-1.1 Part 5: the old "Taktisk profil" panel (ATI-001/TI-001
// machine-language controls, "plumbing inför framtida Fast Match-
// integration" copy) is REMOVED from this normal manager-facing
// workspace -- `career.tacticalProfile` still exists and still feeds
// both the kickoff simulation (matchdayAction.ts) and every live
// coaching mechanism (tacticalMidMatchChange.ts), so the underlying
// domain is untouched; only the confusing, internal-terminology UI
// surface is gone. Its one remaining coach-facing exposure is the LIVE
// Match "Taktisk justering" panel, whose labels this milestone also
// rewrote into Swedish coaching language (see match-day/[fixtureId]/page.tsx).
import { useEffect, useMemo, useState } from "react";
import { getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerSquad } from "@/lib/career/careerWorld";
import { getNextPlayerFixture } from "@/lib/career/calendar";
import { buildInitialMatchSquad, toSelectablePlayers } from "@/lib/matchPlan/careerSquadBridge";
import { buildDefaultMatchPlan } from "@/lib/matchPlan/defaultMatchPlan";
import { buildMatchIdea } from "@/lib/matchPlan/matchPlanLabels";
import type { MatchPlan } from "@/lib/matchPlan/types";
import MatchSquadPanel from "@/components/matchPlan/MatchSquadPanel";
import StartingUnitEditor from "@/components/matchPlan/StartingUnitEditor";
import TacticalConfigPanel from "@/components/matchPlan/TacticalConfigPanel";
import PlayerInstructionPanel from "@/components/matchPlan/PlayerInstructionPanel";

export default function TacticsPage() {
  const { career, updateMatchPlan } = useCareer();
  const squad = getCareerSquad(career);
  const fixture = getNextPlayerFixture(career);

  const selectablePlayers = useMemo(() => toSelectablePlayers(squad), [squad]);
  const plan = fixture ? career.matchPlans[fixture.id] : undefined;

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // HM-TACTICS-1.0 Part O / HM-TACTICS-1.1 Part O: build and persist a
  // deterministic default plan the first time this fixture has none --
  // never a second, competing default algorithm here, only
  // lib/matchPlan's own buildDefaultMatchPlan.
  useEffect(() => {
    if (!fixture || plan) return;
    const initialSquad = buildInitialMatchSquad(squad, fixture.id, career.playerClubId);
    const result = buildDefaultMatchPlan(initialSquad, career.tactics[career.playerClubId], career.playerMatchDefaults);
    if (result.ok && result.plan) {
      updateMatchPlan(fixture.id, result.plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when the fixture or its saved plan changes, not on every squad re-derivation.
  }, [fixture?.id, plan]);

  if (!fixture) {
    return (
      <div className="hm-grid" style={{ gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Taktik</span>
          </div>
          <div className="hm-panel-body hm-text-muted">Ingen kommande match hittades -- en matchplan kan inte skapas förrän nästa match är inbokad.</div>
        </div>
      </div>
    );
  }

  const opponentClubId = fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId;
  const opponent = getClub(opponentClubId);
  const isHome = fixture.homeClubId === career.playerClubId;

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Taktik — matchplan</span>
          <span className="hm-badge hm-badge-neutral">
            {isHome ? "Hemma" : "Borta"} mot {opponent?.name ?? opponentClubId} · Omgång {fixture.round}
          </span>
        </div>
        {plan ? <MatchIdea plan={plan} /> : null}
      </div>

      {!plan ? (
        <div className="hm-panel">
          <div className="hm-panel-body hm-text-muted">Skapar matchplan…</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
          <div className="hm-grid" style={{ gap: 12 }}>
            <StartingUnitEditor plan={plan} selectablePlayers={selectablePlayers} onChange={(next) => updateMatchPlan(fixture.id, next)} onOpenPlayerPanel={setSelectedPlayerId} />
            <TacticalConfigPanel plan={plan} selectablePlayers={selectablePlayers} onChange={(next) => updateMatchPlan(fixture.id, next)} onOpenPlayerPanel={setSelectedPlayerId} />
          </div>
          <div className="hm-grid" style={{ gap: 12 }}>
            <MatchSquadPanel plan={plan} selectablePlayers={selectablePlayers} onChange={(next) => updateMatchPlan(fixture.id, next)} onOpenPlayerPanel={setSelectedPlayerId} />
          </div>
        </div>
      )}

      {plan && selectedPlayerId ? (
        <PlayerInstructionPanel
          plan={plan}
          playerId={selectedPlayerId}
          selectablePlayers={selectablePlayers}
          onChange={(next) => updateMatchPlan(fixture.id, next)}
          onClose={() => setSelectedPlayerId(null)}
        />
      ) : null}
    </div>
  );
}

// HM-TACTICS-1.2 Part 6: a real "Matchidé" -- grouped by phase instead
// of one long joined line, using only fields that exist on MatchPlan
// (buildMatchIdea), no AI-generated text.
function MatchIdea({ plan }: { plan: MatchPlan }) {
  const idea = buildMatchIdea(plan);
  const rows: { label: string; value: string }[] = [
    { label: "Försvar", value: idea.defence },
    { label: "Anfall", value: idea.attack },
    { label: "Omställning", value: idea.transition },
    { label: "Special", value: idea.special },
  ];
  return (
    <div className="hm-panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
      {rows.map((row) => (
        <div key={row.label}>
          <div className="hm-eyebrow">{row.label}</div>
          <div style={{ fontSize: "var(--hm-text-xs)" }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

