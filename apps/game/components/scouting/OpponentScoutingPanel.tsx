"use client";
// HM-PLAYTEST-01 4.1: request, delegate and read opponent scouting.
import { useState } from "react";
import Link from "next/link";
import { useCareer } from "@/lib/career/CareerContext";
import { getNextPlayerFixture } from "@/lib/career/calendar";
import { STAFF_ROLE_LABEL } from "@/lib/staff/labels";
import { opponentName, opponentScoutingCandidates, requestOpponentScouting, scoutingAbility, scoutingReliability, setScoutingDelegate, CONFIDENCE_LABEL, type OpponentScoutReport } from "@/lib/scouting/opponentScouting";

const TONE = { HIGH: "ok", MEDIUM: "warn", LOW: "bad" } as const;

export function OpponentScoutReportView({ report }: { report: OpponentScoutReport }) {
  return (
    <div className="hm-scout-report">
      <p className="hm-plan-note">Rapport av {report.staffName}, {report.createdOn} · underlag {report.evidenceMatches} {report.evidenceMatches === 1 ? "match" : "matcher"} · <span className="hm-status" data-tone={report.reliability >= 0.78 ? "ok" : report.reliability >= 0.58 ? "warn" : "bad"}>{report.reliabilityLabel} säkerhet</span></p>
      {report.reliability < 0.58 && <p className="hm-plan-note" role="note">Rapporten bygger på begränsad kunskap. Uppgifterna om uppställning och spelsätt kan vara fel.</p>}
      <dl className="hm-scout-claims">
        {report.scouted.map((c) => <div key={c.topic}><dt>{c.topic} <span className="hm-status" data-tone={TONE[c.confidence]}>{CONFIDENCE_LABEL[c.confidence]}</span></dt><dd>{c.text}</dd></div>)}
      </dl>
      <h3>Observerat i spelade matcher</h3>
      <ul>{report.observed.map((o) => <li key={o}>{o}</li>)}</ul>
      {(report.strengths.length > 0 || report.weaknesses.length > 0) && <div className="hm-plan-columns">
        <div><h3>Styrkor</h3><ul>{report.strengths.length ? report.strengths.map((s) => <li key={s}>{s}</li>) : <li>Inga tydliga styrkor jämfört med serien.</li>}</ul></div>
        <div><h3>Svagheter</h3><ul>{report.weaknesses.length ? report.weaknesses.map((s) => <li key={s}>{s}</li>) : <li>Inga tydliga svagheter jämfört med serien.</li>}</ul></div>
      </div>}
      {report.recommendations.length > 0 && <><h3>Rekommendationer</h3><ul>{report.recommendations.map((r) => <li key={r}>{r}</li>)}</ul></>}
      <Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/tactics">Anpassa matchplanen →</Link>
    </div>
  );
}

export function OpponentScoutingPanel({ compact = false }: { compact?: boolean }) {
  const { career, updateCareer } = useCareer();
  const fixture = getNextPlayerFixture(career);
  const candidates = opponentScoutingCandidates(career).sort((a, b) => scoutingAbility(b) - scoutingAbility(a));
  const [staffId, setStaffId] = useState(candidates[0]?.id ?? "");
  if (!fixture) return null;
  const opponentId = fixture.homeClubId === career.playerClubId ? fixture.awayClubId : fixture.homeClubId;
  const scouting = career.opponentScouting;
  const report = scouting?.reports[fixture.id];
  const pending = scouting?.requests[fixture.id];
  const pendingBy = pending ? candidates.find((m) => m.id === pending.staffId)?.displayName : null;
  const chosen = candidates.find((m) => m.id === staffId);
  const evidence = Object.keys(career.results).filter((id) => { const f = career.fixtures.find((x) => x.id === id); return f && f.type !== "FRIENDLY" && (f.homeClubId === opponentId || f.awayClubId === opponentId); }).length;
  const expected = chosen ? scoutingReliability(scoutingAbility(chosen), evidence) : 0;
  return (
    <section className="hm-plan-section" aria-labelledby="scout-title">
      <header><h2 id="scout-title">Scouting av {opponentName(opponentId)}</h2><p>Skicka en analytiker eller scout att studera motståndaren. Rapportens säkerhet beror på personens förmåga och på hur många matcher motståndaren har spelat.</p></header>
      {report ? <OpponentScoutReportView report={report} /> : pending ? <p role="status">{pendingBy ?? "Staben"} arbetar med rapporten – klar {pending.readyOn}.</p> : candidates.length === 0 ? <p className="hm-plan-note">Klubben har ingen analytiker, scout eller assisterande tränare som kan scouta. <Link href="/career/staff/recruitment?role=ANALYST">Rekrytera en analytiker →</Link></p> : (
        <div className="hm-plan-grid">
          <label className="hm-plan-field"><span>Ansvarig</span>
            <select className="hm-select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {candidates.map((m) => <option key={m.id} value={m.id}>{m.displayName} · {m.roles.map((r) => STAFF_ROLE_LABEL[r].toLowerCase()).join(", ")}</option>)}
            </select>
          </label>
          <div className="hm-plan-field"><span>Förväntad säkerhet</span><strong>{expected >= 0.78 ? "Hög" : expected >= 0.58 ? "Medel" : "Låg"} ({evidence} matcher att studera)</strong></div>
          <div className="hm-plan-field"><span>&nbsp;</span><button type="button" className="hm-btn hm-btn-primary" disabled={!chosen} onClick={() => updateCareer((s) => requestOpponentScouting(s, fixture.id, staffId))}>Beställ scoutingrapport</button></div>
        </div>
      )}
      {!compact && candidates.length > 0 && (
        <label className="hm-plan-field hm-scout-delegate">
          <span>Delegera: scouta alltid nästa motståndare</span>
          <select className="hm-select" value={scouting?.delegateStaffId ?? ""} onChange={(e) => updateCareer((s) => setScoutingDelegate(s, e.target.value || null))}>
            <option value="">Nej, jag beställer själv</option>
            {candidates.map((m) => <option key={m.id} value={m.id}>Ja – {m.displayName}</option>)}
          </select>
        </label>
      )}
    </section>
  );
}
