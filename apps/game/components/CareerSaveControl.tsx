'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { saveCareerState } from '@/lib/save/saveRepository';
export default function CareerSaveControl() {
  const { career, save } = useCareer();
  const router = useRouter();
  const [status, setStatus] = useState(''), [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  async function persist(exit: boolean) {
    setSaving(true); setStatus(''); setFailed(false);
    try { await saveCareerState(save.saveId, career); setStatus('Sparat'); if (exit) router.push('/'); }
    catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : 'Kunde inte spara.'); }
    finally { setSaving(false); }
  }
  return <div className="game-save-control"><button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void persist(false)}>{saving ? 'Sparar…' : 'Spara'}</button><button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void persist(true)}>Spara och avsluta</button>{status && <span role={failed ? 'alert' : 'status'} className="game-save-feedback" data-error={failed}>{status}</span>}</div>;
}
