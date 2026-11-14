'use client';
// Arena Nights Phase 2 -- player dossier views (SQD-02 C Feature Profile, SQD-02a key-ratings summary,
// SQD-02g sticky identity bar). Every view renders lib/players/playerDossier.ts output; no data is invented,
// and empty archives say so plainly.
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PlayerMock } from '@/lib/game-data';
import { getClub } from '@/lib/game-data';
import type { PlayerDossier, DossierMatch } from '@/lib/players/playerDossier';
import { SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from '@/lib/career/squadStatus';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { RECOVERY_OUTLOOK_LABEL } from '@/lib/training/readinessSummary';
import { formatMoney } from '@/lib/economy/currency';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import ClubCrest from '@/components/ClubCrest';

const FOCUS_LABEL: Record<string, string> = { NORMAL: 'Normal (inget extra fokus)', TECHNICAL: 'Teknik', ATTACKING_DECISIONS: 'Anfallsspel', DEFENCE: 'Försvarsspel', PHYSICAL: 'Fysik', MENTAL: 'Mentalt', GOALKEEPER: 'Målvaktsspel' };
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));

/** SQD-02g: compact identity bar that stays in view while the dossier scrolls; carries the real actions. */
export function DossierBar({ player, dossier, availability, actions }: { player: PlayerMock; dossier: PlayerDossier; availability: string; actions: ReactNode }) {
  const club = player.clubId ? getClub(player.clubId) : undefined;
  return <div className="hm-dossier-bar" data-own={dossier.own}>
    {club ? <ClubCrest clubId={club.id} shortName={club.shortName} primaryColor={club.primaryColor} size={28} /> : <span className="hm-dossier-bar-nocrest" aria-hidden="true">—</span>}
    <span className="hm-dossier-bar-shirt" aria-hidden="true">{player.shirtNumber ?? '—'}</span>
    <strong className="hm-dossier-bar-name">{player.firstName} {player.lastName}</strong>
    <span className="hm-dossier-bar-pos">{player.position}{player.secondaryPosition ? `/${player.secondaryPosition}` : ''}</span>
    <span className="hm-dossier-bar-chip" data-ok={dossier.readiness ? dossier.readiness.available : true}>{availability}</span>
    {dossier.contract?.role && <span className="hm-dossier-bar-chip">{SQUAD_STATUS_TIER_LABEL_SV[dossier.contract.role as SquadStatusTier]}</span>}
    {dossier.roles.captain && <span className="hm-squad-role-pill" data-role="captain">K</span>}
    {dossier.roles.vice && <span className="hm-squad-role-pill" data-role="vice">VK</span>}
    {dossier.roles.penalty != null && <span className="hm-squad-role-pill" data-role="penalty">7m</span>}
    <div className="hm-dossier-bar-actions">{actions}</div>
  </div>;
}

/** SQD-02a: key-ratings summary -- family profile, strengths and weaknesses (own players only). */
export function KeyRatings({ dossier, fallback }: { dossier: PlayerDossier; fallback: ReactNode }) {
  if (!dossier.own || !dossier.families.length) return <>{fallback}</>;
  return <section className="hm-dossier-section hm-dossier-ratings" aria-labelledby="dossier-ratings-h">
    <header><h2 id="dossier-ratings-h">Spelarbild</h2>{dossier.rating && <span className="hm-dossier-stars" title="Tränarstabens bedömning · scoutingens uppskattning">Nivå {stars(dossier.rating.current)} · Potential {stars(dossier.rating.potential)}</span>}</header>
    <ol className="hm-dossier-families">{dossier.families.map(f => <li key={f.key}><span>{f.label}</span><span className="hm-dossier-bar-track" role="img" aria-label={`${f.label} ${f.avg} av 20`}><i style={{ width: `${(f.avg / 20) * 100}%` }} data-band={f.avg >= 15 ? 'high' : f.avg >= 10 ? 'mid' : 'low'} /></span><b>{f.avg.toFixed(1)}</b></li>)}</ol>
    <div className="hm-dossier-sw">
      <div><h3>Styrkor</h3><ul>{dossier.strengths.map(a => <li key={a.key} data-tone="pos"><span>{a.label}</span><b>{a.value}</b></li>)}</ul></div>
      <div><h3>Svagheter</h3><ul>{dossier.weaknesses.map(a => <li key={a.key} data-tone="neg"><span>{a.label}</span><b>{a.value}</b></li>)}</ul></div>
    </div>
    <p className="hm-dossier-note">Skala 1–20, tränarstabens bedömning av spelarens egenskaper i positionens attributgrupper.</p>
  </section>;
}

/** Season numbers + playing time. */
export function SeasonLine({ dossier, position }: { dossier: PlayerDossier; position: string }) {
  const s = dossier.season;
  const gk = position === 'MV';
  const cells: [string, string][] = [
    ['Matcher / starter', `${s.appearances} / ${s.starts}`],
    ['Speltid (arkiv)', s.minutes ? `${s.minutes} min` : '—'],
    [gk ? 'Räddningar / mötta' : 'Mål / skott', gk ? `${s.saves} / ${s.shotsFaced}` : `${s.goals} / ${s.shots}`],
    [gk ? 'Räddningsprocent' : 'Skotteffektivitet', gk ? (s.shotsFaced ? `${Math.round((s.saves / s.shotsFaced) * 100)}%` : '—') : (s.shots ? `${Math.round((s.goals / s.shots) * 100)}%` : '—')],
    ['Snittbetyg', s.avgRating == null ? '—' : s.avgRating.toFixed(1)],
  ];
  return <dl className="hm-dossier-season">{cells.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

/** Performance timeline: one bar per match (rating), coloured by result, each linking to its match report. */
export function FormTimeline({ matches, limit = 10 }: { matches: DossierMatch[]; limit?: number }) {
  const list = matches.slice(0, limit).reverse();
  if (!list.length) return <p className="hm-dossier-empty">Ingen match i matcharkivet ännu. Formkurvan byggs när spelaren får speltid.</p>;
  return <ol className="hm-dossier-form" aria-label="Formkurva, senaste matcherna">
    {list.map(m => <li key={m.fixtureId}>
      <Link href={matchReportHref(m.fixtureId)} title={`${m.date} · ${m.home ? 'hemma' : 'borta'} mot ${m.opponent} · ${m.score} · betyg ${m.rating.toFixed(1)}`} aria-label={`${m.date} mot ${m.opponent}, ${m.score}, betyg ${m.rating.toFixed(1)}. Öppna matchrapporten`}>
        <span className="hm-dossier-form-bar" style={{ height: `${Math.max(8, Math.min(100, (m.rating / 10) * 100))}%` }} data-r={m.outcome} />
        <b>{m.rating.toFixed(1)}</b>
        <small>{m.opponent.slice(0, 3).toUpperCase()}</small>
      </Link>
    </li>)}
  </ol>;
}

export function Readiness({ dossier }: { dossier: PlayerDossier }) {
  const r = dossier.readiness;
  if (!r) return null;
  const gauge = (label: string, v: number, low: number) => <div className="hm-dossier-gauge" data-low={v < low}><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" /><circle cx="18" cy="18" r="15" style={{ strokeDasharray: `${(v / 100) * 94.2} 94.2` }} /></svg><b>{v}</b><span>{label}</span></div>;
  return <section className="hm-dossier-section" aria-labelledby="dossier-ready-h">
    <header><h2 id="dossier-ready-h">Beredskap</h2><span className={`hm-dossier-chip`} data-ok={r.available}>{r.available ? 'Tillgänglig' : 'Inte tillgänglig'}</span></header>
    <div className="hm-dossier-gauges">{gauge('Energi', r.energy, 75)}{gauge('Matchträning', r.fitness, 50)}{gauge('Moral', r.morale, 40)}</div>
    <p className="hm-dossier-note">Återhämtning: <strong>{RECOVERY_OUTLOOK_LABEL[r.outlook as keyof typeof RECOVERY_OUTLOOK_LABEL] ?? r.outlook}</strong>{r.weekLoad != null ? ` · belastning 7 d: ${r.weekLoad}` : ''}{r.reasons.length ? ` · ${r.reasons.join(' · ')}` : ''}</p>
  </section>;
}

/** A3: development over time from the stored (bounded) development history. */
export function DevelopmentView({ dossier }: { dossier: PlayerDossier }) {
  const d = dossier.development;
  if (!dossier.own) return <section className="hm-dossier-section"><header><h2>Utvecklingsbedömning</h2></header><p className="hm-dossier-note">Du följer en extern spelares utveckling genom scouting och registrerade prestationer. Individuell träning hanteras av spelarens klubb.</p></section>;
  const pts = d.points;
  const first = pts[0]?.date, last = pts.at(-1)?.date;
  const span = first && last ? Math.max(1, Date.parse(last) - Date.parse(first)) : 1;
  return <>
    <section className="hm-dossier-section" aria-labelledby="dossier-dev-h">
      <header><h2 id="dossier-dev-h">Utveckling över tid</h2><Link className="hm-btn hm-btn-sm" href="/career/training">Träningsfokus →</Link></header>
      <dl className="hm-dossier-season">
        <div><dt>Individuellt fokus</dt><dd>{FOCUS_LABEL[d.focus ?? 'NORMAL'] ?? d.focus}</dd></div>
        <div><dt>Registrerade förändringar</dt><dd>{pts.length}</dd></div>
        <div><dt>Från träning</dt><dd>{d.sources.training}</dd></div>
        <div><dt>Från matcher</dt><dd>{d.sources.match}</dd></div>
        {d.sources.other > 0 && <div><dt>Övrigt</dt><dd>{d.sources.other}</dd></div>}
      </dl>
      {pts.length === 0 ? <p className="hm-dossier-empty">Ingen synlig förändring registrerad ännu. Utvecklingen avgörs veckovis av träning, tränarkvalitet, speltid och ålder; de första förändringarna syns här när de inträffar. Historiken sparas för de senaste 20 förändringarna.</p> : <>
        <svg className="hm-dossier-devline" viewBox="0 0 600 70" preserveAspectRatio="none" role="img" aria-label={`Utvecklingshändelser från ${first} till ${last}`}>
          <line x1="0" y1="35" x2="600" y2="35" />
          {pts.map((p, i) => { const x = first ? ((Date.parse(p.date) - Date.parse(first)) / span) * 580 + 10 : 300; const up = p.to > p.from; return <g key={i}><circle cx={x} cy={up ? 22 : 48} r="5" data-up={up}><title>{`${p.date} · ${p.label} ${p.from} → ${p.to} · ${p.source}`}</title></circle></g>; })}
        </svg>
        <p className="hm-dossier-note">{first} – {last} · ovanför linjen = förbättring, under = tillbakagång. Håll muspekaren över en punkt för källan.</p>
      </>}
    </section>
    {d.progression.length > 0 && <section className="hm-dossier-section" aria-labelledby="dossier-prog-h">
      <header><h2 id="dossier-prog-h">Egenskapsprogression</h2></header>
      <ol className="hm-dossier-progression">{d.progression.map(p => <li key={p.attribute}><span>{p.label}</span><span className="hm-dossier-prog-track" aria-hidden="true"><i style={{ left: `${(Math.min(p.first, p.last) / 20) * 100}%`, width: `${Math.max(2, (Math.abs(p.last - p.first) / 20) * 100)}%` }} data-up={p.last >= p.first} /></span><b>{p.first} → {p.last}</b><small>{p.changes} {p.changes === 1 ? 'förändring' : 'förändringar'}</small></li>)}</ol>
      <details className="hm-dossier-details"><summary>Alla förändringar ({pts.length})</summary><ul>{[...pts].reverse().map((p, i) => <li key={`${p.date}:${i}`}><span>{p.date}</span><span>{p.label}</span><b>{p.from} → {p.to}</b><small>{p.source}</small></li>)}</ul></details>
    </section>}
  </>;
}

/** A5: career timeline (club history, transfers, loans, contract events, seasons) + archive milestones. */
export function CareerTimeline({ dossier }: { dossier: PlayerDossier }) {
  const events = dossier.career;
  return <section className="hm-dossier-section" aria-labelledby="dossier-career-h">
    <header><h2 id="dossier-career-h">Karriären</h2></header>
    {events.length === 0 && dossier.milestones.length === 0 ? <p className="hm-dossier-empty">Ingen tidigare klubb, övergång eller avslutad säsong är registrerad för spelaren ännu.</p> :
      <ol className="hm-dossier-timeline">
        {events.map((e, i) => <li key={`e${i}`} data-kind={e.kind}><time>{e.date ?? (e.kind === 'CLUB' ? 'Tidigare' : '')}</time><div><strong>{e.href ? <Link href={e.href}>{e.title}</Link> : e.title}</strong><small>{e.detail}</small></div></li>)}
        {dossier.milestones.map((m, i) => <li key={`m${i}`} data-kind="MILESTONE"><time>{m.date}</time><div><strong>{m.href ? <Link href={m.href}>{m.text}</Link> : m.text}</strong><small>Milstolpe i matcharkivet</small></div></li>)}
      </ol>}
  </section>;
}

/** A6: contract and future at a glance (the detailed contract tools stay below). */
export function ContractFuture({ dossier }: { dossier: PlayerDossier }) {
  const c = dossier.contract;
  if (!c) return null;
  return <section className="hm-dossier-section" aria-labelledby="dossier-future-h">
    <header><h2 id="dossier-future-h">Kontrakt & framtid</h2>{c.status && <span className="hm-dossier-chip">{CONTRACT_STATUS_LABEL[c.status as keyof typeof CONTRACT_STATUS_LABEL] ?? c.status}</span>}</header>
    <dl className="hm-dossier-season">
      <div><dt>Avtal till</dt><dd>{c.endDate ?? '—'}</dd></div>
      <div><dt>Dagar kvar</dt><dd>{c.daysLeft ?? '—'}</dd></div>
      {dossier.own && <div><dt>Lön / månad</dt><dd>{c.wage != null ? formatMoney(c.wage) : '—'}</dd></div>}
      {c.role && <div><dt>Trupproll</dt><dd>{SQUAD_STATUS_TIER_LABEL_SV[c.role as SquadStatusTier]}</dd></div>}
      {dossier.own && <div><dt>Förlängning</dt><dd>{c.renewal ?? 'Ingen förhandling'}</dd></div>}
      {dossier.own && <div><dt>Bud från klubbar</dt><dd>{c.offers}</dd></div>}
    </dl>
    {c.risks.length > 0 ? <ul className="hm-dossier-risks">{c.risks.map((r, i) => <li key={i} data-tone={r.tone}>{r.text}</li>)}</ul> : dossier.own ? <p className="hm-dossier-note">Ingen kontrakts- eller lojalitetsrisk just nu.</p> : null}
  </section>;
}
