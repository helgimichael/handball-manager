'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { exportSaveAsJson, importSaveFromJson, saveCareerState } from '@/lib/save/saveRepository';
/** ENT-08 C: in the top bar (`compact`) quick save stays visible; save-and-quit and the save files live in a ⋯ overflow. */
export default function CareerSaveControl({ compact = false }: { compact?: boolean } = {}) {
  const { career, save } = useCareer();
  const router = useRouter();
  const [status, setStatus] = useState(''), [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  async function persist(exit: boolean) {
    setSaving(true); setStatus(''); setFailed(false);
    try { await saveCareerState(save.saveId, career); setStatus('Sparat'); if (exit) router.push('/'); }
    catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : 'Kunde inte spara.'); }
    finally { setSaving(false); }
  }
  async function exportBackup() {
    setSaving(true); setStatus(''); setFailed(false);
    try {
      // Include the current live tick, even between background autosaves.
      await saveCareerState(save.saveId, career);
      await exportSaveAsJson(save.saveId);
      setStatus('Sparafilen har skickats till webbläsarens nedladdningar.');
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
  return <div className="game-save-control">
    <button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void persist(false)}>{saving ? 'Arbetar…' : 'Spara'}</button>
    {compact ? <details className="game-save-more" onClick={e => { if ((e.target as HTMLElement).closest('button')) (e.currentTarget as HTMLDetailsElement).open = false; }}>
      <summary className="hm-btn hm-btn-sm" aria-label="Fler sparalternativ" title="Spara och avsluta, exportera eller importera sparfil">⋯</summary>
      <div className="game-save-more-menu" role="group" aria-label="Sparalternativ">
        <button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void persist(true)}>Spara och avsluta</button>
        <button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void exportBackup()}>Exportera sparafil</button>
        <button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => importInput.current?.click()}>Importera sparafil</button>
      </div>
    </details> : <>
      <button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void persist(true)}>Spara och avsluta</button>
      <button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void exportBackup()}>Exportera sparafil</button>
      <button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => importInput.current?.click()}>Importera sparafil</button>
    </>}
    <input ref={importInput} type="file" accept=".json,application/json" hidden aria-label="Importera sparafil" onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file && !saving) void importBackup(file);
    }} />
    {status && <span role={failed ? 'alert' : 'status'} className="game-save-feedback" data-error={failed}>{status}</span>}
  </div>;
}
