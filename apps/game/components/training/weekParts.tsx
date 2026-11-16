"use client";
// Arena Nights TRN-01b: shared presentational parts for the week block
// planner and the assistant proposal diff grid. Pure rendering; every
// action lives in the caller.
import type { ReactNode } from "react";
import { SESSION_TYPE_LABEL } from "@/lib/training/labels";
import type { PlayerTrainingLoadSetting, TrainingDuration, TrainingIntensity, TrainingSession, TrainingSessionTarget } from "@/lib/training/types";
import { dayLoad, sessionCategory, sessionTeamLoad, type SlotDiffKind } from "@/lib/training/weekPlanView";
import type { TrainingDay } from "@/lib/training/types";

export const DAY_SHORT = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];
export const INTENSITY_SHORT: Record<TrainingIntensity, string> = { LOW: "Låg", NORMAL: "Normal", HIGH: "Hög", VERY_HIGH: "Max" };
export const DURATION_SHORT: Record<TrainingDuration, string> = { SHORT: "Kort", NORMAL: "Normal", LONG: "Lång" };
export const TARGET_SHORT: Record<TrainingSessionTarget, string> = { ALL: "Alla", OUTCOURT: "Utespelare", GOALKEEPERS: "Målvakter", SELECTED_PLAYERS: "Utvalda" };
export const LOAD_SETTING_LABEL: Record<PlayerTrainingLoadSetting, string> = { FULL: "Full", REDUCED: "Reducerad", RECOVERY_ONLY: "Endast återhämtning", REST: "Vila" };
export const INTENSITY_HELP = "Intensitet: hur hårt passet körs. Högre intensitet ger mer utvecklingsstimulans men kostar mer energi (×0,6 låg – ×1,8 mycket hög) och ökar skaderisken.";
export const DURATION_HELP = "Passlängd: hur långt passet är. Längre pass ger mer stimulans och kostar mer energi (×0,7 kort – ×1,3 lång).";

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""}`;
}

export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits).replace(".", ",");
  return n > 0 ? `+${v}` : n < 0 ? v.replace("-", "−") : v;
}

/** Visual session block: type colour, intensity height, duration width. */
export function SessionBlockBody({ session, diff, changes, before }: { session: TrainingSession; diff?: SlotDiffKind; changes?: string[]; before?: TrainingSession }) {
  const cat = sessionCategory(session.type);
  const load = sessionTeamLoad(session);
  return (
    <>
      <span className="trn-block-type">{SESSION_TYPE_LABEL[session.type]}</span>
      <span className="trn-block-meta">
        {INTENSITY_SHORT[session.intensity]} · {DURATION_SHORT[session.duration]}
        {session.target !== "ALL" ? ` · ${TARGET_SHORT[session.target]}` : ""}
      </span>
      <span className="trn-block-load" title={load < 0 ? "Energikostnad per spelare med full belastning" : "Energi tillbaka per spelare"}>
        {signed(load)} <span className="trn-sr">energi</span>
      </span>
      {diff === "added" && <span className="trn-block-tag">Nytt pass</span>}
      {diff === "removed" && <span className="trn-block-tag">Tas bort</span>}
      {diff === "changed" && before && (
        <span className="trn-block-tag">
          {changes?.includes("Passtyp") ? `Var: ${SESSION_TYPE_LABEL[before.type]}` : `Ändras: ${changes?.join(", ").toLowerCase()}`}
        </span>
      )}
      <span className="trn-sr">{cat.label}</span>
    </>
  );
}

export function blockData(session: TrainingSession) {
  return { "data-tone": sessionCategory(session.type).tone, "data-intensity": session.intensity, "data-duration": session.duration } as const;
}

export function LoadBar({ day }: { day: Pick<TrainingDay, "dayType" | "sessions"> }) {
  const load = dayLoad(day);
  const label = load.cost > 0 ? `Belastning ${signed(-load.cost)}` : load.gain > 0 ? `Återhämtning ${signed(load.gain)}` : day.dayType === "REST" ? "Vila" : "Ingen belastning";
  return (
    <div className="trn-loadbar" data-band={load.band} title="Dagens energikostnad per spelare med full belastning (passtyp × intensitet × längd)">
      <span className="trn-loadbar-track" aria-hidden="true">
        <i style={{ width: `${load.percent}%` }} />
      </span>
      <small>{label}</small>
    </div>
  );
}

export function DayHead({ index, date, today, children }: { index: number; date: string; today: boolean; children?: ReactNode }) {
  return (
    <div className="trn-day-head">
      <span className="trn-day-name">{DAY_SHORT[index]}</span>
      <strong>{Number(date.slice(8, 10))}</strong>
      <small>{shortDate(date).split(" ")[1]}</small>
      {today && <em className="trn-day-today">Idag</em>}
      {children}
    </div>
  );
}

export function AssistantFace({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span className="trn-face" aria-hidden="true">{initials || "?"}</span>;
}
