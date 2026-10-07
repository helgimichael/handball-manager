'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { saveCareerState } from '@/lib/save/saveRepository';
export default function CareerSaveControl() {
  const { career, save } = useCareer();
  const router = useRouter();
  const [status, setStatus] = useState(''), [saving, setSaving] = useState(false);
  async function persist(exit: boolean) {
    setSaving(true); setStatus('');
    try { await saveCareerState(save.saveId, career); setStatus('Sparat'); if (exit) router.push('/'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Kunde inte spara.'); }
    finally { setSaving(false); }
  }
  return <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void persist(false)}>{saving ? 'Sparar…' : 'Spara'}</button><button className="hm-btn hm-btn-sm" disabled={saving} onClick={() => void persist(true)}>Spara och avsluta</button><span role="status" className="hm-text-muted">{status}</span></div>;
}
