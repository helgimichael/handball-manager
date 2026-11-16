'use client';
// Arena Nights -- CMP-02 A "Head-to-head card": result or kick-off, then a mirrored tale of the tape (position,
// points, goals for/against per match, form) and every previous meeting in this career. Clubs open in a Peek.
// Own upcoming fixture -> match preparation (MDY-01); played -> match report (ANL-01).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { useCareer } from '@/lib/career/CareerContext';
import { activeClubId } from "@/lib/manager/employment";
import { getNextPlayerFixture } from '@/lib/career/calendar';
import { COMPETITIONS, getClub } from '@/lib/game-data';
import { EmptyState, CompetitionLink } from '@/components/manager/Workspace';
import FormDots from '@/components/FormDots';
import ClubCrest from '@/components/ClubCrest';
import ClubPeek from '@/components/manager/ClubPeek';
import { fixtureIdFromParam, matchReportHref } from '@/lib/career/fixtureRoutes';
import { headToHead } from '@/lib/competition/headToHead';
import { halfTimeScore } from '@/lib/competition/leagueCentre';
import { SVENSKA_CUPEN } from '@/lib/competition/rules';
import { STAGE_LABEL } from '@/lib/competition/season';

const short = (id: string) => getClub(id)?.shortName ?? id;

export default function FixturePage() {
  const { career } = useCareer();
  const fixtureId = fixtureIdFromParam(useParams<{ fixtureId: string }>().fixtureId);
  const [peek, setPeek] = useState<string | null>(null);
  const summaries = useMemo(() => careerArchiveSummaries(career), [career]);
  const fixture = career.fixtures.find(f => f.id === fixtureId) ?? summaries[fixtureId]?.fixture;
  const h2h = useMemo(() => (fixture ? headToHead(career, fixture) : null), [career, fixture]);
  if (!fixture || !h2h) return <EmptyState>Matchen finns inte i denna karriär. Länken kan höra till en tidigare säsong. <Link href="/career/schedule">Öppna schemat →</Link></EmptyState>;
  const result = career.results[fixtureId] ?? summaries[fixtureId]?.result;
  const own = fixture.homeClubId === (activeClubId(career) ?? "") || fixture.awayClubId === (activeClubId(career) ?? "");
  const isNext = getNextPlayerFixture(career)?.id === fixture.id;
  const tie = fixture.stage ? career.competitionTies?.[fixture.stage.tieId] : undefined;
  const competitionName = fixture.competitionId === SVENSKA_CUPEN ? 'Svenska Cupen' : COMPETITIONS.find(c => c.id === fixture.competitionId)?.name ?? 'Tävling';
  const context = fixture.type === 'LEAGUE' ? `${competitionName} · omgång ${fixture.round}` : tie ? `${competitionName} · ${STAGE_LABEL[tie.stage]}` : fixture.type === 'FRIENDLY' ? 'Träningsmatch' : competitionName;
  const ht = result ? halfTimeScore(result) : null;
  const sides = [h2h.home, h2h.away] as const;
  const clubButton = (i: 0 | 1) => { const s = sides[i]; return <button type="button" className="cc-h2h-club" data-side={i === 0 ? 'home' : 'away'} data-own={s.clubId === (activeClubId(career) ?? "") || undefined} onClick={() => setPeek(s.clubId)} aria-label={`Snabbtitt: ${s.name}`}>
    <ClubCrest clubId={s.clubId} shortName={short(s.clubId)} primaryColor={getClub(s.clubId)?.primaryColor ?? ''} size={64} />
    <strong>{s.name}</strong><small>{i === 0 ? 'Hemma' : 'Borta'}{s.position ? ` · ${s.position}:a` : ''}</small>
  </button>; };
  return <div className="cc-page cc-h2h">
    <header className="cc-h2h-head" data-played={!!result || undefined}>
      <span className="cc-eyebrow">{context} · {fixture.date}{fixture.kickoffTime ? ` · ${fixture.kickoffTime}` : ''}</span>
      <div className="cc-h2h-bug">
        {clubButton(0)}
        <div className="cc-h2h-score">{result ? <><b>{result.homeGoals}–{result.awayGoals}</b>{ht && <small>Halvtid {ht}</small>}{result.decider && <small>{result.decider.method === 'SHOOTOUT' ? 'Avgjord på straffar' : 'Avgjord i förlängning'}</small>}</> : <><b>vs</b><small>{fixture.kickoffTime ?? 'Ej spelad'}</small></>}</div>
        {clubButton(1)}
      </div>
      <div className="hm-actions cc-h2h-actions">
        {result ? <Link href={matchReportHref(fixtureId)} className="hm-btn hm-btn-primary">Matchrapport →</Link> : own && isNext ? <Link href="/career/match-preview" className="hm-btn hm-btn-primary">Förbered & spela →</Link> : own ? <span className="cc-muted">Matchförberedelsen öppnar när det här är din nästa match.</span> : null}
        <CompetitionLink id={fixture.competitionId}>Till tävlingen →</CompetitionLink>
        <Link href="/career/schedule">Spelschemat →</Link>
      </div>
    </header>
    <section className="cc-tape" aria-label="Jämförelse">
      <h2>Inför matchen</h2>
      <ul>{h2h.metrics.map(m => <li key={m.label}><b data-better={m.better === 'home' || undefined}>{m.home}</b><span>{m.label}</span><b data-better={m.better === 'away' || undefined}>{m.away}</b></li>)}
        <li><span className="cc-tape-form">{h2h.home.form.length ? <FormDots results={h2h.home.form} /> : '—'}</span><span>Form · senaste 5</span><span className="cc-tape-form">{h2h.away.form.length ? <FormDots results={h2h.away.form} /> : '—'}</span></li>
      </ul>
      {h2h.home.competition !== h2h.away.competition && <p className="cc-muted">Klubbarna spelar i olika serier ({h2h.home.competition ?? 'okänd'} / {h2h.away.competition ?? 'okänd'}); placering och poäng jämförs inte.</p>}
    </section>
    <section className="cc-tape cc-meetings" aria-label="Tidigare möten">
      <h2>Tidigare möten</h2>
      {h2h.meetings.length ? <>
        <p className="cc-meet-record"><b>{h2h.record.homeWins}</b> {short(fixture.homeClubId)} · <b>{h2h.record.draws}</b> oavgjorda · <b>{h2h.record.awayWins}</b> {short(fixture.awayClubId)}</p>
        <ul>{h2h.meetings.slice(0, 8).map(m => <li key={m.fixtureId}><Link href={matchReportHref(m.fixtureId)}><span className="cc-num">{m.date}</span><span>{short(m.homeClubId)} – {short(m.awayClubId)}</span><b>{m.score}</b><small>{m.current ? 'denna säsong' : m.seasonId}</small></Link></li>)}</ul>
      </> : <p className="cc-muted">Klubbarna har inte mötts tidigare i den här karriären.</p>}
    </section>
    {peek && <ClubPeek clubId={peek} onClose={() => setPeek(null)} />}
  </div>;
}
