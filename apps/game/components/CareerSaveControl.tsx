'use client';
// Arena 231 -- ENT-08b A "Autosave indicator + overflow": a quiet 'Sparat · 12:04' indicator driven by the career
// write queue (CareerContext.saveStatus / retrySave -- the save logic itself is untouched), a quick-save button and
// a ⋯ menu with Spara nu, Spara och avsluta, Exportera säkerhetskopia, Importera… (a consequence dialog first:
// the running career is replaced) plus Inställningar and Rapportera bugg / Feedback. Ctrl/Cmd+S saves.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { exportSaveAsJson, importSaveFromJson, saveCareerState } from '@/lib/save/saveRepository';
import { FeedbackModal, type FeedbackContext } from './FeedbackModal';
import { appShellLinks } from '@/app/app-shell/contract';
import './entry/entry.css';
import './shell/shell-231.css';

const APPS_HREF = appShellLinks()[0].href;
const clock = (at: number) => new Date(at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

export default function CareerSaveControl({ compact = false, feedbackContext }: { compact?: boolean; feedbackContext?: FeedbackContext } = {}) {
  const { career, save, saveStatus, retrySave } = useCareer();
  const router = useRouter();
  const [status, setStatus] = useState(''), [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const persist = useCallback(async (exit: boolean) => {
    setSaving(true); setStatus(''); setFailed(false);
    try { await saveCareerState(save.saveId, career); if (exit) router.push('/'); }
    catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : 'Kunde inte spara.'); }
    finally { setSaving(false); }
  }, [career, router, save.saveId]);
  async function exportBackup() {
    setSaving(true); setStatus(''); setFailed(false);
    try {
      // Include the current live tick, even between background autosaves.
      await saveCareerState(save.saveId, career);
      await exportSaveAsJson(save.saveId);
      setStatus('Säkerhetskopian har skickats till webbläsarens nedladdningar.');
    } catch (error) {
      setFailed(true); setStatus(error instanceof Error ? error.message : 'Exporten misslyckades. Försök igen.');
    } finally { setSaving(false); }
  }
  async function importBackup(file: File) {
    setSaving(true); setStatus(''); setFailed(false);
    try {
      await importSaveFromJson(file);
      // A full navigation unmounts the previous career provider and live clock.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Client routing retains the mounted career provider.
      window.location.assign('/career');
    } catch (error) {
      setFailed(true); setStatus(error instanceof Error ? error.message : 'Importen misslyckades. Välj en komplett exporterad sparafil och försök igen.');
      setSaving(false);
    }
  }
  // Ctrl/Cmd+S saves (only the top-bar instance listens, so a phone with the Mer sheet open does not save twice).
  useEffect(() => {
    if (!compact) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saving) void persist(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact, persist, saving]);
  const closeMenu = () => { if (menu.current) menu.current.open = false; };

  const phase = saving ? 'SAVING' : saveStatus?.phase;
  const indicator = <span className="game-save-indicator" role="status" data-phase={phase ?? 'IDLE'} title={saveStatus?.phase === 'FAILED' ? saveStatus.error : undefined}>
    {phase === 'SAVING' ? <><i className="game-save-spinner" aria-hidden="true" />Sparar…</>
      : phase === 'FAILED' ? <>Kunde inte spara</>
      : phase === 'SAVED' ? <><b aria-hidden="true">✓</b>Sparat · <span className="ce-num">{clock(saveStatus!.at)}</span></>
      : <>Autosparar</>}
  </span>;
  const items = <>
    <button type="button" className="hm-btn hm-btn-sm" disabled={saving} onClick={() => { closeMenu(); void persist(false); }}>Spara nu <kbd aria-hidden="true">Ctrl S</kbd></button>
    <button type="button" className="hm-btn hm-btn-sm" disabled={saving} onClick={() => { closeMenu(); void persist(true); }}>Spara och avsluta</button>
    <button type="button" className="hm-btn hm-btn-sm" disabled={saving} onClick={() => { closeMenu(); void exportBackup(); }}>Exportera säkerhetskopia</button>
    <button type="button" className="hm-btn hm-btn-sm" disabled={saving} aria-haspopup="dialog" onClick={() => { closeMenu(); setConfirmImport(true); }}>Importera…</button>
  </>;

  return <div className="game-save-control" data-compact={compact}>
    {indicator}
    {saveStatus?.phase === 'FAILED' && !saving && <button type="button" className="hm-btn hm-btn-sm" onClick={retrySave}>Försök igen</button>}
    <button type="button" className="hm-btn hm-btn-sm game-save-quick" disabled={saving} onClick={() => void persist(false)} title="Spara nu (Ctrl+S)">Spara</button>
    {compact ? <details ref={menu} className="game-save-more">
      <summary className="hm-btn hm-btn-sm" aria-label="Fler alternativ" title="Spara, säkerhetskopior, inställningar och feedback">⋯</summary>
      <div className="game-save-more-menu" role="group" aria-label="Fler alternativ">
        {items}
        <hr />
        <Link className="hm-btn hm-btn-sm" href="/career/settings" onClick={closeMenu}>Inställningar</Link>
        <button type="button" className="hm-btn hm-btn-sm" aria-haspopup="dialog" onClick={() => { closeMenu(); setFeedbackOpen(true); }}>Rapportera bugg / Feedback</button>
        {/* ENT-06: phone form of the host corner pill (hidden ≥761px by app-shell/shell.css, where the pill is shown). */}
        <a className="hm-btn hm-btn-sm game-save-apps-link" href={APPS_HREF} onClick={closeMenu}>← Tillbaka till Apps</a>
      </div>
    </details> : <>
      {items}
      <button type="button" className="hm-btn hm-btn-sm" aria-haspopup="dialog" onClick={() => setFeedbackOpen(true)}>Rapportera bugg / Feedback</button>
    </>}
    <input ref={importInput} type="file" accept=".json,application/json" hidden aria-label="Importera sparafil" onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file && !saving) void importBackup(file);
    }} />
    {status && <span role={failed ? 'alert' : 'note'} className="game-save-feedback" data-error={failed}>{status}<button type="button" className="game-save-feedback-close" aria-label="Stäng meddelandet" onClick={() => setStatus('')}>×</button></span>}
    {confirmImport && <ImportDialog saving={saving} onCancel={() => setConfirmImport(false)} onExport={() => void exportBackup()} onChoose={() => { setConfirmImport(false); importInput.current?.click(); }} />}
    {feedbackOpen && <FeedbackModal context={feedbackContext} onClose={() => setFeedbackOpen(false)} />}
  </div>;
}

function ImportDialog({ saving, onCancel, onExport, onChoose }: { saving: boolean; onCancel: () => void; onExport: () => void; onChoose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={dialog} className="ce-dialog game-save-dialog" aria-labelledby="import-title" onCancel={e => { e.preventDefault(); onCancel(); }}>
    <header><div><span className="ce-kicker">Importera sparfil</span><h2 id="import-title">Ersätta den här karriären?</h2></div></header>
    <p>När du importerar en sparfil öppnas den i stället för karriären du spelar nu. Det som inte är sparat i den nuvarande karriären följer inte med.</p>
    <p className="ce-dialog-warn"><strong>Exportera först</strong> om du vill kunna gå tillbaka till karriären som den är just nu.</p>
    <footer>
      <button type="button" className="hm-btn" disabled={saving} onClick={onExport}>{saving ? 'Arbetar…' : 'Exportera först'}</button>
      <button type="button" className="hm-btn" onClick={onCancel}>Avbryt</button>
      <button type="button" className="hm-btn hm-btn-primary" disabled={saving} onClick={onChoose}>Välj fil…</button>
    </footer>
  </dialog>;
}
