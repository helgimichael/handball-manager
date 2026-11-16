"use client";
// Arena Nights TRN-01c (A: shared readiness strip + inline settings). One
// readiness language with the squad view (readiness, matchform, Belastning
// 7 d, trend, återhämtning) plus the projected matchday value, a segmented
// load setting with visible medical constraints, a focus chip and bulk
// "set load" for selected players. Uses the existing load/focus actions.
import { useMemo, useState } from "react";
import { useCareer } from "@/lib/career/CareerContext";
import { PlayerCell } from "@/components/game/Identity";
import { REHAB_PHASE_LABELS } from "@/lib/medical/labels";
import { INDIVIDUAL_DEVELOPMENT_FOCUSES, type IndividualDevelopmentFocus } from "@/lib/development/types";
import { PLAYER_TRAINING_LOAD_SETTINGS, type PlayerTrainingLoadSetting } from "@/lib/training/types";
import { RECOVERY_OUTLOOK_LABEL, WORKLOAD_TREND_LABEL } from "@/lib/training/readinessSummary";
import { buildReadinessRows, planBulkLoad } from "@/lib/training/readinessStrip";
import type { ReadinessProjection } from "@/lib/training/readinessProjection";
import { LOAD_SETTING_LABEL } from "./weekParts";

export const FOCUS_LABEL: Record<IndividualDevelopmentFocus, string> = {
  NORMAL: "Allsidig utveckling",
  TECHNICAL: "Teknik",
  ATTACKING_DECISIONS: "Anfallsspel",
  DEFENCE: "Försvarsspel",
  PHYSICAL: "Fysik",
  MENTAL: "Mentalt",
  GOALKEEPER: "Målvaktsspel",
};

export default function PlayerReadinessStrip({ projection, targetLabel }: { projection: ReadinessProjection | null; targetLabel: string }) {
  const { career, setPlayerTrainingLoad, setPlayerIndividualFocus } = useCareer();
  const rows = useMemo(() => buildReadinessRows(career, projection), [career, projection]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const names = new Map(rows.map((r) => [r.player.id, `${r.player.firstName} ${r.player.lastName}`]));

  const bulk = (setting: PlayerTrainingLoadSetting) => {
    const plan = planBulkLoad(rows, [...picked], setting);
    plan.apply.forEach((id) => setPlayerTrainingLoad(id, setting));
    setNotice(
      `${LOAD_SETTING_LABEL[setting]} satt för ${plan.apply.length} spelare.` +
        (plan.skipped.length ? ` Hoppade över: ${plan.skipped.map((s) => `${names.get(s.playerId)} (${s.reason.replace(/\.$/, "").toLowerCase()})`).join(", ")}.` : ""),
    );
    setPicked(new Set());
  };
  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allPicked = picked.size > 0 && picked.size === rows.length;

  return (
    <section className="hm-panel trn-readiness" id="trn-readiness" aria-labelledby="trn-readiness-title">
      <div className="trn-planner-head">
        <h2 id="trn-readiness-title" className="hm-panel-title">Spelarberedskap</h2>
        <span className="trn-hint">Sorterat efter risk: lägst prognos och medicinska begränsningar först.</span>
      </div>
      <p className="trn-hint">
        Beredskap = energi idag. Belastning 7 d = arbetspoäng från match och träning de senaste sju dagarna – samma mått som i truppen. Prognos = beräknad beredskap {targetLabel}.
      </p>

      <div className="trn-bulk" role="group" aria-label="Sätt belastning för markerade spelare" data-active={picked.size > 0 || undefined}>
        <label className="trn-bulk-all">
          <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.player.id)))} aria-label="Markera alla spelare" />
          <span>{picked.size ? `${picked.size} markerade` : "Markera spelare för att ändra flera samtidigt"}</span>
        </label>
        {PLAYER_TRAINING_LOAD_SETTINGS.map((l) => (
          <button key={l} type="button" className="hm-btn hm-btn-sm" disabled={picked.size === 0} onClick={() => bulk(l)}>{LOAD_SETTING_LABEL[l]}</button>
        ))}
      </div>
      {notice && <p className="trn-message" role="status">{notice}</p>}

      <div className="trn-rs" role="table" aria-label="Spelarberedskap">
        <div className="trn-rs-head" role="row">
          <span role="columnheader"><span className="trn-sr">Markera</span></span>
          <span role="columnheader">Spelare</span>
          <span role="columnheader">Beredskap</span>
          <span role="columnheader" title="Hur stor del av passen spelaren deltar i. Påverkar energi och utveckling.">Belastning (deltagande)</span>
          <span role="columnheader" title="Vilka egenskaper spelarens utvecklingsstimulans riktas mot. Påverkar inte energin.">Utvecklingsfokus</span>
        </div>
        {rows.map((r) => {
          const name = `${r.player.firstName} ${r.player.lastName}`;
          const activeInjury = career.playerInjuries[r.player.id]?.activeInjury;
          return (
            <div key={r.player.id} className="trn-rs-row" role="row" data-picked={picked.has(r.player.id) || undefined}>
              <span role="cell" className="trn-rs-pick"><input type="checkbox" aria-label={`Markera ${name}`} checked={picked.has(r.player.id)} onChange={() => toggle(r.player.id)} /></span>
              <span role="cell" className="trn-rs-player">
                <PlayerCell player={r.player} />
                {r.onPlacement ? <span className="hm-badge hm-badge-neutral">Placerad hos partnerklubb</span>
                  : r.availability === "UNAVAILABLE" && activeInjury ? <span className="hm-badge hm-badge-negative">Skadad – {REHAB_PHASE_LABELS[activeInjury.currentPhase]}</span>
                  : r.availability === "LIMITED" ? <span className="hm-badge hm-badge-warning">Återgång – reducerad</span> : null}
              </span>
              <span role="cell" className="trn-strip" aria-label={`${name}: beredskap ${r.readiness} %, matchform ${r.matchFitness} %, belastning 7 d ${r.load7 ?? "saknas"}, återhämtning ${RECOVERY_OUTLOOK_LABEL[r.outlook].toLowerCase()}, prognos ${r.projected ?? "saknas"} %`}>
                <span className="trn-cell" data-tone={r.readinessTone}><small>Beredskap</small><b className="trn-num">{r.readiness}%</b></span>
                <span className="trn-cell" data-tone={r.matchFitnessTone}><small>Matchform</small><b className="trn-num">{r.matchFitness}%</b></span>
                <span className="trn-cell" data-tone={r.trendTone}><small>Belastning 7 d</small><b className="trn-num">{r.load7 ?? "—"}</b>{r.trend && <em>{WORKLOAD_TREND_LABEL[r.trend]}</em>}</span>
                <span className="trn-cell" data-tone={r.outlookTone}><small>Återhämtning</small><b>{RECOVERY_OUTLOOK_LABEL[r.outlook]}</b></span>
                <span className="trn-cell" data-tone={r.projectedTone} data-key><small>Prognos</small><b className="trn-num">{r.projected === null ? "—" : `${r.projected}%`}</b></span>
              </span>
              <span role="cell" className="trn-rs-load">
                <span className="trn-seg" role="radiogroup" aria-label={`Träningsbelastning ${name}`}>
                  {PLAYER_TRAINING_LOAD_SETTINGS.map((l) => {
                    const allowed = r.availability !== "UNAVAILABLE" && r.allowedSettings.includes(l);
                    return (
                      <button key={l} type="button" role="radio" aria-label={LOAD_SETTING_LABEL[l]} aria-checked={r.loadSetting === l} disabled={!allowed} onClick={() => r.loadSetting !== l && setPlayerTrainingLoad(r.player.id, l)}>
                        {l === "RECOVERY_ONLY" ? "Återh." : LOAD_SETTING_LABEL[l]}
                      </button>
                    );
                  })}
                </span>
                {r.constraint && <small className="trn-slot-reason">{r.constraint}</small>}
              </span>
              <span role="cell" className="trn-rs-focus">
                <select className="hm-select trn-focus-chip" data-active={r.focus !== "NORMAL" || undefined} aria-label={`Individuellt fokus ${name}`} value={r.focus} onChange={(e) => setPlayerIndividualFocus(r.player.id, e.target.value === "NORMAL" ? null : e.target.value)}>
                  {INDIVIDUAL_DEVELOPMENT_FOCUSES.map((f) => <option key={f} value={f}>{FOCUS_LABEL[f]}</option>)}
                </select>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
