"use client";
// Arena Nights 231 -- MED-01 C "Return-to-play timeline" and MED-01a A "Rehab cards with phase stepper".
// Medical is about availability for the next match: rows are injured players, columns the coming days with the
// club's fixtures marked; each bar shows the rehab phases up to a projected return, so you see exactly which
// matches each player misses. The return is a range (selectable as limited -> fully fit) because it is a
// projection of the rehab rules, never a promise. The physio is the face of the department. Read-only.
import Link from "next/link";
import { StaffMark } from "@/components/game/Secondary";
import { PlayerGlyph } from "@/components/game/Identity";
import type { CareerFixture, CareerState } from "@/lib/career/types";
import { daysBetween } from "@/lib/career/dateUtils";
import { getClub, positionLabel, type PlayerMock } from "@/lib/game-data";
import { INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS, REHAB_PHASE_LABELS } from "@/lib/medical/labels";
import { dayIndex, type ReturnTimeline, type TimelineRow } from "@/lib/medical/returnToPlay";
import { REHAB_PHASES } from "@/lib/medical/types";
import type { ResolvedStaffMember } from "@/lib/staff/types";

const WEEKDAY = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];
const TYPE_LABEL: Record<string, string> = { LEAGUE: "Liga", CUP: "Cup", FRIENDLY: "Träningsmatch", PLAYOFF: "Slutspel", QUALIFIER: "Kval" };
const weekday = (iso: string) => WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()]!;
const short = (iso: string) => `${weekday(iso)} ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

export function opponentOf(f: CareerFixture, clubId: string): string {
  const id = f.homeClubId === clubId ? f.awayClubId : f.homeClubId;
  return getClub(id)?.shortName ?? id;
}

/** The physio's note: what the department says about availability, built from the timeline. */
export function PhysioQuote({ physio, timeline, players, clubId, quality }: { physio: ResolvedStaffMember | null; timeline: ReturnTimeline; players: Map<string, PlayerMock>; clubId: string; quality: number }) {
  const first = timeline.rows[0];
  const name = (id: string) => { const p = players.get(id); return p ? `${p.firstName} ${p.lastName}` : id; };
  const text = timeline.rows.length === 0
    ? "Hela truppen är frisk. Vi håller koll på belastningen i träningsveckan så att det förblir så."
    : `${timeline.rows.length} ${timeline.rows.length === 1 ? "spelare är" : "spelare är"} under rehab. ${timeline.next ? `${timeline.missingNext} missar nästa match mot ${opponentOf(timeline.next, clubId)} (${short(timeline.next.date)}).` : ""} ${first ? `Närmast tillbaka är ${name(first.playerId)}, spelbar tidigast ${short(first.projection.playableFrom)}.` : ""}`;
  return (
    <figure className="md-quote">
      {physio ? <StaffMark name={physio.displayName} size={48} /> : <span className="md-quote-none" aria-hidden="true">?</span>}
      <blockquote><p>{text}</p></blockquote>
      <figcaption>{physio ? <><Link href={`/career/staff/${encodeURIComponent(physio.id)}`}>{physio.displayName}</Link>, fysio · rehabtakt <span className="md-num">{quality.toFixed(2)}x</span></> : <>Ingen fysio i klubben -- rehab går i grundtakt. <Link href="/career/staff/recruitment?role=PHYSIO">Rekrytera en fysio →</Link></>}</figcaption>
    </figure>
  );
}

function PhaseBar({ row, today, days }: { row: TimelineRow; today: string; days: number }) {
  const at = (iso: string) => (dayIndex(today, iso, days) / days) * 100;
  const steps = row.projection.steps;
  const segments = steps.map((s, i) => ({ phase: s.phase, from: s.state === "todo" ? s.from : today, to: steps[i + 1]?.from ?? row.projection.fullReturn, done: s.state === "done" })).filter((s) => !s.done && s.to > s.from);
  return (
    <span className="md-bar">
      {segments.map((s) => <i key={s.phase} data-phase={s.phase} style={{ left: `${at(s.from)}%`, width: `${Math.max(0.8, at(s.to) - at(s.from))}%` }} title={`${REHAB_PHASE_LABELS[s.phase]}: ${short(s.from)} – ${short(s.to)} (beräknat)`} />)}
      {row.projection.fullReturn > addDaysLabel(today, days) && <em className="md-bar-more">→ {short(row.projection.fullReturn)}</em>}
    </span>
  );
}
const addDaysLabel = (today: string, days: number) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days - 1); return d.toISOString().slice(0, 10); };

/** The Gantt: injured players x coming days, fixture markers on top. */
export function ReturnTimelineView({ timeline, players, clubId }: { timeline: ReturnTimeline; players: Map<string, PlayerMock>; clubId: string }) {
  const n = timeline.days.length;
  const at = (iso: string) => ((dayIndex(timeline.today, iso, n) + 0.5) / n) * 100;
  return (
    <div className="md-tl" style={{ ["--days" as string]: n }}>
      <div className="md-tl-head" aria-hidden="true">
        <span />
        <span className="md-tl-scale">
          {timeline.days.filter((_, i) => i % 7 === 0).map((d) => <small key={d} style={{ left: `${(dayIndex(timeline.today, d, n) / n) * 100}%` }}>{short(d)}</small>)}
        </span>
      </div>
      <div className="md-tl-fixtures">
        <span className="md-tl-label">Matcher</span>
        <span className="md-tl-lane">
          {timeline.fixtures.map((f) => <Link key={f.id} className="md-fx" href={`/career/fixtures/${encodeURIComponent(f.id)}`} style={{ left: `${at(f.date)}%` }} title={`${TYPE_LABEL[f.type] ?? f.type} mot ${opponentOf(f, clubId)}, ${short(f.date)}`}><b>{opponentOf(f, clubId)}</b><small>{short(f.date)}</small></Link>)}
          {timeline.fixtures.length === 0 && <small className="md-hint">Inga matcher de kommande {n} dagarna.</small>}
        </span>
      </div>
      <ul className="md-tl-rows">
        {timeline.rows.map((r) => {
          const p = players.get(r.playerId);
          return (
            <li key={r.playerId}>
              <span className="md-tl-label"><Link href={`/career/squad/${encodeURIComponent(r.playerId)}`}><b>{p ? `${p.firstName.charAt(0)}. ${p.lastName}` : r.playerId}</b></Link><small>{p?.position} · {INJURY_TYPE_LABELS[r.injury.injuryType]}</small></span>
              <span className="md-tl-lane">
                {timeline.fixtures.map((f) => <i key={f.id} className="md-fx-line" data-miss={r.misses.some((m) => m.id === f.id) || undefined} data-limited={r.limited.some((m) => m.id === f.id) || undefined} style={{ left: `${at(f.date)}%` }} />)}
                <PhaseBar row={r} today={timeline.today} days={n} />
              </span>
              <span className="md-tl-ret md-num">{short(r.projection.playableFrom)}{r.projection.fullReturn !== r.projection.playableFrom ? ` – ${short(r.projection.fullReturn)}` : ""}<small>{r.misses.length ? `missar ${r.misses.map((m) => weekday(m.date)).join(", ")}` : "missar ingen match"}</small></span>
            </li>
          );
        })}
      </ul>
      <ul className="md-legend" aria-label="Förklaring">
        {REHAB_PHASES.map((ph) => <li key={ph}><i data-phase={ph} />{REHAB_PHASE_LABELS[ph]}</li>)}
        <li><i className="md-fx-key" />Missar matchen</li>
      </ul>
    </div>
  );
}

/** Next match: who can play, who misses it, who is back but limited. */
export function NextMatchAvailability({ timeline, players, clubId, available, squad }: { timeline: ReturnTimeline; players: Map<string, PlayerMock>; clubId: string; available: number; squad: number }) {
  const next = timeline.next;
  const name = (id: string) => { const p = players.get(id); return p ? `${p.firstName.charAt(0)}. ${p.lastName}` : id; };
  if (!next) return <section className="md-next"><h3>Nästa match</h3><p className="md-hint">Ingen kommande match inom fyra veckor. <Link href="/career/calendar">Kalender →</Link></p></section>;
  const out = timeline.rows.filter((r) => r.misses.some((m) => m.id === next.id));
  const limited = timeline.rows.filter((r) => r.limited.some((m) => m.id === next.id));
  return (
    <section className="md-next" aria-labelledby="md-next-title">
      <small>{TYPE_LABEL[next.type] ?? next.type} · {short(next.date)}</small>
      <h3 id="md-next-title">Mot {opponentOf(next, clubId)}</h3>
      <p className="md-next-count"><b className="md-num">{available}</b>/<span className="md-num">{squad}</span> tillgängliga i dag</p>
      <h4>Missar matchen <b className="md-num">{out.length}</b></h4>
      {out.length ? <ul>{out.map((r) => <li key={r.playerId}><Link href={`/career/squad/${encodeURIComponent(r.playerId)}`}>{name(r.playerId)}</Link><small>{players.get(r.playerId)?.position}</small></li>)}</ul> : <p className="md-hint">Ingen skadad spelare missar den.</p>}
      {limited.length > 0 && <><h4>Spelbar men begränsad <b className="md-num">{limited.length}</b></h4><ul>{limited.map((r) => <li key={r.playerId}><Link href={`/career/squad/${encodeURIComponent(r.playerId)}`}>{name(r.playerId)}</Link><small>tillbaka i spel</small></li>)}</ul></>}
      <div className="md-next-actions"><Link className="hm-btn hm-btn-sm" href="/career/tactics">Matchtrupp →</Link><Link className="hm-btn hm-btn-sm" href={`/career/fixtures/${encodeURIComponent(next.id)}`}>Matchen →</Link></div>
    </section>
  );
}

/** MED-01a: one row-card per injury -- player, injury, severity, four-step phase stepper, progress and return range. */
export function RehabCards({ timeline, players, career }: { timeline: ReturnTimeline; players: Map<string, PlayerMock>; career: CareerState }) {
  return (
    <ul className="md-cards">
      {timeline.rows.map((r) => {
        const p = players.get(r.playerId);
        const pct = Math.round(r.injury.rehabProgress * 100);
        return (
          <li key={r.playerId} className="md-card" data-severity={r.injury.severity}>
            <header>
              {p && <PlayerGlyph player={p} size={36} />}
              <div><Link href={`/career/squad/${encodeURIComponent(r.playerId)}`}><b>{p ? `${p.firstName} ${p.lastName}` : r.playerId}</b></Link><small>{p ? positionLabel(p.position) : ""} · {INJURY_TYPE_LABELS[r.injury.injuryType]} · sedan {r.injury.occurredDate}</small></div>
              <span className="md-sev" data-severity={r.injury.severity}>{INJURY_SEVERITY_LABELS[r.injury.severity]}</span>
            </header>
            <ol className="md-steps" aria-label="Rehabfaser">
              {r.projection.steps.map((s) => <li key={s.phase} data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}><i aria-hidden="true">{s.state === "done" ? "✓" : ""}</i><span>{REHAB_PHASE_LABELS[s.phase]}</span>{s.state === "todo" && <small className="md-num">{short(s.from)}</small>}</li>)}
            </ol>
            <div className="md-progress"><span className="md-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Rehabilitering ${pct} procent`}><i style={{ width: `${pct}%` }} /></span><b className="md-num">{pct} %</b></div>
            <p className="md-return md-num">Spelbar {short(r.projection.playableFrom)}{r.projection.fullReturn !== r.projection.playableFrom ? ` · helt återställd ${short(r.projection.fullReturn)}` : ""}<small> · beräknat, {daysBetween(career.gameDate, r.projection.playableFrom)} dagar</small></p>
          </li>
        );
      })}
    </ul>
  );
}
