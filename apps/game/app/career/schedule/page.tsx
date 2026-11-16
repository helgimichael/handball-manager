"use client";
// Arena Nights 231 -- WLD-06 C Calendar List View: the schedule is the
// calendar's "Lista" view (same view switch as /career/calendar, sharing its
// remembered Vecka/Månad choice), with the next match pinned, crests and
// outcome colours in an agenda grouped by month. WLD-06b B: filters are
// chips (time + competition, combinable, kept in the URL). WLD-06a A: the
// pre-season board -- open days until league kickoff as slots, booking in a
// drawer with the existing planner -- only exists in pre-season.
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ClubCrest from "@/components/ClubCrest";
import { ClubLink } from "@/components/entityLinks";
import { SectionScene } from "@/components/game/Secondary";
import { useWorkspaceState } from "@/components/game/WorkspaceMemory";
import { PreseasonPlanner } from "@/components/season/PreseasonPlanner";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { fixtureHref, matchReportHref } from "@/lib/career/fixtureRoutes";
import { getSeasonPhase } from "@/lib/career/preseason";
import type { CareerFixtureType } from "@/lib/career/types";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { filterRows, fixtureRows, groupByMonth, parseTypes, parseWhen, preseasonBoard, TYPE_CHIPS, typeCounts, WHEN_CHIPS, type FixtureRow, type When } from "@/lib/schedule/fixtureList";
import { useMoney } from "@/lib/settings/usePreferences";

const FIXTURE_TYPE_LABEL: Record<CareerFixtureType, string> = { LEAGUE: "Liga", CUP: "Cup", FRIENDLY: "Träningsmatch", PLAYOFF: "SM-slutspel", QUALIFIER: "Kval" };
const OUTCOME_LABEL = { W: "Vinst", D: "Oavgjort", L: "Förlust" } as const;
const EVENT_LABEL = { CAMP: "Läger", TRIP: "Träningsresa", TOURNAMENT: "Turnering" } as const;
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const fmtMonth = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("sv-SE", { month: "long", year: "numeric", timeZone: "UTC" });

export default function SchedulePage() { return <Suspense><Schedule /></Suspense>; }

function Schedule() {
  const router = useRouter();
  const params = useSearchParams();
  const { career } = useCareer();
  const money = useMoney();
  const club = getCareerClub(career);
  const [, setCalendarView] = useWorkspaceState<"WEEK" | "MONTH">("calendar.view", "WEEK");
  const when = parseWhen(params.get("when"));
  const types = parseTypes(params.get("type"));
  const [slot, setSlot] = useState<string | null>(null);
  const rows = useMemo(() => fixtureRows(career), [career]);
  const shown = useMemo(() => filterRows(rows, when, types), [rows, when, types]);
  const counts = useMemo(() => typeCounts(rows, when), [rows, when]);
  const board = useMemo(() => preseasonBoard(career), [career]);
  const preseason = getSeasonPhase(career) === "PRESEASON";
  const next = rows.find((r) => r.isNext);
  const played = rows.filter((r) => r.played).length;
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";
  const cash = career.clubEconomies?.[career.playerClubId]?.cashEur;

  function go(next: { when?: When; types?: CareerFixtureType[] }) {
    const q = new URLSearchParams();
    const w = next.when ?? when; if (w !== "ALL") q.set("when", w);
    const t = next.types ?? types; if (t.length) q.set("type", t.join(","));
    router.replace(q.toString() ? `/career/schedule?${q}` : "/career/schedule", { scroll: false });
  }
  const toCalendar = (v: "WEEK" | "MONTH") => { setCalendarView(v); router.push("/career/calendar"); };

  return (
    <div className="game-secondary-page sc-list">
      <SectionScene eyebrow={`${club.name} · ${career.seasonId}`} title="Schema" description={`Matcher & resultat — ${competitionName}, cuper, kval och träningsmatcher i kalenderns listvy.`} mark={<ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={72} />} actions={<Link className="hm-btn hm-btn-sm" href="/career/analysis/matches">Matchrapporter →</Link>}><div><strong>{played}</strong><small>spelade matcher</small></div><div><strong>{rows.length - played}</strong><small>matcher kvar</small></div></SectionScene>

      <div className="hm-cal-views" role="tablist" aria-label="Kalendervy">
        <button type="button" role="tab" aria-selected={false} onClick={() => toCalendar("WEEK")}>Vecka</button>
        <button type="button" role="tab" aria-selected={false} onClick={() => toCalendar("MONTH")}>Månad</button>
        <button type="button" role="tab" aria-selected={true}>Lista</button>
      </div>

      {preseason && board.length > 0 && (
        <section className="sc-preseason" aria-labelledby="sc-pre-h" data-drawer={slot ? "open" : undefined}>
          <div className="sc-board">
            <header><h2 id="sc-pre-h">Försäsongen</h2><p>Lediga dagar fram till ligastarten {career.leagueKickoffDate}. Välj en dag för att boka träningsmatch, läger, resa eller turnering{typeof cash === "number" ? ` · i kassan: ${money.format(cash)}` : ""}.</p></header>
            <ol className="sc-weeks">{board.map((w) => (
              <li key={w.weekStart}><span className="sc-week-label">Veckan {fmtDay(w.weekStart)}</span>
                <ol className="sc-days">{w.days.map((d) => (
                  <li key={d.date} data-free={d.free || undefined} data-selected={slot === d.date || undefined}>
                    {d.free ? <button type="button" aria-pressed={slot === d.date} onClick={() => setSlot(d.date)}><time>{fmtDay(d.date)}</time><span>Ledig · boka</span></button> : (
                      <div><time>{fmtDay(d.date)}</time>
                        {d.fixtures.map((f) => { const opp = getClub(f.homeClubId === club.id ? f.awayClubId : f.homeClubId); return <span key={f.id} data-kind={f.type}>{FIXTURE_TYPE_LABEL[f.type]}{opp ? ` · ${opp.shortName}` : ""}</span>; })}
                        {d.events.map((e) => <span key={e.id} data-kind={e.kind}>{EVENT_LABEL[e.kind]} · {e.location}</span>)}
                      </div>
                    )}
                  </li>
                ))}</ol>
              </li>
            ))}</ol>
          </div>
          {slot && (
            <aside className="sc-drawer" aria-label={`Boka ${slot}`}>
              <header><strong>Boka från {fmtDay(slot)}</strong><button type="button" className="hm-btn hm-btn-sm" onClick={() => setSlot(null)}>Stäng</button></header>
              <PreseasonPlanner key={slot} initialDate={slot} />
            </aside>
          )}
        </section>
      )}

      <div className="sc-chips" role="group" aria-label="Filter">
        <div className="sc-chip-row" role="radiogroup" aria-label="Tid">{WHEN_CHIPS.map((c) => <button key={c.id} type="button" role="radio" aria-checked={when === c.id} onClick={() => go({ when: c.id })}>{c.label}</button>)}</div>
        <div className="sc-chip-row" aria-label="Tävling">{TYPE_CHIPS.filter((c) => counts[c.id] > 0 || types.includes(c.id)).map((c) => <button key={c.id} type="button" aria-pressed={types.includes(c.id)} onClick={() => go({ types: types.includes(c.id) ? types.filter((t) => t !== c.id) : [...types, c.id] })}>{c.label} <span>{counts[c.id]}</span></button>)}{types.length > 0 && <button type="button" className="sc-chip-clear" onClick={() => go({ types: [] })}>Alla tävlingar</button>}</div>
      </div>

      {next && when !== "RESULTS" && (!types.length || types.includes(next.fixture.type)) && (
        <section className="sc-next" aria-label="Nästa match"><span className="xp-eyebrow">Nästa match</span><FixtureItem row={next} clubId={club.id} pinned onOpen={() => router.push("/career/match-preview")} /></section>
      )}

      {shown.length === 0 ? (
        <p className="hm-empty sc-empty">Inga matcher i den här vyn. {(when !== "ALL" || types.length > 0) && <button type="button" className="hm-btn hm-btn-sm" onClick={() => go({ when: "ALL", types: [] })}>Visa hela säsongen</button>}</p>
      ) : (
        <ol className="sc-agenda" aria-label="Matchprogram">{groupByMonth(shown.filter((r) => !(r.isNext && next && when !== "RESULTS"))).map((g) => (
          <li key={g.month}><h2 className="sc-month">{fmtMonth(g.month)}</h2>
            <ol>{g.rows.map((r) => <li key={r.fixture.id}><FixtureItem row={r} clubId={club.id} onOpen={() => router.push(r.played ? matchReportHref(r.fixture.id) : "/career/match-preview")} /></li>)}</ol>
          </li>
        ))}</ol>
      )}
    </div>
  );
}

function FixtureItem({ row, clubId, pinned = false, onOpen }: { row: FixtureRow; clubId: string; pinned?: boolean; onOpen: () => void }) {
  const f = row.fixture;
  const opp = getClub(row.opponentId);
  const own = getClub(clubId);
  return (
    <div className="sc-fixture" data-outcome={row.outcome} data-next={row.isNext || undefined} data-pinned={pinned || undefined} data-clickable={row.clickable || undefined} onClick={row.clickable ? onOpen : undefined}>
      <time className="sc-date"><b>{fmtDay(f.date)}</b>{f.kickoffTime && <small>{f.kickoffTime}</small>}</time>
      <div className="sc-teams">
        {pinned && own && <ClubCrest shortName={own.shortName} primaryColor={own.primaryColor} clubId={own.id} size={34} />}
        {opp && <ClubCrest shortName={opp.shortName} primaryColor={opp.primaryColor} clubId={opp.id} size={pinned ? 34 : 26} />}
        <div><span className="sc-opp">{opp ? <ClubLink clubId={opp.id} stopPropagation>{opp.name}</ClubLink> : row.opponentId}</span><small>{row.home ? "Hemma" : "Borta"} · <span className="sc-type" data-type={f.type}>{FIXTURE_TYPE_LABEL[f.type]}</span>{f.type === "LEAGUE" ? ` · omg ${f.round}` : ""}</small></div>
      </div>
      <div className="sc-result">{row.played ? <Link href={matchReportHref(f.id)} onClick={(e) => e.stopPropagation()}><b className="sc-score">{row.goalsFor}–{row.goalsAgainst}</b><small>{OUTCOME_LABEL[row.outcome!]}</small></Link> : <small>{row.isNext ? "Nästa match" : "Kommande"}</small>}</div>
      <div className="sc-go">{row.played ? <Link href={matchReportHref(f.id)} onClick={(e) => e.stopPropagation()}>Matchrapport →</Link> : row.isNext ? <><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/match-preview" onClick={(e) => e.stopPropagation()}>Förbered matchen →</Link><Link className="hm-btn hm-btn-sm" href="/career/tactics" onClick={(e) => e.stopPropagation()}>Uttagning →</Link></> : <Link href={fixtureHref(f.id)} onClick={(e) => e.stopPropagation()}>Förhandsvisa →</Link>}</div>
    </div>
  );
}
