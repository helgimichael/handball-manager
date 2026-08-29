"use client";

// HM-TRAINING-1.0 Part 24/25: the live Training workspace -- a WEEK view
// (Monday-Sunday columns) the manager can apply a template to, edit
// individual days/sessions on, and a compact player-readiness panel
// (Part 25). Replaces the previous fully-static mock page.

import { useState } from "react";
import { useCareer } from "../../../lib/career/CareerContext";
import { getCareerSquad } from "../../../lib/career/careerWorld";
import { getClub } from "../../../lib/game-data";
import { mondayOf, resolveTrainingWeek } from "../../../lib/training/trainingSchedule";
import {
  PLAYER_TRAINING_LOAD_SETTINGS,
  TRAINING_DAY_TYPES,
  TRAINING_DURATIONS,
  TRAINING_INTENSITIES,
  TRAINING_SESSION_TARGETS,
  TRAINING_SESSION_TYPES,
  WEEKLY_TRAINING_TEMPLATES,
  type PlayerTrainingLoadSetting,
  type TrainingDayType,
  type TrainingDuration,
  type TrainingIntensity,
  type TrainingSessionTarget,
  type TrainingSessionType,
  type WeeklyTrainingTemplate,
} from "../../../lib/training/types";
import { ENERGY_START_DEFAULT } from "../../../lib/matchPlan/physicalModel";
import { playerAgeAtDate } from "../../../lib/development/developmentIntegration";
import { effectiveTrainingLoadSetting, getPlayerAvailability } from "../../../lib/medical/availability";
import { REHAB_PHASE_LABELS } from "../../../lib/medical/labels";
import { abilityStarsFromCA, INDIVIDUAL_DEVELOPMENT_FOCUSES, potentialStarsFromPA, type IndividualDevelopmentFocus } from "../../../lib/development/types";
import { computeStaffTrainingQuality, eligibleStaffForSession, findHeadCoach, resolveResponsibleCoach, staffQualityLabel } from "../../../lib/staff/roleSuitability";

const DAY_TYPE_LABEL: Record<TrainingDayType, string> = {
  TRAINING: "Träning",
  RECOVERY: "Återhämtning",
  REST: "Vila",
  MATCH: "Match",
  TRAVEL: "Resa",
};

const SESSION_TYPE_LABEL: Record<TrainingSessionType, string> = {
  TEAM_TACTICAL: "Lagtaktik",
  ATTACK: "Anfallsspel",
  DEFENCE: "Försvarsspel",
  TRANSITION: "Omställning",
  SPECIAL_PLAY: "Specialspel",
  TECHNICAL: "Teknik",
  PHYSICAL: "Fysik",
  STRENGTH: "Styrka",
  CONDITIONING: "Kondition",
  GOALKEEPER: "Målvakt",
  MATCH_PREPARATION: "Matchförberedelse",
  RECOVERY: "Återhämtning",
};

const INTENSITY_LABEL: Record<TrainingIntensity, string> = { LOW: "Låg", NORMAL: "Normal", HIGH: "Hög", VERY_HIGH: "Mycket hög" };
const DURATION_LABEL: Record<TrainingDuration, string> = { SHORT: "Kort", NORMAL: "Normal", LONG: "Lång" };
const TARGET_LABEL: Record<TrainingSessionTarget, string> = { ALL: "Alla", OUTCOURT: "Utespelare", GOALKEEPERS: "Målvakter", SELECTED_PLAYERS: "Utvalda" };
const TEMPLATE_LABEL: Record<WeeklyTrainingTemplate, string> = { BALANCED: "Balanserad", TACTICAL: "Taktisk", PHYSICAL: "Fysisk", RECOVERY: "Återhämtning", MATCH_HEAVY: "Matchtätt" };
const LOAD_SETTING_LABEL: Record<PlayerTrainingLoadSetting, string> = { FULL: "Full", REDUCED: "Reducerad", RECOVERY_ONLY: "Endast återhämtning", REST: "Vila" };
const FOCUS_LABEL: Record<IndividualDevelopmentFocus, string> = {
  NORMAL: "Normal",
  TECHNICAL: "Teknik",
  ATTACKING_DECISIONS: "Anfallsspel",
  DEFENCE: "Försvarsspel",
  PHYSICAL: "Fysik",
  MENTAL: "Mentalt",
  GOALKEEPER: "Målvaktsspel",
};

const DAY_SHORT = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

function addDaysLocal(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function TrainingPage() {
  const { career, setTrainingDayType, addTrainingSession, removeTrainingSession, updateTrainingSession, applyWeeklyTemplate, setPlayerTrainingLoad, setPlayerIndividualFocus } = useCareer();
  const [weekStart, setWeekStart] = useState(() => mondayOf(career.gameDate));
  const [template, setTemplate] = useState<WeeklyTrainingTemplate>("BALANCED");

  const week = resolveTrainingWeek(career, weekStart);
  const squad = getCareerSquad(career);
  const opponentName = (clubId: string) => getClub(clubId)?.shortName ?? getClub(clubId)?.name ?? clubId;
  const staffRoster = career.staffRoster[career.playerClubId] ?? [];
  const headCoach = findHeadCoach(staffRoster);

  return (
    <div className="hm-grid" style={{ gridTemplateColumns: "1fr", gap: 12 }}>
      <div className="hm-panel">
        <div className="hm-panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className="hm-panel-title">Veckoschema — {weekStart}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="hm-btn hm-btn-sm" onClick={() => setWeekStart((w) => addDaysLocal(w, -7))}>
              ← Föregående vecka
            </button>
            <button className="hm-btn hm-btn-sm" onClick={() => setWeekStart(mondayOf(career.gameDate))}>
              Denna vecka
            </button>
            <button className="hm-btn hm-btn-sm" onClick={() => setWeekStart((w) => addDaysLocal(w, 7))}>
              Nästa vecka →
            </button>
            <span className="hm-divider" style={{ height: 20, width: 1 }} />
            <select className="hm-select" value={template} onChange={(e) => setTemplate(e.target.value as WeeklyTrainingTemplate)}>
              {WEEKLY_TRAINING_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABEL[t]}
                </option>
              ))}
            </select>
            <button className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => applyWeeklyTemplate(weekStart, template)}>
              Tillämpa mall
            </button>
          </div>
        </div>

        <div className="hm-scroll-x">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(180px, 1fr))", gap: 8, padding: "12px 16px" }}>
            {week.days.map((day, i) => {
              const fixture = career.fixtures.find((f) => f.date === day.date && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId));
              const opponentClubId = fixture ? (fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId) : null;
              const locked = day.executed;
              return (
                <div key={day.date} className="hm-panel" style={{ padding: 8, background: "var(--hm-surface-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="hm-td-strong">{DAY_SHORT[i]}</span>
                    <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{day.date}</span>
                  </div>

                  {fixture ? (
                    <div className="hm-badge hm-badge-negative" style={{ marginTop: 6, display: "inline-block" }}>
                      Match vs {opponentName(opponentClubId!)}
                    </div>
                  ) : (
                    <select
                      className="hm-select"
                      style={{ marginTop: 6, width: "100%" }}
                      value={day.dayType}
                      disabled={locked}
                      onChange={(e) => setTrainingDayType(weekStart, day.date, e.target.value as TrainingDayType)}
                    >
                      {TRAINING_DAY_TYPES.filter((t) => t !== "MATCH").map((t) => (
                        <option key={t} value={t}>
                          {DAY_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  )}

                  {locked && (
                    <div className="hm-badge hm-badge-neutral" style={{ marginTop: 6 }}>
                      Genomförd
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {day.sessions.map((session) => (
                      <div key={session.id} className="hm-panel" style={{ padding: 6, background: "var(--hm-surface-3)" }}>
                        <select
                          className="hm-select"
                          style={{ width: "100%", marginBottom: 4 }}
                          value={session.type}
                          disabled={locked}
                          onChange={(e) => updateTrainingSession(weekStart, day.date, session.id, { type: e.target.value as TrainingSessionType })}
                        >
                          {TRAINING_SESSION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {SESSION_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                        <div style={{ display: "flex", gap: 4 }}>
                          <select
                            className="hm-select"
                            style={{ flex: 1 }}
                            value={session.intensity}
                            disabled={locked}
                            onChange={(e) => updateTrainingSession(weekStart, day.date, session.id, { intensity: e.target.value as TrainingIntensity })}
                          >
                            {TRAINING_INTENSITIES.map((t) => (
                              <option key={t} value={t}>
                                {INTENSITY_LABEL[t]}
                              </option>
                            ))}
                          </select>
                          <select
                            className="hm-select"
                            style={{ flex: 1 }}
                            value={session.duration}
                            disabled={locked}
                            onChange={(e) => updateTrainingSession(weekStart, day.date, session.id, { duration: e.target.value as TrainingDuration })}
                          >
                            {TRAINING_DURATIONS.map((t) => (
                              <option key={t} value={t}>
                                {DURATION_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <select
                          className="hm-select"
                          style={{ width: "100%", marginTop: 4 }}
                          value={session.target}
                          disabled={locked}
                          onChange={(e) => updateTrainingSession(weekStart, day.date, session.id, { target: e.target.value as TrainingSessionTarget })}
                        >
                          {TRAINING_SESSION_TARGETS.map((t) => (
                            <option key={t} value={t}>
                              {TARGET_LABEL[t]}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const eligible = eligibleStaffForSession(staffRoster, session.type);
                          const resolvedCoach = resolveResponsibleCoach(staffRoster, session.type, session.coachId ?? null);
                          const quality = computeStaffTrainingQuality(session.type, resolvedCoach, headCoach);
                          if (eligible.length === 0) return null;
                          return (
                            <>
                              <select
                                className="hm-select"
                                style={{ width: "100%", marginTop: 4 }}
                                value={session.coachId ?? ""}
                                disabled={locked}
                                onChange={(e) => updateTrainingSession(weekStart, day.date, session.id, { coachId: e.target.value || null })}
                              >
                                <option value="">Ingen (auto)</option>
                                {eligible.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.displayName}
                                  </option>
                                ))}
                              </select>
                              <div className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)", marginTop: 4 }}>
                                Ansvarig: {resolvedCoach?.displayName ?? "—"} · Kvalitet: {staffQualityLabel(quality)}
                              </div>
                            </>
                          );
                        })()}
                        {!locked && (
                          <button className="hm-btn hm-btn-sm" style={{ width: "100%", marginTop: 4 }} onClick={() => removeTrainingSession(weekStart, day.date, session.id)}>
                            Ta bort pass
                          </button>
                        )}
                      </div>
                    ))}
                    {!locked && day.dayType !== "REST" && day.dayType !== "TRAVEL" && day.sessions.length < 2 && (
                      <button
                        className="hm-btn hm-btn-sm"
                        onClick={() =>
                          addTrainingSession(weekStart, day.date, { type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" })
                        }
                      >
                        + Lägg till pass
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Spelarberedskap</span>
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Spelare</th>
                <th>Energi</th>
                <th>Senaste belastning</th>
                <th>Träningsbelastning</th>
                <th>Individuellt fokus</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const physical = career.playerPhysicalState[p.id];
                const energy = physical?.currentEnergy ?? ENERGY_START_DEFAULT;
                const status = energy >= 80 ? "Pigg" : energy >= 55 ? "Normal" : "Trött";
                const badgeClass = energy >= 80 ? "hm-badge-positive" : energy >= 55 ? "hm-badge-warning" : "hm-badge-negative";
                const loadSetting = career.playerTrainingAssignments[p.id]?.loadSetting ?? "FULL";
                const focus = (career.playerTrainingAssignments[p.id]?.individualFocus as IndividualDevelopmentFocus | undefined) ?? "NORMAL";
                // HM-INJURIES-1.0 Part 33: an injured/limited player's own
                // load selector must reflect the enforced maximum -- the
                // manager cannot accidentally put an injured player on FULL.
                const availability = getPlayerAvailability(career, p.id);
                const activeInjury = career.playerInjuries[p.id]?.activeInjury;
                // HM-CLUB-PARTNERSHIPS-1.1: a player ON_PLACEMENT is fully
                // fit -- REST is enforced here because they train at the
                // partner club instead, never because they're injured.
                // Checked ahead of the generic UNAVAILABLE branch so the
                // injury-flavoured copy below never misrepresents them.
                const onPlacement = career.playerStatuses[p.id]?.availability === "ON_PLACEMENT";
                const enforcedLoadSetting = effectiveTrainingLoadSetting(career, p.id, loadSetting);
                const allowedSettings = PLAYER_TRAINING_LOAD_SETTINGS.filter((l) => effectiveTrainingLoadSetting(career, p.id, l) === l);
                return (
                  <tr key={p.id}>
                    <td className="hm-td-strong">
                      {p.firstName} {p.lastName}
                      {onPlacement ? (
                        <span className="hm-badge hm-badge-neutral" style={{ marginLeft: 6 }}>
                          PLACERAD HOS PARTNERKLUBB
                        </span>
                      ) : availability === "UNAVAILABLE" && activeInjury ? (
                        <span className="hm-badge hm-badge-negative" style={{ marginLeft: 6 }}>
                          SKADAD — {REHAB_PHASE_LABELS[activeInjury.currentPhase]}
                        </span>
                      ) : availability === "LIMITED" ? (
                        <span className="hm-badge hm-badge-warning" style={{ marginLeft: 6 }}>
                          ÅTERGÅNG — Reducerad
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`hm-badge ${badgeClass}`}>{Math.round(energy)}% · {status}</span>
                    </td>
                    <td className="hm-text-muted">{physical ? Math.round(physical.recentLoad) : 0}</td>
                    <td>
                      <select
                        className="hm-select"
                        value={enforcedLoadSetting}
                        disabled={availability === "UNAVAILABLE"}
                        title={onPlacement ? "Spelaren tränar hos partnerklubben -- ingen belastning här" : availability === "UNAVAILABLE" ? "Skadad spelare -- endast vila tillåten" : availability === "LIMITED" ? "Under återgång -- maximalt reducerad belastning" : undefined}
                        onChange={(e) => setPlayerTrainingLoad(p.id, e.target.value as PlayerTrainingLoadSetting)}
                      >
                        {(availability === "AVAILABLE" ? PLAYER_TRAINING_LOAD_SETTINGS : allowedSettings).map((l) => (
                          <option key={l} value={l}>
                            {LOAD_SETTING_LABEL[l]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="hm-select"
                        value={focus}
                        onChange={(e) => setPlayerIndividualFocus(p.id, e.target.value === "NORMAL" ? null : e.target.value)}
                      >
                        {INDIVIDUAL_DEVELOPMENT_FOCUSES.map((f) => (
                          <option key={f} value={f}>
                            {FOCUS_LABEL[f]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hm-panel">
        <div className="hm-panel-header">
          <span className="hm-panel-title">Utveckling</span>
        </div>
        <div className="hm-scroll-x">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Spelare</th>
                <th>Ålder</th>
                <th>Nivå</th>
                <th>Potential</th>
                <th>Status</th>
                <th>Senaste förbättring</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const rating = career.gameplayRatings[career.playerClubId]?.find((r) => r.playerId === p.id);
                const dev = career.playerDevelopmentState[p.id];
                const age = playerAgeAtDate(p.dateOfBirth, p.birthYear, career.gameDate);
                const latestEvent = dev?.developmentHistory[0];
                const hasPendingProgress = dev ? Object.values(dev.attributeStimulus).some((v) => (v ?? 0) > 0) || Object.values(dev.attributeProgress).some((v) => (v ?? 0) > 0) : false;
                const status = latestEvent && dev!.developmentHistory.length > 0 && dev!.lastDevelopmentDate ? "Förbättras" : hasPendingProgress ? "Tränar" : "Ingen data";
                return (
                  <tr key={p.id}>
                    <td className="hm-td-strong">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="hm-text-muted">{age ?? "—"}</td>
                    <td>{rating ? "★".repeat(abilityStarsFromCA(rating.ca)) + "☆".repeat(5 - abilityStarsFromCA(rating.ca)) : "—"}</td>
                    <td>{rating ? "★".repeat(potentialStarsFromPA(rating.pa)) + "☆".repeat(5 - potentialStarsFromPA(rating.pa)) : "—"}</td>
                    <td>
                      <span className={`hm-badge ${status === "Förbättras" ? "hm-badge-positive" : status === "Tränar" ? "hm-badge-warning" : "hm-badge-neutral"}`}>{status}</span>
                    </td>
                    <td className="hm-text-muted">
                      {latestEvent ? `${latestEvent.attribute} ${latestEvent.previousValue} → ${latestEvent.newValue} (${latestEvent.date})` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
