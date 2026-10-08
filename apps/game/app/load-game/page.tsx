"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { deleteSave, listSaves, setActiveSaveId, touchSave, type CareerSave } from "@/lib/save/saveRepository";
import { COMPETITIONS, NATIONS, getClub } from "@/lib/game-data";
import { formatGameDate } from "@/lib/career/dateUtils";
import ClubCrest from "@/components/ClubCrest";
import CareerEntryFrame from "@/components/game/CareerEntryFrame";
import "@/components/game/career-entry.css";

type SaveError = { title: string; message: string; reading?: boolean };
export default function LoadGamePage() {
  const router = useRouter();
  const [saves, setSaves] = useState<readonly CareerSave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SaveError | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: 'OPEN' | 'DELETE' } | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteReturnRef = useRef<HTMLButtonElement | null>(null);
  const selectedSave = saves.find(save => save.saveId === selectedId);
  const club = selectedSave ? getClub(selectedSave.clubId) : undefined;
  const competition = COMPETITIONS.find(item => item.id === club?.competitionId);
  const career = selectedSave?.careerState;
  const ownFixtures = career?.fixtures.filter(fixture => fixture.homeClubId === selectedSave?.clubId || fixture.awayClubId === selectedSave?.clubId) ?? [];
  const played = ownFixtures.filter(fixture => career?.results[fixture.id]).length;
  const nextFixture = ownFixtures.filter(fixture => !career?.results[fixture.id] && fixture.date >= (career?.gameDate ?? '')).sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextOpponentId = nextFixture ? nextFixture.homeClubId === selectedSave?.clubId ? nextFixture.awayClubId : nextFixture.homeClubId : undefined;

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
  useEffect(() => { if (pendingDeleteId) cancelDeleteRef.current?.focus(); }, [pendingDeleteId]);

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
  function cancelDelete() {
    setPendingDeleteId(null);
    deleteReturnRef.current?.focus();
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
    } catch (cause: unknown) {
      setError({ title: 'Karriären kunde inte tas bort', message: cause instanceof Error ? cause.message : 'Kunde inte ta bort karriären.' });
    } finally {
      setBusy(null);
    }
  }

  const rail = <><span className="career-entry-overline">Sparade karriärer</span><h2>Återvänd<br />till klubben.</h2><p className="career-entry-rail-copy">Ditt lag, dina beslut och din säsong väntar där du lämnade dem.</p><div className="career-entry-save-count"><strong>{loading || error?.reading ? '—' : saves.length}</strong><span>{saves.length === 1 ? 'sparad karriär' : 'sparade karriärer'}</span></div><Link className="hm-btn career-entry-rail-button" href="/new-game" aria-disabled={!!busy} onClick={event => { if (busy) event.preventDefault(); }}>Börja en ny karriär →</Link></>;
  const context = loading ? <><span className="career-entry-overline">Dina sparade uppdrag</span><div className="career-entry-context-empty"><strong>Klubbarna väntar.</strong><p>Läser din karriärlista innan du väljer nästa uppdrag.</p></div></> : selectedSave ? <><span className="career-entry-overline">Din sparade karriär</span>{club && <div className="career-entry-club-mark"><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} size={126} /></div>}<h2 className="career-entry-club-name">{club?.name ?? 'Sparad klubb'}</h2><p className="career-entry-club-league">{competition?.name}</p><section className="career-entry-manager-summary"><span className="career-entry-overline">På bänken</span><strong>{selectedSave.manager.name}</strong><span>{NATIONS.find(nation => nation.code === selectedSave.manager.nationality)?.name ?? selectedSave.manager.nationality}</span></section><dl className="career-entry-facts"><Fact label="Speldatum" value={formatGameDate(selectedSave.gameDate)} /><Fact label="Säsong" value={career?.seasonId ?? 'Läses när karriären öppnas'} /><Fact label="Senast spelad" value={formatPlayedAt(selectedSave.lastPlayedAt)} />{career && <Fact label="Klubbens spelade matcher" value={String(played)} />}</dl>{nextFixture && <section className="career-entry-next-match"><span className="career-entry-overline">Nästa match</span><strong>{getClub(nextOpponentId ?? '')?.name ?? 'Motståndare'}</strong><p>{formatGameDate(nextFixture.date)} · {nextFixture.homeClubId === selectedSave.clubId ? 'Hemma' : 'Borta'}</p></section>}</> : <><span className="career-entry-overline">Din nästa säsong</span><div className="career-entry-context-empty"><strong>En klubb.<br />En ny historia.</strong><p>Skapa din första karriär och välj klubben du vill leda.</p></div><section className="career-entry-manager-summary"><span className="career-entry-overline">Handball Manager</span><strong>Från avkast till slutsignal.</strong><span>Bygg laget. Forma säsongen.</span></section></>;
  const footer = <><Link className="hm-btn career-entry-back" href="/" aria-disabled={!!busy} onClick={event => { if (busy) event.preventDefault(); }}>← Tillbaka till huvudmenyn</Link><p>{selectedSave ? `${selectedSave.manager.name} · ${club?.shortName ?? 'Din klubb'}` : 'Din nästa karriär börjar med ett lag.'}</p>{selectedSave ? <button type="button" className="hm-btn hm-btn-primary career-entry-next" disabled={!!busy} onClick={() => void handleLoad(selectedSave)}>{busy?.action === 'OPEN' ? 'Öppnar karriären…' : 'Fortsätt karriären →'}</button> : !loading && !error?.reading ? <Link className="hm-btn hm-btn-primary career-entry-next" href="/new-game">Nytt spel →</Link> : null}</>;

  return <CareerEntryFrame label="Ladda spel" rail={rail} context={context} footer={footer}>
    <div className="career-entry-content career-load-content" aria-busy={loading || !!busy}>
      <header className="career-entry-step-heading"><span className="career-entry-overline">Dina handbollskarriärer</span><h1 id="career-entry-heading">Ladda spel</h1><p>Välj ett uppdrag och fortsätt från din sparade dag.</p></header>
      {error && <section className="career-entry-error" role="alert"><strong>{error.title}</strong><p>{error.message}</p>{error.reading && <button className="hm-btn" onClick={() => window.location.reload()}>Försök igen</button>}</section>}
      {loading ? <div className="career-entry-loading" role="status"><span className="career-entry-overline">Dina uppdrag</span><strong>Läser sparade karriärer…</strong><p>Hämtar klubbar, managers och säsonger.</p></div> : error?.reading ? null : saves.length === 0 ? <section className="career-entry-empty career-load-empty"><span className="career-entry-overline">Första kapitlet</span><strong>Vilken klubb blir din?</strong><p>Inga sparade karriärer hittades. Börja med ett lag, en manager och en säsong.</p><Link className="hm-btn hm-btn-primary" href="/new-game">Skapa en karriär →</Link></section> : <div className="career-save-table-wrap"><table className="hm-table career-save-table"><thead><tr><th>Manager</th><th>Klubb</th><th>Säsong</th><th>Speldatum</th><th>Senast spelad</th><th>Karriär</th></tr></thead><tbody>{saves.map(save => {
        const savedClub = getClub(save.clubId);
        return <SaveRows key={save.saveId} save={save} clubName={savedClub?.name ?? '—'} shortName={savedClub?.shortName ?? 'HM'} primaryColor={savedClub?.primaryColor ?? ''} selected={save.saveId === selectedId} pendingDelete={save.saveId === pendingDeleteId} busy={busy} cancelRef={cancelDeleteRef} onSelect={() => { setSelectedId(save.saveId); setPendingDeleteId(null); }} onLoad={() => void handleLoad(save)} onRequestDelete={button => { deleteReturnRef.current = button; setSelectedId(save.saveId); setPendingDeleteId(save.saveId); }} onCancelDelete={cancelDelete} onConfirmDelete={() => void handleDelete(save.saveId)} />;
      })}</tbody></table></div>}
      {busy?.action === 'OPEN' && selectedSave && <div className="career-load-opening" role="status"><strong>Återvänder till {getClub(saves.find(save => save.saveId === busy.id)?.clubId ?? '')?.shortName ?? 'klubben'}…</strong><span>Öppnar din sparade karriär.</span></div>}
    </div>
  </CareerEntryFrame>;
}

function SaveRows({ save, clubName, shortName, primaryColor, selected, pendingDelete, busy, cancelRef, onSelect, onLoad, onRequestDelete, onCancelDelete, onConfirmDelete }: {
  save: CareerSave; clubName: string; shortName: string; primaryColor: string; selected: boolean; pendingDelete: boolean;
  busy: { id: string; action: 'OPEN' | 'DELETE' } | null; cancelRef: RefObject<HTMLButtonElement | null>;
  onSelect: () => void; onLoad: () => void; onRequestDelete: (button: HTMLButtonElement) => void; onCancelDelete: () => void; onConfirmDelete: () => void;
}) {
  return <><tr data-highlight={selected}><td><button type="button" className="career-save-select" aria-pressed={selected} disabled={!!busy} onClick={onSelect}><strong>{save.manager.name}</strong><small>{selected ? 'Vald karriär' : 'Välj karriär →'}</small></button></td><td><div className="career-save-club"><ClubCrest shortName={shortName} primaryColor={primaryColor} size={36} /><strong>{clubName}</strong></div></td><td>{save.careerState?.seasonId ?? '—'}</td><td>{save.gameDate}</td><td className="career-save-played-at">{formatPlayedAt(save.lastPlayedAt)}</td><td><div className="career-save-actions"><button type="button" className="hm-btn hm-btn-sm hm-btn-primary" disabled={!!busy} onClick={onLoad}>{busy?.id === save.saveId && busy.action === 'OPEN' ? 'Öppnar…' : 'Ladda'}</button><button type="button" className="hm-btn hm-btn-sm" disabled={!!busy} aria-expanded={pendingDelete} onClick={event => onRequestDelete(event.currentTarget)}>Ta bort</button></div></td></tr>{pendingDelete && <tr className="career-save-confirm-row"><td colSpan={6}><section className="career-save-confirm" role="group" aria-labelledby={`delete-${save.saveId}`} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onCancelDelete(); } }}><div><strong id={`delete-${save.saveId}`}>Ta bort {save.manager.name}s karriär?</strong><p>{clubName} · {save.gameDate}. Den sparade karriären och dess säsongshistorik tas bort.</p></div><button type="button" ref={cancelRef} className="hm-btn" disabled={!!busy} onClick={onCancelDelete}>Behåll karriären</button><button type="button" className="hm-btn career-entry-delete" disabled={!!busy} onClick={onConfirmDelete}>{busy?.action === 'DELETE' ? 'Tar bort…' : 'Ta bort karriären'}</button></section></td></tr>}</>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function formatPlayedAt(value: string) { return new Date(value).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' }); }
