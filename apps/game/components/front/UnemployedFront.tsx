"use client";
// Employment states: the Idag front page for a manager without a club -- a deliberate career mode in the
// Arena Nights front-page language (masthead, ears, lead story, numbered decisions, briefs), built only
// from public facts and his own career record. Nothing here reads the former club's internal state
// (squad, board, finances, training); the former club appears exactly as any club does in the world.
import Link from "next/link";
import type { ReactNode } from "react";
import ClubCrest from "@/components/ClubCrest";
import { EmptyState } from "@/components/manager/Workspace";
import { ENVIRONMENTS } from "@/components/clubhq/environments";
import { useMoney } from "@/lib/settings/usePreferences";
import { getClub } from "@/lib/game-data";
import type { CareerState } from "@/lib/career/types";
import type { FrontPage } from "@/lib/career/frontPage";
import { clubCompetitionId } from "@/lib/career/competitionMembership";
import { competitionTable } from "@/lib/competition/tables";
import { formerClubId } from "@/lib/manager/employment";
import { leagueName, managerCareerSummary, openOffers, openVacancies } from "@/lib/manager/managerCareer";
import "@/components/shell/no-club.css";

const LEFT_REASON: Record<string, string> = { DISMISSED: "Sparkad", RESIGNED: "Avgick", NEW_JOB: "Nytt jobb", CONTRACT_ENDED: "Avtalet gick ut" };
const SEEKING_REASON: Record<string, string> = { DISMISSED: "Sparkad", RESIGNED: "Avgått", CONTRACT_ENDED: "Avtalet slut" };

export interface UnemployedFrontProps {
  career: CareerState;
  front: FrontPage;
  /** The reputation ear, rendered by the front page's own component. */
  reputationEar: ReactNode;
  /** The season hand-off still belongs to the career: the calendar must be able to roll over without a club. */
  seasonHandoff?: ReactNode;
  week: number;
}

export function UnemployedFront({ career, front, reputationEar, seasonHandoff, week }: UnemployedFrontProps) {
  const money = useMoney();
  const mc = career.managerCareer;
  const seeking = mc?.seekingJob;
  const formerId = formerClubId(career);
  const former = formerId ? getClub(formerId) : undefined;
  const summary = managerCareerSummary(career);
  const offers = openOffers(career);
  const vacancies = openVacancies(career);
  const applications = Object.values(mc?.applications ?? {}).filter((a) => a.status === "INTERVIEW" || a.status === "ANSWERED");
  const formerComp = formerId ? clubCompetitionId(career, formerId) ?? former?.competitionId : undefined;
  const formerTable = formerComp ? competitionTable(career, formerComp) : [];
  const formerPos = formerId ? formerTable.findIndex((r) => r.clubId === formerId) + 1 : 0;
  const formerLast = formerId
    ? career.fixtures.filter((f) => (f.homeClubId === formerId || f.awayClubId === formerId) && career.results[f.id]).sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined;
  const stints = [...(mc?.stints ?? [])].reverse().slice(0, 4);
  const record = summary.record;

  return (
    <div className="game-home hm-front hm-front-noclub" data-employment="UNEMPLOYED">
      <header className="hm-front-masthead" aria-label="Utan klubb">
        <Link className="hm-front-ear hm-noclub-ear" href="/career/manager?tab=jobs" data-tone="club" aria-label={`Utan klubb sedan ${seeking?.since ?? "—"}`}>
          <span className="hm-front-ear-copy"><span className="hm-front-ear-label">Status <small>· karriär</small></span><strong>Utan klubb</strong><small>{seeking ? `${SEEKING_REASON[seeking.reason] ?? ""} · sedan ${seeking.since}` : ""}</small></span>
        </Link>
        <div className="hm-front-nameplate">
          <span className="hm-noclub-mark" aria-hidden="true">HM</span>
          <div>
            <div className="game-overline">Karriären · vecka {week} · {career.seasonId}</div>
            <h1>Utan klubb</h1>
            <p>{former ? `Senast huvudtränare i ${former.name}` : "Nästa uppdrag väntar"}</p>
          </div>
          <nav className="hm-front-rooms" aria-label="Karriärens rum"><Link href="/career/manager?tab=jobs">Jobbmarknaden →</Link><Link href="/career/manager">Din karriär →</Link></nav>
        </div>
        {reputationEar}
      </header>

      {seasonHandoff}

      <section className="hm-front-top" aria-label="Förstasidan">
        <article className="hm-front-lead xp-photo-hero" data-kind={front.lead.kind} style={ENVIRONMENTS["manager-office"].backdropStyle}>
          <div className="hm-front-lead-copy">
            <span className="hm-front-kicker">{front.lead.kicker}</span>
            <h2>{front.lead.headline}</h2>
            <p>{front.lead.standfirst}</p>
            <Link className="hm-btn hm-btn-primary" href={front.lead.href}>{front.lead.cta} →</Link>
          </div>
        </article>
        <aside className="hm-front-decisions" aria-labelledby="hm-noclub-decisions-h">
          <h2 id="hm-noclub-decisions-h">Jobbmarknaden</h2>
          <ol className="hm-noclub-market">
            <li><span className="hm-front-num" aria-hidden="true">{offers.length}</span><div><strong>{offers.length === 1 ? "Erbjudande" : "Erbjudanden"}</strong><p>{offers.length ? offers.slice(0, 2).map((o) => `${getClub(o.clubId)?.shortName ?? o.clubId} (${o.years} år, ${money.format(o.wageEurPerMonth)}/mån)`).join(" · ") : "Inga erbjudanden just nu."}</p></div><Link className="hm-btn hm-btn-sm" href="/career/manager?tab=jobs">Svara →</Link></li>
            <li><span className="hm-front-num" aria-hidden="true">{vacancies.length}</span><div><strong>Lediga tjänster</strong><p>{vacancies.length ? vacancies.slice(0, 3).map((v) => getClub(v.clubId)?.shortName ?? v.clubId).join(" · ") : "Inga lediga tjänster i de svenska serierna."}</p></div><Link className="hm-btn hm-btn-sm" href="/career/manager?tab=jobs">Sök →</Link></li>
            <li><span className="hm-front-num" aria-hidden="true">{applications.length}</span><div><strong>Pågående ansökningar</strong><p>{applications.length ? applications.map((a) => getClub(a.clubId)?.shortName ?? a.clubId).join(" · ") : "Du har inga ansökningar ute."}</p></div><Link className="hm-btn hm-btn-sm" href="/career/manager?tab=jobs">Följ →</Link></li>
          </ol>
          {front.decisions.length > 0 && <ol>{front.decisions.map((d) => <li key={d.n} data-urgent={d.urgent}><span className="hm-front-num" aria-hidden="true">{d.n}</span><div><strong>{d.title}</strong><p>{money.text(d.detail)}</p></div><Link className="hm-btn hm-btn-sm" href={d.href}>{d.cta} →</Link></li>)}</ol>}
        </aside>
      </section>

      <div className="hm-front-briefs">
        <section aria-labelledby="hm-noclub-career-h">
          <div className="game-section-heading"><h2 id="hm-noclub-career-h">Din karriär</h2><Link href="/career/manager">Karriären →</Link></div>
          <dl className="hm-noclub-facts">
            <div><dt>Klubbar</dt><dd>{summary.clubs}</dd></div>
            <div><dt>Säsonger</dt><dd>{summary.seasons}</dd></div>
            <div><dt>Matcher</dt><dd>{record.played}</dd></div>
            <div><dt>V–O–F</dt><dd>{record.won}–{record.drawn}–{record.lost}</dd></div>
            <div><dt>Titlar</dt><dd>{summary.titles + summary.cups}</dd></div>
            <div><dt>Rykte</dt><dd>{mc?.reputation ?? "—"}</dd></div>
          </dl>
          <ul className="hm-noclub-stints">
            {stints.map((st) => { const c = getClub(st.clubId); return (
              <li key={`${st.clubId}:${st.from}`}>
                {c && <ClubCrest clubId={c.id} shortName={c.shortName} primaryColor={c.primaryColor} size={22} />}
                <span><strong>{c?.name ?? st.clubId}</strong><small>{st.from} – {st.to ?? "nu"}{st.leftReason ? ` · ${LEFT_REASON[st.leftReason] ?? st.leftReason}` : ""}{st.competitionId ? ` · ${leagueName(st.competitionId)}` : ""}</small></span>
              </li>
            ); })}
          </ul>
          <Link className="hm-btn hm-btn-sm" href="/career/history">Historiken →</Link>
        </section>
        <section aria-labelledby="hm-noclub-former-h">
          <div className="game-section-heading"><h2 id="hm-noclub-former-h">{former ? `${former.shortName} utan dig` : "Din förra klubb"}</h2>{former && <Link href={`/career/clubs/${encodeURIComponent(former.id)}`}>Klubbens profil →</Link>}</div>
          {former ? <>
            <p className="hm-noclub-former">
              <ClubCrest clubId={former.id} shortName={former.shortName} primaryColor={former.primaryColor} size={28} />
              <span>{former.name} leds av klubbens egen organisation. {formerPos > 0 ? `${formerPos}:a i ${leagueName(formerComp)}.` : ""}{formerLast ? ` Senast: ${getClub(formerLast.homeClubId)?.shortName ?? ""} ${career.results[formerLast.id]!.homeGoals}–${career.results[formerLast.id]!.awayGoals} ${getClub(formerLast.awayClubId)?.shortName ?? ""}.` : ""}</span>
            </p>
            {formerComp && <Link className="hm-btn hm-btn-sm" href={`/career/competitions/${encodeURIComponent(formerComp)}`}>Tabellen →</Link>}
          </> : <EmptyState>Ingen tidigare klubb.</EmptyState>}
          <div className="game-section-heading"><h2>Runt ligan</h2></div>
          {front.leagueBriefs.length ? <ul>{front.leagueBriefs.map((b) => <li key={b.id}><Link href={b.href}><strong>{b.text}</strong><small>{b.detail}</small></Link></li>)}</ul> : <EmptyState>Inga ligaresultat ännu.</EmptyState>}
        </section>
      </div>
    </div>
  );
}
