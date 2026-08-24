"use client";

import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
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
import { SHOUT_TYPES, shoutLabel } from "@/lib/liveMatch/sidelineShout";
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
  const router = useRouter();
  const { career } = useCareer();

  const fixture = career.fixtures.find((f) => f.id === params.fixtureId);
  const result = career.results[params.fixtureId];

  if (!fixture || !result) {
    return (
      <div className="hm-panel">
        <div className="hm-panel-body hm-text-muted">Ingen matchdata hittades för denna fixture.</div>
      </div>
    );
  }

  // HM-MATCH-1.3A Part C/D: a live session for THIS fixture exists only
  // once the manager explicitly pressed STARTA MATCH on Match Preview
  // (see liveMatchSessionActions.ts's `startLiveMatchSession` -- the
  // ONE place one is created). Since `result` already implies
  // playManagerFixture has run (either via STARTA MATCH or
  // SNABBRESULTAT), reaching this page with no matching session always
  // means "already fully resolved, or the manager already left" -- never
  // "not yet started" -- so this renders a frozen read-only summary
  // instead of silently (re)creating a fresh live session (Part M #15:
  // reopening a completed match must not spawn a new one).
  if (career.activeMatchSession?.fixtureId !== fixture.id) {
    return <AlreadyResolvedMatchSummary fixture={fixture} result={result} router={router} />;
  }

  return <LiveMatch fixture={fixture} result={result} initialSession={career.activeMatchSession} />;
}

function AlreadyResolvedMatchSummary({
  fixture,
  result,
  router,
}: {
  fixture: { id: string; homeClubId: string; awayClubId: string };
  result: import("@handball-manager/game-simulation").FastMatchResult;
  router: ReturnType<typeof useRouter>;
}) {
  const home = getClub(fixture.homeClubId)!;
  const away = getClub(fixture.awayClubId)!;
  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Matchen är redan avgjord</span>
        </div>
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, padding: "16px 20px" }}>
          <TeamColumn clubId={home.id} attacking={false} />
          <div style={{ textAlign: "center", minWidth: 140 }}>
            <div style={{ fontSize: "var(--hm-text-2xl)", fontWeight: 800 }}>
              {result.homeGoals} – {result.awayGoals}
            </div>
            <div className="hm-eyebrow" style={{ marginTop: 4 }}>
              FULL TID
            </div>
          </div>
          <TeamColumn clubId={away.id} attacking={false} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, paddingBottom: 20 }}>
          <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push(`/career/match-report/${fixture.id}`)}>
            MATCHRAPPORT →
          </button>
          <button type="button" className="hm-btn" onClick={() => router.push("/career")}>
            TILLBAKA
          </button>
        </div>
      </div>
    </div>
  );
}

function LiveMatch({
  fixture,
  result,
  initialSession,
}: {
  fixture: { id: string; homeClubId: string; awayClubId: string };
  result: import("@handball-manager/game-simulation").FastMatchResult;
  initialSession: import("@/lib/liveMatch/liveMatchSession").LiveMatchSessionState;
}) {
  const router = useRouter();
  const { career, applyMidMatchTacticalChange, applyMidMatchPlanChange, updateLiveMatchSession, endLiveMatchSession } = useCareer();
  const logRef = useRef<HTMLDivElement>(null);
  // HM-MATCH-1.1 Part 13: only auto-scroll to the live edge (bottom) when
  // the user is ALREADY there -- a manual scroll-back to read earlier
  // commentary must never get yanked back to live by the next event.
  // `isAtLiveEdgeRef` starts true (a fresh match view IS at live), and is
  // updated by the log's own onScroll handler, never by the auto-scroll
  // effect itself (which would otherwise always report "at the edge"
  // immediately after moving there).
  const isAtLiveEdgeRef = useRef(true);
  const [newEventsWhileAway, setNewEventsWhileAway] = useState(0);

  // HM-TACTICS-0.7: the tactical profile actually in effect for THIS
  // match. Match-scoped, not the season-persistent career.tacticalProfile
  // (which stays exactly what the Tactics screen shows for future
  // fixtures) -- an in-match tweak is not the same thing as redefining
  // the manager's standing strategic identity.
  // HM-MATCH-1.3A Part D/E: seeded from the persistent LiveMatchSession
  // (which itself was seeded from career.tacticalProfile at STARTA MATCH
  // time) instead of always re-reading career.tacticalProfile fresh --
  // otherwise a navigate-away-and-back would silently discard any
  // adopted mid-match instruction and revert to the season default.
  const [currentProfile, setCurrentProfile] = useState<TeamTacticalProfile>(initialSession.currentProfile);
  const [draftProfile, setDraftProfile] = useState<TeamTacticalProfile>(initialSession.currentProfile);
  // HM-TACTICS-0.8: 7v6 ON/OFF, match-scoped exactly like currentProfile
  // above -- never persisted to career state, and orthogonal to
  // TeamTacticalProfile (still exactly the 3 HM-TACTICS-0.6A fields).
  const [sevenVSixActive, setSevenVSixActive] = useState(initialSession.sevenVSixActive);
  // HM-TACTICS-0.9: since which simulated match minute the CURRENTLY
  // EFFECTIVE state has held -- the only thing the opponent's own
  // adaptation is allowed to observe (see opponentAdaptation.ts). Reset
  // to the landing minute on every landing, from whatever source
  // (instruction, shout, or the 7v6 switch itself).
  const [sevenVSixActiveSinceMinute, setSevenVSixActiveSinceMinute] = useState<number | null>(initialSession.sevenVSixActiveSinceMinute);
  const [ati001HighSinceMinute, setAti001HighSinceMinute] = useState<number | null>(initialSession.ati001HighSinceMinute);
  const [opponentAdaptationEffect, setOpponentAdaptationEffect] = useState<OpponentAdaptationEffect | null>(initialSession.opponentAdaptationEffect);
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
  // HM-MATCH-1.2 Part N/O: the primary match view (score/clock/commentary)
  // stays visible at all times -- detailed coaching controls live in a
  // compact drawer instead of a giant permanently-stacked column of
  // panels. `null` = closed; TIMEOUT opens automatically when a timeout
  // starts (see the effect below) and cannot be dismissed early except
  // by ending the timeout itself.
  const [activeDrawer, setActiveDrawer] = useState<"TAKTIK" | "SPELARE" | "TIMEOUT" | null>(null);

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
    clock,
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
    issueHalftimeMatchPlanChange,
  } = useLiveMatch(result, handleInstructionAdopted, handleShoutDelivered, handleShoutExpired, handleSevenVSixAdopted, handleMatchPlanChangeAdopted, initialSession.clock);

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
  } | null>(initialSession.assessedOpponentAdaptation);
  // HM-MATCH-1.3A: restored from the session rather than always starting
  // false. `halftimeAdaptationCheckedRef`'s initial value is DERIVED from
  // the resumed clock's phase (see liveMatchSession.ts's own doc: once
  // phase has moved past FIRST_HALF, the one-shot assessment effect
  // below must already have run, since it runs synchronously the moment
  // HALF_TIME is first reached) rather than needing its own persisted
  // field.
  const halftimeAdaptationCheckedRef = useRef(initialSession.clock.phase !== "PRE_MATCH" && initialSession.clock.phase !== "FIRST_HALF");
  const opponentAdaptationLandedRef = useRef(initialSession.opponentAdaptationLanded);

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

  // HM-MATCH-1.3A Part D/E: the write side of "a live match is a
  // persistent career session, not page-local UI state" -- persists
  // every meaningful change to CareerState.activeMatchSession so a
  // navigate-away-and-back (or an accidental page reload) resumes
  // exactly where the manager left off instead of resetting to
  // 0-0/00:00. Deliberately excludes drawer-open state, form drafts, and
  // in-flight PENDING instructions/shouts/7v6-switches/MatchPlan changes
  // (see liveMatchSession.ts's own doc for why those are safe to drop).
  useEffect(() => {
    updateLiveMatchSession(fixture.id, {
      fixtureId: fixture.id,
      clock,
      currentProfile,
      sevenVSixActive,
      sevenVSixActiveSinceMinute,
      ati001HighSinceMinute,
      opponentAdaptationEffect,
      assessedOpponentAdaptation,
      opponentAdaptationLanded: opponentAdaptationLandedRef.current,
    });
  }, [fixture.id, clock, currentProfile, sevenVSixActive, sevenVSixActiveSinceMinute, ati001HighSinceMinute, opponentAdaptationEffect, assessedOpponentAdaptation, updateLiveMatchSession]);

  useEffect(() => {
    if (isAtLiveEdgeRef.current) {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    } else {
      setNewEventsWhileAway((n) => n + 1);
    }
  }, [view.revealedEvents.length]);

  const LIVE_EDGE_TOLERANCE_PX = 24;
  function handleCommentaryScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const atEdge = el.scrollHeight - el.scrollTop - el.clientHeight <= LIVE_EDGE_TOLERANCE_PX;
    isAtLiveEdgeRef.current = atEdge;
    if (atEdge && newEventsWhileAway > 0) setNewEventsWhileAway(0);
  }
  function scrollCommentaryToLive() {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    isAtLiveEdgeRef.current = true;
    setNewEventsWhileAway(0);
  }

  const isFullTime = view.phase === "FULL_TIME";
  const commentaryEvents = [...view.revealedEvents].reverse();

  // HM-MATCH-1.2 Part S: a timeout opens its own dedicated drawer
  // automatically (a coach doesn't have to remember to click TAKTIK) and
  // closes it again the moment play resumes. Derived, not effect+setState
  // (a timeout starting/ending is already reflected in `view.phase` every
  // render -- no need to mirror it into a second piece of state).
  const displayedDrawer = isTimeout ? "TIMEOUT" : activeDrawer === "TIMEOUT" ? null : activeDrawer;

  // HM-MATCH-1.2 Part T: halftime is a genuinely DIFFERENT state, not
  // "normal Live Match with a few extra buttons" -- a dedicated
  // workspace entirely replaces the normal view while the match is
  // paused at 30:00.
  if (isHalfTime) {
    return (
      <HalftimeWorkspace
        home={home}
        away={away}
        view={view}
        result={result}
        homeSquad={homeSquad}
        awaySquad={awaySquad}
        career={career}
        currentMatchPlan={currentMatchPlan}
        matchPlanChangeHistory={matchPlanChangeHistory}
        issueHalftimeMatchPlanChange={issueHalftimeMatchPlanChange}
        selectedPlayerId={selectedPlayerId}
        setSelectedPlayerId={setSelectedPlayerId}
        pairAttackPlayerId={pairAttackPlayerId}
        setPairAttackPlayerId={setPairAttackPlayerId}
        pairDefencePlayerId={pairDefencePlayerId}
        setPairDefencePlayerId={setPairDefencePlayerId}
        draftProfile={draftProfile}
        setDraftProfile={setDraftProfile}
        currentProfile={currentProfile}
        canIssueHalftimeInstruction={canIssueHalftimeInstruction}
        issueHalftimeInstruction={issueHalftimeInstruction}
        pendingInstruction={pendingInstruction}
        instructionStatus={instructionStatus}
        lastInstructionOutcome={lastInstructionOutcome}
        pendingSevenVSixInstruction={pendingSevenVSixInstruction}
        sevenVSixInstructionStatus={sevenVSixInstructionStatus}
        sevenVSixActive={sevenVSixActive}
        lastSevenVSixOutcome={lastSevenVSixOutcome}
        canIssueSevenVSixHalftime={canIssueSevenVSixHalftime}
        issueSevenVSixHalftimeInstruction={issueSevenVSixHalftimeInstruction}
        startSecondHalf={startSecondHalf}
      />
    );
  }

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      {/* HM-MATCH-1.3A Part J: sticky so score/clock/phase never scroll out of view -- the manager should never lose sight of the match while coaching or reading commentary further down the page. */}
      <div className="hm-panel hm-live-scoreboard-sticky">
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
        <div className="hm-panel" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div className="hm-panel-header">
            <span className="hm-panel-title">Kommentarer</span>
          </div>
          {newEventsWhileAway > 0 ? (
            <button
              type="button"
              className="hm-btn hm-btn-sm hm-btn-primary"
              onClick={scrollCommentaryToLive}
              style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", zIndex: 1 }}
            >
              {newEventsWhileAway} nya händelser
            </button>
          ) : null}
          <div ref={logRef} onScroll={handleCommentaryScroll} style={{ height: 320, overflowY: "auto", padding: "6px 0" }}>
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

      {/* HM-MATCH-1.2 Part O/P/Q/R: all detailed coaching (tactical
          profile dial, live MatchPlan formation/tempo/omställning, one
          single 7v6 control, sideline shouts, player usage) moved into
          the compact LiveCoachingDrawer -- opened via the TAKTIK/
          SPELARE toolbar buttons below, or automatically for TIMEOUT.
          The primary match view above (score/clock/commentary/stats)
          never has to compete with these for space. */}
      {displayedDrawer ? (
        <LiveCoachingDrawer
          mode={displayedDrawer}
          onClose={() => setActiveDrawer(null)}
          career={career}
          currentMatchPlan={currentMatchPlan}
          pendingMatchPlanChange={pendingMatchPlanChange}
          matchPlanChangeStatus={matchPlanChangeStatus}
          canIssueMatchPlanChange={canIssueMatchPlanChange}
          issueMatchPlanChange={issueMatchPlanChange}
          matchPlanChangeHistory={matchPlanChangeHistory}
          selectedPlayerId={selectedPlayerId}
          setSelectedPlayerId={setSelectedPlayerId}
          pairAttackPlayerId={pairAttackPlayerId}
          setPairAttackPlayerId={setPairAttackPlayerId}
          pairDefencePlayerId={pairDefencePlayerId}
          setPairDefencePlayerId={setPairDefencePlayerId}
          draftProfile={draftProfile}
          setDraftProfile={setDraftProfile}
          currentProfile={currentProfile}
          canIssueInstruction={canIssueInstruction}
          issueInstruction={issueInstruction}
          canIssueTimeoutInstruction={canIssueTimeoutInstruction}
          issueTimeoutInstruction={issueTimeoutInstruction}
          timeoutSecondsRemaining={timeoutSecondsRemaining}
          endTimeout={endTimeout}
          pendingInstruction={pendingInstruction}
          instructionStatus={instructionStatus}
          lastInstructionOutcome={lastInstructionOutcome}
          pendingShout={pendingShout}
          shoutStatus={shoutStatus}
          canIssueShout={canIssueShout}
          issueShout={issueShout}
          pendingSevenVSixInstruction={pendingSevenVSixInstruction}
          sevenVSixInstructionStatus={sevenVSixInstructionStatus}
          sevenVSixActive={sevenVSixActive}
          lastSevenVSixOutcome={lastSevenVSixOutcome}
          canIssueSevenVSixSideline={canIssueSevenVSixSideline}
          canIssueSevenVSixTimeout={canIssueSevenVSixTimeout}
          issueSevenVSixInstruction={issueSevenVSixInstruction}
          issueSevenVSixTimeoutInstruction={issueSevenVSixTimeoutInstruction}
        />
      ) : null}

      {/* HM-MATCH-0.2: Live Table -- a PROVISIONAL standings view computed on demand from CareerState (never stored/mutated there), with the currently-watched fixture's score taken from the live-revealed view instead of its already-final stored result. Every other fixture shown is genuinely already complete (see standings.ts's getLiveTableStandings doc) -- nothing here fabricates a simultaneous match the calendar can't yet represent. */}
      {showLiveTable ? (
        <LiveTablePanel career={career} fixture={fixture} homeScore={view.homeScore} awayScore={view.awayScore} onClose={() => setShowLiveTable(false)} />
      ) : null}

      {/* HM-TACTICS-0.9: the smallest deterministic opponent-adaptation notice -- only ever shown once the opponent has actually noticed a sustained first-half pattern (see opponentAdaptation.ts); nothing renders at all otherwise ("no adaptation if there is nothing supported to react to"). Discrete labels only, no exposed scores/probabilities. */}
      <OpponentAdaptationPanel assessed={assessedOpponentAdaptation} clockMinute={view.clockMinute} />

      {/* Controls */}
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {isFullTime ? (
            <>
              <button
                type="button"
                className="hm-btn hm-btn-primary"
                onClick={() => {
                  endLiveMatchSession(fixture.id);
                  router.push(`/career/match-report/${fixture.id}`);
                }}
              >
                MATCHRAPPORT →
              </button>
              <button
                type="button"
                className="hm-btn"
                onClick={() => {
                  endLiveMatchSession(fixture.id);
                  router.push("/career");
                }}
              >
                FORTSÄTT
              </button>
            </>
          ) : isTimeout ? (
            <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
              Matchen är pausad under timeouten -- se coaching-panelen.
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
          {!isFullTime ? (
            <>
              <button
                type="button"
                className={`hm-btn hm-btn-sm${activeDrawer === "TAKTIK" ? " hm-btn-primary" : ""}`}
                onClick={() => setActiveDrawer((d) => (d === "TAKTIK" ? null : "TAKTIK"))}
              >
                TAKTIK
              </button>
              <button
                type="button"
                className={`hm-btn hm-btn-sm${activeDrawer === "SPELARE" ? " hm-btn-primary" : ""}`}
                onClick={() => setActiveDrawer((d) => (d === "SPELARE" ? null : "SPELARE"))}
              >
                SPELARE
              </button>
            </>
          ) : null}
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
 * HM-MATCH-1.2 Part O/P/Q/R: the compact Live Coaching drawer -- a
 * fixed side panel (never a full-screen takeover) so score/clock/
 * commentary stay visible behind it. Three modes:
 *   TAKTIK: FÖRSVAR/ANFALL/OMSTÄLLNING MatchPlan dials + the tactical-
 *     profile dial + sideline shouts + the ONE sideline 7v6 control.
 *   SPELARE: the selected-16 usage editor (speltid/fasanvändning/
 *     specialistbyte).
 *   TIMEOUT: the timeout-delivery-mode profile dial + the timeout 7v6
 *     control -- a genuinely different game state (match paused),
 *     mutually exclusive with TAKTIK/SPELARE, so this is never a SECOND
 *     simultaneously-reachable 7v6 control (Part R).
 * Reuses every existing edit/issue function verbatim (Part D/G) -- no
 * new engine architecture, only a new container for controls that
 * already existed as separate, permanently-stacked panels.
 */
function LiveCoachingDrawer({
  mode,
  onClose,
  career,
  currentMatchPlan,
  pendingMatchPlanChange,
  matchPlanChangeStatus,
  canIssueMatchPlanChange,
  issueMatchPlanChange,
  matchPlanChangeHistory,
  selectedPlayerId,
  setSelectedPlayerId,
  pairAttackPlayerId,
  setPairAttackPlayerId,
  pairDefencePlayerId,
  setPairDefencePlayerId,
  draftProfile,
  setDraftProfile,
  currentProfile,
  canIssueInstruction,
  issueInstruction,
  canIssueTimeoutInstruction,
  issueTimeoutInstruction,
  timeoutSecondsRemaining,
  endTimeout,
  pendingInstruction,
  instructionStatus,
  lastInstructionOutcome,
  pendingShout,
  shoutStatus,
  canIssueShout,
  issueShout,
  pendingSevenVSixInstruction,
  sevenVSixInstructionStatus,
  sevenVSixActive,
  lastSevenVSixOutcome,
  canIssueSevenVSixSideline,
  canIssueSevenVSixTimeout,
  issueSevenVSixInstruction,
  issueSevenVSixTimeoutInstruction,
}: {
  mode: "TAKTIK" | "SPELARE" | "TIMEOUT";
  onClose: () => void;
  career: CareerState;
  currentMatchPlan: import("@/lib/matchPlan/types").MatchPlan | null;
  pendingMatchPlanChange: { issuedMinute: number; change: MatchPlanChange } | null;
  matchPlanChangeStatus: "PENDING" | "ADOPTED" | null;
  canIssueMatchPlanChange: boolean;
  issueMatchPlanChange: (change: MatchPlanChange) => void;
  matchPlanChangeHistory: readonly { id: string; label: string; requestedMinute: number; adoptedMinute: number }[];
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
  pairAttackPlayerId: string;
  setPairAttackPlayerId: (id: string) => void;
  pairDefencePlayerId: string;
  setPairDefencePlayerId: (id: string) => void;
  draftProfile: TeamTacticalProfile;
  setDraftProfile: (updater: (p: TeamTacticalProfile) => TeamTacticalProfile) => void;
  currentProfile: TeamTacticalProfile;
  canIssueInstruction: boolean;
  issueInstruction: (profile: TeamTacticalProfile, baseline: TeamTacticalProfile) => void;
  canIssueTimeoutInstruction: boolean;
  issueTimeoutInstruction: (profile: TeamTacticalProfile, baseline: TeamTacticalProfile) => void;
  timeoutSecondsRemaining: number | null;
  endTimeout: () => void;
  pendingInstruction: unknown;
  instructionStatus: InstructionLifecycleStatus | null;
  lastInstructionOutcome: LastInstructionOutcome | null;
  pendingShout: { type: string } | null;
  shoutStatus: string | null;
  canIssueShout: boolean;
  issueShout: (type: import("@/lib/liveMatch/sidelineShout").ShoutType, baseline: TeamTacticalProfile) => void;
  pendingSevenVSixInstruction: SevenVSixInstruction | null;
  sevenVSixInstructionStatus: InstructionLifecycleStatus | null;
  sevenVSixActive: boolean;
  lastSevenVSixOutcome: LastInstructionOutcome | null;
  canIssueSevenVSixSideline: boolean;
  canIssueSevenVSixTimeout: boolean;
  issueSevenVSixInstruction: (target: "ON" | "OFF", familiarity: TeamTacticalProfile["tacticalFamiliarity"]) => void;
  issueSevenVSixTimeoutInstruction: (target: "ON" | "OFF", familiarity: TeamTacticalProfile["tacticalFamiliarity"]) => void;
}) {
  const nameOf = (playerId: string) => {
    const player = getCareerPlayer(career, playerId);
    return player ? `${player.firstName} ${player.lastName}` : playerId;
  };
  const plan = currentMatchPlan;
  const squadPlayers = plan?.squad.players.filter((p) => p.position !== "GK") ?? [];
  const selectedUsage = plan?.playerUsage.find((u) => u.playerId === selectedPlayerId);
  const title = mode === "TAKTIK" ? "Taktik (live)" : mode === "SPELARE" ? "Spelare (live)" : "Timeout — coaching";

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 380, maxWidth: "92vw", zIndex: 40, display: "flex", flexDirection: "column" }}>
      <div className="hm-panel" style={{ margin: 8, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
        <div className="hm-panel-header">
          <span className="hm-panel-title">{title}</span>
          {mode === "TIMEOUT" ? (
            <span className="hm-badge hm-badge-neutral">{timeoutSecondsRemaining ?? 0}s kvar</span>
          ) : (
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose}>
              Stäng
            </button>
          )}
        </div>
        <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          {mode === "TIMEOUT" ? (
            <>
              <SegmentedControl
                label="Anfallsbenägenhet"
                value={draftProfile.ati001UsageTendency}
                options={ATI001_USAGE_TENDENCY_VALUES}
                renderLabel={capabilityLevelLabel}
                onChange={(v) => setDraftProfile((p) => ({ ...p, ati001UsageTendency: v }))}
                disabled={!canIssueTimeoutInstruction}
              />
              <SegmentedControl
                label="Försvarsrespons"
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
                <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!canIssueTimeoutInstruction} onClick={() => issueTimeoutInstruction(draftProfile, currentProfile)}>
                  BEORDRA ÄNDRING
                </button>
                <button type="button" className="hm-btn hm-btn-sm" onClick={endTimeout}>
                  ÅTERUPPTA →
                </button>
              </div>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {pendingInstruction
                  ? `${instructionLabel(instructionStatus)} (timeout ger vanligtvis säkrare genomförande än en sidlinjeinstruktion, men garanterar det inte).`
                  : (lastOutcomeLabel(lastInstructionOutcome) ?? "Ingen ändring beordrad under denna timeout -- matchtiden är fryst tills du återupptar.")}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
                <span className="hm-eyebrow">7v6</span>
                <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!canIssueSevenVSixTimeout || sevenVSixActive} onClick={() => issueSevenVSixTimeoutInstruction("ON", currentProfile.tacticalFamiliarity)}>
                  SLÅ PÅ
                </button>
                <button type="button" className="hm-btn hm-btn-sm" disabled={!canIssueSevenVSixTimeout || !sevenVSixActive} onClick={() => issueSevenVSixTimeoutInstruction("OFF", currentProfile.tacticalFamiliarity)}>
                  STÄNG AV
                </button>
                <SevenVSixStatus pendingInstruction={pendingSevenVSixInstruction} status={sevenVSixInstructionStatus} active={sevenVSixActive} lastOutcome={lastSevenVSixOutcome} />
              </div>
            </>
          ) : mode === "TAKTIK" ? (
            <>
              {plan ? (
                <>
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
                        onChange={(baseFormation) => issueMatchPlanChange({ category: "DEFENCE", kind: "FORMATION", baseFormation })}
                        disabled={!canIssueMatchPlanChange}
                      />
                      <SegmentedControl
                        label="Risknivå"
                        value={plan.defencePlan.riskLevel}
                        options={["LOW", "MEDIUM", "HIGH"] as const}
                        renderLabel={(v) => INTENSITY_LABELS_SV[v]}
                        onChange={(riskLevel) => issueMatchPlanChange({ category: "DEFENCE", kind: "RISK", riskLevel })}
                        disabled={!canIssueMatchPlanChange}
                      />
                      <SegmentedControl
                        label="Kontakt"
                        value={plan.defencePlan.contactIntent}
                        options={["LOW", "MEDIUM", "HIGH"] as const}
                        renderLabel={(v) => INTENSITY_LABELS_SV[v]}
                        onChange={(contactIntent) => issueMatchPlanChange({ category: "DEFENCE", kind: "CONTACT", contactIntent })}
                        disabled={!canIssueMatchPlanChange}
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
                        onChange={(tempo) => issueMatchPlanChange({ category: "ATTACK", kind: "TEMPO", tempo })}
                        disabled={!canIssueMatchPlanChange}
                      />
                      <SegmentedControl
                        label="M6-fokus"
                        value={plan.attackPlan.pivotUsage}
                        options={["LOW", "MEDIUM", "HIGH"] as const}
                        renderLabel={(v) => INTENSITY_LABELS_SV[v]}
                        onChange={(pivotUsage) => issueMatchPlanChange({ category: "ATTACK", kind: "PIVOT_USAGE", pivotUsage })}
                        disabled={!canIssueMatchPlanChange}
                      />
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
                        onChange={(offensiveTransitionIntent) => issueMatchPlanChange({ category: "TRANSITION", kind: "OFFENSIVE_INTENT", offensiveTransitionIntent })}
                        disabled={!canIssueMatchPlanChange}
                      />
                      <SegmentedControl
                        label="Bytesprioritet"
                        value={plan.transitionPlan.substitutionPriority}
                        options={["ATTACK_FIRST", "DEFENCE_FIRST", "BALANCED"] as const}
                        renderLabel={(v) => SUBSTITUTION_PRIORITY_LABELS_SV[v]}
                        onChange={(substitutionPriority) => issueMatchPlanChange({ category: "TRANSITION", kind: "SUBSTITUTION_PRIORITY", substitutionPriority })}
                        disabled={!canIssueMatchPlanChange}
                      />
                    </div>
                  </div>

                  <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                    {pendingMatchPlanChange
                      ? `Beordrad vid ${formatMatchMinute(pendingMatchPlanChange.issuedMinute)} -- ${matchPlanChangeStatus === "ADOPTED" ? "genomförd" : "väntar"}.`
                      : "Ett i taget -- gäller för resten av matchen, från nästa naturliga läge i spelet."}
                  </span>
                </>
              ) : null}

              {/* HM-MATCH-1.2 Part R: the ONE sideline 7v6 control -- reachable from TAKTIK (SIDELINE) and, mutually exclusively, from the TIMEOUT drawer (TIMEOUT delivery) and the halftime workspace (HALFTIME delivery). Never more than one reachable at the same time. */}
              <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="hm-eyebrow">7v6</span>
                  <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!canIssueSevenVSixSideline || sevenVSixActive} onClick={() => issueSevenVSixInstruction("ON", currentProfile.tacticalFamiliarity)}>
                    SLÅ PÅ
                  </button>
                  <button type="button" className="hm-btn hm-btn-sm" disabled={!canIssueSevenVSixSideline || !sevenVSixActive} onClick={() => issueSevenVSixInstruction("OFF", currentProfile.tacticalFamiliarity)}>
                    STÄNG AV
                  </button>
                  <SevenVSixStatus pendingInstruction={pendingSevenVSixInstruction} status={sevenVSixInstructionStatus} active={sevenVSixActive} lastOutcome={lastSevenVSixOutcome} />
                </div>
                <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                  Extra anfallare istället för målvakt -- fler anfallsmöjligheter, men högre risk om bollen tappas.
                </span>
              </div>

              <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
                <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
                  Sidlinjerop {pendingShout ? `— ${shoutStatus}` : ""}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SHOUT_TYPES.map((type) => (
                    <button key={type} type="button" className="hm-btn hm-btn-sm" disabled={!canIssueShout} onClick={() => issueShout(type, currentProfile)}>
                      {shoutLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              <details style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
                <summary className="hm-eyebrow" style={{ cursor: "pointer" }}>
                  Djupare taktisk justering
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
                  <SegmentedControl
                    label="Anfallsbenägenhet"
                    value={draftProfile.ati001UsageTendency}
                    options={ATI001_USAGE_TENDENCY_VALUES}
                    renderLabel={capabilityLevelLabel}
                    onChange={(v) => setDraftProfile((p) => ({ ...p, ati001UsageTendency: v }))}
                    disabled={!canIssueInstruction}
                  />
                  <SegmentedControl
                    label="Försvarsrespons"
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
                  <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!canIssueInstruction} onClick={() => issueInstruction(draftProfile, currentProfile)}>
                    BEORDRA ÄNDRING
                  </button>
                </div>
              </details>

              {matchPlanChangeHistory.length > 0 ? (
                <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
                  <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
                    Historik
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {matchPlanChangeHistory.map((h) => (
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
            </>
          ) : (
            // SPELARE
            <>
              {plan ? (
                <>
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
                        onChange={(playingTimeIntention) => issueMatchPlanChange({ category: "PLAYER", kind: "PLAYING_TIME", playerId: selectedPlayerId, playerName: nameOf(selectedPlayerId), playingTimeIntention })}
                        disabled={!canIssueMatchPlanChange}
                      />
                      <SegmentedControl
                        label="Fasanvändning"
                        value={selectedUsage.phaseUsage}
                        options={PLAYER_PHASE_USAGES}
                        renderLabel={(v) => PHASE_USAGE_LABELS_SV[v]}
                        onChange={(phaseUsage) => issueMatchPlanChange({ category: "PLAYER", kind: "PHASE_USAGE", playerId: selectedPlayerId, playerName: nameOf(selectedPlayerId), phaseUsage })}
                        disabled={!canIssueMatchPlanChange}
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
                        disabled={!canIssueMatchPlanChange || !pairAttackPlayerId || !pairDefencePlayerId || pairAttackPlayerId === pairDefencePlayerId}
                        onClick={() =>
                          issueMatchPlanChange({
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
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * HM-MATCH-1.2 Part T/U/V/W: the dedicated halftime workspace -- the
 * ENTIRE normal Live Match view is replaced by this while paused at
 * 30:00 (see the `isHalfTime` early return above), not augmented with a
 * few extra buttons. Shows first-half score/stats/player-stats/current
 * MatchPlan, then lets the manager edit the SAME MatchPlan for the
 * second half only (every edit here goes through `issueHalftimeMatchPlanChange`,
 * whose HALFTIME delivery mode adopts at exactly minute 30 -- see
 * matchPlanChange.ts -- so the first half's already-revealed events are
 * never touched). No fake team-talk/morale mechanic (Part T); no
 * fatigue since no fatigue engine exists (Part T).
 */
function HalftimeWorkspace({
  home,
  away,
  view,
  result,
  homeSquad,
  awaySquad,
  career,
  currentMatchPlan,
  matchPlanChangeHistory,
  issueHalftimeMatchPlanChange,
  selectedPlayerId,
  setSelectedPlayerId,
  pairAttackPlayerId,
  setPairAttackPlayerId,
  pairDefencePlayerId,
  setPairDefencePlayerId,
  draftProfile,
  setDraftProfile,
  currentProfile,
  canIssueHalftimeInstruction,
  issueHalftimeInstruction,
  pendingInstruction,
  instructionStatus,
  lastInstructionOutcome,
  pendingSevenVSixInstruction,
  sevenVSixInstructionStatus,
  sevenVSixActive,
  lastSevenVSixOutcome,
  canIssueSevenVSixHalftime,
  issueSevenVSixHalftimeInstruction,
  startSecondHalf,
}: {
  home: NonNullable<ReturnType<typeof getClub>>;
  away: NonNullable<ReturnType<typeof getClub>>;
  view: import("@/lib/liveMatch/liveMatchView").LiveMatchView;
  result: import("@handball-manager/game-simulation").FastMatchResult;
  homeSquad: readonly PlayerMock[];
  awaySquad: readonly PlayerMock[];
  career: CareerState;
  currentMatchPlan: import("@/lib/matchPlan/types").MatchPlan | null;
  matchPlanChangeHistory: readonly { id: string; label: string; requestedMinute: number; adoptedMinute: number }[];
  issueHalftimeMatchPlanChange: (change: MatchPlanChange) => void;
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
  pairAttackPlayerId: string;
  setPairAttackPlayerId: (id: string) => void;
  pairDefencePlayerId: string;
  setPairDefencePlayerId: (id: string) => void;
  draftProfile: TeamTacticalProfile;
  setDraftProfile: (updater: (p: TeamTacticalProfile) => TeamTacticalProfile) => void;
  currentProfile: TeamTacticalProfile;
  canIssueHalftimeInstruction: boolean;
  issueHalftimeInstruction: (profile: TeamTacticalProfile, baseline: TeamTacticalProfile) => void;
  pendingInstruction: unknown;
  instructionStatus: InstructionLifecycleStatus | null;
  lastInstructionOutcome: LastInstructionOutcome | null;
  pendingSevenVSixInstruction: SevenVSixInstruction | null;
  sevenVSixInstructionStatus: InstructionLifecycleStatus | null;
  sevenVSixActive: boolean;
  lastSevenVSixOutcome: LastInstructionOutcome | null;
  canIssueSevenVSixHalftime: boolean;
  issueSevenVSixHalftimeInstruction: (target: "ON" | "OFF", familiarity: TeamTacticalProfile["tacticalFamiliarity"]) => void;
  startSecondHalf: () => void;
}) {
  const nameOf = (playerId: string) => {
    const player = getCareerPlayer(career, playerId);
    return player ? `${player.firstName} ${player.lastName}` : playerId;
  };
  const plan = currentMatchPlan;
  const squadPlayers = plan?.squad.players.filter((p) => p.position !== "GK") ?? [];
  const selectedUsage = plan?.playerUsage.find((u) => u.playerId === selectedPlayerId);
  const [attackSlotPosition, setAttackSlotPosition] = useState<import("@/lib/matchPlan/types").Position>("V6");
  const [attackSlotPlayerId, setAttackSlotPlayerId] = useState<string>("");
  const [defenceCourtSlot, setDefenceCourtSlot] = useState<number>(1);
  const [defenceSlotPlayerId, setDefenceSlotPlayerId] = useState<string>("");

  return (
    <div className="hm-grid" style={{ gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, padding: "16px 20px" }}>
          <TeamColumn clubId={home.id} attacking={false} />
          <div style={{ textAlign: "center", minWidth: 140 }}>
            <div className="hm-badge hm-badge-primary" style={{ fontSize: "var(--hm-text-sm)", marginBottom: 6 }}>
              HALVTID
            </div>
            <div style={{ fontSize: "var(--hm-text-2xl)", fontWeight: 800 }}>
              {view.homeScore} – {view.awayScore}
            </div>
            <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", marginTop: 2 }}>
              Matchen är pausad -- första halvlek är slutgiltig och ändras inte.
            </div>
          </div>
          <TeamColumn clubId={away.id} attacking={false} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Statistik — första halvlek</span>
          </div>
          <div className="hm-panel-body">
            <StatsTable home={view.homeStats} away={view.awayStats} homeLabel={home.shortName} awayLabel={away.shortName} />
          </div>
        </div>
        {currentMatchPlan ? (
          <div className="hm-panel">
            <div className="hm-panel-header">
              <span className="hm-panel-title">Aktuell matchplan</span>
            </div>
            <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--hm-text-2xs)" }}>
              <span>Försvar: {currentMatchPlan.defencePlan.baseFormation}</span>
              <span>Anfall: {TEMPO_LABELS_SV[currentMatchPlan.attackPlan.tempo]}</span>
              <span>7v6: {sevenVSixActive ? "AKTIVT" : "AVSTÄNGT"}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PlayerStatsPanel title={home.shortName} contributions={result.homePlayerContributions} liveGoals={view.homePlayerGoals} squad={homeSquad} isFullTime={false} career={career} />
        <PlayerStatsPanel title={away.shortName} contributions={result.awayPlayerContributions} liveGoals={view.awayPlayerGoals} squad={awaySquad} isFullTime={false} career={career} />
      </div>

      {plan ? (
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Andra halvlek — startuppställning</span>
            <span className="hm-badge hm-badge-neutral">Gäller endast från 30:00</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
                Anfall — byt spelare i position
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select className="hm-select" style={selectStyle} value={attackSlotPosition} onChange={(e) => setAttackSlotPosition(e.target.value as import("@/lib/matchPlan/types").Position)}>
                  {["V6", "V9", "M9", "H9", "H6", "M6"].map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
                <select className="hm-select" style={selectStyle} value={attackSlotPlayerId} onChange={(e) => setAttackSlotPlayerId(e.target.value)}>
                  <option value="">Spelare...</option>
                  {squadPlayers.map((p) => (
                    <option key={p.playerId} value={p.playerId}>
                      {nameOf(p.playerId)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="hm-btn hm-btn-sm hm-btn-primary"
                  disabled={!attackSlotPlayerId}
                  onClick={() => issueHalftimeMatchPlanChange({ category: "PLAYER", kind: "ATTACK_SLOT", position: attackSlotPosition, playerId: attackSlotPlayerId, playerName: nameOf(attackSlotPlayerId) })}
                >
                  TILLDELA
                </button>
              </div>
            </div>
            <div>
              <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
                Försvar — byt spelare i position
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select className="hm-select" style={selectStyle} value={defenceCourtSlot} onChange={(e) => setDefenceCourtSlot(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((slot) => (
                    <option key={slot} value={slot}>
                      Position {slot}
                    </option>
                  ))}
                </select>
                <select className="hm-select" style={selectStyle} value={defenceSlotPlayerId} onChange={(e) => setDefenceSlotPlayerId(e.target.value)}>
                  <option value="">Spelare...</option>
                  {squadPlayers.map((p) => (
                    <option key={p.playerId} value={p.playerId}>
                      {nameOf(p.playerId)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="hm-btn hm-btn-sm hm-btn-primary"
                  disabled={!defenceSlotPlayerId}
                  onClick={() => issueHalftimeMatchPlanChange({ category: "PLAYER", kind: "DEFENCE_SLOT", courtSlot: defenceCourtSlot, playerId: defenceSlotPlayerId, playerName: nameOf(defenceSlotPlayerId) })}
                >
                  TILLDELA
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {plan ? (
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Andra halvlek — taktik &amp; speltid</span>
          </div>
          <div className="hm-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SegmentedControl
                label="Formation"
                value={plan.defencePlan.baseFormation}
                options={DEFENCE_FORMATION_OPTIONS as readonly string[]}
                renderLabel={(v) => v}
                onChange={(baseFormation) => issueHalftimeMatchPlanChange({ category: "DEFENCE", kind: "FORMATION", baseFormation })}
              />
              <SegmentedControl
                label="Risknivå"
                value={plan.defencePlan.riskLevel}
                options={["LOW", "MEDIUM", "HIGH"] as const}
                renderLabel={(v) => INTENSITY_LABELS_SV[v]}
                onChange={(riskLevel) => issueHalftimeMatchPlanChange({ category: "DEFENCE", kind: "RISK", riskLevel })}
              />
              <SegmentedControl
                label="Kontakt"
                value={plan.defencePlan.contactIntent}
                options={["LOW", "MEDIUM", "HIGH"] as const}
                renderLabel={(v) => INTENSITY_LABELS_SV[v]}
                onChange={(contactIntent) => issueHalftimeMatchPlanChange({ category: "DEFENCE", kind: "CONTACT", contactIntent })}
              />
              <SegmentedControl
                label="Tempo"
                value={plan.attackPlan.tempo}
                options={["SLOW", "BALANCED", "FAST"] as const}
                renderLabel={(v) => TEMPO_LABELS_SV[v]}
                onChange={(tempo) => issueHalftimeMatchPlanChange({ category: "ATTACK", kind: "TEMPO", tempo })}
              />
              <SegmentedControl
                label="M6-fokus"
                value={plan.attackPlan.pivotUsage}
                options={["LOW", "MEDIUM", "HIGH"] as const}
                renderLabel={(v) => INTENSITY_LABELS_SV[v]}
                onChange={(pivotUsage) => issueHalftimeMatchPlanChange({ category: "ATTACK", kind: "PIVOT_USAGE", pivotUsage })}
              />
              <SegmentedControl
                label="Omställningsintention"
                value={plan.transitionPlan.offensiveTransitionIntent}
                options={["LOW", "MEDIUM", "HIGH"] as const}
                renderLabel={(v) => INTENSITY_LABELS_SV[v]}
                onChange={(offensiveTransitionIntent) => issueHalftimeMatchPlanChange({ category: "TRANSITION", kind: "OFFENSIVE_INTENT", offensiveTransitionIntent })}
              />
            </div>

            <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="hm-eyebrow">7v6</span>
              <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!canIssueSevenVSixHalftime || sevenVSixActive} onClick={() => issueSevenVSixHalftimeInstruction("ON", currentProfile.tacticalFamiliarity)}>
                SLÅ PÅ
              </button>
              <button type="button" className="hm-btn hm-btn-sm" disabled={!canIssueSevenVSixHalftime || !sevenVSixActive} onClick={() => issueSevenVSixHalftimeInstruction("OFF", currentProfile.tacticalFamiliarity)}>
                STÄNG AV
              </button>
              <SevenVSixStatus pendingInstruction={pendingSevenVSixInstruction} status={sevenVSixInstructionStatus} active={sevenVSixActive} lastOutcome={lastSevenVSixOutcome} />
            </div>

            <details style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
              <summary className="hm-eyebrow" style={{ cursor: "pointer" }}>
                Djupare taktisk justering
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
                <SegmentedControl
                  label="Anfallsbenägenhet"
                  value={draftProfile.ati001UsageTendency}
                  options={ATI001_USAGE_TENDENCY_VALUES}
                  renderLabel={capabilityLevelLabel}
                  onChange={(v) => setDraftProfile((p) => ({ ...p, ati001UsageTendency: v }))}
                  disabled={!canIssueHalftimeInstruction}
                />
                <SegmentedControl
                  label="Försvarsrespons"
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
                <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!canIssueHalftimeInstruction} onClick={() => issueHalftimeInstruction(draftProfile, currentProfile)}>
                  BEORDRA ÄNDRING
                </button>
                <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                  {pendingInstruction ? instructionLabel(instructionStatus) : (lastOutcomeLabel(lastInstructionOutcome) ?? "")}
                </span>
              </div>
            </details>

            <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
              <select className="hm-select" value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} style={selectStyle}>
                <option value="">Välj spelare...</option>
                {squadPlayers.map((p) => (
                  <option key={p.playerId} value={p.playerId}>
                    {nameOf(p.playerId)}
                  </option>
                ))}
              </select>
              {selectedUsage ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <SegmentedControl
                    label="Speltid"
                    value={selectedUsage.playingTimeIntention}
                    options={PLAYING_TIME_INTENTIONS}
                    renderLabel={(v) => PLAYING_TIME_INTENTION_LABELS_SV[v]}
                    onChange={(playingTimeIntention) => issueHalftimeMatchPlanChange({ category: "PLAYER", kind: "PLAYING_TIME", playerId: selectedPlayerId, playerName: nameOf(selectedPlayerId), playingTimeIntention })}
                  />
                  <SegmentedControl
                    label="Fasanvändning"
                    value={selectedUsage.phaseUsage}
                    options={PLAYER_PHASE_USAGES}
                    renderLabel={(v) => PHASE_USAGE_LABELS_SV[v]}
                    onChange={(phaseUsage) => issueHalftimeMatchPlanChange({ category: "PLAYER", kind: "PHASE_USAGE", playerId: selectedPlayerId, playerName: nameOf(selectedPlayerId), phaseUsage })}
                  />
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
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
                  disabled={!pairAttackPlayerId || !pairDefencePlayerId || pairAttackPlayerId === pairDefencePlayerId}
                  onClick={() =>
                    issueHalftimeMatchPlanChange({
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

            {matchPlanChangeHistory.length > 0 ? (
              <div style={{ borderTop: "1px solid var(--hm-border-subtle)", paddingTop: 10 }}>
                <div className="hm-eyebrow" style={{ marginBottom: 6 }}>
                  Historik
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {matchPlanChangeHistory.map((h) => (
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
      ) : null}

      <div className="hm-panel">
        <div className="hm-panel-body" style={{ display: "flex", justifyContent: "center" }}>
          <button type="button" className="hm-btn hm-btn-primary" onClick={startSecondHalf}>
            STARTA ANDRA HALVLEK →
          </button>
        </div>
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
