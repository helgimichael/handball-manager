"use client";
// HM-ALPHA3-M06: the Scouting Centre -- "Rekryteringsrummet". What the
// club knows and is learning: scouts and their workload, the newest
// discoveries (a promising one gets its Moment), recommendations for the
// squad's needs and a side-by-side comparison. Everything shown is an
// estimate from the club's own knowledge -- ranges, never true values.
import Link from "next/link";
import { useMemo, useState } from "react";
import ClubCrest from "@/components/ClubCrest";
import { MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import StarRating from "@/components/StarRating";
import { SCOUTING_BACKDROP } from "@/components/scouting/scoutingVisuals";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { getCareerPlayerRating } from "@/lib/career/careerRatingNormalization";
import { addToShortlist, isShortlisted } from "@/lib/career/recruitment";
import { computeAssignmentProgressPct, createScoutingAssignment, getClubScouts } from "@/lib/career/scouting";
import { scopeLabelSv } from "@/lib/career/scoutDiscovery";
import { getClub } from "@/lib/game-data";
import { getPlayerKnowledgePct } from "@/lib/knowledge/knowledgeIntegration";
import { resolvePlayerVisibility, type StarRange } from "@/lib/knowledge/playerVisibility";
import { useMoney } from "@/lib/settings/usePreferences";
import { recruitmentRecommendations, type Recommendation } from "@/lib/scouting/recommendations";
import { roleSuitabilityStars } from "@/lib/staff/presentation";
import { computeRoleSuitability } from "@/lib/staff/roleSuitability";

/** A star range as five stars: certain ones filled, the uncertain span hatched. */
export function StarRangeView({ range, label }: { range: StarRange; label: string }) {
  return (
    <span className="sc-stars" role="img" aria-label={`${label}: ${range.min === range.max ? range.min : `${range.min} till ${range.max}`} av 5 stjärnor`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} data-state={i <= range.min ? "known" : i <= range.max ? "maybe" : "no"} />)}
    </span>
  );
}

function Crest({ clubId }: { clubId: string }) {
  const c = clubId ? getClub(clubId) : undefined;
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={20} /> : <span className="tc-pill">Fri</span>;
}

export function ScoutingCentre() {
  const money = useMoney();
  const { career, updateCareer } = useCareer();
  const [compare, setCompare] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const scouts = getClubScouts(career);
  const assignments = Object.values(career.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS");
  const recs = useMemo(() => recruitmentRecommendations(career, 8), [career]);
  const discoveries = Object.values(career.scoutDiscoveries ?? {}).sort((a, b) => b.discoveredDate.localeCompare(a.discoveredDate)).slice(0, 8);
  const known = Object.values(career.playerKnowledge ?? {}).filter((k) => k >= 50).length;
  const viewOf = (playerId: string, clubId: string) => {
    const rating = getCareerPlayerRating(career, playerId, clubId || undefined);
    return rating ? resolvePlayerVisibility({ ...rating, playerId }, getPlayerKnowledgePct(career, playerId, clubId)) : null;
  };
  // The newest discovery whose estimated potential reaches four stars or more: the club's find of the month.
  const spotlight = discoveries.map((d) => ({ d, v: viewOf(d.playerId, d.clubId), p: getCareerPlayer(career, d.playerId) })).find((x) => x.v?.potentialRange && x.v.potentialRange.max >= 4 && x.p);
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? money.text(e.message) : "Det gick inte."); } };
  const chosen = recs.filter((r) => compare.includes(r.player.id));

  return (
    <section className="sc-centre" aria-label="Rekryteringsrummet">
      {spotlight ? (
        <MomentHero kind="ANNOUNCEMENT" tone="gold" backdrop={{ kind: "photo", style: SCOUTING_BACKDROP }} tags={[spotlight.d.discoveredDate, "Ny upptäckt"]} stamp="Talang" headline={`${spotlight.p!.firstName} ${spotlight.p!.lastName}`} lede={`${getClub(spotlight.d.clubId)?.name ?? "Fri agent"} · ${spotlight.p!.position}. Scouten tror på en potential runt ${spotlight.v!.potentialRange!.min}–${spotlight.v!.potentialRange!.max} stjärnor. ${spotlight.d.reasons[0] ?? ""}`}>
          <div className="sc-hero-actions"><Link className="hm-btn hm-btn-primary" href={`/career/squad/${encodeURIComponent(spotlight.d.playerId)}`}>Öppna rapporten</Link></div>
        </MomentHero>
      ) : (
        <header className="xp-moment-hero xp-photo-hero sc-hero" data-tone="ink" style={SCOUTING_BACKDROP}>
          <div className="xp-moment-copy"><div className="xp-tags"><span>Rekryteringsrummet</span></div><h2>Scoutingcentralen</h2><p>Varje rapport gör bilden skarpare. Det du inte vet visas som ett spann -- osäkerheten är verklig.</p></div>
        </header>
      )}

      <div className="sc-stats">
        <div><small>Scouter</small><b>{scouts.length}</b><span>{assignments.length} pågående uppdrag</span></div>
        <div><small>Väl kända spelare</small><b>{known}</b><span>minst 50 % kännedom</span></div>
        <div><small>Upptäckter</small><b>{Object.keys(career.scoutDiscoveries ?? {}).length}</b><span>totalt</span></div>
        <div><small>Kortlistan</small><b>{Object.values(career.recruitmentTargets ?? {}).filter((t) => t.shortlisted).length}</b><span><Link href="/career/recruitment">Rekryteringscentrum →</Link></span></div>
      </div>

      <div className="sc-grid">
        <section className="sc-panel" aria-labelledby="sc-recs">
          <header><span className="xp-eyebrow">Utifrån truppens behov</span><h3 id="sc-recs">Rekommendationer</h3></header>
          {recs.length === 0 ? <p className="pd-note">Scouterna behöver se fler spelare innan de kan rekommendera någon. Skicka ut dem på uppdrag nedan.</p> : (
            <ol className="sc-recs">{recs.map((r: Recommendation) => (
              <li key={r.player.id}>
                <label className="sc-pick"><input type="checkbox" checked={compare.includes(r.player.id)} disabled={compare.length >= 2 && !compare.includes(r.player.id)} onChange={(e) => setCompare((c) => (e.target.checked ? [...c, r.player.id].slice(-2) : c.filter((x) => x !== r.player.id)))} aria-label={`Jämför ${r.player.firstName} ${r.player.lastName}`} /></label>
                <div className="sc-rec-main">
                  <Link href={`/career/squad/${encodeURIComponent(r.player.id)}`}><b>{r.player.firstName} {r.player.lastName}</b></Link>
                  <small><Crest clubId={r.clubId} /> {getClub(r.clubId)?.shortName ?? "Kontraktslös"} · {r.player.position}</small>
                  <small>{r.reasons.join(" · ")}</small>
                </div>
                <div className="sc-rec-est"><StarRangeView range={r.abilityRange} label="Nivå" />{r.potentialRange && <StarRangeView range={r.potentialRange} label="Potential" />}</div>
                <div className="sc-rec-conf"><MeterBar label="Säkerhet" value={r.confidencePct / 100} figure={`${r.confidencePct} %`} tone={r.confidencePct >= 70 ? "success" : "gold"} /><small>{r.valueRange ? `${money.format(r.valueRange.min, { compact: true })}–${money.format(r.valueRange.max, { compact: true })}` : "—"}</small></div>
                <div className="sc-rec-actions">
                  {isShortlisted(career, r.player.id) ? <span className="tc-pill" data-tone="done">På kortlistan</span> : <button type="button" className="hm-btn hm-btn-sm" onClick={() => run(() => updateCareer((s) => addToShortlist(s, r.player.id, s.gameDate)), "Satt upp på kortlistan.")}>Kortlista</button>}
                  {scouts[0] && <button type="button" className="hm-btn hm-btn-sm" onClick={() => run(() => updateCareer((s) => { const res = createScoutingAssignment(s, scouts[0]!.id, r.player.id, r.clubId, s.gameDate); if (!res.ok) throw new Error(res.errors.join(" ")); return res.state; }), `${scouts[0]!.displayName} scoutar honom.`)}>Scouta</button>}
                </div>
              </li>
            ))}</ol>
          )}
          {chosen.length === 2 && (
            <div className="sc-compare" aria-label="Jämförelse">
              {chosen.map((r) => <div key={r.player.id}><b>{r.player.firstName} {r.player.lastName}</b><span>Nivå</span><StarRangeView range={r.abilityRange} label="Nivå" /><span>Potential</span>{r.potentialRange ? <StarRangeView range={r.potentialRange} label="Potential" /> : <i className="pd-note">Okänd -- scouta mer</i>}<span>Säkerhet {r.confidencePct} %</span><span>{r.valueRange ? `${money.format(r.valueRange.min, { compact: true })}–${money.format(r.valueRange.max, { compact: true })}` : "—"}</span></div>)}
              <p className="pd-note">Överlappande spann betyder att scouterna inte kan skilja dem åt ännu.</p>
            </div>
          )}
          {message && <p className="pd-note" role="status">{message}</p>}
        </section>

        <aside className="sc-panel" aria-labelledby="sc-scouts">
          <header><span className="xp-eyebrow">Arbetsbelastning</span><h3 id="sc-scouts">Scouterna</h3></header>
          {scouts.length === 0 ? <p className="pd-note">Klubben har ingen scout. <Link href="/career/staff/recruitment?role=SCOUT">Rekrytera en →</Link></p> : (
            <ul className="sc-scouts">{scouts.map((s) => {
              const mine = assignments.filter((a) => a.scoutStaffId === s.id);
              return (
                <li key={s.id}>
                  <div><Link href={`/career/staff/${encodeURIComponent(s.id)}`}><b>{s.displayName}</b></Link><StarRating stars={roleSuitabilityStars(computeRoleSuitability(s, "SCOUT"))} /></div>
                  {mine.length === 0 ? <small>Ledig -- ge ett uppdrag nedan</small> : mine.map((a) => <MeterBar key={a.id} label={a.assignmentType === "PLAYER" ? `Spelarrapport: ${getCareerPlayer(career, a.targetPlayerId)?.lastName ?? ""}` : `Letar ${scopeLabelSv(a)}`} value={computeAssignmentProgressPct(a, career.gameDate) / 100} figure={`${computeAssignmentProgressPct(a, career.gameDate)} %`} tone="ink" />)}
                </li>
              );
            })}</ul>
          )}
          <h4>Senaste upptäckterna</h4>
          {discoveries.length === 0 ? <p className="pd-note">Inga upptäckter ännu.</p> : (
            <ul className="sc-discoveries">{discoveries.map((d) => { const p = getCareerPlayer(career, d.playerId); const v = viewOf(d.playerId, d.clubId); return p ? (
              <li key={d.id}><Link href={`/career/squad/${encodeURIComponent(d.playerId)}`}>{p.firstName} {p.lastName}</Link><small>{d.discoveredDate} · {getClub(d.clubId)?.shortName ?? "Fri"} · {p.position}</small>{v && <StarRangeView range={v.abilityRange} label="Nivå" />}</li>
            ) : null; })}</ul>
          )}
        </aside>
      </div>
    </section>
  );
}
