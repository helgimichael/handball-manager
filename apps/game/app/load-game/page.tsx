"use client";

// Arena 231 -- ENT-04 C "Journal Cover" (Arena: glass career cards): every save is a cover on a shelf -- masthead in
// its club's neon, the latest headline from that career and the issue line. Selecting a cover opens the spread
// (last five results, next match, Fortsätt) in the context column. ENT-04a: deletion is a consequence dialog with
// 'Exportera först'. ENT-04b: skeleton covers while loading, an invitation when empty, a plain-Swedish storage error.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { deleteSave, exportSaveAsJson, listSaves, setActiveSaveId, touchSave, type CareerSave } from "@/lib/save/saveRepository";
import { CLUBS, NATIONS, clubVisualIdentity, isHumanManageable } from "@/lib/game-data";
import { formatGameDate } from "@/lib/career/dateUtils";
import { clubIdentityStyle } from "@/lib/career/activeClubIdentity";
import ClubCrest from "@/components/ClubCrest";
import CareerEntryFrame from "@/components/game/CareerEntryFrame";
import { buildSaveCover, type SaveCover } from "@/components/entry/saveCover";
import "@/components/game/career-entry.css";
import "@/components/entry/entry.css";

type SaveError = { title: string; message: string; reading?: boolean };
type Entry = { save: CareerSave; cover: SaveCover | null };
const TEASER_CLUBS = CLUBS.filter(c => c.playable && isHumanManageable(c.id)).slice(0, 8);
const neon = (clubId: string) => clubIdentityStyle(clubVisualIdentity(clubId)).style as CSSProperties;
function safeCover(save: CareerSave): SaveCover | null { try { return buildSaveCover(save); } catch { return null; } }

export default function LoadGamePage() {
  const router = useRouter();
  const [saves, setSaves] = useState<readonly CareerSave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SaveError | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: 'OPEN' | 'DELETE' | 'EXPORT' } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deleteReturnRef = useRef<HTMLButtonElement | null>(null);
  const entries: Entry[] = useMemo(() => saves.map(save => ({ save, cover: safeCover(save) })), [saves]);
  const selected = entries.find(e => e.save.saveId === selectedId);

  function load() {
    setLoading(true);
    setError(null);
    return listSaves().then(next => {
      setSaves(next);
      setSelectedId(previous => next.some(save => save.saveId === previous) ? previous : next[0]?.saveId ?? '');
      setLoading(false);
    }).catch((cause: unknown) => {
      setError({ title: 'Sparade karriärer kunde inte läsas', message: cause instanceof Error ? cause.message : 'Kunde inte läsa sparade karriärer.', reading: true });
      setLoading(false);
    });
  }
  useEffect(() => {
    let cancelled = false;
    listSaves().then(next => {
      if (cancelled) return;
      setSaves(next);
      setSelectedId(next[0]?.saveId ?? '');
      setLoading(false);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      setError({ title: 'Sparade karriärer kunde inte läsas', message: cause instanceof Error ? cause.message : 'Kunde inte läsa sparade karriärer.', reading: true });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleLoad(save: CareerSave) {
    if (busy) return;
    setSelectedId(save.saveId);
    setBusy({ id: save.saveId, action: 'OPEN' });
    setPendingDeleteId(null);
    setError(null);
    try {
      setActiveSaveId(save.saveId);
      await touchSave(save.saveId);
      router.push('/career');
    } catch (cause: unknown) {
      setError({ title: 'Karriären kunde inte öppnas', message: cause instanceof Error ? cause.message : 'Kunde inte uppdatera karriären.' });
      setBusy(null);
    }
  }
  async function handleExport(saveId: string) {
    if (busy) return;
    setBusy({ id: saveId, action: 'EXPORT' });
    setNotice(null);
    setError(null);
    try {
      await exportSaveAsJson(saveId);
      setNotice('Säkerhetskopian har skickats till webbläsarens nedladdningar.');
    } catch (cause: unknown) {
      setError({ title: 'Exporten misslyckades', message: cause instanceof Error ? cause.message : 'Kunde inte exportera karriären. Försök igen.' });
    } finally {
      setBusy(null);
    }
  }
  function cancelDelete() {
    setPendingDeleteId(null);
    // The modal must be closed before focus can return to the cover's Ta bort button.
    requestAnimationFrame(() => deleteReturnRef.current?.focus());
  }
  async function handleDelete(saveId: string) {
    if (busy || pendingDeleteId !== saveId) return;
    setBusy({ id: saveId, action: 'DELETE' });
    setError(null);
    try {
      await deleteSave(saveId);
      const next = await listSaves();
      setSaves(next);
      setSelectedId(previous => next.some(save => save.saveId === previous) ? previous : next[0]?.saveId ?? '');
      setPendingDeleteId(null);
      setNotice('Karriären är borttagen.');
    } catch (cause: unknown) {
      setError({ title: 'Karriären kunde inte tas bort', message: cause instanceof Error ? cause.message : 'Kunde inte ta bort karriären.' });
    } finally {
      setBusy(null);
    }
  }

  const pending = entries.find(e => e.save.saveId === pendingDeleteId);
  const rail = <><span className="career-entry-overline">Sparade karriärer</span><h2>Återvänd<br />till klubben.</h2><p className="career-entry-rail-copy">Ditt lag, dina beslut och din säsong väntar där du lämnade dem.</p><div className="career-entry-save-count"><strong>{loading || error?.reading ? '—' : saves.length}</strong><span>{saves.length === 1 ? 'sparad karriär' : 'sparade karriärer'}</span></div><Link className="hm-btn career-entry-rail-button" href="/new-game" aria-disabled={!!busy} onClick={event => { if (busy) event.preventDefault(); }}>Börja en ny karriär →</Link></>;
  const context = loading ? <><span className="career-entry-overline">Dina sparade uppdrag</span><div className="career-entry-context-empty"><strong>Klubbarna väntar.</strong><p>Läser din karriärlista innan du väljer nästa uppdrag.</p></div></>
    : selected ? <Spread entry={selected} busy={!!busy} onLoad={() => void handleLoad(selected.save)} />
    : <><span className="career-entry-overline">Din nästa säsong</span><div className="career-entry-context-empty"><strong>En klubb.<br />En ny historia.</strong><p>Skapa din första karriär och välj klubben du vill leda.</p></div></>;
  const footer = <><Link className="hm-btn career-entry-back" href="/" aria-disabled={!!busy} onClick={event => { if (busy) event.preventDefault(); }}>← Tillbaka till huvudmenyn</Link><p>{selected ? `${selected.save.manager.name} · ${selected.cover?.clubShortName ?? 'Din klubb'}` : 'Din nästa karriär börjar med ett lag.'}</p>{selected ? <button type="button" className="hm-btn hm-btn-primary career-entry-next" disabled={!!busy} onClick={() => void handleLoad(selected.save)}>{busy?.action === 'OPEN' ? 'Öppnar karriären…' : 'Fortsätt karriären →'}</button> : !loading && !error?.reading ? <Link className="hm-btn hm-btn-primary career-entry-next" href="/new-game">Nytt spel →</Link> : null}</>;

  return <CareerEntryFrame label="Ladda spel" rail={rail} context={context} footer={footer} clubId={selected?.save.clubId}>
    <div className="career-entry-content career-load-content" aria-busy={loading || !!busy}>
      <header className="career-entry-step-heading"><span className="career-entry-overline">Dina handbollskarriärer</span><h1 id="career-entry-heading">Ladda spel</h1><p>Välj en karriär och fortsätt från din sparade dag.</p></header>
      {error && !error.reading && <section className="ce-state-card" data-tone="error" role="alert"><strong>{error.title}</strong><p>{error.message}</p></section>}
      {notice && <p className="ce-shelf-notice" role="status">{notice}</p>}
      {loading ? <div className="ce-shelf" role="status" aria-label="Läser sparade karriärer…">{[0, 1, 2].map(i => <div key={i} className="ce-shelf-cover ce-skeleton" aria-hidden="true"><span /><span /><span /></div>)}<span className="career-entry-sr-only">Läser sparade karriärer…</span></div>
        : error?.reading ? <section className="ce-state-card" data-tone="error" role="alert">
          <span className="ce-kicker">Webbläsarens lagring</span>
          <strong>{error.title}</strong>
          <p>Dina karriärer sparas i webbläsarens egen databas (IndexedDB) på den här enheten. Den gick inte att läsa just nu – det händer i privata fönster, när lagring är blockerad eller när disken är full.</p>
          <p className="ce-state-detail">{error.message}</p>
          <div className="ce-state-actions"><button type="button" className="hm-btn hm-btn-primary" onClick={() => void load()}>Försök igen</button><Link className="hm-btn" href="/settings#data">Om säkerhetskopior →</Link></div>
        </section>
        : entries.length === 0 ? <section className="ce-state-card ce-invite">
          <span className="ce-kicker">Första kapitlet</span>
          <strong>Vilken klubb blir din?</strong>
          <p>Inga sparade karriärer hittades. Börja med ett lag, en manager och en säsong.</p>
          <span className="ce-invite-crests" aria-hidden="true">{TEASER_CLUBS.map(c => <ClubCrest key={c.id} clubId={c.id} shortName={c.shortName} primaryColor={c.primaryColor} size={34} />)}</span>
          <Link className="hm-btn hm-btn-primary" href="/new-game">Skapa en karriär →</Link>
        </section>
        : <ul className="ce-shelf" aria-label="Sparade karriärer">
          {entries.map(entry => <ShelfCover key={entry.save.saveId} entry={entry} selected={entry.save.saveId === selectedId} busy={busy}
            onSelect={() => { setSelectedId(entry.save.saveId); setPendingDeleteId(null); }} onLoad={() => void handleLoad(entry.save)} onExport={() => void handleExport(entry.save.saveId)}
            onRequestDelete={button => { deleteReturnRef.current = button; setSelectedId(entry.save.saveId); setPendingDeleteId(entry.save.saveId); }} />)}
          <li><Link className="ce-shelf-cover ce-shelf-new" href="/new-game"><span aria-hidden="true">+</span><strong>Ny karriär</strong><small>Välj en klubb och skriv nästa historia.</small></Link></li>
        </ul>}
      {busy?.action === 'OPEN' && selected && <div className="career-load-opening" role="status"><strong>Återvänder till {selected.cover?.clubShortName ?? 'klubben'}…</strong><span>Öppnar din sparade karriär.</span></div>}
    </div>
    {pending && <DeleteDialog entry={pending} busy={busy} onCancel={cancelDelete} onExport={() => void handleExport(pending.save.saveId)} onConfirm={() => void handleDelete(pending.save.saveId)} />}
  </CareerEntryFrame>;
}

function ShelfCover({ entry, selected, busy, onSelect, onLoad, onExport, onRequestDelete }: {
  entry: Entry; selected: boolean; busy: { id: string; action: string } | null;
  onSelect: () => void; onLoad: () => void; onExport: () => void; onRequestDelete: (button: HTMLButtonElement) => void;
}) {
  const { save, cover } = entry;
  return <li className="ce-shelf-cover" data-selected={selected} style={neon(save.clubId)}>
    <button type="button" className="ce-shelf-pick" aria-pressed={selected} disabled={!!busy} onClick={onSelect}>
      <span className="ce-shelf-mast"><ClubCrest shortName={cover?.clubShortName ?? save.clubId} primaryColor={cover?.primaryColor ?? ''} clubId={save.clubId} size={40} /><span><strong>{cover?.clubName ?? save.clubId}</strong><small className="ce-num">{cover?.issueLine ?? save.gameDate}</small></span></span>
      <span className="ce-shelf-headline">{cover?.headline ?? 'Karriären öppnas där du lämnade den.'}</span>
      <span className="ce-shelf-meta"><span>{save.manager.name}</span><span className="ce-num">Senast spelad {formatPlayedAt(save.lastPlayedAt)}</span></span>
    </button>
    <div className="ce-shelf-actions">
      <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!!busy} onClick={onLoad}>{busy?.id === save.saveId && busy.action === 'OPEN' ? 'Öppnar…' : 'Ladda'}</button>
      <button type="button" className="hm-btn hm-btn-sm" disabled={!!busy} onClick={onExport}>{busy?.id === save.saveId && busy.action === 'EXPORT' ? 'Exporterar…' : 'Exportera'}</button>
      <button type="button" className="hm-btn hm-btn-sm ce-danger-ghost" disabled={!!busy} aria-haspopup="dialog" onClick={event => onRequestDelete(event.currentTarget)}>Ta bort</button>
    </div>
    {selected && cover && <div className="ce-shelf-spread-inline"><SpreadBody cover={cover} /></div>}
  </li>;
}

/** The right-hand spread for the selected cover: last five results and the next match. */
function Spread({ entry, busy, onLoad }: { entry: Entry; busy: boolean; onLoad: () => void }) {
  const { save, cover } = entry;
  return <div className="ce-spread" style={neon(save.clubId)}>
    <span className="career-entry-overline">Din sparade karriär</span>
    <div className="career-entry-club-mark"><ClubCrest shortName={cover?.clubShortName ?? save.clubId} primaryColor={cover?.primaryColor ?? ''} clubId={save.clubId} size={110} /></div>
    <h2 className="career-entry-club-name">{cover?.clubName ?? 'Sparad klubb'}</h2>
    <p className="career-entry-club-league">{cover?.competitionName}</p>
    {cover && <p className="ce-spread-headline">{cover.headline}</p>}
    <section className="career-entry-manager-summary"><span className="career-entry-overline">På bänken</span><strong>{save.manager.name}</strong><span>{NATIONS.find(nation => nation.code === save.manager.nationality)?.name ?? save.manager.nationality}</span></section>
    {cover ? <SpreadBody cover={cover} /> : <p className="ce-spread-empty">Säsongens läge visas när karriären har öppnats en gång.</p>}
    <button type="button" className="hm-btn hm-btn-primary ce-spread-cta" disabled={busy} onClick={onLoad}>Fortsätt →</button>
  </div>;
}

function SpreadBody({ cover }: { cover: SaveCover }) {
  return <>
    <dl className="career-entry-facts">
      <div><dt>Speldatum</dt><dd>{formatGameDate(cover.gameDate)}</dd></div>
      <div><dt>Säsong</dt><dd>{cover.seasonId ?? 'Läses när karriären öppnas'}</dd></div>
      {cover.position && cover.tableSize && <div><dt>Tabellen</dt><dd className="ce-num">{cover.position}:a av {cover.tableSize}</dd></div>}
    </dl>
    {cover.recent.length > 0 ? <section className="ce-spread-results"><span className="career-entry-overline">Senaste matcherna</span><ol>{[...cover.recent].reverse().map(r => <li key={r.fixtureId} data-outcome={r.outcome}><i>{r.outcome}</i><span>{r.home ? 'H' : 'B'} · {r.opponent}</span><strong className="ce-num">{r.ours}–{r.theirs}</strong></li>)}</ol></section>
      : cover.hasCareer && <p className="ce-spread-empty">Ingen match spelad ännu.</p>}
    {cover.nextFixture && <section className="career-entry-next-match"><span className="career-entry-overline">Nästa match</span><strong>{cover.nextFixture.opponent}</strong><p>{formatGameDate(cover.nextFixture.date)} · {cover.nextFixture.home ? 'Hemma' : 'Borta'} · {cover.nextFixture.label}</p></section>}
  </>;
}

/** ENT-04a A: a consequence dialog -- crest, season and dates, 'Kan inte ångras', and Exportera först as the safe action. */
function DeleteDialog({ entry, busy, onCancel, onExport, onConfirm }: { entry: Entry; busy: { id: string; action: string } | null; onCancel: () => void; onExport: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    keep.current?.focus();
    return () => el?.close();
  }, []);
  const { save, cover } = entry;
  return <dialog ref={dialog} className="ce-dialog" style={neon(save.clubId)} aria-labelledby={`delete-${save.saveId}`} aria-describedby={`delete-${save.saveId}-desc`} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <header><ClubCrest shortName={cover?.clubShortName ?? save.clubId} primaryColor={cover?.primaryColor ?? ''} clubId={save.clubId} size={48} /><div><span className="ce-kicker">Ta bort karriär</span><h2 id={`delete-${save.saveId}`}>Ta bort {save.manager.name}s karriär?</h2></div></header>
    <p id={`delete-${save.saveId}-desc`}>{cover?.clubName ?? save.clubId} · {cover?.seasonId ?? 'säsong okänd'} · speldatum {formatGameDate(save.gameDate)}. Startad {formatPlayedAt(save.createdAt)}, senast spelad {formatPlayedAt(save.lastPlayedAt)}.</p>
    <p className="ce-dialog-warn"><strong>Kan inte ångras.</strong> Den sparade karriären och hela dess säsongshistorik tas bort från den här enheten. Exportera en säkerhetskopia först om du kan vilja fortsätta senare.</p>
    <footer>
      <button type="button" className="hm-btn hm-btn-primary" disabled={!!busy} onClick={onExport}>{busy?.action === 'EXPORT' ? 'Exporterar…' : 'Exportera först'}</button>
      <button type="button" ref={keep} className="hm-btn" disabled={busy?.action === 'DELETE'} onClick={onCancel}>Behåll karriären</button>
      <button type="button" className="hm-btn career-entry-delete" disabled={!!busy} onClick={onConfirm}>{busy?.action === 'DELETE' ? 'Tar bort…' : 'Ta bort karriären'}</button>
    </footer>
  </dialog>;
}

function formatPlayedAt(value: string) { return new Date(value).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' }); }
