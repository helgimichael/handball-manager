"use client";
// Arena Nights 231 -- the Scout Desk (REC-01 C "Shortlist & Reports"): pipeline strip + scout capacity cards
// (REC-01b A), new-reports feed, ranked Kortlista, "Ge ett uppdrag" typeahead, the single pipeline list
// (REC-01e A), the coverage map (REC-01d B) and the ranked discoveries table (REC-01f A). Presentation over
// lib/scouting/scoutDesk.ts; every action calls the existing scouting / recruitment functions. Star ranges
// and value ranges are the knowledge-gated views -- never a true ability.
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { StarBand } from "@/components/recruitment/PipelineBoard";
import { StaffMark } from "@/components/game/Secondary";
import { ClubLink } from "@/components/entityLinks";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerPlayer } from "@/lib/career/careerWorld";
import { RECRUITMENT_PRIORITY_LABEL_SV, type RecruitmentCandidate } from "@/lib/career/recruitment";
import { computeAssignmentProgressPct, type ScoutAssignmentType, type ScoutingAssignment } from "@/lib/career/scouting";
import { scopeLabelSv } from "@/lib/career/scoutDiscovery";
import type { NeedLevel } from "@/lib/career/cpuSquadNeeds";
import { formatMoney } from "@/lib/economy/currency";
import { getClub } from "@/lib/game-data";
import { findStaffMember } from "@/lib/staff/staffCareerIntegration";
import {
  assignmentSuggestions, broadScope, previewBroadAssignment, shiftPriority, sortDiscoveries,
  type AssignTarget, type AssignmentGroups, type CoverageTile, type DiscoverySort, type PipelineCounts, type ReportCard, type ScoutCapacity,
} from "@/lib/scouting/scoutDesk";

export const SOURCE_LABEL: Record<Exclude<ScoutAssignmentType, "PLAYER">, string> = { CLUB: "Klubb", COMPETITION: "Liga", REGION: "Land", POSITION: "Position", AGE_BAND: "Ålder" };
const NEED_LABEL: Record<NeedLevel, string | null> = { HIGH: "Stort behov", MEDIUM: "Behov", LOW: null, NONE: null };

const range = (v: { min: number; max: number } | null | undefined) => (v ? (v.min === v.max ? formatMoney(v.min) : `${formatMoney(v.min)} – ${formatMoney(v.max)}`) : "—");

// --- Pipeline strip + scout capacity cards (REC-01 / REC-01b) -------------------------------------

export function ScoutStrip({ counts, scouts }: { counts: PipelineCounts; scouts: ScoutCapacity[] }) {
  const stages = [
    { href: "#sd-discoveries", label: "Upptäckta", n: counts.discovered },
    { href: "#sd-pipeline", label: "Under scouting", n: counts.scouting },
    { href: "#sd-reports", label: "Rapporter", n: counts.reports },
    { href: "#sd-shortlist", label: "Kortlista", n: counts.shortlist },
  ];
  return (
    <section className="sd-strip" aria-label="Scoutingkedjan">
      <ol className="sd-stages">{stages.map((s, i) => <li key={s.label}><a href={s.href}><small>{String(i + 1).padStart(2, "0")}</small><span>{s.label}</span><b className="sd-num">{s.n}</b></a></li>)}</ol>
      <ul className="sd-scouts" aria-label="Scouterna">
        {scouts.map((s) => (
          <li key={s.id} data-free={s.free}>
            <Link href={`/career/staff/${encodeURIComponent(s.id)}`}>
              <StaffMark name={s.name} size={34} />
              <span className="sd-scout-id"><b>{s.name}</b><small>{s.free ? "Ledig" : `Klar ${s.nextFinish}`}</small></span>
              <span className="sd-scout-fit" title="Spelarbedömning för scoutrollen, skala 1–20"><b className="sd-num">{s.suitability.toFixed(1)}</b><small>/20</small></span>
              <span className="sd-pips" aria-label={`${s.active} pågående uppdrag`}>{Array.from({ length: Math.max(3, s.active) }, (_, i) => <i key={i} data-on={i < s.active} />)}</span>
            </Link>
          </li>
        ))}
        <li className="sd-scout-ghost"><Link href="/career/staff/recruitment?role=SCOUT"><span aria-hidden="true">+</span><span className="sd-scout-id"><b>Rekrytera scout</b><small>{scouts.length ? "Fler ögon på marknaden" : "Klubben har ingen scout ännu"}</small></span></Link></li>
      </ul>
    </section>
  );
}

// --- Report feed (REC-01) ------------------------------------------------------------------------

function ConfidenceRing({ pct }: { pct: number | null }) {
  return <span className="sd-ring" style={{ ["--p" as string]: `${pct ?? 0}` }} role="img" aria-label={pct === null ? "Säkerhet okänd" : `Säkerhet ${pct} procent`}><b className="sd-num">{pct === null ? "?" : pct}</b><small>%</small></span>;
}

export function ReportFeed({ cards, onOpen }: { cards: ReportCard[]; onOpen: (playerId: string, kicker: string) => void }) {
  const { career } = useCareer();
  if (cards.length === 0) return <div className="sd-empty"><p>Inga rapporter ännu. Ge en scout ett uppdrag på en spelare -- rapporten landar här när uppdraget är klart.</p><a className="hm-btn hm-btn-sm" href="#sd-assign">Ge ett uppdrag</a></div>;
  return (
    <ol className="sd-feed">
      {cards.map((r) => {
        const c = r.candidate;
        const scout = findStaffMember(career, r.scoutId)?.displayName ?? "Okänd scout";
        const kicker = `Rapport ${r.createdDate} · ${scout}`;
        return (
          <li key={r.reportId}>
            <article className="sd-report" data-shortlisted={c.shortlisted || undefined}>
              <header>
                <small className="sd-kicker">{r.createdDate} · <span className="sd-tag">{scout}</span>{c.shortlisted && <span className="sd-tag" data-tone="kort">Kortlista</span>}</small>
                <h4><button type="button" className="sd-linkish" onClick={() => onOpen(c.playerId, kicker)}>{c.firstName} {c.lastName}</button> <small>{c.position} · {c.ageYears ?? "–"} år · {c.clubName}</small></h4>
              </header>
              <div className="sd-report-body">
                <ConfidenceRing pct={c.scoutReportView?.confidencePct ?? null} />
                <div className="sd-report-text">
                  <p className="sd-verdict">{c.scoutReportView?.recommendation ?? "Rapporten saknar bedömning."}</p>
                  <p className="sd-sw">{c.visibility?.strengths?.length ? <><b>Styrkor:</b> {c.visibility.strengths.slice(0, 3).join(", ").toLowerCase()}. </> : null}{c.visibility?.weaknesses?.length ? <><b>Svagheter:</b> {c.visibility.weaknesses.slice(0, 2).join(", ").toLowerCase()}.</> : null}</p>
                </div>
                <dl className="sd-report-facts">
                  <div><dt>Förmåga</dt><dd><StarBand range={c.visibility?.abilityRange ?? null} label="Förmåga" /></dd></div>
                  <div><dt>Potential</dt><dd><StarBand range={c.visibility?.potentialRange ?? null} label="Potential" /></dd></div>
                  <div><dt>Värde</dt><dd className="sd-num">{range(c.scoutReportView?.marketValueRange)}</dd></div>
                </dl>
              </div>
              <footer>
                <span className="sd-gain" aria-label={`Kännedom ${r.knowledgeFrom ?? "okänd"} till ${r.knowledgeTo} procent`}>
                  <span className="sd-gain-track"><i data-k="from" style={{ width: `${r.knowledgeFrom ?? 0}%` }} /><i data-k="to" style={{ left: `${r.knowledgeFrom ?? 0}%`, width: `${Math.max(0, r.knowledgeTo - (r.knowledgeFrom ?? 0))}%` }} /></span>
                  <small className="sd-num">Kännedom {r.knowledgeFrom !== null ? `${r.knowledgeFrom} → ` : ""}{r.knowledgeTo} %</small>
                </span>
                <button type="button" className="hm-btn hm-btn-sm" onClick={() => onOpen(c.playerId, kicker)}>Öppna rapport</button>
              </footer>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

// --- Kortlista (REC-01) --------------------------------------------------------------------------

export function ShortlistColumn({ list, needOf, onOpen }: { list: RecruitmentCandidate[]; needOf: (position: string) => NeedLevel; onOpen: (playerId: string) => void }) {
  const { setRecruitmentPriority } = useCareer();
  if (list.length === 0) return <div className="sd-empty"><p>Kortlistan är tom. Lägg spelare på den från en rapport, en rekommendation eller en upptäckt.</p></div>;
  return (
    <ol className="sd-short">
      {list.map((c, i) => {
        const up = shiftPriority(c.priority, -1), down = shiftPriority(c.priority, 1);
        const need = NEED_LABEL[needOf(c.position)];
        return (
          <li key={c.playerId} data-priority={c.priority}>
            <span className="sd-rank sd-num">{i + 1}</span>
            <button type="button" className="sd-short-main" onClick={() => onOpen(c.playerId)}>
              <b>{c.firstName.charAt(0)}. {c.lastName}</b>
              <small>{c.position} · {c.clubName}</small>
              <span className="sd-short-tags"><StarBand range={c.visibility?.abilityRange ?? null} label="Förmåga" /><em data-priority={c.priority}>{RECRUITMENT_PRIORITY_LABEL_SV[c.priority]}</em>{need && <em data-need>{need}</em>}</span>
            </button>
            <span className="sd-move">
              <button type="button" disabled={!up} aria-label={up ? `Höj prioritet till ${RECRUITMENT_PRIORITY_LABEL_SV[up]}` : "Högsta prioritet"} title={up ? `Höj till ${RECRUITMENT_PRIORITY_LABEL_SV[up]}` : "Redan toppmål"} onClick={() => up && setRecruitmentPriority(c.playerId, up)}>▲</button>
              <button type="button" disabled={!down} aria-label={down ? `Sänk prioritet till ${RECRUITMENT_PRIORITY_LABEL_SV[down]}` : "Lägsta prioritet"} title={down ? `Sänk till ${RECRUITMENT_PRIORITY_LABEL_SV[down]}` : "Redan låg"} onClick={() => down && setRecruitmentPriority(c.playerId, down)}>▼</button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// --- Ge ett uppdrag (REC-01, one typeahead field) -------------------------------------------------

export function AssignBox({ scouts, onScoutPlayer, onDone }: { scouts: ScoutCapacity[]; onScoutPlayer: (playerId: string, clubId: string) => void; onDone?: (message: string) => void }) {
  const { career, createBroadScoutingAssignment } = useCareer();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Exclude<AssignTarget, { kind: "PLAYER" }> | null>(null);
  const [scoutId, setScoutId] = useState(scouts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const suggestions = useMemo(() => (target ? [] : assignmentSuggestions(career, query)), [career, query, target]);
  const preview = target && scoutId ? previewBroadAssignment(career, scoutId, broadScope(target).type, broadScope(target).scope) : null;

  function pick(t: AssignTarget) {
    setError(null);
    if (t.kind === "PLAYER") { onScoutPlayer(t.playerId, t.clubId); setQuery(""); return; }
    setTarget(t);
  }
  function start() {
    if (!target) return;
    const { type, scope } = broadScope(target);
    const result = createBroadScoutingAssignment(scoutId, type, scope);
    if (!result.ok) { setError(result.errors.join(" ")); return; }
    onDone?.(`Svepet ${target.label} har startat. Första upptäckterna ${result.assignment?.endDate ?? ""}.`);
    setTarget(null); setQuery("");
  }

  return (
    <div className="sd-assign" id="sd-assign">
      {scouts.length === 0 && <p className="sd-err-inline">Klubben har ingen scout. <Link href="/career/staff/recruitment?role=SCOUT">Rekrytera en scout →</Link></p>}
      {!target ? (
        <>
          <label className="sd-field">Spelare, klubb, liga, land, position eller ålder (t.ex. &rdquo;U21&rdquo;)
            <input className="hm-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök…" aria-autocomplete="list" aria-controls="sd-suggest" disabled={scouts.length === 0} />
          </label>
          {suggestions.length > 0 && (
            <ul className="sd-suggest" id="sd-suggest" role="listbox">
              {suggestions.map((t) => <li key={t.key}><button type="button" role="option" aria-selected="false" onClick={() => pick(t)}><b>{t.label}</b><small>{t.kind === "PLAYER" ? `Spelarrapport · ${t.detail}` : `Svep · ${t.detail}`}</small></button></li>)}
            </ul>
          )}
          {query.trim().length >= 2 && suggestions.length === 0 && <p className="sd-hint">Inget matchar. Prova ett efternamn (minst tre bokstäver), en klubb, en liga, ett land, en position (MV, V9 …) eller &rdquo;U21&rdquo;.</p>}
        </>
      ) : (
        <div className="sd-assign-config">
          <p className="sd-assign-target"><span className="sd-tag">Svep</span><b>{target.label}</b><button type="button" className="sd-linkish" onClick={() => { setTarget(null); setError(null); }}>Ändra</button></p>
          <label className="sd-field">Scout<select className="hm-select" value={scoutId} onChange={(e) => { setScoutId(e.target.value); setError(null); }}>{scouts.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.suitability.toFixed(1)}/20 · {s.free ? "ledig" : `${s.active} i kö`}</option>)}</select></label>
          {preview && (preview.ok ? <p className="sd-hint sd-num">Upptäckter var {preview.cycleDays}:e dag, {preview.cycles} omgångar (~{preview.cycleDays * preview.cycles} dagar).</p> : <p className="sd-err-inline" role="alert">{preview.errors.join(" ")}</p>)}
          {error && <p className="sd-err-inline" role="alert">{error}</p>}
          <button type="button" className="hm-btn hm-btn-primary hm-btn-sm" disabled={!scoutId || !preview?.ok} onClick={start}>Starta svep</button>
        </div>
      )}
    </div>
  );
}

// --- Single pipeline list (REC-01e) --------------------------------------------------------------

export function PipelineList({ groups, onOpenReport, onRescout }: { groups: AssignmentGroups; onOpenReport: (playerId: string) => void; onRescout: (playerId: string, clubId: string) => void }) {
  const { career, cancelScoutingAssignment } = useCareer();
  const scoutName = (a: ScoutingAssignment) => findStaffMember(career, a.scoutStaffId)?.displayName ?? "Okänd scout";
  const name = (a: ScoutingAssignment) => { const p = getCareerPlayer(career, a.targetPlayerId); return p ? `${p.firstName} ${p.lastName}` : a.targetPlayerId; };
  const row = (a: ScoutingAssignment, children: ReactNode) => (
    <li key={a.id}><StaffMark name={scoutName(a)} size={26} /><div className="sd-pl-main">{children}</div></li>
  );
  const runningSweeps = groups.sweeps.filter((a) => a.status === "IN_PROGRESS").length;
  return (
    <div className="sd-pl" id="sd-pipeline">
      <details open><summary>Klar <b className="sd-num">{groups.ready.length}</b></summary>
        {groups.ready.length === 0 ? <p className="sd-hint">Inga färdiga rapporter.</p> : <ul>{groups.ready.map((a) => row(a, <><span><b>{name(a)}</b><small>{scoutName(a)} · klar {a.endDate}</small></span><span className="sd-pl-act"><button type="button" className="hm-btn hm-btn-sm" onClick={() => onOpenReport(a.targetPlayerId)}>Öppna rapport</button><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => onRescout(a.targetPlayerId, a.targetClubId)}>Scouta igen</button></span></>))}</ul>}
      </details>
      <details open><summary>Pågår <b className="sd-num">{groups.running.length}</b></summary>
        {groups.running.length === 0 ? <p className="sd-hint">Inga pågående spelaruppdrag.</p> : <ul>{groups.running.map((a) => { const p = computeAssignmentProgressPct(a, career.gameDate); return row(a, <><span><b>{name(a)}</b><small>{scoutName(a)} · rapport {a.endDate}</small></span><span className="sd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={`${p} procent klart`}><i style={{ width: `${p}%` }} /></span></>); })}</ul>}
      </details>
      <details open={runningSweeps > 0}><summary>Svep <b className="sd-num">{runningSweeps}</b></summary>
        {groups.sweeps.length === 0 ? <p className="sd-hint">Inga svep ännu. Ange en liga, ett land, en position eller &rdquo;U21&rdquo; ovan.</p> : <ul>{groups.sweeps.map((a) => { const p = computeAssignmentProgressPct(a, career.gameDate); const live = a.status === "IN_PROGRESS"; return row(a, <><span><b>{SOURCE_LABEL[a.assignmentType as Exclude<ScoutAssignmentType, "PLAYER">]} {scopeLabelSv(a)}</b><small>{scoutName(a)} · {live ? `omgång ${a.cyclesCompleted + 1}/${a.maxCycles} · nästa ${a.endDate}` : a.status === "COMPLETED" ? `avslutat · ${a.discoveredPlayerIds.length} upptäckta` : "avbrutet"}</small></span>{live ? <span className="sd-pl-act"><span className="sd-bar"><i style={{ width: `${p}%` }} /></span><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => cancelScoutingAssignment(a.id)}>Avbryt</button></span> : null}</>); })}</ul>}
      </details>
    </div>
  );
}

// --- Coverage map (REC-01d) ----------------------------------------------------------------------

export function CoverageMap({ tiles, scouts, onDone }: { tiles: CoverageTile[]; scouts: ScoutCapacity[]; onDone?: (message: string) => void }) {
  const { career, createBroadScoutingAssignment } = useCareer();
  const [pick, setPick] = useState<CoverageTile | null>(null);
  const [scoutId, setScoutId] = useState(scouts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const type = pick?.kind === "REGION" ? "REGION" : "COMPETITION";
  const scope = pick ? (pick.kind === "REGION" ? { targetNation: pick.id } : { targetCompetitionId: pick.id }) : {};
  const preview = pick && scoutId ? previewBroadAssignment(career, scoutId, type, scope) : null;
  function start() {
    if (!pick) return;
    const r = createBroadScoutingAssignment(scoutId, type, scope);
    if (!r.ok) { setError(r.errors.join(" ")); return; }
    onDone?.(`Svepet i ${pick.label} har startat.`);
    setPick(null);
  }
  return (
    <div className="sd-cov">
      <ul className="sd-tiles">
        {tiles.map((t) => (
          <li key={`${t.kind}-${t.id}`}>
            <button type="button" className="sd-tile" aria-pressed={pick?.kind === t.kind && pick.id === t.id} style={{ ["--cov" as string]: `${t.coverage}` }} title={t.activeSweeps ? `${t.activeSweeps} svep pågår här` : "Inget svep pågår här"} onClick={() => { setPick(t); setError(null); }}>
              <small>{t.kind === "REGION" ? "Land" : "Liga"}{t.activeSweeps ? ` · ${t.activeSweeps} svep` : ""}</small>
              <b>{t.label}</b>
              <span className="sd-cov-bar" aria-hidden="true"><i style={{ width: `${t.coverage}%` }} /></span>
              <span className="sd-num">Täckning {t.coverage} % · {t.knownPlayers}/{t.players} spelare kända</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sd-cov-config" aria-live="polite">
        {!pick ? <p className="sd-hint">Välj en liga eller ett land. De svagast täckta står först.</p> : (
          <>
            <p className="sd-assign-target"><span className="sd-tag">{pick.kind === "REGION" ? "Land" : "Liga"}</span><b>{pick.label}</b>{pick.kind === "COMPETITION" && <Link href={`/career/competitions/${encodeURIComponent(pick.id)}`}>Ligan →</Link>}</p>
            {scouts.length === 0 ? <p className="sd-err-inline">Klubben har ingen scout. <Link href="/career/staff/recruitment?role=SCOUT">Rekrytera en scout →</Link></p> : (
              <label className="sd-field">Scout<select className="hm-select" value={scoutId} onChange={(e) => { setScoutId(e.target.value); setError(null); }}>{scouts.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.suitability.toFixed(1)}/20 · {s.free ? "ledig" : `${s.active} i kö`}</option>)}</select></label>
            )}
            {preview && (preview.ok ? <p className="sd-hint sd-num">Upptäckter var {preview.cycleDays}:e dag, {preview.cycles} omgångar.</p> : <p className="sd-err-inline" role="alert">{preview.errors.join(" ")}</p>)}
            {error && <p className="sd-err-inline" role="alert">{error}</p>}
            <button type="button" className="hm-btn hm-btn-primary hm-btn-sm" disabled={!preview?.ok} onClick={start}>Starta svep</button>
          </>
        )}
      </div>
    </div>
  );
}

// --- Ranked discoveries (REC-01f) ----------------------------------------------------------------

export interface DiscoveryRow { id: string; playerId: string; clubId: string; name: string; position: string; scoutId: string; scoutName: string; source: Exclude<ScoutAssignmentType, "PLAYER">; discoveredDate: string; knowledgePct: number; abilityRange: { min: number; max: number } | null; potentialRange: { min: number; max: number } | null; needLevel: NeedLevel; shortlisted: boolean; active: boolean }

export function DiscoveriesTable({ rows, scouts, onOpen, onScout }: { rows: DiscoveryRow[]; scouts: ScoutCapacity[]; onOpen: (playerId: string) => void; onScout: (playerId: string, clubId: string) => void }) {
  const { addToShortlist, removeFromShortlist } = useCareer();
  const [scout, setScout] = useState("ALL");
  const [source, setSource] = useState<string>("ALL");
  const [sort, setSort] = useState<DiscoverySort>("KNOWN");
  const shown = sortDiscoveries(rows.filter((r) => (scout === "ALL" || r.scoutId === scout) && (source === "ALL" || r.source === source)), sort).slice(0, 80);
  const chip = (active: boolean, label: string, onClick: () => void, key: string) => <button key={key} type="button" className="sd-chip" aria-pressed={active} onClick={onClick}>{label}</button>;
  return (
    <div className="sd-disc">
      <div className="sd-filters">
        <div className="sd-chips" role="group" aria-label="Scout">{chip(scout === "ALL", "Alla scouter", () => setScout("ALL"), "all")}{scouts.map((s) => chip(scout === s.id, s.name, () => setScout(s.id), s.id))}</div>
        <div className="sd-chips" role="group" aria-label="Källa">{chip(source === "ALL", "Alla källor", () => setSource("ALL"), "all")}{(Object.keys(SOURCE_LABEL) as (keyof typeof SOURCE_LABEL)[]).map((k) => chip(source === k, SOURCE_LABEL[k], () => setSource(k), k))}</div>
        <label className="sd-field sd-sort">Sortera<select className="hm-select" value={sort} onChange={(e) => setSort(e.target.value as DiscoverySort)}><option value="KNOWN">Bäst kända först</option><option value="ABILITY">Högst bedömd förmåga</option><option value="NEED">Efter truppens behov</option><option value="NEWEST">Senast upptäckta</option></select></label>
      </div>
      {shown.length === 0 ? <div className="sd-empty"><p>{rows.length === 0 ? "Inga upptäckta spelare ännu. Starta ett svep -- scouten hittar namn du inte kände till." : "Ingen upptäckt matchar filtret."}</p>{rows.length === 0 && <a className="hm-btn hm-btn-sm" href="#sd-assign">Ge ett uppdrag</a>}</div> : (
        <div className="sd-table-wrap">
          <table className="hm-table sd-table">
            <thead><tr><th>Spelare</th><th>Förmåga</th><th>Potential</th><th className="hm-table-num">Kännedom</th><th>Källa</th><th>Scout</th><th><span className="sd-sr">Åtgärder</span></th></tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.id}>
                  <td data-label="Spelare"><span className="sd-rank sd-num">{i + 1}</span><button type="button" className="sd-linkish" onClick={() => onOpen(r.playerId)}><b>{r.name}</b></button><small> {r.position} · <ClubLink clubId={r.clubId}>{getClub(r.clubId)?.shortName ?? r.clubId}</ClubLink>{NEED_LABEL[r.needLevel] ? <em className="sd-need"> · {NEED_LABEL[r.needLevel]}</em> : null}</small></td>
                  <td data-label="Förmåga"><StarBand range={r.abilityRange} label="Förmåga" /></td>
                  <td data-label="Potential"><StarBand range={r.potentialRange} label="Potential" /></td>
                  <td data-label="Kännedom" className="hm-table-num sd-num">{r.knowledgePct} %</td>
                  <td data-label="Källa">{SOURCE_LABEL[r.source] ?? r.source}</td>
                  <td data-label="Scout">{r.scoutName}</td>
                  <td className="sd-row-act">
                    <button type="button" className="hm-btn hm-btn-sm" aria-pressed={r.shortlisted} onClick={() => (r.shortlisted ? removeFromShortlist(r.playerId) : addToShortlist(r.playerId))}>{r.shortlisted ? "På Kortlista ✓" : "Kortlista"}</button>
                    {r.active ? <span className="sd-hint">Scoutas</span> : <button type="button" className="hm-btn hm-btn-sm" disabled={scouts.length === 0} title={scouts.length === 0 ? "Klubben har ingen scout" : undefined} onClick={() => onScout(r.playerId, r.clubId)}>Scouta</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {scouts.length === 0 && rows.length > 0 && <p className="sd-hint">Scouta kräver en anställd scout.</p>}
    </div>
  );
}
