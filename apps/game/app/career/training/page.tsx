"use client";
import TrainingFeedback from '@/components/manager/TrainingFeedback';
import Link from "next/link";
import { clubColorVars, MatchHero, PlayerCell } from "@/components/game/Identity";
import { PageHeading } from "@/components/manager/Workspace";
import ClubCrest from "@/components/ClubCrest";
import { formatGameDate } from "@/lib/career/dateUtils";

// HM-TRAINING-1.0 Part 24/25: the live Training workspace -- a WEEK view
// (Monday-Sunday columns) the manager can apply a template to, edit
// individual days/sessions on, and a compact player-readiness panel
// (Part 25). Replaces the previous fully-static mock page.

import { Suspense, useState } from "react";
import { useSearchParams } from 'next/navigation';
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
import { matchFitnessOf } from "../../../lib/players/matchFitness";
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

function sessionCategory(type: TrainingSessionType): { label: string; tone: "tactical" | "physical" | "technical" | "recovery" } {
  switch (type) {
    case "TEAM_TACTICAL":
    case "ATTACK":
    case "DEFENCE":
    case "TRANSITION":
    case "SPECIAL_PLAY":
    case "MATCH_PREPARATION":
      return { label: "Taktik & lagspel", tone: "tactical" };
    case "PHYSICAL":
    case "STRENGTH":
    case "CONDITIONING":
      return { label: "Fysik & kondition", tone: "physical" };
    case "RECOVERY":
      return { label: "Återhämtning", tone: "recovery" };
    default:
      return { label: "Teknik & individuell", tone: "technical" };
  }
}

// HM-PLAYTEST-01 3.3: each option names the control it belongs to, so two
// selects side by side never both just say "Normal".
const INTENSITY_LABEL: Record<TrainingIntensity, string> = { LOW: "Intensitet: låg", NORMAL: "Intensitet: normal", HIGH: "Intensitet: hög", VERY_HIGH: "Intensitet: mycket hög" };
const INTENSITY_BADGE: Record<TrainingIntensity, string> = { LOW: "Låg", NORMAL: "Normal", HIGH: "Hög", VERY_HIGH: "Max" };
const DURATION_LABEL: Record<TrainingDuration, string> = { SHORT: "Passlängd: kort", NORMAL: "Passlängd: normal", LONG: "Passlängd: lång" };
const INTENSITY_HELP = "Intensitet: hur hårt passet körs. Högre intensitet ger mer utvecklingsstimulans men kostar mer energi (×0,6 låg – ×1,8 mycket hög) och ökar skaderisken.";
const DURATION_HELP = "Passlängd: hur långt passet är. Längre pass ger mer stimulans och kostar mer energi (×0,7 kort – ×1,3 lång).";
const TARGET_LABEL: Record<TrainingSessionTarget, string> = { ALL: "Alla", OUTCOURT: "Utespelare", GOALKEEPERS: "Målvakter", SELECTED_PLAYERS: "Utvalda" };
const TEMPLATE_LABEL: Record<WeeklyTrainingTemplate, string> = { BALANCED: "Balanserad", TACTICAL: "Taktisk", PHYSICAL: "Fysisk", RECOVERY: "Återhämtning", MATCH_HEAVY: "Matchtätt" };
const LOAD_SETTING_LABEL: Record<PlayerTrainingLoadSetting, string> = { FULL: "Full", REDUCED: "Reducerad", RECOVERY_ONLY: "Endast återhämtning", REST: "Vila" };
const FOCUS_LABEL: Record<IndividualDevelopmentFocus, string> = {
  NORMAL: "Inget särskilt fokus (allsidig utveckling)",
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

export default function TrainingPage() { return <Suspense fallback={<div className="hm-empty" role="status">Förbereder träningsveckan…</div>}><Training /></Suspense>; }
function Training() {
  const params = useSearchParams();
  const requestedWeek = params.get('week');
  const { career, setTrainingDayType, addTrainingSession, removeTrainingSession, updateTrainingSession, applyWeeklyTemplate, setPlayerTrainingLoad, setPlayerIndividualFocus } = useCareer();
  const [weekStart, setWeekStart] = useState(() => mondayOf(requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) && !Number.isNaN(Date.parse(requestedWeek)) ? requestedWeek : career.gameDate));
  const [template, setTemplate] = useState<WeeklyTrainingTemplate>("BALANCED");

  const club = getClub(career.playerClubId);
  const week = resolveTrainingWeek(career, weekStart);
  const squad = getCareerSquad(career);
  const opponentName = (clubId: string) => getClub(clubId)?.shortName ?? getClub(clubId)?.name ?? clubId;
  const staffRoster = career.staffRoster[career.playerClubId] ?? [];
  const headCoach = findHeadCoach(staffRoster);
  const nextMatch = career.fixtures.filter(f => (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId) && !career.results[f.id] && f.date >= career.gameDate).sort((a, b) => a.date.localeCompare(b.date))[0];
  const averageEnergy = squad.length ? Math.round(squad.reduce((sum, player) => sum + (career.playerPhysicalState[player.id]?.currentEnergy ?? ENERGY_START_DEFAULT), 0) / squad.length) : null;
  const averageMatchFitness = squad.length ? Math.round(squad.reduce((sum, player) => sum + matchFitnessOf(career, player.id), 0) / squad.length) : null;
  const recoveryDays = week.days.filter(day => day.dayType === 'REST' || day.dayType === 'RECOVERY').length;
  const sessionCount = week.days.reduce((sum, day) => sum + day.sessions.length, 0);

  return (
    <div className="hm-training-screen" style={clubColorVars(club)}>
      <PageHeading
        eyebrow={`${club?.name ?? career.playerClubId} · ${career.seasonId} / träningsplanen`}
        title="Träning & återhämtning"
        description={`Bygg formen mellan matcherna. Anpassa belastningen till spelarna som ska prestera (snitt matchform: ${averageMatchFitness ?? '—'}%).`}
        actions={
          <div className="hm-actions">
            {club && <ClubCrest clubId={club.id} shortName={club.shortName} primaryColor={club.primaryColor} size={40} />}
            <Link className="hm-btn" href="/career/staff">Ledarstab →</Link>
            <Link className="hm-btn" href="/career/calendar">Kalender →</Link>
          </div>
        }
      />

      <div className="hm-week-context">
        <div>
          <span className="hm-eyebrow">Veckans matchberedskap</span>
          <h2>{formatGameDate(weekStart).split(' ').slice(1, 3).join(' ')} — {formatGameDate(addDaysLocal(weekStart, 6)).split(' ').slice(1, 3).join(' ')}</h2>
          <div className="hm-training-metrics">
            <div><strong>{sessionCount}</strong><span>planerade pass</span></div>
            <div><strong>{recoveryDays}</strong><span>vilo- / återhämtningsdagar</span></div>
            <div><strong>{averageEnergy === null ? '—' : `${averageEnergy}%`}</strong><span>truppens energi idag</span></div>
          </div>
        </div>
        {nextMatch && <MatchHero career={career} fixture={nextMatch} context="Veckan byggs runt matchen" compact />}
      </div>
      <TrainingFeedback />
      <div className="hm-panel hm-training-planner">
        <div className="hm-panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className="hm-panel-title">Veckoschema — {weekStart}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
            <select className="hm-select" aria-label="Veckomall" value={template} onChange={(e) => setTemplate(e.target.value as WeeklyTrainingTemplate)}>
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
          <div className="hm-training-week">
            {week.days.map((day, i) => {
              const fixture = career.fixtures.find((f) => f.date === day.date && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId));
              const opponentClubId = fixture ? (fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId) : null;
              const locked = day.executed;
              return (
                <div key={day.date} className="hm-training-day" data-matchday={!!fixture} data-today={day.date === career.gameDate} data-recovery={day.dayType === 'REST' || day.dayType === 'RECOVERY'}>
                  <div className="hm-training-day-date">
                    <span>{DAY_SHORT[i]}</span>
                    <strong>{Number(day.date.slice(8, 10))}</strong>
                    <small>{formatGameDate(day.date).split(' ')[2]}</small>
                  </div>

                  {fixture ? (
                    <Link className="hm-training-match" href={career.results[fixture.id] ? `/career/match-report/${encodeURIComponent(fixture.id)}` : `/career/fixtures/${encodeURIComponent(fixture.id)}`}>
                      <span>{fixture.homeClubId === career.playerClubId ? 'Hemma' : 'Borta'}</span>
                      <strong>{opponentName(opponentClubId!)}</strong>
                      <span>{career.results[fixture.id] ? 'Matchrapport →' : 'Matchförberedelse →'}</span>
                    </Link>
                  ) : (
                    <select
                      className="hm-select"
                      aria-label={`Dagtyp ${day.date}`}
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
                    {day.sessions.map((session) => {
                      const cat = sessionCategory(session.type);
                      return (
                        <div
                          key={session.id}
                          className="hm-training-session"
                          data-category={cat.tone}
                          data-intensity={session.intensity}
                        >
                          <div className="hm-training-session-head">
                            <span className="hm-training-cat-pill" data-category={cat.tone}>{cat.label}</span>
                            <span className="hm-training-int-pill" data-intensity={session.intensity}>
                              {INTENSITY_BADGE[session.intensity]}
                            </span>
                          </div>
                          <select
                            className="hm-select"
                            aria-label={`Pass ${day.date} ${session.id}`}
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
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <select
                              className="hm-select"
                              aria-label={`Intensitet ${day.date} ${session.id}`}
                              title={INTENSITY_HELP}
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
                              aria-label={`Passlängd ${day.date} ${session.id}`}
                              title={DURATION_HELP}
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
                            aria-label={`Målgrupp ${day.date} ${session.id}`}
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
                                  aria-label={`Ansvarig tränare ${day.date} ${session.id}`}
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
                                  Ansvarig tränare: {resolvedCoach?.displayName ?? "—"} · Tränarens kvalitet för passet: {staffQualityLabel(quality).toLowerCase()}
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
                      );
                    })}
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
                <th>Energi & matchform</th>
                <th>Senaste belastning</th>
                <th title="Hur stor del av passen spelaren deltar i: Full, Reducerad, Endast återhämtning eller Vila. Påverkar energi och utveckling.">Belastning (deltagande)</th>
                <th title="Vilka egenskaper spelarens utvecklingsstimulans riktas mot. Påverkar inte energin.">Individuellt utvecklingsfokus</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const physical = career.playerPhysicalState[p.id];
                const energy = physical?.currentEnergy ?? ENERGY_START_DEFAULT;
                const matchFit = Math.round(matchFitnessOf(career, p.id));
                const status = energy >= 80 ? "Pigg" : energy >= 55 ? "Något sliten" : "Trött";
                const badgeClass = energy >= 80 ? "hm-badge-positive" : energy >= 55 ? "hm-badge-warning" : "hm-badge-negative";
                const loadSetting = career.playerTrainingAssignments[p.id]?.loadSetting ?? "FULL";
                const focus = (career.playerTrainingAssignments[p.id]?.individualFocus as IndividualDevelopmentFocus | undefined) ?? "NORMAL";
                const availability = getPlayerAvailability(career, p.id);
                const activeInjury = career.playerInjuries[p.id]?.activeInjury;
                const onPlacement = career.playerStatuses[p.id]?.availability === "ON_PLACEMENT";
                const enforcedLoadSetting = effectiveTrainingLoadSetting(career, p.id, loadSetting);
                const allowedSettings = PLAYER_TRAINING_LOAD_SETTINGS.filter((l) => effectiveTrainingLoadSetting(career, p.id, l) === l);
                return (
                  <tr key={p.id}>
                    <td className="hm-td-strong">
                      <PlayerCell player={p} />
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
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span className={`hm-badge ${badgeClass}`}>{Math.round(energy)}% · {status}</span>
                        <span className="hm-badge hm-badge-neutral" title="Matchform">MF {matchFit}%</span>
                      </div>
                    </td>
                    <td className="hm-text-muted">{physical ? Math.round(physical.recentLoad) : 0}</td>
                    <td>
                      <select
                        className="hm-select"
                        aria-label={`Träningsbelastning ${p.firstName} ${p.lastName}`}
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
                        aria-label={`Individuellt fokus ${p.firstName} ${p.lastName}`}
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
                      <PlayerCell player={p} />
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
