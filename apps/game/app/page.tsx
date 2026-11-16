'use client';
// Arena 231 -- ENT-02 C "Journal Cover", Arena adaptation "Season Cover": the title screen is the cover of your
// club's week -- broadcast masthead with the issue line, a lead headline built from the save's real state, one
// Fortsätt CTA, the arena photo with the crest stamp in the club's neon, three briefs (last result, table, next
// match) and the other careers as back issues. No save: the cover welcomes you and Ny karriär is the CTA.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { listSaves, setActiveSaveId, touchSave, type CareerSave } from '@/lib/save/saveRepository';
import { CLUBS, clubVisualIdentity, isHumanManageable } from '@/lib/game-data';
import { clubIdentityStyle } from '@/lib/career/activeClubIdentity';
import { formatGameDate } from '@/lib/career/dateUtils';
import ClubCrest from '@/components/ClubCrest';
import { COURT_MOMENT_BACKDROP } from '@/components/experience/experienceAssets';
import { buildSaveCover, type SaveCover } from '@/components/entry/saveCover';
import { FeedbackModal } from '@/components/FeedbackModal';
import '@/components/entry/entry.css';

// Clubs a human can lead (never a B-team): the welcome cover's crest row.
const FEATURED_CLUBS = CLUBS.filter(c => c.playable && isHumanManageable(c.id)).slice(0, 12);

function safeCover(save: CareerSave): SaveCover | null {
  try { return buildSaveCover(save); } catch { return null; }
}

export default function TitleScreen() {
  const router = useRouter();
  const [saves, setSaves] = useState<readonly CareerSave[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSaves()
      .then(list => { if (!cancelled) setSaves([...list].sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt))); })
      .catch(cause => { if (!cancelled) { setSaves([]); setError(cause instanceof Error ? cause.message : 'Kunde inte läsa sparade karriärer.'); } });
    return () => { cancelled = true; };
  }, []);

  const covers = useMemo(() => (saves ?? []).map(save => ({ save, cover: safeCover(save) })), [saves]);
  const lead = covers[0];
  const cover = lead?.cover ?? null;
  const backIssues = covers.slice(1, 4);

  async function resume(save: CareerSave) {
    if (leaving) return;
    setLeaving(save.saveId);
    setActiveSaveId(save.saveId);
    try {
      await touchSave(save.saveId);
      router.push('/career');
    } catch (cause) {
      setLeaving(null);
      setError(cause instanceof Error ? cause.message : 'Kunde inte öppna karriären.');
    }
  }

  const style = cover ? clubIdentityStyle(clubVisualIdentity(cover.clubId)).style as CSSProperties : undefined;
  const loading = saves === null;

  return (
    <main className="ce-cover" style={style} data-leaving={!!leaving} aria-busy={loading}>
      <header className="ce-cover-mast">
        <span className="ce-cover-mark" aria-hidden="true">HM</span>
        <strong className="ce-cover-title">Handball Manager</strong>
        <span className="ce-cover-issue ce-num">{cover ? cover.issueLine : 'Handbollsligan · Allsvenskan · 2026/27'}</span>
      </header>

      <section className="ce-cover-main">
        <div className="ce-cover-lead">
          {loading ? <p className="ce-kicker" role="status">Läser dina karriärer…</p> : cover && lead ? <>
            <span className="ce-kicker">{cover.clubName} · {cover.managerName}</span>
            <h1>{cover.headline}</h1>
            <p className="ce-cover-standfirst">{cover.standfirst}</p>
            <button type="button" className="ce-cover-cta" disabled={!!leaving} onClick={() => void resume(lead.save)}>
              FORTSÄTT
              <small>{leaving === lead.save.saveId ? 'Öppnar karriären…' : `${cover.clubShortName} · ${formatGameDate(cover.gameDate)}`}</small>
            </button>
          </> : <>
            <span className="ce-kicker">Sju positioner. Sextio minuter. Din klubb.</span>
            <h1>Välj din klubb. Skriv din historia.</h1>
            <p className="ce-cover-standfirst">Bygg laget, känn rivalerna och forma säsongen från första avkast till slutsignal – i Handbollsligan eller Allsvenskan.</p>
            <button type="button" className="ce-cover-cta" onClick={() => router.push('/new-game')}>NYTT SPEL<small>Välj klubben du vill leda</small></button>
          </>}
          {error && <p className="ce-cover-error" role="alert">{error}</p>}
        </div>
        <figure className="ce-cover-photo" style={COURT_MOMENT_BACKDROP}>
          {cover ? <span className="ce-cover-stamp"><ClubCrest clubId={cover.clubId} shortName={cover.clubShortName} primaryColor={cover.primaryColor} size={96} /></span>
            : <span className="ce-cover-crests" aria-label="Spelbara svenska handbollsklubbar">{FEATURED_CLUBS.map(club => <span key={club.id} title={`${club.name}${club.city ? ` · ${club.city}` : ''}`}><ClubCrest clubId={club.id} shortName={club.shortName} primaryColor={club.primaryColor} size={34} /></span>)}</span>}
          <figcaption>{cover ? `${cover.clubName} · ${cover.competitionName}` : 'Arenan väntar'}</figcaption>
        </figure>
      </section>

      {cover && <section className="ce-cover-briefs" aria-label="Sedan du senast spelade">
        <article><span className="ce-kicker">Senast</span>{cover.lastResult ? <><strong className="ce-num" data-outcome={cover.lastResult.outcome}>{cover.lastResult.ours}–{cover.lastResult.theirs}</strong><p>{cover.lastResult.home ? 'Hemma' : 'Borta'} mot {cover.lastResult.opponent}</p>{cover.recent.length > 1 && <span className="ce-form" aria-label={`Form: ${cover.recent.map(r => r.outcome).join(' ')}`}>{cover.recent.map(r => <i key={r.fixtureId} data-outcome={r.outcome}>{r.outcome}</i>)}</span>}</> : <p>Ingen match spelad ännu.</p>}</article>
        <article><span className="ce-kicker">Tabellen</span>{cover.position && cover.tableSize ? <><strong className="ce-num">{cover.position}<small>/{cover.tableSize}</small></strong><p>{cover.competitionName}</p></> : <p>Tabellen tar form när serien har börjat.</p>}</article>
        <article><span className="ce-kicker">Nästa match</span>{cover.nextFixture ? <><strong>{cover.nextFixture.opponent}</strong><p className="ce-num">{cover.nextFixture.home ? 'Hemma' : 'Borta'} · {formatGameDate(cover.nextFixture.date)}</p></> : <p>{cover.seasonComplete ? 'Säsongen är avslutad.' : 'Ingen match inplanerad.'}</p>}</article>
      </section>}

      <nav className="ce-cover-menu" aria-label="Huvudmeny">
        {cover && <Link href="/new-game">Ny karriär</Link>}
        <Link href="/load-game">Alla karriärer{saves && saves.length > 0 ? ` (${saves.length})` : ''}</Link>
        <Link href="/settings">Inställningar</Link>
        <button type="button" aria-haspopup="dialog" onClick={() => setFeedbackOpen(true)}>Rapportera bugg / Feedback</button>
      </nav>

      {backIssues.length > 0 && <section className="ce-cover-back" aria-label="Byt karriär">
        <span className="ce-kicker">Byt karriär</span>
        <ul>{backIssues.map(({ save, cover: c }) => <li key={save.saveId} style={clubIdentityStyle(clubVisualIdentity(save.clubId)).style as CSSProperties}>
          <button type="button" className="ce-back-card" disabled={!!leaving} onClick={() => void resume(save)} aria-label={`Fortsätt ${save.manager.name}s karriär med ${c?.clubName ?? save.clubId}`}>
            <ClubCrest clubId={save.clubId} shortName={c?.clubShortName ?? save.clubId} primaryColor={c?.primaryColor ?? ''} size={36} />
            <span><strong>{c?.clubName ?? save.clubId}</strong><small className="ce-num">{c?.issueLine ?? save.gameDate}</small><small>{save.manager.name}</small></span>
          </button>
        </li>)}</ul>
      </section>}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </main>
  );
}
