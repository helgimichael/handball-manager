"use client";
// HM-ALPHA3-M03: Säsongen -- the whole competitive season on one page:
// both league tables with their promotion/kval/relegation zones, the
// SM-slutspel bracket, kval, Svenska cupen, important fixtures, awards
// and, once the season is decided, its Moment.
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import { MomentHero, EventCard } from "@/components/experience/Moment";
import { RouteLine, Stat } from "@/components/experience/primitives";
import { CourtBackdrop } from "@/components/experience/CourtBackdrop";
import { COURT_MOMENT_BACKDROP } from "@/components/experience/experienceAssets";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import type { CareerState } from "@/lib/career/types";
import { getClub } from "@/lib/game-data";
import { ALLSVENSKAN, CUP_RULES, HANDBOLLSLIGAN, KVAL_ALLSVENSKAN, KVAL_HBL, LEAGUE_RULES, SHOOTOUT_ASSUMPTION, SM_SLUTSPEL, SM_SLUTSPEL_RULES, SVENSKA_CUPEN, ALLSVENSKAN_RULES, PLAYOFF_BONUS_PROVENANCE } from "@/lib/competition/rules";
import { competitionTable, hasLeagueCalendar } from "@/lib/competition/tables";
import { cupGroupTable, tieWins } from "@/lib/competition/season";
import type { CompetitionTie } from "@/lib/competition/types";

const ZONES: Record<string, (pos: number) => { zone: string; label: string } | null> = {
  [HANDBOLLSLIGAN]: (p) => (p <= 8 ? { zone: "playoff", label: "SM-slutspel" } : p === 14 ? { zone: "down", label: "Nedflyttning" } : p >= 11 ? { zone: "kval", label: "Kval" } : null),
  [ALLSVENSKAN]: (p) => (p === 1 ? { zone: "up", label: "Uppflyttning" } : p <= 4 ? { zone: "kval-up", label: "Kval uppåt" } : p >= 13 ? { zone: "down", label: "Nedflyttning" } : p >= 11 ? { zone: "kval", label: "Kval nedåt" } : null),
};

const name = (id?: string) => (id ? getClub(id)?.shortName ?? id : "—");

function Crest({ id, size = 22 }: { id?: string; size?: number }) {
  const c = id ? getClub(id) : undefined;
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={size} /> : <span className="ss-crest-empty" />;
}

export default function SeasonPage() {
  const { career } = useCareer();
  const outcome = career.seasonOutcome;
  const ties = Object.values(career.competitionTies ?? {});
  const me = career.playerClubId;
  const leagues = [HANDBOLLSLIGAN, ALLSVENSKAN].filter((c) => hasLeagueCalendar(career, c));
  const upcoming = career.fixtures.filter((f) => !career.results[f.id] && (f.homeClubId === me || f.awayClubId === me || f.stage)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  return (
    <div className="ss-page">
      <SeasonHero career={career} />

      {outcome?.phase === "COMPLETE" && outcome.awards.length > 0 && <Awards career={career} />}

      <section className="ss-section" aria-labelledby="tables-title">
        <header className="ss-section-head"><span className="xp-eyebrow">Grundserien · {career.seasonId}</span><h2 id="tables-title">Tabellerna</h2></header>
        <div className="ss-tables">{leagues.map((c) => <LeagueTable key={c} career={career} competitionId={c} />)}</div>
        <p className="ss-note">Lika poäng skiljs åt på målskillnad, gjorda mål och sedan inbördes möten (TB §2:7). Zonerna följer SHF:s tävlingshandbok 2026/27.</p>
      </section>

      {ties.some((t) => t.competitionId === SM_SLUTSPEL) && <Bracket career={career} title="SM-slutspel" competitionId={SM_SLUTSPEL} rounds={[["QF1", "QF2", "QF3", "QF4"], ["SF1", "SF2"], ["F"]]} roundLabels={["Kvartsfinal", "Semifinal", "Final"]} />}

      {ties.some((t) => t.competitionId === KVAL_HBL || t.competitionId === KVAL_ALLSVENSKAN) && (
        <section className="ss-section" aria-labelledby="kval-title">
          <header className="ss-section-head"><span className="xp-eyebrow">Bäst av fem till Handbollsligan · bäst av tre till Allsvenskan</span><h2 id="kval-title">Kval</h2></header>
          <div className="ss-ties">{ties.filter((t) => t.competitionId === KVAL_HBL || t.competitionId === KVAL_ALLSVENSKAN).sort((a, b) => a.key.localeCompare(b.key)).map((t) => <TieCard key={t.id} career={career} tie={t} />)}</div>
        </section>
      )}

      {ties.some((t) => t.competitionId === SVENSKA_CUPEN) && <Cup career={career} ties={ties.filter((t) => t.competitionId === SVENSKA_CUPEN)} />}

      <section className="ss-section" aria-labelledby="next-title">
        <header className="ss-section-head"><span className="xp-eyebrow">Kommande</span><h2 id="next-title">Viktiga matcher</h2></header>
        {upcoming.length === 0 ? <p className="hm-text-muted">Inga fler matcher den här säsongen.</p> : (
          <ul className="ss-fixtures">{upcoming.map((f) => <li key={f.id} data-own={f.homeClubId === me || f.awayClubId === me}><time>{f.date}</time><span className="ss-fixture-teams"><Crest id={f.homeClubId} />{name(f.homeClubId)} – {name(f.awayClubId)}<Crest id={f.awayClubId} /></span><span className="tc-pill" data-tone={f.stage ? "move" : undefined}>{f.type === "PLAYOFF" ? `SM-slutspel · match ${f.stage?.game}` : f.type === "QUALIFIER" ? `Kval · match ${f.stage?.game}` : f.type === "CUP" ? "Svenska cupen" : "Serie"}</span></li>)}</ul>
        )}
      </section>

      <section className="ss-section ss-sources" aria-labelledby="rules-title">
        <header className="ss-section-head"><span className="xp-eyebrow">Regler och källor</span><h2 id="rules-title">Så avgörs säsongen</h2></header>
        <ul>
          <li><b>Verifierat:</b> 14 lag per serie, 2–1–0 poäng, tabellordning ({LEAGUE_RULES.tiebreakProvenance.verified ? LEAGUE_RULES.tiebreakProvenance.source : ""}). SM-slutspel för plats 1–8, alla omgångar bäst av fem ({SM_SLUTSPEL_RULES.provenance.verified ? SM_SLUTSPEL_RULES.provenance.source : ""}). Kval och uppflyttning enligt tävlingshandboken §3:3. Oavgjort i slutspel och kval: 2×5 min förlängning två gånger, sedan straffkastning (THB §2:13).</li>
          <li><b>Antaganden:</b> {SHOOTOUT_ASSUMPTION.verified ? "" : SHOOTOUT_ASSUMPTION.assumption} {ALLSVENSKAN_RULES.division1Assumption.verified ? "" : ALLSVENSKAN_RULES.division1Assumption.assumption} {CUP_RULES.assumptions.verified ? "" : CUP_RULES.assumptions.assumption} {PLAYOFF_BONUS_PROVENANCE.verified ? "" : PLAYOFF_BONUS_PROVENANCE.assumption}</li>
        </ul>
      </section>
    </div>
  );
}

function SeasonHero({ career }: { career: CareerState }) {
  const o = career.seasonOutcome;
  const me = career.playerClubId;
  const table = competitionTable(career, career.competitionId);
  const position = table.findIndex((r) => r.clubId === me) + 1;
  const left = career.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === career.competitionId && !career.results[f.id] && (f.homeClubId === me || f.awayClubId === me)).length;
  const myTie = Object.values(career.competitionTies ?? {}).filter((t) => t.competitionId !== SVENSKA_CUPEN && (t.highClubId === me || t.lowClubId === me)).sort((a, b) => (a.winnerClubId ? 1 : 0) - (b.winnerClubId ? 1 : 0))[0];
  if (o?.phase === "COMPLETE") {
    const champion = o.champion === me, cup = o.cupWinner === me, up = o.promoted.includes(me), down = o.relegated.includes(me);
    const kind = champion || cup ? "CHAMPIONSHIP" : up ? "PROMOTION" : down ? "RELEGATION" : "SEASON_ACHIEVEMENT";
    const headline = champion ? `${name(me)} är svenska mästare` : cup ? `${name(me)} vann Svenska cupen` : up ? `${name(me)} är uppflyttade` : down ? `${name(me)} åker ur` : `Säsongen ${career.seasonId} är avgjord`;
    const lede = `SM-guld: ${name(o.champion)}${o.runnerUp ? ` efter final mot ${name(o.runnerUp)}` : ""}. ${o.cupWinner ? `Svenska cupen: ${name(o.cupWinner)}. ` : ""}${position ? `${name(me)} slutade ${position}:a i grundserien.` : ""}`;
    return (
      <MomentHero kind={kind} backdrop={{ kind: "photo", style: COURT_MOMENT_BACKDROP }} tags={[`Säsongen ${career.seasonId}`]} stamp={champion ? "Guld" : cup ? "Cupen" : up ? "Upp" : down ? "Ned" : null} headline={headline} lede={lede}>
        <RouteLine items={[<Crest key="me" id={me} size={52} />]} caption={kind === "SEASON_ACHIEVEMENT" ? "Börja nästa säsong från Hem" : "Säsongens avslut"} />
      </MomentHero>
    );
  }
  return (
    <header className="xp-band ss-band" data-tone={o?.phase === "POSTSEASON" ? "gold" : "ink"}>
      <CourtBackdrop />
      <div>
        <span className="xp-eyebrow">{o?.phase === "POSTSEASON" ? "Slutspel och kval" : "Grundserien"} · {career.seasonId}</span>
        <h1>Säsongen</h1>
        <p>{o?.phase === "POSTSEASON" ? (myTie && !myTie.winnerClubId ? `${myTie.label}: ${name(myTie.highClubId)} mot ${name(myTie.lowClubId)}.` : "Grundserien är spelad. Slutspel och kval avgör resten av säsongen.") : `${left} seriematcher kvar. Plats 1–8 i Handbollsligan går till SM-slutspel.`}</p>
      </div>
      <div className="ss-band-stats">
        <Stat label="Placering" value={position ? `${position}:a` : "—"} note={getClub(me)?.shortName} />
        <Stat label="Poäng" value={table.find((r) => r.clubId === me)?.points ?? 0} note={`${table.find((r) => r.clubId === me)?.played ?? 0} matcher`} />
        {myTie && <Stat label={myTie.label} value={(() => { const w = tieWins(career, myTie); return `${w[me] ?? 0}–${w[myTie.highClubId === me ? myTie.lowClubId : myTie.highClubId] ?? 0}`; })()} note={myTie.winnerClubId ? (myTie.winnerClubId === me ? "Vunnen" : "Förlorad") : "Pågår"} />}
      </div>
    </header>
  );
}

function LeagueTable({ career, competitionId }: { career: CareerState; competitionId: string }) {
  const table = competitionTable(career, competitionId);
  const zoneOf = ZONES[competitionId];
  return (
    <div className="ss-table-wrap">
      <h3>{competitionId === HANDBOLLSLIGAN ? "Handbollsligan" : "Allsvenskan"}</h3>
      <table className="hm-table ss-table">
        <thead><tr><th>#</th><th>Lag</th><th className="hm-table-num">M</th><th className="hm-table-num">+/−</th><th className="hm-table-num">P</th></tr></thead>
        <tbody>{table.map((r, i) => { const z = zoneOf?.(i + 1); return <tr key={r.clubId} data-zone={z?.zone} data-own={r.clubId === career.playerClubId}><td title={z?.label}>{i + 1}</td><td><Link href={`/career/clubs/${encodeURIComponent(r.clubId)}`} className="ss-club"><Crest id={r.clubId} />{name(r.clubId)}</Link></td><td className="hm-table-num">{r.played}</td><td className="hm-table-num">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td><td className="hm-table-num"><b>{r.points}</b></td></tr>; })}</tbody>
      </table>
      <ul className="ss-legend">{competitionId === HANDBOLLSLIGAN ? <><li data-zone="playoff">SM-slutspel</li><li data-zone="kval">Kval</li><li data-zone="down">Nedflyttning</li></> : <><li data-zone="up">Uppflyttning</li><li data-zone="kval-up">Kval uppåt</li><li data-zone="kval">Kval nedåt</li><li data-zone="down">Nedflyttning</li></>}</ul>
    </div>
  );
}

function TieCard({ career, tie }: { career: CareerState; tie?: CompetitionTie }) {
  if (!tie) return <div className="ss-tie" data-empty="true"><span>Avgörs senare</span></div>;
  const wins = tieWins(career, tie);
  const games = tie.fixtureIds.map((id) => ({ id, f: career.fixtures.find((x) => x.id === id), r: career.results[id] }));
  const aggregate = (club: string) => games.reduce((s, g) => s + (g.r ? (g.r.homeClubId === club ? g.r.homeGoals : g.r.awayGoals) : 0), 0);
  const score = (club: string) => (tie.format.kind === "SERIES" ? wins[club] ?? 0 : tie.format.kind === "TWO_LEGS" ? aggregate(club) : games[0]?.r ? (games[0].r.homeClubId === club ? games[0].r.homeGoals : games[0].r.awayGoals) : "–");
  const own = tie.highClubId === career.playerClubId || tie.lowClubId === career.playerClubId;
  return (
    <article className="ss-tie" data-own={own} data-decided={!!tie.winnerClubId} aria-label={`${tie.label}: ${name(tie.highClubId)} mot ${name(tie.lowClubId)}`}>
      <header>{tie.label}</header>
      {[tie.highClubId, tie.lowClubId].map((club) => <div key={club} className="ss-tie-row" data-winner={tie.winnerClubId === club}><Crest id={club} /><span>{name(club)}</span><b>{score(club)}</b></div>)}
      <footer>{games.map((g) => <span key={g.id} title={g.f?.date} data-played={!!g.r}>{g.r ? `${g.r.homeGoals}–${g.r.awayGoals}${g.r.decider ? (g.r.decider.method === "SHOOTOUT" ? ` (${g.r.decider.shootout!.home}–${g.r.decider.shootout!.away} str)` : " (fl)") : ""}` : g.f?.date.slice(5) ?? ""}</span>)}</footer>
    </article>
  );
}

function Bracket({ career, title, competitionId, rounds, roundLabels }: { career: CareerState; title: string; competitionId: string; rounds: string[][]; roundLabels: string[] }) {
  const ties = Object.values(career.competitionTies ?? {}).filter((t) => t.competitionId === competitionId);
  const byKey = (key: string) => ties.find((t) => t.key === key);
  const final = byKey(rounds.at(-1)![0]!);
  return (
    <section className="ss-section" aria-labelledby={`${competitionId}-title`}>
      <header className="ss-section-head"><span className="xp-eyebrow">Bäst av fem · högst placerade laget börjar hemma</span><h2 id={`${competitionId}-title`}>{title}</h2>{final?.winnerClubId && <span className="ss-champion"><Crest id={final.winnerClubId} size={28} /> {name(final.winnerClubId)}</span>}</header>
      <div className="ss-bracket" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(180px, 1fr))` }}>
        {rounds.map((keys, r) => <div key={r} className="ss-round"><span className="xp-eyebrow">{roundLabels[r]}</span><div className="ss-round-ties">{keys.map((k) => <TieCard key={k} career={career} tie={byKey(k)} />)}</div></div>)}
      </div>
    </section>
  );
}

function Cup({ career, ties }: { career: CareerState; ties: CompetitionTie[] }) {
  const groups = ties.filter((t) => t.stage === "CUP_GROUP").sort((a, b) => a.key.localeCompare(b.key));
  const byKey = (k: string) => ties.find((t) => t.key === k);
  return (
    <section className="ss-section" aria-labelledby="cup-title">
      <header className="ss-section-head"><span className="xp-eyebrow">ATG Svenska cupen · 32 lag · Final4</span><h2 id="cup-title">Svenska cupen</h2>{byKey("CF")?.winnerClubId && <span className="ss-champion"><Crest id={byKey("CF")!.winnerClubId} size={28} /> {name(byKey("CF")!.winnerClubId)}</span>}</header>
      <div className="ss-groups">{groups.map((g) => <div key={g.id} className="ss-group"><h3>{g.label}</h3><table className="hm-table ss-table"><tbody>{cupGroupTable(career, g).map((r, i) => <tr key={r.clubId} data-zone={i < 2 ? "playoff" : undefined} data-own={r.clubId === career.playerClubId}><td>{i + 1}</td><td className="ss-club"><Crest id={r.clubId} size={18} />{name(r.clubId)}</td><td className="hm-table-num">{r.played}</td><td className="hm-table-num"><b>{r.points}</b></td></tr>)}</tbody></table></div>)}</div>
      {byKey("R16-1") && (
        <div className="ss-bracket" style={{ gridTemplateColumns: "repeat(4, minmax(170px, 1fr))" }}>
          {[["Åttondelsfinal", [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `R16-${n}`)], ["Kvartsfinal", [1, 2, 3, 4].map((n) => `CQF-${n}`)], ["Final4: semifinal", ["CSF-1", "CSF-2"]], ["Final4: final", ["CF", "C3"]]].map(([label, keys]) => <div key={label as string} className="ss-round"><span className="xp-eyebrow">{label as string}</span><div className="ss-round-ties">{(keys as string[]).map((k) => <TieCard key={k} career={career} tie={byKey(k)} />)}</div></div>)}
        </div>
      )}
    </section>
  );
}

function Awards({ career }: { career: CareerState }) {
  const awards = career.seasonOutcome!.awards;
  const featured = awards.filter((a) => a.id !== "ALL_STAR");
  return (
    <section className="ss-section" aria-labelledby="awards-title">
      <header className="ss-section-head"><span className="xp-eyebrow">Säsongens utmärkelser</span><h2 id="awards-title">Galan</h2></header>
      <div className="ss-awards">{featured.map((a) => { const p = getCareerPlayer(career, a.playerId); return <EventCard key={`${a.id}-${a.competitionId}`} kind="SEASON_ACHIEVEMENT" eyebrow={`${a.label} · ${a.competitionId === HANDBOLLSLIGAN ? "Handbollsligan" : "Allsvenskan"}`} title={p ? `${p.firstName} ${p.lastName}` : a.playerId} media={<Crest id={a.clubId} size={44} />}>{`${name(a.clubId)} · ${a.value}`}</EventCard>; })}</div>
    </section>
  );
}
