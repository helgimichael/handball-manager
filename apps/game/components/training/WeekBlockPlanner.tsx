"use client";
// Arena Nights TRN-01b (block planner) + TRN-01e (outcome on executed
// day). Session blocks sized by intensity (height) and duration (width),
// a per-day load bar, a palette to tap-then-place or drag, keyboard arrow
// navigation between slots and an inspector that edits the selected
// block. Every change goes through the existing CareerContext training
// actions -- nothing new is computed or persisted here.
import Link from "next/link";
import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { DAY_TYPE_LABEL, SESSION_TYPE_LABEL } from "@/lib/training/labels";
import { mondayOf } from "@/lib/training/trainingSchedule";
import {
  TRAINING_DAY_TYPES,
  TRAINING_DURATIONS,
  TRAINING_INTENSITIES,
  TRAINING_SESSION_TARGETS,
  TRAINING_SESSION_TYPES,
  WEEKLY_TRAINING_TEMPLATES,
  type TrainingDay,
  type TrainingDayType,
  type TrainingSession,
  type TrainingSessionType,
  type TrainingWeek,
  type WeeklyTrainingTemplate,
} from "@/lib/training/types";
import { sessionCategory, sessionTeamLoad, trainingDayOutcome } from "@/lib/training/weekPlanView";
import { computeStaffTrainingQuality, eligibleStaffForSession, findHeadCoach, resolveResponsibleCoach, staffQualityLabel } from "@/lib/staff/roleSuitability";
import { getClub } from "@/lib/game-data";
import TrainingFeedback from "@/components/manager/TrainingFeedback";
import { blockData, DayHead, DURATION_HELP, DURATION_SHORT, INTENSITY_HELP, INTENSITY_SHORT, LoadBar, SessionBlockBody, shortDate, signed, TARGET_SHORT, DAY_SHORT } from "./weekParts";

const TEMPLATE_LABEL: Record<WeeklyTrainingTemplate, string> = { BALANCED: "Balanserad", TACTICAL: "Taktisk", PHYSICAL: "Fysisk", RECOVERY: "Återhämtning", MATCH_HEAVY: "Matchtätt" };

type Selection = { date: string; index: number } | { date: string; outcome: true } | null;

export function canAddSession(day: TrainingDay, locked: boolean, matchday: boolean): boolean {
  return !locked && !matchday && day.dayType !== "REST" && day.dayType !== "TRAVEL" && day.dayType !== "MATCH" && day.sessions.length < 2;
}

function addReason(day: TrainingDay, locked: boolean, matchday: boolean): string | null {
  if (locked || matchday) return null;
  if (day.dayType === "REST") return "Vilodag – inga pass.";
  if (day.dayType === "TRAVEL") return "Resdag – inga pass.";
  return null;
}

export default function WeekBlockPlanner({ weekStart, week, onWeekChange, warning }: { weekStart: string; week: TrainingWeek; onWeekChange: (next: string) => void; warning?: string }) {
  const { career, setTrainingDayType, addTrainingSession, removeTrainingSession, updateTrainingSession, applyWeeklyTemplate } = useCareer();
  const [template, setTemplate] = useState<WeeklyTrainingTemplate>("BALANCED");
  const [armed, setArmed] = useState<TrainingSessionType | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [notice, setNotice] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);

  const staffRoster = career.staffRoster[career.playerClubId] ?? [];
  const headCoach = findHeadCoach(staffRoster);
  const ownFixture = (date: string) => career.fixtures.find((f) => f.date === date && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId));
  const opponentName = (clubId: string) => getClub(clubId)?.shortName ?? getClub(clubId)?.name ?? clubId;
  const locked = (day: TrainingDay) => day.executed;
  const isEditable = (day: TrainingDay) => !locked(day);

  const focusInspector = () => requestAnimationFrame(() => inspectorRef.current?.focus());
  const select = (next: Selection) => {
    setSelected(next);
    if (next) focusInspector();
  };

  const place = (day: TrainingDay, type: TrainingSessionType) => {
    addTrainingSession(weekStart, day.date, { type, intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
    setNotice(`${SESSION_TYPE_LABEL[type]} lagt ${DAY_SHORT[week.days.indexOf(day)].toLowerCase()} ${shortDate(day.date)}.`);
  };

  const move = (fromDate: string, session: TrainingSession, to: TrainingDay) => {
    if (fromDate === to.date) return;
    const newId = `${to.date}:s${to.sessions.length}`;
    addTrainingSession(weekStart, to.date, { type: session.type, intensity: session.intensity, duration: session.duration, target: session.target, tacticalFocus: session.tacticalFocus });
    if ((session.coachId || session.selectedPlayerIds) && !to.sessions.some((s) => s.id === newId)) {
      updateTrainingSession(weekStart, to.date, newId, { coachId: session.coachId, selectedPlayerIds: session.selectedPlayerIds });
    }
    removeTrainingSession(weekStart, fromDate, session.id);
    setSelected(null);
    setNotice(`${SESSION_TYPE_LABEL[session.type]} flyttat till ${shortDate(to.date)}.`);
  };

  const onDrop = (e: DragEvent, day: TrainingDay) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/trn-type") as TrainingSessionType;
    const moveData = e.dataTransfer.getData("text/trn-move");
    if (type && TRAINING_SESSION_TYPES.includes(type)) place(day, type);
    else if (moveData) {
      const [fromDate, index] = moveData.split("|");
      const from = week.days.find((d) => d.date === fromDate);
      const session = from?.sessions[Number(index)];
      if (from && session) move(fromDate, session, day);
    }
  };

  // Keyboard: arrows move between slots (left/right = day, up/down = slot).
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const cell = target.closest<HTMLElement>("[data-cell]");
    if (!cell || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      if (e.key === "Escape" && armed) setArmed(null);
      return;
    }
    const [d, s] = cell.dataset.cell!.split(",").map(Number);
    const cells = [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-cell]") ?? [])];
    const at = (dd: number, ss: number) => cells.find((c) => c.dataset.cell === `${dd},${ss}`);
    let next: HTMLElement | undefined;
    if (e.key === "ArrowUp") next = at(d, s - 1);
    if (e.key === "ArrowDown") next = at(d, s + 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const step = e.key === "ArrowLeft" ? -1 : 1;
      for (let dd = d + step; dd >= 0 && dd < 7 && !next; dd += step) next = at(dd, s) ?? at(dd, 0) ?? at(dd, 1);
    }
    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const selectedDay = selected ? week.days.find((d) => d.date === selected.date) : undefined;
  const selectedIndex = selected && "index" in selected ? selected.index : -1;
  const selectedSession = selectedDay && selectedIndex >= 0 ? selectedDay.sessions[selectedIndex] : undefined;

  return (
    <section className="hm-panel trn-planner" aria-labelledby="trn-planner-title">
      <div className="trn-planner-head">
        <h2 id="trn-planner-title" className="hm-panel-title">Veckoschema</h2>
        <div className="trn-toolbar">
          <button className="hm-btn hm-btn-sm" onClick={() => onWeekChange(addDaysLocal(weekStart, -7))}>← Föregående vecka</button>
          <button className="hm-btn hm-btn-sm" onClick={() => onWeekChange(mondayOf(career.gameDate))}>Denna vecka</button>
          <button className="hm-btn hm-btn-sm" onClick={() => onWeekChange(addDaysLocal(weekStart, 7))}>Nästa vecka →</button>
          <span className="trn-toolbar-sep" aria-hidden="true" />
          <select className="hm-select" aria-label="Veckomall" value={template} onChange={(e) => setTemplate(e.target.value as WeeklyTrainingTemplate)}>
            {WEEKLY_TRAINING_TEMPLATES.map((t) => <option key={t} value={t}>{TEMPLATE_LABEL[t]}</option>)}
          </select>
          <button className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => { applyWeeklyTemplate(weekStart, template); setNotice(`Mallen ${TEMPLATE_LABEL[template]} är lagd på veckans ej genomförda dagar.`); }}>Tillämpa mall</button>
        </div>
      </div>
      {warning && <p className="trn-warning" role="note">{warning}</p>}

      <div className="trn-palette" role="toolbar" aria-label="Passtyper – välj en och tryck på en tom plats, eller dra till en dag">
        {TRAINING_SESSION_TYPES.map((type) => {
          const tone = sessionCategory(type).tone;
          const load = sessionTeamLoad({ type, intensity: "NORMAL", duration: "NORMAL" });
          return (
            <button
              key={type}
              type="button"
              className="trn-chip"
              data-tone={tone}
              aria-pressed={armed === type}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/trn-type", type); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => setArmed((a) => (a === type ? null : type))}
              title={`${sessionCategory(type).label} · ${signed(load)} energi vid normal intensitet och längd`}
            >
              {SESSION_TYPE_LABEL[type]}
            </button>
          );
        })}
      </div>
      <p className="trn-hint" aria-live="polite">
        {armed ? `${SESSION_TYPE_LABEL[armed]} vald – tryck på en tom plats för att lägga passet. Esc avbryter.` : "Tryck på ett pass för att redigera det, välj en passtyp ovan och tryck på en tom plats, eller dra. Piltangenter flyttar mellan platserna."}
      </p>

      <nav className="trn-day-nav" aria-label="Välj dag">
        {week.days.map((day, i) => (
          <a key={day.date} href={`#trn-day-${day.date}`} data-today={day.date === career.gameDate || undefined} data-match={!!ownFixture(day.date) || undefined}>
            {DAY_SHORT[i]} <b>{Number(day.date.slice(8, 10))}</b>
          </a>
        ))}
      </nav>

      <div className="trn-week-scroll">
        <div className="trn-week" ref={gridRef} onKeyDown={onGridKey}>
          {week.days.map((day, d) => {
            const fixture = ownFixture(day.date);
            const opponent = fixture ? (fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId) : null;
            const isLocked = locked(day);
            const can = canAddSession(day, isLocked, !!fixture);
            const reason = addReason(day, isLocked, !!fixture);
            const outcome = trainingDayOutcome(day);
            return (
              <div
                key={day.date}
                id={`trn-day-${day.date}`}
                className="trn-day"
                data-matchday={!!fixture || undefined}
                data-today={day.date === career.gameDate || undefined}
                data-recovery={day.dayType === "REST" || day.dayType === "RECOVERY" || undefined}
                data-locked={isLocked || undefined}
                onDragOver={(e) => { if (can) e.preventDefault(); }}
                onDrop={(e) => can && onDrop(e, day)}
              >
                <DayHead index={d} date={day.date} today={day.date === career.gameDate} />
                {fixture ? (
                  <Link className="trn-match" href={career.results[fixture.id] ? `/career/match-report/${encodeURIComponent(fixture.id)}` : `/career/fixtures/${encodeURIComponent(fixture.id)}`}>
                    <span>{fixture.homeClubId === career.playerClubId ? "Hemma" : "Borta"}</span>
                    <strong>{opponentName(opponent!)}</strong>
                    <span>{career.results[fixture.id] ? "Matchrapport →" : "Matchförberedelse →"}</span>
                  </Link>
                ) : (
                  <select className="hm-select trn-daytype" aria-label={`Dagtyp ${day.date}`} value={day.dayType} disabled={isLocked} onChange={(e) => setTrainingDayType(weekStart, day.date, e.target.value as TrainingDayType)}>
                    {TRAINING_DAY_TYPES.filter((t) => t !== "MATCH").map((t) => <option key={t} value={t}>{DAY_TYPE_LABEL[t]}</option>)}
                  </select>
                )}
                {!fixture && <LoadBar day={day} />}

                {isLocked && (
                  <button
                    type="button"
                    className="trn-outcome"
                    data-cell={`${d},0`}
                    aria-pressed={!!selected && "outcome" in selected && selected.date === day.date}
                    onClick={() => select(selected && "outcome" in selected && selected.date === day.date ? null : { date: day.date, outcome: true })}
                  >
                    <span>Genomförd</span>
                    {outcome && outcome.attendance > 0 ? (
                      <>
                        <strong>{signed(outcome.averageDelta ?? 0)} <small>energi i snitt</small></strong>
                        <small>{outcome.attendance} deltog · {outcome.sessions} pass</small>
                      </>
                    ) : (
                      <small>{day.dayType === "REST" ? "Vila – ingen träning" : "Inga pass genomförda"}</small>
                    )}
                  </button>
                )}

                <div className="trn-slots">
                  {day.sessions.map((session, s) => {
                    const active = selectedIndex === s && selected?.date === day.date;
                    return (
                      <button
                        key={`${session.id}-${s}`}
                        type="button"
                        className="trn-block"
                        {...blockData(session)}
                        data-cell={isLocked ? undefined : `${d},${s}`}
                        aria-pressed={active}
                        aria-label={`${SESSION_TYPE_LABEL[session.type]}, ${INTENSITY_SHORT[session.intensity].toLowerCase()} intensitet, ${DURATION_SHORT[session.duration].toLowerCase()} längd, ${TARGET_SHORT[session.target].toLowerCase()} – ${shortDate(day.date)} pass ${s + 1}${isLocked ? " (genomfört)" : ""}`}
                        disabled={isLocked}
                        draggable={!isLocked}
                        onDragStart={(e) => { e.dataTransfer.setData("text/trn-move", `${day.date}|${s}`); e.dataTransfer.effectAllowed = "move"; }}
                        onClick={() => select(active ? null : { date: day.date, index: s })}
                      >
                        <SessionBlockBody session={session} />
                      </button>
                    );
                  })}
                  {can && (
                    <button
                      type="button"
                      className="trn-slot"
                      data-armed={armed ? "true" : undefined}
                      data-cell={`${d},${day.sessions.length}`}
                      onClick={() => {
                        if (armed) place(day, armed);
                        else {
                          addTrainingSession(weekStart, day.date, { type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
                          select({ date: day.date, index: day.sessions.length });
                        }
                      }}
                    >
                      {armed ? `+ ${SESSION_TYPE_LABEL[armed]}` : "+ Lägg till pass"}
                    </button>
                  )}
                  {reason && <small className="trn-slot-reason">{reason}</small>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="trn-sr" role="status">{notice}</p>

      {selectedDay && (
        <div className="trn-inspector" ref={inspectorRef} tabIndex={-1} aria-label="Valt pass">
          {selected && "outcome" in selected ? (
            <>
              <div className="trn-inspector-head">
                <h3>Utfall {DAY_SHORT[week.days.indexOf(selectedDay)].toLowerCase()} {shortDate(selectedDay.date)}</h3>
                <button className="hm-btn hm-btn-sm" onClick={() => setSelected(null)}>Stäng</button>
              </div>
              <TrainingFeedback day={selectedDay} />
            </>
          ) : selectedSession ? (
            <SessionEditor
              key={`${selectedDay.date}-${selectedIndex}`}
              day={selectedDay}
              dayIndex={week.days.indexOf(selectedDay)}
              index={selectedIndex}
              session={selectedSession}
              canMove={(dir) => {
                const to = week.days[week.days.indexOf(selectedDay) + dir];
                return !!to && canAddSession(to, locked(to), !!ownFixture(to.date));
              }}
              onMove={(dir) => move(selectedDay.date, selectedSession, week.days[week.days.indexOf(selectedDay) + dir])}
              onPatch={(patch) => updateTrainingSession(weekStart, selectedDay.date, selectedSession.id, patch)}
              onRemove={() => { removeTrainingSession(weekStart, selectedDay.date, selectedSession.id); setSelected(null); setNotice("Passet är borttaget."); }}
              onClose={() => setSelected(null)}
              eligible={eligibleStaffForSession(staffRoster, selectedSession.type)}
              coachLine={(() => {
                const resolved = resolveResponsibleCoach(staffRoster, selectedSession.type, selectedSession.coachId ?? null);
                const quality = computeStaffTrainingQuality(selectedSession.type, resolved, headCoach);
                return `Ansvarig tränare: ${resolved?.displayName ?? "—"} · Tränarens kvalitet för passet: ${staffQualityLabel(quality).toLowerCase()}`;
              })()}
              editable={isEditable(selectedDay)}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function SessionEditor({
  day, dayIndex, index, session, eligible, coachLine, editable, canMove, onMove, onPatch, onRemove, onClose,
}: {
  day: TrainingDay;
  dayIndex: number;
  index: number;
  session: TrainingSession;
  eligible: readonly { id: string; displayName: string }[];
  coachLine: string;
  editable: boolean;
  canMove: (dir: -1 | 1) => boolean;
  onMove: (dir: -1 | 1) => void;
  onPatch: (patch: Partial<Pick<TrainingSession, "type" | "intensity" | "duration" | "target" | "coachId">>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const label = `${day.date} ${session.id}`;
  return (
    <>
      <div className="trn-inspector-head">
        <h3>{DAY_SHORT[dayIndex]} {shortDate(day.date)} · pass {index + 1}</h3>
        <button className="hm-btn hm-btn-sm" onClick={onClose}>Stäng</button>
      </div>
      <div className="trn-editor">
        <fieldset className="trn-field trn-field-wide">
          <legend>Passtyp</legend>
          <div className="trn-type-grid" role="radiogroup" aria-label={`Pass ${label}`}>
            {TRAINING_SESSION_TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={session.type === t} className="trn-chip" data-tone={sessionCategory(t).tone} disabled={!editable} onClick={() => onPatch({ type: t })}>
                {SESSION_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <Segmented legend="Intensitet" help={INTENSITY_HELP} label={`Intensitet ${label}`} value={session.intensity} options={TRAINING_INTENSITIES.map((v) => [v, INTENSITY_SHORT[v]])} disabled={!editable} onChange={(v) => onPatch({ intensity: v })} />
        <Segmented legend="Passlängd" help={DURATION_HELP} label={`Passlängd ${label}`} value={session.duration} options={TRAINING_DURATIONS.map((v) => [v, DURATION_SHORT[v]])} disabled={!editable} onChange={(v) => onPatch({ duration: v })} />
        <Segmented legend="Målgrupp" label={`Målgrupp ${label}`} value={session.target} options={TRAINING_SESSION_TARGETS.map((v) => [v, TARGET_SHORT[v]])} disabled={!editable} onChange={(v) => onPatch({ target: v })} />
        {eligible.length > 0 && (
          <label className="trn-field">
            <span>Ansvarig tränare</span>
            <select className="hm-select" aria-label={`Ansvarig tränare ${label}`} value={session.coachId ?? ""} disabled={!editable} onChange={(e) => onPatch({ coachId: e.target.value || null })}>
              <option value="">Ingen (auto)</option>
              {eligible.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
            <small>{coachLine}</small>
          </label>
        )}
        <div className="trn-editor-actions">
          <span className="trn-editor-load">Energikostnad per spelare: <b>{signed(sessionTeamLoad(session))}</b></span>
          <button className="hm-btn hm-btn-sm" disabled={!editable || !canMove(-1)} onClick={() => onMove(-1)}>← Flytta en dag</button>
          <button className="hm-btn hm-btn-sm" disabled={!editable || !canMove(1)} onClick={() => onMove(1)}>Flytta en dag →</button>
          <button className="hm-btn hm-btn-sm" disabled={!editable} onClick={onRemove}>Ta bort pass</button>
        </div>
        {editable && (!canMove(-1) || !canMove(1)) && <small className="trn-slot-reason">Flytt kräver en träningsdag med ledig plats (högst två pass, ingen match-, vilo- eller resdag).</small>}
      </div>
    </>
  );
}

export function Segmented<T extends string>({ legend, label, help, value, options, disabled, onChange }: { legend: string; label: string; help?: string; value: T; options: [T, string][]; disabled?: boolean; onChange: (v: T) => void }) {
  return (
    <fieldset className="trn-field" title={help}>
      <legend>{legend}</legend>
      <div className="trn-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function addDaysLocal(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
