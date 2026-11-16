'use client';
// Arena Nights -- the club's story as one timeline (CLB-02a B): matches (outcome colour), transfers (in/out) and
// season ends (position + honours), grouped by month, filtered by chips persisted in the URL (?story=). Opponents
// open the club Peek; scores open the match report; seasons open the season book. Shared by Klubben and CLB-04.
import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ClubPeek from '@/components/manager/ClubPeek';
import { PlayerLink } from '@/components/entityLinks';
import { useCareer } from '@/lib/career/CareerContext';
import { clubShort, clubStory, STORY_FILTERS, type StoryItem, type StoryKind } from '@/lib/club/clubTimeline';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';

const OUTCOME: Record<'W' | 'D' | 'L', string> = { W: 'Vinst', D: 'Oavgjort', L: 'Förlust' };

export function ClubStory({ clubId, limit = 8 }: { clubId: string; limit?: number }) {
  return <Suspense fallback={null}><Story clubId={clubId} limit={limit} /></Suspense>;
}

function Story({ clubId, limit }: { clubId: string; limit: number }) {
  useMoney();
  const { career } = useCareer();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const filter = (STORY_FILTERS.find((f) => f.id === params.get('story'))?.id ?? 'all') as 'all' | StoryKind;
  const [all, setAll] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const months = useMemo(() => clubStory(career, clubId, filter), [career, clubId, filter]);
  const shown = all ? months : months.slice(0, limit);
  const setFilter = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id === 'all') next.delete('story'); else next.set('story', id);
    const q = next.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  };
  const item = (i: StoryItem) => {
    if (i.kind === 'match') return (
      <li key={i.id} className="cs-item" data-kind="match" data-outcome={i.outcome}>
        <span className="cs-mark" aria-label={OUTCOME[i.outcome]}>{i.outcome === 'W' ? 'V' : i.outcome === 'D' ? 'O' : 'F'}</span>
        <span className="cs-body"><button type="button" className="cs-club" onClick={() => setPeek(i.opponentId)}>{i.home ? 'mot' : 'borta mot'} {clubShort(i.opponentId)}</button><small>{i.date}</small></span>
        <Link className="cs-score" href={matchReportHref(i.fixtureId)}>{i.goalsFor}–{i.goalsAgainst}</Link>
      </li>
    );
    if (i.kind === 'transfer') return (
      <li key={i.id} className="cs-item" data-kind="transfer" data-direction={i.direction}>
        <span className="cs-mark" aria-label={i.direction === 'in' ? 'Till klubben' : 'Från klubben'}>{i.direction === 'in' ? '↘' : '↗'}</span>
        <span className="cs-body"><PlayerLink playerId={i.playerId}>{i.playerName}</PlayerLink><small>{i.direction === 'in' ? 'från' : 'till'} {i.otherClubId ? <button type="button" className="cs-club" onClick={() => setPeek(i.otherClubId!)}>{clubShort(i.otherClubId)}</button> : 'fri agent'}{i.loan ? ' · lån' : ''} · {i.date}</small></span>
        <span className="cs-fee">{i.feeEur > 0 ? formatMoney(i.feeEur) : 'Ingen avgift'}</span>
      </li>
    );
    return (
      <li key={i.id} className="cs-item" data-kind="season" data-honour={i.honours.length > 0 || undefined}>
        <span className="cs-mark" aria-hidden="true">★</span>
        <span className="cs-body"><Link href={`/career/history?season=${encodeURIComponent(i.seasonId)}`}>Säsongen {i.seasonId}</Link><small>{i.position ? `${i.position}:a av ${i.teams}` : 'Ingen placering'}{i.honours.length ? ` · ${i.honours.join(', ')}` : ''}</small></span>
      </li>
    );
  };
  return (
    <section className="cs-story" aria-labelledby={`cs-h-${clubId}`}>
      <header>
        <h2 id={`cs-h-${clubId}`}>Klubbens berättelse</h2>
        <div className="cs-chips" role="group" aria-label="Visa">
          {STORY_FILTERS.map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
      </header>
      {months.length === 0 ? (
        <p className="cs-empty">{filter === 'transfer' ? 'Inga genomförda övergångar för klubben ännu.' : filter === 'season' ? 'Ingen avslutad säsong ännu. Säsongen skrivs in här när den är slut.' : 'Inga spelade matcher ännu. Matcher, övergångar och säsonger samlas här när de händer.'}</p>
      ) : (
        <ol className="cs-months">
          {shown.map((m) => <li key={m.key}><h3>{m.label}</h3><ol>{m.items.map(item)}</ol></li>)}
        </ol>
      )}
      {months.length > limit && <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => setAll((a) => !a)}>{all ? 'Visa färre månader' : `Visa alla ${months.length} månader`}</button>}
      {peek && <ClubPeek clubId={peek} onClose={() => setPeek(null)} />}
    </section>
  );
}
