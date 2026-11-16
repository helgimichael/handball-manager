"use client";
// HM-ALPHA3-M07: the manager's own career -- reputation, contract, every
// club and season, milestones, and the job market: vacancies, applications
// with interviews, approaches and offers. A sacked manager lands here and
// picks the next club; the world carries on unchanged.
// HM-M7D: resignation with its consequences shown first, career statistics,
// per-season records, the reputation log and the whole Swedish pyramid.
// Arena Nights MGR-01 C / 01a B / 01b C: a biography in chapters on one
// annotated reputation line, the job market as an application pipeline
// ("Nästa kapitel") and resignation as a quiet footer. MGR-01c (unemployed
// Moment) is kept as it was.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DecisionCard, MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { BOARDROOM_BACKDROP } from "@/components/board/boardVisuals";
import { EmptyState } from "@/components/manager/Workspace";
import { CareerChapters, Crest, ReputationTimeline, clubName } from "@/components/manager/CareerBiography";
import { JobPipeline } from "@/components/manager/JobPipeline";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub } from "@/lib/game-data";
import { clubCompetitionId } from "@/lib/career/competitionMembership";
import { acceptJobOffer, clubChangeBlocker } from "@/lib/manager/changeClub";
import { answerInterview, applyForJob, assessCandidate, declineOffer, leagueName, managerCareerOf, managerCareerSummary, openVacancies, resignationPreview, resignFromClub, withdrawApplication } from "@/lib/manager/managerCareer";
import { buildCareerBiography, monogram } from "@/lib/manager/careerBiography";
import { buildJobPipeline } from "@/lib/manager/jobPipeline";
import { useMoney } from "@/lib/settings/usePreferences";

export default function ManagerPage() {
  return <Suspense fallback={<EmptyState>Läser karriären…</EmptyState>}><ManagerCareer /></Suspense>;
}

function ManagerCareer() {
  const money = useMoney();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "jobs" ? "jobs" : "profile";
  const { career, updateCareer, save } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const mc = managerCareerOf(career);
  const pipeline = useMemo(() => buildJobPipeline(managerCareerOf(career), openVacancies(career), career.gameDate, (clubId) => assessCandidate(career, clubId)), [career]);
  const bio = useMemo(() => buildCareerBiography(managerCareerOf(career), career.gameDate), [career]);
  const seasonIds = (career.seasonHistory ?? []).map((s) => s.seasonId);
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } };
  const lastAppointment = [...mc.milestones].reverse().find((m) => m.kind === "APPOINTED");
  const freshStart = lastAppointment && lastAppointment.date >= addDays(career.gameDate, -10) && mc.stints.length > 1;
  const setTab = (t: string) => router.replace(t === "jobs" ? "/career/manager?tab=jobs" : "/career/manager");
  const summary = managerCareerSummary(career);
  const resignation = resignationPreview(career);
  const formerClub = mc.seekingJob?.clubId ?? career.playerClubId;
  const board = !mc.seekingJob && career.board?.clubId === career.playerClubId ? career.board : undefined;
  const marketCount = pipeline.stages.filter((s) => s.id !== "DECIDED").reduce((n, s) => n + s.cards.length, 0);
  const currentChapter = bio.chapters.find((c) => c.open);

  return (
    <div className="bd-page kr-page">
      {mc.seekingJob ? (
        <MomentHero kind="DISMISSAL" backdrop={{ kind: "photo", style: BOARDROOM_BACKDROP }} tags={[mc.seekingJob.since]} stamp={mc.seekingJob.reason === "DISMISSED" ? "Sparkad" : mc.seekingJob.reason === "RESIGNED" ? "Avgått" : "Avtalet slut"} headline={mc.seekingJob.reason === "DISMISSED" ? `${getClub(formerClub)?.shortName ?? ""} har sparkat dig` : mc.seekingJob.reason === "RESIGNED" ? `Du har lämnat ${getClub(formerClub)?.shortName ?? ""}` : "Ditt avtal har gått ut"} lede={`${[...mc.milestones].reverse().find((m) => m.kind === mc.seekingJob!.reason)?.text ?? "Styrelsen valde att gå vidare utan dig."} Du står utan klubb sedan ${mc.seekingJob.since}. Kalendern fortsätter – sök lediga jobb eller vänta på att klubbar hör av sig.`} />
      ) : freshStart ? (
        <MomentHero kind="STAFF_APPOINTMENT" tone="success" backdrop={{ kind: "photo", style: BOARDROOM_BACKDROP }} tags={[false, "Ny klubb", lastAppointment!.date]} stamp="Påskrivet" headline={`Välkommen till ${clubName(career.playerClubId)}`} lede={`${lastAppointment!.text} Styrelsens mål väntar och truppen är din.`}>
          <div className="sc-hero-actions"><Link className="hm-btn hm-btn-primary" href="/career/board">Möt styrelsen →</Link> <Link className="hm-btn" href="/career/squad">Din nya trupp →</Link></div>
        </MomentHero>
      ) : null}

      <header className="kr-head" aria-labelledby="kr-head-title">
        <span className="kr-monogram" aria-hidden="true"><b>{monogram(save?.manager?.name ?? "")}</b>{!mc.seekingJob && <Crest clubId={career.playerClubId} size={26} />}</span>
        <div className="kr-head-main">
          <span className="kr-kicker">Din karriär · {mc.seekingJob ? "utan klubb" : `kapitel ${currentChapter?.number ?? mc.stints.length} · ${clubName(career.playerClubId)}`}</span>
          <h1 id="kr-head-title">{bio.standing}</h1>
          <p className="kr-muted">{mc.seekingJob ? `Utan klubb sedan ${mc.seekingJob.since}. Nästa kapitel skrivs på jobbmarknaden.` : `Huvudtränare i ${clubName(career.playerClubId)} sedan ${mc.stints.at(-1)?.from ?? mc.contract.startDate}, avtal till ${mc.contract.endDate} · ${money.format(mc.contract.wageEurPerMonth)} / mån.`}</p>
          <dl className="kr-head-stats">
            <div><dt>Matcher</dt><dd className="kr-num">{summary.record.played}</dd></div>
            <div><dt>V–O–F</dt><dd className="kr-num">{summary.record.won}–{summary.record.drawn}–{summary.record.lost}</dd></div>
            <div><dt>Mål för–emot</dt><dd className="kr-num">{summary.record.goalsFor}–{summary.record.goalsAgainst}</dd></div>
            <div><dt>Säsonger</dt><dd className="kr-num">{summary.seasons}</dd></div>
            <div><dt>Klubbar</dt><dd className="kr-num">{summary.clubs}</dd></div>
            <div><dt>SM-guld / cup</dt><dd className="kr-num">{summary.titles} / {summary.cups}</dd></div>
            <div><dt>Upp / ned</dt><dd className="kr-num">{summary.promotions} / {summary.relegations}</dd></div>
            <div><dt>Avsked / avhopp</dt><dd className="kr-num">{summary.dismissals} / {summary.resignations}</dd></div>
            <div><dt>Dagar utan klubb</dt><dd className="kr-num">{summary.daysUnemployed}</dd></div>
            <div><dt>Högsta nivå</dt><dd>{summary.highestLevel === null ? "—" : summary.highestLevel === 1 ? "Handbollsligan" : summary.highestLevel === 2 ? "Allsvenskan" : "Division 1"}</dd></div>
          </dl>
        </div>
        <div className="kr-meters">
          <MeterBar label="Rykte" value={mc.reputation / 100} figure={`${mc.reputation} / 100`} tone={mc.reputation >= 55 ? "gold" : "ink"} />
          {board ? <MeterBar label="Styrelsens förtroende" value={board.confidence / 100} figure={`${board.confidence} / 100`} tone={board.confidence < 35 ? "loss" : board.confidence >= 65 ? "success" : "ink"} /> : <p className="kr-muted">Styrelsens förtroende visas när du leder en klubb.</p>}
          <small className="kr-muted">Ryktet växer med uppfyllda mål, titlar och uppflyttningar och sjunker med nedflyttning, avsked och avhopp. Det avgör tillsammans med din erfarenhet vilka klubbar som vill ha dig.</small>
        </div>
      </header>

      <div className="bd-tabs kr-tabs" role="tablist" aria-label="Karriär">
        <button type="button" role="tab" aria-selected={tab === "profile"} onClick={() => setTab("profile")}>Biografi</button>
        <button type="button" role="tab" aria-selected={tab === "jobs"} onClick={() => setTab("jobs")}>Jobbmarknaden{marketCount > 0 ? ` (${marketCount})` : ""}</button>
        <Link role="tab" aria-selected={false} href="/career/history">Säsongsböcker{seasonIds.length ? ` (${seasonIds.length})` : ""}</Link>
      </div>
      {message && <p className="pd-note" role="status">{message}</p>}

      {tab === "profile" ? (
        <>
          <ReputationTimeline bio={bio} seasonIds={seasonIds} />
          <section className="kr-chapters-wrap" aria-labelledby="kr-chapters-title">
            <header className="kr-sec-head"><span className="kr-kicker">Biografin</span><h2 id="kr-chapters-title">Kapitlen</h2></header>
            <CareerChapters chapters={bio.chapters} seasonIds={seasonIds} />
          </section>
          <section className="kr-next" aria-labelledby="kr-next-title" data-seeking={!!mc.seekingJob}>
            <div><span className="kr-kicker">Nästa kapitel</span><h2 id="kr-next-title">{mc.seekingJob ? "Hitta nästa klubb" : "Jobbmarknaden"}</h2>
              <p className="kr-muted">{pipeline.stages.filter((s) => s.id !== "DECIDED").map((s) => `${s.label} ${s.cards.length}`).join(" · ")}{pipeline.needsAction ? ` · ${pipeline.needsAction} väntar på ditt svar` : ""}</p></div>
            <button type="button" className={`hm-btn${pipeline.needsAction || mc.seekingJob ? " hm-btn-primary" : ""}`} onClick={() => setTab("jobs")}>Öppna jobbmarknaden →</button>
          </section>
          {!mc.seekingJob && (
            <footer className="kr-resign" aria-labelledby="kr-resign-title">
              <h2 id="kr-resign-title">Lämna {clubName(career.playerClubId)}</h2>
              <p className="kr-muted">Avtal till {resignation.contractEndDate}, {money.format(resignation.wageEurPerMonth)} i månaden. Så här blir det om du avgår:</p>
              <ul className="kr-muted">{resignation.consequences.map((c) => <li key={c}>{c}</li>)}</ul>
              {confirmResign ? (
                <DecisionCard tone="loss" title="Vill du verkligen avgå?" primary={{ label: "Ja, jag avgår", consequence: resignation.blocker ?? `Gäller från i dag, ${career.gameDate}.`, disabled: !resignation.allowed, onSelect: () => run(() => { updateCareer((s) => resignFromClub(s)); setConfirmResign(false); }, `Du har lämnat ${clubName(career.playerClubId)}.`) }} secondary={<button type="button" className="hm-btn" onClick={() => setConfirmResign(false)}>Stanna kvar</button>} />
              ) : (
                <div className="hm-actions"><button type="button" className="hm-btn hm-btn-sm" disabled={!resignation.allowed} onClick={() => setConfirmResign(true)}>Avgå som huvudtränare…</button>{resignation.blocker && <small className="kr-muted">{resignation.blocker}</small>}</div>
              )}
            </footer>
          )}
          {mc.seekingJob && <button type="button" className="kr-job-chip" onClick={() => setTab("jobs")}>Jobbmarknaden{marketCount ? ` · ${marketCount}` : ""} →</button>}
        </>
      ) : (
        <JobPipeline pipeline={pipeline} seeking={!!mc.seekingJob} actions={{
          apply: (clubId) => run(() => updateCareer((s) => applyForJob(s, clubId)), "Ansökan skickad. Intervjun väntar under Intervju."),
          answer: (appId, answers) => run(() => updateCareer((s) => answerInterview(s, appId, answers)), "Intervjun är gjord. Klubben svarar om två dagar."),
          withdraw: (appId) => run(() => updateCareer((s) => withdrawApplication(s, appId)), "Ansökan är återtagen."),
          accept: (offerId) => { const o = mc.offers[offerId]; run(() => updateCareer((s) => acceptJobOffer(s, offerId)), `Du är ny huvudtränare i ${o ? clubName(o.clubId) : "klubben"}.`); },
          decline: (offerId) => run(() => updateCareer((s) => declineOffer(s, offerId)), "Du tackade nej."),
          blocker: (clubId) => clubChangeBlocker(career, clubId),
          league: (clubId) => leagueName(clubCompetitionId(career, clubId) ?? getClub(clubId)?.competitionId),
          formatWage: (eur) => money.format(eur),
          leaving: mc.seekingJob ? null : clubName(career.playerClubId),
        }} />
      )}
    </div>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
