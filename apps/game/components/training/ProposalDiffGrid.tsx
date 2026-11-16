"use client";
// Arena Nights TRN-01a (A: diff overlay on grid): the assistant's pending
// proposal drawn over the live week -- added, changed and removed session
// blocks, day-type changes, and per-day / per-block "keep mine". Every
// edit goes through the existing editAssistantTrainingPlan draft path
// (the proposal is edited, the live schedule is untouched until the
// existing approveProposal runs).
import { useMemo, useRef, useState } from "react";
import { editAssistantTrainingPlan, buildAssistantTrainingPlan } from "@/lib/training/assistantTraining";
import { updateTrainingSession } from "@/lib/training/trainingSchedule";
import { DAY_TYPE_LABEL, SESSION_TYPE_LABEL } from "@/lib/training/labels";
import { TRAINING_INTENSITIES, TRAINING_SESSION_TYPES, type TrainingIntensity, type TrainingSessionType, type TrainingWeek } from "@/lib/training/types";
import { daysEqual, diffTrainingWeeks, isTrainingDayLocked, restoreProposalDay, revertProposalDay, revertProposalSlot, trainingDayOutcome, type DayDiff, type SlotDiff } from "@/lib/training/weekPlanView";
import { resolveResponsibleCoach } from "@/lib/staff/roleSuitability";
import type { AssistantTraining } from "@/components/manager/AssistantTrainingPanel";
import { blockData, DayHead, DAY_SHORT, DURATION_SHORT, INTENSITY_SHORT, LoadBar, SessionBlockBody, shortDate, signed, TARGET_SHORT } from "./weekParts";

const intensities: Record<TrainingIntensity, string> = { LOW: "Låg", NORMAL: "Normal", HIGH: "Hög", VERY_HIGH: "Mycket hög" };
const PREP_REASON = "Matchförberedelsen dagen före match är låst av matchdagsregeln.";

export function proposalDiff(ctx: AssistantTraining, liveWeek: TrainingWeek): DayDiff[] | null {
  const { career, plan } = ctx;
  const roster = career.staffRoster[career.playerClubId] ?? [];
  if (!plan) return null;
  return diffTrainingWeeks(liveWeek, plan.week, (d) => isTrainingDayLocked(d, career.processedThroughDate, career.gameDate), (s) => resolveResponsibleCoach(roster, s.type, s.coachId ?? null)?.id ?? null);
}

export default function ProposalDiffGrid({ ctx, liveWeek, diff, editing }: { ctx: AssistantTraining; liveWeek: TrainingWeek; diff: DayDiff[]; editing: boolean }) {
  const { career, proposal, plan, run } = ctx;
  const [selected, setSelected] = useState<{ date: string; index: number } | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const template = plan?.template;
  const generatedOn = plan?.generatedOn;
  // The assistant's own draft for this goal, to offer "ta assistentens dag" after a day was kept/edited.
  const assistantWeek = useMemo(() => {
    if (!template) return null;
    try { return buildAssistantTrainingPlan(career, generatedOn ?? career.gameDate, template).week; } catch { return null; }
  }, [career, template, generatedOn]);
  if (!proposal || !plan) return null;

  const ownFixture = (date: string) => career.fixtures.find((f) => f.date === date && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId));
  const proposedDay = (date: string) => plan.week.days.find((d) => d.date === date)!;
  const isPrep = (date: string) => proposedDay(date).sessions.some((s) => s.type === "MATCH_PREPARATION");
  const editWeek = (fn: (week: TrainingWeek) => TrainingWeek, text: string) => run((s) => editAssistantTrainingPlan(s, proposal.id, (p) => ({ ...p, week: fn(p.week) })), text);

  const sel = selected ? diff.find((d) => d.date === selected.date) : undefined;
  const selSlot: SlotDiff | undefined = sel?.slots.find((s) => s.index === selected!.index);
  const changedCount = diff.filter((d) => d.changed).length;

  return (
    <section className="hm-panel trn-planner" aria-labelledby="trn-diff-title" data-mode="diff">
      <div className="trn-planner-head">
        <h2 id="trn-diff-title" className="hm-panel-title">Veckoschema – förslag</h2>
        <ul className="trn-legend" aria-label="Teckenförklaring">
          <li data-diff="added">Nytt</li>
          <li data-diff="changed">Ändras</li>
          <li data-diff="removed">Tas bort</li>
          <li data-diff="same">Oförändrat</li>
        </ul>
      </div>
      <p className="trn-hint">
        {plan.teamApplied
          ? "Assistenten har redan lagt veckans schema (delegerat). Kvar att besluta är de individuella råden."
          : changedCount === 0
            ? "Förslaget ändrar inga pass jämfört med ditt schema."
            : `${changedCount} ${changedCount === 1 ? "dag ändras" : "dagar ändras"}. Godkänn allt, behåll din egen plan för enskilda dagar eller tryck på ett markerat pass för att se före och efter.`}
      </p>

      <div className="trn-week-scroll">
        <div className="trn-week" data-mode="diff">
          {diff.map((day, d) => {
            const fixture = ownFixture(day.date);
            const live = liveWeek.days[d];
            const draft = proposedDay(day.date);
            const prep = isPrep(day.date);
            const assistantDay = assistantWeek?.days.find((x) => x.date === day.date);
            const canRestore = !day.locked && !plan.teamApplied && !!assistantDay && !daysEqual(assistantDay, draft);
            const outcome = day.locked ? trainingDayOutcome(live) : null;
            return (
              <div key={day.date} className="trn-day" data-matchday={!!fixture || undefined} data-today={day.date === career.gameDate || undefined} data-locked={day.locked || undefined} data-changed={day.changed || undefined}>
                <DayHead index={d} date={day.date} today={day.date === career.gameDate} />
                <div className="trn-daytype-diff">
                  {fixture ? <span className="trn-pill">Match</span> : day.dayTypeBefore !== day.dayTypeAfter ? (
                    <><s>{DAY_TYPE_LABEL[day.dayTypeBefore]}</s> <span aria-hidden="true">→</span> <b>{DAY_TYPE_LABEL[day.dayTypeAfter]}</b></>
                  ) : <span>{DAY_TYPE_LABEL[day.dayTypeAfter]}</span>}
                </div>
                {!fixture && <LoadBar day={day.locked ? live : draft} />}
                {day.locked ? (
                  <p className="trn-outcome" data-static>
                    <span>Genomförd</span>
                    {outcome && outcome.attendance > 0 ? <><strong>{signed(outcome.averageDelta ?? 0)} <small>energi i snitt</small></strong><small>{outcome.attendance} deltog</small></> : <small>Låst</small>}
                  </p>
                ) : null}
                <div className="trn-slots">
                  {day.slots.map((slot) => {
                    const session = slot.after ?? slot.before!;
                    const active = selected?.date === day.date && selected.index === slot.index;
                    return (
                      <button
                        key={slot.index}
                        type="button"
                        className="trn-block"
                        {...blockData(session)}
                        data-diff={slot.kind}
                        aria-pressed={active}
                        disabled={day.locked}
                        aria-label={`${slot.kind === "added" ? "Nytt pass" : slot.kind === "removed" ? "Tas bort" : slot.kind === "changed" ? "Ändras" : "Oförändrat"}: ${SESSION_TYPE_LABEL[session.type]}, ${INTENSITY_SHORT[session.intensity].toLowerCase()} intensitet – ${shortDate(day.date)}`}
                        onClick={() => { setSelected(active ? null : { date: day.date, index: slot.index }); requestAnimationFrame(() => inspectorRef.current?.focus()); }}
                      >
                        <SessionBlockBody session={session} diff={slot.kind} changes={slot.changes} before={slot.before} />
                      </button>
                    );
                  })}
                  {day.slots.length === 0 && !day.locked && <small className="trn-slot-reason">{day.dayTypeAfter === "REST" ? "Vila" : day.dayTypeAfter === "MATCH" ? "Matchdag" : "Inga pass"}</small>}
                </div>
                {!day.locked && !plan.teamApplied && (
                  <div className="trn-day-accept">
                    {day.changed ? (
                      <>
                        <span className="trn-day-state" data-state="proposal">Förslaget</span>
                        <button className="hm-btn hm-btn-sm" disabled={prep} onClick={() => editWeek((w) => revertProposalDay(w, liveWeek, day.date), `Ditt schema behålls ${DAY_SHORT[d].toLowerCase()} ${shortDate(day.date)}.`)}>
                          Behåll mitt schema
                        </button>
                        {prep && <small className="trn-slot-reason">{PREP_REASON}</small>}
                      </>
                    ) : canRestore ? (
                      <>
                        <span className="trn-day-state" data-state="mine">Ditt schema</span>
                        <button className="hm-btn hm-btn-sm" onClick={() => editWeek((w) => restoreProposalDay(w, assistantWeek!, day.date), `Assistentens förslag används ${DAY_SHORT[d].toLowerCase()} ${shortDate(day.date)}.`)}>
                          Ta assistentens dag
                        </button>
                      </>
                    ) : (
                      <span className="trn-day-state">Oförändrad</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {sel && selSlot && (
        <div className="trn-inspector" ref={inspectorRef} tabIndex={-1} aria-label="Valt pass i förslaget">
          <div className="trn-inspector-head">
            <h3>{DAY_SHORT[diff.indexOf(sel)]} {shortDate(sel.date)} · pass {selSlot.index + 1}</h3>
            <button className="hm-btn hm-btn-sm" onClick={() => setSelected(null)}>Stäng</button>
          </div>
          <dl className="trn-compare">
            <div><dt>Ditt schema</dt><dd>{selSlot.before ? describe(selSlot.before) : "Inget pass"}</dd></div>
            <div><dt>Förslaget</dt><dd>{selSlot.after ? describe(selSlot.after) : "Passet tas bort"}</dd></div>
          </dl>
          {selSlot.changes.length > 0 && <p className="trn-hint">Skillnad: {selSlot.changes.join(", ").toLowerCase()}.</p>}
          <div className="trn-editor-actions">
            {selSlot.kind !== "same" && !plan.teamApplied && (
              <button className="hm-btn hm-btn-sm" disabled={isPrep(sel.date)} onClick={() => { editWeek((w) => revertProposalSlot(w, liveWeek, sel.date, selSlot.index), "Ditt pass behålls i förslaget."); setSelected(null); }}>
                Behåll mitt pass
              </button>
            )}
            {isPrep(sel.date) && <small className="trn-slot-reason">{PREP_REASON}</small>}
          </div>
          {editing && selSlot.after && (() => {
            const session = selSlot.after;
            const locked = sel.locked || isPrep(sel.date);
            return (
              <div className="trn-editor">
                <label className="trn-field">
                  <span>Passtyp i förslaget</span>
                  <select className="hm-select" aria-label={`Föreslaget pass ${session.id}`} value={session.type} disabled={locked} onChange={(e) => run((s) => editAssistantTrainingPlan(s, proposal.id, (p) => ({ ...p, week: updateTrainingSession(p.week, sel.date, session.id, { type: e.target.value as TrainingSessionType }) })), "Passförslag ändrat.")}>
                    {TRAINING_SESSION_TYPES.map((t) => <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>)}
                  </select>
                </label>
                <label className="trn-field">
                  <span>Intensitet i förslaget</span>
                  <select className="hm-select" aria-label={`Föreslagen intensitet ${session.id}`} value={session.intensity} disabled={locked} onChange={(e) => run((s) => editAssistantTrainingPlan(s, proposal.id, (p) => ({ ...p, week: updateTrainingSession(p.week, sel.date, session.id, { intensity: e.target.value as TrainingIntensity }) })), "Intensitetsförslag ändrat.")}>
                    {TRAINING_INTENSITIES.map((t) => <option key={t} value={t}>{intensities[t]}</option>)}
                  </select>
                </label>
              </div>
            );
          })()}
          {!editing && selSlot.after && !sel.locked && <p className="trn-hint">Välj Justera i assistentens rad för att ändra passtyp eller intensitet i förslaget.</p>}
        </div>
      )}
    </section>
  );
}

function describe(s: { type: TrainingSessionType; intensity: TrainingIntensity; duration: keyof typeof DURATION_SHORT; target: keyof typeof TARGET_SHORT }) {
  return `${SESSION_TYPE_LABEL[s.type]} · ${INTENSITY_SHORT[s.intensity]} intensitet · ${DURATION_SHORT[s.duration]} längd · ${TARGET_SHORT[s.target]}`;
}
