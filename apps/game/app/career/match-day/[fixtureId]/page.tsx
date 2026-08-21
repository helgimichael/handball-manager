"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer, getCareerSquad } from "@/lib/career/careerWorld";
import { commentaryLine, formatMatchMinute } from "@/lib/liveMatch/commentary";
import { useLiveMatch } from "@/lib/liveMatch/useLiveMatch";
import type { PlaybackSpeed } from "@/lib/liveMatch/clock";
import type { LiveTeamStats } from "@/lib/liveMatch/liveMatchView";
import { instructionAdoptionMinute } from "@/lib/liveMatch/tacticalInstruction";
import { SHOUT_TYPES, shoutDeliveryMinute, shoutExpiryMinute, shoutLabel } from "@/lib/liveMatch/sidelineShout";
import {
  ATI001_USAGE_TENDENCY_VALUES,
  H2_RESPONSE_PREFERENCE_VALUES,
  TACTICAL_FAMILIARITY_VALUES,
  capabilityLevelLabel,
  h2ResponseLabel,
  type TeamTacticalProfile,
} from "@/lib/career/teamTacticalProfile";
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
    <LiveMatch fixture={fixture} result={result} playerClubId={career.playerClubId} />
  ) : (
    <div className="hm-panel">
      <div className="hm-panel-body hm-text-muted">Ingen matchdata hittades för denna fixture.</div>
    </div>
  );
}

function LiveMatch({
  fixture,
  result,
  playerClubId,
}: {
  fixture: { id: string; homeClubId: string; awayClubId: string };
  result: import("@handball-manager/game-simulation").FastMatchResult;
  playerClubId: string;
}) {
  const router = useRouter();
  const { career, applyMidMatchTacticalChange } = useCareer();
  const logRef = useRef<HTMLDivElement>(null);

  // HM-TACTICS-0.7: the tactical profile actually in effect for THIS
  // match. Match-scoped, not the season-persistent career.tacticalProfile
  // (which stays exactly what the Tactics screen shows for future
  // fixtures) -- an in-match tweak is not the same thing as redefining
  // the manager's standing strategic identity.
  const [currentProfile, setCurrentProfile] = useState<TeamTacticalProfile>(career.tacticalProfile);
  const [draftProfile, setDraftProfile] = useState<TeamTacticalProfile>(career.tacticalProfile);

  const handleInstructionAdopted = useCallback(
    (adoptionMinute: number, profile: TeamTacticalProfile) => {
      applyMidMatchTacticalChange(fixture.id, adoptionMinute, profile);
      setCurrentProfile(profile);
    },
    [applyMidMatchTacticalChange, fixture.id],
  );

  // HM-COACHING-0.2: a shout's delivery/expiry each independently splice
  // via the exact same career action a permanent instruction uses --
  // the only difference is that expiry calls it a second time, later,
  // with the baseline profile captured at the moment the shout was
  // called, reverting the temporary override.
  const handleShoutDelivered = useCallback(
    (deliveryMinute: number, overrideProfile: TeamTacticalProfile) => {
      applyMidMatchTacticalChange(fixture.id, deliveryMinute, overrideProfile);
      setCurrentProfile(overrideProfile);
    },
    [applyMidMatchTacticalChange, fixture.id],
  );
  const handleShoutExpired = useCallback(
    (expiryMinute: number, baselineProfile: TeamTacticalProfile) => {
      applyMidMatchTacticalChange(fixture.id, expiryMinute, baselineProfile);
      setCurrentProfile(baselineProfile);
    },
    [applyMidMatchTacticalChange, fixture.id],
  );

  const {
    view,
    speed,
    setSpeed,
    startSecondHalf,
    instantResult,
    pendingInstruction,
    instructionStatus,
    issueInstruction,
    canCallTimeout,
    callTimeout,
    endTimeout,
    timeoutSecondsRemaining,
    issueTimeoutInstruction,
    pendingShout,
    shoutStatus,
    issueShout,
  } = useLiveMatch(result, handleInstructionAdopted, handleShoutDelivered, handleShoutExpired);

  const home = getClub(fixture.homeClubId)!;
  const away = getClub(fixture.awayClubId)!;
  const isPlayerHome = fixture.homeClubId === playerClubId;
  const ownSquad = getCareerSquad(career);
  const isTimeout = view.phase === "TIMEOUT";
  const canIssueInstruction = !pendingInstruction && (view.phase === "FIRST_HALF" || view.phase === "SECOND_HALF");
  const canIssueTimeoutInstruction = !pendingInstruction && isTimeout;
  const canIssueShout = !pendingShout && (view.phase === "FIRST_HALF" || view.phase === "SECOND_HALF");

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.revealedEvents.length]);

  const ownPlayerGoals = isPlayerHome ? view.homePlayerGoals : view.awayPlayerGoals;
  const ownContributions = isPlayerHome ? result.homePlayerContributions : result.awayPlayerContributions;
  const isFullTime = view.phase === "FULL_TIME";
  const isHalfTime = view.phase === "HALF_TIME";
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

      {/* Player stats -- Tumba only, goals live, shots/rating revealed at full time (Spec S12: do not fake live totals the timeline cannot reconstruct). */}
      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Spelarstatistik — {isPlayerHome ? home.shortName : away.shortName}</span>
        </div>
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
            {ownContributions.map((c) => {
              const player = getCareerPlayer(career, c.playerId) ?? ownSquad.find((p) => p.id === c.playerId);
              const liveGoals = ownPlayerGoals[c.playerId] ?? 0;
              return (
                <tr key={c.playerId}>
                  <td className="hm-td-strong">{player ? `${player.firstName} ${player.lastName}` : c.playerId}</td>
                  <td className="hm-table-num">{liveGoals}</td>
                  <td className="hm-table-num">{isFullTime ? c.shots : "—"}</td>
                  <td className="hm-table-num">{isFullTime ? c.rating.toFixed(1) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                onClick={() => issueTimeoutInstruction(draftProfile)}
              >
                BEORDRA ÄNDRING (TIMEOUT)
              </button>
              <button type="button" className="hm-btn hm-btn-sm" onClick={endTimeout}>
                ÅTERUPPTA →
              </button>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {pendingInstruction
                  ? `${instructionStatus} — adopteras ${formatMatchMinute(instructionAdoptionMinute(pendingInstruction))} (snabbare än en vanlig sidlinjeinstruktion tack vare timeouten).`
                  : "Ingen ändring beordrad under denna timeout -- matchtiden är fryst tills du återupptar."}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* HM-TACTICS-0.7: in-match tactical adjustment (only the 3 HM-TACTICS-0.6A controls -- no shouts/7v6/receptiveness here). */
        <div className="hm-panel">
          <div className="hm-panel-header">
            <span className="hm-panel-title">Taktisk justering (live)</span>
            {pendingInstruction ? (
              <span className="hm-badge hm-badge-neutral">
                {instructionStatus} — adopteras {formatMatchMinute(instructionAdoptionMinute(pendingInstruction))}
              </span>
            ) : (
              <span className="hm-badge hm-badge-neutral">AKTUELL</span>
            )}
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
                onClick={() => issueInstruction(draftProfile)}
              >
                BEORDRA ÄNDRING
              </button>
              <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>
                {pendingInstruction
                  ? `PENDING sedan ${formatMatchMinute(pendingInstruction.issuedMinute)} — instruktionen slår igenom vid ${formatMatchMinute(instructionAdoptionMinute(pendingInstruction))}, aldrig det redan spelade förloppet.`
                  : `CURRENT: gäller från matchstart${currentProfile !== career.tacticalProfile ? " (justerad under matchen)" : ""}.`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* HM-COACHING-0.2: sideline shouts -- a small, TEMPORARY nudge (issued -> pending -> active -> expired) distinct from the permanent tactical instruction/timeout panels above. Never available during a TIMEOUT (that has its own dedicated coaching flow). */}
      {!isTimeout ? (
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

function TeamColumn({ clubId, attacking }: { clubId: string; attacking: boolean }) {
  const c = getClub(clubId)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 130 }}>
      <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} size={40} />
      <div style={{ fontSize: "var(--hm-text-xs)", fontWeight: attacking ? 800 : 700, textAlign: "center" }}>{c.shortName}</div>
    </div>
  );
}
