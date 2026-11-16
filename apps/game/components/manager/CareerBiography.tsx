"use client";
// Arena Nights MGR-01 C (Career Chapters) and MGR-01a B (Annotated Reputation
// Timeline): the manager's career as chapters on one reputation line. All
// figures come from lib/manager/careerBiography.ts (reputation log,
// milestones, stints); nothing is invented and nothing is written.
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import ClubCrest from "@/components/ClubCrest";
import { getClub, COMPETITIONS } from "@/lib/game-data";
import type { BiographyChapter, BiographyEventKind, CareerBiography, ReputationPoint } from "@/lib/manager/careerBiography";
import { timeFraction } from "@/lib/manager/careerBiography";

export function Crest({ clubId, size = 22 }: { clubId: string; size?: number }) {
  const c = getClub(clubId);
  return c ? <ClubCrest shortName={c.shortName} primaryColor={c.primaryColor} clubId={c.id} size={size} /> : null;
}
export const clubName = (id: string) => getClub(id)?.name ?? id;
/** The competition recorded on the stint itself (history), not a static club-to-league lookup. */
const stintCompetition = (chapter: { competitionId?: string | null }) => chapter.competitionId ?? null;
const compName = (id: string) => COMPETITIONS.find((c) => c.id === id)?.name ?? id;
const clubColour = (id?: string) => (id ? getClub(id)?.primaryColor : undefined);

const KIND_LABEL: Record<BiographyEventKind, string> = {
  APPOINTED: "Ny klubb", DISMISSED: "Sparkad", RESIGNED: "Avgick", TITLE: "SM-guld", CUP: "Cuptitel", PROMOTION: "Uppflyttning",
  RELEGATION: "Nedflyttning", CONTRACT: "Nytt avtal", REVIEW: "Säsongsomdöme", REPUTATION: "Ryktet rörde sig",
};
const KIND_GLYPH: Record<BiographyEventKind, string> = {
  APPOINTED: "●", DISMISSED: "✕", RESIGNED: "↩", TITLE: "★", CUP: "★", PROMOTION: "▲", RELEGATION: "▼", CONTRACT: "✎", REVIEW: "◆", REPUTATION: "•",
};
const tone = (p: ReputationPoint) => (p.kind === "DISMISSED" || p.kind === "RELEGATION" || p.delta < 0 ? "neg" : p.kind === "TITLE" || p.kind === "CUP" ? "gold" : p.kind === "PROMOTION" || p.delta > 0 ? "pos" : "info");

/** Which archived season a date falls in, when that season has a season book. */
function seasonFor(date: string, seasonIds: readonly string[]): string | undefined {
  return seasonIds.find((s) => { const y = Number(s.slice(0, 4)); return date >= `${y}-07-01` && date <= `${y + 1}-06-30`; });
}

const Y = (v: number) => 186 - (Math.max(0, Math.min(100, v)) / 100) * 172;

/** MGR-01a: the reputation line across the whole career, stint bands per club, milestones as points; a point opens its reason. */
export function ReputationTimeline({ bio, seasonIds }: { bio: CareerBiography; seasonIds: readonly string[] }) {
  const notable = useMemo(() => bio.points.filter((p) => p.kind !== "REPUTATION" || p.delta !== 0), [bio.points]);
  const [pickedId, setSelectedId] = useState<string | null>(null);
  const selected = notable.find((p) => p.id === pickedId) ?? notable.at(-1) ?? null;
  const selectedId = selected?.id ?? null;
  const x = (date: string) => timeFraction(bio, date) * 1000;
  const line = [{ x: 0, y: Y(bio.startReputation) }, ...bio.points.map((p) => ({ x: x(p.date), y: Y(p.value) })), { x: 1000, y: Y(bio.reputation) }];
  // A step line: reputation holds until the next explained change.
  const path = line.reduce((d, pt, i) => (i === 0 ? `M${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${d} L${pt.x.toFixed(1)} ${line[i - 1]!.y.toFixed(1)} L${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`), "");

  if (bio.sparse) {
    return (
      <section className="kr-arc" aria-labelledby="kr-arc-title" data-sparse="true">
        <header className="kr-sec-head"><span className="kr-kicker">Ryktet över tid</span><h2 id="kr-arc-title">Ditt första kapitel</h2></header>
        <p className="kr-muted">Ryktet startar på <b className="kr-num">{bio.startReputation}</b> och står nu på <b className="kr-num">{bio.reputation}</b>. Det bedöms när en säsong är slut och när du lämnar en klubb, så linjen fylls på med vändpunkterna i din karriär: uppflyttningar, titlar, avsked och nya jobb.</p>
        <div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/board">Styrelsens mål för säsongen →</Link></div>
      </section>
    );
  }

  return (
    <section className="kr-arc" aria-labelledby="kr-arc-title">
      <header className="kr-sec-head"><span className="kr-kicker">Ryktet över tid · {bio.firstDate.slice(0, 4)}–{bio.lastDate.slice(0, 4)}</span><h2 id="kr-arc-title">Karriärens linje</h2></header>
      <div className="kr-arc-chart">
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
          {bio.bands.map((b) => <rect key={b.clubId + b.from} className="kr-band" x={x(b.from)} y={0} width={Math.max(2, x(b.to) - x(b.from))} height={200} style={{ "--band": clubColour(b.clubId) ?? "var(--arena-solid-3)" } as CSSProperties} />)}
          {[25, 50, 75].map((v) => <line key={v} className="kr-grid" x1={0} x2={1000} y1={Y(v)} y2={Y(v)} />)}
          <path className="kr-line" d={path} />
        </svg>
        <ol className="kr-arc-bands" aria-label="Klubbarna">
          {bio.bands.map((b) => <li key={b.clubId + b.from} style={{ left: `${x(b.from) / 10}%`, width: `${Math.max(0.5, (x(b.to) - x(b.from)) / 10)}%` }}><Crest clubId={b.clubId} size={16} /><span>{getClub(b.clubId)?.shortName ?? b.clubId}</span></li>)}
        </ol>
        <ol className="kr-arc-points" aria-label="Vändpunkter">
          {notable.map((p) => (
            <li key={p.id} style={{ left: `${x(p.date) / 10}%`, top: `${(Y(p.value) / 200) * 100}%` }}>
              <button type="button" data-tone={tone(p)} aria-pressed={p.id === selectedId} onClick={() => setSelectedId(p.id)} title={`${p.date} · ${KIND_LABEL[p.kind]}`}>
                <span aria-hidden="true">{KIND_GLYPH[p.kind]}</span><span className="hm-sr-only">{p.date}: {KIND_LABEL[p.kind]}, rykte {p.value}</span>
              </button>
            </li>
          ))}
        </ol>
        <span className="kr-arc-axis" aria-hidden="true"><i>100</i><i>50</i><i>0</i></span>
      </div>
      {selected && <PointDetail point={selected} season={seasonFor(selected.date, seasonIds)} />}
      <ol className="kr-arc-list" aria-label="Vändpunkter i tidsordning">
        {[...notable].reverse().map((p) => (
          <li key={p.id} data-tone={tone(p)}>
            <span className="kr-arc-dot" aria-hidden="true">{KIND_GLYPH[p.kind]}</span>
            <div><time>{p.date}</time><b>{KIND_LABEL[p.kind]}{p.delta ? <span className="kr-num"> {p.delta > 0 ? "+" : ""}{p.delta} → {p.value}</span> : null}</b><span>{p.milestone ? `${p.milestone} ` : ""}{p.text}</span>
              {seasonFor(p.date, seasonIds) && <Link href={`/career/history?season=${encodeURIComponent(seasonFor(p.date, seasonIds)!)}`}>Säsongsboken {seasonFor(p.date, seasonIds)} →</Link>}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PointDetail({ point, season }: { point: ReputationPoint; season?: string }) {
  return (
    <div className="kr-arc-detail" data-tone={tone(point)} aria-live="polite">
      <span className="kr-arc-dot" aria-hidden="true">{KIND_GLYPH[point.kind]}</span>
      <div>
        <span className="kr-kicker"><time>{point.date}</time> · {KIND_LABEL[point.kind]}{point.clubId ? ` · ${clubName(point.clubId)}` : ""}</span>
        {point.milestone && <strong>{point.milestone}</strong>}
        <p>{point.kind === "REPUTATION" || point.milestone ? `Ryktet: ${point.text}` : point.text}</p>
      </div>
      <div className="kr-arc-detail-fig">
        {point.delta !== 0 ? <b className="kr-num" data-sign={point.delta > 0 ? "pos" : "neg"}>{point.delta > 0 ? "+" : ""}{point.delta}</b> : <b className="kr-num">±0</b>}
        <small>rykte {point.value}</small>
        {season && <Link className="hm-btn hm-btn-sm" href={`/career/history?season=${encodeURIComponent(season)}`}>Säsongsboken {season} →</Link>}
      </div>
    </div>
  );
}

/** MGR-01 C: one chapter per stint, newest first; the open chapter is expanded. */
export function CareerChapters({ chapters, seasonIds }: { chapters: readonly BiographyChapter[]; seasonIds: readonly string[] }) {
  return (
    <div className="kr-chapters-layout">
      <ol className="kr-chapters" aria-label="Kapitlen">
        {chapters.map((c) => (
          <li key={c.id} id={`kapitel-${c.number}`} className="kr-chapter" data-open-chapter={c.open} data-left={c.leftReason} style={{ "--chapter": clubColour(c.clubId) ?? "var(--club-neon)" } as CSSProperties}>
            <details open={c.open || chapters.length === 1}>
              <summary>
                <span className="kr-node" aria-hidden="true" />
                <Crest clubId={c.clubId} size={34} />
                <span className="kr-chapter-title"><small>Kapitel {c.number}{c.open ? " · pågår" : ""}</small><b>{clubName(c.clubId)}</b><span>{c.from} – {c.to ?? "i dag"}{stintCompetition(c) ? ` · ${compName(stintCompetition(c)!)}` : ""}</span></span>
                <span className="kr-chapter-rep kr-num" title="Rykte in → ut">{c.reputationIn ?? "—"} → {c.reputationOut ?? "—"}</span>
                {c.honours.length > 0 && <span className="kr-honours" aria-label={`Meriter: ${c.honours.join(", ")}`}>{c.honours.map((h, i) => <i key={i} aria-hidden="true">★</i>)}</span>}
              </summary>
              <div className="kr-chapter-body">
                <p className="kr-chapter-intro">{c.opening ?? `Du tog över ${clubName(c.clubId)} ${c.from}.`}</p>
                {c.seasons.length > 0 ? (
                  <div className="hm-scroll-x"><table className="hm-table kr-seasons">
                    <thead><tr><th>Säsong</th><th>Serie</th><th className="hm-table-num">Plac.</th><th className="hm-table-num">V–O–F</th><th className="hm-table-num">Målen</th><th>Meriter</th></tr></thead>
                    <tbody>{c.seasons.map((s) => (
                      <tr key={s.seasonId}>
                        <td>{seasonIds.includes(s.seasonId) ? <Link href={`/career/history?season=${encodeURIComponent(s.seasonId)}`}>{s.seasonId}</Link> : s.seasonId}{s.partial ? " (del)" : ""}</td>
                        <td>{compName(s.competitionId)}</td>
                        <td className="hm-table-num">{s.position ?? "—"}</td>
                        <td className="hm-table-num">{s.record ? `${s.record.won}–${s.record.drawn}–${s.record.lost}` : "—"}</td>
                        <td className="hm-table-num">{s.objectivesScore === null ? "—" : `${Math.round(s.objectivesScore * 100)} %`}</td>
                        <td>{s.honours.join(", ") || "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                ) : <p className="kr-muted">Ingen säsong avslutad i {clubName(c.clubId)} ännu. Den första skrivs in när säsongen är slut.</p>}
                {c.events.length > 0 && <ul className="kr-chapter-events">{c.events.slice(0, 6).map((e, i) => <li key={i} data-kind={e.kind}><time>{e.date}</time>{e.text}</li>)}</ul>}
                {c.closing && <p className="kr-chapter-break" data-left={c.leftReason}><span>{c.leftReason === "DISMISSED" ? "Sparkad" : c.leftReason === "RESIGNED" ? "Avgick" : c.leftReason === "NEW_JOB" ? "Nytt jobb" : "Slut"}</span>{c.closing}</p>}
              </div>
            </details>
          </li>
        ))}
      </ol>
      {chapters.length > 1 && (
        <nav className="kr-chapter-index" aria-label="Kapitelindex">
          <span className="kr-kicker">Kapitel</span>
          <ol>{chapters.map((c) => <li key={c.id}><a href={`#kapitel-${c.number}`}><Crest clubId={c.clubId} size={18} /><span>{c.number}. {getClub(c.clubId)?.shortName ?? c.clubId}</span><small>{c.from.slice(0, 4)}–{c.to?.slice(0, 4) ?? ""}</small></a></li>)}</ol>
        </nav>
      )}
    </div>
  );
}
