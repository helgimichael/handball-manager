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
import { defaultSpecialPlayPlan } from "@/lib/matchPlan/specialPlay";
import type { MatchPlan } from "@/lib/matchPlan/types";
import MatchSquadPanel from "@/components/matchPlan/MatchSquadPanel";
import StartingUnitEditor from "@/components/matchPlan/StartingUnitEditor";
import TacticalConfigPanel from "@/components/matchPlan/TacticalConfigPanel";
import PlayerInstructionPanel from "@/components/matchPlan/PlayerInstructionPanel";

export default function TacticsPage() {
  const { career, updateMatchPlan, setPlayerMatchDefault, updateSpecialPlay } = useCareer();
  const squad = getCareerSquad(career);
  const fixture = getNextPlayerFixture(career);
  const specialPlay = career.specialPlay[career.playerClubId] ?? defaultSpecialPlayPlan();

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
    <div className="hm-grid" style={{ gap: 20 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Taktik &amp; matchplan</span>
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
        <>
          {/* HM-MATCH-1.2 Part B: TAKTIK -- the club's PERSISTENT playing
              style. These choices stay until you change them, no matter
              which opponent is next. */}
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: "var(--hm-text-sm)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Taktik</h2>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Hur laget spelar i allmänhet — gäller framtida matcher tills du ändrar det.</span>
            </div>
            <TacticalConfigPanel plan={plan} specialPlay={specialPlay} selectablePlayers={selectablePlayers} onChange={(next) => updateMatchPlan(fixture.id, next)} onSpecialPlayChange={(next) => updateSpecialPlay(career.playerClubId, next)} onOpenPlayerPanel={setSelectedPlayerId} />
          </section>

          {/* HM-MATCH-1.2 Part B: MATCHPLAN -- fixture-specific squad
              selection and usage for THIS opponent only. */}
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: "var(--hm-text-sm)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Matchplan — {isHome ? "hemma" : "borta"} mot {opponent?.name ?? opponentClubId}
              </h2>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>Trupp, startuppställning och spelarroller för just denna match.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
              <div className="hm-grid" style={{ gap: 12 }}>
                <StartingUnitEditor plan={plan} selectablePlayers={selectablePlayers} onChange={(next) => updateMatchPlan(fixture.id, next)} onOpenPlayerPanel={setSelectedPlayerId} />
              </div>
              <div className="hm-grid" style={{ gap: 12 }}>
                <MatchSquadPanel plan={plan} selectablePlayers={selectablePlayers} onChange={(next) => updateMatchPlan(fixture.id, next)} onOpenPlayerPanel={setSelectedPlayerId} />
              </div>
            </div>
          </section>
        </>
      )}

      {plan && selectedPlayerId ? (
        <PlayerInstructionPanel
          plan={plan}
          playerId={selectedPlayerId}
          selectablePlayers={selectablePlayers}
          playerDefault={career.playerMatchDefaults[selectedPlayerId]}
          onChange={(next) => updateMatchPlan(fixture.id, next)}
          onSetAsDefault={(value) => setPlayerMatchDefault(selectedPlayerId, value)}
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

