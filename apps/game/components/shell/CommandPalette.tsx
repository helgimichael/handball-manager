'use client';
// Arena Nights C5.1 -- ENT-08a command palette. Ctrl/Cmd+K (or the header search field / phone search icon)
// opens a centred modal (full-screen sheet on phones). Arrows + Enter, Tab cycles groups, Escape closes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { paletteResults, type PaletteItem } from '@/lib/career/commandPalette';
import { routeAccess } from '@/lib/career/clubAccess';

const RECENT_KEY = 'hm-palette-recent';
function readRecent(): PaletteItem[] {
  try { const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.slice(0, 5) : []; } catch { return []; }
}
function pushRecent(item: PaletteItem) {
  try { const next = [item, ...readRecent().filter((r) => r.id !== item.id)].slice(0, 5); window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable: recents are a convenience only */ }
}

export function useCommandPaletteHotkey(open: () => void) {
  const latest = useRef(open);
  useEffect(() => { latest.current = open; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); latest.current(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Mounted only while open: every opening starts fresh (empty query, current recents). */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const { career } = useCareer();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent] = useState<PaletteItem[]>(readRecent);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => { returnTo?.focus?.(); };
  }, []);

  const results = useMemo(() => {
    const found = paletteResults(career, query);
    if (query.trim()) return found;
    const recents = recent.filter((r) => routeAccess(career, r.href).allowed).map((r) => ({ ...r, id: `recent:${r.id}`, context: `Senast · ${r.context}` }));
    return [...recents, ...found.filter((f) => f.group === 'Åtgärder').slice(0, 4), ...found.filter((f) => f.group === 'Sidor' && f.context === 'Hubb')];
  }, [career, query, recent]);

  const choose = useCallback((item: PaletteItem | undefined) => {
    if (!item) return;
    pushRecent({ ...item, id: item.id.replace(/^recent:/, ''), context: item.context.replace(/^Senast · /, '') });
    onClose();
    router.push(item.href);
  }, [onClose, router]);

  const groups = [...new Set(results.map((r) => (r.id.startsWith('recent:') ? 'Senaste' : r.group)))];
  const groupOf = (r: PaletteItem) => (r.id.startsWith('recent:') ? 'Senaste' : r.group);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); return; }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); return; }
    if (e.key === 'Tab') {
      // Tab cycles groups (focus stays in the palette: the dialog is modal).
      e.preventDefault();
      if (!results.length) return;
      const current = groups.indexOf(groupOf(results[active] ?? results[0]!));
      const next = groups[(current + (e.shiftKey ? groups.length - 1 : 1)) % groups.length];
      setActive(Math.max(0, results.findIndex((r) => groupOf(r) === next)));
    }
  }

  return <div className="hm-palette-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="hm-palette" role="dialog" aria-modal="true" aria-label="Sök och gå till" ref={dialog} onKeyDown={onKeyDown}>
      <div className="hm-palette-input">
        <span aria-hidden="true">⌕</span>
        <input ref={input} role="combobox" aria-expanded="true" aria-controls="hm-palette-list" aria-activedescendant={results[active] ? `pal-${active}` : undefined} aria-label="Sök spelare, klubbar, tävlingar, sidor och åtgärder" placeholder="Sök eller gå till…  @ spelare  # klubbar  > åtgärder" value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} />
        <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={onClose} aria-label="Stäng sökningen">Esc</button>
      </div>
      <ul id="hm-palette-list" role="listbox" className="hm-palette-list" aria-label="Resultat">
        {results.length === 0 && <li className="hm-palette-empty">Ingen träff i karriären.</li>}
        {results.map((r, i) => {
          const g = groupOf(r);
          const first = i === 0 || groupOf(results[i - 1]!) !== g;
          return <li key={r.id} role="presentation">
            {first && <div className="hm-palette-group" aria-hidden="true">{g}</div>}
            <div id={`pal-${i}`} role="option" aria-selected={i === active} className="hm-palette-item" data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(r)}>
              <strong>{r.label}</strong><small>{r.context}</small>
            </div>
          </li>;
        })}
      </ul>
      <div className="hm-palette-hints" aria-hidden="true"><span>↑↓ välj</span><span>↵ öppna</span><span>Tab grupp</span><span>Esc stäng</span></div>
    </div>
  </div>;
}
