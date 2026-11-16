"use client";
// Arena Nights 231 -- REC-01c B: the "Scouta" action sheet. Reached from any player mention on the scouting
// desk and the recruitment Peek: who the player is and how well we know him, then a scout picker with each
// scout's 1-20 judgement, queue and what this assignment would give (days and expected Kännedom after the
// report -- the real assignment and report rules, run on a copy). One click starts; errors stay next to the
// picker. Popover on desktop, bottom sheet on phones.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayerGlyph } from "@/components/game/Identity";
import { KnowledgeMeter } from "@/components/game/RecruitmentPresentation";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getClub, positionLabel } from "@/lib/game-data";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { previewPlayerAssignment, scoutCapacity } from "@/lib/scouting/scoutDesk";

export function ScoutaSheet({ playerId, clubId, onClose, onStarted }: { playerId: string; clubId: string; onClose: () => void; onStarted?: (message: string) => void }) {
  const { career, createScoutingAssignment } = useCareer();
  const player = getCareerPlayer(career, playerId);
  const scouts = useMemo(() => scoutCapacity(career), [career]);
  const previews = useMemo(() => new Map(scouts.map((s) => [s.id, previewPlayerAssignment(career, s.id, playerId, clubId)])), [career, scouts, playerId, clubId]);
  const firstOk = scouts.find((s) => previews.get(s.id)?.ok)?.id ?? scouts[0]?.id ?? "";
  const [scoutId, setScoutId] = useState(firstOk);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!player) return null;
  const knowledge = getPlayerKnowledgePct(career, playerId, clubId);
  const chosen = previews.get(scoutId);

  function start() {
    setError(null);
    const result = createScoutingAssignment(scoutId, playerId, clubId);
    if (!result.ok) { setError(result.errors.join(" ")); return; }
    const name = scouts.find((s) => s.id === scoutId)?.name ?? "Scouten";
    onStarted?.(`${name} scoutar ${player!.firstName} ${player!.lastName}. Rapporten kommer ${result.assignment?.endDate ?? ""}.`);
    onClose();
  }

  return (
    <>
      <button type="button" className="sd-scrim" aria-label="Stäng" tabIndex={-1} onClick={onClose} />
      <section className="sd-sheet" role="dialog" aria-modal="true" aria-labelledby="sd-sheet-title">
        <header className="sd-sheet-head">
          <PlayerGlyph player={player} size={40} />
          <div>
            <small>{positionLabel(player.position)} · {getClub(clubId)?.shortName ?? "Fri agent"}</small>
            <h3 id="sd-sheet-title">Scouta {player.firstName} {player.lastName}</h3>
          </div>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose}>Stäng</button>
        </header>
        <div className="sd-sheet-fog"><span>Kännedom i dag</span><KnowledgeMeter pct={knowledge} /></div>
        {scouts.length === 0 ? (
          <div className="sd-empty"><p>Klubben har ingen scout. Ett uppdrag kräver en anställd scout.</p><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/staff/recruitment?role=SCOUT">Rekrytera en scout →</Link></div>
        ) : (
          <fieldset className="sd-pick">
            <legend>Välj scout</legend>
            {scouts.map((s) => {
              const p = previews.get(s.id);
              return (
                <label key={s.id} data-selected={scoutId === s.id}>
                  <input type="radio" name="sd-scout" value={s.id} checked={scoutId === s.id} onChange={() => { setScoutId(s.id); setError(null); }} />
                  <span className="sd-pick-name"><b>{s.name}</b><small>Bedömning <span className="sd-num">{s.suitability.toFixed(1)}</span>/20 · {s.active === 0 ? "ledig" : `${s.active} i kö`}</small></span>
                  <span className="sd-pick-out">{p?.ok ? <><b className="sd-num">{p.days} d</b><small>→ <span className="sd-num">{p.knowledgeAfter}</span> % kännedom</small></> : <small className="sd-err-inline">{p?.errors.join(" ")}</small>}</span>
                </label>
              );
            })}
          </fieldset>
        )}
        {error && <p className="sd-error" role="alert">{error}</p>}
        <footer className="sd-sheet-foot">
          {chosen?.ok && <p className="sd-num">Rapport {chosen.endDate} · kännedom {chosen.knowledgeNow} % → {chosen.knowledgeAfter} %</p>}
          <button type="button" className="hm-btn hm-btn-primary" disabled={!scoutId || !chosen?.ok} onClick={start}>Starta bevakning</button>
          {chosen && !chosen.ok && <span className="sd-err-inline">{chosen.errors.join(" ")}</span>}
        </footer>
      </section>
    </>
  );
}
