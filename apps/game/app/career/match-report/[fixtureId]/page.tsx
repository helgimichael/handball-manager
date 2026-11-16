"use client";
// Arena Nights -- ANL-01 C "Editorial Match Report": one post-match story read top-down
// (score + headline -> how it happened -> consequences and next steps), with depth in tabs:
// Rapport · Statistik · Repris. The archived Match Center lives behind the Repris tab (ANL-01a, MDY-04),
// so the report no longer renders it twice or links to a second replay page. Works for every stored
// match; sections without stored detail degrade to a note (ANL-01d). Read-only over stored results.
import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useParams, useRouter } from "next/navigation";
import { ArchiveReplay } from '@/components/ProductionMatchView';
import { useMatchArchive } from '@/lib/save/useMatchArchive';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { archiveFrames, type MatchFrame } from '@/lib/career/productionMatch';
import { archivedMatchModel, snapshotsFor } from '@/lib/matchCenter/model';
import { TacticalCourt } from '@/components/matchCenter/TacticalCourt';
import { StatisticsView } from '@/components/matchCenter/WorkspaceViews';
import { PageHeading } from '@/components/manager/Workspace';
import { MatchAftermathPanel } from "@/components/matchday/Matchday";
import ClubCrest from "@/components/ClubCrest";
import { COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { workloadWindow } from "@/lib/training/workloadLedger";
import { fixtureIdFromParam, matchReportHref } from '@/lib/career/fixtureRoutes';
import { clubMatchNeighbours, headToHead, playedMatches, clubShort } from '@/lib/matchday/preMatch';
import { HeadToHead, ReportNav } from '@/components/matchday/PreMatch';
import { buildMatchStory, matchLessons, ratingsColumn, restCandidates, workloadRows, type LoadSetting, type Side, type TurningPoint } from '@/lib/analysis/matchReport';
import { MomentumChart, PressBox, RatingsColumn, ReportEmpty, StatsSheet, TurningPoints, WorkloadBox } from '@/components/analysis/MatchReport';

type Tab = 'RAPPORT' | 'STATISTIK' | 'REPRIS';
const subscribeHash = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
const TABS: { id: Tab; label: string; hash: string }[] = [{ id: 'RAPPORT', label: 'Rapport', hash: '' }, { id: 'STATISTIK', label: 'Statistik', hash: '#statistik' }, { id: 'REPRIS', label: 'Repris', hash: '#repris' }];

export default function MatchReportPage() {
  const router = useRouter();
  const params = useParams<{ fixtureId: string }>();
  const fixtureId = fixtureIdFromParam(params.fixtureId);
  const { career, setPlayerTrainingLoad } = useCareer();
  const replay = useMatchArchive(fixtureId);
  const archive = replay.archive;
  const summary = careerArchiveSummaries(career)[fixtureId];
  // The open tab is part of the address (#statistik / #repris) so a link can open the replay directly.
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');
  const [picked, setPicked] = useState<{ id: string; tab: Tab } | null>(null);
  const tab: Tab = picked?.id === fixtureId ? picked.tab : TABS.find((x) => x.hash && x.hash === hash)?.id ?? 'RAPPORT';
  const [selected, setSelected] = useState<number | null>(null);
  function openTab(t: Tab) { setPicked({ id: fixtureId, tab: t }); const h = TABS.find((x) => x.id === t)!.hash; window.history.replaceState(null, '', `${window.location.pathname}${h}`); }

  const history = career.seasonHistory ?? [];
  const fixture = career.fixtures.find((f) => f.id === fixtureId) ?? summary?.fixture ?? archive?.fixture ?? history.flatMap((s) => s.fixtures ?? []).find((f) => f.id === fixtureId);
  const result = career.results[fixtureId] ?? summary?.result ?? archive?.result ?? history.map((s) => s.results?.[fixtureId]).find((r) => !!r);

  const frames = useMemo<MatchFrame[]>(() => { if (!archive) return []; try { return archiveFrames(archive); } catch { return []; } }, [archive]);
  const model = useMemo(() => (archive ? archivedMatchModel(archive, frames) : null), [archive, frames]);

  const home = fixture ? getClub(fixture.homeClubId) : undefined, away = fixture ? getClub(fixture.awayClubId) : undefined;
  const homeName = home?.shortName ?? fixture?.homeClubId ?? 'Hemma', awayName = away?.shortName ?? fixture?.awayClubId ?? 'Borta';
  const ownInvolved = !!fixture && (fixture.homeClubId === career.playerClubId || fixture.awayClubId === career.playerClubId);
  const ownSide: Side = fixture && fixture.awayClubId === career.playerClubId ? 'away' : 'home';
  const city = home?.venueCity ?? home?.city;
  const story = useMemo(() => (result ? buildMatchStory(result, ownSide, { home: homeName, away: awayName }, city) : null), [result, ownSide, homeName, awayName, city]);

  if (replay.loading && !result) return <p role="status">Laddar matchrapporten…</p>;
  if (!fixture || !result || !story) {
    return replay.error
      ? <ReportEmpty title="Matchrapporten kunde inte läsas" text={replay.error} retry={replay.retry} />
      : <ReportEmpty title="Den här matchen saknar en rapport." text="Matchen är inte spelad ännu, eller så finns resultatet inte kvar i karriären." />;
  }

  const names: Record<Side, string> = { home: homeName, away: awayName };
  const managerTeam = ownSide === 'home' ? 'HOME' : 'AWAY';
  const focusClub = ownInvolved ? career.playerClubId : fixture.homeClubId;
  const neighbours = clubMatchNeighbours(career, focusClub, fixture.id);
  const picker = playedMatches(career).filter((m) => m.homeClubId === focusClub || m.awayClubId === focusClub).slice(0, 40);
  const meetings = headToHead(career, fixture.homeClubId, fixture.awayClubId, fixture.id);
  const isCup = fixture.type === 'CUP' || fixture.competitionId.toLowerCase().includes('cup');
  const competition = COMPETITIONS.find((c) => c.id === fixture.competitionId)?.name ?? (fixture.type === 'CUP' ? 'Svenska Cupen' : 'Match');
  const ratings = ratingsColumn(result, 10);
  const lessons = ownInvolved ? matchLessons(result, ownSide) : [];

  // ANL-01c: own players who played, from the archive's load record and the workload ledger.
  const loadRows = archive && ownInvolved ? workloadRows(archive.people.filter((p) => p.team === managerTeam && (archive.load[p.id]?.minutes ?? 0) > 0).map((p) => {
    const l = archive.load[p.id]!;
    const week = workloadWindow(career.workloadLedger, p.id, fixture.date, 7, true);
    const month = workloadWindow(career.workloadLedger, p.id, fixture.date, 28, true);
    const full = getCareerPlayer(career, p.id);
    return { id: p.id, name: full ? `${full.firstName} ${full.lastName}` : p.name, minutes: l.minutes, energy: l.energy, workload: l.workload, estimated: l.workloadQuality === 'ESTIMATED', week: week.complete ? week.total : null, typical: month.complete ? month.total / 4 : null, setting: (career.playerTrainingAssignments?.[p.id]?.loadSetting ?? 'FULL') as LoadSetting };
  })) : [];
  const bulk = restCandidates(loadRows);

  function snapshot(t: TurningPoint) {
    if (!archive || !model || t.kind === 'HALF_TIME') return null;
    const goal = model.events.find((e) => e.type === 'GOAL' && e.score[0] === t.score.home && e.score[1] === t.score.away);
    const shot = goal ? snapshotsFor(goal.canonicalEventId, archive.events, frames, archive.people).at(-1) : undefined;
    return shot ? <div className="rp-turn-court"><TacticalCourt snapshot={shot} focusY={shot.ball.y} /></div> : null;
  }

  const ownDiff = (result.homeGoals - result.awayGoals) * (ownSide === 'home' ? 1 : -1);
  const outcome = !ownInvolved ? null : ownDiff > 0 ? 'Seger' : ownDiff < 0 ? 'Förlust' : 'Oavgjort';

  return (
    <div className="rp-page">
      <PageHeading eyebrow={fixture.date} title="Matchrapport" description="Matchens berättelse: resultatet, hur det gick till och vad det betyder för veckan." />
      <div className="rp-pick">
        <ReportNav previous={neighbours.previous} next={neighbours.next} />
        {picker.length > 1 && <label className="rp-picker"><span>Välj match</span><select className="hm-select" value={fixture.id} onChange={(e) => router.push(matchReportHref(e.target.value))}>{picker.some((m) => m.fixtureId === fixture.id) ? null : <option value={fixture.id}>{fixture.date}</option>}{picker.map((m) => <option key={m.fixtureId} value={m.fixtureId}>{m.date} · {clubShort(m.homeClubId)} {m.homeGoals}–{m.awayGoals} {clubShort(m.awayClubId)}</option>)}</select></label>}
      </div>

      <header className="md-report-head rp-head" aria-label="Matchen i korthet" data-outcome={outcome ?? undefined}>
        <span className="game-overline">{competition}{fixture.type === 'LEAGUE' && fixture.round ? ` · omgång ${fixture.round}` : ''} · {fixture.date}{home?.venue ? ` · ${home.venue}` : ''}</span>
        <div className="rp-score">
          <span>{home && <ClubCrest clubId={home.id} shortName={home.shortName} primaryColor={home.primaryColor} size={48} />}<b>{names.home}</b></span>
          <strong className="rp-num">{result.homeGoals}<i>–</i>{result.awayGoals}</strong>
          <span>{away && <ClubCrest clubId={away.id} shortName={away.shortName} primaryColor={away.primaryColor} size={48} />}<b>{names.away}</b></span>
        </div>
        <p className="rp-meta">{story.halfTime ? <>Halvtid <span className="rp-num">{story.halfTime.home}–{story.halfTime.away}</span></> : 'Halvtidsresultat saknas'}{result.decider ? ` · avgjord ${result.decider.method === 'SHOOTOUT' ? 'på straffar' : 'i förlängning'}` : ''}{outcome ? ` · ${outcome}` : ''}</p>
        <span className="rp-kicker">{story.kicker}</span>
        <h2>{story.headline}</h2>
      </header>

      <nav className="rp-tabs" role="tablist" aria-label="Rapportens delar">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" id={`rp-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`rp-panel-${t.id}`} onClick={() => openTab(t.id)}>{t.label}{t.id === 'REPRIS' && !archive && !replay.loading ? <small> · saknas</small> : null}</button>)}
      </nav>

      {tab === 'RAPPORT' && <div role="tabpanel" id="rp-panel-RAPPORT" aria-labelledby="rp-tab-RAPPORT" className="rp-story">
        <div className="rp-hero">
          <section className="rp-box rp-flow" aria-labelledby="rp-flow-h">
            <header><h3 id="rp-flow-h">Så gick matchen</h3><small>Målskillnad minut för minut{story.leadChanges ? ` · ${story.leadChanges} ledarbyten` : ''}</small></header>
            <MomentumChart story={story} names={names} selected={selected} onSelect={setSelected} />
          </section>
          <aside className="rp-side" aria-label="Spelarbetyg och röster">
            <section className="rp-box" aria-labelledby="rp-rate-h"><header><h3 id="rp-rate-h">Spelarbetyg</h3></header><RatingsColumn rows={ratings} homeClubId={fixture.homeClubId} awayClubId={fixture.awayClubId} names={names} /></section>
            <MatchAftermathPanel fixtureId={fixture.id} variant="aside" />
          </aside>
        </div>

        <section className="rp-section" aria-labelledby="rp-turns-h">
          <header><h3 id="rp-turns-h">Avgörande ögonblick</h3><small>{archive ? 'Planbilden är sparad vid målet' : replay.loading ? 'Laddar planbilder…' : 'Utan matcharkiv visas ögonblicken som text'}</small></header>
          <TurningPoints points={story.turningPoints} selected={selected} onSelect={setSelected} snapshot={snapshot} />
        </section>

        <div className="rp-after">
          {ownInvolved ? <WorkloadBox rows={loadRows} bulk={bulk} onSet={(id, s) => setPlayerTrainingLoad(id, s)} onBulk={() => bulk.forEach((id) => setPlayerTrainingLoad(id, 'REST'))} empty={archive ? undefined : replay.loading ? 'Laddar speltiden…' : 'Ingen detaljdata för den här matchen: speltid och belastning sparas i matcharkivet.'} /> : <section className="rp-box"><header><h3>Speltid och belastning</h3></header><p className="rp-empty">Ditt lag spelade inte den här matchen.</p></section>}
          <section className="rp-box rp-next" aria-labelledby="rp-next-h">
            <header><h3 id="rp-next-h">Vad vi tar med oss</h3></header>
            {ownInvolved ? (lessons.length ? <ul className="rp-lessons">{lessons.map((l) => <li key={l.id}><span>{l.text}</span><Link className="hm-btn hm-btn-sm" href={l.href}>{l.cta} →</Link></li>)}</ul> : <p className="rp-empty">Inga tydliga svagheter i statistiken jämfört med motståndaren.</p>) : <p className="rp-empty">En match mellan två andra lag.</p>}
            <div className="rp-next-links">
              <Link className="hm-btn hm-btn-sm" href="/career/training">Träningsveckan</Link>
              <Link className="hm-btn hm-btn-sm" href="/career/tactics">Matchplanen</Link>
              <Link className="hm-btn hm-btn-sm" href={`/career/competitions/${encodeURIComponent(fixture.competitionId)}`}>{isCup ? 'Svenska Cupen →' : 'Tabell & liga →'}</Link>
            </div>
            {ownInvolved && <PressBox fixture={fixture} result={result} />}
          </section>
        </div>

        <section className="rp-section" aria-labelledby="md-h2h-h"><header><h3 id="md-h2h-h">Tidigare möten</h3><small>{names.home} – {names.away} i din karriär</small></header><HeadToHead matches={meetings} clubId={focusClub} /></section>
      </div>}

      {tab === 'STATISTIK' && <div role="tabpanel" id="rp-panel-STATISTIK" aria-labelledby="rp-tab-STATISTIK">
        <StatsSheet result={result} names={names} story={story}>
          {model ? <section className="rp-box rp-mc" aria-label="Fördjupad statistik"><StatisticsView model={model} team={managerTeam} /></section> : <p className="rp-empty">{replay.loading ? 'Laddar avslut och målvaktsstatistik…' : 'Ingen detaljdata för den här matchen: avslutskarta och målvaktsstatistik kräver ett matcharkiv.'}</p>}
        </StatsSheet>
      </div>}

      {tab === 'REPRIS' && <div role="tabpanel" id="rp-panel-REPRIS" aria-labelledby="rp-tab-REPRIS">
        {archive ? <ArchiveReplay archive={archive} hideOverview />
          : replay.loading ? <p role="status">Laddar matchreprisen…</p>
          : replay.error ? <ReportEmpty title="Reprisen kunde inte läsas" text={replay.error} retry={replay.retry} competitionId={fixture.competitionId} />
          : <ReportEmpty title="Ingen detaljdata för den här matchen" text="Matchen sparades utan matcharkiv, så det finns ingen repris med planbilder. Resultatet, statistiken och betygen finns kvar under Rapport och Statistik." competitionId={fixture.competitionId} />}
      </div>}

      <div className="rp-continue">
        <Link className="hm-btn" href="/career/schedule">← Schema</Link>
        <button type="button" className="hm-btn hm-btn-primary" onClick={() => router.push('/career')}>Fortsätt →</button>
      </div>
    </div>
  );
}
