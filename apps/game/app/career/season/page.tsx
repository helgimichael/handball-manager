"use client";
// HM-ALPHA3-M03: Säsongen -- the whole competitive season on one page:
// where the manager's club stands and what happens next, who goes up and
// down, both league tables with their zones, the SM-slutspel bracket, kval,
// Svenska cupen, important fixtures, awards and, once the season is
// decided, its Moment. Each competition carries its own identity
// (components/season/CompetitionMark.tsx).
import Link from "next/link";
import { MomentHero, EventCard } from "@/components/experience/Moment";
import { RouteLine, Stat } from "@/components/experience/primitives";
import { CourtBackdrop } from "@/components/experience/CourtBackdrop";
import { COURT_MOMENT_BACKDROP } from "@/components/experience/experienceAssets";
import { CompetitionMark, competitionKeyOf, competitionStyle, COMPETITION_IDENTITY, type CompetitionKey } from "@/components/season/CompetitionMark";
import { BracketGrid, Crest, TieCard, clubName as name, tieStatus } from "@/components/season/Knockout";
import { TROPHY_MOMENT_BACKDROP, TROPHY_STILL } from "@/components/season/seasonAssets";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { formatGameDate } from "@/lib/career/dateUtils";
import type { CareerState } from "@/lib/career/types";
import { ALLSVENSKAN, CUP_RULES, HANDBOLLSLIGAN, KVAL_ALLSVENSKAN, KVAL_HBL, LEAGUE_RULES, SHOOTOUT_ASSUMPTION, SM_SLUTSPEL, SM_SLUTSPEL_RULES, SVENSKA_CUPEN, ALLSVENSKAN_RULES, PLAYOFF_BONUS_PROVENANCE } from "@/lib/competition/rules";
import { competitionTable, hasLeagueCalendar } from "@/lib/competition/tables";
import { cupGroupTable } from "@/lib/competition/season";
import type { CompetitionTie } from "@/lib/competition/types";
import { svOrdinal } from "@/lib/format/ordinal";

type Zone = { zone: string; label: string };
const ZONES: Record<string, (pos: number) => Zone | null> = {
  [HANDBOLLSLIGAN]: (p) => (p <= 8 ? { zone: "playoff", label: "SM-slutspel" } : p === 14 ? { zone: "down", label: "Nedflyttning" } : p >= 11 ? { zone: "kval", label: "Kval" } : null),
  [ALLSVENSKAN]: (p) => (p === 1 ? { zone: "up", label: "Uppflyttning" } : p <= 4 ? { zone: "kval-up", label: "Kval uppåt" } : p >= 13 ? { zone: "down", label: "Nedflyttning" } : p >= 11 ? { zone: "kval", label: "Kval nedåt" } : null),
};
const LEAGUE_NAME = (id: string) => (id === HANDBOLLSLIGAN ? "Handbollsligan" : id === ALLSVENSKAN ? "Allsvenskan" : "Division 1");
const nextSeasonOf = (seasonId: string) => { const y = Number(seasonId.slice(0, 4)) + 1; return `${y}/${String((y + 1) % 100).padStart(2, "0")}`; };

function SectionHead({ competition, eyebrow, title, id, aside }: { competition: CompetitionKey; eyebrow: string; title: string; id: string; aside?: React.ReactNode }) {
  return (
    <header className="ss-section-head">
      <CompetitionMark competition={competition} size={44} />
      <div><span className="xp-eyebrow">{eyebrow}</span><h2 id={id}>{title}</h2></div>
      {aside}
    </header>
  );
}

export default function SeasonPage() {
  const { career } = useCareer();
  const outcome = career.seasonOutcome;
  const ties = Object.values(career.competitionTies ?? {});
  const me = career.playerClubId;
  const leagues = [HANDBOLLSLIGAN, ALLSVENSKAN].filter((c) => hasLeagueCalendar(career, c));
  const upcoming = career.fixtures.filter((f) => !career.results[f.id] && (f.homeClubId === me || f.awayClubId === me || f.stage)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const smTies = ties.filter((t) => t.competitionId === SM_SLUTSPEL);
  const kvalTies = ties.filter((t) => t.competitionId === KVAL_HBL || t.competitionId === KVAL_ALLSVENSKAN);
  const cupTies = ties.filter((t) => t.competitionId === SVENSKA_CUPEN);

  return (
    <div className="ss-page">
      <SeasonHero career={career} />
      {outcome?.phase === "COMPLETE" && <SeasonVerdict career={career} />}
      {outcome?.phase !== "COMPLETE" && <NextStep career={career} />}
      {outcome?.phase === "COMPLETE" && outcome.awards.length > 0 && <Awards career={career} />}

      <Movement career={career} leagues={leagues} />

      {smTies.length > 0 && (
        <section className="ss-section" data-comp="SM" style={competitionStyle("SM")} aria-labelledby="sm-title">
          <SectionHead competition="SM" eyebrow="Plats 1–8 i Handbollsligan · bäst av fem · högre placerat lag har hemmaplan i match 1, 3 och 5" title="SM-slutspel" id="sm-title" aside={<Champion tie={smTies.find((t) => t.key === "F")} label="Svenska mästare" />} />
          <BracketGrid career={career} ties={smTies} rounds={[["QF1", "QF2", "QF3", "QF4"], ["SF1", "SF2"], ["F"]]} roundLabels={["Kvartsfinal", "Semifinal", "Final"]} />
          <p className="ss-note">Siffran bredvid laget är vunna matcher. Resultaten under varje möte visas med det högre placerade laget först; <em>fl</em> = avgjord i förlängning, <em>str</em> = avgjord på straffkast.</p>
        </section>
      )}

      {kvalTies.length > 0 && (
        <section className="ss-section" data-comp="KVAL" style={competitionStyle("KVAL")} aria-labelledby="kval-title">
          <SectionHead competition="KVAL" eyebrow="Bäst av fem till Handbollsligan · bäst av tre till Allsvenskan" title="Kval" id="kval-title" />
          {[KVAL_HBL, KVAL_ALLSVENSKAN].map((c) => { const list = kvalTies.filter((t) => t.competitionId === c).sort((a, b) => a.key.localeCompare(b.key)); return list.length ? (
            <div key={c} className="ss-kval-group">
              <h3 className="ss-round-label">{c === KVAL_HBL ? "Om en plats i Handbollsligan" : "Om en plats i Allsvenskan"}</h3>
              <div className="ss-ties">{list.map((t) => <TieCard key={t.id} career={career} tie={t} />)}</div>
            </div>
          ) : null; })}
        </section>
      )}

      {cupTies.length > 0 && <Cup career={career} ties={cupTies} />}

      <section className="ss-section" data-comp="HBL" style={competitionStyle("HBL")} aria-labelledby="tables-title">
        <SectionHead competition={competitionKeyOf(career.competitionId)} eyebrow={`Grundserien · ${career.seasonId}`} title="Tabellerna" id="tables-title" />
        <div className="ss-tables">{leagues.map((c) => <LeagueTable key={c} career={career} competitionId={c} />)}</div>
        <p className="ss-note">Lika poäng skiljs åt på målskillnad, gjorda mål och sedan inbördes möten (TB §2:7). Zonerna följer SHF:s tävlingshandbok 2026/27.</p>
      </section>

      <section className="ss-section" aria-labelledby="next-title">
        <header className="ss-section-head"><div><span className="xp-eyebrow">Kommande</span><h2 id="next-title">Viktiga matcher</h2></div></header>
        {upcoming.length === 0 ? <p className="hm-text-muted">Inga fler matcher den här säsongen.</p> : (
          <ul className="ss-fixtures">{upcoming.map((f) => { const key = f.type === "PLAYOFF" ? "SM" : f.type === "QUALIFIER" ? "KVAL" : f.type === "CUP" ? "CUP" : competitionKeyOf(f.competitionId); return (
            <li key={f.id} data-own={f.homeClubId === me || f.awayClubId === me} style={competitionStyle(key)}>
              <time dateTime={f.date}>{formatGameDate(f.date)}</time>
              <span className="ss-fixture-teams"><Crest id={f.homeClubId} />{name(f.homeClubId)} – {name(f.awayClubId)}<Crest id={f.awayClubId} /></span>
              <span className="ss-comp-pill"><CompetitionMark competition={key} size={18} />{f.type === "PLAYOFF" ? `SM-slutspel · match ${f.stage?.game}` : f.type === "QUALIFIER" ? `Kval · match ${f.stage?.game}` : f.type === "CUP" ? "Svenska cupen" : LEAGUE_NAME(f.competitionId)}</span>
            </li>
          ); })}</ul>
        )}
      </section>

      <section className="ss-section ss-sources" aria-labelledby="rules-title">
        <header className="ss-section-head"><div><span className="xp-eyebrow">Regler och källor</span><h2 id="rules-title">Så avgörs säsongen</h2></div></header>
        <ul>
          <li><b>Verifierat:</b> 14 lag per serie, 2–1–0 poäng, tabellordning ({LEAGUE_RULES.tiebreakProvenance.verified ? LEAGUE_RULES.tiebreakProvenance.source : ""}). SM-slutspel för plats 1–8, alla omgångar bäst av fem ({SM_SLUTSPEL_RULES.provenance.verified ? SM_SLUTSPEL_RULES.provenance.source : ""}). Kval och uppflyttning enligt tävlingshandboken §3:3. Oavgjort i slutspel och kval: 2×5 min förlängning två gånger, sedan straffkastning (THB §2:13).</li>
          <li><b>Antaganden:</b> {SHOOTOUT_ASSUMPTION.verified ? "" : SHOOTOUT_ASSUMPTION.assumption} {ALLSVENSKAN_RULES.division1Assumption.verified ? "" : ALLSVENSKAN_RULES.division1Assumption.assumption} {CUP_RULES.assumptions.verified ? "" : CUP_RULES.assumptions.assumption} {PLAYOFF_BONUS_PROVENANCE.verified ? "" : PLAYOFF_BONUS_PROVENANCE.assumption}</li>
        </ul>
      </section>
    </div>
  );
}

function Champion({ tie, label }: { tie?: CompetitionTie; label: string }) {
  if (!tie?.winnerClubId) return null;
  return <span className="ss-champion" style={{ backgroundImage: `url(${TROPHY_STILL})` }}><Crest id={tie.winnerClubId} size={30} /><span><small>{label}</small>{name(tie.winnerClubId)}</span></span>;
}

function myOpenTie(career: CareerState) {
  const me = career.playerClubId;
  const mine = Object.values(career.competitionTies ?? {}).filter((t) => t.competitionId !== SVENSKA_CUPEN && (t.highClubId === me || t.lowClubId === me));
  return { open: mine.find((t) => !t.winnerClubId), last: mine.filter((t) => t.winnerClubId).sort((a, b) => b.fixtureIds.length - a.fixtureIds.length).at(-1), all: mine };
}

function SeasonHero({ career }: { career: CareerState }) {
  const o = career.seasonOutcome;
  const me = career.playerClubId;
  const table = competitionTable(career, career.competitionId);
  const position = table.findIndex((r) => r.clubId === me) + 1;
  const row = table.find((r) => r.clubId === me);
  const left = career.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === career.competitionId && !career.results[f.id] && (f.homeClubId === me || f.awayClubId === me)).length;
  const { open } = myOpenTie(career);
  if (o?.phase === "COMPLETE") {
    const champion = o.champion === me, cup = o.cupWinner === me, up = o.promoted.includes(me), down = o.relegated.includes(me);
    const kind = champion || cup ? "CHAMPIONSHIP" : up ? "PROMOTION" : down ? "RELEGATION" : "SEASON_ACHIEVEMENT";
    const headline = champion ? `${name(me)} är svenska mästare` : cup ? `${name(me)} vann Svenska cupen` : up ? `${name(me)} är uppflyttade` : down ? `${name(me)} åker ur` : `Säsongen ${career.seasonId} är avgjord`;
    const lede = `SM-guld: ${name(o.champion)}${o.runnerUp ? ` efter final mot ${name(o.runnerUp)}` : ""}. ${o.cupWinner ? `Svenska cupen: ${name(o.cupWinner)}. ` : ""}${position ? `${name(me)} slutade ${svOrdinal(position)} i grundserien.` : ""}`;
    const nextLeague = o.nextMembership[me];
    return (
      <MomentHero kind={kind} backdrop={{ kind: "photo", style: kind === "CHAMPIONSHIP" || kind === "SEASON_ACHIEVEMENT" ? TROPHY_MOMENT_BACKDROP : COURT_MOMENT_BACKDROP }} tags={[`Säsongen ${career.seasonId}`]} stamp={champion ? "Guld" : cup ? "Cupen" : up ? "Upp" : down ? "Ned" : null} headline={headline} lede={lede}>
        <RouteLine items={[<Crest key="me" id={me} size={52} />, <span key="next" className="ss-route-next">{nextLeague ? `${LEAGUE_NAME(nextLeague)} ${nextSeasonOf(career.seasonId)}` : nextSeasonOf(career.seasonId)}</span>]} caption="Nästa säsong startar från Hem" />
      </MomentHero>
    );
  }
  const myComp = competitionKeyOf(career.competitionId);
  return (
    <header className="xp-band ss-band" data-tone={o?.phase === "POSTSEASON" ? "gold" : "ink"}>
      <CourtBackdrop />
      <div>
        <span className="xp-eyebrow">{o?.phase === "POSTSEASON" ? "Slutspel och kval" : `Grundserien · ${COMPETITION_IDENTITY[myComp].name}`} · {career.seasonId}</span>
        <h1>Säsongen</h1>
        <p>{o?.phase === "POSTSEASON" ? "Grundserien är spelad. Slutspel och kval avgör resten av säsongen." : `${left} seriematcher kvar för ${name(me)}.`}</p>
      </div>
      <div className="ss-band-stats">
        <Stat label="Placering" value={position ? `${svOrdinal(position)}` : "—"} note={ZONES[career.competitionId]?.(position)?.label ?? "Mittfältet"} />
        <Stat label="Poäng" value={row?.points ?? 0} note={`${row?.played ?? 0} matcher · ${row ? (row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference) : 0} i målskillnad`} />
        {open ? <Stat label={open.label} value={tieStatus(career, open).tone === "todo" ? "Snart" : "Pågår"} note={COMPETITION_IDENTITY[competitionKeyOf(open.competitionId)].name} /> : <Stat label="Seriematcher kvar" value={left} note={o?.phase === "POSTSEASON" ? "Grundserien klar" : "i grundserien"} />}
      </div>
    </header>
  );
}

/** "What happens next" for the manager's club, in one panel. */
function NextStep({ career }: { career: CareerState }) {
  const me = career.playerClubId;
  const o = career.seasonOutcome;
  const ties = Object.values(career.competitionTies ?? {});
  const { open, all } = myOpenTie(career);
  let title: string, body: React.ReactNode, comp: CompetitionKey = competitionKeyOf(career.competitionId), tone: "go" | "risk" | "out" | "neutral" = "neutral";
  if (open) {
    comp = competitionKeyOf(open.competitionId);
    const status = tieStatus(career, open);
    const opponent = open.highClubId === me ? open.lowClubId : open.highClubId;
    let then = "";
    if (open.feeds) {
      const sibling = ties.find((t) => t.competitionId === open.competitionId && t.feeds?.tieKey === open.feeds!.tieKey && t.id !== open.id);
      const roundName = open.feeds.tieKey === "F" ? "finalen" : "semifinalen";
      then = `Vinner ni möter ni ${sibling?.winnerClubId ? name(sibling.winnerClubId) : sibling ? `vinnaren av ${name(sibling.highClubId)}–${name(sibling.lowClubId)}` : "en ännu okänd motståndare"} i ${roundName}.`;
    } else if (open.stakes) {
      const mineIsHigh = open.highClubId === me;
      const myLeague = mineIsHigh ? open.stakes.highCompetitionId : open.stakes.lowCompetitionId;
      const otherLeague = mineIsHigh ? open.stakes.lowCompetitionId : open.stakes.highCompetitionId;
      then = `Vinner ni spelar ni i ${LEAGUE_NAME(mineIsHigh ? myLeague : otherLeague)} ${nextSeasonOf(career.seasonId)}. Förlorar ni spelar ni i ${LEAGUE_NAME(mineIsHigh ? otherLeague : myLeague)}.`;
      tone = mineIsHigh ? "risk" : "go";
    } else if (open.key === "F") {
      then = "Vinnaren blir svenska mästare.";
      tone = "go";
    }
    title = `${open.label} mot ${name(opponent)}`;
    body = <><p className="ss-next-status" data-tone={status.tone}>{status.text}</p>{then && <p>{then}</p>}</>;
    if (tone === "neutral") tone = "go";
  } else if (o?.phase === "POSTSEASON") {
    const lost = all.find((t) => t.loserClubId === me);
    title = lost ? `Utslagna i ${lost.label.toLowerCase()}` : "Säsongen är klar för er";
    body = <p>{lost ? `${name(lost.winnerClubId)} vann mötet. ` : ""}Slutspel och kval spelas klart utan er. Ekonomi, trupp och personal kan förberedas för {nextSeasonOf(career.seasonId)}.</p>;
    tone = lost ? "out" : "neutral";
    if (lost) comp = competitionKeyOf(lost.competitionId);
  } else {
    const table = competitionTable(career, career.competitionId);
    const pos = table.findIndex((r) => r.clubId === me) + 1;
    const pts = table[pos - 1]?.points ?? 0;
    const lines: string[] = [];
    if (career.competitionId === HANDBOLLSLIGAN) {
      lines.push(pos <= 8 ? `${pts - (table[8]?.points ?? 0)} poäng ner till plats 9 (utanför slutspel).` : `${(table[7]?.points ?? 0) - pts} poäng upp till plats 8 och SM-slutspel.`);
      if (pos >= 9) lines.push(pos >= 11 ? `${pts - (table[13]?.points ?? 0)} poäng ner till direkt nedflyttning.` : `${pts - (table[10]?.points ?? 0)} poäng ner till kvalplats (11).`);
      tone = pos <= 8 ? "go" : pos >= 11 ? "risk" : "neutral";
    } else if (career.competitionId === ALLSVENSKAN) {
      lines.push(pos === 1 ? `${pts - (table[1]?.points ?? 0)} poäng före tvåan -- etta går direkt upp.` : pos <= 4 ? `Kvalplats uppåt. ${(table[0]?.points ?? 0) - pts} poäng upp till direkt uppflyttning.` : `${(table[3]?.points ?? 0) - pts} poäng upp till kvalplats (4).`);
      if (pos >= 11) lines.push(pos >= 13 ? "Direkt nedflyttningsplats." : "Kvalplats nedåt.");
      tone = pos <= 4 ? "go" : pos >= 11 ? "risk" : "neutral";
    }
    title = `${svOrdinal(pos)} i ${LEAGUE_NAME(career.competitionId)}`;
    body = <>{lines.map((l) => <p key={l}>{l}</p>)}</>;
  }
  return (
    <section className="ss-next" data-tone={tone} style={competitionStyle(comp)} aria-labelledby="nextstep-title">
      <CompetitionMark competition={comp} size={52} />
      <div>
        <span className="xp-eyebrow">Vad händer nu</span>
        <h2 id="nextstep-title">{title}</h2>
        {body}
      </div>
    </section>
  );
}

/** Promotion and relegation: confirmed moves, moves still decided in kval and, during the regular season, the current projection. */
function Movement({ career, leagues }: { career: CareerState; leagues: string[] }) {
  const o = career.seasonOutcome;
  if (!o || leagues.length === 0) return null;
  const projection = o.phase === "REGULAR";
  const pending = Object.values(career.competitionTies ?? {}).filter((t) => (t.competitionId === KVAL_HBL || t.competitionId === KVAL_ALLSVENSKAN) && !t.winnerClubId);
  const below = (league: string) => (league === HANDBOLLSLIGAN ? "Allsvenskan" : "Division 1");
  const columns = leagues.map((league) => {
    const table = competitionTable(career, league);
    const zone = ZONES[league]!;
    const inTable = (id: string) => table.some((r) => r.clubId === id);
    const byZone = (...zones: string[]) => table.filter((_, i) => zones.includes(zone(i + 1)?.zone ?? "")).map((r) => r.clubId);
    if (projection) return { league, up: byZone("up"), down: byZone("down"), kval: byZone("kval-up", "kval"), arriving: [] as string[], ties: [] as CompetitionTie[] };
    return {
      league,
      up: o.promoted.filter(inTable),
      down: o.relegated.filter(inTable),
      kval: [] as string[],
      arriving: [...o.promoted, ...o.relegated].filter((id) => o.nextMembership[id] === league && !inTable(id)),
      ties: pending.filter((t) => t.stakes?.highCompetitionId === league),
    };
  });
  return (
    <section className="ss-section ss-movement" aria-labelledby="movement-title">
      <header className="ss-section-head"><div><span className="xp-eyebrow">{projection ? "Om serien slutade i dag · prognos" : o.phase === "POSTSEASON" ? "Klart och fortfarande öppet" : `Inför ${nextSeasonOf(career.seasonId)}`}</span><h2 id="movement-title">Upp och ned</h2></div></header>
      <div className="ss-movement-grid">
        {columns.map((c) => (
          <div key={c.league} className="ss-movement-col" style={competitionStyle(competitionKeyOf(c.league))}>
            <h3><CompetitionMark competition={competitionKeyOf(c.league)} size={24} />{LEAGUE_NAME(c.league)}</h3>
            <MoveList dir="up" title={projection ? "Direkt upp" : "Upp till Handbollsligan"} ids={c.up} />
            <MoveList dir="down" title={projection ? "Direkt ned" : `Ned till ${below(c.league)}`} ids={c.down} />
            <MoveList dir="kval" title="Kvalplatser" ids={c.kval} />
            <MoveList dir="in" title={`Nya i ${LEAGUE_NAME(c.league)}`} ids={c.arriving} />
            {c.ties.length > 0 && <div className="ss-move" data-dir="kval"><h4><span aria-hidden="true">◆</span>Avgörs i kval</h4><ul>{c.ties.map((t) => <li key={t.id}><Crest id={t.highClubId} size={18} />{name(t.highClubId)} – {name(t.lowClubId)}<Crest id={t.lowClubId} size={18} /><small>{tieStatus(career, t).text}</small></li>)}</ul></div>}
            {c.up.length + c.down.length + c.kval.length + c.arriving.length + c.ties.length === 0 && <p className="ss-note">Inget avgjort än.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function MoveList({ dir, title, ids }: { dir: "up" | "down" | "kval" | "in"; title: string; ids: string[] }) {
  if (ids.length === 0) return null;
  return <div className="ss-move" data-dir={dir}><h4><span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : dir === "in" ? "●" : "◆"}</span>{title}</h4><ul>{ids.map((id) => <li key={id}><Crest id={id} size={18} />{name(id)}</li>)}</ul></div>;
}

/** Season-end facit: the titles and the movements, in one band under the Moment. */
function SeasonVerdict({ career }: { career: CareerState }) {
  const o = career.seasonOutcome!;
  const items: { comp: CompetitionKey; label: string; club?: string }[] = [
    { comp: "SM", label: "Svenska mästare", club: o.champion },
    { comp: "SM", label: "Finalförlorare", club: o.runnerUp },
    { comp: "CUP", label: "Svenska cupen", club: o.cupWinner },
    ...Object.entries(o.regularSeasonWinners).map(([c, club]) => ({ comp: competitionKeyOf(c), label: `Seriesegrare ${LEAGUE_NAME(c)}`, club })),
  ];
  return (
    <section className="ss-verdict" aria-label="Säsongens facit">
      {items.filter((i) => i.club).map((i) => (
        <div key={i.label} className="ss-verdict-item" data-mine={i.club === career.playerClubId} style={competitionStyle(i.comp)}>
          <CompetitionMark competition={i.comp} size={30} />
          <span><small>{i.label}</small><b>{name(i.club)}</b></span>
          <Crest id={i.club} size={34} />
        </div>
      ))}
    </section>
  );
}

function LeagueTable({ career, competitionId }: { career: CareerState; competitionId: string }) {
  const table = competitionTable(career, competitionId);
  const zoneOf = ZONES[competitionId];
  const key = competitionKeyOf(competitionId);
  return (
    <div className="ss-table-wrap" style={competitionStyle(key)}>
      <h3><CompetitionMark competition={key} size={24} />{LEAGUE_NAME(competitionId)}</h3>
      <table className="hm-table ss-table">
        <thead><tr><th>#</th><th>Lag</th><th className="hm-table-num">M</th><th className="hm-table-num">+/−</th><th className="hm-table-num">P</th></tr></thead>
        <tbody>{table.map((r, i) => { const z = zoneOf?.(i + 1); const nz = zoneOf?.(i + 2); return <tr key={r.clubId} data-zone={z?.zone} data-own={r.clubId === career.playerClubId} data-cut={!!nz && nz.zone !== z?.zone || (!nz && !!z && i < table.length - 1)}><td title={z?.label}>{i + 1}</td><td><Link href={`/career/clubs/${encodeURIComponent(r.clubId)}`} className="ss-club"><Crest id={r.clubId} />{name(r.clubId)}</Link></td><td className="hm-table-num">{r.played}</td><td className="hm-table-num">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td><td className="hm-table-num"><b>{r.points}</b></td></tr>; })}</tbody>
      </table>
      <ul className="ss-legend">{competitionId === HANDBOLLSLIGAN ? <><li data-zone="playoff">1–8 SM-slutspel</li><li data-zone="kval">11–13 Kval</li><li data-zone="down">14 Nedflyttning</li></> : <><li data-zone="up">1 Uppflyttning</li><li data-zone="kval-up">2–4 Kval uppåt</li><li data-zone="kval">11–12 Kval nedåt</li><li data-zone="down">13–14 Nedflyttning</li></>}</ul>
    </div>
  );
}

function Cup({ career, ties }: { career: CareerState; ties: CompetitionTie[] }) {
  const groups = ties.filter((t) => t.stage === "CUP_GROUP").sort((a, b) => a.key.localeCompare(b.key));
  const byKey = (k: string) => ties.find((t) => t.key === k);
  const me = career.playerClubId;
  const myGroup = groups.find((g) => g.clubIds?.includes(me));
  return (
    <section className="ss-section" data-comp="CUP" style={competitionStyle("CUP")} aria-labelledby="cup-title">
      <SectionHead competition="CUP" eyebrow="32 lag · gruppspel · dubbelmöten · Final4" title="Svenska cupen" id="cup-title" aside={<Champion tie={byKey("CF")} label="Cupvinnare" />} />
      <ol className="ss-cup-path" aria-label="Cupens steg">
        {[["Gruppspel", "8 grupper · topp 2 vidare", groups.length > 0], ["Åttondelsfinal", "dubbelmöte", !!byKey("R16-1")], ["Kvartsfinal", "dubbelmöte", !!byKey("CQF-1")], ["Final4", "semifinal och final", !!byKey("CSF-1")]].map(([label, detail, reached], i) => <li key={i} data-reached={reached as boolean}><b>{label as string}</b><small>{detail as string}</small></li>)}
      </ol>
      <div className="ss-groups">{groups.map((g) => (
        <div key={g.id} className="ss-group" data-mine={g === myGroup}>
          <h3>{g.label}</h3>
          <table className="hm-table ss-table"><thead><tr><th>#</th><th>Lag</th><th className="hm-table-num">M</th><th className="hm-table-num">P</th></tr></thead>
            <tbody>{cupGroupTable(career, g).map((r, i) => <tr key={r.clubId} data-zone={i < 2 ? "playoff" : undefined} data-own={r.clubId === me} data-cut={i === 1}><td>{i + 1}</td><td><span className="ss-club"><Crest id={r.clubId} size={18} />{name(r.clubId)}</span></td><td className="hm-table-num">{r.played}</td><td className="hm-table-num"><b>{r.points}</b></td></tr>)}</tbody>
          </table>
        </div>
      ))}</div>
      <p className="ss-note">Grön markering: vidare till åttondelsfinal. Dubbelmöten avgörs på sammanlagt antal mål; är det lika efter returen avgör straffkast direkt, utan förlängning.</p>
      {byKey("R16-1") && <BracketGrid career={career} ties={ties} rounds={[[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `R16-${n}`), [1, 2, 3, 4].map((n) => `CQF-${n}`), ["CSF-1", "CSF-2"], ["CF"]]} roundLabels={["Åttondelsfinal", "Kvartsfinal", "Final4 · semifinal", "Final"]} extra={{ label: "Match om tredjepris", key: "C3" }} />}
    </section>
  );
}

function Awards({ career }: { career: CareerState }) {
  const awards = career.seasonOutcome!.awards;
  const featured = awards.filter((a) => a.id !== "ALL_STAR");
  const allStars = awards.filter((a) => a.id === "ALL_STAR");
  const leagues = [...new Set(featured.map((a) => a.competitionId))];
  return (
    <section className="ss-section" aria-labelledby="awards-title">
      <header className="ss-section-head"><div><span className="xp-eyebrow">Säsongens utmärkelser</span><h2 id="awards-title">Galan</h2></div></header>
      {leagues.map((league) => (
        <div key={league} className="ss-awards-league" style={competitionStyle(competitionKeyOf(league))}>
          <h3 className="ss-round-label"><CompetitionMark competition={competitionKeyOf(league)} size={22} />{LEAGUE_NAME(league)}</h3>
          <div className="ss-awards">{featured.filter((a) => a.competitionId === league).map((a) => { const p = getCareerPlayer(career, a.playerId); return (
            <EventCard key={`${a.id}-${a.competitionId}`} kind="SEASON_ACHIEVEMENT" eyebrow={a.label} title={p ? <Link href={`/career/squad/${encodeURIComponent(a.playerId)}`}>{p.firstName} {p.lastName}</Link> : a.playerId} media={<Crest id={a.clubId} size={44} />}>
              <span className="ss-award-value">{a.value}</span> · {name(a.clubId)}
            </EventCard>
          ); })}</div>
          {allStars.some((a) => a.competitionId === league) && <p className="ss-allstar"><b>All star-laget:</b> {allStars.filter((a) => a.competitionId === league).map((a) => { const p = getCareerPlayer(career, a.playerId); return `${a.position ? `${a.position} ` : ""}${p ? `${p.firstName} ${p.lastName}` : a.playerId}`; }).join(" · ")}</p>}
        </div>
      ))}
      <p className="ss-note">Prispengar för titlar och placeringar bokförs i Ekonomi under Prispengar. <Link href="/career/finance?tab=ledger">Till huvudboken →</Link></p>
    </section>
  );
}

