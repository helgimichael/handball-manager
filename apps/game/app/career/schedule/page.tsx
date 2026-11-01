"use client";
import Link from "next/link";
import { Panel } from "@/components/manager/Workspace";
import { SectionScene } from "@/components/game/Secondary";
import ClubCrest from "@/components/ClubCrest";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLUBS, COMPETITIONS, getClub } from "@/lib/game-data";
import { useCareer } from "@/lib/career/CareerContext";
import { getCareerClub } from "@/lib/career/careerWorld";
import { getNextPlayerFixture } from "@/lib/career/calendar";
import { getSeasonPhase } from "@/lib/career/preseason";
import { ClubLink } from "@/components/entityLinks";
import type { CareerFixtureType } from "@/lib/career/types";

const FIXTURE_TYPE_LABEL: Record<CareerFixtureType, string> = { LEAGUE: "Liga", CUP: "Cup", FRIENDLY: "Träningsmatch", PLAYOFF: "SM-slutspel", QUALIFIER: "Kval" };
const FIXTURE_TYPE_TONE: Record<CareerFixtureType, string> = { LEAGUE: "neutral", CUP: "warning", FRIENDLY: "positive", PLAYOFF: "warning", QUALIFIER: "warning" };

export default function SchedulePage() {
  const router = useRouter();
  const { career, bookFriendly } = useCareer();
  const club = getCareerClub(career);
  const next = getNextPlayerFixture(career);
  const [view,setView] = useState<"ALL"|"UPCOMING"|"RESULTS">("ALL");
  const competitionName = COMPETITIONS.find((c) => c.id === career.competitionId)?.name ?? "Ligan";
  const seasonPhase = getSeasonPhase(career);

  const fixtures = career.fixtures
    .filter((f) => f.homeClubId === club.id || f.awayClubId === club.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const shownFixtures = fixtures.filter(f => view === "ALL" || (view === "RESULTS" ? Boolean(career.results[f.id]) : !career.results[f.id]));
  const playedCount = fixtures.filter(f => career.results[f.id]).length;
  const nextOpponent = next ? getClub(next.homeClubId === club.id ? next.awayClubId : next.homeClubId) : null;
  return (
    <div className="game-secondary-page">
      <SectionScene eyebrow={`${club.name} · ${career.seasonId}`} title="Matcher & resultat" description="Säsongens rytm. Följ nästa avkast, kommande motstånd och matchernas konsekvenser." mark={<ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={72} />} actions={<><Link className="hm-btn hm-btn-sm" href="/career/calendar">Kalender →</Link><Link className="hm-btn hm-btn-sm" href="/career/match-2d">Matchrepriser →</Link></>}><div><strong>{playedCount}</strong><small>spelade matcher</small></div><div><strong>{fixtures.length-playedCount}</strong><small>matcher kvar</small></div></SectionScene>
      <div className="game-secondary-split">
        <div className="game-secondary-main">
          <nav className="hm-tabs" aria-label="Matchprogram">{[["ALL","Hela säsongen"],["UPCOMING","Kommande"],["RESULTS","Resultat"]].map(([id,label]) => <button key={id} aria-pressed={view===id} onClick={() => setView(id as "ALL"|"UPCOMING"|"RESULTS")}>{label}</button>)}</nav>
                <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Säsongsschema — {competitionName} {career.seasonId}</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`hm-badge hm-badge-${seasonPhase === "PRESEASON" ? "warning" : "positive"}`}>{seasonPhase === "PRESEASON" ? "Försäsong" : "Tävlingssäsong"}</span>
          <span className="hm-text-muted" style={{ fontSize: "var(--hm-text-2xs)" }}>{fixtures.length} matcher</span>
        </span>
      </div>
      <div className="hm-scroll-x">
        <table className="hm-table game-schedule-table">
          <thead>
            <tr>
              <th>Omg</th>
              <th>Datum</th>
              <th>Typ</th>
              <th>Hemma / Borta</th>
              <th>Motstånd</th>
              <th>Status</th>
              <th>Resultat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shownFixtures.map((f) => {
              const home = f.homeClubId === club.id;
              const opponent = getClub(home ? f.awayClubId : f.homeClubId)!;
              const result = career.results[f.id];
              const isNext = !result && f.id === next?.id;
              const played = Boolean(result);
              // HM-UX-0.2 (Spec §36): Match Preview always shows the
              // career's actual next fixture, not an arbitrary one --
              // it has no per-fixture route. A future (not-yet-next)
              // fixture must not link there, or clicking round 8 would
              // silently show round 3's preview. Only the real next
              // fixture, and every already-played one, are clickable.
              const clickable = played || isNext;
              const gf = result ? (home ? result.homeGoals : result.awayGoals) : undefined;
              const ga = result ? (home ? result.awayGoals : result.homeGoals) : undefined;
              const outcome = result ? (gf! > ga! ? "Vinst" : gf! < ga! ? "Förlust" : "Oavgjort") : undefined;
              const outcomeTone = outcome === "Vinst" ? "positive" : outcome === "Förlust" ? "negative" : "warning";
              return (
                <tr
                  key={f.id}
                  data-clickable={clickable}
                  data-highlight={isNext}
                  onClick={clickable ? () => router.push(played ? `/career/match-report/${f.id}` : "/career/match-preview") : undefined}
                >
                  <td>{f.type === "LEAGUE" ? f.round : "—"}</td>
                  <td>{new Date(f.date).toLocaleDateString("sv-SE", { weekday: "short", day: "2-digit", month: "2-digit" })}{f.kickoffTime ? ` ${f.kickoffTime}` : ""}</td>
                  <td>
                    <span className={`hm-badge hm-badge-${FIXTURE_TYPE_TONE[f.type]}`}>{FIXTURE_TYPE_LABEL[f.type]}</span>
                  </td>
                  <td>{home ? "Hemma" : "Borta"}</td>
                  <td className="hm-td-strong">
                    <ClubLink clubId={opponent.id} stopPropagation>
                      {opponent.name}
                    </ClubLink>
                  </td>
                  <td>
                    <span className={`hm-badge ${played ? `hm-badge-${outcomeTone}` : isNext ? "hm-badge-positive" : "hm-badge-neutral"}`}>
                      {played ? outcome : isNext ? "Nästa match" : "Kommande"}
                    </span>
                  </td>
                  <td>
                    {result ? (
                      <Link className="hm-result-link" href={`/career/match-report/${f.id}`} onClick={e => e.stopPropagation()}>{gf}–{ga}</Link>
                    ) : (
                      <span className="hm-text-muted">—</span>
                    )}
                  </td>
                  <td>{!played && <Link href={`/career/fixtures/${f.id}`} onClick={e => e.stopPropagation()}>Förhandsvisa →</Link>}{played && <Link href={`/career/match-report/${f.id}`} onClick={e => e.stopPropagation()}>Matchrapport →</Link>}</td>
                </tr>
              );
            })}
            {shownFixtures.length === 0 && <tr><td colSpan={8}>Inga matcher i den här vyn.</td></tr>}
          </tbody>
        </table>
      </div>
      </div>

        </div>
        <aside className="game-secondary-rail">
          <Panel title="Nästa match">{next && nextOpponent ? <div className="hm-panel-body"><div className="game-staff-cell"><ClubCrest shortName={nextOpponent.shortName} primaryColor={nextOpponent.primaryColor} clubId={nextOpponent.id} size={58} /><div><ClubLink clubId={nextOpponent.id}>{nextOpponent.name}</ClubLink><small>{next.date}{next.kickoffTime ? ` ${next.kickoffTime}` : ""} · {next.homeClubId===club.id ? "Hemma" : "Borta"} · {FIXTURE_TYPE_LABEL[next.type]}</small></div></div><div className="hm-actions" style={{marginTop:20}}><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/match-preview">Förbered matchen →</Link><Link className="hm-btn hm-btn-sm" href="/career/tactics">Uttagning →</Link></div></div> : <div className="hm-panel-body hm-text-muted">Ingen ospelad match registrerad för ditt lag.</div>}</Panel>
          {seasonPhase==="PRESEASON" && <FriendlyBooking clubId={club.id} onBook={bookFriendly} />}
          <section className="game-secondary-note"><h2>Den sportsliga veckan</h2><p>Matchprogrammet visar avkasten. Kalendern knyter ihop träning, återhämtning och datum som kräver din uppmärksamhet.</p><div className="hm-actions"><Link className="hm-btn hm-btn-sm" href="/career/training">Träning →</Link><Link className="hm-btn hm-btn-sm" href="/career/calendar">Kalender →</Link></div></section>
        </aside>
      </div>
    </div>
  );
}

/** HM-PRESEASON-1.0: simple date + opponent booking form -- no negotiation, only date/opponent conflict validation (lib/career/preseason.ts's bookFriendly). */
function FriendlyBooking({ clubId, onBook }: { clubId: string; onBook: (date: string, opponentClubId: string) => { ok: boolean; error?: string } }) {
  const opponents = CLUBS.filter((c) => c.id !== clubId && c.playable);
  const [date, setDate] = useState("");
  const [opponentClubId, setOpponentClubId] = useState(opponents[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "positive" | "negative"; text: string } | null>(null);

  function handleBook() {
    if (!date || !opponentClubId) {
      setMessage({ tone: "negative", text: "Välj datum och motståndare." });
      return;
    }
    const result = onBook(date, opponentClubId);
    setMessage(result.ok ? { tone: "positive", text: "Träningsmatch bokad." } : { tone: "negative", text: result.error ?? "Kunde inte boka matchen." });
  }

  return (
    <div className="hm-panel">
      <div className="hm-panel-header">
        <span className="hm-panel-title">Boka träningsmatch</span>
      </div>
      <div className="hm-panel-body" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="hm-eyebrow">Datum</span>
          <input type="date" className="hm-select" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="hm-eyebrow">Motståndare</span>
          <select className="hm-select" value={opponentClubId} onChange={(e) => setOpponentClubId(e.target.value)}>
            {opponents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="hm-btn hm-btn-primary" onClick={handleBook}>
          Boka
        </button>
        {message ? <span className={`hm-badge hm-badge-${message.tone}`}>{message.text}</span> : null}
      </div>
    </div>
  );
}
