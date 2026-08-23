"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClub, type PlayerMock } from "@/lib/game-data";
import { getLiveTableStandings } from "@/lib/career/standings";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClubSquad, getCareerPlayer } from "@/lib/career/careerWorld";
import type { CareerState } from "@/lib/career/types";
import { commentaryLine, formatMatchMinute } from "@/lib/liveMatch/commentary";
import { useLiveMatch, type InstructionLifecycleStatus, type LastInstructionOutcome } from "@/lib/liveMatch/useLiveMatch";
import type { PlaybackSpeed } from "@/lib/liveMatch/clock";
import type { LiveTeamStats } from "@/lib/liveMatch/liveMatchView";
import { SHOUT_TYPES, shoutDeliveryMinute, shoutExpiryMinute, shoutLabel } from "@/lib/liveMatch/sidelineShout";
import type { SevenVSixInstruction } from "@/lib/liveMatch/sevenVSixMode";
import { assessImplementation, IMPLEMENTATION_DELAY_EXTENSION_MINUTES, type ImplementationOutcome } from "@/lib/liveMatch/implementationAssessment";
import type { MatchPlanChange } from "@/lib/liveMatch/matchPlanChange";
import { resolveCurrentMatchPlan } from "@/lib/career/matchPlanMidMatchChange";
import { DEFENCE_FORMATION_OPTIONS } from "@/components/matchPlan/courtScene";
import { INTENSITY_LABELS_SV, PHASE_USAGE_LABELS_SV, PLAYING_TIME_INTENTION_LABELS_SV, SUBSTITUTION_PRIORITY_LABELS_SV, TEMPO_LABELS_SV } from "@/lib/matchPlan/matchPlanLabels";
import { PLAYER_PHASE_USAGES, PLAYING_TIME_INTENTIONS } from "@/lib/matchPlan/types";
import {
  ATI001_USAGE_TENDENCY_VALUES,
  H2_RESPONSE_PREFERENCE_VALUES,
  TACTICAL_FAMILIARITY_VALUES,
  capabilityLevelLabel,
  h2ResponseLabel,
  type TeamTacticalProfile,
} from "@/lib/career/teamTacticalProfile";
import {
  detectOpponentAdaptationTrigger,
  OPPONENT_ADAPTATION_DAMPENING_FRACTION,
  OPPONENT_ADAPTATION_DELAY_MINUTES,
  OPPONENT_ADAPTATION_TRIGGER_MINUTES,
  type ObservableTacticalState,
  type OpponentAdaptationEffect,
  type OpponentAdaptationTrigger,
} from "@/lib/career/opponentAdaptation";
import { seedFromString, type PlayerMatchContribution } from "@handball-manager/game-simulation";
import ClubCrest from "@/components/ClubCrest";
import SegmentedControl from "@/components/SegmentedControl";

// CM-style live text match (HM-MATCH-0.1). The match is already fully
// simulated by the Fast Match Engine and applied to career state before
// this screen mounts (playManagerFixture ran when the manager clicked
// SPELA MATCH) -- this screen is a headless-controller-driven REVEAL of
// that one pre-generated, deterministic timeline over simulated time. It
// never decides or re-decides the result; refreshing this page just
// restarts the reveal from 00:00 against the same stored result (the
// career-side effects -- table, player stats, MATCH_COMPLETED -- are
// already durably applied and are never re-applied here).
const PHASE_LABEL: Record<string, string> = {
  PRE_MATCH: "Matchstart",
  FIRST_HALF: "Första halvlek",
  HALF_TIME: "Paus",
  SECOND_HALF: "Andra halvlek",
  TIMEOUT: "Timeout",
  FULL_TIME: "Full tid",
};

export default function MatchDayPage() {
  const params = useParams<{ fixtureId: string }>();
  const { career } = useCareer();

  const fixture = career.fixtures.find((f) => f.id === params.fixtureId);
  const result = career.results[params.fixtureId];

  return fixture && result ? (
    <LiveMatch fixture={fixture} result={result} />
  ) : (
    <div className="hm-panel">
      <div className="hm-panel-body hm-text-muted">Ingen matchdata hittades för denna fixture.</div>
    </div>
  );
}

function LiveMatch({
  fixture,
  result,
}: {
  fixture: { id: string; homeClubId: string; awayClubId: string };
  result: import("@handball-manager/game-simulation").FastMatchResult;
}) {
  const router = useRouter();
  const { career, applyMidMatchTacticalChange, applyMidMatchPlanChange } = useCareer();
  const logRef = useRef<HTMLDivElement>(null);

  // HM-TACTICS-0.7: the tactical profile actually in effect for THIS
  // match. Match-scoped, not the season-persistent career.tacticalProfile
  // (which stays exactly what the Tactics screen shows for future
  // fixtures) -- an in-match tweak is not the same thing as redefining
  // the manager's standing strategic identity.
  const [currentProfile, setCurrentProfile] = useState<TeamTacticalProfile>(career.tacticalProfile);
  const [draftProfile, setDraftProfile] = useState<TeamTacticalProfile>(career.tacticalProfile);
  // HM-TACTICS-0.8: 7v6 ON/OFF, match-scoped exactly like currentProfile
  // above -- never persisted to career state, and orthogonal to
  // TeamTacticalProfile (still exactly the 3 HM-TACTICS-0.6A fields).
  const [sevenVSixActive, setSevenVSixActive] = useState(false);
  // HM-TACTICS-0.9: since which simulated match minute the CURRENTLY
  // EFFECTIVE state has held -- the only thing the opponent's own
  // adaptation is allowed to observe (see opponentAdaptation.ts). Reset
  // to the landing minute on every landing, from whatever source
  // (instruction, shout, or the 7v6 switch itself).
  const [sevenVSixActiveSinceMinute, setSevenVSixActiveSinceMinute] = useState<number | null>(null);
  const [ati001HighSinceMinute, setAti001HighSinceMinute] = useState<number | null>(null);
  const [opponentAdaptationEffect, setOpponentAdaptationEffect] = useState<OpponentAdaptationEffect | null>(null);
  // HM-MATCH-0.2: Live Table is a display toggle only -- it computes a
  // PROVISIONAL table on demand (see standings.ts's getLiveTableStandings)
  // and never writes anything to CareerState.
  const [showLiveTable, setShowLiveTable] = useState(false);
  // HM-COACHING-1.0: local, UI-only picker state for the PLAYER section
  // of the live Matchplan panel -- never persisted, mirrors the existing
  // shout-type-button pattern (pick a target, click once to issue).
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [pairAttackPlayerId, setPairAttackPlayerId] = useState<string>("");
  const [pairDefencePlayerId, setPairDefencePlayerId] = useState<string>("");

  const updateAti001Tracking = useCallback((adoptionMinute: number, profile: TeamTacticalProfile) => {
    setAti001HighSinceMinute(profile.ati001UsageTendency === "HIGH" ? adoptionMinute : null);
  }, []);

  const handleInstructionAdopted = useCallback(
    (adoptionMinute: number, profile: TeamTacticalProfile) => {
      applyMidMatchTacticalChange(fixture.id, adoptionMinute, profile, sevenVSixActive, opponentAdaptationEffect);
      setCurrentProfile(profile);
      updateAti001Tracking(adoptionMinute, profile);
    },
    [applyMidMatchTacticalChange, fixture.id, sevenVSixActive, opponentAdaptationEffect, updateAti001Tracking],
  );

  // HM-COACHING-0.2: a shout's delivery/expiry each independently splice
  // via the exact same career action a permanent instruction uses --
  // the only difference is that expiry calls it a second time, later,
  // with the baseline profile captured at the moment the shout was
  // called, reverting the temporary override.
  const handleShoutDelivered = useCallback(
    (deliveryMinute: number, overrideProfile: TeamTacticalProfile) => {
      applyMidMatchTacticalChange(fixture.id, deliveryMinute, overrideProfile, sevenVSixActive, opponentAdaptationEffect);
      setCurrentProfile(overrideProfile);
      updateAti001Tracking(deliveryMinute, overrideProfile);
    },
    [applyMidMatchTacticalChange, fixture.id, sevenVSixActive, opponentAdaptationEffect, updateAti001Tracking],
  );
  const handleShoutExpired = useCallback(
    (expiryMinute: number, baselineProfile: TeamTacticalProfile) => {
      applyMidMatchTacticalChange(fixture.id, expiryMinute, baselineProfile, sevenVSixActive, opponentAdaptationEffect);
      setCurrentProfile(baselineProfile);
      updateAti001Tracking(expiryMinute, baselineProfile);
    },
    [applyMidMatchTacticalChange, fixture.id, sevenVSixActive, opponentAdaptationEffect, updateAti001Tracking],
  );

  // HM-TACTICS-0.8: 7v6 splices the CURRENT TeamTacticalProfile unchanged
  // alongside the newly adopted ON/OFF state -- 7v6 never touches the 3
  // profile fields, only whether the isolated 7v6 bonus/risk figures are
  // folded in (see tacticalMatchAdjustment.ts).
  const handleSevenVSixAdopted = useCallback(
    (adoptionMinute: number, active: boolean) => {
      applyMidMatchTacticalChange(fixture.id, adoptionMinute, currentProfile, active, opponentAdaptationEffect);
      setSevenVSixActive(active);
      setSevenVSixActiveSinceMinute(active ? adoptionMinute : null);
    },
    [applyMidMatchTacticalChange, fixture.id, currentProfile, opponentAdaptationEffect],
  );

  // HM-TACTICS-0.9: the opponent's own adaptation lands through the
  // exact same splice, once assessed -- see the halftime-triggered
  // effect below for how `assessedOpponentAdaptation` gets set.
  const handleOpponentAdaptationLanded = useCallback(
    (adoptionMinute: number, effect: OpponentAdaptationEffect) => {
      applyMidMatchTacticalChange(fixture.id, adoptionMinute, currentProfile, sevenVSixActive, effect);
      setOpponentAdaptationEffect(effect);
    },
    [applyMidMatchTacticalChange, fixture.id, currentProfile, sevenVSixActive],
  );

  // HM-COACHING-1.0: the MatchPlan actually in effect for this match RIGHT
  // NOW -- read directly from career state (`liveMatchPlans`, falling back
  // to the saved pre-match plan), never local component state, since the
  // splice already persists it. `applyMidMatchPlanChange` never touches
  // `career.matchPlans[fixture.id]` (Part C).
  const currentMatchPlan = resolveCurrentMatchPlan(career, fixture.id);
  const matchPlanChangeHistory = career.matchPlanChangeHistory[fixture.id] ?? [];

  const handleMatchPlanChangeAdopted = useCallback(
    (adoptionMinute: number, requestedMinute: number, change: MatchPlanChange) => {
      applyMidMatchPlanChange(fixture.id, adoptionMinute, requestedMinute, change, currentProfile, sevenVSixActive, opponentAdaptationEffect);
    },
    [applyMidMatchPlanChange, fixture.id, currentProfile, sevenVSixActive, opponentAdaptationEffect],
  );

  const {
    view,
    speed,
    setSpeed,
    startSecondHalf,
    instantResult,
    pendingInstruction,
    instructionStatus,
    lastInstructionOutcome,
    issueInstruction,
    canCallTimeout,
    callTimeout,
    endTimeout,
    timeoutSecondsRemaining,
    issueTimeoutInstruction,
    issueHalftimeInstruction,
    pendingShout,
    shoutStatus,
    issueShout,
    pendingSevenVSixInstruction,
    sevenVSixInstructionStatus,
    lastSevenVSixOutcome,
    issueSevenVSixInstruction,
    issueSevenVSixTimeoutInstruction,
    issueSevenVSixHalftimeInstruction,
    pendingMatchPlanChange,
    matchPlanChangeStatus,
    issueMatchPlanChange,
  } = useLiveMatch(result, handleInstructionAdopted, handleShoutDelivered, handleShoutExpired, handleSevenVSixAdopted, handleMatchPlanChangeAdopted);

  const home = getClub(fixture.homeClubId)!;
  const away = getClub(fixture.awayClubId)!;
  const homeSquad = getCareerClubSquad(career, fixture.homeClubId);
  const awaySquad = getCareerClubSquad(career, fixture.awayClubId);
  const isTimeout = view.phase === "TIMEOUT";
  const isHalfTime = view.phase === "HALF_TIME";
  const canIssueInstruction = !pendingInstruction && (view.phase === "FIRST_HALF" || view.phase === "SECOND_HALF");
  const canIssueTimeoutInstruction = !pendingInstruction && isTimeout;
  const canIssueHalftimeInstruction = !pendingInstruction && isHalfTime;
  const canIssueShout = !pendingShout && (view.phase === "FIRST_HALF" || view.phase === "SECOND_HALF");
  const canIssueSevenVSixSideline = !pendingSevenVSixInstruction && (view.phase === "FIRST_HALF" || view.phase === "SECOND_HALF");
  const canIssueSevenVSixTimeout = !pendingSevenVSixInstruction && isTimeout;
  const canIssueSevenVSixHalftime = !pendingSevenVSixInstruction && isHalfTime;
  const canIssueMatchPlanChange = !pendingMatchPlanChange && (view.phase === "FIRST_HALF" || view.phase === "SECOND_HALF");

  // HM-TACTICS-0.9: evaluated exactly once per match, the moment HALF_TIME
  // begins, using whatever state was observable through the FIRST HALF
  // (before any halftime decision the manager is about to make) -- "no
  // adaptation if there is nothing supported to react to" is just
  // detectOpponentAdaptationTrigger returning null. Only ever schedules
  // an assessed reaction; landing (with its own delay, below) can only
  // happen once the SECOND half is under way.
  const [assessedOpponentAdaptation, setAssessedOpponentAdaptation] = useState<{
    trigger: OpponentAdaptationTrigger;
    outcome: ImplementationOutcome;
    assessmentMinute: number;
    actualAdoptionMinute: number;
  } | null>(null);
  const halftimeAdaptationCheckedRef = useRef(false);
  const opponentAdaptationLandedRef = useRef(false);

  useEffect(() => {
    if (view.phase !== "HALF_TIME" || halftimeAdaptationCheckedRef.current) {
      return;
    }
    halftimeAdaptationCheckedRef.current = true;
    const observable: ObservableTacticalState = {
      sevenVSixActive,
      sevenVSixActiveSinceMinute,
      ati001UsageTendency: currentProfile.ati001UsageTendency,
      ati001HighSinceMinute,
    };
    const trigger = detectOpponentAdaptationTrigger(observable, 30);
    if (!trigger) {
      return;
    }
    const seed = seedFromString(`${result.seed}:opponentAdaptation:${trigger}`);
    const { outcome } = assessImplementation(seed, {
      tacticalFamiliarity: "MEDIUM",
      deliveryMode: "SIDELINE",
      changedUnitCount: 1,
      recentChangeCount: 0,
    });
    const assessmentMinute = Math.min(60, 30 + OPPONENT_ADAPTATION_DELAY_MINUTES);
    const actualAdoptionMinute = outcome === "DELAYED" ? Math.min(60, assessmentMinute + IMPLEMENTATION_DELAY_EXTENSION_MINUTES) : assessmentMinute;
    queueMicrotask(() => {
      setAssessedOpponentAdaptation({ trigger, outcome, assessmentMinute, actualAdoptionMinute });
    });
  }, [view.phase, sevenVSixActive, sevenVSixActiveSinceMinute, currentProfile.ati001UsageTendency, ati001HighSinceMinute, result.seed]);

  useEffect(() => {
    if (!assessedOpponentAdaptation || opponentAdaptationLandedRef.current) {
      return;
    }
    if (view.clockMinute < assessedOpponentAdaptation.actualAdoptionMinute) {
      return;
    }
    opponentAdaptationLandedRef.current = true;
    const { trigger, actualAdoptionMinute } = assessedOpponentAdaptation;
    queueMicrotask(() => {
      handleOpponentAdaptationLanded(actualAdoptionMinute, { trigger, dampeningFraction: OPPONENT_ADAPTATION_DAMPENING_FRACTION });
    });
  }, [assessedOpponentAdaptation, view.clockMinute, handleOpponentAdaptationLanded]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.revealedEvents.length]);

  const isFullTime = view.phase === "FULL_TIME";
  const commentaryEvents = [...view.revealedEvents].reverse();

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      {/* Scoreboard */}
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, padding: "16px 20px" }}>
          <TeamColumn clubId={home.id} attacking={view.currentAttack === "home"} />
          <div style={{ textAlign: "center", minWidth: 140 }}>
            <div style={{ fontSize: "var(--hm-text-2xl)", fontWeight: 800 }}>
              {view.homeScore} – {view.awayScore}
            </div>
            <div className="hm-eyebrow" style={{ marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {formatMatchMinute(view.clockMinute)}
            </div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", marginTop: 2 }}>
              {PHASE_LABEL[view.phase] ?? view.phase}
            </div>
            {view.currentAttack ? (
              <div className="hm-badge hm-badge-neutral" style={{ marginTop: 6, fontSize: "var(--hm-text-2xs)" }}>
                ANFALL: {view.currentAttack === "home" ? home.shortName : away.shortName}
              </div>
            ) : null}
          </div>
          <TeamColumn clubId={away.id} attacking={view.currentAttack === "away"} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        {/* Commentary */}
        <div className="hm-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kommentarer</span>
          </div>
          <div ref={logRef} style={{ height: 320, overflowY: "auto", padding: "6px 0" }}>
            {commentaryEvents.map((event, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "4px 14px",
                  fontSize: "var(--hm-text-xs)",
                  background: event.type === "GOAL" ? "var(--hm-accent-muted)" : undefined,
                }}
              >
                <span className="hm-text-muted" style={{ width: 40, fontVariantNumeric: "tabular-nums" }}>
                  {formatMatchMinute(event.minute)}
                </span>
                <span style={{ fontWeight: event.type === "GOAL" ? 700 : 400 }}>{commentaryLine(event, home.name, away.name, (id) => getCareerPlayer(career, id))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live team stats */}
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Live-statistik</span>
          </div>
          <div className="hm-panel-body">
            <StatsTable home={view.homeStats} away={view.awayStats} homeLabel={home.shortName} awayLabel={away.shortName} />
          </div>
        </div>
      </div>

      {/* HM-MATCH-0.2: player stats for BOTH teams -- goals live, shots/rating revealed at full time (Spec S12: do not fake live totals the timeline cannot reconstruct). The opponent's table is only ever as populated as the underlying result actually supports (Section A: a fixture simulated before this milestone, or an AI-vs-AI fixture, still legitimately has empty opponent contributions -- never a fabricated fallback). */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PlayerStatsPanel
          title={home.shortName}
          contributions={result.homePlayerContributions}
          liveGoals={view.homePlayerGoals}
          squad={homeSquad}
          isFullTime={isFullTime}
          career={career}
        />
        <PlayerStatsPanel
          title={away.shortName}
          contributions={result.awayPlayerContributions}
          liveGoals={view.awayPlayerGoals}
          squad={awaySquad}
          isFullTime={isFullTime}
          career={career}
        />
      </div>

      {/* HM-COACHING-0.1: timeout opens a dedicated coaching panel -- the sideline tactical panel below is hidden while it's up, since only one delivery channel can be active at a time. */}
      {isTimeout ? (
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Timeout — coaching</span>
            <span className="hm-badge hm-badge-neutral">{timeoutSecondsRemaining ?? 0}s kvar</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SegmentedControl
              label="ATI-001-benägenhet"
              value={draftProfile.ati001UsageTendency}
              options={ATI001_USAGE_TENDENCY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, ati001UsageTendency: v }))}
              disabled={!canIssueTimeoutInstruction}
            />
            <SegmentedControl
              label="H2-respons (TI-001)"
              value={draftProfile.h2ResponsePreference}
              options={H2_RESPONSE_PREFERENCE_VALUES}
              renderLabel={h2ResponseLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, h2ResponsePreference: v }))}
              disabled={!canIssueTimeoutInstruction}
            />
            <SegmentedControl
              label="Taktisk förtrogenhet"
              value={draftProfile.tacticalFamiliarity}
              options={TACTICAL_FAMILIARITY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, tacticalFamiliarity: v }))}
              disabled={!canIssueTimeoutInstruction}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="hm-btn hm-btn-sm hm-btn-primary"
                disabled={!canIssueTimeoutInstruction}
                onClick={() => issueTimeoutInstruction(draftProfile, currentProfile)}
              >
                BEORDRA ÄNDRING (TIMEOUT)
              </button>
              <button type="button" className="hm-btn hm-btn-sm" onClick={endTimeout}>
                ÅTERUPPTA →
              </button>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {pendingInstruction
                  ? `${instructionLabel(instructionStatus)} (timeout ger vanligtvis säkrare genomförande än en sidlinjeinstruktion, men garanterar det inte).`
                  : lastOutcomeLabel(lastInstructionOutcome) ?? "Ingen ändring beordrad under denna timeout -- matchtiden är fryst tills du återupptar."}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
              <span className="hm-eyebrow">7v6</span>
              <button
                type="button"
                className="hm-btn hm-btn-sm hm-btn-primary"
                disabled={!canIssueSevenVSixTimeout || sevenVSixActive}
                onClick={() => issueSevenVSixTimeoutInstruction("ON", currentProfile.tacticalFamiliarity)}
              >
                SLÅ PÅ (TIMEOUT)
              </button>
              <button
                type="button"
                className="hm-btn hm-btn-sm"
                disabled={!canIssueSevenVSixTimeout || !sevenVSixActive}
                onClick={() => issueSevenVSixTimeoutInstruction("OFF", currentProfile.tacticalFamiliarity)}
              >
                STÄNG AV (TIMEOUT)
              </button>
              <SevenVSixStatus pendingInstruction={pendingSevenVSixInstruction} status={sevenVSixInstructionStatus} active={sevenVSixActive} lastOutcome={lastSevenVSixOutcome} />
            </div>
          </div>
        </div>
      ) : isHalfTime ? (
        /* HM-TACTICS-0.9: halftime is a dedicated coaching window, mirroring the timeout panel but with a strictly BETTER delivery context (see implementationAssessment.ts's DELIVERY_SCORE) -- never a magical bonus, only improved delivery reliability. No new controls: the exact same 3 profile fields + 7v6. */
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Paus — laguppställning inför andra halvlek</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SegmentedControl
              label="ATI-001-benägenhet"
              value={draftProfile.ati001UsageTendency}
              options={ATI001_USAGE_TENDENCY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, ati001UsageTendency: v }))}
              disabled={!canIssueHalftimeInstruction}
            />
            <SegmentedControl
              label="H2-respons (TI-001)"
              value={draftProfile.h2ResponsePreference}
              options={H2_RESPONSE_PREFERENCE_VALUES}
              renderLabel={h2ResponseLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, h2ResponsePreference: v }))}
              disabled={!canIssueHalftimeInstruction}
            />
            <SegmentedControl
              label="Taktisk förtrogenhet"
              value={draftProfile.tacticalFamiliarity}
              options={TACTICAL_FAMILIARITY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, tacticalFamiliarity: v }))}
              disabled={!canIssueHalftimeInstruction}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="hm-btn hm-btn-sm hm-btn-primary"
                disabled={!canIssueHalftimeInstruction}
                onClick={() => issueHalftimeInstruction(draftProfile, currentProfile)}
              >
                GE MATCHPAUSTAL
              </button>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {pendingInstruction
                  ? `${instructionLabel(instructionStatus)} (en genomtänkt paustal ger bättre förutsättningar än en snabb instruktion under spel, men garanterar ingenting).`
                  : (lastOutcomeLabel(lastInstructionOutcome) ?? "Gäller för andra halvlek -- laget hör detta innan de går ut på planen igen.")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
              <span className="hm-eyebrow">7v6</span>
              <button
                type="button"
                className="hm-btn hm-btn-sm hm-btn-primary"
                disabled={!canIssueSevenVSixHalftime || sevenVSixActive}
                onClick={() => issueSevenVSixHalftimeInstruction("ON", currentProfile.tacticalFamiliarity)}
              >
                SLÅ PÅ FRÅN ANDRA HALVLEK
              </button>
              <button
                type="button"
                className="hm-btn hm-btn-sm"
                disabled={!canIssueSevenVSixHalftime || !sevenVSixActive}
                onClick={() => issueSevenVSixHalftimeInstruction("OFF", currentProfile.tacticalFamiliarity)}
              >
                STÄNG AV FRÅN ANDRA HALVLEK
              </button>
              <SevenVSixStatus pendingInstruction={pendingSevenVSixInstruction} status={sevenVSixInstructionStatus} active={sevenVSixActive} lastOutcome={lastSevenVSixOutcome} />
            </div>
          </div>
        </div>
      ) : (
        /* HM-TACTICS-0.7: in-match tactical adjustment (only the 3 HM-TACTICS-0.6A controls -- no shouts/7v6/receptiveness here). */
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Taktisk justering (live)</span>
            <span className="hm-badge hm-badge-neutral">{pendingInstruction ? instructionLabel(instructionStatus) : "AKTUELL"}</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SegmentedControl
              label="ATI-001-benägenhet"
              value={draftProfile.ati001UsageTendency}
              options={ATI001_USAGE_TENDENCY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, ati001UsageTendency: v }))}
              disabled={!canIssueInstruction}
            />
            <SegmentedControl
              label="H2-respons (TI-001)"
              value={draftProfile.h2ResponsePreference}
              options={H2_RESPONSE_PREFERENCE_VALUES}
              renderLabel={h2ResponseLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, h2ResponsePreference: v }))}
              disabled={!canIssueInstruction}
            />
            <SegmentedControl
              label="Taktisk förtrogenhet"
              value={draftProfile.tacticalFamiliarity}
              options={TACTICAL_FAMILIARITY_VALUES}
              renderLabel={capabilityLevelLabel}
              onChange={(v) => setDraftProfile((p) => ({ ...p, tacticalFamiliarity: v }))}
              disabled={!canIssueInstruction}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="hm-btn hm-btn-sm hm-btn-primary"
                disabled={!canIssueInstruction}
                onClick={() => issueInstruction(draftProfile, currentProfile)}
              >
                BEORDRA ÄNDRING
              </button>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {pendingInstruction
                  ? `Beordrad vid ${formatMatchMinute(pendingInstruction.issuedMinute)} -- laget bedömer och genomför det aldrig i det redan spelade förloppet.`
                  : (lastOutcomeLabel(lastInstructionOutcome) ?? `CURRENT: gäller från matchstart${currentProfile !== career.tacticalProfile ? " (justerad under matchen)" : ""}.`)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* HM-COACHING-1.0: live MatchPlan coaching -- the MatchPlan
          counterpart to the TeamTacticalProfile panel above. Uses the
          exact same MatchPlan edit functions and MatchUsage/Tactical-
          Effects/Player-Strength engines as the pre-match Tactics
          workspace (Part U); never available during TIMEOUT/HALF_TIME
          in v1 (Part D: kept small -- SIDELINE delivery only). */}
      {currentMatchPlan && !isTimeout && !isHalfTime ? (
        <MatchPlanCoachingPanel
          career={career}
          plan={currentMatchPlan}
          pendingChange={pendingMatchPlanChange}
          changeStatus={matchPlanChangeStatus}
          canIssue={canIssueMatchPlanChange}
          issueChange={issueMatchPlanChange}
          history={matchPlanChangeHistory}
          selectedPlayerId={selectedPlayerId}
          setSelectedPlayerId={setSelectedPlayerId}
          pairAttackPlayerId={pairAttackPlayerId}
          setPairAttackPlayerId={setPairAttackPlayerId}
          pairDefencePlayerId={pairDefencePlayerId}
          setPairDefencePlayerId={setPairDefencePlayerId}
        />
      ) : null}

      {/* HM-COACHING-0.2: sideline shouts -- a small, TEMPORARY nudge (issued -> pending -> active -> expired) distinct from the permanent tactical instruction/timeout panels above. Never available during a TIMEOUT or HALF_TIME (play isn't live to shout into). */}
      {!isTimeout && !isHalfTime ? (
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Sidlinjerop</span>
            {pendingShout ? (
              <span className="hm-badge hm-badge-neutral">
                {shoutLabel(pendingShout.type)} — {shoutStatus}
                {shoutStatus === "PENDING" ? ` (aktiveras ${formatMatchMinute(shoutDeliveryMinute(pendingShout))})` : null}
                {shoutStatus === "ACTIVE" ? ` (upphör ${formatMatchMinute(shoutExpiryMinute(pendingShout))})` : null}
              </span>
            ) : (
              <span className="hm-badge hm-badge-neutral">INGET AKTIVT ROP</span>
            )}
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SHOUT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="hm-btn hm-btn-sm"
                  disabled={!canIssueShout}
                  onClick={() => issueShout(type, currentProfile)}
                >
                  {shoutLabel(type)}
                </button>
              ))}
            </div>
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Ett rop i taget -- upprepade rop staplar aldrig, och ett rop återgår alltid automatiskt till taktiken som gällde när det ropades.
            </span>
          </div>
        </div>
      ) : null}

      {/* HM-TACTICS-0.8: 7v6 -- a PERSISTENT tactical mode (not a shout: stays ON until explicitly switched OFF), using the same issued -> pending -> adopted flow as the permanent tactical instruction panel above. Available both here (sideline delivery) and, faster, from the timeout coaching panel above. */}
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">7v6</span>
          <SevenVSixStatus pendingInstruction={pendingSevenVSixInstruction} status={sevenVSixInstructionStatus} active={sevenVSixActive} lastOutcome={lastSevenVSixOutcome} />
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="hm-btn hm-btn-sm hm-btn-primary"
              disabled={!canIssueSevenVSixSideline || sevenVSixActive}
              onClick={() => issueSevenVSixInstruction("ON", currentProfile.tacticalFamiliarity)}
            >
              SLÅ PÅ 7v6
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              disabled={!canIssueSevenVSixSideline || !sevenVSixActive}
              onClick={() => issueSevenVSixInstruction("OFF", currentProfile.tacticalFamiliarity)}
            >
              STÄNG AV 7v6
            </button>
          </div>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
            Extra anfallare istället för målvakt -- fler anfallsmöjligheter, men högre risk om bollen tappas. Ett byte i taget; en timeout levererar bytet snabbare än en vanlig sidlinjeinstruktion.
            Håller ni det igång i {OPPONENT_ADAPTATION_TRIGGER_MINUTES}+ minuter kan motståndaren märka mönstret och anpassa sig.
          </span>
        </div>
      </div>

      {/* HM-MATCH-0.2: Live Table -- a PROVISIONAL standings view computed on demand from CareerState (never stored/mutated there), with the currently-watched fixture's score taken from the live-revealed view instead of its already-final stored result. Every other fixture shown is genuinely already complete (see standings.ts's getLiveTableStandings doc) -- nothing here fabricates a simultaneous match the calendar can't yet represent. */}
      {showLiveTable ? (
        <LiveTablePanel career={career} fixture={fixture} homeScore={view.homeScore} awayScore={view.awayScore} onClose={() => setShowLiveTable(false)} />
      ) : null}

      {/* HM-TACTICS-0.9: the smallest deterministic opponent-adaptation notice -- only ever shown once the opponent has actually noticed a sustained first-half pattern (see opponentAdaptation.ts); nothing renders at all otherwise ("no adaptation if there is nothing supported to react to"). Discrete labels only, no exposed scores/probabilities. */}
      <OpponentAdaptationPanel assessed={assessedOpponentAdaptation} clockMinute={view.clockMinute} />

      {/* Controls */}
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {isHalfTime ? (
            <button type="button" className="hm-btn hm-btn-primary" onClick={startSecondHalf}>
              START ANDRA HALVLEK →
            </button>
          ) : isFullTime ? (
            <>
              <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push(`/career/match-report/${fixture.id}`)}>
                MATCHRAPPORT →
              </button>
              <button type="button" className="hm-btn" onClick={() => router.push("/career")}>
                FORTSÄTT
              </button>
            </>
          ) : isTimeout ? (
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Matchen är pausad under timeouten -- se coaching-panelen ovan.
            </span>
          ) : (
            <>
              <SpeedButton current={speed} target="PAUSED" label="PAUS" onSelect={setSpeed} />
              <SpeedButton current={speed} target="X1" label="1×" onSelect={setSpeed} />
              <SpeedButton current={speed} target="X2" label="2×" onSelect={setSpeed} />
              <SpeedButton current={speed} target="X4" label="4×" onSelect={setSpeed} />
              <SpeedButton current={speed} target="X8" label="8×" onSelect={setSpeed} />
              <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={instantResult}>
                DIREKT RESULTAT
              </button>
              <button type="button" className="hm-btn hm-btn-sm" disabled={!canCallTimeout} onClick={callTimeout}>
                TA TIMEOUT
              </button>
            </>
          )}
          <button
            type="button"
            className={`hm-btn hm-btn-sm${showLiveTable ? " hm-btn-primary" : ""}`}
            onClick={() => setShowLiveTable((v) => !v)}
          >
            {showLiveTable ? "DÖLJ LIVE-TABELL" : "LIVE-TABELL"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpeedButton({
  current,
  target,
  label,
  onSelect,
}: {
  current: PlaybackSpeed;
  target: PlaybackSpeed;
  label: string;
  onSelect: (speed: PlaybackSpeed) => void;
}) {
  return (
    <button
      type="button"
      className={`hm-btn hm-btn-sm${current === target ? " hm-btn-primary" : ""}`}
      onClick={() => onSelect(target)}
    >
      {label}
    </button>
  );
}

/**
 * HM-MATCH-0.2: one team's live player table -- used for both home and
 * away so the manager's own side and the opponent get equivalent
 * information. Goals come from the live-revealed timeline (updates as
 * the match plays); shots/rating only ever appear once the match reaches
 * FULL_TIME, since they are not event-attributable minute-by-minute (see
 * liveMatchView.ts's own doc). If `contributions` is empty (no roster was
 * available when this fixture was simulated -- e.g. an AI-vs-AI fixture,
 * or one played before this milestone), the panel says so honestly
 * instead of rendering an empty table.
 */
function PlayerStatsPanel({
  title,
  contributions,
  liveGoals,
  squad,
  isFullTime,
  career,
}: {
  title: string;
  contributions: readonly PlayerMatchContribution[];
  liveGoals: Record<string, number>;
  squad: readonly PlayerMock[];
  isFullTime: boolean;
  career: CareerState;
}) {
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Spelarstatistik — {title}</span>
      </div>
      {contributions.length === 0 ? (
        <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          Ingen spelartrupp tillgänglig för denna match.
        </div>
      ) : (
        <table className="hm-table">
          <thead>
            <tr>
              <th>Spelare</th>
              <th className="hm-table-num">Mål</th>
              <th className="hm-table-num">Skott</th>
              <th className="hm-table-num">Betyg</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((c) => {
              const player = getCareerPlayer(career, c.playerId) ?? squad.find((p) => p.id === c.playerId);
              const goals = liveGoals[c.playerId] ?? 0;
              return (
                <tr key={c.playerId}>
                  <td className="hm-td-strong">{player ? `${player.firstName} ${player.lastName}` : c.playerId}</td>
                  <td className="hm-table-num">{goals}</td>
                  <td className="hm-table-num">{isFullTime ? c.shots : "—"}</td>
                  <td className="hm-table-num">{isFullTime ? c.rating.toFixed(1) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatsTable({
  home,
  away,
  homeLabel,
  awayLabel,
}: {
  home: LiveTeamStats;
  away: LiveTeamStats;
  homeLabel: string;
  awayLabel: string;
}) {
  return (
    <table className="hm-table">
      <thead>
        <tr>
          <th>{homeLabel}</th>
          <th></th>
          <th>{awayLabel}</th>
        </tr>
      </thead>
      <tbody>
        <StatRow label="Mål" home={home.goals} away={away.goals} />
        <StatRow label="Skott" home={home.shots} away={away.shots} />
        <StatRow label="Skott-%" home={`${home.shootingPct}%`} away={`${away.shootingPct}%`} />
        <StatRow label="Räddningar" home={home.saves} away={away.saves} />
        <StatRow label="Tekniska fel" home={home.turnovers} away={away.turnovers} />
        <StatRow label="Utvisningar" home={home.twoMinuteSuspensions} away={away.twoMinuteSuspensions} />
        <StatRow label="7-meter" home={`${home.sevenMetreGoals}/${home.sevenMetreAttempts}`} away={`${away.sevenMetreGoals}/${away.sevenMetreAttempts}`} />
      </tbody>
    </table>
  );
}

function StatRow({ label, home, away }: { label: string; home: string | number; away: string | number }) {
  return (
    <tr>
      <td className="hm-table-num hm-td-strong">{home}</td>
      <td className="hm-text-muted" style={{ textAlign: "center", fontSize: "var(--hm-text-2xs)" }}>
        {label}
      </td>
      <td className="hm-table-num hm-td-strong">{away}</td>
    </tr>
  );
}

/**
 * HM-COACHING-0.3: the 4 discrete labels Live Match ever shows for an
 * in-flight assessed instruction/7v6 switch -- deliberately just the
 * outcome name, never the underlying quality score/probabilities
 * (Spec: "avoid exposing fake precision").
 */
function instructionLabel(status: InstructionLifecycleStatus | null): string {
  switch (status) {
    case "PENDING":
      return "PENDING";
    case "DELAYED":
      return "DELAYED — tar längre tid än väntat";
    case "PARTIAL":
      return "PARTIAL — delvis genomförd";
    case "ADOPTED":
      return "ADOPTED";
    default:
      return "";
  }
}

function lastOutcomeLabel(last: LastInstructionOutcome | null): string | null {
  if (!last) return null;
  if (last.outcome === "PARTIAL") return `Senast beordrade ändring genomfördes bara PARTIELLT (minut ${formatMatchMinute(last.landedMinute)}).`;
  if (last.outcome === "DELAYED") return `Senast beordrade ändring genomfördes till slut, men tog längre tid än väntat (minut ${formatMatchMinute(last.landedMinute)}).`;
  return null;
}

/**
 * HM-COACHING-1.0: the compact live "coach the match" panel -- FÖRSVAR /
 * ANFALL / OMSTÄLLNING / SPELARE, each showing the CURRENT MatchPlan
 * state and issuing ONE change at a time (Part E: "do not create giant
 * forms" -- every control commits immediately on click, no separate
 * draft/save step, matching the existing 7v6/shout panels' own "click
 * once to issue" idiom rather than the profile panel's draft pattern).
 * 7v6 itself is deliberately NOT duplicated here (Part L) -- it stays in
 * its own panel below, which this panel just points to.
 */
function MatchPlanCoachingPanel({
  career,
  plan,
  pendingChange,
  changeStatus,
  canIssue,
  issueChange,
  history,
  selectedPlayerId,
  setSelectedPlayerId,
  pairAttackPlayerId,
  setPairAttackPlayerId,
  pairDefencePlayerId,
  setPairDefencePlayerId,
}: {
  career: CareerState;
  plan: import("@/lib/matchPlan/types").MatchPlan;
  pendingChange: { issuedMinute: number; change: MatchPlanChange } | null;
  changeStatus: "PENDING" | "ADOPTED" | null;
  canIssue: boolean;
  issueChange: (change: MatchPlanChange) => void;
  history: readonly { id: string; label: string; requestedMinute: number; adoptedMinute: number }[];
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
  pairAttackPlayerId: string;
  setPairAttackPlayerId: (id: string) => void;
  pairDefencePlayerId: string;
  setPairDefencePlayerId: (id: string) => void;
}) {
  const nameOf = (playerId: string) => {
    const player = getCareerPlayer(career, playerId);
    return player ? `${player.firstName} ${player.lastName}` : playerId;
  };
  const squadPlayers = plan.squad.players.filter((p) => p.position !== "GK");
  const selectedUsage = plan.playerUsage.find((u) => u.playerId === selectedPlayerId);

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Matchplan (live)</span>
        <span className="hm-badge hm-badge-neutral">{pendingChange && changeStatus ? instructionLabel(changeStatus) : "AKTUELL"}</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
            Försvar
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SegmentedControl
              label="Formation"
              value={plan.defencePlan.baseFormation}
              options={DEFENCE_FORMATION_OPTIONS as readonly string[]}
              renderLabel={(v) => v}
              onChange={(baseFormation) => issueChange({ category: "DEFENCE", kind: "FORMATION", baseFormation })}
              disabled={!canIssue}
            />
            <SegmentedControl
              label="Risknivå"
              value={plan.defencePlan.riskLevel}
              options={["LOW", "MEDIUM", "HIGH"] as const}
              renderLabel={(v) => INTENSITY_LABELS_SV[v]}
              onChange={(riskLevel) => issueChange({ category: "DEFENCE", kind: "RISK", riskLevel })}
              disabled={!canIssue}
            />
            <SegmentedControl
              label="Kontakt"
              value={plan.defencePlan.contactIntent}
              options={["LOW", "MEDIUM", "HIGH"] as const}
              renderLabel={(v) => INTENSITY_LABELS_SV[v]}
              onChange={(contactIntent) => issueChange({ category: "DEFENCE", kind: "CONTACT", contactIntent })}
              disabled={!canIssue}
            />
          </div>
        </div>

        <div>
          <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
            Anfall
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SegmentedControl
              label="Tempo"
              value={plan.attackPlan.tempo}
              options={["SLOW", "BALANCED", "FAST"] as const}
              renderLabel={(v) => TEMPO_LABELS_SV[v]}
              onChange={(tempo) => issueChange({ category: "ATTACK", kind: "TEMPO", tempo })}
              disabled={!canIssue}
            />
            <SegmentedControl
              label="M6-fokus"
              value={plan.attackPlan.pivotUsage}
              options={["LOW", "MEDIUM", "HIGH"] as const}
              renderLabel={(v) => INTENSITY_LABELS_SV[v]}
              onChange={(pivotUsage) => issueChange({ category: "ATTACK", kind: "PIVOT_USAGE", pivotUsage })}
              disabled={!canIssue}
            />
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              7 mot 6 hanteras i egen panel nedan.
            </span>
          </div>
        </div>

        <div>
          <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
            Omställning
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SegmentedControl
              label="Anfallsintention"
              value={plan.transitionPlan.offensiveTransitionIntent}
              options={["LOW", "MEDIUM", "HIGH"] as const}
              renderLabel={(v) => INTENSITY_LABELS_SV[v]}
              onChange={(offensiveTransitionIntent) => issueChange({ category: "TRANSITION", kind: "OFFENSIVE_INTENT", offensiveTransitionIntent })}
              disabled={!canIssue}
            />
            <SegmentedControl
              label="Bytesprioritet"
              value={plan.transitionPlan.substitutionPriority}
              options={["ATTACK_FIRST", "DEFENCE_FIRST", "BALANCED"] as const}
              renderLabel={(v) => SUBSTITUTION_PRIORITY_LABELS_SV[v]}
              onChange={(substitutionPriority) => issueChange({ category: "TRANSITION", kind: "SUBSTITUTION_PRIORITY", substitutionPriority })}
              disabled={!canIssue}
            />
          </div>
        </div>

        <div>
          <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
            Spelare
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select className="hm-select" value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} style={selectStyle}>
              <option value="">Välj spelare...</option>
              {squadPlayers.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {nameOf(p.playerId)}
                </option>
              ))}
            </select>
            {selectedUsage ? (
              <>
                <SegmentedControl
                  label="Speltid"
                  value={selectedUsage.playingTimeIntention}
                  options={PLAYING_TIME_INTENTIONS}
                  renderLabel={(v) => PLAYING_TIME_INTENTION_LABELS_SV[v]}
                  onChange={(playingTimeIntention) => issueChange({ category: "PLAYER", kind: "PLAYING_TIME", playerId: selectedPlayerId, playerName: nameOf(selectedPlayerId), playingTimeIntention })}
                  disabled={!canIssue}
                />
                <SegmentedControl
                  label="Fasanvändning"
                  value={selectedUsage.phaseUsage}
                  options={PLAYER_PHASE_USAGES}
                  renderLabel={(v) => PHASE_USAGE_LABELS_SV[v]}
                  onChange={(phaseUsage) => issueChange({ category: "PLAYER", kind: "PHASE_USAGE", playerId: selectedPlayerId, playerName: nameOf(selectedPlayerId), phaseUsage })}
                  disabled={!canIssue}
                />
              </>
            ) : null}

            <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                Specialistbyte (anfall ⇄ försvar)
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select className="hm-select" value={pairAttackPlayerId} onChange={(e) => setPairAttackPlayerId(e.target.value)} style={selectStyle}>
                  <option value="">Anfallsspelare...</option>
                  {squadPlayers.map((p) => (
                    <option key={p.playerId} value={p.playerId}>
                      {nameOf(p.playerId)}
                    </option>
                  ))}
                </select>
                <span>⇄</span>
                <select className="hm-select" value={pairDefencePlayerId} onChange={(e) => setPairDefencePlayerId(e.target.value)} style={selectStyle}>
                  <option value="">Försvarsspelare...</option>
                  {squadPlayers.map((p) => (
                    <option key={p.playerId} value={p.playerId}>
                      {nameOf(p.playerId)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="hm-btn hm-btn-sm hm-btn-primary"
                  disabled={!canIssue || !pairAttackPlayerId || !pairDefencePlayerId || pairAttackPlayerId === pairDefencePlayerId}
                  onClick={() =>
                    issueChange({
                      category: "PLAYER",
                      kind: "SPECIALIST_PAIR",
                      attackPlayerId: pairAttackPlayerId,
                      attackPlayerName: nameOf(pairAttackPlayerId),
                      defencePlayerId: pairDefencePlayerId,
                      defencePlayerName: nameOf(pairDefencePlayerId),
                    })
                  }
                >
                  BEORDRA BYTE
                </button>
              </div>
            </div>
          </div>
        </div>

        <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          {pendingChange
            ? `Beordrad vid ${formatMatchMinute(pendingChange.issuedMinute)} -- laget genomför det aldrig i det redan spelade förloppet.`
            : "Ett i taget -- gäller för resten av matchen, från nästa naturliga läge i spelet."}
        </span>

        {history.length > 0 ? (
          <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 8 }}>
            <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
              Historik
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {history.map((h) => (
                <div key={h.id} style={{ display: "flex", gap: 8, fontSize: "var(--hm-text-2xs)" }}>
                  <span className="hm-text-muted" style={{ width: 40, fontVariantNumeric: "tabular-nums" }}>
                    {formatMatchMinute(h.adoptedMinute)}
                  </span>
                  <span>{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const selectStyle = { background: "var(--hm-surface-2)", border: "1px solid var(--hm-border)", borderRadius: "var(--hm-radius-sm)", color: "var(--hm-text-primary)", padding: "7px 10px", fontSize: "var(--hm-text-xs)", flex: 1 };

function SevenVSixStatus({
  pendingInstruction,
  status,
  active,
  lastOutcome,
}: {
  pendingInstruction: SevenVSixInstruction | null;
  status: InstructionLifecycleStatus | null;
  active: boolean;
  lastOutcome?: LastInstructionOutcome | null;
}) {
  if (pendingInstruction && status) {
    return (
      <span className="hm-badge hm-badge-neutral">
        7v6 {pendingInstruction.target === "ON" ? "PÅ" : "AV"} — {instructionLabel(status)}
      </span>
    );
  }
  return (
    <span className="hm-badge hm-badge-neutral">
      7v6 {active ? "ACTIVE" : "OFF"}
      {lastOutcome?.outcome === "DELAYED" ? " (senast försenad)" : ""}
    </span>
  );
}

/**
 * HM-TACTICS-0.9: renders nothing at all unless the opponent has
 * actually detected a sustained pattern (Spec: "no adaptation if there
 * is nothing supported to react to") -- and even then, only ever a
 * discrete PENDING/DELAYED/ADOPTED label plus which of the two
 * observable signals triggered it, never an exact numeric effect
 * (Spec: "without exposing fake tactical certainty").
 */
function OpponentAdaptationPanel({
  assessed,
  clockMinute,
}: {
  assessed: { trigger: OpponentAdaptationTrigger; outcome: ImplementationOutcome; assessmentMinute: number; actualAdoptionMinute: number } | null;
  clockMinute: number;
}) {
  if (!assessed) {
    return null;
  }
  const triggerLabel = assessed.trigger === "SEVEN_V_SIX" ? "ert ihållande 7v6" : "er höga ATI-001-användning";
  const landed = clockMinute >= assessed.actualAdoptionMinute;
  const status: InstructionLifecycleStatus = landed ? "ADOPTED" : assessed.outcome === "DELAYED" && clockMinute >= assessed.assessmentMinute ? "DELAYED" : "PENDING";
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Motståndaranpassning</span>
        <span className="hm-badge hm-badge-neutral">{status}</span>
      </div>
      <div className="hm-panel-body">
        <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
          {landed
            ? `Motståndaren har anpassat sig efter ${triggerLabel} -- ingen exakt effekt visas.`
            : `Motståndaren verkar ha märkt ${triggerLabel} och är på väg att anpassa sig.`}
        </span>
      </div>
    </div>
  );
}

/**
 * HM-MATCH-0.2: a PROVISIONAL league table, computed on demand (never
 * stored) via standings.ts's getLiveTableStandings -- clearly labeled
 * LIVE so it is never mistaken for the official table (Career/analysis
 * screens keep using getLiveStandings, unchanged by this milestone). The
 * two clubs in the currently-watched fixture are highlighted so the
 * manager can see their live movement in the table.
 */
function LiveTablePanel({
  career,
  fixture,
  homeScore,
  awayScore,
  onClose,
}: {
  career: CareerState;
  fixture: { id: string; homeClubId: string; awayClubId: string };
  homeScore: number;
  awayScore: number;
  onClose: () => void;
}) {
  const table = getLiveTableStandings(career, fixture.id, homeScore, awayScore);
  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Tabell</span>
        <span className="hm-badge hm-badge-neutral">LIVE / PROVISORISK</span>
        <button type="button" className="hm-btn hm-btn-sm" onClick={onClose} style={{ marginLeft: "auto" }}>
          STÄNG
        </button>
      </div>
      <table className="hm-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Klubb</th>
            <th className="hm-table-num">S</th>
            <th className="hm-table-num">V</th>
            <th className="hm-table-num">O</th>
            <th className="hm-table-num">F</th>
            <th className="hm-table-num">GM</th>
            <th className="hm-table-num">IM</th>
            <th className="hm-table-num">MSK</th>
            <th className="hm-table-num">P</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const club = getClub(row.clubId);
            const isWatched = row.clubId === fixture.homeClubId || row.clubId === fixture.awayClubId;
            return (
              <tr key={row.clubId} style={isWatched ? { background: "var(--hm-accent-muted)" } : undefined}>
                <td className="hm-table-num">{i + 1}</td>
                <td className="hm-td-strong">{club?.shortName ?? row.clubId}</td>
                <td className="hm-table-num">{row.played}</td>
                <td className="hm-table-num">{row.won}</td>
                <td className="hm-table-num">{row.drawn}</td>
                <td className="hm-table-num">{row.lost}</td>
                <td className="hm-table-num">{row.goalsFor}</td>
                <td className="hm-table-num">{row.goalsAgainst}</td>
                <td className="hm-table-num">{row.goalDifference}</td>
                <td className="hm-table-num hm-td-strong">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="hm-panel-body hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
        {getClub(fixture.homeClubId)?.shortName ?? fixture.homeClubId} / {getClub(fixture.awayClubId)?.shortName ?? fixture.awayClubId} visas med den pågående
        matchens live-ställning ({homeScore}–{awayScore}) -- resten av tabellen speglar redan avgjorda matcher. Detta skriver aldrig över den officiella
        tabellen.
      </div>
    </div>
  );
}

function TeamColumn({ clubId, attacking }: { clubId: string; attacking: boolean }) {
  const c = getClub(clubId)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 130 }}>
      <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={40} />
      <div style={{ fontSize: "var(--hm-text-xs)", fontWeight: attacking ? 800 : 700, textAlign: "center" }}>{c.shortName}</div>
    </div>
  );
}
