'use client';
// Arena Nights -- SQD-04 searchable entity picker: type a name, club or position; own squad listed first.
import { useId, useMemo, useState } from 'react';
import type { PlayerMock } from '@/lib/game-data';
import { getClub } from '@/lib/game-data';
import { searchPlayers } from '@/lib/players/compareModel';

export function ComparePicker({ label, players, ownClubId, value, onPick }: { label: string; players: readonly PlayerMock[]; ownClubId: string; value: PlayerMock | null; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const hits = useMemo(() => searchPlayers(players, ownClubId, query, (id) => getClub(id)?.shortName ?? '', 12), [players, ownClubId, query]);
  const pick = (id: string) => { onPick(id); setQuery(''); setOpen(false); };
  return <div className="hm-compare-picker">
    <label>{label}
      <input className="hm-input" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        placeholder={value ? `${value.firstName} ${value.lastName} -- sök för att byta` : 'Sök namn, klubb eller position'}
        value={query} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); pick(hits[0].id); } if (e.key === 'Escape') setOpen(false); }} />
    </label>
    {open && <ul id={listId} role="listbox" className="hm-compare-picker-list">
      {hits.length === 0 ? <li className="hm-dossier-note">Ingen spelare matchar ”{query}”.</li> : hits.map(p => <li key={p.id} role="option" aria-selected={value?.id === p.id}>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(p.id)}>
          <span className="hm-position-code">{p.position}</span> {p.firstName} {p.lastName}
          <small>{p.clubId === ownClubId ? 'Din trupp' : p.clubId ? getClub(p.clubId)?.shortName ?? 'Okänd klubb' : 'Fri agent'}</small>
        </button>
      </li>)}
      <li><button type="button" className="hm-compare-picker-close" onClick={() => setOpen(false)}>Stäng listan</button></li>
    </ul>}
  </div>;
}
