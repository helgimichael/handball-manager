'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { searchManagement } from '@/lib/career/management';

export default function GlobalSearch() {
  const { career } = useCareer();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchManagement(career, query).slice(0, 12), [career, query]);
  return <div className="hm-global-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <input aria-label="Sök spelare, klubbar och tävlingar" placeholder="Sök spelare, klubb, tävling…" className="hm-input" value={query} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
    {open && query.trim().length >= 2 && <div className="hm-search-results" aria-label="Sökresultat">{results.length ? results.map(r => <Link key={`${r.kind}:${r.id}`} href={r.href} onClick={() => { setOpen(false); setQuery(''); }}><span><strong>{r.label}</strong><small>{r.context}</small></span><span className="hm-text-muted">{r.kind}</span></Link>) : <div className="hm-empty">Ingen träff i karriären.</div>}</div>}
  </div>;
}
