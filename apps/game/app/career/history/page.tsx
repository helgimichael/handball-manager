'use client';
// Arena Nights MGR-02 C "Season Books" (adapted: season shelf of cards) and
// MGR-02a A "Season Timeline": every finished season as a book on a shelf
// that doubles as a progression line; the open book has a cover (position,
// honours, top scorer, best/worst match, board verdict, reputation change)
// and tabs with the archived table, statistics, matches and transfers.
// Archives are read only (lib/manager/seasonBooks.ts).
import { Suspense, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { getCareerClub, getCareerPlayer } from '@/lib/career/careerWorld';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import { getClub, COMPETITIONS, clubDisplayName } from '@/lib/game-data';
import { EmptyState, FixtureTable } from '@/components/manager/Workspace';
import { SectionScene, SceneEmpty } from '@/components/game/Secondary';
import ClubCrest from '@/components/ClubCrest';
import StatisticsTable from '@/components/manager/StatisticsTable';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { svOrdinal } from '@/lib/format/ordinal';
import { buildSeasonBooks, type BookMatch, type SeasonBook } from '@/lib/manager/seasonBooks';
import type { CareerState } from '@/lib/career/types';

export default function HistoryPage() { return <Suspense fallback={<EmptyState>Öppnar karriärens säsonger…</EmptyState>}><History /></Suspense>; }

type BookTab = 'table' | 'stats' | 'matches' | 'transfers';
const compName = (id: string) => COMPETITIONS.find(c => c.id === id)?.name ?? id;
const seasonWindow = (seasonId: string): [string, string] => { const y = Number(seasonId.slice(0, 4)); return [`${y}-07-01`, `${y + 1}-06-30`]; };
const neon = (clubId: string) => ({ '--book-neon': getClub(clubId)?.primaryColor ?? 'var(--club-neon)' }) as CSSProperties;

function Crest({ clubId, size = 22 }: { clubId: string; size?: number }) {
  const c = getClub(clubId);
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={size} /> : null;
}

function History() {
  useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const params = useSearchParams();
  const [transferScope, setTransferScope] = useState<'OWN' | 'WORLD'>('OWN');
  const [bookTab, setBookTab] = useState<BookTab>('table');
  const [allMatches, setAllMatches] = useState(false);
  const club = getCareerClub(career);
  const books = useMemo(() => buildSeasonBooks(career), [career]);
  const book = books.find(b => b.seasonId === params.get('season')) ?? books.at(-1);
  const entry = book ? career.seasonHistory?.find(s => s.seasonId === book.seasonId) : undefined;
  const summaries = useMemo(() => careerArchiveSummaries(career), [career]);
  const archives = Object.values(summaries).sort((a, b) => b.fixture.date.localeCompare(a.fixture.date));
  const unknownIds = (career.matchArchiveIds ?? []).filter(id => !summaries[id]);
  const span = book ? seasonWindow(book.seasonId) : null;
  const inSeason = (date: string) => !span || (date >= span[0] && date <= span[1]);
  const seasonArchives = allMatches || !span ? archives : archives.filter(a => inSeason(a.fixture.date));
  const allOffers = Object.values(career.transferOffers).filter(o => o.status === 'COMPLETED').reverse();
  const ownClubs = new Set([career.playerClubId, ...(book ? [book.clubId] : [])]);
  const ownOffers = allOffers.filter(o => ownClubs.has(o.toClubId) || (o.fromClubId !== undefined && ownClubs.has(o.fromClubId)));
  const offers = (transferScope === 'OWN' ? ownOffers : allOffers).filter(o => inSeason(o.offeredDate));
  const titles = books.filter(b => b.star).length;

  return <div className="game-secondary-page sb-page">
    <SectionScene eyebrow={`${club.name} · managerkarriären`} title="Säsongsböcker" description="Varje avslutad säsong som en bok: placering, meriter, skyttekung, säsongens bästa och sämsta match, styrelsens omdöme och vad den gjorde med ditt rykte. Bara registrerade resultat." mark={<ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={72} />}><div><strong>{books.length}</strong><small>avslutade säsonger</small></div><div><strong>{titles}</strong><small>säsonger med meriter</small></div><div><strong>{archives.length + unknownIds.length}</strong><small>bevarade matcher</small></div></SectionScene>

    <div className="bd-tabs sb-hubtabs" role="tablist" aria-label="Karriär">
      <Link role="tab" aria-selected={false} href="/career/manager">Biografi</Link>
      <Link role="tab" aria-selected={false} href="/career/manager?tab=jobs">Jobbmarknaden</Link>
      <span role="tab" aria-selected={true} className="sb-hubtab-current">Säsongsböcker</span>
    </div>

    <SeasonShelf career={career} books={books} selected={book?.seasonId} />

    {book && entry ? (
      <div className="sb-book" style={neon(book.clubId)}>
        <BookCover career={career} book={book} archived={id => !!summaries[id]} />
        <section className="sb-inside" aria-label={`Säsongen ${book.seasonId}`}>
          <div className="bd-tabs" role="tablist" aria-label="Säsongsbokens delar">
            {([['table', 'Tabell'], ['stats', 'Statistik'], ['matches', 'Matcher'], ['transfers', 'Övergångar']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={bookTab === id} onClick={() => setBookTab(id)}>{label}</button>)}
          </div>
          {bookTab === 'table' && <div className="hm-scroll-x"><table className="hm-table sb-table"><caption>{book.seasonId} · sluttabell {compName(book.competitionId)}{book.clubId !== career.playerClubId ? ` · du ledde ${clubDisplayName(book.clubId, book.seasonId)}` : ''}</caption><thead><tr><th>#</th><th>Klubb</th><th className="hm-table-num">M</th><th className="hm-table-num">V / O / F</th><th className="hm-table-num">GM / IM</th><th className="hm-table-num">MSK</th><th className="hm-table-num">P</th></tr></thead><tbody>{(entry.tables?.[book.competitionId] ?? entry.table).map((r, i) => <tr key={r.clubId} data-highlight={r.clubId === book.clubId}><td>{i + 1}</td><td><ClubLink clubId={r.clubId}>{clubDisplayName(r.clubId, book.seasonId)}</ClubLink></td><td className="hm-table-num">{r.played}</td><td className="hm-table-num">{r.won} / {r.drawn} / {r.lost}</td><td className="hm-table-num">{r.goalsFor} / {r.goalsAgainst}</td><td className="hm-table-num">{r.goalDifference}</td><td className="hm-table-num">{r.points}</td></tr>)}</tbody></table></div>}
          {bookTab === 'stats' && <StatisticsTable key={book.seasonId} competitionId={entry.competitionId} statistics={entry.stats} />}
          {bookTab === 'matches' && <>
            <div className="hm-actions"><button type="button" className="hm-btn hm-btn-sm" aria-pressed={!allMatches} onClick={() => setAllMatches(false)}>Säsongen {book.seasonId}</button><button type="button" className="hm-btn hm-btn-sm" aria-pressed={allMatches} onClick={() => setAllMatches(true)}>Hela karriären</button></div>
            {seasonArchives.length ? <FixtureTable career={career} fixtures={seasonArchives.map(a => a.fixture)} /> : <EmptyState>Inga bevarade matcher från {book.seasonId}. Visa hela karriären för äldre arkiv.</EmptyState>}
            {allMatches && unknownIds.map(id => <p key={id}><Link href={`/career/match-report/${encodeURIComponent(id)}`}>Öppna äldre matcharkiv → {id}</Link></p>)}
          </>}
          {bookTab === 'transfers' && <>
            <div className="hm-actions"><button type="button" className="hm-btn hm-btn-sm" aria-pressed={transferScope === 'OWN'} onClick={() => setTransferScope('OWN')}>Din klubb</button><button type="button" className="hm-btn hm-btn-sm" aria-pressed={transferScope === 'WORLD'} onClick={() => setTransferScope('WORLD')}>Karriärvärlden</button></div>
            <TransferTable career={career} offers={offers} />
            {!offers.length && <EmptyState>Inga genomförda övergångar under {book.seasonId} i den här vyn.</EmptyState>}
          </>}
        </section>
      </div>
    ) : (
      <>
        <SceneEmpty title="Din första säsong pågår" actions={<><Link className="hm-btn hm-btn-sm" href="/career/season">Följ säsongen →</Link><Link className="hm-btn hm-btn-sm" href="/career/schedule">Matchprogrammet →</Link></>}>Säsongsboken skrivs när säsongen är slut och nästa startar: sluttabell, meriter, skyttekung, säsongens bästa match och styrelsens omdöme. Spelade matcher går att öppna i arkivet redan nu.</SceneEmpty>
        {archives.length + unknownIds.length > 0 && <section className="sb-inside" aria-labelledby="sb-archive-title"><h2 id="sb-archive-title" className="sb-h2">Spelade matcher · hela karriären</h2><FixtureTable career={career} fixtures={archives.map(a => a.fixture)} />{unknownIds.map(id => <p key={id}><Link href={`/career/match-report/${encodeURIComponent(id)}`}>Öppna äldre matcharkiv → {id}</Link></p>)}</section>}
        <section className="sb-inside" aria-labelledby="sb-transfers-title"><h2 id="sb-transfers-title" className="sb-h2">Genomförda övergångar</h2><div className="hm-actions"><button type="button" className="hm-btn hm-btn-sm" aria-pressed={transferScope === 'OWN'} onClick={() => setTransferScope('OWN')}>Din klubb</button><button type="button" className="hm-btn hm-btn-sm" aria-pressed={transferScope === 'WORLD'} onClick={() => setTransferScope('WORLD')}>Karriärvärlden</button></div><TransferTable career={career} offers={offers} />{!offers.length && <EmptyState>Inga genomförda övergångar i den här vyn ännu.</EmptyState>}</section>
      </>
    )}
  </div>;
}

/** MGR-02a: the shelf -- one tall card per season, oldest first, the position badge raised by how high you finished; the running season closes the row. */
function SeasonShelf({ career, books, selected }: { career: CareerState; books: SeasonBook[]; selected?: string }) {
  if (books.length === 0) return <nav className="sb-shelf" aria-label="Säsonger"><ol><li className="sb-spine" data-current="true"><Link href="/career/season"><small>{career.seasonId}</small><b className="sb-pos">…</b><span>Din första säsong pågår</span></Link></li></ol></nav>;
  return <nav className="sb-shelf" aria-label="Säsonger">
    <ol>
      {books.map(b => {
        const size = (career.seasonHistory?.find(s => s.seasonId === b.seasonId)?.tables?.[b.competitionId] ?? []).length || 14;
        const height = b.position ? Math.round(((size - b.position) / Math.max(1, size - 1)) * 100) : 0;
        return <li key={b.seasonId} className="sb-spine" data-selected={b.seasonId === selected} style={{ ...neon(b.clubId), '--rank': `${height}%` } as CSSProperties}>
          <Link href={`/career/history?season=${encodeURIComponent(b.seasonId)}`} aria-current={b.seasonId === selected ? 'page' : undefined}>
            <small>{b.seasonId}</small>
            <span className="sb-spine-track"><b className="sb-pos">{b.position ?? '—'}</b></span>
            {b.star && <i className="sb-star" aria-label="Meriter">★</i>}
            <Crest clubId={b.clubId} size={20} />
            <span>{compName(b.competitionId)}</span>
          </Link>
        </li>;
      })}
      <li className="sb-spine" data-current="true"><Link href="/career/season"><small>{career.seasonId}</small><span className="sb-spine-track"><b className="sb-pos">…</b></span><span>Pågår</span></Link></li>
    </ol>
  </nav>;
}

function MatchLine({ m, label, archived }: { m: BookMatch | null; label: string; archived: (id: string) => boolean }) {
  if (!m) return <div><dt>{label}</dt><dd>—</dd></div>;
  const text = <><span className="sb-num">{m.goalsFor}–{m.goalsAgainst}</span> {m.home ? 'mot' : 'borta mot'} {getClub(m.opponentId)?.shortName ?? m.opponentId}</>;
  return <div><dt>{label}</dt><dd>{archived(m.fixtureId) ? <Link href={`/career/match-report/${encodeURIComponent(m.fixtureId)}`}>{text}</Link> : text}<small> · {m.date}</small></dd></div>;
}

function BookCover({ career, book, archived }: { career: CareerState; book: SeasonBook; archived: (id: string) => boolean }) {
  const scorer = book.topScorer ? getCareerPlayer(career, book.topScorer.playerId) : undefined;
  return <article className="sb-cover" aria-labelledby="sb-cover-title">
    <header>
      <Crest clubId={book.clubId} size={48} />
      <div><span className="sb-kicker">{compName(book.competitionId)}{book.partial ? ' · delsäsong' : ''}</span><h2 id="sb-cover-title">{book.seasonId}</h2><span>{clubDisplayName(book.clubId, book.seasonId)}</span></div>
    </header>
    <div className="sb-cover-pos"><b className="sb-num">{book.position ? svOrdinal(book.position) : '—'}</b><span>{book.points !== null ? `${book.points} poäng · ${book.record?.won}–${book.record?.drawn}–${book.record?.lost}` : 'Placering saknas i arkivet'}</span></div>
    <ul className="sb-honours">{book.honours.length ? book.honours.map(h => <li key={h} data-down={h === 'Nedflyttning'}>{h === 'Nedflyttning' ? '▼' : '★'} {h}</li>) : <li data-none="true">Inga meriter den här säsongen</li>}</ul>
    <dl className="sb-facts">
      <div><dt>Skyttekung</dt><dd>{book.topScorer ? <><PlayerLink playerId={book.topScorer.playerId}>{scorer ? `${scorer.firstName} ${scorer.lastName}` : book.topScorer.playerId}</PlayerLink> <span className="sb-num">{book.topScorer.goals} mål</span></> : '—'}</dd></div>
      <MatchLine m={book.bestMatch} label="Bästa match" archived={archived} />
      <MatchLine m={book.worstMatch} label="Tyngsta förlust" archived={archived} />
      <div><dt>Styrelsens omdöme</dt><dd>{book.boardScore === null ? 'Inte bedömd' : <><span className="sb-num">{Math.round(book.boardScore * 100)} %</span> av målen uppfyllda</>}</dd></div>
      <div><dt>Ryktet</dt><dd>{book.reputationDelta === null ? 'Oförändrat' : <span className="sb-num" data-sign={book.reputationDelta >= 0 ? 'pos' : 'neg'}>{book.reputationDelta > 0 ? '+' : ''}{book.reputationDelta}</span>}</dd></div>
      {book.clubAwards.length > 0 && <div><dt>Galan</dt><dd>{book.clubAwards.map(a => { const p = getCareerPlayer(career, a.playerId); return `${a.label}: ${p ? `${p.firstName} ${p.lastName}` : a.playerId}`; }).join(' · ')}</dd></div>}
    </dl>
  </article>;
}

function TransferTable({ career, offers }: { career: CareerState; offers: CareerState['transferOffers'][string][] }) {
  const playerIndex = useMemo(() => new Map(Object.values(career.worldSquads).flat().map(p => [p.id, p])), [career.worldSquads]);
  if (!offers.length) return null;
  return <div className="hm-scroll-x game-staff-market-table"><table className="hm-table"><thead><tr><th>Datum</th><th>Spelare</th><th>Från</th><th>Till</th><th className="hm-table-num">Summa</th><th>Typ</th></tr></thead><tbody>{offers.map(o => <tr key={o.id}><td>{o.offeredDate}</td><td><PlayerLink playerId={o.playerId}>{playerIndex.get(o.playerId)?.lastName ?? o.playerId}</PlayerLink></td><td>{o.fromClubId ? <ClubLink clubId={o.fromClubId}>{getClub(o.fromClubId)?.name ?? o.fromClubId}</ClubLink> : 'Fri agent'}</td><td><ClubLink clubId={o.toClubId}>{getClub(o.toClubId)?.name ?? o.toClubId}</ClubLink></td><td className="hm-table-num">{formatMoney(o.transferFeeEur)}</td><td>{o.dealType === 'LOAN' ? 'Lån' : 'Permanent'}</td></tr>)}</tbody></table></div>;
}
