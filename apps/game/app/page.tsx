'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMostRecentSave, setActiveSaveId, touchSave, type CareerSave } from '@/lib/save/saveRepository';
import { CLUBS, getClub } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';

const FEATURED_CLUBS = CLUBS.filter(c => c.playable).slice(0, 12);

export default function TitleScreen() {
  const router = useRouter();
  const [lastSave, setLastSave] = useState<CareerSave | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMostRecentSave()
      .then(save => { if (!cancelled) setLastSave(save); })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Kunde inte läsa sparade karriärer.'); });
    return () => { cancelled = true; };
  }, []);

  async function resume() {
    if (!lastSave) return;
    setActiveSaveId(lastSave.saveId);
    try {
      await touchSave(lastSave.saveId);
      router.push('/career');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunde inte öppna karriären.');
    }
  }

  const savedClub = lastSave ? getClub(lastSave.clubId) : undefined;

  return (
    <main className="game-title">
      <svg viewBox="0 0 600 1000" fill="none" aria-hidden="true">
        <rect x="20" y="20" width="560" height="960" stroke="#eee" strokeWidth="2" />
        <path d="M20 500h560M80 20a220 220 0 0 0 440 0M80 980a220 220 0 0 1 440 0" stroke="#eee" strokeWidth="2" />
        <circle cx="300" cy="500" r="80" stroke="#eee" strokeWidth="2" />
      </svg>
      <section>
        <div className="game-overline">SJU POSITIONER. SEXTIO MINUTER. DIN KLUBB.</div>
        <h1>HANDBALL<span>MANAGER</span></h1>
        <p>Bygg laget. Känn rivalerna. Forma säsongen från första avkast till slutsignal.</p>
        <div
          aria-label="Spelbara svenska handbollsklubbar"
          style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 18 }}
        >
          {FEATURED_CLUBS.map(club => (
            <span key={club.id} title={`${club.name} · ${club.city ?? ''}`} style={{ display: 'inline-flex', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))' }}>
              <ClubCrest clubId={club.id} shortName={club.shortName} primaryColor={club.primaryColor} size={36} />
            </span>
          ))}
        </div>
      </section>
      <nav aria-label="Huvudmeny">
        <button onClick={() => router.push('/new-game')}>
          NYTT SPEL
          <small>Din klubb. Din nästa säsong.</small>
        </button>
        <button disabled={!lastSave} onClick={() => void resume()}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {savedClub && <ClubCrest clubId={savedClub.id} shortName={savedClub.shortName} primaryColor={savedClub.primaryColor} size={28} />}
            <span>FORTSÄTT</span>
          </span>
          <small>{lastSave ? `${lastSave.manager.name} · ${savedClub?.shortName ?? lastSave.clubId} · ${lastSave.gameDate}` : 'Ingen sparad karriär ännu'}</small>
        </button>
        <button onClick={() => router.push('/load-game')}>
          LADDA SPEL
          <small>Återvänd till din handbollsvärld</small>
        </button>
        <button onClick={() => router.push('/settings')}>
          INSTÄLLNINGAR
          <small>Valuta och matchhastighet</small>
        </button>
        {error && <p role="alert">{error}</p>}
      </nav>
      <span className="game-title-footer">GAME EXPERIENCE v2 · HANDBOLLSLIGAN & ALLSVENSKAN · 2026</span>
    </main>
  );
}
