"use client";
// Arena Nights MGR-03b A "Gala Sequence": once the season is complete the
// awards are revealed one by one in a floodlight overlay (skippable), your
// club's winners highlighted, ending in a summary card. Season-end data
// only (SeasonOutcome); it opens by itself once per season and viewer.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import type { CareerState } from "@/lib/career/types";
import { galaSeenKey, type GalaSequence as Gala } from "@/lib/manager/galaSequence";
import { LEAGUE_LABEL } from "@/lib/manager/seasonPath";
import { CompetitionMark, competitionKeyOf, competitionStyle } from "@/components/season/CompetitionMark";
import { Crest, clubName } from "@/components/season/Knockout";

function readSeen(seasonId: string): boolean {
  try { return window.localStorage.getItem(galaSeenKey(seasonId)) === "1"; } catch { return true; }
}
function markSeen(seasonId: string) {
  try { window.localStorage.setItem(galaSeenKey(seasonId), "1"); } catch { /* per-viewer convenience only */ }
}

export function GalaSequence({ career, gala }: { career: CareerState; gala: Gala }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const total = gala.stages.length;

  useEffect(() => {
    // Opens by itself once per season, a beat after the page has settled.
    if (readSeen(gala.seasonId)) return;
    const timer = window.setTimeout(() => { setStep(0); setOpen(true); }, 400);
    return () => window.clearTimeout(timer);
  }, [gala.seasonId]);

  const close = useCallback(() => { markSeen(gala.seasonId); setOpen(false); }, [gala.seasonId]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setStep((s) => Math.min(total, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, total]);

  const name = (playerId: string) => { const p = getCareerPlayer(career, playerId); return p ? `${p.firstName} ${p.lastName}` : playerId; };
  const stage = gala.stages[step];

  return (
    <>
      <div className="pg-gala-launch">
        <span><b>Galan {gala.seasonId}</b> · {total} utmärkelser{gala.summary.myWinners.length ? ` · ${gala.summary.myWinners.length} till ${clubName(career.playerClubId)}` : ""}</span>
        <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => { setStep(0); setOpen(true); }}>Se galan</button>
      </div>
      {open && (
        <div className="pg-gala" role="dialog" aria-modal="true" aria-labelledby="pg-gala-title" ref={dialogRef} tabIndex={-1}>
          <div className="pg-gala-stage" data-mine={stage?.mine ?? false} style={stage ? competitionStyle(competitionKeyOf(stage.award.competitionId)) : undefined} key={step}>
            <header>
              <span className="pg-kicker">Galan · säsongen {gala.seasonId}</span>
              <span className="pg-num">{Math.min(step + 1, total + 1)} / {total + 1}</span>
            </header>
            {stage ? (
              <div className="pg-gala-reveal">
                <CompetitionMark competition={competitionKeyOf(stage.award.competitionId)} size={44} />
                <small>{LEAGUE_LABEL(stage.award.competitionId)}</small>
                <h2 id="pg-gala-title">{stage.award.label}</h2>
                <Crest id={stage.award.clubId} size={64} />
                <strong><Link href={`/career/squad/${encodeURIComponent(stage.award.playerId)}`} onClick={close}>{name(stage.award.playerId)}</Link></strong>
                <p>{clubName(stage.award.clubId)} · <span className="pg-num">{stage.award.value}</span></p>
                {stage.mine && <p className="pg-gala-mine">Din spelare</p>}
              </div>
            ) : (
              <div className="pg-gala-summary">
                <h2 id="pg-gala-title">Säsongen {gala.seasonId} i korthet</h2>
                <dl>
                  {gala.summary.champion && <div><dt>Svenska mästare</dt><dd><Crest id={gala.summary.champion} size={20} />{clubName(gala.summary.champion)}</dd></div>}
                  {gala.summary.runnerUp && <div><dt>Finalförlorare</dt><dd><Crest id={gala.summary.runnerUp} size={20} />{clubName(gala.summary.runnerUp)}</dd></div>}
                  {gala.summary.cupWinner && <div><dt>Svenska cupen</dt><dd><Crest id={gala.summary.cupWinner} size={20} />{clubName(gala.summary.cupWinner)}</dd></div>}
                </dl>
                <p>{gala.summary.myWinners.length ? `${clubName(career.playerClubId)}: ${gala.summary.myWinners.map((a) => `${a.label} (${name(a.playerId)})`).join(", ")}.` : `Ingen utmärkelse till ${clubName(career.playerClubId)} den här gången.`}</p>
                {gala.summary.allStars.length > 0 && <p className="pg-muted">All star-laget: {gala.summary.allStars.map((a) => `${a.position ? `${a.position} ` : ""}${name(a.playerId)}`).join(" · ")}</p>}
                <p className="pg-muted">Galan arkiveras i säsongsboken för {gala.seasonId} när nästa säsong startar.</p>
              </div>
            )}
            <footer>
              <button type="button" className="hm-btn hm-btn-sm" onClick={close}>{stage ? "Hoppa över" : "Stäng"}</button>
              {step > 0 && <button type="button" className="hm-btn hm-btn-sm" onClick={() => setStep(step - 1)}>Föregående</button>}
              {stage ? <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => setStep(step + 1)}>{step + 1 < total ? "Nästa pris →" : "Sammanfattning →"}</button>
                : <Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/history" onClick={close}>Säsongsböckerna →</Link>}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
