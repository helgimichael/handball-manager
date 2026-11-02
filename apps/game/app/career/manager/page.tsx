"use client";
// HM-ALPHA3-M07: the manager's own career -- reputation, contract, every
// club and season, milestones, and the job market: vacancies, applications
// with interviews, approaches and offers. A sacked manager lands here and
// picks the next club; the world carries on unchanged.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ClubCrest from "@/components/ClubCrest";
import { DecisionCard, MomentHero } from "@/components/experience/Moment";
import { MeterBar } from "@/components/experience/primitives";
import { BOARDROOM_BACKDROP } from "@/components/board/boardVisuals";
import { EmptyState } from "@/components/manager/Workspace";
import { useCareer } from "@/lib/career/CareerContext";
import { getClub, COMPETITIONS } from "@/lib/game-data";
import { clubCompetitionId } from "@/lib/career/competitionMembership";
import { acceptJobOffer, clubChangeBlocker } from "@/lib/manager/changeClub";
import { answerInterview, applyForJob, clubStature, declineOffer, managerCareerOf, openOffers, openVacancies, withdrawApplication } from "@/lib/manager/managerCareer";
import type { JobApplication } from "@/lib/board/types";
import { useMoney } from "@/lib/settings/usePreferences";

function Crest({ clubId, size = 22 }: { clubId: string; size?: number }) {
  const c = getClub(clubId);
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={size} /> : null;
}
const clubName = (id: string) => getClub(id)?.name ?? id;
const compName = (id: string) => COMPETITIONS.find((c) => c.id === id)?.name ?? id;

function repLabel(r: number) {
  return r >= 75 ? "Ett av landets stora namn" : r >= 55 ? "Respekterad i Handbollsligan" : r >= 38 ? "Etablerad tränare" : r >= 25 ? "Ett namn på uppgång" : "Okänd för de flesta";
}

export default function ManagerPage() {
  return <Suspense fallback={<EmptyState>Läser karriären…</EmptyState>}><ManagerCareer /></Suspense>;
}

function ManagerCareer() {
  const money = useMoney();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "jobs" ? "jobs" : "profile";
  const { career, updateCareer } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const mc = managerCareerOf(career);
  const offers = openOffers(career);
  const vacancies = openVacancies(career);
  const run = (fn: () => void, ok: string) => { try { fn(); setMessage(ok); } catch (e) { setMessage(e instanceof Error ? e.message : "Det gick inte."); } };
  const lastAppointment = [...mc.milestones].reverse().find((m) => m.kind === "APPOINTED");
  const freshStart = lastAppointment && lastAppointment.date >= addDays(career.gameDate, -10) && mc.stints.length > 1;
  const setTab = (t: string) => router.replace(t === "jobs" ? "/career/manager?tab=jobs" : "/career/manager");

  return (
    <div className="bd-page">
      {mc.seekingJob ? (
        <MomentHero kind="DISMISSAL" backdrop={{ kind: "photo", style: BOARDROOM_BACKDROP }} tags={[mc.seekingJob.since]} stamp={mc.seekingJob.reason === "DISMISSED" ? "Sparkad" : "Avtalet slut"} headline={mc.seekingJob.reason === "DISMISSED" ? `${getClub(career.playerClubId)?.shortName ?? ""} har sparkat dig` : "Ditt avtal har gått ut"} lede={`${[...mc.milestones].reverse().find((m) => m.kind === "DISMISSED")?.text ?? "Styrelsen valde att gå vidare utan dig."} Världen fortsätter – välj ditt nästa jobb bland erbjudandena nedan.`} />
      ) : freshStart ? (
        <MomentHero kind="STAFF_APPOINTMENT" tone="success" backdrop={{ kind: "photo", style: BOARDROOM_BACKDROP }} tags={[false, "Ny klubb", lastAppointment!.date]} stamp="Påskrivet" headline={`Välkommen till ${clubName(career.playerClubId)}`} lede={`${lastAppointment!.text} Styrelsens mål väntar och truppen är din.`}>
          <div className="sc-hero-actions"><Link className="hm-btn hm-btn-primary" href="/career/board">Möt styrelsen →</Link> <Link className="hm-btn" href="/career/squad">Din nya trupp →</Link></div>
        </MomentHero>
      ) : (
        <MomentHero tone="ink" size="compact" backdrop={{ kind: "photo", style: BOARDROOM_BACKDROP }} tags={[false, "Din karriär", clubName(career.playerClubId)]} stamp={null} headline="Tränarkarriären" lede={`${repLabel(mc.reputation)}. Huvudtränare i ${clubName(career.playerClubId)} sedan ${mc.stints.at(-1)?.from ?? mc.contract.startDate}, avtal till ${mc.contract.endDate}.`} aside={<div className="bd-hero-figure"><b>{mc.reputation}</b><small>rykte av 100</small></div>} />
      )}

      <div className="bd-tabs" role="tablist" aria-label="Karriär">
        <button type="button" role="tab" aria-selected={tab === "profile"} onClick={() => setTab("profile")}>Profil och historik</button>
        <button type="button" role="tab" aria-selected={tab === "jobs"} onClick={() => setTab("jobs")}>Jobbmarknaden{offers.length + vacancies.length > 0 ? ` (${offers.length + vacancies.length})` : ""}</button>
      </div>
      {message && <p className="pd-note" role="status">{message}</p>}

      {tab === "profile" ? (
        <div className="bd-grid">
          <section className="bd-panel" aria-labelledby="mp-profile">
            <header><span className="xp-eyebrow">Tränarprofilen</span><h2 id="mp-profile">{repLabel(mc.reputation)}</h2></header>
            <MeterBar label="Rykte" value={mc.reputation / 100} figure={`${mc.reputation} / 100`} tone={mc.reputation >= 55 ? "gold" : "ink"} />
            <p className="pd-note">Ryktet växer med uppfyllda mål, titlar och uppflyttningar och sjunker med nedflyttning och avsked. Det avgör vilka klubbar som vill ha dig.</p>
            <dl className="bd-contract">
              <div><dt>Nuvarande klubb</dt><dd>{mc.seekingJob ? "Utan klubb" : clubName(career.playerClubId)}</dd></div>
              <div><dt>Lön</dt><dd>{money.format(mc.contract.wageEurPerMonth)} / mån</dd></div>
              <div><dt>Avtal till</dt><dd>{mc.contract.endDate}</dd></div>
              <div><dt>Säsonger</dt><dd>{mc.stints.reduce((n, s) => n + s.seasons.length, 0)}</dd></div>
            </dl>
          </section>
          <section className="bd-panel" aria-labelledby="mp-history">
            <header><span className="xp-eyebrow">Historik</span><h2 id="mp-history">Klubbarna</h2></header>
            <ol className="bd-stints">{[...mc.stints].reverse().map((s) => (
              <li key={s.clubId + s.from}>
                <div><Crest clubId={s.clubId} /><b>{clubName(s.clubId)}</b><small>{s.from} – {s.to ?? "i dag"}{s.leftReason ? ` · ${s.leftReason === "DISMISSED" ? "sparkad" : s.leftReason === "NEW_JOB" ? "nytt jobb" : s.leftReason === "CONTRACT_ENDED" ? "avtalet gick ut" : "slutade"}` : ""}</small></div>
                {s.seasons.length > 0 && <table className="hm-table"><thead><tr><th>Säsong</th><th>Serie</th><th>Plac.</th><th>Målen</th><th>Meriter</th></tr></thead><tbody>{s.seasons.map((x) => <tr key={x.seasonId}><td>{x.seasonId}</td><td>{compName(x.competitionId)}</td><td>{x.position ?? "—"}</td><td>{x.objectivesScore === null ? "—" : `${Math.round(x.objectivesScore * 100)} %`}</td><td>{x.honours.join(", ") || "—"}</td></tr>)}</tbody></table>}
              </li>
            ))}</ol>
            <h3 className="bd-subhead">Milstolpar</h3>
            <ol className="bd-meetings">{[...mc.milestones].reverse().slice(0, 12).map((m, i) => <li key={i} data-verdict={m.kind === "DISMISSED" || m.kind === "RELEGATION" ? "DISMISSED" : m.kind === "TITLE" || m.kind === "CUP" || m.kind === "PROMOTION" ? "PLEASED" : "SATISFIED"}><time>{m.date}</time><b>{m.text}</b></li>)}</ol>
          </section>
        </div>
      ) : (
        <div className="bd-jobs">
          <section className="bd-panel" aria-labelledby="mp-offers">
            <header><span className="xp-eyebrow">Erbjudanden</span><h2 id="mp-offers">Klubbar som vill ha dig</h2></header>
            {offers.length === 0 ? <p className="pd-note">Inga erbjudanden just nu.{mc.seekingJob ? " Nya kommer inom kort." : " Klubbar hör av sig när de söker tränare och ditt rykte räcker."}</p> : (
              <div className="bd-offers">{offers.map((o) => {
                const blocker = clubChangeBlocker(career, o.clubId);
                return (
                  <DecisionCard key={o.id} tone={o.source === "APPROACH" ? "gold" : "success"} title={<span className="bd-offer-title"><Crest clubId={o.clubId} size={26} />{clubName(o.clubId)}</span>} status={<span className="tc-pill">Svar senast {o.expiresOn}</span>}
                    primary={{ label: "Tacka ja", consequence: blocker ?? `${o.years} år, ${money.format(o.wageEurPerMonth)} i månaden. ${mc.seekingJob ? "" : "Du lämnar din nuvarande klubb."}`, disabled: !!blocker, onSelect: () => run(() => updateCareer((s) => acceptJobOffer(s, o.id)), `Du är ny huvudtränare i ${clubName(o.clubId)}.`) }}
                    secondary={<button type="button" className="hm-btn" onClick={() => run(() => updateCareer((s) => declineOffer(s, o.id)), "Du tackade nej.")}>Tacka nej</button>}>
                    <p className="pd-note">{o.pitch}</p>
                    <p className="pd-note">{compName(clubCompetitionId(career, o.clubId) ?? getClub(o.clubId)?.competitionId ?? "")} · jobbets nivå {clubStature(career, o.clubId)} (ditt rykte {mc.reputation})</p>
                  </DecisionCard>
                );
              })}</div>
            )}
          </section>

          <section className="bd-panel" aria-labelledby="mp-vac">
            <header><span className="xp-eyebrow">Lediga tjänster</span><h2 id="mp-vac">Klubbar som söker tränare</h2></header>
            {vacancies.length === 0 ? <p className="pd-note">Inga lediga tjänster. Klubbar som går sämre än väntat byter ofta tränare under vintern, och flera byter efter säsongen.</p> : (
              <ul className="bd-vacancies">{vacancies.map((v) => {
                const applied = Object.values(mc.applications).find((a) => a.clubId === v.clubId && a.appliedOn >= v.openedOn);
                const need = clubStature(career, v.clubId);
                return (
                  <li key={v.clubId}>
                    <Crest clubId={v.clubId} size={28} />
                    <div><b>{clubName(v.clubId)}</b><small>{v.reason}</small><small>Ansök senast {v.closesOn} · {need <= mc.reputation ? "ditt rykte räcker" : need <= mc.reputation + 8 ? "ditt rykte är nära" : "jobbet är ett stort kliv"}</small></div>
                    {applied ? <span className="tc-pill">{applied.status === "INTERVIEW" ? "Intervju väntar" : applied.status === "ANSWERED" ? "Väntar på svar" : applied.status === "OFFERED" ? "Erbjuden" : applied.status === "REJECTED" ? "Nej" : "Återtagen"}</span>
                      : <button type="button" className="hm-btn hm-btn-sm" onClick={() => run(() => updateCareer((s) => applyForJob(s, v.clubId)), "Ansökan skickad. Intervjun väntar nedan.")}>Sök jobbet</button>}
                  </li>
                );
              })}</ul>
            )}
          </section>

          <section className="bd-panel" aria-labelledby="mp-apps">
            <header><span className="xp-eyebrow">Ansökningar</span><h2 id="mp-apps">Intervjuer och svar</h2></header>
            {Object.values(mc.applications).length === 0 ? <p className="pd-note">Inga ansökningar ännu.</p> : (
              <div className="bd-apps">{[...Object.values(mc.applications)].reverse().slice(0, 8).map((a) => <ApplicationCard key={a.id} app={a} onAnswer={(answers) => run(() => updateCareer((s) => answerInterview(s, a.id, answers)), "Intervjun är gjord. Klubben svarar om två dagar.")} onWithdraw={() => run(() => updateCareer((s) => withdrawApplication(s, a.id)), "Ansökan är återtagen.")} />)}</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ApplicationCard({ app, onAnswer, onWithdraw }: { app: JobApplication; onAnswer: (answers: Record<string, string>) => void; onWithdraw: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (app.status !== "INTERVIEW") {
    return (
      <article className="bd-app" data-status={app.status}>
        <header><Crest clubId={app.clubId} /><b>{clubName(app.clubId)}</b><span className="tc-pill">{app.status === "ANSWERED" ? `Svar ${app.decisionOn}` : app.status === "OFFERED" ? "Erbjuden jobbet" : app.status === "REJECTED" ? "Fick inte jobbet" : "Återtagen"}</span></header>
        {app.note && <p className="pd-note">{app.note}</p>}
      </article>
    );
  }
  return (
    <article className="bd-app" data-status="INTERVIEW">
      <header><Crest clubId={app.clubId} /><b>Intervju: {clubName(app.clubId)}</b><span className="tc-pill">Styrelsen lyssnar</span></header>
      {app.questions.map((q) => (
        <fieldset key={q.id} className="bd-question">
          <legend>{q.question}</legend>
          {q.answers.map((ans) => <label key={ans.id}><input type="radio" name={`${app.id}:${q.id}`} value={ans.id} checked={answers[q.id] === ans.id} onChange={() => setAnswers((x) => ({ ...x, [q.id]: ans.id }))} />{ans.label}</label>)}
        </fieldset>
      ))}
      <div className="hm-actions"><button type="button" className="hm-btn hm-btn-primary" disabled={app.questions.some((q) => !answers[q.id])} onClick={() => onAnswer(answers)}>Lämna svaren</button><button type="button" className="hm-btn" onClick={onWithdraw}>Dra tillbaka</button></div>
    </article>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
