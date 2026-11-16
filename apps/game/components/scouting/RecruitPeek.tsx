"use client";
// Arena Nights 231 -- REC-02a A "Recruitment Peek drawer" (also the REC-01 C report view). Only what decides a
// recruitment: identity, knowledge-gated star ranges with the report's confidence, the scout's verdict line,
// value range and contract, priority + note, then sticky actions (Scouta, Kortlista, Förhandla). Everything
// else lives on the full profile ("Hela profilen"). 480 px slide-over on desktop, full-screen sheet on phones.
import Link from "next/link";
import { useEffect, useState } from "react";
import { StarBand } from "@/components/recruitment/PipelineBoard";
import { PlayerGlyph } from "@/components/game/Identity";
import { KnowledgeMeter } from "@/components/game/RecruitmentPresentation";
import { ClubLink } from "@/components/entityLinks";
import { ScoutaSheet } from "@/components/scouting/ScoutaSheet";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { RECRUITMENT_PRIORITIES, RECRUITMENT_PRIORITY_LABEL_SV, RECRUITMENT_STATUS_LABEL_SV, type RecruitmentCandidate } from "@/lib/career/recruitment";
import { computeAssignmentProgressPct, getClubScouts } from "@/lib/career/scouting";
import { formatMoney } from "@/lib/economy/currency";
import { CONTRACT_STATUS_LABEL } from "@/lib/economy/labels";
import { positionLabel } from "@/lib/game-data";
import { useMoney } from "@/lib/settings/usePreferences";

export function RecruitPeek({ candidate: c, onClose, kicker }: { candidate: RecruitmentCandidate; onClose: () => void; kicker?: string }) {
  useMoney();
  const { career, addToShortlist, removeFromShortlist, setRecruitmentPriority, setRecruitmentNote } = useCareer();
  const [note, setNote] = useState(c.note);
  const [scouting, setScouting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !scouting) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, scouting]);
  const player = getCareerPlayer(career, c.playerId);
  const own = player?.clubId === career.playerClubId;
  const scouts = getClubScouts(career);
  const active = Object.values(career.scoutingAssignments).find((a) => a.targetPlayerId === c.playerId && a.status === "IN_PROGRESS");
  const value = c.scoutReportView?.marketValueRange;
  const scoutaReason = own ? "Din egen spelare är redan fullt känd." : scouts.length === 0 ? "Klubben har ingen scout." : active ? `Scoutas redan · rapport ${active.endDate}.` : null;

  return (
    <>
      <button type="button" className="rk-scrim" aria-label="Stäng spelarkortet" tabIndex={-1} onClick={onClose} />
      <aside className="rk-peek" aria-label={`Spelarkort: ${c.firstName} ${c.lastName}`}>
        <header className="rk-head">
          {player ? <PlayerGlyph player={player} size={48} /> : <span />}
          <div>
            <small>{kicker ?? RECRUITMENT_STATUS_LABEL_SV[c.recruitmentStatus]}</small>
            <h3>{c.firstName} {c.lastName}</h3>
            <span className="rk-muted">{positionLabel(c.position)} · {c.ageYears ?? "–"} år · {c.clubId ? <ClubLink clubId={c.clubId}>{c.clubName}</ClubLink> : c.clubName}</span>
          </div>
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose}>Stäng</button>
        </header>

        <div className="rk-body">
          <section className="rk-sec" aria-label="Bedömning">
            <div className="rk-ranges">
              <div><small>Förmåga</small><StarBand range={c.visibility?.abilityRange ?? null} label="Förmåga" /></div>
              <div><small>Potential</small><StarBand range={c.visibility?.potentialRange ?? null} label="Potential" /></div>
              <div><small>Säkerhet</small><b className="rk-num">{c.scoutReportView ? `${c.scoutReportView.confidencePct} %` : "—"}</b></div>
            </div>
            <KnowledgeMeter pct={c.knowledgePct} />
            <p className="rk-verdict">{c.hasCompletedReport && c.scoutReportView ? c.scoutReportView.recommendation : c.discoveryReasons.length ? c.discoveryReasons.join(" ") : "Ingen rapport ännu. Scouta för att smalna av spannen."}</p>
            {c.scoutDisplayName && <small className="rk-muted">{c.hasCompletedReport ? "Rapport" : "Upptäckt"} av {c.scoutDisplayName}</small>}
            {(c.visibility?.strengths?.length || c.visibility?.weaknesses?.length) ? (
              <dl className="rk-sw">
                {c.visibility?.strengths?.length ? <div><dt>Styrkor</dt><dd>{c.visibility.strengths.slice(0, 3).join(", ")}</dd></div> : null}
                {c.visibility?.weaknesses?.length ? <div><dt>Svagheter</dt><dd>{c.visibility.weaknesses.slice(0, 3).join(", ")}</dd></div> : null}
              </dl>
            ) : null}
            {active && <p className="rk-muted">Scouten är på plats: {computeAssignmentProgressPct(active, career.gameDate)} % klart, rapport {active.endDate}.</p>}
          </section>

          <section className="rk-sec" aria-label="Avtal och värde">
            <dl className="rk-facts">
              <div><dt>Värde</dt><dd className="rk-num">{value ? (value.min === value.max ? formatMoney(value.min) : `${formatMoney(value.min)} – ${formatMoney(value.max)}`) : "—"}</dd></div>
              <div><dt>Kontrakt</dt><dd>{c.contractEndDate ? `${c.contractStatus ? CONTRACT_STATUS_LABEL[c.contractStatus] + " · " : ""}t.o.m. ${c.contractEndDate}` : "Kontraktslös"}</dd></div>
              <div><dt>Lön</dt><dd className="rk-num">{c.wageEurPerMonth !== null ? `${formatMoney(c.wageEurPerMonth)}/mån` : "—"}</dd></div>
              <div><dt>Transfer</dt><dd>{c.transferStatusLabel}</dd></div>
            </dl>
          </section>

          {!own && (
            <section className="rk-sec" aria-label="Prioritet och anteckning">
              <div className="rk-prio" role="radiogroup" aria-label="Prioritet">
                {RECRUITMENT_PRIORITIES.map((p) => <button key={p} type="button" role="radio" aria-checked={c.priority === p} onClick={() => setRecruitmentPriority(c.playerId, p)}>{RECRUITMENT_PRIORITY_LABEL_SV[p]}</button>)}
              </div>
              <label className="rk-note">Anteckning<textarea className="hm-input" rows={2} value={note} placeholder="Vad vill du komma ihåg?" onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== c.note) { setRecruitmentNote(c.playerId, note); setStatus("Anteckningen är sparad."); } }} /></label>
            </section>
          )}
          {status && <p className="rk-muted" role="status">{status}</p>}
        </div>

        <footer className="rk-actions">
          {own ? (
            <Link className="hm-btn hm-btn-primary rk-wide" href={`/career/squad/${encodeURIComponent(c.playerId)}`}>Öppna spelarprofilen →</Link>
          ) : (
            <Link className="hm-btn hm-btn-primary rk-wide" href={`/career/transfers/${encodeURIComponent(c.playerId)}`}>Förhandla →</Link>
          )}
          {!own && <button type="button" className="hm-btn" aria-pressed={c.shortlisted} onClick={() => { if (c.shortlisted) removeFromShortlist(c.playerId); else addToShortlist(c.playerId); }}>{c.shortlisted ? "Ta bort från Kortlista" : "Lägg på Kortlista"}</button>}
          {!own && (scoutaReason ? <div className="rk-blocked"><button type="button" className="hm-btn" disabled>{c.hasCompletedReport ? "Scouta igen" : "Scouta"}</button><span>{scoutaReason}</span></div> : <button type="button" className="hm-btn" onClick={() => setScouting(true)}>{c.hasCompletedReport ? "Scouta igen" : "Scouta"}</button>)}
          <Link className="hm-btn" href={`/career/compare?left=${encodeURIComponent(c.playerId)}`}>Jämför med truppen</Link>
          <Link className="hm-btn rk-wide" href={`/career/squad/${encodeURIComponent(c.playerId)}`}>Hela profilen →</Link>
        </footer>
      </aside>
      {scouting && <ScoutaSheet playerId={c.playerId} clubId={c.clubId} onClose={() => setScouting(false)} onStarted={setStatus} />}
    </>
  );
}
